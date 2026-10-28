// BRUITAGES DU FOOT — « Stade de nuit · une cage chacun ». Recettes jouées par la boîte partagée public/sfx.js
// (bus compressé + réverbération du lieu) ; toutes s'écoutent sur /sons.html. Module pur : aucun import.
// Direction : bruiteur de match télévisé. Le cuir fait « poc » (corps médium + claquement), l'arbitre siffle les
// moments réglementaires, la foule gronde au but et soupire sur le poteau, les tacles frottent le sol du terrain du
// jour (pelouse, boue, glace, sable, plateau de flipper) ; bonus et malus sonnent comme l'écran géant du stade.
// Arguments venus du client : kick / canon = puissance 0..1 ; post = force 0..1 ; wall = { f, ter } ; slide / miss = id
// du terrain ; tackle = { ter, vol } (vol : le tacle arrache le ballon) ; whistle = 'start' | 'go' | 'kick' | 'end'.

// Stade ouvert : la queue est longue (écho des tribunes) mais peu présente, et assez sombre (pas de mur proche).
export const SALLE = { duree: 2.2, mix: 0.13, clarte: 0.42 };
export const NIVEAU = 1;

const borne = (x, d) => (typeof x === 'number' && isFinite(x) ? Math.max(0, Math.min(1, x)) : d);
const hasard = n => Math.floor(Math.random() * n);

// Les sons de contact reçoivent le terrain (chaîne) ou un objet { ter, f, vol } ; sans argument (page d'écoute) :
// pelouse du stade, force moyenne. Le terrain n'est jamais utilisé comme clé d'objet (simples comparaisons).
function lire(arg) {
  if (typeof arg === 'string') return { ter: arg, f: 0.5, vol: 0 };
  if (typeof arg === 'number') return { ter: 'stade', f: borne(arg, 0.5), vol: 0 };
  const o = arg && typeof arg === 'object' ? arg : {};
  return { ter: typeof o.ter === 'string' ? o.ter : 'stade', f: borne(o.f, 0.5), vol: o.vol ? 1 : 0 };
}

// Texture du sol sous un corps qui glisse ou tombe. g = gain de la couche principale (~ -22 dB pour 0,08).
function sol(S, ter, dur, g, retard) {
  const r = retard || 0, a = Math.min(0.08, dur * 0.25);
  if (ter === 'glace') {                                // patin qui racle : chuintement aigu et brillant
    S.bruit({ dur: dur, gain: g * 0.8, couleur: 'blanc', filtre: { type: 'bandpass', f: 5500, f2: 4000, q: 1.2 }, attaque: a, retard: r, reverb: 0.35 });
    S.bruit({ dur: dur * 0.7, gain: g * 0.2, couleur: 'blanc', filtre: { type: 'highpass', f: 7000 }, attaque: a * 0.5, retard: r, reverb: 0.3 });
  } else if (ter === 'boue') {                          // gadoue : glissé sourd et mouillé, « floc » qui plonge, éclaboussure
    S.bruit({ dur: dur, gain: g * 0.45, couleur: 'brun', filtre: { type: 'lowpass', f: 900, f2: 300 }, attaque: a, retard: r, reverb: 0.25 });
    S.ton({ f: 260, f2: 115, dur: 0.13, onde: 'sine', gain: g * 0.8, attaque: 0.004, retard: r + 0.01, reverb: 0.2 });
    S.bruit({ dur: 0.1, gain: g * 2, couleur: 'rose', filtre: { type: 'bandpass', f: 700, f2: 1500, q: 3 }, attaque: 0.004, retard: r + 0.04, reverb: 0.25 });
  } else if (ter === 'tempete') {                       // sable de plage : souffle granuleux + grains qui crépitent
    S.bruit({ dur: dur, gain: g * 0.75, couleur: 'blanc', filtre: { type: 'bandpass', f: 3200, f2: 2200, q: 0.7 }, attaque: a, retard: r, reverb: 0.2 });
    for (let i = 0; i < 5; i++) S.bruit({ dur: 0.015, gain: g * 0.4, couleur: 'blanc', filtre: { type: 'bandpass', f: 2500 + Math.random() * 3000, q: 2 }, attaque: 0.001, retard: r + Math.random() * dur * 0.7, reverb: 0.2, varie: 0.2 });
  } else if (ter === 'flipper') {                       // plateau verni : glissé lisse + crissement de semelle (parquet de salle)
    S.bruit({ dur: dur, gain: g * 1.4, couleur: 'blanc', filtre: { type: 'bandpass', f: 1800, f2: 2600, q: 1.6 }, attaque: a, retard: r, reverb: 0.3 });
    S.ton({ f: 1700, f2: 2300, dur: 0.12, onde: 'sine', gain: g * 0.6, attaque: 0.01, vibrato: { f: 30, prof: 0.5 }, retard: r, reverb: 0.3 });
  } else {                                              // gazon : herbe froissée (bruit clair qui s'assombrit) + terre sous les crampons
    S.bruit({ dur: dur, gain: g, couleur: 'blanc', filtre: { type: 'bandpass', f: 3000, f2: 1600, q: 0.8 }, attaque: a, retard: r, reverb: 0.25 });
    S.bruit({ dur: dur * 0.8, gain: g * 0.5, couleur: 'rose', filtre: { type: 'lowpass', f: 1000 }, attaque: a, retard: r, reverb: 0.2 });
  }
}

// Un coup de sifflet TENU. Les primitives retombent dès la fin de leur attaque : on superpose 2 ou 3 voix dont les
// attaques s'étagent (0 / 30 / 60 % de L) pour que la note tienne, puis coupe net (~70 % de L audibles).
// Bille du sifflet = vibrato rapide ; la 2e voix, désaccordée de 1 %, bat contre la 1re comme les deux chambres d'un vrai sifflet.
function coup(S, L, g, t0) {
  const f = 2800 + Math.random() * 160, roul = { f: 34 + Math.random() * 8, prof: 0.55 };
  const etages = L >= 0.45 ? [0, 0.3, 0.6] : [0, 0.45];
  for (let i = 0; i < etages.length; i++) {
    const a = etages[i] * L;
    S.ton({ f: f * (i % 2 ? 1.01 : 1), dur: L, onde: 'sine', gain: g * (i ? 0.85 : 1), attaque: a > 0 ? a : 0.012, retard: t0, vibrato: roul, reverb: 0.55, varie: 0.01 });
  }
  S.bruit({ dur: L, gain: g * 0.35, couleur: 'blanc', filtre: { type: 'bandpass', f: f, q: 3 }, attaque: L * 0.35, retard: t0, reverb: 0.4, varie: 0.01 });   // air dans le sifflet
  S.bruit({ dur: 0.03, gain: g * 0.4, couleur: 'blanc', filtre: { type: 'bandpass', f: 4500, q: 1.2 }, attaque: 0.002, retard: t0, reverb: 0.3 });           // coup de langue de l'attaque
}

export const SONS = {
  // frappe : « poc » du cuir (corps qui plonge), résonance creuse du ballon gonflé, claquement sur la chaussure ;
  // plus haut et plus sec quand le tir est chargé, et au-delà de 55 % le ballon fend l'air
  kick: (S, arg) => {
    if (!S.limite('kick', 35)) return;
    const p = borne(arg, 0.5), v = Math.random();
    S.choc({ f: 150 + 70 * p + 20 * v, f2: 70, dur: 0.08 + 0.05 * p, gain: 0.17 + 0.15 * p, clic: 0.45, fClic: 1500 + 1300 * p, reverb: 0.3 });
    S.ton({ f: 420 + 90 * p, f2: 330, dur: 0.07, onde: 'sine', gain: 0.05 + 0.03 * p, attaque: 0.002, reverb: 0.3 });
    S.ton({ f: 700 + 200 * p, f2: 450, dur: 0.05, onde: 'doux', gain: 0.07 + 0.06 * p, attaque: 0.001, reverb: 0.25 });   // « poc » médium du cuir (téléphone)
    S.bruit({ dur: 0.03, gain: 0.05 + 0.07 * p, couleur: 'blanc', filtre: { type: 'bandpass', f: 2400 + 1200 * p, q: 1.4 }, attaque: 0.001, reverb: 0.25 });
    if (p > 0.55) S.souffle({ dur: 0.3, f1: 2200, f2: 700, gain: 0.1 * p, q: 1.2, retard: 0.02, reverb: 0.2 });
  },
  // tir « canon » (bonus) : coup de massue grave, claquement sec, grondement qui roule dans les tribunes, boulet qui siffle
  canon: (S) => {
    if (!S.limite('kick', 35)) return;
    S.choc({ f: 130, f2: 45, dur: 0.3, gain: 0.34, clic: 0.75, fClic: 2600, reverb: 0.5 });
    S.membrane({ f: 62, dur: 0.45, gain: 0.16, clic: 0.3, reverb: 0.5 });
    S.bruit({ dur: 0.5, gain: 0.09, couleur: 'brun', filtre: { type: 'lowpass', f: 1100, f2: 160 }, attaque: 0.004, reverb: 0.7 });
    S.souffle({ dur: 0.45, f1: 3000, f2: 500, gain: 0.16, q: 1, retard: 0.03, reverb: 0.3 });
  },
  // contrôle du ballon (ou déviation) : petit « tup » amorti, deux variantes (pied droit / pied gauche)
  grab: (S) => {
    if (!S.limite('grab', 70)) return;
    const v = hasard(2);
    S.choc({ f: 190 + 30 * v, f2: 110, dur: 0.055, gain: 0.13, clic: 0.3, fClic: 1300 + 400 * v, reverb: 0.15 });
    S.ton({ f: 360 + 40 * v, f2: 300, dur: 0.045, onde: 'sine', gain: 0.03, attaque: 0.002, reverb: 0.15 });
  },
  // glissade (le tacle part) : frottement sur la surface du jour + bruissement des maillots
  slide: (S, arg) => {
    if (!S.limite('slide', 80)) return;
    sol(S, lire(arg).ter, 0.5, 0.075, 0);
    S.bruit({ dur: 0.18, gain: 0.1, couleur: 'rose', filtre: { type: 'bandpass', f: 600, q: 1 }, attaque: 0.01, reverb: 0.2 });
  },
  // tacle qui touche : choc des corps (sous-grave + crampons sur les tibias), tissus, glissé au sol ;
  // ballon arraché : un « poc » de cuir qui s'échappe juste après
  tackle: (S, arg) => {
    if (!S.limite('tackle', 60)) return;
    const a = lire(arg);
    S.choc({ f: 115, f2: 50, dur: 0.2, gain: 0.3, clic: 0.45, fClic: 1100, reverb: 0.3 });
    S.bruit({ dur: 0.08, gain: 0.12, couleur: 'rose', filtre: { type: 'bandpass', f: 800, q: 1.1 }, attaque: 0.002, reverb: 0.25 });
    sol(S, a.ter, 0.3, 0.06, 0.04);
    if (a.vol) S.choc({ f: 260, f2: 140, dur: 0.06, gain: 0.12, clic: 0.5, fClic: 2200, retard: 0.05, reverb: 0.25 });
  },
  // tacle raté : le joueur s'étale (impact mat du corps) puis glisse un peu sur le sol
  miss: (S, arg) => {
    if (!S.limite('miss', 80)) return;
    S.choc({ f: 95, f2: 48, dur: 0.18, gain: 0.2, clic: 0.2, fClic: 900, reverb: 0.25 });
    sol(S, lire(arg).ter, 0.32, 0.06, 0.02);
  },
  // poteau : claquement du cuir, puis le tube d'aluminium qui sonne (partiels inharmoniques en FM) et un reflet aigu
  post: (S, arg) => {
    if (!S.limite('post', 90)) return;
    const k = 0.55 + 0.45 * borne(arg, 0.6);
    S.choc({ f: 200, f2: 100, dur: 0.07, gain: 0.22 * k, clic: 0.7, fClic: 2600, reverb: 0.3 });
    S.fm({ f: 640, ratio: 2.76, indice: 2.2, dur: 1.3, gain: 0.11 * k, attaque: 0.002, reverb: 0.5 });
    S.fm({ f: 1530, ratio: 1.41, indice: 1.1, dur: 0.8, gain: 0.05 * k, attaque: 0.002, reverb: 0.5 });
    S.ton({ f: 2380, dur: 0.35, onde: 'sine', gain: 0.012 * k, attaque: 0.002, reverb: 0.5 });
  },
  // ballon contre le bord : panneaux publicitaires creux (stade, plage), bande de patinoire, mur élastique du flipper,
  // mur amorti par la boue ; le niveau suit la force de l'impact
  wall: (S, arg) => {
    if (!S.limite('wall', 50)) return;
    const a = lire(arg), k = 0.35 + 0.65 * a.f;
    if (a.ter === 'flipper') {                          // caoutchouc qui claque et renvoie : « bwoing » court, filtré
      S.choc({ f: 170, f2: 90, dur: 0.08, gain: 0.2 * k, clic: 0.5, fClic: 2000, reverb: 0.3 });
      S.ton({ f: 150, f2: 230, glisse: 0.35, dur: 0.22, onde: 'doux', gain: 0.12 * k, attaque: 0.003, vibrato: { f: 16, prof: 0.6 }, filtre: { type: 'lowpass', f: 1200 }, reverb: 0.3 });
      return;
    }
    if (a.ter === 'glace') {                            // bande de hockey : bois + plexiglas qui vibre
      S.choc({ f: 140, f2: 70, dur: 0.12, gain: 0.24 * k, clic: 0.6, fClic: 1800, reverb: 0.4 });
      S.bruit({ dur: 0.25, gain: 0.07 * k, couleur: 'blanc', filtre: { type: 'bandpass', f: 3200, q: 5 }, attaque: 0.002, reverb: 0.4 });
      S.corde({ f: 98, dur: 0.3, gain: 0.08 * k, clarte: 0.25, reverb: 0.4 });
      return;
    }
    const mou = a.ter === 'boue';
    S.choc({ f: mou ? 110 : 150, f2: mou ? 60 : 75, dur: mou ? 0.12 : 0.09, gain: 0.22 * k, clic: mou ? 0.15 : 0.5, fClic: 1500, reverb: 0.3 });
    S.corde({ f: 120 + Math.random() * 30, dur: 0.22, gain: (mou ? 0.04 : 0.09) * k, clarte: 0.15, reverb: 0.3 });   // panneau qui résonne
    if (mou) S.bruit({ dur: 0.1, gain: 0.08 * k, couleur: 'brun', filtre: { type: 'lowpass', f: 700 }, attaque: 0.003, reverb: 0.2 });
  },
  // bumper du flipper : bobine qui claque, carillon électrique (do / mi / sol au hasard : le flipper « joue »), petit zip d'arcade filtré
  bump: (S) => {
    if (!S.limite('bump', 60)) return;
    const n = [1046.5, 1318.5, 1568][hasard(3)];
    S.choc({ f: 230, f2: 90, dur: 0.09, gain: 0.22, clic: 0.8, fClic: 3200, reverb: 0.25 });
    S.fm({ f: n, ratio: 3.5, indice: 1.4, dur: 0.5, gain: 0.06, attaque: 0.002, reverb: 0.45 });
    S.ton({ f: n / 2, f2: n, dur: 0.1, onde: 'creux', gain: 0.05, attaque: 0.003, filtre: { type: 'lowpass', f: 2600 }, reverb: 0.3 });
  },
  // le vent tourne (tempête) : rafale large qui monte et retombe, contre-souffle, grondement grave, plainte légère dans les tribunes
  wind: (S) => {
    S.souffle({ dur: 1.8, f1: 260, f2: 1100, gain: 0.16, q: 0.7, reverb: 0.4 });
    S.souffle({ dur: 1.4, f1: 900, f2: 380, gain: 0.14, q: 1.1, retard: 0.45, reverb: 0.4 });
    S.bruit({ dur: 2, gain: 0.05, couleur: 'brun', filtre: { type: 'lowpass', f: 380 }, attaque: 0.6, reverb: 0.3 });
    S.ton({ f: 760, f2: 980, dur: 1.3, onde: 'sine', gain: 0.012, attaque: 0.5, vibrato: { f: 0.9, prof: 1.2 }, retard: 0.25, reverb: 0.6 });
  },
  // bonus ramassé : carillon de l'écran géant (deux notes rondes, trois tournures au hasard) + éclat de cloche
  pickup: (S) => {
    if (!S.limite('pickup', 90)) return;
    const v = [[784, 1175], [880, 1318.5], [698.5, 1046.5]][hasard(3)];
    S.accord({ notes: v, ecart: 0.075, onde: 'doux', dur: 0.4, gain: 0.08, attaque: 0.004, reverb: 0.4 });
    S.fm({ f: v[1] * 2, ratio: 2, indice: 0.7, dur: 0.45, gain: 0.025, retard: 0.075, reverb: 0.5 });
  },
  // malus subi : « bouh » adouci du tableau d'affichage (deux notes qui descendent, timbre de clarinette filtré, léger « wah »)
  malus: (S) => {
    S.ton({ f: 349, f2: 330, dur: 0.24, onde: 'creux', gain: 0.14, attaque: 0.008, filtre: { type: 'lowpass', f: 1500, f2: 900 }, reverb: 0.35 });
    S.ton({ f: 262, f2: 233, dur: 0.42, onde: 'creux', gain: 0.14, attaque: 0.01, retard: 0.17, vibrato: { f: 5.5, prof: 0.25 }, filtre: { type: 'lowpass', f: 1300, f2: 600 }, reverb: 0.35 });
    S.ton({ f: 131, dur: 0.5, onde: 'sine', gain: 0.05, attaque: 0.01, retard: 0.17, reverb: 0.3 });
  },
  // BUT : le ballon s'enfonce dans le filet (« floump »), les mailles frémissent, les tribunes tremblent et le stade explose
  goal: (S) => {
    if (!S.limite('goal', 400)) return;
    S.choc({ f: 95, f2: 50, dur: 0.22, gain: 0.2, clic: 0.25, fClic: 900, reverb: 0.3 });
    S.bruit({ dur: 0.3, gain: 0.14, couleur: 'rose', filtre: { type: 'lowpass', f: 1400, f2: 400 }, attaque: 0.004, reverb: 0.3 });
    S.bruit({ dur: 0.55, gain: 0.07, couleur: 'blanc', filtre: { type: 'bandpass', f: 3800, f2: 2200, q: 1.8 }, attaque: 0.01, retard: 0.02, reverb: 0.3 });
    S.membrane({ f: 52, dur: 0.7, gain: 0.16, clic: 0.1, retard: 0.12, reverb: 0.8 });
    S.foule({ dur: 3.4, gain: 0.3, elan: 0.12 + Math.random() * 0.06, retard: 0.08 });
    S.bruit({ dur: 2.6, gain: 0.07, couleur: 'blanc', filtre: { type: 'bandpass', f: 2600, q: 0.7 }, attaque: 0.5, retard: 0.3, reverb: 0.9 });   // cris aigus, applaudissements
  },
  // occasion manquée (poteau appuyé) : « Ooooh ! » de la foule, clameur courte au timbre de voyelle « o » qui s'ouvre
  ooh: (S) => {
    if (!S.limite('ooh', 1200)) return;
    S.foule({ dur: 1.6, gain: 0.13, elan: 0.35 });
    S.bruit({ dur: 1.5, gain: 0.3, couleur: 'rose', filtre: { type: 'bandpass', f: 380, f2: 520, q: 2.2 }, attaque: 0.45, reverb: 0.8 });
    S.bruit({ dur: 1.3, gain: 0.16, couleur: 'rose', filtre: { type: 'bandpass', f: 760, f2: 900, q: 2.5 }, attaque: 0.4, retard: 0.05, reverb: 0.8 });
  },
  // décompte : bip du tableau d'affichage (sol, à l'octave de la note de la musique) + petite cloche
  count: (S) => {
    S.ton({ f: 784, dur: 0.18, onde: 'doux', gain: 0.13, attaque: 0.003, reverb: 0.35 });
    S.fm({ f: 1568, ratio: 2, indice: 0.5, dur: 0.22, gain: 0.025, attaque: 0.002, reverb: 0.4 });
  },
  // fin de manche : ovation (clameur longue, nappe d'applaudissements, claps isolés) et carillon de l'écran en sol majeur,
  // la tonalité de la fanfare de la musique
  win: (S) => {
    S.foule({ dur: 3.8, gain: 0.24, elan: 0.2 });
    S.bruit({ dur: 3.2, gain: 0.08, couleur: 'blanc', filtre: { type: 'bandpass', f: 2300, q: 0.6 }, attaque: 0.7, retard: 0.15, reverb: 0.9 });
    for (let i = 0; i < 20; i++) S.bruit({ dur: 0.018, gain: 0.02 + Math.random() * 0.015, couleur: 'blanc', filtre: { type: 'bandpass', f: 1300 + Math.random() * 1500, q: 1.3 }, attaque: 0.001, retard: 0.2 + Math.random() * 2.4, reverb: 0.7, varie: 0.2 });
    S.accord({ notes: [392, 493.88, 587.33, 783.99], ecart: 0.12, onde: 'doux', dur: 1, gain: 0.05, attaque: 0.005, reverb: 0.6 });
  },
  // sifflet de l'arbitre : début de manche = deux brefs ; coup d'envoi = bref + long ; engagement après un but = un bref
  // un peu appuyé ; fin de manche = deux brefs + un long (plus fort)
  whistle: (S, arg) => {
    const k = typeof arg === 'string' ? arg : 'go';
    const motif = k === 'kick' ? [0.42] : k === 'start' ? [0.34, 0.34] : k === 'end' ? [0.34, 0.34, 0.95] : [0.34, 0.95];
    const g = k === 'end' ? 0.1 : 0.09;
    for (let i = 0; i < motif.length; i++) coup(S, motif[i], g, i * 0.3);
  },
};

export const DEMO = [
  { k: 'whistle', arg: 'start', nom: 'Sifflet : début de manche' },
  { k: 'count', nom: 'Décompte (tableau d\'affichage)' },
  { k: 'whistle', arg: 'go', nom: 'Sifflet : coup d\'envoi' },
  { k: 'kick', arg: 0.15, nom: 'Passe (frappe légère)' },
  { k: 'kick', arg: 0.6, nom: 'Frappe' },
  { k: 'kick', arg: 1, nom: 'Frappe chargée à fond' },
  { k: 'canon', nom: 'Tir canon (bonus)' },
  { k: 'grab', nom: 'Contrôle du ballon / déviation' },
  { k: 'slide', arg: 'stade', nom: 'Glissade sur la pelouse' },
  { k: 'slide', arg: 'boue', nom: 'Glissade dans la boue' },
  { k: 'slide', arg: 'glace', nom: 'Glissade sur la glace' },
  { k: 'slide', arg: 'tempete', nom: 'Glissade dans le sable' },
  { k: 'slide', arg: 'flipper', nom: 'Glissade sur le plateau du flipper' },
  { k: 'tackle', arg: { ter: 'stade', vol: 0 }, nom: 'Tacle (bousculade)' },
  { k: 'tackle', arg: { ter: 'stade', vol: 1 }, nom: 'Tacle qui arrache le ballon' },
  { k: 'tackle', arg: { ter: 'boue', vol: 1 }, nom: 'Tacle dans la boue' },
  { k: 'miss', arg: 'stade', nom: 'Tacle raté : chute sur la pelouse' },
  { k: 'miss', arg: 'glace', nom: 'Tacle raté : chute sur la glace' },
  { k: 'post', arg: 0.3, nom: 'Poteau effleuré' },
  { k: 'post', arg: 1, nom: 'Poteau plein fer' },
  { k: 'ooh', nom: 'Occasion manquée : « Ooooh ! »' },
  { k: 'wall', arg: { f: 0.3, ter: 'stade' }, nom: 'Ballon contre les panneaux (doux)' },
  { k: 'wall', arg: { f: 1, ter: 'stade' }, nom: 'Ballon contre les panneaux (fort)' },
  { k: 'wall', arg: { f: 1, ter: 'boue' }, nom: 'Mur amorti (boue)' },
  { k: 'wall', arg: { f: 1, ter: 'glace' }, nom: 'Bande de patinoire' },
  { k: 'wall', arg: { f: 1, ter: 'flipper' }, nom: 'Mur élastique du flipper' },
  { k: 'bump', nom: 'Bumper du flipper' },
  { k: 'wind', nom: 'Le vent tourne (tempête)' },
  { k: 'pickup', nom: 'Bonus ramassé (écran du stade)' },
  { k: 'malus', nom: 'Malus subi' },
  { k: 'goal', nom: 'BUT ! (filet + clameur)' },
  { k: 'whistle', arg: 'kick', nom: 'Sifflet : engagement après un but' },
  { k: 'whistle', arg: 'end', nom: 'Sifflet : fin de manche' },
  { k: 'win', nom: 'Fin de manche : ovation' },
];

// Calage des niveaux après mesure sur /sons.html (29/10 : RMS sur 300 ms, plein spectre et haut-parleur de téléphone) :
// décomptes et petits sons fréquents relevés pour passer au-dessus de la musique.
function caler(T, f) { Object.keys(f).forEach(function (k) { const r = T[k], x = f[k]; T[k] = function (S, a) { S.plus(typeof x === 'function' ? x(a) : x, function () { r(S, a); }); }; }); }
caler(SONS, { count: 2, kick: 1.5, grab: 2.2, slide: 1.6, wall: 1.5, miss: 1.3 });
