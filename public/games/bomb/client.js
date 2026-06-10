// Module client BOMBERMAN v2 : équipes, bonus/malus, portée + compte à rebours visibles, mort subite.
import { GW, GH, CELL, ARENA } from './shared.js';
import { createMusic } from '../../music.js';

// musique : cartoon enjoué — basse bondissante, mélodie espiègle, woodblock ; climax (mort subite) = motif chromatique + grosse caisse + tempo
const MUSIC_THEME = { bpm: 134, bpmBoost: 16, vol: 0.48, root: 130.81, len: 32,
  stingers: { kill: { notes: [12, 7, 0], wave: 'square', oct: 0, gain: 0.04, dur: 0.15 }, win: { base: 261.63, notes: [[0, 4, 7], [5, 9, 12], [7, 12, 16]], gain: 0.035, dur: 0.3, rate: 0.13 },
    count: { notes: [0], oct: 2, wave: 'square', dur: 0.09, gain: 0.045, duck: false }, go: { notes: [[0, 4, 7]], oct: 1, dur: 0.4, gain: 0.05, duck: false }, alert: { notes: [0, 2, 4, 6, 8, 10, 12], oct: 1, wave: 'sawtooth', rate: 0.06, dur: 0.12, gain: 0.035 } },
  layers: [
  { seq: [[0, 4, 7], null, null, null, null, null, null, null, null, null, null, null, null, null, null, null], wave: 'sine', gain: 0.02, dur: 12 },
  { seq: [0, null, 7, null, 0, null, 7, null, 5, null, 12, null, 5, null, 12, null, 0, null, 7, null, 0, null, 7, null, -4, null, 3, null, 7, null, 3, null], wave: 'square', gain: 0.03, dur: 0.9, min: 1 },
  { seq: [12, null, 12, null, 7, null, null, null, 9, null, 9, null, 4, null, null, null, 12, null, 14, null, 16, null, null, null, 12, null, 9, null, 7, null, null, null], oct: 1, wave: 'square', gain: 0.016, dur: 1.1, min: 1 },
  { drums: '..H...H...H...H.', gain: 0.6, min: 1 },
  { seq: [12, 11, 12, 11, 12, null, null, null], oct: 1, wave: 'triangle', gain: 0.022, dur: 0.8, min: 2 },
  { drums: 'K...K...K...K...', min: 2 },
] };

const PAL = { normal: ['#4a9ee0', '#e06240', '#2aaf7a', '#cc9010', '#9b6cf0', '#e268b0'], cb: ['#0072B2', '#E69F00', '#009E73', '#F0E442', '#CC79A7', '#56B4E9'] };
const TEAMPAL = { normal: ['#4a9ee0', '#e06240', '#2aaf7a'], cb: ['#0072B2', '#E69F00', '#009E73'] };
const TEAM_LETTER = ['A', 'B', 'C'];
const MODE_NAME = { ffa: 'Chacun pour soi', '2v2': '2 v 2', '2v2v2': '2 v 2 v 2', '3v3': '3 v 3' };
const GEN_NAMES = ['Symétrique', 'Aléatoire', '4 coins'];
const PICK_ICON = { bomb: '💣', flame: '🔥', speed: '👟', kick: '🦵', remote: '📡', ghost: '👻', throw: '🧤', shield: '🛡', line: '📏', reverse: '🔀', slow: '🐌', auto: '⏱', skull: '💀' };
// fond animé : ombres de nuages qui défilent doucement (identité cartoon) — coupé par reduceFx
const AMB_CLOUDS = Array.from({ length: 5 }, () => ({ y: 0.05 + Math.random() * 0.85, v: 5 + Math.random() * 7, s: 22 + Math.random() * 26, ph: Math.random() * 1000 }));
const INTERP_MS = 55;
const KEYMAP = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right' };
const DIRS4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
// identité visuelle propre au jeu (fixe) : Cartoon / Candy
const SKIN = { bg: '#173a2a', floor: '#2f8f5b', floor2: '#36a268', solid: '#8a93a6', solidTop: '#aab2c4', soft: '#c98a4a', softTop: '#e0b06a', round: true };

export default (function () {
  let A, send, root, cv, ctx, togglePanel = () => {}, closePanels = () => {};
  let CC = PAL.normal, TEAMCC = TEAMPAL.normal, TH = SKIN, FX = 1;
  let mySeat = -1, snap = null, prevGs = 'lobby', teamMode = false, endShown = false, inGamePrev = false, prevRound = -1, lastCount = -1, prevSd = false;
  const wallAnims = [];                                // blocs détruits : petite anim d'écrasement cartoon
  let board = [], buf = [];
  const particles = [];
  let shakeMag = 0, rafId = 0, destroyed = false, resizeH = null, actx = null;
  const music = createMusic(() => actx, () => A, MUSIC_THEME);
  const input = { up: false, down: false, left: false, right: false };
  let hud, cards, startBtn, pauseBtn, modeBtn, genBtn, ffBtn, revBtn, botsBtn, diffBtn, pauseFloat, lbBtn, lbPanel, lbBody, endEl;
  const DIFF_NAMES = ['Facile', 'Normale', 'Difficile'];

  const $ = id => root.querySelector('#' + id);
  const colSeat = s => { if (s < 0 || !snap) return '#fff'; const p = snap.players[s]; return teamMode && p ? TEAMCC[p.team] : CC[s]; };
  const cpx = c => (c + 0.5) * CELL;
  function applyColors() { CC = PAL[A.palette] || PAL.normal; TEAMCC = TEAMPAL[A.palette] || TEAMPAL.normal; FX = A.reduceFx ? 0 : 1; TH = SKIN; }
  function rrect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

  function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const playing = document.body.classList.contains('playing');
    const size = Math.max(280, Math.min(window.innerWidth * 0.96, window.innerHeight * (playing ? 0.82 : 0.62), 720));
    cv.style.width = size + 'px'; cv.style.height = size + 'px'; cv.width = Math.round(size * dpr); cv.height = Math.round(size * dpr);
  }

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
      cards[i].querySelector('.pn').innerHTML = `${p.name || ('P' + (i + 1))} <span class="sc">${p.kills} ⚡</span> ${tags.join('')}`;
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
      `<div class="lbrow"><span class="lbn">${e.name}</span><span>🎮${e.games}</span><span>🏆${e.wins}</span><span title="kills">⚡${e.kills}</span><span title="K/D">⚖${(e.deaths ? (e.kills / e.deaths).toFixed(2) : (e.kills ? '∞' : '0'))}</span><span title="meilleure survie">⏱${Math.round(e.bestSurvivalSec || 0)}s</span></div>`).join('');
  }
  function showEndscreen(m) {
    if (m.gs !== 'over' || !m.stats) { endEl.classList.add('hidden'); return; }
    endEl.classList.remove('hidden');
    const solo = m.stats.solo;
    const parts = m.players.filter(p => p.playing && p.place > 0).slice().sort((a, b) => a.place - b.place);
    const champ = m.winner >= 0 ? parts.find(p => p.team === m.winner) : null;
    const who = champ ? (teamMode ? 'Équipe ' + TEAM_LETTER[m.winner] : (champ.name || ('P' + (champ.seat + 1)))) : null;
    const title = solo ? 'Game Over' : (champ ? who + ' survit !' : 'Égalité');
    const medals = ['🥇', '🥈', '🥉'];
    const rows = parts.map(p => {
      const col = colSeat(p.seat), medal = medals[p.place - 1] || ('#' + p.place);
      const res = p.alive ? 'survivant·e' : `éliminé à ${Math.round((p.elimTick || 0) / 30)}s`;
      return `<div class="erow ${p.alive ? 'win' : ''}"><span class="eplace">${medal}</span>
        <span class="ename" style="color:${col}">${p.name || ('P' + (p.seat + 1))}${teamMode ? ` <small>Éq.${TEAM_LETTER[p.team]}</small>` : ''}</span>
        <span class="estat">⚡ ${p.kills}</span><span class="eres">${res}</span></div>`;
    }).join('');
    endEl.innerHTML = `<div class="etitle" style="color:${champ ? colSeat(m.winner) : '#fff'}">${title}</div>
      <div class="emeta">⏱ ${m.stats.durationSec}s · ${m.stats.nParts} joueur${m.stats.nParts > 1 ? 's' : ''}</div><div class="elist">${rows}</div><div class="ehint">Espace / clic pour rejouer</div>`;
  }

  function onMessage(m) { if (m && m.t === 'welcome') mySeat = m.seat; }
  function onLb(d) { board = d.board || []; renderLB(); }
  function onState(m) {
    if (m.grid === undefined && snap) m.grid = snap.grid;   // delta réseau : grille absente = inchangée
    snap = m; teamMode = m.mode && m.mode !== 'ffa';
    const inGame = m.gs === 'play' || m.gs === 'countdown' || m.gs === 'paused';
    if (inGame !== inGamePrev) { inGamePrev = inGame; document.body.classList.toggle('playing', inGame); resizeCanvas(); }
    document.body.classList.toggle('paused', m.gs === 'paused');
    if (m.gs === 'play' || m.gs === 'countdown') closePanels();
    if (m.round !== prevRound) { prevRound = m.round; buf = []; particles.length = 0; }
    buf.push({ t: performance.now(), s: m }); if (buf.length > 10) buf.shift();
    (m.fx || []).forEach(playFx);
    if (prevGs !== 'over' && m.gs === 'over') { sound('win'); music.sting('win'); }
    if (m.gs === 'countdown' && m.count > 0 && m.count !== lastCount) music.sting('count');   // décompte musical 3·2·1
    if (prevGs === 'countdown' && m.gs === 'play') music.sting('go');
    lastCount = m.count;
    if (m.sd && !prevSd) music.sting('alert'); prevSd = !!m.sd;                                // riser : mort subite
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
    modeBtn.disabled = !(idle && (total === 4 || total === 6)); modeBtn.textContent = '⚔ ' + (MODE_NAME[m.mode] || m.mode); modeBtn.classList.toggle('on', teamMode);
    genBtn.disabled = !idle; genBtn.textContent = '🧱 ' + (GEN_NAMES[m.gen] || 'Map');
    ffBtn.disabled = !(idle && teamMode); ffBtn.textContent = '🤝 Tir allié : ' + (m.ff ? 'ON' : 'OFF'); ffBtn.classList.toggle('on', !!m.ff);
    if (revBtn) { revBtn.disabled = !idle; revBtn.textContent = '☠ Revanche : ' + (m.revenge ? 'ON' : 'OFF'); revBtn.classList.toggle('on', !!m.revenge); }
  }

  function unlockAudio() { if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch {} } if (actx && actx.state === 'suspended') actx.resume(); }
  let sndPan = 0;                                   // pan stéréo du prochain son
  function tone(f, d, ty = 'square', g = 0.05, dl = 0) { const _v = (A && typeof A.sfx === 'number') ? A.sfx : 1; if (!actx || _v <= 0) return; const t0 = actx.currentTime + dl, o = actx.createOscillator(), gg = actx.createGain(); o.type = ty; o.frequency.setValueAtTime(f, t0); gg.gain.setValueAtTime(g * _v, t0); gg.gain.exponentialRampToValueAtTime(0.0001, t0 + d); o.connect(gg); let dest = actx.destination; if (sndPan && actx.createStereoPanner) { const pn = actx.createStereoPanner(); pn.pan.value = Math.max(-1, Math.min(1, sndPan)); pn.connect(actx.destination); dest = pn; } gg.connect(dest); o.start(t0); o.stop(t0 + d); }
  function psound(k, gx) { sndPan = Math.max(-1, Math.min(1, (cpx(gx) / ARENA - 0.5) * 1.7)); sound(k); sndPan = 0; }   // son positionné gauche/droite
  function sound(k) { if (!actx) return; if (k === 'place') tone(330, 0.05, 'square', 0.03); else if (k === 'wall') tone(240, 0.07, 'square', 0.04); else if (k === 'pickup') { tone(660, 0.07, 'square', 0.05); tone(880, 0.08, 'square', 0.05, 0.06); } else if (k === 'bad') { tone(300, 0.1, 'sawtooth', 0.05); tone(180, 0.18, 'sawtooth', 0.05, 0.08); } else if (k === 'boom') { tone(140, 0.28, 'sawtooth', 0.07); tone(70, 0.34, 'sawtooth', 0.05, 0.05); } else if (k === 'win') { tone(523, 0.18, 'triangle', 0.06); tone(659, 0.18, 'triangle', 0.06, 0.12); tone(784, 0.3, 'triangle', 0.06, 0.24); } }
  function playFx(f) {
    if (f.type === 'place' || f.type === 'throw') return psound('place', f.x);
    if (f.type === 'wall') { psound('wall', f.x); if (!A.reduceFx) { wallAnims.push({ x: f.x, y: f.y, born: performance.now() }); if (wallAnims.length > 30) wallAnims.shift(); } return; }
    if (f.type === 'guard' || f.type === 'warp') return sound('pickup');
    if (f.type === 'spawn') { sound('pickup'); if (!A.reduceFx) { const x = cpx(f.x), y = cpx(f.y), now = performance.now(); for (let k = 0; k < 14; k++) { const a = Math.random() * Math.PI * 2, sp = 1 + Math.random() * 3.2; particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, born: now, life: 320 + Math.random() * 220, color: colSeat(f.seat) }); } } return; } // retour de revanche
    if (f.type === 'drop') { if (!A.reduceFx) shakeMag = Math.max(shakeMag, 4); return; }
    if (f.type === 'pickup') return sound(f.bad ? 'bad' : 'pickup');
    if (f.type === 'boom') { psound('boom', f.x); music.sting('kill'); if (A.reduceFx) return; shakeMag = Math.max(shakeMag, 6); const col = colSeat(f.seat), now = performance.now(), x = cpx(f.x), y = cpx(f.y); for (let k = 0; k < 16; k++) { const a = Math.random() * Math.PI * 2, sp = 1 + Math.random() * 4; particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, born: now, life: 380 + Math.random() * 240, color: col }); } }
  }
  function viewPlayers(now) {
    if (buf.length === 0) return null;
    const target = now - INTERP_MS; let a = buf[0], b = buf[buf.length - 1];
    for (let i = 0; i < buf.length; i++) if (buf[i].t <= target) a = buf[i];
    for (let i = buf.length - 1; i >= 0; i--) if (buf[i].t >= target) b = buf[i];
    const span = b.t - a.t; let al = span > 0 ? (target - a.t) / span : 0; al = al < 0 ? 0 : al > 1 ? 1 : al;
    const out = {};
    b.s.players.forEach(pb => { if (!pb.playing) return; const pa = a.s.players[pb.seat]; let x = pb.x, y = pb.y; if (pa && pa.playing && Math.hypot(pb.x - pa.x, pb.y - pa.y) < 60) { x = pa.x + (pb.x - pa.x) * al; y = pa.y + (pb.y - pa.y) * al; } out[pb.seat] = { x, y }; });
    return out;
  }
  function drawPickIcon(t, x, y, s) {                 // glyphes vectoriels des bonus/malus (rendu identique sur tous les OS, contrairement aux emoji)
    ctx.save(); ctx.translate(x, y); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const k = s / 10;
    if (t === 'bomb') { ctx.fillStyle = '#1a1a22'; ctx.beginPath(); ctx.arc(0, 1.5 * k, 6 * k, 0, 6.29); ctx.fill(); ctx.strokeStyle = '#caa64a'; ctx.lineWidth = 1.6 * k; ctx.beginPath(); ctx.moveTo(2 * k, -3 * k); ctx.quadraticCurveTo(5 * k, -6 * k, 7 * k, -5 * k); ctx.stroke(); ctx.fillStyle = '#ffd36e'; ctx.beginPath(); ctx.arc(7 * k, -5 * k, 1.8 * k, 0, 6.29); ctx.fill(); }
    else if (t === 'flame') { ctx.fillStyle = '#ff8a3a'; ctx.beginPath(); ctx.moveTo(0, -7 * k); ctx.quadraticCurveTo(6 * k, -2 * k, 4 * k, 3 * k); ctx.quadraticCurveTo(3 * k, 6.5 * k, 0, 7 * k); ctx.quadraticCurveTo(-3 * k, 6.5 * k, -4 * k, 3 * k); ctx.quadraticCurveTo(-6 * k, -2 * k, 0, -7 * k); ctx.fill(); ctx.fillStyle = '#ffd36e'; ctx.beginPath(); ctx.arc(0, 3 * k, 2.6 * k, 0, 6.29); ctx.fill(); }
    else if (t === 'speed') { ctx.strokeStyle = '#7ff0bd'; ctx.lineWidth = 2.2 * k; for (const o of [-3, 2]) { ctx.beginPath(); ctx.moveTo((o - 2) * k, -5 * k); ctx.lineTo((o + 3) * k, 0); ctx.lineTo((o - 2) * k, 5 * k); ctx.stroke(); } }
    else if (t === 'kick') { ctx.strokeStyle = '#ffd76b'; ctx.lineWidth = 2.2 * k; ctx.beginPath(); ctx.moveTo(-2 * k, -6 * k); ctx.lineTo(-2 * k, 2 * k); ctx.stroke(); ctx.fillStyle = '#ffd76b'; ctx.fillRect(-3 * k, 2 * k, 7.5 * k, 3 * k); }
    else if (t === 'remote') { ctx.fillStyle = '#9fe6ff'; ctx.beginPath(); ctx.arc(0, 3 * k, 1.8 * k, 0, 6.29); ctx.fill(); ctx.strokeStyle = '#9fe6ff'; ctx.lineWidth = 1.5 * k; for (const r of [4, 6.5]) { ctx.beginPath(); ctx.arc(0, 3 * k, r * k, -2.3, -0.85); ctx.stroke(); } }
    else if (t === 'ghost') { ctx.fillStyle = '#e8ecff'; ctx.beginPath(); ctx.arc(0, -0.5 * k, 5 * k, Math.PI, 0); ctx.lineTo(5 * k, 4 * k); ctx.arc(3.3 * k, 4 * k, 1.7 * k, 0, Math.PI); ctx.arc(0, 4 * k, 1.7 * k, 0, Math.PI); ctx.arc(-3.3 * k, 4 * k, 1.7 * k, 0, Math.PI); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#3a3f55'; ctx.beginPath(); ctx.arc(-1.8 * k, -1 * k, 1 * k, 0, 6.29); ctx.arc(1.8 * k, -1 * k, 1 * k, 0, 6.29); ctx.fill(); }
    else if (t === 'throw') { ctx.strokeStyle = '#ffb1d8'; ctx.lineWidth = 2 * k; ctx.beginPath(); ctx.arc(0, 0, 5 * k, 2.2, 4.6); ctx.stroke(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(3.4 * k, -2.6 * k, 2.4 * k, 0, 6.29); ctx.fill(); }
    else if (t === 'shield') { ctx.fillStyle = '#7fd1ff'; ctx.beginPath(); ctx.moveTo(0, -6.5 * k); ctx.lineTo(5.5 * k, -4 * k); ctx.lineTo(5 * k, 2 * k); ctx.quadraticCurveTo(3 * k, 6 * k, 0, 7 * k); ctx.quadraticCurveTo(-3 * k, 6 * k, -5 * k, 2 * k); ctx.lineTo(-5.5 * k, -4 * k); ctx.closePath(); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 1.2 * k; ctx.beginPath(); ctx.moveTo(0, -4 * k); ctx.lineTo(0, 4.5 * k); ctx.stroke(); }
    else if (t === 'line') { ctx.fillStyle = '#1a1a22'; for (const o of [-5, 0, 5]) { ctx.beginPath(); ctx.arc(o * k, 0, 2.2 * k, 0, 6.29); ctx.fill(); } }
    else if (t === 'reverse') { ctx.strokeStyle = '#ff5a5a'; ctx.lineWidth = 2 * k; ctx.beginPath(); ctx.arc(0, 0, 5 * k, -0.6, 2.2); ctx.stroke(); ctx.fillStyle = '#ff5a5a'; ctx.beginPath(); ctx.moveTo(5.8 * k, -4.4 * k); ctx.lineTo(2.2 * k, -3.4 * k); ctx.lineTo(5 * k, -0.8 * k); ctx.closePath(); ctx.fill(); }
    else if (t === 'slow') { ctx.strokeStyle = '#ff9b6b'; ctx.lineWidth = 1.8 * k; ctx.beginPath(); for (let a = 0; a < 12; a += 0.4) { const r = a * 0.42 * k; const px2 = Math.cos(a) * r, py2 = Math.sin(a) * r; a === 0 ? ctx.moveTo(px2, py2) : ctx.lineTo(px2, py2); } ctx.stroke(); }
    else if (t === 'auto') { ctx.strokeStyle = '#ff5a5a'; ctx.lineWidth = 1.8 * k; ctx.beginPath(); ctx.arc(0, 0, 5.5 * k, 0, 6.29); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -3.6 * k); ctx.moveTo(0, 0); ctx.lineTo(2.6 * k, 1.4 * k); ctx.stroke(); }
    else if (t === 'skull') { ctx.fillStyle = '#f2f4ff'; ctx.beginPath(); ctx.arc(0, -1.2 * k, 4.8 * k, 0, 6.29); ctx.fill(); ctx.fillRect(-2.6 * k, 1.5 * k, 5.2 * k, 4 * k); ctx.fillStyle = '#272b3c'; ctx.beginPath(); ctx.arc(-1.9 * k, -1.6 * k, 1.4 * k, 0, 6.29); ctx.arc(1.9 * k, -1.6 * k, 1.4 * k, 0, 6.29); ctx.fill(); ctx.fillRect(-1.8 * k, 3.2 * k, 1.1 * k, 2 * k); ctx.fillRect(0.7 * k, 3.2 * k, 1.1 * k, 2 * k); }
    else { ctx.fillStyle = '#fff'; ctx.font = `${Math.round(8 * k)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('?', 0, 0); }
    ctx.restore();
  }
  function rangeCells(g, bx, by, power) {                 // prévisualisation de portée (s'arrête comme le serveur)
    const out = [];
    for (const [dx, dy] of DIRS4) for (let r = 1; r <= power; r++) {
      const gx = bx + dx * r, gy = by + dy * r; if (gx < 0 || gy < 0 || gx >= GW || gy >= GH) break;
      const c = g[gy * GW + gx]; if (c === '1') break; out.push([gx, gy]); if (c === '2') break;
    }
    return out;
  }

  function draw() {
    if (destroyed) return;
    const now = performance.now(); const sc = cv.width / ARENA;
    let ox = 0, oy = 0;
    if (shakeMag > 0.3 && !A.reduceFx) { ox = (Math.random() * 2 - 1) * shakeMag; oy = (Math.random() * 2 - 1) * shakeMag; shakeMag *= 0.86; } else shakeMag = 0;
    ctx.setTransform(sc, 0, 0, sc, ox * sc, oy * sc);
    ctx.fillStyle = TH.bg; ctx.fillRect(0, 0, ARENA, ARENA);
    if (snap && snap.grid) {
      const g = snap.grid;
      for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) {
        const c = g[gy * GW + gx], x = gx * CELL, y = gy * CELL;
        ctx.fillStyle = ((gx + gy) & 1) ? TH.floor : TH.floor2; ctx.fillRect(x, y, CELL, CELL);
        if (c === '1') {
          if (TH.round) { ctx.fillStyle = TH.solid; rrect(x + 2, y + 2, CELL - 4, CELL - 4, 6); ctx.fill(); ctx.fillStyle = TH.solidTop || 'rgba(255,255,255,0.12)'; ctx.fillRect(x + 6, y + 5, CELL - 12, 3); } // pierre arrondie (cartoon)
          else { ctx.fillStyle = TH.solid; ctx.fillRect(x + 1, y + 1, CELL - 2, CELL - 2); ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fillRect(x + 1, y + 1, CELL - 2, 4); }
        }
        else if (c === '2') {
          if (TH.round) { ctx.fillStyle = TH.soft; rrect(x + 3, y + 3, CELL - 6, CELL - 6, 5); ctx.fill(); ctx.fillStyle = TH.softTop; ctx.fillRect(x + 7, y + 6, CELL - 14, 3); ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 1.5; rrect(x + 3, y + 3, CELL - 6, CELL - 6, 5); ctx.stroke(); } // caisse bois arrondie
          else { ctx.fillStyle = TH.soft; ctx.fillRect(x + 2, y + 2, CELL - 4, CELL - 4); ctx.fillStyle = TH.softTop; ctx.fillRect(x + 2, y + 2, CELL - 4, 5); ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth = 1; ctx.strokeRect(x + 2.5, y + 2.5, CELL - 5, CELL - 5); }
        }
        else if (c === '3') {                                       // téléporteur (portail)
          const cxp = x + CELL / 2, cyp = y + CELL / 2, ph = A.reduceFx ? 1 : 1 + 0.12 * Math.sin(now / 200 + gx + gy), rot = A.reduceFx ? 0 : now / 600;
          ctx.save(); if (!A.reduceFx) { ctx.shadowColor = '#b98bff'; ctx.shadowBlur = 12; }
          for (let r = 0; r < 3; r++) { ctx.strokeStyle = `rgba(${185 - r * 30},${139},${240},${0.8 - r * 0.22})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cxp, cyp, (CELL * 0.13 + r * CELL * 0.11) * ph, rot + r, rot + r + Math.PI * 1.5); ctx.stroke(); }
          ctx.restore();
        }
      }
      if (!A.reduceFx) { ctx.save(); ctx.fillStyle = '#fff'; for (const cl of AMB_CLOUDS) { const x = (cl.ph + now / 1000 * cl.v) % (ARENA + cl.s * 3) - cl.s * 1.5, y = cl.y * ARENA; ctx.globalAlpha = 0.05; ctx.beginPath(); ctx.ellipse(x, y, cl.s, cl.s * 0.42, 0, 0, Math.PI * 2); ctx.ellipse(x + cl.s * 0.6, y - cl.s * 0.18, cl.s * 0.6, cl.s * 0.3, 0, 0, Math.PI * 2); ctx.ellipse(x - cl.s * 0.6, y + cl.s * 0.08, cl.s * 0.55, cl.s * 0.26, 0, 0, Math.PI * 2); ctx.fill(); } ctx.restore(); }   // nuages doux qui défilent
      // blocs détruits : écrasement cartoon (squash & stretch ~240 ms)
      for (let i = wallAnims.length - 1; i >= 0; i--) { const w = wallAnims[i], t2 = (now - w.born) / 240; if (t2 >= 1) { wallAnims.splice(i, 1); continue; } const sq = Math.max(0.05, 1 - t2); ctx.save(); ctx.globalAlpha = 1 - t2 * 0.6; ctx.translate(w.x * CELL + CELL / 2, w.y * CELL + CELL - 3); ctx.scale(1 + 0.55 * t2, sq); ctx.translate(-CELL / 2, -(CELL - 6)); ctx.fillStyle = TH.soft; rrect(3, 3, CELL - 6, CELL - 6, 5); ctx.fill(); ctx.restore(); }
      // prévisualisation de portée des bombes
      (snap.bombs || []).forEach(b => {
        const danger = b.f <= 30;                                   // mèche < ~1 s : on alerte
        const a = danger ? (A.reduceFx ? 0.3 : 0.14 + 0.22 * (0.5 + 0.5 * Math.sin(now / 80))) : 0.10;
        const gch = danger ? 90 : 160;
        rangeCells(g, b.x, b.y, b.p).forEach(([gx, gy]) => { ctx.fillStyle = `rgba(255,${gch},60,${a})`; ctx.fillRect(gx * CELL + 3, gy * CELL + 3, CELL - 6, CELL - 6); });
      });
      // bonus / malus
      (snap.pickups || []).forEach(pk => {
        const x = cpx(pk.x), y = cpx(pk.y), pulse = 1 + 0.08 * Math.sin(now / 220);
        ctx.save(); ctx.globalAlpha = 0.95; ctx.fillStyle = pk.b ? 'rgba(255,90,90,0.18)' : 'rgba(255,255,255,0.12)';
        ctx.beginPath(); ctx.arc(x, y, CELL * 0.34 * pulse, 0, Math.PI * 2); ctx.fill();
        if (pk.b) { ctx.strokeStyle = '#ff5a5a'; ctx.lineWidth = 1.5; ctx.stroke(); }
        ctx.restore();
        drawPickIcon(pk.t, x, y, CELL * 0.26);
      });
      // bombes + compte à rebours
      (snap.bombs || []).forEach(b => {
        const x = cpx(b.x), y = cpx(b.y), pulse = 1 + 0.16 * Math.sin(now / (60 + b.f * 3));
        ctx.save(); ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(x, y + CELL * 0.24, CELL * 0.24, CELL * 0.09, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();   // ombre portée
        ctx.save(); ctx.fillStyle = b.r ? '#243' : '#1a1a22'; ctx.shadowColor = '#000'; ctx.shadowBlur = 6;
        ctx.beginPath(); ctx.arc(x, y, CELL * 0.32 * pulse, 0, Math.PI * 2); ctx.fill();
        const fl = 0.5 + 0.5 * Math.sin(now / (40 + b.f)), sr = 2 + fl * 1.7;   // étincelle de mèche qui crépite
        ctx.save(); if (!A.reduceFx) { ctx.globalCompositeOperation = 'lighter'; ctx.shadowColor = '#ffb43b'; ctx.shadowBlur = 8; }
        ctx.fillStyle = '#ffd36e'; ctx.beginPath(); ctx.arc(x - 3, y - 4, sr, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x - 3, y - 4, sr * 0.5, 0, Math.PI * 2); ctx.fill(); ctx.restore();
        ctx.shadowBlur = 0; ctx.fillStyle = '#fff'; ctx.font = 'bold 11px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(b.r ? '📡' : ('' + Math.max(1, Math.ceil(b.f / 30))), x, y + 0.5); ctx.restore();
      });
      // explosions
      (snap.blasts || []).forEach(bl => { const x = bl.x * CELL, y = bl.y * CELL, fl = 0.5 + 0.5 * Math.sin(now / 40 + bl.x + bl.y); ctx.save(); ctx.globalCompositeOperation = A.reduceFx ? 'source-over' : 'lighter'; ctx.fillStyle = `rgba(255,${140 + fl * 80 | 0},40,${A.reduceFx ? 0.7 : 0.55})`; ctx.fillRect(x + 2, y + 2, CELL - 4, CELL - 4); ctx.fillStyle = `rgba(255,255,200,${A.reduceFx ? 0.5 : 0.4})`; ctx.fillRect(x + CELL * 0.28, y + CELL * 0.28, CELL * 0.44, CELL * 0.44); ctx.restore(); });
      // joueurs
      const pv = viewPlayers(now);
      snap.players.forEach(p => {
        if (!p.playing) return;
        if (!p.alive) {                                 // mode revanche : revenant sur le bord qui bombarde
          if (!p.rvn) return;
          const t = (pv && pv[p.seat]) || p, col = colSeat(p.seat);
          let gx = Math.floor(t.x / CELL), gy = Math.floor(t.y / CELL), ix = gx, iy = gy;
          if (gy <= 0) iy = 1; else if (gy >= GH - 1) iy = GH - 2; if (gx <= 0) ix = 1; else if (gx >= GW - 1) ix = GW - 2;
          if (p.seat === mySeat) { ctx.save(); ctx.strokeStyle = col; ctx.globalAlpha = 0.5 + 0.3 * Math.sin(now / 160); ctx.lineWidth = 2; ctx.setLineDash([4, 4]); ctx.strokeRect(ix * CELL + 3, iy * CELL + 3, CELL - 6, CELL - 6); ctx.restore(); }
          ctx.save(); ctx.globalAlpha = 0.55 + 0.2 * Math.sin(now / 180); ctx.shadowColor = col; ctx.shadowBlur = 8 * FX; ctx.fillStyle = col;
          ctx.beginPath(); ctx.arc(t.x, t.y, CELL * 0.26, 0, Math.PI * 2); ctx.fill();
          ctx.lineWidth = 2; ctx.strokeStyle = p.seat === mySeat ? '#fff' : 'rgba(255,255,255,0.5)'; ctx.stroke();
          ctx.shadowBlur = 0; ctx.fillStyle = '#fff'; ctx.font = '10px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('☠', t.x, t.y + 0.5); ctx.restore();
          return;
        }
        const t = (pv && pv[p.seat]) || p, col = colSeat(p.seat);
        ctx.save(); ctx.fillStyle = 'rgba(0,0,0,0.26)'; ctx.beginPath(); ctx.ellipse(t.x, t.y + CELL * 0.3, CELL * 0.26, CELL * 0.10, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();   // ombre portée
        ctx.save(); if (p.invuln || p.ghost) ctx.globalAlpha = 0.5 + 0.4 * Math.sin(now / 70);
        ctx.shadowColor = col; ctx.shadowBlur = 10 * FX; ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(t.x, t.y, CELL * 0.32, 0, Math.PI * 2); ctx.fill();
        ctx.lineWidth = 2; ctx.strokeStyle = p.shield ? '#7fd1ff' : (p.seat === mySeat ? '#fff' : 'rgba(255,255,255,0.5)'); ctx.stroke();
        ctx.shadowBlur = 0;                                                              // petit visage cartoon
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(t.x - 4, t.y - 2.5, 2.7, 0, Math.PI * 2); ctx.arc(t.x + 4, t.y - 2.5, 2.7, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#1c2030'; ctx.beginPath(); ctx.arc(t.x - 3.6, t.y - 2, 1.3, 0, Math.PI * 2); ctx.arc(t.x + 4.4, t.y - 2, 1.3, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(t.x, t.y + 2.2, 3.6, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke();
        ctx.restore();
        ctx.fillStyle = '#fff'; ctx.font = 'bold 10px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.fillText(p.seat === mySeat ? 'VOUS' : (p.name || ('P' + (p.seat + 1))).slice(0, 8), t.x, t.y - CELL * 0.36);
      });
    }
    if (!A.reduceFx) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; for (let i = particles.length - 1; i >= 0; i--) { const q = particles[i], t = (now - q.born) / q.life; if (t >= 1) { particles.splice(i, 1); continue; } q.x += q.vx; q.y += q.vy; q.vx *= 0.95; q.vy *= 0.95; ctx.globalAlpha = 1 - t; ctx.fillStyle = q.color; ctx.beginPath(); ctx.arc(q.x, q.y, 2.5 * (1 - t) + 0.5, 0, Math.PI * 2); ctx.fill(); } ctx.restore(); } else particles.length = 0;

    if (snap && snap.gs === 'countdown') { ctx.fillStyle = 'rgba(4,5,12,0.34)'; ctx.fillRect(0, 0, ARENA, ARENA); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; const c = snap.count || 0, pulse = 1 + 0.08 * Math.sin(now / 110); ctx.save(); ctx.translate(ARENA / 2, ARENA / 2 - 4); ctx.scale(pulse, pulse); if (!A.reduceFx) { ctx.shadowColor = 'rgba(255,160,80,.7)'; ctx.shadowBlur = 26; } ctx.fillStyle = '#fff'; ctx.font = 'bold 90px system-ui,sans-serif'; ctx.fillText(c > 0 ? c : 'GO', 0, 0); ctx.restore(); ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.font = '13px system-ui,sans-serif'; ctx.fillText('Amorçage…', ARENA / 2, ARENA / 2 + 64); }
    if (snap && (snap.gs === 'lobby' || snap.gs === 'paused')) {
      ctx.fillStyle = 'rgba(4,5,12,0.66)'; ctx.fillRect(0, 0, ARENA, ARENA); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      if (snap.gs === 'paused') { ctx.fillStyle = '#fff'; ctx.font = 'bold 34px system-ui,sans-serif'; ctx.fillText('PAUSE', ARENA / 2, ARENA / 2 - 6); ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.font = '14px system-ui,sans-serif'; ctx.fillText('P / Échap pour reprendre', ARENA / 2, ARENA / 2 + 28); }
      else { ctx.save(); if (!A.reduceFx) { ctx.shadowColor = 'rgba(255,160,80,.6)'; ctx.shadowBlur = 22; } ctx.fillStyle = '#fff'; ctx.font = 'bold 26px system-ui,sans-serif'; ctx.fillText('BOMBERMAN', ARENA / 2, ARENA / 2 - 32); ctx.restore(); const n = snap.connected, nb = snap.botCount || 0; ctx.fillStyle = teamMode ? '#9fd0ff' : 'rgba(255,255,255,.7)'; ctx.font = '14px system-ui,sans-serif'; ctx.fillText(`${n} joueur${n > 1 ? 's' : ''}${nb ? ' + ' + nb + ' bot' + (nb > 1 ? 's' : '') : ''}${teamMode ? ' · ' + (MODE_NAME[snap.mode] || snap.mode) : (n + nb < 2 ? ' (solo : entraînement)' : '')}`, ARENA / 2, ARENA / 2 - 4); if (snap.revenge) { ctx.fillStyle = '#ff9b6b'; ctx.font = 'bold 13px system-ui,sans-serif'; ctx.fillText('☠ Revanche — les morts bombardent depuis le bord et peuvent revenir', ARENA / 2, ARENA / 2 + 14); } ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.font = 'bold 13px system-ui,sans-serif'; ctx.fillText('▶ Espace / clic pour lancer', ARENA / 2, ARENA / 2 + (snap.revenge ? 34 : 24)); }
    }
    rafId = requestAnimationFrame(draw);
  }

  function pushInput() { send({ t: 'input', up: input.up, down: input.down, left: input.left, right: input.right }); }
  function setIn(k, v) { if (input[k] === v) return; input[k] = v; pushInput(); }
  const onKeyDown = e => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
    unlockAudio();
    const playing = snap && (snap.gs === 'play' || snap.gs === 'paused');
    if (e.key === ' ') { if (snap && snap.gs !== 'play' && snap.gs !== 'paused') send({ t: 'start' }); else send({ t: 'bomb' }); return; }
    if (e.code === 'KeyB' && playing) { send({ t: 'bomb' }); return; }
    if ((e.code === 'KeyX' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') && playing) { send({ t: 'action' }); return; }
    if ((e.key === 'p' || e.key === 'P' || e.key === 'Escape') && playing) { send({ t: 'pause' }); return; }
    const a = KEYMAP[e.code]; if (a && !e.repeat) setIn(a, true);
  };
  const onKeyUp = e => { const a = KEYMAP[e.code]; if (a) setIn(a, false); };
  const onBlur = () => { let ch = false; for (const k in input) if (input[k]) { input[k] = false; ch = true; } if (ch) pushInput(); };
  function hold(id, k) { const el = $(id); if (!el) return; const on = e => { e.preventDefault(); unlockAudio(); setIn(k, true); }; const off = e => { e.preventDefault(); setIn(k, false); }; el.addEventListener('pointerdown', on); el.addEventListener('pointerup', off); el.addEventListener('pointerleave', off); el.addEventListener('pointercancel', off); }

  function init(ctx0) {
    destroyed = false;              // module singleton réutilisé : réarmer la boucle de rendu après un précédent teardown
    A = ctx0.a11y; send = ctx0.send; root = ctx0.root;
    if (ctx0.togglePanel) togglePanel = ctx0.togglePanel; if (ctx0.closePanels) closePanels = ctx0.closePanels;
    cv = $('bmc'); ctx = cv.getContext('2d'); hud = $('bmHud'); endEl = $('bmEnd');
    hud.innerHTML = '';             // module réutilisé : repartir d'un HUD vide (sinon les cartes P1.. se cumulent à chaque retour)
    cards = [0, 1, 2, 3, 4, 5].map(i => { const el = document.createElement('div'); el.className = 'pc hidden'; el.innerHTML = `<div class="dot"></div><div class="inf"><div class="pn">P${i + 1}</div><div class="lv"></div></div>`; hud.appendChild(el); return el; });
    startBtn = $('bmStart'); pauseBtn = $('bmPause'); modeBtn = $('bmMode'); genBtn = $('bmGen'); ffBtn = $('bmFf'); revBtn = $('bmRevenge'); botsBtn = $('bmBots'); pauseFloat = $('bmPauseFloat'); lbBtn = $('bmLbBtn'); lbPanel = $('bmLbPanel'); lbBody = $('bmLbBody');
    startBtn.onclick = () => { unlockAudio(); send({ t: 'start' }); };
    pauseBtn.onclick = () => send({ t: 'pause' }); pauseFloat.onclick = () => send({ t: 'pause' }); modeBtn.onclick = () => send({ t: 'mode' }); genBtn.onclick = () => send({ t: 'gen' }); ffBtn.onclick = () => send({ t: 'ff' });
    if (revBtn) revBtn.onclick = () => send({ t: 'revenge' });
    if (botsBtn) botsBtn.onclick = () => send({ t: 'bots' });
    diffBtn = $('bmDiff'); if (diffBtn) diffBtn.onclick = () => send({ t: 'botdiff' });
    lbBtn.onclick = () => { togglePanel(lbPanel); renderLB(); };
    const helpBtn = $('bmHelp'), helpPanel = $('bmHelpPanel'); if (helpBtn && helpPanel) helpBtn.onclick = () => togglePanel(helpPanel);
    cv.addEventListener('click', () => { unlockAudio(); if (snap && snap.gs !== 'play' && snap.gs !== 'paused') send({ t: 'start' }); });
    endEl.addEventListener('click', () => { unlockAudio(); send({ t: 'start' }); });
    hold('bmUp', 'up'); hold('bmDown', 'down'); hold('bmLeft', 'left'); hold('bmRight', 'right');
    const bomb = $('bmBomb'); if (bomb) bomb.addEventListener('pointerdown', e => { e.preventDefault(); unlockAudio(); send({ t: 'bomb' }); });
    const act = $('bmAct'); if (act) act.addEventListener('pointerdown', e => { e.preventDefault(); send({ t: 'action' }); });
    applyColors(); resizeH = resizeCanvas; addEventListener('resize', resizeH); resizeCanvas();
    addEventListener('keydown', onKeyDown); addEventListener('keyup', onKeyUp); addEventListener('blur', onBlur);
    music.start();
    rafId = requestAnimationFrame(draw);
  }
  function onA11y() { applyColors(); }
  function teardown() { destroyed = true; music.stop(); cancelAnimationFrame(rafId); removeEventListener('resize', resizeH); removeEventListener('keydown', onKeyDown); removeEventListener('keyup', onKeyUp); removeEventListener('blur', onBlur); }

  return { init, onState, onMessage, onLb, onA11y, teardown };
})();
