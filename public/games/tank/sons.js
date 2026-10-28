// BRUITAGES DE TANKS — « Combat blindé · zone désertique ». Recettes jouées par la boîte à sons partagée (public/sfx.js).
// Module pur, sans import : client.js fait S.avec(pan, att, () => SONS[k](S, arg)) ; /sons.html joue la liste DEMO.
// Direction : réaliste et militaire, façon bruiteur de film de guerre. Canon = coup sourd (sous-grave qui plonge +
// détonation + souffle des gaz + petite queue), obus sur blindage = « clang » métallique (FM inharmonique), explosions
// avec grondement et débris d'acier, baril = explosion + boule de feu, caisse en bois qui éclate (bois sourd + échardes),
// mine = cliquetis mécanique, EMP = décharge crépitante, ramassage = culasse qui claque + petit clairon.
// Le désert est un lieu OUVERT : réverbération courte, sèche et peu mixée (aucun mur pour renvoyer le son).

export const SALLE = { duree: 0.6, mix: 0.12, clarte: 0.4 };   // plein air : juste un léger retour du sable, vite éteint
export const NIVEAU = 1;

const hasard = (a, b) => a + Math.random() * (b - a);
const parmi = t => t[(Math.random() * t.length) | 0];

// Coup de canon, partagé par le tir (k = 1) et la salve « FEU ! » (un coup plein + deux échos de la ligne de chars).
// k = puissance, r = retard (s), loin = 0..1 (distance : moins de claquement, plus d'air et de salle).
function canon(S, k, r, loin) {
  const f = hasard(0.92, 1.08);                        // calibre légèrement différent d'un coup à l'autre
  S.choc({ f: 105 * f, f2: 36, dur: 0.34, gain: 0.24 * k, clic: 0.45 - 0.3 * loin, fClic: 1300, retard: r, reverb: 0.35 + 0.4 * loin });   // poussée sous-grave
  S.bruit({ dur: 0.045, gain: 0.15 * k * (1 - 0.6 * loin), couleur: 'blanc', filtre: { type: 'bandpass', f: 1700 * f, q: 0.6 }, attaque: 0.001, retard: r, reverb: 0.4 });   // détonation à la bouche
  S.bruit({ dur: 0.38, gain: 0.2 * k, couleur: 'brun', filtre: { type: 'lowpass', f: 1500 - 700 * loin, f2: 160 }, attaque: 0.003, retard: r, reverb: 0.5 + 0.4 * loin });   // souffle des gaz
  S.bruit({ dur: 0.7, gain: 0.06 * k, couleur: 'rose', filtre: { type: 'lowpass', f: 650, f2: 140 }, attaque: 0.03, retard: r + 0.04, reverb: 0.9 });   // queue : roulement qui s'éteint sur les dunes
}

export const SONS = {
  // tir : très fréquent (2 obus en vol par char, 8 chars) → regroupé s'il part dans le même message réseau
  shot: S => {
    if (!S.limite('shot', 25)) return;
    canon(S, 1, 0, 0);
    S.ton({ f: 380, f2: 170, dur: 0.12, onde: 'doux', gain: 0.12, attaque: 0.002, reverb: 0.3 });   // claquement médium du coup (porte sur un haut-parleur de téléphone)
    S.fm({ f: hasard(320, 380), ratio: 1.41, indice: 2.2, dur: 0.1, gain: 0.018, retard: 0.08, reverb: 0.2 });   // recul : la culasse revient en place
  },
  // obus sur blindage (le char perd une vie) : choc sec + deux partiels métalliques inharmoniques + gerbe d'étincelles
  hit: S => {
    if (!S.limite('hit', 45)) return;
    const f = parmi([470, 530, 600]);                  // trois tôles différentes : jamais deux fois le même « clang »
    S.choc({ f: 240, f2: 95, dur: 0.12, gain: 0.2, clic: 0.9, fClic: 3200, reverb: 0.3 });
    S.fm({ f: f, ratio: 1.414, indice: 4.5, dur: 0.42, gain: 0.075, reverb: 0.4 });
    S.fm({ f: f * 1.51, ratio: 2.76, indice: 2.2, dur: 0.26, gain: 0.045, reverb: 0.4 });
    S.bruit({ dur: 0.07, gain: 0.1, couleur: 'blanc', filtre: { type: 'highpass', f: 3800 }, attaque: 0.001, reverb: 0.2 });   // étincelles
  },
  // bouclier : l'obus s'écrase sur le champ, qui encaisse en remontant puis tinte
  shield: S => {
    if (!S.limite('shield', 50)) return;
    S.choc({ f: 280, f2: 150, dur: 0.07, gain: 0.16, clic: 0.5, fClic: 3000, reverb: 0.3 });
    S.ton({ f: 480, f2: 1450, glisse: 0.65, dur: 0.24, onde: 'doux', gain: 0.16, attaque: 0.008, vibrato: { f: 24, prof: 0.35 }, reverb: 0.5 });
    S.fm({ f: 1900, ratio: 2.01, indice: 1.3, dur: 0.5, gain: 0.05, retard: 0.06, reverb: 0.6 });   // tintement cristallin
    S.bruit({ dur: 0.2, gain: 0.07, couleur: 'blanc', filtre: { type: 'highpass', f: 5200 }, attaque: 0.004, reverb: 0.4 });   // grésillement d'énergie
  },
  // explosion d'un char : arg 0,6 = touché (il perd une vie et réapparaît), 1 = détruit ou mine qui saute
  boom: (S, a) => {
    const t = a == null ? 1 : Math.max(0.3, Math.min(1.2, a)), gros = t >= 0.9;
    if (!S.limite(gros ? 'boom' : 'boomP', 50)) return;   // plusieurs chars pris dans un même baril : une seule détonation par taille
    S.explosion({ taille: 0.45 + 0.7 * t, gain: 0.2 + 0.15 * t });
    S.choc({ f: 62, f2: 28, dur: 0.5 + 0.4 * t, gain: 0.14 * t, clic: 0, reverb: 0.3 });   // coup dans la poitrine
    const n = gros ? 4 : 2;
    for (let i = 0; i < n; i++) S.fm({ f: hasard(520, 1300), ratio: hasard(1.3, 2.1), indice: 2, dur: hasard(0.08, 0.18), gain: hasard(0.018, 0.032), retard: hasard(0.18, 0.35 + 0.45 * t), reverb: 0.5, varie: 0.15 });   // éclats d'acier qui retombent
    if (gros) {                                        // char détruit : les munitions détonent en second, puis l'épave flambe
      S.explosion({ taille: 0.4, gain: 0.12, retard: hasard(0.28, 0.42) });
      S.souffle({ dur: 1.1, f1: 300, f2: 900, gain: 0.12, q: 0.8, retard: 0.12, reverb: 0.5 });
    }
  },
  // baril : explosion large + « whoump » de l'air chassé + fût qui se déchire + boule de feu + carburant qui brûle
  barrel: S => {
    if (!S.limite('barrel', 70)) return;               // une chaîne de barils garde ses détonations successives, pas les doublons
    S.explosion({ taille: 1.45, gain: 0.33 });
    S.membrane({ f: 48, dur: 0.9, gain: 0.2, clic: 0.2, reverb: 0.4 });
    S.fm({ f: hasard(190, 230), ratio: 1.47, indice: 3.5, dur: 0.45, gain: 0.04, reverb: 0.4 });
    S.souffle({ dur: 0.75, f1: 220, f2: 1100, gain: 0.3, q: 0.7, couleur: 'brun', retard: 0.02, reverb: 0.6 });
    S.bruit({ dur: 1.5, gain: 0.07, couleur: 'rose', filtre: { type: 'bandpass', f: 700, f2: 260, q: 0.6 }, attaque: 0.3, retard: 0.25, reverb: 0.7 });
  },
  // caisse en bois qui éclate : planche qui craque, caisse creuse (corde très sourde), échardes qui retombent
  wood: S => {
    if (!S.limite('wood', 40)) return;
    S.bruit({ dur: 0.05, gain: 0.22, couleur: 'blanc', filtre: { type: 'bandpass', f: hasard(1500, 2100), q: 1.1 }, attaque: 0.001, reverb: 0.3 });
    S.choc({ f: 170, f2: 85, dur: 0.12, gain: 0.18, clic: 0.4, fClic: 900, reverb: 0.3 });
    S.corde({ f: hasard(120, 160), dur: 0.22, gain: 0.2, clarte: 0.08, reverb: 0.3 });
    for (let i = 0; i < 3; i++) {
      const r = 0.05 + i * hasard(0.04, 0.07);
      S.corde({ f: hasard(260, 520), dur: 0.09, gain: 0.07, clarte: 0.15, retard: r, reverb: 0.4 });
      S.bruit({ dur: 0.018, gain: 0.06, couleur: 'blanc', filtre: { type: 'bandpass', f: hasard(2500, 4200), q: 2.5 }, attaque: 0.001, retard: r });
    }
  },
  // plaque d'acier rivetée percée : coup lourd, tôle qui résonne grave, raclement, rivets qui sautent
  metal: S => {
    if (!S.limite('metal', 40)) return;
    const f = parmi([300, 340, 385]);
    S.choc({ f: 140, f2: 60, dur: 0.2, gain: 0.26, clic: 0.7, fClic: 2400, reverb: 0.4 });
    S.fm({ f: f, ratio: 1.41, indice: 5, dur: 0.7, gain: 0.08, reverb: 0.5 });
    S.fm({ f: f * 1.73, ratio: 2.31, indice: 3, dur: 0.45, gain: 0.04, reverb: 0.5 });
    S.bruit({ dur: 0.28, gain: 0.07, couleur: 'blanc', filtre: { type: 'bandpass', f: 3400, f2: 1600, q: 4 }, attaque: 0.006, retard: 0.03, reverb: 0.3 });
    for (let i = 0; i < 2; i++) S.fm({ f: hasard(1800, 2600), ratio: 1.41, indice: 1.5, dur: 0.06, gain: 0.02, retard: hasard(0.06, 0.2) });
  },
  // bonus ramassé : culasse (verrou tiré, aigu, puis repoussé, plus sourd) + clairon de deux notes
  pickup: S => {
    if (!S.limite('pickup', 60)) return;
    S.bruit({ dur: 0.022, gain: 0.12, couleur: 'blanc', filtre: { type: 'highpass', f: 2800 }, attaque: 0.001, reverb: 0.15 });
    S.fm({ f: 1650, ratio: 1.41, indice: 1.6, dur: 0.05, gain: 0.025, reverb: 0.15 });
    S.choc({ f: 420, f2: 220, dur: 0.05, gain: 0.12, clic: 1, fClic: 2000, retard: 0.065, reverb: 0.15 });
    // le clairon n'a pas de pistons : notes de la série naturelle seulement (sol, do, mi), son de cuivre « creux » + vibrato
    const m = parmi([[392, 523.25], [523.25, 659.25], [392, 659.25]]);
    S.ton({ f: m[0], dur: 0.11, onde: 'creux', gain: 0.1, attaque: 0.012, vibrato: { f: 5.5, prof: 0.08 }, filtre: { type: 'lowpass', f: 2600 }, retard: 0.11, reverb: 0.4 });
    S.ton({ f: m[1], dur: 0.26, onde: 'creux', gain: 0.11, attaque: 0.015, vibrato: { f: 5.5, prof: 0.18 }, filtre: { type: 'lowpass', f: 2600 }, retard: 0.21, reverb: 0.4 });
  },
  // mine posée : enfoncée dans le sable, puis trois crans d'armement (le dernier plus franc)
  mineset: S => {
    if (!S.limite('mineset', 50)) return;
    S.choc({ f: 115, f2: 60, dur: 0.1, gain: 0.16, clic: 0.25, fClic: 900, reverb: 0.2 });
    S.bruit({ dur: 0.14, gain: 0.09, couleur: 'rose', filtre: { type: 'lowpass', f: 2400, f2: 900 }, attaque: 0.006, reverb: 0.2 });   // sable qui glisse
    for (let i = 0; i < 3; i++) {
      const r = 0.09 + i * 0.065, fort = i === 2;
      S.bruit({ dur: 0.012, gain: fort ? 0.3 : 0.22, couleur: 'blanc', filtre: { type: 'bandpass', f: 3300 - i * 350, q: 2.5 }, attaque: 0.001, retard: r, reverb: 0.15 });
      S.fm({ f: 2200 - i * 260, ratio: 1.41, indice: 1.2, dur: 0.035, gain: fort ? 0.045 : 0.03, retard: r, reverb: 0.15 });
    }
  },
  // EMP subi : bourdonnement électrique (dent de scie VOULUE, filtrée, qui se referme), décharge qui retombe, arcs qui claquent
  emp: S => {
    if (!S.limite('emp', 80)) return;                  // un EMP étourdit plusieurs chars d'un coup : une seule décharge
    S.ton({ f: 95, dur: 0.5, onde: 'sawtooth', gain: 0.14, attaque: 0.004, vibrato: { f: 31, prof: 1.2 }, filtre: { type: 'lowpass', f: 2600, f2: 260, q: 5 }, reverb: 0.3 });
    S.ton({ f: 2600, f2: 180, glisse: 0.7, dur: 0.32, onde: 'triangle', gain: 0.07, reverb: 0.4 });
    S.bruit({ dur: 0.42, gain: 0.1, couleur: 'blanc', filtre: { type: 'highpass', f: 4200 }, attaque: 0.003, reverb: 0.3 });   // grésillement
    for (let i = 0; i < 5; i++) S.bruit({ dur: hasard(0.006, 0.018), gain: hasard(0.1, 0.17), couleur: 'blanc', filtre: { type: 'bandpass', f: hasard(2500, 6500), q: 1.5 }, attaque: 0.001, retard: hasard(0, 0.4), varie: 0.2 });
  },
  // décompte 3·2·1 : bip radio (sinus pur + octave discrète) et petit souffle de relâche du micro
  count: S => {
    S.ton({ f: 880, dur: 0.13, onde: 'sine', gain: 0.15, attaque: 0.006, reverb: 0.25 });
    S.ton({ f: 1760, dur: 0.07, onde: 'sine', gain: 0.025, attaque: 0.004, reverb: 0.2 });
    S.bruit({ dur: 0.03, gain: 0.04, couleur: 'blanc', filtre: { type: 'bandpass', f: 2500, q: 1 }, attaque: 0.002, retard: 0.13 });
  },
  // « FEU ! » : salve d'ouverture — un coup plein, puis deux chars plus loin sur la ligne
  go: S => {
    canon(S, 1.1, 0, 0);
    canon(S, 0.5, 0.15, 0.6);
    canon(S, 0.35, 0.32, 1);
    S.ton({ f: 1320, dur: 0.3, onde: 'sine', gain: 0.14, attaque: 0.004, retard: 0.02, reverb: 0.3 });   // bip de départ : la salve seule est trop grave pour un téléphone
  },
  // victoire : clairon (sol-do-mi-sol, série naturelle), doublé sur la tenue, + coup de grosse caisse militaire
  win: S => {
    const N = [[392, 0, 0.13], [523.25, 0.13, 0.13], [659.25, 0.26, 0.15], [784, 0.42, 0.75]];   // [Hz, départ, durée]
    for (let i = 0; i < N.length; i++) {
      const fin = i === N.length - 1;
      S.ton({ f: N[i][0], dur: N[i][2], onde: 'creux', gain: 0.24, attaque: fin ? 0.025 : 0.014, vibrato: { f: 5.2, prof: fin ? 0.22 : 0.06 }, filtre: { type: 'lowpass', f: 3000 }, retard: N[i][1], reverb: 0.55, varie: 0.01 });
    }
    S.ton({ f: 784, dur: 0.75, onde: 'creux', gain: 0.08, det: 9, attaque: 0.04, vibrato: { f: 4.7, prof: 0.2 }, filtre: { type: 'lowpass', f: 2200 }, retard: 0.43, reverb: 0.6, varie: 0.01 });   // second clairon, à peine désaccordé
    S.membrane({ f: 70, dur: 0.9, gain: 0.28, retard: 0.42, reverb: 0.5 });
  },
};

// Page d'écoute (/sons.html) : toutes les clés, et les deux tailles d'explosion.
export const DEMO = [
  { k: 'shot', nom: 'Tir de canon' },
  { k: 'hit', nom: 'Obus sur blindage (char touché)' },
  { k: 'shield', nom: 'Bouclier : tir encaissé' },
  { k: 'boom', arg: 0.6, nom: 'Explosion : char touché, il perd une vie' },
  { k: 'boom', arg: 1, nom: 'Explosion : char détruit ou mine' },
  { k: 'barrel', nom: 'Baril explosif' },
  { k: 'wood', nom: 'Caisse en bois qui éclate' },
  { k: 'metal', nom: 'Plaque d\'acier percée' },
  { k: 'pickup', nom: 'Bonus ramassé : culasse + clairon' },
  { k: 'mineset', nom: 'Mine posée et armée' },
  { k: 'emp', nom: 'Décharge EMP (char étourdi)' },
  { k: 'count', nom: 'Décompte 3·2·1 : bip radio' },
  { k: 'go', nom: '« FEU ! » : salve de départ' },
  { k: 'win', nom: 'Victoire : clairon' },
];

// Calage des niveaux après mesure sur /sons.html (29/10 : RMS sur 300 ms, plein spectre et haut-parleur de téléphone) :
// décomptes et petits sons fréquents relevés pour passer au-dessus de la musique.
function caler(T, f) { Object.keys(f).forEach(function (k) { const r = T[k], x = f[k]; T[k] = function (S, a) { S.plus(typeof x === 'function' ? x(a) : x, function () { r(S, a); }); }; }); }
caler(SONS, { count: 2, mineset: 1.6 });
