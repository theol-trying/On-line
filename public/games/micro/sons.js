// Bruitages de MICRO MACHINES — voitures-jouets en plastique qui font la course sur des tables de la maison (cuisine,
// bureau d'écolier, billard, établi, jeu de société) et sur un circuit-jouet posé sur la moquette.
// Recettes jouées par la boîte partagée ../../sfx.js (S) : sound(k, arg) → SONS[k](S, arg). Toutes s'écoutent sur /sons.html.
// Direction : bruiteur de jeu console moderne, à l'échelle du jouet — clacs de coque creuse, tocs de bois, carillons
// en la majeur (même tonalité que les fanfares de MUSIC_THEME), éclaboussures et crépitements faits de grains de bruit.
// Module pur, aucun import ; iOS 15 : ni ?. ni ??, ni Object.hasOwn.

// salle : une table dans une pièce meublée — réverbération courte, chaude (les tapis et rideaux mangent les aigus)
export const SALLE = { duree: 0.65, mix: 0.14, clarte: 0.38 };
export const NIVEAU = 1;

// moteur continu de MA voiture (S.moteur) : petit moteur thermique de voiture radiocommandée / kart, grave et rond.
// Hauteur 55 → 172 Hz (l'ancien montait à 220 Hz en dent de scie + carré : un bourdon) ; corps d'échappement vers 420 Hz,
// nasillard léger vers 1 kHz, et deux CREUX (2,7 et 5,2 kHz) qui retirent la zone où l'oreille trouve un son agressif.
// Calibré hors ligne (même chaîne de filtres que sfx.js) : croisière ≈ niveau du preset par défaut à 0,03 (≈ -32 dB RMS
// mesuré), 6 dB de pente entre 1 et 2 kHz ; crissement en pleine glisse ≈ 6 dB sous le moteur (le défaut, 0,025, ne
// s'entendait pas du tout).
export const MOTEUR = { ralenti: 55, max: 172, gain: 0.03, formants: [[420, 1.2, 5], [1050, 1.8, 4], [2700, 0.9, -7], [5200, 0.7, -10]],
  grain: 0.28, irregulier: 0.17, roulement: 0.032, crissement: 0.1, fCrisse: 1500 };

const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const borne = (x, a, b) => Math.max(a, Math.min(b, x));
const choisir = l => l[Math.floor(Math.random() * l.length)];
const force = a => borne(typeof a === 'number' && isFinite(a) ? a : 0.5, 0.2, 1);   // intensité d'un choc (fx i) → 0,2..1

// crépitement : n micro-claquements de bruit étroit répartis sur dur (papier froissé, sucre écrasé, fusée qui crache)
function grains(S, n, dur, fBas, fHaut, gain, retard) {
  for (let k = 0; k < n; k++) S.bruit({ dur: 0.008 + Math.random() * 0.016, gain: gain * (0.55 + Math.random() * 0.45), couleur: 'blanc', filtre: { type: 'bandpass', f: fBas + Math.random() * (fHaut - fBas), q: 2.2 }, attaque: 0.001, retard: (retard || 0) + Math.random() * dur, reverb: 0.25, varie: 0.2 });
}
// carillon : cloche FM douce (indice bas, partiels de cloche) + sinus pur à la même hauteur pour l'arrondir
function cloche(S, f, dur, gain, retard) {
  S.fm({ f: f, ratio: 3.5, indice: 1, dur: dur, gain: gain, attaque: 0.002, retard: retard || 0, reverb: 0.6 });
  S.ton({ f: f, dur: dur * 0.8, onde: 'sine', gain: gain * 0.7, attaque: 0.003, retard: retard || 0, reverb: 0.6 });
}

// zones : liquides (ça glisse) → éclaboussure ; poudres et miettes (ça freine) → ça crisse sous les roues
const LIQUIDE = { lait: 1700, encre: 1200, huile: 800 };           // fréquence du « splash » : lait clair, encre épaisse, huile visqueuse
const MIETTES = { sucre: [3500, 7000], gomme: [1300, 2800], craie: [2200, 4800], sciure: [1500, 3600] };

export const SONS = {
  // ── chocs ──
  bump: (S, a) => {                                      // voiture contre voiture : clac de deux coques creuses en plastique
    if (!S.limite('bump', 55)) return;
    const i = force(a), f = choisir([1080, 1270, 1460]); // trois coques : jamais deux fois le même clac
    S.choc({ f: 210 + 110 * i, f2: 120, dur: 0.1, gain: 0.1 + 0.18 * i, clic: 1.1, fClic: 2400 + 900 * i, corps: 0.6, reverb: 0.3 });
    S.fm({ f: f, ratio: 2.76, indice: 1.1 + i, dur: 0.07 + 0.03 * i, gain: 0.04 + 0.06 * i, attaque: 0.001, reverb: 0.35 });   // résonance de la coque
    S.bruit({ dur: 0.05, gain: 0.03 + 0.05 * i, couleur: 'blanc', filtre: { type: 'bandpass', f: 4200, q: 3 }, attaque: 0.001, retard: 0.018, reverb: 0.2, varie: 0.2 });   // essieux et petites pièces qui cliquettent
  },
  wall: (S, a) => {                                      // mur, règle, bord de table : « toc » de bois
    if (!S.limite('wall', 70)) return;
    const i = force(a), f = choisir([480, 540, 610]);
    S.ton({ f: f, f2: f * 0.92, dur: 0.11, onde: 'sine', gain: 0.1 + 0.14 * i, attaque: 0.001, reverb: 0.45 });   // la planche résonne
    S.ton({ f: f * 2.71, dur: 0.04, onde: 'sine', gain: 0.03 + 0.05 * i, attaque: 0.001, reverb: 0.3 });           // partiel inharmonique du bois
    S.choc({ f: 150, f2: 85, dur: 0.12, gain: 0.07 + 0.13 * i, clic: 0.7, fClic: 1700, reverb: 0.3 });             // la voiture qui tape
  },
  bumper: (S, a) => {                                    // bumper, punaise, pion, tampon, obstacle mobile : « boïng-ding » de flipper
    if (!S.limite('bumper', 80)) return;
    const i = force(a), f = choisir([1109, 1319, 1480]); // do#, mi, fa# : une série de rebonds fait une petite mélodie
    S.choc({ f: 200, f2: 110, dur: 0.08, gain: 0.08 + 0.1 * i, clic: 0.8, fClic: 2600, reverb: 0.3 });
    S.fm({ f: f, ratio: 2, indice: 0.9, dur: 0.42, gain: 0.08 + 0.04 * i, attaque: 0.002, reverb: 0.55 });          // le « ding »
    S.ton({ f: 210, f2: 330, glisse: 0.35, dur: 0.2, onde: 'sine', gain: 0.08 + 0.06 * i, attaque: 0.003, vibrato: { f: 24, prof: 1.2 }, reverb: 0.3 });   // ressort de caoutchouc
  },

  // ── chutes ──
  fall: (S) => {                                         // tombé de la table : sifflet qui descend… « toc » sur le carrelage, deux rebonds
    const f0 = S.varier(1500, 0.06);
    S.ton({ f: f0, f2: f0 * 0.22, dur: 0.6, onde: 'sine', gain: 0.14, attaque: 0.02, vibrato: { f: 7, prof: 0.25 }, reverb: 0.4 });
    S.ton({ f: f0 * 2, f2: f0 * 0.44, dur: 0.6, onde: 'sine', gain: 0.03, attaque: 0.02, reverb: 0.4 });           // harmonique : sifflet à coulisse
    S.souffle({ dur: 0.55, f1: 2600, f2: 500, gain: 0.14, q: 1.2 });                                                 // l'air pendant la chute
    S.choc({ f: 170, f2: 70, dur: 0.2, gain: 0.3, clic: 0.8, fClic: 1500, retard: 0.6, reverb: 0.5 });
    S.fm({ f: 1150, ratio: 2.76, indice: 1.5, dur: 0.06, gain: 0.06, attaque: 0.001, retard: 0.605, reverb: 0.4 }); // la coque en plastique
    S.choc({ f: 220, f2: 100, dur: 0.1, gain: 0.12, clic: 0.9, fClic: 2000, retard: 0.74, reverb: 0.5 });
    S.choc({ f: 240, f2: 120, dur: 0.07, gain: 0.05, clic: 1, fClic: 2400, retard: 0.82, reverb: 0.5 });
  },
  hole: (S) => {                                         // poche de billard : « plop », puis la voiture roule au fond du filet
    const f = S.varier(300, 0.08);
    S.ton({ f: f, f2: f * 3.2, glisse: 0.6, dur: 0.1, onde: 'sine', gain: 0.26, attaque: 0.003, reverb: 0.3 });     // la bulle qui claque en montant
    S.ton({ f: 140, f2: 70, dur: 0.12, onde: 'sine', gain: 0.12, attaque: 0.002 });                                 // corps du plop
    S.choc({ f: 110, f2: 55, dur: 0.28, gain: 0.2, clic: 0.25, fClic: 700, retard: 0.16, reverb: 0.35 });           // au fond de la poche en cuir
    S.bruit({ dur: 0.35, gain: 0.12, couleur: 'brun', filtre: { type: 'lowpass', f: 500, f2: 200 }, attaque: 0.02, retard: 0.2, reverb: 0.3 });
  },
  respawn: (S) => {                                      // la voiture reposée sur la piste : « pop » + deux notes qui montent
    S.ton({ f: 380, f2: 900, glisse: 0.7, dur: 0.07, onde: 'sine', gain: 0.12, attaque: 0.003 });
    S.choc({ f: 260, f2: 160, dur: 0.06, gain: 0.08, clic: 0.6, fClic: 2600 });                                     // les roues touchent la table
    S.accord({ notes: [880, 1319], ecart: 0.07, dur: 0.18, onde: 'doux', gain: 0.1, attaque: 0.004, retard: 0.03, reverb: 0.4 });
  },

  // ── tours (sons de MA voiture, carillons en la majeur) ──
  lap: (S) => { cloche(S, 880, 0.8, 0.1); cloche(S, 1319, 1, 0.1, 0.12); },   // tour bouclé : « ding-dong » qui monte d'une quinte
  best: (S) => {                                         // meilleur tour / record : arpège rapide qui scintille
    [880, 1109, 1319, 1760].forEach((f, k) => cloche(S, f, 0.6 + 0.15 * k, 0.08, k * 0.075));
    S.ton({ f: 3520, dur: 0.6, onde: 'sine', gain: 0.012, vibrato: { f: 9, prof: 0.4 }, attaque: 0.05, retard: 0.28, reverb: 0.8 });   // scintillement
  },
  lastlap: (S) => {                                      // dernier tour : la cloche agitée trois fois (après le carillon du tour)
    for (let k = 0; k < 3; k++) {
      S.fm({ f: 1760, ratio: 2.41, indice: 1.6, dur: 0.55, gain: 0.1, attaque: 0.001, retard: 0.25 + k * 0.19, reverb: 0.55 });
      S.ton({ f: 1760, dur: 0.4, onde: 'sine', gain: 0.06, attaque: 0.002, retard: 0.25 + k * 0.19, reverb: 0.5 });
    }
  },
  finish: (S) => {                                       // arrivée : fanfare de carillons, accord tenu et coup de timbale
    [880, 1109, 1319, 1760].forEach((f, k) => cloche(S, f, k === 3 ? 1.4 : 0.6, k === 3 ? 0.1 : 0.08, k * 0.11));
    S.accord({ notes: [440, 554, 659, 880], dur: 1.3, onde: 'doux', gain: 0.09, attaque: 0.015, retard: 0.33, reverb: 0.7 });
    S.membrane({ f: 90, dur: 0.35, gain: 0.2, retard: 0.33 });
  },

  // ── piste ──
  boost: (S) => {                                        // flèche turbo du circuit-jouet : souffle qui monte + sifflement
    if (!S.limite('boost', 80)) return;
    S.souffle({ dur: 0.45, f1: 420, f2: 3600, gain: 0.32, q: 1.1 });
    S.ton({ f: 330, f2: 1320, glisse: 0.8, dur: 0.38, onde: 'doux', gain: 0.08, attaque: 0.03, filtre: { type: 'lowpass', f: 2500 }, reverb: 0.3 });
    S.bruit({ dur: 0.3, gain: 0.12, couleur: 'brun', filtre: { type: 'lowpass', f: 700, f2: 300 }, attaque: 0.01, reverb: 0.2 });   // la poussée
  },
  splash: (S, z) => {                                    // entrée dans une zone (arg = type) : éclaboussure ou crissement de miettes
    if (!S.limite('splash', 70)) return;
    if (typeof z === 'string' && own(LIQUIDE, z)) {
      const f = LIQUIDE[z];
      S.bruit({ dur: 0.24, gain: 0.3, couleur: 'blanc', filtre: { type: 'bandpass', f: f * 1.6, f2: f * 0.6, q: 0.9 }, attaque: 0.006, reverb: 0.35 });   // l'éclaboussure
      S.bruit({ dur: 0.12, gain: 0.14, couleur: 'rose', filtre: { type: 'lowpass', f: 600 }, attaque: 0.003 });                                          // la masse de liquide
      const n = z === 'huile' ? 2 : 4;
      for (let k = 0; k < n; k++) { const g = 900 + Math.random() * 1400; S.ton({ f: g, f2: g * 1.8, glisse: 0.5, dur: 0.05, onde: 'sine', gain: 0.035, attaque: 0.002, retard: 0.04 + Math.random() * 0.2, reverb: 0.4, varie: 0.15 }); }   // gouttes qui retombent
    } else {
      const F = typeof z === 'string' && own(MIETTES, z) ? MIETTES[z] : [2000, 4500];
      grains(S, 7, 0.22, F[0], F[1], 0.14);                                                                                                           // ça craque sous les roues
      S.bruit({ dur: 0.26, gain: 0.25, couleur: 'blanc', filtre: { type: 'bandpass', f: (F[0] + F[1]) / 2, f2: F[0], q: 1.2 }, attaque: 0.02, reverb: 0.25 });   // frottement des pneus
      if (z === 'craie' || z === 'sciure') S.souffle({ dur: 0.3, f1: 900, f2: 1800, gain: 0.1, q: 0.8 });                                              // petit nuage de poussière
    }
  },
  honk: (S, d) => {                                      // klaxon de jouet à deux tons (arg = décalage en Hz selon le siège)
    const b = typeof d === 'number' && isFinite(d) ? borne(d, 0, 120) : 0, f1 = 392 + b, f2 = f1 * 1.26;   // tierce majeure
    if (!S.limite('honk' + b, 100)) return;
    const corps = { dur: 0.3, onde: 'creux', attaque: 0.012, glisse: 0.12, filtre: { type: 'lowpass', f: 2400, q: 0.5 }, vibrato: { f: 5.5, prof: 0.08 }, reverb: 0.4, varie: 0.01 };
    S.ton(Object.assign({}, corps, { f: f1 * 0.94, f2: f1, gain: 0.13 }));   // la note monte un peu à l'attaque : « pouet »
    S.ton(Object.assign({}, corps, { f: f2 * 0.94, f2: f2, gain: 0.11 }));
    S.bruit({ dur: 0.28, gain: 0.05, couleur: 'blanc', filtre: { type: 'bandpass', f: f2 * 3, q: 4 }, attaque: 0.01 });   // grésillement de l'anche
  },
  out: (S) => {                                          // Élimination : la voiture sort de l'écran télé — « piou » qui tombe, coup sourd, neige
    S.souffle({ dur: 0.4, f1: 2400, f2: 350, gain: 0.3, q: 1 });
    S.ton({ f: 660, f2: 150, dur: 0.55, onde: 'doux', gain: 0.18, attaque: 0.01, filtre: { type: 'lowpass', f: 3000, f2: 800 }, reverb: 0.5 });
    S.ton({ f: 990, f2: 225, dur: 0.5, onde: 'sine', gain: 0.05, attaque: 0.01, reverb: 0.5 });
    S.membrane({ f: 62, dur: 0.6, gain: 0.32, clic: 0.4, retard: 0.3 });
    S.bruit({ dur: 0.25, gain: 0.08, couleur: 'blanc', filtre: { type: 'highpass', f: 5000 }, attaque: 0.002, retard: 0.3 });   // l'image qui grésille
  },
  coupe: (S) => {                                        // raccourci / pénalité : buzzer feutré (deux notes à un demi-ton qui battent)
    if (!S.limite('coupe', 150)) return;
    const F = { type: 'lowpass', f: 900, q: 0.7 };
    S.ton({ f: 147, dur: 0.34, onde: 'creux', gain: 0.17, attaque: 0.012, filtre: F, reverb: 0.3 });
    S.ton({ f: 156, dur: 0.34, onde: 'creux', gain: 0.13, attaque: 0.012, filtre: F, reverb: 0.3 });
    S.ton({ f: 294, dur: 0.3, onde: 'sine', gain: 0.04, attaque: 0.012 });
  },

  // ── boîtes surprise et objets ──
  boite: (S) => {                                        // ramassage : le carton s'ouvre (« pop ») + arpège de jouet
    if (!S.limite('boite', 60)) return;
    const t = choisir([1, 1.122, 0.891]);                // trois tonalités
    S.bruit({ dur: 0.03, gain: 0.14, couleur: 'blanc', filtre: { type: 'bandpass', f: 3000, q: 1.5 }, attaque: 0.001 });
    S.ton({ f: 300, f2: 700, glisse: 0.6, dur: 0.06, onde: 'sine', gain: 0.1, attaque: 0.002 });
    S.accord({ notes: [880 * t, 1109 * t, 1319 * t, 1760 * t], ecart: 0.045, dur: 0.22, onde: 'doux', gain: 0.1, attaque: 0.003, retard: 0.03, reverb: 0.45 });
    S.fm({ f: 2637 * t, ratio: 3.5, indice: 0.7, dur: 0.4, gain: 0.025, retard: 0.2, reverb: 0.6 });               // « tiling »
  },
  objet0: (S) => {                                       // Turbo ⚡ : allumage, poussée qui monte, sifflement de turbine
    S.choc({ f: 140, f2: 60, dur: 0.16, gain: 0.16, clic: 0.6, fClic: 1200 });
    S.souffle({ dur: 0.55, f1: 350, f2: 3200, gain: 0.34, q: 1 });
    S.ton({ f: 260, f2: 1300, glisse: 0.85, dur: 0.5, onde: 'doux', gain: 0.1, attaque: 0.04, filtre: { type: 'lowpass', f: 2600 }, vibrato: { f: 11, prof: 0.15 }, reverb: 0.35 });
    S.bruit({ dur: 0.5, gain: 0.14, couleur: 'brun', filtre: { type: 'lowpass', f: 900, f2: 300 }, attaque: 0.02, reverb: 0.3 });   // grondement
  },
  objet1: (S) => {                                       // Triple turbo 🚀 (×3) : fusée de feu d'artifice qui crache
    S.choc({ f: 120, f2: 50, dur: 0.2, gain: 0.2, clic: 0.8, fClic: 1000 });
    S.souffle({ dur: 0.65, f1: 300, f2: 4200, gain: 0.36, q: 0.9 });
    S.ton({ f: 220, f2: 1500, glisse: 0.9, dur: 0.6, onde: 'doux', gain: 0.1, attaque: 0.05, filtre: { type: 'lowpass', f: 3000 }, reverb: 0.35 });
    grains(S, 7, 0.45, 2500, 6000, 0.05, 0.08);         // étincelles
  },
  objet2: (S) => {                                       // Flaque d'huile 🛢 : « glouc-glouc » du bidon, « splotch » sur la table
    S.ton({ f: 340, f2: 170, dur: 0.11, onde: 'sine', gain: 0.16, attaque: 0.004 });
    S.ton({ f: 300, f2: 150, dur: 0.1, onde: 'sine', gain: 0.12, attaque: 0.004, retard: 0.1 });
    S.bruit({ dur: 0.3, gain: 0.26, couleur: 'rose', filtre: { type: 'lowpass', f: 1200, f2: 300 }, attaque: 0.008, retard: 0.16, reverb: 0.3 });
    S.bruit({ dur: 0.18, gain: 0.12, couleur: 'blanc', filtre: { type: 'bandpass', f: 1500, f2: 700, q: 1.2 }, attaque: 0.004, retard: 0.16 });
  },
  objet3: (S) => {                                       // Boule de papier 📄 : papier froissé puis « fwip » du lancer
    grains(S, 8, 0.12, 2000, 6500, 0.07);
    S.souffle({ dur: 0.22, f1: 700, f2: 2600, gain: 0.26, q: 1.4, retard: 0.06 });
    S.ton({ f: 900, f2: 380, dur: 0.16, onde: 'sine', gain: 0.06, attaque: 0.004, retard: 0.06 });
  },
  objet4: (S) => {                                       // Bouclier 🛡 : la bulle qui se gonfle (« vouuum ») et scintille
    S.ton({ f: 196, f2: 392, glisse: 0.5, dur: 0.7, onde: 'doux', gain: 0.18, attaque: 0.04, vibrato: { f: 6, prof: 0.2 }, filtre: { type: 'lowpass', f: 1400 }, reverb: 0.5 });
    S.accord({ notes: [880, 1319, 1760], ecart: 0.06, dur: 0.6, onde: 'sine', gain: 0.06, attaque: 0.01, retard: 0.12, reverb: 0.7 });
    S.fm({ f: 2637, ratio: 2, indice: 0.6, dur: 0.6, gain: 0.03, retard: 0.25, reverb: 0.8 });
    S.souffle({ dur: 0.5, f1: 600, f2: 2000, gain: 0.12, q: 2 });
  },
  objet5: (S) => {                                       // Escargot 🐌 : « wouaaah » qui ralentit (la wah se referme) + bulle de bave
    S.ton({ f: 330, f2: 165, dur: 0.8, onde: 'creux', gain: 0.15, attaque: 0.03, vibrato: { f: 4.5, prof: 0.5 }, filtre: { type: 'lowpass', f: 2200, f2: 450, q: 4 }, reverb: 0.45 });
    S.ton({ f: 220, f2: 110, glisse: 0.8, dur: 0.6, onde: 'sine', gain: 0.1, attaque: 0.02, retard: 0.1 });
    S.bruit({ dur: 0.22, gain: 0.14, couleur: 'rose', filtre: { type: 'lowpass', f: 700 }, attaque: 0.01, retard: 0.05 });   // « sclorp »
    S.ton({ f: 180, f2: 420, glisse: 0.6, dur: 0.09, onde: 'sine', gain: 0.1, attaque: 0.003, retard: 0.02 });
  },
  paf: (S) => {                                          // boule de papier reçue : « paf », le papier s'écrase, la voiture part en toupie
    S.choc({ f: 190, f2: 90, dur: 0.12, gain: 0.24, clic: 0.9, fClic: 1900, reverb: 0.35 });
    grains(S, 6, 0.08, 1800, 5500, 0.08);
    S.souffle({ dur: 0.4, f1: 1600, f2: 500, gain: 0.16, q: 1.6, retard: 0.05 });
  },
  glisse: (S) => {                                       // roues dans l'huile : « splitch » + couinement des pneus
    if (!S.limite('glisse', 90)) return;
    S.bruit({ dur: 0.16, gain: 0.3, couleur: 'rose', filtre: { type: 'lowpass', f: 900, f2: 350 }, attaque: 0.004 });
    S.ton({ f: 1650, f2: 1400, dur: 0.45, onde: 'doux', gain: 0.1, attaque: 0.03, vibrato: { f: 13, prof: 0.7 }, filtre: { type: 'bandpass', f: 1600, q: 2 }, retard: 0.04, reverb: 0.35 });
    S.bruit({ dur: 0.4, gain: 0.2, couleur: 'blanc', filtre: { type: 'bandpass', f: 2100, f2: 1600, q: 5 }, attaque: 0.03, retard: 0.04 });
  },
  pare: (S) => {                                         // le bouclier dévie l'huile ou la boule : « ting » de verre + souffle
    if (!S.limite('pare', 80)) return;
    S.fm({ f: 1760, ratio: 1.41, indice: 1.6, dur: 0.55, gain: 0.09, attaque: 0.001, reverb: 0.6 });
    S.ton({ f: 2637, f2: 2349, dur: 0.4, onde: 'sine', gain: 0.04, attaque: 0.003, vibrato: { f: 9, prof: 0.3 }, reverb: 0.7 });
    S.souffle({ dur: 0.18, f1: 3200, f2: 1200, gain: 0.16, q: 1.5 });
  },

  // ── départ et fin (même tonalité que les fanfares count / go / win de la musique) ──
  count: (S) => {                                        // feu rouge : bip doux (la5)
    S.ton({ f: 880, dur: 0.2, onde: 'doux', gain: 0.17, attaque: 0.004, reverb: 0.3, varie: 0 });
    S.ton({ f: 1760, dur: 0.12, onde: 'sine', gain: 0.03, attaque: 0.004, varie: 0 });
  },
  go: (S) => {                                           // feu vert : bip une octave au-dessus, plus long
    S.ton({ f: 1760, dur: 0.6, onde: 'doux', gain: 0.2, attaque: 0.004, reverb: 0.4, varie: 0 });
    S.ton({ f: 880, dur: 0.6, onde: 'doux', gain: 0.14, attaque: 0.004, reverb: 0.4, varie: 0 });
  },
  win: (S) => {                                          // fin de manche : montée mi-fa#-sol#-la sur la fanfare, accord, timbale, petite clameur
    [1319, 1480, 1661, 1760].forEach((f, k) => cloche(S, f, k === 3 ? 1.2 : 0.7, 0.08, k * 0.14));
    S.accord({ notes: [440, 554, 659, 880], ecart: 0.012, dur: 1.6, onde: 'doux', gain: 0.1, attaque: 0.02, retard: 0.42, reverb: 0.75 });
    S.membrane({ f: 80, dur: 0.5, gain: 0.22, retard: 0.42 });
    S.foule({ dur: 2.2, gain: 0.06, elan: 0.25, retard: 0.4 });
  },
};

export const DEMO = [
  { k: 'bump', arg: 0.3, nom: 'Choc entre voitures (léger)' }, { k: 'bump', arg: 1, nom: 'Choc entre voitures (violent)' },
  { k: 'wall', arg: 0.3, nom: 'Mur / bord de table (léger)' }, { k: 'wall', arg: 1, nom: 'Mur / bord de table (fort)' },
  { k: 'bumper', arg: 0.6, nom: 'Bumper, punaise, pion, tampon' },
  { k: 'fall', nom: 'Chute de la table' }, { k: 'hole', nom: 'Dans une poche de billard' }, { k: 'respawn', nom: 'Retour sur la piste' },
  { k: 'lap', nom: 'Tour bouclé' }, { k: 'best', nom: 'Meilleur tour / record' }, { k: 'lastlap', nom: 'Dernier tour (cloche)' }, { k: 'finish', nom: 'Ligne d\'arrivée' },
  { k: 'boost', nom: 'Flèche turbo' },
  { k: 'splash', arg: 'lait', nom: 'Zone : lait renversé' }, { k: 'splash', arg: 'encre', nom: 'Zone : tache d\'encre' }, { k: 'splash', arg: 'huile', nom: 'Zone : flaque d\'huile' },
  { k: 'splash', arg: 'sucre', nom: 'Zone : sucre / miettes' }, { k: 'splash', arg: 'gomme', nom: 'Zone : miettes de gomme' }, { k: 'splash', arg: 'craie', nom: 'Zone : craie' }, { k: 'splash', arg: 'sciure', nom: 'Zone : sciure' },
  { k: 'honk', arg: 0, nom: 'Klaxon (grave)' }, { k: 'honk', arg: 48, nom: 'Klaxon (moyen)' }, { k: 'honk', arg: 96, nom: 'Klaxon (aigu)' },
  { k: 'out', nom: 'Sorti de l\'écran (éliminé)' }, { k: 'coupe', nom: 'Raccourci / pénalité' },
  { k: 'boite', nom: 'Boîte surprise ramassée' }, { k: 'objet0', nom: 'Objet : Turbo' }, { k: 'objet1', nom: 'Objet : Triple turbo' }, { k: 'objet2', nom: 'Objet : Flaque d\'huile' },
  { k: 'objet3', nom: 'Objet : Boule de papier' }, { k: 'objet4', nom: 'Objet : Bouclier' }, { k: 'objet5', nom: 'Objet : Escargot' },
  { k: 'paf', nom: 'Touché par une boule de papier' }, { k: 'glisse', nom: 'Roule dans l\'huile' }, { k: 'pare', nom: 'Le bouclier pare un coup' },
  { k: 'count', nom: 'Décompte (feu rouge)' }, { k: 'go', nom: 'Départ (feu vert)' }, { k: 'win', nom: 'Fin de manche' },
];

// Calage des niveaux après mesure sur /sons.html (29/10 : RMS sur 300 ms, plein spectre et haut-parleur de téléphone) :
// décomptes et petits sons fréquents relevés pour passer au-dessus de la musique.
function caler(T, f) { Object.keys(f).forEach(function (k) { const r = T[k], x = f[k]; T[k] = function (S, a) { S.plus(typeof x === 'function' ? x(a) : x, function () { r(S, a); }); }; }); }
caler(SONS, { bump: 2, wall: 1.6, splash: 1.5, count: 1.6 });
