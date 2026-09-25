// Module client FOOT : terrain polygonal vu de dessus (une cage par joueur, comme les raquettes de Pong),
// un seul ballon, 30 Hz interpolés. Structure calquée sur le Sumo (HUD, écran de fin, décor pré-rendu,
// câblage unique des écouteurs). Identité propre « Stade de nuit » : pelouse tondue en bandes, craie,
// filets, projecteurs, tribunes, tableau d'affichage ambre.
import { AR0, PITCH, PR, BR, POST_R, GOAL0 } from './shared.js';
import { createMusic } from '../../music.js';
import { seatPattern, SEAT_GLYPH } from '../../patterns.js';   // motif par siège, imprimé sur le maillot
import { initGameMsg, msgPerso, msgGlobal } from '../../gamemsg.js';
import { arenaSize } from '../../layout.js';
import { lumiere, creerLumieres } from '../../lumiere.js';      // projecteurs, ballon frappé, buts
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
// Identité « Stade de nuit » : palette fixe (comme Tanks/Snake/Sumo, le thème Néon/CRT/Clair ne s'applique pas)
const K = { night: '#08140f', grass: '#2e8b3e', grass2: '#34994a', chalk: '#f2f6ee', amber: '#ffc24a', red: '#e8413a', ink: '#0b1510', gold: '#ffd24a' };
const DISP = "'Russo One', Impact, sans-serif";
const SKIN = [[241, 196, 160], [214, 160, 118], [168, 112, 78], [120, 78, 52]];   // teintes de peau, attribuées par siège
const HAIR = ['#2a1a10', '#6b3e1e', '#c99a4a', '#141414', '#8a4a22', '#e0c070', '#3a2414', '#1d1d1d', '#a0522d', '#4a2c18'];
// ZQSD / WASD / flèches : codes PHYSIQUES (KeyW = touche Z en AZERTY) + KeyZ/KeyQ pour un clavier réglé en QWERTY
const DIR_KEYS = { ArrowUp: 'up', KeyW: 'up', KeyZ: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', KeyQ: 'left', ArrowRight: 'right', KeyD: 'right' };

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
  let AR = AR0, G = null, geoKey = '';                  // géométrie courante (reconstruite quand le serveur change le terrain)
  const puffs = [], waves = [], sparks = [], confs = [], texts = [];
  let shakeMag = 0, rafId = 0, destroyed = false, resizeH = null, actx = null, noiseBuf = null, lastFrame = 0;
  let ballSpin = 0, ballPrev = null, trail = [], netHit = {}, lastBallO = -1;
  const LUM = creerLumieres(24), J = creerJournal({ pas: 500 });
  let duskV = 0, sdT0 = 0, jRound = -1, jLast = -1e9, serie = {};
  const music = createMusic(() => actx, () => A, MUSIC_THEME);
  const input = { up: false, down: false, left: false, right: false };
  let hud, cards, startBtn, pauseBtn, modeBtn, botsBtn, diffBtn, livesBtn, pauseFloat, lbBtn, lbPanel, lbBody, endEl, shootBtn, tackleBtn;
  const runPhase = {};                                  // par siège : phase de course (animation des jambes)

  const $ = id => root.querySelector('#' + id);
  const colSeat = s => { if (s < 0 || !snap) return '#fff'; const p = snap.players[s]; return teamMode && p ? TEAMCC[p.team % TEAMCC.length] : CC[s % CC.length]; };
  const nameOf = s => { const p = snap && snap.players[s]; return p ? (p.name || ('P' + (s + 1))) : '?'; };
  function applyColors() { CC = PAL[A.palette] || PAL.normal; TEAMCC = TEAMPAL[A.palette] || TEAMPAL.normal; decorKey = ''; if (A.reduceFx) LUM.vider(); }

  function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1, size = arenaSize({ max: 760 });
    cv.style.width = size + 'px'; cv.style.height = size + 'px';
    cv.width = Math.round(size * dpr); cv.height = Math.round(size * dpr);
  }

  // ───────────────────────── géométrie reçue du serveur ─────────────────────────
  function syncGeo(m) {
    if (!m.geo || !m.geo.e) return;
    const key = AR + '|' + JSON.stringify(m.geo.e);
    if (key === geoKey) return;
    geoKey = key;
    const c = AR / 2;
    G = m.geo.e.map(a => {
      const ax = a[0], ay = a[1], bx = a[2], by = a[3], dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1;
      const mx = (ax + bx) / 2, my = (ay + by) / 2; let nx = c - mx, ny = c - my; const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl;
      return { ax, ay, bx, by, tx: dx / len, ty: dy / len, nx, ny, len, mx, my, apo: nl, owner: a[4], open: !!a[5] };
    });
  }
  const halfW = e => e.len * ((snap && snap.gw) || GOAL0) / 2;
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
      if (p.st) st.push('💫');
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
    const who = champ ? (teamMode ? 'Équipe ' + TEAM_LETTER[m.winner] : esc(champ.name || ('P' + (champ.seat + 1)))) : null;
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
      <div class="emeta">⏱ ${m.stats.durationSec}s · ${m.stats.nParts} joueurs</div>${mvpLine}<div class="elist">${rows}</div>${jRound === m.round ? blocFin(J, { titre: 'Vies au fil du match', couleur: s => colSeat(s), nom: s => nameOf(s), max: m.lives || 3 }) : ''}<div class="ehint">Espace / clic pour rejouer</div>`;
  }

  // ───────────────────────── état réseau ─────────────────────────
  function onMessage(m) { if (m && m.t === 'welcome') mySeat = m.seat; }
  function onLb(d) { board = (d && d.board) || []; renderLB(); }
  function onState(m) {
    if (m.ar && m.ar !== AR) { AR = m.ar; decorKey = ''; geoKey = ''; }
    snap = m; teamMode = !!(m.mode && m.mode !== 'ffa');
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
    lastCount = m.count;
    if (m.sd && !prevSd) { sdT0 = performance.now(); music.sting('alert'); msgGlobal('⚠', 'Prolongations : les cages s\'agrandissent !', { bad: true }); }
    prevSd = !!m.sd;
    prevGs = m.gs;
    { let inten = 0;
      if (m.gs === 'play' || m.gs === 'countdown') { inten = 1; const tot = m.players.filter(p => p.playing).length, alive = m.players.filter(p => p.playing && p.alive).length; if (m.sd || (tot >= 3 && alive <= 2)) inten = 2; }
      music.setIntensity(inten); }
    refreshHUD();
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
    const victim = nameOf(f.seat);
    if (f.own || f.by < 0) { J.moment(now, f.seat, f.own ? 'contre son camp' : 'a encaissé un but', 1); return; }
    const s = serie[f.by] = (serie[f.by] || 0) + 1;
    if (s === 3) J.moment(now, f.by, 'coup du chapeau (3e but, sur ' + victim + ')', 9);
    else if (f.lives === 0) J.moment(now, f.by, 'a éliminé ' + victim + ' d\'un but', 6);
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
    else if (k === 'miss') noise(0.2, 'lowpass', 500, 0.08);
    else if (k === 'grab') tone(210, 0.05, 'sine', 0.06, 0, 120);
    else if (k === 'slide') noise(0.28, 'bandpass', 2600, 0.07, 0, 0.8);                                          // glissade dans l'herbe
    else if (k === 'tackle') { tone(110, 0.12, 'sine', 0.14, 0, 55); noise(0.08, 'lowpass', 700, 0.1); }
    else if (k === 'post') { tone(1480, 0.5, 'sine', 0.05); tone(2220, 0.35, 'sine', 0.03); tone(180, 0.1, 'sine', 0.1); }   // « poing » métallique
    else if (k === 'wall') tone(130, 0.07, 'sine', 0.06 + 0.1 * (arg || 0), 0, 80);
    else if (k === 'goal') { noise(2.2, 'bandpass', 700, 0.16, 0, 0.5); noise(1.6, 'bandpass', 1300, 0.08, 0.1, 0.6); tone(261.63, 0.3, 'square', 0.03, 0.05); tone(329.63, 0.3, 'square', 0.03, 0.2); tone(392, 0.5, 'square', 0.03, 0.35); }   // clameur du public + fanfare
    else if (k === 'ooh') noise(1.2, 'bandpass', 480, 0.08, 0, 0.9);
    else if (k === 'count') tone(880, 0.1, 'square', 0.03);
    else if (k === 'win') { tone(392, 0.25, 'square', 0.04); tone(523.25, 0.25, 'square', 0.04, 0.14); tone(659.25, 0.25, 'square', 0.04, 0.28); tone(783.99, 0.55, 'square', 0.04, 0.42); noise(2, 'bandpass', 800, 0.12, 0.1, 0.5); }
  }

  // ───────────────────────── effets ponctuels ─────────────────────────
  function grass(x, y, n, spd, ang) {                   // brins d'herbe et motte arrachés (tacle, frappe)
    if (A.reduceFx) return; const now = performance.now();
    for (let k = 0; k < n; k++) { const a = (ang == null ? Math.random() * Math.PI * 2 : ang + (Math.random() - 0.5) * 1.4), sp = (0.4 + Math.random()) * spd; puffs.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, born: now, life: 380 + Math.random() * 380, r: 1 + Math.random() * 1.6, col: Math.random() < 0.7 ? '#4fb45e' : '#7a5a34' }); }
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
    if (f.type === 'shot') { const pw = +f.f || 0; psound('kick', f.x, pw); grass(f.x, f.y, 3 + Math.round(6 * pw), 1 + pw); if (!A.reduceFx) { LUM.ajouter(f.x, f.y, 30 + 40 * pw, '#fff4d0', 200, 0.25 + 0.3 * pw); if (pw > 0.8) shakeMag = Math.max(shakeMag, 2.5); } return; }
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
    if (f.type === 'goal') {
      psound('goal', f.x);
      netHit[f.seat] = { t: now, x: f.x, y: f.y };
      const col = f.by >= 0 ? colSeat(f.by) : K.chalk;
      if (f.own) banner('CONTRE SON CAMP', K.red, nameOf(f.seat));
      else banner('BUT !', col, f.by >= 0 ? nameOf(f.by) + ' ➜ ' + nameOf(f.seat) : '');
      if (f.seat === mySeat) msgPerso('🥅', f.lives > 0 ? 'But encaissé — ' + f.lives + ' vie' + (f.lives > 1 ? 's' : '') + ' restante' + (f.lives > 1 ? 's' : '') : 'Dernier but encaissé : éliminé !', { bad: true });
      else if (f.by === mySeat) msgPerso('⚽', 'BUT ! Contre ' + nameOf(f.seat), { color: K.gold });
      momentBut(f, now);
      if (A.reduceFx) return;
      shakeMag = Math.max(shakeMag, 9); confetti(f.x, f.y, col, 70);
      LUM.ajouter(f.x, f.y, 180, col, 900, 0.55); LUM.ajouter(f.x, f.y, 60, '#ffffff', 400, 0.6);
      return;
    }
    if (f.type === 'out') { music.sting('kill'); if (f.seat === mySeat) msgPerso('✖', 'Ta cage est fermée : éliminé', { bad: true }); return; }
    if (f.type === 'whistle') { whistle(f.k === 'end' ? 3 : f.k === 'kick' ? 1 : 2, f.k === 'end' || f.k === 'go'); return; }
  }

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

  // ───────────────────────── décor statique pré-rendu ─────────────────────────
  // Tribunes (foule en pointillés de couleur), panneaux publicitaires, pelouse tondue en bandes découpée au polygone,
  // craie (contour, rond central, arcs de surface, points de pénalty, quarts de cercle des coins), vignette.
  let decorCv = null, decorKey = '';
  function polyPath(g, inset) {
    const c = AR / 2; g.beginPath();
    G.forEach((e, i) => { const k = (e.apo - inset) / e.apo, x = c + (e.ax - c) * k, y = c + (e.ay - c) * k; if (i === 0) g.moveTo(x, y); else g.lineTo(x, y); });
    g.closePath();
  }
  function ensureDecor() {
    if (!G) return;
    const key = cv.width + '|' + geoKey + '|' + (A.contrast ? 1 : 0) + '|' + (A.reduceFx ? 1 : 0);
    if (decorCv && key === decorKey) return;
    decorKey = key;
    if (!decorCv) decorCv = document.createElement('canvas');
    decorCv.width = cv.width; decorCv.height = cv.height;
    const g = decorCv.getContext('2d'), W = AR, c = W / 2, R = W * PITCH, rnd = rng(0xf007 + Math.round(W));
    g.setTransform(cv.width / W, 0, 0, cv.width / W, 0, 0);
    // 1) nuit et tribunes : béton sombre, rangées de spectateurs (points de couleur) en couronne autour du terrain
    const bg = g.createRadialGradient(c, c, R * 0.6, c, c, W * 0.75); bg.addColorStop(0, '#12261b'); bg.addColorStop(1, '#050b08');
    g.fillStyle = bg; g.fillRect(0, 0, W, W);
    const foule = ['#e8413a', '#f2f6ee', '#4a9ee0', '#ffc24a', '#2aaf7a', '#9b6cf0', '#e268b0', '#1a1a1a'];
    for (let k = 0; k < 2600; k++) {
      const a = rnd() * Math.PI * 2, d = R * 1.13 + rnd() * W * 0.5, x = c + Math.cos(a) * d, y = c + Math.sin(a) * d;
      if (x < 0 || y < 0 || x > W || y > W) continue;
      g.fillStyle = foule[(rnd() * foule.length) | 0]; g.globalAlpha = 0.18 + rnd() * 0.25; g.fillRect(x, y, 1.6 + rnd(), 1.6 + rnd());
    }
    g.globalAlpha = 1;
    // 2) piste autour : liseré sombre + panneaux publicitaires le long de chaque côté (hors cage)
    polyPath(g, -26); g.fillStyle = '#0e1f15'; g.fill();
    polyPath(g, -14); g.fillStyle = '#153322'; g.fill();
    G.forEach((e, i) => {
      const n = 4, seg = e.len / n;
      for (let s = 0; s < n; s++) {
        const u0 = s * seg + 6, u1 = (s + 1) * seg - 6; if (Math.abs((u0 + u1) / 2 - e.len / 2) < e.len * 0.36) continue;   // pas derrière la cage
        const hue = ['#1f4fa8', '#b8321f', '#e0a92e', '#1c7a3e', '#6b2fb0'][(i + s) % 5];
        const p0x = e.ax + e.tx * u0 - e.nx * 20, p0y = e.ay + e.ty * u0 - e.ny * 20;
        g.save(); g.translate(p0x, p0y); g.rotate(Math.atan2(e.ty, e.tx));
        g.fillStyle = hue; g.fillRect(0, -3, u1 - u0, 7);
        g.fillStyle = 'rgba(255,255,255,0.7)'; for (let q = 4; q < u1 - u0 - 4; q += 7) g.fillRect(q, -1, 4, 3);   // « texte » stylisé
        g.restore();
      }
    });
    // 3) pelouse : bandes de tonte perpendiculaires au côté du haut, découpées au polygone, grain
    g.save(); polyPath(g, 0); g.clip();
    g.fillStyle = K.grass; g.fillRect(0, 0, W, W);
    const bw = R / 5;
    for (let y = c - R * 1.2, k = 0; y < c + R * 1.2; y += bw, k++) { g.fillStyle = k % 2 ? K.grass2 : K.grass; g.fillRect(0, y, W, bw); }
    for (let k = 0; k < 3200; k++) { const x = rnd() * W, y = rnd() * W; g.fillStyle = rnd() < 0.5 ? 'rgba(0,0,0,0.08)' : 'rgba(170,230,150,0.08)'; g.fillRect(x, y, 1.2, 2.4); }
    const lg = g.createRadialGradient(c, c - R * 0.2, R * 0.1, c, c, R * 1.15); lg.addColorStop(0, 'rgba(255,255,230,0.08)'); lg.addColorStop(1, 'rgba(0,0,0,0.22)');
    g.fillStyle = lg; g.fillRect(0, 0, W, W);
    // 4) craie
    g.strokeStyle = 'rgba(242,246,238,0.85)'; g.lineWidth = 2.2; g.lineJoin = 'round';
    polyPath(g, 4); g.stroke();
    g.beginPath(); g.arc(c, c, R * 0.2, 0, Math.PI * 2); g.stroke();
    g.fillStyle = 'rgba(242,246,238,0.9)'; g.beginPath(); g.arc(c, c, 3, 0, Math.PI * 2); g.fill();
    G.forEach(e => {                                    // surface de réparation : arc devant la cage + point de pénalty
      const r = Math.min(e.len * 0.22, e.apo * 0.3), a0 = Math.atan2(e.ny, e.nx);
      g.beginPath(); g.arc(e.mx - e.nx * 4, e.my - e.ny * 4, r, a0 - Math.PI / 2, a0 + Math.PI / 2); g.stroke();
      g.beginPath(); g.arc(e.mx + e.nx * r * 0.62, e.my + e.ny * r * 0.62, 2.4, 0, Math.PI * 2); g.fill();
    });
    G.forEach((e, i) => {                              // quarts de cercle des coins (au sommet a de chaque côté)
      const prev = G[(i - 1 + G.length) % G.length], a1 = Math.atan2(e.ty, e.tx), a2 = Math.atan2(-prev.ty, -prev.tx);
      const k = (e.apo - 4) / e.apo, vx = c + (e.ax - c) * k, vy = c + (e.ay - c) * k;
      let d = a2 - a1; while (d < 0) d += Math.PI * 2;
      g.beginPath(); g.arc(vx, vy, 10, a1, a1 + d); g.stroke();
    });
    g.restore();
    // 5) vignette + cadre
    const vg = g.createRadialGradient(c, c, W * 0.34, c, c, W * 0.74); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.5)');
    g.fillStyle = vg; g.fillRect(0, 0, W, W);
    g.strokeStyle = 'rgba(255,194,74,' + (A.contrast ? 0.7 : 0.3) + ')'; g.lineWidth = 1.5; g.strokeRect(5, 5, W - 10, W - 10);
  }

  // ───────────────────────── cages ─────────────────────────
  // Filet extrudé HORS du terrain (profondeur 20), maillage qui ondule quand un but y entre, poteaux et barre ;
  // une bande à la couleur du propriétaire le long de la ligne ; ses vies en ballons derrière le filet.
  // Cage fermée (propriétaire éliminé) : planches à rayures rouges et blanches sur toute la bouche.
  function drawGoals(now) {
    if (!G || !snap) return;
    const tot = snap.lives || 3;
    G.forEach(e => {
      if (e.owner === -1) return;                       // côté-mur (duel à 2 : haut et bas)
      const h = halfW(e), open = ownerAlive(e) || (snap.gs === 'lobby' && e.open), depth = 20;
      const p1x = e.mx - e.tx * h, p1y = e.my - e.ty * h, p2x = e.mx + e.tx * h, p2y = e.my + e.ty * h;
      const bx = -e.nx * depth, by = -e.ny * depth, col = e.owner >= 0 ? colSeat(e.owner) : 'rgba(242,246,238,0.5)';
      if (!open) {                                      // cage fermée
        ctx.save(); ctx.translate(e.mx, e.my); ctx.rotate(Math.atan2(e.ty, e.tx));
        ctx.fillStyle = '#2a2a2a'; ctx.fillRect(-h, -8, h * 2, 10);
        ctx.save(); ctx.beginPath(); ctx.rect(-h, -8, h * 2, 10); ctx.clip();
        ctx.fillStyle = '#e8413a'; for (let x = -h - 10; x < h + 10; x += 14) { ctx.beginPath(); ctx.moveTo(x, 2); ctx.lineTo(x + 7, 2); ctx.lineTo(x + 17, -8); ctx.lineTo(x + 10, -8); ctx.closePath(); ctx.fill(); }
        ctx.restore(); ctx.restore();
        return;
      }
      ctx.save();
      // intérieur du filet (ombre) puis maillage
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.moveTo(p1x, p1y); ctx.lineTo(p1x + bx, p1y + by); ctx.lineTo(p2x + bx, p2y + by); ctx.lineTo(p2x, p2y); ctx.closePath(); ctx.fill();
      const hit = netHit[e.owner], age = hit ? now - hit.t : 1e9, ond = !A.reduceFx && age < 900 ? (1 - age / 900) : 0;
      ctx.strokeStyle = 'rgba(242,246,238,0.55)'; ctx.lineWidth = 0.8; ctx.beginPath();
      const nl = Math.max(6, Math.round(h * 2 / 7));
      for (let i = 0; i <= nl; i++) {                   // mailles transversales (du poteau vers le fond), gonflées par le but
        const u = -h + (2 * h) * i / nl, bulge = ond * 7 * Math.sin(Math.PI * i / nl) * Math.sin(age / 50);
        const x0 = e.mx + e.tx * u, y0 = e.my + e.ty * u;
        ctx.moveTo(x0, y0); ctx.lineTo(x0 + bx * (1 + bulge / depth), y0 + by * (1 + bulge / depth));
      }
      for (let j = 1; j <= 3; j++) { const k = j / 3; ctx.moveTo(p1x + bx * k, p1y + by * k); ctx.lineTo(p2x + bx * k, p2y + by * k); }
      ctx.stroke();
      // bande de couleur du propriétaire sur la ligne de but
      ctx.strokeStyle = col; ctx.lineWidth = 4; ctx.globalAlpha = 0.85; ctx.beginPath(); ctx.moveTo(p1x, p1y); ctx.lineTo(p2x, p2y); ctx.stroke(); ctx.globalAlpha = 1;
      // montants + barre (vue de dessus : les montants sont des disques, la barre relie le fond)
      ctx.strokeStyle = K.chalk; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(p1x, p1y); ctx.lineTo(p1x + bx, p1y + by); ctx.lineTo(p2x + bx, p2y + by); ctx.lineTo(p2x, p2y); ctx.stroke();
      ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#6b6b6b'; ctx.lineWidth = 1;
      for (const [x, y] of [[p1x, p1y], [p2x, p2y]]) { ctx.beginPath(); ctx.arc(x, y, POST_R + 0.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
      // vies : ballons derrière le filet (pleins = restantes)
      const p = e.owner >= 0 ? snap.players[e.owner] : null;
      if (p && p.playing) {
        const n = p.lives | 0, sp = 11, ox = e.mx - e.nx * (depth + 10), oy = e.my - e.ny * (depth + 10);
        for (let i = 0; i < tot; i++) {
          const u = (i - (tot - 1) / 2) * sp, x = ox + e.tx * u, y = oy + e.ty * u;
          ctx.globalAlpha = i < n ? 1 : 0.25; drawBall(x, y, 4.2, 0, false); ctx.globalAlpha = 1;
        }
      }
      ctx.restore();
    });
  }

  // ───────────────────────── ballon ─────────────────────────
  // Pentagone central + 5 demi-pentagones au bord, tournés d'un angle qui suit la distance roulée.
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
    ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.beginPath(); ctx.arc(x - r * 0.35, y - r * 0.4, r * 0.28, 0, Math.PI * 2); ctx.fill();   // reflet des projecteurs
  }

  // ───────────────────────── joueurs vus de dessus ─────────────────────────
  // Épaules en maillot (couleur + motif du siège), bras, tête et cheveux, crampons qui alternent à la course.
  // Glissade : corps allongé, jambe tendue. Sonné : étoiles. Porteur : anneau au sol.
  function drawPlayer(p, v, now, over) {
    const col = colSeat(p.seat), rc = hexRgb(col), r = PR, x = v.x, y = v.y, a = v.a;
    const ph = runPhase[p.seat] || 0, step = Math.sin(ph) * r * 0.45;
    // ombres des projecteurs (deux, opposées aux deux tours les plus proches) : l'effet « match de nuit »
    ctx.fillStyle = 'rgba(0,0,0,0.16)';
    const c = AR / 2, sx = x < c ? 1 : -1, sy = y < c ? 1 : -1;
    ctx.beginPath(); oval(ctx, x + sx * r * 0.7, y + sy * r * 0.3, r * 1.15, r * 0.7); ctx.fill();
    ctx.beginPath(); oval(ctx, x + sx * r * 0.2, y + sy * r * 0.75, r * 0.7, r * 1.1); ctx.fill();
    if (snap.ball && snap.ball.o === p.seat) {        // porteur : anneau doré au sol ; en charge, un arc qui se remplit (ambre → rouge)
      ctx.strokeStyle = 'rgba(255,210,74,0.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, r + 5, 0, Math.PI * 2); ctx.stroke();
      if (p.ch > 0) { ctx.strokeStyle = rgbStr(mix([255, 194, 74], [232, 65, 58], p.ch)); ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(x, y, r + 9, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p.ch); ctx.stroke(); ctx.lineCap = 'butt'; }
    }
    ctx.save(); ctx.translate(x, y); ctx.rotate(a);
    const slide = p.tk || p.dn;                        // glissade, ou encore à terre après un tacle raté
    // crampons (devant = +x)
    ctx.fillStyle = '#141414';
    if (slide) { ctx.beginPath(); oval(ctx, r * 1.25, r * 0.3, r * 0.42, r * 0.22); ctx.fill(); ctx.beginPath(); oval(ctx, r * 0.2, -r * 0.55, r * 0.34, r * 0.2); ctx.fill(); }
    else { ctx.beginPath(); oval(ctx, step, r * 0.42, r * 0.36, r * 0.2); ctx.fill(); ctx.beginPath(); oval(ctx, -step, -r * 0.42, r * 0.36, r * 0.2); ctx.fill(); }
    // épaules (maillot) : ellipse plus large que profonde
    const sh = slide ? 1.15 : 1;
    const gr = ctx.createLinearGradient(-r, -r, r, r); gr.addColorStop(0, rgbStr(mix(rc, [255, 255, 255], 0.25))); gr.addColorStop(1, rgbStr(mix(rc, [0, 0, 0], 0.25)));
    ctx.fillStyle = gr; ctx.beginPath(); oval(ctx, 0, 0, r * 0.62 * sh, r * 0.98); ctx.fill();
    const pat = seatPattern(ctx, p.seat, { size: Math.max(6, r * 0.6), ink: 'rgba(255,255,255,0.35)' });
    if (pat) { ctx.fillStyle = pat; ctx.beginPath(); oval(ctx, 0, 0, r * 0.62 * sh, r * 0.98); ctx.fill(); }
    ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 1.2; ctx.beginPath(); oval(ctx, 0, 0, r * 0.62 * sh, r * 0.98); ctx.stroke();
    // bras (balancier opposé aux jambes)
    const skin = SKIN[p.seat % SKIN.length], sk = rgbStr(skin);
    ctx.fillStyle = sk;
    ctx.beginPath(); ctx.arc(-step * 0.5, r * 0.98, r * 0.22, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(step * 0.5, -r * 0.98, r * 0.22, 0, Math.PI * 2); ctx.fill();
    // tête + cheveux (vue de dessus, un peu en avant des épaules)
    ctx.fillStyle = sk; ctx.beginPath(); ctx.arc(r * 0.1, 0, r * 0.42, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = HAIR[p.seat % HAIR.length]; ctx.beginPath(); ctx.arc(-r * 0.02, 0, r * 0.36, Math.PI * 0.5, Math.PI * 1.5); ctx.arc(r * 0.06, 0, r * 0.3, Math.PI * 1.5, Math.PI * 0.5); ctx.fill();
    ctx.restore();
    if (A.contrast) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(x, y, r + 1.5, 0, Math.PI * 2); ctx.stroke(); }
    if (p.st && !A.reduceFx) {                          // sonné : trois étoiles qui tournent
      ctx.fillStyle = K.gold; for (let k = 0; k < 3; k++) { const u = now / 180 + k * 2.09; ctx.beginPath(); ctx.arc(x + Math.cos(u) * r * 0.8, y - r * 0.2 + Math.sin(u) * r * 0.4, 2.4, 0, Math.PI * 2); ctx.fill(); }
    }
    if (p.seat === mySeat && !over) {                   // repère « c'est moi »
      ctx.save(); ctx.strokeStyle = K.chalk; ctx.lineWidth = 1.6; ctx.globalAlpha = A.reduceFx ? 0.85 : 0.55 + 0.4 * Math.sin(now / 200);
      ctx.beginPath(); ctx.arc(x, y, r + 8, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1;
      const ty = y - r - 12; ctx.fillStyle = K.amber; ctx.strokeStyle = K.ink; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(x - 6, ty - 8); ctx.lineTo(x + 6, ty - 8); ctx.lineTo(x, ty); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
    }
  }

  // ───────────────────────── écran titre : « FOOT » sur un tableau d'affichage ─────────────────────────
  function drawTitle(cx, cy, now) {
    const TXT = 'FOOT', anim = !A.reduceFx;
    ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    let fs = 70; ctx.font = fs + 'px ' + DISP;
    const maxW = AR * 0.5, w0 = ctx.measureText(TXT).width;
    if (w0 > maxW) { fs = Math.max(24, Math.floor(fs * maxW / w0)); ctx.font = fs + 'px ' + DISP; }
    const w = ctx.measureText(TXT).width + fs * 0.9, h = fs * 1.35;
    ctx.fillStyle = 'rgba(6,12,9,0.88)'; ctx.fillRect(cx - w / 2, cy - h / 2, w, h);                    // panneau
    ctx.strokeStyle = K.amber; ctx.lineWidth = 2; ctx.strokeRect(cx - w / 2 + 3, cy - h / 2 + 3, w - 6, h - 6);
    ctx.fillStyle = 'rgba(255,194,74,0.07)'; for (let yy = cy - h / 2 + 6; yy < cy + h / 2 - 6; yy += 4) ctx.fillRect(cx - w / 2 + 6, yy, w - 12, 1.4);   // trame LED
    if (anim) { ctx.shadowColor = 'rgba(255,194,74,0.7)'; ctx.shadowBlur = 16 + 5 * Math.sin(now / 600); }
    ctx.fillStyle = K.amber; ctx.fillText(TXT, cx, cy + fs * 0.04);
    ctx.shadowBlur = 0;
    // ballon qui dribble au-dessus du panneau
    const t = anim ? now / 1000 : 0.3, bx = cx + Math.sin(t * 1.3) * w * 0.38, by = cy - h / 2 - 16 - Math.abs(Math.sin(t * 3.2)) * 18;
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); oval(ctx, bx, cy - h / 2 - 4, 10, 3); ctx.fill();
    drawBall(bx, by, 10, t * 5, false);
    ctx.restore();
  }

  // ───────────────────────── éclairage ─────────────────────────
  function eclairer(now, V) {
    const c = AR / 2, R = AR * PITCH, li = 0.1 + 0.16 * duskV;
    for (let i = 0; i < 4; i++) {                       // quatre tours de projecteurs dans les coins
      const a = Math.PI / 4 + i * Math.PI / 2, x = c + Math.cos(a) * R * 1.25, y = c + Math.sin(a) * R * 1.25, fl = 1 + 0.03 * Math.sin(now / 90 + i);
      lumiere(ctx, x, y, R * 0.95, '#fff6d8', li * fl);
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
    // crépuscule : prolongations (cages qui s'agrandissent) et duel final
    let duskT = 0;
    if (snap && (snap.gs === 'play' || snap.gs === 'paused' || snap.gs === 'over')) {
      if (snap.sd) duskT = Math.min(0.5, (now - sdT0) / 60000 * 0.5);
      duskT = Math.max(duskT, DUEL.t(snap, now, duelAnnonce));
    }
    duskV += (duskT - duskV) * Math.min(1, 0.04 * kdt); if (duskV < 0.002) duskV = 0;
    drawGoals(now);
    if (snap && V) {
      const over = snap.gs === 'over';
      // animation de course : la phase avance avec la vitesse affichée
      snap.players.forEach(p => {
        if (!p.playing || !p.alive) return;
        const v = V.pl[p.seat]; if (!v) return;
        const pr = runPhase['p' + p.seat], d = pr ? Math.hypot(v.x - pr.x, v.y - pr.y) : 0;
        runPhase['p' + p.seat] = { x: v.x, y: v.y };
        runPhase[p.seat] = ((runPhase[p.seat] || 0) + (A.reduceFx ? 0 : Math.min(1.2, d * 0.32))) % (Math.PI * 2);
        if (p.tk && !A.reduceFx && Math.random() < 0.6 * kdt) grass(v.x - Math.cos(v.a) * PR, v.y - Math.sin(v.a) * PR, 1, 0.8, v.a + Math.PI);
      });
      // ballon : traînée quand il file, rotation qui suit la distance roulée
      const b = V.ball;
      if (b) {
        const sp = ballPrev ? Math.hypot(b.x - ballPrev.x, b.y - ballPrev.y) : 0;
        if (sp < 40) ballSpin += sp / BR * 0.6;
        if (!A.reduceFx && b.o < 0 && sp > 3.5) { trail.push({ x: b.x, y: b.y, t: now }); if (trail.length > 10) trail.shift(); } else if (trail.length && now - trail[trail.length - 1].t > 120) trail = [];
        ballPrev = { x: b.x, y: b.y };
        for (let i = 0; i < trail.length; i++) { const q = trail[i], al = (i + 1) / trail.length * 0.28; ctx.fillStyle = 'rgba(255,255,240,' + al + ')'; ctx.beginPath(); ctx.arc(q.x, q.y, BR * (0.4 + 0.6 * (i + 1) / trail.length), 0, Math.PI * 2); ctx.fill(); }
      }
      // joueurs (le porteur en dernier : le ballon passe au-dessus des autres)
      const ordre = snap.players.filter(p => p.playing && p.alive && V.pl[p.seat]).sort((p, q) => (p.seat === (b && b.o) ? 1 : 0) - (q.seat === (b && b.o) ? 1 : 0));
      ordre.forEach(p => drawPlayer(p, V.pl[p.seat], now, over));
      if (b) drawBall(b.x, b.y, BR, ballSpin);
      if (over && !A.reduceFx) snap.players.forEach(p => { if (!p.playing || !p.alive || p.team !== snap.winner) return; const v = V.pl[p.seat]; if (!v) return; ctx.save(); ctx.strokeStyle = K.gold; ctx.lineWidth = 2.5; ctx.globalAlpha = 0.5 + 0.4 * Math.sin(now / 180); ctx.beginPath(); ctx.arc(v.x, v.y, PR + 10, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); });
      // nom des propriétaires près de leur cage (qui défend quoi)
      if (snap.gs !== 'play' || A.contrast) G.forEach(e => {
        if (e.owner < 0 || !snap.players[e.owner] || !snap.players[e.owner].playing) return;
        const x = e.mx + e.nx * 26, y = e.my + e.ny * 26;
        ctx.save(); ctx.font = 'bold 11px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.7)';
        const nm = nameOf(e.owner).slice(0, 12); ctx.strokeText(nm, x, y); ctx.fillStyle = colSeat(e.owner); ctx.fillText(nm, x, y); ctx.restore();
      });
    }
    // particules : herbe, confettis, ondes, étincelles de poteau
    if (!A.reduceFx) {
      ctx.save();
      for (let i = puffs.length - 1; i >= 0; i--) { const q = puffs[i], tt = (now - q.born) / q.life; if (tt >= 1) { puffs.splice(i, 1); continue; } q.x += q.vx * kdt; q.y += q.vy * kdt; q.vx *= 0.92; q.vy *= 0.92; ctx.globalAlpha = 1 - tt; ctx.fillStyle = q.col; ctx.fillRect(q.x, q.y, q.r, q.r * 2.2); }
      for (let i = confs.length - 1; i >= 0; i--) { const q = confs[i], tt = (now - q.born) / q.life; if (tt >= 1) { confs.splice(i, 1); continue; } q.x += q.vx * kdt; q.y += q.vy * kdt; q.vx *= 0.97; q.vy = q.vy * 0.97 + 0.06 * kdt; q.rot += q.vr * kdt; ctx.globalAlpha = tt > 0.7 ? (1 - tt) / 0.3 : 1; ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot); ctx.fillStyle = q.col; ctx.fillRect(-3, -1.5, 6, 3); ctx.restore(); }
      for (let i = waves.length - 1; i >= 0; i--) { const q = waves[i], tt = (now - q.born) / q.life; if (tt >= 1) { waves.splice(i, 1); continue; } const e = 1 - (1 - tt) * (1 - tt); ctx.globalAlpha = 0.7 * (1 - tt); ctx.strokeStyle = 'rgb(' + q.col + ')'; ctx.lineWidth = q.lw * (1 - tt * 0.6); ctx.beginPath(); ctx.arc(q.x, q.y, q.r0 + (q.r1 - q.r0) * e, 0, Math.PI * 2); ctx.stroke(); }
      for (let i = sparks.length - 1; i >= 0; i--) { const q = sparks[i], tt = (now - q.born) / q.life; if (tt >= 1) { sparks.splice(i, 1); continue; } ctx.globalAlpha = 1 - tt; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5; ctx.beginPath(); for (let k = 0; k < 6; k++) { const u = k * 1.047, r0 = 3 + tt * 4, r1 = 6 + tt * 12; ctx.moveTo(q.x + Math.cos(u) * r0, q.y + Math.sin(u) * r0); ctx.lineTo(q.x + Math.cos(u) * r1, q.y + Math.sin(u) * r1); } ctx.stroke(); }
      ctx.restore();
    } else { puffs.length = 0; confs.length = 0; waves.length = 0; sparks.length = 0; }
    crepuscule(ctx, -24, -24, AR + 48, AR + 48, duskV, { soleil: false, force: A.contrast ? 0.45 : A.reduceFx ? 0.55 : 1 });
    // bandeaux « BUT ! », « POTEAU ! » : claquent au centre puis s'effacent
    for (let i = texts.length - 1; i >= 0; i--) {
      const o = texts[i], t = (now - o.born) / 1500; if (t >= 1) { texts.splice(i, 1); continue; }
      const s = A.reduceFx ? 1 : (t < 0.1 ? 0.4 + 0.8 * t / 0.1 : t < 0.2 ? 1.2 - 0.2 * (t - 0.1) / 0.1 : 1);
      ctx.save(); ctx.translate(c, c - 30); ctx.scale(s, s); ctx.globalAlpha = t > 0.75 ? (1 - t) / 0.25 : 1;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
      const big = o.txt === 'BUT !' ? 64 : 38; ctx.font = big + 'px ' + DISP;
      ctx.lineWidth = 9; ctx.strokeStyle = K.ink; ctx.strokeText(o.txt, 0, 0); ctx.fillStyle = o.col; ctx.fillText(o.txt, 0, 0);
      if (o.sub) { ctx.font = 'bold 15px system-ui, sans-serif'; ctx.lineWidth = 4; ctx.strokeText(o.sub, 0, big * 0.62); ctx.fillStyle = K.chalk; ctx.fillText(o.sub, 0, big * 0.62); }
      ctx.restore();
    }
    // jauges du joueur local : tacle (recharge) et tir (disponible ballon au pied)
    const me = (snap && mySeat >= 0) ? snap.players[mySeat] : null;
    if (me && me.playing && me.alive && snap.gs === 'play') {
      const bw = 112, bh = 10, gapx = 18, y = AR - 24, x1 = c - bw - gapx / 2, x2 = c + gapx / 2, aLui = snap.ball && snap.ball.o === mySeat;
      const gauge = (x, v, col, lab, pret) => {
        ctx.fillStyle = 'rgba(6,12,9,0.75)'; ctx.fillRect(x - 2, y - 2, bw + 4, bh + 4);
        ctx.fillStyle = v >= 1 ? col : 'rgba(242,246,238,0.3)'; ctx.fillRect(x, y, bw * Math.max(0, Math.min(1, v || 0)), bh);
        ctx.strokeStyle = 'rgba(242,246,238,0.55)'; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, bw - 1, bh - 1);
        ctx.fillStyle = v >= 1 ? col : 'rgba(242,246,238,0.65)'; ctx.font = 'bold 10px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
        ctx.fillText(lab + (pret ? ' · ' + pret : ''), x + bw / 2, y - 3);
      };
      if (me.ch > 0) gauge(x1, 0.999 * me.ch + 0.001, rgbStr(mix([255, 194, 74], [232, 65, 58], me.ch)), 'TIR', Math.round(me.ch * 100) + ' %' + (me.ch >= 1 ? ' · BOULET' : ''));
      else gauge(x1, aLui ? 1 : 0, K.gold, 'TIR (maintiens Espace)', aLui ? 'BALLON AU PIED' : '');
      gauge(x2, me.tcd, K.chalk, 'TACLE (E)', me.tcd >= 1 ? 'PRÊT' : '');
    }
    if (snap && snap.gs === 'countdown') {             // tableau d'affichage : 3 · 2 · 1 · COUP D'ENVOI
      ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.fillRect(0, 0, AR, AR); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const n = snap.count || 0, pulse = A.reduceFx ? 1 : 1 + 0.06 * Math.sin(now / 110);
      ctx.save(); ctx.translate(c, c - 40); ctx.scale(pulse, pulse);
      ctx.fillStyle = 'rgba(6,12,9,0.9)'; ctx.fillRect(-70, -50, 140, 100); ctx.strokeStyle = K.amber; ctx.lineWidth = 2; ctx.strokeRect(-66, -46, 132, 92);
      ctx.fillStyle = K.amber; ctx.font = (n > 0 ? 70 : 22) + 'px ' + DISP; ctx.fillText(n > 0 ? n : 'COUP D\'ENVOI', 0, 4);
      ctx.restore();
    }
    if (snap && snap.frz && snap.gs === 'play') {       // après un but : « engagement » en bas
      ctx.save(); ctx.font = 'bold 13px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,0.7)';
      ctx.strokeText('Engagement au centre…', c, AR - 52); ctx.fillStyle = K.chalk; ctx.fillText('Engagement au centre…', c, AR - 52); ctx.restore();
    }
    if (snap && (snap.gs === 'lobby' || snap.gs === 'paused')) {
      ctx.fillStyle = 'rgba(4,10,7,0.6)'; ctx.fillRect(0, 0, AR, AR); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      if (snap.gs === 'paused') {
        ctx.fillStyle = K.chalk; ctx.font = '38px ' + DISP; ctx.fillText('PAUSE', c, c - 8);
        ctx.fillStyle = 'rgba(242,246,238,.6)'; ctx.font = '14px system-ui, sans-serif'; ctx.fillText('Temps mort — P / Échap pour reprendre', c, c + 28);
      } else {
        drawTitle(c, c - 50, now);
        const n = snap.connected || 0, nb = snap.botCount || 0, tot = n + nb, y0 = c + 56;
        ctx.fillStyle = teamMode ? '#ffe2a0' : 'rgba(242,246,238,.8)'; ctx.font = '15px system-ui, sans-serif';
        ctx.fillText(`${n} joueur${n > 1 ? 's' : ''}${nb ? ' + ' + nb + ' bot' + (nb > 1 ? 's' : '') : ''}${teamMode ? ' · ' + (MODE_NAME[snap.mode] || snap.mode) : ''} · ${snap.lives || 3} vie${(snap.lives || 3) > 1 ? 's' : ''}`, c, y0);
        ctx.fillStyle = 'rgba(242,246,238,.62)'; ctx.font = 'bold 13px system-ui, sans-serif';
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
    if ((e.code === 'KeyE' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') && isPlay()) { send({ t: 'tackle' }); return; }
    if ((e.key === 'p' || e.key === 'P' || e.key === 'Escape') && isPlay()) { send({ t: 'pause' }); return; }
    const d = DIR_KEYS[e.code]; if (d) setIn(d, true);
  };
  const onKeyUp = e => { if (e.key === ' ') { charge(false); return; } const d = DIR_KEYS[e.code]; if (d) setIn(d, false); };
  const onBlur = () => { let ch = false; for (const k in input) if (input[k]) { input[k] = false; ch = true; } if (ch) pushInput(); if (chargeOn) { chargeOn = false; send({ t: 'charge', on: false, cancel: true }); } };
  // tir chargé : Espace (ou le bouton ⚽) enfoncé = charge, relâché = tir ; la puissance est mesurée par le SERVEUR
  let chargeOn = false;
  function charge(on) { if (on === chargeOn) return; chargeOn = on; send({ t: 'charge', on }); }
  function hold(id, k) { const el = $(id); if (!el) return; const on = e => { e.preventDefault(); unlockAudio(); setIn(k, true); }; const off = e => { e.preventDefault(); setIn(k, false); }; el.addEventListener('pointerdown', on); el.addEventListener('pointerup', off); el.addEventListener('pointerleave', off); el.addEventListener('pointercancel', off); }
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
    lbBtn = $('ftLbBtn'); lbPanel = $('ftLbPanel'); lbBody = $('ftLbBody'); shootBtn = $('ftShoot'); tackleBtn = $('ftTackle');
    startBtn.onclick = () => { unlockAudio(); send({ t: 'start' }); };
    pauseBtn.onclick = () => send({ t: 'pause' });
    pauseFloat.onclick = () => send({ t: 'pause' });
    modeBtn.onclick = () => send({ t: 'mode' });
    if (botsBtn) botsBtn.onclick = () => send({ t: 'bots' });
    if (diffBtn) diffBtn.onclick = () => send({ t: 'botdiff' });
    if (livesBtn) livesBtn.onclick = () => send({ t: 'lives' });
    lbBtn.onclick = () => { togglePanel(lbPanel); renderLB(); };
    const helpBtn = $('ftHelp'), helpPanel = $('ftHelpPanel'); if (helpBtn && helpPanel) helpBtn.onclick = () => togglePanel(helpPanel);
    if (premiere) cv.addEventListener('click', () => { unlockAudio(); if (snap && !isPlay() && snap.gs !== 'countdown') send({ t: 'start' }); });
    if (premiere) endEl.addEventListener('click', () => { unlockAudio(); send({ t: 'start' }); });
    if (premiere) { hold('ftUp', 'up'); hold('ftDown', 'down'); hold('ftLeft', 'left'); hold('ftRight', 'right'); tap('ftTackle', 'tackle');
      const sb = $('ftShoot'); if (sb) { const on = e => { e.preventDefault(); unlockAudio(); charge(true); }, off = e => { e.preventDefault(); charge(false); }; sb.addEventListener('pointerdown', on); sb.addEventListener('pointerup', off); sb.addEventListener('pointerleave', off); sb.addEventListener('pointercancel', off); } }
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
    chargeOn = false;                                     // (rien envoyé : le hub a peut-être déjà changé de jeu)
  }

  return { init, onState, onMessage, onLb, onA11y, teardown };
})();
