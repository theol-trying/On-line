// Module client PONG : rendu canvas, HUD, inputs, sons, options/leaderboard.
// Contrat : init(ctx), onState(snap), onMessage(m), onLb(data), onA11y(), teardown().
// Le shell fournit ctx = { root, send, a11y, togglePanel, closePanels }. Réseau/pseudo/thème = shell.
import { W, H, BALL_R, PAD_W, PAD_OFF, PU_R } from './shared.js';
import { createMusic } from '../../music.js';

const SHAPE = { 2: 'Face à face', 3: 'Triangle', 4: 'Carré', 5: 'Pentagone', 6: 'Hexagone' };
const PU_GLYPH = { multi: '+1', grow: 'XL', shield: '⛉', ghost: '◌', invert: '⇄', shrinkT: '▭', slow: '≈', mini: '▽', flip: '✕', speed: '»', blocker: '🧱', magnet: '🧲', invis: '∅' };
const PU_COL = { multi: '#fff', grow: '#ffd76b', shield: '#7fd1ff', ghost: '#cbb3ff', invert: '#ff9be0', shrinkT: '#ffb36b', slow: '#9fe6ff', mini: '#ff5a5a', flip: '#ff5a5a', speed: '#ff5a5a', blocker: '#c9a06a', magnet: '#ff8e6e', invis: '#ff5a5a' };
const PU_NAME = { multi: 'Multi-balle', grow: 'Raquette XL', shield: 'Bouclier', ghost: 'Balle fantôme', invert: 'Inversion (adversaire)', shrinkT: 'Raquette réduite (adversaire)', slow: 'Ralenti', mini: 'Malus : ta raquette réduit', flip: 'Malus : tes contrôles inversés', speed: 'Malus : balle accélérée', blocker: 'Mur-bloqueur', magnet: 'Aimant', invis: 'Malus : balle invisible' };
const BUFF_ICON = { grow: 'XL', shield: '⛉', invert: '⇄', shrink: '▭', magnet: '🧲' };           // effets affichés sur les cartes (barres dégressives)
const BUFF_COL = { grow: '#ffd76b', shield: '#7fd1ff', invert: '#ff9be0', shrink: '#ffb36b', magnet: '#ff8e6e' };
const TEAM_LETTER = ['A', 'B', 'C'];
const MODE_NAME = { ffa: 'Chacun pour soi', '2v2': '2 v 2', '2v2v2': '2 v 2 v 2', '3v3': '3 v 3' };
const PRESET_LABEL = { classique: 'Classique', rapide: 'Rapide', chaos: 'Chaos', custom: 'Personnalisé' };
const PRESET_DESC = { classique: '5 vies · vitesse posée · sans power-ups', rapide: '3 vies · balle vive + accélération · power-ups', chaos: '5 vies · power-ups fréquents · multi-balle', custom: 'réglages personnalisés' };
const SPEED_LABEL = { lente: 'Lente', normale: 'Normale', rapide: 'Rapide' };
const WINMODE_LABEL = { survivor: 'Dernier survivant', rounds: 'Manches', kills: 'Éliminations' };
const SUDDEN_LABEL = { off: 'Off', shrink: 'Terrain rétrécit', accel: 'Balle accélère' };
const SERVE_LABEL = { random: 'Aléatoire', loser: 'Dernier perdant' };
const BOTDIFF_LABEL = { easy: 'Facile', normal: 'Normal', hard: 'Difficile', insane: 'Insane' };
const PAL = { normal: ['#4a9ee0', '#e06240', '#2aaf7a', '#cc9010', '#9b6cf0', '#e268b0'], cb: ['#0072B2', '#E69F00', '#009E73', '#F0E442', '#CC79A7', '#56B4E9'] };
const TEAMPAL = { normal: ['#4a9ee0', '#e06240', '#2aaf7a'], cb: ['#0072B2', '#E69F00', '#009E73'] };
const THEMES = {
  neon: { bg: '#0a0a14', field: '#0d0e1c', grid: 'rgba(255,255,255,0.04)', ball: '#ffffff' },
  crt: { bg: '#04140b', field: '#06190e', grid: 'rgba(120,255,170,0.07)', ball: '#d8ffe4' },
  light: { bg: '#e4e8f3', field: '#d6dbe9', grid: 'rgba(0,0,0,0.06)', ball: '#1a1d2e' },
};
const INTERP_MS = 33;

// musique : arcade néon — nappe aérienne, basse ronde, blips lead ; climax (échanges rapides) = charley + tempo
// fond animé : starfield lent qui scintille (identité néon/arcade) — positions dérivées du temps, coupé par reduceFx
const AMB_STARS = Array.from({ length: 40 }, () => ({ x: Math.random(), y: Math.random(), v: 4 + Math.random() * 9, r: 0.5 + Math.random() * 1.3, ph: Math.random() * 6.28 }));
const MUSIC_THEME = { bpm: 126, bpmBoost: 18, vol: 0.45, root: 110, len: 32,
  stingers: { kill: { notes: [12, 5, 0], wave: 'square', oct: 1, gain: 0.035, dur: 0.14 }, win: { base: 261.63, notes: [[0, 4, 7], [5, 9, 12], [7, 12, 16]], gain: 0.035, dur: 0.3, rate: 0.13 } },
  layers: [
  { seq: [[0, 7], null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, [-4, 3], null, null, null, null, null, null, null, null, null, null, null, null, null, null, null], wave: 'sine', gain: 0.022, dur: 12 },
  { seq: [0, null, 0, null, 3, null, 3, null, 5, null, 5, null, 3, null, 3, null], wave: 'triangle', gain: 0.04, dur: 1.2, min: 1 },
  { seq: [12, null, null, null, null, null, 15, null, null, null, null, null, 19, null, null, null, 17, null, null, null, null, null, 15, null, null, null, null, null, 12, null, null, null], oct: 1, wave: 'square', gain: 0.016, dur: 1.2, min: 1 },
  { drums: '..H...H...H...H.', gain: 0.6, min: 2 },
  { seq: [0, 3, 7, 10], oct: 2, wave: 'sine', gain: 0.012, dur: 0.8, min: 2 },
] };

export default (function () {
  let A, send, root, cv, ctx, togglePanel = () => {}, closePanels = () => {};
  let CC = PAL.normal, TEAMCC = TEAMPAL.normal, TH = THEMES.neon, FX = 1;
  let mySeat = -1, maxLives = 5, snap = null, prevGs = 'lobby', teamMode = false;
  let board = [], history = [], endShown = false, inGamePrev = false;
  let buf = [], trails = [];
  const particles = [], edgeFlash = {}, rings = [], flashes = [];
  let actx = null;
  const music = createMusic(() => actx, () => A, MUSIC_THEME);
  let shakeMag = 0, ballPopUntil = 0, bannerTimer = null, curWinMode = 'survivor';
  let rafId = 0, destroyed = false, resizeH = null;
  const input = { up: false, dn: false };
  // DOM refs
  let hud, cards, startBtn, pauseBtn, botsBtn, modeBtn, presetBtn, pauseFloat;
  let optBtn, optionsPanel, optLives, optSpeed, optPu, optAccel, optWin, optSudden, optServe, optHandi;
  let optTarRow, optTar, optTarLbl, optNeg, optBot, optStyle, optBump, lbBtn, lbPanel, voteBtn, histPreset, histMode;

  const $ = id => root.querySelector('#' + id) || document.getElementById(id);
  function colSeat(s) { if (s < 0 || !snap) return '#ffffff'; const p = snap.players[s]; return teamMode && p ? TEAMCC[p.team] : CC[s]; }
  function colOf(p) { return teamMode ? TEAMCC[p.team] : CC[p.seat]; }
  function nameOf(s) { const p = snap && snap.players[s]; return p ? (p.name || ('P' + (s + 1))) : ('P' + (s + 1)); }
  function hexA(h, a) { return h + Math.max(0, Math.min(255, Math.round(a * 255))).toString(16).padStart(2, '0'); }

  function applyColors() {
    CC = PAL[A.palette] || PAL.normal; TEAMCC = TEAMPAL[A.palette] || TEAMPAL.normal;
    FX = A.reduceFx ? 0 : 1; TH = THEMES[A.theme] || THEMES.neon;
  }

  function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const sideRoom = window.innerWidth > 600 ? 200 : 0;
    const playing = document.body.classList.contains('playing');
    const hFrac = playing ? 0.86 : 0.66;
    const size = Math.max(280, Math.min(window.innerWidth * 0.96 - sideRoom, window.innerHeight * hFrac, 1100));
    cv.style.width = size + 'px'; cv.style.height = size + 'px';
    cv.width = Math.round(size * dpr); cv.height = Math.round(size * dpr);
  }

  function refreshHUD() {
    if (!snap) return;
    snap.players.forEach((p, i) => {
      const shown = p.connected || p.bot || p.playing;
      cards[i].classList.toggle('hidden', !shown);
      if (!shown) return;
      const col = colOf(p);
      cards[i].style.color = col;
      const l = Math.max(0, p.lives);
      const lvEl = document.getElementById('lv' + i); lvEl.style.color = col;
      const buffs = (p.buffs || []).map(([k, fr]) => { const c = BUFF_COL[k] || '#fff', pct = Math.max(0, Math.min(100, Math.round(fr * 100))); return `<span class="buff" style="background:linear-gradient(90deg,${c} ${pct}%,rgba(255,255,255,.12) ${pct}%);border-color:${c}66">${BUFF_ICON[k] || '?'}</span>`; }).join('');
      lvEl.innerHTML = '●'.repeat(l) + '○'.repeat(Math.max(0, maxLives - l)) + (buffs ? ' ' + buffs : '');
      const tags = [];
      if (teamMode) tags.push(`<span class="badge" style="background:${col}28;color:${col}">ÉQ.${TEAM_LETTER[p.team]}</span>`);
      if (p.bot) tags.push(`<span class="badge" style="background:${col}28;color:${col}">BOT</span>`);
      else if (i === mySeat) tags.push(`<span class="badge" style="background:${col}28;color:${col}">VOUS</span>`);
      document.getElementById('pn' + i).innerHTML = `${p.name || ('P' + (i + 1))} <span class="sc">${p.score} pt</span> ${tags.join('')}`;
      cards[i].classList.toggle('dead', p.playing && !p.alive);
      cards[i].classList.toggle('me', i === mySeat);
    });
  }

  function renderHist() {
    const el = $('lbHist'); if (!el) return;
    const fp = histPreset.value, fm = histMode.value;
    const rows = history.filter(h => (!fp || h.preset === fp) && (!fm || h.mode === fm)).map(h =>
      `<div class="h"><b>${h.winner}</b> · ${MODE_NAME[h.mode] || h.mode} / ${PRESET_LABEL[h.preset] || h.preset} · ${h.durationSec}s · ${h.nParts} j.</div>`).join('');
    el.innerHTML = rows || '<div class="lbnote">Aucune partie pour ce filtre.</div>';
  }
  const fmtT = s => s == null ? '—' : Math.round(s) + 's';
  const kdNum = e => e.deaths ? e.kills / e.deaths : e.kills;
  const kdStr = e => e.deaths ? (e.kills / e.deaths).toFixed(2) : (e.kills ? '∞' : '0');
  const avgSurv = e => e.games ? (e.survSum || 0) / e.games : 0;
  function renderLB() {
    const body = $('lbBody'); if (!body) return;
    if (!board.length) { body.innerHTML = '<div class="lbnote">Aucune partie enregistrée pour l\'instant.</div>'; return; }
    const B = board.map(e => ({ ...e, kd: kdNum(e), avg: avgSurv(e) }));
    const sup = [];
    const best = (field, dir, filter) => { const c = B.filter(filter || (() => true)); return c.length ? c.reduce((a, b) => (dir < 0 ? (b[field] < a[field] ? b : a) : (b[field] > a[field] ? b : a))) : null; };
    const top = (label, field, dir, filter, fmt) => { const e = best(field, dir, filter); if (e) sup.push(`<div class="lbsup"><span>${label}</span><span><b>${e.name}</b> <small>${fmt ? fmt(e) : e[field]}</small></span></div>`); };
    top('🏆 Plus de victoires', 'wins', 1);
    top('💀 Plus d\'éliminations', 'kills', 1);
    top('⚖ Meilleur ratio K/D', 'kd', 1, e => e.games > 0, kdStr);
    top('⏱ Survie la plus longue', 'bestSurvivalSec', 1, null, e => fmtT(e.bestSurvivalSec));
    top('⌀ Meilleure survie moyenne', 'avg', 1, e => e.games > 0, e => fmtT(e.avg));
    top('✦ Plus de power-ups', 'pu', 1);
    top('🐔 Éliminé le plus vite', 'fastestElimSec', -1, e => e.fastestElimSec != null, e => fmtT(e.fastestElimSec));
    top('😴 Touche le moins (1 manche)', 'fewestTouches', -1, e => e.fewestTouches != null, e => e.fewestTouches);
    const rows = B.sort((a, b) => b.wins - a.wins || b.kd - a.kd).map(e =>
      `<div class="lbrow"><span class="lbn">${e.name}</span><span>🎮${e.games}</span><span>🏆${e.wins}</span><span>💀${e.kills}</span><span title="ratio K/D">⚖${kdStr(e)}</span><span title="survie moyenne">⌀${Math.round(e.avg)}s</span><span title="meilleure survie">⏱${Math.round(e.bestSurvivalSec)}s</span></div>`).join('');
    body.innerHTML = `<div class="lbsups">${sup.join('')}</div>${rows}`;
  }

  function showEndscreen(m) {
    const es = $('endscreen');
    if (m.gs !== 'over' || !m.stats) { es.classList.add('hidden'); return; }
    es.classList.remove('hidden');
    const nm = s => { const q = m.players[s]; return q ? (q.name || ('P' + (s + 1))) : ('P' + (s + 1)); };
    const parts = m.players.filter(p => p.edge >= 0 && p.place > 0).slice().sort((a, b) => a.place - b.place);
    const w = m.winner, champ = w >= 0 ? parts.find(p => p.team === w) : null;
    const isMatch = m.stats && m.stats.match;
    const who = champ ? (teamMode ? 'Équipe ' + TEAM_LETTER[w] : nm(champ.seat)) : null;
    const title = (m.stats && m.stats.nParts === 1) ? '🎯 Entraînement terminé' : (champ ? (isMatch ? '🏆 ' + who + ' REMPORTE LE MATCH' : who + ' gagne') : 'Égalité');
    const medals = ['🥇', '🥈', '🥉'];
    const rows = parts.map(p => {
      const col = colOf(p), place = p.place || 0;
      const medal = medals[place - 1] || ('#' + (place || '?'));
      let res;
      if (p.alive) res = teamMode ? 'survivant·e — équipe gagnante' : 'vainqueur';
      else { const by = p.elimBy >= 0 ? nm(p.elimBy) : 'le mur'; res = `éliminé par ${by} à ${Math.round((p.elimTick || 0) / 60)}s`; }
      return `<div class="erow ${p.alive ? 'win' : ''}">
        <span class="eplace">${medal}</span>
        <span class="ename" style="color:${col}">${nm(p.seat)}${teamMode ? ` <small>Éq.${TEAM_LETTER[p.team]}</small>` : ''}${p.bot ? ' <small>BOT</small>' : ''}</span>
        <span class="estat" title="éliminations">💀 ${p.kills}</span>
        <span class="estat" title="vies retirées">⚔ ${p.dmg}</span>
        <span class="estat" title="vies restantes">❤ ${Math.max(0, p.lives)}</span>
        <span class="estat" title="rebonds">🏓 ${p.hits}</span>
        <span class="estat" title="power-ups">✦ ${p.puGot}</span>
        <span class="eres">${res}</span></div>`;
    }).join('');
    const pod = board.slice().sort((a, b) => b.wins - a.wins || b.kills - a.kills).slice(0, 3);
    const order = pod.length === 3 ? [1, 0, 2] : pod.map((_, i) => i);
    const HG = [104, 74, 54], MED = ['🥇', '🥈', '🥉'], PC = ['#ffd76b', '#cfd6e6', '#d8965a'];
    const podHtml = pod.length ? `<div class="podlabel">Classement cumulé</div><div class="podium">${
      order.map(rank => { const e = pod[rank];
        return `<div class="pcol"><div class="pname">${e.name}</div><div class="pmedal">${MED[rank]}</div>
          <div class="pbar" style="height:${HG[rank]}px;background:linear-gradient(180deg,${PC[rank]},${PC[rank]}44)"></div>
          <div class="pwins">${e.wins} 🏆</div></div>`; }).join('')}</div>` : '';
    let mvpLine = '';
    if (parts.length) {
      const scoreOf = p => p.kills * 100 + p.dmg * 10 + (p.alive ? 40 : 0) - p.place;
      const mvp = parts.reduce((a, b) => scoreOf(b) > scoreOf(a) ? b : a);
      const losers = parts.filter(p => !p.alive);
      const boulet = losers.length ? losers.reduce((a, b) => (b.place > a.place || (b.place === a.place && b.hits < a.hits)) ? b : a) : null;
      mvpLine = `<div class="emeta">🏅 MVP <b style="color:${colOf(mvp)}">${nm(mvp.seat)}</b> (${mvp.kills}💀 · ${mvp.dmg}⚔)${boulet && boulet !== mvp ? ` · 🐔 <b style="color:${colOf(boulet)}">${nm(boulet.seat)}</b>` : ''}</div>`;
    }
    es.innerHTML = `<div class="etitle" style="color:${champ ? colOf(champ) : '#fff'}">${title}</div>
      <div class="emeta">⏱ ${m.stats.durationSec}s · 🏓 ${m.stats.bounces} rebonds · ${m.stats.nParts} joueurs</div>
      ${mvpLine}<div class="elist">${rows}</div>${podHtml}<div class="ehint">Espace / clic pour rejouer</div>`;
  }

  /* ---- entrées réseau (appelées par le shell) ---- */
  function onMessage(m) {
    if (!m || m.t !== 'welcome') return;
    mySeat = m.seat;
    if (typeof m.maxLives === 'number') maxLives = m.maxLives;
    if (voteBtn) voteBtn.style.display = mySeat < 0 ? '' : 'none';
  }
  function onLb(d) {
    board = d.board || []; history = d.history || [];
    renderLB(); renderHist();
    if (snap && snap.gs === 'over' && endShown) showEndscreen(snap);
  }
  function onState(m) {
    const prev = snap; snap = m;
    teamMode = m.mode && m.mode !== 'ffa';
    if (typeof m.maxLives === 'number') maxLives = m.maxLives;
    const inGame = m.gs === 'play' || m.gs === 'countdown' || m.gs === 'paused';
    if (inGame !== inGamePrev) { inGamePrev = inGame; document.body.classList.toggle('playing', inGame); resizeCanvas(); }
    document.body.classList.toggle('paused', m.gs === 'paused');
    if (m.gs === 'play' || m.gs === 'countdown') closePanels();
    buf.push({ t: performance.now(), s: m }); if (buf.length > 10) buf.shift();
    (m.fx || []).forEach(playFx);
    (m.fx || []).forEach(f => {
      if (f.type === 'death') { music.sting('kill'); if (f.elim) addKill(f.by, f.side); }
      else if (f.type === 'powerup' && f.bad) banner('⚠ ' + (PU_NAME[f.pu] || 'PIÈGE !'));
    });
    detectBanners(prev, m);
    if (prevGs !== 'over' && m.gs === 'over') { sound('win'); music.sting('win'); }
    prevGs = m.gs;
    { let inten = 0;                                  // musique : 1 en jeu, 2 quand les échanges deviennent rapides
      if (m.gs === 'play' || m.gs === 'countdown') inten = (m.gs === 'play' && musicIntensity() > 0.55) ? 2 : 1;
      music.setIntensity(inten); }
    refreshHUD();
    if (m.gs === 'over') { if (!endShown) { showEndscreen(m); endShown = true; } }
    else { endShown = false; $('endscreen').classList.add('hidden'); }
    const n = m.connected + m.botCount;
    const idle = m.gs === 'lobby' || m.gs === 'over';
    startBtn.disabled = !(mySeat >= 0 && idle && m.connected >= 1 && n >= 1);   // n=1 : entraînement solo (mur)
    startBtn.textContent = m.gs === 'over' ? '↻ Rejouer' : '▶ Démarrer';
    pauseBtn.disabled = !(m.gs === 'play' || m.gs === 'paused');
    pauseBtn.textContent = m.gs === 'paused' ? '▶ Reprendre' : '⏸ Pause';
    pauseFloat.textContent = m.gs === 'paused' ? '▶' : '⏸';
    botsBtn.disabled = !idle; botsBtn.textContent = '🤖 Bots : ' + m.botCount; botsBtn.classList.toggle('on', m.botCount > 0);
    modeBtn.disabled = !(idle && (n === 4 || n === 6)); modeBtn.textContent = '⚔ ' + (MODE_NAME[m.mode] || m.mode); modeBtn.classList.toggle('on', teamMode);
    presetBtn.disabled = !idle; presetBtn.textContent = '🎮 ' + (PRESET_LABEL[m.preset] || m.preset);
    if (m.opts) {
      optLives.textContent = m.opts.lives;
      optSpeed.textContent = SPEED_LABEL[m.opts.speed] || m.opts.speed;
      optPu.checked = m.opts.pu; optAccel.checked = m.opts.accel;
      curWinMode = m.opts.winMode;
      optWin.textContent = WINMODE_LABEL[m.opts.winMode] || m.opts.winMode;
      optSudden.textContent = SUDDEN_LABEL[m.opts.sudden] || m.opts.sudden;
      optServe.textContent = SERVE_LABEL[m.opts.serve] || m.opts.serve;
      optHandi.checked = m.opts.handicap;
      optNeg.checked = m.opts.negatives;
      if (optBump) optBump.checked = !!m.opts.bumpers;
      optBot.textContent = BOTDIFF_LABEL[m.opts.botDiff] || m.opts.botDiff;
      if (optStyle) optStyle.textContent = ({ equilibre: 'Équilibré', agressif: 'Agressif', defensif: 'Défensif' })[m.opts.botStyle] || 'Équilibré';
      optSudden.classList.toggle('on', m.opts.sudden !== 'off');
      const showTar = m.opts.winMode !== 'survivor';
      optTarRow.style.display = showTar ? '' : 'none';
      if (showTar) { optTarLbl.textContent = m.opts.winMode === 'kills' ? 'Élim. cible' : 'Manches à gagner'; optTar.textContent = m.opts.winMode === 'kills' ? m.opts.killsTarget : m.opts.roundsTarget; }
      [optLives, optSpeed, optPu, optAccel, optWin, optSudden, optServe, optHandi, optNeg, optBot, optStyle, optBump,
       $('optLivesMinus'), $('optLivesPlus'), $('optTarMinus'), $('optTarPlus')].forEach(el => { if (el) el.disabled = !idle; });
      optBtn.classList.toggle('on', m.preset === 'custom');
    }
  }

  /* ---- sons / musique ---- */
  function unlockAudio() {
    if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch {} }
    if (actx && actx.state === 'suspended') actx.resume();
  }
  function musicIntensity() {                          // 0..1 selon la vitesse de la balle la plus rapide (pilote le climax musical)
    if (buf.length < 2) return 0;
    const a = buf[buf.length - 2].s, b = buf[buf.length - 1].s;
    if (!a.balls.length || a.balls.length !== b.balls.length) return 0.3;
    let mx = 0;
    for (let i = 0; i < b.balls.length; i++) { const d = Math.hypot(b.balls[i].x - a.balls[i].x, b.balls[i].y - a.balls[i].y); if (d > mx) mx = d; }
    return Math.min(1, mx / 16);
  }
  function tone(freq, dur, type = 'square', gain = 0.05, delay = 0) {
    const _v = (A && typeof A.sfx === 'number') ? A.sfx : 1;
    if (!actx || _v <= 0) return;
    const t0 = actx.currentTime + delay, o = actx.createOscillator(), g = actx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(gain * _v, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(actx.destination); o.start(t0); o.stop(t0 + dur);
  }
  function sound(kind) {
    if (!actx) return;
    if (kind === 'hit') tone(420, 0.06, 'square', 0.04);
    else if (kind === 'death') tone(150, 0.28, 'sawtooth', 0.06);
    else if (kind === 'shield') tone(700, 0.10, 'triangle', 0.05);
    else if (kind === 'powerup') { tone(523, 0.08, 'square', 0.05); tone(659, 0.08, 'square', 0.05, 0.07); tone(784, 0.12, 'square', 0.05, 0.14); }
    else if (kind === 'win') { tone(523, 0.18, 'triangle', 0.06); tone(659, 0.18, 'triangle', 0.06, 0.12); tone(784, 0.30, 'triangle', 0.06, 0.24); }
    else if (kind === 'bad') { tone(330, 0.12, 'sawtooth', 0.05); tone(220, 0.20, 'sawtooth', 0.05, 0.10); }
    else if (kind === 'ghost') tone(880, 0.10, 'sine', 0.04);
    else if (kind === 'bump') tone(300, 0.05, 'square', 0.04);
  }
  function playFx(f) {
    sound(f.type === 'powerup' ? (f.bad ? 'bad' : 'powerup') : f.type);
    if (A.reduceFx) return;
    const now = performance.now();
    const col = f.type === 'powerup' ? (f.bad ? '#ff5a5a' : (PU_COL[f.pu] || '#fff')) : colSeat(f.side);
    rings.push({ x: f.x, y: f.y, born: now, color: col, big: f.type === 'death', kind: f.type });
    flashes.push({ x: f.x, y: f.y, born: now, color: col, r: f.type === 'death' ? 34 : 18 });
    ballPopUntil = now + 90;
    if (f.type === 'hit') edgeFlash[f.side] = now;   // flash d'impact sur la raquette à chaque renvoi
    if (f.type === 'powerup') for (let k = 0; k < 10; k++) { const a = Math.random() * Math.PI * 2, sp = 1 + Math.random() * 2.5; particles.push({ x: f.x, y: f.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, born: now, life: 380 + Math.random() * 200, color: col }); }
    if (f.type === 'death') {
      shakeMag = Math.max(shakeMag, 7);
      edgeFlash[f.side] = now;
      for (let k = 0; k < 12; k++) {
        const a = Math.random() * Math.PI * 2, sp = 1 + Math.random() * 3.5;
        particles.push({ x: f.x, y: f.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, born: now, life: 420 + Math.random() * 220, color: col });
      }
    }
  }
  function addKill(by, victim) {
    const el = document.createElement('div'); el.className = 'kf';
    el.innerHTML = by >= 0
      ? `<span style="color:${colSeat(by)}">${nameOf(by)}</span> ⚡ <span style="color:${colSeat(victim)}">${nameOf(victim)}</span>`
      : `☠ <span style="color:${colSeat(victim)}">${nameOf(victim)}</span>`;
    const box = $('killfeed'); box.appendChild(el);
    while (box.children.length > 5) box.removeChild(box.firstChild);
    setTimeout(() => el.remove(), 3900);
  }
  function banner(text) {
    const b = $('banner');
    b.innerHTML = `<span class="bann">${text}</span>`;
    clearTimeout(bannerTimer); bannerTimer = setTimeout(() => { b.innerHTML = ''; }, 1300);
  }
  function detectBanners(prev, m) {
    if (!prev || m.gs !== 'play') return;
    if (m.sd && !prev.sd) { banner('MORT SUBITE'); return; }
    if (m.balls.length > prev.balls.length) banner('MULTI-BALLE !');
    for (let i = 0; i < m.players.length; i++) {
      const p = m.players[i], q = prev.players[i];
      if (p.playing && p.alive && p.lives === 1 && q && q.lives > 1) { banner('DERNIÈRE VIE — ' + (p.name || ('P' + (i + 1)))); break; }
    }
  }

  function computeView(now) {
    if (buf.length === 0) return null;
    const target = now - INTERP_MS;
    let a = buf[0], b = buf[buf.length - 1];
    for (let i = 0; i < buf.length; i++) if (buf[i].t <= target) a = buf[i];
    for (let i = buf.length - 1; i >= 0; i--) if (buf[i].t >= target) b = buf[i];
    const sa = a.s, sb = b.s, span = b.t - a.t;
    let al = span > 0 ? (target - a.t) / span : 0; al = al < 0 ? 0 : al > 1 ? 1 : al;
    let balls;
    if (sa.balls.length === sb.balls.length)
      balls = sa.balls.map((ba, i) => { const bb = sb.balls[i];
        if (Math.hypot(bb.x - ba.x, bb.y - ba.y) > 60) return { x: bb.x, y: bb.y, o: bb.o, gh: bb.gh, iv: bb.iv };
        return { x: ba.x + (bb.x - ba.x) * al, y: ba.y + (bb.y - ba.y) * al, o: bb.o, gh: bb.gh, iv: bb.iv }; });
    else balls = sb.balls.map(b => ({ x: b.x, y: b.y, o: b.o, gh: b.gh, iv: b.iv }));
    const pos = {};
    sb.players.forEach((pb, i) => { const pa = sa.players[i]; pos[i] = (pa && pa.edge === pb.edge) ? pa.pos + (pb.pos - pa.pos) * al : pb.pos; });
    return { balls, pos };
  }
  const pt = (e, s, d) => [e.ax + e.tx * s + e.nx * d, e.ay + e.ty * s + e.ny * d];

  function draw() {
    if (destroyed) return;
    const now = performance.now();
    const sc = cv.width / W;
    let ox = 0, oy = 0;
    if (shakeMag > 0.3 && !A.reduceFx) { ox = (Math.random() * 2 - 1) * shakeMag; oy = (Math.random() * 2 - 1) * shakeMag; shakeMag *= 0.86; }
    else shakeMag = 0;
    ctx.setTransform(sc, 0, 0, sc, ox * sc, oy * sc);
    ctx.fillStyle = TH.bg; ctx.fillRect(0, 0, W, H);
    if (!A.reduceFx) { ctx.save(); ctx.fillStyle = '#9fd0ff'; for (const s of AMB_STARS) { const y = (s.y * H + now / 1000 * s.v) % H, tw = 0.5 + 0.5 * Math.sin(now / 900 + s.ph); ctx.globalAlpha = 0.05 + 0.16 * tw; ctx.beginPath(); ctx.arc(s.x * W, y, s.r, 0, Math.PI * 2); ctx.fill(); } ctx.restore(); }   // starfield
    const view = computeView(now);
    const vballs = view ? view.balls : (snap ? snap.balls : []);
    const vpos = s => (view && view.pos[s] != null) ? view.pos[s] : (snap ? snap.players[s].pos : 0);
    const geo = snap && snap.geo;
    if (geo) {
      const E = geo.edges;
      ctx.beginPath();
      E.forEach((e, i) => { i ? ctx.lineTo(e.ax, e.ay) : ctx.moveTo(e.ax, e.ay); });
      ctx.closePath(); ctx.fillStyle = TH.field; ctx.fill();
      ctx.save(); ctx.clip();
      ctx.strokeStyle = TH.grid; ctx.lineWidth = 1;
      for (let i = 30; i < W; i += 40) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, H); ctx.moveTo(0, i); ctx.lineTo(W, i); ctx.stroke(); }
      if (!A.reduceFx && snap.gs === 'play') {           // le terrain « chauffe » avec la vitesse des échanges
        const heat = musicIntensity();
        if (heat > 0.15) { const g = ctx.createRadialGradient(W / 2, H / 2, 60, W / 2, H / 2, W * 0.62); g.addColorStop(0, 'rgba(255,90,40,0)'); g.addColorStop(1, `rgba(255,90,40,${(0.16 * heat).toFixed(3)})`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
      }
      ctx.restore();
      const edgeA = A.contrast ? 'aa' : '66';
      const wallC = A.contrast ? 'rgba(255,255,255,0.34)' : 'rgba(255,255,255,0.16)';
      E.forEach(e => {
        ctx.strokeStyle = e.owner >= 0 ? colSeat(e.owner) + edgeA : wallC;
        ctx.lineWidth = e.owner >= 0 ? 2 : 3;
        ctx.beginPath(); ctx.moveTo(e.ax, e.ay); ctx.lineTo(e.bx, e.by); ctx.stroke();
        const ef = edgeFlash[e.owner];
        if (e.owner >= 0 && !A.reduceFx && ef && now - ef < 240) {
          ctx.save(); ctx.globalAlpha = 1 - (now - ef) / 240;
          ctx.shadowColor = colSeat(e.owner); ctx.shadowBlur = 18; ctx.strokeStyle = '#fff'; ctx.lineWidth = 4;
          ctx.beginPath(); ctx.moveTo(e.ax, e.ay); ctx.lineTo(e.bx, e.by); ctx.stroke(); ctx.restore();
        }
        if (e.owner >= 0 && !A.reduceFx && snap.balls) {            // lueur du bord quand une balle le frôle
          let near = 0;
          for (const b of snap.balls) { const d = (b.x - e.ax) * e.nx + (b.y - e.ay) * e.ny, s = (b.x - e.ax) * e.tx + (b.y - e.ay) * e.ty; if (d > 0 && d < 55 && s > -12 && s < e.len + 12) near = Math.max(near, 1 - d / 55); }
          if (near > 0) { ctx.save(); ctx.globalAlpha = near * 0.8; ctx.shadowColor = colSeat(e.owner); ctx.shadowBlur = 16 * near; ctx.strokeStyle = colSeat(e.owner); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(e.ax, e.ay); ctx.lineTo(e.bx, e.by); ctx.stroke(); ctx.restore(); }
        }
      });
      const me = mySeat >= 0 ? snap.players[mySeat] : null;
      if (me && me.edge >= 0 && E[me.edge]) {
        const e = E[me.edge], col = colOf(me), inset = 30;
        const g = ctx.createLinearGradient(...pt(e, e.len / 2, 0), ...pt(e, e.len / 2, inset));
        g.addColorStop(0, col + (A.contrast ? '44' : '2e')); g.addColorStop(1, col + '00');
        const q1 = pt(e, 0, 0), q2 = pt(e, e.len, 0), q3 = pt(e, e.len, inset), q4 = pt(e, 0, inset);
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(...q1); ctx.lineTo(...q2); ctx.lineTo(...q3); ctx.lineTo(...q4); ctx.closePath(); ctx.fill();
        ctx.save(); ctx.shadowColor = col; ctx.shadowBlur = 20 * FX;
        ctx.strokeStyle = col + 'dd'; ctx.lineWidth = 3 + (0.6 + 0.6 * Math.sin(now / 350));
        ctx.beginPath(); ctx.moveTo(e.ax, e.ay); ctx.lineTo(e.bx, e.by); ctx.stroke(); ctx.restore();
      }
      (snap.powerups || []).forEach(pu => {
        const col = pu.bad ? '#ff5a5a' : (PU_COL[pu.type] || '#fff'), pulse = 1 + 0.12 * Math.sin(now / 200);
        ctx.save(); ctx.shadowColor = col; ctx.shadowBlur = 14 * FX;
        ctx.fillStyle = col + '22'; ctx.strokeStyle = col; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(pu.x, pu.y, PU_R * pulse, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.shadowBlur = 0; ctx.fillStyle = col; ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(PU_GLYPH[pu.type] || '?', pu.x, pu.y + 0.5);
        ctx.restore();
      });
      snap.players.forEach(p => {
        if (p.edge < 0) return;
        const e = E[p.edge]; if (!e) return;
        const isMe = p.seat === mySeat;
        const L = p.len, col = colOf(p), pos = vpos(p.seat);
        const [lx, ly] = pt(e, e.len / 2, PAD_OFF + PAD_W + 14);
        ctx.fillStyle = col + ((p.playing ? p.alive : true) ? (A.contrast ? 'ff' : 'cc') : '33');
        ctx.font = (isMe ? 'bold 12px' : 'bold 11px') + ' sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText((isMe ? 'VOUS' : ((p.name || ('P' + (p.seat + 1))).slice(0, 8) + (p.bot ? '*' : ''))) + (p.lead ? ' 👑' : '') + (p.inv ? ' ⇄' : ''), lx, ly);
        if (p.playing && !p.alive) return;
        const c1 = pt(e, pos - L / 2, PAD_OFF), c2 = pt(e, pos + L / 2, PAD_OFF),
          c3 = pt(e, pos + L / 2, PAD_OFF + PAD_W), c4 = pt(e, pos - L / 2, PAD_OFF + PAD_W);
        ctx.save();
        if (p.immune) ctx.globalAlpha = 0.35 + 0.35 * Math.sin(now / 70);
        ctx.shadowColor = col; ctx.shadowBlur = (p.grow ? 24 : 16) * FX; ctx.fillStyle = col;
        ctx.beginPath(); ctx.moveTo(...c1); ctx.lineTo(...c2); ctx.lineTo(...c3); ctx.lineTo(...c4); ctx.closePath(); ctx.fill();
        if (A.contrast) { ctx.shadowBlur = 0; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke(); }
        if (p.shield) {
          const s1 = pt(e, pos - L / 2 - 3, PAD_OFF - 3), s2 = pt(e, pos + L / 2 + 3, PAD_OFF - 3),
            s3 = pt(e, pos + L / 2 + 3, PAD_OFF + PAD_W + 3), s4 = pt(e, pos - L / 2 - 3, PAD_OFF + PAD_W + 3);
          ctx.shadowColor = '#7fd1ff'; ctx.shadowBlur = 18 * FX; ctx.strokeStyle = '#bfe6ff'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(...s1); ctx.lineTo(...s2); ctx.lineTo(...s3); ctx.lineTo(...s4); ctx.closePath(); ctx.stroke();
        }
        ctx.restore();
      });
      if (!A.reduceFx) for (let i = rings.length - 1; i >= 0; i--) {
        const r = rings[i], dur = r.big ? 600 : r.kind === 'powerup' ? 500 : 350, t = (now - r.born) / dur;
        if (t >= 1) { rings.splice(i, 1); continue; }
        ctx.strokeStyle = r.color + Math.floor((1 - t) * 200).toString(16).padStart(2, '0');
        ctx.lineWidth = (r.big ? 4 : 2) * (1 - t);
        ctx.beginPath(); ctx.arc(r.x, r.y, (r.big ? 42 : 24) * t + 4, 0, Math.PI * 2); ctx.stroke();
      } else rings.length = 0;
      if (!A.reduceFx) for (let i = flashes.length - 1; i >= 0; i--) {
        const fl = flashes[i], t = (now - fl.born) / 140;
        if (t >= 1) { flashes.splice(i, 1); continue; }
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = (1 - t) * 0.8;
        ctx.fillStyle = fl.color; ctx.beginPath(); ctx.arc(fl.x, fl.y, fl.r * (0.4 + 0.8 * t), 0, Math.PI * 2); ctx.fill(); ctx.restore();
      } else flashes.length = 0;
      if (!A.reduceFx) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        for (let i = particles.length - 1; i >= 0; i--) {
          const q = particles[i], t = (now - q.born) / q.life;
          if (t >= 1) { particles.splice(i, 1); continue; }
          q.x += q.vx; q.y += q.vy; q.vx *= 0.96; q.vy *= 0.96;
          ctx.globalAlpha = 1 - t; ctx.fillStyle = q.color;
          ctx.beginPath(); ctx.arc(q.x, q.y, 2.2 * (1 - t) + 0.5, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
      } else particles.length = 0;
      (snap.bumpers || []).forEach(bm => {                 // bumpers (orbiteurs) + mur-bloqueur temporaire
        ctx.save(); ctx.shadowColor = '#a9b4d6'; ctx.shadowBlur = 14 * FX;
        ctx.fillStyle = bm.t ? '#caa06a' : '#8893b8'; ctx.beginPath(); ctx.arc(bm.x, bm.y, bm.r, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0; ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.beginPath(); ctx.arc(bm.x - bm.r * 0.25, bm.y - bm.r * 0.25, bm.r * 0.4, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      });
      if (snap.gs === 'play' || snap.gs === 'paused' || snap.gs === 'countdown') {
        const pop = (!A.reduceFx && now < ballPopUntil) ? 0.45 * ((ballPopUntil - now) / 90) : 0;
        const playing = snap.gs === 'play';
        if (trails.length !== vballs.length) trails = vballs.map(() => []);
        vballs.forEach((b, i) => {
          if (b.iv) { if (!A.reduceFx) { ctx.save(); ctx.globalAlpha = 0.12; ctx.fillStyle = TH.ball; ctx.beginPath(); ctx.arc(b.x, b.y, BALL_R, 0, Math.PI * 2); ctx.fill(); ctx.restore(); } return; } // balle invisible : à peine perceptible
          const tr = trails[i] || (trails[i] = []), last = tr[tr.length - 1];
          if (last && Math.hypot(b.x - last.x, b.y - last.y) > 60) tr.length = 0;
          tr.push({ x: b.x, y: b.y }); if (tr.length > 12) tr.shift();
          const tcol = b.o >= 0 ? colSeat(b.o) : '#ffffff';
          if (playing && !A.reduceFx)
            tr.forEach((p, j) => { const a = j / tr.length;
              ctx.fillStyle = hexA(tcol, a * 0.5); ctx.beginPath(); ctx.arc(p.x, p.y, BALL_R * a, 0, Math.PI * 2); ctx.fill(); });
          ctx.save(); ctx.shadowColor = tcol; ctx.shadowBlur = 18 * FX;
          if (b.gh) {
            ctx.globalAlpha = 0.4; ctx.fillStyle = '#cbb3ff';
            ctx.beginPath(); ctx.arc(b.x, b.y, BALL_R * (1 + pop), 0, Math.PI * 2); ctx.fill();
            ctx.globalAlpha = 1; ctx.strokeStyle = '#cbb3ff'; ctx.lineWidth = 2; ctx.stroke();
          } else {
            ctx.fillStyle = TH.ball; ctx.beginPath(); ctx.arc(b.x, b.y, BALL_R * (1 + pop), 0, Math.PI * 2); ctx.fill();
          }
          ctx.restore();
        });
      } else trails = [];
      if (snap.slow && !A.reduceFx) { ctx.fillStyle = 'rgba(120,200,255,0.10)'; ctx.fillRect(0, 0, W, H); }
    }
    if (snap && snap.gs === 'countdown') {
      ctx.fillStyle = 'rgba(4,5,12,0.32)'; ctx.fillRect(0, 0, W, H);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const c = snap.count || 0, pulse = 1 + 0.08 * Math.sin(now / 110);
      ctx.save(); ctx.translate(W / 2, H / 2 - 4); ctx.scale(pulse, pulse);
      if (!A.reduceFx) { ctx.shadowColor = 'rgba(120,140,255,.7)'; ctx.shadowBlur = 26; }
      ctx.fillStyle = '#fff'; ctx.font = 'bold 92px system-ui,sans-serif';
      ctx.fillText(c > 0 ? c : 'GO', 0, 0); ctx.restore();
      ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.font = '13px system-ui,sans-serif';
      ctx.fillText('Prépare-toi…', W / 2, H / 2 + 64);
      const sb = snap.balls && snap.balls[0];                        // flèche : sens du service
      if (sb && (sb.vx || sb.vy)) {
        const mag = Math.hypot(sb.vx, sb.vy), ux = sb.vx / mag, uy = sb.vy / mag, len = 48, hx = sb.x + ux * len, hy = sb.y + uy * len, ang = Math.atan2(uy, ux);
        ctx.save(); ctx.globalAlpha = 0.75 + 0.25 * Math.sin(now / 150); ctx.strokeStyle = '#fff'; ctx.fillStyle = '#fff'; ctx.lineWidth = 3; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(sb.x, sb.y); ctx.lineTo(hx, hy); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx - Math.cos(ang - 0.4) * 11, hy - Math.sin(ang - 0.4) * 11); ctx.lineTo(hx - Math.cos(ang + 0.4) * 11, hy - Math.sin(ang + 0.4) * 11); ctx.closePath(); ctx.fill(); ctx.restore();
      }
    }
    if (snap && (snap.gs === 'lobby' || snap.gs === 'paused')) {
      ctx.fillStyle = 'rgba(4,5,12,0.66)'; ctx.fillRect(0, 0, W, H);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const n = snap.connected + snap.botCount;
      if (snap.gs === 'paused') {
        ctx.fillStyle = '#fff'; ctx.font = 'bold 34px system-ui,sans-serif'; ctx.fillText('PAUSE', W / 2, H / 2 - 6);
        ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.font = '14px system-ui,sans-serif'; ctx.fillText('P / Échap pour reprendre', W / 2, H / 2 + 28);
      } else {
        ctx.save(); if (!A.reduceFx) { ctx.shadowColor = 'rgba(120,140,255,.6)'; ctx.shadowBlur = 22; }
        ctx.fillStyle = '#fff'; ctx.font = 'bold 34px system-ui,sans-serif'; ctx.fillText('PONG', W / 2, H / 2 - 62); ctx.restore();
        ctx.fillStyle = 'rgba(255,255,255,.72)'; ctx.font = '15px system-ui,sans-serif';
        ctx.fillText(`${SHAPE[n] || (n + ' joueurs')} · ${snap.connected} humain${snap.connected > 1 ? 's' : ''}${snap.botCount ? ' + ' + snap.botCount + ' bot' + (snap.botCount > 1 ? 's' : '') : ''}`, W / 2, H / 2 - 32);
        ctx.fillStyle = teamMode ? '#9fd0ff' : 'rgba(255,255,255,.55)'; ctx.font = 'bold 14px system-ui,sans-serif';
        ctx.fillText(`${PRESET_LABEL[snap.preset] || snap.preset}${teamMode ? ' · ' + (MODE_NAME[snap.mode] || snap.mode) : ''}`, W / 2, H / 2 - 8);
        ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.font = '12px system-ui,sans-serif';
        ctx.fillText(PRESET_DESC[snap.preset] || '', W / 2, H / 2 + 12);
        if (snap.opts) { const o = snap.opts;
          let r = 'Victoire : ' + (WINMODE_LABEL[o.winMode] || o.winMode);
          if (o.winMode === 'rounds') r += ' (' + o.roundsTarget + ')'; else if (o.winMode === 'kills') r += ' (' + o.killsTarget + ')';
          if (o.sudden !== 'off') r += ' · Mort subite'; if (o.handicap) r += ' · Handicap';
          ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.font = '11.5px system-ui,sans-serif'; ctx.fillText(r, W / 2, H / 2 + 30);
        }
        ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.font = 'bold 13px system-ui,sans-serif';
        ctx.fillText(n >= 2 ? '▶ Espace / clic pour lancer' : '▶ Espace / clic — entraînement solo (mur) · ou ajoute un bot 🤖', W / 2, H / 2 + 52);
      }
    }
    rafId = requestAnimationFrame(draw);
  }

  /* ---- inputs ---- */
  function keyToAction(code) {
    if (['ArrowUp', 'ArrowLeft', 'KeyW', 'KeyA'].includes(code)) return 'up';
    if (['ArrowDown', 'ArrowRight', 'KeyS', 'KeyD'].includes(code)) return 'dn';
    return null;
  }
  function setAction(a, val) { if (input[a] === val) return; input[a] = val; send({ t: 'input', up: input.up, dn: input.dn }); }
  function setKey(code, val) { const a = keyToAction(code); if (a) setAction(a, val); }
  const onKeyDown = e => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
    unlockAudio();
    if (e.key === ' ' && snap && snap.gs !== 'play' && snap.gs !== 'paused') send({ t: 'start' });
    if ((e.key === 'p' || e.key === 'P' || e.key === 'Escape') && snap && (snap.gs === 'play' || snap.gs === 'paused')) send({ t: 'pause' });
    if (!e.repeat) setKey(e.code, true);
  };
  const onKeyUp = e => setKey(e.code, false);
  const onBlur = () => { if (input.up || input.dn) { input.up = input.dn = false; send({ t: 'input', up: false, dn: false }); } };
  function hold(el, action) {
    if (!el) return;
    const on = e => { e.preventDefault(); unlockAudio(); setAction(action, true); };
    const off = e => { e.preventDefault(); setAction(action, false); };
    el.addEventListener('pointerdown', on); el.addEventListener('pointerup', off);
    el.addEventListener('pointerleave', off); el.addEventListener('pointercancel', off);
  }

  function init(ctx0) {
    destroyed = false;              // module singleton réutilisé : réarmer la boucle de rendu après un précédent teardown
    A = ctx0.a11y; send = ctx0.send; root = ctx0.root;
    if (ctx0.togglePanel) togglePanel = ctx0.togglePanel;
    if (ctx0.closePanels) closePanels = ctx0.closePanels;
    cv = $('c'); ctx = cv.getContext('2d');
    hud = $('hud');
    hud.innerHTML = '';             // module réutilisé : repartir d'un HUD vide (sinon les cartes P1.. se cumulent à chaque retour)
    cards = [0, 1, 2, 3, 4, 5].map(i => {
      const el = document.createElement('div');
      el.className = 'pc hidden';
      el.innerHTML = `<div class="dot"></div><div class="inf"><div class="pn" id="pn${i}">P${i + 1}</div><div class="lv" id="lv${i}"></div></div>`;
      hud.appendChild(el); return el;
    });
    startBtn = $('startBtn'); pauseBtn = $('pauseBtn'); botsBtn = $('botsBtn'); modeBtn = $('modeBtn'); presetBtn = $('presetBtn'); pauseFloat = $('pauseFloat');
    optBtn = $('optBtn'); optionsPanel = $('options');
    optLives = $('optLives'); optSpeed = $('optSpeed'); optPu = $('optPu'); optAccel = $('optAccel');
    optWin = $('optWin'); optSudden = $('optSudden'); optServe = $('optServe'); optHandi = $('optHandi');
    optTarRow = $('optTarRow'); optTar = $('optTar'); optTarLbl = $('optTarLbl'); optNeg = $('optNeg'); optBot = $('optBot'); optStyle = $('optStyle'); optBump = $('optBump');
    lbBtn = $('lbBtn'); lbPanel = $('lbpanel'); voteBtn = $('voteBtn'); histPreset = $('histPreset'); histMode = $('histMode');

    startBtn.onclick = () => { unlockAudio(); send({ t: 'start' }); };
    pauseBtn.onclick = () => send({ t: 'pause' });
    pauseFloat.onclick = () => send({ t: 'pause' });
    botsBtn.onclick = () => send({ t: 'bots' });
    modeBtn.onclick = () => send({ t: 'mode' });
    presetBtn.onclick = () => send({ t: 'preset' });
    cv.addEventListener('click', () => { unlockAudio(); if (snap && snap.gs !== 'play' && snap.gs !== 'paused') send({ t: 'start' }); });
    optBtn.onclick = () => togglePanel(optionsPanel);
    { const puBtn = $('puBtn'), puPanel = $('puhelp'); if (puBtn && puPanel) puBtn.onclick = () => togglePanel(puPanel); }
    $('optLivesMinus').onclick = () => send({ t: 'opt', op: 'lives', d: -1 });
    $('optLivesPlus').onclick = () => send({ t: 'opt', op: 'lives', d: 1 });
    optSpeed.onclick = () => send({ t: 'opt', op: 'speed' });
    optPu.onchange = () => send({ t: 'opt', op: 'pu' });
    optAccel.onchange = () => send({ t: 'opt', op: 'accel' });
    optWin.onclick = () => send({ t: 'opt', op: 'winmode' });
    optSudden.onclick = () => send({ t: 'opt', op: 'sudden' });
    optServe.onclick = () => send({ t: 'opt', op: 'serve' });
    optHandi.onchange = () => send({ t: 'opt', op: 'handicap' });
    $('optTarMinus').onclick = () => send({ t: 'opt', op: curWinMode === 'kills' ? 'ktar' : 'rtar', d: -1 });
    $('optTarPlus').onclick = () => send({ t: 'opt', op: curWinMode === 'kills' ? 'ktar' : 'rtar', d: 1 });
    optNeg.onchange = () => send({ t: 'opt', op: 'negatives' });
    if (optBump) optBump.onchange = () => send({ t: 'opt', op: 'bumpers' });
    optBot.onclick = () => send({ t: 'opt', op: 'botdiff' });
    if (optStyle) optStyle.onclick = () => send({ t: 'opt', op: 'botstyle' });
    lbBtn.onclick = () => { togglePanel(lbPanel); renderLB(); renderHist(); };
    $('lbReset').onclick = () => { if (confirm('Réinitialiser le classement ?')) send({ t: 'lbreset' }); };
    voteBtn.onclick = () => send({ t: 'vote' });
    histPreset.onchange = renderHist; histMode.onchange = renderHist;
    $('endscreen').addEventListener('click', () => { unlockAudio(); send({ t: 'start' }); });
    hold($('touchUp'), 'up'); hold($('touchDn'), 'dn');

    applyColors();
    resizeH = resizeCanvas;
    addEventListener('resize', resizeH); resizeCanvas();
    addEventListener('keydown', onKeyDown); addEventListener('keyup', onKeyUp); addEventListener('blur', onBlur);
    music.start();
    rafId = requestAnimationFrame(draw);
  }
  function onA11y() { applyColors(); }
  function teardown() {
    destroyed = true; cancelAnimationFrame(rafId); music.stop();
    removeEventListener('resize', resizeH); removeEventListener('keydown', onKeyDown); removeEventListener('keyup', onKeyUp); removeEventListener('blur', onBlur);
  }

  return { init, onState, onMessage, onLb, onA11y, teardown };
})();
