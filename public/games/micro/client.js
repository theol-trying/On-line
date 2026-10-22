// Module client MICRO MACHINES : course de voitures-jouets vue de dessus sur des tables (petit-déjeuner, bureau d'écolier,
// billard) et un circuit-jouet à rails sur la moquette. Caméra qui suit SA voiture (nord en haut, même champ de vision
// pour tous : VIEW u), mini-carte, traces de pneus, chutes de table, feux de départ, ralenti, podium de petites voitures.
// Géométrie des circuits : ./shared.js (la même que le serveur — rien ne voyage sur le réseau que l'identifiant).
// Structure calquée sur la Patate chaude (HUD, écran de fin, câblage unique des écouteurs, briques partagées).
// iOS 15 : ni ?. ni ??, ni roundRect / ctx.filter / ctx.ellipse / letterSpacing / OffscreenCanvas.
import { TICK_HZ, CAR_L, CAR_W, VIEW, CIRCUITS, circuitParId } from './shared.js';
import { createMusic } from '../../music.js';
import { seatPattern, SEAT_GLYPH } from '../../patterns.js';
import { initGameMsg, msgPerso, msgGlobal } from '../../gamemsg.js';
import { arenaSize } from '../../layout.js';
import { lumiere, creerLumieres } from '../../lumiere.js';
import { crepuscule, creerDuel } from '../../crepuscule.js';
import { creerJournal, blocFin } from '../../finpartie.js';
import { createRalenti } from '../../ralenti.js';
import { drawPodium, podiumEntries } from '../../podium.js';
import { createStreaks, streakText, createCallouts, createHitStop, drawFlash, drawDanger, drawSeatChip, readable, hudK } from '../../exploits.js';
import { createEcranFin } from '../../ecran-fin.js';
import { boutonMatch, texteMatch, balleDeMatch, titreFin, pastillesTexte } from '../../match.js';

const DUEL = creerDuel(), duelAnnonce = () => msgGlobal('⚔', 'Duel final : plus que deux voitures à l\'écran !', { color: '#ffd23a' });

// musique : rock'n'roll de salle de jeux — basse « boogie » en croches, riff pentatonique au synthé-jouet, charleston serré ;
// climax (dernier tour / duel) : tempo plus vif, roulement et arpège montant.
const MUSIC_THEME = { bpm: 152, bpmBoost: 26, vol: 0.5, root: 110, len: 32,
  stingers: { kill: { notes: [7, 3, 0, -5], wave: 'square', oct: 1, gain: 0.04, dur: 0.18, rate: 0.06 },
    win: { base: 440, notes: [[0, 4, 7], [5, 9, 12], [7, 11, 14], [12, 16, 19, 24]], gain: 0.032, dur: 0.42, rate: 0.14 },
    count: { notes: [0], oct: 1, wave: 'square', dur: 0.16, gain: 0.04, duck: false }, go: { notes: [[0, 7, 12]], oct: 2, wave: 'square', dur: 0.55, gain: 0.045, duck: false },
    alert: { notes: [0, 4, 7, 12, 16], oct: 1, wave: 'square', rate: 0.06, dur: 0.14, gain: 0.035 } },
  layers: [
  { seq: [0, 0, 12, 0, 3, 0, 5, 7, 0, 0, 12, 0, 3, 0, 7, 5, 5, 5, 17, 5, 8, 5, 10, 12, 7, 7, 19, 7, 5, 5, 3, 2], wave: 'triangle', gain: 0.03, dur: 0.5 },   // basse boogie
  { seq: [24, null, 27, null, 29, 31, null, 29, 27, null, 24, null, 22, null, 24, null, 29, null, 32, null, 34, 36, null, 34, 31, null, 29, null, 27, null, 24, null], wave: 'square', gain: 0.012, dur: 0.6 },   // riff jouet
  { drums: 'K.H.S.H.K.HKS.H.K.H.S.H.KKH.S.HS', gain: 0.72, min: 1 },
  { seq: [12, null, null, null, 15, null, null, null, 17, null, null, null, 19, null, 17, null], oct: 1, wave: 'sine', gain: 0.012, dur: 2.4, min: 1 },
  { drums: 'K.S.KSS.K.S.KSSSK.S.KSS.KKSSSSSS', gain: 0.8, min: 2 },
  { seq: [0, 7, 12, 15, 19, 15, 12, 7], oct: 2, wave: 'square', gain: 0.01, dur: 0.4, min: 2 },
] };

const PAL = { normal: ['#e8322a', '#2f7ff0', '#ffcf2e', '#2bb45a', '#9b5cf0', '#ff7ab8', '#20c6c0', '#ff8a1e', '#a6d93a', '#f2f0e6'],
              cb: ['#D55E00', '#0072B2', '#F0E442', '#009E73', '#CC79A7', '#56B4E9', '#E69F00', '#F5F5F5', '#7B68EE', '#9A9A9A'] };
const TEAMPAL = { normal: ['#e8322a', '#2f7ff0', '#ffcf2e', '#2bb45a', '#9b5cf0'], cb: ['#D55E00', '#0072B2', '#F0E442', '#009E73', '#CC79A7'] };
const TEAM_LETTER = ['A', 'B', 'C', 'D', 'E'];
const MODE_NAME = { ffa: 'Chacun pour soi', '2v2': '2 v 2', '2v2v2': '2 v 2 v 2', '3v3': '3 v 3', '4v4': '4 v 4', '2v2v2v2': '2 v 2 v 2 v 2', '3v3v3': '3 v 3 v 3', '5v5': '5 v 5', '2v2v2v2v2': '2 v 2 v 2 v 2 v 2' };
const TEAM_TOTALS = [4, 6, 8, 9, 10];
const MAX_SEATS = 10;
const DIFF_NAMES = ['Facile', 'Normale', 'Difficile'];
const FORMULE_NAME = { course: '🏁 Course', elim: '💥 Élimination' };
const HUDW = 660;                                        // largeur logique du HUD (le canvas est carré)
const K = { yel: '#ffd23a', red: '#e8322a', ink: '#14141c', cream: '#fff6e0', blue: '#2f7ff0' };
const DISP = "'Racing Sans One', 'Russo One', Impact, sans-serif";
const DIR_KEYS = { ArrowUp: 'up', KeyW: 'up', KeyZ: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', KeyQ: 'left', ArrowRight: 'right', KeyD: 'right' };
const ORD = n => n === 1 ? '1er' : n + 'ᵉ';
const CAR_NAMES = ['proto', 'mini', 'pickup', 'formule', 'fourgon'];

function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function hexRgb(h) { const n = parseInt(String(h).slice(1, 7), 16) || 0; return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function rgbStr(c, a) { return a == null ? `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})` : `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`; }
function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function oval(g, x, y, rx, ry) { g.save(); g.translate(x, y); g.scale(rx, ry); g.moveTo(1, 0); g.arc(0, 0, 1, 0, Math.PI * 2); g.restore(); }
function rr(g, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
const fin = v => typeof v === 'number' && isFinite(v);
const seatOk = s => (s | 0) === s && s >= 0 && s < MAX_SEATS;
const fmtT = s => { if (!fin(s) || s <= 0) return '—'; const m = Math.floor(s / 60), r = s - m * 60; return (m ? m + ':' + (r < 10 ? '0' : '') : '') + r.toFixed(2); };

export default (function () {
  let A, send, root, cv, ctx, togglePanel = () => {}, closePanels = () => {};
  let CC = PAL.normal, TEAMCC = TEAMPAL.normal;
  let mySeat = -1, snap = null, prevGs = 'lobby', teamMode = false, endShown = false, inGamePrev = false, prevRound = -1, lastCount = -1;
  let board = [], buf = [];
  let C = circuitParId(CIRCUITS[0].id), cid = C.id;
  const cam = { x: C.w / 2, y: C.h / 2, w: Math.max(C.w, C.h) + 80, init: false };
  const puffs = [], drops = [], sparks = [], flyers = [], rings = [];
  let shakeMag = 0, rafId = 0, destroyed = false, resizeH = null, actx = null, noiseBuf = null, lastFrame = 0, duskV = 0;
  const LUM = creerLumieres(24), J = creerJournal({ pas: 500 });
  let jRound = -1, jLast = -1e9;
  const NOMUSIC = { start() {}, stop() {}, setIntensity() {}, sting() {}, dispose() {} };
  let music = NOMUSIC;
  const input = { up: false, down: false, left: false, right: false };
  let staleInput = false, anaSent = '', anaT = 0, anaPend = null, anaTimer = 0;
  const STREAK = createStreaks({ window: 9000 }), CALL = createCallouts(), HS = createHitStop(60);
  const TOUCH = typeof matchMedia === 'function' ? matchMedia('(pointer: coarse)').matches : 'ontouchstart' in window;
  const RL = createRalenti({ keepMs: 3200, windowMs: 1500, slow: 0.4 });
  let pendingEnd = null, overT0 = 0, eatUntil = 0, homeChoice = false, goT0 = -1e9, lastFinishAt = -1e9;
  let podSrc = null, podList = [], endPod = false;
  let hud, cards, startBtn, pauseBtn, modeBtn, botsBtn, diffBtn, formBtn, circBtn, lapsBtn, pauseFloat, lbBtn, lbPanel, lbBody, endEl, hornBtn;
  let matchBtn = null, matchChip = null;
  const lastRear = new Array(MAX_SEATS).fill(null);    // dernière position des roues arrière (traces de pneus)
  const prevPos = new Array(MAX_SEATS).fill(0), prevPg = new Array(MAX_SEATS).fill(0);
  let myLapT0 = 0, lastWrongMsg = -1e9, lastEdgeWarn = -1e9, myFallMsg = -1e9, finSeen = false, lastLapMsg = -1;
  const EF = createEcranFin({ aChange: () => { if (destroyed || !cv) return; applyPlaying(snap && snap.gs); resizeCanvas(); } });
  function applyPlaying(gs) {
    const inGame = EF.enJeu(gs);
    if (inGame !== inGamePrev) { inGamePrev = inGame; document.body.classList.toggle('playing', inGame); resizeCanvas(); }
  }

  const $ = id => root.querySelector('#' + id);
  const colSeat = s => { if (!seatOk(s) || !snap) return '#fff'; const p = snap.players[s]; return teamMode && p ? TEAMCC[p.team % TEAMCC.length] : CC[s % CC.length]; };
  const winTeam = m => (m && typeof m.winner === 'number' && m.winner >= 0) ? m.winner : -1;
  const nameOf = s => { const p = snap && seatOk(s) && snap.players[s]; return p ? (p.name || ('P' + (s + 1))) : '?'; };
  function applyColors() { CC = PAL[A.palette] || PAL.normal; TEAMCC = TEAMPAL[A.palette] || TEAMPAL.normal; carCache = {}; podSrc = null; decorKey = ''; if (A.reduceFx) LUM.vider(); }

  function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const size = arenaSize({ max: 760 });
    cv.style.width = size + 'px'; cv.style.height = size + 'px';
    cv.width = Math.round(size * dpr); cv.height = Math.round(size * dpr);
    layoutEnd();
  }

  // ───────────────────────── HUD (cartes DOM), classement, écran de fin ─────────────────────────
  const relanceLabel = (m, def) => m && m.match ? (m.match.f ? 'Nouveau match' : 'Manche suivante') : def;
  function matchTeamName(t) {
    if (teamMode) return 'Équipe ' + (TEAM_LETTER[t] || (t + 1));
    const p = snap && snap.players.find(q => q.playing && q.team === t);
    return p ? (p.name || ('P' + (p.seat + 1))) : '';
  }
  function etatTxt(p, m) {
    if (!p.playing) return 'prêt';
    if (!p.alive) return m && m.formule === 'elim' ? '✖ éliminé' : '✖ abandon';
    if (p.fin) return '🏁 ' + ORD(p.fin) + ' · ' + fmtT(p.ft);
    const st = [ORD(p.pos)];
    if (m && m.formule !== 'elim') st.push('T' + p.lap + '/' + m.laps);
    if (p.bl) st.push('⏱ ' + fmtT(p.bl));
    if (p.fa > 0) st.push('🕳');
    return '● ' + st.join(' · ');
  }
  function refreshHUD() {
    if (!snap) return;
    if (matchChip) { const tx = texteMatch(snap.match); if (matchChip._t !== tx) { matchChip._t = tx; matchChip.textContent = tx ? '🏆 ' + tx : ''; } matchChip.style.display = tx ? '' : 'none'; }
    snap.players.forEach((p, i) => {
      const shown = p.connected || p.playing;
      cards[i].classList.toggle('hidden', !shown);
      if (!shown) return;
      const col = colSeat(i);
      cards[i].style.color = col;
      cards[i].classList.toggle('dead', p.playing && !p.alive);
      cards[i].classList.toggle('me', i === mySeat);
      cards[i].classList.toggle('lead', !!(p.playing && p.alive && snap.lead === i && (snap.gs === 'play' || snap.gs === 'paused')));
      const tags = [];
      if (teamMode) tags.push(`<span class="badge" style="background:${col}28;color:${col}">ÉQ.${TEAM_LETTER[p.team] || '?'}</span>`);
      if (p.bot) tags.push(`<span class="badge" style="background:${col}28;color:${col}">BOT</span>`);
      else if (i === mySeat) tags.push(`<span class="badge" style="background:${col}28;color:${col}">VOUS</span>`);
      const glyph = SEAT_GLYPH[i % SEAT_GLYPH.length];
      const pnH = `${(window.__AV && window.__AV(p.name)) || ''}<span class="sg" style="opacity:.8">${glyph}</span> ${esc(p.name || ('P' + (i + 1)))} <span class="sc" title="voitures envoyées dans le décor">${p.kos | 0} 💥</span> ${snap.match ? `<span class="sc" title="manches gagnées" style="letter-spacing:1px">${pastillesTexte(p.score, snap.match.n)}</span> ` : ''}${tags.join('')}`;
      if (cards[i]._pn !== pnH) { cards[i]._pn = pnH; cards[i].querySelector('.pn').innerHTML = pnH; }
      const lv = cards[i].querySelector('.lv'); lv.style.color = col;
      const t = etatTxt(p, snap); if (cards[i]._lv !== t) { cards[i]._lv = t; lv.textContent = t; }
    });
  }
  function renderLB() {
    if (!lbBody) return;
    if (!board.length) { lbBody.innerHTML = '<div class="lbnote">Aucune course enregistrée.</div>'; return; }
    lbBody.innerHTML = board.slice().sort((a, b) => (b.wins || 0) - (a.wins || 0) || (b.podiums || 0) - (a.podiums || 0) || ((a.bestLap || 1e9) - (b.bestLap || 1e9))).map(e =>
      `<div class="lbrow"><span class="lbn">${esc(e.name)}</span><span title="courses">🎮${e.games || 0}</span><span title="victoires">🏆${e.wins || 0}</span><span title="podiums">🥉${e.podiums || 0}</span>` +
      `<span title="voitures envoyées dans le décor">💥${e.kos || 0}</span>` + (e.bestLap ? `<span title="meilleur tour (tous circuits)">⏱${fmtT(e.bestLap)}</span>` : '') + '</div>').join('');
  }
  const podFrac = () => (cv && cv.clientWidth < 460 ? 0.46 : 0.4);
  function layoutEnd() {
    if (!endEl) return;
    if (!endPod) { if (endEl.style.cssText) endEl.style.cssText = ''; return; }
    const ph = Math.round((cv.clientHeight || 340) * podFrac());
    endEl.style.cssText = 'justify-content:flex-start;overflow-y:auto;padding:' + (ph + 4) + 'px 12px 10px;background:linear-gradient(to bottom,rgba(10,12,22,0) ' + ph + 'px,rgba(10,12,22,.9) ' + (ph + 6) + 'px)';
  }
  function podEntries(m) {
    if (podSrc !== m) {
      podSrc = m; podList = m ? podiumEntries(m.players, colSeat) : [];
      if (m && m.match && m.match.f && podList.length) {
        podList.sort((a, b) => (b.score | 0) - (a.score | 0) || a.place - b.place || a.seat - b.seat);
        podList.forEach((e, i) => { e.place = i > 0 && (e.score | 0) === (podList[i - 1].score | 0) ? podList[i - 1].place : i + 1; });
      }
    }
    return podList;
  }
  function showEndscreen(m) {
    if (m.gs !== 'over' || !m.stats) { endPod = false; layoutEnd(); endEl.classList.add('hidden'); return; }
    podSrc = null; endPod = podEntries(m).length > 0 && m.stats.nParts > 1; layoutEnd();
    endEl.classList.remove('hidden');
    const elim = m.stats.formule === 'elim';
    const parts = m.players.filter(p => p.playing && p.place > 0).slice().sort((a, b) => a.place - b.place);
    const champ = winTeam(m) >= 0 ? parts.find(p => p.team === m.winner) : null;
    const whoRaw = champ ? (teamMode ? 'Équipe ' + TEAM_LETTER[m.winner] : (champ.name || ('P' + (champ.seat + 1)))) : '';
    const who = esc(whoRaw);
    const sc = [], vu = {}; parts.forEach(p => { const k = 't' + p.team; if (!vu[k]) { vu[k] = 1; sc.push(p.score | 0); } });
    const T = titreFin(m.match, whoRaw, sc);
    const solo = m.stats.nParts === 1;
    const title = solo ? (parts[0] && parts[0].fin ? '🏁 Course bouclée en ' + fmtT(parts[0].ft) : 'Fin de la balade') :
      T.titre ? esc(T.titre) + (who ? ' — ' + who : '') : (champ ? (elim ? who + ' reste seul à l\'écran !' : '🏁 ' + who + ' remporte la course !') : (elim ? 'Égalité — personne ne décroche' : 'Égalité sur la ligne'));
    const subLine = T.titre ? `<div class="emeta">${esc(T.sous)}</div>` : '';
    const cdef = circuitParId(m.stats.circuit);
    const medals = ['🥇', '🥈', '🥉'];
    let best = null, ko = null;
    parts.forEach(p => {
      if (p.bl > 0 && (!best || p.bl < best.bl)) best = p;
      if ((p.kos | 0) > 0 && (!ko || p.kos > ko.kos || (p.kos === ko.kos && p.place < ko.place))) ko = p;
    });
    const rows = parts.map(p => {
      const col = colSeat(p.seat), medal = medals[p.place - 1] || ('#' + p.place);
      const res = elim ? (p.alive ? (champ && p.team === champ.team ? 'dernier à l\'écran' : 'encore en piste') : 'éliminé à ' + Math.round((p.elimTick || 0) / TICK_HZ) + ' s')
        : (p.fin ? '🏁 ' + fmtT(p.ft) : (p.alive ? 'tour ' + p.lap + '/' + m.stats.laps : 'abandon'));
      return `<div class="erow ${champ && p.team === champ.team ? 'win' : ''}"><span class="eplace">${medal}</span>
        <span class="ename" style="color:${col}">${esc(p.name || ('P' + (p.seat + 1)))}${teamMode ? ` <small>Éq.${TEAM_LETTER[p.team]}</small>` : ''}${best && best.seat === p.seat ? ' <small>⏱ meilleur tour</small>' : ''}</span>
        <span class="estat" title="meilleur tour">⏱ ${fmtT(p.bl)}</span><span class="estat" title="voitures envoyées dans le décor">💥 ${p.kos | 0}</span><span class="estat" title="chutes">🕳 ${p.falls | 0}</span><span class="eres">${res}</span></div>`;
    }).join('');
    const bestLine = best ? `<div class="emeta">⏱ Meilleur tour : <b style="color:${colSeat(best.seat)}">${esc(best.name || ('P' + (best.seat + 1)))}</b> — ${fmtT(best.bl)}</div>` : '';
    const koLine = ko ? `<div class="emeta">💥 Chauffard : <b style="color:${colSeat(ko.seat)}">${esc(ko.name || ('P' + (ko.seat + 1)))}</b> — ${ko.kos} voiture${ko.kos > 1 ? 's' : ''} dans le décor</div>` : '';
    const wrapO = endPod ? '<div style="width:100%;flex:1 1 auto;min-height:0;overflow:auto;-webkit-overflow-scrolling:touch;display:flex;flex-direction:column;align-items:center;gap:8px">' : '', wrapC = endPod ? '</div>' : '';
    endEl.innerHTML = wrapO + `<div class="etitle" style="color:${champ ? colSeat(champ.seat) : K.cream}">${title}</div>
      ${subLine}<div class="emeta">${cdef.emoji} ${esc(cdef.nom)} · ${elim ? '💥 Élimination' : '🏁 ' + m.stats.laps + ' tour' + (m.stats.laps > 1 ? 's' : '')} · ⏱ ${m.stats.durationSec} s · ${m.stats.nParts} pilote${m.stats.nParts > 1 ? 's' : ''}</div>${bestLine}${koLine}<div class="elist">${rows}</div>${jRound === m.round ? blocFin(J, { titre: elim ? 'Positions (éliminés à zéro)' : 'Positions au fil de la course', couleur: s => colSeat(s), nom: s => nameOf(s) }) : ''}<div class="ehint">${TOUCH ? 'Touche pour rejouer' : 'Espace / clic pour rejouer'}</div>` + wrapC;
    EF.boutons(endEl, { relancer: () => { unlockAudio(); send({ t: 'start' }); }, libelle: relanceLabel(m, 'Relancer'), accueil: () => { homeChoice = true; endEl.classList.add('hidden'); } });
    if (champ && FX()) confettiAt(cam.x, cam.y, 60);
  }

  // ───────────────────────── état réseau ─────────────────────────
  function onMessage(m) { if (m && m.t === 'welcome') mySeat = m.seat; }
  function onLb(d) { board = (d && d.board) || []; renderLB(); }
  function resetRound() {
    buf = []; puffs.length = 0; drops.length = 0; sparks.length = 0; flyers.length = 0; rings.length = 0;
    STREAK.reset(); LUM.vider(); RL.clear(); pendingEnd = null; lastRear.fill(null); prevPos.fill(0); prevPg.fill(0);
    myLapT0 = 0; finSeen = false; lastLapMsg = -1; clearSkids();
  }
  function setCircuit(id) {
    if (id === cid && C) return;
    C = circuitParId(id); cid = C.id; decorKey = ''; miniKey = ''; skidKey = ''; cam.init = false;
  }
  function onState(m) {
    if (m.circuit && m.circuit !== cid) setCircuit(m.circuit);
    snap = m; teamMode = m.gs === 'lobby' ? !!(m.mode && m.mode !== 'ffa') : (m.nteams > 0 && m.nteams < m.players.filter(p => p.playing).length);
    EF.suivre(m.gs);
    if (m.gs !== 'over') homeChoice = false;
    applyPlaying(m.gs);
    document.body.classList.toggle('paused', m.gs === 'paused');
    if (m.gs === 'play' || m.gs === 'countdown') closePanels();
    if (m.round !== prevRound) { prevRound = m.round; resetRound(); }
    else if (m.gs === 'lobby' && prevGs !== 'lobby') resetRound();
    buf.push({ t: performance.now(), s: m }); if (buf.length > 10) buf.shift();
    if (m.gs === 'play' || m.gs === 'paused' || m.gs === 'over') RL.push(m, performance.now()); else { RL.clear(); pendingEnd = null; }
    if (m.gs === 'play' && (prevGs === 'countdown' || !J.actif() || jRound !== m.round)) { J.debut(performance.now()); jRound = m.round; jLast = -1e9; }
    const now = performance.now();
    (m.fx || []).forEach(f => playFx(f, now));
    suivreCourse(m, now);
    suivreJournal(m, now, m.gs === 'over' && prevGs !== 'over');
    if (prevGs !== 'over' && m.gs === 'over') {
      finJournal(m);
      // ralenti : la dernière élimination ; en Course, seulement si la manche s'achève sur une arrivée (tout le monde a fini)
      const decisif = m.formule === 'elim' || now - lastFinishAt < 1500;
      if (decisif && !A.reduceFx && RL.start(now)) pendingEnd = m;
      else { sound('win'); music.sting('win'); }
    }
    if (m.gs === 'countdown' && prevGs !== 'countdown') {
      // le serveur remet les commandes à zéro au départ : une touche (ou le stick) tenue depuis la manche d'avant est renvoyée
      if (input.up || input.down || input.left || input.right) pushInput(); else if (anaSent && anaSent !== '0') { anaSent = ''; }
      const bm = balleDeMatch(m.match, matchTeamName);
      if (bm) { CALL.push('BALLE DE MATCH', '#ffd24a', now); msgGlobal('🏆', bm, { color: '#ffd24a' }); }
    }
    if (m.gs === 'countdown' && m.count > 0 && m.count !== lastCount) { music.sting('count'); sound('count'); }
    if (prevGs === 'countdown' && m.gs === 'play') { music.sting('go'); sound('go'); goT0 = now; }
    lastCount = m.count;
    prevGs = m.gs;
    { let inten = 0;
      if (m.gs === 'play' || m.gs === 'countdown') {
        inten = 1;
        const me = mySeat >= 0 ? m.players[mySeat] : null, lead = seatOk(m.lead) ? m.players[m.lead] : null;
        if (m.formule === 'elim') { let n = 0; m.players.forEach(p => { if (p.playing && p.alive) n++; }); if (n <= 2 && m.players.filter(p => p.playing).length >= 3) inten = 2; }
        else if ((lead && lead.lap >= m.laps && m.laps > 1) || m.finT != null || (me && me.playing && me.lap >= m.laps && m.laps > 1)) inten = 2;
      }
      music.setIntensity(inten); }
    refreshHUD();
    if (m.gs === 'over') { if (!endShown && !pendingEnd) { showEndscreen(m); endShown = true; overT0 = now; } }
    else { endShown = false; pendingEnd = null; if (endPod) { endPod = false; layoutEnd(); } endEl.classList.add('hidden'); }
    if (matchBtn) matchBtn.maj(m.match, m.gs);
    const idle = m.gs === 'lobby' || m.gs === 'over';
    const total = (m.connected || 0) + (m.botCount || 0);
    startBtn.disabled = !(mySeat >= 0 && idle && m.connected >= 1);
    startBtn.textContent = m.gs === 'over' ? '↻ ' + relanceLabel(m, 'Rejouer') : '▶ Démarrer';
    pauseBtn.disabled = !(m.gs === 'play' || m.gs === 'paused');
    pauseBtn.textContent = m.gs === 'paused' ? '▶ Reprendre' : '⏸ Pause';
    pauseFloat.textContent = m.gs === 'paused' ? '▶' : '⏸';
    if (botsBtn) { botsBtn.disabled = !idle; botsBtn.textContent = '🤖 Bots : ' + (m.botCount || 0); botsBtn.classList.toggle('on', (m.botCount || 0) > 0); }
    if (diffBtn) { diffBtn.disabled = !idle; diffBtn.textContent = '🎯 IA : ' + (DIFF_NAMES[m.botDiff] || 'Normale'); }
    modeBtn.disabled = !(idle && TEAM_TOTALS.indexOf(total) >= 0);
    modeBtn.textContent = '⚔ ' + (MODE_NAME[m.mode] || m.mode || 'FFA'); modeBtn.classList.toggle('on', teamMode);
    if (formBtn) { formBtn.disabled = !idle; formBtn.textContent = FORMULE_NAME[m.formule] || '🏁 Course'; formBtn.classList.toggle('on', m.formule === 'elim'); }
    if (circBtn) { circBtn.disabled = !idle; const cd = circuitParId(m.circuit); circBtn.textContent = cd.emoji + ' ' + cd.nom; }
    if (lapsBtn) { lapsBtn.disabled = !idle || m.formule === 'elim'; lapsBtn.textContent = '🔁 ' + m.laps + ' tour' + (m.laps > 1 ? 's' : ''); }
  }
  // suivi de MA course : tours, dépassements, mauvais sens, record (messages et annonces)
  function suivreCourse(m, now) {
    if (m.gs !== 'play') { for (let i = 0; i < MAX_SEATS; i++) { const p = m.players[i]; prevPos[i] = p ? p.pos : 0; prevPg[i] = p ? p.pg : 0; } return; }
    const k = m.K || 1;
    m.players.forEach((p, i) => {
      if (!p.playing) return;
      if (p.pg !== prevPg[i] && i === mySeat && p.pg % k === 1) myLapT0 = m.rt;   // ligne franchie : mon chrono de tour repart
      if (i === mySeat && prevPos[i] && p.pos < prevPos[i] && p.alive && !p.fin && now - goT0 > 2500 && m.formule !== 'elim') CALL.push(p.pos === 1 ? 'EN TÊTE !' : 'DÉPASSEMENT !', colSeat(i), now);
      prevPos[i] = p.pos; prevPg[i] = p.pg;
    });
    const me = mySeat >= 0 ? m.players[mySeat] : null;
    if (me && me.playing && me.alive && me.ww && now - lastWrongMsg > 3000) { lastWrongMsg = now; msgPerso('↩', 'Mauvais sens ! Fais demi-tour', { bad: true }); }
    if (m.finT != null && !finSeen) { finSeen = true; }
  }

  // ───────────────────────── journal de manche (courbe + meilleure action) ─────────────────────────
  function suivreJournal(m, now, force) {
    if (!J.actif() || !(m.gs === 'play' || force)) return;
    if (!force && now - jLast < 500) return;
    jLast = now;
    const vals = {}, n = m.players.filter(p => p.playing).length;
    m.players.forEach(p => { if (p.playing) vals[p.seat] = p.alive || m.formule !== 'elim' ? n + 1 - (p.pos || n) : 0; });
    J.echantillon(now, vals, true);
  }
  function finJournal(m) {
    if (!J.actif()) return;
    const w = winTeam(m) >= 0 ? m.players.find(p => p.playing && p.team === m.winner && p.place === 1) : null;
    if (w) J.moment(performance.now(), w.seat, m.formule === 'elim' ? 'reste seul dans le cadre' : 'remporte la course', 1);
    J.fin();
  }

  // ───────────────────────── sons (WebAudio, zéro fichier) ─────────────────────────
  function unlockAudio() { if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} } if (actx && actx.state === 'suspended') actx.resume(); }
  let sndPan = 0;
  const vol = () => (A && typeof A.sfx === 'number') ? A.sfx : 1;
  function out(node) { if (sndPan && actx.createStereoPanner) { const pn = actx.createStereoPanner(); pn.pan.value = Math.max(-1, Math.min(1, sndPan)); pn.connect(actx.destination); node.connect(pn); } else node.connect(actx.destination); }
  function tone(f, d, ty, g, dl) { ty = ty || 'square'; g = g == null ? 0.05 : g; dl = dl || 0; const v = vol(); if (!actx || v <= 0) return; const t0 = actx.currentTime + dl, o = actx.createOscillator(), gg = actx.createGain(); o.type = ty; o.frequency.setValueAtTime(f, t0); gg.gain.setValueAtTime(g * v, t0); gg.gain.exponentialRampToValueAtTime(0.0001, t0 + d); o.connect(gg); out(gg); o.start(t0); o.stop(t0 + d + 0.02); }
  function glide(f0, f1, d, ty, g, dl) { dl = dl || 0; const v = vol(); if (!actx || v <= 0) return; const t0 = actx.currentTime + dl, o = actx.createOscillator(), gg = actx.createGain(); o.type = ty; o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + d); gg.gain.setValueAtTime(g * v, t0); gg.gain.exponentialRampToValueAtTime(0.0001, t0 + d + 0.03); o.connect(gg); out(gg); o.start(t0); o.stop(t0 + d + 0.06); }
  function bruit() { if (!noiseBuf || noiseBuf.sampleRate !== actx.sampleRate) { const sr = actx.sampleRate, b = actx.createBuffer(1, Math.floor(sr * 1.5), sr), dd = b.getChannelData(0); for (let i = 0; i < dd.length; i++) dd[i] = Math.random() * 2 - 1; noiseBuf = b; } return noiseBuf; }
  function noise(d, type, freq, g, dl, q) {
    const v = vol(); if (!actx || v <= 0) return;
    const t0 = actx.currentTime + (dl || 0), s = actx.createBufferSource(), f = actx.createBiquadFilter(), gg = actx.createGain();
    s.buffer = bruit(); f.type = type; f.frequency.value = freq; if (q) f.Q.value = q;
    gg.gain.setValueAtTime(0.0001, t0); gg.gain.exponentialRampToValueAtTime(g * v, t0 + Math.min(0.012, d * 0.2)); gg.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
    s.connect(f); f.connect(gg); out(gg); s.start(t0); s.stop(t0 + d + 0.02);
  }
  // son positionné : gauche / droite selon la position à l'écran, atténué avec la distance à MA voiture
  function psound(k, x, y, arg) {
    const dx = x - cam.x, dy = y - cam.y, d = Math.hypot(dx, dy), half = cam.w / 2;
    if (d > half * 2.2) return;
    sndPan = Math.max(-1, Math.min(1, dx / half * 0.9)); sound(k, arg, Math.max(0.25, 1 - d / (half * 2.2))); sndPan = 0;
  }
  function sound(k, arg, att) {
    if (!actx) return;
    const a = att == null ? 1 : att;
    if (k === 'bump') { const i = Math.max(0.2, Math.min(1, arg || 0.5)); noise(0.09, 'lowpass', 900 + 900 * i, 0.16 * i * a); tone(110 + 60 * i, 0.08, 'triangle', 0.06 * i * a); }   // choc de plastique
    else if (k === 'wall') { const i = Math.max(0.2, Math.min(1, arg || 0.5)); noise(0.07, 'bandpass', 1800, 0.12 * i * a, 0, 2); tone(220, 0.06, 'square', 0.03 * i * a); }
    else if (k === 'fall') { glide(900, 140, 0.55, 'triangle', 0.07 * a); noise(0.12, 'lowpass', 600, 0.14 * a, 0.55); }   // sifflet qui tombe… et « toc » par terre
    else if (k === 'hole') { glide(500, 90, 0.35, 'sine', 0.08 * a); tone(70, 0.2, 'sine', 0.1 * a, 0.34); }             // plop dans la poche
    else if (k === 'respawn') { tone(660, 0.07, 'square', 0.035 * a); tone(990, 0.1, 'square', 0.03 * a, 0.07); }
    else if (k === 'lap') { tone(880, 0.12, 'triangle', 0.05); tone(1320, 0.18, 'triangle', 0.045, 0.1); }
    else if (k === 'best') { tone(988, 0.1, 'square', 0.035); tone(1319, 0.1, 'square', 0.035, 0.09); tone(1760, 0.22, 'square', 0.03, 0.18); }
    else if (k === 'lastlap') { for (let i = 0; i < 3; i++) tone(1046, 0.12, 'square', 0.04, i * 0.16); }
    else if (k === 'finish') { tone(523, 0.14, 'square', 0.05); tone(659, 0.14, 'square', 0.05, 0.12); tone(784, 0.14, 'square', 0.05, 0.24); tone(1046, 0.4, 'square', 0.05, 0.36); }
    else if (k === 'boost') { glide(260, 1300, 0.32, 'sawtooth', 0.04 * a); noise(0.3, 'highpass', 2500, 0.05 * a); }
    else if (k === 'splash') { noise(0.22, arg === 'lait' || arg === 'encre' ? 'highpass' : 'bandpass', arg === 'lait' || arg === 'encre' ? 1800 : 3200, 0.09 * a, 0, 1.5); }
    else if (k === 'honk') { const b = arg || 0; tone(392 + b, 0.26, 'square', 0.04 * a); tone(494 + b, 0.26, 'square', 0.035 * a); }   // pouet-pouet de voiture-jouet
    else if (k === 'out') { glide(420, 110, 0.45, 'sawtooth', 0.05 * a); }
    else if (k === 'count') tone(392, 0.16, 'square', 0.05);
    else if (k === 'go') { tone(784, 0.5, 'square', 0.05); tone(1175, 0.5, 'square', 0.03); }
    else if (k === 'win') { tone(523, 0.3, 'triangle', 0.06); tone(659, 0.3, 'triangle', 0.06, 0.14); tone(784, 0.3, 'triangle', 0.06, 0.28); tone(1046, 0.5, 'triangle', 0.06, 0.42); }
  }
  // moteur de MA voiture : dent de scie + carré désaccordé, filtre passe-bas ; régime = vitesse ; crissement = bruit filtré selon la glisse
  const eng = { on: false, o1: null, o2: null, f: null, g: null, ns: null, nf: null, ng: null };
  function moteur(sp, thr, drift, actif) {
    if (!actx || vol() <= 0 || !actif) { if (eng.on) stopMoteur(); return; }
    if (!eng.on) {
      try {
        eng.o1 = actx.createOscillator(); eng.o2 = actx.createOscillator(); eng.f = actx.createBiquadFilter(); eng.g = actx.createGain();
        eng.o1.type = 'sawtooth'; eng.o2.type = 'square'; eng.f.type = 'lowpass'; eng.f.frequency.value = 600; eng.g.gain.value = 0;
        eng.o1.connect(eng.f); eng.o2.connect(eng.f); eng.f.connect(eng.g); eng.g.connect(actx.destination); eng.o1.start(); eng.o2.start();
        eng.ns = actx.createBufferSource(); eng.ns.buffer = bruit(); eng.ns.loop = true; eng.nf = actx.createBiquadFilter(); eng.nf.type = 'bandpass'; eng.nf.frequency.value = 2400; eng.nf.Q.value = 1.4; eng.ng = actx.createGain(); eng.ng.gain.value = 0;
        eng.ns.connect(eng.nf); eng.nf.connect(eng.ng); eng.ng.connect(actx.destination); eng.ns.start();
        eng.on = true;
      } catch (e) { stopMoteur(); return; }
    }
    const t = actx.currentTime, v = vol(), f = 52 + sp * 13 + (thr > 0 ? 18 : 0);
    eng.o1.frequency.setTargetAtTime(f, t, 0.05); eng.o2.frequency.setTargetAtTime(f * 0.502, t, 0.05);
    eng.f.frequency.setTargetAtTime(380 + sp * 90 + (thr > 0 ? 400 : 0), t, 0.08);
    eng.g.gain.setTargetAtTime((0.012 + 0.0022 * sp + (thr > 0 ? 0.006 : 0)) * v, t, 0.06);
    eng.ng.gain.setTargetAtTime(drift >= 2 && sp > 3 ? Math.min(0.05, 0.008 * drift) * v : 0, t, 0.05);
  }
  function stopMoteur() {
    const list = ['o1', 'o2', 'ns']; for (const k of list) { const n = eng[k]; if (n) { try { n.stop(); } catch (e) {} try { n.disconnect(); } catch (e) {} } }
    for (const k of ['f', 'g', 'nf', 'ng']) { const n = eng[k]; if (n) { try { n.disconnect(); } catch (e) {} } }
    eng.on = false; eng.o1 = eng.o2 = eng.f = eng.g = eng.ns = eng.nf = eng.ng = null;
  }

  // ───────────────────────── effets ponctuels ─────────────────────────
  const FX = () => !A.reduceFx;
  function dust(x, y, n, col, sp) { if (!FX()) return; const now = performance.now(); for (let k = 0; k < n; k++) { const a = Math.random() * Math.PI * 2, s = Math.random() * (sp || 0.6); puffs.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, born: now, life: 420 + Math.random() * 380, r0: 3 + Math.random() * 3, col }); } if (puffs.length > 260) puffs.splice(0, puffs.length - 260); }
  function splashAt(x, y, n, col) { if (!FX()) return; const now = performance.now(); for (let k = 0; k < n; k++) { const a = Math.random() * Math.PI * 2, s = 1 + Math.random() * 3; drops.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, born: now, life: 300 + Math.random() * 260, r: 1.6 + Math.random() * 2.2, col }); } if (drops.length > 220) drops.splice(0, drops.length - 220); }
  function sparksAt(x, y, n, spd) { if (!FX()) return; const now = performance.now(); for (let k = 0; k < n; k++) { const a = Math.random() * Math.PI * 2, s = 1.5 + Math.random() * spd; sparks.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, born: now, life: 200 + Math.random() * 220, c: k % 3 ? '#ffd23a' : '#ffffff' }); } if (sparks.length > 240) sparks.splice(0, sparks.length - 240); }
  function confettiAt(x, y, n) { if (!FX()) return; const now = performance.now(), cols = ['#ffd23a', '#e8322a', '#2f7ff0', '#2bb45a', '#ffffff']; for (let k = 0; k < n; k++) { const a = Math.random() * Math.PI * 2, s = 2 + Math.random() * 6; sparks.push({ x: x + (Math.random() - 0.5) * 200, y: y + (Math.random() - 0.5) * 200, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 2, born: now, life: 900 + Math.random() * 700, c: cols[k % cols.length], big: 1 }); } }
  const ZONE_COL = { lait: '255,255,250', encre: '30,40,110', sucre: '255,255,255', gomme: '240,150,170', craie: '90,150,230' };
  function playFx(f, now) {
    if (!f) return;
    const ps = snap ? snap.players : [];
    if (f.type === 'bump') {
      if (!fin(f.x) || !fin(f.y)) return;
      psound(f.b >= 0 ? 'bump' : 'wall', f.x, f.y, f.i);
      if (f.a === mySeat || f.b === mySeat) shakeMag = Math.max(shakeMag, 3 + 6 * (f.i || 0));
      sparksAt(f.x, f.y, Math.round(4 + 8 * (f.i || 0)), 3);
      if ((f.i || 0) > 0.55) rings.push({ x: f.x, y: f.y, born: now, life: 260, r1: 26 });
      return;
    }
    if (f.type === 'fall') {
      if (!seatOk(f.seat)) return;
      psound(f.hole ? 'hole' : 'fall', f.x, f.y);
      if (f.seat === mySeat && now - myFallMsg > 800) { myFallMsg = now; msgPerso(f.hole ? '🕳' : '😵', f.hole ? 'Dans la poche ! Retour à la dernière porte' : 'Tombé de la table ! Retour à la dernière porte', { bad: true }); CALL.push(f.hole ? 'PLOUF !' : 'AÏE !', '#ff7a5a', now); }
      if (seatOk(f.by)) {
        const tx = streakText(STREAK.kill(f.by, now));
        if (f.by === mySeat) { msgPerso('💥', 'Tu as envoyé ' + nameOf(f.seat) + ' dans le décor !', { color: K.yel }); CALL.push(tx || 'DANS LE DÉCOR !', colSeat(f.by), now); }
        else if (tx) msgGlobal('💥', nameOf(f.by) + ' — ' + tx, { color: colSeat(f.by) });
        if (J.actif()) J.moment(now, f.by, 'a envoyé ' + nameOf(f.seat) + (f.hole ? ' dans une poche' : ' par-dessus bord'), 5);
      }
      if (FX()) dust(f.x, f.y, 8, '200,190,170', 0.9);
      return;
    }
    if (f.type === 'respawn') { const p = ps[f.seat]; if (p && seatOk(f.seat)) { lastRear[f.seat] = null; psound('respawn', p.x, p.y); if (FX()) rings.push({ x: p.x, y: p.y, born: now, life: 420, r1: 36 }); } return; }
    if (f.type === 'lap') {
      if (!seatOk(f.seat)) return;
      if (f.seat === mySeat) {
        if (f.rec || f.best) { sound('best'); CALL.push(f.rec ? 'RECORD DU TOUR !' : 'MEILLEUR TOUR !', K.yel, now); msgPerso('⏱', (f.rec ? 'Record du tour : ' : 'Meilleur tour : ') + fmtT(f.sec), { color: K.yel }); }
        else sound('lap');
        if (f.last) { sound('lastlap'); CALL.push('DERNIER TOUR !', K.red, now); }
      } else if (f.last && snap && snap.lead === f.seat && lastLapMsg !== f.seat) { lastLapMsg = f.seat; msgGlobal('🔔', nameOf(f.seat) + ' attaque le dernier tour', { color: colSeat(f.seat) }); }
      if (f.rec && J.actif()) J.moment(now, f.seat, 'record du tour en ' + fmtT(f.sec), 4);
      return;
    }
    if (f.type === 'finish') {
      if (!seatOk(f.seat)) return;
      lastFinishAt = now;
      const p = ps[f.seat];
      if (f.seat === mySeat) { sound('finish'); CALL.push(f.pos === 1 ? 'VICTOIRE !' : ORD(f.pos) + ' !', f.pos === 1 ? K.yel : '#ffffff', now); if (p) confettiAt(p.x, p.y, f.pos === 1 ? 70 : 24); }
      if (f.pos === 1) { msgGlobal('🏁', nameOf(f.seat) + ' franchit la ligne en tête !', { color: colSeat(f.seat) }); if (f.seat !== mySeat) sound('lap'); if (J.actif()) J.moment(now, f.seat, 'franchit la ligne en tête', 3); }
      return;
    }
    if (f.type === 'out') {
      if (!seatOk(f.seat) || !fin(f.x)) return;
      const p = ps[f.seat];
      flyers.push({ seat: f.seat, x: f.x, y: f.y, a: p && fin(p.a) ? p.a : 0, born: now });
      psound('out', f.x, f.y); music.sting('kill');
      if (f.seat === mySeat) { msgPerso('📺', 'Sorti de l\'écran : éliminé !', { bad: true }); CALL.push('ÉLIMINÉ', K.red, now); }
      else msgGlobal('📺', nameOf(f.seat) + ' sort de l\'écran', { color: colSeat(f.seat) });
      if (J.actif()) J.moment(now, seatOk(snap && snap.lead) ? snap.lead : f.seat, 'a semé ' + nameOf(f.seat), 2);
      sparksAt(f.x, f.y, 18, 4);
      return;
    }
    if (f.type === 'boost') { const p = ps[f.seat]; if (p) { psound('boost', p.x, p.y); if (FX()) LUM.ajouter(p.x, p.y, 70, '#ffd23a', 380, 0.5); } return; }
    if (f.type === 'splash') { if (!fin(f.x)) return; psound('splash', f.x, f.y, f.k); splashAt(f.x, f.y, f.k === 'lait' || f.k === 'encre' ? 14 : 8, Object.prototype.hasOwnProperty.call(ZONE_COL, f.k) ? ZONE_COL[f.k] : '255,255,255'); if (f.seat === mySeat && (f.k === 'lait' || f.k === 'encre')) msgPerso(f.k === 'lait' ? '🥛' : '🖋', f.k === 'lait' ? 'Lait renversé : ça glisse !' : 'Tache d\'encre : ça glisse !', { color: '#bfe6ff' }); return; }
    if (f.type === 'honk') { const p = ps[f.seat]; if (p) { psound('honk', p.x, p.y, (f.seat % 5) * 24); if (FX()) rings.push({ x: p.x, y: p.y, born: now, life: 300, r1: 30, honk: 1 }); } return; }
    if (f.type === 'lead') { if (f.seat !== mySeat && snap && snap.formule === 'course' && now - goT0 > 4000) msgGlobal('🥇', nameOf(f.seat) + ' prend la tête', { color: colSeat(f.seat) }); if (J.actif() && now - goT0 > 4000) J.moment(now, f.seat, 'prend la tête', 2); return; }
    if (f.type === 'quit') { if (seatOk(f.seat)) msgGlobal('🚪', nameOf(f.seat) + ' quitte la course'); }
  }

  // ───────────────────────── interpolation ─────────────────────────
  const VIEWP = {};
  function viewCars(now) {
    if (!buf.length) return null;
    const hz = (snap && snap.shz) || TICK_HZ, delay = Math.max(55, 1650 / hz);
    const target = now - delay; let a = buf[0], b = buf[buf.length - 1];
    for (let i = 0; i < buf.length; i++) if (buf[i].t <= target) a = buf[i];
    for (let i = buf.length - 1; i >= 0; i--) if (buf[i].t >= target) b = buf[i];
    const span = b.t - a.t; let al = span > 0 ? (target - a.t) / span : 0; al = al < 0 ? 0 : al > 1 ? 1 : al;
    return lerpCars(a.s, b.s, al);
  }
  function lerpCars(sa, sb, al) {
    for (const k in VIEWP) delete VIEWP[k];
    sb.players.forEach(pb => {
      if (!pb.playing) return;
      const pa = sa.players[pb.seat]; let x = pb.x, y = pb.y, ang = pb.a || 0, fa = pb.fa || 0;
      if (pa && pa.playing && Math.hypot(pb.x - pa.x, pb.y - pa.y) < 90) {
        x = pa.x + (pb.x - pa.x) * al; y = pa.y + (pb.y - pa.y) * al;
        const da = Math.atan2(Math.sin(ang - (pa.a || 0)), Math.cos(ang - (pa.a || 0))); ang = (pa.a || 0) + da * al;
        if (pb.fa >= (pa.fa || 0)) fa = (pa.fa || 0) + (pb.fa - (pa.fa || 0)) * al;
      }
      VIEWP[pb.seat] = { x, y, a: ang, fa };
    });
    return VIEWP;
  }

  // ───────────────────────── décor pré-rendu (une fois par circuit) ─────────────────────────
  let decorCv = null, decorKey = '', decorQ = 1, skidCv = null, skidG = null, skidKey = '', skidQ = 0.6, miniCv = null, miniKey = '';
  function ensureDecor() {
    let q = Math.min(1.15, Math.max(0.5, cv.width / VIEW));
    q = Math.min(q, Math.sqrt(5.2e6 / (C.w * C.h)));
    q = Math.round(q * 20) / 20;
    const key = C.id + '|' + q + '|' + (A.contrast ? 1 : 0);
    if (decorCv && key === decorKey) return;
    decorKey = key; decorQ = q;
    if (!decorCv) decorCv = document.createElement('canvas');
    decorCv.width = Math.round(C.w * q); decorCv.height = Math.round(C.h * q);
    const g = decorCv.getContext('2d');
    g.setTransform(q, 0, 0, q, 0, 0);
    peindreCircuit(g, C);
  }
  function ensureSkids() {
    const q = Math.round(decorQ * 0.6 * 20) / 20, key = C.id + '|' + q;
    if (skidCv && key === skidKey) return;
    skidKey = key; skidQ = q;
    if (!skidCv) skidCv = document.createElement('canvas');
    skidCv.width = Math.round(C.w * q); skidCv.height = Math.round(C.h * q);
    skidG = skidCv.getContext('2d'); skidG.setTransform(q, 0, 0, q, 0, 0); skidG.lineCap = 'round';
  }
  function clearSkids() { if (skidG) { skidG.save(); skidG.setTransform(1, 0, 0, 1, 0, 0); skidG.clearRect(0, 0, skidCv.width, skidCv.height); skidG.restore(); } }
  const HORS = { bois: '#4a2a1a', cahier: '#3c2618', feutre: '#3c2618', moquette: '#3c2618' };
  const SKID_COL = { bois: 'rgba(40,22,10,0.28)', cahier: 'rgba(70,70,84,0.26)', feutre: 'rgba(10,36,18,0.3)', moquette: 'rgba(60,24,8,0.32)' };

  function trackPath(g, c, off) {                       // polyligne fermée décalée de `off` u (à droite du sens de course)
    g.beginPath();
    for (let i = 0; i <= c.n; i++) { const j = i % c.n, x = c.sx[j] + c.nx[j] * off, y = c.sy[j] + c.ny[j] * off; if (i) g.lineTo(x, y); else g.moveTo(x, y); }
  }
  function centerStroke(g, c, w, col) { trackPath(g, c, 0); g.lineWidth = w; g.strokeStyle = col; g.lineJoin = 'round'; g.lineCap = 'round'; g.stroke(); }
  function peindreCircuit(g, c) {
    const R = rng(0x51ca + c.L | 0), t = c.table;
    // 1) sol de la pièce, autour de la table
    sol(g, c, R);
    // 2) table : ombre portée puis plateau
    g.save(); g.fillStyle = 'rgba(0,0,0,0.45)'; g.beginPath(); rr(g, t.x0 + 16, t.y0 + 22, t.x1 - t.x0, t.y1 - t.y0, t.r); g.fill(); g.restore();
    g.save(); g.beginPath(); rr(g, t.x0, t.y0, t.x1 - t.x0, t.y1 - t.y0, t.r); g.clip();
    plateau(g, c, R);
    // 3) piste
    piste(g, c, R);
    // 4) zones (lait, encre, sucre…)
    for (const z of c.zones) zone(g, z, R);
    // 5) ligne de départ (damier) + portes discrètes
    depart(g, c);
    g.restore();
    // bord de table : biseau clair + liseré sombre (là où l'on tombe)
    if (c.edge === 'chute') {
      g.save(); g.lineWidth = 10; g.strokeStyle = c.surf === 'bois' ? '#7a4a22' : '#5b3a20'; g.beginPath(); rr(g, t.x0 + 4, t.y0 + 4, t.x1 - t.x0 - 8, t.y1 - t.y0 - 8, Math.max(4, t.r - 4)); g.stroke();
      g.lineWidth = 3; g.strokeStyle = 'rgba(255,230,190,0.45)'; g.beginPath(); rr(g, t.x0 + 9, t.y0 + 9, t.x1 - t.x0 - 18, t.y1 - t.y0 - 18, Math.max(4, t.r - 9)); g.stroke();
      if (A.contrast) { g.lineWidth = 4; g.strokeStyle = '#ffffff'; g.setLineDash([18, 12]); g.beginPath(); rr(g, t.x0 + 2, t.y0 + 2, t.x1 - t.x0 - 4, t.y1 - t.y0 - 4, t.r); g.stroke(); g.setLineDash([]); }
      g.restore();
    }
    // 6) trous, décor, obstacles, murs
    for (const h of c.holes) poche(g, h);
    for (const d of c.deco) decor(g, d, R);
    for (const w of c.walls) mur(g, w);
    if (c.surf === 'moquette') rails(g, c);
    for (const r of c.rocks) objet(g, r, R);
  }
  function sol(g, c, R) {
    const W = c.w, H = c.h;
    if (c.surf === 'bois') {                              // carrelage de cuisine crème et terre cuite
      const s = 150; for (let y = 0; y < H; y += s) for (let x = 0; x < W; x += s) { g.fillStyle = ((x + y) / s) % 2 ? '#d9c7a6' : '#b8643e'; g.fillRect(x, y, s, s); }
      g.strokeStyle = 'rgba(60,30,10,0.35)'; g.lineWidth = 3; for (let x = 0; x <= W; x += s) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); } for (let y = 0; y <= H; y += s) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
    } else if (c.surf === 'cahier' || c.surf === 'feutre' || c.surf === 'moquette') {   // parquet
      const h = 64; for (let y = 0, row = 0; y < H; y += h, row++) {
        let x = -((row * 173) % 300);
        while (x < W) { const len = 260 + R() * 220, tn = 0.85 + R() * 0.3; g.fillStyle = rgbStr(mix([116, 74, 42], [158, 104, 62], R() * tn)); g.fillRect(x, y, len - 3, h - 3); x += len; }
      }
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, 0, W, H);
    }
    if (c.surf === 'feutre') {                           // billard : cadre en acajou verni et mouches de nacre (autour du feutre)
      const t = c.table, f = 62;
      g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(t.x0 - f + 14, t.y0 - f + 20, t.x1 - t.x0 + 2 * f, t.y1 - t.y0 + 2 * f);
      const gr = g.createLinearGradient(0, t.y0 - f, 0, t.y1 + f); gr.addColorStop(0, '#7a3418'); gr.addColorStop(0.5, '#5a2412'); gr.addColorStop(1, '#3e180a');
      g.fillStyle = gr; g.fillRect(t.x0 - f, t.y0 - f, t.x1 - t.x0 + 2 * f, t.y1 - t.y0 + 2 * f);
      g.strokeStyle = 'rgba(255,220,170,0.25)'; g.lineWidth = 3; g.strokeRect(t.x0 - f + 6, t.y0 - f + 6, t.x1 - t.x0 + 2 * f - 12, t.y1 - t.y0 + 2 * f - 12);
      g.fillStyle = '#f2ead8';
      for (let k = 1; k < 8; k++) { if (k === 4) continue; const x = t.x0 + (t.x1 - t.x0) * k / 8; g.beginPath(); g.arc(x, t.y0 - f / 2, 6, 0, Math.PI * 2); g.arc(x, t.y1 + f / 2, 6, 0, Math.PI * 2); g.fill(); }
      for (let k = 1; k < 4; k++) { const y = t.y0 + (t.y1 - t.y0) * k / 4; g.beginPath(); g.arc(t.x0 - f / 2, y, 6, 0, Math.PI * 2); g.arc(t.x1 + f / 2, y, 6, 0, Math.PI * 2); g.fill(); }
    }
  }
  function plateau(g, c, R) {
    const t = c.table, W = t.x1 - t.x0, H = t.y1 - t.y0;
    if (c.surf === 'bois') {                              // planches de bois clair, veinage, nœuds
      const ph = 140;
      for (let y = t.y0, k = 0; y < t.y1; y += ph, k++) {
        g.fillStyle = rgbStr(mix([214, 170, 112], [190, 140, 86], (k % 3) / 3 + R() * 0.2)); g.fillRect(t.x0, y, W, ph);
        g.strokeStyle = 'rgba(110,64,30,0.18)'; g.lineWidth = 1.6;
        for (let v = 0; v < 6; v++) { const yy = y + 12 + v * 21 + R() * 8; g.beginPath(); g.moveTo(t.x0, yy); for (let x = t.x0; x <= t.x1; x += 80) g.lineTo(x, yy + Math.sin(x / 190 + v + k) * 5); g.stroke(); }
        g.strokeStyle = 'rgba(70,40,18,0.45)'; g.lineWidth = 3; g.beginPath(); g.moveTo(t.x0, y); g.lineTo(t.x1, y); g.stroke();
        for (let n = 0; n < 2; n++) { const x = t.x0 + R() * W, yy = y + 30 + R() * (ph - 60); g.fillStyle = 'rgba(110,62,26,0.35)'; g.beginPath(); oval(g, x, yy, 16, 7); g.fill(); g.fillStyle = 'rgba(80,44,18,0.4)'; g.beginPath(); oval(g, x, yy, 7, 3); g.fill(); }
      }
      const sh = g.createRadialGradient(t.x0 + W * 0.4, t.y0 + H * 0.35, 80, t.x0 + W / 2, t.y0 + H / 2, W * 0.7);
      sh.addColorStop(0, 'rgba(255,240,200,0.14)'); sh.addColorStop(1, 'rgba(60,30,10,0.22)'); g.fillStyle = sh; g.fillRect(t.x0, t.y0, W, H);
    } else if (c.surf === 'cahier') {                     // bureau en bois sombre + grand cahier ouvert (quadrillage, marge rouge, spirale)
      g.fillStyle = '#6b3f22'; g.fillRect(t.x0, t.y0, W, H);
      g.strokeStyle = 'rgba(30,14,6,0.25)'; g.lineWidth = 2; for (let y = t.y0 + 20; y < t.y1; y += 34) { g.beginPath(); g.moveTo(t.x0, y); for (let x = t.x0; x <= t.x1; x += 100) g.lineTo(x, y + Math.sin(x / 230 + y) * 4); g.stroke(); }
      const px0 = t.x0 + 70, py0 = t.y0 + 60, pw = W - 140, ph = H - 120, mid = px0 + pw / 2;
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(px0 + 10, py0 + 14, pw, ph);
      g.fillStyle = '#fbfaf2'; g.fillRect(px0, py0, pw, ph);
      g.strokeStyle = 'rgba(90,150,220,0.32)'; g.lineWidth = 1.2; g.beginPath();
      for (let x = px0 + 25; x < px0 + pw; x += 25) { g.moveTo(x, py0); g.lineTo(x, py0 + ph); }
      for (let y = py0 + 25; y < py0 + ph; y += 25) { g.moveTo(px0, y); g.lineTo(px0 + pw, y); }
      g.stroke();
      g.strokeStyle = 'rgba(220,60,60,0.55)'; g.lineWidth = 2.5; for (const mx of [px0 + 110, mid + 110]) { g.beginPath(); g.moveTo(mx, py0); g.lineTo(mx, py0 + ph); g.stroke(); }
      const sg = g.createLinearGradient(mid - 40, 0, mid + 40, 0); sg.addColorStop(0, 'rgba(0,0,0,0)'); sg.addColorStop(0.5, 'rgba(0,0,0,0.16)'); sg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = sg; g.fillRect(mid - 40, py0, 80, ph);
      for (let y = py0 + 30; y < py0 + ph; y += 46) { g.strokeStyle = '#8f939a'; g.lineWidth = 5; g.beginPath(); oval(g, mid, y, 16, 9); g.stroke(); g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 1.5; g.beginPath(); g.arc(mid - 3, y - 3, 11, Math.PI * 1.1, Math.PI * 1.6); g.stroke(); }
    } else if (c.surf === 'feutre') {                     // billard : cadre en acajou, mouches de nacre, feutre vert éclairé par la lampe
      g.fillStyle = '#1f7a3e'; g.fillRect(t.x0, t.y0, W, H);
      g.fillStyle = 'rgba(255,255,255,0.03)'; for (let k = 0; k < 2500; k++) { g.fillRect(t.x0 + R() * W, t.y0 + R() * H, 2, 2); }
      const lg = g.createRadialGradient(t.x0 + W / 2, t.y0 + H / 2, 100, t.x0 + W / 2, t.y0 + H / 2, W * 0.62);
      lg.addColorStop(0, 'rgba(210,255,200,0.16)'); lg.addColorStop(1, 'rgba(0,20,5,0.4)'); g.fillStyle = lg; g.fillRect(t.x0, t.y0, W, H);
      g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = 2; g.beginPath(); g.moveTo(t.x0 + W * 0.22, t.y0 + 20); g.lineTo(t.x0 + W * 0.22, t.y1 - 20); g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.arc(t.x0 + W * 0.22, t.y0 + H / 2, 5, 0, Math.PI * 2); g.arc(t.x0 + W * 0.75, t.y0 + H / 2, 5, 0, Math.PI * 2); g.fill();
    } else {                                              // moquette du salon : tapis à motifs et franges
      g.fillStyle = '#8c2731'; g.fillRect(t.x0, t.y0, W, H);
      g.fillStyle = '#2d3f8c'; g.fillRect(t.x0 + 60, t.y0 + 60, W - 120, H - 120);
      g.fillStyle = '#9b2e38'; g.fillRect(t.x0 + 110, t.y0 + 110, W - 220, H - 220);
      g.strokeStyle = 'rgba(255,210,120,0.5)'; g.lineWidth = 6; g.strokeRect(t.x0 + 84, t.y0 + 84, W - 168, H - 168);
      g.fillStyle = 'rgba(255,214,120,0.22)';
      for (let y = t.y0 + 170; y < t.y1 - 140; y += 120) for (let x = t.x0 + 170 + ((y / 120) % 2) * 60; x < t.x1 - 140; x += 120) { g.beginPath(); g.moveTo(x, y - 22); g.lineTo(x + 22, y); g.lineTo(x, y + 22); g.lineTo(x - 22, y); g.closePath(); g.fill(); }
      g.fillStyle = 'rgba(255,255,255,0.035)'; for (let k = 0; k < 3000; k++) g.fillRect(t.x0 + R() * W, t.y0 + R() * H, 2, 2);
    }
  }
  function piste(g, c, R) {
    const W = c.W;
    if (c.surf === 'bois') {
      centerStroke(g, c, 2 * W + 10, 'rgba(120,70,30,0.22)');
      centerStroke(g, c, 2 * W, 'rgba(255,236,200,0.2)');
      for (const side of [-1, 1]) {                       // bordure de céréales (anneaux dorés) et de morceaux de sucre
        for (let i = 0; i < c.n; i += 3) {
          if (R() < 0.12) continue;
          const o = (W + 8 + R() * 6) * side, x = c.sx[i] + c.nx[i] * o, y = c.sy[i] + c.ny[i] * o;
          if (R() < 0.08) { g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x - 6, y - 4, 13, 13); g.fillStyle = '#fbfbf6'; g.fillRect(x - 7, y - 7, 13, 13); g.lineWidth = 1; g.strokeStyle = 'rgba(0,0,0,0.15)'; g.strokeRect(x - 7, y - 7, 13, 13); continue; }   // lineWidth : sinon celui du ruban de piste (≈ 150 u)
          const r = 7 + R() * 2;
          g.fillStyle = 'rgba(80,40,10,0.25)'; g.beginPath(); g.arc(x + 1.5, y + 2, r, 0, Math.PI * 2); g.fill();
          g.fillStyle = R() < 0.5 ? '#e7a93a' : '#d98b26'; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.arc(x, y, r * 0.42, 0, Math.PI * 2, true); g.fill();
          g.fillStyle = 'rgba(255,240,180,0.5)'; g.beginPath(); g.arc(x - r * 0.35, y - r * 0.35, r * 0.25, 0, Math.PI * 2); g.fill();
        }
      }
    } else if (c.surf === 'cahier') {
      centerStroke(g, c, 2 * W, 'rgba(255,255,255,0.35)');
      for (const side of [-1, 1]) {                       // bords tracés au crayon à papier, un peu tremblés
        g.strokeStyle = 'rgba(60,62,74,0.75)'; g.lineWidth = 3; g.lineJoin = 'round'; g.beginPath();
        for (let i = 0; i <= c.n; i++) { const j = i % c.n, o = (W + Math.sin(j * 0.7) * 1.6) * side, x = c.sx[j] + c.nx[j] * o, y = c.sy[j] + c.ny[j] * o; if (i) g.lineTo(x, y); else g.moveTo(x, y); }
        g.stroke();
        g.strokeStyle = 'rgba(60,62,74,0.25)'; g.lineWidth = 1.5; trackPath(g, c, (W + 6) * side); g.stroke();
      }
      g.strokeStyle = 'rgba(40,90,200,0.35)'; g.lineWidth = 3; g.setLineDash([16, 26]); trackPath(g, c, 0); g.stroke(); g.setLineDash([]);   // pointillé au stylo bleu
      for (let i = 0; i < c.n; i += Math.round(c.n / 9)) {   // flèches de sens, au crayon
        const x = c.sx[i], y = c.sy[i], a = Math.atan2(c.ty[i], c.tx[i]);
        g.save(); g.translate(x, y); g.rotate(a); g.strokeStyle = 'rgba(60,62,74,0.55)'; g.lineWidth = 3; g.beginPath(); g.moveTo(-14, -14); g.lineTo(4, 0); g.lineTo(-14, 14); g.stroke(); g.restore();
      }
    } else if (c.surf === 'feutre') {
      centerStroke(g, c, 2 * W, 'rgba(255,255,255,0.06)');
      g.strokeStyle = 'rgba(255,255,255,0.42)'; g.lineWidth = 3; g.setLineDash([10, 14]);
      for (const side of [-1, 1]) { trackPath(g, c, W * side); g.stroke(); }
      g.setLineDash([]);
    } else {                                              // circuit-jouet : plastique orange, jointures, ligne centrale
      centerStroke(g, c, 2 * W + 26, 'rgba(0,0,0,0.35)');
      centerStroke(g, c, 2 * W + 18, '#c85a0c');
      centerStroke(g, c, 2 * W, '#ff8a1e');
      g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 3; g.setLineDash([24, 24]); trackPath(g, c, 0); g.stroke(); g.setLineDash([]);
      g.strokeStyle = 'rgba(120,50,0,0.45)'; g.lineWidth = 2;
      for (let i = 0; i < c.n; i += 7) { const x = c.sx[i], y = c.sy[i]; g.beginPath(); g.moveTo(x - c.nx[i] * W, y - c.ny[i] * W); g.lineTo(x + c.nx[i] * W, y + c.ny[i] * W); g.stroke(); }
      for (const z of c.zones) if (z[4] === 'boost') {    // flèches turbo jaunes (dessinées ici, sous les rails)
        g.save(); g.translate(z[0], z[1]); g.rotate(z[5]);
        for (let k = -1; k <= 1; k++) { g.fillStyle = k ? '#ffd23a' : '#fff07a'; g.beginPath(); g.moveTo(k * 22 - 10, -24); g.lineTo(k * 22 + 10, 0); g.lineTo(k * 22 - 10, 24); g.lineTo(k * 22 - 2, 24); g.lineTo(k * 22 + 18, 0); g.lineTo(k * 22 - 2, -24); g.closePath(); g.fill(); }
        g.restore();
      }
    }
  }
  function blob(g, x, y, rx, ry, a, R, col) {            // flaque irrégulière (lobes)
    g.save(); g.translate(x, y); g.rotate(a); g.fillStyle = col; g.beginPath(); oval(g, 0, 0, rx, ry);
    for (let k = 0; k < 7; k++) { const u = k / 7 * Math.PI * 2 + R() * 0.6, d = 0.75 + R() * 0.25, q = 0.22 + R() * 0.2; g.moveTo(Math.cos(u) * rx * d + rx * q, Math.sin(u) * ry * d); oval(g, Math.cos(u) * rx * d, Math.sin(u) * ry * d, rx * q, ry * q * 1.2); }
    g.fill(); g.restore();
  }
  function zone(g, z, R) {
    const k = z[4];
    if (k === 'boost') return;
    if (k === 'lait') { blob(g, z[0], z[1], z[2], z[3], z[5], R, 'rgba(250,252,255,0.95)'); g.fillStyle = 'rgba(255,255,255,0.8)'; g.beginPath(); oval(g, z[0] - z[2] * 0.3, z[1] - z[3] * 0.3, z[2] * 0.22, z[3] * 0.14); g.fill(); g.strokeStyle = 'rgba(160,190,220,0.5)'; g.lineWidth = 2; g.beginPath(); oval(g, z[0], z[1], z[2] * 0.95, z[3] * 0.95); g.stroke(); }
    else if (k === 'encre') { blob(g, z[0], z[1], z[2], z[3], z[5], R, 'rgba(24,34,110,0.88)'); for (let i = 0; i < 9; i++) { const u = R() * Math.PI * 2, d = 1.1 + R() * 0.5; g.fillStyle = 'rgba(24,34,110,0.85)'; g.beginPath(); g.arc(z[0] + Math.cos(u) * z[2] * d, z[1] + Math.sin(u) * z[3] * d, 3 + R() * 6, 0, Math.PI * 2); g.fill(); } g.fillStyle = 'rgba(140,160,255,0.35)'; g.beginPath(); oval(g, z[0] - z[2] * 0.25, z[1] - z[3] * 0.3, z[2] * 0.25, z[3] * 0.15); g.fill(); }
    else {                                                // sucre, gomme, craie : poudre / miettes
      const col = k === 'sucre' ? '255,255,255' : k === 'gomme' ? '238,150,170' : '90,150,230';
      g.save(); g.translate(z[0], z[1]); g.rotate(z[5]);
      g.fillStyle = 'rgba(' + col + ',0.25)'; g.beginPath(); oval(g, 0, 0, z[2], z[3]); g.fill();
      for (let i = 0; i < 260; i++) { const u = R() * Math.PI * 2, d = Math.sqrt(R()); g.fillStyle = 'rgba(' + col + ',' + (0.5 + R() * 0.5).toFixed(2) + ')'; const s = k === 'gomme' ? 3 + R() * 4 : 1.5 + R() * 2.5; g.fillRect(Math.cos(u) * z[2] * d, Math.sin(u) * z[3] * d, s, s * 0.8); }
      g.restore();
    }
  }
  function depart(g, c) {
    const i = 0, x = c.sx[i], y = c.sy[i], a = Math.atan2(c.ty[i], c.tx[i]), W = c.W, s = 12;
    g.save(); g.translate(x, y); g.rotate(a);
    for (let r = 0; r < 2; r++) for (let k = 0; k < Math.ceil(2 * W / s); k++) { g.fillStyle = (r + k) % 2 ? '#111' : '#f5f5f5'; g.fillRect(-s + r * s, -W + k * s, s, Math.min(s, W - (-W + k * s))); }
    g.restore();
    // cases de départ : petits traits blancs
    g.strokeStyle = c.surf === 'cahier' ? 'rgba(60,62,74,0.6)' : 'rgba(255,255,255,0.55)'; g.lineWidth = 2.5;
    for (let k = 0; k < 10; k++) {
      const row = Math.floor(k / 2), side = k % 2 ? -1 : 1, back = 46 + row * 52 + (k % 2) * 22, j = ((c.n - Math.round(back / c.step)) % c.n + c.n) % c.n, o = side * W * 0.42;
      const px = c.sx[j] + c.nx[j] * o, py = c.sy[j] + c.ny[j] * o, aa = Math.atan2(c.ty[j], c.tx[j]);
      g.save(); g.translate(px, py); g.rotate(aa); g.beginPath(); g.moveTo(18, -12); g.lineTo(22, -12); g.lineTo(22, 12); g.lineTo(18, 12); g.stroke(); g.restore();
    }
  }
  function poche(g, h) {
    g.fillStyle = '#3a1a0c'; g.beginPath(); g.arc(h[0], h[1], h[2] + 10, 0, Math.PI * 2); g.fill();
    const gr = g.createRadialGradient(h[0], h[1], h[2] * 0.2, h[0], h[1], h[2]); gr.addColorStop(0, '#000'); gr.addColorStop(1, '#1a1a1a');
    g.fillStyle = gr; g.beginPath(); g.arc(h[0], h[1], h[2], 0, Math.PI * 2); g.fill();
    if (A.contrast) { g.strokeStyle = '#fff'; g.lineWidth = 3; g.beginPath(); g.arc(h[0], h[1], h[2] + 2, 0, Math.PI * 2); g.stroke(); }
  }
  function shadow(g, x, y, r) { g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.arc(x + r * 0.15 + 4, y + r * 0.2 + 6, r, 0, Math.PI * 2); g.fill(); }
  const BALL = { 1: '#f5c400', 2: '#1f4fcf', 3: '#d8261d', 4: '#5b2b9c', 5: '#ef7a10', 6: '#16884a', 7: '#7a1f1f', 8: '#111111' };
  function bille(g, x, y, r, n) {
    shadow(g, x, y, r);
    const col = n === 0 ? '#f4f2e8' : BALL[n] || '#888', gr = g.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
    gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.25, col); gr.addColorStop(1, rgbStr(mix(hexRgb(col), [0, 0, 0], 0.45)));
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    if (n) { g.fillStyle = '#fff'; g.beginPath(); g.arc(x, y, r * 0.45, 0, Math.PI * 2); g.fill(); g.fillStyle = '#111'; g.font = 'bold ' + Math.round(r * 0.6) + 'px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(n), x, y + 1); }
  }
  function objet(g, r, R) {
    const x = r[0], y = r[1], s = r[2], t = r[3];
    if (/^bille(\d)$/.test(t)) { bille(g, x, y, s, +t.slice(5)); return; }
    if (t === 'blanche') { bille(g, x, y, s, 0); return; }
    if (/^rack/.test(t)) { bille(g, x, y, s, (+t.slice(4)) % 7 + 1); return; }
    if (t === 'bol') {                                    // bol de céréales vu de dessus
      shadow(g, x, y, s);
      const gr = g.createRadialGradient(x - s * 0.3, y - s * 0.35, s * 0.2, x, y, s); gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, '#c7ccd6');
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, s, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#2f7ff0'; g.lineWidth = 6; g.beginPath(); g.arc(x, y, s - 10, 0, Math.PI * 2); g.stroke();
      g.fillStyle = '#f4f6fb'; g.beginPath(); g.arc(x, y, s * 0.82, 0, Math.PI * 2); g.fill();
      for (let k = 0; k < 26; k++) { const u = R() * Math.PI * 2, d = Math.sqrt(R()) * s * 0.7, cx = x + Math.cos(u) * d, cy = y + Math.sin(u) * d; g.fillStyle = R() < 0.5 ? '#e7a93a' : '#cf7d22'; g.beginPath(); g.arc(cx, cy, 9, 0, Math.PI * 2); g.arc(cx, cy, 3.5, 0, Math.PI * 2, true); g.fill(); }
      g.fillStyle = '#b9bec7'; g.save(); g.translate(x + s * 0.2, y - s * 0.25); g.rotate(-0.6); g.beginPath(); rr(g, -8, -s * 0.9, 16, s * 0.9, 8); g.fill(); g.restore();   // manche de cuillère
      return;
    }
    if (t === 'tasse') {
      shadow(g, x, y, s * 1.25);
      g.fillStyle = '#e9e6df'; g.beginPath(); g.arc(x, y, s * 1.25, 0, Math.PI * 2); g.fill(); g.strokeStyle = 'rgba(0,0,0,0.12)'; g.lineWidth = 3; g.stroke();
      g.fillStyle = '#ffffff'; g.beginPath(); g.arc(x, y, s, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#ffffff'; g.beginPath(); rr(g, x + s * 0.85, y - 9, 30, 18, 9); g.fill(); g.strokeStyle = '#ddd'; g.stroke();
      const cg = g.createRadialGradient(x - 8, y - 8, 4, x, y, s * 0.8); cg.addColorStop(0, '#9b5a2c'); cg.addColorStop(1, '#4a2410');
      g.fillStyle = cg; g.beginPath(); g.arc(x, y, s * 0.8, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(255,230,190,0.45)'; g.beginPath(); oval(g, x - s * 0.25, y - s * 0.3, s * 0.25, s * 0.12); g.fill();
      return;
    }
    if (t === 'confiture') {
      shadow(g, x, y, s);
      g.fillStyle = '#c9a43a'; g.beginPath(); g.arc(x, y, s, 0, Math.PI * 2); g.fill();
      g.save(); g.beginPath(); g.arc(x, y, s * 0.88, 0, Math.PI * 2); g.clip(); g.fillStyle = '#fff'; g.fillRect(x - s, y - s, s * 2, s * 2);
      g.fillStyle = 'rgba(214,38,40,0.75)'; for (let k = -s; k < s; k += 14) { g.fillRect(x + k, y - s, 7, s * 2); g.fillRect(x - s, y + k, s * 2, 7); } g.restore();
      return;
    }
    if (t === 'sucre') { g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(x - s * 0.7 + 5, y - s * 0.7 + 6, s * 1.4, s * 1.4); g.fillStyle = '#fbfbf6'; g.fillRect(x - s * 0.7, y - s * 0.7, s * 1.4, s * 1.4); g.fillStyle = 'rgba(0,0,0,0.06)'; for (let k = 0; k < 30; k++) g.fillRect(x - s * 0.7 + R() * s * 1.4, y - s * 0.7 + R() * s * 1.4, 2, 2); return; }
    if (t === 'jus') { shadow(g, x, y, s); g.fillStyle = 'rgba(230,240,245,0.9)'; g.beginPath(); g.arc(x, y, s, 0, Math.PI * 2); g.fill(); g.fillStyle = '#f7a21a'; g.beginPath(); g.arc(x, y, s * 0.82, 0, Math.PI * 2); g.fill(); g.fillStyle = 'rgba(255,255,255,0.5)'; g.beginPath(); oval(g, x - s * 0.3, y - s * 0.35, s * 0.3, s * 0.15); g.fill(); g.strokeStyle = '#e8322a'; g.lineWidth = 6; g.beginPath(); g.moveTo(x + 6, y - 4); g.lineTo(x + s * 1.3, y - s * 1.1); g.stroke(); return; }
    if (t === 'gomme') { g.save(); g.translate(x, y); g.rotate(0.4); g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); rr(g, -s + 5, -s * 0.55 + 6, s * 2, s * 1.1, 8); g.fill(); g.fillStyle = '#f39ab0'; g.beginPath(); rr(g, -s, -s * 0.55, s * 2, s * 1.1, 8); g.fill(); g.fillStyle = '#3f6fd6'; g.beginPath(); rr(g, s * 0.15, -s * 0.55, s * 0.85, s * 1.1, 8); g.fill(); g.restore(); return; }
    if (t === 'taille') { shadow(g, x, y, s); g.fillStyle = '#9fb0c6'; g.beginPath(); rr(g, x - s, y - s * 0.7, s * 2, s * 1.4, 6); g.fill(); g.fillStyle = '#6c7a8e'; g.beginPath(); g.arc(x - s * 0.3, y, s * 0.35, 0, Math.PI * 2); g.fill(); g.fillStyle = '#d9dee6'; g.fillRect(x + s * 0.1, y - s * 0.5, s * 0.6, s * 0.12); return; }
    if (t === 'trombones') { for (let k = 0; k < 9; k++) { const u = R() * Math.PI * 2, d = R() * s * 0.7; g.save(); g.translate(x + Math.cos(u) * d, y + Math.sin(u) * d); g.rotate(R() * Math.PI); g.strokeStyle = k % 3 ? '#b9c0c8' : '#e8322a'; g.lineWidth = 3; g.beginPath(); rr(g, -18, -6, 36, 12, 6); g.stroke(); g.beginPath(); rr(g, -12, -3, 24, 6, 3); g.stroke(); g.restore(); } return; }
    shadow(g, x, y, s); g.fillStyle = '#888'; g.beginPath(); g.arc(x, y, s, 0, Math.PI * 2); g.fill();
  }
  function mur(g, w) {
    const x1 = w[0], y1 = w[1], x2 = w[2], y2 = w[3], r = w[4], t = w[5], L = Math.hypot(x2 - x1, y2 - y1), a = Math.atan2(y2 - y1, x2 - x1);
    if (t === 'rail' || t === 'plinthe' || t === 'bande') { if (t === 'bande') { g.save(); g.lineCap = 'butt'; g.strokeStyle = '#155c2c'; g.lineWidth = r * 2; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); g.strokeStyle = 'rgba(255,255,255,0.12)'; g.lineWidth = 3; g.stroke(); g.restore(); } return; }
    g.save(); g.translate(x1, y1); g.rotate(a);
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); rr(g, 4, -r + 6, L, r * 2, r); g.fill();
    if (t === 'crayon') {                                 // crayon à papier : corps jaune à pans, bois taillé, mine, gomme rose
      g.fillStyle = '#f2c230'; g.fillRect(14, -r, L - 40, r * 2); g.fillStyle = '#d9a514'; g.fillRect(14, -r * 0.3, L - 40, r * 0.6);
      g.fillStyle = '#c3c7cc'; g.fillRect(L - 26, -r, 10, r * 2); g.fillStyle = '#f08aa0'; g.beginPath(); rr(g, L - 18, -r, 18, r * 2, 5); g.fill();
      g.fillStyle = '#e8c79a'; g.beginPath(); g.moveTo(14, -r); g.lineTo(0, 0); g.lineTo(14, r); g.closePath(); g.fill(); g.fillStyle = '#333'; g.beginPath(); g.moveTo(5, -r * 0.35); g.lineTo(0, 0); g.lineTo(5, r * 0.35); g.closePath(); g.fill();
    } else if (t === 'regle') {                           // règle transparente graduée
      g.fillStyle = 'rgba(170,215,240,0.55)'; g.beginPath(); rr(g, 0, -r, L, r * 2, 3); g.fill(); g.strokeStyle = 'rgba(60,110,150,0.7)'; g.lineWidth = 1.5; g.stroke();
      g.strokeStyle = 'rgba(20,40,70,0.8)'; g.lineWidth = 1.2; g.beginPath(); for (let k = 8; k < L - 4; k += 8) { const h = (k / 8) % 5 === 0 ? r * 0.9 : r * 0.45; g.moveTo(k, -r); g.lineTo(k, -r + h); } g.stroke();
    } else if (t === 'stylo') {
      g.fillStyle = '#2547a8'; g.beginPath(); rr(g, 10, -r, L - 10, r * 2, r); g.fill(); g.fillStyle = '#e9e9ee'; g.fillRect(L * 0.55, -r, 8, r * 2); g.fillStyle = '#1a1a1a'; g.beginPath(); g.moveTo(10, -r * 0.6); g.lineTo(0, 0); g.lineTo(10, r * 0.6); g.fill();
    } else if (t === 'cuillere') {
      g.fillStyle = '#c8ccd4'; g.beginPath(); rr(g, 40, -r * 0.45, L - 40, r * 0.9, r * 0.45); g.fill(); g.beginPath(); oval(g, 22, 0, 26, r * 1.25); g.fill(); g.fillStyle = 'rgba(255,255,255,0.6)'; g.beginPath(); oval(g, 18, -4, 12, 5); g.fill();
    } else if (t === 'queue') {
      const gr = g.createLinearGradient(0, 0, L, 0); gr.addColorStop(0, '#2f6fd6'); gr.addColorStop(0.02, '#f1e6cc'); gr.addColorStop(0.6, '#c99a5b'); gr.addColorStop(1, '#3a1d0c');
      g.fillStyle = gr; g.beginPath(); rr(g, 0, -r * 0.6, L, r * 1.2, r * 0.6); g.fill();
    } else { g.fillStyle = '#777'; g.beginPath(); rr(g, 0, -r, L, r * 2, r); g.fill(); }
    g.restore();
  }
  function rails(g, c) {                                  // rails du circuit-jouet : lèvre de plastique en relief, ombre au sol
    for (const side of [-1, 1]) {
      g.lineJoin = 'round'; g.strokeStyle = 'rgba(0,0,0,0.4)'; g.lineWidth = 12; trackPath(g, c, (c.W + 13) * side); g.stroke();
      g.strokeStyle = '#ffb04a'; g.lineWidth = 9; trackPath(g, c, (c.W + 10) * side); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.45)'; g.lineWidth = 2.5; trackPath(g, c, (c.W + 8) * side); g.stroke();
    }
  }
  function decor(g, d, R) {
    const x = d[0], y = d[1], t = d[2];
    g.save(); g.translate(x, y);
    if (t === 'tartine') { g.rotate(0.3); g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); rr(g, -70, -62, 150, 140, 30); g.fill(); g.fillStyle = '#b87a35'; g.beginPath(); rr(g, -76, -70, 150, 140, 30); g.fill(); g.fillStyle = '#e8c27e'; g.beginPath(); rr(g, -64, -58, 126, 116, 22); g.fill(); blob(g, -6, 0, 46, 38, 0.2, R, 'rgba(190,20,40,0.85)'); }
    else if (t === 'croissant') { g.rotate(-0.5); g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); oval(g, 6, 10, 90, 44); g.fill(); for (let k = -3; k <= 3; k++) { g.fillStyle = k % 2 ? '#d08a2a' : '#e8a23e'; g.beginPath(); oval(g, k * 24, Math.abs(k) * 6, 30 - Math.abs(k) * 4, 34 - Math.abs(k) * 5); g.fill(); } }
    else if (t === 'serviette') { g.rotate(-0.15); g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(-96, -66, 200, 140); g.fillStyle = '#f2f6ff'; g.fillRect(-100, -70, 200, 140); g.fillStyle = 'rgba(47,127,240,0.35)'; for (let k = -100; k < 100; k += 20) { g.fillRect(k, -70, 10, 140); } for (let k = -70; k < 70; k += 20) g.fillRect(-100, k, 200, 10); }
    else if (t === 'beurre') { g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); rr(g, -76, -46, 160, 100, 16); g.fill(); g.fillStyle = '#e6e6ea'; g.beginPath(); rr(g, -80, -50, 160, 100, 16); g.fill(); g.fillStyle = '#f7e07a'; g.beginPath(); rr(g, -50, -28, 100, 56, 6); g.fill(); }
    else if (t === 'compas') { g.rotate(0.7); g.strokeStyle = '#9aa3ad'; g.lineWidth = 9; g.lineCap = 'round'; g.beginPath(); g.moveTo(0, -90); g.lineTo(-40, 70); g.moveTo(0, -90); g.lineTo(40, 70); g.stroke(); g.fillStyle = '#e8322a'; g.beginPath(); g.arc(0, -90, 14, 0, Math.PI * 2); g.fill(); }
    else if (t === 'equerre') { g.rotate(-0.25); g.fillStyle = 'rgba(255,170,60,0.45)'; g.beginPath(); g.moveTo(-110, 60); g.lineTo(110, 60); g.lineTo(-110, -90); g.closePath(); g.fill(); g.strokeStyle = 'rgba(150,80,20,0.7)'; g.lineWidth = 2; g.stroke(); }
    else if (t === 'trousse') { g.rotate(0.1); g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); rr(g, -116, -36, 240, 84, 34); g.fill(); g.fillStyle = '#5c2ea8'; g.beginPath(); rr(g, -120, -42, 240, 84, 34); g.fill(); g.strokeStyle = '#d8c25a'; g.lineWidth = 4; g.setLineDash([8, 6]); g.beginPath(); g.moveTo(-100, 0); g.lineTo(100, 0); g.stroke(); g.setLineDash([]); }
    else if (t === 'craie') { g.rotate(0.3); g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(-18, -14, 40, 36); g.fillStyle = '#3d7ee0'; g.fillRect(-22, -20, 40, 36); g.fillStyle = '#9cc2ff'; g.fillRect(-14, -12, 24, 20); }
    else if (t === 'cubes') { const cols = ['#e8322a', '#2f7ff0', '#ffd23a', '#2bb45a']; for (let k = 0; k < 4; k++) { const bx = (k % 2) * 92 - 46, by = Math.floor(k / 2) * 92 - 46; g.save(); g.translate(bx, by); g.rotate((k - 1.5) * 0.18); g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(-36, -30, 76, 76); g.fillStyle = cols[k]; g.fillRect(-40, -38, 76, 76); g.fillStyle = 'rgba(255,255,255,0.85)'; g.font = 'bold 44px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('MICR'[k], -2, 2); g.restore(); } }
    else if (t === 'livre') { g.rotate(-0.2); g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(-150, -96, 310, 210); g.fillStyle = '#c33a2a'; g.fillRect(-156, -104, 310, 210); g.fillStyle = '#f3ead6'; g.fillRect(-150, -98, 298, 198); g.fillStyle = '#2a2a2a'; g.font = 'bold 34px sans-serif'; g.textAlign = 'center'; g.fillText('CONTES', 0, 10); }
    else if (t === 'peluche') { g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.arc(8, 12, 92, 0, Math.PI * 2); g.fill(); g.fillStyle = '#b07a43'; g.beginPath(); g.arc(0, 0, 90, 0, Math.PI * 2); g.arc(-62, -62, 32, 0, Math.PI * 2); g.arc(62, -62, 32, 0, Math.PI * 2); g.fill(); g.fillStyle = '#e3c39a'; g.beginPath(); oval(g, 0, 22, 40, 30); g.fill(); g.fillStyle = '#2a1a10'; g.beginPath(); g.arc(-28, -16, 9, 0, Math.PI * 2); g.arc(28, -16, 9, 0, Math.PI * 2); g.arc(0, 14, 11, 0, Math.PI * 2); g.fill(); }
    else if (t === 'chaussette') { g.rotate(0.5); g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); rr(g, -76, -30, 160, 64, 30); g.fill(); g.fillStyle = '#2bb45a'; g.beginPath(); rr(g, -80, -36, 160, 64, 30); g.fill(); g.fillStyle = '#ffd23a'; for (let k = -60; k < 70; k += 34) g.fillRect(k, -36, 14, 64); }
    g.restore();
  }
  // mini-carte : la piste en trait épais, pré-rendue
  function ensureMini() {
    const S = 150, key = C.id + '|' + (A.contrast ? 1 : 0);
    if (miniCv && miniKey === key) return;
    miniKey = key; if (!miniCv) miniCv = document.createElement('canvas');
    miniCv.width = S * 2; miniCv.height = S * 2;
    const g = miniCv.getContext('2d'), k = (S * 2 - 16) / Math.max(C.w, C.h);
    g.clearRect(0, 0, S * 2, S * 2);
    g.setTransform(k, 0, 0, k, 8 + (S * 2 - 16 - C.w * k) / 2, 8 + (S * 2 - 16 - C.h * k) / 2);
    g.fillStyle = 'rgba(10,12,22,0.6)'; g.beginPath(); rr(g, C.table.x0, C.table.y0, C.table.x1 - C.table.x0, C.table.y1 - C.table.y0, C.table.r); g.fill();
    trackPath(g, C, 0); g.lineJoin = 'round'; g.lineWidth = C.W * 2.2; g.strokeStyle = A.contrast ? '#ffffff' : 'rgba(255,255,255,0.75)'; g.stroke();
    g.lineWidth = C.W * 1.4; g.strokeStyle = 'rgba(40,44,60,0.9)'; g.stroke();
    miniCv._k = k; miniCv._ox = 8 + (S * 2 - 16 - C.w * k) / 2; miniCv._oy = 8 + (S * 2 - 16 - C.h * k) / 2;
  }

  // ───────────────────────── voitures-jouets ─────────────────────────
  let carCache = {};
  function carColors(seat) {
    const col = colSeat(seat), key = seat + '|' + col;
    if (carCache[key]) return carCache[key];
    const b = hexRgb(col);
    return (carCache[key] = { base: col, dark: rgbStr(mix(b, [10, 8, 16], 0.5)), light: rgbStr(mix(b, [255, 255, 255], 0.45)), glass: 'rgba(20,30,48,0.92)', trim: rgbStr(mix(b, [20, 20, 24], 0.72)) });
  }
  function roue(g, x, y, ang, w, h) { g.save(); g.translate(x, y); g.rotate(ang); g.fillStyle = '#16161c'; g.fillRect(-w / 2, -h / 2, w, h); g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(-w / 2, -h / 2, w, 1.4); g.restore(); }
  // o : st (braquage -1..1), scale, alpha, ghost, me, brake, lights (0..1), boost, flag (arrivé), noShadow
  function drawCar(g, seat, x, y, a, o, now) {
    const L = CAR_L, W = CAR_W, kind = seat % 5, Cc = carColors(seat), s = o.scale || 1;
    g.save(); g.translate(x, y); g.rotate(a); if (s !== 1) g.scale(s, s);
    if (o.alpha != null) g.globalAlpha = o.alpha;
    if (!o.noShadow) { g.fillStyle = 'rgba(0,0,0,0.32)'; g.beginPath(); rr(g, -L / 2 + 2, -W / 2 + 3, L, W, 6); g.fill(); }
    const st = (o.st || 0) * 0.42, ww = kind === 3 ? 8 : 7, wh = kind === 3 ? 5 : 4.2, wy = W / 2 - (kind === 3 ? 0 : 1);
    roue(g, L * 0.3, -wy, st, ww, wh); roue(g, L * 0.3, wy, st, ww, wh); roue(g, -L * 0.3, -wy, 0, ww, wh); roue(g, -L * 0.3, wy, 0, ww, wh);
    g.lineJoin = 'round';
    if (kind === 0) {                                     // proto : long nez, aileron
      g.fillStyle = Cc.base; g.beginPath(); g.moveTo(L / 2, -W * 0.28); g.quadraticCurveTo(L / 2 + 2, 0, L / 2, W * 0.28); g.lineTo(-L / 2 + 3, W / 2 - 1); g.lineTo(-L / 2 + 3, -W / 2 + 1); g.closePath(); g.fill();
      g.fillStyle = Cc.glass; g.beginPath(); rr(g, -4, -W * 0.3, 12, W * 0.6, 4); g.fill();
      g.fillStyle = Cc.trim; g.fillRect(-L / 2, -W / 2 - 1, 5, W + 2);
    } else if (kind === 1) {                              // mini : courte et ronde, toit clair
      g.fillStyle = Cc.base; g.beginPath(); rr(g, -L / 2 + 3, -W / 2, L - 6, W, 7); g.fill();
      g.fillStyle = Cc.glass; g.beginPath(); rr(g, 4, -W * 0.36, 5, W * 0.72, 2); g.fill(); g.beginPath(); rr(g, -10, -W * 0.34, 4, W * 0.68, 2); g.fill();
      g.fillStyle = Cc.light; g.beginPath(); rr(g, -6, -W * 0.32, 10, W * 0.64, 3); g.fill();
    } else if (kind === 2) {                              // pick-up : cabine + benne
      g.fillStyle = Cc.base; g.beginPath(); rr(g, -L / 2 + 1, -W / 2, L - 2, W, 3); g.fill();
      g.fillStyle = Cc.trim; g.beginPath(); rr(g, -L / 2 + 3, -W / 2 + 2.5, L * 0.48, W - 5, 2); g.fill();
      g.fillStyle = Cc.glass; g.beginPath(); rr(g, 3, -W * 0.36, 9, W * 0.72, 2.5); g.fill();
      g.strokeStyle = Cc.light; g.lineWidth = 1.6; g.beginPath(); g.moveTo(1, -W / 2 + 2); g.lineTo(1, W / 2 - 2); g.stroke();
    } else if (kind === 3) {                              // formule : roues à l'air, ailerons, casque
      g.fillStyle = Cc.trim; g.fillRect(L / 2 - 4, -W / 2 - 1, 4, W + 2); g.fillRect(-L / 2, -W / 2 + 1, 4, W - 2);
      g.fillStyle = Cc.base; g.beginPath(); g.moveTo(L / 2 - 1, -2.5); g.lineTo(L / 2 - 1, 2.5); g.lineTo(-L / 2 + 6, W * 0.3); g.lineTo(-L / 2 + 6, -W * 0.3); g.closePath(); g.fill();
      g.beginPath(); rr(g, -9, -W * 0.38, 14, W * 0.76, 4); g.fill();
      g.fillStyle = Cc.light; g.beginPath(); g.arc(-3, 0, 3.6, 0, Math.PI * 2); g.fill(); g.fillStyle = Cc.glass; g.beginPath(); g.arc(-2, 0, 2, 0, Math.PI * 2); g.fill();
    } else {                                              // fourgon : carré, galerie de toit
      g.fillStyle = Cc.base; g.beginPath(); rr(g, -L / 2, -W / 2, L, W, 3.5); g.fill();
      g.fillStyle = Cc.glass; g.beginPath(); rr(g, L / 2 - 8, -W * 0.38, 5, W * 0.76, 2); g.fill();
      g.strokeStyle = Cc.dark; g.lineWidth = 1.2; g.beginPath(); for (let k = -10; k <= 6; k += 4) { g.moveTo(k, -W * 0.34); g.lineTo(k, W * 0.34); } g.stroke();
    }
    // bande au motif du siège (identification sans les couleurs) + numéro sur le toit
    const pat = seatPattern(g, seat, { size: 6, ink: 'rgba(255,255,255,0.5)', res: Math.max(1, Math.round(cv.width / cam.w * 100) / 100) });
    g.fillStyle = Cc.light; g.globalAlpha = (o.alpha != null ? o.alpha : 1) * 0.55; g.fillRect(-L / 2 + 6, -1.8, L - 12, 3.6); g.globalAlpha = o.alpha != null ? o.alpha : 1;
    if (pat) { g.fillStyle = pat; g.fillRect(-L / 2 + 6, -W / 2 + 1, L - 12, 3.2); g.fillRect(-L / 2 + 6, W / 2 - 4.2, L - 12, 3.2); }
    g.strokeStyle = A.contrast ? '#ffffff' : Cc.dark; g.lineWidth = A.contrast ? 1.8 : 1; g.beginPath(); rr(g, -L / 2, -W / 2, L, W, 5); g.stroke();
    // phares (avant) et feux stop (arrière)
    g.fillStyle = o.lights > 0.2 ? '#fffbe0' : 'rgba(255,250,210,0.85)'; g.fillRect(L / 2 - 2.5, -W / 2 + 2, 2.2, 3); g.fillRect(L / 2 - 2.5, W / 2 - 5, 2.2, 3);
    g.fillStyle = o.brake ? '#ff2a2a' : 'rgba(150,20,20,0.85)'; g.fillRect(-L / 2 + 0.5, -W / 2 + 2, 2, 3); g.fillRect(-L / 2 + 0.5, W / 2 - 5, 2, 3);
    if (o.boost && !A.reduceFx) { const fl = 6 + 4 * Math.sin(now / 30 + seat); g.fillStyle = 'rgba(255,160,40,0.85)'; g.beginPath(); g.moveTo(-L / 2, -3); g.lineTo(-L / 2 - fl, 0); g.lineTo(-L / 2, 3); g.closePath(); g.fill(); }
    g.restore();
    if (o.me && !o.ghost) { g.save(); g.strokeStyle = '#ffffff'; g.lineWidth = 2; g.globalAlpha = A.reduceFx ? 0.8 : 0.45 + 0.4 * Math.sin(now / 200); g.beginPath(); g.arc(x, y, L * 0.75 * s, 0, Math.PI * 2); g.stroke(); g.restore(); }
    if (o.flag) {                                         // arrivé : petit drapeau à damier au-dessus
      g.save(); g.translate(x + 10, y - 26); g.strokeStyle = '#ddd'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, 16); g.stroke();
      for (let r = 0; r < 2; r++) for (let c2 = 0; c2 < 3; c2++) { g.fillStyle = (r + c2) % 2 ? '#111' : '#fff'; g.fillRect(c2 * 4, r * 4, 4, 4); } g.restore();
    }
  }

  // ───────────────────────── caméra ─────────────────────────
  function camCible(now, pv) {
    const ov = Math.max(C.w, C.h) + 80, fullView = { x: C.w / 2, y: C.h / 2, w: ov };
    if (!snap || snap.gs === 'lobby') return fullView;
    const gs = snap.gs;
    if (snap.formule === 'elim' && snap.cam && (gs === 'play' || gs === 'paused' || gs === 'countdown')) return { x: snap.cam[0], y: snap.cam[1], w: snap.cam[2] * 2 + 90 };
    if (gs === 'over') return fullView;
    let fol = -1;
    const me = mySeat >= 0 ? snap.players[mySeat] : null;
    if (me && me.playing && me.alive) fol = mySeat; else if (seatOk(snap.lead)) fol = snap.lead;
    const v = fol >= 0 && pv ? pv[fol] : null, p = fol >= 0 ? snap.players[fol] : null;
    if (!v || !p) return fullView;
    if (gs === 'countdown') { const k = Math.max(0, Math.min(1, 1 - (snap.count - 0.5) / 3)); return { x: fullView.x + (v.x - fullView.x) * k, y: fullView.y + (v.y - fullView.y) * k, w: ov + (VIEW - ov) * k }; }
    const sp = p.sp || 0, la = 10;
    return { x: v.x + Math.cos(v.a) * sp * la, y: v.y + Math.sin(v.a) * sp * la, w: VIEW * (1 + 0.06 * Math.min(1, sp / 11)) };
  }
  function bougerCam(t, dtm) {
    if (!cam.init) { cam.x = t.x; cam.y = t.y; cam.w = t.w; cam.init = true; return; }
    const k = Math.min(1, 0.12 * dtm / 16.7), kz = Math.min(1, 0.06 * dtm / 16.7);
    const far = Math.hypot(t.x - cam.x, t.y - cam.y) > cam.w * 1.5;
    if (far) { cam.x = t.x; cam.y = t.y; } else { cam.x += (t.x - cam.x) * k; cam.y += (t.y - cam.y) * k; }
    cam.w += (t.w - cam.w) * kz;
  }

  // ───────────────────────── ralenti, podium ─────────────────────────
  function finReplay(now) {
    const m = pendingEnd; pendingEnd = null;
    if (!m || !snap || snap.gs !== 'over') return;
    showEndscreen(snap); endShown = true; overT0 = now; sound('win'); music.sting('win');
  }
  function drawPodiumScene(now) {
    const list = podEntries(snap);
    if (!list.length || !snap.stats || snap.stats.nParts < 2) return;
    const k = A.reduceFx ? 1 : Math.max(0, Math.min(1, (now - overT0) / 350));
    ctx.save(); ctx.fillStyle = 'rgba(8,10,20,' + ((A.contrast ? 0.9 : 0.7) * k).toFixed(2) + ')'; ctx.fillRect(0, 0, HUDW, HUDW); ctx.restore();
    const ph = HUDW * podFrac();
    drawPodium(ctx, { x: HUDW * 0.03, y: HUDW * 0.015, w: HUDW * 0.94, h: ph - HUDW * 0.03 }, now, {
      entries: list, A, W: HUDW, t0: overT0, nul: winTeam(snap) < 0,
      title: snap.match && snap.match.f ? 'VICTOIRE DU MATCH' : '',
      theme: { step: '#2a2f52', edge: K.yel, text: K.cream, glow: K.yel },
      drawPiece(c, e, x, y, size, rank) { const sc = size / (CAR_L * 1.15); drawCar(c, e.seat, x, y, -Math.PI / 2 + (rank === 1 && !A.reduceFx ? 0.12 * Math.sin(now / 420) : 0), { scale: sc, noShadow: true }, now); },
    });
  }

  // ───────────────────────── rendu d'une image ─────────────────────────
  let lobbyT0 = 0;
  function draw() {
    if (destroyed) return;
    const now = performance.now(), rf = A.reduceFx ? null : RL.frame(now);
    if (!rf) { if (pendingEnd && (A.reduceFx || !RL.active(now))) finReplay(now); scene(now, null); return; }
    const real = snap; snap = rf.u < 0.5 ? rf.a : rf.b;
    try { scene(now, rf); } finally { snap = real; }
  }
  function scene(now, rf) {
    const dtm = Math.min(100, Math.max(1, now - (lastFrame || now - 16.7))); lastFrame = now;
    const kdt = dtm / 16.7;
    if (!A.reduceFx && !rf && HS.frozen(now)) return;
    if (C.id !== cid) setCircuit(cid);
    ensureDecor(); ensureSkids();
    const pv = rf ? lerpCars(rf.a, rf.b, rf.u) : (snap && snap.gs !== 'lobby' ? viewCars(now) : null);
    bougerCam(camCible(now, pv), dtm);
    let ox = 0, oy = 0;
    if (shakeMag > 0.3 && !A.reduceFx && !rf) { ox = (Math.random() * 2 - 1) * shakeMag; oy = (Math.random() * 2 - 1) * shakeMag; shakeMag *= Math.pow(0.86, kdt); } else shakeMag = 0;
    const ws = cv.width / cam.w, hs = cv.width / HUDW;
    // fond (hors du monde) puis monde
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = HORS[C.surf] || '#0c0d16'; ctx.fillRect(0, 0, cv.width, cv.height);   // au-delà du monde : le sol de la pièce, assombri
    ctx.setTransform(ws, 0, 0, ws, cv.width / 2 - (cam.x + ox) * ws, cv.height / 2 - (cam.y + oy) * ws);
    const vx0 = cam.x - cam.w / 2, vy0 = cam.y - cam.w / 2;
    blit(decorCv, decorQ, vx0, vy0, cam.w);
    blit(skidCv, skidQ, vx0, vy0, cam.w);
    // lueurs au sol : phares au crépuscule, turbo, flashs
    if (!A.reduceFx) { if (!rf) LUM.dessiner(ctx, now); }
    const lobby = !snap || snap.gs === 'lobby';
    if (lobby) demoCars(now);
    else if (snap && pv) {
      const ps = snap.players, over = snap.gs === 'over', wt = winTeam(snap), lights = duskV;
      // traces de pneus (en direct seulement)
      if (!rf && snap.gs === 'play') traces(ps, pv);
      // voitures qui tombent d'abord (sous le niveau de la table), puis les autres, la mienne en dernier
      const order = [];
      for (let i = 0; i < ps.length; i++) { const p = ps[i]; if (p.playing && p.alive && pv[i]) order.push(i); }
      order.sort((a, b) => ((pv[b].fa > 0) - (pv[a].fa > 0)) || ((a === mySeat) - (b === mySeat)));
      for (const i of order) {
        const p = ps[i], v = pv[i];
        if (lights > 0.15 && !A.reduceFx && !(v.fa > 0)) { const c = Math.cos(v.a), s = Math.sin(v.a); lumiere(ctx, v.x + c * 60, v.y + s * 60, 62, '#fff4c8', 0.35 * lights); }
        if (!A.reduceFx && !rf && snap.gs === 'play' && !(v.fa > 0)) particulesSol(p, v, kdt, now);
        if (v.fa > 0) { voitureQuiTombe(p, v, now); continue; }
        const ghost = !!p.gh, blink = ghost && !A.reduceFx ? 0.35 + 0.3 * Math.sin(now / 60) : 1;
        drawCar(ctx, i, v.x, v.y, v.a, { st: p.st, alpha: ghost ? blink : (p.fin && !over ? 0.75 : 1), ghost, me: i === mySeat && !over && snap.gs !== 'countdown', brake: p.th < 0 && p.sp > 1, lights, boost: p.sp > 12.5, flag: !!p.fin }, now);
        if (over && wt >= 0 && p.team === wt) { ctx.save(); ctx.strokeStyle = K.yel; ctx.lineWidth = 3; ctx.globalAlpha = A.reduceFx ? 0.9 : 0.5 + 0.4 * Math.sin(now / 180); ctx.beginPath(); ctx.arc(v.x, v.y, CAR_L, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
      }
      // pastilles de siège : au décompte et 2 s après le départ, ou dès 7 voitures
      let nPlay = 0; ps.forEach(p => { if (p.playing) nPlay++; });
      if (snap.gs === 'countdown' || ((snap.gs === 'play' || snap.gs === 'paused') && (nPlay >= 7 || now - goT0 < 2000))) {
        const cs = readable(16, cv, cam.w, 18);
        for (const i of order) { const v = pv[i]; if (v.fa > 0) continue; drawSeatChip(ctx, v.x, v.y - CAR_L * 0.9 - cs * 0.3, i, colSeat(i), cs); }
      }
    }
    // éliminés (Élimination) : la voiture s'envole et s'efface
    for (let i = flyers.length - 1; i >= 0; i--) { const f = flyers[i], t = (now - f.born) / 800; if (t >= 1) { flyers.splice(i, 1); continue; } drawCar(ctx, f.seat, f.x, f.y, f.a + t * 5, { scale: 1 + t, alpha: 1 - t, noShadow: true }, now); }
    particules(now, kdt, rf);
    // fenêtre commune (Élimination) : son bord en pointillés
    if (snap && snap.formule === 'elim' && snap.cam && (snap.gs === 'play' || snap.gs === 'paused')) {
      const c0 = snap.cam; ctx.save(); ctx.strokeStyle = 'rgba(255,210,58,0.75)'; ctx.lineWidth = 4 / ws * 1.2; ctx.setLineDash([16, 12]); ctx.lineDashOffset = A.reduceFx ? 0 : -now / 40;
      ctx.strokeRect(c0[0] - c0[2], c0[1] - c0[2], c0[2] * 2, c0[2] * 2); ctx.setLineDash([]); ctx.restore();
    }
    // HUD (repère écran : HUDW × HUDW)
    ctx.setTransform(hs, 0, 0, hs, 0, 0);
    let duskT = 0;
    if (snap && (snap.gs === 'play' || snap.gs === 'paused' || snap.gs === 'over')) duskT = rf ? duskV : DUEL.t(snap, now, duelAnnonce);
    duskV += (duskT - duskV) * Math.min(1, 0.04 * kdt); if (duskV < 0.002) duskV = 0;
    crepuscule(ctx, -10, -10, HUDW + 20, HUDW + 20, duskV, { soleil: 'haut', force: A.contrast ? 0.45 : A.reduceFx ? 0.55 : 1 });
    const me = snap && mySeat >= 0 ? snap.players[mySeat] : null;
    if (me && me.playing && me.alive && snap.gs === 'play' && !rf && snap.formule === 'elim' && snap.cam && pv && pv[mySeat]) {   // proche du bord de la fenêtre : vignette
      const v = pv[mySeat], c0 = snap.cam, m = Math.max(Math.abs(v.x - c0[0]), Math.abs(v.y - c0[1])) / c0[2];
      if (m > 0.72 && snap.lead !== mySeat) { drawDanger(ctx, HUDW, HUDW, Math.min(1, (m - 0.72) / 0.28) * (A.contrast ? 0.9 : 0.65), A.reduceFx ? 0 : now); if (now - lastEdgeWarn > 4000) { lastEdgeWarn = now; msgPerso('📺', 'Tu vas sortir de l\'écran !', { bad: true }); } }
    }
    if (snap && snap.gs !== 'lobby') { hudCourse(now, rf, pv); miniCarte(pv, now); }
    if (snap && snap.gs === 'countdown') feux(now);
    if (snap && snap.gs === 'play' && now - goT0 < 900) feux(now, true);
    if (lobby) ecranTitre(now);
    if (snap && snap.gs === 'paused') { ctx.fillStyle = 'rgba(8,10,20,0.6)'; ctx.fillRect(0, 0, HUDW, HUDW); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = K.cream; ctx.font = '46px ' + DISP; ctx.fillText('PAUSE', HUDW / 2, HUDW / 2 - 8); const fp = readable(14, cv, HUDW, 10); ctx.font = fp.toFixed(1) + 'px system-ui, sans-serif'; ctx.fillStyle = 'rgba(255,246,224,.8)'; ctx.fillText(TOUCH ? 'Arrêt au stand — touche ▶ pour reprendre' : 'Arrêt au stand — P / Échap pour reprendre', HUDW / 2, HUDW / 2 + 30 + fp * 0.4); }
    if (!rf && snap && snap.gs === 'over' && endShown && !homeChoice) drawPodiumScene(now);
    if (rf) RL.drawOverlay(ctx, HUDW, HUDW, now, A);
    if (!rf) CALL.draw(ctx, HUDW, HUDW, now, A);
    // moteur : seulement en course, pour MA voiture
    const actif = !rf && snap && (snap.gs === 'play' || snap.gs === 'countdown') && me && me.playing && me.alive && !(me.fa > 0);
    moteur(me ? me.sp : 0, me ? me.th : 0, me ? me.dr : 0, !!actif);
  }
  function blit(src, q, vx0, vy0, vw) {                  // ne copie que la partie visible (Safari refuse un rectangle source hors image)
    if (!src || !src.width) return;
    const x0 = Math.max(0, vx0), y0 = Math.max(0, vy0), x1 = Math.min(C.w, vx0 + vw), y1 = Math.min(C.h, vy0 + vw);
    if (x1 <= x0 || y1 <= y0) return;
    const sx = x0 * q, sy = y0 * q, sw = Math.min(src.width - sx, (x1 - x0) * q), sh = Math.min(src.height - sy, (y1 - y0) * q);
    if (sw <= 0 || sh <= 0) return;
    ctx.drawImage(src, sx, sy, sw, sh, x0, y0, sw / q, sh / q);
  }
  function traces(ps, pv) {
    if (!skidG) return;
    const col = SKID_COL[C.surf] || 'rgba(0,0,0,0.25)';
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i], v = pv[i];
      if (!p.playing || !p.alive || !v || v.fa > 0) { lastRear[i] = null; continue; }
      const c = Math.cos(v.a), s = Math.sin(v.a), rx = v.x - c * CAR_L * 0.3, ry = v.y - s * CAR_L * 0.3, nx = -s * CAR_W * 0.4, ny = c * CAR_W * 0.4;
      const marque = (p.dr >= 2 && p.sp > 3) || (p.th < 0 && p.sp > 5) || (p.su === 2 && p.sp > 4);
      const prev = lastRear[i];
      if (marque && prev && Math.hypot(rx - prev[0], ry - prev[1]) < 40) {
        skidG.strokeStyle = p.su === 2 ? 'rgba(255,255,255,0.35)' : col; skidG.lineWidth = 3.6;
        skidG.beginPath(); skidG.moveTo(prev[0] + prev[2], prev[1] + prev[3]); skidG.lineTo(rx + nx, ry + ny); skidG.moveTo(prev[0] - prev[2], prev[1] - prev[3]); skidG.lineTo(rx - nx, ry - ny); skidG.stroke();
      }
      lastRear[i] = [rx, ry, nx, ny];
    }
  }
  const DUST_COL = { bois: '214,180,130', cahier: '230,230,236', feutre: '120,190,140', moquette: '200,120,120' };
  function particulesSol(p, v, kdt, now) {
    const c = Math.cos(v.a), s = Math.sin(v.a), bx = v.x - c * CAR_L * 0.45, by = v.y - s * CAR_L * 0.45;
    if (p.su === 1 && p.sp > 2 && Math.random() < 0.45 * kdt) puffs.push({ x: bx, y: by, vx: -c * 0.4 + (Math.random() - 0.5) * 0.5, vy: -s * 0.4 + (Math.random() - 0.5) * 0.5, born: now, life: 500, r0: 3 + Math.random() * 3, col: DUST_COL[C.surf] || '200,200,200' });
    if (p.dr >= 3 && p.sp > 4 && Math.random() < 0.35 * kdt) puffs.push({ x: bx, y: by, vx: (Math.random() - 0.5) * 0.5, vy: (Math.random() - 0.5) * 0.5, born: now, life: 650, r0: 4 + Math.random() * 3, col: '235,235,240' });
    if (p.sp > 12.5 && Math.random() < 0.5 * kdt) sparks.push({ x: bx, y: by, vx: -c * 2 + (Math.random() - 0.5), vy: -s * 2 + (Math.random() - 0.5), born: now, life: 180, c: '#ffb03a' });
    if (p.su === 2 && p.sp > 3 && Math.random() < 0.4 * kdt) drops.push({ x: bx, y: by, vx: (Math.random() - 0.5) * 2, vy: (Math.random() - 0.5) * 2, born: now, life: 300, r: 1.5 + Math.random() * 1.5, col: C.surf === 'cahier' ? '30,40,110' : '255,255,250' });
  }
  function voitureQuiTombe(p, v, now) {                  // chute : la voiture rapetisse en tournoyant (bord de table) ou est avalée (poche)
    const t = Math.min(1, v.fa), e = t * t;
    if (p.fh) { let hx = v.x, hy = v.y, bd = 1e9; for (const h of C.holes) { const d = Math.hypot(h[0] - v.x, h[1] - v.y); if (d < bd) { bd = d; hx = h[0]; hy = h[1]; } } drawCar(ctx, p.seat, v.x + (hx - v.x) * e, v.y + (hy - v.y) * e, v.a + t * 6, { scale: Math.max(0.05, 1 - e * 0.95), alpha: 1 - e * 0.6, noShadow: true }, now); return; }
    drawCar(ctx, p.seat, v.x, v.y + e * 40, v.a + t * 4, { scale: Math.max(0.15, 1 - e * 0.7), alpha: Math.max(0, 1 - e * 1.1), noShadow: true }, now);
  }
  function particules(now, kdt, rf) {
    if (A.reduceFx) { puffs.length = 0; drops.length = 0; sparks.length = 0; rings.length = 0; return; }
    ctx.save();
    for (let i = puffs.length - 1; i >= 0; i--) { const q = puffs[i], tt = (now - q.born) / q.life; if (tt >= 1) { puffs.splice(i, 1); continue; } if (!rf) { q.x += q.vx * kdt; q.y += q.vy * kdt; } ctx.globalAlpha = (1 - tt) * 0.45; ctx.fillStyle = 'rgb(' + q.col + ')'; ctx.beginPath(); ctx.arc(q.x, q.y, q.r0 + tt * 7, 0, Math.PI * 2); ctx.fill(); }
    for (let i = drops.length - 1; i >= 0; i--) { const q = drops[i], tt = (now - q.born) / q.life; if (tt >= 1) { drops.splice(i, 1); continue; } if (!rf) { q.x += q.vx * kdt; q.y += q.vy * kdt; q.vx *= 0.92; q.vy *= 0.92; } ctx.globalAlpha = 1 - tt; ctx.fillStyle = 'rgb(' + q.col + ')'; ctx.beginPath(); ctx.arc(q.x, q.y, q.r, 0, Math.PI * 2); ctx.fill(); }
    for (let i = sparks.length - 1; i >= 0; i--) { const q = sparks[i], tt = (now - q.born) / q.life; if (tt >= 1) { sparks.splice(i, 1); continue; } if (!rf) { q.x += q.vx * kdt; q.y += q.vy * kdt; q.vx *= 0.93; q.vy = q.vy * 0.93 + (q.big ? 0.08 : 0) * kdt; } ctx.globalAlpha = 1 - tt; ctx.fillStyle = q.c; const z = q.big ? 6 : 2.6; ctx.fillRect(q.x - z / 2, q.y - z / 2, z, q.big ? z * 0.6 : z); }
    for (let i = rings.length - 1; i >= 0; i--) { const q = rings[i], tt = (now - q.born) / q.life; if (tt >= 1) { rings.splice(i, 1); continue; } ctx.globalAlpha = 0.7 * (1 - tt); ctx.strokeStyle = q.honk ? K.yel : '#ffffff'; ctx.lineWidth = 3 * (1 - tt * 0.5); ctx.beginPath(); ctx.arc(q.x, q.y, 8 + (q.r1 - 8) * tt, 0, Math.PI * 2); ctx.stroke(); }
    ctx.restore();
  }
  // lobby : trois voitures de démonstration tournent sur le circuit
  function demoCars(now) {
    const t = (now - lobbyT0) / 1000;
    for (let k = 0; k < 3; k++) {
      const sp = 260 - k * 18, s = ((t * sp + k * 220) % C.L + C.L) % C.L, i = Math.floor(s / C.step) % C.n, j = (i + 1) % C.n, u = s / C.step - Math.floor(s / C.step);
      const o = (k - 1) * C.W * 0.45, x = C.sx[i] + (C.sx[j] - C.sx[i]) * u + C.nx[i] * o, y = C.sy[i] + (C.sy[j] - C.sy[i]) * u + C.ny[i] * o;
      drawCar(ctx, k * 3 % MAX_SEATS, x, y, Math.atan2(C.ty[i], C.tx[i]), { st: Math.max(-1, Math.min(1, C.k[i] * 60)), scale: 2.2 }, now);   // vue d'ensemble : voitures grossies pour rester visibles
    }
  }
  function ecranTitre(now) {
    const c = HUDW / 2, cd = circuitParId(snap ? snap.circuit : cid);
    ctx.fillStyle = 'rgba(8,10,20,0.3)'; ctx.fillRect(0, 0, HUDW, HUDW);
    const f = readable(54, cv, HUDW, 22), bob = A.reduceFx ? 0 : Math.sin(now / 500) * 3;
    ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    ctx.translate(c, c - 80 + bob); ctx.rotate(-0.05);
    ctx.font = f.toFixed(1) + 'px ' + DISP; ctx.lineWidth = f * 0.22; ctx.strokeStyle = K.ink; ctx.strokeText('MICRO', 0, -f * 0.5); ctx.strokeText('MACHINES', 0, f * 0.5);
    ctx.fillStyle = K.yel; ctx.fillText('MICRO', 0, -f * 0.5); ctx.fillStyle = K.red; ctx.fillText('MACHINES', 0, f * 0.5);
    ctx.lineWidth = 1.5; ctx.strokeStyle = '#ffffff'; ctx.strokeText('MICRO', 0, -f * 0.5); ctx.strokeText('MACHINES', 0, f * 0.5);
    ctx.restore();
    if (!snap) return;
    const n = snap.connected || 0, nb = snap.botCount || 0, tot = n + nb, y0 = c + 40, f1 = readable(16, cv, HUDW, 11), f2 = readable(14, cv, HUDW, 10);
    ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = 'bold ' + f1.toFixed(1) + 'px system-ui, sans-serif'; ctx.fillStyle = K.cream;
    ctx.fillText(cd.emoji + ' ' + cd.nom + ' · ' + (snap.formule === 'elim' ? '💥 Élimination' : '🏁 Course en ' + snap.laps + ' tour' + (snap.laps > 1 ? 's' : '')), c, y0);
    ctx.font = f2.toFixed(1) + 'px system-ui, sans-serif'; ctx.fillStyle = 'rgba(255,246,224,.78)';
    ctx.fillText(cd.sous, c, y0 + f1 * 1.5);
    ctx.fillText(`${n} pilote${n > 1 ? 's' : ''}${nb ? ' + ' + nb + ' bot' + (nb > 1 ? 's' : '') : ''}${teamMode ? ' · ' + (MODE_NAME[snap.mode] || snap.mode) : ''}`, c, y0 + f1 * 1.5 + f2 * 1.5);
    ctx.font = 'bold ' + f2.toFixed(1) + 'px system-ui, sans-serif'; ctx.fillStyle = K.yel;
    ctx.fillText(tot >= 1 ? (TOUCH ? '▶ Touche l\'écran pour aller sur la grille' : '▶ Espace / clic pour aller sur la grille') : 'En attente de pilotes…', c, y0 + f1 * 1.5 + f2 * 3.2);
    ctx.restore();
  }
  // feux de départ : trois rouges qui s'allument (3·2·1), puis tout vert au départ
  function feux(now, vert) {
    const n = snap.count || 0, lit = vert ? 3 : Math.max(0, Math.min(3, 4 - n)), k = Math.min(hudK(cv, HUDW), 1.6), w = 170, h = 58;
    ctx.save(); ctx.translate(HUDW / 2, 70); ctx.scale(k, k);
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.beginPath(); rr(ctx, -w / 2 + 4, -h / 2 + 5, w, h, 14); ctx.fill();
    ctx.fillStyle = '#1b1d2a'; ctx.beginPath(); rr(ctx, -w / 2, -h / 2, w, h, 14); ctx.fill(); ctx.strokeStyle = '#3c4060'; ctx.lineWidth = 3; ctx.stroke();
    for (let i = 0; i < 3; i++) {
      const x = (i - 1) * 52, on = i < lit, col = vert ? '#3dff7a' : '#ff3326';
      if (on && !A.reduceFx) lumiere(ctx, x, 0, 46, col, 0.6);
      ctx.fillStyle = on ? col : '#3a1414'; ctx.beginPath(); ctx.arc(x, 0, 18, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,' + (on ? 0.6 : 0.12) + ')'; ctx.beginPath(); ctx.arc(x - 6, -6, 5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    if (vert) { const f = readable(48, cv, HUDW, 20); ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = f.toFixed(1) + 'px ' + DISP; ctx.lineWidth = f * 0.18; ctx.strokeStyle = K.ink; ctx.lineJoin = 'round'; ctx.strokeText('GO !', HUDW / 2, 150); ctx.fillStyle = '#3dff7a'; ctx.fillText('GO !', HUDW / 2, 150); ctx.restore(); }
  }
  // HUD de course : position, tour, chrono, meilleur tour, compte à rebours de fin, consignes
  function hudCourse(now, rf, pv) {
    const me = mySeat >= 0 ? snap.players[mySeat] : null, k = Math.min(hudK(cv, HUDW), 1.7);
    const nPlay = snap.players.filter(p => p.playing).length;
    const f1 = readable(13, cv, HUDW / k, 10) * 1;
    if (me && me.playing && (snap.gs === 'play' || snap.gs === 'paused' || snap.gs === 'countdown')) {
      // position (en haut à gauche)
      ctx.save(); ctx.translate(12, 12); ctx.scale(k, k);
      ctx.fillStyle = 'rgba(10,12,22,0.72)'; ctx.beginPath(); rr(ctx, 0, 0, 104, 62, 12); ctx.fill(); ctx.strokeStyle = colSeat(mySeat); ctx.lineWidth = 2; ctx.stroke();
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      const pos = me.fin || me.pos || 1, big = !me.alive ? '✖' : pos === 1 ? '1' : String(pos);
      ctx.font = '40px ' + DISP; ctx.fillStyle = pos === 1 && me.alive ? K.yel : K.cream; ctx.fillText(big, 12, 47);
      const bw = ctx.measureText(big).width;
      ctx.font = '18px ' + DISP; ctx.fillStyle = K.cream; ctx.fillText(me.alive ? (pos === 1 ? 'er' : 'ᵉ') : '', 14 + bw, 30);
      ctx.font = 'bold ' + f1.toFixed(1) + 'px system-ui, sans-serif'; ctx.fillStyle = 'rgba(255,246,224,.7)'; ctx.fillText('/ ' + nPlay, 16 + bw + 18, 47);
      ctx.restore();
      // tour + chrono (en haut à droite)
      if (snap.formule !== 'elim') {
        const lt = me.fin ? me.ft : Math.max(0, (snap.rt || 0) - (me.pg > 0 ? myLapT0 : snap.rt || 0));
        ctx.save(); ctx.translate(HUDW - 12, 12); ctx.scale(k, k);
        ctx.fillStyle = 'rgba(10,12,22,0.72)'; ctx.beginPath(); rr(ctx, -138, 0, 138, 62, 12); ctx.fill();
        ctx.textAlign = 'right'; ctx.font = '22px ' + DISP; ctx.fillStyle = me.lap >= snap.laps && snap.laps > 1 && !me.fin ? K.red : K.cream;
        ctx.fillText(me.fin ? 'ARRIVÉ' : 'TOUR ' + me.lap + '/' + snap.laps, -12, 26);
        ctx.font = 'bold ' + f1.toFixed(1) + 'px system-ui, sans-serif'; ctx.fillStyle = 'rgba(255,246,224,.85)';
        ctx.fillText('⏱ ' + fmtT(lt) + (me.bl ? '  ·  ★ ' + fmtT(me.bl) : ''), -12, 50);
        ctx.restore();
      }
    }
    // compte à rebours après le premier à l'arrivée ; consignes d'Élimination
    const f2 = readable(15, cv, HUDW, 11);
    let line = '', colL = K.cream;
    if (snap.gs === 'play' && snap.finT != null && !(me && me.fin)) { line = '🏁 ' + snap.finT + ' s pour finir la course !'; colL = K.yel; }
    else if (snap.gs === 'play' && snap.formule === 'elim' && now - goT0 < 6000) line = '📺 Reste dans l\'écran du meneur !';
    else if (me && me.playing && me.alive && me.ww && snap.gs === 'play') { line = '↩ MAUVAIS SENS'; colL = K.red; }
    if (line && !rf) {
      ctx.save(); ctx.font = 'bold ' + f2.toFixed(1) + 'px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const tw = ctx.measureText(line).width + 26, y = HUDW - 30 - f2;
      ctx.fillStyle = 'rgba(10,12,22,0.78)'; ctx.beginPath(); rr(ctx, HUDW / 2 - tw / 2, y - f2, tw, f2 * 2, f2); ctx.fill();
      ctx.fillStyle = colL; ctx.fillText(line, HUDW / 2, y + 1); ctx.restore();
    }
  }
  function miniCarte(pv, now) {
    if (!pv || snap.gs === 'over') return;
    ensureMini();
    const k = Math.min(hudK(cv, HUDW), 1.5), S = 118 * k, x0 = HUDW - S - 10, y0 = snap.formule === 'elim' ? 12 : 12 + 70 * k;
    ctx.save(); ctx.globalAlpha = 0.92; ctx.drawImage(miniCv, x0, y0, S, S); ctx.globalAlpha = 1;
    const sc = S / miniCv.width, mk = miniCv._k * sc, ox = x0 + miniCv._ox * sc, oy = y0 + miniCv._oy * sc;
    if (snap.formule === 'elim' && snap.cam) { const c0 = snap.cam; ctx.strokeStyle = 'rgba(255,210,58,0.9)'; ctx.lineWidth = 1.5; ctx.strokeRect(ox + (c0[0] - c0[2]) * mk, oy + (c0[1] - c0[2]) * mk, c0[2] * 2 * mk, c0[2] * 2 * mk); }
    const ps = snap.players;
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i], v = pv[i]; if (!p.playing || !p.alive || !v) continue;
      const r = i === mySeat ? 4.2 : 3; ctx.fillStyle = colSeat(i); ctx.beginPath(); ctx.arc(ox + v.x * mk, oy + v.y * mk, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = i === mySeat ? '#ffffff' : 'rgba(0,0,0,0.6)'; ctx.lineWidth = i === mySeat ? 1.6 : 1; ctx.stroke();
    }
    ctx.restore();
  }

  function drawLoop() { if (destroyed) return; try { draw(); } catch (e) { console.error('[render]', e); } rafId = requestAnimationFrame(drawLoop); }

  // ───────────────────────── entrées ─────────────────────────
  function pushInput() { send({ t: 'input', up: input.up, down: input.down, left: input.left, right: input.right }); }
  function setIn(k, v) { if (input[k] === v) return; input[k] = v; anaSent = ''; pushInput(); }
  const isPlay = () => snap && (snap.gs === 'play' || snap.gs === 'paused');
  function klaxon() { if (snap && (snap.gs === 'play' || snap.gs === 'countdown')) send({ t: 'klaxon' }); }
  // joystick analogique (app.js → joystick.js) : CAP ABSOLU ; envoi quantifié (64 caps × 3 forces), au plus toutes les 60 ms
  function joyAna(dx, dy, finJ) {
    unlockAudio();
    const m = Math.hypot(dx, dy);
    if (finJ || m < 0.05) { anaPend = null; if (anaSent !== '0') { anaSent = '0'; send({ t: 'input', mx: 0, my: 0 }); } return; }
    const a = Math.round(Math.atan2(dy, dx) / (Math.PI * 2) * 64), p = m > 0.8 ? 3 : m > 0.5 ? 2 : 1, key = a + ':' + p;
    if (key === anaSent) return;
    const v = { mx: Math.cos(a / 64 * Math.PI * 2) * p / 3, my: Math.sin(a / 64 * Math.PI * 2) * p / 3, key };
    const now = performance.now();
    if (now - anaT >= 60) { anaT = now; anaSent = key; send({ t: 'input', mx: Math.round(v.mx * 1000) / 1000, my: Math.round(v.my * 1000) / 1000 }); }
    else { anaPend = v; if (!anaTimer) anaTimer = setTimeout(() => { anaTimer = 0; const q = anaPend; anaPend = null; if (q && q.key !== anaSent) { anaT = performance.now(); anaSent = q.key; send({ t: 'input', mx: Math.round(q.mx * 1000) / 1000, my: Math.round(q.my * 1000) / 1000 }); } }, 60 - (now - anaT)); }
  }
  const onKeyDown = e => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
    unlockAudio();
    if (e.repeat) return;
    if (e.key === ' ' && (pendingEnd || RL.active(performance.now()))) { RL.skip(); return; }
    if (e.key === ' ') { if (snap && (snap.gs === 'lobby' || snap.gs === 'over')) send({ t: 'start' }); else klaxon(); return; }
    if (e.code === 'KeyH' || e.code === 'KeyK') { klaxon(); return; }
    if ((e.key === 'p' || e.key === 'P' || e.key === 'Escape') && isPlay()) { send({ t: 'pause' }); return; }
    const d = Object.prototype.hasOwnProperty.call(DIR_KEYS, e.code) ? DIR_KEYS[e.code] : null; if (d) setIn(d, true);
  };
  const onKeyUp = e => { const d = Object.prototype.hasOwnProperty.call(DIR_KEYS, e.code) ? DIR_KEYS[e.code] : null; if (d) setIn(d, false); };
  const onBlur = () => { let ch = false; for (const k in input) if (input[k]) { input[k] = false; ch = true; } if (ch) pushInput(); };
  function hold(id, k) { const el = $(id); if (!el) return; const on = e => { e.preventDefault(); unlockAudio(); setIn(k, true); }; const off = e => { e.preventDefault(); setIn(k, false); }; el.addEventListener('pointerdown', on); el.addEventListener('pointerup', off); el.addEventListener('pointerleave', off); el.addEventListener('pointercancel', off); }

  let cable = false;
  function init(ctx0) {
    const premiere = !cable; cable = true;
    destroyed = false;
    A = ctx0.a11y; send = ctx0.send; root = ctx0.root;
    if (ctx0.togglePanel) togglePanel = ctx0.togglePanel; if (ctx0.closePanels) closePanels = ctx0.closePanels;
    cv = $('mmc'); ctx = cv.getContext('2d'); hud = $('mmHud'); endEl = $('mmEnd');
    carCache = {}; decorKey = ''; miniKey = ''; skidKey = ''; cam.init = false; lobbyT0 = performance.now();
    const wrap = cv.parentElement;
    initGameMsg(wrap && wrap.classList.contains('canvas-wrap') ? wrap : null);
    hud.innerHTML = '';
    cards = Array.from({ length: MAX_SEATS }, (_, i) => i).map(i => { const el = document.createElement('div'); el.className = 'pc hidden'; el.innerHTML = `<div class="dot"></div><div class="inf"><div class="pn">P${i + 1}</div><div class="lv"></div></div>`; hud.appendChild(el); return el; });
    matchChip = document.createElement('div'); matchChip.className = 'mchip'; matchChip.style.cssText = 'grid-column:1/-1;display:none;text-align:center;font-weight:800;font-size:12px;color:#ffd23a;-webkit-user-select:none;user-select:none';
    hud.insertBefore(matchChip, hud.firstChild);
    startBtn = $('mmStart'); pauseBtn = $('mmPause'); modeBtn = $('mmMode'); botsBtn = $('mmBots'); diffBtn = $('mmDiff'); formBtn = $('mmFormule'); circBtn = $('mmCircuit'); lapsBtn = $('mmLaps'); pauseFloat = $('mmPauseFloat');
    lbBtn = $('mmLbBtn'); lbPanel = $('mmLbPanel'); lbBody = $('mmLbBody'); hornBtn = $('mmHorn');
    matchBtn = boutonMatch(root.querySelector('.bar'), send);
    startBtn.onclick = () => { unlockAudio(); send({ t: 'start' }); };
    pauseBtn.onclick = () => send({ t: 'pause' });
    pauseFloat.onclick = () => send({ t: 'pause' });
    modeBtn.onclick = () => send({ t: 'mode' });
    if (botsBtn) botsBtn.onclick = () => send({ t: 'bots' });
    if (diffBtn) diffBtn.onclick = () => send({ t: 'botdiff' });
    if (formBtn) formBtn.onclick = () => send({ t: 'formule' });
    if (circBtn) circBtn.onclick = () => send({ t: 'circuit' });
    if (lapsBtn) lapsBtn.onclick = () => send({ t: 'laps' });
    lbBtn.onclick = () => { togglePanel(lbPanel); renderLB(); };
    const helpBtn = $('mmHelp'), helpPanel = $('mmHelpPanel'); if (helpBtn && helpPanel) helpBtn.onclick = () => togglePanel(helpPanel);
    if (premiere) {
      root.addEventListener('pointerdown', e => { if (pendingEnd || RL.active(performance.now())) { RL.skip(); eatUntil = performance.now() + 700; e.stopPropagation(); } }, true);
      root.addEventListener('click', e => { if (eatUntil && performance.now() < eatUntil) { eatUntil = 0; e.stopPropagation(); e.preventDefault(); } }, true);
      cv.addEventListener('click', () => { unlockAudio(); if (snap && (snap.gs === 'lobby' || snap.gs === 'over')) send({ t: 'start' }); });
      endEl.addEventListener('click', () => { unlockAudio(); send({ t: 'start' }); });
      hold('mmUp', 'up'); hold('mmDown', 'down'); hold('mmLeft', 'left'); hold('mmRight', 'right');
      if (hornBtn) hornBtn.addEventListener('pointerdown', e => { e.preventDefault(); unlockAudio(); klaxon(); });
    }
    applyColors();
    resizeH = resizeCanvas; addEventListener('resize', resizeH); resizeCanvas();
    addEventListener('keydown', onKeyDown); addEventListener('keyup', onKeyUp); addEventListener('blur', onBlur);
    music.dispose(); music = createMusic(() => actx, () => A, MUSIC_THEME);
    music.start();
    if (staleInput) { staleInput = false; pushInput(); }
    STREAK.reset(); goT0 = -1e9; anaSent = ''; RL.clear(); pendingEnd = null; endPod = false; layoutEnd();
    rafId = requestAnimationFrame(drawLoop);
  }
  function onA11y() { applyColors(); if (A.reduceFx) RL.skip(); }
  function teardown() {
    destroyed = true; EF.accueil(); homeChoice = false; music.dispose(); music = NOMUSIC; stopMoteur();
    cancelAnimationFrame(rafId); J.fin(); LUM.vider();
    removeEventListener('resize', resizeH); removeEventListener('keydown', onKeyDown); removeEventListener('keyup', onKeyUp); removeEventListener('blur', onBlur);
    for (const k in input) if (input[k]) { input[k] = false; staleInput = true; }
    if (anaSent && anaSent !== '0') staleInput = true;
    if (anaTimer) { clearTimeout(anaTimer); anaTimer = 0; } anaPend = null;
    if (actx) { const c0 = actx; actx = null; noiseBuf = null; try { const pr = c0.close(); if (pr && pr.catch) pr.catch(() => {}); } catch (e) {} }
    resetRound(); snap = null; decorCv = null; decorKey = ''; skidCv = null; skidG = null; skidKey = ''; miniCv = null; miniKey = '';
  }

  return { init, onState, onMessage, onLb, onA11y, teardown, joyAna };
})();
