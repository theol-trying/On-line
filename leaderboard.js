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
//
// SAUVEGARDES TOURNANTES (29/09). Le classement garde ses 3 dernières versions, espacées d'au moins 1 h
// (une copie à chaque écriture ne couvrirait que quelques secondes) : .sauv1 = la plus récente … .sauv3 = la
// plus ancienne. Fichier : <fichier>.sauv1..3 (rotation par renommage, date = celle de la copie). Upstash : clés
// <clé>:sauv1..3 (+ <clé>:sauv-t = date de la dernière rotation), une rotation = 1 requête groupée par heure au
// plus. Une copie part aussi au démarrage si la dernière a plus d'1 h. Un classement VIDE n'est jamais copié :
// il ne peut pas chasser une copie pleine.
// RESTAURER À LA MAIN (serveur ARRÊTÉ pour le fichier, sinon l'écriture suivante repasse dessus) :
//   • fichier  : copier leaderboard.json.sauv1 (ou 2, 3) par-dessus leaderboard.json, puis relancer ;
//   • Upstash  : console Upstash > Data Browser, ouvrir la clé pong-line:store:sauv1 (ou 2, 3), copier sa valeur
//                dans la clé pong-line:store (ou l'équivalent REST : ["SET","pong-line:store","<valeur>"]), puis
//                redémarrer le service (il relit la clé au démarrage). LEADERBOARD_KEY change le préfixe.
import { readFile, writeFile, rename, stat, utimes } from 'fs/promises';
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

// Requêtes groupées (endpoint /pipeline) : exécutées dans l'ordre, une réponse { result } ou { error } PAR commande
// (un RENAME sur une clé absente répond en erreur sans faire échouer la requête).
async function redisPipe(cmds) {
  const res = await fetch(REST_URL.replace(/\/+$/, '') + '/pipeline', {
    method: 'POST',
    headers: { Authorization: `Bearer ${REST_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmds),
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const r = await res.json();
  if (!Array.isArray(r)) throw new Error('réponse /pipeline inattendue');
  return r;
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
// Met de côté la donnée qui n'a pas pu être fusionnée (fichier -> renommé ; Upstash -> clé ':corrompu') pour
// inspection manuelle, SANS bloquer les écritures futures (A3, 28/09 : avant, une fusion ratée coupait les
// sauvegardes pour le reste de la vie du processus).
async function quarantaine(nom, cle, chemin, d) {
  try {
    if (useRedis) { await redisCmd(['SET', cle + ':corrompu', JSON.stringify(d)]); console.error('[' + nom + '] Sauvegarde mise de côté sous la clé ' + cle + ':corrompu'); }
    else if (chemin) { const dest = chemin + '.corrompu-' + Date.now(); await rename(chemin, dest); console.error('[' + nom + '] Sauvegarde mise de côté : ' + dest); }
  } catch (e) { console.error('[' + nom + '] Impossible de mettre la sauvegarde de côté (' + (e && e.message) + ')'); }
}
// `fusion(d)` peut jeter (données incohérentes) : la donnée brute est alors mise en quarantaine et journalisée,
// mais `marquerPret()` s'exécute quand même pour que les nouveaux résultats soient de nouveau sauvegardés.
function charger(nom, cle, chemin, fusion, marquerPret, essai) {
  lire(cle, chemin).then(async d => {
    // Une erreur APRÈS la lecture (fusion) n'est pas un échec de lecture : pas de relance (elle refusionnerait).
    try { fusion(d); }
    catch (e) {
      console.error('[' + nom + '] Fusion impossible (' + (e && e.message) + ') : sauvegarde mise de côté, écritures reprises');
      await quarantaine(nom, cle, chemin, d);
    }
    marquerPret();
  }, e => {
    const d = RELANCES[Math.min(essai, RELANCES.length - 1)];
    console.error('[' + nom + '] Chargement échoué (' + (e && e.message) + ') : aucune écriture, nouvel essai dans ' + d / 1000 + ' s');
    setTimeout(() => charger(nom, cle, chemin, fusion, marquerPret, essai + 1), d).unref();
  });
}
// --- Sauvegardes tournantes du classement (voir l'en-tête) ---
const SAUV_MS = 3600000, SAUV_N = 3, SAUV_RETRY = 600000;    // espacement, nombre de copies, pause après un échec
// Vrai si le classement sérialisé ne contient rien (ni score ni historique, hors « classement du jour »)
// ou n'est pas lisible : dans les deux cas il ne vaut pas une copie.
function classementVide(txt) {
  let d; try { d = JSON.parse(txt); } catch (e) { return true; }
  if (!d || typeof d !== 'object') return true;
  const plein = g => !!g && typeof g === 'object' && ((g.board && Object.keys(g.board).length > 0) || (g.history && g.history.length > 0));
  if (d.board || d.history) return !plein(d);                // ancien format mono-jeu
  for (const gid in d) if (own(d, gid) && gid !== DAY_SLOT && plein(d[gid])) return false;
  return true;
}
// Ne bloque JAMAIS l'écriture du classement : tout est sérialisé sur une chaîne, chaque étape attrape ses erreurs.
// `precedent` = dernier contenu du classement connu comme écrit (ou lu au démarrage) : c'est lui qu'on copie,
// donc aucune relecture du stockage (pas de GET Upstash) ; `copie` = dernier contenu déjà copié (pas de doublon).
function sauvegardes(nom, cle, chemin) {
  const fich = i => chemin + '.sauv' + i, clef = i => cle + ':sauv' + i, TKEY = cle + ':sauv-t';
  let derniere = 0, precedent = null, copie = null, essaiApres = 0, chaine = Promise.resolve();
  const serie = f => (chaine = chaine.then(f).catch(() => {}));
  const absent = e => { if (!(e && e.code === 'ENOENT')) throw e; };
  const journal = (m, e) => console.error('[' + nom + '] ' + m + (e ? ' (' + (e && e.message) + ')' : ''));

  async function lireAge(m) {                     // date de la dernière rotation ; 0 = jamais ; m = « ne rien faire avant 1 h »
    try {
      if (useRedis) { const r = await redisCmd(['GET', TKEY]); const n = r && typeof r.result === 'string' ? Number(r.result) : 0; return Number.isFinite(n) ? n : 0; }
      if (!chemin) return m;
      try { return (await stat(fich(1))).mtimeMs; } catch (e) { absent(e); return 0; }
    } catch (e) { journal('Date des sauvegardes illisible : pas de copie avant 1 h', e); return m; }
  }
  async function lireSauv1() {                    // contenu de la copie la plus récente (null si absente ou illisible)
    try {
      if (useRedis) { const r = await redisCmd(['GET', clef(1)]); return r && typeof r.result === 'string' ? r.result : null; }
      return chemin ? await readFile(fich(1), 'utf8') : null;
    } catch (e) { return null; }
  }
  async function tourner(src, m) {                // décale .sauv2 -> .sauv3, .sauv1 -> .sauv2, puis écrit la nouvelle .sauv1
    if (useRedis) {
      const cmds = [];
      for (let i = SAUV_N - 1; i >= 1; i--) cmds.push(['RENAME', clef(i), clef(i + 1)]);
      cmds.push(['SET', clef(1), src], ['SET', TKEY, String(m)]);
      const r = await redisPipe(cmds);
      for (const x of r.slice(SAUV_N - 1)) if (x && x.error) throw new Error(x.error);   // RENAME d'une clé absente : sans importance
    } else if (chemin) {
      for (let i = SAUV_N - 1; i >= 1; i--) await rename(fich(i), fich(i + 1)).catch(absent);
      await writeFile(chemin + '.sauv.tmp', src);
      await rename(chemin + '.sauv.tmp', fich(1));
      await utimes(fich(1), new Date(m), new Date(m));                                     // la date du fichier = celle de la copie
    }
  }
  async function copier(src, m) {
    if (!src || src === copie || classementVide(src)) return;
    try {
      await tourner(src, m);
      derniere = m; copie = src; essaiApres = 0;
      console.log('[' + nom + '] Sauvegarde tournante : nouvelle copie .sauv1 (' + SAUV_N + ' gardées, 1 h d\'écart)');
    } catch (e) { essaiApres = m + SAUV_RETRY; journal('Sauvegarde tournante échouée (nouvel essai dans 10 min)', e); }
  }
  return {
    // À l'issue de la lecture réussie : txt = classement lu (JSON) ou null (premier démarrage).
    demarrage(txt) {
      precedent = txt;
      return serie(async () => {
        const m = Date.now();
        derniere = await lireAge(m);
        if (m - derniere < SAUV_MS || !txt || classementVide(txt)) return;
        if (await lireSauv1() === txt) { derniere = m; copie = txt; return; }   // redémarrage sans rien de nouveau : pas de doublon
        await copier(txt, m);
      });
    },
    // Après une écriture réussie de `d` : l'ancien contenu (celui qui vient d'être remplacé) est copié si la
    // dernière copie a plus d'1 h. Ne retarde pas l'écriture principale (déjà faite, chaîne à part).
    apres(d) {
      const prec = precedent; precedent = d;
      serie(async () => { const m = Date.now(); if (m - derniere >= SAUV_MS && m >= essaiApres) await copier(prec, m); });
    },
    attendre() { return chaine; },
  };
}
// Écrivain regroupé : planifier() programme UNE écriture après `delai` ; une seule en vol à la fois, la dernière
// version gagne. Tant que pret() est faux, rien ne part : reprendre() relance ce qui a été retenu. Une écriture
// ratée est retentée 5 s plus tard (la dernière manche de la soirée ne doit pas se perdre sur un 5xx).
// vider() : écriture immédiate, attendue (arrêt du processus).
// sv (facultatif) : sauvegardes tournantes, réservées au classement.
function ecrivain(nom, cle, chemin, delai, pret, donnees, sv) {
  let t = null, enVol = null, encore = false, retenu = false;
  let enPanne = false, dernierLog = 0;    // A4 : journal borné — 1re erreur tout de suite, puis au plus 1 ligne/minute, + « rétabli »
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
        if (sv) sv.apres(d);                              // écriture réussie seulement ; la rotation ne bloque jamais la suivante
      } catch (e) {
        rate = true;
        const maintenant = Date.now();
        if (!enPanne || maintenant - dernierLog >= 60000) {
          console.error('[' + nom + '] Sauvegarde échouée (nouvel essai dans 5 s) :', e && e.message);
          dernierLog = maintenant;
        }
        enPanne = true;
      }
    })();
    await enVol; enVol = null;
    if (rate) planifier(5000);
    else {
      if (enPanne) { enPanne = false; console.error('[' + nom + '] Sauvegarde rétablie.'); }
      if (encore) { encore = false; planifier(); }
    }
  }
  async function viderEcritures() {
    for (let essai = 0; essai < 3; essai++) {
      if (enVol) await enVol;                            // l'écriture en cours d'abord (elle peut échouer : on le voit ensuite)
      if (!(t || encore || retenu) || !pret()) return;
      if (t) { clearTimeout(t); t = null; }
      encore = false; retenu = false;
      await ecrire();
      if (!t) return;                                    // réussie (un échec reprogramme t)
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  return {
    planifier,
    reprendre() { if (retenu) { retenu = false; planifier(); } },
    async vider() {
      await viderEcritures();
      if (sv) { let h; await Promise.race([sv.attendre(), new Promise(r => { h = setTimeout(r, 3000); })]); clearTimeout(h); }   // rotation en cours : 3 s au plus
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
    if (change) planifierAv();
  }, () => { avCharge = true; if (ecrAv) ecrAv.reprendre(); }, 0);
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
  const sv = sauvegardes('leaderboard', REDIS_KEY, PATH);
  ecrLb = ecrivain('leaderboard', REDIS_KEY, PATH, 1000, () => charge, () => JSON.stringify(store), sv);
  ecrAv = ecrivain('avatars', AV_KEY, AV_PATH, 10000, () => avCharge, () => JSON.stringify(avatars));
  console.log('[leaderboard] Stockage : ' + (useRedis ? 'Upstash Redis (en ligne).' : 'fichier local (' + path + ').'));
  loadAvatars();
  charger('leaderboard', REDIS_KEY, PATH, d => {
    sv.demarrage(d ? JSON.stringify(d) : null);   // AVANT hydrate (qui réutilise d) et avant toute écriture : la copie de départ est la sauvegarde telle que lue
    if (d) hydrate(d);
  }, () => { charge = true; ecrLb.reprendre(); }, 0);
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
