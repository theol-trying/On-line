// Jeu SNAKE multijoueur (Slither-like). 1 à 6 joueurs. FFA ou équipes.
// On grandit en mangeant ; toucher un mur ou un serpent (soi ou autre) = mort ; dernier en vie gagne. Solo = entraînement (score).
import { GW, GH } from '../../public/games/snake/shared.js';
import { board, pushHistory, save, markDirty, reset } from '../../leaderboard.js';

const GID = 'snake';
const MAX_SEATS = 6;
const TICK_HZ = 12;
const COUNTDOWN_TICKS = 3 * TICK_HZ;
const DIRS = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
const key = (x, y) => y * GW + x;
const INIT_LEN = 4;            // longueur de départ
const GROW_PER_FOOD = 2;       // segments gagnés par pastille
const FOOD_COUNT = 4;          // pastilles présentes en permanence
const TEAM_COUNT = { ffa: 0, '2v2': 2, '2v2v2': 3, '3v3': 2 };
const numTeamsFor = (m, N) => (m === 'ffa' ? N : TEAM_COUNT[m]);
function validModes(N) { const v = ['ffa']; if (N === 4) v.push('2v2'); if (N === 6) v.push('2v2v2', '3v3'); return v; }

// compression d'un chemin de cellules en sommets (mêmes que Tron) : on ne garde que les points de virage
function corners(cells) {
  const n = cells.length; if (n === 0) return [];
  if (n <= 2) return cells.map(c => [c.x, c.y]);
  const out = [[cells[0].x, cells[0].y]];
  for (let i = 1; i < n - 1; i++) {
    const ax = cells[i].x - cells[i - 1].x, ay = cells[i].y - cells[i - 1].y;
    const bx = cells[i + 1].x - cells[i].x, by = cells[i + 1].y - cells[i].y;
    if (ax !== bx || ay !== by) out.push([cells[i].x, cells[i].y]);
  }
  out.push([cells[n - 1].x, cells[n - 1].y]);
  return out;
}

export function createSnake(room) {
  let players, food, gameState, tick, round, countdownUntil, winner, fx, mode, nteams, nParts, deaths, endTick;
  let seatByMid = {};

  function lbEntry(name) {
    const b = board(GID);
    return b[name] || (b[name] = { name, games: 0, wins: 0, kills: 0, deaths: 0, survSum: 0, bestSurvivalSec: 0, bestScore: 0 });
  }
  function recordRound() {
    if (nParts < 2) return;                         // le solo ne compte pas
    for (const p of players) {
      if (!p.playing || !p.name) continue;
      const e = lbEntry(p.name); e.games++;
      if (winner >= 0 && p.team === winner) e.wins++;
      e.kills += p.kills;
      const surv = (p.elimTick >= 0 ? p.elimTick : endTick) / TICK_HZ;
      e.survSum += surv; if (surv > e.bestSurvivalSec) e.bestSurvivalSec = surv;
      if (p.score > e.bestScore) e.bestScore = p.score;
      if (p.elimTick >= 0) e.deaths++;
    }
    const champ = winner >= 0 ? players.find(p => p.playing && p.team === winner) : null;
    pushHistory(GID, { when: Date.now(), mode, preset: 'snake',
      winner: champ ? (nteams < nParts ? 'Équipe ' + 'ABC'[winner] : (champ.name || ('P' + (champ.seat + 1)))) : 'Égalité',
      durationSec: Math.round(endTick / TICK_HZ), nParts });
    save(); markDirty(GID);
  }

  function makePlayers() {
    return Array.from({ length: MAX_SEATS }, (_, seat) => ({
      seat, member: null, mid: null, name: '', team: 0, alive: false, playing: false,
      dir: DIRS.right, pendingDir: null, cells: [], grow: 0, score: 0,
      kills: 0, place: 0, elimTick: -1,
    }));
  }
  function fullReset() {
    players = makePlayers(); food = [];
    gameState = 'lobby'; tick = 0; round = 0; winner = null; fx = [];
    mode = 'ffa'; nteams = 0; nParts = 0; deaths = 0; endTick = 0; seatByMid = {};
  }

  const connectedCount = () => players.filter(p => p.member).length;
  const partCount = () => connectedCount();
  const canStart = () => connectedCount() >= 1;
  const editable = () => gameState === 'lobby' || gameState === 'over';
  const seatOf = member => { for (const p of players) if (p.member === member) return p.seat; return -1; };
  const aliveCount = () => players.filter(p => p.alive).length;
  const aliveTeams = () => new Set(players.filter(p => p.alive).map(p => p.team));
  const head = p => p.cells[p.cells.length - 1];

  const foodAt = (x, y) => food.some(f => f.x === x && f.y === y);
  function removeFood(x, y) { for (let i = food.length - 1; i >= 0; i--) if (food[i].x === x && food[i].y === y) food.splice(i, 1); }
  function occupiedBySnake(x, y) { for (const p of players) if (p.alive) for (const c of p.cells) if (c.x === x && c.y === y) return true; return false; }
  function replenishFood() {
    let guard = 0;
    while (food.length < FOOD_COUNT && guard++ < FOOD_COUNT) {
      let placed = false;
      for (let tries = 0; tries < 60; tries++) {
        const x = Math.floor(Math.random() * GW), y = Math.floor(Math.random() * GH);
        if (occupiedBySnake(x, y) || foodAt(x, y)) continue;
        food.push({ x, y }); placed = true; break;
      }
      if (!placed) break;
    }
  }

  function spawnPlayers(parts) {
    food = [];
    const cx = GW / 2, cy = GH / 2, R = Math.min(GW, GH) * 0.3, N = parts.length;
    parts.forEach((p, i) => {
      const ang = i * 2 * Math.PI / N;
      let hx = Math.round(cx + R * Math.cos(ang));
      let hy = Math.round(cy + R * Math.sin(ang));
      hx = Math.max(INIT_LEN, Math.min(GW - 1 - INIT_LEN, hx));
      hy = Math.max(INIT_LEN, Math.min(GH - 1 - INIT_LEN, hy));
      const dx = cx - hx, dy = cy - hy;
      const dir = Math.abs(dx) >= Math.abs(dy) ? { x: Math.sign(dx) || 1, y: 0 } : { x: 0, y: Math.sign(dy) || 1 };
      p.dir = dir; p.pendingDir = null; p.cells = [];
      for (let k = 0; k < INIT_LEN; k++) p.cells.push({ x: hx - dir.x * (INIT_LEN - 1 - k), y: hy - dir.y * (INIT_LEN - 1 - k) });
      p.alive = true; p.grow = 0; p.score = 0; p.kills = 0; p.place = 0; p.elimTick = -1;
    });
  }

  function startGame() {
    if (!editable() || !canStart()) return;
    for (const p of players) p.playing = false;
    const parts = players.filter(p => p.member);
    if (parts.length < 1) return;
    const N = parts.length;
    if (!validModes(N).includes(mode)) mode = 'ffa';
    nteams = numTeamsFor(mode, N);
    parts.forEach((p, i) => { p.playing = true; p.team = i % nteams; });
    nParts = N; deaths = 0; endTick = 0; winner = null; fx = [];
    spawnPlayers(parts); replenishFood();
    round++; tick = 0; countdownUntil = COUNTDOWN_TICKS; gameState = 'countdown';
  }
  function endRound() {
    gameState = 'over'; endTick = tick;
    const s = aliveTeams();
    winner = s.size === 1 ? [...s][0] : -1;
    players.forEach(p => { if (p.playing && p.alive) p.place = 1; });
    recordRound();
  }
  function backToLobby() {            // abandon : retour au lobby en pleine partie
    if (gameState !== 'play' && gameState !== 'countdown' && gameState !== 'paused') return;
    gameState = 'lobby'; winner = null; fx = []; food = [];
    for (const p of players) { p.playing = false; p.alive = false; p.cells = []; p.pendingDir = null; }
  }

  function killSnake(p, killer, x, y) {
    p.alive = false; p.elimTick = tick; p.place = nParts - deaths; deaths++;
    if (killer >= 0 && players[killer] && killer !== p.seat) players[killer].kills++;
    fx.push({ type: 'crash', seat: p.seat, x, y, by: killer });
  }

  function update() {
    fx = [];
    if (gameState === 'countdown') { tick++; if (tick >= countdownUntil) { gameState = 'play'; tick = 0; } return; }
    if (gameState !== 'play') return;
    tick++;
    const alive = players.filter(p => p.alive);
    // applique la direction en attente (interdit le demi-tour)
    for (const p of alive) { const pd = p.pendingDir; if (pd && !(pd.x === -p.dir.x && pd.y === -p.dir.y)) p.dir = pd; p.pendingDir = null; }
    // têtes suivantes + croissance prévue (mange une pastille ou reste à digérer)
    const nh = new Map(), willGrow = new Map();
    for (const p of alive) { const h = head(p), n = { x: h.x + p.dir.x, y: h.y + p.dir.y }; nh.set(p, n); willGrow.set(p, p.grow > 0 || foodAt(n.x, n.y)); }
    // cellules solides APRÈS mouvement (corps moins la queue libérée si pas de croissance) + propriétaire
    const solid = new Map();
    for (const p of alive) { const body = p.cells, start = willGrow.get(p) ? 0 : 1; for (let i = start; i < body.length; i++) solid.set(key(body[i].x, body[i].y), p.seat); }
    // collisions (résolution simultanée)
    const doomed = new Set(), killerOf = new Map();
    const tgt = new Map();
    for (const p of alive) { const n = nh.get(p), k = key(n.x, n.y); (tgt.get(k) || tgt.set(k, []).get(k)).push(p); }
    for (const [, list] of tgt) if (list.length > 1) for (const p of list) doomed.add(p);          // choc frontal (même case) : tous meurent
    for (const p of alive) {
      if (doomed.has(p)) continue;
      const n = nh.get(p);
      if (n.x < 0 || n.y < 0 || n.x >= GW || n.y >= GH) { doomed.add(p); killerOf.set(p, -1); continue; } // mur
      const o = solid.get(key(n.x, n.y));
      if (o !== undefined) { doomed.add(p); killerOf.set(p, o !== p.seat ? o : -1); }                // serpent (soi ou autre)
    }
    for (const p of doomed) { const n = nh.get(p); killSnake(p, killerOf.has(p) ? killerOf.get(p) : -1, n.x, n.y); }
    // déplacement des survivants
    for (const p of alive) {
      if (doomed.has(p)) continue;
      const n = nh.get(p);
      p.cells.push(n);
      if (foodAt(n.x, n.y)) { removeFood(n.x, n.y); p.grow += GROW_PER_FOOD; p.score++; fx.push({ type: 'eat', x: n.x, y: n.y, seat: p.seat }); }
      if (p.grow > 0) p.grow--; else p.cells.shift();
    }
    replenishFood();
    if (nParts >= 2) { if (aliveTeams().size <= 1) endRound(); } else if (aliveCount() === 0) endRound();
  }

  function snapshot() {
    return {
      gs: gameState, count: gameState === 'countdown' ? Math.max(0, Math.ceil((countdownUntil - tick) / TICK_HZ)) : 0,
      round, winner, fx, connected: connectedCount(), botCount: 0, maxBots: 0, mode, nteams,
      food: food.map(f => ({ x: f.x, y: f.y })),
      stats: gameState === 'over' ? { durationSec: Math.round(endTick / TICK_HZ), nParts, solo: nParts < 2 } : null,
      players: players.map(p => ({
        seat: p.seat, name: p.name, team: p.team, connected: !!p.member, playing: p.playing, alive: p.alive,
        head: p.cells.length ? { x: head(p).x, y: head(p).y } : { x: 0, y: 0 },
        path: corners(p.cells), len: p.cells.length, score: p.score,
        kills: p.kills, place: p.place, elimTick: p.elimTick,
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
    const p = players[seat]; p.member = null; p.pendingDir = null;
    if (gameState === 'play' || gameState === 'countdown' || gameState === 'paused') {
      if (p.alive) { p.alive = false; p.elimTick = tick; p.place = nParts - deaths; deaths++; }
      if (connectedCount() === 0) fullReset();
      else if (gameState === 'play') { if (nParts >= 2 ? aliveTeams().size <= 1 : aliveCount() === 0) endRound(); }
    } else if (connectedCount() === 0) fullReset();
  }
  function onRename(member) { const s = seatOf(member); if (s >= 0) players[s].name = member.name || ''; }
  function onMessage(member, m) {
    if (!m || typeof m !== 'object') return;
    const seat = seatOf(member); const p = seat >= 0 ? players[seat] : null;
    if (m.t === 'dir' && p && p.alive && DIRS[m.d]) p.pendingDir = DIRS[m.d];
    else if (m.t === 'start') startGame();
    else if (m.t === 'pause') { if (gameState === 'play') gameState = 'paused'; else if (gameState === 'paused') gameState = 'play'; }
    else if (m.t === 'abort') backToLobby();
    else if (m.t === 'mode') { if (editable()) { const v = validModes(partCount()); mode = v[(v.indexOf(mode) + 1) % v.length] || 'ffa'; } }
    else if (m.t === 'lbreset') reset(GID);
  }
  function tick_() { for (const p of players) if (p.member) p.name = p.member.name || p.name || ''; update(); return snapshot(); }

  fullReset();
  return { onJoin, onLeave, onRename, onMessage, tick: tick_, isIdle: editable };
}

export default { meta: { id: GID, name: 'Snake', min: 1, max: 6, tickHz: TICK_HZ, desc: 'Serpents multijoueur — mange, grandis, évite murs et serpents ; dernier en vie gagne' }, create: createSnake };
