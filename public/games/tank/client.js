// Module client TANK v2 : arène destructible, power-ups, mines, collision, FFA/équipes, manches.
import { ARENA as ARENA0, TANK_R, SHELL_R, BLK, G as G0 } from './shared.js';
// arène dimensionnée au nombre de participants : la taille des BLOCS ne bouge pas (BLK), c'est le NOMBRE
// de blocs qui augmente (15 / 17 / 19). Le serveur envoie `ag` (côté de la grille) et le client se recale.
let G = G0, ARENA = ARENA0;
import { createMusic } from '../../music.js';
import { seatPattern, SEAT_GLYPH } from '../../patterns.js';
import { initGameMsg, msgPerso, msgGlobal } from '../../gamemsg.js';
import { arenaSize } from '../../layout.js';   // taille du plateau : commune aux 5 jeux (mode plein écran compris)

// musique : guerre/désert — drone grave en quintes, tambours martiaux ; climax (1 vie / duel final) = cor de tension + roulement
const MUSIC_THEME = { bpm: 96, bpmBoost: 12, vol: 0.55, root: 73.42, len: 32,
  stingers: { kill: { notes: [0, -7], wave: 'sawtooth', oct: 0, gain: 0.055, dur: 0.26, rate: 0.1 }, win: { base: 261.63, notes: [[0, 4, 7], [5, 9, 12], [7, 12, 16]], gain: 0.035, dur: 0.3, rate: 0.13 },
    count: { notes: [0], oct: 1, wave: 'sawtooth', dur: 0.12, gain: 0.05, duck: false }, go: { notes: [[0, 4, 7]], oct: 1, dur: 0.4, gain: 0.05, duck: false } },
  layers: [
  { seq: [[0, 7], null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, [-2, 5], null, null, null, null, null, null, null, null, null, null, null, null, null, null, null], wave: 'sawtooth', gain: 0.018, dur: 14 },
  { drums: 'K..K....K..K.S..K..K....K.KKS...', min: 1 },
  { seq: [0, null, null, null, null, null, null, null, 3, null, null, null, 2, null, null, null, 0, null, null, null, null, null, null, null, -2, null, null, null, null, null, null, null], wave: 'sawtooth', gain: 0.02, dur: 4, min: 2 },
  { drums: '..H...H...H...H...H...H...H.HH..', gain: 0.7, min: 2 },
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
// identité visuelle propre au jeu (fixe) : Désert / Champ de bataille
const SKIN = { bg: '#14130c', floor: '#2b2818', floor2: '#262313', solid: '#564f45', soft: '#8a6a3c', softTop: '#b58a4c', grid: 'rgba(255,220,150,0.045)', border: 'rgba(210,180,120,0.3)', steel: true, crate: true };
// fond animé : grains de sable/poussière qui dérivent dans le vent (identité désert) — coupé par reduceFx
const AMB_DUST = Array.from({ length: 18 }, () => ({ y: Math.random(), v: 12 + Math.random() * 26, a: 6 + Math.random() * 14, ph: Math.random() * 6.28, r: 1 + Math.random() * 2.2 }));
const INTERP_MS = 55;
const KEYMAP = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'fwd', KeyW: 'fwd', ArrowDown: 'back', KeyS: 'back' };

export default (function () {
  let A, send, root, cv, ctx, togglePanel = () => {}, closePanels = () => {};
  let CC = PAL.normal, TEAMCC = TEAMPAL.normal, TH = SKIN, FX = 1;
  let mySeat = -1, snap = null, prevGs = 'lobby', teamMode = false, endShown = false, inGamePrev = false;
  let board = [], buf = [];
  const particles = [], puffs = [], lastPos = {};      // puffs = poussière/fumée (rendu opaque) ; lastPos = pour détecter le mouvement
  const craters = [], tracks = [];                     // cratères (murs détruits, persistants la manche) + traces de chenilles (s'estompent)
  let prevRound = -1, _lastCount = -1;
  let shakeMag = 0, rafId = 0, destroyed = false, resizeH = null, actx = null;
  const music = createMusic(() => actx, () => A, MUSIC_THEME);
  const input = { left: false, right: false, fwd: false, back: false, fire: false };
  let hud, cards, startBtn, pauseBtn, modeBtn, botsBtn, diffBtn, arenaBtn, winBtn, ffBtn, pauseFloat, lbBtn, lbPanel, lbBody, endEl;
  const DIFF_NAMES = ['Facile', 'Normale', 'Difficile'];

  const $ = id => root.querySelector('#' + id);
  const colSeat = s => { if (s < 0 || !snap) return '#fff'; const p = snap.players[s]; return teamMode && p ? TEAMCC[p.team] : CC[s]; };
  function applyColors() { CC = PAL[A.palette] || PAL.normal; TEAMCC = TEAMPAL[A.palette] || TEAMPAL.normal; FX = A.reduceFx ? 0 : 1; TH = SKIN; }

  function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const size = arenaSize({ max: 760 });
    cv.style.width = size + 'px'; cv.style.height = size + 'px'; cv.width = Math.round(size * dpr); cv.height = Math.round(size * dpr);
  }

  const TANK_VECT = { speed: 1, repair: 1, emp: 1, homing: 1, camo: 1, radar: 1 };   // power-ups dessinés en vectoriel (les emoji varient selon l'OS)
  function drawTankIcon(t, x, y, s, col) {
    const k = s / 10; ctx.save(); ctx.translate(x, y); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = col; ctx.fillStyle = col;
    if (t === 'speed') { ctx.lineWidth = 2 * k; for (const o of [-3, 2]) { ctx.beginPath(); ctx.moveTo((o - 2) * k, -4.5 * k); ctx.lineTo((o + 3) * k, 0); ctx.lineTo((o - 2) * k, 4.5 * k); ctx.stroke(); } }
    else if (t === 'repair') { ctx.lineWidth = 2.4 * k; ctx.beginPath(); ctx.moveTo(-4 * k, 4 * k); ctx.lineTo(2 * k, -2 * k); ctx.stroke(); ctx.lineWidth = 1.8 * k; ctx.beginPath(); ctx.arc(3.5 * k, -3.5 * k, 3 * k, 0.6, 5.2); ctx.stroke(); }                       // clé à molette
    else if (t === 'emp') { ctx.beginPath(); ctx.moveTo(1.5 * k, -6 * k); ctx.lineTo(-2.5 * k, 0.5 * k); ctx.lineTo(0.5 * k, 0.5 * k); ctx.lineTo(-1.5 * k, 6 * k); ctx.lineTo(3.5 * k, -1 * k); ctx.lineTo(0.5 * k, -1 * k); ctx.closePath(); ctx.fill(); }              // éclair
    else if (t === 'homing') { ctx.beginPath(); ctx.moveTo(0, -6 * k); ctx.quadraticCurveTo(3 * k, -2 * k, 2 * k, 3 * k); ctx.lineTo(-2 * k, 3 * k); ctx.quadraticCurveTo(-3 * k, -2 * k, 0, -6 * k); ctx.fill(); ctx.beginPath(); ctx.moveTo(-2 * k, 3 * k); ctx.lineTo(-4 * k, 6 * k); ctx.lineTo(-1.2 * k, 4.5 * k); ctx.closePath(); ctx.moveTo(2 * k, 3 * k); ctx.lineTo(4 * k, 6 * k); ctx.lineTo(1.2 * k, 4.5 * k); ctx.closePath(); ctx.fill(); }   // missile
    else if (t === 'camo') { ctx.lineWidth = 1.8 * k; ctx.beginPath(); ctx.ellipse(0, 0, 5.5 * k, 3.4 * k, 0, 0, 6.29); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, 1.7 * k, 0, 6.29); ctx.fill(); }   // œil
    else if (t === 'radar') { ctx.lineWidth = 1.8 * k; ctx.beginPath(); ctx.arc(0, 1 * k, 1.5 * k, 0, 6.29); ctx.fill(); for (const r of [3.5, 5.8]) { ctx.beginPath(); ctx.arc(0, 1 * k, r * k, -2.4, -0.74); ctx.stroke(); } }                                            // ondes radar
    ctx.restore();
  }
  function refreshHUD() {
    if (!snap) return;
    snap.players.forEach((p, i) => {
      const shown = p.connected || p.playing;
      cards[i].classList.toggle('hidden', !shown);
      if (!shown) return;
      const col = colSeat(i);
      cards[i].style.color = col; cards[i].classList.toggle('dead', p.playing && !p.alive); cards[i].classList.toggle('me', i === mySeat);
      const tags = [];
      if (teamMode) tags.push(`<span class="badge" style="background:${col}28;color:${col}">ÉQ.${TEAM_LETTER[p.team]}</span>`);
      if (p.bot) tags.push(`<span class="badge" style="background:${col}28;color:${col}">BOT</span>`);
      else if (i === mySeat) tags.push(`<span class="badge" style="background:${col}28;color:${col}">VOUS</span>`);
      const gly = `<span style="opacity:.7;font-size:.9em" title="motif du siège">${SEAT_GLYPH[i % SEAT_GLYPH.length]}</span>`;   // rappel du motif peint sur la caisse (constante : aucune donnée réseau injectée)
      cards[i].querySelector('.pn').innerHTML = `${(window.__AV && window.__AV(p.name)) || ''}${p.name || ('P' + (i + 1))} ${gly} <span class="sc">🏆${p.score} · ${p.kills}⚡</span> ${tags.join('')}`;
      const lv = cards[i].querySelector('.lv'); lv.style.color = col;
      const counts = [p.shield ? '⛉' + p.shield : '', p.mineN ? '◈' + p.mineN : ''].filter(Boolean).join(' ');
      const bars = (p.buffs || []).map(([k, fr]) => { const d = PU[k] || { i: '?', c: '#fff' }, pct = Math.max(0, Math.min(100, Math.round(fr * 100))); return `<span class="buff" style="background:linear-gradient(90deg,${d.c} ${pct}%,rgba(255,255,255,.12) ${pct}%);border-color:${d.c}66">${d.i}</span>`; }).join('');
      lv.innerHTML = p.playing ? (p.alive ? ('❤'.repeat(p.lives) + (counts ? ' · ' + counts : '') + (p.emp ? ' ⚡' : '') + (bars ? ' ' + bars : '')) : '✖ détruit') : 'prêt';
    });
  }
  function renderLB() {
    if (!lbBody) return;
    if (!board.length) { lbBody.innerHTML = '<div class="lbnote">Aucune partie enregistrée.</div>'; return; }
    const B = board.map(e => ({ ...e, kd: e.deaths ? e.kills / e.deaths : e.kills }));
    lbBody.innerHTML = B.sort((a, b) => b.wins - a.wins || b.kd - a.kd).map(e =>
      `<div class="lbrow"><span class="lbn">${e.name}</span><span>🎮${e.games}</span><span>🏆${e.wins}</span><span title="kills">⚡${e.kills}</span><span title="touches">🎯${e.dmg}</span><span title="K/D">⚖${(e.deaths ? (e.kills / e.deaths).toFixed(2) : (e.kills ? '∞' : '0'))}</span></div>`).join('');
  }
  function showEndscreen(m) {
    if (m.gs !== 'over' || !m.stats) { endEl.classList.add('hidden'); return; }
    endEl.classList.remove('hidden');
    const isMatch = m.stats.match;
    const parts = m.players.filter(p => p.playing && p.place > 0).slice().sort((a, b) => a.place - b.place);
    const champ = m.winner >= 0 ? parts.find(p => p.team === m.winner) : null;
    const who = champ ? (teamMode ? 'Équipe ' + TEAM_LETTER[m.winner] : (champ.name || ('P' + (champ.seat + 1)))) : null;
    const title = champ ? (isMatch ? '🏆 ' + who + ' REMPORTE LE MATCH' : who + ' gagne la manche') : 'Égalité';
    const medals = ['🥇', '🥈', '🥉'];
    const rows = parts.map(p => {
      const col = colSeat(p.seat), medal = medals[p.place - 1] || ('#' + p.place);
      const res = p.alive ? (teamMode ? 'survivant·e' : 'vainqueur') : `détruit à ${Math.round((p.elimTick || 0) / 30)}s`;
      return `<div class="erow ${p.alive ? 'win' : ''}"><span class="eplace">${medal}</span>
        <span class="ename" style="color:${col}">${p.name || ('P' + (p.seat + 1))}${teamMode ? ` <small>Éq.${TEAM_LETTER[p.team]}</small>` : ''} <small>🏆${p.score}</small></span>
        <span class="estat">⚡ ${p.kills}</span><span class="estat">🎯 ${p.dmg}</span><span class="eres">${res}</span></div>`;
    }).join('');
    endEl.innerHTML = `<div class="etitle" style="color:${champ ? colSeat(champ.seat) : '#fff'}">${title}</div>
      <div class="emeta">⏱ ${m.stats.durationSec}s · ${m.stats.nParts} joueurs · objectif ${m.winTarget} manche(s)</div>
      <div class="elist">${rows}</div><div class="ehint">Espace / clic pour rejouer</div>`;
  }

  function onMessage(m) { if (m && m.t === 'welcome') mySeat = m.seat; }
  function onLb(d) { board = d.board || []; renderLB(); }
  function onState(m) {
    if (m.ag && m.ag !== G) { G = m.ag; ARENA = G * BLK; }   // grille redimensionnée par le serveur : tout le rendu lit G / ARENA
    if (m.grid === undefined && snap) m.grid = snap.grid;   // delta réseau : grille absente = inchangée
    snap = m; teamMode = m.mode && m.mode !== 'ffa';
    if (m.round !== prevRound) { prevRound = m.round; craters.length = 0; tracks.length = 0; }   // nouvelle manche : terrain propre
    const inGame = m.gs === 'play' || m.gs === 'countdown' || m.gs === 'paused';
    if (inGame !== inGamePrev) { inGamePrev = inGame; document.body.classList.toggle('playing', inGame); resizeCanvas(); }
    document.body.classList.toggle('paused', m.gs === 'paused');
    if (m.gs === 'play' || m.gs === 'countdown') closePanels();
    buf.push({ t: performance.now(), s: m }); if (buf.length > 10) buf.shift();
    (m.fx || []).forEach(playFx);
    if (prevGs !== 'over' && m.gs === 'over') { sound('win'); music.sting('win'); }
    if (m.gs === 'countdown' && m.count > 0 && m.count !== _lastCount) music.sting('count');   // décompte musical 3·2·1
    if (prevGs === 'countdown' && m.gs === 'play') music.sting('go');
    _lastCount = m.count;
    prevGs = m.gs;
    { let inten = 0;                                  // musique : 1 en jeu, 2 si un tank est à 1 vie ou duel final (parmi 3+)
      if (m.gs === 'play' || m.gs === 'countdown') { inten = 1; const tot = m.players.filter(p => p.playing).length, alive = m.players.filter(p => p.playing && p.alive); if ((tot >= 3 && alive.length <= 2) || alive.some(p => p.lives === 1)) inten = 2; }
      music.setIntensity(inten); }
    refreshHUD();
    if (m.gs === 'over') { if (!endShown) { showEndscreen(m); endShown = true; } } else { endShown = false; endEl.classList.add('hidden'); }
    const idle = m.gs === 'lobby' || m.gs === 'over';
    const total = m.connected + (m.botCount || 0);
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

  function unlockAudio() { if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch {} } if (actx && actx.state === 'suspended') actx.resume(); }
  let sndPan = 0;                                   // pan stéréo du prochain son (posé par psound, consommé par tone)
  function tone(f, d, ty = 'square', g = 0.05, dl = 0) { const _v = (A && typeof A.sfx === 'number') ? A.sfx : 1; if (!actx || _v <= 0) return; const t0 = actx.currentTime + dl, o = actx.createOscillator(), gg = actx.createGain(); o.type = ty; o.frequency.setValueAtTime(f, t0); gg.gain.setValueAtTime(g * _v, t0); gg.gain.exponentialRampToValueAtTime(0.0001, t0 + d); o.connect(gg); let dest = actx.destination; if (sndPan && actx.createStereoPanner) { const pn = actx.createStereoPanner(); pn.pan.value = Math.max(-1, Math.min(1, sndPan)); pn.connect(actx.destination); dest = pn; } gg.connect(dest); o.start(t0); o.stop(t0 + d); }
  function psound(k, x) { sndPan = Math.max(-1, Math.min(1, (x / ARENA - 0.5) * 1.7)); sound(k); sndPan = 0; }   // son positionné gauche/droite selon le x de l'événement
  function sound(k) { if (!actx) return; if (k === 'shot') tone(320, 0.05, 'square', 0.03); else if (k === 'hit') tone(200, 0.08, 'square', 0.05); else if (k === 'pickup') { tone(660, 0.07, 'square', 0.05); tone(990, 0.08, 'square', 0.05, 0.06); } else if (k === 'boom') { tone(150, 0.25, 'sawtooth', 0.06); tone(80, 0.32, 'sawtooth', 0.05, 0.05); } else if (k === 'win') { tone(523, 0.18, 'triangle', 0.06); tone(659, 0.18, 'triangle', 0.06, 0.12); tone(784, 0.3, 'triangle', 0.06, 0.24); } }
  // Un power-up vient d'être ramassé : on annonce son EFFET. Jamais de nom de joueur (constantes seules).
  // Perso pour l'équipement (les autres n'ont pas à le savoir : ce serait du bruit), global quand l'effet
  // change la partie de tout le monde — la bande globale reste collée au bord, hors zone de jeu.
  function direPU(kind, seat) {
    const m = PU_MSG[kind]; if (!m) return;
    const d = PU[kind] || { i: '?', c: '#fff' };
    if (m.g) msgGlobal(d.i, m.t, { color: d.c });
    else if (seat === mySeat) msgPerso(d.i, m.t, { color: d.c });
  }
  function playFx(f) {
    if (f.type === 'shot') { psound('shot', f.x); if (!A.reduceFx) { const now = performance.now(); for (let k = 0; k < 6; k++) { const a = Math.random() * Math.PI * 2, sp = 1 + Math.random() * 2.6; particles.push({ x: f.x, y: f.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, born: now, life: 150 + Math.random() * 120, color: '#ffe08a' }); } } return; } // flash de bouche
    if (f.type === 'hit') return psound('hit', f.x);
    if (f.type === 'wall') {                            // mur cassé : cratère persistant + éclats de bois
      craters.push({ gx: f.x, gy: f.y }); if (craters.length > 60) craters.shift();
      if (!A.reduceFx) { const now = performance.now(), cx0 = (f.x + 0.5) * BLK, cy0 = (f.y + 0.5) * BLK; for (let k = 0; k < 7; k++) { const a = Math.random() * Math.PI * 2, sp = 1 + Math.random() * 2.4; particles.push({ x: cx0, y: cy0, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, born: now, life: 260 + Math.random() * 200, color: '#b58a4c' }); } }
      return;
    }
    if (f.type === 'pickup') { sound('pickup'); direPU(f.kind, f.seat); return; }
    if (f.type === 'mineset') return sound('pickup');
    if (f.type === 'emp') { if (f.seat === mySeat) msgPerso(PU.emp.i, 'Étourdi : ni tir ni marche', { bad: true }); return; }   // victime d'un EMP : elle seule a besoin de savoir pourquoi elle est bloquée
    if (f.type === 'shield') { if (f.seat === mySeat) msgPerso(PU.shield.i, 'Bouclier : tir encaissé', { color: PU.shield.c }); return; }   // explique ce que le ⛉ vient d'absorber
    if (f.type === 'barrel') { psound('boom', f.x); if (A.reduceFx) return; shakeMag = Math.max(shakeMag, 9); const now = performance.now(); for (let k = 0; k < 26; k++) { const a = Math.random() * Math.PI * 2, sp = 1.5 + Math.random() * 5; particles.push({ x: f.x, y: f.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, born: now, life: 380 + Math.random() * 320, color: Math.random() < 0.5 ? '#ff8a3a' : '#ffd23f' }); } return; } // explosion de baril (orange/jaune)
    if (f.type === 'boom') {
      psound('boom', f.x); if (!f.small) music.sting('kill'); if (A.reduceFx) return;
      if (!f.small) shakeMag = Math.max(shakeMag, 7);
      const col = colSeat(f.seat), now = performance.now(), n = f.small ? 8 : 18;
      for (let k = 0; k < n; k++) { const a = Math.random() * Math.PI * 2, sp = 1 + Math.random() * 4.5; particles.push({ x: f.x, y: f.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, born: now, life: 380 + Math.random() * 280, color: col }); }
    }
  }
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

  let terrainCv = null, terrainKey = '';            // décor statique pré-rendu (sol, murs, bordure, boue) — redessiné seulement si grille/boue/taille change
  function ensureTerrain() {
    const key = cv.width + '|' + G + '|' + snap.grid + '|' + (snap.mud || []).join(',');
    if (terrainCv && key === terrainKey) return;
    terrainKey = key;
    if (!terrainCv) terrainCv = document.createElement('canvas');
    terrainCv.width = cv.width; terrainCv.height = cv.height;
    const old = ctx; ctx = terrainCv.getContext('2d');
    ctx.setTransform(cv.width / ARENA, 0, 0, cv.width / ARENA, 0, 0);
    const g = snap.grid;
    for (let gy = 0; gy < G; gy++) for (let gx = 0; gx < G; gx++) {
      const c = g[gy * G + gx], x = gx * BLK, y = gy * BLK;
      ctx.fillStyle = ((gx + gy) & 1) ? TH.floor : TH.floor2; ctx.fillRect(x, y, BLK, BLK);
      if (c === '1') {
        ctx.fillStyle = TH.solid; ctx.fillRect(x + 1, y + 1, BLK - 2, BLK - 2); ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fillRect(x + 1, y + 1, BLK - 2, 4);
        if (TH.steel) { ctx.fillStyle = 'rgba(0,0,0,0.34)'; for (const rx of [x + 6, x + BLK - 6]) for (const ry of [y + 6, y + BLK - 6]) { ctx.beginPath(); ctx.arc(rx, ry, 2.1, 0, Math.PI * 2); ctx.fill(); } ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 1; ctx.strokeRect(x + 2.5, y + 2.5, BLK - 5, BLK - 5); } // plaque d'acier rivetée
      } else if (c === '2') {
        ctx.fillStyle = TH.soft; ctx.fillRect(x + 2, y + 2, BLK - 4, BLK - 4); ctx.fillStyle = TH.softTop; ctx.fillRect(x + 2, y + 2, BLK - 4, 5);
        if (TH.crate) { ctx.strokeStyle = 'rgba(0,0,0,0.22)'; ctx.lineWidth = 1.5; ctx.strokeRect(x + 3, y + 3, BLK - 6, BLK - 6); ctx.beginPath(); ctx.moveTo(x + 3, y + 3); ctx.lineTo(x + BLK - 3, y + BLK - 3); ctx.moveTo(x + BLK - 3, y + 3); ctx.lineTo(x + 3, y + BLK - 3); ctx.stroke(); } // caisse en bois
      }
    }
    ctx.strokeStyle = TH.border || 'rgba(255,255,255,0.2)'; ctx.lineWidth = 3; ctx.strokeRect(1.5, 1.5, ARENA - 3, ARENA - 3);
    (snap.mud || []).forEach(i2 => { const gx = i2 % G, gy = (i2 / G) | 0, x = gx * BLK, y = gy * BLK; ctx.fillStyle = 'rgba(86,60,28,0.6)'; ctx.fillRect(x, y, BLK, BLK); ctx.fillStyle = 'rgba(54,38,16,0.7)'; ctx.beginPath(); ctx.arc(x + BLK * 0.32, y + BLK * 0.4, 4, 0, Math.PI * 2); ctx.arc(x + BLK * 0.68, y + BLK * 0.62, 5, 0, Math.PI * 2); ctx.arc(x + BLK * 0.5, y + BLK * 0.8, 3, 0, Math.PI * 2); ctx.fill(); });   // boue cuite dans le décor
    ctx = old;
  }

  // ——— Écran titre du lobby : logo « TANKS » en plaque de blindage rivetée ———
  const TITLE_FONT = '"Black Ops One",Impact,sans-serif';   // police Google déjà chargée par la page (repli système)
  function rrectPath(x, y, w, h, r) {                        // coin arrondi maison (pas de ctx.roundRect : vieux Safari)
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
  }
  // Lettres pochoir sable + contour sombre, rivets aux angles, chenille qui défile sous le mot, voile de poussière devant.
  function drawTitle(cx, cy, now) {
    const TXT = 'TANKS', anim = !A.reduceFx;
    ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    let fs = 52; ctx.font = fs + 'px ' + TITLE_FONT;
    const maxW = ARENA * 0.70; let w = ctx.measureText(TXT).width;
    if (w > maxW) { fs = Math.max(20, Math.floor(fs * maxW / w)); ctx.font = fs + 'px ' + TITLE_FONT; w = ctx.measureText(TXT).width; }   // tient toujours dans l'arène (mobile)
    const bandH = Math.max(7, fs * 0.22), ph = fs * 1.16 + bandH, pw = w + fs * 0.9;
    const px = cx - pw / 2, py = cy - ph / 2, ty = py + (ph - bandH) / 2, rr = Math.min(10, fs * 0.22);

    // plaque d'acier (dégradé métal + liseré sable)
    const mg = ctx.createLinearGradient(0, py, 0, py + ph);
    mg.addColorStop(0, '#4a422c'); mg.addColorStop(0.5, '#2e2a1a'); mg.addColorStop(1, '#201c11');
    ctx.beginPath(); rrectPath(px, py, pw, ph, rr); ctx.fillStyle = mg; ctx.fill();
    ctx.strokeStyle = 'rgba(224,169,46,0.55)'; ctx.lineWidth = 2; ctx.stroke();

    // bande de chenille sous le mot (défile, figée en reduceFx)
    const by = py + ph - bandH - 3, bx = px + rr * 0.6, bw = pw - rr * 1.2, step = Math.max(6, bandH * 0.9);
    const off = anim ? (now / 24) % step : 0;
    ctx.save(); ctx.beginPath(); rrectPath(bx, by, bw, bandH, bandH * 0.35); ctx.clip();
    ctx.fillStyle = '#15120a'; ctx.fillRect(bx, by, bw, bandH);
    for (let x = bx - step; x < bx + bw + step; x += step) {
      ctx.fillStyle = '#5d5132'; ctx.fillRect(x + off + 1, by + 1.5, step - 2.5, bandH - 3);
      ctx.fillStyle = 'rgba(255,225,170,0.16)'; ctx.fillRect(x + off + 1, by + 1.5, step - 2.5, 1.5);
    }
    ctx.restore();

    // rivets aux quatre angles
    const ri = Math.max(2, fs * 0.055), ins = rr + ri + 1;
    for (const rx of [px + ins, px + pw - ins]) for (const ry of [py + ins, py + ph - ins]) {
      ctx.beginPath(); ctx.arc(rx, ry, ri, 0, Math.PI * 2); ctx.fillStyle = '#17130a'; ctx.fill();
      ctx.beginPath(); ctx.arc(rx - ri * 0.3, ry - ri * 0.3, ri * 0.45, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255,228,170,0.5)'; ctx.fill();
    }

    // le mot : contour sombre puis remplissage sable
    if (anim) { ctx.shadowColor = 'rgba(224,169,46,0.55)'; ctx.shadowBlur = 16 + 5 * Math.sin(now / 620); }
    ctx.lineWidth = Math.max(2, fs * 0.1); ctx.strokeStyle = '#17130a'; ctx.strokeText(TXT, cx, ty);
    ctx.shadowBlur = 0;
    const tg = ctx.createLinearGradient(0, ty - fs * 0.5, 0, ty + fs * 0.5);
    tg.addColorStop(0, '#f6de9d'); tg.addColorStop(0.5, '#e0a92e'); tg.addColorStop(1, '#a87218');
    ctx.fillStyle = tg; ctx.fillText(TXT, cx, ty);

    if (anim) {
      const g0 = (now / 2600) % 1, ga = Math.max(0, g0 - 0.12), gb = Math.min(1, g0 + 0.12);   // reflet qui balaie les lettres
      const gl = ctx.createLinearGradient(px, 0, px + pw, 0);
      gl.addColorStop(0, 'rgba(255,255,255,0)'); gl.addColorStop(ga, 'rgba(255,255,255,0)');
      gl.addColorStop(Math.min(gb, Math.max(ga, g0)), 'rgba(255,255,255,0.34)');
      gl.addColorStop(gb, 'rgba(255,255,255,0)'); gl.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gl; ctx.fillText(TXT, cx, ty);
      // voile de poussière qui dérive devant la plaque
      ctx.save(); ctx.beginPath(); rrectPath(px, py, pw, ph, rr); ctx.clip(); ctx.fillStyle = 'rgb(222,203,158)';
      for (let k = 0; k < 6; k++) {
        const dx = (now / 1000 * (14 + k * 5) + k * 97) % (pw + 90) - 45 + px, dy = py + ph * (0.18 + 0.13 * k) + Math.sin(now / 1100 + k) * 5;
        ctx.globalAlpha = 0.05 + 0.035 * Math.sin(now / 900 + k * 1.7);
        ctx.beginPath(); ctx.ellipse(dx, dy, 22 + k * 5, 6 + k, 0, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
    ctx.restore();
  }

  function draw() {
    if (destroyed) return;
    const now = performance.now(); const sc = cv.width / ARENA;
    let ox = 0, oy = 0;
    if (shakeMag > 0.3 && !A.reduceFx) { ox = (Math.random() * 2 - 1) * shakeMag; oy = (Math.random() * 2 - 1) * shakeMag; shakeMag *= 0.86; } else shakeMag = 0;
    ctx.setTransform(sc, 0, 0, sc, ox * sc, oy * sc);
    ctx.fillStyle = TH.bg; ctx.fillRect(0, 0, ARENA, ARENA);
    if (snap && snap.grid) {
      ensureTerrain(); ctx.drawImage(terrainCv, 0, 0, ARENA, ARENA);   // décor statique pré-rendu (sol + murs + bordure + boue : 1 drawImage au lieu de ~500 tracés)
      if (!A.reduceFx) { ctx.save(); ctx.fillStyle = 'rgb(214,196,150)'; for (const d of AMB_DUST) { const x = (d.ph * 100 + now / 1000 * d.v) % ARENA, y = d.y * ARENA + Math.sin(now / 1400 + d.ph) * d.a; ctx.globalAlpha = 0.06 + 0.05 * Math.sin(now / 800 + d.ph); ctx.beginPath(); ctx.arc(x, y, d.r, 0, Math.PI * 2); ctx.fill(); } ctx.restore(); }   // poussière portée par le vent
      // cratères (murs détruits) : taches sombres + éclats, persistants jusqu'à la fin de la manche
      if (craters.length) { ctx.save(); for (const cr of craters) { const x = (cr.gx + 0.5) * BLK, y = (cr.gy + 0.5) * BLK, r1 = Math.abs(Math.sin(cr.gx * 13.3 + cr.gy * 7.7)), r2 = Math.abs(Math.sin(cr.gx * 5.1 + cr.gy * 11.9)); ctx.globalAlpha = 0.30; ctx.fillStyle = '#1c1910'; ctx.beginPath(); ctx.arc(x + (r1 - 0.5) * 8, y + (r2 - 0.5) * 8, 7 + r1 * 4, 0, Math.PI * 2); ctx.arc(x - (r2 - 0.5) * 9, y + (r1 - 0.5) * 6, 5 + r2 * 3, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 0.22; ctx.fillStyle = '#6b522e'; ctx.fillRect(x - 8 + r1 * 10, y - 6 + r2 * 8, 3.5, 2); ctx.fillRect(x + 2 - r2 * 8, y + 4 - r1 * 6, 3, 2); } ctx.restore(); }
      // traces de chenilles : deux pointillés parallèles qui s'estompent (~5 s)
      if (!A.reduceFx && tracks.length) { ctx.save(); ctx.fillStyle = '#3a3424'; for (let i = tracks.length - 1; i >= 0; i--) { const tr = tracks[i], age = (now - tr.born) / 5000; if (age >= 1) { tracks.splice(i, 1); continue; } ctx.globalAlpha = 0.16 * (1 - age); const pxp = -Math.sin(tr.a) * 5, pyp = Math.cos(tr.a) * 5; ctx.fillRect(tr.x + pxp - 1.5, tr.y + pyp - 1.5, 3, 3); ctx.fillRect(tr.x - pxp - 1.5, tr.y - pyp - 1.5, 3, 3); } ctx.restore(); }
      // barils explosifs (la boue est dans le pré-rendu)
      (snap.barrels || []).forEach(b => { ctx.save(); ctx.translate(b.x, b.y); const r = 11; ctx.shadowColor = '#000'; ctx.shadowBlur = 4 * FX; ctx.fillStyle = '#b5532a'; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0; ctx.strokeStyle = '#3a1d0e'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.moveTo(-r + 1, -r * 0.32); ctx.lineTo(r - 1, -r * 0.32); ctx.moveTo(-r + 1, r * 0.32); ctx.lineTo(r - 1, r * 0.32); ctx.stroke(); ctx.fillStyle = '#ffd23f'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('!', 0, 1); ctx.restore(); });
      // power-ups
      (snap.pickups || []).forEach(k => { const d = PU[k.t] || { i: '?', c: '#fff' }, pulse = 1 + 0.1 * Math.sin(now / 200); ctx.save(); ctx.shadowColor = d.c; ctx.shadowBlur = 12 * FX; ctx.fillStyle = d.c + '22'; ctx.strokeStyle = d.c; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(k.x, k.y, 13 * pulse, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.shadowBlur = 0; ctx.restore(); if (TANK_VECT[k.t]) drawTankIcon(k.t, k.x, k.y, 11, d.c); else { ctx.save(); ctx.fillStyle = d.c; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(d.i, k.x, k.y + 1); ctx.restore(); } });
      // mines
      (snap.mines || []).forEach(mn => { const col = colSeat(mn.o); ctx.save(); ctx.fillStyle = mn.armed ? '#ff5a5a' : '#888'; ctx.globalAlpha = mn.armed ? 0.6 + 0.4 * Math.sin(now / 120) : 0.6; ctx.beginPath(); ctx.arc(mn.x, mn.y, 6, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.7; ctx.stroke(); ctx.restore(); });
      // tanks
      const tv = viewTanks(now);
      const me = mySeat >= 0 ? snap.players[mySeat] : null, myRadar = !!(me && me.radar);
      snap.players.forEach(p => {
        if (!p.playing || !p.alive) return;
        const t = (tv && tv[p.seat]) || p, col = colSeat(p.seat);
        // 👁 Camouflage : le tank disparaît VRAIMENT de l'écran des adversaires. Il était affiché à
        // 10 % d'opacité, donc encore parfaitement repérable — le bonus ne servait à rien. Restent
        // seuls à le voir : lui-même, ses coéquipiers, et le porteur du 📡 radar.
        let alpha = 1;
        if (p.camo) { if (p.seat === mySeat) alpha = 0.5; else { const enemy = !teamMode || (me && p.team !== me.team); alpha = (enemy && !myRadar) ? 0 : 0.5; } }
        // Les traces au SOL restent visibles même pour un tank invisible : poussière, boue et chenilles
        // sont la réaction du terrain, pas le tank lui-même. C'est le seul moyen de le pister, et ça
        // évite que le camouflage soit une disparition pure et simple.
        if (!A.reduceFx) {
          const lp = lastPos[p.seat];
          const boue = (snap.mud || []).indexOf(Math.floor(t.y / BLK) * G + Math.floor(t.x / BLK)) >= 0;
          if (lp && Math.hypot(t.x - lp.x, t.y - lp.y) > 0.6 && Math.random() < (boue ? 0.85 : 0.5)) puffs.push({ x: t.x - Math.cos(t.angle) * TANK_R, y: t.y - Math.sin(t.angle) * TANK_R, vx: (Math.random() * 2 - 1) * 0.3, vy: (Math.random() * 2 - 1) * 0.3 - 0.15, born: now, life: 340 + Math.random() * 220, r0: 3 + Math.random() * 3, col: boue ? '96,68,32' : '210,190,140' }); // poussière, plus dense et plus sombre dans la boue
          if (alpha > 0.3 && p.lives <= 1 && Math.random() < 0.12) puffs.push({ x: t.x + (Math.random() * 2 - 1) * 4, y: t.y - TANK_R * 0.4, vx: (Math.random() * 2 - 1) * 0.2, vy: -0.5 - Math.random() * 0.4, born: now, life: 600 + Math.random() * 400, r0: 3 + Math.random() * 3, col: '70,70,76' }); // fumée : vient du tank, pas du sol -> pas de fumée si camouflé
          if (lp && Math.hypot(t.x - lp.x, t.y - lp.y) > 1.2) { tracks.push({ x: t.x, y: t.y, a: t.angle, born: now }); if (tracks.length > 160) tracks.shift(); }   // traces de chenilles
          lastPos[p.seat] = { x: t.x, y: t.y };
        }
        if (alpha <= 0) return;                      // camouflé : ni caisse, ni nom, ni barre de vie — seuls ses obus et ses traces le trahissent
        ctx.save(); ctx.translate(t.x, t.y); ctx.rotate(t.angle);
        ctx.globalAlpha = alpha;
        if (p.invuln) ctx.globalAlpha *= 0.35 + 0.35 * Math.sin(now / 60);
        ctx.shadowColor = col; ctx.shadowBlur = 10 * FX; ctx.fillStyle = col;
        ctx.fillRect(-TANK_R, -TANK_R * 0.8, TANK_R * 2, TANK_R * 1.6);
        const pat = seatPattern(ctx, p.seat, { size: TANK_R });   // motif de siège sur la caisse (repère local : il tourne avec le tank)
        if (pat) { ctx.save(); ctx.shadowBlur = 0; ctx.fillStyle = pat; ctx.fillRect(-TANK_R, -TANK_R * 0.8, TANK_R * 2, TANK_R * 1.6); ctx.restore(); }
        ctx.fillStyle = '#fff'; ctx.globalAlpha *= 0.9; ctx.fillRect(TANK_R * 0.2, -2.5, TANK_R + 6, 5);
        ctx.restore();
        if (p.shield && alpha > 0.2) { ctx.save(); ctx.strokeStyle = '#7fd1ff'; ctx.shadowColor = '#7fd1ff'; ctx.shadowBlur = 12 * FX; ctx.globalAlpha = 0.6 + 0.3 * Math.sin(now / 200); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(t.x, t.y, TANK_R + 5, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
        if (p.emp && alpha > 0.2) { ctx.save(); ctx.strokeStyle = '#9fe6ff'; ctx.globalAlpha = 0.5 + 0.5 * Math.sin(now / 40); ctx.lineWidth = 2; for (let k = 0; k < 4; k++) { const a = now / 80 + k * Math.PI / 2; ctx.beginPath(); ctx.moveTo(t.x + Math.cos(a) * (TANK_R + 2), t.y + Math.sin(a) * (TANK_R + 2)); ctx.lineTo(t.x + Math.cos(a) * (TANK_R + 9), t.y + Math.sin(a) * (TANK_R + 9)); ctx.stroke(); } ctx.restore(); } // étourdi (EMP)
        if (myRadar && p.seat !== mySeat && (!teamMode || (me && p.team !== me.team))) { ctx.save(); ctx.strokeStyle = '#7ff0bd'; ctx.globalAlpha = 0.4 + 0.3 * Math.sin(now / 150); ctx.setLineDash([4, 4]); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(t.x, t.y, TANK_R + 7, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); } // détecté au radar
        if (p.seat === mySeat) { ctx.save(); ctx.strokeStyle = '#fff'; ctx.globalAlpha = 0.5 + 0.4 * Math.sin(now / 220); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(t.x, t.y, TANK_R + 3, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
        if (alpha > 0.3) { const MAXL = 3, bw = TANK_R * 2, bh = 3, bx0 = t.x - bw / 2, by0 = t.y - TANK_R - 8, seg = bw / MAXL; ctx.save(); ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(bx0 - 1, by0 - 1, bw + 2, bh + 2); for (let l = 0; l < MAXL; l++) { ctx.fillStyle = l < p.lives ? (p.lives === 1 ? '#ff5a5a' : col) : 'rgba(255,255,255,0.16)'; ctx.fillRect(bx0 + l * seg + 0.5, by0, seg - 1, bh); } ctx.restore(); } // barre de vie
      });
      // obus
      (snap.shells || []).forEach(s => {
        const col = s.h ? '#ff6a6a' : (s.p ? '#ff9be0' : colSeat(s.o));
        if (!A.reduceFx && (s.vx || s.vy)) { const m = Math.hypot(s.vx, s.vy) || 1; ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = col; ctx.globalAlpha = 0.4; ctx.lineWidth = SHELL_R * 1.3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x - s.vx / m * 14, s.y - s.vy / m * 14); ctx.stroke(); ctx.restore(); } // traînée d'obus
        ctx.save(); ctx.shadowColor = col; ctx.shadowBlur = 12 * FX; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(s.x, s.y, SHELL_R, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = col; ctx.globalAlpha = 0.6; ctx.beginPath(); ctx.arc(s.x, s.y, SHELL_R + (s.p ? 2.5 : 1.5), 0, Math.PI * 2); ctx.fill(); ctx.restore();
      });
    }
    if (!A.reduceFx) { ctx.save(); for (let i = puffs.length - 1; i >= 0; i--) { const q = puffs[i], tt = (now - q.born) / q.life; if (tt >= 1) { puffs.splice(i, 1); continue; } q.x += q.vx; q.y += q.vy; ctx.globalAlpha = (1 - tt) * 0.5; ctx.fillStyle = `rgb(${q.col})`; ctx.beginPath(); ctx.arc(q.x, q.y, q.r0 + tt * 5, 0, Math.PI * 2); ctx.fill(); } ctx.restore(); } else puffs.length = 0;
    if (!A.reduceFx) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; for (let i = particles.length - 1; i >= 0; i--) { const q = particles[i], t = (now - q.born) / q.life; if (t >= 1) { particles.splice(i, 1); continue; } q.x += q.vx; q.y += q.vy; q.vx *= 0.95; q.vy *= 0.95; ctx.globalAlpha = 1 - t; ctx.fillStyle = q.color; ctx.beginPath(); ctx.arc(q.x, q.y, 2.5 * (1 - t) + 0.5, 0, Math.PI * 2); ctx.fill(); } ctx.restore(); } else particles.length = 0;

    // jauge de munitions (joueur local) : pastilles = obus disponibles (MAX 2)
    const meTk = (snap && mySeat >= 0) ? snap.players[mySeat] : null;
    if (meTk && meTk.playing && meTk.alive && snap.gs === 'play') {
      const MAXS = 2, used = (snap.shells || []).filter(s => s.o === mySeat).length, avail = Math.max(0, MAXS - used);
      const r = 5, gap = 7, total = MAXS * (r * 2) + (MAXS - 1) * gap, x0 = (ARENA - total) / 2 + r, y = ARENA - 16;
      ctx.save();
      for (let i = 0; i < MAXS; i++) {
        const cxp = x0 + i * (r * 2 + gap);
        ctx.beginPath(); ctx.arc(cxp, y, r, 0, Math.PI * 2);
        if (i < avail) { ctx.fillStyle = '#ffd36e'; ctx.shadowColor = '#ffd36e'; ctx.shadowBlur = A.reduceFx ? 0 : 8; ctx.fill(); }
        else { ctx.shadowBlur = 0; ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1; ctx.stroke(); }
      }
      ctx.shadowBlur = 0; ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.font = '10px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.fillText('MUNITIONS', ARENA / 2, y - r - 3);
      ctx.restore();
    }

    if (snap && snap.gs === 'countdown') { ctx.fillStyle = 'rgba(4,5,12,0.34)'; ctx.fillRect(0, 0, ARENA, ARENA); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; const c = snap.count || 0, pulse = 1 + 0.08 * Math.sin(now / 110); ctx.save(); ctx.translate(ARENA / 2, ARENA / 2 - 4); ctx.scale(pulse, pulse); if (!A.reduceFx) { ctx.shadowColor = 'rgba(255,180,120,.7)'; ctx.shadowBlur = 26; } ctx.fillStyle = '#fff'; ctx.font = 'bold 96px system-ui,sans-serif'; ctx.fillText(c > 0 ? c : 'FEU', 0, 0); ctx.restore(); ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.font = '13px system-ui,sans-serif'; ctx.fillText('Chargement des canons…', ARENA / 2, ARENA / 2 + 66); }
    if (snap && (snap.gs === 'lobby' || snap.gs === 'paused')) {
      ctx.fillStyle = 'rgba(4,5,12,0.66)'; ctx.fillRect(0, 0, ARENA, ARENA); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      if (snap.gs === 'paused') { ctx.fillStyle = '#fff'; ctx.font = 'bold 34px system-ui,sans-serif'; ctx.fillText('PAUSE', ARENA / 2, ARENA / 2 - 6); ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.font = '14px system-ui,sans-serif'; ctx.fillText('P / Échap pour reprendre', ARENA / 2, ARENA / 2 + 28); }
      else { drawTitle(ARENA / 2, ARENA / 2 - 60, now); const n = snap.connected, nb = snap.botCount || 0, tot = n + nb; ctx.fillStyle = teamMode ? '#9fd0ff' : 'rgba(255,255,255,.7)'; ctx.font = '15px system-ui,sans-serif'; ctx.fillText(`${n} pilote${n > 1 ? 's' : ''}${nb ? ' + ' + nb + ' bot' + (nb > 1 ? 's' : '') : ''}${teamMode ? ' · ' + (MODE_NAME[snap.mode] || snap.mode) : ''} · ${snap.winTarget === 1 ? '1 manche' : snap.winTarget + ' manches'}`, ARENA / 2, ARENA / 2 - 6); ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.font = 'bold 13px system-ui,sans-serif'; ctx.fillText(tot >= 2 ? '▶ Espace / clic pour lancer' : 'En attente d\'un 2ᵉ pilote… (ou ajoute un bot 🤖)', ARENA / 2, ARENA / 2 + 24); }
    }
  }
  function drawLoop() { if (destroyed) return; try { draw(); } catch (e) { console.error('[render]', e); } rafId = requestAnimationFrame(drawLoop); }   // filet : une erreur de rendu ne fige plus le jeu

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
  function teardown() { destroyed = true; music.stop(); cancelAnimationFrame(rafId); removeEventListener('resize', resizeH); removeEventListener('keydown', onKeyDown); removeEventListener('keyup', onKeyUp); removeEventListener('blur', onBlur); }

  return { init, onState, onMessage, onLb, onA11y, teardown };
})();
