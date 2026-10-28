// Lecteur des musiques en FICHIERS, partagé par tous les jeux : un seul AudioContext pour toute la page,
// créé au premier geste puis conservé. La musique enchaîne donc d'un jeu à l'autre sans attendre un nouveau
// geste (le meneur change de jeu : les autres joueurs n'ont rien touché). music.js lui délègue la musique
// de tout jeu présent dans PISTES ; les fanfares (sting) et les bruitages restent synthétisés par le jeu.
//
// Graphe : voix (tampon) -> fondu de boucle -> bus de piste (fondu menu/partie) -> feutre (pause)
//          -> ducking (fanfares) -> sortie (🎵 + volume musique) -> haut-parleurs
// Rien n'est téléchargé tant que 🎵 est coupé ; seules les deux pistes du jeu affiché restent en mémoire.
// 🎵 coupé : contexte suspendu (aucun calcul audio). Morceau voulu en échec : la piste audible s'efface et
// music.js joue sa musique générée jusqu'à ce qu'un nouvel essai (toutes les 30 s) réussisse.
import { PISTES, FONDU_BOUCLE, FONDU_PISTE, CLIMAX, positionA, vitesseA, instantPour } from './pistes.js';

// Niveau de base. Les morceaux sont masterisés fort (~-14,5 dBFS RMS, crêtes à 0 dBFS) alors que les bruitages
// synthétisés sont discrets (~-27 dBFS) : à 0,17 × volume musique par défaut (0,7), le morceau sort vers
// -33,5 dBFS RMS, sous les bruitages, un peu au-dessus de l'ancienne musique générée (~-38 dBFS).
const VOL = 0.17;
const RAMPE = 0.6;         // s : montée / descente de vitesse (climax)
const AVANCE = 0.6;        // s : la voix suivante d'une boucle est programmée ce délai avant son départ
const FEUTRE_PAUSE = 700;  // Hz : partie en pause = musique étouffée
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

let ctx = null, sortie = null, ducking = null, feutre = null;
let getA11y = null, voulu = null, timer = 0, coupeDepuis = 0, reprise = false;
let courante = null;       // { info, buf, bus, voix: [] } : piste audible
let anciennes = [];        // pistes en fondu de sortie (même forme + finT)
const tampons = new Map(); // nom de fichier -> { etat: 'reseau'|'brut'|'decode'|'ok'|'erreur', brut, buf, echoue, erreurT }
const dernier = { vol: -1, feutre: -1, vitesse: 1 };

function courbe(monte) {   // fondu à puissance constante (pas de creux au milieu du fondu enchaîné)
  const n = 32, c = new Float32Array(n);
  for (let i = 0; i < n; i++) { const x = i / (n - 1) * Math.PI / 2; c[i] = monte ? Math.sin(x) : Math.cos(x); }
  return c;
}
const MONTE = courbe(true), DESCEND = courbe(false);

const musiqueVoulue = () => { const A = getA11y ? getA11y() : null; return !!(A && A.music); };
// resume() sans s'empiler quand c'est le tick (toutes les 200 ms) qui le demande. Un GESTE passe toujours : sur
// téléphone, le premier resume() part du pointerdown tactile, qui n'active pas l'audio, et sa promesse reste en
// attente ; seul le touchend / click qui suit peut débloquer (sinon : plus aucune musique jusqu'au rechargement).
function reprendre(geste) {
  if (!ctx || (reprise && !geste)) return;
  reprise = true;
  const fin = function () { reprise = false; tick(); };
  try { const p = ctx.resume(); if (p && p.then) p.then(fin, fin); else fin(); } catch (e) { reprise = false; }
}
function suspendre() { try { const p = ctx.suspend(); if (p && p.catch) p.catch(function () {}); } catch (e) {} }

function deverrouiller() {
  if (!ctx) {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return;
    try { ctx = new C(); } catch (e) { return; }
    sortie = ctx.createGain(); sortie.gain.value = 0; sortie.connect(ctx.destination);
    ducking = ctx.createGain(); ducking.connect(sortie);
    feutre = ctx.createBiquadFilter(); feutre.type = 'lowpass'; feutre.frequency.value = 20000; feutre.Q.value = 0.5; feutre.connect(ducking);
    dernier.vol = -1; dernier.feutre = -1;
    reprendre(true);                                   // contexte neuf : débloqué DANS le geste, même si 🎵 est coupé (le clic qui le remet n'aura qu'à reprendre)
    return;
  }
  if (ctx.state === 'running' || document.hidden) return;   // déjà actif : rien à faire (keydown se répète en jeu)
  if (getA11y && !musiqueVoulue()) return;                  // 🎵 coupé : le contexte reste suspendu
  reprendre(true);
}
// iOS ne débloque l'audio que dans touchend / click ; un appel interrompu (téléphone) re-suspend le contexte :
// on garde donc les écouteurs, chaque geste relance au besoin.
['pointerdown', 'touchend', 'mousedown', 'keydown', 'click'].forEach(function (ev) { document.addEventListener(ev, deverrouiller, true); });
document.addEventListener('visibilitychange', function () {
  if (!ctx) return;
  if (document.hidden) suspendre();
  else if (voulu && musiqueVoulue()) reprendre();
});

// Échec persistant : le drapeau survit aux nouveaux essais, la musique générée reste donc audible pendant
// qu'un essai est en cours ; il ne tombe qu'au premier décodage réussi.
const enEchec = t => !!(t && (t.etat === 'erreur' || (t.echoue && t.etat !== 'ok')));
function charger(nom) {
  let t = tampons.get(nom), echoue = false;
  if (t && t.etat === 'erreur' && Date.now() - t.erreurT > 30000) { tampons.delete(nom); t = null; echoue = true; }   // réseau mobile capricieux : on retente toutes les 30 s
  if (!t) {
    t = { etat: 'reseau', brut: null, buf: null, echoue: echoue, erreurT: 0 };
    tampons.set(nom, t);
    const ko = function () { t.etat = 'erreur'; t.echoue = true; t.erreurT = Date.now(); };
    fetch('/music/' + nom).then(function (r) { if (!r.ok) throw new Error(String(r.status)); return r.arrayBuffer(); })
      .then(function (ab) { if (tampons.get(nom) !== t) return; t.brut = ab; t.etat = 'brut'; tick(); }, ko);
  }
  if (t.etat === 'brut' && ctx) {                      // décodage seulement une fois le contexte créé (premier geste)
    const ab = t.brut; t.brut = null; t.etat = 'decode';
    const ok = function (b) { if (tampons.get(nom) !== t) return; t.buf = b; t.etat = 'ok'; t.echoue = false; tick(); };
    const ko = function () { t.etat = 'erreur'; t.echoue = true; t.erreurT = Date.now(); };
    try { const p = ctx.decodeAudioData(ab, ok, ko); if (p && p.catch) p.catch(ko); } catch (e) { ko(); }
  }
  return t;
}

// Climax : seulement sur le morceau de PARTIE du jeu voulu (pas sur un menu encore audible pendant un chargement).
function vitesseVoulue(info) {
  return voulu && voulu.climax && voulu.phase === 'jeu' && own(PISTES, voulu.id) && info === PISTES[voulu.id].jeu ? CLIMAX : 1;
}

function nouvelleVoix(p, quand, offset, vitesse) {
  const src = ctx.createBufferSource(), g = ctx.createGain();
  src.buffer = p.buf; src.playbackRate.value = vitesse;
  g.gain.value = 0;
  src.connect(g); g.connect(p.bus);
  src.start(quand, offset);
  const v = { src: src, g: g, t0: quand, t1: quand, r0: vitesse, r1: vitesse, pos0: offset, suite: false, finT: Infinity };
  p.voix.push(v);
  return v;
}
function arreterVoix(v, quand) { try { v.src.stop(quand); } catch (e) {} v.finT = Math.min(v.finT, quand + 0.1); }
function debrancher(v) { try { v.src.disconnect(); v.g.disconnect(); } catch (e) {} }

function sortir() {                                    // la piste audible s'efface en FONDU_PISTE (courante = null)
  if (!courante) return;
  const now = ctx.currentTime, old = courante, g = old.bus.gain;
  g.cancelScheduledValues(now); g.setValueAtTime(g.value, now); g.linearRampToValueAtTime(0, now + FONDU_PISTE);
  old.voix.forEach(function (v) { arreterVoix(v, now + FONDU_PISTE + 0.05); });
  old.finT = now + FONDU_PISTE + 0.2;
  anciennes.push(old);
  courante = null;
}

function basculer(info, t) {                           // fondu enchaîné vers une autre piste (menu <-> partie, autre jeu)
  const now = ctx.currentTime;
  sortir();
  const bus = ctx.createGain();
  bus.gain.value = 0; bus.connect(feutre);
  bus.gain.setValueAtTime(0, now); bus.gain.linearRampToValueAtTime(1, now + FONDU_PISTE);
  courante = { info: info, buf: t.buf, bus: bus, voix: [] };
  dernier.vitesse = vitesseVoulue(info);
  const v = nouvelleVoix(courante, now + 0.02, info.debut, dernier.vitesse);
  v.g.gain.value = 1;                                  // la première voix suit le fondu du bus
}

function boucler(p) {                                  // programme la voix suivante FONDU_BOUCLE avant la fin
  const v = p.voix[p.voix.length - 1];
  if (!v || v.suite) return;
  const now = ctx.currentTime, tX = instantPour(v, p.info.fin - FONDU_BOUCLE);
  if (tX - now > AVANCE) return;
  const quand = Math.max(tX, now + 0.05);
  const n = nouvelleVoix(p, quand, p.info.debut, vitesseA(v, quand));
  n.r1 = v.r1; n.t1 = Math.max(quand, v.t1);         // une rampe de vitesse en cours se poursuit sur la nouvelle voix
  if (n.r1 !== n.r0) { n.src.playbackRate.setValueAtTime(n.r0, quand); n.src.playbackRate.linearRampToValueAtTime(n.r1, n.t1); }
  n.g.gain.setValueCurveAtTime(MONTE, quand, FONDU_BOUCLE);
  v.g.gain.cancelScheduledValues(quand);
  v.g.gain.setValueCurveAtTime(DESCEND, quand, FONDU_BOUCLE);
  arreterVoix(v, quand + FONDU_BOUCLE + 0.05);
  v.suite = true;
}

function appliquerVitesse() {                          // climax : rampe de vitesse sur toutes les voix de la piste
  const cible = vitesseVoulue(courante.info);
  if (cible === dernier.vitesse) return;
  dernier.vitesse = cible;
  const now = ctx.currentTime;
  courante.voix.forEach(function (v) {
    const pr = v.src.playbackRate;
    if (v.t0 > now) {                                   // voix programmée mais pas encore partie : elle démarre à la bonne vitesse
      v.r0 = v.r1 = cible; v.t1 = v.t0;
      pr.cancelScheduledValues(0); pr.value = cible;
      return;
    }
    const r = vitesseA(v, now);
    v.pos0 = positionA(v, now); v.t0 = now; v.r0 = r; v.r1 = cible; v.t1 = now + RAMPE;
    pr.cancelScheduledValues(now); pr.setValueAtTime(r, now); pr.linearRampToValueAtTime(cible, now + RAMPE);
  });
}

function nettoyer() {
  const now = ctx.currentTime;
  if (courante) courante.voix = courante.voix.filter(function (v) { if (v.finT < now) { debrancher(v); return false; } return true; });
  anciennes = anciennes.filter(function (p) {
    if (p.finT >= now) return true;
    p.voix.forEach(debrancher); try { p.bus.disconnect(); } catch (e) {}
    return false;
  });
}

function liberer() {                                   // mémoire : ne garder que les pistes du jeu affiché (brutes ou décodées)
  const garder = {};
  if (voulu && own(PISTES, voulu.id)) { garder[PISTES[voulu.id].menu.f] = 1; garder[PISTES[voulu.id].jeu.f] = 1; }
  if (courante) garder[courante.info.f] = 1;
  anciennes.forEach(function (p) { garder[p.info.f] = 1; });
  tampons.forEach(function (t, nom) { if (!garder[nom] && t.etat !== 'reseau' && t.etat !== 'decode') tampons.delete(nom); });
}

function toutArreter() {                               // 🎵 coupé depuis un moment : plus aucune voix ni tampon
  const now = ctx ? ctx.currentTime : 0;
  [courante].concat(anciennes).forEach(function (p) {
    if (!p) return;
    p.voix.forEach(function (v) { arreterVoix(v, now); debrancher(v); });
    try { p.bus.disconnect(); } catch (e) {}
  });
  courante = null; anciennes = []; dernier.vitesse = 1;
  tampons.forEach(function (t, nom) { if (t.etat !== 'reseau' && t.etat !== 'decode') tampons.delete(nom); });
}

function tick() {
  if (!getA11y) return;
  if (ctx && ctx.state === 'running') nettoyer();
  if (!voulu) { liberer(); return; }
  const A = getA11y(), on = !!(A && A.music);
  if (!on) {
    if (ctx && sortie && dernier.vol !== 0) { sortie.gain.setTargetAtTime(0, ctx.currentTime, 0.12); dernier.vol = 0; }
    if (!coupeDepuis) coupeDepuis = Date.now();
    else if (Date.now() - coupeDepuis > 3000) {
      if (courante || anciennes.length || tampons.size) toutArreter();
      if (ctx && ctx.state === 'running') suspendre();
    }
    return;
  }
  coupeDepuis = 0;
  if (!own(PISTES, voulu.id)) return;
  const jeu = PISTES[voulu.id], info = jeu[voulu.phase === 'jeu' ? 'jeu' : 'menu'];
  const t = charger(info.f);
  if (t.etat === 'ok') charger(jeu[voulu.phase === 'jeu' ? 'menu' : 'jeu'].f);   // précharge l'autre piste du jeu
  liberer();                                           // aussi avant le premier geste : les mp3 bruts d'un jeu quitté s'en vont
  if (!ctx) return;
  if (ctx.state !== 'running') { if (ctx.state === 'suspended' && !document.hidden) reprendre(); return; }   // 🎵 remis après une coupure
  const vol = VOL * (A.mvol == null ? 0.7 : A.mvol), now = ctx.currentTime;
  if (vol !== dernier.vol) { sortie.gain.setTargetAtTime(vol, now, 0.15); dernier.vol = vol; }
  const f = voulu.pause ? FEUTRE_PAUSE : 20000;
  if (f !== dernier.feutre) { feutre.frequency.setTargetAtTime(f, now, 0.25); dernier.feutre = f; }
  if (enEchec(t) && courante && courante.info !== info) sortir();   // pas de morceau sous la musique générée de repli
  if (t.etat === 'ok' && (!courante || courante.info !== info)) basculer(info, t);
  if (courante) { appliquerVitesse(); boucler(courante); }
}

// État voulu par le jeu affiché : { id, phase: 'menu'|'jeu', climax: bool, pause: bool }.
export function regler(etat, lireA11y) {
  getA11y = lireA11y;
  voulu = { id: etat.id, phase: etat.phase === 'jeu' ? 'jeu' : 'menu', climax: !!etat.climax, pause: !!etat.pause };
  if (!timer) timer = setInterval(tick, 200);
  tick();
}
// Plus de morceau voulu (jeu sans morceaux, chargement d'un jeu en échec) : la piste audible s'efface.
export function silence() {
  voulu = null;
  if (ctx) sortir();
  tick();
}
// Fanfare par-dessus la musique : elle s'efface brièvement puis remonte.
export function baisser() {
  if (!ctx || ctx.state !== 'running') return;
  const g = ducking.gain, t = ctx.currentTime;
  g.cancelScheduledValues(t); g.setValueAtTime(g.value, t);
  g.linearRampToValueAtTime(0.4, t + 0.05); g.setTargetAtTime(1, t + 0.5, 0.25);
}
export function aDesPistes(id) { return own(PISTES, id); }
// Vrai si la piste demandée n'a pas pu être chargée (même pendant un nouvel essai) : music.js joue alors la
// musique générée.
export function enErreur(id, phase) {
  if (!own(PISTES, id)) return true;
  return enEchec(tampons.get(PISTES[id][phase === 'jeu' ? 'jeu' : 'menu'].f));
}
// Pulsations visuelles calées sur le morceau audible (Pong) : nombre de temps écoulés depuis l'origine du morceau
// (bpm et temps de pistes.js, vitesse réelle comprise), ou null s'il n'y a pas de morceau audible ou pas de tempo.
export function pulsation() {
  if (!courante || !ctx || ctx.state !== 'running' || !courante.info.bpm || !musiqueVoulue()) return null;
  const now = ctx.currentTime, V = courante.voix;
  let v = V[V.length - 1];
  if (v && v.t0 + FONDU_BOUCLE / 2 > now && V.length > 1) v = V[V.length - 2];   // fondu de boucle : on suit la voix la plus forte
  if (!v) return null;
  return (positionA(v, now) - (courante.info.temps || 0)) * courante.info.bpm / 60;
}
// Diagnostic (sondes et console) : rien de tout cela n'est utilisé par les jeux.
export function etatPiste() {
  return {
    contexte: ctx ? ctx.state : 'aucun', voulu: voulu, piste: courante ? courante.info.f : null,
    voix: courante ? courante.voix.length : 0, fondus: anciennes.length, vitesse: dernier.vitesse,
    tampons: Array.from(tampons.keys()).map(function (k) { return k + ':' + tampons.get(k).etat; }),
    position: courante && courante.voix.length && ctx ? +positionA(courante.voix[courante.voix.length - 1], ctx.currentTime).toFixed(2) : null,
  };
}
