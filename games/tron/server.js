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
import { classerManche } from '../fin-manche.js';
import { creerMatch } from '../match.js';

const GID = 'tron';
const MAX_SEATS = 10;
const TICK_HZ = 15;
const COUNTDOWN_TICKS = 3 * TICK_HZ;
const DIRS = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
const key = (x, y) => y * GW + x;
const WALL = -2, FREE = -1;               // cellule "mur" (rétrécissement) ; FREE = case libre du tableau d'occupation
// Occupation de la grille : mêmes get/set/has/delete qu'une Map (valeur = siège, WALL, ou undefined si libre) mais sur un Int8Array,
// que les bots lisent directement (`.a`) : 10 bots × 3 remplissages par tick ne passent pas par 100 000 Map.get.
class Occ {
  constructor() { this.a = new Int8Array(GW * GH).fill(FREE); }
  get(k) { const v = this.a[k]; return v === FREE ? undefined : v; }
  has(k) { const v = this.a[k]; return v !== undefined && v !== FREE; }
  set(k, v) { this.a[k] = v; return this; }
  delete(k) { this.a[k] = FREE; }
}
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
const TRDIFF = [   // IA : Facile / Normale / Difficile (cf. bloc « IA des bots » : inattention, taille du remplissage, poids du terrain adverse, rayon, rétrécissement, boost, risque de choc, bruit)
  { err: 0.02, cap: 80, vs: 0, rr: 0, shr: 0, bst: 0, dg: 160, nz: 3, sb: 1, hug: 1.2, hugAll: 0 },
  { err: 0.01, cap: 120, vs: 0.2, rr: 16, shr: 1, bst: 0, dg: 300, nz: 4, sb: 1, hug: 1.2, hugAll: 0 },
  { err: 0, cap: 240, vs: 0.5, rr: 28, shr: 1, bst: 8, dg: 400, nz: 0.6, sb: 1, hug: 1.2, hugAll: 0 },
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
      if (winner >= 0 && p.place === 1) e.wins++;
      bumpDaily(p.name, { win: winner >= 0 && p.place === 1, kills: p.kills, game: GID });   // classement du jour (tous jeux)
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
  const match = creerMatch();                         // match en N manches (games/match.js) : cible 1 = manche simple, comportement historique
  function fullReset() {
    match.reinit();
    players = makePlayers(); occupied = new Occ(); pickups = [];
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
    occupied = new Occ(); pickups = [];
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
    // sièges ne participant pas à cette manche (ex. vainqueur parti sur l'écran de fin) : remis à zéro,
    // sinon leur ancien alive=true/cells en fait des « motos fantômes » dans la manche suivante (update()
    // ne filtre que sur alive, pas playing). spawnPlayers() réinitialise ensuite les VRAIS participants.
    for (const p of players) { p.playing = false; p.bot = false; p.alive = false; p.cells = []; p.place = 0; p.kills = 0; p.boostHeld = false; p.pendingDir = null; p.nextDir = null; }
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
    nParts = N; deaths = 0; endTick = 0; winner = null; fx = []; shrinkLevel = 0;
    setGrid(N);                                        // grille dimensionnée AVANT le placement
    spawnPlayers(parts);
    round++; tick = 0; countdownUntil = COUNTDOWN_TICKS; gameState = 'countdown';
  }
  function backToLobby() {            // abandon : retour au lobby en pleine partie
    if (gameState !== 'play' && gameState !== 'countdown' && gameState !== 'paused') return;
    gameState = 'lobby'; winner = null; fx = []; occupied = new Occ(); pickups = []; shrinkLevel = 0;
    for (const p of players) { p.playing = false; p.alive = false; p.cells = []; p.boostHeld = false; p.pendingDir = null; p.nextDir = null; }
  }
  function endRound() {
    gameState = 'over'; endTick = tick;
    const s = aliveTeams();
    winner = s.size === 1 ? [...s][0] : -1;
    if (winner >= 0) players.forEach(p => { if (p.playing && p.team === winner) p.score++; }); match.apresManche(players, winner);
    classerManche(players, winner);                    // places : une seule vérité, commune aux 7 jeux (games/fin-manche.js)
    recordRound();
  }

  function killCycle(p, killer, x, y, place) {
    // `place` fourni => mort groupée (choc frontal/croisement) : même place pour tout le groupe, cf. appelant.
    p.alive = false; p.elimTick = tick; p.place = place != null ? place : (nParts - deaths); if (place == null) deaths++;
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
  /* ---- IA des bots (01/10) ----
     Chaque tick, pour chacune des 3 directions possibles (tout droit / gauche / droite), le bot simule le coup puis mesure
     l'ESPACE qu'il garderait : remplissage en largeur BORNÉ (fill) mené en même temps depuis les têtes adverses proches
     (« à la Voronoï » : une case est à nous si on l'atteint STRICTEMENT avant tout adversaire). Il choisit la direction qui
     garde le plus d'espace — donc ni cul-de-sac, ni couloir qui se referme — avec : malus pour la case qu'une tête voisine
     va viser (choc frontal = mort des deux), prise en compte du rétrécissement à venir (une case dont l'anneau devient mur
     avant qu'on l'ait quittée est fermée), de la vitesse (double pas : les 2 cases doivent être libres), attrait des
     bonus, et boost (sauf cul-de-sac) seulement quand 2 cases d'avance gagnent du terrain disputé.
     ⇄ : la commande d'un bot est inversée à la consommation (update) ; il écrit donc l'INVERSE de la direction voulue.
     Niveaux (TRDIFF) : err = taux d'inattention (le tick est sauté) · cap = taille du remplissage · vs = poids du terrain
     adverse · rr = rayon des adversaires pris en compte · shr = anticipe le rétrécissement · bst = utilise le boost ·
     dg = poids du risque de choc · nz = bruit sur les scores. Coût mesuré : ~35 µs/bot/tick en Difficile à 10 bots (~0,35 ms/tick pour les 10), ~12 µs en Normale. */
  const PK_W = { speed: 10, ghost: 8, cut: 4, blink: 5, breaker: 9, invert: 7 };   // attrait des bonus (×10)
  let bfN = 0, bfStamp = 0, bfVis, bfOwn, bfTm, bfQx, bfQy, pkMark, pkSig = -1, pkList = [];
  const rivX = new Int16Array(MAX_SEATS), rivY = new Int16Array(MAX_SEATS), hdX = new Int16Array(MAX_SEATS), hdY = new Int16Array(MAX_SEATS), hdU = new Int8Array(MAX_SEATS), hdV = new Int8Array(MAX_SEATS), hdF = new Uint8Array(MAX_SEATS);
  let nRiv = 0, nHd = 0, bfOurs = 0, bfTheirs = 0, bfPk = 0, cShr = false, cWall0 = 0, cEv = 1;
  const shrinkEvery = () => Math.max(6, Math.round(SHRINK_EVERY * GW0 / GW));   // intervalle entre deux anneaux (cf. update)
  function botPrep() {                              // tampons du remplissage (réalloués si la grille change) + carte des bonus du tick
    const n = GW * GH;
    if (bfN !== n) { bfN = n; bfVis = new Int32Array(n); bfOwn = new Int8Array(n); bfTm = new Int16Array(n); bfQx = new Int16Array(n); bfQy = new Int16Array(n); pkMark = new Uint8Array(n); bfStamp = 0; pkList = []; pkSig = -1; }
    const sig = round * 100000 + tick;
    if (sig === pkSig) return;
    pkSig = sig;
    for (const k of pkList) pkMark[k] = 0;
    pkList = [];
    for (const pk of pickups) { const k = key(pk.gx, pk.gy); pkMark[k] = PK_W[pk.type] || 5; pkList.push(k); }
  }
  // Case jouable à l'instant t (1 = la case que le coup en cours va occuper) : dans l'arène, libre, et pas fermée par un anneau
  // du rétrécissement avant le tick suivant (la tête qui s'y trouve alors est tuée par applyShrink).
  const cellOK = (x, y) => x >= 0 && y >= 0 && x < GW && y < GH && occupied.a[y * GW + x] === FREE && !(cShr && cWall0 + Math.min(x, y, GW - 1 - x, GH - 1 - y) * cEv <= 1);
  // Remplissage borné depuis (sx,sy) [notre case, temps 1] contre les têtes adverses rivX/rivY [temps 0] ; blk = case déjà prise
  // (1er pas d'un double pas), -1 sinon. Résultat : bfOurs (cases à nous), bfTheirs (à eux), bfPk (meilleur bonus que nous atteignons le premier).
  const DX = [1, -1, 0, 0], DY = [0, 0, 1, -1];
  function fill(sx, sy, blk, cap) {
    const a = occupied.a, vis = bfVis, own = bfOwn, tm = bfTm, qx = bfQx, qy = bfQy, W = GW, H = GH, st = ++bfStamp, lim = cap * 4;
    let qh = 0, qt = 0, ours = 1, theirs = 0, pk = 0;
    for (let i = 0; i < nRiv; i++) { const k = rivY[i] * W + rivX[i]; vis[k] = st; own[k] = 1; tm[k] = 0; qx[qt] = rivX[i]; qy[qt++] = rivY[i]; }
    const k0 = sy * W + sx;
    vis[k0] = st; own[k0] = 0; tm[k0] = 1; qx[qt] = sx; qy[qt++] = sy;
    if (blk >= 0) { vis[blk] = st; own[blk] = 2; tm[blk] = 0; }
    while (qh < qt && ours < cap && qt < lim) {
      const x = qx[qh], y = qy[qh++], k = y * W + x, o = own[k];
      if (o === 2) continue;                         // case disputée au même instant : personne n'y passe
      const t = tm[k] + 1;
      for (let d = 0; d < 4; d++) {
        const nx = x + DX[d], ny = y + DY[d];
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const nk = ny * W + nx;
        if (vis[nk] === st) { if (tm[nk] === t && own[nk] !== o && own[nk] !== 2 && nk !== k0) { if (own[nk] === 0) ours--; else theirs--; own[nk] = 2; } continue; }
        if (a[nk] !== FREE) continue;
        if (cShr && cWall0 + Math.min(nx, ny, W - 1 - nx, H - 1 - ny) * cEv <= t) continue;   // l'anneau de cette case sera un mur avant qu'on y soit
        vis[nk] = st; own[nk] = o; tm[nk] = t; qx[qt] = nx; qy[qt++] = ny;
        if (o === 0) { ours++; const w = pkMark[nk]; if (w && w / t > pk) pk = w / t; } else theirs++;
      }
    }
    bfOurs = ours; bfTheirs = theirs; bfPk = pk;
  }
  // Probabilité (0..~1) qu'une tête adverse occupe (x,y) ce tick : devant elle (elle continue) ≫ à côté (elle vire) ; ×2 cases si elle est rapide.
  function headRisk(x, y) {
    let r = 0;
    for (let i = 0; i < nHd; i++) {
      const dx = hdX[i] - x, dy = hdY[i] - y, m = Math.abs(dx) + Math.abs(dy);
      if (m === 1) r += (hdX[i] + hdU[i] === x && hdY[i] + hdV[i] === y) ? 0.85 : 0.1;
      else if (m === 2 && hdF[i] && hdX[i] + 2 * hdU[i] === x && hdY[i] + 2 * hdV[i] === y) r += 0.4;
    }
    return r;
  }
  function steer(p, best) {                         // ⇄ : update() inverse la commande d'un bot inversé → on écrit l'inverse de la direction voulue
    if (best === p.dir) { p.pendingDir = null; return; }
    p.pendingDir = p.invertUntil > tick ? { x: -best.x, y: -best.y } : best;
  }
  function botThink(p) {
    const D = TRDIFF[botDiff] || TRDIFF[1];
    if (D.err && Math.random() < D.err) return;     // Facile : moments d'inattention (continue tout droit)
    botPrep();
    const h = head(p), d = p.dir, W = GW, a = occupied.a;
    const left = { x: d.y, y: -d.x }, right = { x: -d.y, y: d.x }, ev = shrinkEvery();
    cShr = !!D.shr && tick + 3 * D.cap >= SHRINK_START; cWall0 = SHRINK_START - tick; cEv = ev;
    nRiv = 0; nHd = 0;
    for (const q of players) {
      if (!q.alive || q === p) continue;
      const qh = head(q), q2 = q.dir;
      hdX[nHd] = qh.x; hdY[nHd] = qh.y; hdU[nHd] = q2.x; hdV[nHd] = q2.y; hdF[nHd++] = (q.speedUntil > tick || (q.boostHeld && q.boost > 0)) ? 1 : 0;
      if (D.vs && q.team !== p.team && Math.abs(qh.x - h.x) + Math.abs(qh.y - h.y) <= D.rr) { rivX[nRiv] = qh.x; rivY[nRiv++] = qh.y; }
    }
    const two = p.speedUntil > tick;                // vitesse : 2 cases dans le même sens, la 2e à l'aveugle → elles doivent être libres toutes les deux
    let bi = -1, bs = -Infinity, bBase = 0, bTheirs = 0;
    const opts = [d, left, right];
    for (let i = 0; i < 3; i++) {
      const o = opts[i], x1 = h.x + o.x, y1 = h.y + o.y;
      if (!cellOK(x1, y1)) continue;
      let sx = x1, sy = y1, blk = -1, risk = headRisk(x1, y1);
      if (two) { sx = x1 + o.x; sy = y1 + o.y; if (!cellOK(sx, sy)) continue; blk = y1 * W + x1; risk += headRisk(sx, sy); }
      fill(sx, sy, blk, D.cap);
      const base = bfOurs - D.vs * bfTheirs, ours = bfOurs;
      let sc = base + bfPk * 4 - D.dg * risk + (i === 0 ? D.sb : 0) + Math.random() * D.nz;
      if (D.hug && (D.hugAll || ours < D.cap * 0.7)) {   // épouse les murs : remplit l'espace sans le gaspiller (pas de trous)
        let nb = 0; for (let k = 0; k < 4; k++) { const nx = sx + DX[k], ny = sy + DY[k]; if (nx < 0 || ny < 0 || nx >= W || ny >= GH || a[ny * W + nx] !== FREE) nb++; }
        sc += nb * D.hug;
      }
      if (sc > bs) { bs = sc; bi = i; bBase = base; bTheirs = bfTheirs; }
    }
    if (bi < 0) {                                   // tout est fermé : un fantôme / casse-mur traverse une traînée (jamais un mur ni le bord)
      if (p.ghostUntil > tick || p.breaker) for (let i = 0; i < 3 && bi < 0; i++) { const x = h.x + opts[i].x, y = h.y + opts[i].y; if (x >= 0 && y >= 0 && x < W && y < GH && a[y * W + x] >= 0) bi = i; }
      if (bi < 0) { p.boostHeld = false; return; }  // condamné : rien à tenter
      p.boostHeld = false; steer(p, opts[bi]); return;
    }
    const o = opts[bi];
    steer(p, o);
    // boost : 2 cases d'avance seulement s'il y a un terrain DISPUTÉ à prendre (jamais dans un espace clos : il se consommerait plus vite)
    let boost = false;
    if (D.bst && !two && bTheirs > 0 && p.boost >= (p.boostHeld ? 5 : 40)) {
      const x1 = h.x + o.x, y1 = h.y + o.y, x2 = x1 + o.x, y2 = y1 + o.y;
      if (cellOK(x2, y2) && headRisk(x1, y1) + headRisk(x2, y2) === 0) {
        fill(x2, y2, y1 * W + x1, D.cap);
        if (bfOurs - D.vs * bfTheirs >= bBase + D.bst) boost = true;
      }
    }
    p.boostHeld = boost;
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
    const shrinkEv = shrinkEvery();
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
    if (doomed.size) { const place = nParts - deaths; for (const p of doomed) { const n = fn.get(p); killCycle(p, -1, n.x, n.y, place); } deaths += doomed.size; }   // même place pour un choc mutuel simultané (sinon un « nul » élit un faux gagnant)
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
    if (aliveTeams().size <= 1) endRound();   // équipes : fin dès qu'un seul camp reste (pas seulement un seul joueur)
  }

  function snapshot() {
    return {
      gs: gameState, count: gameState === 'countdown' ? Math.max(0, Math.ceil((countdownUntil - tick) / TICK_HZ)) : 0,
      round, winner, fx, connected: connectedCount(), botCount, maxBots: maxBots(), botDiff, mode, nteams, shrink: shrinkLevel, fade: fadeMode, gw: GW, gh: GH,
      pickups: pickups.map(p => ({ x: p.gx, y: p.gy, t: p.type })),
      match: match.etat(players),
      stats: gameState === 'over' ? { durationSec: Math.round(endTick / TICK_HZ), nParts, match: match.gagne } : null,
      players: players.map(p => ({
        seat: p.seat, name: p.name, team: p.team, connected: !!p.member, playing: p.playing, alive: p.alive, bot: !!p.bot,
        head: p.cells.length ? { x: head(p).x, y: head(p).y } : { x: 0, y: 0 },
        path: corners(p.cells),
        boost: Math.round(p.boost), ghost: p.ghostUntil > tick, speed: p.speedUntil > tick, boosting: p.boostHeld && p.boost > 0, inv: p.invertUntil > tick, brk: p.breaker,
        kills: p.kills, score: p.score, place: p.place, elimTick: p.elimTick,
      })),
    };
  }

  /* ---- contrat plateforme ---- */
  // Siège d'un bot pris par un humain entre deux manches : on efface ce que le BOT y avait gagné (ligne de l'écran de
  // fin, victoire, points de match), sinon l'arrivant apparaissait vainqueur d'une manche qu'il n'a pas jouée.
  function repriseSiegeBot(p) {
    p.playing = false; p.alive = false; p.place = 0; p.kills = 0;
    if ('score' in p) p.score = 0; if ('matchKills' in p) p.matchKills = 0;
  }
  function onJoin(member) {
    const cur = seatOf(member); if (cur >= 0) return { role: 'player', seat: cur, hello: { t: 'welcome', seat: cur } }; // déjà assis (reconnexion within grace)
    let seat = -1;
    const rid = seatByMid[member.id];
    if (rid != null && players[rid] && !players[rid].member && !players[rid].bot) seat = rid;
    if (seat < 0) { const free = players.find(p => !p.member && !p.bot) || (editable() ? players.find(p => !p.member) : null); if (free) seat = free.seat; }   // siège de bot protégé
    if (seat < 0) return { role: 'spectator', hello: { t: 'welcome', seat: -1 } };
    const p = players[seat];
    if (p.bot) repriseSiegeBot(p);   /* hors partie, un siège de bot se libère (startGame redistribue les bots) : remis à neuf */
    p.member = member; p.bot = false; p.mid = member.id; p.name = member.name || '';
    seatByMid[member.id] = seat;
    return { role: 'player', seat, hello: { t: 'welcome', seat } };
  }
  function onLeave(member) {
    const seat = seatOf(member); if (seat < 0) return;
    const p = players[seat]; p.member = null; p.boostHeld = false;
    if (gameState === 'play' || gameState === 'countdown' || gameState === 'paused') {
      if (p.alive) { p.alive = false; p.elimTick = tick; p.place = nParts - deaths; deaths++; }
      if (connectedCount() === 0) fullReset(); else if (gameState === 'play' && aliveTeams().size <= 1) endRound();
    } else if (connectedCount() === 0) fullReset();   // départ sur l'écran de fin : il reste affiché au podium ; startGame nettoie son siège
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
    else if (m.t === 'match') { if (editable()) match.changer(players); }   // cycle manche simple → premier à 2 / 3 / 5 (GM_ONLY dans hub.js)
    else if (m.t === 'lbreset') reset(GID);
  }
  function tick_() { for (const p of players) if (p.member) p.name = p.member.name || p.name || ''; update(); return snapshot(); }

  fullReset();
  return { onJoin, onLeave, onRename, onMessage, tick: tick_, isIdle: editable };
}

export default { meta: { id: GID, name: 'Tron', min: 2, max: 10, tickHz: TICK_HZ, desc: 'Light Cycles — traînées, bonus, boost, équipes, arène qui se referme' }, create: createTron };
