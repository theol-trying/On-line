// Auto-contrôle des recettes de bruitages d'un jeu — zéro dépendance, sans navigateur.
//
//    node outils/verifier-sons.mjs <id>        (ex. node outils/verifier-sons.mjs micro)
//
// Exécute CHAQUE recette de public/games/<id>/sons.js (avec chaque argument de DEMO, et sans argument) contre une
// boîte à sons factice qui a la même API que public/sfx.js, et vérifie :
//   • exports : SONS (fonctions), DEMO (liste { k, arg?, nom }), SALLE { duree, mix, clarte } ; MOTEUR facultatif ;
//   • aucune exception, aucune primitive inconnue, nombres finis, durées 0..8 s, gains 0..1, fréquences 20..18 000 Hz ;
//   • niveau : somme des gains de crête des couches qui se SUPERPOSENT (même fenêtre de 60 ms, retard compris) entre
//     0,02 (inaudible) et 1,4 (trop fort, même compressé) ;
//   • DEMO couvre toutes les clés de SONS ; chaque son appelé en littéral par client.js (sound('x') / psound('x', …))
//     existe dans SONS (les clés calculées, ex. 'objet' + n, sont à vérifier à la main) ;
//   • client.js n'appelle plus de synthèse brute (createOscillator, tone(, noise(…) hors moteur de musique.
// Sort en code 1 au moindre défaut.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const id = process.argv[2];
if (!id) { console.error('usage : node outils/verifier-sons.mjs <id>'); process.exit(2); }
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const defauts = [];
const ko = m => defauts.push(m);

let M;
try { M = await import(pathToFileURL(join(ROOT, 'public', 'games', id, 'sons.js')).href); }
catch (e) { console.error('✗ import de sons.js impossible : ' + e.message); process.exit(1); }
const { SONS, DEMO, SALLE, MOTEUR } = M;
if (!SONS || typeof SONS !== 'object') ko('export SONS manquant');
if (!Array.isArray(DEMO)) ko('export DEMO manquant (liste)');
if (!SALLE || ![SALLE.duree, SALLE.mix, SALLE.clarte].every(x => typeof x === 'number' && isFinite(x))) ko('export SALLE { duree, mix, clarte } manquant ou incomplet');
else if (SALLE.duree <= 0 || SALLE.duree > 4 || SALLE.mix < 0 || SALLE.mix > 0.5 || SALLE.clarte < 0 || SALLE.clarte > 1) ko('SALLE hors bornes (duree 0..4, mix 0..0,5, clarte 0..1)');

// ── boîte factice : même API que sfx.js, chaque appel est contrôlé et son gain cumulé ──
let couches = [], appels = 0, courant = '', facteur = 1;
const nombre = (v, nom, a, b) => { if (v === undefined) return; if (typeof v !== 'number' || !isFinite(v)) ko(`${courant} : ${nom} n'est pas un nombre fini (${v})`); else if (v < a || v > b) ko(`${courant} : ${nom} = ${v} hors ${a}..${b}`); };
function controle(o, prim, champsHz) {
  appels++;
  if (!o || typeof o !== 'object') { ko(`${courant} : ${prim} sans objet d'options`); return; }
  nombre(o.dur, 'dur', 0.005, 8); nombre(o.retard, 'retard', 0, 8); nombre(o.gain, 'gain', 0, 1);
  nombre(o.reverb, 'reverb', 0, 1); nombre(o.varie, 'varie', 0, 1); nombre(o.attaque, 'attaque', 0, 4);
  for (const h of champsHz) nombre(o[h], h, 20, 18000);
  if (o.filtre) { nombre(o.filtre.f, 'filtre.f', 20, 20000); nombre(o.filtre.f2, 'filtre.f2', 20, 20000); nombre(o.filtre.q, 'filtre.q', 0.0001, 40); }
  if (typeof o.gain === 'number') couches.push({ r: typeof o.retard === 'number' ? o.retard : 0, g: o.gain * facteur });
}
function crete() {                                      // pire fenêtre de 60 ms : couches simultanées seulement
  let max = 0;
  for (const c of couches) { let s = 0; for (const d of couches) if (d.r >= c.r && d.r < c.r + 0.06) s += d.g; if (s > max) max = s; }
  return max;
}
const S = {
  pret: () => true, avec: (p, a, fn) => fn(), limite: () => true, varier: (x) => x,
  plus: (f, fn) => { if (typeof f !== 'number' || !(f > 0) || f > 6) ko(`${courant} : S.plus(${f}) hors 0..6`); const f0 = facteur; facteur = f0 * (f > 0 ? f : 1); try { fn(); } finally { facteur = f0; } },
  ton: o => { controle(o, 'ton', ['f', 'f2']); if (o && o.onde && !['sine', 'triangle', 'square', 'sawtooth', 'doux', 'creux', 'orgue'].includes(o.onde)) ko(`${courant} : onde inconnue ${o.onde}`); },
  bruit: o => { controle(o, 'bruit', []); if (o && o.couleur && !['blanc', 'rose', 'brun'].includes(o.couleur)) ko(`${courant} : couleur inconnue ${o.couleur}`); },
  fm: o => controle(o, 'fm', ['f']), corde: o => controle(o, 'corde', ['f']), choc: o => controle(o, 'choc', ['f', 'f2', 'fClic']),
  membrane: o => controle(o, 'membrane', ['f']), explosion: o => { controle(o, 'explosion', []); nombre(o && o.taille, 'taille', 0.2, 1.6); },
  souffle: o => controle(o, 'souffle', ['f1', 'f2']), sifflet: o => controle(o, 'sifflet', ['f']), foule: o => controle(o, 'foule', []),
  accord: o => { controle(o, 'accord', []); if (!o || !Array.isArray(o.notes) || !o.notes.length) ko(`${courant} : accord sans notes`); else { o.notes.forEach(n => nombre(n, 'note', 20, 18000)); if (typeof o.gain === 'number') o.notes.slice(1).forEach((n, i) => couches.push({ r: (o.retard || 0) + (i + 1) * (o.ecart || 0), g: o.gain * facteur })); } },
  moteur: () => ({ regler() {}, arreter() {} }),
};
const S2 = new Proxy(S, { get: (t, k) => { if (k in t) return t[k]; ko(`${courant} : primitive inconnue S.${String(k)}`); return () => {}; } });

const cles = SONS ? Object.keys(SONS) : [];
for (const k of cles) {
  if (typeof SONS[k] !== 'function') { ko(`SONS.${k} n'est pas une fonction`); continue; }
  const args = [undefined].concat((DEMO || []).filter(d => d && d.k === k && d.arg !== undefined).map(d => d.arg));
  for (const a of args) {
    courant = `${k}(${a === undefined ? '' : JSON.stringify(a)})`; couches = []; appels = 0; facteur = 1;
    try { SONS[k](S2, a); } catch (e) { ko(`${courant} : exception ${e.message}`); continue; }
    if (!appels) ko(`${courant} : aucun son produit`);
    else { const c = crete(); if (c < 0.02) ko(`${courant} : trop faible (crêtes superposées ${c.toFixed(3)})`); else if (c > 1.4) ko(`${courant} : trop fort (crêtes superposées ${c.toFixed(2)})`); }
  }
}
const demoCles = new Set((DEMO || []).map(d => d && d.k));
for (const k of cles) if (!demoCles.has(k)) ko(`DEMO ne contient pas « ${k} »`);
for (const d of DEMO || []) { if (!d || !cles.includes(d.k)) ko(`DEMO cite une clé absente de SONS : ${d && d.k}`); else if (!d.nom) ko(`DEMO ${d.k} sans nom affiché`); }
if (MOTEUR !== undefined && (typeof MOTEUR !== 'object' || !(MOTEUR.ralenti > 0 && MOTEUR.max > MOTEUR.ralenti))) ko('MOTEUR : preset incohérent (ralenti / max)');

const client = readFileSync(join(ROOT, 'public', 'games', id, 'client.js'), 'utf8');
const litteraux = new Set(); for (const m of client.matchAll(/\bp?sound\(\s*'([A-Za-z0-9_]+)'/g)) litteraux.add(m[1]);
for (const k of litteraux) if (!cles.includes(k)) ko(`client.js déclenche « ${k} », absent de SONS`);
if (/createOscillator|createBufferSource|\btone\(|\bnoise\(|\bglide\(|\bsweep\(/.test(client.replace(/\/\/.*$/gm, ''))) ko('client.js contient encore de la synthèse brute (createOscillator / createBufferSource / tone( / noise( / glide( / sweep()');
if (!/from '\.\/sons\.js'/.test(client) || !/creerSfx/.test(client)) ko('client.js n\'importe pas ./sons.js et creerSfx');

console.log(`${id} : ${cles.length} sons, ${(DEMO || []).length} démos, ${litteraux.size} déclencheurs littéraux dans client.js`);
if (defauts.length) { defauts.slice(0, 40).forEach(d => console.log('  ✗ ' + d)); if (defauts.length > 40) console.log(`  … ${defauts.length - 40} autres`); process.exit(1); }
console.log('  ✓ aucun défaut');
