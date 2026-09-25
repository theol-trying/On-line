// Test de fumée — zéro dépendance, un seul fichier.
//
//    node test/smoke.mjs          (ou : npm test)
//
// Démarre le serveur sur un port dédié, ouvre de VRAIS clients WebSocket, joue une manche
// dans chacun des 6 jeux et vérifie que rien ne casse. Sort en code 1 au moindre échec.
//
// Pourquoi ce fichier existe : `node --check` ne voit que la syntaxe. Les deux pannes de
// production du 21/09/2026 étaient invisibles pour lui —
//   • `CELL is not defined` : Bomberman tuait le processus entier dès qu'on le sélectionnait ;
//   • les joueurs qui rejoignaient recevaient un delta au lieu d'un instantané complet.
// Les deux auraient été attrapées ici en quelques secondes. À lancer avant chaque push.

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdtempSync, rmSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import net from 'net';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.SMOKE_PORT || 3999);
const URL_WS = `ws://localhost:${PORT}/`;
const wait = ms => new Promise(r => setTimeout(r, ms));

let echecs = 0, tests = 0;
const ok = (nom, cond, detail) => {
  tests++;
  if (cond) { console.log(`  ✓ ${nom}`); return true; }
  echecs++; console.log(`  ✗ ${nom}${detail ? ' — ' + detail : ''}`); return false;
};

/* ---------- serveur ---------- */
let srv = null, srvSorti = null, srvLog = '';
// Stockage du test : un dossier temporaire, JAMAIS Upstash. Des manches se terminent pour de vrai ci-dessous
// (le classement est donc écrit) : hériter d'un UPSTASH_* défini dans le terminal écrirait dans la clé de PROD.
const TMP = mkdtempSync(join(tmpdir(), 'online-smoke-'));
const ENV = { ...process.env, PORT: String(PORT), SMOKE_FAULT: '1', LEADERBOARD_FILE: join(TMP, 'leaderboard.json') };
for (const k of ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'LEADERBOARD_KEY', 'AVATAR_KEY', 'ADMIN_KEY']) delete ENV[k];
async function demarrerServeur() {
  srv = spawn(process.execPath, ['server.js'], { cwd: ROOT, env: ENV });
  srv.stdout.on('data', d => { srvLog += d; });
  srv.stderr.on('data', d => { srvLog += d; });
  srv.on('exit', code => { srvSorti = code; });
  for (let i = 0; i < 60; i++) {                       // attend l'écoute (max ~6 s)
    await wait(100);
    if (srvSorti !== null) return false;
    if (/démarrée/.test(srvLog)) return true;
  }
  return false;
}
const serveurVivant = () => srvSorti === null;

/* ---------- client ---------- */
function client(nom, jeton) {
  const c = { nom, cache: null, etats: new Set(), fx: 0, msgs: 0, erreurs: [], dernier: null, refus: 0, sansG: 0, sansFx: 0, av: 0, lb: {} };
  c.ws = new WebSocket(URL_WS + (jeton ? '?t=' + encodeURIComponent(jeton) : ''));
  c.ws.onmessage = e => {
    let m; try { m = JSON.parse(e.data); } catch { c.erreurs.push('JSON illisible'); return; }
    if (m.t === 'denied' || m.t === 'notready') { c.refus++; if (m.t === 'notready') c.notready = m; return; }
    if (m.t === 'hello') { c.moi = m.you.id; c.jeton = m.you.token; return; }
    if (m.t === 'room') { c.room = m; return; }
    if (m.t === 'remplace') { c.remplace = true; return; }
    if (m.t === 'av') { c.av++; return; }
    if (m.t === 'png') { c.pngTs = m.ts; return; }
    if (m.t === 'lb') { c.lb[m.g] = m; return; }
    if (m.t !== 'state') return;
    c.msgs++;
    if (!('g' in m)) c.sansG++;
    if (!('fx' in m)) c.sansFx++;
    // réplique EXACTE de la reconstitution de public/app.js
    const part = { ...m }; delete part.t; delete part.g;
    const prec = c.cache;
    const s = prec ? Object.assign({}, prec, part) : part;
    s.fx = part.fx || [];
    if (part.pd && prec && Array.isArray(prec.players)) {
      const arr = prec.players.slice();
      for (const d of part.pd) { const i = d[0]; if (i >= 0 && i < arr.length) arr[i] = Object.assign({}, arr[i], d[1]); }
      s.players = arr;
    }
    delete s.pd;
    c.cache = s; c.dernier = s;
    if (s.gs === undefined) c.erreurs.push('gs absent après fusion');
    if (!Array.isArray(s.players)) c.erreurs.push('players absent après fusion');
    c.etats.add(s.gs);
    c.fx += (m.fx || []).length;
  };
  c.ws.onerror = () => c.erreurs.push('erreur socket');
  c.envoie = o => { if (c.ws.readyState === 1) c.ws.send(JSON.stringify(o)); };
  c.jeu = m => c.envoie({ t: 'g', m });
  c.ouvert = new Promise(r => { c.ws.onopen = () => { c.envoie({ t: 'name', name: nom }); r(); }; });
  return c;
}

/* ---------- un jeu ---------- */
async function jouer(id, participants, attentes = {}) {
  console.log(`\n▶ ${id} — ${participants} participants`);
  const c = client('Smoke');
  await c.ouvert;
  await wait(300);
  c.envoie({ t: 'pick', id });
  await wait(400);
  for (let i = 0; i < participants - 1; i++) { c.jeu({ t: 'bots' }); await wait(60); }
  await wait(250);
  const t0 = Date.now(); const msg0 = c.msgs;
  c.jeu({ t: 'start' });
  await wait(4200);                                    // décompte (3 s) puis début de partie
  const enJeu = Date.now(); const msgEnJeu = c.msgs;
  const boucle = setInterval(() => {
    if (id === 'pong') c.jeu({ t: 'input', up: Math.random() < 0.5, dn: Math.random() < 0.5 });
    else if (id === 'tron' || id === 'snake') c.jeu({ t: 'dir', d: ['up', 'down', 'left', 'right'][(Math.random() * 4) | 0] });
    else if (id === 'foot') {                          // course tenue + un tir ou un tacle de temps en temps
      c.jeu({ t: 'input', up: Math.random() < 0.3, down: Math.random() < 0.3, left: Math.random() < 0.3, right: Math.random() < 0.3 });
      if (Math.random() < 0.1) c.jeu({ t: 'shoot' }); if (Math.random() < 0.1) c.jeu({ t: 'tackle' });
      if (Math.random() < 0.15) c.jeu({ t: 'charge', on: Math.random() < 0.5 });   // tir chargé : Espace enfoncé / relâché
      if (Math.random() < 0.15) c.jeu({ t: 'sprint', on: Math.random() < 0.6 });   // sprint : Maj tenue / relâchée
    }
    else if (id === 'sumo') {                          // état tenu des 4 directions + une charge de temps en temps
      c.jeu({ t: 'input', up: Math.random() < 0.3, down: Math.random() < 0.3, left: Math.random() < 0.3, right: Math.random() < 0.3 });
      if (Math.random() < 0.15) c.jeu({ t: 'dash' });
    }
    else c.jeu({ t: 'input', left: Math.random() < 0.4, right: Math.random() < 0.4, fwd: true, fire: Math.random() < 0.3 });
  }, 150);
  await wait(3000);
  clearInterval(boucle);

  const s = c.dernier || {};
  const secs = (Date.now() - enJeu) / 1000;
  ok('le serveur n\'a pas planté', serveurVivant(), srvSorti !== null ? 'code ' + srvSorti : '');
  ok('la manche atteint l\'état « play »', c.etats.has('play'), 'états vus : ' + [...c.etats].join(', '));
  ok('aucune erreur de reconstitution', c.erreurs.length === 0, c.erreurs.slice(0, 2).join(' / '));
  ok('aucun refus inattendu', c.refus === 0, c.refus + ' refus');
  ok('le tableau des joueurs est complet', Array.isArray(s.players) && s.players.length > 0,
    Array.isArray(s.players) ? '' : 'absent');
  ok('tous les participants jouent', (s.players || []).filter(p => p.playing).length === participants,
    (s.players || []).filter(p => p.playing).length + ' au lieu de ' + participants);

  if (attentes.arene) {
    const vu = attentes.arene.lire(s);
    ok(`arène attendue (${attentes.arene.valeur})`, vu === attentes.arene.valeur, 'vu : ' + vu);
  }
  if (attentes.ratioRaquette && s.geo && Array.isArray(s.geo.edges)) {
    const j = (s.players || []).filter(p => p.playing && p.edge >= 0);
    const parts = j.map(p => p.len / s.geo.edges[p.edge].len);
    const min = Math.min(...parts), max = Math.max(...parts), cible = attentes.ratioRaquette;
    ok(`raquette = ${Math.round(cible * 100)} % du bord`, Math.abs(min - cible) < 0.02 && Math.abs(max - cible) < 0.02,
      'mesuré ' + Math.round(min * 1000) / 10 + '–' + Math.round(max * 1000) / 10 + ' %');
  }
  const hz = Math.round(msgEnJeu > msg0 ? (c.msgs - msgEnJeu) / secs : 0);
  console.log(`    · ${hz} instantanés/s reçus en jeu · ${c.fx} effets reçus · ${Math.round(c.sansG / Math.max(1, c.msgs) * 100)} % sans « g », ${Math.round(c.sansFx / Math.max(1, c.msgs) * 100)} % sans « fx »`);
  if (attentes.allege) ok('les deltas n\'emportent plus « g » ni un « fx » vide', c.sansG > c.msgs / 2 && c.sansFx > c.msgs / 2,
    c.sansG + ' sans g, ' + c.sansFx + ' sans fx sur ' + c.msgs);

  c.jeu({ t: 'abort' });                               // abandon : la manche ne s'enregistre pas au classement
  await wait(250);
  c.ws.close();
  await wait(400);
  return hz;
}

/* ---------- arrivée en cours de partie (régression du 21/09) ---------- */
async function arriveeEnCours() {
  console.log('\n▶ arrivée d\'un joueur en cours de partie');
  const a = client('Hote'); await a.ouvert; await wait(300);
  a.envoie({ t: 'pick', id: 'tron' }); await wait(400);
  for (let i = 0; i < 3; i++) { a.jeu({ t: 'bots' }); await wait(60); }
  a.jeu({ t: 'start' }); await wait(4200);
  const b = client('Arrivant'); await b.ouvert;        // rejoint alors que la manche tourne
  await wait(2000);
  ok('l\'arrivant reçoit un instantané exploitable', b.erreurs.length === 0 && b.msgs > 0,
    b.erreurs.slice(0, 2).join(' / ') || 'aucun état reçu');
  ok('l\'arrivant a bien le tableau des joueurs', Array.isArray((b.dernier || {}).players));
  a.jeu({ t: 'abort' }); await wait(200);
  a.ws.close(); b.ws.close(); await wait(400);
}

/* ---------- protections du serveur (le site est PUBLIC, une seule instance) ---------- */
const ferme = (ws, ms) => new Promise(r => {           // true si le SERVEUR coupe la connexion dans le délai
  if (ws.readyState >= 2) return r(true);
  const t = setTimeout(() => r(false), ms);
  ws.addEventListener('close', () => { clearTimeout(t); r(true); });
});
async function protections() {
  console.log('\n▶ protections : taille et débit des messages');
  // 1. une trame de 70 Ko (au-delà du plafond de 64 Ko) → connexion coupée
  const gros = client('Gros'); await gros.ouvert; await wait(200);
  gros.ws.send('x'.repeat(70 * 1024));
  ok('une trame trop grosse coupe la connexion', await ferme(gros.ws, 2000));
  // 2. un message légitime volumineux (≈ un avatar, 30 Ko) passe toujours
  const legit = client('Legit'); await legit.ouvert; await wait(200);
  let echos = 0; legit.ws.addEventListener('message', e => { if (/"t":"png"/.test(e.data)) echos++; });
  legit.envoie({ t: 'name', name: 'Legit', bourrage: 'y'.repeat(30 * 1024) });
  await wait(300);
  ok('un message de 30 Ko est accepté', legit.ws.readyState === 1);
  // 3. rythme honnête (30 messages/s pendant 2 s) : tout est traité, rien n'est jeté
  for (let i = 0; i < 60; i++) { legit.envoie({ t: 'png', ts: i }); await wait(33); }
  await wait(400);
  ok('un rythme humain n\'est jamais bridé', echos >= 58, echos + '/60 réponses');
  // 4. inondation : 5 000 messages d'un coup → connexion coupée, le client honnête n'est pas touché
  const bourrin = client('Bourrin'); await bourrin.ouvert; await wait(200);
  for (let i = 0; i < 5000; i++) bourrin.envoie({ t: 'png', ts: i });
  ok('une inondation coupe la connexion fautive', await ferme(bourrin.ws, 3000));
  ok('les autres joueurs restent connectés', legit.ws.readyState === 1);
  ok('le serveur a encaissé', serveurVivant());
  legit.ws.close(); await wait(300);

  // 5. filet du hub : une exception dans le code d'un jeu ne doit plus tuer le processus (panne du 21/09).
  //    SMOKE_FAULT fait lever une erreur au message __panne ; le hub doit relancer la partie et prévenir.
  const v = client('Victime'); await v.ouvert; await wait(300);
  let notes = 0; v.ws.addEventListener('message', e => { if (/"t":"note"/.test(e.data)) notes++; });
  // Compté depuis AVANT la panne : le lobby n'émet plus rien quand rien ne change (quota Render), donc le
  // seul état attendu est l'instantané complet de relance, qui part dans les ~250 ms.
  const avant = v.msgs;
  v.jeu({ t: '__panne' }); await wait(1100);
  ok('une exception de jeu ne tue plus le serveur', serveurVivant());
  ok('la partie est relancée et les joueurs prévenus', notes >= 1 && v.msgs > avant, notes + ' note(s), ' + (v.msgs - avant) + ' état(s) après');
  v.ws.close(); await wait(300);
}

/* ---------- robustesse (24/09) : ce qui tuait le serveur, les fantômes, les amplificateurs, « Rejouer = Prêt » ---------- */
const attendre = async (cond, ms) => { for (let t = 0; t < ms; t += 50) { if (cond()) return true; await wait(50); } return cond(); };
function requeteBrute(ligne) {                           // requête HTTP écrite à la main (malformée exprès)
  return new Promise(r => {
    const s = net.connect(PORT, '127.0.0.1', () => s.write(ligne + '\r\nHost: localhost\r\n\r\n'));
    let rep = ''; s.on('data', d => { rep += d; }); s.on('error', () => r(rep)); s.on('close', () => r(rep));
    setTimeout(() => { try { s.destroy(); } catch {} r(rep); }, 1500);
  });
}
const cap = s => { const q = s && s.path; if (!q || q.length < 2) return null; const u = q[q.length - 2], v = q[q.length - 1]; return [Math.sign(v[0] - u[0]), Math.sign(v[1] - u[1])]; };
const NOM_DIR = (x, y) => (x === 1 ? 'right' : x === -1 ? 'left' : y === 1 ? 'down' : 'up');

async function robustesse() {
  console.log('\n▶ robustesse : clés héritées, requête malformée, reprise de connexion, amplificateurs');
  const a = client('Hote'); await a.ouvert; await wait(300);
  a.envoie({ t: 'pick', id: 'constructor' }); await wait(300);          // tuait le processus (GAMES['constructor'] = Object)
  ok('un choix de jeu « constructor » ne tue plus le serveur', serveurVivant());
  const rep = await requeteBrute('GET http://[ HTTP/1.1');                 // new URL() levait hors filet
  ok('une requête HTTP malformée ne tue plus le serveur', serveurVivant(), (rep.split('\r\n')[0] || 'pas de réponse'));
  a.envoie({ t: 'png', ts: 'x'.repeat(2000) }); await attendre(() => a.pngTs !== undefined, 1000);
  ok('l\'écho du ping ne renvoie qu\'un nombre', typeof a.pngTs === 'number', 'reçu : ' + typeof a.pngTs);
  a.jeu({ t: 'lbreset' }); await wait(200);
  ok('l\'hôte de repli ne peut pas effacer le classement (clé admin requise)', a.refus >= 1, a.refus + ' refus');
  a.refus = 0;

  // Reprise : un 2e onglet (ou le même après une perte de réseau) présente le jeton d'un membre ENCORE connecté
  const b = client('Bis', a.jeton); await b.ouvert; await wait(500);
  ok('le jeton d\'un membre connecté est REPRIS (même joueur, pas un doublon)', b.moi === a.moi && a.remplace === true,
    'ids ' + a.moi + ' / ' + b.moi + ', remplacé : ' + !!a.remplace);
  ok('l\'ancien onglet est fermé et la salle ne compte qu\'un joueur', await ferme(a.ws, 2000) && b.room && b.room.players.length === 1,
    b.room ? b.room.players.length + ' membre(s)' : 'pas de salle');

  // Hôte conservé après un F5 au lobby : l'ordre d'arrivée suit le jeton, pas la position dans la liste
  const c2 = client('Second'); await c2.ouvert; await wait(300);
  b.ws.close(); await wait(300);
  const b2 = client('Bis', b.jeton); await b2.ouvert; await wait(400);
  ok('l\'hôte de repli garde son rôle après un F5', b2.room && b2.room.host === b2.moi, 'hôte ' + (b2.room && b2.room.host) + ' au lieu de ' + b2.moi);

  // Amplificateur : 50 avatars en 1 s → le témoin n'en reçoit presque aucun (au plus 1 par 5 s)
  c2.av = 0;
  for (let i = 0; i < 50; i++) { b2.envoie({ t: 'avatar', a: i % 2 ? '🐯' : '🦊' }); await wait(20); }
  await wait(400);
  ok('un avatar renvoyé en boucle n\'est plus rediffusé à chaque fois', c2.av <= 2, c2.av + ' diffusions reçues pour 50 envois');

  // Pseudo piège + vraie fin de manche (Tron à 2 humains) + « Rejouer = Prêt »
  b2.envoie({ t: 'name', name: '__proto__' }); await wait(1200);         // un renommage par seconde au plus
  b2.envoie({ t: 'pick', id: 'tron' }); await wait(500);
  b2.jeu({ t: 'start' });                                                 // pas prêt : « Rejouer » le rend prêt, mais c2 ne l'est pas
  await attendre(() => b2.notready, 1000);
  const moiPret = () => { const p = b2.room && b2.room.players.find(x => x.id === b2.moi); return !!(p && p.ready); };
  ok('« Rejouer » vaut « Prêt » (sans lancer tant qu\'un joueur manque)', moiPret() && !b2.etats.has('countdown'),
    'prêt : ' + moiPret() + ', états : ' + [...b2.etats].join(','));
  ok('le refus nomme le retardataire', !!(b2.notready && Array.isArray(b2.notready.wait) && b2.notready.wait.indexOf('Second') >= 0),
    JSON.stringify(b2.notready && b2.notready.wait));
  c2.jeu({ t: 'start' });                                                 // le dernier qui se déclare lance la manche
  ok('le dernier « Rejouer » lance la manche', await attendre(() => b2.etats.has('countdown') || b2.etats.has('play'), 1500));
  const fin = await attendre(() => b2.dernier && b2.dernier.gs === 'over', 20000);   // les deux motos filent droit dans le mur
  ok('la manche se termine (pseudo « __proto__ » au classement)', fin && serveurVivant(), fin ? '' : 'pas de fin de manche');
  await wait(300);
  const lbT = b2.lb.tron && b2.lb.tron.board || [];
  ok('le pseudo piège est neutralisé dans le classement', lbT.some(e => e.name === '__proto___'), lbT.map(e => e.name).join(','));
  b2.notready = null; c2.jeu({ t: 'start' }); await wait(300);            // < 2 s après la fin : Espace encore tenu → ignoré
  const secondPret = () => { const p = b2.room && b2.room.players.find(x => x.id === c2.moi); return !!(p && p.ready); };
  ok('pas de « Prêt » involontaire dans les 2 s qui suivent la fin', !secondPret());
  await wait(2000);
  b2.etats.clear(); b2.jeu({ t: 'start' }); await wait(300);               // après la garde : b2 prêt, c2 pas encore
  c2.envoie({ t: 'ready', v: true });                                     // le bouton Prêt du dernier lance aussi la manche
  ok('le dernier « Prêt » (bouton) lance la manche', await attendre(() => b2.etats.has('countdown'), 1500), [...b2.etats].join(','));
  b2.jeu({ t: 'abort' }); await wait(300);

  // File de 2 virages (Snake, solo) : « perpendiculaire puis demi-tour » dans le même tick → demi-tour en 2 ticks
  c2.ws.close(); await wait(300);
  b2.envoie({ t: 'pick', id: 'snake' }); await wait(400);
  b2.etats.clear(); b2.jeu({ t: 'start' });
  await attendre(() => b2.dernier && b2.dernier.gs === 'play', 6000);
  const moi = () => (b2.dernier && b2.dernier.players || []).find(p => p.name === '__proto___');
  await attendre(() => cap(moi()), 2000);
  const c0 = cap(moi());
  if (c0) {
    const perp = [-c0[1], c0[0]];
    b2.jeu({ t: 'dir', d: 'constructor' });                               // diffusait une tête {x:null}
    b2.jeu({ t: 'dir', d: NOM_DIR(perp[0], perp[1]) }); b2.jeu({ t: 'dir', d: NOM_DIR(-c0[0], -c0[1]) });
    await wait(450);
    const c1 = cap(moi()), m1 = moi();
    ok('deux virages tapés dans le même tick sont TOUS DEUX joués', !!(c1 && m1 && m1.alive && c1[0] === -c0[0] && c1[1] === -c0[1]),
      'cap ' + JSON.stringify(c0) + ' → ' + JSON.stringify(c1) + (m1 && !m1.alive ? ' (mort)' : ''));
  } else ok('deux virages tapés dans le même tick sont TOUS DEUX joués', false, 'cap initial illisible');
  ok('le serveur a encaissé la série', serveurVivant());
  b2.jeu({ t: 'abort' }); await wait(200);
  b2.ws.close(); await wait(300);
}

/* ---------- compléments du 25/09 : rafale de pings, sièges de bots, sauvegarde à l'arrêt ---------- */
// Socket WebSocket écrite à la main : l'API WebSocket ne sait pas envoyer de trames ping.
function socketBrute() {
  return new Promise(r => {
    const s = net.connect(PORT, '127.0.0.1', () => s.write(`GET / HTTP/1.1\r\nHost: localhost:${PORT}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n` +
      'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\nSec-WebSocket-Version: 13\r\n\r\n'));
    const o = { s, pongs: 0, ouvert: false };
    let buf = Buffer.alloc(0);
    s.on('data', d => {
      buf = Buffer.concat([buf, d]);
      if (!o.ouvert) { const i = buf.indexOf('\r\n\r\n'); if (i < 0) return; o.ouvert = true; buf = buf.subarray(i + 4); r(o); }
      for (;;) {                                           // trames serveur (non masquées)
        if (buf.length < 2) break;
        let len = buf[1] & 0x7f, off = 2;
        if (len === 126) { if (buf.length < 4) break; len = buf.readUInt16BE(2); off = 4; }
        else if (len === 127) { if (buf.length < 10) break; len = Number(buf.readBigUInt64BE(2)); off = 10; }
        if (buf.length < off + len) break;
        if ((buf[0] & 0x0f) === 0xA) o.pongs++;
        buf = buf.subarray(off + len);
      }
    });
    s.on('error', () => r(o));
  });
}
async function complements() {
  console.log('\n▶ compléments : rafale de pings, sièges de bots, sauvegarde à l\'arrêt');
  // 1. 50 000 pings d'un coup : un seul pong (au plus un par seconde), et la boucle ne gèle pas pour les autres
  const temoin = client('Temoin'); await temoin.ouvert; await wait(300);
  const brute = await socketBrute();
  brute.s.write(Buffer.alloc(100000, Buffer.from([0x89, 0x00])));
  await wait(150);
  const t0 = Date.now(); temoin.pngTs = undefined; temoin.envoie({ t: 'png', ts: 7 });
  await attendre(() => temoin.pngTs === 7, 2000);
  const rtt = Date.now() - t0;
  await wait(600);
  ok('une rafale de pings ne reçoit qu\'un pong', brute.pongs <= 2, brute.pongs + ' pongs');
  ok('la boucle ne gèle pas pendant la rafale', temoin.pngTs === 7 && rtt < 400, 'écho du ping en ' + rtt + ' ms');
  brute.s.destroy(); temoin.ws.close(); await wait(300);

  // 2. Bots retirés hors partie : le spectateur prend un de leurs sièges (avant : il restait dehors jusqu'à la manche suivante)
  const h = client('HoteT'); await h.ouvert; await wait(300);
  h.envoie({ t: 'pick', id: 'tank' }); await wait(400);
  for (let i = 0; i < 7; i++) { h.jeu({ t: 'bots' }); await wait(40); }   // 1 humain + 7 bots = les 8 sièges
  await wait(200);
  h.jeu({ t: 'start' }); await attendre(() => h.dernier && h.dernier.gs === 'countdown', 2000);
  const sp = client('Specta'); await sp.ouvert; await wait(500);
  const roleSp = () => { const p = h.room && h.room.players.find(x => x.id === sp.moi); return p ? p.role : '?'; };
  const avant = roleSp();
  h.jeu({ t: 'abort' }); await wait(400);
  h.jeu({ t: 'bots' }); await wait(500);                                  // 7 → 0 bot
  ok('un bot retiré hors partie libère son siège pour le spectateur', avant === 'spectator' && roleSp() === 'player',
    'rôle ' + avant + ' → ' + roleSp());
  h.ws.close(); sp.ws.close(); await wait(400);

  // 3. flush() : les écritures regroupées partent tout de suite (SIGTERM d'un redéploiement Render). Module importé
  //    ICI, avec un environnement sans Upstash : il ne peut écrire que dans le dossier temporaire.
  for (const k of ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'LEADERBOARD_KEY', 'AVATAR_KEY']) delete process.env[k];
  const L = await import(new URL('../leaderboard.js', import.meta.url).href);
  const f = join(TMP, 'flush', 'leaderboard.json');
  (await import('fs')).mkdirSync(join(TMP, 'flush'), { recursive: true });
  L.initLeaderboard(f); await wait(300);                                  // fichier absent : lecture « réussie », écriture permise
  L.board('pong').Flush = { name: 'Flush', games: 3 }; L.save();          // regroupée : partirait dans ~1 s
  await L.flush();
  let lu = null; try { lu = JSON.parse(readFileSync(f, 'utf8')); } catch {}
  ok('à l\'arrêt, la sauvegarde en attente part immédiatement', !!(lu && lu.pong && lu.pong.board.Flush && lu.pong.board.Flush.games === 3),
    lu ? JSON.stringify(lu).slice(0, 80) : 'fichier absent');
}

/* ---------- Foot : les 5 terrains (effets, zones, bumpers, vent, objets) ---------- */
async function terrainsFoot() {
  console.log('\n▶ Foot : les 5 terrains');
  const c = client('Terrains'); await c.ouvert; await wait(300);
  c.envoie({ t: 'pick', id: 'foot' }); await wait(400);
  for (let i = 0; i < 5; i++) { c.jeu({ t: 'bots' }); await wait(40); }
  const noms = ['stade', 'boue', 'glace', 'flipper', 'tempete'];
  for (let i = 0; i < noms.length; i++) {
    c.jeu({ t: 'terrain', v: noms[i] }); await wait(200);
    c.etats.clear(); c.jeu({ t: 'start' }); await wait(5200);
    const s = c.dernier || {};
    ok('terrain « ' + noms[i] + ' » joué sans panne', serveurVivant() && c.etats.has('play') && s.ter === i && c.erreurs.length === 0,
      'ter ' + s.ter + ', états ' + [...c.etats].join(','));
    c.jeu({ t: 'abort' }); await wait(300);
  }
  c.ws.close(); await wait(300);
}

/* ---------- déroulé ---------- */
console.log(`Test de fumée — serveur sur le port ${PORT}\n`);
if (!await demarrerServeur()) {
  console.error('✗ le serveur n\'a pas démarré :\n' + srvLog);
  process.exit(1);
}
console.log('✓ serveur démarré');

const cadences = {};
cadences.pong = await jouer('pong', 4, { arene: { lire: s => s.aw + 'x' + s.ah, valeur: '630x630' }, ratioRaquette: 0.25, allege: true });
await jouer('pong', 10, { arene: { lire: s => s.aw + 'x' + s.ah, valeur: '1020x1020' }, ratioRaquette: 0.25 });
cadences.tron = await jouer('tron', 10, { arene: { lire: s => 'grille ' + s.gw, valeur: 'grille 92' } });
cadences.snake = await jouer('snake', 10, { arene: { lire: s => 'grille ' + s.gw, valeur: 'grille 58' } });
cadences.tank = await jouer('tank', 8, { arene: { lire: s => 'grille ' + s.ag, valeur: 'grille 19' } });
cadences.bomb = await jouer('bomb', 8, { arene: { lire: s => 'grille ' + s.gw, valeur: 'grille 17' } });
cadences.foot = await jouer('foot', 10, { arene: { lire: s => 'arène ' + s.ar + ' · ' + (s.geo && s.geo.e ? s.geo.e.length : 0) + ' côtés', valeur: 'arène 1123 · 10 côtés' } });   // un côté (une cage) par joueur
cadences.sumo = await jouer('sumo', 10, { arene: { lire: s => 'arène ' + s.ar, valeur: 'arène 1080' } });   // k = 1.8 → 600 × 1.8
await arriveeEnCours();
await protections();
await robustesse();
await complements();
await terrainsFoot();

console.log('\n▶ état final du serveur');
ok('le serveur a survécu à tous les jeux', serveurVivant(), srvSorti !== null ? 'sorti avec le code ' + srvSorti : '');
const traces = srvLog.split('\n').filter(l => /Error|error|ReferenceError|TypeError/.test(l) && !/panne simulée/.test(l));   // la panne simulée (point 5 des protections) est attendue
ok('aucune erreur dans le journal du serveur', traces.length === 0, traces.slice(0, 2).join(' | '));

if (srv) srv.kill();
await wait(300);
try { rmSync(TMP, { recursive: true, force: true }); } catch {}
console.log(`\n${echecs === 0 ? '✅' : '❌'}  ${tests - echecs}/${tests} vérifications passées` +
  `   ·   cadences en jeu : ${Object.entries(cadences).map(([k, v]) => k + ' ' + v + '/s').join(' · ')}`);
process.exit(echecs === 0 ? 0 : 1);
