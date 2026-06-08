// Module client TANK v2 : arène destructible, power-ups, mines, collision, FFA/équipes, manches.
import { ARENA, TANK_R, SHELL_R, BLK, G } from './shared.js';

const PAL = { normal: ['#4a9ee0', '#e06240', '#2aaf7a', '#cc9010', '#9b6cf0', '#e268b0'], cb: ['#0072B2', '#E69F00', '#009E73', '#F0E442', '#CC79A7', '#56B4E9'] };
const TEAMPAL = { normal: ['#4a9ee0', '#e06240', '#2aaf7a'], cb: ['#0072B2', '#E69F00', '#009E73'] };
const TEAM_LETTER = ['A', 'B', 'C'];
const MODE_NAME = { ffa: 'Chacun pour soi', '2v2': '2 v 2', '2v2v2': '2 v 2 v 2', '3v3': '3 v 3' };
const GEN_NAMES = ['Symétrique', 'Aléatoire', '4 coins'];
const PU = { rapid: { i: '»', c: '#9fe6ff' }, triple: { i: '⋔', c: '#ffd76b' }, shield: { i: '⛉', c: '#7fd1ff' }, speed: { i: '👟', c: '#7ff0bd' }, pierce: { i: '➳', c: '#ff9be0' }, mine: { i: '◈', c: '#ff8e6e' } };
// identité visuelle propre au jeu (fixe) : Désert / Champ de bataille
const SKIN = { bg: '#14130c', floor: '#2b2818', floor2: '#262313', solid: '#564f45', soft: '#8a6a3c', softTop: '#b58a4c', grid: 'rgba(255,220,150,0.045)', border: 'rgba(210,180,120,0.3)', steel: true, crate: true };
const INTERP_MS = 55;
const KEYMAP = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'fwd', KeyW: 'fwd', ArrowDown: 'back', KeyS: 'back' };

export default (function () {
  let A, send, root, cv, ctx, togglePanel = () => {}, closePanels = () => {};
  let CC = PAL.normal, TEAMCC = TEAMPAL.normal, TH = SKIN, FX = 1;
  let mySeat = -1, snap = null, prevGs = 'lobby', teamMode = false, endShown = false, inGamePrev = false;
  let board = [], buf = [];
  const particles = [];
  let shakeMag = 0, rafId = 0, destroyed = false, resizeH = null, actx = null;
  const input = { left: false, right: false, fwd: false, back: false, fire: false };
  let hud, cards, startBtn, pauseBtn, modeBtn, arenaBtn, winBtn, ffBtn, pauseFloat, lbBtn, lbPanel, lbBody, endEl;

  const $ = id => root.querySelector('#' + id);
  const colSeat = s => { if (s < 0 || !snap) return '#fff'; const p = snap.players[s]; return teamMode && p ? TEAMCC[p.team] : CC[s]; };
  function applyColors() { CC = PAL[A.palette] || PAL.normal; TEAMCC = TEAMPAL[A.palette] || TEAMPAL.normal; FX = A.reduceFx ? 0 : 1; TH = SKIN; }

  function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const playing = document.body.classList.contains('playing');
    const size = Math.max(280, Math.min(window.innerWidth * 0.96, window.innerHeight * (playing ? 0.82 : 0.62), 760));
    cv.style.width = size + 'px'; cv.style.height = size + 'px'; cv.width = Math.round(size * dpr); cv.height = Math.round(size * dpr);
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
      if (i === mySeat) tags.push(`<span class="badge" style="background:${col}28;color:${col}">VOUS</span>`);
      cards[i].querySelector('.pn').innerHTML = `${p.name || ('P' + (i + 1))} <span class="sc">🏆${p.score} · ${p.kills}⚡</span> ${tags.join('')}`;
      const lv = cards[i].querySelector('.lv'); lv.style.color = col;
      const pu = [p.shield ? '⛉' + p.shield : '', p.rapid ? '»' : '', p.triple ? '⋔' : '', p.speed ? '👟' : '', p.pierce ? '➳' : '', p.mineN ? '◈' + p.mineN : ''].filter(Boolean).join(' ');
      lv.innerHTML = p.playing ? (p.alive ? ('❤'.repeat(p.lives) + (pu ? ' · ' + pu : '')) : '✖ détruit') : 'prêt';
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
    snap = m; teamMode = m.mode && m.mode !== 'ffa';
    const inGame = m.gs === 'play' || m.gs === 'countdown' || m.gs === 'paused';
    if (inGame !== inGamePrev) { inGamePrev = inGame; document.body.classList.toggle('playing', inGame); resizeCanvas(); }
    document.body.classList.toggle('paused', m.gs === 'paused');
    if (m.gs === 'play' || m.gs === 'countdown') closePanels();
    buf.push({ t: performance.now(), s: m }); if (buf.length > 10) buf.shift();
    (m.fx || []).forEach(playFx);
    if (prevGs !== 'over' && m.gs === 'over') sound('win');
    prevGs = m.gs; refreshHUD();
    if (m.gs === 'over') { if (!endShown) { showEndscreen(m); endShown = true; } } else { endShown = false; endEl.classList.add('hidden'); }
    const idle = m.gs === 'lobby' || m.gs === 'over';
    startBtn.disabled = !(mySeat >= 0 && idle && m.connected >= 2); startBtn.textContent = m.gs === 'over' ? '↻ Rejouer' : '▶ Démarrer';
    pauseBtn.disabled = !(m.gs === 'play' || m.gs === 'paused'); pauseBtn.textContent = m.gs === 'paused' ? '▶ Reprendre' : '⏸ Pause';
    pauseFloat.textContent = m.gs === 'paused' ? '▶' : '⏸';
    modeBtn.disabled = !(idle && (m.connected === 4 || m.connected === 6)); modeBtn.textContent = '⚔ ' + (MODE_NAME[m.mode] || m.mode); modeBtn.classList.toggle('on', teamMode);
    arenaBtn.disabled = !idle; arenaBtn.textContent = '🧱 ' + (GEN_NAMES[m.gen] || 'Arène');
    winBtn.disabled = !idle; winBtn.textContent = '🏁 ' + (m.winTarget === 1 ? '1 manche' : m.winTarget + ' manches');
    ffBtn.disabled = !(idle && teamMode); ffBtn.textContent = '🤝 Tir allié : ' + (m.ff ? 'ON' : 'OFF'); ffBtn.classList.toggle('on', !!m.ff);
  }

  function unlockAudio() { if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch {} } if (actx && actx.state === 'suspended') actx.resume(); }
  function tone(f, d, ty = 'square', g = 0.05, dl = 0) { if (!actx) return; const t0 = actx.currentTime + dl, o = actx.createOscillator(), gg = actx.createGain(); o.type = ty; o.frequency.setValueAtTime(f, t0); gg.gain.setValueAtTime(g, t0); gg.gain.exponentialRampToValueAtTime(0.0001, t0 + d); o.connect(gg); gg.connect(actx.destination); o.start(t0); o.stop(t0 + d); }
  function sound(k) { if (!actx) return; if (k === 'shot') tone(320, 0.05, 'square', 0.03); else if (k === 'hit') tone(200, 0.08, 'square', 0.05); else if (k === 'pickup') { tone(660, 0.07, 'square', 0.05); tone(990, 0.08, 'square', 0.05, 0.06); } else if (k === 'boom') { tone(150, 0.25, 'sawtooth', 0.06); tone(80, 0.32, 'sawtooth', 0.05, 0.05); } else if (k === 'win') { tone(523, 0.18, 'triangle', 0.06); tone(659, 0.18, 'triangle', 0.06, 0.12); tone(784, 0.3, 'triangle', 0.06, 0.24); } }
  function playFx(f) {
    if (f.type === 'shot') return sound('shot');
    if (f.type === 'hit') return sound('hit');
    if (f.type === 'pickup' || f.type === 'mineset') return sound('pickup');
    if (f.type === 'boom') {
      sound('boom'); if (A.reduceFx) return;
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

  function draw() {
    if (destroyed) return;
    const now = performance.now(); const sc = cv.width / ARENA;
    let ox = 0, oy = 0;
    if (shakeMag > 0.3 && !A.reduceFx) { ox = (Math.random() * 2 - 1) * shakeMag; oy = (Math.random() * 2 - 1) * shakeMag; shakeMag *= 0.86; } else shakeMag = 0;
    ctx.setTransform(sc, 0, 0, sc, ox * sc, oy * sc);
    ctx.fillStyle = TH.bg; ctx.fillRect(0, 0, ARENA, ARENA);
    if (snap && snap.grid) {
      const g = snap.grid;
      for (let gy = 0; gy < G; gy++) for (let gx = 0; gx < G; gx++) {
        const c = g[gy * G + gx], x = gx * BLK, y = gy * BLK;
        ctx.fillStyle = ((gx + gy) & 1) ? TH.floor : TH.floor2; ctx.fillRect(x, y, BLK, BLK);
        if (c === '1') {
          ctx.fillStyle = TH.solid; ctx.fillRect(x + 1, y + 1, BLK - 2, BLK - 2); ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fillRect(x + 1, y + 1, BLK - 2, 4);
          if (TH.steel) { ctx.fillStyle = 'rgba(0,0,0,0.34)'; for (const rx of [x + 6, x + BLK - 6]) for (const ry of [y + 6, y + BLK - 6]) { ctx.beginPath(); ctx.arc(rx, ry, 2.1, 0, Math.PI * 2); ctx.fill(); } ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 1; ctx.strokeRect(x + 2.5, y + 2.5, BLK - 5, BLK - 5); } // plaque d'acier rivetée
        }
        else if (c === '2') {
          ctx.fillStyle = TH.soft; ctx.fillRect(x + 2, y + 2, BLK - 4, BLK - 4); ctx.fillStyle = TH.softTop; ctx.fillRect(x + 2, y + 2, BLK - 4, 5);
          if (TH.crate) { ctx.strokeStyle = 'rgba(0,0,0,0.22)'; ctx.lineWidth = 1.5; ctx.strokeRect(x + 3, y + 3, BLK - 6, BLK - 6); ctx.beginPath(); ctx.moveTo(x + 3, y + 3); ctx.lineTo(x + BLK - 3, y + BLK - 3); ctx.moveTo(x + BLK - 3, y + 3); ctx.lineTo(x + 3, y + BLK - 3); ctx.stroke(); } // caisse en bois
        }
      }
      ctx.strokeStyle = TH.border || 'rgba(255,255,255,0.2)'; ctx.lineWidth = 3; ctx.strokeRect(1.5, 1.5, ARENA - 3, ARENA - 3);
      // power-ups
      (snap.pickups || []).forEach(k => { const d = PU[k.t] || { i: '?', c: '#fff' }, pulse = 1 + 0.1 * Math.sin(now / 200); ctx.save(); ctx.shadowColor = d.c; ctx.shadowBlur = 12 * FX; ctx.fillStyle = d.c + '22'; ctx.strokeStyle = d.c; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(k.x, k.y, 13 * pulse, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.shadowBlur = 0; ctx.fillStyle = d.c; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(d.i, k.x, k.y + 1); ctx.restore(); });
      // mines
      (snap.mines || []).forEach(mn => { const col = colSeat(mn.o); ctx.save(); ctx.fillStyle = mn.armed ? '#ff5a5a' : '#888'; ctx.globalAlpha = mn.armed ? 0.6 + 0.4 * Math.sin(now / 120) : 0.6; ctx.beginPath(); ctx.arc(mn.x, mn.y, 6, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.7; ctx.stroke(); ctx.restore(); });
      // tanks
      const tv = viewTanks(now);
      snap.players.forEach(p => {
        if (!p.playing || !p.alive) return;
        const t = (tv && tv[p.seat]) || p, col = colSeat(p.seat);
        ctx.save(); ctx.translate(t.x, t.y); ctx.rotate(t.angle);
        if (p.invuln) ctx.globalAlpha = 0.35 + 0.35 * Math.sin(now / 60);
        ctx.shadowColor = col; ctx.shadowBlur = 10 * FX; ctx.fillStyle = col;
        ctx.fillRect(-TANK_R, -TANK_R * 0.8, TANK_R * 2, TANK_R * 1.6);
        ctx.fillStyle = '#fff'; ctx.globalAlpha *= 0.9; ctx.fillRect(TANK_R * 0.2, -2.5, TANK_R + 6, 5);
        ctx.restore();
        if (p.shield) { ctx.save(); ctx.strokeStyle = '#7fd1ff'; ctx.shadowColor = '#7fd1ff'; ctx.shadowBlur = 12 * FX; ctx.globalAlpha = 0.6 + 0.3 * Math.sin(now / 200); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(t.x, t.y, TANK_R + 5, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
        if (p.seat === mySeat) { ctx.save(); ctx.strokeStyle = '#fff'; ctx.globalAlpha = 0.5 + 0.4 * Math.sin(now / 220); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(t.x, t.y, TANK_R + 3, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
      });
      // obus
      (snap.shells || []).forEach(s => { const col = s.p ? '#ff9be0' : colSeat(s.o); ctx.save(); ctx.shadowColor = col; ctx.shadowBlur = 12 * FX; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(s.x, s.y, SHELL_R, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = col; ctx.globalAlpha = 0.6; ctx.beginPath(); ctx.arc(s.x, s.y, SHELL_R + (s.p ? 2.5 : 1.5), 0, Math.PI * 2); ctx.fill(); ctx.restore(); });
    }
    if (!A.reduceFx) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; for (let i = particles.length - 1; i >= 0; i--) { const q = particles[i], t = (now - q.born) / q.life; if (t >= 1) { particles.splice(i, 1); continue; } q.x += q.vx; q.y += q.vy; q.vx *= 0.95; q.vy *= 0.95; ctx.globalAlpha = 1 - t; ctx.fillStyle = q.color; ctx.beginPath(); ctx.arc(q.x, q.y, 2.5 * (1 - t) + 0.5, 0, Math.PI * 2); ctx.fill(); } ctx.restore(); } else particles.length = 0;

    if (snap && snap.gs === 'countdown') { ctx.fillStyle = 'rgba(4,5,12,0.34)'; ctx.fillRect(0, 0, ARENA, ARENA); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; const c = snap.count || 0, pulse = 1 + 0.08 * Math.sin(now / 110); ctx.save(); ctx.translate(ARENA / 2, ARENA / 2 - 4); ctx.scale(pulse, pulse); if (!A.reduceFx) { ctx.shadowColor = 'rgba(255,180,120,.7)'; ctx.shadowBlur = 26; } ctx.fillStyle = '#fff'; ctx.font = 'bold 96px system-ui,sans-serif'; ctx.fillText(c > 0 ? c : 'FEU', 0, 0); ctx.restore(); ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.font = '13px system-ui,sans-serif'; ctx.fillText('Chargement des canons…', ARENA / 2, ARENA / 2 + 66); }
    if (snap && (snap.gs === 'lobby' || snap.gs === 'paused')) {
      ctx.fillStyle = 'rgba(4,5,12,0.66)'; ctx.fillRect(0, 0, ARENA, ARENA); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      if (snap.gs === 'paused') { ctx.fillStyle = '#fff'; ctx.font = 'bold 34px system-ui,sans-serif'; ctx.fillText('PAUSE', ARENA / 2, ARENA / 2 - 6); ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.font = '14px system-ui,sans-serif'; ctx.fillText('P / Échap pour reprendre', ARENA / 2, ARENA / 2 + 28); }
      else { ctx.save(); if (!A.reduceFx) { ctx.shadowColor = 'rgba(255,180,120,.6)'; ctx.shadowBlur = 22; } ctx.fillStyle = '#fff'; ctx.font = 'bold 30px system-ui,sans-serif'; ctx.fillText('TANKS', ARENA / 2, ARENA / 2 - 36); ctx.restore(); const n = snap.connected; ctx.fillStyle = teamMode ? '#9fd0ff' : 'rgba(255,255,255,.7)'; ctx.font = '15px system-ui,sans-serif'; ctx.fillText(`${n} pilote${n > 1 ? 's' : ''}${teamMode ? ' · ' + (MODE_NAME[snap.mode] || snap.mode) : ''} · ${snap.winTarget === 1 ? '1 manche' : snap.winTarget + ' manches'}`, ARENA / 2, ARENA / 2 - 6); ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.font = 'bold 13px system-ui,sans-serif'; ctx.fillText(n >= 2 ? '▶ Espace / clic pour lancer' : 'En attente d\'un 2ᵉ pilote…', ARENA / 2, ARENA / 2 + 24); }
    }
    rafId = requestAnimationFrame(draw);
  }

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

  function init(ctx0) {
    destroyed = false;              // module singleton réutilisé : réarmer la boucle de rendu après un précédent teardown
    A = ctx0.a11y; send = ctx0.send; root = ctx0.root;
    if (ctx0.togglePanel) togglePanel = ctx0.togglePanel; if (ctx0.closePanels) closePanels = ctx0.closePanels;
    cv = $('tkc'); ctx = cv.getContext('2d'); hud = $('tkHud'); endEl = $('tkEnd');
    hud.innerHTML = '';             // module réutilisé : repartir d'un HUD vide (sinon les cartes P1.. se cumulent à chaque retour)
    cards = [0, 1, 2, 3, 4, 5].map(i => { const el = document.createElement('div'); el.className = 'pc hidden'; el.innerHTML = `<div class="dot"></div><div class="inf"><div class="pn">P${i + 1}</div><div class="lv"></div></div>`; hud.appendChild(el); return el; });
    startBtn = $('tkStart'); pauseBtn = $('tkPause'); modeBtn = $('tkMode'); arenaBtn = $('tkArena'); winBtn = $('tkWin'); ffBtn = $('tkFf'); pauseFloat = $('tkPauseFloat');
    lbBtn = $('tkLbBtn'); lbPanel = $('tkLbPanel'); lbBody = $('tkLbBody');
    startBtn.onclick = () => { unlockAudio(); send({ t: 'start' }); };
    pauseBtn.onclick = () => send({ t: 'pause' }); pauseFloat.onclick = () => send({ t: 'pause' });
    modeBtn.onclick = () => send({ t: 'mode' }); arenaBtn.onclick = () => send({ t: 'arena' }); winBtn.onclick = () => send({ t: 'wintarget' }); ffBtn.onclick = () => send({ t: 'ff' });
    lbBtn.onclick = () => { togglePanel(lbPanel); renderLB(); };
    const helpBtn = $('tkHelp'), helpPanel = $('tkHelpPanel'); if (helpBtn && helpPanel) helpBtn.onclick = () => togglePanel(helpPanel);
    cv.addEventListener('click', () => { unlockAudio(); if (snap && snap.gs !== 'play' && snap.gs !== 'paused') send({ t: 'start' }); });
    endEl.addEventListener('click', () => { unlockAudio(); send({ t: 'start' }); });
    hold('tkLeft', 'left'); hold('tkRight', 'right'); hold('tkFwd', 'fwd'); hold('tkBack', 'back'); hold('tkFire', 'fire');
    const mineBtn = $('tkMine'); if (mineBtn) mineBtn.addEventListener('pointerdown', e => { e.preventDefault(); send({ t: 'mine' }); });
    applyColors(); resizeH = resizeCanvas; addEventListener('resize', resizeH); resizeCanvas();
    addEventListener('keydown', onKeyDown); addEventListener('keyup', onKeyUp); addEventListener('blur', onBlur);
    rafId = requestAnimationFrame(draw);
  }
  function onA11y() { applyColors(); }
  function teardown() { destroyed = true; cancelAnimationFrame(rafId); removeEventListener('resize', resizeH); removeEventListener('keydown', onKeyDown); removeEventListener('keyup', onKeyUp); removeEventListener('blur', onBlur); }

  return { init, onState, onMessage, onLb, onA11y, teardown };
})();
