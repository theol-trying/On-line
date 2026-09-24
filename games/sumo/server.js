// Jeu SUMO — dohyō vu de dessus. 2 à 10 lutteurs. FFA ou équipes. Pousser les autres hors du cercle :
// charge, ancrage, bonus au sol, cercle qui rétrécit (mort subite). Physique continue à 30 Hz (comme Tanks).
import { AR0, RING0, PR } from '../../public/games/sumo/shared.js';
import { board, pushHistory, save, markDirty, reset, bumpDaily } from '../../leaderboard.js';

const GID = 'sumo';
const MAX_SEATS = 10;
const TICK_HZ = 30;
const COUNTDOWN_TICKS = 3 * TICK_HZ;
// mouvement : accélération tenue, frottement fort (on « glisse » peu : le sumo est une affaire d'appuis)
const ACC = 0.95, VMAX = 6.5, FRICTION = 0.86, GRIP_FRICTION = 0.78;
// charge : grosse impulsion brève, recharge longue → c'est un engagement, pas un spam
const DASH_IMP = 11, DASH_TICKS = 9, DASH_CD = 66, DASH_HIT_MUL = 1.7;
// ancrage : très lourd mais presque immobile → contre direct d'une charge, inutile en mouvement
const BRACE_TICKS = 30, BRACE_CD = 90, BRACE_MASS = 3, BRACE_ACC = 0.3;
// collisions : restitution élevée + poussée minimale, sinon deux lutteurs collés « fondent » l'un dans l'autre sans jamais se repousser
const RESTITUTION = 0.9, MIN_PUSH = 2.2, CREDIT_TICKS = 90;
// bonus au sol
const PU_TYPES = ['heavy', 'dash', 'shock', 'grip'];
const PU_EVERY = 5 * TICK_HZ, MAX_PU = 2, PU_R = 14, PU_ZONE = 0.7;
// Bonus / malus — version A validée par l'utilisateur le 24/09 (avec ses ajustements). Chaque ramassage aide
// celui qui prend l'objet ET pénalise tous ses ADVERSAIRES (coéquipiers épargnés).
// Onigiri : croissance PAR PALIERS, sans minuterie, remise à zéro à chaque manche. Plus on mange, plus on pèse et
// plus on pousse fort — mais moins vite et moins souvent : un gros lutteur se sort mal, mais s'esquive.
const LVL_MAX = 5, LVL_MASS = 0.25, LVL_POW = 0.25, LVL_R = 0.08, LVL_SPD = 0.06, LVL_CD = 0.15, ONIGIRI_P = 0.4;
// Élan : charge rechargée 2× plus vite pendant 15 s (et rechargée tout de suite) ; adversaires ESSOUFFLÉS : ×1,2, 8 s.
const BOOST_TICKS = 15 * TICK_HZ, BOOST_CD_MUL = 0.5, TIRED_TICKS = 8 * TICK_HZ, TIRED_CD_MUL = 1.2;
// Onde de choc : plus large et plus forte ; les adversaires touchés sont SONNÉS 1,2 s (plus aucune action).
const SHOCK_R = 180, SHOCK_IMP = 13, STUN_TICKS = Math.round(1.2 * TICK_HZ);
// Pieds collés : recul −60 % pendant 12 s ; adversaires sur SOL GLISSANT 8 s : ils glissent 1,5× plus loin
// (la distance de glisse vaut 1 / (1 − frottement) : 1 / 0,14 × 1,5 → frottement 0,907).
const GRIP_TICKS = 12 * TICK_HZ, GRIP_HIT_MUL = 0.4, SLIP_TICKS = 8 * TICK_HZ, SLIP_FRICTION = 1 - (1 - FRICTION) / 1.5;
// mort subite : le cordon de paille se resserre lentement après 25 s, franchement après 90 s, jusqu'à 45 % du rayon (cf. ringFloor).
// Vitesses exprimées en fraction du rayon initial par seconde → même durée de manche quelle que soit la taille d'arène.
const SD_START = 25 * TICK_HZ, SD_FAST = 90 * TICK_HZ, RING_MIN = 0.45;
const SD_SLOW_RATE = 0.004 / TICK_HZ, SD_FAST_RATE = 0.012 / TICK_HZ;   // 90 s : ≈ 74 % · ≈ 114 s : plancher de 45 %
// filet de sécurité : deux humains immobiles au centre d'un cercle au plancher ne se départageraient jamais → égalité à 3 min
const TIME_CAP = 180 * TICK_HZ;
const BOT_EXPO_W = 0.5;                   // IA : préférence pour la cible la plus exposée au bord (voir botThink)
const HIT_FX_GAP = 6;                     // un contact prolongé ne doit pas inonder le client d'événements « hit » (un par paire / 6 ticks)
// IA : Facile / Normale / Difficile — cadence de réflexion, accélération, hésitations, envie de charger, ancrage (et sa probabilité
// par réflexion : un ancrage infaillible rendait les duels Difficile interminables), attrait des bonus
const SMDIFF = [
  { every: 6, acc: 0.75, hes: 0.10, dashP: 0.35, brace: false, braceP: 0, pick: 0 },
  { every: 3, acc: 1, hes: 0, dashP: 0.7, brace: true, braceP: 0.5, pick: 0.4 },
  { every: 2, acc: 1, hes: 0, dashP: 1, brace: true, braceP: 0.8, pick: 1 },
];
const TEAM_COUNT = { ffa: 0, '2v2': 2, '2v2v2': 3, '3v3': 2, '4v4': 2, '2v2v2v2': 4, '3v3v3': 3, '5v5': 2, '2v2v2v2v2': 5 };
const numTeamsFor = (m, N) => (m === 'ffa' ? N : TEAM_COUNT[m]);
// modes d'équipe proposés selon le nombre EXACT de participants (humains + bots) ; 5 équipes au maximum
function validModes(N) {
  const v = ['ffa'];
  if (N === 4) v.push('2v2');
  if (N === 6) v.push('2v2v2', '3v3');
  if (N === 8) v.push('4v4', '2v2v2v2');
  if (N === 9) v.push('3v3v3');
  if (N === 10) v.push('5v5', '2v2v2v2v2');
  return v;
}
// Arène À L'ÉCHELLE du nombre de participants : la taille d'un lutteur ne change pas, c'est le dohyō qui grandit
// (+10 % par lutteur au-delà de 2) → la densité reste jouable à 10 sans que le duel à 2 paraisse vide.
const scaleFor = n => 1 + 0.1 * (Math.max(2, Math.min(MAX_SEATS, n)) - 2);
const r1 = v => Math.round(v * 10) / 10;
const r2 = v => Math.round(v * 100) / 100;

export function createSumo(room) {
  let players, pickups, gameState, tick, round, countdownUntil, winner, fx, pend, mode, nteams, nParts, deaths, endTick, botCount, botDiff;
  let ar, ring0, ring, sdPhase, atFloor, hitGap;
  let seatByMid = {};

  function lbEntry(name) {
    const b = board(GID);
    return b[name] || (b[name] = { name, games: 0, wins: 0, kills: 0, dmg: 0, deaths: 0, survSum: 0, bestSurvivalSec: 0 });
  }
  function recordRound() {
    for (const p of players) {
      if (!p.playing || !p.name || p.bot) continue;   // les bots n'entrent pas au classement
      const e = lbEntry(p.name);
      e.games++;
      if (winner >= 0 && p.team === winner) e.wins++;
      bumpDaily(p.name, { win: winner >= 0 && p.team === winner, kills: p.kills, game: GID });   // classement du jour (tous jeux)
      e.kills += p.kills; e.dmg += p.dmg;            // dmg = chocs francs portés à un adversaire (l'équivalent sumo des dégâts)
      const surv = (p.elimTick >= 0 ? p.elimTick : endTick) / TICK_HZ;
      e.survSum += surv;
      if (surv > e.bestSurvivalSec) e.bestSurvivalSec = surv;
      if (p.elimTick >= 0) e.deaths++;
    }
    const champ = winner >= 0 ? players.find(p => p.playing && p.team === winner) : null;
    pushHistory(GID, { when: Date.now(), mode, preset: 'sumo',
      winner: champ ? (nteams < nParts ? 'Équipe ' + 'ABCDE'[winner] : (champ.name || ('P' + (champ.seat + 1)))) : 'Égalité',
      durationSec: Math.round(endTick / TICK_HZ), nParts });
    save(); markDirty(GID);
  }

  function makePlayers() {
    return Array.from({ length: MAX_SEATS }, (_, seat) => ({
      seat, member: null, mid: null, name: '', team: 0, alive: false, playing: false, bot: false,
      x: 0, y: 0, vx: 0, vy: 0, a: 0, mx: 0, my: 0,
      inp: { up: false, down: false, left: false, right: false }, wantDash: false, wantBrace: false,
      dashUntil: 0, dashReadyAt: 0, braceUntil: 0, braceReadyAt: 0, lvl: 0, gripUntil: 0, boostUntil: 0,
      tiredUntil: 0, stunUntil: 0, slipUntil: 0, dashCdLen: DASH_CD,
      lastBy: -1, lastTick: -9999, botNext: 0, botIdle: 0,
      kills: 0, dmg: 0, place: 0, elimTick: -1, outBy: -1, score: 0,
    }));
  }
  function setArena(n) { const k = scaleFor(n); ar = Math.round(AR0 * k); ring0 = RING0 * k; ring = ring0; }
  function fullReset() {
    players = makePlayers(); pickups = [];
    gameState = 'lobby'; tick = 0; round = 0; winner = null; fx = []; pend = [];
    mode = 'ffa'; nteams = 0; nParts = 0; deaths = 0; endTick = 0; botCount = 0; botDiff = 1; seatByMid = {};
    sdPhase = 0; atFloor = false; hitGap = new Map(); setArena(2);
  }

  const connectedCount = () => players.filter(p => p.member).length;
  const maxBots = () => MAX_SEATS - connectedCount();
  const partCount = () => Math.min(connectedCount() + botCount, MAX_SEATS);
  const canStart = () => connectedCount() >= 1 && partCount() >= 2;
  const editable = () => gameState === 'lobby' || gameState === 'over';
  const seatOf = member => { for (const p of players) if (p.member === member) return p.seat; return -1; };
  const aliveTeams = () => new Set(players.filter(p => p.alive).map(p => p.team));
  const foe = (p, q) => p.team !== q.team;          // en FFA chaque lutteur a sa propre « équipe » (team = rang), donc ce test suffit aux deux modes
  const heavy = p => p.lvl > 0;
  const stunned = p => p.stunUntil > tick;
  const slippy = p => p.slipUntil > tick;
  const lourdeur = p => 1 - LVL_SPD * p.lvl;         // vitesse et accélération : un gros lutteur tourne comme un camion
  const bracing = p => p.braceUntil > tick;
  const dashing = p => p.dashUntil > tick;
  const grip = p => p.gripUntil > tick;
  const radius = p => PR * (1 + LVL_R * p.lvl);
  const mass = p => (1 + LVL_MASS * p.lvl) * (bracing(p) ? BRACE_MASS : 1);
  const cxy = () => ar / 2;
  // plancher du cercle : 45 % du rayon INITIAL calculé pour le nombre de lutteurs ENCORE EN LICE. À 10 au départ, 45 % de 432 laisse
  // 194 u à deux survivants : un duel de bots n'y finit jamais (mesuré). Le cordon se resserre donc à chaque sortie, jusqu'à 108 u en duel.
  const ringFloor = () => RING0 * scaleFor(players.filter(p => p.alive).length) * RING_MIN;

  function spawnPlayers(parts) {
    pickups = []; hitGap = new Map();
    const c = cxy(), R = ring0 * 0.55, N = parts.length;
    parts.forEach((p, i) => {
      const ang = -Math.PI / 2 + i * 2 * Math.PI / N;     // premier lutteur en haut, puis tour du cercle
      p.x = c + R * Math.cos(ang); p.y = c + R * Math.sin(ang);
      p.vx = 0; p.vy = 0; p.a = ang + Math.PI;             // face au centre
      p.mx = 0; p.my = 0; p.inp = { up: false, down: false, left: false, right: false }; p.wantDash = false; p.wantBrace = false;
      p.dashUntil = 0; p.dashReadyAt = 0; p.braceUntil = 0; p.braceReadyAt = 0; p.lvl = 0; p.gripUntil = 0; p.boostUntil = 0;
      p.tiredUntil = 0; p.stunUntil = 0; p.slipUntil = 0; p.dashCdLen = DASH_CD;   // paliers d'onigiri remis à zéro à chaque manche
      p.lastBy = -1; p.lastTick = -9999; p.botNext = 0; p.botIdle = 0;
      p.alive = true; p.kills = 0; p.dmg = 0; p.place = 0; p.elimTick = -1; p.outBy = -1;
    });
  }

  function startGame() {
    if (!editable() || !canStart()) return;
    for (const p of players) { p.playing = false; p.bot = false; p.alive = false; }
    if (botCount > maxBots()) botCount = maxBots();
    const parts = players.filter(p => p.member);
    let bots = botCount;
    for (const p of players) { if (bots <= 0) break; if (!p.member) { p.bot = true; parts.push(p); bots--; } } // complète avec des bots
    parts.forEach((p, i) => { if (p.bot) p.name = '🤖 Bot ' + (i + 1); });
    if (parts.length < 2) return;
    const N = parts.length;
    if (!validModes(N).includes(mode)) mode = 'ffa';
    nteams = numTeamsFor(mode, N);
    parts.forEach((p, i) => { p.playing = true; p.team = i % nteams; });
    nParts = N; deaths = 0; endTick = 0; winner = null; sdPhase = 0; atFloor = false;
    setArena(N);                                       // dohyō dimensionné AVANT le placement
    spawnPlayers(parts);
    round++; tick = 0; countdownUntil = COUNTDOWN_TICKS; gameState = 'countdown';
    pend.push({ type: 'salt' });                       // jet de sel rituel : diffusé au prochain tick (update() vide fx à chaque tour)
  }
  function backToLobby() {            // abandon : retour au lobby en pleine partie
    if (gameState !== 'play' && gameState !== 'countdown' && gameState !== 'paused') return;
    gameState = 'lobby'; winner = null; fx = []; pend = []; pickups = []; sdPhase = 0;
    for (const p of players) { p.playing = false; p.alive = false; p.vx = 0; p.vy = 0; p.wantDash = false; p.wantBrace = false; }
    setArena(partCount());
  }
  function endRound() {
    gameState = 'over'; endTick = tick;
    const s = aliveTeams();
    winner = s.size === 1 ? [...s][0] : -1;
    if (winner >= 0) players.forEach(p => { if (p.playing && p.team === winner) p.score++; });
    players.forEach(p => { if (p.playing && p.alive) p.place = 1; });
    recordRound();
  }

  function eliminate(p) {
    // crédit de la sortie : dernier adversaire à l'avoir touché dans les 3 dernières secondes (pas un coéquipier, pas soi-même)
    const by = (p.lastBy >= 0 && p.lastBy !== p.seat && tick - p.lastTick <= CREDIT_TICKS && players[p.lastBy] && foe(p, players[p.lastBy])) ? p.lastBy : -1;
    p.alive = false; p.elimTick = tick; p.place = nParts - deaths; deaths++; p.outBy = by;
    if (by >= 0) players[by].kills++;
    fx.push({ type: 'out', seat: p.seat, by, x: r1(p.x), y: r1(p.y) });
  }
  function touch(p, q) { p.lastBy = q.seat; p.lastTick = tick; }

  function tryDash(p) {
    p.wantDash = false;
    if (stunned(p) || tick < p.dashReadyAt) return;
    let dx = p.mx, dy = p.my;
    if (!dx && !dy) { dx = Math.cos(p.a); dy = Math.sin(p.a); }   // aucune direction tenue : on charge droit devant
    const imp = DASH_IMP;
    p.vx += dx * imp; p.vy += dy * imp; p.a = Math.atan2(dy, dx);
    // recharge : +15 % par palier d'onigiri, ×0,5 sous Élan, ×1,2 essoufflé
    const len = Math.round(DASH_CD * (1 + LVL_CD * p.lvl) * (p.boostUntil > tick ? BOOST_CD_MUL : 1) * (p.tiredUntil > tick ? TIRED_CD_MUL : 1));
    p.dashUntil = tick + DASH_TICKS; p.dashReadyAt = tick + len; p.dashCdLen = len;
    fx.push({ type: 'dash', seat: p.seat, x: r1(p.x), y: r1(p.y) });
  }
  function tryBrace(p) {
    p.wantBrace = false;
    if (stunned(p) || tick < p.braceReadyAt) return;
    p.braceUntil = tick + BRACE_TICKS; p.braceReadyAt = tick + BRACE_CD;
    fx.push({ type: 'brace', seat: p.seat, x: r1(p.x), y: r1(p.y) });
  }
  function humanDir(p) {
    const i = p.inp; let x = (i.right ? 1 : 0) - (i.left ? 1 : 0), y = (i.down ? 1 : 0) - (i.up ? 1 : 0);
    const l = Math.hypot(x, y); if (l > 0) { x /= l; y /= l; }   // diagonales normalisées : pas de bonus de vitesse en biais
    p.mx = x; p.my = y;
  }
  function move(p) {
    const D = SMDIFF[botDiff] || SMDIFF[1];
    let acc = ACC * lourdeur(p) * (bracing(p) ? BRACE_ACC : 1) * (p.bot ? D.acc : 1);
    const sp0 = Math.hypot(p.vx, p.vy);
    if (!stunned(p) && (p.mx || p.my)) { p.vx += p.mx * acc; p.vy += p.my * acc; p.a = Math.atan2(p.my, p.mx); }
    const fr = grip(p) ? GRIP_FRICTION : slippy(p) ? SLIP_FRICTION : FRICTION;
    p.vx *= fr; p.vy *= fr;
    // plafond de vitesse sur la seule PROPULSION : une charge ou un choc peut dépasser VMAX, mais tenir la touche ne l'y maintient pas
    const sp = Math.hypot(p.vx, p.vy), cap = Math.max(VMAX * lourdeur(p), sp0 * fr);
    if (sp > cap) { p.vx *= cap / sp; p.vy *= cap / sp; }
    p.x += p.vx; p.y += p.vy;
  }
  function collide(p, q) {
    const dx = q.x - p.x, dy = q.y - p.y, d = Math.hypot(dx, dy), rr = radius(p) + radius(q);
    if (d >= rr) return;
    const nx = d > 1e-6 ? dx / d : 1, ny = d > 1e-6 ? dy / d : 0;
    const mp = mass(p), mq = mass(q), ip = 1 / mp, iq = 1 / mq, is = ip + iq;
    // séparation au prorata inverse des masses : le lourd bouge peu, le léger est chassé
    const ov = rr - d;
    p.x -= nx * ov * ip / is; p.y -= ny * ov * ip / is;
    q.x += nx * ov * iq / is; q.y += ny * ov * iq / is;
    // multiplicateurs de choc SUBI : charge adverse × 1.7, pieds collés × 0.5
    const kp = (dashing(q) ? DASH_HIT_MUL * (1 + LVL_POW * q.lvl) : 1) * (grip(p) ? GRIP_HIT_MUL : 1);   // la charge d'un lourd frappe plus fort
    const kq = (dashing(p) ? DASH_HIT_MUL * (1 + LVL_POW * p.lvl) : 1) * (grip(q) ? GRIP_HIT_MUL : 1);
    const vn = (q.vx - p.vx) * nx + (q.vy - p.vy) * ny;      // < 0 : ils se rapprochent
    let force = 0;
    if (vn < 0) {
      const j = -(1 + RESTITUTION) * vn / is;
      p.vx -= nx * j * ip * kp; p.vy -= ny * j * ip * kp;
      q.vx += nx * j * iq * kq; q.vy += ny * j * iq * kq;
      force = -vn;
    }
    // poussée minimale : même un contact lent sépare franchement, sinon celui qui avance « colle » à l'autre sans le déplacer
    const after = (q.vx - p.vx) * nx + (q.vy - p.vy) * ny;
    if (after < MIN_PUSH) {
      const def = MIN_PUSH - after;
      p.vx -= nx * def * (ip / is) * kp; p.vy -= ny * def * (ip / is) * kp;
      q.vx += nx * def * (iq / is) * kq; q.vy += ny * def * (iq / is) * kq;
    }
    touch(p, q); touch(q, p);
    if (force > 1.5) {
      const f = Math.min(1, force / 14);
      if (f >= 0.35) {                                   // choc franc : compté comme « dégât » pour l'initiateur (le plus rapide vers l'autre)
        const vp = p.vx * nx + p.vy * ny, vq = -(q.vx * nx + q.vy * ny);
        const src = (dashing(p) || vp > vq) ? p : q, dst = src === p ? q : p;
        if (foe(src, dst)) src.dmg++;
      }
      const k = p.seat * 16 + q.seat, last = hitGap.get(k);
      if (last === undefined || tick - last >= HIT_FX_GAP) {
        hitGap.set(k, tick);
        fx.push({ type: 'hit', x: r1(p.x + nx * radius(p)), y: r1(p.y + ny * radius(p)), f: r2(f), a: p.seat, b: q.seat });
      }
    }
  }
  // Malus infligé aux ADVERSAIRES de celui qui ramasse (coéquipiers épargnés) — un fx par victime, pour son message.
  function malus(p, kind, ticks) {
    for (const q of players) {
      if (q === p || !q.alive || !foe(p, q)) continue;
      if (kind === 'tired') q.tiredUntil = tick + ticks; else q.slipUntil = tick + ticks;
      fx.push({ type: 'malus', t: kind, seat: q.seat, by: p.seat });
    }
  }
  function collectPickups(p) {
    for (let i = pickups.length - 1; i >= 0; i--) {
      const pk = pickups[i];
      if (Math.hypot(pk.x - p.x, pk.y - p.y) > radius(p) + PU_R) continue;
      pickups.splice(i, 1);
      if (pk.t === 'heavy') p.lvl = Math.min(LVL_MAX, p.lvl + 1);              // onigiri : un palier de plus, pour toute la manche
      else if (pk.t === 'dash') { p.dashReadyAt = tick; p.boostUntil = tick + BOOST_TICKS; malus(p, 'tired', TIRED_TICKS); }
      else if (pk.t === 'grip') { p.gripUntil = tick + GRIP_TICKS; malus(p, 'slip', SLIP_TICKS); }
      fx.push({ type: 'pickup', seat: p.seat, t: pk.t, x: r1(pk.x), y: r1(pk.y), lvl: p.lvl });
      if (pk.t === 'shock') {                            // onde de choc immédiate : repousse tout le monde autour, dégressif avec la distance
        for (const q of players) {
          if (q === p || !q.alive || !foe(p, q)) continue;   // coéquipiers épargnés
          const dx = q.x - p.x, dy = q.y - p.y, d = Math.hypot(dx, dy);
          if (d >= SHOCK_R) continue;
          q.stunUntil = tick + STUN_TICKS; fx.push({ type: 'malus', t: 'stun', seat: q.seat, by: p.seat });
          const nx = d > 1e-6 ? dx / d : 1, ny = d > 1e-6 ? dy / d : 0;
          const imp = SHOCK_IMP * (1 - 0.5 * d / SHOCK_R) / mass(q) * (grip(q) ? GRIP_HIT_MUL : 1);
          q.vx += nx * imp; q.vy += ny * imp;
          touch(q, p);                                   // l'auteur de l'onde est crédité si la victime sort
        }
        fx.push({ type: 'shock', seat: p.seat, x: r1(p.x), y: r1(p.y) });
      }
    }
  }
  function spawnPickup() {
    if (pickups.length >= MAX_PU) return;
    const c = cxy();
    for (let tries = 0; tries < 16; tries++) {
      const ang = Math.random() * 2 * Math.PI, rr = Math.sqrt(Math.random()) * ring * PU_ZONE;   // sqrt : répartition uniforme sur le disque
      const x = c + rr * Math.cos(ang), y = c + rr * Math.sin(ang);
      if (players.some(p => p.alive && Math.hypot(p.x - x, p.y - y) < radius(p) + PU_R + 20)) continue;   // pas sous les pieds de quelqu'un
      if (pickups.some(pk => Math.hypot(pk.x - x, pk.y - y) < PU_R * 4)) continue;
      pickups.push({ x, y, t: Math.random() < ONIGIRI_P ? 'heavy' : PU_TYPES[1 + Math.floor(Math.random() * 3)] });   // l'onigiri tombe plus souvent (≈ 40 %)
      return;
    }
  }

  function botThink(p) {                             // IA : pousse l'adversaire le plus proche VERS LE BORD, se replie quand elle-même est au bord
    const D = SMDIFF[botDiff] || SMDIFF[1];
    if (tick < p.botNext) return;
    p.botNext = tick + D.every;
    if (p.botIdle > tick) { p.mx = 0; p.my = 0; return; }
    if (D.hes && Math.random() < D.hes) { p.botIdle = tick + 8 + Math.floor(Math.random() * 14); p.mx = 0; p.my = 0; return; }   // Facile : hésite
    const c = cxy(), ox = p.x - c, oy = p.y - c, rp = Math.hypot(ox, oy);
    // cible : l'adversaire le plus proche, distance DIMINUÉE de la moitié de son éloignement au centre. Sans ce biais, en mêlée,
    // chacun vise son voisin collé au centre, tout le monde pousse vers l'intérieur et personne ne sort jamais (mesuré : 10 bots → 3 min sans issue).
    let tgt = null, best = Infinity, bs = Infinity;
    for (const q of players) {
      if (!q.alive || q === p || !foe(p, q)) continue;
      const d = Math.hypot(q.x - p.x, q.y - p.y), sc = d - BOT_EXPO_W * Math.hypot(q.x - c, q.y - c);
      if (sc < bs) { bs = sc; best = d; tgt = q; }
    }
    let gx = 0, gy = 0, rt = 0;
    const ready = tick >= p.dashReadyAt;
    if (rp > 0.7 * ring) { gx = -ox; gy = -oy; }     // trop près de la paille : on revient au centre avant tout
    else if (tgt) {
      const tx = tgt.x - c, ty = tgt.y - c; rt = Math.hypot(tx, ty) || 1;
      const rs = radius(p) + radius(tgt);
      if (ready && best < 130 && rt > rp) {
        // charge prête et cible plus exposée : on vise droit sur elle, en anticipant sa course (4 ticks)
        gx = tgt.x + tgt.vx * 4 - p.x; gy = tgt.y + tgt.vy * 4 - p.y;
      } else {
        // sinon on se place DERRIÈRE la cible côté centre, avec un peu d'élan en réserve si la charge se recharge :
        // la poussée suivante l'enverra vers l'extérieur, et nous restons nous-mêmes du côté sûr
        const back = rs * (ready ? 0.9 : 1.6);
        const ax = tgt.x - tx / rt * back, ay = tgt.y - ty / rt * back;
        gx = ax - p.x; gy = ay - p.y;
        if (rp < rt && Math.hypot(gx, gy) < rs * 0.8) { gx = tgt.x - p.x; gy = tgt.y - p.y; }   // bien placé : on pousse
      }
      // bonus : détour si un bonus est nettement plus proche que la cible (et sans risque)
      if (D.pick && Math.random() < D.pick) for (const pk of pickups) {
        const dk = Math.hypot(pk.x - p.x, pk.y - p.y);
        if (dk < best * 0.6 && Math.hypot(pk.x - c, pk.y - c) < 0.6 * ring) { gx = pk.x - p.x; gy = pk.y - p.y; break; }
      }
    } else { gx = -ox; gy = -oy; }
    const gl = Math.hypot(gx, gy);
    if (gl > 1) { p.mx = gx / gl; p.my = gy / gl; } else { p.mx = 0; p.my = 0; }
    // charge : cible proche, dans l'axe, et plus exposée au bord que nous (sinon c'est nous qui risquons de sortir)
    if (tgt && ready && best < 130 && rt > rp) {
      const ux = (tgt.x - p.x) / best, uy = (tgt.y - p.y) / best;
      if (ux * p.mx + uy * p.my > 0.9 && Math.random() < D.dashP) p.wantDash = true;
    }
    // ancrage : un adversaire charge droit sur nous alors qu'on est près du bord (réaction probabiliste, cf. SMDIFF)
    if (D.brace && tick >= p.braceReadyAt && rp > 0.5 * ring && Math.random() < D.braceP) for (const q of players) {
      if (!q.alive || q === p || !foe(p, q) || !dashing(q)) continue;
      const dx = p.x - q.x, dy = p.y - q.y, d = Math.hypot(dx, dy), sq = Math.hypot(q.vx, q.vy);
      if (d < 170 && sq > 1 && (dx * q.vx + dy * q.vy) / (d * sq) > 0.8) { p.wantBrace = true; break; }
    }
  }

  function updateRing() {
    if (tick < SD_START) return;
    if (sdPhase === 0) { sdPhase = 1; fx.push({ type: 'shrink' }); }
    if (tick >= SD_FAST && sdPhase === 1) { sdPhase = 2; fx.push({ type: 'shrink' }); }   // accélération : le client refait pulser la paille
    const rate = tick >= SD_FAST ? SD_FAST_RATE : SD_SLOW_RATE;
    const fl = ringFloor();
    if (atFloor && ring > fl + 0.05) fx.push({ type: 'shrink' });   // une sortie a abaissé le plancher : le cordon repart, la paille repulse
    ring = Math.max(fl, ring - ring0 * rate);
    atFloor = ring <= fl;
    const c = cxy();
    pickups = pickups.filter(pk => Math.hypot(pk.x - c, pk.y - c) < ring - PU_R);   // bonus avalés par la paille
  }

  function update() {
    fx = pend; pend = [];                            // événements émis entre deux ticks (sel du départ) : diffusés maintenant
    if (gameState === 'countdown') { tick++; if (tick >= countdownUntil) { gameState = 'play'; tick = 0; } return; }
    if (gameState !== 'play') return;
    tick++;
    updateRing();
    const alive = players.filter(p => p.alive);
    for (const p of alive) { if (p.bot) botThink(p); else humanDir(p); }
    for (const p of alive) { if (p.wantBrace) tryBrace(p); if (p.wantDash) tryDash(p); }
    for (const p of alive) move(p);
    for (let i = 0; i < alive.length; i++) for (let j = i + 1; j < alive.length; j++) collide(alive[i], alive[j]);
    for (const p of alive) collectPickups(p);
    const c = cxy();
    for (const p of alive) if (Math.hypot(p.x - c, p.y - c) > ring) eliminate(p);   // le CENTRE du lutteur franchit la paille
    if (tick % PU_EVERY === 0) spawnPickup();
    if (aliveTeams().size <= 1 || tick >= TIME_CAP) endRound();
  }

  function snapshot() {
    const cd = (t, len) => r2(1 - Math.max(0, t - tick) / len);
    return {
      gs: gameState, count: gameState === 'countdown' ? Math.max(0, Math.ceil((countdownUntil - tick) / TICK_HZ)) : 0,
      round, winner, fx, connected: connectedCount(), botCount, maxBots: maxBots(), botDiff, mode, nteams,
      ar, ring: r1(ring), ring0: r1(ring0), sd: gameState === 'play' && tick >= SD_START && ring > ringFloor(),
      pickups: pickups.map(pk => ({ x: r1(pk.x), y: r1(pk.y), t: pk.t })),
      stats: gameState === 'over' ? { durationSec: Math.round(endTick / TICK_HZ), nParts } : null,
      players: players.map(p => ({
        seat: p.seat, name: p.name, team: p.team, connected: !!p.member, playing: p.playing, alive: p.alive, bot: !!p.bot,
        x: r1(p.x), y: r1(p.y), vx: r1(p.vx), vy: r1(p.vy), a: r2(p.a), r: r1(radius(p)),
        dcd: cd(p.dashReadyAt, p.dashCdLen || DASH_CD), dashing: dashing(p), brace: bracing(p), bcd: cd(p.braceReadyAt, BRACE_CD),
        heavy: heavy(p), lvl: p.lvl, grip: grip(p), boost: p.boostUntil > tick,
        tired: p.tiredUntil > tick, slip: slippy(p), stun: stunned(p),
        kills: p.kills, place: p.place, elimTick: p.elimTick, outBy: p.outBy,
      })),
    };
  }

  /* ---- contrat plateforme ---- */
  function onJoin(member) {
    const cur = seatOf(member); if (cur >= 0) return { role: 'player', seat: cur, hello: { t: 'welcome', seat: cur } }; // déjà assis (reconnexion within grace)
    let seat = -1;
    const rid = seatByMid[member.id];
    if (rid != null && players[rid] && !players[rid].member && !players[rid].bot) seat = rid;
    if (seat < 0) { const free = players.find(p => !p.member && !p.bot); if (free) seat = free.seat; }   // siège de bot protégé
    if (seat < 0) return { role: 'spectator', hello: { t: 'welcome', seat: -1 } };
    const p = players[seat];
    p.member = member; p.mid = member.id; p.name = member.name || '';
    seatByMid[member.id] = seat;
    if (gameState === 'lobby') setArena(partCount());  // aperçu du lobby à la bonne échelle
    return { role: 'player', seat, hello: { t: 'welcome', seat } };
  }
  function onLeave(member) {
    const seat = seatOf(member); if (seat < 0) return;
    const p = players[seat]; p.member = null; p.inp = { up: false, down: false, left: false, right: false }; p.mx = 0; p.my = 0;
    if (gameState === 'play' || gameState === 'countdown' || gameState === 'paused') {
      if (p.alive) { p.alive = false; p.elimTick = tick; p.place = nParts - deaths; deaths++; }
      if (connectedCount() === 0) fullReset(); else if (gameState === 'play' && aliveTeams().size <= 1) endRound();
    } else if (connectedCount() === 0) fullReset();
    else if (gameState === 'lobby') setArena(partCount());
  }
  function onRename(member) { const s = seatOf(member); if (s >= 0) players[s].name = member.name || ''; }
  function onMessage(member, m) {
    if (!m || typeof m !== 'object') return;
    const seat = seatOf(member);
    const p = seat >= 0 ? players[seat] : null;
    if (m.t === 'input' && p) p.inp = { up: !!m.up, down: !!m.down, left: !!m.left, right: !!m.right };   // état TENU, envoyé à chaque changement
    else if (m.t === 'dash' && p && p.alive && gameState === 'play') p.wantDash = true;     // traité au tick suivant (ordre déterministe)
    else if (m.t === 'brace' && p && p.alive && gameState === 'play') p.wantBrace = true;
    else if (m.t === 'start') startGame();
    else if (m.t === 'pause') { if (gameState === 'play') gameState = 'paused'; else if (gameState === 'paused') gameState = 'play'; }
    else if (m.t === 'abort') backToLobby();
    else if (m.t === 'mode') { if (editable()) { const v = validModes(partCount()); mode = v[(v.indexOf(mode) + 1) % v.length] || 'ffa'; } }
    else if (m.t === 'bots') { if (editable()) { const mx = maxBots(); botCount = mx <= 0 ? 0 : (botCount + 1) % (mx + 1); if (gameState === 'lobby') setArena(partCount()); } }
    else if (m.t === 'botdiff') { if (editable()) botDiff = (botDiff + 1) % 3; }
    else if (m.t === 'lbreset') reset(GID);
  }
  function tick_() { for (const p of players) if (p.member) p.name = p.member.name || p.name || ''; update(); return snapshot(); }

  fullReset();
  return { onJoin, onLeave, onRename, onMessage, tick: tick_, isIdle: editable };
}

export default { meta: { id: GID, name: 'Sumo', min: 2, max: 10, tickHz: TICK_HZ, desc: 'Dohyō — poussez les autres hors du cercle : charge, ancrage, bonus, cercle qui se resserre' }, create: createSumo };
