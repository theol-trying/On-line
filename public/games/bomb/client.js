// Module client BOMBERMAN v2 : équipes, bonus/malus, portée + compte à rebours visibles, mort subite.
// Identité « Confiserie » (cartoon / bonbons) : sol de glaçage menthe saupoudré de vermicelles, bordure de
// biscuits, piliers en carrés de chocolat, caisses cassables = boîtes de bonbons à rubans, bonus en bonbons
// emballés, malus en bonbons piquants, flammes cartoon cernées d'encre, morts en « pouf ». Décor et sprites
// pré-rendus hors écran (cf. Sumo) ; tout effet décoratif est coupé par « Réduire les effets ».
import { GW as GW0, GH as GH0, CELL, ARENA as ARENA0 } from './shared.js';
// grille dynamique (selon le nombre de participants) : la taille d'une CELLULE ne bouge pas,
// c'est le NOMBRE de cases qui augmente (13 / 15 / 17), donc ARENA = GW * CELL.
let GW = GW0, GH = GH0, ARENA = ARENA0;
import { createMusic } from '../../music.js';
import { seatPattern, SEAT_GLYPH } from '../../patterns.js';
import { initGameMsg, msgPerso, msgGlobal } from '../../gamemsg.js';
import { arenaSize } from '../../layout.js';   // taille du plateau : commune aux 5 jeux (mode plein écran compris)
// couche partagée (par-dessus la refonte « Confiserie ») : avatar sur le visage du bombeur, lueurs des
// flammes / mèches / téléporteurs sur le glaçage, crépuscule pendant la mort subite, courbe de fin de manche
import { lumiere, creerLumieres } from '../../lumiere.js';
import { crepuscule, creerDuel } from '../../crepuscule.js';
import { creerJournal, blocFin } from '../../finpartie.js';

// Duel final (crepuscule.js) : quand il ne reste que 2 joueurs ou 2 équipes, la nuit tombe en ~4 s.
const DUEL = creerDuel(), duelAnnonce = () => msgGlobal('⚔', 'Duel final !', { color: '#ff5a3c' });

// musique : cartoon enjoué — basse bondissante, mélodie espiègle, célesta sucré, woodblock + caisse claire ;
// climax (mort subite) = motif chromatique + grosse caisse + tempo
const MUSIC_THEME = { bpm: 134, bpmBoost: 16, vol: 0.48, root: 130.81, len: 32,
  stingers: { kill: { notes: [12, 7, 3, 0], wave: 'square', oct: 0, gain: 0.035, dur: 0.13, rate: 0.06 },
    win: { base: 261.63, notes: [[0, 4, 7], [5, 9, 12], [7, 12, 16], [12, 16, 19, 24]], gain: 0.035, dur: 0.32, rate: 0.13 },
    count: { notes: [0], oct: 2, wave: 'triangle', dur: 0.1, gain: 0.05, duck: false }, go: { notes: [[0, 4, 7, 12]], oct: 1, wave: 'square', dur: 0.42, gain: 0.045, duck: false },
    alert: { notes: [0, 2, 4, 6, 8, 10, 12], oct: 1, wave: 'sawtooth', rate: 0.06, dur: 0.12, gain: 0.035 } },
  layers: [
  { seq: [[0, 4, 7], null, null, null, null, null, null, null, null, null, null, null, null, null, null, null], wave: 'sine', gain: 0.02, dur: 12 },
  { seq: [0, null, 7, null, 0, null, 7, null, 5, null, 12, null, 5, null, 12, null, 0, null, 7, null, 0, null, 7, null, -4, null, 3, null, 7, null, 3, null], wave: 'square', gain: 0.03, dur: 0.9, min: 1 },
  { seq: [12, null, 12, null, 7, null, null, null, 9, null, 9, null, 4, null, null, null, 12, null, 14, null, 16, null, null, null, 12, null, 9, null, 7, null, null, null], oct: 1, wave: 'square', gain: 0.016, dur: 1.1, min: 1 },
  { seq: [24, null, null, null, 28, null, null, null, 31, null, 28, null, null, null, null, null, 26, null, null, null, 29, null, null, null, 33, null, 31, null, null, null, null, null], oct: 1, wave: 'sine', gain: 0.011, dur: 1.6 },   // célesta (bonbons qui tintent)
  { drums: '..H...H...H...H.', gain: 0.6, min: 1 },
  { drums: '....S.......S...', gain: 0.32, min: 1 },
  { seq: [12, 11, 12, 11, 12, null, null, null], oct: 1, wave: 'triangle', gain: 0.022, dur: 0.8, min: 2 },
  { drums: 'K...K...K...K...', min: 2 },
] };

// couleurs des sièges : au-delà de 8 il n'existe plus de teintes toutes distinguables entre elles,
// c'est le MOTIF par siège (patterns.js) qui porte l'identification.
const PAL = { normal: ['#4a9ee0', '#e06240', '#2aaf7a', '#cc9010', '#9b6cf0', '#e268b0', '#25c9c0', '#9ec93a', '#d06ef0', '#f2f0e6'],
              cb: ['#0072B2', '#E69F00', '#009E73', '#F0E442', '#CC79A7', '#56B4E9', '#D55E00', '#F5F5F5', '#7B68EE', '#9A9A9A'] };
const TEAMPAL = { normal: ['#4a9ee0', '#e06240', '#2aaf7a', '#cc9010', '#9b6cf0'], cb: ['#0072B2', '#E69F00', '#009E73', '#F0E442', '#CC79A7'] };
const TEAM_LETTER = ['A', 'B', 'C', 'D', 'E'];
const MODE_NAME = { ffa: 'Chacun pour soi', '2v2': '2 v 2', '2v2v2': '2 v 2 v 2', '3v3': '3 v 3', '4v4': '4 v 4', '2v2v2v2': '2 v 2 v 2 v 2', '3v3v3': '3 v 3 v 3', '5v5': '5 v 5', '2v2v2v2v2': '2 v 2 v 2 v 2 v 2' };
const MAX_SEATS = 8;                                 // Bomberman plafonne à 8 sièges (cf. serveur)
const GEN_NAMES = ['Symétrique', 'Aléatoire', '4 coins'];
// Retour de test : « les icônes ne sont pas forcément claires ». On DIT donc l'effet, pas le nom.
// Libellés courts (lus en une fraction de seconde) : [icône, texte]. Source de vérité = le panneau
// d'aide de Bomberman (index.html) et applyPick() du serveur. Ce sont des CONSTANTES : jamais de
// chaîne venue du réseau dans un message.
const PICK_MSG = {
  bomb:    ['💣', 'Bombe +1 : une de plus'],
  flame:   ['🔥', 'Flamme +1 : explosions plus longues'],
  speed:   ['👟', 'Vitesse : tu bouges plus vite'],
  kick:    ['🦵', 'Coup de pied : pousse les bombes'],
  remote:  ['📡', 'Détonateur : tu choisis le moment'],
  ghost:   ['👻', 'Fantôme : traverse les caisses'],
  throw:   ['🧤', 'Gant : lance la bombe (action)'],
  shield:  ['🛡', 'Bouclier : encaisse une explosion'],
  line:    ['📏', 'Bombe en ligne : rangée devant toi'],
  reverse: ['🔀', "Inversé : tes commandes s'inversent"],
  slow:    ['🐌', 'Ralenti : tu marches moins vite'],
  auto:    ['⏱', 'Pose auto : bombes toutes seules'],
  skull:   ['💀', 'Crâne : malédiction contagieuse !'],
};
// couleur d'accent de chaque bonbon (papier, étincelles au ramassage)
const PICK_COL = { bomb: '#8a86a6', flame: '#ff7a2a', speed: '#2fd49a', kick: '#ffb52e', remote: '#3fb6f0', ghost: '#b9a6ff', throw: '#ff8fc8',
  shield: '#4aa8ff', line: '#8f82ff', reverse: '#ff4a5a', slow: '#e08a3a', auto: '#ff4a5a', skull: '#b04ae0' };
// fond animé : ombres de nuages qui défilent doucement (identité cartoon) — coupé par reduceFx
const AMB_CLOUDS = Array.from({ length: 5 }, () => ({ y: 0.05 + Math.random() * 0.85, v: 5 + Math.random() * 7, s: 22 + Math.random() * 26, ph: Math.random() * 1000 }));
const INTERP_MS = 55;
const KEYMAP = { ArrowUp: 'up', KeyW: 'up', KeyZ: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', KeyQ: 'left', ArrowRight: 'right', KeyD: 'right' };   // ZQSD / WASD : KeyW/KeyA = touches Z/Q en AZERTY ; KeyZ/KeyQ pour un clavier réglé en QWERTY
const DIRS4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const DIRV = [[1, 0], [0, 1], [-1, 0], [0, -1]];     // orientation du personnage : 0 droite, 1 bas, 2 gauche, 3 haut
const TICK_HZ = 30, BOMB_FUSE = 90, BLAST_MS = 600, SD_MS = 10 * 1000 / TICK_HZ, DROP_MS = 380;   // miroirs d'affichage du serveur (aucune règle ici)
// identité visuelle propre au jeu (fixe) : Cartoon / Confiserie
const K = { bg: '#173a2a', floor: '#2f8f5b', floor2: '#36a268', ink: '#231326', cream: '#fff4e2', lemon: '#ffd23a', pink: '#ff7eb3', sky: '#6fc2ff', grape: '#9b5cf0', mint: '#4fd6a6', orange: '#ff8a3a' };
const CANDY = ['#ff6fae', '#ffd23a', '#4fd6a6', '#6fc2ff', '#ff8a3a', '#b98bff'];
const BOXV = [{ a: '#ff86b4', b: '#ffe6f1', dk: '#c9507f', rib: '#39c9a0' }, { a: '#ffcf3a', b: '#fff7cf', dk: '#c6921a', rib: '#ff5f9e' }, { a: '#6fc2ff', b: '#e6f5ff', dk: '#3f86c4', rib: '#ff5a5a' }];
const FONT = "'Baloo 2','Fredoka',system-ui,sans-serif";
const TAU = Math.PI * 2;

function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function hexRgb(h) { const n = parseInt(String(h).slice(1, 7), 16) || 0; return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function rgbStr(c, a) { return a == null ? `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})` : `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`; }
function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
function mixHex(a, b, t) { return rgbStr(mix(hexRgb(a), hexRgb(b), t)); }
function rgbKey(h) { return hexRgb(h).join(','); }
function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }   // mulberry32 : décor identique d'un rendu à l'autre
function hash2(a, b) { const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return x - Math.floor(x); }
// ellipse maison (scale + arc) : ctx.ellipse est absent/instable sur les vieux Safari
function oval(g, x, y, rx, ry) { g.save(); g.translate(x, y); g.scale(rx, ry); g.moveTo(1, 0); g.arc(0, 0, 1, 0, TAU); g.restore(); }
// rectangle arrondi maison (ctx.roundRect absent des vieux Safari) — ajoute au chemin courant
function rr(g, x, y, w, h, r) { g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function star4(g, x, y, r) { g.moveTo(x, y - r); g.quadraticCurveTo(x, y, x + r, y); g.quadraticCurveTo(x, y, x, y + r); g.quadraticCurveTo(x, y, x - r, y); g.quadraticCurveTo(x, y, x, y - r); }
// spirale de mort subite : MÊME parcours que le serveur (sert seulement à annoncer l'ombre du prochain bloc)
function buildSpiral() { const res = []; let x0 = 1, y0 = 1, x1 = GW - 2, y1 = GH - 2; while (x0 <= x1 && y0 <= y1) { for (let x = x0; x <= x1; x++) res.push([x, y0]); for (let y = y0 + 1; y <= y1; y++) res.push([x1, y]); if (y1 > y0) for (let x = x1 - 1; x >= x0; x--) res.push([x, y1]); if (x1 > x0) for (let y = y1 - 1; y >= y0 + 1; y--) res.push([x0, y]); x0++; y0++; x1--; y1--; } return res; }
const boxVar = (gx, gy) => (gx * 7 + gy * 13) % 3;

// ───────────────────────── pictogrammes (canvas, jamais d'emoji : ils varient selon l'OS) ─────────────────────────
// Cernés d'encre : lisibles sur le papier clair des bonus comme sur le fond sombre des malus.
function drawPickIcon(g, t, x, y, s) {
  const k = s / 10, INK = K.ink;
  g.save(); g.translate(x, y); g.lineCap = 'round'; g.lineJoin = 'round';
  const ink = w => { g.strokeStyle = INK; g.lineWidth = w * k; g.stroke(); };
  const circ = (cx, cy, r) => { g.moveTo((cx + r) * k, cy * k); g.arc(cx * k, cy * k, r * k, 0, TAU); };
  if (t === 'bomb') {
    g.beginPath(); g.moveTo(1.5 * k, -3.5 * k); g.quadraticCurveTo(4.5 * k, -7 * k, 6.5 * k, -5.5 * k); ink(2.6); g.strokeStyle = '#e0bb72'; g.lineWidth = 1.3 * k; g.stroke();
    g.beginPath(); circ(-0.5, 1.5, 5.6); g.fillStyle = '#231f30'; g.fill(); ink(1.1);
    g.fillStyle = 'rgba(255,255,255,.6)'; g.beginPath(); circ(-2.4, -0.6, 1.4); g.fill();
    g.fillStyle = '#ffd36e'; g.beginPath(); circ(6.6, -5.6, 2); g.fill(); g.fillStyle = '#fff'; g.beginPath(); circ(6.6, -5.6, 0.9); g.fill();
  } else if (t === 'flame') {
    g.beginPath(); g.moveTo(0, -7.5 * k); g.quadraticCurveTo(6.5 * k, -2 * k, 4.5 * k, 3 * k); g.quadraticCurveTo(3.5 * k, 7 * k, 0, 7 * k); g.quadraticCurveTo(-3.5 * k, 7 * k, -4.5 * k, 3 * k); g.quadraticCurveTo(-6.5 * k, -2 * k, 0, -7.5 * k);
    g.fillStyle = '#ff6a1f'; g.fill(); ink(1.1);
    g.beginPath(); g.moveTo(0, -2 * k); g.quadraticCurveTo(3 * k, 1.5 * k, 2.3 * k, 4 * k); g.quadraticCurveTo(1.6 * k, 5.6 * k, 0, 5.6 * k); g.quadraticCurveTo(-1.6 * k, 5.6 * k, -2.3 * k, 4 * k); g.quadraticCurveTo(-3 * k, 1.5 * k, 0, -2 * k);
    g.fillStyle = '#ffd23a'; g.fill();
  } else if (t === 'speed') {
    for (const o of [-3.2, 1.8]) { g.beginPath(); g.moveTo((o - 2) * k, -5 * k); g.lineTo((o + 3) * k, 0); g.lineTo((o - 2) * k, 5 * k); ink(4.2); g.strokeStyle = '#2fd49a'; g.lineWidth = 2.2 * k; g.stroke(); }
  } else if (t === 'kick') {                          // botte
    g.beginPath(); g.moveTo(-3 * k, -6.5 * k); g.lineTo(1.5 * k, -6.5 * k); g.lineTo(1.5 * k, 1 * k); g.lineTo(6 * k, 2 * k); g.quadraticCurveTo(7 * k, 2.4 * k, 7 * k, 4 * k); g.lineTo(7 * k, 5.5 * k); g.lineTo(-3 * k, 5.5 * k); g.closePath();
    g.fillStyle = '#ffb52e'; g.fill(); ink(1.1);
    g.fillStyle = '#7a3d10'; g.fillRect(-3 * k, 4.2 * k, 10 * k, 1.3 * k);
    g.beginPath(); g.moveTo(-1 * k, -3.5 * k); g.lineTo(1.5 * k, -3.5 * k); g.moveTo(-1 * k, -1 * k); g.lineTo(1.5 * k, -1 * k); ink(0.8);
  } else if (t === 'remote') {                        // détonateur : boîtier, bouton rouge, antenne, ondes
    g.beginPath(); g.moveTo(1.8 * k, -1 * k); g.lineTo(3.4 * k, -5.5 * k); ink(1.3);
    g.beginPath(); rr(g, -3.6 * k, -1 * k, 7.2 * k, 8 * k, 1.4 * k); g.fillStyle = '#59607a'; g.fill(); ink(1.1);
    g.fillStyle = '#ff3b3b'; g.beginPath(); circ(0, 3, 1.7); g.fill(); g.beginPath(); circ(3.4, -6, 1.2); g.fill();
    g.strokeStyle = '#3fb6f0'; g.lineWidth = 1.3 * k; for (const r of [3.2, 5.4]) { g.beginPath(); g.arc(3.4 * k, -6 * k, r * k, -1.3, 0.1); g.stroke(); }
  } else if (t === 'ghost') {
    g.beginPath(); g.moveTo(-5 * k, 5 * k); g.lineTo(-5 * k, -1 * k); g.arc(0, -1 * k, 5 * k, Math.PI, 0); g.lineTo(5 * k, 5 * k);
    g.quadraticCurveTo(3.3 * k, 3 * k, 1.7 * k, 5 * k); g.quadraticCurveTo(0, 3 * k, -1.7 * k, 5 * k); g.quadraticCurveTo(-3.3 * k, 3 * k, -5 * k, 5 * k); g.closePath();
    g.fillStyle = '#f4f1ff'; g.fill(); ink(1.1);
    g.fillStyle = '#2a2440'; g.beginPath(); circ(-1.8, -1, 1.1); circ(1.8, -1, 1.1); g.fill();
  } else if (t === 'throw') {                         // gant
    g.beginPath(); rr(g, -3.5 * k, 3 * k, 7 * k, 3.4 * k, 1 * k); g.fillStyle = '#ff8fc8'; g.fill(); ink(1);
    g.beginPath(); circ(-4.2, 0.8, 1.9); g.fillStyle = '#fff'; g.fill(); ink(1);
    g.beginPath(); circ(0.4, -0.5, 4.3); g.fill(); ink(1.1);
    g.beginPath(); g.moveTo(-1 * k, -4.4 * k); g.lineTo(-1 * k, -2 * k); g.moveTo(1.7 * k, -4.4 * k); g.lineTo(1.7 * k, -2 * k); ink(0.8);
  } else if (t === 'shield') {
    g.beginPath(); g.moveTo(0, -6.5 * k); g.lineTo(5.5 * k, -4 * k); g.lineTo(5 * k, 2 * k); g.quadraticCurveTo(3 * k, 6 * k, 0, 7 * k); g.quadraticCurveTo(-3 * k, 6 * k, -5 * k, 2 * k); g.lineTo(-5.5 * k, -4 * k); g.closePath();
    g.fillStyle = '#4aa8ff'; g.fill(); ink(1.1);
    g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 1.3 * k; g.beginPath(); g.moveTo(0, -4 * k); g.lineTo(0, 4.5 * k); g.moveTo(-3 * k, -1 * k); g.lineTo(3 * k, -1 * k); g.stroke();
  } else if (t === 'line') {                          // trois bombes en rang + flèche
    g.beginPath(); g.moveTo(-6 * k, 5.2 * k); g.lineTo(5.5 * k, 5.2 * k); g.moveTo(3.6 * k, 3.6 * k); g.lineTo(5.8 * k, 5.2 * k); g.lineTo(3.6 * k, 6.8 * k); ink(2.6); g.strokeStyle = '#8f82ff'; g.lineWidth = 1.3 * k; g.stroke();
    g.beginPath(); for (const o of [-5, 0, 5]) circ(o, -0.5, 2.4); g.fillStyle = '#231f30'; g.fill(); ink(0.9);
    g.fillStyle = 'rgba(255,255,255,.65)'; g.beginPath(); for (const o of [-5, 0, 5]) circ(o - 0.8, -1.3, 0.7); g.fill();
  } else if (t === 'reverse') {                       // deux flèches qui tournent en sens inverse
    for (const [a0, a1] of [[0.35, 2.75], [3.49, 5.89]]) {
      g.beginPath(); g.arc(0, 0, 5 * k, a0, a1); ink(3.4); g.strokeStyle = '#ff4a5a'; g.lineWidth = 1.8 * k; g.stroke();
      const px = Math.cos(a1) * 5 * k, py = Math.sin(a1) * 5 * k, tx = -Math.sin(a1), ty = Math.cos(a1), nx = Math.cos(a1), ny = Math.sin(a1);
      g.beginPath(); g.moveTo(px + tx * 2.8 * k, py + ty * 2.8 * k); g.lineTo(px + nx * 2.2 * k - tx * 0.4 * k, py + ny * 2.2 * k - ty * 0.4 * k); g.lineTo(px - nx * 2.2 * k - tx * 0.4 * k, py - ny * 2.2 * k - ty * 0.4 * k); g.closePath();
      g.fillStyle = '#ff4a5a'; g.fill(); ink(0.9);
    }
  } else if (t === 'slow') {                          // escargot
    g.beginPath(); g.moveTo(-7 * k, 5 * k); g.quadraticCurveTo(-7 * k, 3 * k, -4 * k, 3 * k); g.lineTo(5 * k, 3 * k); g.quadraticCurveTo(7 * k, 3 * k, 7 * k, 5 * k); g.closePath();
    g.fillStyle = '#b8d66a'; g.fill(); ink(1);
    g.beginPath(); g.moveTo(-5.5 * k, 3 * k); g.lineTo(-6.5 * k, -1.5 * k); g.moveTo(-4.2 * k, 3 * k); g.lineTo(-4.4 * k, -1.8 * k); ink(0.9);
    g.fillStyle = INK; g.beginPath(); circ(-6.5, -1.8, 0.8); circ(-4.4, -2.1, 0.8); g.fill();
    g.beginPath(); circ(1.5, -0.5, 4.6); g.fillStyle = '#e08a3a'; g.fill(); ink(1.1);
    g.beginPath(); for (let a = 0; a <= 9; a += 0.5) { const r = 0.45 * a * k, px = 1.5 * k + Math.cos(a) * r, py = -0.5 * k + Math.sin(a) * r; if (a === 0) g.moveTo(px, py); else g.lineTo(px, py); }
    g.strokeStyle = '#8a4a14'; g.lineWidth = 1 * k; g.stroke();
  } else if (t === 'auto') {                          // réveil
    g.beginPath(); circ(-4, -5.2, 1.8); circ(4, -5.2, 1.8); g.fillStyle = '#ff4a5a'; g.fill(); ink(0.9);
    g.beginPath(); circ(0, 0.5, 5.8); g.fillStyle = '#fff'; g.fill(); ink(1.1);
    g.beginPath(); g.arc(0, 0.5 * k, 4.7 * k, 0, TAU); g.strokeStyle = '#ff4a5a'; g.lineWidth = 1.3 * k; g.stroke();
    g.beginPath(); g.moveTo(0, 0.5 * k); g.lineTo(0, -2.8 * k); g.moveTo(0, 0.5 * k); g.lineTo(2.5 * k, 1.8 * k); ink(1.2);
  } else if (t === 'skull') {
    g.beginPath(); g.moveTo(-2.8 * k, 5.5 * k); g.lineTo(-2.8 * k, 2.94 * k); g.arc(0, -1.2 * k, 5 * k, 2.165, 7.259); g.lineTo(2.8 * k, 5.5 * k); g.closePath();
    g.fillStyle = '#f4f1ff'; g.fill(); ink(1.1);
    g.fillStyle = '#2a2440'; g.beginPath(); circ(-1.9, -1.4, 1.4); circ(1.9, -1.4, 1.4); g.fill();
    g.beginPath(); g.moveTo(0, 0.6 * k); g.lineTo(-0.7 * k, 1.8 * k); g.lineTo(0.7 * k, 1.8 * k); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(-1 * k, 3.4 * k); g.lineTo(-1 * k, 5.4 * k); g.moveTo(1 * k, 3.4 * k); g.lineTo(1 * k, 5.4 * k); ink(0.8);
  } else {
    g.fillStyle = '#fff'; g.font = `bold ${Math.round(9 * k)}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('?', 0, 0);
  }
  g.restore();
}

export default (function () {
  let A, send, root, cv, ctx, togglePanel = () => {}, closePanels = () => {};
  let CC = PAL.normal, TEAMCC = TEAMPAL.normal, FX = 1;
  let mySeat = -1, snap = null, prevGs = 'lobby', teamMode = false, endShown = false, inGamePrev = false, prevRound = -1, lastCount = -1, prevSd = false;
  let board = [], buf = [];
  // effets : tous plafonnés, tous vidés au changement de manche
  const parts = [], rings = [], poofs = [], wallAnims = [], dropAnims = [], scorch = [];
  const MAXP = 360;
  const anim = {};                                   // par siège : dernière position dessinée, orientation, phase de marche
  const bombEnt = new Map();                          // par case : naissance (plop), phase de pulsation, glissade / lancer
  const blastBorn = new Map();                        // par case : apparition de la flamme (gonflement)
  let blastSet = new Set();
  let lastDrop = { i: -1, t: 0 }, goAt = 0;
  let shakeMag = 0, rafId = 0, destroyed = false, resizeH = null, actx = null, noiseBuf = null, lastFrame = 0;
  const music = createMusic(() => actx, () => A, MUSIC_THEME);
  const input = { up: false, down: false, left: false, right: false };
  let hud, cards, startBtn, pauseBtn, modeBtn, genBtn, ffBtn, revBtn, botsBtn, diffBtn, pauseFloat, lbBtn, lbPanel, lbBody, endEl;
  const DIFF_NAMES = ['Facile', 'Normale', 'Difficile'];

  const $ = id => root.querySelector('#' + id);
  const colSeat = s => { if (s < 0 || !snap) return '#fff'; const p = snap.players[s]; return teamMode && p ? TEAMCC[p.team] || CC[s] : CC[s]; };
  const cpx = c => (c + 0.5) * CELL;
  function applyColors() { CC = PAL[A.palette] || PAL.normal; TEAMCC = TEAMPAL[A.palette] || TEAMPAL.normal; FX = A.reduceFx ? 0 : 1; sprKey = ''; bgKey = ''; terrainKey = ''; seatCache = {}; overlayG = null; }
  function addP(p) { if (parts.length >= MAXP) parts.splice(0, parts.length - MAXP + 1); parts.push(p); }
  function clearFx() { parts.length = 0; rings.length = 0; poofs.length = 0; wallAnims.length = 0; dropAnims.length = 0; scorch.length = 0; bombEnt.clear(); blastBorn.clear(); blastSet = new Set(); for (const k in anim) delete anim[k]; lastDrop = { i: -1, t: 0 }; flashes.vider(); dusk = 0; playMs = 0; }
  // ── éclairage dynamique : flashs d'explosion éphémères (plafonnés) + lueurs continues recalculées à chaque image
  const flashes = creerLumieres(18);
  let dusk = 0, playMs = 0;                          // crépuscule affiché (lissé) et temps de jeu vu par ce client
  let PXU = 1;                                       // pixels écran par unité d'arène (netteté des avatars)
  const nomAvatar = p => (p && !p.bot && p.name) ? p.name : null;   // les bots n'ont pas d'avatar
  // ── journal de manche (écran de fin enrichi) : puissance = bombes + flammes (0 une fois éliminé)
  const J = creerJournal();
  let jKills = {}, jTot = {}, jLast = 0, jSd = false;
  const nomSeat = s => { const p = snap && snap.players[s]; return p ? (p.name || ('P' + (s + 1))) : 'P' + (s + 1); };

  function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const size = arenaSize({ max: 720 });
    cv.style.width = size + 'px'; cv.style.height = size + 'px'; cv.width = Math.round(size * dpr); cv.height = Math.round(size * dpr);
  }

  // ───────────────────────── HUD, classement, écran de fin ─────────────────────────
  function refreshHUD() {
    if (!snap) return;
    snap.players.forEach((p, i) => {
      const shown = p.connected || p.playing;
      cards[i].classList.toggle('hidden', !shown);
      if (!shown) return;
      const col = colSeat(i); cards[i].style.color = col; cards[i].classList.toggle('dead', p.playing && !p.alive && !p.rvn); cards[i].classList.toggle('me', i === mySeat);
      const tags = [];
      if (teamMode) tags.push(`<span class="badge" style="background:${col}28;color:${col}">ÉQ.${TEAM_LETTER[p.team]}</span>`);
      if (p.bot) tags.push(`<span class="badge" style="background:${col}28;color:${col}">BOT</span>`);
      else if (i === mySeat) tags.push(`<span class="badge" style="background:${col}28;color:${col}">VOUS</span>`);
      const gly = `<span class="sc" style="color:${col}" title="motif du siège">${SEAT_GLYPH[i % SEAT_GLYPH.length]}</span>`;   // glyphe = motif porté par le personnage
      cards[i].querySelector('.pn').innerHTML = `${(window.__AV && window.__AV(p.name)) || ''}${esc(p.name || ('P' + (i + 1)))} ${gly} <span class="sc">${p.kills | 0} ⚡</span> ${tags.join('')}`;
      const lv = cards[i].querySelector('.lv'); lv.style.color = col;
      const ab = [p.kick ? '🦵' : '', p.remote ? '📡' : '', p.ghost ? '👻' : '', p.throw ? '🧤' : '', p.line ? '📏' : '', p.shield ? '🛡' : '', p.rev ? '🔀' : '', p.slow ? '🐌' : '', p.auto ? '⏱' : '', p.skull ? '💀' : ''].filter(Boolean).join('');
      lv.innerHTML = p.playing ? (p.alive ? `💣${p.bombs} 🔥${p.power} 👟${p.speed}${ab ? ' · ' + ab : ''}` : (p.rvn ? '☠ revanche (bord)' : '✖ éliminé')) : 'prêt';
    });
  }
  function renderLB() {
    if (!lbBody) return;
    if (!board.length) { lbBody.innerHTML = '<div class="lbnote">Aucune partie enregistrée (le solo ne compte pas).</div>'; return; }
    const B = board.map(e => ({ ...e, kd: e.deaths ? e.kills / e.deaths : e.kills }));
    lbBody.innerHTML = B.sort((a, b) => b.wins - a.wins || b.kd - a.kd).map(e =>
      `<div class="lbrow"><span class="lbn">${esc(e.name)}</span><span>🎮${e.games}</span><span>🏆${e.wins}</span><span title="kills">⚡${e.kills}</span><span title="K/D">⚖${(e.deaths ? (e.kills / e.deaths).toFixed(2) : (e.kills ? '∞' : '0'))}</span><span title="meilleure survie">⏱${Math.round(e.bestSurvivalSec || 0)}s</span></div>`).join('');
  }
  function showEndscreen(m) {
    if (m.gs !== 'over' || !m.stats) { endEl.classList.add('hidden'); return; }
    endEl.classList.remove('hidden');
    const solo = m.stats.solo;
    const parts2 = m.players.filter(p => p.playing && p.place > 0).slice().sort((a, b) => a.place - b.place);
    const champ = m.winner >= 0 ? parts2.find(p => p.team === m.winner) : null;
    const who = champ ? (teamMode ? 'Équipe ' + TEAM_LETTER[m.winner] : esc(champ.name || ('P' + (champ.seat + 1)))) : null;
    const title = solo ? 'Entraînement terminé' : (champ ? who + ' rafle le bocal !' : 'Égalité — tout a sauté !');
    const medals = ['🥇', '🥈', '🥉'];
    // MVP : le plus d'éliminations, départage au classement (≥ 1, sinon personne)
    let mvp = null; if (!solo) parts2.forEach(p => { if ((p.kills | 0) > 0 && (!mvp || p.kills > mvp.kills || (p.kills === mvp.kills && p.place < mvp.place))) mvp = p; });
    const rows = parts2.map(p => {
      const col = colSeat(p.seat), medal = medals[p.place - 1] || ('#' + p.place);
      const res = p.alive ? (champ && p.team === champ.team ? 'dernier bonbon debout' : 'survivant·e') : `a sauté à ${Math.round((p.elimTick || 0) / TICK_HZ)}s`;
      return `<div class="erow ${p.alive ? 'win' : ''}"><span class="eplace">${medal}</span>
        <span class="ename" style="color:${col}">${esc(p.name || ('P' + (p.seat + 1)))}${teamMode ? ` <small>Éq.${TEAM_LETTER[p.team]}</small>` : ''}${mvp && mvp.seat === p.seat ? ' <small>⭐ MVP</small>' : ''}</span>
        <span class="estat">⚡ ${p.kills | 0}</span><span class="eres">${res}</span></div>`;
    }).join('');
    const mvpLine = mvp ? `<div class="emeta">⭐ MVP : <b style="color:${colSeat(mvp.seat)}">${esc(mvp.name || ('P' + (mvp.seat + 1)))}</b> — ${mvp.kills} élimination${mvp.kills > 1 ? 's' : ''}</div>` : '';
    endEl.innerHTML = `<div class="etitle" style="color:${champ ? colSeat(champ.seat) : '#fff'}">${title}</div>
      <div class="emeta">⏱ ${m.stats.durationSec}s · ${m.stats.nParts} bombeur${m.stats.nParts > 1 ? 's' : ''}</div>${mvpLine}<div class="elist">${rows}</div>${blocFin(J, { titre: 'Puissance 💣 + 🔥 au fil de la manche', couleur: colSeat, nom: nomSeat })}<div class="ehint">Espace / clic pour rejouer</div>`;
  }
  // Journal tenu à chaque état reçu (aucune donnée serveur en plus) : puissance par bombeur + faits marquants.
  // Le serveur ne dit pas qui a tué qui : on le déduit de la hausse des éliminations (⚡) d'un état à l'autre.
  function jVals(m) { const v = {}; m.players.forEach(p => { if (p.playing) v[p.seat] = p.alive ? (p.bombs | 0) + (p.power | 0) : 0; }); return v; }
  function journal(m, now) {
    if (m.gs === 'lobby' || m.gs === 'countdown') { if (J.actif()) J.fin(); return; }
    if (m.gs === 'play' && !J.actif()) { J.debut(now); jKills = {}; jTot = {}; jLast = 0; jSd = false; }
    if (!J.actif()) return;
    if (m.sd) jSd = true;
    let ev = false; const victims = [];
    (m.fx || []).forEach(f => {
      if (!f) return;
      if (f.type === 'boom') { victims.push(f.seat); ev = true; }
      else if (f.type === 'spawn') { ev = true; J.moment(now, f.seat, 'revient de la revanche', 6); }
      else if (f.type === 'guard') J.moment(now, f.seat, 'encaisse une explosion grâce au bouclier', 2.5);
    });
    m.players.forEach(p => {
      const k = p.kills | 0, k0 = jKills[p.seat]; jKills[p.seat] = k;
      if (k0 == null || k <= k0) return;                 // première vue (arrivée en cours) ou remise à zéro : simple ligne de base
      const d = k - k0, tot = (jTot[p.seat] || 0) + d; jTot[p.seat] = tot;
      if (d >= 2) J.moment(now, p.seat, 'fait sauter ' + d + ' bombeurs d\'un coup', 5 + 2 * d);
      else if (tot === 3) J.moment(now, p.seat, 'signe un triplé : 3 éliminations', 7);
      else { const vs = victims.filter(s => s !== p.seat); J.moment(now, p.seat, vs.length === 1 ? 'fait sauter ' + nomSeat(vs[0]) : 'fait sauter un adversaire', 3); }
    });
    if (ev || now - jLast >= 1000 || m.gs === 'over') { jLast = now; J.echantillon(now, jVals(m), true); }
    if (m.gs === 'over') {
      if (jSd && m.stats && !m.stats.solo) m.players.forEach(p => { if (p.playing && p.alive) J.moment(now, p.seat, 'tient jusqu\'au bout de la mort subite', 4); });
      J.fin();
    }
  }

  // ───────────────────────── état réseau ─────────────────────────
  function onMessage(m) { if (m && m.t === 'welcome') mySeat = m.seat; }
  function onLb(d) { board = (d && d.board) || []; renderLB(); }
  // Suivi des bombes et des flammes d'un instantané à l'autre (le serveur n'envoie pas d'événement
  // « explosion ») : une bombe disparue dont la case flambe = explosion ; une bombe disparue sans flamme
  // et réapparue alignée à quelques cases = poussée (coup de pied) ou lancée (gant).
  function trackBombs(m, now) {
    const nb = new Set();
    (m.blasts || []).forEach(bl => { const k = bl.y * GW + bl.x; nb.add(k); if (!blastBorn.has(k)) blastBorn.set(k, now); });
    Array.from(blastBorn.keys()).forEach(k => { if (!nb.has(k)) blastBorn.delete(k); });
    blastSet = nb;
    const thrown = {}; (m.fx || []).forEach(f => { if (f && f.type === 'throw') thrown[f.y * GW + f.x] = 1; });
    const cur = new Map(); (m.bombs || []).forEach(b => cur.set(b.y * GW + b.x, b));
    const booms = [], moved = [];
    Array.from(bombEnt.keys()).forEach(k => { if (cur.has(k)) return; if (nb.has(k)) booms.push(k); else moved.push(k); bombEnt.delete(k); });
    cur.forEach((b, k) => {
      if (bombEnt.has(k)) return;
      const e = { born: now, ph: Math.random() * 6, t0: 0, dur: 0, fx: 0, fy: 0, arc: false, slid: false };
      for (let i = 0; i < moved.length; i++) {
        const g = moved[i]; if (g < 0) continue;
        const gx = g % GW, gy = (g / GW) | 0, d = Math.abs(gx - b.x) + Math.abs(gy - b.y);
        if ((gx === b.x || gy === b.y) && d >= 1 && d <= 5) { e.t0 = now; e.fx = gx; e.fy = gy; e.arc = !!thrown[k]; e.slid = true; e.dur = e.arc ? 300 : Math.min(260, 70 * d); e.born = e.arc ? now + e.dur : now - 1000; moved[i] = -1; break; }
      }
      bombEnt.set(k, e);
    });
    return booms;
  }
  function onState(m) {
    if (m.gw && m.gw !== GW) { GW = m.gw; GH = m.gh || m.gw; ARENA = GW * CELL; clearFx(); }   // grille redimensionnée (nb de participants)
    if (m.grid === undefined && snap) m.grid = snap.grid;   // delta réseau : grille absente = inchangée
    snap = m; teamMode = m.mode && m.mode !== 'ffa';
    const inGame = m.gs === 'play' || m.gs === 'countdown' || m.gs === 'paused';
    if (inGame !== inGamePrev) { inGamePrev = inGame; document.body.classList.toggle('playing', inGame); resizeCanvas(); }
    document.body.classList.toggle('paused', m.gs === 'paused');
    if (m.gs === 'play' || m.gs === 'countdown') closePanels();
    if (m.round !== prevRound) { prevRound = m.round; buf = []; clearFx(); }
    buf.push({ t: performance.now(), s: m }); if (buf.length > 10) buf.shift();
    const now = performance.now();
    const booms = trackBombs(m, now);
    booms.forEach(k => explodeFx(k % GW, (k / GW) | 0, booms.length));
    if (!A.reduceFx) {                                // un flash par bombe (pas par case) ; une réaction en chaîne partage l'intensité
      const fa = booms.length > 1 ? 0.95 / Math.sqrt(booms.length) : 0.95;
      for (let i = 0; i < booms.length && i < 6; i++) flashes.ajouter(cpx(booms[i] % GW), cpx((booms[i] / GW) | 0), CELL * 3.2, '#ffc864', 560, fa);
    }
    journal(m, now);
    (m.fx || []).forEach(playFx);
    if (prevGs !== 'over' && m.gs === 'over') { sound('win'); music.sting('win'); confettiRain(); }
    if (m.gs === 'countdown' && m.count > 0 && m.count !== lastCount) { music.sting('count'); sound('count'); }   // décompte musical 3·2·1
    if (prevGs === 'countdown' && m.gs === 'play') { music.sting('go'); sound('go'); goAt = now; }
    lastCount = m.count;
    if (m.sd && !prevSd) { music.sting('alert'); msgGlobal('🧱', 'Mort subite : des blocs tombent', { bad: true }); }   // riser + annonce : mort subite
    prevSd = !!m.sd;
    prevGs = m.gs;
    { let inten = 0;                                  // musique : 1 en jeu, 2 dès la mort subite
      if (m.gs === 'play' || m.gs === 'countdown') inten = m.sd ? 2 : 1;
      music.setIntensity(inten); }
    refreshHUD();
    if (m.gs === 'over') { if (!endShown) { showEndscreen(m); endShown = true; } } else { endShown = false; endEl.classList.add('hidden'); }
    const idle = m.gs === 'lobby' || m.gs === 'over';
    startBtn.disabled = !(mySeat >= 0 && idle && m.connected >= 1); startBtn.textContent = m.gs === 'over' ? '↻ Rejouer' : '▶ Démarrer';
    pauseBtn.disabled = !(m.gs === 'play' || m.gs === 'paused'); pauseBtn.textContent = m.gs === 'paused' ? '▶ Reprendre' : '⏸ Pause';
    pauseFloat.textContent = m.gs === 'paused' ? '▶' : '⏸';
    const total = m.connected + (m.botCount || 0);
    if (botsBtn) { botsBtn.disabled = !idle; botsBtn.textContent = '🤖 Bots : ' + (m.botCount || 0); botsBtn.classList.toggle('on', (m.botCount || 0) > 0); }
    if (diffBtn) { diffBtn.disabled = !idle; diffBtn.textContent = '🎯 IA : ' + (DIFF_NAMES[m.botDiff] || 'Normale'); }
    modeBtn.disabled = !(idle && total >= 4 && total <= MAX_SEATS && total % 2 === 0);   // modes d'équipe : 4, 6 ou 8 participants
    modeBtn.textContent = '⚔ ' + (MODE_NAME[m.mode] || m.mode); modeBtn.classList.toggle('on', teamMode);
    genBtn.disabled = !idle; genBtn.textContent = '🧱 ' + (GEN_NAMES[m.gen] || 'Map');
    ffBtn.disabled = !(idle && teamMode); ffBtn.textContent = '🤝 Tir allié : ' + (m.ff ? 'ON' : 'OFF'); ffBtn.classList.toggle('on', !!m.ff);
    if (revBtn) { revBtn.disabled = !idle; revBtn.textContent = '☠ Revanche : ' + (m.revenge ? 'ON' : 'OFF'); revBtn.classList.toggle('on', !!m.revenge); }
  }

  // ───────────────────────── sons (WebAudio, zéro fichier) ─────────────────────────
  function unlockAudio() { if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch {} } if (actx && actx.state === 'suspended') actx.resume(); }
  let sndPan = 0;                                   // pan stéréo du prochain son
  const lastSnd = {};                               // anti-rafale : une réaction en chaîne ne joue pas 20 fois le même son
  const vol = () => (A && typeof A.sfx === 'number') ? A.sfx : 1;
  function out(node) { if (sndPan && actx.createStereoPanner) { const pn = actx.createStereoPanner(); pn.pan.value = Math.max(-1, Math.min(1, sndPan)); pn.connect(actx.destination); node.connect(pn); } else node.connect(actx.destination); }
  function tone(f, d, ty = 'square', g = 0.05, dl = 0) { const v = vol(); if (!actx || v <= 0) return; const t0 = actx.currentTime + dl, o = actx.createOscillator(), gg = actx.createGain(); o.type = ty; o.frequency.setValueAtTime(f, t0); gg.gain.setValueAtTime(g * v, t0); gg.gain.exponentialRampToValueAtTime(0.0001, t0 + d); o.connect(gg); out(gg); o.start(t0); o.stop(t0 + d + 0.02); }
  function sweep(f0, f1, d, ty = 'sine', g = 0.05, dl = 0) { const v = vol(); if (!actx || v <= 0) return; const t0 = actx.currentTime + dl, o = actx.createOscillator(), gg = actx.createGain(); o.type = ty; o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(f1, t0 + d); gg.gain.setValueAtTime(g * v, t0); gg.gain.exponentialRampToValueAtTime(0.0001, t0 + d); o.connect(gg); out(gg); o.start(t0); o.stop(t0 + d + 0.02); }
  function noise(d, type, freq, g, dl = 0, q) {
    const v = vol(); if (!actx || v <= 0) return;
    if (!noiseBuf || noiseBuf.sampleRate !== actx.sampleRate) { const sr = actx.sampleRate, b = actx.createBuffer(1, Math.floor(sr * 1.2), sr), dd = b.getChannelData(0); for (let i = 0; i < dd.length; i++) dd[i] = Math.random() * 2 - 1; noiseBuf = b; }
    const t0 = actx.currentTime + dl, s = actx.createBufferSource(), f = actx.createBiquadFilter(), gg = actx.createGain();
    s.buffer = noiseBuf; f.type = type; f.frequency.value = freq; if (q) f.Q.value = q;
    gg.gain.setValueAtTime(0.0001, t0); gg.gain.exponentialRampToValueAtTime(g * v, t0 + Math.min(0.012, d * 0.2)); gg.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
    s.connect(f); f.connect(gg); out(gg); s.start(t0); s.stop(t0 + d + 0.02);
  }
  function psound(k, gx, arg) { sndPan = Math.max(-1, Math.min(1, (cpx(gx) / ARENA - 0.5) * 1.7)); sound(k, arg); sndPan = 0; }   // son positionné gauche/droite
  function sound(k, arg) {
    if (!actx) return;
    const now = performance.now(); if (lastSnd[k] && now - lastSnd[k] < 45) return; lastSnd[k] = now;
    if (k === 'place') { sweep(170, 520, 0.08, 'sine', 0.07); noise(0.03, 'lowpass', 900, 0.05); }                        // « plop » de bombe posée
    else if (k === 'kick') { noise(0.05, 'bandpass', 1300, 0.12, 0, 1.2); sweep(320, 140, 0.1, 'triangle', 0.05); }        // pichenette
    else if (k === 'throw') { noise(0.2, 'bandpass', 900, 0.06, 0, 0.8); sweep(380, 900, 0.16, 'triangle', 0.03); }          // envol
    else if (k === 'explode') { const n = Math.min(1, (arg || 1) / 3); noise(0.55 + 0.25 * n, 'lowpass', 900, 0.2 + 0.08 * n); sweep(110, 38, 0.45, 'sine', 0.17); noise(0.14, 'highpass', 3200, 0.05, 0.03); }
    else if (k === 'wall') { noise(0.09, 'bandpass', 1800, 0.1, 0, 1.2); noise(0.12, 'bandpass', 700, 0.06, 0.02); tone(1320, 0.06, 'triangle', 0.025, 0.02); tone(1760, 0.07, 'triangle', 0.02, 0.05); }   // boîte qui craque + bonbons qui tintent
    else if (k === 'pickup') { tone(784, 0.1, 'triangle', 0.045); tone(988, 0.1, 'triangle', 0.045, 0.05); tone(1319, 0.16, 'triangle', 0.045, 0.1); tone(2637, 0.12, 'sine', 0.015, 0.14); }
    else if (k === 'bad') { sweep(420, 170, 0.28, 'sawtooth', 0.035); sweep(300, 210, 0.3, 'triangle', 0.04, 0.05); }
    else if (k === 'pouf') { noise(0.38, 'lowpass', 1400, 0.16); sweep(900, 240, 0.36, 'sine', 0.045, 0.02); }                // pouf + sifflet qui descend
    else if (k === 'guard') { sweep(300, 1300, 0.07, 'sine', 0.09); noise(0.04, 'highpass', 4200, 0.05, 0.05); }            // bulle qui éclate
    else if (k === 'warp') { sweep(300, 1400, 0.22, 'sine', 0.04); sweep(1400, 500, 0.2, 'triangle', 0.03, 0.12); }
    else if (k === 'spawn') { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.12, 'triangle', 0.045, i * 0.06)); }
    else if (k === 'drop') { sweep(150, 45, 0.24, 'sine', 0.14); noise(0.18, 'lowpass', 500, 0.08); }                       // bloc qui tombe
    else if (k === 'count') { tone(1250, 0.04, 'triangle', 0.06); tone(820, 0.06, 'sine', 0.05, 0.01); noise(0.12, 'highpass', 5000, 0.02); }   // tic de mèche
    else if (k === 'go') { noise(0.5, 'lowpass', 1000, 0.18); sweep(120, 40, 0.4, 'sine', 0.15); }
    else if (k === 'win') { tone(523, 0.18, 'triangle', 0.06); tone(659, 0.18, 'triangle', 0.06, 0.12); tone(784, 0.3, 'triangle', 0.06, 0.24); tone(1047, 0.4, 'triangle', 0.05, 0.38); tone(2093, 0.3, 'sine', 0.015, 0.42); }
  }

  // ───────────────────────── effets ponctuels ─────────────────────────
  // Annonce d'un ramassage. Règle de partage :
  //  - le crâne 💀 inflige une affliction CONTAGIEUSE (le serveur la transmet au contact) : tout le
  //    monde finit concerné, donc message GLOBAL, quel que soit le ramasseur ;
  //  - tous les autres bonus/malus ne modifient que l'équipement ou la vitesse du ramasseur : message
  //    PERSO si c'est moi, et rien du tout sinon (ce ne serait que du bruit).
  function annoncePick(f) {
    const e = Object.prototype.hasOwnProperty.call(PICK_MSG, f.kind) ? PICK_MSG[f.kind] : null;
    if (!e) return;
    if (f.kind === 'skull') { msgGlobal(e[0], e[1], { bad: true }); return; }
    if (f.seat !== mySeat) return;
    msgPerso(e[0], e[1], { bad: !!f.bad });
  }
  function burst(x, y, n, spd, col, kind, life, size) {   // gerbe radiale générique
    const now = performance.now();
    for (let k = 0; k < n; k++) { const a = Math.random() * TAU, sp = (0.35 + Math.random()) * spd; addP({ k: kind, x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, z: 0, vz: 0, born: now, life: life * (0.7 + Math.random() * 0.6), r: size * (0.7 + Math.random() * 0.6), col, rot: Math.random() * TAU, vr: (Math.random() - 0.5) * 0.4 }); }
  }
  function bits(x, y, n, cols, spd, life) {                // éclats pseudo-3D (hauteur z + gravité)
    const now = performance.now();
    for (let k = 0; k < n; k++) { const a = Math.random() * TAU, sp = (0.4 + Math.random()) * spd; addP({ k: 'bit', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, z: 4 + Math.random() * 6, vz: 1.8 + Math.random() * 2.4, born: now, life: life * (0.75 + Math.random() * 0.5), r: 2 + Math.random() * 2.4, col: cols[k % cols.length], rot: Math.random() * TAU, vr: (Math.random() - 0.5) * 0.5 }); }
  }
  function ring(x, y, r0, r1, life, col, lw, delay) { rings.push({ x, y, r0, r1, born: performance.now() + (delay || 0), life, col, lw }); if (rings.length > 60) rings.shift(); }
  function shake(m) { if (!A.reduceFx) shakeMag = Math.min(9, Math.max(shakeMag, m)); }
  function seatPos(seat, gx, gy) { const an = anim[seat]; return an ? [an.x, an.y] : [cpx(gx), cpx(gy)]; }
  function nearMe(x, y, d) { const an = anim[mySeat]; return !!(an && snap && snap.players[mySeat] && snap.players[mySeat].alive && Math.abs(an.x - x) + Math.abs(an.y - y) < d); }
  function explodeFx(gx, gy, n) {
    psound('explode', gx, n);
    if (A.reduceFx) return;
    const x = cpx(gx), y = cpx(gy);
    shake(2.5 + (nearMe(x, y, CELL * 3) ? 2.5 : 0));
    addP({ k: 'glow', x, y, vx: 0, vy: 0, z: 0, vz: 0, born: performance.now(), life: 200, r: CELL * 1.25, col: '255,200,90', rot: 0, vr: 0 });
    ring(x, y, 6, CELL * 0.95, 320, '255,236,170', 4);
    burst(x, y, 9, 4.2, '255,190,70', 'spark', 280, 1);
    burst(x, y, 4, 0.7, '70,52,60', 'puff', 900, 5);
    scorch.push({ x, y, born: performance.now() }); if (scorch.length > 50) scorch.shift();
  }
  function confettiRain() {
    if (A.reduceFx) return; const now = performance.now();
    for (let k = 0; k < 70; k++) addP({ k: 'conf', x: Math.random() * ARENA, y: -10 - Math.random() * 140, vx: (Math.random() - 0.5) * 0.6, vy: 0.7 + Math.random() * 0.9, z: 0, vz: 0, born: now, life: 2600 + Math.random() * 1200, r: 2.2 + Math.random() * 1.6, col: CANDY[k % CANDY.length], rot: Math.random() * TAU, vr: (Math.random() - 0.5) * 0.3 });
  }
  function playFx(f) {
    if (!f) return;
    const now = performance.now();
    if (f.type === 'place' || f.type === 'throw') {
      const e = bombEnt.get(f.y * GW + f.x), slid = !!(e && e.slid && e.t0 === now);
      psound(f.type === 'throw' ? 'throw' : (slid ? 'kick' : 'place'), f.x);
      if (!A.reduceFx && f.type === 'place' && !slid) burst(cpx(f.x), cpx(f.y) + 8, 4, 0.8, '255,244,226', 'puff', 420, 3);
      return;
    }
    if (f.type === 'wall') {
      psound('wall', f.x);
      if (A.reduceFx) return;
      wallAnims.push({ x: f.x, y: f.y, born: now }); if (wallAnims.length > 30) wallAnims.shift();
      const v = BOXV[boxVar(f.x, f.y)], x = cpx(f.x), y = cpx(f.y);
      bits(x, y, 9, [v.a, v.b, v.rib, CANDY[(f.x + f.y) % CANDY.length]], 2.4, 700);
      burst(x, y, 3, 0.6, '255,246,236', 'puff', 520, 5);
      return;
    }
    if (f.type === 'warp') {
      psound('warp', f.x);
      if (A.reduceFx) return;
      const from = anim[f.seat], x = cpx(f.x), y = cpx(f.y);
      if (from && Math.abs(from.x - x) + Math.abs(from.y - y) > CELL) { ring(from.x, from.y, CELL * 0.6, 3, 260, '197,139,255', 3); if (anim[f.seat]) { anim[f.seat].x = x; anim[f.seat].y = y; } }
      ring(x, y, 3, CELL * 0.75, 380, '197,139,255', 3);
      flashes.ajouter(x, y, CELL * 2.2, '#b07cff', 420, 0.6);
      burst(x, y, 8, 2.2, '200,150,255', 'glow', 420, 6);
      return;
    }
    if (f.type === 'guard') {                          // bouclier : la bulle éclate
      const [x, y] = seatPos(f.seat, f.x, f.y);
      psound('guard', f.x);
      if (A.reduceFx) return;
      ring(x, y, 14, 26, 300, '160,215,255', 3);
      flashes.ajouter(x, y, CELL * 1.8, '#8fd0ff', 360, 0.5);
      burst(x, y, 10, 2.6, '150,210,255', 'glow', 360, 4);
      return;
    }
    if (f.type === 'spawn') {                          // retour de revanche : confettis du siège
      psound('spawn', f.x);
      if (A.reduceFx) return;
      const x = cpx(f.x), y = cpx(f.y), col = colSeat(f.seat);
      ring(x, y, 4, CELL * 0.8, 420, rgbKey(col), 3);
      flashes.ajouter(x, y, CELL * 2.4, col, 520, 0.55);
      bits(x, y, 12, [col, K.cream, K.lemon], 2.2, 800);
      burst(x, y, 6, 1.6, '255,246,200', 'glow', 420, 5);
      return;
    }
    if (f.type === 'drop') {                           // mort subite : le bloc tombe (ombre qui grandit, puis impact)
      const i = spiralIdx ? spiralIdx[f.y * GW + f.x] : null;
      if (i != null && i >= lastDrop.i) lastDrop = { i, t: now };
      if (A.reduceFx) { psound('drop', f.x); return; }
      dropAnims.push({ x: f.x, y: f.y, born: now }); dropVer++;
      if (dropAnims.length > 12) { dropAnims.shift(); dropVer++; }
      return;
    }
    if (f.type === 'pickup') {
      sound(f.bad ? 'bad' : 'pickup'); annoncePick(f);
      if (A.reduceFx) return;
      const x = cpx(f.x), y = cpx(f.y), col = PICK_COL[f.kind] || '#ffffff';
      if (f.bad) { ring(x, y, 4, CELL * 0.6, 360, '255,74,90', 3); burst(x, y, 5, 0.8, '110,50,130', 'puff', 700, 5); }
      else { ring(x, y, 4, CELL * 0.65, 360, rgbKey(col), 3); burst(x, y, 9, 2.4, rgbKey(mixHex(col, '#ffffff', 0.4)), 'glow', 420, 4); }
      return;
    }
    if (f.type === 'boom') {                           // élimination : « pouf » cartoon
      const [x, y] = seatPos(f.seat, f.x, f.y);
      psound('pouf', f.x); music.sting('kill');
      poofs.push({ x, y, seat: f.seat, name: snap ? nomAvatar(snap.players[f.seat]) : null, born: now, an: anim[f.seat] ? { dir: anim[f.seat].dir, ph: 0, mv: false } : null }); if (poofs.length > 12) poofs.shift();
      if (A.reduceFx) return;
      shake(f.seat === mySeat ? 9 : 5);
      const col = colSeat(f.seat);
      bits(x, y, 12, [col, K.cream, K.lemon, K.pink], 2.8, 900);
      burst(x, y, 6, 2, '255,240,190', 'glow', 380, 5);
    }
  }

  // ───────────────────────── interpolation ─────────────────────────
  function viewPlayers(now) {
    if (buf.length === 0) return null;
    const target = now - INTERP_MS; let a = buf[0], b = buf[buf.length - 1];
    for (let i = 0; i < buf.length; i++) if (buf[i].t <= target) a = buf[i];
    for (let i = buf.length - 1; i >= 0; i--) if (buf[i].t >= target) b = buf[i];
    const span = b.t - a.t; let al = span > 0 ? (target - a.t) / span : 0; al = al < 0 ? 0 : al > 1 ? 1 : al;
    const out2 = {};
    b.s.players.forEach(pb => { if (!pb.playing) return; const pa = a.s.players[pb.seat]; let x = pb.x, y = pb.y; if (pa && pa.playing && Math.hypot(pb.x - pa.x, pb.y - pa.y) < 60) { x = pa.x + (pb.x - pa.x) * al; y = pa.y + (pb.y - pa.y) * al; } out2[pb.seat] = { x, y }; });
    return out2;
  }
  function rangeCells(g, bx, by, power) {                 // prévisualisation de portée (s'arrête comme le serveur)
    const out2 = [];
    for (const [dx, dy] of DIRS4) for (let r = 1; r <= power; r++) {
      const gx = bx + dx * r, gy = by + dy * r; if (gx < 0 || gy < 0 || gx >= GW || gy >= GH) break;
      const c = g[gy * GW + gx]; if (c === '1') break; out2.push([gx, gy]); if (c === '2') break;
    }
    return out2;
  }

  // ───────────────────────── sprites pré-rendus (repère 40 × 40 par case) ─────────────────────────
  let spr = null, sprKey = '';
  const glowCache = {};
  function mkSprite(fn, w, h) {
    const sc = cv.width / ARENA * CELL / 40, c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil((w || 40) * sc)); c.height = Math.max(1, Math.ceil((h || 40) * sc));
    const g = c.getContext('2d'); g.setTransform(sc, 0, 0, sc, 0, 0); fn(g); return c;
  }
  function glowSpr(rgb) {                             // halo radial (remplace shadowBlur, trop coûteux en boucle)
    let c = glowCache[rgb]; if (c) return c;
    c = document.createElement('canvas'); c.width = c.height = 48;
    const g = c.getContext('2d'), gr = g.createRadialGradient(24, 24, 0, 24, 24, 24);
    gr.addColorStop(0, 'rgba(' + rgb + ',1)'); gr.addColorStop(0.35, 'rgba(' + rgb + ',0.45)'); gr.addColorStop(1, 'rgba(' + rgb + ',0)');
    g.fillStyle = gr; g.fillRect(0, 0, 48, 48); return (glowCache[rgb] = c);
  }
  function ensureSprites() {
    const key = cv.width + '|' + ARENA + '|' + (A.contrast ? 1 : 0);
    if (spr && key === sprKey) return;
    sprKey = key; bgKey = ''; terrainKey = '';
    const OL = A.contrast ? '#0b0306' : 'rgba(35,14,4,0.95)', LW = A.contrast ? 2.4 : 1.5;
    spr = { tok: {} };
    spr.choco = mkSprite(g => {                       // pilier : carré de chocolat (4 carreaux, face avant, reflet)
      g.fillStyle = '#3a1b0c'; g.beginPath(); rr(g, 2, 4, 36, 34, 6); g.fill();
      const tg = g.createLinearGradient(0, 2, 0, 33); tg.addColorStop(0, '#83502e'); tg.addColorStop(1, '#5c2f18');
      g.fillStyle = tg; g.beginPath(); rr(g, 2, 2, 36, 31, 6); g.fill();
      for (const i of [0, 1]) for (const j of [0, 1]) {
        const x = 5.5 + i * 15, y = 5 + j * 13.2, w = 14, h = 11.6;
        g.fillStyle = '#6e3c20'; g.beginPath(); rr(g, x, y, w, h, 2.4); g.fill();
        g.fillStyle = 'rgba(255,214,170,0.26)'; g.fillRect(x + 2, y + 1, w - 4, 1.4);
        g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x + 2, y + h - 1.6, w - 4, 1.4);
      }
      g.fillStyle = 'rgba(255,255,255,0.16)'; g.beginPath(); oval(g, 12, 7.2, 6.5, 1.5); g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 1; g.beginPath(); g.moveTo(4, 33.5); g.lineTo(36, 33.5); g.stroke();
      g.strokeStyle = OL; g.lineWidth = LW; g.beginPath(); rr(g, 2, 2, 36, 36, 6); g.stroke();
    });
    spr.biscuit = mkSprite(g => {                     // bordure : petit-beurre doré, trous de piquage, sucre
      const r = rng(0xb15c);
      g.fillStyle = '#9a5f2a'; g.beginPath(); rr(g, 1, 3, 38, 36, 5); g.fill();
      const tg = g.createLinearGradient(0, 1, 0, 34); tg.addColorStop(0, '#eab872'); tg.addColorStop(1, '#c98b45');
      g.fillStyle = tg; g.beginPath(); rr(g, 1, 1, 38, 33, 5); g.fill();
      g.strokeStyle = 'rgba(255,236,190,0.45)'; g.lineWidth = 1.2; g.beginPath(); rr(g, 4, 4, 32, 27, 3.5); g.stroke();
      for (const [x, y] of [[11, 10], [29, 10], [20, 17.5], [11, 25], [29, 25]]) { g.fillStyle = '#8a5324'; g.beginPath(); g.arc(x, y, 1.6, 0, TAU); g.fill(); g.fillStyle = 'rgba(255,230,180,0.55)'; g.fillRect(x - 1, y + 1.4, 2, 0.8); }
      g.fillStyle = 'rgba(255,250,235,0.6)'; for (let k = 0; k < 12; k++) g.fillRect(3 + r() * 33, 3 + r() * 28, 0.9, 0.9);
      g.strokeStyle = OL; g.lineWidth = LW; g.beginPath(); rr(g, 1, 1, 38, 38, 5); g.stroke();
    });
    spr.box = BOXV.map(v => mkSprite(g => {           // caisse cassable : boîte de bonbons rayée, ruban, nœud
      g.fillStyle = v.dk; g.beginPath(); rr(g, 4, 7, 32, 30, 4); g.fill();
      g.save(); g.beginPath(); rr(g, 4, 4, 32, 29, 4); g.clip();
      g.fillStyle = v.b; g.fillRect(4, 4, 32, 29);
      g.strokeStyle = v.a; g.lineWidth = 3.6; g.beginPath(); for (let k = -36; k < 40; k += 8) { g.moveTo(k, 4); g.lineTo(k + 32, 36); } g.stroke();
      g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(4, 11.5, 32, 1.8); g.fillStyle = 'rgba(255,255,255,0.4)'; g.fillRect(4, 10.5, 32, 1);
      g.restore();
      g.fillStyle = v.rib; g.fillRect(18, 4, 4, 33); g.fillRect(4, 18.5, 32, 4);
      g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(18, 33, 4, 4); g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(18, 4, 1.2, 29);
      g.strokeStyle = OL; g.lineWidth = LW; g.beginPath(); rr(g, 4, 4, 32, 33, 4); g.stroke();
      g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 1; g.beginPath(); g.moveTo(5, 33.2); g.lineTo(35, 33.2); g.stroke();
      g.fillStyle = v.rib; g.strokeStyle = OL; g.lineWidth = 1.1;
      g.beginPath(); oval(g, 16, 5.6, 3.8, 2.6); g.fill(); g.stroke(); g.beginPath(); oval(g, 24, 5.6, 3.8, 2.6); g.fill(); g.stroke();
      g.beginPath(); g.arc(20, 6, 1.9, 0, TAU); g.fill(); g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.5)'; g.beginPath(); oval(g, 10, 8, 3.4, 1.1); g.fill();
    }));
    spr.warp = mkSprite(g => {                        // socle du téléporteur (la sucette tourne en direct)
      const gr = g.createRadialGradient(20, 21, 2, 20, 21, 15); gr.addColorStop(0, '#120a20'); gr.addColorStop(1, '#3a2358');
      g.fillStyle = gr; g.beginPath(); g.arc(20, 21, 14.5, 0, TAU); g.fill();
      g.strokeStyle = '#c58bff'; g.lineWidth = 3; g.stroke();
      g.strokeStyle = OL; g.lineWidth = LW; g.beginPath(); g.arc(20, 21, 16.2, 0, TAU); g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); oval(g, 13, 12.5, 3.5, 1.3); g.fill();
    });
    spr.swirl = mkSprite(g => {                       // sucette tourbillon
      g.save(); g.beginPath(); g.arc(20, 20, 10.5, 0, TAU); g.clip();
      g.fillStyle = '#fff6fb'; g.fillRect(8, 8, 24, 24);
      ['#ff6fb1', '#9b5cf0', '#57d6ff'].forEach((c, j) => { g.strokeStyle = c; g.lineWidth = 3.2; g.beginPath(); for (let i = 0; i <= 24; i++) { const a = j * TAU / 3 + i * 0.26, r = i * 0.5; const px = 20 + Math.cos(a) * r, py = 20 + Math.sin(a) * r; if (i === 0) g.moveTo(px, py); else g.lineTo(px, py); } g.stroke(); });
      g.restore();
      g.strokeStyle = OL; g.lineWidth = 1.3; g.beginPath(); g.arc(20, 20, 10.5, 0, TAU); g.stroke();
    });
    const bombBody = remote => g => {                 // bombe noire lustrée (centre 20,21 ; rayon 11,5)
      g.save(); g.translate(26.3, 9.6); g.rotate(0.6); g.fillStyle = '#8f95ad'; g.beginPath(); rr(g, -3.6, -2.6, 7.2, 5.2, 1.2); g.fill(); g.strokeStyle = OL; g.lineWidth = 1.2; g.stroke(); g.fillStyle = 'rgba(255,255,255,0.4)'; g.fillRect(-2.6, -1.8, 5, 1); g.restore();
      const bg = g.createRadialGradient(16, 16, 1, 20, 21, 12.5);
      if (remote) { bg.addColorStop(0, '#7fb2c2'); bg.addColorStop(0.5, '#23495a'); bg.addColorStop(1, '#0a171d'); } else { bg.addColorStop(0, '#6c6884'); bg.addColorStop(0.5, '#2a2638'); bg.addColorStop(1, '#0f0d18'); }
      g.fillStyle = bg; g.beginPath(); g.arc(20, 21, 11.5, 0, TAU); g.fill();
      g.strokeStyle = OL; g.lineWidth = LW; g.stroke();
      g.save(); g.translate(15.5, 15.8); g.rotate(-0.7); g.fillStyle = 'rgba(255,255,255,0.55)'; g.beginPath(); oval(g, 0, 0, 3.4, 2); g.fill(); g.restore();
      g.fillStyle = 'rgba(255,255,255,0.28)'; g.beginPath(); g.arc(13.4, 21, 1, 0, TAU); g.fill();
    };
    spr.bomb = mkSprite(bombBody(false)); spr.bombR = mkSprite(bombBody(true));
    spr.cloud = document.createElement('canvas'); spr.cloud.width = 104; spr.cloud.height = 56;
    { const g = spr.cloud.getContext('2d'); for (const [x, y, r] of [[52, 30, 26], [30, 32, 18], [74, 26, 20]]) { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(8,26,18,1)'); gr.addColorStop(0.6, 'rgba(8,26,18,0.7)'); gr.addColorStop(1, 'rgba(8,26,18,0)'); g.fillStyle = gr; g.fillRect(0, 0, 104, 56); } }
    spr.scorch = document.createElement('canvas'); spr.scorch.width = spr.scorch.height = 48;
    { const g = spr.scorch.getContext('2d'), gr = g.createRadialGradient(24, 24, 2, 24, 24, 24); gr.addColorStop(0, 'rgba(60,24,10,0.9)'); gr.addColorStop(0.5, 'rgba(90,40,14,0.5)'); gr.addColorStop(1, 'rgba(90,40,14,0)'); g.fillStyle = gr; g.fillRect(0, 0, 48, 48); }
  }
  function tokSpr(t, bad) {                           // bonus = bonbon emballé ; malus = bonbon piquant sombre
    const key = t + (bad ? '!' : ''); if (spr.tok[key]) return spr.tok[key];
    const acc = PICK_COL[t] || '#999999', OL = A.contrast ? '#0b0306' : K.ink;
    return (spr.tok[key] = mkSprite(g => {
      g.lineJoin = 'round'; g.lineCap = 'round';
      if (!bad) {
        const wr = mixHex(acc, '#ffffff', 0.35);
        for (const s of [-1, 1]) {
          g.beginPath(); g.moveTo(20 + s * 9, 16.5); g.lineTo(20 + s * 18.5, 10.5); g.quadraticCurveTo(20 + s * 15.5, 20, 20 + s * 18.5, 29.5); g.lineTo(20 + s * 9, 23.5); g.closePath();
          g.fillStyle = wr; g.fill(); g.strokeStyle = OL; g.lineWidth = 1.3; g.stroke();
          g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 0.9; g.beginPath(); g.moveTo(20 + s * 10.5, 18.5); g.lineTo(20 + s * 16.5, 14); g.moveTo(20 + s * 10.5, 21.5); g.lineTo(20 + s * 16.5, 26); g.stroke();
        }
        g.beginPath(); g.arc(20, 20, 11.2, 0, TAU); g.fillStyle = acc; g.fill(); g.lineWidth = A.contrast ? 2.2 : 1.4; g.strokeStyle = OL; g.stroke();
        g.beginPath(); g.arc(20, 20, 8.8, 0, TAU); g.fillStyle = '#fff7e8'; g.fill();
      } else {
        g.beginPath(); for (let i = 0; i < 20; i++) { const a = i / 20 * TAU - Math.PI / 2, r = i % 2 ? 11 : 15.5; if (i === 0) g.moveTo(20 + Math.cos(a) * r, 20 + Math.sin(a) * r); else g.lineTo(20 + Math.cos(a) * r, 20 + Math.sin(a) * r); } g.closePath();
        g.fillStyle = '#6a2a8a'; g.fill(); g.strokeStyle = OL; g.lineWidth = 1.3; g.stroke();
        g.beginPath(); g.arc(20, 20, 10.6, 0, TAU); g.fillStyle = '#2e1435'; g.fill(); g.strokeStyle = '#ff4a5a'; g.lineWidth = A.contrast ? 2.8 : 2; g.stroke();
      }
      g.fillStyle = 'rgba(255,255,255,0.55)'; g.beginPath(); oval(g, 15.5, 13.2, 3, 1.3); g.fill();
      drawPickIcon(g, t, 20, 20.3, 10.5);
    }));
  }

  // ───────────────────────── décor statique pré-rendu ─────────────────────────
  // Deux étages : le SOL (glaçage menthe, biseaux, vermicelles, ~1500 tracés) cuit une fois par taille /
  // contraste ; puis le TERRAIN = sol + ombres portées + blocs (drawImage de sprites), recomposé seulement
  // quand la grille change (caisse cassée, bloc tombé).
  let bgCv = null, bgKey = '', terrainCv = null, terrainKey = '', warpCells = [], solidCells = [], dropVer = 0;
  let spiral = null, spiralKey = '', spiralIdx = null;
  function ensureSpiral() { const key = GW + 'x' + GH; if (spiralKey === key) return; spiralKey = key; spiral = buildSpiral(); spiralIdx = {}; spiral.forEach((c, i) => { spiralIdx[c[1] * GW + c[0]] = i; }); }
  function ensureBg() {
    const key = cv.width + '|' + GW + '|' + GH + '|' + (A.contrast ? 1 : 0);
    if (bgCv && key === bgKey) return;
    bgKey = key; terrainKey = '';
    if (!bgCv) bgCv = document.createElement('canvas');
    bgCv.width = cv.width; bgCv.height = cv.height;
    const g = bgCv.getContext('2d'), rnd = rng(0xb0b + GW * 31);
    g.setTransform(cv.width / ARENA, 0, 0, cv.width / ARENA, 0, 0);
    g.fillStyle = K.bg; g.fillRect(0, 0, ARENA, ARENA);
    const spr2 = [[], [], [], [], []], SPR = [K.pink, K.lemon, K.sky, K.cream, '#c79bff'];
    for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) {
      const x = gx * CELL, y = gy * CELL;
      g.fillStyle = ((gx + gy) & 1) ? K.floor : K.floor2; g.fillRect(x, y, CELL, CELL);
      g.fillStyle = 'rgba(255,255,255,0.07)'; g.fillRect(x, y, CELL, 1.5); g.fillRect(x, y, 1.5, CELL);          // biseau éclairé (haut-gauche)
      g.fillStyle = 'rgba(0,30,10,0.14)'; g.fillRect(x, y + CELL - 1.5, CELL, 1.5); g.fillRect(x + CELL - 1.5, y, 1.5, CELL);
      g.fillStyle = 'rgba(255,255,255,0.035)'; g.beginPath(); oval(g, x + 8 + rnd() * 24, y + 8 + rnd() * 24, 6 + rnd() * 6, 3 + rnd() * 3); g.fill();   // glaçage marbré
      if (!A.contrast) for (let k = 0; k < 3; k++) { const a = rnd() * Math.PI, px = x + 5 + rnd() * 30, py = y + 5 + rnd() * 30; spr2[(rnd() * 5) | 0].push(px, py, px + Math.cos(a) * 3.2, py + Math.sin(a) * 3.2); }
    }
    g.lineCap = 'round'; g.lineWidth = 1.6; g.globalAlpha = 0.32;                                                  // vermicelles de sucre (5 couleurs, 5 tracés)
    spr2.forEach((L, i) => { if (!L.length) return; g.strokeStyle = SPR[i]; g.beginPath(); for (let j = 0; j < L.length; j += 4) { g.moveTo(L[j], L[j + 1]); g.lineTo(L[j + 2], L[j + 3]); } g.stroke(); });
    g.globalAlpha = 1;
  }
  function ensureTerrain() {
    ensureSprites(); ensureBg(); ensureSpiral();
    const key = bgKey + '|' + snap.grid + '|' + dropVer;
    if (terrainCv && key === terrainKey) return;
    terrainKey = key;
    if (!terrainCv) terrainCv = document.createElement('canvas');
    terrainCv.width = cv.width; terrainCv.height = cv.height;
    const g = terrainCv.getContext('2d'), grid = snap.grid;
    g.setTransform(cv.width / ARENA, 0, 0, cv.width / ARENA, 0, 0);
    g.drawImage(bgCv, 0, 0, ARENA, ARENA);
    const hidden = {}; dropAnims.forEach(d => { hidden[d.y * GW + d.x] = 1; });   // bloc encore en chute : dessiné en direct
    warpCells = []; solidCells = [];
    g.fillStyle = 'rgba(8,24,14,0.34)'; g.beginPath();                                                             // ombres portées vers le bas-droite
    for (let i = 0; i < GW * GH; i++) { const c = grid[i]; if ((c === '1' || c === '2') && !hidden[i]) rr(g, (i % GW) * CELL + 5, ((i / GW) | 0) * CELL + 6, CELL - 3, CELL - 3, 6); }
    g.fill();
    for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) {
      const i = gy * GW + gx, c = grid[i], x = gx * CELL, y = gy * CELL;
      if (c === '1') { if (hidden[i]) continue; const edge = gx === 0 || gy === 0 || gx === GW - 1 || gy === GH - 1; g.drawImage(edge ? spr.biscuit : spr.choco, x, y, CELL, CELL); if (!edge) solidCells.push(i); }
      else if (c === '2') g.drawImage(spr.box[boxVar(gx, gy)], x, y, CELL, CELL);
      else if (c === '3') { g.drawImage(spr.warp, x, y, CELL, CELL); warpCells.push([gx, gy]); }
    }
    const vg = g.createRadialGradient(ARENA / 2, ARENA / 2, ARENA * 0.35, ARENA / 2, ARENA / 2, ARENA * 0.75);   // vignette douce (les coins = départs : elle reste légère)
    vg.addColorStop(0, 'rgba(12,4,20,0)'); vg.addColorStop(1, 'rgba(12,4,20,' + (A.contrast ? 0.12 : 0.3) + ')');
    g.fillStyle = vg; g.fillRect(0, 0, ARENA, ARENA);
    g.strokeStyle = 'rgba(35,19,38,0.9)'; g.lineWidth = 3; g.strokeRect(1.5, 1.5, ARENA - 3, ARENA - 3);
  }

  // ───────────────────────── mèche (partagée : bombes, écran titre, compte à rebours, pause) ─────────────────────────
  // Repère : centre de la bombe, s = échelle (1 = bombe de jeu). frac = longueur restante (0..1).
  function fuseAt(t) { const u = 1 - t; return [u * u * 6.2 + 2 * u * t * 12.5 + t * t * 7.5, u * u * -10.3 + 2 * u * t * -16 + t * t * -21.5]; }
  function drawFuse(s, frac, lit, now, seed) {
    frac = Math.max(0.08, Math.min(1, frac));
    ctx.beginPath(); ctx.moveTo(6.2 * s, -10.3 * s);
    for (let i = 1; i <= 6; i++) { const p = fuseAt(frac * i / 6); ctx.lineTo(p[0] * s, p[1] * s); }
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = K.ink; ctx.lineWidth = 2.8 * s; ctx.stroke(); ctx.strokeStyle = '#e0bb72'; ctx.lineWidth = 1.4 * s; ctx.stroke();
    const tip = fuseAt(frac), tx = tip[0] * s, ty = tip[1] * s;
    if (!lit) { ctx.fillStyle = '#3a3036'; ctx.beginPath(); ctx.arc(tx, ty, 1.3 * s, 0, TAU); ctx.fill(); return; }
    const fl = FX ? 0.75 + 0.25 * Math.sin(now / 45 + seed) + 0.15 * Math.sin(now / 23 + seed * 2) : 1;
    if (FX) { const gs = 15 * s * fl; ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(glowSpr('255,170,60'), tx - gs / 2, ty - gs / 2, gs, gs); ctx.restore(); }
    ctx.strokeStyle = '#ffe38a'; ctx.lineWidth = Math.max(0.8, 0.9 * s); ctx.beginPath();
    const rot = FX ? now / 90 + seed : 0.4;
    for (let k = 0; k < 4; k++) { const a = rot + k * Math.PI / 2, r0 = 1.6 * s, r1 = 4.6 * s * fl; ctx.moveTo(tx + Math.cos(a) * r0, ty + Math.sin(a) * r0); ctx.lineTo(tx + Math.cos(a) * r1, ty + Math.sin(a) * r1); }
    ctx.stroke();
    ctx.fillStyle = '#ffd36e'; ctx.beginPath(); ctx.arc(tx, ty, 2 * s * fl, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fffbe8'; ctx.beginPath(); ctx.arc(tx, ty, 1 * s * fl, 0, TAU); ctx.fill();
  }
  function bigBomb(cx, cy, R, frac, lit, now) {      // bombe géante (écrans), dessinée au sprite + mèche
    const s = R / 11.5;
    ctx.save(); ctx.translate(cx, cy);
    ctx.fillStyle = 'rgba(10,4,16,0.35)'; ctx.beginPath(); oval(ctx, 2 * s, 11.5 * s, 10 * s, 3 * s); ctx.fill();
    ctx.drawImage(spr.bomb, -20 * s, -21 * s, 40 * s, 40 * s);
    drawFuse(s, frac, lit, now, 3);
    ctx.restore();
  }

  // ───────────────────────── personnages ─────────────────────────
  let seatCache = {}, seatN = 0;
  function seatStyle(seat, col) {                    // dégradés en repère local (réutilisables d'une image à l'autre)
    const key = seat + '|' + col; if (seatCache[key]) return seatCache[key];
    if (++seatN > 60) { seatCache = {}; seatN = 0; }
    const c = hexRgb(col);
    const hg = ctx.createRadialGradient(-3.5, -10.5, 0.5, 0, -6.5, 10.5);
    hg.addColorStop(0, rgbStr(mix(c, [255, 255, 255], 0.55))); hg.addColorStop(0.55, col); hg.addColorStop(1, rgbStr(mix(c, [0, 0, 0], 0.32)));
    const bg = ctx.createLinearGradient(0, -2, 0, 11.5); bg.addColorStop(0, rgbStr(mix(c, [0, 0, 0], 0.06))); bg.addColorStop(1, rgbStr(mix(c, [0, 0, 0], 0.4)));
    return (seatCache[key] = { head: hg, body: bg, light: rgbStr(mix(c, [255, 255, 255], 0.62)), col });
  }
  // Bombeur vu de 3/4 dessus : casque à la couleur du siège (motif du siège par-dessus), visière crème
  // tournée dans le sens de la marche, antenne à pompon, corps, ceinture, mains, pieds qui marchent.
  // o : { an, alpha, scale, shadow, me, crown, ghost, invuln, shield, kick, throw, remote, line, rev, slow, auto, skull, speed }
  function drawBomber(seat, x, y, o, now) {
    const S = seatStyle(seat, colSeat(seat)), an = o.an, dir = an ? an.dir : 1, mv = !!(an && an.mv) && FX === 1, ph = an ? an.ph : 0, DV = DIRV[dir];
    ctx.save(); ctx.translate(x, y);
    let al = o.alpha == null ? 1 : o.alpha;
    if (o.ghost) al *= FX ? 0.52 + 0.08 * Math.sin(now / 160) : 0.55;
    if (o.invuln) al *= FX ? 0.45 + 0.45 * (0.5 + 0.5 * Math.sin(now / 70)) : 0.7;
    ctx.globalAlpha = al;
    // ── au sol
    if (o.slow) { ctx.fillStyle = 'rgba(196,118,40,0.8)'; ctx.beginPath(); oval(ctx, 0, 12, 15, 5.5); ctx.fill(); ctx.fillStyle = 'rgba(255,205,130,0.55)'; ctx.beginPath(); oval(ctx, -4.5, 10.8, 5, 1.4); ctx.fill(); }   // flaque de caramel
    if (o.shadow !== false) { ctx.fillStyle = 'rgba(16,8,28,0.3)'; ctx.beginPath(); oval(ctx, 1.5, 12, 11, 4); ctx.fill(); }
    if (o.me) { ctx.save(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.6; ctx.globalAlpha = al * (FX ? 0.6 + 0.35 * Math.sin(now / 200) : 0.85); ctx.setLineDash([4, 3]); ctx.lineDashOffset = FX ? -now / 50 : 0; ctx.beginPath(); oval(ctx, 0, 12, 15, 5.6); ctx.stroke(); ctx.restore(); }
    if (o.skull) { ctx.save(); ctx.strokeStyle = '#c070f0'; ctx.lineWidth = 2; ctx.globalAlpha = al * (FX ? 0.45 + 0.3 * Math.sin(now / 120) : 0.6); ctx.setLineDash([3, 3]); ctx.lineDashOffset = FX ? now / 40 : 0; ctx.beginPath(); ctx.arc(0, 0, 16, 0, TAU); ctx.stroke(); ctx.restore(); }   // miasme contagieux
    if (o.speed >= 1 && mv) {                           // traits de vitesse derrière
      ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1.6; ctx.lineCap = 'round'; ctx.beginPath();
      for (let k = 0; k < Math.min(3, o.speed); k++) { const off = (k - 1) * 5, px = -DV[1] * off, py = DV[0] * off; ctx.moveTo(-DV[0] * 12 + px, -DV[1] * 12 + py + 2); ctx.lineTo(-DV[0] * (19 + 3 * k) + px, -DV[1] * (19 + 3 * k) + py + 2); }
      ctx.stroke(); ctx.restore();
    }
    if (o.scale) ctx.scale(o.scale, o.scale);
    const bob = mv ? -Math.abs(Math.sin(ph)) * 1.8 : 0, hy = -6.5;
    ctx.translate(0, bob);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    if (A.contrast) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 3.4; ctx.beginPath(); ctx.arc(0, hy, 10, 0, TAU); oval(ctx, 0, 4.5, 8.2, 6.8); ctx.stroke(); }
    // ── pieds (pas alternés dans l'axe de la marche) ; bottes jaunes = coup de pied
    const st = mv ? Math.sin(ph) * 2.2 : 0, fxo = DV[0] * st, fyo = DV[1] * st;
    ctx.fillStyle = o.kick ? '#ffb52e' : '#2b2140'; ctx.strokeStyle = K.ink; ctx.lineWidth = 1.2;
    ctx.beginPath(); oval(ctx, -4.6 + fxo, 10.5 + fyo, 3.7, 2.7); ctx.fill(); ctx.stroke();
    ctx.beginPath(); oval(ctx, 4.6 - fxo, 10.5 - fyo, 3.7, 2.7); ctx.fill(); ctx.stroke();
    // ── corps + ceinture
    ctx.beginPath(); oval(ctx, 0, 4.5, 8.2, 6.8); ctx.fillStyle = S.body; ctx.fill();
    ctx.save(); ctx.clip(); ctx.fillStyle = K.cream; ctx.fillRect(-9, 5.2, 18, 2.6); ctx.fillStyle = '#e0bb72'; ctx.fillRect(-1.6, 5, 3.2, 3);
    if (o.line) { ctx.fillStyle = '#231f30'; ctx.beginPath(); for (const bx of [-5, 5]) { ctx.moveTo(bx + 1.8, 6.5); ctx.arc(bx, 6.5, 1.8, 0, TAU); } ctx.fill(); }   // cartouchière de bombes
    ctx.restore();
    ctx.strokeStyle = K.ink; ctx.lineWidth = 1.4; ctx.beginPath(); oval(ctx, 0, 4.5, 8.2, 6.8); ctx.stroke();
    // ── mains (balancement opposé aux pieds) ; gants blancs = gant de lancer
    const hs = mv ? Math.sin(ph) * 1.6 : 0, hr = o.throw ? 3.7 : 2.6;
    ctx.fillStyle = o.throw ? '#ffffff' : S.light; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(-9.3, 4 + hs, hr, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(9.3, 4 - hs, hr, 0, TAU); ctx.fill(); ctx.stroke();
    if (o.throw) { ctx.fillStyle = '#ff8fc8'; ctx.fillRect(-11.2, 6.2 + hs, 3.8, 1.4); ctx.fillRect(7.4, 6.2 - hs, 3.8, 1.4); }
    // ── antenne + pompon (LED clignotante = détonateur)
    ctx.strokeStyle = K.ink; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(0, hy - 9.5); ctx.lineTo(1.6, hy - 14.5); ctx.stroke();
    if (o.remote) {
      const on = !FX || (now % 800) < 420;
      ctx.fillStyle = on ? '#ff3b3b' : '#6b1a1a'; ctx.beginPath(); ctx.arc(1.6, hy - 15.5, 2.4, 0, TAU); ctx.fill(); ctx.lineWidth = 1.1; ctx.stroke();
      if (on) { ctx.strokeStyle = 'rgba(255,120,120,0.85)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(1.6, hy - 15.5, 4.4, -1.2, -0.1); ctx.moveTo(1.6 + 4.4 * Math.cos(Math.PI + 0.1), hy - 15.5 + 4.4 * Math.sin(Math.PI + 0.1)); ctx.arc(1.6, hy - 15.5, 4.4, Math.PI + 0.1, Math.PI + 1.2); ctx.stroke(); }
    } else {
      ctx.fillStyle = S.light; ctx.beginPath(); ctx.arc(1.6, hy - 15.5, 2.9, 0, TAU); ctx.fill(); ctx.lineWidth = 1.1; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.beginPath(); ctx.arc(0.7, hy - 16.5, 0.9, 0, TAU); ctx.fill();
    }
    // ── tête : casque (couleur + motif du siège), reflet, visière
    ctx.beginPath(); ctx.arc(0, hy, 10, 0, TAU); ctx.fillStyle = S.head; ctx.fill();
    const pat = seatPattern(ctx, seat, { size: 8, ink: 'rgba(255,255,255,0.36)' });
    if (pat) { ctx.fillStyle = pat; ctx.fill(); }
    ctx.strokeStyle = K.ink; ctx.lineWidth = 1.6; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.beginPath(); oval(ctx, -3.6, hy - 5.2, 3.2, 1.6); ctx.fill();
    if (dir !== 3) {
      const f0 = dir === 0 ? 3.2 : dir === 2 ? -3.2 : 0, fw = dir === 1 ? 7.2 : 5.8, ey = hy + 1.4;
      ctx.fillStyle = o.skull ? '#e2f5cf' : '#fff1dc'; ctx.beginPath(); oval(ctx, f0, hy + 1.8, fw, 5.4); ctx.fill(); ctx.strokeStyle = K.ink; ctx.lineWidth = 1.1; ctx.stroke();
      const ex = f0 + (dir === 0 ? 0.8 : dir === 2 ? -0.8 : 0), sp = dir === 1 ? 2.7 : 2.1;
      ctx.fillStyle = K.ink; ctx.strokeStyle = K.ink; ctx.lineWidth = 1.1;
      if (o.slow) { ctx.beginPath(); ctx.moveTo(ex - sp - 1.3, ey); ctx.lineTo(ex - sp + 1.3, ey); ctx.moveTo(ex + sp - 1.3, ey); ctx.lineTo(ex + sp + 1.3, ey); ctx.stroke(); }   // yeux mi-clos (ralenti)
      else if (o.rev) { ctx.beginPath(); for (const e of [ex - sp, ex + sp]) { ctx.moveTo(e + 1.5, ey); ctx.arc(e, ey, 1.5, 0, TAU * 0.8); } ctx.stroke(); }   // yeux en spirale (commandes inversées)
      else {
        ctx.beginPath(); oval(ctx, ex - sp, ey, 1.25, 1.9); oval(ctx, ex + sp, ey, 1.25, 1.9); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex - sp + 0.4, ey - 0.8, 0.55, 0, TAU); ctx.arc(ex + sp + 0.4, ey - 0.8, 0.55, 0, TAU); ctx.fill();
      }
      ctx.lineWidth = 1.1; ctx.beginPath();
      if (o.ghost) { ctx.fillStyle = K.ink; ctx.arc(f0, hy + 4.4, 1.1, 0, TAU); ctx.fill(); }
      else if (o.skull || o.rev || o.slow) { ctx.moveTo(f0 - 1.8, hy + 4.6); ctx.quadraticCurveTo(f0 - 0.9, hy + 3.8, f0, hy + 4.6); ctx.quadraticCurveTo(f0 + 0.9, hy + 5.4, f0 + 1.8, hy + 4.6); ctx.stroke(); }
      else { ctx.arc(f0, hy + 3.2, 1.9, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke(); }
      if (dir === 1) { ctx.fillStyle = 'rgba(255,120,150,0.45)'; ctx.beginPath(); oval(ctx, -4.9, hy + 3.4, 1.5, 0.9); oval(ctx, 4.9, hy + 3.4, 1.5, 0.9); ctx.fill(); }
    }
    ctx.translate(0, -bob);
    // ── états par-dessus
    if (o.shield) {                                     // bulle de sucre soufflé
      ctx.fillStyle = 'rgba(140,210,255,0.14)'; ctx.strokeStyle = 'rgba(170,225,255,0.9)'; ctx.lineWidth = A.contrast ? 2.4 : 1.6;
      ctx.beginPath(); ctx.arc(0, -1, 17, 0, TAU); ctx.fill(); ctx.stroke();
      const ha = FX ? now / 700 : 0; ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(0, -1, 14.5, Math.PI * 1.1 + ha, Math.PI * 1.4 + ha); ctx.stroke();
    }
    if (o.rev) {                                        // deux flèches rouges qui tournent au-dessus de la tête
      const a0 = FX ? now / 260 : 0; ctx.strokeStyle = '#ff4a5a'; ctx.lineWidth = 1.8; ctx.fillStyle = '#ff4a5a';
      for (let k = 0; k < 2; k++) { const a = a0 + k * Math.PI; ctx.beginPath(); ctx.save(); ctx.translate(0, hy - 11); ctx.scale(1, 0.38); ctx.arc(0, 0, 10, a, a + 1.9); ctx.restore(); ctx.stroke(); const px = Math.cos(a + 1.9) * 10, py = hy - 11 + Math.sin(a + 1.9) * 3.8; ctx.beginPath(); ctx.arc(px, py, 1.8, 0, TAU); ctx.fill(); }
    }
    if (o.auto) {                                       // réveil qui tictaque (pose automatique)
      const bx = 12, by = -13, hand = FX ? Math.floor(now / 250) * (Math.PI / 4) : 0;
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#ff4a5a'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(bx, by, 4.3, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = K.ink; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + Math.sin(hand) * 3, by - Math.cos(hand) * 3); ctx.stroke();
    }
    if (o.skull) drawPickIcon(ctx, 'skull', -12, -13, 6.5);
    if (o.invuln && FX) { ctx.fillStyle = '#fff6c8'; ctx.beginPath(); for (let k = 0; k < 3; k++) { const a = now / 300 + k * TAU / 3; star4(ctx, Math.cos(a) * 15, -2 + Math.sin(a) * 9, 2.6 + Math.sin(now / 90 + k) * 0.8); } ctx.fill(); }   // étincelles de retour
    if (o.crown) {                                      // couronne du vainqueur
      const cy2 = hy - 21 + (FX ? Math.sin(now / 240) * 1.2 : 0);
      ctx.beginPath(); ctx.moveTo(-6, cy2 + 3); ctx.lineTo(-6.5, cy2 - 3); ctx.lineTo(-3, cy2); ctx.lineTo(0, cy2 - 4.5); ctx.lineTo(3, cy2); ctx.lineTo(6.5, cy2 - 3); ctx.lineTo(6, cy2 + 3); ctx.closePath();
      ctx.fillStyle = '#ffd23a'; ctx.fill(); ctx.strokeStyle = K.ink; ctx.lineWidth = 1.2; ctx.stroke();
      ctx.fillStyle = '#ff5f9e'; ctx.beginPath(); ctx.arc(0, cy2 + 0.4, 1.2, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
  // revenant (mode revanche) : fantôme de guimauve à la couleur du siège, qui flotte sur la bordure
  function drawRevenant(seat, x, y, me, now, name) {
    const col = colSeat(seat), bob = FX ? Math.sin(now / 300 + seat) * 2 : 0, wv = FX ? Math.sin(now / 150 + seat) * 1.2 : 0;
    ctx.save(); ctx.translate(x, y + bob);
    ctx.fillStyle = 'rgba(16,8,28,0.25)'; ctx.beginPath(); oval(ctx, 0, 13 - bob, 8, 2.6); ctx.fill();
    ctx.globalAlpha = FX ? 0.72 + 0.12 * Math.sin(now / 180) : 0.8;
    ctx.beginPath(); ctx.moveTo(-10, 8); ctx.lineTo(-10, -3); ctx.arc(0, -3, 10, Math.PI, 0); ctx.lineTo(10, 8);
    for (let k = 0; k < 3; k++) { const x0 = 10 - k * 6.67; ctx.quadraticCurveTo(x0 - 3.3, 4 + (k % 2 ? -wv : wv), x0 - 6.67, 8); }
    ctx.closePath();
    ctx.fillStyle = col; ctx.fill();
    const pat = seatPattern(ctx, seat, { size: 8, ink: 'rgba(255,255,255,0.36)' }); if (pat) { ctx.fillStyle = pat; ctx.fill(); }
    ctx.strokeStyle = me ? '#fff' : K.ink; ctx.lineWidth = me ? 2 : 1.5; ctx.stroke();
    ctx.globalAlpha = 1;
        ctx.fillStyle = K.ink; ctx.beginPath(); oval(ctx, -3.6, -3, 2, 2.8); oval(ctx, 3.6, -3, 2, 2.8); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-3.1, -4, 0.7, 0, TAU); ctx.arc(4.1, -4, 0.7, 0, TAU); ctx.fill();
    ctx.fillStyle = K.ink; ctx.beginPath(); ctx.arc(0, 2.6, 1.4, 0, TAU); ctx.fill();
    ctx.restore();
  }
  function drawPoof(pf, now) {                        // élimination : le personnage gonfle et part en nuage
    const T = FX ? 700 : 400, t = (now - pf.born) / T;
    if (t >= 1) return false;
    if (FX && t < 0.22) drawBomber(pf.seat, pf.x, pf.y, { an: pf.an, name: pf.name, scale: 1 + t * 2.2, alpha: 1 - t / 0.22, shadow: false }, now);
    const e = FX ? 1 - (1 - t) * (1 - t) : 0.6, al = FX ? Math.min(1, (1 - t) * 1.6) : 1 - t, seed = pf.seat * 1.7;
    ctx.save(); ctx.globalAlpha = al;
    const circles = (grow) => { ctx.beginPath(); for (let i = 0; i < 7; i++) { const a = seed + i * TAU / 7, d = 3 + 11 * e, r = (4 + 8 * e) * (0.8 + 0.3 * hash2(i, pf.seat)) + grow; ctx.moveTo(pf.x + Math.cos(a) * d + r, pf.y + Math.sin(a) * d * 0.8); ctx.arc(pf.x + Math.cos(a) * d, pf.y + Math.sin(a) * d * 0.8, r, 0, TAU); } };
    ctx.fillStyle = K.ink; circles(1.6); ctx.fill();   // contour BD : silhouette d'encre sous le remplissage
    ctx.fillStyle = K.cream; circles(0); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); oval(ctx, pf.x - 4 * e, pf.y - 5 * e, 3 + 3 * e, 1.6 + 1.2 * e); ctx.fill();
    if (FX) { ctx.fillStyle = K.lemon; ctx.beginPath(); for (let k = 0; k < 3; k++) { const a = seed + k * 2.1; star4(ctx, pf.x + Math.cos(a) * (10 + 16 * e), pf.y + Math.sin(a) * (8 + 12 * e), 3.5 * (1 - t) + 1); } ctx.fill(); }
    ctx.restore();
    return true;
  }

  // ───────────────────────── rendu d'une image ─────────────────────────
  function drawWarps(now) {
    for (const [gx, gy] of warpCells) {
      const x = cpx(gx), y = cpx(gy) + 1, ph = FX ? 1 + 0.08 * Math.sin(now / 200 + gx + gy) : 1, rot = FX ? now / 500 : 0;
      if (FX) { const gs = CELL * 1.2; ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.35 + 0.15 * Math.sin(now / 260 + gx); ctx.drawImage(glowSpr('170,110,255'), x - gs / 2, y - gs / 2, gs, gs); ctx.restore(); }
      ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(ph, ph); ctx.drawImage(spr.swirl, -CELL / 2, -CELL / 2, CELL, CELL); ctx.restore();
      if (FX) { const r = ((now / 900 + gx * 0.3) % 1); ctx.strokeStyle = 'rgba(197,139,255,' + (0.7 * (1 - r)) + ')'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 12 + r * 8, 0, TAU); ctx.stroke(); }
    }
  }
  function drawAmbient(now) {
    if (!FX) return;
    ctx.save(); ctx.globalAlpha = 0.1;                   // ombres de nuages
    for (const cl of AMB_CLOUDS) { const x = (cl.ph + now / 1000 * cl.v) % (ARENA + cl.s * 3) - cl.s * 1.5, y = cl.y * ARENA; ctx.drawImage(spr.cloud, x - cl.s * 1.3, y - cl.s * 0.7, cl.s * 2.6, cl.s * 1.4); }
    ctx.restore();
    if (solidCells.length) {                          // reflets qui scintillent sur le glaçage du chocolat
      ctx.fillStyle = '#fff8ea'; ctx.beginPath();
      for (let s = 0; s < 5; s++) { const cyc = now / 2400 + s * 0.37, n = Math.floor(cyc), t = cyc - n; if (t > 0.3) continue; const c = solidCells[Math.floor(hash2(s, n) * solidCells.length)]; star4(ctx, (c % GW) * CELL + 11, ((c / GW) | 0) * CELL + 8, 3.4 * Math.sin(t / 0.3 * Math.PI)); }
      ctx.fill();
    }
    for (let i = scorch.length - 1; i >= 0; i--) { const s = scorch[i], t = (now - s.born) / 2600; if (t >= 1) { scorch.splice(i, 1); continue; } ctx.globalAlpha = 0.4 * (1 - t); ctx.drawImage(spr.scorch, s.x - CELL * 0.6, s.y - CELL * 0.6, CELL * 1.2, CELL * 1.2); }   // traces de caramel brûlé
    ctx.globalAlpha = 1;
  }
  // Éclairage dynamique, posé sur le sol AVANT les pièces : lueur des téléporteurs, étincelle de chaque mèche,
  // flammes regroupées par paquets de 3 × 3 cases (une lueur par foyer, jamais une par case), puis les flashs.
  // Pas de dégradé créé ici (sprites pré-rendus de lumiere.js), tableaux réutilisés, nombre de lueurs plafonné.
  // La nuit tombante (mort subite) les rend plus présentes ; contraste élevé : plus discrètes.
  let fb = null, fbW = 0, fbH = 0;
  function drawLights(now) {
    if (!FX) return;
    const k = (A.contrast ? 0.6 : 1) * (1 + 0.7 * dusk);
    for (let i = 0; i < warpCells.length; i++) { const w = warpCells[i]; lumiere(ctx, cpx(w[0]), cpx(w[1]), CELL * 1.5, '#b07cff', (0.26 + 0.08 * Math.sin(now / 260 + w[0])) * k); }
    const bombs = snap.bombs || [];
    for (let i = 0; i < bombs.length && i < 20; i++) {
      const b = bombs[i], x = cpx(b.x), y = cpx(b.y);
      if (b.r) lumiere(ctx, x + 9.5, y - 19.5, CELL * 0.55, '#ff4040', ((now % 700) < 380 ? 0.3 : 0.08) * k);                       // LED du détonateur
      else lumiere(ctx, x + 7.5, y - 15, CELL * (0.7 + 0.25 * (1 - b.f / BOMB_FUSE)), '#ffb04a', (0.26 + 0.07 * Math.sin(now / 45 + b.x * 7 + b.y) + (b.f <= 30 ? 0.12 : 0)) * k);
    }
    const B = snap.blasts || [];
    if (B.length) {
      const nx = Math.ceil(GW / 3), ny = Math.ceil(GH / 3);
      if (!fb || fbW !== nx || fbH !== ny) { fb = new Float32Array(nx * ny * 4); fbW = nx; fbH = ny; }
      fb.fill(0);
      for (let i = 0; i < B.length; i++) {
        const bl = B[i], j = (((bl.y / 3) | 0) * nx + ((bl.x / 3) | 0)) * 4, b0 = blastBorn.get(bl.y * GW + bl.x), age = b0 == null ? 200 : now - b0;
        fb[j] += cpx(bl.x); fb[j + 1] += cpx(bl.y); if (fb[j + 2] === 0 || age < fb[j + 3]) fb[j + 3] = age; fb[j + 2]++;
      }
      const fl = 0.92 + 0.08 * Math.sin(now / 35);
      for (let j = 0; j < fb.length; j += 4) {
        const n = fb[j + 2]; if (!n) continue;
        const fade = 1 - Math.max(0, Math.min(1, (fb[j + 3] - 160) / (BLAST_MS - 160)));
        lumiere(ctx, fb[j] / n, fb[j + 1] / n, CELL * (1.4 + 0.28 * Math.min(6, n)), '#ff8a2a', 0.5 * fade * fl * k);
      }
    }
    flashes.dessiner(ctx, now);
  }
  function drawRange(now) {                          // prévisualisation de portée des bombes
    (snap.bombs || []).forEach(b => {
      const danger = b.f <= 30;                                   // mèche < ~1 s : on alerte
      const a = danger ? (A.reduceFx ? 0.32 : 0.16 + 0.22 * (0.5 + 0.5 * Math.sin(now / 80))) : 0.11;
      const cells = rangeCells(snap.grid, b.x, b.y, b.p);
      ctx.fillStyle = `rgba(255,${danger ? 90 : 170},60,${a})`; ctx.beginPath();
      cells.forEach(([gx, gy]) => rr(ctx, gx * CELL + 3, gy * CELL + 3, CELL - 6, CELL - 6, 7)); ctx.fill();
      if (danger || A.contrast) { ctx.strokeStyle = `rgba(255,${danger ? 110 : 190},70,${danger ? 0.55 : 0.4})`; ctx.lineWidth = 1.5; ctx.stroke(); }
    });
  }
  function drawDropWarn(now) {                        // mort subite : ombre du prochain bloc qui grandit avant l'impact
    if (!snap.sd || snap.gs !== 'play' || lastDrop.i < 0 || !spiral) return;
    for (let k = 1; k <= 3; k++) {
      const i = lastDrop.i + k; if (i >= spiral.length) break;
      const tu = k * SD_MS - (now - lastDrop.t); if (tu <= 0 || tu > 700) continue;
      const c = spiral[i]; if (snap.grid[c[1] * GW + c[0]] === '1') continue;
      const p = 1 - tu / 700, x = cpx(c[0]), y = cpx(c[1]), w = CELL * (0.4 + 0.55 * p);
      ctx.fillStyle = `rgba(10,4,16,${0.12 + 0.4 * p})`; ctx.beginPath(); rr(ctx, x - w / 2 + 2, y - w / 2 + 3, w, w, 6); ctx.fill();
      ctx.strokeStyle = `rgba(255,70,60,${0.35 + 0.5 * p})`; ctx.lineWidth = 2; ctx.beginPath();
      const h = CELL / 2 - 3, L = 7;
      for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { ctx.moveTo(x + sx * h, y + sy * (h - L)); ctx.lineTo(x + sx * h, y + sy * h); ctx.lineTo(x + sx * (h - L), y + sy * h); }
      ctx.stroke();
    }
  }
  function drawPickups(now) {
    (snap.pickups || []).forEach(pk => {
      const x = cpx(pk.x), y = cpx(pk.y), bob = FX ? Math.sin(now / 320 + pk.x * 1.7 + pk.y) * 1.6 : 0;
      ctx.fillStyle = 'rgba(10,20,14,0.3)'; ctx.beginPath(); oval(ctx, x + 1, y + 12, 9 + bob * 0.5, 2.8); ctx.fill();
      const s2 = tokSpr(pk.t, pk.b), rot = pk.b && FX ? Math.sin(now / 260 + pk.x) * 0.14 : 0;
      if (rot) { ctx.save(); ctx.translate(x, y - 2 + bob); ctx.rotate(rot); ctx.drawImage(s2, -CELL / 2, -CELL / 2, CELL, CELL); ctx.restore(); }
      else ctx.drawImage(s2, x - CELL / 2, y - CELL / 2 - 2 + bob, CELL, CELL);
      if (A.contrast) { ctx.strokeStyle = pk.b ? '#ff4a5a' : '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y - 2 + bob, 13.5, 0, TAU); ctx.stroke(); }
      if (FX && !pk.b) { const cyc = (now / 1000 + hash2(pk.x, pk.y) * 3) % 2.6; if (cyc < 0.35) { ctx.fillStyle = '#fff'; ctx.beginPath(); star4(ctx, x + 7, y - 9 + bob, 4 * Math.sin(cyc / 0.35 * Math.PI)); ctx.fill(); } }   // éclat du papier
    });
  }
  function drawWallAnims(now) {                       // boîte de bonbons qui s'écrase (squash & stretch)
    for (let i = wallAnims.length - 1; i >= 0; i--) {
      const w = wallAnims[i], t2 = (now - w.born) / 260; if (t2 >= 1) { wallAnims.splice(i, 1); continue; }
      ctx.save(); ctx.globalAlpha = 1 - t2; ctx.translate(w.x * CELL + CELL / 2, w.y * CELL + CELL - 3); ctx.scale(1 + 0.55 * t2, Math.max(0.05, 1 - t2)); ctx.drawImage(spr.box[boxVar(w.x, w.y)], -CELL / 2, -(CELL - 3), CELL, CELL); ctx.restore();
    }
  }
  function drawBombs(now, kdt) {
    ctx.font = `800 12px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    (snap.bombs || []).forEach(b => {
      const key = b.y * GW + b.x; let e = bombEnt.get(key);
      if (!e) { e = { born: now - 1000, ph: 0, t0: 0, dur: 0 }; bombEnt.set(key, e); }
      let x = cpx(b.x), y = cpx(b.y), z = 0;
      if (e.t0 && FX && now - e.t0 < e.dur) { const tt = (now - e.t0) / e.dur, ea = e.arc ? tt : tt * (2 - tt); x = cpx(e.fx) + (x - cpx(e.fx)) * ea; y = cpx(e.fy) + (y - cpx(e.fy)) * ea; if (e.arc) z = Math.sin(Math.PI * tt) * CELL * 0.9; }
      const fr = Math.max(0, Math.min(1, b.f / BOMB_FUSE));
      e.ph += kdt * 16.7 / 1000 * (b.r ? 1.2 : 1.4 + 5 * (1 - fr)) * TAU;
      const sq = FX ? Math.sin(e.ph) * (0.05 + 0.07 * (1 - fr)) : 0, tb = now - e.born;
      const pop = FX && tb >= 0 && tb < 260 ? Math.sin(tb / 260 * Math.PI * 2.2) * (1 - tb / 260) * 0.35 : 0;
      ctx.fillStyle = 'rgba(10,6,16,0.32)'; ctx.beginPath(); oval(ctx, x + 1, y + 11.5, 10 * (1 - z / 90), 3.4 * (1 - z / 90)); ctx.fill();
      ctx.save(); ctx.translate(x, y - z); ctx.scale(1 + sq + pop, 1 - sq - pop * 0.6);
      ctx.drawImage(b.r ? spr.bombR : spr.bomb, -20, -21, 40, 40);
      if (!b.r && b.f <= 30) { ctx.fillStyle = `rgba(255,50,40,${FX ? 0.16 + 0.3 * (0.5 + 0.5 * Math.sin(e.ph * 2)) : 0.3})`; ctx.beginPath(); ctx.arc(0, 0, 11.5, 0, TAU); ctx.fill(); if (!FX) { ctx.strokeStyle = '#ff4a3a'; ctx.lineWidth = 2; ctx.stroke(); } }   // derniers instants : la bombe rougit
      if (b.r) {                                         // détonateur : antenne + LED au lieu de la mèche
        ctx.strokeStyle = K.ink; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(6.2, -10.3); ctx.lineTo(9.5, -19); ctx.stroke();
        const on = !FX || (now % 700) < 380; ctx.fillStyle = on ? '#ff3b3b' : '#6b1a1a'; ctx.beginPath(); ctx.arc(9.5, -19.5, 2.3, 0, TAU); ctx.fill(); ctx.lineWidth = 1; ctx.stroke();
      } else drawFuse(1, 0.2 + 0.8 * fr, true, now, b.x * 7 + b.y);
      ctx.restore();
      if (!b.r) { const n = '' + Math.max(1, Math.ceil(b.f / TICK_HZ)); ctx.lineWidth = 3; ctx.strokeStyle = K.ink; ctx.strokeText(n, x - 0.5, y - z + 1.5); ctx.fillStyle = b.f <= 30 ? '#ffe08a' : '#ffffff'; ctx.fillText(n, x - 0.5, y - z + 1.5); }
      else { ctx.strokeStyle = '#8fe0ff'; ctx.lineWidth = 1.4; ctx.beginPath(); for (const r of [2.5, 5]) { ctx.moveTo(x - 1 + Math.cos(-2.4) * r, y - z + 3 + Math.sin(-2.4) * r); ctx.arc(x - 1, y - z + 3, r, -2.4, -0.75); } ctx.stroke(); ctx.fillStyle = '#8fe0ff'; ctx.beginPath(); ctx.arc(x - 1, y - z + 3, 1.2, 0, TAU); ctx.fill(); }   // ondes radio (dessinées)
    });
  }
  // Flammes cartoon : chaque case trace des segments épais vers ses voisines en feu (bouts arrondis),
  // en 4 couches (liseré rouge sombre → orange → jaune → cœur blanc). Regroupées par âge (gonflement /
  // pleine / fin) : ~12 tracés par image quel que soit le nombre de cases. Toute la case reste teintée.
  function drawBlasts(now, kdt) {
    const B = snap.blasts || []; if (!B.length) return;
    ctx.fillStyle = 'rgba(255,110,30,0.3)'; ctx.beginPath(); B.forEach(bl => { ctx.rect(bl.x * CELL + 1, bl.y * CELL + 1, CELL - 2, CELL - 2); }); ctx.fill();
    const has = (x, y) => x >= 0 && y >= 0 && x < GW && y < GH && blastSet.has(y * GW + x);
    const fl = FX ? 1 + 0.06 * Math.sin(now / 35) : 1;
    const bucket = bl => { const b0 = blastBorn.get(bl.y * GW + bl.x), age = b0 == null ? 200 : now - b0; return age < 70 ? 0 : age > BLAST_MS * 0.78 ? 2 : 1; };
    const BS = [0.72, 1, 0.8];
    const layers = A.contrast ? [['#2a0a04', 1.12, 0], ['#c8261a', 0.94, 0], ['#ff6a1f', 0.76, 0], ['#ffc21f', 0.52, 1], ['#fff6c8', 0.26, 1]] : [['#c8261a', 0.94, 0], ['#ff6a1f', 0.76, 0], ['#ffc21f', 0.52, 1], ['#fff6c8', 0.26, 1]];
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (let bk = 0; bk < 3; bk++) {
      let any = false; for (let i = 0; i < B.length; i++) if (bucket(B[i]) === bk) { any = true; break; }
      if (!any) continue;
      for (const [col, wm, add] of layers) {
        ctx.globalCompositeOperation = add && FX ? 'lighter' : 'source-over';
        ctx.strokeStyle = col; ctx.lineWidth = CELL * wm * BS[bk] * fl; ctx.beginPath();
        for (const bl of B) {
          if (bucket(bl) !== bk) continue;
          const cx = cpx(bl.x), cy = cpx(bl.y);
          ctx.moveTo(cx + 0.5, cy); ctx.arc(cx, cy, 0.5, 0, TAU);
          for (const [dx, dy] of DIRS4) {
            if (has(bl.x + dx, bl.y + dy)) { ctx.moveTo(cx, cy); ctx.lineTo(cx + dx * CELL / 2, cy + dy * CELL / 2); }
            else if (has(bl.x - dx, bl.y - dy)) { ctx.moveTo(cx, cy); ctx.lineTo(cx + dx * CELL * 0.2, cy + dy * CELL * 0.2); }   // bout de flamme arrondi
          }
        }
        ctx.stroke();
      }
    }
    ctx.restore();
    if (FX) for (const bl of B) if (Math.random() < 0.1 * kdt) addP({ k: 'glow', x: cpx(bl.x) + (Math.random() - 0.5) * 18, y: cpx(bl.y) + (Math.random() - 0.5) * 18, vx: (Math.random() - 0.5) * 0.4, vy: -0.6 - Math.random() * 0.6, z: 0, vz: 0, born: now, life: 320, r: 7, col: '255,160,50', rot: 0, vr: 0 });   // langues de feu
  }
  function drawPlayers(now) {
    const pv = viewPlayers(now), over = snap.gs === 'over', list = [];
    snap.players.forEach(p => {
      if (!p.playing) return;
      const t = (pv && pv[p.seat]) || p;
      let an = anim[p.seat]; if (!an) an = anim[p.seat] = { x: t.x, y: t.y, dir: 1, ph: 0, mt: 0, mv: false };
      const dx = t.x - an.x, dy = t.y - an.y, d = Math.abs(dx) + Math.abs(dy);
      if (d < 30 && d > 0.05) { an.ph += d * 0.32; an.mt = now; if (Math.abs(dx) > Math.abs(dy) * 1.3) an.dir = dx > 0 ? 0 : 2; else if (Math.abs(dy) > Math.abs(dx) * 1.3) an.dir = dy > 0 ? 1 : 3; }
      an.x = t.x; an.y = t.y; an.mv = now - an.mt < 110;
      if (!p.alive) { if (p.rvn) list.push({ p, t, an, rv: true }); return; }
      list.push({ p, t, an, rv: false });
    });
    list.sort((a, b) => a.t.y - b.t.y);
    for (const e of list) {
      const p = e.p, t = e.t;
      if (e.rv) {                                       // mode revanche : revenant sur le bord qui bombarde
        if (p.seat === mySeat) {
          let gx = Math.floor(t.x / CELL), gy = Math.floor(t.y / CELL), ix = gx, iy = gy;
          if (gy <= 0) iy = 1; else if (gy >= GH - 1) iy = GH - 2; if (gx <= 0) ix = 1; else if (gx >= GW - 1) ix = GW - 2;
          ctx.save(); ctx.strokeStyle = colSeat(p.seat); ctx.globalAlpha = FX ? 0.55 + 0.3 * Math.sin(now / 160) : 0.8; ctx.lineWidth = 2; ctx.setLineDash([4, 4]); ctx.lineDashOffset = FX ? -now / 60 : 0;
          ctx.beginPath(); rr(ctx, ix * CELL + 3, iy * CELL + 3, CELL - 6, CELL - 6, 7); ctx.stroke(); ctx.setLineDash([]);
          ctx.beginPath(); ctx.moveTo(cpx(ix) - 5, cpx(iy)); ctx.lineTo(cpx(ix) + 5, cpx(iy)); ctx.moveTo(cpx(ix), cpx(iy) - 5); ctx.lineTo(cpx(ix), cpx(iy) + 5); ctx.stroke(); ctx.restore();   // viseur
        }
        drawRevenant(p.seat, t.x, t.y, p.seat === mySeat, now, nomAvatar(p));
        continue;
      }
      drawBomber(p.seat, t.x, t.y, { an: e.an, name: nomAvatar(p), me: p.seat === mySeat && !over, crown: over, ghost: p.ghost, invuln: p.invuln, shield: p.shield > 0, kick: p.kick, throw: p.throw, remote: p.remote, line: p.line, rev: p.rev, slow: p.slow, auto: p.auto, skull: p.skull, speed: p.speed | 0 }, now);
      if (FX && (p.skull || p.ghost) && Math.random() < 0.05) addP({ k: 'bub', x: t.x + (Math.random() - 0.5) * 16, y: t.y - 4, vx: 0, vy: -0.5, z: 0, vz: 0, born: now, life: 700, r: 1.5 + Math.random() * 1.5, col: p.skull ? '192,112,240' : '220,215,255', rot: 0, vr: 0 });
    }
    for (let i = poofs.length - 1; i >= 0; i--) if (!drawPoof(poofs[i], now)) poofs.splice(i, 1);
    // étiquettes par-dessus tous les sprites (nom, ou « VOUS »)
    ctx.font = 'bold 10px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.lineJoin = 'round';
    for (const e of list) {
      if (e.rv) continue;
      const p = e.p, lab = p.seat === mySeat ? 'VOUS' : (p.name || ('P' + (p.seat + 1))).slice(0, 8), ly = e.t.y - (over ? 35 : 25);
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(35,19,38,0.85)'; ctx.strokeText(lab, e.t.x, ly); ctx.fillStyle = p.seat === mySeat ? K.lemon : '#fff'; ctx.fillText(lab, e.t.x, ly);
    }
  }
  function drawDrops(now) {                           // blocs de mort subite en chute (ombre au sol qui grandit)
    for (let i = dropAnims.length - 1; i >= 0; i--) {
      const d = dropAnims[i], t = (now - d.born) / DROP_MS;
      const x = d.x * CELL, y = d.y * CELL;
      if (t >= 1) {
        dropAnims.splice(i, 1); dropVer++;
        psound('drop', d.x);
        if (FX) { burst(cpx(d.x), cpx(d.y) + 10, 5, 1.4, '200,180,160', 'puff', 520, 4); bits(cpx(d.x), cpx(d.y), 5, ['#6e3c20', '#83502e', '#3a1b0c'], 1.8, 520); ring(cpx(d.x), cpx(d.y), 10, CELL * 0.85, 280, '255,240,220', 3); }
        shake(nearMe(cpx(d.x), cpx(d.y), CELL * 2.5) ? 4 : 1.8);
        ctx.drawImage(spr.choco, x, y, CELL, CELL);    // l'image où le terrain n'est pas encore recomposé
        continue;
      }
      const ea = t * t;
      ctx.fillStyle = `rgba(10,4,16,${0.15 + 0.4 * ea})`; ctx.beginPath(); const w = CELL * (0.5 + 0.5 * ea); rr(ctx, x + CELL / 2 - w / 2 + 3, y + CELL / 2 - w / 2 + 4, w, w, 6); ctx.fill();
      const sc2 = 1 + 0.18 * (1 - ea), yo = -(1 - ea) * CELL * 2.2;
      ctx.save(); ctx.translate(x + CELL / 2, y + CELL / 2 + yo); ctx.scale(sc2, sc2); ctx.drawImage(spr.choco, -CELL / 2, -CELL / 2, CELL, CELL); ctx.restore();
    }
  }
  function drawParticles(now, kdt) {
    if (!FX) { parts.length = 0; rings.length = 0; return; }
    ctx.save();
    for (let i = parts.length - 1; i >= 0; i--) {
      const q = parts[i], t = (now - q.born) / q.life;
      if (t >= 1) { parts.splice(i, 1); continue; }
      q.x += q.vx * kdt; q.y += q.vy * kdt; q.rot += q.vr * kdt;
      if (q.k === 'bit') { q.z += q.vz * kdt; q.vz -= 0.28 * kdt; if (q.z <= 0) { q.z = 0; q.vz = -q.vz * 0.35; q.vx *= 0.6; q.vy *= 0.6; } }
      else if (q.k === 'conf') { q.vx += Math.sin(now / 300 + i) * 0.01 * kdt; }
      else { q.vx *= Math.pow(0.93, kdt); q.vy *= Math.pow(0.93, kdt); }
      if (q.k === 'puff') { ctx.globalAlpha = (1 - t) * 0.55; ctx.fillStyle = 'rgb(' + q.col + ')'; ctx.beginPath(); ctx.arc(q.x, q.y, q.r + t * 7, 0, TAU); ctx.fill(); }
      else if (q.k === 'bit' || q.k === 'conf') {
        ctx.globalAlpha = t > 0.7 ? (1 - t) / 0.3 : 1; ctx.fillStyle = q.col;
        ctx.save(); ctx.translate(q.x, q.y - (q.z || 0)); ctx.rotate(q.rot); ctx.scale(q.k === 'conf' ? Math.cos(q.rot * 3) : 1, 1); ctx.fillRect(-q.r, -q.r * 0.6, q.r * 2, q.r * 1.2); ctx.restore();
      } else if (q.k === 'bub') { ctx.globalAlpha = 0.8 * (1 - t); ctx.strokeStyle = 'rgb(' + q.col + ')'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(q.x, q.y, q.r * (1 + t), 0, TAU); ctx.stroke(); }
    }
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < parts.length; i++) {
      const q = parts[i], t = (now - q.born) / q.life;
      if (q.k === 'glow') { const s = q.r * 2 * (1 - t * 0.5); ctx.globalAlpha = 1 - t; ctx.drawImage(glowSpr(q.col), q.x - s / 2, q.y - s / 2, s, s); }
      else if (q.k === 'spark') { ctx.globalAlpha = 1 - t; ctx.strokeStyle = 'rgb(' + q.col + ')'; ctx.lineWidth = 2 * (1 - t) + 0.6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(q.x - q.vx * 2, q.y - q.vy * 2); ctx.stroke(); }
    }
    ctx.globalCompositeOperation = 'source-over';
    for (let i = rings.length - 1; i >= 0; i--) { const q = rings[i], t = (now - q.born) / q.life; if (t >= 1) { rings.splice(i, 1); continue; } if (t < 0) continue; const e = 1 - (1 - t) * (1 - t); ctx.globalAlpha = 0.75 * (1 - t); ctx.strokeStyle = 'rgb(' + q.col + ')'; ctx.lineWidth = q.lw * (1 - t * 0.6); ctx.beginPath(); ctx.arc(q.x, q.y, Math.max(0.5, q.r0 + (q.r1 - q.r0) * e), 0, TAU); ctx.stroke(); }
    ctx.restore();
  }

  // ───────────────────────── écrans : titre, compte à rebours, BOUM, pause ─────────────────────────
  let overlayG = null, overlayK = '';
  function overlay(a) {                               // voile prune, plus sombre sur les bords (dégradé mis en cache)
    const key = ARENA + '|' + a;
    if (!overlayG || overlayK !== key) { overlayK = key; overlayG = ctx.createRadialGradient(ARENA / 2, ARENA / 2, ARENA * 0.1, ARENA / 2, ARENA / 2, ARENA * 0.72); overlayG.addColorStop(0, `rgba(44,16,54,${a * 0.8})`); overlayG.addColorStop(1, `rgba(10,4,16,${Math.min(0.92, a * 1.25)})`); }
    ctx.fillStyle = overlayG; ctx.fillRect(0, 0, ARENA, ARENA);
  }
  // mot en lettres-bonbons : couleur par lettre, contour d'encre, ombre décalée (pas de shadowBlur), reflet
  function candyWord(txt, cx, cy, fs, now, bounce, cols, maxW) {
    ctx.save(); ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    let ws = [], total = 0;
    const measure = () => { ctx.font = `800 ${fs}px ${FONT}`; ws = []; total = 0; for (let i = 0; i < txt.length; i++) { const w = ctx.measureText(txt.charAt(i)).width + fs * 0.02; ws.push(w); total += w; } };
    measure();
    if (maxW && total > maxW) { fs = Math.max(14, fs * maxW / total); measure(); }
    const amp = bounce && FX ? fs * 0.17 : 0;
    let x = cx - total / 2;
    for (let i = 0; i < txt.length; i++) {
      const ch = txt.charAt(i), yy = cy - (amp ? Math.abs(Math.sin(now / 430 - i * 0.38)) * amp : 0), col = cols[i % cols.length], c = hexRgb(col);
      ctx.lineWidth = Math.max(3, fs * 0.2); ctx.strokeStyle = 'rgba(20,6,24,0.55)'; ctx.strokeText(ch, x + fs * 0.05, yy + fs * 0.09);
      ctx.strokeStyle = K.ink; ctx.strokeText(ch, x, yy);
      const gr = ctx.createLinearGradient(0, yy - fs * 0.55, 0, yy + fs * 0.5); gr.addColorStop(0, rgbStr(mix(c, [255, 255, 255], 0.55))); gr.addColorStop(0.5, col); gr.addColorStop(1, rgbStr(mix(c, [0, 0, 0], 0.25)));
      ctx.fillStyle = gr; ctx.fillText(ch, x, yy);
      const gl = ctx.createLinearGradient(0, yy - fs * 0.5, 0, yy); gl.addColorStop(0, 'rgba(255,255,255,0.6)'); gl.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gl; ctx.fillText(ch, x, yy);
      x += ws[i];
    }
    ctx.restore();
    return { right: x, fs };
  }
  function inkText(s, x, y, font, fill) { ctx.font = font; ctx.lineJoin = 'round'; ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(28,10,32,0.85)'; ctx.strokeText(s, x, y); ctx.fillStyle = fill; ctx.fillText(s, x, y); }
  function playTri(x, y, s, col) { ctx.fillStyle = col; ctx.strokeStyle = K.ink; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x - s * 0.5, y - s * 0.6); ctx.lineTo(x + s * 0.6, y); ctx.lineTo(x - s * 0.5, y + s * 0.6); ctx.closePath(); ctx.fill(); ctx.stroke(); }
  function drawConfetti(now) {                        // vermicelles qui tombent en boucle sur l'écran titre (sans allocation)
    if (!FX) return;
    ctx.save(); ctx.lineCap = 'round'; ctx.lineWidth = 2.4; ctx.globalAlpha = 0.75;
    for (let c = 0; c < CANDY.length; c++) {
      ctx.strokeStyle = CANDY[c]; ctx.beginPath();
      for (let i = c; i < 30; i += CANDY.length) { const x = hash2(i, 3) * ARENA, y = ((now * 0.03 * (0.6 + hash2(i, 1)) + hash2(i, 2) * ARENA) % (ARENA + 20)) - 10, a = now / 500 * (0.5 + hash2(i, 4)) + i; ctx.moveTo(x - Math.cos(a) * 3, y - Math.sin(a) * 3); ctx.lineTo(x + Math.cos(a) * 3, y + Math.sin(a) * 3); }
      ctx.stroke();
    }
    ctx.restore();
  }
  function drawEmblem(cx, cy, R, now) {               // bombe-bonbon : la bombe emballée dans un papier à rayures
    const wob = FX ? Math.sin(now / 520) * 0.07 : 0;
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(wob); ctx.lineJoin = 'round';
    for (const s of [-1, 1]) {
      const tw = FX ? Math.sin(now / 300 + s) * R * 0.05 : 0;
      ctx.beginPath(); ctx.moveTo(s * R * 0.85, -R * 0.28); ctx.lineTo(s * (R * 1.6 + tw), -R * 0.62); ctx.quadraticCurveTo(s * R * 1.38, 0, s * (R * 1.6 + tw), R * 0.62); ctx.lineTo(s * R * 0.85, R * 0.28); ctx.closePath();
      ctx.fillStyle = K.pink; ctx.fill(); ctx.strokeStyle = K.ink; ctx.lineWidth = Math.max(2, R * 0.07); ctx.stroke();
      ctx.strokeStyle = '#ffe6f1'; ctx.lineWidth = Math.max(1.5, R * 0.06); ctx.beginPath(); ctx.moveTo(s * R * 0.98, -R * 0.12); ctx.lineTo(s * R * 1.45, -R * 0.4); ctx.moveTo(s * R * 0.98, R * 0.12); ctx.lineTo(s * R * 1.45, R * 0.4); ctx.stroke();
    }
    ctx.restore();
    bigBomb(cx, cy + R * 0.1, R, 0.85, true, now);
  }
  function drawLobby(now) {
    const c = ARENA / 2;
    drawConfetti(now);
    drawEmblem(c, c - 116, 30, now);
    const w = candyWord('BOMBERMAN', c - 12, c - 46, 46, now, true, CANDY, ARENA - 90);
    ctx.save(); ctx.translate(w.right + w.fs * 0.1, c - 46 - w.fs * 0.05); drawFuse(w.fs / 26, 1, true, now, 9); ctx.restore();   // mèche allumée au bout du mot
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const n = snap.connected, nb = snap.botCount || 0;
    inkText(`${n} joueur${n > 1 ? 's' : ''}${nb ? ' + ' + nb + ' bot' + (nb > 1 ? 's' : '') : ''}${teamMode ? ' · ' + (MODE_NAME[snap.mode] || snap.mode) : (n + nb < 2 ? ' (solo : entraînement)' : '')}`, c, c + 4, '15px system-ui,sans-serif', teamMode ? '#9fd0ff' : 'rgba(255,244,226,.9)');
    let y = c + 28;
    if (snap.revenge) { const txt = 'Revanche — les morts bombardent depuis le bord et peuvent revenir'; ctx.font = 'bold 13px system-ui,sans-serif'; const tw = Math.min(ctx.measureText(txt).width, ARENA - 40); drawPickIcon(ctx, 'skull', c - tw / 2 - 10, y, 8); inkText(txt, c + 6, y, 'bold 13px system-ui,sans-serif', '#ff9b6b'); y += 24; }
    const hint = 'Espace / clic pour allumer la mèche'; ctx.font = 'bold 14px system-ui,sans-serif'; const hw = ctx.measureText(hint).width;
    const pulse = FX ? 0.75 + 0.25 * Math.sin(now / 300) : 1;
    ctx.globalAlpha = pulse; playTri(c - hw / 2 - 12, y + 6, 11, K.lemon); inkText(hint, c + 4, y + 6, 'bold 14px system-ui,sans-serif', K.cream); ctx.globalAlpha = 1;
  }
  function drawCountdown(now) {
    const c = ARENA / 2, n = snap.count || 0;
    overlay(0.3);
    const pulse = FX ? 1 + (0.04 + 0.03 * (3 - n)) * Math.sin(now / (130 - 25 * (3 - n))) : 1;
    ctx.save(); ctx.translate(c, c - 6); ctx.scale(pulse, pulse); bigBomb(0, 0, 44, n > 0 ? n / 3 : 0.1, true, now); ctx.restore();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `800 64px ${FONT}`; ctx.lineJoin = 'round'; ctx.lineWidth = 8; ctx.strokeStyle = K.ink; ctx.strokeText(n > 0 ? '' + n : '!', c - 3, c + 2); ctx.fillStyle = '#fff'; ctx.fillText(n > 0 ? '' + n : '!', c - 3, c + 2);
    inkText(n > 0 ? 'Mèche allumée…' : 'BOUM !', c, c + 72, 'bold 15px system-ui,sans-serif', K.cream);
  }
  function drawGoBurst(now) {                          // « BOUM ! » de bande dessinée au lancement
    const T = FX ? 650 : 450, t = (now - goAt) / T; if (!goAt || t >= 1 || t < 0) return;
    const c = ARENA / 2, s = FX ? (t < 0.2 ? 0.4 + 0.8 * t / 0.2 : t < 0.3 ? 1.2 - 0.2 * (t - 0.2) / 0.1 : 1) : 1;
    ctx.save(); ctx.globalAlpha = t > 0.7 ? (1 - t) / 0.3 : 1; ctx.translate(c, c); ctx.scale(s, s); ctx.rotate(-0.06);
    const spike = (R1, R2, col) => { ctx.beginPath(); for (let i = 0; i < 28; i++) { const a = i / 28 * TAU, r = i % 2 ? R2 : R1 * (0.92 + 0.12 * hash2(i, 5)); if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r * 0.78); else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r * 0.78); } ctx.closePath(); ctx.fillStyle = col; ctx.fill(); };
    spike(96, 70, K.ink); spike(90, 64, K.lemon); spike(66, 48, K.orange);
    ctx.restore();
    ctx.save(); ctx.globalAlpha = t > 0.7 ? (1 - t) / 0.3 : 1; ctx.translate(c, c); ctx.scale(s, s); candyWord('BOUM !', 0, 0, 44, now, false, ['#ffffff', '#fff4e2'], ARENA * 0.6); ctx.restore();
  }
  function drawPause(now) {
    const c = ARENA / 2;
    overlay(0.62);
    bigBomb(c, c - 74, 24, 0.55, false, now);          // mèche soufflée : filet de fumée
    if (FX) { ctx.save(); ctx.strokeStyle = 'rgba(220,210,230,0.55)'; ctx.lineWidth = 2.4; ctx.lineCap = 'round'; const s = 24 / 11.5, tip = fuseAt(0.55), tx = c + tip[0] * s, ty = c - 74 + tip[1] * s; ctx.beginPath(); ctx.moveTo(tx, ty); for (let k = 1; k <= 8; k++) ctx.lineTo(tx + Math.sin(now / 400 + k * 0.9) * (2 + k * 0.6), ty - k * 4); ctx.stroke(); ctx.restore(); }
    candyWord('PAUSE', c, c - 4, 42, now, false, [K.pink, K.lemon, K.mint, K.sky, K.orange], ARENA * 0.7);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    inkText('Mèche soufflée — P / Échap pour reprendre', c, c + 36, '14px system-ui,sans-serif', 'rgba(255,244,226,.85)');
  }

  function draw() {
    if (destroyed) return;
    const now = performance.now(), dtMs = Math.min(100, Math.max(0, now - (lastFrame || now - 16.7))), kdt = Math.min(3, Math.max(0.25, dtMs / 16.7)); lastFrame = now;
    const sc = cv.width / ARENA; PXU = sc;
    // Arène qui évolue : l'après-midi dore à l'approche de la mort subite (dès 45 s de jeu, elle tombe à 65 s),
    // puis la nuit gagne à mesure que la spirale de blocs se referme. Lissé ; figé sur l'écran de fin.
    if (snap) {
      if (snap.gs === 'play') playMs += dtMs;
      else if (snap.gs === 'lobby' || snap.gs === 'countdown') playMs = 0;
      let tgt = dusk;
      if (snap.gs === 'lobby' || snap.gs === 'countdown') tgt = 0;
      else if (snap.gs === 'play' || snap.gs === 'paused') {
        const pre = Math.max(0, Math.min(1, (playMs - 45000) / 20000));
        tgt = snap.sd ? 0.34 + 0.52 * (spiral && lastDrop.i >= 0 ? Math.min(1, (lastDrop.i + 1) / spiral.length) : 0) : 0.3 * pre * pre * (3 - 2 * pre);
      }
      tgt = Math.max(tgt, DUEL.t(snap, performance.now(), duelAnnonce));   // duel final : la nuit tombe
      dusk += (tgt - dusk) * Math.min(1, dtMs / 900);
    }
    let ox = 0, oy = 0;
    if (shakeMag > 0.3 && !A.reduceFx) { ox = (Math.random() * 2 - 1) * shakeMag; oy = (Math.random() * 2 - 1) * shakeMag; shakeMag *= Math.pow(0.86, kdt); } else shakeMag = 0;
    ctx.setTransform(sc, 0, 0, sc, ox * sc, oy * sc);
    ctx.fillStyle = K.bg; ctx.fillRect(-12, -12, ARENA + 24, ARENA + 24);
    ensureSprites();
    if (snap && snap.grid) {
      ensureTerrain(); ctx.drawImage(terrainCv, 0, 0, ARENA, ARENA);   // décor statique pré-rendu (1 drawImage au lieu de ~340 tracés)
      drawAmbient(now);
      drawLights(now);                                // lueurs sur le sol, sous les pièces
      drawWarps(now);
      drawRange(now);
      drawDropWarn(now);
      drawPickups(now);
      drawWallAnims(now);
      drawBombs(now, kdt);
      drawBlasts(now, kdt);
      drawPlayers(now);
      drawDrops(now);
    }
    drawParticles(now, kdt);
    // étalonnage jour → crépuscule par-dessus l'arène (sol, pièces, particules), sous les écrans ; plafonné
    // loin du noir. « Réduire les effets » l'atténue sans soleil rasant (il reste une information : la manche s'achève).
    if (snap && snap.grid && dusk > 0.01) crepuscule(ctx, -12, -12, ARENA + 24, ARENA + 24, Math.min(0.86, dusk), { soleil: FX ? 'haut' : false, force: A.contrast ? 0.55 : (FX ? 1 : 0.7) });
    if (snap && snap.grid && snap.sd && snap.gs === 'play') { ctx.strokeStyle = `rgba(255,60,60,${FX ? 0.3 + 0.25 * Math.sin(now / 160) : 0.45})`; ctx.lineWidth = 6; ctx.strokeRect(3, 3, ARENA - 6, ARENA - 6); }   // mort subite : cadre qui palpite (au-dessus du crépuscule : reste vif)
    if (snap && snap.gs === 'play') drawGoBurst(now);
    if (snap && snap.gs === 'countdown') drawCountdown(now);
    if (snap && snap.gs === 'paused') drawPause(now);
    if (snap && snap.gs === 'lobby') { overlay(0.62); drawLobby(now); }
  }
  function drawLoop() { if (destroyed) return; try { draw(); } catch (e) { console.error('[render]', e); } rafId = requestAnimationFrame(drawLoop); }   // filet : une erreur de rendu ne fige plus le jeu

  // ───────────────────────── entrées ─────────────────────────
  function pushInput() { send({ t: 'input', up: input.up, down: input.down, left: input.left, right: input.right }); }
  function setIn(k, v) { if (input[k] === v) return; input[k] = v; pushInput(); }
  const onKeyDown = e => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
    unlockAudio();
    const playing = snap && (snap.gs === 'play' || snap.gs === 'paused');
    if (e.key === ' ') { if (snap && snap.gs !== 'play' && snap.gs !== 'paused') { if (!e.repeat) send({ t: 'start' }); } else send({ t: 'bomb' }); return; }   // Espace TENU au moment de la fin : pas un « Rejouer »
    if (e.code === 'KeyB' && playing) { send({ t: 'bomb' }); return; }
    if ((e.code === 'KeyX' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') && playing) { send({ t: 'action' }); return; }
    if ((e.key === 'p' || e.key === 'P' || e.key === 'Escape') && playing) { send({ t: 'pause' }); return; }
    const a = KEYMAP[e.code]; if (a && !e.repeat) setIn(a, true);
  };
  const onKeyUp = e => { const a = KEYMAP[e.code]; if (a) setIn(a, false); };
  const onBlur = () => { let ch = false; for (const k in input) if (input[k]) { input[k] = false; ch = true; } if (ch) pushInput(); };
  function hold(id, k) { const el = $(id); if (!el) return; const on = e => { e.preventDefault(); unlockAudio(); setIn(k, true); }; const off = e => { e.preventDefault(); setIn(k, false); }; el.addEventListener('pointerdown', on); el.addEventListener('pointerup', off); el.addEventListener('pointerleave', off); el.addEventListener('pointercancel', off); }

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
    cv = $('bmc'); ctx = cv.getContext('2d'); hud = $('bmHud'); endEl = $('bmEnd');
    seatCache = {}; sprKey = ''; overlayG = null;   // les dégradés en cache appartiennent au contexte : on repart propre
    J.fin(); flashes.vider(); dusk = 0; playMs = 0; lastFrame = 0;   // singleton réutilisé : pas de journal / crépuscule hérités d'une visite précédente
    const wrap = cv.parentElement;   // conteneur .canvas-wrap : accueille les bandeaux bonus/malus
    initGameMsg(wrap && wrap.classList.contains('canvas-wrap') ? wrap : null);
    hud.innerHTML = '';             // module réutilisé : repartir d'un HUD vide (sinon les cartes P1.. se cumulent à chaque retour)
    cards = Array.from({ length: MAX_SEATS }, (_, i) => i).map(i => { const el = document.createElement('div'); el.className = 'pc hidden'; el.innerHTML = `<div class="dot"></div><div class="inf"><div class="pn">P${i + 1}</div><div class="lv"></div></div>`; hud.appendChild(el); return el; });
    startBtn = $('bmStart'); pauseBtn = $('bmPause'); modeBtn = $('bmMode'); genBtn = $('bmGen'); ffBtn = $('bmFf'); revBtn = $('bmRevenge'); botsBtn = $('bmBots'); pauseFloat = $('bmPauseFloat'); lbBtn = $('bmLbBtn'); lbPanel = $('bmLbPanel'); lbBody = $('bmLbBody');
    startBtn.onclick = () => { unlockAudio(); send({ t: 'start' }); };
    pauseBtn.onclick = () => send({ t: 'pause' }); pauseFloat.onclick = () => send({ t: 'pause' }); modeBtn.onclick = () => send({ t: 'mode' }); genBtn.onclick = () => send({ t: 'gen' }); ffBtn.onclick = () => send({ t: 'ff' });
    if (revBtn) revBtn.onclick = () => send({ t: 'revenge' });
    if (botsBtn) botsBtn.onclick = () => send({ t: 'bots' });
    diffBtn = $('bmDiff'); if (diffBtn) diffBtn.onclick = () => send({ t: 'botdiff' });
    lbBtn.onclick = () => { togglePanel(lbPanel); renderLB(); };
    const helpBtn = $('bmHelp'), helpPanel = $('bmHelpPanel'); if (helpBtn && helpPanel) helpBtn.onclick = () => togglePanel(helpPanel);
    if (premiere) cv.addEventListener('click', () => { unlockAudio(); if (snap && snap.gs !== 'play' && snap.gs !== 'paused') send({ t: 'start' }); });
    if (premiere) endEl.addEventListener('click', () => { unlockAudio(); send({ t: 'start' }); });
    if (premiere) { hold('bmUp', 'up'); hold('bmDown', 'down'); hold('bmLeft', 'left'); hold('bmRight', 'right'); }
    const bomb = $('bmBomb'); if (bomb && premiere) bomb.addEventListener('pointerdown', e => { e.preventDefault(); unlockAudio(); send({ t: 'bomb' }); });
    const act = $('bmAct'); if (act && premiere) act.addEventListener('pointerdown', e => { e.preventDefault(); send({ t: 'action' }); });
    applyColors(); resizeH = resizeCanvas; addEventListener('resize', resizeH); resizeCanvas();
    addEventListener('keydown', onKeyDown); addEventListener('keyup', onKeyUp); addEventListener('blur', onBlur);
    music.start();
    rafId = requestAnimationFrame(drawLoop);
  }
  function onA11y() { applyColors(); }
  function teardown() { destroyed = true; music.stop(); cancelAnimationFrame(rafId); removeEventListener('resize', resizeH); removeEventListener('keydown', onKeyDown); removeEventListener('keyup', onKeyUp); removeEventListener('blur', onBlur); }

  return { init, onState, onMessage, onLb, onA11y, teardown };
})();
