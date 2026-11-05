// Circuit « noel » de Micro Machines — définition PARTAGÉE serveur / client (géométrie, obstacles, zones, décor).
// Format : voir l'en-tête de ../shared.js ; dessins propres au circuit (propriété `dessin`) : voir ../rendu.js.

const TAU = Math.PI * 2, D2R = Math.PI / 180;
// tortue : départ (x, y) cap h (rad, 0 = vers la droite, y vers le bas) ; ['X', x] / ['Y', y] tout droit jusqu'à cette
// abscisse / ordonnée, ['D', l] tout droit sur l u, ['A', rayon, degrés] arc (> 0 : à droite) → points de contrôle
function trace(x, y, h, cmds) {
  const P = [[x, y]];
  for (const c of cmds) {
    if (c[0] !== 'A') {
      const len = c[0] === 'D' ? c[1] : c[0] === 'Y' ? (c[1] - y) / Math.sin(h) : (c[1] - x) / Math.cos(h), k = Math.max(1, Math.round(len / 80));
      for (let i = 1; i <= k; i++) P.push([x + Math.cos(h) * len * i / k, y + Math.sin(h) * len * i / k]);
      x += Math.cos(h) * len; y += Math.sin(h) * len;
    } else {
      const r = c[1], a = c[2] * D2R, s = a > 0 ? 1 : -1, cx = x - Math.sin(h) * r * s, cy = y + Math.cos(h) * r * s;
      const f0 = Math.atan2(y - cy, x - cx), k = Math.max(2, Math.round(r * Math.abs(a) / 70));
      for (let i = 1; i <= k; i++) { const f = f0 + a * i / k; P.push([cx + Math.cos(f) * r, cy + Math.sin(f) * r]); }
      x = cx + Math.cos(f0 + a) * r; y = cy + Math.sin(f0 + a) * r; h += a;
    }
  }
  const z = P[P.length - 1];
  if (Math.hypot(z[0] - P[0][0], z[1] - P[0][1]) < 30) P.pop();
  return P.map(p => [Math.round(p[0]), Math.round(p[1])]);
}
const T = { x0: 70, y0: 70, x1: 3630, y1: 2510, r: 60 };       // le dessus de la table (la nappe retombe autour)
const SAPIN = [1850, 1226];                                     // le petit sapin du centre de table ; la couronne en fait les trois quarts
// chemin de table en velours vert : ligne droite du départ le long du bord, lobe gauche (ligne droite du bord gauche),
// épingle du haut, descente entre les deux bras de la guirlande, la COURONNE (trois quarts de tour autour du sapin),
// remontée, épingle du haut à droite, lobe droit (ligne droite du bord droit), retour sur la ligne
const PTS = trace(1850, 2260, Math.PI, [
  ['X', 1450], ['A', 200, 90], ['Y', 1880],                                                     // ligne droite du départ, coin du bas
  ['A', 160, -135], ['D', 190], ['A', 300, 135], ['Y', 950], ['A', 300, 135], ['D', 190], ['A', 160, -135],   // lobe gauche
  ['Y', 520], ['A', 200, 90], ['X', 1513], ['A', 150, 90], ['Y', 880],                           // épingle du haut, bras gauche
  ['A', 160, 45], ['A', 330, -270], ['A', 160, 45], ['Y', 470],                                  // la couronne autour du sapin
  ['A', 150, 90], ['X', 2250], ['A', 200, 90], ['Y', 759],                                       // bras droit, épingle du haut
  ['A', 160, -135], ['D', 190], ['A', 300, 135], ['Y', 1689], ['A', 300, 135], ['D', 190], ['A', 160, -135],  // lobe droit
  ['Y', 2060], ['A', 200, 90], ['X', 1850],                                                     // coin du bas, retour sur la ligne
]);
// la boule tombée du sapin roule en boucle à travers le coin du bas à gauche (entre le creux du virage et la nappe)
const BOULE = [];
for (let k = 0; k < 10; k++) { const u = k / 10 * TAU, cu = Math.cos(u) * 280, su = Math.sin(u) * 80; BOULE.push([Math.round(1290 - 0.749 * cu + 0.662 * su), Math.round(2200 + 0.662 * cu + 0.749 * su)]); }

// ── petits outils de dessin ──
const rond = (g, x, y, r) => { g.moveTo(x + r, y); g.arc(x, y, r, 0, TAU); };
function ov(g, x, y, rx, ry) { g.save(); g.translate(x, y); g.scale(rx, ry); g.moveTo(1, 0); g.arc(0, 0, 1, 0, TAU); g.restore(); }
function ombre(g, dx, dy, forme) {                    // ombre douce en deux couches sur la nappe (lumière en haut à gauche)
  g.save(); g.fillStyle = 'rgba(46,0,10,0.13)'; g.translate(dx * 1.8, dy * 1.8); g.beginPath(); forme(g); g.fill(); g.restore();
  g.save(); g.fillStyle = 'rgba(46,0,10,0.24)'; g.translate(dx, dy); g.beginPath(); forme(g); g.fill(); g.restore();
}
function etoile(g, x, y, r1, r2, k, a) {               // étoile à k branches (pointes r1, creux r2), ajoutée au chemin courant
  for (let j = 0; j <= 2 * k; j++) { const u = a + j * Math.PI / k, q = j % 2 ? r2 : r1; if (j) g.lineTo(x + Math.cos(u) * q, y + Math.sin(u) * q); else g.moveTo(x + Math.cos(u) * q, y + Math.sin(u) * q); }
  g.closePath();
}
function flocon(g, x, y, s) {                         // flocon à six branches (traits), ajouté au chemin courant
  for (let j = 0; j < 6; j++) {
    const u = j * Math.PI / 3, cx = Math.cos(u), cy = Math.sin(u), bx = x + cx * s * 0.55, by = y + cy * s * 0.55;
    g.moveTo(x, y); g.lineTo(x + cx * s, y + cy * s);
    for (const e of [-1, 1]) { const v = u + e * 0.75; g.moveTo(bx, by); g.lineTo(bx + Math.cos(v) * s * 0.32, by + Math.sin(v) * s * 0.32); }
  }
}
const HOUX = [[0.2, 0.22], [0.3, 0.13], [0.5, 0.3], [0.6, 0.16], [0.8, 0.24], [0.87, 0.08], [1, 0]];
function houxFeuille(g, x, y, L, a) {                 // feuille de houx piquante (chemin), tige en (x, y), orientée a
  const ca = Math.cos(a), sa = Math.sin(a);
  g.moveTo(x, y);
  for (const q of HOUX) g.lineTo(x + ca * q[0] * L + sa * q[1] * L, y + sa * q[0] * L - ca * q[1] * L);
  for (let j = HOUX.length - 2; j >= 0; j--) { const q = HOUX[j]; g.lineTo(x + ca * q[0] * L - sa * q[1] * L, y + sa * q[0] * L + ca * q[1] * L); }
  g.closePath();
}
function houx(g, x, y, s, a) {                        // brin de houx : trois feuilles, trois baies
  g.fillStyle = 'rgba(46,0,10,0.25)'; g.beginPath(); for (let k = 0; k < 3; k++) houxFeuille(g, x + 3, y + 5, s, a + k * 2.1); g.fill();
  g.fillStyle = '#1d6630'; g.beginPath(); for (let k = 0; k < 3; k++) houxFeuille(g, x, y, s, a + k * 2.1); g.fill();
  g.strokeStyle = 'rgba(170,230,150,0.55)'; g.lineWidth = 1.5; g.beginPath();
  for (let k = 0; k < 3; k++) { const u = a + k * 2.1; g.moveTo(x, y); g.lineTo(x + Math.cos(u) * s * 0.85, y + Math.sin(u) * s * 0.85); }
  g.stroke();
  const b = s * 0.17;
  g.fillStyle = '#c8101e'; g.beginPath(); for (let k = 0; k < 3; k++) { const u = a + 1.05 + k * 2.1; rond(g, x + Math.cos(u) * b, y + Math.sin(u) * b, b); } g.fill();
  g.fillStyle = 'rgba(255,255,255,0.6)'; g.beginPath(); for (let k = 0; k < 3; k++) { const u = a + 1.05 + k * 2.1; rond(g, x + Math.cos(u) * b - b * 0.35, y + Math.sin(u) * b - b * 0.35, b * 0.3); } g.fill();
}
function sphere(g, U, x, y, r, col) {                 // boule brillante (lumière en haut à gauche)
  const gr = g.createRadialGradient(x - r * 0.38, y - r * 0.42, r * 0.06, x, y, r);
  gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.3, col); gr.addColorStop(1, U.rgbStr(U.mix(U.hexRgb(col), [0, 0, 0], 0.55)));
  g.fillStyle = gr; g.beginPath(); rond(g, x, y, r); g.fill();
}
function flamme(g, x, y, s) {                         // flamme de bougie vue d'en haut : halo chaud, cœur blanc
  const gr = g.createRadialGradient(x, y, 0, x, y, s * 3.2);
  gr.addColorStop(0, 'rgba(255,236,150,0.75)'); gr.addColorStop(0.35, 'rgba(255,190,80,0.28)'); gr.addColorStop(1, 'rgba(255,170,60,0)');
  g.fillStyle = gr; g.beginPath(); rond(g, x, y, s * 3.2); g.fill();
  g.fillStyle = '#ffb02a'; g.beginPath(); ov(g, x + s * 0.15, y + s * 0.2, s * 0.75, s * 0.95); g.fill();
  g.fillStyle = '#fff6c8'; g.beginPath(); rond(g, x, y, s * 0.42); g.fill();
}
const PAPIERS = [['#c8102e', '#f2d16a'], ['#16804a', '#f4efe2'], ['#1f4fb0', '#f2c23a'], ['#e2b23c', '#c8102e'], ['#f4efe2', '#c8102e'], ['#7a2a9c', '#f2c23a']];
function cadeau(g, x, y, h, a, k) {                   // boîte cadeau vue d'en haut : papier à motif, ruban en croix, nœud
  const col = PAPIERS[k % PAPIERS.length];
  g.save(); g.translate(x, y); g.rotate(a);
  ombre(g, 6, 9, q => q.rect(-h, -h, 2 * h, 2 * h));
  g.fillStyle = col[0]; g.fillRect(-h, -h, 2 * h, 2 * h);
  g.fillStyle = 'rgba(255,255,255,0.22)'; g.beginPath();
  const m = k % 3, st = h / 2.5;
  if (m === 0) { for (let u = -h + st / 2; u < h; u += st) for (let v = -h + st / 2; v < h; v += st) rond(g, u, v, st * 0.16); }
  else if (m === 1) { for (let u = -h; u < h - 1; u += st) g.rect(u, -h, st * 0.45, 2 * h); }
  else { for (let u = -h + st / 2; u < h; u += st) for (let v = -h + st / 2; v < h; v += st) etoile(g, u, v, st * 0.28, st * 0.12, 5, -Math.PI / 2); }
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.2)'; g.fillRect(-h, -h, 2 * h, 3); g.fillRect(-h, -h, 3, 2 * h);   // arêtes au jour
  g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(-h, h - 3, 2 * h, 3); g.fillRect(h - 3, -h, 3, 2 * h);
  const rw = Math.max(5, h * 0.22);
  g.fillStyle = col[1]; g.fillRect(-rw / 2, -h, rw, 2 * h); g.fillRect(-h, -rw / 2, 2 * h, rw);
  g.fillStyle = 'rgba(0,0,0,0.15)'; g.fillRect(rw / 2 - 2, -h, 2, 2 * h); g.fillRect(-h, rw / 2 - 2, 2 * h, 2);
  g.fillStyle = col[1]; g.beginPath(); ov(g, -h * 0.3, -h * 0.18, h * 0.34, h * 0.2); ov(g, h * 0.3, -h * 0.18, h * 0.34, h * 0.2); g.fill();   // boucles du nœud
  g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 1.5; g.beginPath(); ov(g, -h * 0.3, -h * 0.18, h * 0.2, h * 0.09); ov(g, h * 0.3, -h * 0.18, h * 0.2, h * 0.09); g.stroke();
  g.fillStyle = col[1]; g.beginPath(); g.moveTo(-3, 0); g.lineTo(-h * 0.35, h * 0.5); g.lineTo(-h * 0.2, h * 0.55); g.lineTo(0, 2); g.lineTo(h * 0.2, h * 0.55); g.lineTo(h * 0.35, h * 0.5); g.lineTo(3, 0); g.fill();   // pans
  g.fillStyle = U_ombreNoeud; g.beginPath(); rond(g, 0, -1, rw * 0.62); g.fill();
  g.fillStyle = col[1]; g.beginPath(); rond(g, -0.8, -1.8, rw * 0.5); g.fill();
  g.restore();
}
const U_ombreNoeud = 'rgba(0,0,0,0.28)';

// ── sol : parquet de chêne sombre ; nappe rouge damassée ; chemin de table en velours, galon d'or ; nappe qui retombe ──
function sol(g, c, R, U) {
  g.fillStyle = '#4a2c1a'; g.fillRect(0, 0, c.w, c.h);
  const lh = 70;
  for (let y = 0; y < c.h; y += lh) {
    let x = -R() * 500;
    while (x < c.w) { const L = 320 + R() * 520; g.fillStyle = U.rgbStr(U.mix([78, 46, 26], [112, 70, 40], R())); g.fillRect(x + 2, y + 2, L - 4, lh - 4); x += L; }
  }
  g.strokeStyle = 'rgba(40,20,8,0.3)'; g.lineWidth = 1.5; g.beginPath();
  for (let k = 0; k < 500; k++) { const x = R() * c.w, y = Math.floor(R() * c.h / lh) * lh + 10 + R() * (lh - 20); g.moveTo(x, y); g.lineTo(x + 60 + R() * 120, y + (R() - 0.5) * 3); }
  g.stroke();
}
function plateau(g, c, R, U) {
  const t = c.table, W = t.x1 - t.x0, H = t.y1 - t.y0, cx = (t.x0 + t.x1) / 2, cy = (t.y0 + t.y1) / 2;
  const gr = g.createRadialGradient(cx - 300, cy - 200, 200, cx, cy, 2300);
  gr.addColorStop(0, '#be1f33'); gr.addColorStop(1, '#8a1021');
  g.fillStyle = gr; g.fillRect(t.x0, t.y0, W, H);
  // trame du tissu (fils de chaîne et de trame)
  g.fillStyle = 'rgba(255,190,190,0.07)'; g.beginPath(); for (let k = 0; k < 6000; k++) g.rect(t.x0 + R() * W, t.y0 + R() * H, 4, 1.5); g.fill();
  g.fillStyle = 'rgba(50,0,10,0.09)'; g.beginPath(); for (let k = 0; k < 6000; k++) g.rect(t.x0 + R() * W, t.y0 + R() * H, 1.5, 4); g.fill();
  // damassé ton sur ton : flocons et étoiles en quinconce
  g.strokeStyle = 'rgba(255,170,170,0.1)'; g.lineWidth = 3; g.lineCap = 'round'; g.beginPath();
  for (let y = t.y0 + 110, r = 0; y < t.y1; y += 220, r++) for (let x = t.x0 + 110 + (r % 2) * 130; x < t.x1; x += 260) flocon(g, x, y, 34);
  g.stroke();
  g.fillStyle = 'rgba(255,170,170,0.08)'; g.beginPath();
  for (let y = t.y0 + 220, r = 0; y < t.y1; y += 220, r++) for (let x = t.x0 + 240 + (r % 2) * 130; x < t.x1; x += 260) etoile(g, x, y, 16, 6, 4, 0);
  g.fill();
  // plis du repassage (la nappe a été pliée en 4 × 3)
  for (let k = 1; k < 4; k++) { const x = t.x0 + W * k / 4; g.fillStyle = 'rgba(255,210,210,0.06)'; g.fillRect(x - 6, t.y0, 6, H); g.fillStyle = 'rgba(50,0,10,0.08)'; g.fillRect(x, t.y0, 4, H); }
  for (let k = 1; k < 3; k++) { const y = t.y0 + H * k / 3; g.fillStyle = 'rgba(255,210,210,0.06)'; g.fillRect(t.x0, y - 6, W, 6); g.fillStyle = 'rgba(50,0,10,0.08)'; g.fillRect(t.x0, y, W, 4); }
  // paillettes d'or et confettis étoilés tombés des papillotes
  g.fillStyle = 'rgba(255,214,110,0.75)'; g.beginPath(); for (let k = 0; k < 260; k++) etoile(g, t.x0 + R() * W, t.y0 + R() * H, 5 + R() * 3, 2, 5, R() * TAU); g.fill();
  g.fillStyle = 'rgba(240,244,250,0.6)'; g.beginPath(); for (let k = 0; k < 500; k++) g.rect(t.x0 + R() * W, t.y0 + R() * H, 2.5, 2.5); g.fill();
  // galon brodé d'or tout autour de la nappe
  const b = 36;
  g.strokeStyle = '#d8a83c'; g.lineWidth = 4; g.beginPath(); U.rr(g, t.x0 + b, t.y0 + b, W - 2 * b, H - 2 * b, 30); g.stroke();
  g.lineWidth = 2; g.beginPath(); U.rr(g, t.x0 + b + 18, t.y0 + b + 18, W - 2 * b - 36, H - 2 * b - 36, 22); g.stroke();
  g.fillStyle = '#e4b84c'; g.beginPath();
  for (let x = t.x0 + b + 40; x < t.x1 - b - 30; x += 36) for (const y of [t.y0 + b + 9, t.y1 - b - 9]) { g.moveTo(x, y - 5); g.lineTo(x + 5, y); g.lineTo(x, y + 5); g.lineTo(x - 5, y); g.closePath(); }
  for (let y = t.y0 + b + 40; y < t.y1 - b - 30; y += 36) for (const x of [t.x0 + b + 9, t.x1 - b - 9]) { g.moveTo(x, y - 5); g.lineTo(x + 5, y); g.lineTo(x, y + 5); g.lineTo(x - 5, y); g.closePath(); }
  g.fill();
}
function piste(g, c, R, U) {                           // chemin de table en velours vert : galon d'or torsadé, piqûres, étoiles brodées
  const W = c.W, n = c.n;
  g.lineJoin = 'round'; g.lineCap = 'round';
  g.save(); g.translate(7, 11); U.centerStroke(g, c, 2 * W + 34, 'rgba(46,0,10,0.14)'); g.restore();
  g.save(); g.translate(3, 5); U.centerStroke(g, c, 2 * W + 26, 'rgba(46,0,10,0.26)'); g.restore();
  U.centerStroke(g, c, 2 * W + 26, '#8a6418');
  U.centerStroke(g, c, 2 * W + 20, '#e2b44a');
  g.lineCap = 'butt'; g.strokeStyle = 'rgba(126,84,14,0.6)'; g.lineWidth = 2 * W + 20; g.setLineDash([5, 7]); U.trackPath(g, c, 0); g.stroke(); g.setLineDash([]);   // torsade
  g.lineCap = 'round';
  U.centerStroke(g, c, 2 * W + 4, '#6a4a10');
  U.centerStroke(g, c, 2 * W, '#17512e');
  U.centerStroke(g, c, 2 * W - 30, '#1b5c34');
  U.centerStroke(g, c, 2 * W - 100, 'rgba(96,176,116,0.1)');                                    // reflet du velours
  U.centerStroke(g, c, 26, 'rgba(150,220,160,0.05)');
  const tons = ['rgba(8,40,20,0.35)', 'rgba(110,190,130,0.16)'];                               // poil du velours
  for (let p = 0; p < 2; p++) { g.fillStyle = tons[p]; g.beginPath(); for (let k = 0; k < n * 2; k++) { const i = Math.floor(R() * n), o = (R() * 2 - 1) * (W - 6); g.rect(c.sx[i] + c.nx[i] * o, c.sy[i] + c.ny[i] * o, 2.5, 2.5); } g.fill(); }
  g.strokeStyle = 'rgba(240,204,96,0.7)'; g.lineWidth = 2; g.lineCap = 'butt'; g.setLineDash([8, 9]);   // piqûres d'or
  for (const o of [-(W - 9), W - 9]) { U.trackPath(g, c, o); g.stroke(); }
  g.setLineDash([]);
  g.fillStyle = 'rgba(236,196,84,0.8)'; g.beginPath();                                          // étoiles brodées le long des bords
  for (let i = 0; i < n; i += 15) for (const o of [-(W - 27), W - 27]) etoile(g, c.sx[i] + c.nx[i] * o, c.sy[i] + c.ny[i] * o, 8, 3.3, 5, Math.atan2(c.ty[i], c.tx[i]));
  g.fill();
  g.fillStyle = 'rgba(255,240,190,0.5)'; g.beginPath();
  for (let i = 7; i < n; i += 15) rond(g, c.sx[i], c.sy[i], 3);
  g.fill();
}
function bord(g, c, R, U) {                            // la nappe retombe autour de la table : pan plus sombre, plis, franges d'or
  const t = c.table, e = 50, x0 = t.x0, y0 = t.y0, x1 = t.x1, y1 = t.y1;
  g.save();
  g.fillStyle = 'rgba(20,8,4,0.45)'; g.fillRect(x0 - e + 12, y1 + e, x1 - x0 + 2 * e, 16); g.fillRect(x1 + e, y0 - e + 12, 16, y1 - y0 + 2 * e);   // ombre sur le parquet
  g.beginPath(); g.rect(x0 - e, y0 - e, x1 - x0 + 2 * e, y1 - y0 + 2 * e); U.rr(g, x0, y0, x1 - x0, y1 - y0, t.r);
  g.fillStyle = '#7a0e1e'; g.fill('evenodd');
  g.lineWidth = 7; g.strokeStyle = 'rgba(30,0,6,0.38)'; g.beginPath();                          // plis du tombé
  for (let x = x0 + 30; x < x1 - 20; x += 58) { g.moveTo(x, y0 - 4); g.lineTo(x + 4, y0 - e); g.moveTo(x + 20, y1 + 4); g.lineTo(x + 16, y1 + e); }
  for (let y = y0 + 30; y < y1 - 20; y += 58) { g.moveTo(x0 - 4, y); g.lineTo(x0 - e, y + 4); g.moveTo(x1 + 4, y + 20); g.lineTo(x1 + e, y + 16); }
  g.stroke();
  g.lineWidth = 4; g.strokeStyle = 'rgba(255,150,150,0.14)'; g.beginPath();
  for (let x = x0 + 52; x < x1 - 20; x += 58) { g.moveTo(x, y0 - 4); g.lineTo(x + 2, y0 - e); g.moveTo(x + 20, y1 + 4); g.lineTo(x + 18, y1 + e); }
  for (let y = y0 + 52; y < y1 - 20; y += 58) { g.moveTo(x0 - 4, y); g.lineTo(x0 - e, y + 2); g.moveTo(x1 + 4, y + 20); g.lineTo(x1 + e, y + 18); }
  g.stroke();
  g.strokeStyle = '#d8a83c'; g.lineWidth = 2; g.beginPath();                                   // franges d'or
  for (let x = x0 - e; x <= x1 + e; x += 7) { g.moveTo(x, y0 - e); g.lineTo(x - 1, y0 - e - 10); g.moveTo(x, y1 + e); g.lineTo(x + 1, y1 + e + 10); }
  for (let y = y0 - e; y <= y1 + e; y += 7) { g.moveTo(x0 - e, y); g.lineTo(x0 - e - 10, y + 1); g.moveTo(x1 + e, y); g.lineTo(x1 + e + 10, y - 1); }
  g.stroke();
  g.strokeStyle = '#e8bc50'; g.lineWidth = 5; g.beginPath(); g.rect(x0 - e, y0 - e, x1 - x0 + 2 * e, y1 - y0 + 2 * e); g.stroke();
  g.strokeStyle = 'rgba(255,226,150,0.7)'; g.lineWidth = 3; g.beginPath(); U.rr(g, x0 + 3, y0 + 3, x1 - x0 - 6, y1 - y0 - 6, t.r - 3); g.stroke();   // arête de la table, sous la nappe
  g.strokeStyle = 'rgba(30,0,6,0.5)'; g.lineWidth = 3; g.beginPath(); U.rr(g, x0 - 1, y0 - 1, x1 - x0 + 2, y1 - y0 + 2, t.r + 1); g.stroke();
  g.restore();
}

// ── décor de la table du réveillon (dessiné autour de l'origine ; d = [x, y, type, angle, variante]) ──
const DECOR = {
  sapin(g, d, R, U) {                                 // le sapin du centre de table vu d'en haut : étages d'aiguilles, guirlande d'or, boules, étoile
    ombre(g, 24, 36, q => etoile(q, 0, 0, 200, 160, 14, 0.1));
    const VERTS = ['#0e3f20', '#145028', '#1b6331', '#23763a', '#2f8a45'];
    for (let k = 0; k < 5; k++) {
      const r1 = 200 - k * 37, r2 = r1 * 0.8, a = 0.1 + k * 0.21, nb = 14 - k * 2;
      if (k) { g.fillStyle = 'rgba(4,24,10,0.35)'; g.beginPath(); etoile(g, 6, 9, r1, r2, nb, a); g.fill(); }
      g.fillStyle = VERTS[k]; g.beginPath(); etoile(g, 0, 0, r1, r2, nb, a); g.fill();
      g.strokeStyle = 'rgba(150,220,140,0.22)'; g.lineWidth = 2; g.beginPath();                  // aiguilles
      for (let j = 0; j < 70 - k * 10; j++) { const u = R() * TAU, q = r2 * (0.45 + R() * 0.55); g.moveTo(Math.cos(u) * q * 0.82, Math.sin(u) * q * 0.82); g.lineTo(Math.cos(u + 0.04) * q, Math.sin(u + 0.04) * q); }
      g.stroke();
    }
    g.fillStyle = 'rgba(255,255,255,0.55)'; g.beginPath(); for (let k = 0; k < 60; k++) { const u = R() * TAU, q = 30 + R() * 160; rond(g, Math.cos(u) * q, Math.sin(u) * q, 1.6 + R() * 2); } g.fill();   // neige artificielle
    g.fillStyle = '#f2c850'; g.beginPath(); for (let s = 0; s < 1; s += 0.006) { const u = s * TAU * 4.2, q = 22 + s * 168; rond(g, Math.cos(u) * q, Math.sin(u) * q, 3); } g.fill();   // guirlande de perles
    const COL = ['#e0182e', '#f2c23a', '#d8dde6', '#2a66d8', '#b0186a'];
    for (let k = 0; k < 26; k++) { const u = k * 2.4 + R() * 0.5, q = 40 + ((k * 37) % 150), r = 7 + R() * 5; g.fillStyle = 'rgba(4,24,10,0.4)'; g.beginPath(); rond(g, Math.cos(u) * q + 3, Math.sin(u) * q + 4, r); g.fill(); sphere(g, U, Math.cos(u) * q, Math.sin(u) * q, r, COL[k % COL.length]); }
    const hg = g.createRadialGradient(0, 0, 0, 0, 0, 80);                                       // l'étoile du sommet, au centre
    hg.addColorStop(0, 'rgba(255,240,170,0.8)'); hg.addColorStop(1, 'rgba(255,220,120,0)');
    g.fillStyle = hg; g.beginPath(); rond(g, 0, 0, 80); g.fill();
    g.fillStyle = '#b07c18'; g.beginPath(); etoile(g, 3, 4, 36, 15, 5, -Math.PI / 2); g.fill();
    g.fillStyle = '#f6c83c'; g.beginPath(); etoile(g, 0, 0, 36, 15, 5, -Math.PI / 2); g.fill();
    g.fillStyle = '#fff2b0'; g.beginPath(); etoile(g, -2, -2, 16, 7, 5, -Math.PI / 2); g.fill();
  },
  assiette(g, d, R, U) {                              // couvert du réveillon : couverts d'argent, assiette à liseré d'or, plat selon la variante
    g.rotate(d[3]);
    ombre(g, 4, 6, q => { q.rect(-162, -64, 14, 128); q.rect(148, -70, 14, 140); });
    g.fillStyle = '#c9ced6'; g.beginPath(); U.rr(g, -161, -10, 12, 76, 5); g.fill();            // fourchette
    g.fillRect(-163, -40, 16, 32); g.fillStyle = '#c9ced6'; for (let k = 0; k < 4; k++) g.fillRect(-163 + k * 4.5, -66, 2.6, 28);
    g.fillStyle = '#eef1f5'; g.fillRect(-159, -6, 3, 66);
    g.fillStyle = '#c9ced6'; g.beginPath(); U.rr(g, 148, 6, 14, 64, 6); g.fill();               // couteau
    g.fillStyle = '#dde1e7'; g.beginPath(); g.moveTo(149, 8); g.lineTo(149, -60); g.quadraticCurveTo(162, -70, 162, -40); g.lineTo(161, 8); g.closePath(); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.7)'; g.fillRect(151, -56, 2.5, 60);
    ombre(g, 7, 11, q => rond(q, 0, 0, 112));
    g.fillStyle = '#f7f3ea'; g.beginPath(); rond(g, 0, 0, 112); g.fill();
    g.strokeStyle = '#c99a36'; g.lineWidth = 3.5; g.beginPath(); rond(g, 0, 0, 106); g.stroke();
    g.lineWidth = 1.5; g.beginPath(); rond(g, 0, 0, 80); g.stroke();
    g.strokeStyle = 'rgba(120,100,80,0.14)'; g.lineWidth = 8; g.beginPath(); rond(g, 0, 0, 74); g.stroke();
    g.fillStyle = '#ffffff'; g.beginPath(); rond(g, -4, -4, 66); g.fill();
    for (const u of [-2.4, -0.3, 1.8]) houx(g, Math.cos(u) * 93, Math.sin(u) * 93, 13, u + 1.6);
    const v = d[4] | 0;
    if (v === 0) {                                      // foie gras, toasts, confit de figue
      ombre(g, 3, 4, q => { q.rect(-46, -30, 54, 40); q.rect(-30, 16, 54, 34); });
      g.fillStyle = '#e8b89a'; g.beginPath(); U.rr(g, -46, -30, 54, 40, 10); U.rr(g, -30, 16, 54, 34, 10); g.fill();
      g.strokeStyle = '#f2d890'; g.lineWidth = 4; g.beginPath(); U.rr(g, -46, -30, 54, 40, 10); U.rr(g, -30, 16, 54, 34, 10); g.stroke();
      g.fillStyle = '#d29a52'; g.beginPath(); for (const q of [[24, -40], [40, -10]]) { g.moveTo(q[0], q[1]); g.lineTo(q[0] + 34, q[1] + 6); g.lineTo(q[0] + 8, q[1] + 30); g.closePath(); } g.fill();
      g.fillStyle = '#6a1a36'; g.beginPath(); ov(g, 34, 34, 15, 11); g.fill(); g.fillStyle = 'rgba(255,255,255,0.4)'; g.beginPath(); ov(g, 30, 30, 5, 3); g.fill();
      g.fillStyle = '#5aa040'; g.beginPath(); for (const q of [[-54, 22], [-48, 36], [-38, 44]]) ov(g, q[0], q[1], 10, 6); g.fill();
    } else if (v === 1) {                               // dinde aux marrons, haricots, sauce
      U.blob(g, 6, 8, 46, 34, 0.3, R, '#8a5228');
      ombre(g, 3, 4, q => { ov(q, -10, -6, 42, 26); ov(q, 8, 12, 40, 24); });
      g.fillStyle = '#eed6b0'; g.beginPath(); ov(g, -10, -6, 42, 26); ov(g, 8, 12, 40, 24); g.fill();
      g.strokeStyle = '#b4743a'; g.lineWidth = 4; g.beginPath(); ov(g, -10, -6, 42, 26); g.stroke();
      g.fillStyle = '#6e3a1a'; g.beginPath(); for (const q of [[40, -34], [54, -16], [28, -46], [50, 34]]) rond(g, q[0], q[1], 11); g.fill();
      g.fillStyle = 'rgba(255,220,180,0.45)'; g.beginPath(); for (const q of [[40, -34], [54, -16], [28, -46], [50, 34]]) rond(g, q[0] - 3, q[1] - 4, 4); g.fill();
      g.strokeStyle = '#3f8a34'; g.lineWidth = 5; g.lineCap = 'round'; g.beginPath(); for (let k = 0; k < 6; k++) { g.moveTo(-58 + k * 6, 22); g.lineTo(-40 + k * 6, 56); } g.stroke();
    } else if (v === 2) {                               // tranche de bûche, framboises, menthe
      ombre(g, 4, 6, q => rond(q, 0, 0, 44));
      g.fillStyle = '#4e2a14'; g.beginPath(); rond(g, 0, 0, 44); g.fill();
      g.strokeStyle = '#f2e2c2'; g.lineWidth = 6; g.beginPath(); for (let a = 0; a < 5.5 * Math.PI; a += 0.2) { const q = 4 + a * 2.2; if (a) g.lineTo(Math.cos(a) * q, Math.sin(a) * q); else g.moveTo(q, 0); } g.stroke();
      g.strokeStyle = '#7a4424'; g.lineWidth = 3; g.beginPath(); rond(g, 0, 0, 41); g.stroke();
      g.fillStyle = '#c81a3a'; g.beginPath(); for (const q of [[52, -24], [58, -6], [46, 26]]) rond(g, q[0], q[1], 7); g.fill();
      g.fillStyle = '#3a9a40'; g.beginPath(); ov(g, -50, 30, 12, 6); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.75)'; g.beginPath(); for (let k = 0; k < 20; k++) rond(g, (R() - 0.5) * 70, (R() - 0.5) * 70, 1.6); g.fill();
    } else {                                            // coquilles Saint-Jacques
      for (const q of [[-26, -10, -0.4], [28, 10, 0.5]]) {
        g.save(); g.translate(q[0], q[1]); g.rotate(q[2]);
        ombre(g, 3, 4, h => { h.moveTo(0, 30); h.arc(0, 30, 44, -2.6, -0.54); h.closePath(); });
        g.fillStyle = '#f0d2ae'; g.beginPath(); g.moveTo(0, 30); g.arc(0, 30, 44, -2.6, -0.54); g.closePath(); g.fill();
        g.strokeStyle = 'rgba(170,110,60,0.5)'; g.lineWidth = 2; g.beginPath(); for (let k = 0; k < 9; k++) { const u = -2.6 + k * 0.258; g.moveTo(0, 30); g.lineTo(Math.cos(u) * 44, 30 + Math.sin(u) * 44); } g.stroke();
        g.fillStyle = '#fff4e2'; g.beginPath(); rond(g, 0, 0, 14); g.fill(); g.fillStyle = '#f08a4a'; g.beginPath(); ov(g, 14, 6, 8, 5); g.fill();
        g.restore();
      }
    }
  },
  flute(g, d) {                                       // flûte de champagne vue d'en haut : pied de verre, buvant doré, bulles
    g.fillStyle = 'rgba(46,0,10,0.2)'; g.beginPath(); rond(g, 12, 16, 36); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.4)'; g.lineWidth = 3; g.beginPath(); rond(g, 7, 9, 34); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.3)'; g.lineWidth = 5; g.beginPath(); g.moveTo(0, 0); g.lineTo(7, 9); g.stroke();
    g.fillStyle = 'rgba(250,236,180,0.4)'; g.beginPath(); rond(g, 0, 0, 25); g.fill();
    g.fillStyle = '#e8c254'; g.beginPath(); rond(g, 0, 0, 20); g.fill();
    g.fillStyle = 'rgba(255,250,220,0.85)'; g.beginPath(); for (let k = 0; k < 9; k++) { const u = k * 0.7, q = 4 + (k * 5) % 13; rond(g, Math.cos(u) * q, Math.sin(u) * q, 1.4 + (k % 3) * 0.5); } g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 2.5; g.beginPath(); rond(g, 0, 0, 25); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 3; g.beginPath(); g.arc(0, 0, 21, 3.6, 4.6); g.stroke();
  },
  papillote(g, d) {                                   // papillote (cracker) : tube de papier brillant, bouts froncés, bagues d'or
    const col = PAPIERS[(d[4] | 0) % PAPIERS.length];
    g.rotate(d[3]);
    const corps = q => { U_rect(q, -44, -15, 88, 30); for (const s of [-1, 1]) { q.moveTo(s * 44, -9); q.lineTo(s * 86, -24); q.lineTo(s * 86, 24); q.lineTo(s * 44, 9); q.closePath(); } };
    ombre(g, 5, 8, corps);
    g.fillStyle = col[0]; g.beginPath(); corps(g); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.3)'; g.fillRect(-44, -13, 88, 7);
    g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(-44, 7, 88, 8);
    g.fillStyle = col[1]; g.fillRect(-46, -16, 8, 32); g.fillRect(38, -16, 8, 32);
    g.beginPath(); for (let x = -26; x <= 26; x += 17) etoile(g, x, 0, 7, 3, 5, -Math.PI / 2); g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.22)'; g.lineWidth = 1.5; g.beginPath();
    for (const s of [-1, 1]) for (let k = -2; k <= 2; k++) { g.moveTo(s * 48, k * 3); g.lineTo(s * 84, k * 9.5); }
    g.stroke();
  },
  pliage(g, d) {                                      // serviette pliée en éventail dans son rond doré, brin de houx
    g.rotate(d[3]);
    const f = q => { q.moveTo(0, 40); q.arc(0, 40, 92, -2.45, -0.69); q.closePath(); };
    ombre(g, 5, 8, f);
    g.fillStyle = '#f4efe2'; g.beginPath(); f(g); g.fill();
    g.strokeStyle = 'rgba(150,120,80,0.35)'; g.lineWidth = 2; g.beginPath(); for (let k = 1; k < 8; k++) { const u = -2.45 + k * 0.22; g.moveTo(0, 40); g.lineTo(Math.cos(u) * 92, 40 + Math.sin(u) * 92); } g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.6)'; g.beginPath(); for (let k = 0; k < 8; k += 2) { const u = -2.45 + k * 0.22; g.moveTo(0, 40); g.arc(0, 40, 92, u, u + 0.1); g.closePath(); } g.fill();
    g.strokeStyle = '#c8102e'; g.lineWidth = 3; g.beginPath(); g.arc(0, 40, 88, -2.42, -0.72); g.stroke();
    g.fillStyle = '#d8a83c'; g.beginPath(); U_rect(g, -22, 18, 44, 20); g.fill();
    g.fillStyle = '#f6d878'; g.fillRect(-22, 18, 44, 5);
    houx(g, 0, 26, 18, -1.2);
  },
  bonhomme(g, d) {                                    // bonhomme en pain d'épice : glaçage blanc, boutons en bonbons
    g.rotate(d[3]);
    const corps = (q, w) => { q.lineWidth = w; q.lineCap = 'round'; q.beginPath(); q.moveTo(-28, -8); q.lineTo(28, -8); q.moveTo(0, -24); q.lineTo(0, 12); q.moveTo(0, 10); q.lineTo(-17, 38); q.moveTo(0, 10); q.lineTo(17, 38); q.stroke(); };
    g.save(); g.translate(4, 6); g.strokeStyle = 'rgba(46,0,10,0.3)'; corps(g, 22); g.beginPath(); rond(g, 0, -28, 17); g.fillStyle = 'rgba(46,0,10,0.3)'; g.fill(); g.restore();
    g.strokeStyle = '#7a3e14'; corps(g, 22); g.fillStyle = '#7a3e14'; g.beginPath(); rond(g, 0, -28, 17); g.fill();
    g.strokeStyle = '#b8682a'; corps(g, 18); g.fillStyle = '#b8682a'; g.beginPath(); rond(g, 0, -28, 15); g.fill();
    g.strokeStyle = '#fbf6ee'; g.lineWidth = 2; g.beginPath();
    for (const q of [[-26, -8], [26, -8], [-15, 35], [15, 35]]) { g.moveTo(q[0] - 5, q[1] - 5); g.lineTo(q[0], q[1] + 2); g.lineTo(q[0] + 5, q[1] - 5); }
    g.moveTo(-6, -24); g.arc(0, -26, 6, 0.4, 2.7); g.stroke();
    g.fillStyle = '#fbf6ee'; g.beginPath(); rond(g, -5, -32, 2.2); rond(g, 5, -32, 2.2); g.fill();
    g.fillStyle = '#d8162a'; g.beginPath(); rond(g, 0, -4, 3.4); g.fill(); g.fillStyle = '#18884a'; g.beginPath(); rond(g, 0, 6, 3.4); g.fill();
  },
  pomme(g, d) {                                       // pomme de pin : écailles en quinconce
    g.rotate(d[3]);
    ombre(g, 4, 6, q => ov(q, 0, 0, 20, 32));
    g.fillStyle = '#5a3218'; g.beginPath(); ov(g, 0, 0, 20, 32); g.fill();
    g.fillStyle = '#9a6234'; g.beginPath();
    for (let r = 0; r < 7; r++) { const y = -26 + r * 8.5, w = 18 * Math.sin(Math.PI * (r + 0.6) / 7.4); for (let k = -1; k <= 1; k++) { const x = k * w * 0.62 + (r % 2) * 4 - 2; g.moveTo(x - 5, y); g.quadraticCurveTo(x, y + 8, x + 5, y); g.closePath(); } }
    g.fill();
    g.fillStyle = 'rgba(255,240,210,0.6)'; g.beginPath(); for (let k = 0; k < 8; k++) rond(g, (k % 3 - 1) * 9, -22 + k * 6, 1.4); g.fill();
    g.fillStyle = '#4a2a12'; g.fillRect(-2, -38, 4, 8);
  },
  chandelier(g, d) {                                  // chandelier à trois branches : bras dorés, bougies rouges, flammes
    g.rotate(d[3]);
    ombre(g, 10, 15, q => { U_rect(q, -84, -8, 168, 16); for (const x of [-72, 0, 72]) rond(q, x, 0, 18); rond(q, 0, 0, 34); });
    const or = g.createRadialGradient(-14, -14, 4, 0, 0, 36); or.addColorStop(0, '#fff0b0'); or.addColorStop(0.5, '#d8a83c'); or.addColorStop(1, '#8a6418');
    g.fillStyle = or; g.beginPath(); rond(g, 0, 0, 34); g.fill();
    g.strokeStyle = '#a87c22'; g.lineWidth = 12; g.lineCap = 'round'; g.beginPath(); g.moveTo(-72, 0); g.quadraticCurveTo(-36, 26, 0, 0); g.quadraticCurveTo(36, 26, 72, 0); g.stroke();
    g.strokeStyle = '#ecc45a'; g.lineWidth = 5; g.beginPath(); g.moveTo(-72, -2); g.quadraticCurveTo(-36, 22, 0, -2); g.quadraticCurveTo(36, 22, 72, -2); g.stroke();
    for (const x of [-72, 0, 72]) {
      g.fillStyle = '#c89a32'; g.beginPath(); rond(g, x, 0, 17); g.fill();
      g.fillStyle = '#b01628'; g.beginPath(); rond(g, x, 0, 11); g.fill();
      g.fillStyle = '#d8344a'; g.beginPath(); rond(g, x - 2, -2, 7); g.fill();
      g.fillStyle = '#e8e0d0'; g.beginPath(); ov(g, x + 9, 5, 3, 5); g.fill();
      flamme(g, x, 0, 6);
    }
  },
  clementines(g, d, R) {                              // clémentines (et une feuille), petite pyramide
    const nb = (d[4] | 0) || 4;
    for (let k = 0; k < nb; k++) {
      const u = k * 2.4, q = k ? 30 + (k % 2) * 6 : 0, x = Math.cos(u) * q, y = Math.sin(u) * q, r = 21;
      g.fillStyle = 'rgba(46,0,10,0.25)'; g.beginPath(); rond(g, x + 5, y + 7, r); g.fill();
      const gr = g.createRadialGradient(x - 7, y - 8, 2, x, y, r); gr.addColorStop(0, '#ffd08a'); gr.addColorStop(0.45, '#f58a1c'); gr.addColorStop(1, '#b4500c');
      g.fillStyle = gr; g.beginPath(); rond(g, x, y, r); g.fill();
      g.fillStyle = 'rgba(150,60,0,0.3)'; g.beginPath(); for (let j = 0; j < 14; j++) rond(g, x + (R() - 0.5) * 30, y + (R() - 0.5) * 30, 1); g.fill();
      g.fillStyle = '#6a3a10'; g.beginPath(); rond(g, x + 2, y + 1, 2.2); g.fill();
    }
    g.fillStyle = '#2a7a34'; g.beginPath(); g.moveTo(4, -2); g.quadraticCurveTo(26, -30, 44, -16); g.quadraticCurveTo(24, 0, 4, -2); g.fill();
    g.strokeStyle = 'rgba(170,230,150,0.6)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(6, -3); g.lineTo(40, -15); g.stroke();
  },
  chocolats(g, d, R) {                                // boîte de chocolats ouverte, couvercle glissé dessous
    g.rotate(d[3]);
    g.save(); g.translate(-46, 52); g.rotate(0.3);
    ombre(g, 6, 9, q => U_rect(q, -120, -80, 240, 160));
    g.fillStyle = '#a8122a'; g.fillRect(-120, -80, 240, 160);
    g.fillStyle = '#e2b84a'; g.beginPath(); g.moveTo(-120, 40); g.lineTo(60, -80); g.lineTo(84, -80); g.lineTo(-96, 80); g.lineTo(-120, 80); g.closePath(); g.fill();
    g.restore();
    ombre(g, 6, 9, q => U_rect(q, -116, -78, 232, 156));
    g.fillStyle = '#d8a83c'; g.fillRect(-116, -78, 232, 156);
    g.fillStyle = '#f2d27a'; g.fillRect(-116, -78, 232, 5); g.fillRect(-116, -78, 5, 156);
    g.fillStyle = '#3a1c0c'; g.fillRect(-104, -66, 208, 132);
    const BON = ['#4a2410', '#7a4424', '#f2e8d4', '#5a2a12', '#8a5230'];
    for (let r = 0; r < 3; r++) for (let k = 0; k < 5; k++) {
      const x = -82 + k * 41, y = -42 + r * 42, b = (r * 5 + k * 3) % 7;
      g.fillStyle = '#b88a2c'; g.beginPath(); etoile(g, x, y, 19, 16, 12, 0); g.fill();
      if (b === 6) { g.fillStyle = '#6a4416'; g.beginPath(); rond(g, x, y, 12); g.fill(); continue; }   // déjà mangé
      g.fillStyle = BON[b % BON.length]; g.beginPath(); if (b % 2) U_rect(g, x - 12, y - 12, 24, 24); else rond(g, x, y, 13); g.fill();
      g.strokeStyle = b === 2 ? '#7a4424' : 'rgba(250,240,220,0.7)'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(x - 9, y - 3); g.lineTo(x - 3, y + 3); g.lineTo(x + 3, y - 3); g.lineTo(x + 9, y + 3); g.stroke();
      if (b === 4) { g.fillStyle = '#f4d060'; g.beginPath(); rond(g, x + 4, y - 5, 3); g.fill(); }
    }
  },
  boite(g, d) {                                       // boîte à musique de la danseuse : couvercle ouvert (miroir), velours, cylindre à picots, manivelle
    g.rotate(d[3]);
    ombre(g, 8, 12, q => U_rect(q, -78, -96, 156, 150));
    g.fillStyle = '#6a3e22'; g.fillRect(-78, -96, 156, 50);                                     // couvercle ouvert, rabattu vers le haut
    g.fillStyle = '#cfd9e2'; g.fillRect(-66, -88, 132, 36);
    g.fillStyle = 'rgba(255,255,255,0.7)'; g.beginPath(); g.moveTo(-50, -88); g.lineTo(-30, -88); g.lineTo(-52, -52); g.lineTo(-66, -52); g.lineTo(-66, -62); g.closePath(); g.fill();
    g.fillStyle = '#7e4a2a'; g.fillRect(-78, -44, 156, 98);
    g.strokeStyle = '#d8a83c'; g.lineWidth = 3; g.strokeRect(-72, -38, 144, 86);
    g.fillStyle = '#9a1a2a'; g.fillRect(-64, -30, 128, 70);
    g.fillStyle = '#c89a32'; g.fillRect(-48, 12, 96, 16); g.fillStyle = '#f2d27a'; g.fillRect(-48, 12, 96, 4);
    g.fillStyle = '#7a5a18'; g.beginPath(); for (let x = -42; x < 48; x += 8) rond(g, x, 22 + ((x / 8) % 2) * 3, 1.5); g.fill();
    g.fillStyle = '#e8c254'; g.beginPath(); rond(g, 0, -6, 16); g.fill(); g.fillStyle = '#fff0b0'; g.beginPath(); rond(g, -4, -10, 5); g.fill();   // socle vide de la danseuse
    g.strokeStyle = '#c89a32'; g.lineWidth = 5; g.lineCap = 'round'; g.beginPath(); g.moveTo(78, 10); g.lineTo(100, 10); g.lineTo(100, 34); g.stroke();
    g.fillStyle = '#3a2010'; g.beginPath(); rond(g, 100, 36, 6); g.fill();
    g.fillStyle = '#e8c254'; for (const q of [[-78, -44], [72, -44], [-78, 48], [72, 48]]) g.fillRect(q[0], q[1], 6, 6);
  },
  paquet(g, d) {                                      // pile de cadeaux (décor) et leur étiquette
    g.rotate(d[3]);
    const k = d[4] | 0;
    cadeau(g, -20, 10, 58, 0.15, k); cadeau(g, 52, -38, 36, -0.35, k + 2); cadeau(g, 40, 52, 26, 0.6, k + 4);
    g.strokeStyle = '#d8a83c'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(-20, 10); g.lineTo(-86, 66); g.stroke();
    g.save(); g.translate(-96, 72); g.rotate(0.5);
    g.fillStyle = 'rgba(46,0,10,0.25)'; g.fillRect(-14, -8, 34, 22);
    g.fillStyle = '#f6f0e0'; g.beginPath(); g.moveTo(-18, -11); g.lineTo(14, -11); g.lineTo(20, 0); g.lineTo(14, 11); g.lineTo(-18, 11); g.closePath(); g.fill();
    g.strokeStyle = '#c8102e'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(-12, -2); g.lineTo(6, -2); g.moveTo(-12, 4); g.lineTo(2, 4); g.stroke();
    g.restore();
  },
  houx(g, d) { houx(g, 0, 0, 30, d[3]); houx(g, 24, 14, 22, d[3] + 1); },  // brin de houx posé sur la nappe
  verre(g) {                                          // verre de vin rouge vu d'en haut : pied, buvant, reflets
    g.fillStyle = 'rgba(46,0,10,0.2)'; g.beginPath(); rond(g, 13, 17, 40); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.38)'; g.lineWidth = 3; g.beginPath(); rond(g, 8, 10, 36); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.3)'; g.lineWidth = 5; g.beginPath(); g.moveTo(0, 0); g.lineTo(8, 10); g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.14)'; g.beginPath(); rond(g, 0, 0, 34); g.fill();
    g.fillStyle = '#5e0818'; g.beginPath(); rond(g, 2, 2, 24); g.fill();
    g.fillStyle = 'rgba(210,50,80,0.5)'; g.beginPath(); g.arc(2, 2, 24, 3.4, 5.2); g.arc(2, 2, 15, 5.2, 3.4, true); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.75)'; g.lineWidth = 2.5; g.beginPath(); rond(g, 0, 0, 34); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 3; g.beginPath(); g.arc(0, 0, 29, 3.5, 4.5); g.stroke();
  },
  sucreorge(g, d) {                                   // deux sucres d'orge croisés, rayés rouge et blanc
    g.rotate(d[3]);
    const canne = q => { q.beginPath(); q.moveTo(0, 42); q.lineTo(0, -18); q.arc(13, -18, 13, Math.PI, 0); };
    for (const s of [[-14, 0, -0.35], [14, 4, 0.4]]) {
      g.save(); g.translate(s[0], s[1]); g.rotate(s[2]);
      g.lineCap = 'round'; g.lineWidth = 10;
      g.save(); g.translate(4, 6); canne(g); g.strokeStyle = 'rgba(46,0,10,0.3)'; g.stroke(); g.restore();
      canne(g); g.strokeStyle = '#fbf6ee'; g.stroke();
      g.lineCap = 'butt'; g.setLineDash([6, 7]); g.strokeStyle = '#d4142a'; canne(g); g.stroke(); g.setLineDash([]);
      g.lineWidth = 2; g.strokeStyle = 'rgba(255,255,255,0.65)'; g.translate(-2.5, 0); canne(g); g.stroke();
      g.restore();
    }
  },
  globe(g, d, R) {                                    // boule à neige : socle de bois, chalet et sapin sous le verre, flocons
    ombre(g, 8, 12, q => rond(q, 0, 0, 58));
    g.fillStyle = '#6a3e22'; g.beginPath(); rond(g, 0, 0, 58); g.fill();
    g.strokeStyle = '#d8a83c'; g.lineWidth = 3; g.beginPath(); rond(g, 0, 0, 52); g.stroke();
    g.fillStyle = '#a8c8e4'; g.beginPath(); rond(g, 0, 0, 46); g.fill();
    g.fillStyle = '#f4f8fc'; g.beginPath(); ov(g, 0, 8, 40, 30); g.fill();
    g.fillStyle = 'rgba(46,0,10,0.25)'; g.fillRect(-18, -2, 26, 20);
    g.fillStyle = '#8a2a1a'; g.fillRect(-22, -6, 26, 20); g.fillStyle = '#fbf6ee'; g.fillRect(-22, 3, 26, 3);   // toit du chalet, faîte enneigé
    g.fillStyle = '#ffd86a'; g.fillRect(-14, 14, 6, 4);
    g.fillStyle = '#145028'; g.beginPath(); etoile(g, 18, -12, 15, 9, 7, 0); g.fill();
    g.fillStyle = '#2f8a45'; g.beginPath(); etoile(g, 18, -12, 9, 5, 6, 0.3); g.fill();
    g.fillStyle = '#ffffff'; g.beginPath(); for (let k = 0; k < 26; k++) { const u = R() * TAU, q = Math.sqrt(R()) * 40; rond(g, Math.cos(u) * q, Math.sin(u) * q, 1.4 + R()); } g.fill();
    g.fillStyle = 'rgba(255,255,255,0.16)'; g.beginPath(); rond(g, 0, 0, 46); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.75)'; g.lineWidth = 4; g.beginPath(); g.arc(0, 0, 40, 3.5, 4.6); g.stroke();
  },
  biscuits(g) {                                       // assiette de sablés de Noël : étoiles glacées, perles de sucre
    ombre(g, 6, 9, q => rond(q, 0, 0, 70));
    g.fillStyle = '#f7f3ea'; g.beginPath(); rond(g, 0, 0, 70); g.fill();
    g.strokeStyle = '#2a7a40'; g.lineWidth = 3; g.beginPath(); rond(g, 0, 0, 64); g.stroke();
    for (let k = 0; k < 7; k++) {
      const u = k * 0.9 + 0.3, q = k ? 40 : 0, x = Math.cos(u) * q, y = Math.sin(u) * q;
      g.fillStyle = 'rgba(46,0,10,0.18)'; g.beginPath(); etoile(g, x + 2, y + 3, 17, 8, 5, u); g.fill();
      g.fillStyle = '#e0a85a'; g.beginPath(); etoile(g, x, y, 17, 8, 5, u); g.fill();
      g.fillStyle = k % 2 ? '#fbf6ee' : '#f2c2d0'; g.beginPath(); etoile(g, x, y, 11, 5, 5, u); g.fill();
      g.fillStyle = k % 3 ? '#d4142a' : '#1a8a4a'; g.beginPath(); rond(g, x, y, 2.4); g.fill();
    }
  },
  carafe(g) {                                         // carafe de vin vue d'en haut : panse, goulot, bouchon de verre taillé
    g.fillStyle = 'rgba(46,0,10,0.22)'; g.beginPath(); rond(g, 14, 18, 62); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.14)'; g.beginPath(); rond(g, 0, 0, 60); g.fill();
    g.fillStyle = '#4e0614'; g.beginPath(); rond(g, 2, 3, 52); g.fill();
    g.fillStyle = 'rgba(200,44,76,0.45)'; g.beginPath(); g.arc(2, 3, 52, 3.3, 5.3); g.arc(2, 3, 36, 5.3, 3.3, true); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 3; g.beginPath(); rond(g, 0, 0, 60); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 4; g.beginPath(); rond(g, 0, 0, 17); g.stroke();
    g.fillStyle = 'rgba(226,238,246,0.85)'; g.beginPath(); rond(g, 0, 0, 12); g.fill();
    g.strokeStyle = 'rgba(120,150,170,0.6)'; g.lineWidth = 1.2; g.beginPath(); for (let k = 0; k < 6; k++) { const u = k * Math.PI / 3; g.moveTo(0, 0); g.lineTo(Math.cos(u) * 12, Math.sin(u) * 12); } g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 4; g.beginPath(); g.arc(0, 0, 54, 3.6, 4.4); g.stroke();
  },
  noix(g, d, R) {                                     // coupelle de noix et de noisettes, casse-noix doré, coquilles cassées
    g.rotate(d[3]);
    ombre(g, 6, 9, q => rond(q, 0, 0, 56));
    g.fillStyle = '#e8dcc8'; g.beginPath(); rond(g, 0, 0, 56); g.fill();
    g.strokeStyle = '#b89a6a'; g.lineWidth = 3; g.beginPath(); rond(g, 0, 0, 53); g.stroke();
    g.fillStyle = '#d4c2a0'; g.beginPath(); rond(g, 2, 2, 44); g.fill();
    for (let k = 0; k < 9; k++) {
      const u = k * 2.3, q = k ? 14 + (k % 3) * 9 : 0, x = Math.cos(u) * q, y = Math.sin(u) * q, gros = k % 3 !== 1;
      g.fillStyle = 'rgba(60,30,10,0.3)'; g.beginPath(); rond(g, x + 2, y + 3, gros ? 13 : 9); g.fill();
      g.fillStyle = gros ? '#b8844c' : '#8a5228'; g.beginPath(); rond(g, x, y, gros ? 13 : 9); g.fill();
      g.strokeStyle = gros ? 'rgba(90,50,20,0.6)' : 'rgba(230,200,150,0.6)'; g.lineWidth = 1.5; g.beginPath();
      if (gros) { g.moveTo(x - 12, y); g.lineTo(x + 12, y); g.moveTo(x - 7, y - 7); g.quadraticCurveTo(x - 3, y - 2, x - 7, y + 6); g.moveTo(x + 6, y - 8); g.quadraticCurveTo(x + 2, y, x + 6, y + 7); }
      else g.arc(x, y, 6, 3.6, 5.6);
      g.stroke();
    }
    g.strokeStyle = 'rgba(46,0,10,0.3)'; g.lineWidth = 8; g.lineCap = 'round'; g.beginPath(); g.moveTo(76, -34); g.lineTo(128, 12); g.moveTo(76, -34); g.lineTo(110, 30); g.stroke();
    g.strokeStyle = '#c89a32'; g.lineWidth = 7; g.beginPath(); g.moveTo(72, -40); g.lineTo(124, 6); g.moveTo(72, -40); g.lineTo(106, 24); g.stroke();
    g.strokeStyle = '#f2d27a'; g.lineWidth = 2; g.beginPath(); g.moveTo(72, -42); g.lineTo(124, 3); g.stroke();
    g.fillStyle = '#8a6418'; g.beginPath(); rond(g, 72, -40, 6); g.fill();
    g.fillStyle = '#a8784a'; g.beginPath(); for (const q of [[-70, 40], [-60, 54], [40, 66]]) { g.moveTo(q[0], q[1]); g.arc(q[0], q[1], 8, 0.4, 3.4); g.closePath(); } g.fill();
  },
  bolduc(g, d) {                                      // rubans de bolduc frisés, tombés des paquets
    g.rotate(d[3]);
    const COL = ['#f2c850', '#d4142a', '#1a8a4a'];
    g.lineCap = 'round'; g.lineWidth = 3;
    for (let k = 0; k < 3; k++) {
      const oy = (k - 1) * 18, ph = k * 1.3;
      const frise = (q, dx, dy) => { q.beginPath(); for (let t = 0; t <= 1.0001; t += 0.02) { const x = -64 + t * 128 + Math.cos(t * 28 + ph) * 9 + dx, y = oy + Math.sin(t * 28 + ph) * 9 + Math.sin(t * 5) * 8 + dy; if (t) q.lineTo(x, y); else q.moveTo(x, y); } };
      frise(g, 3, 5); g.strokeStyle = 'rgba(46,0,10,0.25)'; g.stroke();
      frise(g, 0, 0); g.strokeStyle = COL[k]; g.stroke();
    }
  },
  carte(g, d) {                                       // carte de vœux posée à plat : houx, « Joyeux Noël » à l'encre d'or
    g.rotate(d[3]);
    ombre(g, 5, 8, q => q.rect(-62, -40, 124, 80));
    g.fillStyle = '#f8f2e4'; g.fillRect(-62, -40, 124, 80);
    g.strokeStyle = '#c8102e'; g.lineWidth = 3; g.strokeRect(-55, -33, 110, 66);
    g.strokeStyle = '#d8a83c'; g.lineWidth = 1.5; g.strokeRect(-50, -28, 100, 56);
    houx(g, -32, -12, 14, 0.4);
    g.fillStyle = '#b0861e'; g.font = 'italic bold 17px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('Joyeux Noël', 10, 12);
    g.fillStyle = '#e4b84c'; g.beginPath(); etoile(g, 30, -14, 7, 3, 5, -Math.PI / 2); etoile(g, 44, -6, 4, 1.8, 5, -Math.PI / 2); g.fill();
  },
};
function U_rect(g, x, y, w, h) { g.rect(x, y, w, h); }

// ── obstacles ronds : bougies (fixes), boules de Noël (elles renvoient), cadeaux ──
const OBJETS = {
  bougie(g, r) {                                      // bougie sur sa coupelle de laiton : cire, coulures, mèche, flamme et halo
    const x = r[0], y = r[1], s = r[2];
    ombre(g, s * 0.25 + 5, s * 0.35 + 8, q => rond(q, x, y, s));
    const gr = g.createRadialGradient(x - s * 0.4, y - s * 0.4, 2, x, y, s);
    gr.addColorStop(0, '#fff0b0'); gr.addColorStop(0.5, '#d8a83c'); gr.addColorStop(1, '#7a5612');
    g.fillStyle = gr; g.beginPath(); rond(g, x, y, s); g.fill();
    g.strokeStyle = 'rgba(90,60,10,0.5)'; g.lineWidth = 1.5; g.beginPath(); rond(g, x, y, s * 0.82); g.stroke();
    g.fillStyle = '#f4ecd8'; g.beginPath(); rond(g, x, y, s * 0.6); g.fill();
    g.fillStyle = '#e4d8bc'; g.beginPath(); ov(g, x + s * 0.5, y + s * 0.25, s * 0.18, s * 0.3); ov(g, x - s * 0.3, y + s * 0.52, s * 0.2, s * 0.14); g.fill();   // coulures
    g.strokeStyle = 'rgba(160,140,110,0.4)'; g.lineWidth = 2; g.beginPath(); rond(g, x, y, s * 0.42); g.stroke();
    flamme(g, x, y, s * 0.26);
  },
  boule(g, r, R, U) {                                 // boule de Noël couchée : dégradé brillant, frise dorée, attache et anneau
    const x = r[0], y = r[1], s = r[2], k = Math.abs(Math.round(x * 7 + y * 13)) % 5, COL = ['#d4142a', '#1f56c8', '#e0a82a', '#1a8a4a', '#8a2aa8'];
    ombre(g, s * 0.3 + 5, s * 0.4 + 8, q => rond(q, x, y, s));
    const a = -2.3 + k;
    g.fillStyle = '#c89a32'; g.save(); g.translate(x + Math.cos(a) * s, y + Math.sin(a) * s); g.rotate(a); g.fillRect(-3, -5, 8, 10); g.strokeStyle = '#e8c254'; g.lineWidth = 2; g.beginPath(); g.arc(8, 0, 4, 0, TAU); g.stroke(); g.restore();
    sphere(g, U, x, y, s, COL[k]);
    g.strokeStyle = k === 2 ? '#fbf6ee' : '#f2c850'; g.lineWidth = 2; g.beginPath();
    for (let j = 0; j <= 16; j++) { const u = j / 16 * TAU, q = s * (0.62 + (j % 2) * 0.12); if (j) g.lineTo(x + Math.cos(u) * q, y + Math.sin(u) * q); else g.moveTo(x + Math.cos(u) * q, y + Math.sin(u) * q); }
    g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.8)'; g.beginPath(); ov(g, x - s * 0.36, y - s * 0.42, s * 0.22, s * 0.13); g.fill();
  },
  cadeau(g, r) { cadeau(g, r[0], r[1], r[2] * 0.92, (r[0] * 0.013 + r[1] * 0.007) % 1.2 - 0.6, Math.abs(Math.round(r[0] + r[1])) % 6); },
};

// ── murs : la guirlande lumineuse (fil et ampoules qui brillent), la bûche de Noël ──
const AMPOULES = ['#ff4040', '#ffd23a', '#40e070', '#4a90ff', '#ff7ad8'];
const MURS = {
  guirlande(g, w) {                                   // un tronçon de guirlande : fil vert torsadé, une ampoule et son halo
    const mx = (w[0] + w[2]) / 2, my = (w[1] + w[3]) / 2, a = Math.atan2(w[3] - w[1], w[2] - w[0]), k = Math.abs(Math.round(mx * 0.31 + my * 0.17)) % AMPOULES.length, col = AMPOULES[k];
    g.lineCap = 'round';
    g.strokeStyle = 'rgba(46,0,10,0.3)'; g.lineWidth = 4; g.beginPath(); g.moveTo(w[0] + 3, w[1] + 5); g.lineTo(w[2] + 3, w[3] + 5); g.stroke();
    g.strokeStyle = '#163a1e'; g.lineWidth = 4; g.beginPath(); g.moveTo(w[0], w[1]); g.lineTo(w[2], w[3]); g.stroke();
    g.strokeStyle = '#3a6a3a'; g.lineWidth = 1.5; g.setLineDash([4, 4]); g.beginPath(); g.moveTo(w[0], w[1]); g.lineTo(w[2], w[3]); g.stroke(); g.setLineDash([]);
    const ox = mx - Math.sin(a) * 9, oy = my + Math.cos(a) * 9;
    const hg = g.createRadialGradient(ox, oy, 0, ox, oy, 26);
    hg.addColorStop(0, col); hg.addColorStop(0.2, col + '88'); hg.addColorStop(1, col + '00');
    g.fillStyle = hg; g.beginPath(); rond(g, ox, oy, 26); g.fill();
    g.save(); g.translate(ox, oy); g.rotate(a + Math.PI / 2);
    g.fillStyle = '#1e4a26'; g.fillRect(-3, -10, 6, 6);
    g.fillStyle = col; g.beginPath(); ov(g, 0, 2, 5, 8); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.8)'; g.beginPath(); ov(g, -1.5, 0, 1.8, 3.5); g.fill();
    g.restore();
  },
  buche(g, w, R, U) {                                 // bûche au chocolat : écorce, bouts roulés, sucre glace, houx et champignons en meringue
    const dx = w[2] - w[0], dy = w[3] - w[1], L = Math.hypot(dx, dy), r = w[4];
    g.save(); g.translate((w[0] + w[2]) / 2, (w[1] + w[3]) / 2); g.rotate(Math.atan2(dy, dx));
    ombre(g, 6, 10, q => U.rr(q, -L / 2 - r, -r, L + 2 * r, 2 * r, r * 0.6));
    g.fillStyle = '#e8d8b8'; g.beginPath(); U.rr(g, -L / 2 - r - 14, -r - 12, L + 2 * r + 28, 2 * r + 24, 10); g.fill();   // plat de service doré
    g.strokeStyle = '#d8a83c'; g.lineWidth = 3; g.beginPath(); U.rr(g, -L / 2 - r - 14, -r - 12, L + 2 * r + 28, 2 * r + 24, 10); g.stroke();
    g.fillStyle = '#4e2a14'; g.beginPath(); U.rr(g, -L / 2 - r, -r, L + 2 * r, 2 * r, r * 0.6); g.fill();
    g.strokeStyle = '#32180a'; g.lineWidth = 3; g.beginPath();
    for (let k = -2; k <= 2; k++) { const y0 = k * r * 0.34; g.moveTo(-L / 2 - r * 0.7, y0); for (let x = -L / 2 - r * 0.7; x <= L / 2 + r * 0.7; x += 12) g.lineTo(x, y0 + Math.sin(x * 0.11 + k * 1.7) * 3); }
    g.stroke();
    g.strokeStyle = 'rgba(150,96,60,0.6)'; g.lineWidth = 1.5; g.beginPath();
    for (let k = -2; k <= 1; k++) { const y0 = k * r * 0.34 + r * 0.17; g.moveTo(-L / 2 - r * 0.6, y0); for (let x = -L / 2 - r * 0.6; x <= L / 2 + r * 0.6; x += 12) g.lineTo(x, y0 + Math.sin(x * 0.13 + k) * 2.5); }
    g.stroke();
    for (const s of [-1, 1]) {                        // bouts coupés : spirale de génoise et crème
      const x = s * (L / 2 + r * 0.7);
      g.fillStyle = '#f2e2c2'; g.beginPath(); ov(g, x, 0, r * 0.36, r * 0.94); g.fill();
      g.strokeStyle = '#7a4424'; g.lineWidth = 2.5; g.beginPath(); for (let a = 0; a < 4.5 * Math.PI; a += 0.25) { const q = 1 + a * 0.065; if (a) g.lineTo(x + Math.cos(a) * r * 0.06 * q * 4.2 * 0.36, Math.sin(a) * r * 0.06 * q * 4.2); else g.moveTo(x + r * 0.02, 0); } g.stroke();
      g.strokeStyle = '#32180a'; g.lineWidth = 3; g.beginPath(); ov(g, x, 0, r * 0.36, r * 0.94); g.stroke();
    }
    g.fillStyle = '#4e2a14'; g.beginPath(); rond(g, L * 0.12, -r * 0.95, r * 0.42); g.fill();   // nœud de branche
    g.fillStyle = '#f2e2c2'; g.beginPath(); rond(g, L * 0.12, -r * 0.95, r * 0.28); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.8)'; g.beginPath(); for (let k = 0; k < 46; k++) rond(g, (R() - 0.5) * (L + r), (R() - 0.5) * r * 1.6, 1.2 + R() * 1.4); g.fill();   // sucre glace
    houx(g, -L * 0.18, -r * 0.1, 16, 0.3);
    for (const q of [[L * 0.3, r * 0.3], [L * 0.42, -r * 0.25]]) {   // champignons en meringue
      g.fillStyle = 'rgba(46,0,10,0.3)'; g.beginPath(); rond(g, q[0] + 2, q[1] + 3, 8); g.fill();
      g.fillStyle = '#fbf6ee'; g.beginPath(); rond(g, q[0], q[1], 8); g.fill();
      g.fillStyle = '#a06a3a'; g.beginPath(); rond(g, q[0] - 2, q[1] - 2, 1.6); rond(g, q[0] + 3, q[1] + 1, 1.3); g.fill();
    }
    g.restore();
  },
};

// ── zones : neige artificielle (on glisse), paillettes (on freine) ──
const ZONES = {
  neige(g, z, R, U) {
    g.save(); g.translate(z[0], z[1]); g.rotate(z[5]);
    U.blob(g, 4, 6, z[2] * 1.04, z[3] * 1.06, 0, R, 'rgba(0,20,10,0.25)');
    U.blob(g, 0, 0, z[2], z[3], 0.2, R, '#e6eef6');
    U.blob(g, -z[2] * 0.08, -z[3] * 0.1, z[2] * 0.78, z[3] * 0.7, 0.6, R, '#ffffff');
    U.blob(g, z[2] * 0.3, z[3] * 0.3, z[2] * 0.4, z[3] * 0.3, 1, R, 'rgba(170,196,228,0.5)');
    g.strokeStyle = 'rgba(160,200,240,0.9)'; g.lineWidth = 1.5; g.beginPath();
    for (let k = 0; k < 14; k++) { const u = R() * TAU, q = Math.sqrt(R()) * 0.8, x = Math.cos(u) * z[2] * q, y = Math.sin(u) * z[3] * q; g.moveTo(x - 3, y); g.lineTo(x + 3, y); g.moveTo(x, y - 3); g.lineTo(x, y + 3); }
    g.stroke();
    g.restore();
  },
  paillettes(g, z, R, U) {
    g.save(); g.translate(z[0], z[1]); g.rotate(z[5]);
    U.blob(g, 0, 0, z[2], z[3], 0.3, R, 'rgba(240,200,90,0.3)');
    const COL = ['#ffd85a', '#f2f6fa', '#ff5a6a', '#ffe9a0'];
    for (let p = 0; p < 4; p++) {
      g.fillStyle = COL[p]; g.beginPath();
      for (let k = 0; k < 70; k++) { const u = R() * TAU, q = Math.sqrt(R()) * 0.95, s = 2 + R() * 2.5; g.rect(Math.cos(u) * z[2] * q, Math.sin(u) * z[3] * q, s, s); }
      g.fill();
    }
    g.fillStyle = '#fff4c0'; g.beginPath(); for (let k = 0; k < 6; k++) { const u = R() * TAU, q = Math.sqrt(R()) * 0.7; etoile(g, Math.cos(u) * z[2] * q, Math.sin(u) * z[3] * q, 7, 1.8, 4, 0.3); } g.fill();
    g.restore();
  },
};

// ── obstacles mobiles (redessinés à chaque image : rester sobre) ──
const MOBILES = {
  roulante(g, m, o, now, U, reduceFx) {               // boule tombée du sapin qui roule : reflet fixe, frise et attache qui tournent
    const r = m.r, L = m.chemin ? m.chemin.L : 1000, ph = reduceFx ? 0 : (now / 1000) * L / m.per / r;
    g.fillStyle = 'rgba(46,0,10,0.3)'; g.beginPath(); rond(g, o.x + r * 0.3 + 4, o.y + r * 0.4 + 6, r); g.fill();
    sphere(g, U, o.x, o.y, r, '#c8102e');
    g.save(); g.translate(o.x, o.y); g.rotate(o.a);
    const u = Math.sin(ph), w = Math.abs(Math.cos(ph));
    g.strokeStyle = '#f2c850'; g.lineWidth = 2 + 4 * w; g.beginPath(); g.moveTo(u * r * 0.9, -Math.sqrt(1 - u * u * 0.81) * r); g.lineTo(u * r * 0.9, Math.sqrt(1 - u * u * 0.81) * r); g.stroke();
    if (Math.cos(ph) > 0) { g.fillStyle = '#c89a32'; g.fillRect(Math.sin(ph + 1.57) * r * 0.85 - 4, -4, 8, 8); }
    g.restore();
    g.fillStyle = 'rgba(255,255,255,0.8)'; g.beginPath(); ov(g, o.x - r * 0.36, o.y - r * 0.42, r * 0.22, r * 0.13); g.fill();
  },
  danseuse(g, m, o, now, U, reduceFx) {               // danseuse de boîte à musique : socle doré, tutu qui tourne sur lui-même
    const s = reduceFx ? 0 : now / 240;
    g.save(); g.translate(o.x, o.y);
    g.fillStyle = 'rgba(46,0,10,0.3)'; g.beginPath(); rond(g, 6, 9, 22); g.fill();
    g.fillStyle = '#c89a32'; g.beginPath(); rond(g, 0, 0, 21); g.fill();
    g.fillStyle = '#f2d27a'; g.beginPath(); g.arc(0, 0, 21, 3.4, 4.9); g.lineTo(0, 0); g.fill();
    g.rotate(s);
    g.fillStyle = '#f2a4c0'; g.beginPath(); etoile(g, 0, 0, 20, 15, 11, 0); g.fill();
    g.fillStyle = '#fcd6e4'; g.beginPath(); etoile(g, 0, 0, 14, 10, 9, 0.3); g.fill();
    g.strokeStyle = '#f0ccb0'; g.lineWidth = 3.5; g.lineCap = 'round'; g.beginPath(); g.moveTo(-17, -4); g.quadraticCurveTo(0, -12, 17, -4); g.stroke();
    g.fillStyle = '#e88aa8'; g.beginPath(); ov(g, 0, 0, 7, 5); g.fill();
    g.fillStyle = '#f0ccb0'; g.beginPath(); rond(g, 0, -1, 5); g.fill();
    g.fillStyle = '#6a4424'; g.beginPath(); rond(g, 0, -1, 3); g.fill();
    g.fillStyle = '#f6e27a'; g.beginPath(); rond(g, 0, -5, 1.6); g.fill();
    g.restore();
  },
  renne(g, m, o, now, U, reduceFx) {                  // renne mécanique : il trotte, clé de remontoir qui tourne dans le dos
    const p = reduceFx ? 0 : Math.sin(now / 80) * 4, k = reduceFx ? 0 : now / 160;
    g.save(); g.translate(o.x, o.y); g.rotate(o.a);
    g.fillStyle = 'rgba(46,0,10,0.3)'; g.beginPath(); ov(g, 6, 9, 34, 17); g.fill();
    g.fillStyle = '#3a2412'; for (const q of [[-14, -13, p], [-14, 9, -p], [12, -13, -p], [12, 9, p]]) g.fillRect(q[0] + q[2] - 3, q[1], 7, 4);
    g.fillStyle = '#9a6234'; g.beginPath(); ov(g, 0, 0, 24, 13); g.fill();
    g.fillStyle = '#c08a52'; g.beginPath(); ov(g, -2, 3, 16, 6); g.fill();
    g.fillStyle = '#fbf6ee'; g.beginPath(); rond(g, -24, 0, 4); g.fill();
    g.fillStyle = '#c8102e'; g.fillRect(14, -12, 5, 24); g.fillStyle = '#f2c850'; g.beginPath(); rond(g, 20, 0, 3.5); g.fill();
    g.strokeStyle = '#5a3a1e'; g.lineWidth = 3; g.lineCap = 'round'; g.beginPath();
    for (const s of [-1, 1]) { g.moveTo(24, s * 5); g.lineTo(18, s * 20); g.lineTo(10, s * 26); g.moveTo(19, s * 17); g.lineTo(26, s * 24); g.moveTo(15, s * 22); g.lineTo(14, s * 30); }
    g.stroke();
    g.fillStyle = '#a8703c'; g.beginPath(); rond(g, 26, 0, 10); g.fill();
    g.fillStyle = '#c89a62'; g.beginPath(); ov(g, 35, 0, 7, 6); g.fill();
    g.fillStyle = '#e0202a'; g.beginPath(); rond(g, 41, 0, 4.5); g.fill(); g.fillStyle = 'rgba(255,255,255,0.7)'; g.beginPath(); rond(g, 40, -1.5, 1.4); g.fill();
    g.save(); g.translate(-6, 0); g.rotate(k);
    g.strokeStyle = '#d8a83c'; g.lineWidth = 3; g.beginPath(); g.moveTo(-9, 0); g.lineTo(9, 0); g.stroke();
    g.lineWidth = 2; g.beginPath(); rond(g, -11, 0, 4); rond(g, 11, 0, 4); g.stroke();
    g.restore();
    g.restore();
  },
};

export default {
  id: 'noel', nom: 'Table de Noël', emoji: '🎄', sous: 'Nappe du réveillon · couronne autour du sapin, boules qui renvoient, guirlande lumineuse',
  w: 3700, h: 2580, surf: 'nappe', edge: 'chute', table: T, W: 100,
  pts: PTS,
  mobs: [
    { type: 'danseuse', cer: [650, 1320, 270], r: 22, per: 11 },                  // tourne autour de sa boîte à musique, mord sur la ligne droite du bord gauche
    { type: 'renne', seg: [[3080, 1320], [3330, 1320]], r: 26, per: 8 },          // trotte jusque sur la ligne droite du bord droit et revient
    { type: 'roulante', chemin: BOULE, r: 22, per: 9 },                           // roule à travers le coin du bas à gauche
  ],
  bumpers: ['boule'],
  zonesPhysiques: { neige: 'glisse', paillettes: 'frein' },
  make(H) {
    const c = H.c, n = c.n;
    const ici = (x, y) => { let b = 0, bd = Infinity; for (let i = 0; i < n; i++) { const dx = c.sx[i] - x, dy = c.sy[i] - y, q = dx * dx + dy * dy; if (q < bd) { bd = q; b = i; } } return b / n; };
    const pt = (x, y, lat) => H.at(ici(x, y), lat);
    const anneau = (deg, lat) => pt(SAPIN[0] + Math.cos(deg * D2R) * 330, SAPIN[1] + Math.sin(deg * D2R) * 330, lat);
    const deco = (x, y, t, a, v) => c.deco.push([x, y, t, a || 0, v || 0]);
    // turbos : deux sur la ligne droite du départ (un de chaque côté), un sur chaque ligne droite des bords
    H.boostAt(ici(1600, 2260), -0.3); H.boostAt(ici(2110, 2260), 0.3);
    H.boostAt(ici(330, 1580), -0.25); H.boostAt(ici(3370, 1060), -0.25);
    // bougies : à l'extérieur de la couronne, au bord des deux coins du bas
    for (const q of [[1520, 1226, 0.6], [2160, 1113, 0.6], [1250, 1970, -0.55], [2450, 1970, -0.55]]) { const p = pt(q[0], q[1], q[2]); H.rock(p.x, p.y, 20, 'bougie'); }
    // boules de Noël (elles renvoient) : à l'extérieur des lobes, côté bord de la table
    for (const q of [[630, 1989, -0.6], [3070, 1989, -0.6], [418, 738, -0.55], [3282, 738, -0.55]]) { const p = pt(q[0], q[1], q[2]); H.rock(p.x, p.y, 18, 'boule'); }
    // cadeaux : à l'extérieur des épingles du haut et du coin du bas à droite
    for (const q of [[1619, 364, -0.55], [2081, 364, -0.55], [2391, 2201, -0.6]]) { const p = pt(q[0], q[1], q[2]); H.rock(p.x, p.y, 26, 'cadeau'); }
    // la bûche, couchée au bord extérieur du bas de la couronne
    { const p = anneau(90, 0.62), tx = c.tx[p.i] * 62, ty = c.ty[p.i] * 62; H.wall(p.x - tx, p.y - ty, p.x + tx, p.y + ty, 24, 'buche'); }
    // guirlande lumineuse : elle descend du bord de la table entre les deux bras de la couronne, puis fait le tour du pied du sapin
    const GP = [];
    for (let y = 150; y < SAPIN[1] - 230; y += 32) GP.push([Math.round(SAPIN[0] + Math.sin(y / 60) * 36), y]);
    GP.push([SAPIN[0], SAPIN[1] - 212]);
    for (let k = 0; k < GP.length - 1; k++) H.wall(GP[k][0], GP[k][1], GP[k + 1][0], GP[k + 1][1], 6, 'guirlande');
    for (let k = 0; k < 30; k++) {
      const u0 = -Math.PI / 2 + k / 30 * TAU, u1 = -Math.PI / 2 + (k + 1) / 30 * TAU, r0 = 212 - (k % 2) * 9, r1 = 212 - ((k + 1) % 2) * 9;
      H.wall(SAPIN[0] + Math.cos(u0) * r0, SAPIN[1] + Math.sin(u0) * r0, SAPIN[0] + Math.cos(u1) * r1, SAPIN[1] + Math.sin(u1) * r1, 6, 'guirlande');
    }
    // neige artificielle (glisse) et paillettes (freinent), jamais sur toute la largeur
    H.zoneAt(ici(1617, 1459), -0.42, 74, 44, 'neige'); H.zoneAt(ici(910, 1834), 0.42, 66, 42, 'neige'); H.zoneAt(ici(2790, 805), 0.42, 66, 42, 'neige');
    H.zoneAt(ici(1309, 379), 0.45, 66, 40, 'paillettes'); H.zoneAt(ici(2391, 379), 0.45, 66, 40, 'paillettes'); H.zoneAt(ici(2391, 2201), 0.42, 62, 40, 'paillettes');
    // boîtes de bonus : sommets des deux lobes, sortie de la couronne
    for (const q of [[630, 650], [3070, 650], [2136, 1391]]) { const f = ici(q[0], q[1]); for (const lat of [-0.5, 0, 0.5]) { const p = H.at(f, lat); c.boxes.push([p.x, p.y]); } }
    // décor : le sapin, quatre couverts aux coins de la table, boîte à musique, chocolats, chandelier, cadeaux…
    deco(SAPIN[0], SAPIN[1], 'sapin');
    deco(560, 300, 'assiette', 0, 0); deco(3140, 300, 'assiette', Math.PI, 1); deco(560, 2300, 'assiette', 0, 2); deco(3140, 2300, 'assiette', Math.PI, 3);
    deco(880, 215, 'flute'); deco(2820, 215, 'flute'); deco(880, 2400, 'flute'); deco(2820, 2400, 'flute');
    deco(1010, 430, 'pliage', 0.5); deco(2690, 430, 'pliage', -0.5);
    deco(230, 2200, 'papillote', 1.2, 0); deco(3470, 2200, 'papillote', -1.2, 2); deco(230, 520, 'papillote', -1.1, 3); deco(3470, 520, 'papillote', 1.1, 5);
    deco(650, 1320, 'boite', 0); deco(3070, 1060, 'chocolats', 0.1); deco(3070, 1590, 'chandelier', Math.PI / 2); deco(1180, 1320, 'chandelier', Math.PI / 2);
    deco(1660, 1920, 'clementines', 0, 5); deco(2150, 1930, 'paquet', 0.1, 0); deco(2520, 1320, 'paquet', -0.3, 3);
    deco(1880, 1890, 'bonhomme', 0.3); deco(1960, 2000, 'bonhomme', -0.4);
    deco(640, 960, 'pomme', 0.6); deco(2640, 2380, 'pomme', -0.8); deco(1060, 2250, 'pomme', 2.2);
    deco(640, 1690, 'houx', 0.4); deco(3545, 1320, 'houx', 2); deco(155, 1320, 'houx', -1);
    deco(820, 430, 'verre'); deco(2880, 430, 'verre'); deco(850, 2190, 'verre'); deco(2850, 2190, 'verre');
    deco(540, 1440, 'sucreorge', 0.3); deco(2960, 1320, 'sucreorge', -0.5);
    deco(1170, 1090, 'globe'); deco(1170, 1560, 'biscuits'); deco(2530, 1080, 'carafe'); deco(2520, 1545, 'noix', 0.6);
    deco(1780, 2075, 'bolduc', 0.15); deco(1700, 150, 'bolduc', -0.1); deco(2290, 1760, 'bolduc', 1.1); deco(1850, 2440, 'bolduc', 0);
    deco(650, 1160, 'carte', -0.08); deco(1020, 1480, 'clementines', 0, 3);
  },
  dessin: {
    sol, plateau, piste, bord,
    decor: DECOR, objets: OBJETS, murs: MURS, zones: ZONES, mobiles: MOBILES,
    hors: '#24140c', traces: 'rgba(6,28,12,0.34)', poussiere: '244,214,140',
  },
};
