// BRUITAGES DE BOMBERMAN — identité « Confiserie » (cartoon / bonbons) : dessin animé rebondi et punchy.
// Recettes jouées par la boîte partagée public/sfx.js (S = creerSfx(...)), écoutables sur /sons.html.
// Avant (≤ 27/10) : ondes carrées / dents de scie nues branchées sur la sortie (« plop » sec, explosion en bruit blanc,
// malus en dent de scie qui râpe). Maintenant : 2 à 4 couches par son (corps grave + transitoire + texture), une petite
// salle chaleureuse, et un anti-mitraillage par S.limite (une réaction en chaîne = UN gros boum, pas vingt).
// Niveaux visés (crête en sortie) : décompte / ramassage ≈ -22 dB, événements courants ≈ -16 dB, explosion / élimination /
// victoire ≈ -10 dB. Le module est pur (aucun import) : le client l'importe, la page d'écoute aussi.

// petite pièce chaleureuse (salle de jeux, tapis, bois) : queue courte, un peu feutrée
export const SALLE = { duree: 0.6, mix: 0.14, clarte: 0.4 };
export const NIVEAU = 1;

const hasard = (a, b) => a + Math.random() * (b - a);
const choisir = l => l[(Math.random() * l.length) | 0];

// arpèges joyeux du ramassage : trois tonalités tirées au sort pour qu'on n'entende pas dix fois le même bonbon
const ARP_BONUS = [[784, 988, 1175, 1568], [880, 1109, 1319, 1760], [698, 880, 1047, 1397]];
// glissando de harpe (pentatonique majeure) du téléporteur
const HARPE = [392, 440, 523, 587, 659, 784, 880, 1047, 1175];

// grésillement de mèche : souffle aigu continu + quelques crépitements épars (réutilisé par la pose et le décompte)
function meche(S, retard, dur, gain) {
  S.bruit({ dur: dur, gain: gain, couleur: 'blanc', filtre: { type: 'bandpass', f: 6500, q: 0.8 }, attaque: dur * 0.15, retard: retard, reverb: 0.2, varie: 0.15 });
  const n = 3 + ((Math.random() * 2) | 0);
  for (let i = 0; i < n; i++) S.bruit({ dur: hasard(0.008, 0.016), gain: gain * hasard(0.9, 1.5), couleur: 'blanc', filtre: { type: 'bandpass', f: hasard(3200, 7500), q: 2.5 }, attaque: 0.001, retard: retard + hasard(0.01, dur * 0.85), reverb: 0.15, varie: 0.3 });
}

export const SONS = {
  // bombe posée : « plop » rond (sinus qui grimpe vite) + la bombe qui se pose + la mèche qui grésille
  place(S) {
    if (!S.limite('place', 40)) return;
    const f = S.varier(190, 0.07);
    S.ton({ f: f, f2: f * 2.9, glisse: 0.7, dur: 0.09, onde: 'sine', gain: 0.3, attaque: 0.003, reverb: 0.3 });
    S.choc({ f: 150, f2: 70, dur: 0.12, gain: 0.14, clic: 0.25, fClic: 900, reverb: 0.2 });
    meche(S, 0.05, 0.4, 0.09);
  },
  // pichenette : la chaussure frappe la bombe (claque) + petit « zip » qui grimpe + la bombe qui file sur le glaçage
  kick(S) {
    if (!S.limite('kick', 50)) return;
    S.choc({ f: S.varier(240, 0.08), f2: 110, dur: 0.11, gain: 0.32, clic: 0.7, fClic: 1600, reverb: 0.25 });
    S.ton({ f: 260, f2: 720, dur: 0.14, onde: 'doux', gain: 0.1, filtre: { type: 'lowpass', f: 2500 }, retard: 0.02 });
    S.souffle({ dur: 0.3, f1: 1600, f2: 500, gain: 0.1, q: 1, retard: 0.03 });
  },
  // lancer au gant : coup de poignet + sifflet à coulisse qui monte + « fwoosh » de la bombe en vol
  throw(S) {
    if (!S.limite('throw', 50)) return;
    S.choc({ f: 200, f2: 120, dur: 0.08, gain: 0.16, clic: 0.4, fClic: 1200 });
    S.ton({ f: S.varier(420, 0.06), f2: 1250, dur: 0.3, onde: 'sine', gain: 0.16, attaque: 0.1, vibrato: { f: 9, prof: 0.25 }, reverb: 0.4 });   // attaque lente : le sifflet enfle en montant
    S.souffle({ dur: 0.32, f1: 500, f2: 2800, gain: 0.22, q: 1.2 });
  },
  // explosion (arg = bombes qui sautent ensemble) : boum cartoon gros mais ROND — détonation de la boîte, tambour grave
  // par-dessus, la hauteur qui rebondit (« boum-bwop »), un nuage de fumée ; une réaction en chaîne ajoute 1-2 échos
  explode(S, n) {
    if (!S.limite('explode', 70)) return;
    const nb = Math.max(1, Math.min(6, n || 1)), k = Math.min(1, nb / 3);
    S.explosion({ taille: 0.6 + 0.5 * k, gain: 0.24 + 0.06 * k });
    S.membrane({ f: S.varier(52, 0.08), dur: 0.75, gain: 0.28, clic: 0.3, reverb: 0.5 });
    S.ton({ f: 80, f2: 125, glisse: 0.4, dur: 0.26, onde: 'sine', gain: 0.14, attaque: 0.05, retard: 0.14, reverb: 0.4 });   // rebond de hauteur (« bwop »), au-dessus du sous-grave pour rester audible sur portable
    S.souffle({ dur: 0.7, f1: 1400, f2: 250, gain: 0.12, q: 0.9, retard: 0.03, reverb: 0.6 });                                 // fumée
    const echos = Math.min(2, nb - 1);
    for (let i = 1; i <= echos; i++) S.membrane({ f: 60 + 12 * i, dur: 0.45, gain: 0.16, clic: 0.4, retard: 0.07 * i + hasard(0, 0.03), reverb: 0.6, varie: 0.12 });
  },
  // caisse détruite : craquement sec, puis la boîte de bonbons s'effrite en miettes qui retombent (grains de bruit
  // de plus en plus fins et espacés) ; deux bonbons tintent au milieu des débris
  wall(S) {
    if (!S.limite('wall', 50)) return;
    S.choc({ f: S.varier(190, 0.1), f2: 90, dur: 0.12, gain: 0.22, clic: 0.9, fClic: 1400, reverb: 0.3 });
    S.bruit({ dur: 0.07, gain: 0.28, couleur: 'blanc', filtre: { type: 'bandpass', f: 1600, q: 0.9 }, attaque: 0.001, reverb: 0.3, varie: 0.15 });
    for (let i = 0; i < 6; i++) S.bruit({ dur: hasard(0.012, 0.03), gain: 0.11 - i * 0.012, couleur: 'blanc', filtre: { type: 'bandpass', f: hasard(900, 3500), q: 1.8 }, attaque: 0.001, retard: 0.03 + i * 0.032 + hasard(0, 0.02), reverb: 0.35, varie: 0.2 });
    S.fm({ f: hasard(2200, 2800), ratio: 3.5, indice: 1.2, dur: 0.18, gain: 0.025, retard: 0.06 });
    S.fm({ f: hasard(2400, 3000), ratio: 3.5, indice: 1.2, dur: 0.16, gain: 0.02, retard: 0.12 });
  },
  // bonus ramassé : scintillement joyeux (arpège de célesta qui monte) + étincelle de cloche + poussière d'étoiles
  pickup(S) {
    if (!S.limite('pickup', 60)) return;
    const a = choisir(ARP_BONUS);
    S.accord({ notes: a, ecart: 0.045, onde: 'doux', dur: 0.4, gain: 0.11, attaque: 0.003, reverb: 0.45 });
    S.fm({ f: a[3] * 2, ratio: 2, indice: 1.2, dur: 0.35, gain: 0.04, retard: 0.15, reverb: 0.5 });
    S.bruit({ dur: 0.25, gain: 0.03, couleur: 'blanc', filtre: { type: 'highpass', f: 7000 }, attaque: 0.06, retard: 0.04, reverb: 0.4 });
  },
  // malus ramassé : trombone bouché « wah-wahhh » (deux notes qui descendent, la sourdine s'ouvre puis se ferme) + petit « squish »
  bad(S) {
    if (!S.limite('bad', 60)) return;
    S.ton({ f: 220, f2: 110, dur: 0.12, onde: 'sine', gain: 0.12 });
    S.ton({ f: 330, f2: 311, dur: 0.2, onde: 'creux', gain: 0.2, attaque: 0.05, filtre: { type: 'lowpass', f: 700, f2: 2000, q: 2 }, reverb: 0.3 });
    // attaque longue = la note enfle (pas de tenue dans la boîte : sans ça, le « wahhh » s'éteindrait dès son début)
    S.ton({ f: 294, f2: 233, glisse: 0.8, dur: 0.55, onde: 'creux', gain: 0.2, attaque: 0.14, retard: 0.17, vibrato: { f: 6, prof: 0.35 }, filtre: { type: 'lowpass', f: 1800, f2: 500, q: 2 }, reverb: 0.4 });
  },
  // élimination : petit nuage comique — « pouf » d'air qui retombe, coup sourd, bouchon qui saute et sifflet à
  // coulisse qui dégringole (« piouuu »)
  pouf(S) {
    if (!S.limite('pouf', 60)) return;
    S.bruit({ dur: 0.45, gain: 0.45, couleur: 'rose', filtre: { type: 'lowpass', f: 2600, f2: 400 }, attaque: 0.006, reverb: 0.5, varie: 0.1 });
    S.choc({ f: 170, f2: 80, dur: 0.18, gain: 0.36, clic: 0.25, fClic: 1000, reverb: 0.3 });
    S.ton({ f: 300, f2: 900, glisse: 0.5, dur: 0.06, onde: 'sine', gain: 0.14, attaque: 0.002 });
    // sifflet qui dégringole en deux segments fondus (1500 → 900 puis 900 → 320, le second enfle quand le premier s'éteint) :
    // une seule chute exponentielle n'aurait laissé entendre que le haut de la glissade
    const h = S.varier(1, 0.06);
    S.ton({ f: 1500 * h, f2: 700 * h, dur: 0.3, onde: 'sine', gain: 0.14, attaque: 0.01, retard: 0.04, vibrato: { f: 8, prof: 0.3 }, reverb: 0.5 });
    S.ton({ f: 900 * h, f2: 320 * h, dur: 0.38, onde: 'sine', gain: 0.12, attaque: 0.1, retard: 0.24, vibrato: { f: 8, prof: 0.3 }, reverb: 0.5 });
  },
  // bouclier qui encaisse : « bling » métallique (deux cloches FM brillantes) + reflet qui file + la bulle qui éclate
  guard(S) {
    if (!S.limite('guard', 60)) return;
    S.fm({ f: 1760, ratio: 2, indice: 2.2, dur: 0.75, gain: 0.13, attaque: 0.002, reverb: 0.5 });
    S.fm({ f: 2637, ratio: 2, indice: 1.4, dur: 0.55, gain: 0.06, retard: 0.045, reverb: 0.5 });
    S.ton({ f: 900, f2: 2400, glisse: 0.6, dur: 0.08, onde: 'sine', gain: 0.08, attaque: 0.002 });
    S.bruit({ dur: 0.035, gain: 0.1, couleur: 'blanc', filtre: { type: 'highpass', f: 4000 }, attaque: 0.001, retard: 0.01 });
  },
  // téléporteur : glissando de harpe magique (cordes pincées qui montent) + « wouuu » de sinus vibrant aller-retour + poussière scintillante
  warp(S) {
    if (!S.limite('warp', 120)) return;
    const haut = Math.random() < 0.5 ? 1 : 1.125;   // deux tonalités en alternance
    for (let i = 0; i < HARPE.length; i++) S.corde({ f: HARPE[i] * haut, dur: 0.6, gain: 0.085, clarte: 0.75, retard: i * 0.028, reverb: 0.55 });
    S.ton({ f: 400, f2: 1600, dur: 0.32, onde: 'sine', gain: 0.07, attaque: 0.12, vibrato: { f: 11, prof: 0.4 }, reverb: 0.6 });
    S.ton({ f: 1600, f2: 700, dur: 0.32, onde: 'sine', gain: 0.05, attaque: 0.06, retard: 0.24, vibrato: { f: 11, prof: 0.4 }, reverb: 0.6 });
    S.bruit({ dur: 0.5, gain: 0.04, couleur: 'blanc', filtre: { type: 'highpass', f: 6000 }, attaque: 0.15, reverb: 0.6 });
  },
  // retour de revanche : apparition (souffle + bouchon) puis « ta-da » de célesta et étincelle
  spawn(S) {
    if (!S.limite('spawn', 80)) return;
    S.souffle({ dur: 0.25, f1: 600, f2: 3000, gain: 0.14 });
    S.ton({ f: 280, f2: 840, glisse: 0.5, dur: 0.06, onde: 'sine', gain: 0.12, attaque: 0.002, retard: 0.08 });
    S.accord({ notes: [523, 659, 784, 1047], ecart: 0.06, onde: 'doux', dur: 0.45, gain: 0.12, attaque: 0.004, retard: 0.1, reverb: 0.45 });
    S.fm({ f: 2093, ratio: 2, indice: 1.5, dur: 0.5, gain: 0.06, retard: 0.3, reverb: 0.5 });
  },
  // mort subite : un carré de chocolat s'écrase — coup sourd lourd, écrasement grave, quelques éclats
  drop(S) {
    if (!S.limite('drop', 60)) return;
    S.choc({ f: S.varier(105, 0.1), f2: 42, dur: 0.32, gain: 0.34, clic: 0.45, fClic: 1100, reverb: 0.4 });
    S.bruit({ dur: 0.22, gain: 0.25, couleur: 'brun', filtre: { type: 'lowpass', f: 900, f2: 200 }, attaque: 0.002, reverb: 0.35, varie: 0.12 });
    for (let i = 0; i < 3; i++) S.bruit({ dur: hasard(0.012, 0.025), gain: 0.06, couleur: 'blanc', filtre: { type: 'bandpass', f: hasard(1200, 2500), q: 1.5 }, attaque: 0.001, retard: hasard(0.04, 0.16), reverb: 0.3, varie: 0.2 });
  },
  // décompte 3·2·1 : tic de bloc de bois (« tok ») + la mèche qui grésille un instant
  count(S) {
    S.ton({ f: S.varier(1050, 0.02), f2: 950, dur: 0.08, onde: 'sine', gain: 0.16, attaque: 0.002, reverb: 0.3 });
    S.ton({ f: 520, dur: 0.05, onde: 'sine', gain: 0.08, attaque: 0.002 });
    S.bruit({ dur: 0.02, gain: 0.12, couleur: 'blanc', filtre: { type: 'bandpass', f: 2600, q: 1.5 }, attaque: 0.001 });
    meche(S, 0.03, 0.16, 0.06);
  },
  // départ : gros coup de tambour rond, bouchon qui saute, souffle qui monte et pluie d'étincelles
  go(S) {
    S.membrane({ f: 65, dur: 0.7, gain: 0.3, reverb: 0.5 });
    S.ton({ f: 260, f2: 820, glisse: 0.6, dur: 0.07, onde: 'sine', gain: 0.14, attaque: 0.002 });
    S.souffle({ dur: 0.3, f1: 300, f2: 2600, gain: 0.14 });
    S.bruit({ dur: 0.2, gain: 0.05, couleur: 'blanc', filtre: { type: 'highpass', f: 6000 }, attaque: 0.02, retard: 0.05, reverb: 0.4 });
    S.accord({ notes: [523, 784, 1047], ecart: 0.03, onde: 'doux', dur: 0.45, gain: 0.1, attaque: 0.004, retard: 0.05, reverb: 0.45 });   // célesta : porte sur un téléphone
  },
  // victoire : arpège de célesta qui grimpe, accord final tenu (orgue de manège), cloche, et deux sarbacanes à confettis
  win(S) {
    S.accord({ notes: [523, 659, 784, 1047], ecart: 0.1, onde: 'doux', dur: 0.5, gain: 0.12, attaque: 0.004, reverb: 0.45 });
    S.accord({ notes: [523, 659, 784, 1047], ecart: 0.015, onde: 'orgue', dur: 1.4, gain: 0.085, attaque: 0.06, retard: 0.42, vibrato: { f: 5.5, prof: 0.1 }, reverb: 0.55 });
    S.fm({ f: 2093, ratio: 2, indice: 1.8, dur: 1, gain: 0.07, retard: 0.42, reverb: 0.6 });
    for (let i = 0; i < 2; i++) {
      S.ton({ f: 260, f2: 900, glisse: 0.5, dur: 0.06, onde: 'sine', gain: 0.13, attaque: 0.002, retard: 0.4 + i * 0.1 });
      S.bruit({ dur: 0.05, gain: 0.12, couleur: 'blanc', filtre: { type: 'highpass', f: 3500 }, attaque: 0.001, retard: 0.41 + i * 0.1, reverb: 0.4 });
    }
  },
};

// page d'écoute (/sons.html) : toutes les clés, et la réaction en chaîne de l'explosion
export const DEMO = [
  { k: 'count', nom: 'Décompte (tic de mèche)' },
  { k: 'go', nom: 'Départ' },
  { k: 'place', nom: 'Bombe posée (plop + mèche)' },
  { k: 'kick', nom: 'Bombe poussée (pichenette)' },
  { k: 'throw', nom: 'Bombe lancée (gant)' },
  { k: 'explode', arg: 1, nom: 'Explosion' },
  { k: 'explode', arg: 3, nom: 'Explosion en chaîne' },
  { k: 'wall', nom: 'Caisse détruite' },
  { k: 'pickup', nom: 'Bonus ramassé' },
  { k: 'bad', nom: 'Malus ramassé' },
  { k: 'guard', nom: 'Bouclier (bling)' },
  { k: 'warp', nom: 'Téléporteur' },
  { k: 'pouf', nom: 'Élimination (pouf)' },
  { k: 'spawn', nom: 'Retour de revanche' },
  { k: 'drop', nom: 'Bloc de mort subite' },
  { k: 'win', nom: 'Victoire' },
];

// Calage des niveaux après mesure sur /sons.html (29/10 : RMS sur 300 ms, plein spectre et haut-parleur de téléphone) :
// décomptes et petits sons fréquents relevés pour passer au-dessus de la musique.
function caler(T, f) { Object.keys(f).forEach(function (k) { const r = T[k], x = f[k]; T[k] = function (S, a) { S.plus(typeof x === 'function' ? x(a) : x, function () { r(S, a); }); }; }); }
caler(SONS, { count: 2, wall: 1.5 });
