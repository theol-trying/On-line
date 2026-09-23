// Éclairage dynamique — lueurs additives sur le sol (tirs, explosions, phares, balle…). Partagé par les 6 jeux.
//
// Une lueur = un sprite de dégradé radial PRÉ-RENDU (un par couleur), dessiné en composition « lighter » :
// aucun shadowBlur, aucun dégradé créé par image. Le dégradé s'éteint vers la MÊME couleur transparente
// (et pas vers du noir transparent, qui laisserait un halo sale en bordure).
//
//   lumiere(ctx, x, y, rayon, couleur, intensité)            lueur ponctuelle (à rappeler à chaque image)
//   const L = creerLumieres(24); L.ajouter(x, y, r, couleur, durée_ms, intensité); L.dessiner(ctx, now)
//                                                            flashs éphémères (explosions), plafonnés
// Appeler après le sol et AVANT les pièces, pour que la lumière tombe sur le décor et non sur les joueurs.
// À couper par l'appelant quand « Réduire les effets » est actif.

const sprites = new Map();
let sonde = null;

function rgb(col) {                                     // n'importe quelle couleur CSS → [r, g, b]
  if (!sonde) sonde = document.createElement('canvas').getContext('2d');
  sonde.fillStyle = '#000'; sonde.fillStyle = col;
  const v = sonde.fillStyle;                            // normalisé : '#rrggbb' ou 'rgba(r, g, b, a)'
  if (v.charAt(0) === '#') return [parseInt(v.slice(1, 3), 16), parseInt(v.slice(3, 5), 16), parseInt(v.slice(5, 7), 16)];
  const m = v.match(/[\d.]+/g) || [255, 255, 255];
  return [+m[0], +m[1], +m[2]];
}
function sprite(col) {
  let s = sprites.get(col);
  if (s) return s;
  const c = rgb(col), T = 96, r = T / 2;
  s = document.createElement('canvas'); s.width = s.height = T;
  const g = s.getContext('2d'), grad = g.createRadialGradient(r, r, 0, r, r, r);
  const p = 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',';
  grad.addColorStop(0, p + '1)'); grad.addColorStop(0.28, p + '0.55)'); grad.addColorStop(0.62, p + '0.16)'); grad.addColorStop(1, p + '0)');
  g.fillStyle = grad; g.fillRect(0, 0, T, T);
  if (sprites.size > 40) sprites.clear();
  sprites.set(col, s);
  return s;
}

export function lumiere(ctx, x, y, r, col, a) {
  if (!(a > 0.01) || !(r > 0.5)) return;
  const s = sprite(col), op = ctx.globalCompositeOperation, ga = ctx.globalAlpha;
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = a > 1 ? 1 : a;
  ctx.drawImage(s, x - r, y - r, r * 2, r * 2);
  ctx.globalCompositeOperation = op; ctx.globalAlpha = ga;
}

export function creerLumieres(max) {
  const L = [], cap = max || 24;
  return {
    ajouter(x, y, r, col, ms, a) {
      if (L.length >= cap) L.shift();
      L.push({ x, y, r, col, t0: performance.now(), ms: ms || 400, a: a == null ? 1 : a });
    },
    dessiner(ctx, now) {
      for (let i = L.length - 1; i >= 0; i--) {
        const l = L[i], k = (now - l.t0) / l.ms;
        if (k >= 1) { L.splice(i, 1); continue; }
        const e = 1 - k;
        lumiere(ctx, l.x, l.y, l.r * (0.85 + 0.35 * k), l.col, l.a * e * e);
      }
    },
    vider() { L.length = 0; },
  };
}
