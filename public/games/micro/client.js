// Module client MICRO MACHINES : course de voitures-jouets vue de dessus sur des tables (petit-déjeuner, bureau d'écolier,
// billard) et un circuit-jouet à rails sur la moquette. Caméra qui suit SA voiture (nord en haut, même champ de vision
// pour tous : VIEW u), mini-carte, traces de pneus, chutes de table, feux de départ, ralenti, podium de petites voitures.
// Géométrie des circuits : ./shared.js (la même que le serveur — rien ne voyage sur le réseau que l'identifiant).
// Structure calquée sur la Patate chaude (HUD, écran de fin, câblage unique des écouteurs, briques partagées).
// iOS 15 : ni ?. ni ??, ni roundRect / ctx.filter / ctx.ellipse / letterSpacing / OffscreenCanvas.
import { TICK_HZ, CAR_L, CAR_W, VIEW, CIRCUITS, BUMPERS, circuitParId, cleRecord, mobile, ficheDe, circuitCharge, enregistrerCircuit } from './shared.js';
import premierCircuit from './circuits/dejeuner.js';   // le seul chargé d'office (lobby, démo) ; les autres : import() à la demande
enregistrerCircuit(premierCircuit);
// CIRCUITS À LA DEMANDE (10/11) : une course n'utilise qu'un circuit sur 12 (660 Ko en tout). Le serveur annonce le circuit
// joué (`circuit`) et, quand il le connaît, le suivant (`nx`) : on charge ./circuits/<id>.js par import(), une seule fois.
const fiche = id => ficheDe(id) || CIRCUITS[0];
const enRoute = Object.create(null);                   // id → promesse du chargement en cours
function demanderCircuit(id, pret) {
  if (!ficheDe(id)) return;                             // l'id vient du réseau : seulement un circuit connu des fiches
  if (circuitCharge(id)) { if (pret) pret(); return; }
  if (!enRoute[id]) enRoute[id] = import('./circuits/' + id + '.js').then(m => { enregistrerCircuit(m.default); delete enRoute[id]; },
    () => { setTimeout(() => { delete enRoute[id]; }, 2000); });   // échec réseau : nouvel essai au prochain état, 2 s plus tard
  if (pret) enRoute[id].then(() => { if (circuitCharge(id)) pret(); });
}
import { peindreCircuit, mobileDessin, couleurHors, couleurTraces, trackPath, hexRgb, rgbStr, mix, rng, oval, rr } from './rendu.js';   // dessin des circuits
import { createMusic } from '../../music.js';
import { creerSfx } from '../../sfx.js';
import { SONS, SALLE, NIVEAU, MOTEUR } from './sons.js';
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
// Fanfares (stingers) adoucies le 28/10 : triangle / sinus au lieu du carré, gains plus bas (les bruitages de ./sons.js
// jouent par-dessus dans la même tonalité de la).
const MUSIC_THEME = { piste: 'micro', bpm: 152, bpmBoost: 26, vol: 0.5, root: 110, len: 32,
  stingers: { kill: { notes: [7, 3, 0, -5], wave: 'triangle', oct: 1, gain: 0.034, dur: 0.2, rate: 0.06 },
    win: { base: 440, notes: [[0, 4, 7], [5, 9, 12], [7, 11, 14], [12, 16, 19, 24]], wave: 'triangle', gain: 0.026, dur: 0.42, rate: 0.14 },
    count: { notes: [0], oct: 1, wave: 'triangle', dur: 0.16, gain: 0.034, duck: false }, go: { notes: [[0, 7, 12]], oct: 2, wave: 'triangle', dur: 0.55, gain: 0.034, duck: false },
    alert: { notes: [0, 4, 7, 12, 16], oct: 1, wave: 'sine', rate: 0.06, dur: 0.14, gain: 0.03 } },
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
// objets à ramasser (indices = ITEMS du serveur)
const ITEM = [{ e: '⚡', n: 'Turbo', c: '#ffd23a' }, { e: '🚀', n: 'Triple turbo', c: '#ff8a1e' }, { e: '🛢️', n: 'Flaque d\'huile', c: '#7a5a3a' },
  { e: '📄', n: 'Boule de papier', c: '#f2f2ea' }, { e: '🛡️', n: 'Bouclier', c: '#6fc6ff' }, { e: '🐌', n: 'Escargot', c: '#9be060' },
  { e: '🎯', n: 'Toupie chercheuse', c: '#ff5a5a' }, { e: '💧', n: 'Bombe à eau', c: '#5ab4ff' }, { e: '🧨', n: 'Pétard', c: '#ff7a3a' }, { e: '🧊', n: 'Glaçon', c: '#bfe9ff' },
  { e: '🪝', n: 'Grappin', c: '#c8a070' }, { e: '👻', n: 'Fantôme', c: '#e0e6ff' }, { e: '🦑', n: 'Encre de seiche', c: '#8a6cff' }, { e: '🪀', n: 'Ressort', c: '#ffd23a' }];
const itemAt = k => (k | 0) === k && k >= 0 && k < ITEM.length ? ITEM[k] : null;
const SENS_NAME = { normal: '➡️ Sens normal', inverse: '↩️ Sens inverse', hasard: '🎲 Sens au hasard' };
const CAR_NAMES = ['proto', 'mini', 'pickup', 'formule', 'fourgon'];

function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
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
  let shakeMag = 0, rafId = 0, destroyed = false, resizeH = null, actx = null, lastFrame = 0, duskV = 0;
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
  let sensBtn, bonusBtn, pouceBtn, itemBtn, itemInvBtn, gpBtn, ckey = '', VRT = 0, lastItemMsg = -1e9;
  const bumpFlash = {};                                   // bumpers qui viennent de renvoyer quelqu'un : éclat (index d'obstacle → instant)
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
  const relanceLabel = (m, def) => {
    if (m && m.gp) return m.gp.f ? 'Nouveau Grand Prix' : m.gp.k ? 'Course suivante (' + (m.gp.k + 1) + '/' + m.gp.n + ')' : 'Lancer le Grand Prix';
    return m && m.match ? (m.match.f ? 'Nouveau match' : 'Manche suivante') : def;
  };
  // Grand Prix (m.gp = { n, k, seq, f, ws }, null en course simple) : « Grand Prix · course 2/5 »
  function texteGP(m) {
    if (!m || !m.gp) return '';
    const g = m.gp;
    if (g.f) return 'Grand Prix terminé';
    if (m.gs === 'play' || m.gs === 'paused' || m.gs === 'countdown') return 'Grand Prix · course ' + (g.k + 1) + '/' + g.n;
    return g.k ? 'Grand Prix · ' + g.k + '/' + g.n + ' courses' : 'Grand Prix en ' + g.n + ' courses';
  }
  function vainqueurGP(m) {                              // nom du vainqueur du Grand Prix ('' : égalité)
    const ws = (m.gp && m.gp.ws) || [], p = ws.length ? m.players[ws[0]] : null;
    if (!p) return '';
    return teamMode ? 'Équipe ' + (TEAM_LETTER[p.team] || '?') : (p.name || ('P' + (p.seat + 1)));
  }
  function blocGP(m) {                                   // classement du Grand Prix (écran de fin) + prochain circuit
    const g = m.gp, medals = ['🥇', '🥈', '🥉'];
    const ins = m.players.filter(p => p.playing || (p.gpp | 0) > 0).slice().sort((a, b) => (b.gpp | 0) - (a.gpp | 0) || (a.place || 99) - (b.place || 99) || a.seat - b.seat);
    const rows = ins.map((p, i) => {
      const rang = i > 0 && (p.gpp | 0) === (ins[i - 1].gpp | 0) ? 0 : i + 1;
      return `<div class="erow ${g.f && (g.ws || []).indexOf(p.seat) >= 0 ? 'win' : ''}"><span class="eplace">${rang ? (g.f ? medals[rang - 1] || ('#' + rang) : '#' + rang) : ''}</span>
        <span class="ename" style="color:${colSeat(p.seat)}">${esc(p.name || ('P' + (p.seat + 1)))}${teamMode ? ` <small>Éq.${TEAM_LETTER[p.team]}</small>` : ''}</span>
        <span class="estat" title="points de cette course">+${p.gpd | 0}</span><span class="eres"><b>${p.gpp | 0}</b> pts</span></div>`;
    }).join('');
    const suite = !g.f && g.seq && g.seq[g.k] ? ficheDe(g.seq[g.k]) : null;
    return `<div class="emeta">🏎 <b>Grand Prix</b> — ${g.f ? 'classement final' : 'après ' + g.k + ' course' + (g.k > 1 ? 's' : '') + ' sur ' + g.n}</div><div class="elist">${rows}</div>` +
      (suite ? `<div class="emeta">Prochaine course : ${suite.emoji} <b>${esc(suite.nom)}</b></div>` : '');
  }
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
    if (matchChip) { const tg = texteGP(snap), tm = texteMatch(snap.match), tx = tg ? '🏎 ' + tg : tm ? '🏆 ' + tm : ''; if (matchChip._t !== tx) { matchChip._t = tx; matchChip.textContent = tx; } matchChip.style.display = tx ? '' : 'none'; }
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
      const pnH = `${(window.__AV && window.__AV(p.name)) || ''}<span class="sg" style="opacity:.8">${glyph}</span> ${esc(p.name || ('P' + (i + 1)))} <span class="sc" title="voitures envoyées dans le décor">${p.kos | 0} 💥</span> ${snap.match ? `<span class="sc" title="manches gagnées" style="letter-spacing:1px">${pastillesTexte(p.score, snap.match.n)}</span> ` : ''}${snap.gp ? `<span class="sc" title="points du Grand Prix">${p.gpp | 0} pts</span> ` : ''}${tags.join('')}`;
      if (cards[i]._pn !== pnH) { cards[i]._pn = pnH; cards[i].querySelector('.pn').innerHTML = pnH; }
      const lv = cards[i].querySelector('.lv'); lv.style.color = col;
      const t = etatTxt(p, snap); if (cards[i]._lv !== t) { cards[i]._lv = t; lv.textContent = t; }
    });
  }
  function renderLB() {
    if (!lbBody) return;
    if (!board.length) { lbBody.innerHTML = '<div class="lbnote">Aucune course enregistrée.</div>'; return; }
    const cr = cleRecord(cid), cd = fiche(cid), rec = e => (e.bl && Object.prototype.hasOwnProperty.call(e.bl, cr) && e.bl[cr] > 0 ? e.bl[cr] : 0);
    lbBody.innerHTML = `<div class="lbnote">⏱ record du tour sur ${cd.emoji} ${esc(cd.nom)}</div>` + board.slice().sort((a, b) => (b.wins || 0) - (a.wins || 0) || (b.podiums || 0) - (a.podiums || 0) || ((a.bestLap || 1e9) - (b.bestLap || 1e9))).map(e =>
      `<div class="lbrow"><span class="lbn">${esc(e.name)}</span><span title="courses">🎮${e.games || 0}</span><span title="victoires">🏆${e.wins || 0}</span><span title="podiums">🥉${e.podiums || 0}</span>` +
      `<span title="voitures envoyées dans le décor">💥${e.kos || 0}</span>` + (rec(e) ? `<span title="record du tour : ${esc(cd.nom)}">⏱${fmtT(rec(e))}</span>` : '') + '</div>').join('');
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
      if (m && m.gp && m.gp.f && podList.length) {
        podList.sort((a, b) => (b.gpp | 0) - (a.gpp | 0) || a.place - b.place || a.seat - b.seat);
        podList.forEach((e, i) => { e.place = i > 0 && (e.gpp | 0) === (podList[i - 1].gpp | 0) ? podList[i - 1].place : i + 1; });
      } else if (m && m.match && m.match.f && podList.length) {
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
    const solo = m.stats.nParts === 1, gpFin = !!(m.gp && m.gp.f), gpNom = gpFin ? vainqueurGP(m) : '';
    const title = gpFin ? (gpNom ? '🏆 ' + esc(gpNom) + ' remporte le Grand Prix !' : 'Grand Prix : égalité au sommet') : solo ? (parts[0] && parts[0].fin ? '🏁 Course bouclée en ' + fmtT(parts[0].ft) : 'Fin de la balade') :
      T.titre ? esc(T.titre) + (who ? ' — ' + who : '') : (champ ? (elim ? who + ' reste seul à l\'écran !' : '🏁 ' + who + ' remporte la course !') : (elim ? 'Égalité — personne ne décroche' : 'Égalité sur la ligne'));
    const subLine = T.titre ? `<div class="emeta">${esc(T.sous)}</div>` : '';
    const cdef = fiche(m.stats.circuit);
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
        <span class="estat" title="meilleur tour">⏱ ${fmtT(p.bl)}</span><span class="estat" title="voitures envoyées dans le décor">💥 ${p.kos | 0}</span><span class="estat" title="chutes">🕳 ${p.falls | 0}</span>${p.cuts ? `<span class="estat" title="raccourcis et coupes pénalisés">⛔ ${p.cuts | 0}</span>` : ''}<span class="eres">${res}</span></div>`;
    }).join('');
    const bestLine = best ? `<div class="emeta">⏱ Meilleur tour : <b style="color:${colSeat(best.seat)}">${esc(best.name || ('P' + (best.seat + 1)))}</b> — ${fmtT(best.bl)}</div>` : '';
    const koLine = ko ? `<div class="emeta">💥 Chauffard : <b style="color:${colSeat(ko.seat)}">${esc(ko.name || ('P' + (ko.seat + 1)))}</b> — ${ko.kos} voiture${ko.kos > 1 ? 's' : ''} dans le décor</div>` : '';
    const wrapO = endPod ? '<div style="width:100%;flex:1 1 auto;min-height:0;overflow:auto;-webkit-overflow-scrolling:touch;display:flex;flex-direction:column;align-items:center;gap:8px">' : '', wrapC = endPod ? '</div>' : '';
    endEl.innerHTML = wrapO + `<div class="etitle" style="color:${gpFin ? (gpNom ? colSeat(m.gp.ws[0]) : K.cream) : champ ? colSeat(champ.seat) : K.cream}">${title}</div>
      ${subLine}<div class="emeta">${cdef.emoji} ${esc(cdef.nom)} · ${elim ? '💥 Élimination' : '🏁 ' + m.stats.laps + ' tour' + (m.stats.laps > 1 ? 's' : '')} · ⏱ ${m.stats.durationSec} s · ${m.stats.nParts} pilote${m.stats.nParts > 1 ? 's' : ''}</div>${m.gp ? blocGP(m) : ''}${bestLine}${koLine}<div class="elist">${rows}</div>${jRound === m.round ? blocFin(J, { titre: elim ? 'Positions (éliminés à zéro)' : 'Positions au fil de la course', couleur: s => colSeat(s), nom: s => nameOf(s) }) : ''}<div class="ehint">${TOUCH ? 'Touche pour rejouer' : 'Espace / clic pour rejouer'}</div>` + wrapC;
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
  function setCircuit(id, inv) {
    const k = id + (inv ? '|inv' : '');
    if (k === ckey && C) return;
    if (!circuitCharge(id)) { demanderCircuit(id, () => { if (snap && snap.circuit === id) setCircuit(id, snap.inv); }); return; }   // pas encore là : on garde l'ancien décor sous un voile
    ckey = k; C = circuitParId(id, !!inv); cid = C.id; decorKey = ''; miniKey = ''; skidKey = ''; cam.init = false;
  }
  function onState(m) {
    if (m.circuit && m.circuit + (m.inv ? '|inv' : '') !== ckey) setCircuit(m.circuit, m.inv);
    if (m.nx && typeof m.nx === 'string') demanderCircuit(m.nx);   // le prochain circuit, annoncé d'avance : préchargé
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
      music.setIntensity(inten, m.gs); }
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
    if (circBtn) { circBtn.disabled = !idle; const cd = fiche(m.circuit); circBtn.textContent = m.choix === 'hasard' ? '🎲 Circuit au hasard' : cd.emoji + ' ' + cd.nom; }
    if (sensBtn) { sensBtn.disabled = !idle; sensBtn.textContent = Object.prototype.hasOwnProperty.call(SENS_NAME, m.sens) ? SENS_NAME[m.sens] : SENS_NAME.normal; sensBtn.classList.toggle('on', m.sens !== 'normal'); }
    const bon = !!(m.opt && m.opt.bonus), pce = !!(m.opt && m.opt.pouce);
    if (bonusBtn) { bonusBtn.disabled = !idle; bonusBtn.textContent = '🎁 Bonus : ' + (bon ? 'oui' : 'non'); bonusBtn.classList.toggle('on', bon); }
    if (pouceBtn) { pouceBtn.disabled = !idle; pouceBtn.textContent = '🤝 Coup de pouce : ' + (pce ? 'oui' : 'non'); pouceBtn.classList.toggle('on', pce); }
    if (itemBtn) {                                        // bouton tactile de l'objet : l'icône de l'objet tenu (et son nombre)
      const me = mySeat >= 0 ? m.players[mySeat] : null, d = me && me.playing && me.alive ? itemAt(me.it) : null;
      const tx = d ? d.e + (me.iu > 1 ? '×' + me.iu : '') : '🎁';
      if (itemBtn._t !== tx) { itemBtn._t = tx; itemBtn.textContent = tx; }
      itemBtn.style.opacity = d ? '' : '0.45'; itemBtn.style.display = bon ? '' : 'none';
      if (itemInvBtn) { itemInvBtn.style.opacity = d ? '' : '0.45'; itemInvBtn.style.display = bon ? '' : 'none'; }
    }
    if (gpBtn) { gpBtn.disabled = !idle; gpBtn.textContent = '🏎 Grand Prix : ' + (m.gp ? m.gp.n + ' courses' : 'non'); gpBtn.classList.toggle('on', !!m.gp); }
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

  // ───────────────────────── sons (boîte partagée ../../sfx.js, recettes dans ./sons.js) ─────────────────────────
  function unlockAudio() { if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} } if (actx && actx.state === 'suspended') actx.resume(); }
  let sndPan = 0;
  // UNE boîte pour l'instance du jeu : elle suit le contexte courant (actx est recréé à chaque entrée dans le jeu) et
  // le volume des effets (A.sfx) ; bus compressé + réverbération de la pièce (SALLE de ./sons.js).
  const S = creerSfx(() => actx, () => A, { salle: SALLE, niveau: NIVEAU });
  // son positionné : gauche / droite selon la position à l'écran, atténué avec la distance à MA voiture
  function psound(k, x, y, arg) {
    const dx = x - cam.x, dy = y - cam.y, d = Math.hypot(dx, dy), half = cam.w / 2;
    if (d > half * 2.2) return;
    sndPan = Math.max(-1, Math.min(1, dx / half * 0.9)); sound(k, arg, Math.max(0.25, 1 - d / (half * 2.2))); sndPan = 0;
  }
  function sound(k, arg, att) {
    if (!actx || !Object.prototype.hasOwnProperty.call(SONS, k)) return;
    S.avec(sndPan, att == null ? 1 : att, () => SONS[k](S, arg));
  }
  // moteur de MA voiture : S.moteur (petit moteur thermique de voiture-jouet, preset MOTEUR de ./sons.js), créé UNE fois ;
  // la boîte le reconstruit d'elle-même sur le nouveau contexte. regime = vitesse / pointe (VMAX 11,5 u/tick du serveur,
  // + 20 % de marge : le turbo et la flèche turbo le font encore monter) ; sous l'accélérateur, le moteur prend des tours
  // avant que la voiture n'ait de la vitesse (départ arrêté, feux) ; glisse = dérapage latéral (crissement des pneus).
  const VPOINTE = 11.5 * 1.2;
  const moteurSon = S.moteur(MOTEUR);
  function moteur(sp, thr, drift, actif) {
    const v = Math.max(0, Math.min(1, (sp || 0) / VPOINTE)), gaz = thr > 0 ? 1 : 0;
    const gl = sp > 3 ? Math.max(0, Math.min(1, ((drift || 0) - 1) / 5)) : 0;
    moteurSon.regler({ actif: !!actif, regime: Math.max(v, gaz * 0.28), gaz: gaz, glisse: gl, roulement: v });
  }
  function stopMoteur() { moteurSon.arreter(); }

  // ───────────────────────── effets ponctuels ─────────────────────────
  const FX = () => !A.reduceFx;
  function dust(x, y, n, col, sp) { if (!FX()) return; const now = performance.now(); for (let k = 0; k < n; k++) { const a = Math.random() * Math.PI * 2, s = Math.random() * (sp || 0.6); puffs.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, born: now, life: 420 + Math.random() * 380, r0: 3 + Math.random() * 3, col }); } if (puffs.length > 260) puffs.splice(0, puffs.length - 260); }
  function splashAt(x, y, n, col) { if (!FX()) return; const now = performance.now(); for (let k = 0; k < n; k++) { const a = Math.random() * Math.PI * 2, s = 1 + Math.random() * 3; drops.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, born: now, life: 300 + Math.random() * 260, r: 1.6 + Math.random() * 2.2, col }); } if (drops.length > 220) drops.splice(0, drops.length - 220); }
  function sparksAt(x, y, n, spd) { if (!FX()) return; const now = performance.now(); for (let k = 0; k < n; k++) { const a = Math.random() * Math.PI * 2, s = 1.5 + Math.random() * spd; sparks.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, born: now, life: 200 + Math.random() * 220, c: k % 3 ? '#ffd23a' : '#ffffff' }); } if (sparks.length > 240) sparks.splice(0, sparks.length - 240); }
  function confettiAt(x, y, n) { if (!FX()) return; const now = performance.now(), cols = ['#ffd23a', '#e8322a', '#2f7ff0', '#2bb45a', '#ffffff']; for (let k = 0; k < n; k++) { const a = Math.random() * Math.PI * 2, s = 2 + Math.random() * 6; sparks.push({ x: x + (Math.random() - 0.5) * 200, y: y + (Math.random() - 0.5) * 200, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 2, born: now, life: 900 + Math.random() * 700, c: cols[k % cols.length], big: 1 }); } }
  const ZONE_COL = { lait: '255,255,250', encre: '30,40,110', sucre: '255,255,255', gomme: '240,150,170', craie: '90,150,230', huile: '50,38,20', sciure: '214,170,110' };
  function playFx(f, now) {
    if (!f) return;
    const ps = snap ? snap.players : [];
    if (f.type === 'bump') {
      if (!fin(f.x) || !fin(f.y)) return;
      psound(f.b >= 0 ? 'bump' : f.k ? 'bumper' : 'wall', f.x, f.y, f.i);
      if (f.k && f.b < 0) { let bi = -1, bd = 80; for (let i = 0; i < C.rocks.length; i++) { const r = C.rocks[i]; if (!Object.prototype.hasOwnProperty.call(BUMPERS, r[3])) continue; const d = Math.hypot(r[0] - f.x, r[1] - f.y) - r[2]; if (d < bd) { bd = d; bi = i; } } if (bi >= 0) bumpFlash[bi] = now; }
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
    if (f.type === 'aspi') {                              // jauge du sillage pleine : gros coup de boost pour doubler (réglages : ASPI du serveur)
      const p = ps[f.seat]; if (p) { psound('aspi', p.x, p.y); if (FX()) LUM.ajouter(p.x, p.y, 60, '#bfe6ff', 360, 0.45); }
      if (f.seat === mySeat) msgPerso('🌬', 'Aspiration : boost ! Pas de coup de volant brusque', { color: '#bfe6ff' });
      return;
    }
    if (f.type === 'decroche') {                          // braquage trop brusque pendant le boost d'aspiration : la voiture glisse
      if (!fin(f.x)) return;
      psound('glisse', f.x, f.y); dust(f.x, f.y, 8, '255,255,255', 1.2);
      if (f.seat === mySeat) { msgPerso('😵', 'Trop brusque à pleine vitesse : la voiture décroche !', { bad: true }); shakeMag = Math.max(shakeMag, 4); }
      return;
    }
    if (f.type === 'splash') { if (!fin(f.x)) return; psound('splash', f.x, f.y, f.k); splashAt(f.x, f.y, f.k === 'lait' || f.k === 'encre' ? 14 : 8, Object.prototype.hasOwnProperty.call(ZONE_COL, f.k) ? ZONE_COL[f.k] : '255,255,255'); if (f.seat === mySeat && (f.k === 'lait' || f.k === 'encre')) msgPerso(f.k === 'lait' ? '🥛' : '🖋', f.k === 'lait' ? 'Lait renversé : ça glisse !' : 'Tache d\'encre : ça glisse !', { color: '#bfe6ff' }); return; }
    if (f.type === 'honk') { const p = ps[f.seat]; if (p) { psound('honk', p.x, p.y, (f.seat % 5) * 24); if (FX()) rings.push({ x: p.x, y: p.y, born: now, life: 300, r1: 30, honk: 1 }); } return; }
    if (f.type === 'lead') { if (f.seat !== mySeat && snap && snap.formule === 'course' && now - goT0 > 4000) msgGlobal('🥇', nameOf(f.seat) + ' prend la tête', { color: colSeat(f.seat) }); if (J.actif() && now - goT0 > 4000) J.moment(now, f.seat, 'prend la tête', 2); return; }
    if (f.type === 'quit') { if (seatOk(f.seat)) msgGlobal('🚪', nameOf(f.seat) + ' quitte la course'); return; }
    // ── anti-raccourci ──
    if (f.type === 'coupe') {
      if (!seatOk(f.seat)) return;
      psound('coupe', f.x, f.y); if (FX()) rings.push({ x: f.x, y: f.y, born: now, life: 420, r1: 44, cut: 1 });
      if (f.seat === mySeat) { msgPerso('⛔', 'Raccourci ! Retour à la dernière porte', { bad: true }); CALL.push('RACCOURCI !', K.red, now); }
      else msgGlobal('⛔', nameOf(f.seat) + ' a coupé la piste : retour à la porte', { color: colSeat(f.seat) });
      return;
    }
    if (f.type === 'penalite') { const p = ps[f.seat]; if (p) psound('coupe', p.x, p.y); if (f.seat === mySeat) { msgPerso('⚠', 'Virage coupé par la table : pénalité de vitesse', { bad: true }); CALL.push('PÉNALITÉ', '#ff9a3a', now); } return; }
    if (f.type === 'replace') { const p = ps[f.seat]; if (p && FX()) rings.push({ x: p.x, y: p.y, born: now, life: 300, r1: 30 }); return; }
    // ── bonus / malus ──
    if (f.type === 'boite') {
      if (!seatOk(f.seat) || !fin(f.x)) return;
      const d = itemAt(f.it); psound('boite', f.x, f.y); sparksAt(f.x, f.y, 10, 3);
      if (f.seat === mySeat && d) { msgPerso(d.e, d.n + (TOUCH ? ' — touche 🎁 pour l\'utiliser' : ' — Espace pour l\'utiliser'), { color: d.c }); lastItemMsg = now; }
      return;
    }
    if (f.type === 'objet') {
      if (!seatOk(f.seat) || !fin(f.x)) return;
      const it = f.it | 0; psound(`objet${it}`, f.x, f.y);   // clé calculée objet0..objet5 (sound() ignore une clé absente de SONS)
      if (it === 0 || it === 1) { if (FX()) LUM.ajouter(f.x, f.y, 80, '#ffd23a', 420, 0.55); }
      else if (it === 4) { if (FX()) LUM.ajouter(f.x, f.y, 70, '#8fd8ff', 400, 0.5); }
      else if (it === 6) { msgGlobal('🎯', nameOf(f.seat) + (f.inv ? ' lance une toupie sur celui qui le suit !' : ' lance une toupie chercheuse sur le premier !'), { color: '#ff8a8a' }); const me = snap && mySeat >= 0 ? snap.players[mySeat] : null, sh = ps[f.seat] ? snap.players[f.seat] : null; if (me && sh && f.seat !== mySeat && (f.inv ? me.pos === sh.pos + 1 : me.pos === 1)) CALL.push('TOUPIE !', '#ff5a5a', now); }
      else if (it === 11) { if (f.seat === mySeat) msgPerso('👻', 'Fantôme : rien ne te touche pendant 3 s (sauf le vide)', { color: '#e0e6ff' }); }
      else if (it === 12) msgGlobal('🦑', nameOf(f.seat) + ' crache de l\'encre sur ceux de devant !', { color: '#b8a6ff' });
      else if (it === 13) { const p = ps[f.seat]; if (p && FX()) dust(p.x, p.y, 10, '255,255,255', 1.2); }
      else if (it === 5) { msgGlobal('🐌', nameOf(f.seat) + ' ralentit ceux de devant, le premier surtout !', { color: '#9be060' }); if (snap && mySeat >= 0 && snap.players[mySeat] && snap.players[mySeat].pos < (ps[f.seat] ? ps[f.seat].pos : 99)) CALL.push('ESCARGOT !', '#9be060', now); }
      return;
    }
    if (f.type === 'paf') {
      if (!seatOk(f.seat) || !fin(f.x)) return;
      psound('paf', f.x, f.y); sparksAt(f.x, f.y, 14, 4); if (FX()) rings.push({ x: f.x, y: f.y, born: now, life: 320, r1: 34 });
      if (f.seat === mySeat) { shakeMag = Math.max(shakeMag, 8); msgPerso(f.k === 'toupie' ? '🎯' : '📄', (f.k === 'toupie' ? 'Toupie de ' : 'Boule de papier de ') + nameOf(f.by) + ' !', { bad: true }); }
      else if (f.by === mySeat) { msgPerso('🎯', 'Touché : ' + nameOf(f.seat) + ' tourne !', { color: K.yel }); CALL.push('TOUCHÉ !', colSeat(f.by), now); }
      return;
    }
    if (f.type === 'glisse') {                            // flaque posée : 0 huile, 1 eau (bombe), 2 glace (glaçon)
      if (!fin(f.x)) return;
      if (f.k === 1) { psound('splash', f.x, f.y, 'lait'); splashAt(f.x, f.y, 12, '120,190,255'); if (f.seat === mySeat) msgPerso('💧', 'Bombe à eau : ça glisse !', { bad: true }); }
      else if (f.k === 2) { psound('gel', f.x, f.y); splashAt(f.x, f.y, 8, '225,245,255'); if (f.seat === mySeat) msgPerso('🧊', 'Plaque de glace !', { bad: true }); }
      else { psound('glisse', f.x, f.y); splashAt(f.x, f.y, 10, '40,30,20'); if (f.seat === mySeat) msgPerso('🛢', 'De l\'huile ! Ça glisse', { bad: true }); }
      return;
    }
    if (f.type === 'plouf') { if (!fin(f.x)) return; psound('plouf', f.x, f.y); splashAt(f.x, f.y, 20, '120,190,255'); if (FX()) rings.push({ x: f.x, y: f.y, born: now, life: 420, r1: 60 }); return; }
    if (f.type === 'boum') {                              // pétard : éclair, étincelles, onde ; secousse si c'est près de moi
      if (!fin(f.x)) return;
      psound('boum', f.x, f.y); sparksAt(f.x, f.y, 26, 6); if (FX()) { LUM.ajouter(f.x, f.y, 150, '#ffb03a', 320, 0.75); rings.push({ x: f.x, y: f.y, born: now, life: 380, r1: 140 }); }
      const me = mySeat >= 0 && ps[mySeat]; if (me && Math.hypot(me.x - f.x, me.y - f.y) < 320) shakeMag = Math.max(shakeMag, 7);
      return;
    }
    if (f.type === 'rate') { if (f.seat === mySeat) msgPerso(f.it === 10 ? '🪝' : '🎯', f.it === 10 ? 'Grappin lancé dans le vide : personne devant à portée' : 'Toupie lancée dans le vide : personne à viser', { bad: true }); return; }
    if (f.type === 'pare') { const p = ps[f.seat]; if (p) { psound('pare', p.x, p.y); if (FX()) rings.push({ x: p.x, y: p.y, born: now, life: 360, r1: 36, sh: 1 }); } return; }
  }

  // ───────────────────────── interpolation ─────────────────────────
  const VIEWP = {}, VPJ = [];                            // VPJ : boules de papier, interpolées comme les voitures
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
    VRT = (sa.rt || 0) + ((sb.rt || 0) - (sa.rt || 0)) * al;   // temps de course interpolé : position des obstacles mobiles
    interpListe(VPJ, sa.pj, sb.pj, al, 60); interpListe(VTP, sa.tp, sb.tp, al, 140); interpListe(VBM, sa.bm, sb.bm, al, 110); interpListe(VPT, sa.pt, sb.pt, al, 60);
    return VIEWP;
  }

  // ───────────────────────── décor pré-rendu (une fois par circuit) ─────────────────────────
  let decorCv = null, decorKey = '', decorQ = 1, skidCv = null, skidG = null, skidKey = '', skidQ = 0.6, miniCv = null, miniKey = '';
  function ensureDecor() {
    let q = Math.min(1.15, Math.max(0.5, cv.width / VIEW));
    q = Math.min(q, Math.sqrt(8e6 / (C.w * C.h)));   // budget du décor pré-rendu : 8 M pixels (32 Mo), circuits jusqu'à 9,6 M u²
    q = Math.round(q * 20) / 20;
    const key = ckey + '|' + q + '|' + (A.contrast ? 1 : 0);   // le sens compte : flèches turbo et cases de départ s'inversent
    if (decorCv && key === decorKey) return;
    decorKey = key; decorQ = q;
    if (!decorCv) decorCv = document.createElement('canvas');
    decorCv.width = Math.round(C.w * q); decorCv.height = Math.round(C.h * q);
    const g = decorCv.getContext('2d');
    g.setTransform(q, 0, 0, q, 0, 0);
    peindreCircuit(g, C, { contraste: A.contrast, reduceFx: A.reduceFx });
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
  // ── ce qui bouge ou change au sol (dessiné à chaque image) ──
  function boite(g, x, y, i, now) {                      // boîte de bonus 🎁 : cube de couleur changeante qui tourne doucement
    const s = 14 + (A.reduceFx ? 0 : Math.sin(now / 260 + i) * 1.2), hue = A.reduceFx ? 290 : (now / 12 + i * 40) % 360;
    g.save(); g.translate(x, y);
    g.fillStyle = 'rgba(0,0,0,0.28)'; g.beginPath(); g.arc(4, 6, s * 1.15, 0, Math.PI * 2); g.fill();
    g.rotate(A.reduceFx ? 0.3 : now / 700 + i);
    g.fillStyle = 'hsl(' + hue.toFixed(0) + ',85%,58%)'; g.beginPath(); rr(g, -s, -s, 2 * s, 2 * s, 5); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 2; g.stroke();
    g.fillStyle = '#ffffff'; g.fillRect(-s, -2.5, 2 * s, 5); g.fillRect(-2.5, -s, 5, 2 * s);
    g.fillStyle = 'rgba(255,255,255,0.3)'; g.beginPath(); rr(g, -s + 3, -s + 3, s - 3, s - 3, 3); g.fill();
    g.restore();
  }
  function flaque(g, x, y) {                              // flaque d'huile posée par un joueur (rayon de prise ≈ 44 u)
    g.save(); g.fillStyle = 'rgba(22,16,8,0.82)'; g.beginPath(); oval(g, x, y, 38, 30); oval(g, x + 24, y + 8, 18, 14); oval(g, x - 22, y + 12, 16, 12); oval(g, x + 4, y - 26, 14, 10); g.fill();
    const gr = g.createLinearGradient(x - 30, y - 20, x + 30, y + 20); gr.addColorStop(0, 'rgba(255,90,200,0.35)'); gr.addColorStop(0.5, 'rgba(90,216,255,0.35)'); gr.addColorStop(1, 'rgba(247,255,90,0.3)');
    g.fillStyle = gr; g.beginPath(); oval(g, x - 6, y - 6, 18, 9); g.fill(); g.restore();
  }
  function interpListe(out, ja, jb, al, seuil) {         // objets en vol [x, y, …] : interpolés entre deux états (même rang, pas trop loin)
    out.length = 0; ja = ja || []; jb = jb || [];
    for (let i = 0; i < jb.length; i++) { const q = jb[i], o = ja[i]; out.push(o && Math.hypot(q[0] - o[0], q[1] - o[1]) < seuil ? [o[0] + (q[0] - o[0]) * al, o[1] + (q[1] - o[1]) * al, q[2]] : q); }
  }
  function flaqueEau(g, x, y, now) {                      // flaque de la bombe à eau (rayon de prise ≈ 62 u) : bleue, translucide, ridée
    g.save(); g.fillStyle = 'rgba(70,150,235,0.42)'; g.beginPath(); oval(g, x, y, 56, 44); oval(g, x + 34, y + 12, 24, 18); oval(g, x - 30, y + 16, 22, 16); oval(g, x + 6, y - 36, 18, 13); g.fill();
    g.strokeStyle = 'rgba(220,240,255,0.55)'; g.lineWidth = 2;
    const ph = A.reduceFx ? 0.5 : (now / 1400) % 1;
    for (let k = 0; k < 2; k++) { const u = (ph + k * 0.5) % 1; g.globalAlpha = 1 - u; g.beginPath(); oval(g, x, y, 12 + u * 40, 9 + u * 30); g.stroke(); }
    g.globalAlpha = 1; g.fillStyle = 'rgba(255,255,255,0.5)'; g.beginPath(); oval(g, x - 16, y - 12, 12, 5); g.fill(); g.restore();
  }
  function flaqueGlace(g, x, y) {                         // plaque de glace du glaçon (≈ 52 u) : bleu très pâle, bords nets, reflets
    g.save(); g.fillStyle = 'rgba(215,240,255,0.78)'; g.strokeStyle = 'rgba(140,200,240,0.9)'; g.lineWidth = 2; g.beginPath();
    for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2, d = 46 + ((i * 37) % 11) - 5; if (i) g.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.82); else g.moveTo(x + d, y); }
    g.closePath(); g.fill(); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.95)'; g.lineWidth = 3; g.lineCap = 'round'; g.beginPath(); g.moveTo(x - 26, y - 8); g.lineTo(x - 6, y - 22); g.moveTo(x - 14, y + 4); g.lineTo(x + 2, y - 8); g.moveTo(x + 14, y + 14); g.lineTo(x + 26, y + 4); g.stroke();
    g.restore();
  }
  function toupieVol(g, x, y, now, k) {                   // toupie chercheuse : toupie qui tourne très vite, traînée rouge
    g.save();
    if (!A.reduceFx) lumiere(g, x, y, 34, '#ff5a5a', 0.45);
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.arc(x + 5, y + 8, 14, 0, Math.PI * 2); g.fill();
    g.translate(x, y); g.rotate(A.reduceFx ? 0 : now / 35 + k);
    const cols = ['#e8322a', '#ffd23a', '#2f7ff0', '#ffffff'];
    for (let i = 0; i < 8; i++) { g.fillStyle = cols[i % 4]; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, 14, i / 8 * Math.PI * 2, (i + 1) / 8 * Math.PI * 2); g.closePath(); g.fill(); }
    g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 1.5; g.beginPath(); g.arc(0, 0, 14, 0, Math.PI * 2); g.stroke();
    g.fillStyle = '#8a5a2a'; g.beginPath(); g.arc(0, 0, 4.5, 0, Math.PI * 2); g.fill();
    g.restore();
  }
  function bombeVol(g, x, y, h) {                         // bombe à eau en cloche : h = 0..1 du vol (grossit en montant, ombre qui s'écarte)
    const z = Math.sin(Math.PI * Math.min(1, Math.max(0, h || 0))), r = 11 * (1 + 0.55 * z);
    g.save(); g.fillStyle = 'rgba(0,0,0,' + (0.28 - 0.14 * z).toFixed(2) + ')'; g.beginPath(); oval(g, x + 6 + 26 * z, y + 9 + 34 * z, 11, 8); g.fill();
    const gr = g.createRadialGradient(x - r * 0.35, y - r * 0.4, 1, x, y, r); gr.addColorStop(0, '#d8efff'); gr.addColorStop(0.45, '#5ab4ff'); gr.addColorStop(1, '#2366c8');
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#2366c8'; g.beginPath(); g.moveTo(x + r * 0.7, y + r * 0.7); g.lineTo(x + r * 1.05, y + r * 0.95); g.lineTo(x + r * 0.9, y + r * 0.55); g.closePath(); g.fill();   // le nœud
    g.restore();
  }
  function petardSol(g, x, y, f, now) {                   // pétard : bâton rouge, mèche qui grésille (clignote plus vite à la fin)
    g.save(); g.translate(x, y); g.rotate(0.5);
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(-12, -3, 26, 10);
    g.fillStyle = '#d8281e'; g.fillRect(-14, -6, 26, 11); g.fillStyle = '#ffd23a'; g.fillRect(-14, -6, 4, 11); g.fillRect(8, -6, 4, 11);
    g.strokeStyle = '#3a2a1a'; g.lineWidth = 2; g.beginPath(); g.moveTo(12, -1); g.quadraticCurveTo(18, -8, 22, -4); g.stroke();
    const on = A.reduceFx || Math.sin(now / (40 + 140 * (f || 0))) > -0.2;
    if (on) { g.fillStyle = '#fff3a0'; g.beginPath(); g.arc(22, -4, 4, 0, Math.PI * 2); g.fill(); if (!A.reduceFx) lumiere(g, 22, -4, 22, '#ffb03a', 0.6); }
    g.restore();
  }
  function encreEcran(now) {                              // encre de seiche reçue : taches sur MON écran (repère du HUD), fondu en entrée et en sortie
    const t = now - encreT0, fin = encreFin ? Math.max(0, 1 - (now - encreFin) / 450) : 1, a = Math.min(1, t / 140) * fin;
    if (a <= 0) return;
    const R = rng(encreSeed), W = HUDW;
    ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = 'rgba(18,12,38,0.94)';
    for (let i = 0; i < 6; i++) {
      const x = W * (0.12 + R() * 0.76), y = W * (0.12 + R() * 0.7), r = W * (0.08 + R() * 0.08);
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
      for (let k = 0; k < 7; k++) { const u = R() * Math.PI * 2, d = r * (0.9 + R() * 0.5); ctx.moveTo(x + Math.cos(u) * d + r * 0.3, y + Math.sin(u) * d); ctx.arc(x + Math.cos(u) * d, y + Math.sin(u) * d, r * (0.2 + R() * 0.25), 0, Math.PI * 2); }
      const dl = r * (0.6 + R()) * Math.min(1, t / 1200); ctx.moveTo(x + r * 0.2, y); ctx.rect(x - r * 0.12, y, r * 0.24, r * 0.8 + dl);   // coulure
      ctx.fill();
    }
    ctx.restore();
  }
  function boule(g, x, y, now, k) {                      // boule de papier froissé qui file
    g.save(); g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.arc(x + 6, y + 10, 9, 0, Math.PI * 2); g.fill();
    g.translate(x, y); g.rotate(A.reduceFx ? 0 : now / 70 + k);
    g.fillStyle = '#f4f3ea'; g.beginPath();
    for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2, d = i % 2 ? 8.5 : 11; if (i) g.lineTo(Math.cos(a) * d, Math.sin(a) * d); else g.moveTo(d, 0); }
    g.closePath(); g.fill(); g.strokeStyle = 'rgba(80,84,96,0.55)'; g.lineWidth = 1.2; g.stroke();
    g.beginPath(); g.moveTo(-6, -3); g.lineTo(2, 1); g.lineTo(6, -4); g.moveTo(-3, 5); g.lineTo(1, 1); g.stroke();
    g.restore();
  }
  const MOBV = { x: 0, y: 0, vx: 0, vy: 0, a: 0 };
  const VTP = [], VBM = [], VPT = [];                    // toupies, bombes à eau, pétards (interpolés)
  let encreT0 = 0, encreFin = 0, encreSeed = 1, encreVu = false;
  function vivants(now, lobby) {                         // boîtes, flaques posées, éclats des bumpers, obstacles mobiles (sous les voitures)
    const bx = snap && snap.bx ? snap.bx : '';
    if (bx) for (let i = 0; i < C.boxes.length; i++) if (bx.charAt(i) === '1') boite(ctx, C.boxes[i][0], C.boxes[i][1], i, now);
    if (snap && snap.fl && !lobby) for (let i = 0; i < snap.fl.length; i++) { const f = snap.fl[i]; if (f[2] === 1) flaqueEau(ctx, f[0], f[1], now); else if (f[2] === 2) flaqueGlace(ctx, f[0], f[1]); else flaque(ctx, f[0], f[1]); }
    if (!lobby) for (let i = 0; i < VPT.length; i++) petardSol(ctx, VPT[i][0], VPT[i][1], VPT[i][2], now);
    for (const k in bumpFlash) {
      const r = C.rocks[k], tt = (now - bumpFlash[k]) / 320;
      if (!r || tt >= 1) { delete bumpFlash[k]; continue; }
      if (!A.reduceFx) lumiere(ctx, r[0], r[1], r[2] * 3, '#ffe27a', 0.55 * (1 - tt));
      ctx.save(); ctx.globalAlpha = 0.9 * (1 - tt); ctx.strokeStyle = '#fff6a0'; ctx.lineWidth = 2 + 4 * (1 - tt); ctx.beginPath(); ctx.arc(r[0], r[1], r[2] + 3 + tt * 12, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    }
    if (lobby) VPJ.length = 0;
    const t = lobby ? now / 1000 : VRT;
    for (let k = 0; k < C.mobs.length; k++) { mobile(C.mobs[k], t, MOBV); mobileDessin(ctx, C, C.mobs[k], MOBV, now, A.reduceFx); }
  }
  function effets(p, v, now) {                           // sur la voiture : bouclier, lueur du turbo, escargot / pénalité au-dessus
    if (p.tb && !A.reduceFx) lumiere(ctx, v.x - Math.cos(v.a) * 22, v.y - Math.sin(v.a) * 22, 40, '#ffb03a', 0.4);
    if (p.ap && !A.reduceFx) {                            // aspiration : traits de vent le long de la voiture (jauge 1-3), lueur claire au boost (4)
      const c = Math.cos(v.a), s = Math.sin(v.a), n = p.ap >= 4 ? 3 : p.ap, ph = (now / 90) % 1;
      ctx.save(); ctx.strokeStyle = p.ap >= 4 ? 'rgba(220,240,255,0.85)' : 'rgba(220,240,255,0.5)'; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.beginPath();
      for (let k = 0; k < n; k++) for (let sd = -1; sd <= 1; sd += 2) {
        const o = (CAR_W * 0.7 + k * 5) * sd, b = -CAR_L * (0.2 + ((ph + k * 0.33) % 1) * 0.9), l = 14 + k * 4;
        ctx.moveTo(v.x + c * b - s * o, v.y + s * b + c * o); ctx.lineTo(v.x + c * (b - l) - s * o, v.y + s * (b - l) + c * o);
      }
      ctx.stroke(); ctx.restore();
      if (p.ap >= 4) lumiere(ctx, v.x - c * 20, v.y - s * 20, 36, '#bfe6ff', 0.35);
    }
    if (p.sh) {
      ctx.save(); ctx.globalAlpha = A.reduceFx ? 0.55 : 0.45 + 0.12 * Math.sin(now / 120);
      ctx.fillStyle = 'rgba(120,200,255,0.25)'; ctx.strokeStyle = '#8fd8ff'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(v.x, v.y, CAR_L * 0.78, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.globalAlpha = 0.8; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(v.x, v.y, CAR_L * 0.62, Math.PI * 1.1, Math.PI * 1.45); ctx.stroke();
      ctx.restore();
    }
    const ic = p.sl ? '🐌' : p.pen ? '⚠️' : '';
    if (ic) { const b = A.reduceFx ? 0 : Math.sin(now / 160) * 2; ctx.save(); ctx.font = '18px system-ui, sans-serif'; ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(ic, v.x, v.y - CAR_L * 0.95 + b); ctx.restore(); }
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
    if (!rf) { if (pendingEnd && (A.reduceFx || !RL.active(now))) finReplay(now); scene(now, null); voileChargement(); return; }
    const real = snap; snap = rf.u < 0.5 ? rf.a : rf.b;
    try { scene(now, rf); } finally { snap = real; }
  }
  function voileChargement() {                           // le circuit annoncé n'est pas encore chargé : voile + message (l'ancien décor est dessous)
    if (!snap || !snap.circuit || snap.circuit === cid || snap.gs === 'lobby') return;
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = 'rgba(10,12,22,0.86)'; ctx.fillRect(0, 0, cv.width, cv.height);
    const f = Math.max(14, cv.width / 26), d = fiche(snap.circuit);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#ffd23a'; ctx.font = 'bold ' + f.toFixed(1) + 'px system-ui, sans-serif';
    ctx.fillText(d.emoji + ' ' + d.nom, cv.width / 2, cv.height / 2 - f * 0.8);
    ctx.fillStyle = 'rgba(255,246,224,.8)'; ctx.font = (f * 0.7).toFixed(1) + 'px system-ui, sans-serif';
    ctx.fillText('Chargement du circuit…', cv.width / 2, cv.height / 2 + f * 0.6);
    ctx.restore();
  }
  function scene(now, rf) {
    const dtm = Math.min(100, Math.max(1, now - (lastFrame || now - 16.7))); lastFrame = now;
    const kdt = dtm / 16.7;
    if (!A.reduceFx && !rf && HS.frozen(now)) return;
    ensureDecor(); ensureSkids();
    const pv = rf ? lerpCars(rf.a, rf.b, rf.u) : (snap && snap.gs !== 'lobby' ? viewCars(now) : null);
    bougerCam(camCible(now, pv), dtm);
    let ox = 0, oy = 0;
    if (shakeMag > 0.3 && !A.reduceFx && !rf) { ox = (Math.random() * 2 - 1) * shakeMag; oy = (Math.random() * 2 - 1) * shakeMag; shakeMag *= Math.pow(0.86, kdt); } else shakeMag = 0;
    const ws = cv.width / cam.w, hs = cv.width / HUDW;
    // fond (hors du monde) puis monde
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = couleurHors(C); ctx.fillRect(0, 0, cv.width, cv.height);   // au-delà du monde : le sol de la pièce, assombri
    ctx.setTransform(ws, 0, 0, ws, cv.width / 2 - (cam.x + ox) * ws, cv.height / 2 - (cam.y + oy) * ws);
    const vx0 = cam.x - cam.w / 2, vy0 = cam.y - cam.w / 2;
    blit(decorCv, decorQ, vx0, vy0, cam.w);
    blit(skidCv, skidQ, vx0, vy0, cam.w);
    // lueurs au sol : phares au crépuscule, turbo, flashs
    if (!A.reduceFx) { if (!rf) LUM.dessiner(ctx, now); }
    const lobby = !snap || snap.gs === 'lobby';
    vivants(now, lobby);
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
        const saut = p.ju > 0 ? Math.sin(Math.PI * Math.min(1, p.ju)) : 0;   // ressort : la voiture monte puis redescend
        if (saut > 0) { ctx.save(); ctx.fillStyle = 'rgba(0,0,0,' + (0.3 - 0.15 * saut).toFixed(2) + ')'; ctx.beginPath(); oval(ctx, v.x + 18 * saut, v.y + 26 * saut, CAR_L * 0.55, CAR_W * 0.6); ctx.fill(); ctx.restore(); }
        if (p.gr >= 0 && pv[p.gr] && !(pv[p.gr].fa > 0)) {   // grappin : le câble tendu jusqu'à la voiture accrochée, le crochet au bout
          const w = pv[p.gr]; ctx.save(); ctx.strokeStyle = '#6b4a2a'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(v.x, v.y);
          ctx.quadraticCurveTo((v.x + w.x) / 2 + (w.y - v.y) * 0.06, (v.y + w.y) / 2 - (w.x - v.x) * 0.06, w.x, w.y); ctx.stroke();
          ctx.fillStyle = '#9aa3ad'; ctx.beginPath(); ctx.arc(w.x, w.y, 5, 0, Math.PI * 2); ctx.fill(); ctx.restore();
        }
        drawCar(ctx, i, v.x, v.y, v.a, { st: p.st, scale: 1 + 0.45 * saut, alpha: p.ph ? (A.reduceFx ? 0.45 : 0.32 + 0.12 * Math.sin(now / 140)) : ghost ? blink : (p.fin && !over ? 0.75 : 1), ghost: ghost || !!p.ph, me: i === mySeat && !over && snap.gs !== 'countdown', brake: p.th < 0 && p.sp > 1, lights, boost: p.sp > 12.5 || !!p.tb, flag: !!p.fin }, now);
        effets(p, v, now);
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
    for (let i = 0; i < VPJ.length; i++) boule(ctx, VPJ[i][0], VPJ[i][1], now, i);   // boules de papier : au-dessus des voitures
    for (let i = 0; i < VTP.length; i++) toupieVol(ctx, VTP[i][0], VTP[i][1], now, i);
    for (let i = 0; i < VBM.length; i++) bombeVol(ctx, VBM[i][0], VBM[i][1], VBM[i][2]);
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
    const col = couleurTraces(C);
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
  const DUST_COL = { bois: '214,180,130', cahier: '230,230,236', feutre: '120,190,140', moquette: '200,120,120', etabli: '200,170,120', plateau: '240,226,190', tapis: '150,200,110' };
  function particulesSol(p, v, kdt, now) {
    const c = Math.cos(v.a), s = Math.sin(v.a), bx = v.x - c * CAR_L * 0.45, by = v.y - s * CAR_L * 0.45;
    if (p.su === 1 && p.sp > 2 && Math.random() < 0.45 * kdt) puffs.push({ x: bx, y: by, vx: -c * 0.4 + (Math.random() - 0.5) * 0.5, vy: -s * 0.4 + (Math.random() - 0.5) * 0.5, born: now, life: 500, r0: 3 + Math.random() * 3, col: (C.dessin && C.dessin.poussiere) || DUST_COL[C.surf] || '200,200,200' });
    if (p.dr >= 3 && p.sp > 4 && Math.random() < 0.35 * kdt) puffs.push({ x: bx, y: by, vx: (Math.random() - 0.5) * 0.5, vy: (Math.random() - 0.5) * 0.5, born: now, life: 650, r0: 4 + Math.random() * 3, col: '235,235,240' });
    if (p.sp > 12.5 && Math.random() < 0.5 * kdt) sparks.push({ x: bx, y: by, vx: -c * 2 + (Math.random() - 0.5), vy: -s * 2 + (Math.random() - 0.5), born: now, life: 180, c: '#ffb03a' });
    if (p.su === 2 && p.sp > 3 && Math.random() < 0.4 * kdt) drops.push({ x: bx, y: by, vx: (Math.random() - 0.5) * 2, vy: (Math.random() - 0.5) * 2, born: now, life: 300, r: 1.5 + Math.random() * 1.5, col: C.surf === 'cahier' ? '30,40,110' : '255,255,250' });
  }
  function voitureQuiTombe(p, v, now) {                  // chute : la voiture rapetisse en tournoyant (bord de table) ou est avalée (poche)
    const t = Math.min(1, v.fa), e = t * t;
    if (p.fh === 2 || p.fh === 3) {                      // raccourci (2) ou remise en piste après un choc (3) : la voiture s'efface sur place, puis réapparaît à la porte
      drawCar(ctx, p.seat, v.x, v.y, v.a, { scale: 1 - e * 0.35, alpha: Math.max(0, (1 - e) * (A.reduceFx ? 1 : 0.6 + 0.4 * Math.sin(now / 40))), noShadow: true }, now);
      ctx.save(); ctx.globalAlpha = (1 - t) * 0.8; ctx.strokeStyle = p.fh === 2 ? K.red : '#ffffff'; ctx.lineWidth = 2.5; ctx.setLineDash([6, 6]); ctx.beginPath(); ctx.arc(v.x, v.y, CAR_L * (0.6 + t * 0.6), 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); ctx.restore();
      return;
    }
    if (p.fh === 1) { let hx = v.x, hy = v.y, bd = 1e9; for (const h of C.holes) { const d = Math.hypot(h[0] - v.x, h[1] - v.y); if (d < bd) { bd = d; hx = h[0]; hy = h[1]; } } drawCar(ctx, p.seat, v.x + (hx - v.x) * e, v.y + (hy - v.y) * e, v.a + t * 6, { scale: Math.max(0.05, 1 - e * 0.95), alpha: 1 - e * 0.6, noShadow: true }, now); return; }
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
    const c = HUDW / 2, cd = fiche(snap ? snap.circuit : cid);
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
    const gp = snap.gp, frm = snap.formule === 'elim' ? '💥 Élimination' : '🏁 Course en ' + snap.laps + ' tour' + (snap.laps > 1 ? 's' : '');
    ctx.fillText((gp ? '🏎 Grand Prix en ' + gp.n + ' courses' : snap.choix === 'hasard' ? '🎲 Circuit au hasard' : cd.emoji + ' ' + cd.nom) + ' · ' + frm, c, y0);
    ctx.font = f2.toFixed(1) + 'px system-ui, sans-serif'; ctx.fillStyle = 'rgba(255,246,224,.78)';
    ctx.fillText(gp ? 'Un circuit différent à chaque course' + (snap.choix === 'hasard' ? ', tiré au sort' : ', en commençant par ' + cd.emoji + ' ' + cd.nom)
      : snap.choix === 'hasard' ? 'Un des ' + CIRCUITS.length + ' circuits, tiré au sort à chaque manche' : cd.sous, c, y0 + f1 * 1.5);
    ctx.fillText(`${n} pilote${n > 1 ? 's' : ''}${nb ? ' + ' + nb + ' bot' + (nb > 1 ? 's' : '') : ''}${teamMode ? ' · ' + (MODE_NAME[snap.mode] || snap.mode) : ''}`, c, y0 + f1 * 1.5 + f2 * 1.5);
    const opt = snap.opt || {}, ex = [snap.sens === 'inverse' ? SENS_NAME.inverse : snap.sens === 'hasard' ? SENS_NAME.hasard : '', opt.bonus ? '🎁 Bonus' : '', opt.pouce ? '🤝 Coup de pouce' : ''].filter(Boolean).join(' · ');
    if (ex) ctx.fillText(ex, c, y0 + f1 * 1.5 + f2 * 3);
    ctx.font = 'bold ' + f2.toFixed(1) + 'px system-ui, sans-serif'; ctx.fillStyle = K.yel;
    ctx.fillText(tot >= 1 ? (TOUCH ? '▶ Touche l\'écran pour aller sur la grille' : '▶ Espace / clic pour aller sur la grille') : 'En attente de pilotes…', c, y0 + f1 * 1.5 + f2 * (ex ? 4.7 : 3.2));
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
    { const mi = mySeat >= 0 ? snap.players[mySeat] : null, en = !!(mi && mi.en && mi.playing && mi.alive && snap.gs === 'play');   // encre reçue
      if (en && !encreVu) { encreVu = true; encreT0 = now; encreFin = 0; encreSeed = (now | 0) + mySeat; } else if (!en && encreVu) { encreVu = false; encreFin = now; }
      if (encreVu || (encreFin && now - encreFin < 450)) encreEcran(now); }
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
      if (snap.opt && snap.opt.bonus && me.alive && !me.fin) {   // objet en réserve, sous la position
        const d = itemAt(me.it);
        ctx.save(); ctx.translate(12, 12 + 70 * k); ctx.scale(k, k);
        ctx.fillStyle = 'rgba(10,12,22,0.72)'; ctx.beginPath(); rr(ctx, 0, 0, 58, 58, 12); ctx.fill();
        ctx.strokeStyle = d ? d.c : 'rgba(255,255,255,0.22)'; ctx.lineWidth = d ? 2.5 : 1.5; ctx.stroke();
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        if (d) {
          const pop = A.reduceFx ? 1 : 1 + 0.35 * Math.max(0, 1 - (now - lastItemMsg) / 320);
          ctx.font = Math.round(28 * pop) + 'px system-ui, sans-serif'; ctx.fillStyle = '#ffffff'; ctx.fillText(d.e, 29, 31);
          if (me.iu > 1) { ctx.font = 'bold 13px system-ui, sans-serif'; ctx.fillStyle = K.cream; ctx.fillText('×' + me.iu, 47, 48); }
          if (!TOUCH) { ctx.font = 'bold 10px system-ui, sans-serif'; ctx.fillStyle = 'rgba(255,246,224,.75)'; ctx.fillText('ESPACE', 29, 68); }
        } else { ctx.globalAlpha = 0.3; ctx.font = '24px system-ui, sans-serif'; ctx.fillStyle = '#ffffff'; ctx.fillText('🎁', 29, 31); ctx.globalAlpha = 1; }
        ctx.restore();
      }
      const fxs = [];                                     // effets en cours, à droite de la position
      if (me.tb) fxs.push('⚡'); if (me.ap >= 4) fxs.push('🌬'); if (me.ph) fxs.push('👻'); if (me.ju) fxs.push('🪀'); if (me.gr >= 0) fxs.push('🪝'); if (me.en) fxs.push('🦑'); if (me.sh) fxs.push('🛡️'); if (me.sl) fxs.push('🐌'); if (me.pen) fxs.push('⚠️');
      if (fxs.length && me.alive) { ctx.save(); ctx.translate(12 + 110 * k, 12); ctx.scale(k, k); ctx.font = '20px system-ui, sans-serif'; ctx.fillStyle = '#ffffff'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; for (let i = 0; i < fxs.length; i++) ctx.fillText(fxs[i], i * 26, 18); ctx.restore(); }
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
  function utiliserObjet(inv) { if (snap && snap.gs === 'play') send(inv ? { t: 'objet', inv: 1 } : { t: 'objet' }); }   // inv : lancer inversé (devant ↔ derrière)
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
  // mode triche (game master) : Espace tenu / relâché → { t: 'tr' } ; relâché aussi si la fenêtre perd le focus
  let trTenu = false;
  const trJ = on => { if (on && !window.__TRICHE) return; if (on === trTenu) return; trTenu = on; send({ t: 'tr', on: on ? 1 : 0 }); };
  const onKeyDown = e => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
    unlockAudio();
    if (e.repeat) return;
    if (e.key === ' ' && (pendingEnd || RL.active(performance.now()))) { RL.skip(); return; }
    if (e.key === ' ') { if (snap && (snap.gs === 'lobby' || snap.gs === 'over')) send({ t: 'start' }); else { utiliserObjet(); if (isPlay()) trJ(true); } return; }   // en course : Espace = l'objet (le klaxon est sur H)
    if (e.code === 'KeyH' || e.code === 'KeyK') { klaxon(); return; }
    if (e.code === 'ControlLeft' || e.code === 'ControlRight' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') { if (isPlay()) utiliserObjet(true); return; }   // Ctrl / Maj : objet lancé dans l'autre sens
    if ((e.key === 'p' || e.key === 'P' || e.key === 'Escape') && isPlay()) { send({ t: 'pause' }); return; }
    const d = Object.prototype.hasOwnProperty.call(DIR_KEYS, e.code) ? DIR_KEYS[e.code] : null; if (d) setIn(d, true);
  };
  const onKeyUp = e => { if (e.key === ' ') { trJ(false); return; } const d = Object.prototype.hasOwnProperty.call(DIR_KEYS, e.code) ? DIR_KEYS[e.code] : null; if (d) setIn(d, false); };
  const onBlur = () => { trJ(false); let ch = false; for (const k in input) if (input[k]) { input[k] = false; ch = true; } if (ch) pushInput(); };
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
    sensBtn = $('mmSens'); bonusBtn = $('mmBonus'); pouceBtn = $('mmPouce'); itemBtn = $('mmItem'); itemInvBtn = $('mmItemInv'); gpBtn = $('mmGp');
    if (gpBtn) gpBtn.onclick = () => send({ t: 'gp' });
    const aideC = $('mmHelpCircuits');                  // circuits de l'aide : tirés des définitions (jamais en retard d'un circuit)
    if (aideC) aideC.innerHTML = CIRCUITS.map(d => `<div class="legrow"><span>${d.emoji}</span><b>${esc(d.nom)}</b> — ${esc(d.sous)}</div>`).join('');
    if (sensBtn) sensBtn.onclick = () => send({ t: 'sens' });
    if (bonusBtn) bonusBtn.onclick = () => send({ t: 'bonus' });
    if (pouceBtn) pouceBtn.onclick = () => send({ t: 'pouce' });
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
      if (itemBtn) { itemBtn.addEventListener('pointerdown', e => { e.preventDefault(); unlockAudio(); utiliserObjet(); if (isPlay()) trJ(true); }); ['pointerup', 'pointerleave', 'pointercancel'].forEach(t => itemBtn.addEventListener(t, () => trJ(false))); }
      if (itemInvBtn) itemInvBtn.addEventListener('pointerdown', e => { e.preventDefault(); unlockAudio(); utiliserObjet(true); });
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
    if (actx) { const c0 = actx; actx = null; try { const pr = c0.close(); if (pr && pr.catch) pr.catch(() => {}); } catch (e) {} }
    resetRound(); snap = null; decorCv = null; decorKey = ''; skidCv = null; skidG = null; skidKey = ''; miniCv = null; miniKey = '';
  }

  return { init, onState, onMessage, onLb, onA11y, teardown, joyAna };
})();
