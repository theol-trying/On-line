// Circuit « billard » de Micro Machines — définition PARTAGÉE serveur / client (géométrie, obstacles, zones, décor).
// Format : voir l'en-tête de ../shared.js ; dessins propres au circuit (propriété `dessin`) : voir ../rendu.js.

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
      const r = c[1], a = c[2] * Math.PI / 180, s = a > 0 ? 1 : -1, cx = x - Math.sin(h) * r * s, cy = y + Math.cos(h) * r * s;
      const f0 = Math.atan2(y - cy, x - cx), k = Math.max(2, Math.round(r * Math.abs(a) / 80));
      for (let i = 1; i <= k; i++) P.push([cx + Math.cos(f0 + a * i / k) * r, cy + Math.sin(f0 + a * i / k) * r]);
      x = cx + Math.cos(f0 + a) * r; y = cy + Math.sin(f0 + a) * r; h += a;
    }
  }
  P.pop();                                                  // la tortue revient au départ : on ne le garde qu'une fois
  return P.map(p => [Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10]);
}

// table : feutre x 150..3850, y 150..2250 ; poches aux quatre coins et au milieu des grandes bandes ; cadre d'acajou de 62 u
const T = { x0: 150, y0: 150, x1: 3850, y1: 2250, r: 12 }, CADRE = 62, CX = 2000, CY = 1200;
const POCHES = [[T.x0 + 16, T.y0 + 16, 58], [CX, T.y0 + 4, 46], [T.x1 - 16, T.y0 + 16, 58], [T.x0 + 16, T.y1 - 16, 58], [CX, T.y1 - 4, 46], [T.x1 - 16, T.y1 - 16, 58]];
// triangle de billes (ordre d'une casse au jeu de la 8) : la pointe vers l'épingle, sur la mouche
const RACK = [[1], [9, 2], [10, 8, 3], [11, 7, 14, 4], [5, 13, 15, 6, 12]], RACK_X = 3300, RACK_Y = 1212, RACK_R = 26;
const CHEMIN_HAUT = [[2330, 780], [2410, 250], [2560, 232], [2710, 250], [2770, 720], [2550, 880]];   // file de trois billes qui traverse la ligne du haut

// ── petits outils de dessin (décor fixe : peint une fois ; mobiles : à chaque image, donc sobres) ──
const TAU = Math.PI * 2;
// ombre douce portée vers le bas-droite (lampe au-dessus, un peu à gauche), quel que soit l'angle a du repère courant :
// une passe large et pâle puis une serrée plus sombre ; f() trace le contour ; k = hauteur de l'objet
function ombre(g, a, k, f) {
  const c = Math.cos(a), s = Math.sin(a);
  for (let p = 0; p < 2; p++) {
    const ox = (p ? 4 : 9) * k, oy = (p ? 6 : 13) * k;
    g.save(); g.translate(ox * c + oy * s, -ox * s + oy * c); g.fillStyle = p ? 'rgba(0,14,4,0.26)' : 'rgba(0,14,4,0.12)';
    g.beginPath(); f(); g.fill(); g.restore();
  }
}
function lin(g, x0, y0, x1, y1, stops) { const gr = g.createLinearGradient(x0, y0, x1, y1); for (let i = 0; i < stops.length; i++) gr.addColorStop(i / (stops.length - 1), stops[i]); return gr; }
function disque(g, x, y, r, col) { g.fillStyle = col; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }
function cercle(g, x, y, r, lw, col) { g.strokeStyle = col; g.lineWidth = lw; g.beginPath(); g.arc(x, y, r, 0, TAU); g.stroke(); }
// couleurs des billes : 1 à 8 pleines, 9 à 15 rayées (même couleur que n − 8), 0 = la blanche
const BOULE = ['#f4f1e6', '#f2b705', '#1d4fb8', '#d42a20', '#5a2d91', '#f06c12', '#127a3e', '#7c1e1e', '#151515'];
function couleurBoule(n) { return n === 0 ? BOULE[0] : BOULE[n > 8 ? n - 8 : n]; }
// bille vue de dessus : ombre douce, couleur (bande si rayée), volume, pastille numérotée ; a = orientation, u = position
// de la pastille sur la sphère (-1..1, 0 = au sommet) pour la faire rouler
function boule(g, x, y, r, n, a, u) {
  disque(g, x + r * 0.36, y + r * 0.52, r * 1.06, 'rgba(0,14,4,0.16)'); disque(g, x + r * 0.16, y + r * 0.24, r * 0.98, 'rgba(0,14,4,0.3)');
  const col = couleurBoule(n), ca = Math.cos(a), sa = Math.sin(a), o = (u || 0) * r * 0.62;
  if (n > 8) {                                          // rayée : fond blanc, bande de couleur qui suit la rotation
    disque(g, x, y, r, BOULE[0]);
    g.save(); g.beginPath(); g.arc(x, y, r, 0, TAU); g.clip(); g.translate(x + ca * o, y + sa * o); g.rotate(a); g.fillStyle = col; g.fillRect(-r * 0.5, -r * 1.2, r, r * 2.4); g.restore();
  } else disque(g, x, y, r, col);
  if (n) {                                              // pastille blanche et numéro (aplatie quand elle passe sur le flanc)
    const k = 1 - Math.abs(u || 0) * 0.55, px = x + ca * o + r * 0.05, py = y + sa * o + r * 0.04;
    g.save(); g.translate(px, py); g.rotate(a); g.scale(k, 1); disque(g, 0, 0, r * 0.4, '#fbfaf3');
    g.fillStyle = '#141414'; g.font = 'bold ' + Math.round(r * 0.5) + 'px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.rotate(-a); g.fillText(String(n), 0, 1); g.restore();
  }
  const gr = g.createRadialGradient(x - r * 0.4, y - r * 0.45, r * 0.04, x, y, r * 1.04);
  gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.22, 'rgba(255,255,255,0.14)'); gr.addColorStop(0.68, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.48)');
  g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
}
// queue de billard couchée le long de +x, de 0 (talon) à L (procédé) ; rb / rt = demi-épaisseurs au talon et au bout
function queue(g, L, rb, rt, bois, simple) {
  const rad = x => rb + (rt - rb) * x / L;
  const tronc = (xa, xb, fill) => { g.fillStyle = fill; g.beginPath(); g.moveTo(xa, -rad(xa)); g.lineTo(xb, -rad(xb)); g.lineTo(xb, rad(xb)); g.lineTo(xa, rad(xa)); g.closePath(); g.fill(); };
  const x1 = L * 0.06, x2 = L * 0.3, x3 = L * 0.47, x4 = L * 0.5;
  tronc(0, 10, '#111');                                                     // embout de caoutchouc
  tronc(10, x1, lin(g, 0, -rb, 0, rb, [bois[0], bois[1], bois[0]]));        // talon d'ébène
  tronc(x1, x2, '#1b1b1f');                                                 // garniture de lin tressé
  if (!simple) { g.strokeStyle = 'rgba(255,255,255,0.1)'; g.lineWidth = 1.5; g.beginPath(); for (let x = x1 + 4; x < x2; x += 7) { g.moveTo(x, -rad(x)); g.lineTo(x + 5, rad(x)); } g.stroke(); }
  tronc(x2, x4, lin(g, 0, -rb, 0, rb, [bois[2], bois[3], bois[2]]));        // fût en érable moucheté
  g.fillStyle = bois[0];                                                    // quatre pointes d'ébène incrustées vers le procédé
  for (const s of [-1, 1]) { g.beginPath(); g.moveTo(x2, s * rad(x2) * 0.95); g.lineTo(x3, s * rad(x3) * 0.15); g.lineTo(x2, s * rad(x2) * 0.25); g.closePath(); g.fill(); }
  if (!simple) { g.fillStyle = 'rgba(240,230,200,0.6)'; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(x2 + 6, s * rad(x2) * 0.7); g.lineTo(x3 - 16, s * rad(x3) * 0.12); g.lineTo(x2 + 6, s * rad(x2) * 0.4); g.closePath(); g.fill(); } }
  tronc(x4 - 8, x4 + 6, lin(g, 0, -rb, 0, rb, ['#8a6a20', '#f3d27a', '#8a6a20']));   // bague de laiton (jonction)
  tronc(x4 + 6, L - 20, lin(g, 0, -rb, 0, rb, ['#cdb07a', '#f6ead0', '#cdb07a']));   // flèche d'érable clair
  tronc(L - 20, L - 6, '#f4f2ea');                                          // virole blanche
  tronc(L - 6, L, '#3b78d0');                                               // procédé bleu (craie)
  g.fillStyle = 'rgba(255,255,255,0.3)'; g.fillRect(x4 + 12, -rad(x4) * 0.55, L - x4 - 40, Math.max(1.5, rad(x4) * 0.22));   // reflet du vernis
}
function cubeCraie(g, U, x, y, s, a, use) {           // cube de craie bleue : faces, creux d'usure sur le dessus
  g.save(); g.translate(x, y); g.rotate(a);
  ombre(g, a, 0.5, () => g.rect(-s, -s, 2 * s, 2 * s));
  g.fillStyle = '#2f6fc4'; g.fillRect(-s, -s, 2 * s, 2 * s);
  g.fillStyle = '#4a8be0'; g.fillRect(-s, -s, 2 * s, s * 0.35); g.fillStyle = '#245aa8'; g.fillRect(s * 0.65, -s, s * 0.35, 2 * s);
  if (use) { g.fillStyle = 'rgba(20,50,110,0.55)'; g.beginPath(); U.oval(g, -s * 0.1, s * 0.05, s * 0.55, s * 0.45); g.fill(); g.fillStyle = 'rgba(180,210,255,0.35)'; g.beginPath(); U.oval(g, -s * 0.25, -s * 0.12, s * 0.22, s * 0.14); g.fill(); }
  g.strokeStyle = 'rgba(10,30,70,0.35)'; g.lineWidth = 1; g.strokeRect(-s, -s, 2 * s, 2 * s);
  g.restore();
}
function veinage(g, R, x0, y0, x1, y1, n, horiz) {     // veines du bois le long d'une planche (rail, règle…)
  g.lineWidth = 1.2;
  for (let k = 0; k < n; k++) {
    g.strokeStyle = R() < 0.5 ? 'rgba(30,8,2,0.22)' : 'rgba(255,190,140,0.1)';
    g.beginPath();
    if (horiz) { const y = y0 + R() * (y1 - y0), p = R() * 6; g.moveTo(x0, y); for (let x = x0; x <= x1; x += 120) g.lineTo(x, y + Math.sin(x / 210 + p) * 2.5); }
    else { const x = x0 + R() * (x1 - x0), p = R() * 6; g.moveTo(x, y0); for (let y = y0; y <= y1; y += 120) g.lineTo(x + Math.sin(y / 210 + p) * 2.5, y); }
    g.stroke();
  }
}

// ── le sol de la salle, le cadre, le feutre, la piste ──
function sol(g, c, R) {                               // parquet sombre de la salle de jeu (lames en long), ombre portée de la table
  g.fillStyle = '#3a2416'; g.fillRect(0, 0, c.w, c.h);
  for (let y = 0, k = 0; y < c.h; y += 46, k++) {
    g.fillStyle = k % 2 ? 'rgba(255,220,170,0.04)' : 'rgba(0,0,0,0.08)'; g.fillRect(0, y, c.w, 46);
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, y, c.w, 2);
    for (let x = (k * 377) % 640; x < c.w; x += 640) g.fillRect(x, y, 2, 46);
  }
  const t = c.table, f = CADRE;
  g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(t.x0 - f + 6, t.y0 - f + 12, t.x1 - t.x0 + 2 * f + 22, t.y1 - t.y0 + 2 * f + 26);
  g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(t.x0 - f + 4, t.y0 - f + 6, t.x1 - t.x0 + 2 * f + 10, t.y1 - t.y0 + 2 * f + 12);
}
function plateau(g, c, R, U) {                        // feutre vert, poil brossé, trois flaques de lumière des lampes, mouches
  const t = c.table, W = t.x1 - t.x0, H = t.y1 - t.y0;
  g.fillStyle = '#1b7a3c'; g.fillRect(t.x0, t.y0, W, H);
  g.fillStyle = 'rgba(255,255,255,0.035)'; for (let k = 0; k < 1600; k++) g.fillRect(t.x0 + R() * W, t.y0 + R() * H, 3, 1.5);
  g.fillStyle = 'rgba(0,30,10,0.05)'; for (let k = 0; k < 1200; k++) g.fillRect(t.x0 + R() * W, t.y0 + R() * H, 2, 2);
  for (const lx of [0.2, 0.5, 0.8]) {                 // la lampe de billard à trois abat-jour : trois cercles de lumière chaude
    const x = t.x0 + W * lx, gr = g.createRadialGradient(x, CY, 60, x, CY, 880);
    gr.addColorStop(0, 'rgba(255,250,200,0.15)'); gr.addColorStop(0.55, 'rgba(255,250,200,0.06)'); gr.addColorStop(1, 'rgba(255,250,200,0)');
    g.fillStyle = gr; g.fillRect(x - 880, t.y0, 1760, H);
  }
  const vg = g.createRadialGradient(CX, CY, 700, CX, CY, 2200); vg.addColorStop(0, 'rgba(0,20,6,0)'); vg.addColorStop(1, 'rgba(0,20,6,0.42)');
  g.fillStyle = vg; g.fillRect(t.x0, t.y0, W, H);
  // ligne de tête à la craie, mouches (tête, centre, pied sous la pointe du triangle)
  g.strokeStyle = 'rgba(255,255,255,0.16)'; g.lineWidth = 2; g.setLineDash([3, 9]); g.beginPath(); g.moveTo(t.x0 + W / 4, t.y0 + 30); g.lineTo(t.x0 + W / 4, t.y1 - 30); g.stroke(); g.setLineDash([]);
  for (const p of [[t.x0 + W / 4, CY], [CX, CY], [RACK_X, RACK_Y]]) { disque(g, p[0], p[1], 7, 'rgba(255,255,255,0.4)'); cercle(g, p[0], p[1], 11, 1.5, 'rgba(255,255,255,0.15)'); }
  // traces de craie bleue et marques de billes sur le feutre
  for (const p of [[1250, 1180], [2650, 1500], [1700, 980], [3000, 1700], [620, 1210]]) U.blob(g, p[0], p[1], 34 + R() * 30, 18 + R() * 14, R() * 3, R, 'rgba(70,130,220,0.08)');
  g.strokeStyle = 'rgba(255,255,255,0.05)'; g.lineWidth = 9; g.lineCap = 'round';
  for (let k = 0; k < 7; k++) { const x = 1200 + R() * 1700, y = 650 + R() * 1100, a = R() * TAU, l = 120 + R() * 200; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
}
function piste(g, c, R, U) {                          // ruban de feutre brossé plus clair, bords tirés au cordeau de craie
  const W = c.W;
  U.centerStroke(g, c, 2 * W + 22, 'rgba(0,28,8,0.2)');
  U.centerStroke(g, c, 2 * W, 'rgba(225,255,215,0.1)');
  U.centerStroke(g, c, W, 'rgba(225,255,215,0.035)');
  g.lineJoin = 'round'; g.lineCap = 'round';
  for (const side of [-1, 1]) {
    g.strokeStyle = 'rgba(0,25,8,0.3)'; g.lineWidth = 5; U.trackPath(g, c, (W - 5) * side + 2); g.stroke();
    g.strokeStyle = 'rgba(232,242,255,0.6)'; g.lineWidth = 4.5; g.setLineDash([1, 15]); U.trackPath(g, c, (W - 6) * side); g.stroke(); g.setLineDash([]);
  }
  g.strokeStyle = 'rgba(255,255,255,0.07)'; g.lineWidth = 2; g.setLineDash([40, 60]); U.trackPath(g, c, 0); g.stroke(); g.setLineDash([]);
}
function cadre(g, c, R) {                             // bord : cadre d'acajou verni, mouches de nacre, cuirs des poches
  const t = c.table, f = CADRE, x0 = t.x0, y0 = t.y0, x1 = t.x1, y1 = t.y1;
  const quads = [[[x0 - f, y0 - f], [x1 + f, y0 - f], [x1, y0], [x0, y0], 0, -1], [[x1, y1], [x0, y1], [x0 - f, y1 + f], [x1 + f, y1 + f], 0, 1],
    [[x0 - f, y0 - f], [x0, y0], [x0, y1], [x0 - f, y1 + f], -1, 0], [[x1, y0], [x1 + f, y0 - f], [x1 + f, y1 + f], [x1, y1], 1, 0]];
  for (const q of quads) {
    const dx = q[4], dy = q[5], ax = dx < 0 ? x0 : dx > 0 ? x1 : 0, ay = dy < 0 ? y0 : dy > 0 ? y1 : 0;
    g.fillStyle = dx ? lin(g, ax, 0, ax + dx * f, 0, ['#9a4422', '#7a2e14', '#5a1e0a', '#3a1206']) : lin(g, 0, ay, 0, ay + dy * f, ['#9a4422', '#7a2e14', '#5a1e0a', '#3a1206']);
    g.beginPath(); g.moveTo(q[0][0], q[0][1]); g.lineTo(q[1][0], q[1][1]); g.lineTo(q[2][0], q[2][1]); g.lineTo(q[3][0], q[3][1]); g.closePath(); g.fill();
    g.save(); g.clip();
    if (dy) veinage(g, R, x0 - f, ay + (dy < 0 ? -f : 0), x1 + f, ay + (dy < 0 ? 0 : f), 14, true); else veinage(g, R, ax + (dx < 0 ? -f : 0), y0 - f, ax + (dx < 0 ? 0 : f), y1 + f, 9, false);
    g.restore();
  }
  g.strokeStyle = 'rgba(255,215,170,0.3)'; g.lineWidth = 3; g.strokeRect(x0 - f * 0.55, y0 - f * 0.55, x1 - x0 + f * 1.1, y1 - y0 + f * 1.1);   // arête vernie
  g.strokeStyle = 'rgba(20,5,0,0.6)'; g.lineWidth = 3; g.strokeRect(x0 - f + 1.5, y0 - f + 1.5, x1 - x0 + 2 * f - 3, y1 - y0 + 2 * f - 3);
  g.strokeStyle = 'rgba(25,6,0,0.45)'; g.lineWidth = 2; g.beginPath();                                                 // coupes d'onglet aux coins
  g.moveTo(x0 - f, y0 - f); g.lineTo(x0, y0); g.moveTo(x1 + f, y0 - f); g.lineTo(x1, y0); g.moveTo(x0 - f, y1 + f); g.lineTo(x0, y1); g.moveTo(x1 + f, y1 + f); g.lineTo(x1, y1); g.stroke();
  const mouche = (x, y, v) => {                       // mouche de nacre en losange
    g.save(); g.translate(x, y); if (v) g.rotate(Math.PI / 2);
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.moveTo(-9, 2); g.lineTo(1, -3); g.lineTo(11, 2); g.lineTo(1, 7); g.closePath(); g.fill();
    g.fillStyle = lin(g, -10, -5, 10, 5, ['#fffaf0', '#d8e4f0', '#f6e8ff']); g.beginPath(); g.moveTo(-10, 0); g.lineTo(0, -5); g.lineTo(10, 0); g.lineTo(0, 5); g.closePath(); g.fill();
    g.restore();
  };
  for (let k = 1; k < 8; k++) { if (k === 4) continue; const x = x0 + (x1 - x0) * k / 8; mouche(x, y0 - f / 2, false); mouche(x, y1 + f / 2, false); }
  for (let k = 1; k < 4; k++) { const y = y0 + (y1 - y0) * k / 4; mouche(x0 - f / 2, y, true); mouche(x1 + f / 2, y, true); }
  for (const p of POCHES) {                           // cuir des poches : coupelle piquée, posée à cheval sur le cadre
    const x = p[0], y = p[1], r = p[2] + 24;
    disque(g, x + 4, y + 6, r, 'rgba(0,0,0,0.35)');
    const gr = g.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r); gr.addColorStop(0, '#7a4a26'); gr.addColorStop(1, '#2a1406');
    disque(g, x, y, r, gr); g.setLineDash([5, 5]); cercle(g, x, y, r - 7, 1.6, 'rgba(240,200,140,0.55)'); g.setLineDash([]);
  }
}

// ── décor : objets posés sur le cadre, sur le feutre, autour de la table (dessinés autour de l'origine) ──
const DECOR = {
  marqueur(g, d, R, U) {                              // marqueur à boules (boulier de comptage) le long du mur du haut
    const w = 470, h = 26;
    ombre(g, 0, 0.6, () => U.rr(g, -w, -h, 2 * w, 2 * h, 8));
    g.fillStyle = lin(g, 0, -h, 0, h, ['#6a3416', '#4a200c']); g.beginPath(); U.rr(g, -w, -h, 2 * w, 2 * h, 8); g.fill();
    g.fillStyle = '#2a1206'; g.fillRect(-w + 30, -h + 6, 2 * w - 60, 2 * h - 12);
    for (const y of [-9, 9]) {
      g.strokeStyle = lin(g, 0, y - 2, 0, y + 2, ['#8a6a20', '#f3d27a', '#8a6a20']); g.lineWidth = 3; g.beginPath(); g.moveTo(-w + 30, y); g.lineTo(w - 30, y); g.stroke();
      const score = y < 0 ? 11 : 7;                   // les points marqués sont poussés à gauche, le reste à droite
      for (let k = 0; k < 30; k++) {
        const x = k < score ? -w + 44 + k * 15 + Math.floor(k / 5) * 5 : w - 44 - (29 - k) * 15 - Math.floor((29 - k) / 5) * 5;
        const col = Math.floor(k / 5) % 2 ? '#e8d6b0' : '#2a1a10';
        disque(g, x, y, 7, col); disque(g, x - 2, y - 2, 2.5, 'rgba(255,255,255,0.35)');
      }
    }
    for (const s of [-1, 1]) { g.fillStyle = lin(g, 0, -h, 0, h, ['#f3d27a', '#8a6a20']); g.beginPath(); U.rr(g, s * w - (s > 0 ? 22 : 0), -h, 22, 2 * h, 6); g.fill(); }
    g.fillStyle = '#e8d6b0'; g.font = 'bold 13px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('11', -w + 15, -9); g.fillText('7', -w + 15, 9);
  },
  ratelier(g, d, R, U) {                              // porte-queues mural (vu d'en haut) : planche, encoches, quatre queues
    const w = 570, h = 34;
    ombre(g, 0, 0.7, () => g.rect(-w, -h, 2 * w, 2 * h));
    g.fillStyle = lin(g, 0, -h, 0, h, ['#7a3a18', '#5a2610', '#3e180a']); g.fillRect(-w, -h, 2 * w, 2 * h);
    veinage(g, R, -w, -h, w, h, 6, true);
    for (const x of [-w + 26, w - 40]) { g.fillStyle = '#2a1206'; g.fillRect(x, -h + 4, 14, 2 * h - 8); }
    const bois = [['#1a0e08', '#4a2a16', '#d9c18a', '#f2e4c0'], ['#3a0e0e', '#7a2a1a', '#cfae72', '#ecd9a8'], ['#0e1a2a', '#2a4a6a', '#d6c08e', '#f4e8c8'], ['#1a1a1a', '#4a4a4a', '#c9a868', '#e8d4a4']];
    for (let k = 0; k < 4; k++) { g.save(); g.translate(-w + 12 + (k % 2) * 20, -h + 9 + k * 16); queue(g, 2 * w - 50, 7, 3.5, bois[k], true); g.restore(); }
  },
  whisky(g, d, R, U) {                                // verre de whisky sur le cadre : sous-verre, ambre, deux glaçons, reflets
    ombre(g, 0, 0.5, () => g.arc(0, 0, 38, 0, TAU));
    disque(g, 0, 0, 40, '#d9cbb0'); cercle(g, 0, 0, 35, 1.5, 'rgba(120,80,40,0.4)');
    disque(g, 0, 0, 30, 'rgba(200,225,235,0.55)');
    const gr = g.createRadialGradient(-6, -6, 3, 0, 0, 26); gr.addColorStop(0, '#f0a83a'); gr.addColorStop(1, '#9a4e10'); disque(g, 0, 0, 25, gr);
    for (const p of [[-7, -5, 0.4], [8, 6, -0.3]]) { g.save(); g.translate(p[0], p[1]); g.rotate(p[2]); g.fillStyle = 'rgba(240,250,255,0.75)'; g.fillRect(-8, -8, 16, 16); g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 1.5; g.strokeRect(-8, -8, 16, 16); g.restore(); }
    cercle(g, 0, 0, 30, 3, 'rgba(255,255,255,0.55)'); g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 2; g.beginPath(); g.arc(0, 0, 27, Math.PI * 1.05, Math.PI * 1.45); g.stroke();
  },
  biere(g, d, R, U) {                                 // demi de bière : sous-bock rond imprimé, mousse, bulles
    ombre(g, 0, 0.6, () => g.arc(0, 0, 44, 0, TAU));
    disque(g, 0, 0, 46, '#c8302a'); cercle(g, 0, 0, 40, 2, '#f2e2b0'); g.fillStyle = '#f2e2b0'; g.font = 'bold 11px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('8', 0, -36);
    disque(g, 0, 0, 33, 'rgba(210,230,240,0.6)');
    const gr = g.createRadialGradient(-6, -8, 4, 0, 0, 30); gr.addColorStop(0, '#fffaf0'); gr.addColorStop(1, '#e6d6b4'); disque(g, 0, 0, 29, gr);
    for (let k = 0; k < 14; k++) { const a = R() * TAU, q = R() * 22; cercle(g, Math.cos(a) * q, Math.sin(a) * q, 1.5 + R() * 2.5, 1, 'rgba(180,150,100,0.45)'); }
    cercle(g, 0, 0, 33, 3, 'rgba(255,255,255,0.6)');
  },
  craies(g, d, R, U) {                                // trois craies sur le cadre (une entamée)
    cubeCraie(g, U, -30, 2, 13, 0.2, true); cubeCraie(g, U, 2, -6, 13, -0.1, false); cubeCraie(g, U, 32, 6, 13, 0.5, false);
  },
  craie(g, d, R, U) {                                 // craie oubliée sur le feutre, auréole de poussière bleue
    U.blob(g, 6, 4, 70, 40, 0.4, R, 'rgba(80,140,230,0.22)');
    for (let k = 0; k < 40; k++) { const a = R() * TAU, q = 30 + R() * 50; g.fillStyle = 'rgba(90,150,240,0.5)'; g.fillRect(Math.cos(a) * q, Math.sin(a) * q * 0.6, 3, 3); }
    cubeCraie(g, U, 0, 0, 16, 0.6, true);
  },
  gant(g, d, R, U) {                                  // gant de billard (trois doigts) en lycra noir, bande velcro
    g.rotate(0.3);
    ombre(g, 0.3, 0.4, () => { U.rr(g, -34, -22, 62, 50, 18); U.rr(g, 20, -26, 46, 16, 8); U.rr(g, 20, -6, 50, 16, 8); });
    g.fillStyle = '#1c1c22'; g.beginPath(); U.rr(g, -34, -22, 62, 50, 18); g.fill();
    g.beginPath(); U.rr(g, 20, -26, 46, 16, 8); g.fill(); g.beginPath(); U.rr(g, 20, -6, 50, 16, 8); g.fill();
    g.fillStyle = '#d42a20'; g.fillRect(-34, 10, 34, 10); g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(-28, -16, 40, 4);
    disque(g, -8, -2, 7, '#f2b705');
  },
  monnaie(g, d, R, U) {                               // la mise : deux piles de pièces sur le cadre
    for (const p of [[-14, -10, 5], [16, 8, 3]]) {
      for (let k = 0; k < p[2]; k++) { disque(g, p[0] + 3, p[1] + 4, 17, 'rgba(0,0,0,0.12)'); }
      const gr = g.createRadialGradient(p[0] - 5, p[1] - 6, 2, p[0], p[1], 17); gr.addColorStop(0, '#fff2b0'); gr.addColorStop(1, '#b8891e');
      disque(g, p[0], p[1], 16, gr); cercle(g, p[0], p[1], 12, 1.5, 'rgba(120,80,10,0.5)'); cercle(g, p[0], p[1], 16, 1, 'rgba(90,60,5,0.6)');
    }
  },
  queue(g, d, R, U) {                                 // grande queue couchée en travers du feutre, le procédé vers la blanche
    const a = -0.33, L = 1340; g.rotate(a);
    ombre(g, a, 1.1, () => { g.moveTo(-L / 2, -15); g.lineTo(L / 2, -6); g.lineTo(L / 2, 6); g.lineTo(-L / 2, 15); g.closePath(); });
    g.translate(-L / 2, 0); queue(g, L, 15, 6, ['#14080a', '#3e2418', '#d9c18a', '#f2e4c0'], false);
  },
  blanche(g, d, R, U) {                               // la blanche, prête à partir, un point de craie dessus
    boule(g, 0, 0, RACK_R, 0, 0, 0); disque(g, -6, -4, 3, 'rgba(60,120,220,0.7)');
  },
  triangle(g, d, R, U) {                              // triangle de rangement en érable, posé vide sur le feutre
    const a = 0.35, s = 190, s2 = 148; g.rotate(a);
    const tri = (q, inv) => { const P = [[0, -q], [q * 0.866, q * 0.5], [-q * 0.866, q * 0.5]]; if (inv) P.reverse(); g.moveTo(P[0][0], P[0][1]); g.lineTo(P[1][0], P[1][1]); g.lineTo(P[2][0], P[2][1]); g.closePath(); };
    ombre(g, a, 0.6, () => { tri(s, false); tri(s2, true); });
    g.fillStyle = lin(g, -s, -s, s, s, ['#e8c890', '#c9965a', '#a87040']); g.beginPath(); tri(s, false); tri(s2, true); g.fill();
    g.strokeStyle = 'rgba(90,50,20,0.55)'; g.lineWidth = 2; g.beginPath(); tri(s, false); g.stroke(); g.beginPath(); tri(s2, false); g.stroke();
    g.strokeStyle = 'rgba(255,240,210,0.35)'; g.lineWidth = 1.5; g.beginPath(); tri(s - 10, false); g.stroke();
    disque(g, 0, -s + 26, 6, '#7a4a20');
  },
  pont(g, d, R, U) {                                  // râteau (pont) : longue hampe, tête de laiton en croix crantée
    const a = 0.1, L = 860; g.rotate(a);
    ombre(g, a, 0.6, () => { g.rect(-L / 2, -7, L, 14); g.arc(L / 2 + 24, 0, 40, 0, TAU); });
    g.fillStyle = lin(g, 0, -7, 0, 7, ['#2a1408', '#6a3a1c', '#2a1408']); g.fillRect(-L / 2, -7, L, 14);
    g.fillStyle = '#111'; g.fillRect(-L / 2, -8, 14, 16);
    g.save(); g.translate(L / 2 + 24, 0);
    g.fillStyle = lin(g, -40, -40, 40, 40, ['#f3d27a', '#a07a26']);
    g.beginPath(); g.moveTo(-26, -10); g.lineTo(-10, -40); g.lineTo(10, -40); g.lineTo(26, -10); g.lineTo(26, 10); g.lineTo(10, 40); g.lineTo(-10, 40); g.lineTo(-26, 10); g.closePath(); g.fill();
    for (const y of [-28, 0, 28]) disque(g, 22, y, 7, '#1b7a3c');
    g.restore();
  },
  brosse(g, d, R, U) {                                // brosse à feutre : dos de bois verni, rangées de crins
    const a = -0.5; g.rotate(a);
    ombre(g, a, 0.7, () => U.rr(g, -120, -36, 240, 72, 34));
    g.fillStyle = lin(g, 0, -36, 0, 36, ['#b8743a', '#7a4418']); g.beginPath(); U.rr(g, -120, -36, 240, 72, 34); g.fill();
    g.fillStyle = 'rgba(255,230,190,0.25)'; g.beginPath(); U.oval(g, -30, -16, 70, 9); g.fill();
    g.fillStyle = '#e8d6b0'; g.font = 'bold 16px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('BILLARD CLUB', 0, 8);
  },
  empochee8(g, d, R, U) { enPoche(g, 8, 14, 12); },  // la noire, tombée trop tôt dans la poche du coin
  empochee3(g, d, R, U) { enPoche(g, 3, -12, 14); },
  ardoise(g, d, R, U) {                               // ardoise des scores, appuyée au pied de la table : bâtons à la craie
    const w = 92, h = 40;
    ombre(g, 0, 0.5, () => g.rect(-w, -h, 2 * w, 2 * h));
    g.fillStyle = lin(g, 0, -h, 0, h, ['#b8743a', '#7a4418']); g.fillRect(-w, -h, 2 * w, 2 * h);
    g.fillStyle = '#26302c'; g.fillRect(-w + 8, -h + 7, 2 * w - 16, 2 * h - 14);
    g.fillStyle = 'rgba(255,255,255,0.06)'; g.fillRect(-w + 8, -h + 7, 2 * w - 16, 10);
    g.fillStyle = 'rgba(240,240,228,0.85)'; g.font = 'italic bold 13px serif'; g.textAlign = 'left'; g.textBaseline = 'middle';
    g.fillText('LÉO', -w + 16, -12); g.fillText('INÈS', -w + 16, 14);
    g.strokeStyle = 'rgba(240,240,228,0.8)'; g.lineWidth = 2; g.lineCap = 'round'; g.beginPath();
    const batons = (x, y, n) => { for (let k = 0; k < n; k++) { const gx = x + Math.floor(k / 5) * 34 + (k % 5) * 5; if (k % 5 === 4) { g.moveTo(gx - 22, y + 6); g.lineTo(gx + 1, y - 6); } else { g.moveTo(gx, y - 7); g.lineTo(gx + 1, y + 7); } } };
    batons(-30, -12, 7); batons(-30, 14, 11); g.stroke();
  },
  portable(g, d, R, U) {                              // téléphone posé sur le cadre, écran allumé
    g.rotate(0.12);
    ombre(g, 0.12, 0.35, () => U.rr(g, -46, -22, 92, 44, 8));
    g.fillStyle = '#16161a'; g.beginPath(); U.rr(g, -46, -22, 92, 44, 8); g.fill();
    g.fillStyle = lin(g, -40, -18, 40, 18, ['#1c3a70', '#3a72c0', '#1a2a50']); g.beginPath(); U.rr(g, -40, -18, 80, 36, 4); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.18)'; g.beginPath(); g.moveTo(-40, -18); g.lineTo(-6, -18); g.lineTo(-26, 18); g.lineTo(-40, 18); g.closePath(); g.fill();
    disque(g, 43, 0, 2, '#444');
  },
};
function enPoche(g, n, ox, oy) {                      // bille au fond d'une poche d'angle : à moitié dans l'ombre du trou
  g.save(); g.beginPath(); g.arc(0, 0, 50, 0, TAU); g.clip();
  boule(g, ox, oy, RACK_R, n, 0.6, 0.3);
  const gr = g.createRadialGradient(ox * 0.4, oy * 0.4, 6, 0, 0, 52); gr.addColorStop(0, 'rgba(0,0,0,0.15)'); gr.addColorStop(1, 'rgba(0,0,0,0.85)');
  g.fillStyle = gr; g.fillRect(-52, -52, 104, 104); g.restore();
}

// ── obstacles : billes-bumpers (qui renvoient) et billes du triangle (qui arrêtent), une clé par numéro ──
const OBJETS = {};
for (let n = 1; n <= 15; n++) {
  OBJETS['boule' + n] = (g, r) => { boule(g, r[0], r[1], r[2], n, (n * 1.7) % TAU, 0); cercle(g, r[0], r[1], r[2] + 4, 2, 'rgba(255,240,160,0.3)'); };
  OBJETS['rack' + n] = (g, r) => boule(g, r[0], r[1], r[2], n, (n * 0.9) % TAU, ((n * 37) % 9 - 4) / 9);
}
const MURS = {
  bande(g, w, R, U) {                                 // bande de caoutchouc gainée de feutre : talus, nez éclairé, ombre sur le tapis
    const x1 = w[0], y1 = w[1], x2 = w[2], y2 = w[3], L = Math.hypot(x2 - x1, y2 - y1), dx = (x2 - x1) / L, dy = (y2 - y1) / L;
    let nx = -dy, ny = dx; if (nx * (CX - x1) + ny * (CY - y1) < 0) { nx = -nx; ny = -ny; }
    const D = 20, q = (o, e) => [x1 + dx * e + nx * o, y1 + dy * e + ny * o], r = (o, e) => [x2 - dx * e + nx * o, y2 - dy * e + ny * o];
    const poly = (pts, col) => { g.fillStyle = col; g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); g.closePath(); g.fill(); };
    poly([q(D, D), r(D, D), r(D + 9, D + 9), q(D + 9, D + 9)], 'rgba(0,16,4,0.28)');
    poly([q(0, 0), r(0, 0), r(D, D), q(D, D)], lin(g, x1, y1, x1 + nx * D, y1 + ny * D, ['#0f4a22', '#17663a', '#22844a']));
    const a = q(D - 4, D - 4), b = r(D - 4, D - 4); g.strokeStyle = 'rgba(200,255,210,0.28)'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
  },
};
const ZONES = {
  craie(g, z, R, U) {                                 // poudre de craie bleue écrasée : tache, grains, traces de pneus, éclat de cube
    g.save(); g.translate(z[0], z[1]); g.rotate(z[5]);
    U.blob(g, 0, 0, z[2], z[3], 0, R, 'rgba(70,140,235,0.3)');
    for (let k = 0; k < 140; k++) { const a = R() * TAU, q = Math.sqrt(R()); g.fillStyle = 'rgba(' + (R() < 0.5 ? '120,175,255' : '50,110,210') + ',' + (0.4 + R() * 0.5).toFixed(2) + ')'; g.fillRect(Math.cos(a) * z[2] * q, Math.sin(a) * z[3] * q, 2 + R() * 3, 2 + R() * 2); }
    g.strokeStyle = 'rgba(20,60,140,0.25)'; g.lineWidth = 6; for (const y of [-z[3] * 0.3, z[3] * 0.25]) { g.beginPath(); g.moveTo(-z[2] * 0.9, y); g.lineTo(z[2] * 0.9, y + 4); g.stroke(); }
    g.fillStyle = '#2f6fc4'; g.save(); g.rotate(0.7); g.fillRect(-9, -7, 18, 14); g.fillStyle = '#4a8be0'; g.fillRect(-9, -7, 18, 4); g.restore();
    g.restore();
  },
};
const MOBILES = {
  bille(g, m, o, now, U, reduceFx) {                  // bille qui roule : la pastille (ou la bande) défile dans le sens de la marche
    const ca = Math.cos(o.a), sa = Math.sin(o.a), p = reduceFx ? 0 : (o.x * ca + o.y * sa) / m.r;
    boule(g, o.x, o.y, m.r, m.n || 3, o.a, Math.sin(p));
  },
};
function final(g, c) {                                // liseré clair sur l'arête des poches (par-dessus le trou)
  g.lineWidth = 2.5; g.strokeStyle = 'rgba(255,225,180,0.28)';
  for (const h of c.holes) { g.beginPath(); g.arc(h[0], h[1], h[2] + 11, Math.PI * 0.95, Math.PI * 1.65); g.stroke(); }
}

export default {
  id: 'billard', nom: 'Billard', emoji: '🎱', sous: 'Feutre vert · grandes courbes, billes qui roulent, poches qui avalent', v: 2,
  w: 4000, h: 2400, surf: 'feutre', edge: 'mur', table: T, W: 112,
  pts: trace(1600, 2073, 0, [
    ['X', 3302],                                            // grande ligne droite du bas, le long de la bande (turbos)
    ['A', 290, -170], ['A', 290, 170], ['A', 297.4, -180],  // épingle du triangle : la piste contourne le triangle de billes
    ['X', 1030],                                            // grande ligne droite du haut, le long de l'autre bande (turbos)
    ['A', 700, -70], ['A', 1205, -40], ['A', 700, -70],     // parabolique : très grande courbe à trois rayons, pied au plancher
    ['X', 1600],
  ]),
  mobs: [
    { type: 'bille', chemin: CHEMIN_HAUT, r: 24, per: 9, n: 9 },             // trois billes en file traversent la ligne du haut
    { type: 'bille', chemin: CHEMIN_HAUT, r: 24, per: 9, dec: 1 / 3, n: 12 },
    { type: 'bille', chemin: CHEMIN_HAUT, r: 24, per: 9, dec: 2 / 3, n: 14 },
    { type: 'bille', seg: [[200, 1200], [640, 1200]], r: 26, per: 4.6, n: 2 },        // une bille fait la navette au sommet de la parabolique
    { type: 'bille', seg: [[2580, 2214], [2440, 1780]], r: 26, per: 5.4, dec: 0.3, n: 5 },   // une autre rebondit sur la bande du bas
  ],
  boxes: [0.07, 0.64, 0.775],
  bumpers: Object.keys(OBJETS).filter(k => k.indexOf('boule') === 0),
  make(H) {
    // bandes : coupées aux poches (une voiture qui longe la bande au milieu tombe dans la poche du milieu)
    for (const y of [T.y0, T.y1]) { H.wall(T.x0 + 84, y, CX - 64, y, 14, 'bande'); H.wall(CX + 64, y, T.x1 - 84, y, 14, 'bande'); }
    for (const x of [T.x0, T.x1]) H.wall(x, T.y0 + 84, x, T.y1 - 84, 14, 'bande');
    for (const p of POCHES) H.hole(p[0], p[1], p[2]);
    H.boostAt(0.03); H.boostAt(0.12); H.boostAt(0.5); H.boostAt(0.6);
    // le triangle de billes, serré dans l'épingle : qui coupe la corde s'y arrête net
    RACK.forEach((rang, k) => rang.forEach((num, j) => H.rock(RACK_X + k * 45, RACK_Y + (j - k / 2) * 52, RACK_R, 'rack' + num)));
    // billes-bumpers : face aux poches du milieu (en haut, au milieu de la ligne : entre la bille et la poche, ou par l'intérieur), au bord
    // intérieur de la parabolique (qui coupe rebondit), à l'entrée de l'épingle
    H.rock(2060, 344, 28, 'boule3'); H.rock(2060, 2011, 28, 'boule11');
    H.rock(464, 1035, 28, 'boule6'); H.rock(464, 1365, 28, 'boule13');
    H.rockAt(0.19, 0.55, 28, 'boule7');
    // craie écrasée : à la corde de l'entrée de la parabolique, à l'extérieur de la sortie de l'épingle
    H.zoneAt(0.72, -0.6, 110, 46, 'craie'); H.zoneAt(0.405, 0.6, 100, 44, 'craie');
    // décor : la salle autour (marqueur, porte-queues), le cadre (verres, craies, gant, mise), le feutre (queue, triangle…)
    H.deco(1500, 44, 'marqueur'); H.deco(2900, 2356, 'ratelier');
    H.deco(700, 119, 'whisky'); H.deco(3550, 2281, 'biere'); H.deco(1300, 2281, 'craies'); H.deco(3881, 1700, 'craies');
    H.deco(119, 300, 'gant'); H.deco(3881, 1000, 'monnaie');
    H.deco(2150, 1150, 'queue'); H.deco(2845, 913, 'blanche'); H.deco(1320, 820, 'triangle'); H.deco(2400, 1650, 'pont');
    H.deco(1450, 1560, 'craie'); H.deco(1850, 640, 'brosse');
    H.deco(POCHES[3][0], POCHES[3][1], 'empochee8'); H.deco(POCHES[2][0], POCHES[2][1], 'empochee3');
    H.deco(700, 2350, 'ardoise'); H.deco(3200, 112, 'portable');
  },
  dessin: { sol, plateau, piste, bord: cadre, final, decor: DECOR, objets: OBJETS, murs: MURS, zones: ZONES, mobiles: MOBILES, hors: '#24160c' },
};
