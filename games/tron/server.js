// Jeu TRON / Light Cycles. 2 à 10 joueurs. FFA ou équipes. Bonus, boost à la jauge, rétrécissement, traînée qui s'efface.
import { GW as GW0, GH as GH0 } from '../../public/games/tron/shared.js';
// Grille À L'ÉCHELLE du nombre de participants : chaque joueur occupe un nombre FIXE de cases,
// donc agrandir la grille réduit réellement l'encombrement (contrairement à Pong où ce serait un zoom).
let GW = GW0, GH = GH0;
function setGrid(n) {
  const side = Math.min(92, Math.round(GW0 * (1 + 0.14 * (Math.max(2, n) - 2))));   // 2 j : 50 · 6 j : 76 · 8 j et + : 92 (plafond)
  GW = side; GH = side;
}
import { board, pushHistory, save, markDirty, reset, bumpDaily } from '../../leaderboard.js';

const GID = 'tron';
const MAX_SEATS = 10;
const TICK_HZ = 15;
const COUNTDOWN_TICKS = 3 * TICK_HZ;
const DIRS = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
const key = (x, y) => y * GW + x;
const WALL = -2;                          // cellule "mur" (rétrécissement)
// bonus
const PU_TYPES = ['speed', 'ghost', 'cut', 'blink', 'breaker', 'invert'];
const PU_EVERY = 3 * TICK_HZ, MAX_PU = 4, SPEED_TICKS = 4 * TICK_HZ, GHOST_TICKS = 2 * TICK_HZ;
const INVERT_TICKS = 4 * TICK_HZ, BLINK_DIST = 4;   // invert = contrôles adverses inversés ; blink = téléport court
// boost à la demande
const BOOST_MAX = 100, BOOST_REGEN = 0.7, BOOST_COST = 2.6;
// rétrécissement (mort subite)
const SHRINK_START = 22 * TICK_HZ, SHRINK_EVERY = 2 * TICK_HZ;
// traînée qui s'efface (mode "fade")
const TRAIL_LIFE = 130;
const TRDIFF = [{ look: 4, err: 0.14 }, { look: 8, err: 0.04 }, { look: 12, err: 0 }];   // IA : Facile / Normale / Difficile (profondeur de vision, taux d'inattention)
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

export function createTron(room) {
  let players, occupied, pickups, gameState, tick, round, countdownUntil, winner, fx, mode, nteams, nParts, deaths, endTick, shrinkLevel, fadeMode, botCount, botDiff;
  let seatByMid = {};

  function lbEntry(name) {
    const b = board(GID);
    return (Object.hasOwn(b, name) && b[name]) || (b[name] = { name, games: 0, wins: 0, kills: 0, dmg: 0, deaths: 0, survSum: 0, bestSurvivalSec: 0 });
  }
  function recordRound() {
    for (const p of players) {
      if (!p.playing || !p.name || p.bot) continue;   // les bots n'entrent pas au classement
      const e = lbEntry(p.name);
      e.games++;
      if (winner >= 0 && p.team === winner) e.wins++;
      bumpDaily(p.name, { win: winner >= 0 && p.team === winner, kills: p.kills, game: GID });   // classement du jour (tous jeux)
      e.kills += p.kills; e.dmg += p.kills;
      const surv = (p.elimTick >= 0 ? p.elimTick : endTick) / TICK_HZ;
      e.survSum += surv;
      if (surv > e.bestSurvivalSec) e.bestSurvivalSec = surv;
      if (p.elimTick >= 0) e.deaths++;
    }
    const champ = winner >= 0 ? players.find(p => p.playing && p.team === winner) : null;
    pushHistory(GID, { when: Date.now(), mode, preset: 'tron',
      winner: champ ? (nteams < nParts ? 'Équipe ' + 'ABCDE'[winner] : (champ.name || ('P' + (champ.seat + 1)))) : 'Égalité',
      durationSec: Math.round(endTick / TICK_HZ), nParts });
    save(); markDirty(GID);
  }

  function makePlayers() {
    return Array.from({ length: MAX_SEATS }, (_, seat) => ({
      seat, member: null, mid: null, name: '', team: 0, alive: false, playing: false, bot: false,
      dir: DIRS.right, pendingDir: null, nextDir: null, cells: [], boost: BOOST_MAX, boostHeld: false, speedUntil: 0, ghostUntil: 0,
      invertUntil: 0, breaker: false,
      kills: 0, place: 0, elimTick: -1, score: 0,
    }));
  }
  function fullReset() {
    players = makePlayers(); occupied = new Map(); pickups = [];
    gameState = 'lobby'; tick = 0; round = 0; winner = null; fx = [];
    mode = 'ffa'; nteams = 0; nParts = 0; deaths = 0; endTick = 0; shrinkLevel = 0; fadeMode = false; botCount = 0; botDiff = 1; seatByMid = {};
  }

  const connectedCount = () => players.filter(p => p.member).length;
  const maxBots = () => MAX_SEATS - connectedCount();
  const partCount = () => Math.min(connectedCount() + botCount, MAX_SEATS);
  const canStart = () => connectedCount() >= 1 && partCount() >= 2;
  const editable = () => gameState === 'lobby' || gameState === 'over';
  const seatOf = member => { for (const p of players) if (p.member === member) return p.seat; return -1; };
  const aliveCount = () => players.filter(p => p.alive).length;
  const aliveTeams = () => new Set(players.filter(p => p.alive).map(p => p.team));
  const head = p => p.cells[p.cells.length - 1];

  function spawnPlayers(parts) {
    occupied = new Map(); pickups = [];
    const cx = GW / 2, cy = GH / 2, R = Math.min(GW, GH) * 0.3, N = parts.length;
    parts.forEach((p, i) => {
      const ang = i * 2 * Math.PI / N;
      const x = Math.max(1, Math.min(GW - 2, Math.round(cx + R * Math.cos(ang))));
      const y = Math.max(1, Math.min(GH - 2, Math.round(cy + R * Math.sin(ang))));
      const tx = -Math.sin(ang), ty = Math.cos(ang);
      const dir = Math.abs(tx) >= Math.abs(ty) ? { x: Math.sign(tx) || 1, y: 0 } : { x: 0, y: Math.sign(ty) || 1 };
      p.dir = dir; p.pendingDir = null; p.nextDir = null; p.cells = [{ x, y }];
      p.alive = true; p.boost = BOOST_MAX; p.boostHeld = false; p.speedUntil = 0; p.ghostUntil = 0; p.invertUntil = 0; p.breaker = false;
      p.kills = 0; p.place = 0; p.elimTick = -1;
      occupied.set(key(x, y), p.seat);
    });
  }

  function startGame() {
    if (!editable() || !canStart()) return;
    for (const p of players) { p.playing = false; p.bot = false; }
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
    nParts = N; deaths = 0; endTick = 0; winner = null; fx = []; shrinkLevel = 0;
    setGrid(N);                                        // grille dimensionnée AVANT le placement
    spawnPlayers(parts);
    round++; tick = 0; countdownUntil = COUNTDOWN_TICKS; gameState = 'countdown';
  }
  function backToLobby() {            // abandon : retour au lobby en pleine partie
    if (gameState !== 'play' && gameState !== 'countdown' && gameState !== 'paused') return;
    gameState = 'lobby'; winner = null; fx = []; occupied = new Map(); pickups = []; shrinkLevel = 0;
    for (const p of players) { p.playing = false; p.alive = false; p.cells = []; p.boostHeld = false; p.pendingDir = null; p.nextDir = null; }
  }
  function endRound() {
    gameState = 'over'; endTick = tick;
    const s = aliveTeams();
    winner = s.size === 1 ? [...s][0] : -1;
    if (winner >= 0) players.forEach(p => { if (p.playing && p.team === winner) p.score++; });
    players.forEach(p => { if (p.playing && p.alive) p.place = 1; });
    recordRound();
  }

  function killCycle(p, killer, x, y) {
    p.alive = false; p.elimTick = tick; p.place = nParts - deaths; deaths++;
    if (killer >= 0 && players[killer] && killer !== p.seat) players[killer].kills++;
    fx.push({ type: 'crash', seat: p.seat, x, y, by: killer });
  }
  function stepCycle(p) {
    const h = head(p), nx = h.x + p.dir.x, ny = h.y + p.dir.y, k = key(nx, ny);
    if (nx < 0 || ny < 0 || nx >= GW || ny >= GH) { killCycle(p, -1, nx, ny); return false; }
    const o = occupied.get(k);
    if (o !== undefined) {
      const ghost = p.ghostUntil > tick;
      const ally = o >= 0 && o !== p.seat && nteams > 0 && nteams < nParts && players[o] && players[o].team === p.team; // traînée d'un coéquipier : traversable
      if (!(o >= 0 && ghost) && !ally) {
        if (o >= 0 && p.breaker) { p.breaker = false; occupied.delete(k); fx.push({ type: 'break', x: nx, y: ny, seat: p.seat }); } // casse-mur : traverse/détruit une traînée une fois (pas les murs de rétrécissement)
        else { killCycle(p, (o >= 0 && o !== p.seat) ? o : -1, nx, ny); return false; } // mur/-2 ou pas de fantôme/allié => crash
      }
    }
    occupied.set(k, p.seat);
    p.cells.push({ x: nx, y: ny });
    return true;
  }
  function collectPickup(p) {
    const h = head(p);
    for (let i = pickups.length - 1; i >= 0; i--) {
      const pk = pickups[i];
      if (pk.gx === h.x && pk.gy === h.y) {
        if (pk.type === 'speed') p.speedUntil = tick + SPEED_TICKS;
        else if (pk.type === 'ghost') p.ghostUntil = tick + GHOST_TICKS;
        else if (pk.type === 'cut') { for (const c of p.cells) { const k = key(c.x, c.y); if (occupied.get(k) === p.seat) occupied.delete(k); } p.cells = [h]; occupied.set(key(h.x, h.y), p.seat); }
        else if (pk.type === 'blink') { for (let d = BLINK_DIST; d >= 1; d--) { const tx = h.x + p.dir.x * d, ty = h.y + p.dir.y * d; if (tx < 0 || ty < 0 || tx >= GW || ty >= GH) continue; if (occupied.get(key(tx, ty)) === undefined) { occupied.set(key(tx, ty), p.seat); p.cells.push({ x: tx, y: ty }); break; } } } // téléport court vers la case libre la plus avancée
        else if (pk.type === 'breaker') p.breaker = true;
        else if (pk.type === 'invert') { for (const q of players) if (q !== p && q.alive && (nteams >= nParts || q.team !== p.team)) q.invertUntil = tick + INVERT_TICKS; } // inverse les contrôles des adversaires
        pickups.splice(i, 1);
        fx.push({ type: 'pickup', x: h.x, y: h.y, kind: pk.type, seat: p.seat });
      }
    }
  }
  function botThink(p) {                              // IA : mesure l'espace libre tout droit / à gauche / à droite, choisit le plus dégagé (+ attrait des bonus)
    const h = head(p);
    const cellFree = (x, y) => x >= 0 && y >= 0 && x < GW && y < GH && occupied.get(key(x, y)) === undefined;
    const ray = d => { let n = 0; for (let i = 1; i <= 12; i++) { const x = h.x + d.x * i, y = h.y + d.y * i; if (!cellFree(x, y)) break; n++; } return n; };
    const left = { x: p.dir.y, y: -p.dir.x }, right = { x: -p.dir.y, y: p.dir.x };
    const cand = [{ d: p.dir, sc: ray(p.dir) + 1.5 }, { d: left, sc: ray(left) }, { d: right, sc: ray(right) }];   // léger biais : garder sa direction
    for (const c of cand) { for (const pk of pickups) { const dx = pk.gx - h.x, dy = pk.gy - h.y; if (c.d.x && Math.sign(dx) === c.d.x && Math.abs(dy) <= 2) c.sc += 2; if (c.d.y && Math.sign(dy) === c.d.y && Math.abs(dx) <= 2) c.sc += 2; } }   // attiré par les bonus devant
    cand.sort((a, b) => b.sc - a.sc);
    const best = (cand[0].sc === cand[1].sc && Math.random() < 0.5) ? cand[1] : cand[0];
    if (best.sc <= 0.5 + 1.5 * (best.d === p.dir ? 1 : 0)) { const alt = cand.find(c => c.sc > 1.5); if (alt) { p.pendingDir = alt.d; return; } }   // cul-de-sac : prend ce qui reste
    p.pendingDir = best.d;
  }
  function rayFree(x, y, d, max) {                  // IA : distance libre devant (profondeur selon difficulté), murs de rétrécissement inclus
    let n = 0;
    for (let i = 1; i <= (max || 12); i++) {
      const cx = x + d.x * i, cy = y + d.y * i;
      if (cx < 0 || cy < 0 || cx >= GW || cy >= GH) break;
      if (cx < shrinkLevel || cy < shrinkLevel || cx >= GW - shrinkLevel || cy >= GH - shrinkLevel) break;
      if (occupied.get(key(cx, cy)) !== undefined) break;
      n++;
    }
    return n;
  }
  function botThink(p) {                            // IA : tout droit si c'est sûr, sinon tourner du côté le plus dégagé
    const D = TRDIFF[botDiff] || TRDIFF[1];
    if (D.err && Math.random() < D.err) return;                            // Facile : moments d'inattention (continue tout droit)
    const h = head(p), d = p.dir;
    const left = { x: d.y, y: -d.x }, right = { x: -d.y, y: d.x };
    const fS = rayFree(h.x, h.y, d, D.look), lS = rayFree(h.x, h.y, left, D.look), rS = rayFree(h.x, h.y, right, D.look);
    let turn = null;
    if (fS >= 4 && Math.random() < 0.93) turn = null;                      // voie libre : on continue (7 % de fantaisie)
    else if (fS >= lS && fS >= rS && fS > 0) turn = null;                  // tout droit reste le meilleur choix
    else turn = lS >= rS ? left : right;                                   // sinon : côté le plus dégagé
    if (turn && rayFree(h.x, h.y, turn, D.look) === 0) turn = (turn === left ? right : left);
    if (turn) p.pendingDir = turn;
  }
  function applyShrink() {
    const L = shrinkLevel;
    for (let x = 0; x < GW; x++) for (let y = 0; y < GH; y++) {
      if (x < L || y < L || x >= GW - L || y >= GH - L) { const k = key(x, y); if (occupied.get(k) !== WALL) occupied.set(k, WALL); }
    }
    for (const p of players) if (p.alive) { const h = head(p); if (h.x < L || h.y < L || h.x >= GW - L || h.y >= GH - L) killCycle(p, -1, h.x, h.y); }
    pickups = pickups.filter(pk => !(pk.gx < L || pk.gy < L || pk.gx >= GW - L || pk.gy >= GH - L)); // retire les bonus avalés par le mur
  }
  function spawnPickup() {
    if (pickups.length >= MAX_PU) return;
    for (let tries = 0; tries < 12; tries++) {
      const gx = 1 + Math.floor(Math.random() * (GW - 2)), gy = 1 + Math.floor(Math.random() * (GH - 2));
      if (gx <= shrinkLevel || gy <= shrinkLevel || gx >= GW - shrinkLevel || gy >= GH - shrinkLevel) continue;
      if (occupied.has(key(gx, gy)) || pickups.some(p => p.gx === gx && p.gy === gy)) continue;
      pickups.push({ gx, gy, type: PU_TYPES[Math.floor(Math.random() * PU_TYPES.length)] });
      return;
    }
  }

  function update() {
    fx = [];
    if (gameState === 'countdown') { tick++; if (tick >= countdownUntil) { gameState = 'play'; tick = 0; } return; }
    if (gameState !== 'play') return;
    tick++;
    // sur une grande grille il faut plus d'anneaux : on resserre l'intervalle pour que la manche dure autant
    const shrinkEv = Math.max(6, Math.round(SHRINK_EVERY * GW0 / GW));
    if (tick >= SHRINK_START && (tick - SHRINK_START) % shrinkEv === 0) { shrinkLevel++; applyShrink(); }
    const alive = players.filter(p => p.alive);
    for (const p of alive) if (p.bot) botThink(p);
    for (const p of alive) { let pd = p.pendingDir; if (pd && p.bot && p.invertUntil > tick) pd = { x: -pd.x, y: -pd.y };   /* ⇄ : les bots le subissent ici, les humains à la saisie (virage) */ if (pd && !(pd.x === -p.dir.x && pd.y === -p.dir.y)) p.dir = pd; p.pendingDir = p.nextDir || null; p.nextDir = null; }
    // résolution SIMULTANÉE des chocs frontaux (même case) et des croisements (échange de cases), avant tout déplacement
    const fn = new Map();
    for (const p of alive) fn.set(p, { x: head(p).x + p.dir.x, y: head(p).y + p.dir.y });
    const tgt = new Map(), doomed = new Set();
    for (const p of alive) { const n = fn.get(p), k = key(n.x, n.y); (tgt.get(k) || tgt.set(k, []).get(k)).push(p); }
    for (const [, list] of tgt) if (list.length > 1) for (const p of list) doomed.add(p);
    for (const p of alive) { if (doomed.has(p)) continue; const np = fn.get(p); for (const q of alive) { if (q === p || doomed.has(q)) continue; const nq = fn.get(q); if (np.x === head(q).x && np.y === head(q).y && nq.x === head(p).x && nq.y === head(p).y) { doomed.add(p); doomed.add(q); break; } } }
    for (const p of doomed) { const n = fn.get(p); killCycle(p, -1, n.x, n.y); }
    for (const p of alive) {
      if (!p.alive) continue;
      const boosting = p.boostHeld && p.boost > 0;
      p.boost = boosting ? Math.max(0, p.boost - BOOST_COST) : Math.min(BOOST_MAX, p.boost + BOOST_REGEN);
      const moves = (boosting || p.speedUntil > tick) ? 2 : 1;
      for (let s = 0; s < moves; s++) { if (!stepCycle(p)) break; collectPickup(p); }
    }
    if (fadeMode) for (const p of players) if (p.alive) {
      while (p.cells.length > TRAIL_LIFE) { const c = p.cells.shift(); const k = key(c.x, c.y); if (occupied.get(k) === p.seat) occupied.delete(k); }
    }
    if (tick % PU_EVERY === 0) spawnPickup();
    if (aliveCount() <= 1) endRound();
  }

  function snapshot() {
    return {
      gs: gameState, count: gameState === 'countdown' ? Math.max(0, Math.ceil((countdownUntil - tick) / TICK_HZ)) : 0,
      round, winner, fx, connected: connectedCount(), botCount, maxBots: maxBots(), botDiff, mode, nteams, shrink: shrinkLevel, fade: fadeMode, gw: GW, gh: GH,
      pickups: pickups.map(p => ({ x: p.gx, y: p.gy, t: p.type })),
      stats: gameState === 'over' ? { durationSec: Math.round(endTick / TICK_HZ), nParts } : null,
      players: players.map(p => ({
        seat: p.seat, name: p.name, team: p.team, connected: !!p.member, playing: p.playing, alive: p.alive, bot: !!p.bot,
        head: p.cells.length ? { x: head(p).x, y: head(p).y } : { x: 0, y: 0 },
        path: corners(p.cells),
        boost: Math.round(p.boost), ghost: p.ghostUntil > tick, speed: p.speedUntil > tick, boosting: p.boostHeld && p.boost > 0, inv: p.invertUntil > tick, brk: p.breaker,
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
    const p = players[seat];
    p.member = member; p.mid = member.id; p.name = member.name || '';
    seatByMid[member.id] = seat;
    return { role: 'player', seat, hello: { t: 'welcome', seat } };
  }
  function onLeave(member) {
    const seat = seatOf(member); if (seat < 0) return;
    const p = players[seat]; p.member = null; p.boostHeld = false;
    if (gameState === 'play' || gameState === 'countdown' || gameState === 'paused') {
      if (p.alive) { p.alive = false; p.elimTick = tick; p.place = nParts - deaths; deaths++; }
      if (connectedCount() === 0) fullReset(); else if (gameState === 'play' && aliveCount() <= 1) endRound();
    } else if (connectedCount() === 0) fullReset();
  }
  // File de 2 virages (24/09). Un virage n'occupait qu'une case, écrasée à chaque réception : « haut puis gauche »
  // dans le même tick (demi-tour serré, balayage du joystick) → « gauche » écrasait « haut » puis était refusé comme
  // demi-tour, et les DEUX virages étaient perdus. On compare désormais au DERNIER virage prévu : même direction →
  // ignorée ; direction opposée → correction du dernier virage prévu (demi-tour sur soi-même : ignoré) ; sinon
  // elle rejoint la file (2 au plus). Un virage est consommé par tick. Les bots n'écrivent que pendingDir.
  const memeDir = (a, b) => a.x === b.x && a.y === b.y, dirOpp = (a, b) => a.x === -b.x && a.y === -b.y;
  function virage(p, d) {
    if (p.invertUntil > tick) d = { x: -d.x, y: -d.y };   // ⇄ appliqué à la SAISIE : la file est en directions réelles
    const L = p.nextDir || p.pendingDir || p.dir;
    if (memeDir(d, L)) return;
    if (dirOpp(d, L)) { if (p.nextDir) p.nextDir = d; else if (p.pendingDir) p.pendingDir = d; return; }
    if (!p.pendingDir) p.pendingDir = d; else if (!p.nextDir) p.nextDir = d;   // file pleine : ignoré
  }
  function onRename(member) { const s = seatOf(member); if (s >= 0) players[s].name = member.name || ''; }
  function onMessage(member, m) {
    if (!m || typeof m !== 'object') return;
    const seat = seatOf(member);
    const p = seat >= 0 ? players[seat] : null;
    if (m.t === 'dir' && p && p.alive && typeof m.d === 'string' && Object.hasOwn(DIRS, m.d)) virage(p, DIRS[m.d]);   // hasOwn : d:'constructor' diffusait une tête {x:null}
    else if (m.t === 'boost' && p) p.boostHeld = !!m.on;
    else if (m.t === 'start') startGame();
    else if (m.t === 'pause') { if (gameState === 'play') gameState = 'paused'; else if (gameState === 'paused') gameState = 'play'; }
    else if (m.t === 'abort') backToLobby();
    else if (m.t === 'mode') { if (editable()) { const v = validModes(partCount()); mode = v[(v.indexOf(mode) + 1) % v.length] || 'ffa'; } }
    else if (m.t === 'fade') { if (editable()) fadeMode = !fadeMode; }
    else if (m.t === 'bots') { if (editable()) { const mx = maxBots(); botCount = mx <= 0 ? 0 : (botCount + 1) % (mx + 1); } }
    else if (m.t === 'botdiff') { if (editable()) botDiff = (botDiff + 1) % 3; }
    else if (m.t === 'lbreset') reset(GID);
  }
  function tick_() { for (const p of players) if (p.member) p.name = p.member.name || p.name || ''; update(); return snapshot(); }

  fullReset();
  return { onJoin, onLeave, onRename, onMessage, tick: tick_, isIdle: editable };
}

export default { meta: { id: GID, name: 'Tron', min: 2, max: 10, tickHz: TICK_HZ, desc: 'Light Cycles — traînées, bonus, boost, équipes, arène qui se referme' }, create: createTron };
