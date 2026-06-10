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
const FOOD_COUNT = 4;          // pastilles présentes en permanence (mode Survie)
const RUSH_FOOD = 12;          // food-rush : beaucoup plus de pastilles
const RUSH_TARGET = 20;        // food-rush : premier à ce score gagne
const GHOST_TICKS = 5 * TICK_HZ, SHRINK_AMT = 4, ROCK_COUNT = 16;
const VARIANT_NAMES = ['Classique', 'Murs traversants', 'Obstacles'];   // 0 / 1 / 2
const TEAM_COUNT = { ffa: 0, '2v2': 2, '2v2v2': 3, '3v3': 2 };
const numTeamsFor = (m, N) => (m === 'ffa' ? N : TEAM_COUNT[m]);
function validModes(N) { const v = ['ffa']; if (N === 4) v.push('2v2'); if (N === 6) v.push('2v2v2', '3v3'); return v; }

// compression d'un chemin de cellules en sommets (mêmes que Tron) : on ne garde que les points de virage
function compressSeg(cells) {
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
// variante murs traversants : on coupe le chemin à chaque wrap (saut > 1 case) et on sépare les segments par null
// (sinon le client trace une ligne droite d'un bord à l'autre = « queue qui traverse l'écran »)
function corners(cells) {
  const segs = []; let cur = [];
  for (const c of cells) {
    if (cur.length) { const pr = cur[cur.length - 1]; if (Math.abs(c.x - pr.x) > 1 || Math.abs(c.y - pr.y) > 1) { segs.push(cur); cur = []; } }
    cur.push(c);
  }
  if (cur.length) segs.push(cur);
  const out = [];
  segs.forEach((s, k) => { if (k) out.push(null); out.push(...compressSeg(s)); });
  return out;
}

export function createSnake(room) {
  let players, food, gameState, tick, round, countdownUntil, winner, fx, mode, nteams, nParts, deaths, endTick, variant, rocks, rush, botCount;
  let seatByMid = {};

  function lbEntry(name) {
    const b = board(GID);
    return b[name] || (b[name] = { name, games: 0, wins: 0, kills: 0, deaths: 0, survSum: 0, bestSurvivalSec: 0, bestScore: 0 });
  }
  function recordRound() {
    if (nParts < 2) return;                         // le solo ne compte pas
    for (const p of players) {
      if (!p.playing || !p.name || p.bot) continue;   // les bots n'entrent pas au classement
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
      seat, member: null, mid: null, name: '', team: 0, alive: false, playing: false, bot: false,
      dir: DIRS.right, pendingDir: null, cells: [], grow: 0, score: 0, ghostUntil: 0,
      kills: 0, place: 0, elimTick: -1,
    }));
  }
  function fullReset() {
    players = makePlayers(); food = []; rocks = new Set();
    gameState = 'lobby'; tick = 0; round = 0; winner = null; fx = [];
    mode = 'ffa'; nteams = 0; nParts = 0; deaths = 0; endTick = 0; variant = 0; rush = false; botCount = 0; seatByMid = {};
  }

  const connectedCount = () => players.filter(p => p.member).length;
  const maxBots = () => MAX_SEATS - connectedCount();
  const partCount = () => Math.min(connectedCount() + botCount, MAX_SEATS);
  const canStart = () => connectedCount() >= 1;
  const editable = () => gameState === 'lobby' || gameState === 'over';
  const seatOf = member => { for (const p of players) if (p.member === member) return p.seat; return -1; };
  const aliveCount = () => players.filter(p => p.alive).length;
  const aliveTeams = () => new Set(players.filter(p => p.alive).map(p => p.team));
  const head = p => p.cells[p.cells.length - 1];

  const foodAt = (x, y) => food.some(f => f.x === x && f.y === y);
  const foodTypeAt = (x, y) => { const f = food.find(f => f.x === x && f.y === y); return f ? (f.t || 'apple') : 'apple'; };
  function removeFood(x, y) { for (let i = food.length - 1; i >= 0; i--) if (food[i].x === x && food[i].y === y) food.splice(i, 1); }
  function occupiedBySnake(x, y) { for (const p of players) if (p.alive) for (const c of p.cells) if (c.x === x && c.y === y) return true; return false; }
  const cellFree = (x, y) => !occupiedBySnake(x, y) && !foodAt(x, y) && !rocks.has(key(x, y));
  function pickFoodType() { const r = Math.random(); return r < 0.08 ? 'gold' : r < 0.13 ? 'shrink' : r < 0.18 ? 'ghost' : 'apple'; }
  function replenishFood() {
    const target = rush ? RUSH_FOOD : FOOD_COUNT;
    let guard = 0;
    while (food.length < target && guard++ < target) {
      let placed = false;
      for (let tries = 0; tries < 60; tries++) {
        const x = Math.floor(Math.random() * GW), y = Math.floor(Math.random() * GH);
        if (!cellFree(x, y)) continue;
        food.push({ x, y, t: pickFoodType() }); placed = true; break;
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
      p.alive = true; p.grow = 0; p.score = 0; p.kills = 0; p.place = 0; p.elimTick = -1; p.ghostUntil = 0;
    });
  }
  function placeRocks() {                            // variante Obstacles : rochers loin des têtes
    rocks = new Set();
    const heads = players.filter(p => p.playing).map(p => head(p));
    let placed = 0, guard = 0;
    while (placed < ROCK_COUNT && guard++ < 400) {
      const x = 1 + Math.floor(Math.random() * (GW - 2)), y = 1 + Math.floor(Math.random() * (GH - 2)), k = key(x, y);
      if (rocks.has(k) || occupiedBySnake(x, y)) continue;
      let near = false; for (const h of heads) if (Math.abs(h.x - x) + Math.abs(h.y - y) < 4) { near = true; break; }
      if (!near) { rocks.add(k); placed++; }
    }
  }

  function startGame() {
    if (!editable() || !canStart()) return;
    for (const p of players) { p.playing = false; p.bot = false; }
    if (botCount > maxBots()) botCount = maxBots();
    const parts = players.filter(p => p.member);
    let bots = botCount;
    for (const p of players) { if (bots <= 0) break; if (!p.member) { p.bot = true; parts.push(p); bots--; } } // complète avec des bots
    parts.forEach((p, i) => { if (p.bot) p.name = '🤖 Bot ' + (i + 1); });
    if (parts.length < 1) return;
    const N = parts.length;
    if (!validModes(N).includes(mode)) mode = 'ffa';
    nteams = numTeamsFor(mode, N);
    parts.forEach((p, i) => { p.playing = true; p.team = i % nteams; });
    nParts = N; deaths = 0; endTick = 0; winner = null; fx = [];
    spawnPlayers(parts); rocks = new Set(); if (variant === 2) placeRocks(); replenishFood();
    round++; tick = 0; countdownUntil = COUNTDOWN_TICKS; gameState = 'countdown';
  }
  const bestScoreTeam = () => { let champ = null; for (const p of players) if (p.playing) { if (!champ || p.score > champ.score) champ = p; } return champ ? champ.team : -1; };
  function endRound(forced) {
    gameState = 'over'; endTick = tick;
    if (forced != null) winner = forced;
    else { const s = aliveTeams(); winner = s.size === 1 ? [...s][0] : -1; }
    if (rush) { const order = players.filter(p => p.playing).sort((a, b) => ((b.alive ? 1 : 0) - (a.alive ? 1 : 0)) || (b.score - a.score)); order.forEach((p, i) => p.place = i + 1); } // food-rush : classement au score
    else players.forEach(p => { if (p.playing && p.alive) p.place = 1; });
    recordRound();
  }
  function backToLobby() {            // abandon : retour au lobby en pleine partie
    if (gameState !== 'play' && gameState !== 'countdown' && gameState !== 'paused') return;
    gameState = 'lobby'; winner = null; fx = []; food = []; rocks = new Set();
    for (const p of players) { p.playing = false; p.alive = false; p.cells = []; p.pendingDir = null; }
  }

  function botSafe(x, y) {                          // IA : la case (avec wrap éventuel) est-elle praticable ?
    let nx = x, ny = y;
    if (variant === 1) { nx = (nx + GW) % GW; ny = (ny + GH) % GH; }
    else if (nx < 0 || ny < 0 || nx >= GW || ny >= GH) return null;
    if (rocks.has(key(nx, ny)) || occupiedBySnake(nx, ny)) return null;
    return { x: nx, y: ny };
  }
  function botThink(p) {                            // IA : éviter les obstacles, anticiper à 2 cases, viser la nourriture proche
    const h = head(p), d = p.dir;
    const cands = [d, { x: d.y, y: -d.x }, { x: -d.y, y: d.x }];
    let best = null, bestScore = -Infinity;
    for (const c of cands) {
      const n = botSafe(h.x + c.x, h.y + c.y);
      if (!n) continue;
      let sc = c === d ? 0.5 : 0;                                       // inertie : préfère tout droit
      if (!botSafe(n.x + c.x, n.y + c.y)) sc -= 2;                      // cul-de-sac probable à 2 cases
      let fd = Infinity;
      for (const f of food) { const dist = Math.abs(f.x - n.x) + Math.abs(f.y - n.y); if (dist < fd) fd = dist; }
      if (fd < Infinity) sc += 8 / (1 + fd);                            // attiré par la nourriture
      sc += Math.random() * 0.3;
      if (sc > bestScore) { bestScore = sc; best = c; }
    }
    if (best && best !== d) p.pendingDir = best;
  }

  function killSnake(p, killer, x, y) {
    p.alive = false; p.elimTick = tick; p.place = nParts - deaths; deaths++;
    if (killer >= 0 && players[killer] && killer !== p.seat) players[killer].kills++;
    fx.push({ type: 'crash', seat: p.seat, x, y, by: killer });
    let dropped = 0;                                  // le corps devient de la nourriture (slither-like), 1 cellule sur 2, plafonné
    for (let i = p.cells.length - 1; i >= 0 && dropped < 15; i -= 2) { const c = p.cells[i]; if (cellFree(c.x, c.y)) { food.push({ x: c.x, y: c.y, t: 'apple' }); dropped++; } }
  }

  function update() {
    fx = [];
    if (gameState === 'countdown') { tick++; if (tick >= countdownUntil) { gameState = 'play'; tick = 0; } return; }
    if (gameState !== 'play') return;
    tick++;
    const alive = players.filter(p => p.alive);
    for (const p of alive) if (p.bot) botThink(p);
    // applique la direction en attente (interdit le demi-tour)
    for (const p of alive) { const pd = p.pendingDir; if (pd && !(pd.x === -p.dir.x && pd.y === -p.dir.y)) p.dir = pd; p.pendingDir = null; }
    // têtes suivantes + croissance prévue (mange une pastille ou reste à digérer)
    const nh = new Map(), willGrow = new Map();
    for (const p of alive) { const h = head(p); let nx = h.x + p.dir.x, ny = h.y + p.dir.y; if (variant === 1) { nx = (nx + GW) % GW; ny = (ny + GH) % GH; } const n = { x: nx, y: ny }; nh.set(p, n); willGrow.set(p, p.grow > 0 || foodAt(n.x, n.y)); }
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
      if (variant !== 1 && (n.x < 0 || n.y < 0 || n.x >= GW || n.y >= GH)) { doomed.add(p); killerOf.set(p, -1); continue; } // mur (sauf murs traversants)
      if (rocks.has(key(n.x, n.y))) { doomed.add(p); killerOf.set(p, -1); continue; }                // rocher (variante Obstacles)
      const o = solid.get(key(n.x, n.y));
      if (o !== undefined && !(p.ghostUntil > tick)) { doomed.add(p); killerOf.set(p, o !== p.seat ? o : -1); } // serpent (sauf fantôme)
    }
    for (const p of doomed) { const n = nh.get(p); killSnake(p, killerOf.has(p) ? killerOf.get(p) : -1, n.x, n.y); }
    // déplacement des survivants
    for (const p of alive) {
      if (doomed.has(p)) continue;
      const n = nh.get(p);
      p.cells.push(n);
      if (foodAt(n.x, n.y)) {
        const ft = foodTypeAt(n.x, n.y); removeFood(n.x, n.y);
        if (ft === 'gold') { p.grow += GROW_PER_FOOD; p.score += 3; }                                  // pomme dorée : gros score
        else if (ft === 'shrink') { p.score += 1; const cut = Math.max(0, Math.min(SHRINK_AMT, p.cells.length - 3)); for (let s = 0; s < cut; s++) p.cells.shift(); } // champignon : raccourcit
        else if (ft === 'ghost') { p.grow += GROW_PER_FOOD; p.score += 1; p.ghostUntil = tick + GHOST_TICKS; } // fantôme : traverse les corps un moment
        else { p.grow += GROW_PER_FOOD; p.score++; }
        fx.push({ type: 'eat', x: n.x, y: n.y, seat: p.seat, ft });
      }
      if (p.grow > 0) p.grow--; else p.cells.shift();
    }
    replenishFood();
    if (rush) {                                       // food-rush : premier à RUSH_TARGET points gagne tout de suite
      let champ = null; for (const p of players) if (p.playing && p.score >= RUSH_TARGET) { if (!champ || p.score > champ.score) champ = p; }
      if (champ) { endRound(champ.team); return; }
    }
    if (nParts >= 2) { if (aliveTeams().size <= 1) endRound(rush ? bestScoreTeam() : undefined); }
    else if (aliveCount() === 0) endRound(rush ? bestScoreTeam() : undefined);
  }

  function snapshot() {
    return {
      gs: gameState, count: gameState === 'countdown' ? Math.max(0, Math.ceil((countdownUntil - tick) / TICK_HZ)) : 0,
      round, winner, fx, connected: connectedCount(), botCount, maxBots: maxBots(), mode, nteams, variant, rush, rushTarget: RUSH_TARGET, rocks: [...rocks],
      food: food.map(f => ({ x: f.x, y: f.y, t: f.t || 'apple' })),
      stats: gameState === 'over' ? { durationSec: Math.round(endTick / TICK_HZ), nParts, solo: nParts < 2 } : null,
      players: players.map(p => ({
        seat: p.seat, name: p.name, team: p.team, connected: !!p.member, playing: p.playing, alive: p.alive, bot: !!p.bot,
        head: p.cells.length ? { x: head(p).x, y: head(p).y } : { x: 0, y: 0 },
        path: corners(p.cells), len: p.cells.length, score: p.score, ghost: p.ghostUntil > tick,
        kills: p.kills, place: p.place, elimTick: p.elimTick,
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
    const p = players[seat]; p.member = member; p.mid = member.id; p.name = member.name || ''; seatByMid[member.id] = seat;
    return { role: 'player', seat, hello: { t: 'welcome', seat } };
  }
  function onLeave(member) {
    const seat = seatOf(member); if (seat < 0) return;
    const p = players[seat]; p.member = null; p.pendingDir = null;
    if (gameState === 'play' || gameState === 'countdown' || gameState === 'paused') {
      if (p.alive) { p.alive = false; p.elimTick = tick; p.place = nParts - deaths; deaths++; }
      if (connectedCount() === 0) fullReset();
      else if (gameState === 'play') { if (nParts >= 2 ? aliveTeams().size <= 1 : aliveCount() === 0) endRound(rush ? bestScoreTeam() : undefined); }   // même règle de gagnant qu'en update (food-rush = meilleur score)
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
    else if (m.t === 'variant') { if (editable()) variant = (variant + 1) % 3; }
    else if (m.t === 'rush') { if (editable()) rush = !rush; }
    else if (m.t === 'bots') { if (editable()) { const mx = maxBots(); botCount = mx <= 0 ? 0 : (botCount + 1) % (mx + 1); } }
    else if (m.t === 'lbreset') reset(GID);
  }
  function tick_() { for (const p of players) if (p.member) p.name = p.member.name || p.name || ''; update(); return snapshot(); }

  fullReset();
  return { onJoin, onLeave, onRename, onMessage, tick: tick_, isIdle: editable };
}

export default { meta: { id: GID, name: 'Snake', min: 1, max: 6, tickHz: TICK_HZ, desc: 'Serpents multijoueur — mange, grandis, évite murs et serpents ; dernier en vie gagne' }, create: createSnake };
