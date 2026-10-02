// Test des FINS DE MANCHE — zéro dépendance, un seul fichier, déterministe (RNG à graine).
//
//    node test/fins-de-manche.mjs          (npm test le lance APRÈS test/smoke.mjs)
//
// Pas de serveur ni de réseau : chaque jeu tourne dans une fausse salle calquée sur hub.js (membres, arrivées et
// départs avec délai de grâce, pause) et on joue beaucoup de manches avec des bots — en solo/duel/moitié/plein,
// en mêlée et en équipes (le bouton « mode » tourne à chaque manche), avec des départs en cours de manche, des
// arrivées, des pauses, des abandons. À chaque fin de manche on vérifie l'unique vérité des places
// (games/fin-manche.js) :
//   • la manche finit dans sa durée plafond (et ne reste jamais « en jeu » avec un seul camp vivant) ;
//   • place 1 = TOUTE l'équipe gagnante et elle seule ; nul (winner -1) = jamais une place 1 isolée ;
//   • places cohérentes : entières, dans 1..n, ex æquo à la compétition (1, 2, 2, 4) ;
//   • le classement enregistré lit les mêmes places (victoire enregistrée <=> place 1 avec un vainqueur) ;
//   • aucune exception, aucun NaN/undefined/Infinity dans les instantanés, podium stable sur l'écran de fin.
// Sort en code 1 au moindre échec. Aucune écriture : le classement n'est jamais initialisé (ni fichier, ni Upstash).
//
// Pourquoi ce fichier existe : l'audit du 28/09 a trouvé, par fuzz, des « place 1 » données à un perdant ou à un
// seul joueur d'un nul, dans 6 jeux sur 7 — chaque jeu recopiait son propre code de places. Ce test garde la
// règle commune vraie à chaque changement.

import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, join } from 'path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
for (const k of ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'LEADERBOARD_KEY', 'AVATAR_KEY', 'ADMIN_KEY', 'LEADERBOARD_FILE']) delete process.env[k];
const T0 = Date.now();
const IDS = ['pong', 'tron', 'tank', 'bomb', 'snake', 'sumo', 'foot', 'patate'];
const SEED = Number(process.env.FINS_SEED || 20260929);

let echecs = 0, tests = 0;
const ok = (nom, cond, detail) => {
  tests++;
  if (cond) { console.log(`  ✓ ${nom}`); return true; }
  echecs++; console.log(`  ✗ ${nom}${detail ? ' — ' + detail : ''}`); return false;
};

/* ---------- RNG à graine (remplace Math.random des jeux : mêmes manches à chaque lancement) ---------- */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
let R = mulberry32(SEED);
const pick = a => a[Math.floor(R() * a.length)];
const chance = p => R() < p;

const { classerManche } = await import(pathToFileURL(join(ROOT, 'games', 'fin-manche.js')).href);
const { creerMatch, CIBLES } = await import(pathToFileURL(join(ROOT, 'games', 'match.js')).href);
const lb = await import(pathToFileURL(join(ROOT, 'leaderboard.js')).href);

/* =====================================================================================================
   1. classerManche : cas d'école (pur, sans jeu)
   ===================================================================================================== */
{
  const mk = (t, alive, elim, extra) => Object.assign({ seat: mk.n++, team: t, playing: true, alive, elimTick: elim, place: 0 }, extra);
  mk.n = 0;
  const places = ps => ps.map(p => p.place).join(',');
  const cas = (nom, ps, winner, opts, attendu) => { classerManche(ps, winner, opts); ok('classerManche : ' + nom, places(ps) === attendu, 'obtenu ' + places(ps) + ', attendu ' + attendu); };

  mk.n = 0; cas('mêlée, ordre d\'élimination', [mk(0, false, 10), mk(1, true, -1), mk(2, false, 40), mk(3, false, 25)], 1, null, '4,1,2,3');
  mk.n = 0; cas('équipe gagnante entière en place 1 (même un mort)', [mk(0, true, -1), mk(1, false, 5), mk(0, false, 30), mk(1, false, 5)], 0, null, '1,3,1,3');
  mk.n = 0; cas('morts au même tick = même place', [mk(0, false, 7), mk(1, false, 7), mk(2, true, -1), mk(3, false, 2)], 2, null, '2,2,1,4');
  mk.n = 0; cas('nul : les survivants partagent la place 1', [mk(0, true, -1), mk(1, true, -1), mk(2, false, 9)], -1, null, '1,1,3');
  mk.n = 0; cas('nul par hécatombe : derniers morts du même tick', [mk(0, false, 50), mk(1, false, 50), mk(2, false, 20)], -1, null, '1,1,3');
  mk.n = 0; cas('nul : jamais une place 1 isolée (garde-fou)', [mk(0, true, -1), mk(1, false, 30), mk(2, false, 10)], -1, null, '1,1,3');
  mk.n = 0; cas('score ex æquo en tête, survies différentes = tous en place 1', [mk(0, true, -1, { s: 3 }), mk(1, false, 30, { s: 3 }), mk(2, false, 10, { s: 1 }), mk(1, false, 5, { s: 3 })], -1, { score: p => p.s }, '1,1,4,1');
  mk.n = 0; cas('solo', [mk(0, false, 4)], -1, null, '1');
  mk.n = 0; cas('score puis survie (course)', [mk(0, false, 10, { s: 5 }), mk(1, true, -1, { s: 5 }), mk(2, false, 40, { s: 9 })], 2, { score: p => p.s }, '3,2,1');
  mk.n = 0; cas('score : égalité en tête = nul partagé', [mk(0, true, -1, { s: 3 }), mk(1, true, -1, { s: 3 }), mk(2, true, -1, { s: 1 })], -1, { score: p => p.s }, '1,1,3');
  { mk.n = 0; const ps = [mk(0, true, -1), mk(1, true, -1, { playing: false, place: 7 })]; classerManche(ps, 0); ok('classerManche : un non-participant n\'est pas touché', ps[1].place === 7 && ps[0].place === 1); }
  { mk.n = 0; const ps = [mk(0, true, -1), mk(1, false, 3)]; const r = classerManche(ps, 5); ok('classerManche : équipe gagnante absente = nul, pas d\'exception', r.nul && ps[0].place === 1 && ps[1].place === 1); }
  { mk.n = 0; const ps = [mk(0, false, 3), mk(1, true, -1), mk(2, false, 8)]; const r = classerManche(ps, 1); ok('classerManche : podium trié par place', r.podium.map(p => p.seat).join(',') === '1,2,0' && !r.nul && r.participants === 3); }
  ok('classerManche : liste vide', classerManche([], 0).podium.length === 0);
}

/* =====================================================================================================
   1b. creerMatch (games/match.js) : match en N manches gagnantes, pur, sans jeu
   ===================================================================================================== */
{
  const mkp = (n, team) => Array.from({ length: n }, (_, i) => ({ seat: i, team: team ? team(i) : i, playing: true, score: 0 }));
  // une manche gagnée par `w` : comme les jeux, +1 à tous les membres de l'équipe, PUIS apresManche
  const manche = (mt, ps, w) => { mt.debutManche(ps); if (w >= 0) ps.forEach(p => { if (p.playing && p.team === w) p.score++; }); return mt.apresManche(ps, w); };
  const sc = ps => ps.map(p => p.score).join(',');

  ok('match : cibles disponibles 1, 2, 3, 5', CIBLES.join(',') === '1,2,3,5');
  { const mt = creerMatch(), ps = mkp(3);
    ok('match : cible 1 par défaut, etat() === null (pas undefined)', mt.cible === 1 && mt.etat(ps) === null);
    ok('match : cible 1 = jamais de match gagné, scores qui s\'accumulent', !manche(mt, ps, 0) && !manche(mt, ps, 0) && !manche(mt, ps, 0) && sc(ps) === '3,0,0' && !mt.gagne && mt.etat(ps) === null); }
  { const mt = creerMatch(), ps = mkp(3); ps[1].score = 4;
    const c = []; for (let i = 0; i < 5; i++) c.push(mt.changer(ps));
    ok('match : changer() cycle 2, 3, 5, 1, 2 et remet les scores à 0', c.join(',') === '2,3,5,1,2' && sc(ps) === '0,0,0'); }
  { // premier à 2 : le vainqueur du match est le premier à la cible, la balle de match est annoncée avant
    const mt = creerMatch(), ps = mkp(3); mt.changer(ps);
    let e = (manche(mt, ps, 0), mt.etat(ps));
    ok('match à 2 : après 1-0 → balle de match pour l\'équipe 0, match en cours', e.n === 2 && e.f === 0 && e.w === -1 && e.bm.join() === '0' && e.r === 1, JSON.stringify(e));
    const f1 = manche(mt, ps, 1); e = mt.etat(ps);
    ok('match à 2 : 1-1 → les deux équipes ont la balle de match, manche 2', !f1 && e.bm.join() === '0,1' && e.r === 2 && !mt.gagne, JSON.stringify(e));
    const f2 = manche(mt, ps, 1); e = mt.etat(ps);
    ok('match à 2 : 1-2 → l\'équipe 1 gagne le match (f=1, w=1, plus de balle de match)', f2 && mt.gagne && mt.gagnant === 1 && e.f === 1 && e.w === 1 && e.bm.length === 0 && sc(ps) === '1,2,0', JSON.stringify(e) + ' ' + sc(ps));
    ok('match : apresManche ne re-gagne pas un match déjà gagné', !mt.apresManche(ps, 1));
    const deb = mt.debutManche(ps); e = mt.etat(ps);
    ok('match à 2 : manche suivante = nouveau match, scores remis à 0, manche 1', deb && sc(ps) === '0,0,0' && !mt.gagne && mt.gagnant === -1 && e.f === 0 && e.w === -1 && e.r === 1 && e.bm.length === 0, JSON.stringify(e) + ' ' + sc(ps)); }
  { // premier à 3, avec nuls : une manche nulle n'avance rien et ne gagne jamais le match
    const mt = creerMatch(), ps = mkp(2); mt.changer(ps); mt.changer(ps);
    manche(mt, ps, 0); manche(mt, ps, -1); manche(mt, ps, 0);
    let e = mt.etat(ps);
    ok('match à 3 : nul sans effet, 2-0 → balle de match, manche 3', mt.cible === 3 && !mt.gagne && sc(ps) === '2,0' && e.bm.join() === '0' && e.r === 3, JSON.stringify(e));
    ok('match à 3 : la 3e manche gagnée termine le match', manche(mt, ps, 0) && mt.gagnant === 0 && sc(ps) === '3,0'); }
  { // équipes : tous les membres de l'équipe gagnante comptent, balle de match une seule fois par équipe
    const mt = creerMatch(), ps = mkp(4, i => i % 2); mt.changer(ps);
    manche(mt, ps, 1); const e = mt.etat(ps);
    ok('match en équipes : 2 membres à 1 → UNE balle de match (équipe 1)', e.bm.join() === '1' && sc(ps) === '0,1,0,1', JSON.stringify(e));
    ok('match en équipes : équipe 1 gagne le match', manche(mt, ps, 1) && mt.gagnant === 1 && sc(ps) === '0,2,0,2'); }
  { // un membre de l'équipe gagnante parti entre-temps : le score d'un autre membre suffit ; les non-participants sont ignorés
    const mt = creerMatch(), ps = mkp(4, i => i % 2); mt.regler(2, ps);
    ps[2].score = 1; ps[2].playing = false;             // un ancien joueur de l'équipe 0, plus en jeu : ne compte ni pour la balle de match ni pour la victoire
    ok('match : un non-participant n\'est pas compté pour la balle de match', mt.etat(ps).bm.length === 0);
    ps[0].score = 1; ps[0].playing = false; ps[2].playing = true;
    ps[2].score = 2; const w = mt.apresManche(ps, 0);
    ok('match : victoire par n\'importe quel membre de l\'équipe gagnante (score >= cible)', w && mt.gagnant === 0); }
  { // changer la cible en plein lobby / over : repart d'un match neuf, scores à 0 au prochain départ même sans joueurs passés à changer()
    const mt = creerMatch(), ps = mkp(2); mt.changer(ps); manche(mt, ps, 0);
    mt.changer();                                       // le jeu a oublié de passer les joueurs
    ok('match : changer() sans joueurs → scores remis à 0 au départ suivant', mt.debutManche(ps) && sc(ps) === '0,0' && mt.etat(ps).r === 1, sc(ps));
    mt.regler(5, ps); ok('match : regler(5) fixe la cible', mt.cible === 5);
    mt.regler(99, ps); ok('match : regler plafonne à 9', mt.cible === 9);
    mt.regler(-3, ps); ok('match : regler(<1) = manche simple, etat null', mt.cible === 1 && mt.etat(ps) === null);
    mt.regler(4, ps); ok('match : une cible hors liste (4) passe à la suivante de CIBLES (5)', mt.changer(ps) === 5);
    mt.regler(9, ps); ok('match : depuis 9 le cycle revient à 1', mt.changer(ps) === 1); }
  { // la première manche d'un match après un changement ne doit pas effacer les scores d'une manche déjà commencée
    const mt = creerMatch(), ps = mkp(2); mt.changer(ps); manche(mt, ps, 1);
    mt.debutManche(ps);
    ok('match : manche suivante d\'un match en cours = scores conservés', sc(ps) === '0,1' && mt.etat(ps).r === 2); }
  { const mt = creerMatch(), ps = mkp(2); mt.changer(ps); manche(mt, ps, 0); mt.reinit();
    ok('match : reinit() = cible 1, état vierge', mt.cible === 1 && !mt.gagne && mt.etat(ps) === null); }
  ok('match : apresManche tolère winner invalide / liste vide', !creerMatch().apresManche([], 3) && !(() => { const m = creerMatch(); m.regler(2); return m.apresManche(mkp(2), undefined); })());
}

/* =====================================================================================================
   2. Fausse salle calquée sur hub.js (membres, départ avec grâce, arrivée en cours de manche)
   ===================================================================================================== */
let seq = 1;
const mkMember = () => { const id = 'm' + (seq++); return { id, name: 'J' + id, role: null }; };
function mkCtx(G) {
  const members = [];
  const room = { get members() { return members; }, memberById: id => members.find(m => m.id === id), broadcast() {}, send() {} };
  const g = G.create(room);
  const ctx = { G, g, room, members, pending: [], sys: {} };
  g.onMessage(ctx.sys, { t: 'daily', on: false });          // défi du jour coupé : le hasard vient de Math.random (graine)
  return ctx;
}
function rejoindre(ctx, m) {
  if (!ctx.members.includes(m)) ctx.members.push(m);
  const r = ctx.g.onJoin(m) || { role: 'spectator' };
  m.role = r.role; return r;
}
// hub.js : en pleine partie le joueur sort de `members` tout de suite, onLeave part après la grâce de reconnexion
function leave(ctx, m, grace) {
  const i = ctx.members.indexOf(m); if (i >= 0) ctx.members.splice(i, 1);
  if (m.role === 'player' && !ctx.g.isIdle() && grace > 0) { ctx.pending.push({ m, at: grace }); return; }
  ctx.g.onLeave(m); m.role = null;
}
function reconnect(ctx, m) {
  const k = ctx.pending.findIndex(p => p.m === m); if (k < 0) return;
  ctx.pending.splice(k, 1); ctx.members.push(m); const r = ctx.g.onJoin(m) || { role: 'spectator' }; m.role = r.role;
}
function stepPending(ctx) {
  for (let k = ctx.pending.length - 1; k >= 0; k--) { const p = ctx.pending[k]; if (--p.at <= 0) { ctx.pending.splice(k, 1); ctx.g.onLeave(p.m); p.m.role = null; } }
}
function seatSpectators(ctx) {                                 // hub.asseoirSpectateurs, juste avant un départ
  if (!ctx.g.isIdle()) return;
  for (const m of ctx.members) if (m.role === 'spectator') { const r = ctx.g.onJoin(m); if (!r || r.role === 'spectator') break; m.role = r.role; }
}

/* ---------- entrées par jeu (celles que le vrai client envoie) et réglages de la salle ---------- */
const DIRS = ['up', 'down', 'left', 'right'];
const INPUT = {
  pong: () => [{ t: 'input', up: chance(0.4), dn: chance(0.4) }],
  tron: () => [chance(0.6) ? { t: 'dir', d: pick(DIRS) } : { t: 'boost', on: chance(0.4) }],
  tank: () => [{ t: 'input', left: chance(0.3), right: chance(0.3), fwd: chance(0.6), back: chance(0.1), fire: chance(0.5) }, ...(chance(0.03) ? [{ t: 'mine' }] : [])],
  bomb: () => [{ t: 'input', up: chance(0.3), down: chance(0.3), left: chance(0.3), right: chance(0.3) }, ...(chance(0.06) ? [{ t: 'bomb' }] : [])],
  snake: () => [{ t: 'dir', d: pick(DIRS) }],
  sumo: () => [{ t: 'input', up: chance(0.3), down: chance(0.3), left: chance(0.3), right: chance(0.3) }, ...(chance(0.05) ? [{ t: 'dash' }] : [])],
  foot: () => [{ t: 'input', up: chance(0.3), down: chance(0.3), left: chance(0.3), right: chance(0.3) }, ...(chance(0.05) ? [{ t: 'charge', on: chance(0.5) }] : []), ...(chance(0.03) ? [{ t: 'shoot' }] : [])],
  patate: () => [{ t: 'input', up: chance(0.3), down: chance(0.3), left: chance(0.3), right: chance(0.3) }, ...(chance(0.05) ? [{ t: 'sprint', on: chance(0.5) }] : [])],
};
// réglages qui changent l'issue d'une manche (variantes de fin) — un tirage par manche
const REGLAGES = {
  pong: () => [{ t: 'opt', op: pick(['lives', 'winmode', 'sudden', 'negatives', 'bumpers']), d: pick([1, -1]) }],
  tron: () => [{ t: 'fade' }],
  tank: () => [{ t: 'ff' }, { t: 'arena' }],
  bomb: () => [{ t: 'revenge' }, { t: 'gen' }, { t: 'ff' }],
  snake: () => [{ t: 'rush' }, { t: 'variant' }],
  sumo: () => [{ t: 'botdiff' }],
  foot: () => [{ t: 'lives' }, { t: 'terrain', v: pick(['stade', 'boue', 'glace', 'flipper', 'tempete']) }],
  patate: () => [{ t: 'botdiff' }, { t: 'fuse' }, { t: 'bonus' }],
};
// plafond de durée d'une manche, en secondes de JEU (pauses exclues). Pong : MAX_ROUND_TICKS ; Sumo : TIME_CAP ;
// Foot : TIME_CAP ; Patate : chaque patate explose au bout de 25 s (pire cas ≈ 190 s à 10 joueurs) ; Tron : arène qui se referme ; Bomberman : mort subite + SD_GRACE (grille 17 : ~160 s).
// Tanks et Snake n'ont AUCUN plafond documenté (deux serpents peuvent s'éviter indéfiniment, un solo aussi) : leur
// « plafond » n'est qu'un filet du test — la manche est abandonnée et comptée, sans échec (cf. SOUPLE).
const CAP = { pong: 605, tron: 200, tank: 900, bomb: 175, snake: 600, sumo: 185, foot: 365, patate: 205 };
const SOUPLE = new Set(['tank', 'snake']);
const PLAN = { pong: 9, tron: 12, tank: 9, bomb: 12, snake: 12, sumo: 12, foot: 9, patate: 9 };   // manches par configuration

/* ---------- invariants ---------- */
function mauvaisesValeurs(o, chemin, out, prof) {
  if (out.length > 5) return;
  if (o === undefined) { out.push(chemin + '=undefined'); return; }
  if (typeof o === 'number') { if (!Number.isFinite(o)) out.push(chemin + '=' + o); return; }
  if (typeof o === 'function' || typeof o === 'bigint' || typeof o === 'symbol') { out.push(chemin + ':' + typeof o); return; }
  if (o && typeof o === 'object') {
    if (prof > 12) { out.push(chemin + ': trop profond'); return; }
    if (Array.isArray(o)) for (let i = 0; i < o.length; i++) mauvaisesValeurs(o[i], chemin + '[' + i + ']', out, prof + 1);
    else for (const k of Object.keys(o)) mauvaisesValeurs(o[k], chemin + '.' + k, out, prof + 1);
  }
}
const SANS_VALEUR_OK = new Set(['geo', 'grid']);               // omis volontairement (delta) : le hub saute les clés undefined
function verifSnap(s) {
  const errs = [];
  if (!s || typeof s !== 'object') return ['instantané absent'];
  if (!['lobby', 'countdown', 'play', 'paused', 'over'].includes(s.gs)) errs.push('gs invalide : ' + s.gs);
  const bad = [];
  for (const k of Object.keys(s)) { if (s[k] === undefined) { if (!SANS_VALEUR_OK.has(k)) bad.push('.' + k + '=undefined'); continue; } mauvaisesValeurs(s[k], '.' + k, bad, 0); }
  if (bad.length) errs.push('valeurs invalides : ' + bad.slice(0, 4).join(', '));
  try { JSON.stringify(s); } catch (e) { errs.push('JSON.stringify : ' + e.message); }
  return errs;
}
// cohérence des places à la fin d'une manche
function verifFin(s) {
  const errs = [];
  const ps = (s.players || []).filter(p => p.playing);
  const w = s.winner;
  if (!(w === -1 || (Number.isInteger(w) && w >= 0))) errs.push('winner=' + JSON.stringify(w));
  if (!ps.length) return errs;
  const p1 = ps.filter(p => p.place === 1);
  if (w >= 0) {
    if (!ps.some(p => p.team === w)) errs.push('équipe gagnante ' + w + ' sans participant');
    else {
      const perdants = p1.filter(p => p.team !== w);
      if (perdants.length) errs.push('PLACE1_PERDANT : place 1 donnée à l\'équipe ' + [...new Set(perdants.map(p => p.team))] + ' alors que winner=' + w);
      const oublies = ps.filter(p => p.team === w && p.place !== 1);
      if (oublies.length) errs.push('EQUIPE_GAGNANTE_INCOMPLETE : sièges ' + oublies.map(p => p.seat) + ' de l\'équipe gagnante sans place 1');
    }
  } else if (ps.length > 1) {
    if (!p1.length) errs.push('NUL_SANS_PLACE1 : aucune place 1');
    else if (new Set(p1.map(p => p.team)).size < 2) errs.push('NUL_PLACE1_ISOLEE : winner=-1 mais place 1 seulement pour l\'équipe ' + p1[0].team);
  }
  for (const p of ps) if (!(Number.isInteger(p.place) && p.place >= 1 && p.place <= ps.length)) errs.push('place hors 1..' + ps.length + ' (siège ' + p.seat + ' = ' + p.place + ')');
  // places « à la compétition » : chaque place = 1 + nombre de joueurs strictement mieux classés
  for (const p of ps) { const mieux = ps.filter(q => q.place < p.place).length; if (p.place !== 1 + mieux) { errs.push('PLACES_NON_CONTIGUES : siège ' + p.seat + ' place ' + p.place + ' avec ' + mieux + ' mieux classés'); break; } }
  return errs;
}
const resume = s => s.players.filter(p => p.playing).map(p => 's' + p.seat + 't' + p.team + 'p' + p.place + (p.alive ? 'V' : 'm') + (p.bot ? 'b' : '')).join(' ');

/* =====================================================================================================
   3. Une manche complète
   ===================================================================================================== */
async function jouerJeu(id, rapport) {
  const mod = await import(pathToFileURL(join(ROOT, 'games', id, 'server.js')).href);
  const G = mod.default, meta = G.meta, hz = meta.tickHz;
  const note = (cle, detail) => { const e = rapport.problemes[cle] || (rapport.problemes[cle] = { n: 0, ex: [] }); e.n++; if (e.ex.length < 2) e.ex.push(detail); };
  const garde = (quoi, fn) => { try { return fn(); } catch (e) { note('EXCEPTION ' + quoi + ' : ' + String(e && e.message).slice(0, 80), String(e && e.stack).split('\n').slice(0, 3).join(' | ')); return undefined; } };
  const max = meta.max;
  const configs = [[meta.min, 1], [Math.max(2, Math.round(max / 2)), 2], [max, 3], [max, 1]];
  const vus = new Set();
  for (const [nTot, nHum] of configs) {
    const cle = nTot + '/' + nHum; if (vus.has(cle) || nHum > nTot) continue; vus.add(cle);
    const ctx = mkCtx(G);
    const hums = [];
    for (let i = 0; i < nHum; i++) { const m = mkMember(); hums.push(m); garde('onJoin', () => rejoindre(ctx, m)); }
    const hote = () => ctx.members.find(m => m.role === 'player') || ctx.members[0];
    const regler = msgs => { for (const m of msgs) garde('réglage ' + m.t, () => ctx.g.onMessage(hote(), m)); };
    const ajusterBots = cible => {
      let s = garde('tick', () => ctx.g.tick());
      for (let k = 0; k < 25 && s && s.botCount !== cible; k++) { garde('bots', () => ctx.g.onMessage(hote(), { t: 'bots' })); s = garde('tick', () => ctx.g.tick()); }
    };
    for (let r = 0; r < PLAN[id]; r++) {
      // variante de la manche : mode (équipes/mêlée) qui tourne + un réglage propre au jeu
      for (let k = Math.floor(R() * 3); k >= 0; k--) regler([{ t: 'mode' }]);
      if (chance(0.7)) regler([pick(REGLAGES[id]())]);
      ajusterBots(Math.max(0, nTot - ctx.members.filter(m => m.role === 'player').length));
      garde('asseoir', () => seatSpectators(ctx));
      const demarreur = hote(); if (!demarreur) break;
      const avant = {};                                        // classement enregistré avant la manche (pseudo -> {games, wins})
      for (const m of ctx.members) { const e = Object.prototype.hasOwnProperty.call(lb.board(id), m.name) ? lb.board(id)[m.name] : null; avant[m.name] = { games: e ? e.games : 0, wins: e ? e.wins : 0 }; }
      garde('start', () => ctx.g.onMessage(demarreur, { t: 'start' }));
      let s = garde('tick', () => ctx.g.tick());
      if (!s || s.gs !== 'countdown') continue;
      rapport.manches++;
      const style = new Map(); for (const m of ctx.members) style.set(m, pick(['idle', 'random', 'random']));
      const abandon = chance(0.06) ? Math.floor(R() * hz * 30) : -1;
      const depart = chance(0.4);                              // un départ en cours de manche (avec ou sans grâce)
      let jeu = 0, total = 0, enPause = 0, perime = 0, fini = false;
      const contexte = () => id + ' n=' + nTot + ' h=' + nHum + ' mode=' + s.mode + (s.rush ? ' rush' : '') + (s.revenge ? ' revanche' : '');
      while (total++ < hz * 60 * 30) {
        garde('grâce', () => stepPending(ctx));
        for (const m of ctx.members) {
          if ((style.get(m) || 'random') === 'idle' || !chance(0.2)) continue;
          for (const msg of INPUT[id]()) garde('entrée ' + msg.t, () => ctx.g.onMessage(m, msg));
        }
        if (chance(1 / (45 * hz)) && ctx.members.length < max + 2) { const m = mkMember(); style.set(m, pick(['idle', 'random'])); garde('arrivée', () => rejoindre(ctx, m)); }
        if (depart && chance(1 / (35 * hz)) && ctx.members.length > 1) garde('départ', () => leave(ctx, pick(ctx.members), chance(0.6) ? Math.floor(R() * 6 * hz) : 0));
        if (chance(1 / (5 * hz)) && ctx.pending.length) garde('reprise', () => reconnect(ctx, pick(ctx.pending).m));
        if (chance(1 / (50 * hz)) && ctx.members.length) garde('pause', () => ctx.g.onMessage(pick(ctx.members), { t: 'pause' }));
        if (abandon >= 0 && jeu === abandon && ctx.members.length) garde('abandon', () => ctx.g.onMessage(ctx.members[0], { t: 'abort' }));
        const s2 = garde('tick', () => ctx.g.tick());
        if (!s2) break;
        s = s2;
        for (const e of verifSnap(s)) note('INSTANTANE ' + e.replace(/\[\d+\]/g, '[i]').replace(/=-?\d+(\.\d+)?/g, '=N').slice(0, 90), contexte() + ' : ' + e);
        // Foot : la charge du tir (`ch`, 0..1) est diffusée pour TOUS les joueurs — les défenseurs la voient monter
        if (id === 'foot') { const mauvais = s.players.find(p => !(typeof p.ch === 'number' && p.ch >= 0 && p.ch <= 1)); if (mauvais) note('FOOT_CHARGE_ABSENTE : champ ch manquant ou hors 0..1', contexte() + ' siège ' + mauvais.seat + ' ch=' + mauvais.ch); if (s.players.some(p => p.ch > 0)) rapport.charges++; }
        if (s.gs === 'paused') { if (++enPause > hz * 2) { garde('reprise pause', () => ctx.g.onMessage(ctx.members.find(m => m.role === 'player') || ctx.members[0] || {}, { t: 'pause' })); enPause = 0; } }
        if (s.gs === 'play') {
          jeu++;
          const ps = s.players.filter(p => p.playing);
          const camps = new Set(ps.filter(p => p.alive || (s.revenge && p.rvn)).map(p => p.team));
          const vivants = new Set(ps.filter(p => p.alive).map(p => p.team));
          // « en jeu » avec un seul camp vivant (hors solo, hors revanche où les revenants comptent) pendant 3 s : la manche aurait dû finir
          if (ps.length >= 2 && vivants.size <= 1 && (!s.revenge || camps.size <= 1 || vivants.size === 0)) perime++; else perime = 0;
          if (perime === hz * 3) note('MANCHE_ZOMBIE : en jeu sans camp adverse vivant', contexte() + ' vivants=' + ps.filter(p => p.alive).map(p => 's' + p.seat + 't' + p.team).join(','));
          if (jeu === Math.round(CAP[id] * hz)) { if (SOUPLE.has(id)) rapport.sansPlafond++; else note('PLAFOND_DEPASSE : plus de ' + CAP[id] + ' s de jeu', contexte() + ' vivants=' + ps.filter(p => p.alive).length); }
          if (jeu > CAP[id] * hz + hz * 5) break;
        }
        if (s.gs === 'lobby') { rapport.abandons++; fini = true; break; }
        if (s.gs === 'over') {
          fini = true; rapport.finies++; if (s.winner === -1) rapport.nuls++;
          if (jeu / hz > rapport.maxDuree) rapport.maxDuree = jeu / hz;
          if (process.env.FINS_TRACE) console.log('    ' + contexte() + ' : ' + (jeu / hz).toFixed(0) + ' s, winner=' + s.winner + ' | ' + resume(s));
          for (const e of verifFin(s)) note('FIN ' + e.split(' :')[0], contexte() + ' winner=' + s.winner + ' | ' + e + ' | ' + resume(s));
          // le classement enregistré lit les mêmes places : victoire <=> place 1 avec un vainqueur
          for (const p of s.players) {
            if (!p.playing || p.bot || !p.name || !avant[p.name]) continue;
            const e = Object.prototype.hasOwnProperty.call(lb.board(id), p.name) ? lb.board(id)[p.name] : null;
            const dg = (e ? e.games : 0) - avant[p.name].games, dw = (e ? e.wins : 0) - avant[p.name].wins;
            if (dg === 1) {
              const attendu = s.winner >= 0 && p.place === 1 ? 1 : 0;
              if (dw !== attendu) note('CLASSEMENT_DIVERGENT : victoire enregistrée ≠ place 1', contexte() + ' ' + p.name + ' place=' + p.place + ' winner=' + s.winner + ' team=' + p.team + ' victoires+=' + dw);
            } else if (dg > 1 || dg < 0 || dw > 1 || dw < 0) note('CLASSEMENT_DOUBLE : manche enregistrée ' + dg + ' fois', contexte() + ' ' + p.name);
          }
          // écran de fin : un départ ne change ni le vainqueur ni les places
          const figees = s.players.map(p => p.playing ? p.place : -1), w0 = s.winner;
          if (ctx.members.length > 1) garde('départ écran de fin', () => leave(ctx, pick(ctx.members), 0));
          for (let k = 0; k < hz; k++) {
            garde('grâce', () => stepPending(ctx));
            const s3 = garde('tick', () => ctx.g.tick());
            if (!s3) break;
            for (const e of verifSnap(s3)) note('INSTANTANE(fin) ' + e.slice(0, 90), id + ' : ' + e);
            if (s3.gs === 'over' && (s3.winner !== w0 || s3.players.some((p, i) => p.playing && figees[i] !== p.place))) { note('PODIUM_INSTABLE : places ou vainqueur modifiés sur l\'écran de fin', contexte() + ' avant ' + figees.join(',') + ' après ' + s3.players.map(p => p.playing ? p.place : -1).join(',')); break; }
          }
          break;
        }
      }
      if (!fini && SOUPLE.has(id)) { garde('abandon', () => ctx.g.onMessage(hote() || {}, { t: 'abort' })); garde('tick', () => ctx.g.tick()); }
      else if (!fini) { rapport.sansFin++; note('SANS_FIN : la manche n\'a pas fini', contexte() + ' gs=' + s.gs + ' vivants=' + (s.players || []).filter(p => p.alive).length); garde('abandon', () => ctx.g.onMessage(hote() || {}, { t: 'abort' })); garde('tick', () => ctx.g.tick()); }
      for (let k = 0; k < hz; k++) { garde('grâce', () => stepPending(ctx)); const s3 = garde('tick', () => ctx.g.tick()); if (s3) for (const e of verifSnap(s3)) note('INSTANTANE(repos) ' + e.slice(0, 90), id + ' : ' + e); }
      if (!ctx.members.some(m => m.role === 'player')) { const m = mkMember(); garde('arrivée', () => rejoindre(ctx, m)); }
    }
  }
}

/* =====================================================================================================
   4. Les 8 jeux
   ===================================================================================================== */
console.log('Fins de manche — 8 jeux, bots, équipes, départs, pauses (graine ' + SEED + ')');
for (const id of IDS) {
  R = mulberry32(SEED + IDS.indexOf(id) * 7919); Math.random = mulberry32(SEED ^ (IDS.indexOf(id) * 104729 + 1));
  const rap = { manches: 0, finies: 0, abandons: 0, nuls: 0, sansFin: 0, sansPlafond: 0, charges: 0, maxDuree: 0, problemes: {} };
  const t = Date.now();
  try { await jouerJeu(id, rap); } catch (e) { rap.problemes['ECHEC DU TEST : ' + e.message] = { n: 1, ex: [String(e.stack).split('\n').slice(0, 3).join(' | ')] }; }
  if (id === 'foot' && !rap.charges) rap.problemes['FOOT_CHARGE_JAMAIS_VUE : aucun tir chargé observé (test aveugle)'] = { n: 1, ex: [] };
  const cles = Object.keys(rap.problemes);
  const titre = `${id} — ${rap.finies} fins de manche (${rap.nuls} nuls), ${rap.abandons} abandons, plus longue ${rap.maxDuree.toFixed(0)} s${rap.sansPlafond ? ', ' + rap.sansPlafond + ' sans plafond (abandonnées)' : ''}, ${((Date.now() - t) / 1000).toFixed(1)} s`;
  const bon = ok(titre, cles.length === 0 && rap.finies >= 6 && rap.sansFin === 0, cles.length ? cles.length + ' problème(s)' : (rap.finies < 6 ? 'trop peu de manches terminées (' + rap.finies + ')' : ''));
  if (!bon) for (const k of cles) { const v = rap.problemes[k]; console.log('      [' + v.n + '×] ' + k); for (const ex of v.ex) console.log('           ' + String(ex).slice(0, 380)); }
}

/* =====================================================================================================
   4b. Match en N manches branché dans les 8 jeux (games/match.js + message `match`)
   Une salle (1 humain + bots) joue des manches jusqu'à ce qu'un match soit gagné et on vérifie, à chaque manche :
   • le message `match` n'agit que dans le lobby / sur l'écran de fin (ignoré en pleine manche) ;
   • le vainqueur d'une manche gagne exactement +1 (jamais compté deux fois) ; une manche nulle n'avance rien ;
   • le match est gagné par la PREMIÈRE équipe à la cible, jamais sur une manche nulle ; stats.match le dit aussi ;
   • la balle de match (bm) = les équipes à cible-1, annoncée dès le décompte de la manche qui suit ;
   • au match suivant les scores repartent à 0 (manche 1) ; une cible 1 = champ `match` null (pas undefined).
   ===================================================================================================== */
async function jouerMatch(id, cible, opt) {
  opt = opt || {};
  const mod = await import(pathToFileURL(join(ROOT, 'games', id, 'server.js')).href);
  const G = mod.default, hz = G.meta.tickHz, champ = id === 'snake' ? 'wins' : 'score';
  const nTot = Math.min(G.meta.max, Math.max(G.meta.min, id === 'pong' || id === 'foot' ? 2 : 3));
  const ctx = mkCtx(G), h = mkMember(); rejoindre(ctx, h);
  const msg = m => ctx.g.onMessage(h, m), tk = () => ctx.g.tick();
  const pb = [];
  const echec = (e, st) => { if (pb.length < 4) pb.push(e + (st && st.players ? ' | ' + JSON.stringify(st.match) + ' scores=' + st.players.filter(p => p.playing).map(p => p.team + ':' + p[champ]).join(' ') : '')); };
  let s = tk();
  for (let k = 0; k < 25 && s.botCount !== nTot - 1; k++) { msg({ t: 'bots' }); s = tk(); }
  if (id === 'snake') { msg({ t: 'rush' }); s = tk(); }
  if (opt.mode) { msg({ t: 'mode' }); s = tk(); }
  if (s.match !== null) echec('cible 1 : match devrait être null (pas undefined)', s);
  for (let k = 0; k < 6 && !(s.match && s.match.n === cible); k++) { msg({ t: 'match' }); s = tk(); }
  if (!s.match || s.match.n !== cible) { echec('le message match n\'a pas amené la cible ' + cible, s); return pb; }
  if (id === 'pong' && !(s.opts.winMode === 'rounds' && s.opts.roundsTarget === cible)) echec('Pong : match et règles désynchronisés ' + JSON.stringify(s.opts), s);
  if (id === 'tank' && s.winTarget !== cible) echec('Tanks : winTarget alias ≠ cible ' + s.winTarget, s);
  let prec = null, matchsFinis = 0, nuls = 0, manches = 0, apresGagne = false;
  const scores = st => st.players.filter(p => p.playing).map(p => [p.seat, p.team, p[champ] | 0]);
  for (let r = 0; r < 40 && matchsFinis < (opt.matchs || 1); r++) {
    const hum = ctx.members.find(m => m.role === 'player') || h;
    ctx.g.onMessage(hum, { t: 'start' }); s = tk();
    if (s.gs !== 'countdown') { echec('la manche ne démarre pas (gs=' + s.gs + ')', s); break; }
    // au décompte : scores de départ, balle de match annoncée, nouveau match remis à 0
    const base = new Map(scores(s).map(x => [x[0], x[2]]));
    if (apresGagne) {
      if ([...base.values()].some(v => v !== 0)) echec('match suivant : les scores ne repartent pas à 0', s);
      if (!s.match || s.match.f !== 0 || s.match.r !== 1 || s.match.w !== -1) echec('match suivant : état non remis à zéro', s);
      apresGagne = false;
    } else if (prec) for (const x of prec) if (base.get(x[0]) !== x[2]) echec('score modifié entre deux manches (seat ' + x[0] + ')', s);
    const att = new Set(scores(s).filter(x => x[2] === cible - 1).map(x => x[1]));
    if (!s.match || s.match.bm.slice().sort().join() !== [...att].sort().join()) echec('balle de match au décompte : attendu ' + [...att].sort() + ', obtenu ' + (s.match && s.match.bm), s);
    msg({ t: 'match' }); const s1 = tk();                                  // en pleine manche : ignoré
    if (!s1.match || s1.match.n !== cible) echec('le message match a agi en pleine manche', s1);
    let total = 0, fini = false;
    while (total++ < hz * 400) {
      if (chance(0.2)) for (const m of INPUT[id]()) ctx.g.onMessage(h, m);
      s = tk();
      if (s.gs === 'over') { fini = true; break; }
    }
    if (!fini) { echec('manche trop longue : abandon', s); msg({ t: 'abort' }); s = tk(); prec = null; continue; }
    manches++;
    const w = s.winner; if (w === -1) nuls++;
    const fin = scores(s);
    for (const x of fin) { const att2 = (base.get(x[0]) | 0) + (x[1] === w ? 1 : 0); if (x[2] !== att2) echec('score ' + x[2] + ' ≠ ' + att2 + ' attendu (seat ' + x[0] + ', équipe ' + x[1] + ', vainqueur ' + w + ') : manche comptée 0 ou 2 fois', s); }
    const tops = new Map(); for (const x of fin) tops.set(x[1], Math.max(tops.get(x[1]) || 0, x[2]));
    const atteint = [...tops].filter(x => x[1] >= cible).map(x => x[0]);
    if (!s.match) { echec('match absent à la fin de manche', s); break; }
    if (s.match.f === 1) {
      matchsFinis++; apresGagne = true;
      if (!(atteint.length === 1 && atteint[0] === w && s.match.w === w)) echec('match gagné par ' + s.match.w + ' ≠ premier à la cible (' + atteint + ', manche ' + w + ')', s);
      if (!(s.stats && s.stats.match === true)) echec('stats.match absent à la fin du match', s);
      if (s.match.bm.length) echec('balle de match restante après la victoire', s);
    } else {
      if (atteint.length) echec('une équipe a atteint la cible mais le match n\'est pas gagné', s);
      if (s.stats && s.stats.match) echec('stats.match vrai alors que le match continue', s);
      const bm = [...tops].filter(x => x[1] === cible - 1).map(x => x[0]).sort();
      if (s.match.bm.slice().sort().join() !== bm.join() || s.match.w !== -1) echec('balle de match en fin de manche : attendu ' + bm + ', obtenu ' + s.match.bm, s);
    }
    if (w === -1 && s.match.f === 1) echec('une manche nulle a gagné le match', s);
    prec = s.match.f === 1 ? null : fin;
  }
  if (matchsFinis < (opt.matchs || 1)) echec('aucun match terminé en 40 manches (' + manches + ' jouées, ' + nuls + ' nulles)', s);
  if (process.env.FINS_TRACE) console.log('    match ' + id + ' à ' + cible + ' : ' + manches + ' manches (' + nuls + ' nulles), ' + matchsFinis + ' match(s) gagné(s)');
  // retour à la manche simple : match null (jamais undefined)
  for (let k = 0; k < 6 && s.match; k++) { msg({ t: 'match' }); s = tk(); }
  if (s.match !== null) echec('retour à la manche simple : match devrait être null', s);
  return pb;
}
console.log('\nMatch en N manches — branché dans les 8 jeux');
for (const [id, cible, opt] of [['tron', 2, { matchs: 2 }], ['tron', 3, { mode: 1 }], ['sumo', 2], ['sumo', 3], ['patate', 2], ['pong', 2], ['pong', 3], ['bomb', 2], ['bomb', 3, { matchs: 4 }], ['foot', 2], ['foot', 3, { matchs: 3 }], ['tank', 2], ['snake', 2], ['snake', 3]]) {
  R = mulberry32(SEED + 31 + IDS.indexOf(id) * 7919 + cible); Math.random = mulberry32(SEED ^ (IDS.indexOf(id) * 104729 + cible));
  const t = Date.now(); let pb;
  try { pb = await jouerMatch(id, cible, opt); } catch (e) { pb = ['EXCEPTION ' + String(e.stack).split('\n').slice(0, 3).join(' | ')]; }
  ok(`match ${id} : premier à ${cible}${opt && opt.mode ? ' (équipes)' : ''} — gagnant, balle de match, remise à 0 (${((Date.now() - t) / 1000).toFixed(1)} s)`, pb.length === 0, pb.join(' || '));
}
{ // Pong : « premier à K éliminations » = son propre objectif → match null ; le message match est ignoré ; Options et match restent synchrones
  const mod = await import(pathToFileURL(join(ROOT, 'games', 'pong', 'server.js')).href);
  const ctx = mkCtx(mod.default), h = mkMember(); rejoindre(ctx, h);
  const msg = m => ctx.g.onMessage(h, m);
  let s = ctx.g.tick();
  ok('pong : manche simple (survivor) → match null', s.opts.winMode === 'survivor' && s.match === null);
  msg({ t: 'opt', op: 'winmode' }); s = ctx.g.tick();
  ok('pong : Options → « manches » (rounds) donne match.n = roundsTarget', s.opts.winMode === 'rounds' && s.match && s.match.n === s.opts.roundsTarget, JSON.stringify(s.match));
  msg({ t: 'opt', op: 'rtar', d: 1 }); s = ctx.g.tick();
  ok('pong : Options roundsTarget +1 → match.n suit', s.match && s.match.n === s.opts.roundsTarget, JSON.stringify(s.match) + ' ' + s.opts.roundsTarget);
  msg({ t: 'match' }); s = ctx.g.tick();
  ok('pong : message match → roundsTarget et winMode pilotés (les deux interfaces synchrones)', s.opts.winMode === 'rounds' && s.match && s.match.n === s.opts.roundsTarget && s.opts.roundsTarget === 5, JSON.stringify(s.opts.roundsTarget));
  msg({ t: 'match' }); s = ctx.g.tick();
  ok('pong : cycle complet → retour à la manche simple (survivor, match null)', s.opts.winMode === 'survivor' && s.match === null, s.opts.winMode);
  msg({ t: 'opt', op: 'winmode' }); msg({ t: 'opt', op: 'winmode' }); s = ctx.g.tick();
  ok('pong : mode éliminations (kills) → match null', s.opts.winMode === 'kills' && s.match === null);
  msg({ t: 'match' }); s = ctx.g.tick();
  ok('pong : message match ignoré en mode éliminations', s.opts.winMode === 'kills' && s.match === null);
}
{ // Tanks : l'ancien message wintarget reste un alias (1 → 3 → 5 → 1) branché sur le même module
  const mod = await import(pathToFileURL(join(ROOT, 'games', 'tank', 'server.js')).href);
  const ctx = mkCtx(mod.default), h = mkMember(); rejoindre(ctx, h);
  const cy = []; for (let i = 0; i < 4; i++) { ctx.g.onMessage(h, { t: 'wintarget' }); const s = ctx.g.tick(); cy.push(s.winTarget + '/' + (s.match ? s.match.n : 'null')); }
  ok('tank : message wintarget = alias du match (1 → 3 → 5 → 1, winTarget = match.n)', cy.join(' ') === '3/3 5/5 1/null 3/3', cy.join(' '));
}

const dureeS = ((Date.now() - T0) / 1000).toFixed(1);
console.log(`\n${tests - echecs}/${tests} vérifications réussies en ${dureeS} s`);
if (echecs) { console.log(`✗ ${echecs} échec(s)`); process.exit(1); }
console.log('✓ toutes les fins de manche sont cohérentes');
process.exit(0);
