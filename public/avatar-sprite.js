// Avatars dessinés SUR les pièces de jeu (raquette, moto, tank, serpent, bombeur, lutteur) — partagé par les 6 jeux.
//
// L'avatar d'un joueur (emoji ou petite image 64×64, choisi dans le lobby et lié à son pseudo) est
// pré-rendu une fois par (avatar, résolution, liseré) dans un petit canvas rond : dessiner un emoji au
// fillText à chaque image coûterait cher sur mobile, et une image doit d'abord être décodée.
// Source : window.__AVSRC (app.js), qui ne renvoie qu'un emoji ou une data URL validée en base64 strict.
//
//   dessinerAvatar(ctx, nom, x, y, taille, pxParUnite, liseré) → true si dessiné (false : pas d'avatar,
//   ou image pas encore décodée — la pièce garde alors son rendu habituel).
//
// Vieil iOS : ni ?. ni ??, pas d'OffscreenCanvas.

const cache = new Map();          // clé → canvas prêt
const images = new Map();         // data URL → { img, ok }
const MAX = 160;                  // 10 joueurs × quelques tailles × 6 jeux : au-delà on repart de zéro

const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","Segoe UI Symbol",sans-serif';

function source(nom) {
  return (typeof window !== 'undefined' && typeof window.__AVSRC === 'function' && nom) ? window.__AVSRC(nom) : null;
}
function paliers(px) { return px <= 24 ? 24 : px <= 48 ? 48 : px <= 96 ? 96 : 160; }   // peu de variantes en cache

function image(src) {
  let e = images.get(src);
  if (!e) {
    e = { img: new Image(), ok: false };
    e.img.onload = () => { e.ok = true; };
    e.img.src = src;
    images.set(src, e);
  }
  return e.ok ? e.img : null;
}

function construire(src, d, lisere) {
  const c = document.createElement('canvas');
  c.width = c.height = d;
  const g = c.getContext('2d');
  const r = d / 2, bord = Math.max(1, d * 0.08);
  g.save();
  g.beginPath(); g.arc(r, r, r - bord / 2, 0, Math.PI * 2); g.closePath(); g.clip();
  if (src.slice(0, 11) === 'data:image/') {
    const img = image(src);
    if (!img) { g.restore(); return null; }
    const s = Math.min(img.width, img.height) || 1;
    g.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, d, d);
  } else {
    g.fillStyle = 'rgba(255,255,255,0.92)'; g.fillRect(0, 0, d, d);     // pastille claire : l'emoji se lit sur toute couleur de pièce
    g.font = Math.round(d * 0.66) + 'px ' + EMOJI_FONT;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(src, r, r + d * 0.05);
  }
  g.restore();
  if (lisere) { g.strokeStyle = lisere; g.lineWidth = bord; g.beginPath(); g.arc(r, r, r - bord / 2, 0, Math.PI * 2); g.stroke(); }
  return c;
}

/** Canvas rond de l'avatar de `nom`, ou null (pas d'avatar, ou image en cours de décodage). */
export function avatarSprite(nom, px, lisere) {
  const src = source(nom);
  if (!src) return null;
  const d = paliers(px);
  const k = (src.length > 80 ? src.length + ':' + src.slice(-40) : src) + '|' + d + '|' + (lisere || '');
  let c = cache.get(k);
  if (c) return c;
  c = construire(src, d, lisere);
  if (!c) return null;                                  // image pas encore décodée : on retentera à l'image suivante
  if (cache.size >= MAX) cache.clear();
  cache.set(k, c);
  return c;
}

/** Dessine l'avatar centré en (x, y), de diamètre `taille` dans le repère courant du contexte.
 *  `pxParUnite` = pixels écran par unité (pour choisir une résolution nette). Renvoie true si dessiné. */
export function dessinerAvatar(ctx, nom, x, y, taille, pxParUnite, lisere) {
  const c = avatarSprite(nom, taille * (pxParUnite || 1), lisere);
  if (!c) return false;
  ctx.drawImage(c, x - taille / 2, y - taille / 2, taille, taille);
  return true;
}
