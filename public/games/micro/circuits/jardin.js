// Circuit « jardin » de Micro Machines — définition PARTAGÉE serveur / client (géométrie, obstacles, zones, décor).
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
const T = { x0: 70, y0: 70, x1: 3330, y1: 2730, r: 40 };
// allée de jardin qui serpente : terrasse dallée (départ), allée du potager, langue autour du massif de roses, plongée
// le long du bassin et tour de son extrémité, remontée en biais vers la cabane, descente en ventre le long des massifs
const PTS = trace(1300, 2400, 0, [
  ['X', 2400], ['A', 280, -90],                                  // allée dallée de la terrasse (départ), virage du coin
  ['Y', 1420], ['A', 220, -90], ['X', 2260], ['A', 160, 180],    // allée du potager (turbo), langue autour du massif
  ['A', 600, -40], ['A', 300, -50], ['Y', 500], ['A', 260, -90], // grande courbe qui remonte, virage de la serre
  ['X', 2060], ['A', 260, -90], ['A', 800, 25], ['A', 800, -25], // plongée en courbe le long du bassin
  ['Y', 1520], ['A', 300, 180],                                  // grand tour du bout du bassin
  ['A', 1400, -30], ['A', 300, -60], ['A', 300, -90],            // remontée en biais vers la cabane, coin de la cabane
  ['Y', 1110], ['A', 380, -40], ['A', 380, 80], ['A', 380, -40], // descente : ventre autour du massif rond
  ['Y', 2100], ['A', 300, -90], ['X', 1300],
]);
const BASSIN = [[1345, 1290, 150, 220], [1335, 1120, 150, 130], [1325, 970, 135, 190], [1350, 820, 110, 100]];   // bassin : union d'ovales
const CARRES = [[2920, 1080, 'salade'], [3110, 1080, 'chou'], [2920, 1350, 'carotte'], [3110, 1350, 'tomate'],
  [2920, 1620, 'fraise'], [3110, 1620, 'courge'], [2920, 1890, 'poireau'], [3110, 1890, 'salade']];   // potager : carrés 150 × 230
const ARROSEUR = [680, 1560, 150];                            // l'arroseur rotatif du massif (centre, portée du jet)
const TONDEUSE = [];                                          // tondeuse robot : ovale autour du pommier, mord sur la plongée
for (let k = 0; k < 10; k++) { const u = k / 10 * TAU; TONDEUSE.push([Math.round(2060 + Math.cos(u) * 470), Math.round(1650 + Math.sin(u) * 260)]); }
// tuyau d'arrosage : de l'enrouleur, il serpente sur le bord droit de l'allée du potager puis repart dans les carrés
const TUYAU = [[2868, 1992], [2815, 2002], [2765, 1975], [2732, 1918], [2748, 1852], [2772, 1792], [2738, 1732], [2746, 1670], [2800, 1640], [2862, 1640], [2900, 1606]];

const rond = (g, x, y, r) => { g.moveTo(x + r, y); g.arc(x, y, r, 0, TAU); };
function ombre(g, dx, dy, forme) {                    // ombre douce en deux couches (lumière en haut à gauche) ; forme(g) = silhouette
  g.save(); g.fillStyle = 'rgba(24,46,12,0.12)'; g.translate(dx * 1.8, dy * 1.8); g.beginPath(); forme(g); g.fill(); g.restore();
  g.save(); g.fillStyle = 'rgba(24,46,12,0.2)'; g.translate(dx, dy); g.beginPath(); forme(g); g.fill(); g.restore();
}
function feuillage(g, R, x, y, r, n, cols) {          // touffe de feuillage : cercles en couches (sombre → clair, décalés vers la lumière)
  for (let l = 0; l < cols.length; l++) {
    g.fillStyle = cols[l]; g.beginPath(); const s = 1 - l * 0.22, d = l * r * 0.12;
    for (let k = 0; k < n; k++) { const u = k / n * TAU + l, q = r * s * (0.55 + R() * 0.2); rond(g, x - d + Math.cos(u) * q, y - d + Math.sin(u) * q, r * s * (0.42 + R() * 0.12)); }
    rond(g, x - d, y - d, r * s * 0.6); g.fill();
  }
}
function fleur(g, x, y, s, col, coeur) {              // fleur à 5 pétales vue de dessus
  g.fillStyle = col; g.beginPath(); for (let k = 0; k < 5; k++) { const u = k * TAU / 5; rond(g, x + Math.cos(u) * s * 0.55, y + Math.sin(u) * s * 0.55, s * 0.5); } g.fill();
  g.fillStyle = coeur || '#ffd23a'; g.beginPath(); rond(g, x, y, s * 0.35); g.fill();
}
function tournesol(g, x, y, s, a) {                   // tournesol : deux couronnes de pétales, cœur brun grainé
  g.save(); g.translate(x, y); g.rotate(a);
  g.fillStyle = 'rgba(24,46,12,0.22)'; g.beginPath(); rond(g, s * 0.25, s * 0.35, s * 1.15); g.fill();
  for (let l = 0; l < 2; l++) {
    g.fillStyle = l ? '#ffd21f' : '#e8a414'; g.beginPath();
    for (let k = 0; k < 14; k++) {
      const u = (k + l * 0.5) * TAU / 14, cs = Math.cos(u), sn = Math.sin(u), p = (a, b) => [a * cs - b * sn, a * sn + b * cs];
      const p0 = p(s * 0.45, 0), p1 = p(s * 0.8, -s * 0.2), p2 = p(s * (1.1 - l * 0.1), 0), p3 = p(s * 0.8, s * 0.2);
      g.moveTo(p0[0], p0[1]); g.quadraticCurveTo(p1[0], p1[1], p2[0], p2[1]); g.quadraticCurveTo(p3[0], p3[1], p0[0], p0[1]);
    }
    g.fill();
  }
  g.fillStyle = '#5a3412'; g.beginPath(); rond(g, 0, 0, s * 0.52); g.fill();
  g.fillStyle = '#3a200a'; g.beginPath(); for (let k = 0; k < 30; k++) { const u = k * 2.4, q = Math.sqrt(k / 30) * s * 0.46; rond(g, Math.cos(u) * q, Math.sin(u) * q, s * 0.05); } g.fill();
  g.fillStyle = 'rgba(255,220,140,0.25)'; g.beginPath(); rond(g, -s * 0.15, -s * 0.15, s * 0.22); g.fill();
  g.restore();
}
function brins(g, R, x0, y0, w, h, nb, col, lw) {     // brins d'herbe (un seul trait par teinte)
  g.strokeStyle = col; g.lineWidth = lw; g.beginPath();
  for (let k = 0; k < nb; k++) { const x = x0 + R() * w, y = y0 + R() * h, p = (R() - 0.5) * 6; g.moveTo(x, y); g.lineTo(x + p, y - 6 - R() * 5); }
  g.stroke();
}
function rrect(g, x, y, w, h, r) { g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }

// ── sol : le pied de la haie (on n'en voit qu'un liseré) ; pelouse ; allée de gravier ; haie et toit de la maison ──
function sol(g, c) { g.fillStyle = '#26401c'; g.fillRect(0, 0, c.w, c.h); }
function plateau(g, c, R, U) {
  const t = c.table, W = t.x1 - t.x0, H = t.y1 - t.y0;
  g.fillStyle = '#79b44c'; g.fillRect(t.x0, t.y0, W, H);
  g.save(); g.translate(1700, 1400); g.rotate(-0.42); g.fillStyle = 'rgba(255,255,205,0.075)';   // bandes de tonte
  for (let k = -16; k < 16; k += 2) g.fillRect(k * 160, -2600, 160, 5200);
  g.restore();
  for (let k = 0; k < 18; k++) U.blob(g, t.x0 + R() * W, t.y0 + R() * H, 140 + R() * 220, 90 + R() * 150, R() * 3, R, k % 3 ? 'rgba(150,200,90,0.16)' : 'rgba(50,110,30,0.12)');
  brins(g, R, t.x0, t.y0, W, H, 2600, 'rgba(46,104,28,0.38)', 2.2);
  brins(g, R, t.x0, t.y0, W, H, 2200, 'rgba(160,214,104,0.4)', 2);
  g.fillStyle = 'rgba(52,112,36,0.45)'; g.beginPath();                                          // touffes de trèfle
  for (let k = 0; k < 60; k++) { const x = t.x0 + R() * W, y = t.y0 + R() * H; for (let q = 0; q < 3; q++) rond(g, x + Math.cos(q * 2.1) * 6, y + Math.sin(q * 2.1) * 6, 5.5); }
  g.fill();
  g.fillStyle = '#fbfbf2'; g.beginPath(); const P = [];                                          // pâquerettes
  for (let k = 0; k < 260; k++) { const x = t.x0 + R() * W, y = t.y0 + R() * H; P.push(x, y); for (let q = 0; q < 6; q++) rond(g, x + Math.cos(q * 1.05) * 4.5, y + Math.sin(q * 1.05) * 4.5, 2.6); }
  g.fill(); g.fillStyle = '#f5c518'; g.beginPath(); for (let k = 0; k < P.length; k += 2) rond(g, P[k], P[k + 1], 2.2); g.fill();
  // herbe mouillée autour de l'arroseur, rond de tonte autour du pommier
  const gr = g.createRadialGradient(ARROSEUR[0], ARROSEUR[1], 20, ARROSEUR[0], ARROSEUR[1], ARROSEUR[2] + 40);
  gr.addColorStop(0, 'rgba(30,90,40,0.3)'); gr.addColorStop(1, 'rgba(30,90,40,0)'); g.fillStyle = gr; g.beginPath(); rond(g, ARROSEUR[0], ARROSEUR[1], ARROSEUR[2] + 40); g.fill();
  g.strokeStyle = 'rgba(200,236,140,0.16)'; g.lineWidth = 46; g.beginPath(); U.oval(g, 2060, 1650, 470, 260); g.stroke();
  for (const q of [[2330, 1450], [2420, 1960], [600, 1300], [1790, 2020]]) {                       // taupinières
    g.fillStyle = '#5e3d22'; g.beginPath(); U.oval(g, q[0], q[1], 26, 20); g.fill(); g.fillStyle = '#7d5532'; g.beginPath(); U.oval(g, q[0] - 5, q[1] - 5, 15, 11); g.fill();
  }
  // pas japonais de la cabane vers la pergola et le banc
  const pas = []; for (let k = 0; k < 11; k++) pas.push([470 + k * 82, 420 + Math.sin(k * 0.7) * 26 + (k > 7 ? (k - 7) * 30 : 0)]);
  g.fillStyle = 'rgba(24,46,12,0.2)'; g.beginPath(); for (const p of pas) U.oval(g, p[0] + 3, p[1] + 4, 30, 22); g.fill();
  g.fillStyle = '#b9b3a6'; g.beginPath(); for (const p of pas) U.oval(g, p[0], p[1], 30, 22); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.22)'; g.beginPath(); for (const p of pas) U.oval(g, p[0] - 6, p[1] - 5, 16, 9); g.fill();
  // terrasse de la maison : grandes dalles de pierre sous la ligne droite du départ
  g.fillStyle = '#a3977f'; g.fillRect(470, 2470, 2230, 270);
  for (let y = 2470, r = 0; y < 2740; y += 132, r++) for (let x = 470 + (r % 2) * 66; x < 2700; x += 132) {
    g.fillStyle = U.rgbStr(U.mix([222, 212, 192], [196, 184, 162], R())); g.fillRect(x + 3, y + 3, Math.min(126, 2697 - x), 126);
  }
  g.fillStyle = 'rgba(255,255,255,0.12)'; for (let x = 470; x < 2700; x += 132) g.fillRect(x + 3, 2473, Math.min(126, 2697 - x), 5);
  // potager : allées de gravier, carrés surélevés (planches), terre et rangs de légumes
  g.fillStyle = '#d7c7a3'; g.beginPath(); rrect(g, 2885, 1045, 412, 1110, 18); g.fill();
  g.fillStyle = 'rgba(120,100,70,0.35)'; g.beginPath(); for (let k = 0; k < 900; k++) g.rect(2890 + R() * 400, 1050 + R() * 1100, 3, 3); g.fill();
  for (const q of CARRES) carre(g, R, q[0], q[1], q[2]);
  bassin(g, R, U);
}
function carre(g, R, x, y, sorte) {                   // carré potager : cadre de planches, terre, légumes en rangs
  g.fillStyle = 'rgba(40,30,10,0.25)'; g.fillRect(x + 6, y + 8, 150, 230);
  g.fillStyle = '#9a6b3c'; g.fillRect(x, y, 150, 230); g.fillStyle = '#b8844e'; g.fillRect(x, y, 150, 7); g.fillRect(x, y, 7, 230);
  g.fillStyle = '#5a3a20'; g.fillRect(x + 12, y + 12, 126, 206);
  g.fillStyle = 'rgba(30,18,6,0.35)'; g.beginPath(); for (let k = 0; k < 70; k++) g.rect(x + 14 + R() * 120, y + 14 + R() * 200, 3, 3); g.fill();
  for (let r = 0; r < 4; r++) for (let q = 0; q < 3; q++) {
    const px = x + 33 + q * 42 + (r % 2) * 6, py = y + 38 + r * 52;
    if (sorte === 'salade') feuillage(g, R, px, py, 17, 6, ['#4f9a2e', '#7cc449', '#b4e27a']);
    else if (sorte === 'chou') {
      g.fillStyle = '#3f7a6a'; g.beginPath(); rond(g, px, py, 19); g.fill(); g.fillStyle = '#76ab98'; g.beginPath(); rond(g, px - 2, py - 2, 12); g.fill();
      g.strokeStyle = 'rgba(220,240,230,0.5)'; g.lineWidth = 1.5; g.beginPath(); for (let k = 0; k < 5; k++) { const u = k * TAU / 5; g.moveTo(px, py); g.lineTo(px + Math.cos(u) * 17, py + Math.sin(u) * 17); } g.stroke();
    } else if (sorte === 'carotte' || sorte === 'poireau') {
      g.strokeStyle = sorte === 'carotte' ? '#5fae36' : '#6d9f6a'; g.lineWidth = sorte === 'carotte' ? 2.5 : 5; g.beginPath();
      for (let k = 0; k < 5; k++) { const u = -1.2 + k * 0.6; g.moveTo(px, py); g.lineTo(px + Math.cos(u - 1.57) * 18, py + Math.sin(u - 1.57) * 18); } g.stroke();
      if (sorte === 'carotte') { g.fillStyle = '#f08a24'; g.beginPath(); rond(g, px, py + 2, 5); g.fill(); }
    } else if (sorte === 'tomate') {
      feuillage(g, R, px, py, 16, 5, ['#2f6e22', '#4f9a33']); g.fillStyle = '#7a5530'; g.beginPath(); rond(g, px, py, 3.5); g.fill();
      g.fillStyle = '#e2321e'; g.beginPath(); for (let k = 0; k < 3; k++) rond(g, px + (R() - 0.5) * 20, py + (R() - 0.5) * 20, 4.5); g.fill();
    } else if (sorte === 'fraise') {
      feuillage(g, R, px, py, 14, 5, ['#3b8a2c', '#62b043']); g.fillStyle = '#e8203a'; g.beginPath(); rond(g, px + 8, py + 7, 4); rond(g, px - 7, py + 5, 3.5); g.fill();
    } else if (sorte === 'courge' && (r + q) % 2 === 0) {
      feuillage(g, R, px, py, 22, 6, ['#3d7e2a', '#5ea43c']); g.fillStyle = '#f08c1c'; g.beginPath(); rond(g, px + 6, py + 8, 13); g.fill();
      g.strokeStyle = 'rgba(160,70,0,0.6)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(px + 6, py - 5); g.lineTo(px + 6, py + 21); g.stroke();
    }
  }
}
function bassin(g, R, U) {                             // bassin : margelle de galets, eau profonde, nénuphars, carpes koï, roseaux
  const forme = m => { for (const o of BASSIN) U.oval(g, o[0], o[1], o[2] + m, o[3] + m); };
  g.save(); g.translate(5, 8); g.fillStyle = 'rgba(24,46,12,0.25)'; g.beginPath(); forme(22); g.fill(); g.restore();
  g.fillStyle = '#8f897b'; g.beginPath(); forme(20); g.fill();
  for (const o of BASSIN) {                            // galets de la margelle
    const n = Math.round((o[2] + o[3]) * 0.16);
    for (let k = 0; k < n; k++) {
      const u = k / n * TAU, x = o[0] + Math.cos(u) * (o[2] + 10), y = o[1] + Math.sin(u) * (o[3] + 10), r = 9 + R() * 5;
      g.fillStyle = U.rgbStr(U.mix([150, 146, 134], [206, 200, 186], R())); g.beginPath(); U.oval(g, x, y, r, r * 0.8); g.fill();
    }
  }
  const eau = g.createRadialGradient(1330, 1100, 40, 1330, 1100, 420);
  eau.addColorStop(0, '#174a58'); eau.addColorStop(0.6, '#24646f'); eau.addColorStop(1, '#3f8f8c');
  g.fillStyle = eau; g.beginPath(); forme(0); g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 3; g.beginPath();                    // reflets du ciel
  for (const q of [[1300, 1180, 70], [1380, 900, 50], [1330, 1380, 44]]) { g.moveTo(q[0] + q[2], q[1]); g.arc(q[0], q[1], q[2], 0, 1.1); g.moveTo(q[0] + q[2] * 0.6 * Math.cos(3.4), q[1] + q[2] * 0.6 * Math.sin(3.4)); g.arc(q[0], q[1], q[2] * 0.6, 3.4, 4.5); }
  g.stroke();
  const koi = (x, y, a, s) => {                       // carpe koï : corps, nageoire caudale, taches blanches
    g.save(); g.translate(x, y); g.rotate(a);
    g.fillStyle = 'rgba(10,30,36,0.35)'; g.beginPath(); U.oval(g, 4, 6, 22 * s, 8 * s); g.fill();
    g.fillStyle = '#f2782a'; g.beginPath(); U.oval(g, 0, 0, 22 * s, 8 * s); g.moveTo(-18 * s, 0); g.lineTo(-34 * s, -9 * s); g.lineTo(-30 * s, 0); g.lineTo(-34 * s, 9 * s); g.closePath(); g.fill();
    g.fillStyle = '#fff4e6'; g.beginPath(); U.oval(g, 6 * s, -2 * s, 7 * s, 4 * s); U.oval(g, -9 * s, 2 * s, 5 * s, 3 * s); g.fill();
    g.restore();
  };
  koi(1330, 1150, 0.4, 1); koi(1275, 1040, 2.6, 0.85); koi(1395, 1290, -1.3, 0.95);
  for (const q of [[1285, 1260, 24], [1410, 1360, 20], [1255, 1405, 18], [1390, 1010, 22], [1280, 870, 19], [1405, 820, 17], [1425, 1170, 21]]) {   // nénuphars
    g.fillStyle = 'rgba(10,30,36,0.3)'; g.beginPath(); g.moveTo(q[0] + 3, q[1] + 4); g.arc(q[0] + 3, q[1] + 4, q[2], 0.4, TAU - 0.1); g.closePath(); g.fill();
    g.fillStyle = '#4c9a3a'; g.beginPath(); g.moveTo(q[0], q[1]); g.arc(q[0], q[1], q[2], 0.4, TAU - 0.1); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(30,80,20,0.5)'; g.lineWidth = 1.5; g.beginPath(); for (let k = 1; k < 6; k++) { const u = 0.4 + k * 1.0; g.moveTo(q[0], q[1]); g.lineTo(q[0] + Math.cos(u) * q[2] * 0.9, q[1] + Math.sin(u) * q[2] * 0.9); } g.stroke();
  }
  fleur(g, 1390, 1004, 11, '#f7a6c4', '#ffe46a'); fleur(g, 1262, 1400, 9, '#ffffff', '#ffd23a');
  g.fillStyle = '#5ca33a'; g.beginPath(); U.oval(g, 1410, 1352, 9, 7); g.fill();                // grenouille sur son nénuphar
  g.fillStyle = '#7dc44f'; g.beginPath(); rond(g, 1404, 1346, 3.5); rond(g, 1416, 1346, 3.5); g.fill();
  g.fillStyle = '#1a1a1a'; g.beginPath(); rond(g, 1404, 1345, 1.6); rond(g, 1416, 1345, 1.6); g.fill();
  for (const q of [[1205, 1440], [1225, 1470], [1460, 760], [1440, 735]]) {                       // roseaux et massettes
    g.strokeStyle = '#3e7a2a'; g.lineWidth = 3; g.beginPath(); for (let k = 0; k < 7; k++) { const u = -2.6 + k * 0.45; g.moveTo(q[0], q[1]); g.lineTo(q[0] + Math.cos(u) * 34, q[1] + Math.sin(u) * 34); } g.stroke();
    g.fillStyle = '#6a3e1c'; g.beginPath(); for (let k = 1; k < 7; k += 2) { const u = -2.6 + k * 0.45; U.oval(g, q[0] + Math.cos(u) * 32, q[1] + Math.sin(u) * 32, 4, 4); } g.fill();
  }
}
function piste(g, c, R, U) {                           // allée de terre battue et de gravier, pierres de bordure ; dalles sur la terrasse
  const W = c.W, n = c.n;
  g.lineJoin = 'round'; g.lineCap = 'round';
  g.save(); g.translate(4, 7); U.centerStroke(g, c, 2 * W + 22, 'rgba(24,46,12,0.22)'); g.restore();
  U.centerStroke(g, c, 2 * W + 14, '#7e5d38');           // liseré de terre
  U.centerStroke(g, c, 2 * W, '#c8ab7c');                // gravier tassé
  U.centerStroke(g, c, 2 * W - 70, 'rgba(232,212,170,0.35)');
  g.strokeStyle = 'rgba(122,92,52,0.18)'; g.lineWidth = 24; for (const o of [-0.42, 0.42]) { U.trackPath(g, c, o * W); g.stroke(); }   // ornières
  const tons = ['rgba(110,84,52,0.45)', 'rgba(250,240,218,0.6)', 'rgba(160,136,100,0.5)', 'rgba(90,90,86,0.4)'];
  for (let p = 0; p < tons.length; p++) {               // gravillons (un seul remplissage par teinte)
    g.fillStyle = tons[p]; g.beginPath();
    for (let k = 0; k < n * 2.5; k++) { const i = Math.floor(R() * n), o = (R() * 2 - 1) * (W - 3), s = 2 + R() * 3; g.rect(c.sx[i] + c.nx[i] * o, c.sy[i] + c.ny[i] * o, s, s); }
    g.fill();
  }
  // pierres de bordure des deux côtés (ombre, pierre, éclat)
  const B = [];
  for (const sd of [-1, 1]) for (let i = 0; i < n; i += 2) { const o = (W + 6 + R() * 3) * sd; B.push(c.sx[i] + c.nx[i] * o, c.sy[i] + c.ny[i] * o, 7 + R() * 3, R()); }
  g.fillStyle = 'rgba(24,46,12,0.3)'; g.beginPath(); for (let k = 0; k < B.length; k += 4) rond(g, B[k] + 2, B[k + 1] + 3, B[k + 2]); g.fill();
  for (let p = 0; p < 3; p++) { g.fillStyle = ['#9c968a', '#b7b1a3', '#d1cbbd'][p]; g.beginPath(); for (let k = 0; k < B.length; k += 4) if (Math.floor(B[k + 3] * 3) === p) rond(g, B[k], B[k + 1], B[k + 2]); g.fill(); }
  g.fillStyle = 'rgba(255,255,255,0.3)'; g.beginPath(); for (let k = 0; k < B.length; k += 4) rond(g, B[k] - 2, B[k + 1] - 2, B[k + 2] * 0.4); g.fill();
  // allée dallée de la terrasse (la ligne droite du départ) : dalles en quinconce, bordures de briques
  const y0 = 2400 - W, x0 = 660, x1 = 2370, hh = 2 * W / 3;
  g.fillStyle = '#958a76'; g.fillRect(x0, y0, x1 - x0, 2 * W);
  for (let r = 0; r < 3; r++) {
    let x = x0 - (r % 2) * 55;
    while (x < x1) {
      const l = 96 + R() * 46, a = Math.max(x0, x), b = Math.min(x1, x + l);
      if (b - a > 10) { g.fillStyle = U.rgbStr(U.mix([226, 216, 196], [190, 178, 156], R())); g.fillRect(a + 2.5, y0 + r * hh + 2.5, b - a - 5, hh - 5); g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(a + 2.5, y0 + r * hh + 2.5, b - a - 5, 4); }
      x += l;
    }
  }
  for (const y of [y0 - 9, y0 + 2 * W - 1]) for (let x = x0; x < x1; x += 30) { g.fillStyle = 'rgba(40,20,10,0.35)'; g.fillRect(x + 1, y + 2, 28, 10); g.fillStyle = (x / 30) % 3 ? '#b4532f' : '#9c4426'; g.fillRect(x, y, 28, 9); }
}
function bord(g, c, R, U) {                            // haie de charmille sur trois côtés ; en bas, le bord du toit de la maison
  const t = c.table, H = [];
  for (let x = t.x0 - 20; x < t.x1 + 30; x += 34) H.push(x, t.y0 - 6 + R() * 10);
  for (let y = t.y0 + 30; y < t.y1 - 10; y += 34) { H.push(t.x0 - 6 + R() * 10, y); H.push(t.x1 + 6 - R() * 10, y); }
  const cols = ['#1e3a14', '#2e5a1e', '#40782a', '#5c9a3a'];
  g.fillStyle = 'rgba(24,46,12,0.35)'; g.beginPath(); for (let k = 0; k < H.length; k += 2) rond(g, H[k] + 10, H[k + 1] + 14, 46); g.fill();
  for (let l = 0; l < 4; l++) { g.fillStyle = cols[l]; g.beginPath(); for (let k = 0; k < H.length; k += 2) rond(g, H[k] - l * 5 + ((k * 7) % 11) - 5, H[k + 1] - l * 5 + ((k * 13) % 9) - 4, 44 - l * 10); g.fill(); }
  g.fillStyle = 'rgba(190,230,140,0.35)'; g.beginPath(); for (let k = 0; k < H.length; k += 2) rond(g, H[k] - 16, H[k + 1] - 16, 5); g.fill();
  const yt = t.y1 - 6;                                 // toit de la maison (tuiles canal) et gouttière
  g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(0, yt - 12, c.w, 14);
  g.fillStyle = '#a8492a'; g.fillRect(0, yt, c.w, c.h - yt);
  for (let r = 0; r < 3; r++) for (let x = (r % 2) * 22; x < c.w; x += 44) {
    g.fillStyle = r % 2 ? '#c4603a' : '#b5532f'; g.beginPath(); rrect(g, x + 3, yt + 14 + r * 22, 38, 24, 11); g.fill();
    g.fillStyle = 'rgba(255,220,180,0.22)'; g.fillRect(x + 8, yt + 17 + r * 22, 26, 4);
  }
  g.fillStyle = '#9aa0a6'; g.fillRect(0, yt - 4, c.w, 14); g.fillStyle = '#c8ccd0'; g.fillRect(0, yt - 4, c.w, 4);
}
// tuyau d'arrosage : une seule courbe lissée à travers les capsules (au-dessus du décor, comme posé sur l'allée)
function final(g) {
  const courbe = (dx, dy) => {
    g.beginPath(); g.moveTo(TUYAU[0][0] + dx, TUYAU[0][1] + dy);
    for (let k = 1; k < TUYAU.length - 1; k++) { const a = TUYAU[k], b = TUYAU[k + 1]; g.quadraticCurveTo(a[0] + dx, a[1] + dy, (a[0] + b[0]) / 2 + dx, (a[1] + b[1]) / 2 + dy); }
    const z = TUYAU[TUYAU.length - 1]; g.lineTo(z[0] + dx, z[1] + dy);
  };
  g.save(); g.lineCap = 'round'; g.lineJoin = 'round';
  courbe(4, 6); g.strokeStyle = 'rgba(24,46,12,0.3)'; g.lineWidth = 15; g.stroke();
  courbe(0, 0); g.strokeStyle = '#1f6b2a'; g.lineWidth = 15; g.stroke(); g.strokeStyle = '#3aa846'; g.lineWidth = 10; g.stroke();
  courbe(-2, -2.5); g.strokeStyle = 'rgba(210,255,190,0.55)'; g.lineWidth = 3; g.stroke();
  courbe(0, 0); g.strokeStyle = 'rgba(255,210,40,0.55)'; g.lineWidth = 2; g.setLineDash([3, 22]); g.stroke(); g.setLineDash([]);
  const z = TUYAU[TUYAU.length - 1];                    // lance d'arrosage au bout
  g.fillStyle = '#f2b81c'; g.beginPath(); rrect(g, z[0] - 6, z[1] - 16, 16, 30, 5); g.fill(); g.fillStyle = '#2a2a2a'; g.beginPath(); rond(g, z[0] + 2, z[1] - 18, 5); g.fill();
  g.restore();
}

// ── décor du jardin (dessiné autour de l'origine ; d = [x, y, type, angle, variante]) ──
const DECOR = {
  cabane(g, d, R, U) {                                 // cabane de jardin : toit à deux pans en bardeaux, faîtière, gouttière, bûches
    const a = d[3] || 0;
    ombre(g, 10, 14, q => { q.rotate(a); q.rect(-160, -120, 320, 240); });
    g.rotate(a);
    g.fillStyle = '#6e4a2a'; g.fillRect(-160, -120, 320, 240);
    for (let s = 0; s < 2; s++) {                     // deux pans : clair (au soleil) et sombre
      const y0 = s ? 0 : -116, base = s ? [92, 64, 44] : [128, 92, 60];
      for (let r = 0; r < 6; r++) for (let x = -156 + (r % 2) * 16; x < 156; x += 32) { g.fillStyle = U.rgbStr(U.mix(base, [70, 50, 34], R() * 0.35)); g.fillRect(x + 1, y0 + r * 19 + 1, Math.min(30, 156 - x), 18); }
    }
    g.fillStyle = '#4a3220'; g.fillRect(-164, -8, 328, 16); g.fillStyle = 'rgba(255,230,190,0.3)'; g.fillRect(-164, -8, 328, 4);
    g.fillStyle = '#8b9096'; g.fillRect(-162, 116, 324, 8);
    g.fillStyle = '#3a5a7a'; g.beginPath(); rond(g, 150, 150, 26); g.fill(); g.fillStyle = '#6fa0c8'; g.beginPath(); rond(g, 150, 150, 19); g.fill();   // tonnelet d'eau de pluie
    g.fillStyle = '#c88a3a'; g.fillRect(-120, 128, 70, 34); g.fillStyle = '#e0a85a'; g.fillRect(-116, 132, 62, 8);   // bûches
  },
  compost(g, d, R, U) {                                // deux bacs à compost en lattes : épluchures, coquilles ; fourche posée
    const a = d[3] || 0;
    ombre(g, 7, 10, q => { q.rotate(a); q.rect(-140, -66, 280, 132); });
    g.rotate(a);
    for (const cx of [-70, 70]) {
      g.fillStyle = '#9b7444'; g.fillRect(cx - 66, -66, 132, 132);
      g.fillStyle = '#3e2a16'; g.fillRect(cx - 54, -54, 108, 108);
      g.fillStyle = '#5a3e22'; g.beginPath(); for (let k = 0; k < 30; k++) rond(g, cx + (R() - 0.5) * 96, (R() - 0.5) * 96, 5 + R() * 6); g.fill();
      for (const col of ['#f08a24', '#8cc44a', '#f2e6c8', '#c43a2a']) { g.fillStyle = col; g.beginPath(); for (let k = 0; k < 5; k++) U.oval(g, cx + (R() - 0.5) * 90, (R() - 0.5) * 90, 7, 4); g.fill(); }
      g.strokeStyle = '#c99a5e'; g.lineWidth = 4; g.beginPath(); for (let k = -60; k <= 60; k += 20) { g.moveTo(cx - 66, k); g.lineTo(cx - 56, k); g.moveTo(cx + 56, k); g.lineTo(cx + 66, k); } g.stroke();
    }
    g.fillStyle = '#7a3a1a'; g.beginPath(); rrect(g, 150, -40, 14, 80, 6); g.fill();
    g.strokeStyle = '#8a8f96'; g.lineWidth = 3; g.beginPath(); for (let k = -1; k <= 1; k++) { g.moveTo(157 + k * 7, 40); g.lineTo(157 + k * 7, 70); } g.moveTo(147, 40); g.lineTo(167, 40); g.stroke();
  },
  arche(g, d, R, U) {                                  // pergola couverte de rosiers grimpants
    ombre(g, 10, 14, q => { q.rect(-120, -70, 240, 140); });
    g.fillStyle = '#efe6d2'; for (const x of [-110, 100]) g.fillRect(x, -70, 12, 140);
    g.fillStyle = '#d8ccb2'; for (let y = -64; y <= 60; y += 31) g.fillRect(-120, y, 240, 9);
    feuillage(g, R, -70, -10, 52, 7, ['#2c6420', '#3f8a2c', '#5aa83c']); feuillage(g, R, 60, 15, 48, 7, ['#2c6420', '#3f8a2c', '#5aa83c']);
    for (let k = 0; k < 18; k++) fleur(g, (R() - 0.5) * 220, (R() - 0.5) * 110, 7 + R() * 3, k % 3 ? '#e8325a' : '#ff9ab8', '#ffe28a');
  },
  banc(g, d, R, U) {                                   // banc de jardin face au bassin : lattes, accoudoirs en fonte, livre oublié
    const a = d[3] || 0;
    ombre(g, 7, 10, q => { q.rotate(a); q.rect(-112, -36, 224, 72); });
    g.rotate(a);
    g.fillStyle = '#2b2b2e'; g.fillRect(-112, -36, 14, 72); g.fillRect(98, -36, 14, 72);
    for (let k = 0; k < 4; k++) { g.fillStyle = k ? '#b07a44' : '#8e5e30'; g.fillRect(-100, -30 + k * 16, 200, 12); g.fillStyle = 'rgba(255,230,190,0.25)'; g.fillRect(-100, -30 + k * 16, 200, 3); }
    g.fillStyle = '#e8d8b8'; g.beginPath(); rrect(g, 30, -8, 40, 28, 6); g.fill(); g.fillStyle = '#c44a3a'; g.fillRect(34, -4, 32, 4);
  },
  massif(g, d, R, U) {                                 // massif de fleurs : paillis, touffes, fleurs (couleurs selon la variante)
    const a = d[3] || 0, rond_ = d[4] === 'rond', rx = rond_ ? 105 : 230, ry = rond_ ? 105 : 110;
    const C = rond_ ? ['#e8323a', '#ffd23a', '#ff8a2a'] : d[4] === 'lavande' ? ['#8a6ad8', '#a98ae8', '#6a4ab8'] : ['#e8325a', '#ff9ab8', '#ffffff'];
    g.rotate(a);
    g.fillStyle = 'rgba(24,46,12,0.18)'; g.beginPath(); U.oval(g, 6, 9, rx + 12, ry + 12); g.fill();
    g.fillStyle = '#6e4a2c'; g.beginPath(); U.oval(g, 0, 0, rx + 10, ry + 10); g.fill();
    g.fillStyle = '#4e3220'; g.beginPath(); U.oval(g, 0, 0, rx, ry); g.fill();
    g.fillStyle = 'rgba(160,120,80,0.4)'; g.beginPath(); for (let k = 0; k < 60; k++) { const u = R() * TAU, q = Math.sqrt(R()); g.rect(Math.cos(u) * rx * q, Math.sin(u) * ry * q, 4, 2); } g.fill();
    const nb = Math.round(rx * ry / 750);
    for (let k = 0; k < nb; k++) { const u = R() * TAU, q = Math.sqrt(R()) * 0.82; feuillage(g, R, Math.cos(u) * rx * q, Math.sin(u) * ry * q, 17, 5, ['#2f6a22', '#4c9632']); }
    for (let k = 0; k < nb * 2; k++) { const u = R() * TAU, q = Math.sqrt(R()) * 0.85; fleur(g, Math.cos(u) * rx * q, Math.sin(u) * ry * q, 6 + R() * 3, C[k % 3], '#fff2a0'); }
  },
  pommier(g, d, R, U) {                                // pommier : grande ombre, feuillage en couches, pommes (ou fleurs de cerisier)
    const cer = d[4] === 'cerisier', r = cer ? 128 : 150;
    g.fillStyle = 'rgba(24,46,12,0.16)'; g.beginPath(); rond(g, 30, 42, r * 1.05); g.fill();
    g.fillStyle = 'rgba(24,46,12,0.2)'; g.beginPath(); rond(g, 16, 24, r); g.fill();
    feuillage(g, R, 0, 0, r, 9, cer ? ['#2c5a20', '#3a7a2a', '#4e9436', '#6aae48'] : ['#24561a', '#2f6e22', '#428a2e', '#5aa63c']);
    g.fillStyle = 'rgba(200,240,150,0.2)'; g.beginPath(); for (let k = 0; k < 14; k++) rond(g, -r * 0.3 + (R() - 0.5) * r, -r * 0.3 + (R() - 0.5) * r, 10 + R() * 12); g.fill();
    if (cer) { for (let k = 0; k < 40; k++) { const u = R() * TAU, q = Math.sqrt(R()) * r * 0.85; fleur(g, Math.cos(u) * q, Math.sin(u) * q, 6, '#ffc8dc', '#ffffff'); } }
    else {
      g.fillStyle = '#d8281e'; g.beginPath(); for (let k = 0; k < 22; k++) { const u = R() * TAU, q = Math.sqrt(R()) * r * 0.82; rond(g, Math.cos(u) * q, Math.sin(u) * q, 8); } g.fill();
      g.fillStyle = '#c8281e'; g.beginPath(); rond(g, r * 0.9, r * 0.75, 8); rond(g, r * 1.05, r * 0.55, 7); g.fill();   // pommes tombées
    }
  },
  vasque(g, d, R, U) {                                 // bain d'oiseaux : pied de pierre, vasque, eau, mésange, graines
    ombre(g, 8, 12, q => rond(q, 0, 0, 62));
    g.fillStyle = '#a7a196'; g.beginPath(); rond(g, 0, 0, 62); g.fill();
    g.fillStyle = '#c9c3b6'; g.beginPath(); rond(g, -3, -3, 56); g.fill();
    g.fillStyle = '#5aa6c8'; g.beginPath(); rond(g, 0, 0, 44); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 2; g.beginPath(); g.arc(0, 0, 30, 3.6, 4.6); g.moveTo(16 * Math.cos(0.5), 16 * Math.sin(0.5)); g.arc(0, 0, 16, 0.5, 1.4); g.stroke();
    g.save(); g.translate(40, -30); g.rotate(-0.7);   // mésange posée sur le rebord
    g.fillStyle = '#3d6ab0'; g.beginPath(); U.oval(g, -4, 0, 14, 8); g.moveTo(-14, 0); g.lineTo(-26, -5); g.lineTo(-26, 5); g.fill();
    g.fillStyle = '#f2d23a'; g.beginPath(); U.oval(g, 0, 2, 8, 6); g.fill();
    g.fillStyle = '#1a1a1a'; g.beginPath(); rond(g, 9, 0, 5.5); g.fill(); g.fillStyle = '#ffffff'; g.beginPath(); rond(g, 9, 2, 2.5); g.fill();
    g.fillStyle = '#e8a020'; g.beginPath(); g.moveTo(13, -1.5); g.lineTo(18, 0); g.lineTo(13, 1.5); g.fill();
    g.restore();
    g.fillStyle = '#d8c08a'; g.beginPath(); for (let k = 0; k < 14; k++) rond(g, -70 + R() * 30, 40 + R() * 30, 2); g.fill();
  },
  tournesols(g, d, R) {                                // rangée de tournesols (et leurs grandes feuilles)
    for (let k = 0; k < 6; k++) feuillage(g, R, -270 + k * 108, Math.sin(k * 1.7) * 16 + 26, 34, 5, ['#2e6a22', '#4a9432']);
    for (let k = 0; k < 6; k++) tournesol(g, -300 + k * 108, Math.sin(k * 1.7) * 16, 38 + (k % 3) * 5, k * 0.4);
  },
  brouette(g, d, R, U) {                               // brouette verte chargée de terreau et de plants, pelle à côté
    const a = d[3] || 0;
    ombre(g, 8, 12, q => { q.rotate(a); q.moveTo(-70, -50); q.lineTo(70, -38); q.lineTo(70, 38); q.lineTo(-70, 50); q.closePath(); q.rect(66, -9, 46, 18); });
    g.rotate(a);
    g.strokeStyle = '#6a4424'; g.lineWidth = 7; g.lineCap = 'round'; g.beginPath(); g.moveTo(-60, -34); g.lineTo(-130, -40); g.moveTo(-60, 34); g.lineTo(-130, 40); g.stroke();
    g.fillStyle = '#1f1f22'; g.beginPath(); rrect(g, 66, -9, 46, 18, 8); g.fill();
    g.fillStyle = '#2f8a46'; g.beginPath(); g.moveTo(-70, -50); g.lineTo(70, -38); g.lineTo(70, 38); g.lineTo(-70, 50); g.closePath(); g.fill();
    g.fillStyle = '#4a3020'; g.beginPath(); g.moveTo(-58, -38); g.lineTo(58, -28); g.lineTo(58, 28); g.lineTo(-58, 38); g.closePath(); g.fill();
    for (let k = 0; k < 4; k++) feuillage(g, R, -34 + (k % 2) * 50, -14 + (k >> 1) * 30, 15, 5, ['#3f8a2c', '#6cb84a']);
    g.fillStyle = '#9a9ea4'; g.beginPath(); rrect(g, -40, 58, 22, 60, 6); g.fill(); g.fillStyle = '#6a4424'; g.fillRect(-33, 116, 8, 54);
  },
  serre(g, d, R, U) {                                  // serre vitrée : armature alu, vitres, plants de tomates à l'intérieur
    ombre(g, 10, 14, q => q.rect(-150, -220, 300, 440));
    g.fillStyle = '#5a7a4a'; g.fillRect(-150, -220, 300, 440);
    for (let k = 0; k < 10; k++) feuillage(g, R, (k % 2 ? 80 : -80), -180 + Math.floor(k / 2) * 90, 34, 5, ['#2c6a22', '#4c9a34']);
    g.fillStyle = '#e2321e'; g.beginPath(); for (let k = 0; k < 24; k++) rond(g, (R() < 0.5 ? 80 : -80) + (R() - 0.5) * 50, -200 + R() * 400, 5); g.fill();
    g.fillStyle = '#8a6a44'; g.fillRect(-26, -210, 52, 420);
    g.fillStyle = 'rgba(214,236,240,0.26)'; g.fillRect(-150, -220, 150, 440); g.fillStyle = 'rgba(190,220,228,0.16)'; g.fillRect(0, -220, 150, 440);
    g.strokeStyle = '#dfe4e8'; g.lineWidth = 6; g.strokeRect(-150, -220, 300, 440);
    g.lineWidth = 4; g.beginPath(); for (let y = -147; y < 220; y += 73) { g.moveTo(-150, y); g.lineTo(150, y); } g.moveTo(-75, -220); g.lineTo(-75, 220); g.moveTo(75, -220); g.lineTo(75, 220); g.stroke();
    g.strokeStyle = '#f4f6f8'; g.lineWidth = 8; g.beginPath(); g.moveTo(0, -224); g.lineTo(0, 224); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 3; g.beginPath(); for (let k = 0; k < 4; k++) { g.moveTo(-140, -190 + k * 110); g.lineTo(-100, -230 + k * 110); } g.stroke();
  },
  tonneau(g, d, R, U) {                                // récupérateur d'eau de pluie, arrosoir bleu à côté
    ombre(g, 7, 10, q => rond(q, 0, 0, 46));
    g.fillStyle = '#6b4322'; g.beginPath(); rond(g, 0, 0, 46); g.fill();
    g.strokeStyle = '#3a3a3e'; g.lineWidth = 5; g.beginPath(); rond(g, 0, 0, 43); g.stroke();
    g.fillStyle = '#2f6a88'; g.beginPath(); rond(g, 0, 0, 36); g.fill();
    g.fillStyle = '#8a5a30'; g.beginPath(); g.moveTo(-36, 0); g.arc(0, 0, 36, Math.PI, TAU); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 2; g.beginPath(); g.arc(0, 0, 24, 0.4, 1.4); g.stroke();
    g.fillStyle = '#3c8ad0'; g.beginPath(); U.oval(g, 70, 20, 22, 16); g.fill(); g.strokeStyle = '#3c8ad0'; g.lineWidth = 5; g.beginPath(); g.moveTo(80, 10); g.lineTo(110, -6); g.stroke();
  },
  enrouleur(g, d, R, U) {                              // dévidoir du tuyau d'arrosage et robinet sur son piquet
    ombre(g, 6, 9, q => q.rect(-34, -40, 68, 80));
    g.fillStyle = '#2a7a3a'; g.fillRect(-34, -40, 10, 80); g.fillRect(24, -40, 10, 80);
    g.fillStyle = '#1f6b2a'; g.beginPath(); rond(g, 0, 0, 30); g.fill();
    g.strokeStyle = '#3aa846'; g.lineWidth = 4; g.beginPath(); for (let r = 12; r <= 28; r += 6) rond(g, 0, 0, r); g.stroke();
    g.fillStyle = '#f2b81c'; g.beginPath(); rond(g, 0, 0, 8); g.fill();
    g.fillStyle = '#7a5a3a'; g.fillRect(-12, -78, 24, 24); g.fillStyle = '#c0c4c8'; g.beginPath(); rond(g, 0, -66, 9); g.fill(); g.fillStyle = '#d8281e'; g.fillRect(-12, -70, 24, 7);
  },
  transat(g, d, R, U) {                                // chaise longue : cadre de bois, toile rayée, coussin, serviette
    const a = d[3] || 0;
    ombre(g, 8, 12, q => { q.rotate(a); q.rect(-38, -84, 76, 168); });
    g.rotate(a);
    g.fillStyle = '#a8743e'; g.fillRect(-38, -84, 76, 168);
    g.save(); g.beginPath(); g.rect(-30, -78, 60, 156); g.clip();
    for (let k = 0; k < 8; k++) { g.fillStyle = k % 2 ? '#f6f2e6' : (d[4] === 1 ? '#e8743a' : '#2f7ac8'); g.fillRect(-30 + k * 7.5, -78, 7.5, 156); }
    g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(-30, -10, 60, 12); g.restore();
    g.fillStyle = '#fbf6ea'; g.beginPath(); rrect(g, -26, -76, 52, 24, 8); g.fill();
    g.save(); g.rotate(0.15); g.fillStyle = '#e83a6a'; g.fillRect(-20, 20, 40, 46); g.fillStyle = '#ffffff'; g.fillRect(-20, 30, 40, 4); g.fillRect(-20, 50, 40, 4); g.restore();
  },
  parasol(g, d, R, U) {                                // parasol (8 pans crème et rouge), chaises qui dépassent dessous
    g.fillStyle = '#e6e2d8'; for (const u of [0.3, 1.9, 3.5, 5.0]) { g.save(); g.rotate(u); g.fillRect(100, -22, 34, 44); g.restore(); }
    g.fillStyle = 'rgba(24,46,12,0.16)'; g.beginPath(); rond(g, 26, 36, 112); g.fill();
    g.fillStyle = 'rgba(24,46,12,0.2)'; g.beginPath(); rond(g, 14, 20, 108); g.fill();
    for (let k = 0; k < 8; k++) {
      g.fillStyle = k % 2 ? '#f4ecd8' : '#d8382e'; g.beginPath(); g.moveTo(0, 0);
      g.lineTo(Math.cos(k * TAU / 8) * 106, Math.sin(k * TAU / 8) * 106); g.lineTo(Math.cos((k + 1) * TAU / 8) * 106, Math.sin((k + 1) * TAU / 8) * 106); g.closePath(); g.fill();
    }
    g.strokeStyle = 'rgba(0,0,0,0.12)'; g.lineWidth = 2; g.beginPath(); for (let k = 0; k < 8; k++) { g.moveTo(0, 0); g.lineTo(Math.cos(k * TAU / 8) * 106, Math.sin(k * TAU / 8) * 106); } g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.18)'; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, 106, 3.3, 4.6); g.closePath(); g.fill();
    g.fillStyle = '#e8e0cc'; g.beginPath(); rond(g, 0, 0, 10); g.fill(); g.fillStyle = '#b8a888'; g.beginPath(); rond(g, -2, -2, 5); g.fill();
  },
  barbecue(g, d, R, U) {                               // barbecue boule : cuve noire, braises, grille, saucisses, couvercle, pince
    ombre(g, 7, 10, q => rond(q, 0, 0, 52));
    g.fillStyle = '#1e1e22'; g.beginPath(); rond(g, 0, 0, 52); g.fill();
    g.fillStyle = '#5a2a14'; g.beginPath(); rond(g, 0, 0, 42); g.fill();
    g.fillStyle = 'rgba(255,120,30,0.45)'; g.beginPath(); for (let k = 0; k < 9; k++) rond(g, (R() - 0.5) * 50, (R() - 0.5) * 50, 6); g.fill();
    g.strokeStyle = '#a8adb4'; g.lineWidth = 2.5; g.beginPath(); for (let k = -36; k <= 36; k += 9) { const h = Math.sqrt(42 * 42 - k * k); g.moveTo(k, -h); g.lineTo(k, h); } g.stroke();
    g.fillStyle = '#b8582a'; for (let k = 0; k < 3; k++) { g.beginPath(); rrect(g, -22, -18 + k * 14, 40, 9, 4.5); g.fill(); }
    g.fillStyle = '#2a2a2e'; g.beginPath(); rond(g, 74, -30, 30); g.fill(); g.fillStyle = '#d8d8dc'; g.beginPath(); rond(g, 74, -30, 6); g.fill();
    g.strokeStyle = '#b8bcc2'; g.lineWidth = 4; g.beginPath(); g.moveTo(-40, 60); g.lineTo(10, 76); g.moveTo(-40, 66); g.lineTo(10, 78); g.stroke();
  },
  pots(g, d, R, U) {                                   // pots de terre cuite : lavande, buis, géraniums
    const pot = (x, y, r) => { g.fillStyle = 'rgba(24,46,12,0.25)'; g.beginPath(); rond(g, x + 5, y + 7, r); g.fill(); g.fillStyle = '#b8582e'; g.beginPath(); rond(g, x, y, r); g.fill(); g.fillStyle = '#d27448'; g.beginPath(); rond(g, x, y, r - 5); g.fill(); g.fillStyle = '#3e2818'; g.beginPath(); rond(g, x, y, r - 9); g.fill(); };
    pot(-50, -10, 40); pot(40, -30, 32); pot(20, 50, 36);
    g.strokeStyle = '#6a8a5a'; g.lineWidth = 3; g.beginPath(); for (let k = 0; k < 16; k++) { const u = k * TAU / 16; g.moveTo(-50, -10); g.lineTo(-50 + Math.cos(u) * 34, -10 + Math.sin(u) * 34); } g.stroke();
    g.fillStyle = '#8a6ad8'; g.beginPath(); for (let k = 0; k < 16; k++) { const u = k * TAU / 16; rond(g, -50 + Math.cos(u) * 32, -10 + Math.sin(u) * 32, 5); } g.fill();
    feuillage(g, R, 40, -30, 26, 6, ['#1f4a18', '#2f6a22', '#4a8a34']);
    feuillage(g, R, 20, 50, 28, 6, ['#2f6a22', '#4c9632']); for (let k = 0; k < 5; k++) fleur(g, 20 + (R() - 0.5) * 34, 50 + (R() - 0.5) * 34, 7, '#e8283a', '#ffd23a');
  },
  chat(g, d, R, U) {                                   // chat roux endormi en boule (oreilles, queue enroulée, rayures)
    ombre(g, 6, 8, q => rond(q, 0, 0, 38));
    g.fillStyle = '#e48a3a'; g.beginPath(); U.oval(g, 0, 0, 40, 32); g.fill();
    g.strokeStyle = '#e48a3a'; g.lineWidth = 12; g.lineCap = 'round'; g.beginPath(); g.arc(0, 0, 38, 0.2, 1.9); g.stroke();
    g.strokeStyle = '#b8601e'; g.lineWidth = 4; g.beginPath(); for (let k = -2; k <= 2; k++) { g.moveTo(-20 + k * 9, -26); g.quadraticCurveTo(-14 + k * 9, -4, -20 + k * 9, 18); } g.stroke();
    g.fillStyle = '#ec9a4e'; g.beginPath(); rond(g, 22, -12, 18); g.fill();
    g.beginPath(); g.moveTo(14, -26); g.lineTo(18, -40); g.lineTo(26, -28); g.closePath(); g.moveTo(30, -24); g.lineTo(40, -34); g.lineTo(38, -18); g.closePath(); g.fill();
    g.strokeStyle = '#6a3a14'; g.lineWidth = 1.8; g.beginPath(); g.moveTo(18, -12); g.lineTo(24, -11); g.moveTo(28, -8); g.lineTo(33, -6); g.stroke();
  },
  buis(g, d, R) {                                      // boule de buis taillée
    const r = d[4] || 46;
    g.fillStyle = 'rgba(24,46,12,0.16)'; g.beginPath(); rond(g, r * 0.4, r * 0.55, r * 1.05); g.fill();
    g.fillStyle = 'rgba(24,46,12,0.22)'; g.beginPath(); rond(g, r * 0.2, r * 0.3, r); g.fill();
    const gr = g.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r);
    gr.addColorStop(0, '#78b04e'); gr.addColorStop(0.55, '#3c7a2a'); gr.addColorStop(1, '#1f4a16');
    g.fillStyle = gr; g.beginPath(); rond(g, 0, 0, r); g.fill();
    g.fillStyle = 'rgba(160,210,110,0.35)'; g.beginPath(); for (let k = 0; k < 18; k++) { const u = R() * TAU, q = Math.sqrt(R()) * r * 0.85; rond(g, Math.cos(u) * q, Math.sin(u) * q, 2.5); } g.fill();
  },
};

// ── obstacles posés sur l'allée ──
const OBJETS = {
  pot(g, r, R) {                                       // gros pot de terre cuite avec un géranium
    const x = r[0], y = r[1], s = r[2];
    ombre(g, 6, 9, q => rond(q, x, y, s));
    g.fillStyle = '#a84c26'; g.beginPath(); rond(g, x, y, s); g.fill();
    g.fillStyle = '#d27448'; g.beginPath(); rond(g, x, y, s * 0.86); g.fill();
    g.fillStyle = '#3e2818'; g.beginPath(); rond(g, x, y, s * 0.7); g.fill();
    feuillage(g, R, x, y, s * 0.62, 6, ['#2f6a22', '#4c9632', '#6cb84a']);
    for (let k = 0; k < 4; k++) fleur(g, x + Math.cos(k * 1.7) * s * 0.35, y + Math.sin(k * 1.7) * s * 0.35, s * 0.2, '#e8283a', '#ffe46a');
    g.strokeStyle = 'rgba(255,220,190,0.45)'; g.lineWidth = 3; g.beginPath(); g.arc(x, y, s * 0.93, 3.4, 4.6); g.stroke();
  },
  arrosoir(g, r, R, U) {                               // arrosoir vert : cuve, anse, bec et pomme d'arrosage en laiton
    const x = r[0], y = r[1], s = r[2];
    ombre(g, 6, 9, q => { q.translate(x, y); q.rotate(-0.6); U.oval(q, 0, 0, s * 0.95, s * 0.72); q.rect(0, -5, s * 1.4, 10); });
    g.save(); g.translate(x, y); g.rotate(-0.6);
    g.strokeStyle = '#2a7a36'; g.lineWidth = 7; g.lineCap = 'round'; g.beginPath(); g.moveTo(s * 0.5, -2); g.lineTo(s * 1.25, -2); g.stroke();
    g.fillStyle = '#d8a83a'; g.beginPath(); rond(g, s * 1.28, -2, s * 0.24); g.fill(); g.fillStyle = '#7a5a1a'; g.beginPath(); for (let k = 0; k < 5; k++) rond(g, s * 1.28 + Math.cos(k * 1.26) * s * 0.12, -2 + Math.sin(k * 1.26) * s * 0.12, 1.6); g.fill();
    const gr = g.createLinearGradient(0, -s * 0.7, 0, s * 0.7); gr.addColorStop(0, '#7ed36a'); gr.addColorStop(1, '#2a8a3a');
    g.fillStyle = gr; g.beginPath(); U.oval(g, 0, 0, s * 0.95, s * 0.72); g.fill();
    g.fillStyle = '#1f4a5a'; g.beginPath(); U.oval(g, -s * 0.4, 0, s * 0.26, s * 0.22); g.fill();
    g.strokeStyle = '#1f6a2c'; g.lineWidth = 6; g.beginPath(); g.moveTo(-s * 0.05, -s * 0.66); g.quadraticCurveTo(-s * 0.2, 0, -s * 0.05, s * 0.66); g.stroke();
    g.restore();
  },
  nain(g, r, R, U) {                                   // nain de jardin vu de dessus : bonnet rouge pointu, barbe blanche, épaules
    const x = r[0], y = r[1], s = r[2];
    ombre(g, 6, 9, q => rond(q, x, y, s));
    g.fillStyle = '#3a6ab8'; g.beginPath(); U.oval(g, x, y + s * 0.15, s, s * 0.85); g.fill();
    g.fillStyle = '#7a4a22'; g.beginPath(); rond(g, x - s * 0.8, y + s * 0.3, s * 0.22); rond(g, x + s * 0.8, y + s * 0.3, s * 0.22); g.fill();
    g.fillStyle = '#f6f2ea'; g.beginPath(); U.oval(g, x, y + s * 0.55, s * 0.55, s * 0.4); g.fill();
    g.fillStyle = '#f2c8a0'; g.beginPath(); rond(g, x, y + s * 0.3, s * 0.2); g.fill();
    const gr = g.createRadialGradient(x - s * 0.25, y - s * 0.35, 1, x, y - s * 0.1, s * 0.7);
    gr.addColorStop(0, '#ff7a6a'); gr.addColorStop(1, '#b8141a');
    g.fillStyle = gr; g.beginPath(); rond(g, x, y - s * 0.1, s * 0.62); g.fill();
    g.fillStyle = '#ff9a8a'; g.beginPath(); rond(g, x - s * 0.18, y - s * 0.3, s * 0.12); g.fill();
  },
  pierre(g, r, R, U) {                                 // grosse pierre moussue
    const x = r[0], y = r[1], s = r[2], a = R() * 3;
    ombre(g, 6, 9, q => U.oval(q, x, y, s * 1.05, s * 0.9));
    g.save(); g.translate(x, y); g.rotate(a);
    const gr = g.createLinearGradient(-s, -s, s, s); gr.addColorStop(0, '#c4beb2'); gr.addColorStop(1, '#7e786c');
    g.fillStyle = gr; g.beginPath(); U.oval(g, 0, 0, s * 1.05, s * 0.9); g.fill();
    g.fillStyle = 'rgba(80,140,50,0.65)'; g.beginPath(); U.oval(g, s * 0.3, s * 0.35, s * 0.5, s * 0.32); g.fill();
    g.strokeStyle = 'rgba(60,56,50,0.4)'; g.lineWidth = 2; g.beginPath(); g.moveTo(-s * 0.5, -s * 0.2); g.lineTo(0, 0); g.lineTo(s * 0.2, -s * 0.5); g.stroke();
    g.restore();
  },
  ballon(g, r) {                                       // ballon de plage (il renvoie les voitures)
    const x = r[0], y = r[1], s = r[2], C = ['#e8323a', '#f6f2ea', '#2f7ad0', '#f6f2ea', '#f5c518', '#f6f2ea'];
    ombre(g, 6, 9, q => rond(q, x, y, s));
    for (let k = 0; k < 6; k++) { g.fillStyle = C[k]; g.beginPath(); g.moveTo(x, y); g.arc(x, y, s, k * TAU / 6 + 0.3, (k + 1) * TAU / 6 + 0.3); g.closePath(); g.fill(); }
    g.fillStyle = '#ffffff'; g.beginPath(); rond(g, x, y, s * 0.2); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.45)'; g.beginPath(); rond(g, x - s * 0.4, y - s * 0.4, s * 0.25); g.fill();
  },
};

// ── zones : flaques (on glisse), terre fraîchement retournée (on s'enlise) ──
const ZONES = {
  flaque(g, z, R, U) {
    g.save(); g.translate(z[0], z[1]); g.rotate(z[5]);
    U.blob(g, 0, 0, z[2] * 1.08, z[3] * 1.12, 0, R, '#6e5232');
    U.blob(g, 0, 0, z[2] * 0.95, z[3] * 0.95, 0.2, R, '#5d7e8a');
    g.fillStyle = 'rgba(190,226,240,0.45)'; g.beginPath(); U.oval(g, -z[2] * 0.25, -z[3] * 0.25, z[2] * 0.35, z[3] * 0.18); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.45)'; g.lineWidth = 2; g.beginPath(); rond(g, z[2] * 0.25, z[3] * 0.15, 10); rond(g, z[2] * 0.25, z[3] * 0.15, 18); g.stroke();
    g.restore();
  },
  terre(g, z, R, U) {
    g.save(); g.translate(z[0], z[1]); g.rotate(z[5]);
    U.blob(g, 0, 0, z[2], z[3], 0, R, '#4a2e18');
    g.fillStyle = '#6a4426'; g.beginPath(); for (let k = 0; k < 26; k++) { const u = R() * TAU, q = Math.sqrt(R()) * 0.85; rond(g, Math.cos(u) * z[2] * q, Math.sin(u) * z[3] * q, 4 + R() * 6); } g.fill();
    g.fillStyle = 'rgba(160,120,80,0.5)'; g.beginPath(); for (let k = 0; k < 18; k++) { const u = R() * TAU, q = Math.sqrt(R()) * 0.85; rond(g, Math.cos(u) * z[2] * q - 2, Math.sin(u) * z[3] * q - 2, 2.5); } g.fill();
    g.strokeStyle = '#d88a8a'; g.lineWidth = 3; g.lineCap = 'round'; g.beginPath(); g.moveTo(-z[2] * 0.3, z[3] * 0.2); g.quadraticCurveTo(-z[2] * 0.2, z[3] * 0.4, -z[2] * 0.05, z[3] * 0.25); g.stroke();   // ver de terre
    g.restore();
  },
};

// ── obstacles mobiles (redessinés à chaque image : rester sobre) ──
const MOBILES = {
  tondeuse(g, m, o, now, U, reduceFx) {                // tondeuse robot : coque grise et orange, roues, écran, voyant
    g.save(); g.translate(o.x, o.y); g.rotate(o.a);
    g.fillStyle = 'rgba(24,46,12,0.3)'; g.beginPath(); rrect(g, -30, -20, 70, 54, 22); g.fill();
    g.fillStyle = '#1e1e22'; g.fillRect(-26, -30, 22, 8); g.fillRect(-26, 22, 22, 8);
    g.fillStyle = '#5a5e64'; g.beginPath(); rrect(g, -34, -26, 66, 52, 22); g.fill();
    g.fillStyle = '#f07a1a'; g.beginPath(); rrect(g, -26, -20, 52, 40, 18); g.fill();
    g.fillStyle = '#ffa04a'; g.beginPath(); rrect(g, -20, -15, 26, 12, 6); g.fill();
    g.fillStyle = '#26282c'; g.beginPath(); rrect(g, -6, -9, 18, 18, 4); g.fill();
    g.fillStyle = (now / 400 | 0) % 2 ? '#5cff6a' : '#1f8a2a'; g.beginPath(); rond(g, 20, 0, 3.5); g.fill();
    if (!reduceFx) { g.fillStyle = 'rgba(150,210,90,0.8)'; g.beginPath(); for (let k = 0; k < 4; k++) rond(g, -40 - ((now / 60 + k * 9) % 30), ((k * 37) % 30) - 15, 2.5); g.fill(); }
    g.restore();
  },
  escargot(g, m, o, now, U) {                          // escargot : traînée de bave, corps, cornes, coquille en spirale
    const a0 = m.seg[0];
    g.save(); g.strokeStyle = 'rgba(230,240,250,0.35)'; g.lineWidth = 10; g.lineCap = 'round'; g.beginPath(); g.moveTo(a0[0], a0[1]); g.lineTo(o.x, o.y); g.stroke();
    g.translate(o.x, o.y); g.rotate(o.a);
    g.fillStyle = 'rgba(24,46,12,0.3)'; g.beginPath(); U.oval(g, 4, 6, 26, 14); g.fill();
    g.fillStyle = '#c9b08a'; g.beginPath(); U.oval(g, 4, 0, 26, 8); g.fill();
    g.strokeStyle = '#a8906a'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(26, -3); g.lineTo(38, -9); g.moveTo(26, 3); g.lineTo(38, 9); g.stroke();
    g.fillStyle = '#3a2a1a'; g.beginPath(); rond(g, 38, -9, 2.5); rond(g, 38, 9, 2.5); g.fill();
    g.fillStyle = '#8a4e22'; g.beginPath(); rond(g, -4, 0, 16); g.fill();
    g.fillStyle = '#c07a3a'; g.beginPath(); rond(g, -5, -1, 13); g.fill();
    g.strokeStyle = '#5a2e12'; g.lineWidth = 2.5; g.beginPath(); for (let k = 0; k <= 24; k++) { const u = k * 0.5, q = 1 + k * 0.5, x = -5 + Math.cos(u) * q, y = -1 + Math.sin(u) * q; if (k) g.lineTo(x, y); else g.moveTo(x, y); } g.stroke();
    g.restore();
  },
  arroseur(g, m, o, now, U, reduceFx) {                // arroseur rotatif : tête au centre, jet qui balaie, gerbe au bout
    const cx = m.cer[0], cy = m.cer[1], dx = o.x - cx, dy = o.y - cy;
    g.save();
    g.fillStyle = 'rgba(24,46,12,0.3)'; g.beginPath(); rond(g, cx + 3, cy + 5, 14); g.fill();
    g.fillStyle = '#2a2a2e'; g.beginPath(); rond(g, cx, cy, 14); g.fill(); g.fillStyle = '#f2b81c'; g.beginPath(); rond(g, cx, cy, 8); g.fill();
    g.strokeStyle = 'rgba(200,235,255,0.55)'; g.lineWidth = 5; g.lineCap = 'round'; g.beginPath(); g.moveTo(cx, cy); g.quadraticCurveTo(cx + dx * 0.5 - dy * 0.12, cy + dy * 0.5 + dx * 0.12, o.x, o.y); g.stroke();
    if (!reduceFx) { g.fillStyle = 'rgba(210,240,255,0.75)'; g.beginPath(); for (let k = 1; k < 7; k++) { const u = k / 7, w = Math.sin(now / 90 + k) * 6; rond(g, cx + dx * u + w, cy + dy * u - w * 0.5, 2.5); } g.fill(); }
    g.fillStyle = 'rgba(170,220,250,0.45)'; g.beginPath(); rond(g, o.x, o.y, m.r); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 2; g.beginPath(); rond(g, o.x, o.y, m.r * (0.5 + 0.5 * ((now / 300) % 1))); g.stroke();
    g.restore();
  },
};

export default {
  id: 'jardin', nom: 'Jardin', emoji: '🌻', sous: 'Allées du potager · tuyau d\'arrosage, flaques, tondeuse robot',
  w: 3400, h: 2800, surf: 'pelouse', edge: 'mur', table: T, W: 104,
  pts: PTS,
  mobs: [
    { type: 'tondeuse', chemin: TONDEUSE, r: 28, per: 30 },                       // tond autour du pommier, coupe la sortie de la plongée
    { type: 'escargot', seg: [[860, 1385], [1005, 1372]], r: 16, per: 36 },       // sort du massif et mord sur la remontée
    { type: 'arroseur', cer: ARROSEUR, r: 20, per: 7 },                           // le jet balaie le bord du ventre
  ],
  boxes: [0.24, 0.53, 0.795],
  bumpers: ['ballon'],
  zonesPhysiques: { flaque: 'glisse', terre: 'frein' },
  make(H) {
    const c = H.c, T0 = c.table;
    const deco = (x, y, t, a, b) => c.deco.push([x, y, t, a, b]);
    H.wall(T0.x0, T0.y0, T0.x1, T0.y0, 24, 'haie'); H.wall(T0.x1, T0.y0, T0.x1, T0.y1, 24, 'haie');   // haie et mur de la maison
    H.wall(T0.x1, T0.y1, T0.x0, T0.y1, 24, 'haie'); H.wall(T0.x0, T0.y1, T0.x0, T0.y0, 24, 'haie');
    for (let k = 0; k < TUYAU.length - 1; k++) H.wall(TUYAU[k][0], TUYAU[k][1], TUYAU[k + 1][0], TUYAU[k + 1][1], 7, 'tuyau');
    // turbos : allée de la terrasse (dans les deux sens) et allée du potager
    H.boostAt(0.03); H.boostAt(0.97); H.boostAt(0.165);
    // obstacles : pots, arrosoir, nain, pierres moussues, ballon de plage qui renvoie
    H.rockAt(0.075, 0.82, 24, 'pot'); H.rockAt(0.745, 0.6, 24, 'pot');
    H.rockAt(0.315, 0.55, 26, 'arrosoir'); H.rockAt(0.355, 0.55, 22, 'nain');
    H.rockAt(0.415, 0.55, 24, 'pierre'); H.rockAt(0.465, 0.6, 22, 'pierre'); H.rockAt(0.905, 0.6, 24, 'pierre');
    H.rockAt(0.705, 0.5, 22, 'ballon');
    // flaques (bord du bassin, sortie de la langue) et terre retournée (une moitié d'allée)
    H.zoneAt(0.27, -0.4, 62, 42, 'flaque'); H.zoneAt(0.6, 0.45, 70, 44, 'flaque');
    H.zoneAt(0.49, -0.4, 70, 48, 'terre'); H.zoneAt(0.83, -0.42, 70, 48, 'terre');
    // décor : cabane, compost, pergola, banc du bassin, massifs, serre, potager, terrasse
    deco(330, 330, 'cabane', 0.06); deco(790, 280, 'compost', -0.05); deco(1240, 270, 'arche'); deco(1340, 640, 'banc', 0);
    deco(2280, 560, 'massif', -0.25, 'roses'); deco(215, 1620, 'massif', 0, 'rond'); deco(3120, 2580, 'massif', 0.1, 'lavande');
    deco(3090, 430, 'serre'); deco(3200, 880, 'tonneau'); deco(2868, 1992, 'enrouleur');
    deco(2060, 1650, 'pommier'); deco(760, 1880, 'pommier', 0, 'cerisier'); deco(670, 1150, 'vasque');
    deco(950, 2110, 'tournesols'); deco(1730, 2110, 'brouette', -0.4);
    deco(1020, 2625, 'transat', 0.08); deco(1230, 2625, 'transat', -0.05, 1); deco(1720, 2615, 'parasol');
    deco(2080, 2640, 'chat'); deco(2440, 2610, 'barbecue'); deco(560, 2610, 'pots');
    deco(2860, 2460, 'buis', 0, 44); deco(200, 2480, 'buis', 0, 50); deco(2565, 470, 'buis', 0, 36);
  },
  dessin: { sol, plateau, piste, bord, final, decor: DECOR, objets: OBJETS, zones: ZONES, mobiles: MOBILES, murs: { haie() {}, tuyau() {} }, hors: '#1e3416', traces: 'rgba(80,56,28,0.3)', poussiere: '186,164,120' },
};
