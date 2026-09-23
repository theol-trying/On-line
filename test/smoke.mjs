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
async function demarrerServeur() {
  srv = spawn(process.execPath, ['server.js'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT), SMOKE_FAULT: '1' } });
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
function client(nom) {
  const c = { nom, cache: null, etats: new Set(), fx: 0, msgs: 0, erreurs: [], dernier: null, refus: 0 };
  c.ws = new WebSocket(URL_WS);
  c.ws.onmessage = e => {
    let m; try { m = JSON.parse(e.data); } catch { c.erreurs.push('JSON illisible'); return; }
    if (m.t === 'denied' || m.t === 'notready') { c.refus++; return; }
    if (m.t === 'hello') { c.moi = m.you.id; return; }
    if (m.t !== 'state') return;
    c.msgs++;
    // réplique EXACTE de la reconstitution de public/app.js
    const part = { ...m }; delete part.t; delete part.g;
    const prec = c.cache;
    const s = prec ? Object.assign({}, prec, part) : part;
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
  console.log(`    · ${hz} instantanés/s reçus en jeu · ${c.fx} effets reçus`);

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
  v.jeu({ t: '__panne' }); await wait(500);
  const avant = v.msgs; await wait(600);
  ok('une exception de jeu ne tue plus le serveur', serveurVivant());
  ok('la partie est relancée et les joueurs prévenus', notes >= 1 && v.msgs > avant, notes + ' note(s), ' + (v.msgs - avant) + ' état(s) après');
  v.ws.close(); await wait(300);
}

/* ---------- déroulé ---------- */
console.log(`Test de fumée — serveur sur le port ${PORT}\n`);
if (!await demarrerServeur()) {
  console.error('✗ le serveur n\'a pas démarré :\n' + srvLog);
  process.exit(1);
}
console.log('✓ serveur démarré');

const cadences = {};
cadences.pong = await jouer('pong', 4, { arene: { lire: s => s.aw + 'x' + s.ah, valeur: '630x630' }, ratioRaquette: 0.25 });
await jouer('pong', 10, { arene: { lire: s => s.aw + 'x' + s.ah, valeur: '1020x1020' }, ratioRaquette: 0.25 });
cadences.tron = await jouer('tron', 10, { arene: { lire: s => 'grille ' + s.gw, valeur: 'grille 92' } });
cadences.snake = await jouer('snake', 10, { arene: { lire: s => 'grille ' + s.gw, valeur: 'grille 58' } });
cadences.tank = await jouer('tank', 8, { arene: { lire: s => 'grille ' + s.ag, valeur: 'grille 19' } });
cadences.bomb = await jouer('bomb', 8, { arene: { lire: s => 'grille ' + s.gw, valeur: 'grille 17' } });
cadences.sumo = await jouer('sumo', 10, { arene: { lire: s => 'arène ' + s.ar, valeur: 'arène 1080' } });   // k = 1.8 → 600 × 1.8
await arriveeEnCours();
await protections();

console.log('\n▶ état final du serveur');
ok('le serveur a survécu à tous les jeux', serveurVivant(), srvSorti !== null ? 'sorti avec le code ' + srvSorti : '');
const traces = srvLog.split('\n').filter(l => /Error|error|ReferenceError|TypeError/.test(l) && !/panne simulée/.test(l));   // la panne simulée (point 5 des protections) est attendue
ok('aucune erreur dans le journal du serveur', traces.length === 0, traces.slice(0, 2).join(' | '));

if (srv) srv.kill();
await wait(300);
console.log(`\n${echecs === 0 ? '✅' : '❌'}  ${tests - echecs}/${tests} vérifications passées` +
  `   ·   cadences en jeu : ${Object.entries(cadences).map(([k, v]) => k + ' ' + v + '/s').join(' · ')}`);
process.exit(echecs === 0 ? 0 : 1);
