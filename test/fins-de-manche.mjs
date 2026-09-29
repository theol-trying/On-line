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
const IDS = ['pong', 'tron', 'tank', 'bomb', 'snake', 'sumo', 'foot'];
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
};
// plafond de durée d'une manche, en secondes de JEU (pauses exclues). Pong : MAX_ROUND_TICKS ; Sumo : TIME_CAP ;
// Foot : TIME_CAP ; Tron : arène qui se referme ; Bomberman : mort subite + SD_GRACE (grille 17 : ~160 s).
// Tanks et Snake n'ont AUCUN plafond documenté (deux serpents peuvent s'éviter indéfiniment, un solo aussi) : leur
// « plafond » n'est qu'un filet du test — la manche est abandonnée et comptée, sans échec (cf. SOUPLE).
const CAP = { pong: 605, tron: 200, tank: 900, bomb: 175, snake: 600, sumo: 185, foot: 365 };
const SOUPLE = new Set(['tank', 'snake']);
const PLAN = { pong: 9, tron: 12, tank: 9, bomb: 12, snake: 12, sumo: 12, foot: 9 };   // manches par configuration

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
   4. Les 7 jeux
   ===================================================================================================== */
console.log('Fins de manche — 7 jeux, bots, équipes, départs, pauses (graine ' + SEED + ')');
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

const dureeS = ((Date.now() - T0) / 1000).toFixed(1);
console.log(`\n${tests - echecs}/${tests} vérifications réussies en ${dureeS} s`);
if (echecs) { console.log(`✗ ${echecs} échec(s)`); process.exit(1); }
console.log('✓ toutes les fins de manche sont cohérentes');
process.exit(0);
