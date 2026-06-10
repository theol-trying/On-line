// Jeu BOMBERMAN v2 — équipes, bonus avancés, malus, mort subite, chaînage. 1 à 6 joueurs.
import { GW, GH, CELL, ARENA } from '../../public/games/bomb/shared.js';
import { board, pushHistory, save, markDirty, reset } from '../../leaderboard.js';

const GID = 'bomb';
const MAX_SEATS = 6;
const TICK_HZ = 30;
const COUNTDOWN_TICKS = 3 * TICK_HZ;
const PR = 13;
const SPD_BASE = 2.0, SPD_STEP = 0.4, SPD_MAX = 3.6, SLOW_MUL = 0.5;
const BOMB_FUSE = 90, BLAST_TIME = 18, FLAME_BASE = 1, MAXB_CAP = 8, POWER_CAP = 8;
const SOFT_PROB = 0.72, PICK_PROB = 0.42, MALUS_RATIO = 0.22;
const DUR = 8 * TICK_HZ, AUTO_EVERY = 18, THROW_DIST = 4, SHIELD_CAP = 1;
const GHOST_DUR = 10 * TICK_HZ;                    // 👻 traverse-murs : temporaire (sinon trop fort)
const SD_START = 65 * TICK_HZ, SD_EVERY = 10;
const DIRS4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const GOOD = ['bomb', 'flame', 'speed', 'kick', 'remote', 'shield', 'ghost', 'throw', 'line'];
const BMDIFF = [{ skip: 0.5, cd: 44 }, { skip: 0.18, cd: 24 }, { skip: 0, cd: 12 }];   // IA : Facile / Normale / Difficile (hésitation, cadence de pose)
const BAD = ['reverse', 'slow', 'auto', 'skull'];
const SKULL_KINDS = ['reverse', 'slow', 'auto'];   // affliction aléatoire infligée par le skull (contagieux)
const TEAM_COUNT = { ffa: 0, '2v2': 2, '2v2v2': 3, '3v3': 2 };
const numTeamsFor = (m, N) => (m === 'ffa' ? N : TEAM_COUNT[m]);
function validModes(N) { const v = ['ffa']; if (N === 4) v.push('2v2'); if (N === 6) v.push('2v2v2', '3v3'); return v; }
const idx = (gx, gy) => gy * GW + gx;
const ccx = c => (c + 0.5) * CELL;
const SPAWNS = [[1, 1], [GW - 2, GH - 2], [GW - 2, 1], [1, GH - 2], [(GW - 1) / 2 | 0, 1], [(GW - 1) / 2 | 0, GH - 2]];
const SD_SPIRAL = (() => { const res = []; let x0 = 1, y0 = 1, x1 = GW - 2, y1 = GH - 2; while (x0 <= x1 && y0 <= y1) { for (let x = x0; x <= x1; x++) res.push([x, y0]); for (let y = y0 + 1; y <= y1; y++) res.push([x1, y]); if (y1 > y0) for (let x = x1 - 1; x >= x0; x--) res.push([x, y1]); if (x1 > x0) for (let y = y1 - 1; y >= y0 + 1; y--) res.push([x0, y]); x0++; y0++; x1--; y1--; } return res; })();
const GEN_NAMES = ['Symétrique', 'Aléatoire', '4 coins'];
// mode revanche : anneau des cases du cadre (sens horaire) où les morts viennent bombarder l'arène
const RING = (() => { const r = []; for (let x = 0; x < GW - 1; x++) r.push([x, 0]); for (let y = 0; y < GH - 1; y++) r.push([GW - 1, y]); for (let x = GW - 1; x > 0; x--) r.push([x, GH - 1]); for (let y = GH - 1; y > 0; y--) r.push([0, y]); return r; })();
const RING_LEN = RING.length, REV_MOVE_EVERY = 5;
// génération procédurale des murs solides (sym180 / aléatoire / 4 coins) avec connectivité garantie
function genSolidSetB(style, density, safe) {
  const cache = new Map();
  const canon = (x, y) => {
    if (style === 1) return x + ',' + y;
    if (style === 0) { const bx = GW - 1 - x, by = GH - 1 - y; return (y < by || (y === by && x <= bx)) ? (x + ',' + y) : (bx + ',' + by); }
    return Math.min(x, GW - 1 - x) + ',' + Math.min(y, GH - 1 - y);
  };
  const want = (x, y) => { const k = canon(x, y); if (!cache.has(k)) cache.set(k, Math.random() < density); return cache.get(k); };
  const s = new Set();
  for (let y = 1; y < GH - 1; y++) for (let x = 1; x < GW - 1; x++) { const k = idx(x, y); if (safe.has(k)) continue; if (want(x, y)) s.add(k); }
  return s;
}
function bombConnected(solid, spawns) {
  const start = idx(spawns[0][0], spawns[0][1]); if (solid.has(start)) return false;
  const seen = new Set([start]); const st = [start]; let cnt = 1, freeTotal = 0;
  for (let y = 1; y < GH - 1; y++) for (let x = 1; x < GW - 1; x++) if (!solid.has(idx(x, y))) freeTotal++;
  while (st.length) { const c = st.pop(), x = c % GW, y = (c / GW) | 0; for (const [dx, dy] of DIRS4) { const nx = x + dx, ny = y + dy; if (nx < 1 || ny < 1 || nx > GW - 2 || ny > GH - 2) continue; const k = idx(nx, ny); if (seen.has(k) || solid.has(k)) continue; seen.add(k); st.push(k); cnt++; } }
  for (const s of spawns) if (!seen.has(idx(s[0], s[1]))) return false;   // tous les spawns reliés
  return cnt >= freeTotal * 0.6;                                          // gros bloc jouable (petites poches tolérées)
}

export function createBomb(room) {
  let players, cells, bombs, blasts, pickups, gameState, tick, round, countdownUntil, winner, fx, mode, nteams, nParts, deaths, endTick, sdIndex, sd, genStyle, ff, warpOf, revenge, botCount, botDiff;
  let lastGrid = '';                                 // dernière grille émise (delta : on n'émet que si changement)
  let seatByMid = {};

  function lbEntry(name) {
    const b = board(GID);
    return b[name] || (b[name] = { name, games: 0, wins: 0, kills: 0, dmg: 0, deaths: 0, survSum: 0, bestSurvivalSec: 0 });
  }
  function recordRound() {
    if (nParts < 2) return;
    for (const p of players) {
      if (!p.playing || !p.name || p.bot) continue;   // les bots n'entrent pas au classement
      const e = lbEntry(p.name); e.games++;
      if (winner >= 0 && p.team === winner) e.wins++;
      e.kills += p.kills; e.dmg += p.kills;
      const surv = (p.elimTick >= 0 ? p.elimTick : endTick) / TICK_HZ; e.survSum += surv;
      if (surv > e.bestSurvivalSec) e.bestSurvivalSec = surv;
      if (p.elimTick >= 0) e.deaths++;
    }
    const champ = winner >= 0 ? players.find(p => p.playing && p.team === winner) : null;
    pushHistory(GID, { when: Date.now(), mode, preset: 'bomb',
      winner: champ ? (nteams < nParts ? 'Équipe ' + 'ABC'[winner] : (champ.name || ('P' + (champ.seat + 1)))) : 'Égalité',
      durationSec: Math.round(endTick / TICK_HZ), nParts });
    save(); markDirty(GID);
  }

  function makePlayers() {
    return Array.from({ length: MAX_SEATS }, (_, seat) => ({
      seat, member: null, mid: null, name: '', team: 0, alive: false, playing: false, bot: false, botNext: null, botCd: 0,
      x: ccx(1), y: ccx(1), face: { x: 0, y: 1 }, maxBombs: 1, power: FLAME_BASE, speed: SPD_BASE, bombsActive: 0,
      kick: false, remote: false, ghostUntil: 0, throw: false, line: false, shield: 0, reverseUntil: 0, slowUntil: 0, autoUntil: 0,
      skullUntil: 0, skullKind: '', warpCd: 0, lastCell: -1, revenant: false, ring: 0,
      inputs: { up: false, down: false, left: false, right: false }, invulnUntil: 0,
      kills: 0, score: 0, place: 0, elimTick: -1, spawn: { gx: 1, gy: 1 },
    }));
  }
  function fullReset() {
    players = makePlayers(); cells = new Array(GW * GH).fill(0); bombs = []; blasts = []; pickups = [];
    gameState = 'lobby'; tick = 0; round = 0; winner = null; fx = []; mode = 'ffa'; nteams = 0; nParts = 0; deaths = 0; endTick = 0; sdIndex = 0; sd = false; genStyle = 0; ff = false; warpOf = {}; revenge = false; botCount = 0; botDiff = 1; seatByMid = {};
  }

  const connectedCount = () => players.filter(p => p.member).length;
  const maxBots = () => MAX_SEATS - connectedCount();
  const partCount = () => Math.min(connectedCount() + botCount, MAX_SEATS);
  const canStart = () => connectedCount() >= 1;
  const editable = () => gameState === 'lobby' || gameState === 'over';
  const seatOf = member => { for (const p of players) if (p.member === member) return p.seat; return -1; };
  const active = p => p.playing && p.alive;
  const aliveN = () => players.filter(active).length;
  const aliveTeams = () => new Set(players.filter(active).map(p => p.team));

  function buildGrid(parts) {
    const safe = new Set();
    parts.forEach((p, i) => { const [sx, sy] = SPAWNS[i]; [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => safe.add(idx(sx + dx, sy + dy))); });
    const spawns = parts.map((p, i) => SPAWNS[i]);
    let solid = null;
    for (let a = 0; a < 24; a++) { const s = genSolidSetB(genStyle, 0.18, safe); if (bombConnected(s, spawns)) { solid = s; break; } } // murs procéduraux + connectivité garantie
    if (!solid) { solid = new Set(); for (let y = 1; y < GH - 1; y++) for (let x = 1; x < GW - 1; x++) if (x % 2 === 0 && y % 2 === 0 && !safe.has(idx(x, y))) solid.add(idx(x, y)); } // repli : piliers classiques
    cells = new Array(GW * GH).fill(0);
    for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) if (gx === 0 || gy === 0 || gx === GW - 1 || gy === GH - 1) cells[idx(gx, gy)] = 1; // cadre
    for (const k of solid) cells[k] = 1;
    for (let i = 0; i < cells.length; i++) { const gx = i % GW, gy = (i / GW) | 0; if (gx > 0 && gy > 0 && gx < GW - 1 && gy < GH - 1 && cells[i] === 0 && !safe.has(i) && Math.random() < SOFT_PROB) cells[i] = 2; }
    // téléporteurs (tuile 3) : 1 paire sur deux cases vides éloignées — sol traversable, connectivité préservée
    warpOf = {};
    const empties = [];
    for (let i = 0; i < cells.length; i++) { const gx = i % GW, gy = (i / GW) | 0; if (cells[i] === 0 && !safe.has(i) && gx > 1 && gy > 1 && gx < GW - 2 && gy < GH - 2) empties.push(i); }
    if (empties.length >= 2) {
      const a = empties[Math.floor(Math.random() * empties.length)];
      let b = a; for (let t = 0; t < 24 && (b === a || Math.abs((b % GW) - (a % GW)) + Math.abs(((b / GW) | 0) - ((a / GW) | 0)) < 6); t++) b = empties[Math.floor(Math.random() * empties.length)];
      if (b !== a) { cells[a] = 3; cells[b] = 3; warpOf[a] = b; warpOf[b] = a; }
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
    buildGrid(parts);
    nParts = N; deaths = 0; endTick = 0; winner = null; fx = []; bombs = []; blasts = []; pickups = []; sdIndex = 0; sd = false;
    parts.forEach((p, i) => {
      const [sx, sy] = SPAWNS[i];
      p.playing = true; p.alive = true; p.spawn = { gx: sx, gy: sy }; p.x = ccx(sx); p.y = ccx(sy); p.face = { x: 0, y: 1 };
      p.maxBombs = 1; p.power = FLAME_BASE; p.speed = SPD_BASE; p.bombsActive = 0;
      p.kick = p.remote = p.throw = p.line = false; p.ghostUntil = 0; p.shield = 0; p.reverseUntil = p.slowUntil = p.autoUntil = 0; p.invulnUntil = 0;
      p.skullUntil = 0; p.skullKind = ''; p.warpCd = 0; p.lastCell = -1; p.revenant = false; p.ring = 0; p.botNext = null; p.botCd = 0;
      p.team = i % nteams; p.kills = 0; p.place = 0; p.elimTick = -1;
      p.inputs = { up: false, down: false, left: false, right: false };
    });
    round++; tick = 0; countdownUntil = COUNTDOWN_TICKS; gameState = 'countdown';
  }
  function backToLobby() {            // abandon : retour au lobby en pleine partie (même s'il ne reste que des bots)
    if (gameState !== 'play' && gameState !== 'countdown' && gameState !== 'paused') return;
    gameState = 'lobby'; winner = null; fx = []; bombs = []; blasts = []; pickups = []; sd = false; sdIndex = 0;
    for (const p of players) { p.playing = false; p.alive = false; p.inputs = { up: false, down: false, left: false, right: false }; }
  }
  function endRound() {
    gameState = 'over'; endTick = tick;
    if (revenge && nParts >= 2) {
      const present = [...new Set(players.filter(p => p.playing && (p.alive || p.revenant)).map(p => p.team))];
      if (present.length === 1) winner = present[0];
      else { const byTeam = {}; for (const p of players) if (p.playing) byTeam[p.team] = (byTeam[p.team] || 0) + p.kills; let bt = -1, bv = -1, tie = false; for (const k in byTeam) { const v = byTeam[k]; if (v > bv) { bv = v; bt = +k; tie = false; } else if (v === bv) tie = true; } winner = tie ? -1 : bt; }
      if (winner >= 0) players.forEach(p => { if (p.playing && p.team === winner) p.score++; });
      const order = players.filter(p => p.playing).sort((a, b) => ((b.alive ? 1 : 0) - (a.alive ? 1 : 0)) || ((b.elimTick || 0) - (a.elimTick || 0)));
      order.forEach((p, i) => p.place = i + 1);
      recordRound(); return;
    }
    const s = aliveTeams();
    winner = s.size === 1 ? [...s][0] : -1;
    if (winner >= 0) players.forEach(p => { if (p.playing && p.team === winner) p.score++; });
    players.filter(active).forEach(p => p.place = 1);
    recordRound();
  }

  const bombAt = (gx, gy) => bombs.find(b => !b.dead && b.gx === gx && b.gy === gy);
  function cellBlocked(p, gx, gy) {
    if (gx < 0 || gy < 0 || gx >= GW || gy >= GH) return true;
    const c = cells[idx(gx, gy)];
    if (c === 1) return true;
    if (c === 2 && !(p.ghostUntil > tick)) return true;   // mur destructible : traversable si "ghost" actif
    const b = bombAt(gx, gy); if (b && !b.pass.has(p.seat)) return true;
    return false;
  }
  function freeAt(p, x, y) { const r = PR - 1; for (const cx of [x - r, x + r]) for (const cy of [y - r, y + r]) if (cellBlocked(p, Math.floor(cx / CELL), Math.floor(cy / CELL))) return false; return true; }
  function inSoftWall(p) { const r = PR - 1; for (const cx of [p.x - r, p.x + r]) for (const cy of [p.y - r, p.y + r]) if (cells[idx(Math.floor(cx / CELL), Math.floor(cy / CELL))] === 2) return true; return false; }
  function bombFree(gx, gy) { if (gx < 1 || gy < 1 || gx >= GW - 1 || gy >= GH - 1) return false; if (cells[idx(gx, gy)] !== 0) return false; if (bombAt(gx, gy)) return false; for (const q of players) if (active(q) && Math.floor(q.x / CELL) === gx && Math.floor(q.y / CELL) === gy) return false; return true; }
  // la hitbox du joueur (rayon PR-1) chevauche-t-elle la case (gx,gy) ? (sert à savoir s'il est encore "sur" sa bombe)
  function overlapsCell(p, gx, gy) { const r = PR - 1; return gx >= Math.floor((p.x - r) / CELL) && gx <= Math.floor((p.x + r) / CELL) && gy >= Math.floor((p.y - r) / CELL) && gy <= Math.floor((p.y + r) / CELL); }
  function movePlayer(p) {
    let dx = p.inputs.left ? -1 : p.inputs.right ? 1 : 0;
    let dy = p.inputs.up ? -1 : p.inputs.down ? 1 : 0;
    if (p.reverseUntil > tick) { dx = -dx; dy = -dy; }
    if (dx && dy) dy = 0;
    if (dx) p.face = { x: dx, y: 0 }; else if (dy) p.face = { x: 0, y: dy };
    const spd = (p.slowUntil > tick ? p.speed * SLOW_MUL : p.speed);
    if (dx) {
      const nx = p.x + dx * spd;
      if (freeAt(p, nx, p.y)) p.x = nx;
      else if (p.kick && tryKick(p, dx, 0)) {} // poussée de bombe
      else { const cy = ccx(Math.floor(p.y / CELL)); if (Math.abs(cy - p.y) > 1) { const sy = p.y + Math.sign(cy - p.y) * Math.min(spd, Math.abs(cy - p.y)); if (freeAt(p, p.x, sy)) p.y = sy; } }
    }
    if (dy) {
      const ny = p.y + dy * spd;
      if (freeAt(p, p.x, ny)) p.y = ny;
      else if (p.kick && tryKick(p, 0, dy)) {}
      else { const cx = ccx(Math.floor(p.x / CELL)); if (Math.abs(cx - p.x) > 1) { const sx = p.x + Math.sign(cx - p.x) * Math.min(spd, Math.abs(cx - p.x)); if (freeAt(p, sx, p.y)) p.x = sx; } }
    }
  }
  function tryKick(p, dx, dy) {                    // pousse la bombe devant le joueur d'une case
    const gx = Math.floor(p.x / CELL) + dx, gy = Math.floor(p.y / CELL) + dy;
    const b = bombAt(gx, gy); if (!b) return false;
    const tx = gx + dx, ty = gy + dy;
    if (!bombFree(tx, ty)) return false;
    b.gx = tx; b.gy = ty; b.pass = new Set();      // une fois poussée, plus passable
    fx.push({ type: 'place', x: tx, y: ty });
    return true;
  }
  function placeBombAt(p, gx, gy, forceFuse) {
    if (p.bombsActive >= p.maxBombs) return false;
    if (gx < 1 || gy < 1 || gx >= GW - 1 || gy >= GH - 1) return false;
    if (bombAt(gx, gy) || cells[idx(gx, gy)] !== 0) return false;
    const pass = new Set();
    for (const q of players) if (active(q) && Math.floor(q.x / CELL) === gx && Math.floor(q.y / CELL) === gy) pass.add(q.seat);
    bombs.push({ gx, gy, owner: p.seat, fuse: BOMB_FUSE, power: p.power, pass, dead: false, remote: p.remote && !forceFuse && !p.bot });   // les bots n'utilisent jamais Action : leurs bombes restent minutées (sinon bombes éternelles)
    p.bombsActive++;
    fx.push({ type: 'place', x: gx, y: gy });
    return true;
  }
  function placeBomb(p, forceFuse) {                 // forceFuse : la pose AUTO (malus ⏱) reste minutée même avec 📡 (sinon bombes orphelines jamais déclenchées)
    if (!active(p) || gameState !== 'play') return;
    const gx = Math.floor(p.x / CELL), gy = Math.floor(p.y / CELL);
    if (!placeBombAt(p, gx, gy, forceFuse)) return;
    if (p.line) for (let d = 1; d <= 6; d++) { if (!placeBombAt(p, gx + p.face.x * d, gy + p.face.y * d, forceFuse)) break; } // bombe en ligne : pose en chaîne devant soi tant qu'il reste des bombes et que c'est libre
  }
  function action(p) {                             // gant (lancer) sinon détonateur
    if (!active(p)) return;
    const gx = Math.floor(p.x / CELL), gy = Math.floor(p.y / CELL), b = bombAt(gx, gy);
    if (p.throw && b) {
      let tx = gx, ty = gy;
      for (let d = 1; d <= THROW_DIST; d++) { const cx = gx + p.face.x * d, cy = gy + p.face.y * d; if (!bombFree(cx, cy)) break; tx = cx; ty = cy; }
      if (tx !== gx || ty !== gy) { b.gx = tx; b.gy = ty; b.pass = new Set(); fx.push({ type: 'throw', x: tx, y: ty }); return; }
    }
    if (p.remote) { const q = []; for (const bb of bombs) if (!bb.dead && bb.owner === p.seat && bb.remote) q.push(bb); while (q.length) detonate(q.shift(), q); bombs = bombs.filter(b2 => !b2.dead); }
  }

  // ---- mode revanche : un mort rejoint le bord et bombarde l'arène ; un kill depuis le bord le ressuscite ----
  function innerCell(gx, gy) { let ix = gx, iy = gy; if (gy === 0) iy = 1; else if (gy === GH - 1) iy = GH - 2; if (gx === 0) ix = 1; else if (gx === GW - 1) ix = GW - 2; return [ix, iy]; }
  function occupiedByLiving(gx, gy) { for (const q of players) if (active(q) && Math.floor(q.x / CELL) === gx && Math.floor(q.y / CELL) === gy) return true; return false; }
  function freeInteriorCell() { for (let t = 0; t < 200; t++) { const gx = 1 + Math.floor(Math.random() * (GW - 2)), gy = 1 + Math.floor(Math.random() * (GH - 2)); if (cells[idx(gx, gy)] === 0 && !occupiedByLiving(gx, gy) && !bombAt(gx, gy)) return [gx, gy]; } return null; }
  function toRevenant(p) {
    p.revenant = true; p.alive = false; p.elimTick = tick;
    p.reverseUntil = p.slowUntil = p.autoUntil = 0; p.skullUntil = 0; p.skullKind = '';
    p.inputs = { up: false, down: false, left: false, right: false };
    const dgx = Math.floor(p.x / CELL), dgy = Math.floor(p.y / CELL); let best = 0, bd = Infinity;
    for (let i = 0; i < RING_LEN; i++) { const dd = (RING[i][0] - dgx) ** 2 + (RING[i][1] - dgy) ** 2; if (dd < bd) { bd = dd; best = i; } }
    p.ring = best; p.x = ccx(RING[best][0]); p.y = ccx(RING[best][1]);
  }
  function reviveRevenant(p) {
    const cell = (cells[idx(p.spawn.gx, p.spawn.gy)] === 0 && !occupiedByLiving(p.spawn.gx, p.spawn.gy)) ? [p.spawn.gx, p.spawn.gy] : freeInteriorCell();
    if (!cell) return;                               // arène pleine (mort subite) : reste revenant
    p.revenant = false; p.alive = true; p.elimTick = -1; p.invulnUntil = tick + 2 * TICK_HZ; p.bombsActive = 0;
    p.x = ccx(cell[0]); p.y = ccx(cell[1]); p.face = { x: 0, y: 1 };
    fx.push({ type: 'spawn', x: cell[0], y: cell[1], seat: p.seat });
  }
  function revMove(p) {
    if (tick % REV_MOVE_EVERY !== 0) return;
    const d = (p.inputs.left || p.inputs.up) ? -1 : (p.inputs.right || p.inputs.down) ? 1 : 0;
    if (!d) return;
    p.ring = (p.ring + d + RING_LEN) % RING_LEN; p.x = ccx(RING[p.ring][0]); p.y = ccx(RING[p.ring][1]);
  }
  function revBomb(p) {
    if (gameState !== 'play' || p.bombsActive >= p.maxBombs) return;
    const [rx, ry] = RING[p.ring], [ix, iy] = innerCell(rx, ry);
    if (cells[idx(ix, iy)] !== 0 || bombAt(ix, iy)) return;
    const pass = new Set(); for (const q of players) if (active(q) && Math.floor(q.x / CELL) === ix && Math.floor(q.y / CELL) === iy) pass.add(q.seat);
    bombs.push({ gx: ix, gy: iy, owner: p.seat, fuse: BOMB_FUSE, power: p.power, pass, dead: false, remote: false });
    p.bombsActive++; fx.push({ type: 'place', x: ix, y: iy });
  }
  function roundOver() {
    if (revenge && nParts >= 2) {
      const living = players.some(active);
      const present = new Set(players.filter(p => p.playing && (p.alive || p.revenant)).map(p => p.team));
      return !living || present.size <= 1;
    }
    if (nParts >= 2) return aliveTeams().size <= 1;
    return aliveN() === 0;
  }

  function addBlast(gx, gy, owner) { blasts.push({ gx, gy, until: tick + BLAST_TIME, owner }); }
  function maybeSpawnPickup(gx, gy) {
    if (Math.random() >= PICK_PROB) return;
    const bad = Math.random() < MALUS_RATIO;
    const pool = bad ? BAD : GOOD;
    pickups.push({ gx, gy, type: pool[Math.floor(Math.random() * pool.length)], bad });
  }
  function removePickupAt(gx, gy) { for (let i = pickups.length - 1; i >= 0; i--) if (pickups[i].gx === gx && pickups[i].gy === gy) pickups.splice(i, 1); }
  function detonate(b, queue) {
    if (b.dead) return; b.dead = true;
    const op = players[b.owner]; if (op) op.bombsActive = Math.max(0, op.bombsActive - 1);
    addBlast(b.gx, b.gy, b.owner);
    for (const [dx, dy] of DIRS4) {
      for (let r = 1; r <= b.power; r++) {
        const gx = b.gx + dx * r, gy = b.gy + dy * r;
        if (gx < 0 || gy < 0 || gx >= GW || gy >= GH) break;
        const c = cells[idx(gx, gy)];
        if (c === 1) break;
        if (c === 2) { cells[idx(gx, gy)] = 0; fx.push({ type: 'wall', x: gx, y: gy }); maybeSpawnPickup(gx, gy); addBlast(gx, gy, b.owner); break; }
        addBlast(gx, gy, b.owner); removePickupAt(gx, gy);
        const other = bombAt(gx, gy); if (other && !other.dead) queue.push(other);
      }
    }
  }
  function dropBlock(gx, gy) {                      // mort subite : un bloc tombe
    const i = idx(gx, gy);
    if (cells[i] !== 1) { cells[i] = 1; fx.push({ type: 'drop', x: gx, y: gy }); }
    removePickupAt(gx, gy);
    const b = bombAt(gx, gy); if (b) { const q = [b]; while (q.length) detonate(q.shift(), q); bombs = bombs.filter(bb => !bb.dead); }
    for (const p of players) if (active(p) && Math.floor(p.x / CELL) === gx && Math.floor(p.y / CELL) === gy && p.invulnUntil <= tick) kill(p, -1, gx, gy);
  }
  function kill(p, killer, gx, gy) {
    if (p.shield > 0) { p.shield--; fx.push({ type: 'guard', x: gx, y: gy, seat: p.seat }); return; }
    const kp = (killer >= 0 && killer !== p.seat && players[killer]) ? players[killer] : null;
    if (kp) kp.kills++;
    for (const b of bombs) if (!b.dead && b.owner === p.seat && b.remote) { b.remote = false; b.fuse = Math.min(b.fuse, 2 * TICK_HZ); } // bombes télécommandées du mort : repassent en minutées (plus d'orphelines)
    fx.push({ type: 'boom', x: gx, y: gy, seat: p.seat });
    if (revenge && nParts >= 2 && !p.bot) { toRevenant(p); if (kp && kp.revenant) reviveRevenant(kp); return; } // revanche : pas d'élimination, on passe au bord (et le tueur revenant ressuscite) ; les bots, eux, meurent pour de bon
    p.alive = false; p.elimTick = tick; p.place = nParts - deaths; deaths++;
  }
  function applyPick(p, pk) {
    switch (pk.type) {
      case 'bomb': p.maxBombs = Math.min(MAXB_CAP, p.maxBombs + 1); break;
      case 'flame': p.power = Math.min(POWER_CAP, p.power + 1); break;
      case 'speed': p.speed = Math.min(SPD_MAX, p.speed + SPD_STEP); break;
      case 'kick': p.kick = true; break;
      case 'remote': p.remote = true; break;
      case 'ghost': p.ghostUntil = tick + GHOST_DUR; break;
      case 'throw': p.throw = true; break;
      case 'line': p.line = true; break;
      case 'shield': p.shield = Math.min(SHIELD_CAP, p.shield + 1); break;
      case 'reverse': p.reverseUntil = tick + DUR; break;
      case 'slow': p.slowUntil = tick + DUR; break;
      case 'auto': p.autoUntil = tick + DUR; break;
      case 'skull': applySkull(p, SKULL_KINDS[Math.floor(Math.random() * SKULL_KINDS.length)]); break;
    }
  }
  function applySkull(p, kind) {                    // skull : affliction aléatoire, contagieuse au contact
    p.skullUntil = tick + DUR; p.skullKind = kind;
    if (kind === 'reverse') p.reverseUntil = tick + DUR;
    else if (kind === 'slow') p.slowUntil = tick + DUR;
    else if (kind === 'auto') p.autoUntil = tick + DUR;
  }

  /* ---- IA des bots : fuir le danger, casser des murs, poser des bombes avec retraite garantie ---- */
  function dangerMap() {                            // cases menacées : explosions en cours + portée des bombes posées
    const dg = new Set();
    for (const bl of blasts) dg.add(idx(bl.gx, bl.gy));
    for (const b of bombs) if (!b.dead) {
      dg.add(idx(b.gx, b.gy));
      for (const [dx, dy] of DIRS4) for (let r = 1; r <= b.power; r++) {
        const gx = b.gx + dx * r, gy = b.gy + dy * r;
        if (gx < 0 || gy < 0 || gx >= GW || gy >= GH) break;
        const c = cells[idx(gx, gy)];
        if (c === 1) break;
        dg.add(idx(gx, gy));
        if (c === 2) break;
      }
    }
    return dg;
  }
  const botWalk = i2 => { const c = cells[i2]; return (c === 0 || c === 3) && !bombAt(i2 % GW, (i2 / GW) | 0); };
  function botBfs(start, goal, blocked) {           // BFS borné -> PREMIER PAS (index) vers la plus proche case validant goal
    const prev = new Map([[start, -1]]);
    const q = [start];
    while (q.length) {
      const cur = q.shift();
      if (cur !== start && goal(cur)) { let c = cur; while (prev.get(c) !== start) c = prev.get(c); return c; }
      if (prev.size > 90) break;
      const x = cur % GW, y = (cur / GW) | 0;
      for (const [dx, dy] of DIRS4) {
        const nx = x + dx, ny = y + dy;
        if (nx < 1 || ny < 1 || nx >= GW - 1 || ny >= GH - 1) continue;
        const k = idx(nx, ny);
        if (prev.has(k) || !botWalk(k) || (blocked && blocked.has(k))) continue;
        prev.set(k, cur); q.push(k);
      }
    }
    return -1;
  }
  function botSteer(p) {                            // pilote les inputs vers la case-étape (compense le malus inversé)
    const inp = { up: false, down: false, left: false, right: false };
    if (p.botNext != null) {
      const tx = ccx(p.botNext % GW), ty = ccx((p.botNext / GW) | 0), dx = tx - p.x, dy = ty - p.y;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
        if (Math.abs(dx) >= Math.abs(dy)) inp[dx > 0 ? 'right' : 'left'] = true;
        else inp[dy > 0 ? 'down' : 'up'] = true;
      } else p.botNext = null;                       // arrivé sur la case
    }
    if (p.reverseUntil > tick) { const u = inp.up; inp.up = inp.down; inp.down = u; const l = inp.left; inp.left = inp.right; inp.right = l; }
    p.inputs = inp;
  }
  function botThink(p) {
    const gx = Math.floor(p.x / CELL), gy = Math.floor(p.y / CELL), cur = idx(gx, gy);
    const inCenter = Math.abs(p.x - ccx(gx)) < 3 && Math.abs(p.y - ccx(gy)) < 3;
    const stalled = p.botPX === p.x && p.botPY === p.y;            // n'a pas bougé depuis le dernier tick : étape devenue infranchissable (bloc tombé, bombe…)
    p.botPX = p.x; p.botPY = p.y;
    if (p.botNext != null && !inCenter && !stalled && botWalk(p.botNext)) { botSteer(p); return; }   // entre deux cases : on finit le pas, on redécidera au centre
    const D = BMDIFF[botDiff] || BMDIFF[1];
    const dg = dangerMap();
    if (!dg.has(idx(gx, gy)) && D.skip && Math.random() < D.skip) { botSteer(p); return; }   // Facile : hésite (sauf en danger)
    let next = -1;
    if (dg.has(cur)) next = botBfs(cur, i2 => !dg.has(i2), null);  // en danger : fuir vers la case sûre la plus proche
    else {
      if (tick >= p.botCd && p.bombsActive < p.maxBombs) {         // poser une bombe ? (mur cassable adjacent ou ennemi proche) seulement si une retraite existe
        let want = false;
        for (const [dx, dy] of DIRS4) if (cells[idx(gx + dx, gy + dy)] === 2) { want = true; break; }
        if (!want) for (const q2 of players) if (active(q2) && q2 !== p && (mode === 'ffa' || q2.team !== p.team) && Math.abs(q2.x - p.x) + Math.abs(q2.y - p.y) < CELL * 2.2) { want = true; break; }
        if (want) {
          const my = new Set(dg); my.add(cur);                     // danger hypothétique si je pose ici
          for (const [dx, dy] of DIRS4) for (let r = 1; r <= p.power; r++) { const x2 = gx + dx * r, y2 = gy + dy * r; if (x2 < 0 || y2 < 0 || x2 >= GW || y2 >= GH) break; const c = cells[idx(x2, y2)]; if (c === 1) break; my.add(idx(x2, y2)); if (c === 2) break; }
          const esc = botBfs(cur, i2 => !my.has(i2), null);
          if (esc >= 0) { placeBomb(p); p.botCd = tick + D.cd; next = esc; }
        }
      }
      if (next < 0) next = botBfs(cur, i2 => {                     // sinon : viser un bonus sain, ou une case adjacente à un mur cassable
        for (const pk of pickups) if (!pk.bad && idx(pk.gx, pk.gy) === i2) return true;
        const x2 = i2 % GW, y2 = (i2 / GW) | 0;
        for (const [dx, dy] of DIRS4) if (cells[idx(x2 + dx, y2 + dy)] === 2) return true;
        return false;
      }, dg);
      if (next < 0) {                                              // rien à faire : errance prudente
        const opts = [];
        for (const [dx, dy] of DIRS4) { const nx = gx + dx, ny = gy + dy; if (nx < 1 || ny < 1 || nx >= GW - 1 || ny >= GH - 1) continue; const k2 = idx(nx, ny); if (botWalk(k2) && !dg.has(k2)) opts.push(k2); }
        if (opts.length) next = opts[Math.floor(Math.random() * opts.length)];
      }
    }
    p.botNext = next >= 0 ? next : null;
    botSteer(p);
  }

  function update() {
    fx = [];
    if (gameState === 'countdown') { tick++; if (tick >= countdownUntil) { gameState = 'play'; tick = 0; } return; }
    if (gameState !== 'play') return;
    tick++;
    // mort subite
    if (!sd && tick >= SD_START) sd = true;
    if (sd && tick % SD_EVERY === 0 && sdIndex < SD_SPIRAL.length) { const [gx, gy] = SD_SPIRAL[sdIndex++]; dropBlock(gx, gy); }
    // mèches + chaînage
    const q = [];
    for (const b of bombs) if (!b.dead) { if (!b.remote) { b.fuse--; if (b.fuse <= 0) q.push(b); } else if (b.fuse > 1) b.fuse--; }
    while (q.length) detonate(q.shift(), q);
    bombs = bombs.filter(b => !b.dead);
    blasts = blasts.filter(bl => bl.until > tick);
    // déplacements + pose auto (malus)
    for (const p of players) if (active(p)) { if (p.bot) botThink(p); if (p.ghostUntil > 0 && p.ghostUntil <= tick && inSoftWall(p)) p.ghostUntil = tick + 1; movePlayer(p); if (p.autoUntil > tick && tick % AUTO_EVERY === 0) placeBomb(p, true); } // ghost prolongé tant qu'on est DANS un mur (anti-coincé) ; bombes auto = toujours minutées
    for (const p of players) if (p.revenant) revMove(p);     // revanche : déplacement le long du bord
    // téléporteurs : on warpe à l'ENTRÉE d'une case 3 (pas de ping-pong), si la sortie n'est pas un bloc tombé (mort subite)
    for (const p of players) if (active(p)) {
      const cur = idx(Math.floor(p.x / CELL), Math.floor(p.y / CELL));
      if (cells[cur] === 3 && p.lastCell !== cur && warpOf[cur] !== undefined && cells[warpOf[cur]] !== 1) {
        const dst = warpOf[cur]; p.x = ccx(dst % GW); p.y = ccx((dst / GW) | 0); p.lastCell = dst; fx.push({ type: 'warp', x: dst % GW, y: (dst / GW) | 0, seat: p.seat });
      } else p.lastCell = cur;
    }
    // skull : contagion au contact (transmet l'affliction aux voisins non infectés)
    for (const p of players) {
      if (!active(p) || p.skullUntil <= tick) continue;
      for (const q of players) if (q !== p && active(q) && q.skullUntil <= tick && (p.x - q.x) ** 2 + (p.y - q.y) ** 2 < (PR * 1.6) ** 2) applySkull(q, p.skullKind);
    }
    for (const b of bombs) for (const s of [...b.pass]) { const q2 = players[s]; if (!q2 || !active(q2) || !overlapsCell(q2, b.gx, b.gy)) b.pass.delete(s); } // on ne reste "traversant" que tant que la hitbox touche encore la bombe (sinon on restait coincé à cheval dessus)
    // explosions : qui meurt ? (pas de tir allié)
    if (blasts.length) {
      const owner = {}; for (const bl of blasts) owner[idx(bl.gx, bl.gy)] = bl.owner;
      for (const p of players) {
        if (!active(p) || p.invulnUntil > tick) continue;
        const r = PR - 3, occ = new Set();
        for (const cx of [p.x - r, p.x + r, p.x]) for (const cy of [p.y - r, p.y + r, p.y]) occ.add(idx(Math.floor(cx / CELL), Math.floor(cy / CELL)));
        let killer = -2;
        for (const k of occ) if (owner[k] !== undefined) { const o = owner[k]; if (mode !== 'ffa' && !ff && o !== p.seat && players[o] && players[o].team === p.team) continue; killer = o; break; }
        if (killer !== -2) kill(p, killer, Math.floor(p.x / CELL), Math.floor(p.y / CELL));
      }
    }
    // ramassage
    for (const p of players) {
      if (!active(p)) continue;
      const gx = Math.floor(p.x / CELL), gy = Math.floor(p.y / CELL);
      for (let i = pickups.length - 1; i >= 0; i--) { const pk = pickups[i]; if (pk.gx === gx && pk.gy === gy) { applyPick(p, pk); pickups.splice(i, 1); fx.push({ type: 'pickup', x: gx, y: gy, kind: pk.type, bad: !!pk.bad, seat: p.seat }); } }
    }
    if (roundOver()) endRound();
  }

  function snapshot() {
    const g = cells.join('');
    const sendGrid = g !== lastGrid || tick % 15 === 0 || gameState !== 'play';   // delta + refresh 2×/s
    if (sendGrid) lastGrid = g;
    return {
      gs: gameState, count: gameState === 'countdown' ? Math.max(0, Math.ceil((countdownUntil - tick) / TICK_HZ)) : 0,
      round, winner, fx, connected: connectedCount(), botCount, maxBots: maxBots(), botDiff, mode, nteams, sd, gen: genStyle, ff, revenge,
      grid: sendGrid ? g : undefined,
      bombs: bombs.map(b => ({ x: b.gx, y: b.gy, f: b.fuse, p: b.power, r: !!b.remote })),
      blasts: blasts.map(bl => ({ x: bl.gx, y: bl.gy })),
      pickups: pickups.map(pk => ({ x: pk.gx, y: pk.gy, t: pk.type, b: !!pk.bad })),
      stats: gameState === 'over' ? { durationSec: Math.round(endTick / TICK_HZ), nParts, solo: nParts < 2 } : null,
      players: players.map(p => ({
        seat: p.seat, name: p.name, team: p.team, connected: !!p.member, playing: p.playing, alive: p.alive, bot: !!p.bot,
        x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10,
        bombs: p.maxBombs, power: p.power, speed: Math.round((p.speed - SPD_BASE) / SPD_STEP),
        kick: p.kick, remote: p.remote, ghost: p.ghostUntil > tick, throw: p.throw, line: p.line, shield: p.shield,
        rev: p.reverseUntil > tick, slow: p.slowUntil > tick, auto: p.autoUntil > tick, skull: p.skullUntil > tick, invuln: p.invulnUntil > tick, rvn: p.revenant,
        kills: p.kills, score: p.score, place: p.place, elimTick: p.elimTick,
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
    const p = players[seat]; p.member = null; p.inputs = { up: false, down: false, left: false, right: false };
    if (gameState === 'play' || gameState === 'countdown' || gameState === 'paused') {
      if (p.alive) { p.alive = false; p.elimTick = tick; p.place = nParts - deaths; deaths++; }
      p.revenant = false;                              // un partant ne reste pas revenant
      if (connectedCount() === 0) fullReset();
      else if (gameState === 'play') { if (roundOver()) endRound(); }
    } else if (connectedCount() === 0) fullReset();
  }
  function onRename(member) { const s = seatOf(member); if (s >= 0) players[s].name = member.name || ''; }
  function onMessage(member, m) {
    if (!m || typeof m !== 'object') return;
    const seat = seatOf(member); const p = seat >= 0 ? players[seat] : null;
    if (m.t === 'input' && p) p.inputs = { up: !!m.up, down: !!m.down, left: !!m.left, right: !!m.right };
    else if (m.t === 'bomb' && p) { if (p.revenant) revBomb(p); else placeBomb(p); }
    else if (m.t === 'action' && p) action(p);
    else if (m.t === 'start') startGame();
    else if (m.t === 'pause') { if (gameState === 'play') gameState = 'paused'; else if (gameState === 'paused') gameState = 'play'; }
    else if (m.t === 'abort') backToLobby();
    else if (m.t === 'mode') { if (editable()) { const v = validModes(partCount()); mode = v[(v.indexOf(mode) + 1) % v.length] || 'ffa'; } }
    else if (m.t === 'gen') { if (editable()) genStyle = (genStyle + 1) % 3; }
    else if (m.t === 'ff') { if (editable()) ff = !ff; }
    else if (m.t === 'revenge') { if (editable()) revenge = !revenge; }
    else if (m.t === 'bots') { if (editable()) { const mx = maxBots(); botCount = mx <= 0 ? 0 : (botCount + 1) % (mx + 1); } }
    else if (m.t === 'botdiff') { if (editable()) botDiff = (botDiff + 1) % 3; }
    else if (m.t === 'lbreset') reset(GID);
  }
  function tick_() { for (const p of players) if (p.member) p.name = p.member.name || p.name || ''; update(); return snapshot(); }

  fullReset();
  return { onJoin, onLeave, onRename, onMessage, tick: tick_, isIdle: editable };
}

export default { meta: { id: GID, name: 'Bomberman', min: 1, max: 6, tickHz: TICK_HZ, desc: 'Labyrinthe, bombes, bonus/malus, équipes, mort subite' }, create: createBomb };
