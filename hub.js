// Hub multijeux : registre des jeux, identité/pseudo/token, UNE salle active, lobby, routage, boucle de tick.
// Une seule partie active à la fois (les joueurs choisissent le jeu dans le lobby quand la salle est libre).
import crypto from 'crypto';
import { attachWebSocket, wsFrame } from './ws.js';
import { lbMsg, dirtyGames, anyDirty, clearDirty, reset, getAvatar, setAvatar, dailyMsg, dailyChanged, resetDaily } from './leaderboard.js';
import pong from './games/pong/server.js';
import tron from './games/tron/server.js';
import tank from './games/tank/server.js';
import bomb from './games/bomb/server.js';
import snake from './games/snake/server.js';
import sumo from './games/sumo/server.js';

const GAMES = { [pong.meta.id]: pong, [tron.meta.id]: tron, [tank.meta.id]: tank, [bomb.meta.id]: bomb, [snake.meta.id]: snake, [sumo.meta.id]: sumo };   // registre : ajouter un jeu = l'importer et l'ajouter ici
const META = Object.values(GAMES).map(g => g.meta);
const DEFAULT_ID = pong.meta.id;

let activeId = DEFAULT_ID;
let game = null;                              // instance du jeu actif
let members = [];                             // membres connectés { id, name, conn, token, role }
const identities = new Map();                 // token -> { id, name, rang }  (reprise après coupure ; rang = ordre d'arrivée)
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
let prevGsSent = null, gsFullT = 0;            // gs du dernier envoi : un changement de phase part en complet (au plus un toutes les 2 s)
// Jamais comparés à l'envoi précédent : `t` (routage) et `fx` (ponctuel : le fusionner le rejouerait en boucle).
// `fx` n'est plus envoyé VIDE (98 % des messages de Pong portaient « "fx":[] ») : le client remet fx = [] quand
// il est absent. `g` ne part que dans les instantanés COMPLETS (le client prend sinon le jeu actif, annoncé par
// le message `room` qui précède toujours le premier état d'un nouveau jeu).
const ALWAYS = new Set(['t', 'g', 'fx']);
const TRACE = !!process.env.HUB_TRACE;         // HUB_TRACE=1 : journalise chaque diffusion (complète ou delta) — mis en const, process.env est lent
const RECONNECT_GRACE = 12000;                 // délai pour reprendre son siège après une coupure (F5) en pleine partie
const pendingLeaves = new Map();               // token -> { member, timer } : joueurs déconnectés dont le siège est gardé
const newToken = () => crypto.randomBytes(16).toString('hex');
const MEMBRES_MAX = 60;                        // dernier rempart mémoire : au-delà, « salle pleine ». Pas plus bas : UN script qui ouvre N sockets muettes remplirait la salle et la fermerait à tous (revue du 24/09)
const PAR_ADRESSE = 16;                        // par provenance : une soirée sur un même Wi-Fi (10 sièges au plus + quelques spectateurs) passe largement
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
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
// Game master = détenteur de la clé ADMIN_KEY s'il est connecté, sinon le joueur ARRIVÉ LE PREMIER (repli).
// Rang d'arrivée porté par l'identité (le jeton), pas par la position dans `members` : une reprise après F5
// remettait le membre en fin de liste, et l'hôte de repli perdait son rôle au profit du suivant.
const rangDe = m => (m.ident && m.ident.rang) || 0;
const parRang = () => members.slice().sort((a, b) => rangDe(a) - rangDe(b));   // ordre d'arrivée : sert aussi à l'ordre d'assise
function plusAncien(liste) { let b = null; for (const m of liste) if (!b || rangDe(m) < rangDe(b)) b = m; return b; }
function hostId() {
  const gm = members.find(m => m.gm);
  if (gm) return gm.id;
  const p = plusAncien(members.filter(m => m.role === 'player'));
  return (p || plusAncien(members) || {}).id || null;
}
// Réglages de partie réservés au game master (messages routés vers les jeux via {t:'g',m}).
const GM_ONLY = new Set(['mode', 'preset', 'opt', 'bots', 'botdiff', 'arena', 'wintarget', 'ff', 'gen', 'variant', 'rush', 'revenge', 'fade', 'lbreset']);
// …et parmi eux, ceux qui touchent à la mémoire DURABLE du site : réservés au détenteur de la clé admin, jamais à
// l'hôte de repli (le premier arrivant, quand l'admin est absent, pouvait effacer le classement de Pong).
const ADMIN_ONLY = new Set(['lbreset']);
// Messages que seul le hub pousse aux jeux (pseudo-membre SYS) : refusés s'ils viennent d'un client
// (un spectateur pouvait activer en douce le défi du jour de Tanks/Bomberman).
const SYS_ONLY = new Set(['daily']);
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
const pasPrets = () => members.filter(m => m.role === 'player' && !m.ready).map(m => m.name || 'Joueur');
// « Rejouer » vaut « Prêt » : garde de 2 s après la fin de manche, pour qu'un Espace encore tenu (tir de Tanks,
// bombe de Bomberman) ne marque personne prêt — ni ne relance la manche — avant qu'on ait vu l'écran de fin.
const GARDE_FIN = 2000;
let finT = 0;
// Départ automatique : le DERNIER joueur qui devient prêt (bouton ou Rejouer) lance la manche, à 2 joueurs au moins.
function departAuto(member) {
  if (!game || !game.isIdle() || (tour && tour.wait > 0)) return false;
  if (members.filter(m => m.role === 'player').length < 2 || !allReady()) return false;
  asseoirSpectateurs();
  garde('départ automatique', () => game.onMessage(member, { t: 'start' }));
  return true;
}
// Juste avant chaque départ (et après un changement de bots) : les spectateurs prennent les sièges libres, dans
// l'ordre d'arrivée (avant, il fallait trouver le bouton 🪑). Pas en fin de manche : le spectateur aurait repris,
// sur l'écran de fin, la ligne d'un joueur parti. onJoin revérifie les places et protège les sièges des bots.
function asseoirSpectateurs() {
  if (!game || !game.isIdle()) return;
  const specs = members.filter(m => m.role === 'spectator').sort((a, b) => rangDe(a) - rangDe(b));
  let ch = false;
  for (const m of specs) {
    // onJoin direct (pas joinGame) : un spectateur qui reste spectateur ne reçoit pas un « welcome » à chaque manche
    const r = garde('arrivée', () => game.onJoin(m));
    if (!game || !r || r.role === 'spectator') break;          // plus de siège libre : inutile d'essayer les suivants
    m.role = r.role; ch = true;
    if (r.hello) room.send(m, { t: 'g', g: activeId, m: r.hello });
  }
  if (ch) broadcastRoom();
}
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
  // own() : GAMES['constructor'] renvoyait la fonction Object (clé héritée) → TypeError hors filet → processus mort
  if (typeof id !== 'string' || !own(GAMES, id) || id === activeId) return;
  if (game && !game.isIdle()) return;          // changement de jeu autorisé seulement hors partie
  if (game && game.dispose) garde('fermeture du jeu', () => game.dispose());
  activeId = id; game = null;
  garde('changement de jeu', () => { ensureGame(); for (const m of parRang()) joinGame(m); });   // tout le monde rejoint le nouveau jeu, par ordre d'arrivée
  // Les « Prêt » valaient pour l'ANCIEN jeu : avec le départ automatique, le nouveau serait parti avant d'être réglé.
  for (const m of members) m.ready = false;
  fullNext = true; pendingFx = []; prevPlayers = null;   // autre jeu = autres clés et autres sièges : on repart d'un instantané complet
  setLoop(); broadcastRoom();
}

// FILET DE SÉCURITÉ. Une exception dans le code d'un jeu (tick ou message) remontait jusqu'à la boucle
// et tuait le processus Node — donc le site entier, pour tout le monde. C'est la panne du 21/09
// (`CELL is not defined` dans Bomberman). On la journalise et on repart d'une partie NEUVE du même
// jeu : la manche en cours est perdue, pas le site. Journal et note limités à une fois par 5 s, au cas
// où un jeu planterait à chaque tick (il ne ferait alors que se relancer en boucle, sans tomber).
let incidentT = 0;
function incident(ou, e) {
  const now = Date.now();
  if (now - incidentT > 5000) {
    console.error('[hub] ' + activeId + ' · ' + ou + ' a levé une exception : partie relancée\n' + ((e && e.stack) || e));
    for (const m of members) room.send(m, { t: 'note', m: '⚠ Incident de jeu : la manche a été relancée' });
  }
  incidentT = now;
  try { if (game && game.dispose) game.dispose(); } catch (e2) {}
  game = null;
  try { ensureGame(); for (const m of parRang()) joinGame(m); }
  catch (e3) { console.error('[hub] relance impossible : ' + ((e3 && e3.stack) || e3)); game = null; }
  fullNext = true; pendingFx = []; prevPlayers = null;
  broadcastRoom();
}
// Tout appel au code d'un jeu HORS de tick/onMessage (arrivée, départ — y compris dans le minuteur de grâce —,
// renommage, départ forcé, défi du jour…) passe par ce filet : une exception relance la partie au lieu de tuer
// le processus. (Un joueur « constructor » qui quittait en pleine manche tuait le serveur 12 s plus tard.)
function garde(ou, fn) { try { return fn(); } catch (e) { incident(ou, e); return undefined; } }

function step() {
  if (members.length === 0) return;                 // personne connecté : rien à simuler/diffuser
  const gid0 = activeId;
  let snap;
  try { ensureGame(); snap = game.tick(); } catch (e) { incident('tick', e); return; }   // création comprise
  const idleNow = game.isIdle();
  if (wasIdle && !idleNow) { let ch = false; for (const m of members) if (m.ready) { m.ready = false; ch = true; } if (ch) broadcastRoom(); } // manche lancée : on réarme les « Prêt »
  const finDeManche = !wasIdle && idleNow;
  if (finDeManche && snap && snap.gs === 'over') finT = Date.now();   // garde de 2 s : vraie fin de manche seulement (pas un abandon)
  if (tour && finDeManche && snap && snap.gs === 'over') {                         // manche de tournoi terminée : points selon le classement (bots exclus)
    const ps = (snap.players || []).filter(p => p.place > 0 && !p.bot && p.name);
    const n = ps.length;
    for (const p of ps) tour.scores[p.name] = ((own(tour.scores, p.name) && tour.scores[p.name]) || 0) + Math.max(1, n - p.place + 1);
    tour.idx++;
    if (tour.idx >= tour.order.length) {                                           // tournoi fini : podium chez tous, puis on libère
      const scores = Object.entries(tour.scores).map(([name, pts]) => ({ name, pts })).sort((a, b) => b.pts - a.pts);
      room.broadcast({ t: 'tour', on: false, done: true, scores });
      tour = null;
    } else { tour.wait = Math.max(30, Math.round(curHz * 6)); room.broadcast(tourMsg()); }   // ~6 s pour savourer l'écran de fin
  }
  wasIdle = idleNow;
  if (tour && tour.wait > 0 && --tour.wait <= 0) { tour.wait = 0; pick(tour.order[tour.idx]); room.broadcast(tourMsg()); }   // au jeu suivant !
  // Jeu changé PENDANT ce pas (transition de tournoi) : `snap` appartient à l'ANCIEN jeu. Il partait étiqueté
  // du nouveau (g = activeId) ; on le jette, le pas suivant envoie l'instantané complet du nouveau jeu.
  if (snap && activeId === gid0) {
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
      // Filet d'instantané complet : ~10 s en jeu, 30 s hors jeu, et à chaque changement de phase (gs). Hors jeu
      // presque rien ne bouge : un onglet oublié dans le lobby recevait un état complet toutes les 2 s, 7,8 Mo/h
      // pour RIEN (mesuré le 23/09), sur un plan Render limité à 5 Go/mois. En jeu, le complet des 2 s pesait
      // 13 à 30 % du débit selon le jeu (mesuré le 24/09) alors que le protocole est ordonné et fiable : le filet
      // ne sert qu'en cas de défaut de reconstitution. Un arrivant reçoit toujours un complet immédiat (fullNext).
      const gsCh = snap.gs !== prevGsSent && Date.now() - gsFullT >= 2000;   // borné : pause/reprise ×20/s multipliait le débit par 5
      const wasFull = fullNext || gsCh || frameNo % (curHz * (live ? 10 : 30)) < stride;
      prevGsSent = snap.gs;
      if (wasFull) gsFullT = Date.now();
      if (wasFull) { prevSent = {}; fullNext = false; }
      if (TRACE) console.log('[trace] f=' + frameNo + ' stride=' + stride + ' full=' + wasFull + ' membres=' + members.length);
      const out = {};
      for (const k in full) {
        const v = full[k];
        if (v === undefined || k === 'players') continue;   // undefined : le jeu l'omet déjà (delta grid/geo) ; players : delta dédié ci-dessous
        if (k === 'fx') { if (v.length) out.fx = v; continue; }   // absent = aucun effet (le client remet fx = [])
        if (k === 'g') { if (wasFull) out.g = v; continue; }     // dans les complets seulement (cf. ALWAYS)
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
      // Hors jeu, un message qui n'apporte RIEN (ni clé changée, ni joueur modifié, ni effet) n'est pas envoyé.
      // (Pas de `return` : les classements et le défi du jour, diffusés juste après, doivent toujours partir.)
      const vide = !live && !wasFull && !out.pd && !(out.fx && out.fx.length) && Object.keys(out).every(k => ALWAYS.has(k));
      if (!vide) {
        const buf = wsFrame(JSON.stringify(out));          // encodée une seule fois pour tous les clients
        for (const m of members) if (m.conn.readyState === 1) m.conn.sendRaw(buf);
      }
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
// Le seau borne le NOMBRE de messages, pas ce qu'ils déclenchent en sortie : un avatar (20 Ko) renvoyé en boucle
// était rediffusé à chaque membre (1,1 Mo/s par témoin, mesuré le 24/09 — le quota du mois en quelques minutes).
// Les messages qui déclenchent une diffusion sont donc DIFFÉRÉS : appliqués tout de suite si le précédent date de
// plus de `ms`, sinon une seule fois à l'échéance, avec la DERNIÈRE valeur reçue (rien n'est perdu, rien ne s'accumule).
function differer(member, cle, ms, fn) {
  const L = member.lim || (member.lim = {});
  const e = L[cle] || (L[cle] = { last: 0, timer: null, fn: null });
  e.fn = fn;
  if (e.timer) return;
  const go = () => { e.timer = null; e.last = Date.now(); const f = e.fn; e.fn = null; if (f && members.includes(member)) f(); };
  const reste = e.last + ms - Date.now();
  if (reste <= 0) go(); else e.timer = setTimeout(go, reste);
}
const EMOTES = new Set(['👍', '😂', '😮', '😡', '🎉', '🔥', '😎', '🤝', '💀', '🫡']);   // = EMOTES de public/app.js
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
    if (!m || typeof m !== 'object') return;
    if (m.t === 'name') {
      let nm = (typeof m.name === 'string' ? m.name : '').replace(/[<>&"']/g, '').trim().slice(0, 12);   // assaini à la source : les clients l'injectent en innerHTML
      // Jamais une clé héritée d'Object (« constructor », « __proto__ », « toString »…) : les pseudos servent de clés
      // aux classements, au défi du jour et au tournoi. « __proto__ » y écrivait dans Object.prototype (pollution
      // qui survivait à toute relance), « constructor » faisait lever chaque fin de manche.
      while (nm && nm in Object.prototype) nm = nm.slice(0, 11) + '_';
      differer(member, 'name', 1000, () => {       // au plus un renommage par seconde ; identique = rien
        if (nm === member.name) return;
        member.ident.name = nm; member.name = nm;
        if (nm) {                                  // l'avatar suit le pseudo (= le profil)
          if (member.avatar) setAvatar(nm, member.avatar);
          else { const st = getAvatar(nm); if (st) member.avatar = st; }
          if (member.avatar) room.broadcast({ t: 'av', name: nm, a: member.avatar });
        }
        if (game && game.onRename) garde('renommage', () => game.onRename(member));
        broadcastRoom();
      });
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
      garde('création du jeu', ensureGame); if (!game) return;
      if (tour) { tour = null; room.broadcast({ t: 'tour', on: false }); }                  // annulation
      else if (game.isIdle()) {
        const order = META.map(g => g.id);
        for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
        tour = { order, idx: 0, scores: {}, wait: 0 };
        pick(order[0]);                               // no-op si c'est déjà le jeu actif
        room.broadcast(tourMsg());
      }
    } else if (m.t === 'g') {
      if (!m.m || typeof m.m !== 'object') return;
      const t = m.m.t;
      garde('création du jeu', ensureGame); if (!game) return;
      if (SYS_ONLY.has(t)) return;                                                          // réservé au hub (pseudo-membre SYS)
      if (ADMIN_ONLY.has(t) && !member.gm) { room.send(member, { t: 'denied' }); return; } // mémoire durable : clé admin seulement
      if (GM_ONLY.has(t) && member.id !== hostId()) { room.send(member, { t: 'denied' }); return; } // réglages : game master seulement
      if (PLAYER_ONLY.has(t) && member.role === 'spectator') { room.send(member, { t: 'denied', why: 'spec' }); return; } // lancer/pause/abandon : joueurs seulement
      if (t === 'start' && tour && tour.wait > 0) return;                                  // transition de tournoi : pas de relance de l'ancien jeu
      if (t === 'start' && game.isIdle() && Date.now() - finT < GARDE_FIN) return;          // 2 s après une fin de manche : Espace encore tenu (tir, bombe), pas un « Rejouer »
      if (t === 'start' && game.isIdle() && !allReady()) {                                 // gate « Prêt » : démarrage seulement si tous les joueurs sont prêts
        // « Rejouer » (Espace / clic sur l'écran de fin) vaut « Prêt » : un geste au lieu de deux. Celui qui complète la salle lance la manche.
        if (member.role === 'player' && !member.ready) { member.ready = true; broadcastRoom(); }
        if (!allReady()) { room.send(member, { t: 'notready', wait: pasPrets() }); return; }
      }
      if (t === 'start' && game.isIdle()) asseoirSpectateurs();                            // sièges libres : pris juste avant le départ
      try {
        // Panne SIMULÉE, pour le test de fumée seulement (variable absente en production) : vérifie le filet.
        if (process.env.SMOKE_FAULT && t === '__panne') throw new Error('panne simulée (test de fumée)');
        game.onMessage(member, m.m);
      } catch (e) { incident('message « ' + t + ' »', e); }
      if (t === 'bots') asseoirSpectateurs();                                               // un bot retiré libère un siège
    } else if (m.t === 'avatar') {
      const a = (m.a === null || m.a === undefined || m.a === '') ? '' : m.a;
      if (a !== '' && !AV_OK(a)) return;            // format refusé : on ignore silencieusement
      differer(member, 'av', 5000, () => {          // au plus un changement toutes les 5 s ; identique = ni diffusion ni écriture
        if (a === member.avatar) return;
        member.avatar = a;
        if (member.name) { setAvatar(member.name, a || null); room.broadcast({ t: 'av', name: member.name, a }); }
      });
    } else if (m.t === 'ready') {
      const v = !!m.v;
      differer(member, 'ready', 250, () => {        // au plus 4 bascules par seconde, chacune rediffusant la salle
        if (v === !!member.ready) return;
        member.ready = v; broadcastRoom();
        if (v) departAuto(member);                   // le dernier « Prêt » lance la manche
      });
    } else if (m.t === 'reseat') {
      if (member.role === 'spectator') { garde('création du jeu', ensureGame); if (game && game.isIdle()) { garde('arrivée', () => joinGame(member)); broadcastRoom(); } } // spectateur : tente de prendre un siège libéré (hors partie ; onJoin re-vérifie)
    } else if (m.t === 'forcestart') {
      if (tour && tour.wait > 0) return;             // transition de tournoi : l'ancien jeu ne repart pas
      if (member.id === hostId()) { garde('création du jeu', ensureGame); if (game && game.isIdle()) { asseoirSpectateurs(); garde('départ forcé', () => game.onMessage(member, { t: 'start' })); } } // l'hôte force le départ malgré des joueurs pas prêts
    } else if (m.t === 'adminreset') {
      const KEY = process.env.ADMIN_KEY;            // réinitialisation de TOUS les classements (réservée au détenteur de la clé admin)
      if (KEY && typeof m.key === 'string' && m.key === KEY) { for (const meta of META) reset(meta.id); resetDaily(); }  // reset marque dirty → step() rediffuse les classements vides à tous (le global et le défi du jour se recalculent)
    } else if (m.t === 'emote') {
      if (typeof m.e === 'string' && EMOTES.has(m.e) && Date.now() - (member.lastEmote || 0) > 700) { member.lastEmote = Date.now(); room.broadcast({ t: 'emote', id: member.id, name: member.name, e: m.e }); } // émote de la liste, diffusée à tous (anti-spam 700 ms)
    } else if (m.t === 'daytoggle') {
      // (nom distinct de la diffusion serveur {t:'daily'} : jamais le même type dans les deux sens)
      if (member.id !== hostId()) { room.send(member, { t: 'denied' }); return; }   // réglage de plateforme : game master seulement
      dailyOn = !dailyOn; garde('défi du jour', () => { ensureGame(); applyDaily(); }); broadcastRoom();
      room.broadcast({ t: 'note', m: dailyOn ? '🎲 Défi du jour activé — même carte pour tout le monde aujourd\'hui' : '🎲 Défi du jour désactivé' });
    } else if (m.t === 'dayreq') {
      if (Date.now() - (member.dayreqT || 0) < 1000) return;                        // à l'ouverture du panneau : une fois par seconde suffit
      member.dayreqT = Date.now();
      if (member.conn.readyState === 1) member.conn.send(dailyMsg());               // rafraîchit le classement du jour
    } else if (m.t === 'chat') {
      // mini-chat de salon : assaini À LA SOURCE (les clients l'affichent en texte, mais on ne prend aucun risque)
      const txt = (typeof m.m === 'string' ? m.m : '').replace(/[<>&"'`\\]/g, '').replace(/\s+/g, ' ').trim().slice(0, 140);
      if (!txt || Date.now() - (member.lastChat || 0) < 900) return;                // anti-spam 900 ms
      member.lastChat = Date.now();
      const rec = { t: 'chat', id: member.id, name: member.name || 'Joueur', m: txt };
      chatLog.push(rec); if (chatLog.length > CHAT_MAX) chatLog.shift();
      room.broadcast(rec);
    } else if (m.t === 'png') {
      // ts NUMÉRIQUE seulement : une chaîne de 60 Ko était renvoyée telle quelle (2,4 Mo/s d'écho sans coupure)
      if (member.conn.readyState === 1) member.conn.send(JSON.stringify({ t: 'png', ts: typeof m.ts === 'number' && isFinite(m.ts) ? m.ts : 0 })); // écho pour mesurer le ping
    }
  });
  member.conn.onClose(() => {
    members = members.filter(x => x !== member);
    if (members.length === 0) tour = null;             // salle vide : le tournoi tombe
    if (game && member.role === 'player' && !game.isIdle()) {
      // partie en cours : on garde le siège quelques secondes pour une reprise (F5) au lieu d'éliminer tout de suite
      const tok = member.token;
      const avant = pendingLeaves.get(tok);
      if (avant) {                                     // déjà une grâce sur ce jeton : on la SOLDE (avant, écrasée → siège fantôme « connecté »)
        clearTimeout(avant.timer);
        if (avant.member !== member && game) garde('départ', () => game.onLeave(avant.member));
      }
      const timer = setTimeout(() => { pendingLeaves.delete(tok); if (game) garde('départ', () => game.onLeave(member)); broadcastRoom(); }, RECONNECT_GRACE);
      pendingLeaves.set(tok, { member, timer });
    } else if (game) {
      garde('départ', () => game.onLeave(member));
      const p = plusAncien(members.filter(x => x.role === 'player'));
      if (p && p.ready) departAuto(p);               // le partant était le seul pas prêt : on ne fait pas attendre les autres
    }
    broadcastRoom();
  });
}

// Accueil commun aux trois façons d'arriver (nouveau, reprise après coupure, reprise d'une socket fantôme).
function accueillir(member, conn) {
  garde('création du jeu', ensureGame);
  conn.send(JSON.stringify({ t: 'hello', you: { id: member.id, name: member.name, token: member.token }, games: META, active: activeId }));
  if (game) garde('arrivée', () => joinGame(member));  // onJoin idempotent : une reprise retrouve son siège (welcome)
  sendAvatars(conn);
  for (const meta of META) conn.send(lbMsg(meta.id)); // tous les classements (sinon vides au changement de jeu sans recharger)
  if (tour) conn.send(JSON.stringify(tourMsg()));     // tournoi en cours : resynchronise le bandeau
  conn.send(dailyMsg());                              // classement du jour
  if (chatLog.length) conn.send(JSON.stringify({ t: 'chatlog', log: chatLog }));   // contexte du mini-chat
  fullNext = true;                                    // l'arrivant n'a aucun état : prochain instantané COMPLET (sinon il reçoit un delta illisible)
  broadcastRoom();
  wire(member);
}

function onConnection(conn, token) {
  if (typeof token !== 'string' || !token || token.length > 64) token = null;
  // 1. Reprise dans le délai de grâce : on réutilise le membre existant (même siège, état du jeu conservé).
  const pend = token && pendingLeaves.get(token);
  if (pend) {
    clearTimeout(pend.timer); pendingLeaves.delete(token);
    const member = pend.member; member.conn = conn; member.ready = false; members.push(member);
    accueillir(member, conn);
    return;
  }
  // 2. Jeton porté par un membre ENCORE CONNECTÉ : le même onglet revient après une perte de réseau alors que sa
  //    socket fantôme n'est pas encore tombée, ou l'onglet a été dupliqué. La nouvelle connexion REPREND le membre
  //    (même id, même siège) au lieu d'en créer un second ; l'ancienne est prévenue (« remplacé », le client ne se
  //    reconnecte pas) puis fermée, SANS déclencher le départ du membre.
  const vivant = token && members.find(m => m.token === token);
  if (vivant) {
    const old = vivant.conn;
    old._close = null; old._msg = null;
    try { old.send(JSON.stringify({ t: 'remplace' })); old.socket.end(); } catch {}
    setTimeout(() => { try { old.socket.destroy(); } catch {} }, 1000).unref();
    vivant.conn = conn;
    accueillir(vivant, conn);
    return;
  }
  // 3. Salle pleine — au total, ou pour CETTE provenance (un script qui ouvre N sockets muettes ne ferme plus la salle
  //    aux autres) : le client est prévenu et ne réessaie que plus tard (pas de reconnexion en boucle).
  const memeAdresse = conn.adresse ? members.filter(m => m.conn.adresse === conn.adresse).length : 0;
  if (members.length >= MEMBRES_MAX || memeAdresse >= PAR_ADRESSE) {
    conn.send(JSON.stringify({ t: 'plein', max: MEMBRES_MAX }));
    setTimeout(() => { try { conn.socket.end(); } catch {} }, 200).unref();
    return;
  }
  let ident = token && identities.get(token);
  let tok = token;
  if (!ident) { tok = newToken(); ident = { id: 'm' + idSeq, name: '', rang: idSeq }; idSeq++; identities.set(tok, ident); purgeIdentities(); }
  const member = { id: ident.id, name: ident.name, conn, token: tok, role: null, ident, ready: false, gm: false, avatar: getAvatar(ident.name) || '' };
  members.push(member);
  accueillir(member, conn);
}

export function attach(server) { attachWebSocket(server, onConnection); setLoop(); }
export { META as GAME_META };
