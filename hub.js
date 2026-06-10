// Hub multijeux : registre des jeux, identité/pseudo/token, UNE salle active, lobby, routage, boucle de tick.
// Une seule partie active à la fois (les joueurs choisissent le jeu dans le lobby quand la salle est libre).
import { attachWebSocket } from './ws.js';
import { lbMsg, dirtyGames, anyDirty, clearDirty, reset } from './leaderboard.js';
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
let loop = null, curHz = 0, idleTick = 0, wasIdle = true;
const RECONNECT_GRACE = 12000;                 // délai pour reprendre son siège après une coupure (F5) en pleine partie
const pendingLeaves = new Map();               // token -> { member, timer } : joueurs déconnectés dont le siège est gardé
const newToken = () => Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);

const room = {
  get members() { return members; },
  memberById: id => members.find(m => m.id === id),
  broadcast(obj) { const s = JSON.stringify(obj); for (const m of members) if (m.conn.readyState === 1) m.conn.send(s); },
  send(m, obj) { if (m && m.conn.readyState === 1) m.conn.send(JSON.stringify(obj)); },
};

function ensureGame() { if (!game) game = GAMES[activeId].create(room); }
function roomMsg() { return { t: 'room', active: activeId, host: hostId(), players: members.map(m => ({ id: m.id, name: m.name, role: m.role, ready: !!m.ready })) }; }
function hostId() { const p = members.find(m => m.role === 'player'); return (p || members[0] || {}).id || null; }   // hôte = 1er joueur connecté
function allReady() { const ps = members.filter(m => m.role === 'player'); return ps.length <= 1 || ps.every(m => m.ready); } // solo : pas de gate ; bots = non-membres → exclus → jamais bloquants
function broadcastRoom() { room.broadcast(roomMsg()); }
function setLoop() { const hz = GAMES[activeId].meta.tickHz || 60; if (hz === curHz && loop) return; if (loop) clearInterval(loop); curHz = hz; loop = setInterval(step, 1000 / hz); }

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
  setLoop(); broadcastRoom();
}

function step() {
  if (members.length === 0) return;                 // personne connecté : rien à simuler/diffuser
  ensureGame();
  const snap = game.tick();
  const idleNow = game.isIdle();
  if (wasIdle && !idleNow) { let ch = false; for (const m of members) if (m.ready) { m.ready = false; ch = true; } if (ch) broadcastRoom(); } // manche lancée : on réarme les « Prêt »
  wasIdle = idleNow;
  if (snap) {
    // plein régime en jeu ; en lobby/pause/fin on diffuse ~4×/s (économie CPU/réseau)
    const live = snap.gs === 'play' || snap.gs === 'countdown';
    const stride = Math.max(1, Math.round(curHz / 4));
    if (live || (idleTick++ % stride === 0)) {
      const s = JSON.stringify({ t: 'state', g: activeId, ...snap });
      for (const m of members) if (m.conn.readyState === 1) m.conn.send(s);
    }
  }
  if (anyDirty()) { for (const gid of dirtyGames()) { const s = lbMsg(gid); for (const m of members) if (m.conn.readyState === 1) m.conn.send(s); } clearDirty(); }
}

function wire(member) {                          // (re)branche les handlers d'une socket sur un membre donné
  member.conn.onMessage(raw => {
    let m; try { m = JSON.parse(raw); } catch { return; }
    if (m.t === 'name') {
      const nm = ('' + (m.name || '')).replace(/[<>&"']/g, '').trim().slice(0, 12);   // assaini à la source : les clients l'injectent en innerHTML
      member.ident.name = nm; member.name = nm;
      if (game && game.onRename) game.onRename(member);
      broadcastRoom();
    } else if (m.t === 'pick') {
      pick(m.id);
    } else if (m.t === 'g') {
      ensureGame();
      if (m.m && m.m.t === 'start' && game.isIdle() && !allReady()) { room.send(member, { t: 'notready' }); return; } // gate « Prêt » : démarrage seulement si tous les joueurs sont prêts
      game.onMessage(member, m.m);
    } else if (m.t === 'ready') {
      member.ready = !!m.v; broadcastRoom();
    } else if (m.t === 'reseat') {
      if (member.role === 'spectator') { ensureGame(); if (game.isIdle()) { joinGame(member); broadcastRoom(); } } // spectateur : tente de prendre un siège libéré (hors partie ; onJoin re-vérifie)
    } else if (m.t === 'forcestart') {
      if (member.id === hostId()) { ensureGame(); if (game.isIdle()) game.onMessage(member, { t: 'start' }); } // l'hôte force le départ malgré des joueurs pas prêts
    } else if (m.t === 'adminreset') {
      const KEY = process.env.ADMIN_KEY;            // réinitialisation de TOUS les classements (réservée au détenteur de la clé admin)
      if (KEY && typeof m.key === 'string' && m.key === KEY) { for (const meta of META) reset(meta.id); }  // reset marque dirty → step() rediffuse les classements vides à tous (le global se recalcule)
    } else if (m.t === 'emote') {
      if (typeof m.e === 'string' && Date.now() - (member.lastEmote || 0) > 700) { member.lastEmote = Date.now(); room.broadcast({ t: 'emote', id: member.id, name: member.name, e: m.e.slice(0, 8) }); } // émote diffusée à tous (anti-spam 700 ms)
    } else if (m.t === 'png') {
      if (member.conn.readyState === 1) member.conn.send(JSON.stringify({ t: 'png', ts: m.ts })); // echo pour mesurer le ping
    }
  });
  member.conn.onClose(() => {
    members = members.filter(x => x !== member);
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
    for (const meta of META) conn.send(lbMsg(meta.id)); // tous les classements (sinon vides au changement de jeu sans recharger)
    broadcastRoom();
    wire(member);
    return;
  }
  let ident = token && identities.get(token);
  let tok = token;
  if (!ident) { tok = newToken(); ident = { id: 'm' + (idSeq++), name: '' }; identities.set(tok, ident); }
  const member = { id: ident.id, name: ident.name, conn, token: tok, role: null, ident, ready: false };
  members.push(member);
  ensureGame();
  conn.send(JSON.stringify({ t: 'hello', you: { id: member.id, name: member.name, token: tok }, games: META, active: activeId }));
  joinGame(member);
  for (const meta of META) conn.send(lbMsg(meta.id)); // tous les classements (sinon vides au changement de jeu sans recharger)
  broadcastRoom();
  wire(member);
}

export function attach(server) { attachWebSocket(server, onConnection); setLoop(); }
export { META as GAME_META };
