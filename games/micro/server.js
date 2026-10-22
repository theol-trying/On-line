// Jeu MICRO MACHINES — course de voitures-jouets vue de dessus, sur des tables et des circuits miniatures. 1 à 10 joueurs.
// Deux formules : COURSE (1, 3 ou 5 tours ; places à l'arrivée ; 12 s après le premier, les autres sont classés à leur
// progression) et ÉLIMINATION (le « head to head » des Micro Machines : une fenêtre commune suit le meneur et rétrécit ;
// qui en sort est éliminé, le dernier dans le cadre gagne). FFA ou équipes. Géométrie partagée : public/games/micro/shared.js.
//
// Physique à 30 Hz : moteur, frein / marche arrière, adhérence latérale selon la surface (le lait et l'encre font
// glisser), chocs entre voitures (on se bouscule, on se fait tourner), murs et obstacles, CHUTE quand on quitte la table
// (ou dans une poche du billard) → réapparition à la dernière porte de contrôle franchie, fantôme 1,2 s.
// Les tours se comptent par portes de contrôle franchies DANS L'ORDRE : couper à travers la table ne fait rien gagner.
import { TICK_HZ, CAR_R, CAR_L, CAR_W, FALL_T, GHOST_T, LAPS, FORMULES, ELIM_HW0, ELIM_HW1, CIRCUITS, BUMPERS, circuitParId, proche, surTable, dansTrou, zoneA, grilleDepart, mobile } from '../../public/games/micro/shared.js';
import { board, pushHistory, save, markDirty, reset, bumpDaily } from '../../leaderboard.js';
import { classerManche } from '../fin-manche.js';
import { creerMatch } from '../match.js';

const GID = 'micro';
const MAX_SEATS = 10;
const COUNTDOWN_TICKS = 3 * TICK_HZ;                     // feux de départ : rouge, rouge, rouge… vert
// moteur (u/tick, u/tick²) : vitesse de pointe, accélération, frein, marche arrière ; virage : rad/tick à pleine vitesse
const VMAX = 11.5, ACC = 0.42, BRAKE = 0.8, REV = 0.32, VREV = 4.2, TURN = 0.105, TURN_V = 3.2, COAST = 0.986;
// surfaces : plafond de vitesse (× VMAX), accélération, adhérence latérale (part du glissement effacée par tick), traînée
const SURF = [
  { vmax: 1, acc: 1, grip: 0.36, drag: 0.012 },          // 0 piste
  { vmax: 0.6, acc: 0.75, grip: 0.3, drag: 0.04 },       // 1 hors piste (table, feutre, moquette, cahier)
  { vmax: 1, acc: 0.5, grip: 0.035, drag: 0.006 },       // 2 glisse (lait, encre)
  { vmax: 0.45, acc: 0.6, grip: 0.42, drag: 0.08 },      // 3 freine (sucre, gomme, craie)
];
const ZONE_SURF = { lait: 2, encre: 2, huile: 2, sucre: 3, gomme: 3, craie: 3, sciure: 3 };
const SENS = ['normal', 'inverse', 'hasard'];          // sens de course (« hasard » : tiré à chaque manche)
const MOB_E = 0.3, MOB_KICK = 0.8;                       // obstacles mobiles : rebond mou + petite poussée (ils ne s'arrêtent pas pour vous)
const HIT_GRACE = 75;                                    // 2,5 s après un choc violent, revenir « plus loin » sur la piste n'est pas un raccourci
const BOOST_V = 1.42, BOOST_CD = 30;                     // flèche turbo (circuit-jouet) : +42 % d'un coup, une fois par passage
const REST = { bande: 0.6, plinthe: 0.35, rail: 0.25 };  // rebond des murs (défaut 0.3) : les bandes du billard renvoient fort
const GRACE_S = 12;                                      // Course : temps laissé aux autres après le premier à l'arrivée
const ELIM_SHRINK_S = 60, ELIM_OUT = 6;                  // Élimination : la fenêtre rétrécit en 1 min, puis encore (mort subite) ; 0,2 s dehors = éliminé
const ELIM_HW2 = 170, ELIM_CAP_S = 150;                  // demi-côté au bout de 2 min (mort subite) ; filet : 2 min 30, le meneur gagne
const BUMP_CREDIT = 3 * TICK_HZ;                         // une chute dans les 3 s qui suivent un choc est créditée au cogneur
// ANTI-RACCOURCI. A : la voiture revient sur la piste AU-DELÀ de la porte suivante sans l'avoir franchie ; si elle a roulé
// moins de CUT_A de la distance de piste correspondante, c'est un raccourci → retour à la dernière porte franchie (comme une
// chute). Sinon (grand détour, voiture poussée au large) les portes sautées sont créditées sans pénalité.
// B : porte franchie après plus de CUT_OFF de l'intervalle roulé loin hors piste (> CUT_MARGE u du bord) ET un trajet plus
// court que CUT_B × l'espacement : la corde a été coupée par la table → vitesse plafonnée à PEN_V pendant PEN_T.
const CUT_A = 0.72, CUT_B = 0.75, CUT_OFF = 0.5, CUT_MARGE = 20, PEN_T = 36, PEN_V = 0.45, CUT_FALL = 18;
const BUMPER_KICK = 5.5;                                 // bumper de flipper : coup de pied (u/tick) en plus du rebond
// IA : vitesse de pointe, marge en virage, regard (u), bruit de volant, part de la ligne idéale, erreur (proba. par tick)
const MMDIFF = [
  { v: 0.8, lat: 0.78, look: 52, noise: 0.22, line: 0.45, err: 0.004 },
  { v: 0.9, lat: 0.9, look: 60, noise: 0.07, line: 0.8, err: 0.0012 },
  { v: 0.985, lat: 0.99, look: 66, noise: 0, line: 1, err: 0 },
];
const TEAM_COUNT = { ffa: 0, '2v2': 2, '2v2v2': 3, '3v3': 2, '4v4': 2, '2v2v2v2': 4, '3v3v3': 3, '5v5': 2, '2v2v2v2v2': 5 };
const numTeamsFor = (m, N) => (m === 'ffa' ? N : TEAM_COUNT[m]);
function validModes(N) {                                 // mêmes équipes que la Patate chaude (selon l'effectif EXACT)
  const v = ['ffa'];
  if (N === 4) v.push('2v2');
  if (N === 6) v.push('2v2v2', '3v3');
  if (N === 8) v.push('4v4', '2v2v2v2');
  if (N === 9) v.push('3v3v3');
  if (N === 10) v.push('5v5', '2v2v2v2v2');
  return v;
}
const r1 = v => Math.round(v * 10) / 10;
const r2 = v => Math.round(v * 100) / 100;
const finite = v => typeof v === 'number' && Number.isFinite(v);
const wrapA = a => Math.atan2(Math.sin(a), Math.cos(a));
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

export function createMicro(room) {
  let players, gameState, tick, round, countdownUntil, winner, fx, pend, mode, nteams, nParts, endTick, botCount, botDiff;
  let circuit, C, laps, formule, finCount, finDeadline, leader, leadT, cam, lastBest;
  let circChoix = CIRCUITS[0].id, sensChoix = 'normal', inverse = false;   // choix du game master (« hasard » possible) / circuit et sens joués
  const MOBP = [];                                       // positions des obstacles mobiles au tick courant
  let seatByMid = {}, clk = 0;                          // clk : horloge continue (le tick repart de 0 au départ)

  /* ---------- classement durable ---------- */
  function lbEntry(name) {
    const b = board(GID);
    return (Object.hasOwn(b, name) && b[name]) || (b[name] = { name, games: 0, wins: 0, podiums: 0, kos: 0, falls: 0, bestLap: 0, bl: {} });
  }
  function recordRound() {
    for (const p of players) {
      if (!p.playing || !p.name || p.bot) continue;            // les bots n'entrent pas au classement
      const e = lbEntry(p.name);
      e.games++;
      const win = winner >= 0 && p.place === 1;
      if (win) e.wins++;
      if (nParts >= 2 && p.place >= 1 && p.place <= 3) e.podiums = (e.podiums || 0) + 1;
      e.kos = (e.kos || 0) + p.kos; e.falls = (e.falls || 0) + p.falls;
      if (p.best > 0) {                                        // meilleur tour : global et par circuit (secondes)
        const s = r2(p.best / TICK_HZ);
        if (!e.bestLap || s < e.bestLap) e.bestLap = s;
        if (!e.bl || typeof e.bl !== 'object') e.bl = {};
        if (!Object.hasOwn(e.bl, circuit) || !(e.bl[circuit] > 0) || s < e.bl[circuit]) e.bl[circuit] = s;
      }
      bumpDaily(p.name, { win, kills: p.kos, game: GID });     // classement du jour (tous jeux)
    }
    const champ = winner >= 0 ? players.find(p => p.playing && p.team === winner) : null;
    pushHistory(GID, { when: Date.now(), mode: formule + (nteams < nParts ? ' · ' + mode : ''), preset: circuit,
      winner: champ ? (nteams < nParts ? 'Équipe ' + 'ABCDE'[winner] : (champ.name || ('P' + (champ.seat + 1)))) : 'Égalité',
      durationSec: Math.round(endTick / TICK_HZ), nParts });
    save(); markDirty(GID);
  }

  function makePlayers() {
    return Array.from({ length: MAX_SEATS }, (_, seat) => ({
      seat, member: null, mid: null, name: '', team: 0, alive: false, playing: false, bot: false,
      x: 0, y: 0, a: 0, vx: 0, vy: 0, px: 0, py: 0, steer: 0, thr: 0, si: 0,
      inp: { up: false, down: false, left: false, right: false }, ana: null,
      pg: 0, lap: 0, lapStart: 0, best: 0, last: 0, fin: 0, ftick: 0, pos: 0,
      fall: 0, fallHole: 0, ghost: 0, outT: 0, wrong: false, surf: 0, drift: 0, boostCd: 0, inZone: null, bumpFx: 0, honkT: -1e9,
      bumpBy: -1, bumpT: -1e9, bumps: 0, kos: 0, falls: 0,
      lane: 0, forme: 1, stuck: 0, rev: 0, errT: 0, noiseT: 0, noise: 0,
      gLen: 0, gOff: 0, dTrack: 0, penT: 0, cuts: 0, w: 0, slip: 0, hitT: -1e9, fallGate: -1,
      rs: 0, place: 0, elimTick: -1, score: 0,
    }));
  }
  const match = creerMatch();
  function setCircuit(id, inv) { circuit = id; inverse = !!inv; C = circuitParId(id, inverse); MOBP.length = 0; for (const m of C.mobs) MOBP.push(mobile(m, 0, {})); }
  // circuit et sens de la manche : le choix du game master, ou un tirage quand il a choisi « 🎲 Hasard »
  function tirerCircuit() {
    const id = circChoix === 'hasard' ? CIRCUITS[Math.floor(Math.random() * CIRCUITS.length)].id : circChoix;
    setCircuit(id, sensChoix === 'hasard' ? Math.random() < 0.5 : sensChoix === 'inverse');
  }
  function fullReset() {
    match.reinit();
    players = makePlayers();
    gameState = 'lobby'; tick = 0; round = 0; winner = null; fx = []; pend = [];
    mode = 'ffa'; nteams = 0; nParts = 0; endTick = 0; botCount = 0; botDiff = 1; seatByMid = {};
    circChoix = CIRCUITS[0].id; sensChoix = 'normal'; setCircuit(CIRCUITS[0].id, false); laps = 3; formule = 'course';
    finCount = 0; finDeadline = 0; leader = -1; leadT = -1e9; cam = null; lastBest = null;
  }

  const connectedCount = () => players.filter(p => p.member).length;
  const maxBots = () => MAX_SEATS - connectedCount();
  const partCount = () => Math.min(connectedCount() + botCount, MAX_SEATS);
  const canStart = () => connectedCount() >= 1 && partCount() >= 1;
  const editable = () => gameState === 'lobby' || gameState === 'over';
  const seatOf = member => { for (const p of players) if (p.member === member) return p.seat; return -1; };
  const aliveTeams = () => new Set(players.filter(p => p.alive).map(p => p.team));
  const K = () => C.gates.length;
  const timeCap = () => (formule === 'elim' ? ELIM_CAP_S : 30 + 75 * laps) * TICK_HZ;

  /* ---------- départ ---------- */
  function startGame() {
    if (!editable() || !canStart()) return;
    for (const p of players) { p.playing = false; p.bot = false; p.alive = false; }
    if (botCount > maxBots()) botCount = maxBots();
    const parts = players.filter(p => p.member);
    let bots = botCount;
    for (const p of players) { if (bots <= 0) break; if (!p.member) { p.bot = true; parts.push(p); bots--; } }
    parts.forEach((p, i) => { if (p.bot) p.name = '🤖 Bot ' + (i + 1); });
    if (!parts.length) return;
    match.debutManche(players);
    tirerCircuit();                                    // « Hasard » : un nouveau circuit / sens à chaque manche
    const N = parts.length;
    if (!validModes(N).includes(mode)) mode = 'ffa';
    nteams = numTeamsFor(mode, N);
    // grille : ordre tiré au sort à chaque manche (personne n'est toujours en pole)
    const ordre = parts.slice();
    for (let i = ordre.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = ordre[i]; ordre[i] = ordre[j]; ordre[j] = t; }
    const g = grilleDepart(C, N);
    parts.forEach((p, i) => { p.playing = true; p.team = i % nteams; });
    ordre.forEach((p, k) => {
      const s = g[k];
      Object.assign(p, { x: s.x, y: s.y, px: s.x, py: s.y, a: s.a, vx: 0, vy: 0, steer: 0, thr: 0, si: s.i, ana: null,
        pg: 0, lap: 0, lapStart: 0, best: 0, last: 0, fin: 0, ftick: 0, pos: k + 1, fall: 0, fallHole: 0, ghost: 0, outT: 0,
        wrong: false, surf: 0, drift: 0, boostCd: 0, inZone: null, bumpFx: 0, bumpBy: -1, bumpT: -1e9, bumps: 0, kos: 0, falls: 0,
        lane: ((k * 37) % 9 - 4) / 4 * 0.22, forme: 1 + (Math.random() * 2 - 1) * 0.022, stuck: 0, rev: 0, errT: 0, noiseT: 0, noise: 0, rs: 0, place: 0, elimTick: -1, alive: true, gLen: 0, gOff: 0, dTrack: 0, penT: 0, cuts: 0, w: 0, slip: 0, hitT: -1e9, fallGate: -1 });
      p.inp = { up: false, down: false, left: false, right: false };
    });
    nParts = N; endTick = 0; winner = null; finCount = 0; finDeadline = 0; leader = -1; leadT = -1e9; lastBest = null;
    cam = formule === 'elim' ? { x: g.reduce((s, q) => s + q.x, 0) / N, y: g.reduce((s, q) => s + q.y, 0) / N, hw: ELIM_HW0 } : null;
    round++; tick = 0; countdownUntil = COUNTDOWN_TICKS; gameState = 'countdown';
  }
  function backToLobby() {            // abandon : retour au lobby en pleine partie
    if (gameState !== 'play' && gameState !== 'countdown' && gameState !== 'paused') return;
    gameState = 'lobby'; winner = null; fx = []; pend = []; cam = null;
    for (const p of players) { p.playing = false; p.alive = false; p.vx = 0; p.vy = 0; }
  }

  /* ---------- progression, classement en direct ---------- */
  function progress(p) {                                 // portes franchies + fraction vers la suivante (classement en direct)
    if (p.fin) return 1e6 - p.fin * 1000;
    const k = K(), ng = p.pg % k, gA = C.gates[(ng - 1 + k) % k].i, gB = C.gates[ng].i, n = C.n;
    const span = ((gB - gA) % n + n) % n || n, at = ((p.si - gA) % n + n) % n;
    const fr = at <= span ? clamp(at / span, 0, 0.99) : 0;
    return p.pg + (p.pg > 0 ? fr : 0);
  }
  function majPositions() {
    const ps = players.filter(p => p.playing);
    for (const p of ps) p.rs = progress(p);
    ps.sort((a, b) => (b.alive - a.alive) * (formule === 'elim' ? 1 : 0) || b.rs - a.rs || a.seat - b.seat);
    ps.forEach((p, i) => { p.pos = i + 1; });
    const top = ps.find(p => p.alive);
    if (top && top.seat !== leader) {
      const prev = leader; leader = top.seat;
      if (prev >= 0 && gameState === 'play' && tick - leadT > TICK_HZ && tick > 2 * TICK_HZ) { leadT = tick; fx.push({ type: 'lead', seat: leader }); }
    }
  }

  /* ---------- fin de manche ---------- */
  function endRound() {
    gameState = 'over'; endTick = tick;
    majPositions();
    const ps = players.filter(p => p.playing);
    if (formule === 'elim') {
      const s = aliveTeams();
      if (s.size === 1) winner = [...s][0];
      else if (s.size > 1) { const top = ps.filter(p => p.alive).sort((a, b) => b.rs - a.rs); winner = top.length && (top.length < 2 || top[0].rs - top[1].rs > 0.01) ? top[0].team : -1; }
      else winner = -1;
      for (const p of ps) p.rs = p.alive ? progress(p) + 1 : 0;   // en vie d'abord (par progression), puis éliminés (par ordre de sortie)
    } else {
      const sorted = ps.slice().sort((a, b) => b.rs - a.rs || a.seat - b.seat);
      if (nteams < nParts) {                             // équipes : points de place (N, N-1, …) cumulés ; à égalité, la meilleure voiture
        const pts = {}, best = {};
        sorted.forEach((p, i) => { pts[p.team] = (pts[p.team] || 0) + (nParts - i); if (!(p.team in best)) best[p.team] = i; });
        const teams = Object.keys(pts).map(Number).sort((a, b) => pts[b] - pts[a] || best[a] - best[b]);
        const egal = teams.length > 1 && pts[teams[0]] === pts[teams[1]] && best[teams[0]] === best[teams[1]];
        winner = teams.length && !egal && sorted[0].rs > 0 ? teams[0] : -1;
      } else if (sorted.length && (sorted[0].fin || (sorted.length === 1 ? false : sorted[0].rs - sorted[1].rs > 0.01))) winner = sorted[0].team;
      else winner = sorted.length === 1 && sorted[0].fin ? sorted[0].team : -1;
    }
    if (winner >= 0) players.forEach(p => { if (p.playing && p.team === winner) p.score++; });
    match.apresManche(players, winner);
    classerManche(players, winner, { score: p => p.rs });   // places : une seule vérité, commune aux jeux (games/fin-manche.js)
    recordRound();
  }

  /* ---------- pilotage ---------- */
  function humanControl(p) {
    if (p.ana) {                                         // joystick analogique : CAP ABSOLU — la voiture tourne vers le stick
      const want = Math.atan2(p.ana.y, p.ana.x), m = Math.min(1, Math.hypot(p.ana.x, p.ana.y));
      let d = wrapA(want - p.a);
      const vf = p.vx * Math.cos(p.a) + p.vy * Math.sin(p.a);
      if (Math.abs(d) > 2.45 && vf < 1.5) { p.thr = -0.8 * m; p.steer = -clamp(Math.sign(d), -1, 1); }   // vers l'arrière, presque à l'arrêt : marche arrière en braquant
      else { p.steer = clamp(d * 2.6, -1, 1); p.thr = Math.abs(d) > 1.7 ? 0.35 * m : m; }
      return;
    }
    const i = p.inp, ts = (i.right ? 1 : 0) - (i.left ? 1 : 0);
    p.thr = (i.up ? 1 : 0) - (i.down ? 1 : 0);
    p.steer += clamp(ts - p.steer, -0.34, 0.34);        // volant progressif (clavier) : pas de coup sec
  }
  function rockSur(x, y, rr) {                           // un obstacle ou un trou sous le point (IA)
    const ids = C.near(x, y);
    for (let k = 0; k < ids.length; k++) {
      const id = ids[k];
      if (id >= 10000) { const r = C.rocks[id - 10000]; if ((x - r[0]) * (x - r[0]) + (y - r[1]) * (y - r[1]) < (r[2] + rr) * (r[2] + rr)) return true; }
    }
    for (let k = 0; k < C.holes.length; k++) { const h = C.holes[k]; if (Math.hypot(x - h[0], y - h[1]) < h[2] + rr) return true; }
    for (let k = 0; k < MOBP.length; k++) { const o = MOBP[k], r = C.mobs[k].r + rr + 16; if (Math.abs(x - o.x - o.vx * 12) < r && Math.abs(y - o.y - o.vy * 12) < r) return true; }   // mobile (et là où il sera dans 0,4 s)
    return false;
  }
  function botControl(p, cruise) {
    const D = MMDIFF[botDiff] || MMDIFF[1], n = C.n, c = Math.cos(p.a), s = Math.sin(p.a);
    const vf = p.vx * c + p.vy * s, sp = Math.abs(vf);
    if (p.rev > 0) { p.rev--; p.thr = -1; p.steer = p.steer >= 0 ? 1 : -1; return; }   // dégagement en marche arrière
    const la = Math.max(3, Math.round((D.look + sp * 6) / C.step)), ti = (p.si + la) % n, mi = (p.si + (la >> 1)) % n;
    // voie : ligne idéale + écart personnel ; on cherche la voie libre la plus proche (obstacles, trous)
    let off = C.ro[ti] * D.line + p.lane * C.W;
    for (const q of players) {                            // voiture lente juste devant : on la double par le côté le plus libre
      if (q === p || !q.alive || !q.playing || q.fall || q.ghost) continue;
      const dx = q.x - p.x, dy = q.y - p.y, d = Math.hypot(dx, dy);
      if (d > 90 || d < 1 || (dx * c + dy * s) / d < 0.75) continue;
      const qv = q.vx * c + q.vy * s;
      if (qv > vf - 0.5) continue;
      const lat = (dx * C.nx[p.si] + dy * C.ny[p.si]);
      off += lat > 0 ? -0.45 * C.W : 0.45 * C.W;
      break;
    }
    off = clamp(off, -0.62 * C.W, 0.62 * C.W);
    const libre = o => !rockSur(C.sx[ti] + C.nx[ti] * o, C.sy[ti] + C.ny[ti] * o, CAR_R + 10) && !rockSur(C.sx[mi] + C.nx[mi] * o, C.sy[mi] + C.ny[mi] * o, CAR_R + 8);
    if (!libre(off)) {
      let best = null;
      for (let k = 1; k <= 6 && best === null; k++) for (const sg of [1, -1]) { const o = clamp(off + sg * k * 0.2 * C.W, -0.75 * C.W, 0.75 * C.W); if (libre(o)) { best = o; break; } }
      if (best !== null) off = best;
    }
    const tx = C.sx[ti] + C.nx[ti] * off, ty = C.sy[ti] + C.ny[ti] * off;
    let d = wrapA(Math.atan2(ty - p.y, tx - p.x) - p.a);
    const ta = Math.atan2(C.ty[p.si], C.tx[p.si]);
    if (Math.cos(p.a - ta) < -0.2) {                     // à contresens : demi-tour vers le sens de course…
      d = wrapA(ta - p.a);
      if (Math.abs(d) > 2.2) {                           // …du côté où il y a de la place (vers l'axe de la piste), pas contre le rail
        const rx = -Math.sin(p.a), ry = Math.cos(p.a), side = (C.sx[p.si] - p.x) * rx + (C.sy[p.si] - p.y) * ry;
        d = (side >= 0 ? 1 : -1) * Math.abs(d);
      }
    }
    if (D.noise) { if (tick >= p.noiseT) { p.noiseT = tick + 8 + Math.floor(Math.random() * 10); p.noise = (Math.random() * 2 - 1) * D.noise; } }
    if (D.err && Math.random() < D.err) p.errT = tick + 6 + Math.floor(Math.random() * 10);   // Facile / Normale : un coup de volant de trop
    p.steer = clamp(d * 3.2 + (D.noise ? p.noise : 0) + (p.errT > tick ? 0.9 : 0), -1, 1);
    // vitesse : la plus basse des vitesses de virage à venir, compte tenu de la distance de freinage
    let vt = VMAX * (cruise ? 0.7 : D.v * p.forme);
    for (let k = 0; k < 32; k += 2) {
      const j = (p.si + k) % n, vc = Math.min(VMAX, 0.9 * TURN * C.rayon[j] * D.lat);
      const allow = Math.sqrt(vc * vc + 2 * BRAKE * 0.7 * k * C.step);
      if (allow < vt) vt = allow;
    }
    p.thr = sp < vt - 0.3 ? 1 : sp > vt + 0.7 ? -1 : 0.25;
    if (Math.abs(d) > 1.1 && sp > 5) p.thr = Math.min(p.thr, 0);
    // coincé (contre un mur, un bol…) : marche arrière en contre-braquant
    if (p.thr > 0 && sp < 0.7) { if (++p.stuck > 40) { p.stuck = 0; p.rev = 22; p.steer = -p.steer || 1; } } else p.stuck = 0;
  }

  /* ---------- physique ---------- */
  function surfaceDe(p) {
    const z = zoneA(C, p.x, p.y);
    let sf;
    if (z && z[4] !== 'boost') sf = ZONE_SURF[z[4]] || 1;
    else {
      sf = p.dTrack <= C.W + 4 ? 0 : 1;
    }
    if (z !== p.inZone) {                                // entrée dans une zone : éclaboussure / turbo (une fois par passage)
      p.inZone = z;
      if (z && z[4] === 'boost' && p.boostCd <= tick) { p.boostCd = tick + BOOST_CD; const c = Math.cos(p.a), s = Math.sin(p.a), vf = p.vx * c + p.vy * s, nv = Math.max(vf, VMAX * BOOST_V); p.vx += c * (nv - vf); p.vy += s * (nv - vf); fx.push({ type: 'boost', seat: p.seat }); }
      else if (z && z[4] !== 'boost') fx.push({ type: 'splash', seat: p.seat, k: z[4], x: r1(p.x), y: r1(p.y) });
    }
    return sf;
  }
  function drive(p) {
    const S = SURF[p.surf] || SURF[0], D = MMDIFF[botDiff] || MMDIFF[1];
    // lacet d'abord (il dépend de la vitesse longitudinale actuelle), puis on décompose la vitesse dans le NOUVEAU repère :
    // la part latérale qui reste est le dérapage, amorti selon l'adhérence de la surface
    let c = Math.cos(p.a), s = Math.sin(p.a);
    const vf0 = p.vx * c + p.vy * s, k = Math.min(1, Math.abs(vf0) / TURN_V);
    p.a = wrapA(p.a + p.steer * TURN * k * (vf0 >= 0 ? 1 : -1) * (Math.abs(vf0) > VMAX * 0.92 ? 0.9 : 1) + p.w);   // + rotation reçue d'un choc
    p.w *= p.slip > 0 ? 0.93 : 0.84;
    c = Math.cos(p.a); s = Math.sin(p.a);
    let vf = p.vx * c + p.vy * s, vr = -p.vx * s + p.vy * c;
    const cap = VMAX * S.vmax * (p.bot && !p.fin ? D.v * p.forme : 1) * (p.penT > tick ? PEN_V : 1);   // forme du jour (±2 %) : deux bots du même niveau finissent par se séparer ; pénalité de coupe
    if (p.thr > 0) { if (vf < cap) vf += ACC * S.acc * p.thr * (1 - Math.max(0, vf) / cap * 0.6); }
    else if (p.thr < 0) { if (vf > 0.3) vf -= BRAKE * -p.thr; else if (vf > -VREV) vf -= REV * -p.thr; }
    else vf *= COAST;
    vf *= 1 - S.drag;
    if (vf > cap) vf -= (vf - cap) * 0.07;               // trop vite pour la surface (sucre, hors piste) : ça freine
    vr *= 1 - S.grip * (p.slip > 0 ? 0.12 : 1);          // après un choc, les pneus décrochent : la voiture glisse où on l'a poussée
    if (p.slip > 0) p.slip--;
    p.vx = c * vf - s * vr; p.vy = s * vf + c * vr;
    p.drift = Math.abs(vr);
    p.px = p.x; p.py = p.y;
    p.x += p.vx; p.y += p.vy;
  }
  // ── CONTACTS ────────────────────────────────────────────────────────────────────────────────────────────────────
  // La voiture n'est plus un disque plus petit que son dessin : DEUX disques (avant / arrière) couvrent ses 34 × 18 u.
  // Un choc transmet une impulsion (auto-tamponneuse : rebond 0,9), un COUPLE (frappée sur l'avant ou l'arrière, la voiture
  // tourne : vitesse de rotation `w` qui s'amortit) et une PERTE D'ADHÉRENCE (`slip`) proportionnelle à la violence du choc :
  // pendant ce temps les pneus ne « mangent » plus la poussée latérale — la voiture glisse là où on l'a envoyée (jusqu'au
  // bord de la table). Avant, l'adhérence effaçait la poussée en quelques ticks : « on touche, il ne se passe rien ».
  const CC_OFF = CAR_L * 0.25, CC_R = CAR_W * 0.5, INERTIE = (CAR_L * CAR_L + CAR_W * CAR_W) / 12;
  const E_CAR = 0.9, ROT_K = 0.55, W_MAX = 0.32, SLIP_K = 3.2, SLIP_MAX = 32, RAM_K = 0.18;
  const CA = [[0, 0], [0, 0]], CB = [[0, 0], [0, 0]];   // centres des disques (réutilisés : aucune allocation par tick)
  function disques(p, out) {
    const c = Math.cos(p.a), s = Math.sin(p.a);
    out[0][0] = p.x + c * CC_OFF; out[0][1] = p.y + s * CC_OFF; out[1][0] = p.x - c * CC_OFF; out[1][1] = p.y - s * CC_OFF;
    return out;
  }
  // impulsion j (u/tick, déjà par unité de masse) appliquée au point (cx, cy) le long de (nx, ny) : vitesse, rotation, glisse
  function impulsion(p, cx, cy, nx, ny, j, slipK) {
    p.vx += nx * j; p.vy += ny * j;
    const rx = cx - p.x, ry = cy - p.y;
    p.w = clamp(p.w + clamp((rx * ny - ry * nx) * j / INERTIE * ROT_K, -W_MAX, W_MAX), -W_MAX, W_MAX);
    const sl = Math.min(SLIP_MAX, Math.round(Math.abs(j) * slipK));
    if (sl > p.slip) p.slip = sl;
    if (Math.abs(j) > 3) p.hitT = tick;               // choc violent : voir porteSautee
  }
  // obstacle fixe (mur, objet, bumper) : chaque disque de la voiture est repoussé ; rebond `e`, frottement, petit couple
  function pousser(p, cx, cy, nx, ny, pen, e, kick) {
    p.x += nx * pen; p.y += ny * pen;
    const vn = p.vx * nx + p.vy * ny;
    if (vn < 0 || kick) {
      const j = (vn < 0 ? -(1 + e) * vn : 0) + (kick || 0);
      impulsion(p, cx, cy, nx, ny, j, kick ? 2.4 : 0.8);
      const tx = -ny, ty = nx, vt = p.vx * tx + p.vy * ty; p.vx -= vt * 0.08 * tx; p.vy -= vt * 0.08 * ty;
      if ((j > 2.2 || kick) && tick >= p.bumpFx) { p.bumpFx = tick + 5; fx.push({ type: 'bump', a: p.seat, b: -1, x: r1(cx - nx * CC_R), y: r1(cy - ny * CC_R), i: r2(Math.min(1, j / 9)), k: kick ? 1 : 0 }); }
    }
  }
  function murs(p) {
    disques(p, CA);
    for (let d = 0; d < 2; d++) {
      const px = CA[d][0], py = CA[d][1], ids = C.near(px, py);
      for (let k = 0; k < ids.length; k++) {
        const id = ids[k];
        if (id >= 10000) {
          const r = C.rocks[id - 10000], dx = px - r[0], dy = py - r[1], dd = Math.hypot(dx, dy), rr = r[2] + CC_R;
          if (dd < rr && dd > 1e-6) {
            const bump = Object.hasOwn(BUMPERS, r[3]);     // bumper (punaise, pion, tampon…) : il RENVOIE (coup de pied en plus du rebond)
            pousser(p, px - dx / dd * CC_R, py - dy / dd * CC_R, dx / dd, dy / dd, rr - dd, bump ? 0.6 : 0.35, bump ? BUMPER_KICK : 0);
            disques(p, CA);
          }
        } else {
          const w = C.walls[id], ex = w[2] - w[0], ey = w[3] - w[1], l2 = ex * ex + ey * ey || 1;
          const u = clamp(((px - w[0]) * ex + (py - w[1]) * ey) / l2, 0, 1), qx = w[0] + ex * u, qy = w[1] + ey * u;
          const dx = px - qx, dy = py - qy, dd = Math.hypot(dx, dy), rr = w[4] + CC_R;
          if (dd < rr && dd > 1e-6) { pousser(p, qx + dx / dd * w[4], qy + dy / dd * w[4], dx / dd, dy / dd, rr - dd, Object.hasOwn(REST, w[5]) ? REST[w[5]] : 0.3, 0); disques(p, CA); }
        }
      }
      for (let k = 0; k < MOBP.length; k++) {           // obstacles mobiles : masse « infinie », ils emportent la voiture
        const o = MOBP[k], rr = C.mobs[k].r + CC_R, dx = CA[d][0] - o.x, dy = CA[d][1] - o.y, dd = Math.hypot(dx, dy);
        if (dd >= rr || dd < 1e-6) continue;
        const nx = dx / dd, ny = dy / dd;
        p.x += nx * (rr - dd); p.y += ny * (rr - dd);
        const vn = (p.vx - o.vx) * nx + (p.vy - o.vy) * ny;
        if (vn < 0.5) { const j = -(1 + MOB_E) * Math.min(0, vn) + MOB_KICK; impulsion(p, o.x + nx * C.mobs[k].r, o.y + ny * C.mobs[k].r, nx, ny, j, 1.2); if (tick >= p.bumpFx) { p.bumpFx = tick + 6; fx.push({ type: 'bump', a: p.seat, b: -1, x: r1(o.x + nx * C.mobs[k].r), y: r1(o.y + ny * C.mobs[k].r), i: r2(Math.min(1, j / 8)), k: 1 }); } }
        disques(p, CA);
      }
    }
  }
  function choc(p, q) {                                  // deux voitures : la paire de disques la plus enfoncée décide du contact
    const dx0 = q.x - p.x, dy0 = q.y - p.y;
    if (dx0 * dx0 + dy0 * dy0 > (CAR_L + 6) * (CAR_L + 6)) return;
    disques(p, CA); disques(q, CB);
    let pen = 0, nx = 0, ny = 0, cx = 0, cy = 0;
    for (let i = 0; i < 2; i++) for (let k = 0; k < 2; k++) {
      const dx = CB[k][0] - CA[i][0], dy = CB[k][1] - CA[i][1], d = Math.hypot(dx, dy), o = 2 * CC_R - d;
      if (o > pen) { pen = o; nx = d > 1e-6 ? dx / d : 1; ny = d > 1e-6 ? dy / d : 0; cx = (CA[i][0] + CB[k][0]) / 2; cy = (CA[i][1] + CB[k][1]) / 2; }
    }
    if (!(pen > 0)) return;
    p.x -= nx * pen / 2; p.y -= ny * pen / 2; q.x += nx * pen / 2; q.y += ny * pen / 2;
    const vn = (q.vx - p.vx) * nx + (q.vy - p.vy) * ny;
    if (vn >= 0) return;
    // qui pousse ? celui qui arrive le plus vite DANS le contact (avant l'échange d'élan) — pour le crédit des chutes
    const sp = p.vx * nx + p.vy * ny, sq = -(q.vx * nx + q.vy * ny);
    let j = -(1 + E_CAR) * vn / 2;
    j += RAM_K * Math.max(0, Math.max(sp, sq) - 4);      // percuter fort pousse un peu plus (le pare-chocs avant compte)
    impulsion(p, cx, cy, -nx, -ny, j, sp >= sq ? SLIP_K * 0.45 : SLIP_K);   // le percuté glisse plus longtemps que le percuteur
    impulsion(q, cx, cy, nx, ny, j, sp >= sq ? SLIP_K : SLIP_K * 0.45);
    if (j > 1.2) {
      if (sp >= sq) { q.bumpBy = p.seat; q.bumpT = tick; } else { p.bumpBy = q.seat; p.bumpT = tick; }
      if (tick >= p.bumpFx && tick >= q.bumpFx) { p.bumpFx = q.bumpFx = tick + 5; fx.push({ type: 'bump', a: p.seat, b: q.seat, x: r1(cx), y: r1(cy), i: r2(Math.min(1, j / 8)) }); }
      if (j > 2.5) { if (sp >= sq) p.bumps++; else q.bumps++; }
    }
  }
  function tomber(p, trou) {
    if (p.fall || p.fin) return;
    p.fall = FALL_T; p.fallHole = trou ? 1 : 0; p.falls++;
    const by = p.bumpBy >= 0 && tick - p.bumpT <= BUMP_CREDIT && players[p.bumpBy] && players[p.bumpBy].playing && players[p.bumpBy].team !== p.team ? p.bumpBy : -1;
    if (by >= 0) players[by].kos++;
    p.bumpBy = -1;
    fx.push({ type: 'fall', seat: p.seat, x: r1(p.x), y: r1(p.y), by, hole: p.fallHole });
  }
  function reapparaitre(p) {                             // à la dernière porte franchie (ou sur la grille avant la ligne) ; replacement : à la porte sautée
    const k = K(), n = C.n, g = p.fallGate >= 0 ? C.gates[p.fallGate] : p.pg > 0 ? C.gates[(p.pg - 1) % k] : null;
    p.fallGate = -1;
    let i = g ? (g.i - 2 + n) % n : (n - 6) % n, o = 0;
    for (const lat of [0, 0.42, -0.42, 0.7, -0.7]) {   // case libre : pas sur une autre voiture
      const x = C.sx[i] + C.nx[i] * lat * C.W, y = C.sy[i] + C.ny[i] * lat * C.W;
      if (!players.some(q => q !== p && q.alive && q.playing && !q.fall && Math.hypot(q.x - x, q.y - y) < 2 * CAR_R + 6)) { o = lat; break; }
    }
    p.x = p.px = C.sx[i] + C.nx[i] * o * C.W; p.y = p.py = C.sy[i] + C.ny[i] * o * C.W;
    p.a = Math.atan2(C.ty[i], C.tx[i]); p.vx = 0; p.vy = 0; p.si = i; p.steer = 0;
    p.fall = 0; p.ghost = GHOST_T; p.inZone = null; p.gLen = 0; p.gOff = 0; p.dTrack = 0; p.w = 0; p.slip = 0;
    fx.push({ type: 'respawn', seat: p.seat });
  }
  // raccourci (A) : comme une chute, mais la voiture « saute » de retour à la dernière porte (fallHole = 2 : rendu « téléporté »)
  function raccourci(p) {
    if (p.fall || p.fin) return;
    p.fall = CUT_FALL; p.fallHole = 2; p.cuts++; p.bumpBy = -1;
    fx.push({ type: 'coupe', seat: p.seat, x: r1(p.x), y: r1(p.y) });
  }
  // A : porte suivante dépassée sans avoir été franchie (la voiture est de retour sur la piste, plus loin)
  function porteSautee(p) {
    if (p.pg <= 0 || p.fin || p.dTrack > C.W + 30) return;
    const k = K(), n = C.n;
    let ng = p.pg % k, ahead = ((p.si - C.gates[ng].i) % n + n) % n;
    const esp = C.L / k;                                 // espacement réel des portes
    if (ahead >= n / 2 || ahead * C.step < esp * 0.9) return;
    const gp = C.gates[(ng - 1 + k) % k].i, dist = (((p.si - gp) % n + n) % n) * C.step;
    if (p.gLen < CUT_A * dist) {
      if (tick - p.hitT > HIT_GRACE) { raccourci(p); return; }
      // projeté par un choc : ni pénalité ni gain — la voiture est replacée juste avant la porte qu'elle a sautée
      p.fall = 8; p.fallHole = 3; p.fallGate = ng; fx.push({ type: 'replace', seat: p.seat }); return;
    }
    for (let guard = 0; guard < k && ahead < n / 2 && ahead * C.step >= esp * 0.5; guard++) {   // grand détour : portes créditées
      passerPorte(p, true);
      if (p.fin) return;
      ng = p.pg % k; ahead = ((p.si - C.gates[ng].i) % n + n) % n;
    }
  }
  function portes(p) {                                   // franchissement de la porte suivante, DANS LE SENS de la course
    const k = K(), ng = p.pg % k, G = C.gates[ng];
    const d0 = (p.px - G.x) * G.tx + (p.py - G.y) * G.ty, d1 = (p.x - G.x) * G.tx + (p.y - G.y) * G.ty;
    if (!(d0 < 0 && d1 >= 0)) return;
    const u = d0 / (d0 - d1), qx = p.px + (p.x - p.px) * u, qy = p.py + (p.y - p.py) * u;
    const lat = (qx - G.x) * -G.ty + (qy - G.y) * G.tx;
    if (Math.abs(lat) > G.h) return;
    passerPorte(p, false);
  }
  function passerPorte(p, credit) {                     // une porte de plus : coupe de virage (B), tours, arrivée
    const k = K(), ng = p.pg % k, n = C.n;
    if (!credit && p.pg > 0) {
      const gap = ((((C.gates[ng].i - C.gates[(ng - 1 + k) % k].i) % n) + n) % n) * C.step;
      if (p.gOff > CUT_OFF * gap && p.gLen < CUT_B * gap) { p.penT = tick + PEN_T; p.cuts++; fx.push({ type: 'penalite', seat: p.seat }); }
    }
    p.gLen = 0; p.gOff = 0;
    p.pg++;
    if (ng !== 0) return;
    // ligne d'arrivée : premier passage = départ du tour 1 ; ensuite chaque passage boucle un tour
    if (p.pg === 1) { p.lap = 1; p.lapStart = tick; return; }
    const t = tick - p.lapStart; p.last = t; p.lapStart = tick;
    const best = !p.best || t < p.best; if (best) p.best = t;
    const record = !lastBest || t < lastBest.t; if (record) lastBest = { seat: p.seat, t };
    if (formule === 'course' && p.pg >= laps * k + 1) {  // arrivée !
      p.fin = ++finCount; p.ftick = tick; p.ghost = 0;
      fx.push({ type: 'finish', seat: p.seat, pos: p.fin, sec: r2(tick / TICK_HZ), lap: r2(t / TICK_HZ) });
      if (p.fin === 1) finDeadline = tick + GRACE_S * TICK_HZ;
      return;
    }
    p.lap++;
    fx.push({ type: 'lap', seat: p.seat, lap: p.lap, sec: r2(t / TICK_HZ), best: best ? 1 : 0, rec: record ? 1 : 0, last: formule === 'course' && p.lap === laps ? 1 : 0 });
  }
  function eliminer(p) {
    p.alive = false; p.elimTick = tick; p.fall = 0;
    fx.push({ type: 'out', seat: p.seat, x: r1(p.x), y: r1(p.y) });
  }
  function fenetre() {                                   // Élimination : la fenêtre suit le meneur et rétrécit ; dehors = éliminé
    const L = leader >= 0 ? players[leader] : null;
    const u = tick / (ELIM_SHRINK_S * TICK_HZ);
    cam.hw = u <= 1 ? ELIM_HW0 - (ELIM_HW0 - ELIM_HW1) * u : ELIM_HW1 - (ELIM_HW1 - ELIM_HW2) * Math.min(1, u - 1);
    if (L && L.alive && !L.fall) { const tx = L.x + L.vx * 9, ty = L.y + L.vy * 9; cam.x += (tx - cam.x) * 0.14; cam.y += (ty - cam.y) * 0.14; }
    for (const p of players) {
      if (!p.alive || !p.playing || p.seat === leader) { p.outT = 0; continue; }
      const out = Math.abs(p.x - cam.x) > cam.hw + 10 || Math.abs(p.y - cam.y) > cam.hw + 10;
      if (out) { if (++p.outT >= ELIM_OUT) eliminer(p); } else p.outT = 0;
    }
  }

  function update() {
    fx = pend; pend = [];
    if (gameState === 'countdown') {
      tick++;
      if (tick >= countdownUntil) { gameState = 'play'; tick = 0; fx.push({ type: 'go' }); }
      return;
    }
    if (gameState !== 'play') return;
    tick++;
    for (let k = 0; k < C.mobs.length; k++) mobile(C.mobs[k], tick / TICK_HZ, MOBP[k]);   // le temps de course décide de leur place : le client les recalcule
    const racers = players.filter(p => p.alive && p.playing);
    for (const p of racers) {
      if (p.fall) continue;
      if (p.fin) botControl(p, true);                   // arrivé : pilote automatique au ralenti, en fantôme
      else if (p.bot) botControl(p, false);
      else humanControl(p);
    }
    for (const p of racers) {
      if (p.fall) { p.vx *= 0.9; p.vy *= 0.9; p.x += p.vx; p.y += p.vy; if (--p.fall <= 0) reapparaitre(p); continue; }
      if (p.ghost > 0) p.ghost--;
      if (p.boostCd > tick + BOOST_CD) p.boostCd = 0;
      p.si = proche(C, p.x, p.y, p.si, 8);
      p.dTrack = Math.hypot(p.x - C.sx[p.si], p.y - C.sy[p.si]);
      p.surf = surfaceDe(p);
      drive(p);
      const dd = Math.hypot(p.x - p.px, p.y - p.py);       // trajet depuis la dernière porte (et la part loin hors piste)
      p.gLen += dd; if (p.dTrack > C.W + CUT_MARGE) p.gOff += dd;
    }
    for (let i = 0; i < racers.length; i++) {
      const p = racers[i]; if (p.fall || p.ghost || p.fin) continue;
      for (let j = i + 1; j < racers.length; j++) { const q = racers[j]; if (!q.fall && !q.ghost && !q.fin) choc(p, q); }
    }
    for (const p of racers) {
      if (p.fall) continue;
      murs(p);
      if (p.fin) { if (!surTable(C, p.x, p.y) || dansTrou(C, p.x, p.y)) reapparaitre(p); }   // pilote automatique égaré : replacé sur la piste
      else {
        if (C.edge === 'chute' && !surTable(C, p.x, p.y)) tomber(p, false);
        else if (C.holes.length && dansTrou(C, p.x, p.y)) tomber(p, true);
        else if (!surTable(C, p.x, p.y)) { p.x = clamp(p.x, C.table.x0 + CAR_R, C.table.x1 - CAR_R); p.y = clamp(p.y, C.table.y0 + CAR_R, C.table.y1 - CAR_R); }   // filet : jamais à travers une bande
      }
      if (!p.fall) {
        portes(p);
        if (!p.fall) porteSautee(p);
        const ta = Math.atan2(C.ty[p.si], C.tx[p.si]), sp = Math.hypot(p.vx, p.vy);
        p.wrong = !p.fin && sp > 1.5 && Math.cos(p.a - ta) < -0.35 && (p.vx * C.tx[p.si] + p.vy * C.ty[p.si]) < -1;
      }
    }
    majPositions();
    if (formule === 'elim') fenetre();
    // fin de manche
    if (aliveTeams().size <= 1 && nParts >= 2) { endRound(); return; }
    if (formule === 'course') {
      const enCourse = players.filter(p => p.playing && p.alive && !p.fin).length;
      if (enCourse === 0 || (finDeadline && tick >= finDeadline)) { endRound(); return; }
    }
    if (tick >= timeCap()) { endRound(); return; }
  }

  function snapshot() {
    const live = gameState === 'play' || gameState === 'paused';
    return {
      gs: gameState, count: gameState === 'countdown' ? Math.max(0, Math.ceil((countdownUntil - tick) / TICK_HZ)) : 0,
      round, winner, fx, connected: connectedCount(), botCount, bots: botCount, maxBots: maxBots(), botDiff, nteams,
      mode: gameState === 'lobby' && !validModes(Math.max(1, partCount())).includes(mode) ? 'ffa' : mode,
      circuit, inv: inverse, choix: circChoix, sens: sensChoix, laps, formule, K: C.gates.length,
      rt: live || gameState === 'over' ? r2((gameState === 'over' ? endTick : tick) / TICK_HZ) : 0,   // chrono de course (s) — surtout pas « t » : le hub l'utilise pour le type du message
      lead: leader, finT: formule === 'course' && finDeadline && live ? Math.max(0, Math.ceil((finDeadline - tick) / TICK_HZ)) : null,
      cam: cam && gameState !== 'lobby' ? [r1(cam.x), r1(cam.y), Math.round(cam.hw)] : null,
      rec: lastBest ? [lastBest.seat, r2(lastBest.t / TICK_HZ)] : null,
      match: match.etat(players),
      stats: gameState === 'over' ? { durationSec: Math.round(endTick / TICK_HZ), nParts, circuit, laps, formule, match: match.gagne } : null,
      players: players.map(p => ({
        seat: p.seat, name: p.name, team: p.team, connected: !!p.member, playing: p.playing, alive: p.alive, bot: !!p.bot,
        x: r1(p.x), y: r1(p.y), a: r2(p.a), sp: Math.round(Math.hypot(p.vx, p.vy)), dr: Math.min(9, Math.round(p.drift)), st: Math.round(p.steer * 2) / 2,   // arrondis grossiers : moins de deltas (moteur, traces, roues)
        th: p.thr > 0.1 ? 1 : p.thr < -0.1 ? -1 : 0,
        su: p.surf, fa: p.fall ? r2(1 - p.fall / FALL_T) : 0, fh: p.fallHole, gh: p.ghost > 0, ww: !!p.wrong,
        lap: Math.max(1, Math.min(laps, p.lap || 1)), pos: p.pos, fin: p.fin, ft: p.fin ? r2(p.ftick / TICK_HZ) : 0,
        bl: p.best ? r2(p.best / TICK_HZ) : 0, ll: p.last ? r2(p.last / TICK_HZ) : 0, pg: p.pg,
        bumps: p.bumps, kos: p.kos, falls: p.falls, cuts: p.cuts, pen: p.penT > tick, score: p.score, place: p.place, elimTick: p.elimTick,
      })),
    };
  }

  /* ---- contrat plateforme ---- */
  function repriseSiegeBot(p) {
    p.playing = false; p.alive = false; p.place = 0; p.kos = 0; p.falls = 0; p.bumps = 0; p.fin = 0; p.best = 0;
    if ('score' in p) p.score = 0;
  }
  function onJoin(member) {
    const cur = seatOf(member); if (cur >= 0) return { role: 'player', seat: cur, hello: { t: 'welcome', seat: cur } };
    let seat = -1;
    const rid = seatByMid[member.id];
    if (rid != null && players[rid] && !players[rid].member && !players[rid].bot) seat = rid;
    if (seat < 0) { const free = players.find(p => !p.member && !p.bot && (editable() || !p.playing)) || (editable() ? players.find(p => !p.member) : null); if (free) seat = free.seat; }
    if (seat < 0) return { role: 'spectator', hello: { t: 'welcome', seat: -1 } };
    const p = players[seat];
    if (p.bot) repriseSiegeBot(p);
    p.member = member; p.bot = false; p.mid = member.id; p.name = member.name || '';
    seatByMid[member.id] = seat;
    return { role: 'player', seat, hello: { t: 'welcome', seat } };
  }
  function onLeave(member) {
    const seat = seatOf(member); if (seat < 0) return;
    const p = players[seat]; p.member = null; p.inp = { up: false, down: false, left: false, right: false }; p.ana = null; p.thr = 0; p.steer = 0;
    if (gameState === 'play' || gameState === 'countdown' || gameState === 'paused') {
      if (p.alive) { p.rs = progress(p); p.alive = false; p.elimTick = tick; pend.push({ type: 'quit', seat: p.seat }); }   // sort de la course (classé à sa progression)
      if (connectedCount() === 0) fullReset();
      else if (gameState === 'play' && aliveTeams().size <= 1 && nParts >= 2) endRound();
    } else if (connectedCount() === 0) fullReset();
  }
  function onRename(member) { const s = seatOf(member); if (s >= 0) players[s].name = member.name || ''; }
  function cycle(list, v) { const i = list.indexOf(v); return list[(i + 1) % list.length]; }
  function onMessage(member, m) {
    if (!m || typeof m !== 'object') return;
    const seat = seatOf(member);
    const p = seat >= 0 ? players[seat] : null;
    if (m.t === 'input' && p) {                          // état TENU des 4 touches ; {mx,my} analogique (joystick) = cap absolu
      if (finite(m.mx) && finite(m.my)) {
        let x = clamp(m.mx, -1, 1), y = clamp(m.my, -1, 1); const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; }
        if (l < 0.12) { p.ana = null; p.inp = { up: false, down: false, left: false, right: false }; } else p.ana = { x, y };   // stick relâché : tout lâché
      }
      else { p.ana = null; p.inp = { up: !!m.up, down: !!m.down, left: !!m.left, right: !!m.right }; }
    }
    else if (m.t === 'klaxon' && p) { if (p.playing && clk - p.honkT >= 20 && (gameState === 'play' || gameState === 'countdown')) { p.honkT = clk; pend.push({ type: 'honk', seat: p.seat }); } }
    else if (m.t === 'start') startGame();
    else if (m.t === 'pause') { if (gameState === 'play') gameState = 'paused'; else if (gameState === 'paused') gameState = 'play'; }
    else if (m.t === 'abort') backToLobby();
    else if (m.t === 'mode') { if (editable()) { const v = validModes(partCount()); mode = v[(v.indexOf(mode) + 1) % v.length] || 'ffa'; } }
    else if (m.t === 'bots') { if (editable()) { const mx = maxBots(); botCount = mx <= 0 ? 0 : (botCount + 1) % (mx + 1); } }
    else if (m.t === 'botdiff') { if (editable()) botDiff = (botDiff + 1) % 3; }
    else if (m.t === 'circuit') {                      // cycle des circuits, puis « 🎲 Hasard » (un circuit tiré à chaque manche)
      if (editable()) {
        const ids = CIRCUITS.map(c => c.id).concat(['hasard']);
        circChoix = typeof m.id === 'string' && ids.includes(m.id) ? m.id : cycle(ids, circChoix);
        if (circChoix !== 'hasard') setCircuit(circChoix, sensChoix === 'hasard' ? inverse : sensChoix === 'inverse');
      }
    }
    else if (m.t === 'sens') { if (editable()) { sensChoix = cycle(SENS, sensChoix); if (sensChoix !== 'hasard') setCircuit(circuit, sensChoix === 'inverse'); } }
    else if (m.t === 'laps') { if (editable()) laps = cycle(LAPS, laps); }
    else if (m.t === 'formule') { if (editable()) formule = cycle(FORMULES, formule); }
    else if (m.t === 'match') { if (editable()) match.changer(players); }
    else if (m.t === 'lbreset') reset(GID);
  }
  function tick_() { clk++; for (const p of players) if (p.member) p.name = p.member.name || p.name || ''; update(); return snapshot(); }

  fullReset();
  return { onJoin, onLeave, onRename, onMessage, tick: tick_, isIdle: editable };
}

export default { meta: { id: GID, name: 'Micro Machines', min: 1, max: 10, tickHz: TICK_HZ, desc: 'Course de voitures-jouets vue de dessus sur des tables et des circuits miniatures — bousculades, chutes, élimination' }, create: createMicro };
