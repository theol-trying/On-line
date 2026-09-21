// Motifs par siège — accessibilité (daltonisme) et lisibilité à 6 joueurs.
// Chaque siège porte une COULEUR (déjà en place) *et* un MOTIF : deux teintes proches
// restent distinguables au premier coup d'œil, y compris en palette daltonienne ou
// sur un petit écran. Zéro dépendance, zéro asset : les tuiles sont dessinées au canvas.
//
// Usage type (par-dessus un remplissage déjà fait avec la couleur du siège) :
//     ctx.fillStyle = colSeat(i); ctx.fill();          // ou fillRect(...)
//     const pat = seatPattern(ctx, i, { size: CELL }); // même chemin, repassé en motif
//     if (pat) { ctx.fillStyle = pat; ctx.fill(); }
//
// seatPattern() renvoie `null` pour le siège 0 (uni) : rien à peindre, aucun surcoût.
// Les tuiles sont mises en cache par (motif, taille, encre) : au plus quelques dizaines
// de petits canvas sur toute la session.

// Glyphe affiché dans les cartes HUD pour que chacun apprenne « son » motif.
export const SEAT_GLYPH = ['●', '▨', '⁙', '⌃', '▦', '◆'];
export const SEAT_MOTIF = ['uni', 'rayé', 'pointillé', 'chevrons', 'quadrillé', 'losanges'];

const cache = new Map();
let ctxSeq = 0;   // un CanvasPattern est théoriquement réutilisable d'un contexte à l'autre, mais on ne parie pas
                  // là-dessus sur les vieux moteurs : la clé de cache est préfixée par le contexte d'origine.

/**
 * Motif répétable du siège `seat`.
 * @param {CanvasRenderingContext2D} ctx  contexte servant à fabriquer le CanvasPattern
 * @param {number} seat                   index de siège (0..5, modulo au-delà)
 * @param {{size?:number, ink?:string}} [opts]
 *        size = côté de la tuile dans l'espace de coordonnées courant (≈ taille d'une case/pièce)
 *        ink  = couleur du motif (par défaut un blanc translucide qui marche sur toutes les teintes)
 * @returns {CanvasPattern|null} null pour le siège 0 (uni)
 */
export function seatPattern(ctx, seat, opts) {
  const i = (((seat | 0) % 6) + 6) % 6;
  if (i === 0 || !ctx) return null;
  const o = opts || {};
  const size = Math.max(4, Math.round(o.size || 10));
  const ink = o.ink || 'rgba(255,255,255,0.32)';
  if (!ctx.__patId) ctx.__patId = 'c' + (++ctxSeq);
  const key = ctx.__patId + '|' + i + '|' + size + '|' + ink;
  if (cache.has(key)) return cache.get(key);

  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const c = cv.getContext('2d');
  if (!c) return null;
  const s = size, lw = Math.max(1, s * 0.16);
  c.strokeStyle = ink; c.fillStyle = ink; c.lineWidth = lw; c.lineCap = 'round';

  if (i === 1) {                                  // rayures diagonales (la diagonale coin-à-coin se raccorde d'une tuile à l'autre)
    c.beginPath(); c.moveTo(0, 0); c.lineTo(s, s); c.stroke();
  } else if (i === 2) {                           // pointillé : un point au centre + un aux 4 coins (les coins se recollent)
    const r = s * 0.16;
    c.beginPath(); c.arc(s / 2, s / 2, r, 0, 6.2832); c.fill();
    for (const [x, y] of [[0, 0], [s, 0], [0, s], [s, s]]) { c.beginPath(); c.arc(x, y, r * 0.8, 0, 6.2832); c.fill(); }
  } else if (i === 3) {                           // chevrons empilés
    c.beginPath(); c.moveTo(0, s * 0.72); c.lineTo(s / 2, s * 0.28); c.lineTo(s, s * 0.72); c.stroke();
    c.beginPath(); c.moveTo(0, s * 0.22); c.lineTo(s / 2, -s * 0.22); c.lineTo(s, s * 0.22); c.stroke();
  } else if (i === 4) {                           // quadrillage : un trait sur chaque bord (l'autre moitié vient de la tuile voisine)
    c.beginPath(); c.moveTo(0, 0); c.lineTo(0, s); c.moveTo(0, 0); c.lineTo(s, 0); c.stroke();
  } else {                                        // losanges
    c.beginPath();
    c.moveTo(s / 2, s * 0.14); c.lineTo(s * 0.86, s / 2); c.lineTo(s / 2, s * 0.86); c.lineTo(s * 0.14, s / 2);
    c.closePath(); c.fill();
  }

  let pat = null;
  try { pat = ctx.createPattern(cv, 'repeat'); } catch { pat = null; }
  cache.set(key, pat);
  return pat;
}
