// Module client PONG — « borne d'arcade synthwave » : rendu canvas, HUD, entrées, sons, options/classement.
// Contrat : init(ctx), onState(snap), onMessage(m), onLb(data), onA11y(), teardown() + joy() (manette tactile).
// Le shell fournit ctx = { root, send, a11y, togglePanel, closePanels }. Réseau/pseudo/thème = shell.
//
// Identité visuelle (thèmes Néon / Rétro CRT / Clair via a11y.theme), portée au niveau du Sumo :
//  - décor PRÉ-RENDU hors écran : ciel étoilé + nébuleuses, sol quadrillé synthwave (rayons vers les sommets,
//    emblème central, grain, vignette, balayage CRT) et scène titre (soleil rayé, montagnes, horizon) —
//    redessinés seulement au changement de taille / de terrain / de thème / de contraste ;
//  - raquettes en tubes néon (gaine, tube au motif du siège, cœur lumineux, électrodes) avec un visuel par
//    état (agrandie, rétrécie, aimant, inversée, bouclier, immunité, meneur), balle-comète, bumpers de flipper ;
//  - un effet par événement : étincelles au renvoi, bord qui se fissure à chaque vie perdue et vole en éclats
//    à l'élimination, bouclier qui encaisse, bonus qui éclate en pictogramme, relance ambrée des murs morts… ;
//  - ambiance : la grille pulse sur le tempo de la musique, le terrain chauffe quand les échanges s'emballent ;
//  - bonus au sol en PICTOGRAMMES vectoriels (jamais d'emoji dans le canvas : ils varient d'un OS à l'autre).
// Perf : aucune lueur par shadowBlur en jeu (sprites de dégradé pré-rendus, traits larges translucides),
// particules plafonnées ; tout le décoratif est coupé par « Réduire les effets ».
import { W as W0, H as H0, BALL_R, PAD_W, PAD_OFF, PU_R } from './shared.js';
let W = W0, H = H0;        // espace logique : agrandi par le serveur selon le nombre de joueurs (snapshot aw/ah)
import { createMusic } from '../../music.js';
import { seatPattern, SEAT_GLYPH } from '../../patterns.js';   // motifs par siège : lisibles même à 10 ou en mode équipe
import { initGameMsg, msgPerso, msgGlobal } from '../../gamemsg.js';   // messages de ramassage : l'icône seule ne parle pas
import { arenaSize } from '../../layout.js';   // taille du plateau : commune aux jeux (mode plein écran compris)
// Couche graphique commune aux 6 jeux, posée PAR-DESSUS la refonte (rien de ce qui précède n'est retiré) :
import { lumiere, creerLumieres } from '../../lumiere.js';       // balles qui éclairent le sol, éclairs aux renvois / bumpers / vies perdues
import { crepuscule, creerDuel } from '../../crepuscule.js';               // mort subite : l'arène glisse du jour au crépuscule
import { creerJournal, blocFin } from '../../finpartie.js';      // écran de fin : courbe des vies + meilleure action

// Duel final (crepuscule.js) : quand il ne reste que 2 joueurs ou 2 équipes, la nuit tombe en ~4 s.
const DUEL = creerDuel(), duelAnnonce = () => msgGlobal('⚔', 'Duel final !', { color: '#ff5a3c' });

const SHAPE = { 2: 'Face à face', 3: 'Triangle', 4: 'Carré', 5: 'Pentagone', 6: 'Hexagone', 7: 'Heptagone', 8: 'Octogone', 9: 'Ennéagone', 10: 'Décagone' };
// Glyphes TEXTE : uniquement pour les messages DOM (gamemsg) — le canvas dessine ses propres pictogrammes (picto()).
const PU_GLYPH = { multi: '+1', grow: 'XL', shield: '⛉', ghost: '◌', invert: '⇄', shrinkT: '▭', slow: '≈', mini: '▽', flip: '✕', speed: '»', blocker: '🧱', magnet: '🧲', invis: '∅' };
const PU_COL = { multi: '#ffffff', grow: '#ffd76b', shield: '#7fd1ff', ghost: '#cbb3ff', invert: '#ff9be0', shrinkT: '#ffb36b', slow: '#9fe6ff', mini: '#ff5a5a', flip: '#ff5a5a', speed: '#ff5a5a', blocker: '#c9a06a', magnet: '#ff8e6e', invis: '#ff5a5a' };
// Retour de test : « les icônes ne sont pas forcément claires ». Les libellés disent donc
// désormais l'EFFET et non le nom du power-up, en 5 mots maximum (c'est lu en une fraction
// de seconde). Source de vérité : le panneau d'aide de Pong dans index.html.
// Les libellés « globaux » sont volontairement neutres (« un joueur ») : ils s'affichent
// pour tout le monde, y compris pour la personne touchée.
const PU_NAME = { multi: 'La balle se divise', grow: 'Ta raquette s\'agrandit', shield: 'Bouclier : un renvoi gratuit', ghost: 'Balle fantôme : traverse une raquette', invert: 'Contrôles inversés pour un joueur', shrinkT: 'Raquette d\'un joueur rétrécie', slow: 'La balle ralentit un instant', mini: 'Ta raquette rétrécit', flip: 'Tes contrôles s\'inversent', speed: 'La balle accélère pour tous', blocker: 'Un plot bloqueur apparaît', magnet: 'Ta raquette attire les balles', invis: 'La balle devient presque invisible' };
// Portée du ramassage. true = tout le monde est concerné (balle commune modifiée, obstacle
// posé sur le terrain, ou adversaire touché) → bande globale collée au bord, hors de la zone
// de jeu. Absent = l'effet ne change que l'équipement du ramasseur → message perso, pour lui
// seul : l'afficher aux autres ne serait que du bruit.
const PU_GLOBAL = { multi: true, ghost: true, invert: true, shrinkT: true, slow: true, blocker: true, speed: true, invis: true };
const BUFF_ICON = { grow: 'XL', shield: '⛉', invert: '⇄', shrink: '▭', magnet: '🧲' };           // effets affichés sur les cartes (barres dégressives, DOM)
const BUFF_COL = { grow: '#ffd76b', shield: '#7fd1ff', invert: '#ff9be0', shrink: '#ffb36b', magnet: '#ff8e6e' };
const TEAM_LETTER = ['A', 'B', 'C', 'D', 'E'];
const MODE_NAME = { ffa: 'Chacun pour soi', '2v2': '2 v 2', '2v2v2': '2 v 2 v 2', '3v3': '3 v 3', '4v4': '4 v 4', '2v2v2v2': '2 v 2 v 2 v 2', '3v3v3': '3 v 3 v 3', '5v5': '5 v 5', '2v2v2v2v2': '2 v 2 v 2 v 2 v 2' };
const PRESET_LABEL = { classique: 'Classique', rapide: 'Rapide', chaos: 'Chaos', custom: 'Personnalisé' };
const PRESET_DESC = { classique: '5 vies · vitesse posée · sans power-ups', rapide: '3 vies · balle vive + accélération · power-ups', chaos: '5 vies · power-ups fréquents · multi-balle', custom: 'réglages personnalisés' };
const SPEED_LABEL = { lente: 'Lente', normale: 'Normale', rapide: 'Rapide' };
const WINMODE_LABEL = { survivor: 'Dernier survivant', rounds: 'Manches', kills: 'Éliminations' };
const SUDDEN_LABEL = { off: 'Off', shrink: 'Terrain rétrécit', accel: 'Balle accélère' };
const SERVE_LABEL = { random: 'Aléatoire', loser: 'Dernier perdant' };
const BOTDIFF_LABEL = { easy: 'Facile', normal: 'Normal', hard: 'Difficile', insane: 'Insane' };
const MAX_SEATS = 10;   // sièges maximum côté serveur pour Pong
// Palette des sièges. Au-delà de 8 il n'existe plus de teintes toutes distinguables :
// c'est le MOTIF par siège (patterns.js) qui porte l'identification.
const PAL = { normal: ['#4a9ee0', '#e06240', '#2aaf7a', '#cc9010', '#9b6cf0', '#e268b0', '#25c9c0', '#9ec93a', '#d06ef0', '#f2f0e6'],
              cb: ['#0072B2', '#E69F00', '#009E73', '#F0E442', '#CC79A7', '#56B4E9', '#D55E00', '#F5F5F5', '#7B68EE', '#9A9A9A'] };
const TEAMPAL = { normal: ['#4a9ee0', '#e06240', '#2aaf7a', '#cc9010', '#9b6cf0'], cb: ['#0072B2', '#E69F00', '#009E73', '#F0E442', '#CC79A7'] };
// Thèmes : `add` = lueurs en mélange additif (thèmes sombres) ; le thème clair peint ses halos en
// transparence normale (l'additif blanchirait tout sur fond clair).
const THEMES = {
  neon: { key: 'neon', add: true, bg: '#0a0a14', bg2: '#150b2c', field: '#0d0e1c', field2: '#1b1238',
    minor: 'rgba(120,150,255,0.08)', major: 'rgba(255,93,180,0.24)', spoke: 'rgba(111,240,255,0.11)', vig: 'rgba(2,2,10,0.62)', hot: '#ff5db4',
    ball: '#ffffff', wall: '#8f9dff', node: '#ff5db4', txt: '#ffffff', A: '#ff5db4', B: '#6ff0ff', veil: '4,5,12', panel: 'rgba(8,4,22,0.86)',
    token: '#0b0b1a', star: '#9fd0ff', neb: ['#ff3fa4', '#3f7bff', '#8a3fff'], label: 'rgba(4,4,14,0.55)',
    sky: ['#070419', '#1c0838', '#4a0c5c', '#ff2e88'], sun: ['#fff27a', '#ffb13b', '#ff4f8b', '#c3207a'], mount: ['#2a0a4a', '#12062a'], ridge: '#ff5db4',
    floor: ['#1a0633', '#05020c'], chrome: ['#ffffff', '#9fe8ff', '#2b1a5a', '#ff5db4', '#ffd0ec'] },
  crt: { key: 'crt', add: true, bg: '#04140b', bg2: '#072414', field: '#06190e', field2: '#0c2c19',
    minor: 'rgba(120,255,170,0.08)', major: 'rgba(120,255,170,0.24)', spoke: 'rgba(200,255,107,0.11)', vig: 'rgba(0,6,2,0.62)', hot: '#7dffae',
    ball: '#d8ffe4', wall: '#4fe08a', node: '#9dffc0', txt: '#d8ffe4', A: '#5dff9a', B: '#c8ff6b', veil: '2,10,5', panel: 'rgba(2,14,7,0.88)',
    token: '#031009', star: '#8dffb5', neb: ['#2fff8a', '#7dff3f', '#1fc0a0'], label: 'rgba(0,10,4,0.55)',
    sky: ['#010805', '#021a0d', '#053319', '#1d7a44'], sun: ['#e8ffef', '#8dffb5', '#3fe07f', '#1b8a4a'], mount: ['#06301a', '#021208'], ridge: '#5dff9a',
    floor: ['#03170c', '#010603'], chrome: ['#f0fff4', '#9dffc0', '#0a3a1c', '#5dff9a', '#d8ffe4'] },
  light: { key: 'light', add: false, bg: '#e4e8f3', bg2: '#d5d9ee', field: '#d6dbe9', field2: '#f0f2f9',
    minor: 'rgba(40,50,110,0.08)', major: 'rgba(208,40,127,0.22)', spoke: 'rgba(10,143,176,0.16)', vig: 'rgba(90,100,150,0.22)', hot: '#d0287f',
    ball: '#1a1d2e', wall: '#565c8c', node: '#d0287f', txt: '#15182b', A: '#d0287f', B: '#0a8fb0', veil: '228,232,243', panel: 'rgba(255,255,255,0.9)',
    token: '#ffffff', star: '#7a86b8', neb: ['#ff8fc8', '#8fc0ff', '#c8a0ff'], label: 'rgba(255,255,255,0.62)',
    sky: ['#bcd4ff', '#e3d4ff', '#ffd3ea', '#ff9fcb'], sun: ['#fff3a0', '#ffc27a', '#ff8fb8', '#e0609a'], mount: ['#a99ad8', '#8a7fc0'], ridge: '#ffffff',
    floor: ['#e9e2ff', '#cfd8f5'], chrome: ['#3a2d7a', '#5a4fb0', '#ffffff', '#d0287f', '#8a1f5a'] },
};
const DISP = s => `800 ${s}px Orbitron,'Segoe UI',system-ui,sans-serif`;   // police d'affichage (Google Fonts, chargée par la page)
const UI = s => `bold ${s}px system-ui,-apple-system,'Segoe UI',sans-serif`;
const TEX_MAX = 1400;          // côté max (px) d'un décor pré-rendu : borne la mémoire sur les grands écrans HiDPI
const NO_DASH = [], DASH_NET = [2, 5], DASH_BAR = [7, 4], DASH_BAR2 = [3, 8], DASH_RING = [3, 4], DASH_GHOST = [4, 3], DASH_ARROW = [9, 6];
const CAP = { rings: 48, sparks: 260, dots: 260, shards: 140, pops: 8, texts: 8 };   // plafonds de particules
// Retard d'interpolation : il doit couvrir un peu plus d'un intervalle entre deux instantanés.
// Le hub diffuse à 60 Hz, et à 30 Hz seulement quand il y a 7 participants ou plus ; il annonce
// la cadence effective dans `shz` et on s'aligne dessus (sinon, à 30 Hz, le rendu saccade).
let INTERP_MS = 33;

// Musique : synthwave en La mineur (Am – F – C – G, une mesure par accord) — nappe + arpège doux au lobby ;
// en jeu basse en croches à saut d'octave, arpège carré en doubles, accroche de lead, boîte à rythmes
// (caisse claire sur 2 et 4, charley à contretemps) ; climax (échanges rapides) = charley serré + étincelles + tempo.
let _lastCount = -1, _prevSd = false;   // décompte musical + riser de mort subite
const PROG = [0, -4, 3, -2], CHORD = [[0, 3, 7], [-4, 0, 3], [3, 7, 10], [-2, 2, 5]];
const LEAD = [[12, null, null, 15, null, null, 19, null, null, null, 17, null, 15, null, null, null],
              [12, null, null, 8, null, null, 12, null, 15, null, null, null, 17, null, 15, null],
              [19, null, null, 15, null, null, 10, null, 15, null, null, null, 22, null, null, null],
              [14, null, null, 17, null, null, 22, null, null, null, 17, null, 14, null, 12, null]];
const SEQ = { pad: [], bass: [], arp: [], arpSoft: [], lead: [] };
for (let c = 0; c < 4; c++) for (let s = 0; s < 16; s++) {
  const tones = CHORD[c].concat([CHORD[c][0] + 12]);
  SEQ.pad.push(s === 0 ? tones.slice() : null);
  SEQ.bass.push(s % 2 === 0 ? PROG[c] + (s % 8 === 6 ? 12 : 0) : null);
  const a = tones[s % 4] + (s >= 8 ? 12 : 0);
  SEQ.arp.push(a); SEQ.arpSoft.push(s % 2 === 0 ? a : null);
  SEQ.lead.push(LEAD[c][s]);
}
const MUSIC_THEME = { bpm: 118, bpmBoost: 14, vol: 0.45, root: 110, len: 64,
  stingers: { kill: { notes: [12, 7, 3, 0], wave: 'square', oct: 1, gain: 0.03, dur: 0.12, rate: 0.06 },
    win: { base: 220, notes: [[0, 7, 12], [3, 10, 15], [5, 12, 17], [7, 14, 19], [12, 19, 24]], wave: 'square', gain: 0.022, dur: 0.34, rate: 0.12 },
    count: { notes: [12], oct: 1, wave: 'square', dur: 0.09, gain: 0.04, duck: false }, go: { notes: [[0, 7, 12]], oct: 1, wave: 'sawtooth', dur: 0.45, gain: 0.03, duck: false },
    alert: { notes: [0, 3, 6, 9, 12, 15, 18], oct: 1, wave: 'sawtooth', rate: 0.05, dur: 0.12, gain: 0.03 } },
  layers: [
    { seq: SEQ.pad, wave: 'sine', gain: 0.014, dur: 15 },                                   // nappe : un accord par mesure
    { seq: SEQ.arpSoft, oct: 2, wave: 'sine', gain: 0.008, dur: 1.4 },                        // arpège doux (lobby compris)
    { seq: SEQ.bass, wave: 'triangle', gain: 0.05, dur: 1.5, min: 1 },                         // basse en croches
    { seq: SEQ.bass, wave: 'square', gain: 0.008, dur: 1.1, min: 1 },                          // … et son grain
    { seq: SEQ.arp, oct: 2, wave: 'square', gain: 0.0055, dur: 0.6, min: 1 },                  // arpège carré en doubles
    { seq: SEQ.lead, oct: 1, wave: 'square', gain: 0.012, dur: 1.4, min: 1 },                  // accroche de lead
    { drums: 'K...S...K.K.S...', gain: 0.8, min: 1 },
    { drums: '..H...H...H...H.', gain: 0.55, min: 1 },
    { drums: 'H.HHH.HHH.HHH.HH', gain: 0.35, min: 2 },                                         // climax : charley serré
    { seq: [0, 3, 7, 10], oct: 3, wave: 'sine', gain: 0.006, dur: 0.8, min: 2 },
  ] };
// fond animé : quelques étoiles qui scintillent par-dessus le ciel pré-rendu (dérivées du temps, coupées par reduceFx)
const AMB_STARS = Array.from({ length: 12 }, () => ({ x: Math.random(), y: Math.random(), r: 1 + Math.random() * 1.6, ph: Math.random() * 6.28, sp: 700 + Math.random() * 900 }));

// ───────────────────────── utilitaires (sans état) ─────────────────────────
const RGB = {};
function rgbOf(h) {                                        // '#abc' / '#aabbcc' → 'r,g,b' (mis en cache)
  let r = RGB[h]; if (r) return r;
  let s = String(h || '#ffffff').replace('#', ''); if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
  const n = parseInt(s.slice(0, 6), 16) || 0; r = ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255);
  RGB[h] = r; return r;
}
const rgba = (h, a) => 'rgba(' + rgbOf(h) + ',' + (a < 0 ? 0 : a > 1 ? 1 : Math.round(a * 1000) / 1000) + ')';
const SHADE = {};
function shade(h, t) {                                     // t > 0 : vers le blanc · t < 0 : vers le noir (mis en cache)
  const k = h + '|' + t; let r = SHADE[k]; if (r) return r;
  const c = rgbOf(h).split(',').map(Number), to = t > 0 ? 255 : 0, u = Math.abs(t);
  r = 'rgb(' + c.map(v => Math.round(v + (to - v) * u)).join(',') + ')'; SHADE[k] = r; return r;
}
function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }   // mulberry32 : décor identique d'un rendu à l'autre
function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; }
// rectangle arrondi maison : ctx.roundRect est absent des vieux Safari
function rrect(g, x, y, w, h, r) { g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
const TRI = t => { const u = ((t % 2) + 2) % 2; return u < 1 ? u : 2 - u; };   // onde triangulaire 0→1→0

// Pictogrammes des bonus, dessinés au canvas dans un carré ±8 (le jeton a un rayon PU_R = 13). Même idée que
// les glyphes du panneau d'aide (index.html) : +1, XL, ⛉, ◌, ⇄, ▭, ≈, mur, aimant, ▽, ✕, », ∅.
// core = 2e passe fine et claire par-dessus (effet tube néon) : pas de remplissage.
function picto(g, t, core) {
  const ln = (x1, y1, x2, y2) => { g.moveTo(x1, y1); g.lineTo(x2, y2); };
  const disc = (x, y, r) => { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); if (!core) g.fill(); g.stroke(); };
  g.lineCap = 'round'; g.lineJoin = 'round';
  if (t === 'multi') {                                     // +1 : une balle qui se dédouble, et un « + »
    disc(-3.2, 2.6, 2.6); disc(3.6, 3.4, 2.1);
    g.beginPath(); ln(3, -7, 3, -1.6); ln(0.3, -4.3, 5.7, -4.3); g.stroke();
    g.beginPath(); ln(-5.6, -1.2, -3.6, -4.8); g.stroke();
  } else if (t === 'grow' || t === 'shrinkT' || t === 'mini') {
    const hw = t === 'grow' ? 3.6 : t === 'shrinkT' ? 2.6 : 1.9;   // la barre (la raquette)…
    g.beginPath(); rrect(g, -hw, -1.5, hw * 2, 3, 1.2); if (!core && t !== 'shrinkT') g.fill(); g.stroke();   // ▭ : barre en creux
    g.beginPath();
    if (t === 'grow') { ln(-5, 0, -8, 0); ln(-6.3, -2, -8.2, 0); ln(-8.2, 0, -6.3, 2); ln(5, 0, 8, 0); ln(6.3, -2, 8.2, 0); ln(8.2, 0, 6.3, 2); }   // … qui s'étire
    else { ln(-8.4, 0, -hw - 1.6, 0); ln(-hw - 3.4, -2, -hw - 1.4, 0); ln(-hw - 1.4, 0, -hw - 3.4, 2); ln(8.4, 0, hw + 1.6, 0); ln(hw + 3.4, -2, hw + 1.4, 0); ln(hw + 1.4, 0, hw + 3.4, 2); }   // … qu'on écrase
    g.stroke();
    if (t === 'mini') { g.beginPath(); g.moveTo(-3, 3.8); g.lineTo(3, 3.8); g.lineTo(0, 7.6); g.closePath(); if (!core) g.fill(); g.stroke(); }   // ▽
    if (t === 'shrinkT') { g.beginPath(); g.arc(0, -5.2, 2, 0, Math.PI * 2); ln(0, -8.2, 0, -7.4); g.stroke(); }                        // mire : un adversaire visé
  } else if (t === 'shield') {                             // ⛉ : écu
    g.beginPath(); g.moveTo(0, -7.2); g.lineTo(6, -4.6); g.lineTo(5.2, 1.4); g.quadraticCurveTo(3.6, 5.2, 0, 7.4); g.quadraticCurveTo(-3.6, 5.2, -5.2, 1.4); g.lineTo(-6, -4.6); g.closePath(); g.stroke();
    g.beginPath(); ln(0, -4.2, 0, 4.6); ln(-3.4, -1.4, 3.4, -1.4); g.stroke();
  } else if (t === 'ghost') {                              // ◌ : balle en pointillés + sillage
    g.save(); g.setLineDash(DASH_GHOST); g.beginPath(); g.arc(1.2, 0, 5.4, 0, Math.PI * 2); g.stroke(); g.restore();
    g.beginPath(); ln(-8, -2.4, -5.6, -2.4); ln(-8.4, 1.2, -5.2, 1.2); ln(-7.2, 4.4, -5.8, 4.4); g.stroke();
  } else if (t === 'invert') {                             // ⇄
    g.beginPath(); ln(-6.5, -2.8, 6, -2.8); ln(3.2, -5.6, 6.2, -2.8); ln(6.2, -2.8, 3.2, 0); ln(6.5, 2.8, -6, 2.8); ln(-3.2, 0, -6.2, 2.8); ln(-6.2, 2.8, -3.2, 5.6); g.stroke();
  } else if (t === 'slow') {                               // ≈ : trois ondes calmes
    g.beginPath();
    for (const y of [-4.2, 0, 4.2]) { g.moveTo(-7, y); g.quadraticCurveTo(-3.5, y - 2.6, 0, y); g.quadraticCurveTo(3.5, y + 2.6, 7, y); }
    g.stroke();
  } else if (t === 'flip') {                               // ✕ : deux flèches qui se croisent
    g.beginPath(); ln(-5.6, 5.6, 5.2, -5.2); ln(1.6, -5.8, 5.6, -5.6); ln(5.6, -5.6, 5.8, -1.6); ln(-5.6, -5.6, 5.2, 5.2); ln(5.8, 1.6, 5.6, 5.6); ln(5.6, 5.6, 1.6, 5.8); g.stroke();
  } else if (t === 'speed') {                              // »
    g.beginPath(); ln(-6, -5.6, -1.4, 0); ln(-1.4, 0, -6, 5.6); ln(0.6, -5.6, 5.2, 0); ln(5.2, 0, 0.6, 5.6); g.stroke();
  } else if (t === 'blocker') {                            // mur de briques
    g.beginPath(); rrect(g, -6.6, -5.4, 13.2, 10.8, 1); g.stroke();
    g.beginPath(); ln(-6.6, -1.8, 6.6, -1.8); ln(-6.6, 1.8, 6.6, 1.8); ln(0, -5.4, 0, -1.8); ln(-3.3, -1.8, -3.3, 1.8); ln(3.3, -1.8, 3.3, 1.8); ln(0, 1.8, 0, 5.4); g.stroke();
  } else if (t === 'magnet') {                             // aimant en fer à cheval, pointes claires
    g.beginPath(); g.moveTo(-4.6, -6); g.lineTo(-4.6, 0.6); g.arc(0, 0.6, 4.6, Math.PI, 0, true); g.lineTo(4.6, -6); g.stroke();
    if (!core) { g.save(); g.strokeStyle = '#ffffff'; g.beginPath(); ln(-6.2, -6, -3, -6); ln(3, -6, 6.2, -6); g.stroke(); g.restore(); }
  } else if (t === 'invis') {                              // ∅
    g.beginPath(); g.arc(0, 0, 5.2, 0, Math.PI * 2); ln(-6.4, 6.4, 6.4, -6.4); g.stroke();
  } else { g.beginPath(); g.arc(0, 0, 4, 0, Math.PI * 2); g.stroke(); }
}

export default (function () {
  let A, send, root, cv, ctx, togglePanel = () => {}, closePanels = () => {};
  let CC = PAL.normal, TEAMCC = TEAMPAL.normal, TH = THEMES.neon;
  let mySeat = -1, maxLives = 5, snap = null, prevGs = 'lobby', teamMode = false;
  let board = [], history = [], endShown = false, inGamePrev = false;
  let buf = [], trails = [];
  const rings = [], sparks = [], dots = [], shards = [], pops = [], texts = [], breaks = [], bumpHits = [];
  const edgeFlash = {}, barrierFlash = {}, wallFlash = {};
  const blockSeen = new Map();                             // plots bloqueurs : instant d'apparition (animation d'entrée)
  let actx = null, noiseBuf = null, sndPan = 0;
  const music = createMusic(() => actx, () => A, MUSIC_THEME);
  let shakeMag = 0, ballPopUntil = 0, bannerTimer = null, curWinMode = 'survivor';
  let rafId = 0, destroyed = false, resizeH = null, lastFrame = 0, curInten = 0, countT = 0, lastFw = 0;
  let geo0 = null;                                         // sommets du terrain en début de manche : fantôme du rétrécissement
  const flashes = creerLumieres(16);                       // éclairs éphémères sur le sol (plafonnés)
  let sdAcc = 0;                                           // ms de mort subite JOUÉES (la pause fige le crépuscule)
  // Journal de la manche (côté client) : vies de chaque joueur + faits marquants pour l'écran de fin
  const J = creerJournal();
  let rally = 0, bestRally = 0, lastHit = -1, saves1 = {}, lastKill = {};
  const input = { up: false, dn: false };
  // Prédiction locale de SA raquette : elle bouge dès l'appui au lieu d'attendre l'aller-retour réseau
  // puis le tampon d'interpolation (~100 ms au total). `pred` est recalé sur le serveur au repos.
  let pred = null, padSpd = 5.5, dernierInputT = 0;
  // DOM refs
  let hud, cards, startBtn, pauseBtn, botsBtn, modeBtn, presetBtn, pauseFloat;
  let optBtn, optionsPanel, optLives, optSpeed, optPu, optAccel, optWin, optSudden, optServe, optHandi;
  let optTarRow, optTar, optTarLbl, optNeg, optBot, optStyle, optBump, lbBtn, lbPanel, voteBtn, histPreset, histMode;

  const $ = id => root.querySelector('#' + id) || document.getElementById(id);
  function colSeat(s) { if (s < 0 || !snap) return '#ffffff'; const p = snap.players[s]; return teamMode && p ? TEAMCC[p.team] : CC[s]; }
  function colOf(p) { return teamMode ? TEAMCC[p.team] : CC[p.seat]; }
  function nameOf(s) { const p = snap && snap.players[s]; return p ? (p.name || ('P' + (s + 1))) : ('P' + (s + 1)); }
  const ADD = () => TH.add ? 'lighter' : 'source-over';
  // intensité de l'éclairage dynamique : l'additif blanchirait le thème Clair, et le contraste renforcé veut un sol calme
  const lightK = () => (TH.add ? 1 : 0.4) * (A.contrast ? 0.6 : 1);

  function applyColors() {
    CC = PAL[A.palette] || PAL.normal; TEAMCC = TEAMPAL[A.palette] || TEAMPAL.normal;
    TH = THEMES[A.theme] || THEMES.neon;
    bgKey = ''; fieldKey = ''; lobbyKey = ''; logoKey = ''; sprites = {}; spriteN = 0; scanPat = null;   // décors et sprites dépendent du thème / du contraste
  }

  function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const size = arenaSize({ max: 1100, side: 200, hLobby: 0.66, hPlay: 0.86 });   // side : les flèches ▲▼ encadrent le plateau sur desktop
    cv.style.width = size + 'px'; cv.style.height = size + 'px';
    cv.width = Math.round(size * dpr); cv.height = Math.round(size * dpr);
  }

  function refreshHUD() {
    if (!snap) return;
    snap.players.forEach((p, i) => {
      const shown = p.connected || p.bot || p.playing;
      cards[i].classList.toggle('hidden', !shown);
      if (!shown) return;
      const col = colOf(p);
      cards[i].style.color = col;
      const l = Math.max(0, p.lives);
      const lvEl = document.getElementById('lv' + i); lvEl.style.color = col;
      const buffs = (p.buffs || []).map(([k, fr]) => { const c = BUFF_COL[k] || '#fff', pct = Math.max(0, Math.min(100, Math.round(fr * 100))); return `<span class="buff" style="background:linear-gradient(90deg,${c} ${pct}%,rgba(255,255,255,.12) ${pct}%);border-color:${c}66">${BUFF_ICON[k] || '?'}</span>`; }).join('');
      lvEl.innerHTML = '●'.repeat(l) + '○'.repeat(Math.max(0, maxLives - l)) + (buffs ? ' ' + buffs : '');
      const tags = [];
      if (teamMode) tags.push(`<span class="badge" style="background:${col}28;color:${col}">ÉQ.${TEAM_LETTER[p.team]}</span>`);
      if (p.bot) tags.push(`<span class="badge" style="background:${col}28;color:${col}">BOT</span>`);
      else if (i === mySeat) tags.push(`<span class="badge" style="background:${col}28;color:${col}">VOUS</span>`);
      const gl = `<span style="opacity:.75;margin-right:3px" title="motif de la raquette">${SEAT_GLYPH[i % SEAT_GLYPH.length]}</span>`;   // glyphe = motif du siège (constante, jamais du réseau)
      document.getElementById('pn' + i).innerHTML = `${(window.__AV && window.__AV(p.name)) || ''}${gl}${p.name || ('P' + (i + 1))} <span class="sc">${p.score} pt</span> ${tags.join('')}`;
      cards[i].classList.toggle('dead', p.playing && !p.alive);
      cards[i].classList.toggle('me', i === mySeat);
    });
  }

  function renderHist() {
    const el = $('lbHist'); if (!el) return;
    const fp = histPreset.value, fm = histMode.value;
    const rows = history.filter(h => (!fp || h.preset === fp) && (!fm || h.mode === fm)).map(h =>
      `<div class="h"><b>${h.winner}</b> · ${MODE_NAME[h.mode] || h.mode} / ${PRESET_LABEL[h.preset] || h.preset} · ${h.durationSec}s · ${h.nParts} j.</div>`).join('');
    el.innerHTML = rows || '<div class="lbnote">Aucune partie pour ce filtre.</div>';
  }
  const fmtT = s => s == null ? '—' : Math.round(s) + 's';
  const kdNum = e => e.deaths ? e.kills / e.deaths : e.kills;
  const kdStr = e => e.deaths ? (e.kills / e.deaths).toFixed(2) : (e.kills ? '∞' : '0');
  const avgSurv = e => e.games ? (e.survSum || 0) / e.games : 0;
  function renderLB() {
    const body = $('lbBody'); if (!body) return;
    if (!board.length) { body.innerHTML = '<div class="lbnote">Aucune partie enregistrée pour l\'instant.</div>'; return; }
    const B = board.map(e => ({ ...e, kd: kdNum(e), avg: avgSurv(e) }));
    const sup = [];
    const best = (field, dir, filter) => { const c = B.filter(filter || (() => true)); return c.length ? c.reduce((a, b) => (dir < 0 ? (b[field] < a[field] ? b : a) : (b[field] > a[field] ? b : a))) : null; };
    const top = (label, field, dir, filter, fmt) => { const e = best(field, dir, filter); if (e) sup.push(`<div class="lbsup"><span>${label}</span><span><b>${e.name}</b> <small>${fmt ? fmt(e) : e[field]}</small></span></div>`); };
    top('🏆 Plus de victoires', 'wins', 1);
    top('💀 Plus d\'éliminations', 'kills', 1);
    top('⚖ Meilleur ratio K/D', 'kd', 1, e => e.games > 0, kdStr);
    top('⏱ Survie la plus longue', 'bestSurvivalSec', 1, null, e => fmtT(e.bestSurvivalSec));
    top('⌀ Meilleure survie moyenne', 'avg', 1, e => e.games > 0, e => fmtT(e.avg));
    top('✦ Plus de power-ups', 'pu', 1);
    top('🐔 Éliminé le plus vite', 'fastestElimSec', -1, e => e.fastestElimSec != null, e => fmtT(e.fastestElimSec));
    top('😴 Touche le moins (1 manche)', 'fewestTouches', -1, e => e.fewestTouches != null, e => e.fewestTouches);
    const rows = B.sort((a, b) => b.wins - a.wins || b.kd - a.kd).map(e =>
      `<div class="lbrow"><span class="lbn">${e.name}</span><span>🎮${e.games}</span><span>🏆${e.wins}</span><span>💀${e.kills}</span><span title="ratio K/D">⚖${kdStr(e)}</span><span title="survie moyenne">⌀${Math.round(e.avg)}s</span><span title="meilleure survie">⏱${Math.round(e.bestSurvivalSec)}s</span></div>`).join('');
    body.innerHTML = `<div class="lbsups">${sup.join('')}</div>${rows}`;
  }

  function showEndscreen(m) {
    const es = $('endscreen');
    if (m.gs !== 'over' || !m.stats) { es.classList.add('hidden'); return; }
    es.classList.remove('hidden');
    const nm = s => { const q = m.players[s]; return q ? (q.name || ('P' + (s + 1))) : ('P' + (s + 1)); };
    const parts = m.players.filter(p => p.edge >= 0 && p.place > 0).slice().sort((a, b) => a.place - b.place);
    const w = m.winner, champ = w >= 0 ? parts.find(p => p.team === w) : null;
    const isMatch = m.stats && m.stats.match;
    const who = champ ? (teamMode ? 'Équipe ' + TEAM_LETTER[w] : nm(champ.seat)) : null;
    const title = (m.stats && m.stats.nParts === 1) ? '🎯 Entraînement terminé' : (champ ? (isMatch ? '🏆 ' + who + ' REMPORTE LE MATCH' : who + ' gagne') : 'Égalité');
    const medals = ['🥇', '🥈', '🥉'];
    const rows = parts.map(p => {
      const col = colOf(p), place = p.place || 0;
      const medal = medals[place - 1] || ('#' + (place || '?'));
      let res;
      if (p.alive) res = teamMode ? 'survivant·e — équipe gagnante' : 'vainqueur';
      else { const by = p.elimBy >= 0 ? nm(p.elimBy) : 'le mur'; res = `éliminé par ${by} à ${Math.round((p.elimTick || 0) / 60)}s`; }
      return `<div class="erow ${p.alive ? 'win' : ''}">
        <span class="eplace">${medal}</span>
        <span class="ename" style="color:${col}">${nm(p.seat)}${teamMode ? ` <small>Éq.${TEAM_LETTER[p.team]}</small>` : ''}${p.bot ? ' <small>BOT</small>' : ''}</span>
        <span class="estat" title="éliminations">💀 ${p.kills}</span>
        <span class="estat" title="vies retirées">⚔ ${p.dmg}</span>
        <span class="estat" title="vies restantes">❤ ${Math.max(0, p.lives)}</span>
        <span class="estat" title="rebonds">🏓 ${p.hits}</span>
        <span class="estat" title="power-ups">✦ ${p.puGot}</span>
        <span class="eres">${res}</span></div>`;
    }).join('');
    const pod = board.slice().sort((a, b) => b.wins - a.wins || b.kills - a.kills).slice(0, 3);
    const order = pod.length === 3 ? [1, 0, 2] : pod.map((_, i) => i);
    const HG = [104, 74, 54], MED = ['🥇', '🥈', '🥉'], PC = ['#ffd76b', '#cfd6e6', '#d8965a'];
    const podHtml = pod.length ? `<div class="podlabel">Classement cumulé</div><div class="podium">${
      order.map(rank => { const e = pod[rank];
        return `<div class="pcol"><div class="pname">${e.name}</div><div class="pmedal">${MED[rank]}</div>
          <div class="pbar" style="height:${HG[rank]}px;background:linear-gradient(180deg,${PC[rank]},${PC[rank]}44)"></div>
          <div class="pwins">${e.wins} 🏆</div></div>`; }).join('')}</div>` : '';
    let mvpLine = '';
    if (parts.length) {
      const scoreOf = p => p.kills * 100 + p.dmg * 10 + (p.alive ? 40 : 0) - p.place;
      const mvp = parts.reduce((a, b) => scoreOf(b) > scoreOf(a) ? b : a);
      const losers = parts.filter(p => !p.alive);
      const boulet = losers.length ? losers.reduce((a, b) => (b.place > a.place || (b.place === a.place && b.hits < a.hits)) ? b : a) : null;
      mvpLine = `<div class="emeta">🏅 MVP <b style="color:${colOf(mvp)}">${nm(mvp.seat)}</b> (${mvp.kills}💀 · ${mvp.dmg}⚔)${boulet && boulet !== mvp ? ` · 🐔 <b style="color:${colOf(boulet)}">${nm(boulet.seat)}</b>` : ''}</div>`;
    }
    // courbe des vies de la manche + meilleure action (journal client ; noms échappés et couleurs filtrées par blocFin)
    const finHtml = blocFin(J, { titre: 'Vies au fil de la manche', couleur: s => colSeat(s), nom: s => nm(s) });
    // habillage borne d'arcade : bandeau « GAME OVER » au-dessus du titre, « CONTINUE ? » sous le podium
    es.innerHTML = `<div class="emeta" style="font-family:Orbitron,'Segoe UI',sans-serif;font-weight:800;letter-spacing:.32em;color:#ff5db4">GAME OVER</div>
      <div class="etitle" style="color:${champ ? colOf(champ) : '#fff'}">${title}</div>
      <div class="emeta">⏱ ${m.stats.durationSec}s · 🏓 ${m.stats.bounces} rebonds · ${m.stats.nParts} joueurs</div>
      ${mvpLine}<div class="elist">${rows}</div>${finHtml}${podHtml}<div class="ehint"><b style="font-family:Orbitron,'Segoe UI',sans-serif;letter-spacing:.12em;color:#6ff0ff">CONTINUE ?</b> Espace / clic pour rejouer</div>`;
  }

  /* ---- entrées réseau (appelées par le shell) ---- */
  function onMessage(m) {
    if (!m || m.t !== 'welcome') return;
    mySeat = m.seat;
    if (typeof m.maxLives === 'number') maxLives = m.maxLives;
    if (voteBtn) voteBtn.style.display = mySeat < 0 ? '' : 'none';
  }
  function onLb(d) {
    board = d.board || []; history = d.history || [];
    renderLB(); renderHist();
    if (snap && snap.gs === 'over' && endShown) showEndscreen(snap);
  }
  function onState(m) {
    if (m.aw && m.aw !== W) { W = m.aw; H = m.ah || m.aw; }  // arène redimensionnée (nb de joueurs)
    if (m.geo === undefined && snap) m.geo = snap.geo;      // delta réseau : géométrie absente = inchangée (null = vraiment vide)
    const prev = snap; snap = m;
    if (m.pspd) padSpd = m.pspd;                       // vitesse par tick (dépend du nombre de joueurs)
    teamMode = m.mode && m.mode !== 'ffa';
    if (typeof m.maxLives === 'number') maxLives = m.maxLives;
    const inGame = m.gs === 'play' || m.gs === 'countdown' || m.gs === 'paused';
    if (inGame !== inGamePrev) { inGamePrev = inGame; document.body.classList.toggle('playing', inGame); resizeCanvas(); }
    document.body.classList.toggle('paused', m.gs === 'paused');
    if (m.gs === 'play' || m.gs === 'countdown') closePanels();
    if (m.shz) INTERP_MS = m.shz >= 50 ? 33 : 50;   // cadence de diffusion annoncée par le hub
    // terrain de référence de la manche (hors jeu, ou au changement de nombre de bords) : sert à montrer ce
    // que la mort subite « rétrécit » a déjà mangé. Jamais repris en cours de manche, sinon il suivrait le rétrécissement.
    const ge = m.geo && m.geo.edges;
    if (ge && ge.length && ((m.gs !== 'play' && m.gs !== 'paused' && m.gs !== 'over') || !geo0 || geo0.length !== ge.length * 2)) {
      geo0 = []; for (const e of ge) geo0.push(e.ax, e.ay);
    }
    if (m.gs === 'countdown' && prevGs !== 'countdown') { breaks.length = 0; shards.length = 0; flashes.vider(); sdAcc = 0; }   // nouvelle manche : bords réparés, retour au jour
    buf.push({ t: performance.now(), s: m }); if (buf.length > 10) buf.shift();
    (m.fx || []).forEach(playFx);
    (m.fx || []).forEach(f => {
      if (f.type === 'death') { music.sting('kill'); if (f.elim) addKill(f.by, f.side); }
      else if (f.type === 'powerup') msgPowerup(f);   // remplace l'ancien banner() des malus : il s'affichait au centre, pour tout le monde, même quand le malus ne touchait que le ramasseur
    });
    journal(prev, m, performance.now());               // AVANT l'écran de fin (plus bas) : il lit ce journal
    detectBanners(prev, m);
    if (prevGs !== 'over' && m.gs === 'over') { sound('win'); music.sting('win'); }
    if (m.gs === 'countdown' && m.count > 0 && m.count !== _lastCount) { music.sting('count'); sound('count'); countT = performance.now(); }   // décompte 3·2·1 : bip de borne
    if (prevGs === 'countdown' && m.gs === 'play') { music.sting('go'); sound('go'); countT = performance.now(); }
    _lastCount = m.count;
    if (m.sd && !_prevSd) music.sting('alert'); _prevSd = !!m.sd;                                 // riser : mort subite
    prevGs = m.gs;
    { let inten = 0;                                  // musique : 1 en jeu, 2 quand les échanges deviennent rapides
      if (m.gs === 'play' || m.gs === 'countdown') inten = (m.gs === 'play' && musicIntensity() > 0.55) ? 2 : 1;
      curInten = inten; music.setIntensity(inten); }
    refreshHUD();
    if (m.gs === 'over') { if (!endShown) { showEndscreen(m); endShown = true; } }
    else { endShown = false; $('endscreen').classList.add('hidden'); }
    const n = m.connected + m.botCount;
    const idle = m.gs === 'lobby' || m.gs === 'over';
    startBtn.disabled = !(mySeat >= 0 && idle && m.connected >= 1 && n >= 1);   // n=1 : entraînement solo (mur)
    startBtn.textContent = m.gs === 'over' ? '↻ Rejouer' : '▶ Démarrer';
    pauseBtn.disabled = !(m.gs === 'play' || m.gs === 'paused');
    pauseBtn.textContent = m.gs === 'paused' ? '▶ Reprendre' : '⏸ Pause';
    pauseFloat.textContent = m.gs === 'paused' ? '▶' : '⏸';
    botsBtn.disabled = !idle; botsBtn.textContent = '🤖 Bots : ' + m.botCount; botsBtn.classList.toggle('on', m.botCount > 0);
    modeBtn.disabled = !(idle && (n === 4 || n === 6 || n === 8 || n === 9 || n === 10)); modeBtn.textContent = '⚔ ' + (MODE_NAME[m.mode] || m.mode); modeBtn.classList.toggle('on', teamMode);   // effectifs pour lesquels des modes en équipes existent
    presetBtn.disabled = !idle; presetBtn.textContent = '🎮 ' + (PRESET_LABEL[m.preset] || m.preset);
    if (m.opts) {
      optLives.textContent = m.opts.lives;
      optSpeed.textContent = SPEED_LABEL[m.opts.speed] || m.opts.speed;
      optPu.checked = m.opts.pu; optAccel.checked = m.opts.accel;
      curWinMode = m.opts.winMode;
      optWin.textContent = WINMODE_LABEL[m.opts.winMode] || m.opts.winMode;
      optSudden.textContent = SUDDEN_LABEL[m.opts.sudden] || m.opts.sudden;
      optServe.textContent = SERVE_LABEL[m.opts.serve] || m.opts.serve;
      optHandi.checked = m.opts.handicap;
      optNeg.checked = m.opts.negatives;
      if (optBump) optBump.checked = !!m.opts.bumpers;
      optBot.textContent = BOTDIFF_LABEL[m.opts.botDiff] || m.opts.botDiff;
      if (optStyle) optStyle.textContent = ({ equilibre: 'Équilibré', agressif: 'Agressif', defensif: 'Défensif' })[m.opts.botStyle] || 'Équilibré';
      optSudden.classList.toggle('on', m.opts.sudden !== 'off');
      const showTar = m.opts.winMode !== 'survivor';
      optTarRow.style.display = showTar ? '' : 'none';
      if (showTar) { optTarLbl.textContent = m.opts.winMode === 'kills' ? 'Élim. cible' : 'Manches à gagner'; optTar.textContent = m.opts.winMode === 'kills' ? m.opts.killsTarget : m.opts.roundsTarget; }
      [optLives, optSpeed, optPu, optAccel, optWin, optSudden, optServe, optHandi, optNeg, optBot, optStyle, optBump,
       $('optLivesMinus'), $('optLivesPlus'), $('optTarMinus'), $('optTarPlus')].forEach(el => { if (el) el.disabled = !idle; });
      optBtn.classList.toggle('on', m.preset === 'custom');
    }
  }

  /* ---- sons (WebAudio, zéro fichier) / musique ---- */
  function unlockAudio() {
    if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch {} }
    if (actx && actx.state === 'suspended') actx.resume();
  }
  function musicIntensity() {                          // 0..1 selon la vitesse de la balle la plus rapide (pilote le climax musical)
    if (buf.length < 2) return 0;
    const a = buf[buf.length - 2].s, b = buf[buf.length - 1].s;
    if (!a.balls.length || a.balls.length !== b.balls.length) return 0.3;
    let mx = 0;
    for (let i = 0; i < b.balls.length; i++) { const d = Math.hypot(b.balls[i].x - a.balls[i].x, b.balls[i].y - a.balls[i].y); if (d > mx) mx = d; }
    return Math.min(1, mx / 16);
  }
  const vol = () => (A && typeof A.sfx === 'number') ? A.sfx : 1;
  function out(node) { if (sndPan && actx.createStereoPanner) { const pn = actx.createStereoPanner(); pn.pan.value = Math.max(-1, Math.min(1, sndPan)); pn.connect(actx.destination); node.connect(pn); } else node.connect(actx.destination); }
  // f1 : glissando vers cette fréquence (bips de borne, « zap », « boing »)
  function tone(freq, dur, type = 'square', gain = 0.05, delay = 0, f1) {
    const v = vol(); if (!actx || v <= 0) return;
    const t0 = actx.currentTime + delay, o = actx.createOscillator(), g = actx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    g.gain.setValueAtTime(gain * v, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); out(g); o.start(t0); o.stop(t0 + dur + 0.02);
  }
  function noise(d, type, freq, g, dl = 0, q) {
    const v = vol(); if (!actx || v <= 0) return;
    if (!noiseBuf || noiseBuf.sampleRate !== actx.sampleRate) { const sr = actx.sampleRate, b = actx.createBuffer(1, Math.floor(sr * 1.2), sr), dd = b.getChannelData(0); for (let i = 0; i < dd.length; i++) dd[i] = Math.random() * 2 - 1; noiseBuf = b; }
    const t0 = actx.currentTime + dl, s = actx.createBufferSource(), f = actx.createBiquadFilter(), gg = actx.createGain();
    s.buffer = noiseBuf; f.type = type; f.frequency.value = freq; if (q) f.Q.value = q;
    gg.gain.setValueAtTime(0.0001, t0); gg.gain.exponentialRampToValueAtTime(g * v, t0 + Math.min(0.01, d * 0.2)); gg.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
    s.connect(f); f.connect(gg); out(gg); s.start(t0); s.stop(t0 + d + 0.02);
  }
  function sound(kind, arg) {
    if (!actx) return;
    if (kind === 'hit') { const k = arg || 0; tone(440 + 300 * k, 0.07, 'square', 0.035, 0, 520 + 380 * k); tone(880 + 600 * k, 0.045, 'triangle', 0.02); }   // bip qui monte avec la vitesse de l'échange
    else if (kind === 'death') {                                                                   // décharge du néon qui claque
      tone(340, 0.36, 'sawtooth', 0.055, 0, 55); noise(0.28, 'lowpass', 900, 0.12);
      if (arg) { tone(90, 0.6, 'sine', 0.12, 0, 36); for (let i = 0; i < 5; i++) noise(0.05, 'highpass', 3200 + i * 500, 0.07, 0.04 + i * 0.055); }   // élimination : le tube vole en éclats
    }
    else if (kind === 'shield') { tone(988, 0.1, 'triangle', 0.04); tone(1319, 0.1, 'triangle', 0.035, 0.035); tone(1760, 0.16, 'triangle', 0.03, 0.07); noise(0.14, 'bandpass', 3200, 0.05, 0, 3); }
    else if (kind === 'powerup') { tone(523, 0.07, 'square', 0.04); tone(659, 0.07, 'square', 0.04, 0.05); tone(784, 0.07, 'square', 0.04, 0.1); tone(1047, 0.16, 'square', 0.04, 0.15); tone(2093, 0.2, 'triangle', 0.015, 0.15); }
    else if (kind === 'bad') { tone(440, 0.3, 'sawtooth', 0.045, 0, 110); tone(233, 0.22, 'square', 0.03, 0.05); tone(247, 0.22, 'square', 0.03, 0.05); }   // buzzer d'erreur
    else if (kind === 'ghost') { tone(900, 0.28, 'sine', 0.035, 0, 280); tone(912, 0.28, 'sine', 0.03, 0.02, 300); }
    else if (kind === 'bump') { tone(720, 0.13, 'sine', 0.06, 0, 170); tone(1450, 0.035, 'triangle', 0.025); }   // « boing » de flipper
    else if (kind === 'wallboost') { tone(180, 0.12, 'sawtooth', 0.04, 0, 1250); tone(90, 0.07, 'square', 0.035); }   // relance : zap qui monte
    else if (kind === 'count') { tone(880, 0.09, 'square', 0.035); tone(1760, 0.05, 'triangle', 0.015); }
    else if (kind === 'go') { tone(523, 0.08, 'square', 0.04); tone(784, 0.08, 'square', 0.04, 0.06); tone(1047, 0.3, 'square', 0.04, 0.12); noise(0.3, 'highpass', 2500, 0.04, 0.1); }
    else if (kind === 'win') { tone(523, 0.18, 'triangle', 0.06); tone(659, 0.18, 'triangle', 0.06, 0.12); tone(784, 0.18, 'triangle', 0.06, 0.24); tone(1047, 0.4, 'square', 0.035, 0.36); }
  }

  /* ---- effets d'événements ---- */
  function edgeOf(side) { const p = snap && side >= 0 ? snap.players[side] : null; return p && p.edge >= 0 && snap.geo && snap.geo.edges ? snap.geo.edges[p.edge] : null; }
  function nearestEdge(x, y) {
    const E = snap && snap.geo && snap.geo.edges; if (!E) return -1;
    let bi = -1, bd = Infinity;
    for (let i = 0; i < E.length; i++) { const e = E[i], d = (x - e.ax) * e.nx + (y - e.ay) * e.ny; if (d < bd) { bd = d; bi = i; } }
    return bi;
  }
  const push = (arr, cap, o) => { if (arr.length >= cap) arr.shift(); arr.push(o); };
  function ring(x, y, r0, r1, life, col, lw, style, now, delay) { push(rings, CAP.rings, { x, y, r0, r1, life, col, lw, style: style || 0, born: now + (delay || 0) }); }
  function burst(x, y, n, ax, spread, sp0, sp1, col, col2, life, now) {    // gerbe d'étincelles (traits) autour de la direction ax
    for (let k = 0; k < n; k++) { const a = ax + (Math.random() - 0.5) * spread, sp = sp0 + Math.random() * (sp1 - sp0); push(sparks, CAP.sparks, { x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, born: now, life: life * (0.6 + Math.random() * 0.6), col: (k & 1) && col2 ? col2 : col, w: 1.4 + Math.random() }); }
  }
  function motes(x, y, n, sp0, sp1, col, life, r, now, grav) {            // points lumineux (poussière néon, feux d'artifice)
    for (let k = 0; k < n; k++) { const a = Math.random() * Math.PI * 2, sp = sp0 + Math.random() * (sp1 - sp0); push(dots, CAP.dots, { x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, born: now, life: life * (0.7 + Math.random() * 0.6), col, r: r * (0.6 + Math.random() * 0.7), g: grav || 0 }); }
  }
  function playFx(f) {
    if (!f) return;
    const now = performance.now();
    sndPan = f.x != null ? Math.max(-1, Math.min(1, (f.x / W - 0.5) * 1.6)) : 0;   // son positionné gauche/droite
    sound(f.type === 'powerup' ? (f.bad ? 'bad' : 'powerup') : f.type, f.type === 'hit' ? musicIntensity() : f.type === 'death' ? !!f.elim : undefined);
    sndPan = 0;
    if (A.reduceFx) return;
    if (f.x != null) {                                       // éclair sur le sol (dessiné sous les pièces, cf. drawLights)
      const k = lightK(), t = f.type;
      if (t === 'hit') flashes.ajouter(f.x, f.y, 70, colSeat(f.side), 260, 0.5 * k);
      else if (t === 'bump') flashes.ajouter(f.x, f.y, 64, '#b8c2ff', 300, 0.55 * k);
      else if (t === 'wallboost') flashes.ajouter(f.x, f.y, 78, '#ffb545', 340, 0.6 * k);
      else if (t === 'shield') flashes.ajouter(f.x, f.y, 70, '#7fd1ff', 380, 0.5 * k);
      else if (t === 'ghost') flashes.ajouter(f.x, f.y, 56, '#cbb3ff', 420, 0.35 * k);
      else if (t === 'powerup') flashes.ajouter(f.x, f.y, 60, f.bad ? '#ff5a5a' : (PU_COL[f.pu] || '#ffffff'), 420, 0.45 * k);
      else if (t === 'death') flashes.ajouter(f.x, f.y, f.elim ? 150 : 110, colSeat(f.side), f.elim ? 800 : 600, (f.elim ? 0.8 : 0.65) * k);
    }
    const e = f.side >= 0 ? edgeOf(f.side) : null, inA = e ? Math.atan2(e.ny, e.nx) : Math.random() * Math.PI * 2;
    ballPopUntil = now + 90;
    if (f.type === 'hit') {                                  // renvoi : flash du tube, onde, gerbe vers le terrain
      const col = colSeat(f.side); edgeFlash[f.side] = now;
      ring(f.x, f.y, 4, 24, 320, col, 2.5, 0, now);
      burst(f.x, f.y, 7, inA, 1.9, 2, 5.5, col, '#ffffff', 280, now);
      return;
    }
    if (f.type === 'ghost') {                                // la balle fantôme traverse : anneau en pointillés, volutes
      ring(f.x, f.y, 6, 32, 440, '#cbb3ff', 2, 1, now);
      motes(f.x, f.y, 9, 0.3, 1.1, '#cbb3ff', 800, 2.6, now);
      return;
    }
    if (f.type === 'powerup') {                              // le jeton éclate : onde à sa couleur, poussière, pictogramme qui s'envole
      const col = f.bad ? '#ff5a5a' : (PU_COL[f.pu] || '#ffffff');
      ring(f.x, f.y, 8, 40, 480, col, 3, f.bad ? 2 : 0, now);
      if (!f.bad) ring(f.x, f.y, 4, 26, 380, '#ffffff', 1.5, 0, now, 60);
      motes(f.x, f.y, 14, 0.8, 2.8, col, 520, 2.2, now);
      push(pops, CAP.pops, { x: f.x, y: f.y, t: f.pu, bad: !!f.bad, born: now });
      return;
    }
    if (f.type === 'bump') {                                 // bumper : flash du plot, étoile d'étincelles
      push(bumpHits, 24, { x: f.x, y: f.y, born: now });
      ring(f.x, f.y, 10, 34, 300, '#b8c2ff', 2.5, 0, now);
      burst(f.x, f.y, 6, 0, Math.PI * 2, 2, 4, '#b8c2ff', '#ffffff', 240, now);
      return;
    }
    if (f.type === 'wallboost') {                            // mur d'éliminé : relance ambrée, le mur s'illumine
      const ei = nearestEdge(f.x, f.y), we = ei >= 0 ? snap.geo.edges[ei] : null; if (ei >= 0) wallFlash[ei] = now;
      ring(f.x, f.y, 5, 30, 320, '#ffb545', 3, 0, now);
      burst(f.x, f.y, 9, we ? Math.atan2(we.ny, we.nx) : 0, 1.3, 3, 7, '#ffb545', '#fff1c9', 300, now);
      return;
    }
    if (f.type === 'shield') {                               // le bouclier encaisse : la barrière s'allume, onde hexagonale
      barrierFlash[f.side] = now;
      ring(f.x, f.y, 8, 44, 420, '#7fd1ff', 3, 3, now);
      burst(f.x, f.y, 8, inA, 2.2, 2, 5, '#7fd1ff', '#ffffff', 320, now);
      return;
    }
    if (f.type === 'death') {                                // vie perdue : le bord se fissure (éliminé : il vole en éclats)
      const col = colSeat(f.side), mine = f.side === mySeat;
      shakeMag = Math.max(shakeMag, f.elim ? (mine ? 12 : 7) : (mine ? 9 : 4.5));
      ring(f.x, f.y, 6, 66, 650, col, 5, 0, now); ring(f.x, f.y, 4, 40, 380, '#ffffff', 2, 0, now, 40);
      motes(f.x, f.y, 14, 0.6, 2.6, col, 600, 2.4, now);
      const pl = snap.players[f.side];
      if (e && pl) {
        const s = (f.x - e.ax) * e.tx + (f.y - e.ay) * e.ty;
        breaks.push({ ei: pl.edge, born: now, elim: !!f.elim, s, col, seed: Math.random() * 1000 }); if (breaks.length > 12) breaks.shift();
        const nSh = f.elim ? 26 : 10;
        for (let k = 0; k < nSh; k++) {                      // éclats de verre : ils partent dans le terrain en tournoyant
          const ss = f.elim ? Math.random() * e.len : s + (Math.random() - 0.5) * 34, sp = 0.6 + Math.random() * 2.4, tg = (Math.random() - 0.5) * 3;
          push(shards, CAP.shards, { x: e.ax + e.tx * ss + e.nx * 2, y: e.ay + e.ty * ss + e.ny * 2, vx: e.nx * sp + e.tx * tg, vy: e.ny * sp + e.ty * tg, a: Math.random() * 6.28, va: (Math.random() - 0.5) * 0.4, len: 3 + Math.random() * 5, born: now, life: 700 + Math.random() * 500, col: Math.random() < 0.3 ? '#ffffff' : col });
        }
        const u = W / 500, tx = f.x + e.nx * 44 * u, ty = f.y + e.ny * 44 * u;
        push(texts, CAP.texts, { x: tx, y: ty, born: now, txt: f.elim ? 'K.O.' : '−1', col, big: !!f.elim });
      }
    }
  }
  function addKill(by, victim) {
    const el = document.createElement('div'); el.className = 'kf';
    el.innerHTML = by >= 0
      ? `<span style="color:${colSeat(by)}">${nameOf(by)}</span> ⚡ <span style="color:${colSeat(victim)}">${nameOf(victim)}</span>`
      : `☠ <span style="color:${colSeat(victim)}">${nameOf(victim)}</span>`;
    const box = $('killfeed'); box.appendChild(el);
    while (box.children.length > 5) box.removeChild(box.firstChild);
    setTimeout(() => el.remove(), 3900);
  }
  function banner(text) {
    const b = $('banner');
    b.innerHTML = `<span class="bann">${text}</span>`;
    clearTimeout(bannerTimer); bannerTimer = setTimeout(() => { b.innerHTML = ''; }, 1300);
  }
  // Un power-up vient d'être ramassé : on le DIT, en plus de l'anneau et du son.
  // Un message par événement `fx` (donc par ramassage), jamais par frame.
  //   - effet global  → bande fine en haut du cadre, pour tout le monde. Un seul message,
  //                     même pour le ramasseur : inutile de le prévenir deux fois.
  //   - effet perso   → bandeau seulement chez le ramasseur ; les autres n'affichent rien.
  // Le texte vient toujours de PU_NAME (constantes du client), jamais du réseau.
  function msgPowerup(f) {
    const txt = PU_NAME[f.pu]; if (!txt) return;
    const ico = PU_GLYPH[f.pu] || '✦';
    if (PU_GLOBAL[f.pu]) msgGlobal(ico, txt, f.bad ? { bad: true } : { color: PU_COL[f.pu] || '#ffffff' });
    else if (mySeat >= 0 && f.side === mySeat) msgPerso(ico, txt, f.bad ? { bad: true } : null);
  }
  function detectBanners(prev, m) {
    if (!prev || m.gs !== 'play') return;
    if (m.sd && !prev.sd) { banner('MORT SUBITE'); return; }
    // (plus de bandeau « MULTI-BALLE ! » : le message de bonus « La balle se divise » l'annonce déjà — les deux
    //  apparaissaient en même temps, en double, et le bandeau central masquait le terrain)
    for (let i = 0; i < m.players.length; i++) {
      const p = m.players[i], q = prev.players[i];
      if (p.playing && p.alive && p.lives === 1 && q && q.lives > 1) { banner('DERNIÈRE VIE — ' + (p.name || ('P' + (i + 1)))); break; }
    }
  }
  // Journal de la manche : vies de chaque participant (courbe en escalier) + faits marquants pondérés, dont le
  // plus lourd devient la « meilleure action » de l'écran de fin. Lu uniquement à partir des `fx` et du snapshot.
  function journal(prev, m, now) {
    if (m.gs === 'play' && (prevGs === 'countdown' || !J.actif())) {   // manche qui démarre (ou arrivée en cours de manche)
      J.debut(now); rally = 0; bestRally = 0; lastHit = -1; saves1 = {}; lastKill = {};
    }
    if (!J.actif()) return;
    const P = m.players, pp = prev && prev.players;
    for (const f of (m.fx || [])) {
      if (!f) continue;
      if (f.type === 'hit' && f.side >= 0) {
        rally++; lastHit = f.side;
        const p = P[f.side];
        if (p && p.playing && p.lives === 1 && maxLives > 1) {           // sauvetages à une seule vie : comptés, annoncés par paliers
          const n = (saves1[f.side] || 0) + 1; saves1[f.side] = n;
          if (n === 3 || n === 6 || n === 10 || n === 15 || n === 25) J.moment(now, f.side, 'a renvoyé ' + n + ' balles avec une seule vie', 2 + n * 0.45);
        }
      } else if (f.type === 'shield' && f.side >= 0) J.moment(now, f.side, 'a été sauvé par son bouclier', 1.5);
      else if (f.type === 'death') {
        const by = f.by >= 0 && f.by !== f.side ? f.by : -1;
        if (rally >= 8 && rally > bestRally) {                           // plus long échange de la manche
          bestRally = rally; const who = by >= 0 ? by : lastHit;
          if (who >= 0 && who !== f.side) J.moment(now, who, 'a conclu un échange de ' + rally + ' renvois', Math.min(7, 1 + rally * 0.3));
        }
        rally = 0;
        if (f.elim && by >= 0) {
          const q = P[by], seul = !!(q && q.lives === 1 && maxLives > 1), dbl = lastKill[by] && now - lastKill[by] < 4000;
          lastKill[by] = now;
          if (dbl) J.moment(now, by, 'double élimination (dont ' + nameOf(f.side) + ')', 10);
          else J.moment(now, by, 'a éliminé ' + nameOf(f.side) + (seul ? ' avec une seule vie' : ''), seul ? 8 : 6);
        }
      }
    }
    const vals = {}; let chg = false;
    for (let i = 0; i < P.length; i++) {
      const p = P[i]; if (!p || !p.playing) continue;
      vals[i] = Math.max(0, p.lives);
      const q = pp && pp[i]; if (q && q.lives !== p.lives) chg = true;   // une vie tombe : échantillon immédiat (marche nette)
    }
    J.echantillon(now, vals, chg);
    if (m.gs === 'over') {
      const nP = P.filter(p => p && p.playing).length;
      if (nP > 1 && maxLives > 1) for (const p of P) if (p && p.playing && p.alive && p.lives >= maxLives) J.moment(now, p.seat, 'a gagné sans perdre une seule vie', 9);
      J.echantillon(now, vals, true); J.fin();
    }
  }

  function computeView(now) {
    if (buf.length === 0) return null;
    const target = now - INTERP_MS;
    let a = buf[0], b = buf[buf.length - 1];
    for (let i = 0; i < buf.length; i++) if (buf[i].t <= target) a = buf[i];
    for (let i = buf.length - 1; i >= 0; i--) if (buf[i].t >= target) b = buf[i];
    const sa = a.s, sb = b.s, span = b.t - a.t;
    let al = span > 0 ? (target - a.t) / span : 0; al = al < 0 ? 0 : al > 1 ? 1 : al;
    let balls;
    const spd = bb => Math.hypot(bb.vx || 0, bb.vy || 0);   // vitesse (unités/tick) : longueur et chaleur de la comète
    if (sa.balls.length === sb.balls.length)
      balls = sa.balls.map((ba, i) => { const bb = sb.balls[i];
        if (Math.hypot(bb.x - ba.x, bb.y - ba.y) > 60) return { x: bb.x, y: bb.y, o: bb.o, gh: bb.gh, iv: bb.iv, sp: spd(bb) };
        return { x: ba.x + (bb.x - ba.x) * al, y: ba.y + (bb.y - ba.y) * al, o: bb.o, gh: bb.gh, iv: bb.iv, sp: spd(bb) }; });
    else balls = sb.balls.map(b => ({ x: b.x, y: b.y, o: b.o, gh: b.gh, iv: b.iv, sp: spd(b) }));
    const pos = {};
    sb.players.forEach((pb, i) => { const pa = sa.players[i]; pos[i] = (pa && pa.edge === pb.edge) ? pa.pos + (pb.pos - pa.pos) * al : pb.pos; });
    return { balls, pos };
  }
  const pt = (e, s, d) => [e.ax + e.tx * s + e.nx * d, e.ay + e.ty * s + e.ny * d];

  /* ---- recadrage du terrain ----------------------------------------------------------------
     Le serveur bâtit un polygone RÉGULIER INSCRIT dans un cercle : sur un carré (duel, ou 4
     joueurs) le terrain ne mesure que R√2, soit 66 % du canvas — le tiers restant n'était que
     du fond étoilé. On recadre donc le polygone sur le canvas, marges réduites au minimum :
     les bandeaux de bonus (public/gamemsg.js) passent brièvement par-dessus le bord haut.
     ⚠ On FIGE le recadrage pendant la manche : la mort subite rétrécit le terrain, un recadrage
     permanent compenserait pile ce rétrécissement et on ne le verrait plus du tout. */
  const FIT_ID = { s: 1, tx: 0, ty: 0 };
  let fitCache = null, fitSig = '';
  function geoFit(geo, gs) {
    if (!geo || !geo.edges || !geo.edges.length) { fitCache = null; fitSig = ''; return FIT_ID; }
    const sig = '' + geo.edges.length;
    const fige = gs === 'play' || gs === 'paused' || gs === 'over';
    if (fitCache && fitSig === sig && fige) return fitCache;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const e of geo.edges) {
      if (e.ax < x0) x0 = e.ax; if (e.ax > x1) x1 = e.ax;
      if (e.bx < x0) x0 = e.bx; if (e.bx > x1) x1 = e.bx;
      if (e.ay < y0) y0 = e.ay; if (e.ay > y1) y1 = e.ay;
      if (e.by < y0) y0 = e.by; if (e.by > y1) y1 = e.by;
    }
    const bw = x1 - x0, bh = y1 - y0;
    if (!(bw > 1 && bh > 1)) return FIT_ID;
    const MT = 8, M = 6;                         // terrain au plus près des bords (demande : toute la hauteur de l'écran)
    const s = Math.min((W - M * 2) / bw, (H - MT - M) / bh);
    const res = { s, tx: M + (W - M * 2 - bw * s) / 2 - x0 * s, ty: MT + (H - MT - M - bh * s) / 2 - y0 * s, x0, y0, bw, bh };   // + boîte du terrain : cadre du sol pré-rendu
    fitSig = sig; fitCache = res;
    return res;
  }

  // ───────────────────────── décors pré-rendus ─────────────────────────
  // 1) ciel du pourtour (repère du canvas) : dégradé, nébuleuses, étoiles fixes — + une couche d'étoiles qui défile
  let bgCv = null, starCv = null, bgKey = '';
  function ensureBg() {
    const key = cv.width + '|' + W + '|' + H + '|' + TH.key + '|' + (A.contrast ? 1 : 0);
    if (bgCv && key === bgKey) return; bgKey = key;
    const pw = Math.min(cv.width, TEX_MAX), k = pw / W, rnd = rng(0x9e37 + W);
    bgCv = mkCanvas(pw, H * k); starCv = mkCanvas(pw, H * k);
    const g = bgCv.getContext('2d'); g.setTransform(k, 0, 0, k, 0, 0);
    const lg = g.createLinearGradient(0, 0, 0, H); lg.addColorStop(0, TH.bg2); lg.addColorStop(1, TH.bg); g.fillStyle = lg; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 4; i++) {                                       // nébuleuses
      const x = rnd() * W, y = rnd() * H, r = W * (0.22 + rnd() * 0.3), c = TH.neb[i % TH.neb.length], rg = g.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, rgba(c, TH.add ? 0.11 : 0.16)); rg.addColorStop(1, rgba(c, 0)); g.fillStyle = rg; g.fillRect(0, 0, W, H);
    }
    for (let i = 0; i < 130; i++) { const s = 0.5 + rnd() * 1.3; g.fillStyle = rgba(TH.star, (TH.add ? 0.12 : 0.1) + rnd() * (TH.add ? 0.5 : 0.25)); g.fillRect(rnd() * W, rnd() * H, s, s); }
    g.strokeStyle = rgba(TH.star, TH.add ? 0.5 : 0.3); g.lineWidth = 0.7; g.beginPath();   // quelques étoiles à aigrettes
    for (let i = 0; i < 7; i++) { const x = rnd() * W, y = rnd() * H, l = 2 + rnd() * 3; g.moveTo(x - l, y); g.lineTo(x + l, y); g.moveTo(x, y - l); g.lineTo(x, y + l); }
    g.stroke();
    const vg = g.createRadialGradient(W / 2, H / 2, W * 0.3, W / 2, H / 2, W * 0.78); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, TH.add ? 'rgba(0,0,0,0.5)' : 'rgba(80,90,140,0.18)');
    g.fillStyle = vg; g.fillRect(0, 0, W, H);
    const s2 = starCv.getContext('2d'); s2.setTransform(k, 0, 0, k, 0, 0);
    for (let i = 0; i < 46; i++) { const r = 0.5 + rnd() * 1.1; s2.fillStyle = rgba(TH.star, (TH.add ? 0.18 : 0.12) + rnd() * 0.3); s2.beginPath(); s2.arc(rnd() * W, rnd() * H, r, 0, Math.PI * 2); s2.fill(); }
  }
  function drawBackground(now) {
    ensureBg();
    ctx.drawImage(bgCv, 0, 0, W, H);
    if (A.reduceFx) return;
    const off = (now / 1000 * 7) % H;                                     // défilement lent (≈ l'ancien champ d'étoiles)
    ctx.drawImage(starCv, 0, off - H, W, H); ctx.drawImage(starCv, 0, off, W, H);
    ctx.globalCompositeOperation = ADD();
    for (const s of AMB_STARS) glow(TH.star, s.x * W, s.y * H, s.r * 4, (TH.add ? 0.35 : 0.2) * (0.5 + 0.5 * Math.sin(now / s.sp + s.ph)));
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  }

  // 2) sol du terrain (repère du TERRAIN, sur la boîte figée par geoFit) : pris dans le polygone à chaque image
  //    par un clip — le rétrécissement de mort subite découvre donc le sol sans jamais le redessiner.
  let fieldCv = null, fglowCv = null, fieldKey = '', fbox = null;
  function ensureField(E, fit) {
    const x0 = fit.x0 != null ? fit.x0 : 0, y0 = fit.y0 != null ? fit.y0 : 0, bw = fit.bw != null ? fit.bw : W, bh = fit.bh != null ? fit.bh : H;
    const key = cv.width + '|' + W + '|' + TH.key + '|' + (A.contrast ? 1 : 0) + '|' + E.length + '|' + fit.s.toFixed(3) + '|' + Math.round(x0) + '|' + Math.round(y0);
    if (fieldCv && key === fieldKey) return; fieldKey = key;
    const m = 6, bx = x0 - m, by = y0 - m, fw = bw + m * 2, fh = bh + m * 2;
    let dpu = cv.width / W * fit.s; const big = Math.max(fw, fh) * dpu; if (big > TEX_MAX) dpu *= TEX_MAX / big;
    fbox = { x: bx, y: by, w: fw, h: fh };
    fieldCv = mkCanvas(fw * dpu, fh * dpu); fglowCv = mkCanvas(fw * dpu / 2, fh * dpu / 2);
    const g = fieldCv.getContext('2d'), rnd = rng(0x51ed + E.length * 97), cx = W / 2, cy = H / 2, R = Math.max(bw, bh) * 0.62, u = W / 500;
    g.setTransform(dpu, 0, 0, dpu, -bx * dpu, -by * dpu);
    const rg = g.createRadialGradient(cx, cy, 0, cx, cy, R); rg.addColorStop(0, TH.field2); rg.addColorStop(1, TH.field); g.fillStyle = rg; g.fillRect(bx, by, fw, fh);
    const hz = g.createRadialGradient(cx, cy, 0, cx, cy, R * 0.7); hz.addColorStop(0, rgba(TH.A, TH.add ? 0.08 : 0.06)); hz.addColorStop(1, rgba(TH.A, 0));   // lueur centrale (soleil couché dans le sol)
    g.fillStyle = hz; g.fillRect(bx, by, fw, fh);
    for (let i = 0; i < 1800; i++) { g.fillStyle = rnd() < 0.5 ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.05)'; g.fillRect(bx + rnd() * fw, by + rnd() * fh, 1.2, 1.2); }   // grain
    const gridA = A.contrast ? 0.6 : 1;                                  // contraste renforcé : décor plus discret, le jeu ressort
    const lines = (step, off) => { g.beginPath(); for (let x = cx + off - Math.ceil((cx - bx) / step) * step; x <= bx + fw; x += step) { g.moveTo(x, by); g.lineTo(x, by + fh); } for (let y = cy + off - Math.ceil((cy - by) / step) * step; y <= by + fh; y += step) { g.moveTo(bx, y); g.lineTo(bx + fw, y); } };
    g.globalAlpha = gridA; g.strokeStyle = TH.minor; g.lineWidth = 1; lines(25 * u, 0); g.stroke();
    g.shadowColor = TH.hot; g.shadowBlur = TH.add ? 6 : 0;               // pré-rendu : le flou n'est payé qu'une fois
    g.strokeStyle = TH.major; g.lineWidth = 1.4; lines(100 * u, 0); g.stroke(); g.shadowBlur = 0;
    g.setLineDash([4, 7]); g.strokeStyle = TH.spoke; g.lineWidth = 1; g.beginPath();   // rayons du centre vers chaque sommet
    for (const e of E) { g.moveTo(cx, cy); g.lineTo(e.ax, e.ay); } g.stroke(); g.setLineDash(NO_DASH);
    const emb = (gg, a) => {                                             // emblème central : cibles concentriques, graduations
      gg.lineWidth = 1.5; gg.strokeStyle = rgba(TH.A, 0.34 * a); gg.beginPath(); gg.arc(cx, cy, 46 * u, 0, Math.PI * 2); gg.stroke();
      gg.strokeStyle = rgba(TH.B, 0.26 * a); gg.beginPath(); gg.arc(cx, cy, 28 * u, 0, Math.PI * 2); gg.stroke();
      gg.beginPath(); for (let i = 0; i < 24; i++) { const t = i / 24 * Math.PI * 2, r1 = (i % 6 ? 50 : 54) * u; gg.moveTo(cx + Math.cos(t) * 47.5 * u, cy + Math.sin(t) * 47.5 * u); gg.lineTo(cx + Math.cos(t) * r1, cy + Math.sin(t) * r1); }
      gg.strokeStyle = rgba(TH.A, 0.3 * a); gg.stroke();
    };
    emb(g, gridA);
    g.globalAlpha = 1;
    const vg = g.createRadialGradient(cx, cy, R * 0.35, cx, cy, R * 1.08); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, TH.vig);
    g.fillStyle = vg; g.fillRect(bx, by, fw, fh);
    if (TH.key === 'crt') { g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = 'rgba(0,0,0,0.16)'; for (let y = 0; y < fieldCv.height; y += 3) g.fillRect(0, y, fieldCv.width, 1); }   // balayage phosphore
    // lueur des lignes majeures (demi-résolution) : c'est elle qui pulse sur le tempo
    const q = fglowCv.getContext('2d'); q.setTransform(dpu / 2, 0, 0, dpu / 2, -bx * dpu / 2, -by * dpu / 2);
    q.shadowColor = TH.hot; q.shadowBlur = 4; q.strokeStyle = rgba(TH.hot, TH.add ? 0.9 : 0.5); q.lineWidth = 2.2;
    const L2 = (step) => { q.beginPath(); for (let x = cx - Math.ceil((cx - bx) / step) * step; x <= bx + fw; x += step) { q.moveTo(x, by); q.lineTo(x, by + fh); } for (let y = cy - Math.ceil((cy - by) / step) * step; y <= by + fh; y += step) { q.moveTo(bx, y); q.lineTo(bx + fw, y); } };
    L2(100 * u); q.stroke(); emb(q, 2.2);
  }

  // 3) sprites cachés : lueurs, jetons de bonus, bumpers, nœuds de coin, vignettes colorées
  let sprites = {}, spriteN = 0, scanPat = null;
  function sprite(key, w, h, fn) {
    let s = sprites[key]; if (s) return s;
    if (++spriteN > 90) { sprites = {}; spriteN = 1; }
    s = mkCanvas(w, h); fn(s.getContext('2d'), s.width, s.height); sprites[key] = s; return s;
  }
  function glowSprite(col) {
    return sprite('g' + col, 64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, rgba(col, 1)); gr.addColorStop(0.22, rgba(col, 0.55)); gr.addColorStop(0.6, rgba(col, 0.13)); gr.addColorStop(1, rgba(col, 0)); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); });
  }
  function glow(col, x, y, r, a) { if (!(a > 0.004) || !(r > 0)) return; ctx.globalAlpha = Math.min(1, a); ctx.drawImage(glowSprite(col), x - r, y - r, r * 2, r * 2); }
  function edgeVig(col) {                                                // vignette colorée (chaleur, alarme, gel)
    return sprite('v' + col, 128, 128, (g) => { const gr = g.createRadialGradient(64, 64, 26, 64, 64, 64); gr.addColorStop(0, rgba(col, 0)); gr.addColorStop(0.7, rgba(col, 0.35)); gr.addColorStop(1, rgba(col, 0.9)); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); });
  }
  const PXU = () => Math.max(1, Math.min(5, Math.ceil(cv.width / W * ((fitCache && fitCache.s) || 1))));   // px par unité monde (résolution des sprites)
  function tokenSprite(t, bad) {                                         // jeton de bonus : halo, disque, anneau néon, pictogramme
    const px = PXU(), R = PU_R + 7, S = R * 2 * px, col = bad ? '#ff5a5a' : (PU_COL[t] || '#ffffff');
    return sprite('t' + t + (bad ? 1 : 0) + px, S, S, (g) => {
      g.setTransform(px, 0, 0, px, R * px, R * px);
      if (TH.add) { const gr = g.createRadialGradient(0, 0, PU_R * 0.6, 0, 0, R); gr.addColorStop(0, rgba(col, 0.42)); gr.addColorStop(1, rgba(col, 0)); g.fillStyle = gr; g.fillRect(-R, -R, R * 2, R * 2); }
      if (bad) { g.fillStyle = col; g.beginPath(); for (let i = 0; i < 20; i++) { const a = i / 20 * Math.PI * 2, r = i % 2 ? PU_R + 0.5 : PU_R + 4.5; i ? g.lineTo(Math.cos(a) * r, Math.sin(a) * r) : g.moveTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); g.fill(); }   // malus : couronne de pointes
      g.fillStyle = TH.token; g.globalAlpha = 0.94; g.beginPath(); g.arc(0, 0, PU_R, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1;
      g.strokeStyle = col; g.lineWidth = 2.2; g.beginPath(); g.arc(0, 0, PU_R - 1.1, 0, Math.PI * 2); g.stroke();
      g.strokeStyle = rgba(col, 0.35); g.lineWidth = 1; g.beginPath(); g.arc(0, 0, PU_R - 4, 0, Math.PI * 2); g.stroke();
      if (A.contrast) { g.strokeStyle = TH.add ? '#ffffff' : '#111111'; g.lineWidth = 1.4; g.beginPath(); g.arc(0, 0, PU_R + (bad ? 5.2 : 0.8), 0, Math.PI * 2); g.stroke(); }
      g.save(); g.scale(0.92, 0.92);
      g.strokeStyle = col; g.fillStyle = col; g.lineWidth = 1.9; picto(g, t, false);
      if (TH.add) { g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 0.7; picto(g, t, true); }
      g.restore();
    });
  }
  function bumperSprite(r, blocker) {
    const px = PXU(), R = r * 1.75, S = R * 2 * px;
    return sprite('b' + r + (blocker ? 1 : 0) + px, S, S, (g) => {
      g.setTransform(px, 0, 0, px, R * px, R * px);
      const col = blocker ? '#c9a06a' : '#b8c2ff';
      if (TH.add || !blocker) { const gr = g.createRadialGradient(0, 0, r * 0.8, 0, 0, R); gr.addColorStop(0, rgba(col, TH.add ? 0.45 : 0.25)); gr.addColorStop(1, rgba(col, 0)); g.fillStyle = gr; g.fillRect(-R, -R, R * 2, R * 2); }
      if (blocker) {                                                     // plot bloqueur : bloc hexagonal en briques, liseré ambré
        const hex = rr => { g.beginPath(); for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + Math.PI / 6; i ? g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : g.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); } g.closePath(); };
        const lg = g.createLinearGradient(0, -r, 0, r); lg.addColorStop(0, '#8a6036'); lg.addColorStop(1, '#4a3018');
        hex(r); g.fillStyle = lg; g.fill();
        g.save(); hex(r - 1); g.clip(); g.strokeStyle = 'rgba(20,10,4,0.55)'; g.lineWidth = 1; g.beginPath();
        for (let y = -r; y <= r; y += r / 2.5) { g.moveTo(-r, y); g.lineTo(r, y); }
        for (let row = 0, y = -r; y < r; y += r / 2.5, row++) for (let x = -r + (row % 2) * r / 3; x < r; x += r / 1.5) { g.moveTo(x, y); g.lineTo(x, y + r / 2.5); }
        g.stroke(); g.fillStyle = 'rgba(255,220,160,0.12)'; g.fillRect(-r, -r, r * 2, r * 0.5); g.restore();
        hex(r); g.strokeStyle = '#ffcf7a'; g.lineWidth = 2.2; g.stroke();
        hex(r - 3.2); g.strokeStyle = 'rgba(255,207,122,0.4)'; g.lineWidth = 1; g.stroke();
      } else {                                                           // bumper de flipper : disque sombre, anneaux, chapeau chromé
        g.fillStyle = TH.token; g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fill();
        g.strokeStyle = col; g.lineWidth = 3; g.beginPath(); g.arc(0, 0, r - 1.5, 0, Math.PI * 2); g.stroke();
        g.strokeStyle = rgba(col, 0.45); g.lineWidth = 1; g.beginPath(); g.arc(0, 0, r * 0.66, 0, Math.PI * 2); g.stroke();
        const cg = g.createRadialGradient(-r * 0.15, -r * 0.18, 0, 0, 0, r * 0.44); cg.addColorStop(0, '#ffffff'); cg.addColorStop(0.5, col); cg.addColorStop(1, shade(col, -0.5));
        g.fillStyle = cg; g.beginPath(); g.arc(0, 0, r * 0.44, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#ffffff'; g.beginPath(); for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2, rr = i % 2 ? r * 0.1 : r * 0.26; i ? g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : g.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); } g.closePath(); g.fill();   // étoile du chapeau
      }
      if (A.contrast) { g.strokeStyle = TH.add ? '#ffffff' : '#111111'; g.lineWidth = 1.4; g.beginPath(); g.arc(0, 0, r + 1.5, 0, Math.PI * 2); g.stroke(); }
    });
  }
  function nodeSprite() {                                                // borne de coin du terrain
    const px = PXU(), R = 9, S = R * 2 * px;
    return sprite('n' + px, S, S, (g) => {
      g.setTransform(px, 0, 0, px, R * px, R * px);
      if (TH.add) { const gr = g.createRadialGradient(0, 0, 2, 0, 0, R); gr.addColorStop(0, rgba(TH.node, 0.5)); gr.addColorStop(1, rgba(TH.node, 0)); g.fillStyle = gr; g.fillRect(-R, -R, R * 2, R * 2); }
      g.fillStyle = TH.token; g.beginPath(); g.arc(0, 0, 4.4, 0, Math.PI * 2); g.fill();
      g.strokeStyle = TH.node; g.lineWidth = 1.6; g.stroke();
      g.fillStyle = TH.add ? '#ffffff' : TH.node; g.beginPath(); g.arc(0, 0, 1.5, 0, Math.PI * 2); g.fill();
    });
  }

  // 4) scène titre (repère virtuel 500 × 500) : ciel, étoiles, soleil rayé, montagnes néon, horizon, sol
  const HY = 262;                                                        // ligne d'horizon de la scène titre
  let lobbyCv = null, lobbyKey = '';
  function ensureLobby() {
    const key = cv.width + '|' + TH.key + '|' + (A.contrast ? 1 : 0);
    if (lobbyCv && key === lobbyKey) return; lobbyKey = key;
    const pw = Math.min(cv.width, TEX_MAX), k = pw / 500, rnd = rng(0x70f6);
    lobbyCv = mkCanvas(pw, pw); const g = lobbyCv.getContext('2d'); g.setTransform(k, 0, 0, k, 0, 0);
    const sk = g.createLinearGradient(0, 0, 0, HY); sk.addColorStop(0, TH.sky[0]); sk.addColorStop(0.55, TH.sky[1]); sk.addColorStop(0.86, TH.sky[2]); sk.addColorStop(1, TH.sky[3]);
    g.fillStyle = sk; g.fillRect(0, 0, 500, HY);
    if (TH.add) for (let i = 0; i < 90; i++) { const s = 0.5 + rnd() * 1.3; g.fillStyle = rgba(TH.star, 0.15 + rnd() * 0.6); g.fillRect(rnd() * 500, rnd() * HY * 0.78, s, s); }
    const scx = 250, scy = HY - 30, SR = 112;                            // soleil : halo, disque dégradé, rayures découpées
    const hg = g.createRadialGradient(scx, scy, SR * 0.6, scx, scy, SR * 1.9); hg.addColorStop(0, rgba(TH.sun[2], TH.add ? 0.4 : 0.35)); hg.addColorStop(1, rgba(TH.sun[2], 0));
    g.fillStyle = hg; g.fillRect(0, 0, 500, HY);
    const sun = mkCanvas(SR * 2 * k, SR * 2 * k), sg = sun.getContext('2d'); sg.setTransform(k, 0, 0, k, SR * k, SR * k);
    const sgr = sg.createLinearGradient(0, -SR, 0, SR); sgr.addColorStop(0, TH.sun[0]); sgr.addColorStop(0.4, TH.sun[1]); sgr.addColorStop(0.7, TH.sun[2]); sgr.addColorStop(1, TH.sun[3]);
    sg.fillStyle = sgr; sg.beginPath(); sg.arc(0, 0, SR, 0, Math.PI * 2); sg.fill();
    sg.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 8; i++) { const y = 2 + i * 12.5 + i * i * 0.6, h = 1.6 + i * 1.25; sg.fillRect(-SR, y, SR * 2, h); }
    g.drawImage(sun, scx - SR, scy - SR, SR * 2, SR * 2);
    const ridge = (base, amp, seed, col, lineA) => {                     // chaîne de montagnes (deux plans)
      const r2 = rng(seed), pts = []; let x = -10;
      while (x < 520) { pts.push(x, base - amp * (0.25 + r2() * 0.75)); x += 18 + r2() * 34; pts.push(x, base - amp * r2() * 0.3); x += 14 + r2() * 26; }
      g.beginPath(); g.moveTo(-10, HY + 1); for (let i = 0; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); g.lineTo(520, HY + 1); g.closePath();
      g.fillStyle = col; g.fill();
      g.beginPath(); g.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
      g.shadowColor = TH.ridge; g.shadowBlur = TH.add ? 8 : 0; g.strokeStyle = rgba(TH.ridge, lineA); g.lineWidth = 1.3; g.lineJoin = 'round'; g.stroke(); g.shadowBlur = 0;
    };
    ridge(HY, 56, 0xa11, TH.mount[0], 0.45); ridge(HY, 34, 0xb22, TH.mount[1], 0.8);
    const fl = g.createLinearGradient(0, HY, 0, 500); fl.addColorStop(0, TH.floor[0]); fl.addColorStop(1, TH.floor[1]);
    g.fillStyle = fl; g.fillRect(0, HY, 500, 500 - HY);
    g.shadowColor = TH.ridge; g.shadowBlur = TH.add ? 14 : 0; g.fillStyle = TH.add ? rgba(TH.ridge, 0.95) : rgba(TH.A, 0.7); g.fillRect(0, HY - 0.8, 500, 1.8); g.shadowBlur = 0;   // horizon
    const vg = g.createRadialGradient(250, 260, 180, 250, 260, 380); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, TH.add ? 'rgba(0,0,0,0.45)' : 'rgba(90,80,150,0.18)');
    g.fillStyle = vg; g.fillRect(0, 0, 500, 500);
  }
  // logo « PONG » : lettres chromées + contour néon ; halo pré-rendu À PART (il respire en alpha, sans shadowBlur par image)
  let logoCv = null, logoGlow = null, logoKey = '', logoW = 0;
  function ensureLogo(fs) {
    let ok = false; try { ok = !!(document.fonts && document.fonts.check && document.fonts.check(DISP(20))); } catch (e) { ok = false; }   // police chargée → on refait le sprite une fois
    const key = cv.width + '|' + TH.key + '|' + fs + '|' + (ok ? 1 : 0);
    if (logoCv && key === logoKey) return; logoKey = key;
    const k = Math.min(cv.width, TEX_MAX) / 500, m = ctx; m.save(); m.font = DISP(fs); logoW = m.measureText('PONG').width; m.restore();
    const w = logoW + fs * 1.2, h = fs * 2.1;
    const mk = () => { const c = mkCanvas(w * k, h * k), g = c.getContext('2d'); g.setTransform(k, 0, 0, k, w / 2 * k, h / 2 * k); g.font = DISP(fs); g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round'; return [c, g]; };
    let g; [logoGlow, g] = mk();
    g.shadowColor = TH.A; g.shadowBlur = 18; g.strokeStyle = TH.A; g.lineWidth = Math.max(3, fs * 0.1); g.strokeText('PONG', 0, 0); g.strokeText('PONG', 0, 0);
    g.shadowColor = TH.B; g.shadowBlur = 26; g.lineWidth = 2; g.strokeStyle = rgba(TH.B, 0.6); g.strokeText('PONG', 0, 0);
    [logoCv, g] = mk();
    g.strokeStyle = TH.add ? '#12051f' : '#ffffff'; g.lineWidth = Math.max(3, fs * 0.13); g.strokeText('PONG', 0, 0);
    g.strokeStyle = TH.A; g.lineWidth = Math.max(1.5, fs * 0.05); g.strokeText('PONG', 0, 0);
    const cg = g.createLinearGradient(0, -fs * 0.42, 0, fs * 0.42), C = TH.chrome;
    cg.addColorStop(0, C[0]); cg.addColorStop(0.46, C[1]); cg.addColorStop(0.5, C[2]); cg.addColorStop(0.56, C[3]); cg.addColorStop(1, C[4]);
    g.fillStyle = cg; g.fillText('PONG', 0, 0);
    g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 0.8; g.strokeText('PONG', 0, 0);
    logoCv._w = w; logoCv._h = h;
  }

  /* ---- dessin : terrain ---- */
  function beat(now) {                                                   // 1 → 0 à chaque noire (tempo de la musique)
    const bpm = MUSIC_THEME.bpm + (curInten >= 2 ? MUSIC_THEME.bpmBoost : 0), ph = (now / 60000 * bpm) % 1;
    return (1 - ph) * (1 - ph) * (1 - ph);
  }
  function polyPath(E) { ctx.beginPath(); for (let i = 0; i < E.length; i++) { const e = E[i]; i ? ctx.lineTo(e.ax, e.ay) : ctx.moveTo(e.ax, e.ay); } ctx.closePath(); }
  function seg(x1, y1, x2, y2) { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }
  // tube néon le long d'un segment : halo (2 traits larges translucides, additifs), tube, cœur clair
  function tube(ax, ay, bx, by, col, w, glowA, coreA) {
    if (glowA > 0 && !A.reduceFx) {
      ctx.globalCompositeOperation = ADD(); ctx.strokeStyle = col;
      ctx.globalAlpha = Math.min(1, glowA * 0.2); ctx.lineWidth = w * 4.4; seg(ax, ay, bx, by);
      ctx.globalAlpha = Math.min(1, glowA * 0.42); ctx.lineWidth = w * 2.2; seg(ax, ay, bx, by);
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.globalAlpha = 1; ctx.strokeStyle = col; ctx.lineWidth = w; seg(ax, ay, bx, by);
    if (coreA > 0) { ctx.globalAlpha = coreA; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = Math.max(0.8, w * 0.34); seg(ax, ay, bx, by); ctx.globalAlpha = 1; }
  }
  function drawField(E, fit, now) {
    ensureField(E, fit);
    ctx.save(); polyPath(E); ctx.clip();
    ctx.drawImage(fieldCv, fbox.x, fbox.y, fbox.w, fbox.h);
    const gs = snap.gs;
    if (!A.reduceFx) {                                                   // la grille pulse sur la musique (plus fort en jeu)
      const b = beat(now), a = (gs === 'play' ? 0.1 + 0.5 * b : 0.08 + 0.14 * b) * (A.music ? 1 : 0.45) * (A.contrast ? 0.6 : 1);
      ctx.globalCompositeOperation = ADD(); ctx.globalAlpha = TH.add ? a : a * 0.6; ctx.drawImage(fglowCv, fbox.x, fbox.y, fbox.w, fbox.h);
      if (gs === 'play') { const heat = musicIntensity(); if (heat > 0.15) { ctx.globalAlpha = 0.42 * heat; ctx.drawImage(edgeVig('#ff5a28'), fbox.x, fbox.y, fbox.w, fbox.h); } }   // le terrain « chauffe » avec la vitesse des échanges
      ctx.globalCompositeOperation = 'source-over';
    }
    if (snap.sd && gs === 'play') { ctx.globalAlpha = A.reduceFx ? 0.3 : 0.24 + 0.2 * Math.sin(now / 160); ctx.drawImage(edgeVig('#ff2850'), fbox.x, fbox.y, fbox.w, fbox.h); }   // mort subite : alarme rouge
    if (snap.slow) { ctx.globalAlpha = 1; ctx.fillStyle = 'rgba(120,200,255,' + (A.reduceFx ? 0.06 : 0.09) + ')'; ctx.fillRect(fbox.x, fbox.y, fbox.w, fbox.h); ctx.globalAlpha = 0.5; ctx.drawImage(edgeVig('#96dcff'), fbox.x, fbox.y, fbox.w, fbox.h); }   // ralenti : givre
    ctx.globalAlpha = 1; ctx.restore();
    // mort subite « rétrécit » : zone déjà perdue assombrie + fantôme du terrain d'origine
    if (geo0 && geo0.length === E.length * 2 && Math.hypot(E[0].ax - geo0[0], E[0].ay - geo0[1]) > 1.5) {
      ctx.beginPath(); ctx.moveTo(geo0[0], geo0[1]); for (let i = 2; i < geo0.length; i += 2) ctx.lineTo(geo0[i], geo0[i + 1]); ctx.closePath();
      for (let i = E.length - 1; i >= 0; i--) { const e = E[i]; i === E.length - 1 ? ctx.moveTo(e.ax, e.ay) : ctx.lineTo(e.ax, e.ay); } ctx.closePath();
      ctx.fillStyle = TH.add ? 'rgba(0,0,0,0.42)' : 'rgba(60,60,100,0.16)'; ctx.fill('evenodd');
      ctx.beginPath(); ctx.moveTo(geo0[0], geo0[1]); for (let i = 2; i < geo0.length; i += 2) ctx.lineTo(geo0[i], geo0[i + 1]); ctx.closePath();
      ctx.setLineDash(DASH_BAR); ctx.strokeStyle = rgba('#ff4f6a', 0.45); ctx.lineWidth = 1.5; ctx.stroke(); ctx.setLineDash(NO_DASH);
    }
  }
  function drawEdges(E, now, vballs) {
    const u = W / 500;
    ctx.lineCap = 'round';
    for (let i = 0; i < E.length; i++) {
      const e = E[i], q = e.owner >= 0 ? snap.players[e.owner] : null;
      const vivant = !!(q && (!q.playing || q.alive)), mort = !!(q && q.playing && !q.alive), boost = mort && !!snap.wallBoost;
      if (!q || (mort && !boost)) {                                       // mur (ou bord d'un éliminé, sans relance) : tube de structure
        tube(e.ax, e.ay, e.bx, e.by, TH.wall, A.contrast ? 3.6 : 3, 0.7, TH.add ? 0.5 : 0.35);
        if (mort) {                                                       // cicatrices du bord brisé, à la couleur de l'ancien propriétaire
          const col = colSeat(e.owner); ctx.globalAlpha = 0.5; ctx.strokeStyle = col; ctx.lineWidth = 1.2; ctx.beginPath();
          for (let c = 0; c < 3; c++) { const s0 = e.len * (0.2 + 0.3 * c), [x1, y1] = pt(e, s0 - 7, 1), [x2, y2] = pt(e, s0 - 2, 5), [x3, y3] = pt(e, s0 + 3, 2), [x4, y4] = pt(e, s0 + 8, 6); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x3, y3); ctx.lineTo(x4, y4); }
          ctx.stroke(); ctx.globalAlpha = 1;
        }
      } else if (boost) {                                                 // mur-bumper (6 participants et +) : ambre + chevrons de relance
        const puls = A.reduceFx ? 1 : 0.75 + 0.25 * Math.sin(now / 260), wf = wallFlash[i], ft = wf ? (now - wf) / 300 : 1;
        tube(e.ax, e.ay, e.bx, e.by, '#ffb545', 4.5, (0.8 + (ft < 1 ? 1.2 * (1 - ft) : 0)) * puls, 0.6);
        ctx.strokeStyle = '#ffd27a'; ctx.lineWidth = 1.8; ctx.lineJoin = 'round';
        const n = Math.max(2, Math.floor(e.len / (26 * u)));
        for (let c = 0; c < n; c++) {
          const s = (c + 0.5) * e.len / n, ph = A.reduceFx ? 0.7 : 0.35 + 0.65 * Math.max(0, Math.sin(c * 0.9 - now / 170));
          const [x1, y1] = pt(e, s - 4, 5), [x2, y2] = pt(e, s, 10), [x3, y3] = pt(e, s + 4, 5);
          ctx.globalAlpha = ph; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x3, y3); ctx.stroke();
        }
        ctx.globalAlpha = 1;
      } else {                                                            // bord d'un joueur en lice : ligne de but + filet + zone
        const col = colSeat(e.owner), isMe = e.owner === mySeat;
        const band = isMe ? [A.contrast ? 0.26 : 0.18, 0.1, 0.045] : [0.07, 0.04, 0.018], dd = [0, 7, 16, 30];
        ctx.fillStyle = col;
        for (let b = 0; b < 3; b++) { const q1 = pt(e, 0, dd[b]), q2 = pt(e, e.len, dd[b]), q3 = pt(e, e.len, dd[b + 1]), q4 = pt(e, 0, dd[b + 1]); ctx.globalAlpha = band[b]; ctx.beginPath(); ctx.moveTo(q1[0], q1[1]); ctx.lineTo(q2[0], q2[1]); ctx.lineTo(q3[0], q3[1]); ctx.lineTo(q4[0], q4[1]); ctx.closePath(); ctx.fill(); }
        ctx.globalAlpha = 1;
        const w = isMe ? 3 + (A.reduceFx ? 0.6 : 0.6 + 0.6 * Math.sin(now / 350)) : 2;
        tube(e.ax, e.ay, e.bx, e.by, col, A.contrast ? w + 0.8 : w, isMe ? 1 : 0.45, isMe ? 0.4 : 0);
        const [n1x, n1y] = pt(e, 0, 4.5), [n2x, n2y] = pt(e, e.len, 4.5);  // filet : pointillé parallèle
        ctx.setLineDash(DASH_NET); ctx.globalAlpha = 0.4; ctx.strokeStyle = col; ctx.lineWidth = 1; seg(n1x, n1y, n2x, n2y); ctx.setLineDash(NO_DASH); ctx.globalAlpha = 1;
        const ef = edgeFlash[e.owner];
        if (!A.reduceFx && ef && now - ef < 240) { ctx.globalAlpha = 1 - (now - ef) / 240; tube(e.ax, e.ay, e.bx, e.by, '#ffffff', 2.5, 0.8 * (1 - (now - ef) / 240), 0); }
        if (!A.reduceFx && vballs) {                                      // lueur du bord quand une balle le frôle
          let near = 0;
          for (const b of vballs) { if (b.iv) continue; const d = (b.x - e.ax) * e.nx + (b.y - e.ay) * e.ny, s = (b.x - e.ax) * e.tx + (b.y - e.ay) * e.ty; if (d > 0 && d < 55 && s > -12 && s < e.len + 12) near = Math.max(near, 1 - d / 55); }
          if (near > 0) { ctx.globalCompositeOperation = ADD(); ctx.strokeStyle = col; ctx.globalAlpha = near * 0.3; ctx.lineWidth = 12; seg(e.ax, e.ay, e.bx, e.by); ctx.globalAlpha = near * 0.8; ctx.lineWidth = 3; seg(e.ax, e.ay, e.bx, e.by); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; }
        }
        if (vivant && (q.shield || q.immune)) {                           // barrière : bouclier (cyan, maillage) · immunité (blanche, clignote)
          const fl = barrierFlash[q.seat], ft = fl ? (now - fl) / 380 : 1, bc = q.shield ? '#7fd1ff' : (TH.add ? '#ffffff' : '#3a3f66');
          const a = q.shield ? 0.9 : (A.reduceFx ? 0.55 : 0.35 + 0.3 * Math.sin(now / 90)), [b1x, b1y] = pt(e, 0, 3), [b2x, b2y] = pt(e, e.len, 3);
          if (!A.reduceFx) { ctx.globalCompositeOperation = ADD(); ctx.strokeStyle = bc; ctx.globalAlpha = 0.16 * a + (ft < 1 ? 0.4 * (1 - ft) : 0); ctx.lineWidth = 9 + (ft < 1 ? 8 * (1 - ft) : 0); seg(b1x, b1y, b2x, b2y); ctx.globalCompositeOperation = 'source-over'; }
          ctx.strokeStyle = bc; ctx.globalAlpha = a; ctx.lineWidth = 2.4; ctx.setLineDash(DASH_BAR); ctx.lineDashOffset = A.reduceFx ? 0 : -now / 40; seg(b1x, b1y, b2x, b2y);
          if (q.shield) { const [c1x, c1y] = pt(e, 0, 6.5), [c2x, c2y] = pt(e, e.len, 6.5); ctx.globalAlpha = a * 0.55; ctx.lineWidth = 1.4; ctx.setLineDash(DASH_BAR2); ctx.lineDashOffset = A.reduceFx ? 0 : now / 55; seg(c1x, c1y, c2x, c2y); }
          ctx.setLineDash(NO_DASH); ctx.lineDashOffset = 0;
          if (ft < 1 && !A.reduceFx) { ctx.globalAlpha = 1 - ft; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.5; seg(b1x, b1y, b2x, b2y); }
          ctx.globalAlpha = 1;
        }
      }
    }
    // bords qui se fissurent (vie perdue) ou volent en éclats (élimination) : le néon grésille puis se tait
    if (!A.reduceFx) for (let i = breaks.length - 1; i >= 0; i--) {
      const br = breaks[i], life = br.elim ? 1100 : 650, t = (now - br.born) / life, e = E[br.ei];
      if (t >= 1 || !e) { breaks.splice(i, 1); continue; }
      if (t < (br.elim ? 0.7 : 0.45) && Math.random() < 0.6) tube(e.ax, e.ay, e.bx, e.by, br.col, 3, 1.2 * (1 - t), 0.6 * (1 - t));
      const rr = rng(br.seed | 0), s0 = br.elim ? 0 : Math.max(0, br.s - 18 - 34 * t), s1 = br.elim ? e.len : Math.min(e.len, br.s + 18 + 34 * t), n = Math.max(3, Math.round((s1 - s0) / 7));
      ctx.beginPath();
      for (let k = 0; k <= n; k++) { const s = s0 + (s1 - s0) * k / n, [x, y] = pt(e, s, (k % 2 ? 1.5 : 4.5) + rr() * 2.5); k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.lineJoin = 'miter'; ctx.globalAlpha = 1 - t; ctx.strokeStyle = t < 0.25 ? '#ffffff' : br.col; ctx.lineWidth = 1.8; ctx.stroke(); ctx.lineJoin = 'round';
      ctx.globalAlpha = 1;
    }
    // bornes de coin (clignotent en rouge en mort subite)
    const nsp = nodeSprite(), alarm = snap.sd && snap.gs === 'play';
    for (const e of E) {
      if (alarm) { ctx.globalCompositeOperation = ADD(); glow('#ff3050', e.ax, e.ay, 16, A.reduceFx ? 0.5 : 0.3 + 0.35 * Math.sin(now / 160)); ctx.globalCompositeOperation = 'source-over'; }
      ctx.globalAlpha = 1; ctx.drawImage(nsp, e.ax - 9, e.ay - 9, 18, 18);
    }
    ctx.globalAlpha = 1;
  }

  /* ---- dessin : raquettes ---- */
  function chev(x, y, dir, s) { ctx.moveTo(x - dir * s, y - s); ctx.lineTo(x, y); ctx.lineTo(x - dir * s, y + s); }   // chevron pointant vers dir (±1 en x)
  function drawPaddle(p, e, pos, now, win) {
    const col = colOf(p), L = p.len || 0, r = PAD_W / 2, hl = Math.max(0.5, L / 2 - r);
    const [mx, my] = pt(e, pos, PAD_OFF + r);
    ctx.save(); ctx.translate(mx, my); ctx.rotate(Math.atan2(e.ty, e.tx)); ctx.scale(1, (-e.ty * e.nx + e.tx * e.ny) >= 0 ? 1 : -1);   // x = le long du bord · +y = vers le terrain
    ctx.lineCap = 'round';
    let al = 1; if (p.immune) al = A.reduceFx ? 0.6 : 0.5 + 0.32 * Math.sin(now / 70);   // immunité : clignote, sans jamais disparaître
    const fl = edgeFlash[p.seat], ft = (fl && !A.reduceFx) ? (now - fl) / 180 : 1;
    if (!A.reduceFx) {                                                   // halo (traits larges additifs : pas de shadowBlur)
      const gk = (p.grow ? 1.35 : 1) + (ft < 1 ? (1 - ft) * 0.9 : 0);
      ctx.globalCompositeOperation = ADD(); ctx.strokeStyle = col;
      ctx.globalAlpha = al * 0.11 * gk; ctx.lineWidth = PAD_W + 14 * gk; seg(-hl, 0, hl, 0);
      ctx.globalAlpha = al * 0.24 * gk; ctx.lineWidth = PAD_W + 6 * gk; seg(-hl, 0, hl, 0);
      ctx.globalCompositeOperation = 'source-over';
    }
    if (win && !A.reduceFx) { ctx.globalCompositeOperation = ADD(); ctx.strokeStyle = '#ffd76b'; ctx.globalAlpha = 0.3 + 0.25 * Math.sin(now / 180); ctx.lineWidth = PAD_W + 12; seg(-hl, 0, hl, 0); ctx.globalCompositeOperation = 'source-over'; }   // vainqueur auréolé d'or
    ctx.globalAlpha = al;
    if (A.contrast) { ctx.strokeStyle = TH.add ? '#ffffff' : '#111111'; ctx.lineWidth = PAD_W + 3; seg(-hl, 0, hl, 0); }
    ctx.strokeStyle = shade(col, -0.45); ctx.lineWidth = PAD_W; seg(-hl, 0, hl, 0);                   // gaine
    ctx.strokeStyle = col; ctx.lineWidth = PAD_W - 2.4; seg(-hl, 0, hl, 0);                          // tube
    const pat = seatPattern(ctx, p.seat, { size: Math.round(PAD_W * 1.4) });                         // motif du siège, aligné sur la raquette
    if (pat) { ctx.strokeStyle = pat; seg(-hl, 0, hl, 0); }
    ctx.strokeStyle = ft < 1 ? '#ffffff' : (p.inv ? '#ff9be0' : shade(col, 0.72));                     // cœur lumineux (magenta si contrôles inversés)
    ctx.globalAlpha = al * (ft < 1 ? 1 : 0.85); ctx.lineWidth = Math.max(1.3, PAD_W * 0.18) + (ft < 1 ? 2.2 * (1 - ft) : 0); seg(-hl, 0, hl, 0);
    ctx.globalAlpha = al * 0.45; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1; seg(-hl * 0.85, -r * 0.56, hl * 0.85, -r * 0.56);   // reflet
    ctx.globalAlpha = al; ctx.fillStyle = '#ffffff';                                                  // électrodes
    ctx.beginPath(); ctx.arc(-hl, 0, r * 0.36, 0, Math.PI * 2); ctx.arc(hl, 0, r * 0.36, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1; ctx.lineWidth = 1.6; ctx.lineJoin = 'round';
    if (p.grow) {                                                        // agrandie : rails dorés + chevrons vers l'extérieur
      ctx.strokeStyle = '#ffd76b'; ctx.beginPath(); ctx.moveTo(-hl, -r - 2.4); ctx.lineTo(hl, -r - 2.4); ctx.moveTo(-hl, r + 2.4); ctx.lineTo(hl, r + 2.4); ctx.stroke();
      ctx.beginPath(); chev(-L / 2 - 5, 0, -1, 3); chev(L / 2 + 5, 0, 1, 3); ctx.stroke();
    }
    if (p.shr) { ctx.strokeStyle = '#ffb36b'; ctx.beginPath(); chev(-L / 2 - 3, 0, 1, 3); chev(-L / 2 - 8, 0, 1, 3); chev(L / 2 + 3, 0, -1, 3); chev(L / 2 + 8, 0, -1, 3); ctx.stroke(); }   // rétrécie : chevrons qui compriment
    if (p.mag) {                                                         // aimant : lignes de champ qui convergent vers la raquette
      ctx.strokeStyle = '#ff8e6e';
      for (let k = 0; k < 3; k++) { const ph = A.reduceFx ? (k + 1) / 4 : ((now / 700) + k / 3) % 1, rr = 8 + (1 - ph) * 28; ctx.globalAlpha = 0.15 + 0.65 * ph; ctx.beginPath(); ctx.arc(0, r * 0.4, rr, Math.PI * 0.22, Math.PI * 0.78); ctx.stroke(); }
      ctx.globalAlpha = 1;
    }
    if (p.shield) { ctx.strokeStyle = '#bfe6ff'; ctx.lineWidth = 1.5; ctx.beginPath(); rrect(ctx, -L / 2 - 3, -r - 3, L + 6, PAD_W + 6, r + 3); ctx.stroke(); }
    ctx.restore();
  }
  function crown(x, y) {                                                 // meneur (handicap) : couronne vectorielle
    ctx.fillStyle = '#ffd76b'; ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(x - 5, y + 3.5); ctx.lineTo(x - 5.5, y - 3); ctx.lineTo(x - 2.4, y - 0.2); ctx.lineTo(x, y - 4.4); ctx.lineTo(x + 2.4, y - 0.2); ctx.lineTo(x + 5.5, y - 3); ctx.lineTo(x + 5, y + 3.5); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  function invIcon(x, y) {                                               // contrôles inversés : ⇄ vectoriel
    ctx.strokeStyle = '#ff9be0'; ctx.lineWidth = 1.5; ctx.lineCap = 'round'; ctx.beginPath();
    ctx.moveTo(x - 5, y - 2); ctx.lineTo(x + 4.5, y - 2); ctx.moveTo(x + 2.4, y - 4.2); ctx.lineTo(x + 4.8, y - 2); ctx.lineTo(x + 2.4, y + 0.2);
    ctx.moveTo(x + 5, y + 2.4); ctx.lineTo(x - 4.5, y + 2.4); ctx.moveTo(x - 2.4, y + 0.2); ctx.lineTo(x - 4.8, y + 2.4); ctx.lineTo(x - 2.4, y + 4.6); ctx.stroke();
  }
  function drawLabel(p, e) {
    const isMe = p.seat === mySeat, col = colOf(p), [lx, ly] = pt(e, e.len / 2, PAD_OFF + PAD_W + 14);
    const txt = isMe ? 'VOUS' : ((p.name || ('P' + (p.seat + 1))).slice(0, 8) + (p.bot ? '*' : ''));
    const icons = (p.lead ? 1 : 0) + (p.inv ? 1 : 0);
    const aw = 0;
    ctx.font = UI(isMe ? 12 : 11); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const tw = ctx.measureText(txt).width, tot = aw + tw + icons * 13, x0 = lx - tot / 2, alive = p.playing ? p.alive : true;
    ctx.globalAlpha = alive ? 1 : 0.35; ctx.fillStyle = TH.label; ctx.beginPath(); rrect(ctx, x0 - 5, ly - 8, tot + 10, 16, 6); ctx.fill();   // pastille : lisible sur la grille
    if (isMe) { ctx.strokeStyle = rgba(col, 0.8); ctx.lineWidth = 1; ctx.stroke(); }
    ctx.globalAlpha = alive ? (A.contrast ? 1 : 0.88) : 0.3; ctx.fillStyle = col; ctx.fillText(txt, x0 + aw + tw / 2, ly + 0.5);
    let ix = x0 + aw + tw + 8;
    if (p.lead) { crown(ix, ly); ix += 13; }
    if (p.inv) invIcon(ix, ly);
    ctx.globalAlpha = 1;
  }

  /* ---- dessin : bonus, bumpers, balles, effets ---- */
  function drawPowerups(now) {
    for (const pu of (snap.powerups || [])) {
      const col = pu.bad ? '#ff5a5a' : (PU_COL[pu.type] || '#ffffff'), bob = A.reduceFx ? 1 : 1 + 0.07 * Math.sin(now / 200 + pu.x), R = (PU_R + 7) * bob;
      ctx.globalAlpha = 1; ctx.drawImage(tokenSprite(pu.type, pu.bad), pu.x - R, pu.y - R, R * 2, R * 2);
      if (!A.reduceFx) {                                                 // anneau pointillé qui tourne
        ctx.save(); ctx.translate(pu.x, pu.y); ctx.rotate(now / (pu.bad ? 300 : 600)); ctx.setLineDash(DASH_RING);
        ctx.strokeStyle = col; ctx.globalAlpha = 0.7; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 0, (PU_R + (pu.bad ? 7.5 : 4)) * bob, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
  }
  function drawBumpers(now) {
    const bms = snap.bumpers || [];
    if (blockSeen.size > 12) blockSeen.clear();
    for (const bm of bms) {
      let sc = 1;
      if (bm.t) { const k = Math.round(bm.x) + ',' + Math.round(bm.y); let t0 = blockSeen.get(k); if (t0 == null) { t0 = now; blockSeen.set(k, t0); } const a = Math.min(1, (now - t0) / 240); sc = A.reduceFx ? 1 : 0.4 + 0.6 * a + 0.18 * Math.sin(a * Math.PI); }   // le plot surgit
      let hit = 0; for (const h of bumpHits) { const age = now - h.born; if (age < 260 && Math.hypot(h.x - bm.x, h.y - bm.y) < bm.r + 16) hit = Math.max(hit, 1 - age / 260); }
      const R = bm.r * 1.75 * sc * (1 + 0.12 * hit);
      if (hit > 0 && !A.reduceFx) { ctx.globalCompositeOperation = ADD(); glow(bm.t ? '#ffcf7a' : '#dfe4ff', bm.x, bm.y, bm.r * 3, 0.7 * hit); ctx.globalCompositeOperation = 'source-over'; }
      ctx.globalAlpha = 1; ctx.drawImage(bumperSprite(bm.r, bm.t), bm.x - R, bm.y - R, R * 2, R * 2);
      if (!bm.t && !A.reduceFx) {                                        // lampes qui tournent sur l'anneau
        ctx.save(); ctx.globalCompositeOperation = ADD(); ctx.strokeStyle = hit > 0 ? '#ffffff' : '#dfe4ff'; ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.globalAlpha = 0.75;
        for (let k = 0; k < 2; k++) { const a = now / 320 + k * Math.PI; ctx.beginPath(); ctx.arc(bm.x, bm.y, bm.r - 1.5, a, a + 0.7); ctx.stroke(); }
        ctx.restore();
      }
    }
    for (let i = bumpHits.length - 1; i >= 0; i--) if (now - bumpHits[i].born > 300) bumpHits.splice(i, 1);
    ctx.globalAlpha = 1;
  }
  const TMAX = 18;
  function drawBalls(vballs, now, playing, kdt) {
    const pop = (!A.reduceFx && now < ballPopUntil) ? 0.45 * ((ballPopUntil - now) / 90) : 0;
    if (trails.length !== vballs.length) trails = vballs.map(() => ({ x: new Float32Array(TMAX), y: new Float32Array(TMAX), n: 0 }));
    ctx.lineCap = 'round';
    for (let i = 0; i < vballs.length; i++) {
      const b = vballs[i], tr = trails[i];
      if (b.iv) { tr.n = 0; if (!A.reduceFx) { ctx.globalAlpha = 0.12; ctx.fillStyle = TH.ball; ctx.beginPath(); ctx.arc(b.x, b.y, BALL_R, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; } continue; }   // balle invisible : à peine perceptible
      if (tr.n && Math.hypot(b.x - tr.x[tr.n - 1], b.y - tr.y[tr.n - 1]) > 60) tr.n = 0;          // téléportée (nouveau service) : la comète repart de zéro
      if (tr.n === TMAX) { tr.x.copyWithin(0, 1); tr.y.copyWithin(0, 1); tr.n--; }
      tr.x[tr.n] = b.x; tr.y[tr.n] = b.y; tr.n++;
      const tcol = b.gh ? '#cbb3ff' : b.o >= 0 ? colSeat(b.o) : (TH.add ? '#ffffff' : '#5a5f8a'), hot = Math.min(1, Math.max(0, ((b.sp || 0) - 5) / 7));
      if (playing && !A.reduceFx && tr.n > 1) {                          // queue de comète : traits effilés, plus longue quand la balle file
        const k = Math.min(tr.n, 7 + Math.round(11 * hot)), s0 = tr.n - k;
        ctx.globalCompositeOperation = ADD(); ctx.strokeStyle = tcol;
        for (let j = s0 + 1; j < tr.n; j++) { const f = (j - s0) / k; ctx.globalAlpha = 0.5 * f; ctx.lineWidth = BALL_R * 1.8 * f; seg(tr.x[j - 1], tr.y[j - 1], tr.x[j], tr.y[j]); }
        if (hot > 0.4) { ctx.strokeStyle = '#ffffff'; for (let j = Math.max(s0 + 1, tr.n - 5); j < tr.n; j++) { const f = (j - tr.n + 6) / 6; ctx.globalAlpha = 0.5 * f * hot; ctx.lineWidth = BALL_R * 0.7 * f; seg(tr.x[j - 1], tr.y[j - 1], tr.x[j], tr.y[j]); } }   // cœur chauffé à blanc
        ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
        if (hot > 0.55 && Math.random() < 0.3 * kdt) { const a = Math.random() * Math.PI * 2; push(sparks, CAP.sparks, { x: b.x, y: b.y, vx: Math.cos(a) * 1.2, vy: Math.sin(a) * 1.2, born: now, life: 220, col: tcol, w: 1.2 }); }   // étincelles perdues à haute vitesse
      }
      const rr = BALL_R * (1 + pop);
      if (!A.reduceFx) { ctx.globalCompositeOperation = ADD(); glow(tcol, b.x, b.y, rr * 3.4, TH.add ? 0.6 : 0.35); ctx.globalCompositeOperation = 'source-over'; }
      ctx.globalAlpha = 1;
      if (b.gh) {                                                        // balle fantôme : translucide, contour pointillé qui tourne
        ctx.globalAlpha = 0.38; ctx.fillStyle = '#cbb3ff'; ctx.beginPath(); ctx.arc(b.x, b.y, rr, 0, Math.PI * 2); ctx.fill();
        ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(A.reduceFx ? 0 : now / 200); ctx.globalAlpha = 1; ctx.setLineDash(DASH_GHOST); ctx.strokeStyle = '#cbb3ff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, rr, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
      } else {
        ctx.fillStyle = TH.ball; ctx.beginPath(); ctx.arc(b.x, b.y, rr, 0, Math.PI * 2); ctx.fill();
        if (b.o >= 0) { ctx.strokeStyle = tcol; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(b.x, b.y, rr - 1, 0, Math.PI * 2); ctx.stroke(); }   // liseré : à qui appartient la balle
        if (TH.add) { ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.beginPath(); ctx.arc(b.x - rr * 0.3, b.y - rr * 0.3, rr * 0.28, 0, Math.PI * 2); ctx.fill(); }
        if (A.contrast) { ctx.strokeStyle = TH.add ? '#ffffff' : '#000000'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(b.x, b.y, rr + 1.6, 0, Math.PI * 2); ctx.stroke(); }
      }
      if (snap.slow) {                                                   // ralenti : givre autour de la balle
        ctx.strokeStyle = '#9fe6ff'; ctx.lineWidth = 1.3; ctx.globalAlpha = 0.85; ctx.beginPath();
        for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2 + (A.reduceFx ? 0 : now / 900); ctx.moveTo(b.x + Math.cos(a) * (rr + 2), b.y + Math.sin(a) * (rr + 2)); ctx.lineTo(b.x + Math.cos(a) * (rr + 6), b.y + Math.sin(a) * (rr + 6)); }
        ctx.stroke(); ctx.globalAlpha = 1;
      }
    }
  }
  function drawFx(now, kdt) {
    if (A.reduceFx) { rings.length = 0; sparks.length = 0; dots.length = 0; shards.length = 0; pops.length = 0; texts.length = 0; return; }
    ctx.lineCap = 'round';
    for (let i = rings.length - 1; i >= 0; i--) {                        // ondes : pleine, pointillée (fantôme), dentelée (malus), hexagonale (bouclier)
      const q = rings[i], t = (now - q.born) / q.life; if (t >= 1) { rings.splice(i, 1); continue; } if (t < 0) continue;
      const e = 1 - (1 - t) * (1 - t), r = q.r0 + (q.r1 - q.r0) * e;
      ctx.globalAlpha = 0.85 * (1 - t); ctx.strokeStyle = q.col; ctx.lineWidth = q.lw * (1 - t * 0.6);
      ctx.beginPath();
      if (q.style === 2 || q.style === 3) { const n = q.style === 3 ? 6 : 18; for (let k = 0; k <= n; k++) { const a = k / n * Math.PI * 2 + (q.style === 3 ? Math.PI / 6 : 0), rk = q.style === 2 && k % 2 ? r * 0.8 : r; k ? ctx.lineTo(q.x + Math.cos(a) * rk, q.y + Math.sin(a) * rk) : ctx.moveTo(q.x + Math.cos(a) * rk, q.y + Math.sin(a) * rk); } }
      else ctx.arc(q.x, q.y, r, 0, Math.PI * 2);
      if (q.style === 1) ctx.setLineDash(DASH_GHOST);
      ctx.stroke(); if (q.style === 1) ctx.setLineDash(NO_DASH);
    }
    ctx.globalCompositeOperation = ADD();
    for (let i = sparks.length - 1; i >= 0; i--) {                       // étincelles : traits qui filent et ralentissent
      const q = sparks[i], t = (now - q.born) / q.life; if (t >= 1) { sparks.splice(i, 1); continue; }
      q.x += q.vx * kdt; q.y += q.vy * kdt; q.vx *= Math.pow(0.9, kdt); q.vy *= Math.pow(0.9, kdt);
      ctx.globalAlpha = 1 - t; ctx.strokeStyle = q.col; ctx.lineWidth = q.w * (1 - t) + 0.4; seg(q.x, q.y, q.x - q.vx * 2.2, q.y - q.vy * 2.2);
    }
    for (let i = dots.length - 1; i >= 0; i--) {                         // poussière néon (et feux d'artifice, avec gravité)
      const q = dots[i], t = (now - q.born) / q.life; if (t >= 1) { dots.splice(i, 1); continue; }
      q.x += q.vx * kdt; q.y += q.vy * kdt; q.vx *= Math.pow(0.95, kdt); q.vy = q.vy * Math.pow(0.95, kdt) + q.g * kdt;
      ctx.globalAlpha = 1 - t; ctx.fillStyle = q.col; ctx.beginPath(); ctx.arc(q.x, q.y, q.r * (1 - t) + 0.4, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    for (let i = shards.length - 1; i >= 0; i--) {                       // éclats de tube : segments qui tournoient
      const q = shards[i], t = (now - q.born) / q.life; if (t >= 1) { shards.splice(i, 1); continue; }
      q.x += q.vx * kdt; q.y += q.vy * kdt; q.vx *= Math.pow(0.95, kdt); q.vy *= Math.pow(0.95, kdt); q.a += q.va * kdt;
      const cx = Math.cos(q.a) * q.len / 2, cy = Math.sin(q.a) * q.len / 2;
      ctx.globalAlpha = 1 - t * t; ctx.strokeStyle = q.col; ctx.lineWidth = 1.8; seg(q.x - cx, q.y - cy, q.x + cx, q.y + cy);
    }
    for (let i = pops.length - 1; i >= 0; i--) {                         // pictogramme du bonus ramassé : il gonfle et s'envole
      const q = pops[i], t = (now - q.born) / 460; if (t >= 1) { pops.splice(i, 1); continue; }
      const R = (PU_R + 7) * (1 + 1.2 * t); ctx.globalAlpha = 1 - t; ctx.drawImage(tokenSprite(q.t, q.bad), q.x - R, q.y - R - 14 * t, R * 2, R * 2);
    }
    const u = W / 500;
    for (let i = texts.length - 1; i >= 0; i--) {                        // « −1 » / « K.O. » : claque puis s'efface
      const q = texts[i], t = (now - q.born) / 1150; if (t >= 1) { texts.splice(i, 1); continue; }
      const s = t < 0.12 ? 0.5 + 0.75 * t / 0.12 : t < 0.22 ? 1.25 - 0.25 * (t - 0.12) / 0.1 : 1;
      ctx.save(); ctx.translate(q.x, q.y - 10 * u * t); ctx.scale(s * u, s * u); ctx.rotate(-0.06); ctx.globalAlpha = t > 0.7 ? (1 - t) / 0.3 : 1;
      ctx.font = DISP(q.big ? 34 : 22); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
      ctx.globalCompositeOperation = ADD(); ctx.strokeStyle = q.col; ctx.lineWidth = 9; ctx.globalAlpha *= 0.5; ctx.strokeText(q.txt, 0, 0); ctx.globalAlpha = t > 0.7 ? (1 - t) / 0.3 : 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = TH.add ? '#0a0414' : '#ffffff'; ctx.lineWidth = 4; ctx.strokeText(q.txt, 0, 0); ctx.fillStyle = q.col; ctx.fillText(q.txt, 0, 0);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  /* ---- dessin : écrans (repère virtuel 500 × 500, centré sur le canvas) ---- */
  function fitFont(txt, font, size, maxW) { ctx.font = font(size); const w = ctx.measureText(txt).width; if (w > maxW) { size = Math.max(8, Math.floor(size * maxW / w)); ctx.font = font(size); } return size; }
  function neonText(txt, x, y, size, col, fill) {                        // texte d'affichage : halo en traits larges, contour sombre, remplissage
    ctx.font = DISP(size); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    if (!A.reduceFx) { ctx.globalCompositeOperation = ADD(); ctx.strokeStyle = col; ctx.globalAlpha = 0.16; ctx.lineWidth = size * 0.3; ctx.strokeText(txt, x, y); ctx.globalAlpha = 0.3; ctx.lineWidth = size * 0.14; ctx.strokeText(txt, x, y); ctx.globalCompositeOperation = 'source-over'; }
    ctx.globalAlpha = 1; ctx.strokeStyle = TH.add ? '#12051f' : '#ffffff'; ctx.lineWidth = Math.max(3, size * 0.1); ctx.strokeText(txt, x, y);
    ctx.strokeStyle = col; ctx.lineWidth = Math.max(1.2, size * 0.035); ctx.strokeText(txt, x, y);
    ctx.fillStyle = fill || col; ctx.fillText(txt, x, y);
  }
  function chromeGrad(y, size) { const cg = ctx.createLinearGradient(0, y - size * 0.42, 0, y + size * 0.42), C = TH.chrome; cg.addColorStop(0, C[0]); cg.addColorStop(0.46, C[1]); cg.addColorStop(0.5, C[2]); cg.addColorStop(0.56, C[3]); cg.addColorStop(1, C[4]); return cg; }
  function drawTitle(cx, cy, now) {
    const fs = 64; ensureLogo(fs);
    const w = logoCv._w, h = logoCv._h;
    if (!A.reduceFx) { ctx.globalCompositeOperation = ADD(); ctx.globalAlpha = TH.add ? 0.65 + 0.3 * Math.sin(now / 900) : 0.5; ctx.drawImage(logoGlow, cx - w / 2, cy - h / 2, w, h); ctx.globalCompositeOperation = 'source-over'; }   // halo qui respire
    ctx.globalAlpha = 1; ctx.drawImage(logoCv, cx - w / 2, cy - h / 2, w, h);
    // raquettes et balle qui encadrent le mot : la balle traverse en rebondissant (dérivé de `now`, sans état)
    const half = logoW / 2 + fs * 0.32, px = half + fs * 0.3, pw = Math.max(3, fs * 0.11), ph = fs * 0.5, amp = fs * 0.26, r = Math.max(2.5, fs * 0.085);
    const t = A.reduceFx ? 0 : now;
    const bx = tt => cx - half + 2 * half * TRI(tt / 1700), by = tt => cy + (TRI(tt / 1150) * 2 - 1) * amp, pdy = tt => cy + (by(tt) - cy) * 0.6;
    ctx.lineCap = 'round';
    for (const [x, yy] of [[cx - px, A.reduceFx ? cy : pdy(t - 210)], [cx + px, A.reduceFx ? cy : pdy(t - 330)]]) {
      if (!A.reduceFx) { ctx.globalCompositeOperation = ADD(); ctx.strokeStyle = TH.B; ctx.globalAlpha = 0.3; ctx.lineWidth = pw * 3; seg(x, yy - ph / 2 + pw, x, yy + ph / 2 - pw); ctx.globalCompositeOperation = 'source-over'; }
      ctx.globalAlpha = 1; ctx.strokeStyle = TH.B; ctx.lineWidth = pw; seg(x, yy - ph / 2 + pw / 2, x, yy + ph / 2 - pw / 2);
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = pw * 0.35; seg(x, yy - ph / 2 + pw / 2, x, yy + ph / 2 - pw / 2);
    }
    if (!A.reduceFx) {
      ctx.globalCompositeOperation = ADD();
      for (let k = 5; k >= 1; k--) { const tt = now - k * 40; glow(TH.add ? '#ffffff' : TH.A, bx(tt), by(tt), r * (2.4 - k * 0.25), 0.1 * (6 - k)); }
      glow(TH.A, bx(now), by(now), r * 4, 0.6); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
      ctx.fillStyle = TH.add ? '#ffffff' : TH.txt; ctx.beginPath(); ctx.arc(bx(now), by(now), r, 0, Math.PI * 2); ctx.fill();
    }
  }
  function drawLobby(now) {
    ensureLobby();
    ctx.drawImage(lobbyCv, 0, 0, 500, 500);
    // sol en perspective : les lignes défilent vers le joueur au rythme de la musique
    const bpm = MUSIC_THEME.bpm, sh = A.reduceFx ? 0 : (now / 60000 * bpm / 2) % 1, N = 12;
    ctx.save(); ctx.beginPath(); ctx.rect(0, HY, 500, 500 - HY); ctx.clip(); ctx.lineCap = 'butt';
    const gridPass = (wm, am) => {
      for (let i = 0; i < N; i++) { const d = (i + sh) / N, y = HY + (500 - HY) * d * d; ctx.globalAlpha = am * (0.1 + 0.75 * d); ctx.lineWidth = (0.5 + 1.5 * d) * wm; seg(0, y, 500, y); }
      ctx.globalAlpha = am * 0.55; ctx.lineWidth = wm;
      ctx.beginPath(); for (let j = -11; j <= 11; j++) { ctx.moveTo(250 + j * 4, HY); ctx.lineTo(250 + j * 60, 520); } ctx.stroke();
    };
    ctx.strokeStyle = TH.A;
    if (!A.reduceFx) { ctx.globalCompositeOperation = ADD(); gridPass(4, 0.18); ctx.globalCompositeOperation = 'source-over'; }
    gridPass(1, TH.add ? 0.9 : 0.6);
    ctx.restore(); ctx.globalAlpha = 1;
    drawTitle(250, 150, now);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = DISP(10); ctx.fillStyle = rgba(TH.B, 0.9); ctx.fillText('A R C A D E  ·  2  À  1 0  J O U E U R S', 250, 204);
    if (!snap) return;
    // plaque d'infos posée sur la grille
    ctx.fillStyle = TH.add ? 'rgba(6,3,18,0.7)' : 'rgba(255,255,255,0.72)'; ctx.beginPath(); rrect(ctx, 56, 292, 388, 158, 12); ctx.fill();
    ctx.strokeStyle = rgba(TH.A, 0.7); ctx.lineWidth = 1.4; ctx.stroke();
    ctx.strokeStyle = rgba(TH.B, 0.35); ctx.lineWidth = 1; ctx.beginPath(); rrect(ctx, 61, 297, 378, 148, 9); ctx.stroke();
    const n = snap.connected + snap.botCount, ink = TH.txt;
    const l1 = `${SHAPE[n] || (n + ' joueurs')} · ${snap.connected} humain${snap.connected > 1 ? 's' : ''}${snap.botCount ? ' + ' + snap.botCount + ' bot' + (snap.botCount > 1 ? 's' : '') : ''}`;
    fitFont(l1, DISP, 14, 360); ctx.fillStyle = ink; ctx.fillText(l1, 250, 318);
    ctx.font = UI(13); ctx.fillStyle = teamMode ? TH.B : rgba(ink, 0.78); ctx.fillText(`${PRESET_LABEL[snap.preset] || snap.preset}${teamMode ? ' · ' + (MODE_NAME[snap.mode] || snap.mode) : ''}`, 250, 342);
    ctx.font = '12px system-ui,sans-serif'; ctx.fillStyle = rgba(ink, 0.6); ctx.fillText(PRESET_DESC[snap.preset] || '', 250, 361);
    if (snap.opts) { const o = snap.opts;
      let r = 'Victoire : ' + (WINMODE_LABEL[o.winMode] || o.winMode);
      if (o.winMode === 'rounds') r += ' (' + o.roundsTarget + ')'; else if (o.winMode === 'kills') r += ' (' + o.killsTarget + ')';
      if (o.sudden !== 'off') r += ' · Mort subite'; if (o.handicap) r += ' · Handicap';
      fitFont(r, s => s + 'px system-ui,sans-serif', 11.5, 360); ctx.fillStyle = rgba(ink, 0.55); ctx.fillText(r, 250, 379);
    }
    const blink = A.reduceFx || Math.floor(now / 530) % 2 === 0;           // invite clignotante « borne d'arcade »
    const pr = n >= 2 ? '► ESPACE / CLIC POUR LANCER' : '► ESPACE / CLIC : ENTRAÎNEMENT SOLO';
    const ps = fitFont(pr, DISP, 13, 360);
    ctx.globalAlpha = blink ? 1 : 0.35; neonText(pr, 250, 410, ps, TH.A, TH.add ? '#ffffff' : TH.A); ctx.globalAlpha = 1;
    if (n < 2) { ctx.font = '11.5px system-ui,sans-serif'; ctx.fillStyle = rgba(ink, 0.6); ctx.fillText('contre le mur — ou ajoute un adversaire avec « Bots »', 250, 432); }
    if (board.length) {                                                  // « high score » : le recordman du classement
      const top = board.reduce((a, b) => ((b.wins || 0) > (a.wins || 0) ? b : a));
      if ((top.wins || 0) > 0) { const rec = 'RECORD  ' + String(top.name || '?').slice(0, 14) + '  —  ' + top.wins + ' VICTOIRE' + (top.wins > 1 ? 'S' : ''); fitFont(rec, DISP, 11, 400); ctx.fillStyle = TH.add ? '#ffd76b' : '#9a6a00'; ctx.fillText(rec, 250, 472); }
    }
  }
  function drawCountdown(now) {
    ctx.fillStyle = 'rgba(' + TH.veil + ',0.3)'; ctx.fillRect(0, 0, 500, 500);
    const n = snap.count || 0, t = (now - countT) / 1000, cy = 246;
    const z = A.reduceFx ? 1 : 1 + 0.6 * Math.pow(Math.max(0, 1 - t * 4), 2);   // chaque chiffre « claque » en entrant
    ctx.lineCap = 'round';
    for (let k = 0; k < 3; k++) {                                        // anneau de 3 segments : ils s'éteignent un à un
      const a0 = -Math.PI / 2 + k * Math.PI * 2 / 3 + 0.09, a1 = a0 + Math.PI * 2 / 3 - 0.18, on = n === 0 || k < n;
      ctx.strokeStyle = on ? (n === 0 ? TH.B : TH.A) : rgba(TH.txt, 0.14);
      if (on && !A.reduceFx) { ctx.globalCompositeOperation = ADD(); ctx.globalAlpha = 0.22; ctx.lineWidth = 16; ctx.beginPath(); ctx.arc(250, cy, 76, a0, a1); ctx.stroke(); ctx.globalCompositeOperation = 'source-over'; }
      ctx.globalAlpha = 1; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(250, cy, 76, a0, a1); ctx.stroke();
    }
    ctx.save(); ctx.translate(250, cy); ctx.scale(z, z);
    const txt = n > 0 ? String(n) : 'GO!', size = n > 0 ? 92 : 58;
    neonText(txt, 0, 4, size, n > 0 ? TH.A : TH.B, chromeGrad(4, size));
    ctx.restore();
    const sub = n > 0 ? 'PRÊT ?' : 'C\'EST PARTI !';
    ctx.globalAlpha = 1; neonText(sub, 250, cy + 104, 15, TH.B, TH.add ? '#ffffff' : TH.B);
    if (n > 0) { ctx.font = '12px system-ui,sans-serif'; ctx.fillStyle = rgba(TH.txt, 0.6); ctx.fillText('▲ ▼  pour placer ta raquette', 250, cy + 126); }
  }
  function drawPause(now) {
    ctx.fillStyle = 'rgba(' + TH.veil + ',0.66)'; ctx.fillRect(0, 0, 500, 500);
    if (TH.add) {                                                        // lignes de balayage de l'écran de la borne
      if (!scanPat) { const c = mkCanvas(4, 4), g = c.getContext('2d'); g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(0, 0, 4, 1); try { scanPat = ctx.createPattern(c, 'repeat'); } catch (e) { scanPat = null; } }
      if (scanPat) { ctx.fillStyle = scanPat; ctx.fillRect(0, 0, 500, 500); }
    }
    const cy = 250;
    ctx.fillStyle = TH.panel; ctx.beginPath(); rrect(ctx, 106, cy - 72, 288, 136, 14); ctx.fill();   // cadre de marquise
    ctx.strokeStyle = TH.A; ctx.lineWidth = 2.4; ctx.stroke();
    ctx.strokeStyle = rgba(TH.B, 0.6); ctx.lineWidth = 1; ctx.beginPath(); rrect(ctx, 112, cy - 66, 276, 124, 10); ctx.stroke();
    ctx.fillStyle = TH.B; for (const [x, y] of [[118, cy - 60], [382, cy - 60], [118, cy + 52], [382, cy + 52]]) { ctx.beginPath(); ctx.arc(x, y, 2.2, 0, Math.PI * 2); ctx.fill(); }   // rivets
    neonText('PAUSE', 250, cy - 16, 44, TH.A, chromeGrad(cy - 16, 44));
    const blink = A.reduceFx || Math.floor(now / 600) % 2 === 0;
    ctx.globalAlpha = blink ? 1 : 0.4; ctx.font = UI(13); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = TH.add ? 'rgba(255,255,255,0.8)' : rgba(TH.txt, 0.75);
    ctx.fillText('P / Échap pour reprendre', 250, cy + 32); ctx.globalAlpha = 1;
  }
  function drawServeArrow(now, world) {                                  // flèche du service (repère du TERRAIN : elle part de la balle)
    const sb = snap.balls && snap.balls[0];
    if (!sb || !(sb.vx || sb.vy)) return;
    const mag = Math.hypot(sb.vx, sb.vy), ux = sb.vx / mag, uy = sb.vy / mag, len = 48, hx = sb.x + ux * len, hy = sb.y + uy * len, ang = Math.atan2(uy, ux);
    world();
    const a = A.reduceFx ? 0.9 : 0.75 + 0.25 * Math.sin(now / 150);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (!A.reduceFx) { ctx.globalCompositeOperation = ADD(); ctx.strokeStyle = TH.B; ctx.globalAlpha = 0.25 * a; ctx.lineWidth = 9; seg(sb.x, sb.y, hx, hy); ctx.globalCompositeOperation = 'source-over'; }
    ctx.globalAlpha = a; ctx.strokeStyle = TH.add ? '#ffffff' : TH.txt; ctx.fillStyle = ctx.strokeStyle; ctx.lineWidth = 3;
    ctx.setLineDash(DASH_ARROW); ctx.lineDashOffset = A.reduceFx ? 0 : -now / 30; seg(sb.x + ux * 12, sb.y + uy * 12, hx - ux * 6, hy - uy * 6); ctx.setLineDash(NO_DASH); ctx.lineDashOffset = 0;
    ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx - Math.cos(ang - 0.4) * 12, hy - Math.sin(ang - 0.4) * 12); ctx.lineTo(hx - Math.cos(ang + 0.4) * 12, hy - Math.sin(ang + 0.4) * 12); ctx.closePath(); ctx.fill();
    if (!A.reduceFx) { const ph = (now / 900) % 1; ctx.globalAlpha = 0.7 * (1 - ph); ctx.strokeStyle = TH.B; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(sb.x, sb.y, BALL_R + 3 + ph * 18, 0, Math.PI * 2); ctx.stroke(); }   // la balle « respire » avant le service
    ctx.globalAlpha = 1;
  }

  /* ---- éclairage dynamique et crépuscule (couche commune, par-dessus la refonte) ---- */
  // Lumière tombée sur le SOL : après drawField, avant les bords et les pièces, prise dans le polygone
  // (hors terrain le canvas est transparent en plein écran : une lueur additive y ferait une tache).
  function drawLights(E, vballs, now, live) {
    if (A.reduceFx) return;
    const k = lightK();
    ctx.save(); polyPath(E); ctx.clip();
    if (live) for (const b of vballs) {
      if (b.iv) continue;                                                // balle invisible : sa lumière la trahirait
      const hot = Math.min(1, Math.max(0, ((b.sp || 0) - 5) / 7));
      const col = b.gh ? '#cbb3ff' : b.o >= 0 ? colSeat(b.o) : (TH.add ? '#ffffff' : TH.A);   // couleur du dernier toucheur
      lumiere(ctx, b.x, b.y, 62 + 34 * hot, col, (b.gh ? 0.12 : 0.2 + 0.12 * hot) * k);
    }
    for (const pu of (snap.powerups || [])) lumiere(ctx, pu.x, pu.y, 36, pu.bad ? '#ff5a5a' : (PU_COL[pu.type] || '#ffffff'), 0.1 * k);   // les jetons rayonnent un peu
    flashes.dessiner(ctx, now);
    ctx.restore(); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }
  // Mort subite : l'arène passe du jour au crépuscule, au fil du temps JOUÉ depuis son déclenchement.
  // Pris dans le terrain d'origine (geo0) : la zone déjà mangée par le rétrécissement s'assombrit avec le reste.
  const SD_RAMP = 26000;                                                 // ms pour atteindre le crépuscule complet (plafonné par la brique)
  function drawDusk(E) {
    const t = Math.max(sdAcc > 0 ? Math.min(1, sdAcc / SD_RAMP) : 0, DUEL.t(snap, performance.now(), duelAnnonce));   // mort subite (option) OU duel final
    if (!(t > 0.005) || !fbox) return;
    const force = (TH.add ? 0.85 : 0.55) * (A.contrast ? 0.7 : 1) * (A.reduceFx ? 0.5 : 1);   // les raquettes vivent sur les BORDS, là où la vignette mord : on reste en deçà
    ctx.save(); ctx.beginPath();
    if (geo0 && geo0.length === E.length * 2) { ctx.moveTo(geo0[0], geo0[1]); for (let i = 2; i < geo0.length; i += 2) ctx.lineTo(geo0[i], geo0[i + 1]); ctx.closePath(); }
    else polyPath(E);
    ctx.clip();
    crepuscule(ctx, fbox.x, fbox.y, fbox.w, fbox.h, t, { soleil: 'haut', force });
    ctx.restore(); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }

  function draw() {
    if (destroyed) return;
    const now = performance.now(), kdt = Math.min(3, Math.max(0.25, (now - (lastFrame || now - 16.7)) / 16.7)); lastFrame = now;
    if (snap) {                                        // horloge du crépuscule : avance en mort subite jouée, figée en pause / à la fin
      const g0 = snap.gs;
      if (snap.sd && g0 === 'play') sdAcc += kdt * 16.7;
      else if (g0 === 'lobby' || g0 === 'countdown' || (g0 === 'play' && !snap.sd)) sdAcc = 0;
    }
    const sc = cv.width / W;
    let ox = 0, oy = 0;
    if (shakeMag > 0.3 && !A.reduceFx) { ox = (Math.random() * 2 - 1) * shakeMag; oy = (Math.random() * 2 - 1) * shakeMag; shakeMag *= 0.86; }
    else shakeMag = 0;
    const fit = geoFit(snap && snap.geo, snap && snap.gs);
    // `base` : repère du CANVAS (fonds) · `world` : repère du TERRAIN recadré · `vbase` : écrans en 500 × 500 virtuels.
    const base = () => ctx.setTransform(sc, 0, 0, sc, ox * sc, oy * sc);
    const world = () => ctx.setTransform(sc * fit.s, 0, 0, sc * fit.s, sc * (fit.tx + ox), sc * (fit.ty + oy));
    const vbase = () => { const v = cv.width / 500; ctx.setTransform(v, 0, 0, v, ox * sc, oy * sc); };
    // Plein écran sur PC : le fond étoilé est celui de la colonne centrale (style.css), prolongé sur
    // toute sa largeur. Le canvas reste TRANSPARENT hors du terrain — sinon son carré se découpait
    // sur les étoiles de la colonne. On efface en repère brut : la secousse décale `base()`.
    const ambiant = document.body.classList.contains('dock') && document.body.classList.contains('playing');
    if (ambiant) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    const view = computeView(now);
    const vballs = view ? view.balls : (snap ? snap.balls : []);
    const moiPred = predireMoi(now);                   // sa propre raquette : prédite, pas interpolée
    const vpos = s => (s === mySeat && moiPred != null) ? moiPred : (view && view.pos[s] != null) ? view.pos[s] : (snap ? snap.players[s].pos : 0);
    if (!snap || snap.gs === 'lobby') { vbase(); drawLobby(now); return; }   // écran titre : la scène couvre tout le canvas
    base();
    if (!ambiant) drawBackground(now);
    const geo = snap.geo;
    if (geo && geo.edges && geo.edges.length) {
      world();
      const E = geo.edges, gs = snap.gs, over = gs === 'over';
      drawField(E, fit, now);
      drawLights(E, vballs, now, gs === 'play' || gs === 'paused' || gs === 'countdown');
      drawEdges(E, now, (gs === 'play' || gs === 'paused') ? vballs : null);
      drawPowerups(now);
      snap.players.forEach(p => {
        if (p.edge < 0) return;
        const e = E[p.edge]; if (!e) return;
        drawLabel(p, e);
        if (p.playing && !p.alive) return;
        drawPaddle(p, e, vpos(p.seat), now, over && p.playing && p.alive);
      });
      drawBumpers(now);
      if (gs === 'play' || gs === 'paused' || gs === 'countdown') drawBalls(vballs, now, gs === 'play', kdt);
      else trails = [];
      if (over && !A.reduceFx && now - lastFw > 650 && dots.length < 160) {   // fin : feux d'artifice aux couleurs des vainqueurs
        lastFw = now; const win = snap.players.filter(p => p.playing && p.alive), bw = fit.bw || W, bh = fit.bh || H;
        const c = win.length ? colOf(win[Math.floor(Math.random() * win.length)]) : TH.A;
        motes(W / 2 + (Math.random() - 0.5) * bw * 0.6, H / 2 + (Math.random() - 0.5) * bh * 0.5, 22, 1.2, 3.2, c, 1100, 2.2, now, 0.03);
      }
      drawFx(now, kdt);
      drawDusk(E);                               // étalonnage PAR-DESSUS sol + pièces, sous les écrans / voiles
    } else trails = [];
    vbase();                                     // les voiles et écrans qui suivent couvrent tout le CANVAS
    if (snap.gs === 'countdown') { drawCountdown(now); drawServeArrow(now, world); }
    else if (snap.gs === 'paused') drawPause(now);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }
  function drawLoop() { if (destroyed) return; try { draw(); } catch (e) { console.error('[render]', e); } rafId = requestAnimationFrame(drawLoop); }   // filet : une erreur de rendu ne fige plus le jeu

  /* ---- inputs ---- */
  function keyToAction(code) {
    if (['ArrowUp', 'ArrowLeft', 'KeyW', 'KeyA'].includes(code)) return 'up';
    if (['ArrowDown', 'ArrowRight', 'KeyS', 'KeyD'].includes(code)) return 'dn';
    return null;
  }
  function setAction(a, val) { if (input[a] === val) return; input[a] = val; dernierInputT = performance.now(); send({ t: 'input', up: input.up, dn: input.dn }); }

  /* ---- prédiction locale de sa raquette -------------------------------------------------------
     Réplique EXACTE de humanMove() côté serveur : même vitesse (pspd, par tick à 60 Hz), même règle de
     sens, même malus d'inversion (p.inv), mêmes butées (p.len). Pendant qu'on bouge, on ne corrige PAS
     vers le serveur : il est en retard d'une latence par construction, s'y recaler ferait reculer la
     raquette (effet élastique). Il reçoit l'appui ET le relâchement avec le même retard, donc il
     s'arrête exactement au même endroit : au repos, on converge simplement vers lui. Grand écart
     (nouvelle manche, changement de bord) : recalage immédiat. */
  function predireMoi(now) {
    const me = snap && mySeat >= 0 ? snap.players[mySeat] : null;
    const actif = me && me.edge >= 0 && me.alive && snap.geo && (snap.gs === 'play' || snap.gs === 'countdown');
    const e = actif ? snap.geo.edges[me.edge] : null;
    if (!e) { pred = null; return null; }
    if (!pred || pred.edge !== me.edge) pred = { pos: me.pos, edge: me.edge, t: now };
    const dt = Math.min(50, now - pred.t); pred.t = now;
    let d = (input.up ? -1 : 0) + (input.dn ? 1 : 0);
    if (me.inv) d = -d;
    const sign = ((Math.abs(e.ty) >= Math.abs(e.tx)) ? e.ty > 0 : e.tx > 0) ? 1 : -1;
    pred.pos += d * sign * padSpd * dt * 0.06;        // par tick à 60 Hz → par milliseconde
    const err = me.pos - pred.pos;
    const rtt = window.__rtt || 80;                    // mesuré par app.js (ping)
    if (Math.abs(err) > e.len * 0.35) pred.pos = me.pos;
    else if (!d && now - dernierInputT > rtt + 120) pred.pos += err * Math.min(1, dt / 90);
    const L = me.len || 0;
    pred.pos = Math.max(L / 2, Math.min(e.len - L / 2, pred.pos));
    return pred.pos;
  }
  function setKey(code, val) { const a = keyToAction(code); if (a) setAction(a, val); }
  const onKeyDown = e => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
    unlockAudio();
    if (e.key === ' ' && snap && snap.gs !== 'play' && snap.gs !== 'paused') send({ t: 'start' });
    if ((e.key === 'p' || e.key === 'P' || e.key === 'Escape') && snap && (snap.gs === 'play' || snap.gs === 'paused')) send({ t: 'pause' });
    if (!e.repeat) setKey(e.code, true);
  };
  const onKeyUp = e => setKey(e.code, false);
  const onBlur = () => { if (input.up || input.dn) { input.up = input.dn = false; send({ t: 'input', up: false, dn: false }); } };
  function hold(el, action) {
    if (!el) return;
    const on = e => { e.preventDefault(); unlockAudio(); setAction(action, true); };
    const off = e => { e.preventDefault(); setAction(action, false); };
    el.addEventListener('pointerdown', on); el.addEventListener('pointerup', off);
    el.addEventListener('pointerleave', off); el.addEventListener('pointercancel', off);
  }

  // Les boutons du DOM sont STATIQUES et le module est un singleton (import() en cache) : init() est
  // rappelé à chaque retour sur le jeu. Sans ce drapeau, chaque retour rebranchait les écouteurs sans
  // débrancher les précédents — après k retours, un appui partait k fois (k mines, k bombes, k virages).
  // Leurs gestionnaires lisent l’état COURANT du module (send, snap…) : les brancher une fois suffit.
  let cable = false;
  function init(ctx0) {
    const premiere = !cable; cable = true;
    destroyed = false;              // module singleton réutilisé : réarmer la boucle de rendu après un précédent teardown
    A = ctx0.a11y; send = ctx0.send; root = ctx0.root;
    if (ctx0.togglePanel) togglePanel = ctx0.togglePanel;
    if (ctx0.closePanels) closePanels = ctx0.closePanels;
    cv = $('c'); ctx = cv.getContext('2d');
    { const wrap = cv.parentElement;   // conteneur `.canvas-wrap` : les messages se posent dessus, pas sur le canvas
      if (wrap && wrap.classList && wrap.classList.contains('canvas-wrap')) initGameMsg(wrap); }
    hud = $('hud');
    hud.innerHTML = '';             // module réutilisé : repartir d'un HUD vide (sinon les cartes P1.. se cumulent à chaque retour)
    cards = Array.from({ length: MAX_SEATS }, (_, i) => i).map(i => {
      const el = document.createElement('div');
      el.className = 'pc hidden';
      el.innerHTML = `<div class="dot"></div><div class="inf"><div class="pn" id="pn${i}">P${i + 1}</div><div class="lv" id="lv${i}"></div></div>`;
      hud.appendChild(el); return el;
    });
    startBtn = $('startBtn'); pauseBtn = $('pauseBtn'); botsBtn = $('botsBtn'); modeBtn = $('modeBtn'); presetBtn = $('presetBtn'); pauseFloat = $('pauseFloat');
    optBtn = $('optBtn'); optionsPanel = $('options');
    optLives = $('optLives'); optSpeed = $('optSpeed'); optPu = $('optPu'); optAccel = $('optAccel');
    optWin = $('optWin'); optSudden = $('optSudden'); optServe = $('optServe'); optHandi = $('optHandi');
    optTarRow = $('optTarRow'); optTar = $('optTar'); optTarLbl = $('optTarLbl'); optNeg = $('optNeg'); optBot = $('optBot'); optStyle = $('optStyle'); optBump = $('optBump');
    lbBtn = $('lbBtn'); lbPanel = $('lbpanel'); voteBtn = $('voteBtn'); histPreset = $('histPreset'); histMode = $('histMode');

    startBtn.onclick = () => { unlockAudio(); send({ t: 'start' }); };
    pauseBtn.onclick = () => send({ t: 'pause' });
    pauseFloat.onclick = () => send({ t: 'pause' });
    botsBtn.onclick = () => send({ t: 'bots' });
    modeBtn.onclick = () => send({ t: 'mode' });
    presetBtn.onclick = () => send({ t: 'preset' });
    if (premiere) cv.addEventListener('click', () => { unlockAudio(); if (snap && snap.gs !== 'play' && snap.gs !== 'paused') send({ t: 'start' }); });
    optBtn.onclick = () => togglePanel(optionsPanel);
    { const puBtn = $('puBtn'), puPanel = $('puhelp'); if (puBtn && puPanel) puBtn.onclick = () => togglePanel(puPanel); }
    $('optLivesMinus').onclick = () => send({ t: 'opt', op: 'lives', d: -1 });
    $('optLivesPlus').onclick = () => send({ t: 'opt', op: 'lives', d: 1 });
    optSpeed.onclick = () => send({ t: 'opt', op: 'speed' });
    optPu.onchange = () => send({ t: 'opt', op: 'pu' });
    optAccel.onchange = () => send({ t: 'opt', op: 'accel' });
    optWin.onclick = () => send({ t: 'opt', op: 'winmode' });
    optSudden.onclick = () => send({ t: 'opt', op: 'sudden' });
    optServe.onclick = () => send({ t: 'opt', op: 'serve' });
    optHandi.onchange = () => send({ t: 'opt', op: 'handicap' });
    $('optTarMinus').onclick = () => send({ t: 'opt', op: curWinMode === 'kills' ? 'ktar' : 'rtar', d: -1 });
    $('optTarPlus').onclick = () => send({ t: 'opt', op: curWinMode === 'kills' ? 'ktar' : 'rtar', d: 1 });
    optNeg.onchange = () => send({ t: 'opt', op: 'negatives' });
    if (optBump) optBump.onchange = () => send({ t: 'opt', op: 'bumpers' });
    optBot.onclick = () => send({ t: 'opt', op: 'botdiff' });
    if (optStyle) optStyle.onclick = () => send({ t: 'opt', op: 'botstyle' });
    lbBtn.onclick = () => { togglePanel(lbPanel); renderLB(); renderHist(); };
    $('lbReset').onclick = () => { if (confirm('Réinitialiser le classement ?')) send({ t: 'lbreset' }); };
    voteBtn.onclick = () => send({ t: 'vote' });
    histPreset.onchange = renderHist; histMode.onchange = renderHist;
    if (premiere) $('endscreen').addEventListener('click', () => { unlockAudio(); send({ t: 'start' }); });
    if (premiere) { hold($('touchUp'), 'up'); hold($('touchDn'), 'dn'); }

    applyColors();                  // purge aussi les décors / sprites : ils appartiennent au contexte précédent
    resizeH = resizeCanvas;
    addEventListener('resize', resizeH); resizeCanvas();
    addEventListener('keydown', onKeyDown); addEventListener('keyup', onKeyUp); addEventListener('blur', onBlur);
    music.start();
    rafId = requestAnimationFrame(drawLoop);
  }
  function onA11y() { applyColors(); }
  function teardown() {
    destroyed = true; cancelAnimationFrame(rafId); music.stop();
    J.fin(); flashes.vider(); sdAcc = 0;   // singleton : un retour en cours de manche ne doit pas prolonger l'ancien journal
    removeEventListener('resize', resizeH); removeEventListener('keydown', onKeyDown); removeEventListener('keyup', onKeyUp); removeEventListener('blur', onBlur);
  }

  // Joystick tactile (public/joystick.js) : la poussée est PROJETÉE sur le bord du joueur, à l'écran.
  // Dès 3 joueurs les bords sont inclinés et « haut/bas » n'y veut plus rien dire ; pousser le stick
  // dans le sens où l'on veut voir filer sa raquette marche, lui, sur tous les bords.
  // Même règle de sens que le serveur (humanMove) : `up` = vers le haut sur un bord plutôt vertical,
  // vers la gauche sur un bord plutôt horizontal. Le repère recadré (geoFit) est une homothétie :
  // la tangente du bord est la même à l'écran que dans le monde.
  // `actuel` = bouton déjà enfoncé : on le garde jusqu'à 0,22 (hystérésis, cf. joystick.js), on n'en
  // enfonce un nouveau qu'à partir de 0,3 — sinon un pouce posé sur le seuil bascule à chaque touchmove.
  function joy(dx, dy, actuel) {
    const me = snap && mySeat >= 0 ? snap.players[mySeat] : null;
    const e = me && me.edge >= 0 && snap.geo ? snap.geo.edges[me.edge] : null;
    const proj = e ? dx * e.tx + dy * e.ty : dy;       // > 0 : vers +pos le long du bord (sans bord : axe vertical)
    const sign = e ? (((Math.abs(e.ty) >= Math.abs(e.tx)) ? e.ty > 0 : e.tx > 0) ? 1 : -1) : 1;
    const cand = (proj > 0 ? 1 : -1) * sign < 0 ? 'touchUp' : 'touchDn';
    return Math.abs(proj) < (cand === actuel ? 0.22 : 0.3) ? null : cand;
  }
  return { init, onState, onMessage, onLb, onA11y, teardown, joy };
})();
