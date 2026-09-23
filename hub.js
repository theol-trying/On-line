// Hub multijeux : registre des jeux, identité/pseudo/token, UNE salle active, lobby, routage, boucle de tick.
// Une seule partie active à la fois (les joueurs choisissent le jeu dans le lobby quand la salle est libre).
import { attachWebSocket, wsFrame } from './ws.js';
import { lbMsg, dirtyGames, anyDirty, clearDirty, reset, getAvatar, setAvatar, dailyMsg, dailyChanged, resetDaily } from './leaderboard.js';
import pong from './games/pong/server.js';
import tron from './games/tron/server.js';
import tank from './games/tank/server.js';
import bomb from './games/bomb/server.js';
import snake from './games/snake/server.js';

const GAMES = { [pong.meta.id]: pong, [tron.meta.id]: tron, [tank.meta.id]: tank, [bomb.meta.id]: bomb, [snake.meta.id]: snake };   // registre : ajouter un jeu = l'importer et l'ajouter ici
const META = Object.values(GAMES).map(g => g.meta);
const DEFAULT_ID = pong.meta.id;

let activeId = DEFAULT_ID;
let game = null;                              // instance du jeu actif
let members = [];                             // membres connectés { id, name, conn, token, role }
const identities = new Map();                 // token -> { id, name }  (reprise après coupure)
let idSeq = 1;
let loop = null, curHz = 0, wasIdle = true;
let tour = null;                               // tournoi : { order:[ids mélangés], idx, scores:{nom:pts}, wait (ticks avant le jeu suivant) }
let dailyOn = false;                           // « Défi du jour » : cartes déterministes (Tanks/Bomberman) — réglage de plateforme, game master only
const chatLog = [];                            // 20 derniers messages du mini-chat (contexte pour un arrivant)
const CHAT_MAX = 20;
/* ---------- diffusion des instantanés : allègements réseau (transparents pour les jeux) ----------
   1. Une trame WebSocket encodée UNE fois pour tout le monde (cf. wsFrame).
   2. Les clés de l'instantané qui n'ont pas changé depuis la diffusion précédente sont OMISES ;
      le client fusionne sur son état précédent (une clé absente = inchangée). Rafraîchissement
      complet périodique et à chaque arrivée/changement de jeu : un client ne peut pas se désynchroniser.
   3. Pong (60 Hz) passe à 30 Hz de diffusion à partir de 7 participants — là où le débit devient
      gênant. En dessous, rien ne change : aucune latence ajoutée pour une partie normale. */
let frameNo = 0;
let pendingFx = [];                            // fx des ticks non diffusés (sinon impacts/explosions perdus : les jeux vident fx à chaque tick)
let prevSent = {};                             // clé -> dernière valeur diffusée (sérialisée)
let prevPlayers = null;                        // dernier tableau `players` diffusé (base du delta par joueur)
let fullNext = true;                           // force un instantané complet au prochain envoi
const ALWAYS = new Set(['t', 'g', 'fx']);      // jamais omis : routage, et fx est ponctuel (le fusionner le rejouerait en boucle)
const TRACE = !!process.env.HUB_TRACE;         // HUB_TRACE=1 : journalise chaque diffusion (complète ou delta) — mis en const, process.env est lent
const RECONNECT_GRACE = 12000;                 // délai pour reprendre son siège après une coupure (F5) en pleine partie
const pendingLeaves = new Map();               // token -> { member, timer } : joueurs déconnectés dont le siège est gardé
const newToken = () => Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
// `identities` ne servait qu'à grossir : un jeton par visiteur, jamais relâché. Sur un serveur qui
// tourne des mois, c'est une fuite lente. On plafonne en supprimant les plus anciens (une Map itère
// dans l'ordre d'insertion), en épargnant les jetons encore utilisés ou en attente de reprise.
// Sans conséquence pour le joueur : le client renvoie son pseudo à chaque connexion.
const IDENT_MAX = 400;
function purgeIdentities() {
  if (identities.size <= IDENT_MAX) return;
  const vivants = new Set(members.map(m => m.token));
  for (const tok of identities.keys()) {
    if (identities.size <= IDENT_MAX) break;
    if (vivants.has(tok) || pendingLeaves.has(tok)) continue;
    identities.delete(tok);
  }
}

const room = {
  get members() { return members; },
  memberById: id => members.find(m => m.id === id),
  broadcast(obj) { const s = JSON.stringify(obj); for (const m of members) if (m.conn.readyState === 1) m.conn.send(s); },
  send(m, obj) { if (m && m.conn.readyState === 1) m.conn.send(JSON.stringify(obj)); },
};

const SYS = {};                                // pseudo-membre pour les messages SYSTÈME poussés aux jeux (jamais égal à un vrai membre -> seatOf renvoie -1)
function applyDaily() { if (game) game.onMessage(SYS, { t: 'daily', on: dailyOn }); }   // re-poussé à chaque création de jeu : le réglage survit aux changements de jeu
function ensureGame() { if (!game) { game = GAMES[activeId].create(room); applyDaily(); } }
function roomMsg() { return { t: 'room', active: activeId, host: hostId(), daily: dailyOn, players: members.map(m => ({ id: m.id, name: m.name, role: m.role, ready: !!m.ready })) }; }
// Game master = détenteur de la clé ADMIN_KEY s'il est connecté, sinon le 1er joueur connecté (repli).
function hostId() {
  const gm = members.find(m => m.gm);
  if (gm) return gm.id;
  const p = members.find(m => m.role === 'player');
  return (p || members[0] || {}).id || null;
}
// Réglages de partie réservés au game master (messages routés vers les jeux via {t:'g',m}).
const GM_ONLY = new Set(['mode', 'preset', 'opt', 'bots', 'botdiff', 'arena', 'wintarget', 'ff', 'gen', 'variant', 'rush', 'revenge', 'fade', 'lbreset']);
// Commandes de partie réservées à ceux qui JOUENT : un spectateur ne lance pas, ne met pas en pause et n'abandonne pas pour les autres.
const PLAYER_ONLY = new Set(['start', 'pause', 'abort']);
// Avatar valide = court emoji SANS caractère HTML, ou data URL image en base64 strict.
// Indispensable : les clients l'injectent en innerHTML dans les cartes HUD (sinon injection possible).
const AV_OK = a => typeof a === 'string' && (
  (a.length <= 24 && !/[<>&"'`\\]/.test(a)) ||
  (a.length <= 20000 && /^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$/.test(a))
);
function sendAvatars(conn) {                       // à la connexion : avatars des membres déjà présents
  const seen = new Set();
  for (const m of members) {
    if (!m.name || !m.avatar || seen.has(m.name)) continue;
    seen.add(m.name);
    if (conn.readyState === 1) conn.send(JSON.stringify({ t: 'av', name: m.name, a: m.avatar }));
  }
}
function allReady() { const ps = members.filter(m => m.role === 'player'); return ps.length <= 1 || ps.every(m => m.ready); } // solo : pas de gate ; bots = non-membres → exclus → jamais bloquants
function tourMsg() {
  if (!tour) return { t: 'tour', on: false };
  const scores = Object.entries(tour.scores).map(([name, pts]) => ({ name, pts })).sort((a, b) => b.pts - a.pts);
  return { t: 'tour', on: true, idx: tour.idx, total: tour.order.length, game: tour.order[Math.min(tour.idx, tour.order.length - 1)], scores };
}
function broadcastRoom() { room.broadcast(roomMsg()); }
// Pas de temps FIXE. `setInterval(step, 1000/hz)` réarme le timer APRÈS le callback : la cadence
// réelle vaut 1000/(période + durée du tick), donc elle CHUTE quand la charge monte — mesuré à
// 51 Hz au lieu de 60 sur Pong à 10 joueurs, 27 au lieu de 30 sur Tanks. Le jeu tournait au ralenti,
// et d'autant plus qu'il y avait de monde (balle plus lente, décompte et power-ups rallongés d'autant).
// Ici le timer bat deux fois plus vite que le pas et un accumulateur rattrape : la cadence moyenne
// ne dépend plus de la charge.
let acc = 0, lastT = 0;
function tickLoop() {
  const now = Date.now();
  let dt = now - lastT; lastT = now;
  if (dt > 250) dt = 250;                       // reprise après une pause longue : pas de rattrapage explosif
  acc += dt;
  const pas = 1000 / curHz, hz0 = curHz;
  let n = 0;
  while (acc >= pas && n < 4 && curHz === hz0) { acc -= pas; step(); n++; }   // hz0 : step() peut changer de jeu (donc de cadence)
  if (acc > pas * 4) acc = 0;                   // retard irrattrapable : on repart proprement
}
function setLoop() {
  const hz = GAMES[activeId].meta.tickHz || 60;
  if (hz === curHz && loop) return;
  if (loop) clearInterval(loop);
  curHz = hz; acc = 0; lastT = Date.now();
  loop = setInterval(tickLoop, Math.max(1, Math.floor(500 / hz)));
}

function joinGame(member) {
  const r = game.onJoin(member) || { role: 'spectator' };
  member.role = r.role;
  if (r.hello) room.send(member, { t: 'g', g: activeId, m: r.hello });
}

function pick(id) {
  if (!GAMES[id] || id === activeId) return;
  if (game && !game.isIdle()) return;          // changement de jeu autorisé seulement hors partie
  if (game && game.dispose) game.dispose();
  activeId = id; game = null; ensureGame();
  for (const m of members) joinGame(m);          // tout le monde rejoint le nouveau jeu
  fullNext = true; pendingFx = []; prevPlayers = null;   // autre jeu = autres clés et autres sièges : on repart d'un instantané complet
  setLoop(); broadcastRoom();
}

function step() {
  if (members.length === 0) return;                 // personne connecté : rien à simuler/diffuser
  ensureGame();
  const snap = game.tick();
  const idleNow = game.isIdle();
  if (wasIdle && !idleNow) { let ch = false; for (const m of members) if (m.ready) { m.ready = false; ch = true; } if (ch) broadcastRoom(); } // manche lancée : on réarme les « Prêt »
  if (tour && !wasIdle && idleNow && snap && snap.gs === 'over') {                 // manche de tournoi terminée : points selon le classement (bots exclus)
    const ps = (snap.players || []).filter(p => p.place > 0 && !p.bot && p.name);
    const n = ps.length;
    for (const p of ps) tour.scores[p.name] = (tour.scores[p.name] || 0) + Math.max(1, n - p.place + 1);
    tour.idx++;
    if (tour.idx >= tour.order.length) {                                           // tournoi fini : podium chez tous, puis on libère
      const scores = Object.entries(tour.scores).map(([name, pts]) => ({ name, pts })).sort((a, b) => b.pts - a.pts);
      room.broadcast({ t: 'tour', on: false, done: true, scores });
      tour = null;
    } else { tour.wait = Math.max(30, Math.round(curHz * 6)); room.broadcast(tourMsg()); }   // ~6 s pour savourer l'écran de fin
  }
  wasIdle = idleNow;
  if (tour && tour.wait > 0 && --tour.wait <= 0) { tour.wait = 0; pick(tour.order[tour.idx]); room.broadcast(tourMsg()); }   // au jeu suivant !
  if (snap) {
    frameNo++;
    if (snap.fx && snap.fx.length) pendingFx.push.apply(pendingFx, snap.fx);   // conservés même si ce tick n'est pas diffusé
    // plein régime en jeu ; en lobby/pause/fin on diffuse ~4×/s (économie CPU/réseau)
    const live = snap.gs === 'play' || snap.gs === 'countdown';
    const parts = (snap.connected || 0) + (snap.botCount || 0);
    const halve = live && curHz >= 60 && parts >= 7;      // Pong à 7 participants et + : 30 Hz (les clients interpolent)
    const stride = live ? (halve ? 2 : 1) : Math.max(1, Math.round(curHz / 4));
    if (frameNo % stride === 0) {
      const full = { t: 'state', g: activeId, ...snap, fx: pendingFx, shz: Math.round(curHz / stride) };
      pendingFx = [];
      const wasFull = fullNext || frameNo % (curHz * 2) < stride;
      if (wasFull) { prevSent = {}; fullNext = false; }   // filet : instantané complet toutes les ~2 s
      if (TRACE) console.log('[trace] f=' + frameNo + ' stride=' + stride + ' full=' + wasFull + ' membres=' + members.length);
      const out = {};
      for (const k in full) {
        const v = full[k];
        if (v === undefined || k === 'players') continue;   // undefined : le jeu l'omet déjà (delta grid/geo) ; players : delta dédié ci-dessous
        if (ALWAYS.has(k)) { out[k] = v; continue; }
        const sv = JSON.stringify(v);
        if (prevSent[k] !== sv) { out[k] = v; prevSent[k] = sv; }
      }
      // `players` pèse ~79 % du paquet alors que presque tout y est statique (pseudo, siège, équipe, bot…).
      // On n'envoie donc que les joueurs — et les champs — réellement modifiés, sous forme [index, {champs}].
      // Les instantanés COMPLETS (arrivée, changement de jeu, filet des 2 s) portent le tableau entier :
      // le client a donc toujours une base saine sur laquelle appliquer les deltas suivants.
      const ps = full.players;
      if (Array.isArray(ps)) {
        if (wasFull || !prevPlayers || prevPlayers.length !== ps.length) out.players = ps;
        else {
          const pd = [];
          for (let i = 0; i < ps.length; i++) {
            const p = ps[i], old = prevPlayers[i], d = {};
            let any = false;
            for (const f in p) {
              const a = p[f], b = old[f];
              if (a === b) continue;                                                                 // primitifs : comparaison directe
              if (a && typeof a === 'object' && JSON.stringify(a) === JSON.stringify(b)) continue;   // tableaux/objets (buffs…)
              d[f] = a; any = true;
            }
            if (any) pd.push([i, d]);
          }
          if (pd.length) out.pd = pd;
        }
        prevPlayers = ps;     // les jeux reconstruisent leurs objets joueur à chaque tick : garder la référence est sûr
      }
      const buf = wsFrame(JSON.stringify(out));            // encodée une seule fois pour tous les clients
      for (const m of members) if (m.conn.readyState === 1) m.conn.sendRaw(buf);
    }
  }
  if (anyDirty()) { for (const gid of dirtyGames()) { const s = lbMsg(gid); for (const m of members) if (m.conn.readyState === 1) m.conn.send(s); } clearDirty(); }
  if (dailyChanged()) { const s = dailyMsg(); for (const m of members) if (m.conn.readyState === 1) m.conn.send(s); }   // classement du jour (drapeau séparé : ne doit pas passer par lbMsg)
}

// Débit par connexion (seau à jetons) : DEBIT messages/s en régime, rafales de SEAU_MAX.
// Un humain plafonne vers 15-20 messages/s (les commandes ne partent qu'aux CHANGEMENTS de touche,
// la répétition automatique du clavier est ignorée par les 5 jeux) : 40/s laisse une marge large.
// Au-delà, les messages sont IGNORÉS ; une inondation soutenue (REJETS_MAX rejets dans la fenêtre)
// coupe la connexion. Le serveur est unique : un client détraqué ne doit pas l'accaparer.
const DEBIT = 40, SEAU_MAX = 80, REJETS_MAX = 500, REJETS_FENETRE = 5000;
function wire(member) {                          // (re)branche les handlers d'une socket sur un membre donné
  const conn = member.conn;
  let seau = SEAU_MAX, seauT = Date.now(), rejets = 0, rejetsT = seauT;
  conn.onMessage(raw => {
    const now = Date.now();
    // max(0, …) : si l'horloge système recule (resynchronisation), le seau ne doit pas plonger sous zéro
    // et bloquer plusieurs secondes les commandes d'un joueur honnête (relâchements compris).
    seau = Math.min(SEAU_MAX, seau + Math.max(0, now - seauT) * DEBIT / 1000); seauT = now;
    if (seau < 1) {
      if (now - rejetsT > REJETS_FENETRE) { rejets = 0; rejetsT = now; }
      if (++rejets > REJETS_MAX) { try { conn.socket.destroy(); } catch {} }
      return;
    }
    seau -= 1;
    let m; try { m = JSON.parse(raw); } catch { return; }
    if (m.t === 'name') {
      const nm = ('' + (m.name || '')).replace(/[<>&"']/g, '').trim().slice(0, 12);   // assaini à la source : les clients l'injectent en innerHTML
      member.ident.name = nm; member.name = nm;
      if (nm) {                                    // l'avatar suit le pseudo (= le profil)
        if (member.avatar) setAvatar(nm, member.avatar);
        else { const st = getAvatar(nm); if (st) member.avatar = st; }
        if (member.avatar) room.broadcast({ t: 'av', name: nm, a: member.avatar });
      }
      if (game && game.onRename) game.onRename(member);
      broadcastRoom();
    } else if (m.t === 'auth') {
      // Le client présente la clé admin : il devient game master (vérifié ici, donc non usurpable),
      // et hostId() le fait passer DEVANT le titulaire par défaut — il reprend la main en arrivant.
      // On répond toujours : l'échec était silencieux, donc indiscernable d'un bug (retour de test).
      const KEY = process.env.ADMIN_KEY;
      if (!KEY) { room.send(member, { t: 'gm', ok: false, why: 'nokey' }); return; }
      if (typeof m.key !== 'string' || m.key !== KEY) { room.send(member, { t: 'gm', ok: false, why: 'bad' }); return; }
      if (!member.gm) { member.gm = true; broadcastRoom(); }
      room.send(member, { t: 'gm', ok: true });
    } else if (m.t === 'pick') {
      if (tour) return;                              // pendant un tournoi, c'est lui qui choisit les jeux
      if (member.id !== hostId()) { room.send(member, { t: 'denied' }); return; }
      pick(m.id);
    } else if (m.t === 'tour') {
      if (member.id !== hostId()) return;            // réservé à l'hôte
      ensureGame();
      if (tour) { tour = null; room.broadcast({ t: 'tour', on: false }); }                  // annulation
      else if (game.isIdle()) {
        const order = META.map(g => g.id);
        for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
        tour = { order, idx: 0, scores: {}, wait: 0 };
        pick(order[0]);                               // no-op si c'est déjà le jeu actif
        room.broadcast(tourMsg());
      }
    } else if (m.t === 'g') {
      ensureGame();
      if (m.m && GM_ONLY.has(m.m.t) && member.id !== hostId()) { room.send(member, { t: 'denied' }); return; } // réglages : game master seulement
      if (m.m && PLAYER_ONLY.has(m.m.t) && member.role === 'spectator') { room.send(member, { t: 'denied', why: 'spec' }); return; } // lancer/pause/abandon : joueurs seulement
      if (m.m && m.m.t === 'start' && tour && tour.wait > 0) return;                        // transition de tournoi : pas de relance de l'ancien jeu
      if (m.m && m.m.t === 'start' && game.isIdle() && !allReady()) { room.send(member, { t: 'notready' }); return; } // gate « Prêt » : démarrage seulement si tous les joueurs sont prêts
      game.onMessage(member, m.m);
    } else if (m.t === 'avatar') {
      const a = (m.a === null || m.a === undefined || m.a === '') ? '' : m.a;
      if (a !== '' && !AV_OK(a)) return;            // format refusé : on ignore silencieusement
      member.avatar = a;
      if (member.name) { setAvatar(member.name, a || null); room.broadcast({ t: 'av', name: member.name, a }); }
    } else if (m.t === 'ready') {
      member.ready = !!m.v; broadcastRoom();
    } else if (m.t === 'reseat') {
      if (member.role === 'spectator') { ensureGame(); if (game.isIdle()) { joinGame(member); broadcastRoom(); } } // spectateur : tente de prendre un siège libéré (hors partie ; onJoin re-vérifie)
    } else if (m.t === 'forcestart') {
      if (member.id === hostId()) { ensureGame(); if (game.isIdle()) game.onMessage(member, { t: 'start' }); } // l'hôte force le départ malgré des joueurs pas prêts
    } else if (m.t === 'adminreset') {
      const KEY = process.env.ADMIN_KEY;            // réinitialisation de TOUS les classements (réservée au détenteur de la clé admin)
      if (KEY && typeof m.key === 'string' && m.key === KEY) { for (const meta of META) reset(meta.id); resetDaily(); }  // reset marque dirty → step() rediffuse les classements vides à tous (le global et le défi du jour se recalculent)
    } else if (m.t === 'emote') {
      if (typeof m.e === 'string' && Date.now() - (member.lastEmote || 0) > 700) { member.lastEmote = Date.now(); room.broadcast({ t: 'emote', id: member.id, name: member.name, e: m.e.slice(0, 8) }); } // émote diffusée à tous (anti-spam 700 ms)
    } else if (m.t === 'daytoggle') {
      // (nom distinct de la diffusion serveur {t:'daily'} : jamais le même type dans les deux sens)
      if (member.id !== hostId()) { room.send(member, { t: 'denied' }); return; }   // réglage de plateforme : game master seulement
      dailyOn = !dailyOn; ensureGame(); applyDaily(); broadcastRoom();
      room.broadcast({ t: 'note', m: dailyOn ? '🎲 Défi du jour activé — même carte pour tout le monde aujourd\'hui' : '🎲 Défi du jour désactivé' });
    } else if (m.t === 'dayreq') {
      if (member.conn.readyState === 1) member.conn.send(dailyMsg());               // rafraîchit le classement du jour à l'ouverture du panneau
    } else if (m.t === 'chat') {
      // mini-chat de salon : assaini À LA SOURCE (les clients l'affichent en texte, mais on ne prend aucun risque)
      const txt = ('' + (m.m || '')).replace(/[<>&"'`\\]/g, '').replace(/\s+/g, ' ').trim().slice(0, 140);
      if (!txt || Date.now() - (member.lastChat || 0) < 900) return;                // anti-spam 900 ms
      member.lastChat = Date.now();
      const rec = { t: 'chat', id: member.id, name: member.name || 'Joueur', m: txt };
      chatLog.push(rec); if (chatLog.length > CHAT_MAX) chatLog.shift();
      room.broadcast(rec);
    } else if (m.t === 'png') {
      if (member.conn.readyState === 1) member.conn.send(JSON.stringify({ t: 'png', ts: m.ts })); // echo pour mesurer le ping
    }
  });
  member.conn.onClose(() => {
    members = members.filter(x => x !== member);
    if (members.length === 0) tour = null;             // salle vide : le tournoi tombe
    if (game && member.role === 'player' && !game.isIdle()) {
      // partie en cours : on garde le siège quelques secondes pour une reprise (F5) au lieu d'éliminer tout de suite
      const tok = member.token;
      if (pendingLeaves.has(tok)) clearTimeout(pendingLeaves.get(tok).timer);
      const timer = setTimeout(() => { pendingLeaves.delete(tok); if (game) game.onLeave(member); broadcastRoom(); }, RECONNECT_GRACE);
      pendingLeaves.set(tok, { member, timer });
    } else if (game) game.onLeave(member);
    broadcastRoom();
  });
}

function onConnection(conn, token) {
  // reprise dans le délai de grâce : on réutilise le membre existant (même siège, état du jeu conservé)
  const pend = token && pendingLeaves.get(token);
  if (pend) {
    clearTimeout(pend.timer); pendingLeaves.delete(token);
    const member = pend.member; member.conn = conn; member.ready = false; members.push(member);
    ensureGame();
    conn.send(JSON.stringify({ t: 'hello', you: { id: member.id, name: member.name, token: member.token }, games: META, active: activeId }));
    joinGame(member);                           // onJoin idempotent -> renvoie le même siège (welcome)
    sendAvatars(conn);
    for (const meta of META) conn.send(lbMsg(meta.id)); // tous les classements (sinon vides au changement de jeu sans recharger)
    if (tour) conn.send(JSON.stringify(tourMsg()));     // tournoi en cours : resynchronise le bandeau
    conn.send(dailyMsg());                              // classement du jour
    if (chatLog.length) conn.send(JSON.stringify({ t: 'chatlog', log: chatLog }));   // contexte du mini-chat
    fullNext = true;                                    // l'arrivant n'a aucun état : prochain instantané complet
    broadcastRoom();
    wire(member);
    return;
  }
  let ident = token && identities.get(token);
  let tok = token;
  if (!ident) { tok = newToken(); ident = { id: 'm' + (idSeq++), name: '' }; identities.set(tok, ident); purgeIdentities(); }
  const member = { id: ident.id, name: ident.name, conn, token: tok, role: null, ident, ready: false, gm: false, avatar: getAvatar(ident.name) || '' };
  members.push(member);
  ensureGame();
  conn.send(JSON.stringify({ t: 'hello', you: { id: member.id, name: member.name, token: tok }, games: META, active: activeId }));
  joinGame(member);
  sendAvatars(conn);
  for (const meta of META) conn.send(lbMsg(meta.id)); // tous les classements (sinon vides au changement de jeu sans recharger)
  if (tour) conn.send(JSON.stringify(tourMsg()));     // tournoi en cours : resynchronise le bandeau
  conn.send(dailyMsg());                              // classement du jour
  if (chatLog.length) conn.send(JSON.stringify({ t: 'chatlog', log: chatLog }));   // contexte du mini-chat
  fullNext = true;                                    // l'arrivant n'a aucun état : prochain instantané COMPLET (sinon il reçoit un delta illisible)
  broadcastRoom();
  wire(member);
}

export function attach(server) { attachWebSocket(server, onConnection); setLoop(); }
export { META as GAME_META };
