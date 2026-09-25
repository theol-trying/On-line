// Persistance générique par JEU : { gameId: { board:{name:entry}, history:[] } } — zéro dépendance.
// Chaque jeu définit lui-même le SCHÉMA de ses entrées ; ce module ne fait que stocker/diffuser.
//
// Deux modes de stockage, choisis automatiquement au démarrage :
//   • Upstash Redis (en ligne)  : si UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN sont définis.
//                                 Utilise l'API REST via le `fetch` natif → toujours ZÉRO dépendance.
//   • Fichier local (LAN/dev)   : sinon, lit/écrit leaderboard.json comme avant.
//
// GARDE-FOU (24/09). Tant que la sauvegarde existante n'a pas été LUE avec succès, on n'écrit JAMAIS.
// Avant, un GET raté au réveil de Render (réseau, Upstash lent, JSON illisible) laissait le serveur
// « démarrer à vide », et la première fin de manche écrasait par un SET tout l'historique des 6 classements
// (idem pour les avatars). Les manches jouées en attendant restent en mémoire, affichées, et sont
// FUSIONNÉES à la lecture réussie. Les écritures sont regroupées (une seule en vol, la dernière gagne) ;
// en local elles passent par un fichier temporaire + rename, et un fichier illisible est mis de côté.
import { readFile, writeFile, rename } from 'fs/promises';
import { dirname, join } from 'path';

let store = {};                 // gameId -> { board:{}, history:[] }
const dirty = new Set();        // jeux dont le classement a changé (à rediffuser)
let PATH = null;
const HISTORY_MAX = 20;
let charge = false, avCharge = false;             // sauvegarde lue avec succès (ou inexistante) : écrire est sans danger
const RELANCES = [5000, 30000, 120000];          // relectures après un échec, puis toutes les 2 min
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);   // jamais les clés héritées (« constructor », « __proto__ »…)
// Effacements demandés AVANT la lecture réussie (remise à zéro, avatar retiré) : sans cette trace, la fusion
// ramènerait silencieusement ce que l'admin venait d'effacer.
const effaces = new Set(), retires = new Set();

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

// Lecture d'une sauvegarde. Résout avec l'objet lu, ou null s'il n'existe pas encore (clé ou fichier absent :
// premier démarrage, écrire est alors sans danger). Rejette sur toute autre erreur → relance, et aucune écriture.
async function lire(cle, chemin) {
  if (useRedis) { const r = await redisCmd(['GET', cle]); return r && typeof r.result === 'string' ? JSON.parse(r.result) : null; }
  if (!chemin) return null;
  let txt;
  try { txt = await readFile(chemin, 'utf8'); } catch (e) { if (e && e.code === 'ENOENT') return null; throw e; }
  try { return JSON.parse(txt.replace(/^﻿/, '')); }   // BOM : ajouté par PowerShell 5.1 ou un éditeur en « UTF-8 avec BOM »
  catch (e) {                                    // fichier tronqué : mis de côté, jamais écrasé
    await rename(chemin, chemin + '.corrompu').catch(() => {});
    console.error('[leaderboard] ' + chemin + ' illisible : renommé en .corrompu');
    return null;
  }
}
function charger(nom, cle, chemin, ok, essai) {
  lire(cle, chemin).then(d => {
    // Une erreur APRÈS la lecture (fusion) n'est pas un échec de lecture : pas de relance (elle refusionnerait).
    try { ok(d); } catch (e) { console.error('[' + nom + '] Fusion impossible (' + (e && e.message) + ') : sauvegarde laissée intacte, aucune écriture'); }
  }, e => {
    const d = RELANCES[Math.min(essai, RELANCES.length - 1)];
    console.error('[' + nom + '] Chargement échoué (' + (e && e.message) + ') : aucune écriture, nouvel essai dans ' + d / 1000 + ' s');
    setTimeout(() => charger(nom, cle, chemin, ok, essai + 1), d).unref();
  });
}
// Écrivain regroupé : planifier() programme UNE écriture après `delai` ; une seule en vol à la fois, la dernière
// version gagne. Tant que pret() est faux, rien ne part : reprendre() relance ce qui a été retenu. Une écriture
// ratée est retentée 5 s plus tard (la dernière manche de la soirée ne doit pas se perdre sur un 5xx).
// vider() : écriture immédiate, attendue (arrêt du processus).
function ecrivain(nom, cle, chemin, delai, pret, donnees) {
  let t = null, enVol = null, encore = false, retenu = false;
  const planifier = (ms) => { if (!t) t = setTimeout(ecrire, ms == null ? delai : ms); };
  async function ecrire() {
    t = null;
    if (!pret()) { retenu = true; return; }
    if (enVol) { encore = true; return; }
    let rate = false;
    enVol = (async () => {
      try {
        const d = donnees();
        if (useRedis) await redisCmd(['SET', cle, d]);
        else if (chemin) { await writeFile(chemin + '.tmp', d); await rename(chemin + '.tmp', chemin); }
      } catch (e) { rate = true; console.error('[' + nom + '] Sauvegarde échouée (nouvel essai dans 5 s) :', e && e.message); }
    })();
    await enVol; enVol = null;
    if (rate) planifier(5000);
    else if (encore) { encore = false; planifier(); }
  }
  return {
    planifier,
    reprendre() { if (retenu) { retenu = false; planifier(); } },
    async vider() {
      for (let essai = 0; essai < 3; essai++) {
        if (enVol) await enVol;                          // l'écriture en cours d'abord (elle peut échouer : on le voit ensuite)
        if (!(t || encore || retenu) || !pret()) return;
        if (t) { clearTimeout(t); t = null; }
        encore = false; retenu = false;
        await ecrire();
        if (!t) return;                                  // réussie (un échec reprogramme t)
        await new Promise(r => setTimeout(r, 1000));
      }
    },
  };
}
let ecrLb = null, ecrAv = null;                  // créés par initLeaderboard (les chemins locaux n'existent qu'alors)
const planifierSave = () => { if (ecrLb) ecrLb.planifier(); };
const planifierAv = () => { if (ecrAv) ecrAv.planifier(); };
// Arrêt (redéploiement Render : SIGTERM, 30 s avant SIGKILL) : les écritures regroupées en attente partent maintenant.
export async function flush() { await Promise.all([ecrLb && ecrLb.vider(), ecrAv && ecrAv.vider()]); }

// Reconstruit `store` à partir d'un objet lu (gère l'ancien format mono-jeu), puis y fusionne ce qui a été
// joué en mémoire AVANT que la lecture réussisse.
function hydrate(d) {
  if (!d || typeof d !== 'object') return;
  const lu = (d.board || d.history) ? { pong: { board: d.board || {}, history: d.history || [] } } : d;
  for (const g of effaces) delete lu[g];         // remises à zéro faites avant la lecture : elles l'emportent
  const memo = store; store = lu;
  try { fusionner(memo); } catch (e) { store = memo; throw e; }   // transactionnel : memo n'est jamais modifié
  if (effaces.size) { effaces.clear(); planifierSave(); }
}
// Fusion générique d'une entrée : records « au plus grand » (best*, most*) → max, « au plus petit »
// (fastest*, fewest*) → min, compteurs → somme. Aucun des 6 jeux n'a d'autre sorte de champ.
function fusionEntree(a, b) {
  for (const k in b) {
    if (!own(b, k) || k === 'name') continue;
    const x = a[k], y = b[k];
    if (typeof y !== 'number') { if (x === undefined || x === null) a[k] = y; continue; }
    if (typeof x !== 'number') a[k] = y;
    else if (/^(best|most)/.test(k)) a[k] = Math.max(x, y);
    else if (/^(fastest|fewest)/.test(k)) a[k] = Math.min(x, y);
    else a[k] = x + y;
  }
}
function fusionner(memo) {
  let rien = true;
  for (const gid in memo) {
    if (!own(memo, gid)) continue;
    const m = memo[gid];
    if (gid === DAY_SLOT) {                      // classement du jour : fusionné seulement s'il date du même jour
      const n = dailyNode();
      if (m && m.day === n.day && m.board) for (const nm in m.board) {
        if (!own(m.board, nm)) continue;
        const e = m.board[nm], cur = own(n.board, nm) ? n.board[nm] : null;
        if (!cur) n.board[nm] = e;
        else {
          cur.games += e.games || 0; cur.wins += e.wins || 0; cur.kills += e.kills || 0; cur.pts += e.pts || 0;
          const jx = cur.jeux || (cur.jeux = []);
          for (const j of e.jeux || []) if (jx.indexOf(j) < 0) jx.push(j);
        }
        rien = false;
      }
      continue;
    }
    if (!m || !m.board) continue;
    const g = node(gid);
    for (const nm in m.board) {
      if (!own(m.board, nm)) continue;
      if (own(g.board, nm)) fusionEntree(g.board[nm], m.board[nm]); else g.board[nm] = m.board[nm];
      rien = false;
    }
    if (m.history && m.history.length) { g.history = m.history.concat(g.history).slice(0, HISTORY_MAX); rien = false; }
  }
  for (const gid in store) if (own(store, gid) && gid !== DAY_SLOT) dirty.add(gid);   // les clients déjà connectés avaient des classements vides
  dailyDirty = true;
  if (!rien) planifierSave();                    // la fusion doit atteindre le stockage
}

function loadAvatars() {
  charger('avatars', AV_KEY, AV_PATH, d => {
    const memo = avatars;
    avatars = (d && typeof d === 'object') ? d : {};
    let change = retires.size > 0;
    for (const k of retires) delete avatars[k];                                          // retirés avant la lecture
    retires.clear();
    for (const k in memo) if (own(memo, k)) { avatars[k] = memo[k]; change = true; }   // changés avant la lecture : ils gagnent
    avCharge = true;
    if (change) planifierAv();
    if (ecrAv) ecrAv.reprendre();
  }, 0);
}
export function getAvatar(name) { return (name && own(avatars, name) && avatars[name]) || null; }
export function setAvatar(name, data) {          // data falsy => retrait de l'avatar
  if (!name) return;
  if (data) { avatars[name] = data; retires.delete(name); } else { delete avatars[name]; if (!avCharge) retires.add(name); }
  const keys = Object.keys(avatars);
  if (keys.length > AV_MAX) delete avatars[keys[0]];   // ordre d'insertion => le plus ancien saute
  planifierAv();                                       // au plus une écriture toutes les 10 s
}

export function initLeaderboard(path) {
  PATH = path;
  // avatars.json À CÔTÉ du classement, quel que soit son nom (LEADERBOARD_FILE) : jamais le même fichier
  AV_PATH = join(dirname(path), 'avatars.json');
  if (AV_PATH === PATH) AV_PATH = path + '.avatars.json';
  ecrLb = ecrivain('leaderboard', REDIS_KEY, PATH, 1000, () => charge, () => JSON.stringify(store));
  ecrAv = ecrivain('avatars', AV_KEY, AV_PATH, 10000, () => avCharge, () => JSON.stringify(avatars));
  console.log('[leaderboard] Stockage : ' + (useRedis ? 'Upstash Redis (en ligne).' : 'fichier local (' + path + ').'));
  loadAvatars();
  charger('leaderboard', REDIS_KEY, PATH, d => { if (d) hydrate(d); charge = true; ecrLb.reprendre(); }, 0);
}

function node(gameId) {
  const g = (own(store, gameId) && store[gameId]) || (store[gameId] = { board: {}, history: [] });
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

// Regroupée (~1 s) : règle aussi les 7 SET concurrents d'une remise à zéro complète, arrivés dans le désordre.
export function save() { planifierSave(); }

export function reset(gameId) { store[gameId] = { board: {}, history: [] }; if (!charge) effaces.add(gameId); markDirty(gameId); save(); }

export function lbMsg(gameId) { const g = node(gameId); return JSON.stringify({ t: 'lb', g: gameId, board: Object.values(g.board), history: g.history }); }

/* ---------- Classement du jour (« Défi du jour ») ----------
   Agrégé TOUS JEUX CONFONDUS et remis à zéro au changement de date (UTC).
   Vit dans `store` sous une clé réservée (aucun jeu ne peut s'appeler ainsi) : il profite
   ainsi du même save() que les classements permanents, sans écriture supplémentaire.
   Il a son propre drapeau « sale » : le passer par dirty/lbMsg polluerait les classements
   par jeu côté client (boards[g] est indexé par identifiant de jeu). */
const DAY_SLOT = '#daily';
const DAY_MAX = 60;                 // nb max de joueurs suivis dans la journée
let dailyDirty = false;
const todayKey = () => new Date().toISOString().slice(0, 10);
function dailyNode() {
  const n = (own(store, DAY_SLOT) && store[DAY_SLOT]) || (store[DAY_SLOT] = { day: '', board: {} });
  if (!n.board || typeof n.board !== 'object') n.board = {};
  const t = todayKey();
  if (n.day !== t) { n.day = t; n.board = {}; dailyDirty = true; }   // nouveau jour : tout le monde repart à zéro
  return n;
}
// Crédite une manche pour un joueur. 1 pt de participation + 3 pts de victoire.
export function bumpDaily(name, o) {
  if (!name) return;
  const n = dailyNode();
  const e = (own(n.board, name) && n.board[name]) || (n.board[name] = { name, games: 0, wins: 0, kills: 0, pts: 0, jeux: [] });
  const win = !!(o && o.win);
  e.games++; if (win) e.wins++;
  e.kills += (o && o.kills) || 0;
  e.pts += 1 + (win ? 3 : 0);
  const g = o && o.game;
  if (g && e.jeux.indexOf(g) < 0) e.jeux.push(g);
  const keys = Object.keys(n.board);
  if (keys.length > DAY_MAX) delete n.board[keys[0]];               // ordre d'insertion => le plus ancien saute
  dailyDirty = true;
}
export function dailyMsg() {
  const n = dailyNode();
  const list = Object.values(n.board).sort((a, b) => b.pts - a.pts || b.wins - a.wins || b.kills - a.kills).slice(0, 20);
  return JSON.stringify({ t: 'daily', day: n.day, board: list });
}
export function dailyChanged() { const d = dailyDirty; dailyDirty = false; return d; }   // consomme le drapeau
export function resetDaily() { store[DAY_SLOT] = { day: todayKey(), board: {} }; if (!charge) effaces.add(DAY_SLOT); dailyDirty = true; save(); }

export function markDirty(gameId) { dirty.add(gameId); }
export function dirtyGames() { return [...dirty]; }
export function anyDirty() { return dirty.size > 0; }
export function clearDirty() { dirty.clear(); }
