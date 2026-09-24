// Point d'entrée : sert les fichiers statiques (public/) + branche le hub multijeux (WS + boucle).
import http from 'http';
import os from 'os';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join, extname } from 'path';
import { initLeaderboard, board, history, flush } from './leaderboard.js';
import { attach, GAME_META } from './hub.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

// LEADERBOARD_FILE : le test de fumée écrit dans un dossier temporaire, jamais dans le vrai fichier.
initLeaderboard(process.env.LEADERBOARD_FILE || join(__dirname, 'leaderboard.json'));
// Une promesse rejetée sans gestionnaire tuerait le processus (Node ≥ 15) : on la journalise.
process.on('unhandledRejection', e => console.error('[serveur] promesse rejetée non gérée : ' + ((e && e.stack) || e)));
// Redéploiement Render = SIGTERM (30 s avant SIGKILL) : les sauvegardes regroupées en attente partent avant de sortir.
let arret = false;
for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => {
  if (arret) return; arret = true;
  const fin = setTimeout(() => process.exit(0), 8000); fin.unref();
  flush().catch(() => {}).finally(() => process.exit(0));
});

const STATS_CSS = `<style>body{font-family:system-ui,sans-serif;background:#0e1024;color:#eef0fb;padding:24px;}
table{border-collapse:collapse;width:100%;max-width:760px;}th,td{padding:6px 10px;border-bottom:1px solid #2a2e44;text-align:left;}
th{color:#9aa0bd;font-size:12px;text-transform:uppercase;}h1{font-size:20px;}h2{font-size:15px;color:#9aa0bd;margin-top:24px;}
li{color:#c7cbe0;margin:3px 0;}a{color:#5db4ff;}</style>`;
function statsHtml(gid) {
  const tabs = ['<a href="/stats?game=global"><b>🏅 Global</b></a>', ...GAME_META.map(g => `<a href="/stats?game=${g.id}">${esc(g.name)}</a>`)].join(' · ');
  if (gid === 'global') {                              // vue cross-jeux : agrégat par pseudo + champion de chaque jeu
    const agg = Object.create(null);                   // indexé par pseudo : aucune clé héritée
    for (const g of GAME_META) for (const e of Object.values(board(g.id))) {
      const a = agg[e.name] || (agg[e.name] = { name: e.name, games: 0, wins: 0, kills: 0, jeux: 0 });
      a.games += e.games || 0; a.wins += e.wins || 0; a.kills += e.kills || 0; a.jeux++;
    }
    const list = Object.values(agg).sort((x, y) => y.wins - x.wins || y.kills - x.kills || y.games - x.games);
    const medals = ['🥇', '🥈', '🥉'];
    const rows = list.map((e, i) => { const wr = e.games ? Math.round(e.wins / e.games * 100) : 0; return `<tr><td>${medals[i] || '#' + (i + 1)} ${esc(e.name)}</td><td>${e.jeux}</td><td>${e.games}</td><td>${e.wins}</td><td>${wr}%</td><td>${e.kills}</td></tr>`; }).join('');
    const champs = GAME_META.map(g => { const top = Object.values(board(g.id)).sort((a, b) => b.wins - a.wins || b.kills - a.kills)[0]; return `<li><b>${esc(g.name)}</b> : ${top ? esc(top.name) + ' — ' + top.wins + ' 🏆' : '—'}</li>`; }).join('');
    return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>Stats — Global</title>${STATS_CSS}</head><body>
<h1>🏅 Classement global (tous jeux)</h1><p>${tabs}</p>
<table><tr><th>Joueur</th><th>Jeux joués</th><th>Parties</th><th>Victoires</th><th>% vict.</th><th>Élim.</th></tr>${rows || '<tr><td colspan=6>Aucune donnée</td></tr>'}</table>
<h2>Champion par jeu</h2><ul>${champs}</ul>
<p><a href="/">retour au jeu</a></p></body></html>`;
  }
  const known = GAME_META.some(g => g.id === gid) ? gid : 'pong';
  const rows = Object.values(board(known)).sort((a, b) => b.wins - a.wins || b.kills - a.kills).map(e => {
    const kd = e.deaths ? (e.kills / e.deaths).toFixed(2) : (e.kills ? '∞' : '0');
    const wr = e.games ? Math.round((e.wins || 0) / e.games * 100) : 0;
    return `<tr><td>${esc(e.name)}</td><td>${e.games}</td><td>${e.wins}</td><td>${wr}%</td><td>${e.kills}</td><td>${e.dmg || 0}</td><td>${kd}</td><td>${Math.round(e.bestSurvivalSec || 0)}s</td></tr>`;
  }).join('');
  const hist = history(known).map(h => `<li>${esc(h.winner)} — ${h.mode}/${h.preset} · ${h.durationSec}s · ${h.nParts} j.</li>`).join('');
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>Stats — ${esc(known)}</title>${STATS_CSS}</head><body>
<h1>🏓 Classement — ${esc(known)}</h1><p>${tabs}</p>
<table><tr><th>Joueur</th><th>Parties</th><th>Victoires</th><th>% vict.</th><th>Élim.</th><th>Vies ôtées</th><th>K/D</th><th>Survie max</th></tr>${rows || '<tr><td colspan=8>Aucune donnée</td></tr>'}</table>
<h2>Dernières parties</h2><ul>${hist || '<li>—</li>'}</ul>
<p><a href="/leaderboard.json?game=${known}">leaderboard.json</a> · <a href="/">retour au jeu</a></p>
</body></html>`;
}

const server = http.createServer((req, res) => {
  // Filet : une requête brute « GET http://[ » faisait lever new URL() dans le gestionnaire async ; le rejet
  // n'était pas géré et le processus mourait. Toute erreur ici donne maintenant un 400, jamais une panne.
  servir(req, res).catch(() => { try { if (!res.headersSent) res.writeHead(400); res.end(); } catch {} });
});
async function servir(req, res) {
  const u = new URL(req.url, 'http://x');
  const path = u.pathname;
  const gid = u.searchParams.get('game') || 'pong';
  if (path === '/stats') { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(statsHtml(gid)); return; }
  if (path === '/leaderboard.json') {
    const known = GAME_META.some(g => g.id === gid) ? gid : 'pong';
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ game: known, board: Object.values(board(known)), history: history(known) }));
    return;
  }
  const url = path === '/' ? '/index.html' : path;
  if (url.includes('..')) { res.writeHead(403); res.end('Forbidden'); return; }
  try {
    const buf = await readFile(join(__dirname, 'public', url));
    res.writeHead(200, { 'Content-Type': TYPES[extname(url)] || 'application/octet-stream' });
    res.end(buf);
  } catch {
    res.writeHead(404); res.end('Not found');
  }
}

attach(server);

server.listen(PORT, () => {
  console.log('\n🎮  Plateforme multijeux démarrée (zéro dépendance) — jeux : ' + GAME_META.map(g => g.name).join(', '));
  if (process.env.RENDER) {                       // en ligne : l'IP du conteneur n'a aucun sens, Render affiche déjà l'URL publique
    console.log(`   En ligne · port ${PORT} · Node ${process.version}\n`);
    return;
  }
  const nets = os.networkInterfaces();
  const lan = Object.values(nets).flat().find(n => n && n.family === 'IPv4' && !n.internal);
  console.log(`   Local :  http://localhost:${PORT}`);
  if (lan) console.log(`   LAN   :  http://${lan.address}:${PORT}   (ouvrir sur les autres machines du réseau)\n`);
});
