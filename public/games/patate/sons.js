// Bruitages de la PATATE CHAUDE — « Pique-nique · refile la patate avant le boum ». Recettes jouées par la boîte partagée
// public/sfx.js (module pur, aucun import) ; elles s'écoutent toutes sur /sons.html.
// Palette : comique et estivale, en plein air sur une nappe vichy. Passe = « pop » + « fwip » + alu froissé à la réception ;
// bonus = « squish » mou ; nouvelle patate = sifflet de chute + « boing » ; explosion = gros boum rond (grosse caisse de
// dessin animé) qui retombe en purée et en miettes sur la nappe ; tic-tac de minuteur de cuisine, décompte = on remonte le
// minuteur, coup d'envoi = sa sonnerie ; victoire = bouchon de cidre, glockenspiel-jouet et copains qui acclament.
// Niveaux visés (crête en sortie) : tic-tac / ramassage / décompte -24 à -18 dB ; passe / chute / coup d'envoi -18 à -12 ;
// explosion et victoire -12 à -6.

// Plein air : pas de salle, juste un retour très court et clair (le sol, les arbres proches).
export const SALLE = { duree: 0.4, mix: 0.07, clarte: 0.65 };
export const NIVEAU = 1;

const rnd = (a, b) => a + Math.random() * (b - a);
const chaleur = a => typeof a === 'number' && isFinite(a) ? Math.max(0, Math.min(1, a)) : 0;   // arg du tic-tac : 0 tiède → 1 brûlante
const POPS = [1, 1.14, 0.9];                             // 3 « pop » de passe joués à tour de rôle (une passe toutes les 2 s : jamais deux fois le même)
let tourPop = 0;
const GLOCK = [783.99, 987.77, 1174.66, 1567.98];        // sol5 si5 ré6 sol6 : une octave au-dessus de la fanfare 'win' de music.js (base 392, même cadence)

// Papier alu froissé : n micro-craquements aigus et serrés (la patate est emballée dans l'alu).
function alu(S, n, r, g) {
  for (let i = 0; i < n; i++) S.bruit({ dur: rnd(0.008, 0.018), couleur: 'blanc', filtre: { type: 'bandpass', f: rnd(4200, 7200), q: 2.2 }, attaque: 0.001, gain: g * rnd(0.7, 1), retard: r + i * 0.017 + rnd(0, 0.008), reverb: 0.2, varie: 0.15 });
}
// « Squish » mou : bruit rose dont la résonance plonge (matière molle qu'on écrase dans la main) + petit corps grave,
// et une petite succion qui remonte à la fin (« -ich »).
function squish(S, r) {
  S.bruit({ dur: 0.14, couleur: 'rose', filtre: { type: 'bandpass', f: S.varier(1500, 0.08), f2: 420, q: 3 }, attaque: 0.012, gain: 0.45, retard: r, reverb: 0.25, varie: 0.1 });
  S.ton({ f: 330, f2: 190, dur: 0.11, onde: 'sine', gain: 0.1, attaque: 0.008, retard: r, reverb: 0.2 });
  S.ton({ f: 620, f2: 980, dur: 0.05, onde: 'sine', gain: 0.04, attaque: 0.004, retard: r + 0.08, reverb: 0.2 });
}

export const SONS = {
  // passe (contact) : « pop » de bulle qui claque (3 hauteurs à tour de rôle), « fwip » de la patate qui fend l'air, puis
  // réception (« pat » dans les mains + alu froissé) vers 0,15 s, quand le vol de 170 ms se termine à l'écran.
  // arg = 1 : in extremis (explosion dans la seconde) → petit sifflet « wiii » qui monte, puis « fiouuu » de soulagement.
  pass: (S, arg) => {
    if (!S.limite('passe', 50)) return;
    tourPop = (tourPop + 1) % POPS.length;
    const P = POPS[tourPop];
    S.ton({ f: 420 * P, f2: 1150 * P, glisse: 0.4, dur: 0.075, onde: 'sine', gain: 0.2, attaque: 0.002, reverb: 0.3 });                  // « pop » : la hauteur saute vers le haut
    S.bruit({ dur: 0.012, couleur: 'blanc', filtre: { type: 'bandpass', f: 1800 * P, q: 1.2 }, attaque: 0.001, gain: 0.2, reverb: 0.3 });  // claquement de la bulle
    S.souffle({ dur: 0.14, f1: 600, f2: 3000, gain: 0.28, q: 1.3, retard: 0.01, reverb: 0.25 });                                         // « fwip »
    S.choc({ f: 210, f2: 120, dur: 0.07, gain: 0.08, clic: 0.25, fClic: 1200, retard: 0.15, reverb: 0.2, varie: 0.1 });                  // « pat » : rattrapée
    alu(S, 3, 0.15, 0.1);
    if (arg) {
      S.ton({ f: 900, f2: 1900, glisse: 0.75, dur: 0.26, onde: 'sine', gain: 0.08, attaque: 0.02, vibrato: { f: 7, prof: 0.4 }, retard: 0.05, reverb: 0.35 });
      S.souffle({ dur: 0.38, f1: 1700, f2: 600, gain: 0.1, q: 0.9, retard: 0.3, reverb: 0.3 });
    }
  },
  // explosion : détonation réaliste (S.explosion) arrondie par une énorme grosse caisse de dessin animé, « splotch » de purée,
  // la nappe qui claque en l'air (« frrrap »), des miettes qui retombent (« pat… pat ») et une fourchette qui tinte en retombant.
  // Deux patates dans la même seconde (≥ 7 joueurs) : la 2e est un boum plus sourd, sans tout redoubler.
  boom: S => {
    if (!S.limite('boum', 150)) {
      S.membrane({ f: 58, dur: 0.7, gain: 0.24 });
      S.bruit({ dur: 0.2, couleur: 'rose', filtre: { type: 'bandpass', f: 1000, f2: 280, q: 1.1 }, attaque: 0.003, gain: 0.2, retard: 0.03, reverb: 0.3 });
      return;
    }
    S.explosion({ taille: 0.7, gain: 0.22 });
    S.membrane({ f: S.varier(50, 0.05), dur: 1.0, gain: 0.3 });                                                                          // « BOUM » rond
    S.bruit({ dur: 0.24, couleur: 'rose', filtre: { type: 'bandpass', f: 1100, f2: 260, q: 1.1 }, attaque: 0.003, gain: 0.25, retard: 0.04, reverb: 0.3 });   // purée
    S.ton({ f: 240, f2: 90, dur: 0.14, onde: 'sine', gain: 0.09, attaque: 0.003, retard: 0.04, reverb: 0.2 });                           // corps mouillé du splotch
    for (let i = 0; i < 5; i++) S.bruit({ dur: 0.03, couleur: 'rose', filtre: { type: 'bandpass', f: 650 + i * 90, q: 0.9 }, attaque: 0.004, gain: 0.055 * (1 - i * 0.12), retard: 0.1 + i * 0.042 + rnd(0, 0.01), reverb: 0.3, varie: 0.15 });   // nappe
    for (let i = 0; i < 3; i++) { const f = rnd(240, 420); S.choc({ f: f, f2: f * 0.6, dur: 0.05, gain: rnd(0.045, 0.06), clic: 0.5, fClic: rnd(1300, 2200), retard: 0.34 + i * 0.14 + rnd(0, 0.07), reverb: 0.3, varie: 0.15 }); }   // miettes
    S.fm({ f: rnd(2400, 2900), ratio: 3.5, indice: 1.4, dur: 0.3, gain: 0.03, retard: rnd(0.5, 0.65), reverb: 0.4 });                    // fourchette
  },
  // nouvelle patate : elle tombe du ciel (vol de 430 ms à l'écran) — petit sifflet de chute, puis à l'arrivée dans les mains
  // « boing » de ressort (vibrato rapide, une octave de corps en dessous) + « pof » et alu froissé.
  spawn: S => {
    if (!S.limite('chute', 80)) return;
    const t = 0.38;
    S.ton({ f: 1500, f2: 650, dur: 0.36, onde: 'sine', gain: 0.05, attaque: 0.03, vibrato: { f: 6, prof: 0.25 }, reverb: 0.35 });        // sifflet de chute
    S.choc({ f: 150, f2: 85, dur: 0.12, gain: 0.2, clic: 0.3, fClic: 1100, retard: t, reverb: 0.25 });                                  // « pof »
    S.ton({ f: 170, f2: 330, glisse: 0.25, dur: 0.42, onde: 'doux', gain: 0.2, attaque: 0.004, vibrato: { f: 17, prof: 1.6 }, filtre: { type: 'lowpass', f: 2600, f2: 700 }, retard: t, reverb: 0.3 });   // « boing »
    S.ton({ f: 85, f2: 165, glisse: 0.25, dur: 0.3, onde: 'sine', gain: 0.12, attaque: 0.004, vibrato: { f: 17, prof: 1.6 }, retard: t, reverb: 0.3 });
    alu(S, 2, t + 0.01, 0.08);
  },
  // tic-tac (cadence réglée par le client selon la chaleur, ≥ 160 ms) : minuteur de cuisine. « Tic » = clic de plastique
  // aigu ; arg 0..1 = chaleur : plus fort, un peu plus aigu, et le ressort se met à tinter quand la patate est brûlante.
  tick: (S, arg) => {
    if (!S.limite('tictac', 80)) return;
    const h = chaleur(arg), k = 0.45 + 0.55 * h, p = 1 + 0.08 * h;
    S.bruit({ dur: 0.012, couleur: 'blanc', filtre: { type: 'bandpass', f: 3600 * p, q: 1.8 }, attaque: 0.001, gain: 0.22 * k, reverb: 0.15, varie: 0.08 });
    S.ton({ f: 1850 * p, dur: 0.028, onde: 'sine', gain: 0.1 * k, attaque: 0.001, reverb: 0.15 });
    if (h > 0.45) S.fm({ f: 2900 * p, ratio: 2.7, indice: 1, dur: 0.06, gain: 0.05 * (h - 0.3), attaque: 0.001, reverb: 0.2 });
  },
  // « Tac » : plus grave et plus boisé (le mécanisme retombe), même montée avec la chaleur.
  tack: (S, arg) => {
    if (!S.limite('tictac', 80)) return;
    const h = chaleur(arg), k = 0.45 + 0.55 * h, p = 1 + 0.08 * h;
    S.bruit({ dur: 0.014, couleur: 'blanc', filtre: { type: 'bandpass', f: 2400 * p, q: 1.5 }, attaque: 0.001, gain: 0.2 * k, reverb: 0.15, varie: 0.08 });
    S.ton({ f: 1300 * p, dur: 0.03, onde: 'sine', gain: 0.09 * k, attaque: 0.001, reverb: 0.15 });
    S.ton({ f: 640 * p, f2: 520 * p, dur: 0.04, onde: 'sine', gain: 0.07 * k, attaque: 0.001, reverb: 0.15 });
  },
  // bonus bouclier : « squish » du ramassage, puis une bulle protectrice qui se gonfle (« bloup ») et tinte comme du verre.
  pick0: S => {
    if (!S.limite('ramasse', 80)) return;
    squish(S, 0);
    S.ton({ f: 380, f2: 900, dur: 0.14, onde: 'sine', gain: 0.06, attaque: 0.01, retard: 0.06, reverb: 0.3 });
    S.fm({ f: 1567.98, ratio: 2, indice: 0.9, dur: 0.6, gain: 0.04, retard: 0.12, reverb: 0.45 });
    S.fm({ f: 2093, ratio: 2, indice: 0.7, dur: 0.55, gain: 0.03, retard: 0.18, reverb: 0.45 });
  },
  // bonus turbo : « squish », puis jouet à ressort qu'on remonte — zip vibrant qui grimpe + souffle qui file.
  pick1: S => {
    if (!S.limite('ramasse', 80)) return;
    squish(S, 0);
    S.ton({ f: 260, f2: 1250, dur: 0.22, onde: 'doux', gain: 0.07, attaque: 0.01, vibrato: { f: 28, prof: 0.7 }, filtre: { type: 'lowpass', f: 3200 }, retard: 0.05, reverb: 0.25 });
    S.souffle({ dur: 0.24, f1: 700, f2: 5200, gain: 0.16, q: 1.8, retard: 0.05, reverb: 0.3 });
  },
  // décompte 3·2·1 : on remonte le minuteur de cuisine — crémaillère « crrr », butée « toc » et petit tintement (sol6,
  // dans le ton de la note 'count' de music.js).
  count: S => {
    for (let i = 0; i < 5; i++) S.bruit({ dur: 0.01, couleur: 'blanc', filtre: { type: 'bandpass', f: 2800 + i * 180, q: 2.5 }, attaque: 0.001, gain: 0.12, retard: i * 0.024, reverb: 0.15, varie: 0.12 });
    S.choc({ f: 760, f2: 520, dur: 0.06, gain: 0.13, clic: 0.6, fClic: 2600, retard: 0.13, reverb: 0.2 });
    S.fm({ f: 1567.98, ratio: 2, indice: 0.7, dur: 0.3, gain: 0.04, retard: 0.13, reverb: 0.3 });
  },
  // coup d'envoi : le minuteur se déclenche (« clac ») et sonne — battant qui frappe la clochette en rafale « drrring »,
  // puis la clochette qui résonne encore (ré7 : la quinte de l'accord 'go' de music.js).
  go: S => {
    const n = 8, f = 2349.3;
    S.choc({ f: 600, f2: 420, dur: 0.05, gain: 0.08, clic: 0.7, fClic: 3000, reverb: 0.2 });
    for (let i = 0; i < n; i++) S.fm({ f: f, ratio: 1.41, indice: 1.6, dur: 0.16, gain: 0.04 * (1 - i * 0.05), attaque: 0.001, retard: 0.02 + i * 0.028, reverb: 0.3, varie: 0.03 });
    S.fm({ f: f, ratio: 1.41, indice: 1.1, dur: 1.0, gain: 0.05, attaque: 0.002, retard: 0.02 + n * 0.028, reverb: 0.4 });
  },
  // victoire : bouchon de cidre qui saute (« POP ») et pétille, glockenspiel-jouet calé sur la fanfare 'win' de music.js
  // (une octave au-dessus, même cadence 0,15 s), accord doux en sol, et les copains du pique-nique qui acclament.
  win: S => {
    S.ton({ f: 260, f2: 950, glisse: 0.3, dur: 0.06, onde: 'sine', gain: 0.36, attaque: 0.002, reverb: 0.3 });
    S.bruit({ dur: 0.016, couleur: 'blanc', filtre: { type: 'bandpass', f: 1600, q: 1 }, attaque: 0.001, gain: 0.25, reverb: 0.3 });
    S.bruit({ dur: 1.3, couleur: 'blanc', filtre: { type: 'highpass', f: 5500 }, attaque: 0.08, gain: 0.05, retard: 0.04, reverb: 0.2 });   // « pshhh »
    GLOCK.forEach((f, i) => S.fm({ f: f, ratio: 3.5, indice: 1, dur: 0.7, gain: 0.08, attaque: 0.002, retard: 0.02 + i * 0.15, reverb: 0.4 }));
    S.accord({ notes: [392, 493.88, 587.33], onde: 'doux', dur: 0.9, gain: 0.07, attaque: 0.02, retard: 0.47, reverb: 0.4 });
    S.foule({ dur: 1.6, gain: 0.09, elan: 0.2, retard: 0.15 });
  },
};

export const DEMO = [
  { k: 'pass', nom: 'Passe (pop + fwip + alu)' },
  { k: 'pass', arg: 1, nom: 'Passe in extremis (wiii… fiouuu)' },
  { k: 'boom', nom: 'BAOUM : la patate explose' },
  { k: 'spawn', nom: 'Nouvelle patate (chute + boing)' },
  { k: 'tick', arg: 0, nom: 'Tic du minuteur (patate tiède)' },
  { k: 'tack', arg: 0, nom: 'Tac du minuteur (patate tiède)' },
  { k: 'tick', arg: 0.6, nom: 'Tic (patate chaude)' },
  { k: 'tick', arg: 1, nom: 'Tic (patate brûlante)' },
  { k: 'tack', arg: 1, nom: 'Tac (patate brûlante)' },
  { k: 'pick0', nom: 'Bonus bouclier (squish + bulle)' },
  { k: 'pick1', nom: 'Bonus turbo (squish + zip)' },
  { k: 'count', nom: 'Décompte : on remonte le minuteur' },
  { k: 'go', nom: 'Coup d\'envoi : sonnerie du minuteur' },
  { k: 'win', nom: 'Victoire (bouchon de cidre + glockenspiel)' },
];

// Calage des niveaux après mesure sur /sons.html (29/10 : RMS sur 300 ms, plein spectre et haut-parleur de téléphone) :
// décomptes et petits sons fréquents relevés pour passer au-dessus de la musique.
function caler(T, f) { Object.keys(f).forEach(function (k) { const r = T[k], x = f[k]; T[k] = function (S, a) { S.plus(typeof x === 'function' ? x(a) : x, function () { r(S, a); }); }; }); }
caler(SONS, { tick: 2, tack: 2 });
