// Bruitages de SNAKE — « Jardin · serpents gourmands » : organique, doux, boisé. Recettes jouées par la boîte partagée
// public/sfx.js (module pur, aucun import) ; elles s'écoutent toutes sur /sons.html.
// Palette : marimba (lame de bois = corde Karplus-Strong très amortie + tube résonateur sinusoïdal + partiel ×4 de la lame
// accordée), blocs de bois au décompte, croc juteux (bruits blancs très brefs + goutte de jus), sol meuble (chocs graves
// étouffés, presque sans claquement) et feuillage froissé (bruit aigu + brindilles qui craquent au hasard).
// Gamme : pentatonique de do, celle de la musique du jardin (root 130,81 Hz) — les notes des bruitages ne jurent jamais avec elle.
// Niveaux visés (crête en sortie) : croc / décompte -24 à -18 dB ; nourritures spéciales, chute d'un autre, départ -18 à -12 ;
// ma chute et la victoire -12 à -6.

// Plein air : pas de murs, juste un peu d'air feutré autour du son (queue courte, très peu mélangée, sombre : herbe et haies absorbent).
export const SALLE = { duree: 0.6, mix: 0.08, clarte: 0.28 };
export const NIVEAU = 1;

const fini = x => typeof x === 'number' && isFinite(x);
const hasard = (a, b) => a + Math.random() * (b - a);
const PENTA = [523.25, 587.33, 659.26, 783.99, 880, 1046.5];   // do5 ré5 mi5 sol5 la5 do6 : note de marimba de chaque pomme
const BLOCS = [1046.5, 880, 783.99];                           // décompte 1 / 2 / 3 : le bloc monte d'un cran à chaque seconde
let dernierCroc = -1;                                          // note de la pomme précédente : jamais deux fois la même d'affilée

// Karplus-Strong sonne un peu bas (le filtre moyenneur ajoute une demi-période) : on vise un poil plus haut (calé sur 48 kHz).
const kz = f => f * (1 + f / 96000);

// Lame de marimba : bois frappé (corde très amortie : « tok » chaud) + tube résonateur (sinus qui tient la note) + partiel ×4
// bref (la lame accordée du marimba). varie très faible : les notes restent justes avec la musique, la variété vient du choix des notes.
function lame(S, f, g, r, dur, clarte) {
  const d = dur || 0.6;
  S.corde({ f: kz(f), dur: d, gain: g, clarte: clarte == null ? 0.3 : clarte, retard: r || 0, varie: 0.015, reverb: 0.45 });   // bois frappé
  S.ton({ f: f, dur: d * 0.85, onde: 'sine', gain: g * 0.45, attaque: 0.003, retard: r || 0, varie: 0.01, reverb: 0.45 });      // tube résonateur
  S.ton({ f: f * 4, dur: Math.max(0.03, d * 0.14), onde: 'sine', gain: g * 0.12, attaque: 0.001, retard: r || 0, varie: 0.01, reverb: 0.25 });   // partiel ×4
}

// Croc juteux : la peau qui cède (claquement aigu), la chair croquante (2e grain, quelques ms après), le jus (souffle mouillé
// qui s'assourdit) et une goutte « plip » qui remonte. Fréquences tirées à chaque fois : deux bouchées ne sonnent jamais pareil.
function croc(S, g, r) {
  r = r || 0;
  S.bruit({ dur: 0.028, gain: g, couleur: 'blanc', filtre: { type: 'bandpass', f: hasard(2300, 3100), q: 1.2 }, attaque: 0.001, retard: r, reverb: 0.15, varie: 0.15 });   // peau
  S.bruit({ dur: 0.04, gain: g * 0.65, couleur: 'blanc', filtre: { type: 'bandpass', f: hasard(3400, 4600), q: 1.6 }, attaque: 0.001, retard: r + hasard(0.018, 0.03), reverb: 0.15, varie: 0.15 });   // chair croquante
  S.bruit({ dur: 0.09, gain: g * 0.5, couleur: 'rose', filtre: { type: 'lowpass', f: 3200, f2: 600 }, attaque: 0.006, retard: r + 0.025, reverb: 0.2, varie: 0.15 });   // jus
  S.ton({ f: hasard(1000, 1250), f2: hasard(1900, 2300), glisse: 0.5, dur: 0.045, onde: 'sine', gain: g * 0.18, attaque: 0.002, retard: r + 0.04, reverb: 0.2 });   // goutte
}

// Chute dans la pelouse : sous-grave étouffé (le serpent s'écrase dans la haie / la terre), terre tassée (bruit brun sourd), puis
// feuillage froissé et brindilles qui craquent au hasard (nombre, hauteur et instants tirés : jamais deux fois la même chute).
function chute(S, g) {
  S.choc({ f: hasard(100, 125), f2: 42, dur: 0.3, gain: 0.3 * g, clic: 0.2, fClic: 700, reverb: 0.3, varie: 0.08 });   // corps : sourd, presque sans claquement
  S.bruit({ dur: 0.16, gain: 0.26 * g, couleur: 'brun', filtre: { type: 'lowpass', f: 520, f2: 160 }, attaque: 0.003, reverb: 0.25, varie: 0.1 });   // terre tassée
  S.bruit({ dur: 0.42, gain: 0.1 * g, couleur: 'blanc', filtre: { type: 'bandpass', f: 4000, f2: 2400, q: 0.8 }, attaque: 0.02, retard: 0.02, reverb: 0.45, varie: 0.15 });   // feuillage froissé
  const n = 3 + Math.floor(Math.random() * 3);
  for (let i = 0; i < n; i++) S.bruit({ dur: hasard(0.012, 0.03), gain: hasard(0.025, 0.045) * g, couleur: 'blanc', filtre: { type: 'bandpass', f: hasard(2500, 6000), q: 2.5 }, attaque: 0.001, retard: hasard(0.03, 0.32), reverb: 0.35, varie: 0.2 });   // brindilles
}

export const SONS = {
  // pomme ordinaire (la mienne seulement, une toutes les deux secondes) : croc juteux + une lame de marimba tirée dans la
  // gamme pentatonique (arg = indice de note pour la page d'écoute ; sinon au hasard, jamais deux fois la même d'affilée)
  eat: (S, arg) => {
    if (!S.limite('eat', 50)) return;
    let i;
    if (fini(arg)) i = Math.max(0, Math.min(PENTA.length - 1, arg | 0));
    else { i = Math.floor(Math.random() * 5); if (i === dernierCroc) i = (i + 1 + Math.floor(Math.random() * 3)) % 5; }
    dernierCroc = i;
    croc(S, 0.2);
    lame(S, PENTA[i], 0.11, 0.012, 0.45, 0.28);
  },
  // pomme dorée (+3) : le même croc, puis une montée de marimba (mi sol do mi) et une clochette de verre qui reste en l'air,
  // un scintillement d'aigus par-dessus — la récompense, sans fanfare cuivrée
  gold: S => {
    if (!S.limite('gold', 120)) return;
    croc(S, 0.15);
    const n = [659.26, 783.99, 1046.5, 1318.5];
    for (let i = 0; i < n.length; i++) lame(S, n[i], 0.085, 0.03 + i * 0.065, 0.55, 0.38);
    S.fm({ f: [2093, 2349.3, 2637][Math.floor(Math.random() * 3)], ratio: 3.5, indice: 0.9, dur: 1.1, gain: 0.03, retard: 0.24, reverb: 0.6, varie: 0.01 });   // clochette
    S.bruit({ dur: 0.5, gain: 0.04, couleur: 'blanc', filtre: { type: 'highpass', f: 6500 }, attaque: 0.12, retard: 0.08, reverb: 0.5 });   // scintillement
  },
  // champignon (raccourcit) : « bloup » mou qui plonge (le chapeau qu'on mord), pouf de spores (souffle qui retombe vite),
  // et deux lames de marimba qui DESCENDENT (sol → ré) : on rapetisse
  shrink: S => {
    if (!S.limite('shrink', 120)) return;
    S.ton({ f: hasard(520, 600), f2: 150, glisse: 0.8, dur: 0.24, onde: 'sine', gain: 0.13, attaque: 0.006, reverb: 0.3 });   // bloup
    S.bruit({ dur: 0.36, gain: 0.22, couleur: 'rose', filtre: { type: 'bandpass', f: 1700, f2: 320, q: 0.9 }, attaque: 0.015, retard: 0.03, reverb: 0.5, varie: 0.12 });   // pouf de spores
    lame(S, 392, 0.08, 0.07, 0.4, 0.25);
    lame(S, 293.66, 0.08, 0.17, 0.5, 0.25);
  },
  // fantôme (traverse les corps 5 s) : « ouuuh » soufflé comme dans un goulot de bouteille (sinus qui monte avec vibrato,
  // doublé un peu désaccordé), souffle d'air qui passe dans les feuilles, et un carillon de verre lointain
  ghost: S => {
    if (!S.limite('ghost', 150)) return;
    const v = { f: 5.5, prof: 0.35 };
    S.ton({ f: 330, f2: 620, glisse: 0.55, dur: 1, onde: 'sine', gain: 0.11, attaque: 0.16, vibrato: v, reverb: 0.7, varie: 0.02 });   // voix du fantôme
    S.ton({ f: 330, f2: 620, glisse: 0.55, dur: 0.9, onde: 'doux', gain: 0.04, attaque: 0.2, vibrato: v, det: 14, reverb: 0.7, varie: 0.02 });   // doublure
    S.souffle({ dur: 0.7, f1: 500, f2: 1700, gain: 0.2, q: 1.1, reverb: 0.6 });   // air qui passe
    S.fm({ f: 1318.5, ratio: 2.76, indice: 0.7, dur: 1, gain: 0.03, retard: 0.22, reverb: 0.8, varie: 0.01 });     // carillon de verre
    S.fm({ f: 1975.5, ratio: 2.76, indice: 0.6, dur: 0.9, gain: 0.02, retard: 0.34, reverb: 0.8, varie: 0.01 });
  },
  // un autre serpent s'écrase : chute mate dans la pelouse (le 'kill' de la musique joue sa petite phrase par-dessus) ;
  // plusieurs morts dans le même tick ne s'empilent pas
  crash: S => {
    if (!S.limite('crash', 70)) return;
    chute(S, 1);
  },
  // MON serpent : même chute, plus lourde (le sol résonne : membrane grave, comme une bûche creuse), plus de feuillage,
  // et un « ouf » qui se dégonfle (onde douce qui descend) — net, sans rien de strident
  crashMe: S => {
    chute(S, 1.1);
    S.membrane({ f: 58, dur: 0.7, gain: 0.22, clic: 0.25, reverb: 0.4 });   // bûche creuse
    S.ton({ f: 280, f2: 95, dur: 0.6, onde: 'doux', gain: 0.07, attaque: 0.02, retard: 0.05, reverb: 0.4 });   // « ouf »
    S.bruit({ dur: 0.6, gain: 0.06, couleur: 'blanc', filtre: { type: 'bandpass', f: 3000, f2: 1600, q: 0.8 }, attaque: 0.05, retard: 0.12, reverb: 0.5, varie: 0.2 });   // la haie qui retombe
  },
  // décompte (arg = 3, 2, 1) : bloc de bois — cavité courte et sèche, partiel inharmonique du bois, claquement de baguette,
  // grain du bois ; il monte d'un cran à chaque seconde (sol, la, do)
  count: (S, arg) => {
    const n = fini(arg) ? Math.max(1, Math.min(3, Math.round(arg))) : 3, f = BLOCS[n - 1];
    S.ton({ f: f, f2: f * 0.96, dur: 0.09, onde: 'sine', gain: 0.14, attaque: 0.001, reverb: 0.35, varie: 0.01 });   // cavité du bloc
    S.ton({ f: f * 2.63, dur: 0.03, onde: 'sine', gain: 0.035, attaque: 0.001, reverb: 0.2, varie: 0.01 });          // partiel du bois
    S.bruit({ dur: 0.012, gain: 0.2, couleur: 'blanc', filtre: { type: 'bandpass', f: 2800, q: 1.5 }, attaque: 0.001, reverb: 0.2 });   // baguette
    S.corde({ f: kz(f), dur: 0.12, gain: 0.05, clarte: 0.1, reverb: 0.3, varie: 0.01 });   // grain du bois
  },
  // partez ! : accord de marimba (do sol do, frappé presque ensemble comme deux baguettes) et le sifflement du serpent qui s'élance
  go: S => {
    lame(S, 523.25, 0.11, 0, 0.7, 0.4);
    lame(S, 783.99, 0.09, 0.008, 0.7, 0.4);
    lame(S, 1046.5, 0.07, 0.016, 0.6, 0.4);
    S.bruit({ dur: 0.5, gain: 0.09, couleur: 'blanc', filtre: { type: 'bandpass', f: 5200, f2: 6400, q: 0.8 }, attaque: 0.06, retard: 0.08, reverb: 0.3 });   // « ssss »
  },
  // victoire : phrase de marimba calée sur la fanfare de la musique (accords do → fa → sol → do toutes les 0,14 s : mi, la, si),
  // accord final do-mi-sol avec un « boum » de calebasse, puis le merle du jardin répond au loin (trois gazouillis)
  win: S => {
    if (!S.limite('win', 800)) return;
    const mel = [659.26, 880, 987.77];
    for (let i = 0; i < mel.length; i++) lame(S, mel[i], 0.1, i * 0.14, 0.5, 0.35);
    const fin = [523.25, 659.26, 1046.5];
    for (let i = 0; i < fin.length; i++) lame(S, fin[i], 0.13, 0.42 + i * 0.012, 1.1, 0.5);
    S.membrane({ f: 98, dur: 0.6, gain: 0.14, clic: 0.2, retard: 0.42, reverb: 0.4 });   // calebasse
    const merle = [[2300, 3200], [2600, 3500], [3100, 2400]];
    for (let i = 0; i < merle.length; i++) S.ton({ f: merle[i][0], f2: merle[i][1], glisse: 0.7, dur: 0.075, onde: 'sine', gain: 0.025, attaque: 0.008, vibrato: { f: 28, prof: 0.4 }, retard: 0.95 + i * 0.1, reverb: 0.7 });
  },
};

// Page d'écoute (/sons.html) : toutes les clés, plus les variantes d'arg utiles.
export const DEMO = [
  { k: 'eat', nom: 'Croquer une pomme (note au hasard)' },
  { k: 'eat', arg: 0, nom: 'Croquer une pomme — do' },
  { k: 'eat', arg: 2, nom: 'Croquer une pomme — mi' },
  { k: 'eat', arg: 4, nom: 'Croquer une pomme — la' },
  { k: 'gold', nom: 'Pomme dorée (+3)' },
  { k: 'shrink', nom: 'Champignon : le serpent raccourcit' },
  { k: 'ghost', nom: 'Fantôme : traverse les corps' },
  { k: 'crash', nom: 'Un autre serpent s\'écrase' },
  { k: 'crashMe', nom: 'Mon serpent s\'écrase' },
  { k: 'count', arg: 3, nom: 'Décompte : 3' },
  { k: 'count', arg: 2, nom: 'Décompte : 2' },
  { k: 'count', arg: 1, nom: 'Décompte : 1' },
  { k: 'go', nom: 'Partez !' },
  { k: 'win', nom: 'Victoire' },
];

// Calage des niveaux après mesure sur /sons.html (29/10 : RMS sur 300 ms, plein spectre et haut-parleur de téléphone) :
// décomptes et petits sons fréquents relevés pour passer au-dessus de la musique.
function caler(T, f) { Object.keys(f).forEach(function (k) { const r = T[k], x = f[k]; T[k] = function (S, a) { S.plus(typeof x === 'function' ? x(a) : x, function () { r(S, a); }); }; }); }
caler(SONS, { count: 2.5, eat: 1.3 });
