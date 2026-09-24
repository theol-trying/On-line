// Jeu PONG (autoritatif) encapsulé en module de jeu. Toute la logique vit dans createPong(room).
// Le hub gère : connexion, identité/pseudo, token de reprise, spectateurs. Ici : uniquement le jeu.
import { W as W0, H as H0, BALL_R, PAD_W, PAD_OFF, PU_R } from '../../public/games/pong/shared.js';
import { board, pushHistory, save, markDirty, reset, bumpDaily } from '../../leaderboard.js';

const GID = 'pong';
const r1 = x => Math.round(x * 10) / 10;

/* ---- constantes de jeu ---- */
// Arène À L'ÉCHELLE du nombre de participants (humains + bots) : `setArena()` agrandit le terrain
// ET la raquette (longueur + vitesse) dans la MÊME proportion. Agrandir seul ne servirait à rien
// (simple zoom : la raquette aurait plus de distance à couvrir). Ici la défense reste identique
// tandis que la balle, dont la vitesse ne change pas, met plus de temps à traverser → plus de temps de réaction.
const R0 = 232, PAD_LEN0 = 84, PAD_SPD0 = 5.5;
// La raquette occupe une FRACTION CONSTANTE du bord qu'elle défend, au lieu d'une longueur absolue.
// Avant, elle suivait l'agrandissement du terrain alors que les arêtes du polygone RACCOURCISSENT
// quand on ajoute des joueurs (longueur d'arête = 2·R·sin(π/G)) : on couvrait 26 % de son bord en
// duel mais 59 % à 10 joueurs — la défense devenait triviale et la raquette mangeait le terrain.
// 0,25 est précisément la valeur historique du duel (26 %) et du carré (26 %) : rien ne change
// pour les deux configurations les plus jouées, tout rentre dans l'ordre au-dessus.
const PAD_RATIO = 0.25;
let W = W0, H = H0;
let CX = W / 2, CY = H / 2, R = R0;
let PAD_LEN = PAD_LEN0, PAD_SPD = PAD_SPD0;
const MAX_SEATS = 10;
const MIN_SPD = 2.6, TICK_HZ = 60;
const LEAD_TICKS = 2;          // ≈ 33 ms : latence aller (~25 ms à Francfort) + un demi-tick — cf. ballPaddles
function setArena(n) {
  const k = 1 + 0.13 * (Math.max(2, Math.min(MAX_SEATS, n)) - 2);   // 2 j : ×1.00 · 6 j : ×1.52 · 10 j : ×2.04
  // À 10 joueurs le polygone a des arêtes plus COURTES (2·R·sin(π/N)) alors que la raquette suit k :
  // chacun couvre ~59 % de son bord contre ~36 % à 6 → la défense individuelle reste confortable.
  W = Math.round(W0 * k); H = Math.round(H0 * k);
  CX = W / 2; CY = H / 2; R = R0 * k;
  PAD_SPD = PAD_SPD0 * k;
  PAD_LEN = PAD_LEN0 * k;      // valeur provisoire : recalculée sur la vraie longueur d'arête dans configure()
}
// Murs des joueurs éliminés = bumpers, à partir de 6 participants (cf. bounceWall).
// Retour de test : « on ne remarque pas l'effet ». Le ×1,035 discret devient donc un PIC net
// (×1,45) qui retombe en ~0,4 s, par-dessus un petit gain permanent (×1,05) qui, lui, se cumule
// au fil des éliminations et raccourcit réellement la fin de manche.
const WALL_BOOST_MIN_PARTS = 6;
const WALL_GAIN = 1.05, WALL_BURST = 1.45, WALL_BURST_DECAY = 0.985;
const WALL_CAP_GAIN = 0.07;        // +7 % de plafond de vitesse par bord éliminé (plafonné à +50 %)
// Anti-blocage. Un renvoi parfaitement perpendiculaire entre deux parois parallèles renvoie la
// balle indéfiniment sur le même axe : constaté en test quand les deux joueurs face à face sont
// éliminés, plus aucune raquette n'était atteignable et la manche ne pouvait plus se terminer.
// On impose donc une composante minimale LE LONG de la paroi, plus un léger aléa.
const WALL_JITTER = 0.09, WALL_MIN_TAN = 0.24;
const PADDLE_MAX_ANGLE = 1.05; // ~60° max p/r à la normale (impact en bout de raquette)
const HIT_SPEEDUP = 1.05;      // léger gain de vitesse à chaque renvoi raquette

const PU_GOOD = ['multi', 'grow', 'shield', 'ghost', 'invert', 'shrinkT', 'slow', 'blocker', 'magnet'];
const PU_BAD = ['mini', 'flip', 'speed', 'invis'];
const MAX_BALLS = 8, MAX_FIELD_PU = 2;
const BUMPER_R = 16, BLOCKER_TICKS = 8 * 60, INVIS_TICKS = 2 * 60, MAGNET_TICKS = 5 * 60, MAX_BUMPERS = 5;
const GROW_MULT = 1.7, GROW_TICKS = 8 * 60, SHIELD_TICKS = 6 * 60, IMMUNE_TICKS = 3 * 60;
const INVERT_TICKS = 5 * 60, SHRINKT_TICKS = 6 * 60, SHRINK_MULT = 0.6, SLOW_TICKS = 80, SLOW_FACTOR = 0.5;
const BOTDIFF = { easy: { spd: 0.52, dz: 34, lead: 0 }, normal: { spd: 0.84, dz: 11, lead: 0 }, hard: { spd: 1.05, dz: 4, lead: 11 }, insane: { spd: 1.25, dz: 1.5, lead: 16 } };
const BOTDIFF_ORDER = ['easy', 'normal', 'hard', 'insane'];
const COUNTDOWN_TICKS = 3 * 60;

// Vitesses recalibrées (retours de test : « la balle est beaucoup trop rapide »).
// Le preset par défaut utilise le niveau « rapide » : il valait 6.2/20 = la balle traversait en ~0,4 s.
const SPEED = { lente: { init: 3.0, max: 8 }, normale: { init: 3.8, max: 11 }, rapide: { init: 4.6, max: 14 } };
const SPEED_ORDER = ['lente', 'normale', 'rapide'];
const ACCEL_EVERY = 75, ACCEL_MUL = 1.03;
function mkCfg(o) {
  const s = SPEED[o.speedLevel];
  return { lives: o.lives, speedLevel: o.speedLevel, init: s.init, max: s.max,
    accelEvery: o.accel ? ACCEL_EVERY : 0, accelMul: ACCEL_MUL, pu: o.pu, puMin: o.puMin * 60, puMax: o.puMax * 60 };
}
const PRESETS = {
  classique: () => mkCfg({ lives: 5, speedLevel: 'normale', accel: false, pu: false, puMin: 6, puMax: 10 }),
  rapide:    () => mkCfg({ lives: 3, speedLevel: 'rapide',  accel: true,  pu: true,  puMin: 5, puMax: 9 }),
  chaos:     () => mkCfg({ lives: 5, speedLevel: 'rapide',  accel: true,  pu: true,  puMin: 3, puMax: 5 }),
};
const PRESET_ORDER = ['classique', 'rapide', 'chaos'];
const WINMODE_ORDER = ['survivor', 'rounds', 'kills'];
const SUDDEN_ORDER = ['off', 'shrink', 'accel'];
const SERVE_ORDER = ['random', 'loser'];
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
const BOTSTYLE_ORDER = ['equilibre', 'agressif', 'defensif'];   // style d'IA : équilibré / agressif (frappe du bord de raquette, met la pression) / défensif (suit toujours la balle)
const defaultRules = () => ({ winMode: 'survivor', roundsTarget: 3, killsTarget: 8, sudden: 'off', serve: 'random', handicap: false, negatives: false, botDiff: 'normal', botStyle: 'equilibre', bumpers: false });

export function createPong(room) {
  /* ---- état de la partie (par instance) ---- */
  let players, balls, powerups, bumpers, gameState, winner, fx, tick, nextPuTick, geo, botCount, mode, nteams;
  let preset, cfg, roundBounces, nParts, deaths, endTick, countdownUntil;
  let rules, sdActive, sdScale, lastConceder, matchWonPending, matchWinner, slowUntil;
  let lastVoteTick = -999;
  let geoVer = 0, geoSent = -1;  // version de la géométrie (delta : émise seulement quand elle change + refresh périodique)
  let seatByMid = {};            // memberId -> dernier siège (reprise après coupure)

  /* ---- leaderboard (schéma propre à Pong) ---- */
  function lbEntry(name) {
    const b = board(GID);
    return (Object.hasOwn(b, name) && b[name]) || (b[name] = { name, games: 0, wins: 0, kills: 0, dmg: 0, bounces: 0, pu: 0, deaths: 0,
      survSum: 0, bestSurvivalSec: 0, mostKills: 0, fastestElimSec: null, fewestTouches: null });
  }
  function recordRound() {
    if (nParts < 2) return;                            // l'entraînement solo ne compte pas au classement
    for (const p of players) {
      if (p.edge < 0 || p.bot || !p.name) continue;
      const e = lbEntry(p.name);
      e.games++;
      if (winner >= 0 && p.team === winner) e.wins++;
      bumpDaily(p.name, { win: winner >= 0 && p.team === winner, kills: p.kills, game: GID });   // classement du jour (tous jeux)
      e.kills += p.kills; e.dmg += p.dmg; e.bounces += p.hits; e.pu += p.pu;
      const surv = (p.elimTick >= 0 ? p.elimTick : endTick) / 60;
      e.survSum += surv;
      if (surv > e.bestSurvivalSec) e.bestSurvivalSec = surv;
      if (p.kills > e.mostKills) e.mostKills = p.kills;
      if (p.elimTick >= 0) { e.deaths++; const fe = p.elimTick / 60; if (e.fastestElimSec === null || fe < e.fastestElimSec) e.fastestElimSec = fe; }
      if (e.fewestTouches === null || p.hits < e.fewestTouches) e.fewestTouches = p.hits;
    }
    const champ = winner >= 0 ? players.find(p => p.edge >= 0 && p.team === winner) : null;
    pushHistory(GID, { when: Date.now(), mode, preset,
      winner: champ ? (nteams < nParts ? 'Équipe ' + 'ABCDE'[winner] : champ.name) : 'Égalité',
      durationSec: Math.round(endTick / 60), nParts });
    save(); markDirty(GID);
  }

  function makePlayers() {
    return Array.from({ length: MAX_SEATS }, (_, seat) => ({
      seat, edge: -1, pos: 0, team: 0, lives: cfg.lives, alive: true,
      member: null, mid: null, bot: false, playing: false,
      name: '', up: false, dn: false,
      score: 0, growUntil: 0, shieldUntil: 0, immuneUntil: 0, invertUntil: 0, shrinkUntil: 0, magnetUntil: 0, isLeader: false,
      hits: 0, pu: 0, kills: 0, dmg: 0, matchKills: 0, elimBy: -2, elimTick: -1, place: 0,
    }));
  }
  function makeBall() {
    let a;
    if (rules.serve === 'loser' && lastConceder >= 0 && geo && players[lastConceder].edge >= 0) {
      const e = geo.edges[players[lastConceder].edge];
      a = Math.atan2((e.ay + e.by) / 2 - CY, (e.ax + e.bx) / 2 - CX) + (Math.random() - 0.5) * 0.7;
    } else a = Math.random() * Math.PI * 2;
    return { x: CX, y: CY, vx: Math.cos(a) * cfg.init, vy: Math.sin(a) * cfg.init, last: -1 };
  }
  function resetRoundStats() {
    roundBounces = 0; deaths = 0; endTick = 0; nParts = 0;
    for (const p of players) { p.hits = 0; p.pu = 0; p.kills = 0; p.dmg = 0; p.elimBy = -2; p.elimTick = -1; p.place = 0; }
  }
  function fullReset() {
    preset = 'rapide'; cfg = PRESETS[preset]();
    rules = defaultRules();
    sdActive = false; sdScale = 1; lastConceder = -1; matchWonPending = false; matchWinner = null; slowUntil = 0;
    players = makePlayers();
    balls = [makeBall()]; powerups = []; bumpers = [];
    gameState = 'lobby'; winner = null; fx = []; tick = 0; nextPuTick = cfg.puMin;
    geo = null; botCount = 0; mode = 'ffa'; nteams = 0; lastVoteTick = -999; seatByMid = {};
    resetRoundStats();
  }

  const inPlay = p => p.playing && p.alive;
  const connectedCount = () => players.filter(p => p.member).length;
  const maxBots = () => MAX_SEATS - connectedCount();
  const partCount = () => Math.min(connectedCount() + botCount, MAX_SEATS);
  const canStart = () => connectedCount() >= 1 && (partCount() >= 2 || partCount() === 1);   // 1 participant = entraînement solo (mur)
  const editable = () => gameState === 'lobby' || gameState === 'over';
  const lobbyConfigure = () => { if (gameState === 'lobby') configure(); };
  const seatOf = member => { for (const p of players) if (p.member === member) return p.seat; return -1; };

  function buildGeometry(G) {
    const start = G === 4 ? -Math.PI / 4 : -Math.PI / 2;
    const v = [];
    for (let k = 0; k < G; k++) { const a = start + k * 2 * Math.PI / G; v.push([CX + R * Math.cos(a), CY + R * Math.sin(a)]); }
    const edges = [];
    for (let k = 0; k < G; k++) {
      const [ax, ay] = v[k], [bx, by] = v[(k + 1) % G];
      const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy);
      const tx = dx / len, ty = dy / len;
      const mx = (ax + bx) / 2, my = (ay + by) / 2;
      let nx = CX - mx, ny = CY - my; const nl = Math.hypot(nx, ny); nx /= nl; ny /= nl;
      edges.push({ ax, ay, bx, by, tx, ty, nx, ny, len, owner: -1 });
    }
    return { G, edges, base: edges.map(e => ({ ...e })) };
  }
  function applyScale(s) {
    if (!geo) return;
    for (let i = 0; i < geo.edges.length; i++) {
      const e = geo.edges[i], b = geo.base[i];
      e.ax = CX + (b.ax - CX) * s; e.ay = CY + (b.ay - CY) * s;
      e.bx = CX + (b.bx - CX) * s; e.by = CY + (b.by - CY) * s;
      e.len = b.len * s;
    }
    geoVer++;
  }
  function configure() {
    for (const p of players) { p.playing = false; p.edge = -1; p.bot = false; }
    if (botCount > maxBots()) botCount = maxBots();
    const parts = players.filter(p => p.member);
    let bots = botCount;
    for (const p of players) { if (bots <= 0) break; if (!p.member) { p.bot = true; parts.push(p); bots--; } }
    if (parts.length < 1) { geo = null; return; }
    const N = Math.min(parts.length, MAX_SEATS);
    if (!validModes(N).includes(mode)) mode = 'ffa';
    setArena(N);                                       // terrain + raquettes à l'échelle AVANT de bâtir la géométrie
    const G = N <= 2 ? 4 : N;                          // solo : carré, 1 raquette + 3 murs (entraînement)
    geo = buildGeometry(G); geoVer++;
    PAD_LEN = geo.edges[0].len * PAD_RATIO;            // polygone régulier : toutes les arêtes ont la même longueur
    let owners;
    if (N >= 3) owners = Array.from({ length: N }, (_, i) => i);
    else owners = [0, 1, 2, 3].sort((a, b) => Math.abs(geo.edges[b].nx) - Math.abs(geo.edges[a].nx)).slice(0, N);
    nteams = numTeamsFor(mode, N);
    parts.slice(0, N).forEach((p, i) => {
      const e = owners[i];
      p.edge = e; geo.edges[e].owner = p.seat; p.pos = geo.edges[e].len / 2; p.team = i % nteams;
    });
  }
  function startGame() {
    if (!editable() || !canStart()) return;
    configure();
    if (!geo) return;
    if (matchWonPending) { for (const p of players) { p.score = 0; p.matchKills = 0; } matchWonPending = false; matchWinner = null; }
    resetRoundStats();
    sdActive = false; sdScale = 1; lastConceder = -1; slowUntil = 0;
    for (const p of players) {
      if (p.edge >= 0) {
        p.playing = true; p.alive = true; p.lives = cfg.lives;
        p.up = p.dn = false; p.growUntil = p.shieldUntil = p.immuneUntil = p.invertUntil = p.shrinkUntil = p.magnetUntil = 0; p.isLeader = false;
        nParts++;
      }
    }
    balls = [makeBall()]; powerups = []; bumpers = rules.bumpers ? makeBumpers() : [];
    winner = null; fx = []; tick = 0; nextPuTick = cfg.puMin;
    countdownUntil = COUNTDOWN_TICKS; gameState = 'countdown';
  }

  function backToLobby() {            // abandon : retour au lobby en pleine partie (même s'il ne reste que des bots)
    if (gameState !== 'play' && gameState !== 'countdown' && gameState !== 'paused') return;
    for (const p of players) { p.playing = false; p.alive = true; p.up = p.dn = false; p.growUntil = p.shieldUntil = p.immuneUntil = p.invertUntil = p.shrinkUntil = 0; p.isLeader = false; }
    powerups = []; bumpers = []; winner = null; fx = []; tick = 0; sdActive = false; sdScale = 1; slowUntil = 0;
    gameState = 'lobby'; configure(); balls = [makeBall()];
  }

  // Dérivée du bord COURANT : la raquette suit donc aussi le rétrécissement de la mort subite.
  // Avant, l'arène se resserrait mais pas la raquette — la défense devenait plus facile à mesure
  // que la mort subite avançait, exactement l'inverse de l'effet recherché.
  const padBase = p => (geo && p.edge >= 0) ? geo.edges[p.edge].len * PAD_RATIO : PAD_LEN;
  const padLenOf = p => { const b = padBase(p); return (p.growUntil > tick ? b * GROW_MULT : b) * (p.isLeader ? 0.82 : 1) * (p.shrinkUntil > tick ? SHRINK_MULT : 1); };
  const wallBoostOn = () => nParts >= WALL_BOOST_MIN_PARTS;
  function clampSpeed(b, max) {
    let spd = Math.hypot(b.vx, b.vy);
    if (spd > max) { b.vx *= max / spd; b.vy *= max / spd; spd = max; }
    if (spd < MIN_SPD) { const f = MIN_SPD / (spd || 1); b.vx *= f; b.vy *= f; }
  }
  function botMove(p) {
    const e = geo.edges[p.edge];
    if (!balls.length) return;
    const D = BOTDIFF[rules.botDiff] || BOTDIFF.normal;
    const px = e.ax + e.tx * p.pos, py = e.ay + e.ty * p.pos;
    let best = balls[0], bd = Infinity;
    for (const b of balls) { const d = (b.x - px) ** 2 + (b.y - py) ** 2; if (d < bd) { bd = d; best = b; } }
    const tx = best.x + best.vx * D.lead, ty = best.y + best.vy * D.lead;
    const s = (tx - e.ax) * e.tx + (ty - e.ay) * e.ty;
    const L = padLenOf(p), spd = PAD_SPD * D.spd;
    const incoming = (best.vx * e.nx + best.vy * e.ny) < 0;   // la balle fonce-t-elle vers ce bord ?
    let target = incoming ? s : e.len / 2;                    // sinon on revient au centre (évite de rester bloqué dans un coin)
    const style = rules.botStyle || 'equilibre';
    if (style === 'agressif') {                               // frappe avec le BORD de la raquette (angles forts) + reste sous la balle pour la pression
      if (incoming) target = s + (s > e.len / 2 ? -1 : 1) * L * 0.32;
      else target = Math.max(L / 2, Math.min(e.len - L / 2, s));
    } else if (style === 'defensif') {                        // suit toujours la balle, mais sans s'éloigner trop du centre (couverture)
      target = incoming ? s : (s + e.len / 2) / 2;
    }
    let dir = target < p.pos - D.dz ? -1 : target > p.pos + D.dz ? 1 : 0;
    if (p.invertUntil > tick) dir = -dir;
    if (dir < 0) p.pos = Math.max(L / 2, p.pos - spd);
    else if (dir > 0) p.pos = Math.min(e.len - L / 2, p.pos + spd);
  }
  function ownerOf(b) {
    if (b.last >= 0 && geo.edges[b.last].owner >= 0) { const p = players[geo.edges[b.last].owner]; if (inPlay(p)) return p; }
    const act = players.filter(inPlay);
    return act.length ? act[Math.floor(Math.random() * act.length)] : null;
  }
  function randomOpponent(owner) {
    const opp = players.filter(p => inPlay(p) && (!owner || p.team !== owner.team));
    return opp.length ? opp[Math.floor(Math.random() * opp.length)] : null;
  }
  function applyPowerup(type, b) {
    const o = ownerOf(b);
    switch (type) {
      case 'multi':
        for (const da of [0.45, -0.45]) {
          if (balls.length >= MAX_BALLS) break;
          const sp = Math.hypot(b.vx, b.vy), a = Math.atan2(b.vy, b.vx) + da;
          balls.push({ x: b.x, y: b.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, last: b.last });
        }
        break;
      case 'grow':    if (o) o.growUntil = tick + GROW_TICKS; break;
      case 'shield':  if (o) o.shieldUntil = tick + SHIELD_TICKS; break;
      case 'ghost':   b.ghost = true; break;
      case 'invert':  { const t = randomOpponent(o); if (t) t.invertUntil = tick + INVERT_TICKS; } break;
      case 'shrinkT': { const t = randomOpponent(o); if (t) t.shrinkUntil = tick + SHRINKT_TICKS; } break;
      case 'slow':    slowUntil = tick + SLOW_TICKS; break;
      case 'mini':    if (o) o.shrinkUntil = tick + SHRINKT_TICKS; break;
      case 'flip':    if (o) o.invertUntil = tick + INVERT_TICKS; break;
      case 'speed':   for (const bb of balls) { bb.vx *= 1.5; bb.vy *= 1.5; } break;
      case 'blocker': if (bumpers.length < MAX_BUMPERS) { const ang = Math.random() * Math.PI * 2, rad = R * (0.25 + Math.random() * 0.35); bumpers.push({ x: CX + Math.cos(ang) * rad, y: CY + Math.sin(ang) * rad, r: BUMPER_R, orbAng: 0, orbR: 0, orbSp: 0, until: tick + BLOCKER_TICKS }); } break; // mur-bloqueur : bumper temporaire
      case 'invis':   b.invisUntil = tick + INVIS_TICKS; break;                       // balle invisible
      case 'magnet':  if (o) o.magnetUntil = tick + MAGNET_TICKS; break;               // aimant : ta raquette attire les balles
    }
  }
  function maybeSpawnPowerup() {
    if (!cfg.pu || tick < nextPuTick) return;
    nextPuTick = tick + cfg.puMin + Math.floor(Math.random() * (cfg.puMax - cfg.puMin));
    if (powerups.length >= MAX_FIELD_PU) return;
    const bad = rules.negatives && Math.random() < 0.33;
    const pool = bad ? PU_BAD : PU_GOOD;
    const type = pool[Math.floor(Math.random() * pool.length)];
    const ang = Math.random() * Math.PI * 2, rad = Math.random() * (R * 0.45);
    powerups.push({ x: CX + Math.cos(ang) * rad, y: CY + Math.sin(ang) * rad, type, bad });
  }
  function makeBumpers() {                            // 2 plots qui orbitent autour du centre (mode bumpers)
    const orbR = R * 0.4;
    return [
      { x: CX + orbR, y: CY, r: BUMPER_R, orbAng: 0, orbR, orbSp: 0.012, until: 0 },
      { x: CX - orbR, y: CY, r: BUMPER_R, orbAng: Math.PI, orbR, orbSp: 0.012, until: 0 },
    ];
  }
  function ballBumpers(b) {                           // rebond de la balle sur un bumper (cercle)
    for (const bm of bumpers) {
      const dx = b.x - bm.x, dy = b.y - bm.y, rr = bm.r + BALL_R, d2 = dx * dx + dy * dy;
      if (d2 < rr * rr) {
        const d = Math.sqrt(d2) || 1, nx = dx / d, ny = dy / d, vd = b.vx * nx + b.vy * ny;
        if (vd < 0) { b.vx -= 2 * vd * nx; b.vy -= 2 * vd * ny; }
        b.x = bm.x + nx * (rr + 0.5); b.y = bm.y + ny * (rr + 0.5);
        fx.push({ type: 'bump', x: b.x, y: b.y });
      }
    }
  }
  function computeLeader() {
    players.forEach(p => p.isLeader = false);
    if (!rules.handicap) return;
    const alive = players.filter(inPlay);
    if (alive.length < 2) return;
    const key = p => p.lives * 1000 + p.kills;
    let mx = -1, lead = null, count = 0;
    for (const p of alive) { const k = key(p); if (k > mx) { mx = k; lead = p; count = 1; } else if (k === mx) count++; }
    if (count === 1 && lead) lead.isLeader = true;
  }
  function endByKills(killerSeat) {
    gameState = 'over'; endTick = tick;
    winner = players[killerSeat].team;
    players.forEach(p => { if (p.edge >= 0 && p.team === winner) p.score++; });
    players.forEach(p => { if (p.edge >= 0 && p.alive) p.place = 1; });
    matchWonPending = true; matchWinner = winner;
    recordRound();
  }
  function aliveTeams() { return new Set(players.filter(inPlay).map(p => p.team)); }
  function checkWin() {
    if (nParts === 1) {                                // entraînement solo : la manche ne s'arrête que quand le joueur n'a plus de vies
      if (players.some(inPlay)) return false;
      gameState = 'over'; endTick = tick; winner = -1;
      recordRound();                                   // no-op en solo (guard nParts<2) : hors classement
      return true;
    }
    const s = aliveTeams();
    if (s.size > 1) return false;
    gameState = 'over'; endTick = tick;
    winner = s.size === 1 ? [...s][0] : -1;
    if (winner >= 0) players.forEach(p => { if (p.edge >= 0 && p.team === winner) p.score++; });
    players.forEach(p => { if (p.edge >= 0 && p.alive) p.place = 1; });
    if (winner >= 0 && rules.winMode === 'rounds') {
      const champ = players.find(p => p.edge >= 0 && p.team === winner);
      if (champ && champ.score >= rules.roundsTarget) { matchWonPending = true; matchWinner = winner; }
    }
    recordRound();
    return true;
  }
  function ballPaddles(b, max) {
    for (let ei = 0; ei < geo.edges.length; ei++) {
      if (ei === b.last) continue;
      const e = geo.edges[ei];
      if (e.owner < 0) continue;
      const p = players[e.owner];
      if (!inPlay(p)) continue;
      const s = (b.x - e.ax) * e.tx + (b.y - e.ay) * e.ty;
      const d = (b.x - e.ax) * e.nx + (b.y - e.ay) * e.ny;
      const L = padLenOf(p);
      // Compensation de latence : le client PRÉDIT sa raquette (client.js · predireMoi) et la voit donc
      // en avance sur le serveur d'environ une latence. Une raquette humaine EN MOUVEMENT reçoit donc une
      // avance de collision dans son sens de marche (LEAD_TICKS de trajet), sinon une balle rattrapée
      // de justesse avec le bout de la raquette était vue rattrapée à l'écran mais comptée ratée.
      const lead = (!p.bot && p.mv) ? PAD_SPD * LEAD_TICKS : 0;
      const ns = Math.max(p.pos - L / 2 - (p.mv < 0 ? lead : 0), Math.min(s, p.pos + L / 2 + (p.mv > 0 ? lead : 0)));
      const nd = Math.max(PAD_OFF, Math.min(d, PAD_OFF + PAD_W));
      if ((s - ns) ** 2 + (d - nd) ** 2 >= BALL_R * BALL_R) continue;
      if (b.ghost) { b.ghost = false; fx.push({ type: 'ghost', side: p.seat, x: b.x, y: b.y }); return; }
      // angle de renvoi piloté par le point d'impact : centre => tout droit, bords => fort angle latéral
      const u = Math.max(-1, Math.min(1, (s - p.pos) / (L / 2)));
      const speed = Math.hypot(b.vx, b.vy) * HIT_SPEEDUP;
      const ang = u * PADDLE_MAX_ANGLE;
      const vd = Math.cos(ang) * speed;
      const vt = Math.sin(ang) * speed;
      b.vx = vt * e.tx + vd * e.nx;
      b.vy = vt * e.ty + vd * e.ny;
      clampSpeed(b, max);
      const newd = PAD_OFF + PAD_W + BALL_R + 1;
      b.x = e.ax + s * e.tx + newd * e.nx;
      b.y = e.ay + s * e.ty + newd * e.ny;
      b.last = ei;
      p.hits++; roundBounces++;
      fx.push({ type: 'hit', side: p.seat, x: b.x, y: b.y });
      return;
    }
  }
  function ballPowerups(b) {
    for (let i = powerups.length - 1; i >= 0; i--) {
      const pu = powerups[i];
      if ((b.x - pu.x) ** 2 + (b.y - pu.y) ** 2 < (PU_R + BALL_R) ** 2) {
        const collector = b.last >= 0 ? geo.edges[b.last].owner : -1;
        applyPowerup(pu.type, b);
        if (collector >= 0 && !pu.bad) players[collector].pu++;
        fx.push({ type: 'powerup', pu: pu.type, x: pu.x, y: pu.y, side: collector, bad: !!pu.bad });
        powerups.splice(i, 1);
        return;
      }
    }
  }
  function ballEdges(bi, max) {
    const b = balls[bi];
    let me = -1, md = Infinity;
    for (let ei = 0; ei < geo.edges.length; ei++) {
      const e = geo.edges[ei];
      const d = (b.x - e.ax) * e.nx + (b.y - e.ay) * e.ny;
      if (d < md) { md = d; me = ei; }
    }
    if (md >= BALL_R) return false;
    const e = geo.edges[me];
    const bounce = () => {
      const vd = b.vx * e.nx + b.vy * e.ny;
      b.vx -= 2 * vd * e.nx; b.vy -= 2 * vd * e.ny;
      // Anti-blocage (cf. WALL_MIN_TAN) : on garantit que la balle se déplace TOUJOURS un minimum
      // le long de la paroi, donc qu'elle finit par faire le tour du polygone et rencontrer une raquette.
      const sp = Math.hypot(b.vx, b.vy) || 1;
      let ct = (b.vx * e.tx + b.vy * e.ty) / sp + (Math.random() * 2 - 1) * WALL_JITTER;   // part tangentielle
      if (ct > 1) ct = 1; else if (ct < -1) ct = -1;
      if (Math.abs(ct) < WALL_MIN_TAN) ct = ct < 0 ? -WALL_MIN_TAN : WALL_MIN_TAN;
      const cn = Math.sqrt(Math.max(0.04, 1 - ct * ct));                                   // part normale, toujours vers l'intérieur
      b.vx = (e.tx * ct + e.nx * cn) * sp;
      b.vy = (e.ty * ct + e.ny * cn) * sp;
      const dd = (b.x - e.ax) * e.nx + (b.y - e.ay) * e.ny;
      b.x += (BALL_R + 1 - dd) * e.nx; b.y += (BALL_R + 1 - dd) * e.ny;
      clampSpeed(b, max);
      b.last = -1;
    };
    // Mur d'un joueur éliminé : il renvoie la balle un peu PLUS VITE, comme un bumper.
    // Retour de test : au-delà de 5 joueurs les fins de partie s'éternisaient — chaque élimination
    // ajoutait un mur passif et il restait de moins en moins de raquettes pour conclure. Désormais
    // chaque mur mort accélère le jeu, donc la pression monte toute seule à mesure que le terrain
    // se vide. Plafonné par clampSpeed : la balle ne peut pas s'emballer.
    const bounceWall = () => {
      bounce();
      if (!wallBoostOn()) return;
      const sp = Math.hypot(b.vx, b.vy) || 1;
      const palier = Math.min(max, sp * WALL_GAIN);     // gain permanent (plafonné) : c'est lui qui écourte la manche
      const f = (palier * WALL_BURST) / sp;
      b.vx *= f; b.vy *= f;                             // pic immédiat, volontairement AU-DESSUS du plafond
      b.burstTo = palier;                               // vitesse vers laquelle redescendre (cf. boucle de mouvement)
      fx.push({ type: 'wallboost', side: -1, x: b.x, y: b.y });
    };
    if (e.owner < 0) { bounceWall(); return false; }
    const p = players[e.owner];
    if (!inPlay(p)) { bounceWall(); return false; }
    if (p.shieldUntil > tick || p.immuneUntil > tick) {
      bounce();
      if (p.shieldUntil > tick) fx.push({ type: 'shield', side: p.seat, x: b.x, y: b.y });
      return false;
    }
    const killer = b.last >= 0 ? geo.edges[b.last].owner : -1;
    const credited = killer >= 0 && killer !== p.seat;
    p.lives--;
    lastConceder = p.seat;
    if (credited) players[killer].dmg++;
    const elim = p.lives <= 0;
    fx.push({ type: 'death', side: p.seat, x: b.x, y: b.y, by: credited ? killer : -1, elim });
    if (elim) {
      p.alive = false; p.elimBy = killer; p.elimTick = tick;
      p.place = nParts - deaths; deaths++;
      if (credited) {
        players[killer].kills++; players[killer].matchKills++;
        if (rules.winMode === 'kills' && players[killer].matchKills >= rules.killsTarget) { endByKills(killer); return true; }
      }
    } else p.immuneUntil = tick + IMMUNE_TICKS;
    balls.splice(bi, 1);
    if (balls.length === 0) balls.push(makeBall());
    if (checkWin()) return true;
    return false;
  }
  function humanMove(p) {
    const e = geo.edges[p.edge], L = padLenOf(p);
    let d = (p.up ? -1 : 0) + (p.dn ? 1 : 0);          // intention ÉCRAN : -1 = haut/gauche, +1 = bas/droite
    if (p.invertUntil > tick) d = -d;                   // malus inversion
    if (!d) { p.mv = 0; return; }
    // selon le sens de parcours de l'arête, +pos va vers le bas/droite (sign=+1) ou le haut/gauche (sign=-1).
    // On l'inverse pour que « haut » fasse TOUJOURS monter la raquette à l'écran (sinon les arêtes opposées sont inversées entre joueurs).
    const sign = ((Math.abs(e.ty) >= Math.abs(e.tx)) ? e.ty > 0 : e.tx > 0) ? 1 : -1;
    const avant = p.pos;
    p.pos = Math.max(L / 2, Math.min(e.len - L / 2, p.pos + d * sign * PAD_SPD));
    p.mv = p.pos > avant ? 1 : p.pos < avant ? -1 : 0;  // sens RÉEL du mouvement (0 contre une butée) : cf. ballPaddles
  }
  function update() {
    fx = [];
    if (!geo) return;
    if (gameState === 'countdown') {
      tick++;
      for (const p of players) { if (!inPlay(p)) continue; if (p.bot) botMove(p); else humanMove(p); }
      if (tick >= countdownUntil) { gameState = 'play'; tick = 0; nextPuTick = cfg.puMin; }
      return;
    }
    if (gameState !== 'play') return;
    tick++;
    computeLeader();
    if (rules.sudden !== 'off' && !sdActive && aliveTeams().size === 2) sdActive = true;
    if (sdActive && rules.sudden === 'shrink') {
      sdScale = Math.max(0.55, sdScale - 0.0008);
      applyScale(sdScale);
      for (const p of players) if (inPlay(p)) { const e = geo.edges[p.edge], L = padLenOf(p); p.pos = Math.max(L / 2, Math.min(e.len - L / 2, p.pos)); }
    }
    for (const p of players) { if (!inPlay(p)) continue; if (p.bot) botMove(p); else humanMove(p); }
    const sdAccel = sdActive && rules.sudden === 'accel';
    if (cfg.accelEvery && tick % cfg.accelEvery === 0) for (const b of balls) { b.vx *= cfg.accelMul; b.vy *= cfg.accelMul; }
    if (sdAccel && tick % 30 === 0) for (const b of balls) { b.vx *= 1.04; b.vy *= 1.04; }
    let curMax = cfg.max * (cfg.accelEvery ? (1 + tick / 7200) : 1);   // montée du plafond adoucie (×2 en 2 min au lieu d'1)
    // Chaque bord éliminé relève aussi le PLAFOND de vitesse. Sans ça, la relance des murs-bumpers
    // était absorbée par le plafond dès que la balle y était collée : très visible, mais sans effet
    // sur la durée. C'est ce facteur-là qui écourte réellement la fin de manche.
    if (wallBoostOn() && geo) {
      let morts = 0;
      for (const e of geo.edges) if (e.owner < 0 || !inPlay(players[e.owner])) morts++;
      if (morts) curMax *= Math.min(1.5, 1 + WALL_CAP_GAIN * morts);
    }
    if (sdAccel) curMax = Math.max(curMax, cfg.max * 1.6);
    // aimant : oriente les balles vers la raquette du porteur (vitesse conservée, pas d'emballement)
    for (const p of players) if (inPlay(p) && p.magnetUntil > tick) {
      const e = geo.edges[p.edge], mx = e.ax + e.tx * p.pos, my = e.ay + e.ty * p.pos;
      for (const b of balls) { const sp = Math.hypot(b.vx, b.vy) || 1, tx = mx - b.x, ty = my - b.y, td = Math.hypot(tx, ty) || 1; b.vx += tx / td * 0.22; b.vy += ty / td * 0.22; const ns = Math.hypot(b.vx, b.vy) || 1; b.vx = b.vx / ns * sp; b.vy = b.vy / ns * sp; }
    }
    // bumpers : rotation des orbiteurs + retrait des temporaires expirés
    if (bumpers.length) { for (const bm of bumpers) if (bm.orbR > 0) { bm.orbAng += bm.orbSp; bm.x = CX + Math.cos(bm.orbAng) * bm.orbR; bm.y = CY + Math.sin(bm.orbAng) * bm.orbR; } bumpers = bumpers.filter(bm => !bm.until || tick <= bm.until); }
    const slowF = slowUntil > tick ? SLOW_FACTOR : 1;
    for (const b of balls) {
      b.x += b.vx * slowF; b.y += b.vy * slowF;
      if (b.burstTo) {                                  // retombée progressive après le pic d'un mur-bumper
        const sp = Math.hypot(b.vx, b.vy);
        if (sp > b.burstTo * 1.01) { const f = Math.max(b.burstTo / sp, WALL_BURST_DECAY); b.vx *= f; b.vy *= f; }
        else b.burstTo = 0;
      }
    }
    if (bumpers.length) for (const b of balls) ballBumpers(b);
    for (const b of balls) ballPaddles(b, curMax);
    for (const b of balls) ballPowerups(b);
    for (let bi = balls.length - 1; bi >= 0; bi--) if (ballEdges(bi, curMax)) return;
    maybeSpawnPowerup();
  }
  function snapshot() {
    let geoOut = null;                                 // null = pas de terrain ; undefined = inchangée (le client réutilise la sienne)
    if (geo) {
      if (geoSent !== geoVer || tick % 30 === 0 || gameState !== 'play') { geoSent = geoVer; geoOut = { edges: geo.edges.map(e => ({ ax: r1(e.ax), ay: r1(e.ay), bx: r1(e.bx), by: r1(e.by), tx: e.tx, ty: e.ty, nx: e.nx, ny: e.ny, len: r1(e.len), owner: e.owner })) }; }
      else geoOut = undefined;
    }
    return {
      gs: gameState, winner, fx, botCount, connected: connectedCount(), maxBots: maxBots(),
      mode, nteams, preset, maxLives: cfg.lives, aw: W, ah: H,
      wallBoost: wallBoostOn(),                        // le client dessine les bords éliminés en bumpers
      pspd: Math.round(PAD_SPD * 100) / 100,           // vitesse raquette par tick : le client PRÉDIT la sienne avec
      count: gameState === 'countdown' ? Math.max(0, Math.ceil((countdownUntil - tick) / 60)) : 0,
      sd: sdActive, slow: slowUntil > tick,
      opts: {
        lives: cfg.lives, pu: cfg.pu, accel: cfg.accelEvery > 0, speed: cfg.speedLevel,
        winMode: rules.winMode, roundsTarget: rules.roundsTarget, killsTarget: rules.killsTarget,
        sudden: rules.sudden, serve: rules.serve, handicap: rules.handicap,
        negatives: rules.negatives, botDiff: rules.botDiff, botStyle: rules.botStyle, bumpers: rules.bumpers,
      },
      stats: gameState === 'over' ? { durationSec: Math.round(endTick / 60), bounces: roundBounces, nParts, match: matchWonPending } : null,
      geo: geoOut,
      balls: balls.map(b => {                        // gh / iv : présents seulement s'ils sont vrais (absent = faux, lu par vérité côté client)
        const o = { x: r1(b.x), y: r1(b.y), vx: r1(b.vx), vy: r1(b.vy), o: b.last >= 0 ? geo.edges[b.last].owner : -1 };
        if (b.ghost) o.gh = true; if (b.invisUntil > tick) o.iv = true;
        return o;
      }),
      powerups: powerups.map(p => ({ x: p.x | 0, y: p.y | 0, type: p.type, bad: !!p.bad })),
      bumpers: bumpers.map(bm => ({ x: r1(bm.x), y: r1(bm.y), r: bm.r, t: !!bm.until })),
      players: players.map(p => ({
        seat: p.seat, edge: p.edge, pos: r1(p.pos), team: p.team,
        lives: Math.max(0, p.lives), alive: p.alive, playing: p.playing, connected: !!p.member, bot: p.bot,
        name: p.name, score: p.score, len: Math.round(padLenOf(p)),
        grow: p.growUntil > tick, shield: p.shieldUntil > tick, immune: p.immuneUntil > tick,
        inv: p.invertUntil > tick, shr: p.shrinkUntil > tick, mag: p.magnetUntil > tick,
        buffs: [                                        // [clé, fraction restante] pour les barres dégressives sur les cartes
          p.growUntil > tick && ['grow', Math.round((p.growUntil - tick) / GROW_TICKS * 100) / 100],
          p.shieldUntil > tick && ['shield', Math.round((p.shieldUntil - tick) / SHIELD_TICKS * 100) / 100],
          p.invertUntil > tick && ['invert', Math.round((p.invertUntil - tick) / INVERT_TICKS * 100) / 100],
          p.shrinkUntil > tick && ['shrink', Math.round((p.shrinkUntil - tick) / SHRINKT_TICKS * 100) / 100],
          p.magnetUntil > tick && ['magnet', Math.round((p.magnetUntil - tick) / MAGNET_TICKS * 100) / 100],
        ].filter(Boolean),
        hits: p.hits, puGot: p.pu, kills: p.kills, dmg: p.dmg, matchKills: p.matchKills, lead: p.isLeader,
        elimBy: p.elimBy, elimTick: p.elimTick, place: p.place,
      })),
    };
  }

  /* ---- interface du module de jeu (appelée par le hub) ---- */
  function onJoin(member) {
    const cur = seatOf(member); if (cur >= 0) return { role: 'player', seat: cur, hello: { t: 'welcome', seat: cur, maxLives: cfg.lives } }; // déjà assis (reconnexion within grace) : idempotent
    let seat = -1;
    const rid = seatByMid[member.id];
    if (rid != null && players[rid] && !players[rid].member && !players[rid].bot) seat = rid; // reprise du siège
    if (seat < 0) { const free = players.find(p => !p.member && !p.bot); if (free) seat = free.seat; }
    if (seat < 0) return { role: 'spectator', hello: { t: 'welcome', seat: -1, maxLives: cfg.lives } }; // plus de place => spectateur
    const p = players[seat];
    p.member = member; p.mid = member.id; p.name = member.name || '';
    seatByMid[member.id] = seat;
    if (editable()) lobbyConfigure();
    return { role: 'player', seat, hello: { t: 'welcome', seat, maxLives: cfg.lives } };
  }
  function onLeave(member) {
    const seat = seatOf(member); if (seat < 0) return;
    const p = players[seat];
    p.member = null; p.up = p.dn = false;
    if (gameState === 'play' || gameState === 'paused') {
      if (p.playing) { p.playing = false; if (p.edge >= 0 && geo) geo.edges[p.edge].owner = -1; p.edge = -1; }
      if (connectedCount() === 0) fullReset(); else checkWin();
    } else if (gameState === 'countdown') {
      if (p.playing) { p.playing = false; if (p.edge >= 0 && geo) geo.edges[p.edge].owner = -1; p.edge = -1; }
      if (connectedCount() === 0) fullReset();
      else if (players.filter(q => q.playing).length < 2) { gameState = 'lobby'; configure(); } // plus assez de joueurs : on annule le décompte, retour au lobby
    } else {
      if (connectedCount() === 0) fullReset(); else lobbyConfigure();
    }
  }
  function onRename(member) { const s = seatOf(member); if (s >= 0) players[s].name = member.name || ''; }
  function onMessage(member, m) {
    if (!m || typeof m !== 'object') return;
    const seat = seatOf(member);
    const p = seat >= 0 ? players[seat] : null;
    if (m.t === 'vote' && seat < 0) {
      if (gameState === 'play' && tick - lastVoteTick > 5 * 60 && powerups.length < MAX_FIELD_PU) {
        lastVoteTick = tick;
        const type = PU_GOOD[Math.floor(Math.random() * PU_GOOD.length)];
        const ang = Math.random() * Math.PI * 2, rad = Math.random() * (R * 0.45);
        powerups.push({ x: CX + Math.cos(ang) * rad, y: CY + Math.sin(ang) * rad, type, bad: false });
      }
    } else if (m.t === 'input' && p) { p.up = !!m.up; p.dn = !!m.dn; }
    else if (m.t === 'start') startGame();
    else if (m.t === 'pause') { if (gameState === 'play') gameState = 'paused'; else if (gameState === 'paused') gameState = 'play'; }
    else if (m.t === 'abort') backToLobby();
    else if (m.t === 'bots') {
      if (editable()) { const mx = maxBots(); botCount = mx <= 0 ? 0 : (botCount + 1) % (mx + 1); lobbyConfigure(); }
    } else if (m.t === 'mode') {
      if (editable()) { const v = validModes(partCount()); mode = v[(v.indexOf(mode) + 1) % v.length] || 'ffa'; lobbyConfigure(); }
    } else if (m.t === 'preset') {
      if (editable()) { preset = PRESET_ORDER[(PRESET_ORDER.indexOf(preset) + 1) % PRESET_ORDER.length]; cfg = PRESETS[preset](); }
    } else if (m.t === 'opt') {
      if (editable()) {
        const op = m.op;
        if (op === 'lives' || op === 'pu' || op === 'accel' || op === 'speed') {
          if (op === 'lives') cfg.lives = Math.max(1, Math.min(9, cfg.lives + (typeof m.d === 'number' && m.d > 0 ? 1 : -1)));
          else if (op === 'pu') cfg.pu = !cfg.pu;
          else if (op === 'accel') cfg.accelEvery = cfg.accelEvery ? 0 : ACCEL_EVERY;
          else { const s = SPEED_ORDER[(SPEED_ORDER.indexOf(cfg.speedLevel) + 1) % SPEED_ORDER.length]; cfg.speedLevel = s; cfg.init = SPEED[s].init; cfg.max = SPEED[s].max; }
          preset = 'custom';
        }
        else if (op === 'winmode') rules.winMode = WINMODE_ORDER[(WINMODE_ORDER.indexOf(rules.winMode) + 1) % WINMODE_ORDER.length];
        else if (op === 'sudden') rules.sudden = SUDDEN_ORDER[(SUDDEN_ORDER.indexOf(rules.sudden) + 1) % SUDDEN_ORDER.length];
        else if (op === 'serve') rules.serve = SERVE_ORDER[(SERVE_ORDER.indexOf(rules.serve) + 1) % SERVE_ORDER.length];
        else if (op === 'handicap') rules.handicap = !rules.handicap;
        else if (op === 'rtar') rules.roundsTarget = Math.max(1, Math.min(9, rules.roundsTarget + (typeof m.d === 'number' && m.d > 0 ? 1 : -1)));
        else if (op === 'ktar') rules.killsTarget = Math.max(3, Math.min(30, rules.killsTarget + (typeof m.d === 'number' && m.d > 0 ? 1 : -1)));
        else if (op === 'negatives') rules.negatives = !rules.negatives;
        else if (op === 'botdiff') rules.botDiff = BOTDIFF_ORDER[(BOTDIFF_ORDER.indexOf(rules.botDiff) + 1) % BOTDIFF_ORDER.length];
        else if (op === 'botstyle') rules.botStyle = BOTSTYLE_ORDER[(BOTSTYLE_ORDER.indexOf(rules.botStyle) + 1) % BOTSTYLE_ORDER.length];
        else if (op === 'bumpers') rules.bumpers = !rules.bumpers;
      }
    } else if (m.t === 'lbreset') reset(GID);
  }
  function tick_() {
    for (const p of players) if (p.member) p.name = p.member.name || p.name || '';
    update();
    return snapshot();
  }

  fullReset();
  return { onJoin, onLeave, onRename, onMessage, tick: tick_, isIdle: editable };
}

export default { meta: { id: GID, name: 'Pong', min: 2, max: 10, tickHz: TICK_HZ, desc: '2 à 10 joueurs · terrain adaptatif · équipes · power-ups' }, create: createPong };
