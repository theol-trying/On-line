// Circuit « bain » de Micro Machines — définition PARTAGÉE serveur / client (géométrie, obstacles, zones, décor).
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
// la pièce (1 u ≈ 1 mm) : sol carrelé de 2,56 × 3,55 m, baignoire contre le mur de gauche, lavabo sur colonne dans
// l'anse du mur de droite, WC contre le mur du bas (la piste l'enjambe en oméga), porte en bas à gauche
const T = { x0: 40, y0: 40, x1: 2600, y1: 3590, r: 8 };
// ligne droite le long du tablier de la baignoire (départ, turbos), virage du coin, carreaux du haut (turbo), grande
// courbe autour du tapis de bain (le long du sèche-serviettes), anse autour du lavabo, descente, oméga par-dessus les
// WC, virage du panier à linge et remontée en S vers la baignoire
const PTS = trace(980, 1500, -Math.PI / 2, [
  ['Y', 590], ['A', 330, 90], ['X', 2080], ['A', 260, 90],               // tablier de la baignoire, coin, carreaux du haut
  ['Y', 1000], ['A', 380, 90], ['X', 1650], ['A', 350, -180],            // sèche-serviettes, grande courbe du tapis, anse du lavabo
  ['X', 1960], ['A', 380, 90], ['Y', 2950], ['A', 400, 90],              // sortie de l'anse, descente, coin du bas
  ['X', 1902], ['A', 200, 90], ['A', 352, -180], ['A', 200, 90],         // oméga par-dessus les WC
  ['A', 400, 90], ['Y', 2432], ['A', 291, 90], ['A', 291, -90], ['Y', 1500],   // panier à linge, S vers la baignoire
]);
const BAIN = { x0: 40, y0: 40, x1: 776, y1: 1792 };          // baignoire (rebord compris), contre les murs du haut et de gauche
const LAVABO = [2400, 1730];                                  // vasque sur colonne, adossée au mur de droite (400 × 400)
const WC = [1350, 3330];                                      // cuvette (réservoir contre le mur du bas)
const GRENOUILLE = [2342, 2078, 70];                          // grenouille mécanique : elle tourne en rond au coin de l'anse
const CANARD = [];                                            // canard en plastique : il dérive dans la flaque du coin du bas
for (let k = 0; k < 9; k++) { const u = k / 9 * TAU; CANARD.push([Math.round(2330 + Math.cos(u) * 100 - Math.sin(u) * 22), Math.round(3340 + Math.sin(u) * 62 + Math.cos(u) * 22)]); }


const rond = (g, x, y, r) => { g.moveTo(x + r, y); g.arc(x, y, r, 0, TAU); };
const ovale = (g, x, y, rx, ry) => { g.save(); g.translate(x, y); g.scale(rx, ry); g.moveTo(1, 0); g.arc(0, 0, 1, 0, TAU); g.restore(); };
function rrect(g, x, y, w, h, r) { g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function ombre(g, dx, dy, forme) {                    // ombre douce en deux couches (lumière en haut à gauche) ; forme(g) = silhouette
  g.save(); g.fillStyle = 'rgba(26,48,72,0.1)'; g.translate(dx * 1.8, dy * 1.8); g.beginPath(); forme(g); g.fill(); g.restore();
  g.save(); g.fillStyle = 'rgba(26,48,72,0.18)'; g.translate(dx, dy); g.beginPath(); forme(g); g.fill(); g.restore();
}
function chrome(g, x0, y0, x1, y1) {                  // dégradé chromé (robinetterie, poubelle, barres)
  const gr = g.createLinearGradient(x0, y0, x1, y1);
  gr.addColorStop(0, '#f6f9fb'); gr.addColorStop(0.35, '#a3afba'); gr.addColorStop(0.6, '#eef2f5'); gr.addColorStop(1, '#78848f');
  return gr;
}
function canard(g, x, y, s, a) {                      // canard en plastique vu de dessus (tête vers +x)
  g.save(); g.translate(x, y);
  g.save(); g.translate(4 * s, 6 * s); g.rotate(a); g.fillStyle = 'rgba(26,48,72,0.22)'; g.beginPath(); ovale(g, 0, 0, 27 * s, 18 * s); g.fill(); g.restore();
  g.rotate(a); g.scale(s, s);
  g.fillStyle = '#f2b705'; g.beginPath(); g.moveTo(-19, -7); g.lineTo(-31, -2); g.lineTo(-19, 8); g.closePath(); g.fill();   // queue
  g.fillStyle = '#ffd21f'; g.beginPath(); ovale(g, -3, 0, 23, 16); rond(g, 13, 0, 11); g.fill();
  g.fillStyle = '#ff8a1e'; g.beginPath(); ovale(g, 26, 0, 7, 4.5); g.fill();
  g.strokeStyle = '#e0a000'; g.lineWidth = 2; g.beginPath(); g.moveTo(-13, -9); g.quadraticCurveTo(-1, -14, 5, -6); g.moveTo(-13, 9); g.quadraticCurveTo(-1, 14, 5, 6); g.stroke();   // ailes
  g.fillStyle = '#1d1d1d'; g.beginPath(); rond(g, 17, -6, 2); rond(g, 17, 6, 2); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.55)'; g.beginPath(); ovale(g, -8, -5, 9, 4); rond(g, 10, -4, 3.5); g.fill();
  g.restore();
}

// ── sol : le haut des murs autour de la pièce, le parquet du couloir dans l'embrasure de la porte ──
function sol(g, c) {
  g.fillStyle = '#d6dfe5'; g.fillRect(0, 0, c.w, c.h);
  g.fillStyle = '#aebcc6'; g.fillRect(0, 0, c.w, 6); g.fillRect(0, 0, 6, c.h); g.fillRect(c.w - 6, 0, 6, c.h); g.fillRect(0, c.h - 6, c.w, 6);
  g.fillStyle = '#f4f7f8'; g.fillRect(1000, 4, 760, 34); g.fillStyle = '#9fd0ea'; g.fillRect(1012, 10, 736, 22);      // fenêtre dans le mur du haut
  g.fillStyle = 'rgba(255,255,255,0.6)'; g.fillRect(1030, 13, 300, 5); g.fillStyle = '#f4f7f8'; g.fillRect(1376, 8, 8, 26);
  g.fillStyle = '#b4804c'; g.fillRect(60, T.y1, 780, c.h - T.y1);
  g.strokeStyle = 'rgba(90,50,20,0.45)'; g.lineWidth = 2; g.beginPath(); for (let x = 60; x <= 840; x += 65) { g.moveTo(x, T.y1); g.lineTo(x, c.h); } g.stroke();
}
// ── carrelage : octogones blancs et cabochons bleu marine, lumière de la fenêtre, flaques, empreintes mouillées ──
function plateau(g, c, R, U) {
  const t = c.table, S = 150, a = 44, h = a - 3;
  g.fillStyle = '#c3ced5'; g.fillRect(t.x0, t.y0, t.x1 - t.x0, t.y1 - t.y0);                // joints gris clair
  const oct = (x, y) => { g.moveTo(x + a, y + 2); g.lineTo(x + S - a, y + 2); g.lineTo(x + S - 2, y + a); g.lineTo(x + S - 2, y + S - a); g.lineTo(x + S - a, y + S - 2); g.lineTo(x + a, y + S - 2); g.lineTo(x + 2, y + S - a); g.lineTo(x + 2, y + a); g.closePath(); };
  const cases = [];
  for (let y = t.y0; y < t.y1; y += S) for (let x = t.x0; x < t.x1; x += S) { const v = R(); cases.push(x, y, v < 0.8 ? 0 : v < 0.95 ? 1 : 2); }
  for (let p = 0; p < 3; p++) {                          // octogones : trois blancs à peine différents
    g.fillStyle = ['#f5f8f9', '#e9f0f3', '#dfe9ee'][p]; g.beginPath();
    for (let k = 0; k < cases.length; k += 3) if (cases[k + 2] === p) oct(cases[k], cases[k + 1]);
    g.fill();
  }
  g.fillStyle = '#2b5f8c'; g.beginPath();                  // cabochons aux coins
  for (let y = t.y0; y <= t.y1; y += S) for (let x = t.x0; x <= t.x1; x += S) { g.moveTo(x, y - h); g.lineTo(x + h, y); g.lineTo(x, y + h); g.lineTo(x - h, y); g.closePath(); }
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.28)'; g.beginPath();
  for (let y = t.y0; y <= t.y1; y += S) for (let x = t.x0; x <= t.x1; x += S) { g.moveTo(x - 6, y - h + 12); g.lineTo(x + 6, y - h + 12); g.lineTo(x, y - h + 4); g.closePath(); }
  g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 3; g.beginPath();   // reflets d'émail
  for (let k = 0; k < cases.length; k += 3) if ((k / 3) % 3 === 0) { const x = cases[k], y = cases[k + 1]; g.moveTo(x + a + 4, y + 10); g.lineTo(x + S - a - 10, y + 10); }
  g.stroke();
  // lumière de la fenêtre (en haut à gauche), un peu d'ombre au pied des murs
  let gr = g.createLinearGradient(t.x0, t.y0, t.x1, t.y1); gr.addColorStop(0, 'rgba(255,255,240,0.14)'); gr.addColorStop(0.5, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(20,40,70,0.08)');
  g.fillStyle = gr; g.fillRect(t.x0, t.y0, t.x1 - t.x0, t.y1 - t.y0);
  const bords = [[t.x0, t.y0, t.x0, t.y0 + 70, t.x0, t.y0, t.x1 - t.x0, 70], [t.x0, t.y1, t.x0, t.y1 - 70, t.x0, t.y1 - 70, t.x1 - t.x0, 70],
    [t.x0, t.y0, t.x0 + 70, t.y0, t.x0, t.y0, 70, t.y1 - t.y0], [t.x1, t.y0, t.x1 - 70, t.y0, t.x1 - 70, t.y0, 70, t.y1 - t.y0]];
  for (const b of bords) { gr = g.createLinearGradient(b[0], b[1], b[2], b[3]); gr.addColorStop(0, 'rgba(26,48,72,0.2)'); gr.addColorStop(1, 'rgba(26,48,72,0)'); g.fillStyle = gr; g.fillRect(b[4], b[5], b[6], b[7]); }
  // flaque où dérive le canard, traînée mousseuse sous le sèche-serviettes, gouttes au pied de la baignoire et du lavabo
  U.blob(g, 2330, 3340, 175, 120, 0.3, R, 'rgba(70,150,215,0.3)');
  g.fillStyle = 'rgba(255,255,255,0.45)'; g.beginPath(); ovale(g, 2270, 3290, 60, 16); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.55)'; g.beginPath(); rrect(g, 2370, 742, 160, 36, 18); g.fill();
  g.fillStyle = 'rgba(90,160,215,0.35)'; g.beginPath();
  for (let k = 0; k < 26; k++) rond(g, 800 + R() * 70, 120 + R() * 1640, 3 + R() * 7);
  for (let k = 0; k < 12; k++) rond(g, 2170 + R() * 40, 1500 + R() * 460, 3 + R() * 6);
  g.fill();
  // empreintes de pieds mouillés : de la baignoire vers le tapis de bain
  g.fillStyle = 'rgba(70,130,175,0.2)';
  for (let k = 0; k < 5; k++) {
    const x = 1150 + k * 40, y = 980 - k * 52, s = k % 2 ? 1 : -1;
    g.save(); g.translate(x + s * 16, y); g.rotate(0.65); g.beginPath();
    ovale(g, 0, -10, 15, 30); ovale(g, 0, 26, 12, 15); for (let q = 0; q < 5; q++) rond(g, (q - 2) * 6.5 * s, -46 + Math.abs(q - 1) * 2.5, 4 - q * 0.4);
    g.fill(); g.restore();
  }
}
// ── piste : allée de carreaux de faïence turquoise, frise bleu et blanc sur les bords ──
function piste(g, c, R, U) {
  const W = c.W, n = c.n, ti = W - 15;
  U.centerStroke(g, c, 2 * W + 26, 'rgba(26,60,96,0.14)');
  U.centerStroke(g, c, 2 * W + 12, '#1f4c78');
  U.centerStroke(g, c, 2 * W - 2, '#f6fafb');
  U.centerStroke(g, c, 2 * ti, '#a3dee3');
  const P = (i, o) => [c.sx[i] + c.nx[i] * o, c.sy[i] + c.ny[i] * o], st = 5;
  g.fillStyle = 'rgba(30,150,170,0.2)'; g.beginPath();      // quelques carreaux d'un turquoise plus soutenu
  for (let i = 0; i < n; i += st) for (let k = 0; k < 3; k++) {
    if (R() > 0.15) continue;
    const j = (i + st) % n, o0 = -ti + k * 2 * ti / 3, o1 = o0 + 2 * ti / 3, a = P(i, o0), b = P(i, o1), e = P(j, o1), f = P(j, o0);
    g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.lineTo(e[0], e[1]); g.lineTo(f[0], f[1]); g.closePath();
  }
  g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.4)'; g.lineWidth = 3; g.lineCap = 'round'; g.beginPath();   // reflets de l'émail
  for (let i = 0; i < n; i += st) for (let k = 0; k < 3; k++) {
    if (R() > 0.4) continue;
    const o = -ti + k * 2 * ti / 3 + 9, a = P((i + 1) % n, o), b = P((i + 3) % n, o);
    g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]);
  }
  g.stroke();
  g.strokeStyle = 'rgba(28,104,124,0.32)'; g.lineWidth = 2; g.lineCap = 'butt';            // joints
  for (const o of [-ti / 3, ti / 3]) { U.trackPath(g, c, o); g.stroke(); }
  g.beginPath(); for (let i = 0; i < n; i += st) { const a = P(i, -ti), b = P(i, ti); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); } g.stroke();
  for (const sd of [-1, 1]) {                             // frise : carrés bleus alternés, liseré marine
    g.setLineDash([11, 11]); g.strokeStyle = '#2f73ad'; g.lineWidth = 10; U.trackPath(g, c, (W - 7) * sd); g.stroke(); g.setLineDash([]);
    g.strokeStyle = '#1f4c78'; g.lineWidth = 2.5; U.trackPath(g, c, (ti + 1) * sd); g.stroke();
  }
  for (const z of c.zones) if (z[4] === 'boost') {        // pastilles bleu nuit sous les flèches turbo (lisibles sur le turquoise)
    g.save(); g.translate(z[0], z[1]); g.rotate(z[5]); g.fillStyle = 'rgba(31,76,120,0.88)'; g.beginPath(); rrect(g, -52, -35, 104, 70, 16); g.fill();
    g.strokeStyle = '#ffffff'; g.lineWidth = 2.5; g.stroke(); g.restore();
  }
}
// ── plinthe de faïence blanche tout autour, barre de seuil en laiton devant la porte ──
function bord(g, c) {
  const t = c.table, e = 16, L = t.x1 - t.x0, Hh = t.y1 - t.y0;
  g.fillStyle = 'rgba(26,48,72,0.18)'; g.fillRect(t.x0 + e, t.y0 + e, L - 2 * e, 5); g.fillRect(t.x0 + e, t.y0 + e, 5, Hh - 2 * e);
  g.fillStyle = '#f4f8fa'; g.fillRect(t.x0, t.y0, L, e); g.fillRect(t.x0, t.y1 - e, L, e); g.fillRect(t.x0, t.y0, e, Hh); g.fillRect(t.x1 - e, t.y0, e, Hh);
  g.strokeStyle = 'rgba(120,140,155,0.6)'; g.lineWidth = 2; g.beginPath();
  for (let x = t.x0 + 150; x < t.x1; x += 150) { g.moveTo(x, t.y0); g.lineTo(x, t.y0 + e); g.moveTo(x, t.y1 - e); g.lineTo(x, t.y1); }
  for (let y = t.y0 + 150; y < t.y1; y += 150) { g.moveTo(t.x0, y); g.lineTo(t.x0 + e, y); g.moveTo(t.x1 - e, y); g.lineTo(t.x1, y); }
  g.rect(t.x0 + e, t.y0 + e, L - 2 * e, Hh - 2 * e); g.stroke();
  const gr = g.createLinearGradient(0, t.y1 - 22, 0, t.y1 + 4); gr.addColorStop(0, '#f2d48a'); gr.addColorStop(0.5, '#c79a3a'); gr.addColorStop(1, '#8f6a22');
  g.fillStyle = gr; g.fillRect(60, t.y1 - 20, 780, 24);
  g.strokeStyle = 'rgba(90,60,10,0.5)'; g.lineWidth = 1.5; g.beginPath(); for (let x = 70; x < 840; x += 10) { g.moveTo(x, t.y1 - 16); g.lineTo(x, t.y1); } g.stroke();
}
// bulles de savon qui flottent au-dessus du décor (sous les voitures)
const BULLES = [[520, 300, 30], [610, 420, 17], [300, 1480, 24], [470, 1560, 12], [1500, 560, 20], [1850, 1100, 15], [2300, 1440, 22],
  [1200, 2610, 18], [1720, 2600, 14], [2080, 3060, 24], [300, 3420, 20], [2500, 2200, 16], [1940, 1720, 13], [1450, 3500, 15]];
function final(g) {
  for (const b of BULLES) {
    const x = b[0], y = b[1], r = b[2], gr = g.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
    gr.addColorStop(0, 'rgba(255,255,255,0.05)'); gr.addColorStop(0.72, 'rgba(200,235,255,0.12)'); gr.addColorStop(0.9, 'rgba(255,170,230,0.32)'); gr.addColorStop(1, 'rgba(120,220,255,0.5)');
    g.fillStyle = gr; g.beginPath(); rond(g, x, y, r); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.75)'; g.lineWidth = 2; g.beginPath(); g.arc(x, y, r * 0.7, 3.5, 4.4); g.stroke();
  }
}

// ── décor de la salle de bain (dessiné autour de l'origine ; d = [x, y, type, angle, variante]) ──
const DECOR = {
  baignoire(g, d, R) {                                 // baignoire émaillée : eau turquoise, mousse, robinetterie, planche de bain
    const X = 368, Y = 876;
    ombre(g, 10, 14, q => rrect(q, -X, -Y, 2 * X, 2 * Y, 46));
    let gr = g.createLinearGradient(-X, 0, X, 0); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.85, '#eef3f6'); gr.addColorStop(1, '#cbd8e0');
    g.fillStyle = gr; g.beginPath(); rrect(g, -X, -Y, 2 * X, 2 * Y, 46); g.fill();
    g.strokeStyle = 'rgba(110,140,160,0.55)'; g.lineWidth = 3; g.stroke();
    gr = g.createLinearGradient(-300, 0, 300, 0); gr.addColorStop(0, '#cfdce4'); gr.addColorStop(0.18, '#f4f8fa'); gr.addColorStop(1, '#d9e4ea');
    g.fillStyle = gr; g.beginPath(); rrect(g, -300, -808, 600, 1630, 240); g.fill();
    gr = g.createLinearGradient(0, -770, 0, 790); gr.addColorStop(0, 'rgba(104,200,216,0.94)'); gr.addColorStop(1, 'rgba(58,156,196,0.94)');
    g.fillStyle = gr; g.beginPath(); rrect(g, -272, -772, 544, 1560, 214); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.32)'; g.lineWidth = 3; g.beginPath();   // rides
    for (let k = 0; k < 10; k++) { const y = -680 + k * 80 + R() * 30, x = -200 + R() * 280; g.moveTo(x, y); g.quadraticCurveTo(x + 40, y - 12, x + 80, y); }
    g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.18)'; g.beginPath(); rrect(g, -250, -740, 70, 1200, 35); g.fill();
    // bonde chromée et sa chaînette, côté robinets
    g.strokeStyle = '#c4ccd3'; g.lineWidth = 2; g.setLineDash([4, 3]); g.beginPath(); g.moveTo(0, -700); g.quadraticCurveTo(60, -730, 40, -790); g.stroke(); g.setLineDash([]);
    g.fillStyle = chrome(g, -16, -716, 16, -684); g.beginPath(); rond(g, 0, -700, 16); g.fill();
    // canards qui flottent
    canard(g, -150, -300, 1.4, 0.5); canard(g, 120, -120, 1.05, 2.6); canard(g, 30, -560, 0.75, -0.9);
    // mousse du bain moussant (au pied de la baignoire)
    const M = [];
    for (let k = 0; k < 70; k++) { const y = 120 + Math.sqrt(R()) * 610, x = (R() * 2 - 1) * (y > 560 ? 180 : 240); M.push(x, y, 14 + R() * 28); }
    for (let k = 0; k < 12; k++) M.push(-200 + R() * 400, -480 + R() * 540, 8 + R() * 14);
    g.fillStyle = 'rgba(50,120,160,0.32)'; g.beginPath(); for (let k = 0; k < M.length; k += 3) rond(g, M[k] + 3, M[k + 1] + 5, M[k + 2]); g.fill();
    g.fillStyle = '#fbfdfe'; g.beginPath(); for (let k = 0; k < M.length; k += 3) rond(g, M[k], M[k + 1], M[k + 2]); g.fill();
    g.fillStyle = 'rgba(200,222,234,0.9)'; g.beginPath(); for (let k = 0; k < M.length; k += 3) rond(g, M[k] + M[k + 2] * 0.28, M[k + 1] + M[k + 2] * 0.3, M[k + 2] * 0.5); g.fill();
    g.fillStyle = '#ffffff'; g.beginPath(); for (let k = 0; k < M.length; k += 3) rond(g, M[k] - M[k + 2] * 0.32, M[k + 1] - M[k + 2] * 0.32, M[k + 2] * 0.3); g.fill();
    // planche de bain en bambou, en travers : savon, bougie, éponge naturelle
    ombre(g, 5, 8, q => q.rect(-X + 6, -500, 2 * X - 12, 110));
    g.fillStyle = '#d9b47a'; g.fillRect(-X + 6, -500, 2 * X - 12, 110);
    g.strokeStyle = 'rgba(120,80,30,0.35)'; g.lineWidth = 2; g.beginPath(); for (let k = 1; k < 5; k++) { g.moveTo(-X + 6, -500 + k * 22); g.lineTo(X - 6, -500 + k * 22); } g.stroke();
    g.fillStyle = '#efd6a6'; g.fillRect(-X + 6, -500, 2 * X - 12, 5);
    g.fillStyle = 'rgba(80,50,20,0.25)'; g.beginPath(); rrect(g, -226, -470, 84, 54, 20); g.fill();
    g.fillStyle = '#f6a6c1'; g.beginPath(); rrect(g, -232, -477, 84, 54, 20); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.5)'; g.beginPath(); rrect(g, -220, -469, 50, 13, 6); g.fill();
    g.fillStyle = 'rgba(80,50,20,0.25)'; g.beginPath(); rond(g, 4, -440, 31); g.fill();
    g.fillStyle = '#f8f3e6'; g.beginPath(); rond(g, 0, -445, 30); g.fill(); g.strokeStyle = '#d9cfb8'; g.lineWidth = 3; g.stroke();
    g.fillStyle = 'rgba(255,214,110,0.3)'; g.beginPath(); rond(g, 0, -445, 20); g.fill(); g.fillStyle = '#ffb52e'; g.beginPath(); rond(g, 0, -445, 6); g.fill();
    g.fillStyle = '#e8c06a'; g.beginPath(); for (let k = 0; k < 7; k++) { const u = k * TAU / 7; rond(g, 190 + Math.cos(u) * 22, -445 + Math.sin(u) * 17, 22); } g.fill();
    g.fillStyle = '#b98a3a'; g.beginPath(); for (let k = 0; k < 12; k++) rond(g, 190 + (R() - 0.5) * 60, -445 + (R() - 0.5) * 42, 2.5 + R() * 3); g.fill();
    // robinetterie : bec au-dessus de l'eau, deux croisillons, flexible et douchette posés sur le rebord
    g.lineCap = 'round'; g.strokeStyle = 'rgba(26,48,72,0.25)'; g.lineWidth = 10; g.beginPath(); g.moveTo(158, -834); g.bezierCurveTo(260, -820, 320, -760, 338, -620); g.stroke();
    g.strokeStyle = '#a9b4be'; g.lineWidth = 9; g.beginPath(); g.moveTo(150, -842); g.bezierCurveTo(252, -828, 312, -768, 330, -628); g.stroke();
    g.strokeStyle = '#eef2f5'; g.lineWidth = 3; g.stroke();
    ombre(g, 4, 6, q => { q.rect(-24, -856, 48, 112); rond(q, -84, -842, 23); rond(q, 84, -842, 23); ovale(q, 332, -580, 22, 46); });
    g.fillStyle = chrome(g, -24, 0, 24, 0); g.beginPath(); rrect(g, -24, -856, 48, 112, 20); g.fill();
    g.fillStyle = chrome(g, 310, -620, 354, -540); g.beginPath(); ovale(g, 332, -580, 22, 46); g.fill();
    g.fillStyle = '#7b8792'; g.beginPath(); for (let k = 0; k < 7; k++) rond(g, 332 + (k % 2 ? 7 : -7), -606 + k * 8, 2); g.fill();
    for (const s of [-1, 1]) {
      g.fillStyle = chrome(g, s * 84 - 23, -865, s * 84 + 23, -819); g.beginPath(); rond(g, s * 84, -842, 23); g.fill();
      g.strokeStyle = '#c3ccd4'; g.lineWidth = 8; g.beginPath(); g.moveTo(s * 84 - 18, -842); g.lineTo(s * 84 + 18, -842); g.moveTo(s * 84, -860); g.lineTo(s * 84, -824); g.stroke();
      g.fillStyle = s < 0 ? '#3a8ee6' : '#e8453c'; g.beginPath(); rond(g, s * 84, -842, 6); g.fill();
    }
    g.lineCap = 'butt';
    // serviette rayée sur le rebord, flacons dans le coin
    gr = g.createLinearGradient(266, 0, 378, 0); gr.addColorStop(0, '#8fc3e6'); gr.addColorStop(0.7, '#b7daf2'); gr.addColorStop(1, '#7fb0d6');
    g.fillStyle = 'rgba(26,48,72,0.2)'; g.fillRect(274, 168, 108, 282);
    g.fillStyle = gr; g.fillRect(266, 160, 110, 280); g.fillStyle = 'rgba(255,255,255,0.85)'; g.fillRect(266, 192, 110, 16); g.fillRect(266, 392, 110, 16);
    for (const f of [[-320, 790, 20, '#f7b0c8'], [-322, 738, 16, '#a9e2cf'], [-280, 822, 15, '#c9b8f4']]) {
      g.fillStyle = 'rgba(26,48,72,0.22)'; g.beginPath(); rond(g, f[0] + 4, f[1] + 6, f[2]); g.fill();
      g.fillStyle = f[3]; g.beginPath(); rond(g, f[0], f[1], f[2]); g.fill(); g.fillStyle = '#ffffff'; g.beginPath(); rond(g, f[0], f[1], f[2] * 0.45); g.fill();
    }
  },
  lavabo(g, d, R) {                                    // lavabo sur colonne vu de dessus : vasque, mitigeur, porte-savon, verre à dents
    const forme = q => { q.moveTo(205, -200); q.lineTo(-40, -200); q.bezierCurveTo(-170, -200, -205, -120, -205, 0); q.bezierCurveTo(-205, 120, -170, 200, -40, 200); q.lineTo(205, 200); q.closePath(); };
    ombre(g, 8, 12, forme);
    let gr = g.createLinearGradient(-205, -200, 160, 200); gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, '#d3dfe6');
    g.fillStyle = gr; g.beginPath(); forme(g); g.fill(); g.strokeStyle = 'rgba(110,140,160,0.55)'; g.lineWidth = 3; g.stroke();
    gr = g.createRadialGradient(-70, -50, 20, -30, 0, 160); gr.addColorStop(0, '#fbfdfe'); gr.addColorStop(0.7, '#e1eaf0'); gr.addColorStop(1, '#b6c6d1');
    g.fillStyle = gr; g.beginPath(); ovale(g, -30, 0, 140, 152); g.fill();
    g.fillStyle = chrome(g, -56, -6, -24, 26); g.beginPath(); rond(g, -40, 10, 16); g.fill();
    g.strokeStyle = '#5a6570'; g.lineWidth = 2; g.beginPath(); for (let k = -1; k <= 1; k++) { g.moveTo(-50, 10 + k * 6); g.lineTo(-30, 10 + k * 6); } g.stroke();
    g.fillStyle = 'rgba(90,160,215,0.35)'; g.beginPath(); rond(g, -90, -40, 7); rond(g, -70, 60, 5); rond(g, 20, -80, 6); g.fill();
    ombre(g, 4, 6, q => { rond(q, 150, 0, 26); q.rect(56, -12, 100, 24); q.rect(140, -72, 20, 64); });
    g.fillStyle = chrome(g, 0, -12, 0, 12); g.beginPath(); rrect(g, 56, -12, 104, 24, 12); g.fill();
    g.fillStyle = chrome(g, 124, -26, 176, 26); g.beginPath(); rond(g, 150, 0, 26); g.fill();
    g.fillStyle = chrome(g, 140, 0, 160, 0); g.beginPath(); rrect(g, 140, -72, 20, 64, 9); g.fill();
    g.fillStyle = '#5a6570'; g.beginPath(); rond(g, 62, 0, 5); g.fill();
    g.fillStyle = '#c7d2d9'; g.beginPath(); ovale(g, 150, -140, 42, 32); g.fill();                    // porte-savon
    g.fillStyle = '#9fe0c8'; g.beginPath(); rrect(g, 122, -158, 56, 36, 14); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.5)'; g.beginPath(); rrect(g, 130, -152, 30, 9, 4); g.fill();
    g.lineCap = 'round';                                                                            // verre à dents
    g.strokeStyle = '#ff7aa2'; g.lineWidth = 7; g.beginPath(); g.moveTo(150, 140); g.lineTo(96, 104); g.stroke();
    g.strokeStyle = '#4fb3ff'; g.beginPath(); g.moveTo(150, 140); g.lineTo(104, 182); g.stroke();
    g.fillStyle = 'rgba(190,232,242,0.75)'; g.beginPath(); rond(g, 150, 140, 30); g.fill(); g.strokeStyle = '#86b6c8'; g.lineWidth = 3; g.stroke();
    g.fillStyle = '#ffffff'; g.beginPath(); rrect(g, 84, 94, 22, 13, 4); rrect(g, 92, 182, 22, 13, 4); g.fill();
    g.lineCap = 'butt';
  },
  wc(g) {                                              // WC : cuvette, lunette, abattant relevé, réservoir et double chasse
    const cuv = q => ovale(q, 0, -52, 165, 205), res = q => rrect(q, -195, 86, 390, 172, 26);
    ombre(g, 8, 12, q => { cuv(q); res(q); });
    let gr = g.createRadialGradient(-60, -130, 20, 0, -52, 215); gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, '#cfdbe2');
    g.fillStyle = gr; g.beginPath(); cuv(g); g.fill(); g.strokeStyle = 'rgba(110,140,160,0.55)'; g.lineWidth = 3; g.stroke();
    g.strokeStyle = '#f6f9fb'; g.lineWidth = 36; g.beginPath(); ovale(g, 0, -64, 124, 158); g.stroke();
    g.strokeStyle = 'rgba(110,140,160,0.45)'; g.lineWidth = 2; g.beginPath(); ovale(g, 0, -64, 142, 176); ovale(g, 0, -64, 106, 140); g.stroke();
    gr = g.createRadialGradient(0, -70, 10, 0, -80, 104); gr.addColorStop(0, '#3f8fb4'); gr.addColorStop(0.5, '#8fd0e6'); gr.addColorStop(1, '#e8f2f6');
    g.fillStyle = gr; g.beginPath(); ovale(g, 0, -80, 96, 118); g.fill();
    g.fillStyle = '#f7fafb'; g.beginPath(); rrect(g, -150, 58, 300, 34, 16); g.fill(); g.strokeStyle = 'rgba(110,140,160,0.5)'; g.lineWidth = 2; g.stroke();
    gr = g.createLinearGradient(0, 86, 0, 258); gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, '#d6e0e6');
    g.fillStyle = gr; g.beginPath(); res(g); g.fill(); g.strokeStyle = 'rgba(110,140,160,0.55)'; g.lineWidth = 3; g.stroke();
    g.strokeStyle = 'rgba(110,140,160,0.35)'; g.lineWidth = 2; g.beginPath(); rrect(g, -178, 100, 356, 144, 18); g.stroke();
    g.fillStyle = chrome(g, -26, 146, 26, 198); g.beginPath(); rond(g, 0, 172, 26); g.fill();
    g.strokeStyle = '#7b8792'; g.lineWidth = 2; g.beginPath(); g.moveTo(-8, 150); g.lineTo(-8, 194); g.stroke();
  },
  tapisbain(g, d, R) {                                 // tapis de bain à bouclettes : bordure surpiquée, franges
    g.rotate(d[3] || 0);
    const w = 360, h = 230;
    ombre(g, 3, 5, q => rrect(q, -w, -h, 2 * w, 2 * h, 40));
    g.strokeStyle = '#efeaf9'; g.lineWidth = 4; g.beginPath(); for (let y = -h + 30; y < h - 20; y += 13) { g.moveTo(-w - 22, y); g.lineTo(-w + 10, y); g.moveTo(w - 10, y); g.lineTo(w + 22, y); } g.stroke();
    g.fillStyle = '#a993dc'; g.beginPath(); rrect(g, -w, -h, 2 * w, 2 * h, 40); g.fill();
    g.fillStyle = '#cbbcef'; g.beginPath(); rrect(g, -w + 30, -h + 30, 2 * w - 60, 2 * h - 60, 24); g.fill();
    for (let p = 0; p < 2; p++) {
      g.fillStyle = p ? 'rgba(255,255,255,0.35)' : 'rgba(90,60,150,0.2)'; g.beginPath();
      for (let k = 0; k < 380; k++) rond(g, (R() * 2 - 1) * (w - 10), (R() * 2 - 1) * (h - 10), 3 + R() * 2.5);
      g.fill();
    }
    g.setLineDash([10, 8]); g.strokeStyle = 'rgba(255,255,255,0.75)'; g.lineWidth = 3; g.beginPath(); rrect(g, -w + 15, -h + 15, 2 * w - 30, 2 * h - 30, 30); g.stroke(); g.setLineDash([]);
    g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 5; g.beginPath(); rond(g, -150, -40, 46); rond(g, -70, 40, 30); rond(g, -10, -60, 20); g.stroke();   // bulles brodées
  },
  chaussons(g, d) {                                    // paire de chaussons pelucheux, pompons blancs
    g.rotate(d[3] || 0);
    for (const s of [-1, 1]) {
      g.save(); g.translate(s * 36, s * 12); g.rotate(s * 0.1);
      ombre(g, 3, 5, q => ovale(q, 0, 0, 31, 68));
      g.fillStyle = '#ef9fb3'; g.beginPath(); ovale(g, 0, 0, 31, 68); g.fill();
      g.fillStyle = '#fbe0e7'; g.beginPath(); ovale(g, 0, 22, 20, 38); g.fill();
      g.fillStyle = '#f5b3c4'; g.beginPath(); for (let k = 0; k < 9; k++) rond(g, Math.cos(k * 0.7) * 16, -30 + Math.sin(k * 1.3) * 18, 13); g.fill();
      g.fillStyle = '#ffffff'; g.beginPath(); rond(g, 0, -46, 13); g.fill();
      g.restore();
    }
  },
  radiateur(g) {                                       // sèche-serviettes chromé contre le mur, serviette corail pliée sur la barre
    ombre(g, 6, 9, q => q.rect(-22, -300, 44, 600));
    g.fillStyle = '#9aa6b0'; g.fillRect(14, -280, 30, 16); g.fillRect(14, 264, 30, 16);
    g.fillStyle = chrome(g, -20, 0, 20, 0); g.beginPath(); rrect(g, -20, -300, 40, 600, 16); g.fill();
    g.strokeStyle = 'rgba(80,90,100,0.35)'; g.lineWidth = 1.5; g.beginPath(); for (let y = -270; y < 290; y += 36) { g.moveTo(-20, y); g.lineTo(20, y); } g.stroke();
    ombre(g, 5, 7, q => q.rect(-48, -190, 84, 330));
    const gr = g.createLinearGradient(-48, 0, 36, 0); gr.addColorStop(0, '#e9836c'); gr.addColorStop(0.55, '#f6b3a1'); gr.addColorStop(1, '#de7a63');
    g.fillStyle = gr; g.fillRect(-48, -190, 84, 330);
    g.fillStyle = 'rgba(255,255,255,0.8)'; g.fillRect(-48, -160, 84, 12); g.fillRect(-48, 98, 84, 12);
  },
  panier(g, d, R, U) {                                 // panier à linge en osier qui déborde, une chaussette pendue au bord
    const r = 140;
    ombre(g, 8, 12, q => rond(q, 0, 0, r));
    g.fillStyle = '#6f4a22'; g.beginPath(); rond(g, 0, 0, r); g.fill();
    U.blob(g, -30, -20, 78, 58, 0.5, R, '#5b8fd6'); U.blob(g, 40, 30, 66, 52, -0.3, R, '#f4f4f0'); U.blob(g, -40, 55, 50, 34, 0.2, R, '#7cc48a');
    g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 6; g.beginPath(); g.moveTo(-80, -50); g.lineTo(10, -60); g.moveTo(-86, -24); g.lineTo(14, -32); g.moveTo(-76, 2); g.lineTo(6, -4); g.stroke();
    g.strokeStyle = '#d6a466'; g.lineWidth = 16; g.beginPath(); rond(g, 0, 0, r - 8); g.stroke();
    g.strokeStyle = '#9a6a32'; g.lineWidth = 3; g.beginPath(); for (let k = 0; k < 48; k++) { const u = k * TAU / 48; g.moveTo(Math.cos(u) * (r - 16), Math.sin(u) * (r - 16)); g.lineTo(Math.cos(u + 0.06) * r, Math.sin(u + 0.06) * r); } g.stroke();
    g.lineCap = 'round'; g.strokeStyle = 'rgba(26,48,72,0.2)'; g.lineWidth = 22; g.beginPath(); g.moveTo(74, 64); g.lineTo(152, 118); g.stroke();
    g.strokeStyle = '#e0483c'; g.lineWidth = 22; g.beginPath(); g.moveTo(70, 58); g.lineTo(146, 110); g.lineTo(168, 96); g.stroke();
    g.strokeStyle = '#ffffff'; g.lineWidth = 6; g.beginPath(); g.moveTo(82, 54); g.lineTo(66, 76); g.stroke(); g.lineCap = 'butt';
  },
  plante(g, d, R) {                                    // plante verte en pot, feuilles découpées, dans le coin
    const F = [[2.0, 150], [2.6, 140], [3.3, 130], [1.5, 120], [4.0, 110], [0.9, 96], [4.8, 92], [2.3, 92]];
    const feuille = (q, a, l, ox, oy) => { q.save(); q.translate(ox, oy); q.rotate(a); q.moveTo(20, 0); q.quadraticCurveTo(l * 0.5, -l * 0.34, l, 0); q.quadraticCurveTo(l * 0.5, l * 0.34, 20, 0); q.restore(); };
    ombre(g, 8, 12, q => { rond(q, 0, 0, 72); for (const f of F) feuille(q, f[0], f[1], 0, 0); });
    g.fillStyle = '#f1f4f5'; g.beginPath(); rond(g, 0, 0, 72); g.fill(); g.strokeStyle = '#c4ced4'; g.lineWidth = 3; g.stroke();
    g.fillStyle = '#5a3d26'; g.beginPath(); rond(g, 0, 0, 58); g.fill();
    for (let k = 0; k < F.length; k++) {
      const f = F[k]; g.fillStyle = ['#2f7d3a', '#3f9a48', '#58b45c'][k % 3]; g.beginPath(); feuille(g, f[0], f[1], 0, 0); g.fill();
      g.save(); g.rotate(f[0]); g.strokeStyle = 'rgba(220,255,200,0.45)'; g.lineWidth = 2; g.beginPath(); g.moveTo(22, 0); g.lineTo(f[1] - 8, 0);
      for (let q = 0.35; q < 0.9; q += 0.18) { g.moveTo(f[1] * q, 0); g.lineTo(f[1] * (q + 0.1), -f[1] * 0.16); g.moveTo(f[1] * q, 0); g.lineTo(f[1] * (q + 0.1), f[1] * 0.16); }
      g.stroke(); g.restore();
    }
  },
  poubelle(g) {                                        // poubelle à pédale chromée
    ombre(g, 6, 9, q => rond(q, 0, 0, 62));
    g.fillStyle = '#4a525a'; g.beginPath(); rrect(g, -92, -16, 40, 32, 8); g.fill();
    const gr = g.createRadialGradient(-22, -24, 6, 0, 0, 64); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.5, '#b9c3cc'); gr.addColorStop(1, '#6f7a85');
    g.fillStyle = gr; g.beginPath(); rond(g, 0, 0, 62); g.fill();
    g.strokeStyle = 'rgba(60,70,80,0.45)'; g.lineWidth = 2; g.beginPath(); rond(g, 0, 0, 50); g.stroke();
    g.fillStyle = '#5a636c'; g.fillRect(46, -14, 16, 28);
  },
  serviettes(g) {                                      // tabouret de bois et pile de serviettes pliées, une serviette roulée
    ombre(g, 8, 12, q => rrect(q, -130, -130, 260, 260, 26));
    g.fillStyle = '#c99a62'; g.beginPath(); rrect(g, -130, -130, 260, 260, 26); g.fill();
    g.strokeStyle = 'rgba(110,70,30,0.35)'; g.lineWidth = 2; g.beginPath(); for (let k = -78; k < 130; k += 52) { g.moveTo(-130, k); g.lineTo(130, k); } g.stroke();
    const C = [['#f6f8f9', '#d6dfe4'], ['#9fd5e6', '#77b6cc'], ['#f3c7d1', '#d99aab']];
    for (let k = 0; k < 3; k++) {
      const x = -98 + k * 8, y = -86 - k * 8;
      g.fillStyle = 'rgba(26,48,72,0.18)'; g.fillRect(x + 4, y + 6, 180, 150);
      g.fillStyle = C[k][0]; g.beginPath(); rrect(g, x, y, 180, 150, 14); g.fill();
      g.fillStyle = C[k][1]; g.fillRect(x + 150, y + 4, 26, 142);
      g.fillStyle = 'rgba(255,255,255,0.55)'; g.fillRect(x + 8, y + 112, 140, 9);
    }
    g.fillStyle = 'rgba(26,48,72,0.2)'; g.beginPath(); rond(g, 86, 96, 36); g.fill();
    g.fillStyle = '#b9e3cf'; g.beginPath(); rond(g, 82, 90, 36); g.fill();
    g.strokeStyle = '#86c2a6'; g.lineWidth = 3; g.beginPath(); for (let k = 0; k <= 30; k++) { const u = k * 0.6, q = 4 + k, x = 82 + Math.cos(u) * q, y = 90 + Math.sin(u) * q; if (k) g.lineTo(x, y); else g.moveTo(x, y); } g.stroke();
  },
  canards(g, d) {                                      // la famille canard en file indienne
    g.rotate(d[3] || 0);
    canard(g, 70, 0, 1.7, 0);
    for (let k = 0; k < 3; k++) canard(g, -20 - k * 52, k % 2 ? 10 : -8, 0.9, (k % 2 - 0.5) * 0.4);
  },
  tapisrond(g, d, R) {                                 // tapis rond à poils longs, rose et blanc
    ombre(g, 3, 5, q => rond(q, 0, 0, 172));
    g.fillStyle = '#f2b2c6'; g.beginPath(); for (let k = 0; k < 36; k++) { const u = k * TAU / 36; rond(g, Math.cos(u) * 162, Math.sin(u) * 162, 12); } rond(g, 0, 0, 164); g.fill();
    g.fillStyle = '#fbe3ea'; g.beginPath(); rond(g, 0, 0, 124); g.fill();
    g.fillStyle = '#f2b2c6'; g.beginPath(); rond(g, 0, 0, 86); g.fill();
    g.fillStyle = '#fbe3ea'; g.beginPath(); rond(g, 0, 0, 46); g.fill();
    for (let p = 0; p < 2; p++) {
      g.fillStyle = p ? 'rgba(255,255,255,0.4)' : 'rgba(190,90,120,0.18)'; g.beginPath();
      for (let k = 0; k < 260; k++) { const u = R() * TAU, q = Math.sqrt(R()) * 160; rond(g, Math.cos(u) * q, Math.sin(u) * q, 2.5 + R() * 2.5); }
      g.fill();
    }
  },
  pese(g, d) {                                         // pèse-personne en verre : plateau bleuté, écran, patins
    g.rotate(d[3] || 0);
    ombre(g, 5, 8, q => rrect(q, -125, -125, 250, 250, 44));
    const gr = g.createLinearGradient(-125, -125, 125, 125); gr.addColorStop(0, 'rgba(232,246,251,0.95)'); gr.addColorStop(1, 'rgba(170,210,226,0.95)');
    g.fillStyle = gr; g.beginPath(); rrect(g, -125, -125, 250, 250, 44); g.fill(); g.strokeStyle = '#7fa9bb'; g.lineWidth = 3; g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.moveTo(-60, -125); g.lineTo(10, -125); g.lineTo(-125, 10); g.lineTo(-125, -60); g.closePath(); g.fill();
    g.fillStyle = 'rgba(150,185,200,0.5)'; g.beginPath(); ovale(g, -44, 34, 28, 60); ovale(g, 44, 34, 28, 60); g.fill();
    g.fillStyle = '#24303a'; g.beginPath(); rrect(g, -56, -108, 112, 44, 8); g.fill();
    g.fillStyle = '#7df0c8'; g.font = 'bold 30px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('00.0', 0, -85);
  },
  brosse(g) {                                          // balayette des WC dans son pot
    ombre(g, 5, 8, q => rond(q, 0, 0, 46));
    g.fillStyle = '#f4f7f8'; g.beginPath(); rond(g, 0, 0, 46); g.fill(); g.strokeStyle = '#b9c6cd'; g.lineWidth = 3; g.stroke();
    g.fillStyle = '#d3dde3'; g.beginPath(); rond(g, 0, 0, 34); g.fill();
    g.fillStyle = chrome(g, -13, -13, 13, 13); g.beginPath(); rond(g, 0, 0, 13); g.fill();
  },
  rouleaux(g) {                                        // réserve de rouleaux de papier toilette (deux en bas, un dessus)
    for (const p of [[-50, 22, 48], [50, 22, 48], [0, -34, 50]]) {
      ombre(g, 6, 9, q => rond(q, p[0], p[1], p[2]));
      const gr = g.createRadialGradient(p[0] - 14, p[1] - 14, 4, p[0], p[1], p[2]); gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, '#dce2e6');
      g.fillStyle = gr; g.beginPath(); rond(g, p[0], p[1], p[2]); g.fill();
      g.strokeStyle = 'rgba(160,172,182,0.5)'; g.lineWidth = 1.5; g.beginPath(); rond(g, p[0], p[1], p[2] * 0.78); rond(g, p[0], p[1], p[2] * 0.58); g.stroke();
      g.fillStyle = '#c99d68'; g.beginPath(); rond(g, p[0], p[1], 17); g.fill(); g.fillStyle = '#5a3f26'; g.beginPath(); rond(g, p[0], p[1], 12); g.fill();
    }
  },
  sechecheveux(g, d) {                                 // sèche-cheveux oublié par terre, fil en tire-bouchon jusqu'à la fiche
    g.rotate(d[3] || 0); g.lineCap = 'round'; g.lineJoin = 'round';
    const fil = q => { q.moveTo(0, 80); for (let k = 0; k <= 36; k++) { const u = k * 0.55; q.lineTo(-k * 4.5 + Math.cos(u) * 14, 92 + k * 2.2 + Math.sin(u) * 14); } };
    g.save(); g.translate(4, 6); g.strokeStyle = 'rgba(26,48,72,0.2)'; g.lineWidth = 6; g.beginPath(); fil(g); g.stroke(); g.restore();
    g.strokeStyle = '#4a4f57'; g.lineWidth = 5; g.beginPath(); fil(g); g.stroke();
    g.fillStyle = '#e9edf0'; g.beginPath(); rrect(g, -186, 156, 34, 26, 7); g.fill(); g.fillStyle = '#9aa6b0'; g.fillRect(-200, 161, 14, 4); g.fillRect(-200, 173, 14, 4);
    ombre(g, 6, 9, q => { ovale(q, 20, 0, 70, 44); q.rect(-14, 10, 30, 80); q.rect(80, -26, 46, 52); });
    g.fillStyle = '#9c74c8'; g.beginPath(); rrect(g, 80, -26, 46, 52, 10); g.fill();
    g.fillStyle = '#b48fd8'; g.beginPath(); rrect(g, -14, 10, 30, 82, 13); g.fill();
    const gr = g.createLinearGradient(0, -44, 0, 44); gr.addColorStop(0, '#d7bff0'); gr.addColorStop(1, '#9c74c8');
    g.fillStyle = gr; g.beginPath(); ovale(g, 20, 0, 70, 44); g.fill();
    g.fillStyle = '#5d636c'; g.beginPath(); ovale(g, -42, 0, 12, 32); g.fill();
    g.strokeStyle = '#9aa6b0'; g.lineWidth = 2; g.beginPath(); for (let k = -2; k <= 2; k++) { g.moveTo(-50, k * 10); g.lineTo(-34, k * 10); } g.stroke();
    g.fillStyle = '#ffffff'; g.beginPath(); rond(g, 1, 52, 6); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.45)'; g.beginPath(); ovale(g, 10, -22, 34, 8); g.fill();
    g.lineCap = 'butt'; g.lineJoin = 'miter';
  },
  bateau(g, d) {                                       // voilier en plastique, jouet de bain échoué sur le carrelage
    g.rotate(d[3] || 0);
    const coque = q => { q.moveTo(-70, -24); q.lineTo(46, -24); q.quadraticCurveTo(94, 0, 46, 24); q.lineTo(-70, 24); q.closePath(); };
    ombre(g, 6, 9, coque);
    g.fillStyle = '#e8453c'; g.beginPath(); coque(g); g.fill();
    g.fillStyle = '#f6efe0'; g.beginPath(); g.moveTo(-60, -14); g.lineTo(42, -14); g.quadraticCurveTo(74, 0, 42, 14); g.lineTo(-60, 14); g.closePath(); g.fill();
    g.fillStyle = 'rgba(26,48,72,0.18)'; g.beginPath(); g.moveTo(10, 4); g.quadraticCurveTo(-24, -20, -66, 0); g.lineTo(10, 10); g.fill();
    g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(8, -2); g.quadraticCurveTo(-26, -30, -70, -8); g.lineTo(8, 2); g.closePath(); g.fill();
    g.strokeStyle = '#c9d3da'; g.lineWidth = 1.5; g.stroke();
    g.fillStyle = '#8a5a2a'; g.beginPath(); rond(g, 8, 0, 6); g.fill();
    g.fillStyle = '#2f73ad'; g.beginPath(); g.moveTo(8, -2); g.lineTo(26, -10); g.lineTo(8, -14); g.closePath(); g.fill();
  },
  porte(g) {                                           // porte ouverte rabattue contre le mur : battant laqué, poignée chromée
    ombre(g, 6, 9, q => q.rect(-22, -390, 44, 790));
    g.fillStyle = '#eef2f4'; g.fillRect(-22, -390, 44, 790); g.strokeStyle = '#b5c2ca'; g.lineWidth = 3; g.strokeRect(-22, -390, 44, 790);
    g.strokeStyle = 'rgba(140,160,172,0.5)'; g.lineWidth = 2; g.strokeRect(-10, -370, 20, 750);
    g.lineCap = 'round'; g.strokeStyle = 'rgba(26,48,72,0.25)'; g.lineWidth = 10; g.beginPath(); g.moveTo(26, -334); g.lineTo(74, -334); g.stroke();
    g.strokeStyle = '#c3ccd4'; g.lineWidth = 10; g.beginPath(); g.moveTo(22, -340); g.lineTo(70, -340); g.stroke(); g.lineCap = 'butt';
    g.fillStyle = chrome(g, 10, -352, 34, -328); g.beginPath(); rond(g, 22, -340, 12); g.fill();
  },
};

// ── obstacles posés sur le carrelage ──
const FLACONS = [['#f7a8c4', '#d6708d'], ['#b9a8f2', '#8a74d6'], ['#92dcc2', '#4fae8e'], ['#ffd28c', '#e0a24a']];
const OBJETS = {
  shampoing(g, r) {                                    // flacon de shampoing debout : corps pastel, reflet, bouchon à clapet
    const x = r[0], y = r[1], s = r[2], C = FLACONS[Math.round(x + y) % 4], a = ((x * 7 + y * 3) % 628) / 100;
    ombre(g, 9, 13, q => rond(q, x, y, s * 1.05));
    g.save(); g.translate(x, y); g.rotate(a);
    const gr = g.createLinearGradient(0, -s * 0.75, 0, s * 0.75); gr.addColorStop(0, C[0]); gr.addColorStop(1, C[1]);
    g.fillStyle = gr; g.beginPath(); rrect(g, -s * 1.08, -s * 0.75, s * 2.16, s * 1.5, s * 0.66); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.4)'; g.beginPath(); rrect(g, -s * 0.85, -s * 0.58, s * 1.2, s * 0.32, s * 0.16); g.fill();
    g.fillStyle = '#ffffff'; g.beginPath(); rond(g, s * 0.35, 0, s * 0.48); g.fill(); g.strokeStyle = 'rgba(0,0,0,0.15)'; g.lineWidth = 2; g.stroke();
    g.fillStyle = C[1]; g.beginPath(); rond(g, s * 0.58, 0, s * 0.14); g.fill();
    g.restore();
  },
  rouleau(g, r) {                                      // rouleau de papier toilette debout, une feuille déroulée au sol
    const x = r[0], y = r[1], s = r[2], a = (x + y) % 6;
    g.save(); g.translate(x, y); g.rotate(a);
    g.fillStyle = 'rgba(26,48,72,0.14)'; g.fillRect(s * 0.6 + 3, -s * 0.55 + 4, s * 1.8, s * 1.1);
    g.fillStyle = '#fbfbf8'; g.fillRect(s * 0.6, -s * 0.55, s * 1.8, s * 1.1);
    g.strokeStyle = 'rgba(150,160,170,0.7)'; g.lineWidth = 1.5; g.setLineDash([3, 4]); g.beginPath(); g.moveTo(s * 1.5, -s * 0.55); g.lineTo(s * 1.5, s * 0.55); g.stroke(); g.setLineDash([]);
    g.restore();
    ombre(g, 8, 12, q => rond(q, x, y, s));
    const gr = g.createRadialGradient(x - s * 0.3, y - s * 0.3, s * 0.2, x, y, s); gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, '#dbe1e5');
    g.fillStyle = gr; g.beginPath(); rond(g, x, y, s); g.fill();
    g.strokeStyle = 'rgba(165,176,186,0.55)'; g.lineWidth = 1.2; g.beginPath(); rond(g, x, y, s * 0.82); rond(g, x, y, s * 0.64); g.stroke();
    g.fillStyle = '#c99d68'; g.beginPath(); rond(g, x, y, s * 0.36); g.fill(); g.fillStyle = '#5a3f26'; g.beginPath(); rond(g, x, y, s * 0.26); g.fill();
  },
  timbale(g, r) {                                      // timbale turquoise, deux brosses à dents qui dépassent
    const x = r[0], y = r[1], s = r[2];
    ombre(g, 8, 12, q => rond(q, x, y, s));
    const gr = g.createRadialGradient(x - s * 0.3, y - s * 0.3, 2, x, y, s); gr.addColorStop(0, '#9be6ea'); gr.addColorStop(1, '#3fb0ba');
    g.fillStyle = gr; g.beginPath(); rond(g, x, y, s); g.fill();
    g.fillStyle = '#257c86'; g.beginPath(); rond(g, x, y, s * 0.74); g.fill();
    g.lineCap = 'round';
    for (const b of [[-1.5, -0.9, '#ff6f91'], [1.3, -1.15, '#4fb3ff']]) {
      const ex = x + b[0] * s, ey = y + b[1] * s;
      g.strokeStyle = 'rgba(26,48,72,0.25)'; g.lineWidth = 7; g.beginPath(); g.moveTo(x + 4, y + 6); g.lineTo(ex + 6, ey + 9); g.stroke();
      g.strokeStyle = b[2]; g.lineWidth = 7; g.beginPath(); g.moveTo(x, y); g.lineTo(ex, ey); g.stroke();
      g.fillStyle = '#ffffff'; g.beginPath(); rond(g, ex, ey, 6); g.fill(); g.fillStyle = b[2]; g.beginPath(); rond(g, ex, ey, 2.5); g.fill();
    }
    g.lineCap = 'butt';
    g.strokeStyle = '#b6f0f2'; g.lineWidth = 3; g.beginPath(); rond(g, x, y, s * 0.88); g.stroke();
  },
  eponge(g, r) {                                       // fleur de douche en filet (elle renvoie les voitures)
    const x = r[0], y = r[1], s = r[2];
    ombre(g, 7, 10, q => rond(q, x, y, s));
    for (let l = 0; l < 3; l++) {
      g.fillStyle = ['#e2649a', '#f28db8', '#fbb8d4'][l]; g.beginPath();
      for (let k = 0; k < 11; k++) { const u = k * TAU / 11 + l * 0.3, q = s * (0.58 - l * 0.18); rond(g, x - l * 2 + Math.cos(u) * q, y - l * 2 + Math.sin(u) * q, s * (0.44 - l * 0.07)); }
      g.fill();
    }
    g.strokeStyle = 'rgba(255,255,255,0.45)'; g.lineWidth = 1.2; g.beginPath(); for (let k = 0; k < 6; k++) g.arc(x, y, s * (0.25 + k * 0.12), k, k + 1.6); g.stroke();
    g.strokeStyle = '#e2649a'; g.lineWidth = 3; g.beginPath(); ovale(g, x + s * 0.95, y - s * 0.9, s * 0.32, s * 0.2); g.stroke();
  },
};

// ── zones : flaques d'eau et traînées de savon (on glisse), mousse de bain (on s'enlise) ──
const ZONES = {
  eau(g, z, R, U) {
    g.save(); g.translate(z[0], z[1]); g.rotate(z[5]);
    U.blob(g, 0, 0, z[2], z[3], 0, R, 'rgba(56,138,210,0.42)');
    U.blob(g, 0, 0, z[2] * 0.68, z[3] * 0.66, 0.4, R, 'rgba(110,190,240,0.4)');
    g.fillStyle = 'rgba(255,255,255,0.6)'; g.beginPath(); ovale(g, -z[2] * 0.3, -z[3] * 0.38, z[2] * 0.34, z[3] * 0.14); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 2; g.beginPath(); rond(g, z[2] * 0.25, z[3] * 0.18, 9); rond(g, z[2] * 0.25, z[3] * 0.18, 18); g.stroke();
    g.fillStyle = 'rgba(56,138,210,0.4)'; g.beginPath(); for (let k = 0; k < 7; k++) { const u = R() * TAU, q = 1.1 + R() * 0.35; rond(g, Math.cos(u) * z[2] * q, Math.sin(u) * z[3] * q, 3 + R() * 4); } g.fill();
    g.restore();
  },
  savon(g, z, R, U) {
    g.save(); g.translate(z[0], z[1]); g.rotate(z[5]);
    U.blob(g, 0, 0, z[2], z[3], 0, R, 'rgba(250,250,255,0.6)');
    g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 5; g.lineCap = 'round'; g.beginPath();
    for (let k = -1; k <= 1; k++) { g.moveTo(-z[2] * 0.7, k * z[3] * 0.4); g.quadraticCurveTo(0, k * z[3] * 0.4 - 10, z[2] * 0.65, k * z[3] * 0.35); }
    g.stroke(); g.lineCap = 'butt';
    for (let k = 0; k < 9; k++) {
      const x = (R() * 2 - 1) * z[2] * 0.8, y = (R() * 2 - 1) * z[3] * 0.7, r = 4 + R() * 7;
      g.fillStyle = 'rgba(255,255,255,0.3)'; g.beginPath(); rond(g, x, y, r); g.fill();
      g.strokeStyle = k % 2 ? 'rgba(255,120,200,0.65)' : 'rgba(80,190,255,0.65)'; g.lineWidth = 1.5; g.stroke();
    }
    g.restore();
  },
  mousse(g, z, R) {
    g.save(); g.translate(z[0], z[1]); g.rotate(z[5]);
    const B = [];
    for (let k = 0; k < 34; k++) { const u = R() * TAU, q = Math.sqrt(R()) * 0.82; B.push(Math.cos(u) * z[2] * q, Math.sin(u) * z[3] * q, 8 + R() * 14 * (1 - q * 0.5)); }
    g.fillStyle = 'rgba(50,110,150,0.32)'; g.beginPath(); for (let k = 0; k < B.length; k += 3) rond(g, B[k] + 3, B[k + 1] + 4, B[k + 2]); g.fill();
    g.fillStyle = '#fbfdfe'; g.beginPath(); for (let k = 0; k < B.length; k += 3) rond(g, B[k], B[k + 1], B[k + 2]); g.fill();
    g.fillStyle = 'rgba(196,220,233,0.9)'; g.beginPath(); for (let k = 0; k < B.length; k += 3) rond(g, B[k] + B[k + 2] * 0.3, B[k + 1] + B[k + 2] * 0.3, B[k + 2] * 0.48); g.fill();
    g.fillStyle = '#ffffff'; g.beginPath(); for (let k = 0; k < B.length; k += 3) rond(g, B[k] - B[k + 2] * 0.32, B[k + 1] - B[k + 2] * 0.32, B[k + 2] * 0.3); g.fill();
    g.restore();
  },
};

// ── obstacles mobiles (redessinés à chaque image : rester sobre) ──
const MOBILES = {
  canard(g, m, o, now, U, reduceFx) {                  // canard en plastique qui dérive en dodelinant, rides autour
    if (!reduceFx) { g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 2; g.beginPath(); rond(g, o.x, o.y, 30 + (now / 50) % 18); g.stroke(); }
    canard(g, o.x, o.y, 1.05, o.a + Math.sin(now / 320) * 0.15);
  },
  savonnette(g, m, o, now, U, reduceFx) {              // savonnette rose qui glisse, quelques bulles derrière elle
    if (!reduceFx) { g.fillStyle = 'rgba(255,255,255,0.6)'; g.beginPath(); for (let k = 1; k < 4; k++) rond(g, o.x - o.vx * k * 5 + (k % 2 ? 6 : -6), o.y - o.vy * k * 5, 3 + k); g.fill(); }
    g.save(); g.translate(o.x, o.y); g.rotate(0.15);
    g.fillStyle = 'rgba(26,48,72,0.25)'; g.beginPath(); rrect(g, -20, -10, 46, 30, 13); g.fill();
    g.fillStyle = '#f59fc0'; g.beginPath(); rrect(g, -23, -15, 46, 30, 13); g.fill();
    g.fillStyle = '#fbc4d9'; g.beginPath(); rrect(g, -16, -9, 32, 18, 8); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.6)'; g.beginPath(); rrect(g, -14, -8, 18, 5, 2.5); g.fill();
    g.restore();
  },
  grenouille(g, m, o, now, U, reduceFx) {              // grenouille mécanique à clé qui sautille en rond
    const k = reduceFx ? 1 : 1 + Math.abs(Math.sin(now / 150)) * 0.12;
    g.save(); g.translate(o.x, o.y);
    g.fillStyle = 'rgba(26,48,72,0.25)'; g.beginPath(); rond(g, 5, 7, 19); g.fill();
    g.rotate(o.a); g.scale(k, k);
    g.fillStyle = '#3d9a3a'; g.beginPath(); ovale(g, -12, -15, 13, 6); ovale(g, -12, 15, 13, 6); ovale(g, 10, -13, 7, 4); ovale(g, 10, 13, 7, 4); g.fill();
    g.fillStyle = '#5cc45a'; g.beginPath(); ovale(g, -2, 0, 17, 13); ovale(g, 11, 0, 10, 11); g.fill();
    g.fillStyle = '#3d9a3a'; g.beginPath(); rond(g, -8, -4, 3); rond(g, -3, 6, 2.5); g.fill();
    g.fillStyle = '#ffffff'; g.beginPath(); rond(g, 14, -8, 5); rond(g, 14, 8, 5); g.fill();
    g.fillStyle = '#111111'; g.beginPath(); rond(g, 15.5, -8, 2.5); rond(g, 15.5, 8, 2.5); g.fill();
    g.translate(-6, 0); g.rotate(reduceFx ? 0 : now / 140);                   // clé du remontoir, sur le dos
    g.strokeStyle = '#c3ccd4'; g.lineWidth = 3; g.beginPath(); ovale(g, 0, -8, 4, 6); ovale(g, 0, 8, 4, 6); g.stroke();
    g.restore();
  },
};

export default {
  id: 'bain', nom: 'Salle de bain', emoji: '🛁', sous: 'Carrelage bleu · savon glissant, mousse, canard en plastique',
  w: 2640, h: 3630, surf: 'carrelage', edge: 'mur', table: T, W: 102,
  pts: PTS,
  mobs: [
    { type: 'savonnette', seg: [[2515, 760], [2385, 760]], r: 18, per: 6 },       // glisse du pied du sèche-serviettes sur la descente
    { type: 'grenouille', cer: GRENOUILLE, r: 18, per: 9 },                        // tourne en rond au coin de l'anse
    { type: 'canard', chemin: CANARD, r: 22, per: 22 },                            // dérive dans la flaque du coin du bas
  ],
  boxes: [0.145, 0.555, 0.865],
  bumpers: ['eponge'],
  zonesPhysiques: { eau: 'glisse', savon: 'glisse', mousse: 'frein' },
  make(H) {
    const c = H.c, T0 = c.table, deco = (x, y, t, a, b) => c.deco.push([x, y, t, a, b]);
    H.wall(T0.x0, T0.y0, T0.x1, T0.y0, 16, 'plinthe'); H.wall(T0.x1, T0.y0, T0.x1, T0.y1, 16, 'plinthe');   // murs de la pièce
    H.wall(T0.x1, T0.y1, T0.x0, T0.y1, 16, 'plinthe'); H.wall(T0.x0, T0.y1, T0.x0, T0.y0, 16, 'plinthe');
    H.wall(BAIN.x1 + 6, BAIN.y0 + 20, BAIN.x1 + 6, BAIN.y1 - 6, 12, 'paroi'); H.wall(BAIN.x0 + 20, BAIN.y1 + 2, BAIN.x1 + 2, BAIN.y1 + 2, 12, 'paroi');   // tablier
    H.wall(LAVABO[0] + 20, LAVABO[1], T0.x1 + 40, LAVABO[1], 196, 'paroi');                                      // lavabo
    H.wall(WC[0], WC[1] - 120, WC[0], T0.y1 + 40, 184, 'paroi');                                                // WC
    // turbos : tablier de la baignoire (deux, pour les deux sens) et carreaux du haut
    H.boostAt(0.02); H.boostAt(0.055); H.boostAt(0.16);
    // obstacles : flacons de shampoing, rouleau de papier, timbale à brosses à dents, fleurs de douche qui renvoient
    H.rockAt(0.1, -0.62, 22, 'shampoing'); H.rockAt(0.3, -0.6, 28, 'rouleau'); H.rockAt(0.4, 0.6, 30, 'eponge');
    H.rockAt(0.505, -0.6, 24, 'timbale'); H.rockAt(0.7, 0.6, 22, 'shampoing'); H.rockAt(0.8, -0.6, 30, 'eponge');
    H.rockAt(0.875, 0.55, 22, 'shampoing');
    // zones : flaques d'eau et traînées de savon (on glisse), mousse de bain (on s'enlise) — jamais toute la largeur
    H.zoneAt(0.215, 0.42, 70, 44, 'eau'); H.zoneAt(0.465, 0.4, 72, 40, 'savon'); H.zoneAt(0.585, -0.42, 66, 46, 'mousse');
    H.zoneAt(0.62, 0.4, 72, 46, 'eau'); H.zoneAt(0.72, -0.4, 66, 46, 'mousse'); H.zoneAt(0.925, 0.4, 70, 40, 'savon');
    // décor : baignoire, lavabo, WC, tapis, sèche-serviettes, panier à linge, plante, poubelle, tabouret, canards…
    deco(408, 916, 'baignoire'); deco(LAVABO[0], LAVABO[1], 'lavabo'); deco(WC[0], WC[1], 'wc');
    deco(1660, 820, 'tapisbain', -0.05); deco(1790, 900, 'chaussons', 0.3); deco(2560, 640, 'radiateur');
    deco(690, 2900, 'panier'); deco(2480, 160, 'plante'); deco(2080, 1890, 'poubelle'); deco(250, 2030, 'serviettes');
    deco(1520, 1190, 'canards', -0.5); deco(1350, 2440, 'tapisrond'); deco(2010, 2880, 'pese', 0.2);
    deco(1660, 3490, 'brosse'); deco(1040, 3490, 'rouleaux'); deco(64, 3190, 'porte');
    deco(930, 2560, 'sechecheveux', -0.3); deco(1810, 2400, 'bateau', 0.4);
  },
  dessin: { sol, plateau, piste, bord, final, decor: DECOR, objets: OBJETS, zones: ZONES, mobiles: MOBILES, murs: { paroi() {} },
    hors: '#3d4b57', traces: 'rgba(40,62,84,0.26)', poussiere: '226,240,248' },
};
