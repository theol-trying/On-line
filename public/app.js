// SHELL client de la plateforme : réseau (WS + token), pseudo, menu de jeux, accessibilité partagée,
// gestion des panneaux modaux, et délégation du rendu/inputs au module du jeu actif (games/<id>/client.js).
import { initJoystick, joystickPour } from './joystick.js';   // manette tactile des 5 jeux (téléphone)
import { creerVitrine } from './vitrine.js';                  // accueil : les 6 jeux en cartes animées

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
const setMvol = document.getElementById('setMvol');
const setPad = document.getElementById('setPad');

/* ---------- accessibilité (partagée, persistée) ---------- */
const a11y = Object.assign({ palette: 'normal', contrast: false, reduceFx: false, theme: 'neon', music: false, sfx: 1, mvol: 0.7, pad: 'joy' },
  JSON.parse(localStorage.getItem('pong-lan-a11y') || localStorage.getItem('pong-a11y') || '{}'));
function applyA11y() {
  document.body.classList.toggle('flat', a11y.reduceFx);
  document.body.classList.remove('theme-neon', 'theme-crt', 'theme-light');
  document.body.classList.add('theme-' + (a11y.theme || 'neon'));
  setTheme.value = a11y.theme; setMusic.checked = a11y.music;
  setPalette.value = a11y.palette; setContrast.checked = a11y.contrast; setFx.checked = a11y.reduceFx;
  if (setSfx) setSfx.value = Math.round((a11y.sfx == null ? 1 : a11y.sfx) * 100);
  if (setMvol) setMvol.value = Math.round((a11y.mvol == null ? 0.7 : a11y.mvol) * 100);
  document.body.classList.toggle('pad-croix', a11y.pad === 'croix');   // téléphone : joystick (défaut) ou croix d'origine
  if (setPad) setPad.value = a11y.pad === 'croix' ? 'croix' : 'joy';
  localStorage.setItem('pong-lan-a11y', JSON.stringify(a11y));
  if (mod && mod.onA11y) mod.onA11y();
}
setPalette.onchange = () => { a11y.palette = setPalette.value; applyA11y(); };
setContrast.onchange = () => { a11y.contrast = setContrast.checked; applyA11y(); };
setFx.onchange = () => { a11y.reduceFx = setFx.checked; applyA11y(); };
setTheme.onchange = () => { a11y.theme = setTheme.value; applyA11y(); };
setMusic.onchange = () => { a11y.music = setMusic.checked; applyA11y(); };
if (setSfx) setSfx.oninput = () => { a11y.sfx = (parseInt(setSfx.value, 10) || 0) / 100; applyA11y(); };
if (setMvol) setMvol.oninput = () => { a11y.mvol = (parseInt(setMvol.value, 10) || 0) / 100; applyA11y(); };
if (setPad) setPad.onchange = () => { a11y.pad = setPad.value; applyA11y(); };
initJoystick();
if (setFull) setFull.onclick = () => { if (document.fullscreenElement) document.exitFullscreen && document.exitFullscreen(); else document.documentElement.requestFullscreen && document.documentElement.requestFullscreen(); };
/* vibration tactile (mobile) sur les boutons de contrôle .touch */
document.addEventListener('pointerdown', e => { if (e.target.closest && e.target.closest('.touch')) { try { navigator.vibrate && navigator.vibrate(8); } catch {} } }, { passive: true });
/* iOS, appui long sur une flèche : Safari ouvre la loupe et sélectionne le glyphe, ce qui capture le
   toucher et fige les commandes. Le CSS (-webkit-touch-callout / -webkit-user-select) suffit sur les
   versions récentes ; ce garde-fou couvre les plus anciennes, qui les appliquent mal.
   Volontairement limité aux `.touch` : ces boutons répondent à pointerdown/pointerup et JAMAIS à click,
   donc annuler le comportement par défaut ne supprime aucun clic utile. L'étendre aux autres boutons
   casserait leur `onclick` sur mobile. */
document.addEventListener('touchstart', e => {
  if (e.target && e.target.closest && e.target.closest('.touch')) { try { e.preventDefault(); } catch {} }
}, { passive: false });
/* Safari iOS n'a les Pointer Events que depuis la version 13. En dessous, les pavés tactiles — qui
   n'écoutent QUE pointerdown/pointerup — sont totalement muets. On traduit alors les événements
   tactiles en événements pointeur synthétiques, sans toucher au code des 5 jeux.
   Le bloc entier est ignoré dès que PointerEvent existe : aucun effet possible sur un appareil récent
   (sinon chaque appui compterait double). */
if (typeof window.PointerEvent === 'undefined') {
  const relais = (type, e) => {
    const el = e.target && e.target.closest && e.target.closest('.touch');
    if (!el) return;
    e.preventDefault();
    const ev = document.createEvent('Event');
    ev.initEvent(type, true, true);
    el.dispatchEvent(ev);
  };
  document.addEventListener('touchstart', e => relais('pointerdown', e), { passive: false });
  document.addEventListener('touchend', e => relais('pointerup', e), { passive: false });
  document.addEventListener('touchcancel', e => relais('pointercancel', e), { passive: false });
}

/* ---------- mode « plateau plein écran » (body.playing.dock) ----------
   Sur un écran 16:9 le plateau est limité par la HAUTEUR : toute la largeur en trop ne servait
   à rien (fond animé). On la convertit en deux colonnes — chat à gauche, joueurs à droite — mais
   UNIQUEMENT quand elles ne rognent pas le plateau. D'où ce calcul plutôt qu'une media query
   fixe : sur un 4:3 (1024×768) la largeur manque, on garde alors l'empilement vertical.
   `--sidew` = largeur réellement disponible, plafonnée : au-delà, ce serait du vide en plus. */
const MARGE = 14;
const SIDE_JEU = { pong: 200 };          // Pong encadre son plateau des flèches ▲▼ : cette largeur-là n'est pas négociable
let sideJeu = 0;
function layoutArena() {
  const W = window.innerWidth, H = window.innerHeight;
  const hUtile = H - MARGE * 2;                                  // hauteur offerte au plateau : tout l'écran (le bandeau n'occupe que les colonnes)
  // Les colonnes ne prennent QUE le surplus : le plateau garde sa hauteur utile, et les
  // commandes latérales du jeu actif sont déduites avant le partage (sinon on les lui volait).
  let side = Math.floor((W - hUtile - sideJeu - MARGE * 4) / 2);
  if (side > 320) side = 320;
  const dock = W >= 1000 && H >= 520 && side >= 168;
  document.body.classList.toggle('dock', dock);
  if (dock) document.documentElement.style.setProperty('--sidew', side + 'px');
}
function majTaille() {                                           // fait recalculer la taille du plateau aux jeux
  try { window.dispatchEvent(new Event('resize')); }
  catch (e) { const ev = document.createEvent('Event'); ev.initEvent('resize', true, false); window.dispatchEvent(ev); }
}
// Enregistré AVANT le module de jeu (importé plus tard) : la classe et --sidew sont donc à jour
// quand le jeu mesure la colonne centrale.
window.addEventListener('resize', layoutArena);
layoutArena();

/* ---------- panneaux modaux (partagés shell + jeu) ---------- */
function closePanels() { document.querySelectorAll('.settings').forEach(p => p.classList.add('hidden')); scrim.classList.add('hidden'); }
function togglePanel(p) { const show = p.classList.contains('hidden'); closePanels(); if (show) { p.classList.remove('hidden'); scrim.classList.remove('hidden'); } }
// Les 5 jeux appellent closePanels() à CHAQUE instantané de partie (60×/s) pour dégager l'écran.
// Le chat doit y échapper, sinon il se referme sous les doigts et devient inutilisable en jeu.
// C'est cette fonction-là qui est passée aux modules de jeu, pas closePanels.
function closeGamePanels() {
  document.querySelectorAll('.settings').forEach(p => { if (p !== chatPanel) p.classList.add('hidden'); });
  if (!chatPanel || chatPanel.classList.contains('hidden')) scrim.classList.add('hidden');
}
scrim.onclick = closePanels;
document.querySelectorAll('.sclose').forEach(b => b.onclick = closePanels);
setBtn.onclick = () => togglePanel(settingsPanel);
setFloat.onclick = () => togglePanel(settingsPanel);

/* ---------- quitter / abandonner la partie en cours (visible seulement en jeu) ---------- */
const quitFloat = document.getElementById('quitFloat');
if (quitFloat) quitFloat.onclick = () => { closePanels(); gameSend({ t: 'abort' }); };

/* ---------- émotes (flottant, broadcast à tous) ---------- */
const EMOTES = ['👍', '😂', '😮', '😡', '🎉', '🔥', '😎', '🤝', '💀', '🫡'];
const emoteFloat = document.getElementById('emoteFloat');
const emoteBar = document.getElementById('emoteBar');
const emoteToasts = document.getElementById('emoteToasts');
if (emoteBar) emoteBar.innerHTML = EMOTES.map(e => `<button class="emo" data-e="${e}">${e}</button>`).join('');
if (emoteFloat) emoteFloat.onclick = () => { if (emoteBar) emoteBar.classList.toggle('hidden'); };
if (emoteBar) emoteBar.querySelectorAll('.emo').forEach(b => b.onclick = () => { send({ t: 'emote', e: b.dataset.e }); emoteBar.classList.add('hidden'); });
function showEmote(name, e) {
  if (!emoteToasts) return;
  const el = document.createElement('div'); el.className = 'etoast';
  el.innerHTML = `<span class="en"></span> <span class="ee"></span>`;
  el.querySelector('.en').textContent = (name || 'Joueur'); el.querySelector('.ee').textContent = e;
  emoteToasts.appendChild(el);
  while (emoteToasts.children.length > 6) emoteToasts.removeChild(emoteToasts.firstChild);
  setTimeout(() => el.remove(), 2600);
}

/* ---------- classement global cross-jeux ---------- */
const boards = {};            // gid -> [entrées de classement]
const globalBtn = document.getElementById('globalBtn');
const globalPanel = document.getElementById('globalPanel');
const globalBody = document.getElementById('globalBody');
if (globalBtn) globalBtn.onclick = () => { togglePanel(globalPanel); renderGlobal(); };
function renderGlobal() {
  if (!globalBody) return;
  const agg = {};
  for (const gid in boards) for (const e of (boards[gid] || [])) {
    const a = agg[e.name] || (agg[e.name] = { name: e.name, games: 0, wins: 0, kills: 0, jeux: 0 });
    a.games += e.games || 0; a.wins += e.wins || 0; a.kills += e.kills || 0; a.jeux++;
  }
  const list = Object.values(agg).sort((x, y) => y.wins - x.wins || y.kills - x.kills || y.games - x.games);
  if (!list.length) { globalBody.innerHTML = '<div class="lbnote">Aucune partie enregistrée pour l\'instant.</div>'; return; }
  const medal = ['🥇', '🥈', '🥉'];
  globalBody.innerHTML = list.map((e, i) => `<div class="lbrow"><span class="lbn">${medal[i] || ('#' + (i + 1))} ${avatarHtml(e.name)}${esc(e.name)}</span><span title="parties">🎮${e.games}</span><span title="victoires">🏆${e.wins}</span><span title="éliminations">⚡${e.kills}</span><span title="jeux différents joués">🎲${e.jeux}</span></div>`).join('');
}
const esc = s => ('' + s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

/* ---------- admin : réinitialisation des classements (réservé au détenteur de la clé) ---------- */
let adminKey = '';                       // clé admin = marqueur « game master » (présentée au hub à la connexion)
(function initAdmin() {
  const urlKey = new URLSearchParams(location.search).get('admin');
  if (urlKey) { localStorage.setItem('pong-lan-admin', urlKey); try { history.replaceState(null, '', location.pathname); } catch {} } // mémorise la clé puis nettoie l'URL
  adminKey = localStorage.getItem('pong-lan-admin') || '';
  const adminBox = document.getElementById('adminBox'), adminResetBtn = document.getElementById('adminResetBtn');
  if (adminKey && adminBox) adminBox.style.display = '';
  if (adminResetBtn) adminResetBtn.onclick = () => {
    if (!adminKey || !confirm('Réinitialiser TOUS les classements (chaque jeu + classement global) ? Action irréversible.')) return;
    send({ t: 'adminreset', key: adminKey });
    for (const k in boards) boards[k] = []; renderGlobal();   // vide aussi localement tout de suite
    note('🗑 Classements réinitialisés');
  };
})();

/* ---------- ping ---------- */
const pingTxt = document.getElementById('pingTxt');
let pingTimer = null;
function startPing() { if (pingTimer) clearInterval(pingTimer); pingTimer = setInterval(() => send({ t: 'png', ts: Math.round(performance.now()) }), 3000); }

/* ---------- système « Prêt » (gate de démarrage, transverse aux 6 jeux) ---------- */
let roomPlayers = [], roomHost = null;
const readyBar = document.getElementById('readyBar');
const readyList = document.getElementById('readyList');
const readyCount = document.getElementById('readyCount');
const readyBtn = document.getElementById('readyBtn');
const forceBtn = document.getElementById('forceBtn');
const reseatBtn = document.getElementById('reseatBtn');
const myEntry = () => roomPlayers.find(p => p.id === you.id);
function renderReady() {
  if (!readyBar) return;
  const gs = lastGs[activeId] || 'lobby';
  const idle = gs === 'lobby' || gs === 'over';
  const players = roomPlayers.filter(p => p.role === 'player');
  const me = myEntry();
  const isSpec = me && me.role === 'spectator';
  if (!idle || !me || (!isSpec && players.length < 2)) { readyBar.classList.add('hidden'); return; }   // seul : pas de barre « Prêt » (le hub ne gate pas non plus) ; toujours visible pour un spectateur (bouton siège)
  readyBar.classList.remove('hidden');
  const nready = players.filter(p => p.ready).length;
  readyList.innerHTML = players.map(p => `<span class="rdy ${p.ready ? 'on' : ''}">${p.ready ? '✅' : '⚪'} ${avatarHtml(p.name)}${esc(p.name || 'Joueur')}${p.id === roomHost ? ' 👑' : ''}</span>`).join('');
  if (readyCount) readyCount.textContent = `Prêts : ${nready}/${players.length}`;
  const meReady = !!me.ready;
  readyBtn.style.display = me.role === 'player' ? '' : 'none';
  readyBtn.textContent = meReady ? '✅ Prêt' : '☐ Pas prêt';
  readyBtn.classList.toggle('on', meReady);
  forceBtn.style.display = (you.id === roomHost) ? '' : 'none';
  if (reseatBtn) reseatBtn.style.display = isSpec ? '' : 'none';   // spectateur : peut tenter de prendre un siège libéré
}
if (readyBtn) readyBtn.onclick = () => { const me = myEntry(); send({ t: 'ready', v: !(me && me.ready) }); };
if (forceBtn) forceBtn.onclick = () => send({ t: 'forcestart' });
if (reseatBtn) reseatBtn.onclick = () => send({ t: 'reseat' });
function note(txt) { if (!emoteToasts) return; const el = document.createElement('div'); el.className = 'etoast'; el.textContent = txt; emoteToasts.appendChild(el); while (emoteToasts.children.length > 6) emoteToasts.removeChild(emoteToasts.firstChild); setTimeout(() => el.remove(), 2600); }

/* ---------- tournoi (orchestré par le hub : une manche de chaque jeu, points cumulés) ---------- */
let tourState = null;
const tourBtn = document.getElementById('tourBtn');
const tourBar = document.getElementById('tourBar');
function renderTour() {
  if (!tourBar) return;
  if (!tourState || !tourState.on) { tourBar.classList.add('hidden'); return; }
  tourBar.classList.remove('hidden');
  const gname = (gamesMeta.find(g => g.id === tourState.game) || {}).name || tourState.game;
  const med = ['🥇', '🥈', '🥉'];
  const sc = (tourState.scores || []).slice(0, 4).map((e, i) => `${med[i] || '·'} ${esc(e.name)} <b>${e.pts}</b>`).join(' &nbsp; ');
  tourBar.innerHTML = `<b>🏆 Manche ${Math.min(tourState.idx + 1, tourState.total)}/${tourState.total}</b> — ${esc(gname)}${sc ? ' &nbsp;·&nbsp; ' + sc : ''}`;
}
function showPodium(scores) {
  const panel = document.getElementById('tourPanel'), body = document.getElementById('tourBody');
  if (!panel || !body) return;
  const med = ['🥇', '🥈', '🥉'];
  body.innerHTML = (scores && scores.length)
    ? `<div class="champ">👑 ${esc(scores[0].name)} remporte le tournoi !</div>` +
      scores.map((e, i) => `<div class="lbrow"><span class="lbn">${med[i] || '#' + (i + 1)} ${esc(e.name)}</span><span>${e.pts} pts</span></div>`).join('')
    : '<div class="lbnote">Aucun point marqué.</div>';
  closePanels(); panel.classList.remove('hidden'); scrim.classList.remove('hidden');
  fireConfetti();
}
if (tourBtn) tourBtn.onclick = () => {
  if (you.id !== roomHost) { note('👑 Seul l\'hôte (1ᵉʳ joueur) peut gérer le tournoi'); return; }
  if (tourState && tourState.on && !confirm('Annuler le tournoi en cours ?')) return;
  send({ t: 'tour' });
};

/* ---------- mini-chat de salon (texte court, diffusé à tous, historique côté hub) ---------- */
const chatFloat = document.getElementById('chatFloat'), chatPanel = document.getElementById('chatPanel');
const chatLogEl = document.getElementById('chatLog'), chatInput = document.getElementById('chatInput');
const chatSend = document.getElementById('chatSend'), chatDot = document.getElementById('chatDot');
function chatToast(name, txt) {                 // bulle visible même en partie — construite sans innerHTML
  if (!emoteToasts) return;
  const el = document.createElement('div'); el.className = 'etoast';
  const b = document.createElement('span'); b.className = 'en'; b.textContent = name;
  const s = document.createElement('span'); s.className = 'ec'; s.textContent = ' ' + txt;
  el.appendChild(b); el.appendChild(s); emoteToasts.appendChild(el);
  while (emoteToasts.children.length > 6) emoteToasts.removeChild(emoteToasts.firstChild);
  setTimeout(() => el.remove(), 2600);
}
function pushChat(rec, silent) {
  if (!chatLogEl || !rec || typeof rec.m !== 'string') return;
  const el = document.createElement('div');
  el.className = 'cmsg' + (rec.id === you.id ? ' mine' : '');
  const b = document.createElement('b'); b.textContent = rec.name || 'Joueur';
  const s = document.createElement('span'); s.textContent = rec.m;
  el.appendChild(b); el.appendChild(s); chatLogEl.appendChild(el);
  while (chatLogEl.children.length > 40) chatLogEl.removeChild(chatLogEl.firstChild);
  chatLogEl.scrollTop = chatLogEl.scrollHeight;
  if (!silent && rec.id !== you.id) {
    // Chat docké en colonne : le message est déjà sous les yeux — ni bulle ni pastille « non lu ».
    if (chatOuvert()) { if (chatDot) chatDot.classList.add('hidden'); }
    else {
      // Téléphone, joueur encore en vie : pas de bulle sur le plateau. La pastille « non lu »
      // l'attend sur le bouton 💬, qui réapparaît dès l'élimination.
      if (!enJeuTelephone()) chatToast(rec.name || 'Joueur', rec.m);
      if (chatDot) chatDot.classList.remove('hidden');
    }
  }
}
function sendChat() {
  if (!chatInput) return;
  const v = chatInput.value.trim().slice(0, 140);
  if (!v) return;
  send({ t: 'chat', m: v }); chatInput.value = '';
  // En partie, le champ garde le focus et avale les flèches (stopPropagation) : on rend la main au jeu.
  if (document.body.classList.contains('playing')) chatInput.blur();
}
/* Chat docké (colonne de gauche en plein écran) : il n'est plus une fenêtre modale qu'on ouvre et
   ferme, mais une colonne qu'on replie. Deux états distincts, d'où ces deux aides. */
const chatDocke = () => document.body.classList.contains('dock') && document.body.classList.contains('playing');
const chatOuvert = () => chatDocke()
  ? !document.body.classList.contains('nochat')
  : !!(chatPanel && !chatPanel.classList.contains('hidden'));
function replierChat(off) {
  document.body.classList.toggle('nochat', off);
  try { localStorage.setItem('pong-lan-nochat', off ? '1' : ''); } catch (e) {}
  if (!off && chatDot) chatDot.classList.add('hidden');
  majTaille();                                    // le plateau récupère (ou rend) la colonne
}
try { if (localStorage.getItem('pong-lan-nochat')) document.body.classList.add('nochat'); } catch (e) {}

/* Téléphone en partie : tant qu'on joue, ni chat ni liste des joueurs (style.css). Une fois
   ÉLIMINÉ — ou spectateur — les deux redeviennent accessibles à la demande. L'élimination est lue
   sur les cartes que chaque jeu tient déjà à jour (`.pc.me`, `.pc.dead`) : aucun des 5 jeux n'est
   modifié, et la nuance de Bomberman est respectée (en mode revanche, un mort qui joue depuis le bord
   n'est PAS marqué éliminé : il garde sa manette). */
const estTelephone = () => window.innerWidth <= 600;              // même seuil que le bloc mobile de style.css
const enJeuTelephone = () => estTelephone() && document.body.classList.contains('playing') && !document.body.classList.contains('out');
const hudFloat = document.getElementById('hudFloat');
function majHorsJeu() {
  const b = document.body;
  if (!b.classList.contains('playing')) { b.classList.remove('out'); b.classList.remove('hudon'); return; }
  const racine = document.querySelector('.game-root:not(.hidden)');
  const moi = racine && racine.querySelector('.pc.me');
  const out = !moi || moi.classList.contains('dead');
  if (out === b.classList.contains('out')) return;
  b.classList.toggle('out', out);
  // De retour en jeu (nouvelle manche, résurrection en revanche) : on libère l'écran sur-le-champ.
  if (!out && estTelephone()) { b.classList.remove('hudon'); if (chatPanel) chatPanel.classList.add('hidden'); }
}
if (hudFloat) hudFloat.onclick = () => {
  const on = !document.body.classList.contains('hudon');
  document.body.classList.toggle('hudon', on);
  if (on && chatPanel && !chatDocke()) chatPanel.classList.add('hidden');   // les deux s'ouvrent au même endroit
};
// Le chat s'ouvre SANS voile modal : en pleine partie, il ne doit ni masquer le plateau
// ni intercepter les clics. C'est la seule fenêtre du site dans ce cas.
if (chatFloat) chatFloat.onclick = () => {
  if (!chatPanel) return;
  if (chatDocke()) { replierChat(!document.body.classList.contains('nochat')); return; }
  document.body.classList.remove('hudon');        // liste des joueurs et chat s'ouvrent au même endroit sur téléphone
  const ouvrir = chatPanel.classList.contains('hidden');
  closePanels();                                  // referme le reste (et le voile), puis…
  if (ouvrir) {
    chatPanel.classList.remove('hidden');
    if (chatDot) chatDot.classList.add('hidden');
    if (chatLogEl) chatLogEl.scrollTop = chatLogEl.scrollHeight;
    if (chatInput) setTimeout(() => chatInput.focus(), 40);
  }
};
if (chatSend) chatSend.onclick = sendChat;
// La croix du panneau : en colonne elle replie la colonne — `closePanels()` n'y ferait rien de visible.
const chatClose = chatPanel && chatPanel.querySelector('.sclose');
if (chatClose) chatClose.onclick = () => { if (chatDocke()) replierChat(true); else closePanels(); };
// stopPropagation : sans ça, Espace/flèches tapés dans le champ atteindraient les raccourcis du jeu (lancer, se déplacer…)
if (chatInput) chatInput.onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); sendChat(); } };

/* ---------- défi du jour (carte commune 24 h sur Tanks/Bomberman + classement quotidien) ---------- */
let dailyOn = false, dailyBoard = [], dailyDate = '';
const dailyBtn = document.getElementById('dailyBtn'), dailyPanel = document.getElementById('dailyPanel');
const dailyBody = document.getElementById('dailyBody'), dailyDayEl = document.getElementById('dailyDay'), dailyToggle = document.getElementById('dailyToggle');
function renderDaily() {
  if (dailyBtn) { dailyBtn.classList.toggle('on', dailyOn); dailyBtn.textContent = dailyOn ? '🎲 Défi ON' : '🎲 Défi'; }
  if (dailyToggle) {
    dailyToggle.style.display = (you.id && you.id === roomHost) ? '' : 'none';   // réglage de plateforme : game master seulement
    dailyToggle.textContent = dailyOn ? '🎲 Désactiver le défi du jour' : '🎲 Activer le défi du jour';
  }
  if (dailyDayEl) dailyDayEl.textContent = dailyDate ? '· ' + dailyDate : '';
  if (!dailyBody) return;
  if (!dailyBoard.length) { dailyBody.innerHTML = '<div class="lbnote">Aucune manche jouée aujourd\'hui — à toi de commencer !</div>'; return; }
  const medal = ['🥇', '🥈', '🥉'];
  dailyBody.innerHTML = dailyBoard.map((e, i) => `<div class="dayrow"><span class="dn">${medal[i] || ('#' + (i + 1))} ${avatarHtml(e.name)}${esc(e.name)}</span><span title="manches">🎮${e.games | 0}</span><span title="victoires">🏆${e.wins | 0}</span><span title="éliminations">⚡${e.kills | 0}</span><span class="dp" title="points du jour">${e.pts | 0} pts</span></div>`).join('');
}
if (dailyBtn) dailyBtn.onclick = () => { togglePanel(dailyPanel); send({ t: 'dayreq' }); renderDaily(); };
if (dailyToggle) dailyToggle.onclick = () => send({ t: 'daytoggle' });

/* ---------- avatars de profil (emoji ou image, liés au pseudo) ---------- */
const AV_EMOJIS = ['🦊', '🐸', '🤖', '🐙', '🦄', '🐼', '🐝', '🦁', '🐧', '🐢', '🦖', '👻', '🐳', '🦉', '🐯', '🍄', '⚡', '🌟', '💀', '🎃'];
const AV_IMG_RE = /^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$/;
const avatars = {};                       // pseudo -> emoji | data URL
let myAvatar = localStorage.getItem('pong-lan-avatar') || '';
const avBtn = document.getElementById('avBtn'), avPanel = document.getElementById('avPanel');
const avPrev = document.getElementById('avPrev'), avGrid = document.getElementById('avGrid');
const avFile = document.getElementById('avFile'), avClear = document.getElementById('avClear');

function avatarHtml(name, cls) {          // HTML sûr : l'image n'est acceptée qu'en base64 strict
  const a = name && avatars[name];
  if (!a) return '';
  if (a.slice(0, 11) === 'data:image/') return AV_IMG_RE.test(a) ? `<img class="${cls || 'av'}" src="${a}" alt="">` : '';
  return `<span class="${cls || 'av'} av-e">${esc(a)}</span>`;
}
window.__AV = n => avatarHtml(n);         // utilisé par les cartes HUD des 5 jeux
// Source BRUTE de l'avatar pour le canvas (public/avatar-sprite.js) : l'emoji, ou la data URL validée par
// AV_IMG_RE (base64 strict) — jamais une chaîne arbitraire venue du réseau.
window.__AVSRC = n => {
  const a = n && avatars[n];
  if (!a) return null;
  if (a.slice(0, 11) === 'data:image/') return AV_IMG_RE.test(a) ? a : null;
  return a;
};
function avBig(a) { return a ? (a.slice(0, 11) === 'data:image/' ? (AV_IMG_RE.test(a) ? `<img src="${a}" alt="">` : '🙂') : esc(a)) : '🙂'; }
function renderAvatarUI() {
  if (avBtn) avBtn.innerHTML = avBig(myAvatar);
  if (avPrev) avPrev.innerHTML = avBig(myAvatar);
}
function setMyAvatar(a) {
  myAvatar = a || '';
  try { localStorage.setItem('pong-lan-avatar', myAvatar); } catch {}
  if (myName) { if (myAvatar) avatars[myName] = myAvatar; else delete avatars[myName]; }
  send({ t: 'avatar', a: myAvatar });
  renderAvatarUI(); renderReady();
}
function avFromFile(file) {               // réduction 64×64 recadrée au centre → data URL légère
  const fr = new FileReader();
  fr.onload = () => {
    const img = new Image();
    img.onload = () => {
      const S = 64, cv = document.createElement('canvas'); cv.width = cv.height = S;
      const cx = cv.getContext('2d'), s = Math.min(img.width, img.height);
      cx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, S, S);
      let out = cv.toDataURL('image/webp', 0.75);
      if (out.slice(0, 15) !== 'data:image/webp') out = cv.toDataURL('image/jpeg', 0.75);   // vieux Safari
      if (out.length > 14000) out = cv.toDataURL('image/jpeg', 0.5);
      if (out.length > 19000) { note('Image trop lourde, essaie une photo plus simple'); return; }
      setMyAvatar(out);
      note('Avatar mis à jour');
    };
    img.onerror = () => note('Image illisible');
    img.src = fr.result;
  };
  fr.onerror = () => note('Lecture du fichier impossible');
  fr.readAsDataURL(file);
}
if (avGrid) avGrid.innerHTML = AV_EMOJIS.map(e => `<button data-a="${e}">${e}</button>`).join('');
if (avGrid) avGrid.querySelectorAll('button').forEach(b => b.onclick = () => setMyAvatar(b.dataset.a));
if (avBtn) avBtn.onclick = () => { renderAvatarUI(); togglePanel(avPanel); };
if (avFile) avFile.onchange = () => { const f = avFile.files && avFile.files[0]; if (f) avFromFile(f); avFile.value = ''; };
if (avClear) avClear.onclick = () => setMyAvatar('');

/* ---------- pseudo ---------- */
nameInput.value = myName;
nameInput.onchange = () => { myName = nameInput.value.trim().slice(0, 12); localStorage.setItem('pong-lan-name', myName); send({ t: 'name', name: myName }); };
nameInput.onkeydown = e => e.stopPropagation();   // saisie du pseudo : Espace/flèches ne doivent pas déclencher les raccourcis du jeu

/* ---------- menu de jeux ---------- */
// Vitrine de 6 cartes animées (public/vitrine.js) : créée au premier appel, puis seul l'état .on change
// à chaque message 'room' — les cartes ne sont reconstruites que si la liste des jeux change.
let vitrine = null;
function renderMenu() {
  if (!vitrine) vitrine = creerVitrine(gamemenu, { choisir: id => send({ t: 'pick', id }), sous: id => GAME_SUB[id] });
  vitrine.rendre(gamesMeta, activeId);
}

/* ---------- identité visuelle de la page selon le jeu actif ---------- */
const GAME_SUB = { pong: 'Arcade néon · duel de raquettes', tron: 'Cyber-grid · light cycles', tank: 'Combat blindé · zone désertique', snake: 'Jardin · serpents gourmands', bomb: 'Labyrinthe explosif · cartoon', sumo: 'Dohyō · pousse-les hors du cercle' };
const GAME_TITLE = { pong: 'PONG', tron: 'TRON', tank: 'TANKS', snake: 'SNAKE', bomb: 'BOMBERMAN', sumo: 'SUMO' };
function setGameSkin(id) {
  const b = document.body;
  ['pong', 'tron', 'tank', 'bomb', 'snake', 'sumo'].forEach(g => b.classList.toggle('game-' + g, g === id));
  const sub = document.getElementById('sub'); if (sub && GAME_SUB[id]) sub.textContent = GAME_SUB[id];
  const lg = document.querySelector('.logo'); if (lg && GAME_TITLE[id]) lg.textContent = GAME_TITLE[id];   // l'en-tête porte le titre du jeu actif
}

/* ---------- chargement dynamique du module de jeu actif ---------- */
async function loadModule(id) {
  sideJeu = SIDE_JEU[id] || 0; layoutArena();     // largeur des colonnes : elle dépend du jeu affiché
  if (modId === id || loadingId === id) return;
  loadingId = id; setGameSkin(id);
  xfadeShow(GAME_TITLE[id] || '', false);          // fondu plein écran + balayage aux couleurs du nouveau jeu
  if (mod && mod.teardown) { try { mod.teardown(); } catch {} }
  mod = null; modId = null; modReady = false;
  document.querySelectorAll('.game-root').forEach(r => r.classList.add('hidden'));
  const rootEl = document.getElementById(id + '-root');
  if (rootEl) rootEl.classList.remove('hidden');
  try {
    const m = await import(`./games/${id}/client.js`);
    if (loadingId !== id) return;                 // un chargement plus récent a pris le relais
    mod = m.default;
    mod.init({ root: rootEl || document.body, send: gameSend, a11y, togglePanel, closePanels: closeGamePanels });
    joystickPour(id, mod.joy);                    // table de boutons du jeu (Pong fournit sa propre projection)
    modId = id; modReady = true; loadingId = null;
    if (mod.onA11y) mod.onA11y();
    const p = pend[id];                           // vider le tampon de ce jeu
    if (p) { p.msgs.forEach(x => mod.onMessage && mod.onMessage(x)); if (p.lb && mod.onLb) mod.onLb(p.lb); if (p.state && mod.onState) mod.onState(p.state); delete pend[id]; }
    xfadeHide();                                  // révèle le nouveau jeu
  } catch (e) { loadingId = null; xfadeHide(); msgTxt.textContent = 'Jeu « ' + id + ' » indisponible'; }
}

/* ---------- transitions thématiques (changement de jeu ET changement de manche) ---------- */
const xfadeEl = document.getElementById('xfade');
let sweepT = 0;
// La classe `on` pilote l'animation du balayage : hors transition elle reste en pause (perf mobile).
function xfadeShow(label, quick) {
  if (!xfadeEl) return;
  clearTimeout(sweepT);
  xfadeEl.textContent = label || '';
  if (quick) xfadeEl.classList.add('quick'); else xfadeEl.classList.remove('quick');
  xfadeEl.classList.add('on');
  xfadeEl.style.opacity = '1';
}
function xfadeHide() {
  if (!xfadeEl) return;
  xfadeEl.style.opacity = '0';
  clearTimeout(sweepT);
  sweepT = setTimeout(() => { xfadeEl.classList.remove('on'); xfadeEl.classList.remove('quick'); xfadeEl.textContent = ''; }, 320);
}
// Balayage court par-dessus le plateau (nouvelle manche) : le fond reste transparent, seule la bande passe.
function themedSweep(label) {
  if (!xfadeEl || a11y.reduceFx) return;
  xfadeShow(label, true);
  sweepT = setTimeout(xfadeHide, 340);
}

/* ---------- célébrations de victoire : une identité par jeu (overlay global, zéro dépendance) ---------- */
const confettiCv = document.getElementById('confetti');
let confettiRaf = 0;
const lastGs = {};                 // g -> dernier gameState vu (pour ne déclencher qu'une fois)
const stateCache = {};             // g -> dernier état COMPLET reconstitué (le hub n'envoie que les clés modifiées)
// mode = trajectoire (chute / envol / explosion) · shape = forme dessinée · cols = palette du jeu
const CELEB = {
  pong:  { n: 150, mode: 'fall',  shape: 'rect',   glow: 1, cols: ['#ff5db4', '#5db4ff', '#ffffff', '#ffd36e'] },              // néon arcade
  tron:  { n: 170, mode: 'fall',  shape: 'streak', glow: 1, cols: ['#1fe0ff', '#ff9b2f', '#ffffff', '#7ce8ff'] },              // pluie de pixels néon
  tank:  { n: 130, mode: 'burst', shape: 'spark',  glow: 0, cols: ['#e0a92e', '#fff1c4', '#d6b878', '#ff8a3d'] },              // feu d'artifice dans le désert
  snake: { n: 96,  mode: 'rise',  shape: 'petal',  glow: 0, cols: ['#8fe06a', '#e268b0', '#ffd36e', '#ffffff'] },              // envolée de papillons et de pétales
  bomb:  { n: 150, mode: 'fall',  shape: 'dot',    glow: 0, cols: ['#ff5a4e', '#ffd24a', '#4ad6ff', '#7bff7b', '#ff9be0'] },   // gros confettis cartoon
  sumo:  { n: 110, mode: 'fall',  shape: 'petal',  glow: 0, cols: ['#f7b8c8', '#ffd9e2', '#ffffff', '#e0452f'] },              // pétales de sakura sur le dohyō
};
function fireConfetti(gid) {
  if (!confettiCv || a11y.reduceFx) return;                       // respecte « réduire les effets »
  const cfg = CELEB[gid || activeId] || CELEB.pong;
  const dpr = window.devicePixelRatio || 1, W = innerWidth, H = innerHeight;
  confettiCv.width = Math.round(W * dpr); confettiCv.height = Math.round(H * dpr);
  confettiCv.style.width = W + 'px'; confettiCv.style.height = H + 'px'; confettiCv.style.display = 'block';
  const cx = confettiCv.getContext('2d');
  const parts = [], N = Math.round(cfg.n * (W < 520 ? 0.6 : 1));  // mobile : moins de particules
  for (let i = 0; i < N; i++) {
    const c = cfg.cols[(Math.random() * cfg.cols.length) | 0], ph = Math.random() * 6.28;
    if (cfg.mode === 'burst') {                                   // gerbe depuis le centre
      const a = Math.random() * 6.2832, sp = 2 + Math.random() * 7;
      parts.push({ x: W / 2, y: H * 0.42, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1.5, g: 0.11, r: 2 + Math.random() * 3, rot: a, vr: 0, c, life: 1, ph });
    } else if (cfg.mode === 'rise') {                             // envol depuis le bas
      parts.push({ x: W * Math.random(), y: H + 20 + Math.random() * H * 0.5, vx: (Math.random() * 2 - 1) * 0.5, vy: -(0.8 + Math.random() * 1.6), g: 0, r: 3 + Math.random() * 4, rot: ph, vr: (Math.random() * 2 - 1) * 0.06, c, life: 1, ph });
    } else {                                                      // chute classique
      parts.push({ x: W * (0.1 + Math.random() * 0.8), y: -20 - Math.random() * H * 0.45, vx: (Math.random() * 2 - 1) * 3, vy: 2 + Math.random() * 4, g: 0.08, r: 3 + Math.random() * 4, rot: ph, vr: (Math.random() * 2 - 1) * 0.3, c, life: 1, ph });
    }
  }
  const t0 = performance.now();
  cancelAnimationFrame(confettiRaf);
  const step = () => {
    const age = performance.now() - t0;
    cx.setTransform(dpr, 0, 0, dpr, 0, 0); cx.clearRect(0, 0, W, H);
    cx.shadowBlur = 0;
    if (cfg.glow) { cx.shadowColor = 'rgba(255,255,255,.55)'; cx.shadowBlur = 8; }
    let alive = 0;
    for (const p of parts) {
      p.vy += p.g; p.vx *= 0.995;
      if (cfg.mode === 'rise') p.x += Math.sin(age / 520 + p.ph) * 0.9;        // dérive sinusoïdale : vol de papillon
      p.x += p.vx; p.y += p.vy; p.rot += p.vr;
      if (age > (cfg.mode === 'rise' ? 1600 : 2200)) p.life -= 0.035;
      if (p.life <= 0 || p.y > H + 40 || p.y < -H * 0.6) continue;
      alive++;
      cx.save(); cx.globalAlpha = Math.max(0, p.life); cx.translate(p.x, p.y); cx.rotate(p.rot); cx.fillStyle = p.c;
      if (cfg.shape === 'dot') { cx.beginPath(); cx.arc(0, 0, p.r, 0, 6.2832); cx.fill(); }
      else if (cfg.shape === 'streak') cx.fillRect(-p.r * 0.28, -p.r * 2.2, p.r * 0.56, p.r * 4.4);
      else if (cfg.shape === 'spark') { cx.fillRect(-p.r * 0.35, -p.r * 1.6, p.r * 0.7, p.r * 3.2); cx.globalAlpha = Math.max(0, p.life) * 0.45; cx.beginPath(); cx.arc(0, 0, p.r * 1.5, 0, 6.2832); cx.fill(); }
      else if (cfg.shape === 'petal') { cx.scale(1.4, 0.7); cx.beginPath(); cx.arc(0, 0, p.r, 0, 6.2832); cx.fill(); }   // scale plutôt que ellipse() : compatible vieux Safari
      else cx.fillRect(-p.r, -p.r * 0.5, p.r * 2, p.r);
      cx.restore();
    }
    if (alive > 0 && age < 4500) confettiRaf = requestAnimationFrame(step);
    else { cx.shadowBlur = 0; cx.clearRect(0, 0, W, H); confettiCv.style.display = 'none'; }
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
  ws.onopen = () => { if (adminKey) send({ t: 'auth', key: adminKey }); if (myName) send({ t: 'name', name: myName }); if (myAvatar) send({ t: 'avatar', a: myAvatar }); startPing(); };
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
      roomPlayers = ps; roomHost = m.host || null;
      document.body.classList.toggle('not-gm', !!you.id && !!roomHost && roomHost !== you.id);   // grise les réglages réservés au game master
      dailyOn = !!m.daily; renderDaily();
      const me = ps.find(p => p.id === you.id);
      const human = ps.filter(p => p.role !== 'spectator').length;
      const specs = ps.filter(p => p.role === 'spectator').length;
      const jeSuisGm = !!you.id && roomHost === you.id;
      setStatus(`${me && me.role === 'spectator' ? 'Spectateur · ' : ''}${human} connecté${human > 1 ? 's' : ''}${specs ? ' · 👁 ' + specs : ''}${jeSuisGm ? ' · 👑 game master' : ''}`, 'ok');
      renderReady();
    } else if (m.t === 'g') {
      const g = m.g || activeId;
      if (modReady && modId === g) { if (mod.onMessage) mod.onMessage(m.m); } else pfor(g).msgs.push(m.m);
    } else if (m.t === 'lb') {
      boards[m.g] = m.board || [];                  // mémorise pour le classement global cross-jeux
      if (modReady && modId === m.g) { if (mod.onLb) mod.onLb({ board: m.board || [], history: m.history || [] }); } else pfor(m.g).lb = { board: m.board || [], history: m.history || [] };
    } else if (m.t === 'emote') {
      showEmote(m.name, m.e);
    } else if (m.t === 'png') {
      const rtt = Math.max(0, Math.round(performance.now() - m.ts)); if (pingTxt) pingTxt.textContent = ' · ⚡ ' + rtt + ' ms';
      window.__rtt = rtt;                             // lu par la prédiction locale de Pong (délai avant recalage)
    } else if (m.t === 'tour') {
      if (m.done) { tourState = null; renderTour(); showPodium(m.scores); }
      else if (m.on) { const was = tourState && tourState.on; tourState = m; renderTour(); if (!was) note('🏆 Tournoi lancé — que le meilleur gagne !'); }
      else { if (tourState) note('🏆 Tournoi annulé'); tourState = null; renderTour(); }
    } else if (m.t === 'denied') {
      if (!window.__lastDN || performance.now() - window.__lastDN > 1500) { window.__lastDN = performance.now(); note(m.why === 'spec' ? '👁 Réservé aux joueurs — tu es spectateur' : '👑 Réservé au game master'); }
    } else if (m.t === 'gm') {
      // Réponse du hub à la clé admin. Avant, un échec ne disait rien : on croyait à un bug du site.
      if (m.ok) note('👑 Game master activé');
      else if (m.why === 'nokey') note('👑 Clé refusée : ADMIN_KEY n\'est pas configurée sur le serveur');
      else note('👑 Clé admin invalide');
    } else if (m.t === 'note') {
      if (typeof m.m === 'string') note(m.m.slice(0, 160));          // message d'information émis par le hub
    } else if (m.t === 'daily') {
      dailyBoard = m.board || []; dailyDate = m.day || ''; renderDaily();
    } else if (m.t === 'chat') {
      pushChat(m);
    } else if (m.t === 'chatlog') {
      if (chatLogEl) chatLogEl.innerHTML = '';                       // (re)connexion : on repart de l'historique du hub, sans doublon
      (m.log || []).forEach(r => pushChat(r, true));
    } else if (m.t === 'av') {
      if (m.name) {
        if (m.a) avatars[m.name] = m.a; else delete avatars[m.name];
        renderReady();
        if (globalPanel && !globalPanel.classList.contains('hidden')) renderGlobal();
      }
    } else if (m.t === 'notready') {
      if (!window.__lastNR || performance.now() - window.__lastNR > 1500) { window.__lastNR = performance.now(); note('⏳ En attente que tous les joueurs soient prêts'); } // anti-spam (Espace en auto-répétition)
    } else if (m.t === 'state') {
      // Le hub omet les clés inchangées depuis la diffusion précédente : on les reprend de l'état
      // précédent de CE jeu. Nouvel objet à chaque fois — les instantanés déjà empilés dans le
      // tampon d'interpolation des jeux ne doivent jamais être modifiés après coup.
      const g = m.g; const part = { ...m }; delete part.t; delete part.g;
      const prevS = stateCache[g];
      const s = prevS ? Object.assign({}, prevS, part) : part;
      // `pd` = delta par joueur : [index, {champs modifiés}]. On reconstruit un tableau players COMPLET,
      // en créant de NOUVEAUX objets pour les joueurs modifiés — les instantanés déjà empilés dans les
      // tampons d'interpolation des jeux gardent ainsi leurs valeurs d'origine.
      if (part.pd && prevS && Array.isArray(prevS.players)) {
        const arr = prevS.players.slice();
        for (const d of part.pd) { const i = d[0]; if (i >= 0 && i < arr.length) arr[i] = Object.assign({}, arr[i], d[1]); }
        s.players = arr;
      }
      delete s.pd;                                            // les modules de jeu ne voient jamais le delta
      stateCache[g] = s;
      const prevGs = lastGs[g];
      if (s.gs === 'over' && typeof s.winner === 'number' && s.winner >= 0 && lastGs[g] !== 'over') fireConfetti(g);  // 🎉 victoire (pas une égalité), célébration à l'identité du jeu
      lastGs[g] = s.gs;
      if (g === activeId && prevGs !== s.gs) {
        renderReady();                                       // gs du jeu actif changé : montre/cache la barre « Prêt »
        if (s.gs === 'countdown') themedSweep(GAME_TITLE[g] || '');   // nouvelle manche : balayage aux couleurs du jeu
      }
      if (modId !== g) loadModule(g);
      if (modReady && modId === g) { if (mod.onState) mod.onState(s); } else pfor(g).state = s;
      majHorsJeu();                                           // après onState : le jeu vient de mettre ses cartes à jour
    }
  };
  ws.onclose = () => { setStatus('Déconnecté — reconnexion…', 'off'); setTimeout(connect, 1000); };
}

applyA11y();
renderAvatarUI();
renderDaily();
connect();
