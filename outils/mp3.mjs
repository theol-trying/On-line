// Lecture des trames d'un mp3 (MPEG 1/2/2.5, couche III) — partagé par outils/importer-musique.mjs et test/smoke.mjs.
// Parcourt le fichier trame par trame depuis la fin des étiquettes ID3v2 de tête : tout ce qui n'est pas une trame
// complète (ID3v1, TAG+, APE, ID3v2 de fin, C2PA, octets orphelins) est hors de [debut, fin[. Un fichier « propre »
// est donc exactement debut = 0 et fin = taille.
const BR = { 1: [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320], 2: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160] };
const SR = { 3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000] };
const syncsafe = (b, o) => (b[o] << 21) | (b[o + 1] << 14) | (b[o + 2] << 7) | b[o + 3];

export function longueurTrame(b, o) {              // longueur de la trame MPEG couche III qui commence en o, ou 0
  if (o + 4 > b.length || b[o] !== 0xff || (b[o + 1] & 0xe0) !== 0xe0) return 0;
  const v = (b[o + 1] >> 3) & 3, couche = (b[o + 1] >> 1) & 3, bi = b[o + 2] >> 4, si = (b[o + 2] >> 2) & 3, pad = (b[o + 2] >> 1) & 1;
  if (v === 1 || couche !== 1 || bi === 0 || bi === 15 || si === 3) return 0;
  const br = (v === 3 ? BR[1] : BR[2])[bi] * 1000, sr = SR[v][si];
  return Math.floor((v === 3 ? 144 : 72) * br / sr) + pad;
}

export function tramesMp3(b) {
  let debut = 0;
  while (b.length >= debut + 10 && b.toString('latin1', debut, debut + 3) === 'ID3')   // ID3v2 (+ pied éventuel)
    debut += syncsafe(b, debut + 6) + 10 + ((b[debut + 5] & 0x10) ? 10 : 0);
  let o = debut, n = 0;
  for (;;) {
    const L = longueurTrame(b, o);
    if (!L || o + L > b.length) break;              // fin des trames, ou dernière trame tronquée (écartée)
    o += L; n++;
  }
  return { debut: debut, fin: o, trames: n };
}
