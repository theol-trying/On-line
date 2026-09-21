// Jeu TANK COMBAT v2 — arènes à murs destructibles, power-ups, mines, collision tank-tank, FFA/équipes, mode manches.
import { ARENA, TANK_R, SHELL_R, BLK, G } from '../../public/games/tank/shared.js';
import { board, pushHistory, save, markDirty, reset, bumpDaily } from '../../leaderboard.js';
import { dailyRng } from '../../dayseed.js';

const GID = 'tank';
const MAX_SEATS = 6;
const TICK_HZ = 30;
const COUNTDOWN_TICKS = 3 * TICK_HZ;
const TANK_SPD = 2.4, REV = 0.6, ROT = 0.085, SPEED_MUL = 1.5;
const SHELL_SPD = 6.5, SHELL_LIFE = 110, MAX_BOUNCE = 3, FIRE_COOL = 20, MAX_SHELLS = 2;
const LIVES = 3, INVULN = 45;
const PU_EVERY = 6 * TICK_HZ, MAX_PU = 3, PU_R = 11;
const RAPID_T = 6 * TICK_HZ, TRIPLE_T = 8 * TICK_HZ, SPEED_T = 8 * TICK_HZ, PIERCE_T = 8 * TICK_HZ, SHIELD_CAP = 2;
const MINE_ARM = 20, MINE_R = 30, MINE_CAP = 3;
const EMP_T = 2 * TICK_HZ, EMP_R = BLK * 4;        // EMP : étourdit les ennemis proches
const HOMING_T = 8 * TICK_HZ, CAMO_T = 6 * TICK_HZ, RADAR_T = 10 * TICK_HZ, HOMING_TURN = 0.13; // power-ups avancés : missile guidé / camouflage / radar
const BARREL_COUNT = 4, BARREL_R = 11, BARREL_DMG_R = BLK * 1.25, BARREL_CHAIN = BLK * 1.6;      // barils explosifs : rayon collision / dégâts de zone / chaînage
const MUD_COUNT = 10, MUD_MUL = 0.5;               // zones de boue : ralentissent les tanks qui les traversent
const PU_TYPES = ['rapid', 'triple', 'shield', 'speed', 'pierce', 'mine', 'repair', 'emp', 'homing', 'camo', 'radar'];
const TKDIFF = [{ skip: 0.45, fireA: 0.14, fireP: 0.5 }, { skip: 0.12, fireA: 0.22, fireP: 0.9 }, { skip: 0, fireA: 0.3, fireP: 1 }];   // IA : Facile / Normale / Difficile (réactivité, fenêtre et probabilité de tir)
const WIN_TARGETS = [1, 3, 5];
const SPAWNS = [[1, 1], [G - 2, G - 2], [G - 2, 1], [1, G - 2], [(G - 1) / 2 | 0, 1], [(G - 1) / 2 | 0, G - 2]];
const TEAM_COUNT = { ffa: 0, '2v2': 2, '2v2v2': 3, '3v3': 2 };
const numTeamsFor = (m, N) => (m === 'ffa' ? N : TEAM_COUNT[m]);
function validModes(N) { const v = ['ffa']; if (N === 4) v.push('2v2'); if (N === 6) v.push('2v2v2', '3v3'); return v; }
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const bidx = (gx, gy) => gy * G + gx;
const DIRS4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const GEN_NAMES = ['Symétrique', 'Aléatoire', '4 coins'];
// génération procédurale des murs solides (sym180 / aléatoire / 4 coins) avec connectivité garantie
function genSolidSet(style, density, safe, rnd) {
  const cache = new Map();
  const canon = (x, y) => {
    if (style === 1) return x + ',' + y;                                  // aléatoire : chaque case décidée seule
    if (style === 0) { const bx = G - 1 - x, by = G - 1 - y; return (y < by || (y === by && x <= bx)) ? (x + ',' + y) : (bx + ',' + by); } // 180°
    return Math.min(x, G - 1 - x) + ',' + Math.min(y, G - 1 - y);         // 4 coins
  };
  const want = (x, y) => { const k = canon(x, y); if (!cache.has(k)) cache.set(k, rnd() < density); return cache.get(k); };
  const s = new Set();
  for (let y = 1; y < G - 1; y++) for (let x = 1; x < G - 1; x++) { const k = bidx(x, y); if (safe.has(k)) continue; if (want(x, y)) s.add(k); }
  return s;
}
function tankConnected(solid, spawns) {                 // BFS sur l'espace libre (bord inclus) : tout doit être atteignable
  const start = bidx(spawns[0][0], spawns[0][1]); if (solid.has(start)) return false;
  const seen = new Uint8Array(G * G); seen[start] = 1; const st = [start]; let cnt = 1; const freeTotal = G * G - solid.size;
  while (st.length) { const c = st.pop(), x = c % G, y = (c / G) | 0; for (const [dx, dy] of DIRS4) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= G || ny >= G) continue; const k = bidx(nx, ny); if (seen[k] || solid.has(k)) continue; seen[k] = 1; st.push(k); cnt++; } }
  for (const s of spawns) if (!seen[bidx(s[0], s[1])]) return false;   // tous les spawns reliés
  return cnt >= freeTotal * 0.6;                                        // gros bloc jouable (petites poches tolérées)
}

export function createTank(room) {
  let players, shells, mines, pickups, blocks, gameState, tick, round, countdownUntil, winner, fx, mode, nteams, nParts, deaths, endTick;
  let arenaStyle, winTarget, matchWon, matchWinner, ff, botCount, botDiff;   // ff = tir allié autorisé ; botCount = nb de bots IA ; botDiff = 0/1/2
  let lastGrid = '';                                                // dernière grille émise (delta : on n'émet que si changement)
  let barrels, mudSet;                                              // barils explosifs ; ensemble d'indices de cases boueuses
  let seatByMid = {};
  let daily = false;                                                // « Défi du jour » : piloté par le hub (hors fullReset, c'est un réglage de plateforme)

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
      e.kills += p.kills; e.dmg += p.dmg;
      const surv = (p.elimTick >= 0 ? p.elimTick : endTick) / TICK_HZ;
      e.survSum += surv; if (surv > e.bestSurvivalSec) e.bestSurvivalSec = surv;
      if (p.elimTick >= 0) e.deaths++;
    }
    const champ = winner >= 0 ? players.find(p => p.playing && p.team === winner) : null;
    pushHistory(GID, { when: Date.now(), mode, preset: 'tank',
      winner: champ ? (nteams < nParts ? 'Équipe ' + 'ABC'[winner] : (champ.name || ('P' + (champ.seat + 1)))) : 'Égalité',
      durationSec: Math.round(endTick / TICK_HZ), nParts });
    save(); markDirty(GID);
  }

  function makePlayers() {
    return Array.from({ length: MAX_SEATS }, (_, seat) => ({
      seat, member: null, mid: null, name: '', team: 0, alive: false, playing: false, bot: false,
      x: ARENA / 2, y: ARENA / 2, angle: 0, lives: LIVES, cool: 0, invulnUntil: 0, empUntil: 0, spawn: { x: 0, y: 0, angle: 0 },
      inputs: { left: false, right: false, fwd: false, back: false, fire: false },
      rapidUntil: 0, tripleUntil: 0, speedUntil: 0, pierceUntil: 0, shield: 0, mineN: 0,
      homingUntil: 0, camoUntil: 0, radarUntil: 0,
      kills: 0, dmg: 0, place: 0, elimTick: -1, score: 0,
    }));
  }
  function fullReset() {
    players = makePlayers(); shells = []; mines = []; pickups = []; blocks = new Array(G * G).fill(0);
    gameState = 'lobby'; tick = 0; round = 0; winner = null; fx = []; mode = 'ffa'; nteams = 0; nParts = 0; deaths = 0; endTick = 0;
    arenaStyle = 0; winTarget = 1; matchWon = false; matchWinner = null; ff = false; botCount = 0; botDiff = 1; barrels = []; mudSet = new Set(); seatByMid = {};
  }

  const connectedCount = () => players.filter(p => p.member).length;
  const maxBots = () => MAX_SEATS - connectedCount();
  const partCount = () => Math.min(connectedCount() + botCount, MAX_SEATS);
  const canStart = () => connectedCount() >= 1 && partCount() >= 2;
  const editable = () => gameState === 'lobby' || gameState === 'over';
  const seatOf = member => { for (const p of players) if (p.member === member) return p.seat; return -1; };
  const active = p => p.playing && p.alive;
  const aliveTeams = () => new Set(players.filter(active).map(p => p.team));

  function buildArena(parts) {
    const safe = new Set();
    parts.forEach((p, i) => { const [sx, sy] = SPAWNS[i]; [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => safe.add(bidx(sx + dx, sy + dy))); });
    const spawns = parts.map((p, i) => SPAWNS[i]);
    // « Défi du jour » : générateur déterministe dérivé de la date -> même carte pour tout le monde pendant 24 h
    const rnd = daily ? dailyRng('tank|' + arenaStyle + '|' + parts.length) : Math.random;
    let solid = null;
    for (let a = 0; a < 24; a++) { const s = genSolidSet(arenaStyle, 0.14, safe, rnd); if (tankConnected(s, spawns)) { solid = s; break; } } // murs procéduraux + connectivité garantie
    if (!solid) { solid = new Set(); for (let y = 1; y < G - 1; y++) for (let x = 1; x < G - 1; x++) if (x % 2 === 0 && y % 2 === 0 && !safe.has(bidx(x, y))) solid.add(bidx(x, y)); } // repli : piliers (toujours connecté)
    blocks = new Array(G * G).fill(0);
    for (const k of solid) blocks[k] = 1;
    for (let i = 0; i < blocks.length; i++) { const gx = i % G, gy = (i / G) | 0; if (gx > 0 && gy > 0 && gx < G - 1 && gy < G - 1 && blocks[i] === 0 && !safe.has(i) && rnd() < 0.42) blocks[i] = 2; }
    // barils explosifs + zones de boue : posés sur des cases libres, hors zones de spawn (n'affectent pas la connectivité : traversables)
    barrels = []; mudSet = new Set();
    const free = [];
    for (let i = 0; i < blocks.length; i++) { const gx = i % G, gy = (i / G) | 0; if (gx > 0 && gy > 0 && gx < G - 1 && gy < G - 1 && blocks[i] === 0 && !safe.has(i)) free.push(i); }
    for (let n = free.length - 1; n > 0; n--) { const j = Math.floor(rnd() * (n + 1)); const t = free[n]; free[n] = free[j]; free[j] = t; } // mélange
    let fi = 0;
    for (let b = 0; b < BARREL_COUNT && fi < free.length; b++, fi++) { const k = free[fi], gx = k % G, gy = (k / G) | 0; barrels.push({ x: (gx + 0.5) * BLK, y: (gy + 0.5) * BLK, dead: false }); }
    for (let mn = 0; mn < MUD_COUNT && fi < free.length; mn++, fi++) mudSet.add(free[fi]);
  }

  function spawnFor(i) { const [gx, gy] = SPAWNS[i]; const x = (gx + 0.5) * BLK, y = (gy + 0.5) * BLK; return { x, y, angle: Math.atan2(ARENA / 2 - y, ARENA / 2 - x) }; }
  function placeAtSpawn(p) { p.x = p.spawn.x; p.y = p.spawn.y; p.angle = p.spawn.angle; p.invulnUntil = tick + INVULN; }

  function startGame() {
    if (!editable() || !canStart()) return;
    for (const p of players) { p.playing = false; p.bot = false; }
    if (botCount > maxBots()) botCount = maxBots();
    const parts = players.filter(p => p.member);
    let bots = botCount;
    for (const p of players) { if (bots <= 0) break; if (!p.member) { p.bot = true; parts.push(p); bots--; } } // complète avec des bots
    if (parts.length < 2) return;
    const N = parts.length;
    if (!validModes(N).includes(mode)) mode = 'ffa';
    nteams = numTeamsFor(mode, N);
    if (matchWon) { players.forEach(p => p.score = 0); matchWon = false; matchWinner = null; }
    buildArena(parts);
    nParts = N; deaths = 0; endTick = 0; winner = null; fx = []; shells = []; mines = []; pickups = [];
    tick = 0;                       // remis à 0 AVANT placeAtSpawn : sinon l'invuln se calcule sur le tick (élevé) de la manche précédente -> joueurs invincibles au rematch
    parts.forEach((p, i) => {
      p.playing = true; p.alive = true; p.lives = LIVES; p.kills = 0; p.dmg = 0; p.place = 0; p.elimTick = -1; p.team = i % nteams; p.cool = 0;
      p.rapidUntil = 0; p.tripleUntil = 0; p.speedUntil = 0; p.pierceUntil = 0; p.shield = 0; p.mineN = 0; p.empUntil = 0;
      p.homingUntil = 0; p.camoUntil = 0; p.radarUntil = 0;
      p.botAvoidUntil = 0; p.botWanderUntil = 0; p.botWanderTurn = null;   // tick repart à 0 : purge l'état d'IA de la manche précédente
      if (p.bot) p.name = '🤖 Bot ' + (i + 1);
      p.spawn = spawnFor(i); placeAtSpawn(p);
      p.inputs = { left: false, right: false, fwd: false, back: false, fire: false };
    });
    round++; tick = 0; countdownUntil = COUNTDOWN_TICKS; gameState = 'countdown';
  }
  function backToLobby() {            // abandon : retour au lobby en pleine partie (même s'il ne reste que des bots)
    if (gameState !== 'play' && gameState !== 'countdown' && gameState !== 'paused') return;
    gameState = 'lobby'; winner = null; fx = []; shells = []; mines = []; pickups = [];
    for (const p of players) { p.playing = false; p.alive = false; p.inputs = { left: false, right: false, fwd: false, back: false, fire: false }; }
  }
  function endRound() {
    gameState = 'over'; endTick = tick;
    const s = aliveTeams();
    winner = s.size === 1 ? [...s][0] : -1;
    players.forEach(p => { if (p.playing && p.alive) p.place = 1; });
    if (winner >= 0) {
      players.forEach(p => { if (p.playing && p.team === winner) p.score++; });
      const champ = players.find(p => p.playing && p.team === winner);
      if (champ && champ.score >= winTarget) { matchWon = true; matchWinner = winner; }
    }
    recordRound();
  }

  function cellSolid(gx, gy) { if (gx < 0 || gy < 0 || gx >= G || gy >= G) return true; return blocks[bidx(gx, gy)] !== 0; }
  function blockedTank(x, y, ignore) {
    if (x < TANK_R || y < TANK_R || x > ARENA - TANK_R || y > ARENA - TANK_R) return true;
    const r = TANK_R - 1;
    for (const cx of [x - r, x + r]) for (const cy of [y - r, y + r]) if (cellSolid(Math.floor(cx / BLK), Math.floor(cy / BLK))) return true;
    for (const q of players) { if (q === ignore || !active(q)) continue; if ((x - q.x) ** 2 + (y - q.y) ** 2 < (TANK_R * 2 - 3) ** 2) return q; }
    return false;
  }
  function moveTank(p) {
    if (p.empUntil > tick) return;     // EMP : immobilisé
    if (p.inputs.left) p.angle -= ROT;
    if (p.inputs.right) p.angle += ROT;
    let base = p.speedUntil > tick ? TANK_SPD * SPEED_MUL : TANK_SPD;
    if (mudSet.has(bidx(Math.floor(p.x / BLK), Math.floor(p.y / BLK)))) base *= MUD_MUL;   // zone de boue : ralentit
    const s = p.inputs.fwd ? base : p.inputs.back ? -base * REV : 0;
    if (!s) return;
    const dx = Math.cos(p.angle) * s, dy = Math.sin(p.angle) * s;
    let bx = blockedTank(p.x + dx, p.y, p);
    if (!bx) p.x += dx; else if (bx !== true && bx.invulnUntil <= tick) { const nx = bx.x + dx * 0.5; if (!blockedTank(nx, bx.y, bx)) { bx.x = nx; p.x += dx * 0.5; } } // poussée légère
    let by = blockedTank(p.x, p.y + dy, p);
    if (!by) p.y += dy; else if (by !== true && by.invulnUntil <= tick) { const ny = by.y + dy * 0.5; if (!blockedTank(by.x, ny, by)) { by.y = ny; p.y += dy * 0.5; } }
  }
  function fire(p) {
    if (p.empUntil > tick) return;     // EMP : ne peut pas tirer
    if (!p.inputs.fire || tick < p.cool) return;
    if (shells.filter(s => s.o === p.seat).length >= MAX_SHELLS) return;
    p.cool = tick + (p.rapidUntil > tick ? FIRE_COOL / 2 : FIRE_COOL);
    const angs = p.tripleUntil > tick ? [-0.18, 0, 0.18] : [0];
    for (const da of angs) {
      const a = p.angle + da, mx = p.x + Math.cos(a) * (TANK_R + SHELL_R + 1), my = p.y + Math.sin(a) * (TANK_R + SHELL_R + 1);
      shells.push({ x: mx, y: my, vx: Math.cos(a) * SHELL_SPD, vy: Math.sin(a) * SHELL_SPD, o: p.seat, team: p.team, bounces: 0, life: SHELL_LIFE, pierce: p.pierceUntil > tick, homing: p.homingUntil > tick });
    }
    fx.push({ type: 'shot', x: p.x, y: p.y, seat: p.seat });
  }
  function botThink(p) {                              // IA : viser l'ennemi le plus proche, avancer en tournant, tirer ; évitement ENGAGÉ (sinon le bot tremble sur place)
    const D = TKDIFF[botDiff] || TKDIFF[1];
    if (D.skip && Math.random() < D.skip) return;     // Facile : réagit moins souvent (garde ses inputs précédents)
    const inp = { left: false, right: false, fwd: false, back: false, fire: false };
    let tgt = null, bd = Infinity;
    for (const q of players) { if (!active(q) || q === p) continue; if (mode !== 'ffa' && q.team === p.team) continue; if (q.camoUntil > tick && p.radarUntil <= tick) continue; const d = (q.x - p.x) ** 2 + (q.y - p.y) ** 2; if (d < bd) { bd = d; tgt = q; } } // ne « voit » pas les camouflés (sauf radar)
    const ahead = blockedTank(p.x + Math.cos(p.angle) * (TANK_R + 10), p.y + Math.sin(p.angle) * (TANK_R + 10), p);
    if (p.botAvoidUntil > tick) {                     // manœuvre en cours : on s'y tient quelques ticks
      inp[p.botAvoidDir] = true; inp.back = !!p.botAvoidBack; if (!ahead && !p.botAvoidBack) inp.fwd = true;
    } else if (ahead) {                               // bloqué : choisir un côté (et parfois reculer) puis s'y tenir
      p.botAvoidDir = Math.random() < 0.5 ? 'left' : 'right'; p.botAvoidBack = Math.random() < 0.4; p.botAvoidUntil = tick + 10 + Math.floor(Math.random() * 16);
      inp[p.botAvoidDir] = true; inp.back = !!p.botAvoidBack;
    } else if (tgt) {
      const desired = Math.atan2(tgt.y - p.y, tgt.x - p.x), diff = Math.atan2(Math.sin(desired - p.angle), Math.cos(desired - p.angle));
      if (diff > 0.07) inp.right = true; else if (diff < -0.07) inp.left = true;
      if (Math.abs(diff) < 1.1 && bd > (BLK * 1.3) ** 2) inp.fwd = true;                 // avance aussi pendant qu'il tourne, s'approche plus près
      if (Math.abs(diff) < D.fireA && tick >= p.cool && Math.random() < D.fireP) inp.fire = true;   // aligné : tire (fenêtre/probabilité selon difficulté)
      if (p.mineN > 0 && bd < (BLK * 1.4) ** 2 && Math.random() < 0.03) { p.mineN--; mines.push({ x: p.x, y: p.y, owner: p.seat, arm: tick + MINE_ARM }); fx.push({ type: 'mineset', x: p.x, y: p.y, seat: p.seat }); }
    } else {                                          // pas de cible visible : errance (patrouille)
      if (!(p.botWanderUntil > tick)) { p.botWanderUntil = tick + 20 + Math.floor(Math.random() * 40); p.botWanderTurn = Math.random() < 0.35 ? (Math.random() < 0.5 ? 'left' : 'right') : null; }
      if (p.botWanderTurn) inp[p.botWanderTurn] = true;
      inp.fwd = true;
    }
    p.inputs = inp;
  }
  function shellHitsCell(sh) {
    const gx = Math.floor(sh.x / BLK), gy = Math.floor(sh.y / BLK);
    if (gx < 0 || gy < 0 || gx >= G || gy >= G) return null;
    const b = blocks[bidx(gx, gy)];
    if (!b) return null;
    if (b === 2) { blocks[bidx(gx, gy)] = 0; fx.push({ type: 'wall', x: gx, y: gy }); return sh.pierce ? (sh.pierce = false, 'pass') : 'die'; }
    const ox = gx * BLK, oy = gy * BLK, nx = clamp(sh.x, ox, ox + BLK), ny = clamp(sh.y, oy, oy + BLK), dx = sh.x - nx, dy = sh.y - ny;
    if (Math.abs(dx) >= Math.abs(dy)) { sh.vx = -sh.vx; sh.x = nx + Math.sign(dx || sh.vx) * (SHELL_R + 0.5); }
    else { sh.vy = -sh.vy; sh.y = ny + Math.sign(dy || sh.vy) * (SHELL_R + 0.5); }
    sh.bounces++; return 'bounce';
  }
  function damage(t, killer, x, y) {
    if (t.invulnUntil > tick) return;
    if (t.shield > 0) { t.shield--; fx.push({ type: 'shield', x, y, seat: t.seat }); return; }
    t.lives--;
    const kp = killer >= 0 ? players[killer] : null;
    if (kp && kp !== t) kp.dmg++;
    fx.push({ type: 'hit', x, y, seat: t.seat, by: killer });
    if (t.lives <= 0) { t.alive = false; t.elimTick = tick; t.place = nParts - deaths; deaths++; if (kp && kp !== t) kp.kills++; fx.push({ type: 'boom', x: t.x, y: t.y, seat: t.seat }); }
    else { placeAtSpawn(t); fx.push({ type: 'boom', x: t.x, y: t.y, seat: t.seat, small: true }); }
  }
  function applyPU(p, type) {
    if (type === 'rapid') p.rapidUntil = tick + RAPID_T;
    else if (type === 'triple') p.tripleUntil = tick + TRIPLE_T;
    else if (type === 'speed') p.speedUntil = tick + SPEED_T;
    else if (type === 'pierce') p.pierceUntil = tick + PIERCE_T;
    else if (type === 'shield') p.shield = Math.min(SHIELD_CAP, p.shield + 1);
    else if (type === 'mine') p.mineN = Math.min(MINE_CAP, p.mineN + 1);
    else if (type === 'repair') p.lives = Math.min(LIVES, p.lives + 1);   // 🔧 +1 vie (plafonné)
    else if (type === 'emp') { for (const q of players) if (active(q) && q !== p && (mode === 'ffa' || q.team !== p.team) && q.invulnUntil <= tick && (q.x - p.x) ** 2 + (q.y - p.y) ** 2 < EMP_R * EMP_R) { q.empUntil = tick + EMP_T; q.inputs = { left: false, right: false, fwd: false, back: false, fire: false }; fx.push({ type: 'emp', x: q.x, y: q.y, seat: q.seat }); } } // ⚡ étourdit les ennemis proches
    else if (type === 'homing') p.homingUntil = tick + HOMING_T;   // 🚀 missile guidé
    else if (type === 'camo') p.camoUntil = tick + CAMO_T;         // 👁 camouflage
    else if (type === 'radar') p.radarUntil = tick + RADAR_T;      // 📡 radar (révèle les camouflés)
  }
  function explode(x, y, killer) {                  // explosion d'un baril : dégâts de zone à tous + casse les murs cassables autour
    fx.push({ type: 'barrel', x, y });
    for (const p of players) if (active(p) && (x - p.x) ** 2 + (y - p.y) ** 2 < BARREL_DMG_R * BARREL_DMG_R) damage(p, killer, x, y);
    const gx = Math.floor(x / BLK), gy = Math.floor(y / BLK);
    for (const [dx, dy] of [[0, 0], ...DIRS4]) { const nx = gx + dx, ny = gy + dy; if (nx < 0 || ny < 0 || nx >= G || ny >= G) continue; const k = bidx(nx, ny); if (blocks[k] === 2) { blocks[k] = 0; fx.push({ type: 'wall', x: nx, y: ny }); } }
  }
  function detonateBarrels(seed, killer) {          // chaîne : un baril en fait sauter d'autres à proximité
    const queue = [...seed];
    while (queue.length) { const b = queue.shift(); if (b.dead) continue; b.dead = true; explode(b.x, b.y, killer); for (const o of barrels) if (!o.dead && (o.x - b.x) ** 2 + (o.y - b.y) ** 2 < BARREL_CHAIN * BARREL_CHAIN) queue.push(o); }
    barrels = barrels.filter(b => !b.dead);
  }
  function spawnPU() {
    if (pickups.length >= MAX_PU) return;
    for (let t = 0; t < 14; t++) {
      const gx = 1 + Math.floor(Math.random() * (G - 2)), gy = 1 + Math.floor(Math.random() * (G - 2));
      if (blocks[bidx(gx, gy)] !== 0) continue;
      const x = (gx + 0.5) * BLK, y = (gy + 0.5) * BLK;
      if (pickups.some(k => k.x === x && k.y === y)) continue;
      pickups.push({ x, y, type: PU_TYPES[Math.floor(Math.random() * PU_TYPES.length)] });
      return;
    }
  }

  function update() {
    fx = [];
    if (gameState === 'countdown') { tick++; if (tick >= countdownUntil) { gameState = 'play'; tick = 0; } return; }
    if (gameState !== 'play') return;
    tick++;
    for (const p of players) if (active(p)) { if (p.bot) botThink(p); moveTank(p); fire(p); }
    // power-ups au sol
    for (const p of players) {
      if (!active(p)) continue;
      for (let i = pickups.length - 1; i >= 0; i--) { const k = pickups[i]; if ((p.x - k.x) ** 2 + (p.y - k.y) ** 2 < (TANK_R + PU_R) ** 2) { applyPU(p, k.type); pickups.splice(i, 1); fx.push({ type: 'pickup', x: k.x, y: k.y, kind: k.type, seat: p.seat }); } }
    }
    if (tick % PU_EVERY === 0) spawnPU();
    // mines
    for (let i = mines.length - 1; i >= 0; i--) {
      const mn = mines[i]; if (tick < mn.arm) continue;
      let trig = false;
      for (const p of players) if (active(p) && p.seat !== mn.owner && (mode === 'ffa' || ff || players[mn.owner].team !== p.team) && (p.x - mn.x) ** 2 + (p.y - mn.y) ** 2 < MINE_R * MINE_R) { trig = true; break; }
      if (trig) { for (const p of players) if (active(p) && p.seat !== mn.owner && (mode === 'ffa' || ff || players[mn.owner].team !== p.team) && (p.x - mn.x) ** 2 + (p.y - mn.y) ** 2 < MINE_R * MINE_R) damage(p, mn.owner, mn.x, mn.y); mines.splice(i, 1); fx.push({ type: 'boom', x: mn.x, y: mn.y, seat: mn.owner }); }
    }
    // obus
    for (let i = shells.length - 1; i >= 0; i--) {
      const sh = shells[i]; sh.life--;
      if (sh.homing) {                              // missile guidé : braque vers l'ennemi le plus proche (vitesse conservée)
        let tg = null, bd = Infinity;
        for (const q of players) { if (!active(q) || q.seat === sh.o) continue; if (mode !== 'ffa' && !ff && q.team === sh.team) continue; if (q.invulnUntil > tick) continue; const d = (q.x - sh.x) ** 2 + (q.y - sh.y) ** 2; if (d < bd) { bd = d; tg = q; } }
        if (tg) { const want = Math.atan2(tg.y - sh.y, tg.x - sh.x), cur = Math.atan2(sh.vy, sh.vx); let df = Math.atan2(Math.sin(want - cur), Math.cos(want - cur)); df = clamp(df, -HOMING_TURN, HOMING_TURN); const na = cur + df, sp = Math.hypot(sh.vx, sh.vy) || SHELL_SPD; sh.vx = Math.cos(na) * sp; sh.vy = Math.sin(na) * sp; }
      }
      sh.x += sh.vx; sh.y += sh.vy;
      if (sh.x < SHELL_R) { sh.x = SHELL_R; sh.vx = -sh.vx; sh.bounces++; } else if (sh.x > ARENA - SHELL_R) { sh.x = ARENA - SHELL_R; sh.vx = -sh.vx; sh.bounces++; }
      if (sh.y < SHELL_R) { sh.y = SHELL_R; sh.vy = -sh.vy; sh.bounces++; } else if (sh.y > ARENA - SHELL_R) { sh.y = ARENA - SHELL_R; sh.vy = -sh.vy; sh.bounces++; }
      const r = shellHitsCell(sh);
      if (r === 'die' || sh.life <= 0 || sh.bounces > MAX_BOUNCE) { shells.splice(i, 1); continue; }
      let barrelHit = null;                         // un obus qui touche un baril le fait exploser (et propage)
      for (const b of barrels) if (!b.dead && (sh.x - b.x) ** 2 + (sh.y - b.y) ** 2 < (BARREL_R + SHELL_R) ** 2) { barrelHit = b; break; }
      if (barrelHit) { detonateBarrels([barrelHit], sh.o); shells.splice(i, 1); continue; }
      let consumed = false;
      for (const p of players) {
        if (!active(p) || p.seat === sh.o) continue;
        if (mode !== 'ffa' && !ff && p.team === sh.team) continue;
        if (p.invulnUntil > tick) continue;
        if ((sh.x - p.x) ** 2 + (sh.y - p.y) ** 2 < (TANK_R + SHELL_R) ** 2) { damage(p, sh.o, sh.x, sh.y); consumed = true; break; }
      }
      if (consumed) shells.splice(i, 1);
    }
    if (aliveTeams().size <= 1) endRound();
  }

  function snapshot() {
    const g = blocks.join('');
    const sendGrid = g !== lastGrid || tick % 15 === 0 || gameState !== 'play';   // delta + refresh 2×/s (arrivants, auto-réparation)
    if (sendGrid) lastGrid = g;
    return {
      gs: gameState, count: gameState === 'countdown' ? Math.max(0, Math.ceil((countdownUntil - tick) / TICK_HZ)) : 0,
      round, winner, fx, connected: connectedCount(), botCount, maxBots: maxBots(), botDiff, mode, nteams, winTarget, gen: arenaStyle, ff,
      grid: sendGrid ? g : undefined,
      shells: shells.map(s => ({ x: Math.round(s.x), y: Math.round(s.y), vx: Math.round(s.vx * 10) / 10, vy: Math.round(s.vy * 10) / 10, o: s.o, p: !!s.pierce, h: !!s.homing })),
      mines: mines.map(m => ({ x: m.x, y: m.y, o: m.owner, armed: tick >= m.arm })),
      pickups: pickups.map(k => ({ x: k.x, y: k.y, t: k.type })),
      barrels: barrels.map(b => ({ x: Math.round(b.x), y: Math.round(b.y) })),
      mud: [...mudSet],
      stats: gameState === 'over' ? { durationSec: Math.round(endTick / TICK_HZ), nParts, match: matchWon } : null,
      players: players.map(p => ({
        seat: p.seat, name: p.name, team: p.team, connected: !!p.member, playing: p.playing, alive: p.alive, bot: !!p.bot,
        x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10, angle: Math.round(p.angle * 100) / 100,
        lives: Math.max(0, p.lives), score: p.score, invuln: p.invulnUntil > tick, emp: p.empUntil > tick,
        shield: p.shield, rapid: p.rapidUntil > tick, triple: p.tripleUntil > tick, speed: p.speedUntil > tick, pierce: p.pierceUntil > tick, mineN: p.mineN,
        homing: p.homingUntil > tick, camo: p.camoUntil > tick, radar: p.radarUntil > tick,
        buffs: [                                        // [clé, fraction restante] pour les timers dégressifs sur les cartes
          p.rapidUntil > tick && ['rapid', Math.round((p.rapidUntil - tick) / RAPID_T * 100) / 100],
          p.tripleUntil > tick && ['triple', Math.round((p.tripleUntil - tick) / TRIPLE_T * 100) / 100],
          p.speedUntil > tick && ['speed', Math.round((p.speedUntil - tick) / SPEED_T * 100) / 100],
          p.pierceUntil > tick && ['pierce', Math.round((p.pierceUntil - tick) / PIERCE_T * 100) / 100],
          p.homingUntil > tick && ['homing', Math.round((p.homingUntil - tick) / HOMING_T * 100) / 100],
          p.camoUntil > tick && ['camo', Math.round((p.camoUntil - tick) / CAMO_T * 100) / 100],
          p.radarUntil > tick && ['radar', Math.round((p.radarUntil - tick) / RADAR_T * 100) / 100],
        ].filter(Boolean),
        kills: p.kills, dmg: p.dmg, place: p.place, elimTick: p.elimTick,
      })),
    };
  }

  /* ---- contrat plateforme ---- */
  function onJoin(member) {
    const cur = seatOf(member); if (cur >= 0) return { role: 'player', seat: cur, hello: { t: 'welcome', seat: cur } }; // déjà assis (reconnexion within grace)
    let seat = -1;
    const rid = seatByMid[member.id];
    if (rid != null && players[rid] && !players[rid].member && !players[rid].bot) seat = rid;
    if (seat < 0) { const free = players.find(p => !p.member && !p.bot); if (free) seat = free.seat; }
    if (seat < 0) return { role: 'spectator', hello: { t: 'welcome', seat: -1 } };
    const p = players[seat]; p.member = member; p.mid = member.id; p.name = member.name || ''; seatByMid[member.id] = seat;
    return { role: 'player', seat, hello: { t: 'welcome', seat } };
  }
  function onLeave(member) {
    const seat = seatOf(member); if (seat < 0) return;
    const p = players[seat]; p.member = null; p.inputs = { left: false, right: false, fwd: false, back: false, fire: false };
    if (gameState === 'play' || gameState === 'countdown' || gameState === 'paused') {
      if (p.alive) { p.alive = false; p.elimTick = tick; p.place = nParts - deaths; deaths++; }
      if (connectedCount() === 0) fullReset(); else if (gameState === 'play' && aliveTeams().size <= 1) endRound();
    } else if (connectedCount() === 0) fullReset();
  }
  function onRename(member) { const s = seatOf(member); if (s >= 0) players[s].name = member.name || ''; }
  function onMessage(member, m) {
    if (!m || typeof m !== 'object') return;
    const seat = seatOf(member); const p = seat >= 0 ? players[seat] : null;
    if (m.t === 'input' && p) p.inputs = { left: !!m.left, right: !!m.right, fwd: !!m.fwd, back: !!m.back, fire: !!m.fire };
    else if (m.t === 'mine' && p && active(p) && p.mineN > 0) { p.mineN--; mines.push({ x: p.x, y: p.y, owner: p.seat, arm: tick + MINE_ARM }); fx.push({ type: 'mineset', x: p.x, y: p.y, seat: p.seat }); }
    else if (m.t === 'start') startGame();
    else if (m.t === 'pause') { if (gameState === 'play') gameState = 'paused'; else if (gameState === 'paused') gameState = 'play'; }
    else if (m.t === 'abort') backToLobby();
    else if (m.t === 'mode') { if (editable()) { const v = validModes(partCount()); mode = v[(v.indexOf(mode) + 1) % v.length] || 'ffa'; } }
    else if (m.t === 'bots') { if (editable()) { const mx = maxBots(); botCount = mx <= 0 ? 0 : (botCount + 1) % (mx + 1); } }
    else if (m.t === 'botdiff') { if (editable()) botDiff = (botDiff + 1) % 3; }
    else if (m.t === 'arena') { if (editable()) arenaStyle = (arenaStyle + 1) % 3; }
    else if (m.t === 'wintarget') { if (editable()) winTarget = WIN_TARGETS[(WIN_TARGETS.indexOf(winTarget) + 1) % WIN_TARGETS.length]; }
    else if (m.t === 'ff') { if (editable()) ff = !ff; }
    else if (m.t === 'daily') daily = !!m.on;                       // poussé par le hub (réglage de plateforme, pas de gate `editable`)
    else if (m.t === 'lbreset') reset(GID);
  }
  function tick_() { for (const p of players) if (p.member) p.name = p.member.name || p.name || ''; update(); return snapshot(); }

  fullReset();
  return { onJoin, onLeave, onRename, onMessage, tick: tick_, isIdle: editable };
}

export default { meta: { id: GID, name: 'Tanks', min: 2, max: 6, tickHz: TICK_HZ, desc: 'Combat de tanks — murs destructibles, power-ups, mines, FFA/équipes, manches' }, create: createTank };
