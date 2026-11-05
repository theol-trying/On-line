// Circuit « chantier » de Micro Machines — définition PARTAGÉE serveur / client (géométrie, obstacles, zones, décor).
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
const T = { x0: 100, y0: 100, x1: 3460, y1: 2580, r: 20 };      // l'intérieur du bac à sable (le cadre de bois fait bande)
// piste de terre tassée qui zigzague dans le bac : ligne droite du départ, accordéon de deux épingles autour des tas,
// longue remontée de la bétonnière, épingle du tas de la grue, épingle du coin, la planche d'échafaudage (turbos),
// descente vers le seau, deux épingles du côté gauche (pelleteuse), retour en S vers la ligne
const PTS = trace(1050, 2320, 0, [
  ['X', 1900], ['A', 140, -90], ['Y', 1750],                                   // ligne droite du départ, coin du seau
  ['A', 130, 90], ['X', 2290], ['A', 130, 90], ['Y', 2150],                   // 1re épingle (tas de l'accordéon)
  ['A', 130, -90], ['X', 2670], ['A', 130, -90], ['Y', 1300],                 // 2e épingle, remontée de la bétonnière
  ['A', 140, -90], ['X', 2200], ['A', 140, 90], ['Y', 900], ['A', 140, 90],   // épingle du tas de la grue
  ['X', 2900], ['A', 140, -90], ['Y', 500], ['A', 140, -90],                  // allée du râteau, épingle du coin
  ['X', 1400],                                                                 // la planche d'échafaudage (turbos)
  ['A', 220, -90], ['Y', 760], ['A', 150, 90], ['X', 550],                    // descente, allée de l'arrosoir
  ['A', 140, -90], ['Y', 1170], ['A', 140, -90], ['X', 1200],                 // épingle du tas des tuyaux, slalom de cônes
  ['A', 140, 90], ['Y', 1570], ['A', 140, 90], ['X', 700],                    // épingle du tas de la brouette
  ['A', 200, -90], ['Y', 2120], ['A', 200, -90], ['X', 1050],                 // S des barrières, retour sur la ligne
]);
const PLANCHE = { x0: 1360, x1: 2940, y: 360 };                 // la planche posée sur le sable (deux madriers)
const TAS = [[2230, 1790, 70], [2610, 2110, 70], [2230, 960, 70], [2870, 560, 70], [580, 1110, 70], [1170, 1510, 70]];   // au creux des épingles
const COINS = [[374, 124, 124, 374], [3186, 124, 3436, 374], [3436, 2306, 3186, 2556], [124, 2306, 374, 2556]];   // bancs d'angle du bac
const GRUE = [1760, 1180, -0.55, 640];                           // grue à tour : pied, orientation et longueur de la flèche
const BETON = [2600, 1400, 150];                                 // la bétonnière tourne autour des sacs de ciment
const PELLE = [[920, 1495], [920, 1356]];                        // la pelleteuse avance sur l'allée du slalom et recule
const BENNE = [];                                                // le camion-benne fait sa boucle entre la ligne et le slalom
for (let k = 0; k < 10; k++) { const u = k / 10 * TAU; BENNE.push([Math.round(1400 + Math.cos(u) * 330), Math.round(2015 + Math.sin(u) * 240)]); }

const rond = (g, x, y, r) => { g.moveTo(x + r, y); g.arc(x, y, r, 0, TAU); };
function ombre(g, dx, dy, forme) {                    // ombre douce en deux couches sur le sable (lumière en haut à gauche)
  g.save(); g.fillStyle = 'rgba(96,60,18,0.13)'; g.translate(dx * 1.8, dy * 1.8); g.beginPath(); forme(g); g.fill(); g.restore();
  g.save(); g.fillStyle = 'rgba(96,60,18,0.22)'; g.translate(dx, dy); g.beginPath(); forme(g); g.fill(); g.restore();
}
function rrect(g, x, y, w, h, r) { g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function bois(g, R, U, x, y, w, h, vert, base) {      // planche de bois : fond, veines légèrement ondulées, nœuds
  g.fillStyle = base; g.fillRect(x, y, w, h);
  const ep = vert ? w : h, L = vert ? h : w, nb = Math.max(3, Math.round(ep / 8));
  g.strokeStyle = 'rgba(96,52,18,0.2)'; g.lineWidth = 1.5; g.beginPath();
  for (let k = 0; k < nb; k++) {
    const o = (k + 0.5 + (R() - 0.5) * 0.7) * ep / nb, a = (R() - 0.5) * 7;
    if (vert) { g.moveTo(x + o, y); g.bezierCurveTo(x + o + a, y + L * 0.33, x + o - a, y + L * 0.66, x + o + a * 0.4, y + L); }
    else { g.moveTo(x, y + o); g.bezierCurveTo(x + L * 0.33, y + o + a, x + L * 0.66, y + o - a, x + L, y + o + a * 0.4); }
  }
  g.stroke();
  g.fillStyle = 'rgba(110,60,22,0.32)'; g.beginPath();
  for (let k = 0, nn = Math.max(1, Math.round(L / 420)); k < nn; k++) { const u = R() * L, v = (0.2 + R() * 0.6) * ep; if (vert) U.oval(g, x + v, y + u, 4, 9); else U.oval(g, x + u, y + v, 9, 4); }
  g.fill();
}
function chateau(g, R, U, s) {                        // grand château de sable : douves, enceinte crénelée, 4 tours moulées au seau, donjon, fanion
  g.save(); g.scale(s, s);
  g.strokeStyle = 'rgba(150,100,46,0.32)'; g.lineWidth = 26; g.beginPath(); rond(g, 0, 0, 140); g.stroke();      // douves creusées
  g.strokeStyle = 'rgba(86,140,160,0.6)'; g.lineWidth = 12; g.beginPath(); g.arc(0, 0, 140, 0.2, 2.3); g.stroke();
  g.strokeStyle = 'rgba(220,240,250,0.55)'; g.lineWidth = 2; g.beginPath(); g.arc(0, 0, 136, 0.5, 1.4); g.stroke();
  const tours = [[-78, -78], [78, -78], [78, 78], [-78, 78]];
  ombre(g, 9, 13, q => { q.rect(-78, -78, 156, 156); for (const t of tours) rond(q, t[0], t[1], 36); rond(q, 0, 0, 50); });
  g.fillStyle = '#d4a96c'; g.fillRect(-80, -80, 160, 160);                                                         // enceinte
  g.fillStyle = '#ebcd96'; g.fillRect(-62, -62, 124, 124);                                                          // cour
  g.fillStyle = '#e8c88e'; for (let k = -70; k < 70; k += 20) { g.fillRect(k, -80, 10, 10); g.fillRect(k, 70, 10, 10); g.fillRect(-80, k, 10, 10); g.fillRect(70, k, 10, 10); }   // créneaux
  g.fillStyle = '#9a6a34'; g.fillRect(-14, 62, 28, 18);                                                             // porte
  g.fillStyle = '#c49a62'; g.fillRect(-16, 80, 32, 40);                                                             // pont-levis (planchette)
  g.strokeStyle = 'rgba(110,70,30,0.4)'; g.lineWidth = 2; g.beginPath(); for (let k = 88; k < 120; k += 8) { g.moveTo(-16, k); g.lineTo(16, k); } g.stroke();
  const tour = (x, y, r) => {                                                                                       // tour moulée au seau : dégradé, cerclages, créneaux
    const gr = g.createRadialGradient(x - r * 0.4, y - r * 0.45, r * 0.1, x, y, r);
    gr.addColorStop(0, '#f8e4b8'); gr.addColorStop(0.6, '#e0b97c'); gr.addColorStop(1, '#bf8e52');
    g.fillStyle = gr; g.beginPath(); rond(g, x, y, r); g.fill();
    g.strokeStyle = 'rgba(140,92,40,0.35)'; g.lineWidth = 2; g.beginPath(); rond(g, x, y, r * 0.78); rond(g, x, y, r * 0.52); g.stroke();
    g.fillStyle = 'rgba(130,86,36,0.45)'; g.beginPath(); for (let k = 0; k < 8; k++) { const u = k * TAU / 8; rond(g, x + Math.cos(u) * r * 0.9, y + Math.sin(u) * r * 0.9, r * 0.1); } g.fill();
  };
  for (const t of tours) tour(t[0], t[1], 36);
  tour(0, 0, 50);
  g.fillStyle = '#ffffff'; g.beginPath(); for (const q of [[-40, -79], [30, 79], [-79, 30], [79, -40], [12, -30]]) { g.moveTo(q[0], q[1]); g.arc(q[0], q[1], 6, Math.PI, TAU); } g.fill();   // coquillages
  g.strokeStyle = 'rgba(96,60,18,0.3)'; g.lineWidth = 3; g.beginPath(); g.moveTo(4, 4); g.lineTo(52, 30); g.stroke();   // ombre du mât
  g.strokeStyle = '#7a5530'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, 0); g.lineTo(26, -36); g.stroke();
  g.fillStyle = '#e8302a'; g.beginPath(); g.moveTo(26, -36); g.lineTo(58, -30); g.lineTo(30, -18); g.closePath(); g.fill();
  g.restore();
}

// ── sol : la pelouse autour du bac ; sable ; piste de terre tassée, ruban de chantier, la planche ; cadre de bois ──
function sol(g, c, R) {
  g.fillStyle = '#5a9238'; g.fillRect(0, 0, c.w, c.h);
  for (const col of ['rgba(40,96,26,0.45)', 'rgba(150,206,100,0.4)']) {
    g.strokeStyle = col; g.lineWidth = 2; g.beginPath();
    for (let k = 0; k < 1500; k++) { const bord = R() < 0.5, x = bord ? R() * c.w : (R() < 0.5 ? R() * 110 : c.w - R() * 110), y = bord ? (R() < 0.5 ? R() * 110 : c.h - R() * 110) : R() * c.h, p = (R() - 0.5) * 6; g.moveTo(x, y); g.lineTo(x + p, y - 7); }
    g.stroke();
  }
}
function plateau(g, c, R, U) {
  const t = c.table, W = t.x1 - t.x0, H = t.y1 - t.y0;
  g.fillStyle = '#e4c58c'; g.fillRect(t.x0, t.y0, W, H);
  for (let k = 0; k < 22; k++) U.blob(g, t.x0 + R() * W, t.y0 + R() * H, 150 + R() * 240, 100 + R() * 160, R() * 3, R, k % 3 ? 'rgba(255,238,200,0.2)' : 'rgba(176,124,60,0.13)');   // sable sec / humide
  const tons = ['rgba(170,120,60,0.35)', 'rgba(255,246,222,0.5)', 'rgba(196,150,90,0.4)'];
  for (let p = 0; p < 3; p++) { g.fillStyle = tons[p]; g.beginPath(); for (let k = 0; k < 2200; k++) { const s = 2 + R() * 2.5; g.rect(t.x0 + R() * W, t.y0 + R() * H, s, s); } g.fill(); }   // grains
  // traces de râteau (arcs parallèles) et rides de vent
  for (const q of [[700, 560, 0.3], [3080, 2380, 2.2], [1650, 2470, 3.2], [320, 2220, -0.6], [2480, 1300, 1.2], [3300, 760, 1.8]]) {
    g.save(); g.translate(q[0], q[1]); g.rotate(q[2]);
    g.strokeStyle = 'rgba(160,108,48,0.22)'; g.lineWidth = 3; g.beginPath(); for (let k = 0; k < 8; k++) { g.moveTo(-150, k * 10 - 40); g.quadraticCurveTo(0, k * 10 - 70, 150, k * 10 - 40); } g.stroke();
    g.strokeStyle = 'rgba(255,244,214,0.3)'; g.lineWidth = 2; g.beginPath(); for (let k = 0; k < 8; k++) { g.moveTo(-150, k * 10 - 37); g.quadraticCurveTo(0, k * 10 - 67, 150, k * 10 - 37); } g.stroke();
    g.restore();
  }
  // traces de pas d'enfant qui traversent le bac (talon + plante + orteils), coups de pelle (trous + déblais)
  const P = [], O = [];
  const pas = (pts) => {
    for (let s = 0; s < pts.length - 1; s++) {
      const a = pts[s], b = pts[s + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]), ux = (b[0] - a[0]) / L, uy = (b[1] - a[1]) / L;
      for (let d = 0, k = 0; d < L; d += 62, k++) {
        const sd = k % 2 ? 1 : -1, x = a[0] + ux * d - uy * 13 * sd, y = a[1] + uy * d + ux * 13 * sd;
        P.push([x - ux * 9, y - uy * 9, 7.5], [x + ux * 7, y + uy * 7, 9.5]);
        for (let o = 0; o < 4; o++) O.push([x + ux * 19 + (-uy) * (o - 1.5) * 5 * sd, y + uy * 19 + ux * (o - 1.5) * 5 * sd, 3]);
      }
    }
  };
  pas([[260, 2450], [700, 1990], [1240, 1880], [1680, 1640], [1880, 1060], [2440, 620], [3330, 230]]);
  pas([[3360, 1300], [3000, 1180], [2600, 1600], [2200, 2470]]);
  g.fillStyle = 'rgba(150,100,44,0.3)'; g.beginPath(); for (const p of P) rond(g, p[0], p[1], p[2]); for (const p of O) rond(g, p[0], p[1], p[2]); g.fill();
  g.fillStyle = 'rgba(255,244,214,0.32)'; g.beginPath(); for (const p of P) { g.moveTo(p[0] - p[2], p[1] - 1); g.arc(p[0] - 1, p[1] - 1, p[2], Math.PI, Math.PI * 1.5); } g.fill();
  for (const q of [[330, 1880], [1020, 1560], [3260, 1320], [1990, 560], [3060, 2050], [450, 520], [2500, 2440], [1560, 790]]) {   // coups de pelle
    g.fillStyle = 'rgba(214,176,118,0.7)'; g.beginPath(); U.oval(g, q[0] + 30, q[1] + 22, 34, 22); g.fill();
    g.fillStyle = 'rgba(140,92,40,0.42)'; g.beginPath(); U.oval(g, q[0], q[1], 30, 20); g.fill();
    g.fillStyle = 'rgba(110,70,28,0.3)'; g.beginPath(); U.oval(g, q[0] + 4, q[1] + 3, 20, 12); g.fill();
    g.strokeStyle = 'rgba(255,240,206,0.5)'; g.lineWidth = 3; g.beginPath(); g.arc(q[0], q[1], 30, 3.5, 5.6); g.stroke();
  }
  // ornières de la bétonnière et du camion-benne (ils tournent toujours au même endroit), chenilles de la pelleteuse
  g.strokeStyle = 'rgba(140,92,40,0.22)'; g.lineWidth = 9;
  g.beginPath(); for (const d of [-13, 13]) U.oval(g, 1400, 2015, 330 + d, 240 + d); g.stroke();
  g.beginPath(); for (const d of [-12, 12]) rond(g, BETON[0], BETON[1], BETON[2] + d); g.stroke();
  g.lineWidth = 12; g.setLineDash([5, 5]); g.beginPath(); for (const d of [-20, 20]) { g.moveTo(PELLE[0][0] + d, PELLE[0][1] + 40); g.lineTo(PELLE[1][0] + d, PELLE[1][1]); } g.stroke(); g.setLineDash([]);
  // cailloux, coquillages, feuilles tombées du tilleul voisin
  for (let k = 0; k < 70; k++) { const x = t.x0 + 40 + R() * (W - 80), y = t.y0 + 40 + R() * (H - 80), r = 3 + R() * 5; g.fillStyle = U.rgbStr(U.mix([150, 140, 126], [226, 220, 206], R())); g.beginPath(); U.oval(g, x, y, r, r * 0.75); g.fill(); }
  g.fillStyle = '#f6ece0'; g.beginPath(); for (let k = 0; k < 16; k++) { const x = t.x0 + 60 + R() * (W - 120), y = t.y0 + 60 + R() * (H - 120); g.moveTo(x - 8, y); g.arc(x, y, 8, Math.PI, TAU); g.closePath(); } g.fill();
  for (let k = 0; k < 18; k++) {
    const x = t.x0 + 40 + R() * (W - 80), y = t.y0 + 40 + R() * (H - 80), a = R() * TAU;
    g.save(); g.translate(x, y); g.rotate(a); g.fillStyle = k % 3 ? '#9ab43a' : '#d89a2a'; g.beginPath(); g.moveTo(-14, 0); g.quadraticCurveTo(0, -10, 14, 0); g.quadraticCurveTo(0, 10, -14, 0); g.fill();
    g.strokeStyle = 'rgba(60,70,20,0.5)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(-14, 0); g.lineTo(14, 0); g.stroke(); g.restore();
  }
}
function piste(g, c, R, U) {                           // terre battue tassée, bourrelets de sable, ruban rouge et blanc sur piquets ; la planche
  const W = c.W, n = c.n;
  g.lineJoin = 'round'; g.lineCap = 'round';
  U.centerStroke(g, c, 2 * W + 34, 'rgba(244,222,176,0.85)');   // bourrelet de sable repoussé
  g.save(); g.translate(3, 5); U.centerStroke(g, c, 2 * W + 12, 'rgba(110,70,26,0.3)'); g.restore();
  U.centerStroke(g, c, 2 * W + 10, '#a8773f');
  U.centerStroke(g, c, 2 * W, '#be8d54');                         // terre tassée
  U.centerStroke(g, c, 2 * W - 64, 'rgba(214,170,112,0.4)');
  g.strokeStyle = 'rgba(112,70,30,0.2)'; g.lineWidth = 24; for (const o of [-0.45, 0.45]) { U.trackPath(g, c, o * W); g.stroke(); }   // ornières
  g.strokeStyle = 'rgba(96,58,22,0.18)'; g.lineWidth = 16; g.setLineDash([5, 7]); for (const o of [-0.45, 0.45]) { U.trackPath(g, c, o * W); g.stroke(); } g.setLineDash([]);   // sculptures de pneus
  const tons = ['rgba(120,80,40,0.4)', 'rgba(244,222,180,0.5)', 'rgba(150,120,90,0.45)'];
  for (let p = 0; p < 3; p++) { g.fillStyle = tons[p]; g.beginPath(); for (let k = 0; k < n * 1.6; k++) { const i = Math.floor(R() * n), o = (R() * 2 - 1) * (W - 4), s = 2 + R() * 3; g.rect(c.sx[i] + c.nx[i] * o, c.sy[i] + c.ny[i] * o, s, s); } g.fill(); }
  g.strokeStyle = 'rgba(255,246,222,0.55)'; g.lineWidth = 4; for (const o of [-(W + 13), W + 13]) { U.trackPath(g, c, o); g.stroke(); }   // crête du bourrelet
  // ruban de chantier rouge et blanc tendu entre des piquets, des deux côtés (pas sur la planche)
  const surPl = i => c.sy[i] < PLANCHE.y + 110 && c.sx[i] > PLANCHE.x0 && c.sx[i] < PLANCHE.x1;
  const ruban = (o, dx, dy) => {
    g.beginPath(); let on = false;
    for (let i = 0; i <= n; i++) { const j = i % n; if (surPl(j)) { on = false; continue; } const x = c.sx[j] + c.nx[j] * o + dx, y = c.sy[j] + c.ny[j] * o + dy; if (on) g.lineTo(x, y); else { g.moveTo(x, y); on = true; } }
  };
  for (const o of [-(W + 22), W + 22]) {
    ruban(o, 3, 5); g.lineWidth = 6; g.strokeStyle = 'rgba(96,60,18,0.25)'; g.stroke();
    ruban(o, 0, 0); g.strokeStyle = '#f6f2ea'; g.stroke(); g.setLineDash([16, 16]); g.strokeStyle = '#d8261c'; g.stroke(); g.setLineDash([]);
  }
  const PQ = []; for (let i = 0; i < n; i += 16) if (!surPl(i)) for (const o of [-(W + 22), W + 22]) PQ.push(c.sx[i] + c.nx[i] * o, c.sy[i] + c.ny[i] * o);
  g.fillStyle = 'rgba(96,60,18,0.3)'; g.beginPath(); for (let k = 0; k < PQ.length; k += 2) rond(g, PQ[k] + 3, PQ[k + 1] + 5, 5.5); g.fill();
  g.fillStyle = '#6e4a26'; g.beginPath(); for (let k = 0; k < PQ.length; k += 2) rond(g, PQ[k], PQ[k + 1], 5.5); g.fill();
  g.fillStyle = '#b08050'; g.beginPath(); for (let k = 0; k < PQ.length; k += 2) rond(g, PQ[k] - 1.5, PQ[k + 1] - 1.5, 2.5); g.fill();
  // la planche d'échafaudage : deux madriers sur le sable, ombre, cerclages galvanisés, clous, sable qui la recouvre aux bouts
  const x0 = PLANCHE.x0, x1 = PLANCHE.x1, y0 = PLANCHE.y - W - 18, h = W + 18, L = x1 - x0;
  g.fillStyle = 'rgba(96,60,18,0.16)'; g.fillRect(x0 + 10, y0 + 16, L, 2 * h);
  g.fillStyle = 'rgba(96,60,18,0.26)'; g.fillRect(x0 + 5, y0 + 8, L, 2 * h);
  bois(g, R, U, x0, y0, L, h - 2, false, '#cf9b5e'); bois(g, R, U, x0, y0 + h + 2, L, h - 2, false, '#c38f54');
  g.fillStyle = '#7a4e26'; g.fillRect(x0, y0 + h - 2, L, 4);                                                    // joint entre les madriers
  g.fillStyle = 'rgba(255,236,200,0.35)'; g.fillRect(x0, y0, L, 4); g.fillRect(x0, y0 + h + 2, L, 3);          // arêtes au soleil
  g.fillStyle = 'rgba(80,46,16,0.35)'; g.fillRect(x0, y0 + h - 6, L, 4); g.fillRect(x0, y0 + 2 * h - 4, L, 4);
  for (const xb of [x0 + 26, x1 - 44]) { g.fillStyle = '#9aa2aa'; g.fillRect(xb, y0, 18, 2 * h); g.fillStyle = '#d4dae0'; g.fillRect(xb, y0, 5, 2 * h); }   // cerclages
  g.fillStyle = '#4a4c52'; g.beginPath(); for (let x = x0 + 150; x < x1 - 100; x += 260) for (const y of [y0 + 14, y0 + h - 16, y0 + h + 16, y0 + 2 * h - 14]) rond(g, x, y, 3.2); g.fill();
  g.fillStyle = 'rgba(244,222,176,0.9)'; for (const xe of [x0, x1]) U.blob(g, xe, PLANCHE.y, 34, h * 0.9, 0, R, 'rgba(236,208,150,0.9)');
  g.fillStyle = 'rgba(236,206,150,0.55)'; g.beginPath(); for (let k = 0; k < 420; k++) { const s = 2 + R() * 2; g.rect(x0 + R() * L, y0 + R() * 2 * h, s, s); } g.fill();   // sable apporté par les roues
}
function bord(g, c, R, U) {                            // cadre du bac : madriers vissés (bout à bout), bancs d'angle, ombre sur le sable
  const t = c.table, e = 24, L = 80, xo0 = t.x0 - L, yo0 = t.y0 - L, xo1 = t.x1 + L, yo1 = t.y1 + L, xi0 = t.x0 + e, yi0 = t.y0 + e, xi1 = t.x1 - e, yi1 = t.y1 - e;
  g.fillStyle = 'rgba(30,50,16,0.35)'; g.fillRect(xo1, yo0 + 14, 10, yo1 - yo0); g.fillRect(xo0 + 10, yo1, xo1 - xo0, 14);   // ombre sur la pelouse
  g.fillStyle = 'rgba(96,60,18,0.3)'; g.fillRect(xi0, yi0, xi1 - xi0, 18); g.fillRect(xi0, yi0, 18, yi1 - yi0);   // ombre du cadre sur le sable
  g.fillStyle = 'rgba(96,60,18,0.15)'; g.fillRect(xi0, yi0 + 18, xi1 - xi0, 14); g.fillRect(xi0 + 18, yi0, 14, yi1 - yi0);
  bois(g, R, U, xo0, yo0, xo1 - xo0, yi0 - yo0, false, '#a87442'); bois(g, R, U, xo0, yi1, xo1 - xo0, yo1 - yi1, false, '#9c6a3a');
  bois(g, R, U, xo0, yi0, xi0 - xo0, yi1 - yi0, true, '#a3703f'); bois(g, R, U, xi1, yi0, xo1 - xi1, yi1 - yi0, true, '#976536');
  g.fillStyle = 'rgba(60,34,12,0.5)'; g.fillRect(xo0, yi0 - 2, xi0 - xo0, 3); g.fillRect(xi1, yi0 - 2, xo1 - xi1, 3); g.fillRect(xo0, yi1 - 1, xi0 - xo0, 3); g.fillRect(xi1, yi1 - 1, xo1 - xi1, 3);   // joints
  g.fillStyle = 'rgba(255,232,196,0.35)'; g.fillRect(xo0, yo0, xo1 - xo0, 4); g.fillRect(xo0, yo0, 4, yo1 - yo0);
  g.strokeStyle = 'rgba(60,34,12,0.45)'; g.lineWidth = 3; g.strokeRect(xi0, yi0, xi1 - xi0, yi1 - yi0);
  // bancs d'angle : planchettes en diagonale (on ne roule pas dessous : un mur suit l'hypoténuse)
  for (const q of COINS) {
    const ax = (q[0] + q[2]) / 2, ay = (q[1] + q[3]) / 2, kx = (q[0] < 1000 || q[2] < 1000) ? xi0 : xi1, ky = (q[1] < 1000 || q[3] < 1000) ? yi0 : yi1;
    const tri = h => { h.moveTo(kx, ky); h.lineTo(q[0], q[1]); h.lineTo(q[2], q[3]); h.closePath(); };
    ombre(g, 6, 9, tri);
    g.save(); g.beginPath(); tri(g); g.clip();
    bois(g, R, U, Math.min(kx, q[0], q[2]), Math.min(ky, q[1], q[3]), 252, 252, (ax - kx) * (ay - ky) > 0, '#b47e48');
    g.strokeStyle = 'rgba(70,40,14,0.5)'; g.lineWidth = 3; g.beginPath();
    for (let f = 0.33; f < 1; f += 0.33) { g.moveTo(kx + (q[0] - kx) * f, ky + (q[1] - ky) * f); g.lineTo(kx + (q[2] - kx) * f, ky + (q[3] - ky) * f); }
    g.stroke(); g.restore();
    g.strokeStyle = 'rgba(255,232,196,0.45)'; g.lineWidth = 3; g.beginPath(); g.moveTo(q[0], q[1]); g.lineTo(q[2], q[3]); g.stroke();
    g.fillStyle = '#5a5c62'; g.beginPath(); for (const f of [0.3, 0.7]) rond(g, kx + (ax - kx) * f, ky + (ay - ky) * f, 4); g.fill();
  }
  g.fillStyle = '#55575c'; g.beginPath();                                                                  // vis du cadre
  for (let x = xo0 + 120; x < xo1 - 60; x += 420) { rond(g, x, yo0 + 30, 4); rond(g, x, yo0 + 74, 4); rond(g, x, yi1 + 30, 4); rond(g, x, yi1 + 74, 4); }
  for (let y = yi0 + 200; y < yi1 - 60; y += 420) { rond(g, xo0 + 30, y, 4); rond(g, xo0 + 74, y, 4); rond(g, xi1 + 30, y, 4); rond(g, xi1 + 74, y, 4); }
  g.fill();
}
// la flèche de la grue passe AU-DESSUS de la piste : charge suspendue, flèche en treillis, contre-flèche et lest, chariot
function final(g) {
  const x = GRUE[0], y = GRUE[1], a = GRUE[2], L = GRUE[3], CL = 210, TR = L * 0.8;
  g.save(); g.translate(x + 40, y + 58); g.rotate(a); g.fillStyle = 'rgba(96,60,18,0.14)'; g.fillRect(-CL, -13, L + CL, 26); g.restore();   // ombre lointaine (elle est haute)
  g.save(); g.translate(x, y); g.rotate(a);
  g.save(); g.translate(TR, 0); g.rotate(0.35 - a);                                                      // palette de briques au crochet (sous la flèche)
  g.fillStyle = 'rgba(96,60,18,0.24)'; g.fillRect(-14, 4, 60, 46);
  g.fillStyle = '#b08250'; g.fillRect(-30, -24, 60, 48);
  g.fillStyle = '#b4502c'; for (let r = 0; r < 3; r++) for (let k = 0; k < 2; k++) g.fillRect(-27 + k * 28, -21 + r * 15, 26, 13);
  g.fillStyle = '#d06a40'; for (let r = 0; r < 3; r++) for (let k = 0; k < 2; k++) g.fillRect(-27 + k * 28, -21 + r * 15, 26, 3);
  g.strokeStyle = '#4a4c52'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(-30, -24); g.lineTo(0, 0); g.lineTo(30, -24); g.moveTo(-30, 24); g.lineTo(0, 0); g.lineTo(30, 24); g.stroke();   // élingues
  g.restore();
  g.lineCap = 'butt';
  g.strokeStyle = '#d99a00'; g.lineWidth = 6; g.beginPath(); g.moveTo(-CL, -11); g.lineTo(L, -11); g.moveTo(-CL, 11); g.lineTo(L - 20, 11); g.stroke();   // membrures
  g.strokeStyle = '#f5b800'; g.lineWidth = 3.5; g.beginPath(); for (let k = -CL, s = 1; k < L - 20; k += 22, s = -s) { g.moveTo(k, -11 * s); g.lineTo(k + 22, 11 * s); } g.stroke();   // treillis
  g.strokeStyle = '#ffe27a'; g.lineWidth = 2; g.beginPath(); g.moveTo(-CL, -12.5); g.lineTo(L, -12.5); g.stroke();
  g.fillStyle = '#9a9ea6'; for (let k = 0; k < 3; k++) { g.fillRect(-CL + 6 + k * 26, -17, 22, 34); }    // lest de béton
  g.fillStyle = '#c4c8ce'; for (let k = 0; k < 3; k++) g.fillRect(-CL + 6 + k * 26, -17, 22, 5);
  g.fillStyle = '#2a2c32'; g.fillRect(TR - 11, -14, 22, 28); g.fillStyle = '#f5b800'; g.fillRect(TR - 6, -5, 12, 10);   // chariot et moufle
  g.fillStyle = '#f5b800'; g.beginPath(); rrect(g, -24, -24, 48, 48, 6); g.fill();                     // tête de mât et cabine du grutier
  g.fillStyle = '#d99a00'; g.fillRect(-24, 8, 48, 16);
  g.fillStyle = '#9fd4ee'; g.fillRect(6, -20, 15, 24); g.fillStyle = 'rgba(255,255,255,0.7)'; g.fillRect(9, -18, 4, 18);
  g.fillStyle = '#e8302a'; g.beginPath(); rond(g, L - 4, 0, 5); g.fill();                              // feu de bout de flèche
  g.restore();
}

// ── décor du chantier (dessiné autour de l'origine ; d = [x, y, type, angle, variante]) ──
const DECOR = {
  grue(g, d) {                                         // pied de la grue à tour : lest de blocs béton, mât en treillis, ombre du mât
    g.fillStyle = 'rgba(96,60,18,0.14)'; g.beginPath(); g.moveTo(-30, 30); g.lineTo(10, 88); g.lineTo(70, 88); g.lineTo(30, -30); g.closePath(); g.fill();
    ombre(g, 6, 9, q => q.rect(-70, -70, 140, 140));
    g.fillStyle = '#8f939a'; g.fillRect(-70, -70, 140, 140);
    g.fillStyle = '#b6bac0'; for (const q of [[-66, -66], [4, -66], [-66, 4], [4, 4]]) g.fillRect(q[0], q[1], 62, 62);
    g.fillStyle = 'rgba(255,255,255,0.25)'; for (const q of [[-66, -66], [4, -66], [-66, 4], [4, 4]]) g.fillRect(q[0], q[1], 62, 6);
    g.fillStyle = '#2a2c32'; g.fillRect(-34, -34, 68, 68);
    g.strokeStyle = '#f5b800'; g.lineWidth = 6; g.strokeRect(-30, -30, 60, 60);
    g.lineWidth = 3.5; g.beginPath(); g.moveTo(-30, -30); g.lineTo(30, 30); g.moveTo(30, -30); g.lineTo(-30, 30); g.stroke();
  },
  chateau(g, d, R, U) { g.rotate(d[3]); chateau(g, R, U, d[4] || 1); },
  baraque(g, d, R, U) {                                // baraque de chantier : toit de tôle ondulée, panneau « CHANTIER », marches, bidon
    g.rotate(d[3]);
    ombre(g, 8, 12, q => q.rect(-130, -62, 260, 124));
    g.fillStyle = '#2f6fb8'; g.fillRect(-130, -62, 260, 124);
    g.fillStyle = '#e8ecef'; g.fillRect(-122, -54, 244, 108);
    g.strokeStyle = 'rgba(120,130,140,0.45)'; g.lineWidth = 2; g.beginPath(); for (let x = -116; x < 122; x += 10) { g.moveTo(x, -54); g.lineTo(x, 54); } g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.4)'; g.fillRect(-122, -54, 244, 10);
    g.fillStyle = '#f5b800'; g.fillRect(-70, -18, 140, 36); g.fillStyle = '#1e1e22'; g.fillRect(-70, -18, 140, 4); g.fillRect(-70, 14, 140, 4);
    g.font = 'bold 22px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('CHANTIER', 0, 1);
    g.fillStyle = '#5a5e64'; g.fillRect(80, -40, 30, 30); g.fillStyle = '#8a8f96'; g.beginPath(); rond(g, 95, -25, 10); g.fill();   // clim
    g.fillStyle = '#9a9ea4'; for (let k = 0; k < 3; k++) g.fillRect(-60 + k * 14, 62, 12, 34);       // marches
    g.fillStyle = '#d8401c'; g.beginPath(); rond(g, -110, 90, 22); g.fill(); g.fillStyle = '#b8341a'; g.beginPath(); rond(g, -110, 90, 15); g.fill();
    g.fillStyle = '#1e1e22'; g.beginPath(); rond(g, -104, 84, 4); g.fill();
  },
  planches(g, d, R, U) {                               // pile de planches : deux lits croisés, sangle orange
    g.rotate(d[3]);
    ombre(g, 7, 10, q => { q.rect(-140, -54, 280, 108); });
    for (let k = 0; k < 4; k++) { bois(g, R, U, -140, -54 + k * 27, 280, 25, false, k % 2 ? '#d2a066' : '#c69256'); g.fillStyle = '#a8743e'; g.fillRect(132, -54 + k * 27, 8, 25); }
    g.save(); g.rotate(0.12);
    g.fillStyle = 'rgba(96,60,18,0.25)'; g.fillRect(-96, -50, 196, 52);
    for (let k = 0; k < 2; k++) bois(g, R, U, -100, -56 + k * 27, 200, 25, false, k ? '#ddb07a' : '#d4a46c');
    g.restore();
    g.fillStyle = '#f07a12'; g.fillRect(-70, -58, 12, 116); g.fillRect(60, -58, 12, 116);
  },
  tuyaux(g, d, R, U) {                                 // tuyaux de PVC empilés sur des cales, bouts creux
    g.rotate(d[3]);
    ombre(g, 7, 10, q => q.rect(-200, -72, 400, 144));
    g.fillStyle = '#8a5a30'; g.fillRect(-150, -76, 26, 152); g.fillRect(124, -76, 26, 152);
    const cols = [['#e8741c', '#ffa860'], ['#8f969e', '#c8ced4'], ['#e8741c', '#ffa860'], ['#8f969e', '#c8ced4']];
    for (let k = 0; k < 4; k++) {
      const y = -54 + k * 36, gr = g.createLinearGradient(0, y - 17, 0, y + 17);
      gr.addColorStop(0, cols[k][1]); gr.addColorStop(0.45, cols[k][0]); gr.addColorStop(1, U.rgbStr(U.mix(U.hexRgb(cols[k][0]), [0, 0, 0], 0.35)));
      g.fillStyle = gr; g.fillRect(-196, y - 17, 392, 34);
      g.fillStyle = U.rgbStr(U.mix(U.hexRgb(cols[k][0]), [0, 0, 0], 0.5)); g.beginPath(); U.oval(g, 196, y, 6, 15); g.fill();
      g.fillStyle = 'rgba(40,30,20,0.8)'; g.beginPath(); U.oval(g, 197, y, 3.5, 11); g.fill();
    }
    g.save(); g.translate(30, -72); g.fillStyle = '#e8741c'; g.fillRect(-150, -10, 300, 24); g.fillStyle = '#ffa860'; g.fillRect(-150, -10, 300, 7); g.restore();   // un tuyau posé dessus
  },
  panneau(g, d, R, U) {                                // panneau « travaux » triangulaire sur chevalet, sac de lest
    g.rotate(d[3]);
    ombre(g, 8, 12, q => { q.moveTo(0, -74); q.lineTo(66, 44); q.lineTo(-66, 44); q.closePath(); });
    g.strokeStyle = '#3a3c42'; g.lineWidth = 6; g.lineCap = 'round'; g.beginPath(); g.moveTo(-50, 44); g.lineTo(-70, 80); g.moveTo(50, 44); g.lineTo(70, 80); g.stroke();
    g.fillStyle = '#d8261c'; g.beginPath(); g.moveTo(0, -74); g.lineTo(66, 44); g.lineTo(-66, 44); g.closePath(); g.fill();
    g.fillStyle = '#f6f2ea'; g.beginPath(); g.moveTo(0, -50); g.lineTo(46, 32); g.lineTo(-46, 32); g.closePath(); g.fill();
    g.fillStyle = '#1e1e22'; g.beginPath(); rond(g, -6, -16, 6); g.fill();                         // ouvrier qui pellette
    g.strokeStyle = '#1e1e22'; g.lineWidth = 5; g.beginPath(); g.moveTo(-6, -8); g.lineTo(-2, 10); g.lineTo(-12, 26); g.moveTo(-2, 10); g.lineTo(8, 26); g.moveTo(-5, -2); g.lineTo(14, 6); g.stroke();
    g.lineWidth = 3; g.beginPath(); g.moveTo(14, 6); g.lineTo(24, 24); g.stroke(); g.fillStyle = '#1e1e22'; g.beginPath(); g.moveTo(18, 24); g.lineTo(32, 24); g.lineTo(28, 30); g.closePath(); g.fill();
    g.beginPath(); U.oval(g, -24, 28, 12, 4); g.fill();
    g.fillStyle = '#c8b07a'; g.beginPath(); rrect(g, -30, 66, 60, 26, 10); g.fill(); g.fillStyle = 'rgba(255,255,255,0.3)'; g.fillRect(-24, 70, 48, 5);
  },
  arrosoir(g, d, R, U) {                               // arrosoir couché : l'eau a coulé vers la piste (boue juste à côté)
    g.rotate(d[3]);
    U.blob(g, 96, 0, 70, 46, 0, R, 'rgba(150,100,44,0.4)');                                         // sable mouillé
    U.blob(g, 92, 0, 46, 28, 0.3, R, 'rgba(96,130,150,0.55)');
    g.fillStyle = 'rgba(220,240,250,0.5)'; g.beginPath(); U.oval(g, 84, -8, 16, 6); g.fill();
    ombre(g, 7, 10, q => { U.oval(q, -30, 0, 58, 40); q.rect(10, -6, 70, 12); });
    g.strokeStyle = '#2a8a4a'; g.lineWidth = 10; g.lineCap = 'round'; g.beginPath(); g.moveTo(10, -4); g.lineTo(74, -2); g.stroke();   // bec
    g.fillStyle = '#e8b830'; g.beginPath(); rond(g, 78, -2, 12); g.fill(); g.fillStyle = '#9a7a1a'; g.beginPath(); for (let k = 0; k < 6; k++) rond(g, 78 + Math.cos(k * 1.05) * 6, -2 + Math.sin(k * 1.05) * 6, 1.6); g.fill();
    const gr = g.createLinearGradient(0, -40, 0, 40); gr.addColorStop(0, '#7ad87a'); gr.addColorStop(1, '#22803e');
    g.fillStyle = gr; g.beginPath(); U.oval(g, -30, 0, 58, 40); g.fill();
    g.strokeStyle = '#1e6a32'; g.lineWidth = 8; g.beginPath(); g.moveTo(-74, -30); g.quadraticCurveTo(-30, -62, 14, -30); g.stroke();   // anse
    g.fillStyle = '#1e5a6a'; g.beginPath(); U.oval(g, -62, 0, 14, 20); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); U.oval(g, -40, -20, 26, 8); g.fill();
    g.fillStyle = 'rgba(190,226,240,0.85)'; g.beginPath(); for (let k = 0; k < 6; k++) rond(g, 98 + k * 9, (k % 2 ? 5 : -6), 2.5); g.fill();
  },
  fanions(g, d, R, U) {                                // guirlande de fanions entre deux piquets
    const L = d[4] || 600, n = Math.round(L / 46), C = ['#e8302a', '#f5b800', '#2f7ad8', '#3aa046', '#f6f2ea', '#f07a12'];
    g.rotate(d[3]);
    const fl = (dx, dy, k) => { const x = -L / 2 + (k + 0.5) * L / n, s = Math.sin((k + 0.5) / n * Math.PI) * 26; g.moveTo(x - 14 + dx, s + dy); g.lineTo(x + 14 + dx, s + dy); g.lineTo(x + dx, s + 26 + dy); g.closePath(); };
    g.fillStyle = 'rgba(96,60,18,0.2)'; g.beginPath(); for (let k = 0; k < n; k++) fl(14, 22, k); g.fill();
    g.strokeStyle = 'rgba(40,30,20,0.7)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(-L / 2, 0); g.quadraticCurveTo(0, 52, L / 2, 0); g.stroke();
    for (let k = 0; k < n; k++) { g.fillStyle = C[k % C.length]; g.beginPath(); fl(0, 0, k); g.fill(); }
    for (const x of [-L / 2, L / 2]) { g.fillStyle = 'rgba(96,60,18,0.3)'; g.beginPath(); rond(g, x + 6, 9, 7); g.fill(); g.fillStyle = '#7a5530'; g.beginPath(); rond(g, x, 0, 7); g.fill(); g.fillStyle = '#e8302a'; g.beginPath(); rond(g, x - 1, -1, 3); g.fill(); }
  },
  barrieres(g, d) {                                    // deux barrières de chantier rayées rouge et blanc sur leurs pieds
    g.rotate(d[3]);
    for (const q of [[0, -40, 0], [24, 44, 0.5]]) {
      g.save(); g.translate(q[0], q[1]); g.rotate(q[2]);
      g.fillStyle = 'rgba(96,60,18,0.25)'; g.fillRect(-76, 6, 160, 24);
      g.fillStyle = '#3a3c42'; g.fillRect(-74, -20, 12, 40); g.fillRect(62, -20, 12, 40);
      g.save(); g.beginPath(); g.rect(-70, -9, 140, 18); g.clip();
      g.fillStyle = '#f6f2ea'; g.fillRect(-70, -9, 140, 18);
      g.fillStyle = '#d8261c'; g.beginPath(); for (let x = -90; x < 80; x += 28) { g.moveTo(x, 9); g.lineTo(x + 14, 9); g.lineTo(x + 32, -9); g.lineTo(x + 18, -9); g.closePath(); } g.fill();
      g.restore();
      g.fillStyle = '#f5b800'; g.beginPath(); rond(g, -68, -14, 5); g.fill();
      g.restore();
    }
  },
  brouette(g, d, R, U) {                               // brouette jouet en plastique : benne rouge pleine de sable, roue noire, bras jaunes
    g.rotate(d[3]);
    ombre(g, 7, 10, q => { q.moveTo(-60, -44); q.lineTo(60, -34); q.lineTo(60, 34); q.lineTo(-60, 44); q.closePath(); });
    g.strokeStyle = '#f5b800'; g.lineWidth = 8; g.lineCap = 'round'; g.beginPath(); g.moveTo(-50, -30); g.lineTo(-118, -36); g.moveTo(-50, 30); g.lineTo(-118, 36); g.stroke();
    g.fillStyle = '#1e1e22'; g.beginPath(); rrect(g, 56, -10, 38, 20, 9); g.fill();
    g.fillStyle = '#d8301e'; g.beginPath(); g.moveTo(-60, -44); g.lineTo(60, -34); g.lineTo(60, 34); g.lineTo(-60, 44); g.closePath(); g.fill();
    g.fillStyle = '#e8c68a'; g.beginPath(); U.oval(g, -2, 0, 50, 32); g.fill();
    g.fillStyle = '#f6e2b4'; g.beginPath(); U.oval(g, -12, -8, 24, 14); g.fill();
    g.fillStyle = 'rgba(150,104,52,0.5)'; g.beginPath(); for (let k = 0; k < 10; k++) rond(g, -30 + R() * 56, -18 + R() * 36, 2); g.fill();
  },
  sacs(g, d, R, U) {                                   // sacs de ciment empilés, un sac crevé (poudre grise)
    g.rotate(d[3]);
    U.blob(g, 66, 54, 48, 30, 0.4, R, 'rgba(150,152,156,0.55)');
    ombre(g, 7, 10, q => { q.rect(-74, -58, 148, 116); });
    const sac = (x, y, a, col) => {
      g.save(); g.translate(x, y); g.rotate(a); g.fillStyle = col; g.beginPath(); rrect(g, -46, -27, 92, 54, 10); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(-40, -23, 80, 6); g.fillStyle = '#c43a2a'; g.fillRect(-14, -20, 28, 40);
      g.fillStyle = '#f6f2ea'; g.fillRect(-9, -8, 18, 16); g.restore();
    };
    sac(-26, -28, 0.05, '#d8ccb0'); sac(30, -24, -0.08, '#cfc2a4'); sac(-20, 30, -0.04, '#d4c8aa'); sac(34, 32, 0.1, '#ddd2b8'); sac(4, 2, 0.6, '#e4dac2');
  },
  moules(g, d, R, U) {                                 // moules à sable en plastique (étoile, coquille) et leurs empreintes moulées
    g.rotate(d[3]);
    const etoile = (x, y, r, col) => { g.fillStyle = col; g.beginPath(); for (let k = 0; k < 10; k++) { const u = -Math.PI / 2 + k * Math.PI / 5, q = k % 2 ? r * 0.45 : r; if (k) g.lineTo(x + Math.cos(u) * q, y + Math.sin(u) * q); else g.moveTo(x + Math.cos(u) * q, y + Math.sin(u) * q); } g.closePath(); g.fill(); };
    const coquille = (x, y, r, col) => { g.fillStyle = col; g.beginPath(); g.moveTo(x, y + r * 0.6); g.arc(x, y, r, Math.PI * 0.85, Math.PI * 2.15); g.closePath(); g.fill(); g.strokeStyle = 'rgba(0,0,0,0.18)'; g.lineWidth = 2; g.beginPath(); for (let k = 1; k < 6; k++) { const u = Math.PI * (0.85 + k * 0.217); g.moveTo(x, y + r * 0.6); g.lineTo(x + Math.cos(u) * r, y + Math.sin(u) * r); } g.stroke(); };
    ombre(g, 5, 8, q => { rond(q, -50, -20, 36); rond(q, 40, 30, 30); });
    etoile(-50, -20, 38, '#e85a9a'); etoile(-50, -20, 26, '#f58ab8');
    coquille(40, 30, 32, '#2f9ad8');
    g.fillStyle = 'rgba(96,60,18,0.18)'; g.beginPath(); rond(g, 10, -54, 26); rond(g, -20, 52, 24); g.fill();
    etoile(6, -58, 26, '#dcb47a'); etoile(5, -59, 18, '#ecca94');
    coquille(-24, 48, 24, '#d8ae74');
  },
  palette(g, d, R, U) {                                // palette de parpaings : planches de la palette, 6 blocs creux
    g.rotate(d[3]);
    ombre(g, 7, 10, q => q.rect(-90, -66, 180, 132));
    g.fillStyle = '#b8884c'; g.fillRect(-90, -66, 180, 132);
    g.fillStyle = '#8a5e30'; for (let k = 0; k < 6; k++) g.fillRect(-90, -62 + k * 24, 180, 4);
    for (let r = 0; r < 2; r++) for (let k = 0; k < 3; k++) {
      const x = -84 + k * 57, y = -60 + r * 61;
      g.fillStyle = '#a4a6aa'; g.fillRect(x, y, 54, 58); g.fillStyle = '#c4c6ca'; g.fillRect(x, y, 54, 6);
      g.fillStyle = '#5e6066'; g.fillRect(x + 7, y + 12, 17, 36); g.fillRect(x + 30, y + 12, 17, 36);
    }
  },
  ouvriers(g, d, R, U) {                                  // figurines d'ouvriers (casques jaunes, gilets orange) autour d'un plan déplié
    g.rotate(d[3]);
    g.fillStyle = 'rgba(96,60,18,0.22)'; g.fillRect(-20, -8, 56, 40); g.fillStyle = '#f6f4ee'; g.fillRect(-26, -16, 52, 36);
    g.strokeStyle = '#2f6fb8'; g.lineWidth = 1.5; g.beginPath(); g.rect(-20, -10, 22, 16); g.moveTo(8, -10); g.lineTo(20, 12); g.moveTo(-20, 12); g.lineTo(2, 12); g.stroke();
    for (const q of [[-44, -6, 0.2], [40, -18, 2.6], [12, 42, -1.7]]) {
      g.save(); g.translate(q[0], q[1]); g.rotate(q[2]);
      g.fillStyle = 'rgba(96,60,18,0.25)'; g.beginPath(); U.oval(g, 5, 7, 16, 11); g.fill();
      g.fillStyle = '#f07a12'; g.beginPath(); U.oval(g, 0, 0, 16, 10); g.fill();                   // épaules (gilet)
      g.fillStyle = '#d8dc3a'; g.fillRect(-14, -2, 28, 4);                                          // bande réfléchissante
      g.fillStyle = '#f2c8a0'; g.beginPath(); rond(g, 15, 3, 4); rond(g, -15, 3, 4); g.fill();      // mains
      g.fillStyle = '#e0a800'; g.beginPath(); rond(g, 0, 0, 10.5); g.fill();                        // casque : bord, calotte, nervure
      g.fillStyle = '#f5c400'; g.beginPath(); rond(g, -1, -1, 8); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(-1.5, -8, 3, 14);
      g.restore();
    }
  },
  seaux(g, d, R, U) {                                  // seau retourné qu'on vient de démouler, tour fraîche à côté, pelle d'enfant
    g.rotate(d[3]);
    ombre(g, 7, 10, q => { rond(q, -40, 0, 44); rond(q, 50, 6, 40); });
    g.fillStyle = '#2a7ad8'; g.beginPath(); rond(g, -40, 0, 44); g.fill();                         // fond du seau, vu de dessus
    g.fillStyle = '#4a92e8'; g.beginPath(); rond(g, -42, -2, 34); g.fill();
    g.strokeStyle = 'rgba(20,60,120,0.5)'; g.lineWidth = 3; g.beginPath(); rond(g, -40, 0, 24); g.stroke();
    g.strokeStyle = '#2a7ad8'; g.lineWidth = 4; g.beginPath(); g.arc(-40, 0, 52, 2.2, 4.1); g.stroke();
    const gr = g.createRadialGradient(36, -10, 4, 50, 6, 40);
    gr.addColorStop(0, '#fbe6bc'); gr.addColorStop(0.6, '#e2bb7e'); gr.addColorStop(1, '#bd8c50');
    g.fillStyle = gr; g.beginPath(); rond(g, 50, 6, 40); g.fill();
    g.strokeStyle = 'rgba(140,92,40,0.35)'; g.lineWidth = 2; g.beginPath(); rond(g, 50, 6, 30); rond(g, 50, 6, 18); g.stroke();
    g.fillStyle = 'rgba(130,86,36,0.45)'; g.beginPath(); for (let k = 0; k < 8; k++) { const u = k * TAU / 8; rond(g, 50 + Math.cos(u) * 35, 6 + Math.sin(u) * 35, 4); } g.fill();
    g.strokeStyle = 'rgba(96,60,18,0.28)'; g.lineWidth = 8; g.lineCap = 'round'; g.beginPath(); g.moveTo(-6, 64); g.lineTo(96, 80); g.stroke();
    g.strokeStyle = '#3ab04e'; g.lineWidth = 7; g.beginPath(); g.moveTo(-12, 56); g.lineTo(70, 68); g.stroke();
    g.fillStyle = '#3ab04e'; g.beginPath(); U.oval(g, 84, 70, 18, 13); g.fill(); g.fillStyle = 'rgba(230,196,140,0.9)'; g.beginPath(); U.oval(g, 86, 70, 10, 7); g.fill();
  },
  feu(g, d) {                                          // feu tricolore de chantier sur son socle lesté (au rouge)
    g.rotate(d[3]);
    ombre(g, 6, 9, q => { q.rect(-46, -20, 92, 40); });
    g.fillStyle = '#3a3c42'; g.fillRect(-52, -24, 16, 48); g.fillRect(36, -24, 16, 48);
    g.fillStyle = '#f5b800'; g.beginPath(); rrect(g, -40, -18, 80, 36, 6); g.fill();
    g.fillStyle = '#1e1e22'; g.beginPath(); rrect(g, -34, -13, 68, 26, 5); g.fill();
    g.fillStyle = '#ff3a2a'; g.beginPath(); rond(g, -20, 0, 9); g.fill(); g.fillStyle = 'rgba(255,120,100,0.35)'; g.beginPath(); rond(g, -20, 0, 15); g.fill();
    g.fillStyle = '#5a4a10'; g.beginPath(); rond(g, 0, 0, 8); g.fill(); g.fillStyle = '#123a1a'; g.beginPath(); rond(g, 20, 0, 8); g.fill();
  },
  rouleau(g, d) {                                      // compacteur jouet : gros cylindre, châssis jaune, cabine, roues arrière
    g.rotate(d[3]);
    ombre(g, 7, 10, q => q.rect(-70, -40, 140, 80));
    g.fillStyle = '#1e1e22'; g.fillRect(-60, -42, 30, 14); g.fillRect(-60, 28, 30, 14);
    const gr = g.createLinearGradient(30, 0, 72, 0); gr.addColorStop(0, '#8a8f96'); gr.addColorStop(0.4, '#d8dce0'); gr.addColorStop(1, '#6a6e74');
    g.fillStyle = gr; g.fillRect(30, -44, 42, 88);
    g.fillStyle = '#f5b800'; g.beginPath(); rrect(g, -66, -30, 104, 60, 10); g.fill();
    g.fillStyle = '#d99a00'; g.fillRect(14, -32, 18, 64);
    g.fillStyle = '#2a2c32'; g.beginPath(); rrect(g, -44, -22, 40, 44, 6); g.fill();
    g.fillStyle = '#9fd4ee'; g.fillRect(-40, -18, 32, 10); g.fillStyle = '#f07a12'; g.beginPath(); rond(g, -24, 0, 5); g.fill();
  },
};

// ── obstacles posés dans le sable ──
const OBJETS = {
  cone(g, r) {                                         // cône de signalisation (il renvoie les voitures) : socle noir, bande blanche
    const x = r[0], y = r[1], s = r[2];
    g.fillStyle = 'rgba(96,60,18,0.3)'; g.beginPath(); g.moveTo(x - s * 0.5, y); g.lineTo(x + s * 1.6, y + s * 2.2); g.lineTo(x + s * 0.5, y + s * 0.2); g.closePath(); g.fill();
    g.beginPath(); rrect(g, x - s + 4, y - s + 6, 2 * s, 2 * s, 4); g.fill();
    g.fillStyle = '#26262a'; g.beginPath(); rrect(g, x - s, y - s, 2 * s, 2 * s, 4); g.fill();
    g.fillStyle = '#ff6a10'; g.beginPath(); rond(g, x, y, s * 0.8); g.fill();
    g.fillStyle = '#f6f4ee'; g.beginPath(); rond(g, x, y, s * 0.56); g.fill();
    g.fillStyle = '#ff7a24'; g.beginPath(); rond(g, x, y, s * 0.36); g.fill();
    g.fillStyle = '#ffc08a'; g.beginPath(); rond(g, x - s * 0.1, y - s * 0.12, s * 0.15); g.fill();
  },
  tas(g, r, R, U) {                                    // tas de sable : éboulis, monticule éclairé, rigoles ; fanion, pelle plantée ou empreinte de main
    const x = r[0], y = r[1], s = r[2], v = Math.round(x + y) % 3;
    U.blob(g, x, y, s * 1.22, s * 1.14, R() * 3, R, 'rgba(226,190,130,0.6)');
    g.fillStyle = 'rgba(96,60,18,0.14)'; g.beginPath(); rond(g, x + s * 0.3, y + s * 0.4, s); g.fill();
    g.fillStyle = 'rgba(96,60,18,0.2)'; g.beginPath(); rond(g, x + s * 0.15, y + s * 0.2, s); g.fill();
    const gr = g.createRadialGradient(x - s * 0.35, y - s * 0.4, s * 0.08, x, y, s);
    gr.addColorStop(0, '#fbe9c4'); gr.addColorStop(0.5, '#e6c38a'); gr.addColorStop(1, '#c2945a');
    g.fillStyle = gr; g.beginPath(); rond(g, x, y, s);
    for (let k = 0; k < 5; k++) { const u = k * TAU / 5 + R() * 0.8; rond(g, x + Math.cos(u) * s * 0.7, y + Math.sin(u) * s * 0.7, s * (0.3 + R() * 0.08)); }   // contour bosselé
    g.fill();
    g.fillStyle = 'rgba(150,100,46,0.22)'; g.beginPath(); g.arc(x, y, s, -0.4, 2); g.arc(x - s * 0.14, y - s * 0.16, s * 0.9, 2, -0.4, true); g.fill();   // flanc à l'ombre
    g.strokeStyle = 'rgba(150,102,48,0.3)'; g.lineWidth = 2; g.beginPath();
    for (let k = 0; k < 16; k++) { const u = R() * TAU, a = s * (0.3 + R() * 0.25); g.moveTo(x + Math.cos(u) * a, y + Math.sin(u) * a); g.lineTo(x + Math.cos(u + 0.12) * s * 0.96, y + Math.sin(u + 0.12) * s * 0.96); }
    g.stroke();
    g.fillStyle = 'rgba(255,248,226,0.5)'; g.beginPath(); for (let k = 0; k < 30; k++) { const u = R() * TAU, q = Math.sqrt(R()) * s * 0.9; g.rect(x + Math.cos(u) * q, y + Math.sin(u) * q, 2.5, 2.5); } g.fill();
    if (v === 0) {                                     // fanion planté au sommet
      g.strokeStyle = 'rgba(96,60,18,0.3)'; g.lineWidth = 3; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 40, y + 34); g.stroke();
      g.strokeStyle = '#7a5530'; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 18, y - 30); g.stroke();
      g.fillStyle = '#2f7ad8'; g.beginPath(); g.moveTo(x + 18, y - 30); g.lineTo(x + 46, y - 22); g.lineTo(x + 20, y - 12); g.closePath(); g.fill();
    } else if (v === 1) {                              // petite pelle rouge plantée
      g.strokeStyle = 'rgba(96,60,18,0.3)'; g.lineWidth = 7; g.lineCap = 'round'; g.beginPath(); g.moveTo(x + 8, y + 6); g.lineTo(x + 50, y + 44); g.stroke();
      g.strokeStyle = '#f5b800'; g.lineWidth = 6; g.beginPath(); g.moveTo(x + 4, y - 2); g.lineTo(x - 22, y - 34); g.stroke();
      g.fillStyle = '#e8302a'; g.beginPath(); U.oval(g, x + 8, y + 4, 12, 9); g.fill();
    } else {                                           // empreinte de main d'enfant
      g.fillStyle = 'rgba(150,100,44,0.35)'; g.beginPath(); U.oval(g, x - 8, y + 6, 14, 17); for (let k = 0; k < 5; k++) { const u = -2.6 + k * 0.42; U.oval(g, x - 8 + Math.cos(u) * 26, y + 6 + Math.sin(u) * 26, 4.5, 6); } g.fill();
    }
  },
  seau(g, r, R, U) {                                   // seau de plage : rebord, paroi, sable tassé dedans, anse couchée
    const x = r[0], y = r[1], s = r[2], C = [['#e8302a', '#ff6a5a'], ['#2a7ad8', '#6aaef0'], ['#f5b800', '#ffd85a']][Math.round(x) % 3];
    ombre(g, 7, 10, q => rond(q, x, y, s));
    g.fillStyle = C[0]; g.beginPath(); rond(g, x, y, s); g.fill();
    g.fillStyle = C[1]; g.beginPath(); rond(g, x - 2, y - 2, s * 0.88); g.fill();
    const gr = g.createRadialGradient(x - s * 0.2, y - s * 0.2, s * 0.1, x, y, s * 0.74);
    gr.addColorStop(0, '#f0d39c'); gr.addColorStop(0.8, '#d4ad6e'); gr.addColorStop(1, '#a8804a');
    g.fillStyle = gr; g.beginPath(); rond(g, x, y, s * 0.74); g.fill();
    g.strokeStyle = 'rgba(140,92,40,0.35)'; g.lineWidth = 2; g.beginPath(); rond(g, x + 2, y + 2, s * 0.45); g.stroke();
    g.strokeStyle = C[0]; g.lineWidth = 3.5; g.beginPath(); g.arc(x, y, s * 1.18, 0.5, 2.6); g.stroke();
    g.fillStyle = C[0]; g.beginPath(); rond(g, x + Math.cos(0.5) * s, y + Math.sin(0.5) * s, 5); rond(g, x + Math.cos(2.6) * s, y + Math.sin(2.6) * s, 5); g.fill();
  },
  chateau(g, r, R, U) {                                // petit château au bord de la piste : grosse tour moulée, trois tourelles, fanion
    const x = r[0], y = r[1], s = r[2];
    ombre(g, 7, 10, q => rond(q, x, y, s));
    const tour = (cx, cy, q) => {
      const gr = g.createRadialGradient(cx - q * 0.4, cy - q * 0.45, q * 0.1, cx, cy, q);
      gr.addColorStop(0, '#f8e4b8'); gr.addColorStop(0.6, '#dfb77a'); gr.addColorStop(1, '#bb8a4e');
      g.fillStyle = gr; g.beginPath(); rond(g, cx, cy, q); g.fill();
      g.strokeStyle = 'rgba(140,92,40,0.35)'; g.lineWidth = 2; g.beginPath(); rond(g, cx, cy, q * 0.7); g.stroke();
      g.fillStyle = 'rgba(130,86,36,0.45)'; g.beginPath(); for (let k = 0; k < 8; k++) { const u = k * TAU / 8; rond(g, cx + Math.cos(u) * q * 0.88, cy + Math.sin(u) * q * 0.88, q * 0.1); } g.fill();
    };
    for (let k = 0; k < 3; k++) { const u = 0.6 + k * TAU / 3; tour(x + Math.cos(u) * s * 0.66, y + Math.sin(u) * s * 0.66, s * 0.34); }
    tour(x, y, s * 0.6);
    g.strokeStyle = '#7a5530'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 14, y - 26); g.stroke();
    g.fillStyle = '#e8302a'; g.beginPath(); g.moveTo(x + 14, y - 26); g.lineTo(x + 38, y - 20); g.lineTo(x + 16, y - 12); g.closePath(); g.fill();
  },
};

// ── murs : cadre (dessiné par bord), pelle et râteau d'enfant couchés au bord de la piste, briques ──
const lig = (g, w, dx, dy) => { g.beginPath(); g.moveTo(w[0] + dx, w[1] + dy); g.lineTo(w[2] + dx, w[3] + dy); };
const MURS = {
  cadre() {},
  pelle(g, w, R, U) {                                        // manche jaune à poignée en T, ou lame rouge (w[6] = 'lame')
    g.save(); g.lineCap = 'round';
    if (w[6] === 'lame') {
      const a = Math.atan2(w[3] - w[1], w[2] - w[0]), L = Math.hypot(w[2] - w[0], w[3] - w[1]) + w[4];
      g.translate(w[0], w[1]); g.rotate(a);
      const forme = q => { q.moveTo(-6, -15); q.lineTo(L - 10, -22); q.quadraticCurveTo(L + 4, 0, L - 10, 22); q.lineTo(-6, 15); q.closePath(); };
      g.fillStyle = 'rgba(96,60,18,0.28)'; g.save(); g.translate(5, 8); g.beginPath(); forme(g); g.fill(); g.restore();
      g.fillStyle = '#d8301e'; g.beginPath(); forme(g); g.fill();
      g.fillStyle = '#f0503a'; g.beginPath(); g.moveTo(-2, -10); g.lineTo(L - 14, -15); g.lineTo(L - 14, -4); g.lineTo(-2, -3); g.closePath(); g.fill();
      g.strokeStyle = '#a82214'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, 0); g.lineTo(L - 16, 0); g.stroke();
      g.fillStyle = 'rgba(230,196,140,0.85)'; g.beginPath(); U.oval(g, L - 18, 6, 12, 9); g.fill();
    } else {
      lig(g, w, 4, 7); g.strokeStyle = 'rgba(96,60,18,0.28)'; g.lineWidth = w[4] * 2; g.stroke();
      lig(g, w, 0, 0); g.strokeStyle = '#f2c21a'; g.stroke();
      lig(g, w, -1.5, -2); g.strokeStyle = 'rgba(255,240,170,0.7)'; g.lineWidth = 3; g.stroke();
      const a = Math.atan2(w[3] - w[1], w[2] - w[0]), px = -Math.sin(a) * 22, py = Math.cos(a) * 22;
      g.strokeStyle = '#f2c21a'; g.lineWidth = 11; g.beginPath(); g.moveTo(w[0] - px, w[1] - py); g.lineTo(w[0] + px, w[1] + py); g.stroke();
    }
    g.restore();
  },
  rateau(g, w) {                                       // manche vert, ou tête à dents (w[6] = 'tete', w[7] = direction des dents)
    g.save(); g.lineCap = 'round';
    if (w[6] === 'tete') {
      const ux = Math.cos(w[7]) * 20, uy = Math.sin(w[7]) * 20, N = 9;
      g.strokeStyle = 'rgba(96,60,18,0.28)'; g.lineWidth = 6; g.beginPath();
      for (let k = 0; k < N; k++) { const f = (k + 0.5) / N, x = w[0] + (w[2] - w[0]) * f + 4, y = w[1] + (w[3] - w[1]) * f + 7; g.moveTo(x, y); g.lineTo(x + ux, y + uy); }
      g.stroke(); lig(g, w, 4, 7); g.lineWidth = w[4] * 2; g.stroke();
      g.strokeStyle = '#2f9a44'; g.lineWidth = 6; g.beginPath();
      for (let k = 0; k < N; k++) { const f = (k + 0.5) / N, x = w[0] + (w[2] - w[0]) * f, y = w[1] + (w[3] - w[1]) * f; g.moveTo(x, y); g.lineTo(x + ux, y + uy); }
      g.stroke();
      lig(g, w, 0, 0); g.strokeStyle = '#3ab04e'; g.lineWidth = w[4] * 2; g.stroke();
      lig(g, w, -1, -2); g.strokeStyle = 'rgba(200,255,200,0.45)'; g.lineWidth = 3; g.stroke();
    } else {
      lig(g, w, 4, 7); g.strokeStyle = 'rgba(96,60,18,0.28)'; g.lineWidth = w[4] * 2; g.stroke();
      lig(g, w, 0, 0); g.strokeStyle = '#2f9a44'; g.stroke();
      lig(g, w, -1, -1.5); g.strokeStyle = 'rgba(200,255,200,0.45)'; g.lineWidth = 2.5; g.stroke();
    }
    g.restore();
  },
  brique(g, w) {                                       // brique creuse orangée (capsule courte), arêtes au soleil, trous
    const dx = w[2] - w[0], dy = w[3] - w[1], L = Math.hypot(dx, dy) + 2 * w[4], h = 2 * w[4];
    g.save(); g.translate((w[0] + w[2]) / 2, (w[1] + w[3]) / 2); g.rotate(Math.atan2(dy, dx));
    g.fillStyle = 'rgba(96,60,18,0.3)'; g.fillRect(-L / 2 + 5, -h / 2 + 7, L, h);
    g.fillStyle = '#b4502c'; g.fillRect(-L / 2, -h / 2, L, h);
    g.fillStyle = '#d26c42'; g.fillRect(-L / 2, -h / 2, L, 4); g.fillRect(-L / 2, -h / 2, 4, h);
    g.fillStyle = '#6a2a14'; g.beginPath(); for (const k of [-1, 0, 1]) rrect(g, k * L * 0.28 - 5, -5, 10, 10, 3); g.fill();
    g.fillStyle = 'rgba(220,216,206,0.7)'; g.beginPath(); for (let k = 0; k < 4; k++) rond(g, -L / 2 + 6 + k * 13, h / 2 - 3, 1.8); g.fill();
    g.restore();
  },
};

// ── zones : sable mou (on s'enlise), flaque de boue (on glisse) ──
const ZONES = {
  sablemou(g, z, R, U) {
    g.save(); g.translate(z[0], z[1]); g.rotate(z[5]);
    U.blob(g, 3, 5, z[2] * 1.05, z[3] * 1.05, 0, R, 'rgba(150,100,44,0.2)');
    U.blob(g, 0, 0, z[2], z[3], 0.3, R, '#efd6a2');
    g.strokeStyle = 'rgba(176,126,62,0.35)'; g.lineWidth = 2.5; g.beginPath(); for (let k = -2; k <= 2; k++) { g.moveTo(-z[2] * 0.7, k * z[3] * 0.28); g.quadraticCurveTo(0, k * z[3] * 0.28 - 10, z[2] * 0.7, k * z[3] * 0.28); } g.stroke();
    g.fillStyle = 'rgba(255,250,232,0.6)'; g.beginPath(); for (let k = 0; k < 40; k++) { const u = R() * TAU, q = Math.sqrt(R()) * 0.85; g.rect(Math.cos(u) * z[2] * q, Math.sin(u) * z[3] * q, 2.5, 2.5); } g.fill();
    g.restore();
  },
  boue(g, z, R, U) {
    g.save(); g.translate(z[0], z[1]); g.rotate(z[5]);
    U.blob(g, 0, 0, z[2] * 1.12, z[3] * 1.15, 0, R, 'rgba(120,76,32,0.45)');
    U.blob(g, 0, 0, z[2] * 0.95, z[3] * 0.95, 0.2, R, '#6a4626');
    U.blob(g, -z[2] * 0.1, 0, z[2] * 0.6, z[3] * 0.55, 0.5, R, 'rgba(150,112,64,0.5)');
    g.fillStyle = 'rgba(246,236,214,0.45)'; g.beginPath(); U.oval(g, -z[2] * 0.3, -z[3] * 0.3, z[2] * 0.3, z[3] * 0.14); g.fill();
    g.strokeStyle = 'rgba(60,36,14,0.45)'; g.lineWidth = 12; g.setLineDash([4, 5]); g.beginPath(); g.moveTo(-z[2], z[3] * 0.25); g.lineTo(z[2], z[3] * 0.15); g.stroke(); g.setLineDash([]);
    g.restore();
  },
};

// ── obstacles mobiles (redessinés à chaque image : rester sobre) ──
const MOBILES = {
  pelleteuse(g, m, o, now, U, reduceFx) {              // pelleteuse jouet : chenilles, tourelle jaune qui pivote, bras et godet
    const a = Math.atan2(m.seg[1][1] - m.seg[0][1], m.seg[1][0] - m.seg[0][0]), sw = reduceFx ? 0 : Math.sin(now / 520) * 0.45;
    g.save(); g.translate(o.x, o.y); g.rotate(a);
    g.fillStyle = 'rgba(96,60,18,0.3)'; g.beginPath(); rrect(g, -24, -20, 58, 52, 10); g.fill();
    g.fillStyle = '#26262a'; g.fillRect(-29, -27, 54, 13); g.fillRect(-29, 14, 54, 13);
    g.strokeStyle = '#5a5c62'; g.lineWidth = 2; g.beginPath(); const d = ((o.y * 0.5) % 6 + 6) % 6;
    for (let x = -27 + d; x < 24; x += 6) { g.moveTo(x, -27); g.lineTo(x, -14); g.moveTo(x, 14); g.lineTo(x, 27); }
    g.stroke();
    g.rotate(sw);
    g.strokeStyle = '#e0a000'; g.lineWidth = 9; g.lineCap = 'round'; g.beginPath(); g.moveTo(4, 5); g.lineTo(32, 5); g.stroke();
    g.fillStyle = '#4a4c52'; g.beginPath(); rrect(g, 30, -6, 13, 22, 4); g.fill();
    g.fillStyle = '#f5b800'; g.beginPath(); rrect(g, -21, -18, 38, 36, 7); g.fill();
    g.fillStyle = '#c88a00'; g.fillRect(-21, -12, 12, 24);
    g.fillStyle = '#9fd4ee'; g.beginPath(); rrect(g, 1, -16, 14, 14, 3); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.75)'; g.fillRect(3, -14, 4, 10);
    g.restore();
  },
  betonniere(g, m, o, now, U, reduceFx) {              // camion toupie : châssis, cabine orange, toupie rayée qui tourne
    g.save(); g.translate(o.x, o.y); g.rotate(o.a);
    g.fillStyle = 'rgba(96,60,18,0.3)'; g.beginPath(); rrect(g, -32, -12, 72, 36, 8); g.fill();
    g.fillStyle = '#1e1e22'; for (const x of [-24, -10, 22]) { g.fillRect(x - 5, -19, 11, 6); g.fillRect(x - 5, 13, 11, 6); }
    g.fillStyle = '#3a3c42'; g.fillRect(-36, -14, 72, 28);
    g.fillStyle = '#e8641c'; g.beginPath(); rrect(g, 16, -16, 22, 32, 5); g.fill();
    g.fillStyle = '#9fd4ee'; g.fillRect(31, -12, 5, 24);
    g.save(); g.beginPath(); U.oval(g, -9, 0, 25, 15); g.clip();
    g.fillStyle = '#dcd8d0'; g.fillRect(-36, -16, 54, 32);
    g.strokeStyle = '#e8641c'; g.lineWidth = 5; g.beginPath(); const off = reduceFx ? 0 : (now / 70) % 16;
    for (let k = -4; k < 4; k++) { g.moveTo(-40 + k * 16 + off, 16); g.lineTo(-24 + k * 16 + off, -16); }
    g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.4)'; g.fillRect(-36, -12, 54, 6);
    g.restore();
    g.fillStyle = '#8a8c92'; g.fillRect(-42, -3, 9, 6);
    g.restore();
  },
  benne(g, m, o, now, U) {                             // camion-benne : cabine jaune, benne rouge chargée de sable, grosses roues
    g.save(); g.translate(o.x, o.y); g.rotate(o.a);
    g.fillStyle = 'rgba(96,60,18,0.3)'; g.beginPath(); rrect(g, -30, -14, 70, 38, 8); g.fill();
    g.fillStyle = '#1e1e22'; for (const x of [-20, 22]) { g.fillRect(x - 8, -21, 16, 8); g.fillRect(x - 8, 13, 16, 8); }
    g.fillStyle = '#f5b800'; g.beginPath(); rrect(g, 14, -16, 24, 32, 6); g.fill();
    g.fillStyle = '#9fd4ee'; g.fillRect(31, -12, 5, 24);
    g.fillStyle = '#d8401c'; g.beginPath(); rrect(g, -36, -18, 50, 36, 4); g.fill();
    g.fillStyle = '#e8c88a'; g.beginPath(); U.oval(g, -11, 0, 21, 13); g.fill();
    g.fillStyle = '#f6e2b4'; g.beginPath(); U.oval(g, -15, -4, 9, 5); g.fill();
    g.restore();
  },
};

export default {
  id: 'chantier', nom: 'Bac à sable', emoji: '🚧', sous: 'Chantier miniature · épingles, cônes, pelleteuse et bétonnière',
  w: 3560, h: 2680, surf: 'sable', edge: 'mur', table: T, W: 90,
  pts: PTS,
  mobs: [
    { type: 'pelleteuse', seg: PELLE, r: 30, per: 9 },                            // sort de son trou et mord sur l'allée du slalom
    { type: 'betonniere', cer: BETON, r: 28, per: 15 },                            // tourne autour des sacs : remontée et coin de la grue
    { type: 'benne', chemin: BENNE, r: 28, per: 17 },                              // boucle entre la ligne droite et l'épingle de la brouette
  ],
  bumpers: ['cone'],
  zonesPhysiques: { sablemou: 'frein', boue: 'glisse' },
  make(H) {
    const c = H.c, n = c.n, T0 = c.table;
    const ici = (x, y) => { let b = 0, bd = Infinity; for (let i = 0; i < n; i++) { const dx = c.sx[i] - x, dy = c.sy[i] - y, q = dx * dx + dy * dy; if (q < bd) { bd = q; b = i; } } return b / n; };
    const pt = (x, y, lat) => H.at(ici(x, y), lat);
    const deco = (x, y, t, a, v) => c.deco.push([x, y, t, a || 0, v]);
    // cadre du bac (bandes) et bancs d'angle
    H.wall(T0.x0, T0.y0, T0.x1, T0.y0, 24, 'cadre'); H.wall(T0.x1, T0.y0, T0.x1, T0.y1, 24, 'cadre');
    H.wall(T0.x1, T0.y1, T0.x0, T0.y1, 24, 'cadre'); H.wall(T0.x0, T0.y1, T0.x0, T0.y0, 24, 'cadre');
    for (const q of COINS) H.wall(q[0], q[1], q[2], q[3], 12, 'cadre');
    // turbos : deux sur la planche, un sur la ligne droite du départ
    H.boostAt(ici(2480, 360)); H.boostAt(ici(1820, 360)); H.boostAt(ici(1480, 2320));
    // tas de sable au creux des épingles
    for (const q of TAS) H.rock(q[0], q[1], q[2], 'tas');
    // cônes (ils renvoient) : à l'extérieur des épingles, slalom de l'allée de la pelleteuse
    for (const q of [[2230, 1620, -0.78], [2610, 2280, 0.78], [2060, 960, -0.78], [3040, 560, 0.78], [410, 1110, 0.78], [1340, 1510, -0.78],
      [700, 1310, 0.5], [1090, 1310, -0.5], [2040, 2030, 0.62]]) { const p = pt(q[0], q[1], q[2]); H.rock(p.x, p.y, 15, 'cone'); }
    // seaux, petits châteaux au bord de la piste
    for (const q of [[2040, 1880, -0.72], [850, 1710, 0.72]]) { const p = pt(q[0], q[1], q[2]); H.rock(p.x, p.y, 34, 'seau'); }
    for (const q of [[680, 910, 0.95], [1720, 2320, 0.95]]) { const p = pt(q[0], q[1], q[2]); H.rock(p.x, p.y, 44, 'chateau'); }
    // briques oubliées (sur la planche, au bord de l'allée de la bétonnière)
    for (const q of [[2150, 360, 0.78], [1640, 360, -0.78], [2400, 1160, -0.8], [2340, 1160, -0.8]]) {
      const p = pt(q[0], q[1], q[2]), tx = c.tx[p.i] * 13, ty = c.ty[p.i] * 13; H.wall(p.x - tx, p.y - ty, p.x + tx, p.y + ty, 12, 'brique');
    }
    // pelle d'enfant couchée en travers du bord de la remontée, râteau au bord de l'allée du coin
    H.wall(3120, 1900, 2925, 1838, 8, 'pelle'); c.walls.push([2925, 1838, 2866, 1824, 16, 'pelle', 'lame']);
    H.wall(2585, 1035, 2535, 830, 6, 'rateau'); c.walls.push([2470, 820, 2600, 820, 9, 'rateau', 'tete', -Math.PI / 2]);
    // sable mou (frein) et flaques de boue (glisse), jamais sur toute la largeur
    H.zoneAt(ici(2420, 1960), 0.45, 68, 42, 'sablemou'); H.zoneAt(ici(1000, 1710), -0.42, 70, 44, 'sablemou'); H.zoneAt(ici(2450, 1160), 0.42, 66, 42, 'sablemou');
    H.zoneAt(ici(820, 910), -0.42, 66, 42, 'boue'); H.zoneAt(ici(2800, 1470), -0.42, 64, 40, 'boue'); H.zoneAt(ici(500, 2010), 0.42, 62, 40, 'boue');
    // boîtes de bonus : remontée, planche, allée de l'arrosoir
    for (const q of [[2800, 2040], [2700, 360], [980, 910]]) { const f = ici(q[0], q[1]); for (const lat of [-0.5, 0, 0.5]) { const p = H.at(f, lat); c.boxes.push([p.x, p.y]); } }
    // décor du chantier
    deco(GRUE[0], GRUE[1], 'grue', GRUE[2]);
    deco(3215, 1560, 'chateau', 0, 1.15); deco(3130, 2300, 'chateau', 0.3, 0.72);
    deco(3215, 1000, 'baraque', Math.PI / 2); deco(1700, 640, 'planches', 0.08); deco(235, 660, 'tuyaux', Math.PI / 2);
    deco(250, 1560, 'panneau', 0.1); deco(820, 1110, 'arrosoir', -Math.PI / 2 + 0.3);
    deco(2150, 185, 'fanions', 0, 900); deco(1250, 2480, 'fanions', 0, 700); deco(740, 2080, 'barrieres', -0.8);
    deco(1250, 1100, 'brouette', 0.4); deco(BETON[0], BETON[1], 'sacs', 0); deco(3250, 2060, 'moules', 0);
    deco(2450, 560, 'palette', 0.1); deco(1400, 2015, 'rouleau', 0.2);
    deco(1450, 920, 'ouvriers', 0.3); deco(2000, 1480, 'ouvriers', -2.2); deco(660, 540, 'seaux', 0.15); deco(830, 2478, 'feu', 0);
  },
  dessin: {
    sol, plateau, piste, bord, final,
    decor: DECOR, objets: OBJETS, murs: MURS, zones: ZONES, mobiles: MOBILES,
    hors: '#4e8630', traces: 'rgba(104,64,24,0.32)', poussiere: '226,196,140',
  },
};
