// Point d'entrée : sert les fichiers statiques (public/) + branche le hub multijeux (WS + boucle).
import http from 'http';
import os from 'os';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join, extname } from 'path';
import { initLeaderboard, board, history } from './leaderboard.js';
import { attach, GAME_META } from './hub.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

initLeaderboard(join(__dirname, 'leaderboard.json'));

function statsHtml(gid) {
  const known = GAME_META.some(g => g.id === gid) ? gid : 'pong';
  const rows = Object.values(board(known)).sort((a, b) => b.wins - a.wins || b.kills - a.kills).map(e => {
    const kd = e.deaths ? (e.kills / e.deaths).toFixed(2) : (e.kills ? '∞' : '0');
    return `<tr><td>${esc(e.name)}</td><td>${e.games}</td><td>${e.wins}</td><td>${e.kills}</td><td>${e.dmg}</td><td>${kd}</td><td>${Math.round(e.bestSurvivalSec)}s</td></tr>`;
  }).join('');
  const hist = history(known).map(h => `<li>${esc(h.winner)} — ${h.mode}/${h.preset} · ${h.durationSec}s · ${h.nParts} j.</li>`).join('');
  const tabs = GAME_META.map(g => `<a href="/stats?game=${g.id}">${esc(g.name)}</a>`).join(' · ');
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>Stats — ${esc(known)}</title>
<style>body{font-family:system-ui,sans-serif;background:#0e1024;color:#eef0fb;padding:24px;}
table{border-collapse:collapse;width:100%;max-width:720px;}th,td{padding:6px 10px;border-bottom:1px solid #2a2e44;text-align:left;}
th{color:#9aa0bd;font-size:12px;text-transform:uppercase;}h1{font-size:20px;}h2{font-size:15px;color:#9aa0bd;margin-top:24px;}
li{color:#c7cbe0;margin:3px 0;}a{color:#5db4ff;}</style></head><body>
<h1>🏓 Classement — ${esc(known)}</h1><p>${tabs}</p>
<table><tr><th>Joueur</th><th>Parties</th><th>Victoires</th><th>Élim.</th><th>Vies ôtées</th><th>K/D</th><th>Survie max</th></tr>${rows || '<tr><td colspan=7>Aucune donnée</td></tr>'}</table>
<h2>Dernières parties</h2><ul>${hist || '<li>—</li>'}</ul>
<p><a href="/leaderboard.json?game=${known}">leaderboard.json</a> · <a href="/">retour au jeu</a></p>
</body></html>`;
}

const server = http.createServer(async (req, res) => {
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
});

attach(server);

server.listen(PORT, () => {
  const nets = os.networkInterfaces();
  const lan = Object.values(nets).flat().find(n => n && n.family === 'IPv4' && !n.internal);
  console.log('\n🎮  Plateforme LAN démarrée (zéro dépendance) — jeux : ' + GAME_META.map(g => g.name).join(', '));
  console.log(`   Local :  http://localhost:${PORT}`);
  if (lan) console.log(`   LAN   :  http://${lan.address}:${PORT}   (ouvrir sur les autres machines du réseau)\n`);
});
