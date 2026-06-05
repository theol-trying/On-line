// Jeu TANK COMBAT v2 — arènes à murs destructibles, power-ups, mines, collision tank-tank, FFA/équipes, mode manches.
import { ARENA, TANK_R, SHELL_R, BLK, G } from '../../public/games/tank/shared.js';
import { board, pushHistory, save, markDirty, reset } from '../../leaderboard.js';

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
const PU_TYPES = ['rapid', 'triple', 'shield', 'speed', 'pierce', 'mine'];
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
function genSolidSet(style, density, safe) {
  const cache = new Map();
  const canon = (x, y) => {
    if (style === 1) return x + ',' + y;                                  // aléatoire : chaque case décidée seule
    if (style === 0) { const bx = G - 1 - x, by = G - 1 - y; return (y < by || (y === by && x <= bx)) ? (x + ',' + y) : (bx + ',' + by); } // 180°
    return Math.min(x, G - 1 - x) + ',' + Math.min(y, G - 1 - y);         // 4 coins
  };
  const want = (x, y) => { const k = canon(x, y); if (!cache.has(k)) cache.set(k, Math.random() < density); return cache.get(k); };
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
  let arenaStyle, winTarget, matchWon, matchWinner, ff;   // ff = tir allié autorisé
  let seatByMid = {};

  function lbEntry(name) {
    const b = board(GID);
    return b[name] || (b[name] = { name, games: 0, wins: 0, kills: 0, dmg: 0, deaths: 0, survSum: 0, bestSurvivalSec: 0 });
  }
  function recordRound() {
    for (const p of players) {
      if (!p.playing || !p.name) continue;
      const e = lbEntry(p.name);
      e.games++;
      if (winner >= 0 && p.team === winner) e.wins++;
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
      seat, member: null, mid: null, name: '', team: 0, alive: false, playing: false,
      x: ARENA / 2, y: ARENA / 2, angle: 0, lives: LIVES, cool: 0, invulnUntil: 0, spawn: { x: 0, y: 0, angle: 0 },
      inputs: { left: false, right: false, fwd: false, back: false, fire: false },
      rapidUntil: 0, tripleUntil: 0, speedUntil: 0, pierceUntil: 0, shield: 0, mineN: 0,
      kills: 0, dmg: 0, place: 0, elimTick: -1, score: 0,
    }));
  }
  function fullReset() {
    players = makePlayers(); shells = []; mines = []; pickups = []; blocks = new Array(G * G).fill(0);
    gameState = 'lobby'; tick = 0; round = 0; winner = null; fx = []; mode = 'ffa'; nteams = 0; nParts = 0; deaths = 0; endTick = 0;
    arenaStyle = 0; winTarget = 1; matchWon = false; matchWinner = null; ff = false; seatByMid = {};
  }

  const connectedCount = () => players.filter(p => p.member).length;
  const partCount = () => connectedCount();
  const canStart = () => connectedCount() >= 2;
  const editable = () => gameState === 'lobby' || gameState === 'over';
  const seatOf = member => { for (const p of players) if (p.member === member) return p.seat; return -1; };
  const active = p => p.playing && p.alive;
  const aliveTeams = () => new Set(players.filter(active).map(p => p.team));

  function buildArena(parts) {
    const safe = new Set();
    parts.forEach((p, i) => { const [sx, sy] = SPAWNS[i]; [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => safe.add(bidx(sx + dx, sy + dy))); });
    const spawns = parts.map((p, i) => SPAWNS[i]);
    let solid = null;
    for (let a = 0; a < 24; a++) { const s = genSolidSet(arenaStyle, 0.14, safe); if (tankConnected(s, spawns)) { solid = s; break; } } // murs procéduraux + connectivité garantie
    if (!solid) { solid = new Set(); for (let y = 1; y < G - 1; y++) for (let x = 1; x < G - 1; x++) if (x % 2 === 0 && y % 2 === 0 && !safe.has(bidx(x, y))) solid.add(bidx(x, y)); } // repli : piliers (toujours connecté)
    blocks = new Array(G * G).fill(0);
    for (const k of solid) blocks[k] = 1;
    for (let i = 0; i < blocks.length; i++) { const gx = i % G, gy = (i / G) | 0; if (gx > 0 && gy > 0 && gx < G - 1 && gy < G - 1 && blocks[i] === 0 && !safe.has(i) && Math.random() < 0.42) blocks[i] = 2; }
  }

  function spawnFor(i) { const [gx, gy] = SPAWNS[i]; const x = (gx + 0.5) * BLK, y = (gy + 0.5) * BLK; return { x, y, angle: Math.atan2(ARENA / 2 - y, ARENA / 2 - x) }; }
  function placeAtSpawn(p) { p.x = p.spawn.x; p.y = p.spawn.y; p.angle = p.spawn.angle; p.invulnUntil = tick + INVULN; }

  function startGame() {
    if (!editable() || !canStart()) return;
    for (const p of players) p.playing = false;
    const parts = players.filter(p => p.member);
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
      p.rapidUntil = 0; p.tripleUntil = 0; p.speedUntil = 0; p.pierceUntil = 0; p.shield = 0; p.mineN = 0;
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
    if (p.inputs.left) p.angle -= ROT;
    if (p.inputs.right) p.angle += ROT;
    const base = p.speedUntil > tick ? TANK_SPD * SPEED_MUL : TANK_SPD;
    const s = p.inputs.fwd ? base : p.inputs.back ? -base * REV : 0;
    if (!s) return;
    const dx = Math.cos(p.angle) * s, dy = Math.sin(p.angle) * s;
    let bx = blockedTank(p.x + dx, p.y, p);
    if (!bx) p.x += dx; else if (bx !== true && bx.invulnUntil <= tick) { const nx = bx.x + dx * 0.5; if (!blockedTank(nx, bx.y, bx)) { bx.x = nx; p.x += dx * 0.5; } } // poussée légère
    let by = blockedTank(p.x, p.y + dy, p);
    if (!by) p.y += dy; else if (by !== true && by.invulnUntil <= tick) { const ny = by.y + dy * 0.5; if (!blockedTank(by.x, ny, by)) { by.y = ny; p.y += dy * 0.5; } }
  }
  function fire(p) {
    if (!p.inputs.fire || tick < p.cool) return;
    if (shells.filter(s => s.o === p.seat).length >= MAX_SHELLS) return;
    p.cool = tick + (p.rapidUntil > tick ? FIRE_COOL / 2 : FIRE_COOL);
    const angs = p.tripleUntil > tick ? [-0.18, 0, 0.18] : [0];
    for (const da of angs) {
      const a = p.angle + da, mx = p.x + Math.cos(a) * (TANK_R + SHELL_R + 1), my = p.y + Math.sin(a) * (TANK_R + SHELL_R + 1);
      shells.push({ x: mx, y: my, vx: Math.cos(a) * SHELL_SPD, vy: Math.sin(a) * SHELL_SPD, o: p.seat, team: p.team, bounces: 0, life: SHELL_LIFE, pierce: p.pierceUntil > tick });
    }
    fx.push({ type: 'shot', x: p.x, y: p.y, seat: p.seat });
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
    for (const p of players) if (active(p)) { moveTank(p); fire(p); }
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
      const sh = shells[i]; sh.life--; sh.x += sh.vx; sh.y += sh.vy;
      if (sh.x < SHELL_R) { sh.x = SHELL_R; sh.vx = -sh.vx; sh.bounces++; } else if (sh.x > ARENA - SHELL_R) { sh.x = ARENA - SHELL_R; sh.vx = -sh.vx; sh.bounces++; }
      if (sh.y < SHELL_R) { sh.y = SHELL_R; sh.vy = -sh.vy; sh.bounces++; } else if (sh.y > ARENA - SHELL_R) { sh.y = ARENA - SHELL_R; sh.vy = -sh.vy; sh.bounces++; }
      const r = shellHitsCell(sh);
      if (r === 'die' || sh.life <= 0 || sh.bounces > MAX_BOUNCE) { shells.splice(i, 1); continue; }
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
    return {
      gs: gameState, count: gameState === 'countdown' ? Math.max(0, Math.ceil((countdownUntil - tick) / TICK_HZ)) : 0,
      round, winner, fx, connected: connectedCount(), botCount: 0, maxBots: 0, mode, nteams, winTarget, gen: arenaStyle, ff,
      grid: blocks.join(''),
      shells: shells.map(s => ({ x: Math.round(s.x), y: Math.round(s.y), o: s.o, p: !!s.pierce })),
      mines: mines.map(m => ({ x: m.x, y: m.y, o: m.owner, armed: tick >= m.arm })),
      pickups: pickups.map(k => ({ x: k.x, y: k.y, t: k.type })),
      stats: gameState === 'over' ? { durationSec: Math.round(endTick / TICK_HZ), nParts, match: matchWon } : null,
      players: players.map(p => ({
        seat: p.seat, name: p.name, team: p.team, connected: !!p.member, playing: p.playing, alive: p.alive,
        x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10, angle: Math.round(p.angle * 100) / 100,
        lives: Math.max(0, p.lives), score: p.score, invuln: p.invulnUntil > tick,
        shield: p.shield, rapid: p.rapidUntil > tick, triple: p.tripleUntil > tick, speed: p.speedUntil > tick, pierce: p.pierceUntil > tick, mineN: p.mineN,
        kills: p.kills, dmg: p.dmg, place: p.place, elimTick: p.elimTick,
      })),
    };
  }

  /* ---- contrat plateforme ---- */
  function onJoin(member) {
    const cur = seatOf(member); if (cur >= 0) return { role: 'player', seat: cur, hello: { t: 'welcome', seat: cur } }; // déjà assis (reconnexion within grace)
    let seat = -1;
    const rid = seatByMid[member.id];
    if (rid != null && players[rid] && !players[rid].member) seat = rid;
    if (seat < 0) { const free = players.find(p => !p.member); if (free) seat = free.seat; }
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
    else if (m.t === 'arena') { if (editable()) arenaStyle = (arenaStyle + 1) % 3; }
    else if (m.t === 'wintarget') { if (editable()) winTarget = WIN_TARGETS[(WIN_TARGETS.indexOf(winTarget) + 1) % WIN_TARGETS.length]; }
    else if (m.t === 'ff') { if (editable()) ff = !ff; }
    else if (m.t === 'lbreset') reset(GID);
  }
  function tick_() { for (const p of players) if (p.member) p.name = p.member.name || p.name || ''; update(); return snapshot(); }

  fullReset();
  return { onJoin, onLeave, onRename, onMessage, tick: tick_, isIdle: editable };
}

export default { meta: { id: GID, name: 'Tanks', min: 2, max: 6, tickHz: TICK_HZ, desc: 'Combat de tanks — murs destructibles, power-ups, mines, FFA/équipes, manches' }, create: createTank };
