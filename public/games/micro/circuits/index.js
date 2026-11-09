// TOUTES les définitions des circuits de Micro Machines, enregistrées à l'import : pour le serveur, la galerie
// /circuits.html et les outils. Le navigateur en partie n'importe PAS ce fichier (cf. ./fiches.js et client.js).
// Ajouter un circuit = créer ./<id>.js (export default de sa définition), l'importer ici, ajouter sa fiche à ./fiches.js
// (même ordre), et le faire passer outils/verifier-circuits.mjs (qui fait partie de npm test).
import { enregistrerCircuit } from '../shared.js';
import dejeuner from './dejeuner.js';
import bureau from './bureau.js';
import billard from './billard.js';
import piste from './piste.js';
import etabli from './etabli.js';
import plateau from './plateau.js';
import huit from './huit.js';
import jardin from './jardin.js';
import bain from './bain.js';
import chambre from './chambre.js';
import chantier from './chantier.js';
import noel from './noel.js';

const TOUS = [dejeuner, bureau, billard, piste, etabli, plateau, huit, jardin, bain, chambre, chantier, noel];
for (const d of TOUS) enregistrerCircuit(d);
export default TOUS;
