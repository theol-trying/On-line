// Module client TANKS v3 : arène destructible, power-ups, mines, collision, FFA/équipes, manches.
// Identité « Désert militaire » portée au niveau du Sumo : sable à dunes éclairées pré-rendu, caisses en bois
// et plaques d'acier rivetées en sprites, chars détaillés (chenilles qui défilent, tourelle, recul, flamme de
// bouche), traçantes, explosions feu + fumée + débris, cratères et traces persistants, ambiance (vent de sable,
// ombres de nuages, vautour), écrans titre / compte à rebours / pause thématisés, sons et musique synthétisés.
import { ARENA as ARENA0, TANK_R, SHELL_R, BLK, G as G0 } from './shared.js';
import { createMusic } from '../../music.js';
import { seatPattern, SEAT_GLYPH } from '../../patterns.js';
import { initGameMsg, msgPerso, msgGlobal } from '../../gamemsg.js';
import { arenaSize } from '../../layout.js';   // taille du plateau : commune à tous les jeux (mode plein écran compris)
// couche partagée : avatar sur la trappe de tourelle, lueurs au sol, crépuscule de fin de manche, écran de fin enrichi
import { dessinerAvatar } from '../../avatar-sprite.js';
import { lumiere, creerLumieres } from '../../lumiere.js';
import { crepuscule } from '../../crepuscule.js';
import { creerJournal, blocFin } from '../../finpartie.js';
// arène dimensionnée au nombre de participants : la taille des BLOCS ne bouge pas (BLK), c'est le NOMBRE
// de blocs qui augmente (15 / 17 / 19). Le serveur envoie `ag` (côté de la grille) et le client se recale.
let G = G0, ARENA = ARENA0;

// musique : désert militaire — bourdon grave, luth pincé en mode phrygien dominant (0,1,4,5,7,8,10),
// caisse claire de marche + ostinato de basse en jeu ; climax (1 vie / duel final) = cuivres + roulements, tempo.
const MUSIC_THEME = { bpm: 100, bpmBoost: 14, vol: 0.55, root: 73.42, len: 32,
  stingers: { kill: { notes: [0, -5, -7], wave: 'sawtooth', oct: 0, gain: 0.05, dur: 0.28, rate: 0.11 },
    win: { base: 261.63, notes: [[0, 7], [0, 7], [4, 12], [7, 12, 16], [12, 16, 19]], gain: 0.034, dur: 0.3, rate: 0.14 },   // fanfare de clairon
    count: { notes: [7], oct: 2, wave: 'square', dur: 0.08, gain: 0.028, duck: false }, go: { notes: [[0, 7, 12]], oct: 1, wave: 'sawtooth', dur: 0.45, gain: 0.045, duck: false },
    alert: { notes: [0, 1, 0, 1], oct: 1, wave: 'square', rate: 0.09, dur: 0.08, gain: 0.03 } },
  layers: [
  { seq: [[0, 7], null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, [1, 8], null, null, null, null, null, null, null, null, null, null, null, null, null, null, null], wave: 'sawtooth', gain: 0.016, dur: 14 },
  { seq: [12, null, 13, null, 16, null, null, 13, 12, null, null, null, 8, null, 7, null, 12, null, 13, null, 16, null, 17, 16, 13, null, 12, null, null, null, null, null], oct: 1, wave: 'triangle', gain: 0.016, dur: 0.7 },   // luth pincé
  { drums: 'K...S.SSK...S...K...S.SSK.K.S.SS', gain: 0.8, min: 1 },                                                            // caisse claire de marche
  { drums: '..H...H...H...H...H...H...H.H.H.', gain: 0.5, min: 1 },
  { seq: [0, null, null, 0, null, null, 1, null, 0, null, null, 0, null, null, -2, null, 0, null, null, 0, null, null, 1, null, 4, null, 1, null, 0, null, -2, null], wave: 'sawtooth', gain: 0.02, dur: 1.4, min: 1 },   // ostinato de basse
  { seq: [0, null, null, null, 4, null, 5, null, 7, null, null, null, 8, null, 7, null, 5, null, 4, null, 1, null, null, null, 0, null, null, null, null, null, null, null], oct: 1, wave: 'sawtooth', gain: 0.014, dur: 3, min: 2 },   // cuivres
  { drums: 'SSSSK.S.SSSSK.S.SSSSK.S.S.S.SSSS', gain: 0.45, min: 2 },                                                           // roulements
] };

// Couleurs des sièges. Au-delà de 8 il n'existe plus de teintes toutes distinguables entre elles :
// c'est le MOTIF par siège (patterns.js) qui porte l'identification, la couleur n'est qu'un renfort.
const PAL = { normal: ['#4a9ee0', '#e06240', '#2aaf7a', '#cc9010', '#9b6cf0', '#e268b0', '#25c9c0', '#9ec93a', '#d06ef0', '#f2f0e6'],
              cb: ['#0072B2', '#E69F00', '#009E73', '#F0E442', '#CC79A7', '#56B4E9', '#D55E00', '#F5F5F5', '#7B68EE', '#9A9A9A'] };
const TEAMPAL = { normal: ['#4a9ee0', '#e06240', '#2aaf7a', '#cc9010', '#9b6cf0'], cb: ['#0072B2', '#E69F00', '#009E73', '#F0E442', '#CC79A7'] };
const TEAM_LETTER = ['A', 'B', 'C', 'D', 'E'];
const MODE_NAME = { ffa: 'Chacun pour soi', '2v2': '2 v 2', '2v2v2': '2 v 2 v 2', '3v3': '3 v 3', '4v4': '4 v 4', '2v2v2v2': '2 v 2 v 2 v 2', '3v3v3': '3 v 3 v 3', '5v5': '5 v 5', '2v2v2v2v2': '2 v 2 v 2 v 2 v 2' };
const MAX_SEATS = 8;            // Tanks plafonne à 8 sièges (aligné sur le serveur) : nombre de cartes du HUD
const GEN_NAMES = ['Symétrique', 'Aléatoire', '4 coins'];
const TICK_HZ = 30;
const MAX_SHELLS = 2, MINE_R = 30, EMP_R = BLK * 4, BARREL_DMG_R = BLK * 1.25;   // repères visuels calqués sur le serveur (lecture seule)
// `i` = glyphe des messages DOM et des cartes (texte net, police du système) ; au canvas, chaque bonus est
// un PICTOGRAMME vectoriel (drawPU) qui reprend la même idée — les emoji et glyphes varient d'un OS à l'autre.
const PU = { rapid: { i: '»', c: '#9fe6ff' }, triple: { i: '⋔', c: '#ffd76b' }, shield: { i: '⛉', c: '#7fd1ff' }, speed: { i: '👟', c: '#7ff0bd' }, pierce: { i: '➳', c: '#ff9be0' }, mine: { i: '◈', c: '#ff8e6e' }, repair: { i: '🔧', c: '#7ff0bd' }, emp: { i: '⚡', c: '#9fe6ff' }, homing: { i: '🚀', c: '#ff7a7a' }, camo: { i: '👁', c: '#b9a6ff' }, radar: { i: '📡', c: '#7ff0bd' } };
// Retour de test : « les icônes ne sont pas forcément claires ». Chaque ramassage se DIT donc, avec
// l'effet et non le nom du bonus. Les libellés reprennent le panneau d'aide (❔ Power-ups) en plus court.
// `g: 1` = l'effet déborde sur les autres tanks -> message global (tout le monde doit comprendre ce qui
// vient de changer) ; sans `g`, c'est de l'équipement personnel -> message visible du seul ramasseur.
const PU_MSG = {
  rapid:  { t: 'Tir rapide : cadence doublée' },
  triple: { t: 'Tir triple : 3 obus' },
  shield: { t: 'Bouclier : encaisse un tir' },
  speed:  { t: 'Vitesse : tank plus rapide' },
  pierce: { t: 'Obus perçant : traverse un mur' },
  mine:   { t: 'Mine prête : E ou ◈' },
  repair: { t: 'Réparation : +1 vie' },
  emp:    { t: 'EMP : tanks proches étourdis', g: 1 },   // frappe les ennemis alentour : ils subissent sans rien ramasser
  homing: { t: 'Missile guidé : suit l\'ennemi' },
  camo:   { t: 'Camouflage : un tank invisible', g: 1 }, // un tank disparaît de TOUS les écrans : sans message, on croit à un bug
  radar:  { t: 'Radar : révèle les camouflés' },
};
// Identité « Désert » : palette fixe (le sélecteur de thème Néon/CRT/Clair ne s'applique pas ici).
// Le sable reste SOMBRE (crépuscule) : les chars aux couleurs vives et les obus clairs doivent claquer dessus.
const K = { ink: '#17130a', sand: '#e6cf98', gold: '#e0a92e', goldHi: '#f6de9d', goldLo: '#a87218', bg: '#14100a' };
const SAND_LO = [48, 38, 22], SAND_HI = [100, 82, 51];
const WOOD = ['122,86,44', '158,116,64', '92,62,30'], METAL = ['120,116,106', '84,80,72', '160,156,146'];
const WIND_X = 0.2, WIND_Y = 0.06;                        // vent d'ouest : fumées, sable et nuages dérivent vers l'est
const MAXP = 420;                                         // plafond de particules (tous effets confondus)
const TITLE_FONT = '"Black Ops One",Impact,sans-serif';   // police Google chargée par la page (repli système)
// fond animé : volutes de sable portées par le vent (identité désert) — coupées par reduceFx
const AMB_WISP = Array.from({ length: 16 }, () => ({ y: Math.random(), v: 16 + Math.random() * 30, ph: Math.random() * 6.28, l: 8 + Math.random() * 16, a: 4 + Math.random() * 10 }));
const INTERP_MS = 55;
// Crépuscule : Tanks n'a pas de mort subite côté serveur -> la nuit tombe d'après le temps de manche écoulé
// (mesuré côté client, pauses exclues) : rien avant 60 s, nuit « pleine » (plafonnée par crepuscule.js) à 150 s.
const DUSK_T0 = 60, DUSK_LEN = 90;
const STREAK_MS = 5000;                                   // deux chars détruits en moins de 5 s = doublé
const SHELL_MATCH2 = 32 * 32;                             // appariement d'un obus d'un état à l'autre (6,5 px/tick)
const KEYMAP = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'fwd', KeyW: 'fwd', ArrowDown: 'back', KeyS: 'back' };

function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function hexRgb(h) { const n = parseInt(String(h).slice(1, 7), 16) || 0; return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function rgbStr(c, a) { return a == null ? `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})` : `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`; }
function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }   // mulberry32 : décor identique d'un rendu à l'autre
function hash2(a, b) { const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return x - Math.floor(x); }
// ellipse maison (scale + arc) : ctx.ellipse est absent/instable sur les vieux Safari
function oval(g, x, y, rx, ry) { g.save(); g.translate(x, y); g.scale(rx, ry); g.moveTo(1, 0); g.arc(0, 0, 1, 0, Math.PI * 2); g.restore(); }
// rectangle à coins arrondis (tracé seul) : pas de ctx.roundRect sur les vieux Safari
function rr(g, x, y, w, h, r) {
  g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r);
  g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r);
  g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y); g.closePath();
}
function starPath(g, x, y, r) { g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, q = i % 2 ? r * 0.42 : r; g.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q); } g.closePath(); }
// biseau d'une plaque : arêtes haut/gauche éclairées, bas/droite dans l'ombre (lumière du haut-gauche)
function bevel(g, x, y, w, h, b, light, dark) {
  const poly = (pts, col) => { g.beginPath(); g.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); g.closePath(); g.fillStyle = col; g.fill(); };
  poly([x, y, x + w, y, x + w - b, y + b, x + b, y + b], light);
  poly([x, y, x + b, y + b, x + b, y + h - b, x, y + h], light);
  poly([x, y + h, x + b, y + h - b, x + w - b, y + h - b, x + w, y + h], dark);
  poly([x + w, y, x + w, y + h, x + w - b, y + h - b, x + w - b, y + b], dark);
}
const rgbMemo = {};
function rgbOf(hex) { return rgbMemo[hex] || (rgbMemo[hex] = hexRgb(hex).join(',')); }

export default (function () {
  let A, send, root, cv, ctx, togglePanel = () => {}, closePanels = () => {};
  let CC = PAL.normal, TEAMCC = TEAMPAL.normal, FX = 1;
  let mySeat = -1, snap = null, prevGs = 'lobby', teamMode = false, endShown = false, inGamePrev = false;
  let board = [], buf = [];
  let prevRound = -1, lastCount = -1, prevMyLives = -1, wallSnd = 0, overAt = 0;
  let gridBefore = null, minesBefore = null, mudSet = new Set(), mudKey = '';
  const parts = [], rings = [], scorch = [], prints = [], wrecks = [];   // effets ; cratères (manche) ; empreintes de chenilles ; épaves qui brûlent
  const recoil = {}, tread = {};                                         // siège -> heure du dernier tir ; siège -> odomètre des chenilles
  let scorchVer = 0;
  const LUM = creerLumieres(24);                        // flashs de lumière au sol (départs de tir, impacts, explosions, EMP)
  const J = creerJournal();                             // journal de manche : vies par siège + moments marquants (écran de fin)
  let roundMs = 0, lastPlayT = 0, livesKey = '', prevShells = null;
  let msgKilled = {}, msgBarrels = [];                  // contexte du message réseau en cours (destructions déjà comptées, barils sautés)
  const streak = {};                                    // siège -> heures de ses dernières destructions (doublé, triplé…)
  let shakeMag = 0, rafId = 0, destroyed = false, resizeH = null, actx = null, noiseBuf = null, lastFrame = 0;
  const music = createMusic(() => actx, () => A, MUSIC_THEME);
  const input = { left: false, right: false, fwd: false, back: false, fire: false };
  let hud, cards, startBtn, pauseBtn, modeBtn, botsBtn, diffBtn, arenaBtn, winBtn, ffBtn, pauseFloat, lbBtn, lbPanel, lbBody, endEl;
  const DIFF_NAMES = ['Facile', 'Normale', 'Difficile'];

  const $ = id => root.querySelector('#' + id);
  const colSeat = s => { if (s < 0 || !snap) return '#fff'; const p = snap.players[s]; return teamMode && p ? TEAMCC[p.team % TEAMCC.length] : CC[s % CC.length]; };
  const nameOf = p => p.name || ('P' + (p.seat + 1));
  function applyColors() { CC = PAL[A.palette] || PAL.normal; TEAMCC = TEAMPAL[A.palette] || TEAMPAL.normal; FX = A.reduceFx ? 0 : 1; groundKey = ''; blockKey = ''; }

  function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const size = arenaSize({ max: 760 });
    cv.style.width = size + 'px'; cv.style.height = size + 'px'; cv.width = Math.round(size * dpr); cv.height = Math.round(size * dpr);
  }

  // 👁 Camouflage : le tank disparaît VRAIMENT de l'écran des adversaires (il était affiché à 10 % d'opacité,
  // donc encore repérable). Restent seuls à le voir : lui-même, ses coéquipiers, et le porteur du 📡 radar.
  // Tout ce qui vient DU tank (caisse, flamme de bouche, fumée d'échappement, barre de vie, halos) suit cette règle.
  function hiddenFor(p) {
    if (!p || !p.camo || p.seat === mySeat || !snap) return false;
    const me = mySeat >= 0 ? snap.players[mySeat] : null, myRadar = !!(me && me.radar);
    const enemy = !teamMode || (me && p.team !== me.team);
    return !!(enemy && !myRadar);
  }

  // ───────────────────────── HUD, classement, écran de fin ─────────────────────────
  function refreshHUD() {
    if (!snap) return;
    snap.players.forEach((p, i) => {
      if (!cards[i]) return;
      const shown = p.connected || p.playing;
      cards[i].classList.toggle('hidden', !shown);
      if (!shown) return;
      const col = colSeat(i);
      cards[i].style.color = col; cards[i].classList.toggle('dead', p.playing && !p.alive); cards[i].classList.toggle('me', i === mySeat);
      const tags = [];
      if (teamMode) tags.push(`<span class="badge" style="background:${col}28;color:${col}">ÉQ.${TEAM_LETTER[p.team] || '?'}</span>`);
      if (p.bot) tags.push(`<span class="badge" style="background:${col}28;color:${col}">BOT</span>`);
      else if (i === mySeat) tags.push(`<span class="badge" style="background:${col}28;color:${col}">VOUS</span>`);
      const gly = `<span style="opacity:.7;font-size:.9em" title="motif du siège">${SEAT_GLYPH[i % SEAT_GLYPH.length]}</span>`;   // rappel du motif peint sur la caisse (constante : aucune donnée réseau injectée)
      cards[i].querySelector('.pn').innerHTML = `${(window.__AV && window.__AV(p.name)) || ''}${esc(p.name || ('P' + (i + 1)))} ${gly} <span class="sc">🏆${p.score | 0} · ${p.kills | 0}⚡</span> ${tags.join('')}`;
      const lv = cards[i].querySelector('.lv'); lv.style.color = col;
      const counts = [p.shield ? '⛉' + p.shield : '', p.mineN ? '◈' + p.mineN : ''].filter(Boolean).join(' ');
      const bars = (p.buffs || []).map(([k, fr]) => { const d = PU[k] || { i: '?', c: '#fff' }, pct = Math.max(0, Math.min(100, Math.round(fr * 100))); return `<span class="buff" style="background:linear-gradient(90deg,${d.c} ${pct}%,rgba(255,255,255,.12) ${pct}%);border-color:${d.c}66">${d.i}</span>`; }).join('');
      lv.innerHTML = p.playing ? (p.alive ? ('❤'.repeat(Math.max(0, p.lives | 0)) + (counts ? ' · ' + counts : '') + (p.emp ? ' ⚡' : '') + (bars ? ' ' + bars : '')) : '✖ détruit') : 'prêt';
    });
  }
  function renderLB() {
    if (!lbBody) return;
    if (!board.length) { lbBody.innerHTML = '<div class="lbnote">Aucune partie enregistrée.</div>'; return; }
    const B = board.map(e => ({ ...e, kd: e.deaths ? (e.kills || 0) / e.deaths : (e.kills || 0) }));
    lbBody.innerHTML = B.sort((a, b) => (b.wins || 0) - (a.wins || 0) || b.kd - a.kd).map(e =>
      `<div class="lbrow"><span class="lbn">${esc(e.name)}</span><span title="combats">🎮${e.games || 0}</span><span title="victoires">🏆${e.wins || 0}</span><span title="chars détruits">⚡${e.kills || 0}</span><span title="touches">🎯${e.dmg || 0}</span><span title="K/D">⚖${(e.deaths ? ((e.kills || 0) / e.deaths).toFixed(2) : (e.kills ? '∞' : '0'))}</span></div>`).join('');
  }
  function showEndscreen(m) {
    if (m.gs !== 'over' || !m.stats) { endEl.classList.add('hidden'); return; }
    endEl.classList.remove('hidden');
    const isMatch = m.stats.match;
    const ps = m.players.filter(p => p.playing && p.place > 0).slice().sort((a, b) => a.place - b.place);
    const champ = m.winner >= 0 ? ps.find(p => p.team === m.winner) : null;
    const who = champ ? (teamMode ? 'Équipe ' + TEAM_LETTER[m.winner] : esc(nameOf(champ))) : null;
    const title = champ ? (isMatch ? '🏆 ' + who + ' REMPORTE LE MATCH' : who + ' gagne la manche') : 'Égalité — aucun survivant';
    const medals = ['🥇', '🥈', '🥉'];
    // As du canon : le plus de chars détruits, départage aux touches puis au classement (≥ 1 destruction)
    let mvp = null; ps.forEach(p => { if ((p.kills | 0) > 0 && (!mvp || p.kills > mvp.kills || (p.kills === mvp.kills && ((p.dmg | 0) > (mvp.dmg | 0) || ((p.dmg | 0) === (mvp.dmg | 0) && p.place < mvp.place))))) mvp = p; });
    const rows = ps.map(p => {
      const col = colSeat(p.seat), medal = medals[p.place - 1] || ('#' + p.place);
      const res = p.alive ? (teamMode ? 'survivant·e' : 'vainqueur') : `détruit à ${Math.round((p.elimTick || 0) / TICK_HZ)}s`;
      return `<div class="erow ${p.alive ? 'win' : ''}"><span class="eplace">${medal}</span>
        <span class="ename" style="color:${col}">${esc(nameOf(p))}${teamMode ? ` <small>Éq.${TEAM_LETTER[p.team]}</small>` : ''} <small>🏆${p.score | 0}</small>${mvp && mvp.seat === p.seat ? ' <small>⭐ As</small>' : ''}</span>
        <span class="estat" title="chars détruits">⚡ ${p.kills | 0}</span><span class="estat" title="touches">🎯 ${p.dmg | 0}</span><span class="eres">${res}</span></div>`;
    }).join('');
    const mvpLine = mvp ? `<div class="emeta">⭐ As du canon : <b style="color:${colSeat(mvp.seat)}">${esc(nameOf(mvp))}</b> — ${mvp.kills} char${mvp.kills > 1 ? 's' : ''} détruit${mvp.kills > 1 ? 's' : ''}, ${mvp.dmg | 0} touche${(mvp.dmg | 0) > 1 ? 's' : ''}</div>` : '';
    endEl.innerHTML = `<div class="etitle" style="color:${champ ? colSeat(champ.seat) : K.sand}">${title}</div>
      <div class="emeta">⏱ ${m.stats.durationSec}s · ${m.stats.nParts} équipages · objectif ${m.winTarget} manche(s)</div>${mvpLine}
      <div class="elist">${rows}</div>${finBloc(m)}<div class="ehint">Espace / clic pour rejouer</div>`;
  }
  // courbe des vies de la manche + meilleure action (finpartie.js échappe les noms et filtre les couleurs)
  function finBloc(m) {
    return blocFin(J, { titre: 'Vies au fil de la manche', couleur: s => colSeat(s), nom: s => { const p = m.players[s]; return p ? nameOf(p) : 'P' + (s + 1); } });
  }

  // ───────────────────────── état réseau ─────────────────────────
  function resetRound() {
    parts.length = 0; rings.length = 0; scorch.length = 0; prints.length = 0; wrecks.length = 0; scorchVer++;
    for (const k in tread) delete tread[k];
    for (const k in recoil) delete recoil[k];
    for (const k in streak) delete streak[k];
    LUM.vider(); roundMs = 0; lastPlayT = 0;
    J.fin(); prevShells = null;                         // nouvelle manche (ou retour après teardown) : le journal repart au prochain 'play'
  }
  // Obus ayant ricoché : le snapshot ne dit pas combien de rebonds un obus a faits. On apparie chaque obus
  // à celui de l'état précédent (même tireur, le plus proche) : une composante de vitesse qui change de signe
  // = rebond sur un mur. Les missiles guidés virent d'eux-mêmes : exclus.
  function markBounces(shells) {
    if (!shells) return;
    for (const s of shells) {
      let best = null, bd = SHELL_MATCH2;
      if (prevShells) for (const q of prevShells) { if (q.o !== s.o) continue; const d = (q.x - s.x) * (q.x - s.x) + (q.y - s.y) * (q.y - s.y); if (d < bd) { bd = d; best = q; } }
      s.__b = !!(best && (best.__b || (!s.h && ((best.vx || 0) * (s.vx || 0) < 0 || (best.vy || 0) * (s.vy || 0) < 0))));
    }
  }
  function lastShellOf(o, x, y, r2) {                   // l'obus (de l'état précédent) qui vient de disparaître en (x, y)
    let best = null, bd = r2 || SHELL_MATCH2;
    if (prevShells) for (const q of prevShells) { if (o >= 0 && q.o !== o) continue; const d = (q.x - x) * (q.x - x) + (q.y - y) * (q.y - y); if (d < bd) { bd = d; best = q; } }
    return best;
  }
  // Touche ennemie -> journal : destruction (plain, ricochet, baril, mine, à une vie), doublé/triplé, touche en ricochet.
  function noteHit(f, victim) {
    const by = f.by;
    if (!snap || !victim || !(by >= 0) || by === f.seat) return;
    const kp = snap.players[by]; if (!kp) return;
    if (teamMode && kp.team === victim.team) return;     // tir allié : pas un exploit
    const now = performance.now(), vn = nameOf(victim);
    const atBarrel = msgBarrels.some(b => b.x === f.x && b.y === f.y);
    const atMine = !atBarrel && !!(minesBefore && minesBefore.some(mm => mm.x === f.x && mm.y === f.y));
    const sh = atBarrel || atMine ? null : lastShellOf(by, f.x, f.y), rico = !!(sh && sh.__b);
    if (victim.alive) { if (rico) J.moment(now, by, 'a touché ' + vn + ' par ricochet', 4); return; }
    if (msgKilled[f.seat]) return; msgKilled[f.seat] = 1;
    let txt = 'a détruit ' + vn, w = 3;
    if (rico) { txt = 'a détruit ' + vn + ' par ricochet'; w = 6; }
    else if (atBarrel) { txt = 'a fait sauter ' + vn + ' avec un baril'; w = 5; }
    else if (atMine) { txt = 'a piégé ' + vn + ' avec une mine'; w = 5; }
    if (kp.alive && kp.lives === 1) { txt += ', à une seule vie'; w += 1; }
    J.moment(now, by, txt, w);
    const st = streak[by] || (streak[by] = []);
    st.push(now); while (st.length && now - st[0] > STREAK_MS) st.shift();
    if (st.length >= 2) J.moment(now, by, st.length === 2 ? 'a signé un doublé' : st.length === 3 ? 'a signé un triplé' : 'a détruit ' + st.length + ' chars en quelques secondes', 5 + st.length * 3);
  }
  function onMessage(m) { if (m && m.t === 'welcome') mySeat = m.seat; }
  function onLb(d) { board = (d && d.board) || []; renderLB(); }
  function onState(m) {
    if (m.ag && m.ag !== G) { G = m.ag; ARENA = G * BLK; }   // grille redimensionnée par le serveur : tout le rendu lit G / ARENA
    gridBefore = snap ? snap.grid : null;                    // grille AVANT les murs cassés de ce message : bois ou métal ?
    minesBefore = snap ? snap.mines : null;                  // mines AVANT : une explosion à leur place = mine (souffle de terre)
    prevShells = snap ? snap.shells : null;                  // obus AVANT : ricochets, obus qui vient de frapper
    markBounces(m.shells);
    if (m.grid === undefined && snap) m.grid = snap.grid;    // delta réseau : grille absente = inchangée
    const mk = (m.mud || []).join(',');
    if (mk !== mudKey) { mudKey = mk; mudSet = new Set(m.mud || []); }
    snap = m; teamMode = !!(m.mode && m.mode !== 'ffa');
    if (m.round !== prevRound) { prevRound = m.round; resetRound(); }   // nouvelle manche : terrain propre
    const inGame = m.gs === 'play' || m.gs === 'countdown' || m.gs === 'paused';
    if (inGame !== inGamePrev) { inGamePrev = inGame; document.body.classList.toggle('playing', inGame); resizeCanvas(); }
    document.body.classList.toggle('paused', m.gs === 'paused');
    if (m.gs === 'play' || m.gs === 'countdown') closePanels();
    buf.push({ t: performance.now(), s: m }); if (buf.length > 10) buf.shift();
    wallSnd = 0;
    const tNow = performance.now();
    // temps de manche écoulé (pauses exclues) : pilote le crépuscule
    if (m.gs === 'countdown' || m.gs === 'lobby') { roundMs = 0; lastPlayT = 0; }
    else if (m.gs === 'play') { if (lastPlayT) roundMs += Math.min(250, tNow - lastPlayT); lastPlayT = tNow; }
    else lastPlayT = 0;
    if (m.gs === 'play' && !J.actif()) { J.debut(tNow); livesKey = ''; }   // début de manche (ou arrivée en cours de manche)
    msgKilled = {}; msgBarrels = [];
    (m.fx || []).forEach(playFx);
    if (msgBarrels.length >= 2) {                            // chaîne de barils : attribuée au tireur de l'obus qui l'a déclenchée
      const b0 = msgBarrels[0], sh = lastShellOf(-1, b0.x, b0.y, 60 * 60);
      if (sh && m.players[sh.o]) J.moment(tNow, sh.o, 'a fait sauter ' + msgBarrels.length + ' barils en chaîne', 3 + msgBarrels.length);
    }
    if (J.actif()) {                                         // courbe : vies de chaque équipage (0 = détruit), à chaque changement
      const v = {}; let key = '';
      for (const p of m.players) if (p.playing) { v[p.seat] = p.alive ? (p.lives | 0) : 0; key += p.seat + ':' + v[p.seat] + ','; }
      if (m.gs === 'play' || m.gs === 'over') J.echantillon(tNow, v, key !== livesKey || m.gs === 'over');
      livesKey = key;
      if (m.gs === 'over' && m.winner >= 0) for (const p of m.players) if (p.playing && p.alive && p.team === m.winner && p.lives === 1) J.moment(tNow, p.seat, teamMode ? 'a tenu jusqu\'au bout avec une seule vie' : 'a gagné la manche avec une seule vie', 6);
      if (m.gs !== 'play' && m.gs !== 'paused') J.fin();
    }
    const me = mySeat >= 0 ? m.players[mySeat] : null;
    if (me && me.playing && me.alive && m.gs === 'play' && me.lives === 1 && prevMyLives > 1) music.sting('alert');   // dernière vie : alerte
    prevMyLives = me && me.playing && me.alive ? me.lives : -1;
    if (prevGs !== 'over' && m.gs === 'over') { sound('win'); music.sting('win'); overAt = performance.now(); }
    if (m.gs === 'countdown' && m.count > 0 && m.count !== lastCount) { music.sting('count'); sound('count'); }   // décompte 3·2·1 : bip radio
    if (prevGs === 'countdown' && m.gs === 'play') { music.sting('go'); sound('go'); }                            // « FEU ! » : salve
    lastCount = m.count;
    prevGs = m.gs;
    { let inten = 0;                                  // musique : 1 en jeu, 2 si un tank est à 1 vie ou duel final (parmi 3+)
      if (m.gs === 'play' || m.gs === 'countdown') { inten = 1; const tot = m.players.filter(p => p.playing).length, alive = m.players.filter(p => p.playing && p.alive); if ((tot >= 3 && alive.length <= 2) || alive.some(p => p.lives === 1)) inten = 2; }
      music.setIntensity(inten); }
    refreshHUD();
    if (m.gs === 'over') { if (!endShown) { showEndscreen(m); endShown = true; } } else { endShown = false; endEl.classList.add('hidden'); }
    const idle = m.gs === 'lobby' || m.gs === 'over';
    const total = (m.connected || 0) + (m.botCount || 0);
    startBtn.disabled = !(mySeat >= 0 && idle && m.connected >= 1 && total >= 2); startBtn.textContent = m.gs === 'over' ? '↻ Rejouer' : '▶ Démarrer';
    pauseBtn.disabled = !(m.gs === 'play' || m.gs === 'paused'); pauseBtn.textContent = m.gs === 'paused' ? '▶ Reprendre' : '⏸ Pause';
    pauseFloat.textContent = m.gs === 'paused' ? '▶' : '⏸';
    if (botsBtn) { botsBtn.disabled = !idle; botsBtn.textContent = '🤖 Bots : ' + (m.botCount || 0); botsBtn.classList.toggle('on', (m.botCount || 0) > 0); }
    if (diffBtn) { diffBtn.disabled = !idle; diffBtn.textContent = '🎯 IA : ' + (DIFF_NAMES[m.botDiff] || 'Normale'); }
    modeBtn.disabled = !(idle && (total === 4 || total === 6 || total === 8)); modeBtn.textContent = '⚔ ' + (MODE_NAME[m.mode] || m.mode); modeBtn.classList.toggle('on', teamMode);
    arenaBtn.disabled = !idle; arenaBtn.textContent = '🧱 ' + (GEN_NAMES[m.gen] || 'Arène');
    winBtn.disabled = !idle; winBtn.textContent = '🏁 ' + (m.winTarget === 1 ? '1 manche' : m.winTarget + ' manches');
    ffBtn.disabled = !(idle && teamMode); ffBtn.textContent = '🤝 Tir allié : ' + (m.ff ? 'ON' : 'OFF'); ffBtn.classList.toggle('on', !!m.ff);
  }

  // ───────────────────────── sons (WebAudio, zéro fichier) ─────────────────────────
  function unlockAudio() { if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch {} } if (actx && actx.state === 'suspended') actx.resume(); }
  let sndPan = 0;                                   // pan stéréo du prochain son (posé par psound)
  const vol = () => (A && typeof A.sfx === 'number') ? A.sfx : 1;
  function out(node) { if (sndPan && actx.createStereoPanner) { const pn = actx.createStereoPanner(); pn.pan.value = Math.max(-1, Math.min(1, sndPan)); pn.connect(actx.destination); node.connect(pn); } else node.connect(actx.destination); }
  function tone(f, d, ty = 'square', g = 0.05, dl = 0) { const v = vol(); if (!actx || v <= 0) return; const t0 = actx.currentTime + dl, o = actx.createOscillator(), gg = actx.createGain(); o.type = ty; o.frequency.setValueAtTime(f, t0); gg.gain.setValueAtTime(g * v, t0); gg.gain.exponentialRampToValueAtTime(0.0001, t0 + d); o.connect(gg); out(gg); o.start(t0); o.stop(t0 + d + 0.02); }
  function sweep(f0, f1, d, ty, g, dl = 0) { const v = vol(); if (!actx || v <= 0) return; const t0 = actx.currentTime + dl, o = actx.createOscillator(), gg = actx.createGain(); o.type = ty; o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(f1, t0 + d); gg.gain.setValueAtTime(g * v, t0); gg.gain.exponentialRampToValueAtTime(0.0001, t0 + d); o.connect(gg); out(gg); o.start(t0); o.stop(t0 + d + 0.02); }
  function noise(d, type, freq, g, dl = 0, q) {
    const v = vol(); if (!actx || v <= 0) return;
    if (!noiseBuf || noiseBuf.sampleRate !== actx.sampleRate) { const sr = actx.sampleRate, b = actx.createBuffer(1, Math.floor(sr * 1.5), sr), dd = b.getChannelData(0); for (let i = 0; i < dd.length; i++) dd[i] = Math.random() * 2 - 1; noiseBuf = b; }
    const t0 = actx.currentTime + dl, s = actx.createBufferSource(), f = actx.createBiquadFilter(), gg = actx.createGain();
    s.buffer = noiseBuf; f.type = type; f.frequency.value = freq; if (q) f.Q.value = q;
    gg.gain.setValueAtTime(0.0001, t0); gg.gain.exponentialRampToValueAtTime(g * v, t0 + Math.min(0.012, d * 0.2)); gg.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
    s.connect(f); f.connect(gg); out(gg); s.start(t0); s.stop(t0 + d + 0.02);
  }
  function cannon(f, dl = 0) { sweep(150, 42, 0.28, 'sine', 0.14 + 0.12 * f, dl); noise(0.2, 'lowpass', 900, 0.08 + 0.1 * f, dl); noise(0.03, 'highpass', 3200, 0.06, dl); }   // coup de canon : souffle grave + claquement
  function boom(f) {                                // explosion : grondement filtré + sous-grave qui plonge + crépitements
    noise(0.35 + 0.8 * f, 'lowpass', 650, 0.06 + 0.16 * f); sweep(80, 28, 0.6, 'sine', 0.2 * f);
    noise(0.05, 'highpass', 1800, 0.05, 0.12); noise(0.05, 'highpass', 1600, 0.04, 0.25); noise(0.06, 'highpass', 2000, 0.035, 0.38);
  }
  function psound(k, x, arg) { sndPan = Math.max(-1, Math.min(1, (x / ARENA - 0.5) * 1.7)); sound(k, arg); sndPan = 0; }   // son positionné gauche/droite
  function sound(k, arg) {
    if (!actx) return;
    if (k === 'shot') cannon(0.55);
    else if (k === 'hit') { tone(520, 0.12, 'triangle', 0.07); tone(787, 0.1, 'triangle', 0.05); tone(1240, 0.05, 'square', 0.018); noise(0.06, 'highpass', 2600, 0.08); }   // obus sur blindage : « clang »
    else if (k === 'shield') { sweep(500, 1500, 0.2, 'triangle', 0.06); tone(1900, 0.12, 'sine', 0.03, 0.08); }
    else if (k === 'boom') boom(arg == null ? 1 : arg);
    else if (k === 'barrel') { boom(1.25); noise(0.5, 'bandpass', 420, 0.1, 0.02, 0.7); }                        // + « whoosh » du carburant
    else if (k === 'wood') { noise(0.07, 'bandpass', 1400, 0.12, 0, 2); noise(0.12, 'bandpass', 700, 0.08, 0.03, 1.5); tone(180, 0.06, 'triangle', 0.05); }   // caisse qui éclate
    else if (k === 'metal') { tone(410, 0.22, 'triangle', 0.06); tone(655, 0.18, 'triangle', 0.04); noise(0.08, 'highpass', 3000, 0.07); }
    else if (k === 'pickup') { noise(0.02, 'highpass', 4000, 0.06); noise(0.02, 'highpass', 3600, 0.05, 0.05); tone(392, 0.1, 'triangle', 0.05, 0.02); tone(523.25, 0.18, 'triangle', 0.05, 0.1); }   // culasse + clairon
    else if (k === 'mineset') { noise(0.02, 'highpass', 3000, 0.08); noise(0.025, 'highpass', 2400, 0.06, 0.06); tone(90, 0.1, 'sine', 0.08, 0.02); }
    else if (k === 'emp') { sweep(1400, 120, 0.35, 'sawtooth', 0.04); noise(0.25, 'highpass', 5000, 0.04); }   // décharge électrique
    else if (k === 'count') tone(880, 0.09, 'sine', 0.07);
    else if (k === 'go') { cannon(1); tone(1320, 0.18, 'sine', 0.06, 0.02); }
    else if (k === 'win') { tone(392, 0.12, 'triangle', 0.06); tone(523.25, 0.12, 'triangle', 0.06, 0.12); tone(659.25, 0.14, 'triangle', 0.06, 0.24); tone(784, 0.5, 'triangle', 0.06, 0.42); }   // clairon
  }
  // Un power-up vient d'être ramassé : on annonce son EFFET. Jamais de nom de joueur (constantes seules).
  // Perso pour l'équipement (les autres n'ont pas à le savoir : ce serait du bruit), global quand l'effet
  // change la partie de tout le monde — la bande globale reste collée au bord, hors zone de jeu.
  function direPU(kind, seat) {
    const m = PU_MSG[kind]; if (!m || !m.t) return;       // `m.t` : garde-fou si `kind` tombe sur une clé du prototype
    const d = PU[kind] || { i: '?', c: '#fff' };
    if (m.g) msgGlobal(d.i, m.t, { color: d.c });
    else if (seat === mySeat) msgPerso(d.i, m.t, { color: d.c });
  }

  // ───────────────────────── particules et effets ponctuels ─────────────────────────
  // Une seule réserve plafonnée. pass 0 = au sol, sous les chars (poussière, éclats) ; pass 1 = fumée au-dessus ;
  // pass 2 = lumières additives (feu, étincelles, braises, éclairs) dessinées en « lighter » avec des sprites de lueur.
  const glowCache = {};
  function glow(rgb) {                                  // sprite de lueur pré-rendu (remplace shadowBlur, trop cher en boucle)
    let c = glowCache[rgb]; if (c) return c;
    c = glowCache[rgb] = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(' + rgb + ',1)'); gr.addColorStop(0.35, 'rgba(' + rgb + ',0.45)'); gr.addColorStop(1, 'rgba(' + rgb + ',0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return c;
  }
  function addP(k, pass, x, y, vx, vy, life, r, gr, col, a, dr) {
    const q = { k, pass, x, y, vx, vy, born: performance.now(), life, r, g: gr, col, a, dr: dr == null ? 0.93 : dr, rot: 0, vr: 0, w: 0, h: 0, fs: 'rgb(' + col + ')', gl: null };
    if (pass === 2) q.gl = glow(col);
    parts.push(q); if (parts.length > MAXP) parts.splice(0, parts.length - MAXP);
    return q;
  }
  const rnd = () => Math.random();
  function dustAt(x, y, n, spd, col, r0) { if (A.reduceFx) return; for (let k = 0; k < n; k++) { const a = rnd() * 6.283, sp = (0.3 + rnd()) * spd; addP('dust', 0, x, y, Math.cos(a) * sp, Math.sin(a) * sp, 420 + rnd() * 420, (r0 || 3) + rnd() * 3, 6, col || '184,156,108', 0.42); } }
  function smokeAt(x, y, n, col, r0, life, spd, dir) {
    if (A.reduceFx) return;
    for (let k = 0; k < n; k++) { const a = dir == null ? rnd() * 6.283 : dir + (rnd() - 0.5) * 0.9, sp = (0.3 + rnd()) * (spd || 0.6); addP('smoke', 1, x + (rnd() - 0.5) * 4, y + (rnd() - 0.5) * 4, Math.cos(a) * sp, Math.sin(a) * sp, life * (0.7 + rnd() * 0.6), r0 + rnd() * r0 * 0.6, r0 * 2.2, col, 0.5, 0.95); }
  }
  function sparksAt(x, y, n, spd, col, dir, spread) { if (A.reduceFx) return; for (let k = 0; k < n; k++) { const a = dir == null ? rnd() * 6.283 : dir + (rnd() - 0.5) * (spread || 1), sp = (0.4 + rnd()) * spd; addP('spark', 2, x, y, Math.cos(a) * sp, Math.sin(a) * sp, 160 + rnd() * 200, 1, 0, col || '255,220,150', 1, 0.9); } }
  function embersAt(x, y, n, spd, col) { if (A.reduceFx) return; for (let k = 0; k < n; k++) { const a = rnd() * 6.283, sp = (0.3 + rnd()) * spd; addP('ember', 2, x, y, Math.cos(a) * sp, Math.sin(a) * sp, 380 + rnd() * 480, 2.2 + rnd() * 2, 0, col || '255,170,70', 1, 0.94); } }
  function fireAt(x, y, n, r0) { if (A.reduceFx) return; for (let k = 0; k < n; k++) { const a = rnd() * 6.283, sp = rnd() * 1.2; addP('fire', 2, x + Math.cos(a) * r0 * 0.3, y + Math.sin(a) * r0 * 0.3, Math.cos(a) * sp, Math.sin(a) * sp, 360 + rnd() * 320, r0 * (0.7 + rnd() * 0.6), 0, '255,160,60', 1, 0.9); } }
  function flashAt(x, y, r, life) { if (A.reduceFx) return; addP('flash', 2, x, y, 0, 0, life, r, 0, '255,240,200', 1, 1); }
  function debrisAt(x, y, n, spd, cols, w, h) {
    if (A.reduceFx) return;
    for (let k = 0; k < n; k++) { const a = rnd() * 6.283, sp = (0.4 + rnd()) * spd, q = addP('debris', 0, x, y, Math.cos(a) * sp, Math.sin(a) * sp, 700 + rnd() * 600, 1, 0, cols[(rnd() * cols.length) | 0], 1, 0.9); q.w = (w || 3) * (0.6 + rnd() * 0.8); q.h = (h || 2) * (0.7 + rnd() * 0.6); q.rot = rnd() * 6.283; q.vr = (rnd() - 0.5) * 0.5; }
  }
  function ringAt(x, y, r0, r1, life, col, lw, delay) { if (A.reduceFx) return; rings.push({ x, y, r0, r1, born: performance.now() + (delay || 0), life, col: 'rgb(' + col + ')', lw }); if (rings.length > 40) rings.shift(); }
  function addScorch(x, y, r, kind) { scorch.push({ x, y, r, kind, seed: (Math.random() * 1e9) | 0 }); if (scorch.length > 48) scorch.shift(); scorchVer++; }
  function wreckAt(x, y, life) { if (A.reduceFx) return; wrecks.push({ x, y, born: performance.now(), life, s: Math.random() * 6 }); if (wrecks.length > 8) wrecks.shift(); }
  // explosion complète : éclair, boule de feu, fumée noire, braises, étincelles, débris, onde de choc
  function explosion(x, y, s, col, barrel) {
    if (A.reduceFx) return;
    flashAt(x, y, 30 * s, 140);
    fireAt(x, y, Math.round((barrel ? 9 : 6) * s), 11 * s);
    smokeAt(x, y, Math.round((barrel ? 12 : 8) * s), barrel ? '30,26,22' : '62,58,52', 6 * s, 1600, 1.1 * s);
    embersAt(x, y, Math.round(12 * s), 3.2 * s);
    sparksAt(x, y, Math.round(8 * s), 5 * s, '255,214,140');
    debrisAt(x, y, Math.round(7 * s), 3.4 * s, col ? [rgbOf(col), '40,38,34', '70,66,58'] : METAL, 3.4, 2.2);
    ringAt(x, y, 6, 52 * s, 380, '255,236,200', 2 + 3 * s);
    if (barrel) ringAt(x, y, 4, BARREL_DMG_R, 460, '255,140,60', 3, 60);   // rayon réel des dégâts du baril
  }
  function playFx(f) {
    if (!f) return;
    const now = performance.now(), fx = !A.reduceFx, t = f.type;
    const tp = snap && f.seat != null && f.seat >= 0 ? snap.players[f.seat] : null, hid = !!(tp && hiddenFor(tp));
    if (t === 'shot') {
      psound('shot', f.x);
      if (hid || !tp) return;                        // camouflé : ni flamme ni recul ni fumée (son obus, lui, reste visible)
      recoil[f.seat] = now;                          // recul du canon + flamme de bouche, dessinés SUR le char (alignés sur son image)
      if (!fx) return;
      const a = tp.angle || 0, mx = f.x + Math.cos(a) * TANK_R * 2, my = f.y + Math.sin(a) * TANK_R * 2;
      smokeAt(mx, my, 3, '150,140,120', 3, 700, 0.7, a);
      sparksAt(mx, my, 3, 3, '255,220,150', a, 0.5);
      LUM.ajouter(mx, my, 60, '#ffc877', 170, 0.6);   // départ de tir : le sable s'éclaire devant la bouche
      return;
    }
    if (t === 'hit') {
      psound('hit', f.x);
      if (f.seat === mySeat) shakeMag = Math.max(shakeMag, 5);
      noteHit(f, tp);                                // journal de fin : tenu même en « réduire les effets »
      if (!fx) return;
      if (!hid) LUM.ajouter(f.x, f.y, 44, '#ffd9a0', 220, 0.5);   // camouflé : aucune lueur à sa position
      sparksAt(f.x, f.y, hid ? 4 : 10, 4, '255,226,160'); flashAt(f.x, f.y, 12, 90);
      if (!hid) { debrisAt(f.x, f.y, 4, 2.4, METAL, 2.4, 1.6); smokeAt(f.x, f.y, 2, '90,86,80', 3, 600, 0.4); }
      return;
    }
    if (t === 'shield') {
      psound('shield', f.x);
      if (f.seat === mySeat) msgPerso(PU.shield.i, 'Bouclier : tir encaissé', { color: PU.shield.c });   // explique ce que le ⛉ vient d'absorber
      if (!fx || hid) return;
      ringAt(f.x, f.y, TANK_R, TANK_R + 20, 360, '127,209,255', 3); sparksAt(f.x, f.y, 8, 3, '180,235,255');
      LUM.ajouter(f.x, f.y, 46, '#7fd1ff', 300, 0.45);
      return;
    }
    if (t === 'wall') {                              // mur cassé : cratère persistant + éclats (planches ou tôles)
      const idx = f.y * G + f.x, metal = !!(gridBefore && gridBefore.charAt(idx) === '1');
      const cx0 = (f.x + 0.5) * BLK, cy0 = (f.y + 0.5) * BLK;
      addScorch(cx0, cy0, BLK * 0.55, metal ? 'metal' : 'wall');
      if (wallSnd < 2) { wallSnd++; psound(metal ? 'metal' : 'wood', cx0); }   // une chaîne de barils casse 5 murs d'un coup : 2 sons suffisent
      if (!fx) return;
      if (metal) { sparksAt(cx0, cy0, 12, 4.5, '255,210,140'); debrisAt(cx0, cy0, 8, 3, METAL, 3.5, 2); flashAt(cx0, cy0, 22, 120); LUM.ajouter(cx0, cy0, 52, '#ffd08a', 220, 0.45); }
      else { debrisAt(cx0, cy0, 10, 2.8, WOOD, 5, 1.6); dustAt(cx0, cy0, 8, 1.4, '170,140,96', 5); }
      smokeAt(cx0, cy0, 3, '120,108,90', 5, 900, 0.5);
      return;
    }
    if (t === 'pickup') {
      psound('pickup', f.x); direPU(f.kind, f.seat);
      if (!fx) return;
      const d = PU[f.kind], rgb = d && d.c ? rgbOf(d.c) : '255,255,255';
      ringAt(f.x, f.y, 8, 30, 400, rgb, 3); embersAt(f.x, f.y, 8, 1.6, rgb);
      if (!hid) LUM.ajouter(f.x, f.y, f.kind === 'emp' ? EMP_R : 42, d && d.c ? d.c : '#ffffff', f.kind === 'emp' ? 650 : 380, f.kind === 'emp' ? 0.5 : 0.35);   // décharge EMP : tout le rayon s'illumine
      if (f.kind === 'emp') { ringAt(f.x, f.y, 12, EMP_R, 560, '159,230,255', 5); ringAt(f.x, f.y, 8, EMP_R * 0.9, 560, '230,250,255', 2, 80); }   // portée réelle de l'EMP
      else if (f.kind === 'radar') ringAt(f.x, f.y, 10, BLK * 3.2, 700, '127,240,189', 2);
      return;
    }
    if (t === 'mineset') { psound('mineset', f.x); if (fx) dustAt(f.x, f.y, 4, 0.8); return; }
    if (t === 'emp') {                               // victime d'un EMP : elle seule a besoin de savoir pourquoi elle est bloquée
      psound('emp', f.x);
      if (f.seat === mySeat) msgPerso(PU.emp.i, 'Étourdi : ni tir ni marche', { bad: true });
      if (!fx || hid) return;
      ringAt(f.x, f.y, 4, TANK_R + 16, 300, '159,230,255', 2.5); sparksAt(f.x, f.y, 8, 3, '190,240,255');
      LUM.ajouter(f.x, f.y, 40, '#bff3ff', 300, 0.45);
      return;
    }
    if (t === 'barrel') {                            // baril : boule de feu orange, fumée noire huileuse, flammes au sol
      psound('barrel', f.x); addScorch(f.x, f.y, 30, 'barrel');
      msgBarrels.push(f);                            // journal : chaîne de barils, destruction « avec un baril »
      if (!fx) return;
      shakeMag = Math.max(shakeMag, 9); explosion(f.x, f.y, 1.25, null, true); wreckAt(f.x, f.y, 3500);
      LUM.ajouter(f.x, f.y, 170, '#ff8a3a', 1000, 0.9); LUM.ajouter(f.x, f.y, 70, '#fff0d0', 200, 0.8);
      return;
    }
    if (t === 'boom') {
      psound('boom', f.x, f.small ? 0.6 : 1); if (!f.small) music.sting('kill');
      const isMine = !!(minesBefore && minesBefore.some(mm => mm.x === f.x && mm.y === f.y));
      addScorch(f.x, f.y, f.small ? 16 : 24, 'boom');
      if (!fx) return;
      shakeMag = Math.max(shakeMag, isMine ? 6 : f.seat === mySeat ? (f.small ? 7 : 12) : (f.small ? 3 : 7));
      explosion(f.x, f.y, f.small ? 0.7 : 1, colSeat(f.seat), false);
      LUM.ajouter(f.x, f.y, isMine ? 90 : f.small ? 85 : 135, isMine ? '#ff7a5a' : '#ff9a48', f.small ? 550 : 850, 0.8);   // l'explosion embrase le sable alentour
      LUM.ajouter(f.x, f.y, f.small ? 36 : 56, '#fff0d0', 160, 0.7);
      if (isMine) { dustAt(f.x, f.y, 14, 3, '150,120,80', 6); ringAt(f.x, f.y, 4, MINE_R, 360, '255,120,90', 3); }   // mine : geyser de sable
      else if (!f.small) wreckAt(f.x, f.y, 5000);
    }
  }

  // ───────────────────────── interpolation ─────────────────────────
  function viewTanks(now) {
    if (buf.length === 0) return null;
    const target = now - INTERP_MS; let a = buf[0], b = buf[buf.length - 1];
    for (let i = 0; i < buf.length; i++) if (buf[i].t <= target) a = buf[i];
    for (let i = buf.length - 1; i >= 0; i--) if (buf[i].t >= target) b = buf[i];
    const span = b.t - a.t; let al = span > 0 ? (target - a.t) / span : 0; al = al < 0 ? 0 : al > 1 ? 1 : al;
    const out = {};
    b.s.players.forEach(pb => { if (!pb.playing) return; const pa = a.s.players[pb.seat]; let x = pb.x, y = pb.y, ang = pb.angle; if (pa && pa.playing && Math.hypot(pb.x - pa.x, pb.y - pa.y) < 80) { x = pa.x + (pb.x - pa.x) * al; y = pa.y + (pb.y - pa.y) * al; const da = Math.atan2(Math.sin(pb.angle - pa.angle), Math.cos(pb.angle - pa.angle)); ang = pa.angle + da * al; } out[pb.seat] = { x, y, angle: ang }; });
    return out;
  }

  // ───────────────────────── décor statique pré-rendu ─────────────────────────
  // Couche 1 « sol » : dunes éclairées du haut-gauche (champ de hauteur basse résolution agrandi avec lissage),
  // rides de vent, grains, cailloux, touffes sèches, vieille piste, vignette, cadre. Ne dépend que de la taille.
  let groundCv = null, groundKey = '';
  function ensureGround() {
    const key = cv.width + '|' + G + '|' + (A.contrast ? 1 : 0);
    if (groundCv && key === groundKey) return;
    groundKey = key; wallsKey = '';
    if (!groundCv) groundCv = document.createElement('canvas');
    groundCv.width = cv.width; groundCv.height = cv.height;
    const g = groundCv.getContext('2d'), W = ARENA, sc = cv.width / W, r = rng(0x7a3d + G), amp = A.contrast ? 0.45 : 1;
    // 1) dunes
    const N = 160, lo = document.createElement('canvas'); lo.width = lo.height = N;
    const lg = lo.getContext('2d'), img = lg.createImageData(N, N), d = img.data;
    const H = (x, y) => { const u = x * 0.8 + y * 0.6, v = -x * 0.6 + y * 0.8; return Math.sin(u * 0.045 + Math.sin(v * 0.02) * 1.6) * 0.55 + Math.sin(u * 0.11 + v * 0.03 + 1.7) * 0.22 + Math.sin(v * 0.05 - u * 0.02) * 0.2; };
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const x = (i + 0.5) / N * W, y = (j + 0.5) / N * W, h = H(x, y), sh = H(x + 3, y + 3) - h;   // pente tournée vers la lumière
      const t = Math.max(0, Math.min(1, 0.45 + (sh * 4.2 + h * 0.12) * amp + (hash2(i, j) - 0.5) * 0.05));
      const c = mix(SAND_LO, SAND_HI, t), o = (j * N + i) * 4; d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255;
    }
    lg.putImageData(img, 0, 0);
    g.imageSmoothingEnabled = true; g.drawImage(lo, 0, 0, groundCv.width, groundCv.height);
    g.setTransform(sc, 0, 0, sc, 0, 0);
    // 2) damier très discret : on lit encore la grille des blocs sur le sable
    g.fillStyle = 'rgba(0,0,0,' + (A.contrast ? 0.07 : 0.035) + ')';
    for (let gy = 0; gy < G; gy++) for (let gx = 0; gx < G; gx++) if ((gx + gy) & 1) g.fillRect(gx * BLK, gy * BLK, BLK, BLK);
    // 3) vieille piste : deux ornières sinueuses qui traversent le terrain
    g.lineCap = 'round';
    for (const off of [-7, 7]) { g.strokeStyle = 'rgba(28,20,10,0.13)'; g.lineWidth = 4.5; g.beginPath(); for (let s = 0; s <= 40; s++) { const x = s / 40 * W, y = W * 0.62 + Math.sin(s / 40 * 5.2 + 0.6) * W * 0.12 + off; s ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); }
    // 4) rides de vent : petits arcs parallèles, crête éclairée + creux sombre
    for (let k = 0; k < 80; k++) {
      const x0 = r() * W, y0 = r() * W, n = 3 + ((r() * 4) | 0), len = 12 + r() * 20;
      for (let j = 0; j < n; j++) {
        const x = x0 + j * 4.2, y = y0 + j * 1.2;
        g.beginPath(); g.moveTo(x - 1.5, y - len / 2); g.quadraticCurveTo(x + 2.5, y, x - 1.5, y + len / 2);
        g.strokeStyle = 'rgba(0,0,0,0.12)'; g.lineWidth = 1.1; g.stroke();
        g.save(); g.translate(-0.9, -0.9); g.strokeStyle = 'rgba(255,232,190,0.09)'; g.lineWidth = 0.9; g.stroke(); g.restore();
      }
    }
    // 5) grains
    for (let k = 0; k < 3600; k++) { const t = r(); g.fillStyle = t < 0.5 ? 'rgba(226,196,140,0.2)' : t < 0.92 ? 'rgba(20,14,6,0.22)' : 'rgba(255,240,210,0.3)'; g.fillRect(r() * W, r() * W, 0.9 + r() * 0.8, 0.9 + r() * 0.8); }
    // 6) cailloux : ombre portée, pierre, reflet
    for (let k = 0; k < 70; k++) {
      const x = r() * W, y = r() * W, rx = 1 + r() * 2.2, ry = rx * (0.6 + r() * 0.4), c = mix([92, 84, 70], [150, 136, 110], r());
      g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); oval(g, x + 0.9, y + 1.1, rx, ry); g.fill();
      g.fillStyle = rgbStr(c); g.beginPath(); oval(g, x, y, rx, ry); g.fill();
      g.fillStyle = 'rgba(255,245,220,0.3)'; g.beginPath(); oval(g, x - rx * 0.3, y - ry * 0.35, rx * 0.4, ry * 0.3); g.fill();
    }
    // 7) touffes d'herbe sèche
    g.strokeStyle = 'rgba(62,58,30,0.55)'; g.lineWidth = 0.8;
    for (let k = 0; k < 14; k++) { const x = r() * W, y = r() * W; g.beginPath(); for (let j = 0; j < 8; j++) { const a = -Math.PI * 0.9 + j / 7 * Math.PI * 0.8 + (r() - 0.5) * 0.3, l = 3 + r() * 3.5; g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); } g.stroke(); }
    // 8) vignette chaude + cadre (liseré sombre, filet d'or, équerres de carte d'état-major, graduations)
    const vg = g.createRadialGradient(W / 2, W / 2, W * 0.32, W / 2, W / 2, W * 0.76); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(10,6,2,0.5)');
    g.fillStyle = vg; g.fillRect(0, 0, W, W);
    g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = 3; g.strokeRect(1.5, 1.5, W - 3, W - 3);
    g.strokeStyle = 'rgba(224,169,46,' + (A.contrast ? 0.75 : 0.32) + ')'; g.lineWidth = 1; g.strokeRect(4.5, 4.5, W - 9, W - 9);
    g.strokeStyle = 'rgba(224,169,46,' + (A.contrast ? 0.9 : 0.55) + ')'; g.lineWidth = 2; g.beginPath();
    for (const [x, y, sx, sy] of [[4, 4, 1, 1], [W - 4, 4, -1, 1], [4, W - 4, 1, -1], [W - 4, W - 4, -1, -1]]) { g.moveTo(x, y + sy * 16); g.lineTo(x, y); g.lineTo(x + sx * 16, y); }
    g.stroke();
    g.strokeStyle = 'rgba(230,207,152,0.22)'; g.lineWidth = 1; g.beginPath();
    for (let i = 1; i < G; i++) { const p = i * BLK; g.moveTo(p, 0); g.lineTo(p, 4); g.moveTo(p, W); g.lineTo(p, W - 4); g.moveTo(0, p); g.lineTo(4, p); g.moveTo(W, p); g.lineTo(W - 4, p); }
    g.stroke();
  }

  // Sprites des blocs (acier riveté ×3, caisse en bois ×4) et du baril, cuits à la résolution de l'écran.
  let blockKey = '', steelSpr = [], crateSpr = [], barrelSpr = null;
  function ensureBlocks() {
    const sc = cv.width / ARENA, key = sc.toFixed(4) + '|' + (A.contrast ? 1 : 0);
    if (key === blockKey) return;
    blockKey = key; wallsKey = '';
    const px = Math.max(8, Math.ceil(BLK * sc));
    const mk = (arr, i) => { const c = arr[i] || (arr[i] = document.createElement('canvas')); c.width = c.height = px; const g = c.getContext('2d'); g.setTransform(px / BLK, 0, 0, px / BLK, 0, 0); return g; };
    for (let v = 0; v < 3; v++) paintSteel(mk(steelSpr, v), v, rng(101 + v));
    for (let v = 0; v < 4; v++) paintCrate(mk(crateSpr, v), v, rng(211 + v));
    if (!barrelSpr) barrelSpr = document.createElement('canvas');
    const bp = Math.max(8, Math.ceil(30 * sc)); barrelSpr.width = barrelSpr.height = bp;
    const bg = barrelSpr.getContext('2d'); bg.setTransform(bp / 30, 0, 0, bp / 30, 0, 0); paintBarrel(bg);
  }
  function paintSteel(g, v, r) {                      // plaque de blindage : acier brossé, biseau, rivets, soudures, rouille
    const B = BLK, gr = g.createLinearGradient(0, 0, B, B);
    gr.addColorStop(0, '#8e8a7f'); gr.addColorStop(0.5, '#6c6860'); gr.addColorStop(1, '#4b4841');
    g.fillStyle = '#1c1a16'; g.fillRect(0, 0, B, B);
    g.fillStyle = gr; g.fillRect(1, 1, B - 2, B - 2);
    bevel(g, 1, 1, B - 2, B - 2, 3.2, 'rgba(255,250,235,0.24)', 'rgba(0,0,0,0.38)');
    g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(6, 6, B - 12, B - 12);
    g.strokeStyle = 'rgba(255,255,255,0.05)'; g.lineWidth = 0.6; g.beginPath();              // brossage
    for (let k = 0; k < 12; k++) { const y = 6.5 + r() * (B - 13), x = 6 + r() * 8; g.moveTo(x, y); g.lineTo(x + 10 + r() * 14, y); }
    g.stroke();
    if (v === 1) {                                    // tôle larmée : petits reliefs en chevrons alternés
      g.lineWidth = 1.1; g.lineCap = 'round';
      for (let yy = 10; yy < B - 8; yy += 5) for (let xx = 10; xx < B - 8; xx += 5) { const s = ((xx + yy) / 5) & 1 ? 1 : -1; g.strokeStyle = 'rgba(255,250,230,0.14)'; g.beginPath(); g.moveTo(xx - 1.4, yy - s * 1.4); g.lineTo(xx + 1.4, yy + s * 1.4); g.stroke(); g.strokeStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.moveTo(xx - 0.9, yy - s * 1.4 + 0.8); g.lineTo(xx + 1.9, yy + s * 1.4 + 0.8); g.stroke(); }
    } else if (v === 2) {                             // deux plaques soudées : cordon de soudure perlé au milieu
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(4, B / 2 - 1, B - 8, 2);
      g.fillStyle = 'rgba(210,200,180,0.35)'; for (let x = 5; x < B - 5; x += 2.4) { g.beginPath(); g.arc(x, B / 2 - 0.3, 0.9, 0, 6.283); g.fill(); }
    } else {                                          // panneau central embouti
      g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 1.2; g.strokeRect(10.5, 10.5, B - 21, B - 21);
      g.strokeStyle = 'rgba(255,250,235,0.14)'; g.lineWidth = 1; g.strokeRect(11.5, 11.5, B - 21, B - 21);
    }
    for (const x of [6, B - 6]) for (const y of [6, B - 6]) {   // rivets : tête sombre + reflet
      g.fillStyle = 'rgba(0,0,0,0.45)'; g.beginPath(); g.arc(x + 0.5, y + 0.6, 2.3, 0, 6.283); g.fill();
      g.fillStyle = '#7d796f'; g.beginPath(); g.arc(x, y, 2, 0, 6.283); g.fill();
      g.fillStyle = 'rgba(255,250,235,0.55)'; g.beginPath(); g.arc(x - 0.6, y - 0.7, 0.8, 0, 6.283); g.fill();
    }
    for (let k = 0; k < 5; k++) { g.fillStyle = 'rgba(150,72,28,' + (0.12 + r() * 0.18) + ')'; g.beginPath(); oval(g, 4 + r() * (B - 8), 4 + r() * (B - 8), 1 + r() * 2.4, 0.8 + r() * 1.6); g.fill(); }   // rouille
    g.strokeStyle = A.contrast ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.55)'; g.lineWidth = A.contrast ? 1.6 : 1; g.strokeRect(0.8, 0.8, B - 1.6, B - 1.6);
  }
  function paintCrate(g, v, r) {                      // caisse en bois : planches veinées, cadre, entretoise, clous
    const B = BLK, m = 2, vert = v & 1, lite = A.contrast ? 0.12 : 0;
    g.fillStyle = '#2e1f10'; g.fillRect(m, m, B - 2 * m, B - 2 * m);
    const n = 4, ins = 6, span = B - 2 * ins;
    for (let i = 0; i < n; i++) {
      const c = mix(mix([128, 92, 50], [176, 132, 76], r()), [255, 240, 210], lite), a = ins + i * span / n;
      g.fillStyle = rgbStr(c);
      if (vert) g.fillRect(a + 0.4, ins, span / n - 0.8, span); else g.fillRect(ins, a + 0.4, span, span / n - 0.8);
      g.strokeStyle = 'rgba(60,36,14,0.35)'; g.lineWidth = 0.6; g.beginPath();                // veinage
      for (let k = 0; k < 3; k++) {
        const o = a + (k + 0.6) * span / n / 3.4;
        if (vert) { g.moveTo(o, ins); for (let s = 1; s <= 6; s++) g.lineTo(o + Math.sin(s * 1.7 + i + k) * 0.7, ins + span * s / 6); }
        else { g.moveTo(ins, o); for (let s = 1; s <= 6; s++) g.lineTo(ins + span * s / 6, o + Math.sin(s * 1.7 + i + k) * 0.7); }
      }
      g.stroke();
      if (r() < 0.5) { g.fillStyle = 'rgba(50,30,12,0.5)'; g.beginPath(); oval(g, vert ? a + span / n / 2 : ins + r() * span, vert ? ins + r() * span : a + span / n / 2, 1.2, 0.8); g.fill(); }   // nœud du bois
    }
    const bat = 'rgb(' + (A.contrast ? '196,152,92' : '166,122,68') + ')', bw = 5;
    g.fillStyle = bat; g.fillRect(m, m, B - 2 * m, bw); g.fillRect(m, B - m - bw, B - 2 * m, bw); g.fillRect(m, m, bw, B - 2 * m); g.fillRect(B - m - bw, m, bw, B - 2 * m);
    bevel(g, m, m, B - 2 * m, B - 2 * m, 1.6, 'rgba(255,236,200,0.3)', 'rgba(0,0,0,0.35)');
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(m + bw, m + bw, B - 2 * (m + bw), 1); g.fillRect(m + bw, m + bw, 1, B - 2 * (m + bw));   // ombre du cadre sur les planches
    g.save(); g.translate(B / 2, B / 2); g.rotate(v < 2 ? Math.PI / 4 : -Math.PI / 4);        // entretoise diagonale
    const L = (B - 2 * (m + bw)) * 1.414 / 2;
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(-L, -bw / 2 + 1, L * 2, bw);
    g.fillStyle = bat; g.fillRect(-L, -bw / 2, L * 2, bw);
    g.fillStyle = 'rgba(255,236,200,0.22)'; g.fillRect(-L, -bw / 2, L * 2, 1.1);
    g.restore();
    g.fillStyle = '#2a2016';                          // clous
    for (const x of [m + 2.5, B - m - 2.5]) for (const y of [m + 2.5, B - m - 2.5]) { g.beginPath(); g.arc(x, y, 0.9, 0, 6.283); g.fill(); }
    if (v === 3) { g.globalAlpha = 0.28; g.fillStyle = '#1a120a'; starPath(g, B * 0.7, B * 0.3, 4.2); g.fill(); g.globalAlpha = 1; }   // marquage au pochoir
    g.strokeStyle = A.contrast ? '#000' : 'rgba(20,12,4,0.8)'; g.lineWidth = A.contrast ? 2 : 1.1; g.strokeRect(m + 0.4, m + 0.4, B - 2 * m - 0.8, B - 2 * m - 0.8);
  }
  function paintBarrel(g) {                           // fût de carburant vu de dessus (centre 15,15 ; r 11)
    const c = 15, R = 11;
    g.fillStyle = 'rgba(0,0,0,0.38)'; g.beginPath(); g.arc(c + 2.4, c + 3.2, R, 0, 6.283); g.fill();
    const gr = g.createRadialGradient(c - 4, c - 4, 1, c, c, R); gr.addColorStop(0, '#e8804a'); gr.addColorStop(0.55, '#b5532a'); gr.addColorStop(1, '#6e2a12');
    g.fillStyle = gr; g.beginPath(); g.arc(c, c, R, 0, 6.283); g.fill();
    g.strokeStyle = '#3a1d0e'; g.lineWidth = 1.6; g.stroke();
    g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 1; g.beginPath(); g.arc(c, c, R * 0.68, 0, 6.283); g.stroke();
    g.strokeStyle = 'rgba(255,220,180,0.35)'; g.lineWidth = 1.2; g.beginPath(); g.arc(c, c, R - 1.6, Math.PI * 1.05, Math.PI * 1.6); g.stroke();
    g.fillStyle = '#4a2410'; g.beginPath(); g.arc(c + 5, c - 4.6, 1.9, 0, 6.283); g.fill();   // bonde
    g.strokeStyle = 'rgba(255,200,160,0.4)'; g.lineWidth = 0.6; g.stroke();
    g.fillStyle = '#ffd23f'; g.strokeStyle = '#2a1508'; g.lineWidth = 0.9;                       // pictogramme danger
    g.beginPath(); g.moveTo(c, c - 4.6); g.lineTo(c + 4.6, c + 3.4); g.lineTo(c - 4.6, c + 3.4); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#2a1508'; g.fillRect(c - 0.6, c - 1.8, 1.2, 3); g.beginPath(); g.arc(c, c + 2.2, 0.7, 0, 6.283); g.fill();
    if (A.contrast) { g.strokeStyle = '#fff'; g.lineWidth = 1.2; g.beginPath(); g.arc(c, c, R + 1.2, 0, 6.283); g.stroke(); }
  }

  // Couche 2 « terrain » : sol + boue + cratères + ombres portées + blocs. Redessinée seulement quand la grille,
  // la boue, les cratères ou la taille changent (~1 drawImage par image au lieu de ~500 tracés).
  let wallsCv = null, wallsKey = '';
  function ensureWalls() {
    ensureBlocks();
    const key = groundKey + '|' + blockKey + '|' + mudKey + '|' + scorchVer;
    if (wallsCv && key === wallsKey && wallsCv.__grid === snap.grid) return;
    wallsKey = key;
    if (!wallsCv) wallsCv = document.createElement('canvas');
    wallsCv.width = cv.width; wallsCv.height = cv.height; wallsCv.__grid = snap.grid;
    const g = wallsCv.getContext('2d'), sc = cv.width / ARENA, grid = snap.grid || '';
    g.drawImage(groundCv, 0, 0);
    g.setTransform(sc, 0, 0, sc, 0, 0);
    // boue : flaque sombre qui couvre la case (c'est la case qui ralentit : ses bords doivent se lire), reflets mouillés
    for (const i2 of (snap.mud || [])) {
      const gx = i2 % G, gy = (i2 / G) | 0, x = gx * BLK, y = gy * BLK, r = rng(i2 * 7919 + 13);
      g.fillStyle = 'rgba(34,22,8,0.58)'; g.beginPath(); rr(g, x + 2, y + 2, BLK - 4, BLK - 4, 10); g.fill();
      g.fillStyle = 'rgba(24,15,5,0.5)'; g.beginPath(); for (let k = 0; k < 5; k++) { const bx = x + 9 + r() * 22, by = y + 9 + r() * 22, br = 5 + r() * 5; g.moveTo(bx + br, by); g.arc(bx, by, br, 0, 6.283); } g.fill();
      for (let k = 0; k < 2; k++) {                     // flaques d'eau : surface + reflet du ciel en haut à gauche
        const px = x + 10 + r() * 20, py = y + 10 + r() * 20, prx = 4 + r() * 4, pry = 2.5 + r() * 2.5;
        g.fillStyle = 'rgba(62,48,30,0.75)'; g.beginPath(); oval(g, px, py, prx, pry); g.fill();
        g.strokeStyle = 'rgba(255,232,196,0.22)'; g.lineWidth = 0.9; g.beginPath(); g.arc(px - prx * 0.2, py - pry * 0.1, Math.min(prx, pry) * 0.8, Math.PI * 1.1, Math.PI * 1.6); g.stroke();
      }
      g.strokeStyle = 'rgba(120,92,52,0.35)'; g.lineWidth = 1.2; g.beginPath(); rr(g, x + 2.5, y + 2.5, BLK - 5, BLK - 5, 10); g.stroke();   // bourrelet de boue sèche
      if (A.contrast) { g.setLineDash([4, 3]); g.strokeStyle = 'rgba(255,255,255,0.75)'; g.lineWidth = 1.2; g.strokeRect(x + 2.5, y + 2.5, BLK - 5, BLK - 5); g.setLineDash([]); }
    }
    // cratères : suie radiale, cuvette creusée (explosions), éclats de bois ou de tôle
    for (const s of scorch) {
      const r = rng(s.seed), R0 = s.r, gr = g.createRadialGradient(s.x, s.y, 0, s.x, s.y, R0);
      gr.addColorStop(0, 'rgba(12,8,4,0.6)'); gr.addColorStop(0.55, 'rgba(20,13,6,0.32)'); gr.addColorStop(1, 'rgba(20,13,6,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(s.x, s.y, R0, 0, 6.283); g.fill();
      g.strokeStyle = 'rgba(10,6,2,0.28)'; g.lineWidth = 1.2; g.beginPath();
      for (let k = 0; k < 9; k++) { const a = r() * 6.283; g.moveTo(s.x + Math.cos(a) * R0 * 0.3, s.y + Math.sin(a) * R0 * 0.3); g.lineTo(s.x + Math.cos(a) * R0 * (0.8 + r() * 0.5), s.y + Math.sin(a) * R0 * (0.8 + r() * 0.5)); }
      g.stroke();
      if (s.kind === 'boom' || s.kind === 'barrel') {
        g.fillStyle = 'rgba(0,0,0,0.28)'; g.beginPath(); g.arc(s.x, s.y, R0 * 0.34, 0, 6.283); g.fill();
        g.strokeStyle = 'rgba(210,180,130,0.2)'; g.lineWidth = 1.2; g.beginPath(); g.arc(s.x, s.y, R0 * 0.36, -Math.PI * 0.1, Math.PI * 0.6); g.stroke();   // bord intérieur éclairé (côté opposé à la lumière)
      }
      const cols = s.kind === 'metal' ? ['#77746c', '#4e4b45'] : s.kind === 'wall' ? ['#6b4a26', '#8a6436', '#3e2a14'] : ['#2a2622', '#4a443d'];
      for (let k = 0; k < 7; k++) { g.fillStyle = cols[k % cols.length]; const a = r() * 6.283, dd = r() * R0 * 0.9; g.fillRect(s.x + Math.cos(a) * dd, s.y + Math.sin(a) * dd, 1.2 + r() * 2.4, 1 + r() * 1.4); }
    }
    // ombres portées des blocs (union d'un seul tracé : pas de double assombrissement), pénombre puis ombre franche
    for (const [dx, dy, al] of [[6, 8, 0.16], [3.5, 4.5, 0.36]]) {
      g.fillStyle = 'rgba(14,8,2,' + al + ')'; g.beginPath();
      for (let i = 0; i < grid.length; i++) { const ch = grid.charCodeAt(i); if (ch !== 49 && ch !== 50) continue; const gx = i % G, gy = (i / G) | 0; g.rect(gx * BLK + dx, gy * BLK + dy, BLK, BLK); }
      g.fill();
    }
    for (let i = 0; i < grid.length; i++) {
      const ch = grid.charAt(i); if (ch !== '1' && ch !== '2') continue;
      const gx = i % G, gy = (i / G) | 0, h = (gx * 73856093) ^ (gy * 19349663);
      g.drawImage(ch === '1' ? steelSpr[(h >>> 0) % 3] : crateSpr[(h >>> 0) % 4], gx * BLK, gy * BLK, BLK, BLK);
    }
  }

  // ───────────────────────── chars : sprites pré-rendus + parties animées ─────────────────────────
  // Caisse (chenilles, plage moteur, glacis, coffres, phares, motif du siège) et tourelle sont cuites par siège ;
  // les maillons qui défilent, le canon (recul), la flamme de bouche et les accessoires de bonus sont en direct.
  const HX0 = -TANK_R * 1.14, HY0 = -TANK_R * 1.0, HW = TANK_R * 2.28, HH = TANK_R * 2.0;
  const tankSpr = {};
  function getTankSpr(id, col, seat) {
    const S = Math.max(1, cv.width / ARENA), key = col + '|' + seat + '|' + S.toFixed(3) + '|' + (A.contrast ? 1 : 0);
    let o = tankSpr[id];
    if (o && o.key === key) return o;
    if (!o) o = tankSpr[id] = { hull: document.createElement('canvas'), tur: document.createElement('canvas'), key: '', w: HW, h: HH };
    o.key = key;
    const pw = Math.ceil(HW * S), ph = Math.ceil(HH * S);
    o.hull.width = o.tur.width = pw; o.hull.height = o.tur.height = ph; o.w = pw / S; o.h = ph / S;
    paintHull(o.hull.getContext('2d'), S, col, seat); paintTurret(o.tur.getContext('2d'), S, col);
    return o;
  }
  function paintHull(g, S, col, seat) {
    const R = TANK_R, c = hexRgb(col), base = mix(c, [58, 54, 38], 0.2), dk = mix(c, [20, 16, 10], 0.55), lt = mix(c, [255, 250, 230], 0.25);
    g.setTransform(S, 0, 0, S, -HX0 * S, -HY0 * S);
    g.fillStyle = '#1d1a14';                           // chenilles (fond ; les maillons animés sont posés en direct)
    for (const s of [-1, 1]) { g.beginPath(); rr(g, -R * 1.1, s > 0 ? R * 0.58 : -R * 0.95, R * 2.2, R * 0.37, R * 0.13); g.fill(); }
    g.fillStyle = 'rgba(255,240,210,0.12)'; g.fillRect(-R * 1.02, -R * 0.95, R * 2.04, R * 0.05); g.fillRect(-R * 1.02, R * 0.9, R * 2.04, R * 0.05);
    const hull = () => { g.beginPath(); g.moveTo(-R * 0.98, -R * 0.64); g.lineTo(R * 0.78, -R * 0.64); g.lineTo(R * 1.02, -R * 0.42); g.lineTo(R * 1.02, R * 0.42); g.lineTo(R * 0.78, R * 0.64); g.lineTo(-R * 0.98, R * 0.64); g.closePath(); };
    hull(); g.fillStyle = rgbStr(base); g.fill();
    const pat = seat >= 0 ? seatPattern(g, seat, { size: Math.round(R * 0.8) }) : null;   // motif du siège sur la caisse (il tourne avec le char)
    if (pat) { g.fillStyle = pat; g.fill(); }
    const rg = g.createRadialGradient(-R * 0.1, 0, R * 0.1, 0, 0, R * 1.15);              // bombé : centre clair, bords sombres (lisible à toute orientation)
    rg.addColorStop(0, 'rgba(255,245,220,0.16)'); rg.addColorStop(0.7, 'rgba(0,0,0,0)'); rg.addColorStop(1, 'rgba(0,0,0,0.3)');
    g.fillStyle = rg; g.fill();
    g.beginPath(); g.moveTo(R * 0.64, -R * 0.64); g.lineTo(R * 0.78, -R * 0.64); g.lineTo(R * 1.02, -R * 0.42); g.lineTo(R * 1.02, R * 0.42); g.lineTo(R * 0.78, R * 0.64); g.lineTo(R * 0.64, R * 0.64); g.closePath();
    g.fillStyle = rgbStr(lt, 0.55); g.fill();           // glacis avant, plus clair : on lit l'avant du char
    g.fillStyle = rgbStr(dk, 0.85); g.fillRect(-R * 0.94, -R * 0.42, R * 0.42, R * 0.84);   // plage moteur
    g.strokeStyle = 'rgba(0,0,0,0.55)'; g.lineWidth = 0.7; g.beginPath(); for (let k = 0; k < 4; k++) { const x = -R * 0.87 + k * R * 0.1; g.moveTo(x, -R * 0.35); g.lineTo(x, R * 0.35); } g.stroke();
    g.fillStyle = rgbStr(dk, 0.7); g.fillRect(-R * 0.42, -R * 0.62, R * 0.52, R * 0.14); g.fillRect(-R * 0.42, R * 0.48, R * 0.52, R * 0.14);   // coffres de garde-boue
    g.fillStyle = 'rgba(40,36,26,0.85)'; g.fillRect(-R * 0.97, -R * 0.56, R * 0.12, R * 0.26);   // jerrican
    g.fillStyle = 'rgba(255,236,170,0.9)'; for (const s of [-1, 1]) { g.beginPath(); g.arc(R * 0.93, s * R * 0.36, R * 0.07, 0, 6.283); g.fill(); }   // phares
    hull(); g.lineJoin = 'round'; g.strokeStyle = 'rgba(10,8,4,0.7)'; g.lineWidth = 1.1; g.stroke();
    if (A.contrast) { g.strokeStyle = '#fff'; g.lineWidth = 1.3; g.beginPath(); rr(g, -R * 1.11, -R * 0.96, R * 2.22, R * 1.92, R * 0.2); g.stroke(); }
  }
  const TURRET = [[0.52, -0.22], [0.3, -0.46], [-0.3, -0.5], [-0.58, -0.3], [-0.58, 0.3], [-0.3, 0.5], [0.3, 0.46], [0.52, 0.22]];
  function paintTurret(g, S, col) {
    const R = TANK_R, c = hexRgb(col), body = mix(c, [255, 250, 235], 0.1), dk = mix(c, [15, 12, 8], 0.5), cx = -R * 0.08;
    g.setTransform(S, 0, 0, S, -HX0 * S, -HY0 * S);
    const tur = () => { g.beginPath(); TURRET.forEach(([x, y], i) => { i ? g.lineTo(cx + x * R, y * R) : g.moveTo(cx + x * R, y * R); }); g.closePath(); };
    g.save(); g.translate(R * 0.07, R * 0.09); tur(); g.fillStyle = 'rgba(0,0,0,0.35)'; g.fill(); g.restore();   // ombre de la tourelle sur la caisse
    tur(); const rg = g.createRadialGradient(cx - R * 0.18, -R * 0.16, R * 0.05, cx, 0, R * 0.62);
    rg.addColorStop(0, rgbStr(mix(body, [255, 255, 255], 0.3))); rg.addColorStop(0.6, rgbStr(body)); rg.addColorStop(1, rgbStr(dk));
    g.fillStyle = rg; g.fill(); g.strokeStyle = 'rgba(10,8,4,0.75)'; g.lineWidth = 1; g.stroke();
    g.fillStyle = rgbStr(dk); g.fillRect(cx + R * 0.5, -R * 0.2, R * 0.16, R * 0.4);            // masque du canon
    g.beginPath(); g.arc(cx - R * 0.26, R * 0.2, R * 0.17, 0, 6.283); g.fill();                  // tourelleau du chef…
    g.fillStyle = rgbStr(mix(body, [255, 255, 255], 0.18)); g.beginPath(); g.arc(cx - R * 0.26, R * 0.2, R * 0.1, 0, 6.283); g.fill();   // …et sa trappe
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(cx - R * 0.36, -R * 0.36, R * 0.22, R * 0.14);   // trappe du chargeur
    g.fillStyle = 'rgba(0,0,0,0.4)'; for (const [x, y] of [[0.25, -0.32], [0.25, 0.32], [-0.45, -0.18], [-0.45, 0.02]]) { g.beginPath(); g.arc(cx + x * R, y * R, R * 0.035, 0, 6.283); g.fill(); }   // boulons
    if (A.contrast) { tur(); g.strokeStyle = '#fff'; g.lineWidth = 1.1; g.stroke(); }
  }
  // tube de canon (repère local du char, avant = +x) ; o = options du char dessiné
  function drawBarrel(x0, x1, w, o, now) {
    const h = w / 2;
    ctx.fillStyle = '#23211c'; ctx.fillRect(x0, -h - 0.5, x1 - x0, w + 1);
    ctx.fillStyle = '#9a968a'; ctx.fillRect(x0, -h, x1 - x0, w);
    ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fillRect(x0, -h, x1 - x0, w * 0.3);
    ctx.fillStyle = '#34322c'; ctx.fillRect(x1 - w * 0.95, -h * 1.45, w * 0.95, w * 1.45);        // frein de bouche
    if (o.rapid) { ctx.fillStyle = 'rgba(255,120,40,' + (A.reduceFx ? 0.55 : 0.4 + 0.2 * Math.sin(now / 90)) + ')'; ctx.fillRect(x1 - w * 3, -h, w * 3, w); }   // tube chauffé au rouge
    if (o.pierce) { ctx.fillStyle = '#ff9be0'; ctx.fillRect(x1 - w * 0.35, -h * 1.45, w * 0.35, w * 1.45); }                        // pointe d'obus perçant
  }
  const TO = { alpha: 1, trL: 0, trR: 0, rc: 0, flash: 0, lives: 3, rapid: false, triple: false, pierce: false, homing: false, radar: false, mineN: 0, seat: -1 };
  function drawTank(spr, x, y, a, o, now) {
    const R = TANK_R;
    ctx.save(); ctx.translate(x, y); ctx.rotate(a);
    if (o.alpha < 1) ctx.globalAlpha = o.alpha;
    ctx.drawImage(spr.hull, HX0, HY0, spr.w, spr.h);
    // maillons des chenilles : chaque chenille a son odomètre (en rotation sur place, elles tournent en sens opposés)
    ctx.strokeStyle = 'rgba(96,88,70,0.95)'; ctx.lineWidth = 1.1; ctx.beginPath();
    for (const s of [-1, 1]) {
      const off = (((s < 0 ? o.trL : o.trR) % 3) + 3) % 3, y0 = s < 0 ? -R * 0.9 : R * 0.63, y1 = s < 0 ? -R * 0.63 : R * 0.9;
      for (let xx = -R * 1.05 + off; xx < R * 1.05; xx += 3) { ctx.moveTo(xx, y0); ctx.lineTo(xx, y1); }
    }
    ctx.stroke();
    if (o.lives <= 2) {                               // dégâts visibles : suie sur la caisse (1 tache à 2 vies, 2 à 1 vie)
      ctx.fillStyle = 'rgba(12,10,8,0.5)'; ctx.beginPath(); oval(ctx, R * 0.42, -R * 0.3, R * 0.2, R * 0.13);
      if (o.lives <= 1) oval(ctx, -R * 0.62, R * 0.28, R * 0.24, R * 0.16);
      ctx.fill();
    }
    if (o.mineN > 0) {                                // mines embarquées, alignées sur la plage arrière
      for (let k = 0; k < Math.min(3, o.mineN); k++) { const my = (k - (Math.min(3, o.mineN) - 1) / 2) * R * 0.3; ctx.fillStyle = '#3b3d2a'; ctx.beginPath(); ctx.arc(-R * 0.73, my, R * 0.12, 0, 6.283); ctx.fill(); ctx.fillStyle = '#ff8e6e'; ctx.beginPath(); ctx.arc(-R * 0.73, my, R * 0.045, 0, 6.283); ctx.fill(); }
    }
    const rk = o.rc * R * 0.35, bx0 = R * 0.3 - rk, bx1 = R * 1.72 - rk;   // recul : le tube rentre puis ressort
    if (o.triple) for (const da of [-0.18, 0.18]) { ctx.save(); ctx.rotate(da); drawBarrel(bx0 + R * 0.15, bx1 - R * 0.3, R * 0.17, o, now); ctx.restore(); }   // tir triple : deux tubes latéraux
    drawBarrel(bx0, bx1, R * 0.26, o, now);
    ctx.drawImage(spr.tur, HX0, HY0, spr.w, spr.h);
    if (o.homing) {                                   // missile guidé : deux paniers lance-missiles sur les flancs de tourelle
      for (const s of [-1, 1]) { ctx.fillStyle = '#3d3a32'; ctx.fillRect(-R * 0.2, s * R * 0.5 - R * 0.09, R * 0.46, R * 0.18); ctx.fillStyle = '#ff6a5a'; ctx.fillRect(R * 0.2, s * R * 0.5 - R * 0.07, R * 0.08, R * 0.14); }
    }
    if (o.radar) {                                    // radar : petite antenne parabolique qui tourne
      const ra = A.reduceFx ? 0 : now / 260;
      ctx.strokeStyle = '#7ff0bd'; ctx.lineWidth = 1.4; ctx.lineCap = 'round'; ctx.beginPath();
      ctx.moveTo(-R * 0.3 - Math.cos(ra) * R * 0.2, -R * 0.1 - Math.sin(ra) * R * 0.2); ctx.lineTo(-R * 0.3 + Math.cos(ra) * R * 0.2, -R * 0.1 + Math.sin(ra) * R * 0.2); ctx.stroke();
      ctx.fillStyle = '#7ff0bd'; ctx.beginPath(); ctx.arc(-R * 0.3, -R * 0.1, R * 0.06, 0, 6.283); ctx.fill();
    }
    ctx.strokeStyle = 'rgba(20,18,14,0.8)'; ctx.lineWidth = 0.7; ctx.lineCap = 'round'; ctx.beginPath();   // antenne fouet qui ploie au mouvement
    ctx.moveTo(-R * 0.52, -R * 0.3); ctx.lineTo(-R * 1.25, -R * 0.3 + o.sway * R * 0.35); ctx.stroke();
    if (o.flash > 0) {                                // flamme de bouche : lueur additive + étoile
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const fl = o.flash, tips = o.triple ? [0, -0.18, 0.18] : [0];
      for (const da of tips) {
        const L = da ? bx1 - R * 0.3 : bx1, fx0 = Math.cos(da) * (L + R * 0.35), fy0 = Math.sin(da) * (L + R * 0.35), rr0 = R * (0.55 + 0.45 * fl);
        ctx.globalAlpha = fl * (o.alpha < 1 ? o.alpha : 1); ctx.drawImage(glow('255,200,110'), fx0 - rr0 * 1.6, fy0 - rr0 * 1.6, rr0 * 3.2, rr0 * 3.2);
        ctx.fillStyle = '#fff4c8'; ctx.beginPath(); ctx.moveTo(fx0 + rr0 * 1.5 * Math.cos(da), fy0 + rr0 * 1.5 * Math.sin(da));
        ctx.lineTo(fx0 - rr0 * 0.3 * Math.sin(da), fy0 + rr0 * 0.3 * Math.cos(da)); ctx.lineTo(fx0 - rr0 * 0.4 * Math.cos(da), fy0 - rr0 * 0.4 * Math.sin(da)); ctx.lineTo(fx0 + rr0 * 0.3 * Math.sin(da), fy0 - rr0 * 0.3 * Math.cos(da)); ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    }
    ctx.restore();
    // reflet sur la tourelle, en repère MONDE : la lumière vient toujours du haut-gauche, quelle que soit l'orientation
    ctx.save(); if (o.alpha < 1) ctx.globalAlpha = o.alpha;
    const tcx = x + Math.cos(a) * -R * 0.08, tcy = y + Math.sin(a) * -R * 0.08;
    ctx.fillStyle = 'rgba(255,250,235,0.22)'; ctx.beginPath(); ctx.arc(tcx - R * 0.16, tcy - R * 0.16, R * 0.14, 0, 6.283); ctx.fill();
    ctx.restore();
  }
  // odomètre des chenilles + empreintes + poussière : c'est la réaction du SOL, émise même pour un char camouflé
  // (le panneau d'aide le promet : « on peut te pister à la trace »). Tout ce qui vient du char lui-même est filtré.
  function stepTread(p, t, now, kdt) {
    let tr = tread[p.seat];
    if (!tr) tr = tread[p.seat] = { l: 0, r: 0, x: t.x, y: t.y, a: t.angle, mx: t.x, my: t.y, mv: 0, fwd: 0, sway: 0 };
    let dx = t.x - tr.x, dy = t.y - tr.y, da = Math.atan2(Math.sin(t.angle - tr.a), Math.cos(t.angle - tr.a));
    if (dx * dx + dy * dy > 900) { dx = 0; dy = 0; da = 0; tr.mx = t.x; tr.my = t.y; }   // replacement (vie perdue) : pas de glissade
    const ca = Math.cos(t.angle), sa = Math.sin(t.angle), fwd = dx * ca + dy * sa, w = TANK_R * 0.76;
    tr.l += fwd + da * w; tr.r += fwd - da * w;
    tr.x = t.x; tr.y = t.y; tr.a = t.angle; tr.fwd = fwd;
    const moving = Math.abs(fwd) > 0.04 || Math.abs(da) > 0.004;
    tr.mv = moving ? Math.min(1, tr.mv + 0.2 * kdt) : Math.max(0, tr.mv - 0.08 * kdt);
    tr.sway += ((moving ? -Math.sign(fwd) * 0.9 : 0) - tr.sway) * Math.min(1, 0.12 * kdt);
    if (A.reduceFx || !moving) return tr;
    const boue = mudSet.has(Math.floor(t.y / BLK) * G + Math.floor(t.x / BLK));
    if (Math.hypot(t.x - tr.mx, t.y - tr.my) > 3.4) { addPrint(t.x, t.y, ca, sa, boue, now); tr.mx = t.x; tr.my = t.y; }
    if (Math.random() < (boue ? 0.6 : 0.28) * kdt) {    // poussière (ou boue projetée) à l'arrière des chenilles
      const s = Math.random() < 0.5 ? -1 : 1, bx = t.x - ca * TANK_R * (fwd >= 0 ? 1 : -1) - sa * s * w, by = t.y - sa * TANK_R * (fwd >= 0 ? 1 : -1) + ca * s * w;
      addP('dust', 0, bx, by, (Math.random() - 0.5) * 0.5 - ca * fwd * 0.2, (Math.random() - 0.5) * 0.5 - sa * fwd * 0.2, 380 + Math.random() * 260, 2.5 + Math.random() * 2.5, 5, boue ? '70,50,24' : '184,158,110', boue ? 0.55 : 0.4);
      if (boue && Math.random() < 0.5) { const q = addP('debris', 0, bx, by, (Math.random() - 0.5) * 1.6, (Math.random() - 0.5) * 1.6, 420, 1, 0, '44,30,12', 1, 0.88); q.w = 1.6; q.h = 1.3; }   // mottes de boue
    }
    return tr;
  }
  function addPrint(x, y, ca, sa, boue, now) {         // empreinte de maillons : deux barrettes (une par chenille), coins pré-calculés
    const w = TANK_R * 0.76, hl = 1.0, hw = TANK_R * 0.16, q = new Array(16);
    let j = 0;
    for (const s of [-1, 1]) {
      const bx = x - sa * s * w, by = y + ca * s * w;
      q[j++] = bx + ca * hl - sa * hw; q[j++] = by + sa * hl + ca * hw;
      q[j++] = bx + ca * hl + sa * hw; q[j++] = by + sa * hl - ca * hw;
      q[j++] = bx - ca * hl + sa * hw; q[j++] = by - sa * hl - ca * hw;
      q[j++] = bx - ca * hl - sa * hw; q[j++] = by - sa * hl + ca * hw;
    }
    prints.push({ q, born: now, m: boue }); if (prints.length > 320) prints.shift();
  }
  const PRINT_LIFE = 7000;
  function drawPrints(now) {
    while (prints.length && now - prints[0].born > PRINT_LIFE) prints.shift();
    if (!prints.length) return;
    ctx.save();
    for (let b = 0; b < 3; b++) for (let m = 0; m < 2; m++) {   // 3 tranches d'âge × sable/boue : 6 remplissages par image
      ctx.beginPath(); let any = false;
      for (let i = 0; i < prints.length; i++) {
        const pr = prints[i], age = (now - pr.born) / PRINT_LIFE, bb = age < 0.33 ? 0 : age < 0.66 ? 1 : 2;
        if (bb !== b || (pr.m ? 1 : 0) !== m) continue; any = true;
        const q = pr.q; for (let j = 0; j < 16; j += 8) { ctx.moveTo(q[j], q[j + 1]); ctx.lineTo(q[j + 2], q[j + 3]); ctx.lineTo(q[j + 4], q[j + 5]); ctx.lineTo(q[j + 6], q[j + 7]); ctx.closePath(); }
      }
      if (!any) continue;
      ctx.fillStyle = m ? 'rgba(14,8,2,' + [0.4, 0.26, 0.12][b] + ')' : 'rgba(22,15,6,' + [0.26, 0.16, 0.07][b] + ')'; ctx.fill();
    }
    ctx.restore();
  }

  // ───────────────────────── bonus au sol : pictogrammes vectoriels ─────────────────────────
  function drawPU(t, x, y, s, col) {
    const k = s / 10; ctx.save(); ctx.translate(x, y); ctx.scale(k, k); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = col; ctx.fillStyle = col;
    if (t === 'rapid') { ctx.lineWidth = 2.4; ctx.beginPath(); for (const o of [-2.4, 2.6]) { ctx.moveTo(o - 2.4, -4.8); ctx.lineTo(o + 2.2, 0); ctx.lineTo(o - 2.4, 4.8); } ctx.stroke(); }   // » cadence
    else if (t === 'triple') {                        // ⋔ trois obus en éventail
      ctx.lineWidth = 1.7; ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(-1.5, 0); ctx.lineTo(4.2, -4.6); ctx.moveTo(-1.5, 0); ctx.lineTo(5.2, 0); ctx.moveTo(-1.5, 0); ctx.lineTo(4.2, 4.6); ctx.stroke();
      ctx.beginPath(); for (const [px, py] of [[4.6, -5], [6, 0], [4.6, 5]]) { ctx.moveTo(px + 1.5, py); ctx.arc(px, py, 1.5, 0, 6.283); } ctx.fill();
    } else if (t === 'shield') {                      // ⛉ écu
      ctx.beginPath(); ctx.moveTo(0, -6); ctx.quadraticCurveTo(2.8, -4.4, 5.2, -4.6); ctx.lineTo(5.2, -0.6); ctx.quadraticCurveTo(4.8, 3.8, 0, 6.4); ctx.quadraticCurveTo(-4.8, 3.8, -5.2, -0.6); ctx.lineTo(-5.2, -4.6); ctx.quadraticCurveTo(-2.8, -4.4, 0, -6); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.38)'; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.moveTo(0, -3.6); ctx.lineTo(0, 4); ctx.moveTo(-3.2, -1.2); ctx.lineTo(3.2, -1.2); ctx.stroke();
    } else if (t === 'speed') {                       // vitesse : flèche + traits de vitesse
      ctx.beginPath(); ctx.moveTo(-0.5, -5); ctx.lineTo(5.6, 0); ctx.lineTo(-0.5, 5); ctx.closePath(); ctx.fill();
      ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(-6.2, -3); ctx.lineTo(-2.4, -3); ctx.moveTo(-7, 0); ctx.lineTo(-2, 0); ctx.moveTo(-6.2, 3); ctx.lineTo(-2.4, 3); ctx.stroke();
    } else if (t === 'pierce') {                      // ➳ flèche qui traverse un mur
      ctx.globalAlpha = 0.45; ctx.fillRect(-1.1, -5.8, 2.2, 11.6); ctx.globalAlpha = 1;
      ctx.lineWidth = 1.7; ctx.beginPath(); ctx.moveTo(-6.4, 0); ctx.lineTo(3.4, 0); ctx.moveTo(-6, 0); ctx.lineTo(-7.6, -2.2); ctx.moveTo(-6, 0); ctx.lineTo(-7.6, 2.2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(6.8, 0); ctx.lineTo(2.6, -2.9); ctx.lineTo(2.6, 2.9); ctx.closePath(); ctx.fill();
    } else if (t === 'mine') {                        // ◈
      ctx.lineWidth = 1.7; ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(6, 0); ctx.lineTo(0, 6); ctx.lineTo(-6, 0); ctx.closePath(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, -2.7); ctx.lineTo(2.7, 0); ctx.lineTo(0, 2.7); ctx.lineTo(-2.7, 0); ctx.closePath(); ctx.fill();
    } else if (t === 'repair') { ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(-4, 4); ctx.lineTo(1.8, -1.8); ctx.stroke(); ctx.lineWidth = 1.9; ctx.beginPath(); ctx.arc(3.5, -3.5, 3, 0.6, 5.2); ctx.stroke(); }   // clé à molette
    else if (t === 'emp') { ctx.beginPath(); ctx.moveTo(1.5, -6); ctx.lineTo(-2.5, 0.5); ctx.lineTo(0.5, 0.5); ctx.lineTo(-1.5, 6); ctx.lineTo(3.5, -1); ctx.lineTo(0.5, -1); ctx.closePath(); ctx.fill(); }   // éclair
    else if (t === 'homing') {                        // missile
      ctx.beginPath(); ctx.moveTo(0, -6); ctx.quadraticCurveTo(3, -2, 2, 3); ctx.lineTo(-2, 3); ctx.quadraticCurveTo(-3, -2, 0, -6); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-2, 3); ctx.lineTo(-4, 6); ctx.lineTo(-1.2, 4.5); ctx.closePath(); ctx.moveTo(2, 3); ctx.lineTo(4, 6); ctx.lineTo(1.2, 4.5); ctx.closePath(); ctx.fill();
    } else if (t === 'camo') { ctx.lineWidth = 1.7; ctx.beginPath(); ctx.moveTo(-6, 0); ctx.quadraticCurveTo(0, -6, 6, 0); ctx.quadraticCurveTo(0, 6, -6, 0); ctx.closePath(); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, 1.9, 0, 6.283); ctx.fill(); }   // œil
    else if (t === 'radar') { ctx.lineWidth = 1.8; ctx.beginPath(); ctx.arc(0, 1, 1.5, 0, 6.283); ctx.fill(); for (const r of [3.5, 5.8]) { ctx.beginPath(); ctx.arc(0, 1, r, -2.4, -0.74); ctx.stroke(); } }   // ondes radar
    else { ctx.beginPath(); ctx.arc(0, 0, 2.5, 0, 6.283); ctx.fill(); }
    ctx.restore();
  }

  // ───────────────────────── ambiance : ombres de nuages, vautour, volutes de sable ─────────────────────────
  let cloudCv = null;
  function cloudSpr() {
    if (cloudCv) return cloudCv;
    cloudCv = document.createElement('canvas'); cloudCv.width = 256; cloudCv.height = 160;
    const g = cloudCv.getContext('2d'), r = rng(99);
    for (let k = 0; k < 7; k++) { const x = 60 + r() * 136, y = 50 + r() * 60, rad = 34 + r() * 30, gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, 'rgba(0,0,0,0.5)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 256, 160); }
    return cloudCv;
  }
  function drawAmbient(now) {
    const W = ARENA, cl = cloudSpr();
    ctx.save();
    ctx.globalAlpha = 0.16;                           // deux nuages passent : leur ombre glisse sur le sable et les blocs
    for (let k = 0; k < 2; k++) { const span = W + 420, x = ((now / 1000 * (7 + k * 3) + k * 520) % span) - 360, y = W * (0.18 + 0.5 * k) + Math.sin(now / 9000 + k * 2) * 30; ctx.drawImage(cl, x, y - 100, 340, 212); }
    const va = now / 7000, vx = W * 0.5 + Math.cos(va) * W * 0.34, vy = W * 0.46 + Math.sin(va) * W * 0.26;   // vautour qui plane en cercle
    ctx.globalAlpha = 1; ctx.translate(vx, vy); ctx.rotate(va + Math.PI / 2); const fl = 1 + 0.12 * Math.sin(now / 420);
    ctx.fillStyle = 'rgba(10,6,2,0.16)'; ctx.beginPath(); ctx.moveTo(4, 0); ctx.quadraticCurveTo(0, -3, -2, -12 * fl); ctx.quadraticCurveTo(-3, -5, -6, -1); ctx.lineTo(-9, 0); ctx.lineTo(-6, 1); ctx.quadraticCurveTo(-3, 5, -2, 12 * fl); ctx.quadraticCurveTo(0, 3, 4, 0); ctx.fill();
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.restore();
    ctx.save(); ctx.strokeStyle = 'rgba(232,210,160,0.1)'; ctx.lineWidth = 1; ctx.lineCap = 'round'; ctx.beginPath();   // volutes de sable
    for (const d of AMB_WISP) { const x = (d.ph * 100 + now / 1000 * d.v) % (W + 60) - 30, y = d.y * W + Math.sin(now / 1400 + d.ph) * d.a; ctx.moveTo(x, y); ctx.quadraticCurveTo(x - d.l * 0.5, y - 2, x - d.l, y - d.l * WIND_Y / WIND_X); }
    ctx.stroke(); ctx.restore();
  }

  // ───────────────────────── écrans : titre, pause, compte à rebours ─────────────────────────
  // Logo « TANKS » en plaque de blindage rivetée : lettres pochoir sable, chenille qui défile, impacts de balles,
  // cocardes étoilées, voile de poussière ; en dessous un char défile et tire (figé en « réduire les effets »).
  function drawTitle(cx, cy, now) {
    const TXT = 'TANKS', anim = !A.reduceFx;
    ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    let fs = 52; ctx.font = fs + 'px ' + TITLE_FONT;
    const maxW = ARENA * 0.62; let w = ctx.measureText(TXT).width;
    if (w > maxW) { fs = Math.max(20, Math.floor(fs * maxW / w)); ctx.font = fs + 'px ' + TITLE_FONT; w = ctx.measureText(TXT).width; }   // tient toujours dans l'arène (mobile)
    const bandH = Math.max(7, fs * 0.22), ph = fs * 1.16 + bandH, pw = w + fs * 1.5;
    const px = cx - pw / 2, py = cy - ph / 2, ty = py + (ph - bandH) / 2, rq = Math.min(10, fs * 0.22);
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.beginPath(); rr(ctx, px + 4, py + 6, pw, ph, rq); ctx.fill();   // ombre portée de la plaque
    const mg = ctx.createLinearGradient(0, py, 0, py + ph);
    mg.addColorStop(0, '#4a422c'); mg.addColorStop(0.5, '#2e2a1a'); mg.addColorStop(1, '#201c11');
    ctx.beginPath(); rr(ctx, px, py, pw, ph, rq); ctx.fillStyle = mg; ctx.fill();
    ctx.strokeStyle = 'rgba(224,169,46,0.55)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,236,190,0.12)'; ctx.lineWidth = 1; ctx.beginPath(); rr(ctx, px + 3, py + 3, pw - 6, ph - 6, rq * 0.7); ctx.stroke();
    // bande de chenille sous le mot (défile)
    const by = py + ph - bandH - 3, bx = px + rq * 0.6, bw = pw - rq * 1.2, step = Math.max(6, bandH * 0.9);
    const off = anim ? (now / 24) % step : 0;
    ctx.save(); ctx.beginPath(); rr(ctx, bx, by, bw, bandH, bandH * 0.35); ctx.clip();
    ctx.fillStyle = '#15120a'; ctx.fillRect(bx, by, bw, bandH);
    for (let x = bx - step; x < bx + bw + step; x += step) {
      ctx.fillStyle = '#5d5132'; ctx.fillRect(x + off + 1, by + 1.5, step - 2.5, bandH - 3);
      ctx.fillStyle = 'rgba(255,225,170,0.16)'; ctx.fillRect(x + off + 1, by + 1.5, step - 2.5, 1.5);
    }
    ctx.restore();
    // rivets aux quatre angles
    const ri = Math.max(2, fs * 0.055), ins = rq + ri + 1;
    for (const rx of [px + ins, px + pw - ins]) for (const ry of [py + ins, py + ph - ins]) {
      ctx.beginPath(); ctx.arc(rx, ry, ri, 0, Math.PI * 2); ctx.fillStyle = '#17130a'; ctx.fill();
      ctx.beginPath(); ctx.arc(rx - ri * 0.3, ry - ri * 0.3, ri * 0.45, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255,228,170,0.5)'; ctx.fill();
    }
    // cocardes étoilées de part et d'autre du mot
    const sr = fs * 0.2;
    for (const sx of [px + fs * 0.42, px + pw - fs * 0.42]) {
      ctx.fillStyle = '#3a3a22'; ctx.beginPath(); ctx.arc(sx, ty, sr * 1.25, 0, 6.283); ctx.fill();
      ctx.strokeStyle = 'rgba(224,169,46,0.6)'; ctx.lineWidth = 1.2; ctx.stroke();
      ctx.fillStyle = K.sand; starPath(ctx, sx, ty + sr * 0.05, sr); ctx.fill();
    }
    // impacts de balles dans le blindage
    for (const [u, v, s] of [[0.2, 0.22, 1], [0.83, 0.3, 0.8], [0.66, 0.72, 0.9]]) {
      const hx = px + pw * u, hy = py + ph * v, hr = Math.max(1.6, fs * 0.045) * s;
      ctx.fillStyle = '#0d0b06'; ctx.beginPath(); ctx.arc(hx, hy, hr, 0, 6.283); ctx.fill();
      ctx.strokeStyle = 'rgba(255,230,180,0.35)'; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.arc(hx, hy, hr * 1.5, -0.2, Math.PI * 0.9); ctx.stroke();
      ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.beginPath(); for (let k = 0; k < 4; k++) { const a = k * 1.7 + u * 5; ctx.moveTo(hx + Math.cos(a) * hr * 1.4, hy + Math.sin(a) * hr * 1.4); ctx.lineTo(hx + Math.cos(a) * hr * 2.6, hy + Math.sin(a) * hr * 2.6); } ctx.stroke();
    }
    // le mot : contour sombre (lueur chaude : un seul shadowBlur, sur un seul texte) puis remplissage sable
    if (anim) { ctx.shadowColor = 'rgba(224,169,46,0.55)'; ctx.shadowBlur = 16 + 5 * Math.sin(now / 620); }
    ctx.lineWidth = Math.max(2, fs * 0.1); ctx.strokeStyle = '#17130a'; ctx.strokeText(TXT, cx, ty);
    ctx.shadowBlur = 0;
    const tg = ctx.createLinearGradient(0, ty - fs * 0.5, 0, ty + fs * 0.5);
    tg.addColorStop(0, K.goldHi); tg.addColorStop(0.5, K.gold); tg.addColorStop(1, K.goldLo);
    ctx.fillStyle = tg; ctx.fillText(TXT, cx, ty);
    if (anim) {
      const g0 = (now / 2600) % 1, ga = Math.max(0, g0 - 0.12), gb = Math.min(1, g0 + 0.12);   // reflet qui balaie les lettres
      const gl = ctx.createLinearGradient(px, 0, px + pw, 0);
      gl.addColorStop(0, 'rgba(255,255,255,0)'); gl.addColorStop(ga, 'rgba(255,255,255,0)');
      gl.addColorStop(Math.min(gb, Math.max(ga, g0)), 'rgba(255,255,255,0.34)');
      gl.addColorStop(gb, 'rgba(255,255,255,0)'); gl.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gl; ctx.fillText(TXT, cx, ty);
      ctx.save(); ctx.beginPath(); rr(ctx, px, py, pw, ph, rq); ctx.clip(); ctx.fillStyle = 'rgb(222,203,158)';   // voile de poussière devant la plaque
      for (let k = 0; k < 6; k++) {
        const dx = (now / 1000 * (14 + k * 5) + k * 97) % (pw + 90) - 45 + px, dy = py + ph * (0.18 + 0.13 * k) + Math.sin(now / 1100 + k) * 5;
        ctx.globalAlpha = 0.05 + 0.035 * Math.sin(now / 900 + k * 1.7);
        ctx.beginPath(); oval(ctx, dx, dy, 22 + k * 5, 6 + k); ctx.fill();
      }
      ctx.restore();
    }
    // bandeau « OPÉRATION DÉSERT » au pochoir sous la plaque
    ctx.font = Math.round(Math.max(10, fs * 0.26)) + 'px ' + TITLE_FONT; ctx.fillStyle = 'rgba(230,207,152,0.8)';
    const sub = 'OPÉRATION DÉSERT', sw = ctx.measureText(sub).width, sy = py + ph + fs * 0.34;
    ctx.fillText(sub, cx, sy);
    ctx.strokeStyle = 'rgba(224,169,46,0.45)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(cx - sw / 2 - 30, sy); ctx.lineTo(cx - sw / 2 - 8, sy); ctx.moveTo(cx + sw / 2 + 8, sy); ctx.lineTo(cx + sw / 2 + 30, sy); ctx.stroke();
    ctx.restore();
  }
  function drawParade(c, y, now) {                   // char de parade qui traverse l'écran titre et tire de temps en temps
    const w = ARENA * 0.72, x0 = c - w / 2, anim = !A.reduceFx, per = 9000;
    const tt = anim ? (now % per) / per : 0.5, x = x0 + w * tt, al = anim ? Math.max(0, Math.min(1, tt / 0.08, (1 - tt) / 0.08)) : 1;
    ctx.save();
    ctx.strokeStyle = 'rgba(224,200,150,0.16)'; ctx.lineWidth = 1; ctx.setLineDash([6, 5]); ctx.beginPath(); ctx.moveTo(x0, y + 16); ctx.lineTo(x0 + w, y + 16); ctx.stroke(); ctx.setLineDash([]);
    if (anim) { ctx.fillStyle = 'rgb(190,164,116)'; for (let k = 1; k <= 5; k++) { ctx.globalAlpha = al * 0.18 * (1 - k / 6); ctx.beginPath(); ctx.arc(x - 12 - k * 7, y + Math.sin(now / 200 + k) * 1.5, 3 + k * 1.6, 0, 6.283); ctx.fill(); } }
    ctx.globalAlpha = 1;
    const ph = anim ? now % 3000 : 9999, spr = getTankSpr('title', '#8b8656', -1);
    TO.alpha = al; TO.trL = TO.trR = anim ? x : 0; TO.rc = ph < 160 ? 1 - ph / 160 : 0; TO.flash = anim && ph < 90 ? 1 - ph / 90 : 0; TO.lives = 3;
    TO.rapid = TO.triple = TO.pierce = TO.homing = TO.radar = false; TO.mineN = 0; TO.sway = anim ? -0.9 : 0;
    drawTank(spr, x, y, 0, TO, now);
    if (anim && ph < 700) {                          // traçante qui part droit devant
      const sx = x + TANK_R * 2 + ph * 0.5;
      if (sx < x0 + w + 20) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = al; ctx.strokeStyle = 'rgba(255,214,140,0.8)'; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(sx, y); ctx.lineTo(sx - 16, y); ctx.stroke(); ctx.drawImage(glow('255,200,110'), sx - 8, y - 8, 16, 16); }
    }
    ctx.restore();
  }
  function hazard(x, y, w, h) {                      // bande de danger jaune et noire
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    ctx.fillStyle = '#17130a'; ctx.fillRect(x, y, w, h); ctx.fillStyle = K.gold; ctx.beginPath();
    for (let sx = x - h * 2; sx < x + w + h; sx += h * 1.6) { ctx.moveTo(sx, y + h); ctx.lineTo(sx + h * 0.8, y + h); ctx.lineTo(sx + h * 1.8, y); ctx.lineTo(sx + h, y); ctx.closePath(); }
    ctx.fill(); ctx.restore();
  }
  function drawPause(c) {
    const pw = 250, ph = 96, px = c - pw / 2, py = c - ph / 2 - 12;
    ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(px + 4, py + 6, pw, ph);
    const mg = ctx.createLinearGradient(0, py, 0, py + ph); mg.addColorStop(0, '#4a422c'); mg.addColorStop(1, '#201c11');
    ctx.fillStyle = mg; ctx.fillRect(px, py, pw, ph);
    hazard(px, py, pw, 11); hazard(px, py + ph - 11, pw, 11);
    ctx.strokeStyle = 'rgba(224,169,46,0.6)'; ctx.lineWidth = 2; ctx.strokeRect(px, py, pw, ph);
    for (const rx of [px + 9, px + pw - 9]) { ctx.fillStyle = '#17130a'; ctx.beginPath(); ctx.arc(rx, py + ph / 2, 2.6, 0, 6.283); ctx.fill(); ctx.fillStyle = 'rgba(255,228,170,0.45)'; ctx.beginPath(); ctx.arc(rx - 0.8, py + ph / 2 - 0.8, 1.1, 0, 6.283); ctx.fill(); }
    ctx.font = '40px ' + TITLE_FONT; ctx.lineJoin = 'round'; ctx.lineWidth = 5; ctx.strokeStyle = K.ink; ctx.strokeText('PAUSE', c, py + ph / 2 + 1);
    const tg = ctx.createLinearGradient(0, py + ph / 2 - 20, 0, py + ph / 2 + 20); tg.addColorStop(0, K.goldHi); tg.addColorStop(0.5, K.gold); tg.addColorStop(1, K.goldLo);
    ctx.fillStyle = tg; ctx.fillText('PAUSE', c, py + ph / 2 + 1);
    ctx.font = '14px system-ui,sans-serif'; ctx.fillStyle = 'rgba(230,207,152,0.75)'; ctx.fillText('Cessez-le-feu — P / Échap pour reprendre', c, py + ph + 24);
    ctx.restore();
  }
  function drawCountdown(c, now) {
    const n = snap.count || 0, anim = !A.reduceFx, pulse = anim ? 1 + 0.06 * Math.sin(now / 110) : 1, cy = c - 6;
    ctx.fillStyle = 'rgba(20,14,6,0.32)'; ctx.fillRect(0, 0, ARENA, ARENA);
    ctx.save(); ctx.translate(c, cy);
    ctx.fillStyle = 'rgba(23,19,10,0.72)'; ctx.beginPath(); ctx.arc(0, 0, 70, 0, 6.283); ctx.fill();
    ctx.save(); ctx.rotate(anim ? now / 2400 : 0);    // viseur : couronne graduée qui tourne, croisillon
    ctx.strokeStyle = 'rgba(230,207,152,0.55)'; ctx.lineWidth = 1.2; ctx.setLineDash([3, 5]); ctx.beginPath(); ctx.arc(0, 0, 52, 0, 6.283); ctx.stroke(); ctx.setLineDash([]);
    ctx.lineWidth = 2; ctx.beginPath(); for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2; ctx.moveTo(Math.cos(a) * 58, Math.sin(a) * 58); ctx.lineTo(Math.cos(a) * 84, Math.sin(a) * 84); } ctx.stroke();
    ctx.lineWidth = 1; ctx.beginPath(); for (let k = 0; k < 24; k++) { const a = k * Math.PI / 12; ctx.moveTo(Math.cos(a) * 66, Math.sin(a) * 66); ctx.lineTo(Math.cos(a) * 70, Math.sin(a) * 70); } ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = K.gold; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(0, 0, 70, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (n > 0 ? n / 3 : 1)); ctx.stroke();
    ctx.scale(pulse, pulse); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    ctx.font = (n > 0 ? 78 : 40) + 'px ' + TITLE_FONT; ctx.lineWidth = 6; ctx.strokeStyle = K.ink; const lab = n > 0 ? String(n) : 'FEU !';
    ctx.strokeText(lab, 0, 3);
    const tg = ctx.createLinearGradient(0, -34, 0, 34); tg.addColorStop(0, K.goldHi); tg.addColorStop(0.5, K.gold); tg.addColorStop(1, K.goldLo);
    ctx.fillStyle = tg; ctx.fillText(lab, 0, 3);
    ctx.restore();
    ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = 'bold 14px system-ui,sans-serif'; ctx.lineJoin = 'round'; ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(23,19,10,0.85)';
    const sub = n > 0 ? 'Chargement des canons…' : 'Feu à volonté !'; ctx.strokeText(sub, c, cy + 100); ctx.fillStyle = K.sand; ctx.fillText(sub, c, cy + 100);
    ctx.restore();
  }
  // jauge du joueur local, en bas : obus disponibles (2 douilles) + bonus actifs (pictogramme + temps restant)
  function drawHudBar(me, now) {
    const used = (snap.shells || []).filter(s => s.o === mySeat).length, avail = Math.max(0, MAX_SHELLS - used);
    const chips = (me.buffs || []).map(b => [b[0], Math.max(0, Math.min(1, b[1])), 0]);
    if (me.shield) chips.push(['shield', 1, me.shield]); if (me.mineN) chips.push(['mine', 1, me.mineN]);
    const cw = 20, aw = MAX_SHELLS * 9 + 4, total = aw + chips.length * (cw + 4), y = ARENA - 17, x0 = ARENA / 2 - total / 2;
    ctx.save();
    ctx.fillStyle = 'rgba(22,17,9,0.62)'; ctx.beginPath(); rr(ctx, x0 - 7, y - 12, total + 14, 24, 6); ctx.fill();
    ctx.strokeStyle = 'rgba(224,169,46,0.35)'; ctx.lineWidth = 1; ctx.stroke();
    for (let i = 0; i < MAX_SHELLS; i++) {           // douilles : laiton plein = obus prêt
      const x = x0 + 2 + i * 9;
      if (i < avail) {
        ctx.fillStyle = '#d9a441'; ctx.fillRect(x, y - 3, 6, 9); ctx.fillStyle = '#9c6a22'; ctx.fillRect(x, y + 4, 6, 2);
        ctx.fillStyle = '#b87333'; ctx.beginPath(); ctx.moveTo(x, y - 3); ctx.lineTo(x, y - 6); ctx.quadraticCurveTo(x + 3, y - 11, x + 6, y - 6); ctx.lineTo(x + 6, y - 3); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(255,245,210,0.45)'; ctx.fillRect(x + 1, y - 2, 1.2, 7);
      } else { ctx.strokeStyle = 'rgba(230,207,152,0.35)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x + 0.5, y + 6); ctx.lineTo(x + 0.5, y - 6); ctx.quadraticCurveTo(x + 3, y - 10.5, x + 5.5, y - 6); ctx.lineTo(x + 5.5, y + 6); ctx.closePath(); ctx.stroke(); }
    }
    let x = x0 + aw + 4 + cw / 2;
    for (const [k, fr, cnt] of chips) {
      const d = PU[k] || { c: '#fff' };
      ctx.fillStyle = '#231f14'; ctx.beginPath(); ctx.arc(x, y, 9, 0, 6.283); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.14)'; ctx.lineWidth = 2; ctx.stroke();
      ctx.strokeStyle = d.c; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 9, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * fr); ctx.stroke();   // temps restant
      drawPU(k, x, y, 6.5, d.c);
      if (cnt > 1) { ctx.font = 'bold 9px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff'; ctx.fillText('×' + cnt, x + 8, y + 7); }
      x += cw + 4;
    }
    ctx.restore();
  }

  // ───────────────────────── rendu d'une image ─────────────────────────
  function drawParts(pass, now, kdt) {
    if (!parts.length) return;
    ctx.save(); if (pass === 2) ctx.globalCompositeOperation = 'lighter';
    for (let i = parts.length - 1; i >= 0; i--) {
      const q = parts[i]; if (q.pass !== pass) continue;
      const tt = (now - q.born) / q.life;
      if (tt >= 1) { parts.splice(i, 1); continue; }
      if (tt < 0) continue;
      const dd = q.dr === 1 ? 1 : Math.pow(q.dr, kdt);
      q.x += q.vx * kdt; q.y += q.vy * kdt; q.vx *= dd; q.vy *= dd;
      const k = q.k;
      if (k === 'dust') { ctx.globalAlpha = q.a * (1 - tt); ctx.fillStyle = q.fs; ctx.beginPath(); ctx.arc(q.x, q.y, q.r + q.g * tt, 0, 6.283); ctx.fill(); }
      else if (k === 'smoke') { q.x += WIND_X * kdt * tt; q.y += WIND_Y * kdt * tt; ctx.globalAlpha = q.a * Math.min(1, tt * 6) * (1 - tt); ctx.fillStyle = q.fs; ctx.beginPath(); ctx.arc(q.x, q.y, q.r + q.g * tt, 0, 6.283); ctx.fill(); }
      else if (k === 'debris') { q.rot += q.vr * kdt; ctx.globalAlpha = tt > 0.7 ? (1 - tt) / 0.3 : 1; ctx.fillStyle = q.fs; ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot); ctx.fillRect(-q.w / 2, -q.h / 2, q.w, q.h); ctx.restore(); }
      else if (k === 'spark') { ctx.globalAlpha = 1 - tt; ctx.strokeStyle = q.fs; ctx.lineWidth = 1.6 * (1 - tt) + 0.4; ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(q.x - q.vx * 2, q.y - q.vy * 2); ctx.stroke(); }
      else if (k === 'fire') { const r = q.r * (0.7 + 0.9 * tt), gl = tt < 0.25 ? glow('255,236,170') : tt < 0.55 ? q.gl : glow('200,70,30'); ctx.globalAlpha = 0.9 * (1 - tt); ctx.drawImage(gl, q.x - r, q.y - r, r * 2, r * 2); }
      else if (k === 'flash') { const r = q.r * (0.6 + 0.8 * tt); ctx.globalAlpha = (1 - tt) * (1 - tt); ctx.drawImage(q.gl, q.x - r, q.y - r, r * 2, r * 2); }
      else { const r = q.r * (1 - tt * 0.6); ctx.globalAlpha = 1 - tt; ctx.drawImage(q.gl, q.x - r * 2, q.y - r * 2, r * 4, r * 4); }   // braise
    }
    ctx.restore();
  }
  // crépuscule : 0 avant 60 s de manche, 1 à 150 s ; figé en pause et sur l'écran de fin
  function duskT(now) {
    if (!snap || snap.gs === 'lobby' || snap.gs === 'countdown') return 0;
    let ms = roundMs; if (snap.gs === 'play' && lastPlayT) ms += Math.min(250, now - lastPlayT);
    const t = (ms / 1000 - DUSK_T0) / DUSK_LEN;
    return t <= 0 ? 0 : t > 1 ? 1 : t;
  }
  // Éclairage dynamique (lumiere.js : sprites additifs, zéro dégradé par image). Sous les pièces.
  // CAMOUFLAGE : un char invisible sur cet écran n'émet rien (ni phares ni lueur) ; ses obus, si.
  function drawGroundLights(now, tv, dusk) {
    for (const s of (snap.shells || [])) lumiere(ctx, s.x, s.y, s.h ? 40 : 30, s.h ? '#ff8a50' : (s.p ? '#ff9be0' : colSeat(s.o)), 0.2 + 0.14 * dusk);   // traçantes
    for (const pk of (snap.pickups || [])) lumiere(ctx, pk.x, pk.y, 30, (PU[pk.t] || { c: '#ffffff' }).c, 0.1 + 0.12 * dusk);
    for (const mn of (snap.mines || [])) if (mn.armed && Math.sin(now / 120) > 0) lumiere(ctx, mn.x, mn.y, 24, '#ff4a3a', 0.22 + 0.12 * dusk);   // voyant rouge qui clignote
    if (dusk > 0.05) {                               // à la tombée du jour, les chars allument leurs phares
      for (const p of snap.players) {
        if (!p.playing || !p.alive || hiddenFor(p)) continue;
        const t = (tv && tv[p.seat]) || p, ca = Math.cos(t.angle || 0), sa = Math.sin(t.angle || 0);
        lumiere(ctx, t.x + ca * TANK_R * 2.6, t.y + sa * TANK_R * 2.6, TANK_R * 2.3, '#ffeec0', 0.32 * dusk);
      }
    }
    LUM.dessiner(ctx, now);                          // flashs : départs de tir, impacts, explosions, barils, EMP
  }
  const vis = [];                                     // chars visibles de cette image (réutilisé : pas d'allocation)
  function draw() {
    if (destroyed) return;
    const now = performance.now(), kdt = Math.min(3, Math.max(0.25, (now - (lastFrame || now - 16.7)) / 16.7)); lastFrame = now;
    const sc = cv.width / ARENA, c = ARENA / 2, fx = !A.reduceFx, R = TANK_R;
    let ox = 0, oy = 0;
    if (shakeMag > 0.3 && fx) { ox = (Math.random() * 2 - 1) * shakeMag; oy = (Math.random() * 2 - 1) * shakeMag; shakeMag *= Math.pow(0.86, kdt); } else shakeMag = 0;
    ctx.setTransform(sc, 0, 0, sc, ox * sc, oy * sc);
    ctx.fillStyle = K.bg; ctx.fillRect(-20, -20, ARENA + 40, ARENA + 40);
    ensureGround();
    if (snap && snap.grid) { ensureWalls(); ctx.drawImage(wallsCv, 0, 0, ARENA, ARENA); }   // décor statique pré-rendu : 1 drawImage
    else ctx.drawImage(groundCv, 0, 0, ARENA, ARENA);
    if (fx) drawAmbient(now);
    const dusk = duskT(now), tv = snap ? viewTanks(now) : null;
    if (snap) {
      if (fx) drawPrints(now); else prints.length = 0;
      if (fx) drawGroundLights(now, tv, dusk); else LUM.vider();   // lueurs sur le sol, sous les pièces
      // épaves / flaques de carburant qui brûlent encore quelques secondes
      if (fx && wrecks.length) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        for (let i = wrecks.length - 1; i >= 0; i--) {
          const w = wrecks[i], tt = (now - w.born) / w.life; if (tt >= 1) { wrecks.splice(i, 1); continue; }
          const r = 9 + 3 * Math.sin(now / 60 + w.s) + 2 * Math.sin(now / 37 + w.s * 2);
          lumiere(ctx, w.x, w.y, 58 + r * 1.5, '#ff7a2a', (0.26 + 0.1 * dusk) * (1 - tt));   // l'épave en feu éclaire le sable (vacille avec la flamme)
          ctx.globalAlpha = 0.75 * (1 - tt);
          ctx.drawImage(glow('255,140,50'), w.x - r * 1.6, w.y - r * 1.6, r * 3.2, r * 3.2);
          if (Math.random() < 0.22 * kdt) smokeAt(w.x, w.y, 1, '40,36,32', 4, 1400, 0.3);
        }
        ctx.restore();
      } else if (!fx) wrecks.length = 0;
      // barils explosifs (la boue est dans le pré-rendu)
      if (barrelSpr) (snap.barrels || []).forEach(b => ctx.drawImage(barrelSpr, b.x - 15, b.y - 15, 30, 30));
      // bonus au sol : plaque sombre cerclée de sa couleur + pictogramme, halo pré-rendu, onde qui pulse
      (snap.pickups || []).forEach(pk => {
        const d = PU[pk.t] || { c: '#ffffff' }, bob = fx ? Math.sin(now / 260 + pk.x * 0.1) : 0, rq = 12.5 + bob * 0.8;
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); oval(ctx, pk.x + 2, pk.y + 3, rq, rq * 0.9); ctx.fill();
        if (fx) {
          ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.3; ctx.drawImage(glow(rgbOf(d.c)), pk.x - rq * 2, pk.y - rq * 2, rq * 4, rq * 4); ctx.globalCompositeOperation = 'source-over';
          const ph = (now / 1400 + pk.y / 97) % 1; ctx.strokeStyle = d.c; ctx.globalAlpha = 0.5 * (1 - ph); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(pk.x, pk.y, rq + ph * 14, 0, 6.283); ctx.stroke();
        }
        ctx.globalAlpha = 1; ctx.fillStyle = '#231f14'; ctx.beginPath(); ctx.arc(pk.x, pk.y, rq, 0, 6.283); ctx.fill();
        ctx.strokeStyle = d.c; ctx.lineWidth = A.contrast ? 3.5 : 2.4; ctx.stroke();
        ctx.strokeStyle = 'rgba(255,250,230,0.16)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(pk.x, pk.y, rq - 3, Math.PI * 1.05, Math.PI * 1.65); ctx.stroke();
        if (A.contrast) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(pk.x, pk.y, rq + 2.4, 0, 6.283); ctx.stroke(); }
        ctx.restore();
        drawPU(pk.t, pk.x, pk.y, 10 * (1 + bob * 0.04), d.c);
      });
      // mines antichar : galette, plateau de pression, liseré du poseur ; armée = voyant rouge + rayon de déclenchement
      (snap.mines || []).forEach(mn => {
        const col = colSeat(mn.o), on = mn.armed && (A.reduceFx || Math.sin(now / 120) > 0);
        ctx.save();
        if (mn.armed) { ctx.strokeStyle = 'rgba(255,90,70,0.2)'; ctx.lineWidth = 1; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.arc(mn.x, mn.y, MINE_R, 0, 6.283); ctx.stroke(); ctx.setLineDash([]); }
        ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.arc(mn.x + 1.2, mn.y + 1.8, 7.5, 0, 6.283); ctx.fill();
        ctx.fillStyle = '#3b3d2a'; ctx.beginPath(); ctx.arc(mn.x, mn.y, 7, 0, 6.283); ctx.fill();
        ctx.strokeStyle = '#5c5f43'; ctx.lineWidth = 1.2; ctx.stroke();
        ctx.fillStyle = '#26281b'; ctx.beginPath(); for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3, bx = mn.x + Math.cos(a) * 5.2, by = mn.y + Math.sin(a) * 5.2; ctx.moveTo(bx + 0.8, by); ctx.arc(bx, by, 0.8, 0, 6.283); } ctx.fill();
        ctx.fillStyle = '#4f5238'; ctx.beginPath(); ctx.arc(mn.x, mn.y, 3.4, 0, 6.283); ctx.fill();
        ctx.strokeStyle = col; ctx.lineWidth = 1.6; ctx.globalAlpha = 0.85; ctx.beginPath(); ctx.arc(mn.x, mn.y, 8.6, 0, 6.283); ctx.stroke(); ctx.globalAlpha = 1;
        ctx.fillStyle = mn.armed ? (on ? '#ff4a3a' : '#7a1d16') : '#6b6b6b'; ctx.beginPath(); ctx.arc(mn.x, mn.y, 1.7, 0, 6.283); ctx.fill();
        if (on && fx) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.7; ctx.drawImage(glow('255,70,50'), mn.x - 8, mn.y - 8, 16, 16); }
        ctx.restore();
      });
      drawParts(0, now, kdt);                          // poussière, éclats, mottes : au sol, sous les chars
      // chars — passe 1 : chenilles au sol + ombres ; passe 2 : caisses ; passe 3 : états, barres, repères
      const me = mySeat >= 0 ? snap.players[mySeat] : null, myRadar = !!(me && me.radar), over = snap.gs === 'over';
      vis.length = 0;
      for (const p of snap.players) {
        if (!p.playing || !p.alive) continue;
        const t = (tv && tv[p.seat]) || p, tr = stepTread(p, t, now, kdt);
        const alpha = p.camo ? (hiddenFor(p) ? 0 : 0.5) : 1;
        if (alpha <= 0) continue;                     // camouflé : ni caisse, ni barre de vie — seuls ses obus et ses traces le trahissent
        tr.p = p; tr.alpha = p.invuln ? alpha * (A.reduceFx ? 0.55 : 0.35 + 0.35 * Math.sin(now / 60)) : alpha; tr.vx = t.x; tr.vy = t.y; tr.va = t.angle;
        vis.push(tr);
        ctx.save(); ctx.globalAlpha = tr.alpha; ctx.translate(t.x + 2.2, t.y + 3.2); ctx.rotate(t.angle);
        ctx.fillStyle = 'rgba(15,9,3,0.38)'; ctx.beginPath(); rr(ctx, -R * 1.08, -R * 0.94, R * 2.16, R * 1.88, R * 0.2); ctx.fill(); ctx.fillRect(R * 0.3, -R * 0.13, R * 1.45, R * 0.26);
        ctx.restore();
      }
      for (const tr of vis) {
        const p = tr.p, col = colSeat(p.seat), spr = getTankSpr(p.seat, col, p.seat);
        const age = now - (recoil[p.seat] || -1e9);
        TO.alpha = tr.alpha; TO.trL = A.reduceFx ? 0 : tr.l; TO.trR = A.reduceFx ? 0 : tr.r; TO.rc = A.reduceFx || age > 170 ? 0 : 1 - age / 170; TO.flash = fx && age < 85 ? 1 - age / 85 : 0;
        TO.lives = p.lives; TO.rapid = !!p.rapid; TO.triple = !!p.triple; TO.pierce = !!p.pierce; TO.homing = !!p.homing; TO.radar = !!p.radar; TO.mineN = p.mineN | 0; TO.sway = A.reduceFx ? 0 : tr.sway;
        drawTank(spr, tr.vx, tr.vy, tr.va, TO, now);
        // avatar du pilote sur la trappe de tourelle, toujours à l'endroit ; jamais pour un char invisible
        // sur cet écran (il n'est pas dans `vis`) ; les bots n'en ont pas
        if (!p.bot && p.name) {
          ctx.save(); if (tr.alpha < 1) ctx.globalAlpha = tr.alpha;
          dessinerAvatar(ctx, p.name, tr.vx - Math.cos(tr.va) * R * 0.08, tr.vy - Math.sin(tr.va) * R * 0.08, R * 0.9, sc, A.contrast ? '#ffffff' : col);
          ctx.restore();
        }
        if (fx) {                                     // émis par le CHAR (donc jamais pour un char invisible sur cet écran)
          const ca = Math.cos(tr.va), sa = Math.sin(tr.va);
          if (tr.mv > 0.3 && Math.random() < 0.1 * kdt) smokeAt(tr.vx - ca * R * 1.05 - sa * R * 0.35, tr.vy - sa * R * 1.05 + ca * R * 0.35, 1, '110,104,94', 2, 650, 0.3, tr.va + Math.PI);   // échappement
          if (p.lives <= 1 && Math.random() < 0.22 * kdt) smokeAt(tr.vx - ca * R * 0.7, tr.vy - sa * R * 0.7, 1, '52,50,50', 3, 1100, 0.35);   // fumée de char endommagé
          if (p.lives <= 1 && Math.random() < 0.15 * kdt) embersAt(tr.vx - ca * R * 0.7, tr.vy - sa * R * 0.7, 1, 0.6);
          if (over && overAt && now - overAt < 3200 && Math.random() < 0.45 * kdt) smokeAt(tr.vx, tr.vy, 1, rgbOf(col), 4, 1600, 0.5);   // fumigène de victoire aux couleurs du siège
        }
      }
      for (const tr of vis) {
        const p = tr.p, col = colSeat(p.seat), x = tr.vx, y = tr.vy, al = tr.alpha;
        ctx.save(); ctx.globalAlpha = al;
        if (p.speed && tr.mv > 0.3) {                 // vitesse : traits de vitesse derrière les chenilles
          const ca = Math.cos(tr.va), sa = Math.sin(tr.va), dir = tr.fwd >= 0 ? 1 : -1;
          ctx.strokeStyle = 'rgba(127,240,189,0.55)'; ctx.lineWidth = 1.4; ctx.lineCap = 'round'; ctx.beginPath();
          for (const s of [-1, 1]) { const bx = x - ca * R * 1.2 * dir - sa * s * R * 0.76, by = y - sa * R * 1.2 * dir + ca * s * R * 0.76; ctx.moveTo(bx, by); ctx.lineTo(bx - ca * 10 * dir, by - sa * 10 * dir); }
          ctx.stroke();
        }
        if (p.shield) {                               // bouclier : bulle d'énergie (sprite de lueur) + segments qui tournent ; 2 anneaux à ×2
          if (fx) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = al * (0.28 + 0.1 * Math.sin(now / 200)); ctx.drawImage(glow('127,209,255'), x - R * 2.2, y - R * 2.2, R * 4.4, R * 4.4); ctx.globalCompositeOperation = 'source-over'; }
          ctx.globalAlpha = al * (A.reduceFx ? 0.85 : 0.6 + 0.3 * Math.sin(now / 200)); ctx.strokeStyle = '#7fd1ff'; ctx.lineWidth = 2;
          const rot = A.reduceFx ? 0 : now / 900;
          ctx.beginPath(); for (let k = 0; k < 6; k++) { const a0 = rot + k * Math.PI / 3; ctx.moveTo(x + Math.cos(a0) * (R + 6), y + Math.sin(a0) * (R + 6)); ctx.arc(x, y, R + 6, a0, a0 + Math.PI / 3 - 0.18); } ctx.stroke();
          if (p.shield > 1) { ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(x, y, R + 9.5, 0, 6.283); ctx.stroke(); }
          ctx.globalAlpha = al;
        }
        if (p.emp) {                                  // étourdi : arcs électriques qui crépitent autour de la caisse
          ctx.strokeStyle = '#bff3ff'; ctx.lineWidth = 1.5; ctx.lineJoin = 'round';
          if (A.reduceFx) { ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.arc(x, y, R + 5, 0, 6.283); ctx.stroke(); ctx.setLineDash([]); }
          else {
            const fr = Math.floor(now / 70); ctx.globalAlpha = al * 0.9; ctx.beginPath();
            for (let k = 0; k < 3; k++) { const a0 = hash2(fr, k + p.seat * 3) * 6.283; for (let s = 0; s <= 4; s++) { const a = a0 + s * 0.28, rq = R + 3 + hash2(fr + s, k) * 7; s ? ctx.lineTo(x + Math.cos(a) * rq, y + Math.sin(a) * rq) : ctx.moveTo(x + Math.cos(a) * rq, y + Math.sin(a) * rq); } }
            ctx.stroke(); ctx.globalAlpha = al;
          }
        }
        if (p.camo) {                                 // camouflé mais visible pour moi (moi, allié, radar) : liseré pointillé mauve
          ctx.strokeStyle = '#b9a6ff'; ctx.lineWidth = 1.4; ctx.setLineDash([4, 4]); ctx.lineDashOffset = A.reduceFx ? 0 : -now / 50;
          ctx.globalAlpha = 0.9; ctx.beginPath(); ctx.arc(x, y, R + 4, 0, 6.283); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = al;
        }
        if (p.invuln && !A.reduceFx) { ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1.2; ctx.setLineDash([2, 5]); ctx.lineDashOffset = now / 40; ctx.beginPath(); ctx.arc(x, y, R + 7, 0, 6.283); ctx.stroke(); ctx.setLineDash([]); }   // réapparition protégée
        ctx.restore();
        if (myRadar && p.seat !== mySeat && (!teamMode || (me && p.team !== me.team))) { ctx.save(); ctx.strokeStyle = '#7ff0bd'; ctx.globalAlpha = A.reduceFx ? 0.6 : 0.4 + 0.3 * Math.sin(now / 150); ctx.setLineDash([4, 4]); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, R + 8, 0, 6.283); ctx.stroke(); ctx.restore(); }   // détecté au radar
        if (p.seat === mySeat && !over) {           // repère « c'est moi » : anneau pulsé + chevron d'or au-dessus de la barre
          ctx.save(); ctx.strokeStyle = '#fff'; ctx.globalAlpha = A.reduceFx ? 0.8 : 0.5 + 0.4 * Math.sin(now / 220); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, R + 3, 0, 6.283); ctx.stroke();
          ctx.globalAlpha = 1; const ty = y - R - 13; ctx.fillStyle = K.gold; ctx.strokeStyle = K.ink; ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.moveTo(x - 5, ty - 6); ctx.lineTo(x + 5, ty - 6); ctx.lineTo(x, ty); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
        }
        if (over && !A.reduceFx) { ctx.save(); ctx.strokeStyle = K.gold; ctx.lineWidth = 2.5; ctx.globalAlpha = 0.5 + 0.4 * Math.sin(now / 180); ctx.beginPath(); ctx.arc(x, y, R + 9, 0, 6.283); ctx.stroke(); ctx.restore(); }   // vainqueur(s) auréolé(s)
        if (al > 0.3 || p.seat === mySeat) {          // barre de vie : 3 segments, rouge à 1 vie
          const MAXL = 3, bw = R * 2, bh = 3, bx0 = x - bw / 2, by0 = y - R - 8, seg = bw / MAXL;
          ctx.save(); ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(bx0 - 1, by0 - 1, bw + 2, bh + 2);
          for (let l = 0; l < MAXL; l++) { ctx.fillStyle = l < p.lives ? (p.lives === 1 ? '#ff5a5a' : col) : 'rgba(255,255,255,0.16)'; ctx.fillRect(bx0 + l * seg + 0.5, by0, seg - 1, bh); }
          ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(bx0, by0, bw, 1); ctx.restore();
        }
      }
      // obus : halo, traçante additive, ogive orientée ; missile guidé : fusée + fumée
      for (const s of (snap.shells || [])) {
        const col = s.h ? '#ff6a6a' : (s.p ? '#ff9be0' : colSeat(s.o)), rgb = rgbOf(col);
        const m = Math.hypot(s.vx || 0, s.vy || 0) || 1, ux = (s.vx || 0) / m, uy = (s.vy || 0) / m, ang = Math.atan2(uy, ux);
        if (fx && (s.vx || s.vy)) {
          ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
          ctx.globalAlpha = 0.38; ctx.strokeStyle = col; ctx.lineWidth = 3.4; ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x - ux * 20, s.y - uy * 20); ctx.stroke();
          ctx.globalAlpha = 0.6; ctx.strokeStyle = '#fff4d8'; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x - ux * 11, s.y - uy * 11); ctx.stroke();
          ctx.globalAlpha = 0.55; ctx.drawImage(glow(rgb), s.x - 11, s.y - 11, 22, 22);
          ctx.restore();
          if (s.h && Math.random() < 0.55 * kdt) smokeAt(s.x - ux * 7, s.y - uy * 7, 1, '170,160,150', 1.6, 600, 0.15);
        }
        ctx.save(); ctx.fillStyle = col; ctx.globalAlpha = 0.6; ctx.beginPath(); ctx.arc(s.x, s.y, SHELL_R + (s.p ? 2.5 : 1.6), 0, 6.283); ctx.fill(); ctx.globalAlpha = 1;
        if (A.contrast) { ctx.strokeStyle = 'rgba(0,0,0,0.85)'; ctx.lineWidth = 1; ctx.stroke(); }
        ctx.translate(s.x, s.y); ctx.rotate(ang);
        if (s.h) {
          ctx.fillStyle = '#4a4640'; ctx.beginPath(); ctx.moveTo(-4, -1.6); ctx.lineTo(-6.4, -3.6); ctx.lineTo(-6.4, 3.6); ctx.lineTo(-4, 1.6); ctx.closePath(); ctx.fill();   // ailettes
          ctx.fillStyle = '#ece8dc'; ctx.beginPath(); oval(ctx, 0, 0, 5.6, 2.1); ctx.fill();
          ctx.fillStyle = '#ff4a3a'; ctx.beginPath(); ctx.arc(4.2, 0, 1.6, 0, 6.283); ctx.fill();
          if (fx) { ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(glow('255,170,80'), -11, -4, 8, 8); }
        } else { ctx.beginPath(); oval(ctx, 0, 0, SHELL_R * 1.15, SHELL_R * 0.78); ctx.fillStyle = '#fff6dc'; ctx.fill(); ctx.lineWidth = 1.2; ctx.strokeStyle = col; ctx.stroke(); }
        ctx.restore();
      }
      drawParts(1, now, kdt); drawParts(2, now, kdt);   // fumée puis lumières additives
      if (fx && rings.length) {                        // ondes de choc
        ctx.save();
        for (let i = rings.length - 1; i >= 0; i--) { const q = rings[i], tt = (now - q.born) / q.life; if (tt >= 1) { rings.splice(i, 1); continue; } if (tt < 0) continue; const e = 1 - (1 - tt) * (1 - tt); ctx.globalAlpha = 0.7 * (1 - tt); ctx.strokeStyle = q.col; ctx.lineWidth = q.lw * (1 - tt * 0.6); ctx.beginPath(); ctx.arc(q.x, q.y, q.r0 + (q.r1 - q.r0) * e, 0, 6.283); ctx.stroke(); }
        ctx.restore();
      } else if (!fx) { rings.length = 0; parts.length = 0; }
      // la manche s'étire : le soleil se couche sur le désert (étalonnage par-dessus l'arène, sous la jauge et les écrans)
      if (dusk > 0) crepuscule(ctx, -20, -20, ARENA + 40, ARENA + 40, dusk, { soleil: 'gauche', force: (A.reduceFx ? 0.55 : 1) * (A.contrast ? 0.6 : 1) });
      if (me && me.playing && me.alive && snap.gs === 'play') drawHudBar(me, now);
    }

    if (snap && snap.gs === 'countdown') drawCountdown(c, now);
    if (snap && (snap.gs === 'lobby' || snap.gs === 'paused')) {
      ctx.fillStyle = 'rgba(12,9,4,0.66)'; ctx.fillRect(0, 0, ARENA, ARENA);
      if (snap.gs === 'paused') drawPause(c);
      else {
        drawTitle(c, c - 84, now);
        const n = snap.connected || 0, nb = snap.botCount || 0, tot = n + nb;
        ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = teamMode ? '#9fd0ff' : 'rgba(230,207,152,.8)'; ctx.font = '15px system-ui,sans-serif';
        ctx.fillText(`${n} pilote${n > 1 ? 's' : ''}${nb ? ' + ' + nb + ' bot' + (nb > 1 ? 's' : '') : ''}${teamMode ? ' · ' + (MODE_NAME[snap.mode] || snap.mode) : ''} · ${snap.winTarget === 1 ? '1 manche' : snap.winTarget + ' manches'}`, c, c + 6);
        ctx.fillStyle = 'rgba(230,207,152,.66)'; ctx.font = 'bold 13px system-ui,sans-serif';
        ctx.fillText(tot >= 2 ? '▶ Espace / clic pour lancer l\'assaut' : 'En attente d\'un 2ᵉ pilote… (ou ajoute un bot 🤖)', c, c + 32);
        ctx.restore();
        drawParade(c, c + 84, now);
      }
    }
  }
  function drawLoop() { if (destroyed) return; try { draw(); } catch (e) { console.error('[render]', e); } rafId = requestAnimationFrame(drawLoop); }   // filet : une erreur de rendu ne fige plus le jeu

  // ───────────────────────── entrées ─────────────────────────
  function pushInput() { send({ t: 'input', left: input.left, right: input.right, fwd: input.fwd, back: input.back, fire: input.fire }); }
  function setIn(k, v) { if (input[k] === v) return; input[k] = v; pushInput(); }
  const onKeyDown = e => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
    unlockAudio();
    const playing = snap && (snap.gs === 'play' || snap.gs === 'paused');
    if (e.key === ' ') { if (snap && snap.gs !== 'play' && snap.gs !== 'paused') { send({ t: 'start' }); return; } setIn('fire', true); return; }
    if ((e.code === 'KeyE' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') && playing) { send({ t: 'mine' }); return; }
    if ((e.key === 'p' || e.key === 'P' || e.key === 'Escape') && playing) { send({ t: 'pause' }); return; }
    const a = KEYMAP[e.code]; if (a && !e.repeat) setIn(a, true);
  };
  const onKeyUp = e => { if (e.key === ' ') { setIn('fire', false); return; } const a = KEYMAP[e.code]; if (a) setIn(a, false); };
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
    cv = $('tkc'); ctx = cv.getContext('2d'); hud = $('tkHud'); endEl = $('tkEnd');
    groundKey = ''; blockKey = ''; wallsKey = '';   // les sprites en cache appartiennent à l'ancienne taille : on repart propre
    const wrap = cv.parentElement;                                     // messages de bonus/malus : posés dans le cadre du canvas
    initGameMsg(wrap && wrap.classList.contains('canvas-wrap') ? wrap : null);
    hud.innerHTML = '';             // module réutilisé : repartir d'un HUD vide (sinon les cartes P1.. se cumulent à chaque retour)
    cards = Array.from({ length: MAX_SEATS }, (_, i) => i).map(i => { const el = document.createElement('div'); el.className = 'pc hidden'; el.innerHTML = `<div class="dot"></div><div class="inf"><div class="pn">P${i + 1}</div><div class="lv"></div></div>`; hud.appendChild(el); return el; });
    startBtn = $('tkStart'); pauseBtn = $('tkPause'); modeBtn = $('tkMode'); botsBtn = $('tkBots'); arenaBtn = $('tkArena'); winBtn = $('tkWin'); ffBtn = $('tkFf'); pauseFloat = $('tkPauseFloat');
    lbBtn = $('tkLbBtn'); lbPanel = $('tkLbPanel'); lbBody = $('tkLbBody');
    startBtn.onclick = () => { unlockAudio(); send({ t: 'start' }); };
    pauseBtn.onclick = () => send({ t: 'pause' }); pauseFloat.onclick = () => send({ t: 'pause' });
    modeBtn.onclick = () => send({ t: 'mode' }); arenaBtn.onclick = () => send({ t: 'arena' }); winBtn.onclick = () => send({ t: 'wintarget' }); ffBtn.onclick = () => send({ t: 'ff' });
    if (botsBtn) botsBtn.onclick = () => send({ t: 'bots' });
    diffBtn = $('tkDiff'); if (diffBtn) diffBtn.onclick = () => send({ t: 'botdiff' });
    lbBtn.onclick = () => { togglePanel(lbPanel); renderLB(); };
    const helpBtn = $('tkHelp'), helpPanel = $('tkHelpPanel'); if (helpBtn && helpPanel) helpBtn.onclick = () => togglePanel(helpPanel);
    if (premiere) cv.addEventListener('click', () => { unlockAudio(); if (snap && snap.gs !== 'play' && snap.gs !== 'paused') send({ t: 'start' }); });
    if (premiere) endEl.addEventListener('click', () => { unlockAudio(); send({ t: 'start' }); });
    if (premiere) { hold('tkLeft', 'left'); hold('tkRight', 'right'); hold('tkFwd', 'fwd'); hold('tkBack', 'back'); hold('tkFire', 'fire'); }
    const mineBtn = $('tkMine'); if (mineBtn && premiere) mineBtn.addEventListener('pointerdown', e => { e.preventDefault(); send({ t: 'mine' }); });
    applyColors(); resizeH = resizeCanvas; addEventListener('resize', resizeH); resizeCanvas();
    addEventListener('keydown', onKeyDown); addEventListener('keyup', onKeyUp); addEventListener('blur', onBlur);
    music.start();
    rafId = requestAnimationFrame(drawLoop);
  }
  function onA11y() { applyColors(); }
  function teardown() {
    destroyed = true; music.stop(); cancelAnimationFrame(rafId);
    removeEventListener('resize', resizeH); removeEventListener('keydown', onKeyDown); removeEventListener('keyup', onKeyUp); removeEventListener('blur', onBlur);
    for (const k in input) input[k] = false;           // touches relâchées côté client SANS rien envoyer : le hub a peut-être déjà changé de jeu
  }

  return { init, onState, onMessage, onLb, onA11y, teardown };
})();
