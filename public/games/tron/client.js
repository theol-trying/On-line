// Module client TRON v3 : traînées + bonus + boost + équipes + arène qui se referme.
// Identité « Cyber-grid » portée au niveau du Sumo : sol de grille pré-rendu hors écran (dalles, grain,
// reflet, cadre biseauté, tube néon), motos en vrai sprite pré-rendu (pneus, carénage, verrière, liserés),
// traînées en rubans lumineux, dérésolution en éclats voxel, murs de rétrécissement en barrières laser,
// bonus en hologrammes hexagonaux dessinés au canvas. Trois thèmes : Néon / CRT / Clair.
import { GW as GW0, GH as GH0, CELL as CELL0, ARENA } from './shared.js';
// grille dynamique (nb de joueurs) : l'arène garde la MÊME taille logique, seule la taille des cases change
let GW = GW0, GH = GH0, CELL = CELL0;
import { createMusic } from '../../music.js';
import { seatPattern, SEAT_GLYPH } from '../../patterns.js';   // motifs par siège (daltonisme / jusqu'à 10 joueurs)
import { initGameMsg, msgPerso, msgGlobal } from '../../gamemsg.js';   // bandeaux « ce que tu viens de ramasser »
import { arenaSize } from '../../layout.js';   // taille du plateau : commune aux jeux (mode plein écran compris)
import { lumiere, creerLumieres } from '../../lumiere.js';      // phares, halos de traînée, dérésolutions qui éclairent le sol
import { crepuscule, creerDuel } from '../../crepuscule.js';               // jour → crépuscule pendant que l'arène se referme
import { creerJournal, blocFin } from '../../finpartie.js';
import { creerEcho } from '../../echo-virage.js';                 // chevron immédiat du virage enregistré (file de 2 virages côté serveur)
const ECHO = creerEcho();     // courbe de la manche + meilleure action (écran de fin)

// Duel final (crepuscule.js) : quand il ne reste que 2 joueurs ou 2 équipes, la nuit tombe en ~4 s.
const DUEL = creerDuel(), duelAnnonce = () => msgGlobal('⚔', 'Duel final !', { color: '#ff5a3c' });

// musique : synthwave en mi mineur (i–VI–III–VII) — nappe en dents de scie, basse en croches à l'octave,
// arpège carré, batterie 4 temps ; lobby = nappe + arpège sinus ; climax (duel final) = charley serré + lead.
const MUSIC_THEME = { bpm: 118, bpmBoost: 14, vol: 0.5, root: 82.41, len: 32,
  stingers: { kill: { notes: [12, 7, 3, -5], wave: 'square', oct: 1, gain: 0.03, dur: 0.12, rate: 0.045 },   // dérésolution : arpège qui s'effondre
    win: { base: 164.81, notes: [[0, 7, 12], [3, 10, 15], [5, 12, 17], [7, 12, 19, 24]], wave: 'sawtooth', gain: 0.028, dur: 0.36, rate: 0.14 },
    count: { notes: [12], oct: 2, wave: 'square', dur: 0.08, gain: 0.03, duck: false }, go: { notes: [[0, 7, 12, 19]], oct: 1, wave: 'sawtooth', dur: 0.5, gain: 0.032, duck: false },
    alert: { notes: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], oct: 1, wave: 'sawtooth', rate: 0.035, dur: 0.1, gain: 0.03 } },
  layers: [
  { seq: [[0, 7, 12], null, null, null, null, null, null, null, [-4, 3, 8], null, null, null, null, null, null, null, [3, 10, 15], null, null, null, null, null, null, null, [-2, 5, 10], null, null, null, null, null, null, null], oct: 1, wave: 'sawtooth', gain: 0.008, dur: 8 },
  { seq: [0, null, 7, null, 12, null, 7, null, -4, null, 3, null, 8, null, 3, null, 3, null, 10, null, 15, null, 10, null, -2, null, 5, null, 10, null, 5, null], oct: 2, wave: 'sine', gain: 0.011, dur: 1.6 },
  { seq: [0, null, 0, null, 12, null, 0, null, -4, null, -4, null, 8, null, -4, null, 3, null, 3, null, 15, null, 3, null, -2, null, -2, null, 10, null, -2, null], wave: 'triangle', gain: 0.05, dur: 0.9, min: 1 },
  { drums: 'K...S...K...S...K...S...K..KS...', gain: 0.9, min: 1 },
  { drums: '..H...H...H...H...H...H...H...H.', gain: 0.7, min: 1 },
  { seq: [0, 3, 7, 12, 7, 3, 0, 3, -4, 0, 3, 8, 3, 0, -4, 0, 3, 7, 10, 15, 10, 7, 3, 7, -2, 2, 5, 10, 5, 2, -2, 2], oct: 2, wave: 'square', gain: 0.007, dur: 0.7, min: 1 },
  { drums: 'HHHHHHHHHHHHHHHH', gain: 0.45, min: 2 },
  { seq: [19, null, null, null, 17, null, 15, null, 12, null, null, null, 15, null, null, null, 15, null, null, null, 17, null, 19, null, 22, null, null, null, 19, null, 17, null], oct: 1, wave: 'sawtooth', gain: 0.01, dur: 3, min: 2 },
] };

// 10 sièges : au-delà de 8 il n'existe plus de teintes toutes distinguables entre elles,
// c'est le MOTIF par siège (patterns.js) qui porte l'identification.
const PAL = { normal: ['#4a9ee0', '#e06240', '#2aaf7a', '#cc9010', '#9b6cf0', '#e268b0', '#25c9c0', '#9ec93a', '#d06ef0', '#f2f0e6'],
              cb: ['#0072B2', '#E69F00', '#009E73', '#F0E442', '#CC79A7', '#56B4E9', '#D55E00', '#F5F5F5', '#7B68EE', '#9A9A9A'] };
const TEAMPAL = { normal: ['#4a9ee0', '#e06240', '#2aaf7a', '#cc9010', '#9b6cf0'], cb: ['#0072B2', '#E69F00', '#009E73', '#F0E442', '#CC79A7'] };
const TEAM_LETTER = ['A', 'B', 'C', 'D', 'E'];
const MODE_NAME = { ffa: 'Chacun pour soi', '2v2': '2 v 2', '2v2v2': '2 v 2 v 2', '3v3': '3 v 3', '4v4': '4 v 4', '2v2v2v2': '2 v 2 v 2 v 2', '3v3v3': '3 v 3 v 3', '5v5': '5 v 5', '2v2v2v2v2': '2 v 2 v 2 v 2 v 2' };
const MAX_SEATS = 10;                                   // nombre de sièges max (aligné sur le serveur)
const TEAM_TOTALS = [4, 6, 8, 9, 10];                   // effectifs exacts pour lesquels le serveur propose un mode par équipes
const TICK_HZ = 15;                                     // cadence serveur : elimTick est compté en ticks
const DIFF_NAMES = ['Facile', 'Normale', 'Difficile'];
// Bonus : couleur + nom. Le canvas les dessine en PICTOGRAMMES vectoriels (picto()) — jamais en caractères,
// dont le rendu varie d'un OS à l'autre. Les glyphes (i) ne servent qu'aux bandeaux DOM.
const PU = { speed: { i: '»', c: '#9fe6ff', n: 'VITESSE' }, ghost: { i: '◌', c: '#cbb3ff', n: 'FANTÔME' }, cut: { i: '✄', c: '#ffd76b', n: 'COUPE' },
  blink: { i: '➤', c: '#7fffd4', n: 'TÉLÉPORT' }, breaker: { i: '⊘', c: '#ffcf5a', n: 'CASSE-MUR' }, invert: { i: '⇄', c: '#ff9be0', n: 'INVERSION' } };
const PU_DEF = { i: '?', c: '#ffffff', n: '?' };
const puDef = t => (Object.prototype.hasOwnProperty.call(PU, t) ? PU[t] : PU_DEF);   // pas de PU['constructor'] venu du réseau
// Retour de test : l'icône seule ne dit pas l'effet. Libellés affichés au ramassage — constantes du
// client uniquement, jamais une chaîne venue du réseau. Bonus PERSONNELS (n'affectent que le ramasseur).
const PU_MSG = {
  speed: { i: '»', t: 'Vitesse : 2× plus rapide' },
  ghost: { i: '◌', t: 'Fantôme : tu traverses les traînées' },
  cut: { i: '✄', t: 'Coupe : ta traînée effacée' },
  blink: { i: '➤', t: 'Téléport : saut vers l’avant' },
  breaker: { i: '⊘', t: 'Casse-mur : perce UNE traînée' },
};
// Effets vus par tout le monde : l'inversion frappe TOUS les adversaires du ramasseur, et le
// rétrécissement de l'arène concerne les survivants. Bande fine en haut, hors de la zone de jeu.
const INVERT_MSG = { i: '⇄', autres: 'Adversaires : contrôles inversés', moi: 'Tes contrôles sont inversés' };
const BREAK_MSG = { i: '⊘', t: 'Casse-mur consommé' };
const SHRINK_MSG = { i: '⚠', t: 'L’arène se referme !' };
// Thèmes (sélecteur du shell). glow = rendu additif lumineux (Néon/CRT) ; le thème Clair remplace la lueur
// par des ombres portées. scan = lignes de balayage cathodiques pré-rendues dans le décor.
const THEMES = {
  neon: { id: 'neon', bg: '#05060e', field: '#0a0c1a', field2: '#121b36', accent: '#1fe0ff', accent2: '#ff3dbb', laser: '#ff3358', wall: '#150a16', rim: '#0f1426',
    gridA: 0.07, majA: 0.2, ink: '#eaffff', sub: 'rgba(200,240,255,0.68)', veil: 'rgba(3,5,12,0.68)', titleFill: 'rgba(8,30,42,0.9)', glow: true, scan: false },
  crt: { id: 'crt', bg: '#010904', field: '#03120a', field2: '#0b2716', accent: '#46ff8f', accent2: '#c8ff5a', laser: '#ffb030', wall: '#100d03', rim: '#06170d',
    gridA: 0.08, majA: 0.22, ink: '#dcffe8', sub: 'rgba(190,255,215,0.68)', veil: 'rgba(1,8,4,0.7)', titleFill: 'rgba(4,30,14,0.9)', glow: true, scan: true },
  light: { id: 'light', bg: '#d3d9e8', field: '#e6eaf4', field2: '#f7f9fd', accent: '#1570d4', accent2: '#cf2f7c', laser: '#e01d3d', wall: '#9aa3bf', rim: '#b3bcd3',
    gridA: 0.1, majA: 0.22, ink: '#0b1830', sub: 'rgba(11,24,48,0.7)', veil: 'rgba(232,236,246,0.82)', titleFill: 'rgba(236,243,255,0.96)', glow: false, scan: false },
};
const DISP = "Orbitron, 'Segoe UI', system-ui, sans-serif";   // police d'affichage (Google Fonts, chargée par la page)
// fond animé : fines lignes de néon qui tombent (pluie de code) — coupé par reduceFx
const AMB_RAIN = Array.from({ length: 14 }, () => ({ x: Math.random(), v: 30 + Math.random() * 70, l: 18 + Math.random() * 40, ph: Math.random() * 1000 }));
const INTERP_MS = 80;
const DIR_KEYS = { ArrowUp: 'up', KeyW: 'up', KeyZ: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', KeyQ: 'left', ArrowRight: 'right', KeyD: 'right' };   // ZQSD / WASD : KeyW/KeyA = touches Z/Q en AZERTY ; KeyZ/KeyQ pour un clavier réglé en QWERTY

function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function hexRgb(h) { const n = parseInt(String(h).slice(1, 7), 16) || 0; return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function rgbStr(c, a) { return a == null ? `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})` : `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`; }
function rgba(h, a) { return rgbStr(hexRgb(h), a); }
function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }   // mulberry32 : décor identique d'un rendu à l'autre
function hash2(a, b) { const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return x - Math.floor(x); }
function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; }
// rectangle arrondi maison (arcTo) : ctx.roundRect est absent des vieux Safari
function rrect(g, x, y, w, h, r) { r = Math.max(0, Math.min(r, w / 2, h / 2)); g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
// plaque à coins coupés (HUD)
function plate(g, x, y, w, h, k) { g.beginPath(); g.moveTo(x + k, y); g.lineTo(x + w - k, y); g.lineTo(x + w, y + k); g.lineTo(x + w, y + h - k); g.lineTo(x + w - k, y + h); g.lineTo(x + k, y + h); g.lineTo(x, y + h - k); g.lineTo(x, y + k); g.closePath(); }
function hexPath(g, r) { g.beginPath(); for (let k = 0; k < 6; k++) { const a = -Math.PI / 2 + k * Math.PI / 3; if (k) g.lineTo(Math.cos(a) * r, Math.sin(a) * r); else g.moveTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); }
// texte espacé à la main (ctx.letterSpacing n'existe pas sur les vieux Safari)
function spaced(g, txt, x, y, sp) {
  const ch = String(txt).split(''), ws = ch.map(c => g.measureText(c).width), tot = ws.reduce((s, w) => s + w, 0) + sp * (ch.length - 1);
  const al = g.textAlign; g.textAlign = 'left'; let cx = x - tot / 2;
  for (let i = 0; i < ch.length; i++) { g.fillText(ch[i], cx, y); cx += ws[i] + sp; }
  g.textAlign = al;
}
// Pictogrammes vectoriels (boîte ±6 unités, mise à l'échelle par s/6). Servent au sol (hologrammes), au HUD
// et aux alertes : même dessin partout, identique sur tous les OS.
function picto(g, t, x, y, s, col) {
  const k = s / 6; g.save(); g.translate(x, y); g.scale(k, k);
  g.fillStyle = col; g.strokeStyle = col; g.lineCap = 'round'; g.lineJoin = 'round';
  if (t === 'speed') { g.lineWidth = 1.9; g.beginPath(); g.moveTo(-5, -4.5); g.lineTo(-0.8, 0); g.lineTo(-5, 4.5); g.moveTo(0.2, -4.5); g.lineTo(4.4, 0); g.lineTo(0.2, 4.5); g.stroke(); }
  else if (t === 'ghost') {
    g.beginPath(); g.moveTo(-4.5, 5.5); g.lineTo(-4.5, -0.5); g.arc(0, -0.5, 4.5, Math.PI, 0, false); g.lineTo(4.5, 5.5); g.lineTo(3, 4); g.lineTo(1.5, 5.5); g.lineTo(0, 4); g.lineTo(-1.5, 5.5); g.lineTo(-3, 4); g.closePath(); g.fill();
    g.fillStyle = 'rgba(5,9,20,0.9)'; g.beginPath(); g.arc(-1.7, -0.8, 1.1, 0, Math.PI * 2); g.arc(1.7, -0.8, 1.1, 0, Math.PI * 2); g.fill();
  } else if (t === 'cut') {
    g.lineWidth = 1.4; g.beginPath(); g.arc(-3.6, -2.9, 1.9, 0, Math.PI * 2); g.stroke(); g.beginPath(); g.arc(-3.6, 2.9, 1.9, 0, Math.PI * 2); g.stroke();
    g.lineWidth = 1.6; g.beginPath(); g.moveTo(-2.2, -1.8); g.lineTo(5.5, 2.6); g.moveTo(-2.2, 1.8); g.lineTo(5.5, -2.6); g.stroke();
    g.beginPath(); g.arc(0.6, 0, 0.8, 0, Math.PI * 2); g.fill();
  } else if (t === 'blink') {
    g.fillRect(-6, -0.9, 1.8, 1.8); g.fillRect(-3.4, -0.9, 1.8, 1.8);
    g.lineWidth = 1.8; g.beginPath(); g.moveTo(-0.8, 0); g.lineTo(2.2, 0); g.stroke();
    g.beginPath(); g.moveTo(5.8, 0); g.lineTo(1.6, -3.8); g.lineTo(1.6, 3.8); g.closePath(); g.fill();
  } else if (t === 'breaker') { g.lineWidth = 1.7; g.beginPath(); g.arc(0, 0, 4.6, 0, Math.PI * 2); g.stroke(); g.beginPath(); g.moveTo(-3.2, 3.2); g.lineTo(3.2, -3.2); g.stroke(); }
  else if (t === 'invert') {
    g.lineWidth = 1.5; g.beginPath(); g.moveTo(-4.8, -2.3); g.lineTo(3, -2.3); g.moveTo(4.8, 2.3); g.lineTo(-3, 2.3); g.stroke();
    g.beginPath(); g.moveTo(5.4, -2.3); g.lineTo(2.2, -4.6); g.lineTo(2.2, 0); g.closePath(); g.moveTo(-5.4, 2.3); g.lineTo(-2.2, 0); g.lineTo(-2.2, 4.6); g.closePath(); g.fill();
  } else if (t === 'bolt') { g.beginPath(); g.moveTo(1.2, -6); g.lineTo(-3.2, 0.8); g.lineTo(-0.2, 0.8); g.lineTo(-1.4, 6); g.lineTo(3.4, -1.2); g.lineTo(0.4, -1.2); g.closePath(); g.fill(); }
  else if (t === 'play') { g.beginPath(); g.moveTo(-3.5, -5); g.lineTo(5, 0); g.lineTo(-3.5, 5); g.closePath(); g.fill(); }
  else if (t === 'warn') { g.lineWidth = 1.4; g.beginPath(); g.moveTo(0, -5.5); g.lineTo(5.8, 4.8); g.lineTo(-5.8, 4.8); g.closePath(); g.stroke(); g.lineWidth = 1.6; g.beginPath(); g.moveTo(0, -2); g.lineTo(0, 1.4); g.stroke(); g.beginPath(); g.arc(0, 3.2, 0.8, 0, Math.PI * 2); g.fill(); }
  else { g.lineWidth = 1.6; g.beginPath(); g.arc(0, 0, 4, 0, Math.PI * 2); g.stroke(); }
  g.restore();
}

export default (function () {
  let A, send, root, cv, ctx, togglePanel = () => {}, closePanels = () => {};
  let CC = PAL.normal, TEAMCC = TEAMPAL.normal, TH = THEMES.neon, FX = 1;
  let mySeat = -1, snap = null, prevSnap = null, prevGs = 'lobby', teamMode = false, endShown = false, inGamePrev = false, prevRound = -1, lastCount = -1, prevSd = false, prevShrink = 0, prevBoost = false;
  let board = [], buf = [];
  // effets ponctuels (tous plafonnés) : éclats voxel, étincelles, ondes, éclairs, libellés, traînées coupées, motos qui se dérésolvent, braises de boost
  const voxels = [], sparks = [], rings = [], flashes = [], labels = [], cutGhosts = [], derez = [], embers = [], twinkles = [];
  const deadAt = {}, angView = {}, headPos = {};
  let shakeMag = 0, rafId = 0, destroyed = false, resizeH = null, actx = null, noiseBuf = null, boostHeld = false, killcam = null;
  let lastFrame = 0, wallFlash = 0, invFlash = 0, lastFw = 0;
  let occ = null;                                        // occupation de la grille (reconstruite à 15 Hz) : alerte « mur devant »
  const music = createMusic(() => actx, () => A, MUSIC_THEME);
  // Couche « vitrine » : éclairage dynamique, crépuscule, journal de manche (côté client seulement)
  const LUM = creerLumieres(24), J = creerJournal({ pas: 750 });
  let duskT = 0, jClock = 0, jLast = 0;                  // jClock : temps de JEU (les pauses ne comptent pas)
  const dist = {}, lastHead = {}, lastKill = {}, phareC = {};
  // intensité des lueurs : pleine en Néon/CRT, discrète sur le sol clair, adoucie en contraste élevé
  const lk = () => (TH.glow ? 1 : 0.35) * (A.contrast ? 0.6 : 1);
  const phare = col => phareC[col] || (phareC[col] = rgbStr(mix(hexRgb(col), [255, 255, 255], 0.65)));
  const pname = s => { const p = snap && snap.players[s]; return (p && p.name) || ('P' + (s + 1)); };
  let hud, cards, startBtn, pauseBtn, modeBtn, fadeBtn, botsBtn, diffBtn, pauseFloat, lbBtn, lbPanel, lbBody, endEl;

  const $ = id => root.querySelector('#' + id);
  const colSeat = s => { if (s < 0 || !snap) return '#ffffff'; const p = snap.players[s]; return teamMode && p ? TEAMCC[p.team % TEAMCC.length] : CC[s % CC.length]; };
  // nom destiné au CANVAS : sans emoji (les bots s'appellent « 🤖 Bot n » ; le rendu des emoji varie selon l'OS)
  const canvasName = s => { const p = snap && snap.players[s], n = p ? String(p.name || '').replace(/[\u{1F000}-\u{1FAFF}☀-➿️]/gu, '').trim() : ''; return (n || ('P' + (s + 1))).slice(0, 18); };
  const px = c => c * CELL + CELL / 2;
  const clampG = (v, n) => Math.max(0, Math.min(n - 1, v));
  function applyColors() {
    CC = PAL[A.palette] || PAL.normal; TEAMCC = TEAMPAL[A.palette] || TEAMPAL.normal; FX = A.reduceFx ? 0 : 1; TH = THEMES[A.theme] || THEMES.neon;
    decorKey = ''; motoCache = {}; motoN = 0; puCache = {}; puN = 0; tsCache = {}; hazPat = null; coneG = null;
  }

  function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const size = arenaSize({ max: 760 });
    cv.style.width = size + 'px'; cv.style.height = size + 'px';
    cv.width = Math.round(size * dpr); cv.height = Math.round(size * dpr);
  }

  // ───────────────────────── HUD, classement, écran de fin ─────────────────────────
  function refreshHUD() {
    if (!snap) return;
    snap.players.forEach((p, i) => {
      const shown = p.connected || p.playing;
      cards[i].classList.toggle('hidden', !shown);
      if (!shown) return;
      const col = colSeat(i);
      cards[i].style.color = col;
      cards[i].classList.toggle('dead', p.playing && !p.alive);
      cards[i].classList.toggle('me', i === mySeat);
      const tags = [];
      if (teamMode) tags.push(`<span class="badge" style="background:${col}28;color:${col}">ÉQ.${TEAM_LETTER[p.team] || '?'}</span>`);
      if (p.bot) tags.push(`<span class="badge" style="background:${col}28;color:${col}">BOT</span>`);
      else if (i === mySeat) tags.push(`<span class="badge" style="background:${col}28;color:${col}">VOUS</span>`);
      const glyph = SEAT_GLYPH[i % SEAT_GLYPH.length];   // constante : rappel du motif porté par la moto
      cards[i].querySelector('.pn').innerHTML = `${(window.__AV && window.__AV(p.name)) || ''}<span class="sg" style="opacity:.8">${glyph}</span> ${esc(p.name || ('P' + (i + 1)))} <span class="sc">${p.kills | 0} ⚡</span> ${tags.join('')}`;
      const lv = cards[i].querySelector('.lv'); lv.style.color = col;
      if (!p.playing) { lv.textContent = 'prêt'; return; }
      if (!p.alive) { lv.textContent = '✖ dérésolu'; return; }
      // états visibles de tous : ce qu'on regarde d'un coin d'œil en pleine course
      const st = []; if (p.boosting) st.push('⚡'); if (p.speed) st.push('»'); if (p.ghost) st.push('◌'); if (p.brk) st.push('⊘'); if (p.inv) st.push('⇄');
      lv.textContent = '● en ligne' + (st.length ? ' · ' + st.join(' ') : '');
    });
  }
  function renderLB() {
    if (!lbBody) return;
    if (!board.length) { lbBody.innerHTML = '<div class="lbnote">Aucune partie enregistrée.</div>'; return; }
    const B = board.map(e => ({ ...e, kd: e.deaths ? (e.kills || 0) / e.deaths : (e.kills || 0) }));
    lbBody.innerHTML = B.sort((a, b) => (b.wins || 0) - (a.wins || 0) || b.kd - a.kd).map(e =>
      `<div class="lbrow"><span class="lbn">${esc(e.name)}</span><span>🎮${e.games || 0}</span><span>🏆${e.wins || 0}</span><span title="kills">⚡${e.kills || 0}</span><span title="K/D">⚖${(e.deaths ? ((e.kills || 0) / e.deaths).toFixed(2) : ((e.kills || 0) ? '∞' : '0'))}</span><span title="meilleure survie">⏱${Math.round(e.bestSurvivalSec || 0)}s</span></div>`).join('');
  }
  function showEndscreen(m) {
    if (m.gs !== 'over' || !m.stats) { endEl.classList.add('hidden'); return; }
    endEl.classList.remove('hidden');
    const parts = m.players.filter(p => p.playing && p.place > 0).slice().sort((a, b) => a.place - b.place);
    const champ = m.winner >= 0 ? parts.find(p => p.team === m.winner) : null;
    const who = champ ? (teamMode ? 'Équipe ' + TEAM_LETTER[m.winner] : esc(champ.name || ('P' + (champ.seat + 1)))) : null;
    const title = champ ? who + ' règne sur la grille !' : 'Égalité — double dérésolution';
    const medals = ['🥇', '🥈', '🥉'];
    // MVP : le plus d'éliminations, départage au classement (≥ 1 élimination, sinon personne)
    let mvp = null; parts.forEach(p => { if ((p.kills | 0) > 0 && (!mvp || p.kills > mvp.kills || (p.kills === mvp.kills && p.place < mvp.place))) mvp = p; });
    const rows = parts.map(p => {
      const col = colSeat(p.seat), medal = medals[p.place - 1] || ('#' + p.place);
      const res = p.alive ? 'dernier·e en ligne' : `dérésolu à ${Math.round((p.elimTick || 0) / TICK_HZ)}s`;
      return `<div class="erow ${p.alive ? 'win' : ''}"><span class="eplace">${medal}</span>
        <span class="ename" style="color:${col}">${esc(p.name || ('P' + (p.seat + 1)))}${teamMode ? ` <small>Éq.${TEAM_LETTER[p.team]}</small>` : ''}${mvp && mvp.seat === p.seat ? ' <small>⭐ MVP</small>' : ''}</span>
        <span class="estat" title="éliminations">⚡ ${p.kills | 0}</span><span class="eres">${res}</span></div>`;
    }).join('');
    const mvpLine = mvp ? `<div class="emeta">⭐ MVP : <b style="color:${colSeat(mvp.seat)}">${esc(mvp.name || ('P' + (mvp.seat + 1)))}</b> — ${mvp.kills} élimination${mvp.kills > 1 ? 's' : ''}</div>` : '';
    endEl.innerHTML = `<div class="etitle" style="color:${champ ? colSeat(champ.seat) : '#fff'}">${title}</div>
      <div class="emeta">⏱ ${m.stats.durationSec}s · ${m.stats.nParts} pilotes</div>${mvpLine}<div class="elist">${rows}</div>${blocFin(J, { titre: 'Distance parcourue (cases)', couleur: s => colSeat(s), nom: pname })}<div class="ehint">Espace / clic pour rejouer</div>`;
  }

  // ───────────────────────── état réseau ─────────────────────────
  function onMessage(m) { if (m && m.t === 'welcome') mySeat = m.seat; }
  function onLb(d) { board = (d && d.board) || []; renderLB(); }
  function onState(m) {
    if (m.gw && m.gw !== GW) { GW = m.gw; GH = m.gh || m.gw; CELL = ARENA / GW; occ = null; }   // grille redimensionnée
    prevSnap = snap; snap = m; teamMode = !!(m.mode && m.mode !== 'ffa');
    const inGame = m.gs === 'play' || m.gs === 'countdown' || m.gs === 'paused';
    if (inGame !== inGamePrev) { inGamePrev = inGame; document.body.classList.toggle('playing', inGame); resizeCanvas(); }
    document.body.classList.toggle('paused', m.gs === 'paused');
    if (m.gs === 'play' || m.gs === 'countdown') closePanels();
    const tNow = performance.now();
    if (m.round !== prevRound) {
      J.fin(); LUM.vider(); duskT = 0; jLast = 0;
      for (const k in dist) delete dist[k]; for (const k in lastHead) delete lastHead[k]; for (const k in lastKill) delete lastKill[k];
      prevRound = m.round; buf = []; killcam = null; prevShrink = 0;
      voxels.length = 0; sparks.length = 0; rings.length = 0; flashes.length = 0; labels.length = 0; cutGhosts.length = 0; derez.length = 0; embers.length = 0;
      for (const k in deadAt) delete deadAt[k]; for (const k in angView) delete angView[k]; for (const k in headPos) delete headPos[k];
    }
    buf.push({ t: performance.now(), s: m }); if (buf.length > 10) buf.shift();
    if (m.gs === 'play') {                               // horloge de jeu du journal (arrivée en cours de manche : courbe partielle)
      if (!J.actif()) { J.debut(0); jClock = 0; for (const k in dist) delete dist[k]; for (const k in lastHead) delete lastHead[k]; for (const k in lastKill) delete lastKill[k]; }
      else if (jLast) jClock += Math.min(500, tNow - jLast);
      jLast = tNow;
    } else jLast = 0;
    (m.fx || []).forEach(playFx);
    journal(m);
    if (prevGs !== 'over' && m.gs === 'over') { sound('win'); music.sting('win'); }
    if (m.gs === 'countdown' && m.count > 0 && m.count !== lastCount) { music.sting('count'); sound('count'); }   // décompte 3·2·1 (bip même sans musique)
    if (prevGs === 'countdown' && m.gs === 'play') { music.sting('go'); sound('go'); }
    lastCount = m.count;
    const shr = (m.shrink | 0) > 0; if (shr && !prevSd) { music.sting('alert'); msgGlobal(SHRINK_MSG.i, SHRINK_MSG.t, { bad: true }); } prevSd = shr;    // riser : l'arène se referme
    if ((m.shrink | 0) > prevShrink && m.gs === 'play') wallAdvance();   // chaque avancée du mur : éclair + étincelles + bourdon laser
    prevShrink = m.shrink | 0;
    const me = mySeat >= 0 ? m.players[mySeat] : null, bst = !!(me && me.playing && me.alive && me.boosting && m.gs === 'play');
    if (bst && !prevBoost) sound('boost'); prevBoost = bst;
    prevGs = m.gs;
    { let inten = 0;                                  // musique : 1 en jeu, 2 quand il ne reste qu'un duel (parmi 3+)
      if (m.gs === 'play' || m.gs === 'countdown') { inten = 1; const tot = m.players.filter(p => p.playing).length, alive = m.players.filter(p => p.playing && p.alive).length; if (tot >= 3 && alive <= 2) inten = 2; }
      music.setIntensity(inten); }
    if (me && me.playing && me.alive && m.gs === 'play') buildOcc(); else occ = null;
    refreshHUD();
    if (m.gs === 'over') { if (!endShown) { showEndscreen(m); endShown = true; } }
    else { endShown = false; endEl.classList.add('hidden'); }
    const idle = m.gs === 'lobby' || m.gs === 'over';
    const total = (m.connected || 0) + (m.botCount || 0);
    startBtn.disabled = !(mySeat >= 0 && idle && m.connected >= 1 && total >= 2);
    startBtn.textContent = m.gs === 'over' ? '↻ Rejouer' : '▶ Démarrer';
    pauseBtn.disabled = !(m.gs === 'play' || m.gs === 'paused');
    pauseBtn.textContent = m.gs === 'paused' ? '▶ Reprendre' : '⏸ Pause';
    pauseFloat.textContent = m.gs === 'paused' ? '▶' : '⏸';
    if (botsBtn) { botsBtn.disabled = !idle; botsBtn.textContent = '🤖 Bots : ' + (m.botCount || 0); botsBtn.classList.toggle('on', (m.botCount || 0) > 0); }
    if (diffBtn) { diffBtn.disabled = !idle; diffBtn.textContent = '🎯 IA : ' + (DIFF_NAMES[m.botDiff] || 'Normale'); }
    modeBtn.disabled = !(idle && TEAM_TOTALS.indexOf(total) >= 0);
    modeBtn.textContent = '⚔ ' + (MODE_NAME[m.mode] || m.mode); modeBtn.classList.toggle('on', teamMode);
    fadeBtn.disabled = !idle; fadeBtn.textContent = m.fade ? '〰 Traînée courte' : '➖ Traînée ∞'; fadeBtn.classList.toggle('on', !!m.fade);
  }
  // Journal de manche : distance parcourue par pilote (cases, prise sur la tête — vaut aussi en « traînée courte »)
  function journal(m) {
    if (!J.actif() || (m.gs !== 'play' && m.gs !== 'over')) return;
    const vals = {};
    m.players.forEach(p => {
      if (!p.playing || !p.head) return;
      const h = p.head, lh = lastHead[p.seat];
      if (lh) { const d = Math.abs(h.x - lh.x) + Math.abs(h.y - lh.y); if (p.alive && d > 0 && d <= 12) dist[p.seat] = (dist[p.seat] || 0) + d; lh.x = h.x; lh.y = h.y; }
      else lastHead[p.seat] = { x: h.x, y: h.y };
      vals[p.seat] = dist[p.seat] || 0;
    });
    if (m.gs === 'over') {                               // dernier survivant : le moment qui clôt la manche
      const surv = m.winner >= 0 ? m.players.filter(p => p.playing && p.alive && p.team === m.winner) : [];
      const best = surv.slice().sort((a, b) => (dist[b.seat] || 0) - (dist[a.seat] || 0))[0];
      if (best) J.moment(jClock, best.seat, (teamMode ? 'a tenu la grille pour son équipe' : 'dernier·e en ligne') + ((m.shrink | 0) > 0 ? ' dans l’arène refermée' : ''), m.players.filter(p => p.playing).length >= 4 ? 6 : 5);
      J.echantillon(jClock, vals, true); J.fin();
    } else J.echantillon(jClock, vals);
  }
  function journalCrash(f) {                            // élimination créditée : coupure (décisive, double…)
    if (!J.actif() || !snap || !(f.by >= 0) || f.by === f.seat) return;
    const k = snap.players[f.by], v = snap.players[f.seat]; if (!k || !v) return;
    if (teamMode && k.team === v.team) return;           // tir ami : pas un exploit
    const alive = snap.players.filter(p => p.playing && p.alive), teams = {};
    alive.forEach(p => { teams[p.team] = 1; });
    const units = teamMode ? Object.keys(teams).length : alive.length, vn = pname(f.seat);
    const k0 = lastKill[f.by], dbl = !!(k0 && jClock - k0.t < 2500);
    let txt = 'a coupé la route de ' + vn, w = 4;
    if (dbl) { txt = 'double coupure : ' + k0.n + ' puis ' + vn; w = 8; }
    if (units <= 1) { txt = 'coupure décisive : a sorti ' + vn + (dbl ? ' (doublé)' : ''); w = dbl ? 10 : 9; }
    J.moment(jClock, f.by, txt, w);
    lastKill[f.by] = { t: jClock, n: vn };
  }

  // Grille d'occupation reconstruite à chaque instantané (15 Hz, pas à chaque image) : -1 = mur, s+1 = traînée du siège s
  function buildOcc() {
    const n = GW * GH; if (!occ || occ.length !== n) occ = new Int16Array(n); else occ.fill(0);
    const L = snap.shrink | 0;
    if (L > 0) for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) if (x < L || y < L || x >= GW - L || y >= GH - L) occ[y * GW + x] = -1;
    const mark = (x, y, v) => { if (x >= 0 && y >= 0 && x < GW && y < GH && !occ[y * GW + x]) occ[y * GW + x] = v; };
    snap.players.forEach(p => {
      if (!p.playing) return; const pts = p.path || [], v = p.seat + 1;
      for (let i = 0; i < pts.length; i++) {
        let x = pts[i][0], y = pts[i][1];
        if (i === 0) { mark(x, y, v); continue; }
        x = pts[i - 1][0]; y = pts[i - 1][1];
        const x1 = pts[i][0], y1 = pts[i][1], dx = Math.sign(x1 - x), dy = Math.sign(y1 - y);
        while (x !== x1) { x += dx; mark(x, y, v); }   // pas séparés : se termine toujours, même sur un segment inattendu
        while (y !== y1) { y += dy; mark(x, y, v); }
      }
    });
  }
  // Direction de départ : même formule que spawnPlayers() du serveur (pendant le compte à rebours, le chemin n'a qu'une case)
  function spawnDir(p) {
    const parts = snap.players.filter(q => q.playing), N = parts.length; if (!N) return null;
    const cx = GW / 2, cy = GH / 2, R = Math.min(GW, GH) * 0.3;
    for (let i = 0; i < N; i++) {
      const ang = i * 2 * Math.PI / N;
      const x = Math.max(1, Math.min(GW - 2, Math.round(cx + R * Math.cos(ang)))), y = Math.max(1, Math.min(GH - 2, Math.round(cy + R * Math.sin(ang))));
      if (x !== p.head.x || y !== p.head.y) continue;
      const tx = -Math.sin(ang), ty = Math.cos(ang);
      return Math.abs(tx) >= Math.abs(ty) ? { x: Math.sign(tx) || 1, y: 0 } : { x: 0, y: Math.sign(ty) || 1 };
    }
    return null;
  }

  // ───────────────────────── sons (WebAudio, zéro fichier) ─────────────────────────
  function unlockAudio() { if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch {} } if (actx && actx.state === 'suspended') actx.resume(); }
  let sndPan = 0;                                   // pan stéréo du prochain son (posé par psound)
  const vol = () => (A && typeof A.sfx === 'number') ? A.sfx : 1;
  function out(node) { if (sndPan && actx.createStereoPanner) { const pn = actx.createStereoPanner(); pn.pan.value = Math.max(-1, Math.min(1, sndPan)); pn.connect(actx.destination); node.connect(pn); } else node.connect(actx.destination); }
  function tone(f, d, ty = 'square', g = 0.05, dl = 0) { const v = vol(); if (!actx || v <= 0) return; const t0 = actx.currentTime + dl, o = actx.createOscillator(), gg = actx.createGain(); o.type = ty; o.frequency.setValueAtTime(f, t0); gg.gain.setValueAtTime(g * v, t0); gg.gain.exponentialRampToValueAtTime(0.0001, t0 + d); o.connect(gg); out(gg); o.start(t0); o.stop(t0 + d + 0.02); }
  function sweep(f0, f1, d, ty = 'sawtooth', g = 0.04, dl = 0) { const v = vol(); if (!actx || v <= 0) return; const t0 = actx.currentTime + dl, o = actx.createOscillator(), gg = actx.createGain(); o.type = ty; o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(f1, t0 + d); gg.gain.setValueAtTime(g * v, t0); gg.gain.exponentialRampToValueAtTime(0.0001, t0 + d); o.connect(gg); out(gg); o.start(t0); o.stop(t0 + d + 0.02); }
  function noise(d, type, freq, g, dl = 0, q) {
    const v = vol(); if (!actx || v <= 0) return;
    if (!noiseBuf || noiseBuf.sampleRate !== actx.sampleRate) { const sr = actx.sampleRate, b = actx.createBuffer(1, Math.floor(sr * 1.2), sr), dd = b.getChannelData(0); for (let i = 0; i < dd.length; i++) dd[i] = Math.random() * 2 - 1; noiseBuf = b; }
    const t0 = actx.currentTime + dl, s = actx.createBufferSource(), f = actx.createBiquadFilter(), gg = actx.createGain();
    s.buffer = noiseBuf; f.type = type; f.frequency.value = freq; if (q) f.Q.value = q;
    gg.gain.setValueAtTime(0.0001, t0); gg.gain.exponentialRampToValueAtTime(g * v, t0 + Math.min(0.012, d * 0.2)); gg.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
    s.connect(f); f.connect(gg); out(gg); s.start(t0); s.stop(t0 + d + 0.02);
  }
  function psound(k, gx, arg) { sndPan = Math.max(-1, Math.min(1, (px(gx) / ARENA - 0.5) * 1.7)); sound(k, arg); sndPan = 0; }   // son positionné gauche/droite
  function sound(k, arg) {
    if (!actx) return;
    if (k === 'derez') {                              // dérésolution : grésillement numérique qui s'effondre + choc sourd
      sweep(1100, 70, 0.42, 'square', 0.028); noise(0.45, 'bandpass', 1800, 0.07, 0, 1.4); tone(92, 0.32, 'sawtooth', 0.045, 0.02);
      for (let i = 0; i < 4; i++) tone(1320 / (i + 1), 0.05, 'square', 0.02, 0.04 + i * 0.05);
    } else if (k === 'pickup') {                      // un timbre par bonus
      if (arg === 'speed') { sweep(400, 1600, 0.18, 'square', 0.028); tone(1320, 0.09, 'triangle', 0.03, 0.12); }
      else if (arg === 'ghost') { tone(520, 0.4, 'sine', 0.045); tone(527, 0.4, 'sine', 0.045); sweep(900, 420, 0.32, 'triangle', 0.02); }
      else if (arg === 'cut') { noise(0.04, 'highpass', 4000, 0.14); noise(0.04, 'highpass', 4600, 0.11, 0.07); tone(1800, 0.03, 'square', 0.02, 0.07); }
      else if (arg === 'blink') { sweep(300, 2400, 0.12, 'sine', 0.05); sweep(2400, 600, 0.14, 'sine', 0.03, 0.12); }
      else if (arg === 'breaker') { tone(220, 0.25, 'square', 0.028); tone(330, 0.25, 'square', 0.024, 0.03); noise(0.15, 'bandpass', 2500, 0.05); }
      else if (arg === 'invert') { sweep(900, 300, 0.2, 'sawtooth', 0.028); sweep(300, 900, 0.2, 'sawtooth', 0.028, 0.18); }
      else { tone(660, 0.07, 'square', 0.05); tone(990, 0.08, 'square', 0.05, 0.06); }
    } else if (k === 'break') { noise(0.2, 'highpass', 3000, 0.12); noise(0.3, 'bandpass', 5200, 0.06, 0.03, 3); tone(1400, 0.05, 'square', 0.03); tone(700, 0.08, 'square', 0.03, 0.04); }   // verre qui éclate
    else if (k === 'laser') { sweep(240, 70, 0.55, 'sawtooth', 0.03); noise(0.4, 'bandpass', 320, 0.05, 0, 2); }   // bourdon de la barrière qui avance
    else if (k === 'boost') { sweep(180, 900, 0.26, 'sawtooth', 0.022); noise(0.3, 'highpass', 2600, 0.035); }
    else if (k === 'count') { tone(880, 0.08, 'square', 0.035); tone(440, 0.12, 'triangle', 0.03); }
    else if (k === 'go') { sweep(300, 1200, 0.35, 'sawtooth', 0.026); tone(659.25, 0.3, 'square', 0.022, 0.05); tone(987.77, 0.36, 'triangle', 0.03, 0.1); }
    else if (k === 'win') { tone(329.63, 0.18, 'triangle', 0.06); tone(493.88, 0.18, 'triangle', 0.06, 0.12); tone(659.25, 0.18, 'triangle', 0.06, 0.24); tone(987.77, 0.45, 'triangle', 0.05, 0.36); }
  }

  // ───────────────────────── effets ponctuels ─────────────────────────
  const capPush = (arr, o, max) => { arr.push(o); if (arr.length > max) arr.splice(0, arr.length - max); };
  function spawnVoxels(x, y, ang, col, n, spread) {       // éclats voxel : petits cubes (face haute claire, face avant sombre)
    if (A.reduceFx) return; const now = performance.now(), base = hexRgb(col), top = rgbStr(mix(base, [255, 255, 255], 0.35)), side = rgbStr(mix(base, [0, 0, 0], 0.45));
    for (let k = 0; k < n; k++) {
      const along = -Math.random() * 2 * CELL, a = Math.random() * Math.PI * 2, sp = 0.5 + Math.random() * 2.2 * spread;
      voxels.push({ x: x + Math.cos(ang) * along, y: y + Math.sin(ang) * along, z: 1 + Math.random() * 3, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: 1 + Math.random() * 2.4, s: Math.max(1.6, CELL * (0.26 + Math.random() * 0.3)), top, side, born: now, life: 800 + Math.random() * 700 });
    }
    if (voxels.length > 360) voxels.splice(0, voxels.length - 360);
  }
  function spawnSparks(x, y, n, col, spd, dirA, cone) {
    if (A.reduceFx) return; const now = performance.now();
    for (let k = 0; k < n; k++) { const a = dirA == null ? Math.random() * Math.PI * 2 : dirA + (Math.random() - 0.5) * (cone || 1), sp = (0.4 + Math.random()) * spd; sparks.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, col, born: now, life: 220 + Math.random() * 260 }); }
    if (sparks.length > 300) sparks.splice(0, sparks.length - 300);
  }
  const ring = (x, y, r0, r1, col, lw, life, shape, delay) => { if (!A.reduceFx) capPush(rings, { x, y, r0, r1, col, lw, life, shape: shape || 'c', born: performance.now() + (delay || 0) }, 40); };
  function wallAdvance() {
    wallFlash = performance.now(); sound('laser');
    if (A.reduceFx) return;
    const w = (snap.shrink | 0) * CELL, E = ARENA - w, n = 34;
    for (let k = 0; k < n; k++) {                         // étincelles réparties sur les 4 faces de la barrière, projetées vers l'intérieur
      const side = k % 4, u = w + Math.random() * (E - w), x = side === 0 ? u : side === 1 ? E : side === 2 ? u : w, y = side === 0 ? w : side === 1 ? u : side === 2 ? E : u;
      spawnSparks(x, y, 1, TH.laser, 2.2, [Math.PI / 2, Math.PI, -Math.PI / 2, 0][side], 1.4);
    }
    const lr = Math.max(CELL * 6, (E - w) * 0.22), m0 = (w + E) / 2;   // la barrière qui avance illumine ses 4 faces
    [[m0, w], [E, m0], [m0, E], [w, m0]].forEach(q => LUM.ajouter(q[0], q[1], lr, TH.laser, 520, 0.5 * lk()));
    shakeMag = Math.max(shakeMag, 2.5);
  }
  function playFx(f) {
    if (!f) return;
    const now = performance.now();
    if (f.type === 'pickup') {
      psound('pickup', f.x, f.kind);
      if (f.kind === 'invert') {                       // touche tous les adversaires du ramasseur => global, pour tous
        const meP = (snap && mySeat >= 0 && snap.players) ? snap.players[mySeat] : null;
        const touche = !!(meP && meP.inv);             // le serveur vient de me poser l'inversion : je suis une victime
        msgGlobal(INVERT_MSG.i, touche ? INVERT_MSG.moi : INVERT_MSG.autres, { bad: touche });
        if (touche) invFlash = now;
      } else if (f.seat === mySeat) {                  // bonus personnel : rien à afficher chez les autres, ce serait du bruit
        const d = PU_MSG[f.kind];
        if (d && d.t) msgPerso(d.i, d.t);              // `d.t` : garde-fou si `kind` tombe sur une clé du prototype
      }
      const d = puDef(f.kind), x = px(f.x), y = px(f.y), st = angView[f.seat], a = st ? st.t : 0;
      if (!A.reduceFx) LUM.ajouter(x, y, CELL * 4.2, d.c, 420, 0.7 * lk());
      if (f.kind === 'invert') J.moment(jClock, f.seat, 'a inversé les contrôles adverses', 2);
      ring(x, y, CELL * 0.6, CELL * 3.6, d.c, 2.2, 460, 'hex');
      spawnSparks(x, y, 10, d.c, 1.8);
      if (f.kind === 'invert') ring(x, y, CELL, CELL * 14, d.c, 3, 700, 'c');
      else if (f.kind === 'breaker') ring(x, y, CELL * 0.5, CELL * 2, d.c, 3, 380, 'c', 90);
      else if (f.kind === 'speed') spawnSparks(x, y, 8, '#ffffff', 3, a, 0.6);
      else if (f.kind === 'blink' && !A.reduceFx) {    // téléport : faisceau de cases + onde à l'arrivée
        const dx = Math.round(Math.cos(a)), dy = Math.round(Math.sin(a));
        for (let k = 1; k <= 4; k++) ring(x + dx * CELL * k, y + dy * CELL * k, CELL * 0.3, CELL * 0.9, d.c, 1.6, 360, 'sq', k * 45);
        ring(x + dx * CELL * 4, y + dy * CELL * 4, CELL * 0.4, CELL * 2.6, '#ffffff', 2, 420, 'hex', 200);
      } else if (f.kind === 'cut' && !A.reduceFx && prevSnap) {   // coupe : l'ancienne traînée se dissout en pointillés
        const op = prevSnap.players[f.seat];
        if (op && op.path && op.path.length > 1) capPush(cutGhosts, { pts: op.path.slice(), col: colSeat(f.seat), born: now }, 6);
      }
      return;
    }
    if (f.type === 'break') {                          // casse-mur dépensé : le joueur doit savoir qu'il n'en a plus
      psound('break', f.x);
      if (f.seat === mySeat) msgPerso(BREAK_MSG.i, BREAK_MSG.t);
      const x = px(f.x), y = px(f.y);
      spawnVoxels(x, y, 0, PU.breaker.c, 9, 1.4); spawnSparks(x, y, 14, '#ffffff', 2.6);
      if (!A.reduceFx) LUM.ajouter(x, y, CELL * 4.8, PU.breaker.c, 460, 0.85 * lk());
      J.moment(jClock, f.seat, 'a percé une traînée au casse-mur', 3.5);
      ring(x, y, CELL * 0.5, CELL * 2.8, PU.breaker.c, 2.4, 380, 'sq');
      return;
    }
    if (f.type === 'crash') {
      psound('derez', f.x); music.sting('kill');
      deadAt[f.seat] = now;
      if (f.seat === mySeat && !A.reduceFx) killcam = { x: f.x, y: f.y, born: now };   // killcam sur ta propre collision
      if (f.seat === mySeat) msgPerso('✖', f.by >= 0 && f.by !== f.seat ? 'Dérésolu : traînée adverse' : 'Dérésolution !', { bad: true });
      const col = colSeat(f.seat), hp = headPos[f.seat], cx = clampG(f.x, GW), cy = clampG(f.y, GH);
      const x = hp ? hp.x : px(cx), y = hp ? hp.y : px(cy), a = hp ? hp.a : 0;
      capPush(derez, { seat: f.seat, col, x, y, a, born: now }, 10);
      capPush(labels, { x, y, txt: 'DÉRÉSOLU', sub: f.by >= 0 && f.by !== f.seat ? 'par ' + canvasName(f.by) : '', col, born: now }, 5);
      journalCrash(f);
      if (A.reduceFx) return;
      LUM.ajouter(x, y, CELL * 7.5, col, 760, 0.95 * lk());       // la dérésolution éclaire la grille alentour
      LUM.ajouter(x, y, CELL * 3.6, '#ffffff', 300, 0.7 * lk());
      shakeMag = Math.max(shakeMag, f.seat === mySeat ? 9 : 3.5);
      spawnVoxels(x, y, a, col, 24, 1);
      spawnSparks(px(cx), px(cy), 12, col, 3);
      ring(x, y, CELL * 0.6, CELL * 5, col, 2.6, 520, 'sq');
      ring(x, y, CELL * 0.4, CELL * 3, '#ffffff', 1.6, 360, 'sq', 60);
      capPush(flashes, { x, y, r: CELL * 4, col, born: now, life: 260 }, 8);
    }
  }

  // ───────────────────────── interpolation ─────────────────────────
  // Renvoie par siège la tête interpolée, sa direction ET le chemin à tracer : on prend le chemin de l'instantané
  // le plus ANCIEN (a), prolongé jusqu'à la tête interpolée — la traînée s'arrête pile sous la moto.
  function viewState(now) {
    if (buf.length === 0) return null;
    const target = now - INTERP_MS;
    let a = buf[0], b = buf[buf.length - 1];
    for (let i = 0; i < buf.length; i++) if (buf[i].t <= target) a = buf[i];
    for (let i = buf.length - 1; i >= 0; i--) if (buf[i].t >= target) b = buf[i];
    const span = b.t - a.t; let al = span > 0 ? (target - a.t) / span : 0; al = al < 0 ? 0 : al > 1 ? 1 : al;
    const outp = {};
    b.s.players.forEach(pb => {
      if (!pb.playing) return;
      const pa = a.s.players[pb.seat]; let hx = pb.head.x, hy = pb.head.y, path = pb.path || [], dx = 0, dy = 0;
      if (pa && pa.playing && pb.alive && pa.alive && Math.abs(pb.head.x - pa.head.x) <= 2 && Math.abs(pb.head.y - pa.head.y) <= 2) {
        hx = pa.head.x + (pb.head.x - pa.head.x) * al; hy = pa.head.y + (pb.head.y - pa.head.y) * al;
        const mx = pb.head.x - pa.head.x, my = pb.head.y - pa.head.y;
        if ((mx === 0) !== (my === 0)) { dx = Math.sign(mx); dy = Math.sign(my); }
        if (pa.path && pa.path.length) path = pa.path;
      }
      if (!dx && !dy) { const q = pb.path || []; if (q.length >= 2) { const u = q[q.length - 2], v = q[q.length - 1]; dx = Math.sign(v[0] - u[0]); dy = dx ? 0 : Math.sign(v[1] - u[1]); } }
      outp[pb.seat] = { x: hx, y: hy, dx, dy, path };
    });
    return outp;
  }
  function viewAngle(seat, dx, dy, dt) {                   // virage adouci (~50 ms), instantané en « réduire les effets »
    let st = angView[seat]; const has = !!(dx || dy), tgt = has ? Math.atan2(dy, dx) : (st ? st.t : 0);
    if (!st) { st = angView[seat] = { a: tgt, t: tgt }; return tgt; }
    st.t = tgt; const d = Math.atan2(Math.sin(tgt - st.a), Math.cos(tgt - st.a));
    if (A.reduceFx || Math.abs(d) > 2.5) st.a = tgt; else st.a += d * Math.min(1, dt / 50);
    return st.a;
  }

  // ───────────────────────── décor statique pré-rendu ─────────────────────────
  // Sol en dalles, grain, grille fine + grille majeure lumineuse avec nœuds, reflet, règle graduée, cadre
  // biseauté éclairé du haut-gauche, tube néon, équerres d'angle, vignette (+ lignes CRT) : quelques milliers
  // de tracés cuits UNE fois — redessiné seulement si la taille, la grille, le thème ou le contraste change.
  let decorCv = null, decorKey = '', sweepCv = null, streakCv = null, hazPat = null;
  function ensureDecor() {
    const key = cv.width + '|' + GW + '|' + TH.id + '|' + (A.contrast ? 1 : 0);
    if (decorCv && key === decorKey) return;
    decorKey = key;
    if (!decorCv) decorCv = document.createElement('canvas');
    decorCv.width = cv.width; decorCv.height = cv.height;
    const g = decorCv.getContext('2d'), W = ARENA, ps = cv.width / W, C = CELL, rnd = rng(0x7e0 + GW * 31 + TH.id.length);
    const ac = hexRgb(TH.accent), dark = TH.glow, hc = !!A.contrast;
    g.setTransform(ps, 0, 0, ps, 0, 0);
    // 1) sol : dégradé (plus clair vers le haut-gauche, d'où vient la lumière)
    g.fillStyle = TH.bg; g.fillRect(0, 0, W, W);
    const fg = g.createRadialGradient(W * 0.4, W * 0.36, W * 0.04, W / 2, W / 2, W * 0.78);
    fg.addColorStop(0, TH.field2); fg.addColorStop(1, TH.field); g.fillStyle = fg; g.fillRect(0, 0, W, W);
    // 2) dalles de 5×5 cases : légères variations de teinte, liserés intérieurs, petits voyants
    const P = C * 5;
    for (let y = 0; y < W; y += P) for (let x = 0; x < W; x += P) {
      const t = rnd();
      g.fillStyle = t < 0.5 ? `rgba(255,255,255,${(dark ? 0.018 : 0.14) * rnd()})` : `rgba(0,0,0,${(dark ? 0.1 : 0.035) * rnd()})`; g.fillRect(x + 0.4, y + 0.4, P - 0.8, P - 0.8);
      if (rnd() < 0.16) { g.strokeStyle = rgbStr(ac, dark ? 0.06 : 0.1); g.lineWidth = 0.6; g.strokeRect(x + P * 0.18, y + P * 0.18, P * 0.64, P * 0.64); }
      if (rnd() < 0.08) { g.fillStyle = rgbStr(ac, dark ? 0.4 : 0.35); g.fillRect(x + P - 3.2, y + 1.8, 1.4, 1.4); }
    }
    // 3) grain
    for (let k = 0; k < 2600; k++) { const s = 0.5 + rnd() * 0.8; g.fillStyle = rnd() < 0.5 ? `rgba(255,255,255,${dark ? 0.035 : 0.25})` : `rgba(0,0,0,${dark ? 0.12 : 0.04})`; g.fillRect(rnd() * W, rnd() * W, s, s); }
    // 4) grille fine (seulement si les cases font ≥ 5 px à l'écran : sinon moiré) puis grille majeure lumineuse
    const onePx = 1 / ps;
    if (C * ps >= 5 && !hc) {
      g.strokeStyle = rgbStr(ac, TH.gridA * 0.8); g.lineWidth = onePx; g.beginPath();
      for (let i = 1; i < GW; i++) { if (i % 5 === 0) continue; const v = i * C; g.moveTo(v, 0); g.lineTo(v, W); g.moveTo(0, v); g.lineTo(W, v); }
      g.stroke();
    }
    const majLines = () => { g.beginPath(); for (let i = 5; i < GW; i += 5) { const v = i * C; g.moveTo(v, 0); g.lineTo(v, W); g.moveTo(0, v); g.lineTo(W, v); } };
    if (dark) { majLines(); g.strokeStyle = rgbStr(ac, 0.05); g.lineWidth = Math.max(2.2, C * 0.35); g.stroke(); }
    majLines(); g.strokeStyle = rgbStr(ac, TH.majA * (hc ? 0.6 : 1)); g.lineWidth = Math.max(onePx, 0.7); g.stroke();
    g.fillStyle = rgbStr(ac, dark ? 0.45 : 0.5); g.beginPath();                                   // nœuds aux intersections
    for (let i = 5; i < GW; i += 5) for (let j = 5; j < GH; j += 5) { const x = i * C, y = j * C; g.rect(x - 1.6, y - 0.3, 3.2, 0.6); g.rect(x - 0.3, y - 1.6, 0.6, 3.2); }
    g.fill();
    // 5) reflet du sol (lumière rasante du haut-gauche)
    const sg = g.createLinearGradient(0, 0, W, W);
    sg.addColorStop(0, `rgba(255,255,255,${dark ? 0.05 : 0.4})`); sg.addColorStop(0.42, 'rgba(255,255,255,0)'); sg.addColorStop(0.62, `rgba(255,255,255,${dark ? 0.018 : 0.12})`); sg.addColorStop(0.74, 'rgba(255,255,255,0)');
    g.fillStyle = sg; g.fillRect(0, 0, W, W);
    // 6) lignes de balayage cathodique (thème CRT)
    if (TH.scan) { g.fillStyle = 'rgba(0,0,0,0.2)'; const st = 3 / ps; for (let y = 0; y < W; y += st) g.fillRect(0, y, W, onePx); }
    // 7) vignette
    const vg = g.createRadialGradient(W / 2, W / 2, W * 0.32, W / 2, W / 2, W * 0.74);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, dark ? (TH.scan ? 'rgba(0,0,0,0.62)' : 'rgba(0,0,0,0.5)') : 'rgba(40,52,90,0.16)');
    g.fillStyle = vg; g.fillRect(0, 0, W, W);
    // 8) règle graduée le long des bords (une graduation par case, une grande toutes les 5)
    g.fillStyle = rgbStr(ac, dark ? 0.35 : 0.45);
    for (let i = 1; i < GW; i++) { const v = i * C, l = i % 5 === 0 ? 3.4 : 1.6; g.fillRect(v - 0.3, 2.4, 0.6, l); g.fillRect(v - 0.3, W - 2.4 - l, 0.6, l); g.fillRect(2.4, v - 0.3, l, 0.6); g.fillRect(W - 2.4 - l, v - 0.3, l, 0.6); }
    // 9) cadre biseauté : haut/gauche éclairés, bas/droite dans l'ombre
    const b = 2.2;
    g.fillStyle = TH.rim; g.fillRect(0, 0, W, b); g.fillRect(0, W - b, W, b); g.fillRect(0, 0, b, W); g.fillRect(W - b, 0, b, W);
    const bev = (pts, col) => { g.beginPath(); g.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); g.closePath(); g.fillStyle = col; g.fill(); };
    bev([0, 0, W, 0, W - b, b, b, b], dark ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.8)');
    bev([0, 0, b, b, b, W - b, 0, W], dark ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.55)');
    bev([W, 0, W, W, W - b, W - b, W - b, b], 'rgba(0,0,0,0.4)');
    bev([0, W, W, W, W - b, W - b, b, W - b], 'rgba(0,0,0,0.5)');
    // 10) tube néon du bord (mur mortel) : lueur cuite ici, une seule fois
    g.save();
    if (dark) { g.shadowColor = TH.accent; g.shadowBlur = 9 * ps; }
    g.strokeStyle = hc ? '#ffffff' : TH.accent; g.lineWidth = hc ? 1.8 : 1.3; g.strokeRect(b + 0.6, b + 0.6, W - 2 * b - 1.2, W - 2 * b - 1.2);
    g.restore();
    if (dark && !hc) { g.strokeStyle = 'rgba(255,255,255,0.65)'; g.lineWidth = 0.45; g.strokeRect(b + 0.6, b + 0.6, W - 2 * b - 1.2, W - 2 * b - 1.2); }
    // 11) équerres d'angle (HUD)
    g.strokeStyle = hc ? '#ffffff' : rgbStr(ac, 0.85); g.lineWidth = 1.5; g.lineCap = 'square';
    const q = 6, L = 24; g.beginPath();
    g.moveTo(q, q + L); g.lineTo(q, q); g.lineTo(q + L, q); g.moveTo(W - q - L, q); g.lineTo(W - q, q); g.lineTo(W - q, q + L);
    g.moveTo(W - q, W - q - L); g.lineTo(W - q, W - q); g.lineTo(W - q - L, W - q); g.moveTo(q + L, W - q); g.lineTo(q, W - q); g.lineTo(q, W - q - L);
    g.stroke();
    // sprites d'ambiance (bande de balayage, filet de pluie) : quelques pixels, recréés avec le décor
    sweepCv = mkCanvas(4, 128); const sw = sweepCv.getContext('2d'), sgr = sw.createLinearGradient(0, 0, 0, 128);
    sgr.addColorStop(0, rgbStr(ac, 0)); sgr.addColorStop(0.5, dark ? rgbStr(ac, 0.09) : 'rgba(255,255,255,0.55)'); sgr.addColorStop(1, rgbStr(ac, 0));
    sw.fillStyle = sgr; sw.fillRect(0, 0, 4, 128);
    streakCv = mkCanvas(2, 48); const sk = streakCv.getContext('2d'), kgr = sk.createLinearGradient(0, 0, 0, 48);
    kgr.addColorStop(0, rgbStr(ac, 0)); kgr.addColorStop(0.85, rgbStr(ac, dark ? 0.7 : 0.45)); kgr.addColorStop(1, dark ? 'rgba(255,255,255,0.95)' : rgbStr(ac, 0.8));
    sk.fillStyle = kgr; sk.fillRect(0, 0, 2, 48);
  }
  function hazard() {                                      // hachures de danger des murs de rétrécissement (motif répétable, créé une fois)
    if (hazPat) return hazPat;
    const t = mkCanvas(12, 12), g = t.getContext('2d');
    g.strokeStyle = rgba(TH.laser, TH.glow ? 0.28 : 0.4); g.lineWidth = 3;
    g.beginPath(); g.moveTo(-3, 15); g.lineTo(15, -3); g.moveTo(-3, 3); g.lineTo(3, -3); g.moveTo(9, 15); g.lineTo(15, 9); g.stroke();
    try { hazPat = ctx.createPattern(t, 'repeat'); } catch (e) { hazPat = null; }
    return hazPat;
  }

  // ───────────────────────── sprites pré-rendus ─────────────────────────
  // Moto vue de dessus, orientée vers +x, origine = centre de la case de tête : pneus avant/arrière, carénage
  // à dégradé, motif du siège, liserés néon, arête, verrière, phare, feu arrière, contour (blanc en contraste).
  let motoCache = {}, motoN = 0;
  function motoSprite(seat, col, C) {
    const ps = cv.width / ARENA, key = seat + '|' + col + '|' + C.toFixed(2) + '|' + ps.toFixed(3);
    let s = motoCache[key]; if (s) return s;
    if (++motoN > 60) { motoCache = {}; motoN = 1; }
    const pad = C * 0.9, x0 = -2.25 * C - pad, x1 = 0.62 * C + pad, hw = 0.42 * C + pad, W = x1 - x0, H = hw * 2;
    const c = mkCanvas(W * ps, H * ps), g = c.getContext('2d'), u = C;
    g.setTransform(ps, 0, 0, ps, -x0 * ps, hw * ps);
    const base = hexRgb(col), dk = rgbStr(mix(base, [0, 0, 0], 0.55)), lt = rgbStr(mix(base, [255, 255, 255], 0.55));
    const body = () => { g.beginPath(); g.moveTo(0.42 * u, 0); g.bezierCurveTo(0.36 * u, -0.3 * u, 0.05 * u, -0.4 * u, -0.5 * u, -0.4 * u); g.lineTo(-1.5 * u, -0.38 * u); g.bezierCurveTo(-1.85 * u, -0.36 * u, -2.0 * u, -0.3 * u, -2.02 * u, -0.22 * u); g.lineTo(-2.02 * u, 0.22 * u); g.bezierCurveTo(-2.0 * u, 0.3 * u, -1.85 * u, 0.36 * u, -1.5 * u, 0.38 * u); g.lineTo(-0.5 * u, 0.4 * u); g.bezierCurveTo(0.05 * u, 0.4 * u, 0.36 * u, 0.3 * u, 0.42 * u, 0); g.closePath(); };
    if (TH.glow) { g.save(); g.shadowColor = col; g.shadowBlur = u * 1.1 * ps; g.fillStyle = col; g.globalAlpha = 0.85; body(); g.fill(); g.restore(); }   // lueur, cuite une fois
    g.fillStyle = '#05070d';                                                                        // pneus
    rrect(g, -2.2 * u, -0.34 * u, 0.82 * u, 0.68 * u, 0.3 * u); g.fill(); rrect(g, -0.28 * u, -0.3 * u, 0.86 * u, 0.6 * u, 0.28 * u); g.fill();
    g.strokeStyle = lt; g.lineWidth = 0.07 * u; rrect(g, -2.2 * u, -0.34 * u, 0.82 * u, 0.68 * u, 0.3 * u); g.stroke(); rrect(g, -0.28 * u, -0.3 * u, 0.86 * u, 0.6 * u, 0.28 * u); g.stroke();
    const bg = g.createLinearGradient(0, -0.4 * u, 0, 0.4 * u);                                     // carénage : bords sombres, arête claire
    bg.addColorStop(0, dk); bg.addColorStop(0.5, rgbStr(mix(base, [255, 255, 255], 0.18))); bg.addColorStop(1, dk);
    body(); g.fillStyle = bg; g.fill();
    const pat = seatPattern(g, seat, { size: Math.max(4, u * 1.3) }); if (pat) { g.fillStyle = pat; g.fill(); }
    g.strokeStyle = hexToLight(base); g.lineWidth = 0.07 * u; g.lineCap = 'round';                   // liserés néon latéraux
    g.beginPath(); g.moveTo(-1.8 * u, -0.29 * u); g.lineTo(0.05 * u, -0.31 * u); g.moveTo(-1.8 * u, 0.29 * u); g.lineTo(0.05 * u, 0.31 * u); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 0.1 * u; g.beginPath(); g.moveTo(-1.9 * u, 0); g.lineTo(-0.8 * u, 0); g.stroke();   // arête dorsale
    g.save(); g.translate(-0.3 * u, 0); g.scale(0.38 * u, 0.2 * u); g.beginPath(); g.arc(0, 0, 1, 0, Math.PI * 2); g.restore();   // verrière (ellipse maison)
    g.fillStyle = 'rgba(8,14,28,0.92)'; g.fill();
    g.save(); g.translate(-0.15 * u, -0.07 * u); g.scale(0.15 * u, 0.05 * u); g.beginPath(); g.arc(0, 0, 1, 0, Math.PI * 2); g.restore();
    g.fillStyle = 'rgba(255,255,255,0.6)'; g.fill();
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(0.42 * u, 0, 0.09 * u, 0, Math.PI * 2); g.fill();   // phare
    g.fillStyle = lt; g.fillRect(-2.06 * u, -0.16 * u, 0.08 * u, 0.32 * u);                          // feu arrière
    body(); g.strokeStyle = A.contrast ? '#ffffff' : 'rgba(0,0,0,0.55)'; g.lineWidth = (A.contrast ? 0.12 : 0.06) * u; g.stroke();
    s = { cv: c, x: x0, y: -hw, w: W, h: H };
    return (motoCache[key] = s);
  }
  function hexToLight(base) { return rgbStr(mix(base, [255, 255, 255], 0.7)); }
  // Bonus : hologramme hexagonal (plaque sombre, verre teinté, double liseré, pictogramme) — pré-rendu par type
  let puCache = {}, puN = 0;
  const puR = () => Math.max(4.6, CELL * 0.72);
  function puSprite(t, r) {
    const ps = cv.width / ARENA, key = t + '|' + r.toFixed(2) + '|' + ps.toFixed(3);
    if (puCache[key]) return puCache[key];
    if (++puN > 40) { puCache = {}; puN = 1; }
    const d = puDef(t), half = r * 1.45, S = half * 2, c = mkCanvas(S * ps, S * ps), g = c.getContext('2d');
    g.setTransform(ps, 0, 0, ps, half * ps, half * ps);
    if (TH.glow) { const gr = g.createRadialGradient(0, 0, r * 0.3, 0, 0, half); gr.addColorStop(0, rgba(d.c, 0.45)); gr.addColorStop(1, rgba(d.c, 0)); g.fillStyle = gr; g.fillRect(-half, -half, S, S); }
    else { g.fillStyle = 'rgba(15,25,50,0.2)'; g.save(); g.translate(0.8, 1.2); hexPath(g, r); g.fill(); g.restore(); }   // ombre portée (thème clair)
    hexPath(g, r); g.fillStyle = 'rgba(5,9,20,0.88)'; g.fill();
    hexPath(g, r * 0.8); g.fillStyle = rgba(d.c, 0.16); g.fill();
    hexPath(g, r); g.strokeStyle = d.c; g.lineWidth = r * (A.contrast ? 0.2 : 0.13); g.lineJoin = 'round'; g.stroke();
    if (A.contrast) { hexPath(g, r * 1.12); g.strokeStyle = '#ffffff'; g.lineWidth = r * 0.08; g.stroke(); }
    hexPath(g, r * 0.8); g.strokeStyle = rgba(d.c, 0.45); g.lineWidth = r * 0.05; g.stroke();
    picto(g, t, 0, 0, r * 0.6, d.c);
    return (puCache[key] = { cv: c, half, S });
  }
  // Traînées : teintes dérivées de la couleur du siège (bord sombre, cœur clair, version « dérésolue »)
  let tsCache = {};
  function tstyle(col) {
    let s = tsCache[col]; if (s) return s; const c = hexRgb(col), f = hexRgb(TH.field);
    s = { edge: rgbStr(mix(c, [0, 0, 0], TH.glow ? 0.5 : 0.58)), core: rgbStr(mix(c, [255, 255, 255], 0.72)), dead: rgbStr(mix(c, f, 0.55)), deadEdge: rgbStr(mix(mix(c, [0, 0, 0], 0.5), f, TH.glow ? 0.4 : 0.25)) };
    return (tsCache[col] = s);
  }
  let coneG = null, coneC = 0;
  function coneGrad(C) {                                   // faisceau du phare (dégradé en repère local, réutilisé par toutes les motos)
    if (coneG && coneC === C) return coneG;
    coneC = C; coneG = ctx.createLinearGradient(0.4 * C, 0, 3.6 * C, 0);
    coneG.addColorStop(0, 'rgba(255,255,255,0.2)'); coneG.addColorStop(1, 'rgba(255,255,255,0)');
    return coneG;
  }

  // ───────────────────────── traînées (rubans lumineux) ─────────────────────────
  function buildPath(pts, hx, hy) { ctx.beginPath(); ctx.moveTo(px(pts[0][0]), px(pts[0][1])); for (let i = 1; i < pts.length; i++) ctx.lineTo(px(pts[i][0]), px(pts[i][1])); if (hx != null) ctx.lineTo(hx, hy); }
  const HOT = [];
  function hotSeg(pts, hx, hy, len) {                      // les `len` dernières unités de traînée derrière la tête (réutilise HOT)
    HOT.length = 0; HOT.push(hx, hy); let rem = len, cx = hx, cy = hy;
    for (let i = pts.length - 1; i >= 0 && rem > 0; i--) {
      const x = px(pts[i][0]), y = px(pts[i][1]), d = Math.abs(x - cx) + Math.abs(y - cy);
      if (d <= 0.001) continue;
      if (d >= rem) { const t = rem / d; HOT.push(cx + (x - cx) * t, cy + (y - cy) * t); break; }
      HOT.push(x, y); rem -= d; cx = x; cy = y;
    }
    return HOT;
  }
  function drawTrail(p, v, now, dead) {
    const pts = (v && v.path && v.path.length) ? v.path : (p.path || []); if (!pts.length) return;
    const C = CELL, col = colSeat(p.seat), st = tstyle(col), hx = v && !dead ? px(v.x) : null, hy = v && !dead ? px(v.y) : null;
    ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    if (!TH.glow) { ctx.translate(0.9, 1.4); buildPath(pts, hx, hy); ctx.strokeStyle = 'rgba(20,30,60,0.2)'; ctx.lineWidth = C * 0.86; ctx.stroke(); ctx.translate(-0.9, -1.4); }   // ombre portée
    buildPath(pts, hx, hy);
    const pat = seatPattern(ctx, p.seat, { size: C * 1.6 });
    if (dead) {                                                 // traînée d'un pilote éliminé : reste un MUR, bien visible, mais éteinte
      if (A.contrast) { ctx.strokeStyle = TH.glow ? '#000000' : '#1a2238'; ctx.lineWidth = C * 0.98; ctx.stroke(); }
      ctx.strokeStyle = st.deadEdge; ctx.lineWidth = C * 0.84; ctx.stroke();
      ctx.strokeStyle = st.dead; ctx.lineWidth = C * 0.56; ctx.stroke();
      if (pat) { ctx.strokeStyle = pat; ctx.lineWidth = C * 0.84; ctx.stroke(); }
      ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = Math.max(0.6, C * 0.12); ctx.stroke();
      const t0 = deadAt[p.seat], age = t0 ? now - t0 : 1e9;
      if (age < 900 && FX) {                                    // onde de dérésolution : éclair blanc qui s'éteint
        ctx.globalAlpha = 1 - age / 900; if (TH.glow) ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = TH.glow ? col : '#ffffff'; ctx.lineWidth = C * 0.9; ctx.stroke(); ctx.globalCompositeOperation = 'source-over';
      }
      ctx.restore(); return;
    }
    if (TH.glow && FX) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = p.speed || p.boosting ? 0.24 : 0.16; ctx.strokeStyle = col; ctx.lineWidth = C * 1.9; ctx.stroke(); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; }   // halo (sans shadowBlur)
    if (A.contrast) { ctx.strokeStyle = TH.glow ? '#000000' : '#0b1830'; ctx.lineWidth = C * 0.98; ctx.stroke(); }
    ctx.strokeStyle = st.edge; ctx.lineWidth = C * 0.84; ctx.stroke();                                  // ruban : bords sombres
    ctx.strokeStyle = col; ctx.lineWidth = C * 0.6; ctx.stroke();                                       // corps à la couleur du siège
    if (pat) { ctx.strokeStyle = pat; ctx.lineWidth = C * 0.84; ctx.stroke(); }                         // motif du siège
    ctx.strokeStyle = st.core; ctx.lineWidth = Math.max(0.8, C * 0.18); ctx.stroke();                   // cœur lumineux
    if (FX) {                                                                                           // impulsions d'énergie qui filent vers la moto
      ctx.setLineDash([C * 1.4, C * 10]); ctx.lineDashOffset = -(now / 1000) * C * 14;
      if (TH.glow) ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.5; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = C * 0.32; ctx.stroke();
      ctx.setLineDash([]); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    }
    if (hx != null) {                                                                                   // section chaude juste derrière la moto
      const h = hotSeg(pts, hx, hy, C * 5);
      if (h.length >= 4) {
        ctx.beginPath(); ctx.moveTo(h[0], h[1]); for (let i = 2; i < h.length; i += 2) ctx.lineTo(h[i], h[i + 1]);
        if (TH.glow) ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = TH.glow ? 0.45 : 0.6; ctx.strokeStyle = TH.glow ? '#ffffff' : st.core; ctx.lineWidth = C * 0.34; ctx.stroke();
        ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
      }
    }
    ctx.restore();
  }

  // ───────────────────────── motos ─────────────────────────
  function drawMoto(p, x, y, ang, now) {
    const C = CELL, col = colSeat(p.seat), spr = motoSprite(p.seat, col, C);
    if (!TH.glow) { ctx.save(); ctx.translate(x + 1.1, y + 1.7); ctx.rotate(ang); ctx.fillStyle = 'rgba(15,25,50,0.24)'; rrect(ctx, -2.2 * C, -0.36 * C, 2.8 * C, 0.72 * C, 0.3 * C); ctx.fill(); ctx.restore(); }   // ombre portée (thème clair)
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
    if (TH.glow && FX) {                                   // faisceau du phare sur le sol
      ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = coneGrad(C);
      ctx.beginPath(); ctx.moveTo(0.45 * C, -0.18 * C); ctx.lineTo(3.6 * C, -1.15 * C); ctx.lineTo(3.6 * C, 1.15 * C); ctx.lineTo(0.45 * C, 0.18 * C); ctx.closePath(); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }
    if (p.speed) {                                         // bonus vitesse : images rémanentes derrière la moto
      ctx.globalAlpha = 0.28; ctx.drawImage(spr.cv, spr.x - C * 0.95, spr.y, spr.w, spr.h);
      ctx.globalAlpha = 0.13; ctx.drawImage(spr.cv, spr.x - C * 1.9, spr.y, spr.w, spr.h); ctx.globalAlpha = 1;
    }
    if (p.boosting) {                                      // boost : flamme de réacteur (reste visible, figée, en « réduire les effets »)
      const fl = FX ? 0.75 + 0.35 * Math.random() : 1, L = C * (1.1 + 0.6 * fl), rx = -2.15 * C;
      if (TH.glow) ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.6; ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(rx, -0.27 * C); ctx.lineTo(rx - L * 1.2, 0); ctx.lineTo(rx, 0.27 * C); ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 0.85; ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(rx, -0.13 * C); ctx.lineTo(rx - L * 0.7, 0); ctx.lineTo(rx, 0.13 * C); ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    }
    ctx.globalAlpha = p.ghost ? (FX ? 0.42 + 0.2 * Math.sin(now / 55) : 0.5) : 1;
    ctx.drawImage(spr.cv, spr.x, spr.y, spr.w, spr.h);
    ctx.globalAlpha = 1;
    if (p.ghost) {                                         // fantôme : coque holographique en pointillés
      ctx.strokeStyle = PU.ghost.c; ctx.lineWidth = Math.max(0.8, C * 0.12); ctx.setLineDash([C * 0.5, C * 0.35]); ctx.lineDashOffset = FX ? -now / 40 : 0;
      rrect(ctx, -2.4 * C, -0.64 * C, 3.2 * C, 1.28 * C, 0.55 * C); ctx.stroke(); ctx.setLineDash([]);
    }
    if (p.brk) {                                           // casse-mur prêt : bouclier doré à l'avant
      ctx.globalAlpha = FX ? 0.7 + 0.3 * Math.sin(now / 120) : 0.9; ctx.strokeStyle = PU.breaker.c; ctx.lineCap = 'round';
      ctx.lineWidth = Math.max(1, C * 0.2); ctx.beginPath(); ctx.arc(0.1 * C, 0, 0.8 * C, -1.05, 1.05); ctx.stroke();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = Math.max(0.5, C * 0.06); ctx.beginPath(); ctx.arc(0.1 * C, 0, 0.8 * C, -0.5, 0.2); ctx.stroke(); ctx.globalAlpha = 1;
    }
    if (p.inv) {                                           // contrôles inversés : deux flèches magenta qui tournent autour
      const t = FX ? now / 260 : 0, R = 1.45 * C, cx0 = -0.8 * C;
      ctx.strokeStyle = PU.invert.c; ctx.fillStyle = PU.invert.c; ctx.lineWidth = Math.max(0.8, C * 0.14); ctx.lineCap = 'round';
      for (let k = 0; k < 2; k++) {
        const a0 = t + k * Math.PI, a1 = a0 + 1.3; ctx.beginPath(); ctx.arc(cx0, 0, R, a0, a1); ctx.stroke();
        const ex = cx0 + Math.cos(a1) * R, ey = Math.sin(a1) * R, tx = -Math.sin(a1), ty = Math.cos(a1), hs = C * 0.34;
        ctx.beginPath(); ctx.moveTo(ex + tx * hs, ey + ty * hs); ctx.lineTo(ex - ty * hs * 0.7, ey + tx * hs * 0.7); ctx.lineTo(ex + ty * hs * 0.7, ey - tx * hs * 0.7); ctx.closePath(); ctx.fill();
      }
    }
    ctx.restore();
  }
  function drawMeMarker(x, y, now) {                        // repère « c'est moi » : équerres pulsées autour de la tête + pointe au-dessus
    const C = CELL, s = C * 0.9 + 2 + (FX ? Math.sin(now / 200) * 1.2 : 0), l = Math.max(2.5, C * 0.5);
    ctx.save(); ctx.strokeStyle = TH.glow ? '#ffffff' : TH.ink; ctx.lineWidth = 1.5; ctx.globalAlpha = FX ? 0.65 + 0.35 * Math.sin(now / 200) : 0.9; ctx.lineCap = 'square';
    ctx.beginPath();
    ctx.moveTo(x - s, y - s + l); ctx.lineTo(x - s, y - s); ctx.lineTo(x - s + l, y - s); ctx.moveTo(x + s - l, y - s); ctx.lineTo(x + s, y - s); ctx.lineTo(x + s, y - s + l);
    ctx.moveTo(x + s, y + s - l); ctx.lineTo(x + s, y + s); ctx.lineTo(x + s - l, y + s); ctx.moveTo(x - s + l, y + s); ctx.lineTo(x - s, y + s); ctx.lineTo(x - s, y + s - l);
    ctx.stroke(); ctx.globalAlpha = 1;
    const ty = y - s - 3; ctx.fillStyle = TH.accent; ctx.strokeStyle = TH.glow ? '#02060c' : '#ffffff'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(x - 5, ty - 7); ctx.lineTo(x + 5, ty - 7); ctx.lineTo(x, ty); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  // ───────────────────────── éclairage dynamique (sous les pièces) ─────────────────────────
  // Phare qui éclaire la grille devant chaque moto, halo de la traînée chaude derrière, réacteur en boost,
  // hologrammes des bonus ; flashs éphémères (dérésolution, casse-mur, bonus, barrière) via LUM.
  // Plus marqué quand la nuit tombe (crépuscule). Coupé en « réduire les effets ».
  function drawLights(now) {
    if (A.reduceFx) { LUM.vider(); return; }
    const k = lk() * (1 + 0.9 * duskT), C = CELL;
    if (snap && snap.gs !== 'lobby') {
      const pr = puR() * 2.6;
      (snap.pickups || []).forEach(pk => lumiere(ctx, px(pk.x), px(pk.y), pr, puDef(pk.t).c, 0.16 * k));
      for (const p of snap.players) {
        if (!p.playing || !p.alive) continue;
        const h = headPos[p.seat]; if (!h) continue;                    // position de l'image précédente : écart imperceptible
        const ca = Math.cos(h.a), sa = Math.sin(h.a), col = colSeat(p.seat), fast = p.boosting || p.speed;
        lumiere(ctx, h.x + ca * 2.5 * C, h.y + sa * 2.5 * C, C * (fast ? 3.3 : 2.7), phare(col), (fast ? 0.3 : 0.22) * k);
        lumiere(ctx, h.x - ca * 3 * C, h.y - sa * 3 * C, C * (fast ? 3.4 : 2.7), col, (p.boosting ? 0.36 : 0.22) * k * (p.ghost ? 0.5 : 1));
        if (p.boosting) lumiere(ctx, h.x - ca * 2.5 * C, h.y - sa * 2.5 * C, C * 2, '#ffffff', (0.16 + 0.12 * Math.random()) * k);
      }
    }
    LUM.dessiner(ctx, now);
  }
  // ───────────────────────── crépuscule : l'arène qui se referme fait tomber la nuit ─────────────────────────
  // t d'après snap.shrink : 0,25 au premier recul du mur, nuit (plafonnée par crepuscule.js) quand l'arène a perdu
  // ~la moitié de sa largeur. Lissé dans le temps ; conservé sur l'écran de fin, remis à zéro au lobby.
  function drawDusk(dtm) {
    const s = snap ? (snap.shrink | 0) : 0, gs = snap ? snap.gs : 'lobby';
    let tgt = 0;
    if (s > 0 && (gs === 'play' || gs === 'paused' || gs === 'over')) tgt = 0.25 + 0.75 * Math.min(1, (s - 1) / Math.max(4, GW * 0.25));
    tgt = Math.max(tgt, DUEL.t(snap, performance.now(), duelAnnonce));   // duel final : la nuit tombe
    duskT += (tgt - duskT) * (A.reduceFx ? 1 : Math.min(1, dtm / 700));
    if (duskT < 0.01 && !tgt) { duskT = 0; return; }
    const force = (TH.glow ? 0.92 : 0.5) * (A.contrast ? 0.7 : 1) * (A.reduceFx ? 0.6 : 1);
    // débord = celui du fond (-20) : le tremblement ne découvre pas de liseré « jour » au bord
    crepuscule(ctx, -20, -20, ARENA + 40, ARENA + 40, duskT, { soleil: A.reduceFx ? false : 'haut', force });
  }

  // ───────────────────────── murs de rétrécissement : barrières laser ─────────────────────────
  function drawWalls(now) {
    const L = snap ? (snap.shrink | 0) : 0; if (L <= 0) return;
    const w = L * CELL, W = ARENA, E = W - 2 * w;
    ctx.save();
    const zone = () => { ctx.fillRect(0, 0, W, w); ctx.fillRect(0, W - w, W, w); ctx.fillRect(0, w, w, E); ctx.fillRect(W - w, w, w, E); };
    ctx.fillStyle = TH.wall; zone();                                        // zone morte, opaque
    const hp = hazard(); if (hp) { ctx.fillStyle = hp; zone(); }            // hachures de danger
    const flash = Math.max(0, 1 - (now - wallFlash) / 450), fl = FX ? 0.8 + 0.2 * Math.sin(now / 37) * Math.sin(now / 91) : 1;
    if (TH.glow) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = Math.min(1, 0.22 * fl + 0.45 * flash); ctx.strokeStyle = TH.laser; ctx.lineWidth = 4 + 7 * flash; ctx.strokeRect(w, w, E, E); ctx.globalCompositeOperation = 'source-over'; }
    else if (flash > 0) { ctx.globalAlpha = 0.5 * flash; ctx.strokeStyle = TH.laser; ctx.lineWidth = 3 + 6 * flash; ctx.strokeRect(w, w, E, E); }
    ctx.globalAlpha = 1; ctx.strokeStyle = TH.laser; ctx.lineWidth = A.contrast ? 2.6 : 1.8; ctx.strokeRect(w, w, E, E);
    ctx.globalAlpha = 0.85 * fl; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 0.7; ctx.strokeRect(w, w, E, E);
    if (FX) { ctx.setLineDash([6, 18]); ctx.lineDashOffset = -now / 30; ctx.globalAlpha = 0.7; ctx.lineWidth = 1.2; ctx.strokeRect(w, w, E, E); ctx.setLineDash([]); }   // énergie qui court le long du laser
    ctx.globalAlpha = 1; ctx.fillStyle = TH.laser; ctx.beginPath();         // émetteurs, toutes les 5 cases
    const n = Math.max(1, Math.round(E / (CELL * 5)));
    for (let k = 0; k <= n; k++) { const u = w + E * k / n; ctx.rect(u - 1.4, w - 1.4, 2.8, 2.8); ctx.rect(u - 1.4, W - w - 1.4, 2.8, 2.8); if (k > 0 && k < n) { ctx.rect(w - 1.4, u - 1.4, 2.8, 2.8); ctx.rect(W - w - 1.4, u - 1.4, 2.8, 2.8); } }
    ctx.fill();
    ctx.restore();
  }

  // ───────────────────────── ambiance : balayage du sol, pluie de néon, scintillements ─────────────────────────
  function drawAmbient(now) {
    if (!FX) return;
    ctx.save();
    if (TH.glow) ctx.globalCompositeOperation = 'lighter';
    if (sweepCv) { const y = ((now / 6500) % 1) * (ARENA + 160) - 80; ctx.globalAlpha = 1; ctx.drawImage(sweepCv, 0, y, ARENA, 80); }   // balayage du sol réfléchissant (barre roulante en CRT)
    if (streakCv) for (const r of AMB_RAIN) { const y = (r.ph + now / 1000 * r.v) % (ARENA + r.l) - r.l; ctx.globalAlpha = 0.18 + 0.12 * Math.sin(now / 600 + r.ph); ctx.drawImage(streakCv, r.x * ARENA, y, 1.1, r.l); }
    // scintillements : quelques nœuds de la grille majeure s'allument brièvement
    while (twinkles.length < 5) twinkles.push({ i: 5 * (1 + Math.floor(Math.random() * Math.max(1, GW / 5 - 1))), j: 5 * (1 + Math.floor(Math.random() * Math.max(1, GH / 5 - 1))), born: now + Math.random() * 1800, life: 700 + Math.random() * 600 });
    ctx.strokeStyle = TH.glow ? '#ffffff' : TH.accent; ctx.lineWidth = 0.8;
    for (let i = twinkles.length - 1; i >= 0; i--) {
      const q = twinkles[i], t = (now - q.born) / q.life; if (t >= 1) { twinkles.splice(i, 1); continue; } if (t < 0) continue;
      const x = q.i * CELL, y = q.j * CELL, s = 2 + 3 * Math.sin(Math.PI * t);
      ctx.globalAlpha = 0.7 * Math.sin(Math.PI * t); ctx.beginPath(); ctx.moveTo(x - s, y); ctx.lineTo(x + s, y); ctx.moveTo(x, y - s); ctx.lineTo(x, y + s); ctx.stroke();
    }
    ctx.restore();
  }

  // ───────────────────────── particules et effets d'événements ─────────────────────────
  function drawFx(now, kdt) {
    if (A.reduceFx) { voxels.length = 0; sparks.length = 0; rings.length = 0; flashes.length = 0; embers.length = 0; cutGhosts.length = 0; }
    ctx.save();
    // traînées coupées qui se dissolvent en pointillés
    for (let i = cutGhosts.length - 1; i >= 0; i--) {
      const q = cutGhosts[i], t = (now - q.born) / 650; if (t >= 1) { cutGhosts.splice(i, 1); continue; }
      buildPath(q.pts, null, null); ctx.lineCap = 'butt'; ctx.lineJoin = 'round';
      ctx.setLineDash([CELL * (1 - t) * 1.6 + 0.2, CELL * t * 2.4 + 0.2]); ctx.globalAlpha = 0.8 * (1 - t); ctx.strokeStyle = q.col; ctx.lineWidth = CELL * 0.6; ctx.stroke();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = CELL * 0.2; ctx.stroke(); ctx.setLineDash([]);
    }
    ctx.globalAlpha = 1;
    // motos qui se dérésolvent : le sprite se découpe en tranches qui glissent (glitch) puis s'efface
    for (let i = derez.length - 1; i >= 0; i--) {
      const q = derez[i], D = FX ? 700 : 400, t = (now - q.born) / D; if (t >= 1) { derez.splice(i, 1); continue; }
      const spr = motoSprite(q.seat, q.col, CELL);
      ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.a); ctx.globalAlpha = 1 - t;
      if (!FX) ctx.drawImage(spr.cv, spr.x, spr.y, spr.w, spr.h);
      else for (let j = 0; j < 5; j++) {
        const sh = spr.cv.height / 5, off = (hash2(j, q.born % 997) - 0.5) * CELL * 3.2 * t;
        ctx.drawImage(spr.cv, 0, sh * j, spr.cv.width, sh, spr.x + off, spr.y + spr.h * j / 5, spr.w, spr.h / 5);
      }
      ctx.restore();
    }
    if (FX) {
      // éclairs (dégradé radial : quelques-uns à la fois seulement)
      if (TH.glow) ctx.globalCompositeOperation = 'lighter';
      for (let i = flashes.length - 1; i >= 0; i--) {
        const q = flashes[i], t = (now - q.born) / q.life; if (t >= 1) { flashes.splice(i, 1); continue; }
        const gr = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, q.r * (0.6 + 0.6 * t)); gr.addColorStop(0, 'rgba(255,255,255,' + (0.8 * (1 - t)) + ')'); gr.addColorStop(0.4, rgba(q.col, 0.5 * (1 - t))); gr.addColorStop(1, rgba(q.col, 0));
        ctx.globalAlpha = 1; ctx.fillStyle = gr; ctx.fillRect(q.x - q.r * 1.3, q.y - q.r * 1.3, q.r * 2.6, q.r * 2.6);
      }
      // braises du réacteur
      for (let i = embers.length - 1; i >= 0; i--) {
        const q = embers[i], t = (now - q.born) / q.life; if (t >= 1) { embers.splice(i, 1); continue; }
        q.x += q.vx * kdt; q.y += q.vy * kdt; q.vx *= 0.92; q.vy *= 0.92; ctx.globalAlpha = 0.8 * (1 - t); ctx.fillStyle = q.col; const s = 1.4 * (1 - t) + 0.4; ctx.fillRect(q.x - s / 2, q.y - s / 2, s, s);
      }
      // étincelles
      ctx.lineCap = 'round';
      for (let i = sparks.length - 1; i >= 0; i--) {
        const q = sparks[i], t = (now - q.born) / q.life; if (t >= 1) { sparks.splice(i, 1); continue; }
        q.x += q.vx * kdt; q.y += q.vy * kdt; q.vx *= 0.9; q.vy *= 0.9; ctx.globalAlpha = 1 - t; ctx.strokeStyle = q.col; ctx.lineWidth = 1.6 * (1 - t) + 0.4;
        ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(q.x - q.vx * 1.8, q.y - q.vy * 1.8); ctx.stroke();
      }
      // ondes (cercle, carré « pixel » ou hexagone)
      for (let i = rings.length - 1; i >= 0; i--) {
        const q = rings[i], t = (now - q.born) / q.life; if (t >= 1) { rings.splice(i, 1); continue; } if (t < 0) continue;
        const e = 1 - (1 - t) * (1 - t), r = q.r0 + (q.r1 - q.r0) * e; ctx.globalAlpha = 0.8 * (1 - t); ctx.strokeStyle = q.col; ctx.lineWidth = q.lw * (1 - t * 0.6);
        if (q.shape === 'sq') ctx.strokeRect(q.x - r, q.y - r, r * 2, r * 2);
        else if (q.shape === 'hex') { ctx.save(); ctx.translate(q.x, q.y); hexPath(ctx, r); ctx.stroke(); ctx.restore(); }
        else { ctx.beginPath(); ctx.arc(q.x, q.y, r, 0, Math.PI * 2); ctx.stroke(); }
      }
      ctx.globalCompositeOperation = 'source-over';
      // éclats voxel (pseudo-3D : hauteur z, rebond, ombre au sol)
      for (let i = voxels.length - 1; i >= 0; i--) {
        const q = voxels[i], t = (now - q.born) / q.life; if (t >= 1) { voxels.splice(i, 1); continue; }
        q.x += q.vx * kdt; q.y += q.vy * kdt; q.z += q.vz * kdt; q.vz -= 0.16 * kdt;
        if (q.z < 0) { q.z = 0; q.vz = -q.vz * 0.35; q.vx *= 0.7; q.vy *= 0.7; }
        q.vx *= 0.985; q.vy *= 0.985;
        const al = t > 0.6 ? (1 - t) / 0.4 : 1, s = q.s * (1 - 0.35 * t), yy = q.y - q.z;
        ctx.globalAlpha = 0.3 * al; ctx.fillStyle = '#000000'; ctx.fillRect(q.x - s / 2 + 0.6, q.y - s * 0.2, s, s * 0.5);
        ctx.globalAlpha = al; ctx.fillStyle = q.side; ctx.fillRect(q.x - s / 2, yy + s * 0.2, s, s * 0.45);
        ctx.fillStyle = q.top; ctx.fillRect(q.x - s / 2, yy - s * 0.5, s, s * 0.7);
      }
    }
    // libellés « DÉRÉSOLU » (ramenés dans l'arène pour rester lisibles ; figés en « réduire les effets »)
    ctx.globalAlpha = 1; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    for (let i = labels.length - 1; i >= 0; i--) {
      const q = labels[i], t = (now - q.born) / 1300; if (t >= 1) { labels.splice(i, 1); continue; }
      const x = Math.max(56, Math.min(ARENA - 56, q.x)), y = Math.max(26, Math.min(ARENA - 40, q.y - 16 - (FX ? 14 * t : 0)));
      const s = !FX ? 1 : t < 0.1 ? 0.6 + 0.5 * t / 0.1 : t < 0.2 ? 1.1 - 0.1 * (t - 0.1) / 0.1 : 1;
      ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.globalAlpha = t > 0.7 ? (1 - t) / 0.3 : 1;
      ctx.font = '800 15px ' + DISP; ctx.lineWidth = 4; ctx.strokeStyle = TH.glow ? 'rgba(2,4,10,0.9)' : 'rgba(255,255,255,0.95)'; ctx.strokeText(q.txt, 0, 0);
      ctx.fillStyle = q.col; ctx.fillText(q.txt, 0, 0);
      if (q.sub) { ctx.font = '600 10px ' + DISP; ctx.lineWidth = 3; ctx.strokeText(q.sub, 0, 14); ctx.fillStyle = TH.glow ? '#ffffff' : TH.ink; ctx.fillText(q.sub, 0, 14); }
      ctx.restore();
    }
    ctx.restore();
  }

  // ───────────────────────── alerte « obstacle devant » (joueur local) ─────────────────────────
  function drawDanger(me, now) {
    if (!occ || !me.path || !me.path.length) return;
    const q = me.path, n = q.length; let dx = 0, dy = 0;
    if (n >= 2) { dx = Math.sign(q[n - 1][0] - q[n - 2][0]); dy = dx ? 0 : Math.sign(q[n - 1][1] - q[n - 2][1]); }
    if (!dx && !dy) return;
    const look = (me.speed || me.boosting) ? 6 : 4, hx = me.head.x, hy = me.head.y;
    for (let k = 1; k <= look; k++) {
      const x = hx + dx * k, y = hy + dy * k; let hit = false;
      if (x < 0 || y < 0 || x >= GW || y >= GH) hit = true;
      else {
        const v = occ[y * GW + x];
        if (v === -1) hit = true;
        else if (v > 0) {
          const s = v - 1, o = snap.players[s];
          const ally = teamMode && s !== mySeat && o && o.team === me.team;   // traînée d'un coéquipier : traversable
          hit = !ally && !me.ghost;                                          // fantôme : traverse les traînées (pas les murs)
        }
      }
      if (!hit) continue;
      const cx = px(Math.max(-0.5, Math.min(GW - 0.5, x))), cy = px(Math.max(-0.5, Math.min(GH - 0.5, y))), u = 1 - (k - 1) / look;
      const s = CELL * 0.7, pulse = FX ? 0.55 + 0.45 * Math.sin(now / 70) : 0.85;
      ctx.save(); ctx.globalAlpha = Math.min(1, 0.35 + 0.65 * u) * pulse; ctx.strokeStyle = me.brk ? PU.breaker.c : TH.laser; ctx.lineWidth = 1.8; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(cx - s, cy - s); ctx.lineTo(cx + s, cy + s); ctx.moveTo(cx + s, cy - s); ctx.lineTo(cx - s, cy + s); ctx.stroke();
      ctx.strokeRect(cx - s * 1.35, cy - s * 1.35, s * 2.7, s * 2.7);
      ctx.restore();
      return;
    }
  }

  // ───────────────────────── écran titre : « TRON » tracé comme une traînée de light-cycle ─────────────────────────
  const TITLE = 'TRON', titleFont = s => `800 ${s}px ${DISP}`;
  const PT = { x: 0, y: 0, dx: 0, dy: 0 };
  function drawTitle(cx, cy, now) {
    ctx.save();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    let fs = 48; ctx.font = titleFont(fs);
    const maxW = ARENA * 0.72, w0 = ctx.measureText(TITLE).width;             // tient dans l'arène, même sur mobile
    if (w0 > maxW) { fs = Math.max(18, Math.floor(fs * maxW / w0)); ctx.font = titleFont(fs); }
    const acc = TH.accent, anim = !A.reduceFx;
    const bw = ARENA * 0.78, x0 = cx - bw / 2 + 8, y0 = cy - fs * 0.9, rw = bw - 16, rh = fs * 1.5;
    if (anim) {                                                              // grille en perspective qui fuit vers l'horizon
      ctx.save(); ctx.beginPath(); ctx.rect(cx - bw / 2, cy - fs * 0.95, bw, fs * 1.55); ctx.clip();
      const vy = cy - fs * 0.6, bh = fs * 1.2;
      ctx.strokeStyle = acc; ctx.lineWidth = 1; ctx.globalAlpha = 0.16;
      for (let i = -6; i <= 6; i++) { ctx.beginPath(); ctx.moveTo(cx + i * fs * 0.18, vy); ctx.lineTo(cx + i * fs * 1.35, vy + bh); ctx.stroke(); }
      const sp = (now / 2600) % 1;
      for (let k = 0; k < 7; k++) { const u = (k + sp) / 7, y = vy + bh * u * u; ctx.globalAlpha = 0.05 + 0.26 * u; ctx.beginPath(); ctx.moveTo(cx - bw / 2, y); ctx.lineTo(cx + bw / 2, y); ctx.stroke(); }
      ctx.restore();
      // deux light cycles font le tour du cartouche en laissant leur ruban
      const P = 2 * (rw + rh), CX = [[x0 + rw, y0], [x0 + rw, y0 + rh], [x0, y0 + rh], [x0, y0]], cum = [rw, rw + rh, 2 * rw + rh, P];
      const perim = s => { s = ((s % P) + P) % P; if (s < rw) { PT.x = x0 + s; PT.y = y0; PT.dx = 1; PT.dy = 0; } else if (s < rw + rh) { PT.x = x0 + rw; PT.y = y0 + s - rw; PT.dx = 0; PT.dy = 1; } else if (s < 2 * rw + rh) { PT.x = x0 + rw - (s - rw - rh); PT.y = y0 + rh; PT.dx = -1; PT.dy = 0; } else { PT.x = x0; PT.y = y0 + rh - (s - 2 * rw - rh); PT.dx = 0; PT.dy = -1; } return PT; };
      [[acc, 0], [TH.accent2, P / 2]].forEach(([col, off]) => {
        const s = now / 1000 * 150 + off, s0 = s - 190;
        ctx.beginPath(); perim(s0); ctx.moveTo(PT.x, PT.y);
        for (let base = Math.floor(s0 / P) * P; base <= s; base += P) for (let k = 0; k < 4; k++) { const cd = base + cum[k]; if (cd > s0 && cd < s) ctx.lineTo(CX[k][0], CX[k][1]); }
        perim(s); ctx.lineTo(PT.x, PT.y); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
        if (TH.glow) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.25; ctx.strokeStyle = col; ctx.lineWidth = 7; ctx.stroke(); ctx.globalCompositeOperation = 'source-over'; }
        ctx.globalAlpha = 1; ctx.strokeStyle = col; ctx.lineWidth = 2.6; ctx.stroke(); ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 0.9; ctx.stroke();
        const spr = motoSprite(0, col, 5.5); ctx.save(); ctx.translate(PT.x, PT.y); ctx.rotate(Math.atan2(PT.dy, PT.dx)); ctx.drawImage(spr.cv, spr.x, spr.y, spr.w, spr.h); ctx.restore();
      });
      ctx.globalAlpha = 1;
    }
    ctx.font = titleFont(fs);
    if (!anim || !TH.glow) {                                                 // version sobre / thème clair : lettres pleines + contour net
      ctx.fillStyle = TH.titleFill; ctx.fillText(TITLE, cx, cy);
      ctx.lineJoin = 'round'; ctx.strokeStyle = acc; ctx.lineWidth = 2.2; ctx.strokeText(TITLE, cx, cy);
    } else {
      const flick = 0.84 + 0.16 * Math.sin(now / 97) * Math.sin(now / 313);  // scintillement néon discret
      ctx.fillStyle = TH.titleFill; ctx.fillText(TITLE, cx, cy);            // corps sombre des lettres
      ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.shadowColor = acc;
      ctx.globalAlpha = 0.6 * flick; ctx.shadowBlur = 16; ctx.strokeStyle = acc; ctx.lineWidth = 2; ctx.strokeText(TITLE, cx, cy);
      const cyc = fs * 2.8, seg = cyc * 0.15, off = -(now / 9) % cyc;       // éclat qui parcourt le contour + rémanence
      ctx.setLineDash([seg, cyc - seg]);
      for (let k = 3; k >= 0; k--) {
        ctx.lineDashOffset = off + k * seg * 0.85;
        ctx.globalAlpha = (k ? 0.34 / k : 1) * flick;
        ctx.lineWidth = k ? Math.max(1, 3.4 - k * 0.8) : 3.4;
        ctx.shadowBlur = k ? 0 : 20;
        ctx.strokeStyle = k ? acc : '#eaffff';
        ctx.strokeText(TITLE, cx, cy);
      }
      ctx.setLineDash([]); ctx.shadowBlur = 0;
    }
    ctx.globalAlpha = 1; ctx.fillStyle = acc; ctx.font = '600 10px ' + DISP; spaced(ctx, 'LIGHT CYCLES', cx, cy + fs * 0.78, 3.2);
    ctx.restore();
  }

  // ───────────────────────── HUD canvas : jauge de boost, bonus actifs, alerte d'inversion ─────────────────────────
  function drawGauge(me, now) {
    const W = ARENA, bw = 176, bh = 9, bx = (W - bw) / 2, by = W - 20, b = Math.max(0, Math.min(1, (me.boost || 0) / 100));
    const hp = headPos[mySeat]; let al = 1;
    if (hp && hp.y > by - 44 && Math.abs(hp.x - W / 2) < bw / 2 + 36) al = 0.35;  // ma moto passe dessous : la jauge s'efface
    const gcol = b > 0.6 ? '#7ff0bd' : b > 0.25 ? '#9fe6ff' : '#ff7a7a';       // vert = plein, bleu = ok, rouge = à sec
    ctx.save(); ctx.globalAlpha = al;
    plate(ctx, bx - 26, by - 15, bw + 34, bh + 20, 5); ctx.fillStyle = 'rgba(4,8,18,0.78)'; ctx.fill();
    ctx.strokeStyle = A.contrast ? '#ffffff' : rgba(TH.glow ? TH.accent : '#9fb4d8', 0.55); ctx.lineWidth = 1; ctx.stroke();
    picto(ctx, 'bolt', bx - 14, by - 1, 6, gcol);
    ctx.font = '600 8px ' + DISP; ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left'; ctx.fillStyle = gcol; ctx.fillText('BOOST', bx, by - 4);
    ctx.fillStyle = 'rgba(220,235,255,0.6)'; ctx.fillText('(Maj)', bx + 40, by - 4);
    ctx.textAlign = 'right'; ctx.fillStyle = gcol; ctx.fillText(Math.round(b * 100) + ' %', bx + bw, by - 4);
    const N = 14, gap = 1.6, sw = (bw - gap * (N - 1)) / N, lit = b * N;
    ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.beginPath(); for (let i = Math.ceil(lit); i < N; i++) ctx.rect(bx + i * (sw + gap), by, sw, bh); ctx.fill();
    ctx.fillStyle = gcol; ctx.beginPath(); for (let i = 0; i < Math.floor(lit); i++) ctx.rect(bx + i * (sw + gap), by, sw, bh); ctx.fill();
    const fr = lit - Math.floor(lit); if (fr > 0.02 && lit < N) { ctx.globalAlpha = al * (0.25 + 0.75 * fr); ctx.fillRect(bx + Math.floor(lit) * (sw + gap), by, sw, bh); ctx.globalAlpha = al; }
    if (me.boosting && FX) { ctx.globalAlpha = al * (0.35 + 0.3 * Math.sin(now / 70)); ctx.fillStyle = '#ffffff'; ctx.beginPath(); for (let i = 0; i < Math.floor(lit); i++) ctx.rect(bx + i * (sw + gap), by, sw, bh); ctx.fill(); ctx.globalAlpha = al; }
    // bonus actifs : pastilles pictogramme + nom
    const tags = []; if (me.speed) tags.push('speed'); if (me.ghost) tags.push('ghost'); if (me.brk) tags.push('breaker');
    if (tags.length) {
      ctx.font = '600 8px ' + DISP; const ws = tags.map(t => ctx.measureText(t === 'breaker' ? 'CASSE-MUR PRÊT' : PU[t].n).width + 22), tot = ws.reduce((s, w) => s + w + 6, -6);
      let x = W / 2 - tot / 2; const ty = by - 33;
      tags.forEach((t, i) => {
        const d = PU[t]; plate(ctx, x, ty, ws[i], 14, 3); ctx.fillStyle = 'rgba(4,8,18,0.8)'; ctx.fill(); ctx.strokeStyle = d.c; ctx.lineWidth = 1; ctx.stroke();
        picto(ctx, t, x + 8, ty + 7, 4.2, d.c); ctx.fillStyle = d.c; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(t === 'breaker' ? 'CASSE-MUR PRÊT' : d.n, x + 15, ty + 7.5);
        x += ws[i] + 6;
      });
    }
    ctx.restore();
    if (me.inv) {                                          // alerte inversion, en haut
      const pa = FX ? 0.65 + 0.35 * Math.sin(now / 90) : 1, c = PU.invert.c;
      ctx.save(); ctx.globalAlpha = pa; ctx.font = '800 13px ' + DISP; const tw = ctx.measureText('CONTRÔLES INVERSÉS').width;
      plate(ctx, W / 2 - tw / 2 - 26, 6, tw + 44, 22, 5); ctx.fillStyle = 'rgba(30,4,24,0.82)'; ctx.fill(); ctx.strokeStyle = c; ctx.lineWidth = 1.4; ctx.stroke();
      picto(ctx, 'invert', W / 2 - tw / 2 - 12, 17, 6, c);
      ctx.fillStyle = c; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText('CONTRÔLES INVERSÉS', W / 2 - tw / 2 + 2, 17.5);
      ctx.restore();
    }
  }

  // ───────────────────────── rendu d'une image ─────────────────────────
  function draw() {
    if (destroyed) return;
    const now = performance.now(), dtm = Math.min(50, Math.max(4, now - (lastFrame || now - 16.7))), kdt = dtm / 16.7; lastFrame = now;
    const sc = cv.width / ARENA, c = ARENA / 2;
    let ox = 0, oy = 0;
    if (shakeMag > 0.3 && !A.reduceFx) { ox = (Math.random() * 2 - 1) * shakeMag; oy = (Math.random() * 2 - 1) * shakeMag; shakeMag *= 0.85; } else shakeMag = 0;
    let sscale = sc, tax = ox * sc, tay = oy * sc;
    if (killcam && !A.reduceFx) {                         // killcam : zoom bref sur ta propre collision
      const age = now - killcam.born, D = 750;
      if (age < D) { const w = Math.sin(Math.PI * age / D), z = 1 + 0.35 * w, cpx = killcam.x * CELL + CELL / 2, cpy = killcam.y * CELL + CELL / 2; sscale = sc * z; tax = (ox * sc) * (1 - w) + (cv.width / 2 - cpx * sscale) * w; tay = (oy * sc) * (1 - w) + (cv.height / 2 - cpy * sscale) * w; }
      else killcam = null;
    }
    ctx.setTransform(sscale, 0, 0, sscale, tax, tay);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = TH.bg; ctx.fillRect(-20, -20, ARENA + 40, ARENA + 40);   // sous le décor : bords découverts par le tremblement
    ensureDecor(); ctx.drawImage(decorCv, 0, 0, ARENA, ARENA);
    drawAmbient(now);
    drawWalls(now);
    drawLights(now);                                     // lumière sur le sol, avant bonus, traînées et motos
    const over = !!(snap && snap.gs === 'over'), me = (snap && mySeat >= 0) ? snap.players[mySeat] : null;

    if (snap) {
      // bonus au sol : hologrammes hexagonaux (sous les traînées : ne masquent jamais un mur)
      const r = puR();
      (snap.pickups || []).forEach(pk => {
        const x = px(pk.x), y = px(pk.y), d = puDef(pk.t), spr = puSprite(pk.t, r), bob = FX ? 1 + 0.07 * Math.sin(now / 230 + pk.x * 1.3) : 1;
        if (FX) { ctx.save(); ctx.translate(x, y); ctx.rotate(now / 1400 + pk.y); ctx.strokeStyle = d.c; ctx.globalAlpha = 0.55; ctx.lineWidth = 0.9; ctx.setLineDash([r * 0.5, r * 0.35]); hexPath(ctx, r * 1.32); ctx.stroke(); ctx.setLineDash([]); ctx.restore(); }
        ctx.drawImage(spr.cv, x - spr.half * bob, y - spr.half * bob, spr.S * bob, spr.S * bob);
      });
      const V = viewState(now), pl = snap.players;
      for (const p of pl) if (p.playing && !p.alive) drawTrail(p, V && V[p.seat], now, true);   // murs éteints d'abord
      for (const p of pl) if (p.playing && p.alive) drawTrail(p, V && V[p.seat], now, false);
      for (const p of pl) {                                                                        // motos PAR-DESSUS toutes les traînées
        if (!p.playing || !p.alive) continue;
        const v = V && V[p.seat], hx = v ? px(v.x) : px(p.head.x), hy = v ? px(v.y) : px(p.head.y);
        let dx = v ? v.dx : 0, dy = v ? v.dy : 0;
        if (!dx && !dy && !angView[p.seat]) { const sd = spawnDir(p); if (sd) { dx = sd.x; dy = sd.y; } }
        const ang = viewAngle(p.seat, dx, dy, dtm);
        const h = headPos[p.seat] || (headPos[p.seat] = { x: 0, y: 0, a: 0 }); h.x = hx; h.y = hy; h.a = ang; h.dx = Math.sign(dx); h.dy = Math.sign(dy);
        drawMoto(p, hx, hy, ang, now);
        if (p.boosting && FX && snap.gs === 'play' && Math.random() < 0.7 * kdt) { const rx = hx - Math.cos(ang) * 2.2 * CELL, ry = hy - Math.sin(ang) * 2.2 * CELL; capPush(embers, { x: rx, y: ry, vx: -Math.cos(ang) * 1.3 + (Math.random() - 0.5) * 0.8, vy: -Math.sin(ang) * 1.3 + (Math.random() - 0.5) * 0.8, col: colSeat(p.seat), born: now, life: 260 + Math.random() * 200 }, 160); }
        if (over) {                                                                                // vainqueur(s) : auréole pulsée
          ctx.save(); ctx.strokeStyle = colSeat(p.seat); ctx.lineWidth = 2.2; ctx.globalAlpha = FX ? 0.5 + 0.4 * Math.sin(now / 180) : 0.8;
          ctx.beginPath(); ctx.arc(hx - Math.cos(ang) * CELL * 0.8, hy - Math.sin(ang) * CELL * 0.8, CELL * 2.2 + 3, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
          if (FX && now - lastFw > 850) { lastFw = now; const fx0 = hx + (Math.random() - 0.5) * 90, fy0 = hy + (Math.random() - 0.5) * 90; spawnSparks(fx0, fy0, 18, colSeat(p.seat), 2.6); spawnSparks(fx0, fy0, 6, '#ffffff', 1.6); LUM.ajouter(fx0, fy0, 38, colSeat(p.seat), 620, 0.6 * lk()); ring(fx0, fy0, 2, 26, colSeat(p.seat), 1.6, 520, 'sq'); }
        }
      }
      for (const p of pl) if (p.playing && !p.alive && p.head && !(deadAt[p.seat] && now - deadAt[p.seat] < 700)) {   // épave, une fois la dérésolution jouée : croix sobre
        const x = px(clampG(p.head.x, GW)), y = px(clampG(p.head.y, GH)), s = CELL * 0.45;
        ctx.save(); ctx.strokeStyle = tstyle(colSeat(p.seat)).deadEdge; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(x - s, y - s); ctx.lineTo(x + s, y + s); ctx.moveTo(x + s, y - s); ctx.lineTo(x - s, y + s); ctx.stroke(); ctx.restore();
      }
      if (me && me.playing && me.alive && !over && headPos[mySeat] && snap.gs !== 'countdown') {
        const h = headPos[mySeat]; drawMeMarker(h.x, h.y, now);
        ECHO.dessiner(ctx, h.x + (h.dx || 0) * CELL * 0.6, h.y + (h.dy || 0) * CELL * 0.6, Math.max(9, CELL * 1.7), h.dx || 0, h.dy || 0, '#ffffff', now, !FX);
      }
    }
    drawFx(now, kdt);
    drawDusk(dtm);                                       // étalonnage par-dessus l'arène ; HUD, alertes et voiles restent nets
    if (me && me.playing && me.alive && snap.gs === 'play') { drawDanger(me, now); drawGauge(me, now); }
    if (invFlash && now - invFlash < 700) {                 // inversion subie : liseré magenta qui pulse au bord de l'écran
      const t = (now - invFlash) / 700; ctx.save(); ctx.strokeStyle = PU.invert.c;
      for (let k = 0; k < 3; k++) { ctx.globalAlpha = (0.5 - k * 0.15) * (1 - t); ctx.lineWidth = 6 + k * 6; ctx.strokeRect(0, 0, ARENA, ARENA); }
      ctx.restore();
    }

    if (snap && snap.gs === 'countdown') {
      ctx.fillStyle = TH.veil; ctx.globalAlpha = 0.5; ctx.fillRect(0, 0, ARENA, ARENA); ctx.globalAlpha = 1;
      // grille de départ : position et direction de chaque moto
      snap.players.forEach(p => {
        const hp = headPos[p.seat], st = angView[p.seat]; if (!p.playing || !hp || !st) return;
        const col = colSeat(p.seat), s = CELL * 1.1 + 2 + (FX ? Math.sin(now / 160) * 1.5 : 0), dy = Math.sin(st.t);
        ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.strokeRect(hp.x - s, hp.y - s, s * 2, s * 2);
        ctx.fillStyle = col; ctx.translate(hp.x, hp.y); ctx.rotate(st.t);
        for (let k = 0; k < 3; k++) {                        // chevrons de départ
          const ph = FX ? ((now / 400 + (2 - k) / 3) % 1) : 1, xx = CELL * (1.4 + k * 0.9);
          ctx.globalAlpha = 0.35 + 0.65 * ph; ctx.beginPath(); ctx.moveTo(xx, -CELL * 0.45); ctx.lineTo(xx + CELL * 0.5, 0); ctx.lineTo(xx, CELL * 0.45); ctx.lineTo(xx + CELL * 0.18, 0); ctx.closePath(); ctx.fill();
        }
        ctx.restore();
        if (p.seat === mySeat) {
          ctx.save(); ctx.font = '800 10px ' + DISP; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.lineJoin = 'round'; ctx.lineWidth = 3; ctx.strokeStyle = TH.glow ? '#02060c' : '#ffffff';
          const ly = hp.y - s - 4 - (dy < -0.5 ? CELL * 3.6 : 0); ctx.strokeText('VOUS', hp.x, ly); ctx.fillStyle = col; ctx.fillText('VOUS', hp.x, ly); ctx.restore();
        }
      });
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const n = snap.count || 0, pulse = FX ? 1 + 0.06 * Math.sin(now / 110) : 1;
      ctx.save(); ctx.translate(c, c - 6); ctx.scale(pulse, pulse);
      ctx.fillStyle = TH.glow ? 'rgba(3,6,14,0.72)' : 'rgba(240,244,252,0.9)'; ctx.beginPath(); ctx.arc(0, 0, 62, 0, Math.PI * 2); ctx.fill();   // disque HUD
      ctx.lineCap = 'butt'; ctx.lineWidth = 5;
      for (let i = 0; i < 3; i++) {                           // 3 segments : un s'éteint à chaque seconde
        const a0 = -Math.PI / 2 + i * 2 * Math.PI / 3 + 0.09, a1 = a0 + 2 * Math.PI / 3 - 0.18, on = n <= 0 || i < n;
        ctx.strokeStyle = on ? (n <= 0 ? TH.accent2 : TH.accent) : rgba(TH.accent, 0.16); ctx.beginPath(); ctx.arc(0, 0, 56, a0, a1); ctx.stroke();
      }
      if (FX) { ctx.save(); ctx.rotate(now / 900); ctx.setLineDash([3, 7]); ctx.strokeStyle = rgba(TH.accent, 0.6); ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, 0, 67, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
      if (FX && TH.glow) { ctx.shadowColor = TH.accent; ctx.shadowBlur = 20; }
      ctx.fillStyle = TH.ink; ctx.font = titleFont(n > 0 ? 64 : 40); ctx.fillText(n > 0 ? String(n) : 'GO', 0, 3);
      ctx.restore();
      ctx.font = '600 11px ' + DISP; ctx.fillStyle = TH.ink;
      spaced(ctx, n > 0 ? 'INITIALISATION DE LA GRILLE' : 'EN PISTE !', c, c + 80, 2.4);
    }
    if (snap && (snap.gs === 'lobby' || snap.gs === 'paused')) {
      ctx.fillStyle = TH.veil; ctx.fillRect(0, 0, ARENA, ARENA); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      if (snap.gs === 'paused') {
        ctx.fillStyle = TH.accent; ctx.fillRect(c - 13, c - 70, 9, 26); ctx.fillRect(c + 4, c - 70, 9, 26);   // pictogramme pause
        ctx.font = titleFont(40);
        if (FX) { const j = Math.sin(now / 300) * 1.2; ctx.globalAlpha = 0.55; ctx.fillStyle = TH.accent2; ctx.fillText('PAUSE', c - 2 + j, c - 8); ctx.fillStyle = TH.accent; ctx.fillText('PAUSE', c + 2 - j, c - 8); ctx.globalAlpha = 1; }   // décalage chromatique
        ctx.fillStyle = TH.ink; ctx.fillText('PAUSE', c, c - 8);
        ctx.font = '600 11px ' + DISP; ctx.fillStyle = TH.accent; spaced(ctx, 'PROGRAMME SUSPENDU', c, c + 24, 2.4);
        ctx.fillStyle = TH.sub; ctx.font = '14px system-ui, sans-serif'; ctx.fillText('P / Échap pour reprendre', c, c + 46);
      } else {
        drawTitle(c, c - 62, now);
        const n = snap.connected || 0, nb = snap.botCount || 0, tot = n + nb;
        ctx.fillStyle = teamMode ? TH.accent : TH.sub; ctx.font = '15px system-ui, sans-serif';
        ctx.fillText(`${n} pilote${n > 1 ? 's' : ''}${nb ? ' + ' + nb + ' bot' + (nb > 1 ? 's' : '') : ''}${teamMode ? ' · ' + (MODE_NAME[snap.mode] || snap.mode) : ''}`, c, c + 8);
        // grille de départ : une mini-moto par pilote connecté (sa couleur) + une grise par bot
        const icons = []; snap.players.forEach(p => { if (p.connected) icons.push([p.seat, colSeat(p.seat)]); });
        for (let k = 0; k < nb && icons.length < MAX_SEATS; k++) icons.push([0, TH.glow ? '#7c86a0' : '#8a93a8']);
        const gapI = 30, x0 = c - (icons.length - 1) * gapI / 2 + 7;
        icons.forEach((ic, k) => { const spr = motoSprite(ic[0], ic[1], 6); ctx.drawImage(spr.cv, x0 + k * gapI + spr.x, c + 34 + spr.y, spr.w, spr.h); });
        ctx.font = 'bold 13px system-ui, sans-serif'; ctx.fillStyle = TH.sub;
        const hint = tot >= 2 ? 'Espace / clic pour lancer' : 'En attente d\'un 2ᵉ pilote… (ou ajoute un bot)';
        if (tot >= 2) { const tw = ctx.measureText(hint).width; picto(ctx, 'play', c - tw / 2 - 10, c + 62, 5, TH.accent); }
        ctx.fillText(hint, c + (tot >= 2 ? 6 : 0), c + 62);
      }
    }
  }
  function drawLoop() { if (destroyed) return; try { draw(); } catch (e) { console.error('[render]', e); } rafId = requestAnimationFrame(drawLoop); }   // filet : une erreur de rendu ne fige plus le jeu

  const onKeyDown = e => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
    unlockAudio();
    if (e.key === ' ' && snap && snap.gs !== 'play' && snap.gs !== 'paused') return e.repeat ? undefined : send({ t: 'start' });
    if ((e.key === 'p' || e.key === 'P' || e.key === 'Escape') && snap && (snap.gs === 'play' || snap.gs === 'paused')) return send({ t: 'pause' });
    if ((e.key === 'Shift' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') && !boostHeld) { boostHeld = true; send({ t: 'boost', on: true }); return; }
    const d = DIR_KEYS[e.code]; if (d && !e.repeat) { send({ t: 'dir', d }); echoVirage(d); }   // la répétition auto renvoyait la même direction ~30×/s pour rien
  };
  const onKeyUp = e => { if (e.key === 'Shift' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') { boostHeld = false; send({ t: 'boost', on: false }); } };
  const onBlur = () => { if (boostHeld) { boostHeld = false; send({ t: 'boost', on: false }); } };
  function dpad(id, d) { const el = $(id); if (!el) return; el.addEventListener('pointerdown', e => { e.preventDefault(); unlockAudio(); send({ t: 'dir', d }); echoVirage(d); }); }
  function echoVirage(d) { const me = snap && mySeat >= 0 && snap.players ? snap.players[mySeat] : null, h = headPos[mySeat]; if (me && me.alive && h) ECHO.appui(d, h.dx || 0, h.dy || 0, !!me.inv); }

  // Les boutons du DOM sont STATIQUES et le module est un singleton (import() en cache) : init() est
  // rappelé à chaque retour sur le jeu. Sans ce drapeau, chaque retour rebranchait les écouteurs sans
  // débrancher les précédents — après k retours, un appui partait k fois (k mines, k bombes, k virages).
  // Leurs gestionnaires lisent l’état COURANT du module (send, snap…) : les brancher une fois suffit.
  let cable = false;
  function init(ctx0) {
    const premiere = !cable; cable = true;
    destroyed = false;              // module singleton réutilisé : réarmer la boucle de rendu après un précédent teardown
    A = ctx0.a11y; send = ctx0.send; root = ctx0.root;
    if (ctx0.togglePanel) togglePanel = ctx0.togglePanel; if (ctx0.closePanels) closePanels = ctx0.closePanels;
    cv = $('trc'); ctx = cv.getContext('2d'); hud = $('trHud'); endEl = $('trEnd');
    const wrap = cv.parentElement;                                                  // cadre du canvas : support des bandeaux bonus/malus
    initGameMsg(wrap && wrap.classList.contains('canvas-wrap') ? wrap : null);
    hud.innerHTML = '';             // module réutilisé : repartir d'un HUD vide (sinon les cartes P1.. se cumulent à chaque retour)
    cards = Array.from({ length: MAX_SEATS }, (_, i) => i).map(i => { const el = document.createElement('div'); el.className = 'pc hidden'; el.innerHTML = `<div class="dot"></div><div class="inf"><div class="pn">P${i + 1}</div><div class="lv"></div></div>`; hud.appendChild(el); return el; });
    startBtn = $('trStart'); pauseBtn = $('trPause'); modeBtn = $('trMode'); fadeBtn = $('trFade'); botsBtn = $('trBots'); pauseFloat = $('trPauseFloat');
    lbBtn = $('trLbBtn'); lbPanel = $('trLbPanel'); lbBody = $('trLbBody');
    startBtn.onclick = () => { unlockAudio(); send({ t: 'start' }); };
    pauseBtn.onclick = () => send({ t: 'pause' });
    pauseFloat.onclick = () => send({ t: 'pause' });
    modeBtn.onclick = () => send({ t: 'mode' });
    fadeBtn.onclick = () => send({ t: 'fade' });
    if (botsBtn) botsBtn.onclick = () => send({ t: 'bots' });
    diffBtn = $('trDiff'); if (diffBtn) diffBtn.onclick = () => send({ t: 'botdiff' });
    lbBtn.onclick = () => { togglePanel(lbPanel); renderLB(); };
    const helpBtn = $('trHelp'), helpPanel = $('trHelpPanel'); if (helpBtn && helpPanel) helpBtn.onclick = () => togglePanel(helpPanel);
    if (premiere) cv.addEventListener('click', () => { unlockAudio(); if (snap && snap.gs !== 'play' && snap.gs !== 'paused') send({ t: 'start' }); });
    if (premiere) endEl.addEventListener('click', () => { unlockAudio(); send({ t: 'start' }); });
    if (premiere) { dpad('trUp', 'up'); dpad('trDown', 'down'); dpad('trLeft', 'left'); dpad('trRight', 'right'); }
    const bb = $('trBoost'); if (bb && premiere) { const on = e => { e.preventDefault(); send({ t: 'boost', on: true }); }; const off = e => { e.preventDefault(); send({ t: 'boost', on: false }); }; bb.addEventListener('pointerdown', on); bb.addEventListener('pointerup', off); bb.addEventListener('pointerleave', off); bb.addEventListener('pointercancel', off); }
    applyColors();                  // vide aussi les caches de sprites/dégradés : ils appartiennent au contexte
    resizeH = resizeCanvas; addEventListener('resize', resizeH); resizeCanvas();
    addEventListener('keydown', onKeyDown); addEventListener('keyup', onKeyUp); addEventListener('blur', onBlur);
    music.start();
    rafId = requestAnimationFrame(drawLoop);
  }
  function onA11y() { applyColors(); }
  function teardown() { destroyed = true; music.stop(); cancelAnimationFrame(rafId); removeEventListener('resize', resizeH); removeEventListener('keydown', onKeyDown); removeEventListener('keyup', onKeyUp); removeEventListener('blur', onBlur); }

  return { init, onState, onMessage, onLb, onA11y, teardown };
})();
