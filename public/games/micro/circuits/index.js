// Liste ordonnée des circuits de Micro Machines (l'ordre est celui du bouton « Circuit » du lobby).
// Ajouter un circuit = créer ./<id>.js (export default de sa définition) et l'importer ici.
// En attente (emplacements provisoires, pas encore dessinés — ne pas les inscrire avant qu'ils passent
// outils/verifier-circuits.mjs) : bain, chambre, chantier, noel.
import dejeuner from './dejeuner.js';
import bureau from './bureau.js';
import billard from './billard.js';
import piste from './piste.js';
import etabli from './etabli.js';
import plateau from './plateau.js';
import huit from './huit.js';
import jardin from './jardin.js';

export default [dejeuner, bureau, billard, piste, etabli, plateau, huit, jardin];
