// Musiques en fichiers (public/music/) : une piste de MENU et une piste de PARTIE par jeu. Données pures,
// importées par piste.js (navigateur) et par test/smoke.mjs (contrôle des fichiers servis).
//
// Nom de fichier = <jeu>-<menu|jeu>.<8 premiers hex du sha1 du contenu>.mp3 : un contenu neuf a un nom neuf,
// d'où le cache « immutable » posé par server.js sur /music/ (rien n'est re-téléchargé après un déploiement).
// Les fichiers passent par outils/importer-musique.mjs : il retire TOUTES les métadonnées (ID3, APE, C2PA)
// et calcule le nom. Ne jamais déposer un mp3 à la main dans public/music/.
//
// debut / fin (secondes) = la boucle : silence de tête retiré, queue de fondu (< -12 dB) et silence final
// (~2,5 s dans ces morceaux) coupés. Calculés dans le navigateur par outils/points-de-boucle.js.
// bpm / temps (facultatifs, Pong seulement) : tempo mesuré et instant du premier temps dans le fichier, pour caler les
// pulsations visuelles (piste.pulsation). Mesure par autocorrélation de l'enveloppe : tempo sûr, phase approximative.
// Avec un tempo connu, fin est calée pour que la boucle (fin - FONDU_BOUCLE - debut) compte un nombre ENTIER de temps
// (Pong : 118 au menu, 143 en partie) : pas de saut de rythme au bouclage, ni à l'oreille ni dans les pulsations.
export const PISTES = {
  bomb:   { menu: { f: 'bomb-menu.5408f9c3.mp3',   debut: 0.068, fin: 59.96 },  jeu: { f: 'bomb-jeu.b31a4cf3.mp3',   debut: 0.052, fin: 99.497 } },
  foot:   { menu: { f: 'foot-menu.ad5ba507.mp3',   debut: 0.13,  fin: 59.522 }, jeu: { f: 'foot-jeu.cc7f7e8c.mp3',   debut: 0.034, fin: 98.361 } },
  micro:  { menu: { f: 'micro-menu.b56ae622.mp3',  debut: 0.074, fin: 57.405 }, jeu: { f: 'micro-jeu.e793b5a3.mp3',  debut: 0.05,  fin: 60.01 } },
  patate: { menu: { f: 'patate-menu.142435b1.mp3', debut: 0.052, fin: 63.699 }, jeu: { f: 'patate-jeu.f041705b.mp3', debut: 0.046, fin: 61.002 } },
  pong:   { menu: { f: 'pong-menu.8705d4e0.mp3',   debut: 0.085, fin: 59.623, bpm: 123.05, temps: 0.081 },  jeu: { f: 'pong-jeu.ceed3571.mp3',   debut: 0.034, fin: 59.31, bpm: 149.8, temps: 0.033 } },
  snake:  { menu: { f: 'snake-menu.283543cb.mp3',  debut: 0.04,  fin: 59.693 }, jeu: { f: 'snake-jeu.a490b1d5.mp3',  debut: 0.052, fin: 57.554 } },
  sumo:   { menu: { f: 'sumo-menu.aa9790fe.mp3',   debut: 0.041, fin: 57.378 }, jeu: { f: 'sumo-jeu.d667382c.mp3',   debut: 0.033, fin: 62.569 } },
  tank:   { menu: { f: 'tank-menu.712bced3.mp3',   debut: 0.076, fin: 57.741 }, jeu: { f: 'tank-jeu.9cb6680b.mp3',   debut: 0.033, fin: 59.392 } },
  tron:   { menu: { f: 'tron-menu.d6a24027.mp3',   debut: 0.034, fin: 52.438 }, jeu: { f: 'tron-jeu.08d29b0f.mp3',   debut: 0.094, fin: 60.016 } },
};

export const FONDU_BOUCLE = 2;      // s : fondu enchaîné fin -> début (la moitié des morceaux s'arrêtent net)
export const FONDU_PISTE = 1.2;     // s : passage menu <-> partie, ou d'un jeu à l'autre
export const CLIMAX = 1.06;         // vitesse de lecture au moment décisif (≈ +1 demi-ton, effet « dépêche-toi »)

// Position dans le tampon (s) d'une voix dont la vitesse passe linéairement de r0 à r1 entre t0 et t1,
// puis reste à r1. pos0 = position à t0. Pure : testée par test/smoke.mjs (bloc « musiques »).
export function positionA(v, t) {
  if (t <= v.t0) return v.pos0;
  if (t <= v.t1) { const r = v.r0 + (v.r1 - v.r0) * (t - v.t0) / (v.t1 - v.t0); return v.pos0 + (t - v.t0) * (v.r0 + r) / 2; }
  return v.pos0 + (v.t1 - v.t0) * (v.r0 + v.r1) / 2 + (t - v.t1) * v.r1;
}
// Vitesse instantanée de la même voix.
export function vitesseA(v, t) {
  if (t <= v.t0) return v.r0;
  if (t >= v.t1) return v.r1;
  return v.r0 + (v.r1 - v.r0) * (t - v.t0) / (v.t1 - v.t0);
}
// Instant (horloge audio) où la voix atteint la position p dans le tampon.
export function instantPour(v, p) {
  const pFin = positionA(v, v.t1);
  if (p >= pFin) return v.t1 + (p - pFin) / v.r1;
  if (v.r0 === v.r1) return v.t0 + (p - v.pos0) / v.r0;
  // pendant la rampe : pos0 + r0·u + a·u²/2 = p, avec a = (r1 - r0) / (t1 - t0)
  const a = (v.r1 - v.r0) / (v.t1 - v.t0), d = p - v.pos0;
  return v.t0 + (-v.r0 + Math.sqrt(Math.max(0, v.r0 * v.r0 + 2 * a * d))) / a;
}
