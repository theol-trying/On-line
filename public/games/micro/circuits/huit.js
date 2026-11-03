// Circuit « huit » de Micro Machines — définition PARTAGÉE serveur / client (géométrie, obstacles, zones, décor).
// Format : voir l'en-tête de ../shared.js ; dessins propres au circuit (propriété `dessin`) : voir ../rendu.js.

const D2R = Math.PI / 180, TAU = Math.PI * 2;
// tortue : départ (x, y) cap h (rad, 0 = vers la droite, y vers le bas) ; ['X', x] / ['Y', y] tout droit jusqu'à cette
// abscisse / ordonnée, ['A', rayon, degrés] arc (> 0 : à droite), ['V', [[r, deg]…], px, py] tout droit juste ce qu'il faut
// pour qu'après ces arcs la ligne droite suivante passe par (px, py) (c'est ce qui ferme le 8 au croisement)
// → points de contrôle tous les ~80 u (le dernier = le départ)
function trace(x, y, h, cmds) {
  const P = [[x, y]];
  const droit = len => { const k = Math.max(1, Math.round(len / 80)); for (let i = 1; i <= k; i++) P.push([x + Math.cos(h) * len * i / k, y + Math.sin(h) * len * i / k]); x += Math.cos(h) * len; y += Math.sin(h) * len; };
  const arc = (r, deg, pousse) => {
    const a = deg * D2R, s = a > 0 ? 1 : -1, cx = x - Math.sin(h) * r * s, cy = y + Math.cos(h) * r * s;
    const f0 = Math.atan2(y - cy, x - cx), k = Math.max(2, Math.round(r * Math.abs(a) / 80));
    for (let i = 1; i <= k; i++) if (pousse) P.push([cx + Math.cos(f0 + a * i / k) * r, cy + Math.sin(f0 + a * i / k) * r]);
    x = cx + Math.cos(f0 + a) * r; y = cy + Math.sin(f0 + a) * r; h += a;
  };
  for (const c of cmds) {
    if (c[0] === 'A') arc(c[1], c[2], true);
    else if (c[0] === 'V') {
      const x0 = x, y0 = y, h0 = h;
      for (const q of c[1]) arc(q[0], q[1], false);                 // essai à blanc : déplacement et cap au bout des arcs
      const dx = x - x0, dy = y - y0, u1x = Math.cos(h), u1y = Math.sin(h), u0x = Math.cos(h0), u0y = Math.sin(h0);
      x = x0; y = y0; h = h0;
      const s = -((x0 - c[2] + dx) * u1y - (y0 - c[3] + dy) * u1x) / (u0x * u1y - u0y * u1x);
      if (s > 1) droit(s);
      for (const q of c[1]) arc(q[0], q[1], true);
    } else droit(c[0] === 'Y' ? (c[1] - y) / Math.sin(h) : (c[1] - x) / Math.cos(h));
  }
  P.pop();                                                  // la tortue revient au départ : on ne le garde qu'une fois
  return P.map(p => [Math.round(p[0] * 100) / 100, Math.round(p[1] * 100) / 100]);
}

// le tapis de jeu couvre tout le sol de la chambre ; croisement au milieu (CX, CY), deux longues branches à ±36°
const T = { x0: 40, y0: 40, x1: 4160, y1: 2240, r: 60 };
const AL = 36 * D2R, CA = Math.cos(AL), SA = Math.sin(AL), CX = 2040, CY = 1140;
const DEP = [CX - CA * 520, CY - SA * 520];                 // ligne de départ : branche haut-gauche (S1), loin du croisement
const Q1 = [CX + CA * 1000, CY + SA * 1000], P2 = [CX - CA * 1000, CY + SA * 1000], P1 = [CX - CA * 960, CY - SA * 960];
// rivière imprimée : descend du coin haut-gauche, passe sous le grand rond (pont 1), traverse l'étang, ressort sous le pont 2
const RIV = [[20, 236], [200, 266], [360, 356], [480, 450], [560, 515], [640, 617], [720, 760], [790, 900], [840, 1150], [830, 1420], [812, 1600], [805, 1750], [795, 1850], [782, 2000], [770, 2260]];
const PONTS = [[600, 566], [800, 1800]], ETANG = [840, 1150, 240, 180];
const TRACTEUR = [[3350, 1550], [3490, 1612], [3522, 1800], [3470, 1980], [3350, 2032], [3230, 1980], [3180, 1800], [3210, 1612]];
const CHAMPS = [                                            // [culture, contour, angle des sillons]
  ['ble', [[1290, 230], [1700, 195], [1722, 600], [1430, 480]], 0.2],
  ['laboure', [[1772, 185], [2000, 178], [1995, 430], [1778, 560]], 1.45],
  ['tournesol', [[2088, 178], [2420, 192], [2392, 560], [2092, 440]], 0],
  ['potager', [[2472, 202], [2890, 192], [2876, 330], [2472, 560]], -0.6],
  ['laboure', [[2985, 1440], [3600, 1440], [3600, 1680], [2985, 1680]], 0],
  ['ble', [[2880, 1955], [3560, 1960], [3580, 2185], [2870, 2180]], 0.1],
  ['potager', [[110, 1955], [470, 1985], [470, 2185], [110, 2185]], 0],
];

// ── petits outils de dessin (décor fixe : peint une fois ; mobiles : à chaque image, donc sobres) ──
// ombre douce portée vers le bas-droite quel que soit l'angle a du repère courant : une passe large et pâle puis une
// serrée plus sombre ; f() trace le contour ; k = hauteur de l'objet
function ombre(g, a, k, f) {
  const c = Math.cos(a), s = Math.sin(a);
  for (let p = 0; p < 2; p++) {
    const ox = (p ? 4 : 9) * k, oy = (p ? 6 : 13) * k;
    g.save(); g.translate(ox * c + oy * s, -ox * s + oy * c); g.fillStyle = p ? 'rgba(18,52,10,0.28)' : 'rgba(18,52,10,0.13)';
    g.beginPath(); f(); g.fill(); g.restore();
  }
}
function lin(g, x0, y0, x1, y1, st) { const gr = g.createLinearGradient(x0, y0, x1, y1); for (let i = 0; i < st.length; i++) gr.addColorStop(i / (st.length - 1), st[i]); return gr; }
function rad(g, x, y, r0, r1, st) { const gr = g.createRadialGradient(x, y, r0, x, y, r1); for (let i = 0; i < st.length; i++) gr.addColorStop(i / (st.length - 1), st[i]); return gr; }
function rond(g, x, y, r) { g.moveTo(x + r, y); g.arc(x, y, r, 0, TAU); }
function disque(g, x, y, r, col) { g.fillStyle = col; g.beginPath(); rond(g, x, y, r); g.fill(); }
function ovale(g, x, y, rx, ry) { g.save(); g.translate(x, y); g.scale(rx, ry); g.moveTo(1, 0); g.arc(0, 0, 1, 0, TAU); g.restore(); }
function rrect(g, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function poly(g, P) { g.moveTo(P[0][0], P[0][1]); for (let i = 1; i < P.length; i++) g.lineTo(P[i][0], P[i][1]); g.closePath(); }
function etoile(g, x, y, r1, r2, k, rot) { for (let i = 0; i < 2 * k; i++) { const a = rot + i * Math.PI / k, r = i % 2 ? r2 : r1; if (i) g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); else g.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } g.closePath(); }
// courbe lissée passant par les milieux des points (ouverte : du premier au dernier point ; fermée : boucle)
function courbe(g, P, ferme) {
  const m = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], n = P.length;
  g.beginPath();
  if (ferme) { const s = m(P[n - 1], P[0]); g.moveTo(s[0], s[1]); for (let i = 0; i < n; i++) { const q = m(P[i], P[(i + 1) % n]); g.quadraticCurveTo(P[i][0], P[i][1], q[0], q[1]); } g.closePath(); return; }
  g.moveTo(P[0][0], P[0][1]); for (let i = 1; i < n - 1; i++) { const q = m(P[i], P[i + 1]); g.quadraticCurveTo(P[i][0], P[i][1], q[0], q[1]); } g.lineTo(P[n - 1][0], P[n - 1][1]);
}
// contour d'étang irrégulier (rayons modulés)
function contour(g, x, y, rx, ry, m) { for (let k = 0; k <= 48; k++) { const a = k / 48 * TAU, f = 1 + m * (0.6 * Math.sin(3 * a + 1) + 0.4 * Math.sin(5 * a + 2)), px = x + Math.cos(a) * rx * f, py = y + Math.sin(a) * ry * f; if (k) g.lineTo(px, py); else g.moveTo(px, py); } g.closePath(); }
function idx(c, x, y) { let b = 0, bd = 1e18; for (let i = 0; i < c.n; i++) { const dx = c.sx[i] - x, dy = c.sy[i] - y, q = dx * dx + dy * dy; if (q < bd) { bd = q; b = i; } } return b; }
function pt(c, s, off) { const i = ((s % c.n) + c.n) % c.n; return [c.sx[i] + c.nx[i] * off, c.sy[i] + c.ny[i] * off]; }

// ── le parquet de la chambre, le tapis imprimé, sa bordure molletonnée ──
function sol(g, c) {                                  // parquet blond (on n'en voit qu'un liseré autour du tapis)
  g.fillStyle = '#c9a272'; g.fillRect(0, 0, c.w, c.h);
  g.fillStyle = 'rgba(90,56,24,0.3)'; for (let y = 0; y < c.h; y += 64) g.fillRect(0, y, c.w, 2);
}
function champ(g, ch) {                               // champ imprimé : couleur, sillons ou rangs de plants, haie autour
  const t = ch[0], P = ch[1];
  let cx = 0, cy = 0, rm = 0; for (const p of P) { cx += p[0] / P.length; cy += p[1] / P.length; }
  for (const p of P) rm = Math.max(rm, Math.hypot(p[0] - cx, p[1] - cy));
  g.save(); g.beginPath(); poly(g, P);
  g.fillStyle = t === 'ble' ? '#f1cf5c' : t === 'laboure' ? '#bd7c43' : t === 'tournesol' ? '#7cb444' : '#a6d872'; g.fill();
  g.clip(); g.translate(cx, cy); g.rotate(ch[2]);
  if (t === 'ble' || t === 'laboure') {
    const e = t === 'ble' ? 16 : 24; g.strokeStyle = t === 'ble' ? 'rgba(196,146,34,0.55)' : 'rgba(112,62,26,0.6)'; g.lineWidth = t === 'ble' ? 3 : 8;
    g.beginPath(); for (let y = -rm; y < rm; y += e) { g.moveTo(-rm, y); g.lineTo(rm, y); } g.stroke();
    if (t === 'laboure') { g.strokeStyle = 'rgba(232,180,120,0.35)'; g.lineWidth = 2; g.beginPath(); for (let y = -rm + 8; y < rm; y += e) { g.moveTo(-rm, y); g.lineTo(rm, y); } g.stroke(); }
  } else {
    const tou = t === 'tournesol', e = tou ? 34 : 30;
    g.fillStyle = tou ? '#3f8a2e' : '#4c9a38'; g.beginPath(); for (let y = -rm; y < rm; y += e) for (let x = -rm + (y / e % 2 ? e / 2 : 0); x < rm; x += e) rond(g, x + 3, y + 3, tou ? 12 : 10); g.fill();
    g.fillStyle = tou ? '#ffcf26' : '#8fd65a'; g.beginPath(); for (let y = -rm; y < rm; y += e) for (let x = -rm + (y / e % 2 ? e / 2 : 0); x < rm; x += e) rond(g, x, y, tou ? 10 : 8); g.fill();
    g.fillStyle = tou ? '#6a3a12' : '#c8f09a'; g.beginPath(); for (let y = -rm; y < rm; y += e) for (let x = -rm + (y / e % 2 ? e / 2 : 0); x < rm; x += e) rond(g, x, y, tou ? 4 : 3); g.fill();
  }
  g.restore();
  g.save(); g.lineJoin = 'round'; g.beginPath(); poly(g, P);   // haie
  g.strokeStyle = '#3c8a36'; g.lineWidth = 14; g.stroke(); g.strokeStyle = 'rgba(150,215,110,0.7)'; g.lineWidth = 5; g.setLineDash([7, 11]); g.stroke(); g.setLineDash([]);
  g.restore();
}
function plateau(g, c, R, U) {                        // tapis de jeu : pelouse imprimée, champs, rivière, étang, chemins, village
  const t = c.table, W = t.x1 - t.x0, H = t.y1 - t.y0;
  g.fillStyle = '#84c95c'; g.fillRect(t.x0, t.y0, W, H);
  for (let k = 0; k < 26; k++) U.blob(g, t.x0 + R() * W, t.y0 + R() * H, 120 + R() * 200, 90 + R() * 140, R() * 3, R, k % 3 ? 'rgba(176,228,124,0.26)' : 'rgba(58,138,48,0.18)');
  g.strokeStyle = 'rgba(52,124,40,0.3)'; g.lineWidth = 2; g.lineCap = 'round'; g.beginPath();   // brins d'herbe imprimés
  for (let k = 0; k < 1100; k++) { const x = t.x0 + R() * W, y = t.y0 + R() * H; g.moveTo(x - 4, y - 6); g.lineTo(x, y); g.lineTo(x + 5, y - 7); }
  g.stroke();
  for (const col of ['#ffffff', '#ff6a8a', '#ffe14a']) { g.fillStyle = col; g.beginPath(); for (let k = 0; k < 90; k++) rond(g, t.x0 + R() * W, t.y0 + R() * H, 4); g.fill(); }   // fleurettes
  for (const ch of CHAMPS) champ(g, ch);
  // cour de ferme en terre battue, enclos boueux des cochons, chemin du tracteur (deux ornières)
  U.blob(g, 3340, 640, 300, 150, 0.05, R, '#d3b277'); U.blob(g, 3480, 1140, 210, 62, 0, R, '#a9784a');
  g.save(); g.lineJoin = 'round';
  courbe(g, TRACTEUR, true); g.strokeStyle = '#cfa96c'; g.lineWidth = 48; g.stroke(); g.strokeStyle = 'rgba(122,82,40,0.45)'; g.lineWidth = 32; g.stroke(); g.strokeStyle = '#cfa96c'; g.lineWidth = 18; g.stroke();
  g.beginPath(); g.moveTo(3200, 660); g.quadraticCurveTo(3000, 1000, 2700, 1140); g.strokeStyle = 'rgba(207,169,108,0.8)'; g.lineWidth = 26; g.stroke();   // sentier vers le verger
  g.restore();
  // place du village pavée, ruelle vers l'église, parking
  g.fillStyle = '#e6dbc1'; g.beginPath(); rrect(g, 1860, 1880, 360, 150, 26); g.fill(); g.fillRect(2008, 1730, 64, 160);
  g.fillStyle = 'rgba(150,130,96,0.35)'; g.beginPath(); for (let y = 1894; y < 2020; y += 18) for (let x = 1874 + (y % 36 ? 9 : 0); x < 2210; x += 18) g.rect(x, y, 12, 12); g.fill();
  g.strokeStyle = '#ffffff'; g.lineWidth = 3; g.beginPath(); for (let x = 1910; x <= 2170; x += 80) { g.moveTo(x, 1898); g.lineTo(x, 1950); } g.stroke();
  // rivière (berges de sable, eau, reflets) puis l'étang
  g.save(); g.lineCap = 'round'; g.lineJoin = 'round';
  courbe(g, RIV, false); g.strokeStyle = '#e3cf8e'; g.lineWidth = 132; g.stroke();
  g.strokeStyle = '#3c98dc'; g.lineWidth = 104; g.stroke(); g.strokeStyle = '#5db3ee'; g.lineWidth = 62; g.stroke();
  g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 4; g.setLineDash([24, 46]); g.stroke(); g.setLineDash([]);
  g.restore();
  const E = ETANG;
  g.fillStyle = '#e3cf8e'; g.beginPath(); contour(g, E[0], E[1], E[2] + 18, E[3] + 18, 0.07); g.fill();
  g.fillStyle = rad(g, E[0] - 40, E[1] - 30, 20, E[2] + 20, ['#7fc8f4', '#3f9ce0', '#2a7cc4']); g.beginPath(); contour(g, E[0], E[1], E[2], E[3], 0.07); g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.45)'; g.lineWidth = 3; g.beginPath();
  for (const q of [[760, 1080, 60], [930, 1220, 46], [720, 1250, 34]]) { g.moveTo(q[0] + q[2], q[1]); g.arc(q[0], q[1], q[2], 0, 1.4); g.moveTo(q[0] + q[2] * 0.6, q[1]); g.arc(q[0], q[1], q[2] * 0.6, 3.3, 4.6); }
  g.stroke();
  g.fillStyle = '#4fae4a'; g.beginPath(); for (const q of [[690, 1120], [990, 1060], [1010, 1200], [760, 1290], [905, 1300]]) { g.moveTo(q[0], q[1]); g.arc(q[0], q[1], 17, 0.5, TAU); g.closePath(); } g.fill();   // nénuphars
  disque(g, 994, 1056, 5, '#ff8ab0'); disque(g, 764, 1286, 5, '#ffffff');
}
function bord(g, c) {                                 // bordure molletonnée du tapis : bande bleue, passepoil jaune, piqûres
  const t = c.table, w = t.x1 - t.x0, h = t.y1 - t.y0, k = (i, lw, col, dash) => {
    g.lineWidth = lw; g.strokeStyle = col; if (dash) g.setLineDash(dash); g.beginPath(); rrect(g, t.x0 + i, t.y0 + i, w - 2 * i, h - 2 * i, Math.max(6, t.r - i)); g.stroke(); if (dash) g.setLineDash([]);
  };
  g.save(); g.lineJoin = 'round';
  k(64, 12, 'rgba(18,52,10,0.18)'); k(24, 48, '#2f6fd6'); k(8, 14, '#2257b4'); k(50, 8, '#ffd23a'); k(57, 3, '#e8322a');
  k(24, 2, 'rgba(255,255,255,0.65)', [12, 10]); k(38, 2, 'rgba(255,255,255,0.4)', [12, 10]);
  g.restore();
}

// ── la route du tapis : trottoir, bitume, lignes blanches, vibreurs ; glissières du grand rond, clôtures de la ferme ──
function piste(g, c, R, U) {
  const W = c.W, n = c.n;
  g.lineJoin = 'round'; g.lineCap = 'round';
  g.save(); g.translate(4, 6); U.centerStroke(g, c, 2 * W + 30, 'rgba(18,52,10,0.2)'); g.restore();
  U.centerStroke(g, c, 2 * W + 24, '#ddd8cb');          // trottoir
  U.centerStroke(g, c, 2 * W + 8, '#9b978d');           // bordure
  U.centerStroke(g, c, 2 * W, '#545a63');               // bitume
  for (let p = 0; p < 2; p++) {                         // grain du bitume (un seul remplissage par teinte)
    g.fillStyle = p ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.1)'; g.beginPath();
    for (let k = 0; k < n * 2; k++) { const i = Math.floor(R() * n), o = (R() * 2 - 1) * (W - 4); g.rect(c.sx[i] + c.nx[i] * o, c.sy[i] + c.ny[i] * o, 3, 3); }
    g.fill();
  }
  g.lineCap = 'butt';
  g.strokeStyle = 'rgba(246,246,240,0.9)'; g.lineWidth = 4; for (const sd of [-1, 1]) { U.trackPath(g, c, sd * (W - 10)); g.stroke(); }
  g.strokeStyle = '#f6f3e8'; g.lineWidth = 5; g.setLineDash([34, 26]); U.trackPath(g, c, 0); g.stroke(); g.setLineDash([]);
  // vibreurs rouges et blancs à la corde des virages serrés (rayon < 420 u)
  for (let s = 0; s < n;) {
    const sg = Math.abs(c.k[s]) > 1 / 420 ? (c.k[s] > 0 ? 1 : -1) : 0; let e = s; while (e + 1 < n && (Math.abs(c.k[e + 1]) > 1 / 420 ? (c.k[e + 1] > 0 ? 1 : -1) : 0) === sg) e++;
    if (sg && e - s > 4) {
      g.beginPath(); for (let i = s; i <= e; i++) { const p = pt(c, i, sg * (W - 5)); if (i === s) g.moveTo(p[0], p[1]); else g.lineTo(p[0], p[1]); }
      g.strokeStyle = '#f6f3ee'; g.lineWidth = 10; g.stroke(); g.strokeStyle = '#e0312a'; g.setLineDash([16, 16]); g.stroke(); g.setLineDash([]);
    }
    s = e + 1;
  }
  // murs « rail » / « cloture » en polylignes continues (les tirets ne repartent pas à chaque tronçon)
  const passe = (type, lw, col, dx, dy, dash, cap) => {
    let lx = 1e9, ly = 1e9; g.beginPath();
    for (const w of c.walls) if (w[5] === type) { if (Math.abs(w[0] - lx) > 0.5 || Math.abs(w[1] - ly) > 0.5) g.moveTo(w[0] + dx, w[1] + dy); g.lineTo(w[2] + dx, w[3] + dy); lx = w[2]; ly = w[3]; }
    g.lineWidth = lw; g.strokeStyle = col; g.lineCap = cap || 'round'; if (dash) g.setLineDash(dash); g.stroke(); if (dash) g.setLineDash([]);
  };
  passe('rail', 16, 'rgba(18,52,10,0.15)', 6, 9); passe('rail', 13, 'rgba(18,52,10,0.28)', 3, 5);
  passe('rail', 12, '#f4f3ef', 0, 0); passe('rail', 12, '#e0312a', 0, 0, [22, 22], 'butt'); passe('rail', 3, 'rgba(255,255,255,0.75)', -2, -3);
  passe('cloture', 10, 'rgba(18,52,10,0.22)', 4, 7);
  passe('cloture', 7, '#a06e3c', 0, 0); passe('cloture', 2, 'rgba(255,226,170,0.6)', -1, -2);
  passe('cloture', 13, '#6e4524', 0, 0, [7, 33], 'butt'); passe('cloture', 6, '#b5834e', -1, -1, [5, 35], 'butt');
}

// ── décor (dessiné autour de l'origine) ──
function boule(g, x, y, r, c0, c1) { g.fillStyle = rad(g, x - r * 0.35, y - r * 0.4, 2, r, [c0, c1]); g.beginPath(); rond(g, x, y, r); g.fill(); }
function botteRonde(g, x, y, r) {                    // botte de foin ronde vue de dessus : spirale de paille
  ombre(g, 0, 1, () => rond(g, x, y, r));
  g.fillStyle = rad(g, x - r * 0.3, y - r * 0.3, 2, r * 1.1, ['#f7e08e', '#e0b54c', '#b98b2e']); g.beginPath(); rond(g, x, y, r); g.fill();
  g.strokeStyle = 'rgba(140,96,20,0.55)'; g.lineWidth = 2; g.beginPath(); for (let k = 1; k <= 3; k++) { g.moveTo(x + r * k / 4, y); g.arc(x, y, r * k / 4, 0, TAU * 0.9); } g.stroke();
}
function vache(g, a) {                                // vache vue de dessus, tête vers +x
  ombre(g, a, 0.9, () => { ovale(g, 0, 0, 34, 20); ovale(g, 36, 0, 13, 11); });
  g.strokeStyle = '#3a2a20'; g.lineWidth = 3; g.lineCap = 'round'; g.beginPath(); g.moveTo(-32, 0); g.quadraticCurveTo(-44, 8, -50, -2); g.stroke();
  g.fillStyle = '#f7f5ef'; g.beginPath(); ovale(g, 0, 0, 34, 20); g.fill();
  g.fillStyle = '#26211e'; g.beginPath(); ovale(g, -12, -7, 11, 8); ovale(g, 8, 9, 9, 6); ovale(g, 17, -9, 6, 5); g.fill();
  g.fillStyle = '#e8d9a8'; g.beginPath(); g.moveTo(32, -8); g.lineTo(29, -19); g.lineTo(37, -9); g.moveTo(32, 8); g.lineTo(29, 19); g.lineTo(37, 9); g.fill();
  g.fillStyle = '#f7f5ef'; g.beginPath(); ovale(g, 35, 0, 12, 10); g.fill(); g.fillStyle = '#26211e'; g.beginPath(); ovale(g, 31, -4, 5, 4); g.fill();
  g.fillStyle = '#f2a6a8'; g.beginPath(); ovale(g, 46, 0, 6, 8); g.fill(); disque(g, 47, -3, 1.6, '#a85a5c'); disque(g, 47, 3, 1.6, '#a85a5c');
}
function poule(g, x, y, a) {
  g.save(); g.translate(x, y); g.rotate(a);
  g.fillStyle = 'rgba(18,52,10,0.25)'; g.beginPath(); ovale(g, 3, 4, 15, 10); g.fill();
  g.fillStyle = '#5a4a3a'; g.beginPath(); g.moveTo(-10, 0); g.lineTo(-19, -6); g.lineTo(-18, 6); g.fill();
  g.fillStyle = '#fbfaf4'; g.beginPath(); ovale(g, 0, 0, 13, 9); g.fill(); g.fillStyle = '#e6e2d6'; g.beginPath(); ovale(g, -2, 0, 7, 6); g.fill();
  disque(g, 11, 0, 6, '#fbfaf4'); disque(g, 12, 0, 3, '#e8322a'); g.fillStyle = '#f2a31c'; g.beginPath(); g.moveTo(16, -2); g.lineTo(21, 0); g.lineTo(16, 2); g.fill();
  g.restore();
}
const DECOR = {
  sapin(g, d) {                                       // sapin de plastique : étoiles de branches superposées
    const s = d[3] || 1; g.scale(s, s);
    ombre(g, 0, 1.4, () => etoile(g, 0, 0, 50, 36, 9, 0));
    const C = ['#1d6430', '#2a803e', '#3c9e50'];
    for (let k = 0; k < 3; k++) { g.fillStyle = C[k]; g.beginPath(); etoile(g, 0, 0, 50 - k * 14, 36 - k * 11, 9, k * 0.35); g.fill(); }
    disque(g, -3, -3, 6, '#78cc6c');
  },
  arbre(g, d) {                                       // arbre en plastique : boules de feuillage
    const s = d[3] || 1; g.scale(s, s);
    ombre(g, 0, 1.6, () => rond(g, 0, 0, 54));
    for (const q of [[0, 0, 46], [-30, -16, 30], [28, -20, 28], [24, 24, 30], [-26, 24, 28]]) boule(g, q[0], q[1], q[2], '#93e27c', '#2e8a3a');
  },
  pommier(g, d, R) {                                  // pommier du verger : feuillage rond, pommes rouges, pommes tombées
    ombre(g, 0, 1.4, () => rond(g, 0, 0, 44));
    for (const q of [[0, 0, 40], [-22, -14, 24], [22, -12, 24], [10, 22, 26]]) boule(g, q[0], q[1], q[2], '#a6e070', '#3c9a3a');
    g.fillStyle = '#e2302a'; g.beginPath(); for (let k = 0; k < 8; k++) { const a = k * 0.8 + R(), r = 12 + R() * 22; rond(g, Math.cos(a) * r, Math.sin(a) * r, 5); } g.fill();
    g.fillStyle = 'rgba(255,255,255,0.6)'; g.beginPath(); for (let k = 0; k < 8; k++) { const a = k * 0.8 + 0.4, r = 14 + (k % 3) * 8; rond(g, Math.cos(a) * r - 1.5, Math.sin(a) * r - 1.5, 1.5); } g.fill();
    g.fillStyle = '#c42620'; g.beginPath(); rond(g, 52, 30, 5); rond(g, 44, 42, 5); rond(g, -48, 36, 5); g.fill();
  },
  tente(g, d) {                                       // tente canadienne orange et feu de camp
    const a = d[3] || 0; g.rotate(a);
    const P = [[-52, -40], [52, -40], [64, 0], [52, 40], [-52, 40], [-64, 0]];
    ombre(g, a, 1.2, () => poly(g, P));
    g.fillStyle = '#f28c28'; g.beginPath(); poly(g, [[-52, -40], [52, -40], [64, 0], [-64, 0]]); g.fill();
    g.fillStyle = '#d4691a'; g.beginPath(); poly(g, [[-64, 0], [64, 0], [52, 40], [-52, 40]]); g.fill();
    g.strokeStyle = '#fff1d0'; g.lineWidth = 3; g.beginPath(); g.moveTo(-64, 0); g.lineTo(64, 0); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 1.2; g.beginPath(); for (const p of P) { g.moveTo(p[0], p[1]); g.lineTo(p[0] * 1.35, p[1] * 1.5); } g.stroke();
    g.fillStyle = '#8c8c90'; g.beginPath(); for (let k = 0; k < 8; k++) rond(g, Math.cos(k * 0.785) * 20, 86 + Math.sin(k * 0.785) * 20, 6); g.fill();
    g.fillStyle = '#ff7a1a'; g.beginPath(); etoile(g, 0, 86, 15, 6, 6, 0.2); g.fill(); g.fillStyle = '#ffe14a'; g.beginPath(); etoile(g, 0, 86, 8, 3, 5, 0); g.fill();
  },
  roseaux(g, d, R) {                                  // touffe de roseaux et de massettes au bord de l'eau
    g.strokeStyle = '#3d8a36'; g.lineWidth = 3; g.lineCap = 'round'; g.beginPath(); const B = [];
    for (let k = 0; k < 16; k++) { const a = R() * TAU, r0 = R() * 24, x = Math.cos(a) * r0, y = Math.sin(a) * r0, b = a + (R() - 0.5) * 0.8, l = 18 + R() * 22; g.moveTo(x, y); g.lineTo(x + Math.cos(b) * l, y + Math.sin(b) * l); B.push([x + Math.cos(b) * l, y + Math.sin(b) * l]); }
    g.stroke(); g.fillStyle = '#7a4a22'; g.beginPath(); for (let k = 0; k < 7; k++) ovale(g, B[k][0], B[k][1], 4, 4); g.fill();
  },
  barque(g, d) {                                      // barque de bois et ses rames sur l'étang
    g.rotate(d[3] || 0);
    const coque = () => { g.moveTo(-46, -16); g.lineTo(18, -18); g.quadraticCurveTo(50, -13, 58, 0); g.quadraticCurveTo(50, 13, 18, 18); g.lineTo(-46, 16); g.quadraticCurveTo(-52, 0, -46, -16); g.closePath(); };
    g.strokeStyle = 'rgba(255,255,255,0.45)'; g.lineWidth = 3; g.beginPath(); ovale(g, 4, 0, 74, 34); g.stroke();
    g.fillStyle = 'rgba(10,40,80,0.25)'; g.save(); g.translate(5, 7); g.beginPath(); coque(); g.fill(); g.restore();
    g.fillStyle = '#8a5a2e'; g.beginPath(); coque(); g.fill();
    g.fillStyle = '#c99454'; g.save(); g.scale(0.84, 0.72); g.beginPath(); coque(); g.fill(); g.restore();
    g.fillStyle = '#6e4524'; g.fillRect(-26, -13, 9, 26); g.fillRect(12, -12, 9, 24);
    g.strokeStyle = '#d9b07a'; g.lineWidth = 4; g.beginPath(); g.moveTo(-6, -14); g.lineTo(-18, -52); g.moveTo(-6, 14); g.lineTo(-18, 52); g.stroke();
    g.fillStyle = '#d9b07a'; g.beginPath(); ovale(g, -20, -58, 6, 10); ovale(g, -20, 58, 6, 10); g.fill();
  },
  ponton(g, d) {                                      // ponton de planches qui avance sur l'eau
    const a = d[3] || 0; g.rotate(a);
    ombre(g, a, 0.5, () => g.rect(0, -22, 132, 44));
    for (let x = 0, k = 0; x < 132; x += 12, k++) { g.fillStyle = k % 2 ? '#c99a5e' : '#b8874a'; g.fillRect(x, -22, 11, 44); }
    for (const p of [[4, -24], [4, 24], [126, -24], [126, 24], [66, -24], [66, 24]]) disque(g, p[0], p[1], 5, '#6e4524');
  },
  pique(g, d) {                                       // nappe de pique-nique à carreaux, panier, assiettes
    const a = d[3] || 0; g.rotate(a);
    ombre(g, a, 0.25, () => g.rect(-62, -62, 124, 124));
    g.fillStyle = '#fbf6ee'; g.fillRect(-62, -62, 124, 124);
    g.fillStyle = 'rgba(226,48,42,0.85)'; for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) if ((i + j) % 2) g.fillRect(-62 + i * 20.7, -62 + j * 20.7, 20.7, 20.7);
    ombre(g, a, 0.6, () => rrect(g, -18, -34, 50, 34, 6));
    g.fillStyle = '#b07a3a'; g.beginPath(); rrect(g, -18, -34, 50, 34, 6); g.fill(); g.strokeStyle = '#7a4e20'; g.lineWidth = 4; g.beginPath(); g.moveTo(-12, -17); g.quadraticCurveTo(7, -52, 26, -17); g.stroke();
    for (const p of [[-30, 28], [28, 30]]) { disque(g, p[0], p[1], 15, '#ffffff'); cercleP(g, p[0], p[1], 10, '#d8d8de'); }
    disque(g, -30, 28, 6, '#e8322a'); disque(g, 28, 30, 7, '#f2c230');
  },
  moulin(g, d) {                                      // moulin à vent : tour de pierre, toit conique, quatre ailes en treillis
    const a = d[3] || 0.5;
    const ailes = (dx, dy, col) => { g.save(); g.translate(dx, dy); g.fillStyle = col; for (let k = 0; k < 4; k++) { g.save(); g.rotate(a + k * Math.PI / 2); g.fillRect(12, -5, 140, 10); g.fillRect(44, 5, 106, 30); g.restore(); } g.restore(); };
    ombre(g, 0, 2.6, () => rond(g, 0, 0, 56)); ailes(22, 32, 'rgba(18,52,10,0.12)'); ailes(11, 16, 'rgba(18,52,10,0.2)');
    g.fillStyle = rad(g, -16, -16, 6, 62, ['#fbf3e0', '#e0cfae', '#b39c72']); g.beginPath(); rond(g, 0, 0, 56); g.fill();
    g.strokeStyle = 'rgba(120,96,60,0.35)'; g.lineWidth = 2; g.beginPath(); rond(g, 0, 0, 50); g.stroke();
    g.fillStyle = rad(g, -10, -10, 4, 44, ['#c86a3a', '#9a3a1e', '#6e2410']); g.beginPath(); rond(g, 0, 0, 42); g.fill();
    g.strokeStyle = 'rgba(60,16,6,0.45)'; g.lineWidth = 2; g.beginPath(); for (let k = 0; k < 12; k++) { const b = k * TAU / 12; g.moveTo(Math.cos(b) * 8, Math.sin(b) * 8); g.lineTo(Math.cos(b) * 42, Math.sin(b) * 42); } g.stroke();
    for (let k = 0; k < 4; k++) {
      g.save(); g.rotate(a + k * Math.PI / 2);
      g.fillStyle = '#f6efdc'; g.fillRect(44, 5, 106, 30);
      g.strokeStyle = '#8a6a44'; g.lineWidth = 2; g.beginPath(); for (let x = 44; x <= 150; x += 15) { g.moveTo(x, 5); g.lineTo(x, 35); } g.moveTo(44, 20); g.lineTo(150, 20); g.rect(44, 5, 106, 30); g.stroke();
      g.fillStyle = '#7a5634'; g.fillRect(10, -5, 144, 10);
      g.restore();
    }
    disque(g, 0, 0, 10, '#5a3a20'); disque(g, -2, -2, 4, '#c8a070');
  },
  epouvantail(g) {                                    // épouvantail : bras de bois, chemise à carreaux, chapeau de paille, corbeau
    ombre(g, 0, 1.8, () => { g.rect(-52, -6, 104, 12); rond(g, 0, 0, 24); });
    g.fillStyle = '#8a5a2e'; g.fillRect(-52, -4, 104, 8);
    g.strokeStyle = '#f2cf5a'; g.lineWidth = 3; g.lineCap = 'round'; g.beginPath(); for (const s of [-1, 1]) for (let k = -2; k <= 2; k++) { g.moveTo(s * 50, 0); g.lineTo(s * 62, k * 5); } g.stroke();
    g.fillStyle = '#2f6fd6'; g.beginPath(); rrect(g, -28, -18, 56, 36, 6); g.fill();
    g.strokeStyle = 'rgba(226,48,42,0.7)'; g.lineWidth = 3; g.beginPath(); for (let k = -20; k <= 20; k += 10) { g.moveTo(k, -18); g.lineTo(k, 18); g.moveTo(-28, k * 0.8); g.lineTo(28, k * 0.8); } g.stroke();
    disque(g, 0, 0, 24, '#e8c45a'); cercleP(g, 0, 0, 14, '#c8322a'); disque(g, 0, 0, 12, '#d9b040');
    g.fillStyle = '#1e1e22'; g.beginPath(); ovale(g, 46, -40, 10, 6); g.fill(); g.beginPath(); g.moveTo(54, -44); g.lineTo(62, -40); g.lineTo(54, -37); g.fillStyle = '#f2a31c'; g.fill();
  },
  bottes(g) { for (const b of [[-30, 12, 25], [27, 16, 25], [0, -28, 25]]) botteRonde(g, b[0], b[1], b[2]); },
  poules(g) {                                         // poules, poussins et grains éparpillés
    g.fillStyle = '#e8c45a'; g.beginPath(); for (let k = 0; k < 18; k++) rond(g, Math.cos(k * 2.4) * (10 + k * 3), Math.sin(k * 2.4) * (8 + k * 2), 2); g.fill();
    poule(g, 0, 0, 0.3); poule(g, 36, 14, 2.2); poule(g, -30, 20, 4); poule(g, 12, -30, 1.2);
    for (const p of [[46, -12], [54, -2], [-44, -8]]) { disque(g, p[0] + 2, p[1] + 3, 6, 'rgba(18,52,10,0.25)'); disque(g, p[0], p[1], 6, '#ffe14a'); disque(g, p[0] + 4, p[1], 1.8, '#f2a31c'); }
  },
  grange(g, d) {                                      // grange rouge : toit de tôle à deux pans, faîtage blanc, lanterneau, appentis
    const a = d[3] || 0; g.rotate(a);
    ombre(g, a, 1.8, () => { g.rect(-124, -80, 248, 160); g.rect(-124, 80, 130, 40); });
    g.fillStyle = '#8f969e'; g.fillRect(-124, 80, 130, 40); g.strokeStyle = 'rgba(40,44,50,0.4)'; g.lineWidth = 2; g.beginPath(); for (let x = -116; x < 6; x += 12) { g.moveTo(x, 80); g.lineTo(x, 120); } g.stroke();
    g.fillStyle = '#cc342a'; g.fillRect(-124, -80, 248, 80); g.fillStyle = '#a3241e'; g.fillRect(-124, 0, 248, 80);
    g.strokeStyle = 'rgba(90,10,10,0.35)'; g.lineWidth = 2; g.beginPath(); for (let x = -114; x < 124; x += 15) { g.moveTo(x, -80); g.lineTo(x, 80); } g.stroke();
    g.strokeStyle = '#f4efe4'; g.lineWidth = 6; g.strokeRect(-124, -80, 248, 160); g.fillStyle = '#f4efe4'; g.fillRect(-126, -4, 252, 8);
    ombre(g, a, 0.6, () => g.rect(-20, -20, 40, 40));
    g.fillStyle = '#7a1a14'; g.fillRect(-20, -20, 40, 40); g.fillStyle = '#e04a3a'; g.fillRect(-20, -20, 40, 20); g.fillStyle = '#f4efe4'; g.fillRect(-21, -2, 42, 4);
    g.strokeStyle = '#2a2a2e'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(-14, -30); g.lineTo(14, -30); g.moveTo(0, -38); g.lineTo(0, -22); g.stroke();
  },
  silo(g) {                                           // silo de métal : cylindre vu d'en haut, dôme, échelle
    ombre(g, 0, 3, () => { rond(g, 0, 0, 46); rond(g, 70, 30, 30); });
    for (const s of [[70, 30, 30], [0, 0, 46]]) {
      g.fillStyle = rad(g, s[0] - s[2] * 0.3, s[1] - s[2] * 0.35, 3, s[2] * 1.05, ['#f4f6f8', '#b9c5d0', '#7d8b98']); g.beginPath(); rond(g, s[0], s[1], s[2]); g.fill();
      g.strokeStyle = 'rgba(70,82,96,0.45)'; g.lineWidth = 2; g.beginPath(); rond(g, s[0], s[1], s[2] * 0.72); rond(g, s[0], s[1], s[2] * 0.42); g.stroke();
      disque(g, s[0], s[1], s[2] * 0.18, '#e8edf2');
    }
    g.strokeStyle = '#4a5560'; g.lineWidth = 2; g.beginPath(); g.moveTo(-6, 8); g.lineTo(-6, 46); g.moveTo(6, 8); g.lineTo(6, 46); for (let y = 14; y < 46; y += 7) { g.moveTo(-6, y); g.lineTo(6, y); } g.stroke();
  },
  vache(g, d) { g.rotate(d[3] || 0); vache(g, d[3] || 0); },
  cochon(g, d) {                                      // cochon rose, taches de boue, queue en tire-bouchon
    const a = d[3] || 0; g.rotate(a);
    ombre(g, a, 0.8, () => { ovale(g, 0, 0, 32, 21); ovale(g, 30, 0, 14, 13); });
    g.strokeStyle = '#e8899c'; g.lineWidth = 3; g.beginPath(); g.moveTo(-31, 0); g.bezierCurveTo(-44, -10, -46, 8, -38, 6); g.stroke();
    g.fillStyle = '#f6abba'; g.beginPath(); ovale(g, 0, 0, 32, 21); g.fill(); g.fillStyle = 'rgba(255,255,255,0.3)'; g.beginPath(); ovale(g, -4, -6, 20, 8); g.fill();
    g.fillStyle = 'rgba(122,82,40,0.75)'; g.beginPath(); ovale(g, -14, 8, 8, 5); ovale(g, 6, -10, 5, 4); g.fill();
    g.fillStyle = '#f6abba'; g.beginPath(); ovale(g, 30, 0, 14, 13); g.fill();
    g.fillStyle = '#e8899c'; g.beginPath(); g.moveTo(24, -10); g.lineTo(30, -22); g.lineTo(36, -9); g.moveTo(24, 10); g.lineTo(30, 22); g.lineTo(36, 9); g.fill();
    disque(g, 42, 0, 7, '#e8899c'); disque(g, 43, -2.5, 1.6, '#9a4a5a'); disque(g, 43, 2.5, 1.6, '#9a4a5a');
  },
  mouton(g, d) {                                      // mouton : toison de boules blanches, tête noire
    const a = d[3] || 0; g.rotate(a);
    ombre(g, a, 0.8, () => ovale(g, 0, 0, 32, 23));
    g.fillStyle = '#f6f4ee'; g.beginPath(); for (let k = 0; k < 10; k++) rond(g, Math.cos(k * 0.628) * 22, Math.sin(k * 0.628) * 14, 11); rond(g, 0, 0, 16); g.fill();
    g.fillStyle = 'rgba(190,186,176,0.7)'; g.beginPath(); for (let k = 0; k < 10; k++) rond(g, Math.cos(k * 0.628 + 0.3) * 14, Math.sin(k * 0.628 + 0.3) * 8, 3); g.fill();
    g.fillStyle = '#26232a'; g.beginPath(); ovale(g, 32, 0, 11, 8); ovale(g, 27, -10, 6, 3); ovale(g, 27, 10, 6, 3); g.fill();
    disque(g, 35, -3, 1.6, '#ffffff'); disque(g, 35, 3, 1.6, '#ffffff');
  },
  eglise(g, d) {                                      // église du village : nef couverte d'ardoise, clocher carré, croix dorée
    const a = d[3] || 0; g.rotate(a);
    ombre(g, a, 2, () => { g.rect(-116, -52, 200, 104); g.rect(-36, -84, 60, 168); g.rect(84, -40, 80, 80); });
    const toit = (x, y, w, h, c1, c2, sens) => { g.fillStyle = c1; if (sens) g.fillRect(x, y, w / 2, h); else g.fillRect(x, y, w, h / 2); g.fillStyle = c2; if (sens) g.fillRect(x + w / 2, y, w / 2, h); else g.fillRect(x, y + h / 2, w, h / 2); };
    toit(-116, -52, 200, 104, '#6f80a0', '#56657f', false); toit(-36, -84, 60, 168, '#6f80a0', '#56657f', true);
    g.strokeStyle = 'rgba(30,36,56,0.3)'; g.lineWidth = 1.5; g.beginPath(); for (let x = -110; x < 84; x += 10) { g.moveTo(x, -52); g.lineTo(x, 52); } g.stroke();
    g.fillStyle = '#e9e4d8'; g.fillRect(-118, -3, 202, 6); g.fillRect(-9, -86, 6, 172);
    const P = [[84, -40], [164, -40], [164, 40], [84, 40]], C = [124, 0], S = ['#7d8db0', '#5d6c8c', '#4c5a78', '#6a7a9c'];
    for (let k = 0; k < 4; k++) { g.fillStyle = S[k]; g.beginPath(); g.moveTo(P[k][0], P[k][1]); g.lineTo(P[(k + 1) % 4][0], P[(k + 1) % 4][1]); g.lineTo(C[0], C[1]); g.closePath(); g.fill(); }
    g.strokeStyle = '#f2c230'; g.lineWidth = 4; g.lineCap = 'round'; g.beginPath(); g.moveTo(124, -14); g.lineTo(124, 14); g.moveTo(114, -4); g.lineTo(134, -4); g.stroke();
  },
  maison(g, d) {                                      // maison du village : toit à deux pans (4 couleurs), cheminée, lucarne, jardinet
    const v = d[3] || 0, a = d[4] || 0, T1 = ['#e2452f', '#2f6fd6', '#f2a32a', '#8a4ad8'][v % 4], T2 = ['#b8301f', '#2257b4', '#d0841a', '#6a32b0'][v % 4];
    g.rotate(a);
    ombre(g, a, 0.3, () => rrect(g, -88, -70, 176, 150, 14));
    g.fillStyle = '#9bd870'; g.beginPath(); rrect(g, -88, -70, 176, 150, 14); g.fill();
    g.strokeStyle = '#ffffff'; g.lineWidth = 3; g.setLineDash([4, 6]); g.stroke(); g.setLineDash([]);
    g.fillStyle = '#e6dbc1'; g.fillRect(-10, 46, 20, 34);
    ombre(g, a, 1.3, () => g.rect(-66, -50, 132, 96));
    g.fillStyle = T1; g.fillRect(-66, -50, 132, 48); g.fillStyle = T2; g.fillRect(-66, -2, 132, 48);
    g.strokeStyle = 'rgba(0,0,0,0.18)'; g.lineWidth = 2; g.beginPath(); for (let y = -42; y < 46; y += 11) { g.moveTo(-66, y); g.lineTo(66, y); } g.stroke();
    g.fillStyle = '#fff6e0'; g.fillRect(-68, -4, 136, 5);
    g.fillStyle = '#8a8f98'; g.fillRect(30, -40, 18, 20); g.fillStyle = '#3a3a40'; g.fillRect(33, -37, 12, 14);
    g.fillStyle = '#fff6e0'; g.fillRect(-36, 12, 26, 20); g.fillStyle = '#7fc4f0'; g.fillRect(-32, 16, 18, 12);
    disque(g, 66, 58, 14, '#3c9a3a'); disque(g, 62, 54, 7, '#6cc45a');
  },
  station(g) {                                        // station-service : dalle, boutique, auvent sur deux îlots, totem des prix
    ombre(g, 0, 0.3, () => rrect(g, -160, -100, 320, 200, 18));
    g.fillStyle = '#d9dbde'; g.beginPath(); rrect(g, -160, -100, 320, 200, 18); g.fill();
    g.strokeStyle = 'rgba(120,124,130,0.35)'; g.lineWidth = 2; g.beginPath(); for (let x = -120; x < 160; x += 40) { g.moveTo(x, -100); g.lineTo(x, 100); } g.moveTo(-160, 0); g.lineTo(160, 0); g.stroke();
    ombre(g, 0, 1.2, () => g.rect(-150, -92, 110, 64));
    g.fillStyle = '#2f6fd6'; g.fillRect(-150, -92, 110, 64); g.fillStyle = '#2257b4'; g.fillRect(-150, -60, 110, 32); g.fillStyle = '#ffffff'; g.fillRect(-150, -62, 110, 4);
    ombre(g, 0, 2.2, () => g.rect(-30, -34, 180, 108));
    g.fillStyle = '#f8f8f4'; g.fillRect(-30, -34, 180, 108); g.strokeStyle = '#e2312a'; g.lineWidth = 12; g.strokeRect(-24, -28, 168, 96);
    disque(g, 60, 20, 26, '#ffd23a'); g.fillStyle = '#e2312a'; g.beginPath(); g.moveTo(60, 4); g.quadraticCurveTo(74, 22, 60, 34); g.quadraticCurveTo(46, 22, 60, 4); g.fill();
    g.fillStyle = '#2a2d33'; g.fillRect(-140, 60, 14, 14); g.fillStyle = '#e2312a'; g.fillRect(-152, 40, 38, 22); g.fillStyle = '#ffd23a'; g.fillRect(-148, 44, 30, 5); g.fillRect(-148, 52, 30, 5);
  },
  voiture(g, d) {                                     // petite voiture garée
    const a = d[4] || 0, C = ['#e2312a', '#2f6fd6', '#ffd23a', '#2bb45a', '#f28c28'][(d[3] || 0) % 5]; g.rotate(a);
    ombre(g, a, 0.7, () => rrect(g, -30, -16, 60, 32, 9));
    g.fillStyle = C; g.beginPath(); rrect(g, -30, -16, 60, 32, 9); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.28)'; g.beginPath(); rrect(g, -26, -13, 52, 8, 4); g.fill();
    g.fillStyle = '#28323e'; g.beginPath(); rrect(g, 2, -12, 13, 24, 4); rrect(g, -24, -11, 9, 22, 3); g.fill();
    g.fillStyle = '#fff3a0'; g.fillRect(27, -12, 3, 6); g.fillRect(27, 6, 3, 6); g.fillStyle = '#ff4a3a'; g.fillRect(-30, -12, 3, 6); g.fillRect(-30, 6, 3, 6);
  },
  fontaine(g) {                                       // fontaine de la place : bassin de pierre, jet d'eau, rides
    ombre(g, 0, 0.8, () => rond(g, 0, 0, 36));
    disque(g, 0, 0, 36, '#cfc6b4'); disque(g, 0, 0, 29, '#5db3ee'); cercleP(g, 0, 0, 20, 'rgba(255,255,255,0.6)'); cercleP(g, 0, 0, 12, 'rgba(255,255,255,0.5)');
    disque(g, 0, 0, 7, '#cfc6b4'); disque(g, -1, -1, 3.5, '#ffffff');
  },
  mare(g) {                                           // petite mare : une cane et ses canetons en file
    g.fillStyle = '#e3cf8e'; g.beginPath(); contour(g, 0, 0, 84, 60, 0.08); g.fill();
    g.fillStyle = rad(g, -14, -10, 6, 78, ['#7fc8f4', '#3f9ce0']); g.beginPath(); contour(g, 0, 0, 72, 49, 0.08); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.45)'; g.lineWidth = 2; g.beginPath(); g.moveTo(-6, 10); g.lineTo(-62, 4); g.stroke();
    g.fillStyle = '#f4efe4'; g.beginPath(); ovale(g, 0, 10, 15, 10); g.fill(); disque(g, 13, 10, 7, '#2f7a4a'); g.fillStyle = '#f2a31c'; g.fillRect(19, 8, 7, 4);
    for (let k = 1; k <= 3; k++) { disque(g, -14 - k * 16, 8 - k * 1.5, 6, '#ffe14a'); disque(g, -9 - k * 16, 8 - k * 1.5, 3.5, '#ffd23a'); }
  },
  massif(g, d, R) {                                   // massif de fleurs : terre, feuilles, fleurs de trois couleurs
    ombre(g, 0, 0.4, () => rond(g, 0, 0, 44));
    disque(g, 0, 0, 44, '#9a6a3c'); disque(g, 0, 0, 38, '#6e4524');
    g.fillStyle = '#3f9a3a'; g.beginPath(); for (let k = 0; k < 16; k++) { const a = k * 2.4, r = 6 + (k % 5) * 6.5; rond(g, Math.cos(a) * r, Math.sin(a) * r, 7); } g.fill();
    for (const col of ['#ff5a7a', '#ffe14a', '#ffffff']) { g.fillStyle = col; g.beginPath(); for (let k = 0; k < 7; k++) { const a = R() * TAU, r = R() * 32; rond(g, Math.cos(a) * r, Math.sin(a) * r, 4.5); } g.fill(); }
  },
  panneau(g) {                                        // panneau « virages » sur son socle
    ombre(g, 0, 1.6, () => poly(g, [[0, -36], [32, 18], [-32, 18]]));
    disque(g, 0, 26, 12, '#8a8f98'); g.fillStyle = '#6a6e76'; g.fillRect(-3, 10, 6, 16);
    g.lineJoin = 'round'; g.fillStyle = '#ffffff'; g.strokeStyle = '#e2312a'; g.lineWidth = 7; g.beginPath(); poly(g, [[0, -36], [32, 18], [-32, 18]]); g.fill(); g.stroke();
    g.strokeStyle = '#1e1e22'; g.lineWidth = 4; g.lineCap = 'round'; g.beginPath(); g.moveTo(-8, 10); g.lineTo(-8, -6); g.arc(0, -6, 8, Math.PI, 0); g.lineTo(8, 10); g.stroke();
  },
};
function cercleP(g, x, y, r, col) { g.strokeStyle = col; g.lineWidth = 2; g.beginPath(); rond(g, x, y, r); g.stroke(); }

// ── obstacles de la piste ──
const OBJETS = {
  botte(g, r) { botteRonde(g, r[0], r[1], r[2]); },
  vache(g, r) { g.save(); g.translate(r[0], r[1]); g.rotate(-0.5); g.scale(r[2] / 26, r[2] / 26); vache(g, -0.5); g.restore(); },
  plot(g, r) {                                        // plot de chantier en caoutchouc (rebondit) : socle carré, cône orange
    const x = r[0], y = r[1], q = r[2];
    ombre(g, 0, 1.4, () => rrect(g, x - q, y - q, 2 * q, 2 * q, 4));
    g.fillStyle = '#c4520f'; g.beginPath(); rrect(g, x - q, y - q, 2 * q, 2 * q, 4); g.fill();
    g.fillStyle = rad(g, x - q * 0.3, y - q * 0.3, 1, q * 0.9, ['#ffb060', '#ff7a1a']); g.beginPath(); rond(g, x, y, q * 0.82); g.fill();
    g.strokeStyle = '#ffffff'; g.lineWidth = 3.5; g.beginPath(); rond(g, x, y, q * 0.5); g.stroke(); disque(g, x, y, q * 0.2, '#ffd0a0');
  },
};
// ── zones : boue laissée par le tracteur (freine), flaque d'eau (glisse) ──
const ZONES = {
  boue(g, z, R, U) {
    g.save(); g.translate(z[0], z[1]); g.rotate(z[5]);
    U.blob(g, 0, 0, z[2], z[3], 0, R, 'rgba(112,72,34,0.88)'); U.blob(g, 6, 2, z[2] * 0.62, z[3] * 0.55, 0.4, R, 'rgba(78,46,18,0.6)');
    g.strokeStyle = 'rgba(62,36,14,0.55)'; g.lineWidth = 7; g.setLineDash([9, 7]); g.beginPath(); for (const y of [-12, 12]) { g.moveTo(-z[2] * 1.3, y); g.lineTo(z[2] * 1.2, y + 4); } g.stroke(); g.setLineDash([]);
    g.restore();
  },
  flaque(g, z, R, U) {
    g.save(); g.translate(z[0], z[1]); g.rotate(z[5]);
    U.blob(g, 0, 0, z[2], z[3], 0, R, 'rgba(112,164,206,0.78)'); U.blob(g, -6, -4, z[2] * 0.6, z[3] * 0.5, 0.3, R, 'rgba(176,214,240,0.6)');
    g.fillStyle = 'rgba(255,255,255,0.7)'; g.beginPath(); ovale(g, -z[2] * 0.3, -z[3] * 0.3, 14, 4); ovale(g, z[2] * 0.25, z[3] * 0.1, 8, 3); g.fill();
    g.restore();
  },
};
// ── obstacles mobiles (à chaque image : sobres) ──
const MOBILES = {
  tracteur(g, m, o, now, U, rfx) {                    // tracteur vert qui fait le tour de son champ en coupant la route du bas
    const r = m.r, ca = Math.cos(o.a), sa = Math.sin(o.a);
    g.save(); g.translate(o.x, o.y); g.rotate(o.a);
    g.fillStyle = 'rgba(18,52,10,0.28)'; g.beginPath(); rrect(g, -r * 1.05 + 5, -r * 0.95 + 7, r * 2.15, r * 1.9, 9); g.fill();
    g.fillStyle = '#1d1d20'; g.fillRect(-r, -r * 0.95, r * 0.9, r * 0.4); g.fillRect(-r, r * 0.55, r * 0.9, r * 0.4);
    g.fillRect(r * 0.48, -r * 0.74, r * 0.5, r * 0.26); g.fillRect(r * 0.48, r * 0.48, r * 0.5, r * 0.26);
    g.strokeStyle = '#55555c'; g.lineWidth = 2; g.beginPath(); const ph = rfx ? 0 : (now / 50) % 6;
    for (let x = -r + ph; x < -r * 0.12; x += 6) { g.moveTo(x, -r * 0.95); g.lineTo(x, -r * 0.55); g.moveTo(x, r * 0.55); g.lineTo(x, r * 0.95); }
    g.stroke();
    g.fillStyle = '#ffd23a'; g.fillRect(-r * 0.98, -r * 0.62, r * 0.92, 5); g.fillRect(-r * 0.98, r * 0.62 - 5, r * 0.92, 5);
    g.fillStyle = '#2f9e44'; g.beginPath(); rrect(g, -r * 0.25, -r * 0.4, r * 1.32, r * 0.8, 7); g.fill();
    g.fillStyle = '#5cc46a'; g.fillRect(-r * 0.1, -r * 0.1, r * 1.05, r * 0.2);
    g.fillStyle = '#fff3a0'; g.fillRect(r * 1.02, -r * 0.34, 4, 7); g.fillRect(r * 1.02, r * 0.34 - 7, 4, 7);
    g.fillStyle = '#23803a'; g.beginPath(); rrect(g, -r * 1.02, -r * 0.55, r * 0.95, r * 1.1, 6); g.fill();
    g.fillStyle = '#f2f0e8'; g.beginPath(); rrect(g, -r * 0.94, -r * 0.47, r * 0.78, r * 0.94, 5); g.fill();
    g.fillStyle = '#333338'; g.beginPath(); rond(g, r * 0.62, -r * 0.24, 3.5); g.fill();
    g.restore();
    if (!rfx) {                                       // petits nuages de fumée qui s'envolent derrière le pot
      g.fillStyle = '#e8e8e8';
      for (let k = 0; k < 3; k++) { const u = (now / 600 + k / 3) % 1, dd = r * 0.62 - u * r * 2.4; g.globalAlpha = 0.5 * (1 - u); g.beginPath(); rond(g, o.x + ca * dd + sa * r * 0.24, o.y + sa * dd - ca * r * 0.24, 4 + u * 8); g.fill(); }
      g.globalAlpha = 1;
    }
  },
  canard(g, m, o, now, U, rfx) {                      // canard mécanique qui se dandine de l'étang jusqu'à la corde du grand rond
    const r = m.r, w = rfx ? 0 : Math.sin(now / 90);
    g.save(); g.translate(o.x, o.y); g.rotate(o.a + w * 0.16);
    g.fillStyle = 'rgba(18,52,10,0.3)'; g.beginPath(); ovale(g, 4, 6, r * 1.3, r * 0.85); g.fill();
    g.fillStyle = '#f07a12'; g.beginPath(); ovale(g, w * 5, -r * 0.5, r * 0.32, r * 0.2); ovale(g, -w * 5, r * 0.5, r * 0.32, r * 0.2); g.fill();
    g.fillStyle = '#ffd23a'; g.beginPath(); ovale(g, -r * 0.15, 0, r * 1.1, r * 0.78); g.moveTo(-r * 1.05, -r * 0.3); g.lineTo(-r * 1.55, 0); g.lineTo(-r * 1.05, r * 0.3); g.fill();
    g.fillStyle = '#f0b418'; g.beginPath(); ovale(g, -r * 0.32, -r * 0.44, r * 0.6, r * 0.26); ovale(g, -r * 0.32, r * 0.44, r * 0.6, r * 0.26); g.fill();
    g.fillStyle = '#ffdf50'; g.beginPath(); rond(g, r * 0.75, 0, r * 0.5); g.fill();
    g.fillStyle = '#f07a12'; g.beginPath(); ovale(g, r * 1.28, 0, r * 0.34, r * 0.2); g.fill();
    g.fillStyle = '#111111'; g.beginPath(); rond(g, r * 0.86, -r * 0.24, 2.4); rond(g, r * 0.86, r * 0.24, 2.4); g.fill();
    g.translate(-r * 0.4, 0); g.rotate(rfx ? 0 : now / 140);
    g.fillStyle = '#c9ccd4'; g.fillRect(-1.5, -r * 0.5, 3, r); g.beginPath(); ovale(g, 0, -r * 0.5, 5, 3.5); ovale(g, 0, r * 0.5, 5, 3.5); g.fill();
    g.restore();
  },
};

// ── par-dessus le décor fixe : le carrefour du milieu, les ponts de pierre, les feux ──
function carrefour(g, c) {
  const W = c.W, L = 236, U1 = [CA, SA], U2 = [-CA, SA];
  g.save(); g.translate(CX, CY); g.lineCap = 'butt';
  for (const u of [U1, U2]) { g.save(); g.rotate(Math.atan2(u[1], u[0])); g.fillStyle = '#545a63'; g.fillRect(-L, -W, 2 * L, 2 * W); g.restore(); }   // bitume uni
  g.strokeStyle = 'rgba(246,246,240,0.9)'; g.lineWidth = 4; g.beginPath();   // lignes de rive, seulement hors de l'autre route
  for (const uv of [[U1, U2], [U2, U1]]) {
    const u = uv[0], v = uv[1], nx = -u[1], ny = u[0];
    for (const o of [-(W - 10), W - 10]) for (const sg of [-1, 1]) {
      let t0 = 0; while (t0 < L && Math.abs(v[0] * (sg * t0 * u[1] + o * ny) - v[1] * (sg * t0 * u[0] + o * nx)) < W + 4) t0 += 2;
      g.moveTo(sg * t0 * u[0] + o * nx, sg * t0 * u[1] + o * ny); g.lineTo(sg * L * u[0] + o * nx, sg * L * u[1] + o * ny);
    }
  }
  g.stroke();
  const A = W / SA, B = W / CA;                       // losange commun aux deux routes : grille jaune « ne pas s'arrêter »
  g.save(); g.beginPath(); g.moveTo(-A, 0); g.lineTo(0, -B); g.lineTo(A, 0); g.lineTo(0, B); g.closePath();
  g.strokeStyle = '#ffd23a'; g.lineWidth = 7; g.stroke(); g.clip();
  g.lineWidth = 4; g.beginPath(); for (let k = -360; k <= 360; k += 36) { g.moveTo(k - 260, -260); g.lineTo(k + 260, 260); g.moveTo(k + 260, -260); g.lineTo(k - 260, 260); } g.stroke();
  g.restore();
  g.fillStyle = 'rgba(248,248,244,0.92)';            // passages piétons sur les quatre branches
  for (const u of [U1, U2]) for (const sg of [-1, 1]) {
    g.save(); g.rotate(Math.atan2(u[1], u[0]) + (sg < 0 ? Math.PI : 0));
    for (let y = -W + 14; y < W - 14; y += 26) g.fillRect(172, y, 54, 14);
    g.restore();
  }
  g.restore();
}
function feu(g, x, y, a, vert) {                      // feu tricolore sur son poteau, vu d'en haut
  g.save(); g.translate(x, y); g.rotate(a);
  ombre(g, a, 2.4, () => rrect(g, -10, -26, 20, 52, 5));
  disque(g, 0, 0, 13, '#8a8f98');
  g.fillStyle = '#2a2d33'; g.beginPath(); rrect(g, -10, -26, 20, 52, 5); g.fill();
  const C = vert ? ['#4a1410', '#4a3a08', '#46ff72'] : ['#ff3a2a', '#4a3a08', '#0c3a1a'];
  for (let k = 0; k < 3; k++) disque(g, 0, -15 + k * 15, 6, C[k]);
  g.globalAlpha = 0.3; disque(g, 0, vert ? 15 : -15, 11, vert ? '#46ff72' : '#ff3a2a'); g.globalAlpha = 1;
  g.restore();
}
function pont(g, c, P) {                              // pont de pierre : parapets des deux côtés au-dessus de la rivière
  const i0 = idx(c, P[0], P[1]), W = c.W, e = 10;
  const ligne = off => { g.beginPath(); for (let s = i0 - e; s <= i0 + e; s++) { const p = pt(c, s, off); if (s === i0 - e) g.moveTo(p[0], p[1]); else g.lineTo(p[0], p[1]); } };
  g.save(); g.lineCap = 'butt'; g.lineJoin = 'round';
  for (const sd of [-1, 1]) {
    g.save(); g.translate(6, 9); g.strokeStyle = 'rgba(10,40,80,0.3)'; g.lineWidth = 22; ligne(sd * (W + 16)); g.stroke(); g.restore();
    g.strokeStyle = '#cbc3b2'; g.lineWidth = 20; ligne(sd * (W + 16)); g.stroke();
    g.strokeStyle = '#9d9480'; g.setLineDash([3, 21]); g.stroke(); g.setLineDash([]);
    g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 3; ligne(sd * (W + 10)); g.stroke();
    for (const s of [i0 - e, i0 + e]) { const p = pt(c, s, sd * (W + 16)); disque(g, p[0] + 3, p[1] + 5, 15, 'rgba(18,52,10,0.3)'); disque(g, p[0], p[1], 15, '#9b927e'); disque(g, p[0] - 2, p[1] - 2, 9, '#ddd6c6'); }
  }
  g.restore();
}
function final(g, c) {
  carrefour(g, c);
  for (const P of PONTS) pont(g, c, P);
  feu(g, CX, CY - 250, 0, true); feu(g, CX, CY + 250, Math.PI, true); feu(g, CX - 340, CY, -Math.PI / 2, false); feu(g, CX + 340, CY, Math.PI / 2, false);
}

export default {
  id: 'huit', nom: 'Circuit en 8', emoji: '♾️', sous: 'Tapis de jeu · croisement au milieu, rivière, ferme et tracteur', v: 2,
  w: 4200, h: 2280, surf: 'tapis', edge: 'mur', table: T, W: 104,
  croix: true,
  pts: trace(DEP[0], DEP[1], AL, [
    ['X', Q1[0]],                                                   // branche S1 : croisement puis turbo
    ['A', 380, -36], ['X', 3630],                                   // boucle de droite : route du bas (le tracteur traverse)
    ['A', 245, -180], ['X', 3100], ['A', 170, 180], ['X', 3680],    // demi-tour large puis épingle serrée autour de l'enclos
    ['A', 200, -90], ['Y', 600], ['A', 300, -90],                   // remontée derrière le silo, virage du haut
    ['V', [[500, -36]], CX, CY],                                    // longue courbe qui ramène sur la branche S2
    ['X', P2[0]],                                                   // branche S2 : turbo, croisement, turbo
    ['A', 520, 80], ['A', 700, 46], ['V', [[700, 46], [520, 80]], DEP[0], DEP[1]],   // boucle de gauche : grand rond rapide, deux ponts
    ['X', DEP[0]],
  ]),
  mobs: [
    { type: 'tracteur', chemin: TRACTEUR, r: 30, per: 17 },                       // tourne autour de son champ, coupe deux fois la route du bas
    { type: 'canard', seg: [[592, 1176], [424, 1190]], r: 20, per: 9 },          // sort de l'étang et vient se poster à la corde du grand rond
  ],
  boxes: [0.285, 0.565, 0.93],
  bumpers: ['plot'],
  zonesPhysiques: { boue: 'frein', flaque: 'glisse' },
  make(H) {
    const c = H.c, n = c.n, W = c.W;
    const fr = (x, y) => idx(c, x, y) / n;
    H.wall(T.x0, T.y0, T.x1, T.y0, 20, 'plinthe'); H.wall(T.x1, T.y0, T.x1, T.y1, 20, 'plinthe');   // bords du tapis contre les murs de la chambre
    H.wall(T.x1, T.y1, T.x0, T.y1, 20, 'plinthe'); H.wall(T.x0, T.y1, T.x0, T.y0, 20, 'plinthe');
    // glissières rouge et blanc à l'extérieur du grand rond ; clôtures de bois autour de la ferme (dont l'enclos de l'épingle)
    H.railsDe(fr(P2[0], P2[1]), fr(P1[0], P1[1]), -1, 'rail');
    H.railsDe(fr(Q1[0], Q1[1]), fr(3072, 1801), 1, 'cloture');
    H.railsDe(fr(3630, 1800), fr(3630, 1310), 1, 'cloture');
    H.railsDe(fr(3100, 1310), fr(3100, 970), -1, 'cloture');
    H.railsDe(fr(3620, 1310), fr(3620, 970), 1, 'cloture');
    H.railsDe(fr(3680, 970), fr(3030, 420), 1, 'cloture');
    for (const P of PONTS) { const f = fr(P[0], P[1]); H.railsDe(f - 9 / n, f + 9 / n, 1, 'parapet', W + 12, 8); }   // parapet intérieur des ponts
    // turbos : loin du croisement, sur les trois branches qui n'ont pas la grille de départ
    H.boostAt(fr(CX + CA * 520, CY + SA * 520)); H.boostAt(fr(CX + CA * 700, CY - SA * 700)); H.boostAt(fr(CX - CA * 480, CY + SA * 480));
    // obstacles : bottes de foin, vache égarée sur la route de l'enclos, plot de chantier (rebondit) avant l'épingle
    H.rockAt(fr(3010, 1797), 0.6, 24, 'botte'); H.rockAt(fr(3420, 300), 0.55, 24, 'botte');
    H.rockAt(fr(3420, 970), -0.45, 26, 'vache'); H.rockAt(fr(3260, 1310), -0.55, 16, 'plot');
    H.zoneAt(fr(3185, 1800), 0.4, 64, 34, 'boue'); H.zoneAt(fr(3520, 1800), -0.4, 64, 34, 'boue'); H.zoneAt(fr(393, 1419), -0.45, 74, 36, 'flaque');
    const deco = (x, y, t, a, b) => c.deco.push([x, y, t, a, b]);
    // coin de forêt et campement, bords de l'étang (grand rond)
    deco(130, 150, 'sapin', 1); deco(275, 105, 'sapin', 0.8); deco(560, 190, 'sapin', 1.1); deco(150, 480, 'sapin', 0.9); deco(760, 210, 'tente', 0.3);
    deco(630, 1030, 'roseaux'); deco(1062, 1250, 'roseaux'); deco(760, 1335, 'roseaux'); deco(905, 1110, 'barque', 0.5); deco(1135, 1130, 'ponton', Math.PI);
    deco(600, 1460, 'arbre', 0.9); deco(1180, 920, 'arbre', 1); deco(150, 1150, 'arbre', 0.85); deco(1290, 1140, 'pique', 0.2);
    deco(130, 1790, 'sapin', 1); deco(600, 2130, 'sapin', 0.8); deco(300, 2070, 'epouvantail');
    // champs du haut : moulin, bottes, épouvantail, poules ; arbre du coin
    deco(2040, 600, 'moulin', 0.5); deco(1500, 340, 'bottes'); deco(2660, 300, 'epouvantail'); deco(2210, 790, 'poules'); deco(1180, 250, 'arbre', 0.9);
    // ferme dans la boucle de droite : grange, silos, vaches ; cochons dans l'enclos de l'épingle ; verger ; panneau
    deco(3330, 640, 'grange', 0); deco(3580, 560, 'silo'); deco(3070, 650, 'vache', 0.6); deco(3175, 790, 'vache', -2.6);
    deco(3420, 1140, 'cochon', 0.3); deco(3600, 1140, 'cochon', 2.8); deco(3260, 1140, 'bottes');
    deco(2500, 1140, 'pommier'); deco(2670, 1050, 'pommier'); deco(2670, 1240, 'pommier'); deco(2830, 1400, 'panneau');
    deco(3700, 2090, 'mouton', 0.3); deco(3830, 2030, 'mouton', -0.8); deco(3760, 2170, 'mouton', 2); deco(2950, 2110, 'arbre', 1); deco(4060, 2150, 'sapin', 0.9); deco(4040, 160, 'arbre', 0.9);
    // village du bas : église, maisons, station-service, voitures garées
    deco(2040, 1640, 'eglise', -Math.PI / 2); deco(1640, 1900, 'maison', 0, 0.1); deco(1820, 2100, 'maison', 1, -0.05); deco(2260, 2100, 'maison', 2, 0.05); deco(1450, 2090, 'maison', 3, 0.15);
    deco(2500, 1890, 'station'); deco(2440, 2040, 'voiture', 0, 0); deco(2620, 2040, 'voiture', 3, Math.PI); deco(1950, 1925, 'voiture', 1, Math.PI / 2); deco(2110, 1925, 'voiture', 2, -Math.PI / 2);
    deco(1500, 1860, 'arbre', 0.8); deco(2720, 2120, 'arbre', 0.9);
    deco(2030, 1958, 'fontaine'); deco(1780, 1640, 'arbre', 0.75); deco(2300, 1640, 'arbre', 0.8); deco(1150, 1400, 'massif');
    deco(1000, 700, 'arbre', 0.9); deco(3500, 800, 'poules'); deco(3980, 1880, 'mare');
  },
  dessin: { sol, plateau, piste, bord, final, decor: DECOR, objets: OBJETS, zones: ZONES, mobiles: MOBILES, murs: { cloture() {}, parapet() {} }, rails: 'aucun', hors: '#a8835a', traces: 'rgba(20,24,28,0.3)', poussiere: '150,200,110' },
};
