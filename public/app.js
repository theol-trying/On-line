// SHELL client de la plateforme : réseau (WS + token), pseudo, menu de jeux, accessibilité partagée,
// gestion des panneaux modaux, et délégation du rendu/inputs au module du jeu actif (games/<id>/client.js).

let ws = null;
let you = { id: null, name: '', token: localStorage.getItem('pong-lan-token') || '' };
let myName = (localStorage.getItem('pong-lan-name') || '').slice(0, 12);
let gamesMeta = [], activeId = null;
let mod = null, modId = null, modReady = false, loadingId = null;
const pend = {};                 // g -> { msgs:[], lb, state } : messages tamponnés tant que le module n'est pas prêt
const pfor = g => pend[g] || (pend[g] = { msgs: [], lb: null, state: null });

/* ---------- DOM shell ---------- */
const msgTxt = document.getElementById('msg-txt'), statusDot = document.getElementById('status-dot');
const nameInput = document.getElementById('nameInput');
const gamemenu = document.getElementById('gamemenu');
const scrim = document.getElementById('scrim');
const settingsPanel = document.getElementById('settings');
const setBtn = document.getElementById('setBtn'), setFloat = document.getElementById('setFloat');
const setTheme = document.getElementById('setTheme'), setMusic = document.getElementById('setMusic');
const setPalette = document.getElementById('setPalette'), setContrast = document.getElementById('setContrast'), setFx = document.getElementById('setFx');
const setSfx = document.getElementById('setSfx'), setFull = document.getElementById('setFull');

/* ---------- accessibilité (partagée, persistée) ---------- */
const a11y = Object.assign({ palette: 'normal', contrast: false, reduceFx: false, theme: 'neon', music: false, sfx: 1 },
  JSON.parse(localStorage.getItem('pong-lan-a11y') || localStorage.getItem('pong-a11y') || '{}'));
function applyA11y() {
  document.body.classList.toggle('flat', a11y.reduceFx);
  document.body.classList.remove('theme-neon', 'theme-crt', 'theme-light');
  document.body.classList.add('theme-' + (a11y.theme || 'neon'));
  setTheme.value = a11y.theme; setMusic.checked = a11y.music;
  setPalette.value = a11y.palette; setContrast.checked = a11y.contrast; setFx.checked = a11y.reduceFx;
  if (setSfx) setSfx.value = Math.round((a11y.sfx == null ? 1 : a11y.sfx) * 100);
  localStorage.setItem('pong-lan-a11y', JSON.stringify(a11y));
  if (mod && mod.onA11y) mod.onA11y();
}
setPalette.onchange = () => { a11y.palette = setPalette.value; applyA11y(); };
setContrast.onchange = () => { a11y.contrast = setContrast.checked; applyA11y(); };
setFx.onchange = () => { a11y.reduceFx = setFx.checked; applyA11y(); };
setTheme.onchange = () => { a11y.theme = setTheme.value; applyA11y(); };
setMusic.onchange = () => { a11y.music = setMusic.checked; applyA11y(); };
if (setSfx) setSfx.oninput = () => { a11y.sfx = (parseInt(setSfx.value, 10) || 0) / 100; applyA11y(); };
if (setFull) setFull.onclick = () => { if (document.fullscreenElement) document.exitFullscreen && document.exitFullscreen(); else document.documentElement.requestFullscreen && document.documentElement.requestFullscreen(); };
/* vibration tactile (mobile) sur les boutons de contrôle .touch */
document.addEventListener('pointerdown', e => { if (e.target.closest && e.target.closest('.touch')) { try { navigator.vibrate && navigator.vibrate(8); } catch {} } }, { passive: true });

/* ---------- panneaux modaux (partagés shell + jeu) ---------- */
function closePanels() { document.querySelectorAll('.settings').forEach(p => p.classList.add('hidden')); scrim.classList.add('hidden'); }
function togglePanel(p) { const show = p.classList.contains('hidden'); closePanels(); if (show) { p.classList.remove('hidden'); scrim.classList.remove('hidden'); } }
scrim.onclick = closePanels;
document.querySelectorAll('.sclose').forEach(b => b.onclick = closePanels);
setBtn.onclick = () => togglePanel(settingsPanel);
setFloat.onclick = () => togglePanel(settingsPanel);

/* ---------- quitter / abandonner la partie en cours (visible seulement en jeu) ---------- */
const quitFloat = document.getElementById('quitFloat');
if (quitFloat) quitFloat.onclick = () => { closePanels(); gameSend({ t: 'abort' }); };

/* ---------- pseudo ---------- */
nameInput.value = myName;
nameInput.onchange = () => { myName = nameInput.value.trim().slice(0, 12); localStorage.setItem('pong-lan-name', myName); send({ t: 'name', name: myName }); };

/* ---------- menu de jeux ---------- */
function renderMenu() {
  gamemenu.innerHTML = gamesMeta.map(g =>
    `<button class="gtab ${g.id === activeId ? 'on' : ''}" data-id="${g.id}" title="${g.desc || ''}">${g.name}</button>`).join('');
  gamemenu.querySelectorAll('.gtab').forEach(b => b.onclick = () => send({ t: 'pick', id: b.dataset.id }));
}

/* ---------- chargement dynamique du module de jeu actif ---------- */
async function loadModule(id) {
  if (modId === id || loadingId === id) return;
  loadingId = id;
  const xf = document.getElementById('xfade'); if (xf) xf.style.opacity = '1';   // fondu de transition entre jeux
  if (mod && mod.teardown) { try { mod.teardown(); } catch {} }
  mod = null; modId = null; modReady = false;
  document.querySelectorAll('.game-root').forEach(r => r.classList.add('hidden'));
  const rootEl = document.getElementById(id + '-root');
  if (rootEl) rootEl.classList.remove('hidden');
  try {
    const m = await import(`./games/${id}/client.js`);
    if (loadingId !== id) return;                 // un chargement plus récent a pris le relais
    mod = m.default;
    mod.init({ root: rootEl || document.body, send: gameSend, a11y, togglePanel, closePanels });
    modId = id; modReady = true; loadingId = null;
    if (mod.onA11y) mod.onA11y();
    const p = pend[id];                           // vider le tampon de ce jeu
    if (p) { p.msgs.forEach(x => mod.onMessage && mod.onMessage(x)); if (p.lb && mod.onLb) mod.onLb(p.lb); if (p.state && mod.onState) mod.onState(p.state); delete pend[id]; }
    if (xf) xf.style.opacity = '0';               // révèle le nouveau jeu
  } catch (e) { loadingId = null; if (xf) xf.style.opacity = '0'; msgTxt.textContent = 'Jeu « ' + id + ' » indisponible'; }
}

/* ---------- confettis de victoire (overlay global, zéro dépendance) ---------- */
const confettiCv = document.getElementById('confetti');
let confettiRaf = 0;
const lastGs = {};                 // g -> dernier gameState vu (pour ne déclencher qu'une fois)
function fireConfetti() {
  if (!confettiCv || a11y.reduceFx) return;                       // respecte « réduire les effets »
  const dpr = window.devicePixelRatio || 1, W = innerWidth, H = innerHeight;
  confettiCv.width = Math.round(W * dpr); confettiCv.height = Math.round(H * dpr);
  confettiCv.style.width = W + 'px'; confettiCv.style.height = H + 'px';
  const cx = confettiCv.getContext('2d');
  const cols = ['#4a9ee0', '#e06240', '#2aaf7a', '#cc9010', '#9b6cf0', '#e268b0', '#ffd36e'];
  const parts = [];
  for (let i = 0; i < 140; i++) parts.push({ x: W * (0.15 + Math.random() * 0.7), y: -20 - Math.random() * H * 0.4, vx: (Math.random() * 2 - 1) * 3, vy: 2 + Math.random() * 4, r: 3 + Math.random() * 4, rot: Math.random() * 6.28, vr: (Math.random() * 2 - 1) * 0.3, c: cols[(Math.random() * cols.length) | 0], life: 1 });
  const t0 = performance.now();
  cancelAnimationFrame(confettiRaf);
  const step = () => {
    const age = performance.now() - t0;
    cx.setTransform(dpr, 0, 0, dpr, 0, 0); cx.clearRect(0, 0, W, H);
    let alive = 0;
    for (const p of parts) {
      p.vy += 0.08; p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.vx *= 0.995;
      if (age > 2200) p.life -= 0.04;
      if (p.life <= 0 || p.y > H + 30) continue;
      alive++;
      cx.save(); cx.globalAlpha = Math.max(0, p.life); cx.translate(p.x, p.y); cx.rotate(p.rot);
      cx.fillStyle = p.c; cx.fillRect(-p.r, -p.r * 0.5, p.r * 2, p.r); cx.restore();
    }
    if (alive > 0 && age < 4500) confettiRaf = requestAnimationFrame(step);
    else cx.clearRect(0, 0, W, H);
  };
  confettiRaf = requestAnimationFrame(step);
}

/* ---------- réseau ---------- */
function send(o) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); }
function gameSend(m) { send({ t: 'g', m }); }     // messages destinés au jeu actif
function setStatus(txt, cls) { msgTxt.innerHTML = txt; statusDot.className = cls || ''; }

function connect() {
  setStatus('Connexion…', '');
  const wsProto = location.protocol === 'https:' ? 'wss:' : 'ws:';   // wss en ligne (HTTPS Render), ws en LAN local
  ws = new WebSocket(`${wsProto}//${location.host}${you.token ? '/?t=' + encodeURIComponent(you.token) : ''}`);
  ws.onopen = () => { if (myName) send({ t: 'name', name: myName }); };
  ws.onmessage = e => {
    let m; try { m = JSON.parse(e.data); } catch { return; }
    if (m.t === 'hello') {
      you = { id: m.you.id, name: m.you.name, token: m.you.token };
      if (m.you.token) localStorage.setItem('pong-lan-token', m.you.token);
      gamesMeta = m.games || []; activeId = m.active;
      statusDot.className = 'ok'; renderMenu(); loadModule(activeId);
    } else if (m.t === 'room') {
      activeId = m.active; renderMenu(); loadModule(activeId);
      const ps = m.players || [];
      const me = ps.find(p => p.id === you.id);
      const human = ps.filter(p => p.role !== 'spectator').length;
      setStatus(`${me && me.role === 'spectator' ? 'Spectateur · ' : ''}${human} connecté${human > 1 ? 's' : ''}`, 'ok');
    } else if (m.t === 'g') {
      const g = m.g || activeId;
      if (modReady && modId === g) { if (mod.onMessage) mod.onMessage(m.m); } else pfor(g).msgs.push(m.m);
    } else if (m.t === 'lb') {
      if (modReady && modId === m.g) { if (mod.onLb) mod.onLb({ board: m.board || [], history: m.history || [] }); } else pfor(m.g).lb = { board: m.board || [], history: m.history || [] };
    } else if (m.t === 'state') {
      const g = m.g; const s = { ...m }; delete s.t; delete s.g;
      if (s.gs === 'over' && typeof s.winner === 'number' && s.winner >= 0 && lastGs[g] !== 'over') fireConfetti();  // 🎉 victoire (pas une égalité)
      lastGs[g] = s.gs;
      if (modId !== g) loadModule(g);
      if (modReady && modId === g) { if (mod.onState) mod.onState(s); } else pfor(g).state = s;
    }
  };
  ws.onclose = () => { setStatus('Déconnecté — reconnexion…', 'off'); setTimeout(connect, 1000); };
}

applyA11y();
connect();
