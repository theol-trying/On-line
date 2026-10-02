// Module client PATATE CHAUDE : nappe de pique-nique vichy vue de dessus, une patate-bombe (papier alu) qui passe par contact,
// mèche cachée (chaleur seulement) ou visible, cercle qui rétrécit, bonus bouclier / turbo, sprint, FFA / équipes.
// Calqué sur le Sumo (structure, HUD, écran de fin, câblage unique des écouteurs, briques partagées) et sur le Foot
// (déplacement libre + sprint). Identité propre « Pique-nique » : herbe, vichy rouge et blanc, bocaux et salières,
// alu qui rougit, purée, tomate et crème.
import { AR0, PR, BR, FUSE_MAX } from './shared.js';
import { createMusic } from '../../music.js';
import { seatPattern, SEAT_GLYPH } from '../../patterns.js';   // motif par siège, peint sur la bordure du pion
import { initGameMsg, msgPerso, msgGlobal } from '../../gamemsg.js';
import { arenaSize } from '../../layout.js';   // taille du plateau : commune à tous les jeux (mode plein écran compris)
import { lumiere, creerLumieres } from '../../lumiere.js';      // halo de la patate, bonus, souffles éclairent la nappe
import { crepuscule, creerDuel } from '../../crepuscule.js';               // duel final : le jour tombe sur le pique-nique
import { creerJournal, blocFin } from '../../finpartie.js';     // courbe des passes + meilleure action à l'écran de fin
import { createRalenti } from '../../ralenti.js';               // ralenti de la dernière explosion rejoué à la fin de manche
import { drawPodium, podiumEntries } from '../../podium.js';       // podium canvas de fin de manche (pions dessinés par le jeu)
import { createDuelCam } from '../../camera-duel.js';              // caméra de duel : zoom doux sur les deux derniers pions
import { createStreaks, streakText, createCallouts, createHitStop, drawFlash, drawDanger, drawSeatChip, readable, hudK } from '../../exploits.js';   // aides visuelles partagées (séries, arrêt sur image, vignette, pastilles)
import { createEcranFin } from '../../ecran-fin.js';               // fin de manche EN PLEIN ÉCRAN + boutons « Relancer » / « Accueil »
import { boutonMatch, texteMatch, balleDeMatch, titreFin, pastillesTexte } from '../../match.js';   // match en N manches (bouton GM, chip HUD, balle de match, titre de fin, pastilles)

// Duel final (crepuscule.js) : quand il ne reste que 2 joueurs ou 2 équipes (sur une manche commencée à 3 ou plus), la nuit tombe en ~4 s.
const DUEL = creerDuel(), duelAnnonce = () => msgGlobal('⚔', 'Duel final !', { color: '#ff7a5a' });

// musique : valse de guinguette au pique-nique — basse pizzicato (oum-pa-pa), mélodie pentatonique majeure à l'accordéon-jouet,
// caisse claire en balais en jeu ; climax (duel final / mèche à bout) = tempo accéléré, arpèges serrés et roulement.
const MUSIC_THEME = { bpm: 118, bpmBoost: 34, vol: 0.5, root: 98, len: 32,
  stingers: { kill: { notes: [12, 7, 3, -2], wave: 'triangle', oct: 1, gain: 0.05, dur: 0.22, rate: 0.07 },
    win: { base: 392, notes: [[0, 7], [4, 12], [7, 12, 16], [12, 19, 24]], gain: 0.035, dur: 0.4, rate: 0.15 },
    count: { notes: [0], oct: 2, wave: 'triangle', dur: 0.14, gain: 0.045, duck: false }, go: { notes: [[0, 7, 12]], oct: 2, wave: 'triangle', dur: 0.5, gain: 0.05, duck: false },
    alert: { notes: [12, 9, 7, 4, 0], oct: 1, wave: 'triangle', rate: 0.07, dur: 0.16, gain: 0.04 } },
  layers: [
  { seq: [0, null, 7, 7, null, null, 0, null, 7, 7, null, null, 5, null, 12, 12, null, null, 5, null, 12, 12, null, null, 7, null, 14, 14, null, null, 0, null], wave: 'triangle', gain: 0.03, dur: 0.9 },   // basse pizzicato
  { seq: [24, null, 28, null, 31, null, 28, null, 26, null, 29, null, 33, null, 29, null, 24, null, 28, null, 31, null, 36, null, 33, null, 31, null, 28, null, 26, null], wave: 'triangle', gain: 0.018, dur: 1.4 },   // jouet d'accordéon
  { drums: 'K...H...S...H...K.K.H...S...H.H.', gain: 0.7, min: 1 },                                                                                // grosse caisse, charley et balai
  { seq: [12, null, null, null, 16, null, null, null, 19, null, null, null, 16, null, null, null], oct: 1, wave: 'sine', gain: 0.012, dur: 3, min: 1 },   // nappe douce
  { drums: 'K.S.K.S.K.S.K.SSK.S.K.S.K.SSSSKS', gain: 0.8, min: 2 },                                                                             // roulement de climax
  { seq: [0, 4, 7, 12, 7, 4, 0, 4], oct: 2, wave: 'triangle', gain: 0.012, dur: 0.5, min: 2 },
] };

// 10 sièges : au-delà de 8 il n'existe plus de teintes toutes distinguables entre elles,
// c'est le MOTIF par siège (patterns.js), peint sur la bordure du pion, qui porte l'identification.
const PAL = { normal: ['#4a9ee0', '#e06240', '#2aaf7a', '#cc9010', '#9b6cf0', '#e268b0', '#25c9c0', '#9ec93a', '#d06ef0', '#f2f0e6'],
              cb: ['#0072B2', '#E69F00', '#009E73', '#F0E442', '#CC79A7', '#56B4E9', '#D55E00', '#F5F5F5', '#7B68EE', '#9A9A9A'] };
const TEAMPAL = { normal: ['#4a9ee0', '#e06240', '#2aaf7a', '#cc9010', '#9b6cf0'], cb: ['#0072B2', '#E69F00', '#009E73', '#F0E442', '#CC79A7'] };
const TEAM_LETTER = ['A', 'B', 'C', 'D', 'E'];
const MODE_NAME = { ffa: 'Chacun pour soi', '2v2': '2 v 2', '2v2v2': '2 v 2 v 2', '3v3': '3 v 3', '4v4': '4 v 4', '2v2v2v2': '2 v 2 v 2 v 2', '3v3v3': '3 v 3 v 3', '5v5': '5 v 5', '2v2v2v2v2': '2 v 2 v 2 v 2 v 2' };
const MAX_SEATS = 10;                                   // le snapshot porte TOUJOURS les 10 sièges, comme Sumo
const TEAM_TOTALS = [4, 6, 8, 9, 10];                   // effectifs pour lesquels le serveur propose un mode par équipes
const TICK_HZ = 30;                                     // cadence serveur : elimTick est compté en ticks
const DIFF_NAMES = ['Facile', 'Normale', 'Difficile'];
const BLAST_R = 150;                                    // rayon du souffle (serveur) : l'onde du « BAOUM » s'y arrête
const HEAT = [0.08, 0.38, 0.68, 1];                     // chaleur lissée visée selon `lv` (0..3, grossière)

// Identité « Pique-nique » : palette fixe (le sélecteur de thème Néon/CRT/Clair ne s'applique pas ici, comme Sumo/Tanks/Snake).
const K = { grass: '#2f6b27', cream: '#fbf3de', tomato: '#d8483a', tomatoDk: '#8a2a1c', ink: '#2a1a12', gold: '#f0c768', puree: '#f3e3a1', pureeDk: '#d2b867' };
const DISP = "'Lilita One', 'Fredoka', Impact, sans-serif";   // police d'affichage (Google Fonts, chargée par la page)

// Bonus au sol (index = ITEMS du serveur : bouclier, turbo). Icônes d'aide : 🛡 ⚡ — dessinées ici en vectoriel.
const PU = [{ n: 'bouclier', i: '🛡', c: '#3fa7d6', l: '#9fe0ff', msg: 'Bouclier : la patate ne peut plus te toucher (3 s)' },
            { n: 'turbo', i: '⚡', c: '#f0a020', l: '#ffd27a', msg: 'Turbo : +25 % de vitesse, sprint illimité (3 s)' }];
const puAt = k => (k | 0) === k && k >= 0 && k < PU.length ? PU[k] : PU[0];   // `k` vient du réseau : indice borné
const SHRINK_MSG = { i: '⚠', t: 'La nappe rétrécit !' };
const DIR_KEYS = { ArrowUp: 'up', KeyW: 'up', KeyZ: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', KeyQ: 'left', ArrowRight: 'right', KeyD: 'right' };   // ZQSD / WASD : KeyW/KeyA = touches Z/Q en AZERTY ; KeyZ/KeyQ pour un clavier réglé en QWERTY

function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function hexRgb(h) { const n = parseInt(String(h).slice(1, 7), 16) || 0; return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function rgbStr(c, a) { return a == null ? `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})` : `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`; }
function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }   // mulberry32 : décor identique d'un rendu à l'autre
function hash2(a, b) { const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return x - Math.floor(x); }
// ellipse maison (scale + arc) : ctx.ellipse est absent/instable sur les vieux Safari
function oval(g, x, y, rx, ry) { g.save(); g.translate(x, y); g.scale(rx, ry); g.moveTo(1, 0); g.arc(0, 0, 1, 0, Math.PI * 2); g.restore(); }
// contour de patate : polygone irrégulier (8 lobes) réutilisé par tous les tracés
const LUMPS = Array.from({ length: 16 }, (_, i) => { const a = i / 16 * Math.PI * 2; return [Math.cos(a) * (1 + 0.07 * Math.sin(3 * a + 1) + 0.04 * Math.sin(5 * a)), Math.sin(a) * (0.86 + 0.06 * Math.sin(2 * a + 2))]; });

export default (function () {
  let A, send, root, cv, ctx, togglePanel = () => {}, closePanels = () => {};
  let CC = PAL.normal, TEAMCC = TEAMPAL.normal, FX = 1;
  let mySeat = -1, snap = null, prevGs = 'lobby', teamMode = false, endShown = false, inGamePrev = false, prevRound = -1, lastCount = -1, lastShrinkMsg = 0;
  let board = [], buf = [];
  let AR = AR0, R0v = AR0 / 2 - 30;                      // géométrie courante (le serveur agrandit la nappe avec le nombre de joueurs)
  const puffs = [], waves = [], flyers = [], booms = [], sparks = [], stains = [];
  let shakeMag = 0, rafId = 0, destroyed = false, resizeH = null, actx = null, noiseBuf = null, lastFrame = 0, ringPulse = 0;
  const LUM = creerLumieres(24), J = creerJournal({ pas: 500 });
  let duskV = 0, jRound = -1, jLast = -1e9;
  let fini = {}, outChain = {}, holdT0 = {}, passLog = [], lastChain = -1e9;   // journal : courbes arrêtées, séries d'explosions, début de garde de la patate, passes récentes
  // musique recréée à chaque init() : dispose() (teardown) est définitif pour l'instance ; NOMUSIC évite tout accès à null entre deux jeux
  const NOMUSIC = { start() {}, stop() {}, setIntensity() {}, sting() {}, dispose() {} };
  let music = NOMUSIC;
  const input = { up: false, down: false, left: false, right: false };
  let staleInput = false, sprintOn = false;             // une touche / le sprint était tenu au teardown : on renvoie « tout relâché » au retour
  const STREAK = createStreaks({ window: 8000 }), CALL = createCallouts(), HS = createHitStop(70);
  let goT0 = -1e9;                                      // départ de manche : pastilles de siège visibles 2 s
  const TOUCH = typeof matchMedia === 'function' ? matchMedia('(pointer: coarse)').matches : 'ontouchstart' in window;   // indications clavier masquées sur tactile (un portable à écran tactile garde ses indices)
  // ralenti / podium / caméra de duel (tout côté client, rien de plus sur le réseau)
  const RL = createRalenti({ keepMs: 3000, windowMs: 1500, slow: 0.4 }), CAM = createDuelCam({ maxZoom: 1.16, ease: 0.05, margin: 120 });
  const CPTS = [{ x: 0, y: 0 }, { x: 0, y: 0 }];         // points de la caméra (réutilisés : aucune allocation par image)
  let pendingEnd = null, overT0 = 0, eatUntil = 0;       // fin de manche différée pendant le ralenti / début du podium / clic avalé (celui qui passe le ralenti)
  let repOut = {}, repHas = false, podSrc = null, podList = [];   // explosions vues pendant le ralenti / entrées du podium (mises en cache par snapshot)
  const heatCur = new Array(MAX_SEATS).fill(0);          // chaleur lissée par porteur (suit la patate quand elle passe)
  let tickNext = 0, tickAlt = 0, holdMsgAt = -1e9, myHot = false;   // tic-tac : prochain battement / alternance ; dernier rappel « tu as la patate » ; je porte la patate
  const outBy = new Array(MAX_SEATS).fill(-2), boomed = new Array(MAX_SEATS).fill(false);   // pour le HUD : qui m'a passé la patate qui a explosé (-1 = personne, -2 = inconnu)
  let hud, cards, startBtn, pauseBtn, modeBtn, botsBtn, diffBtn, fuseBtn, bonusBtn, pauseFloat, lbBtn, lbPanel, lbBody, endEl, sprintBtn;
  let matchBtn = null, matchChip = null, homeChoice = false;   // bouton « 🏆 Premier à N » (barre), chip du HUD, « Accueil » choisi pendant l'écran de fin
  // fin de manche en plein écran : body.playing reste posé à 'over' jusqu'à « ⌂ Accueil » (aChange : le plateau regrossit / rétrécit)
  const EF = createEcranFin({ aChange: () => { if (destroyed || !cv) return; applyPlaying(snap && snap.gs); resizeCanvas(); } });
  function applyPlaying(gs) {
    const inGame = EF.enJeu(gs);
    if (inGame !== inGamePrev) { inGamePrev = inGame; document.body.classList.toggle('playing', inGame); resizeCanvas(); }
  }

  const $ = id => root.querySelector('#' + id);
  const colSeat = s => { if (s < 0 || !snap) return '#fff'; const p = snap.players[s]; return teamMode && p ? TEAMCC[p.team % TEAMCC.length] : CC[s % CC.length]; };
  const winTeam = m => (m && typeof m.winner === 'number' && m.winner >= 0) ? m.winner : -1;   // équipe gagnante, -1 = égalité / pas de vainqueur (null >= 0 est vrai en JS !)
  const nameOf = s => { const p = snap && snap.players[s]; return p ? (p.name || ('P' + (s + 1))) : '?'; };
  const seatOk = s => (s | 0) === s && s >= 0 && s < MAX_SEATS;
  function applyColors() { CC = PAL[A.palette] || PAL.normal; TEAMCC = TEAMPAL[A.palette] || TEAMPAL.normal; FX = A.reduceFx ? 0 : 1; decorKey = ''; bodyCache = {}; potCache = {}; podSrc = null; if (A.reduceFx) LUM.vider(); }

  function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const size = arenaSize({ max: 760 });
    cv.style.width = size + 'px'; cv.style.height = size + 'px';
    cv.width = Math.round(size * dpr); cv.height = Math.round(size * dpr);
    layoutEnd();
  }

  // ───────────────────────── HUD, classement, écran de fin ─────────────────────────
  const heatBar = lv => '▮'.repeat(Math.max(0, Math.min(3, lv | 0)) + 1) + '▯'.repeat(3 - Math.max(0, Math.min(3, lv | 0)));
  const relanceLabel = (m, def) => m && m.match ? (m.match.f ? 'Nouveau match' : 'Manche suivante') : def;   // libellé de « Relancer » selon le match
  function matchTeamName(t) {                            // nom de l'équipe `t` pour « BALLE DE MATCH pour … » (texte brut)
    if (teamMode) return 'Équipe ' + (TEAM_LETTER[t] || (t + 1));
    const p = snap && snap.players.find(q => q.playing && q.team === t);
    return p ? (p.name || ('P' + (p.seat + 1))) : '';
  }
  function refreshHUD() {
    if (!snap) return;
    if (matchChip) { const tx = texteMatch(snap.match); if (matchChip._t !== tx) { matchChip._t = tx; matchChip.textContent = tx ? '🏆 ' + tx : ''; } matchChip.style.display = tx ? '' : 'none'; }   // chip « Premier à 3 · manche 2 »
    const lvBy = {}; (snap.pt || []).forEach(o => { if (o && seatOk(o.o)) lvBy[o.o] = o.lv | 0; });   // chaleur par porteur (objet à clés numériques construites ici)
    snap.players.forEach((p, i) => {
      const shown = p.connected || p.playing;
      cards[i].classList.toggle('hidden', !shown);
      if (!shown) return;
      const col = colSeat(i);
      cards[i].style.color = col;
      cards[i].classList.toggle('dead', p.playing && !p.alive);
      cards[i].classList.toggle('me', i === mySeat);
      cards[i].classList.toggle('hot', !!(p.playing && p.alive && p.hp));
      const tags = [];
      if (teamMode) tags.push(`<span class="badge" style="background:${col}28;color:${col}">ÉQ.${TEAM_LETTER[p.team] || '?'}</span>`);
      if (p.bot) tags.push(`<span class="badge" style="background:${col}28;color:${col}">BOT</span>`);
      else if (i === mySeat) tags.push(`<span class="badge" style="background:${col}28;color:${col}">VOUS</span>`);
      const glyph = SEAT_GLYPH[i % SEAT_GLYPH.length];   // constante : rappel du motif peint sur la bordure du pion
      const pnH = `${(window.__AV && window.__AV(p.name)) || ''}<span class="sg" style="opacity:.8">${glyph}</span> ${esc(p.name || ('P' + (i + 1)))} <span class="sc" title="explosions provoquées">${p.booms | 0} 💥</span> ${snap.match ? `<span class="sc" title="manches gagnées" style="letter-spacing:1px">${pastillesTexte(p.score, snap.match.n)}</span> ` : ''}${tags.join('')}`;
      if (cards[i]._pn !== pnH) { cards[i]._pn = pnH; cards[i].querySelector('.pn').innerHTML = pnH; }   // innerHTML seulement si la chaîne change (30 Hz sinon)
      const lv = cards[i].querySelector('.lv'); lv.style.color = col;
      const setLv = t => { if (cards[i]._lv !== t) { cards[i]._lv = t; lv.textContent = t; } };
      if (!p.playing) { setLv('prêt'); return; }
      if (!p.alive) { setLv(boomed[i] ? (outBy[i] >= 0 && outBy[i] !== i ? '💥 explosé — patate de ' + nameOf(outBy[i]) : '💥 a explosé') : '✖ éliminé'); return; }
      const st = [];
      if (p.hp) st.push('🥔 PATATE ' + heatBar(lvBy[i])); else st.push('🤝 ' + (p.passes | 0));
      if (p.sh) st.push('🛡'); if (p.tb) st.push('⚡'); if (p.ess) st.push('💦');
      setLv('● ' + st.join(' · '));
    });
  }
  function renderLB() {
    if (!lbBody) return;
    if (!board.length) { lbBody.innerHTML = '<div class="lbnote">Aucune partie enregistrée.</div>'; return; }
    const B = board.map(e => ({ ...e, avg: e.games ? (e.survSum || 0) / e.games : 0 }));
    lbBody.innerHTML = B.sort((a, b) => (b.wins || 0) - (a.wins || 0) || (b.kills || 0) - (a.kills || 0) || b.avg - a.avg).map(e =>
      `<div class="lbrow"><span class="lbn">${esc(e.name)}</span><span title="parties">🎮${e.games || 0}</span><span title="victoires">🏆${e.wins || 0}</span><span title="explosions provoquées (patate refilée qui explose)">💥${e.kills || 0}</span>` +
      `<span title="passes réussies">🤝${e.passes || 0}</span>` +
      (e.bestSurvivalSec != null ? `<span title="meilleure survie">⏱${Math.round(e.bestSurvivalSec || 0)}s</span>` : '') + '</div>').join('');
  }
  // Carte de fin + podium canvas : le podium occupe le HAUT du cadre, la carte DOM se cale dessous (fond transparent en haut,
  // défilement interne pour que le contenu ne recouvre jamais le podium). Sans entrée à afficher : carte plein cadre comme avant.
  let endPod = false;
  const podFrac = () => (cv && cv.clientWidth < 460 ? 0.46 : 0.42);   // téléphone : un peu plus de hauteur pour des noms lisibles
  function layoutEnd() {
    if (!endEl) return;
    if (!endPod) { if (endEl.style.cssText) endEl.style.cssText = ''; return; }
    const ph = Math.round((cv.clientHeight || 340) * podFrac());
    endEl.style.cssText = 'justify-content:flex-start;overflow-y:auto;padding:' + (ph + 4) + 'px 12px 10px;background:linear-gradient(to bottom,rgba(8,14,6,0) ' + ph + 'px,rgba(8,14,6,.88) ' + (ph + 6) + 'px)';
  }
  function podEntries(m) {                                // entrées du podium, recalculées seulement quand le snapshot change
    if (podSrc !== m) {
      podSrc = m; podList = m ? podiumEntries(m.players, colSeat) : [];
      if (m && m.match && m.match.f && podList.length) {  // match gagné : le podium est celui du MATCH (manches gagnées), pas de la dernière manche
        podList.sort((a, b) => (b.score | 0) - (a.score | 0) || a.place - b.place || a.seat - b.seat);
        podList.forEach((e, i) => { e.place = i > 0 && (e.score | 0) === (podList[i - 1].score | 0) ? podList[i - 1].place : i + 1; });
      }
    }
    return podList;
  }
  function showEndscreen(m) {
    if (m.gs !== 'over' || !m.stats) { endPod = false; layoutEnd(); endEl.classList.add('hidden'); return; }
    podSrc = null; endPod = podEntries(m).length > 0; layoutEnd();
    endEl.classList.remove('hidden');
    const parts = m.players.filter(p => p.playing && p.place > 0).slice().sort((a, b) => a.place - b.place);
    const champ = winTeam(m) >= 0 ? parts.find(p => p.team === m.winner) : null;
    const who = champ ? (teamMode ? 'Équipe ' + TEAM_LETTER[m.winner] : esc(champ.name || ('P' + (champ.seat + 1)))) : null;
    const whoRaw = champ ? (teamMode ? 'Équipe ' + TEAM_LETTER[m.winner] : (champ.name || ('P' + (champ.seat + 1)))) : '';
    const sc = [], vu = {}; parts.forEach(p => { const k = p.team == null ? 's' + p.seat : 't' + p.team; if (!vu[k]) { vu[k] = 1; sc.push(p.score | 0); } });   // un score par équipe
    const T = titreFin(m.match, whoRaw, sc);              // match en N manches : « VICTOIRE DU MATCH » / « Manche gagnée » ; '' hors match
    const title = T.titre ? esc(T.titre) + (who ? ' — ' + who : '') : (champ ? who + ' a survécu à la patate !' : 'Plus de patate — égalité');
    const subLine = T.titre ? `<div class="emeta">${esc(T.sous)}</div>` : '';
    const medals = ['🥇', '🥈', '🥉'];
    // « Le plus vicieux » : le plus d'explosions provoquées, départage au classement (≥ 1 explosion, sinon personne) ; « Passeur fou » : le plus de passes
    let mvp = null, pas = null;
    parts.forEach(p => {
      if ((p.booms | 0) > 0 && (!mvp || p.booms > mvp.booms || (p.booms === mvp.booms && p.place < mvp.place))) mvp = p;
      if ((p.passes | 0) > 0 && (!pas || p.passes > pas.passes || (p.passes === pas.passes && p.place < pas.place))) pas = p;
    });
    const rows = parts.map(p => {
      const col = colSeat(p.seat), medal = medals[p.place - 1] || ('#' + p.place), sec = Math.round((p.elimTick || 0) / TICK_HZ);
      const res = p.alive ? (champ && p.team === champ.team ? 'vainqueur' : 'dernier debout') : `explosé à ${sec}s`;
      return `<div class="erow ${p.alive ? 'win' : ''}"><span class="eplace">${medal}</span>
        <span class="ename" style="color:${col}">${esc(p.name || ('P' + (p.seat + 1)))}${teamMode ? ` <small>Éq.${TEAM_LETTER[p.team]}</small>` : ''}${mvp && mvp.seat === p.seat ? ' <small>⭐ vicieux</small>' : ''}</span>
        <span class="estat" title="explosions provoquées">💥 ${p.booms | 0}</span><span class="estat" title="passes">🤝 ${p.passes | 0}</span><span class="eres">${res}</span></div>`;
    }).join('');
    const mvpLine = mvp ? `<div class="emeta">⭐ Le plus vicieux : <b style="color:${colSeat(mvp.seat)}">${esc(mvp.name || ('P' + (mvp.seat + 1)))}</b> — ${mvp.booms} explosion${mvp.booms > 1 ? 's' : ''} provoquée${mvp.booms > 1 ? 's' : ''}</div>` : '';
    const pasLine = pas ? `<div class="emeta">🤝 Passeur fou : <b style="color:${colSeat(pas.seat)}">${esc(pas.name || ('P' + (pas.seat + 1)))}</b> — ${pas.passes} passe${pas.passes > 1 ? 's' : ''}</div>` : '';
    const wrapO = endPod ? '<div style="width:100%;flex:1 1 auto;min-height:0;overflow:auto;-webkit-overflow-scrolling:touch;display:flex;flex-direction:column;align-items:center;gap:8px">' : '', wrapC = endPod ? '</div>' : '';   // podium au-dessus : la carte défile dans sa zone
    endEl.innerHTML = wrapO + `<div class="etitle" style="color:${champ ? colSeat(champ.seat) : K.cream}">${title}</div>
      ${subLine}<div class="emeta">⏱ ${m.stats.durationSec}s · ${m.stats.nParts} joueurs · 🤝 ${m.stats.passes | 0} passes · 💥 ${m.stats.booms | 0} explosions</div>${mvpLine}${pasLine}<div class="elist">${rows}</div>${jRound === m.round ? blocFin(J, { titre: 'Passes au fil de la manche', couleur: s => colSeat(s), nom: s => nameOf(s) }) : ''}<div class="ehint">${TOUCH ? 'Touche pour rejouer' : 'Espace / clic pour rejouer'}</div>` + wrapC;
    EF.boutons(endEl, {                                   // « ↻ Relancer » (= Rejouer) et « ⌂ Accueil » ; le clic ailleurs sur la carte relance toujours
      relancer: () => { unlockAudio(); send({ t: 'start' }); },
      libelle: relanceLabel(m, 'Relancer'),
      accueil: () => { homeChoice = true; endEl.classList.add('hidden'); },
    });
    if (m.match && m.match.f && FX) for (let i = 0; i < 6; i++) confettiSparks(AR * (0.2 + 0.6 * ((i * 37) % 10) / 10), AR * (0.25 + 0.4 * ((i * 53) % 10) / 10), 26, 5);   // victoire du match : pluie de miettes
  }

  // ───────────────────────── état réseau ─────────────────────────
  function onMessage(m) { if (m && m.t === 'welcome') mySeat = m.seat; }
  function onLb(d) { board = (d && d.board) || []; renderLB(); }
  function resetRound() {
    buf = []; puffs.length = 0; waves.length = 0; flyers.length = 0; booms.length = 0; sparks.length = 0; stains.length = 0;
    STREAK.reset(); LUM.vider(); RL.clear(); CAM.reset(); pendingEnd = null; repOut = {}; repHas = false; heatCur.fill(0);
    outBy.fill(-2); boomed.fill(false); holdT0 = {}; passLog = []; outChain = {}; tickNext = 0; myHot = false;
  }
  function onState(m) {
    if (m.ar && m.ar !== AR) AR = m.ar;                  // nappe redimensionnée (nombre de joueurs) : tout le rendu lit AR
    if (m.R0 && m.R0 !== R0v) R0v = m.R0;
    snap = m; teamMode = m.gs === 'lobby' ? !!(m.mode && m.mode !== 'ffa') : (m.nteams > 0 && m.nteams < m.players.filter(p => p.playing).length);   // en manche : d'après la manche jouée (le game master peut changer le mode pendant l'écran de fin)
    EF.suivre(m.gs);                                      // met le choix « Accueil » à zéro hors 'over' et pose body.fin ; la fin reste en plein écran
    if (m.gs !== 'over') homeChoice = false;
    applyPlaying(m.gs);
    document.body.classList.toggle('paused', m.gs === 'paused');
    if (m.gs === 'play' || m.gs === 'countdown') closePanels();
    if (m.round !== prevRound) { prevRound = m.round; resetRound(); }
    else if (m.gs === 'lobby' && prevGs !== 'lobby') resetRound();   // abandon en cours de manche : taches, fumées et ralenti repartent à neuf
    buf.push({ t: performance.now(), s: m }); if (buf.length > 10) buf.shift();
    if (m.gs === 'play' || m.gs === 'paused' || m.gs === 'over') RL.push(m, performance.now()); else { RL.clear(); pendingEnd = null; }   // tampon du ralenti : chaque snapshot de la manche
    if (m.gs === 'play' && (prevGs === 'countdown' || !J.actif() || jRound !== m.round)) {   // journal : départ de manche (ou arrivée en cours de manche)
      J.debut(performance.now()); jRound = m.round; jLast = -1e9; fini = {}; outChain = {}; holdT0 = {}; passLog = [];
    }
    (m.fx || []).forEach(playFx);
    suivreJournal(m, performance.now(), m.gs === 'over' && prevGs !== 'over');
    const me = mySeat >= 0 ? m.players[mySeat] : null;
    const hot = !!(me && me.playing && me.alive && me.hp && m.gs === 'play');
    if (hot && !myHot && performance.now() - holdMsgAt > 1500) { holdMsgAt = performance.now(); msgPerso('🥔', teamMode ? 'Tu as la patate ! Touche un adversaire' : "Tu as la patate ! Touche quelqu'un", { bad: true }); }
    myHot = hot;
    if (prevGs !== 'over' && m.gs === 'over') {
      finJournal(m);
      if (!A.reduceFx && RL.start(performance.now())) pendingEnd = m;   // ralenti de la dernière explosion : carte de fin, jingle et podium attendent sa fin
      else { sound('win'); music.sting('win'); }
    }
    if (m.gs === 'countdown' && prevGs !== 'countdown') {   // « BALLE DE MATCH pour … ! » : une fois par manche, au début du décompte
      const bm = balleDeMatch(m.match, matchTeamName);
      if (bm) { CALL.push('BALLE DE MATCH', '#ffd24a', performance.now()); msgGlobal('🏆', bm, { color: '#ffd24a' }); }
    }
    if (m.gs === 'countdown' && m.count > 0 && m.count !== lastCount) { music.sting('count'); sound('count'); }   // décompte 3·2·1
    if (prevGs === 'countdown' && m.gs === 'play') { music.sting('go'); sound('go'); goT0 = performance.now(); }   // goT0 : pastilles de siège visibles 2 s après le coup d'envoi
    lastCount = m.count;
    prevGs = m.gs;
    { let inten = 0;                                      // musique : 1 en jeu, 2 au duel final (parmi 3+) ou quand la mèche touche à sa fin
      if (m.gs === 'play' || m.gs === 'countdown') { inten = 1; const tot = m.players.filter(p => p.playing).length, alive = m.players.filter(p => p.playing && p.alive).length; if ((tot >= 3 && alive <= 2) || (m.pt || []).some(o => o && (o.lv | 0) >= 3)) inten = 2; }
      music.setIntensity(inten); }
    refreshHUD();
    if (m.gs === 'over') { if (!endShown && !pendingEnd) { showEndscreen(m); endShown = true; overT0 = performance.now(); } }
    else { endShown = false; pendingEnd = null; if (endPod) { endPod = false; layoutEnd(); } endEl.classList.add('hidden'); }
    if (matchBtn) matchBtn.maj(m.match, m.gs);            // bouton du game master : grisé hors lobby / fin de manche
    const idle = m.gs === 'lobby' || m.gs === 'over';
    const total = (m.connected || 0) + (m.botCount || 0);
    startBtn.disabled = !(mySeat >= 0 && idle && m.connected >= 1 && total >= 2);
    startBtn.textContent = m.gs === 'over' ? '↻ ' + relanceLabel(m, 'Rejouer') : '▶ Démarrer';
    pauseBtn.disabled = !(m.gs === 'play' || m.gs === 'paused');
    pauseBtn.textContent = m.gs === 'paused' ? '▶ Reprendre' : '⏸ Pause';
    pauseFloat.textContent = m.gs === 'paused' ? '▶' : '⏸';
    if (botsBtn) { botsBtn.disabled = !idle; botsBtn.textContent = '🤖 Bots : ' + (m.botCount || 0); botsBtn.classList.toggle('on', (m.botCount || 0) > 0); }
    if (diffBtn) { diffBtn.disabled = !idle; diffBtn.textContent = '🎯 IA : ' + (DIFF_NAMES[m.botDiff] || 'Normale'); }
    modeBtn.disabled = !(idle && TEAM_TOTALS.indexOf(total) >= 0);
    modeBtn.textContent = '⚔ ' + (MODE_NAME[m.mode] || m.mode || 'FFA'); modeBtn.classList.toggle('on', teamMode);
    const vis = !!(m.opt && m.opt.fuse === 'visible'), bon = !m.opt || m.opt.bonus !== 0;
    if (fuseBtn) { fuseBtn.disabled = !idle; fuseBtn.textContent = '🧨 Mèche : ' + (vis ? 'visible' : 'cachée'); fuseBtn.classList.toggle('on', vis); }
    if (bonusBtn) { bonusBtn.disabled = !idle; bonusBtn.textContent = '🎁 Bonus : ' + (bon ? 'oui' : 'non'); bonusBtn.classList.toggle('on', bon); }
    // bouton tactile de sprint : estompé quand l'endurance est vide (le joueur sait pourquoi rien ne part)
    const live = !!(me && me.playing && me.alive);
    if (sprintBtn) sprintBtn.style.opacity = !live || (me.sta > 0.3 && !me.ess) || me.tb ? '' : '0.5';
  }
  function announceShrink() {
    const now = performance.now(); ringPulse = now;
    if (now - lastShrinkMsg < 2500) return; lastShrinkMsg = now;
    music.sting('alert'); msgGlobal(SHRINK_MSG.i, SHRINK_MSG.t, { bad: true });
  }

  // ───────────────────────── journal de manche (courbe + meilleure action) ─────────────────────────
  // Courbe : passes cumulées de chaque joueur (la ligne s'arrête à son explosion).
  // Moments : passe « in extremis », garde longue, rafale de passes, explosions en série, dernier survivant.
  function suivreJournal(m, now, force) {
    if (!J.actif() || !(m.gs === 'play' || force)) return;
    const echant = force || now - jLast >= 500, vals = {};
    m.players.forEach(p => {
      if (!p.playing) return;
      const s = p.seat;
      if (!p.alive) { if (echant && !fini[s]) { vals[s] = p.passes | 0; fini[s] = true; } return; }
      if (echant) vals[s] = p.passes | 0;
    });
    if (echant) { jLast = now; J.echantillon(now, vals, true); }
  }
  function momentPasse(f, now) {
    if (!J.actif() || !snap || !seatOk(f.from) || !seatOk(f.to)) return;
    const dur = holdT0[f.from] != null ? (now - holdT0[f.from]) / 1000 : 0;
    holdT0[f.to] = now; delete holdT0[f.from];
    if (f.ex) J.moment(now, f.from, 'a refilé la patate à ' + nameOf(f.to) + ' IN EXTREMIS', 9);
    else if (dur >= 9) J.moment(now, f.from, 'a gardé la patate ' + Math.round(dur) + ' s avant de la refiler à ' + nameOf(f.to), 5);
    passLog.push(now); while (passLog.length && now - passLog[0] > 6000) passLog.shift();
    if (passLog.length >= 6 && now - lastChain > 6000) { lastChain = now; J.moment(now, f.from, 'la patate a changé de main ' + passLog.length + ' fois en 6 s', 4); }
  }
  function momentBoom(f, now) {
    if (!J.actif() || !snap) return;
    delete holdT0[f.seat];
    const by = f.by, victim = nameOf(f.seat);
    if (by == null || by < 0 || by === f.seat || !seatOk(by)) return;   // patate tombée sans passe : pas une action
    const prev = outChain[by], k = prev && now - prev.t < 8000 ? prev.k + 1 : 1;
    if (k >= 3) J.moment(now, by, 'triple explosion en ' + ((now - prev.t0) / 1000).toFixed(1) + ' s', 10);
    else if (k === 2) J.moment(now, by, 'double explosion : ' + prev.n + ' puis ' + victim, 8);
    else J.moment(now, by, 'a refilé la patate à ' + victim + ' : BAOUM', 3);
    outChain[by] = { t: now, t0: k > 1 ? prev.t0 : now, k: k, n: victim };
  }
  function finJournal(m) {
    if (!J.actif()) return;
    const w = winTeam(m) >= 0 ? m.players.find(p => p.playing && p.alive && p.team === m.winner) : null;
    if (w) J.moment(performance.now(), w.seat, teamMode ? "a sauvé l'équipe " + TEAM_LETTER[m.winner] + ' de la patate' : 'reste seul sans la patate', 1);
    J.fin();
  }

  // ───────────────────────── sons (WebAudio, zéro fichier) ─────────────────────────
  function unlockAudio() { if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch {} } if (actx && actx.state === 'suspended') actx.resume(); }
  let sndPan = 0;                                        // pan stéréo du prochain son (posé par psound)
  const vol = () => (A && typeof A.sfx === 'number') ? A.sfx : 1;
  function out(node) { if (sndPan && actx.createStereoPanner) { const pn = actx.createStereoPanner(); pn.pan.value = Math.max(-1, Math.min(1, sndPan)); pn.connect(actx.destination); node.connect(pn); } else node.connect(actx.destination); }
  function tone(f, d, ty = 'square', g = 0.05, dl = 0) { const v = vol(); if (!actx || v <= 0) return; const t0 = actx.currentTime + dl, o = actx.createOscillator(), gg = actx.createGain(); o.type = ty; o.frequency.setValueAtTime(f, t0); gg.gain.setValueAtTime(g * v, t0); gg.gain.exponentialRampToValueAtTime(0.0001, t0 + d); o.connect(gg); out(gg); o.start(t0); o.stop(t0 + d + 0.02); }
  function glide(f0, f1, d, ty, g, dl = 0) {             // note qui glisse de f0 à f1 (plop, sifflet, chute)
    const v = vol(); if (!actx || v <= 0) return;
    const t0 = actx.currentTime + dl, o = actx.createOscillator(), gg = actx.createGain();
    o.type = ty; o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + d);
    gg.gain.setValueAtTime(g * v, t0); gg.gain.exponentialRampToValueAtTime(0.0001, t0 + d + 0.03);
    o.connect(gg); out(gg); o.start(t0); o.stop(t0 + d + 0.06);
  }
  function noise(d, type, freq, g, dl = 0, q) {
    const v = vol(); if (!actx || v <= 0) return;
    if (!noiseBuf || noiseBuf.sampleRate !== actx.sampleRate) { const sr = actx.sampleRate, b = actx.createBuffer(1, Math.floor(sr * 1.5), sr), dd = b.getChannelData(0); for (let i = 0; i < dd.length; i++) dd[i] = Math.random() * 2 - 1; noiseBuf = b; }
    const t0 = actx.currentTime + dl, s = actx.createBufferSource(), f = actx.createBiquadFilter(), gg = actx.createGain();
    s.buffer = noiseBuf; f.type = type; f.frequency.value = freq; if (q) f.Q.value = q;
    gg.gain.setValueAtTime(0.0001, t0); gg.gain.exponentialRampToValueAtTime(g * v, t0 + Math.min(0.012, d * 0.2)); gg.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
    s.connect(f); f.connect(gg); out(gg); s.start(t0); s.stop(t0 + d + 0.02);
  }
  function psound(k, x, arg) { sndPan = Math.max(-1, Math.min(1, (x / AR - 0.5) * 1.7)); sound(k, arg); sndPan = 0; }   // son positionné gauche/droite
  function sound(k, arg) {
    if (!actx) return;
    if (k === 'pass') { glide(520, 880, 0.09, 'triangle', 0.07); noise(0.03, 'highpass', 2500, 0.08); if (arg) { tone(1320, 0.16, 'square', 0.04, 0.06); tone(1760, 0.2, 'square', 0.035, 0.12); } }   // « pop » de la passe ; in extremis : petit cri aigu
    else if (k === 'boom') { glide(150, 38, 0.45, 'sine', 0.3); noise(0.75, 'lowpass', 800, 0.24); noise(0.22, 'bandpass', 1900, 0.12, 0.02, 0.8); noise(0.2, 'bandpass', 520, 0.12, 0.13, 1.2); }   // BAOUM : grosse caisse, souffle, puis « splat » de purée
    else if (k === 'spawn') { glide(260, 720, 0.12, 'sine', 0.09); tone(980, 0.09, 'triangle', 0.04, 0.1); }   // plop : une nouvelle patate tombe
    else if (k === 'tick') { const g = 0.03 + 0.06 * (arg || 0); tone(1300, 0.04, 'square', g); }
    else if (k === 'tack') { const g = 0.03 + 0.06 * (arg || 0); tone(880, 0.05, 'square', g); }
    else if (k === 'pick0') { tone(660, 0.14, 'triangle', 0.05); tone(990, 0.2, 'triangle', 0.045, 0.07); tone(1320, 0.24, 'triangle', 0.035, 0.14); }   // bouclier : carillon
    else if (k === 'pick1') { glide(300, 1200, 0.22, 'sawtooth', 0.04); tone(1500, 0.14, 'triangle', 0.04, 0.2); }                                        // turbo : sifflet qui monte
    else if (k === 'count') tone(440, 0.12, 'triangle', 0.06);
    else if (k === 'go') { tone(660, 0.12, 'triangle', 0.06); tone(880, 0.28, 'triangle', 0.06, 0.1); }
    else if (k === 'win') { tone(392, 0.3, 'triangle', 0.06); tone(494, 0.3, 'triangle', 0.06, 0.14); tone(587, 0.3, 'triangle', 0.06, 0.28); tone(784, 0.5, 'triangle', 0.06, 0.42); }
  }
  // tic-tac de la patate : deux tons alternés dont la cadence suit la chaleur du porteur le plus chaud (et plus fort si c'est moi) ;
  // un seul fil sonore même avec 2 patates (celle qui chauffe le plus)
  function ticTac(now, hm, x) {
    if (now < tickNext) return;
    const itv = Math.max(160, 900 - 740 * hm);
    tickNext = tickNext && now - tickNext < 400 ? tickNext + itv : now + itv;   // cadence tenue sans dérive ; après une pause : on repart de maintenant
    tickAlt ^= 1;
    sndPan = Math.max(-1, Math.min(1, (x / AR - 0.5) * 1.7)); sound(tickAlt ? 'tick' : 'tack', Math.min(1, hm * (myHot ? 1.3 : 1))); sndPan = 0;
  }

  // ───────────────────────── effets ponctuels ─────────────────────────
  const fin = v => typeof v === 'number' && isFinite(v);
  const tossOf = new Array(MAX_SEATS).fill(null);       // patate en vol vers son nouveau porteur (passe) ou tombant du ciel (nouvelle patate)
  const joltAt = new Array(MAX_SEATS).fill(-1e9);       // dernier choc subi par un pion (écrasement bref à la réception)
  function smoke(x, y, n, big) {                         // fumée grise (rendu opaque), monte doucement
    if (A.reduceFx) return; const now = performance.now();
    for (let k = 0; k < n; k++) { const a = Math.random() * Math.PI * 2, sp = Math.random() * (big ? 1.8 : 0.5); puffs.push({ x: x + Math.cos(a) * 6, y: y + Math.sin(a) * 6, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (big ? 0.35 : 0.3), born: now, life: big ? 800 + Math.random() * 800 : 500 + Math.random() * 300, r0: big ? 6 + Math.random() * 8 : 2.5 + Math.random() * 2, col: big ? '92,86,80' : '120,114,108' }); }
    if (puffs.length > 240) puffs.splice(0, puffs.length - 240);
  }
  function confettiSparks(x, y, n, spd) {                // étincelles / miettes de purée qui giclent
    if (A.reduceFx) return; const now = performance.now();
    for (let k = 0; k < n; k++) { const a = Math.random() * Math.PI * 2, sp = 1.5 + Math.random() * spd; sparks.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, born: now, life: 260 + Math.random() * 300, c: k % 3 === 0 ? '#ffd24a' : k % 3 === 1 ? '#ff7a2a' : K.puree }); }
    if (sparks.length > 260) sparks.splice(0, sparks.length - 260);
  }
  function playFx(f) {
    if (!f) return;
    const now = performance.now(), ps = snap ? snap.players : [];
    if (f.type === 'pass') {
      if (!seatOk(f.from) || !seatOk(f.to) || !fin(f.x) || !fin(f.y)) return;
      heatCur[f.to] = heatCur[f.from]; heatCur[f.from] = 0;   // la patate garde sa chaleur en changeant de main
      const g = ps[f.from];
      if (g && fin(g.x) && fin(g.y)) tossOf[f.to] = { x: g.x, y: g.y, z: 0, arc: 16, born: now, dur: 170 };
      joltAt[f.to] = now; joltAt[f.from] = now;
      momentPasse(f, now);
      psound('pass', f.x, f.ex ? 1 : 0);
      if (f.ex) { CALL.push('IN EXTREMIS !', '#ffd24a', now); msgGlobal('😅', nameOf(f.from) + ' a refilé la patate IN EXTREMIS !', { color: '#ffd24a' }); }
      if (A.reduceFx) return;
      waves.push({ x: f.x, y: f.y, r0: 5, r1: 26, born: now, life: 300, col: '251,243,222', lw: 3 });
      confettiSparks(f.x, f.y, f.ex ? 14 : 7, 3);
      LUM.ajouter(f.x, f.y, 52, '#fff1c0', 260, 0.4);
      return;
    }
    if (f.type === 'boom') {
      if (!seatOk(f.seat) || !fin(f.x) || !fin(f.y)) return;
      const p = ps[f.seat], by = seatOk(f.by) ? f.by : -1;
      boomed[f.seat] = true; outBy[f.seat] = by; heatCur[f.seat] = 0; tossOf[f.seat] = null;
      momentBoom(f, now);
      psound('boom', f.x); music.sting('kill');
      stains.push({ x: f.x, y: f.y, r: 30 + hash2(f.x, f.y) * 14, seed: Math.floor(hash2(f.y, f.x) * 1000), born: now }); if (stains.length > 14) stains.shift();   // tache de purée : reste au sol toute la manche
      flyers.push({ seat: f.seat, x: f.x, y: f.y, a: p && fin(p.a) ? p.a : 0, dir: hash2(f.seat, f.x) * Math.PI * 2, born: now });
      booms.push({ x: f.x, y: f.y, born: now, seat: f.seat });
      if (by >= 0 && by !== f.seat) {                      // séries : plusieurs explosions provoquées par le même joueur en 8 s
        const tx = streakText(STREAK.kill(by, now));
        if (tx) { CALL.push(tx, colSeat(by), now); msgGlobal('💥', nameOf(by) + ' — ' + tx, { color: colSeat(by) }); }
      }
      if (f.seat === mySeat) msgPerso('💥', 'BAOUM ! La patate t\'a explosé dessus', { bad: true });
      else if (by === mySeat) msgPerso('😈', 'Ta patate a explosé chez ' + nameOf(f.seat) + ' !', { color: K.gold });
      if (A.reduceFx) return;
      shakeMag = Math.max(shakeMag, f.seat === mySeat ? 14 : 8);
      HS.trigger(now);                                     // arrêt sur image 70 ms + éclat blanc (booms[].born)
      smoke(f.x, f.y, 18, true); confettiSparks(f.x, f.y, 34, 6);
      waves.push({ x: f.x, y: f.y, r0: 12, r1: BLAST_R, born: now, life: 520, col: '251,243,222', lw: 9 });
      waves.push({ x: f.x, y: f.y, r0: 8, r1: BLAST_R * 0.8, born: now + 60, life: 480, col: '255,140,60', lw: 5 });
      LUM.ajouter(f.x, f.y, 190, '#ff7a3a', 720, 0.75); LUM.ajouter(f.x, f.y, 64, '#fff1d6', 300, 0.7);   // éclair de l'explosion
      return;
    }
    if (f.type === 'spawn') {
      if (!seatOk(f.seat)) return;
      heatCur[f.seat] = 0; holdT0[f.seat] = now;
      const p = ps[f.seat];
      if (p && fin(p.x) && fin(p.y)) { tossOf[f.seat] = { x: p.x, y: p.y, z: 80, arc: 0, born: now, dur: 430 }; psound('spawn', p.x); }   // nouvelle patate : elle tombe du ciel dans les mains du tiré au sort
      return;
    }
    if (f.type === 'pick') {
      if (!seatOk(f.seat)) return;
      const d = puAt(f.k), k = PU.indexOf(d), p = ps[f.seat];
      if (p && fin(p.x)) psound('pick' + k, p.x);
      if (f.seat === mySeat) msgPerso(d.i, d.msg, { color: d.c });
      if (p && !A.reduceFx && fin(p.x) && fin(p.y)) { waves.push({ x: p.x, y: p.y, r0: 10, r1: 40, born: now, life: 420, col: hexRgb(d.c).join(','), lw: 3.5 }); LUM.ajouter(p.x, p.y, 76, d.l, 440, 0.5); }
      return;
    }
    if (f.type === 'shrink') announceShrink();
  }

  // ───────────────────────── interpolation (tampon comme Sumo) ─────────────────────────
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
      // saut > 60 u = replacement (nouvelle manche) : on ne glisse pas à travers la nappe
      if (pa && pa.playing && pa.alive && Math.hypot(pb.x - pa.x, pb.y - pa.y) < 60) { x = pa.x + (pb.x - pa.x) * al; y = pa.y + (pb.y - pa.y) * al; const da = Math.atan2(Math.sin(ang - (pa.a || 0)), Math.cos(ang - (pa.a || 0))); ang = (pa.a || 0) + da * al; }
      outp[pb.seat] = { x, y, a: ang };
    });
    return outp;
  }

  // ───────────────────────── décor statique pré-rendu ─────────────────────────
  // Herbe, nappe vichy ronde avec ourlet, plis, bocaux / salières en couronne, petits accessoires dans les coins : cuits une fois dans
  // un canvas hors écran — redessiné seulement si la taille, la nappe, les piliers ou le contraste changent.
  let decorCv = null, decorKey = '', bodyCache = {}, bodyN = 0, potCache = {}, pilRef = null, pilKey = '';
  const pilOf = () => (snap && snap.pil && snap.pil.length ? snap.pil : []);
  const clothR = () => R0v + 14;
  function ensureDecor() {
    const pil = pilOf(); if (pil !== pilRef) { pilRef = pil; pilKey = JSON.stringify(pil); }   // la clé des piliers n'est recalculée que si le tableau change
    const key = cv.width + '|' + AR + '|' + R0v + '|' + (A.contrast ? 1 : 0) + '|' + pilKey;
    if (decorCv && key === decorKey) return;
    decorKey = key;
    if (!decorCv) decorCv = document.createElement('canvas');
    decorCv.width = cv.width; decorCv.height = cv.height;
    const g = decorCv.getContext('2d'), W = AR, c = W / 2, Rc = clothR(), rnd = rng(0x9a7a + Math.round(W));
    g.setTransform(cv.width / W, 0, 0, cv.width / W, 0, 0);
    // 1) herbe : aplat, bandes de tonte, brins, pâquerettes
    g.fillStyle = K.grass; g.fillRect(0, 0, W, W);
    g.fillStyle = 'rgba(255,255,255,0.035)'; for (let y = 0; y < W; y += 48) g.fillRect(0, y, W, 24);
    for (let k = 0; k < 900; k++) { const x = rnd() * W, y = rnd() * W, t = rnd(); g.strokeStyle = t < 0.5 ? 'rgba(20,60,15,0.35)' : 'rgba(150,210,100,0.3)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rnd() - 0.5) * 3, y - 3 - rnd() * 4); g.stroke(); }
    for (let k = 0; k < 26; k++) {
      const a = rnd() * Math.PI * 2, d = Rc + 22 + rnd() * (W * 0.42), x = c + Math.cos(a) * d, y = c + Math.sin(a) * d;
      if (x < 8 || y < 8 || x > W - 8 || y > W - 8) continue;
      g.fillStyle = '#fbfbf4'; for (let q = 0; q < 6; q++) { const u = q * Math.PI / 3; g.beginPath(); oval(g, x + Math.cos(u) * 3.2, y + Math.sin(u) * 3.2, 2.4, 1.3); g.fill(); }
      g.fillStyle = '#f0c030'; g.beginPath(); g.arc(x, y, 1.9, 0, Math.PI * 2); g.fill();
    }
    // 2) ombre portée de la nappe, puis la nappe : vichy (bandes rouges translucides croisées), tissage, plis
    g.save(); g.fillStyle = 'rgba(8,24,6,0.45)'; g.beginPath(); g.arc(c + 5, c + 8, Rc + 2, 0, Math.PI * 2); g.fill(); g.restore();
    g.save(); g.beginPath(); g.arc(c, c, Rc, 0, Math.PI * 2); g.clip();
    g.fillStyle = K.cream; g.fillRect(c - Rc, c - Rc, Rc * 2, Rc * 2);
    const q = Rc / 8.5;
    g.fillStyle = 'rgba(216,72,58,0.52)'; for (let x = c - Rc; x < c + Rc; x += q * 2) g.fillRect(x, c - Rc, q, Rc * 2);
    for (let y = c - Rc; y < c + Rc; y += q * 2) g.fillRect(c - Rc, y, Rc * 2, q);
    g.strokeStyle = 'rgba(120,40,30,0.07)'; g.lineWidth = 1; g.beginPath();
    for (let x = c - Rc; x < c + Rc; x += 3) { g.moveTo(x, c - Rc); g.lineTo(x, c + Rc); }
    for (let y = c - Rc; y < c + Rc; y += 3) { g.moveTo(c - Rc, y); g.lineTo(c + Rc, y); }
    g.stroke();
    for (let k = 0; k < 7; k++) {                                                          // plis du tissu : un sillon sombre bordé d'un reflet
      const a = rnd() * Math.PI, o = (rnd() - 0.5) * Rc * 1.2, dx = Math.cos(a), dy = Math.sin(a), px = -dy * o, py = dx * o;
      g.strokeStyle = 'rgba(40,10,0,0.06)'; g.lineWidth = 9; g.beginPath(); g.moveTo(c + px - dx * Rc, c + py - dy * Rc); g.lineTo(c + px + dx * Rc, c + py + dy * Rc); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.10)'; g.lineWidth = 3; g.beginPath(); g.moveTo(c + px - dx * Rc + 4, c + py - dy * Rc + 4); g.lineTo(c + px + dx * Rc + 4, c + py + dy * Rc + 4); g.stroke();
    }
    const sh = g.createRadialGradient(c - Rc * 0.2, c - Rc * 0.25, Rc * 0.1, c, c, Rc * 1.05);
    sh.addColorStop(0, 'rgba(255,248,220,0.14)'); sh.addColorStop(0.7, 'rgba(255,248,220,0)'); sh.addColorStop(1, 'rgba(40,10,0,0.22)');
    g.fillStyle = sh; g.fillRect(c - Rc, c - Rc, Rc * 2, Rc * 2);
    g.restore();
    // ourlet : ruban tomate cousu de points blancs
    g.lineWidth = 7; g.strokeStyle = K.tomatoDk; g.beginPath(); g.arc(c, c, Rc - 3, 0, Math.PI * 2); g.stroke();
    g.lineWidth = 4; g.strokeStyle = K.tomato; g.beginPath(); g.arc(c, c, Rc - 3, 0, Math.PI * 2); g.stroke();
    g.lineWidth = 1.4; g.strokeStyle = 'rgba(255,255,255,0.85)'; g.setLineDash([5, 5]); g.beginPath(); g.arc(c, c, Rc - 3, 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
    // 3) piliers : bocal de cornichons, salière, bouchon de moutarde (en couronne, dans l'ordre du serveur)
    pil.forEach((pl, i) => {
      const x = pl[0], y = pl[1], r = pl[2], t = i % 3;
      g.fillStyle = 'rgba(30,10,0,0.3)'; g.beginPath(); g.arc(x + r * 0.22, y + r * 0.3, r * 1.02, 0, Math.PI * 2); g.fill();
      if (t === 0) {                                                                       // bocal : verre, cornichons, couvercle tomate godronné
        g.fillStyle = '#cfe9ee'; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#7da443'; g.beginPath(); oval(g, x - r * 0.1, y, r * 0.78, r * 0.52); g.fill();
        g.fillStyle = K.tomato; g.beginPath(); g.arc(x, y, r * 0.74, 0, Math.PI * 2); g.fill();
        g.strokeStyle = K.tomatoDk; g.lineWidth = 2.2; g.setLineDash([2.2, 2.2]); g.beginPath(); g.arc(x, y, r * 0.74, 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
        g.fillStyle = 'rgba(255,255,255,0.45)'; g.beginPath(); g.arc(x - r * 0.25, y - r * 0.28, r * 0.22, 0, Math.PI * 2); g.fill();
      } else if (t === 1) {                                                                // salière : capuchon chromé, trous
        g.fillStyle = '#b9bec3'; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#f2f4f5'; g.beginPath(); g.arc(x, y, r * 0.82, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#7d848a'; for (let k = 0; k < 7; k++) { const u = k * Math.PI * 2 / 6, d = k === 6 ? 0 : r * 0.36; g.beginPath(); g.arc(x + Math.cos(u) * d, y + Math.sin(u) * d, r * 0.085, 0, Math.PI * 2); g.fill(); }
        g.fillStyle = 'rgba(255,255,255,0.7)'; g.beginPath(); g.arc(x - r * 0.4, y - r * 0.42, r * 0.17, 0, Math.PI * 2); g.fill();
      } else {                                                                             // bouteille de moutarde vue du dessus : bouchon jaune et bec
        g.fillStyle = '#b98a14'; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#efc233'; g.beginPath(); g.arc(x, y, r * 0.88, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#c99a1a'; g.beginPath(); g.arc(x, y, r * 0.4, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#fff3a0'; g.beginPath(); g.arc(x, y, r * 0.17, 0, Math.PI * 2); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.5)'; g.beginPath(); g.arc(x - r * 0.42, y - r * 0.44, r * 0.16, 0, Math.PI * 2); g.fill();
      }
      g.strokeStyle = A.contrast ? '#fff' : 'rgba(40,20,10,0.55)'; g.lineWidth = A.contrast ? 2.4 : 1.2; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.stroke();
    });
    // 4) coins : panier en osier (haut gauche), pomme (haut droit), pichet de citronnade (bas droit), tranche de pastèque (bas gauche)
    const cs = W * 0.05, e = W * 0.085;
    const prop = (x, y, fn) => { if (Math.hypot(x - c, y - c) > Rc + cs * 0.9) fn(x, y); };
    prop(e, e, (x, y) => { g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.arc(x + 4, y + 6, cs, 0, Math.PI * 2); g.fill(); g.fillStyle = '#a9743a'; g.beginPath(); g.arc(x, y, cs, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#7d5226'; g.lineWidth = 2; for (let k = 1; k < 4; k++) { g.beginPath(); g.arc(x, y, cs * k / 4, 0, Math.PI * 2); g.stroke(); }
      g.strokeStyle = '#c99457'; g.lineWidth = 3; g.beginPath(); g.moveTo(x - cs, y); g.lineTo(x + cs, y); g.stroke(); g.fillStyle = K.cream; g.fillRect(x - cs * 0.45, y - cs * 0.45, cs * 0.9, cs * 0.9); g.fillStyle = 'rgba(216,72,58,0.6)'; g.fillRect(x - cs * 0.45, y - cs * 0.45, cs * 0.3, cs * 0.9); g.fillRect(x + cs * 0.15, y - cs * 0.45, cs * 0.3, cs * 0.9); });
    prop(W - e, e, (x, y) => { g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.arc(x + 3, y + 5, cs * 0.6, 0, Math.PI * 2); g.fill(); g.fillStyle = '#c93428'; g.beginPath(); g.arc(x - cs * 0.15, y, cs * 0.52, 0, Math.PI * 2); g.arc(x + cs * 0.15, y, cs * 0.52, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#5d3a1a'; g.fillRect(x - 1.5, y - cs * 0.62, 3, cs * 0.3); g.fillStyle = '#4c9a36'; g.beginPath(); oval(g, x + cs * 0.3, y - cs * 0.5, cs * 0.3, cs * 0.14); g.fill(); g.fillStyle = 'rgba(255,255,255,0.4)'; g.beginPath(); g.arc(x - cs * 0.3, y - cs * 0.15, cs * 0.14, 0, Math.PI * 2); g.fill(); });
    prop(W - e, W - e, (x, y) => { g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.arc(x + 4, y + 6, cs * 0.75, 0, Math.PI * 2); g.fill(); g.fillStyle = '#e9f3d2'; g.beginPath(); g.arc(x, y, cs * 0.75, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#f2e04a'; g.beginPath(); g.arc(x, y, cs * 0.6, 0, Math.PI * 2); g.fill(); g.strokeStyle = '#d6c22a'; g.lineWidth = 1.4; g.beginPath(); g.arc(x, y, cs * 0.6, 0, Math.PI * 2); g.stroke();
      for (let k = 0; k < 8; k++) { const u = k * Math.PI / 4; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(u) * cs * 0.6, y + Math.sin(u) * cs * 0.6); g.stroke(); } g.fillStyle = '#ffffff'; g.fillRect(x + cs * 0.1, y - cs * 0.9, 3, cs * 0.8); });
    prop(e, W - e, (x, y) => { g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.arc(x + 3, y + 5, cs * 0.7, 0, Math.PI, true); g.fill(); g.fillStyle = '#2e8b3a'; g.beginPath(); g.arc(x, y, cs * 0.7, 0, Math.PI, false); g.closePath(); g.fill();
      g.fillStyle = '#ecf3d4'; g.beginPath(); g.arc(x, y, cs * 0.62, 0, Math.PI, false); g.closePath(); g.fill(); g.fillStyle = '#e84a52'; g.beginPath(); g.arc(x, y, cs * 0.55, 0, Math.PI, false); g.closePath(); g.fill();
      g.fillStyle = '#3a1a14'; for (let k = 0; k < 5; k++) { g.beginPath(); oval(g, x + (k - 2) * cs * 0.2, y + cs * (0.14 + 0.12 * (k % 2)), 1.6, 2.6); g.fill(); } });
    // 5) vignette douce (le pique-nique est en plein soleil, le bord de l'image un peu moins) + cadre
    const vg = g.createRadialGradient(c, c, W * 0.42, c, c, W * 0.78); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(6,18,4,0.5)');
    g.fillStyle = vg; g.fillRect(0, 0, W, W);
    g.strokeStyle = 'rgba(240,199,104,' + (A.contrast ? 0.7 : 0.3) + ')'; g.lineWidth = 1.5; g.strokeRect(5, 5, W - 10, W - 10);
    g.strokeStyle = 'rgba(0,0,0,0.55)'; g.lineWidth = 4; g.strokeRect(2, 2, W - 4, W - 4);
  }

  // ───────────────────────── pions vus de dessus ─────────────────────────
  function bodyStyle(seat, r, col) {                     // dégradé du pion en repère local (réutilisable)
    const key = seat + '|' + r.toFixed(1) + '|' + col;
    if (bodyCache[key]) return bodyCache[key];
    if (++bodyN > 120) { bodyCache = {}; bodyN = 0; }    // le rayon varie (podium) : on borne le cache
    const base = hexRgb(col), gr = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r * 1.05);
    gr.addColorStop(0, rgbStr(mix(base, [255, 255, 255], 0.45))); gr.addColorStop(0.6, rgbStr(base)); gr.addColorStop(1, rgbStr(mix(base, [20, 10, 5], 0.4)));
    return (bodyCache[key] = { grad: gr, dark: rgbStr(mix(base, [15, 8, 4], 0.55)), light: rgbStr(mix(base, [255, 250, 235], 0.72)) });
  }
  // pion : socle coloré, bande à motif de siège (peinte avec seatPattern), calotte claire, deux yeux et un museau qui montrent le regard.
  // o : alpha, scale, spin, shadow:false · shield (bulle), turbo (flammèches), imm (anneau pointillé), hot (porte la patate : yeux écarquillés),
  // tired (sueur), soot (brûlé), jolt (écrasement de réception), me (repère « c'est moi »).
  function drawPawn(seat, x, y, a, r, o, now) {
    const col = colSeat(seat), B = bodyStyle(seat, r, col);
    ctx.save(); ctx.translate(x, y);
    if (o.alpha != null) ctx.globalAlpha = o.alpha;
    if (o.shadow !== false) { ctx.fillStyle = 'rgba(20,40,10,0.35)'; ctx.beginPath(); ctx.arc(r * 0.18, r * 0.28, r * 1.02, 0, Math.PI * 2); ctx.fill(); }
    if (o.turbo) {                                       // turbo : anneau de flammes tournantes
      ctx.save(); ctx.strokeStyle = 'rgba(255,150,30,0.85)'; ctx.lineWidth = 3; ctx.lineCap = 'round';
      const t0 = A.reduceFx ? 0 : now / 120;
      for (let k = 0; k < 5; k++) { const u = t0 + k * Math.PI * 2 / 5; ctx.beginPath(); ctx.arc(0, 0, r + 6, u, u + 0.7); ctx.stroke(); }
      ctx.restore();
    }
    if (o.scale || o.jolt) { const s = (o.scale || 1) * (1 + (o.jolt || 0) * 0.16); ctx.scale(s, s * (1 - (o.jolt || 0) * 0.1)); }
    ctx.fillStyle = B.grad; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
    ctx.rotate(a + (o.spin || 0));
    // bande colorée + motif du siège (identification sans les couleurs)
    ctx.lineWidth = r * 0.3; ctx.strokeStyle = col; ctx.beginPath(); ctx.arc(0, 0, r * 0.84, 0, Math.PI * 2); ctx.stroke();
    const pat = seatPattern(ctx, seat, { size: Math.max(6, r * 0.5), ink: 'rgba(255,255,255,0.42)', res: Math.round(cv.width / AR * 100) / 100 });   // res = px appareil par unité monde : motif net sur Retina
    if (pat) { ctx.strokeStyle = pat; ctx.stroke(); }
    ctx.lineWidth = 1; ctx.strokeStyle = B.dark; ctx.beginPath(); ctx.arc(0, 0, r * 0.68, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = B.light; ctx.beginPath(); ctx.arc(0, 0, r * 0.64, 0, Math.PI * 2); ctx.fill();    // calotte claire
    ctx.fillStyle = '#fff'; ctx.strokeStyle = B.dark; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(r * 1.08, 0); ctx.lineTo(r * 0.86, -r * 0.17); ctx.lineTo(r * 0.86, r * 0.17); ctx.closePath(); ctx.fill(); ctx.stroke();   // museau : direction du regard
    const ey = r * 0.26, er = o.hot ? r * 0.2 : r * 0.16;                              // yeux : écarquillés (pupille minuscule) quand on porte la patate
    for (const s of [-1, 1]) {
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(r * 0.18, s * ey, er, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = B.dark; ctx.lineWidth = 0.8; ctx.stroke();
      ctx.fillStyle = K.ink; ctx.beginPath(); ctx.arc(r * 0.18 + er * 0.3, s * ey, o.hot ? er * 0.3 : er * 0.5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.rotate(-(a + (o.spin || 0)));
    if (o.soot) { ctx.fillStyle = 'rgba(25,18,14,0.5)'; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); }
    if (A.contrast) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.arc(0, 0, r + 1.2, 0, Math.PI * 2); ctx.stroke(); }
    if (o.imm) { ctx.strokeStyle = 'rgba(200,230,255,0.85)'; ctx.lineWidth = 2; ctx.setLineDash([3, 4]); ctx.lineDashOffset = A.reduceFx ? 0 : -now / 90; ctx.beginPath(); ctx.arc(0, 0, r + 4, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); }   // donneur encore protégé : ne peut pas la reprendre
    if (o.shield) {                                      // bouclier : bulle bleutée avec reflet
      ctx.fillStyle = 'rgba(110,200,255,0.22)'; ctx.beginPath(); ctx.arc(0, 0, r + 9, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(180,235,255,0.95)'; ctx.lineWidth = A.contrast ? 3.2 : 2.2; ctx.beginPath(); ctx.arc(0, 0, r + 9, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(0, 0, r + 9, -2.6, -1.9); ctx.stroke();
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
    ctx.restore();
    if (o.me) {                                          // repère « c'est moi » : anneau crème pulsé + pointe tomate au-dessus
      ctx.save(); ctx.strokeStyle = K.cream; ctx.lineWidth = 1.6; ctx.globalAlpha = A.reduceFx ? 0.8 : 0.55 + 0.4 * Math.sin(now / 200);
      ctx.beginPath(); ctx.arc(x, y, r + 4, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1;
      const ty = y - r - 9; ctx.fillStyle = K.tomato; ctx.strokeStyle = K.ink; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(x - 6, ty - 8); ctx.lineTo(x + 6, ty - 8); ctx.lineTo(x, ty); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
    }
  }

  // halo du porteur : visible de TOUS, même en « Réduire les effets » (anneau fixe) — c'est une information de jeu, pas un effet
  function drawHalo(x, y, h, now) {
    const pul = A.reduceFx ? 0 : Math.sin(now / (150 - 80 * h));
    if (!A.reduceFx) lumiere(ctx, x, y, PR * (3.4 + 0.8 * h), '#ff3b2a', 0.3 + 0.3 * h + 0.06 * pul);
    ctx.save();
    ctx.strokeStyle = 'rgba(255,59,42,0.92)'; ctx.lineWidth = A.contrast ? 4.5 : 3.2; ctx.beginPath(); ctx.arc(x, y, PR + 7 + 2 * pul, 0, Math.PI * 2); ctx.stroke();
    if (A.contrast) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(x, y, PR + 10, 0, Math.PI * 2); ctx.stroke(); }
    ctx.fillStyle = '#ffd24a'; const t0 = A.reduceFx ? 0 : now / 400;                // trois flammèches qui tournent autour
    for (let k = 0; k < 3; k++) { const u = t0 + k * Math.PI * 2 / 3; ctx.beginPath(); ctx.arc(x + Math.cos(u) * (PR + 11), y + Math.sin(u) * (PR + 11), 2.4, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  }

  // patate-bombe : boule de papier alu irrégulière, plis, bouts torsadés, mèche qui crépite ; rougit, tremble et bat avec la chaleur h (0..1)
  // f : secondes restantes (mèche VISIBLE seulement) → longueur de la mèche + compte à rebours
  function potStyle(h) {
    const key = Math.round(h * 10);
    if (potCache[key]) return potCache[key];
    const base = mix([214, 218, 222], [238, 76, 46], Math.pow(key / 10, 1.15)), gr = ctx.createRadialGradient(-BR * 0.4, -BR * 0.45, BR * 0.1, 0, 0, BR * 1.3);
    gr.addColorStop(0, rgbStr(mix(base, [255, 255, 255], 0.55))); gr.addColorStop(0.55, rgbStr(base)); gr.addColorStop(1, rgbStr(mix(base, [60, 34, 28], 0.5)));
    return (potCache[key] = { grad: gr, dark: rgbStr(mix(base, [40, 20, 16], 0.6)), base: base });
  }
  function drawPotato(x, y, ang, h, now, o) {
    const S = potStyle(h), sh = (!A.reduceFx && h > 0.5) ? (h - 0.4) * 2.6 : 0, lift = o.lift || 0;
    const beat = A.reduceFx ? 0.05 * h : 0.06 * Math.max(0.3, h) * Math.sin(now / (130 - 75 * h)) + 0.05 * h;
    const px = x + (sh ? (Math.random() * 2 - 1) * sh : 0), py = y - lift + (sh ? (Math.random() * 2 - 1) * sh : 0), k = BR * 1.12 * (1 + beat) * (o.scale || 1);
    ctx.save();
    ctx.fillStyle = 'rgba(20,40,10,' + (0.3 / (1 + lift * 0.04)).toFixed(2) + ')'; ctx.beginPath(); oval(ctx, x + k * 0.3 + lift * 0.3, y + k * 0.45 + lift * 0.3, k * 1.15, k * 0.85); ctx.fill();   // ombre au sol
    ctx.translate(px, py); ctx.rotate(ang);
    ctx.fillStyle = S.dark; ctx.beginPath(); ctx.moveTo(k * 1.42, 0); ctx.lineTo(k * 1.05, -k * 0.3); ctx.lineTo(k * 1.05, k * 0.3); ctx.closePath();    // bouts torsadés du papier
    ctx.moveTo(-k * 1.42, 0); ctx.lineTo(-k * 1.05, -k * 0.3); ctx.lineTo(-k * 1.05, k * 0.3); ctx.closePath(); ctx.fill();
    ctx.fillStyle = S.grad; ctx.strokeStyle = S.dark; ctx.lineWidth = 1.3; ctx.beginPath();
    for (let i = 0; i < LUMPS.length; i++) { const L = LUMPS[i]; if (i) ctx.lineTo(L[0] * k * 1.15, L[1] * k); else ctx.moveTo(L[0] * k * 1.15, L[1] * k); }
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(40,24,20,0.3)'; ctx.lineWidth = 0.9; ctx.beginPath();        // plis du papier alu
    ctx.moveTo(-k * 0.6, -k * 0.5); ctx.lineTo(-k * 0.1, -k * 0.05); ctx.lineTo(-k * 0.45, k * 0.45); ctx.moveTo(k * 0.15, -k * 0.6); ctx.lineTo(k * 0.35, -k * 0.1); ctx.lineTo(k * 0.1, k * 0.5); ctx.moveTo(k * 0.7, -k * 0.3); ctx.lineTo(k * 0.55, k * 0.25);
    ctx.stroke();
    if (h > 0.5) {                                       // fissures incandescentes
      const fl = A.reduceFx ? 0.9 : 0.6 + 0.4 * Math.sin(now / 60), ga = (h - 0.45) * 1.8 * fl;
      ctx.strokeStyle = 'rgba(255,190,70,' + Math.min(1, ga).toFixed(2) + ')'; ctx.lineWidth = 1.6; ctx.lineCap = 'round'; ctx.beginPath();
      ctx.moveTo(-k * 0.2, -k * 0.6); ctx.lineTo(0, -k * 0.1); ctx.lineTo(-k * 0.25, k * 0.35); ctx.moveTo(k * 0.25, -k * 0.5); ctx.lineTo(k * 0.45, 0); ctx.lineTo(k * 0.2, k * 0.5);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,255,255,' + (0.8 - 0.4 * h).toFixed(2) + ')'; ctx.beginPath(); oval(ctx, -k * 0.35, -k * 0.38, k * 0.36, k * 0.17); ctx.fill();   // reflet
    // mèche : droite depuis le haut de la patate ; étincelle qui crépite au bout (longueur ∝ temps restant en mèche visible)
    const wl = o.f != null ? 5 + 13 * Math.max(0, Math.min(1, o.f / FUSE_MAX)) : 8;
    ctx.rotate(-ang);                                     // la mèche reste verticale, quel que soit le cap de la patate
    ctx.strokeStyle = '#3a2a18'; ctx.lineWidth = 1.8; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(k * 0.15, -k * 0.85); ctx.lineTo(k * 0.35, -k * 0.85 - wl); ctx.stroke();
    const tx = k * 0.35, ty = -k * 0.85 - wl, fk = A.reduceFx ? 1 : 0.7 + 0.5 * Math.abs(Math.sin(now / 45 + x));
    ctx.fillStyle = '#ffb02e'; ctx.beginPath(); ctx.arc(tx, ty, 3.2 * fk, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff6c0'; ctx.beginPath(); ctx.arc(tx, ty, 1.7 * fk, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    return { tx: px + k * 0.35, ty: py - k * 0.85 - wl };
  }

  // bonus au sol : jeton crème cerclé de sa couleur + pictogramme vectoriel (bouclier, éclair)
  function drawPickupIcon(k, x, y, s) {
    const u = s / 10, d = puAt(k); ctx.save(); ctx.translate(x, y); ctx.fillStyle = d.c; ctx.strokeStyle = d.c; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (d === PU[0]) {                                   // bouclier : écu arrondi, croix claire
      ctx.beginPath(); ctx.moveTo(0, -6.5 * u); ctx.lineTo(5.2 * u, -4 * u); ctx.lineTo(5.2 * u, 0.8 * u); ctx.quadraticCurveTo(5 * u, 5 * u, 0, 7 * u); ctx.quadraticCurveTo(-5 * u, 5 * u, -5.2 * u, 0.8 * u); ctx.lineTo(-5.2 * u, -4 * u); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5 * u; ctx.beginPath(); ctx.moveTo(0, -3.4 * u); ctx.lineTo(0, 3.6 * u); ctx.moveTo(-3 * u, 0); ctx.lineTo(3 * u, 0); ctx.stroke();
    } else {                                             // turbo : éclair
      ctx.beginPath(); ctx.moveTo(1.5 * u, -6.5 * u); ctx.lineTo(-3 * u, 0.8 * u); ctx.lineTo(0.2 * u, 0.8 * u); ctx.lineTo(-1.6 * u, 6.5 * u); ctx.lineTo(3.6 * u, -1.2 * u); ctx.lineTo(0.4 * u, -1.2 * u); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  // tache de purée : flaque irrégulière (un noyau + gouttes satellites, déterministes d'après la graine) ; reste au sol toute la manche
  function drawStain(s, k) {
    const r = s.r * k, x = s.x, y = s.y, sd = s.seed;
    ctx.save(); ctx.globalAlpha = 0.94;
    ctx.fillStyle = K.pureeDk; ctx.beginPath(); ctx.arc(x, y, r * 1.06, 0, Math.PI * 2);
    for (let i = 0; i < 7; i++) { const a = i * 0.9 + hash2(sd, i) * 0.8, d = r * (0.72 + hash2(i, sd) * 0.5), q = r * (0.24 + hash2(sd + i, 1) * 0.2); ctx.moveTo(x + Math.cos(a) * d + q * 1.1, y + Math.sin(a) * d); ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, q * 1.1, 0, Math.PI * 2); }
    ctx.fill();
    ctx.fillStyle = K.puree; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    for (let i = 0; i < 7; i++) { const a = i * 0.9 + hash2(sd, i) * 0.8, d = r * (0.72 + hash2(i, sd) * 0.5), q = r * (0.24 + hash2(sd + i, 1) * 0.2); ctx.moveTo(x + Math.cos(a) * d + q, y + Math.sin(a) * d); ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, q, 0, Math.PI * 2); }
    ctx.fill();
    ctx.fillStyle = 'rgba(214,180,80,0.6)'; ctx.beginPath();                     // grumeaux
    for (let i = 0; i < 6; i++) { const a = hash2(sd, i + 9) * 6.28, d = r * hash2(i + 3, sd) * 0.7; ctx.moveTo(x + Math.cos(a) * d + 2.4, y + Math.sin(a) * d); ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, 2.4, 0, Math.PI * 2); }
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,240,0.5)'; ctx.beginPath(); ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.22, 0, Math.PI * 2); ctx.fill();   // brillance
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
  // pion éliminé : projeté en tournoyant vers « la caméra » (plus gros), roussi, puis s'efface ; t = 0..1
  function drawFlyer(f, t, now) {
    if (A.reduceFx) { drawPawn(f.seat, f.x, f.y, f.a, PR, { alpha: 1 - t, shadow: false, soot: true }, now); return; }
    const e = 1 - (1 - t) * (1 - t), dx = Math.cos(f.dir) * 46 * e, dy = Math.sin(f.dir) * 46 * e - 34 * Math.sin(Math.PI * t);
    drawPawn(f.seat, f.x + dx, f.y + dy, f.a, PR, { scale: 1 + 0.9 * e, spin: t * 9, alpha: 1 - t * t, shadow: false, soot: true }, now);
  }
  // « BAOUM ! » : étoile de BD (deux étoiles imbriquées) qui claque puis s'efface ; t = 0..1 ; onde du souffle jusqu'au rayon serveur (BLAST_R)
  function drawBoomStar(x, y, t, seat, ring) {
    const xx = Math.max(74, Math.min(AR - 74, x)), yy = Math.max(56, Math.min(AR - 50, y));
    if (ring && !A.reduceFx && t < 0.6) { const e = 1 - (1 - t / 0.6) * (1 - t / 0.6); ctx.save(); ctx.globalAlpha = 0.7 * (1 - t / 0.6); ctx.strokeStyle = 'rgb(251,243,222)'; ctx.lineWidth = 9 * (1 - t); ctx.beginPath(); ctx.arc(x, y, 12 + (BLAST_R - 12) * e, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
    const s = A.reduceFx ? 1 : (t < 0.1 ? 0.4 + 0.9 * t / 0.1 : t < 0.22 ? 1.3 - 0.3 * (t - 0.1) / 0.12 : 1), rot = A.reduceFx ? -0.08 : -0.12 + 0.05 * Math.sin(t * 9);
    ctx.save(); ctx.translate(xx, yy); ctx.scale(s, s); ctx.rotate(rot); ctx.globalAlpha = t > 0.7 ? (1 - t) / 0.3 : 1; ctx.lineJoin = 'round';
    const star = (R, n) => { ctx.beginPath(); for (let i = 0; i < n * 2; i++) { const a = i * Math.PI / n, rr = i % 2 ? R * 0.68 : R; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.closePath(); };
    star(66, 10); ctx.lineWidth = 5; ctx.strokeStyle = K.ink; ctx.stroke(); ctx.fillStyle = '#ffd24a'; ctx.fill();
    star(48, 10); ctx.fillStyle = '#ff7a2a'; ctx.fill();
    ctx.font = '31px ' + DISP; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 7; ctx.strokeStyle = K.ink; ctx.strokeText('BAOUM !', 0, 2); ctx.fillStyle = K.cream; ctx.fillText('BAOUM !', 0, 2);
    ctx.lineWidth = 1.2; ctx.strokeStyle = colSeat(seat); ctx.strokeText('BAOUM !', 0, 2);
    ctx.restore();
  }
  // fin du ralenti (fini ou passé) : la carte de fin, le jingle et le podium arrivent enfin
  function finReplay(now) {
    const m = pendingEnd; pendingEnd = null;
    if (!m || !snap || snap.gs !== 'over') return;
    showEndscreen(m); endShown = true; overT0 = now; sound('win'); music.sting('win');
  }
  // podium : pions vus de dessus sur des marches de bois clair, ourlet tomate en arête ; fond de l'arène assombri (la carte DOM prend le bas du cadre)
  function drawPodiumScene(now) {
    const list = podEntries(snap);
    if (!list.length) return;
    const k = A.reduceFx ? 1 : Math.max(0, Math.min(1, (now - overT0) / 350));
    ctx.save();
    ctx.fillStyle = 'rgba(10,22,6,' + ((A.contrast ? 0.9 : 0.72) * k).toFixed(2) + ')'; ctx.fillRect(-24, -24, AR + 48, AR + 48);
    ctx.restore();
    const ph = AR * podFrac();
    drawPodium(ctx, { x: AR * 0.03, y: AR * 0.015, w: AR * 0.94, h: ph - AR * 0.03 }, now, {
      entries: list, A, W: AR, t0: overT0, nul: winTeam(snap) < 0,
      theme: { step: '#8a5a2b', edge: K.tomato, text: K.cream, glow: K.gold },
      drawPiece(c, e, x, y, size, rank) { drawPawn(e.seat, x, y, -Math.PI / 2 + (rank === 1 && !A.reduceFx ? 0.16 * Math.sin(now / 500) : 0), size * 0.4, { shadow: false }, now); },
    });
  }

  // ───────────────────────── écran titre : « PATATE CHAUDE » et sa patate qui rougit ─────────────────────────
  function drawTitle(cx, cy, now) {
    const h = A.reduceFx ? 0.35 : 0.45 + 0.35 * Math.sin(now / 500), bob = A.reduceFx ? 0 : Math.sin(now / 420) * 4;
    const tip = drawPotato(cx, cy - 6 + bob, -0.15, h, now, { scale: 3.3 });
    if (!A.reduceFx && Math.random() < 0.5) sparks.push({ x: tip.tx, y: tip.ty, vx: (Math.random() - 0.5) * 1.4, vy: -1 - Math.random() * 1.6, born: now, life: 420 + Math.random() * 250, c: Math.random() < 0.5 ? '#ffd24a' : '#ff7a2a' });
    const f = readable(40, cv, AR, 22);
    ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = f.toFixed(1) + 'px ' + DISP; ctx.lineJoin = 'round';
    ctx.lineWidth = f * 0.2; ctx.strokeStyle = K.ink; ctx.strokeText('PATATE CHAUDE', cx, cy + 62); ctx.fillStyle = K.cream; ctx.fillText('PATATE CHAUDE', cx, cy + 62);
    ctx.lineWidth = 1.4; ctx.strokeStyle = K.tomato; ctx.strokeText('PATATE CHAUDE', cx, cy + 62);
    ctx.restore();
  }

  // ───────────────────────── rendu d'une image ─────────────────────────
  // draw() choisit ce qu'on montre : pendant le ralenti, `snap` désigne (le temps de l'image) le snapshot rejoué le plus proche, ce qui fait
  // tout lire au même endroit (nappe, bonus, pions) ; scene() reçoit rf (image du ralenti) ou null.
  function draw() {
    if (destroyed) return;
    const now = performance.now(), rf = A.reduceFx ? null : RL.frame(now);
    if (!rf) { if (pendingEnd && (A.reduceFx || !RL.active(now))) finReplay(now); scene(now, null); return; }
    const real = snap; snap = rf.u < 0.5 ? rf.a : rf.b;
    try { scene(now, rf); } finally { snap = real; }
  }
  const holdFlag = new Array(MAX_SEATS).fill(false);
  function scene(now, rf) {
    const kdt = Math.min(3, Math.max(0.25, (now - (lastFrame || now - 16.7)) / 16.7)); lastFrame = now;
    if (!A.reduceFx && !rf && HS.frozen(now)) return;       // arrêt sur image (70 ms) à chaque explosion : on garde l'image précédente
    const sc = cv.width / AR, c = AR / 2;
    let ox = 0, oy = 0;
    if (shakeMag > 0.3 && !A.reduceFx && !rf) { ox = (Math.random() * 2 - 1) * shakeMag; oy = (Math.random() * 2 - 1) * shakeMag; shakeMag *= 0.86; } else shakeMag = 0;
    if (ox || oy) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = K.grass; ctx.fillRect(0, 0, cv.width, cv.height); }   // marge peinte avant le décor : la secousse ne laisse plus de liseré de l'image d'avant
    ctx.setTransform(sc, 0, 0, sc, ox * sc, oy * sc);
    const pv = rf ? replayPlayers(rf) : (snap ? viewPlayers(now) : null);
    const pts = (snap && snap.pt) || [];
    // chaleur lissée de chaque patate (suit son porteur) ; les non-porteurs refroidissent vite
    holdFlag.fill(false);
    for (let i = 0; i < pts.length; i++) { const o = pts[i]; if (!o || !seatOk(o.o)) continue; holdFlag[o.o] = true; heatCur[o.o] += (HEAT[Math.max(0, Math.min(3, o.lv | 0))] - heatCur[o.o]) * Math.min(1, 0.07 * kdt); }
    for (let s = 0; s < MAX_SEATS; s++) if (!holdFlag[s]) heatCur[s] *= 1 - Math.min(1, 0.3 * kdt);
    { let nT = 0, nA = 0;                                   // caméra de duel : exactement 2 pions encore en lice (sur 3 ou plus au départ)
      if (snap && pv && (rf || snap.gs === 'play' || snap.gs === 'paused')) snap.players.forEach(q => { if (!q.playing) return; nT++; if (q.alive) { if (nA < 2) { const v = pv[q.seat] || q; CPTS[nA].x = v.x; CPTS[nA].y = v.y; } nA++; } });
      CAM.update(CPTS, AR, AR, nT >= 3 && nA === 2, A, now); }
    ctx.save(); CAM.apply(ctx);                             // le décor est dans la caméra (sinon pièces et décor se décalent) ; le HUD, le crépuscule et les textes restent dehors
    ensureDecor(); ctx.drawImage(decorCv, 0, 0, AR, AR);
    const R = snap && snap.R ? snap.R : R0v, Rc = clothR(), g0 = rf ? rf.ta + rf.u * (rf.tb - rf.ta) : 0;
    // zone perdue par le rétrécissement : herbe qui reprend la nappe + ruban de chantier tomate et blanc au nouveau bord
    if (R < R0v - 0.5) {
      ctx.save(); ctx.beginPath(); ctx.arc(c, c, Rc + 3, 0, Math.PI * 2); ctx.moveTo(c + R, c); ctx.arc(c, c, R, Math.PI * 2, 0, true);
      ctx.fillStyle = 'rgba(20,50,12,0.6)'; ctx.fill();
      let pulse = 0; const age = now - ringPulse; if (age < 1400) pulse = (1 - age / 1400) * (0.6 + 0.4 * Math.sin(age / 60));
      if (pulse > 0 && !A.reduceFx) { ctx.strokeStyle = 'rgba(255,80,50,' + (0.5 * pulse).toFixed(2) + ')'; ctx.lineWidth = 12 + 12 * pulse; ctx.beginPath(); ctx.arc(c, c, R, 0, Math.PI * 2); ctx.stroke(); }
      ctx.lineWidth = 5; ctx.strokeStyle = K.tomato; ctx.beginPath(); ctx.arc(c, c, R, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = '#fff'; ctx.setLineDash([9, 9]); ctx.lineDashOffset = A.reduceFx ? 0 : -now / 80; ctx.beginPath(); ctx.arc(c, c, R, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
      if (A.contrast) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(c, c, R - 4, 0, Math.PI * 2); ctx.stroke(); }
      ctx.restore();
    }
    // taches de purée des explosions précédentes (pendant le ralenti : seulement celles d'avant l'instant rejoué)
    for (let i = 0; i < stains.length; i++) { const s = stains[i]; if (rf && s.born > g0 + 5) continue; drawStain(s, A.reduceFx || rf ? 1 : Math.min(1, 0.4 + 0.6 * (now - s.born) / 200)); }
    // lueurs sous les pièces : bonus, halos des porteurs, éclats des événements
    if (!A.reduceFx && snap) {
      (snap.pk || []).forEach(pk => { if (pk && fin(pk[0])) lumiere(ctx, pk[0], pk[1], 36, puAt(pk[2]).l, 0.22 + 0.06 * Math.sin(now / 220 + pk[0])); });
      if (!rf) LUM.dessiner(ctx, now);
    }
    let dangerK = 0, hm = 0, hmx = c;                       // dangerK : je porte la patate (vignette rouge) ; hm/hmx : chaleur et abscisse de la patate la plus chaude (tic-tac)
    if (snap) {
      // bonus au sol : jeton crème cerclé de sa couleur
      (snap.pk || []).forEach(pk => {
        if (!pk || !fin(pk[0]) || !fin(pk[1])) return;
        const d = puAt(pk[2]), x = pk[0], y = pk[1], pulse = A.reduceFx ? 1 : 1 + 0.08 * Math.sin(now / 220 + x), rr = 13 * pulse;
        ctx.save(); ctx.fillStyle = 'rgba(20,40,10,0.3)'; ctx.beginPath(); ctx.arc(x + 2, y + 3, rr, 0, Math.PI * 2); ctx.fill();
        if (!A.reduceFx) { const ph = (now / 1400 + y / 97) % 1; ctx.strokeStyle = d.c; ctx.globalAlpha = 0.5 * (1 - ph); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, rr + ph * 14, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1; }
        ctx.fillStyle = K.cream; ctx.strokeStyle = d.c; ctx.lineWidth = A.contrast ? 3.5 : 2.6; ctx.beginPath(); ctx.arc(x, y, rr, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.restore();
        drawPickupIcon(pk[2], x, y, 10 * pulse);
      });
      const me = mySeat >= 0 ? snap.players[mySeat] : null, over = snap.gs === 'over', wt = winTeam(snap);
      let nPlay = 0; snap.players.forEach(p => { if (p.playing) nPlay++; });
      // halos des porteurs d'abord (sous les pions)
      snap.players.forEach(p => { if (!p.playing || !p.alive || !p.hp) return; const v = (pv && pv[p.seat]) || p; drawHalo(v.x, v.y, heatCur[p.seat], now); });
      snap.players.forEach(p => {
        if (!p.playing || !p.alive) return;
        const v = (pv && pv[p.seat]) || p, col = colSeat(p.seat), va = fin(v.a) ? v.a : 0;
        if (!A.reduceFx && !rf) {
          if (p.tb) { ctx.save(); ctx.strokeStyle = 'rgba(255,170,50,0.5)'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); for (let k = -1; k <= 1; k++) { const ax = v.x - Math.cos(va) * (PR + 2) + Math.sin(va) * k * 7, ay = v.y - Math.sin(va) * (PR + 2) - Math.cos(va) * k * 7; ctx.moveTo(ax, ay); ctx.lineTo(ax - Math.cos(va) * 16, ay - Math.sin(va) * 16); } ctx.stroke(); ctx.restore(); lumiere(ctx, v.x, v.y, PR * 2.4, '#ffb347', 0.2); }
          if (p.sh) lumiere(ctx, v.x, v.y, PR * 2.6, '#9fe0ff', 0.2);
          if (p.spr && Math.random() < 0.5 * kdt) puffs.push({ x: v.x - Math.cos(va) * PR, y: v.y - Math.sin(va) * PR + 4, vx: (Math.random() - 0.5) * 0.4, vy: (Math.random() - 0.5) * 0.4, born: now, life: 340, r0: 2.4 + Math.random() * 2, col: '226,214,170' });   // poussière de sprint
        }
        const jo = Math.max(0, 1 - (now - joltAt[p.seat]) / 260);
        drawPawn(p.seat, v.x, v.y, va, PR, { shield: p.sh, turbo: p.tb, imm: p.imm && !p.hp, hot: p.hp, tired: p.ess, jolt: A.reduceFx ? 0 : jo, me: p.seat === mySeat && !over }, now);
        if (over && wt >= 0 && p.team === wt) { ctx.save(); ctx.strokeStyle = K.gold; ctx.lineWidth = A.contrast ? 3.5 : 2.5; ctx.globalAlpha = A.reduceFx ? 0.9 : 0.5 + 0.4 * Math.sin(now / 180); ctx.beginPath(); ctx.arc(v.x, v.y, PR + 8, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }   // vainqueur(s) auréolé(s) : jamais sur une égalité (winner = -1)
      });
      // patates : dans les mains du porteur (devant lui), ou en vol (passe / chute du ciel)
      for (let i = 0; i < pts.length; i++) {
        const o = pts[i]; if (!o || !seatOk(o.o)) continue;
        const p = snap.players[o.o], v = p && ((pv && pv[o.o]) || p); if (!p || !p.alive || !v) continue;
        const va = fin(v.a) ? v.a : 0, h = heatCur[o.o];
        let x = v.x + Math.cos(va) * PR * 0.78, y = v.y + Math.sin(va) * PR * 0.78, lift = 3 + (A.reduceFx ? 0 : 1.6 * Math.sin(now / 160 + o.o));
        const tt = !rf ? tossOf[o.o] : null;
        if (tt) {
          const t = (now - tt.born) / tt.dur;
          if (t >= 1) tossOf[o.o] = null;
          else { const e = 1 - (1 - t) * (1 - t); x = tt.x + (x - tt.x) * e; y = tt.y + (y - tt.y) * e; lift += tt.arc * Math.sin(Math.PI * t) + tt.z * (1 - t) * (1 - t); }
        }
        const tip = drawPotato(x, y, va * 0.5, h, now, { lift, f: o.f != null ? o.f : null });
        if (h > hm) { hm = h; hmx = x; }
        if (!A.reduceFx && !rf) {
          if (Math.random() < (0.2 + 0.7 * h) * kdt) sparks.push({ x: tip.tx, y: tip.ty, vx: (Math.random() - 0.5) * 1.2, vy: -0.8 - Math.random() * 1.4, born: now, life: 260 + Math.random() * 250, c: Math.random() < 0.5 ? '#ffd24a' : '#ff7a2a' });   // la mèche crépite
          if (h > 0.55 && Math.random() < 0.22 * h * kdt) smoke(tip.tx, tip.ty, 1, false);                                                                                                                                      // fumée quand elle chauffe
        }
        if (o.f != null && fin(o.f)) {                                                                          // mèche visible : compte à rebours au-dessus de la patate
          const fs = readable(13, cv, AR, 11);
          ctx.save(); ctx.font = 'bold ' + fs.toFixed(1) + 'px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round'; ctx.lineWidth = 4; ctx.strokeStyle = K.ink;
          const tx = Math.max(16, Math.min(AR - 16, tip.tx)), ty = Math.max(10, tip.ty - 12); ctx.strokeText(o.f.toFixed(1), tx, ty); ctx.fillStyle = o.f < 3 ? '#ff5a4a' : K.cream; ctx.fillText(o.f.toFixed(1), tx, ty); ctx.restore();
        }
      }
      // pastilles numérotées de siège : toujours à partir de 7 joueurs (les teintes ne suffisent plus), sinon au décompte et 2 s après le coup d'envoi
      if (snap.gs === 'countdown' || ((snap.gs === 'play' || snap.gs === 'paused') && (nPlay >= 7 || now - goT0 < 2000))) {
        const cs = readable(18, cv, AR, 20);                // 20 px CSS mini : le chiffre (0,44 × taille) reste ≥ 9 px
        snap.players.forEach(p => {
          if (!p.playing || !p.alive) return;
          const v = (pv && pv[p.seat]) || p, cy = v.y - PR - (p.seat === mySeat ? 20 + cs * 0.5 : 8 + cs * 0.5);   // au-dessus de la pointe « c'est moi »
          drawSeatChip(ctx, Math.max(cs / 2 + 2, Math.min(AR - cs / 2 - 2, v.x)), Math.max(cs / 2 + 2, cy), p.seat, colSeat(p.seat), cs);
        });
      }
      // danger : je porte la patate → vignette rouge qui gonfle avec la chaleur (posée plus bas, hors caméra)
      if (me && me.playing && me.alive && me.hp && snap.gs === 'play' && !rf) dangerK = 0.3 + 0.6 * heatCur[mySeat];
    }
    // pions éliminés : projetés en tournoyant, roussis, puis effacés
    for (let i = rf ? -1 : flyers.length - 1; i >= 0; i--) {   // (ralenti : les explosions en direct ne se rejouent pas, on les déduit plus bas)
      const f = flyers[i], t = (now - f.born) / 1100;
      if (t >= 1) { flyers.splice(i, 1); continue; }
      drawFlyer(f, t, now);
    }
    if (rf) {                                               // ralenti : un pion vivant dans a, éliminé dans b, explose comme en direct (durée en temps de jeu)
      const ps = rf.b.players;
      for (let i = 0; i < ps.length; i++) {
        const pa = rf.a.players[i], pb = ps[i];
        if (pa && pb && pa.playing && pa.alive && !pb.alive && !repOut[i]) { const v = (pv && pv[i]) || pb; repOut[i] = { seat: i, x: v.x, y: v.y, dir: hash2(i, v.x) * Math.PI * 2, a: v.a || 0, g0: g0 }; repHas = true; }
      }
      if (repHas) for (const k in repOut) { const f = repOut[k], t = (g0 - f.g0) / 800; if (t >= 0 && t < 1) { drawFlyer(f, t, now); drawBoomStar(f.x, f.y, t, f.seat, true); } }
    } else if (repHas) { repOut = {}; repHas = false; }
    // fumée (opaque), étincelles, ondes
    if (!A.reduceFx && !rf) {
      ctx.save();
      for (let i = puffs.length - 1; i >= 0; i--) { const q = puffs[i], tt = (now - q.born) / q.life; if (tt >= 1) { puffs.splice(i, 1); continue; } q.x += q.vx * kdt; q.y += q.vy * kdt; q.vx *= 0.96; q.vy *= 0.97; ctx.globalAlpha = (1 - tt) * 0.5; ctx.fillStyle = 'rgb(' + q.col + ')'; ctx.beginPath(); ctx.arc(q.x, q.y, q.r0 + tt * 8, 0, Math.PI * 2); ctx.fill(); }
      if (!(snap && snap.gs === 'lobby')) for (let i = sparks.length - 1; i >= 0; i--) { const q = sparks[i], tt = (now - q.born) / q.life; if (tt >= 1) { sparks.splice(i, 1); continue; } q.x += q.vx * kdt; q.y += q.vy * kdt; q.vx *= 0.94; q.vy = q.vy * 0.94 + 0.05 * kdt; ctx.globalAlpha = 1 - tt; ctx.fillStyle = q.c; const z = 2.4 * (1 - tt * 0.5); ctx.fillRect(q.x - z / 2, q.y - z / 2, z, z); }
      for (let i = waves.length - 1; i >= 0; i--) { const q = waves[i], tt = (now - q.born) / q.life; if (tt >= 1) { waves.splice(i, 1); continue; } if (tt < 0) continue; const e = 1 - (1 - tt) * (1 - tt); ctx.globalAlpha = 0.7 * (1 - tt); ctx.strokeStyle = 'rgb(' + q.col + ')'; ctx.lineWidth = q.lw * (1 - tt * 0.6); ctx.beginPath(); ctx.arc(q.x, q.y, q.r0 + (q.r1 - q.r0) * e, 0, Math.PI * 2); ctx.stroke(); }
      ctx.restore();
    } else if (!rf) { puffs.length = 0; sparks.length = 0; waves.length = 0; }
    // étoiles « BAOUM ! » des explosions en direct + éclat blanc sur la victime (260 ms)
    if (!rf) for (let i = booms.length - 1; i >= 0; i--) {
      const b = booms[i], t = (now - b.born) / 1300;
      if (t >= 1) { booms.splice(i, 1); continue; }
      if (!A.reduceFx && t * 1300 < 260) drawFlash(ctx, b.x, b.y, PR * 2.2, t * 1300 / 260);
      drawBoomStar(b.x, b.y, t, b.seat, false);
    }
    ctx.restore();                                          // fin de la caméra de duel
    // étalonnage jour → crépuscule par-dessus la nappe : seulement au duel final (débord de 24 u : la secousse ne découvre pas de bord clair)
    let duskT = 0;
    if (snap && (snap.gs === 'play' || snap.gs === 'paused' || snap.gs === 'over')) duskT = rf ? duskV : DUEL.t(snap, now, duelAnnonce);   // ralenti : on garde la nuit déjà tombée
    duskV += (duskT - duskV) * Math.min(1, 0.04 * kdt);
    if (duskV < 0.002) duskV = 0;
    crepuscule(ctx, -24, -24, AR + 48, AR + 48, duskV, { soleil: 'haut', force: A.contrast ? 0.45 : A.reduceFx ? 0.55 : 1 });
    if (dangerK > 0) drawDanger(ctx, AR, AR, dangerK * (A.contrast ? 0.9 : 0.6), A.reduceFx ? 0 : now);   // vignette de danger (fixe sous « réduire les effets » : le pouls dépend de `now`)
    // tic-tac : cadence = chaleur de la patate la plus chaude ; rien en ralenti, en pause ni hors manche
    if (!rf && snap && snap.gs === 'play' && pts.length) ticTac(now, hm, hmx); else if (!rf) tickNext = 0;

    // jauge de sprint du joueur local + états actifs. Bloc HUD mis à l'échelle autour de son ancrage (bas-centre) pour rester
    // lisible sur téléphone (hudK) ; textes ≥ 9 px CSS (readable) ; les indications clavier n'apparaissent pas sur écran tactile.
    const me = (snap && mySeat >= 0) ? snap.players[mySeat] : null;
    if (me && me.playing && me.alive && snap.gs === 'play' && !rf) {
      const bw = 150, bh = 10, y = -12;
      const k = Math.min(hudK(cv, AR), AR * 0.94 / (bw + 8)), fs = readable(10, cv, AR / k, 9), fnt = 'bold ' + fs.toFixed(1) + 'px system-ui, sans-serif';
      ctx.save(); ctx.translate(c, AR - 12); ctx.scale(k, k);
      const x = -bw / 2, v = me.tb ? 1 : me.sta, col = me.tb ? '#ffb347' : me.ess ? '#e8413a' : '#7ae8ff';
      ctx.fillStyle = 'rgba(30,26,18,0.72)'; ctx.fillRect(x - 2, y - 2, bw + 4, bh + 4);
      ctx.fillStyle = v >= 1 || me.tb ? col : me.ess ? '#e8413a' : 'rgba(251,243,222,0.55)'; ctx.fillRect(x, y, bw * Math.max(0, Math.min(1, v || 0)), bh);
      if (me.spr && !A.reduceFx) { ctx.save(); ctx.globalAlpha = 0.3 + 0.25 * Math.sin(now / 60); ctx.fillStyle = '#fff'; ctx.fillRect(x, y, bw, bh); ctx.restore(); }
      ctx.strokeStyle = A.contrast ? '#fff' : 'rgba(251,243,222,0.6)'; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, bw - 1, bh - 1);
      ctx.fillStyle = v >= 1 || me.tb ? col : 'rgba(251,243,222,0.78)'; ctx.font = fnt; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.fillText(me.tb ? 'TURBO' : me.ess ? 'ESSOUFFLÉ' : (TOUCH ? 'SPRINT' : 'SPRINT (Maj)'), 0, y - 3);
      const tags = []; if (me.hp) tags.push(['PATATE !', '#e8563f']); if (me.sh) tags.push(['BOUCLIER', PU[0].c]); if (me.tb) tags.push(['TURBO', PU[1].c]); if (me.imm && !me.hp) tags.push(['PROTÉGÉ', '#8fb8d8']);
      if (tags.length) {
        ctx.font = fnt; const th = fs + 5, ws = tags.map(t => ctx.measureText(t[0]).width + 14), tot = ws.reduce((s, w) => s + w + 6, -6), ty = y - 18 - th; let xx = -tot / 2;
        tags.forEach((t, i) => { ctx.fillStyle = K.cream; ctx.fillRect(xx, ty, ws[i], th); ctx.fillStyle = t[1]; ctx.fillRect(xx, ty, 3, th); ctx.fillStyle = K.ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t[0], xx + ws[i] / 2 + 1, ty + th / 2 + 0.5); xx += ws[i] + 6; });
      }
      ctx.restore();
    }
    // consigne du porteur : en haut, bien visible tant qu'on tient la patate
    if (me && me.playing && me.alive && me.hp && snap.gs === 'play' && !rf) {
      const f1 = readable(15, cv, AR, 12), txt = teamMode ? 'TOUCHE UN ADVERSAIRE !' : 'TOUCHE QUELQU\'UN !';
      ctx.save(); ctx.font = f1.toFixed(1) + 'px ' + DISP; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
      const pul = A.reduceFx ? 1 : 1 + 0.05 * Math.sin(now / 110), ty = 26 + f1 * 0.3; ctx.translate(c, ty); ctx.scale(pul, pul);
      const tw = ctx.measureText(txt).width + 28; ctx.fillStyle = 'rgba(200,40,28,0.92)'; ctx.fillRect(-tw / 2, -f1 * 0.8, tw, f1 * 1.6); ctx.strokeStyle = K.cream; ctx.lineWidth = 2; ctx.strokeRect(-tw / 2, -f1 * 0.8, tw, f1 * 1.6);
      ctx.fillStyle = K.cream; ctx.fillText(txt, 0, 1); ctx.restore();
    }

    if (snap && snap.gs === 'countdown') {
      ctx.fillStyle = 'rgba(20,34,12,0.3)'; ctx.fillRect(0, 0, AR, AR); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const n = snap.count || 0, pulse = A.reduceFx ? 1 : 1 + 0.07 * Math.sin(now / 110);
      ctx.save(); ctx.translate(c, c - 6); ctx.scale(pulse, pulse);
      ctx.fillStyle = 'rgba(251,243,222,0.94)'; ctx.beginPath(); ctx.arc(0, 0, 62, 0, Math.PI * 2); ctx.fill();          // disque de nappe
      ctx.strokeStyle = K.tomato; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(0, 0, 62, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (n > 0 ? n / 3 : 1)); ctx.stroke();
      ctx.fillStyle = K.ink; ctx.font = (n > 0 ? 76 : 40) + 'px ' + DISP; ctx.fillText(n > 0 ? n : 'GO !', 0, 4);
      ctx.restore();
      const fsub = readable(14, cv, AR, 10);
      ctx.lineJoin = 'round'; ctx.font = 'bold ' + fsub.toFixed(1) + 'px system-ui, sans-serif'; ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(20,34,12,0.85)';
      const sub = n > 0 ? 'Attention, la patate arrive…' : 'Refile-la !', sy = c + 72 + fsub * 0.45; ctx.strokeText(sub, c, sy); ctx.fillStyle = K.cream; ctx.fillText(sub, c, sy);
    }
    if (snap && (snap.gs === 'lobby' || snap.gs === 'paused')) {
      ctx.fillStyle = 'rgba(10,24,6,0.6)'; ctx.fillRect(0, 0, AR, AR); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      if (snap.gs === 'paused') {
        const fp = readable(14, cv, AR, 10);
        ctx.fillStyle = K.cream; ctx.font = '40px ' + DISP; ctx.fillText('PAUSE', c, c - 8);
        ctx.fillStyle = A.contrast ? K.cream : 'rgba(251,243,222,.78)'; ctx.font = fp.toFixed(1) + 'px system-ui, sans-serif'; ctx.fillText(TOUCH ? 'La patate attend — touche ▶ pour reprendre' : 'La patate attend — P / Échap pour reprendre', c, c + 24 + fp * 0.45);
      } else {
        drawTitle(c, c - 64, now);
        const n = snap.connected || 0, nb = snap.botCount || 0, tot = n + nb, y0 = c + 70, f1 = readable(15, cv, AR, 10), f2 = readable(13, cv, AR, 10);
        ctx.fillStyle = teamMode ? '#ffd9a8' : (A.contrast ? K.cream : 'rgba(251,243,222,.82)'); ctx.font = f1.toFixed(1) + 'px system-ui, sans-serif';
        ctx.fillText(`${n} joueur${n > 1 ? 's' : ''}${nb ? ' + ' + nb + ' bot' + (nb > 1 ? 's' : '') : ''}${teamMode ? ' · ' + (MODE_NAME[snap.mode] || snap.mode) : ''}`, c, y0);
        const vis = !!(snap.opt && snap.opt.fuse === 'visible'), bon = !snap.opt || snap.opt.bonus !== 0;
        ctx.fillStyle = A.contrast ? K.cream : 'rgba(251,243,222,.66)'; ctx.font = f2.toFixed(1) + 'px system-ui, sans-serif'; ctx.fillText('🧨 mèche ' + (vis ? 'visible' : 'cachée') + ' · 🎁 bonus ' + (bon ? 'oui' : 'non'), c, y0 + Math.max(20, (f1 + f2) * 0.6));
        ctx.fillStyle = A.contrast ? K.cream : 'rgba(251,243,222,.78)'; ctx.font = 'bold ' + f2.toFixed(1) + 'px system-ui, sans-serif';
        ctx.fillText(tot >= 2 ? (TOUCH ? '▶ Touche l\'écran pour lancer la patate' : '▶ Espace / clic pour lancer la patate') : 'En attente d\'un 2ᵉ joueur… (ou ajoute un bot 🤖)', c, y0 + Math.max(42, (f1 + f2) * 1.15));
      }
      if (!A.reduceFx && snap.gs === 'lobby') {                 // étincelles de la mèche du titre : dessinées ici (hors caméra, le lobby n'en a pas)
        for (let i = sparks.length - 1; i >= 0; i--) { const q = sparks[i], tt = (now - q.born) / q.life; if (tt >= 1) { sparks.splice(i, 1); continue; } q.x += q.vx * kdt; q.y += q.vy * kdt; ctx.globalAlpha = 1 - tt; ctx.fillStyle = q.c; ctx.fillRect(q.x - 1.2, q.y - 1.2, 2.4, 2.4); }
        ctx.globalAlpha = 1;
      }
    }
    if (!rf && snap && snap.gs === 'over' && endShown && !homeChoice) drawPodiumScene(now);   // podium : après le ralenti éventuel, sous la carte DOM qui se cale en dessous
    if (rf) RL.drawOverlay(ctx, AR, AR, now, A);             // ralenti : bandes cinéma, « ⟲ RALENTI », barre de progression (en dernier)
    if (!rf) CALL.draw(ctx, AR, AR, now, A);                 // « DOUBLÉ ! / TRIPLÉ ! / IN EXTREMIS ! » (fondu conservé sous « réduire les effets », sans l'animation d'échelle)
  }
  function drawLoop() { if (destroyed) return; try { draw(); } catch (e) { console.error('[render]', e); } rafId = requestAnimationFrame(drawLoop); }   // filet : une erreur de rendu ne fige plus le jeu

  // ───────────────────────── entrées ─────────────────────────
  function pushInput() { send({ t: 'input', up: input.up, down: input.down, left: input.left, right: input.right }); }
  function setIn(k, v) { if (input[k] === v) return; input[k] = v; pushInput(); }   // n'envoie qu'aux CHANGEMENTS
  function sprint(on) { if (on === sprintOn) return; sprintOn = on; send({ t: 'sprint', on }); }
  const isPlay = () => snap && (snap.gs === 'play' || snap.gs === 'paused');
  const isShift = e => e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.key === 'Shift';
  const onKeyDown = e => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
    unlockAudio();
    if (e.repeat) return;                                 // la répétition auto renvoyait les mêmes touches
    if (e.key === ' ' && (pendingEnd || RL.active(performance.now()))) { RL.skip(); return; }   // le PREMIER Espace pendant le ralenti le passe, sans lancer « Rejouer »
    if (e.key === ' ') { if (snap && (snap.gs === 'lobby' || snap.gs === 'over')) send({ t: 'start' }); return; }   // start seulement hors partie
    if (isShift(e)) { sprint(true); return; }
    if ((e.key === 'p' || e.key === 'P' || e.key === 'Escape') && isPlay()) { send({ t: 'pause' }); return; }
    const d = Object.prototype.hasOwnProperty.call(DIR_KEYS, e.code) ? DIR_KEYS[e.code] : null; if (d) setIn(d, true);
  };
  const onKeyUp = e => {
    if (isShift(e)) { sprint(false); return; }
    const d = Object.prototype.hasOwnProperty.call(DIR_KEYS, e.code) ? DIR_KEYS[e.code] : null; if (d) setIn(d, false);
  };
  const onBlur = () => { let ch = false; for (const k in input) if (input[k]) { input[k] = false; ch = true; } if (ch) pushInput(); sprint(false); };   // fenêtre quittée : plus de touche ni de sprint « collés »
  // boutons maintenus : le joystick d'app.js les actionne par événements synthétiques (pas de setPointerCapture)
  function hold(id, k) { const el = $(id); if (!el) return; const on = e => { e.preventDefault(); unlockAudio(); setIn(k, true); }; const off = e => { e.preventDefault(); setIn(k, false); }; el.addEventListener('pointerdown', on); el.addEventListener('pointerup', off); el.addEventListener('pointerleave', off); el.addEventListener('pointercancel', off); }
  function holdFn(id, fn) { const el = $(id); if (!el) return; const on = e => { e.preventDefault(); unlockAudio(); fn(true); }, off = e => { e.preventDefault(); fn(false); }; el.addEventListener('pointerdown', on); el.addEventListener('pointerup', off); el.addEventListener('pointerleave', off); el.addEventListener('pointercancel', off); }

  // Les boutons du DOM sont STATIQUES et le module est un singleton (import() en cache) : init() est
  // rappelé à chaque retour sur le jeu. Sans ce drapeau, chaque retour rebranchait les écouteurs sans
  // débrancher les précédents — après k retours, un appui partait k fois.
  // Leurs gestionnaires lisent l'état COURANT du module (send, snap…) : les brancher une fois suffit.
  let cable = false;
  function init(ctx0) {
    const premiere = !cable; cable = true;
    destroyed = false;              // module singleton réutilisé : réarmer la boucle de rendu après un précédent teardown
    A = ctx0.a11y; send = ctx0.send; root = ctx0.root;
    if (ctx0.togglePanel) togglePanel = ctx0.togglePanel; if (ctx0.closePanels) closePanels = ctx0.closePanels;
    cv = $('ptc'); ctx = cv.getContext('2d'); hud = $('ptHud'); endEl = $('ptEnd');
    bodyCache = {}; potCache = {}; decorKey = '';  // les dégradés en cache appartiennent au contexte : on repart propre
    const wrap = cv.parentElement;                                                  // cadre du canvas : support des bandeaux de message
    initGameMsg(wrap && wrap.classList.contains('canvas-wrap') ? wrap : null);
    hud.innerHTML = '';             // module réutilisé : repartir d'un HUD vide (sinon les cartes P1.. se cumulent à chaque retour)
    cards = Array.from({ length: MAX_SEATS }, (_, i) => i).map(i => { const el = document.createElement('div'); el.className = 'pc hidden'; el.innerHTML = `<div class="dot"></div><div class="inf"><div class="pn">P${i + 1}</div><div class="lv"></div></div>`; hud.appendChild(el); return el; });
    matchChip = document.createElement('div'); matchChip.className = 'mchip'; matchChip.style.cssText = 'grid-column:1/-1;display:none;text-align:center;font-weight:800;font-size:12px;color:#ffd24a;-webkit-user-select:none;user-select:none';
    hud.insertBefore(matchChip, hud.firstChild);          // chip « 🏆 Premier à 3 · manche 2 » (visible pendant un match seulement)
    startBtn = $('ptStart'); pauseBtn = $('ptPause'); modeBtn = $('ptMode'); botsBtn = $('ptBots'); diffBtn = $('ptDiff'); fuseBtn = $('ptFuse'); bonusBtn = $('ptBonus'); pauseFloat = $('ptPauseFloat');
    lbBtn = $('ptLbBtn'); lbPanel = $('ptLbPanel'); lbBody = $('ptLbBody'); sprintBtn = $('ptSprint');
    matchBtn = boutonMatch(root.querySelector('.bar'), send);   // « 🏆 Manche simple / Premier à N » (game master, lobby / fin de manche)
    startBtn.onclick = () => { unlockAudio(); send({ t: 'start' }); };
    pauseBtn.onclick = () => send({ t: 'pause' });
    pauseFloat.onclick = () => send({ t: 'pause' });
    modeBtn.onclick = () => send({ t: 'mode' });
    if (botsBtn) botsBtn.onclick = () => send({ t: 'bots' });
    if (diffBtn) diffBtn.onclick = () => send({ t: 'botdiff' });
    if (fuseBtn) fuseBtn.onclick = () => send({ t: 'fuse' });
    if (bonusBtn) bonusBtn.onclick = () => send({ t: 'bonus' });
    lbBtn.onclick = () => { togglePanel(lbPanel); renderLB(); };
    const helpBtn = $('ptHelp'), helpPanel = $('ptHelpPanel'); if (helpBtn && helpPanel) helpBtn.onclick = () => togglePanel(helpPanel);
    if (premiere) {                                       // le PREMIER appui pendant le ralenti le passe seulement : ni « Rejouer » ni aucune autre action (phase de capture, avant les boutons)
      root.addEventListener('pointerdown', e => { if (pendingEnd || RL.active(performance.now())) { RL.skip(); eatUntil = performance.now() + 700; e.stopPropagation(); } }, true);
      root.addEventListener('click', e => { if (eatUntil && performance.now() < eatUntil) { eatUntil = 0; e.stopPropagation(); e.preventDefault(); } }, true);
    }
    if (premiere) cv.addEventListener('click', () => { unlockAudio(); if (snap && !isPlay() && snap.gs !== 'countdown') send({ t: 'start' }); });
    if (premiere) endEl.addEventListener('click', () => { unlockAudio(); send({ t: 'start' }); });
    if (premiere) { hold('ptUp', 'up'); hold('ptDown', 'down'); hold('ptLeft', 'left'); hold('ptRight', 'right'); holdFn('ptSprint', sprint); }
    applyColors();
    resizeH = resizeCanvas; addEventListener('resize', resizeH); resizeCanvas();
    addEventListener('keydown', onKeyDown); addEventListener('keyup', onKeyUp); addEventListener('blur', onBlur);
    music.dispose(); music = createMusic(() => actx, () => A, MUSIC_THEME);   // instance neuve à chaque entrée (la précédente a été « disposée » au teardown)
    music.start();
    if (staleInput) { staleInput = false; pushInput(); send({ t: 'sprint', on: false }); }   // une touche / le sprint était tenu quand on a quitté le jeu : le siège reçoit « tout relâché » (on est bien dans la Patate ici)
    STREAK.reset(); goT0 = -1e9; tickNext = 0; myHot = false; tossOf.fill(null); joltAt.fill(-1e9); holdMsgAt = -1e9;
    RL.clear(); CAM.reset(); pendingEnd = null; repOut = {}; repHas = false; endPod = false; layoutEnd();   // ralenti / caméra / podium repartent à neuf
    rafId = requestAnimationFrame(drawLoop);
  }
  function onA11y() { applyColors(); if (A.reduceFx) RL.skip(); }   // « réduire les effets » activé pendant un ralenti : on le coupe
  function teardown() {
    destroyed = true; EF.accueil(); homeChoice = false; music.dispose(); music = NOMUSIC;   // EF.accueil : retire body.fin (la page ne doit pas rester en fin de manche dans un autre jeu)
    cancelAnimationFrame(rafId); J.fin(); LUM.vider();   // retour au jeu : journal repris à neuf
    removeEventListener('resize', resizeH); removeEventListener('keydown', onKeyDown); removeEventListener('keyup', onKeyUp); removeEventListener('blur', onBlur);
    // touches et sprint relâchés côté client SANS rien envoyer maintenant (le hub a peut-être déjà changé de jeu : un « input » partirait vers un autre jeu) ;
    // si l'un était tenu, staleInput fait renvoyer l'état « tout relâché » au prochain init() de la Patate chaude
    for (const k in input) if (input[k]) { input[k] = false; staleInput = true; }
    if (sprintOn) { sprintOn = false; staleInput = true; }
    // audio : le contexte est fermé (il ne reste pas actif en arrière-plan, et iOS limite le nombre de contextes) ; unlockAudio() en recrée un au prochain geste
    if (actx) { const c0 = actx; actx = null; noiseBuf = null; try { const pr = c0.close(); if (pr && pr.catch) pr.catch(() => {}); } catch {} }
    resetRound(); tossOf.fill(null); snap = null; decorCv = null; decorKey = '';
  }

  return { init, onState, onMessage, onLb, onA11y, teardown };
})();
