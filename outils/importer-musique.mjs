// Importe des morceaux mp3 dans public/music/ — zéro dépendance, à lancer à la main (jamais servi par le site).
//
//    node outils/importer-musique.mjs <dossier source>
//
// Fichiers attendus : <Jeu>_Menu.mp3 et <Jeu>_InGame.mp3 (Pong, Tron, Tanks, Bomberman, Snake, Sumo, Foot,
// PatateChaude, MicroMachines). Pour chacun :
//   • ne garde QUE les trames audio (outils/mp3.mjs) : toute métadonnée saute — ID3v2 de tête ou de fin (titre,
//     artiste, pochette, certificat C2PA d'un générateur…), ID3v1 / TAG+, APE. Un fichier audio peut contenir un
//     nom, une adresse, le logiciel, le compte d'achat ;
//   • le nomme <jeu>-<menu|jeu>.<8 premiers hex du sha1>.mp3 (contenu neuf = nom neuf : cache immutable).
// Puis : reporter les noms dans public/pistes.js, calculer debut/fin avec outils/points-de-boucle.js,
// supprimer de public/music/ les anciennes versions (test/smoke.mjs refuse tout fichier orphelin).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { tramesMp3 } from './mp3.mjs';

const JEU = { Pong: 'pong', Tron: 'tron', Tanks: 'tank', Bomberman: 'bomb', Snake: 'snake', Sumo: 'sumo', Foot: 'foot', PatateChaude: 'patate', MicroMachines: 'micro' };
const ROLE = { Menu: 'menu', InGame: 'jeu' };
const src = process.argv[2];
if (!src) { console.error('usage : node outils/importer-musique.mjs <dossier source>'); process.exit(2); }
const dst = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'music');

fs.mkdirSync(dst, { recursive: true });
let erreurs = 0;
for (const f of fs.readdirSync(src).filter(f => /\.mp3$/i.test(f)).sort()) {
  const m = f.match(/^([A-Za-z]+)_(Menu|InGame)\.mp3$/);
  if (!m || !JEU[m[1]]) { console.error('ignoré (nom inattendu) :', f); erreurs++; continue; }
  const brut = fs.readFileSync(path.join(src, f)), t = tramesMp3(brut);
  if (t.trames < 100) { console.error('pas un mp3 couche III lisible :', f); erreurs++; continue; }
  const queue = brut.length - t.fin;                   // après la dernière trame : seulement une étiquette de fin connue
  if (queue > 4096 && !/^(TAG|APETAGEX|ID3|3DI|LYRICSBEGIN)/.test(brut.toString('latin1', t.fin, t.fin + 11))) {
    console.error(`flux interrompu au milieu (${queue} octets après la trame ${t.trames}) : fichier refusé, pas tronqué :`, f); erreurs++; continue;
  }
  const b = brut.subarray(t.debut, t.fin);
  const retire = brut.length - b.length;
  const nom = `${JEU[m[1]]}-${ROLE[m[2]]}.${crypto.createHash('sha1').update(b).digest('hex').slice(0, 8)}.mp3`;
  fs.writeFileSync(path.join(dst, nom), b);
  console.log(f.padEnd(26), '->', nom, (b.length / 1048576).toFixed(2) + ' Mo', retire ? `(${retire} octets de métadonnées retirés)` : '');
}
process.exit(erreurs ? 1 : 0);
