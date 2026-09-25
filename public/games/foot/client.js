// Module client FOOT : terrain polygonal vu de dessus (une cage par ÉQUIPE, comme les raquettes de Pong),
// un seul ballon, 30 Hz interpolés. Structure calquée sur le Sumo (HUD, écran de fin, décor pré-rendu,
// câblage unique des écouteurs). Identité « Stade de nuit » déclinée en 5 terrains : stade (pelouse tondue),
// boue (pluie, flaques), glace (patinoire), flipper (arcade néon, bumpers), tempête (plage, sable, vent).
import { AR0, MARGE, PR, BR, POST_R, GOAL0, TERRAINS, ITEMS } from './shared.js';
import { createMusic } from '../../music.js';
import { seatPattern, SEAT_GLYPH } from '../../patterns.js';   // motif par siège, imprimé sur le maillot
import { initGameMsg, msgPerso, msgGlobal } from '../../gamemsg.js';
import { arenaSize } from '../../layout.js';
import { lumiere, creerLumieres } from '../../lumiere.js';      // projecteurs, ballon frappé, buts, bumpers
import { crepuscule, creerDuel } from '../../crepuscule.js';
import { creerJournal, blocFin } from '../../finpartie.js';     // courbe des vies + meilleure action

const DUEL = creerDuel(), duelAnnonce = () => msgGlobal('⚔', 'Duel final !', { color: '#ff5a3c' });

// musique de tribune : majeur franc, grosse caisse « olé », cuivres en tierces ; climax = tambours serrés
const MUSIC_THEME = { bpm: 118, bpmBoost: 14, vol: 0.5, root: 98, len: 32,
  stingers: { kill: { notes: [12, 7, 4, 0], wave: 'square', oct: 1, gain: 0.035, dur: 0.2, rate: 0.08 },
    win: { base: 392, notes: [[0, 4, 7], [5, 9, 12], [7, 11, 14], [12, 16, 19]], gain: 0.035, dur: 0.4, rate: 0.15 },
    count: { notes: [0], oct: 2, wave: 'square', dur: 0.12, gain: 0.035, duck: false }, go: { notes: [[0, 4, 7, 12]], oct: 2, wave: 'square', dur: 0.45, gain: 0.04, duck: false },
    alert: { notes: [0, 4, 7, 12, 7, 12, 16], oct: 1, wave: 'square', rate: 0.07, dur: 0.14, gain: 0.03 } },
  layers: [
  { seq: [[0, 7], null, null, null, null, null, null, null, [5, 12], null, null, null, null, null, null, null, [7, 14], null, null, null, null, null, null, null, [0, 7], null, null, null, [7, 11], null, null, null], wave: 'triangle', gain: 0.018, dur: 3.5 },
  { drums: 'K...K...K.K.K...K...K...K.KKS...', gain: 0.9, min: 1 },                                                 // grosse caisse de tribune
  { seq: [12, null, 16, null, 19, null, 16, null, 12, null, null, null, 14, null, 12, null, 11, null, 14, null, 19, null, 14, null, 12, null, null, null, null, null, null, null], wave: 'square', gain: 0.012, dur: 0.22, min: 1 },   // « olé olé »
  { drums: 'K.K.S.K.K.K.S.K.K.K.S.K.KKK.S.S.', gain: 0.8, min: 2 },
  { seq: [0, 4, 7, 12, 7, 4, 0, 4], oct: 1, wave: 'square', gain: 0.01, dur: 0.18, min: 2 },
] };

const PAL = { normal: ['#4a9ee0', '#e06240', '#f2d23a', '#9b6cf0', '#e268b0', '#25c9c0', '#ff9c3a', '#9ec93a', '#d06ef0', '#f2f0e6'],
              cb: ['#0072B2', '#E69F00', '#F0E442', '#CC79A7', '#56B4E9', '#009E73', '#D55E00', '#F5F5F5', '#7B68EE', '#9A9A9A'] };
const TEAMPAL = { normal: ['#4a9ee0', '#e06240', '#f2d23a', '#9b6cf0', '#e268b0'], cb: ['#0072B2', '#E69F00', '#F0E442', '#CC79A7', '#56B4E9'] };
const TEAM_LETTER = ['A', 'B', 'C', 'D', 'E'];
const MODE_NAME = { ffa: 'Chacun pour soi', '2v2': '2 v 2', '2v2v2': '2 v 2 v 2', '3v3': '3 v 3', '4v4': '4 v 4', '2v2v2v2': '2 v 2 v 2 v 2', '3v3v3': '3 v 3 v 3', '5v5': '5 v 5', '2v2v2v2v2': '2 v 2 v 2 v 2 v 2' };
const MAX_SEATS = 10, TEAM_TOTALS = [4, 6, 8, 9, 10], TICK_HZ = 30;
const DIFF_NAMES = ['Facile', 'Normale', 'Difficile'];
const K = { night: '#08140f', chalk: '#f2f6ee', amber: '#ffc24a', red: '#e8413a', ink: '#0b1510', gold: '#ffd24a' };
const DISP = "'Russo One', Impact, sans-serif";
const SKIN = [[241, 196, 160], [214, 160, 118], [168, 112, 78], [120, 78, 52]];   // teintes de peau, attribuées par siège
const HAIR = ['#2a1a10', '#6b3e1e', '#c99a4a', '#141414', '#8a4a22', '#e0c070', '#3a2414', '#1d1d1d', '#a0522d', '#4a2c18'];
// ZQSD / WASD / flèches : codes PHYSIQUES (KeyW = touche Z en AZERTY) + KeyZ/KeyQ pour un clavier réglé en QWERTY
const DIR_KEYS = { ArrowUp: 'up', KeyW: 'up', KeyZ: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', KeyQ: 'left', ArrowRight: 'right', KeyD: 'right' };
// Terrains : habillage (surface, bandes, craie, bords) — l'effet de jeu est côté serveur
const TER_LOOK = {
  stade:   { nom: 'Stade', i: '🏟', a: '#2e8b3e', b: '#34994a', line: 'rgba(242,246,238,0.85)', edge: '#153322', grain: 'rgba(170,230,150,0.08)' },
  boue:    { nom: 'Boue', i: '🌧', a: '#3d6a30', b: '#44733a', line: 'rgba(230,226,210,0.7)', edge: '#1f2a18', grain: 'rgba(90,60,30,0.12)' },
  glace:   { nom: 'Patinoire', i: '⛸', a: '#d6ecf7', b: '#e3f3fb', line: 'rgba(45,127,208,0.85)', edge: '#f4f8fb', grain: 'rgba(255,255,255,0.35)' },
  flipper: { nom: 'Flipper', i: '🕹', a: '#150b2c', b: '#1a0f36', line: 'rgba(255,79,216,0.9)', edge: '#3a1f7a', grain: 'rgba(120,80,255,0.08)' },
  tempete: { nom: 'Tempête', i: '🌪', a: '#dcc389', b: '#e4cc93', line: 'rgba(255,255,255,0.75)', edge: '#8a7446', grain: 'rgba(140,110,60,0.12)' },
};
const TER_DESC = { stade: 'Pelouse classique, sans effet', boue: 'Flaques où l\'on s\'enlise, ballon freiné, murs amortis', glace: 'On glisse, le ballon file, les bandes rebondissent',
  flipper: 'Bumpers qui relancent le ballon, murs élastiques', tempete: 'Vent tournant qui pousse le ballon, bancs de sable', hasard: 'Un terrain tiré au sort à chaque manche' };
// Objets : 3 bonus (pour soi) puis 3 malus (pour les adversaires) — libellés constants, jamais une chaîne venue du réseau
const IT_LOOK = {
  turbo: { nom: 'Turbo', i: '⚡', c: '#ffd24a', bonus: 1, msg: 'Turbo : sprint illimité et +15 % de vitesse (8 s)', desc: 'sprint illimité et +15 % de vitesse (8 s)' },
  canon: { nom: 'Canon', i: '💥', c: '#ff7a2f', bonus: 1, msg: 'Canon : tes 2 prochains tirs partent à pleine puissance', desc: '2 tirs à pleine puissance, sans dispersion' },
  mur: { nom: 'Mur', i: '🧱', c: '#e0864a', bonus: 1, msg: 'Mur : ta cage rétrécit de moitié (10 s)', desc: 'sa cage rétrécit de moitié (10 s)' },
  geante: { nom: 'Cage géante', i: '🥅', c: '#b06cff', bonus: 0, msg: 'Cages adverses agrandies (8 s)', desc: 'cages adverses +60 % (8 s)', sub: 'Ta cage s\'agrandit (8 s) !' },
  glu: { nom: 'Glu', i: '🍯', c: '#7bd14a', bonus: 0, msg: 'Adversaires englués (5 s)', desc: 'adversaires ralentis, sans sprint (5 s)', sub: 'Englué : ralenti, sans sprint (5 s)' },
  inverse: { nom: 'Inversion', i: '🔀', c: '#ff4fd8', bonus: 0, msg: 'Commandes des adversaires inversées (4 s)', desc: 'commandes adverses inversées (4 s)', sub: 'Commandes inversées (4 s) !' },
};
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function hexRgb(h) { const n = parseInt(String(h).slice(1, 7), 16) || 0; return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function rgbStr(c, a) { return a == null ? `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})` : `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`; }
function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
// ellipse maison (scale + arc) : ctx.ellipse est absent/instable sur les vieux Safari
function oval(g, x, y, rx, ry) { g.save(); g.translate(x, y); g.scale(rx, ry); g.moveTo(1, 0); g.arc(0, 0, 1, 0, Math.PI * 2); g.restore(); }

export default (function () {
  let A, send, root, cv, ctx, togglePanel = () => {}, closePanels = () => {};
  let CC = PAL.normal, TEAMCC = TEAMPAL.normal;
  let mySeat = -1, snap = null, prevGs = 'lobby', teamMode = false, endShown = false, inGamePrev = false, prevRound = -1, lastCount = -1, prevSd = false;
  let board = [], buf = [];
  let AR = AR0, G = null, GC = { x: AR0 / 2, y: AR0 / 2 }, geoKey = '', formeKey = '', terId = 'stade', znRef = null, znVer = 0;
  const puffs = [], waves = [], sparks = [], confs = [], texts = [], drops = [];
  let shakeMag = 0, rafId = 0, destroyed = false, resizeH = null, actx = null, noiseBuf = null, lastFrame = 0;
  let ballSpin = 0, ballPrev = null, trail = [], netHit = {}, lastKill = 0, bumpFlash = {};
  const LUM = creerLumieres(24), J = creerJournal({ pas: 500 });
  let duskV = 0, sdT0 = 0, jRound = -1, jLast = -1e9, serie = {};
  const music = createMusic(() => actx, () => A, MUSIC_THEME);
  const input = { up: false, down: false, left: false, right: false };
  let hud, cards, startBtn, pauseBtn, modeBtn, botsBtn, diffBtn, livesBtn, optBtn, optPanel, pauseFloat, lbBtn, lbPanel, lbBody, endEl, shootBtn, tackleBtn, sprintBtn;
  const runPhase = {};                                  // par siège : phase de course (animation des jambes)

  const $ = id => root.querySelector('#' + id);
  const colSeat = s => { if (s < 0 || !snap) return '#fff'; const p = snap.players[s]; return teamMode && p ? TEAMCC[p.team % TEAMCC.length] : CC[s % CC.length]; };
  const nameOf = s => { const p = snap && snap.players[s]; return p ? (p.name || ('P' + (s + 1))) : '?'; };
  // une cage appartient à une ÉQUIPE (en chacun pour soi : une équipe d'un joueur) ; s = siège représentant de la cage
  const cageNom = s => { const p = snap && snap.players[s]; return teamMode && p ? 'Équipe ' + (TEAM_LETTER[p.team] || '?') : nameOf(s); };
  const maCage = f => { const me = snap && mySeat >= 0 ? snap.players[mySeat] : null, v = snap && snap.players[f.seat]; if (!me || !me.playing) return false; return f.team != null ? me.team === f.team : !!(v && v.team === me.team); };
  const LOOK = () => TER_LOOK[terId] || TER_LOOK.stade;
  function applyColors() { CC = PAL[A.palette] || PAL.normal; TEAMCC = TEAMPAL[A.palette] || TEAMPAL.normal; decorKey = ''; if (A.reduceFx) LUM.vider(); }

  function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1, size = arenaSize({ max: 760 });
    cv.style.width = size + 'px'; cv.style.height = size + 'px';
    cv.width = Math.round(size * dpr); cv.height = Math.round(size * dpr);
  }

  // ───────────────────────── géométrie reçue du serveur ─────────────────────────
  function syncGeo(m) {
    if (!m.geo || !m.geo.e) return;
    const key = AR + '|' + JSON.stringify(m.geo.c) + '|' + JSON.stringify(m.geo.e);
    if (key === geoKey) return;
    geoKey = key;
    formeKey = AR + '|' + JSON.stringify(m.geo.c) + '|' + JSON.stringify(m.geo.e.map(a => a.slice(0, 6)));   // sans la largeur des cages (bonus/malus)
    GC = m.geo.c ? { x: m.geo.c[0], y: m.geo.c[1] } : { x: AR / 2, y: AR / 2 };
    G = m.geo.e.map(a => {
      const ax = a[0], ay = a[1], bx = a[2], by = a[3], dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1;
      const mx = (ax + bx) / 2, my = (ay + by) / 2; let nx = GC.x - mx, ny = GC.y - my; const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl;
      return { ax, ay, bx, by, tx: dx / len, ty: dy / len, nx, ny, len, mx, my, apo: nl, owner: a[4], open: !!a[5], k: a[6] || 1 };
    });
  }
  const halfW = e => Math.min(e.len / 2 - POST_R * 4, e.len * ((snap && snap.gw) || GOAL0) / 2 * e.k);
  const ownerAlive = e => e.open && e.owner >= 0 && snap && snap.players[e.owner] && snap.players[e.owner].alive;

  // ───────────────────────── HUD, classement, écran de fin ─────────────────────────
  const vies = (n, tot) => { let s = ''; for (let i = 0; i < tot; i++) s += i < n ? '●' : '○'; return s; };
  function refreshHUD() {
    if (!snap) return;
    const tot = snap.lives || 3;
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
      const glyph = SEAT_GLYPH[i % SEAT_GLYPH.length];
      cards[i].querySelector('.pn').innerHTML = `${(window.__AV && window.__AV(p.name)) || ''}<span class="sg" style="opacity:.8">${glyph}</span> ${esc(p.name || ('P' + (i + 1)))} <span class="sc">${p.goals | 0} ⚽</span> ${tags.join('')}`;
      const lv = cards[i].querySelector('.lv'); lv.style.color = col;
      if (!p.playing) { lv.textContent = 'prêt'; return; }
      if (!p.alive) { lv.textContent = p.elimBy >= 0 && p.elimBy !== i ? '✖ éliminé par ' + nameOf(p.elimBy) : '✖ éliminé'; return; }
      if (p.dn) { lv.textContent = vies(p.lives | 0, tot) + ' · à terre'; return; }
      const st = [vies(p.lives | 0, tot)];
      if (snap.ball && snap.ball.o === i) st.push('⚽ au pied');
      st.push(p.tk ? '👟 TACLE !' : p.tcd >= 1 ? '👟 prêt' : '👟 ' + Math.round((p.tcd || 0) * 100) + '%');
      if (p.st) st.push('💫'); if (p.tb) st.push('⚡'); if (p.cn) st.push('💥×' + (p.cn | 0)); if (p.gl) st.push('🍯'); if (p.iv) st.push('🔀');
      lv.textContent = st.join(' · ');
    });
  }
  function renderLB() {
    if (!lbBody) return;
    if (!board.length) { lbBody.innerHTML = '<div class="lbnote">Aucun match enregistré.</div>'; return; }
    lbBody.innerHTML = board.slice().sort((a, b) => (b.wins || 0) - (a.wins || 0) || (b.goals || 0) - (a.goals || 0) || (b.kills || 0) - (a.kills || 0)).map(e =>
      `<div class="lbrow"><span class="lbn">${esc(e.name)}</span><span title="matchs">🎮${e.games || 0}</span><span title="victoires">🏆${e.wins || 0}</span><span title="buts marqués">⚽${e.goals || 0}</span><span title="adversaires éliminés">✖${e.kills || 0}</span>` +
      (e.bestSurvivalSec != null ? `<span title="plus longue tenue">⏱${Math.round(e.bestSurvivalSec || 0)}s</span>` : '') + '</div>').join('');
  }
  function showEndscreen(m) {
    if (m.gs !== 'over' || !m.stats) { endEl.classList.add('hidden'); return; }
    endEl.classList.remove('hidden');
    const parts = m.players.filter(p => p.playing && p.place > 0).slice().sort((a, b) => a.place - b.place || (b.goals | 0) - (a.goals | 0));
    const champ = m.winner >= 0 ? parts.find(p => p.team === m.winner) : null;
    const who = champ ? (teamMode ? 'Équipe ' + (TEAM_LETTER[m.winner] || '?') : esc(champ.name || ('P' + (champ.seat + 1)))) : null;
    const title = champ ? who + ' remporte le match !' : 'Match nul — tout le monde aux tirs au but';
    const medals = ['🥇', '🥈', '🥉'];
    let mvp = null; parts.forEach(p => { if ((p.goals | 0) > 0 && (!mvp || p.goals > mvp.goals || (p.goals === mvp.goals && p.place < mvp.place))) mvp = p; });
    const rows = parts.map(p => {
      const col = colSeat(p.seat), medal = medals[p.place - 1] || ('#' + p.place), sec = Math.round((p.elimTick || 0) / TICK_HZ);
      const res = p.alive ? (champ && p.team === champ.team ? 'vainqueur' : 'encore en lice')
        : (p.elimBy >= 0 && p.elimBy !== p.seat ? `éliminé par ${esc(nameOf(p.elimBy))} à ${sec}s` : `éliminé à ${sec}s`);
      return `<div class="erow ${p.alive ? 'win' : ''}"><span class="eplace">${medal}</span>
        <span class="ename" style="color:${col}">${esc(p.name || ('P' + (p.seat + 1)))}${teamMode ? ` <small>Éq.${TEAM_LETTER[p.team]}</small>` : ''}${mvp && mvp.seat === p.seat ? ' <small>⭐ MVP</small>' : ''}</span>
        <span class="estat" title="buts marqués">⚽ ${p.goals | 0}</span><span class="eres">${res}</span></div>`;
    }).join('');
    const mvpLine = mvp ? `<div class="emeta">⭐ Meilleur buteur : <b style="color:${colSeat(mvp.seat)}">${esc(mvp.name || ('P' + (mvp.seat + 1)))}</b> — ${mvp.goals} but${mvp.goals > 1 ? 's' : ''}</div>` : '';
    endEl.innerHTML = `<div class="etitle" style="color:${champ ? colSeat(champ.seat) : K.chalk}">${title}</div>
      <div class="emeta">⏱ ${m.stats.durationSec}s · ${m.stats.nParts} joueurs · ${LOOK().i} ${LOOK().nom}</div>${mvpLine}<div class="elist">${rows}</div>${jRound === m.round ? blocFin(J, { titre: 'Vies au fil du match', couleur: s => colSeat(s), nom: s => nameOf(s), max: m.lives || 3 }) : ''}<div class="ehint">Espace / clic pour rejouer</div>`;
  }

  // ───────────────────────── panneau « Terrain & bonus » (game master) ─────────────────────────
  function buildOptPanel() {
    const body = $('ftOptBody'); if (!body || body.dataset.ok) return;
    body.dataset.ok = '1';
    let h = '<h4>Terrain</h4><div class="ftTer">';
    for (const id of TERRAINS.concat(['hasard'])) { const L = TER_LOOK[id] || { nom: 'Au hasard', i: '🎲' }; h += `<button class="gm ftTerB" data-ter="${id}" title="${esc(TER_DESC[id])}">${L.i} ${esc(L.nom)}</button>`; }
    h += '</div><div class="note" id="ftTerDesc"></div><h4>Bonus (pour celui qui ramasse)</h4>';
    ITEMS.forEach((k, i) => {
      if (i === 3) h += '<h4>Malus (pour ses adversaires)</h4>';
      const L = IT_LOOK[k];
      h += `<label class="srow"><span>${L.i} <b>${esc(L.nom)}</b> <small style="opacity:.75">— ${esc(L.desc)}</small></span><input type="checkbox" class="switch gm" data-item="${k}"></label>`;
    });
    h += '<div class="note">Réglages du game master, modifiables entre deux manches. Un objet apparaît toutes les 6 s (2 au plus sur le terrain).</div>';
    body.innerHTML = h;
    body.querySelectorAll('[data-ter]').forEach(b => { b.onclick = () => send({ t: 'terrain', v: b.dataset.ter }); });
    body.querySelectorAll('[data-item]').forEach(c => { c.onchange = () => { const on = c.checked; if (document.body.classList.contains('not-gm')) c.checked = !on; send({ t: 'item', k: c.dataset.item, on }); }; });
  }
  function syncOptPanel(m) {
    const body = $('ftOptBody'); if (!body || !m.opt) return;
    const sel = m.opt.ter, it = '' + (m.opt.it || ''), idle = m.gs === 'lobby' || m.gs === 'over';
    body.querySelectorAll('[data-ter]').forEach(b => { b.classList.toggle('on', b.dataset.ter === sel); b.disabled = !idle; });
    body.querySelectorAll('[data-item]').forEach(c => { const i = ITEMS.indexOf(c.dataset.item); c.checked = it.charAt(i) === '1'; c.disabled = !idle; });
    const d = $('ftTerDesc'); if (d) d.textContent = own(TER_DESC, sel) ? TER_DESC[sel] : '';
    if (optBtn) { const L = own(TER_LOOK, sel) ? TER_LOOK[sel] : { i: '🎲', nom: 'Hasard' }; const n = it.split('').filter(c => c === '1').length; optBtn.textContent = L.i + ' ' + L.nom + ' · 🎁 ' + n + '/6'; }
  }

  // ───────────────────────── état réseau ─────────────────────────
  function onMessage(m) { if (m && m.t === 'welcome') mySeat = m.seat; }
  function onLb(d) { board = (d && d.board) || []; renderLB(); }
  function onState(m) {
    if (m.ar && m.ar !== AR) { AR = m.ar; decorKey = ''; geoKey = ''; }
    snap = m;
    teamMode = m.gs === 'lobby' ? !!(m.mode && m.mode !== 'ffa') : (m.nteams > 0 && m.nteams < m.players.filter(p => p.playing).length);
    const t = TERRAINS[m.ter | 0] || 'stade'; if (t !== terId) { terId = t; decorKey = ''; }
    syncGeo(m);
    const inGame = m.gs === 'play' || m.gs === 'countdown' || m.gs === 'paused';
    if (inGame !== inGamePrev) { inGamePrev = inGame; document.body.classList.toggle('playing', inGame); resizeCanvas(); }
    document.body.classList.toggle('paused', m.gs === 'paused');
    if (m.gs === 'play' || m.gs === 'countdown') closePanels();
    if (m.round !== prevRound) { prevRound = m.round; buf = []; puffs.length = 0; waves.length = 0; sparks.length = 0; confs.length = 0; texts.length = 0; trail = []; LUM.vider(); }
    buf.push({ t: performance.now(), s: m }); if (buf.length > 10) buf.shift();
    if (m.gs === 'play' && (prevGs === 'countdown' || !J.actif() || jRound !== m.round)) { J.debut(performance.now()); jRound = m.round; jLast = -1e9; serie = {}; }
    (m.fx || []).forEach(playFx);
    suivreJournal(m, performance.now(), m.gs === 'over' && prevGs !== 'over');
    if (prevGs !== 'over' && m.gs === 'over') { finJournal(m); sound('win'); music.sting('win'); }
    if (m.gs === 'countdown' && m.count > 0 && m.count !== lastCount) { music.sting('count'); sound('count'); }
    if (prevGs === 'countdown' && m.gs === 'play') music.sting('go');
    if (prevGs !== 'countdown' && m.gs === 'countdown' && terId !== 'stade') msgGlobal(LOOK().i, 'Terrain : ' + LOOK().nom + ' — ' + TER_DESC[terId], { color: K.amber });
    lastCount = m.count;
    if (m.sd && !prevSd) { sdT0 = performance.now(); music.sting('alert'); msgGlobal('⚠', 'Prolongations : les cages s\'agrandissent !', { bad: true }); }
    prevSd = !!m.sd;
    prevGs = m.gs;
    { let inten = 0;
      if (m.gs === 'play' || m.gs === 'countdown') { inten = 1; const camps = {}; let nc = 0; m.players.forEach(p => { if (p.playing && p.alive && !camps[p.team]) { camps[p.team] = 1; nc++; } }); if (m.sd || ((m.nteams || 0) >= 3 && nc <= 2)) inten = 2; }
      music.setIntensity(inten); }
    refreshHUD(); syncOptPanel(m);
    if (m.gs === 'over') { if (!endShown) { showEndscreen(m); endShown = true; } }
    else { endShown = false; endEl.classList.add('hidden'); }
    const idle = m.gs === 'lobby' || m.gs === 'over', total = (m.connected || 0) + (m.botCount || 0);
    startBtn.disabled = !(mySeat >= 0 && idle && m.connected >= 1 && total >= 2);
    startBtn.textContent = m.gs === 'over' ? '↻ Rejouer' : '▶ Coup d\'envoi';
    pauseBtn.disabled = !(m.gs === 'play' || m.gs === 'paused');
    pauseBtn.textContent = m.gs === 'paused' ? '▶ Reprendre' : '⏸ Pause';
    pauseFloat.textContent = m.gs === 'paused' ? '▶' : '⏸';
    if (botsBtn) { botsBtn.disabled = !idle; botsBtn.textContent = '🤖 Bots : ' + (m.botCount || 0); botsBtn.classList.toggle('on', (m.botCount || 0) > 0); }
    if (diffBtn) { diffBtn.disabled = !idle; diffBtn.textContent = '🎯 IA : ' + (DIFF_NAMES[m.botDiff] || 'Normale'); }
    if (livesBtn) { livesBtn.disabled = !idle; livesBtn.textContent = '❤ Vies : ' + (m.lives || 3); }
    modeBtn.disabled = !(idle && TEAM_TOTALS.indexOf(total) >= 0);
    modeBtn.textContent = '⚔ ' + (MODE_NAME[m.mode] || m.mode || 'FFA'); modeBtn.classList.toggle('on', teamMode);
    const me = mySeat >= 0 ? m.players[mySeat] : null, live = !!(me && me.playing && me.alive);
    const aLui = !!(live && m.ball && m.ball.o === mySeat);
    if (shootBtn) shootBtn.style.opacity = !live || aLui ? '' : '0.5';                   // tir : utile seulement ballon au pied
    if (tackleBtn) tackleBtn.style.opacity = !live || me.tcd >= 1 ? '' : String(0.45 + 0.4 * (me.tcd || 0));
    if (sprintBtn) sprintBtn.style.opacity = !live || (me.sta > 0.3 && !me.ess) || me.tb ? '' : '0.5';
  }

  // ───────────────────────── journal de manche ─────────────────────────
  function suivreJournal(m, now, force) {
    if (!J.actif() || !(m.gs === 'play' || force)) return;
    if (!(force || now - jLast >= 500)) return;
    jLast = now; const vals = {};
    m.players.forEach(p => { if (p.playing) vals[p.seat] = p.alive ? (p.lives | 0) : 0; });
    J.echantillon(now, vals, true);
  }
  function momentBut(f, now) {
    if (!J.actif() || !snap) return;
    const victim = cageNom(f.seat);
    if (f.own || f.by < 0) { J.moment(now, f.own && f.k >= 0 ? f.k : f.seat, f.own ? 'contre son camp' : 'a encaissé un but', 1); return; }
    const s = serie[f.by] = (serie[f.by] || 0) + 1;
    if (s === 3) J.moment(now, f.by, 'coup du chapeau (3e but, sur ' + victim + ')', 9);
    else if (f.lives === 0) J.moment(now, f.by, 'a éliminé ' + victim + ' d\'un but', teamMode ? 7 : 6);
    else J.moment(now, f.by, 'a marqué contre ' + victim, 3 + Math.min(3, s));
  }
  function finJournal(m) {
    if (!J.actif()) return;
    const w = m.winner >= 0 ? m.players.find(p => p.playing && p.alive && p.team === m.winner) : null;
    if (w) J.moment(performance.now(), w.seat, teamMode ? 'a gardé sa cage pour l\'équipe ' + TEAM_LETTER[m.winner] : 'dernier gardien debout', 1);
    J.fin();
  }

  // ───────────────────────── sons (WebAudio, zéro fichier) ─────────────────────────
  function unlockAudio() { if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch {} } if (actx && actx.state === 'suspended') actx.resume(); }
  let sndPan = 0;
  const vol = () => (A && typeof A.sfx === 'number') ? A.sfx : 1;
  function out(node) { if (sndPan && actx.createStereoPanner) { const pn = actx.createStereoPanner(); pn.pan.value = Math.max(-1, Math.min(1, sndPan)); pn.connect(actx.destination); node.connect(pn); } else node.connect(actx.destination); }
  function tone(f, d, ty, g, dl, f2) { const v = vol(); if (!actx || v <= 0) return; const t0 = actx.currentTime + (dl || 0), o = actx.createOscillator(), gg = actx.createGain(); o.type = ty || 'square'; o.frequency.setValueAtTime(f, t0); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + d); gg.gain.setValueAtTime((g || 0.05) * v, t0); gg.gain.exponentialRampToValueAtTime(0.0001, t0 + d); o.connect(gg); out(gg); o.start(t0); o.stop(t0 + d + 0.02); }
  function noise(d, type, freq, g, dl, q) {
    const v = vol(); if (!actx || v <= 0) return;
    if (!noiseBuf || noiseBuf.sampleRate !== actx.sampleRate) { const sr = actx.sampleRate, b = actx.createBuffer(1, Math.floor(sr * 2), sr), dd = b.getChannelData(0); for (let i = 0; i < dd.length; i++) dd[i] = Math.random() * 2 - 1; noiseBuf = b; }
    const t0 = actx.currentTime + (dl || 0), s = actx.createBufferSource(), f = actx.createBiquadFilter(), gg = actx.createGain();
    s.buffer = noiseBuf; f.type = type; f.frequency.value = freq; if (q) f.Q.value = q;
    gg.gain.setValueAtTime(0.0001, t0); gg.gain.exponentialRampToValueAtTime(g * v, t0 + Math.min(0.08, d * 0.2)); gg.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
    s.connect(f); f.connect(gg); out(gg); s.start(t0); s.stop(t0 + d + 0.02);
  }
  // sifflet d'arbitre : deux oscillateurs légèrement désaccordés + trémolo (la bille du sifflet)
  function whistle(n, long) {
    const v = vol(); if (!actx || v <= 0) return;
    for (let i = 0; i < n; i++) {
      const t0 = actx.currentTime + i * 0.28, d = long && i === n - 1 ? 0.7 : 0.2;
      for (const f of [2750, 2790]) {
        const o = actx.createOscillator(), g = actx.createGain(), lfo = actx.createOscillator(), lg = actx.createGain();
        o.type = 'sine'; o.frequency.value = f; lfo.frequency.value = 38; lg.gain.value = 120; lfo.connect(lg); lg.connect(o.frequency);
        g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.025 * v, t0 + 0.02); g.gain.setValueAtTime(0.025 * v, t0 + d - 0.04); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
        o.connect(g); out(g); o.start(t0); lfo.start(t0); o.stop(t0 + d + 0.02); lfo.stop(t0 + d + 0.02);
      }
    }
  }
  function psound(k, x, arg) { sndPan = Math.max(-1, Math.min(1, (x / AR - 0.5) * 1.7)); sound(k, arg); sndPan = 0; }
  function sound(k, arg) {
    if (!actx) return;
    if (k === 'kick') { const f = arg == null ? 0.5 : arg; tone(110 + 90 * f, 0.08 + 0.06 * f, 'sine', 0.12 + 0.14 * f, 0, 55); noise(0.05 + 0.05 * f, 'bandpass', 700 + 700 * f, 0.08 + 0.1 * f); }   // frappe : « poc » sourd + cuir, plus sec quand c'est chargé
    else if (k === 'canon') { tone(90, 0.3, 'sine', 0.3, 0, 40); noise(0.35, 'lowpass', 600, 0.22); }
    else if (k === 'miss') noise(0.2, 'lowpass', 500, 0.08);
    else if (k === 'grab') tone(210, 0.05, 'sine', 0.06, 0, 120);
    else if (k === 'slide') noise(0.28, 'bandpass', 2600, 0.07, 0, 0.8);                                          // glissade dans l'herbe
    else if (k === 'tackle') { tone(110, 0.12, 'sine', 0.14, 0, 55); noise(0.08, 'lowpass', 700, 0.1); }
    else if (k === 'post') { tone(1480, 0.5, 'sine', 0.05); tone(2220, 0.35, 'sine', 0.03); tone(180, 0.1, 'sine', 0.1); }   // « poing » métallique
    else if (k === 'wall') tone(130, 0.07, 'sine', 0.06 + 0.1 * (arg || 0), 0, 80);
    else if (k === 'bump') { tone(520, 0.12, 'square', 0.05, 0, 980); tone(1040, 0.08, 'triangle', 0.04, 0.03); }   // bumper de flipper
    else if (k === 'wind') noise(1.4, 'bandpass', 380, 0.08, 0, 0.6);
    else if (k === 'pickup') { tone(660, 0.1, 'triangle', 0.05); tone(990, 0.16, 'triangle', 0.05, 0.07); }
    else if (k === 'malus') { tone(330, 0.14, 'sawtooth', 0.035); tone(220, 0.22, 'sawtooth', 0.035, 0.1); }
    else if (k === 'goal') { noise(2.2, 'bandpass', 700, 0.16, 0, 0.5); noise(1.6, 'bandpass', 1300, 0.08, 0.1, 0.6); tone(261.63, 0.3, 'square', 0.03, 0.05); tone(329.63, 0.3, 'square', 0.03, 0.2); tone(392, 0.5, 'square', 0.03, 0.35); }   // clameur du public + fanfare
    else if (k === 'ooh') noise(1.2, 'bandpass', 480, 0.08, 0, 0.9);
    else if (k === 'count') tone(880, 0.1, 'square', 0.03);
    else if (k === 'win') { tone(392, 0.25, 'square', 0.04); tone(523.25, 0.25, 'square', 0.04, 0.14); tone(659.25, 0.25, 'square', 0.04, 0.28); tone(783.99, 0.55, 'square', 0.04, 0.42); noise(2, 'bandpass', 800, 0.12, 0.1, 0.5); }
  }

  // ───────────────────────── effets ponctuels ─────────────────────────
  function grass(x, y, n, spd, ang) {                   // brins d'herbe, glace pilée, sable ou boue arrachés
    if (A.reduceFx) return; const now = performance.now();
    const cols = terId === 'glace' ? ['#ffffff', '#cfe8f5'] : terId === 'tempete' ? ['#f0dca8', '#c9ad70'] : terId === 'boue' ? ['#5a3d22', '#4f7a3c'] : terId === 'flipper' ? ['#ff4fd8', '#7ae8ff'] : ['#4fb45e', '#7a5a34'];
    for (let k = 0; k < n; k++) { const a = (ang == null ? Math.random() * Math.PI * 2 : ang + (Math.random() - 0.5) * 1.4), sp = (0.4 + Math.random()) * spd; puffs.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, born: now, life: 380 + Math.random() * 380, r: 1 + Math.random() * 1.6, col: cols[Math.random() < 0.7 ? 0 : 1] }); }
    if (puffs.length > 260) puffs.splice(0, puffs.length - 260);
  }
  function confetti(x, y, col, n) {
    if (A.reduceFx) return; const now = performance.now(), cols = [col, '#ffffff', K.gold];
    for (let k = 0; k < n; k++) { const a = Math.random() * Math.PI * 2, sp = 1.5 + Math.random() * 5; confs.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 2, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, born: now, life: 1300 + Math.random() * 900, col: cols[k % 3] }); }
    if (confs.length > 400) confs.splice(0, confs.length - 400);
  }
  function banner(txt, col, sub) { texts.push({ txt, col, sub: sub || '', born: performance.now() }); if (texts.length > 3) texts.shift(); }
  function playFx(f) {
    if (!f) return;
    const now = performance.now();
    if (f.type === 'shot') {
      const pw = +f.f || 0; psound(f.c ? 'canon' : 'kick', f.x, pw); grass(f.x, f.y, 3 + Math.round(6 * pw), 1 + pw);
      if (!A.reduceFx) { LUM.ajouter(f.x, f.y, 30 + 40 * pw, f.c ? '#ff9a4a' : '#fff4d0', 200, 0.25 + 0.3 * pw); if (pw > 0.8) shakeMag = Math.max(shakeMag, f.c ? 6 : 2.5); }
      return;
    }
    if (f.type === 'miss') { psound('miss', f.x); grass(f.x, f.y, 6, 1); if (f.seat === mySeat) msgPerso('👟', 'Tacle raté : à terre !', { bad: true }); return; }
    if (f.type === 'grab') { if (snap && snap.ball) psound('grab', snap.ball.x); return; }
    if (f.type === 'slide') { psound('slide', f.x); grass(f.x, f.y, 10, 1.6); return; }
    if (f.type === 'tackle') {
      psound('tackle', f.x); grass(f.x, f.y, f.steal ? 14 : 8, 2);
      if (!A.reduceFx) { shakeMag = Math.max(shakeMag, f.seat === mySeat || f.by === mySeat ? 5 : 2); waves.push({ x: f.x, y: f.y, r0: 6, r1: 34, born: now, life: 320, col: '242,246,238', lw: 3 }); }
      if (f.seat === mySeat) msgPerso('💫', f.steal ? 'Taclé : assommé, ballon perdu !' : 'Taclé : assommé 1 s', { bad: true });
      else if (f.by === mySeat) msgPerso('👟', f.steal ? 'Porteur assommé : le ballon est libre !' : 'Adversaire assommé', { color: K.gold });
      if (f.steal && J.actif()) J.moment(now, f.by, 'a assommé ' + nameOf(f.seat) + ' pour lui prendre le ballon', 2);
      return;
    }
    if (f.type === 'deflect') { psound('grab', f.x); return; }
    if (f.type === 'post') { psound('post', f.x); if (!A.reduceFx) { sparks.push({ x: f.x, y: f.y, born: now, life: 300 }); LUM.ajouter(f.x, f.y, 36, '#ffffff', 240, 0.5); } if ((f.f || 0) > 0.35) { banner('POTEAU !', K.chalk); sound('ooh'); } return; }
    if (f.type === 'wall') { psound('wall', f.x, f.f); return; }
    if (f.type === 'bump') { psound('bump', f.x); bumpFlash[f.i] = now; if (!A.reduceFx) { LUM.ajouter(f.x, f.y, 70, (f.i % 2) ? '#7ae8ff' : '#ff4fd8', 260, 0.6); waves.push({ x: f.x, y: f.y, r0: 18, r1: 44, born: now, life: 260, col: (f.i % 2) ? '122,232,255' : '255,79,216', lw: 3 }); } return; }
    if (f.type === 'wind') {
      if (f.warn) msgGlobal('🌪', 'Le vent va tourner ' + flecheVent(f.x, f.y) + ' !', { color: '#e4cc93' });
      else { psound('wind', AR / 2); }
      return;
    }
    if (f.type === 'pickup') {
      psound('pickup', f.x);
      const L = own(IT_LOOK, f.k) ? IT_LOOK[f.k] : null;
      if (L && f.seat === mySeat) msgPerso(L.i, L.msg, { color: L.c });
      if (!A.reduceFx && L) { const c = hexRgb(L.c); waves.push({ x: f.x, y: f.y, r0: 8, r1: 36, born: now, life: 380, col: c.join(','), lw: 3 }); LUM.ajouter(f.x, f.y, 70, L.c, 420, 0.45); }
      return;
    }
    if (f.type === 'malus') {                          // un adversaire a ramassé un malus : seule la victime est prévenue
      const L = own(IT_LOOK, f.k) ? IT_LOOK[f.k] : null;
      if (L && f.seat === mySeat) { psound('malus', AR / 2); msgPerso(L.i, L.sub, { color: L.c, bad: true }); }
      return;
    }
    if (f.type === 'goal') {
      psound('goal', f.x);
      netHit[f.seat] = { t: now, x: f.x, y: f.y };
      const col = f.by >= 0 ? colSeat(f.by) : K.chalk;
      if (f.own) banner('CONTRE SON CAMP', K.red, cageNom(f.seat));
      else banner('BUT !', col, f.by >= 0 ? nameOf(f.by) + ' ➜ ' + cageNom(f.seat) : '');
      const eq = teamMode ? ' pour l\'équipe' : '';
      if (maCage(f)) msgPerso('🥅', f.lives > 0 ? 'But encaissé — ' + f.lives + ' vie' + (f.lives > 1 ? 's' : '') + ' restante' + (f.lives > 1 ? 's' : '') + eq : (teamMode ? 'Dernier but encaissé : équipe éliminée !' : 'Dernier but encaissé : éliminé !'), { bad: true });
      else if (f.by >= 0 && f.by === mySeat) msgPerso('⚽', 'BUT ! Contre ' + cageNom(f.seat), { color: K.gold });
      momentBut(f, now);
      if (A.reduceFx) return;
      shakeMag = Math.max(shakeMag, 9); confetti(f.x, f.y, col, 70);
      LUM.ajouter(f.x, f.y, 180, col, 900, 0.55); LUM.ajouter(f.x, f.y, 60, '#ffffff', 400, 0.6);
      return;
    }
    if (f.type === 'out') { if (now - lastKill > 150) { lastKill = now; music.sting('kill'); } if (f.seat === mySeat) msgPerso('✖', 'Ta cage est fermée : éliminé', { bad: true }); return; }
    if (f.type === 'whistle') { whistle(f.k === 'end' ? 3 : f.k === 'kick' ? 1 : 2, f.k === 'end' || f.k === 'go'); return; }
  }
  function flecheVent(x, y) { const a = Math.atan2(y, x), i = Math.round(((a + Math.PI * 2) % (Math.PI * 2)) / (Math.PI / 4)) % 8; return ['→', '↘', '↓', '↙', '←', '↖', '↑', '↗'][i]; }

  // ───────────────────────── interpolation (tampon, comme le Sumo) ─────────────────────────
  function view(now) {
    if (buf.length === 0) return null;
    const hz = (snap && snap.shz) || TICK_HZ, delay = Math.max(55, 1650 / hz), target = now - delay;
    let a = buf[0], b = buf[buf.length - 1];
    for (let i = 0; i < buf.length; i++) if (buf[i].t <= target) a = buf[i];
    for (let i = buf.length - 1; i >= 0; i--) if (buf[i].t >= target) b = buf[i];
    const span = b.t - a.t; let al = span > 0 ? (target - a.t) / span : 0; al = al < 0 ? 0 : al > 1 ? 1 : al;
    const pl = {};
    b.s.players.forEach(pb => {
      if (!pb.playing || !pb.alive) return;
      const pa = a.s.players[pb.seat]; let x = pb.x, y = pb.y, ang = pb.a || 0;
      if (pa && pa.playing && pa.alive && Math.hypot(pb.x - pa.x, pb.y - pa.y) < 60) { x = pa.x + (pb.x - pa.x) * al; y = pa.y + (pb.y - pa.y) * al; const da = Math.atan2(Math.sin(ang - (pa.a || 0)), Math.cos(ang - (pa.a || 0))); ang = (pa.a || 0) + da * al; }
      pl[pb.seat] = { x, y, a: ang };
    });
    let ball = null;
    const bb = b.s.ball, ba = a.s.ball;
    if (bb) { ball = { x: bb.x, y: bb.y, o: bb.o }; if (ba && Math.hypot(bb.x - ba.x, bb.y - ba.y) < 80) { ball.x = ba.x + (bb.x - ba.x) * al; ball.y = ba.y + (bb.y - ba.y) * al; } }
    // ballon au pied : on le recolle au joueur INTERPOLÉ (sinon il flotte d'une image à côté des pieds)
    if (ball && ball.o >= 0 && pl[ball.o]) { const o = pl[ball.o]; ball.x = o.x + Math.cos(o.a) * (PR + BR + 1); ball.y = o.y + Math.sin(o.a) * (PR + BR + 1); }
    return { pl, ball };
  }

  // ───────────────────────── décor statique pré-rendu (par terrain) ─────────────────────────
  // Nuit et foule dans les coins, bande de bord (panneaux), surface du terrain découpée au polygone (bandes de tonte,
  // glace rayée, dalles néon, sable ridé), zones propres au terrain (flaques, bancs de sable), craie, vignette.
  let decorCv = null, decorKey = '';
  function polyPath(g, inset) {
    g.beginPath();
    G.forEach((e, i) => { const k = (e.apo - inset) / e.apo, x = GC.x + (e.ax - GC.x) * k, y = GC.y + (e.ay - GC.y) * k; if (i === 0) g.moveTo(x, y); else g.lineTo(x, y); });
    g.closePath();
  }
  function ensureDecor() {
    if (!G) return;
    const zn = (snap && snap.zn) || [];
    if (zn !== znRef) { znRef = zn; znVer++; }         // app.js garde le même tableau tant que la clé n'est pas rediffusée
    const key = cv.width + '|' + formeKey + '|' + terId + '|' + znVer + '|' + (A.contrast ? 1 : 0) + '|' + (A.reduceFx ? 1 : 0);
    if (decorCv && key === decorKey) return;
    decorKey = key;
    if (!decorCv) decorCv = document.createElement('canvas');
    decorCv.width = cv.width; decorCv.height = cv.height;
    const g = decorCv.getContext('2d'), W = AR, L = LOOK(), rnd = rng(0xf007 + Math.round(W) + TERRAINS.indexOf(terId) * 97);
    g.setTransform(cv.width / W, 0, 0, cv.width / W, 0, 0);
    let apoMax = 0; G.forEach(e => { if (e.apo > apoMax) apoMax = e.apo; });
    const R = apoMax / Math.cos(Math.PI / G.length);
    // 1) nuit, foule (visible seulement dans les coins laissés par un triangle, un pentagone…)
    const nuit = terId === 'glace' ? ['#1a2b3a', '#0b141c'] : terId === 'tempete' ? ['#3a3322', '#16120a'] : terId === 'flipper' ? ['#12072a', '#050212'] : ['#12261b', '#050b08'];
    const bg = g.createRadialGradient(GC.x, GC.y, R * 0.6, GC.x, GC.y, W * 0.75); bg.addColorStop(0, nuit[0]); bg.addColorStop(1, nuit[1]);
    g.fillStyle = bg; g.fillRect(0, 0, W, W);
    const foule = ['#e8413a', '#f2f6ee', '#4a9ee0', '#ffc24a', '#2aaf7a', '#9b6cf0', '#e268b0', '#1a1a1a'];
    for (let k = 0; k < 1800; k++) { const x = rnd() * W, y = rnd() * W; g.fillStyle = foule[(rnd() * foule.length) | 0]; g.globalAlpha = 0.14 + rnd() * 0.22; g.fillRect(x, y, 1.6 + rnd(), 1.6 + rnd()); }
    g.globalAlpha = 1;
    // 2) bande de bord + panneaux publicitaires le long de chaque côté (hors cage)
    polyPath(g, -MARGE + 6); g.fillStyle = 'rgba(0,0,0,0.45)'; g.fill();
    polyPath(g, -12); g.fillStyle = L.edge; g.fill();
    G.forEach((e, i) => {
      const n = 4, seg = e.len / n;
      for (let s = 0; s < n; s++) {
        const u0 = s * seg + 6, u1 = (s + 1) * seg - 6; if (Math.abs((u0 + u1) / 2 - e.len / 2) < e.len * 0.36) continue;   // pas derrière la cage
        const hue = terId === 'flipper' ? ['#ff4fd8', '#7ae8ff', '#ffe14d'][(i + s) % 3] : ['#1f4fa8', '#b8321f', '#e0a92e', '#1c7a3e', '#6b2fb0'][(i + s) % 5];
        const p0x = e.ax + e.tx * u0 - e.nx * 22, p0y = e.ay + e.ty * u0 - e.ny * 22;
        g.save(); g.translate(p0x, p0y); g.rotate(Math.atan2(e.ty, e.tx));
        g.fillStyle = hue; g.fillRect(0, -3, u1 - u0, 7);
        g.fillStyle = 'rgba(255,255,255,0.7)'; for (let q = 4; q < u1 - u0 - 4; q += 7) g.fillRect(q, -1, 4, 3);
        g.restore();
      }
    });
    // 3) surface découpée au polygone
    g.save(); polyPath(g, 0); g.clip();
    g.fillStyle = L.a; g.fillRect(0, 0, W, W);
    if (terId === 'flipper') {                             // dalles néon : grille lumineuse
      g.strokeStyle = 'rgba(122,90,255,0.22)'; g.lineWidth = 1;
      for (let x = 0; x < W; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, W); g.stroke(); }
      for (let y = 0; y < W; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
    } else {
      const bw = R / 5;                                     // bandes de tonte / de lissage
      for (let y = GC.y - R * 1.3, k = 0; y < GC.y + R * 1.3; y += bw, k++) { g.fillStyle = k % 2 ? L.b : L.a; g.fillRect(0, y, W, bw); }
    }
    for (let k = 0; k < 3200; k++) { const x = rnd() * W, y = rnd() * W; g.fillStyle = rnd() < 0.5 ? 'rgba(0,0,0,0.06)' : L.grain; g.fillRect(x, y, 1.2, 2.4); }
    if (terId === 'glace') {                               // rayures de patins
      g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 0.8;
      for (let k = 0; k < 90; k++) { const x = rnd() * W, y = rnd() * W, r = 20 + rnd() * 80, a = rnd() * 6; g.beginPath(); g.arc(x, y, r, a, a + 0.4 + rnd() * 0.6); g.stroke(); }
    }
    if (terId === 'tempete') {                             // rides de sable
      g.strokeStyle = 'rgba(150,120,70,0.22)'; g.lineWidth = 1.2;
      for (let y = 0; y < W; y += 11) { g.beginPath(); for (let x = 0; x <= W; x += 16) g.lineTo(x, y + Math.sin(x / 37 + y) * 3); g.stroke(); }
    }
    // zones (flaques de boue, bancs de sable) : pré-rendues, elles ne bougent pas pendant la manche
    zn.forEach(z => {
      const x = z[0], y = z[1], r = z[2], mud = z[3] === 0;
      const gr = g.createRadialGradient(x - r * 0.2, y - r * 0.25, r * 0.1, x, y, r);
      if (mud) { gr.addColorStop(0, '#473a26'); gr.addColorStop(0.7, '#5a4a30'); gr.addColorStop(1, 'rgba(90,74,48,0)'); }   // brun terreux (le brun rouge virait au bordeaux sur le vert)
      else { gr.addColorStop(0, '#f3e2b5'); gr.addColorStop(0.75, '#ead3a0'); gr.addColorStop(1, 'rgba(234,211,160,0)'); }
      g.fillStyle = gr; g.beginPath();
      for (let i = 0; i <= 18; i++) { const a = i / 18 * Math.PI * 2, rr = r * (0.88 + 0.12 * Math.sin(i * 2.3 + x)); if (i) g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); else g.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
      g.closePath(); g.fill();
      if (mud) { g.fillStyle = 'rgba(255,255,255,0.14)'; g.beginPath(); oval(g, x - r * 0.25, y - r * 0.3, r * 0.3, r * 0.1); g.fill(); }   // reflet de la flaque
      else { g.strokeStyle = 'rgba(160,125,70,0.35)'; g.lineWidth = 1; for (let k = 1; k <= 3; k++) { g.beginPath(); g.arc(x, y, r * k / 4, 0, Math.PI * 2); g.stroke(); } }
    });
    const lg = g.createRadialGradient(GC.x, GC.y - R * 0.2, R * 0.1, GC.x, GC.y, R * 1.15); lg.addColorStop(0, 'rgba(255,255,230,0.08)'); lg.addColorStop(1, 'rgba(0,0,0,0.22)');
    g.fillStyle = lg; g.fillRect(0, 0, W, W);
    // 4) lignes (craie, ou néon au flipper)
    if (terId === 'flipper') { g.shadowColor = 'rgba(255,79,216,0.8)'; g.shadowBlur = 8; }
    g.strokeStyle = L.line; g.lineWidth = 2.2; g.lineJoin = 'round';
    polyPath(g, 4); g.stroke();
    g.beginPath(); g.arc(GC.x, GC.y, R * 0.18, 0, Math.PI * 2); g.stroke();
    g.fillStyle = L.line; g.beginPath(); g.arc(GC.x, GC.y, 3, 0, Math.PI * 2); g.fill();
    G.forEach(e => {                                    // surface de réparation : arc devant la cage + point de pénalty
      if (e.owner === -1) return;
      const r = Math.min(e.len * 0.22, e.apo * 0.3), a0 = Math.atan2(e.ny, e.nx);
      g.beginPath(); g.arc(e.mx - e.nx * 4, e.my - e.ny * 4, r, a0 - Math.PI / 2, a0 + Math.PI / 2); g.stroke();
      g.beginPath(); g.arc(e.mx + e.nx * r * 0.62, e.my + e.ny * r * 0.62, 2.4, 0, Math.PI * 2); g.fill();
    });
    G.forEach((e, i) => {                              // quarts de cercle des coins (au sommet a de chaque côté)
      const prev = G[(i - 1 + G.length) % G.length], a1 = Math.atan2(e.ty, e.tx), a2 = Math.atan2(-prev.ty, -prev.tx);
      const k = (e.apo - 4) / e.apo, vx = GC.x + (e.ax - GC.x) * k, vy = GC.y + (e.ay - GC.y) * k;
      let d = a2 - a1; while (d < 0) d += Math.PI * 2;
      g.beginPath(); g.arc(vx, vy, 10, a1, a1 + d); g.stroke();
    });
    g.shadowBlur = 0;
    g.restore();
    // 5) bord : bandes de patinoire / murs néon / planches
    g.strokeStyle = terId === 'glace' ? '#ffffff' : terId === 'flipper' ? '#7ae8ff' : 'rgba(0,0,0,0.35)'; g.lineWidth = terId === 'glace' ? 5 : 3;
    if (terId === 'flipper') { g.shadowColor = '#7ae8ff'; g.shadowBlur = 10; }
    polyPath(g, -2); g.stroke(); g.shadowBlur = 0;
    if (terId === 'glace') { g.strokeStyle = '#2d7fd0'; g.lineWidth = 1.5; polyPath(g, -5); g.stroke(); }
    // 6) vignette
    const vg = g.createRadialGradient(W / 2, W / 2, W * 0.38, W / 2, W / 2, W * 0.76); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.42)');
    g.fillStyle = vg; g.fillRect(0, 0, W, W);
  }

  // ───────────────────────── cages ─────────────────────────
  // Filet extrudé HORS du terrain (profondeur 20), maillage qui ondule quand un but y entre, poteaux et barre ;
  // une bande à la couleur du propriétaire le long de la ligne ; ses vies en ballons derrière le filet.
  // Cage fermée (équipe éliminée) : planches à rayures rouges et blanches sur toute la bouche.
  function drawGoals(now) {
    if (!G || !snap) return;
    const tot = snap.lives || 3;
    G.forEach(e => {
      if (e.owner === -1) return;                       // côté-mur (2 équipes : haut et bas)
      const h = halfW(e), open = ownerAlive(e) || (snap.gs === 'lobby' && e.open), depth = 20;
      const p1x = e.mx - e.tx * h, p1y = e.my - e.ty * h, p2x = e.mx + e.tx * h, p2y = e.my + e.ty * h;
      const bx = -e.nx * depth, by = -e.ny * depth, col = e.owner >= 0 ? colSeat(e.owner) : 'rgba(242,246,238,0.5)';
      if (!open) {
        ctx.save(); ctx.translate(e.mx, e.my); ctx.rotate(Math.atan2(e.ty, e.tx));
        ctx.fillStyle = '#2a2a2a'; ctx.fillRect(-h, -8, h * 2, 10);
        ctx.save(); ctx.beginPath(); ctx.rect(-h, -8, h * 2, 10); ctx.clip();
        ctx.fillStyle = '#e8413a'; for (let x = -h - 10; x < h + 10; x += 14) { ctx.beginPath(); ctx.moveTo(x, 2); ctx.lineTo(x + 7, 2); ctx.lineTo(x + 17, -8); ctx.lineTo(x + 10, -8); ctx.closePath(); ctx.fill(); }
        ctx.restore(); ctx.restore();
        return;
      }
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.moveTo(p1x, p1y); ctx.lineTo(p1x + bx, p1y + by); ctx.lineTo(p2x + bx, p2y + by); ctx.lineTo(p2x, p2y); ctx.closePath(); ctx.fill();
      const hit = netHit[e.owner], age = hit ? now - hit.t : 1e9, ond = !A.reduceFx && age < 900 ? (1 - age / 900) : 0;
      ctx.strokeStyle = 'rgba(242,246,238,0.55)'; ctx.lineWidth = 0.8; ctx.beginPath();
      const nl = Math.max(6, Math.round(h * 2 / 7));
      for (let i = 0; i <= nl; i++) {
        const u = -h + (2 * h) * i / nl, bulge = ond * 7 * Math.sin(Math.PI * i / nl) * Math.sin(age / 50);
        const x0 = e.mx + e.tx * u, y0 = e.my + e.ty * u;
        ctx.moveTo(x0, y0); ctx.lineTo(x0 + bx * (1 + bulge / depth), y0 + by * (1 + bulge / depth));
      }
      for (let j = 1; j <= 3; j++) { const k = j / 3; ctx.moveTo(p1x + bx * k, p1y + by * k); ctx.lineTo(p2x + bx * k, p2y + by * k); }
      ctx.stroke();
      // cage modifiée par un objet : liseré ambre (mur, rétrécie) ou violet (géante, élargie) qui pulse
      if (e.k !== 1 && !A.reduceFx) { ctx.strokeStyle = e.k < 1 ? '#e0864a' : '#b06cff'; ctx.lineWidth = 6; ctx.globalAlpha = 0.45 + 0.35 * Math.sin(now / 120); ctx.beginPath(); ctx.moveTo(p1x, p1y); ctx.lineTo(p2x, p2y); ctx.stroke(); ctx.globalAlpha = 1; }
      ctx.strokeStyle = col; ctx.lineWidth = 4; ctx.globalAlpha = 0.85; ctx.beginPath(); ctx.moveTo(p1x, p1y); ctx.lineTo(p2x, p2y); ctx.stroke(); ctx.globalAlpha = 1;
      ctx.strokeStyle = K.chalk; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(p1x, p1y); ctx.lineTo(p1x + bx, p1y + by); ctx.lineTo(p2x + bx, p2y + by); ctx.lineTo(p2x, p2y); ctx.stroke();
      ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#6b6b6b'; ctx.lineWidth = 1;
      for (const [x, y] of [[p1x, p1y], [p2x, p2y]]) { ctx.beginPath(); ctx.arc(x, y, POST_R + 0.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
      const p = e.owner >= 0 ? snap.players[e.owner] : null;
      if (p && p.playing) {                             // vies : ballons derrière le filet (pleins = restantes)
        const n = p.lives | 0, sp = 11, ox = e.mx - e.nx * (depth + 8), oy = e.my - e.ny * (depth + 8);
        for (let i = 0; i < tot; i++) {
          const u = (i - (tot - 1) / 2) * sp, x = ox + e.tx * u, y = oy + e.ty * u;
          ctx.globalAlpha = i < n ? 1 : 0.25; drawBall(x, y, 4.2, 0, false); ctx.globalAlpha = 1;
        }
      }
      ctx.restore();
    });
  }

  // ───────────────────────── éléments de terrain dynamiques ─────────────────────────
  function drawBumpers(now) {
    const bm = (snap && snap.bmp) || [];
    bm.forEach((b, i) => {
      const x = b[0], y = b[1], r = b[2], f = bumpFlash[i] ? Math.max(0, 1 - (now - bumpFlash[i]) / 260) : 0, col = i % 2 ? '#7ae8ff' : '#ff4fd8';
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.arc(x + 3, y + 4, r, 0, Math.PI * 2); ctx.fill();
      const gr = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 1, x, y, r); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.5, col); gr.addColorStop(1, '#2a1060');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, r * (1 + 0.12 * f), 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = f > 0 ? '#ffffff' : col; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, r + 3 + 4 * f, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
      if (!A.reduceFx) lumiere(ctx, x, y, r * 2.4, col, 0.18 + 0.4 * f);
    });
  }
  function drawItems(now) {
    const pk = (snap && snap.pk) || [];
    pk.forEach(it => {
      const k = ITEMS[it[2]], L = k && IT_LOOK[k]; if (!L) return;
      const x = it[0], y = it[1], pulse = A.reduceFx ? 1 : 1 + 0.08 * Math.sin(now / 200 + x), r = 13 * pulse;
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.arc(x + 2, y + 3, r, 0, Math.PI * 2); ctx.fill();
      if (!A.reduceFx) { const ph = (now / 1300 + y / 97) % 1; ctx.strokeStyle = L.c; ctx.globalAlpha = 0.55 * (1 - ph); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, r + ph * 14, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1; }
      ctx.fillStyle = '#0d1a12'; ctx.strokeStyle = L.bonus ? '#5fd46a' : '#ff5a4e'; ctx.lineWidth = A.contrast ? 3.5 : 2.5;   // anneau vert = bonus, rouge = malus
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      drawItemIcon(k, x, y, 8.5 * pulse, L.c);
      ctx.restore();
      if (!A.reduceFx) lumiere(ctx, x, y, 30, L.c, 0.2);
    });
  }
  // pictogrammes vectoriels (les emoji varient trop d'un système à l'autre) : éclair, boulet, briques, cage, goutte, flèches
  function drawItemIcon(k, x, y, s, col) {
    ctx.save(); ctx.translate(x, y); ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const q = s / 8;
    if (k === 'turbo') { ctx.beginPath(); ctx.moveTo(2 * q, -7 * q); ctx.lineTo(-4 * q, 1 * q); ctx.lineTo(0, 1 * q); ctx.lineTo(-2 * q, 7 * q); ctx.lineTo(4.5 * q, -1.5 * q); ctx.lineTo(0.5 * q, -1.5 * q); ctx.closePath(); ctx.fill(); }
    else if (k === 'canon') { ctx.beginPath(); ctx.arc(-1 * q, 1 * q, 4.5 * q, 0, Math.PI * 2); ctx.fill(); ctx.lineWidth = 1.6 * q; ctx.beginPath(); ctx.moveTo(2.5 * q, -2.5 * q); ctx.lineTo(5 * q, -5.5 * q); ctx.stroke(); ctx.fillStyle = '#ffe14d'; ctx.beginPath(); ctx.arc(5.5 * q, -6 * q, 1.6 * q, 0, Math.PI * 2); ctx.fill(); }
    else if (k === 'mur') { for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) { const off = r % 2 ? 1.8 : 0; ctx.fillRect((-6 + c * 4 + off) * q, (-5 + r * 3.5) * q, 3.4 * q, 2.8 * q); } }
    else if (k === 'geante') { ctx.lineWidth = 1.6 * q; ctx.strokeRect(-6.5 * q, -3.5 * q, 13 * q, 7 * q); ctx.lineWidth = 0.7 * q; for (let i = -4; i <= 4; i += 2.5) { ctx.beginPath(); ctx.moveTo(i * q, -3.5 * q); ctx.lineTo(i * q, 3.5 * q); ctx.stroke(); } }
    else if (k === 'glu') { ctx.beginPath(); ctx.moveTo(0, -6.5 * q); ctx.quadraticCurveTo(5.5 * q, 0, 4.5 * q, 3 * q); ctx.arc(0, 3 * q, 4.5 * q, 0, Math.PI); ctx.quadraticCurveTo(-5.5 * q, 0, 0, -6.5 * q); ctx.fill(); }
    else if (k === 'inverse') {
      ctx.lineWidth = 1.8 * q;
      ctx.beginPath(); ctx.moveTo(-6 * q, -2.5 * q); ctx.lineTo(5 * q, -2.5 * q); ctx.moveTo(2.5 * q, -5 * q); ctx.lineTo(5 * q, -2.5 * q); ctx.lineTo(2.5 * q, 0); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(6 * q, 2.5 * q); ctx.lineTo(-5 * q, 2.5 * q); ctx.moveTo(-2.5 * q, 0); ctx.lineTo(-5 * q, 2.5 * q); ctx.lineTo(-2.5 * q, 5 * q); ctx.stroke();
    }
    ctx.restore();
  }
  function drawWeather(now, kdt) {
    if (A.reduceFx) { drops.length = 0; return; }
    if (terId === 'boue') {                                 // pluie : traits obliques
      while (drops.length < 90) drops.push({ x: Math.random() * AR, y: Math.random() * AR, v: 8 + Math.random() * 6 });
      ctx.save(); ctx.strokeStyle = 'rgba(200,220,255,0.28)'; ctx.lineWidth = 1; ctx.beginPath();
      for (const d of drops) { d.x += d.v * 0.35 * kdt; d.y += d.v * kdt; if (d.y > AR) { d.y = -10; d.x = Math.random() * AR; } if (d.x > AR) d.x -= AR; ctx.moveTo(d.x, d.y); ctx.lineTo(d.x - 3, d.y - 9); }
      ctx.stroke(); ctx.restore();
    } else if (terId === 'tempete' && snap && snap.wind) {  // vent : filets de sable qui filent dans son sens
      const wx = snap.wind[0] || 0, wy = snap.wind[1] || 0; if (!wx && !wy) { drops.length = 0; return; }
      while (drops.length < 60) drops.push({ x: Math.random() * AR, y: Math.random() * AR, v: 5 + Math.random() * 5 });
      ctx.save(); ctx.strokeStyle = 'rgba(255,240,200,0.35)'; ctx.lineWidth = 1.2; ctx.beginPath();
      for (const d of drops) { d.x += wx * d.v * kdt; d.y += wy * d.v * kdt; if (d.x < -20 || d.x > AR + 20 || d.y < -20 || d.y > AR + 20) { d.x = Math.random() * AR; d.y = Math.random() * AR; } ctx.moveTo(d.x, d.y); ctx.lineTo(d.x - wx * 14, d.y - wy * 14); }
      ctx.stroke(); ctx.restore();
    } else drops.length = 0;
  }
  function drawWindGauge(now) {                            // girouette en haut du terrain : sens actuel, et le prochain qui clignote
    if (terId !== 'tempete' || !snap || !snap.wind) return;
    let cx = AR - 60; const cy = 20, w = snap.wind, n = snap.wn;   // coin haut droit, sauf si la cage du haut (élargie) y arrive
    if (G) for (const e of G) if (e.owner !== -1 && e.ny > 0.9 && e.my < MARGE + 2 && e.mx + halfW(e) > AR - 110) cx = MARGE + 50;
    ctx.save(); ctx.fillStyle = 'rgba(20,16,8,0.7)'; ctx.fillRect(cx - 44, cy - 13, 88, 26);
    const fl = (x, y, col, a) => { const ang = Math.atan2(y, x); ctx.save(); ctx.translate(cx, cy); ctx.rotate(ang); ctx.globalAlpha = a; ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(2, -7); ctx.lineTo(2, -3); ctx.lineTo(-12, -3); ctx.lineTo(-12, 3); ctx.lineTo(2, 3); ctx.lineTo(2, 7); ctx.closePath(); ctx.fill(); ctx.restore(); };
    if (w[0] || w[1]) fl(w[0], w[1], '#f3e2b5', 1);
    if (n && (A.reduceFx || Math.sin(now / 90) > 0)) fl(n[0], n[1], '#ff7a2f', 0.9);
    ctx.fillStyle = '#f3e2b5'; ctx.font = 'bold 9px system-ui, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText('VENT', cx - 40, cy);
    ctx.restore();
  }

  // ───────────────────────── ballon ─────────────────────────
  function pent(x, y, r, a) { ctx.beginPath(); for (let i = 0; i < 5; i++) { const u = a + i * Math.PI * 2 / 5; if (i) ctx.lineTo(x + Math.cos(u) * r, y + Math.sin(u) * r); else ctx.moveTo(x + Math.cos(u) * r, y + Math.sin(u) * r); } ctx.closePath(); ctx.fill(); }
  function drawBall(x, y, r, spin, shadow) {
    if (shadow !== false) { ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.arc(x + r * 0.35, y + r * 0.45, r, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = '#fbfbf7'; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = '#1b1b1b';
    const cx = x + Math.cos(spin) * r * 0.35, cy = y + Math.sin(spin * 0.7) * r * 0.2;
    pent(cx, cy, r * 0.36, spin);
    for (let i = 0; i < 5; i++) { const u = spin + i * Math.PI * 2 / 5 + Math.PI / 5; pent(cx + Math.cos(u) * r * 0.82, cy + Math.sin(u) * r * 0.82, r * 0.28, u); }
    ctx.restore();
    ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.beginPath(); ctx.arc(x - r * 0.35, y - r * 0.4, r * 0.28, 0, Math.PI * 2); ctx.fill();
  }

  // ───────────────────────── joueurs vus de dessus ─────────────────────────
  // Épaules en maillot (couleur + motif du siège), bras, tête, crampons qui alternent à la course. ORIENTATION :
  // un chevron au sol devant chaque joueur (grand et ambre pour soi) + ligne de visée quand on a le ballon.
  function drawPlayer(p, v, now, over) {
    const col = colSeat(p.seat), rc = hexRgb(col), r = PR, x = v.x, y = v.y, a = v.a, mine = p.seat === mySeat && !over;
    const ph = runPhase[p.seat] || 0, step = Math.sin(ph) * r * 0.45;
    ctx.fillStyle = 'rgba(0,0,0,0.16)';                    // ombres des projecteurs : l'effet « match de nuit »
    const sx = x < AR / 2 ? 1 : -1, sy = y < AR / 2 ? 1 : -1;
    ctx.beginPath(); oval(ctx, x + sx * r * 0.7, y + sy * r * 0.3, r * 1.15, r * 0.7); ctx.fill();
    ctx.beginPath(); oval(ctx, x + sx * r * 0.2, y + sy * r * 0.75, r * 0.7, r * 1.1); ctx.fill();
    if (p.gl) { ctx.fillStyle = 'rgba(123,209,74,0.45)'; ctx.beginPath(); oval(ctx, x, y + 2, r * 1.35, r * 1.1); ctx.fill(); }   // englué : flaque de glu verte
    if (snap.ball && snap.ball.o === p.seat) {           // porteur : anneau doré au sol ; en charge, un arc qui se remplit (ambre → rouge)
      ctx.strokeStyle = 'rgba(255,210,74,0.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, r + 5, 0, Math.PI * 2); ctx.stroke();
      if (p.ch > 0) { ctx.strokeStyle = rgbStr(mix([255, 194, 74], [232, 65, 58], p.ch)); ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(x, y, r + 9, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p.ch); ctx.stroke(); ctx.lineCap = 'butt'; }
    }
    // chevron d'orientation, au sol devant le joueur
    { const d0 = r + (mine ? 10 : 7), s = mine ? 7 : 4.5, cx = x + Math.cos(a) * d0, cy = y + Math.sin(a) * d0, px = -Math.sin(a), py = Math.cos(a);
      ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * s, cy + Math.sin(a) * s); ctx.lineTo(cx - Math.cos(a) * s * 0.4 + px * s, cy - Math.sin(a) * s * 0.4 + py * s); ctx.lineTo(cx - Math.cos(a) * s * 0.4 - px * s, cy - Math.sin(a) * s * 0.4 - py * s); ctx.closePath();
      ctx.fillStyle = mine ? K.amber : col; ctx.strokeStyle = K.ink; ctx.lineWidth = 1.2; ctx.fill(); ctx.stroke(); }
    if (p.spr && !A.reduceFx) {                           // sprint : traits de vitesse derrière
      ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 1.4; ctx.beginPath();
      for (let k = -1; k <= 1; k++) { const ox = -Math.sin(a) * k * 6, oy = Math.cos(a) * k * 6, b = r + 4 + Math.abs(k) * 3; ctx.moveTo(x - Math.cos(a) * b + ox, y - Math.sin(a) * b + oy); ctx.lineTo(x - Math.cos(a) * (b + 12) + ox, y - Math.sin(a) * (b + 12) + oy); }
      ctx.stroke();
    }
    ctx.save(); ctx.translate(x, y); ctx.rotate(a);
    const slide = p.tk || p.dn;                        // glissade, ou encore à terre après un tacle raté
    ctx.fillStyle = '#141414';
    if (slide) { ctx.beginPath(); oval(ctx, r * 1.25, r * 0.3, r * 0.42, r * 0.22); ctx.fill(); ctx.beginPath(); oval(ctx, r * 0.2, -r * 0.55, r * 0.34, r * 0.2); ctx.fill(); }
    else { ctx.beginPath(); oval(ctx, step, r * 0.42, r * 0.36, r * 0.2); ctx.fill(); ctx.beginPath(); oval(ctx, -step, -r * 0.42, r * 0.36, r * 0.2); ctx.fill(); }
    const sh = slide ? 1.15 : 1;
    const gr = ctx.createLinearGradient(-r, -r, r, r); gr.addColorStop(0, rgbStr(mix(rc, [255, 255, 255], 0.25))); gr.addColorStop(1, rgbStr(mix(rc, [0, 0, 0], 0.25)));
    ctx.fillStyle = gr; ctx.beginPath(); oval(ctx, 0, 0, r * 0.62 * sh, r * 0.98); ctx.fill();
    const pat = seatPattern(ctx, p.seat, { size: Math.max(6, r * 0.6), ink: 'rgba(255,255,255,0.35)' });
    if (pat) { ctx.fillStyle = pat; ctx.beginPath(); oval(ctx, 0, 0, r * 0.62 * sh, r * 0.98); ctx.fill(); }
    ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 1.2; ctx.beginPath(); oval(ctx, 0, 0, r * 0.62 * sh, r * 0.98); ctx.stroke();
    const skin = SKIN[p.seat % SKIN.length], sk = rgbStr(skin);
    ctx.fillStyle = sk;
    ctx.beginPath(); ctx.arc(-step * 0.5, r * 0.98, r * 0.22, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(step * 0.5, -r * 0.98, r * 0.22, 0, Math.PI * 2); ctx.fill();
    // tête + cheveux + NEZ vers l'avant (on voit de quel côté il regarde)
    ctx.fillStyle = sk; ctx.beginPath(); ctx.arc(r * 0.1, 0, r * 0.42, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(r * 0.52, 0, r * 0.1, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = HAIR[p.seat % HAIR.length]; ctx.beginPath(); ctx.arc(-r * 0.02, 0, r * 0.36, Math.PI * 0.5, Math.PI * 1.5); ctx.arc(r * 0.06, 0, r * 0.3, Math.PI * 1.5, Math.PI * 0.5); ctx.fill();
    ctx.restore();
    if (A.contrast) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(x, y, r + 1.5, 0, Math.PI * 2); ctx.stroke(); }
    if (!A.reduceFx) {
      if (p.st) { ctx.fillStyle = K.gold; for (let k = 0; k < 3; k++) { const u = now / 180 + k * 2.09; ctx.beginPath(); ctx.arc(x + Math.cos(u) * r * 0.8, y - r * 0.2 + Math.sin(u) * r * 0.4, 2.4, 0, Math.PI * 2); ctx.fill(); } }   // sonné
      if (p.tb) { ctx.strokeStyle = 'rgba(255,210,74,0.8)'; ctx.lineWidth = 2; for (let k = 0; k < 2; k++) { const t = now / 110 + k * Math.PI; ctx.beginPath(); ctx.arc(x, y, r + 6, t, t + 0.9); ctx.stroke(); } }   // turbo : éclairs qui tournent
      if (p.iv) { ctx.strokeStyle = 'rgba(255,79,216,0.8)'; ctx.lineWidth = 1.6; const t = -now / 160; ctx.beginPath(); ctx.arc(x, y - r - 6, 5, t, t + 4.4); ctx.stroke(); }   // inversé : spirale au-dessus
      if (p.cn) { ctx.fillStyle = 'rgba(255,122,47,0.9)'; for (let k = 0; k < (p.cn | 0); k++) { ctx.beginPath(); ctx.arc(x - 4 + k * 8, y + r + 7, 2.6, 0, Math.PI * 2); ctx.fill(); } }   // canon : boulets restants
    }
    if (mine) {                                            // repère « c'est moi »
      ctx.save(); ctx.strokeStyle = K.chalk; ctx.lineWidth = 1.6; ctx.globalAlpha = A.reduceFx ? 0.85 : 0.55 + 0.4 * Math.sin(now / 200);
      ctx.beginPath(); ctx.arc(x, y, r + 8, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1;
      const ty = y - r - 12; ctx.fillStyle = K.amber; ctx.strokeStyle = K.ink; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(x - 6, ty - 8); ctx.lineTo(x + 6, ty - 8); ctx.lineTo(x, ty); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
    }
  }
  // ligne de visée : ballon au pied, dans la direction TENUE (sinon le regard), plus longue quand le tir est chargé
  function drawAim(me, v, ball, now) {
    let dx = (input.right ? 1 : 0) - (input.left ? 1 : 0), dy = (input.down ? 1 : 0) - (input.up ? 1 : 0);
    if (me.iv) { dx = -dx; dy = -dy; }
    if (!dx && !dy) { dx = Math.cos(v.a); dy = Math.sin(v.a); }
    const l = Math.hypot(dx, dy); dx /= l; dy /= l;
    const len = 50 + 190 * (me.ch || 0);
    ctx.save(); ctx.setLineDash([6, 6]); ctx.lineDashOffset = A.reduceFx ? 0 : -now / 40;
    ctx.strokeStyle = me.ch > 0 ? rgbStr(mix([255, 194, 74], [232, 65, 58], me.ch), 0.85) : 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(ball.x + dx * (BR + 2), ball.y + dy * (BR + 2)); ctx.lineTo(ball.x + dx * len, ball.y + dy * len); ctx.stroke();
    ctx.setLineDash([]); ctx.restore();
  }

  // ───────────────────────── écran titre : « FOOT » sur un tableau d'affichage ─────────────────────────
  function drawTitle(cx, cy, now) {
    const TXT = 'FOOT', anim = !A.reduceFx;
    ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    let fs = 70; ctx.font = fs + 'px ' + DISP;
    const maxW = AR * 0.5, w0 = ctx.measureText(TXT).width;
    if (w0 > maxW) { fs = Math.max(24, Math.floor(fs * maxW / w0)); ctx.font = fs + 'px ' + DISP; }
    const w = ctx.measureText(TXT).width + fs * 0.9, h = fs * 1.35;
    ctx.fillStyle = 'rgba(6,12,9,0.88)'; ctx.fillRect(cx - w / 2, cy - h / 2, w, h);
    ctx.strokeStyle = K.amber; ctx.lineWidth = 2; ctx.strokeRect(cx - w / 2 + 3, cy - h / 2 + 3, w - 6, h - 6);
    ctx.fillStyle = 'rgba(255,194,74,0.07)'; for (let yy = cy - h / 2 + 6; yy < cy + h / 2 - 6; yy += 4) ctx.fillRect(cx - w / 2 + 6, yy, w - 12, 1.4);
    if (anim) { ctx.shadowColor = 'rgba(255,194,74,0.7)'; ctx.shadowBlur = 16 + 5 * Math.sin(now / 600); }
    ctx.fillStyle = K.amber; ctx.fillText(TXT, cx, cy + fs * 0.04);
    ctx.shadowBlur = 0;
    const t = anim ? now / 1000 : 0.3, bx = cx + Math.sin(t * 1.3) * w * 0.38, by = cy - h / 2 - 16 - Math.abs(Math.sin(t * 3.2)) * 18;
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); oval(ctx, bx, cy - h / 2 - 4, 10, 3); ctx.fill();
    drawBall(bx, by, 10, t * 5, false);
    ctx.restore();
  }

  // ───────────────────────── éclairage ─────────────────────────
  function eclairer(now, V) {
    const li = (terId === 'glace' ? 0.05 : 0.1) + 0.16 * duskV, R = AR * 0.46;
    for (let i = 0; i < 4; i++) {                       // quatre tours de projecteurs dans les coins
      const a = Math.PI / 4 + i * Math.PI / 2, x = AR / 2 + Math.cos(a) * R * 1.2, y = AR / 2 + Math.sin(a) * R * 1.2, fl = 1 + 0.03 * Math.sin(now / 90 + i);
      lumiere(ctx, x, y, R * 0.95, terId === 'flipper' ? (i % 2 ? '#ff4fd8' : '#7ae8ff') : '#fff6d8', li * fl);
    }
    if (V && V.ball && snap && snap.ball && snap.ball.o < 0) {
      const b = V.ball, sp = ballPrev ? Math.hypot(b.x - ballPrev.x, b.y - ballPrev.y) : 0;
      if (sp > 4) lumiere(ctx, b.x, b.y, 26 + sp * 2, '#fffbe8', Math.min(0.35, sp * 0.03));
    }
    LUM.dessiner(ctx, now);
  }

  // ───────────────────────── rendu d'une image ─────────────────────────
  function draw() {
    if (destroyed) return;
    const now = performance.now(), kdt = Math.min(3, Math.max(0.25, (now - (lastFrame || now - 16.7)) / 16.7)); lastFrame = now;
    const sc = cv.width / AR, c = AR / 2;
    let ox = 0, oy = 0;
    if (shakeMag > 0.3 && !A.reduceFx) { ox = (Math.random() * 2 - 1) * shakeMag; oy = (Math.random() * 2 - 1) * shakeMag; shakeMag *= 0.86; } else shakeMag = 0;
    ctx.setTransform(sc, 0, 0, sc, ox * sc, oy * sc);
    if (!G) { ctx.fillStyle = K.night; ctx.fillRect(0, 0, AR, AR); return; }
    ensureDecor(); ctx.drawImage(decorCv, 0, 0, AR, AR);
    const V = snap ? view(now) : null;
    if (!A.reduceFx) eclairer(now, V);
    let duskT = 0;
    if (snap && (snap.gs === 'play' || snap.gs === 'paused' || snap.gs === 'over')) {
      if (snap.sd) duskT = Math.min(0.5, (now - sdT0) / 60000 * 0.5);
      duskT = Math.max(duskT, DUEL.t(snap, now, duelAnnonce));
    }
    duskV += (duskT - duskV) * Math.min(1, 0.04 * kdt); if (duskV < 0.002) duskV = 0;
    drawGoals(now);
    drawBumpers(now);
    drawItems(now);
    if (snap && V) {
      const over = snap.gs === 'over';
      snap.players.forEach(p => {                          // animation de course : la phase avance avec la vitesse affichée
        if (!p.playing || !p.alive) return;
        const v = V.pl[p.seat]; if (!v) return;
        const pr = runPhase['p' + p.seat], d = pr ? Math.hypot(v.x - pr.x, v.y - pr.y) : 0;
        runPhase['p' + p.seat] = { x: v.x, y: v.y };
        runPhase[p.seat] = ((runPhase[p.seat] || 0) + (A.reduceFx ? 0 : Math.min(1.2, d * 0.32))) % (Math.PI * 2);
        if ((p.tk || (p.spr && Math.random() < 0.35)) && !A.reduceFx && Math.random() < 0.6 * kdt) grass(v.x - Math.cos(v.a) * PR, v.y - Math.sin(v.a) * PR, 1, 0.8, v.a + Math.PI);
      });
      const b = V.ball;
      if (b) {
        const sp = ballPrev ? Math.hypot(b.x - ballPrev.x, b.y - ballPrev.y) : 0;
        if (sp < 40) ballSpin += sp / BR * 0.6;
        if (!A.reduceFx && b.o < 0 && sp > 3.5) { trail.push({ x: b.x, y: b.y, t: now }); if (trail.length > 10) trail.shift(); } else if (trail.length && now - trail[trail.length - 1].t > 120) trail = [];
        ballPrev = { x: b.x, y: b.y };
        for (let i = 0; i < trail.length; i++) { const q = trail[i], al = (i + 1) / trail.length * 0.28; ctx.fillStyle = 'rgba(255,255,240,' + al + ')'; ctx.beginPath(); ctx.arc(q.x, q.y, BR * (0.4 + 0.6 * (i + 1) / trail.length), 0, Math.PI * 2); ctx.fill(); }
      }
      const me = mySeat >= 0 ? snap.players[mySeat] : null;
      if (me && me.playing && me.alive && b && b.o === mySeat && snap.gs === 'play' && V.pl[mySeat]) drawAim(me, V.pl[mySeat], b, now);
      const ordre = snap.players.filter(p => p.playing && p.alive && V.pl[p.seat]).sort((p, q) => (p.seat === (b && b.o) ? 1 : 0) - (q.seat === (b && b.o) ? 1 : 0));
      ordre.forEach(p => drawPlayer(p, V.pl[p.seat], now, over));
      if (b) drawBall(b.x, b.y, BR, ballSpin);
      if (over && !A.reduceFx) snap.players.forEach(p => { if (!p.playing || !p.alive || p.team !== snap.winner) return; const v = V.pl[p.seat]; if (!v) return; ctx.save(); ctx.strokeStyle = K.gold; ctx.lineWidth = 2.5; ctx.globalAlpha = 0.5 + 0.4 * Math.sin(now / 180); ctx.beginPath(); ctx.arc(v.x, v.y, PR + 10, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); });
      if (snap.gs !== 'play' || A.contrast) G.forEach(e => {   // qui défend quelle cage
        if (e.owner < 0 || !snap.players[e.owner] || !snap.players[e.owner].playing) return;
        const x = e.mx + e.nx * 26, y = e.my + e.ny * 26;
        ctx.save(); ctx.font = 'bold 11px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.7)';
        const nm = cageNom(e.owner).slice(0, 12); ctx.strokeText(nm, x, y); ctx.fillStyle = colSeat(e.owner); ctx.fillText(nm, x, y); ctx.restore();
      });
    }
    drawWeather(now, kdt);
    if (!A.reduceFx) {
      ctx.save();
      for (let i = puffs.length - 1; i >= 0; i--) { const q = puffs[i], tt = (now - q.born) / q.life; if (tt >= 1) { puffs.splice(i, 1); continue; } q.x += q.vx * kdt; q.y += q.vy * kdt; q.vx *= 0.92; q.vy *= 0.92; ctx.globalAlpha = 1 - tt; ctx.fillStyle = q.col; ctx.fillRect(q.x, q.y, q.r, q.r * 2.2); }
      for (let i = confs.length - 1; i >= 0; i--) { const q = confs[i], tt = (now - q.born) / q.life; if (tt >= 1) { confs.splice(i, 1); continue; } q.x += q.vx * kdt; q.y += q.vy * kdt; q.vx *= 0.97; q.vy = q.vy * 0.97 + 0.06 * kdt; q.rot += q.vr * kdt; ctx.globalAlpha = tt > 0.7 ? (1 - tt) / 0.3 : 1; ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot); ctx.fillStyle = q.col; ctx.fillRect(-3, -1.5, 6, 3); ctx.restore(); }
      for (let i = waves.length - 1; i >= 0; i--) { const q = waves[i], tt = (now - q.born) / q.life; if (tt >= 1) { waves.splice(i, 1); continue; } const e = 1 - (1 - tt) * (1 - tt); ctx.globalAlpha = 0.7 * (1 - tt); ctx.strokeStyle = 'rgb(' + q.col + ')'; ctx.lineWidth = q.lw * (1 - tt * 0.6); ctx.beginPath(); ctx.arc(q.x, q.y, q.r0 + (q.r1 - q.r0) * e, 0, Math.PI * 2); ctx.stroke(); }
      for (let i = sparks.length - 1; i >= 0; i--) { const q = sparks[i], tt = (now - q.born) / q.life; if (tt >= 1) { sparks.splice(i, 1); continue; } ctx.globalAlpha = 1 - tt; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5; ctx.beginPath(); for (let k = 0; k < 6; k++) { const u = k * 1.047, r0 = 3 + tt * 4, r1 = 6 + tt * 12; ctx.moveTo(q.x + Math.cos(u) * r0, q.y + Math.sin(u) * r0); ctx.lineTo(q.x + Math.cos(u) * r1, q.y + Math.sin(u) * r1); } ctx.stroke(); }
      ctx.restore();
    } else { puffs.length = 0; confs.length = 0; waves.length = 0; sparks.length = 0; }
    crepuscule(ctx, -24, -24, AR + 48, AR + 48, duskV, { soleil: false, force: A.contrast ? 0.45 : A.reduceFx ? 0.55 : 1 });
    drawWindGauge(now);
    for (let i = texts.length - 1; i >= 0; i--) {         // bandeaux « BUT ! », « POTEAU ! »
      const o = texts[i], t = (now - o.born) / 1500; if (t >= 1) { texts.splice(i, 1); continue; }
      const s = A.reduceFx ? 1 : (t < 0.1 ? 0.4 + 0.8 * t / 0.1 : t < 0.2 ? 1.2 - 0.2 * (t - 0.1) / 0.1 : 1);
      ctx.save(); ctx.translate(c, c - 30); ctx.scale(s, s); ctx.globalAlpha = t > 0.75 ? (1 - t) / 0.25 : 1;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
      const big = o.txt === 'BUT !' ? 64 : 38; ctx.font = big + 'px ' + DISP;
      ctx.lineWidth = 9; ctx.strokeStyle = K.ink; ctx.strokeText(o.txt, 0, 0); ctx.fillStyle = o.col; ctx.fillText(o.txt, 0, 0);
      if (o.sub) { ctx.font = 'bold 15px system-ui, sans-serif'; ctx.lineWidth = 4; ctx.strokeText(o.sub, 0, big * 0.62); ctx.fillStyle = K.chalk; ctx.fillText(o.sub, 0, big * 0.62); }
      ctx.restore();
    }
    // jauges du joueur local : tir (charge), sprint (endurance), tacle (recharge) + effets actifs
    const me = (snap && mySeat >= 0) ? snap.players[mySeat] : null;
    if (me && me.playing && me.alive && snap.gs === 'play') {
      const aLui = snap.ball && snap.ball.o === mySeat;
      // une cage en bas du cadre : jauges empilées dans le coin bas gauche (sinon elles masquaient filet et vies)
      const basOccupe = G.some(e => e.owner !== -1 && e.ny < -0.9 && e.my > AR - MARGE - 2);
      const bw = basOccupe ? 74 : 96, bh = 9, gapx = 12, x0 = basOccupe ? 10 : c - (bw * 3 + gapx * 2) / 2;
      let y = AR - 18;
      const pos = i => { if (basOccupe) { y = AR - 18 - (2 - i) * 24; return x0; } y = AR - 18; return x0 + i * (bw + gapx); };
      const gauge = (x, v, col, lab, pret) => {
        ctx.fillStyle = 'rgba(6,12,9,0.78)'; ctx.fillRect(x - 2, y - 2, bw + 4, bh + 4);
        ctx.fillStyle = col; ctx.fillRect(x, y, bw * Math.max(0, Math.min(1, v || 0)), bh);
        ctx.strokeStyle = 'rgba(242,246,238,0.55)'; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, bw - 1, bh - 1);
        ctx.fillStyle = '#f2f6ee'; ctx.font = 'bold 9.5px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
        ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.7)'; const t = lab + (pret ? ' · ' + pret : ''); ctx.strokeText(t, x + bw / 2, y - 3); ctx.fillText(t, x + bw / 2, y - 3);
      };
      if (me.ch > 0) gauge(pos(0), 0.999 * me.ch + 0.001, rgbStr(mix([255, 194, 74], [232, 65, 58], me.ch)), 'TIR', Math.round(me.ch * 100) + ' %' + (me.ch >= 1 ? ' · BOULET' : ''));
      else gauge(pos(0), aLui ? 1 : 0, aLui ? K.gold : 'rgba(242,246,238,0.3)', 'TIR (Espace)', aLui ? (me.cn ? 'CANON ×' + me.cn : 'PRÊT') : '');
      gauge(pos(1), me.tb ? 1 : me.sta, me.tb ? K.gold : me.ess ? '#e8413a' : '#7ae8ff', 'SPRINT (Maj)', me.tb ? 'TURBO' : me.ess ? 'ESSOUFFLÉ' : '');
      gauge(pos(2), me.tcd, me.tcd >= 1 ? K.chalk : 'rgba(242,246,238,0.35)', 'TACLE (E)', me.tcd >= 1 ? 'PRÊT' : '');
      const tags = []; if (me.gl) tags.push(['ENGLUÉ', IT_LOOK.glu.c]); if (me.iv) tags.push(['INVERSÉ', IT_LOOK.inverse.c]);
      if (tags.length) {
        ctx.font = 'bold 10px system-ui, sans-serif'; const ws = tags.map(t => ctx.measureText(t[0]).width + 14), tot = ws.reduce((s, w) => s + w + 6, -6);
        let x = basOccupe ? x0 : c - tot / 2; const ty = basOccupe ? AR - 18 - 3 * 24 - 8 : y - 32;
        tags.forEach((t, i) => { ctx.fillStyle = 'rgba(6,12,9,0.85)'; ctx.fillRect(x, ty, ws[i], 15); ctx.fillStyle = t[1]; ctx.fillRect(x, ty, 3, 15); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t[0], x + ws[i] / 2 + 1, ty + 8); x += ws[i] + 6; });
      }
    }
    if (snap && snap.gs === 'countdown') {             // tableau d'affichage : 3 · 2 · 1 · COUP D'ENVOI
      ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.fillRect(0, 0, AR, AR); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const n = snap.count || 0, pulse = A.reduceFx ? 1 : 1 + 0.06 * Math.sin(now / 110);
      ctx.save(); ctx.translate(c, c - 40); ctx.scale(pulse, pulse);
      ctx.fillStyle = 'rgba(6,12,9,0.9)'; ctx.fillRect(-80, -50, 160, 100); ctx.strokeStyle = K.amber; ctx.lineWidth = 2; ctx.strokeRect(-76, -46, 152, 92);
      ctx.fillStyle = K.amber; ctx.font = (n > 0 ? 70 : 22) + 'px ' + DISP; ctx.fillText(n > 0 ? n : 'COUP D\'ENVOI', 0, 4);
      ctx.restore();
      ctx.save(); ctx.font = 'bold 14px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,0.75)';
      const sub = LOOK().i + ' ' + LOOK().nom; ctx.strokeText(sub, c, c + 34); ctx.fillStyle = K.chalk; ctx.fillText(sub, c, c + 34); ctx.restore();
    }
    if (snap && snap.frz && snap.gs === 'play') {
      ctx.save(); ctx.font = 'bold 13px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,0.7)';
      ctx.strokeText('Engagement au centre…', c, AR - 56); ctx.fillStyle = K.chalk; ctx.fillText('Engagement au centre…', c, AR - 56); ctx.restore();
    }
    if (snap && (snap.gs === 'lobby' || snap.gs === 'paused')) {
      ctx.fillStyle = 'rgba(4,10,7,0.55)'; ctx.fillRect(0, 0, AR, AR); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      if (snap.gs === 'paused') {
        ctx.fillStyle = K.chalk; ctx.font = '38px ' + DISP; ctx.fillText('PAUSE', c, c - 8);
        ctx.fillStyle = 'rgba(242,246,238,.6)'; ctx.font = '14px system-ui, sans-serif'; ctx.fillText('Temps mort — P / Échap pour reprendre', c, c + 28);
      } else {
        drawTitle(c, c - 50, now);
        const n = snap.connected || 0, nb = snap.botCount || 0, tot = n + nb, y0 = c + 56, sel = snap.opt && snap.opt.ter;
        const tl = sel === 'hasard' ? '🎲 Terrain au hasard' : LOOK().i + ' ' + LOOK().nom;
        ctx.fillStyle = teamMode ? '#ffe2a0' : 'rgba(242,246,238,.85)'; ctx.font = '15px system-ui, sans-serif';
        ctx.fillText(`${n} joueur${n > 1 ? 's' : ''}${nb ? ' + ' + nb + ' bot' + (nb > 1 ? 's' : '') : ''}${teamMode ? ' · ' + (MODE_NAME[snap.mode] || snap.mode) : ''} · ${snap.lives || 3} vie${(snap.lives || 3) > 1 ? 's' : ''} · ${tl}`, c, y0);
        ctx.fillStyle = 'rgba(242,246,238,.65)'; ctx.font = 'bold 13px system-ui, sans-serif';
        ctx.fillText(tot >= 2 ? '▶ Espace / clic pour le coup d\'envoi' : 'En attente d\'un 2ᵉ joueur… (ou ajoute un bot 🤖)', c, y0 + 26);
      }
    }
  }
  function drawLoop() { if (destroyed) return; try { draw(); } catch (e) { console.error('[render]', e); } rafId = requestAnimationFrame(drawLoop); }

  // ───────────────────────── entrées ─────────────────────────
  function pushInput() { send({ t: 'input', up: input.up, down: input.down, left: input.left, right: input.right }); }
  function setIn(k, v) { if (input[k] === v) return; input[k] = v; pushInput(); }
  const isPlay = () => snap && (snap.gs === 'play' || snap.gs === 'paused');
  const onKeyDown = e => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
    unlockAudio();
    if (e.repeat) return;
    if (e.key === ' ') { if (snap && (snap.gs === 'lobby' || snap.gs === 'over')) send({ t: 'start' }); else if (snap && (snap.gs === 'play' || snap.gs === 'countdown')) charge(true); return; }
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.key === 'Shift') { sprint(true); return; }
    if (e.code === 'KeyE' && isPlay()) { send({ t: 'tackle' }); return; }
    if ((e.key === 'p' || e.key === 'P' || e.key === 'Escape') && isPlay()) { send({ t: 'pause' }); return; }
    const d = DIR_KEYS[e.code]; if (d) setIn(d, true);
  };
  const onKeyUp = e => {
    if (e.key === ' ') { charge(false); return; }
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.key === 'Shift') { sprint(false); return; }
    const d = DIR_KEYS[e.code]; if (d) setIn(d, false);
  };
  const onBlur = () => { let ch = false; for (const k in input) if (input[k]) { input[k] = false; ch = true; } if (ch) pushInput(); if (chargeOn) { chargeOn = false; send({ t: 'charge', on: false, cancel: true }); } sprint(false); };
  // tir chargé : Espace (ou ⚽) enfoncé = charge, relâché = tir ; la puissance est mesurée par le SERVEUR
  let chargeOn = false, sprintOn = false;
  function charge(on) { if (on === chargeOn) return; chargeOn = on; send({ t: 'charge', on }); }
  function sprint(on) { if (on === sprintOn) return; sprintOn = on; send({ t: 'sprint', on }); }
  function hold(id, k) { const el = $(id); if (!el) return; const on = e => { e.preventDefault(); unlockAudio(); setIn(k, true); }; const off = e => { e.preventDefault(); setIn(k, false); }; el.addEventListener('pointerdown', on); el.addEventListener('pointerup', off); el.addEventListener('pointerleave', off); el.addEventListener('pointercancel', off); }
  function holdFn(id, fn) { const el = $(id); if (!el) return; const on = e => { e.preventDefault(); unlockAudio(); fn(true); }, off = e => { e.preventDefault(); fn(false); }; el.addEventListener('pointerdown', on); el.addEventListener('pointerup', off); el.addEventListener('pointerleave', off); el.addEventListener('pointercancel', off); }
  function tap(id, t) { const el = $(id); if (!el) return; el.addEventListener('pointerdown', e => { e.preventDefault(); unlockAudio(); send({ t }); }); }

  // Module singleton (import() en cache) : init() est rappelé à chaque retour sur le jeu → écouteurs DOM branchés une fois.
  let cable = false;
  function init(ctx0) {
    const premiere = !cable; cable = true;
    destroyed = false;
    A = ctx0.a11y; send = ctx0.send; root = ctx0.root;
    if (ctx0.togglePanel) togglePanel = ctx0.togglePanel; if (ctx0.closePanels) closePanels = ctx0.closePanels;
    cv = $('ftc'); ctx = cv.getContext('2d'); hud = $('ftHud'); endEl = $('ftEnd');
    decorKey = ''; geoKey = '';
    const wrap = cv.parentElement;
    initGameMsg(wrap && wrap.classList.contains('canvas-wrap') ? wrap : null);
    hud.innerHTML = '';
    cards = Array.from({ length: MAX_SEATS }, (_, i) => i).map(i => { const el = document.createElement('div'); el.className = 'pc hidden'; el.innerHTML = `<div class="dot"></div><div class="inf"><div class="pn">P${i + 1}</div><div class="lv"></div></div>`; hud.appendChild(el); return el; });
    startBtn = $('ftStart'); pauseBtn = $('ftPause'); modeBtn = $('ftMode'); botsBtn = $('ftBots'); diffBtn = $('ftDiff'); livesBtn = $('ftLives'); pauseFloat = $('ftPauseFloat');
    lbBtn = $('ftLbBtn'); lbPanel = $('ftLbPanel'); lbBody = $('ftLbBody'); shootBtn = $('ftShoot'); tackleBtn = $('ftTackle'); sprintBtn = $('ftSprint');
    optBtn = $('ftOpt'); optPanel = $('ftOptPanel'); buildOptPanel();
    startBtn.onclick = () => { unlockAudio(); send({ t: 'start' }); };
    pauseBtn.onclick = () => send({ t: 'pause' });
    pauseFloat.onclick = () => send({ t: 'pause' });
    modeBtn.onclick = () => send({ t: 'mode' });
    if (botsBtn) botsBtn.onclick = () => send({ t: 'bots' });
    if (diffBtn) diffBtn.onclick = () => send({ t: 'botdiff' });
    if (livesBtn) livesBtn.onclick = () => send({ t: 'lives' });
    if (optBtn && optPanel) optBtn.onclick = () => togglePanel(optPanel);
    lbBtn.onclick = () => { togglePanel(lbPanel); renderLB(); };
    const helpBtn = $('ftHelp'), helpPanel = $('ftHelpPanel'); if (helpBtn && helpPanel) helpBtn.onclick = () => togglePanel(helpPanel);
    if (premiere) cv.addEventListener('click', () => { unlockAudio(); if (snap && !isPlay() && snap.gs !== 'countdown') send({ t: 'start' }); });
    if (premiere) endEl.addEventListener('click', () => { unlockAudio(); send({ t: 'start' }); });
    if (premiere) { hold('ftUp', 'up'); hold('ftDown', 'down'); hold('ftLeft', 'left'); hold('ftRight', 'right'); tap('ftTackle', 'tackle'); holdFn('ftShoot', charge); holdFn('ftSprint', sprint); }
    applyColors();
    resizeH = resizeCanvas; addEventListener('resize', resizeH); resizeCanvas();
    addEventListener('keydown', onKeyDown); addEventListener('keyup', onKeyUp); addEventListener('blur', onBlur);
    music.start();
    rafId = requestAnimationFrame(drawLoop);
  }
  function onA11y() { applyColors(); }
  function teardown() {
    destroyed = true; music.stop(); cancelAnimationFrame(rafId); J.fin(); LUM.vider();
    removeEventListener('resize', resizeH); removeEventListener('keydown', onKeyDown); removeEventListener('keyup', onKeyUp); removeEventListener('blur', onBlur);
    for (const k in input) input[k] = false;
    chargeOn = false; sprintOn = false;                  // (rien envoyé : le hub a peut-être déjà changé de jeu)
  }

  return { init, onState, onMessage, onLb, onA11y, teardown };
})();
