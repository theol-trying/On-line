// Jeu FOOT — terrain polygonal vu de dessus, UNE CAGE PAR ÉQUIPE (même principe que les raquettes de Pong ; en
// « chacun pour soi », chaque joueur est une équipe d'un), un seul ballon au centre. Chaque but encaissé coûte une vie
// à l'équipe ; à zéro, toute l'équipe est éliminée et sa cage se ferme (son côté devient un mur). La dernière équipe
// en lice gagne. Le terrain a autant de côtés-cages que d'équipes (2 : carré, cages face à face ; 3 : triangle…),
// AJUSTÉ au cadre ; sa TAILLE suit le nombre de joueurs.
// Ballon collé au premier qui le touche ; Espace maintenu = tir chargé, E = tacle (assomme), Maj = sprint (endurance).
// 5 terrains (effets de surface, zones, obstacles, murs, vent) et 3 bonus / 3 malus au sol, choisis au menu (game master).
// Physique continue à 30 Hz, comme le Sumo dont ce fichier reprend la structure.
import { AR0, MARGE, PR, BR, POST_R, GOAL0, GOAL_SD, TERRAINS, ITEMS } from '../../public/games/foot/shared.js';
import { board, pushHistory, save, markDirty, reset, bumpDaily } from '../../leaderboard.js';

const GID = 'foot';
const MAX_SEATS = 10;
const TICK_HZ = 30;
const COUNTDOWN_TICKS = 3 * TICK_HZ;
// course : plus vive et plus glissante que le Sumo (on court, on ne pousse pas) ; le PORTEUR court 12 % moins
// vite, sinon personne ne le rattraperait jamais
const ACC = 0.9, VMAX = 5.4, FRICTION = 0.84, CARRY_SPD = 0.88, TURN = 0.42;
// SPRINT (Maj) : endurance 0..1 — vidée en 1,6 s de sprint, rechargée en 3 s après 0,4 s de repos. À vide : essoufflé,
// plus de sprint avant 30 %. Vitesse ×1,4, accélération ×1,2 ; impossible en chargeant un tir, sonné ou à terre.
const SPRINT_SPD = 1.4, SPRINT_ACC = 1.2, STA_DRAIN = 1 / (1.6 * TICK_HZ), STA_REGEN = 1 / (3 * TICK_HZ), STA_DELAY = 12, STA_MIN = 0.3;
// ballon : frottement de pelouse, rebonds amortis (rééquilibrage du 25/09 : plus de buts « de flipper » par hasard)
const BALL_FR = 0.968, BALL_VMAX = 26, WALL_REST = 0.5, POST_REST = 0.7;
// tir CHARGÉ : Espace maintenu, tir au relâchement — de 7 u/tick (passe) à 21 (boulet) en 0,9 s ; le porteur court à 70 %
// pendant la charge. Au-delà de STICK_MAX, un ballon qui touche un joueur REBONDIT au lieu de se coller.
const SHOT_MIN = 7, SHOT_MAX = 21, CHARGE_TICKS = 27, CHARGE_SPD = 0.7, SHOT_SPREAD = 0.12, SHOT_CD = 10, GRAB_BLOCK = 9, STICK_MAX = 13.5, DEFLECT_REST = 0.45;
// tacle : glissade brève qui ASSOMME le premier adversaire touché (1 s) SANS toucher au ballon ; raté = à terre 0,5 s ; recharge 2 s
const TACKLE_IMP = 8, TACKLE_TICKS = 8, TACKLE_CD = 60, STUN_TICKS = 30, MISS_TICKS = 15, BUMP = 1.5;
const LIVES_CYCLE = [3, 5, 1, 2];               // réglage « vies » du game master (le premier est le défaut)
const GOAL_FREEZE = 40;                         // ~1,3 s de célébration, puis engagement au centre
// prolongations : après 90 s les cages s'élargissent (de 36 à 58 % du côté en 60 s) ; filet absolu à 6 min
const SD_START = 90 * TICK_HZ, SD_GROW = 60 * TICK_HZ, TIME_CAP = 360 * TICK_HZ;
const CREDIT_TICKS = 150;                       // but crédité au dernier « kick » adverse des 5 dernières secondes

/* TERRAINS — surface (frottement, adhérence, vitesse), ballon, murs, et éléments propres :
   stade   classique, aucun effet ;
   boue    sous la pluie : 4 à 6 FLAQUES où l'on s'enlise (×0,55) et où le ballon meurt ; murs détrempés (amortis) ;
   glace   patinoire : on glisse (adhérence ×0,5), le ballon file, les bandes de plexi rebondissent ;
   flipper arcade néon : des BUMPERS relancent violemment le ballon et repoussent les joueurs ; murs élastiques ;
   tempete plage : un VENT change de sens toutes les 8 s (annoncé 2 s avant) et pousse le ballon ; bancs de SABLE (×0,72). */
const TER = {
  stade:   { fr: FRICTION, acc: 1, vmax: 1, ballFr: BALL_FR, wall: WALL_REST },
  boue:    { fr: FRICTION, acc: 1, vmax: 1, ballFr: 0.962, wall: 0.35, zone: 'mud', nz: [4, 6], rz: [42, 70] },
  glace:   { fr: 0.955, acc: 0.5, vmax: 1.12, ballFr: 0.988, wall: 0.85 },
  flipper: { fr: FRICTION, acc: 1, vmax: 1, ballFr: BALL_FR, wall: 0.92, bumpers: true },
  tempete: { fr: FRICTION, acc: 1, vmax: 1, ballFr: 0.972, wall: 0.5, zone: 'sand', nz: [3, 4], rz: [48, 78], wind: true },
};
const ZONE_FX = { mud: { vmax: 0.55, acc: 0.6, ballFr: 0.9 }, sand: { vmax: 0.72, acc: 0.75, ballFr: 0.94 } };
const ZONE_KIND = ['mud', 'sand'];
const BUMP_R = 20, BUMP_KICK = 15, BUMP_PUSH = 6;
const WIND_EVERY = 8 * TICK_HZ, WIND_WARN = 2 * TICK_HZ, WIND_BALL = 0.14, WIND_PLAYER = 0.035;
/* BONUS (pour celui qui ramasse) : turbo — endurance illimitée et +15 % de vitesse 8 s · canon — 2 tirs à pleine puissance,
   sans dispersion et 20 % plus forts (12 s max) · mur — sa cage rétrécit de moitié 10 s.
   MALUS (pour tous ses ADVERSAIRES, coéquipiers épargnés) : géante — leurs cages s'élargissent de 60 % 8 s · glu — ralentis
   ×0,6 et sans sprint 5 s · inverse — commandes inversées 4 s. Un objet toutes les 6 s, 2 au plus sur le terrain. */
const ITEM_EVERY = 6 * TICK_HZ, ITEM_MAX = 2, ITEM_R = 13;
const TURBO_T = 8 * TICK_HZ, TURBO_SPD = 1.15, CANON_SHOTS = 2, CANON_T = 12 * TICK_HZ, CANON_MUL = 1.2, MUR_T = 10 * TICK_HZ, MUR_K = 0.5;
const GEANTE_T = 8 * TICK_HZ, GEANTE_K = 1.6, GLU_T = 5 * TICK_HZ, GLU_SPD = 0.6, INV_T = 4 * TICK_HZ;
// IA : Facile / Normale / Difficile — cadence, vitesse, dispersion du tir, envie de tacler, portée de tir, gardien, bonus
const FTDIFF = [
  { every: 6, spd: 0.8, noise: 0.7, tackleP: 0.25, shoot: 0.55, keeper: false, pick: 0.2 },
  { every: 3, spd: 0.95, noise: 0.35, tackleP: 0.6, shoot: 0.7, keeper: true, pick: 0.5 },
  { every: 2, spd: 1, noise: 0.15, tackleP: 0.9, shoot: 0.82, keeper: true, pick: 0.8 },
];
const TEAM_COUNT = { ffa: 0, '2v2': 2, '2v2v2': 3, '3v3': 2, '4v4': 2, '2v2v2v2': 4, '3v3v3': 3, '5v5': 2, '2v2v2v2v2': 5 };
const numTeamsFor = (m, N) => (m === 'ffa' ? N : TEAM_COUNT[m]);
function validModes(N) {                        // modes d'équipe selon le nombre EXACT de participants (5 équipes au plus)
  const v = ['ffa'];
  if (N === 4) v.push('2v2');
  if (N === 6) v.push('2v2v2', '3v3');
  if (N === 8) v.push('4v4', '2v2v2v2');
  if (N === 9) v.push('3v3v3');
  if (N === 10) v.push('5v5', '2v2v2v2v2');
  return v;
}
// Arène à l'échelle : la taille d'un joueur ne change pas, c'est le terrain qui grandit (+7 % par joueur au-delà de 2)
const scaleFor = n => 1 + 0.07 * (Math.max(2, Math.min(MAX_SEATS, n)) - 2);
const r1 = v => Math.round(v * 10) / 10;
const r2 = v => Math.round(v * 100) / 100;

export function createFoot(room) {
  let players, gameState, tick, round, countdownUntil, winner, fx, mode, nteams, nParts, deaths, endTick, botCount, botDiff, lives;
  let ar, geo, ball, freezeUntil, sdOn, teamLives = [];
  // réglages du game master : terrain (ou « hasard ») et objets actifs ; ter = terrain EN VIGUEUR pour la manche
  let terSel = 'stade', itemsOn = {}, ter = 'stade';
  let zones = [], bumpers = [], wind = { x: 0, y: 0 }, windNext = null, windAt = 0, windWarned = false, itemAt = 0, pickups = [], teamMur = [], teamGeante = [], bumpGap = {};
  let seatByMid = {};
  // Effets : pendant un tick ils partent dans fx ; entre deux ticks (lancement, départ d'un joueur) ils attendent dans
  // pend, sinon update() les effacerait avant la diffusion.
  let pend = [], dansTick = false;
  const emit = o => { (dansTick ? fx : pend).push(o); };

  function lbEntry(name) {
    const b = board(GID);
    return (Object.hasOwn(b, name) && b[name]) || (b[name] = { name, games: 0, wins: 0, kills: 0, goals: 0, deaths: 0, survSum: 0, bestSurvivalSec: 0 });
  }
  function recordRound() {
    for (const p of players) {
      if (!p.playing || !p.name || p.bot) continue;   // les bots n'entrent pas au classement
      const e = lbEntry(p.name);
      e.games++;
      if (winner >= 0 && p.team === winner) e.wins++;
      bumpDaily(p.name, { win: winner >= 0 && p.team === winner, kills: p.kills, game: GID });
      e.kills += p.kills; e.goals = (e.goals || 0) + p.goals;
      const surv = (p.elimTick >= 0 ? p.elimTick : endTick) / TICK_HZ;
      e.survSum += surv;
      if (surv > e.bestSurvivalSec) e.bestSurvivalSec = surv;
      if (p.elimTick >= 0) e.deaths++;
    }
    const champ = winner >= 0 ? players.find(p => p.playing && p.team === winner) : null;
    pushHistory(GID, { when: Date.now(), mode, preset: ter,
      winner: champ ? (nteams < nParts ? 'Équipe ' + 'ABCDE'[winner] : (champ.name || ('P' + (champ.seat + 1)))) : 'Égalité',
      durationSec: Math.round(endTick / TICK_HZ), nParts });
    save(); markDirty(GID);
  }

  function makePlayers() {
    return Array.from({ length: MAX_SEATS }, (_, seat) => ({
      seat, member: null, mid: null, name: '', team: 0, alive: false, playing: false, bot: false, edge: -1,
      x: 0, y: 0, vx: 0, vy: 0, a: 0, mx: 0, my: 0, sx: 0, sy: 0,
      inp: { up: false, down: false, left: false, right: false }, wantShoot: false, wantTackle: false,
      tackleUntil: 0, tackleReadyAt: 0, tackleDx: 0, tackleDy: 0, tkHit: null, tkAny: false, stunUntil: 0, downUntil: 0, grabBlock: 0, shotReadyAt: 0,
      chargeHeld: false, chargeStart: -1, chargeRelease: false, botShootAt: 0,
      sprintHeld: false, sprinting: false, sta: 1, staRest: 0, winded: false,
      turboUntil: 0, canonShots: 0, canonUntil: 0, gluUntil: 0, invUntil: 0,
      lives: 0, goals: 0, kills: 0, place: 0, elimTick: -1, elimBy: -1, score: 0,
      botNext: 0, botTgt: -1, botAim: 0,
    }));
  }
  function setArena(n) { ar = Math.round(AR0 * scaleFor(n)); }
  function fullReset() {
    players = makePlayers();
    gameState = 'lobby'; tick = 0; round = 0; winner = null; fx = []; pend = [];
    mode = 'ffa'; nteams = 0; nParts = 0; deaths = 0; endTick = 0; botCount = 0; botDiff = 1; lives = LIVES_CYCLE[0];
    terSel = 'stade'; itemsOn = {}; for (const k of ITEMS) itemsOn[k] = true;
    seatByMid = {}; freezeUntil = 0; sdOn = false;
    setArena(2); geo = buildGeo(2); ball = newBall();
    apercu();
  }
  function newBall() { return { x: geo.cx, y: geo.cy, vx: 0, vy: 0, owner: -1, last: -1, lastTick: -9999, kick: -1, kickTick: -9999 }; }

  const connectedCount = () => players.filter(p => p.member).length;
  const maxBots = () => MAX_SEATS - connectedCount();
  const partCount = () => Math.min(connectedCount() + botCount, MAX_SEATS);
  const canStart = () => connectedCount() >= 1 && partCount() >= 2;
  const editable = () => gameState === 'lobby' || gameState === 'over';
  const seatOf = member => { for (const p of players) if (p.member === member) return p.seat; return -1; };
  const aliveTeams = () => new Set(players.filter(p => p.alive).map(p => p.team));
  const foe = (p, q) => p.team !== q.team;          // en FFA chaque joueur a sa propre « équipe » (team = rang)
  const stunned = p => p.stunUntil > tick;
  const tackling = p => p.tackleUntil > tick;

  /* ---------- terrain : polygone régulier AJUSTÉ au cadre, un côté-cage par ÉQUIPE ---------- */
  // Le rayon est calculé pour que la boîte englobante du polygone (plus la marge des filets) remplisse l'arène, et le
  // polygone est recentré sur SA boîte : un triangle n'a plus son centre au milieu du cadre, d'où geo.cx / geo.cy.
  function buildGeo(K) {
    const G = K <= 2 ? 4 : K, start = -Math.PI / 2 - Math.PI / G;   // un côté bien à plat en haut, quel que soit G
    const u = []; let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (let k = 0; k < G; k++) { const a = start + k * 2 * Math.PI / G, x = Math.cos(a), y = Math.sin(a); u.push([x, y]); x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    const R = Math.min((ar - 2 * MARGE) / (x1 - x0), (ar - 2 * MARGE) / (y1 - y0));
    const cx = ar / 2 - R * (x0 + x1) / 2, cy = ar / 2 - R * (y0 + y1) / 2;
    const v = u.map(([x, y]) => [cx + R * x, cy + R * y]);
    const edges = [];
    for (let k = 0; k < G; k++) {
      const [ax, ay] = v[k], [bx, by] = v[(k + 1) % G];
      const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy), tx = dx / len, ty = dy / len;
      const mx = (ax + bx) / 2, my = (ay + by) / 2;
      let nx = cx - mx, ny = cy - my; const nl = Math.hypot(nx, ny); nx /= nl; ny /= nl;   // normale vers l'intérieur
      edges.push({ ax, ay, bx, by, tx, ty, nx, ny, len, mx, my, apo: nl, owner: -1, team: -1, open: false });   // owner : siège représentant (couleur, vies, côté client)
    }
    return { G, edges, cx, cy, R, start };
  }
  // côtés attribués : tous à partir de 3 équipes ; à 2, les deux côtés opposés gauche / droite (comme Pong)
  function ownerEdges(K) {
    if (K >= 3) return Array.from({ length: K }, (_, i) => i);
    return [0, 1, 2, 3].sort((a, b) => Math.abs(geo.edges[b].nx) - Math.abs(geo.edges[a].nx)).slice(0, K);
  }
  const cageActive = e => e.open && e.team >= 0;
  const equipe = t => players.filter(q => q.playing && q.team === t);
  function setTeamLives(t, v) { teamLives[t] = v; for (const q of equipe(t)) q.lives = v; }   // miroir par joueur : HUD, courbe de fin
  const gwFrac = () => GOAL0 + (GOAL_SD - GOAL0) * (sdOn ? Math.min(1, (tick - SD_START) / SD_GROW) : 0);
  // largeur de cage : bonus « mur » (rétrécit) et malus « géante » (élargit), par équipe ; jamais jusqu'aux coins
  const cageK = e => (teamMur[e.team] > tick ? MUR_K : 1) * (teamGeante[e.team] > tick ? GEANTE_K : 1);
  const half = e => Math.min(e.len / 2 - POST_R * 4, e.len * gwFrac() / 2 * cageK(e));
  const inside = (x, y, m) => geo.edges.every(e => (x - e.ax) * e.nx + (y - e.ay) * e.ny > m);
  // aperçu du lobby : le terrain et les cages au bon nombre (sièges humains d'abord, puis bots à venir)
  function apercu() {
    if (gameState !== 'lobby') return;
    const n = Math.max(2, partCount()), m = validModes(n).includes(mode) ? mode : 'ffa', k = numTeamsFor(m, n);
    setArena(n); geo = buildGeo(k); ball = newBall();
    // équipe t = participants d'indice ≡ t (mod k), humains d'abord : son représentant est le t-ième humain, sinon un bot à venir (-2)
    const own = ownerEdges(k), humains = players.filter(p => p.member);
    humains.forEach((p, i) => { p.team = i % k; });
    own.forEach((ei, t) => { const e = geo.edges[ei]; e.owner = t < humains.length ? humains[t].seat : -2; e.team = t; e.open = true; });
    ter = terSel === 'hasard' ? 'stade' : terSel; genTerrain();   // « hasard » : tiré au coup d'envoi, le lobby montre le stade
  }

  /* ---------- éléments du terrain ---------- */
  function genTerrain() {
    zones = []; bumpers = []; wind = { x: 0, y: 0 }; windNext = null; windAt = 0; windWarned = false; itemAt = ITEM_EVERY; pickups = []; teamMur = []; teamGeante = []; bumpGap = {};
    const T = TER[ter], s = ar / AR0;
    if (T.zone) {                                     // flaques / bancs de sable : pas au centre, pas devant une cage, sans se chevaucher
      const n = T.nz[0] + Math.floor(Math.random() * (T.nz[1] - T.nz[0] + 1)), kind = ZONE_KIND.indexOf(T.zone);
      for (let tries = 0; tries < 200 && zones.length < n; tries++) {
        const r = (T.rz[0] + Math.random() * (T.rz[1] - T.rz[0])) * s;
        const x = geo.cx + (Math.random() * 2 - 1) * geo.R, y = geo.cy + (Math.random() * 2 - 1) * geo.R;
        if (!inside(x, y, r * 0.5)) continue;
        if (Math.hypot(x - geo.cx, y - geo.cy) < r + 50) continue;
        if (geo.edges.some(e => e.team >= 0 && Math.hypot(x - e.mx, y - e.my) < r + 90)) continue;
        if (zones.some(z => Math.hypot(x - z.x, y - z.y) < r + z.r + 16)) continue;
        zones.push({ x, y, r, k: kind });
      }
    }
    if (T.bumpers) {                                 // un bumper face à chaque sommet (entre deux cages) : disposition équitable
      for (let k = 0; k < geo.G; k++) {
        const a = geo.start + k * 2 * Math.PI / geo.G;
        bumpers.push({ x: geo.cx + Math.cos(a) * geo.R * 0.46, y: geo.cy + Math.sin(a) * geo.R * 0.46, r: BUMP_R });
      }
    }
    if (T.wind) { const a = Math.random() * Math.PI * 2; windNext = { x: Math.cos(a), y: Math.sin(a) }; windAt = 3 * TICK_HZ; }   // première rafale à 3 s
  }
  function zoneAt(x, y) { for (const z of zones) if (Math.hypot(x - z.x, y - z.y) < z.r) return ZONE_KIND[z.k]; return null; }
  function updateWind() {
    if (!TER[ter].wind || !windNext) return;
    if (!windWarned && tick >= windAt - WIND_WARN) { windWarned = true; emit({ type: 'wind', warn: 1, x: r2(windNext.x), y: r2(windNext.y) }); }
    if (tick >= windAt) {
      wind = { x: windNext.x, y: windNext.y };
      const a = Math.atan2(wind.y, wind.x) + (Math.random() < 0.5 ? 1 : -1) * (Math.PI / 2 + Math.random() * Math.PI / 2);   // la suivante tourne franchement
      windNext = { x: Math.cos(a), y: Math.sin(a) }; windAt = tick + WIND_EVERY; windWarned = false;
      emit({ type: 'wind', x: r2(wind.x), y: r2(wind.y) });
    }
  }
  function spawnItem() {
    const actifs = ITEMS.filter(k => itemsOn[k]);
    if (!actifs.length || pickups.length >= ITEM_MAX) return;
    for (let tries = 0; tries < 40; tries++) {
      const x = geo.cx + (Math.random() * 2 - 1) * geo.R * 0.8, y = geo.cy + (Math.random() * 2 - 1) * geo.R * 0.8;
      if (!inside(x, y, 50)) continue;
      if (Math.hypot(x - geo.cx, y - geo.cy) < 40) continue;
      if (geo.edges.some(e => e.team >= 0 && Math.hypot(x - e.mx, y - e.my) < 110)) continue;
      if (bumpers.some(b => Math.hypot(x - b.x, y - b.y) < b.r + 30) || pickups.some(q => Math.hypot(x - q.x, y - q.y) < 80)) continue;
      if (players.some(p => p.alive && Math.hypot(x - p.x, y - p.y) < 40)) continue;
      pickups.push({ x, y, k: actifs[Math.floor(Math.random() * actifs.length)] });
      return;
    }
  }
  function ramasser(p, it) {
    const k = it.k;
    if (k === 'turbo') { p.turboUntil = tick + TURBO_T; p.sta = 1; p.winded = false; }
    else if (k === 'canon') { p.canonShots = CANON_SHOTS; p.canonUntil = tick + CANON_T; }
    else if (k === 'mur') teamMur[p.team] = tick + MUR_T;
    emit({ type: 'pickup', seat: p.seat, k, x: r1(it.x), y: r1(it.y) });
    if (k === 'geante' || k === 'glu' || k === 'inverse') {
      const touches = {};
      for (const q of players) {                    // malus : tous les ADVERSAIRES en lice (coéquipiers épargnés)
        if (!q.alive || !foe(p, q)) continue;
        if (k === 'geante') touches[q.team] = 1;
        else if (k === 'glu') q.gluUntil = tick + GLU_T;
        else q.invUntil = tick + INV_T;
        emit({ type: 'malus', k, seat: q.seat, by: p.seat });
      }
      for (const t in touches) teamGeante[+t] = tick + GEANTE_T;
    }
  }

  function spawnPos(p, j, k) {                     // j-ième de son équipe (k joueurs) : en ligne devant la cage, un sur deux avancé
    const e = geo.edges[p.edge], d = Math.min(e.apo * 0.3, 160) * (k > 1 && j % 2 ? 1.45 : 1);
    const sp = Math.min(e.len * 0.8 / Math.max(1, k), 70), u = (j - (k - 1) / 2) * sp;
    p.sx = e.mx + e.nx * d + e.tx * u; p.sy = e.my + e.ny * d + e.ty * u;
  }
  function kickoff() {                             // engagement : ballon au centre, chacun devant sa cage
    ball = newBall();
    for (const p of players) if (p.alive) {
      p.x = p.sx; p.y = p.sy; p.vx = 0; p.vy = 0; p.a = Math.atan2(geo.cy - p.y, geo.cx - p.x);
      p.stunUntil = 0; p.tackleUntil = 0; p.downUntil = 0; p.grabBlock = 0; p.wantShoot = false; p.wantTackle = false;
      p.chargeStart = -1; p.chargeRelease = false; p.botShootAt = 0; if (p.bot) { p.chargeHeld = false; p.sprintHeld = false; }
    }
  }

  function startGame() {
    if (!editable() || !canStart()) return;
    for (const p of players) { p.playing = false; p.bot = false; p.alive = false; p.edge = -1; }
    if (botCount > maxBots()) botCount = maxBots();
    const parts = players.filter(p => p.member);
    let bots = botCount;
    for (const p of players) { if (bots <= 0) break; if (!p.member) { p.bot = true; parts.push(p); bots--; } } // complète avec des bots
    parts.forEach((p, i) => { if (p.bot) p.name = '🤖 Bot ' + (i + 1); });
    if (parts.length < 2) return;
    const N = parts.length;
    if (!validModes(N).includes(mode)) mode = 'ffa';
    nteams = numTeamsFor(mode, N);
    setArena(N); geo = buildGeo(nteams);           // la TAILLE suit les joueurs, la FORME suit les équipes
    const own = ownerEdges(nteams); teamLives = [];
    parts.forEach((p, i) => {
      const t = i % nteams, e = geo.edges[own[t]];
      p.playing = true; p.alive = true; p.team = t; p.edge = own[t];
      if (i < nteams) { e.owner = p.seat; e.team = t; e.open = true; teamLives[t] = lives; }   // 1er de l'équipe = représentant
      p.lives = lives; p.goals = 0; p.kills = 0; p.place = 0; p.elimTick = -1; p.elimBy = -1;
      p.inp = { up: false, down: false, left: false, right: false }; p.mx = 0; p.my = 0; p.tackleReadyAt = 0; p.shotReadyAt = 0;
      p.sta = 1; p.staRest = 0; p.winded = false; p.sprinting = false; if (p.bot) p.sprintHeld = false;
      p.turboUntil = 0; p.canonShots = 0; p.canonUntil = 0; p.gluUntil = 0; p.invUntil = 0;
      p.botNext = 0; p.botTgt = -1;
    });
    for (let t = 0; t < nteams; t++) equipe(t).forEach((p, j, arr) => spawnPos(p, j, arr.length));
    ter = terSel === 'hasard' ? TERRAINS[Math.floor(Math.random() * TERRAINS.length)] : terSel;
    genTerrain();
    nParts = N; deaths = 0; endTick = 0; winner = null; freezeUntil = 0; sdOn = false;
    round++; tick = 0; countdownUntil = COUNTDOWN_TICKS; gameState = 'countdown';
    kickoff();
    emit({ type: 'whistle', k: 'start' });
  }
  function backToLobby() {            // abandon : retour au lobby en pleine partie
    if (gameState !== 'play' && gameState !== 'countdown' && gameState !== 'paused') return;
    gameState = 'lobby'; winner = null; fx = [];
    for (const p of players) { p.playing = false; p.alive = false; p.vx = 0; p.vy = 0; p.edge = -1; }
    apercu();
  }
  function endRound() {
    gameState = 'over'; endTick = tick;
    let s = aliveTeams();
    if (s.size > 1) {                                // filet de 6 min : l'équipe qui a le plus de vies l'emporte (égalité sinon)
      const tot = {}; for (const t of s) tot[t] = teamLives[t] || 0;
      let best = -1, bv = -1, tie = false;
      for (const t in tot) { if (tot[t] > bv) { bv = tot[t]; best = +t; tie = false; } else if (tot[t] === bv) tie = true; }
      s = tie ? new Set() : new Set([best]);
    }
    winner = s.size === 1 ? [...s][0] : -1;
    if (winner >= 0) players.forEach(p => { if (p.playing && p.team === winner) p.score++; });
    const viv = [...aliveTeams()];                   // encore en lice : classées par vies restantes (1 = vainqueur)
    players.forEach(p => { if (p.playing && p.alive) p.place = 1 + viv.filter(u => (teamLives[u] || 0) > (teamLives[p.team] || 0)).length; });
    pickups = [];
    emit({ type: 'whistle', k: 'end' });
    recordRound();
  }

  // Un joueur sort (équipe éliminée, ou départ) : place = nombre d'équipes encore en lice à cet instant (lui compris).
  function sortir(p, by, place) {
    p.alive = false; p.elimTick = tick; p.place = place; deaths++; p.elimBy = by;
    if (ball.owner === p.seat) ball.owner = -1;
    emit({ type: 'out', seat: p.seat, by, x: r1(p.x), y: r1(p.y) });
  }
  function eliminerEquipe(t, by) {                  // plus de vies : TOUTE l'équipe sort, sa cage se ferme (le côté devient un mur)
    const place = aliveTeams().size, membres = equipe(t).filter(q => q.alive);
    for (const q of membres) sortir(q, by, place);
    if (by >= 0) players[by].kills += membres.length;
    for (const e of geo.edges) if (e.team === t) e.open = false;
  }
  function quitter(p) {                             // départ en pleine manche : l'équipe continue s'il lui reste quelqu'un
    const reste = equipe(p.team).filter(q => q.alive && q !== p);
    if (!reste.length) { eliminerEquipe(p.team, -1); return; }
    sortir(p, -1, aliveTeams().size);
    for (const e of geo.edges) if (e.team === p.team && e.owner === p.seat) e.owner = reste[0].seat;   // nouveau représentant
  }
  function goal(e) {
    const t = e.team, lp = ball.kick >= 0 ? players[ball.kick] : null;
    const recent = lp && tick - ball.kickTick <= CREDIT_TICKS;
    const by = recent && lp.team !== t ? lp.seat : -1;
    const own = !!(recent && lp.team === t);         // contre son camp : le dernier à l'avoir joué est de l'équipe qui encaisse
    setTeamLives(t, Math.max(0, (teamLives[t] || 0) - 1));
    if (by >= 0) players[by].goals++;
    emit({ type: 'goal', seat: e.owner, team: t, by, own, k: own ? lp.seat : -1, x: r1(ball.x), y: r1(ball.y), lives: teamLives[t] });
    if (teamLives[t] <= 0) eliminerEquipe(t, by);
    ball.owner = -1; ball.vx *= 0.2; ball.vy *= 0.2;
    freezeUntil = tick + GOAL_FREEZE;
  }
  // last : dernier contact (déviations comprises) ; kick : dernier joueur qui a VRAIMENT joué le ballon (tir, conduite,
  // tacle). Le but est crédité à kick : un tir dévié par le défenseur reste au tireur, ce n'est pas un contre son camp.
  const touch = p => { ball.last = p.seat; ball.lastTick = tick; ball.kick = p.seat; ball.kickTick = tick; };

  /* ---------- joueurs ---------- */
  function humanDir(p) {
    const i = p.inp; let x = (i.right ? 1 : 0) - (i.left ? 1 : 0), y = (i.down ? 1 : 0) - (i.up ? 1 : 0);
    const l = Math.hypot(x, y); if (l > 0) { x /= l; y /= l; }
    p.mx = x; p.my = y;
    if (p.invUntil > tick) { p.mx = -p.mx; p.my = -p.my; }   // malus « inverse »
  }
  function turnToward(p, ta, rate) { let d = ta - p.a; d = Math.atan2(Math.sin(d), Math.cos(d)); p.a += Math.max(-rate, Math.min(rate, d)); }
  function move(p) {
    const D = FTDIFF[botDiff] || FTDIFF[1], T = TER[ter], carry = ball.owner === p.seat;
    const z = zoneAt(p.x, p.y), Z = z ? ZONE_FX[z] : null, libre = !stunned(p) && p.downUntil <= tick;
    const moving = !!(p.mx || p.my), turbo = p.turboUntil > tick, glu = p.gluUntil > tick;
    // sprint : Maj tenue, en mouvement, endurance disponible (ou turbo), ni en charge, ni englué
    p.sprinting = p.sprintHeld && moving && libre && !glu && p.chargeStart < 0 && (turbo || (!p.winded && p.sta > 0));
    if (p.sprinting && !turbo) { p.sta = Math.max(0, p.sta - STA_DRAIN); p.staRest = 0; if (p.sta <= 0) p.winded = true; }
    else if (!p.sprinting) { if (++p.staRest > STA_DELAY) p.sta = Math.min(1, p.sta + STA_REGEN); if (p.winded && p.sta >= STA_MIN) p.winded = false; }
    const kS = (p.sprinting ? SPRINT_SPD : 1) * (turbo ? TURBO_SPD : 1) * (glu ? GLU_SPD : 1);
    const acc = ACC * T.acc * (Z ? Z.acc : 1) * (p.sprinting ? SPRINT_ACC : 1) * (glu ? GLU_SPD : 1) * (p.bot ? D.spd : 1);
    const vmax = VMAX * T.vmax * (Z ? Z.vmax : 1) * kS * (carry ? CARRY_SPD * (p.chargeStart >= 0 ? CHARGE_SPD : 1) : 1) * (p.bot ? D.spd : 1);
    const sp0 = Math.hypot(p.vx, p.vy);
    if (libre && moving) { p.vx += p.mx * acc; p.vy += p.my * acc; turnToward(p, Math.atan2(p.my, p.mx), carry ? TURN * 0.8 : TURN); }
    if (T.wind) { p.vx += wind.x * WIND_PLAYER; p.vy += wind.y * WIND_PLAYER; }
    p.vx *= T.fr; p.vy *= T.fr;
    const sp = Math.hypot(p.vx, p.vy), cap = Math.max(vmax, sp0 * T.fr);   // un tacle (ou la glace) peut dépasser la vitesse de course
    if (sp > cap) { p.vx *= cap / sp; p.vy *= cap / sp; }
    p.x += p.vx; p.y += p.vy;
    for (const e of geo.edges) {                    // les joueurs restent sur le terrain (on n'entre pas dans les filets)
      const d = (p.x - e.ax) * e.nx + (p.y - e.ay) * e.ny;
      if (d < PR) { p.x += e.nx * (PR - d); p.y += e.ny * (PR - d); const vn = p.vx * e.nx + p.vy * e.ny; if (vn < 0) { p.vx -= vn * (1 + (T.wall > 0.8 ? 0.6 : 0)) * e.nx; p.vy -= vn * (1 + (T.wall > 0.8 ? 0.6 : 0)) * e.ny; } }
    }
    for (let i = 0; i < bumpers.length; i++) {       // bumpers : on y rebondit
      const b = bumpers[i], dx = p.x - b.x, dy = p.y - b.y, d = Math.hypot(dx, dy), rr = PR + b.r;
      if (d >= rr || d < 1e-6) continue;
      const nx = dx / d, ny = dy / d; p.x = b.x + nx * rr; p.y = b.y + ny * rr;
      p.vx += nx * BUMP_PUSH; p.vy += ny * BUMP_PUSH; bumpFx(i);
    }
    for (let i = pickups.length - 1; i >= 0; i--) {  // objets au sol : ramassés au contact (pas sonné ni à terre)
      const it = pickups[i];
      if (libre && Math.hypot(p.x - it.x, p.y - it.y) < PR + ITEM_R) { pickups.splice(i, 1); ramasser(p, it); }
    }
  }
  function bumpFx(i) { if ((bumpGap[i] || -99) + 5 <= tick) { bumpGap[i] = tick; emit({ type: 'bump', i, x: r1(bumpers[i].x), y: r1(bumpers[i].y) }); } }
  function collide(p, q) {
    const dx = q.x - p.x, dy = q.y - p.y, d = Math.hypot(dx, dy), rr = PR * 2;
    if (d >= rr) return;
    const nx = d > 1e-6 ? dx / d : 1, ny = d > 1e-6 ? dy / d : 0, ov = (rr - d) / 2;
    p.x -= nx * ov; p.y -= ny * ov; q.x += nx * ov; q.y += ny * ov;
    const vn = (q.vx - p.vx) * nx + (q.vy - p.vy) * ny;
    if (vn < 0) { const j = -1.3 * vn / 2; p.vx -= nx * j; p.vy -= ny * j; q.vx += nx * j; q.vy += ny * j; }
  }
  // direction du tir : celle TENUE si on en tient une (joystick, flèches), sinon le regard ; pow ∈ [0, 1] (charge)
  function tirer(p, pow) {
    let dx = p.mx, dy = p.my; if (!dx && !dy) { dx = Math.cos(p.a); dy = Math.sin(p.a); }
    const canon = p.canonShots > 0 && p.canonUntil > tick;   // bonus canon : pleine puissance, sans dispersion, +20 %
    if (canon) { pow = 1; p.canonShots--; }
    else {
      const err = (Math.random() * 2 - 1) * SHOT_SPREAD * pow * pow, ce = Math.cos(err), se = Math.sin(err);   // un boulet est moins précis qu'une passe
      const ex = dx * ce - dy * se; dy = dx * se + dy * ce; dx = ex;
    }
    const spd = (SHOT_MIN + (SHOT_MAX - SHOT_MIN) * pow) * (canon ? CANON_MUL : 1);
    ball.owner = -1; ball.vx = dx * spd + p.vx * 0.3; ball.vy = dy * spd + p.vy * 0.3;
    p.grabBlock = tick + GRAB_BLOCK; p.shotReadyAt = tick + SHOT_CD; p.a = Math.atan2(dy, dx); touch(p);
    emit({ type: 'shot', seat: p.seat, x: r1(ball.x), y: r1(ball.y), f: r2(pow), c: canon ? 1 : 0 });
  }
  function actions(p) {
    const owner = ball.owner === p.seat, libre = !stunned(p) && p.downUntil <= tick;
    // charge : Espace peut être pressé AVANT d'avoir le ballon (reprise de volée) — elle démarre à la prise
    if (!owner) { p.chargeStart = -1; if (p.bot) { p.botShootAt = 0; p.chargeHeld = false; } }
    else if (p.chargeHeld && p.chargeStart < 0 && libre) p.chargeStart = tick;
    if (p.chargeRelease) {
      p.chargeRelease = false;
      if (owner && p.chargeStart >= 0 && libre && tick >= p.shotReadyAt) tirer(p, Math.min(1, (tick - p.chargeStart) / CHARGE_TICKS));
      p.chargeStart = -1;
    }
    if (p.wantShoot) { p.wantShoot = false; if (owner && libre && tick >= p.shotReadyAt) { tirer(p, 0.55); p.chargeStart = -1; } }   // tir direct (message « shoot »)
    if (p.wantTackle) {
      p.wantTackle = false;
      if (libre && tick >= p.tackleReadyAt && !owner) {
        let dx = p.mx, dy = p.my; if (!dx && !dy) { dx = Math.cos(p.a); dy = Math.sin(p.a); }
        p.vx += dx * TACKLE_IMP; p.vy += dy * TACKLE_IMP; p.a = Math.atan2(dy, dx);
        p.tackleUntil = tick + TACKLE_TICKS; p.tackleReadyAt = tick + TACKLE_CD; p.tackleDx = dx; p.tackleDy = dy; p.tkHit = {}; p.tkAny = false;
        emit({ type: 'slide', seat: p.seat, x: r1(p.x), y: r1(p.y) });
      }
    }
  }
  function tackleHits(p) {                          // pendant la glissade : le premier contact avec un adversaire compte
    for (const q of players) {
      if (p.tkAny) return;                           // une seule victime par tacle
      if (q === p || !q.alive || !foe(p, q) || p.tkHit[q.seat]) continue;
      if (Math.hypot(q.x - p.x, q.y - p.y) > PR * 2 + 6) continue;
      p.tkHit[q.seat] = 1; p.tkAny = true;
      const steal = ball.owner === q.seat;
      q.vx += p.tackleDx * BUMP; q.vy += p.tackleDy * BUMP;
      q.stunUntil = tick + STUN_TICKS; q.grabBlock = tick + STUN_TICKS; q.chargeStart = -1;   // assommé : ni course, ni ballon
      if (steal) { ball.owner = -1; ball.vx = 0; ball.vy = 0; ball.last = p.seat; ball.lastTick = tick; }   // le ballon RESTE où il était
      emit({ type: 'tackle', seat: q.seat, by: p.seat, steal, x: r1((p.x + q.x) / 2), y: r1((p.y + q.y) / 2) });
    }
  }

  /* ---------- ballon ---------- */
  // Murs, bouches de but, poteaux et bumpers. Renvoie true si un but vient d'être marqué.
  function ballEdges(bounce) {
    const wr = TER[ter].wall;
    for (const e of geo.edges) {
      const dx = ball.x - e.ax, dy = ball.y - e.ay, d = dx * e.nx + dy * e.ny;
      if (d >= BR) continue;
      const s = dx * e.tx + dy * e.ty;
      if (s < -BR || s > e.len + BR) continue;     // au-delà du segment : c'est le côté voisin qui répond
      if (cageActive(e) && Math.abs(s - e.len / 2) < half(e)) {
        if (d < 0) { goal(e); return true; }        // le CENTRE du ballon a franchi la ligne dans la bouche
        continue;                                   // dans la bouche : pas de rebond
      }
      ball.x += e.nx * (BR - d); ball.y += e.ny * (BR - d);
      const vn = ball.vx * e.nx + ball.vy * e.ny;
      if (bounce && vn < 0) {
        ball.vx -= (1 + wr) * vn * e.nx; ball.vy -= (1 + wr) * vn * e.ny;
        if (vn < -3) emit({ type: 'wall', x: r1(ball.x), y: r1(ball.y), f: r2(Math.min(1, -vn / 16)) });
      }
    }
    for (const e of geo.edges) {                     // poteaux (cages ouvertes) : petits disques qui renvoient le ballon
      if (!cageActive(e)) continue;
      const h = half(e);
      for (const sg of [-1, 1]) {
        const px = e.mx + e.tx * h * sg, py = e.my + e.ty * h * sg, dx = ball.x - px, dy = ball.y - py, d = Math.hypot(dx, dy), rr = BR + POST_R;
        if (d >= rr || d < 1e-6) continue;
        const nx = dx / d, ny = dy / d; ball.x = px + nx * rr; ball.y = py + ny * rr;
        const vn = ball.vx * nx + ball.vy * ny;
        if (bounce && vn < 0) { ball.vx -= (1 + POST_REST) * vn * nx; ball.vy -= (1 + POST_REST) * vn * ny; if (vn < -2) emit({ type: 'post', x: r1(px), y: r1(py), f: r2(Math.min(1, -vn / 14)) }); }
      }
    }
    for (let i = 0; i < bumpers.length; i++) {       // bumpers : le ballon repart plus vite qu'il n'est arrivé
      const b = bumpers[i], dx = ball.x - b.x, dy = ball.y - b.y, d = Math.hypot(dx, dy), rr = BR + b.r;
      if (d >= rr || d < 1e-6) continue;
      const nx = dx / d, ny = dy / d; ball.x = b.x + nx * rr; ball.y = b.y + ny * rr;
      if (ball.owner >= 0) { ball.owner = -1; ball.vx = 0; ball.vy = 0; }   // conduit dans un bumper : il saute du pied
      const vn = ball.vx * nx + ball.vy * ny; if (vn < 0) { ball.vx -= 2 * vn * nx; ball.vy -= 2 * vn * ny; }
      const sp = Math.hypot(ball.vx, ball.vy), k = Math.max(sp * 0.9, BUMP_KICK) / (sp || 1);
      if (sp < 1e-6) { ball.vx = nx * BUMP_KICK; ball.vy = ny * BUMP_KICK; } else { ball.vx *= k; ball.vy *= k; }
      bumpFx(i);
    }
    return false;
  }
  function ballPlayers(alive) {                     // ballon libre : collé au premier qui le touche, sauf un tir trop fort
    const sp = Math.hypot(ball.vx, ball.vy);
    let best = null, bd = Infinity;
    for (const p of alive) {
      const d = Math.hypot(ball.x - p.x, ball.y - p.y);
      if (d >= PR + BR) continue;
      if (sp > STICK_MAX) {                          // tir puissant : il rebondit sur le joueur (déviation), sans se coller
        const nx = d > 1e-6 ? (ball.x - p.x) / d : 1, ny = d > 1e-6 ? (ball.y - p.y) / d : 0;
        const vn = (ball.vx - p.vx) * nx + (ball.vy - p.vy) * ny;
        ball.x = p.x + nx * (PR + BR); ball.y = p.y + ny * (PR + BR);
        if (vn < 0) { ball.vx -= (1 + DEFLECT_REST) * vn * nx; ball.vy -= (1 + DEFLECT_REST) * vn * ny; }
        if (ball.last !== p.seat) emit({ type: 'deflect', seat: p.seat, x: r1(ball.x), y: r1(ball.y) });
        ball.last = p.seat; ball.lastTick = tick;     // simple déviation : le crédit du but reste au tireur (kick)
        return;
      }
      if (stunned(p) || p.downUntil > tick || tick < p.grabBlock) continue;
      if (d < bd) { bd = d; best = p; }
    }
    if (best) { if (tackling(best)) best.tkAny = true; ball.owner = best.seat; ball.vx = 0; ball.vy = 0; touch(best); emit({ type: 'grab', seat: best.seat }); }
  }
  function updateBall(alive) {
    if (ball.owner >= 0) {                           // conduite : le ballon devant les pieds du porteur
      const o = players[ball.owner];
      if (!o.alive) { ball.owner = -1; }
      else {
        const k = PR + BR + 1;
        ball.x = o.x + Math.cos(o.a) * k; ball.y = o.y + Math.sin(o.a) * k; ball.vx = o.vx; ball.vy = o.vy;
        ball.kickTick = tick; ball.lastTick = tick;   // la conduite compte comme jouer le ballon (crédit d'un but « rentré » au pied)
        return ballEdges(false);                      // on peut rentrer le ballon dans une cage en le conduisant
      }
    }
    const T = TER[ter];
    if (T.wind) { ball.vx += wind.x * WIND_BALL; ball.vy += wind.y * WIND_BALL; }   // le vent pousse le ballon libre
    let sp = Math.hypot(ball.vx, ball.vy);
    if (sp > BALL_VMAX) { ball.vx *= BALL_VMAX / sp; ball.vy *= BALL_VMAX / sp; sp = BALL_VMAX; }
    const n = Math.max(1, Math.ceil(sp / (BR * 0.8)));   // sous-pas : un tir ne traverse ni un mur ni un joueur
    for (let i = 0; i < n; i++) {
      ball.x += ball.vx / n; ball.y += ball.vy / n;
      if (ballEdges(true)) return true;
      if (ball.owner < 0) ballPlayers(alive);
      if (ball.owner >= 0) break;
    }
    const z = zoneAt(ball.x, ball.y), fr = z ? Math.min(T.ballFr, ZONE_FX[z].ballFr) : T.ballFr;
    ball.vx *= fr; ball.vy *= fr;
    if (Math.hypot(ball.vx, ball.vy) < 0.05) { ball.vx = 0; ball.vy = 0; }
    return false;
  }

  /* ---------- IA ---------- */
  function goalTarget(p) {                          // cage adverse ouverte la plus proche
    let best = null, bd = Infinity;
    for (const e of geo.edges) {
      if (!cageActive(e) || e.team === p.team) continue;
      const d = Math.hypot(e.mx - p.x, e.my - p.y); if (d < bd) { bd = d; best = e; }
    }
    return best;
  }
  function botThink(p) {
    const D = FTDIFF[botDiff] || FTDIFF[1];
    const vif = ball.owner < 0 && Math.hypot(ball.vx, ball.vy) > 8 && D.keeper;   // ballon qui file : on réagit à chaque tick
    if (tick < p.botNext && !vif) return;
    p.botNext = tick + D.every;
    const myE = geo.edges[p.edge];
    let gx = 0, gy = 0, sprint = false;
    if (ball.owner === p.seat) {
      const e = goalTarget(p);
      if (e) {
        if (p.botTgt !== e.team) { p.botTgt = e.team; p.botAim = (Math.random() * 2 - 1) * D.noise; }
        const ax = e.mx + e.tx * half(e) * 0.8 * p.botAim, ay = e.my + e.ty * half(e) * 0.8 * p.botAim;
        gx = ax - p.x; gy = ay - p.y;
        const d = Math.hypot(gx, gy) || 1, face = (Math.cos(p.a) * gx + Math.sin(p.a) * gy) / d;
        const press = players.some(q => q.alive && foe(p, q) && Math.hypot(q.x - p.x, q.y - p.y) < 60);
        const range = e.apo * 2 * D.shoot * 0.5;
        sprint = d > range * 1.3 && !press;         // chemin libre et loin : on accélère balle au pied
        if ((d < range || (press && d < range * 1.6)) && face > 0.9 && !p.botShootAt) {
          const pow = Math.max(0.4, Math.min(0.9, 0.3 + 0.55 * d / range));   // frappe dosée : plus fort de loin, rarement à fond
          p.chargeHeld = true; p.botShootAt = tick + Math.max(1, Math.round(pow * CHARGE_TICKS));
        }
      }
    } else if (ball.owner >= 0) {
      const o = players[ball.owner];
      if (foe(p, o)) {
        const d = Math.hypot(o.x - p.x, o.y - p.y);
        const menace = myE.open && Math.hypot(o.x - myE.mx, o.y - myE.my) < myE.apo * 0.9;
        if (d < 170 || !menace) {                    // on presse le porteur, tacle quand il est à portée
          gx = o.x + o.vx * 4 - p.x; gy = o.y + o.vy * 4 - p.y; sprint = d > 60 && d < 260;
          if (d < PR * 2 + 16 && tick >= p.tackleReadyAt && Math.random() < D.tackleP) p.wantTackle = true;
        } else {                                     // il fonce vers MA cage : je me place entre lui et elle
          gx = myE.mx + (o.x - myE.mx) * 0.3 - p.x; gy = myE.my + (o.y - myE.my) * 0.3 - p.y; sprint = Math.hypot(gx, gy) > 80;
        }
      } else {                                       // un coéquipier a le ballon : on monte en soutien
        const e = goalTarget(o);
        if (e) { gx = (o.x + e.mx) / 2 + e.tx * 60 * (p.seat % 2 ? 1 : -1) - p.x; gy = (o.y + e.my) / 2 + e.ty * 60 * (p.seat % 2 ? 1 : -1) - p.y; }
      }
    } else {
      // ballon libre qui file vers MA cage : réflexe de gardien (point d'interception sur ma ligne de but)
      let garde = false;
      if (D.keeper && myE.open) {
        const vn = ball.vx * myE.nx + ball.vy * myE.ny, d0 = (ball.x - myE.ax) * myE.nx + (ball.y - myE.ay) * myE.ny;
        if (vn < -2 && d0 / -vn < 40) {
          const t = d0 / -vn, hx = ball.x + ball.vx * t, hy = ball.y + ball.vy * t, s = (hx - myE.ax) * myE.tx + (hy - myE.ay) * myE.ty;
          if (Math.abs(s - myE.len / 2) < half(myE) + BR * 2) {
            const px = myE.ax + myE.tx * s + myE.nx * (PR + 6), py = myE.ay + myE.ty * s + myE.ny * (PR + 6);
            gx = px - p.x; gy = py - p.y; garde = true; sprint = true;
          }
        }
      }
      if (!garde) {                                  // sinon, on court au ballon (là où il sera dans quelques ticks)
        const d = Math.hypot(ball.x - p.x, ball.y - p.y), k = Math.min(12, d / 6);
        gx = ball.x + ball.vx * k - p.x; gy = ball.y + ball.vy * k - p.y; sprint = d > 110;
        // un objet tout près, plus près que le ballon : détour (selon le niveau)
        if (pickups.length && Math.random() < D.pick) for (const it of pickups) {
          const di = Math.hypot(it.x - p.x, it.y - p.y);
          if (di < 150 && di < d * 0.7) { gx = it.x - p.x; gy = it.y - p.y; break; }
        }
      }
    }
    p.sprintHeld = sprint && p.sta > 0.25;
    const gl = Math.hypot(gx, gy);
    if (gl > 2) { p.mx = gx / gl; p.my = gy / gl; } else { p.mx = 0; p.my = 0; }
    if (p.invUntil > tick) { p.mx = -p.mx; p.my = -p.my; }   // malus « inverse » : appliqué à la décision, pas à chaque tick
  }

  function update() { fx = pend; pend = []; dansTick = true; try { pas(); } finally { dansTick = false; } }
  function pas() {
    if (gameState === 'countdown') { tick++; if (tick >= countdownUntil) { gameState = 'play'; tick = 0; emit({ type: 'whistle', k: 'go' }); } return; }
    if (gameState !== 'play') return;
    tick++;
    if (!sdOn && tick >= SD_START) { sdOn = true; emit({ type: 'sd' }); }
    if (freezeUntil) {                               // célébration du but : tout est figé, puis engagement
      if (tick < freezeUntil) return;
      freezeUntil = 0;
      if (aliveTeams().size <= 1) { endRound(); return; }
      kickoff(); emit({ type: 'whistle', k: 'kick' });
      return;
    }
    if (aliveTeams().size <= 1) { endRound(); return; }   // une équipe entière est partie (décompte, pause…) : fin
    updateWind();
    if (tick >= itemAt) { itemAt = tick + ITEM_EVERY; spawnItem(); }   // échéance : un multiple sauté pendant un gel ne perd plus l'objet
    const alive = players.filter(p => p.alive);
    for (const p of alive) {
      if (p.bot) { botThink(p); if (p.botShootAt && tick >= p.botShootAt) { p.botShootAt = 0; p.chargeHeld = false; p.chargeRelease = true; } }
      else humanDir(p);
      if (stunned(p) || p.downUntil > tick) { p.mx = 0; p.my = 0; }
      if (p.tackleUntil && tick >= p.tackleUntil) { p.tackleUntil = 0; if (!p.tkAny) { p.downUntil = tick + MISS_TICKS; emit({ type: 'miss', seat: p.seat, x: r1(p.x), y: r1(p.y) }); } }   // tacle raté : à terre
    }
    for (const p of alive) actions(p);
    for (const p of alive) move(p);
    for (let i = 0; i < alive.length; i++) for (let j = i + 1; j < alive.length; j++) collide(alive[i], alive[j]);
    for (const p of alive) if (tackling(p)) tackleHits(p);
    updateBall(alive);
    if (tick >= TIME_CAP && !freezeUntil) endRound();
  }

  function snapshot() {
    return {
      gs: gameState, count: gameState === 'countdown' ? Math.max(0, Math.ceil((countdownUntil - tick) / TICK_HZ)) : 0,
      round, winner, fx, connected: connectedCount(), botCount, maxBots: maxBots(), botDiff, nteams, lives,
      mode: gameState === 'lobby' && !validModes(Math.max(2, partCount())).includes(mode) ? 'ffa' : mode,
      ar, sd: sdOn && gameState === 'play', gw: r2(gwFrac()), frz: freezeUntil > tick ? 1 : 0,
      // réglages (menu) et terrain en vigueur ; ces clés ne changent presque jamais : le hub ne les renvoie pas si identiques
      opt: { ter: terSel, it: ITEMS.map(k => (itemsOn[k] ? 1 : 0)).join('') },
      ter: TERRAINS.indexOf(ter),
      geo: { G: geo.G, c: [r1(geo.cx), r1(geo.cy)], e: geo.edges.map(e => [r1(e.ax), r1(e.ay), r1(e.bx), r1(e.by), e.owner, e.open ? 1 : 0, r2(e.team >= 0 ? cageK(e) : 1)]) },
      zn: zones.map(z => [r1(z.x), r1(z.y), r1(z.r), z.k]), bmp: bumpers.map(b => [r1(b.x), r1(b.y), b.r]),
      wind: [r2(wind.x), r2(wind.y)], wn: windNext && windAt - tick <= WIND_WARN && windAt > tick ? [r2(windNext.x), r2(windNext.y)] : 0,
      pk: pickups.map(it => [r1(it.x), r1(it.y), ITEMS.indexOf(it.k)]),
      ball: { x: r1(ball.x), y: r1(ball.y), o: ball.owner, l: ball.last },
      stats: gameState === 'over' ? { durationSec: Math.round(endTick / TICK_HZ), nParts } : null,
      players: players.map(p => ({
        seat: p.seat, name: p.name, team: p.team, connected: !!p.member, playing: p.playing, alive: p.alive, bot: !!p.bot, edge: p.edge,
        x: r1(p.x), y: r1(p.y), a: r2(p.a), lives: p.lives, goals: p.goals, kills: p.kills,
        tk: tackling(p), tcd: r2(1 - Math.max(0, p.tackleReadyAt - tick) / TACKLE_CD), st: stunned(p), dn: p.downUntil > tick,
        ch: p.chargeStart >= 0 ? r2(Math.min(1, (tick - p.chargeStart) / CHARGE_TICKS)) : 0,
        sta: Math.round(p.sta * 20) / 20, spr: p.sprinting, ess: p.winded,
        tb: p.turboUntil > tick, cn: p.canonUntil > tick ? p.canonShots : 0, gl: p.gluUntil > tick, iv: p.invUntil > tick,
        place: p.place, elimTick: p.elimTick, elimBy: p.elimBy,
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
    if (seat < 0) { const free = players.find(p => !p.member && !p.bot && (editable() || !p.playing)) || (editable() ? players.find(p => !p.member) : null); if (free) seat = free.seat; }
    if (seat < 0) return { role: 'spectator', hello: { t: 'welcome', seat: -1 } };
    const p = players[seat];
    if (p.bot) repriseSiegeBot(p);   /* hors partie, un siège de bot se libère (startGame redistribue les bots) : remis à neuf */
    p.member = member; p.bot = false; p.mid = member.id; p.name = member.name || '';
    seatByMid[member.id] = seat;
    apercu();
    return { role: 'player', seat, hello: { t: 'welcome', seat } };
  }
  function onLeave(member) {
    const seat = seatOf(member); if (seat < 0) return;
    const p = players[seat]; p.member = null; p.inp = { up: false, down: false, left: false, right: false }; p.mx = 0; p.my = 0; p.sprintHeld = false; p.chargeHeld = false;
    if (gameState === 'play' || gameState === 'countdown' || gameState === 'paused') {
      if (p.alive) quitter(p);
      if (connectedCount() === 0) fullReset(); else if (gameState === 'play' && aliveTeams().size <= 1 && !freezeUntil) endRound();
    } else if (connectedCount() === 0) fullReset();
    else apercu();
  }
  function onRename(member) { const s = seatOf(member); if (s >= 0) players[s].name = member.name || ''; }
  function onMessage(member, m) {
    if (!m || typeof m !== 'object') return;
    const seat = seatOf(member);
    const p = seat >= 0 ? players[seat] : null;
    if (m.t === 'input' && p) p.inp = { up: !!m.up, down: !!m.down, left: !!m.left, right: !!m.right };   // état TENU, envoyé à chaque changement
    else if (m.t === 'sprint' && p) p.sprintHeld = !!m.on;   // Maj tenue / relâchée
    else if (m.t === 'charge' && p && p.alive) {     // Espace enfoncé / relâché (tir chargé) ; cancel : fenêtre quittée, pas de tir
      if (m.on) p.chargeHeld = true;
      else { p.chargeHeld = false; if (m.cancel) p.chargeStart = -1; else p.chargeRelease = true; }
    }
    else if (m.t === 'shoot' && p && p.alive && gameState === 'play') p.wantShoot = true;   // tir direct à mi-puissance (traité au tick suivant)
    else if (m.t === 'tackle' && p && p.alive && gameState === 'play') p.wantTackle = true;
    else if (m.t === 'start') startGame();
    else if (m.t === 'pause') { if (gameState === 'play') gameState = 'paused'; else if (gameState === 'paused') gameState = 'play'; }
    else if (m.t === 'abort') backToLobby();
    else if (m.t === 'mode') { if (editable()) { const v = validModes(partCount()); mode = v[(v.indexOf(mode) + 1) % v.length] || 'ffa'; apercu(); } }   // le terrain du lobby suit le mode
    else if (m.t === 'bots') { if (editable()) { const mx = maxBots(); botCount = mx <= 0 ? 0 : (botCount + 1) % (mx + 1); apercu(); } }
    else if (m.t === 'botdiff') { if (editable()) botDiff = (botDiff + 1) % 3; }
    else if (m.t === 'lives') { if (editable()) lives = LIVES_CYCLE[(LIVES_CYCLE.indexOf(lives) + 1) % LIVES_CYCLE.length]; }
    else if (m.t === 'terrain') { if (editable() && (m.v === 'hasard' || TERRAINS.indexOf(m.v) >= 0)) { terSel = m.v; apercu(); } }   // chaîne de la liste seulement
    else if (m.t === 'item') { if (editable() && typeof m.k === 'string' && ITEMS.indexOf(m.k) >= 0) itemsOn[m.k] = !!m.on; }
    else if (m.t === 'lbreset') reset(GID);
  }
  function tick_() { for (const p of players) if (p.member) p.name = p.member.name || p.name || ''; update(); return snapshot(); }

  fullReset();
  return { onJoin, onLeave, onRename, onMessage, tick: tick_, isIdle: editable };
}

export default { meta: { id: GID, name: 'Foot', min: 2, max: 10, tickHz: TICK_HZ, desc: 'Une cage par équipe, un seul ballon : 5 terrains, bonus et malus, sprint et tirs chargés' }, create: createFoot };
