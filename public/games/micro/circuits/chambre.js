// Circuit « chambre » de Micro Machines — définition PARTAGÉE serveur / client (géométrie, obstacles, zones, décor).
// Format : voir l'en-tête de ../shared.js ; dessins propres au circuit (propriété `dessin`) : voir ../rendu.js.

const TAU = Math.PI * 2, D2R = Math.PI / 180;
// tortue : départ (x, y) cap h (rad, 0 = vers la droite, y vers le bas) ; ['X', x] / ['Y', y] tout droit jusqu'à cette
// abscisse / ordonnée, ['A', rayon, degrés] arc (> 0 : à droite) → points de contrôle tous les ~80 u (le dernier = le départ)
function trace(x, y, h, cmds) {
  const P = [[x, y]];
  for (const c of cmds) {
    if (c[0] !== 'A') {
      const len = c[0] === 'Y' ? (c[1] - y) / Math.sin(h) : (c[1] - x) / Math.cos(h), k = Math.max(1, Math.round(len / 80));
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
// la pièce (1 u ≈ 1 mm) : parquet de 3,72 × 2,44 m, lit contre le mur du haut, coffre à jouets dans le coin du bas à droite.
// Piste en dalles de mousse emboîtées, en tête d'ours : longue ligne droite du bas (départ, turbos), grande courbe, côté droit
// (turbo), oreille droite en goutte (45° à droite, 180° à gauche, 45° à droite), oméga autour du pied du lit, oreille gauche,
// descente du côté gauche par les deux passages à niveau du train électrique, virage du xylophone vers la ligne droite
const T = { x0: 40, y0: 40, x1: 3760, y1: 2480, r: 8 };
const PTS = trace(1380, 2190, 0, [
  ['X', 3030], ['A', 430, -90], ['Y', 1000],                                                // ligne droite du tapis, grande courbe, côté droit
  ['A', 220, 45], ['A', 300, -180], ['A', 220, 45],                                         // oreille droite
  ['X', 2630], ['A', 250, -90], ['Y', 1160], ['A', 500, 180], ['Y', 735], ['A', 250, -90],  // oméga autour du pied du lit
  ['A', 220, 45], ['A', 300, -180], ['A', 220, 45],                                         // oreille gauche
  ['Y', 1920], ['A', 270, -90], ['X', 1380],                                                // passages à niveau, virage, retour
]);
// train électrique : voie en « stade » (deux droites, deux demi-cercles) à cheval sur le côté gauche de la piste (x = PN),
// qu'elle coupe à angle droit en deux passages à niveau ; locomotive + 2 wagons = 3 mobiles sur le même chemin (dec décalés)
const PN = 615, VOIE = { x0: 395, x1: 835, y: 1460, r: 200 }, PASSAGES = [VOIE.y - VOIE.r, VOIE.y + VOIE.r];
function voie(pas) {                                  // boucle fermée (sens horaire à l'écran), un point tous les ~pas u
  const P = [], R0 = VOIE.r, L0 = VOIE.x1 - VOIE.x0, nS = Math.max(1, Math.round(L0 / pas)), nA = Math.max(4, Math.round(Math.PI * R0 / pas));
  for (let k = 0; k < nS; k++) P.push([VOIE.x0 + L0 * k / nS, VOIE.y - R0]);
  for (let k = 0; k < nA; k++) { const u = -Math.PI / 2 + Math.PI * k / nA; P.push([VOIE.x1 + Math.cos(u) * R0, VOIE.y + Math.sin(u) * R0]); }
  for (let k = 0; k < nS; k++) P.push([VOIE.x1 - L0 * k / nS, VOIE.y + R0]);
  for (let k = 0; k < nA; k++) { const u = Math.PI / 2 + Math.PI * k / nA; P.push([VOIE.x0 + Math.cos(u) * R0, VOIE.y + Math.sin(u) * R0]); }
  return P;
}
const CHEMIN = voie(40).map(p => [Math.round(p[0]), Math.round(p[1])]);
const RAILS = voie(14), RN = RAILS.map((p, k) => {    // voie dessinée : points serrés + normales
  const a = RAILS[(k - 1 + RAILS.length) % RAILS.length], b = RAILS[(k + 1) % RAILS.length], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  return [-(b[1] - a[1]) / l, (b[0] - a[0]) / l];
});
const OREILLES = [[3312, 632], [762, 633]];           // centres des deux oreilles (ours en peluche, tambour)

// ── utilitaires de dessin ──
const rond = (g, x, y, r) => { g.moveTo(x + r, y); g.arc(x, y, r, 0, TAU); };
const ovale = (g, x, y, rx, ry) => { g.save(); g.translate(x, y); g.scale(rx, ry); g.moveTo(1, 0); g.arc(0, 0, 1, 0, TAU); g.restore(); };
function rrect(g, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function ombre(g, dx, dy, forme) {                    // ombre douce en deux couches (lampe en haut à gauche) ; forme(g) = silhouette
  g.save(); g.fillStyle = 'rgba(70,38,12,0.1)'; g.translate(dx * 1.8, dy * 1.8); g.beginPath(); forme(g); g.fill(); g.restore();
  g.save(); g.fillStyle = 'rgba(70,38,12,0.2)'; g.translate(dx, dy); g.beginPath(); forme(g); g.fill(); g.restore();
}
function ombreRot(g, x, y, a, dx, dy, forme) {        // la même pour une forme tournée de a autour de (x, y) (l'ombre ne tourne pas)
  g.save(); g.fillStyle = 'rgba(70,38,12,0.1)'; g.translate(x + dx * 1.8, y + dy * 1.8); g.rotate(a); g.beginPath(); forme(g); g.fill(); g.restore();
  g.save(); g.fillStyle = 'rgba(70,38,12,0.2)'; g.translate(x + dx, y + dy); g.rotate(a); g.beginPath(); forme(g); g.fill(); g.restore();
}
function etoile(g, x, y, r, a) { for (let k = 0; k < 10; k++) { const u = a + k * Math.PI / 5, q = k % 2 ? r * 0.45 : r; if (k) g.lineTo(x + Math.cos(u) * q, y + Math.sin(u) * q); else g.moveTo(x + Math.cos(u) * q, y + Math.sin(u) * q); } g.closePath(); }
// couleurs vives des jouets [base, clair, foncé] et des dalles de mousse (pastel : les voitures restent lisibles dessus)
const JOUETS = [['#e8412f', '#ff7666', '#a82a1d'], ['#2f7fd8', '#62a2ec', '#1d5aa3'], ['#f4c21f', '#ffdc62', '#c09010'], ['#33a852', '#62c97d', '#21793a'], ['#f07f1d', '#ffa552', '#b65a0c']];
const MOUSSE = ['#f1867b', '#78b4ea', '#f5d667', '#82d19c'];
const LETTRES = 'ABCDEFGH';
function cubeABC(g, x, y, s, a, k) {                  // cube ABC en bois : arêtes claires, face peinte, lettre
  ombreRot(g, x, y, a, 6, 9, q => rrect(q, -s, -s, 2 * s, 2 * s, s * 0.2));
  g.save(); g.translate(x, y); g.rotate(a);
  g.fillStyle = '#d9ad6c'; g.beginPath(); rrect(g, -s, -s, 2 * s, 2 * s, s * 0.2); g.fill();
  g.fillStyle = '#f5d9a6'; g.beginPath(); rrect(g, -s + 2, -s + 2, 2 * s - 6, 2 * s - 6, s * 0.16); g.fill();
  const C = JOUETS[k % 5];
  g.fillStyle = C[0]; g.beginPath(); rrect(g, -s * 0.72, -s * 0.72, s * 1.44, s * 1.44, s * 0.16); g.fill();
  g.fillStyle = C[1]; g.fillRect(-s * 0.6, -s * 0.66, s * 1.2, s * 0.16);
  g.fillStyle = '#ffffff'; g.font = 'bold ' + Math.round(s * 1.15) + 'px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(LETTRES[k % 8], 0, s * 0.08);
  g.restore();
}
function brique(g, x, y, a, L, l, k, ombrer) {        // brique à tenons (L × l, tenons tous les 16 u), vue de dessus
  if (ombrer) ombreRot(g, x, y, a, 5, 8, q => q.rect(-L / 2, -l / 2, L, l));
  const C = JOUETS[k % 5], nx = Math.max(1, Math.round(L / 16)), ny = Math.max(1, Math.round(l / 16));
  g.save(); g.translate(x, y); g.rotate(a);
  g.fillStyle = C[2]; g.fillRect(-L / 2, -l / 2, L, l);
  g.fillStyle = C[0]; g.fillRect(-L / 2, -l / 2, L - 3, l - 3);
  g.fillStyle = C[2]; g.beginPath(); for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) rond(g, -L / 2 + (i + 0.5) * L / nx + 1, -l / 2 + (j + 0.5) * l / ny + 1.5, 5); g.fill();
  g.fillStyle = C[1]; g.beginPath(); for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) rond(g, -L / 2 + (i + 0.5) * L / nx - 1, -l / 2 + (j + 0.5) * l / ny - 1.5, 4.6); g.fill();
  g.restore();
}
function doudou(g, x, y, s, a) {                      // petit lapin en peluche (vu de dessus, tête vers -y)
  g.save(); g.translate(x, y); g.rotate(a); g.scale(s, s);
  g.fillStyle = 'rgba(70,38,12,0.2)'; g.beginPath(); ovale(g, 6, 2, 40, 62); g.fill();
  g.fillStyle = '#ece4f4'; g.beginPath(); ovale(g, -16, -64, 10, 30); ovale(g, 16, -64, 10, 30); ovale(g, 0, 18, 34, 40); rond(g, 0, -24, 28); g.fill();
  g.fillStyle = '#f6b8cc'; g.beginPath(); ovale(g, -16, -64, 5, 22); ovale(g, 16, -64, 5, 22); ovale(g, 0, 22, 18, 22); g.fill();
  g.fillStyle = '#3a2a3a'; g.beginPath(); rond(g, -10, -27, 3.5); rond(g, 10, -27, 3.5); g.fill();
  g.fillStyle = '#f08aa8'; g.beginPath(); ovale(g, 0, -16, 5, 3.5); g.fill();
  g.restore();
}
function livre(g, x, y, a, k) {                       // livre d'images ouvert
  ombreRot(g, x, y, a, 5, 8, q => q.rect(-82, -57, 164, 114));
  g.save(); g.translate(x, y); g.rotate(a);
  g.fillStyle = JOUETS[k % 5][0]; g.fillRect(-82, -57, 164, 114);
  g.fillStyle = '#fffaf0'; g.fillRect(-76, -52, 73, 104); g.fillRect(3, -52, 73, 104);
  g.fillStyle = 'rgba(0,0,0,0.13)'; g.fillRect(-5, -52, 10, 104);
  g.fillStyle = '#f4c21f'; g.beginPath(); rond(g, -40, -18, 16); g.fill();
  g.fillStyle = '#33a852'; g.fillRect(-70, 22, 62, 24);
  g.fillStyle = '#2f7fd8'; g.fillRect(22, -10, 36, 30); g.fillStyle = '#e8412f'; g.beginPath(); g.moveTo(16, -10); g.lineTo(40, -34); g.lineTo(64, -10); g.closePath(); g.fill();
  g.strokeStyle = 'rgba(60,60,80,0.4)'; g.lineWidth = 2; g.beginPath(); for (let i = 0; i < 3; i++) { g.moveTo(14, 32 + i * 7); g.lineTo(66, 32 + i * 7); } g.stroke();
  g.restore();
}
function crayon(g, x, y, a, col, L) {                 // crayon de couleur : corps peint, bois taillé, mine
  ombreRot(g, x, y, a, 3, 5, q => q.rect(-L / 2, -6, L, 12));
  g.save(); g.translate(x, y); g.rotate(a);
  g.fillStyle = col; g.fillRect(-L / 2, -6, L - 22, 12);
  g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(-L / 2, -4, L - 22, 3);
  g.fillStyle = '#f1cf98'; g.beginPath(); g.moveTo(L / 2 - 22, -6); g.lineTo(L / 2 - 2, -1.5); g.lineTo(L / 2 - 2, 1.5); g.lineTo(L / 2 - 22, 6); g.closePath(); g.fill();
  g.fillStyle = col; g.beginPath(); g.moveTo(L / 2 - 8, -2.5); g.lineTo(L / 2, 0); g.lineTo(L / 2 - 8, 2.5); g.closePath(); g.fill();
  g.restore();
}

// ── sol : le haut des murs de la chambre (peinture crème), fenêtre dans le mur du haut ──
function sol(g, c) {
  g.fillStyle = '#efe2cb'; g.fillRect(0, 0, c.w, c.h);
  g.fillStyle = '#cdb38c'; g.fillRect(0, 0, c.w, 5); g.fillRect(0, 0, 5, c.h); g.fillRect(c.w - 5, 0, 5, c.h); g.fillRect(0, c.h - 5, c.w, 5);
  g.fillStyle = '#fbf8f1'; g.fillRect(2990, 4, 600, 34); g.fillStyle = '#a7d5f2'; g.fillRect(3002, 10, 576, 22);
  g.fillStyle = 'rgba(255,255,255,0.65)'; g.fillRect(3020, 13, 240, 5); g.fillStyle = '#fbf8f1'; g.fillRect(3286, 8, 8, 28);
  g.fillStyle = '#f4b6c8'; g.fillRect(2950, 2, 44, 38); g.fillRect(3586, 2, 44, 38);                // rideaux roses
}
// ── parquet de chêne blond, tapis « ciel de nuit » au milieu, tapis ronds dans les oreilles, voie du train ──
const PLANCHES = ['#d09b5d', '#c68e51', '#d8a86b', '#be8749', '#cb955a'];
function plateau(g, c, R, U) {
  const t = c.table, HL = 92, lames = [];
  for (let y = t.y0; y < t.y1; y += HL) { let x = t.x0 - R() * 700; while (x < t.x1) { const l = 520 + R() * 560; lames.push(x, y, l, (R() * 5) | 0); x += l; } }
  for (let p = 0; p < 5; p++) { g.fillStyle = PLANCHES[p]; g.beginPath(); for (let k = 0; k < lames.length; k += 4) if (lames[k + 3] === p) g.rect(lames[k], lames[k + 1], lames[k + 2], HL); g.fill(); }
  g.strokeStyle = 'rgba(120,64,22,0.22)'; g.lineWidth = 2; g.beginPath();            // veinage
  for (let k = 0; k < lames.length; k += 4) {
    const x = lames[k], y = lames[k + 1], l = lames[k + 2];
    for (let v = 0; v < 3; v++) { const yy = y + 14 + v * 26 + R() * 10, w = (R() - 0.5) * 14; g.moveTo(x + 10, yy); g.bezierCurveTo(x + l * 0.3, yy + w, x + l * 0.65, yy - w, x + l - 10, yy + w * 0.4); }
  }
  g.stroke();
  g.fillStyle = 'rgba(120,64,22,0.3)'; g.beginPath();                                 // nœuds
  for (let k = 0; k < lames.length; k += 4) if (R() < 0.18) ovale(g, lames[k] + 60 + R() * (lames[k + 2] - 120), lames[k + 1] + 20 + R() * 52, 9 + R() * 8, 4 + R() * 3);
  g.fill();
  g.strokeStyle = 'rgba(90,44,12,0.45)'; g.lineWidth = 2.5; g.beginPath();             // joints des lames
  for (let y = t.y0; y < t.y1; y += HL) { g.moveTo(t.x0, y); g.lineTo(t.x1, y); }
  for (let k = 0; k < lames.length; k += 4) { g.moveTo(lames[k], lames[k + 1]); g.lineTo(lames[k], lames[k + 1] + HL); }
  g.stroke();
  g.strokeStyle = 'rgba(255,230,190,0.18)'; g.lineWidth = 2; g.beginPath(); for (let y = t.y0 + 3; y < t.y1; y += HL) { g.moveTo(t.x0, y); g.lineTo(t.x1, y); } g.stroke();
  // soleil de la fenêtre sur le parquet (en haut à droite), lumière chaude de la lampe en haut à gauche
  g.fillStyle = 'rgba(255,246,214,0.13)'; g.beginPath(); g.moveTo(3000, 40); g.lineTo(3580, 40); g.lineTo(3740, 640); g.lineTo(3160, 640); g.closePath(); g.fill();
  g.strokeStyle = 'rgba(160,100,40,0.1)'; g.lineWidth = 14; g.beginPath(); g.moveTo(3290, 40); g.lineTo(3450, 640); g.moveTo(3080, 340); g.lineTo(3660, 340); g.stroke();
  let gr = g.createLinearGradient(t.x0, t.y0, t.x1, t.y1); gr.addColorStop(0, 'rgba(255,236,190,0.12)'); gr.addColorStop(0.55, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(60,30,8,0.12)');
  g.fillStyle = gr; g.fillRect(t.x0, t.y0, t.x1 - t.x0, t.y1 - t.y0);
  // tapis « ciel de nuit » : bleu nuit, galon crème piqué, franges, étoiles, lune, nuages
  const X0 = 1100, Y0 = 1345, X1 = 3160, Y1 = 2390;
  g.fillStyle = 'rgba(40,20,5,0.25)'; g.beginPath(); rrect(g, X0 + 6, Y0 + 9, X1 - X0, Y1 - Y0, 46); g.fill();
  g.strokeStyle = '#f3ead6'; g.lineWidth = 3; g.beginPath(); for (let y = Y0 + 30; y < Y1 - 20; y += 13) { g.moveTo(X0 - 22, y); g.lineTo(X0, y); g.moveTo(X1, y); g.lineTo(X1 + 22, y); } g.stroke();
  gr = g.createLinearGradient(0, Y0, 0, Y1); gr.addColorStop(0, '#2e4684'); gr.addColorStop(1, '#22346a');
  g.fillStyle = gr; g.beginPath(); rrect(g, X0, Y0, X1 - X0, Y1 - Y0, 46); g.fill();
  g.strokeStyle = '#efe3c8'; g.lineWidth = 26; g.beginPath(); rrect(g, X0 + 24, Y0 + 24, X1 - X0 - 48, Y1 - Y0 - 48, 30); g.stroke();
  g.strokeStyle = '#c94f6d'; g.lineWidth = 2.5; g.setLineDash([9, 7]); g.beginPath(); rrect(g, X0 + 24, Y0 + 24, X1 - X0 - 48, Y1 - Y0 - 48, 30); g.stroke(); g.setLineDash([]);
  g.fillStyle = 'rgba(255,255,255,0.05)'; g.beginPath(); for (let k = 0; k < 900; k++) g.rect(X0 + 40 + R() * (X1 - X0 - 80), Y0 + 40 + R() * (Y1 - Y0 - 80), 3, 3); g.fill();
  g.fillStyle = '#ffd95a'; g.beginPath(); for (let k = 0; k < 46; k++) etoile(g, X0 + 70 + R() * (X1 - X0 - 140), Y0 + 70 + R() * (Y1 - Y0 - 140), 9 + R() * 12, R() * 2); g.fill();
  g.fillStyle = '#fff3c4'; g.beginPath(); for (let k = 0; k < 90; k++) rond(g, X0 + 60 + R() * (X1 - X0 - 120), Y0 + 60 + R() * (Y1 - Y0 - 120), 2 + R() * 2); g.fill();
  g.save(); g.beginPath(); rond(g, 2660, 1880, 92); g.clip(); g.fillStyle = '#ffe58a'; g.fill(); g.fillStyle = '#2a3f7a'; g.beginPath(); rond(g, 2706, 1850, 82); g.fill(); g.restore();
  g.fillStyle = 'rgba(255,255,255,0.85)'; g.beginPath();
  for (const n of [[1300, 1880], [2050, 2130], [2900, 1520], [1700, 1500]]) { rond(g, n[0], n[1], 34); rond(g, n[0] + 36, n[1] - 16, 42); rond(g, n[0] + 76, n[1], 32); g.rect(n[0], n[1], 76, 30); }
  g.fill();
  // tapis ronds des oreilles : moumoute rose sous l'ours, soleil jaune sous le tambour
  const e1 = OREILLES[0], e2 = OREILLES[1];
  g.fillStyle = 'rgba(40,20,5,0.22)'; g.beginPath(); rond(g, e1[0] + 6, e1[1] + 9, 172); rond(g, e2[0] + 6, e2[1] + 9, 168); g.fill();
  g.fillStyle = '#f6c3d3'; g.beginPath(); rond(g, e1[0], e1[1], 172); g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 3; g.lineCap = 'round'; g.beginPath();
  for (let k = 0; k < 220; k++) { const u = R() * TAU, q = 30 + Math.sqrt(R()) * 140, x = e1[0] + Math.cos(u) * q, y = e1[1] + Math.sin(u) * q, v = R() * TAU; g.moveTo(x, y); g.lineTo(x + Math.cos(v) * 9, y + Math.sin(v) * 9); }
  g.stroke();
  g.strokeStyle = '#f5b324'; g.lineWidth = 16; g.beginPath(); for (let k = 0; k < 16; k++) { const u = k * TAU / 16; g.moveTo(e2[0] + Math.cos(u) * 128, e2[1] + Math.sin(u) * 128); g.lineTo(e2[0] + Math.cos(u) * 166, e2[1] + Math.sin(u) * 166); } g.stroke();
  g.fillStyle = '#ffd34f'; g.beginPath(); rond(g, e2[0], e2[1], 134); g.fill();
  g.lineCap = 'butt';
  voieFerree(g);
  // ombre au pied des murs
  for (const b of [[t.x0, t.y0, t.x0, t.y0 + 60, t.x0, t.y0, t.x1 - t.x0, 60], [t.x0, t.y1, t.x0, t.y1 - 60, t.x0, t.y1 - 60, t.x1 - t.x0, 60],
    [t.x0, t.y0, t.x0 + 60, t.y0, t.x0, t.y0, 60, t.y1 - t.y0], [t.x1, t.y0, t.x1 - 60, t.y0, t.x1 - 60, t.y0, 60, t.y1 - t.y0]]) {
    gr = g.createLinearGradient(b[0], b[1], b[2], b[3]); gr.addColorStop(0, 'rgba(70,38,12,0.22)'); gr.addColorStop(1, 'rgba(70,38,12,0)'); g.fillStyle = gr; g.fillRect(b[4], b[5], b[6], b[7]);
  }
}
function voieFerree(g) {                              // voie du train électrique : socle gris, traverses, deux rails + rail central
  const n = RAILS.length, P = RAILS, N = RN;
  const boucle = (o) => { g.beginPath(); for (let k = 0; k <= n; k++) { const j = k % n, x = P[j][0] + N[j][0] * o, y = P[j][1] + N[j][1] * o; if (k) g.lineTo(x, y); else g.moveTo(x, y); } };
  g.lineJoin = 'round';
  g.save(); g.translate(4, 6); boucle(0); g.strokeStyle = 'rgba(60,30,8,0.22)'; g.lineWidth = 56; g.stroke(); g.restore();
  boucle(0); g.strokeStyle = '#8f9397'; g.lineWidth = 50; g.stroke();
  boucle(0); g.strokeStyle = '#a6aaae'; g.lineWidth = 42; g.stroke();
  g.strokeStyle = '#6e4a2c'; g.lineWidth = 8; g.beginPath();
  for (let k = 0; k < n; k += 2) { const p = P[k], q = N[k]; g.moveTo(p[0] - q[0] * 22, p[1] - q[1] * 22); g.lineTo(p[0] + q[0] * 22, p[1] + q[1] * 22); }
  g.stroke();
  for (const o of [-13, 13]) { boucle(o); g.strokeStyle = '#8d959e'; g.lineWidth = 5; g.stroke(); boucle(o - 1); g.strokeStyle = '#e4e9ed'; g.lineWidth = 1.6; g.stroke(); }
  g.setLineDash([4, 10]); boucle(0); g.strokeStyle = '#d6dbe0'; g.lineWidth = 3; g.stroke(); g.setLineDash([]);
}
// ── piste : dalles de mousse emboîtables (damier de 4 pastels, tenons de puzzle), bordures crème à créneaux ──
function piste(g, c, R, U) {
  const W = c.W, n = c.n, nb = Math.max(8, Math.round(c.L / 104 / 4) * 4), B = [];
  for (let t = 0; t <= nb; t++) B.push(Math.round(t * n / nb));
  const P = (i, o) => { const j = ((i % n) + n) % n; return [c.sx[j] + c.nx[j] * o, c.sy[j] + c.ny[j] * o]; };
  const col = (t, s) => (t + 2 * s) % 4;
  U.centerStroke(g, c, 2 * W + 30, 'rgba(70,38,12,0.12)');                 // les dalles ont de l'épaisseur
  U.centerStroke(g, c, 2 * W + 12, 'rgba(70,38,12,0.22)');
  const dalle = (t, s) => {
    const a = B[t], b = B[t + 1], o0 = s ? 0 : -W, o1 = s ? W : 0;
    let p = P(a, o0); g.moveTo(p[0], p[1]);
    for (let i = a + 1; i <= b; i++) { p = P(i, o0); g.lineTo(p[0], p[1]); }
    for (let i = b; i >= a; i--) { p = P(i, o1); g.lineTo(p[0], p[1]); }
    g.closePath();
  };
  for (let k = 0; k < 4; k++) { g.fillStyle = MOUSSE[k]; g.beginPath(); for (let t = 0; t < nb; t++) for (let s = 0; s < 2; s++) if (col(t, s) === k) dalle(t, s); g.fill(); }
  // grain de la mousse
  g.fillStyle = 'rgba(255,255,255,0.2)'; g.beginPath(); for (let i = 0; i < n; i += 2) for (let k = 0; k < 3; k++) { const p = P(i, (R() * 2 - 1) * (W - 10)); g.rect(p[0], p[1], 2.5, 2.5); } g.fill();
  g.fillStyle = 'rgba(90,40,20,0.08)'; g.beginPath(); for (let i = 1; i < n; i += 2) for (let k = 0; k < 3; k++) { const p = P(i, (R() * 2 - 1) * (W - 10)); g.rect(p[0], p[1], 2.5, 2.5); } g.fill();
  // tenons de puzzle : sur chaque joint en travers (un par dalle) et sur le joint du milieu (un par rang, alterné)
  const T2 = [];                                     // [cx, cy, couleur, angle du côté attaché]
  for (let t = 0; t < nb; t++) for (let s = 0; s < 2; s++) {
    const o = s ? W / 2 : -W / 2, j = B[t], av = (t + s) % 2, i = av ? j + 1 : j - 1, p = P(i, o), q = P(j, o);
    T2.push(p[0], p[1], col(av ? (t + nb - 1) % nb : t, s), Math.atan2(q[1] - p[1], q[0] - p[0]));
  }
  for (let t = 0; t < nb; t++) {
    const s = t % 2, m = Math.round((B[t] + B[t + 1]) / 2), p = P(m, s ? -10 : 10), q = P(m, 0);
    T2.push(p[0], p[1], col(t, s), Math.atan2(q[1] - p[1], q[0] - p[0]));
  }
  for (let k = 0; k < 4; k++) { g.fillStyle = MOUSSE[k]; g.beginPath(); for (let i = 0; i < T2.length; i += 4) if (T2[i + 2] === k) rond(g, T2[i], T2[i + 1], 11.5); g.fill(); }
  g.strokeStyle = 'rgba(70,40,25,0.32)'; g.lineWidth = 2; g.beginPath();
  for (let t = 0; t < nb; t++) {                     // joints en travers, interrompus sous les tenons
    const a = P(B[t], -W), b = P(B[t], -W / 2 - 7), e = P(B[t], -W / 2 + 7), f = P(B[t], W / 2 - 7), h = P(B[t], W / 2 + 7), k = P(B[t], W);
    g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.moveTo(e[0], e[1]); g.lineTo(f[0], f[1]); g.moveTo(h[0], h[1]); g.lineTo(k[0], k[1]);
  }
  for (let i = 0; i < T2.length; i += 4) { const a = T2[i + 3]; g.moveTo(T2[i] + Math.cos(a + 0.62) * 11.5, T2[i + 1] + Math.sin(a + 0.62) * 11.5); g.arc(T2[i], T2[i + 1], 11.5, a + 0.62, a + TAU - 0.62); }
  g.stroke();
  g.beginPath();                                      // joint du milieu, interrompu sous ses tenons
  for (let t = 0; t < nb; t++) {
    const m = Math.round((B[t] + B[t + 1]) / 2); let p = P(B[t], 0); g.moveTo(p[0], p[1]);
    for (let i = B[t] + 1; i <= m - 1; i++) { p = P(i, 0); g.lineTo(p[0], p[1]); }
    p = P(m + 1, 0); g.moveTo(p[0], p[1]); for (let i = m + 2; i <= B[t + 1]; i++) { p = P(i, 0); g.lineTo(p[0], p[1]); }
  }
  g.stroke();
  g.strokeStyle = 'rgba(255,255,255,0.3)'; g.lineWidth = 2; for (const o of [-W / 2, W / 2]) { U.trackPath(g, c, o - 30); g.stroke(); }   // reflet doux
  // bordures crème à créneaux
  for (const sd of [-1, 1]) {
    g.strokeStyle = '#fcf3e1'; g.lineWidth = 12; U.trackPath(g, c, (W - 6) * sd); g.stroke();
    g.setLineDash([10, 12]); g.lineWidth = 8; U.trackPath(g, c, (W - 15) * sd); g.stroke(); g.setLineDash([]);
    g.strokeStyle = 'rgba(70,40,25,0.42)'; g.lineWidth = 2; U.trackPath(g, c, W * sd); g.stroke();
  }
  for (const z of c.zones) if (z[4] === 'boost') {   // pastilles bleu nuit sous les flèches turbo (lisibles sur le jaune)
    g.save(); g.translate(z[0], z[1]); g.rotate(z[5]); g.fillStyle = 'rgba(36,52,104,0.9)'; g.beginPath(); rrect(g, -52, -35, 104, 70, 16); g.fill();
    g.strokeStyle = '#ffffff'; g.lineWidth = 2.5; g.stroke(); g.restore();
  }
  // passages à niveau : plaque de caoutchouc striée, rails encastrés
  for (const y of PASSAGES) {
    const x0 = PN - W - 2, L0 = 2 * W + 4;
    g.fillStyle = 'rgba(60,30,8,0.25)'; g.fillRect(x0 + 3, y - 22, L0, 52);
    g.fillStyle = '#5f5a56'; g.fillRect(x0, y - 27, L0, 54);
    g.fillStyle = '#f4c21f'; for (let x = x0; x < x0 + L0 - 6; x += 24) { g.fillRect(x, y - 27, 12, 5); g.fillRect(x + 12, y + 22, 12, 5); }
    g.strokeStyle = 'rgba(255,255,255,0.1)'; g.lineWidth = 2; g.beginPath(); for (let x = x0 + 6; x < x0 + L0; x += 9) { g.moveTo(x, y - 20); g.lineTo(x, y + 20); } g.stroke();
    for (const e of [-13, 13]) { g.strokeStyle = '#a7afb7'; g.lineWidth = 5; g.beginPath(); g.moveTo(x0, y + e); g.lineTo(x0 + L0, y + e); g.stroke(); g.strokeStyle = '#eef2f5'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(x0, y + e - 1); g.lineTo(x0 + L0, y + e - 1); g.stroke(); }
    g.setLineDash([4, 10]); g.strokeStyle = '#d6dbe0'; g.lineWidth = 3; g.beginPath(); g.moveTo(x0, y); g.lineTo(x0 + L0, y); g.stroke(); g.setLineDash([]);
  }
}
// ── plinthe blanche tout autour de la chambre ──
function bord(g, c) {
  const t = c.table, e = 14, L = t.x1 - t.x0, Hh = t.y1 - t.y0;
  g.fillStyle = 'rgba(70,38,12,0.2)'; g.fillRect(t.x0 + e, t.y0 + e, L - 2 * e, 6); g.fillRect(t.x0 + e, t.y0 + e, 6, Hh - 2 * e);
  g.fillStyle = '#fbf7ee'; g.fillRect(t.x0, t.y0, L, e); g.fillRect(t.x0, t.y1 - e, L, e); g.fillRect(t.x0, t.y0, e, Hh); g.fillRect(t.x1 - e, t.y0, e, Hh);
  g.strokeStyle = 'rgba(150,120,90,0.55)'; g.lineWidth = 2; g.beginPath(); g.rect(t.x0 + e, t.y0 + e, L - 2 * e, Hh - 2 * e); g.rect(t.x0 + 4, t.y0 + 4, L - 8, Hh - 8); g.stroke();
}
// panneaux des passages à niveau (croix de Saint-André, feux éteints : la locomotive les allume en passant)
const FEUX = [];
for (const y of PASSAGES) for (const s of [-1, 1]) FEUX.push([PN + s * 152, y - s * 60]);
function final(g) {
  for (const f of FEUX) {
    const x = f[0], y = f[1];
    g.fillStyle = 'rgba(70,38,12,0.22)'; g.beginPath(); for (const a of [0.6, -0.6]) { g.save(); g.translate(x + 7, y + 10); g.rotate(a); g.rect(-25, -6, 50, 12); g.restore(); } rond(g, x + 7, y + 26, 12); g.fill();
    g.fillStyle = '#2f3237'; g.beginPath(); rrect(g, x - 20, y + 9, 40, 16, 7); g.fill();
    g.fillStyle = '#5a1712'; g.beginPath(); rond(g, x - 10, y + 17, 5); rond(g, x + 10, y + 17, 5); g.fill();
    for (const a of [0.6, -0.6]) { g.save(); g.translate(x, y); g.rotate(a); g.fillStyle = '#d8352a'; g.fillRect(-25, -6, 50, 12); g.fillStyle = '#ffffff'; g.fillRect(-22, -3, 44, 6); g.restore(); }
    g.fillStyle = '#3b3f45'; g.beginPath(); rond(g, x, y, 4); g.fill();
  }
}

// ── décor de la chambre (dessiné autour de l'origine ; d = [x, y, type, variante]) ──
const DECOR = {
  lit(g, d, R) {                                       // pied du lit : cadre en bois, couette étoilée, oreiller, doudou, livre
    const X = 300, Y = 630, yC = -330;
    ombre(g, 12, 16, q => rrect(q, -X, -Y, 2 * X, 2 * Y, 24));
    let gr = g.createLinearGradient(-X, 0, X, 0); gr.addColorStop(0, '#a8682f'); gr.addColorStop(0.45, '#c98b4f'); gr.addColorStop(1, '#9e602b');
    g.fillStyle = gr; g.beginPath(); rrect(g, -X, -Y, 2 * X, 2 * Y, 24); g.fill();
    g.fillStyle = '#f7f1e6'; g.beginPath(); rrect(g, -X + 18, -Y + 40, 2 * X - 36, 2 * Y - 86, 12); g.fill();
    g.fillStyle = '#8c5225'; g.fillRect(-X, -Y, 2 * X, 38); g.fillRect(-X, Y - 46, 2 * X, 46);
    g.fillStyle = 'rgba(255,220,170,0.35)'; g.fillRect(-X + 40, -Y + 8, 2 * X - 80, 6); g.fillRect(-X + 40, Y - 38, 2 * X - 80, 6);
    for (const p of [[-X + 22, -Y + 20], [X - 22, -Y + 20], [-X + 22, Y - 24], [X - 22, Y - 24]]) {
      const gq = g.createRadialGradient(p[0] - 8, p[1] - 8, 2, p[0], p[1], 25); gq.addColorStop(0, '#e6ae70'); gq.addColorStop(1, '#7a4419');
      g.fillStyle = gq; g.beginPath(); rond(g, p[0], p[1], 25); g.fill();
    }
    ombre(g, 5, 8, q => rrect(q, -215, -560, 430, 165, 60));
    gr = g.createLinearGradient(0, -560, 0, -395); gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, '#e4ddef');
    g.fillStyle = gr; g.beginPath(); rrect(g, -215, -560, 430, 165, 60); g.fill();
    g.strokeStyle = 'rgba(150,130,185,0.5)'; g.lineWidth = 2; g.setLineDash([6, 5]); g.beginPath(); rrect(g, -200, -546, 400, 137, 50); g.stroke(); g.setLineDash([]);
    g.strokeStyle = 'rgba(150,140,185,0.35)'; g.lineWidth = 3; g.beginPath(); g.moveTo(-130, -478); g.quadraticCurveTo(0, -505, 120, -470); g.stroke();
    doudou(g, 105, -485, 0.95, -0.5);
    const couette = q => {
      q.moveTo(-X - 10, yC); q.lineTo(X + 10, yC);
      for (let y = yC; y < Y - 50; y += 76) q.quadraticCurveTo(X + 24, y + 38, X + 10, Math.min(Y - 50, y + 76));
      q.lineTo(-X - 10, Y - 50);
      for (let y = Y - 50; y > yC; y -= 76) q.quadraticCurveTo(-X - 24, y - 38, -X - 10, Math.max(yC, y - 76));
      q.closePath();
    };
    ombre(g, 5, 8, couette);
    gr = g.createLinearGradient(0, yC, 0, Y); gr.addColorStop(0, '#a3d3f6'); gr.addColorStop(1, '#6caee6');
    g.fillStyle = gr; g.beginPath(); couette(g); g.fill();
    g.strokeStyle = 'rgba(30,80,140,0.16)'; g.lineWidth = 7; g.lineCap = 'round'; g.beginPath();
    for (let k = 0; k < 7; k++) { const x = -230 + R() * 440, y = yC + 130 + R() * 720; g.moveTo(x, y); g.quadraticCurveTo(x + 40, y + 30 + R() * 30, x + 30 + R() * 60, y + 95); }
    g.stroke();
    g.fillStyle = '#ffd94f'; g.beginPath(); for (let k = 0; k < 20; k++) etoile(g, -255 + R() * 510, yC + 110 + R() * 760, 13 + R() * 9, R() * 2); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.9)'; g.beginPath();
    for (const n of [[-170, 40], [120, 400], [-80, 520], [150, -150]]) { rond(g, n[0], n[1], 26); rond(g, n[0] + 28, n[1] - 12, 31); rond(g, n[0] + 56, n[1], 24); }
    g.fill();
    g.fillStyle = '#fbf8f2'; g.beginPath(); rrect(g, -X - 6, yC, 2 * X + 12, 76, 10); g.fill();
    g.strokeStyle = '#7fb6e6'; g.lineWidth = 5; g.beginPath(); g.moveTo(-X + 2, yC + 60); g.lineTo(X - 2, yC + 60); g.stroke();
    g.strokeStyle = 'rgba(110,100,150,0.3)'; g.lineWidth = 2; g.beginPath(); g.moveTo(-X - 6, yC + 76); g.lineTo(X + 6, yC + 76); g.stroke();
    g.lineCap = 'butt';
    livre(g, 120, 170, -0.3, 0);
  },
  veilleuse(g, d, R) {                                 // table de chevet : veilleuse lune (halo chaud), réveil, verre d'eau
    let gr = g.createRadialGradient(-30, -15, 10, -30, -15, 330); gr.addColorStop(0, 'rgba(255,206,110,0.42)'); gr.addColorStop(0.5, 'rgba(255,206,110,0.13)'); gr.addColorStop(1, 'rgba(255,206,110,0)');
    g.fillStyle = gr; g.beginPath(); rond(g, -30, -15, 330); g.fill();
    ombre(g, 8, 12, q => rrect(q, -115, -105, 230, 210, 16));
    gr = g.createLinearGradient(-115, -105, 115, 105); gr.addColorStop(0, '#e6b77d'); gr.addColorStop(1, '#ba8045');
    g.fillStyle = gr; g.beginPath(); rrect(g, -115, -105, 230, 210, 16); g.fill();
    g.strokeStyle = 'rgba(110,60,20,0.25)'; g.lineWidth = 2; g.beginPath(); for (let k = 0; k < 6; k++) { const y = -88 + k * 34 + R() * 8; g.moveTo(-105, y); g.bezierCurveTo(-40, y - 8, 40, y + 8, 105, y); } g.stroke();
    gr = g.createRadialGradient(-30, -15, 5, -30, -15, 92); gr.addColorStop(0, 'rgba(255,244,190,0.95)'); gr.addColorStop(1, 'rgba(255,220,130,0)');
    g.fillStyle = gr; g.beginPath(); rond(g, -30, -15, 92); g.fill();
    g.fillStyle = '#f7f2e4'; g.beginPath(); rond(g, -30, -15, 50); g.fill(); g.strokeStyle = '#e0d4b8'; g.lineWidth = 3; g.stroke();
    g.save(); g.beginPath(); rond(g, -30, -15, 43); g.clip(); g.fillStyle = '#ffd45a'; g.fill();
    g.fillStyle = '#f7f2e4'; g.beginPath(); rond(g, -10, -33, 38); g.fill(); g.restore();
    g.strokeStyle = '#b8862a'; g.lineWidth = 2.5; g.beginPath(); g.arc(-50, 0, 6, 0.2, Math.PI - 0.2); g.stroke();
    g.fillStyle = 'rgba(240,120,120,0.5)'; g.beginPath(); rond(g, -44, 14, 5); g.fill();
    g.fillStyle = '#e8412f'; g.beginPath(); rond(g, 38, 22, 12); rond(g, 72, 22, 12); rond(g, 55, 48, 30); g.fill();   // réveil
    g.fillStyle = '#ffffff'; g.beginPath(); rond(g, 55, 48, 23); g.fill();
    g.strokeStyle = '#333'; g.lineWidth = 3; g.lineCap = 'round'; g.beginPath(); g.moveTo(55, 48); g.lineTo(55, 32); g.moveTo(55, 48); g.lineTo(66, 52); g.stroke(); g.lineCap = 'butt';
    g.fillStyle = 'rgba(70,38,12,0.2)'; g.beginPath(); rond(g, 64, -50, 22); g.fill();                              // verre d'eau
    g.fillStyle = 'rgba(190,226,248,0.75)'; g.beginPath(); rond(g, 60, -55, 21); g.fill(); g.strokeStyle = '#ffffff'; g.lineWidth = 2.5; g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.7)'; g.beginPath(); ovale(g, 53, -63, 7, 4); g.fill();
  },
  etagere(g, d, R, U) {                                // étagère basse contre le mur : globe, livres, pot de crayons, robot
    ombre(g, 10, 14, q => q.rect(-300, -95, 600, 190));
    let gr = g.createLinearGradient(0, -95, 0, 95); gr.addColorStop(0, '#dcac6f'); gr.addColorStop(1, '#bb8145');
    g.fillStyle = gr; g.fillRect(-300, -95, 600, 190);
    g.fillStyle = '#9a6532'; g.fillRect(-300, 80, 600, 15); g.fillStyle = 'rgba(255,230,190,0.3)'; g.fillRect(-300, -95, 600, 5);
    g.strokeStyle = 'rgba(110,60,20,0.22)'; g.lineWidth = 2; g.beginPath(); for (let k = 0; k < 5; k++) { const y = -78 + k * 34 + R() * 6; g.moveTo(-290, y); g.bezierCurveTo(-100, y - 6, 100, y + 6, 290, y); } g.stroke();
    ombre(g, 5, 7, q => rond(q, -200, -5, 66));                                      // globe terrestre
    gr = g.createRadialGradient(-220, -25, 8, -200, -5, 62); gr.addColorStop(0, '#8fd4f6'); gr.addColorStop(1, '#2a74bd');
    g.fillStyle = gr; g.beginPath(); rond(g, -200, -5, 60); g.fill();
    g.save(); g.beginPath(); rond(g, -200, -5, 58); g.clip();
    U.blob(g, -220, -22, 26, 20, 0.4, R, '#5cb860'); U.blob(g, -172, 14, 22, 30, -0.3, R, '#5cb860'); U.blob(g, -230, 30, 12, 9, 0, R, '#e8c86a');
    g.restore();
    g.strokeStyle = '#c9a24a'; g.lineWidth = 5; g.beginPath(); g.arc(-200, -5, 66, -2.4, 0.9); g.stroke();
    g.fillStyle = '#c9a24a'; g.beginPath(); rond(g, -200, -5, 6); g.fill();
    const L = [['#2f7fd8', -36, 0.12], ['#f4c21f', -22, -0.08], ['#e8412f', -8, 0.2]];  // pile de livres
    for (const b of L) {
      ombreRot(g, -50, b[1] + 30, b[2], 4, 6, q => q.rect(-58, -38, 116, 76));
      g.save(); g.translate(-50, b[1] + 30); g.rotate(b[2]); g.fillStyle = b[0]; g.fillRect(-58, -38, 116, 76);
      g.fillStyle = '#fbf6e8'; g.fillRect(52, -34, 6, 68); g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(-50, -30, 70, 10); g.restore();
    }
    ombre(g, 4, 6, q => rond(q, 85, -10, 42));                                       // pot de crayons
    g.fillStyle = '#7fd09a'; g.beginPath(); rond(g, 85, -10, 40); g.fill(); g.fillStyle = '#4a3020'; g.beginPath(); rond(g, 85, -10, 32); g.fill();
    for (let k = 0; k < 11; k++) { const u = k * 2.4, q = k ? 10 + (k % 3) * 7 : 0; g.fillStyle = '#f1cf98'; g.beginPath(); rond(g, 85 + Math.cos(u) * q, -10 + Math.sin(u) * q, 6.5); g.fill(); g.fillStyle = JOUETS[k % 5][0]; g.beginPath(); rond(g, 85 + Math.cos(u) * q, -10 + Math.sin(u) * q, 3.4); g.fill(); }
    ombre(g, 4, 6, q => q.rect(170, -40, 70, 86));                                  // robot jouet en fer-blanc
    g.fillStyle = '#b9c3cc'; g.fillRect(170, -40, 70, 86); g.fillStyle = '#dfe6ec'; g.fillRect(180, -30, 50, 40);
    g.fillStyle = '#e8412f'; g.fillRect(186, 18, 38, 18); g.fillStyle = '#f4c21f'; g.beginPath(); rond(g, 193, -14, 7); rond(g, 217, -14, 7); g.fill();
    g.fillStyle = '#e8412f'; g.beginPath(); rond(g, 205, -48, 6); g.fill();
    for (let k = 0; k < 3; k++) cubeABC(g, -270 + k * 0, 50 - k * 4, 16, 0.2 * k - 0.2, k + 3);
  },
  ours(g, d, R) {                                      // ours en peluche couché sur le dos, nœud rouge
    const fur = '#c68b52', clair = '#ecc58f', fonce = '#97602f';
    ombre(g, 10, 14, q => { ovale(q, 0, 40, 106, 116); rond(q, 0, -98, 80); rond(q, -62, -152, 32); rond(q, 62, -152, 32); ovale(q, -100, 12, 34, 56); ovale(q, 100, 12, 34, 56); ovale(q, -62, 140, 44, 50); ovale(q, 62, 140, 44, 50); });
    g.fillStyle = fur; g.beginPath(); ovale(g, -62, 140, 44, 50); ovale(g, 62, 140, 44, 50); ovale(g, -100, 12, 34, 56); ovale(g, 100, 12, 34, 56); rond(g, -62, -152, 32); rond(g, 62, -152, 32); g.fill();
    g.fillStyle = clair; g.beginPath(); ovale(g, -62, 152, 28, 30); ovale(g, 62, 152, 28, 30); rond(g, -62, -152, 17); rond(g, 62, -152, 17); g.fill();
    let gr = g.createRadialGradient(-30, 0, 20, 0, 40, 120); gr.addColorStop(0, '#d9a066'); gr.addColorStop(1, fonce);
    g.fillStyle = gr; g.beginPath(); ovale(g, 0, 40, 104, 114); g.fill();
    g.fillStyle = clair; g.beginPath(); ovale(g, 0, 56, 58, 66); g.fill();
    g.strokeStyle = 'rgba(120,70,30,0.5)'; g.lineWidth = 2; g.setLineDash([5, 5]); g.beginPath(); g.moveTo(0, -4); g.lineTo(0, 118); g.stroke(); g.setLineDash([]);
    gr = g.createRadialGradient(-25, -122, 15, 0, -98, 82); gr.addColorStop(0, '#dca569'); gr.addColorStop(1, fonce);
    g.fillStyle = gr; g.beginPath(); rond(g, 0, -98, 80); g.fill();
    g.fillStyle = clair; g.beginPath(); ovale(g, 0, -70, 34, 26); g.fill();
    g.fillStyle = '#3a2416'; g.beginPath(); ovale(g, 0, -80, 12, 8); rond(g, -28, -110, 7); rond(g, 28, -110, 7); g.fill();
    g.strokeStyle = '#3a2416'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(0, -72); g.lineTo(0, -60); g.moveTo(-10, -56); g.quadraticCurveTo(0, -50, 10, -56); g.stroke();
    g.fillStyle = '#ffffff'; g.beginPath(); rond(g, -30, -113, 2.5); rond(g, 26, -113, 2.5); g.fill();
    g.fillStyle = '#e8412f'; g.beginPath(); g.moveTo(0, -20); g.lineTo(-38, -38); g.lineTo(-38, -2); g.closePath(); g.moveTo(0, -20); g.lineTo(38, -38); g.lineTo(38, -2); g.closePath(); g.fill();
    g.fillStyle = '#b02a1d'; g.beginPath(); rond(g, 0, -20, 9); g.fill();
  },
  tambour(g, d, R) {                                   // tambour d'enfant : fût rouge, cordes en zigzag, peau, deux baguettes
    ombre(g, 10, 14, q => rond(q, 0, 0, 122));
    let gr = g.createRadialGradient(-40, -40, 30, 0, 0, 124); gr.addColorStop(0, '#ff6a55'); gr.addColorStop(1, '#b3261b');
    g.fillStyle = gr; g.beginPath(); rond(g, 0, 0, 122); g.fill();
    g.strokeStyle = '#fff4dc'; g.lineWidth = 3; g.beginPath();
    for (let k = 0; k < 18; k++) { const u = k * TAU / 18, v = (k + 0.5) * TAU / 18; g.moveTo(Math.cos(u) * 104, Math.sin(u) * 104); g.lineTo(Math.cos(v) * 120, Math.sin(v) * 120); g.lineTo(Math.cos(u + TAU / 18) * 104, Math.sin(u + TAU / 18) * 104); }
    g.stroke();
    g.strokeStyle = '#2f7fd8'; g.lineWidth = 9; g.beginPath(); rond(g, 0, 0, 103); g.stroke();
    gr = g.createRadialGradient(-30, -30, 10, 0, 0, 98); gr.addColorStop(0, '#fffaf0'); gr.addColorStop(1, '#ead9b8');
    g.fillStyle = gr; g.beginPath(); rond(g, 0, 0, 98); g.fill();
    g.fillStyle = 'rgba(160,120,70,0.18)'; g.beginPath(); rond(g, 8, 6, 30); g.fill();
    g.lineCap = 'round';
    for (const b of [[-70, -40, 60, 30], [-60, 50, 70, -20]]) {
      g.strokeStyle = 'rgba(70,38,12,0.25)'; g.lineWidth = 9; g.beginPath(); g.moveTo(b[0] + 6, b[1] + 9); g.lineTo(b[2] + 6, b[3] + 9); g.stroke();
      g.strokeStyle = '#e2b27a'; g.lineWidth = 8; g.beginPath(); g.moveTo(b[0], b[1]); g.lineTo(b[2], b[3]); g.stroke();
      g.fillStyle = '#f4c21f'; g.beginPath(); rond(g, b[2], b[3], 11); g.fill();
    }
    g.lineCap = 'butt';
  },
  coffre(g, d, R) {                                    // coffre à jouets ouvert : caisse bleue étoilée, jouets en vrac
    ombre(g, 10, 14, q => rrect(q, -175, -135, 350, 270, 16));
    g.fillStyle = '#2f6fc0'; g.beginPath(); rrect(g, -175, -135, 350, 270, 16); g.fill();
    g.fillStyle = '#4a8ad6'; g.beginPath(); rrect(g, -169, -129, 338, 258, 12); g.fill();
    let gr = g.createLinearGradient(0, -110, 0, 110); gr.addColorStop(0, '#3b2414'); gr.addColorStop(1, '#5c3a20');
    g.fillStyle = gr; g.fillRect(-150, -110, 300, 220);
    g.fillStyle = '#ffd94f'; g.beginPath(); for (let k = 0; k < 9; k++) etoile(g, -150 + k * 37.5, k % 2 ? -121 : 121, 7, 0.3); for (const y of [-60, 0, 60]) { etoile(g, -161, y, 6, 0); etoile(g, 161, y, 6, 0); } g.fill();
    brique(g, -95, 55, 0.4, 96, 32, 3, true); brique(g, 40, 70, -0.2, 64, 32, 2, true);
    ombre(g, 4, 6, q => rond(q, 70, -40, 48));                                  // ballon
    gr = g.createRadialGradient(55, -55, 6, 70, -40, 48); gr.addColorStop(0, '#ff8a7a'); gr.addColorStop(1, '#c82c1f');
    g.fillStyle = gr; g.beginPath(); rond(g, 70, -40, 48); g.fill();
    g.strokeStyle = '#ffffff'; g.lineWidth = 7; g.beginPath(); g.arc(70, -40, 34, 0.4, 2.2); g.stroke();
    g.lineCap = 'round'; g.strokeStyle = '#f4c21f'; g.lineWidth = 14; g.beginPath(); g.moveTo(-130, -80); g.lineTo(-20, -30); g.stroke();   // trompette
    g.fillStyle = '#f4c21f'; g.beginPath(); rond(g, -14, -27, 20); g.fill(); g.fillStyle = '#c09010'; g.beginPath(); rond(g, -14, -27, 11); g.fill();
    g.strokeStyle = '#f2b8a0'; g.lineWidth = 16; g.beginPath(); g.moveTo(120, 30); g.lineTo(150, 95); g.stroke();   // bras de poupée
    g.lineCap = 'butt';
    cubeABC(g, -40, 10, 18, 0.5, 1); cubeABC(g, 110, 40, 16, -0.3, 4);
    doudou(g, -110, -10, 0.6, 1.9);
  },
  maisonpoupee(g, d, R) {                              // maison de poupée sans toit : quatre pièces meublées, jardinet
    ombre(g, 12, 16, q => q.rect(-235, -195, 470, 390));
    g.fillStyle = '#f2a9bd'; g.fillRect(-235, -195, 470, 390);
    g.fillStyle = '#fff6ee'; g.fillRect(-225, -185, 450, 370);
    g.fillStyle = '#ffffff'; g.fillRect(-212, -172, 204, 160); g.fillStyle = '#222'; g.beginPath();   // cuisine : damier
    for (let y = 0; y < 8; y++) for (let x = 0; x < 10; x++) if ((x + y) % 2) g.rect(-212 + x * 20.4, -172 + y * 20, 20.4, 20);
    g.fill();
    g.fillStyle = '#6cc08a'; g.fillRect(8, -172, 204, 160);                                       // salon : moquette verte
    g.fillStyle = '#d7a46a'; g.fillRect(-212, 12, 204, 160);                                      // chambre : parquet
    g.strokeStyle = 'rgba(110,60,20,0.35)'; g.lineWidth = 1.5; g.beginPath(); for (let y = 12; y < 172; y += 16) { g.moveTo(-212, y); g.lineTo(-8, y); } g.stroke();
    g.fillStyle = '#bfe6f2'; g.fillRect(8, 12, 204, 160);                                         // salle de bain : petits carreaux
    g.strokeStyle = 'rgba(70,140,170,0.4)'; g.beginPath(); for (let x = 8; x <= 212; x += 17) { g.moveTo(x, 12); g.lineTo(x, 172); } for (let y = 12; y <= 172; y += 16) { g.moveTo(8, y); g.lineTo(212, y); } g.stroke();
    g.fillStyle = '#e88aa6'; g.fillRect(-235, -8, 470, 16); g.fillRect(-8, -195, 16, 390);       // cloisons, portes
    g.fillStyle = '#fff6ee'; g.fillRect(-130, -8, 50, 16); g.fillRect(110, -8, 50, 16); g.fillRect(-8, -110, 16, 46); g.fillRect(-8, 90, 16, 46);
    g.fillStyle = '#ffffff'; g.fillRect(-60, 179, 70, 16);
    // meubles : table ronde et chaises, cuisinière ; canapé et télé ; lit ; baignoire et lavabo
    g.fillStyle = '#c98b4f'; g.beginPath(); rond(g, -110, -90, 32); g.fill();
    g.fillStyle = '#e8412f'; g.fillRect(-160, -100, 18, 20); g.fillRect(-78, -100, 18, 20); g.fillRect(-120, -138, 20, 18);
    g.fillStyle = '#d6dbe0'; g.fillRect(-205, -165, 56, 50); g.fillStyle = '#333'; g.beginPath(); for (const p of [[-191, -152], [-163, -152], [-191, -128], [-163, -128]]) rond(g, p[0], p[1], 8); g.fill();
    g.fillStyle = '#7a4fa8'; g.fillRect(40, -60, 140, 36); g.fillRect(40, -100, 26, 40); g.fillRect(154, -100, 26, 40);
    g.fillStyle = '#9b71c8'; g.fillRect(70, -58, 80, 26);
    g.fillStyle = '#2c2c34'; g.fillRect(70, -168, 90, 14); g.fillStyle = '#f4c21f'; g.beginPath(); rond(g, 115, -110, 26); g.fill();
    g.fillStyle = '#ffffff'; g.fillRect(-195, 30, 70, 120); g.fillStyle = '#78b4ea'; g.fillRect(-195, 70, 70, 80); g.fillStyle = '#f7f2e4'; g.fillRect(-188, 38, 56, 24);
    g.fillStyle = '#c98b4f'; g.fillRect(-90, 30, 66, 40);
    g.fillStyle = '#ffffff'; g.beginPath(); rrect(g, 110, 30, 92, 130, 30); g.fill(); g.fillStyle = '#8fd0f0'; g.beginPath(); rrect(g, 120, 42, 72, 106, 24); g.fill();
    g.fillStyle = '#ffffff'; g.beginPath(); rond(g, 40, 150, 18); g.fill(); g.fillStyle = '#bfe6f2'; g.beginPath(); rond(g, 40, 150, 11); g.fill();
    for (const p of [[-40, -40, '#2f7fd8'], [90, 120, '#33a852'], [-140, 120, '#f07f1d']]) {   // poupées
      g.fillStyle = p[2]; g.beginPath(); ovale(g, p[0], p[1] + 6, 9, 12); g.fill();
      g.fillStyle = '#f6c9a6'; g.beginPath(); rond(g, p[0], p[1] - 9, 8); g.fill(); g.fillStyle = '#7a4a22'; g.beginPath(); g.arc(p[0], p[1] - 10, 8, Math.PI, TAU); g.fill();
    }
  },
  tours(g, d, R) {                                     // tours de briques empilées (on voit les étages décalés) et briques renversées
    const v = d[3] || 0, TT = v ? [[-70, -20, 6, 1], [50, 30, 3, 3], [-5, 80, 8, 0]] : [[0, -10, 9, 2], [-95, 45, 4, 4], [85, -60, 6, 1]];
    if (v) { brique(g, 110, -60, 0.6, 96, 32, 1, true); brique(g, 140, 10, -0.4, 64, 32, 4, true); brique(g, -130, 70, 1.2, 64, 32, 2, true); }
    else { brique(g, -120, -60, -0.7, 96, 32, 0, true); brique(g, 60, 70, 0.3, 64, 32, 3, true); }
    for (const t of TT) {
      g.fillStyle = 'rgba(70,38,12,0.16)'; g.beginPath(); g.moveTo(t[0] - 30, t[1] + 30); g.lineTo(t[0] + 30, t[1] - 30); g.lineTo(t[0] + 30 + t[2] * 9, t[1] - 30 + t[2] * 12); g.lineTo(t[0] - 30 + t[2] * 9, t[1] + 30 + t[2] * 12); g.closePath(); g.fill();
      for (let k = 0; k < t[2]; k++) {
        const C = JOUETS[(t[3] + k) % 5], x = t[0] - k * 2.2, y = t[1] - k * 3;
        g.fillStyle = C[2]; g.fillRect(x - 32, y - 32, 64, 64); g.fillStyle = C[0]; g.fillRect(x - 32, y - 32, 61, 61);
        if (k === t[2] - 1) {
          g.fillStyle = C[2]; g.beginPath(); for (const p of [[-15, -15], [15, -15], [-15, 15], [15, 15]]) rond(g, x + p[0] + 1, y + p[1] + 1.5, 10); g.fill();
          g.fillStyle = C[1]; g.beginPath(); for (const p of [[-15, -15], [15, -15], [-15, 15], [15, 15]]) rond(g, x + p[0] - 1, y + p[1] - 1.5, 9); g.fill();
        }
      }
    }
  },
  dessins(g, d, R) {                                   // dessins d'enfant étalés par terre, crayons de couleur
    const v = d[3] || 0;
    const feuille = (x, y, a, k) => {
      ombreRot(g, x, y, a, 5, 8, q => q.rect(-105, -72, 210, 144));
      g.save(); g.translate(x, y); g.rotate(a); g.fillStyle = '#fffdf6'; g.fillRect(-105, -72, 210, 144);
      g.lineCap = 'round'; g.lineJoin = 'round'; g.lineWidth = 5;
      if (k === 0) {                                   // maison, soleil, herbe
        g.strokeStyle = '#f4c21f'; g.beginPath(); rond(g, 60, -36, 18); for (let i = 0; i < 8; i++) { const u = i * TAU / 8; g.moveTo(60 + Math.cos(u) * 24, -36 + Math.sin(u) * 24); g.lineTo(60 + Math.cos(u) * 34, -36 + Math.sin(u) * 34); } g.stroke();
        g.strokeStyle = '#e8412f'; g.beginPath(); g.moveTo(-70, -6); g.lineTo(-30, -44); g.lineTo(10, -6); g.stroke();
        g.strokeStyle = '#2f7fd8'; g.beginPath(); g.rect(-62, -6, 64, 52); g.stroke(); g.beginPath(); g.rect(-38, 18, 18, 28); g.stroke();
        g.strokeStyle = '#33a852'; g.beginPath(); for (let x = -98; x < 100; x += 14) { g.moveTo(x, 62); g.lineTo(x + 7, 50); g.lineTo(x + 14, 62); } g.stroke();
      } else if (k === 1) {                            // arc-en-ciel et nuages
        const A = ['#e8412f', '#f07f1d', '#f4c21f', '#33a852', '#2f7fd8', '#7a4fa8'];
        for (let i = 0; i < 6; i++) { g.strokeStyle = A[i]; g.beginPath(); g.arc(0, 50, 90 - i * 9, Math.PI, TAU); g.stroke(); }
        g.fillStyle = '#9fd0f5'; g.beginPath(); rond(g, -80, 44, 16); rond(g, -62, 38, 18); rond(g, 80, 44, 16); rond(g, 62, 38, 18); g.fill();
      } else if (k === 2) {                            // la famille et un cœur
        for (let i = 0; i < 3; i++) {
          const x = -60 + i * 50, s = i === 2 ? 0.7 : 1;
          g.strokeStyle = JOUETS[i][0]; g.beginPath(); rond(g, x, -30 * s, 14 * s); g.moveTo(x, -16 * s); g.lineTo(x, 26 * s); g.moveTo(x - 22 * s, 0); g.lineTo(x + 22 * s, 0); g.moveTo(x, 26 * s); g.lineTo(x - 14 * s, 54 * s); g.moveTo(x, 26 * s); g.lineTo(x + 14 * s, 54 * s); g.stroke();
        }
        g.fillStyle = '#e8412f'; g.beginPath(); g.moveTo(75, -10); g.bezierCurveTo(75, -40, 45, -40, 45, -18); g.bezierCurveTo(45, 0, 75, 16, 75, 24); g.bezierCurveTo(75, 16, 105, 0, 105, -18); g.bezierCurveTo(105, -40, 75, -40, 75, -10); g.fill();
      } else {                                         // le train électrique !
        g.strokeStyle = '#555'; g.beginPath(); g.moveTo(-100, 40); g.lineTo(100, 40); g.stroke();
        g.strokeStyle = '#e8412f'; g.beginPath(); g.rect(-80, -10, 60, 40); g.rect(-50, -40, 30, 30); g.stroke();
        g.strokeStyle = '#2f7fd8'; g.beginPath(); g.rect(-10, -4, 50, 34); g.rect(50, -4, 50, 34); g.stroke();
        g.strokeStyle = '#333'; g.beginPath(); for (const x of [-66, -34, 4, 26, 64, 86]) rond(g, x, 38, 7); g.stroke();
        g.strokeStyle = '#b8c0c8'; g.beginPath(); rond(g, -70, -40, 10); rond(g, -86, -60, 14); g.stroke();
      }
      g.lineCap = 'butt'; g.lineJoin = 'miter';
      g.restore();
    };
    if (v) { feuille(-90, 0, 0.18, 1); feuille(110, -10, -0.12, 3); } else { feuille(-100, -5, -0.15, 0); feuille(105, 5, 0.1, 2); }
    for (let k = 0; k < 5; k++) crayon(g, -170 + R() * 340, (R() - 0.5) * 120, R() * TAU, JOUETS[(k + v) % 5][0], 100 + R() * 40);
  },
  chaussons(g) {                                       // chaussons lapin roses
    for (const s of [-1, 1]) {
      g.save(); g.translate(s * 48, s * 10); g.rotate(s * 0.14 + 0.2);
      g.fillStyle = 'rgba(70,38,12,0.22)'; g.beginPath(); ovale(g, 6, 10, 40, 84); g.fill();
      g.fillStyle = '#f5aac2'; g.beginPath(); ovale(g, 0, 0, 40, 82); ovale(g, -14, -86, 9, 26); ovale(g, 14, -86, 9, 26); g.fill();
      g.fillStyle = '#fbd3e0'; g.beginPath(); ovale(g, -14, -86, 4.5, 19); ovale(g, 14, -86, 4.5, 19); g.fill();
      g.fillStyle = '#c96a8a'; g.beginPath(); ovale(g, 0, 26, 27, 44); g.fill();
      g.fillStyle = '#3a2a3a'; g.beginPath(); rond(g, -11, -48, 4); rond(g, 11, -48, 4); g.fill();
      g.fillStyle = '#ffffff'; g.beginPath(); rond(g, 0, 78, 11); g.fill();
      g.fillStyle = '#e8708f'; g.beginPath(); ovale(g, 0, -36, 5, 4); g.fill();
      g.restore();
    }
  },
  gare(g) {                                            // gare du train électrique : quai courbe, bâtiment au toit rouge, horloge
    ombre(g, 5, 7, q => q.arc(0, 0, 168, 2.3, 4.0));
    g.strokeStyle = '#c7c2ba'; g.lineWidth = 30; g.beginPath(); g.arc(10, 0, 152, 2.35, 3.95); g.stroke();
    g.strokeStyle = '#f4c21f'; g.lineWidth = 4; g.beginPath(); g.arc(10, 0, 165, 2.35, 3.95); g.stroke();
    ombre(g, 7, 10, q => q.rect(-40, -70, 110, 140));
    g.fillStyle = '#f3e6cf'; g.fillRect(-40, -70, 110, 140);
    g.fillStyle = '#d8352a'; g.fillRect(-46, -76, 61, 152); g.fillStyle = '#b02a1d'; g.fillRect(15, -76, 61, 152);
    g.strokeStyle = 'rgba(80,10,10,0.4)'; g.lineWidth = 2; g.beginPath(); for (let y = -66; y < 76; y += 14) { g.moveTo(-46, y); g.lineTo(76, y); } g.stroke();
    g.strokeStyle = '#ffe7c2'; g.lineWidth = 5; g.beginPath(); g.moveTo(15, -76); g.lineTo(15, 76); g.stroke();
    g.fillStyle = '#8a8f98'; g.fillRect(36, -50, 18, 20);
    g.fillStyle = '#3b3f45'; g.beginPath(); rond(g, -100, -70, 6); rond(g, -100, 70, 6); g.fill();
    g.fillStyle = '#ffffff'; g.beginPath(); rond(g, -100, -70, 13); g.fill(); g.strokeStyle = '#333'; g.lineWidth = 2; g.beginPath(); rond(g, -100, -70, 13); g.moveTo(-100, -70); g.lineTo(-100, -79); g.moveTo(-100, -70); g.lineTo(-94, -70); g.stroke();
    g.fillStyle = '#7a4a22'; g.fillRect(-112, 20, 16, 50);
  },
  sapins(g, d, R) {                                    // sapins en bois et petit signal
    for (const s of [[-50, -50, 46], [40, -20, 56], [-30, 55, 40], [60, 75, 34]]) {
      g.fillStyle = 'rgba(70,38,12,0.22)'; g.beginPath(); rond(g, s[0] + 8, s[1] + 11, s[2]); g.fill();
      for (let k = 0; k < 3; k++) {
        const r = s[2] * (1 - k * 0.3); g.fillStyle = ['#2e7d43', '#3f9a54', '#5cb96c'][k]; g.beginPath();
        for (let i = 0; i < 16; i++) { const u = i * TAU / 16 + k * 0.2, q = i % 2 ? r * 0.78 : r; if (i) g.lineTo(s[0] + Math.cos(u) * q, s[1] + Math.sin(u) * q); else g.moveTo(s[0] + Math.cos(u) * q, s[1] + Math.sin(u) * q); }
        g.closePath(); g.fill();
      }
      g.fillStyle = '#7a4a22'; g.beginPath(); rond(g, s[0], s[1], 4); g.fill();
    }
    g.fillStyle = '#3b3f45'; g.fillRect(-100, -8, 30, 16); g.fillStyle = '#33a852'; g.beginPath(); rond(g, -78, 0, 6); g.fill(); g.fillStyle = '#5a1712'; g.beginPath(); rond(g, -92, 0, 6); g.fill();
  },
  lapin(g) {                                           // lapin en peluche couché sur le côté, grandes oreilles
    g.save(); g.rotate(-0.25);
    g.fillStyle = 'rgba(70,38,12,0.2)'; g.beginPath(); ovale(g, 8, 12, 96, 54); ovale(g, -128, -20, 60, 18); g.fill();
    g.fillStyle = '#d8d2e6'; g.beginPath(); ovale(g, -120, -30, 62, 17); ovale(g, -110, 4, 58, 16); g.fill();
    g.fillStyle = '#f3b6c9'; g.beginPath(); ovale(g, -122, -30, 46, 8); ovale(g, -112, 4, 42, 7); g.fill();
    g.fillStyle = '#ece7f5'; g.beginPath(); ovale(g, 30, 0, 82, 50); rond(g, -48, -10, 42); ovale(g, 70, 44, 26, 14); ovale(g, 20, 46, 24, 13); g.fill();
    g.fillStyle = '#ffffff'; g.beginPath(); rond(g, 112, 0, 18); ovale(g, 34, 6, 46, 28); g.fill();
    g.strokeStyle = '#4a3a4a'; g.lineWidth = 2.5; g.beginPath(); g.arc(-60, -18, 6, 0.2, Math.PI - 0.2); g.stroke();
    g.fillStyle = '#f08aa8'; g.beginPath(); ovale(g, -84, -6, 5, 4); g.fill();
    g.restore();
  },
  xylophone(g) {                                       // xylophone arc-en-ciel et ses deux maillets
    g.rotate(-0.3);
    ombre(g, 7, 10, q => { q.moveTo(-150, -60); q.lineTo(150, -36); q.lineTo(150, 36); q.lineTo(-150, 60); q.closePath(); });
    g.fillStyle = '#c98b4f'; g.beginPath(); g.moveTo(-150, -60); g.lineTo(150, -36); g.lineTo(150, 36); g.lineTo(-150, 60); g.closePath(); g.fill();
    const A = ['#e8412f', '#f07f1d', '#f4c21f', '#7cc84a', '#33a852', '#2fb0c8', '#2f7fd8', '#7a4fa8'];
    for (let k = 0; k < 8; k++) {
      const x = -132 + k * 35, h = 104 - k * 7;
      g.fillStyle = A[k]; g.beginPath(); rrect(g, x, -h / 2, 28, h, 6); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(x + 4, -h / 2 + 6, 6, h - 12);
      g.fillStyle = '#e6e6e6'; g.beginPath(); rond(g, x + 14, -h / 2 + 10, 3); rond(g, x + 14, h / 2 - 10, 3); g.fill();
    }
    g.lineCap = 'round';
    for (const m of [[-60, 90, 70, 120], [10, 105, 140, 92]]) {
      g.strokeStyle = 'rgba(70,38,12,0.25)'; g.lineWidth = 7; g.beginPath(); g.moveTo(m[0] + 5, m[1] + 8); g.lineTo(m[2] + 5, m[3] + 8); g.stroke();
      g.strokeStyle = '#e8c48c'; g.lineWidth = 6; g.beginPath(); g.moveTo(m[0], m[1]); g.lineTo(m[2], m[3]); g.stroke();
      g.fillStyle = '#e8412f'; g.beginPath(); rond(g, m[0], m[1], 12); g.fill();
    }
    g.lineCap = 'butt';
  },
  ballon(g) {                                          // ballon de plage à quartiers
    ombre(g, 9, 13, q => rond(q, 0, 0, 74));
    const A = ['#e8412f', '#ffffff', '#2f7fd8', '#f4c21f', '#ffffff', '#33a852'];
    for (let k = 0; k < 6; k++) { g.fillStyle = A[k]; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, 74, k * TAU / 6 + 0.3, (k + 1) * TAU / 6 + 0.3); g.closePath(); g.fill(); }
    g.fillStyle = '#ffffff'; g.beginPath(); rond(g, 0, 0, 16); g.fill();
    const gr = g.createRadialGradient(-25, -25, 4, 0, 0, 76); gr.addColorStop(0, 'rgba(255,255,255,0.5)'); gr.addColorStop(0.5, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.2)');
    g.fillStyle = gr; g.beginPath(); rond(g, 0, 0, 74); g.fill();
  },
  toupie(g) {                                          // toupie à rayures couchée sur le flanc
    g.rotate(0.5);
    ombre(g, 7, 10, q => { q.moveTo(-70, -52); q.quadraticCurveTo(70, -60, 92, 0); q.quadraticCurveTo(70, 60, -70, 52); q.quadraticCurveTo(-90, 0, -70, -52); });
    g.save(); g.beginPath(); g.moveTo(-70, -52); g.quadraticCurveTo(70, -60, 92, 0); g.quadraticCurveTo(70, 60, -70, 52); g.quadraticCurveTo(-90, 0, -70, -52); g.clip();
    const A = ['#e8412f', '#f4c21f', '#2f7fd8', '#ffffff', '#33a852'];
    for (let k = 0; k < 7; k++) { g.fillStyle = A[k % 5]; g.fillRect(-90 + k * 27, -70, 27, 140); }
    const gr = g.createLinearGradient(0, -60, 0, 60); gr.addColorStop(0, 'rgba(255,255,255,0.4)'); gr.addColorStop(0.4, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.25)');
    g.fillStyle = gr; g.fillRect(-90, -70, 190, 140);
    g.restore();
    g.fillStyle = '#c98b4f'; g.fillRect(-118, -9, 46, 18); g.fillStyle = '#e8412f'; g.beginPath(); rond(g, -120, 0, 12); g.fill();
  },
  abc(g) {                                             // cubes ABC empilés et en vrac
    cubeABC(g, -60, 10, 30, 0.2, 0); cubeABC(g, 10, -30, 30, -0.15, 1); cubeABC(g, 60, 40, 30, 0.5, 2);
    cubeABC(g, -2, 40, 28, 0.05, 3); cubeABC(g, 7, -36, 24, 0.3, 4);
  },
  pompiers(g) {                                        // camion de pompiers : grande échelle, gyrophares, dévidoir
    g.rotate(-0.22);
    ombre(g, 8, 12, q => rrect(q, -105, -42, 210, 84, 12));
    g.fillStyle = '#1e1e22'; for (const x of [-70, -30, 60]) { g.fillRect(x - 15, -48, 30, 10); g.fillRect(x - 15, 38, 30, 10); }
    let gr = g.createLinearGradient(0, -42, 0, 42); gr.addColorStop(0, '#ff5444'); gr.addColorStop(1, '#b8241a');
    g.fillStyle = gr; g.beginPath(); rrect(g, -105, -42, 210, 84, 12); g.fill();
    g.fillStyle = '#d8352a'; g.beginPath(); rrect(g, 46, -38, 56, 76, 10); g.fill();
    g.fillStyle = '#2c4a70'; g.fillRect(84, -32, 12, 64); g.fillStyle = 'rgba(255,255,255,0.4)'; g.fillRect(86, -28, 4, 22);
    g.fillStyle = '#2f7fd8'; g.fillRect(58, -26, 14, 18); g.fillStyle = '#e8412f'; g.fillRect(58, 8, 14, 18);
    g.fillStyle = '#e4e9ed'; g.fillRect(-96, -22, 136, 7); g.fillRect(-96, 15, 136, 7);       // grande échelle
    g.beginPath(); for (let x = -90; x < 40; x += 13) g.rect(x, -15, 4, 30); g.fill();
    g.fillStyle = '#9aa2aa'; g.beginPath(); rond(g, -78, 0, 13); g.fill(); g.fillStyle = '#f4c21f'; g.beginPath(); rond(g, -78, 0, 8); g.fill();
    g.fillStyle = '#fff3a0'; g.beginPath(); rond(g, 101, -30, 4); rond(g, 101, 30, 4); g.fill();
  },
  dino(g) {                                            // tyrannosaure en plastique couché, crête orange
    g.rotate(0.35);
    const corps = q => { q.moveTo(-150, 6); q.quadraticCurveTo(-60, -40, 30, -34); q.quadraticCurveTo(80, -32, 96, -10); q.lineTo(96, 12); q.quadraticCurveTo(70, 34, 20, 32); q.quadraticCurveTo(-60, 28, -150, 6); q.closePath(); };
    ombre(g, 8, 12, q => { corps(q); rrect(q, 70, -34, 74, 50, 20); });
    g.fillStyle = '#3f9a3a'; g.beginPath(); ovale(g, -6, -38, 20, 12); ovale(g, -6, 36, 20, 12); ovale(g, 54, -30, 10, 6); ovale(g, 54, 28, 10, 6); g.fill();   // pattes
    g.fillStyle = '#5cbc52'; g.beginPath(); corps(g); g.fill();
    g.fillStyle = '#5cbc52'; g.beginPath(); rrect(g, 70, -34, 74, 50, 20); g.fill();
    g.fillStyle = '#e4f3c8'; g.beginPath(); ovale(g, 20, 8, 46, 14); g.fill();
    g.fillStyle = '#f07f1d'; g.beginPath(); for (let k = 0; k < 7; k++) { const x = -110 + k * 26; g.moveTo(x - 10, -14 + k * -2.5); g.lineTo(x, -30 - k * 2.5); g.lineTo(x + 10, -14 + k * -2.5); } g.fill();
    g.fillStyle = '#ffffff'; g.beginPath(); rond(g, 118, -20, 7); g.fill(); g.fillStyle = '#1d1d1d'; g.beginPath(); rond(g, 120, -20, 3.5); g.fill();
    g.strokeStyle = '#2e7a2a'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(100, 4); g.lineTo(142, 4); g.stroke();
    g.fillStyle = '#ffffff'; g.beginPath(); for (let x = 106; x < 140; x += 8) { g.moveTo(x, 4); g.lineTo(x + 3, 10); g.lineTo(x + 6, 4); } g.fill();
  },
  panier(g, d, R) {                                    // panier en osier plein de balles (la balle qui roule en sort)
    ombre(g, 7, 10, q => rond(q, 0, 0, 72));
    g.fillStyle = '#b98a4a'; g.beginPath(); rond(g, 0, 0, 72); g.fill();
    g.strokeStyle = '#8f6430'; g.lineWidth = 4; g.setLineDash([7, 6]); for (const r of [64, 54]) { g.beginPath(); rond(g, 0, 0, r); g.stroke(); } g.setLineDash([]);
    g.fillStyle = '#5c3a1c'; g.beginPath(); rond(g, 0, 0, 48); g.fill();
    for (const b of [[-16, -14, 22, 0], [20, -6, 20, 2], [-4, 22, 19, 1], [24, 26, 12, 3]]) {
      const gr = g.createRadialGradient(b[0] - b[2] * 0.35, b[1] - b[2] * 0.4, 2, b[0], b[1], b[2]); gr.addColorStop(0, JOUETS[b[3]][1]); gr.addColorStop(1, JOUETS[b[3]][2]);
      g.fillStyle = gr; g.beginPath(); rond(g, b[0], b[1], b[2]); g.fill();
    }
    g.strokeStyle = '#a5763c'; g.lineWidth = 8; g.lineCap = 'round'; g.beginPath(); g.arc(0, 0, 80, 2.6, 3.7); g.stroke(); g.lineCap = 'butt';
  },
  livres(g) {                                          // livres d'images par terre, au pied du lit
    const L = [[-30, 30, 0.35, 1], [10, 5, -0.2, 2], [-5, -20, 0.1, 3]];
    for (const b of L) {
      ombreRot(g, b[0], b[1], b[2], 4, 6, q => q.rect(-64, -44, 128, 88));
      g.save(); g.translate(b[0], b[1]); g.rotate(b[2]); g.fillStyle = JOUETS[b[3]][0]; g.fillRect(-64, -44, 128, 88);
      g.fillStyle = '#fbf6e8'; g.fillRect(58, -40, 6, 80); g.fillStyle = JOUETS[b[3]][1]; g.beginPath(); rond(g, -14, -4, 22); g.fill(); g.restore();
    }
    livre(g, 30, 110, 0.25, 4);
  },
};

// ── obstacles ronds : cubes ABC (on s'arrête), balles rebondissantes (elles renvoient) ──
const OBJETS = {
  cube(g, r) { const x = r[0], y = r[1], k = Math.round(x * 3 + y) % 5; cubeABC(g, x, y, r[2] * 0.85, ((x * 13 + y * 7) % 157) / 100, k); },
  balle(g, r) {
    const x = r[0], y = r[1], s = r[2], C = [['#ff6f9a', '#c8245a'], ['#5cc8f5', '#1d79b8'], ['#ffd84a', '#d19a0a'], ['#86dd62', '#3c9a2a']][Math.round(x + y) % 4];
    ombre(g, 6, 9, q => rond(q, x, y, s));
    const gr = g.createRadialGradient(x - s * 0.35, y - s * 0.4, 2, x, y, s); gr.addColorStop(0, C[0]); gr.addColorStop(1, C[1]);
    g.fillStyle = gr; g.beginPath(); rond(g, x, y, s); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.75)'; g.lineWidth = 3.5; g.beginPath(); g.arc(x, y, s * 0.62, -0.5, 1.9); g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.75)'; g.beginPath(); ovale(g, x - s * 0.35, y - s * 0.42, s * 0.24, s * 0.15); g.fill();
  },
};
// ── murs : briques à tenons (capsules), petites voitures en bois garées ; plinthes et meubles : invisibles ──
const MURS = {
  brique(g, w) { const L = Math.hypot(w[2] - w[0], w[3] - w[1]) + 2 * w[4]; brique(g, (w[0] + w[2]) / 2, (w[1] + w[3]) / 2, Math.atan2(w[3] - w[1], w[2] - w[0]), L, 2 * w[4], Math.round(w[0] + w[1]) % 5, true); },
  garee(g, w) {
    const x = (w[0] + w[2]) / 2, y = (w[1] + w[3]) / 2, a = Math.atan2(w[3] - w[1], w[2] - w[0]), L = Math.hypot(w[2] - w[0], w[3] - w[1]) + 2 * w[4], l = 2 * w[4], C = JOUETS[Math.round(x + y) % 5];
    ombreRot(g, x, y, a, 5, 8, q => rrect(q, -L / 2, -l / 2, L, l, 12));
    g.save(); g.translate(x, y); g.rotate(a);
    g.fillStyle = '#2b2b30'; for (const p of [[-L * 0.3, -l / 2 - 3], [L * 0.3, -l / 2 - 3], [-L * 0.3, l / 2 - 5], [L * 0.3, l / 2 - 5]]) { g.fillRect(p[0] - 11, p[1], 22, 8); }
    const gr = g.createLinearGradient(0, -l / 2, 0, l / 2); gr.addColorStop(0, '#f0cf98'); gr.addColorStop(1, '#c4955a');
    g.fillStyle = gr; g.beginPath(); rrect(g, -L / 2, -l / 2 + 2, L, l - 4, 12); g.fill();
    g.strokeStyle = 'rgba(120,70,30,0.3)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(-L / 2 + 8, -4); g.lineTo(L / 2 - 8, -6); g.moveTo(-L / 2 + 8, 6); g.lineTo(L / 2 - 8, 5); g.stroke();
    g.fillStyle = C[0]; g.beginPath(); rrect(g, -L * 0.2, -l / 2 + 6, L * 0.38, l - 12, 7); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.45)'; g.fillRect(L * 0.1, -l / 2 + 9, 5, l - 18);
    g.fillStyle = '#fff3a0'; g.beginPath(); rond(g, L / 2 - 5, -l / 2 + 9, 3.5); rond(g, L / 2 - 5, l / 2 - 9, 3.5); g.fill();
    g.restore();
  },
  plinthe() {}, paroi() {},
};
// ── zones : tapis moumoute (on s'enlise), billes renversées (on glisse) ──
const ZONES = {
  moumoute(g, z, R, U) {
    g.save(); g.translate(z[0], z[1]); g.rotate(z[5]);
    U.blob(g, 4, 6, z[2], z[3], 0, R, 'rgba(120,50,80,0.2)');
    U.blob(g, 0, 0, z[2], z[3], 0, R, '#f1bfd2');
    g.lineCap = 'round';
    for (const c of ['rgba(255,255,255,0.75)', 'rgba(200,110,150,0.55)']) {
      g.strokeStyle = c; g.lineWidth = 3; g.beginPath();
      for (let k = 0; k < 46; k++) { const u = R() * TAU, q = Math.sqrt(R()) * 0.92, x = Math.cos(u) * z[2] * q, y = Math.sin(u) * z[3] * q, v = R() * TAU; g.moveTo(x, y); g.lineTo(x + Math.cos(v) * 10, y + Math.sin(v) * 10); }
      g.stroke();
    }
    g.lineCap = 'butt';
    g.restore();
  },
  billes(g, z, R) {
    g.save(); g.translate(z[0], z[1]); g.rotate(z[5]);
    g.fillStyle = 'rgba(255,255,255,0.18)'; g.beginPath(); ovale(g, 0, 0, z[2], z[3]); g.fill();
    const A = ['#e8412f', '#2f7fd8', '#33a852', '#f4c21f', '#7a4fa8', '#f07f1d'];
    for (let k = 0; k < 15; k++) {
      const u = R() * TAU, q = Math.sqrt(R()) * 0.88, x = Math.cos(u) * z[2] * q, y = Math.sin(u) * z[3] * q, r = 7 + R() * 3, col = A[k % 6];
      g.fillStyle = 'rgba(40,20,8,0.28)'; g.beginPath(); rond(g, x + 2.5, y + 3.5, r); g.fill();
      const gr = g.createRadialGradient(x - r * 0.3, y - r * 0.35, 1, x, y, r); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.35, 'rgba(225,240,255,0.9)'); gr.addColorStop(1, 'rgba(150,180,210,0.95)');
      g.fillStyle = gr; g.beginPath(); rond(g, x, y, r); g.fill();
      g.strokeStyle = col; g.lineWidth = 2.5; g.beginPath(); g.arc(x, y, r * 0.55, u, u + 2.6); g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.9)'; g.beginPath(); rond(g, x - r * 0.35, y - r * 0.4, r * 0.22); g.fill();
    }
    g.restore();
  },
};

// ── obstacles mobiles (redessinés à chaque image : rester sobre) ──
function feuxPassage(g, o, now, rf) {                 // la locomotive allume les feux du passage à niveau qu'elle approche
  for (let k = 0; k < PASSAGES.length; k++) {
    if (Math.hypot(o.x - PN, o.y - PASSAGES[k]) > 340) continue;
    const on = rf ? 0 : Math.floor(now / 280) % 2;
    for (let s = 0; s < 2; s++) {
      const f = FEUX[k * 2 + s], x = f[0] + (on ? 10 : -10), y = f[1] + 17;
      g.fillStyle = 'rgba(255,60,40,0.35)'; g.beginPath(); rond(g, x, y, 13); g.fill();
      g.fillStyle = '#ff3b2a'; g.beginPath(); rond(g, x, y, 5.5); g.fill();
    }
  }
}
const MOBILES = {
  loco(g, m, o, now, U, rf) {                          // locomotive à vapeur : cabine rouge, chaudière verte, cheminée qui fume
    feuxPassage(g, o, now, rf);
    const ca = Math.cos(o.a), sa = Math.sin(o.a);
    g.save(); g.translate(o.x + 4, o.y + 6); g.rotate(o.a); g.fillStyle = 'rgba(50,25,8,0.3)'; g.beginPath(); rrect(g, -33, -16, 68, 32, 8); g.fill(); g.restore();
    g.save(); g.translate(o.x, o.y); g.rotate(o.a);
    g.fillStyle = '#1e1e22'; g.fillRect(-26, -18, 13, 36); g.fillRect(-2, -18, 13, 36); g.fillRect(15, -18, 11, 36);
    g.fillStyle = '#2b2b30'; g.beginPath(); rrect(g, -32, -14, 64, 28, 4); g.fill();
    g.fillStyle = '#1f6b4a'; g.beginPath(); rrect(g, -8, -11, 38, 22, 10); g.fill();
    g.fillStyle = '#3aa877'; g.fillRect(-6, -6, 34, 4);
    g.fillStyle = '#e8b84a'; g.fillRect(2, -11, 3, 22); g.fillRect(16, -11, 3, 22); g.beginPath(); rond(g, 10, 0, 5); g.fill();
    g.fillStyle = '#111'; g.beginPath(); rond(g, 23, 0, 6); g.fill();
    g.fillStyle = '#d8352a'; g.beginPath(); rrect(g, -33, -15, 26, 30, 5); g.fill(); g.fillRect(28, -14, 5, 28);
    g.fillStyle = '#f0574a'; g.beginPath(); rrect(g, -30, -12, 20, 24, 4); g.fill();
    g.fillStyle = '#fff3a0'; g.beginPath(); rond(g, 34, 0, 3); g.fill();
    g.restore();
    if (!rf) {                                         // trois bouffées de fumée qui s'éloignent derrière la cheminée
      const ph = (now / 380) % 1;
      for (let k = 0; k < 3; k++) {
        const u = (k + ph) / 3, dd = 23 - u * 85, x = o.x + ca * dd - sa * u * 8, y = o.y + sa * dd + ca * u * 8;
        g.fillStyle = 'rgba(255,255,255,' + (0.7 * (1 - u)).toFixed(2) + ')'; g.beginPath(); rond(g, x, y, 6 + u * 12); g.fill();
      }
    }
  },
  wagon(g, m, o) {                                     // n = 1 : voiture de voyageurs bleue ; n = 2 : wagon chargé de briques
    g.save(); g.translate(o.x + 4, o.y + 6); g.rotate(o.a); g.fillStyle = 'rgba(50,25,8,0.3)'; g.beginPath(); rrect(g, -31, -16, 62, 32, 6); g.fill(); g.restore();
    g.save(); g.translate(o.x, o.y); g.rotate(o.a);
    g.fillStyle = '#1e1e22'; g.fillRect(-36, -3, 6, 6); g.fillRect(30, -3, 6, 6); g.fillRect(-22, -17, 12, 34); g.fillRect(10, -17, 12, 34);
    if (m.n === 2) {
      g.fillStyle = '#9c3b26'; g.beginPath(); rrect(g, -31, -15, 62, 30, 4); g.fill();
      g.fillStyle = '#5e2416'; g.fillRect(-26, -10, 52, 20);
      const C = [JOUETS[2], JOUETS[1], JOUETS[3]];
      for (let k = 0; k < 3; k++) { g.fillStyle = C[k][0]; g.fillRect(-25 + k * 17, -9, 15, 18); g.fillStyle = C[k][1]; g.beginPath(); rond(g, -18 + k * 17, -4, 3); rond(g, -18 + k * 17, 4, 3); g.fill(); }
    } else {
      g.fillStyle = '#2f6fc0'; g.beginPath(); rrect(g, -31, -15, 62, 30, 6); g.fill();
      g.fillStyle = '#f2ead8'; g.beginPath(); rrect(g, -27, -11, 54, 22, 9); g.fill();
      g.strokeStyle = 'rgba(120,100,70,0.45)'; g.lineWidth = 2; g.beginPath(); g.moveTo(-20, 0); g.lineTo(20, 0); g.stroke();
      g.fillStyle = '#9fd0f5'; for (let k = 0; k < 4; k++) { g.fillRect(-24 + k * 13, -15, 8, 3); g.fillRect(-24 + k * 13, 12, 8, 3); }
    }
    g.restore();
  },
  robot(g, m, o, now, U, rf) {                         // robot mécanique en fer-blanc qui avance et recule, bras qui battent
    const sw = rf ? 0 : Math.sin(now / 110) * 6;
    g.fillStyle = 'rgba(50,25,8,0.28)'; g.beginPath(); rond(g, o.x + 5, o.y + 7, 21); g.fill();
    g.save(); g.translate(o.x, o.y); g.rotate(o.a);
    g.fillStyle = '#3b3f45'; g.fillRect(-8 + sw, -14, 16, 9); g.fillRect(-8 - sw, 5, 16, 9);
    g.fillStyle = '#9aa5ae'; g.fillRect(-6 - sw, -24, 12, 8); g.fillRect(-6 + sw, 16, 12, 8);
    g.fillStyle = '#c3ccd4'; g.beginPath(); rrect(g, -14, -17, 28, 34, 5); g.fill();
    g.fillStyle = '#e8412f'; g.fillRect(-10, -9, 9, 18); g.fillStyle = '#f4c21f'; g.beginPath(); rond(g, 6, 0, 5); g.fill();
    g.fillStyle = '#e4eaef'; g.beginPath(); rrect(g, 1, -10, 12, 20, 3); g.fill();
    g.fillStyle = '#2f7fd8'; g.beginPath(); rond(g, 11, -5, 2.5); rond(g, 11, 5, 2.5); g.fill();
    g.translate(-16, 0); g.rotate(rf ? 0 : now / 120);
    g.strokeStyle = '#d6b14a'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, -8); g.lineTo(0, 8); g.stroke();
    g.restore();
  },
  balleroule(g, m, o) {                                // grosse balle qui roule jusque sur la piste et repart
    const s = m.r, a = o.x / s;
    g.fillStyle = 'rgba(50,25,8,0.28)'; g.beginPath(); rond(g, o.x + 5, o.y + 8, s); g.fill();
    g.fillStyle = '#ffcf33'; g.beginPath(); rond(g, o.x, o.y, s); g.fill();
    g.fillStyle = '#e8412f'; g.beginPath(); g.moveTo(o.x, o.y); g.arc(o.x, o.y, s, a, a + 1.05); g.closePath(); g.moveTo(o.x, o.y); g.arc(o.x, o.y, s, a + Math.PI, a + Math.PI + 1.05); g.closePath(); g.fill();
    g.fillStyle = '#2f7fd8'; g.beginPath(); rond(g, o.x, o.y, s * 0.3); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.6)'; g.beginPath(); ovale(g, o.x - s * 0.38, o.y - s * 0.42, s * 0.26, s * 0.15); g.fill();
  },
};

export default {
  id: 'chambre', nom: "Chambre d'enfant", emoji: '🧸', sous: 'Dalles en mousse · train électrique, briques, billes',
  w: 3800, h: 2520, surf: 'chambre', edge: 'mur', table: T, W: 105,
  pts: PTS,
  mobs: [
    { type: 'loco', chemin: CHEMIN, r: 24, per: 6.2, dec: 0.06 },                // le train : locomotive devant, deux wagons
    { type: 'wagon', n: 1, chemin: CHEMIN, r: 24, per: 6.2, dec: 0.03 },
    { type: 'wagon', n: 2, chemin: CHEMIN, r: 24, per: 6.2, dec: 0 },
    { type: 'robot', seg: [[1880, 1470], [1880, 1610]], r: 20, per: 7 },         // robot mécanique : du pied du lit jusqu'au milieu de l'oméga
    { type: 'balleroule', seg: [[3655, 1330], [3430, 1330]], r: 22, per: 5.5 },  // balle qui roule depuis le mur jusque sur le côté droit
  ],
  boxes: [0.205, 0.515, 0.79],
  bumpers: ['balle'],
  zonesPhysiques: { moumoute: 'frein', billes: 'glisse' },
  make(H) {
    const c = H.c, T0 = c.table, deco = (x, y, t, v) => c.deco.push([x, y, t, v || 0]);
    // une capsule posée sur la piste à la fraction f, décalage lat, tournée de ang par rapport au sens de course
    const pose = (f, lat, ang, demi, r, type) => { const p = H.at(f, lat), a = Math.atan2(c.ty[p.i], c.tx[p.i]) + ang; H.wall(p.x - Math.cos(a) * demi, p.y - Math.sin(a) * demi, p.x + Math.cos(a) * demi, p.y + Math.sin(a) * demi, r, type); };
    H.wall(T0.x0, T0.y0, T0.x1, T0.y0, 14, 'plinthe'); H.wall(T0.x1, T0.y0, T0.x1, T0.y1, 14, 'plinthe');   // murs de la chambre
    H.wall(T0.x1, T0.y1, T0.x0, T0.y1, 14, 'plinthe'); H.wall(T0.x0, T0.y1, T0.x0, T0.y0, 14, 'plinthe');
    H.wall(1580, 60, 1580, 1280, 12, 'paroi'); H.wall(2180, 60, 2180, 1280, 12, 'paroi'); H.wall(1592, 1290, 2168, 1290, 12, 'paroi');   // lit
    H.wall(2790, 1100, 3050, 1100, 168, 'paroi'); H.wall(3520, 2330, 3620, 2330, 120, 'paroi');              // maison de poupée, coffre
    H.wall(OREILLES[0][0], OREILLES[0][1], OREILLES[0][0], OREILLES[0][1] + 1, 112, 'paroi');                // ours
    H.wall(OREILLES[1][0], OREILLES[1][1], OREILLES[1][0], OREILLES[1][1] + 1, 118, 'paroi');                // tambour
    // turbos : longue ligne droite du tapis (deux) et côté droit
    H.boostAt(0.05); H.boostAt(0.11); H.boostAt(0.225);
    // briques, cubes ABC, balles rebondissantes, petites voitures garées : toujours sur un bord, jamais deux en face
    pose(0.075, 0.62, 0, 32, 16, 'brique'); H.rockAt(0.135, -0.6, 22, 'cube'); H.rockAt(0.175, -0.55, 20, 'balle');
    pose(0.268, -0.62, 0, 22, 18, 'garee');
    pose(0.315, 0.6, 0.3, 32, 16, 'brique'); H.rockAt(0.35, -0.58, 22, 'cube'); pose(0.37, 0.6, -0.4, 32, 16, 'brique');
    H.rockAt(0.445, -0.55, 20, 'balle'); pose(0.48, 0.6, 0, 32, 16, 'brique');
    pose(0.605, -0.62, 0, 22, 18, 'garee'); H.rockAt(0.625, 0.55, 22, 'cube');
    pose(0.675, 0.6, 0.2, 32, 16, 'brique'); H.rockAt(0.7, -0.55, 20, 'balle');
    pose(0.745, 0.6, 0, 32, 16, 'brique'); H.rockAt(0.8, 0.58, 22, 'cube');
    H.rockAt(0.925, 0.6, 20, 'balle'); pose(0.965, -0.62, 0.25, 32, 16, 'brique');
    // tapis moumoute (freine) et billes renversées (glissent) : jamais toute la largeur
    H.zoneAt(0.185, 0.45, 72, 46, 'moumoute'); H.zoneAt(0.53, 0.42, 72, 46, 'moumoute'); H.zoneAt(0.775, -0.42, 72, 46, 'moumoute');
    H.zoneAt(0.41, 0.42, 70, 44, 'billes'); H.zoneAt(0.66, -0.42, 70, 44, 'billes'); H.zoneAt(0.935, -0.42, 70, 44, 'billes');
    // décor
    deco(1880, 670, 'lit'); deco(1320, 190, 'veilleuse'); deco(2560, 150, 'etagere'); deco(OREILLES[0][0], OREILLES[0][1], 'ours'); deco(OREILLES[1][0], OREILLES[1][1], 'tambour');
    deco(3570, 2330, 'coffre'); deco(2920, 1100, 'maisonpoupee'); deco(3010, 1740, 'tours', 0); deco(2330, 1935, 'tours', 1);
    deco(1560, 2390, 'dessins', 0); deco(2420, 2385, 'dessins', 1); deco(2870, 2395, 'chaussons');
    deco(385, 1460, 'gare'); deco(840, 1460, 'sapins'); deco(1340, 1915, 'lapin'); deco(330, 2240, 'xylophone');
    deco(235, 235, 'ballon'); deco(1880, 1925, 'toupie'); deco(1000, 1060, 'abc');
    deco(2700, 745, 'pompiers'); deco(1010, 800, 'dino'); deco(3665, 1580, 'panier'); deco(1440, 330, 'livres');
  },
  dessin: { sol, plateau, piste, bord, final, decor: DECOR, objets: OBJETS, murs: MURS, zones: ZONES, mobiles: MOBILES,
    hors: '#3a2414', traces: 'rgba(70,40,15,0.28)', poussiere: '238,222,196' },
};
