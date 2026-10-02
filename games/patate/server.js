// Jeu PATATE CHAUDE — nappe de pique-nique RONDE vue de dessus, 3 à 5 piliers (bocaux). 2 à 10 joueurs, FFA ou équipes.
// Une patate-bombe (mèche cachée de 12 à 25 s) passe de main en main PAR CONTACT ; au bout de la mèche elle explose et
// élimine son porteur. Le cercle rétrécit à chaque élimination. Dernier survivant (ou dernier camp) = vainqueur.
// Déplacement libre + sprint sur endurance (comme le Foot), physique continue à 30 Hz (comme le Sumo).
import { AR0, MARGE, PR, TICK_HZ, FUSE_MIN, FUSE_MAX, IMMUNE_S, ITEMS, scaleFor } from '../../public/games/patate/shared.js';
import { board, pushHistory, save, markDirty, reset, bumpDaily } from '../../leaderboard.js';
import { classerManche } from '../fin-manche.js';
import { creerMatch } from '../match.js';

const GID = 'patate';
const MAX_SEATS = 10;
const COUNTDOWN_TICKS = 3 * TICK_HZ;
// course : mêmes réglages que le Foot (un pion qui glisse un peu) ; le PORTEUR court 10 % plus vite (vitesse ET accélération,
// la vitesse d'équilibre ne dépend que de l'accélération)
const ACC = 0.9, VMAX = 5, FRICTION = 0.84, CARRY_SPD = 1.1, TURN = 0.42;
// SPRINT (Maj) : endurance 0..1 — vidée en 1,6 s, rechargée en 3 s après 0,4 s de repos ; à vide : essoufflé jusqu'à 30 %.
const SPRINT_SPD = 1.4, SPRINT_ACC = 1.2, STA_DRAIN = 1 / (1.6 * TICK_HZ), STA_REGEN = 1 / (3 * TICK_HZ), STA_DELAY = 12, STA_MIN = 0.3;
// patate : contact = 2 rayons + 3 u ; le receveur ne peut pas la repasser pendant 8 ticks (pas de ricochet en grappe) ;
// donneur immunisé IMMUNE_S (contre TOUTE patate : une grappe ne refait pas tourner la sienne en boucle) ; petit recul à la passe.
const CONTACT = 3, HOLD_LAG = 8, PASS_KICK = 2.5, EXTREMIS_TICKS = TICK_HZ;
// explosion : souffle sans dégât qui repousse les voisins ; nouvelle patate 2 s plus tard ; 2 patates tant qu'il reste ≥ 7 en lice
const BLAST_R = 150, BLAST_IMP = 11, RESPAWN_TICKS = 2 * TICK_HZ, FIRST_SPAWN = TICK_HZ / 2, DUO_FROM = 7;
// filet de sécurité (jamais atteint : chaque patate explose au bout de 25 s) — pire cas ≈ 195 s à 10 joueurs
const TIME_CAP = 330 * TICK_HZ;
// arène ronde : R0 = rayon utile initial ; il rétrécit en douceur vers 55 % au duel ; piliers en couronne
const R_DUEL = 0.55, SHRINK = 0.0012, PIL_RING = 0.38, PIL_R = 22, SPAWN_RING = 0.72;
// bonus au sol (si activés) : un toutes les ~8 s, 2 au plus ; bouclier et turbo durent 3 s
const BONUS_EVERY = 8 * TICK_HZ, MAX_PK = 2, PK_R = 14, FX_T = 3 * TICK_HZ, TURBO_SPD = 1.25;
// IA : Facile / Normale / Difficile — cadence de réflexion, accélération, hésitation, anticipation (lead : ticks de vitesse d'un porteur pour les fuyards ; icpt : part du temps d'interception visée par le chasseur),
// rayon de vigilance (un fuyard ignore les porteurs plus loin), portée du sprint, attrait des bonus, longueur du pas d'évaluation des caps
const PTDIFF = [
  { every: 8, acc: 0.85, hes: 0.08, lead: 0, icpt: 0, sight: 240, sprint: 110, pick: 0.3, look: 50 },
  { every: 4, acc: 1, hes: 0, lead: 4, icpt: 0.5, sight: 380, sprint: 170, pick: 0.6, look: 70 },
  { every: 2, acc: 1, hes: 0, lead: 8, icpt: 0.9, sight: 700, sprint: 230, pick: 1, look: 90 },
];
const TEAM_COUNT = { ffa: 0, '2v2': 2, '2v2v2': 3, '3v3': 2, '4v4': 2, '2v2v2v2': 4, '3v3v3': 3, '5v5': 2, '2v2v2v2v2': 5 };
const numTeamsFor = (m, N) => (m === 'ffa' ? N : TEAM_COUNT[m]);
// modes d'équipe proposés selon le nombre EXACT de participants (humains + bots) ; 5 équipes au maximum (comme le Sumo)
function validModes(N) {
  const v = ['ffa'];
  if (N === 4) v.push('2v2');
  if (N === 6) v.push('2v2v2', '3v3');
  if (N === 8) v.push('4v4', '2v2v2v2');
  if (N === 9) v.push('3v3v3');
  if (N === 10) v.push('5v5', '2v2v2v2v2');
  return v;
}
const r1 = v => Math.round(v * 10) / 10;
const r2 = v => Math.round(v * 100) / 100;
const finite = v => typeof v === 'number' && Number.isFinite(v);

export function createPatate(room) {
  let players, pots, spawns, pickups, pillars, gameState, tick, round, countdownUntil, winner, fx, pend, mode, nteams, nParts, deaths, endTick, botCount, botDiff;
  let ar, R0, R, fuseVis, bonusOn, shrinkFx, nPass, nBoom;
  let seatByMid = {};

  function lbEntry(name) {
    const b = board(GID);
    return (Object.hasOwn(b, name) && b[name]) || (b[name] = { name, games: 0, wins: 0, kills: 0, passes: 0, deaths: 0, survSum: 0, bestSurvivalSec: 0 });
  }
  function recordRound() {
    for (const p of players) {
      if (!p.playing || !p.name || p.bot) continue;   // les bots n'entrent pas au classement
      const e = lbEntry(p.name);
      e.games++;
      if (winner >= 0 && p.place === 1) e.wins++;
      bumpDaily(p.name, { win: winner >= 0 && p.place === 1, kills: p.booms, game: GID });   // classement du jour (tous jeux)
      e.kills += p.booms; e.passes += p.passes;      // kills = explosions créditées (la patate qu'on a passée a fini chez l'autre)
      const surv = (p.elimTick >= 0 ? p.elimTick : endTick) / TICK_HZ;
      e.survSum += surv;
      if (surv > e.bestSurvivalSec) e.bestSurvivalSec = surv;
      if (p.elimTick >= 0) e.deaths++;
    }
    const champ = winner >= 0 ? players.find(p => p.playing && p.team === winner) : null;
    pushHistory(GID, { when: Date.now(), mode, preset: 'patate',
      winner: champ ? (nteams < nParts ? 'Équipe ' + 'ABCDE'[winner] : (champ.name || ('P' + (champ.seat + 1)))) : 'Égalité',
      durationSec: Math.round(endTick / TICK_HZ), nParts });
    save(); markDirty(GID);
  }

  function makePlayers() {
    return Array.from({ length: MAX_SEATS }, (_, seat) => ({
      seat, member: null, mid: null, name: '', team: 0, alive: false, playing: false, bot: false,
      x: 0, y: 0, vx: 0, vy: 0, a: 0, mx: 0, my: 0, ana: null,
      inp: { up: false, down: false, left: false, right: false },
      sprintHeld: false, sprinting: false, sta: 1, staRest: 0, winded: false,
      hp: false, immUntil: 0, holdUntil: 0, shUntil: 0, tbUntil: 0,
      botNext: 0, botIdle: 0,
      passes: 0, booms: 0, place: 0, elimTick: -1, score: 0,
    }));
  }
  // Arène À L'ÉCHELLE du nombre de participants : la taille d'un joueur ne change pas, c'est la nappe qui grandit.
  function setArena(n) {
    const k = scaleFor(Math.max(2, Math.min(MAX_SEATS, n)));
    ar = Math.round(AR0 * k); R0 = ar / 2 - MARGE; R = R0;
    const np = n >= 7 ? 5 : n >= 4 ? 4 : 3, c = ar / 2;
    pillars = [];
    for (let i = 0; i < np; i++) { const a = -Math.PI / 2 + i * 2 * Math.PI / np; pillars.push({ x: c + R0 * PIL_RING * Math.cos(a), y: c + R0 * PIL_RING * Math.sin(a), r: PIL_R }); }
  }
  const match = creerMatch();                         // match en N manches (games/match.js) : cible 1 = manche simple, comportement historique
  function fullReset() {
    match.reinit();
    players = makePlayers(); pots = []; spawns = []; pickups = [];
    gameState = 'lobby'; tick = 0; round = 0; winner = null; fx = []; pend = [];
    mode = 'ffa'; nteams = 0; nParts = 0; deaths = 0; endTick = 0; botCount = 0; botDiff = 1; seatByMid = {};
    fuseVis = false; bonusOn = true; shrinkFx = false; nPass = 0; nBoom = 0; setArena(2);
  }

  const connectedCount = () => players.filter(p => p.member).length;
  const maxBots = () => MAX_SEATS - connectedCount();
  const partCount = () => Math.min(connectedCount() + botCount, MAX_SEATS);
  const canStart = () => connectedCount() >= 1 && partCount() >= 2;
  const editable = () => gameState === 'lobby' || gameState === 'over';
  const seatOf = member => { for (const p of players) if (p.member === member) return p.seat; return -1; };
  const aliveTeams = () => new Set(players.filter(p => p.alive).map(p => p.team));
  const foe = (p, q) => p.team !== q.team;          // en FFA chaque joueur a sa propre « équipe » (team = rang) : ce test suffit aux deux modes
  const cxy = () => ar / 2;
  const aliveCount = () => { let n = 0; for (const p of players) if (p.alive) n++; return n; };
  // rayon visé : 100 % tant que tout le monde est en lice, 55 % au duel (interpolation linéaire sur le nombre de survivants)
  const targetR = () => { const n = Math.max(2, nParts), a = Math.max(2, Math.min(n, aliveCount())); return R0 * (R_DUEL + (1 - R_DUEL) * (a - 2) / Math.max(1, n - 2)); };

  function spawnPlayers(parts) {
    pickups = []; pots = []; spawns = [];
    const c = cxy(), N = parts.length;
    parts.forEach((p, i) => {
      const ang = -Math.PI / 2 + i * 2 * Math.PI / N + Math.PI / N;     // décalés des piliers (qui partent du haut) : personne n'apparaît collé à l'un d'eux
      p.x = c + R0 * SPAWN_RING * Math.cos(ang); p.y = c + R0 * SPAWN_RING * Math.sin(ang);
      p.vx = 0; p.vy = 0; p.a = ang + Math.PI;             // face au centre
      p.mx = 0; p.my = 0; p.ana = null; p.inp = { up: false, down: false, left: false, right: false };
      p.sprintHeld = false; p.sprinting = false; p.sta = 1; p.staRest = 0; p.winded = false;
      p.hp = false; p.immUntil = 0; p.holdUntil = 0; p.shUntil = 0; p.tbUntil = 0; p.botNext = 0; p.botIdle = 0;
      p.alive = true; p.passes = 0; p.booms = 0; p.place = 0; p.elimTick = -1;
    });
  }

  function startGame() {
    if (!editable() || !canStart()) return;
    for (const p of players) { p.playing = false; p.bot = false; p.alive = false; p.hp = false; }
    if (botCount > maxBots()) botCount = maxBots();
    const parts = players.filter(p => p.member);
    let bots = botCount;
    for (const p of players) { if (bots <= 0) break; if (!p.member) { p.bot = true; parts.push(p); bots--; } } // complète avec des bots
    parts.forEach((p, i) => { if (p.bot) p.name = '🤖 Bot ' + (i + 1); });
    if (parts.length < 2) return;
    match.debutManche(players);                        // match gagné (ou cible changée) : scores remis à 0 avant cette manche
    const N = parts.length;
    if (!validModes(N).includes(mode)) mode = 'ffa';
    nteams = numTeamsFor(mode, N);
    parts.forEach((p, i) => { p.playing = true; p.team = i % nteams; });
    nParts = N; deaths = 0; endTick = 0; winner = null; shrinkFx = false; nPass = 0; nBoom = 0;
    setArena(N);                                       // nappe dimensionnée AVANT le placement
    spawnPlayers(parts);
    round++; tick = 0; countdownUntil = COUNTDOWN_TICKS; gameState = 'countdown';
  }
  function clearPots() { pots = []; spawns = []; for (const p of players) p.hp = false; }
  function backToLobby() {            // abandon : retour au lobby en pleine partie
    if (gameState !== 'play' && gameState !== 'countdown' && gameState !== 'paused') return;
    gameState = 'lobby'; winner = null; fx = []; pend = []; pickups = []; clearPots();
    for (const p of players) { p.playing = false; p.alive = false; p.vx = 0; p.vy = 0; p.sprintHeld = false; p.sprinting = false; }
    setArena(partCount());
  }
  function endRound() {
    gameState = 'over'; endTick = tick; clearPots(); pickups = [];
    const s = aliveTeams();
    winner = s.size === 1 ? [...s][0] : -1;
    if (winner >= 0) players.forEach(p => { if (p.playing && p.team === winner) p.score++; }); match.apresManche(players, winner);
    classerManche(players, winner);                    // places : une seule vérité, commune aux jeux (games/fin-manche.js)
    recordRound();
  }

  function eliminate(p) {
    p.alive = false; p.elimTick = tick; p.place = nParts - deaths; deaths++; p.hp = false; p.sprinting = false;
    if (R > targetR() + 1) shrinkFx = true;            // le cercle repart (un seul événement par tick, même à plusieurs éliminations)
  }
  function lvOf(o) {                                   // chaleur 0..3, GROSSIÈRE : part de la mèche déjà consumée (jamais le temps exact)
    const e = 1 - o.fuse / o.total;
    return e < 0.5 ? 0 : e < 0.75 ? 1 : e < 0.9 ? 2 : 3;
  }

  /* ---------- patates ---------- */
  function spawnPotato() {
    let cands = players.filter(p => p.alive && !p.hp);
    const libres = cands.filter(p => p.shUntil <= tick);   // pas sur un bouclier (il ne peut pas la recevoir), sauf s'il n'y a personne d'autre
    if (libres.length) cands = libres;
    if (!cands.length) return;
    const h = cands[Math.floor(Math.random() * cands.length)];
    const total = Math.round((FUSE_MIN + Math.random() * (FUSE_MAX - FUSE_MIN)) * TICK_HZ);
    pots.push({ o: h.seat, fuse: total, total, from: -1 });
    h.hp = true; h.holdUntil = tick + HOLD_LAG;
    fx.push({ type: 'spawn', seat: h.seat });
  }
  function managePots() {
    const want = aliveCount() >= DUO_FROM ? 2 : 1;
    while (spawns.length && pots.length + spawns.length > want) spawns.pop();
    for (let n = want - pots.length - spawns.length; n > 0; n--) spawns.push(tick + RESPAWN_TICKS);
    for (let i = spawns.length - 1; i >= 0; i--) if (spawns[i] <= tick) { spawns.splice(i, 1); spawnPotato(); }
  }
  function tryPass(o) {
    const h = players[o.o];
    if (!h || !h.alive || tick < h.holdUntil) return;
    let best = null, bd = Infinity;
    for (const q of players) {
      // un porteur n'en reçoit pas une 2e ; un coéquipier ne reçoit rien (équipes) ; donneur récent et bouclier : intouchables
      if (!q.alive || q === h || q.hp || !foe(h, q) || q.shUntil > tick || q.immUntil > tick) continue;
      const d = Math.hypot(q.x - h.x, q.y - h.y);
      if (d <= 2 * PR + CONTACT && d < bd) { bd = d; best = q; }
    }
    if (!best) return;
    const q = best, dx = q.x - h.x, dy = q.y - h.y, nx = bd > 1e-6 ? dx / bd : 1, ny = bd > 1e-6 ? dy / bd : 0;
    o.o = q.seat; o.from = h.seat; h.hp = false; q.hp = true;
    h.immUntil = tick + Math.round(IMMUNE_S * TICK_HZ); q.holdUntil = tick + HOLD_LAG;
    h.passes++; nPass++;
    h.vx -= nx * PASS_KICK; h.vy -= ny * PASS_KICK; q.vx += nx * PASS_KICK * 0.6; q.vy += ny * PASS_KICK * 0.6;
    fx.push({ type: 'pass', from: h.seat, to: q.seat, x: r1(h.x + dx / 2), y: r1(h.y + dy / 2), ex: o.fuse <= EXTREMIS_TICKS ? 1 : 0 });
  }
  function explode(o) {
    const h = players[o.o];
    pots.splice(pots.indexOf(o), 1);
    // crédit = le dernier à la lui avoir passée (toujours un ADVERSAIRE : en équipes la patate ne passe qu'aux adversaires)
    const by = (o.from >= 0 && o.from !== h.seat && players[o.from] && foe(h, players[o.from])) ? o.from : -1;
    eliminate(h);
    if (by >= 0) players[by].booms++;
    nBoom++;
    fx.push({ type: 'boom', seat: h.seat, x: r1(h.x), y: r1(h.y), by });
    for (const q of players) {                         // souffle : repousse les voisins, sans dégât
      if (!q.alive) continue;
      const dx = q.x - h.x, dy = q.y - h.y, d = Math.hypot(dx, dy);
      if (d >= BLAST_R) continue;
      const nx = d > 1e-6 ? dx / d : 1, ny = d > 1e-6 ? dy / d : 0, imp = BLAST_IMP * (1 - 0.6 * d / BLAST_R);
      q.vx += nx * imp; q.vy += ny * imp;
    }
  }

  /* ---------- mouvement ---------- */
  function humanDir(p) {
    let x, y;
    if (p.ana) { x = p.ana.x; y = p.ana.y; }
    else { const i = p.inp; x = (i.right ? 1 : 0) - (i.left ? 1 : 0); y = (i.down ? 1 : 0) - (i.up ? 1 : 0); const l = Math.hypot(x, y); if (l > 0) { x /= l; y /= l; } }   // diagonales normalisées
    p.mx = x; p.my = y;
  }
  function turnToward(p, ta, rate) { let d = ta - p.a; d = Math.atan2(Math.sin(d), Math.cos(d)); p.a += Math.max(-rate, Math.min(rate, d)); }
  function move(p) {
    const D = PTDIFF[botDiff] || PTDIFF[1], moving = !!(p.mx || p.my), turbo = p.tbUntil > tick;
    // sprint : Maj tenue, en mouvement, endurance disponible (ou turbo)
    p.sprinting = p.sprintHeld && moving && (turbo || (!p.winded && p.sta > 0));
    if (p.sprinting && !turbo) { p.sta = Math.max(0, p.sta - STA_DRAIN); p.staRest = 0; if (p.sta <= 0) p.winded = true; }
    else if (!p.sprinting) { if (++p.staRest > STA_DELAY) p.sta = Math.min(1, p.sta + STA_REGEN); if (p.winded && p.sta >= STA_MIN) p.winded = false; }
    const sk = (turbo ? TURBO_SPD : 1) * (p.hp ? CARRY_SPD : 1) * (p.bot ? D.acc : 1);   // turbo, porteur, bot Facile : jouent sur l'accélération ET le plafond
    const acc = ACC * sk * (p.sprinting ? SPRINT_ACC : 1), vmax = VMAX * sk * (p.sprinting ? SPRINT_SPD : 1);
    const sp0 = Math.hypot(p.vx, p.vy);
    if (moving) { p.vx += p.mx * acc; p.vy += p.my * acc; turnToward(p, Math.atan2(p.my, p.mx), TURN); }
    p.vx *= FRICTION; p.vy *= FRICTION;
    const sp = Math.hypot(p.vx, p.vy), cap = Math.max(vmax, sp0 * FRICTION);   // un souffle peut dépasser la vitesse de course, pas la tenir
    if (sp > cap) { p.vx *= cap / sp; p.vy *= cap / sp; }
    p.x += p.vx; p.y += p.vy;
  }
  function collide(p, q) {                             // contact mou, masses égales : séparation + on annule l'approche
    const dx = q.x - p.x, dy = q.y - p.y, d = Math.hypot(dx, dy), rr = 2 * PR;
    if (d >= rr) return;
    const nx = d > 1e-6 ? dx / d : 1, ny = d > 1e-6 ? dy / d : 0, ov = (rr - d) / 2;
    p.x -= nx * ov; p.y -= ny * ov; q.x += nx * ov; q.y += ny * ov;
    const vn = (q.vx - p.vx) * nx + (q.vy - p.vy) * ny;
    if (vn < 0) { const j = -vn * 0.65; p.vx -= nx * j; p.vy -= ny * j; q.vx += nx * j; q.vy += ny * j; }
  }
  function confine(p) {                                // piliers puis bord de nappe (le rayon rétrécit : on est repoussé en douceur)
    for (const pl of pillars) {
      const dx = p.x - pl.x, dy = p.y - pl.y, d = Math.hypot(dx, dy), rr = pl.r + PR;
      if (d >= rr) continue;
      const nx = d > 1e-6 ? dx / d : 1, ny = d > 1e-6 ? dy / d : 0;
      p.x = pl.x + nx * rr; p.y = pl.y + ny * rr;
      const vn = p.vx * nx + p.vy * ny; if (vn < 0) { p.vx -= vn * nx; p.vy -= vn * ny; }
    }
    const c = cxy(), dx = p.x - c, dy = p.y - c, d = Math.hypot(dx, dy), lim = R - PR;
    if (d > lim) {
      const nx = dx / d, ny = dy / d;
      p.x = c + nx * lim; p.y = c + ny * lim;
      const vn = p.vx * nx + p.vy * ny; if (vn > 0) { p.vx -= vn * nx; p.vy -= vn * ny; }
    }
  }
  function collect(p) {
    for (let i = pickups.length - 1; i >= 0; i--) {
      const pk = pickups[i];
      if (Math.hypot(pk.x - p.x, pk.y - p.y) > PR + PK_R) continue;
      pickups.splice(i, 1);
      if (pk.k === 0) p.shUntil = tick + FX_T;                         // bouclier : ne peut pas recevoir la patate
      else { p.tbUntil = tick + FX_T; p.sta = 1; p.winded = false; }   // turbo : +25 % de vitesse, sprint illimité
      fx.push({ type: 'pick', seat: p.seat, k: pk.k });
    }
  }
  function spawnPickup() {
    if (pickups.length >= MAX_PK) return;
    const c = cxy();
    for (let tries = 0; tries < 20; tries++) {
      const ang = Math.random() * 2 * Math.PI, rr = Math.sqrt(Math.random()) * (R - 40);   // sqrt : répartition uniforme sur le disque
      const x = c + rr * Math.cos(ang), y = c + rr * Math.sin(ang);
      if (pillars.some(pl => Math.hypot(pl.x - x, pl.y - y) < pl.r + PK_R + PR + 6)) continue;
      if (players.some(p => p.alive && Math.hypot(p.x - x, p.y - y) < PR + PK_R + 40)) continue;   // pas sous les pieds de quelqu'un
      if (pickups.some(pk => Math.hypot(pk.x - x, pk.y - y) < PK_R * 5)) continue;
      pickups.push({ x, y, k: Math.floor(Math.random() * ITEMS.length) });
      return;
    }
  }
  function updateRadius() {
    const t = targetR();
    if (R > t) R = Math.max(t, R - R0 * SHRINK);
    if (shrinkFx) { shrinkFx = false; fx.push({ type: 'shrink' }); }
    const c = cxy();
    pickups = pickups.filter(pk => Math.hypot(pk.x - c, pk.y - c) < R - PK_R);   // bonus avalés par le bord
  }

  /* ---------- IA ---------- */
  // Évalue 16 caps (+ un cap préféré) à `L` unités devant : score = scoreAt(point) − pénalités d'obstacles ; choisit le meilleur.
  function steer(p, L, scoreAt, wall, pref) {
    const c = cxy(); let best = -Infinity, bx = 0, by = 0;
    const lim = R - PR - 6;
    for (let i = 0; i < 17; i++) {
      let dx, dy;
      if (i < 16) { const th = i * Math.PI / 8; dx = Math.cos(th); dy = Math.sin(th); }
      else if (pref) { dx = pref[0]; dy = pref[1]; } else break;
      const x = p.x + dx * L, y = p.y + dy * L;
      let s = scoreAt(x, y) + 5 * (dx * p.mx + dy * p.my);
      const dc = Math.hypot(x - c, y - c);
      if (dc > lim) s -= 200 + 6 * (dc - lim);
      else if (wall > 0 && dc > lim - wall) s -= (dc - (lim - wall)) * 1.2;       // fuite : on s'écarte du bord (on s'y coince)
      for (const pl of pillars) {
        const dd = Math.hypot(x - pl.x, y - pl.y) - (pl.r + PR + 4);
        if (dd < 0) s -= 200 - 6 * dd; else if (dd < 30) s -= (30 - dd) * 0.8;
      }
      if (s > best) { best = s; bx = dx; by = dy; }
    }
    p.mx = bx; p.my = by;
  }
  function botThink(p) {
    const D = PTDIFF[botDiff] || PTDIFF[1];
    if (tick < p.botNext) return;
    p.botNext = tick + D.every;
    if (p.botIdle > tick) { p.mx = 0; p.my = 0; p.sprintHeld = false; return; }
    if (D.hes && !p.hp && Math.random() < D.hes) { p.botIdle = tick + 6 + Math.floor(Math.random() * 10); p.mx = 0; p.my = 0; p.sprintHeld = false; return; }   // Facile : hésite (en fuite seulement : un porteur qui hésite ne menacerait personne)
    const shield = p.shUntil > tick;
    let spr = false;
    if (p.hp) {
      // PORTEUR : chasse l'adversaire le plus proche qui peut recevoir ; à défaut (tous protégés) l'adversaire le plus proche
      let tgt = null, bd = Infinity, any = null, ad = Infinity;
      for (const q of players) {
        if (!q.alive || q === p || !foe(p, q)) continue;
        const d = Math.hypot(q.x - p.x, q.y - p.y);
        if (d < ad) { ad = d; any = q; }
        if (q.hp || q.shUntil > tick || q.immUntil > tick) continue;
        if (d < bd) { bd = d; tgt = q; }
      }
      if (!tgt) { tgt = any; bd = ad; }
      if (tgt) {
        const lead = Math.min(25, D.icpt * bd / 5.5), ax = tgt.x + tgt.vx * lead, ay = tgt.y + tgt.vy * lead;
        const gd = Math.hypot(ax - p.x, ay - p.y) || 1;
        steer(p, Math.min(D.look, gd), (x, y) => -Math.hypot(x - ax, y - ay), 0, [(ax - p.x) / gd, (ay - p.y) / gd]);
        spr = bd < D.sprint;
      } else { p.mx = 0; p.my = 0; }
    } else {
      // les autres : fuient les porteurs ADVERSAIRES (coéquipier porteur = aucun danger), ramassent les bonus proches
      const thr = [];
      if (!shield) for (const h of players) if (h.alive && h.hp && foe(p, h) && Math.hypot(h.x - p.x, h.y - p.y) < D.sight) thr.push({ x: h.x + h.vx * D.lead * 0.5, y: h.y + h.vy * D.lead * 0.5 });
      let nd = Infinity; for (const t of thr) { const d = Math.hypot(t.x - p.x, t.y - p.y); if (d < nd) nd = d; }
      let pk = null, pd = Infinity;
      if (Math.random() < D.pick) for (const k of pickups) { const d = Math.hypot(k.x - p.x, k.y - p.y); if (d < pd) { pd = d; pk = k; } }
      if (thr.length) {
        const pkOk = pk && pd < 230 && nd > 120;
        steer(p, D.look, (x, y) => {
          let m = 400; for (const t of thr) { const d = Math.hypot(x - t.x, y - t.y); if (d < m) m = d; }
          return pkOk ? m - 0.35 * Math.hypot(x - pk.x, y - pk.y) : m;
        }, 70);
        spr = nd < D.sprint * 0.8;
      } else if (pk && pd < 320) {
        const gd = pd || 1; steer(p, Math.min(D.look, gd), (x, y) => -Math.hypot(x - pk.x, y - pk.y), 0, [(pk.x - p.x) / gd, (pk.y - p.y) / gd]);
        spr = pd > 150;
      } else { p.mx = 0; p.my = 0; }
    }
    p.sprintHeld = spr && (p.sta > 0.3 || p.sprinting);
  }

  function update() {
    fx = pend; pend = [];                            // événements émis entre deux ticks : diffusés maintenant
    if (gameState === 'countdown') {
      tick++;
      if (tick >= countdownUntil) { gameState = 'play'; tick = 0; spawns = [Math.round(FIRST_SPAWN)]; if (aliveCount() >= DUO_FROM) spawns.push(Math.round(FIRST_SPAWN) + TICK_HZ); }
      return;
    }
    if (gameState !== 'play') return;
    tick++;
    const alive = players.filter(p => p.alive);
    for (const p of alive) { if (p.bot) botThink(p); else humanDir(p); }
    for (const p of alive) move(p);
    for (let i = 0; i < alive.length; i++) for (let j = i + 1; j < alive.length; j++) collide(alive[i], alive[j]);
    for (const p of alive) confine(p);
    updateRadius();
    for (const p of alive) collect(p);
    for (const o of pots.slice()) tryPass(o);
    for (const o of pots.slice()) { if (--o.fuse <= 0) explode(o); }
    if (aliveTeams().size <= 1 || tick >= TIME_CAP) { endRound(); return; }
    managePots();
    if (bonusOn && tick % BONUS_EVERY === 0) spawnPickup();
  }

  function snapshot() {
    return {
      gs: gameState, count: gameState === 'countdown' ? Math.max(0, Math.ceil((countdownUntil - tick) / TICK_HZ)) : 0,
      round, winner, fx, connected: connectedCount(), botCount, bots: botCount, maxBots: maxBots(), botDiff, nteams,
      mode: gameState === 'lobby' && !validModes(Math.max(2, partCount())).includes(mode) ? 'ffa' : mode,
      ar, R: r1(R), R0: r1(R0), pil: pillars.map(pl => [r1(pl.x), r1(pl.y), pl.r]),
      pt: pots.map(o => { const e = { o: o.o, lv: lvOf(o) }; if (fuseVis) e.f = r1(o.fuse / TICK_HZ); return e; }),   // f : UNIQUEMENT en mèche visible
      pk: pickups.map(k => [r1(k.x), r1(k.y), k.k]),
      opt: { fuse: fuseVis ? 'visible' : 'cache', bonus: bonusOn ? 1 : 0 },
      match: match.etat(players),
      stats: gameState === 'over' ? { durationSec: Math.round(endTick / TICK_HZ), nParts, passes: nPass, booms: nBoom, match: match.gagne } : null,
      players: players.map(p => ({
        seat: p.seat, name: p.name, team: p.team, connected: !!p.member, playing: p.playing, alive: p.alive, bot: !!p.bot,
        x: r1(p.x), y: r1(p.y), a: r2(p.a), sta: Math.round(p.sta * 20) / 20, spr: p.sprinting, ess: p.winded,
        imm: p.immUntil > tick, sh: p.shUntil > tick, tb: p.tbUntil > tick, hp: p.hp,
        passes: p.passes, booms: p.booms, score: p.score, place: p.place, elimTick: p.elimTick,
      })),
    };
  }

  /* ---- contrat plateforme ---- */
  // Siège d'un bot pris par un humain entre deux manches : on efface ce que le BOT y avait gagné (ligne de l'écran de
  // fin, victoire, points de match), sinon l'arrivant apparaissait vainqueur d'une manche qu'il n'a pas jouée.
  function repriseSiegeBot(p) {
    p.playing = false; p.alive = false; p.place = 0; p.passes = 0; p.booms = 0; p.hp = false;
    if ('score' in p) p.score = 0; if ('matchKills' in p) p.matchKills = 0;
  }
  function onJoin(member) {
    const cur = seatOf(member); if (cur >= 0) return { role: 'player', seat: cur, hello: { t: 'welcome', seat: cur } }; // déjà assis (reconnexion within grace)
    let seat = -1;
    const rid = seatByMid[member.id];
    if (rid != null && players[rid] && !players[rid].member && !players[rid].bot) seat = rid;
    if (seat < 0) { const free = players.find(p => !p.member && !p.bot && (editable() || !p.playing)) || (editable() ? players.find(p => !p.member) : null); if (free) seat = free.seat; }   // siège de bot protégé ; siège « en jeu » (parti en pleine manche) protégé tant que la manche tourne
    if (seat < 0) return { role: 'spectator', hello: { t: 'welcome', seat: -1 } };
    const p = players[seat];
    if (p.bot) repriseSiegeBot(p);   /* hors partie, un siège de bot se libère (startGame redistribue les bots) : remis à neuf */
    p.member = member; p.bot = false; p.mid = member.id; p.name = member.name || '';
    seatByMid[member.id] = seat;
    if (gameState === 'lobby') setArena(partCount());  // aperçu du lobby à la bonne échelle
    return { role: 'player', seat, hello: { t: 'welcome', seat } };
  }
  // Départ en pleine manche : le joueur sort SANS explosion ; la patate qu'il portait passe à un survivant au hasard (sans crédit).
  function quitter(p) {
    const o = pots.find(x => x.o === p.seat);
    eliminate(p);
    if (!o) return;
    const cands = players.filter(q => q.alive && !q.hp);
    if (!cands.length) { pots.splice(pots.indexOf(o), 1); return; }
    const q = cands[Math.floor(Math.random() * cands.length)];
    o.o = q.seat; o.from = -1; q.hp = true; q.holdUntil = tick + HOLD_LAG;
    pend.push({ type: 'spawn', seat: q.seat });         // hors tick : diffusé au prochain (update() remplace fx par pend)
  }
  function onLeave(member) {
    const seat = seatOf(member); if (seat < 0) return;
    const p = players[seat]; p.member = null; p.inp = { up: false, down: false, left: false, right: false }; p.ana = null; p.mx = 0; p.my = 0; p.sprintHeld = false;
    if (gameState === 'play' || gameState === 'countdown' || gameState === 'paused') {
      if (p.alive) quitter(p);
      if (connectedCount() === 0) fullReset(); else if (gameState === 'play' && aliveTeams().size <= 1) endRound();
    } else if (connectedCount() === 0) fullReset();
    else if (gameState === 'lobby') setArena(partCount());
  }
  function onRename(member) { const s = seatOf(member); if (s >= 0) players[s].name = member.name || ''; }
  function onMessage(member, m) {
    if (!m || typeof m !== 'object') return;
    const seat = seatOf(member);
    const p = seat >= 0 ? players[seat] : null;
    if (m.t === 'input' && p) {                      // état TENU des 4 directions (comme le Foot) ; {mx,my} analogique accepté en plus (borné à 1)
      if (finite(m.mx) && finite(m.my)) { let x = Math.max(-1, Math.min(1, m.mx)), y = Math.max(-1, Math.min(1, m.my)); const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; } p.ana = { x, y }; }
      else { p.ana = null; p.inp = { up: !!m.up, down: !!m.down, left: !!m.left, right: !!m.right }; }
    }
    else if (m.t === 'sprint' && p) p.sprintHeld = !!m.on;   // Maj tenue / relâchée
    else if (m.t === 'start') startGame();
    else if (m.t === 'pause') { if (gameState === 'play') gameState = 'paused'; else if (gameState === 'paused') gameState = 'play'; }
    else if (m.t === 'abort') backToLobby();
    else if (m.t === 'mode') { if (editable()) { const v = validModes(partCount()); mode = v[(v.indexOf(mode) + 1) % v.length] || 'ffa'; } }
    else if (m.t === 'bots') { if (editable()) { const mx = maxBots(); botCount = mx <= 0 ? 0 : (botCount + 1) % (mx + 1); if (gameState === 'lobby') setArena(partCount()); } }
    else if (m.t === 'botdiff') { if (editable()) botDiff = (botDiff + 1) % 3; }
    else if (m.t === 'fuse') { if (editable()) fuseVis = !fuseVis; }     // mèche cachée (défaut) ↔ visible
    else if (m.t === 'bonus') { if (editable()) bonusOn = !bonusOn; }
    else if (m.t === 'match') { if (editable()) match.changer(players); }   // cycle manche simple → premier à 2 / 3 / 5 (GM_ONLY dans hub.js)
    else if (m.t === 'lbreset') reset(GID);
  }
  function tick_() { for (const p of players) if (p.member) p.name = p.member.name || p.name || ''; update(); return snapshot(); }

  fullReset();
  return { onJoin, onLeave, onRename, onMessage, tick: tick_, isIdle: editable };
}

export default { meta: { id: GID, name: 'Patate chaude', min: 2, max: 10, tickHz: TICK_HZ, desc: 'Une patate-bombe passe par contact : refilez-la avant qu\'elle explose — cercle qui rétrécit, bonus, sprint' }, create: createPatate };
