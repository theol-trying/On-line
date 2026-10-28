// BRUITAGES DE TRON — « Cyber-grid · light cycles » : électronique, froid, précis (zaps nets, cristal numérique).
// Recettes jouées par la boîte partagée public/sfx.js (S.ton, S.fm, S.bruit…) ; client.js n'appelle que SONS[clé](S, arg).
// Écoute de chaque son : /sons.html. Avant (≤ 27/10) : carrés et dents de scie bruts branchés sur la sortie.
// Les sons mélodiques (carillons, décompte, accords) restent sur mi / si (tonique et quinte de la musique, en mi mineur) :
// rien ne jure avec le morceau. Les éclats (cloches FM inharmoniques) sont volontairement hors gamme.

// Acoustique : grand hangar numérique, queue longue et BRILLANTE (le cristal y résonne, la grille y paraît immense).
export const SALLE = { duree: 1.6, mix: 0.2, clarte: 0.82 };
export const NIVEAU = 1;

const MI = [164.81, 329.63, 659.25, 1318.51, 2637.02];   // mi 3 → mi 7
const SI = [246.94, 493.88, 987.77, 1975.53, 3951.07];   // si 3 → si 7
let nLaser = 0;                                           // alternance des 3 hauteurs du trait laser (la barrière avance toutes les 2 s)

// Carillon numérique : cloche FM (rapport 3,5 = timbre de cloche tubulaire) + sinus pur une octave au-dessus (l'éclat).
function carillon(S, f, retard, gain) {
  S.fm({ f: f, ratio: 3.5, indice: 1.3, dur: 0.42, gain: gain, retard: retard, reverb: 0.6 });
  S.ton({ f: f * 2, dur: 0.2, onde: 'sine', gain: gain * 0.45, attaque: 0.002, retard: retard, reverb: 0.6 });
}

export const SONS = {
  // ── dérésolution (élimination d'une moto) : éclatement cristallin ──
  derez: (S) => {
    // deux crashs dans le même instantané (choc frontal) : le second n'ajoute que le cristal, pas un 2e impact sourd
    if (S.limite('derez', 90)) {
      S.choc({ f: 140, f2: 40, dur: 0.45, gain: 0.36, clic: 0.5, fClic: 3000, reverb: 0.4 });   // impact : la moto percute la paroi
      S.bruit({ dur: 0.8, gain: 0.2, couleur: 'blanc', filtre: { type: 'bandpass', f: 8000, f2: 900, q: 0.8 }, attaque: 0.003, reverb: 0.7 });   // poussière de données qui s'éteint
      S.ton({ f: 1200, f2: 80, dur: 0.55, onde: 'doux', gain: 0.08, attaque: 0.003, filtre: { type: 'lowpass', f: 5000, f2: 300 }, reverb: 0.5 });   // la forme qui s'effondre
    }
    // cloches FM INHARMONIQUES (rapports 1,41 · 2,76 · 3,17) : le verre numérique qui vole en éclats
    S.fm({ f: SI[2] * 1.6, ratio: 1.414, indice: 4, dur: 1.0, gain: 0.07, reverb: 0.8 });
    S.fm({ f: MI[3] * 1.8, ratio: 2.76, indice: 3, dur: 0.75, gain: 0.05, retard: 0.015, reverb: 0.8 });
    S.fm({ f: SI[3] * 1.7, ratio: 3.17, indice: 2.2, dur: 0.55, gain: 0.035, retard: 0.035, reverb: 0.8 });
    // éclats voxel qui retombent : pings brefs de plus en plus graves, irréguliers (jamais deux fois la même pluie)
    for (let i = 0; i < 7; i++) {
      S.fm({ f: (4200 - i * 350) * (0.85 + Math.random() * 0.3), ratio: 2.4 + Math.random() * 0.9, indice: 1.4, dur: 0.1 + Math.random() * 0.15,
        gain: 0.02 + Math.random() * 0.014, retard: 0.05 + i * 0.045 + Math.random() * 0.03, reverb: 0.75, varie: 0.15 });
    }
  },

  // ── ramassage d'un bonus : un timbre par bonus, toujours « carillon numérique » ──
  pickup: (S, arg) => {
    if (!S.limite('pickup' + arg, 80)) return;
    if (arg === 'speed') {                               // vitesse : fusée filtrée qui monte + tintement aigu
      S.ton({ f: 440, f2: 1760, glisse: 0.9, dur: 0.16, onde: 'doux', gain: 0.08, attaque: 0.004, filtre: { type: 'lowpass', f: 1500, f2: 7000, q: 2 }, reverb: 0.3 });
      S.souffle({ dur: 0.18, f1: 1200, f2: 6000, gain: 0.18, reverb: 0.3 });
      carillon(S, SI[3], 0.13, 0.06);
    } else if (arg === 'ghost') {                        // fantôme : deux sinus qui flottent et glissent d'un demi-ton + souffle spectral
      S.ton({ f: MI[2], f2: MI[2] * 0.944, dur: 0.6, onde: 'sine', gain: 0.08, attaque: 0.05, vibrato: { f: 5.5, prof: 0.3 }, reverb: 0.85 });
      S.ton({ f: SI[2], f2: SI[2] * 0.944, dur: 0.6, onde: 'sine', gain: 0.055, attaque: 0.06, det: 14, vibrato: { f: 4.3, prof: 0.3 }, reverb: 0.85 });
      S.souffle({ dur: 0.55, f1: 2600, f2: 900, gain: 0.16, q: 2, reverb: 0.8 });
    } else if (arg === 'cut') {                          // coupe : deux claquements de lame laser + la traînée qui se détache
      for (let i = 0; i < 2; i++) {
        S.bruit({ dur: 0.035, gain: 0.26, couleur: 'blanc', filtre: { type: 'bandpass', f: 5500 + i * 900, q: 2.2 }, attaque: 0.001, retard: i * 0.075, reverb: 0.4 });
        S.fm({ f: 3200 + i * 400, ratio: 3.5, indice: 1, dur: 0.07, gain: 0.03, retard: i * 0.075, reverb: 0.4 });
      }
      S.ton({ f: 1800, f2: 600, dur: 0.12, onde: 'sine', gain: 0.04, attaque: 0.003, retard: 0.08, reverb: 0.5 });
    } else if (arg === 'blink') {                        // téléport : aspiré (montée éclair) puis rematérialisé plus loin (descente + scintillement)
      S.ton({ f: 280, f2: 2800, dur: 0.11, onde: 'sine', gain: 0.1, attaque: 0.003, reverb: 0.4 });
      S.ton({ f: 2800, f2: 620, dur: 0.16, onde: 'sine', gain: 0.07, attaque: 0.003, retard: 0.1, reverb: 0.6 });
      S.bruit({ dur: 0.1, gain: 0.12, couleur: 'blanc', filtre: { type: 'highpass', f: 5000 }, attaque: 0.002, retard: 0.09, reverb: 0.5 });
      S.fm({ f: SI[3] * 1.19, ratio: 1.5, indice: 2, dur: 0.35, gain: 0.035, retard: 0.11, reverb: 0.7 });
    } else if (arg === 'breaker') {                      // casse-mur : charge électrique (filtre résonant qui s'ouvre) + blindage qui se verrouille
      S.ton({ f: 110, f2: 220, dur: 0.32, onde: 'creux', gain: 0.09, attaque: 0.01, filtre: { type: 'lowpass', f: 400, f2: 2400, q: 5 }, reverb: 0.4 });
      S.fm({ f: 440, ratio: 1.41, indice: 2.5, dur: 0.45, gain: 0.05, retard: 0.12, reverb: 0.6 });
      S.choc({ f: 180, f2: 90, dur: 0.12, gain: 0.12, clic: 0.4, fClic: 3000, retard: 0.12, reverb: 0.4 });
    } else if (arg === 'invert') {                       // inversion : aller-retour qui tangue (vibrato rapide) + battement trouble
      S.ton({ f: 880, f2: 330, dur: 0.24, onde: 'doux', gain: 0.11, attaque: 0.004, vibrato: { f: 13, prof: 0.7 }, filtre: { type: 'lowpass', f: 3000 }, reverb: 0.5 });
      S.ton({ f: 330, f2: 880, dur: 0.24, onde: 'doux', gain: 0.11, attaque: 0.004, retard: 0.2, vibrato: { f: 13, prof: 0.7 }, filtre: { type: 'lowpass', f: 3000 }, reverb: 0.6 });
      S.fm({ f: 622.25, ratio: 1.07, indice: 3, dur: 0.5, gain: 0.04, retard: 0.05, reverb: 0.6 });   // rapport presque 1 : la hauteur flotte
    } else {                                             // bonus inconnu : carillon à deux notes (mi → si)
      carillon(S, MI[3], 0, 0.07);
      carillon(S, SI[3], 0.07, 0.06);
    }
  },

  // ── casse-mur dépensé : une traînée vole en éclats (verre + données) ──
  break: (S) => {
    if (!S.limite('break', 60)) return;
    S.bruit({ dur: 0.05, gain: 0.3, couleur: 'blanc', filtre: { type: 'highpass', f: 2800 }, attaque: 0.001, reverb: 0.5 });   // fêlure : craquement sec
    S.choc({ f: 260, f2: 110, dur: 0.12, gain: 0.16, clic: 0.3, fClic: 4200, reverb: 0.4 });   // la paroi lumineuse qui cède
    S.bruit({ dur: 0.4, gain: 0.16, couleur: 'blanc', filtre: { type: 'bandpass', f: 6500, f2: 2800, q: 2.5 }, attaque: 0.004, retard: 0.02, reverb: 0.7 });   // pluie d'éclats
    for (let i = 0; i < 6; i++) {                        // tessons : cloches inharmoniques très brèves, hauteurs au hasard
      S.fm({ f: 2400 + Math.random() * 3600, ratio: 2.71 + Math.random() * 0.6, indice: 1.2, dur: 0.08 + Math.random() * 0.18,
        gain: 0.02 + Math.random() * 0.015, retard: 0.01 + i * 0.035 + Math.random() * 0.03, reverb: 0.7, varie: 0.15 });
    }
    S.fm({ f: 1200, ratio: 0.5, indice: 5, dur: 0.07, gain: 0.03, retard: 0.03, reverb: 0.3 });   // grésil de données
  },

  // ── la barrière laser avance d'un cran (toutes les 2 s en fin de manche) : trait brillant qui descend + bourdon ──
  laser: (S) => {
    if (!S.limite('laser', 400)) return;
    const k = [1, 0.89, 1.12][nLaser++ % 3];            // 3 hauteurs en alternance : la répétition ne lasse pas
    S.ton({ f: 3000 * k, f2: 700 * k, dur: 0.3, onde: 'sine', gain: 0.08, attaque: 0.002, reverb: 0.55 });   // le trait
    S.ton({ f: 1500 * k, f2: 350 * k, dur: 0.34, onde: 'doux', gain: 0.06, attaque: 0.002, filtre: { type: 'lowpass', f: 5000, f2: 900 }, reverb: 0.5 });   // son ombre à l'octave
    S.ton({ f: 82.41, f2: 73.42, dur: 0.6, onde: 'creux', gain: 0.12, attaque: 0.015, filtre: { type: 'lowpass', f: 1100, f2: 220, q: 3 }, vibrato: { f: 25, prof: 0.15 }, reverb: 0.3 });   // bourdon électrique (mi grave)
    S.bruit({ dur: 0.28, gain: 0.16, couleur: 'blanc', filtre: { type: 'bandpass', f: 3200, f2: 700, q: 1.2 }, attaque: 0.003, reverb: 0.4 });   // grésillement du champ
  },

  // ── ton boost (Maj / ⚡) : montée filtrée qui souffle ──
  boost: (S) => {
    if (!S.limite('boost', 220)) return;
    S.souffle({ dur: 0.5, f1: 350, f2: 4200, gain: 0.32, q: 1.1, reverb: 0.3 });   // l'air qui s'engouffre
    S.ton({ f: 110, f2: 440, glisse: 0.8, dur: 0.42, onde: 'creux', gain: 0.07, attaque: 0.03, filtre: { type: 'lowpass', f: 400, f2: 3800, q: 4 }, reverb: 0.25 });   // turbine : filtre résonant qui s'ouvre
    S.ton({ f: 220, f2: 880, glisse: 0.8, dur: 0.38, onde: 'doux', gain: 0.06, attaque: 0.03, det: 8, reverb: 0.25 });   // octave au-dessus, un peu désaccordée : largeur
    S.fm({ f: 1760, ratio: 2, indice: 1, dur: 0.1, gain: 0.025, reverb: 0.2 });   // déclic d'allumage
  },

  // ── décompte 3 · 2 · 1 : bip de cristal net ──
  count: (S) => {
    S.fm({ f: MI[3], ratio: 2, indice: 0.9, dur: 0.22, gain: 0.06, reverb: 0.45 });   // bip harmonique (rapport 2 : propre, pas de cloche)
    S.ton({ f: MI[2], dur: 0.16, onde: 'sine', gain: 0.08, attaque: 0.003, reverb: 0.4 });   // corps à l'octave basse
    S.bruit({ dur: 0.015, gain: 0.08, couleur: 'blanc', filtre: { type: 'highpass', f: 6000 }, attaque: 0.001, reverb: 0.2 });   // tic de commutation
  },

  // ── départ : la moto lumineuse s'élance + accord ouvert de mi ──
  go: (S) => {
    S.ton({ f: 165, f2: 1320, glisse: 0.7, dur: 0.32, onde: 'doux', gain: 0.09, attaque: 0.01, filtre: { type: 'lowpass', f: 900, f2: 7000, q: 2 }, reverb: 0.3 });
    S.souffle({ dur: 0.4, f1: 500, f2: 5000, gain: 0.2, reverb: 0.3 });
    S.accord({ notes: [MI[2], SI[2], MI[3]], ecart: 0.025, retard: 0.16, dur: 0.75, onde: 'doux', gain: 0.06, attaque: 0.006, reverb: 0.6 });
    S.fm({ f: MI[4], ratio: 2, indice: 1.2, dur: 0.6, gain: 0.03, retard: 0.17, reverb: 0.7 });   // scintillement
  },

  // ── fin de manche : arpège montant puis accord ouvert tenu, assise grave et cristal dans le hangar ──
  win: (S) => {
    S.accord({ notes: [MI[1], SI[1], MI[2], SI[2]], ecart: 0.11, dur: 0.45, onde: 'doux', gain: 0.1, attaque: 0.005, reverb: 0.5 });
    S.accord({ notes: [MI[2], SI[2], MI[3], SI[3]], ecart: 0.015, retard: 0.44, dur: 1.6, onde: 'doux', gain: 0.075, attaque: 0.012, reverb: 0.7 });
    S.ton({ f: MI[0], retard: 0.44, dur: 1.4, onde: 'orgue', gain: 0.06, attaque: 0.02, filtre: { type: 'lowpass', f: 1200, f2: 300 }, reverb: 0.5 });
    S.membrane({ f: 82.41, dur: 0.7, gain: 0.22, clic: 0.3, retard: 0.44, reverb: 0.5 });   // coup grave sous l'accord
    S.fm({ f: MI[4], ratio: 2, indice: 1.4, dur: 1.3, gain: 0.04, retard: 0.46, reverb: 0.85 });
    S.fm({ f: SI[4], ratio: 2, indice: 1, dur: 1.0, gain: 0.025, retard: 0.52, reverb: 0.85 });
  },
};

export const DEMO = [
  { k: 'count', nom: 'Décompte 3 · 2 · 1' },
  { k: 'go', nom: 'Départ' },
  { k: 'boost', nom: 'Boost (montée filtrée)' },
  { k: 'pickup', arg: 'speed', nom: 'Bonus vitesse' },
  { k: 'pickup', arg: 'ghost', nom: 'Bonus fantôme' },
  { k: 'pickup', arg: 'cut', nom: 'Bonus coupe' },
  { k: 'pickup', arg: 'blink', nom: 'Bonus téléport' },
  { k: 'pickup', arg: 'breaker', nom: 'Bonus casse-mur' },
  { k: 'pickup', arg: 'invert', nom: 'Bonus inversion' },
  { k: 'pickup', nom: 'Bonus (carillon par défaut)' },
  { k: 'break', nom: 'Traînée percée au casse-mur (verre / données)' },
  { k: 'laser', nom: 'Barrière laser qui avance' },
  { k: 'derez', nom: 'Dérésolution (élimination)' },
  { k: 'win', nom: 'Fin de manche' },
];

// Calage des niveaux après mesure sur /sons.html (29/10 : RMS sur 300 ms, plein spectre et haut-parleur de téléphone) :
// décomptes et petits sons fréquents relevés pour passer au-dessus de la musique.
function caler(T, f) { Object.keys(f).forEach(function (k) { const r = T[k], x = f[k]; T[k] = function (S, a) { S.plus(typeof x === 'function' ? x(a) : x, function () { r(S, a); }); }; }); }
caler(SONS, { count: 2, pickup: function (a) { return a === 'cut' ? 1.6 : 1; } });
