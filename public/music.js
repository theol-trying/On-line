// Moteur de musique PARTAGÉ — WebAudio, zéro dépendance.
// Chaque jeu définit un THÈME data-driven (tempo + couches basse/mélodie/nappe/percussions) et pilote
// une INTENSITÉ : 0 = lobby/calme (couches min:0), 1 = en jeu, 2 = climax (mort subite, duel final…).
// Le moteur lit a11y.music en continu : le réglage 🎵 du shell (dé)coupe la musique de tous les jeux.
//
// MUSIQUE EN FICHIERS : si THEME.piste désigne un jeu de pistes.js, la musique vient de ses deux morceaux
// (menu / partie), joués par le lecteur partagé piste.js ; les couches générées se taisent. Les fanfares
// (sting) restent synthétisées par-dessus, et la musique générée revient si un morceau ne se charge pas.
// Phase : 'lobby' -> morceau de menu ; 'countdown' / 'play' / 'paused' / 'over' -> morceau de partie
// (gardé sur l'écran de fin jusqu'au choix « Accueil » / ✕, étouffé en pause, accéléré de 6 % en climax).
//
// API : const m = createMusic(() => actx, () => a11y, THEME); m.start(); m.setIntensity(0|1|2, m.gs?); m.stop();
// THÈME : { piste?, bpm, bpmBoost? (ajouté au bpm en climax), vol? (master 0..1), root (Hz), len? (pas, 16 = 1 mesure),
//   layers: [ { seq:[demi-tons | null | [accord]], wave?, oct?, gain?, dur? (en pas), min? (intensité mini) }
//             { drums:'K.H.S…' (K=grosse caisse, S=caisse claire, H=charley, .=silence), gain?, min? } ] }
import * as piste from './piste.js';
import { accueilChoisi, quandFinChange } from './ecran-fin.js';

let pousserActif = null;                               // pousser() de l'instance du jeu affiché
quandFinChange(function () { if (pousserActif) pousserActif(); });   // « Accueil » à la fin : morceau de menu tout de suite

export function createMusic(getCtx, getA11y, theme) {
  const fichier = theme.piste && piste.aDesPistes(theme.piste) ? theme.piste : null;
  let gs = null, actif = false;
  function phase() {
    if (gs === 'lobby') return 'menu';
    if (gs === 'over') return accueilChoisi() ? 'menu' : 'jeu';
    if (gs === 'countdown' || gs === 'play' || gs === 'paused') return 'jeu';
    return intensity >= 1 ? 'jeu' : 'menu';
  }
  function pousser() {
    if (!fichier || !actif || disposed) return;
    piste.regler({ id: fichier, phase: phase(), climax: intensity >= 2 && gs !== 'paused', pause: gs === 'paused' }, getA11y);
  }
  function generee() { return !fichier || piste.enErreur(fichier, phase()); }   // couches synthétisées audibles ?
  let timer = null, ctx = null, master = null, noiseBuf = null;
  let nextT = 0, step = 0, intensity = 0;
  const LEN = theme.len || 32;

  function ensure() {                                  // (re)branche le moteur sur l'AudioContext du jeu (créé au 1er geste utilisateur)
    const c = getCtx(); if (!c) return null;
    if (c !== ctx) {
      ctx = c;
      master = c.createGain(); master.gain.value = 0; master.connect(c.destination);
      const sr = c.sampleRate, b = c.createBuffer(1, Math.floor(sr * 0.4), sr), d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;   // bruit blanc partagé (percussions)
      noiseBuf = b; nextT = 0;
    }
    return c;
  }
  function osc(t, freq, dur, wave, gain) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = wave; o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
  }
  function drum(t, kind, vel) {
    if (kind === 'K') {                                // grosse caisse : sinus qui plonge
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(105, t); o.frequency.exponentialRampToValueAtTime(38, t + 0.11);
      g.gain.setValueAtTime(0.5 * vel, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
      o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.15);
      return;
    }
    const s = ctx.createBufferSource(), g = ctx.createGain(), f = ctx.createBiquadFilter();   // S/H : bruit filtré
    s.buffer = noiseBuf; f.type = 'highpass'; f.frequency.value = kind === 'H' ? 6500 : 1700;
    const d = kind === 'H' ? 0.04 : 0.12;
    g.gain.setValueAtTime((kind === 'H' ? 0.10 : 0.22) * vel, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + d + 0.02);
  }
  function playStep(t, st, spb) {
    for (const L of theme.layers) {
      if (intensity < (L.min || 0)) continue;
      if (L.drums) { const ch = L.drums[st % L.drums.length]; if (ch && ch !== '.') drum(t, ch, L.gain == null ? 1 : L.gain); continue; }
      const n = L.seq[st % L.seq.length];
      if (n == null) continue;
      const dur = (L.dur || 1.7) * spb, base = theme.root * Math.pow(2, L.oct || 0);
      const one = s => osc(t, base * Math.pow(2, s / 12), dur, L.wave || 'triangle', L.gain == null ? 0.04 : L.gain);
      Array.isArray(n) ? n.forEach(one) : one(n);
    }
  }
  function sched() {                                   // ordonnanceur à fenêtre d'avance (220 ms) sur l'horloge audio
    const c = ensure(), A = getA11y();
    const on = !!(c && c.state === 'running' && A && A.music);
    const vol = (theme.vol == null ? 0.5 : theme.vol) * (A && A.mvol != null ? A.mvol : 1);   // volume musique séparé (réglages 🎵)
    if (master && c) master.gain.setTargetAtTime(on ? vol : 0, c.currentTime, 0.12);
    if (!on) { nextT = 0; return; }
    if (!generee()) { nextT = 0; return; }             // le morceau joue : le master ne sert plus qu'aux fanfares
    const spb = 60 / (theme.bpm + (intensity >= 2 ? (theme.bpmBoost || 0) : 0)) / 4;   // durée d'une double-croche
    if (!nextT || nextT < c.currentTime) { nextT = c.currentTime + 0.08; step = 0; }
    while (nextT < c.currentTime + 0.22) { playStep(nextT, step, spb); step = (step + 1) % LEN; nextT += spb; }
  }
  function sting(kind) {                               // petite fanfare ponctuelle (kill, victoire…) par-dessus la musique
    const c = ensure(), A = getA11y();
    const st = theme.stingers && theme.stingers[kind];
    if (!st || !c || c.state !== 'running' || !A || !A.music) return;
    if (fichier && st.duck !== false) piste.baisser();
    if (master && st.duck !== false) { const v = (theme.vol == null ? 0.5 : theme.vol) * (A.mvol != null ? A.mvol : 1); master.gain.cancelScheduledValues(c.currentTime); master.gain.setValueAtTime(Math.min(master.gain.value || v, v * 0.35), c.currentTime); }   // ducking : la musique s'efface brièvement (l'ordonnanceur la remonte en ~300 ms)
    const t0 = c.currentTime + 0.02, rate = st.rate || 0.075, base = st.base || theme.root * Math.pow(2, st.oct == null ? 1 : st.oct);
    st.notes.forEach((n, i) => { (Array.isArray(n) ? n : [n]).forEach(s => osc(t0 + i * rate, base * Math.pow(2, s / 12), st.dur || 0.16, st.wave || 'triangle', st.gain || 0.05)); });
  }
  // écran verrouillé / onglet masqué : on suspend tout l'audio (musique + SFX) ; on relance au retour
  let disposed = false;
  function onVis() { if (disposed) return; const c = getCtx(); if (!c) return; try { if (document.hidden) c.suspend(); else c.resume(); } catch {} }
  document.addEventListener('visibilitychange', onVis);
  return {
    start() {
      if (!timer) timer = setInterval(sched, 90);
      actif = true; pousserActif = pousser;
      if (fichier) pousser(); else piste.silence();    // jeu sans morceaux : celui du jeu précédent s'efface
    },
    // stop / dispose ne coupent PAS le morceau en cours : le jeu suivant enchaîne dessus en fondu.
    stop() { actif = false; if (pousserActif === pousser) pousserActif = null; if (timer) { clearInterval(timer); timer = null; } if (master && ctx) master.gain.setTargetAtTime(0, ctx.currentTime, 0.06); nextT = 0; },
    setIntensity(v, etat) { intensity = Math.max(0, Math.min(2, v | 0)); if (etat !== undefined) gs = etat; pousser(); },
    sting,
    // Teardown (changement de jeu) : arrête l'ordonnanceur et retire l'écouteur — sinon il relançait
    // (c.resume()) l'AudioContext d'un jeu déjà quitté au retour sur l'onglet.
    dispose() {
      disposed = true; actif = false; if (pousserActif === pousser) pousserActif = null;
      if (timer) { clearInterval(timer); timer = null; }
      if (master && ctx) { try { master.gain.setTargetAtTime(0, ctx.currentTime, 0.06); } catch {} }
      document.removeEventListener('visibilitychange', onVis);
    },
  };
}
