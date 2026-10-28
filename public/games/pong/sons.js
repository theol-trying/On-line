// BRUITAGES DE PONG — « arcade néon · duel de raquettes » (recettes pour la boîte partagée public/sfx.js).
// Synthwave d'arcade : sons propres, ronds et lumineux (onde 'doux', FM légère, cordes brillantes) dans une salle
// de néon carrelée, réverbérante mais courte. Le renvoi suit une gamme pentatonique de La mineur (la tonalité de la
// musique) et monte avec la vitesse de l'échange ; la mort est la décharge d'un tube néon, l'élimination son éclatement.
// Module pur, sans import : client.js et /sons.html l'importent tous les deux.

// Acoustique : petite salle d'arcade, surfaces dures (clarté haute), queue courte pour ne pas noyer les échanges rapides.
export const SALLE = { duree: 0.75, mix: 0.2, clarte: 0.65 };
export const NIVEAU = 1;

// Renvoi : Mi4 → La5 en pentatonique de La mineur (Mi Sol La Do Ré Mi Sol La) ; l'échange « joue » avec la musique.
const GAMME = [329.6, 392, 440, 523.3, 587.3, 659.3, 784, 880];
let coup = 0, plot = 0, bonus = 0;                      // alternances (transitoire du renvoi, hauteur des plots, voicing des bonus)

const borne = (x, a, b) => Math.max(a, Math.min(b, x));
const nombre = x => typeof x === 'number' && isFinite(x);

// Crépitement d'un tube néon : n claquements de bruit très courts, en grappes irrégulières (arc électrique).
function crepite(S, n, t0, etendue, gain) {
  let t = t0;
  for (let i = 0; i < n; i++) {
    S.bruit({ dur: 0.01 + Math.random() * 0.018, gain: gain * (0.6 + Math.random() * 0.4), couleur: 'blanc', filtre: { type: 'bandpass', f: 1800 + Math.random() * 3400, q: 1.1 }, attaque: 0.001, retard: t, reverb: 0.4, varie: 0.2 });
    t += Math.random() < 0.35 ? 0.008 + Math.random() * 0.012 : Math.random() * etendue / n * 1.6;   // parfois deux claquements collés
  }
}

// Élimination : le tube vole en éclats — claquement grave, éclatement du verre, tintements FM inharmoniques, débris qui
// retombent de plus en plus espacés, et la lumière qui s'éteint en vacillant.
function eclats(S) {
  S.choc({ f: 115, f2: 32, dur: 0.7, gain: 0.34, clic: 0.7, fClic: 3200, reverb: 0.5 });                                   // le tube claque (poussée grave)
  S.bruit({ dur: 0.32, gain: 0.15, couleur: 'blanc', filtre: { type: 'highpass', f: 2600, f2: 5200 }, attaque: 0.001, reverb: 0.6 });   // éclatement du verre
  const V = [2210, 2870, 3530, 4180];
  for (let i = 0; i < V.length; i++) S.fm({ f: S.varier(V[i], 0.06), ratio: 1.41 + i * 0.37, indice: 2.2, dur: 0.25 + Math.random() * 0.35, gain: 0.045, retard: i * 0.022 + Math.random() * 0.03, reverb: 0.7 });   // verre qui tinte
  for (let i = 0; i < 5; i++) {
    const u = (i + Math.random() * 0.6) / 5;
    S.bruit({ dur: 0.012 + Math.random() * 0.03, gain: 0.04 + Math.random() * 0.03, couleur: 'blanc', filtre: { type: 'bandpass', f: 2500 + Math.random() * 5000, q: 2.5 }, attaque: 0.001, retard: 0.1 + Math.pow(u, 1.4) * 0.55, reverb: 0.6, varie: 0.2 });   // débris au sol
  }
  S.ton({ f: 480, f2: 52, dur: 0.6, onde: 'doux', gain: 0.17, attaque: 0.004, vibrato: { f: 30, prof: 0.45 }, filtre: { type: 'lowpass', f: 2400, f2: 260 }, retard: 0.02, reverb: 0.5 });   // la lumière s'éteint
}

export const SONS = {
  // Renvoi de raquette (arg 0..1 = vitesse de l'échange) : « pok » rond qui monte dans la gamme, sans devenir strident
  // (passe-bas qui s'ouvre avec la vitesse) ; un éclat FM s'ajoute quand l'échange s'emballe.
  hit: (S, k) => {
    if (!S.limite('hit', 40)) return;                     // multi-balles : plusieurs renvois dans le même tick
    k = nombre(k) ? borne(k, 0, 1) : 0;
    const f = GAMME[Math.round(k * (GAMME.length - 1))];
    coup = 1 - coup;
    S.ton({ f: f * 1.06, f2: f, glisse: 0.15, dur: 0.17, onde: 'doux', gain: 0.21 - 0.04 * k, attaque: 0.002, filtre: { type: 'lowpass', f: 2200 + 1600 * k, q: 0.7 }, reverb: 0.3, varie: 0.03 });   // corps
    S.ton({ f: f * 0.5, f2: f * 0.36, dur: 0.09, onde: 'sine', gain: 0.09, attaque: 0.002, reverb: 0.1, varie: 0.03 });   // poids (sous-octave qui plonge)
    S.ton({ f: f * (coup ? 3 : 4), f2: f * 1.5, dur: 0.025, onde: 'sine', gain: 0.045, attaque: 0.001, reverb: 0.2 });     // contact balle / raquette
    if (k > 0.5) S.fm({ f: f * 2, ratio: 2, indice: 0.9, dur: 0.14, gain: 0.035 * k, reverb: 0.45 });                    // éclat quand ça va vite
  },

  // Vie perdue : décharge d'un tube néon — la lumière plonge en vacillant, bourdon 100 Hz du secteur qui s'éteint,
  // claquement du tube et crépitement d'arc électrique. arg vrai = élimination : le tube vole en éclats.
  death: (S, elim) => {
    if (elim) { eclats(S); return; }
    S.ton({ f: 620, f2: 75, dur: 0.5, onde: 'doux', gain: 0.24, attaque: 0.003, vibrato: { f: 24, prof: 0.4 }, filtre: { type: 'lowpass', f: 3000, f2: 380, q: 1.2 }, reverb: 0.5 });
    S.ton({ f: 100, f2: 58, dur: 0.42, onde: 'creux', gain: 0.12, attaque: 0.004, filtre: { type: 'lowpass', f: 900, f2: 200 }, reverb: 0.2 });
    S.choc({ f: 140, f2: 45, dur: 0.22, gain: 0.24, clic: 0.5, fClic: 2600, reverb: 0.4 });
    crepite(S, 6, 0.02, 0.3, 0.11);
  },

  // Bouclier : la balle rebondit sur un champ de force — « vwoum » qui monte en ondulant, anneau FM, grésillement du champ.
  shield: (S) => {
    if (!S.limite('shield', 70)) return;
    S.ton({ f: 392, f2: 784, glisse: 0.35, dur: 0.26, onde: 'doux', gain: 0.16, attaque: 0.003, vibrato: { f: 14, prof: 0.25 }, reverb: 0.5 });
    S.fm({ f: 1568, ratio: 1.5, indice: 1.4, dur: 0.45, gain: 0.05, retard: 0.01, reverb: 0.6 });
    S.souffle({ dur: 0.2, f1: 1800, f2: 5200, gain: 0.14, q: 2, reverb: 0.4 });
    S.ton({ f: 220, f2: 120, dur: 0.07, onde: 'sine', gain: 0.08, attaque: 0.002, reverb: 0.1 });                          // impact de la balle
  },

  // Bonus ramassé : arpège scintillant (Do majeur add9 / La majeur en alternance) sur un pincement de corde brillant,
  // puis quelques étincelles FM dans l'aigu.
  powerup: (S) => {
    if (!S.limite('powerup', 90)) return;
    bonus = 1 - bonus;
    const N = bonus ? [784, 1047, 1319, 1568] : [880, 1109, 1319, 1760];
    S.corde({ f: N[0] / 2, dur: 0.6, gain: 0.12, clarte: 0.85, reverb: 0.4 });
    S.accord({ notes: N, ecart: 0.045, dur: 0.24, onde: 'doux', gain: 0.075, attaque: 0.003, reverb: 0.5 });
    S.fm({ f: N[3] * 2, ratio: 2, indice: 0.7, dur: 0.4, gain: 0.025, retard: 0.15, reverb: 0.8 });
    for (let i = 0; i < 3; i++) S.fm({ f: 2600 + Math.random() * 1600, ratio: 3.01, indice: 0.5, dur: 0.12, gain: 0.02, retard: 0.12 + i * 0.06 + Math.random() * 0.03, reverb: 0.8, varie: 0.1 });
  },

  // Malus ramassé : « bzzt » grave et feutré — deux ondes creuses à un demi-ton qui battent, passe-bas fermé, petit
  // « wah » qui retombe et grésillement sourd.
  bad: (S) => {
    if (!S.limite('bad', 90)) return;
    S.ton({ f: 110, f2: 92, dur: 0.34, onde: 'creux', gain: 0.17, attaque: 0.006, vibrato: { f: 33, prof: 0.35 }, filtre: { type: 'lowpass', f: 750, f2: 380, q: 3 }, reverb: 0.25 });
    S.ton({ f: 116.5, f2: 97, dur: 0.3, onde: 'creux', gain: 0.12, attaque: 0.008, filtre: { type: 'lowpass', f: 650, f2: 320, q: 2 }, retard: 0.012, reverb: 0.25 });
    S.ton({ f: 233, f2: 175, dur: 0.22, onde: 'doux', gain: 0.07, attaque: 0.004, reverb: 0.3 });
    S.bruit({ dur: 0.18, gain: 0.08, couleur: 'brun', filtre: { type: 'lowpass', f: 600 }, attaque: 0.004, reverb: 0.2 });
  },

  // Balle fantôme qui traverse une raquette : souffle qui descend, deux voix légèrement désaccordées qui glissent (spectral).
  ghost: (S) => {
    if (!S.limite('ghost', 80)) return;
    S.souffle({ dur: 0.38, f1: 2800, f2: 450, gain: 0.26, q: 1.6, reverb: 0.7 });
    S.ton({ f: 880, f2: 330, dur: 0.36, onde: 'doux', gain: 0.1, attaque: 0.02, vibrato: { f: 5.5, prof: 0.35 }, reverb: 0.85 });
    S.ton({ f: 886, f2: 333, dur: 0.36, onde: 'sine', gain: 0.06, attaque: 0.03, det: 14, retard: 0.02, reverb: 0.85 });
  },

  // Plot rebondissant (bumper) : « boing » élastique qui plonge, tintement métallique du plot, choc sec. Trois hauteurs
  // en alternance pour qu'une série de rebonds sur les plots ne martèle pas la même note.
  bump: (S) => {
    if (!S.limite('bump', 50)) return;
    plot = (plot + 1) % 3;
    const f = [587, 659, 523][plot];
    S.ton({ f: f * 1.5, f2: f * 0.5, glisse: 0.7, dur: 0.2, onde: 'doux', gain: 0.2, attaque: 0.002, vibrato: { f: 18, prof: 0.4 }, reverb: 0.4 });
    S.fm({ f: f * 2, ratio: 2.76, indice: 1.6, dur: 0.3, gain: 0.04, reverb: 0.6 });
    S.choc({ f: 170, f2: 70, dur: 0.1, gain: 0.16, clic: 0.35, fClic: 2400, reverb: 0.3 });
  },

  // Relance sur un mur : « zap » qui monte (le filtre s'ouvre avec), souffle d'accélération et petit coup sourd.
  wallboost: (S) => {
    if (!S.limite('wallboost', 60)) return;
    S.ton({ f: 196, f2: 1175, glisse: 0.75, dur: 0.2, onde: 'doux', gain: 0.17, attaque: 0.004, filtre: { type: 'lowpass', f: 1400, f2: 5200, q: 2 }, reverb: 0.4 });
    S.ton({ f: 294, f2: 1760, glisse: 0.75, dur: 0.18, onde: 'sine', gain: 0.05, attaque: 0.006, retard: 0.01, reverb: 0.5 });
    S.souffle({ dur: 0.2, f1: 700, f2: 5000, gain: 0.2, q: 1.2, reverb: 0.4 });
    S.ton({ f: 110, f2: 60, dur: 0.09, onde: 'sine', gain: 0.12, attaque: 0.002, reverb: 0.1 });
  },

  // Décompte 3·2·1 (et tic des 10 dernières secondes) : bip de borne d'arcade adouci, La5 rond avec son octave grave.
  count: (S) => {
    if (!S.limite('count', 150)) return;
    S.ton({ f: 880, dur: 0.22, onde: 'doux', gain: 0.13, attaque: 0.003, reverb: 0.35, varie: 0.01 });
    S.ton({ f: 440, dur: 0.12, onde: 'sine', gain: 0.04, attaque: 0.003, reverb: 0.2, varie: 0.01 });
    S.ton({ f: 1760, dur: 0.06, onde: 'sine', gain: 0.025, attaque: 0.002, reverb: 0.3, varie: 0.01 });
  },

  // GO : le même bip, plus long et ouvert (La + Mi + La aigu), poussé par un souffle lumineux.
  go: (S) => {
    S.ton({ f: 880, dur: 0.6, onde: 'doux', gain: 0.13, attaque: 0.004, reverb: 0.5, varie: 0.01 });
    S.ton({ f: 1318.5, dur: 0.55, onde: 'doux', gain: 0.07, attaque: 0.008, retard: 0.02, reverb: 0.55, varie: 0.01 });
    S.ton({ f: 1760, dur: 0.45, onde: 'sine', gain: 0.035, attaque: 0.01, retard: 0.03, reverb: 0.6, varie: 0.01 });
    S.ton({ f: 440, dur: 0.3, onde: 'sine', gain: 0.06, attaque: 0.004, reverb: 0.3, varie: 0.01 });
    S.souffle({ dur: 0.35, f1: 1200, f2: 6500, gain: 0.14, q: 1, reverb: 0.5 });
  },

  // Victoire : arpège de La majeur qui grimpe, puis accord final frappé façon années 80 (grosse caisse + caisse claire
  // noyée dans la salle), corde brillante, cloche FM et scintillement.
  win: (S) => {
    S.accord({ notes: [440, 554.4, 659.3, 880], ecart: 0.11, dur: 0.35, onde: 'doux', gain: 0.12, attaque: 0.004, reverb: 0.45 });
    S.corde({ f: 880, dur: 1.2, gain: 0.14, clarte: 0.9, retard: 0.33, reverb: 0.5 });
    S.accord({ notes: [440, 659.3, 880, 1108.7], dur: 1.1, onde: 'doux', gain: 0.08, attaque: 0.01, retard: 0.44, reverb: 0.6 });
    S.membrane({ f: 70, dur: 0.5, gain: 0.26, retard: 0.44, reverb: 0.4 });
    S.bruit({ dur: 0.22, gain: 0.2, couleur: 'blanc', filtre: { type: 'bandpass', f: 2200, q: 0.6 }, attaque: 0.001, retard: 0.44, reverb: 0.95 });
    S.fm({ f: 1760, ratio: 2, indice: 1.2, dur: 1.2, gain: 0.05, retard: 0.44, reverb: 0.7 });
    S.souffle({ dur: 0.9, f1: 3000, f2: 8000, gain: 0.12, q: 1.2, retard: 0.4, reverb: 0.8 });
  },
};

export const DEMO = [
  { k: 'hit', arg: 0, nom: 'Renvoi — échange lent' },
  { k: 'hit', arg: 0.5, nom: 'Renvoi — échange vif' },
  { k: 'hit', arg: 1, nom: 'Renvoi — échange à pleine vitesse' },
  { k: 'bump', nom: 'Plot rebondissant (bumper)' },
  { k: 'wallboost', nom: 'Relance sur un mur' },
  { k: 'shield', nom: 'Bouclier qui renvoie la balle' },
  { k: 'ghost', nom: 'Balle fantôme qui traverse' },
  { k: 'powerup', nom: 'Bonus ramassé' },
  { k: 'bad', nom: 'Malus ramassé' },
  { k: 'death', arg: false, nom: 'Vie perdue — le néon se décharge' },
  { k: 'death', arg: true, nom: 'Élimination — le tube vole en éclats' },
  { k: 'count', nom: 'Décompte 3·2·1 (et tic des 10 dernières secondes)' },
  { k: 'go', nom: 'Départ — GO !' },
  { k: 'win', nom: 'Victoire — fin de manche' },
];

// Calage des niveaux après mesure sur /sons.html (29/10 : RMS sur 300 ms, plein spectre et haut-parleur de téléphone) :
// décomptes et petits sons fréquents relevés pour passer au-dessus de la musique.
function caler(T, f) { Object.keys(f).forEach(function (k) { const r = T[k], x = f[k]; T[k] = function (S, a) { S.plus(typeof x === 'function' ? x(a) : x, function () { r(S, a); }); }; }); }
caler(SONS, { hit: 1.4, count: 2 });
