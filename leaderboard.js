// Persistance générique par JEU : { gameId: { board:{name:entry}, history:[] } } — zéro dépendance.
// Chaque jeu définit lui-même le SCHÉMA de ses entrées ; ce module ne fait que stocker/diffuser.
//
// Deux modes de stockage, choisis automatiquement au démarrage :
//   • Upstash Redis (en ligne)  : si UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN sont définis.
//                                 Utilise l'API REST via le `fetch` natif → toujours ZÉRO dépendance.
//   • Fichier local (LAN/dev)   : sinon, lit/écrit leaderboard.json comme avant.
import { readFile, writeFile } from 'fs/promises';

let store = {};                 // gameId -> { board:{}, history:[] }
const dirty = new Set();        // jeux dont le classement a changé (à rediffuser)
let PATH = null;
const HISTORY_MAX = 20;

// --- Config Upstash (via variables d'environnement, jamais en dur) ---
const REST_URL = process.env.UPSTASH_REDIS_REST_URL;
const REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const REDIS_KEY = process.env.LEADERBOARD_KEY || 'pong-line:store';
const useRedis = !!(REST_URL && REST_TOKEN);

// --- Avatars (profils) : clé SÉPARÉE du classement ---
// Pourquoi séparée : le classement est sauvegardé à chaque fin de manche ; on ne veut pas
// ré-uploader toutes les images à ce rythme. Ici on n'écrit que lors d'un changement d'avatar.
const AV_KEY = process.env.AVATAR_KEY || 'pong-line:avatars';
const AV_MAX = 60;                 // nb max d'avatars conservés (purge du plus ancien au-delà)
let avatars = {};                  // pseudo -> emoji | data URL (image réduite 64×64)
let AV_PATH = null;

// Envoie une commande Redis via l'API REST Upstash. cmd = ['SET', key, value] / ['GET', key] ...
async function redisCmd(cmd) {
  const res = await fetch(REST_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${REST_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd),
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();   // { result: ... }
}

// Reconstruit `store` à partir d'un objet déjà parsé (gère l'ancien format mono-jeu).
function hydrate(d) {
  if (!d || typeof d !== 'object') return;
  if (d.board || d.history) store = { pong: { board: d.board || {}, history: d.history || [] } }; // ancien format
  else store = d;                                                                                  // déjà namespacé
}

function loadAvatars() {
  if (useRedis) {
    redisCmd(['GET', AV_KEY])
      .then(r => { if (r && typeof r.result === 'string') avatars = JSON.parse(r.result) || {}; })
      .catch(e => console.error('[avatars] Chargement Upstash échoué :', e.message));
    return;
  }
  if (AV_PATH) readFile(AV_PATH, 'utf8').then(s => { avatars = JSON.parse(s) || {}; }).catch(() => {});
}
function saveAvatars() {
  const d = JSON.stringify(avatars);
  if (useRedis) { redisCmd(['SET', AV_KEY, d]).catch(e => console.error('[avatars] Sauvegarde Upstash échouée :', e.message)); return; }
  if (AV_PATH) writeFile(AV_PATH, d).catch(() => {});
}
export function getAvatar(name) { return (name && avatars[name]) || null; }
export function setAvatar(name, data) {          // data falsy => retrait de l'avatar
  if (!name) return;
  if (data) avatars[name] = data; else delete avatars[name];
  const keys = Object.keys(avatars);
  if (keys.length > AV_MAX) delete avatars[keys[0]];   // ordre d'insertion => le plus ancien saute
  saveAvatars();
}

export function initLeaderboard(path) {
  PATH = path;
  AV_PATH = path.replace(/leaderboard\.json$/, 'avatars.json');
  loadAvatars();
  if (useRedis) {
    console.log('[leaderboard] Stockage : Upstash Redis (en ligne).');
    redisCmd(['GET', REDIS_KEY])
      .then(r => { if (r && typeof r.result === 'string') hydrate(JSON.parse(r.result)); })
      .catch(e => console.error('[leaderboard] Chargement Upstash échoué, démarrage à vide :', e.message));
    return;
  }
  console.log('[leaderboard] Stockage : fichier local (' + path + ').');
  readFile(path, 'utf8')
    .then(s => hydrate(JSON.parse(s)))
    .catch(() => {});
}

function node(gameId) {
  const g = store[gameId] || (store[gameId] = { board: {}, history: [] });
  if (!g.board) g.board = {};
  if (!g.history) g.history = [];
  return g;
}

export function board(gameId) { return node(gameId).board; }       // objet mutable { name: entry }
export function history(gameId) { return node(gameId).history; }   // tableau

export function pushHistory(gameId, rec) {
  const h = node(gameId).history;
  h.unshift(rec);
  if (h.length > HISTORY_MAX) h.length = HISTORY_MAX;
}

export function save() {
  const data = JSON.stringify(store);
  if (useRedis) {
    redisCmd(['SET', REDIS_KEY, data]).catch(e => console.error('[leaderboard] Sauvegarde Upstash échouée :', e.message));
    return;
  }
  if (PATH) writeFile(PATH, data).catch(() => {});
}

export function reset(gameId) { store[gameId] = { board: {}, history: [] }; markDirty(gameId); save(); }

export function lbMsg(gameId) { const g = node(gameId); return JSON.stringify({ t: 'lb', g: gameId, board: Object.values(g.board), history: g.history }); }

export function markDirty(gameId) { dirty.add(gameId); }
export function dirtyGames() { return [...dirty]; }
export function anyDirty() { return dirty.size > 0; }
export function clearDirty() { dirty.clear(); }
