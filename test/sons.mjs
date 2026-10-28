// Contrôle des bruitages des 9 jeux — zéro dépendance, sans navigateur (lancé par npm test, donc aussi par la CI).
// Pour chaque jeu, outils/verifier-sons.mjs exécute toutes les recettes de public/games/<id>/sons.js contre une boîte
// à sons factice : bornes, niveau, couverture de la page d'écoute, déclencheurs du client, plus de synthèse brute.
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const JEUX = ['pong', 'tron', 'tank', 'bomb', 'snake', 'sumo', 'foot', 'patate', 'micro'];
let echecs = 0;
console.log('Bruitages : recettes des 9 jeux');
for (const id of JEUX) {
  const r = spawnSync(process.execPath, [join(ROOT, 'outils', 'verifier-sons.mjs'), id], { encoding: 'utf8' });
  const sortie = (r.stdout || '') + (r.stderr || '');
  if (r.status === 0) console.log('  ✓ ' + sortie.split('\n')[0]);
  else { echecs++; console.log('  ✗ ' + sortie.trim().split('\n').join('\n    ')); }
}
console.log(echecs ? `❌ ${echecs} jeu(x) en défaut` : '✅ 9/9 jeux sans défaut');
process.exit(echecs ? 1 : 0);
