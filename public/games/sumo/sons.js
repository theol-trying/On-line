// Bruitages du SUMO — « Dohyō » : tournoi traditionnel japonais. Recettes jouées par la boîte partagée public/sfx.js
// (module pur, aucun import) ; elles s'écoutent toutes sur /sons.html.
// Palette : taiko (S.membrane) pour les chocs, hyoshigi (claquoirs de bois secs) au décompte, koto (S.corde, gamme in-sen
// sur ré comme la musique) aux bonus, sel qui crépite, foule qui retient son souffle à chaque sortie.
// Niveaux visés (crête en sortie) : décompte / sel / bonus -24 à -18 dB ; contacts et charges -18 à -12 ; sortie, onde
// de choc, coup d'envoi et victoire -12 à -6.

// Salle de tournoi (type Kokugikan) : grand volume, queue ample et chaude (clarte basse = bois et tentures qui absorbent les aigus).
export const SALLE = { duree: 1.7, mix: 0.2, clarte: 0.35 };
export const NIVEAU = 1;

const KOTO = [587.33, 783.99, 880, 1046.5, 1174.66];   // in-sen sur ré : ré5, sol5, la5, do6, ré6 (paliers d'onigiri)
const VICTOIRE = [293.66, 392, 440, 587.33];             // ré4 sol4 la4 ré5 : mêmes fondamentales que la fanfare 'win' de music.js
const VOYELLES = [1050, 820, 660];                       // « ha » / « ho » / « hu » : formant du souffle d'effort, tiré au sort

// Hyoshigi : deux bâtons de bois dur frappés l'un contre l'autre — claquement très bref, deux modes inharmoniques qui
// sonnent ~0,1 s, et un second contact quelques ms plus tard (les bâtons ne se touchent jamais parfaitement à plat).
function hyoshigi(S, r, g) {
  const f = S.varier(1850, 0.02);
  S.bruit({ dur: 0.018, couleur: 'blanc', filtre: { type: 'bandpass', f: 2900, q: 1.6 }, attaque: 0.001, gain: 0.3 * g, retard: r, reverb: 0.7 });           // claquement
  S.bruit({ dur: 0.012, couleur: 'blanc', filtre: { type: 'bandpass', f: 3700, q: 2 }, attaque: 0.001, gain: 0.16 * g, retard: r + 0.006, reverb: 0.7 });   // 2e contact (fla)
  S.ton({ f: f, dur: 0.12, onde: 'sine', gain: 0.14 * g, attaque: 0.001, retard: r, reverb: 0.8, varie: 0.02 });                                          // mode principal du bois
  S.ton({ f: f * 2.76, dur: 0.045, onde: 'sine', gain: 0.045 * g, attaque: 0.001, retard: r, reverb: 0.6, varie: 0.02 });                                 // 2e mode (bois dur : inharmonique)
  S.ton({ f: f * 0.37, dur: 0.05, onde: 'sine', gain: 0.05 * g, attaque: 0.001, retard: r, reverb: 0.4, varie: 0.02 });                                   // corps des bâtons
}

export const SONS = {
  // contact entre deux lutteurs : « don » de taiko, plus grave, plus long et plus fort selon la violence (arg 0..1),
  // + claque des corps qui se heurtent ; anti-mitraillage global (le client limite déjà par paire)
  hit: (S, arg) => {
    const fo = arg == null ? 0.5 : Math.max(0, Math.min(1, arg));
    if (!S.limite(fo >= 0.6 ? 'hitFort' : 'hit', fo >= 0.6 ? 35 : 55)) return;
    S.membrane({ f: S.varier(78 - 18 * fo, 0.06), dur: 0.5 + 0.55 * fo, gain: 0.13 + 0.22 * fo, clic: 0.4 + 0.35 * fo, reverb: 0.5 + 0.3 * fo });   // peau du taiko
    S.ton({ f: 420 - 100 * fo, f2: 260, dur: 0.1, onde: 'doux', gain: 0.1 + 0.12 * fo, attaque: 0.002, reverb: 0.4 });   // claquement médium de la peau (audible sur un haut-parleur de téléphone)
    S.bruit({ dur: 0.06, couleur: 'rose', filtre: { type: 'bandpass', f: S.varier(950 + 350 * fo, 0.1), q: 0.9 }, attaque: 0.002, gain: 0.12 + 0.25 * fo, reverb: 0.3, varie: 0.15 });   // claque chair contre chair
    if (fo >= 0.6) S.choc({ f: 70, f2: 32, dur: 0.3, gain: 0.1 + 0.1 * fo, clic: 0, reverb: 0.4 });                                                   // poussée sous-grave des gros chocs
  },
  // charge : appui du pied qui part, souffle d'effort (voyelle changeante) et déplacement d'air du corps lancé
  dash: S => {
    if (!S.limite('dash', 60)) return;
    const v = VOYELLES[Math.floor(Math.random() * VOYELLES.length)];
    S.choc({ f: 95, f2: 50, dur: 0.14, gain: 0.16, clic: 0.3, fClic: 1200, reverb: 0.3 });                                                            // pied qui pousse sur l'argile
    S.bruit({ dur: 0.22, couleur: 'rose', filtre: { type: 'bandpass', f: v, f2: v * 0.7, q: 2 }, attaque: 0.015, gain: 0.5, reverb: 0.35, varie: 0.1 });   // « hah ! » expiré
    S.souffle({ dur: 0.3, f1: 300, f2: 1400, gain: 0.3, q: 1.2, retard: 0.02, reverb: 0.4 });                                                           // le corps fend l'air
  },
  // ancrage : shiko, le pied qui retombe à plat sur l'argile tassée — frappe sourde, un peu de terre, presque pas d'aigu
  brace: S => {
    if (!S.limite('brace', 60)) return;
    S.choc({ f: S.varier(68, 0.05), f2: 34, dur: 0.32, gain: 0.34, clic: 0.15, fClic: 600, reverb: 0.45 });                                            // plante du pied
    S.ton({ f: 300, f2: 190, dur: 0.09, onde: 'doux', gain: 0.14, attaque: 0.002, reverb: 0.35 });                                                     // « tap » médium (téléphone)
    S.bruit({ dur: 0.16, couleur: 'brun', filtre: { type: 'lowpass', f: 420 }, attaque: 0.002, gain: 0.3, reverb: 0.4 });                              // masse de terre
    S.bruit({ dur: 0.1, couleur: 'rose', filtre: { type: 'bandpass', f: 1800, q: 0.7 }, attaque: 0.002, gain: 0.07, retard: 0.005, reverb: 0.3, varie: 0.15 });   // grain de l'argile
  },
  // bonus : cordes de koto pincées (in-sen). arg = palier d'onigiri 1..5 (une corde de plus par palier, taiko au 5e) ;
  // 0 = élan / onde / pieds collés : deux ou trois cordes, en alternance pour ne pas lasser
  pickup: (S, arg) => {
    if (!S.limite('pickup', 50)) return;
    const n = Math.max(0, Math.min(5, arg | 0));
    if (!n) {
      const motif = Math.random() < 0.5 ? [KOTO[0], KOTO[2]] : [KOTO[0], KOTO[1], KOTO[2]];
      motif.forEach((f, i) => S.corde({ f: f, dur: 0.8, gain: 0.17, clarte: 0.8, retard: i * 0.065, reverb: 0.5, varie: 0.02 }));
      return;
    }
    for (let i = 0; i <= Math.min(n, 4); i++) S.corde({ f: KOTO[i], dur: 0.8 + 0.1 * i, gain: 0.15, clarte: 0.8, retard: i * 0.06, reverb: 0.5, varie: 0.02 });
    if (n >= 5) {                                                                                                                                      // palier max : accord gratté (la5 + ré6) et « don »
      S.corde({ f: KOTO[2], dur: 1.4, gain: 0.12, clarte: 0.85, retard: 0.32, reverb: 0.6, varie: 0.02 });
      S.corde({ f: KOTO[4], dur: 1.4, gain: 0.12, clarte: 0.85, retard: 0.335, reverb: 0.6, varie: 0.02 });
      S.membrane({ f: 60, dur: 0.9, gain: 0.24, clic: 0.5, retard: 0.32 });
    }
  },
  // onde de choc : gros taiko + pression sous-grave + air qui déferle et s'assombrit en s'éloignant
  shock: S => {
    if (!S.limite('shock', 120)) return;
    S.membrane({ f: 48, dur: 1.2, gain: 0.42, clic: 0.6, reverb: 0.8 });                                                                              // ōdaiko, le grand tambour
    S.choc({ f: 55, f2: 24, dur: 0.7, gain: 0.2, clic: 0, reverb: 0.3 });                                                                             // pression
    S.bruit({ dur: 0.9, couleur: 'rose', filtre: { type: 'lowpass', f: 3200, f2: 160 }, attaque: 0.006, gain: 0.26, reverb: 0.6 });                     // souffle de l'onde
    S.souffle({ dur: 0.55, f1: 2600, f2: 300, gain: 0.22, q: 0.8, retard: 0.03, reverb: 0.7 });                                                        // balayage qui s'éloigne
  },
  // sortie du cercle : gros taiko, le lutteur qui tombe du dohyō dans la terre, et le « ooh » de la salle
  out: S => {
    if (!S.limite('out', 80)) return;
    S.membrane({ f: S.varier(46, 0.04), dur: 1.3, gain: 0.4, clic: 0.75, reverb: 0.8 });                                                              // « DON »
    S.choc({ f: 90, f2: 40, dur: 0.38, gain: 0.22, clic: 0.35, fClic: 800, retard: 0.17, reverb: 0.5 });                                              // chute au pied du dohyō
    S.bruit({ dur: 0.35, couleur: 'brun', filtre: { type: 'lowpass', f: 900, f2: 250 }, attaque: 0.004, gain: 0.15, retard: 0.17, reverb: 0.4 });       // terre qui s'éparpille
    if (!S.limite('foule', 500)) return;                                                                                                                // sorties en série : un seul « ooh »
    S.foule({ dur: 1.4, gain: 0.15, elan: 0.2, retard: 0.1 });                                                                                        // clameur
    S.bruit({ dur: 1.2, couleur: 'rose', filtre: { type: 'bandpass', f: 520, f2: 340, q: 1.8 }, attaque: 0.15, gain: 0.3, retard: 0.1, reverb: 0.8, varie: 0.1 });   // voyelle « oh » qui retombe
  },
  // jet de sel rituel : la main qui lance, un rideau de grains, puis des grains isolés qui crépitent sur l'argile
  salt: S => {
    if (!S.limite('salt', 300)) return;
    S.souffle({ dur: 0.2, f1: 1800, f2: 5200, gain: 0.14, q: 0.9, reverb: 0.3 });                                                                     // geste du bras
    S.bruit({ dur: 0.6, couleur: 'blanc', filtre: { type: 'bandpass', f: 6500, f2: 4200, q: 0.8 }, attaque: 0.08, gain: 0.1, retard: 0.08, reverb: 0.5, varie: 0.1 });    // pluie de sel
    for (let i = 0; i < 14; i++) {                                                                                                                      // grains : plus denses au début
      const r = Math.random();
      S.bruit({ dur: 0.01 + Math.random() * 0.012, couleur: 'blanc', filtre: { type: 'bandpass', f: 3500 + Math.random() * 5000, q: 2.5 }, attaque: 0.001, gain: 0.04 + Math.random() * 0.03, retard: 0.1 + 0.55 * r * Math.sqrt(r), reverb: 0.4, varie: 0.2 });
    }
  },
  // décompte 3·2·1 : un coup de hyoshigi sec qui résonne dans la salle
  count: S => {
    if (!S.limite('count', 200)) return;
    hyoshigi(S, 0, 1);
  },
  // coup d'envoi (« hakkeyoi ! ») : do-DON de taiko, la salle qui s'éveille
  go: S => {
    if (!S.limite('go', 300)) return;
    S.ton({ f: 560, f2: 360, dur: 0.12, onde: 'doux', gain: 0.16, attaque: 0.002, reverb: 0.5 });              // attaque médium du « do »…
    S.ton({ f: 480, f2: 300, dur: 0.18, onde: 'doux', gain: 0.2, attaque: 0.002, retard: 0.15, reverb: 0.5 });  // …et du « DON » (téléphone)
    S.membrane({ f: 72, dur: 0.6, gain: 0.26, clic: 0.5, reverb: 0.6 });
    S.membrane({ f: 56, dur: 1.1, gain: 0.38, clic: 0.7, retard: 0.15, reverb: 0.75 });
    S.foule({ dur: 1.2, gain: 0.09, elan: 0.12, retard: 0.17 });
  },
  // victoire : arpège de koto calé sur la fanfare de music.js (même cadence 0,16 s), grand « don » sur la dernière note, ovation
  win: S => {
    if (!S.limite('win', 600)) return;
    VICTOIRE.forEach((f, i) => S.corde({ f: f, dur: 1.2 + 0.3 * i, gain: 0.17, clarte: 0.65, retard: i * 0.16, reverb: 0.6, varie: 0.02 }));
    S.membrane({ f: 52, dur: 1.4, gain: 0.34, clic: 0.6, retard: 0.48, reverb: 0.8 });
    S.foule({ dur: 2.6, gain: 0.15, elan: 0.25, retard: 0.1 });
  },
};

// Page d'écoute (/sons.html) : chaque clé, avec les variantes d'argument qui changent le rendu.
export const DEMO = [
  { k: 'hit', arg: 0.15, nom: 'Contact léger (taiko)' },
  { k: 'hit', arg: 0.5, nom: 'Poussée (taiko)' },
  { k: 'hit', arg: 1, nom: 'Choc violent, charge (taiko)' },
  { k: 'dash', nom: 'Charge : souffle d\'effort' },
  { k: 'brace', nom: 'Ancrage : frappe de pied (shiko)' },
  { k: 'pickup', arg: 0, nom: 'Bonus ramassé (koto)' },
  { k: 'pickup', arg: 1, nom: 'Onigiri, palier 1/5' },
  { k: 'pickup', arg: 3, nom: 'Onigiri, palier 3/5' },
  { k: 'pickup', arg: 5, nom: 'Onigiri, palier 5/5' },
  { k: 'shock', nom: 'Onde de choc' },
  { k: 'out', nom: 'Sortie du cercle et « ooh » de la salle' },
  { k: 'salt', nom: 'Jet de sel rituel' },
  { k: 'count', nom: 'Décompte : hyoshigi' },
  { k: 'go', nom: 'Coup d\'envoi : do-don !' },
  { k: 'win', nom: 'Victoire : koto, taiko, ovation' },
];

// Calage des niveaux après mesure sur /sons.html (29/10 : RMS sur 300 ms, plein spectre et haut-parleur de téléphone) :
// décomptes et petits sons fréquents relevés pour passer au-dessus de la musique.
function caler(T, f) { Object.keys(f).forEach(function (k) { const r = T[k], x = f[k]; T[k] = function (S, a) { S.plus(typeof x === 'function' ? x(a) : x, function () { r(S, a); }); }; }); }
caler(SONS, { count: 2 });
