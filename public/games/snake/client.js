// Module client SNAKE : serpents sur grille partagée, nourriture à manger, dernier en vie gagne. FFA + équipes.
// Identité « Jardin », portée au niveau du Sumo : pelouse tondue pré-rendue hors écran (damier nuancé, brins,
// touffes, trèfles, fleurettes, ombres de feuillage, lumière du haut-gauche, vignette), haie de buis (murs
// mortels) ou allée de gravier à chevrons (murs traversants), rochers moussus ; serpents à écailles (ombre
// portée, contour, tube éclairé, motif du siège, queue effilée, renflement qui descend après chaque repas),
// tête orientée aux yeux qui clignent et suivent la nourriture, langue fourchue ; nourriture en pictogrammes
// pré-rendus ; papillons, lucioles et pétales d'ambiance ; mort en éclats scintillants.
import { GW as GW0, GH as GH0, CELL as CELL0, ARENA } from './shared.js';
import { createMusic } from '../../music.js';
import { seatPattern, SEAT_GLYPH } from '../../patterns.js';   // motifs par siège (lisibilité daltonien / jusqu'à 10 joueurs)
import { initGameMsg, msgPerso, msgGlobal } from '../../gamemsg.js';   // retour de test : l'icône seule ne dit pas l'effet, on l'écrit
import { arenaSize } from '../../layout.js';   // taille du plateau : commune à tous les jeux (mode plein écran compris)
import { lumiere, creerLumieres } from '../../lumiere.js';        // lueurs sur la pelouse : pommes spéciales, fantômes, repas, éclats de mort
import { crepuscule, creerDuel } from '../../crepuscule.js';                 // le jardin passe du jour au crépuscule quand la manche s'achève
import { creerJournal, blocFin } from '../../finpartie.js';
import { creerEcho } from '../../echo-virage.js';                   // chevron immédiat du virage enregistré (file de 2 virages côté serveur)       // écran de fin : longueur au fil de la manche + meilleure action

// Duel final (crepuscule.js) : quand il ne reste que 2 joueurs ou 2 équipes, la nuit tombe en ~4 s.
const DUEL = creerDuel();   // Snake annonce déjà son duel final (music.sting + message) : pas de second bandeau
// grille dynamique (nb de joueurs) : l'arène garde la MÊME taille logique, seule la taille des cases change
let GW = GW0, GH = GH0, CELL = CELL0;

// musique : jardin au printemps — nappe I-vi-IV-V, chants d'oiseaux épars au lobby ; en jeu, marimba
// pentatonique, basse pincée, shaker ; climax (sprint food-rush / duel) = contre-voix, charleston serré + tempo.
const MUSIC_THEME = { bpm: 102, bpmBoost: 14, vol: 0.42, root: 130.81, len: 32,
  stingers: { kill: { notes: [7, 4, 0, -5], wave: 'triangle', oct: 1, gain: 0.04, dur: 0.16, rate: 0.07 },
    win: { base: 261.63, notes: [[0, 4, 7], [5, 9, 12], [7, 11, 14], [12, 16, 19]], gain: 0.035, dur: 0.36, rate: 0.14 },
    count: { notes: [0], oct: 2, wave: 'triangle', dur: 0.1, gain: 0.045, duck: false }, go: { notes: [[0, 4, 7, 12]], oct: 1, dur: 0.45, gain: 0.045, duck: false },
    alert: { notes: [0, 4, 7, 12, 7, 12, 16], oct: 1, wave: 'triangle', rate: 0.06, dur: 0.14, gain: 0.038 } },
  layers: [
  { seq: [[0, 4, 7], null, null, null, null, null, null, null, [-3, 0, 4], null, null, null, null, null, null, null, [-7, -3, 0], null, null, null, null, null, null, null, [-5, -1, 2], null, null, null, null, null, null, null], wave: 'sine', gain: 0.017, dur: 9 },   // nappe
  { seq: [null, null, null, null, null, 7, 9, 7, null, null, null, null, null, null, null, null, null, null, null, null, null, 12, 9, null, null, null, null, null, null, null, null, null], oct: 3, wave: 'sine', gain: 0.007, dur: 0.4 },   // oiseaux
  { seq: [7, null, 4, null, 7, 9, null, 7, 4, null, 2, null, 0, null, null, null, 9, null, 7, null, 9, 12, null, 9, 7, null, 4, null, 2, null, 4, null], oct: 1, wave: 'triangle', gain: 0.024, dur: 1.3, min: 1 },   // marimba
  { seq: [0, null, null, null, null, null, 0, null, -3, null, null, null, null, null, -3, null, -7, null, null, null, null, null, -7, null, -5, null, null, null, -5, null, -1, null], wave: 'triangle', gain: 0.028, dur: 3, min: 1 },   // basse pincée
  { drums: 'K...H.H.K.H.H.H.K...H.H.K.H.HHH.', gain: 0.45, min: 1 },                                                                                  // shaker + grosse caisse douce
  { seq: [null, null, 16, null, null, null, 14, null, null, null, 12, null, null, null, 9, null, null, null, 16, null, null, null, 19, null, null, null, 14, null, null, null, 11, null], oct: 1, wave: 'sine', gain: 0.016, dur: 1.1, min: 2 },
  { drums: 'H.H.HHH.H.H.HHH.H.H.HHH.H.HHHHH.', gain: 0.5, min: 2 },
] };

const MAX_SEATS = 10;                               // sièges max côté serveur pour Snake
const TICK_HZ = 12;                                 // cadence serveur : elimTick est compté en ticks
// au-delà de 8 sièges il n'existe plus de teintes toutes distinguables : c'est le MOTIF par siège (patterns.js) qui porte l'identification
const PAL = { normal: ['#4a9ee0', '#e06240', '#2aaf7a', '#cc9010', '#9b6cf0', '#e268b0', '#25c9c0', '#9ec93a', '#d06ef0', '#f2f0e6'],
              cb: ['#0072B2', '#E69F00', '#009E73', '#F0E442', '#CC79A7', '#56B4E9', '#D55E00', '#F5F5F5', '#7B68EE', '#9A9A9A'] };
const TEAMPAL = { normal: ['#4a9ee0', '#e06240', '#2aaf7a', '#cc9010', '#9b6cf0'], cb: ['#0072B2', '#E69F00', '#009E73', '#F0E442', '#CC79A7'] };
const TEAM_LETTER = ['A', 'B', 'C', 'D', 'E'];
const MODE_NAME = { ffa: 'Chacun pour soi', '2v2': '2 v 2', '2v2v2': '2 v 2 v 2', '3v3': '3 v 3', '4v4': '4 v 4', '2v2v2v2': '2 v 2 v 2 v 2', '3v3v3': '3 v 3 v 3', '5v5': '5 v 5', '2v2v2v2v2': '2 v 2 v 2 v 2 v 2' };
const TEAM_TOTALS = [4, 6, 8, 9, 10];               // effectifs pour lesquels un mode par équipes existe (4→2v2 … 10→5v5 / 2v2v2v2v2)
const VARIANT_NAMES = ['🐍 Classique', '🌀 Murs traversants', '🪨 Obstacles'];
const VARIANT_SUB = ['Classique — la haie ne pardonne pas', 'Murs traversants — on ressort en face', 'Obstacles — gare aux rochers'];   // lobby (canvas : pas d'emoji)
const DIFF_NAMES = ['Facile', 'Normale', 'Difficile'];
// Libellés des nourritures spéciales : dire l'EFFET, pas le nom (les icônes 🟡🍄👻 ne sont pas parlantes).
// Volontairement PAS de message pour la pomme ordinaire : on en ramasse une toutes les deux secondes,
// ce serait un bandeau permanent — et c'est la seule nourriture dont l'icône se comprend seule.
// Ces nourritures n'affectent QUE celui qui les mange (cf. games/snake/server.js) : elles sont donc personnelles.
const FOOD_MSG = {
  gold:   { i: '🟡', t: 'Pomme dorée : +3 points', c: '#ffd24a' },
  shrink: { i: '🍄', t: 'Champignon : tu raccourcis', c: '#ff7a6a' },
  ghost:  { i: '👻', t: 'Fantôme : tu traverses les serpents', c: '#bfe3ff' },
};
const FOOD_TYPES = { apple: 1, gold: 1, shrink: 1, ghost: 1 };            // seuls types dessinés ; tout le reste retombe sur la pomme
const FOOD_GLOW = { gold: '255,210,74', shrink: '255,120,110', ghost: '190,225,255' };   // lueur pré-rendue des nourritures spéciales
// Cause de la mort, DÉDUITE côté client de l'événement 'crash' (case visée, rochers, tueur, chocs simultanés).
// Constantes uniquement : le nom d'un tueur n'entre jamais dans un bandeau gamemsg.
const CAUSE_MSG = { wall: 'Dans la haie !', rock: 'Contre un rocher !', snake: 'Tu as percuté un serpent !', head: 'Choc frontal !', self: "Tu t'es mordu la queue !" };
const CAUSE_TXT = { wall: 'dans la haie', rock: 'contre un rocher', snake: 'contre ', head: 'choc frontal', self: 'mordu sa queue' };
const DISP = 'Fredoka, "Segoe UI", sans-serif';   // police d'affichage (Google Fonts, chargée par la page)
const TITLE_COL = '#f0a93a';                        // serpent du logo
const INTERP_MS = 90;
const DIR_KEYS = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right' };
const TAPER = [0.38, 0.55, 0.72, 0.87];             // effilement de la queue : 4 tronçons de largeur croissante
// ambiance (coupée par reduceFx) : lucioles, pétales qui tombent, papillons qui flânent
const AMB_FLY = Array.from({ length: 11 }, () => ({ x: Math.random(), y: Math.random(), ph: Math.random() * 6.28, r: 1.2 + Math.random() }));
const AMB_PETAL = Array.from({ length: 6 }, () => ({ x: Math.random(), v: 9 + Math.random() * 12, ph: Math.random() * 6.28, s: 2 + Math.random() * 2 }));
const BUTTERFLIES = [{ c: '#ffe27a', d: '#9c7a1e', sx: 0.21, sy: 0.16, ph: 0.4 }, { c: '#a8d8ff', d: '#3f6fa8', sx: 0.14, sy: 0.19, ph: 2.1 }, { c: '#ffb27a', d: '#a0561e', sx: 0.17, sy: 0.12, ph: 4.2 }];
const K_DOT = 0, K_CHIP = 1, K_SPARK = 2, K_LEAF = 3, K_SPORE = 4;   // sortes de particules
const MAXPART = 320;

function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function hexRgb(h) { const n = parseInt(String(h).slice(1, 7), 16) || 0; return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function rgbStr(c, a) { return a == null ? `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})` : `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`; }
function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }   // mulberry32 : décor identique d'un rendu à l'autre
function hash2(a, b) { const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return x - Math.floor(x); }
// ellipse maison (scale + arc) : ctx.ellipse est absent/instable sur les vieux Safari
function oval(g, x, y, rx, ry) { g.save(); g.translate(x, y); g.scale(rx, ry); g.moveTo(1, 0); g.arc(0, 0, 1, 0, Math.PI * 2); g.restore(); }
function circ(g, x, y, r) { g.moveTo(x + r, y); g.arc(x, y, r, 0, Math.PI * 2); }
// rectangle arrondi maison (arcTo) : ctx.roundRect n'existe pas sur Safari iOS 12-13
function rrect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.arcTo(x + w, y, x + w, y + r, r); g.lineTo(x + w, y + h - r); g.arcTo(x + w, y + h, x + w - r, y + h, r); g.lineTo(x + r, y + h); g.arcTo(x, y + h, x, y + h - r, r); g.lineTo(x, y + r); g.arcTo(x, y, x + r, y, r); g.closePath(); }
function backOut(u) { const c1 = 1.70158, c3 = c1 + 1, v = u - 1; return 1 + c3 * v * v * v + c1 * v * v; }
const sgn = v => Math.abs(v) > 1 ? -Math.sign(v) : Math.sign(v);   // pas de grille ; un saut de wrap inverse le signe

// ───────────────────────── pictogrammes de nourriture (vectoriel, centré sur 0,0) ─────────────────────────
// Dessinés au canvas et non en emoji : les emoji varient trop d'un OS à l'autre. C = taille d'une case.
function paintFood(g, t, C, hc) {
  const r = C * 0.36;
  g.lineJoin = 'round'; g.lineCap = 'round';
  g.fillStyle = 'rgba(0,14,0,0.35)'; g.beginPath();                                  // ombre au sol (le fantôme flotte plus haut)
  if (t === 'ghost') oval(g, C * 0.05, C * 0.42, r * 0.62, r * 0.2); else oval(g, C * 0.06, r * 0.95, r * 0.9, r * 0.3);
  g.fill();
  if (t === 'shrink') {                                                              // amanite : pied crème, chapeau rouge à pois
    g.beginPath(); g.moveTo(-C * 0.12, C * 0.03); g.lineTo(-C * 0.14, C * 0.3); g.quadraticCurveTo(0, C * 0.37, C * 0.14, C * 0.3); g.lineTo(C * 0.12, C * 0.03); g.closePath();
    g.fillStyle = '#f4e7d0'; g.fill(); g.lineWidth = C * 0.045; g.strokeStyle = hc ? '#ffffff' : 'rgba(90,60,40,0.7)'; g.stroke();
    g.beginPath(); g.moveTo(-C * 0.41, C * 0.03); g.bezierCurveTo(-C * 0.43, -C * 0.44, C * 0.43, -C * 0.44, C * 0.41, C * 0.03); g.quadraticCurveTo(0, C * 0.11, -C * 0.41, C * 0.03); g.closePath();
    const cg = g.createRadialGradient(-C * 0.14, -C * 0.22, C * 0.03, 0, -C * 0.05, C * 0.45);
    cg.addColorStop(0, '#ff8a78'); cg.addColorStop(0.55, '#e0342c'); cg.addColorStop(1, '#8e1a16');
    g.fillStyle = cg; g.fill(); g.lineWidth = hc ? C * 0.08 : C * 0.05; g.strokeStyle = hc ? '#ffffff' : '#5a0f0c'; g.stroke();
    g.fillStyle = '#fff8ee'; g.beginPath(); circ(g, -C * 0.19, -C * 0.1, C * 0.065); circ(g, C * 0.05, -C * 0.22, C * 0.075); circ(g, C * 0.23, -C * 0.05, C * 0.055); circ(g, -C * 0.03, -C * 0.03, C * 0.04); g.fill();
    g.strokeStyle = 'rgba(255,232,210,0.7)'; g.lineWidth = C * 0.035; g.beginPath(); g.moveTo(-C * 0.33, C * 0.05); g.quadraticCurveTo(0, C * 0.12, C * 0.33, C * 0.05); g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.4)'; g.beginPath(); oval(g, -C * 0.15, -C * 0.25, C * 0.11, C * 0.045); g.fill();
    return;
  }
  if (t === 'ghost') {                                                               // drap flottant, bas festonné, yeux ronds
    g.beginPath(); g.moveTo(-C * 0.3, C * 0.28); g.lineTo(-C * 0.3, -C * 0.03); g.arc(0, -C * 0.03, C * 0.3, Math.PI, 0); g.lineTo(C * 0.3, C * 0.28);
    g.quadraticCurveTo(C * 0.2, C * 0.14, C * 0.1, C * 0.28); g.quadraticCurveTo(0, C * 0.14, -C * 0.1, C * 0.28); g.quadraticCurveTo(-C * 0.2, C * 0.14, -C * 0.3, C * 0.28); g.closePath();
    const gg = g.createLinearGradient(0, -C * 0.33, 0, C * 0.3); gg.addColorStop(0, '#ffffff'); gg.addColorStop(1, '#bcd6ff');
    g.fillStyle = gg; g.fill(); g.lineWidth = hc ? C * 0.08 : C * 0.05; g.strokeStyle = hc ? '#ffffff' : 'rgba(60,80,140,0.75)'; g.stroke();
    g.fillStyle = '#26324f'; g.beginPath(); oval(g, -C * 0.1, -C * 0.05, C * 0.05, C * 0.075); oval(g, C * 0.1, -C * 0.05, C * 0.05, C * 0.075); oval(g, 0, C * 0.09, C * 0.04, C * 0.05); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.8)'; g.beginPath(); circ(g, -C * 0.115, -C * 0.075, C * 0.018); circ(g, C * 0.085, -C * 0.075, C * 0.018); g.fill();
    return;
  }
  const gold = t === 'gold';                                                         // pomme (rouge ou dorée) : tige, feuille, reflets
  g.beginPath(); g.moveTo(0, -r * 0.62);
  g.bezierCurveTo(r * 0.55, -r * 1.05, r * 1.12, -r * 0.45, r * 0.98, r * 0.22); g.bezierCurveTo(r * 0.88, r * 0.82, r * 0.35, r * 1.0, 0, r * 0.86);
  g.bezierCurveTo(-r * 0.35, r * 1.0, -r * 0.88, r * 0.82, -r * 0.98, r * 0.22); g.bezierCurveTo(-r * 1.12, -r * 0.45, -r * 0.55, -r * 1.05, 0, -r * 0.62); g.closePath();
  const ag = g.createRadialGradient(-r * 0.35, -r * 0.3, r * 0.1, 0, 0, r * 1.1);
  if (gold) { ag.addColorStop(0, '#fff6c4'); ag.addColorStop(0.5, '#ffcf4a'); ag.addColorStop(1, '#b8801a'); } else { ag.addColorStop(0, '#ff8f80'); ag.addColorStop(0.55, '#e8413a'); ag.addColorStop(1, '#9c1d1a'); }
  g.fillStyle = ag; g.fill(); g.lineWidth = hc ? C * 0.08 : C * 0.05; g.strokeStyle = hc ? '#ffffff' : (gold ? '#6b4a00' : '#5a0d0b'); g.stroke();
  g.strokeStyle = gold ? 'rgba(120,80,0,0.45)' : 'rgba(90,10,10,0.45)'; g.lineWidth = C * 0.035; g.beginPath(); g.moveTo(-r * 0.2, -r * 0.62); g.quadraticCurveTo(0, -r * 0.45, r * 0.2, -r * 0.62); g.stroke();   // creux de la queue
  g.strokeStyle = '#5a3a1a'; g.lineWidth = C * 0.07; g.beginPath(); g.moveTo(0, -r * 0.55); g.quadraticCurveTo(r * 0.05, -r * 0.95, r * 0.22, -r * 1.2); g.stroke();   // tige
  g.beginPath(); g.moveTo(r * 0.12, -r * 0.9); g.quadraticCurveTo(r * 0.45, -r * 1.48, r * 0.98, -r * 1.16); g.quadraticCurveTo(r * 0.52, -r * 0.74, r * 0.12, -r * 0.9); g.closePath();
  g.fillStyle = '#5fc36a'; g.fill(); g.strokeStyle = 'rgba(20,70,20,0.7)'; g.lineWidth = C * 0.025; g.stroke();   // feuille + nervure
  g.beginPath(); g.moveTo(r * 0.16, -r * 0.9); g.lineTo(r * 0.8, -r * 1.12); g.stroke();
  g.fillStyle = 'rgba(255,255,255,0.55)'; g.beginPath(); oval(g, -r * 0.44, -r * 0.14, r * 0.17, r * 0.3); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.85)'; g.beginPath(); circ(g, -r * 0.2, -r * 0.46, r * 0.08); g.fill();
}

// rocher moussu (variante Obstacles) : polygone arrondi irrégulier, éclairé du haut-gauche, fissure, mousse
function paintRock(g, x, y, C, seed, hc) {
  const r = rng(seed), n = 8, R = C * 0.47, P = [];
  for (let k = 0; k < n; k++) { const a = k / n * Math.PI * 2 + (r() - 0.5) * 0.55, rr = R * (0.8 + r() * 0.22); P.push(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.92); }
  const shape = (ox, oy) => {
    g.beginPath(); g.moveTo((P[2 * n - 2] + P[0]) / 2 + ox, (P[2 * n - 1] + P[1]) / 2 + oy);
    for (let k = 0; k < n; k++) { const k2 = (k + 1) % n; g.quadraticCurveTo(P[2 * k] + ox, P[2 * k + 1] + oy, (P[2 * k] + P[2 * k2]) / 2 + ox, (P[2 * k + 1] + P[2 * k2 + 1]) / 2 + oy); }
    g.closePath();
  };
  shape(C * 0.1, C * 0.16); g.fillStyle = 'rgba(0,12,0,0.42)'; g.fill();
  shape(0, 0);
  const lg = g.createLinearGradient(x - R, y - R, x + R, y + R); lg.addColorStop(0, '#b3ada2'); lg.addColorStop(0.5, '#7d786f'); lg.addColorStop(1, '#4a463f');
  g.fillStyle = lg; g.fill(); g.lineWidth = hc ? Math.max(1, C * 0.1) : Math.max(0.7, C * 0.07); g.strokeStyle = hc ? '#ffffff' : '#1f1d19'; g.stroke();
  g.fillStyle = 'rgba(255,255,255,0.16)'; g.beginPath(); g.moveTo(x - R * 0.1, y - R * 0.05); g.lineTo(x - R * 0.7, y - R * 0.25); g.lineTo(x - R * 0.25, y - R * 0.72); g.closePath(); g.fill();
  g.strokeStyle = 'rgba(25,22,18,0.7)'; g.lineWidth = Math.max(0.5, C * 0.04); g.beginPath(); g.moveTo(x + R * 0.05, y - R * 0.1); g.lineTo(x + R * 0.3, y + R * 0.15); g.lineTo(x + R * 0.22, y + R * 0.5); g.stroke();
  g.fillStyle = 'rgba(95,160,70,0.8)'; g.beginPath(); for (let k = 0; k < 4; k++) circ(g, x - R * 0.35 + r() * R * 0.4, y - R * 0.5 + r() * R * 0.25, C * (0.05 + r() * 0.05)); g.fill();
}

export default (function () {
  let A, send, root, cv, ctx, togglePanel = () => {}, closePanels = () => {};
  let CC = PAL.normal, TEAMCC = TEAMPAL.normal;
  let mySeat = -1, snap = null, prevGs = 'lobby', teamMode = false, endShown = false, inGamePrev = false, prevRound = -1, lastCount = -1, playSince = 0;
  let rushAlerted = false, duelAlerted = false;   // messages globaux « une seule fois par manche »
  let board = [], buf = [];
  const parts = [], waves = [], floats = [];
  const bulges = {};                                // siège → instants des repas : le renflement descend le long du corps
  let deathCause = {};                              // siège → { k, by } (déduit des 'crash')
  const foodBorn = new Map();                       // case → { born, gen } : apparition « pop » de la nourriture
  let foodGen = 0;
  const headAng = new Float64Array(MAX_SEATS), angSet = new Uint8Array(MAX_SEATS);   // orientation lissée des têtes
  const HX = new Float64Array(MAX_SEATS), HY = new Float64Array(MAX_SEATS), HON = new Uint8Array(MAX_SEATS);
  const HDX = new Int8Array(MAX_SEATS), HDY = new Int8Array(MAX_SEATS), ECHO = creerEcho();   // cap affiché de chaque tête (écho du virage)   // têtes dessinées cette image
  let shakeMag = 0, rafId = 0, destroyed = false, resizeH = null, actx = null, noiseBuf = null, lastFrame = 0, NOW = 0, sndPan = 0, sndGain = 1;
  let rocksRef = null, rocksKey = '';
  // éclairage : flashs éphémères plafonnés + file d'attente (les effets tombent ~90 ms plus tard, avec l'interpolation)
  const LUM = creerLumieres(24), lumPend = [];
  // crépuscule : 0 = plein jour → 1 = nuit tombante ; lissé, gelé en fin de manche
  let dusk = 0, playMs = 0;
  let SC = 1, CSC = 1;                              // pixels (écran réel / CSS) par unité d'arène, mis à jour à chaque image
  // journal de manche (écran de fin) : séries, séries de pommes, festins, arrêts
  const J = creerJournal();
  let jRound = -1, jLast = -1e12;
  const eatLast = new Float64Array(MAX_SEATS), eatRun = new Uint16Array(MAX_SEATS), eatBest = new Uint16Array(MAX_SEATS);
  const feast = new Uint16Array(MAX_SEATS), killsBy = new Uint16Array(MAX_SEATS), lenMax = new Uint16Array(MAX_SEATS);
  const corpse = new Set();                         // cases de nourriture laissées par un serpent mort
  const music = createMusic(() => actx, () => A, MUSIC_THEME);
  let hud, cards, startBtn, pauseBtn, modeBtn, variantBtn, rushBtn, botsBtn, diffBtn, pauseFloat, lbBtn, lbPanel, lbBody, endEl;

  const $ = id => root.querySelector('#' + id);
  const colSeat = s => { if (s < 0 || !snap) return '#fff'; const p = snap.players[s]; return teamMode && p ? TEAMCC[p.team % TEAMCC.length] : CC[s % CC.length]; };   // modulo : jamais de couleur indéfinie si un siège dépasse la palette
  const nameOf = s => { const p = snap && snap.players[s]; return p ? (p.name || ('P' + (s + 1))) : '?'; };
  const px = c => c * CELL + CELL / 2;
  let tints = {};
  function tint(col) {                              // teintes dérivées d'une couleur de siège (contour, reflet), en cache
    let t = tints[col]; if (t) return t;
    const c = hexRgb(col);
    t = { dk: rgbStr(mix(c, [8, 20, 6], 0.55)), lt: rgbStr(mix(c, [255, 255, 240], 0.55)) };
    return (tints[col] = t);
  }
  function applyColors() { CC = PAL[A.palette] || PAL.normal; TEAMCC = TEAMPAL[A.palette] || TEAMPAL.normal; tints = {}; terrainKey = ''; foodSpr = {}; }

  function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const size = arenaSize({ max: 760 });
    cv.style.width = size + 'px'; cv.style.height = size + 'px';
    cv.width = Math.round(size * dpr); cv.height = Math.round(size * dpr);
  }

  // ───────────────────────── HUD, classement, écran de fin ─────────────────────────
  function causeTxt(seat, html) {
    const d = deathCause[seat]; if (!d || !CAUSE_TXT.hasOwnProperty(d.k)) return 'mort';
    if (d.k === 'snake') { const n = nameOf(d.by); return CAUSE_TXT.snake + (html ? esc(n) : n); }
    return CAUSE_TXT[d.k];
  }
  function refreshHUD() {
    if (!snap) return;
    snap.players.forEach((p, i) => {
      if (!cards[i]) return;        // filet : le serveur annonce plus de sièges que de cartes créées
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
      const gly = `<span class="sc" title="motif du siège">${SEAT_GLYPH[i % SEAT_GLYPH.length] || ''}</span>`;   // constante : jamais de texte réseau ici
      cards[i].querySelector('.pn').innerHTML = `${(window.__AV && window.__AV(p.name)) || ''}${gly}${esc(p.name || ('P' + (i + 1)))} <span class="sc">${p.kills | 0} ⚡</span> ${tags.join('')}`;
      const lv = cards[i].querySelector('.lv'); lv.style.color = col;
      lv.textContent = p.playing ? (p.alive ? `● L${p.len} · 🍎${p.score}${p.ghost ? ' · 👻' : ''}` : '✖ ' + causeTxt(i, false)) : 'prêt';
    });
  }
  function renderLB() {
    if (!lbBody) return;
    if (!board.length) { lbBody.innerHTML = '<div class="lbnote">Aucune partie enregistrée (le solo ne compte pas).</div>'; return; }
    const B = board.map(e => ({ ...e, kd: e.deaths ? e.kills / e.deaths : e.kills }));
    lbBody.innerHTML = B.sort((a, b) => b.wins - a.wins || (b.bestScore || 0) - (a.bestScore || 0)).map(e =>
      `<div class="lbrow"><span class="lbn">${esc(e.name)}</span><span>🎮${e.games | 0}</span><span>🏆${e.wins | 0}</span><span title="kills">⚡${e.kills | 0}</span><span title="meilleur score">🍎${e.bestScore || 0}</span><span title="meilleure survie">⏱${Math.round(e.bestSurvivalSec || 0)}s</span></div>`).join('');
  }
  function showEndscreen(m) {
    if (m.gs !== 'over' || !m.stats) { endEl.classList.add('hidden'); return; }
    endEl.classList.remove('hidden');
    const solo = m.stats.solo;
    const parts_ = m.players.filter(p => p.playing && p.place > 0).slice().sort((a, b) => a.place - b.place);
    const champ = m.winner >= 0 ? parts_.find(p => p.team === m.winner) : null;
    const who = champ ? (teamMode ? 'Équipe ' + TEAM_LETTER[m.winner] : esc(champ.name || ('P' + (champ.seat + 1)))) : null;
    const title = solo ? 'Fin de la balade' : (champ ? who + ' règne sur le jardin !' : 'Égalité — le jardin reste sans roi');
    const medals = ['🥇', '🥈', '🥉'];
    // MVP : le plus de serpents qui se sont cognés contre toi (≥ 1), départage au classement
    let mvp = null; parts_.forEach(p => { if ((p.kills | 0) > 0 && (!mvp || p.kills > mvp.kills || (p.kills === mvp.kills && p.place < mvp.place))) mvp = p; });
    const rows = parts_.map(p => {
      const col = colSeat(p.seat), medal = medals[p.place - 1] || ('#' + p.place), sec = Math.round((p.elimTick || 0) / TICK_HZ);
      const res = champ && p.team === champ.team && !solo ? 'vainqueur' : p.alive ? 'survivant·e' : `${causeTxt(p.seat, true)} à ${sec}s`;
      return `<div class="erow ${p.alive ? 'win' : ''}"><span class="eplace">${medal}</span>
        <span class="ename" style="color:${col}">${esc(p.name || ('P' + (p.seat + 1)))}${teamMode ? ` <small>Éq.${TEAM_LETTER[p.team]}</small>` : ''}${mvp && mvp.seat === p.seat ? ' <small>⭐ MVP</small>' : ''}</span>
        <span class="estat" title="longueur">📏 ${p.len | 0}</span><span class="estat" title="pommes">🍎 ${p.score | 0}</span><span class="estat" title="serpents arrêtés">⚡ ${p.kills | 0}</span><span class="eres">${res}</span></div>`;
    }).join('');
    const mvpLine = mvp && !solo ? `<div class="emeta">⭐ MVP : <b style="color:${colSeat(mvp.seat)}">${esc(mvp.name || ('P' + (mvp.seat + 1)))}</b> — ${mvp.kills} serpent${mvp.kills > 1 ? 's' : ''} arrêté${mvp.kills > 1 ? 's' : ''}</div>` : '';
    const fin = blocFin(J, { titre: m.rush ? 'Pommes au fil de la manche' : 'Longueur des serpents', couleur: colSeat, nom: nameOf });   // noms échappés, couleurs filtrées par finpartie.js
    endEl.innerHTML = `<div class="etitle" style="color:${champ ? colSeat(champ.seat) : '#f3ecd2'}">${title}</div>
      <div class="emeta">⏱ ${m.stats.durationSec}s · ${m.stats.nParts} joueur${m.stats.nParts > 1 ? 's' : ''}</div>${mvpLine}<div class="elist">${rows}</div>${fin}<div class="ehint">Espace / clic pour rejouer</div>`;
  }

  // ───────────────────────── état réseau ─────────────────────────
  function onMessage(m) { if (m && m.t === 'welcome') mySeat = m.seat; }
  function onLb(d) { board = (d && d.board) || []; renderLB(); }
  function resetRound() {
    buf = []; parts.length = 0; waves.length = 0; floats.length = 0; rushAlerted = duelAlerted = false;
    for (const k in bulges) delete bulges[k];
    deathCause = {}; foodBorn.clear(); angSet.fill(0);
    LUM.vider(); lumPend.length = 0; playMs = 0; corpse.clear();
    eatLast.fill(0); eatRun.fill(0); eatBest.fill(0); feast.fill(0); killsBy.fill(0); lenMax.fill(0);
  }
  // ── journal de manche : une valeur par serpent (longueur, ou pommes en food-rush) + faits marquants ──
  function jSample(m, now, force) {
    if (!J.actif() || (!force && now - jLast < 1000)) return;
    jLast = now;
    const v = {}, pl = m.players || [];
    for (let i = 0; i < pl.length; i++) {
      const p = pl[i]; if (!p || !p.playing) continue;
      if (p.alive && p.len > lenMax[i]) lenMax[i] = Math.min(65535, p.len | 0);
      v[i] = m.rush ? (p.score | 0) : (p.alive ? (p.len | 0) : 0);   // mort = la courbe retombe
    }
    J.echantillon(now, v, force);
  }
  function jRoundEnd(m, now) {                      // derniers faits (survivant, meneur, plus long serpent) puis on referme
    if (!J.actif()) return;
    jSample(m, now, true);
    const pl = m.players || [];
    let dead = 0, tot = 0; for (let i = 0; i < pl.length; i++) if (pl[i] && pl[i].playing) { tot++; if (!pl[i].alive) dead++; }
    if (tot >= 2 && m.winner >= 0) {
      for (let i = 0; i < pl.length; i++) {
        const p = pl[i]; if (!p || !p.playing || p.team !== m.winner) continue;
        if (m.rush) { if (p.place === 1) J.moment(now, i, 'arrive premier à ' + (p.score | 0) + ' pommes', 4.5); }
        else if (p.alive) J.moment(now, i, teamMode ? "a tenu jusqu'au bout pour l'équipe " + (TEAM_LETTER[p.team] || '?') : 'dernier serpent debout', 2 + 0.3 * dead);
      }
    }
    let bs = -1; for (let i = 0; i < MAX_SEATS; i++) if (lenMax[i] > 0 && (bs < 0 || lenMax[i] > lenMax[bs])) bs = i;
    if (bs >= 0 && lenMax[bs] >= 8) J.moment(now, bs, 'plus long serpent de la manche (' + lenMax[bs] + ' cases)', Math.min(4, 1 + lenMax[bs] / 20));
    J.fin();
  }
  function onState(m) {
    if (m.gw && m.gw !== GW) { GW = m.gw; GH = m.gh || m.gw; CELL = ARENA / GW; }   // grille redimensionnée
    snap = m; teamMode = !!(m.mode && m.mode !== 'ffa');
    if (m.rocks !== rocksRef) { rocksRef = m.rocks; rocksKey = (m.rocks && m.rocks.length) ? m.rocks.join(',') : ''; }   // rochers : figés pendant une manche → cuits dans le décor
    const inGame = m.gs === 'play' || m.gs === 'countdown' || m.gs === 'paused';
    if (inGame !== inGamePrev) { inGamePrev = inGame; document.body.classList.toggle('playing', inGame); resizeCanvas(); }
    document.body.classList.toggle('paused', m.gs === 'paused');
    if (m.gs === 'play' || m.gs === 'countdown') closePanels();
    if (m.round !== prevRound) { prevRound = m.round; resetRound(); }
    if ((m.gs === 'play' || m.gs === 'paused') && jRound !== m.round) { jRound = m.round; J.debut(performance.now()); jLast = -1e12; }   // aussi pour qui arrive en cours de manche
    const prevS = buf.length ? buf[buf.length - 1].s : null;   // instantané précédent : le corps d'un serpent qui vient de mourir
    buf.push({ t: performance.now(), s: m }); if (buf.length > 10) buf.shift();
    const fxs = m.fx || []; let crashed = false;
    for (let i = 0; i < fxs.length; i++) { if (fxs[i] && fxs[i].type === 'crash') crashed = true; playFx(fxs[i], m, prevS); }
    trackFood(m, crashed);
    if (m.gs === 'play') jSample(m, performance.now(), crashed);     // une mort : point forcé, la chute tombe au bon instant
    if (prevGs !== 'over' && m.gs === 'over') { sound('win'); music.sting('win'); jRoundEnd(m, performance.now()); }
    if (m.gs === 'countdown' && m.count > 0 && m.count !== lastCount) { music.sting('count'); sound('count'); }   // décompte 3·2·1
    if (prevGs === 'countdown' && m.gs === 'play') { music.sting('go'); sound('go'); playSince = performance.now(); }
    lastCount = m.count;
    prevGs = m.gs;
    { let inten = 0;                                  // musique : 1 en jeu, 2 = sprint final food-rush ou duel (parmi 3+)
      if (m.gs === 'play' || m.gs === 'countdown') {
        inten = 1;
        if (m.rush) { let lead = 0; m.players.forEach(p => { if (p.playing && p.score > lead) lead = p.score; });
          if (lead >= (m.rushTarget || 20) * 0.7) { inten = 2; if (!rushAlerted) { rushAlerted = true; music.sting('alert'); msgGlobal('🏁', 'Sprint final : cible proche', { color: '#ffd24a' }); } } }   // concerne tout le monde : bande haute, une seule fois par manche
        else { const tot = m.players.filter(p => p.playing).length, alive = m.players.filter(p => p.playing && p.alive).length;
          if (tot >= 3 && alive <= 2) { inten = 2; if (alive === 2 && !duelAlerted) { duelAlerted = true; music.sting('alert'); msgGlobal('⚔', 'Duel final : deux survivants'); } } }
      }
      music.setIntensity(inten); }
    refreshHUD();
    if (m.gs === 'over') { if (!endShown) { showEndscreen(m); endShown = true; } }
    else { endShown = false; endEl.classList.add('hidden'); }
    const idle = m.gs === 'lobby' || m.gs === 'over';
    startBtn.disabled = !(mySeat >= 0 && idle && m.connected >= 1);
    startBtn.textContent = m.gs === 'over' ? '↻ Rejouer' : '▶ Démarrer';
    pauseBtn.disabled = !(m.gs === 'play' || m.gs === 'paused');
    pauseBtn.textContent = m.gs === 'paused' ? '▶ Reprendre' : '⏸ Pause';
    pauseFloat.textContent = m.gs === 'paused' ? '▶' : '⏸';
    const total = m.connected + (m.botCount || 0);
    if (botsBtn) { botsBtn.disabled = !idle; botsBtn.textContent = '🤖 Bots : ' + (m.botCount || 0); botsBtn.classList.toggle('on', (m.botCount || 0) > 0); }
    if (diffBtn) { diffBtn.disabled = !idle; diffBtn.textContent = '🎯 IA : ' + (DIFF_NAMES[m.botDiff] || 'Normale'); }
    modeBtn.disabled = !(idle && TEAM_TOTALS.indexOf(total) >= 0);   // effectifs qui admettent au moins un mode par équipes
    modeBtn.textContent = '⚔ ' + (MODE_NAME[m.mode] || m.mode); modeBtn.classList.toggle('on', teamMode);
    if (variantBtn) { variantBtn.disabled = !idle; variantBtn.textContent = VARIANT_NAMES[m.variant] || VARIANT_NAMES[0]; variantBtn.classList.toggle('on', m.variant > 0); }
    if (rushBtn) { rushBtn.disabled = !idle; rushBtn.textContent = '🏁 ' + (m.rush ? 'Food-rush' : 'Survie'); rushBtn.classList.toggle('on', !!m.rush); }
  }
  // nourriture apparue depuis l'instantané précédent : elle « pousse » (et scintille si c'est le corps d'un serpent mort)
  function trackFood(m, crashed) {
    const list = m.food || [], born = performance.now() + viewDelay(), gen = ++foodGen;
    for (let i = 0; i < list.length; i++) {
      const fd = list[i], k = fd.x + fd.y * 4096, e = foodBorn.get(k);
      if (e) { e.gen = gen; continue; }
      foodBorn.set(k, { born, gen });
      if (crashed) corpse.add(k);                   // restes d'un serpent mort (le journal compte les festins)
      if (crashed && !A.reduceFx) burst(px(fd.x), px(fd.y), 3, { k: K_SPARK, col: '255,236,150', sp: CELL * 0.05, r: CELL * 0.16, life: 700, dl: born - performance.now() + 120, jit: 200 });
    }
    foodBorn.forEach((e, k) => { if (e.gen !== gen) foodBorn.delete(k); });
    if (corpse.size) corpse.forEach(k => { if (!foodBorn.has(k)) corpse.delete(k); });
  }

  // ───────────────────────── sons (WebAudio, zéro fichier) ─────────────────────────
  function unlockAudio() { if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch {} } if (actx && actx.state === 'suspended') actx.resume(); }
  const vol = () => ((A && typeof A.sfx === 'number') ? A.sfx : 1) * sndGain;
  function out(node) { if (sndPan && actx.createStereoPanner) { const pn = actx.createStereoPanner(); pn.pan.value = Math.max(-1, Math.min(1, sndPan)); pn.connect(actx.destination); node.connect(pn); } else node.connect(actx.destination); }
  function tone(f, d, ty = 'square', g = 0.05, dl = 0) { const v = vol(); if (!actx || v <= 0) return; const t0 = actx.currentTime + dl, o = actx.createOscillator(), gg = actx.createGain(); o.type = ty; o.frequency.setValueAtTime(f, t0); gg.gain.setValueAtTime(g * v, t0); gg.gain.exponentialRampToValueAtTime(0.0001, t0 + d); o.connect(gg); out(gg); o.start(t0); o.stop(t0 + d + 0.02); }
  function glide(f0, f1, d, ty, g, dl = 0) {        // note glissée (bloup, gémissement de fantôme, choc sourd, gazouillis)
    const v = vol(); if (!actx || v <= 0) return;
    const t0 = actx.currentTime + dl, o = actx.createOscillator(), gg = actx.createGain();
    o.type = ty; o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(f1, t0 + d);
    gg.gain.setValueAtTime(0.0001, t0); gg.gain.exponentialRampToValueAtTime(g * v, t0 + Math.min(0.02, d * 0.2)); gg.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
    o.connect(gg); out(gg); o.start(t0); o.stop(t0 + d + 0.03);
  }
  function noise(d, type, freq, g, dl = 0, q) {
    const v = vol(); if (!actx || v <= 0) return;
    if (!noiseBuf || noiseBuf.sampleRate !== actx.sampleRate) { const sr = actx.sampleRate, b = actx.createBuffer(1, Math.floor(sr * 1.5), sr), dd = b.getChannelData(0); for (let i = 0; i < dd.length; i++) dd[i] = Math.random() * 2 - 1; noiseBuf = b; }
    const t0 = actx.currentTime + dl, s = actx.createBufferSource(), f = actx.createBiquadFilter(), gg = actx.createGain();
    s.buffer = noiseBuf; f.type = type; f.frequency.value = freq; if (q) f.Q.value = q;
    gg.gain.setValueAtTime(0.0001, t0); gg.gain.exponentialRampToValueAtTime(g * v, t0 + Math.min(0.012, d * 0.2)); gg.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
    s.connect(f); f.connect(gg); out(gg); s.start(t0); s.stop(t0 + d + 0.02);
  }
  function psound(k, gx) { sndPan = Math.max(-1, Math.min(1, (px(gx) / ARENA - 0.5) * 1.7)); sound(k); sndPan = 0; }   // son positionné gauche/droite
  function sound(k) {
    if (!actx) return;
    if (k === 'eat') { noise(0.05, 'bandpass', 2300, 0.1, 0, 1.4); noise(0.035, 'highpass', 3800, 0.06, 0.028); tone(540, 0.06, 'triangle', 0.04, 0.01); tone(810, 0.09, 'triangle', 0.035, 0.05); }   // croc + pincement
    else if (k === 'gold') { tone(1046.5, 0.16, 'triangle', 0.04); tone(1318.5, 0.19, 'triangle', 0.04, 0.055); tone(1568, 0.22, 'triangle', 0.04, 0.11); tone(2093, 0.3, 'sine', 0.03, 0.165); noise(0.25, 'highpass', 7000, 0.03, 0.04); }   // carillon
    else if (k === 'shrink') { glide(640, 170, 0.24, 'sine', 0.09); noise(0.2, 'lowpass', 650, 0.07, 0.03); }   // bloup + pouf de spores
    else if (k === 'ghost') { glide(330, 660, 0.45, 'sine', 0.05); glide(336, 672, 0.45, 'triangle', 0.018, 0.03); tone(990, 0.3, 'sine', 0.012, 0.2); }   // « ouuuh »
    else if (k === 'crash') { glide(170, 46, 0.3, 'sine', 0.15); noise(0.12, 'lowpass', 950, 0.12); noise(0.4, 'highpass', 3600, 0.035, 0.07); }   // choc sourd + sifflement
    else if (k === 'crashMe') { sound('crash'); glide(300, 90, 0.5, 'triangle', 0.05, 0.05); }
    else if (k === 'count') { tone(760, 0.07, 'triangle', 0.055); noise(0.03, 'bandpass', 1900, 0.05, 0, 3); }   // bloc de bois
    else if (k === 'go') { tone(523.25, 0.1, 'triangle', 0.05); tone(783.99, 0.16, 'triangle', 0.05, 0.07); noise(0.34, 'highpass', 4200, 0.045, 0.06); }   // « ssss »
    else if (k === 'win') { tone(523, 0.2, 'triangle', 0.06); tone(659, 0.2, 'triangle', 0.06, 0.12); tone(784, 0.34, 'triangle', 0.06, 0.24); for (let i = 0; i < 3; i++) glide(2300, 3200, 0.07, 'sine', 0.025, 0.5 + i * 0.11); }   // fanfare + merle
  }

  // ───────────────────────── effets ponctuels ─────────────────────────
  // Les événements arrivent avec l'instantané le plus récent, mais le plateau est montré avec ~90 ms de
  // retard (interpolation) : chaque effet est décalé d'autant pour tomber pile quand la tête arrive.
  function viewDelay() { const hz = (snap && snap.shz) || TICK_HZ; return Math.max(INTERP_MS, 1100 / hz); }
  function addPart(q) { if (parts.length >= MAXPART) parts.shift(); parts.push(q); }
  // o : { k, col (chaîne ou tableau ; triplet « r,g,b » pour K_SPARK), sp, r, life, g (gravité), up, dr (frein), dl, jit }
  function burst(x, y, n, o) {
    if (A.reduceFx) return;
    const t0 = performance.now() + (o.dl || 0), cols = o.col;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = (0.35 + Math.random() * 0.65) * o.sp;
      addPart({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (o.up || 0), g: o.g || 0, dr: o.dr || 0.93, born: t0 + Math.random() * (o.jit || 0), life: o.life * (0.7 + Math.random() * 0.6),
        k: o.k, col: typeof cols === 'string' ? cols : cols[(Math.random() * cols.length) | 0], r: o.r * (0.7 + Math.random() * 0.6), rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.3 });
    }
  }
  function wave(x, y, r0, r1, life, css, lw, dl) { if (A.reduceFx) return; if (waves.length > 40) waves.shift(); waves.push({ x, y, r0, r1, born: performance.now() + (dl || 0), life, css, lw }); }
  function crashCause(f, m) {
    if ((m.variant | 0) !== 1 && (f.x < 0 || f.y < 0 || f.x >= GW || f.y >= GH)) return 'wall';
    if (m.rocks && m.rocks.indexOf(f.y * GW + f.x) >= 0) return 'rock';
    if (f.by >= 0 && f.by !== f.seat) return 'snake';
    const fxs = m.fx || [];
    for (let i = 0; i < fxs.length; i++) { const o = fxs[i]; if (o && o !== f && o.type === 'crash' && o.x === f.x && o.y === f.y) return 'head'; }
    return 'self';
  }
  function lumLater(at, x, y, r, col, ms, a) { if (lumPend.length >= 40) lumPend.shift(); lumPend.push({ at, x, y, r, col, ms, a }); }
  // faits marquants du journal (déduits des mêmes événements que les effets ; aucun message réseau en plus)
  function jEat(f, ft, now) {
    const s = f.seat; if (!(s >= 0 && s < MAX_SEATS) || !J.actif()) return;
    eatRun[s] = eatLast[s] && now - eatLast[s] <= 2600 ? eatRun[s] + 1 : 1; eatLast[s] = now;
    if (eatRun[s] >= 4 && eatRun[s] > eatBest[s]) { eatBest[s] = eatRun[s]; J.moment(now, s, 'enchaîne ' + eatRun[s] + ' pommes d\'affilée', 1.5 + eatRun[s] * 0.5); }
    if (ft === 'gold') J.moment(now, s, 'croque une pomme dorée (+3)', 2.2);
    const k = f.x + f.y * 4096;
    if (corpse.has(k)) {
      corpse.delete(k); const n = ++feast[s];
      if (n === 3 || n === 6 || n === 10 || n === 15 || n === 25) J.moment(now, s, 'festin : ' + n + ' restes de serpent dévorés', 1.8 + n * 0.35);
    }
  }
  function jCrash(f, m, cause, now) {
    if (!J.actif()) return;
    const by = f.by | 0;
    if (cause === 'snake' && by >= 0 && by < MAX_SEATS) {
      const n = ++killsBy[by];
      J.moment(now, by, n === 1 ? 'arrête ' + nameOf(f.seat) : 'arrête ' + nameOf(f.seat) + ' (' + n + ' serpents stoppés)', 3 + 1.5 * (n - 1));
    } else if (cause === 'head') {                  // choc frontal : noté une fois, pour le plus petit siège de la paire
      const fxs = m.fx || [];
      for (let i = 0; i < fxs.length; i++) { const o = fxs[i]; if (o && o !== f && o.type === 'crash' && o.x === f.x && o.y === f.y && o.seat > f.seat) { J.moment(now, f.seat, 'choc frontal avec ' + nameOf(o.seat), 2.5); break; } }
    }
  }
  function playFx(f, m, prevS) {
    if (!f) return;
    const now = performance.now(), dl = viewDelay(), C = CELL;
    if (f.type === 'eat') {
      const ft = FOOD_TYPES[f.ft] === 1 ? f.ft : 'apple', mine = f.seat === mySeat;
      if (mine) { psound(ft === 'apple' ? 'eat' : ft, f.x); const fm = FOOD_MSG.hasOwnProperty(ft) ? FOOD_MSG[ft] : null; if (fm) msgPerso(fm.i, fm.t, { color: fm.c }); }   // nourriture spéciale ramassée par MOI : on annonce l'effet (les autres n'en sont pas affectés)
      else if (ft !== 'apple') { sndGain = 0.35; psound(ft, f.x); sndGain = 1; }                                // les nourritures spéciales des autres : en sourdine
      jEat(f, ft, now);
      if (A.reduceFx) return;
      const x = px(f.x), y = px(f.y);
      if (ft === 'gold') lumLater(now + dl, x, y, C * 4.2, '#ffd24a', 700, 0.9);          // la pomme dorée illumine la pelouse
      else if (ft === 'ghost') lumLater(now + dl, x, y, C * 3.6, '#bfe3ff', 620, 0.7);
      else if (ft === 'shrink') lumLater(now + dl, x, y, C * 3, '#ff8aa8', 520, 0.55);
      else lumLater(now + dl, x, y, C * 2, '#ff9a70', 280, 0.32);
      if (f.seat >= 0 && f.seat < MAX_SEATS) { const b = bulges[f.seat] || (bulges[f.seat] = []); b.push(now + dl); if (b.length > 4) b.shift(); }   // renflement de digestion
      if (ft === 'gold') {
        burst(x, y, 12, { k: K_SPARK, col: '255,210,74', sp: C * 0.16, r: C * 0.2, life: 620, dl });
        wave(x, y, C * 0.3, C * 1.6, 440, 'rgb(255,214,90)', 2.2, dl);
        if (floats.length < 12) floats.push({ x, y: y - C * 0.4, txt: '+3', col: '#ffd24a', born: now + dl });
      } else if (ft === 'shrink') {
        burst(x, y, 10, { k: K_SPORE, col: ['#ff9ab0', '#d88cff', '#ffd0e0'], sp: C * 0.05, up: C * 0.03, g: -0.003, dr: 0.96, r: C * 0.1, life: 850, dl });
        waves.push({ x, y, r0: C * 1.6, r1: C * 0.3, born: now + dl, life: 420, css: 'rgb(255,140,160)', lw: 2 });   // onde qui se RESSERRE : on raccourcit
      } else if (ft === 'ghost') {
        burst(x, y, 10, { k: K_SPORE, col: ['#e6f2ff', '#bfe3ff', '#ffffff'], sp: C * 0.05, up: C * 0.04, g: -0.004, dr: 0.96, r: C * 0.12, life: 900, dl });
        burst(x, y, 5, { k: K_SPARK, col: '190,225,255', sp: C * 0.1, r: C * 0.16, life: 520, dl });
        wave(x, y, C * 0.3, C * 1.7, 520, 'rgb(200,228,255)', 2, dl);
      } else {
        burst(x, y, 7, { k: K_DOT, col: ['#ff6a5a', '#ffc2b8', '#e8413a'], sp: C * 0.13, r: C * 0.09, g: 0.02, life: 380, dl });   // jus de pomme
        wave(x, y, C * 0.3, C * 1.0, 280, 'rgb(255,205,195)', 1.4, dl);
      }
      return;
    }
    if (f.type === 'crash') {
      const seat = f.seat, mine = seat === mySeat, cause = crashCause(f, m);
      deathCause[seat] = { k: cause, by: f.by };
      psound(mine ? 'crashMe' : 'crash', f.x); music.sting('kill');
      if (mine) msgPerso('✖', CAUSE_MSG[cause], { bad: true });
      jCrash(f, m, cause, now);
      if (A.reduceFx) return;
      shakeMag = Math.max(shakeMag, mine ? 7 : 3.5);
      const x = Math.max(3, Math.min(ARENA - 3, px(f.x))), y = Math.max(3, Math.min(ARENA - 3, px(f.y))), col = colSeat(seat);
      lumLater(now + dl, x, y, C * 5, '#fff0c8', 520, 0.9);                                  // éclair de l'impact sur l'herbe
      if (cause === 'wall') burst(x, y, 12, { k: K_LEAF, col: ['#3f8a3a', '#5fc36a', '#2a6a2e'], sp: C * 0.15, r: C * 0.24, g: 0.018, dr: 0.94, life: 950, dl });   // la haie perd des feuilles
      else if (cause === 'rock') { burst(x, y, 9, { k: K_CHIP, col: ['#8a857c', '#b3ada2', '#5a564f'], sp: C * 0.17, r: C * 0.16, g: 0.02, life: 700, dl }); burst(x, y, 4, { k: K_SPARK, col: '255,250,230', sp: C * 0.14, r: C * 0.14, life: 300, dl }); }
      else burst(x, y, 8, { k: K_SPARK, col: '255,240,200', sp: C * 0.2, r: C * 0.18, life: 360, dl });   // étoile d'impact
      burst(x, y, 8, { k: K_DOT, col: ['#6b5234', '#8a6a44', '#a3c47a'], sp: C * 0.1, r: C * 0.14, dr: 0.9, life: 520, dl });   // motte de terre
      wave(x, y, C * 0.3, C * 1.9, 400, 'rgb(240,250,220)', 2.4, dl);
      // le corps se défait en écailles et paillettes, de la tête vers la queue (la nourriture qu'il laisse « pousse » ensuite)
      const pp = prevS && prevS.players && prevS.players[seat];
      if (pp && pp.path) {
        const L = loadPath(pp.path, false, 0, 0);
        if (L > 0) {
          const step = Math.max(C * 0.8, L / 36), lstep = Math.max(step, L / 4);           // ≤ 5 lueurs par corps : les éclats éclairent le sol
          let nextL = L;
          for (let d = L; d >= 0; d -= step) {
            pointAt(d, 0); if (!QOK) continue;
            const del = dl + (L - d) / L * 280;
            if (d <= nextL + 1e-6) { nextL = d - lstep; lumLater(now + del, QX, QY, C * 2.6, col, 760, 0.45); }
            burst(QX, QY, 1, { k: K_CHIP, col, sp: C * 0.1, r: C * 0.22, g: 0.012, life: 850, dl: del });
            if (Math.random() < 0.4) burst(QX, QY, 1, { k: K_SPARK, col: '255,220,110', sp: C * 0.06, r: C * 0.15, life: 700, dl: del + 60 });
          }
        }
      }
    }
  }

  // ───────────────────────── interpolation ─────────────────────────
  // Le plateau est montré à « now - délai » : a = instantané juste avant, b = juste après, al ∈ [0,1].
  let VA = null, VB = null, VAL = 0;
  function viewPair(now) {
    if (buf.length === 0) { VA = VB = null; VAL = 0; return; }
    const target = now - viewDelay();
    let a = buf[0], b = buf[buf.length - 1];
    for (let i = 0; i < buf.length; i++) if (buf[i].t <= target) a = buf[i];
    for (let i = buf.length - 1; i >= 0; i--) if (buf[i].t >= target) b = buf[i];
    const span = b.t - a.t; let al = span > 0 ? (target - a.t) / span : 0; al = al < 0 ? 0 : al > 1 ? 1 : al;
    VA = a.s; VB = b.s; VAL = al;
  }

  // ───────────────────────── tracé des corps (tampons réutilisés : aucune allocation par image) ─────────────────────────
  // Le chemin du serveur (sommets de virage, queue → tête, null = coupure de wrap) est converti en pixels ;
  // CUM = abscisse curviligne, BRK = début d'une portion (on relève le crayon). walk(d0, d1) trace le
  // morceau de corps entre deux abscisses : de quoi effiler la queue et poser la tête interpolée.
  const MAXP = 1400, PX = new Float64Array(MAXP * 2), CUM = new Float64Array(MAXP), BRK = new Uint8Array(MAXP);
  let pN = 0, QX = 0, QY = 0, QDX = 1, QDY = 0, QOK = false;
  function addPt(x, y, brk) {
    if (pN >= MAXP) return;
    const i = pN++; PX[2 * i] = x; PX[2 * i + 1] = y;
    if (i === 0) { CUM[0] = 0; BRK[0] = 1; return; }
    BRK[i] = brk ? 1 : 0;
    CUM[i] = CUM[i - 1] + (brk ? 0 : Math.hypot(x - PX[2 * i - 2], y - PX[2 * i - 1]));
  }
  function loadPath(path, hasExt, ex, ey) {
    pN = 0; let brk = true;
    const st = Math.max(0, path.length - (MAXP - 2));
    if (hasExt && st === 0) { addPt(ex, ey, true); brk = false; }
    for (let i = st; i < path.length; i++) { const q = path[i]; if (!q) { brk = true; continue; } addPt(q[0] * CELL + CELL / 2, q[1] * CELL + CELL / 2, brk); brk = false; }
    return pN ? CUM[pN - 1] : 0;
  }
  function walk(d0, d1) {
    let pen = false;
    for (let i = 1; i < pN; i++) {
      if (BRK[i]) { pen = false; continue; }
      const s0 = CUM[i - 1], s1 = CUM[i];
      if (s1 < d0) continue;
      if (s0 > d1) break;
      const x0 = PX[2 * i - 2], y0 = PX[2 * i - 1], x1 = PX[2 * i], y1 = PX[2 * i + 1], len = s1 - s0;
      const ta = len > 0 ? Math.max(0, (d0 - s0) / len) : 0, tb = len > 0 ? Math.min(1, (d1 - s0) / len) : 1;
      if (!pen) { ctx.moveTo(x0 + (x1 - x0) * ta, y0 + (y1 - y0) * ta); pen = true; }
      ctx.lineTo(x0 + (x1 - x0) * tb, y0 + (y1 - y0) * tb);
    }
  }
  function pointAt(d, from) {                       // point (QX,QY) et direction (QDX,QDY) à l'abscisse d, portions à partir de `from`
    QOK = false;
    for (let i = from + 1; i < pN; i++) {
      if (BRK[i]) continue;
      const s0 = CUM[i - 1], s1 = CUM[i], len = s1 - s0;
      if (len <= 0) continue;
      if (d <= s1 + 1e-6) {
        const u = Math.max(0, Math.min(1, (d - s0) / len)), x0 = PX[2 * i - 2], y0 = PX[2 * i - 1], x1 = PX[2 * i], y1 = PX[2 * i + 1];
        QX = x0 + (x1 - x0) * u; QY = y0 + (y1 - y0) * u; QDX = (x1 - x0) / len; QDY = (y1 - y0) / len; QOK = true; return;
      }
    }
  }
  function firstPt(path) { if (path) for (let i = 0; i < path.length; i++) if (path[i]) return path[i]; return null; }

  // ───────────────────────── serpents ─────────────────────────
  const BGX = new Float64Array(4), BGY = new Float64Array(4);
  // Corps : ombre portée, contour, renflements, couleur du siège, motif du siège, rangée d'écailles, reflet
  // du haut-gauche (tube éclairé) ; la queue s'effile en 4 tronçons. Tout est regroupé en ~15 tracés par serpent.
  function drawBody(C, col, seat, hD, alpha, ghost, bl) {
    const T = tint(col), TL = Math.min(C * 2.2, hD * 0.4), wo = C * 0.92, wb = C * 0.72, soft = !A.reduceFx;
    ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    if (alpha < 1) ctx.globalAlpha = alpha;
    if (ghost) { ctx.strokeStyle = 'rgba(200,225,255,0.3)'; ctx.lineWidth = wo + C * 0.45; ctx.beginPath(); walk(0, hD); ctx.stroke(); }   // aura de fantôme
    ctx.save(); ctx.translate(C * 0.1, C * 0.17); ctx.strokeStyle = 'rgba(4,18,4,0.34)'; ctx.lineWidth = wo; ctx.beginPath(); walk(TL * 0.6, hD); ctx.stroke(); ctx.restore();
    let nb = 0;                                                                        // renflements : descendent à ~7 cases/s
    if (bl && bl.length && soft) {
      for (let i = bl.length - 1; i >= 0; i--) {
        const age = NOW - bl[i]; if (age < 0) continue;
        const d = hD - C * 0.6 - age / 1000 * C * 7;
        if (d < TL) { bl.splice(i, 1); continue; }
        pointAt(d, 0); if (!QOK || nb >= 4) continue;
        BGX[nb] = QX; BGY[nb] = QY; nb++;
      }
    }
    ctx.strokeStyle = A.contrast ? '#ffffff' : T.dk;                                  // contour (blanc net en contraste élevé)
    for (let k = 0; k < 4; k++) { ctx.lineWidth = wo * TAPER[k]; ctx.beginPath(); walk(TL * k / 4, TL * (k + 1) / 4 + 0.01); ctx.stroke(); }
    ctx.lineWidth = wo; ctx.beginPath(); walk(TL, hD); ctx.stroke();
    if (nb) { ctx.fillStyle = ctx.strokeStyle; ctx.beginPath(); for (let i = 0; i < nb; i++) circ(ctx, BGX[i], BGY[i], C * 0.6); ctx.fill(); }
    ctx.strokeStyle = col;
    for (let k = 0; k < 4; k++) { ctx.lineWidth = wb * TAPER[k]; ctx.beginPath(); walk(TL * k / 4, TL * (k + 1) / 4 + 0.01); ctx.stroke(); }
    if (nb) { ctx.fillStyle = col; ctx.beginPath(); for (let i = 0; i < nb; i++) circ(ctx, BGX[i], BGY[i], C * 0.49); ctx.fill(); }
    ctx.lineWidth = wb; ctx.beginPath(); walk(TL, hD); ctx.stroke();
    const pat = seat >= 0 ? seatPattern(ctx, seat, { size: Math.round(C * 1.5) }) : null;   // motif du siège (null pour le siège 0)
    if (pat) { ctx.globalAlpha = alpha * 0.8; ctx.strokeStyle = pat; ctx.stroke(); }
    ctx.globalAlpha = alpha * 0.42; ctx.strokeStyle = T.dk; ctx.lineWidth = C * 0.22;  // rangée d'écailles le long de l'échine
    ctx.setLineDash([0.01, C * 0.46]); ctx.stroke(); ctx.setLineDash([]);
    ctx.globalAlpha = alpha * 0.5; ctx.strokeStyle = T.lt; ctx.lineWidth = C * 0.2;   // reflet : la lumière vient du haut-gauche
    ctx.translate(-C * 0.12, -C * 0.14); ctx.beginPath(); walk(TL * 0.7, hD - C * 0.3); ctx.stroke();
    ctx.restore();
  }
  // Tête : ombre, langue fourchue, contour, motif, reflet, narines, yeux (paupière qui cligne, pupille tournée
  // vers la nourriture la plus proche). ang = orientation lissée ; (lx, ly) = direction du regard (unitaire).
  function drawHead(C, x, y, ang, col, seat, alpha, blink, tongue, lx, ly) {
    const T = tint(col), ca = Math.cos(ang), sa = Math.sin(ang);
    ctx.save(); ctx.translate(x, y); if (alpha < 1) ctx.globalAlpha = alpha;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.rotate(ang);
    const sx = C * 0.1, sy = C * 0.17;                                                 // ombre (décalage écran ramené dans le repère tourné)
    ctx.fillStyle = 'rgba(4,18,4,0.34)'; ctx.beginPath(); oval(ctx, C * 0.08 + sx * ca + sy * sa, -sx * sa + sy * ca, C * 0.62, C * 0.5); ctx.fill();
    if (tongue > 0) { const L0 = C * 0.52, L1 = L0 + C * (0.22 + 0.42 * tongue), f = C * 0.16; ctx.strokeStyle = '#e2354f'; ctx.lineWidth = Math.max(0.6, C * 0.075); ctx.beginPath(); ctx.moveTo(L0, 0); ctx.lineTo(L1, 0); ctx.lineTo(L1 + f, -f * 0.8); ctx.moveTo(L1, 0); ctx.lineTo(L1 + f, f * 0.8); ctx.stroke(); }
    ctx.fillStyle = A.contrast ? '#ffffff' : T.dk; ctx.beginPath(); oval(ctx, C * 0.08, 0, C * 0.66, C * 0.53); ctx.fill();
    ctx.fillStyle = col; ctx.beginPath(); oval(ctx, C * 0.08, 0, C * 0.58, C * 0.45); ctx.fill();
    const pat = seat >= 0 ? seatPattern(ctx, seat, { size: Math.round(C * 1.5) }) : null;
    if (pat) { ctx.fillStyle = pat; ctx.fill(); }
    ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.beginPath(); oval(ctx, C * 0.5, 0, C * 0.15, C * 0.28); ctx.fill();   // museau
    ctx.rotate(-ang); ctx.fillStyle = T.lt; ctx.globalAlpha = (alpha < 1 ? alpha : 1) * 0.45; ctx.beginPath(); oval(ctx, -C * 0.14, -C * 0.2, C * 0.2, C * 0.1); ctx.fill(); ctx.rotate(ang);
    ctx.globalAlpha = alpha < 1 ? alpha : 1;
    ctx.fillStyle = T.dk; ctx.beginPath(); circ(ctx, C * 0.54, -C * 0.11, C * 0.04); circ(ctx, C * 0.54, C * 0.11, C * 0.04); ctx.fill();   // narines
    const er = C * 0.17, ex = C * 0.16, ey = C * 0.26, llx = lx * ca + ly * sa, lly = -lx * sa + ly * ca;
    ctx.fillStyle = T.dk; ctx.beginPath(); circ(ctx, ex, -ey, er * 1.25); circ(ctx, ex, ey, er * 1.25); ctx.fill();
    if (blink) { ctx.fillStyle = col; ctx.beginPath(); circ(ctx, ex, -ey, er * 1.02); circ(ctx, ex, ey, er * 1.02); ctx.fill(); ctx.strokeStyle = T.dk; ctx.lineWidth = Math.max(0.5, C * 0.05); ctx.beginPath(); ctx.moveTo(ex - er, -ey); ctx.lineTo(ex + er, -ey); ctx.moveTo(ex - er, ey); ctx.lineTo(ex + er, ey); ctx.stroke(); }
    else {
      ctx.fillStyle = '#fbfff2'; ctx.beginPath(); circ(ctx, ex, -ey, er); circ(ctx, ex, ey, er); ctx.fill();
      const ox = llx * er * 0.42, oy = lly * er * 0.42;
      ctx.fillStyle = '#0e140a'; ctx.beginPath(); circ(ctx, ex + ox, -ey + oy, er * 0.56); circ(ctx, ex + ox, ey + oy, er * 0.56); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.beginPath(); circ(ctx, ex + ox - er * 0.18, -ey + oy - er * 0.18, er * 0.2); circ(ctx, ex + ox - er * 0.18, ey + oy - er * 0.18, er * 0.2); ctx.fill();
    }
    ctx.restore();
  }
  // un serpent vivant : corps de l'instantané b, tête ramenée le long du corps et queue prolongée selon al
  function drawSnake(pa, now, dtm, foods) {
    if (!pa || !pa.playing || !pa.alive || !pa.path) return;
    const seat = pa.seat, pb0 = VB && VB.players ? VB.players[seat] : null;
    const live = !!(pb0 && pb0 !== pa && pb0.playing && pb0.alive && pb0.path);
    const pb = live ? pb0 : pa, al = live ? VAL : 1, path = pb.path, C = CELL, col = colSeat(seat), soft = !A.reduceFx;
    let hasExt = false, ex = 0, ey = 0, trim = 0;
    if (live) {
      const ta = firstPt(pa.path), tb = firstPt(path);
      if (ta && tb) { const dx = ta[0] - tb[0], dy = ta[1] - tb[1], mm = Math.abs(dx) + Math.abs(dy); if (mm > 0 && mm <= 2 && (dx === 0 || dy === 0)) { hasExt = true; ex = (tb[0] + dx * (1 - al)) * C + C / 2; ey = (tb[1] + dy * (1 - al)) * C + C / 2; } }
      if (pa.head && pb.head) { const hx = pb.head.x - pa.head.x, hy = pb.head.y - pa.head.y, hm = Math.abs(hx) + Math.abs(hy); if (hm > 0 && Math.abs(hx) <= 3 && Math.abs(hy) <= 3) trim = (1 - al) * hm * C; }
    }
    const L = loadPath(path, hasExt, ex, ey);
    if (!pN) return;
    let j = pN - 1; while (j > 0 && !BRK[j]) j--;      // début de la dernière portion (après un éventuel wrap)
    trim = Math.max(0, Math.min(trim, CUM[pN - 1] - CUM[j]));
    const hD = L - trim;
    let hx = PX[2 * pN - 2], hy = PX[2 * pN - 1], dx = 0, dy = 0;
    if (pN - 1 > j) { pointAt(hD, j); if (QOK) { hx = QX; hy = QY; dx = QDX; dy = QDY; } }
    if (!dx && !dy) {                               // tête seule après un wrap : direction tirée de la grille
      let q1 = null, q2 = null;
      for (let i = path.length - 1; i >= 0; i--) { const q = path[i]; if (!q) continue; if (!q2) q2 = q; else { q1 = q; break; } }
      if (q1 && q2) { dx = sgn(q2[0] - q1[0]); dy = sgn(q2[1] - q1[1]); }
      if (!dx && !dy) dx = 1;
    }
    const tgt = Math.atan2(dy, dx);
    if (!angSet[seat] || !soft) { headAng[seat] = tgt; angSet[seat] = 1; }
    else { let d = tgt - headAng[seat]; d = Math.atan2(Math.sin(d), Math.cos(d)); headAng[seat] += d * Math.min(1, dtm / 55); }
    const ghost = !!pb.ghost, ga = ghost ? (soft ? 0.5 + 0.2 * Math.sin(now / 110) : 0.55) : 1;
    if (ghost && soft && Math.random() < 0.12 * dtm / 16.7) burst(PX[0], PX[1], 1, { k: K_SPORE, col: '#dcebff', sp: C * 0.02, up: C * 0.02, g: -0.002, dr: 0.97, r: C * 0.14, life: 700 });   // volutes de fantôme
    drawBody(C, col, seat, hD, ga, ghost, bulges[seat]);
    let lx = Math.cos(tgt), ly = Math.sin(tgt), best = 81 * C * C;                    // regard : la nourriture la plus proche (≤ 9 cases)
    for (let i = 0; i < foods.length; i++) { const fd = foods[i], fx = px(fd.x) - hx, fy = px(fd.y) - hy, d2 = fx * fx + fy * fy; if (d2 < best && d2 > 1) { best = d2; lx = fx; ly = fy; } }
    const ll = Math.hypot(lx, ly) || 1, near = best < 6.25 * C * C;
    const tp = (now + seat * 1531) % (near ? 900 : 2600), tongue = soft && tp < 260 ? Math.sin(tp / 260 * Math.PI) : 0;
    const blink = soft && ((now + seat * 977) % 4300) < 130;
    drawHead(C, hx, hy, headAng[seat], col, seat, ga, blink, tongue, lx / ll, ly / ll);
    HX[seat] = hx; HY[seat] = hy; HON[seat] = 1; HDX[seat] = Math.sign(dx); HDY[seat] = Math.sign(dy);
  }
  // repères : « c'est moi » (anneau pulsé + flèche au départ), couronne des vainqueurs en fin de manche
  function drawMarkers(now) {
    const C = CELL, soft = !A.reduceFx, over = snap.gs === 'over', pl = snap.players || [];
    if (over && snap.winner >= 0) {
      for (let s = 0; s < MAX_SEATS; s++) {
        const p = pl[s]; if (!HON[s] || !p || !p.alive || p.team !== snap.winner) continue;
        const x = HX[s], bob = soft ? Math.sin(now / 240 + s) * C * 0.08 : 0, y = HY[s] - C * 0.8 + bob, k = Math.max(4.5, C * 0.55);
        ctx.save(); ctx.strokeStyle = '#ffd24a'; ctx.lineWidth = Math.max(1.4, C * 0.12); ctx.globalAlpha = soft ? 0.5 + 0.4 * Math.sin(now / 180) : 0.85;
        ctx.beginPath(); ctx.arc(HX[s], HY[s], C * 0.9, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1;
        ctx.beginPath(); ctx.moveTo(x - k, y); ctx.lineTo(x - k, y - k * 0.9); ctx.lineTo(x - k * 0.5, y - k * 0.35); ctx.lineTo(x, y - k * 1.1); ctx.lineTo(x + k * 0.5, y - k * 0.35); ctx.lineTo(x + k, y - k * 0.9); ctx.lineTo(x + k, y); ctx.closePath();
        ctx.fillStyle = '#ffd24a'; ctx.fill(); ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(0.8, k * 0.15); ctx.strokeStyle = A.contrast ? '#ffffff' : '#6b4a00'; ctx.stroke();
        ctx.fillStyle = '#e8413a'; ctx.beginPath(); circ(ctx, x, y - k * 0.35, k * 0.16); ctx.fill();
        ctx.restore();
      }
    }
    if (mySeat < 0 || !HON[mySeat] || over) return;
    const x = HX[mySeat], y = HY[mySeat];
    ctx.save(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = Math.max(1.2, C * (A.contrast ? 0.14 : 0.1)); ctx.globalAlpha = soft ? 0.55 + 0.4 * Math.sin(now / 200) : 0.85;
    ctx.beginPath(); ctx.arc(x, y, C * 0.82, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1;
    ECHO.dessiner(ctx, x, y, C, HDX[mySeat], HDY[mySeat], '#ffffff', now, !soft);
    const cd = snap.gs === 'countdown';
    if (cd || (snap.gs === 'play' && now - playSince < 2500)) {                     // flèche : au départ seulement (elle masquerait la case devant soi)
      const k = Math.max(5, C * 0.5), bob = soft ? Math.abs(Math.sin(now / 160)) * C * 0.3 : 0, below = y < C * 2.6, s = below ? -1 : 1;
      const ty = y - s * (C * 0.95 + bob);
      ctx.beginPath(); ctx.moveTo(x - k, ty - s * k * 1.1); ctx.lineTo(x + k, ty - s * k * 1.1); ctx.lineTo(x, ty); ctx.closePath();
      ctx.fillStyle = '#ffe14d'; ctx.fill(); ctx.lineJoin = 'round'; ctx.lineWidth = 1.4; ctx.strokeStyle = '#1d3a12'; ctx.stroke();
      if (cd) { ctx.font = '700 12px ' + DISP; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineWidth = 3; ctx.strokeStyle = '#10200e'; const ly = ty - s * (k * 1.1 + 8); ctx.strokeText('TOI', x, ly); ctx.fillStyle = '#fff4cf'; ctx.fillText('TOI', x, ly); }
    }
    ctx.restore();
  }

  // ───────────────────────── nourriture ─────────────────────────
  let foodSpr = {};                                 // sprites pré-rendus à la résolution réelle (type | taille | contraste)
  function foodSprite(t) {
    const sc = cv.width / ARENA, pxs = Math.max(8, Math.round(CELL * 1.8 * sc)), key = t + '|' + pxs + '|' + (A.contrast ? 1 : 0);
    let c = foodSpr[key]; if (c) return c;
    if (Object.keys(foodSpr).length > 16) foodSpr = {};
    c = document.createElement('canvas'); c.width = c.height = pxs;
    const g = c.getContext('2d'), k = pxs / (CELL * 1.8);
    g.setTransform(k, 0, 0, k, pxs / 2, pxs / 2);
    paintFood(g, t, CELL, A.contrast);
    return (foodSpr[key] = c);
  }
  const glowCache = {};                             // lueurs pré-rendues (remplacent shadowBlur) : une par couleur
  function glow(rgb) {
    let c = glowCache[rgb]; if (c) return c;
    c = document.createElement('canvas'); c.width = c.height = 48;
    const g = c.getContext('2d'), gr = g.createRadialGradient(24, 24, 0, 24, 24, 24);
    gr.addColorStop(0, 'rgba(' + rgb + ',1)'); gr.addColorStop(0.35, 'rgba(' + rgb + ',0.45)'); gr.addColorStop(1, 'rgba(' + rgb + ',0)');
    g.fillStyle = gr; g.fillRect(0, 0, 48, 48);
    return (glowCache[rgb] = c);
  }
  function drawFoods(list, now) {
    const C = CELL, soft = !A.reduceFx;
    for (let i = 0; i < list.length; i++) {
      const fd = list[i], t = FOOD_TYPES[fd.t] === 1 ? fd.t : 'apple';
      const x = px(fd.x); let y = px(fd.y), s = 1;
      if (soft) {
        const e = foodBorn.get(fd.x + fd.y * 4096);
        if (e) { const age = now - e.born; if (age < 0) s = 0; else if (age < 340) s = backOut(age / 340); }   // pousse en rebondissant
        s *= 1 + 0.045 * Math.sin(now / 260 + fd.x * 1.7 + fd.y);
        if (t === 'ghost') y += Math.sin(now / 420 + fd.x) * C * 0.09;
      }
      if (s <= 0.02) continue;
      const gl = FOOD_GLOW[t];
      if (gl) { ctx.globalAlpha = soft ? 0.42 + 0.18 * Math.sin(now / 300 + fd.x) : 0.4; const r = C * 1.05 * s; ctx.drawImage(glow(gl), x - r, y - r, r * 2, r * 2); }
      ctx.globalAlpha = t === 'ghost' ? (soft ? 0.82 + 0.14 * Math.sin(now / 160 + fd.y) : 0.9) : 1;
      const h = C * 0.9 * s; ctx.drawImage(foodSprite(t), x - h, y - h, h * 2, h * 2);
      ctx.globalAlpha = 1;
      if (t === 'gold' && soft) {                   // scintillement de la pomme dorée
        const tw = Math.sin(now / 190 + fd.x * 3 + fd.y);
        if (tw > 0.2) { const k = C * 0.2 * tw, sx = x + C * 0.24, sy = y - C * 0.26; ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = tw; ctx.drawImage(glow('255,240,170'), sx - k * 2, sy - k * 2, k * 4, k * 4);
          ctx.strokeStyle = '#fffbe0'; ctx.lineWidth = Math.max(0.5, C * 0.04); ctx.beginPath(); ctx.moveTo(sx - k * 1.5, sy); ctx.lineTo(sx + k * 1.5, sy); ctx.moveTo(sx, sy - k * 1.5); ctx.lineTo(sx, sy + k * 1.5); ctx.stroke();
          ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; }
      }
    }
  }

  // ───────────────────────── décor statique pré-rendu ─────────────────────────
  // Pelouse, brins, touffes, trèfles, fleurettes, ombres de feuillage, grille, lumière, vignette, bordure et
  // rochers : quelques milliers de tracés cuits une fois dans un canvas hors écran — redessiné seulement si la
  // taille, la grille, la variante, le contraste ou les rochers changent (donc au plus une fois par manche).
  let terrainCv = null, terrainKey = '';
  function tuftPath(g, T, f0, f1) {
    for (let i = 0; i < T.length; i += 3) { const x = T[i], y = T[i + 1], s = T[i + 2]; for (let b = -2; b <= 2; b++) { const a = -Math.PI / 2 + b * 0.32, l = 3.4 * s * (1 - 0.15 * Math.abs(b)); g.moveTo(x + Math.cos(a) * l * f0, y + Math.sin(a) * l * f0); g.lineTo(x + Math.cos(a) * l * f1, y + Math.sin(a) * l * f1); } }
  }
  function paintHedge(g, W, rnd, hc) {             // haie de buis taillée (mur mortel), ombre projetée vers le bas-droite
    const hw = 2.6, D = 10;
    const sh = (x0, y0, x1, y1, a) => { const lg = g.createLinearGradient(x0, y0, x1, y1); lg.addColorStop(0, 'rgba(0,12,0,' + a + ')'); lg.addColorStop(1, 'rgba(0,12,0,0)'); g.fillStyle = lg; };
    sh(0, 0, 0, D, 0.5); g.fillRect(0, 0, W, D);
    sh(0, 0, D, 0, 0.45); g.fillRect(0, 0, D, W);
    sh(W, 0, W - D, 0, 0.22); g.fillRect(W - D, 0, D, W);
    sh(0, W, 0, W - D, 0.22); g.fillRect(0, W - D, W, D);
    g.fillStyle = '#0d2c0f'; g.fillRect(0, 0, W, hw); g.fillRect(0, W - hw, W, hw); g.fillRect(0, 0, hw, W); g.fillRect(W - hw, 0, hw, W);
    const P = []; for (let s = 1.5; s < W; s += 3.1) P.push(s + rnd() * 0.8, hw - 0.3, 1.1 + rnd() * 0.6);
    const LAY = [['#123d15', 0, 1], ['#1f5e25', -0.35, 0.68], ['#3f8a3a', -0.6, 0.32]];   // feuillage : base, relief, reflets (haut-gauche)
    for (let l = 0; l < LAY.length; l++) {
      const o = LAY[l][1], m = LAY[l][2]; g.fillStyle = LAY[l][0]; g.beginPath();
      for (let i = 0; i < P.length; i += 3) { const s = P[i], d = P[i + 1], r = P[i + 2] * m; circ(g, s + o, d + o, r); circ(g, s + o, W - d + o, r); circ(g, d + o, s + o, r); circ(g, W - d + o, s + o, r); }
      g.fill();
    }
    g.strokeStyle = '#041004'; g.lineWidth = 1.2; g.strokeRect(0.6, 0.6, W - 1.2, W - 1.2);
    if (hc) { g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 1; g.strokeRect(hw, hw, W - 2 * hw, W - 2 * hw); }
  }
  function paintGravel(g, W, rnd, hc) {            // allée de gravier (murs traversants) : lueur de passage + chevrons « on ressort en face »
    const bw = 2.8, D = 9;
    const sh = (x0, y0, x1, y1) => { const lg = g.createLinearGradient(x0, y0, x1, y1); lg.addColorStop(0, 'rgba(150,230,255,0.13)'); lg.addColorStop(1, 'rgba(150,230,255,0)'); g.fillStyle = lg; };
    sh(0, 0, 0, D); g.fillRect(0, 0, W, D); sh(0, W, 0, W - D); g.fillRect(0, W - D, W, D); sh(0, 0, D, 0); g.fillRect(0, 0, D, W); sh(W, 0, W - D, 0); g.fillRect(W - D, 0, D, W);
    g.fillStyle = 'rgba(200,190,155,0.34)'; g.fillRect(0, 0, W, bw); g.fillRect(0, W - bw, W, bw); g.fillRect(0, 0, bw, W); g.fillRect(W - bw, 0, bw, W);
    for (let c = 0; c < 2; c++) {
      g.fillStyle = c ? 'rgba(90,80,60,0.45)' : 'rgba(240,232,205,0.5)'; g.beginPath();
      for (let k = 0; k < 360; k++) { const u = rnd() * W, d = rnd() * bw, side = (rnd() * 4) | 0, x = side === 0 ? u : side === 1 ? u : side === 2 ? d : W - d, y = side === 0 ? d : side === 1 ? W - d : u; circ(g, x, y, 0.35 + rnd() * 0.3); }
      g.fill();
    }
    g.strokeStyle = hc ? 'rgba(210,248,255,0.95)' : 'rgba(170,235,255,0.6)'; g.lineWidth = hc ? 1.6 : 1.3; g.beginPath();
    for (const u of [0.25, 0.5, 0.75]) {
      const m = u * W;
      for (const o of [0, 2.2]) {
        g.moveTo(m - 2.4, 6.2 + o); g.lineTo(m, 3.8 + o); g.lineTo(m + 2.4, 6.2 + o);                       // haut : vers le haut
        g.moveTo(m - 2.4, W - 6.2 - o); g.lineTo(m, W - 3.8 - o); g.lineTo(m + 2.4, W - 6.2 - o);           // bas
        g.moveTo(6.2 + o, m - 2.4); g.lineTo(3.8 + o, m); g.lineTo(6.2 + o, m + 2.4);                       // gauche
        g.moveTo(W - 6.2 - o, m - 2.4); g.lineTo(W - 3.8 - o, m); g.lineTo(W - 6.2 - o, m + 2.4);           // droite
      }
    }
    g.stroke();
  }
  function ensureTerrain() {
    const vr = snap ? (snap.variant | 0) : 0, hc = A.contrast ? 1 : 0;
    const key = cv.width + '|' + GW + '|' + vr + '|' + hc + '|' + rocksKey;
    if (terrainCv && key === terrainKey) return;
    terrainKey = key;
    if (!terrainCv) terrainCv = document.createElement('canvas');
    terrainCv.width = cv.width; terrainCv.height = cv.height;
    const g = terrainCv.getContext('2d'), W = ARENA, C = CELL, rnd = rng(0x6a7d + GW * 31);
    g.setTransform(cv.width / W, 0, 0, cv.width / W, 0, 0);
    g.lineCap = 'round'; g.lineJoin = 'round';
    // 1) damier de pelouse (il donne la grille à lire), chaque case légèrement nuancée
    const A1 = [29, 59, 24], A2 = [36, 75, 30], LI = [80, 130, 55], DA = [10, 30, 8];
    for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) {
      const v = hash2(gx, gy) - 0.5, b = ((gx + gy) & 1) ? A1 : A2;
      g.fillStyle = rgbStr(mix(b, v > 0 ? LI : DA, Math.abs(v) * 0.16));
      g.fillRect(gx * C, gy * C, C + 0.4, C + 0.4);
    }
    // 2) bandes de tonte
    g.fillStyle = 'rgba(210,255,170,0.028)'; for (let x = 0; x < GW; x += 6) g.fillRect(x * C, 0, 3 * C, W);
    // 3) ombres de feuillage et taches de soleil
    const blob = (x, y, r, rgb, a) => { const rg = g.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, 'rgba(' + rgb + ',' + a + ')'); rg.addColorStop(1, 'rgba(' + rgb + ',0)'); g.fillStyle = rg; g.fillRect(x - r, y - r, r * 2, r * 2); };
    for (let k = 0; k < 8; k++) blob(rnd() * W, rnd() * W, W * (0.08 + rnd() * 0.12), '0,16,0', 0.2);
    for (let k = 0; k < 5; k++) blob(rnd() * W, rnd() * W, W * (0.05 + rnd() * 0.07), '255,245,190', 0.05);
    // 4) brins d'herbe : 3 teintes, 3 tracés
    const nBl = Math.round(W * W / 60), BL = ['rgba(150,215,110,0.2)', 'rgba(6,26,5,0.34)', 'rgba(120,190,85,0.15)'];
    g.lineWidth = 0.7;
    for (let c = 0; c < 3; c++) { g.strokeStyle = BL[c]; g.beginPath(); for (let k = 0; k < nBl / 3; k++) { const x = rnd() * W, y = rnd() * W, l = 1.3 + rnd() * 2.2, a = -Math.PI / 2 + (rnd() - 0.5) * 1.0; g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); } g.stroke(); }
    // 5) touffes : base sombre, pointes claires
    const TF = []; for (let k = 0; k < 70; k++) TF.push(rnd() * W, rnd() * W, 0.8 + rnd() * 0.6);
    g.lineWidth = 0.9; g.strokeStyle = 'rgba(8,30,6,0.45)'; g.beginPath(); tuftPath(g, TF, 0, 1); g.stroke();
    g.lineWidth = 0.6; g.strokeStyle = 'rgba(170,230,120,0.32)'; g.beginPath(); tuftPath(g, TF, 0.5, 1); g.stroke();
    // 6) trèfles
    g.fillStyle = 'rgba(70,140,60,0.3)'; g.beginPath();
    for (let k = 0; k < 30; k++) { const x = rnd() * W, y = rnd() * W, s = 0.9 + rnd() * 0.6, a0 = rnd() * 6.28; for (let l = 0; l < 3; l++) { const a = a0 + l * 2.094; circ(g, x + Math.cos(a) * 1.1 * s, y + Math.sin(a) * 1.1 * s, 1.1 * s); } }
    g.fill();
    // 7) fleurettes (pâquerettes, myosotis) : petites et translucides, jamais confondues avec la nourriture
    const FL = []; for (let k = 0; k < 30; k++) FL.push(rnd() * W, rnd() * W, 0.8 + rnd() * 0.5);
    for (let c = 0; c < 2; c++) {
      g.fillStyle = c ? 'rgba(156,200,255,0.4)' : 'rgba(240,248,232,0.42)'; g.beginPath();
      for (let i = c * 54; i < (c ? FL.length : 54); i += 3) { const x = FL[i], y = FL[i + 1], s = FL[i + 2]; for (let p = 0; p < 5; p++) { const a = p * 1.2566; circ(g, x + Math.cos(a) * 1.3 * s, y + Math.sin(a) * 1.3 * s, 0.8 * s); } }
      g.fill();
    }
    g.fillStyle = 'rgba(255,226,120,0.55)'; g.beginPath(); for (let i = 0; i < FL.length; i += 3) circ(g, FL[i], FL[i + 1], 0.6 * FL[i + 2]); g.fill();
    // 8) grille légère toutes les 5 cases (chaque case en contraste élevé)
    if (hc) { g.strokeStyle = 'rgba(255,255,255,0.09)'; g.lineWidth = 0.6; g.beginPath(); for (let i = 1; i < GW; i++) { g.moveTo(i * C, 0); g.lineTo(i * C, W); g.moveTo(0, i * C); g.lineTo(W, i * C); } g.stroke(); }
    g.strokeStyle = hc ? 'rgba(255,255,255,0.22)' : 'rgba(170,255,150,0.05)'; g.lineWidth = hc ? 1 : 0.8; g.beginPath();
    for (let i = 5; i < GW; i += 5) { g.moveTo(i * C, 0); g.lineTo(i * C, W); g.moveTo(0, i * C); g.lineTo(W, i * C); }
    g.stroke();
    // 9) lumière rasante du haut-gauche + vignette
    const lg = g.createLinearGradient(0, 0, W, W); lg.addColorStop(0, 'rgba(255,240,180,0.07)'); lg.addColorStop(0.5, 'rgba(255,240,180,0)'); lg.addColorStop(1, 'rgba(0,10,0,0.14)');
    g.fillStyle = lg; g.fillRect(0, 0, W, W);
    const vg = g.createRadialGradient(W / 2, W / 2, W * 0.32, W / 2, W / 2, W * 0.74); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,12,0,0.42)');
    g.fillStyle = vg; g.fillRect(0, 0, W, W);
    // 10) bordure : haie (mur mortel) ou allée de gravier (on la traverse)
    if (vr === 1) paintGravel(g, W, rnd, hc); else paintHedge(g, W, rnd, hc);
    // 11) rochers (variante Obstacles)
    if (rocksRef && rocksRef.length) for (let i = 0; i < rocksRef.length; i++) { const ix = rocksRef[i] | 0, gx = ix % GW, gy = (ix / GW) | 0; paintRock(g, gx * C + C / 2, gy * C + C / 2, C, (ix * 2654435761) >>> 0, hc); }
  }
  // murs traversants : pointillé lumineux qui file le long du bord (figé en « réduire les effets »)
  function drawPortal(now) {
    ctx.save(); ctx.strokeStyle = 'rgba(150,230,255,0.16)'; ctx.lineWidth = 5; ctx.strokeRect(2.5, 2.5, ARENA - 5, ARENA - 5);
    ctx.setLineDash([7, 7]); ctx.lineDashOffset = A.reduceFx ? 0 : -now / 45; ctx.strokeStyle = A.contrast ? 'rgba(210,248,255,0.95)' : 'rgba(170,235,255,0.6)'; ctx.lineWidth = 1.6;
    ctx.strokeRect(1.5, 1.5, ARENA - 3, ARENA - 3); ctx.setLineDash([]); ctx.restore();
  }

  // ───────────────────────── ambiance : pétales, papillons, lucioles ─────────────────────────
  function drawAmbient(now) {
    const t = now / 1000;
    ctx.save();
    ctx.fillStyle = '#ffb7d0'; ctx.globalAlpha = 0.22;
    for (let i = 0; i < AMB_PETAL.length; i++) { const pe = AMB_PETAL[i], y = (pe.ph * 90 + t * pe.v) % (ARENA + 12) - 6, x = pe.x * ARENA + Math.sin(t / 1.3 + pe.ph) * 14; ctx.save(); ctx.translate(x, y); ctx.rotate(t / 0.9 + pe.ph); ctx.beginPath(); oval(ctx, 0, 0, pe.s, pe.s * 0.55); ctx.fill(); ctx.restore(); }
    for (let i = 0; i < BUTTERFLIES.length; i++) {
      const b = BUTTERFLIES[i], w = 4.2;
      const x = ARENA * (0.5 + 0.42 * Math.sin(t * b.sx + b.ph)), y = ARENA * (0.5 + 0.38 * Math.sin(t * b.sy + b.ph * 1.7)) + Math.sin(t * 3 + b.ph) * 4;
      const ang = Math.atan2(0.38 * b.sy * Math.cos(t * b.sy + b.ph * 1.7), 0.42 * b.sx * Math.cos(t * b.sx + b.ph)) + Math.PI / 2, fl = 0.25 + 0.75 * Math.abs(Math.sin(t * 13 + b.ph));
      ctx.globalAlpha = 0.14; ctx.fillStyle = '#000'; ctx.beginPath(); circ(ctx, x + 4, y + 7, w * 0.7 * fl + 0.6); ctx.fill();   // ombre au sol
      ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.globalAlpha = 0.78;
      ctx.fillStyle = b.c; ctx.beginPath();
      for (const s of [-1, 1]) { oval(ctx, s * w * 0.55 * fl, -w * 0.2, w * 0.55 * fl, w * 0.5); oval(ctx, s * w * 0.4 * fl, w * 0.35, w * 0.38 * fl, w * 0.34); }
      ctx.fill();
      ctx.fillStyle = b.d; ctx.beginPath(); for (const s of [-1, 1]) circ(ctx, s * w * 0.6 * fl, -w * 0.25, w * 0.13); ctx.fill();
      ctx.fillStyle = '#2a2418'; ctx.beginPath(); oval(ctx, 0, 0, w * 0.12, w * 0.55); ctx.fill();
      ctx.strokeStyle = '#2a2418'; ctx.lineWidth = 0.5; ctx.beginPath(); ctx.moveTo(0, -w * 0.5); ctx.lineTo(-w * 0.3, -w * 0.95); ctx.moveTo(0, -w * 0.5); ctx.lineTo(w * 0.3, -w * 0.95); ctx.stroke();
      ctx.restore();
    }
    ctx.globalCompositeOperation = 'lighter';
    const spr = glow('216,255,154');
    for (let i = 0; i < AMB_FLY.length; i++) { const f = AMB_FLY[i], x = f.x * ARENA + Math.sin(t / 2.2 + f.ph) * 26, y = f.y * ARENA + Math.cos(t / 1.9 + f.ph * 1.7) * 20, gl = 0.5 + 0.5 * Math.sin(t / 0.65 + f.ph), r = (f.r + gl) * 3.2; ctx.globalAlpha = 0.12 + 0.3 * gl; ctx.drawImage(spr, x - r, y - r, r * 2, r * 2); }
    ctx.restore();
  }

  // ───────────────────────── éclairage dynamique (après le sol, avant les pièces) ─────────────────────────
  // Sources permanentes (pommes spéciales, serpents fantômes, lucioles et pommes qui luisent à la brune) +
  // flashs éphémères (repas, impacts, éclats du corps). Sprites pré-rendus en additif : aucun dégradé par image.
  function drawLights(now, S) {
    if (A.reduceFx) { lumPend.length = 0; LUM.vider(); return; }
    const C = CELL, boost = 1 + 0.6 * dusk;         // à la tombée du jour, les lueurs portent davantage
    for (let i = 0; i < lumPend.length; i++) { const q = lumPend[i]; if (now >= q.at) { LUM.ajouter(q.x, q.y, q.r, q.col, q.ms, q.a * boost); lumPend.splice(i, 1); i--; } }
    if (S) {
      const foods = S.food || [];
      for (let i = 0; i < foods.length; i++) {
        const fd = foods[i], t = fd.t, x = px(fd.x), y = px(fd.y);
        if (t === 'gold') lumiere(ctx, x, y, C * 2.6, '#ffd24a', (0.3 + 0.08 * Math.sin(now / 300 + fd.x)) * boost);
        else if (t === 'ghost') lumiere(ctx, x, y, C * 2.2, '#bfe3ff', 0.22 * boost);
        else if (t === 'shrink') lumiere(ctx, x, y, C * 1.8, '#ff8aa8', 0.14 * boost);
        else if (dusk > 0.15) lumiere(ctx, x, y, C * 1.3, '#ff7a5a', 0.16 * dusk);   // pommes qui luisent à la brune
      }
      const pl = S.players || [];                   // têtes de l'image précédente : un décalage d'une image, invisible
      for (let s = 0; s < pl.length && s < MAX_SEATS; s++) { const p = pl[s]; if (p && p.alive && p.ghost && HON[s]) lumiere(ctx, HX[s], HY[s], C * 3, '#cfe6ff', (0.2 + 0.06 * Math.sin(now / 110 + s)) * boost); }
    }
    if (dusk > 0.05) {                              // les lucioles éclairent l'herbe quand le jour baisse
      const t = now / 1000;
      for (let i = 0; i < AMB_FLY.length; i++) { const f = AMB_FLY[i], gl = 0.5 + 0.5 * Math.sin(t / 0.65 + f.ph); lumiere(ctx, f.x * ARENA + Math.sin(t / 2.2 + f.ph) * 26, f.y * ARENA + Math.cos(t / 1.9 + f.ph * 1.7) * 20, 18, '#d8ff9a', 0.2 * dusk * gl); }
    }
    LUM.dessiner(ctx, now);
  }
  // crépuscule : survie → part des serpents tombés (duel final = soir), food-rush → approche de la cible,
  // et une manche qui s'éternise voit le soleil baisser. Plafonné à 0.85 : serpents et nourriture restent nets.
  function updateDusk(dtm) {
    const gs = snap ? snap.gs : 'lobby';
    if (gs === 'play') playMs += dtm;
    if (gs === 'over') return;                      // gelé : l'écran de fin garde la lumière du dénouement
    let tgt = 0;
    if (gs === 'play' || gs === 'paused') {
      const pl = snap.players || []; let tot = 0, alive = 0, lead = 0;
      for (let i = 0; i < pl.length; i++) { const p = pl[i]; if (!p || !p.playing) continue; tot++; if (p.alive) alive++; if (p.score > lead) lead = p.score; }
      const te = (playMs / 1000 - 45) / 150;
      if (snap.rush) tgt = Math.max(te, (lead / (snap.rushTarget || 20) - 0.4) / 0.6);
      else if (tot >= 2) { tgt = Math.max(te, (tot - alive) / (tot - 1)); if (tot >= 3 && alive <= 2) tgt = Math.max(tgt, 0.72); }
      else tgt = te;
      tgt = tgt < 0 ? 0 : tgt > 0.85 ? 0.85 : tgt;
    }
    tgt = Math.max(tgt, Math.min(0.9, DUEL.t(snap, performance.now(), null)));   // duel final (annonce déjà faite par Snake)
    dusk += (tgt - dusk) * Math.min(1, dtm / (tgt < dusk ? 500 : 1600));
    if (dusk < 0.002) dusk = 0;
  }

  // ───────────────────────── particules, ondes, textes flottants ─────────────────────────
  function drawFx(now, kdt) {
    if (A.reduceFx) { parts.length = 0; waves.length = 0; floats.length = 0; return; }
    ctx.save(); ctx.lineCap = 'round';
    for (let i = waves.length - 1; i >= 0; i--) {
      const q = waves[i], t = (now - q.born) / q.life; if (t >= 1) { waves.splice(i, 1); continue; } if (t < 0) continue;
      const e = 1 - (1 - t) * (1 - t); ctx.globalAlpha = 0.7 * (1 - t); ctx.strokeStyle = q.css; ctx.lineWidth = q.lw * (1 - t * 0.6);
      ctx.beginPath(); ctx.arc(q.x, q.y, Math.max(0.1, q.r0 + (q.r1 - q.r0) * e), 0, Math.PI * 2); ctx.stroke();
    }
    let nSpark = 0;
    for (let i = parts.length - 1; i >= 0; i--) {
      const q = parts[i], t = (now - q.born) / q.life;
      if (t >= 1) { parts.splice(i, 1); continue; }
      if (t < 0) continue;
      const dr = Math.pow(q.dr, kdt); q.vx *= dr; q.vy *= dr; q.vy += q.g * kdt; q.x += q.vx * kdt; q.y += q.vy * kdt; q.rot += q.vr * kdt;
      if (q.k === K_SPARK) { nSpark++; continue; }
      const a = t < 0.6 ? 1 : (1 - t) / 0.4;
      ctx.globalAlpha = q.k === K_SPORE ? a * 0.55 : a; ctx.fillStyle = q.col; ctx.beginPath();
      if (q.k === K_DOT || q.k === K_SPORE) ctx.arc(q.x, q.y, q.r * (q.k === K_SPORE ? 1 + t : 1 - 0.5 * t), 0, Math.PI * 2);
      else {                                        // écaille (losange) ou feuille (amande), orientée
        const c = Math.cos(q.rot), s = Math.sin(q.rot), L = q.r, W2 = q.r * (q.k === K_LEAF ? 0.45 : 0.62);
        const ax = q.x + c * L, ay = q.y + s * L, bx = q.x - c * L, by = q.y - s * L, nx = -s * W2, ny = c * W2;
        ctx.moveTo(ax, ay);
        if (q.k === K_LEAF) { ctx.quadraticCurveTo(q.x + nx * 2, q.y + ny * 2, bx, by); ctx.quadraticCurveTo(q.x - nx * 2, q.y - ny * 2, ax, ay); }
        else { ctx.lineTo(q.x + nx, q.y + ny); ctx.lineTo(bx, by); ctx.lineTo(q.x - nx, q.y - ny); ctx.closePath(); }
      }
      ctx.fill();
    }
    if (nSpark) {                                   // paillettes : lueur pré-rendue en additif + croix fine
      ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = '#fffbe8'; ctx.lineWidth = 0.6;
      for (let i = 0; i < parts.length; i++) {
        const q = parts[i]; if (q.k !== K_SPARK) continue; const t = (now - q.born) / q.life; if (t < 0 || t >= 1) continue;
        const s = q.r * (1.2 - 0.6 * t) * (0.8 + 0.4 * Math.sin(now / 40 + q.rot * 5));
        ctx.globalAlpha = (1 - t) * 0.9; ctx.drawImage(glow(q.col), q.x - s * 2.2, q.y - s * 2.2, s * 4.4, s * 4.4);
        ctx.beginPath(); ctx.moveTo(q.x - s * 1.6, q.y); ctx.lineTo(q.x + s * 1.6, q.y); ctx.moveTo(q.x, q.y - s * 1.6); ctx.lineTo(q.x, q.y + s * 1.6); ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    if (floats.length) {
      ctx.font = '700 13px ' + DISP; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round'; ctx.lineWidth = 3; ctx.strokeStyle = '#2a1a00';
      for (let i = floats.length - 1; i >= 0; i--) {
        const q = floats[i], t = (now - q.born) / 900; if (t >= 1) { floats.splice(i, 1); continue; } if (t < 0) continue;
        const y = q.y - 16 * (1 - (1 - t) * (1 - t)); ctx.globalAlpha = t < 0.7 ? 1 : (1 - t) / 0.3;
        ctx.strokeText(q.txt, q.x, y); ctx.fillStyle = q.col; ctx.fillText(q.txt, q.x, y);
      }
    }
    ctx.restore();
  }

  // ───────────────────────── panneaux de bois (lobby, pause, food-rush) ─────────────────────────
  function plank(x, y, w, h, a) {
    ctx.save(); if (a != null) ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(0,8,0,0.35)'; rrect(ctx, x + 3, y + 4, w, h, 5); ctx.fill();
    const lg = ctx.createLinearGradient(0, y, 0, y + h); lg.addColorStop(0, '#9b7145'); lg.addColorStop(0.5, '#7b5431'); lg.addColorStop(1, '#5a3b1f');
    rrect(ctx, x, y, w, h, 5); ctx.fillStyle = lg; ctx.fill();
    ctx.lineWidth = A.contrast ? 2 : 1.4; ctx.strokeStyle = A.contrast ? '#ffffff' : '#2b1a0b'; ctx.stroke();
    ctx.strokeStyle = 'rgba(45,26,10,0.35)'; ctx.lineWidth = 0.8; ctx.beginPath();          // veinage
    for (let k = 1; k <= 3; k++) { const yy = y + h * k / 4; ctx.moveTo(x + 6, yy); for (let s = 1; s <= 6; s++) ctx.lineTo(x + 6 + (w - 12) * s / 6, yy + Math.sin(s * 1.7 + k * 2.1) * 1.2); }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,225,170,0.28)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x + 5, y + 1.5); ctx.lineTo(x + w - 5, y + 1.5); ctx.stroke();
    ctx.fillStyle = '#d8cfb6'; ctx.beginPath(); circ(ctx, x + 5, y + h / 2, 1.6); circ(ctx, x + w - 5, y + h / 2, 1.6); ctx.fill();   // clous
    ctx.restore();
  }
  function label(txt, x, y, font, col) { ctx.font = font; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(30,16,6,0.75)'; ctx.strokeText(txt, x, y); ctx.fillStyle = col; ctx.fillText(txt, x, y); }
  function drawRush() {                             // food-rush : progression du meneur sur une planchette (s'efface si une tête passe dessous)
    const pl = snap.players || []; let lead = 0;
    for (let i = 0; i < pl.length; i++) { const p = pl[i]; if (p && p.playing && p.score > lead) lead = p.score; }
    const tgt = snap.rushTarget || 20, w = 176, h = 20, x = ARENA / 2 - w / 2, y = 5;
    let a = 0.94; for (let s = 0; s < MAX_SEATS; s++) if (HON[s] && HY[s] < y + h + CELL * 1.5 && HX[s] > x - CELL && HX[s] < x + w + CELL) { a = 0.32; break; }
    plank(x, y, w, h, a);
    ctx.save(); ctx.globalAlpha = a;
    ctx.save(); ctx.translate(x + 17, y + h / 2 + 1); paintFood(ctx, 'apple', 15, false); ctx.restore();
    const bx = x + 30, bw = w - 30 - 52, by = y + h / 2 - 3.5, u = Math.max(0, Math.min(1, lead / tgt));
    ctx.fillStyle = 'rgba(20,10,4,0.55)'; ctx.fillRect(bx, by, bw, 7);
    ctx.fillStyle = u >= 0.7 ? '#ffd24a' : '#8fd14f'; ctx.fillRect(bx, by, bw * u, 7);
    ctx.strokeStyle = 'rgba(255,240,200,0.5)'; ctx.lineWidth = 0.8; ctx.strokeRect(bx + 0.4, by + 0.4, bw - 0.8, 6.2);
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff4cf'; ctx.font = '700 12px ' + DISP; ctx.fillText(lead + ' / ' + tgt, x + w - 9, y + h / 2 + 1);
    ctx.restore();
  }

  // ───────────────────────── écran titre : « SNAKE » posé sur un serpent qui ondule vers une pomme ─────────────────────────
  const TITLE = 'SNAKE';
  let titleLay = null;                              // mesures du logo : recalculées de loin en loin (police Google chargée tard)
  function layoutTitle(now) {
    let fs = Math.min(38, ARENA * 0.08);
    const ws = [];
    let total = 0;
    for (let pass = 0; pass < 4; pass++) {          // réduit la police tant que le mot + le serpent + la pomme dépassent l'arène (mobile)
      ctx.font = '700 ' + fs.toFixed(1) + 'px ' + DISP;
      ws.length = 0; total = 0;
      for (let i = 0; i < TITLE.length; i++) { const cw = ctx.measureText(TITLE.charAt(i)).width; ws.push(cw); total += cw; }
      total += fs * 0.06 * (TITLE.length - 1);
      if (total + fs * 3.4 <= ARENA * 0.94 || fs <= 14) break;
      fs = Math.max(14, fs * (ARENA * 0.94) / (total + fs * 3.4));
    }
    return { at: now, fs, ws, total };
  }
  function drawTitle(cx, cy, now) {
    if (!titleLay || now - titleLay.at > 600) titleLay = layoutTitle(now);
    const fs = titleLay.fs, ws = titleLay.ws, total = titleLay.total, n = TITLE.length;
    const soft = !A.reduceFx, t = soft ? now / 1000 : 0, amp = soft ? fs * 0.1 : 0;
    const x0 = cx - total / 2, gap = fs * 0.06, sx = x0 - fs * 0.7, sw = total + fs * 1.35;
    const wave_ = u => Math.sin(t * 1.4 - u * 2.8) * amp;          // ondulation lente commune au serpent et aux lettres
    const C = fs * 0.36, by = cy + fs * 0.52;
    // 1) le serpent (même rendu que sur le plateau) ondule sous le mot et lorgne la pomme
    pN = 0;
    for (let k = 0; k <= 30; k++) { const u = k / 30; addPt(sx + u * sw, by + wave_(u) * 1.2 + Math.sin(u * 11 - t * 3.4) * fs * 0.075 * (0.3 + 0.7 * u), k === 0); }
    const L = CUM[pN - 1];
    drawBody(C, TITLE_COL, -1, L, 1, false, null);
    pointAt(L, 0);
    const hx = QX, hy = QY, ang = Math.atan2(QDY, QDX), ax = sx + sw + fs * 1.0, ay = by - fs * 0.05 + (soft ? Math.sin(t * 2.1) * fs * 0.04 : 0);
    const lx = ax - hx, ly = ay - hy, ll = Math.hypot(lx, ly) || 1, tp = now % 1700;
    drawHead(C, hx, hy, ang, TITLE_COL, -1, 1, soft && (now % 4100) < 140, soft && tp < 300 ? Math.sin(tp / 300 * Math.PI) : 0, lx / ll, ly / ll);
    ctx.save(); ctx.translate(ax, ay); paintFood(ctx, 'apple', fs * 0.7, false); ctx.restore();
    ctx.save();
    if (soft) {                                     // pollen qui monte : points dérivés du temps, aucun état
      ctx.fillStyle = '#e6ffc0';
      for (let k = 0; k < 5; k++) {
        const pr = (t * 0.17 + k * 0.2) % 1, ppx = x0 + total * ((0.1 + k * 0.21 + Math.sin(t * 0.5 + k) * 0.04) % 1), ppy = cy + fs * 0.1 - pr * fs * 2.1;
        ctx.globalAlpha = 0.42 * (1 - pr); ctx.beginPath(); circ(ctx, ppx, ppy, fs * 0.045 + 0.5); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    // 2) les lettres, chacune ondule avec un décalage de phase : feuillage clair en haut, vert profond en bas
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    ctx.font = '700 ' + fs.toFixed(1) + 'px ' + DISP;
    const gd = ctx.createLinearGradient(0, cy - fs * 0.65, 0, cy + fs * 0.45);
    gd.addColorStop(0, '#f4ffe0'); gd.addColorStop(0.55, '#aae88e'); gd.addColorStop(1, '#5cb862');
    let lx2 = x0;
    for (let i = 0; i < n; i++) {
      const u = (lx2 + ws[i] / 2 - x0) / Math.max(1, total), cxi = lx2 + ws[i] / 2, cyi = cy - fs * 0.12 + wave_(u);
      if (soft) { ctx.shadowColor = 'rgba(140,235,150,0.5)'; ctx.shadowBlur = fs * 0.45; }
      ctx.strokeStyle = A.contrast ? '#ffffff' : '#123f1a'; ctx.lineWidth = fs * 0.18; ctx.strokeText(TITLE.charAt(i), cxi, cyi);
      ctx.shadowBlur = 0; ctx.fillStyle = gd; ctx.fillText(TITLE.charAt(i), cxi, cyi);
      lx2 += ws[i] + gap;
    }
    ctx.restore();
  }

  // ───────────────────────── écrans : lobby, compte à rebours, pause ─────────────────────────
  function drawLobby(now) {
    const c = ARENA / 2;
    ctx.fillStyle = 'rgba(5,16,6,0.62)'; ctx.fillRect(0, 0, ARENA, ARENA);
    drawTitle(c, c - 62, now);
    const n = snap.connected || 0, nb = snap.botCount || 0, tot = n + nb, vr = snap.variant | 0;
    const L1 = `${n} joueur${n > 1 ? 's' : ''}${nb ? ' + ' + nb + ' bot' + (nb > 1 ? 's' : '') : ''}${teamMode ? ' · ' + (MODE_NAME[snap.mode] || snap.mode) : (tot < 2 ? ' · solo : entraînement' : '')}`;
    const L2 = VARIANT_SUB[vr] || VARIANT_SUB[0], L3 = snap.rush ? 'Food-rush : premier à ' + (snap.rushTarget || 20) + ' pommes' : '', L4 = '▶ Espace / clic pour lancer';
    const F1 = '600 15px ' + DISP, F2 = '500 12.5px ' + DISP, F4 = '700 13px ' + DISP;
    ctx.font = F1; let w = ctx.measureText(L1).width; ctx.font = F2; w = Math.max(w, ctx.measureText(L2).width, L3 ? ctx.measureText(L3).width : 0); ctx.font = F4; w = Math.max(w, ctx.measureText(L4).width);
    w = Math.min(ARENA - 24, w + 34);
    const lines = L3 ? 4 : 3, h = 16 + lines * 19, y0 = c - 6;
    plank(c - w / 2, y0, w, h);
    ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    let y = y0 + 17;
    label(L1, c, y, F1, teamMode ? '#bfe3ff' : '#fff4cf'); y += 19;
    label(L2, c, y, F2, '#e8dcb8'); y += 19;
    if (L3) { label(L3, c, y, F2, '#ffd24a'); y += 19; }
    label(L4, c, y, F4, '#c2f0b8');
    ctx.restore();
  }
  function drawCountdown(now) {                     // tournesol qu'on effeuille : 3 · 2 · 1, puis GO
    const c = ARENA / 2, soft = !A.reduceFx, n = snap.count || 0;
    ctx.fillStyle = 'rgba(5,18,6,0.3)'; ctx.fillRect(0, 0, ARENA, ARENA);
    const pulse = soft ? 1 + 0.06 * Math.sin(now / 110) : 1;
    ctx.save(); ctx.translate(c, c - 6); ctx.scale(pulse, pulse);
    ctx.fillStyle = 'rgba(0,10,0,0.35)'; ctx.beginPath(); circ(ctx, 5, 8, 66); ctx.fill();
    const NP = 14, lit = n > 0 ? Math.ceil(NP * Math.min(3, n) / 3) : NP;
    ctx.lineWidth = 1.4; ctx.strokeStyle = '#7a4c0c';
    for (let k = 0; k < NP; k++) {
      const a = -Math.PI / 2 + k / NP * Math.PI * 2, on = k < lit;
      ctx.save(); ctx.rotate(a); ctx.translate(48, 0);
      ctx.fillStyle = on ? '#ffd23f' : 'rgba(120,100,50,0.5)'; ctx.beginPath(); oval(ctx, 0, 0, 19, 8); ctx.fill(); ctx.stroke();
      if (on) { ctx.fillStyle = 'rgba(255,245,200,0.5)'; ctx.beginPath(); oval(ctx, -3, -2.5, 10, 2.5); ctx.fill(); }
      ctx.restore();
    }
    const cg = ctx.createRadialGradient(-8, -10, 4, 0, 0, 38); cg.addColorStop(0, '#8a5526'); cg.addColorStop(1, '#3e220c');
    ctx.fillStyle = cg; ctx.beginPath(); circ(ctx, 0, 0, 36); ctx.fill(); ctx.strokeStyle = '#2a1606'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = 'rgba(255,205,120,0.28)'; ctx.beginPath(); for (let k = 1; k < 70; k++) { const r = 3.9 * Math.sqrt(k), a = k * 2.39996; circ(ctx, Math.cos(a) * r, Math.sin(a) * r, 1.1); } ctx.fill();   // graines en spirale
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    const s = n > 0 ? String(n) : 'GO !';
    ctx.font = '700 ' + (n > 0 ? 58 : 30) + 'px ' + DISP; ctx.lineWidth = 6; ctx.strokeStyle = '#1e1005'; ctx.strokeText(s, 0, 3); ctx.fillStyle = '#fff4cf'; ctx.fillText(s, 0, 3);
    ctx.restore();
    ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    label(n > 0 ? 'Les serpents sortent de l\'herbe…' : 'Ssss… à table !', c, c + 82, '600 14px ' + DISP, '#f3ecd2');
    ctx.restore();
  }
  function drawPause(now) {                         // pancarte suspendue « PAUSE » qui se balance, zzz de sieste
    const c = ARENA / 2, soft = !A.reduceFx, w = 190, h = 60;
    ctx.fillStyle = 'rgba(5,16,6,0.62)'; ctx.fillRect(0, 0, ARENA, ARENA);
    ctx.save(); ctx.translate(c, c - 78); ctx.rotate(soft ? Math.sin(now / 1400) * 0.035 : 0);
    ctx.strokeStyle = '#c9b48a'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-w * 0.36, 32); ctx.moveTo(0, 0); ctx.lineTo(w * 0.36, 32); ctx.stroke();
    ctx.fillStyle = '#d8cfb6'; ctx.beginPath(); circ(ctx, 0, 0, 2.6); ctx.fill();
    plank(-w / 2, 30, w, h);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    ctx.font = '700 32px ' + DISP; ctx.lineWidth = 5; ctx.strokeStyle = '#2b1a0b'; ctx.strokeText('PAUSE', 0, 30 + h / 2 + 1); ctx.fillStyle = '#fff4cf'; ctx.fillText('PAUSE', 0, 30 + h / 2 + 1);
    if (soft) { ctx.font = '700 13px ' + DISP; ctx.fillStyle = '#c2f0b8'; for (let k = 0; k < 3; k++) { const u = ((now / 1600) + k / 3) % 1; ctx.globalAlpha = Math.sin(u * Math.PI); ctx.fillText('z', w / 2 + 6 + u * 16, 30 - u * 26); } ctx.globalAlpha = 1; }
    ctx.restore();
    ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    label('Sieste au jardin — P / Échap pour reprendre', c, c + 34, '500 14px ' + DISP, '#e8dcb8');
    ctx.restore();
  }

  // ───────────────────────── rendu d'une image ─────────────────────────
  function draw() {
    if (destroyed) return;
    const now = performance.now(), dtm = lastFrame ? Math.min(100, Math.max(1, now - lastFrame)) : 16.7; lastFrame = now; NOW = now;
    const kdt = Math.min(3, Math.max(0.25, dtm / 16.7)), sc = cv.width / ARENA, soft = !A.reduceFx;
    let ox = 0, oy = 0;
    if (shakeMag > 0.3 && soft) { ox = (Math.random() * 2 - 1) * shakeMag; oy = (Math.random() * 2 - 1) * shakeMag; shakeMag *= Math.pow(0.85, kdt); } else shakeMag = 0;
    ctx.setTransform(sc, 0, 0, sc, ox * sc, oy * sc);
    SC = sc; CSC = sc / (window.devicePixelRatio || 1);
    ensureTerrain(); ctx.drawImage(terrainCv, 0, 0, ARENA, ARENA);   // décor statique pré-rendu (1 drawImage au lieu de ~6000 tracés)
    if (snap && snap.variant === 1) drawPortal(now);
    updateDusk(dtm);
    if (snap) viewPair(now);
    const S = snap ? (VA || snap) : null;
    drawLights(now, S);                             // lumière sur le sol, avant toute pièce
    if (soft) drawAmbient(now);
    HON.fill(0);
    if (S) {
      const foods = S.food || [], pl = S.players || [];
      drawFoods(foods, now);
      for (let i = 0; i < pl.length; i++) if (i !== mySeat) drawSnake(pl[i], now, dtm, foods);   // un serpent mort disparaît du plateau (il n'est plus un obstacle)
      if (mySeat >= 0 && pl[mySeat]) drawSnake(pl[mySeat], now, dtm, foods);                   // le mien par-dessus
    }
    drawFx(now, kdt);
    if (dusk > 0.01) crepuscule(ctx, 0, 0, ARENA, ARENA, dusk, { soleil: 'gauche', force: A.contrast || A.reduceFx ? 0.6 : 1 });   // étalonnage sur sol + pièces
    if (snap) { drawMarkers(now); }                         // repères au-dessus du crépuscule : toujours nets
    if (snap && snap.rush && (snap.gs === 'play' || snap.gs === 'countdown')) drawRush();
    if (snap && snap.gs === 'countdown') drawCountdown(now);
    if (snap && snap.gs === 'lobby') drawLobby(now);
    if (snap && snap.gs === 'paused') drawPause(now);
  }
  function drawLoop() { if (destroyed) return; try { draw(); } catch (e) { console.error('[render]', e); } rafId = requestAnimationFrame(drawLoop); }   // filet : une erreur de rendu ne fige plus le jeu

  const onKeyDown = e => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
    unlockAudio();
    if (e.key === ' ' && snap && snap.gs !== 'play' && snap.gs !== 'paused') return e.repeat ? undefined : send({ t: 'start' });
    if ((e.key === 'p' || e.key === 'P' || e.key === 'Escape') && snap && (snap.gs === 'play' || snap.gs === 'paused')) return send({ t: 'pause' });
    const d = DIR_KEYS[e.code]; if (d && !e.repeat) { send({ t: 'dir', d }); echoVirage(d); }   // la répétition auto renvoyait la même direction ~30×/s pour rien
  };
  function dpad(id, d) { const el = $(id); if (!el) return; el.addEventListener('pointerdown', e => { e.preventDefault(); unlockAudio(); send({ t: 'dir', d }); echoVirage(d); }); }
  function echoVirage(d) { const me = snap && mySeat >= 0 && snap.players ? snap.players[mySeat] : null; if (me && me.alive && HON[mySeat]) ECHO.appui(d, HDX[mySeat], HDY[mySeat], false); }

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
    cv = $('snc'); ctx = cv.getContext('2d'); hud = $('snHud'); endEl = $('snEnd');
    terrainKey = ''; foodSpr = {};  // les sprites en cache appartiennent à l'ancien contexte : on repart propre
    { const wrap = cv.parentElement;                 // bandeaux de message posés sur le cadre du canvas (.canvas-wrap)
      if (wrap && wrap.classList && wrap.classList.contains('canvas-wrap')) initGameMsg(wrap); }
    hud.innerHTML = '';             // module réutilisé : repartir d'un HUD vide (sinon les cartes P1.. se cumulent à chaque retour)
    cards = Array.from({ length: MAX_SEATS }, (_, i) => i).map(i => { const el = document.createElement('div'); el.className = 'pc hidden'; el.innerHTML = `<div class="dot"></div><div class="inf"><div class="pn">P${i + 1}</div><div class="lv"></div></div>`; hud.appendChild(el); return el; });
    startBtn = $('snStart'); pauseBtn = $('snPause'); modeBtn = $('snMode'); variantBtn = $('snVariant'); rushBtn = $('snRush'); botsBtn = $('snBots'); pauseFloat = $('snPauseFloat');
    lbBtn = $('snLbBtn'); lbPanel = $('snLbPanel'); lbBody = $('snLbBody');
    startBtn.onclick = () => { unlockAudio(); send({ t: 'start' }); };
    pauseBtn.onclick = () => send({ t: 'pause' });
    pauseFloat.onclick = () => send({ t: 'pause' });
    modeBtn.onclick = () => send({ t: 'mode' });
    if (variantBtn) variantBtn.onclick = () => send({ t: 'variant' });
    if (rushBtn) rushBtn.onclick = () => send({ t: 'rush' });
    if (botsBtn) botsBtn.onclick = () => send({ t: 'bots' });
    diffBtn = $('snDiff'); if (diffBtn) diffBtn.onclick = () => send({ t: 'botdiff' });
    { const helpBtn = $('snHelp'), helpPanel = $('snHelpPanel'); if (helpBtn && helpPanel) helpBtn.onclick = () => togglePanel(helpPanel); }
    lbBtn.onclick = () => { togglePanel(lbPanel); renderLB(); };
    if (premiere) cv.addEventListener('click', () => { unlockAudio(); if (snap && snap.gs !== 'play' && snap.gs !== 'paused') send({ t: 'start' }); });
    if (premiere) endEl.addEventListener('click', () => { unlockAudio(); send({ t: 'start' }); });
    if (premiere) { dpad('snUp', 'up'); dpad('snDown', 'down'); dpad('snLeft', 'left'); dpad('snRight', 'right'); }
    applyColors();
    resizeH = resizeCanvas; addEventListener('resize', resizeH); resizeCanvas();
    addEventListener('keydown', onKeyDown);
    music.start();
    rafId = requestAnimationFrame(drawLoop);
  }
  function onA11y() { applyColors(); }
  function teardown() { destroyed = true; music.stop(); cancelAnimationFrame(rafId); removeEventListener('resize', resizeH); removeEventListener('keydown', onKeyDown); parts.length = 0; waves.length = 0; floats.length = 0; LUM.vider(); lumPend.length = 0;
    J.fin(); jRound = -1; prevRound = -1; dusk = 0; }   // retour au jeu (autre salle, manche renumérotée) : journal et lumière repartent propres

  return { init, onState, onMessage, onLb, onA11y, teardown };
})();
