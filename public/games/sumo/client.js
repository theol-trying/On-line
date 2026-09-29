// Module client SUMO : dohyō vu de dessus, poussée physique à 30 Hz, charge / ancrage, bonus, FFA/équipes.
// Calqué sur Tron (structure, HUD, écran de fin, câblage unique des écouteurs) et sur Tanks (mouvement
// continu interpolé, décor statique pré-rendu hors écran). Identité propre « Dohyō » : argile, cordon de
// paille, sel rituel, pompons du toit suspendu, bois laqué, vermillon, washi et encre.
import { AR0, RING0, PR } from './shared.js';
import { createMusic } from '../../music.js';
import { seatPattern, SEAT_GLYPH } from '../../patterns.js';   // motif par siège, peint sur la ceinture (mawashi)
import { initGameMsg, msgPerso, msgGlobal } from '../../gamemsg.js';
import { arenaSize } from '../../layout.js';   // taille du plateau : commune à tous les jeux (mode plein écran compris)
import { lumiere, creerLumieres } from '../../lumiere.js';      // lanternes, charges, ondes et sorties éclairent l'argile
import { crepuscule, creerDuel } from '../../crepuscule.js';               // le jour tombe à mesure que la paille se referme
import { creerJournal, blocFin } from '../../finpartie.js';     // courbe du combat + meilleure action à l'écran de fin
import { createRalenti } from '../../ralenti.js';               // ralenti du dernier coup (sortie décisive) rejoué à la fin de manche
import { drawPodium, podiumEntries } from '../../podium.js';       // podium canvas de fin de manche (lutteurs dessinés par le jeu)
import { createDuelCam } from '../../camera-duel.js';              // caméra de duel : zoom doux sur les deux derniers lutteurs
import { createStreaks, streakText, createCallouts, createHitStop, drawFlash, drawDanger, drawSeatChip, readable, hudK } from '../../exploits.js';   // aides visuelles partagées (séries, arrêt sur image, vignette, pastilles)

// Duel final (crepuscule.js) : quand il ne reste que 2 joueurs ou 2 équipes, la nuit tombe en ~4 s.
const DUEL = creerDuel(), duelAnnonce = () => msgGlobal('⚔', 'Duel final !', { color: '#ff5a3c' });

// musique : gamme pentatonique japonaise in-sen (0,1,5,7,8) — bourdon de quinte, pincements de koto,
// taiko graves en jeu, flûte (shakuhachi) douce ; climax (mort subite / duel final) = taiko serrés + tempo.
const MUSIC_THEME = { bpm: 92, bpmBoost: 16, vol: 0.5, root: 73.42, len: 32,
  stingers: { kill: { notes: [12, 8, 7, 0], wave: 'triangle', oct: 1, gain: 0.05, dur: 0.24, rate: 0.08 },
    win: { base: 293.66, notes: [[0, 7], [5, 12], [7, 12, 19], [12, 19, 24]], gain: 0.035, dur: 0.42, rate: 0.16 },
    count: { notes: [0], oct: 2, wave: 'triangle', dur: 0.14, gain: 0.045, duck: false }, go: { notes: [[0, 7, 12]], oct: 2, wave: 'triangle', dur: 0.5, gain: 0.05, duck: false },
    alert: { notes: [0, 1, 5, 7, 8, 12, 13], oct: 1, wave: 'triangle', rate: 0.07, dur: 0.16, gain: 0.04 } },
  layers: [
  { seq: [[0, 7], null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, [1, 8], null, null, null, null, null, null, null, [-5, 0], null, null, null, null, null, null, null], wave: 'sine', gain: 0.02, dur: 14 },
  { seq: [24, null, null, 25, null, null, 29, null, 31, null, null, 29, null, 25, null, null, 24, null, null, null, 20, null, 19, null, null, null, 17, null, 19, null, null, null], wave: 'triangle', gain: 0.022, dur: 0.9 },   // koto pincé
  { drums: 'K.......K.....K.K.......K..K....', gain: 1, min: 1 },                                                                                // taiko graves
  { seq: [12, null, null, null, null, null, null, null, 13, null, null, null, 17, null, null, null, 19, null, null, null, null, null, 17, null, 13, null, null, null, 12, null, null, null], oct: 1, wave: 'sine', gain: 0.016, dur: 5, min: 1 },   // shakuhachi
  { drums: 'K.K.K...K.KK..S.K.K.K...K.KKS.S.', gain: 0.8, min: 2 },                                                                             // roulement de mort subite
  { seq: [0, 5, 7, 8, 12, 8, 7, 5], oct: 1, wave: 'triangle', gain: 0.012, dur: 0.6, min: 2 },
] };

// 10 sièges : au-delà de 8 il n'existe plus de teintes toutes distinguables entre elles,
// c'est le MOTIF par siège (patterns.js), peint sur la mawashi, qui porte l'identification.
const PAL = { normal: ['#4a9ee0', '#e06240', '#2aaf7a', '#cc9010', '#9b6cf0', '#e268b0', '#25c9c0', '#9ec93a', '#d06ef0', '#f2f0e6'],
              cb: ['#0072B2', '#E69F00', '#009E73', '#F0E442', '#CC79A7', '#56B4E9', '#D55E00', '#F5F5F5', '#7B68EE', '#9A9A9A'] };
const TEAMPAL = { normal: ['#4a9ee0', '#e06240', '#2aaf7a', '#cc9010', '#9b6cf0'], cb: ['#0072B2', '#E69F00', '#009E73', '#F0E442', '#CC79A7'] };
const TEAM_LETTER = ['A', 'B', 'C', 'D', 'E'];
const MODE_NAME = { ffa: 'Chacun pour soi', '2v2': '2 v 2', '2v2v2': '2 v 2 v 2', '3v3': '3 v 3', '4v4': '4 v 4', '2v2v2v2': '2 v 2 v 2 v 2', '3v3v3': '3 v 3 v 3', '5v5': '5 v 5', '2v2v2v2v2': '2 v 2 v 2 v 2 v 2' };
const MAX_SEATS = 10;                                   // le snapshot porte TOUJOURS les 10 sièges, comme Tron
const TEAM_TOTALS = [4, 6, 8, 9, 10];                   // effectifs pour lesquels le serveur propose un mode par équipes
const TICK_HZ = 30;                                     // cadence serveur : elimTick est compté en ticks
const DIFF_NAMES = ['Facile', 'Normale', 'Difficile'];

// Identité « Dohyō » : palette fixe (le sélecteur de thème Néon/CRT/Clair ne s'applique pas ici,
// comme pour Tanks/Snake — chaque jeu a son univers).
const K = { wood: '#1a120e', verm: '#e0452f', clay: '#c9a36b', straw: '#d9c27a', washi: '#f1e6d0', ink: '#1c1a17', gold: '#e0b23c' };
const DISP = "'Dela Gothic One', Impact, sans-serif";   // police d'affichage (Google Fonts, chargée par la page)
const SKIN = [231, 181, 140];                           // peau de base, teintée ensuite vers la couleur du siège

// Bonus au sol. Les icônes du panneau d'aide (index.html) sont 🍙 ⚡ 💥 👣 : le dessin au canvas reprend
// la MÊME idée (onigiri, éclair, onde, empreinte) en vectoriel — les emoji varient trop d'un OS à l'autre.
const PU = { heavy: { i: '🍙', c: '#8a5a2b' }, dash: { i: '⚡', c: '#e0452f' }, shock: { i: '💥', c: '#3d6fb6' }, grip: { i: '👣', c: '#3f8f4f' } };
// Libellés au ramassage — constantes du client uniquement, jamais une chaîne venue du réseau.
const PU_MSG = {
  heavy: { t: 'plus lourd, plus fort, moins vif' },   // préfixé « Onigiri N/5 : » au ramassage
  dash: { t: 'Élan : charge prête, recharge 2× plus vite (15 s)' },
  grip: { t: 'Pieds collés : presque inamovible (12 s)' },
};
// Malus subis quand un ADVERSAIRE ramasse un bonus — message au seul joueur visé. Glyphes anciens (pas de
// séquence ZWJ ni d'emoji récent) : les vieux iOS les affichent.
const MALUS_MSG = {
  tired: { i: '💦', t: 'Essoufflé : ta charge recharge plus lentement (8 s)', c: '#c0503a' },
  slip: { i: '❄', t: 'Sol glissant : tu glisses plus loin (8 s)', c: '#3f8fc0' },
  stun: { i: '💫', t: 'Sonné ! (1,2 s)', c: '#3d6fb6' },
};
const SHOCK_MSG = { i: '💥', t: 'Onde de choc !' };
const SHRINK_MSG = { i: '⚠', t: 'Le dohyō rétrécit !' };
const DIR_KEYS = { ArrowUp: 'up', KeyW: 'up', KeyZ: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', KeyQ: 'left', ArrowRight: 'right', KeyD: 'right' };   // ZQSD / WASD : KeyW/KeyA = touches Z/Q en AZERTY ; KeyZ/KeyQ pour un clavier réglé en QWERTY
// lueurs (composition additive) : teintes claires, les couleurs sombres des jetons n'ajouteraient presque rien
const PU_LUM = { heavy: '#ffd9a0', dash: '#ff7a55', shock: '#7fb0ff', grip: '#8fe0a0' };
const puLum = t => Object.prototype.hasOwnProperty.call(PU_LUM, t) ? PU_LUM[t] : '#ffffff';   // `t` vient du réseau : jamais une clé du prototype
const DUSK_FLOOR = 0.45;                                // plancher du cercle (RING_MIN serveur) : paille au plancher = nuit tombée
const TASSELS = [                                        // pompons du tsuriyane : NO noir (nord), NE vert (est), SE rouge (sud), SO blanc (ouest)
  { sx: -1, sy: -1, c: '#2a2622', h: '#4a443d' }, { sx: 1, sy: -1, c: '#2f8f5b', h: '#58b882' },
  { sx: 1, sy: 1, c: '#c8372d', h: '#ea6a55' }, { sx: -1, sy: 1, c: '#ece5d6', h: '#ffffff' },
];

function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function hexRgb(h) { const n = parseInt(String(h).slice(1, 7), 16) || 0; return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function rgbStr(c, a) { return a == null ? `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})` : `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`; }
function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }   // mulberry32 : décor identique d'un rendu à l'autre
function hash2(a, b) { const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return x - Math.floor(x); }
// ellipse maison (scale + arc) : ctx.ellipse est absent/instable sur les vieux Safari
function oval(g, x, y, rx, ry) { g.save(); g.translate(x, y); g.scale(rx, ry); g.moveTo(1, 0); g.arc(0, 0, 1, 0, Math.PI * 2); g.restore(); }

export default (function () {
  let A, send, root, cv, ctx, togglePanel = () => {}, closePanels = () => {};
  let CC = PAL.normal, TEAMCC = TEAMPAL.normal, FX = 1;
  let mySeat = -1, snap = null, prevGs = 'lobby', teamMode = false, endShown = false, inGamePrev = false, prevRound = -1, lastCount = -1, prevSd = false, lastShrinkMsg = 0;
  let board = [], buf = [];
  let AR = AR0, RING_0 = RING0;                          // géométrie courante (le serveur l'agrandit avec le nombre de lutteurs)
  const puffs = [], salt = [], waves = [], flyers = [], outTxt = [], sparks = [];
  let shakeMag = 0, rafId = 0, destroyed = false, resizeH = null, actx = null, noiseBuf = null, lastFrame = 0, ringPulse = 0;
  const lastHit = {};                                   // anti-mitraillage des « don » : un contact tenu émet un choc par tick
  // éclairage, crépuscule, journal de manche (écran de fin) — tout est côté client, rien de plus sur le réseau
  const LUM = creerLumieres(24), J = creerJournal({ pas: 500 });
  let duskV = 0, sdT0 = 0, jRound = -1, jLast = -1e9;
  let edge = {}, outChain = {}, hitAt = {};            // par siège : passage au bord, sorties en série, dernier contact subi
  // musique recréée à chaque init() : dispose() (teardown) est définitif pour l'instance ; NOMUSIC évite tout accès à null entre deux jeux
  const NOMUSIC = { start() {}, stop() {}, setIntensity() {}, sting() {}, dispose() {} };
  let music = NOMUSIC;
  const input = { up: false, down: false, left: false, right: false };
  let staleInput = false;                               // une touche était tenue au teardown : on renvoie « tout relâché » au retour
  const bursts = [], flashes = [];                      // éclats de ramassage (par palier d'onigiri) / éclats blancs de sortie
  const STREAK = createStreaks({ window: 5000 }), CALL = createCallouts(), HS = createHitStop(60);
  let goT0 = -1e9, petK = 0;                            // départ de manche (pastilles de siège 2 s) / fondu des pétales
  const TOUCH = typeof matchMedia === 'function' ? matchMedia('(pointer: coarse)').matches : 'ontouchstart' in window;   // indications clavier masquées sur tactile (un portable à écran tactile garde ses indices)
  // ralenti / podium / caméra de duel (tout côté client, rien de plus sur le réseau)
  const RL = createRalenti({ keepMs: 3000, windowMs: 1400, slow: 0.4 }), CAM = createDuelCam({ maxZoom: 1.16, ease: 0.05, margin: 120 });
  const CPTS = [{ x: 0, y: 0 }, { x: 0, y: 0 }];         // points de la caméra (réutilisés : aucune allocation par image)
  let pendingEnd = null, overT0 = 0, eatUntil = 0;       // fin de manche différée pendant le ralenti / début du podium / clic avalé (celui qui passe le ralenti)
  let repOut = {}, repHas = false, podSrc = null, podList = [];   // sorties vues pendant le ralenti / entrées du podium (mises en cache par snapshot)
  let hud, cards, startBtn, pauseBtn, modeBtn, botsBtn, diffBtn, pauseFloat, lbBtn, lbPanel, lbBody, endEl, dashBtn, braceBtn;

  const $ = id => root.querySelector('#' + id);
  const colSeat = s => { if (s < 0 || !snap) return '#fff'; const p = snap.players[s]; return teamMode && p ? TEAMCC[p.team % TEAMCC.length] : CC[s % CC.length]; };
  const winTeam = m => (m && typeof m.winner === 'number' && m.winner >= 0) ? m.winner : -1;   // équipe gagnante, -1 = égalité / pas de vainqueur (null >= 0 est vrai en JS !)
  const nameOf = s => { const p = snap && snap.players[s]; return p ? (p.name || ('P' + (s + 1))) : '?'; };
  function applyColors() { CC = PAL[A.palette] || PAL.normal; TEAMCC = TEAMPAL[A.palette] || TEAMPAL.normal; FX = A.reduceFx ? 0 : 1; decorKey = ''; bodyCache = {}; podSrc = null; if (A.reduceFx) LUM.vider(); }

  function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const size = arenaSize({ max: 760 });
    cv.style.width = size + 'px'; cv.style.height = size + 'px';
    cv.width = Math.round(size * dpr); cv.height = Math.round(size * dpr);
    layoutEnd();
  }

  // ───────────────────────── HUD, classement, écran de fin ─────────────────────────
  function cdTxt(v, lab) { return v >= 1 ? lab + ' prête' : lab + ' ' + Math.round((v || 0) * 100) + '%'; }
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
      const glyph = SEAT_GLYPH[i % SEAT_GLYPH.length];   // constante : rappel du motif peint sur la mawashi
      const pnH = `${(window.__AV && window.__AV(p.name)) || ''}<span class="sg" style="opacity:.8">${glyph}</span> ${esc(p.name || ('P' + (i + 1)))} <span class="sc">${p.kills | 0} ✋</span> ${tags.join('')}`;
      if (cards[i]._pn !== pnH) { cards[i]._pn = pnH; cards[i].querySelector('.pn').innerHTML = pnH; }   // innerHTML seulement si la chaîne change (30 Hz sinon)
      const lv = cards[i].querySelector('.lv'); lv.style.color = col;
      const setLv = t => { if (cards[i]._lv !== t) { cards[i]._lv = t; lv.textContent = t; } };
      if (!p.playing) { setLv('prêt'); return; }
      if (!p.alive) { setLv(p.outBy >= 0 && p.outBy !== i ? '✖ sorti par ' + nameOf(p.outBy) : '✖ sorti'); return; }
      // état des deux techniques + bonus actifs : c'est ce qu'on regarde d'un coin d'œil en pleine poussée
      const st = [p.dashing ? '💨 CHARGE !' : cdTxt(p.dcd, '💨'), p.brace ? '⚓ ANCRÉ' : cdTxt(p.bcd, '⚓')];
      if (p.heavy) st.push('🍙×' + (p.lvl | 0)); if (p.boost) st.push('⚡'); if (p.grip) st.push('👣');
      if (p.stun) st.push('💫'); if (p.tired) st.push('💦'); if (p.slip) st.push('❄');
      setLv('● ' + st.join(' · '));
    });
  }
  function renderLB() {
    if (!lbBody) return;
    if (!board.length) { lbBody.innerHTML = '<div class="lbnote">Aucune partie enregistrée.</div>'; return; }
    const B = board.map(e => ({ ...e, kd: e.deaths ? (e.kills || 0) / e.deaths : (e.kills || 0) }));
    lbBody.innerHTML = B.sort((a, b) => (b.wins || 0) - (a.wins || 0) || b.kd - a.kd || (b.kills || 0) - (a.kills || 0)).map(e =>
      `<div class="lbrow"><span class="lbn">${esc(e.name)}</span><span title="combats">🎮${e.games || 0}</span><span title="victoires">🏆${e.wins || 0}</span><span title="sorties provoquées">✋${e.kills || 0}</span>` +
      (e.deaths != null ? `<span title="sorties / éliminations subies">⚖${e.deaths ? ((e.kills || 0) / e.deaths).toFixed(2) : ((e.kills || 0) ? '∞' : '0')}</span>` : '') +
      (e.bestSurvivalSec != null ? `<span title="meilleure tenue sur le dohyō">⏱${Math.round(e.bestSurvivalSec || 0)}s</span>` : '') + '</div>').join('');
  }
  // Carte de fin + podium canvas : le podium occupe le HAUT du cadre, la carte DOM se cale dessous (fond transparent en haut,
  // défilement interne pour que le contenu ne recouvre jamais le podium). Sans entrée à afficher : carte plein cadre comme avant.
  let endPod = false;
  const podFrac = () => (cv && cv.clientWidth < 460 ? 0.46 : 0.42);   // téléphone : un peu plus de hauteur pour des noms lisibles
  function layoutEnd() {
    if (!endEl) return;
    if (!endPod) { if (endEl.style.cssText) endEl.style.cssText = ''; return; }
    const ph = Math.round((cv.clientHeight || 340) * podFrac());
    endEl.style.cssText = 'justify-content:flex-start;overflow-y:auto;padding:' + (ph + 4) + 'px 12px 10px;background:linear-gradient(to bottom,rgba(5,6,14,0) ' + ph + 'px,rgba(5,6,14,.86) ' + (ph + 6) + 'px)';
  }
  function podEntries(m) {                                // entrées du podium, recalculées seulement quand le snapshot change
    if (podSrc !== m) { podSrc = m; podList = m ? podiumEntries(m.players, colSeat) : []; }
    return podList;
  }
  function showEndscreen(m) {
    if (m.gs !== 'over' || !m.stats) { endPod = false; layoutEnd(); endEl.classList.add('hidden'); return; }
    podSrc = null; endPod = podEntries(m).length > 0; layoutEnd();
    endEl.classList.remove('hidden');
    const parts = m.players.filter(p => p.playing && p.place > 0).slice().sort((a, b) => a.place - b.place);
    const champ = winTeam(m) >= 0 ? parts.find(p => p.team === m.winner) : null;
    const who = champ ? (teamMode ? 'Équipe ' + TEAM_LETTER[m.winner] : esc(champ.name || ('P' + (champ.seat + 1)))) : null;
    const title = champ ? who + ' reste sur le dohyō !' : 'Égalité — torinaoshi';
    const medals = ['🥇', '🥈', '🥉'];
    // MVP : le plus de sorties provoquées, départage au classement (≥ 1 sortie, sinon personne)
    let mvp = null; parts.forEach(p => { if ((p.kills | 0) > 0 && (!mvp || p.kills > mvp.kills || (p.kills === mvp.kills && p.place < mvp.place))) mvp = p; });
    const rows = parts.map(p => {
      const col = colSeat(p.seat), medal = medals[p.place - 1] || ('#' + p.place), sec = Math.round((p.elimTick || 0) / TICK_HZ);
      const res = p.alive ? (champ && p.team === champ.team ? 'vainqueur' : 'dernier debout')
        : (p.outBy >= 0 && p.outBy !== p.seat ? `sorti par ${esc(nameOf(p.outBy))} à ${sec}s` : `sorti à ${sec}s`);
      return `<div class="erow ${p.alive ? 'win' : ''}"><span class="eplace">${medal}</span>
        <span class="ename" style="color:${col}">${esc(p.name || ('P' + (p.seat + 1)))}${teamMode ? ` <small>Éq.${TEAM_LETTER[p.team]}</small>` : ''}${mvp && mvp.seat === p.seat ? ' <small>⭐ MVP</small>' : ''}</span>
        <span class="estat" title="sorties provoquées">✋ ${p.kills | 0}</span><span class="eres">${res}</span></div>`;
    }).join('');
    const mvpLine = mvp ? `<div class="emeta">⭐ MVP : <b style="color:${colSeat(mvp.seat)}">${esc(mvp.name || ('P' + (mvp.seat + 1)))}</b> — ${mvp.kills} sortie${mvp.kills > 1 ? 's' : ''}</div>` : '';
    const wrapO = endPod ? '<div style="width:100%;flex:1 1 auto;min-height:0;overflow:auto;-webkit-overflow-scrolling:touch;display:flex;flex-direction:column;align-items:center;gap:8px">' : '', wrapC = endPod ? '</div>' : '';   // podium au-dessus : la carte défile dans sa zone
    endEl.innerHTML = wrapO + `<div class="etitle" style="color:${champ ? colSeat(champ.seat) : K.washi}">${title}</div>
      <div class="emeta">⏱ ${m.stats.durationSec}s · ${m.stats.nParts} lutteurs</div>${mvpLine}<div class="elist">${rows}</div>${jRound === m.round ? blocFin(J, { titre: 'Marge sur la paille au fil du combat', couleur: s => colSeat(s), nom: s => nameOf(s) }) : ''}<div class="ehint">${TOUCH ? 'Touche pour rejouer' : 'Espace / clic pour rejouer'}</div>` + wrapC;
  }

  // ───────────────────────── état réseau ─────────────────────────
  function onMessage(m) { if (m && m.t === 'welcome') mySeat = m.seat; }
  function onLb(d) { board = (d && d.board) || []; renderLB(); }
  function onState(m) {
    if (m.ar && m.ar !== AR) AR = m.ar;                  // arène redimensionnée (nombre de lutteurs) : tout le rendu lit AR
    if (m.ring0 && m.ring0 !== RING_0) RING_0 = m.ring0;
    snap = m; teamMode = !!(m.mode && m.mode !== 'ffa');
    const inGame = m.gs === 'play' || m.gs === 'countdown' || m.gs === 'paused';
    if (inGame !== inGamePrev) { inGamePrev = inGame; document.body.classList.toggle('playing', inGame); resizeCanvas(); }
    document.body.classList.toggle('paused', m.gs === 'paused');
    if (m.gs === 'play' || m.gs === 'countdown') closePanels();
    if (m.round !== prevRound) { prevRound = m.round; buf = []; puffs.length = 0; salt.length = 0; waves.length = 0; flyers.length = 0; outTxt.length = 0; sparks.length = 0; bursts.length = 0; flashes.length = 0; STREAK.reset(); LUM.vider(); RL.clear(); CAM.reset(); pendingEnd = null; repOut = {}; repHas = false; }
    buf.push({ t: performance.now(), s: m }); if (buf.length > 10) buf.shift();
    if (m.gs === 'play' || m.gs === 'paused' || m.gs === 'over') RL.push(m, performance.now()); else { RL.clear(); pendingEnd = null; }   // tampon du ralenti : chaque snapshot de la manche
    if (m.gs === 'play' && (prevGs === 'countdown' || !J.actif() || jRound !== m.round)) {   // journal : départ de manche (ou arrivée en cours de manche)
      J.debut(performance.now()); jRound = m.round; jLast = -1e9; edge = {}; outChain = {}; hitAt = {};
    }
    (m.fx || []).forEach(playFx);
    suivreJournal(m, performance.now(), m.gs === 'over' && prevGs !== 'over');
    if (prevGs !== 'over' && m.gs === 'over') {
      finJournal(m);
      if (!A.reduceFx && RL.start(performance.now())) pendingEnd = m;   // ralenti du dernier coup : carte de fin, jingle et podium attendent sa fin
      else { sound('win'); music.sting('win'); }
    }
    if (m.gs === 'countdown' && m.count > 0 && m.count !== lastCount) { music.sting('count'); sound('count'); }   // décompte 3·2·1 au taiko
    if (prevGs === 'countdown' && m.gs === 'play') { music.sting('go'); sound('go'); goT0 = performance.now(); }   // goT0 : pastilles de siège visibles 2 s après le coup d'envoi
    lastCount = m.count;
    if (m.sd && !prevSd) { announceShrink(); sdT0 = performance.now(); }   // filet si l'événement 'shrink' s'est perdu (arrivée en cours de manche) ; départ du crépuscule
    prevSd = !!m.sd;
    prevGs = m.gs;
    { let inten = 0;                                      // musique : 1 en jeu, 2 en mort subite ou au duel final (parmi 3+)
      if (m.gs === 'play' || m.gs === 'countdown') { inten = 1; const tot = m.players.filter(p => p.playing).length, alive = m.players.filter(p => p.playing && p.alive).length; if (m.sd || (tot >= 3 && alive <= 2)) inten = 2; }
      music.setIntensity(inten); }
    refreshHUD();
    if (m.gs === 'over') { if (!endShown && !pendingEnd) { showEndscreen(m); endShown = true; overT0 = performance.now(); } }
    else { endShown = false; pendingEnd = null; if (endPod) { endPod = false; layoutEnd(); } endEl.classList.add('hidden'); }
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
    modeBtn.textContent = '⚔ ' + (MODE_NAME[m.mode] || m.mode || 'FFA'); modeBtn.classList.toggle('on', teamMode);
    // boutons tactiles : estompés tant que la technique recharge (le joueur sait pourquoi rien ne part)
    const me = mySeat >= 0 ? m.players[mySeat] : null, live = !!(me && me.playing && me.alive);
    if (dashBtn) dashBtn.style.opacity = !live || me.dcd >= 1 ? '' : String(0.45 + 0.4 * (me.dcd || 0));
    if (braceBtn) braceBtn.style.opacity = !live || me.bcd >= 1 ? '' : String(0.45 + 0.4 * (me.bcd || 0));
  }
  function announceShrink() {
    const now = performance.now(); ringPulse = now;
    if (now - lastShrinkMsg < 2500) return; lastShrinkMsg = now;
    music.sting('alert'); msgGlobal(SHRINK_MSG.i, SHRINK_MSG.t, { bad: true });
  }

  // ───────────────────────── journal de manche (courbe + meilleure action) ─────────────────────────
  // Courbe : marge de chaque lutteur sur la paille (rayon − distance au centre), 0 à sa sortie puis la ligne s'arrête.
  // Moments : sortie (en charge, d'un lourd), sorties en série, sauvetage au bord (ancré ou non), dernier debout.
  function suivreJournal(m, now, force) {
    if (!J.actif() || !(m.gs === 'play' || force)) return;
    const c = AR / 2, R = m.ring || RING_0, echant = force || now - jLast >= 500, vals = {};
    m.players.forEach(p => {
      if (!p.playing) return;
      const s = p.seat, e = edge[s] || (edge[s] = { danger: 0, brace: false, last: -1e9, fini: false });
      if (!p.alive) { if (echant && !e.fini) { vals[s] = 0; e.fini = true; } return; }
      const d = Math.hypot(p.x - c, p.y - c), r = p.r || PR;
      if (echant) vals[s] = Math.max(0, R - d);
      // sauvetage : poussé jusqu'à la paille (centre à moins d'un demi-corps du cordon), revenu bien à l'intérieur
      if (d > R - r * 0.45) { if (!e.danger) e.danger = now; if (p.brace) e.brace = true; }
      else if (e.danger && d < R - r * 2.2) {
        if (now - e.danger > 200 && now - (hitAt[s] || -1e9) < 1500 && now - e.last > 3000) {
          J.moment(now, s, e.brace ? 'ancré sur la paille, a renvoyé la poussée' : "s'est sauvé au bord de la paille", e.brace ? 5 : 4);
          e.last = now;
        }
        e.danger = 0; e.brace = false;
      }
    });
    if (echant) { jLast = now; J.echantillon(now, vals, true); }
  }
  function momentSortie(f, now) {
    if (!J.actif() || !snap) return;
    const by = f.by, victim = nameOf(f.seat), vp = snap.players[f.seat];
    if (by == null || by < 0 || by === f.seat) return;               // sortie seul : pas une action
    const pb = snap.players[by], prev = outChain[by], k = prev && now - prev.t < 2500 ? prev.k + 1 : 1;
    if (k >= 3) J.moment(now, by, 'triple sortie en ' + ((now - prev.t0) / 1000).toFixed(1) + ' s', 10);
    else if (k === 2) J.moment(now, by, 'double sortie : ' + prev.n + ' puis ' + victim, 8);
    else if (pb && pb.dashing) J.moment(now, by, 'a sorti ' + victim + ' en pleine charge', 6);
    else J.moment(now, by, 'a sorti ' + victim + (vp && vp.heavy ? ', pourtant lourd' : ''), vp && vp.heavy ? 4 : 3);
    outChain[by] = { t: now, t0: k > 1 ? prev.t0 : now, k: k, n: victim };
  }
  function finJournal(m) {
    if (!J.actif()) return;
    const w = winTeam(m) >= 0 ? m.players.find(p => p.playing && p.alive && p.team === m.winner) : null;
    if (w) J.moment(performance.now(), w.seat, teamMode ? "a tenu le dohyō pour l'équipe " + TEAM_LETTER[m.winner] : 'reste seul sur le dohyō', 1);
    J.fin();
  }

  // ───────────────────────── sons (WebAudio, zéro fichier) ─────────────────────────
  function unlockAudio() { if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch {} } if (actx && actx.state === 'suspended') actx.resume(); }
  let sndPan = 0;                                        // pan stéréo du prochain son (posé par psound)
  const vol = () => (A && typeof A.sfx === 'number') ? A.sfx : 1;
  function out(node) { if (sndPan && actx.createStereoPanner) { const pn = actx.createStereoPanner(); pn.pan.value = Math.max(-1, Math.min(1, sndPan)); pn.connect(actx.destination); node.connect(pn); } else node.connect(actx.destination); }
  function tone(f, d, ty = 'square', g = 0.05, dl = 0) { const v = vol(); if (!actx || v <= 0) return; const t0 = actx.currentTime + dl, o = actx.createOscillator(), gg = actx.createGain(); o.type = ty; o.frequency.setValueAtTime(f, t0); gg.gain.setValueAtTime(g * v, t0); gg.gain.exponentialRampToValueAtTime(0.0001, t0 + d); o.connect(gg); out(gg); o.start(t0); o.stop(t0 + d + 0.02); }
  function noise(d, type, freq, g, dl = 0, q) {
    const v = vol(); if (!actx || v <= 0) return;
    if (!noiseBuf || noiseBuf.sampleRate !== actx.sampleRate) { const sr = actx.sampleRate, b = actx.createBuffer(1, Math.floor(sr * 1.5), sr), dd = b.getChannelData(0); for (let i = 0; i < dd.length; i++) dd[i] = Math.random() * 2 - 1; noiseBuf = b; }
    const t0 = actx.currentTime + dl, s = actx.createBufferSource(), f = actx.createBiquadFilter(), gg = actx.createGain();
    s.buffer = noiseBuf; f.type = type; f.frequency.value = freq; if (q) f.Q.value = q;
    gg.gain.setValueAtTime(0.0001, t0); gg.gain.exponentialRampToValueAtTime(g * v, t0 + Math.min(0.012, d * 0.2)); gg.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
    s.connect(f); f.connect(gg); out(gg); s.start(t0); s.stop(t0 + d + 0.02);
  }
  // « don » de taiko : peau grave qui plonge + claquement de la frappe. f = force du choc (0..1).
  function taiko(f, dl = 0) {
    const v = vol(); if (!actx || v <= 0) return;
    const t0 = actx.currentTime + dl, o = actx.createOscillator(), g = actx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(120 + 40 * f, t0); o.frequency.exponentialRampToValueAtTime(52, t0 + 0.28);
    g.gain.setValueAtTime((0.12 + 0.3 * f) * v, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.34 + 0.2 * f);
    o.connect(g); out(g); o.start(t0); o.stop(t0 + 0.6);
    noise(0.05, 'lowpass', 1100, 0.06 + 0.12 * f, dl);
  }
  function psound(k, x, arg) { sndPan = Math.max(-1, Math.min(1, (x / AR - 0.5) * 1.7)); sound(k, arg); sndPan = 0; }   // son positionné gauche/droite
  function sound(k, arg) {
    if (!actx) return;
    if (k === 'hit') taiko(arg == null ? 0.5 : arg);
    else if (k === 'dash') { noise(0.035, 'highpass', 1500, 0.2); noise(0.03, 'highpass', 1800, 0.14, 0.022); noise(0.22, 'bandpass', 900, 0.07, 0.01, 0.7); }   // claquement de mains + souffle
    else if (k === 'brace') { tone(68, 0.22, 'sine', 0.14); tone(230, 0.05, 'triangle', 0.05); }   // pied qui frappe le sol (shiko)
    else if (k === 'pickup') {                                                                                 // koto pincé (in-sen) ; onigiri : une note de plus par palier (arg = palier 1..5)
      tone(587.33, 0.16, 'triangle', 0.05); tone(880, 0.22, 'triangle', 0.045, 0.07);
      if (arg >= 2) tone(1046.5, 0.2, 'triangle', 0.04, 0.14); if (arg >= 3) tone(1174.66, 0.22, 'triangle', 0.04, 0.2);
      if (arg >= 4) tone(1396.91, 0.26, 'triangle', 0.04, 0.26); if (arg >= 5) { tone(1760, 0.5, 'triangle', 0.045, 0.32); taiko(0.5, 0.05); }
    }
    else if (k === 'shock') { taiko(1); noise(0.45, 'lowpass', 500, 0.14); }
    else if (k === 'out') { taiko(0.9); noise(1.3, 'bandpass', 520, 0.09, 0.05, 0.8); }                        // chute + « ooh » du public
    else if (k === 'salt') { noise(0.3, 'highpass', 5200, 0.05); noise(0.25, 'highpass', 6000, 0.04, 0.12); }
    else if (k === 'count') taiko(0.35);
    else if (k === 'go') { taiko(0.8); taiko(0.8, 0.14); }
    else if (k === 'win') { tone(293.66, 0.3, 'triangle', 0.06); tone(392, 0.3, 'triangle', 0.06, 0.14); tone(440, 0.3, 'triangle', 0.06, 0.28); tone(587.33, 0.5, 'triangle', 0.06, 0.42); }
  }

  // ───────────────────────── effets ponctuels ─────────────────────────
  function dust(x, y, n, spd, col) {                     // bouffées de poussière d'argile (rendu opaque, pas en « lighter »)
    if (A.reduceFx) return; const now = performance.now();
    for (let k = 0; k < n; k++) { const a = Math.random() * Math.PI * 2, sp = (0.3 + Math.random()) * spd; puffs.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, born: now, life: 380 + Math.random() * 380, r0: 3 + Math.random() * 4, col: col || '214,182,130' }); }
    if (puffs.length > 280) puffs.splice(0, puffs.length - 280);
  }
  function throwSalt(x, y) {                             // poignée de sel lancée en cloche vers le centre
    const cx = AR / 2, cy = AR / 2, a0 = Math.atan2(cy - y, cx - x), now = performance.now();
    for (let k = 0; k < 26; k++) { const a = a0 + (Math.random() - 0.5) * 0.9, sp = 1.2 + Math.random() * 2.6; salt.push({ x, y, z: 14 + Math.random() * 6, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: 2.2 + Math.random() * 2.2, born: now, life: 1300 + Math.random() * 700 }); }
    if (salt.length > 420) salt.splice(0, salt.length - 420);
  }
  function playFx(f) {
    if (!f) return;
    const now = performance.now();
    if (f.type === 'hit') {
      const key = Math.min(f.a, f.b) + '-' + Math.max(f.a, f.b), fo = Math.max(0, Math.min(1, f.f || 0));
      hitAt[f.a] = hitAt[f.b] = now;                     // journal : « poussé » juste avant un sauvetage au bord
      if (lastHit[key] && now - lastHit[key] < 140 && fo < 0.6) return;   // contact tenu : un « don » par poussée, pas trente
      lastHit[key] = now;
      psound('hit', f.x, fo);
      if (A.reduceFx) return;
      const mine = f.a === mySeat || f.b === mySeat;
      if (fo > 0.35) shakeMag = Math.max(shakeMag, (mine ? 4 : 2) + 7 * fo);
      dust(f.x, f.y, 3 + Math.round(8 * fo), 1 + 2.4 * fo);
      waves.push({ x: f.x, y: f.y, r0: 6, r1: 18 + 26 * fo, born: now, life: 260 + 160 * fo, col: '241,230,208', lw: 2 + 3 * fo });
      for (let k = 0; k < Math.round(4 + 6 * fo); k++) { const a = Math.random() * Math.PI * 2, sp = 2 + Math.random() * 4 * (0.5 + fo); sparks.push({ x: f.x, y: f.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, born: now, life: 180 + Math.random() * 160 }); }
      if (fo > 0.25) LUM.ajouter(f.x, f.y, 28 + 46 * fo, '#ffe2b0', 200 + 180 * fo, 0.2 + 0.4 * fo);   // éclat du choc sur l'argile
      return;
    }
    if (f.type === 'dash') { psound('dash', f.x); dust(f.x, f.y, 10, 1.8); if (!A.reduceFx) LUM.ajouter(f.x, f.y, 64, '#ffc27a', 280, 0.45); return; }   // étincelle du départ en charge
    if (f.type === 'brace') { psound('brace', f.x); dust(f.x, f.y, 8, 1.2); if (!A.reduceFx) { waves.push({ x: f.x, y: f.y, r0: PR, r1: PR * 2.4, born: now, life: 420, col: '217,194,122', lw: 4 }); LUM.ajouter(f.x, f.y, 58, '#e9d58f', 420, 0.3); } return; }
    if (f.type === 'out') {
      psound('out', f.x); music.sting('kill'); momentSortie(f, now);
      const p = snap && snap.players[f.seat];
      if (f.by != null && f.by >= 0 && f.by !== f.seat) {   // séries : plusieurs sorties du même lutteur en 5 s (pas de « série » sur un coéquipier)
        const pb = snap && snap.players[f.by];
        if (!(teamMode && p && pb && pb.team === p.team)) {
          const tx = streakText(STREAK.kill(f.by, now));
          if (tx) { CALL.push(tx, colSeat(f.by), now); msgGlobal('✋', nameOf(f.by) + ' — ' + tx, { color: colSeat(f.by) }); }
        }
      }
      flyers.push({ seat: f.seat, x: f.x, y: f.y, dir: Math.atan2(f.y - AR / 2, f.x - AR / 2), a: p ? p.a : 0, r: p ? (p.r || PR) : PR, born: now, name: p && !p.bot ? p.name : null });
      outTxt.push({ x: f.x, y: f.y, born: now, seat: f.seat });
      if (f.seat === mySeat) msgPerso('✖', f.by >= 0 && f.by !== f.seat ? 'Sorti du dohyō !' : 'Tu as franchi la paille !', { bad: true });
      if (A.reduceFx) return;
      shakeMag = Math.max(shakeMag, f.seat === mySeat ? 12 : 7);
      HS.trigger(now); flashes.push({ x: f.x, y: f.y, r: (p ? (p.r || PR) : PR) * 1.7, born: now });   // arrêt sur image 60 ms + éclat blanc sur la victime
      dust(f.x, f.y, 22, 3);
      LUM.ajouter(f.x, f.y, 120, '#ff6a3d', 750, 0.7); LUM.ajouter(f.x, f.y, 46, '#fff1d6', 320, 0.6);   // éclair de sortie
      return;
    }
    if (f.type === 'pickup') {
      const tier = f.t === 'heavy' ? Math.max(1, Math.min(5, f.lvl | 0)) : 0;   // palier d'onigiri 1..5 (les 3 autres bonus : 0)
      psound('pickup', f.x, tier);
      const d = PU[f.t], m = PU_MSG[f.t];
      if (f.seat === mySeat && d && m && m.t) msgPerso(d.i, f.t === 'heavy' ? 'Onigiri ' + Math.min(5, f.lvl | 0) + '/5 : ' + m.t : m.t, { color: d.c });   // `m.t` : garde-fou si `t` tombe sur une clé du prototype
      if (!A.reduceFx && d) {
        const c = hexRgb(d.c);
        if (!tier) { waves.push({ x: f.x, y: f.y, r0: 8, r1: 34, born: now, life: 380, col: c.join(','), lw: 3 }); LUM.ajouter(f.x, f.y, 70, puLum(f.t), 420, 0.45); }
        else {                                             // onigiri : l'éclat grossit à chaque palier — anneaux (= palier), rayons d'or, poussière, lueur, secousse dès le 4e
          for (let k = 0; k < tier; k++) waves.push({ x: f.x, y: f.y, r0: 8, r1: 30 + 16 * tier + 10 * k, born: now + k * 70, life: 360 + 60 * tier, col: k % 2 ? '242,207,106' : c.join(','), lw: 2.5 + 0.5 * tier });
          bursts.push({ x: f.x, y: f.y, tier: tier, born: now });
          if (bursts.length > 12) bursts.shift();
          dust(f.x, f.y, 4 + 5 * tier, 1 + 0.5 * tier, '236,208,150');
          LUM.ajouter(f.x, f.y, 60 + 28 * tier, '#ffd9a0', 380 + 90 * tier, 0.4 + 0.08 * tier);
          if (tier >= 4) shakeMag = Math.max(shakeMag, tier === 5 ? 6 : 3);
        }
      }
      return;
    }
    if (f.type === 'malus') {                              // un adversaire a ramassé un bonus : seule la victime est prévenue
      const m = MALUS_MSG[f.t];
      if (f.seat === mySeat && m && m.t) msgPerso(m.i, m.t, { color: m.c, bad: true });
      return;
    }
    if (f.type === 'shock') {                              // repousse tout le monde alentour : message global
      psound('shock', f.x); msgGlobal(SHOCK_MSG.i, SHOCK_MSG.t, { color: PU.shock.c });
      if (A.reduceFx) return;
      shakeMag = Math.max(shakeMag, 9);
      waves.push({ x: f.x, y: f.y, r0: 10, r1: 180, born: now, life: 560, col: '241,230,208', lw: 8 });    // r1 = SHOCK_R du serveur
      waves.push({ x: f.x, y: f.y, r0: 6, r1: 164, born: now + 70, life: 560, col: '61,111,182', lw: 5 });
      dust(f.x, f.y, 30, 3.8);
      LUM.ajouter(f.x, f.y, 220, '#7fb0ff', 660, 0.6); LUM.ajouter(f.x, f.y, 60, '#fff1d6', 260, 0.7);   // onde de choc
      return;
    }
    if (f.type === 'shrink') { announceShrink(); return; }
    if (f.type === 'salt') {                               // jet de sel rituel : chaque lutteur en lice lance sa poignée
      sound('salt');
      if (A.reduceFx || !snap) return;
      let n = 0; snap.players.forEach(p => { if (p.playing) { throwSalt(p.x, p.y); n++; } });
      if (!n) for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + 0.4; throwSalt(AR / 2 + Math.cos(a) * RING_0 * 0.6, AR / 2 + Math.sin(a) * RING_0 * 0.6); }
    }
  }

  // ───────────────────────── interpolation (tampon comme Tanks) ─────────────────────────
  function viewPlayers(now) {
    if (buf.length === 0) return null;
    // 30 Hz ≈ 33 ms entre instantanés : 55 ms de retard garantit presque toujours deux bornes encadrantes
    const hz = (snap && snap.shz) || TICK_HZ, delay = Math.max(55, 1650 / hz);
    const target = now - delay; let a = buf[0], b = buf[buf.length - 1];
    for (let i = 0; i < buf.length; i++) if (buf[i].t <= target) a = buf[i];
    for (let i = buf.length - 1; i >= 0; i--) if (buf[i].t >= target) b = buf[i];
    const span = b.t - a.t; let al = span > 0 ? (target - a.t) / span : 0; al = al < 0 ? 0 : al > 1 ? 1 : al;
    const outp = {};
    b.s.players.forEach(pb => {
      if (!pb.playing) return;
      const pa = a.s.players[pb.seat]; let x = pb.x, y = pb.y, ang = pb.a || 0;
      // saut > 60 u = replacement (nouvelle manche, choc d'onde) : on ne glisse pas à travers le dohyō
      if (pa && pa.playing && pa.alive && Math.hypot(pb.x - pa.x, pb.y - pa.y) < 60) { x = pa.x + (pb.x - pa.x) * al; y = pa.y + (pb.y - pa.y) * al; const da = Math.atan2(Math.sin(ang - (pa.a || 0)), Math.cos(ang - (pa.a || 0))); ang = (pa.a || 0) + da * al; }
      outp[pb.seat] = { x, y, a: ang };
    });
    return outp;
  }

  // ───────────────────────── décor statique pré-rendu ─────────────────────────
  // Plancher laqué, plate-forme d'argile surélevée, sable, janome, shikiri-sen, cordon carré : ~4000 tracés
  // cuits une fois dans un canvas hors écran — redessiné seulement si la taille, l'arène ou le contraste change.
  let decorCv = null, decorKey = '';
  const platHalf = () => Math.min(AR / 2 - AR * 0.035, RING_0 * 1.2);
  function ensureDecor() {
    const key = cv.width + '|' + AR + '|' + RING_0 + '|' + (A.contrast ? 1 : 0);
    if (decorCv && key === decorKey) return;
    decorKey = key;
    if (!decorCv) decorCv = document.createElement('canvas');
    decorCv.width = cv.width; decorCv.height = cv.height;
    const g = decorCv.getContext('2d'), W = AR, c = W / 2, R0 = RING_0, hp = platHalf(), slope = Math.max(14, W * 0.028), top = hp - slope;
    const rnd = rng(0x5a17 + Math.round(W));
    g.setTransform(cv.width / W, 0, 0, cv.width / W, 0, 0);
    // 1) plancher de bois laqué : planches, joints, veinage, reflet
    g.fillStyle = K.wood; g.fillRect(0, 0, W, W);
    const ph = W / 15;
    for (let y = 0, row = 0; y < W; y += ph, row++) {
      let x = -rnd() * W * 0.3;
      while (x < W) {
        const len = W * (0.28 + rnd() * 0.3), t = rnd();
        g.fillStyle = rgbStr(mix([27, 18, 14], [40, 27, 20], t)); g.fillRect(x, y, len, ph);
        g.strokeStyle = 'rgba(70,48,34,0.22)'; g.lineWidth = 0.8;           // veinage ondulé
        for (let k = 0; k < 4; k++) { const yy = y + ph * (0.2 + 0.2 * k + rnd() * 0.08); g.beginPath(); g.moveTo(x, yy); for (let s = 1; s <= 8; s++) g.lineTo(x + len * s / 8, yy + Math.sin(s * 1.3 + k + row) * ph * 0.05); g.stroke(); }
        g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(x + len - 1, y, 1.2, ph);   // about de planche
        x += len;
      }
      g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(0, y + ph - 1.2, W, 1.2);        // joint entre planches
      g.fillStyle = 'rgba(255,220,180,0.035)'; g.fillRect(0, y, W, 1);             // arête vernie
    }
    const lg = g.createLinearGradient(0, 0, W, W); lg.addColorStop(0, 'rgba(255,190,120,0.07)'); lg.addColorStop(0.5, 'rgba(255,190,120,0)'); lg.addColorStop(1, 'rgba(255,150,80,0.05)');
    g.fillStyle = lg; g.fillRect(0, 0, W, W);
    // 2) plate-forme surélevée : ombre portée, 4 talus éclairés du haut-gauche
    g.save(); g.shadowColor = 'rgba(0,0,0,0.6)'; g.shadowBlur = 18; g.shadowOffsetX = 5; g.shadowOffsetY = 8;
    g.fillStyle = '#8c6a3e'; g.fillRect(c - hp, c - hp, hp * 2, hp * 2); g.restore();
    const side = (pts, col) => { g.beginPath(); g.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); g.closePath(); g.fillStyle = col; g.fill(); };
    side([c - hp, c - hp, c + hp, c - hp, c + top, c - top, c - top, c - top], '#b48e58');   // haut
    side([c - hp, c - hp, c - top, c - top, c - top, c + top, c - hp, c + hp], '#a8814d');   // gauche
    side([c + hp, c - hp, c + hp, c + hp, c + top, c + top, c + top, c - top], '#8a683c');   // droite
    side([c - hp, c + hp, c + hp, c + hp, c + top, c + top, c - top, c + top], '#79592f');   // bas
    g.save(); g.beginPath(); g.rect(c - hp, c - hp, hp * 2, hp * 2); g.clip();              // grain des talus
    for (let k = 0; k < 900; k++) { const x = c - hp + rnd() * hp * 2, y = c - hp + rnd() * hp * 2; if (Math.abs(x - c) < top && Math.abs(y - c) < top) continue; g.fillStyle = rnd() < 0.5 ? 'rgba(60,40,20,0.25)' : 'rgba(230,200,150,0.18)'; g.fillRect(x, y, 1.2, 1.2); }
    g.restore();
    // 3) dessus d'argile : dégradé (plus clair au centre), sable pré-rendu, piétinement
    const cg = g.createRadialGradient(c - R0 * 0.2, c - R0 * 0.25, R0 * 0.1, c, c, top * 1.4);
    cg.addColorStop(0, '#d8b882'); cg.addColorStop(0.6, K.clay); cg.addColorStop(1, '#b8915a');
    g.fillStyle = cg; g.fillRect(c - top, c - top, top * 2, top * 2);
    for (let k = 0; k < 4200; k++) {                                                          // grains de sable
      const x = c - top + rnd() * top * 2, y = c - top + rnd() * top * 2, t = rnd(), s = 0.5 + rnd() * 1.3;
      g.fillStyle = t < 0.45 ? 'rgba(236,212,164,0.32)' : t < 0.9 ? 'rgba(140,106,62,0.26)' : 'rgba(250,240,220,0.45)';
      g.fillRect(x, y, s, s);
    }
    for (let k = 0; k < 40; k++) { const a = rnd() * Math.PI * 2, d = rnd() * R0 * 0.9; g.fillStyle = 'rgba(120,88,50,0.06)'; g.beginPath(); oval(g, c + Math.cos(a) * d, c + Math.sin(a) * d, 8 + rnd() * 14, 4 + rnd() * 6); g.fill(); }   // traces de pas
    // janome : bande de sable fin balayé juste hors du cercle (on y lit les pieds sortis)
    g.beginPath(); g.arc(c, c, R0 + 26, 0, Math.PI * 2); g.arc(c, c, R0 + 7, Math.PI * 2, 0, true);
    g.fillStyle = 'rgba(240,222,184,0.32)'; g.fill();
    for (let k = 0; k < 700; k++) { const a = rnd() * Math.PI * 2, d = R0 + 8 + rnd() * 17; g.fillStyle = 'rgba(255,248,230,0.35)'; g.fillRect(c + Math.cos(a) * d, c + Math.sin(a) * d, 0.9, 0.9); }
    // 4) shikiri-sen : deux traits blancs parallèles au centre (l'écart réel ≈ 0,3 × le rayon)
    const sx = R0 * 0.15, sl = R0 * 0.2, sw = Math.max(3, R0 * 0.026);
    g.fillStyle = 'rgba(248,244,234,0.92)';
    for (const s of [-1, 1]) { g.fillRect(c + s * sx - sw / 2, c - sl, sw, sl * 2); }
    g.fillStyle = 'rgba(160,130,90,0.35)'; for (let k = 0; k < 60; k++) { const s = rnd() < 0.5 ? -1 : 1; g.fillRect(c + s * sx - sw / 2 + rnd() * sw, c - sl + rnd() * sl * 2, 1, 1.4); }   // craie écaillée
    // 5) cordon de paille carré (kaku-dawara) au bord du dessus
    const kq = top - 6;
    g.lineWidth = 8; g.strokeStyle = '#6d5530'; g.strokeRect(c - kq, c - kq, kq * 2, kq * 2);
    g.lineWidth = 6.5; g.strokeStyle = K.straw; g.setLineDash([24, 3]); g.strokeRect(c - kq, c - kq, kq * 2, kq * 2); g.setLineDash([]);
    g.lineWidth = 1.6; g.strokeStyle = 'rgba(255,245,200,0.5)'; g.strokeRect(c - kq - 1.2, c - kq - 1.2, kq * 2 + 2.4, kq * 2 + 2.4);
    // 6) vignette chaude + cadre (avant-toit laqué, filet d'or)
    const vg = g.createRadialGradient(c, c, W * 0.3, c, c, W * 0.75); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(8,4,2,0.55)');
    g.fillStyle = vg; g.fillRect(0, 0, W, W);
    g.strokeStyle = 'rgba(224,178,60,' + (A.contrast ? 0.7 : 0.35) + ')'; g.lineWidth = 1.5; g.strokeRect(5, 5, W - 10, W - 10);
    g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = 4; g.strokeRect(2, 2, W - 4, W - 4);
  }

  // ───────────────────────── cercle de paille (tawara) au rayon ACTUEL ─────────────────────────
  // Bottes de paille en arcs, interstices sombres, liens ; les 4 bottes cardinales (tokudawara) sont
  // décalées vers l'extérieur comme sur un vrai dohyō. Tout est regroupé en ~6 tracés par image.
  function drawTawara(R, now) {
    const c = AR / 2, w = 11, n = Math.max(16, Math.round(2 * Math.PI * R / 34 / 4) * 4), step = Math.PI * 2 / n, gap = step * 0.09;
    const rad = i => (i % (n / 4) === 0) ? R + w * 1.05 : R;
    const arcs = (dr, pad) => { ctx.beginPath(); for (let i = 0; i < n; i++) { const ri = rad(i) + dr, a0 = i * step - step / 2 + pad, a1 = i * step + step / 2 - pad; ctx.moveTo(c + Math.cos(a0) * ri, c + Math.sin(a0) * ri); ctx.arc(c, c, ri, a0, a1); } };
    ctx.save(); ctx.lineCap = 'butt';
    // pulsation : à l'annonce du rétrécissement (fort) puis tant que le cercle se referme (doux)
    let pulse = 0; const age = now - ringPulse;
    if (age < 1400) pulse = (1 - age / 1400) * (0.6 + 0.4 * Math.sin(age / 60));
    if (snap && snap.sd) pulse = Math.max(pulse, A.reduceFx ? 0.35 : 0.3 + 0.25 * Math.sin(now / 150));
    if (pulse > 0) { ctx.strokeStyle = `rgba(224,69,47,${0.5 * pulse})`; ctx.lineWidth = w + 6 + 12 * pulse; ctx.beginPath(); ctx.arc(c, c, R, 0, Math.PI * 2); ctx.stroke(); }
    // mort subite : le bord rougeoie de plus en plus à mesure que la paille se referme (0 → 1 jusqu'au plancher) ; statique sous « réduire les effets »
    const heat = snap && (snap.sd || R < RING_0 - 0.5) ? Math.max(snap.sd ? 0.12 : 0, Math.min(1, (1 - R / RING_0) / (1 - DUSK_FLOOR))) : 0;
    if (heat > 0) {
      const gl = heat * (A.contrast ? 1 : 0.85), br = A.reduceFx ? 1 : 0.85 + 0.15 * Math.sin(now / 260);
      ctx.strokeStyle = `rgba(224,40,30,${0.12 + 0.3 * gl * br})`; ctx.lineWidth = w + 10 + 26 * heat; ctx.beginPath(); ctx.arc(c, c, R, 0, Math.PI * 2); ctx.stroke();   // halo large
      ctx.strokeStyle = `rgba(255,70,45,${0.2 + 0.55 * gl * br})`; ctx.lineWidth = w + 3 + 6 * heat; ctx.beginPath(); ctx.arc(c, c, R, 0, Math.PI * 2); ctx.stroke();       // filet vif
    }
    ctx.strokeStyle = 'rgba(30,16,6,0.32)'; ctx.lineWidth = w + 1; ctx.save(); ctx.translate(2.5, 3.5); arcs(0, gap / 2); ctx.stroke(); ctx.restore();   // ombre au sol
    ctx.strokeStyle = '#5b4424'; ctx.lineWidth = w + 2; arcs(0, 0); ctx.stroke();                                   // lit sombre = interstices
    const hh = Math.max(pulse * 0.45, heat * 0.55), hot = hh > 0 ? mix(hexRgb(K.straw), [240, 120, 90], hh) : hexRgb(K.straw);   // la paille elle-même vire au rouge avec la chaleur
    ctx.strokeStyle = rgbStr(hot); ctx.lineWidth = w; arcs(0, gap / 2); ctx.stroke();                              // bottes
    ctx.strokeStyle = 'rgba(248,232,170,0.85)'; ctx.lineWidth = w * 0.26; arcs(-w * 0.22, gap / 2 + 0.01); ctx.stroke();   // reflet
    ctx.strokeStyle = 'rgba(140,112,56,0.9)'; ctx.lineWidth = w * 0.22; arcs(w * 0.3, gap / 2 + 0.01); ctx.stroke();      // ombre propre
    ctx.strokeStyle = '#7a6234'; ctx.lineWidth = 1.5; ctx.beginPath();                                             // liens de corde
    for (let i = 0; i < n; i++) { const ri = rad(i); for (const u of [-0.2, 0.2]) { const a = i * step + u * step; ctx.moveTo(c + Math.cos(a) * (ri - w / 2), c + Math.sin(a) * (ri - w / 2)); ctx.lineTo(c + Math.cos(a) * (ri + w / 2), c + Math.sin(a) * (ri + w / 2)); } }
    ctx.stroke();
    if (A.contrast) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(c, c, R - w / 2 - 1, 0, Math.PI * 2); ctx.stroke(); }
    ctx.restore();
  }

  // ───────────────────────── lutteurs vus de dessus ─────────────────────────
  let bodyCache = {}, bodyN = 0;
  function bodyStyle(seat, r, col) {                     // peau teintée vers le siège, dégradé en repère local (réutilisable)
    const key = seat + '|' + r.toFixed(1) + '|' + col;
    if (bodyCache[key]) return bodyCache[key];
    if (++bodyN > 120) { bodyCache = {}; bodyN = 0; }   // le rayon « lourd » varie : on borne le cache
    const base = mix(SKIN, hexRgb(col), 0.2), gr = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r * 1.05);
    gr.addColorStop(0, rgbStr(mix(base, [255, 240, 225], 0.35))); gr.addColorStop(0.65, rgbStr(base)); gr.addColorStop(1, rgbStr(mix(base, [90, 50, 30], 0.35)));
    return (bodyCache[key] = { grad: gr, skin: rgbStr(base), dark: rgbStr(mix(base, [80, 40, 25], 0.4)), belt: col, beltDk: rgbStr(mix(hexRgb(col), [0, 0, 0], 0.35)) });
  }
  function etoile(x, y, s) {                             // étoile à 5 branches (pas de Path2D : vieux iOS)
    ctx.beginPath();
    for (let i = 0; i < 10; i++) { const u = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? s * 0.45 : s; ctx.lineTo(x + Math.cos(u) * rr, y + Math.sin(u) * rr); }
    ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  // o : { scale, spin, alpha, dashing, brace, heavy, lvl, grip, boost, tired, slip, stun, me, shadow, name }
  function drawRikishi(seat, x, y, a, r, o, now) {
    const col = colSeat(seat), B = bodyStyle(seat, r, col);
    ctx.save(); ctx.translate(x, y);
    if (o.alpha != null) ctx.globalAlpha = o.alpha;
    if (o.shadow !== false) { ctx.fillStyle = 'rgba(40,20,8,0.3)'; ctx.beginPath(); ctx.arc(r * 0.16, r * 0.26, r * 1.02, 0, Math.PI * 2); ctx.fill(); }
    if (o.scale) ctx.scale(o.scale, o.scale);
    if (o.brace) {                                       // ancrage : anneau de corde au sol, pieds plantés
      ctx.save(); ctx.strokeStyle = 'rgba(241,230,208,0.85)'; ctx.lineWidth = 3; ctx.setLineDash([5, 3]); ctx.lineDashOffset = A.reduceFx ? 0 : -now / 60;
      ctx.beginPath(); ctx.arc(0, 0, r + 7, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
      ctx.strokeStyle = 'rgba(217,194,122,0.55)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 0, r + 11, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    }
    if (o.grip) {                                        // pieds collés : griffures d'orteils vertes autour
      ctx.save(); ctx.strokeStyle = 'rgba(63,143,79,0.85)'; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.beginPath();
      for (let k = 0; k < 10; k++) { const t = k / 10 * Math.PI * 2 + a; ctx.moveTo(Math.cos(t) * (r + 3), Math.sin(t) * (r + 3)); ctx.lineTo(Math.cos(t) * (r + 8), Math.sin(t) * (r + 8)); }
      ctx.stroke(); ctx.restore();
    }
    if (o.slip) {                                        // sol glissant : flaque glacée sous les pieds, deux reflets qui filent
      ctx.save(); ctx.fillStyle = 'rgba(150,205,240,0.38)'; ctx.beginPath(); ctx.arc(0, 0, r + 9, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(235,248,255,0.85)'; ctx.lineWidth = 2; ctx.lineCap = 'round';
      const t = A.reduceFx ? 0.6 : now / 380;
      ctx.beginPath(); ctx.arc(0, 0, r + 6, t, t + 0.7); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, r + 6, t + Math.PI, t + Math.PI + 0.4); ctx.stroke();
      ctx.restore();
    }
    // corps (repère non tourné : la lumière vient toujours du haut-gauche)
    ctx.fillStyle = B.grad; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
    ctx.rotate(a + (o.spin || 0));
    // mawashi : large ceinture à la couleur du siège, motif du siège par-dessus
    ctx.lineWidth = r * 0.32; ctx.strokeStyle = B.belt; ctx.beginPath(); ctx.arc(0, 0, r * 0.84, 0, Math.PI * 2); ctx.stroke();
    const pat = seatPattern(ctx, seat, { size: Math.max(6, r * 0.5), ink: 'rgba(255,255,255,0.4)', res: Math.round(cv.width / AR * 100) / 100 });   // res = px appareil par unité monde : motif net sur Retina (stable tant que la taille ne change pas)
    if (pat) { ctx.strokeStyle = pat; ctx.stroke(); }
    ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.arc(0, 0, r * 0.68, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = B.beltDk; ctx.fillRect(-r * 1.02, -r * 0.2, r * 0.3, r * 0.4);                                // nœud dans le dos
    ctx.strokeStyle = B.beltDk; ctx.lineWidth = 1.6; ctx.lineCap = 'round'; ctx.beginPath();                       // sagari (franges devant)
    for (let k = -2; k <= 2; k++) { ctx.moveTo(r * 0.92, k * r * 0.13); ctx.lineTo(r * 1.1, k * r * 0.15); }
    ctx.stroke();
    // bras : en charge, tendus vers l'avant (tsuppari) ; sinon repliés sur les flancs
    const hx = o.dashing ? r * 1.06 : r * 0.58, hy = o.dashing ? r * 0.42 : r * 0.6;
    ctx.strokeStyle = B.skin; ctx.lineWidth = r * 0.3; ctx.beginPath(); ctx.moveTo(-r * 0.05, -r * 0.5); ctx.lineTo(hx, -hy); ctx.moveTo(-r * 0.05, r * 0.5); ctx.lineTo(hx, hy); ctx.stroke();
    ctx.fillStyle = B.skin; ctx.strokeStyle = B.dark; ctx.lineWidth = 1;
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(hx, s * hy, r * 0.2, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
    // tête, cheveux, chonmage pointé dans le sens de l'orientation
    ctx.fillStyle = B.skin; ctx.beginPath(); ctx.arc(r * 0.06, 0, r * 0.36, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = K.ink; ctx.beginPath(); ctx.arc(r * 0.02, 0, r * 0.3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); oval(ctx, r * 0.3, 0, r * 0.19, r * 0.1); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.beginPath(); oval(ctx, r * 0.3, -r * 0.03, r * 0.1, r * 0.035); ctx.fill();   // lustre de l'huile (bintsuke)
    ctx.strokeStyle = K.washi; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(r * 0.16, -r * 0.07); ctx.lineTo(r * 0.16, r * 0.07); ctx.stroke();
    ctx.rotate(-(a + (o.spin || 0)));
    // contours : ancrage = contour épais d'encre ; lourd = liseré d'or ; contraste élevé = blanc net
    if (o.brace) { ctx.strokeStyle = K.ink; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.arc(0, 0, r + 0.5, 0, Math.PI * 2); ctx.stroke(); }
    else if (o.heavy) { ctx.strokeStyle = 'rgba(224,178,60,0.9)'; ctx.lineWidth = 1.4 + 0.5 * (o.lvl || 1); ctx.beginPath(); ctx.arc(0, 0, r + 1, 0, Math.PI * 2); ctx.stroke(); }
    if (o.heavy) {                                       // paliers d'onigiri : une perle d'or par palier, en haut du liseré
      const L = Math.min(5, o.lvl || 1); ctx.fillStyle = '#f2cf6a'; ctx.strokeStyle = K.ink; ctx.lineWidth = 1;
      for (let k = 0; k < L; k++) { const u = -Math.PI / 2 + (k - (L - 1) / 2) * 0.3; ctx.beginPath(); ctx.arc(Math.cos(u) * (r + 2), Math.sin(u) * (r + 2), 2.6, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
    }
    if (o.tired) {                                       // essoufflé : deux gouttes de sueur qui perlent et coulent
      const ga = ctx.globalAlpha; ctx.fillStyle = 'rgba(120,190,235,0.95)'; ctx.strokeStyle = 'rgba(30,60,90,0.6)'; ctx.lineWidth = 1;
      for (let k = 0; k < 2; k++) {
        const ph = A.reduceFx ? 0.3 : (now / 700 + k * 0.5) % 1, gx = (k ? 1 : -1) * r * 0.5, gy = -r * 0.6 + ph * r * 0.5;
        ctx.globalAlpha = ga * (1 - ph * 0.7);
        ctx.beginPath(); ctx.moveTo(gx, gy - 5); ctx.quadraticCurveTo(gx + 3.5, gy + 1, gx, gy + 3); ctx.quadraticCurveTo(gx - 3.5, gy + 1, gx, gy - 5); ctx.fill(); ctx.stroke();
      }
      ctx.globalAlpha = ga;
    }
    if (o.stun) {                                        // sonné : trois étoiles qui tournent autour de la tête
      const t = A.reduceFx ? 0 : now / 200; ctx.fillStyle = '#ffd84a'; ctx.strokeStyle = K.ink; ctx.lineWidth = 1;
      for (let k = 0; k < 3; k++) { const u = t + k * Math.PI * 2 / 3; etoile(Math.cos(u) * r * 0.62, Math.sin(u) * r * 0.36 - r * 0.12, 4.2); }
    }
    if (A.contrast) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(0, 0, r + (o.brace ? 2.5 : 1.5), 0, Math.PI * 2); ctx.stroke(); }
    if (o.boost && !A.reduceFx) {                        // élan : deux volutes vermillon qui tournent
      ctx.strokeStyle = 'rgba(224,69,47,0.8)'; ctx.lineWidth = 2; ctx.lineCap = 'round';
      for (let k = 0; k < 2; k++) { const t = now / 180 + k * Math.PI; ctx.beginPath(); ctx.arc(0, 0, r + 5, t, t + 1.1); ctx.stroke(); }
    }
    ctx.restore();
    if (o.me) {                                          // repère « c'est moi » : anneau washi pulsé + pointe vermillon au-dessus
      ctx.save(); ctx.strokeStyle = K.washi; ctx.lineWidth = 1.6; ctx.globalAlpha = A.reduceFx ? 0.8 : 0.55 + 0.4 * Math.sin(now / 200);
      ctx.beginPath(); ctx.arc(x, y, r + 4, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1;
      const ty = y - r - 9; ctx.fillStyle = K.verm; ctx.strokeStyle = K.ink; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(x - 6, ty - 8); ctx.lineTo(x + 6, ty - 8); ctx.lineTo(x, ty); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
    }
  }

  // bonus au sol : jeton de washi cerclé de sa couleur + pictogramme vectoriel
  function drawPickupIcon(t, x, y, s, col) {
    const k = s / 10; ctx.save(); ctx.translate(x, y); ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (t === 'heavy') {                                 // onigiri : triangle de riz arrondi + feuille de nori
      ctx.fillStyle = '#fbf7ee'; ctx.strokeStyle = col; ctx.lineWidth = 1.4 * k;
      ctx.beginPath(); ctx.moveTo(0, -6 * k); ctx.quadraticCurveTo(1.2 * k, -6.4 * k, 6.2 * k, 3.6 * k); ctx.quadraticCurveTo(6.4 * k, 5.6 * k, 4 * k, 5.6 * k); ctx.lineTo(-4 * k, 5.6 * k); ctx.quadraticCurveTo(-6.4 * k, 5.6 * k, -6.2 * k, 3.6 * k); ctx.quadraticCurveTo(-1.2 * k, -6.4 * k, 0, -6 * k); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#1f2a1c'; ctx.fillRect(-2.6 * k, 1 * k, 5.2 * k, 4.6 * k);
    } else if (t === 'dash') {                           // éclair
      ctx.beginPath(); ctx.moveTo(1.5 * k, -6.5 * k); ctx.lineTo(-3 * k, 0.8 * k); ctx.lineTo(0.2 * k, 0.8 * k); ctx.lineTo(-1.6 * k, 6.5 * k); ctx.lineTo(3.6 * k, -1.2 * k); ctx.lineTo(0.4 * k, -1.2 * k); ctx.closePath(); ctx.fill();
    } else if (t === 'shock') {                          // onde : point central + deux cercles
      ctx.beginPath(); ctx.arc(0, 0, 1.8 * k, 0, Math.PI * 2); ctx.fill(); ctx.lineWidth = 1.5 * k;
      for (const r of [3.8, 6.2]) { ctx.beginPath(); ctx.arc(0, 0, r * k, 0, Math.PI * 2); ctx.stroke(); }
    } else if (t === 'grip') {                           // empreinte de pied : plante + 4 orteils
      ctx.beginPath(); oval(ctx, 0, 1.6 * k, 2.8 * k, 4.4 * k); ctx.fill();
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc((-2.4 + i * 1.6) * k, (-4.2 + Math.abs(i - 1.3) * 0.5) * k, (i === 0 ? 1.1 : 0.85) * k, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.restore();
  }

  // ───────────────────────── écran titre : « SUMO » devant un ensō ─────────────────────────
  // Cercle zen tracé au pinceau : 6 soies de largeur variable (appui au départ, effilement à la fin) qui
  // se cassent en fin de course (kasure, pinceau sec). Il se trace, se tient, s'efface, et recommence.
  function drawEnso(cx, cy, R, prog, alpha) {
    const BR = 6, SEG = 60, th0 = Math.PI * 0.68, span = Math.PI * 1.82;
    const wAt = t => { let w = R * 0.2 * (0.45 + 0.7 * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.15 + 0.05)), 0.6)); if (t < 0.07) w *= 1 + (0.07 - t) / 0.07 * 0.5; return w; };
    const rAt = t => R * (1 + 0.025 * Math.sin(t * 9 + 1) + 0.012 * Math.sin(t * 23));
    ctx.save(); ctx.lineCap = 'round'; ctx.strokeStyle = K.washi;
    const last = Math.max(1, Math.round(SEG * prog));
    for (let j = 0; j < BR; j++) {
      const off = (j / (BR - 1) - 0.5) * 0.92, edge = Math.abs(off) * 2;
      for (let i = 0; i < last; i++) {
        const t0 = i / SEG, t1 = (i + 1) / SEG;
        if (t0 > 0.5 && hash2(j, i) < (t0 - 0.5) * (0.9 + edge * 1.6)) continue;    // soie sèche : trouée vers la fin
        const w0 = wAt(t0), w1 = wAt(t1), a0 = th0 + span * t0, a1 = th0 + span * t1, r0 = rAt(t0) + off * w0, r1 = rAt(t1) + off * w1;
        ctx.globalAlpha = alpha * (0.72 + 0.28 * (1 - edge));
        ctx.lineWidth = Math.max(1, (w0 / BR) * 1.55);
        ctx.beginPath(); ctx.moveTo(cx + Math.cos(a0) * r0, cy + Math.sin(a0) * r0); ctx.lineTo(cx + Math.cos(a1) * r1, cy + Math.sin(a1) * r1); ctx.stroke();
      }
    }
    ctx.restore();
  }
  function drawTitle(cx, cy, now) {
    const TXT = 'SUMO', anim = !A.reduceFx;
    ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    let fs = 62; ctx.font = fs + 'px ' + DISP;
    const maxW = AR * 0.56, w0 = ctx.measureText(TXT).width;
    if (w0 > maxW) { fs = Math.max(22, Math.floor(fs * maxW / w0)); ctx.font = fs + 'px ' + DISP; }   // tient dans l'arène (mobile)
    const R = fs * 1.12;
    // ensō : se trace en 1,6 s, tient, s'efface en 0,6 s, cycle de 9 s (figé et complet en « réduire les effets »)
    let prog = 1, al = 0.92;
    if (anim) { const cyc = now % 9000; prog = Math.min(1, cyc / 1600); al = cyc > 8400 ? 0.92 * (1 - (cyc - 8400) / 600) : 0.92; }
    drawEnso(cx, cy, R, prog, al);
    // hanko : sceau vermillon « 相撲 » au bas du cercle
    const hs = fs * 0.42, hx = cx + R * 0.82, hy = cy + R * 0.66;
    ctx.save(); ctx.translate(hx, hy); ctx.rotate(-0.06); ctx.fillStyle = K.verm; ctx.fillRect(-hs / 2, -hs / 2, hs, hs);
    ctx.fillStyle = K.washi; ctx.font = Math.round(hs * 0.4) + 'px ' + DISP; ctx.fillText('相', 0, -hs * 0.2); ctx.fillText('撲', 0, hs * 0.22);
    ctx.restore(); ctx.font = fs + 'px ' + DISP;
    // le mot : contour d'encre épais puis vermillon en dégradé, liseré d'or
    if (anim) { ctx.shadowColor = 'rgba(224,69,47,0.45)'; ctx.shadowBlur = 14 + 5 * Math.sin(now / 700); }
    ctx.lineWidth = Math.max(3, fs * 0.14); ctx.strokeStyle = K.ink; ctx.strokeText(TXT, cx, cy);
    ctx.shadowBlur = 0;
    const tg = ctx.createLinearGradient(0, cy - fs * 0.5, 0, cy + fs * 0.5); tg.addColorStop(0, '#f47a5f'); tg.addColorStop(0.55, K.verm); tg.addColorStop(1, '#a92a18');
    ctx.fillStyle = tg; ctx.fillText(TXT, cx, cy);
    ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(224,178,60,0.7)'; ctx.strokeText(TXT, cx, cy);
    ctx.restore();
  }

  // ───────────────────────── tassels du toit (fusa) aux 4 coins ─────────────────────────
  function drawTassels(now) {
    const c = AR / 2, hp = platHalf();
    ctx.save();
    TASSELS.forEach((t, i) => {
      const sw = A.reduceFx ? 0 : Math.sin(now / 1300 + i * 1.7) * 2.2, x = c + t.sx * (hp + 3) + sw, y = c + t.sy * (hp + 3) + Math.cos(now / 1500 + i) * 1.2;
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.arc(x + 6, y + 9, 14, 0, Math.PI * 2); ctx.fill();   // ombre au sol (le pompon pend du toit)
      ctx.fillStyle = 'rgba(241,230,208,0.16)'; ctx.beginPath(); ctx.arc(x, y, 16, 0, Math.PI * 2); ctx.fill();   // halo washi : le pompon NOIR disparaissait sur le bois laqué
      ctx.strokeStyle = t.c; ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.beginPath();                           // franges rayonnantes
      for (let k = 0; k < 22; k++) { const a = k / 22 * Math.PI * 2 + i, l = 12 + (k % 3) * 1.6; ctx.moveTo(x + Math.cos(a) * 5, y + Math.sin(a) * 5); ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); }
      ctx.stroke();
      ctx.strokeStyle = t.h; ctx.lineWidth = 1; ctx.globalAlpha = 0.55; ctx.beginPath();
      for (let k = 0; k < 11; k++) { const a = k / 11 * Math.PI * 2 + i + 0.12; ctx.moveTo(x + Math.cos(a) * 5, y + Math.sin(a) * 5); ctx.lineTo(x + Math.cos(a) * 11, y + Math.sin(a) * 11); }
      ctx.stroke(); ctx.globalAlpha = 1;
      ctx.fillStyle = t.c; ctx.beginPath(); ctx.arc(x, y, 5.5, 0, Math.PI * 2); ctx.fill();                          // nœud
      ctx.strokeStyle = K.gold; ctx.lineWidth = 1.4; ctx.stroke();
      if (A.contrast) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y, 13.5, 0, Math.PI * 2); ctx.stroke(); }
    });
    ctx.restore();
  }

  // ───────────────────────── éclairage dynamique (sous les pièces) ─────────────────────────
  // Lanternes chaudes aux 4 coins du dohyō (plus présentes à la tombée du jour), halo des jetons, aura des
  // lutteurs en charge / en élan, puis les flashs éphémères (chocs, départs de charge, ondes, sorties).
  function eclairer(now, pv, rf) {
    const c = AR / 2, hp = platHalf(), li = 0.07 + 0.2 * duskV, lr = AR * (0.2 + 0.06 * duskV);
    for (let i = 0; i < 4; i++) {
      const t = TASSELS[i], fl = 1 + 0.06 * Math.sin(now / 170 + i * 2.1) + 0.04 * Math.sin(now / 53 + i);
      lumiere(ctx, c + t.sx * hp * 0.9, c + t.sy * hp * 0.9, lr * fl, '#ffb45a', li * fl);
    }
    if (snap) {
      const pk = snap.pickups || [];
      for (let i = 0; i < pk.length; i++) lumiere(ctx, pk[i].x, pk[i].y, 34, puLum(pk[i].t), 0.2 + 0.06 * Math.sin(now / 220 + pk[i].x));
      snap.players.forEach(p => {
        if (!p.playing || !p.alive || !(p.dashing || p.boost)) return;
        const v = (pv && pv[p.seat]) || p, r = p.r || PR;
        if (p.dashing) lumiere(ctx, v.x, v.y, r * 2.8, '#ff6a3d', 0.3 + 0.08 * Math.sin(now / 40 + p.seat));
        else lumiere(ctx, v.x, v.y, r * 2, '#ff7a55', 0.14);
      });
    }
    if (!rf) LUM.dessiner(ctx, now);                        // les éclats des événements ne sont pas rejoués
  }

  // ───────────────────────── pétales de cerisier (sakura) ─────────────────────────
  // 14 pétales qui dérivent lentement pendant la manche, sous les lutteurs. Positions tirées de l'horloge
  // (rien à stocker ni à allouer par image) ; coupés par « réduire les effets » et par le contraste élevé.
  const PETALS = (() => { const r = rng(0x5a4c12); return Array.from({ length: 14 }, () => ({ x: r(), y: r(), s: 0.7 + r() * 0.6, ph: r() * 6.28, rot: r() * 6.28, sz: 2.6 + r() * 1.8 })); })();
  function drawPetals(now, k) {
    const W = AR + 60, t = now / 1000;
    ctx.save(); ctx.fillStyle = '#f4b8c8';
    for (let i = 0; i < PETALS.length; i++) {
      const q = PETALS[i];
      const x = ((q.x * W + t * 9 * q.s + Math.sin(t * 0.7 * q.s + q.ph) * 22) % W + W) % W - 30, y = ((q.y * W + t * 14 * q.s) % W + W) % W - 30;
      ctx.globalAlpha = 0.6 * k;
      ctx.save(); ctx.translate(x, y); ctx.rotate(q.rot + t * 0.9 * q.s); ctx.scale(1.35, 0.15 + 0.6 * Math.abs(Math.sin(t * 1.3 * q.s + q.ph)));   // le pétale se retourne en tombant
      ctx.beginPath(); ctx.arc(0, 0, q.sz, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
    ctx.restore();
  }

  // ───────────────────────── ralenti, podium ─────────────────────────
  // Positions interpolées d'un instant du ralenti (mêmes règles que viewPlayers : pas de glissement sur un saut > 60 u). Ne modifie jamais f.a / f.b.
  function replayPlayers(f) {
    const outp = {}, al = f.u;
    f.b.players.forEach(pb => {
      if (!pb.playing) return;
      const pa = f.a.players[pb.seat]; let x = pb.x, y = pb.y, ang = pb.a || 0;
      if (pa && pa.playing && pa.alive && Math.hypot(pb.x - pa.x, pb.y - pa.y) < 60) { x = pa.x + (pb.x - pa.x) * al; y = pa.y + (pb.y - pa.y) * al; const da = Math.atan2(Math.sin(ang - (pa.a || 0)), Math.cos(ang - (pa.a || 0))); ang = (pa.a || 0) + da * al; }
      outp[pb.seat] = { x, y, a: ang };
    });
    return outp;
  }
  // lutteur sorti : s'envole en tournoyant vers « la caméra » (plus gros) puis s'efface ; t = 0..1 (direct : 1,1 s ; ralenti : 0,7 s de temps de jeu)
  function drawFlyer(f, t, now) {
    if (A.reduceFx) { drawRikishi(f.seat, f.x, f.y, f.a, f.r, { alpha: 1 - t, shadow: false, name: f.name }, now); return; }
    const e = 1 - (1 - t) * (1 - t), dx = Math.cos(f.dir) * 70 * e, dy = Math.sin(f.dir) * 70 * e - 26 * Math.sin(Math.PI * t);
    ctx.save(); ctx.fillStyle = 'rgba(40,20,8,' + (0.3 * (1 - t)) + ')'; ctx.beginPath(); ctx.arc(f.x + Math.cos(f.dir) * 70 * e + 8 * t, f.y + Math.sin(f.dir) * 70 * e + 12 * t, f.r * (1 - 0.3 * t), 0, Math.PI * 2); ctx.fill(); ctx.restore();
    drawRikishi(f.seat, f.x + dx, f.y + dy, f.a, f.r, { scale: 1 + 0.9 * e, spin: t * 9, alpha: 1 - t * t, shadow: false, name: f.name }, now);
  }
  // fin du ralenti (fini ou passé) : la carte de fin, le jingle et le podium arrivent enfin
  function finReplay(now) {
    const m = pendingEnd; pendingEnd = null;
    if (!m || !snap || snap.gs !== 'over') return;
    showEndscreen(m); endShown = true; overT0 = now; sound('win'); music.sting('win');
  }
  // podium : lutteurs vus de dessus sur des marches de bois laqué, cordon de paille en arête ; fond de l'arène assombri (la carte DOM prend le bas du cadre)
  function drawPodiumScene(now) {
    const list = podEntries(snap);
    if (!list.length) return;
    const k = A.reduceFx ? 1 : Math.max(0, Math.min(1, (now - overT0) / 350));
    ctx.save();
    ctx.fillStyle = 'rgba(18,12,9,' + ((A.contrast ? 0.9 : 0.74) * k).toFixed(2) + ')'; ctx.fillRect(-24, -24, AR + 48, AR + 48);
    ctx.restore();
    const ph = AR * podFrac();
    drawPodium(ctx, { x: AR * 0.03, y: AR * 0.015, w: AR * 0.94, h: ph - AR * 0.03 }, now, {
      entries: list, A, W: AR, t0: overT0, nul: winTeam(snap) < 0,
      theme: { step: '#6b4a2b', edge: K.straw, text: K.washi, glow: K.gold },
      drawPiece(c, e, x, y, size, rank) { drawRikishi(e.seat, x, y, -Math.PI / 2 + (rank === 1 && !A.reduceFx ? 0.16 * Math.sin(now / 500) : 0), size * 0.4, { shadow: false }, now); },
    });
  }

  // ───────────────────────── rendu d'une image ─────────────────────────
  // draw() choisit ce qu'on montre : pendant le ralenti, `snap` désigne (le temps de l'image) le snapshot rejoué le plus proche, ce qui fait
  // tout lire au même endroit (arène, bonus, lutteurs) ; scene() reçoit rf (image du ralenti) ou null.
  function draw() {
    if (destroyed) return;
    const now = performance.now(), rf = A.reduceFx ? null : RL.frame(now);
    if (!rf) { if (pendingEnd && (A.reduceFx || !RL.active(now))) finReplay(now); scene(now, null); return; }
    const real = snap; snap = rf.u < 0.5 ? rf.a : rf.b;
    try { scene(now, rf); } finally { snap = real; }
  }
  function scene(now, rf) {
    const kdt = Math.min(3, Math.max(0.25, (now - (lastFrame || now - 16.7)) / 16.7)); lastFrame = now;
    if (!A.reduceFx && !rf && HS.frozen(now)) return;       // arrêt sur image (60 ms) à chaque sortie : on garde l'image précédente
    const sc = cv.width / AR, c = AR / 2;
    let ox = 0, oy = 0;
    if (shakeMag > 0.3 && !A.reduceFx && !rf) { ox = (Math.random() * 2 - 1) * shakeMag; oy = (Math.random() * 2 - 1) * shakeMag; shakeMag *= 0.86; } else shakeMag = 0;
    if (ox || oy) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = K.wood; ctx.fillRect(0, 0, cv.width, cv.height); }   // marge peinte avant le décor : la secousse ne laisse plus de liseré de l'image d'avant
    ctx.setTransform(sc, 0, 0, sc, ox * sc, oy * sc);
    const pv = rf ? replayPlayers(rf) : (snap ? viewPlayers(now) : null);
    { let nT = 0, nA = 0;                                   // caméra de duel : exactement 2 lutteurs encore en lice (sur 3 ou plus au départ)
      if (snap && pv && (rf || snap.gs === 'play' || snap.gs === 'paused')) snap.players.forEach(q => { if (!q.playing) return; nT++; if (q.alive) { if (nA < 2) { const v = pv[q.seat] || q; CPTS[nA].x = v.x; CPTS[nA].y = v.y; } nA++; } });
      CAM.update(CPTS, AR, AR, nT >= 3 && nA === 2, A, now); }
    ctx.save(); CAM.apply(ctx);                             // le décor est dans la caméra (sinon pièces et décor se décalent) ; le HUD, le crépuscule et les textes restent dehors
    ensureDecor(); ctx.drawImage(decorCv, 0, 0, AR, AR);
    const R = snap && snap.ring ? snap.ring : RING_0;
    // zone perdue par le rétrécissement : argile assombrie + fantôme du cordon d'origine
    if (R < RING_0 - 0.5) {
      ctx.save(); ctx.beginPath(); ctx.arc(c, c, RING_0 + 8, 0, Math.PI * 2); ctx.moveTo(c + R, c); ctx.arc(c, c, R, Math.PI * 2, 0, true);
      ctx.fillStyle = 'rgba(60,24,12,0.3)'; ctx.fill();
      ctx.setLineDash([8, 6]); ctx.strokeStyle = 'rgba(217,194,122,0.3)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(c, c, RING_0, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
      ctx.restore();
    }
    drawTawara(R, now);
    petK += (((snap && snap.gs === 'play' && !A.reduceFx && !A.contrast) ? 1 : 0) - petK) * Math.min(1, 0.05 * kdt); if (petK < 0.01) petK = 0;   // pétales : fondu à l'entrée / la sortie de manche
    if (petK > 0) drawPetals(now, petK);
    if (!A.reduceFx) eclairer(now, pv, rf);
    // crépuscule : 0 tant que la paille est entière, 1 au plancher ; la mort subite l'amorce aussitôt
    let duskT = 0;
    if (snap && (snap.gs === 'play' || snap.gs === 'paused' || snap.gs === 'over')) {
      duskT = Math.max(0, Math.min(1, (1 - R / RING_0) / (1 - DUSK_FLOOR)));
      if (snap.sd) duskT = Math.max(duskT, Math.min(0.22, (now - sdT0) / 5000 * 0.22));
      duskT = Math.max(duskT, rf ? duskV : DUEL.t(snap, now, duelAnnonce));   // duel final : la nuit tombe (ralenti : on garde la nuit déjà tombée)
    }
    duskV += (duskT - duskV) * Math.min(1, 0.04 * kdt);
    if (duskV < 0.002) duskV = 0;

    let dangerK = 0;                                        // 0..1 : mon lutteur frôle la paille (posé plus bas) → vignette rouge
    if (snap) {
      // bonus au sol
      (snap.pickups || []).forEach(pk => {
        const d = PU[pk.t] || { c: '#888' }, pulse = A.reduceFx ? 1 : 1 + 0.08 * Math.sin(now / 220 + pk.x), rr = 12 * pulse;
        ctx.save(); ctx.fillStyle = 'rgba(40,20,8,0.28)'; ctx.beginPath(); ctx.arc(pk.x + 2, pk.y + 3, rr, 0, Math.PI * 2); ctx.fill();
        if (!A.reduceFx) { const ph = (now / 1400 + pk.y / 97) % 1; ctx.strokeStyle = d.c; ctx.globalAlpha = 0.5 * (1 - ph); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(pk.x, pk.y, rr + ph * 14, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1; }
        ctx.fillStyle = K.washi; ctx.strokeStyle = d.c; ctx.lineWidth = A.contrast ? 3.5 : 2.5; ctx.beginPath(); ctx.arc(pk.x, pk.y, rr, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.restore();
        drawPickupIcon(pk.t, pk.x, pk.y, 10 * pulse, d.c);
      });
      // lutteurs
      const me = mySeat >= 0 ? snap.players[mySeat] : null;
      const over = snap.gs === 'over', wt = winTeam(snap);
      let nPlay = 0; snap.players.forEach(p => { if (p.playing) nPlay++; });
      snap.players.forEach(p => {
        if (!p.playing || !p.alive) return;
        const v = (pv && pv[p.seat]) || p, r = p.r || PR, col = colSeat(p.seat);
        if (p.dashing) {                                  // charge : traînée fantôme derrière + poussière soulevée
          const vx = p.vx || Math.cos(v.a) * 8, vy = p.vy || Math.sin(v.a) * 8;
          if (!A.reduceFx) { ctx.save(); ctx.fillStyle = col; for (let k = 3; k >= 1; k--) { ctx.globalAlpha = 0.24 / k; ctx.beginPath(); ctx.arc(v.x - vx * 1.4 * k, v.y - vy * 1.4 * k, r * (1 - k * 0.08), 0, Math.PI * 2); ctx.fill(); } ctx.restore(); }
          if (!A.reduceFx && Math.random() < 0.7 * kdt) puffs.push({ x: v.x - Math.cos(v.a) * r, y: v.y - Math.sin(v.a) * r, vx: (Math.random() * 2 - 1) * 0.6 - vx * 0.05, vy: (Math.random() * 2 - 1) * 0.6 - vy * 0.05, born: now, life: 420 + Math.random() * 260, r0: 3 + Math.random() * 4, col: '214,182,130' });
        } else if (!A.reduceFx && Math.hypot(p.vx || 0, p.vy || 0) > 3.5 && Math.random() < 0.12 * kdt) {   // suri-ashi : les pieds frottent le sable
          puffs.push({ x: v.x - Math.cos(v.a) * r * 0.8, y: v.y - Math.sin(v.a) * r * 0.8, vx: (Math.random() * 2 - 1) * 0.3, vy: (Math.random() * 2 - 1) * 0.3, born: now, life: 320, r0: 2 + Math.random() * 2, col: '222,196,150' });
        }
        drawRikishi(p.seat, v.x, v.y, v.a, r, { dashing: p.dashing, brace: p.brace, heavy: p.heavy, lvl: p.lvl, grip: p.grip, boost: p.boost, tired: p.tired, slip: p.slip, stun: p.stun, me: p.seat === mySeat && !over, name: p.bot ? null : p.name }, now);
        if (over && wt >= 0 && p.team === wt) { ctx.save(); ctx.strokeStyle = K.gold; ctx.lineWidth = A.contrast ? 3.5 : 2.5; ctx.globalAlpha = A.reduceFx ? 0.9 : 0.5 + 0.4 * Math.sin(now / 180); ctx.beginPath(); ctx.arc(v.x, v.y, r + 8, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }   // vainqueur(s) auréolé(s) : jamais sur une égalité (winner = -1), fixe sous « réduire les effets »
      });
      // pastilles numérotées de siège : toujours à partir de 7 lutteurs (les teintes ne suffisent plus), sinon au décompte et 2 s après le coup d'envoi
      if (snap.gs === 'countdown' || ((snap.gs === 'play' || snap.gs === 'paused') && (nPlay >= 7 || now - goT0 < 2000))) {
        const cs = readable(18, cv, AR, 20);                // 20 px CSS mini : le chiffre (0,44 × taille) reste ≥ 9 px
        snap.players.forEach(p => {
          if (!p.playing || !p.alive) return;
          const v = (pv && pv[p.seat]) || p, r = p.r || PR, cy = v.y - r - (p.seat === mySeat ? 20 + cs * 0.5 : 8 + cs * 0.5);   // au-dessus de la pointe « c'est moi »
          drawSeatChip(ctx, Math.max(cs / 2 + 2, Math.min(AR - cs / 2 - 2, v.x)), Math.max(cs / 2 + 2, cy), p.seat, colSeat(p.seat), cs);
        });
      }
      // danger : mon lutteur approche la paille -> l'arc du cordon le plus proche rougeoie
      if (me && me.playing && me.alive && snap.gs === 'play' && !rf) {
        const v = (pv && pv[mySeat]) || me, d = Math.hypot(v.x - c, v.y - c), u = (d / R - 0.78) / 0.22;
        if (u > 0) dangerK = Math.min(1, u);
        if (u > 0) { const th = Math.atan2(v.y - c, v.x - c); ctx.save(); ctx.strokeStyle = K.verm; ctx.lineCap = 'round'; ctx.globalAlpha = Math.min(1, u) * (A.reduceFx ? 0.7 : 0.45 + 0.35 * Math.sin(now / 90)); ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(c, c, R - 9, th - 0.38, th + 0.38); ctx.stroke(); ctx.restore(); }
      }
    }
    // lutteurs sortis : s'envolent en tournoyant vers « la caméra » (plus gros), puis s'effacent
    for (let i = rf ? -1 : flyers.length - 1; i >= 0; i--) {   // (ralenti : les sorties en direct ne se rejouent pas, on les déduit plus bas)
      const f = flyers[i], t = (now - f.born) / 1100;
      if (t >= 1) { flyers.splice(i, 1); continue; }
      drawFlyer(f, t, now);
    }
    if (rf) {                                               // ralenti : un lutteur vivant dans a, sorti dans b, s'envole comme en direct (durée en temps de jeu)
      const g = rf.ta + rf.u * (rf.tb - rf.ta), ps = rf.b.players;
      for (let i = 0; i < ps.length; i++) {
        const pa = rf.a.players[i], pb = ps[i];
        if (pa && pb && pa.playing && pa.alive && !pb.alive && !repOut[i]) { const v = (pv && pv[i]) || pb; repOut[i] = { seat: i, x: v.x, y: v.y, dir: Math.atan2(v.y - c, v.x - c), a: v.a || 0, r: pb.r || pa.r || PR, g0: g }; repHas = true; }
      }
      if (repHas) for (const k in repOut) { const f = repOut[k], t = (g - f.g0) / 700; if (t >= 0 && t < 1) drawFlyer(f, t, now); }
    } else if (repHas) { repOut = {}; repHas = false; }
    // poussière (opaque), sel rituel (pseudo-3D : hauteur z + ombre au sol), étincelles de choc, ondes
    if (!A.reduceFx && !rf) {
      ctx.save();
      for (let i = puffs.length - 1; i >= 0; i--) { const q = puffs[i], tt = (now - q.born) / q.life; if (tt >= 1) { puffs.splice(i, 1); continue; } q.x += q.vx * kdt; q.y += q.vy * kdt; q.vx *= 0.94; q.vy *= 0.94; ctx.globalAlpha = (1 - tt) * 0.45; ctx.fillStyle = 'rgb(' + q.col + ')'; ctx.beginPath(); ctx.arc(q.x, q.y, q.r0 + tt * 7, 0, Math.PI * 2); ctx.fill(); }
      for (let i = salt.length - 1; i >= 0; i--) {
        const q = salt[i], tt = (now - q.born) / q.life; if (tt >= 1) { salt.splice(i, 1); continue; }
        q.x += q.vx * kdt; q.y += q.vy * kdt; q.z += q.vz * kdt; q.vz -= 0.22 * kdt;
        if (q.z <= 0) { q.z = 0; q.vz = 0; q.vx *= 0.6; q.vy *= 0.6; }
        const al = tt > 0.7 ? (1 - tt) / 0.3 : 1;
        if (q.z > 1) { ctx.globalAlpha = 0.18 * al; ctx.fillStyle = '#3a2a18'; ctx.fillRect(q.x, q.y, 1.6, 1.6); }
        ctx.globalAlpha = al; ctx.fillStyle = '#fbf8f1'; const s = 1.3 + q.z * 0.05; ctx.fillRect(q.x - s / 2, q.y - q.z * 0.6 - s / 2, s, s);
      }
      ctx.strokeStyle = K.washi; ctx.lineCap = 'round';
      for (let i = sparks.length - 1; i >= 0; i--) { const q = sparks[i], tt = (now - q.born) / q.life; if (tt >= 1) { sparks.splice(i, 1); continue; } q.x += q.vx * kdt; q.y += q.vy * kdt; q.vx *= 0.9; q.vy *= 0.9; ctx.globalAlpha = 1 - tt; ctx.lineWidth = 2 * (1 - tt) + 0.5; ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(q.x - q.vx * 1.6, q.y - q.vy * 1.6); ctx.stroke(); }
      for (let i = waves.length - 1; i >= 0; i--) { const q = waves[i], tt = (now - q.born) / q.life; if (tt >= 1) { waves.splice(i, 1); continue; } if (tt < 0) continue; const e = 1 - (1 - tt) * (1 - tt); ctx.globalAlpha = 0.7 * (1 - tt); ctx.strokeStyle = 'rgb(' + q.col + ')'; ctx.lineWidth = q.lw * (1 - tt * 0.6); ctx.beginPath(); ctx.arc(q.x, q.y, q.r0 + (q.r1 - q.r0) * e, 0, Math.PI * 2); ctx.stroke(); }
      // ramassage d'onigiri : gerbe de rayons d'or dont le nombre, la portée et l'épaisseur croissent avec le palier (le 5e ajoute un éclat blanc)
      ctx.strokeStyle = '#f2cf6a'; ctx.lineCap = 'round';
      for (let i = bursts.length - 1; i >= 0; i--) {
        const q = bursts[i], life = 520 + 90 * q.tier, tt = (now - q.born) / life; if (tt >= 1) { bursts.splice(i, 1); continue; }
        const e = 1 - (1 - tt) * (1 - tt), n = 6 + 2 * q.tier, a0 = q.tier * 0.35, rin = 12 + (10 + 9 * q.tier) * e, rout = rin + 6 + 5 * q.tier * (1 - tt);
        ctx.globalAlpha = 1 - tt; ctx.lineWidth = 1.8 + 0.5 * q.tier * (1 - tt); ctx.beginPath();
        for (let k = 0; k < n; k++) { const a = a0 + k * Math.PI * 2 / n; ctx.moveTo(q.x + Math.cos(a) * rin, q.y + Math.sin(a) * rin); ctx.lineTo(q.x + Math.cos(a) * rout, q.y + Math.sin(a) * rout); }
        ctx.stroke();
        if (q.tier >= 5) drawFlash(ctx, q.x, q.y, 30, tt * 1.8);
      }
      // éclats blancs de sortie (victime) : 260 ms, sans le moindre coût hors élimination
      for (let i = flashes.length - 1; i >= 0; i--) { const q = flashes[i], tt = (now - q.born) / 260; if (tt >= 1) { flashes.splice(i, 1); continue; } drawFlash(ctx, q.x, q.y, q.r, tt); }
      ctx.restore();
    } else { puffs.length = 0; salt.length = 0; sparks.length = 0; waves.length = 0; bursts.length = 0; flashes.length = 0; }
    drawTassels(now);
    ctx.restore();                                          // fin de la caméra de duel
    // étalonnage jour → crépuscule par-dessus l'arène (débord de 24 u : la secousse ne découvre pas de bord clair)
    crepuscule(ctx, -24, -24, AR + 48, AR + 48, duskV, { soleil: 'haut', force: A.contrast ? 0.45 : A.reduceFx ? 0.55 : 1 });
    if (dangerK > 0) drawDanger(ctx, AR, AR, dangerK * (A.contrast ? 0.9 : 0.6), A.reduceFx ? 0 : now);   // vignette de danger (fixe sous « réduire les effets » : le pouls dépend de `now`)
    // « OUT » : gros texte vermillon cerné d'encre, qui claque puis s'efface (ramené vers l'intérieur pour rester lisible)
    for (let i = rf ? -1 : outTxt.length - 1; i >= 0; i--) {
      const o = outTxt[i], t = (now - o.born) / 1300; if (t >= 1) { outTxt.splice(i, 1); continue; }
      const dx = o.x - c, dy = o.y - c, d = Math.hypot(dx, dy) || 1, pull = Math.min(d, Math.max(0, d - (AR / 2 - 70)) + 40);
      const x = Math.max(60, Math.min(AR - 60, o.x - dx / d * pull)), y = Math.max(40, Math.min(AR - 30, o.y - dy / d * pull));
      const s = A.reduceFx ? 1 : (t < 0.12 ? 0.5 + 0.7 * t / 0.12 : t < 0.22 ? 1.2 - 0.2 * (t - 0.12) / 0.1 : 1);
      ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.rotate(-0.08); ctx.globalAlpha = t > 0.7 ? (1 - t) / 0.3 : 1;
      ctx.font = '46px ' + DISP; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
      ctx.lineWidth = 8; ctx.strokeStyle = K.ink; ctx.strokeText('OUT', 0, 0); ctx.fillStyle = K.verm; ctx.fillText('OUT', 0, 0);
      ctx.lineWidth = 1.2; ctx.strokeStyle = colSeat(o.seat); ctx.strokeText('OUT', 0, 0);
      ctx.restore();
    }

    // jauges du joueur local : charge et ancrage, + bonus actifs. Bloc HUD mis à l'échelle autour de son ancrage (bas-centre) pour rester
    // lisible sur téléphone (hudK) ; textes ≥ 9 px CSS (readable) ; les indications clavier n'apparaissent pas sur écran tactile.
    const me = (snap && mySeat >= 0) ? snap.players[mySeat] : null;
    if (me && me.playing && me.alive && snap.gs === 'play' && !rf) {
      const bw = 112, bh = 10, gapx = 18, y = -12, x1 = -bw - gapx / 2, x2 = gapx / 2;
      const k = Math.min(hudK(cv, AR), AR * 0.94 / (2 * bw + gapx)), fs = readable(10, cv, AR / k, 9), fnt = 'bold ' + fs.toFixed(1) + 'px system-ui, sans-serif';
      ctx.save(); ctx.translate(c, AR - 12); ctx.scale(k, k);
      const gauge = (x, v, col, lab, active) => {
        ctx.fillStyle = 'rgba(28,26,23,0.72)'; ctx.fillRect(x - 2, y - 2, bw + 4, bh + 4);
        ctx.fillStyle = v >= 1 ? col : 'rgba(241,230,208,0.35)'; ctx.fillRect(x, y, bw * Math.max(0, Math.min(1, v || 0)), bh);
        if (active && !A.reduceFx) { ctx.save(); ctx.globalAlpha = 0.35 + 0.3 * Math.sin(now / 60); ctx.fillStyle = '#fff'; ctx.fillRect(x, y, bw, bh); ctx.restore(); }
        ctx.strokeStyle = A.contrast ? '#fff' : 'rgba(241,230,208,0.6)'; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, bw - 1, bh - 1);
        ctx.fillStyle = v >= 1 ? col : 'rgba(241,230,208,0.7)'; ctx.font = fnt; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
        let txt = lab + (v >= 1 ? ' · PRÊTE' : ''); if (ctx.measureText(txt).width > bw + gapx - 6) txt = lab + (v >= 1 ? ' ✓' : '');   // deux libellés voisins ne se chevauchent jamais
        const tw = ctx.measureText(txt).width, tx = Math.max(tw / 2 - c / k + 2, Math.min(c / k - tw / 2 - 2, x + bw / 2));           // reste dans le canvas
        ctx.fillText(txt, tx, y - 3);
      };
      gauge(x1, me.dcd, K.verm, TOUCH ? 'CHARGE' : 'CHARGE (Espace)', me.dashing);
      gauge(x2, me.bcd, K.straw, TOUCH ? 'ANCRAGE' : 'ANCRAGE (Maj)', me.brace);
      const tags = []; if (me.heavy) tags.push(['ONIGIRI ×' + (me.lvl | 0), PU.heavy.c]); if (me.boost) tags.push(['ÉLAN', PU.dash.c]); if (me.grip) tags.push(['PIEDS COLLÉS', PU.grip.c]);
      if (me.stun) tags.push(['SONNÉ', MALUS_MSG.stun.c]); if (me.tired) tags.push(['ESSOUFFLÉ', MALUS_MSG.tired.c]); if (me.slip) tags.push(['SOL GLISSANT', MALUS_MSG.slip.c]);
      if (tags.length) {
        ctx.font = fnt; const th = fs + 5, ws = tags.map(t => ctx.measureText(t[0]).width + 14), maxW = AR * 0.96 / k;
        const rows = [[]]; let rw = 0;                       // retour à la ligne : le bloc agrandi ne déborde jamais du canvas
        tags.forEach((t, i) => { if (rows[rows.length - 1].length && rw + ws[i] + 6 > maxW) { rows.push([]); rw = 0; } rows[rows.length - 1].push(i); rw += ws[i] + 6; });
        rows.forEach((row, ri) => {
          const tot = row.reduce((s, i) => s + ws[i] + 6, -6), ty = y - 18 - th - ri * (th + 4); let x = -tot / 2;
          row.forEach(i => { const t = tags[i]; ctx.fillStyle = K.washi; ctx.fillRect(x, ty, ws[i], th); ctx.fillStyle = t[1]; ctx.fillRect(x, ty, 3, th); ctx.fillStyle = K.ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t[0], x + ws[i] / 2 + 1, ty + th / 2 + 0.5); x += ws[i] + 6; });
        });
      }
      ctx.restore();
    }

    if (snap && snap.gs === 'countdown') {
      ctx.fillStyle = 'rgba(28,20,14,0.3)'; ctx.fillRect(0, 0, AR, AR); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const n = snap.count || 0, pulse = A.reduceFx ? 1 : 1 + 0.07 * Math.sin(now / 110);
      ctx.save(); ctx.translate(c, c - 6); ctx.scale(pulse, pulse);
      ctx.fillStyle = 'rgba(241,230,208,0.9)'; ctx.beginPath(); ctx.arc(0, 0, 62, 0, Math.PI * 2); ctx.fill();          // disque de washi
      ctx.strokeStyle = K.verm; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(0, 0, 62, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (n > 0 ? n / 3 : 1)); ctx.stroke();
      ctx.fillStyle = K.ink; ctx.font = (n > 0 ? 76 : 30) + 'px ' + DISP; ctx.fillText(n > 0 ? n : 'HAKKEYOI', 0, 4);
      ctx.restore();
      const fsub = readable(14, cv, AR, 10);
      ctx.lineJoin = 'round'; ctx.font = 'bold ' + fsub.toFixed(1) + 'px system-ui, sans-serif'; ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(28,26,23,0.8)';
      const sub = n > 0 ? 'Shikiri — en position…' : 'Nokotta !', sy = c + 72 + fsub * 0.45; ctx.strokeText(sub, c, sy); ctx.fillStyle = K.washi; ctx.fillText(sub, c, sy);
    }
    if (snap && (snap.gs === 'lobby' || snap.gs === 'paused')) {
      ctx.fillStyle = 'rgba(18,12,9,0.64)'; ctx.fillRect(0, 0, AR, AR); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      if (snap.gs === 'paused') {
        const fp = readable(14, cv, AR, 10);
        ctx.fillStyle = K.washi; ctx.font = '38px ' + DISP; ctx.fillText('PAUSE', c, c - 8);
        ctx.fillStyle = A.contrast ? K.washi : 'rgba(241,230,208,.75)'; ctx.font = fp.toFixed(1) + 'px system-ui, sans-serif'; ctx.fillText(TOUCH ? 'Matta ! — touche ▶ pour reprendre' : 'Matta ! — P / Échap pour reprendre', c, c + 22 + fp * 0.45);
      } else {
        drawTitle(c, c - 58, now);
        const n = snap.connected || 0, nb = snap.botCount || 0, tot = n + nb, y0 = c + 48 + 12, f1 = readable(15, cv, AR, 10), f2 = readable(13, cv, AR, 10);
        ctx.fillStyle = teamMode ? '#f0c9a0' : (A.contrast ? K.washi : 'rgba(241,230,208,.78)'); ctx.font = f1.toFixed(1) + 'px system-ui, sans-serif';
        ctx.fillText(`${n} lutteur${n > 1 ? 's' : ''}${nb ? ' + ' + nb + ' bot' + (nb > 1 ? 's' : '') : ''}${teamMode ? ' · ' + (MODE_NAME[snap.mode] || snap.mode) : ''}`, c, y0);
        ctx.fillStyle = A.contrast ? K.washi : 'rgba(241,230,208,.7)'; ctx.font = 'bold ' + f2.toFixed(1) + 'px system-ui, sans-serif';
        ctx.fillText(tot >= 2 ? (TOUCH ? '▶ Touche l\'écran pour monter sur le dohyō' : '▶ Espace / clic pour monter sur le dohyō') : 'En attente d\'un 2ᵉ lutteur… (ou ajoute un bot 🤖)', c, y0 + Math.max(26, (f1 + f2) * 0.8));
      }
    }
    if (!rf && snap && snap.gs === 'over' && endShown) drawPodiumScene(now);   // podium : après le ralenti éventuel, sous la carte DOM qui se cale en dessous
    if (rf) RL.drawOverlay(ctx, AR, AR, now, A);             // ralenti : bandes cinéma, « ⟲ RALENTI », barre de progression (en dernier)
    if (!rf) CALL.draw(ctx, AR, AR, now, A);                 // « DOUBLÉ ! / TRIPLÉ ! / CARNAGE ! » (fondu conservé sous « réduire les effets », sans l'animation d'échelle)
  }
  function drawLoop() { if (destroyed) return; try { draw(); } catch (e) { console.error('[render]', e); } rafId = requestAnimationFrame(drawLoop); }   // filet : une erreur de rendu ne fige plus le jeu

  // ───────────────────────── entrées ─────────────────────────
  function pushInput() { send({ t: 'input', up: input.up, down: input.down, left: input.left, right: input.right }); }
  function setIn(k, v) { if (input[k] === v) return; input[k] = v; pushInput(); }   // n'envoie qu'aux CHANGEMENTS
  const isPlay = () => snap && (snap.gs === 'play' || snap.gs === 'paused');
  const onKeyDown = e => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
    unlockAudio();
    if (e.repeat) return;                                 // la répétition auto relançait charge/ancrage et renvoyait les mêmes touches
    // start seulement hors partie : pendant le compte à rebours, Espace (réflexe « prêt à charger ») renvoyait un start inutile
    if (e.key === ' ' && (pendingEnd || RL.active(performance.now()))) { RL.skip(); return; }   // le PREMIER Espace pendant le ralenti le passe, sans lancer « Rejouer »
    if (e.key === ' ') { if (snap && (snap.gs === 'lobby' || snap.gs === 'over')) send({ t: 'start' }); else if (snap && snap.gs === 'play') send({ t: 'dash' }); return; }
    if ((e.key === 'Shift' || e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'KeyE') && isPlay()) { send({ t: 'brace' }); return; }
    if ((e.key === 'p' || e.key === 'P' || e.key === 'Escape') && isPlay()) { send({ t: 'pause' }); return; }
    const d = DIR_KEYS[e.code]; if (d) setIn(d, true);
  };
  const onKeyUp = e => { const d = DIR_KEYS[e.code]; if (d) setIn(d, false); };
  const onBlur = () => { let ch = false; for (const k in input) if (input[k]) { input[k] = false; ch = true; } if (ch) pushInput(); };   // fenêtre quittée : plus de touche « collée »
  // boutons maintenus : le joystick d'app.js les actionne par événements synthétiques (pas de setPointerCapture)
  function hold(id, k) { const el = $(id); if (!el) return; const on = e => { e.preventDefault(); unlockAudio(); setIn(k, true); }; const off = e => { e.preventDefault(); setIn(k, false); }; el.addEventListener('pointerdown', on); el.addEventListener('pointerup', off); el.addEventListener('pointerleave', off); el.addEventListener('pointercancel', off); }
  function tap(id, t) { const el = $(id); if (!el) return; el.addEventListener('pointerdown', e => { e.preventDefault(); unlockAudio(); send({ t }); }); }

  // Les boutons du DOM sont STATIQUES et le module est un singleton (import() en cache) : init() est
  // rappelé à chaque retour sur le jeu. Sans ce drapeau, chaque retour rebranchait les écouteurs sans
  // débrancher les précédents — après k retours, un appui partait k fois (k charges, k ancrages).
  // Leurs gestionnaires lisent l'état COURANT du module (send, snap…) : les brancher une fois suffit.
  let cable = false;
  function init(ctx0) {
    const premiere = !cable; cable = true;
    destroyed = false;              // module singleton réutilisé : réarmer la boucle de rendu après un précédent teardown
    A = ctx0.a11y; send = ctx0.send; root = ctx0.root;
    if (ctx0.togglePanel) togglePanel = ctx0.togglePanel; if (ctx0.closePanels) closePanels = ctx0.closePanels;
    cv = $('smc'); ctx = cv.getContext('2d'); hud = $('smHud'); endEl = $('smEnd');
    bodyCache = {}; decorKey = '';  // les dégradés en cache appartiennent au contexte : on repart propre
    const wrap = cv.parentElement;                                                  // cadre du canvas : support des bandeaux bonus/malus
    initGameMsg(wrap && wrap.classList.contains('canvas-wrap') ? wrap : null);
    hud.innerHTML = '';             // module réutilisé : repartir d'un HUD vide (sinon les cartes P1.. se cumulent à chaque retour)
    cards = Array.from({ length: MAX_SEATS }, (_, i) => i).map(i => { const el = document.createElement('div'); el.className = 'pc hidden'; el.innerHTML = `<div class="dot"></div><div class="inf"><div class="pn">P${i + 1}</div><div class="lv"></div></div>`; hud.appendChild(el); return el; });
    startBtn = $('smStart'); pauseBtn = $('smPause'); modeBtn = $('smMode'); botsBtn = $('smBots'); diffBtn = $('smDiff'); pauseFloat = $('smPauseFloat');
    lbBtn = $('smLbBtn'); lbPanel = $('smLbPanel'); lbBody = $('smLbBody'); dashBtn = $('smDash'); braceBtn = $('smBrace');
    startBtn.onclick = () => { unlockAudio(); send({ t: 'start' }); };
    pauseBtn.onclick = () => send({ t: 'pause' });
    pauseFloat.onclick = () => send({ t: 'pause' });
    modeBtn.onclick = () => send({ t: 'mode' });
    if (botsBtn) botsBtn.onclick = () => send({ t: 'bots' });
    if (diffBtn) diffBtn.onclick = () => send({ t: 'botdiff' });
    lbBtn.onclick = () => { togglePanel(lbPanel); renderLB(); };
    const helpBtn = $('smHelp'), helpPanel = $('smHelpPanel'); if (helpBtn && helpPanel) helpBtn.onclick = () => togglePanel(helpPanel);
    if (premiere) {                                       // le PREMIER appui pendant le ralenti le passe seulement : ni « Rejouer » ni aucune autre action (phase de capture, avant les boutons)
      root.addEventListener('pointerdown', e => { if (pendingEnd || RL.active(performance.now())) { RL.skip(); eatUntil = performance.now() + 700; e.stopPropagation(); } }, true);
      root.addEventListener('click', e => { if (eatUntil && performance.now() < eatUntil) { eatUntil = 0; e.stopPropagation(); e.preventDefault(); } }, true);
    }
    if (premiere) cv.addEventListener('click', () => { unlockAudio(); if (snap && !isPlay() && snap.gs !== 'countdown') send({ t: 'start' }); });
    if (premiere) endEl.addEventListener('click', () => { unlockAudio(); send({ t: 'start' }); });
    if (premiere) { hold('smUp', 'up'); hold('smDown', 'down'); hold('smLeft', 'left'); hold('smRight', 'right'); tap('smDash', 'dash'); tap('smBrace', 'brace'); }
    applyColors();
    resizeH = resizeCanvas; addEventListener('resize', resizeH); resizeCanvas();
    addEventListener('keydown', onKeyDown); addEventListener('keyup', onKeyUp); addEventListener('blur', onBlur);
    music.dispose(); music = createMusic(() => actx, () => A, MUSIC_THEME);   // instance neuve à chaque entrée (la précédente a été « disposée » au teardown)
    music.start();
    if (staleInput) { staleInput = false; pushInput(); }   // une touche était tenue quand on a quitté le jeu : le siège reçoit « tout relâché » (on est bien dans le Sumo ici)
    STREAK.reset(); bursts.length = 0; flashes.length = 0; goT0 = -1e9; petK = 0;
    RL.clear(); CAM.reset(); pendingEnd = null; repOut = {}; repHas = false; endPod = false; layoutEnd();   // ralenti / caméra / podium repartent à neuf
    rafId = requestAnimationFrame(drawLoop);
  }
  function onA11y() { applyColors(); if (A.reduceFx) RL.skip(); }   // « réduire les effets » activé pendant un ralenti : on le coupe
  function teardown() {
    destroyed = true; music.dispose(); music = NOMUSIC; cancelAnimationFrame(rafId); J.fin(); LUM.vider();   // retour au jeu : journal repris à neuf
    removeEventListener('resize', resizeH); removeEventListener('keydown', onKeyDown); removeEventListener('keyup', onKeyUp); removeEventListener('blur', onBlur);
    // touches relâchées côté client SANS rien envoyer maintenant (le hub a peut-être déjà changé de jeu : un « input » partirait vers un autre jeu) ;
    // si l'une était tenue, staleInput fait renvoyer l'état « tout relâché » au prochain init() du Sumo
    for (const k in input) if (input[k]) { input[k] = false; staleInput = true; }
    // audio : le contexte est fermé (il ne reste pas actif en arrière-plan, et iOS limite le nombre de contextes) ; unlockAudio() en recrée un au prochain geste
    if (actx) { const c0 = actx; actx = null; noiseBuf = null; try { const pr = c0.close(); if (pr && pr.catch) pr.catch(() => {}); } catch {} }
    puffs.length = 0; salt.length = 0; waves.length = 0; flyers.length = 0; outTxt.length = 0; sparks.length = 0; bursts.length = 0; flashes.length = 0; STREAK.reset();
    RL.clear(); CAM.reset(); pendingEnd = null; repOut = {}; repHas = false;
  }

  return { init, onState, onMessage, onLb, onA11y, teardown };
})();
