// Module client SNAKE : serpents sur grille partagée, pastilles à manger, dernier en vie gagne. FFA + équipes.
import { GW as GW0, GH as GH0, CELL as CELL0, ARENA } from './shared.js';
// grille dynamique (nb de joueurs) : l'arène garde la MÊME taille logique, seule la taille des cases change
let GW = GW0, GH = GH0, CELL = CELL0;
import { createMusic } from '../../music.js';
import { seatPattern, SEAT_GLYPH } from '../../patterns.js';   // motifs par siège (lisibilité daltonien / jusqu'à 10 joueurs)
import { initGameMsg, msgPerso, msgGlobal } from '../../gamemsg.js';   // retour de test : l'icône seule ne dit pas l'effet, on l'écrit

// musique : jardin léger — nappe douce majeure, plucks pentatoniques ; climax (sprint food-rush / duel) = contre-voix + tempo
const MUSIC_THEME = { bpm: 102, bpmBoost: 12, vol: 0.42, root: 130.81, len: 32,
  stingers: { kill: { notes: [7, 3, 0], wave: 'triangle', oct: 1, gain: 0.04, dur: 0.16 }, win: { base: 261.63, notes: [[0, 4, 7], [5, 9, 12], [7, 12, 16]], gain: 0.035, dur: 0.3, rate: 0.13 },
    count: { notes: [0], oct: 2, wave: 'triangle', dur: 0.1, gain: 0.045, duck: false }, go: { notes: [[0, 4, 7]], oct: 1, dur: 0.4, gain: 0.05, duck: false } },
  layers: [
  { seq: [[0, 4], null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, [5, 9], null, null, null, null, null, null, null, null, null, null, null, null, null, null, null], wave: 'sine', gain: 0.022, dur: 14 },
  { seq: [0, null, 2, null, 4, null, 7, null, 9, null, 7, null, 4, null, 2, null, 0, null, 4, null, 7, null, 9, null, 12, null, 9, null, 7, null, 4, null], oct: 1, wave: 'triangle', gain: 0.028, dur: 1.4, min: 1 },
  { seq: [null, null, 16, null, null, null, 14, null, null, null, 12, null, null, null, 9, null], oct: 1, wave: 'sine', gain: 0.018, dur: 1.2, min: 2 },
] };

const MAX_SEATS = 10;                               // sièges max côté serveur pour Snake
// au-delà de 8 sièges il n'existe plus de teintes toutes distinguables : c'est le MOTIF par siège (patterns.js) qui porte l'identification
const PAL = { normal: ['#4a9ee0', '#e06240', '#2aaf7a', '#cc9010', '#9b6cf0', '#e268b0', '#25c9c0', '#9ec93a', '#d06ef0', '#f2f0e6'],
              cb: ['#0072B2', '#E69F00', '#009E73', '#F0E442', '#CC79A7', '#56B4E9', '#D55E00', '#F5F5F5', '#7B68EE', '#9A9A9A'] };
const TEAMPAL = { normal: ['#4a9ee0', '#e06240', '#2aaf7a', '#cc9010', '#9b6cf0'], cb: ['#0072B2', '#E69F00', '#009E73', '#F0E442', '#CC79A7'] };
const TEAM_LETTER = ['A', 'B', 'C', 'D', 'E'];
const MODE_NAME = { ffa: 'Chacun pour soi', '2v2': '2 v 2', '2v2v2': '2 v 2 v 2', '3v3': '3 v 3', '4v4': '4 v 4', '2v2v2v2': '2 v 2 v 2 v 2', '3v3v3': '3 v 3 v 3', '5v5': '5 v 5', '2v2v2v2v2': '2 v 2 v 2 v 2 v 2' };
const TEAM_TOTALS = [4, 6, 8, 9, 10];               // effectifs pour lesquels un mode par équipes existe (4→2v2 … 10→5v5 / 2v2v2v2v2)
const VARIANT_NAMES = ['🐍 Classique', '🌀 Murs traversants', '🪨 Obstacles'];
// Libellés des nourritures spéciales : dire l'EFFET, pas le nom (les icônes 🟡🍄👻 ne sont pas parlantes).
// Volontairement PAS de message pour la pomme ordinaire : on en ramasse une toutes les deux secondes,
// ce serait un bandeau permanent — et c'est la seule nourriture dont l'icône se comprend seule.
// Ces nourritures n'affectent QUE celui qui les mange (cf. games/snake/server.js) : elles sont donc personnelles.
const FOOD_MSG = {
  gold:   { i: '🟡', t: 'Pomme dorée : +3 points' },
  shrink: { i: '🍄', t: 'Champignon : tu raccourcis' },
  ghost:  { i: '👻', t: 'Fantôme : tu traverses les serpents' },
};
// identité visuelle propre au jeu (fixe) : Jardin / Terrarium
const SKIN = { bg: '#0f2410', field: '#1c3a17', field2: '#234a1d', grid: 'rgba(170,255,150,0.05)', border: 'rgba(120,200,110,0.55)', apple: true };
// fond animé : lucioles qui flânent + pétales qui tombent (identité jardin) — coupé par reduceFx
const AMB_FLY = Array.from({ length: 12 }, () => ({ x: Math.random(), y: Math.random(), ph: Math.random() * 6.28, r: 1.3 + Math.random() }));
const AMB_PETAL = Array.from({ length: 6 }, () => ({ x: Math.random(), v: 9 + Math.random() * 12, ph: Math.random() * 6.28, s: 2 + Math.random() * 2 }));
const AMB_FLOWERS = Array.from({ length: 14 }, () => ({ x: Math.random(), y: Math.random(), w: Math.random() < 0.5 }));   // pâquerettes statiques très pâles (déco du jardin)
const INTERP_MS = 90;
const DIR_KEYS = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right' };

export default (function () {
  let A, send, root, cv, ctx, togglePanel = () => {}, closePanels = () => {};
  let CC = PAL.normal, TEAMCC = TEAMPAL.normal, TH = SKIN, FX = 1;
  let mySeat = -1, snap = null, prevGs = 'lobby', teamMode = false, endShown = false, inGamePrev = false, prevRound = -1, _lastCount = -1;
  let rushAlerted = false, duelAlerted = false;   // messages globaux « une seule fois par manche »
  let board = [], buf = [];
  const particles = [];
  let shakeMag = 0, rafId = 0, destroyed = false, resizeH = null, actx = null;
  const music = createMusic(() => actx, () => A, MUSIC_THEME);
  let hud, cards, startBtn, pauseBtn, modeBtn, variantBtn, rushBtn, botsBtn, diffBtn, pauseFloat, lbBtn, lbPanel, lbBody, endEl;
  const DIFF_NAMES = ['Facile', 'Normale', 'Difficile'];

  const $ = id => root.querySelector('#' + id);
  const colSeat = s => { if (s < 0 || !snap) return '#fff'; const p = snap.players[s]; return teamMode && p ? TEAMCC[p.team % TEAMCC.length] : CC[s % CC.length]; };   // modulo : jamais de couleur indéfinie si un siège dépasse la palette
  const px = c => c * CELL + CELL / 2;
  function applyColors() { CC = PAL[A.palette] || PAL.normal; TEAMCC = TEAMPAL[A.palette] || TEAMPAL.normal; FX = A.reduceFx ? 0 : 1; TH = SKIN; }

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
      if (!cards[i]) return;        // filet : le serveur annonce plus de sièges que de cartes créées
      const shown = p.connected || p.playing;
      cards[i].classList.toggle('hidden', !shown);
      if (!shown) return;
      const col = colSeat(i);
      cards[i].style.color = col;
      cards[i].classList.toggle('dead', p.playing && !p.alive);
      cards[i].classList.toggle('me', i === mySeat);
      const tags = [];
      if (teamMode) tags.push(`<span class="badge" style="background:${col}28;color:${col}">ÉQ.${TEAM_LETTER[p.team]}</span>`);
      if (p.bot) tags.push(`<span class="badge" style="background:${col}28;color:${col}">BOT</span>`);
      else if (i === mySeat) tags.push(`<span class="badge" style="background:${col}28;color:${col}">VOUS</span>`);
      const gly = `<span class="sc" title="motif du siège">${SEAT_GLYPH[i % SEAT_GLYPH.length] || ''}</span>`;   // constante : jamais de texte réseau ici
      cards[i].querySelector('.pn').innerHTML = `${(window.__AV && window.__AV(p.name)) || ''}${gly}${p.name || ('P' + (i + 1))} <span class="sc">${p.kills} ⚡</span> ${tags.join('')}`;
      const lv = cards[i].querySelector('.lv'); lv.style.color = col;
      lv.textContent = p.playing ? (p.alive ? `● L${p.len} · 🍎${p.score}` : '✖ mort') : 'prêt';
    });
  }
  function renderLB() {
    if (!lbBody) return;
    if (!board.length) { lbBody.innerHTML = '<div class="lbnote">Aucune partie enregistrée (le solo ne compte pas).</div>'; return; }
    const B = board.map(e => ({ ...e, kd: e.deaths ? e.kills / e.deaths : e.kills }));
    lbBody.innerHTML = B.sort((a, b) => b.wins - a.wins || (b.bestScore || 0) - (a.bestScore || 0)).map(e =>
      `<div class="lbrow"><span class="lbn">${e.name}</span><span>🎮${e.games}</span><span>🏆${e.wins}</span><span title="kills">⚡${e.kills}</span><span title="meilleur score">🍎${e.bestScore || 0}</span><span title="meilleure survie">⏱${Math.round(e.bestSurvivalSec || 0)}s</span></div>`).join('');
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
      const res = p.alive ? 'survivant·e' : `mort à ${Math.round((p.elimTick || 0) / 12)}s`;
      return `<div class="erow ${p.alive ? 'win' : ''}"><span class="eplace">${medal}</span>
        <span class="ename" style="color:${col}">${p.name || ('P' + (p.seat + 1))}${teamMode ? ` <small>Éq.${TEAM_LETTER[p.team]}</small>` : ''}</span>
        <span class="estat" title="longueur">📏 ${p.len}</span><span class="estat" title="pastilles">🍎 ${p.score}</span><span class="eres">${res}</span></div>`;
    }).join('');
    endEl.innerHTML = `<div class="etitle" style="color:${champ ? colSeat(champ.seat) : '#fff'}">${title}</div>
      <div class="emeta">⏱ ${m.stats.durationSec}s · ${m.stats.nParts} joueur${m.stats.nParts > 1 ? 's' : ''}</div><div class="elist">${rows}</div><div class="ehint">Espace / clic pour rejouer</div>`;
  }

  function onMessage(m) { if (m && m.t === 'welcome') mySeat = m.seat; }
  function onLb(d) { board = d.board || []; renderLB(); }
  function onState(m) {
    if (m.gw && m.gw !== GW) { GW = m.gw; GH = m.gh || m.gw; CELL = ARENA / GW; }   // grille redimensionnée
    snap = m; teamMode = m.mode && m.mode !== 'ffa';
    const inGame = m.gs === 'play' || m.gs === 'countdown' || m.gs === 'paused';
    if (inGame !== inGamePrev) { inGamePrev = inGame; document.body.classList.toggle('playing', inGame); resizeCanvas(); }
    document.body.classList.toggle('paused', m.gs === 'paused');
    if (m.gs === 'play' || m.gs === 'countdown') closePanels();
    if (m.round !== prevRound) { prevRound = m.round; buf = []; particles.length = 0; rushAlerted = duelAlerted = false; }
    buf.push({ t: performance.now(), s: m }); if (buf.length > 10) buf.shift();
    (m.fx || []).forEach(playFx);
    if (prevGs !== 'over' && m.gs === 'over') { sound('win'); music.sting('win'); }
    if (m.gs === 'countdown' && m.count > 0 && m.count !== _lastCount) music.sting('count');   // décompte musical 3·2·1
    if (prevGs === 'countdown' && m.gs === 'play') music.sting('go');
    _lastCount = m.count;
    prevGs = m.gs;
    { let inten = 0;                                  // musique : 1 en jeu, 2 = sprint final food-rush ou duel (parmi 3+)
      if (m.gs === 'play' || m.gs === 'countdown') {
        inten = 1;
        if (m.rush) { let lead = 0; m.players.forEach(p => { if (p.playing && p.score > lead) lead = p.score; });
          if (lead >= (m.rushTarget || 20) * 0.7) { inten = 2; if (!rushAlerted) { rushAlerted = true; msgGlobal('🏁', 'Sprint final : cible proche', { color: '#ffd24a' }); } } }   // concerne tout le monde : bande haute, une seule fois par manche
        else { const tot = m.players.filter(p => p.playing).length, alive = m.players.filter(p => p.playing && p.alive).length;
          if (tot >= 3 && alive <= 2) { inten = 2; if (alive === 2 && !duelAlerted) { duelAlerted = true; msgGlobal('⚔', 'Duel final : deux survivants'); } } }
      }
      music.setIntensity(inten); }
    refreshHUD();
    if (m.gs === 'over') { if (!endShown) { showEndscreen(m); endShown = true; } }
    else { endShown = false; endEl.classList.add('hidden'); }
    const idle = m.gs === 'lobby' || m.gs === 'over';
    startBtn.disabled = !(mySeat >= 0 && idle && m.connected >= 1);
    startBtn.textContent = m.gs === 'over' ? '↻ Rejouer' : '▶ Démarrer';
    pauseBtn.disabled = !(m.gs === 'play' || m.gs === 'paused');
    pauseBtn.textContent = m.gs === 'paused' ? '▶ Reprendre' : '⏸ Pause';
    pauseFloat.textContent = m.gs === 'paused' ? '▶' : '⏸';
    const total = m.connected + (m.botCount || 0);
    if (botsBtn) { botsBtn.disabled = !idle; botsBtn.textContent = '🤖 Bots : ' + (m.botCount || 0); botsBtn.classList.toggle('on', (m.botCount || 0) > 0); }
    if (diffBtn) { diffBtn.disabled = !idle; diffBtn.textContent = '🎯 IA : ' + (DIFF_NAMES[m.botDiff] || 'Normale'); }
    modeBtn.disabled = !(idle && TEAM_TOTALS.indexOf(total) >= 0);   // effectifs qui admettent au moins un mode par équipes
    modeBtn.textContent = '⚔ ' + (MODE_NAME[m.mode] || m.mode); modeBtn.classList.toggle('on', teamMode);
    if (variantBtn) { variantBtn.disabled = !idle; variantBtn.textContent = VARIANT_NAMES[m.variant] || VARIANT_NAMES[0]; variantBtn.classList.toggle('on', m.variant > 0); }
    if (rushBtn) { rushBtn.disabled = !idle; rushBtn.textContent = '🏁 ' + (m.rush ? 'Food-rush' : 'Survie'); rushBtn.classList.toggle('on', !!m.rush); }
  }

  function unlockAudio() { if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch {} } if (actx && actx.state === 'suspended') actx.resume(); }
  let sndPan = 0;                                   // pan stéréo du prochain son
  function tone(f, d, ty = 'square', g = 0.05, dl = 0) { const _v = (A && typeof A.sfx === 'number') ? A.sfx : 1; if (!actx || _v <= 0) return; const t0 = actx.currentTime + dl, o = actx.createOscillator(), gg = actx.createGain(); o.type = ty; o.frequency.setValueAtTime(f, t0); gg.gain.setValueAtTime(g * _v, t0); gg.gain.exponentialRampToValueAtTime(0.0001, t0 + d); o.connect(gg); let dest = actx.destination; if (sndPan && actx.createStereoPanner) { const pn = actx.createStereoPanner(); pn.pan.value = Math.max(-1, Math.min(1, sndPan)); pn.connect(actx.destination); dest = pn; } gg.connect(dest); o.start(t0); o.stop(t0 + d); }
  function psound(k, gx) { sndPan = Math.max(-1, Math.min(1, (px(gx) / ARENA - 0.5) * 1.7)); sound(k); sndPan = 0; }   // son positionné gauche/droite
  function sound(k) { if (!actx) return; if (k === 'crash') { tone(180, 0.22, 'sawtooth', 0.06); tone(90, 0.3, 'sawtooth', 0.05, 0.04); } else if (k === 'eat') { tone(620, 0.06, 'square', 0.05); tone(880, 0.07, 'square', 0.05, 0.05); } else if (k === 'win') { tone(523, 0.18, 'triangle', 0.06); tone(659, 0.18, 'triangle', 0.06, 0.12); tone(784, 0.3, 'triangle', 0.06, 0.24); } }
  function playFx(f) {
    if (f.type === 'eat') { if (f.seat === mySeat) { psound('eat', f.x); const fm = FOOD_MSG[f.ft || 'apple']; if (fm) msgPerso(fm.i, fm.t); }   // nourriture spéciale ramassée par MOI : on annonce l'effet (les autres n'en sont pas affectés, donc rien à leur dire)
      if (!A.reduceFx) { const x = px(f.x), y = px(f.y), now = performance.now(); for (let k = 0; k < 8; k++) { const a = Math.random() * Math.PI * 2, sp = 1 + Math.random() * 2.2; particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, born: now, life: 300 + Math.random() * 180, color: '#ff5a6a' }); } } return; }   // éclaboussure de pomme
    if (f.type === 'crash') {
      psound('crash', f.x); music.sting('kill'); if (A.reduceFx) return;
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

  let terrainCv = null, terrainKey = '';            // décor statique pré-rendu (damier + grille + bordure + fleurs) — redessiné seulement au resize
  function ensureTerrain() {
    const key = cv.width + '|' + GW;   // le damier dépend aussi de la taille de grille
    if (terrainCv && key === terrainKey) return;
    terrainKey = key;
    if (!terrainCv) terrainCv = document.createElement('canvas');
    terrainCv.width = cv.width; terrainCv.height = cv.height;
    const old = ctx; ctx = terrainCv.getContext('2d');
    ctx.setTransform(cv.width / ARENA, 0, 0, cv.width / ARENA, 0, 0);
    ctx.fillStyle = TH.bg; ctx.fillRect(0, 0, ARENA, ARENA);
    if (TH.field2) { for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) { ctx.fillStyle = ((gx + gy) & 1) ? TH.field : TH.field2; ctx.fillRect(gx * CELL, gy * CELL, CELL, CELL); } } // damier d'herbe (skin Jardin)
    else { ctx.fillStyle = TH.field; ctx.fillRect(0, 0, ARENA, ARENA); }
    { ctx.save(); for (const fl of AMB_FLOWERS) { const x = fl.x * ARENA, y = fl.y * ARENA; ctx.globalAlpha = 0.20; ctx.fillStyle = fl.w ? '#eef7e2' : '#ffd9e8'; for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + 0.5; ctx.beginPath(); ctx.arc(x + Math.cos(a) * 2.4, y + Math.sin(a) * 2.4, 1.7, 0, Math.PI * 2); ctx.fill(); } ctx.globalAlpha = 0.25; ctx.fillStyle = '#ffe28a'; ctx.beginPath(); ctx.arc(x, y, 1.4, 0, Math.PI * 2); ctx.fill(); } ctx.restore(); }   // pâquerettes
    ctx.strokeStyle = TH.grid; ctx.lineWidth = 1;
    for (let i = 0; i <= GW; i += 5) { const x = i * CELL; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, ARENA); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, x); ctx.lineTo(ARENA, x); ctx.stroke(); }
    ctx.strokeStyle = TH.border || 'rgba(255,255,255,0.22)'; ctx.lineWidth = 3; ctx.strokeRect(1.5, 1.5, ARENA - 3, ARENA - 3);
    ctx = old;
  }
  // ——— Logo du lobby : « SNAKE » porté par une tige végétale qui ondule (identité jardin) ———
  const TITLE = 'SNAKE', TITLE_FONT = 'Fredoka, "Segoe UI", sans-serif';
  let titleLay = null;                              // mesures du logo : recalculées de loin en loin (police Google chargée tard)
  function layoutTitle(now) {
    let fs = Math.min(34, ARENA * 0.075);
    const ws = [];
    let total = 0;
    for (let pass = 0; pass < 4; pass++) {          // réduit la police tant que le mot + la tête dépassent l'arène (mobile)
      ctx.font = '700 ' + fs.toFixed(1) + 'px ' + TITLE_FONT;
      ws.length = 0; total = 0;
      for (let i = 0; i < TITLE.length; i++) { const cw = ctx.measureText(TITLE.charAt(i)).width; ws.push(cw); total += cw; }
      total += fs * 0.06 * (TITLE.length - 1);
      if (total + fs * 2.2 <= ARENA * 0.94 || fs <= 14) break;
      fs = Math.max(14, fs * (ARENA * 0.94) / (total + fs * 2.2));
    }
    return { at: now, fs, ws, total };
  }
  function drawTitle(cx, cy, now) {
    if (!titleLay || now - titleLay.at > 600) titleLay = layoutTitle(now);
    const fs = titleLay.fs, ws = titleLay.ws, total = titleLay.total, n = TITLE.length;
    const soft = !A.reduceFx, t = soft ? now / 1000 : 0, amp = soft ? fs * 0.11 : 0;
    const x0 = cx - total / 2, gap = fs * 0.06, sx = x0 - fs * 0.3, sw = total + fs * 0.9;
    const wave = u => Math.sin(t * 1.4 - u * 2.8) * amp;          // ondulation lente commune à la tige et aux lettres
    const stemY = u => cy + fs * 0.14 + wave(u) * 1.3;
    ctx.save();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.font = '700 ' + fs.toFixed(1) + 'px ' + TITLE_FONT;
    ctx.strokeStyle = '#3f8f45'; ctx.lineWidth = Math.max(2, fs * 0.10);          // la tige, derrière les lettres
    ctx.beginPath();
    for (let k = 0; k <= 22; k++) { const u = k / 22, x = sx + u * sw, y = stemY(u); if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
    ctx.stroke();
    for (let k = 0; k < 5; k++) {                                                 // feuilles qui poussent le long de la tige
      const u = 0.09 + k * 0.17, x = sx + u * sw, y = stemY(u), up = (k & 1) === 0;
      const gr = soft ? 0.8 + 0.2 * Math.sin(t * 1.1 + k * 1.3) : 1, len = fs * (up ? 0.40 : 0.22) * gr;
      ctx.save(); ctx.translate(x, y); ctx.rotate(up ? -1.05 : 0.75);
      ctx.fillStyle = up ? '#79cf6f' : '#57b45c';
      ctx.beginPath(); ctx.ellipse(len * 0.58, 0, len * 0.58, len * 0.26, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(18,64,22,0.35)'; ctx.lineWidth = Math.max(1, fs * 0.028);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(len * 1.1, 0); ctx.stroke();
      ctx.restore();
    }
    if (soft) {                                                                   // pollen qui monte : 5 points dérivés du temps, aucun état
      ctx.fillStyle = '#e6ffc0';
      for (let k = 0; k < 5; k++) {
        const pr = (t * 0.17 + k * 0.2) % 1, ppx = x0 + total * ((0.1 + k * 0.21 + Math.sin(t * 0.5 + k) * 0.04) % 1), ppy = cy + fs * 0.1 - pr * fs * 2.1;
        ctx.globalAlpha = 0.42 * (1 - pr); ctx.beginPath(); ctx.arc(ppx, ppy, fs * 0.045 + 0.5, 0, 6.2832); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    const gd = ctx.createLinearGradient(0, cy - fs * 0.65, 0, cy + fs * 0.45);    // feuillage clair en haut, vert profond en bas
    gd.addColorStop(0, '#f4ffe0'); gd.addColorStop(0.55, '#aae88e'); gd.addColorStop(1, '#5cb862');
    let lx = x0;
    for (let i = 0; i < n; i++) {                                                 // lettres : chacune ondule avec un décalage de phase
      const u = (lx + ws[i] / 2 - x0) / Math.max(1, total), cxi = lx + ws[i] / 2, cyi = cy - fs * 0.12 + wave(u);
      if (soft) { ctx.shadowColor = 'rgba(140,235,150,0.55)'; ctx.shadowBlur = fs * 0.5; }
      ctx.strokeStyle = '#1d5a26'; ctx.lineWidth = fs * 0.17; ctx.strokeText(TITLE.charAt(i), cxi, cyi);
      ctx.shadowBlur = 0; ctx.fillStyle = gd; ctx.fillText(TITLE.charAt(i), cxi, cyi);
      lx += ws[i] + gap;
    }
    const hx = sx + sw, hy = stemY(1), hr = fs * 0.22;                            // petite tête de serpent au bout de la tige
    ctx.save(); ctx.translate(hx, hy); ctx.rotate(Math.atan2(hy - stemY(0.93), sw * 0.07));
    ctx.fillStyle = '#6ec96a'; ctx.beginPath(); ctx.ellipse(hr * 0.4, 0, hr * 1.3, hr * 0.92, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(hr * 0.62, -hr * 0.32, hr * 0.3, 0, 6.2832); ctx.fill();
    ctx.fillStyle = '#12301a'; ctx.beginPath(); ctx.arc(hr * 0.72, -hr * 0.32, hr * 0.15, 0, 6.2832); ctx.fill();
    if (soft && t % 2.6 < 0.3) {                                                  // langue fourchue qui claque de temps en temps
      ctx.strokeStyle = '#ff6b8a'; ctx.lineWidth = Math.max(1, fs * 0.045);
      ctx.beginPath(); ctx.moveTo(hr * 1.6, hr * 0.1); ctx.lineTo(hr * 2.4, hr * 0.1); ctx.lineTo(hr * 3, -hr * 0.25); ctx.moveTo(hr * 2.4, hr * 0.1); ctx.lineTo(hr * 3, hr * 0.45); ctx.stroke();
    }
    ctx.restore();
    ctx.restore();
  }
  function draw() {
    if (destroyed) return;
    const now = performance.now();
    const sc = cv.width / ARENA;
    let ox = 0, oy = 0;
    if (shakeMag > 0.3 && !A.reduceFx) { ox = (Math.random() * 2 - 1) * shakeMag; oy = (Math.random() * 2 - 1) * shakeMag; shakeMag *= 0.85; } else shakeMag = 0;
    ctx.setTransform(sc, 0, 0, sc, ox * sc, oy * sc);
    ensureTerrain(); ctx.drawImage(terrainCv, 0, 0, ARENA, ARENA);   // décor statique pré-rendu (1 drawImage au lieu de ~950 tracés)
    if (!A.reduceFx) {                                 // lucioles + pétales (ambiance jardin)
      ctx.save();
      ctx.fillStyle = '#d8ff9a';
      for (const f of AMB_FLY) { const x = f.x * ARENA + Math.sin(now / 2200 + f.ph) * 26, y = f.y * ARENA + Math.cos(now / 1900 + f.ph * 1.7) * 20, glow = 0.5 + 0.5 * Math.sin(now / 650 + f.ph); ctx.globalAlpha = 0.10 + 0.22 * glow; ctx.beginPath(); ctx.arc(x, y, f.r + glow, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = '#ffb7d0';
      for (const pe of AMB_PETAL) { const y = (pe.ph * 90 + now / 1000 * pe.v) % (ARENA + 12) - 6, x = pe.x * ARENA + Math.sin(now / 1300 + pe.ph) * 14; ctx.globalAlpha = 0.18; ctx.save(); ctx.translate(x, y); ctx.rotate(now / 900 + pe.ph); ctx.beginPath(); ctx.ellipse(0, 0, pe.s, pe.s * 0.55, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
      ctx.restore();
    }

    if (snap) {
      (snap.rocks || []).forEach(ix => { const gx = ix % GW, gy = (ix / GW) | 0, x = gx * CELL, y = gy * CELL; ctx.fillStyle = '#5a5550'; ctx.fillRect(x + 2, y + 2, CELL - 4, CELL - 4); ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(x + 2, y + 2, CELL - 4, 3); ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(x + 2, y + CELL - 5, CELL - 4, 3); }); // rochers
      // nourriture (types : pomme, pomme dorée 🟡, champignon 🍄 rétrécit, fantôme 👻)
      (snap.food || []).forEach(fd => {
        const x = px(fd.x), y = px(fd.y), pulse = 1 + 0.12 * Math.sin(now / 220 + fd.x + fd.y), r = CELL * 0.32 * pulse, t = fd.t || 'apple';
        ctx.save();
        if (t === 'shrink') {                       // champignon vectoriel (rendu identique sur tous les OS)
          if (!A.reduceFx) { ctx.shadowColor = '#ff8a8a'; ctx.shadowBlur = 8; }
          ctx.fillStyle = '#f4e7d0'; ctx.fillRect(x - 2.2, y, 4.4, 6);
          ctx.fillStyle = '#e8413a'; ctx.beginPath(); ctx.arc(x, y + 0.5, 7, Math.PI, 0); ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x - 3, y - 2.5, 1.3, 0, 6.29); ctx.arc(x + 2.5, y - 3.5, 1.5, 0, 6.29); ctx.fill();
        } else if (t === 'ghost') {                 // fantôme vectoriel
          if (!A.reduceFx) { ctx.shadowColor = '#bfe3ff'; ctx.shadowBlur = 8; }
          ctx.fillStyle = '#dceaff'; ctx.beginPath(); ctx.arc(x, y - 1, 6, Math.PI, 0); ctx.lineTo(x + 6, y + 4); ctx.arc(x + 4, y + 4, 2, 0, Math.PI); ctx.arc(x, y + 4, 2, 0, Math.PI); ctx.arc(x - 4, y + 4, 2, 0, Math.PI); ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#33405e'; ctx.beginPath(); ctx.arc(x - 2, y - 1.5, 1.2, 0, 6.29); ctx.arc(x + 2, y - 1.5, 1.2, 0, 6.29); ctx.fill();
        } else {
          const gold = t === 'gold', body = gold ? '#ffcf4a' : '#e8413a';
          if (gold && !A.reduceFx) { ctx.shadowColor = '#ffd24a'; ctx.shadowBlur = 13; }
          if (TH.apple) {
            ctx.fillStyle = '#2e8b3d'; ctx.fillRect(x - 1, y - r - 3, 2, 4);                                  // tige
            ctx.fillStyle = '#5fc36a'; ctx.beginPath(); ctx.ellipse(x + r * 0.5, y - r * 0.7, r * 0.45, r * 0.25, -0.7, 0, Math.PI * 2); ctx.fill(); // feuille
            ctx.fillStyle = body; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.beginPath(); ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.18, 0, Math.PI * 2); ctx.fill();
          } else {
            ctx.shadowColor = gold ? '#ffd24a' : '#ff5a6a'; ctx.shadowBlur = 10 * FX; ctx.fillStyle = gold ? '#ffcf4a' : '#ff5a6a';
            ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
            ctx.shadowBlur = 0; ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.beginPath(); ctx.arc(x - CELL * 0.1, y - CELL * 0.1, CELL * 0.08, 0, Math.PI * 2); ctx.fill();
          }
        }
        ctx.restore();
      });
      const heads = viewHeads(now);
      snap.players.forEach(p => {
        if (!p.playing || !p.alive) return;        // un serpent mort disparaît du plateau (il n'est plus un obstacle)
        const col = colSeat(p.seat), hv = heads && heads[p.seat];
        const hx = hv ? px(hv.x) : px(p.head.x), hy = hv ? px(hv.y) : px(p.head.y);
        const pat = seatPattern(ctx, p.seat, { size: Math.round(CELL * 1.5) });   // écailles du siège (null pour le siège 0)
        const ga = p.ghost ? (A.reduceFx ? 0.5 : 0.45 + 0.25 * Math.sin(now / 110)) : 1;   // fantôme : translucide
        ctx.save(); ctx.globalAlpha = ga;
        ctx.strokeStyle = col; ctx.lineWidth = CELL - 2; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
        ctx.shadowColor = col; ctx.shadowBlur = 8 * FX;
        const path = p.path || [];
        if (path.length) {                            // dégradé vers la queue : chaque segment est tracé avec une opacité croissante vers la tête ; null = coupure de wrap (on relève le crayon)
          const nPts = path.filter(Boolean).length;
          let prev = null, k = 0;
          for (const pt of path) {
            if (!pt) { prev = null; continue; }
            if (prev) { const f = k / Math.max(1, nPts - 1); ctx.globalAlpha = ga * (0.35 + 0.65 * f); ctx.beginPath(); ctx.moveTo(px(prev[0]), px(prev[1])); ctx.lineTo(px(pt[0]), px(pt[1])); ctx.stroke(); }
            prev = pt; k++;
          }
          if (prev) { ctx.globalAlpha = ga; ctx.beginPath(); ctx.moveTo(px(prev[0]), px(prev[1])); ctx.lineTo(hx, hy); ctx.stroke(); }
          if (pat) {                                  // surimpression du motif de siège : même tracé repassé d'un coup, sans halo
            ctx.globalAlpha = ga * 0.8; ctx.shadowBlur = 0; ctx.strokeStyle = pat;
            ctx.beginPath(); let pv = null;
            for (const pt of path) { if (!pt) { pv = null; continue; } if (pv) ctx.lineTo(px(pt[0]), px(pt[1])); else ctx.moveTo(px(pt[0]), px(pt[1])); pv = pt; }
            if (pv) ctx.lineTo(hx, hy);
            ctx.stroke();
          }
        }
        ctx.restore();
        // tête arrondie + yeux orientés selon la direction (un saut de wrap inverse le signe)
        let dx = 0, dy = 0;
        const pts = path.filter(Boolean);
        const sgn = v => Math.abs(v) > 1 ? -Math.sign(v) : Math.sign(v);
        if (pts.length >= 2) { const a = pts[pts.length - 2], b = pts[pts.length - 1]; dx = sgn(b[0] - a[0]); dy = sgn(b[1] - a[1]); }
        if (!dx && !dy) dx = 1;
        ctx.save(); ctx.globalAlpha = ga; ctx.shadowColor = col; ctx.shadowBlur = 12 * FX; ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(hx, hy, CELL * 0.55, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
        if (pat) { ctx.fillStyle = pat; ctx.beginPath(); ctx.arc(hx, hy, CELL * 0.55, 0, Math.PI * 2); ctx.fill(); }   // motif aussi sur la tête
        const perpx = -dy, perpy = dx, fwd = CELL * 0.12, side = CELL * 0.2, er = CELL * 0.14;
        for (const s of [-1, 1]) {
          const ex = hx + dx * fwd + perpx * side * s, ey = hy + dy * fwd + perpy * side * s;
          ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex, ey, er, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#10131c'; ctx.beginPath(); ctx.arc(ex + dx * er * 0.4, ey + dy * er * 0.4, er * 0.55, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
        if (p.seat === mySeat) { ctx.save(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.6 + 0.4 * Math.sin(now / 200); ctx.beginPath(); ctx.arc(hx, hy, CELL * 0.62, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
      });
    }
    if (!A.reduceFx) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; for (let i = particles.length - 1; i >= 0; i--) { const q = particles[i], t = (now - q.born) / q.life; if (t >= 1) { particles.splice(i, 1); continue; } q.x += q.vx; q.y += q.vy; q.vx *= 0.95; q.vy *= 0.95; ctx.globalAlpha = 1 - t; ctx.fillStyle = q.color; ctx.beginPath(); ctx.arc(q.x, q.y, 2.5 * (1 - t) + 0.5, 0, Math.PI * 2); ctx.fill(); } ctx.restore(); } else particles.length = 0;

    if (snap && snap.rush && (snap.gs === 'play' || snap.gs === 'countdown')) {   // food-rush : progression du meneur
      let lead = 0; (snap.players || []).forEach(p => { if (p.playing && p.score > lead) lead = p.score; });
      ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.fillStyle = 'rgba(4,5,12,0.5)'; const txt = `🏁 ${lead}/${snap.rushTarget || 20} 🍎`; ctx.font = 'bold 15px system-ui,sans-serif';
      const w = ctx.measureText(txt).width + 16; ctx.fillRect(ARENA / 2 - w / 2, 6, w, 22);
      ctx.fillStyle = '#ffd24a'; ctx.fillText(txt, ARENA / 2, 9); ctx.restore();
    }

    if (snap && snap.gs === 'countdown') {
      ctx.fillStyle = 'rgba(4,5,12,0.34)'; ctx.fillRect(0, 0, ARENA, ARENA); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const c = snap.count || 0, pulse = 1 + 0.08 * Math.sin(now / 110);
      ctx.save(); ctx.translate(ARENA / 2, ARENA / 2 - 4); ctx.scale(pulse, pulse); if (!A.reduceFx) { ctx.shadowColor = 'rgba(120,200,255,.7)'; ctx.shadowBlur = 26; }
      ctx.fillStyle = '#fff'; ctx.font = 'bold 92px system-ui,sans-serif'; ctx.fillText(c > 0 ? c : 'GO', 0, 0); ctx.restore();
      ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.font = '13px system-ui,sans-serif'; ctx.fillText('Prêt à ramper…', ARENA / 2, ARENA / 2 + 64);
    }
    if (snap && (snap.gs === 'lobby' || snap.gs === 'paused')) {
      ctx.fillStyle = 'rgba(4,5,12,0.66)'; ctx.fillRect(0, 0, ARENA, ARENA); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      if (snap.gs === 'paused') { ctx.fillStyle = '#fff'; ctx.font = 'bold 34px system-ui,sans-serif'; ctx.fillText('PAUSE', ARENA / 2, ARENA / 2 - 6); ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.font = '14px system-ui,sans-serif'; ctx.fillText('P / Échap pour reprendre', ARENA / 2, ARENA / 2 + 28); }
      else {
        drawTitle(ARENA / 2, ARENA / 2 - 36, now);   // logo animé : tige végétale + feuilles + tête de serpent
        const n = snap.connected, nb = snap.botCount || 0;
        ctx.fillStyle = teamMode ? '#9fd0ff' : 'rgba(255,255,255,.7)'; ctx.font = '15px system-ui,sans-serif'; ctx.fillText(`${n} joueur${n > 1 ? 's' : ''}${nb ? ' + ' + nb + ' bot' + (nb > 1 ? 's' : '') : ''}${teamMode ? ' · ' + (MODE_NAME[snap.mode] || snap.mode) : (n + nb < 2 ? ' (solo : entraînement)' : '')}`, ARENA / 2, ARENA / 2 - 6);
        if (snap.rush) { ctx.fillStyle = '#ffd24a'; ctx.font = 'bold 13px system-ui,sans-serif'; ctx.fillText('🏁 Food-rush — premier à ' + (snap.rushTarget || 20) + ' 🍎 gagne', ARENA / 2, ARENA / 2 + 14); }
        ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.font = 'bold 13px system-ui,sans-serif'; ctx.fillText('▶ Espace / clic pour lancer', ARENA / 2, ARENA / 2 + (snap.rush ? 34 : 24));
      }
    }
  }
  function drawLoop() { if (destroyed) return; try { draw(); } catch (e) { console.error('[render]', e); } rafId = requestAnimationFrame(drawLoop); }   // filet : une erreur de rendu ne fige plus le jeu

  const onKeyDown = e => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
    unlockAudio();
    if (e.key === ' ' && snap && snap.gs !== 'play' && snap.gs !== 'paused') return send({ t: 'start' });
    if ((e.key === 'p' || e.key === 'P' || e.key === 'Escape') && snap && (snap.gs === 'play' || snap.gs === 'paused')) return send({ t: 'pause' });
    const d = DIR_KEYS[e.code]; if (d) send({ t: 'dir', d });
  };
  function dpad(id, d) { const el = $(id); if (!el) return; el.addEventListener('pointerdown', e => { e.preventDefault(); unlockAudio(); send({ t: 'dir', d }); }); }

  function init(ctx0) {
    destroyed = false;              // module singleton réutilisé : réarmer la boucle de rendu après un précédent teardown
    A = ctx0.a11y; send = ctx0.send; root = ctx0.root;
    if (ctx0.togglePanel) togglePanel = ctx0.togglePanel; if (ctx0.closePanels) closePanels = ctx0.closePanels;
    cv = $('snc'); ctx = cv.getContext('2d'); hud = $('snHud'); endEl = $('snEnd');
    { const wrap = cv.parentElement;                 // bandeaux de message posés sur le cadre du canvas (.canvas-wrap)
      if (wrap && wrap.classList && wrap.classList.contains('canvas-wrap')) initGameMsg(wrap); }
    hud.innerHTML = '';             // module réutilisé : repartir d'un HUD vide (sinon les cartes P1.. se cumulent à chaque retour)
    cards = Array.from({ length: MAX_SEATS }, (_, i) => i).map(i => { const el = document.createElement('div'); el.className = 'pc hidden'; el.innerHTML = `<div class="dot"></div><div class="inf"><div class="pn">P${i + 1}</div><div class="lv"></div></div>`; hud.appendChild(el); return el; });
    startBtn = $('snStart'); pauseBtn = $('snPause'); modeBtn = $('snMode'); variantBtn = $('snVariant'); rushBtn = $('snRush'); botsBtn = $('snBots'); pauseFloat = $('snPauseFloat');
    lbBtn = $('snLbBtn'); lbPanel = $('snLbPanel'); lbBody = $('snLbBody');
    startBtn.onclick = () => { unlockAudio(); send({ t: 'start' }); };
    pauseBtn.onclick = () => send({ t: 'pause' });
    pauseFloat.onclick = () => send({ t: 'pause' });
    modeBtn.onclick = () => send({ t: 'mode' });
    if (variantBtn) variantBtn.onclick = () => send({ t: 'variant' });
    if (rushBtn) rushBtn.onclick = () => send({ t: 'rush' });
    if (botsBtn) botsBtn.onclick = () => send({ t: 'bots' });
    diffBtn = $('snDiff'); if (diffBtn) diffBtn.onclick = () => send({ t: 'botdiff' });
    { const helpBtn = $('snHelp'), helpPanel = $('snHelpPanel'); if (helpBtn && helpPanel) helpBtn.onclick = () => togglePanel(helpPanel); }
    lbBtn.onclick = () => { togglePanel(lbPanel); renderLB(); };
    cv.addEventListener('click', () => { unlockAudio(); if (snap && snap.gs !== 'play' && snap.gs !== 'paused') send({ t: 'start' }); });
    endEl.addEventListener('click', () => { unlockAudio(); send({ t: 'start' }); });
    dpad('snUp', 'up'); dpad('snDown', 'down'); dpad('snLeft', 'left'); dpad('snRight', 'right');
    applyColors();
    resizeH = resizeCanvas; addEventListener('resize', resizeH); resizeCanvas();
    addEventListener('keydown', onKeyDown);
    music.start();
    rafId = requestAnimationFrame(drawLoop);
  }
  function onA11y() { applyColors(); }
  function teardown() { destroyed = true; music.stop(); cancelAnimationFrame(rafId); removeEventListener('resize', resizeH); removeEventListener('keydown', onKeyDown); }

  return { init, onState, onMessage, onLb, onA11y, teardown };
})();
