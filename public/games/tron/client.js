// Module client TRON v2 : traînées + bonus + boost + équipes + arène qui se referme.
import { GW, GH, CELL, ARENA } from './shared.js';

const PAL = { normal: ['#4a9ee0', '#e06240', '#2aaf7a', '#cc9010', '#9b6cf0', '#e268b0'], cb: ['#0072B2', '#E69F00', '#009E73', '#F0E442', '#CC79A7', '#56B4E9'] };
const TEAMPAL = { normal: ['#4a9ee0', '#e06240', '#2aaf7a'], cb: ['#0072B2', '#E69F00', '#009E73'] };
const TEAM_LETTER = ['A', 'B', 'C'];
const MODE_NAME = { ffa: 'Chacun pour soi', '2v2': '2 v 2', '2v2v2': '2 v 2 v 2', '3v3': '3 v 3' };
const PU = { speed: { i: '»', c: '#9fe6ff' }, ghost: { i: '◌', c: '#cbb3ff' }, cut: { i: '✄', c: '#ffd76b' } };
const THEMES = {
  neon: { bg: '#0a0a14', field: '#0d0e1c', grid: 'rgba(255,255,255,0.05)', wall: '#2a2f48' },
  crt: { bg: '#04140b', field: '#06190e', grid: 'rgba(120,255,170,0.08)', wall: '#16432a' },
  light: { bg: '#e4e8f3', field: '#dbe0ee', grid: 'rgba(0,0,0,0.07)', wall: '#9aa3bf' },
};
const INTERP_MS = 80;
const DIR_KEYS = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right' };

export default (function () {
  let A, send, root, cv, ctx, togglePanel = () => {}, closePanels = () => {};
  let CC = PAL.normal, TEAMCC = TEAMPAL.normal, TH = THEMES.neon, FX = 1;
  let mySeat = -1, snap = null, prevGs = 'lobby', teamMode = false, endShown = false, inGamePrev = false, prevRound = -1;
  let board = [], buf = [];
  const particles = [];
  let shakeMag = 0, rafId = 0, destroyed = false, resizeH = null, actx = null, boostHeld = false;
  let hud, cards, startBtn, pauseBtn, modeBtn, fadeBtn, pauseFloat, lbBtn, lbPanel, lbBody, endEl;

  const $ = id => root.querySelector('#' + id);
  const colSeat = s => { if (s < 0 || !snap) return '#fff'; const p = snap.players[s]; return teamMode && p ? TEAMCC[p.team] : CC[s]; };
  const px = c => c * CELL + CELL / 2;
  function applyColors() { CC = PAL[A.palette] || PAL.normal; TEAMCC = TEAMPAL[A.palette] || TEAMPAL.normal; FX = A.reduceFx ? 0 : 1; TH = THEMES[A.theme] || THEMES.neon; }

  function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const playing = document.body.classList.contains('playing');
    const size = Math.max(280, Math.min(window.innerWidth * 0.96, window.innerHeight * (playing ? 0.82 : 0.62), 760));
    cv.style.width = size + 'px'; cv.style.height = size + 'px';
    cv.width = Math.round(size * dpr); cv.height = Math.round(size * dpr);
  }

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
      if (teamMode) tags.push(`<span class="badge" style="background:${col}28;color:${col}">ÉQ.${TEAM_LETTER[p.team]}</span>`);
      if (i === mySeat) tags.push(`<span class="badge" style="background:${col}28;color:${col}">VOUS</span>`);
      cards[i].querySelector('.pn').innerHTML = `${p.name || ('P' + (i + 1))} <span class="sc">${p.kills} ⚡</span> ${tags.join('')}`;
      cards[i].querySelector('.lv').textContent = p.playing ? (p.alive ? '● en vie' : '✖ crashé') : 'prêt';
      cards[i].querySelector('.lv').style.color = col;
    });
  }
  function renderLB() {
    if (!lbBody) return;
    if (!board.length) { lbBody.innerHTML = '<div class="lbnote">Aucune partie enregistrée.</div>'; return; }
    const B = board.map(e => ({ ...e, kd: e.deaths ? e.kills / e.deaths : e.kills }));
    lbBody.innerHTML = B.sort((a, b) => b.wins - a.wins || b.kd - a.kd).map(e =>
      `<div class="lbrow"><span class="lbn">${e.name}</span><span>🎮${e.games}</span><span>🏆${e.wins}</span><span title="kills">⚡${e.kills}</span><span title="K/D">⚖${(e.deaths ? (e.kills / e.deaths).toFixed(2) : (e.kills ? '∞' : '0'))}</span><span title="meilleure survie">⏱${Math.round(e.bestSurvivalSec || 0)}s</span></div>`).join('');
  }
  function showEndscreen(m) {
    if (m.gs !== 'over' || !m.stats) { endEl.classList.add('hidden'); return; }
    endEl.classList.remove('hidden');
    const parts = m.players.filter(p => p.playing && p.place > 0).slice().sort((a, b) => a.place - b.place);
    const champ = m.winner >= 0 ? parts.find(p => p.team === m.winner) : null;
    const who = champ ? (teamMode ? 'Équipe ' + TEAM_LETTER[m.winner] : (champ.name || ('P' + (champ.seat + 1)))) : null;
    const title = champ ? who + ' survit !' : 'Égalité';
    const medals = ['🥇', '🥈', '🥉'];
    const rows = parts.map(p => {
      const col = colSeat(p.seat), medal = medals[p.place - 1] || ('#' + p.place);
      const res = p.alive ? 'survivant·e' : `crashé à ${Math.round((p.elimTick || 0) / 15)}s`;
      return `<div class="erow ${p.alive ? 'win' : ''}"><span class="eplace">${medal}</span>
        <span class="ename" style="color:${col}">${p.name || ('P' + (p.seat + 1))}${teamMode ? ` <small>Éq.${TEAM_LETTER[p.team]}</small>` : ''}</span>
        <span class="estat" title="éliminations">⚡ ${p.kills}</span><span class="eres">${res}</span></div>`;
    }).join('');
    endEl.innerHTML = `<div class="etitle" style="color:${champ ? colSeat(champ.seat) : '#fff'}">${title}</div>
      <div class="emeta">⏱ ${m.stats.durationSec}s · ${m.stats.nParts} joueurs</div><div class="elist">${rows}</div><div class="ehint">Espace / clic pour rejouer</div>`;
  }

  function onMessage(m) { if (m && m.t === 'welcome') mySeat = m.seat; }
  function onLb(d) { board = d.board || []; renderLB(); }
  function onState(m) {
    snap = m; teamMode = m.mode && m.mode !== 'ffa';
    const inGame = m.gs === 'play' || m.gs === 'countdown' || m.gs === 'paused';
    if (inGame !== inGamePrev) { inGamePrev = inGame; document.body.classList.toggle('playing', inGame); resizeCanvas(); }
    document.body.classList.toggle('paused', m.gs === 'paused');
    if (m.gs === 'play' || m.gs === 'countdown') closePanels();
    if (m.round !== prevRound) { prevRound = m.round; buf = []; particles.length = 0; }
    buf.push({ t: performance.now(), s: m }); if (buf.length > 10) buf.shift();
    (m.fx || []).forEach(playFx);
    if (prevGs !== 'over' && m.gs === 'over') sound('win');
    prevGs = m.gs;
    refreshHUD();
    if (m.gs === 'over') { if (!endShown) { showEndscreen(m); endShown = true; } }
    else { endShown = false; endEl.classList.add('hidden'); }
    const idle = m.gs === 'lobby' || m.gs === 'over';
    startBtn.disabled = !(mySeat >= 0 && idle && m.connected >= 2);
    startBtn.textContent = m.gs === 'over' ? '↻ Rejouer' : '▶ Démarrer';
    pauseBtn.disabled = !(m.gs === 'play' || m.gs === 'paused');
    pauseBtn.textContent = m.gs === 'paused' ? '▶ Reprendre' : '⏸ Pause';
    pauseFloat.textContent = m.gs === 'paused' ? '▶' : '⏸';
    modeBtn.disabled = !(idle && (m.connected === 4 || m.connected === 6));
    modeBtn.textContent = '⚔ ' + (MODE_NAME[m.mode] || m.mode); modeBtn.classList.toggle('on', teamMode);
    fadeBtn.disabled = !idle; fadeBtn.textContent = m.fade ? '〰 Traînée courte' : '➖ Traînée ∞'; fadeBtn.classList.toggle('on', !!m.fade);
  }

  function unlockAudio() { if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch {} } if (actx && actx.state === 'suspended') actx.resume(); }
  function tone(f, d, ty = 'square', g = 0.05, dl = 0) { const _v = (A && typeof A.sfx === 'number') ? A.sfx : 1; if (!actx || _v <= 0) return; const t0 = actx.currentTime + dl, o = actx.createOscillator(), gg = actx.createGain(); o.type = ty; o.frequency.setValueAtTime(f, t0); gg.gain.setValueAtTime(g * _v, t0); gg.gain.exponentialRampToValueAtTime(0.0001, t0 + d); o.connect(gg); gg.connect(actx.destination); o.start(t0); o.stop(t0 + d); }
  function sound(k) { if (!actx) return; if (k === 'crash') { tone(180, 0.22, 'sawtooth', 0.06); tone(90, 0.3, 'sawtooth', 0.05, 0.04); } else if (k === 'pickup') { tone(660, 0.07, 'square', 0.05); tone(990, 0.08, 'square', 0.05, 0.06); } else if (k === 'win') { tone(523, 0.18, 'triangle', 0.06); tone(659, 0.18, 'triangle', 0.06, 0.12); tone(784, 0.3, 'triangle', 0.06, 0.24); } }
  function playFx(f) {
    if (f.type === 'pickup') return sound('pickup');
    if (f.type === 'crash') {
      sound('crash'); if (A.reduceFx) return;
      shakeMag = Math.max(shakeMag, 6);
      const x = px(f.x), y = px(f.y), col = colSeat(f.seat), now = performance.now();
      for (let k = 0; k < 16; k++) { const a = Math.random() * Math.PI * 2, sp = 1 + Math.random() * 4; particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, born: now, life: 420 + Math.random() * 260, color: col }); }
    }
  }

  function viewHeads(now) {
    if (buf.length === 0) return null;
    const target = now - INTERP_MS;
    let a = buf[0], b = buf[buf.length - 1];
    for (let i = 0; i < buf.length; i++) if (buf[i].t <= target) a = buf[i];
    for (let i = buf.length - 1; i >= 0; i--) if (buf[i].t >= target) b = buf[i];
    const span = b.t - a.t; let al = span > 0 ? (target - a.t) / span : 0; al = al < 0 ? 0 : al > 1 ? 1 : al;
    const heads = {};
    b.s.players.forEach(pb => {
      if (!pb.playing) return;
      const pa = a.s.players[pb.seat]; let hx = pb.head.x, hy = pb.head.y;
      if (pa && pa.playing && pb.alive && pa.alive && Math.abs(pb.head.x - pa.head.x) <= 2 && Math.abs(pb.head.y - pa.head.y) <= 2) { hx = pa.head.x + (pb.head.x - pa.head.x) * al; hy = pa.head.y + (pb.head.y - pa.head.y) * al; }
      heads[pb.seat] = { x: hx, y: hy };
    });
    return heads;
  }

  function draw() {
    if (destroyed) return;
    const now = performance.now();
    const sc = cv.width / ARENA;
    let ox = 0, oy = 0;
    if (shakeMag > 0.3 && !A.reduceFx) { ox = (Math.random() * 2 - 1) * shakeMag; oy = (Math.random() * 2 - 1) * shakeMag; shakeMag *= 0.85; } else shakeMag = 0;
    ctx.setTransform(sc, 0, 0, sc, ox * sc, oy * sc);
    ctx.fillStyle = TH.bg; ctx.fillRect(0, 0, ARENA, ARENA);
    ctx.fillStyle = TH.field; ctx.fillRect(0, 0, ARENA, ARENA);
    ctx.strokeStyle = TH.grid; ctx.lineWidth = 1;
    for (let i = 0; i <= GW; i += 5) { const x = i * CELL; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, ARENA); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, x); ctx.lineTo(ARENA, x); ctx.stroke(); }
    // murs (rétrécissement)
    const L = snap ? (snap.shrink || 0) : 0;
    if (L > 0) { ctx.fillStyle = TH.wall; const w = L * CELL; ctx.fillRect(0, 0, ARENA, w); ctx.fillRect(0, ARENA - w, ARENA, w); ctx.fillRect(0, 0, w, ARENA); ctx.fillRect(ARENA - w, 0, w, ARENA); }
    ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 3; ctx.strokeRect(1.5, 1.5, ARENA - 3, ARENA - 3);

    if (snap) {
      (snap.pickups || []).forEach(pk => {
        const x = px(pk.x), y = px(pk.y), d = PU[pk.t] || { i: '?', c: '#fff' }, pulse = 1 + 0.1 * Math.sin(now / 200);
        ctx.save(); ctx.shadowColor = d.c; ctx.shadowBlur = 12 * FX; ctx.fillStyle = d.c + '22'; ctx.strokeStyle = d.c; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(x, y, CELL * 0.5 * pulse, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.shadowBlur = 0; ctx.fillStyle = d.c; ctx.font = `bold ${Math.round(CELL * 0.7)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(d.i, x, y + 1); ctx.restore();
      });
      const heads = viewHeads(now);
      snap.players.forEach(p => {
        if (!p.playing) return;
        const col = colSeat(p.seat), dead = !p.alive, hv = heads && heads[p.seat];
        const hx = hv ? px(hv.x) : px(p.head.x), hy = hv ? px(hv.y) : px(p.head.y);
        ctx.save();
        ctx.globalAlpha = dead ? 0.35 : (p.ghost ? 0.55 : 1);
        ctx.strokeStyle = col; ctx.lineWidth = CELL - 2; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
        ctx.shadowColor = col; ctx.shadowBlur = (dead ? 0 : (p.speed ? 24 : 14)) * FX;   // bloom néon renforcé
        const path = p.path || [];
        if (path.length) {
          ctx.beginPath(); ctx.moveTo(px(path[0][0]), px(path[0][1])); for (let i = 1; i < path.length; i++) ctx.lineTo(px(path[i][0]), px(path[i][1])); ctx.lineTo(hx, hy); ctx.stroke();
          if (!dead && !A.reduceFx) { ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = Math.max(2, (CELL - 2) * 0.32); ctx.shadowBlur = 6 * FX; ctx.stroke(); } // cœur lumineux
        }
        ctx.restore();
        if (!dead) {
          ctx.save(); ctx.shadowColor = col; ctx.shadowBlur = 14 * FX; ctx.fillStyle = p.ghost ? col : '#fff';
          ctx.globalAlpha = p.ghost ? 0.7 : 1; ctx.fillRect(hx - CELL / 2, hy - CELL / 2, CELL, CELL);
          ctx.fillStyle = col; ctx.globalAlpha = 0.5; ctx.fillRect(hx - CELL / 2, hy - CELL / 2, CELL, CELL); ctx.restore();
          if (p.seat === mySeat) { ctx.save(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.6 + 0.4 * Math.sin(now / 200); ctx.strokeRect(hx - CELL / 2 - 2, hy - CELL / 2 - 2, CELL + 4, CELL + 4); ctx.restore(); }
        }
      });
    }
    if (!A.reduceFx) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; for (let i = particles.length - 1; i >= 0; i--) { const q = particles[i], t = (now - q.born) / q.life; if (t >= 1) { particles.splice(i, 1); continue; } q.x += q.vx; q.y += q.vy; q.vx *= 0.95; q.vy *= 0.95; ctx.globalAlpha = 1 - t; ctx.fillStyle = q.color; ctx.beginPath(); ctx.arc(q.x, q.y, 2.5 * (1 - t) + 0.5, 0, Math.PI * 2); ctx.fill(); } ctx.restore(); } else particles.length = 0;

    // jauge de boost (joueur local)
    const me = (snap && mySeat >= 0) ? snap.players[mySeat] : null;
    if (me && me.playing && me.alive && snap.gs === 'play') {
      const bw = 120, bh = 8, bx = (ARENA - bw) / 2, by = ARENA - 18, b = (me.boost || 0) / 100;
      ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(bx, by, bw, bh);
      ctx.fillStyle = b > 0.25 ? '#9fe6ff' : '#ff7a7a'; ctx.fillRect(bx, by, bw * b, bh);
      ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1; ctx.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1);
      ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.font = '10px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.fillText('BOOST (Maj)', ARENA / 2, by - 2);
    }

    if (snap && snap.gs === 'countdown') {
      ctx.fillStyle = 'rgba(4,5,12,0.34)'; ctx.fillRect(0, 0, ARENA, ARENA); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const c = snap.count || 0, pulse = 1 + 0.08 * Math.sin(now / 110);
      ctx.save(); ctx.translate(ARENA / 2, ARENA / 2 - 4); ctx.scale(pulse, pulse); if (!A.reduceFx) { ctx.shadowColor = 'rgba(120,200,255,.7)'; ctx.shadowBlur = 26; }
      ctx.fillStyle = '#fff'; ctx.font = 'bold 92px system-ui,sans-serif'; ctx.fillText(c > 0 ? c : 'GO', 0, 0); ctx.restore();
      ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.font = '13px system-ui,sans-serif'; ctx.fillText('En piste…', ARENA / 2, ARENA / 2 + 64);
    }
    if (snap && (snap.gs === 'lobby' || snap.gs === 'paused')) {
      ctx.fillStyle = 'rgba(4,5,12,0.66)'; ctx.fillRect(0, 0, ARENA, ARENA); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      if (snap.gs === 'paused') { ctx.fillStyle = '#fff'; ctx.font = 'bold 34px system-ui,sans-serif'; ctx.fillText('PAUSE', ARENA / 2, ARENA / 2 - 6); ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.font = '14px system-ui,sans-serif'; ctx.fillText('P / Échap pour reprendre', ARENA / 2, ARENA / 2 + 28); }
      else {
        ctx.save(); if (!A.reduceFx) { ctx.shadowColor = 'rgba(120,200,255,.6)'; ctx.shadowBlur = 22; } ctx.fillStyle = '#fff'; ctx.font = 'bold 30px system-ui,sans-serif'; ctx.fillText('TRON', ARENA / 2, ARENA / 2 - 36); ctx.restore();
        const n = snap.connected;
        ctx.fillStyle = teamMode ? '#9fd0ff' : 'rgba(255,255,255,.7)'; ctx.font = '15px system-ui,sans-serif'; ctx.fillText(`${n} pilote${n > 1 ? 's' : ''}${teamMode ? ' · ' + (MODE_NAME[snap.mode] || snap.mode) : ''}`, ARENA / 2, ARENA / 2 - 6);
        ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.font = 'bold 13px system-ui,sans-serif'; ctx.fillText(n >= 2 ? '▶ Espace / clic pour lancer' : 'En attente d\'un 2ᵉ pilote…', ARENA / 2, ARENA / 2 + 24);
      }
    }
    rafId = requestAnimationFrame(draw);
  }

  const onKeyDown = e => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
    unlockAudio();
    if (e.key === ' ' && snap && snap.gs !== 'play' && snap.gs !== 'paused') return send({ t: 'start' });
    if ((e.key === 'p' || e.key === 'P' || e.key === 'Escape') && snap && (snap.gs === 'play' || snap.gs === 'paused')) return send({ t: 'pause' });
    if ((e.key === 'Shift' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') && !boostHeld) { boostHeld = true; send({ t: 'boost', on: true }); return; }
    const d = DIR_KEYS[e.code]; if (d) send({ t: 'dir', d });
  };
  const onKeyUp = e => { if (e.key === 'Shift' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') { boostHeld = false; send({ t: 'boost', on: false }); } };
  const onBlur = () => { if (boostHeld) { boostHeld = false; send({ t: 'boost', on: false }); } };
  function dpad(id, d) { const el = $(id); if (!el) return; el.addEventListener('pointerdown', e => { e.preventDefault(); unlockAudio(); send({ t: 'dir', d }); }); }

  function init(ctx0) {
    destroyed = false;              // module singleton réutilisé : réarmer la boucle de rendu après un précédent teardown
    A = ctx0.a11y; send = ctx0.send; root = ctx0.root;
    if (ctx0.togglePanel) togglePanel = ctx0.togglePanel; if (ctx0.closePanels) closePanels = ctx0.closePanels;
    cv = $('trc'); ctx = cv.getContext('2d'); hud = $('trHud'); endEl = $('trEnd');
    hud.innerHTML = '';             // module réutilisé : repartir d'un HUD vide (sinon les cartes P1.. se cumulent à chaque retour)
    cards = [0, 1, 2, 3, 4, 5].map(i => { const el = document.createElement('div'); el.className = 'pc hidden'; el.innerHTML = `<div class="dot"></div><div class="inf"><div class="pn">P${i + 1}</div><div class="lv"></div></div>`; hud.appendChild(el); return el; });
    startBtn = $('trStart'); pauseBtn = $('trPause'); modeBtn = $('trMode'); fadeBtn = $('trFade'); pauseFloat = $('trPauseFloat');
    lbBtn = $('trLbBtn'); lbPanel = $('trLbPanel'); lbBody = $('trLbBody');
    startBtn.onclick = () => { unlockAudio(); send({ t: 'start' }); };
    pauseBtn.onclick = () => send({ t: 'pause' });
    pauseFloat.onclick = () => send({ t: 'pause' });
    modeBtn.onclick = () => send({ t: 'mode' });
    fadeBtn.onclick = () => send({ t: 'fade' });
    lbBtn.onclick = () => { togglePanel(lbPanel); renderLB(); };
    const helpBtn = $('trHelp'), helpPanel = $('trHelpPanel'); if (helpBtn && helpPanel) helpBtn.onclick = () => togglePanel(helpPanel);
    cv.addEventListener('click', () => { unlockAudio(); if (snap && snap.gs !== 'play' && snap.gs !== 'paused') send({ t: 'start' }); });
    endEl.addEventListener('click', () => { unlockAudio(); send({ t: 'start' }); });
    dpad('trUp', 'up'); dpad('trDown', 'down'); dpad('trLeft', 'left'); dpad('trRight', 'right');
    const bb = $('trBoost'); if (bb) { const on = e => { e.preventDefault(); send({ t: 'boost', on: true }); }; const off = e => { e.preventDefault(); send({ t: 'boost', on: false }); }; bb.addEventListener('pointerdown', on); bb.addEventListener('pointerup', off); bb.addEventListener('pointerleave', off); bb.addEventListener('pointercancel', off); }
    applyColors();
    resizeH = resizeCanvas; addEventListener('resize', resizeH); resizeCanvas();
    addEventListener('keydown', onKeyDown); addEventListener('keyup', onKeyUp); addEventListener('blur', onBlur);
    rafId = requestAnimationFrame(draw);
  }
  function onA11y() { applyColors(); }
  function teardown() { destroyed = true; cancelAnimationFrame(rafId); removeEventListener('resize', resizeH); removeEventListener('keydown', onKeyDown); removeEventListener('keyup', onKeyUp); removeEventListener('blur', onBlur); }

  return { init, onState, onMessage, onLb, onA11y, teardown };
})();
