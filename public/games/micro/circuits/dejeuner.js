// Circuit « dejeuner » de Micro Machines — définition PARTAGÉE serveur / client (géométrie, obstacles, zones, décor).
// Format : voir l'en-tête de ../shared.js ; dessins propres au circuit (propriété `dessin`) : voir ../rendu.js.

// Tracé « à la tortue » : départ (x, y) au cap `cap` (degrés : 0 = vers la droite, 90 = vers le bas), puis
// ['ligne', long] | ['gauche' | 'droite', rayon, degrés]. Les deux lignes marquées 'fermer' s'allongent (ou raccourcissent)
// pour refermer la boucle exactement. Sortie : un point tous les ~100 u (Catmull-Rom les relie sans bosse).
function tortue(x0, y0, cap, prog) {
  const marche = (pr, pts) => {
    let x = x0, y = y0, a = cap * Math.PI / 180;
    for (const s of pr) {
      if (s[0] === 'ligne') {
        const k = Math.max(1, Math.round(s[1] / 100));
        for (let i = 1; i <= k && pts; i++) pts.push([x + Math.cos(a) * s[1] * i / k, y + Math.sin(a) * s[1] * i / k]);
        x += Math.cos(a) * s[1]; y += Math.sin(a) * s[1];
      } else {
        const sg = s[0] === 'droite' ? 1 : -1, R = s[1], da = s[2] * Math.PI / 180, cx = x - Math.sin(a) * R * sg, cy = y + Math.cos(a) * R * sg;
        const k = Math.max(2, Math.ceil(R * da / 90));
        for (let i = 1; i <= k; i++) { const b = a + sg * da * i / k; if (pts) pts.push([cx + Math.sin(b) * R * sg, cy - Math.cos(b) * R * sg]); }
        a += sg * da; x = cx + Math.sin(a) * R * sg; y = cy - Math.cos(a) * R * sg;
      }
    }
    return { x, y };
  };
  const cap0 = cap * Math.PI / 180, libres = [];                // cap de chaque ligne libre (il ne dépend pas des longueurs)
  let a = cap0;
  for (const s of prog) { if (s[0] === 'ligne') { if (s[2] === 'fermer') libres.push(a); } else a += (s[0] === 'droite' ? 1 : -1) * s[2] * Math.PI / 180; }
  const e = marche(prog, null), rx = x0 - e.x, ry = y0 - e.y, u = [Math.cos(libres[0]), Math.sin(libres[0])], v = [Math.cos(libres[1]), Math.sin(libres[1])];
  const det = u[0] * v[1] - u[1] * v[0], d1 = (rx * v[1] - ry * v[0]) / det, d2 = (u[0] * ry - u[1] * rx) / det;
  let n = 0;
  const pr = prog.map(s => (s[2] === 'fermer' ? ['ligne', s[1] + (n++ ? d2 : d1)] : s));
  const pts = [[x0, y0]];
  marche(pr, pts);
  pts.pop();                                                    // le dernier point retombe sur le départ
  return pts.map(p => [Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10]);
}

// ── petits outils de dessin (décor fixe : peint une fois ; mobiles : à chaque image, donc sobres) ──
const TAU = Math.PI * 2;
// ombre douce portée vers le bas-droite (lumière fixe en haut à gauche, quel que soit l'angle a du repère courant) : une passe
// large et pâle puis une serrée plus sombre ; f() trace le contour ; k = hauteur de l'objet
function ombre(g, a, k, f) {
  const c = Math.cos(a), s = Math.sin(a);
  for (let p = 0; p < 2; p++) {
    const ox = (p ? 4 : 9) * k, oy = (p ? 6 : 13) * k;
    g.save(); g.translate(ox * c + oy * s, -ox * s + oy * c); g.fillStyle = p ? 'rgba(52,26,8,0.22)' : 'rgba(52,26,8,0.1)';
    g.beginPath(); f(); g.fill(); g.restore();
  }
}
function lin(g, x0, y0, x1, y1, c0, c1) { const gr = g.createLinearGradient(x0, y0, x1, y1); gr.addColorStop(0, c0); gr.addColorStop(1, c1); return gr; }
function bombe(g, x, y, r, c0, c1) { const gr = g.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.08, x, y, r); gr.addColorStop(0, c0); gr.addColorStop(1, c1); return gr; }   // volume éclairé en haut à gauche
function disque(g, x, y, r, col) { g.fillStyle = col; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }
function cercle(g, x, y, r, lw, col) { g.strokeStyle = col; g.lineWidth = lw; g.beginPath(); g.arc(x, y, r, 0, TAU); g.stroke(); }
function reflet(g, U, x, y, rx, ry, al) { g.fillStyle = 'rgba(255,255,255,' + al + ')'; g.beginPath(); U.oval(g, x, y, rx, ry); g.fill(); }
const ANNEAUX = ['#e8452c', '#f5a623', '#f7d038', '#6cc04a', '#9b59d0', '#ef6fa8'];
function anneaux(g, P, r) {                           // anneaux de céréales P = [[x, y, couleur]…] : ombre, anneau, reflet (un chemin par couleur)
  g.fillStyle = 'rgba(110,70,20,0.28)'; g.beginPath(); for (const q of P) { g.moveTo(q[0] + 2 + r, q[1] + 3); g.arc(q[0] + 2, q[1] + 3, r, 0, TAU); } g.fill();
  for (const col of ANNEAUX) {
    g.fillStyle = col; g.beginPath();
    for (const q of P) if (q[2] === col) { g.moveTo(q[0] + r, q[1]); g.arc(q[0], q[1], r, 0, TAU); g.moveTo(q[0] + r * 0.4, q[1]); g.arc(q[0], q[1], r * 0.4, 0, TAU, true); }
    g.fill();
  }
  g.fillStyle = 'rgba(255,255,255,0.45)'; g.beginPath(); for (const q of P) { g.moveTo(q[0] - r * 0.3, q[1] - r * 0.55); g.arc(q[0] - r * 0.5, q[1] - r * 0.55, r * 0.2, 0, TAU); } g.fill();
}
function plat(g, U, x, y, r, col, a) {                // assiette de porcelaine : marli bombé, filet de couleur, creux, reflet du bord
  ombre(g, a || 0, 0.5, () => g.arc(x, y, r, 0, TAU));
  g.fillStyle = bombe(g, x, y, r, '#ffffff', '#d3d8e1'); g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
  if (col) cercle(g, x, y, r * 0.9, 3, col);
  disque(g, x, y, r * 0.66, '#f5f6f9'); cercle(g, x, y, r * 0.66, 2, 'rgba(140,150,170,0.3)');
  g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = r * 0.06; g.beginPath(); g.arc(x, y, r * 0.8, 3.5, 4.6); g.stroke();
}
function sucre(g, U, x, y, h, a, a0) {                // morceau de sucre : tranche ombrée, face du dessus, grains (a0 = angle du repère parent)
  g.save(); g.translate(x, y); g.rotate(a);
  const b = a + (a0 || 0), c = Math.cos(b), s = Math.sin(b), ox = (2 * c + 3 * s) * h / 12, oy = (-2 * s + 3 * c) * h / 12;
  ombre(g, b, h / 24, () => U.rr(g, -h, -h, 2 * h, 2 * h, h * 0.25));
  g.fillStyle = '#c4c8d0'; g.beginPath(); U.rr(g, -h + ox, -h + oy, 2 * h, 2 * h, h * 0.25); g.fill();
  g.fillStyle = lin(g, -h, -h, h, h, '#ffffff', '#e4e7ec'); g.beginPath(); U.rr(g, -h, -h, 2 * h, 2 * h, h * 0.25); g.fill();
  g.fillStyle = 'rgba(150,156,170,0.55)'; for (let k = 0; k < 9; k++) g.fillRect(-h * 0.8 + ((k * 37) % 16) / 16 * h * 1.6, -h * 0.8 + ((k * 23) % 13) / 13 * h * 1.6, 1.6, 1.6);
  g.restore();
}
function croissant(g, U, x, y, k, a, a0) {            // croissant doré : sept bourrelets en arc, extrémités fines et plus cuites
  g.save(); g.translate(x, y); g.rotate(a); g.scale(k, k);
  ombre(g, a + (a0 || 0), 0.5, () => U.oval(g, 0, 4, 48, 22));
  for (let j = -3; j <= 3; j++) { const t = Math.abs(j); g.fillStyle = t === 3 ? '#b8661c' : j % 2 ? '#cf8228' : '#e4a246'; g.beginPath(); U.oval(g, j * 13, t * t * 2.4 - 5, 15 - t * 2.4, 21 - t * 3.8); g.fill(); }
  g.fillStyle = 'rgba(255,236,190,0.5)'; g.beginPath(); for (let j = -2; j <= 2; j++) { const t = Math.abs(j); U.oval(g, j * 13 - 3, t * t * 2.4 - 12 + t, 5 - t, 5 - t * 1.2); } g.fill();
  g.restore();
}
function cuillerette(g, U, x, y, a, L, a0) {          // petite cuillère posée : cuilleron ovale, manche fin évasé au bout
  g.save(); g.translate(x, y); g.rotate(a);
  ombre(g, a + (a0 || 0), 0.3, () => { U.oval(g, 0, 0, 13, 9); U.rr(g, 10, -2.5, L, 5, 2.5); U.oval(g, L + 8, 0, 6, 4); });
  g.fillStyle = '#b4bac4'; g.beginPath(); U.oval(g, 0, 0, 13, 9); U.rr(g, 10, -2.2, L, 4.4, 2.2); U.oval(g, L + 8, 0, 6, 4); g.fill();
  g.fillStyle = '#e3e7ec'; g.beginPath(); U.oval(g, -1, -1, 9.5, 6); g.fill();
  reflet(g, U, -4, -3, 4, 2, 0.9); g.fillStyle = 'rgba(255,255,255,0.6)'; g.fillRect(12, -1.6, L - 2, 1.3);
  g.restore();
}
function orangeFixe(g, U, x, y, r) {                  // orange posée : peau grenue, nombril, reflet
  ombre(g, 0, r / 40, () => g.arc(x, y, r, 0, TAU));
  g.fillStyle = bombe(g, x, y, r, '#ffc35a', '#d9670c'); g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
  g.fillStyle = 'rgba(170,70,0,0.3)'; g.beginPath();
  for (let k = 0; k < 16; k++) { const u = k * 2.4, d = r * (0.25 + (k % 4) * 0.18), px = x + Math.cos(u) * d, py = y + Math.sin(u) * d; g.moveTo(px + 1.3, py); g.arc(px, py, 1.3, 0, TAU); }
  g.fill(); disque(g, x + r * 0.2, y + r * 0.15, r * 0.09, '#8a6a20'); reflet(g, U, x - r * 0.35, y - r * 0.4, r * 0.25, r * 0.14, 0.4);
}
function rondelle(g, x, y, r, zeste, pulpe) {         // rondelle d'agrume vue de dessus : zeste, blanc, quartiers
  disque(g, x, y, r, zeste || '#f39a1e'); disque(g, x, y, r * 0.88, '#fff1d0');
  g.fillStyle = pulpe || '#ffb43a'; g.beginPath();
  for (let k = 0; k < 9; k++) { const u0 = k * TAU / 9 + 0.07, u1 = (k + 1) * TAU / 9 - 0.07; g.moveTo(x + Math.cos(u0) * r * 0.12, y + Math.sin(u0) * r * 0.12); g.arc(x, y, r * 0.8, u0, u1); g.closePath(); }
  g.fill();
}
function tranche(g, U, x, y, a) {                     // tranche de baguette : croûte dorée, mie alvéolée
  g.save(); g.translate(x, y); g.rotate(a);
  ombre(g, a, 0.4, () => U.oval(g, 0, 0, 30, 19));
  g.fillStyle = '#c47a2c'; g.beginPath(); U.oval(g, 0, 0, 30, 19); g.fill(); g.fillStyle = '#f5e2b8'; g.beginPath(); U.oval(g, 0, 0, 25, 15); g.fill();
  g.fillStyle = 'rgba(190,150,90,0.55)'; g.beginPath(); for (let k = 0; k < 9; k++) { const u = k * 2.3, d = 0.25 + (k % 3) * 0.25; U.oval(g, Math.cos(u) * 22 * d, Math.sin(u) * 12 * d, 2.2, 1.6); } g.fill();
  g.restore();
}
function petitpain(g, U, x, y, r) {                   // petit pain rond, entaille en croix, farine
  ombre(g, 0, 0.6, () => g.arc(x, y, r, 0, TAU));
  g.fillStyle = bombe(g, x, y, r, '#f2c070', '#a85f1c'); g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
  g.strokeStyle = '#f7dca0'; g.lineWidth = 4; g.lineCap = 'round'; g.beginPath(); g.moveTo(x - r * 0.55, y - r * 0.1); g.lineTo(x + r * 0.55, y + r * 0.1); g.moveTo(x - r * 0.1, y - r * 0.55); g.lineTo(x + r * 0.1, y + r * 0.55); g.stroke();
  g.fillStyle = 'rgba(255,255,255,0.4)'; for (let k = 0; k < 8; k++) g.fillRect(x - r * 0.6 + ((k * 29) % 11) / 11 * r * 1.2, y - r * 0.6 + ((k * 17) % 7) / 7 * r * 1.2, 2, 2);
}
function moulin(g, U, x, y, s, c0, c1) {              // salière / poivrière vue de dessus : corps de faïence, capuchon chromé percé
  ombre(g, 0, 1.1, () => g.arc(x, y, s, 0, TAU));
  g.fillStyle = bombe(g, x, y, s, c0, c1); g.beginPath(); g.arc(x, y, s, 0, TAU); g.fill();
  g.fillStyle = lin(g, x - s, y - s, x + s, y + s, '#f6f8fb', '#7c838d'); g.beginPath(); g.arc(x, y, s * 0.68, 0, TAU); g.fill();
  g.fillStyle = 'rgba(40,40,46,0.85)'; g.beginPath(); g.moveTo(x + 2, y); g.arc(x, y, 2, 0, TAU);
  for (let k = 0; k < 6; k++) { const u = k * TAU / 6, px = x + Math.cos(u) * s * 0.38, py = y + Math.sin(u) * s * 0.38; g.moveTo(px + 1.8, py); g.arc(px, py, 1.8, 0, TAU); }
  g.fill(); reflet(g, U, x - s * 0.3, y - s * 0.35, s * 0.2, s * 0.1, 0.7);
}

function fourchette(g, U, x, y) {                     // fourchette posée à la verticale, dents vers le haut
  ombre(g, 0, 0.35, () => { U.rr(g, x - 7, y - 24, 14, 134, 7); g.rect(x - 13, y - 112, 26, 88); });
  g.fillStyle = lin(g, x - 13, 0, x + 13, 0, '#eef1f5', '#8f96a0'); g.beginPath(); U.rr(g, x - 7, y - 24, 14, 134, 7); g.fill();
  g.beginPath(); g.moveTo(x - 6, y - 24); g.quadraticCurveTo(x - 14, y - 40, x - 13, y - 66); g.lineTo(x + 13, y - 66); g.quadraticCurveTo(x + 14, y - 40, x + 6, y - 24); g.closePath(); g.fill();
  for (let k = 0; k < 4; k++) g.fillRect(x - 13 + k * 7.3, y - 112, 4.4, 48);
  g.fillStyle = 'rgba(255,255,255,0.6)'; g.fillRect(x - 3, y - 18, 2, 120);
}
function couteauTable(g, U, x, y) {                   // couteau de table à la verticale : lame en haut, manche noir à rivets
  ombre(g, 0, 0.35, () => U.rr(g, x - 8, y - 112, 16, 222, 8));
  g.fillStyle = lin(g, x - 9, 0, x + 9, 0, '#f4f6f9', '#9aa0a9'); g.beginPath(); g.moveTo(x - 7, y - 10); g.lineTo(x - 7, y - 96); g.quadraticCurveTo(x - 6, y - 114, x + 8, y - 112); g.lineTo(x + 7, y - 10); g.closePath(); g.fill();
  g.fillStyle = lin(g, x - 9, 0, x + 9, 0, '#4b4f58', '#1d1f24'); g.beginPath(); U.rr(g, x - 8.5, y - 12, 17, 120, 8); g.fill();
  for (const t of [14, 50, 86]) disque(g, x, y + t, 2.4, '#d8dce2');
  g.fillStyle = 'rgba(255,255,255,0.7)'; g.fillRect(x - 4, y - 100, 1.8, 86);
}
function pain(g, s) {                                 // contour d'une tranche de pain de mie (s = demi-largeur) : haut bombé en deux lobes
  g.moveTo(-s, s); g.lineTo(-s, -s * 0.55); g.quadraticCurveTo(-s * 1.05, -s * 1.12, -s * 0.4, -s * 1.05); g.quadraticCurveTo(0, -s * 0.9, s * 0.4, -s * 1.05);
  g.quadraticCurveTo(s * 1.05, -s * 1.12, s, -s * 0.55); g.lineTo(s, s); g.quadraticCurveTo(s, s * 1.08, s * 0.85, s * 1.08); g.lineTo(-s * 0.85, s * 1.08); g.quadraticCurveTo(-s, s * 1.08, -s, s); g.closePath();
}
function tartine(g, U, R, x, y, a, garn, a0) {        // tranche de pain de mie et sa garniture (beurre, confiture, pâte à tartiner)
  g.save(); g.translate(x, y); g.rotate(a);
  ombre(g, a + a0, 0.3, () => pain(g, 40));
  g.fillStyle = '#c4843e'; g.beginPath(); pain(g, 40); g.fill(); g.fillStyle = '#f3dcae'; g.beginPath(); pain(g, 34); g.fill();
  if (garn === 'beurre') {
    g.fillStyle = 'rgba(250,232,150,0.95)'; g.beginPath(); U.rr(g, -26, -24, 52, 48, 12); g.fill();
    g.strokeStyle = 'rgba(220,186,80,0.8)'; g.lineWidth = 2; g.beginPath(); for (let k = -18; k <= 18; k += 9) { g.moveTo(-22, k); g.quadraticCurveTo(0, k + 5, 22, k); } g.stroke();
  } else if (garn === 'confiture') {
    U.blob(g, 0, 2, 25, 22, 0.4, R, 'rgba(196,30,50,0.92)'); reflet(g, U, -8, -7, 8, 4, 0.55);
    g.fillStyle = 'rgba(110,10,20,0.6)'; for (let k = 0; k < 7; k++) g.fillRect(-14 + ((k * 11) % 26), -10 + ((k * 7) % 22), 2, 2);
  } else {
    U.blob(g, 0, 2, 27, 24, 1.2, R, '#5a2e14'); g.strokeStyle = 'rgba(150,90,50,0.7)'; g.lineWidth = 2; g.beginPath(); g.arc(0, 2, 12, 0.3, 4.2); g.stroke(); reflet(g, U, -9, -8, 7, 3, 0.35);
  }
  g.restore();
}
function lunettes(g, U, x, y, a, a0) {                // lunettes de lecture : verres ronds, pont, branches repliées
  g.save(); g.translate(x, y); g.rotate(a);
  ombre(g, a + a0, 0.3, () => { g.arc(-30, 0, 25, 0, TAU); g.moveTo(55, 0); g.arc(30, 0, 25, 0, TAU); });
  g.fillStyle = 'rgba(200,228,255,0.35)'; g.beginPath(); g.arc(-30, 0, 24, 0, TAU); g.moveTo(54, 0); g.arc(30, 0, 24, 0, TAU); g.fill();
  g.strokeStyle = '#4a2c18'; g.lineWidth = 4.5; g.stroke();
  g.beginPath(); g.arc(0, 4, 9, Math.PI * 1.15, Math.PI * 1.85); g.stroke();
  g.lineWidth = 3.5; g.beginPath(); g.moveTo(-53, -6); g.lineTo(-12, -16); g.moveTo(53, -6); g.lineTo(12, -16); g.stroke();
  reflet(g, U, -38, -8, 7, 3.5, 0.6); reflet(g, U, 22, -8, 7, 3.5, 0.6);
  g.restore();
}

// ── décor posé sur la table (dessiné autour de l'origine ; d = [x, y, type]) ──
const DECOR = {
  set(g, d, R, U) {                                   // set de table tissé (sous l'assiette) : rayures rouille et sauge, trame, franges
    const a = -0.05, w = 196, h = 126; g.rotate(a);
    ombre(g, a, 0.25, () => g.rect(-w, -h, 2 * w, 2 * h));
    g.fillStyle = '#efe4cc'; g.fillRect(-w, -h, 2 * w, 2 * h);
    for (let k = 0, x = -w + 14; x < w - 8; x += 30, k++) { g.fillStyle = k % 3 === 1 ? 'rgba(122,150,96,0.55)' : 'rgba(196,98,52,0.5)'; g.fillRect(x, -h, k % 3 === 1 ? 6 : 12, 2 * h); }
    g.strokeStyle = 'rgba(120,90,50,0.13)'; g.lineWidth = 2; g.beginPath(); for (let y = -h + 4; y < h; y += 6) { g.moveTo(-w, y); g.lineTo(w, y); } g.stroke();
    g.strokeStyle = 'rgba(160,120,70,0.7)'; g.lineWidth = 1.5; g.beginPath(); for (let y = -h + 3; y < h; y += 7) { g.moveTo(-w, y); g.lineTo(-w - 10, y + 1); g.moveTo(w, y); g.lineTo(w + 10, y - 1); } g.stroke();
    g.setLineDash([6, 5]); g.strokeStyle = 'rgba(150,70,40,0.55)'; g.strokeRect(-w + 10, -h + 10, 2 * w - 20, 2 * h - 20); g.setLineDash([]);
  },
  assiette(g, d, R, U) {                              // œufs au plat et bacon ; fourchette à gauche, couteau à droite
    plat(g, U, 0, 0, 112, '#3d6cc8', 0);
    g.lineCap = 'round'; g.lineJoin = 'round';
    for (const b of [[-22, 46, 0.3], [24, 62, 0.12]]) {                // deux tranches de bacon ondulées
      g.save(); g.translate(b[0], b[1]); g.rotate(b[2]);
      g.beginPath(); for (let t = -50; t <= 50; t += 10) { const yy = Math.sin(t / 13) * 5; if (t === -50) g.moveTo(t, yy); else g.lineTo(t, yy); }
      g.strokeStyle = '#9c3a22'; g.lineWidth = 20; g.stroke(); g.strokeStyle = '#d0705a'; g.lineWidth = 11; g.stroke(); g.strokeStyle = '#f3c9b0'; g.lineWidth = 4; g.stroke();
      g.restore();
    }
    for (const e of [[-34, -24], [36, -6]]) {                           // œufs au plat
      U.blob(g, e[0], e[1], 40, 33, R() * 3, R, '#fdfcf7');
      g.fillStyle = 'rgba(200,190,170,0.35)'; g.beginPath(); U.oval(g, e[0] + 6, e[1] + 4, 20, 17); g.fill();
      g.fillStyle = bombe(g, e[0] + 3, e[1] - 2, 15, '#ffd94e', '#ef8d0c'); g.beginPath(); g.arc(e[0] + 3, e[1] - 2, 15, 0, TAU); g.fill();
      reflet(g, U, e[0] - 2, e[1] - 8, 5, 3, 0.8);
    }
    g.fillStyle = '#2f5a24'; for (let k = 0; k < 12; k++) g.fillRect(-60 + R() * 110, -50 + R() * 70, 2.5, 2.5);   // ciboulette
    fourchette(g, U, -160, 0); couteauTable(g, U, 160, 0);
  },
  dessous(g, d, R, U) {                               // dessous-de-plat rond en rotin tressé (sous la théière)
    ombre(g, 0, 0.3, () => g.arc(0, 0, 172, 0, TAU));
    disque(g, 0, 0, 172, '#b88444');
    for (let k = 0, q = 160; q > 16; q -= 19, k++) { cercle(g, 0, 0, q, 14, '#a8742f'); g.setLineDash([9, 7]); g.lineDashOffset = k % 2 ? 8 : 0; cercle(g, 0, 0, q, 12, '#dcae68'); g.setLineDash([]); }
    g.lineDashOffset = 0; cercle(g, 0, 0, 170, 4, '#7e5020');
  },
  theiere(g, d, R, U) {                               // théière de faïence à bouquets bleus : bec, anse, couvercle à bouton, étiquette du sachet de thé
    const a = -0.4; g.rotate(a);
    ombre(g, a, 1.7, () => { g.arc(0, 0, 86, 0, TAU); g.moveTo(-66, -24); g.lineTo(-166, -10); g.lineTo(-166, 10); g.lineTo(-66, 26); g.closePath(); U.rr(g, 70, -34, 66, 68, 30); });
    g.lineCap = 'round';
    g.strokeStyle = '#c9ced8'; g.lineWidth = 20; g.beginPath(); g.arc(96, 0, 32, -1.25, 1.25); g.stroke(); g.strokeStyle = '#f7f6f2'; g.lineWidth = 13; g.stroke();   // anse
    g.fillStyle = lin(g, 0, -24, 0, 24, '#ffffff', '#c3cad6'); g.beginPath(); g.moveTo(-66, -24); g.quadraticCurveTo(-120, -20, -162, -9); g.quadraticCurveTo(-172, 0, -162, 9); g.quadraticCurveTo(-120, 20, -66, 26); g.closePath(); g.fill();   // bec
    disque(g, -163, 0, 5, '#6a4a2a');
    g.fillStyle = bombe(g, 0, 0, 86, '#ffffff', '#c6cdd9'); g.beginPath(); g.arc(0, 0, 86, 0, TAU); g.fill();
    for (let k = 0; k < 8; k++) {                                       // bouquets bleus
      const u = k * TAU / 8 + 0.2; g.save(); g.translate(Math.cos(u) * 66, Math.sin(u) * 66); g.rotate(u);
      g.fillStyle = '#5b9a4c'; g.beginPath(); U.oval(g, 0, -10, 3, 7); U.oval(g, 0, 10, 3, 7); g.fill();
      g.fillStyle = '#3d6cc8'; g.beginPath(); for (let p = 0; p < 5; p++) { const v = p * TAU / 5, px = Math.cos(v) * 5, py = Math.sin(v) * 5; g.moveTo(px + 4, py); g.arc(px, py, 4, 0, TAU); } g.fill();
      disque(g, 0, 0, 2.5, '#f2c230'); g.restore();
    }
    cercle(g, 0, 0, 50, 3, '#3d6cc8');
    g.fillStyle = bombe(g, 0, 0, 46, '#ffffff', '#d4dae4'); g.beginPath(); g.arc(0, 0, 46, 0, TAU); g.fill();   // couvercle
    cercle(g, 0, 0, 30, 1.5, 'rgba(120,130,150,0.35)');
    disque(g, 3, 4, 15, 'rgba(0,0,0,0.18)'); g.fillStyle = bombe(g, 0, 0, 15, '#ffffff', '#9fb0d6'); g.beginPath(); g.arc(0, 0, 15, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 7; g.beginPath(); g.arc(0, 0, 76, 3.4, 4.5); g.stroke();
    g.strokeStyle = '#e8e2d2'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(30, -36); g.quadraticCurveTo(70, -80, 64, -128); g.stroke();   // ficelle du sachet
    g.save(); g.translate(64, -136); g.rotate(0.3); g.fillStyle = 'rgba(52,26,8,0.2)'; g.fillRect(-12, -6, 28, 22);
    g.fillStyle = '#f6eed6'; g.fillRect(-15, -10, 28, 22); g.fillStyle = '#c0392b'; g.fillRect(-15, -10, 28, 7); g.restore();
  },
  tasse(g, d, R, U) {                                 // tasse et sous-tasse : café crème (cœur dans la mousse), ou thé citron près de la théière
    const the = d[0] > 3000, a = the ? 0.6 : -0.35, col = the ? '#3d6cc8' : '#c0392b'; g.rotate(a);
    plat(g, U, 0, 0, 82, col, a);
    cuillerette(g, U, 34, 54, -0.55, 40, a);
    if (!the) sucre(g, U, -52, 42, 10, 0.4, a);
    ombre(g, a, 0.8, () => { g.arc(0, 0, 50, 0, TAU); U.rr(g, 40, -10, 36, 20, 10); });
    g.fillStyle = '#f2f3f6'; g.beginPath(); U.rr(g, 42, -10, 34, 20, 10); g.fill(); g.strokeStyle = 'rgba(120,130,150,0.4)'; g.lineWidth = 1.5; g.stroke();
    g.fillStyle = bombe(g, 0, 0, 50, '#ffffff', '#cdd3dd'); g.beginPath(); g.arc(0, 0, 50, 0, TAU); g.fill();
    cercle(g, 0, 0, 47, 2, col);
    g.fillStyle = the ? bombe(g, 0, 0, 41, '#e3a24a', '#93500f') : bombe(g, 0, 0, 41, '#d8b088', '#7a4622'); g.beginPath(); g.arc(0, 0, 41, 0, TAU); g.fill();
    if (the) rondelle(g, -8, 6, 15, '#e8d23a', '#f7ec8a');
    else { g.fillStyle = 'rgba(255,248,236,0.92)'; g.beginPath(); g.moveTo(0, 16); g.bezierCurveTo(-28, 0, -15, -24, 0, -10); g.bezierCurveTo(15, -24, 28, 0, 0, 16); g.fill(); }
    reflet(g, U, -16, -18, 12, 6, 0.4);
  },
  journal(g, d, R, U) {                               // journal du matin plié : titre, gros titre, photo (une petite voiture !), colonnes ; lunettes posées dessus
    const a = 0.16, w = 168, h = 112; g.rotate(a);
    ombre(g, a, 0.35, () => g.rect(-w, -h, 2 * w, 2 * h));
    g.fillStyle = '#e2dccd'; g.fillRect(-w + 5, -h + 4, 2 * w, 2 * h);
    g.fillStyle = '#f4f0e5'; g.fillRect(-w, -h, 2 * w, 2 * h);
    g.fillStyle = lin(g, -w, 0, -w + 24, 0, 'rgba(0,0,0,0.12)', 'rgba(0,0,0,0)'); g.fillRect(-w, -h, 24, 2 * h);   // pli
    g.fillStyle = '#1e1e1e'; g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.font = 'bold 34px serif'; g.fillText('LE MATIN', 0, -h + 40);
    g.fillRect(-w + 14, -h + 48, 2 * w - 28, 3); g.fillRect(-w + 14, -h + 54, 2 * w - 28, 1);
    g.font = 'bold 15px sans-serif'; g.fillText('LA COURSE DU PETIT-DÉJEUNER', 0, -h + 74);
    g.fillStyle = lin(g, 0, -28, 0, 64, '#bdb9af', '#7d7a72'); g.fillRect(-w + 14, -28, 140, 92);      // photo : une petite voiture de course
    g.fillStyle = '#3c3a36'; g.beginPath(); U.rr(g, -w + 42, 8, 84, 26, 10); g.fill(); g.fillRect(-w + 70, 0, 30, 10);
    disque(g, -w + 58, 36, 9, '#1e1e1e'); disque(g, -w + 110, 36, 9, '#1e1e1e');
    g.fillStyle = 'rgba(60,58,54,0.5)';
    for (const cx of [-2, 84]) for (let k = 0; k < 14; k++) g.fillRect(cx, -28 + k * 9, k % 5 === 4 ? 40 : 74 - ((k * 13) % 9), 3.4);
    for (let k = 0; k < 4; k++) g.fillRect(-w + 14, 74 + k * 8, k === 3 ? 70 : 140, 3.4);
    lunettes(g, U, 78, 62, -0.5, a);
  },
  vase(g, d, R, U) {                                  // vase de verre et bouquet (tulipes, marguerites, pivoine) vu de dessus ; un pétale tombé
    const F = [[-0.3, 70, 0], [0.9, 66, 1], [2.1, 72, 0], [3.0, 60, 1], [4.0, 74, 0], [5.1, 64, 1], [0, 0, 2]];   // [angle, distance, sorte]
    ombre(g, 0, 2, () => g.arc(0, 0, 40, 0, TAU));
    g.strokeStyle = '#4f8a3a'; g.lineWidth = 4; g.lineCap = 'round'; g.beginPath(); for (const f of F) { g.moveTo(0, 0); g.lineTo(Math.cos(f[0]) * f[1] * 0.8, Math.sin(f[0]) * f[1] * 0.8); } g.stroke();
    for (let k = 0; k < 6; k++) { g.save(); g.rotate(k * 1.05 + 0.5); g.fillStyle = k % 2 ? '#3f7d34' : '#5a9e44'; g.beginPath(); U.oval(g, 62, 0, 40, 11); g.fill(); g.strokeStyle = 'rgba(30,70,20,0.5)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(26, 0); g.lineTo(98, 0); g.stroke(); g.restore(); }
    g.fillStyle = 'rgba(200,232,240,0.5)'; g.beginPath(); g.arc(0, 0, 40, 0, TAU); g.fill(); cercle(g, 0, 0, 39, 3, 'rgba(130,180,200,0.85)');
    disque(g, 0, 0, 30, 'rgba(140,200,215,0.35)');
    for (const f of F) {
      const x = Math.cos(f[0]) * f[1], y = Math.sin(f[0]) * f[1];
      if (f[2] === 1) {                                                 // marguerite
        g.fillStyle = '#ffffff'; g.beginPath(); for (let p = 0; p < 12; p++) { const v = p * TAU / 12, px = x + Math.cos(v) * 13, py = y + Math.sin(v) * 13; g.moveTo(px + 6.5, py); g.arc(px, py, 6.5, 0, TAU); } g.fill();
        g.strokeStyle = 'rgba(170,170,185,0.5)'; g.lineWidth = 1; g.stroke(); disque(g, x, y, 9, '#f4c21c'); disque(g, x + 1.5, y + 1.5, 5, '#d89a10');
      } else {                                                          // tulipe en coupe (trois pétales), ou pivoine au centre
        const col = f[2] === 2 ? '#f08cb0' : ['#d8263a', '#ee6fa0', '#f6c52b'][Math.abs(Math.round(f[0] * 10)) % 3], rr = f[2] === 2 ? 24 : 19;
        disque(g, x + 2, y + 3, rr, 'rgba(60,20,20,0.25)');
        g.fillStyle = col; g.beginPath(); for (let p = 0; p < 3; p++) { const v = p * TAU / 3 + f[0], px = x + Math.cos(v) * rr * 0.38, py = y + Math.sin(v) * rr * 0.38; g.moveTo(px + rr * 0.66, py); g.arc(px, py, rr * 0.66, 0, TAU); } g.fill();
        g.fillStyle = 'rgba(255,255,255,0.3)'; g.beginPath(); g.arc(x - rr * 0.25, y - rr * 0.3, rr * 0.3, 0, TAU); g.fill(); disque(g, x, y, rr * 0.22, 'rgba(90,20,30,0.45)');
      }
    }
    g.save(); g.translate(64, 88); g.rotate(0.6); g.fillStyle = '#ee6fa0'; g.beginPath(); U.oval(g, 0, 0, 11, 7); g.fill(); g.restore();
  },
  confitures(g, d, R, U) {                            // trois pots de confiture (fraise, abricot, myrtille) coiffés de vichy ; le dernier ouvert, cuillère dedans
    const J = [[-58, -34, '#c0392b'], [60, -44, '#e67e22'], [4, 58, '#6c3483']];
    for (let k = 0; k < 3; k++) {
      const x = J[k][0], y = J[k][1], col = J[k][2];
      ombre(g, 0, 1.4, () => g.arc(x, y, 50, 0, TAU));
      g.fillStyle = 'rgba(210,232,238,0.75)'; g.beginPath(); g.arc(x, y, 50, 0, TAU); g.fill(); cercle(g, x, y, 48.5, 3, 'rgba(140,180,195,0.9)');
      if (k === 2) {
        g.fillStyle = bombe(g, x, y, 42, '#b46ad0', '#4a1f62'); g.beginPath(); g.arc(x, y, 42, 0, TAU); g.fill();
        g.fillStyle = 'rgba(40,10,50,0.5)'; for (let p = 0; p < 9; p++) { g.beginPath(); g.arc(x - 26 + ((p * 19) % 50), y - 22 + ((p * 13) % 44), 4, 0, TAU); g.fill(); }
        reflet(g, U, x - 14, y - 16, 12, 6, 0.5);
        cuillerette(g, U, x + 4, y + 2, -0.9, 66, 0);
      } else {                                                          // couvercle de tissu festonné à carreaux, ficelle de raphia
        g.save(); g.beginPath(); g.arc(x, y, 46, 0, TAU); for (let p = 0; p < 16; p++) { const v = p * TAU / 16, px = x + Math.cos(v) * 47, py = y + Math.sin(v) * 47; g.moveTo(px + 8, py); g.arc(px, py, 8, 0, TAU); }
        g.fillStyle = '#fbf7ef'; g.fill(); g.clip();
        g.fillStyle = col; g.globalAlpha = 0.55; for (let t = -60; t < 60; t += 16) { g.fillRect(x + t, y - 60, 8, 120); g.fillRect(x - 60, y + t, 120, 8); } g.globalAlpha = 1;
        g.restore();
        cercle(g, x, y, 34, 4, '#e8d3a0'); g.fillStyle = '#e8d3a0'; g.beginPath(); U.oval(g, x + 30, y - 18, 9, 5); U.oval(g, x + 30, y - 2, 9, 5); g.fill();
        reflet(g, U, x - 16, y - 18, 14, 7, 0.35);
      }
    }
    ombre(g, 0, 0.4, () => g.arc(-84, 84, 36, 0, TAU));                // couvercle doré posé à côté du pot ouvert
    g.fillStyle = bombe(g, -84, 84, 36, '#f6e3a6', '#a8802e'); g.beginPath(); g.arc(-84, 84, 36, 0, TAU); g.fill(); cercle(g, -84, 84, 28, 2, 'rgba(120,90,30,0.5)');
  },
  fruits(g, d, R, U) {                                // coupe de fruits turquoise : banane, raisin, oranges (une s'est échappée…), pomme
    ombre(g, 0, 1.8, () => g.arc(0, 0, 124, 0, TAU));
    g.fillStyle = bombe(g, 0, 0, 124, '#9fd6e6', '#2c7d99'); g.beginPath(); g.arc(0, 0, 124, 0, TAU); g.fill(); cercle(g, 0, 0, 116, 3, 'rgba(255,255,255,0.5)');
    g.fillStyle = lin(g, -100, -100, 100, 100, '#d9d1bd', '#fbf8f1'); g.beginPath(); g.arc(0, 0, 104, 0, TAU); g.fill();
    g.save(); g.lineCap = 'round'; g.strokeStyle = '#c9a222'; g.lineWidth = 30; g.beginPath(); g.arc(-10, -30, 80, 0.7, 2.3); g.stroke();   // banane
    g.strokeStyle = '#f6d84a'; g.lineWidth = 22; g.stroke(); g.strokeStyle = 'rgba(160,120,20,0.5)'; g.lineWidth = 2; g.stroke(); g.restore();
    disque(g, -10 + Math.cos(0.7) * 80, -30 + Math.sin(0.7) * 80, 6, '#5a3a14'); disque(g, -10 + Math.cos(2.3) * 80, -30 + Math.sin(2.3) * 80, 5, '#3a2a10');
    for (let k = 0; k < 13; k++) { const x = -52 + ((k * 17) % 40) - 20, y = -40 + ((k * 23) % 44) - 22; g.fillStyle = bombe(g, x, y, 11, '#b07ad8', '#4a1f6a'); g.beginPath(); g.arc(x, y, 11, 0, TAU); g.fill(); }   // raisin
    orangeFixe(g, U, 34, -50, 36); orangeFixe(g, U, -8, -2, 34);
    ombre(g, 0, 0.8, () => g.arc(52, 30, 32, 0, TAU));                  // pomme
    g.fillStyle = bombe(g, 52, 30, 32, '#ff7a64', '#a81c1c'); g.beginPath(); g.arc(52, 30, 32, 0, TAU); g.fill();
    g.strokeStyle = '#5a3a14'; g.lineWidth = 3; g.beginPath(); g.moveTo(52, 30); g.lineTo(60, 20); g.stroke(); g.fillStyle = '#4f9a2e'; g.beginPath(); U.oval(g, 68, 18, 9, 4.5); g.fill();
    reflet(g, U, 40, 18, 9, 5, 0.45);
    g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 5; g.beginPath(); g.arc(0, 0, 120, 3.5, 4.4); g.stroke();
  },
  chocolat(g, d, R, U) {                              // bol à oreilles de chocolat chaud : pois rouges, peau de lait, guimauves ; sa cuillère à côté
    const a = 0.3; g.rotate(a);
    ombre(g, a, 1.3, () => { g.arc(0, 0, 76, 0, TAU); U.rr(g, -104, -18, 208, 36, 14); });
    g.fillStyle = '#e9eef6'; g.beginPath(); U.rr(g, -104, -18, 208, 36, 14); g.fill(); g.strokeStyle = 'rgba(120,135,160,0.45)'; g.lineWidth = 1.5; g.stroke();
    g.fillStyle = bombe(g, 0, 0, 76, '#ffffff', '#c7d0de'); g.beginPath(); g.arc(0, 0, 76, 0, TAU); g.fill();
    g.fillStyle = '#e8322a'; g.beginPath(); for (let k = 0; k < 16; k++) { const u = k * TAU / 16, px = Math.cos(u) * 69, py = Math.sin(u) * 69; g.moveTo(px + 4, py); g.arc(px, py, 4, 0, TAU); } g.fill();
    g.fillStyle = bombe(g, 0, 0, 60, '#9a5a30', '#4a2412'); g.beginPath(); g.arc(0, 0, 60, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(230,200,170,0.5)'; g.lineWidth = 2; g.beginPath(); g.moveTo(-30, -10); g.bezierCurveTo(-10, -22, 10, 2, 30, -12); g.moveTo(-24, 14); g.bezierCurveTo(-4, 4, 12, 24, 28, 10); g.stroke();   // peau de lait
    for (const q of [[-14, -24, 0.3, '#ffe0ea'], [18, -4, -0.4, '#ffffff'], [-4, 22, 0.9, '#ffc8da']]) { g.save(); g.translate(q[0], q[1]); g.rotate(q[2]); g.fillStyle = q[3]; g.beginPath(); U.rr(g, -9, -9, 18, 18, 5); g.fill(); g.strokeStyle = 'rgba(200,150,160,0.6)'; g.lineWidth = 1; g.stroke(); g.restore(); }
    reflet(g, U, -24, -32, 14, 6, 0.3);
    cuillerette(g, U, 40, 100, -0.3, 40, a);
  },
  serviette(g, d, R, U) {                             // serviette de lin roulée dans son rond de serviette en bois
    const a = -0.5; g.rotate(a);
    ombre(g, a, 0.6, () => U.rr(g, -84, -24, 168, 48, 22));
    g.fillStyle = lin(g, 0, -24, 0, 24, '#f7f3ea', '#cfc6b2'); g.beginPath(); U.rr(g, -84, -24, 168, 48, 22); g.fill();
    g.fillStyle = 'rgba(61,108,200,0.5)'; g.fillRect(-62, -24, 6, 48); g.fillRect(56, -24, 6, 48);
    g.strokeStyle = 'rgba(140,120,90,0.35)'; g.lineWidth = 1.5; g.beginPath(); for (const x of [-44, -30, 30, 44]) { g.moveTo(x, -22); g.quadraticCurveTo(x + 6, 0, x, 22); } g.stroke();
    g.fillStyle = lin(g, -16, 0, 16, 0, '#c58a4a', '#7a4a1e'); g.beginPath(); U.rr(g, -16, -30, 32, 60, 8); g.fill();
    g.strokeStyle = 'rgba(255,230,190,0.4)'; g.lineWidth = 2; g.beginPath(); g.moveTo(-9, -27); g.lineTo(-9, 27); g.stroke();
  },
  oeuf(g, d, R, U) {                                  // boîte de six œufs ouverte, couvercle rabattu (étiquette), coquille cassée à côté
    const a = 0.12; g.rotate(a);
    ombre(g, a, 0.6, () => { U.rr(g, -105, -4, 210, 116, 12); U.rr(g, -105, -122, 210, 112, 12); });
    g.fillStyle = '#cdbf9f'; g.beginPath(); U.rr(g, -105, -122, 210, 112, 12); g.fill();   // couvercle rabattu : bosses en creux, étiquette
    g.fillStyle = 'rgba(120,100,70,0.18)'; g.beginPath(); for (const x of [-64, 0, 64]) for (const y of [-94, -38]) { g.moveTo(x + 24, y); g.arc(x, y, 24, 0, TAU); } g.fill();
    g.fillStyle = '#f4ecd8'; g.beginPath(); U.rr(g, -68, -88, 136, 42, 6); g.fill();
    g.fillStyle = '#3d6b2e'; g.font = 'bold 17px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('ŒUFS FRAIS', 0, -66);
    g.fillStyle = 'rgba(90,70,40,0.3)'; g.fillRect(-105, -10, 210, 6);   // charnière
    g.fillStyle = '#d6c9aa'; g.beginPath(); U.rr(g, -105, -4, 210, 116, 12); g.fill();
    for (let k = 0; k < 6; k++) {
      const x = -64 + (k % 3) * 64, y = k < 3 ? 26 : 82;
      disque(g, x, y, 27, '#b7a785'); cercle(g, x, y, 27, 2, 'rgba(90,70,40,0.25)');
      if (k === 1 || k === 5) continue;                                 // deux alvéoles vides
      ombre(g, a, 0.4, () => U.oval(g, x, y, 23, 19));
      g.fillStyle = k % 2 === 0 ? bombe(g, x, y, 24, '#f3d2a6', '#b97e48') : bombe(g, x, y, 24, '#ffffff', '#d9d4c8'); g.beginPath(); U.oval(g, x, y, 23, 19); g.fill();
      reflet(g, U, x - 7, y - 7, 6, 3.5, 0.55);
    }
    for (const c of [[150, 40, 0.4], [160, 84, 2.6]]) {                 // coquille cassée
      g.save(); g.translate(c[0], c[1]); g.rotate(c[2]);
      const coque = q => { g.moveTo(-q, 0); for (let k = 1; k <= 8; k++) g.lineTo(-q + k * q / 4, k % 2 ? -4 : 0); g.arc(0, 0, q, 0, Math.PI); g.closePath(); };
      ombre(g, a + c[2], 0.25, () => coque(20));
      g.fillStyle = '#efd2ac'; g.beginPath(); coque(20); g.fill(); g.fillStyle = '#fff8ec'; g.beginPath(); coque(15); g.fill();
      g.restore();
    }
  },
  yaourt(g, d, R, U) {                                // deux pots de yaourt en verre : l'un operculé (alu, fraise), l'autre entamé (coulis) ; opercule et cuillère
    for (let k = 0; k < 2; k++) {
      const x = k ? 46 : -44, y = k ? 22 : -26;
      ombre(g, 0, 1.2, () => g.arc(x, y, 42, 0, TAU));
      g.fillStyle = 'rgba(212,234,240,0.8)'; g.beginPath(); g.arc(x, y, 42, 0, TAU); g.fill(); cercle(g, x, y, 41, 3, 'rgba(140,180,195,0.9)');
      if (!k) {
        g.fillStyle = lin(g, x - 40, y - 40, x + 40, y + 40, '#f7f9fc', '#a3abb6'); g.beginPath(); g.arc(x, y, 39, 0, TAU); g.fill();
        g.strokeStyle = 'rgba(120,128,140,0.4)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x - 30, y - 8); g.lineTo(x - 6, y + 4); g.lineTo(x + 26, y - 14); g.moveTo(x - 20, y + 22); g.lineTo(x + 18, y + 16); g.stroke();
        g.fillStyle = '#e04a64'; g.beginPath(); g.moveTo(x, y + 18); g.quadraticCurveTo(x - 17, y, x - 9, y - 9); g.quadraticCurveTo(x, y - 13, x + 9, y - 9); g.quadraticCurveTo(x + 17, y, x, y + 18); g.fill();   // fraise imprimée
        g.fillStyle = '#4f9a2e'; g.beginPath(); U.oval(g, x - 5, y - 11, 6, 3); U.oval(g, x + 5, y - 11, 6, 3); g.fill();
        g.fillStyle = '#ffe9a0'; for (let p = 0; p < 6; p++) g.fillRect(x - 6 + ((p * 7) % 12), y - 4 + ((p * 5) % 14), 1.8, 1.8);
        g.fillStyle = '#c3c9d2'; g.beginPath(); U.rr(g, x + 26, y - 40, 20, 14, 5); g.fill();   // languette
      } else {
        disque(g, x, y, 37, '#fbfaf5'); U.blob(g, x - 4, y - 2, 18, 13, 0.4, R, 'rgba(222,60,90,0.85)'); reflet(g, U, x - 14, y - 16, 10, 5, 0.6);
      }
    }
    g.save(); g.translate(58, -54); g.rotate(0.6); ombre(g, 0.6, 0.3, () => U.oval(g, 0, 0, 30, 18));   // opercule arraché, froissé
    g.fillStyle = lin(g, -30, -18, 30, 18, '#f4f6f9', '#9aa2ad'); g.beginPath(); U.oval(g, 0, 0, 30, 18); g.fill();
    g.strokeStyle = 'rgba(100,110,125,0.5)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(-20, -4); g.lineTo(12, 6); g.moveTo(-10, 8); g.lineTo(18, -6); g.stroke(); g.restore();
    cuillerette(g, U, -34, 62, 0.25, 46, 0);
  },
  cereales(g, d, R, U) {                              // boîte de céréales couchée : soleil, « CROUSTI », bol illustré ; une coulée d'anneaux s'échappe du rabat
    const a = 0.14, w = 186, h = 122; g.rotate(a);
    ombre(g, a, 0.8, () => g.rect(-w, -h, 2 * w + 34, 2 * h));
    g.fillStyle = lin(g, 0, -h, 0, h, '#ff6a3a', '#d42a1a'); g.fillRect(-w, -h, 2 * w, 2 * h);
    g.fillStyle = '#ffd23a'; g.fillRect(-w, h - 30, 2 * w, 30); g.strokeStyle = 'rgba(120,20,10,0.55)'; g.lineWidth = 3; g.strokeRect(-w, -h, 2 * w, 2 * h);
    g.strokeStyle = '#ffd23a'; g.lineWidth = 6; g.lineCap = 'round'; g.beginPath(); for (let k = 0; k < 12; k++) { const u = k * TAU / 12; g.moveTo(118 + Math.cos(u) * 44, -56 + Math.sin(u) * 44); g.lineTo(118 + Math.cos(u) * 58, -56 + Math.sin(u) * 58); } g.stroke();
    disque(g, 118, -56, 36, '#ffd23a'); g.strokeStyle = '#d4501a'; g.lineWidth = 4; g.beginPath(); g.arc(118, -52, 16, 0.4, Math.PI - 0.4); g.stroke();
    disque(g, 106, -64, 4, '#d4501a'); disque(g, 130, -64, 4, '#d4501a');
    g.font = 'bold 44px sans-serif'; g.textAlign = 'left'; g.textBaseline = 'alphabetic'; g.lineJoin = 'round'; g.strokeStyle = '#7a1208'; g.lineWidth = 8;
    g.strokeText('CROUSTI', -w + 18, -50); g.fillStyle = '#fff6d8'; g.fillText('CROUSTI', -w + 18, -50);
    g.font = 'bold 17px sans-serif'; g.fillStyle = '#ffd23a'; g.fillText('ANNEAUX DORÉS AU MIEL', -w + 20, -22);
    g.fillStyle = '#2f7ff0'; g.beginPath(); g.moveTo(-150, 30); g.quadraticCurveTo(-70, 124, 10, 30); g.closePath(); g.fill();   // bol illustré
    g.fillStyle = '#ffffff'; g.beginPath(); U.oval(g, -70, 30, 80, 13); g.fill();
    anneaux(g, [[-118, 24, '#f5a623'], [-92, 20, '#f7d038'], [-66, 27, '#f5a623'], [-40, 21, '#e8452c'], [-104, 34, '#f7d038'], [-20, 30, '#f5a623'], [-78, 12, '#e8452c']], 10);
    disque(g, 112, 40, 30, '#ffffff'); g.fillStyle = '#d42a1a'; g.font = 'bold 11px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('NOUVEAU', 112, 41);
    g.fillStyle = '#e4502e'; g.beginPath(); g.moveTo(w, -h + 10); g.lineTo(w + 34, -h + 30); g.lineTo(w + 34, h - 30); g.lineTo(w, h - 10); g.closePath(); g.fill();   // rabat ouvert
    g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(w, -h + 10, 5, 2 * h - 20);
    const P = []; for (let k = 0; k < 24; k++) { const t = R(); P.push([w + 30 + t * 62 + R() * 14, (R() - 0.5) * (70 + t * 60), k % 3 ? ANNEAUX[1] : ANNEAUX[2]]); }
    anneaux(g, P, 9);
  },
  pamplemousse(g, d, R, U) {                          // demi-pamplemousse rose sur sa soucoupe, sucre en poudre, cuillère
    plat(g, U, 0, 0, 86, '#5a9e44', 0);
    ombre(g, 0, 0.8, () => g.arc(-6, -4, 54, 0, TAU));
    g.fillStyle = bombe(g, -6, -4, 54, '#ffe27a', '#e0a020'); g.beginPath(); g.arc(-6, -4, 54, 0, TAU); g.fill();
    disque(g, -6, -4, 48, '#fff1d8');
    g.fillStyle = bombe(g, -6, -4, 45, '#ff8a7a', '#d8343a'); g.beginPath(); g.arc(-6, -4, 45, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(255,240,230,0.85)'; g.lineWidth = 2.2; g.beginPath(); for (let k = 0; k < 12; k++) { const u = k * TAU / 12; g.moveTo(-6 + Math.cos(u) * 7, -4 + Math.sin(u) * 7); g.lineTo(-6 + Math.cos(u) * 44, -4 + Math.sin(u) * 44); } g.stroke();
    disque(g, -6, -4, 7, '#fff1d8');
    g.fillStyle = 'rgba(255,255,255,0.9)'; for (let k = 0; k < 26; k++) { const u = R() * TAU, dd = Math.sqrt(R()) * 40; g.fillRect(-6 + Math.cos(u) * dd, -4 + Math.sin(u) * dd, 2, 2); }
    reflet(g, U, -22, -20, 10, 5, 0.5);
    cuillerette(g, U, 44, 44, 0.8, 30, 0);
  },
  baguette(g, d, R, U) {                              // baguette entamée : croûte dorée, grignes, bout cassé (mie), farine et miettes
    const a = -0.18, L = 205, h = 33; g.rotate(a);
    ombre(g, a, 1, () => U.rr(g, -L, -h, 2 * L, 2 * h, h));
    g.fillStyle = lin(g, 0, -h, 0, h, '#f2bf68', '#a6601c'); g.beginPath(); U.rr(g, -L, -h, 2 * L, 2 * h, h); g.fill();
    for (let k = 0; k < 6; k++) {
      g.save(); g.translate(-150 + k * 58, -2); g.rotate(-0.5); g.fillStyle = '#f8dc9e'; g.beginPath(); U.oval(g, 0, 0, 27, 8); g.fill();
      g.strokeStyle = 'rgba(130,70,20,0.5)'; g.lineWidth = 2; g.beginPath(); g.moveTo(-24, 5); g.quadraticCurveTo(0, 12, 24, 3); g.stroke(); g.restore();
    }
    g.fillStyle = 'rgba(255,255,255,0.4)'; for (let k = 0; k < 40; k++) g.fillRect(-L + 20 + R() * (2 * L - 40), -h * 0.7 + R() * h * 0.8, 2, 2);   // farine
    g.fillStyle = '#f7e9c8'; g.beginPath(); U.oval(g, L - 8, 0, 12, h * 0.86); g.fill();
    g.fillStyle = 'rgba(200,160,100,0.6)'; for (let k = 0; k < 8; k++) g.fillRect(L - 14 + ((k * 7) % 12), -h * 0.6 + ((k * 11) % 36), 2.4, 2);
    g.fillStyle = '#d9a85a'; g.beginPath(); for (let k = 0; k < 14; k++) U.oval(g, L + 8 + R() * 46, (R() - 0.5) * 70, 2 + R() * 3, 1.5 + R() * 2); g.fill();   // miettes
  },
  tartines(g, d, R, U) {                              // planche à découper : tartines confiture, beurre, pâte à tartiner ; couteau et miettes
    const a = 0.07; g.rotate(a);
    ombre(g, a, 0.5, () => { U.rr(g, -150, -80, 300, 160, 20); U.rr(g, 138, -22, 52, 44, 18); });
    g.fillStyle = lin(g, -150, -80, 150, 80, '#dcaa64', '#ad7634'); g.beginPath(); U.rr(g, -150, -80, 300, 160, 20); U.rr(g, 138, -22, 52, 44, 18); g.fill();
    disque(g, 170, 0, 8, 'rgba(70,40,15,0.55)');
    g.strokeStyle = 'rgba(110,60,20,0.22)'; g.lineWidth = 1.5; g.beginPath(); for (let k = 0; k < 8; k++) { const y = -68 + k * 19; g.moveTo(-144, y); g.bezierCurveTo(-60, y + 6, 40, y - 6, 144, y + 3); } g.stroke();
    g.strokeStyle = 'rgba(255,240,210,0.35)'; g.lineWidth = 1; g.beginPath(); for (let k = 0; k < 6; k++) { const x = -120 + R() * 240, y = -60 + R() * 120; g.moveTo(x, y); g.lineTo(x + 20 + R() * 20, y + (R() - 0.5) * 8); } g.stroke();
    tartine(g, U, R, -92, -6, 0.22, 'confiture', a); tartine(g, U, R, 0, 10, -0.12, 'beurre', a); tartine(g, U, R, 90, -10, 0.14, 'choco', a);
    g.fillStyle = '#c9ced6'; g.beginPath(); U.rr(g, -70, 58, 96, 9, 4.5); g.fill(); g.fillStyle = '#8a5428'; g.beginPath(); U.rr(g, 22, 56, 70, 13, 6.5); g.fill();   // couteau à tartiner
    g.fillStyle = '#c98a44'; g.beginPath(); for (let k = 0; k < 18; k++) U.oval(g, -140 + R() * 280, -74 + R() * 148, 1.5 + R() * 2.5, 1.2 + R() * 1.6); g.fill();   // miettes
  },
  croissants(g, d, R, U) {                            // assiette de viennoiseries : deux croissants et un pain au chocolat
    plat(g, U, 0, 0, 116, '#d4a017', 0);
    g.save(); g.translate(22, 44); g.rotate(-0.25);
    ombre(g, -0.25, 0.5, () => U.rr(g, -42, -26, 84, 52, 16));
    g.fillStyle = lin(g, 0, -26, 0, 26, '#eab35a', '#b8701e'); g.beginPath(); U.rr(g, -42, -26, 84, 52, 16); g.fill();
    g.strokeStyle = 'rgba(140,80,20,0.5)'; g.lineWidth = 2; g.beginPath(); for (const y of [-10, 4, 16]) { g.moveTo(-36, y); g.quadraticCurveTo(0, y - 6, 36, y); } g.stroke();
    g.fillStyle = '#4a2410'; g.fillRect(-45, -14, 8, 9); g.fillRect(37, -14, 8, 9); g.fillRect(-45, 4, 8, 9); g.fillRect(37, 4, 8, 9);   // le chocolat dépasse
    reflet(g, U, -16, -14, 16, 5, 0.35); g.restore();
    croissant(g, U, -34, -26, 1.05, -0.5, 0); croissant(g, U, 46, -38, 0.85, 0.5, 0);
    g.fillStyle = '#d99a48'; for (let k = 0; k < 12; k++) { g.beginPath(); U.oval(g, -80 + R() * 160, -70 + R() * 140, 2 + R() * 2, 1.5 + R()); g.fill(); }
  },
  potmiel(g, d, R, U) {                               // pot de miel en grès (couvercle ôté) et cuillère à miel en bois qui goutte
    ombre(g, 0, 1.3, () => g.arc(0, -36, 56, 0, TAU));
    g.fillStyle = bombe(g, 0, -36, 56, '#f0c878', '#a8701e'); g.beginPath(); g.arc(0, -36, 56, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(120,70,10,0.55)'; g.lineWidth = 1.5; g.beginPath();                // frise d'alvéoles sur le bord
    for (let k = 0; k < 18; k++) { const u = k * TAU / 18, cx = Math.cos(u) * 51, cy = -36 + Math.sin(u) * 51; for (let p = 0; p <= 6; p++) { const v = u + p * TAU / 6, px = cx + Math.cos(v) * 5, py = cy + Math.sin(v) * 5; if (p) g.lineTo(px, py); else g.moveTo(px, py); } }
    g.stroke(); cercle(g, 0, -36, 45, 4, '#8a5512');
    g.fillStyle = bombe(g, 0, -36, 43, '#ffe08a', '#d98a10'); g.beginPath(); g.arc(0, -36, 43, 0, TAU); g.fill(); reflet(g, U, -14, -52, 14, 6, 0.7);
    g.save(); g.translate(48, 24); g.rotate(-0.6);                     // une abeille gourmande
    g.fillStyle = 'rgba(230,245,255,0.75)'; g.beginPath(); U.oval(g, -2, -9, 7, 5); U.oval(g, -2, 9, 7, 5); g.fill();
    g.fillStyle = '#f2c230'; g.beginPath(); U.oval(g, 0, 0, 11, 6.5); g.fill();
    g.fillStyle = '#2a2018'; g.fillRect(-4, -6, 3, 12); g.fillRect(2, -6, 3, 12); disque(g, 10, 0, 4, '#2a2018'); g.restore();
    g.save(); g.translate(10, 56); g.rotate(1.5);
    ombre(g, 1.5, 0.5, () => { U.oval(g, 0, 0, 22, 17); U.rr(g, 18, -5, 72, 10, 5); });
    U.blob(g, -4, 6, 26, 18, 0.2, R, 'rgba(214,130,14,0.85)');        // flaque de miel sous la tête
    g.fillStyle = lin(g, -22, 0, 22, 0, '#d9a060', '#9a6430'); g.beginPath(); U.oval(g, 0, 0, 22, 17); g.fill();
    g.strokeStyle = 'rgba(90,50,20,0.6)'; g.lineWidth = 2; g.beginPath(); for (const x of [-12, -4, 4, 12]) { g.moveTo(x, -15 + Math.abs(x) * 0.3); g.lineTo(x, 15 - Math.abs(x) * 0.3); } g.stroke();
    g.fillStyle = 'rgba(240,170,40,0.7)'; g.beginPath(); U.oval(g, -2, 2, 14, 10); g.fill();
    g.fillStyle = lin(g, 0, -5, 0, 5, '#e4b070', '#a8743c'); g.beginPath(); U.rr(g, 20, -5, 72, 10, 5); g.fill();
    g.restore();
  },
  beurrier(g, d, R, U) {                              // beurrier en faïence : plaquette de beurre entamée (copeaux), couteau en travers
    const a = -0.25; g.rotate(a);
    ombre(g, a, 0.6, () => U.rr(g, -92, -58, 184, 116, 26));
    g.fillStyle = bombe(g, 0, 0, 110, '#ffffff', '#cfd5df'); g.beginPath(); U.rr(g, -92, -58, 184, 116, 26); g.fill();
    g.strokeStyle = '#3d6cc8'; g.lineWidth = 2.5; g.beginPath(); U.rr(g, -84, -50, 168, 100, 20); g.stroke();
    g.fillStyle = '#eef0f4'; g.beginPath(); U.rr(g, -76, -42, 152, 84, 14); g.fill();
    ombre(g, a, 0.35, () => g.rect(-52, -26, 92, 52));
    g.fillStyle = '#f3d469'; g.fillRect(-52, -26, 92, 52); g.fillStyle = '#fae6a0'; g.fillRect(-52, -26, 92, 10);
    for (const c of [[50, -12], [58, 8], [46, 18]]) { g.fillStyle = '#f7de7c'; g.beginPath(); U.oval(g, c[0], c[1], 9, 5); g.fill(); g.strokeStyle = 'rgba(200,160,50,0.7)'; g.lineWidth = 1.2; g.beginPath(); g.arc(c[0], c[1], 4, 0.5, 4); g.stroke(); }
    g.save(); g.rotate(0.5); ombre(g, a + 0.5, 0.3, () => U.rr(g, -88, 34, 170, 12, 6));
    g.fillStyle = '#c9ced6'; g.beginPath(); U.rr(g, -88, 34, 100, 12, 6); g.fill(); g.fillStyle = '#7a4a24'; g.beginPath(); U.rr(g, 10, 33, 72, 14, 7); g.fill(); g.restore();
  },
  sucrier(g, d, R, U) {                               // sucrier ouvert plein de morceaux, pince à sucre, couvercle posé à côté
    ombre(g, 0, 1.2, () => g.arc(-10, 0, 62, 0, TAU));
    g.fillStyle = bombe(g, -10, 0, 62, '#ffffff', '#cbd2dc'); g.beginPath(); g.arc(-10, 0, 62, 0, TAU); g.fill();
    cercle(g, -10, 0, 56, 3, '#3d6cc8'); disque(g, -10, 0, 48, '#e6e9ee');
    for (const q of [[-30, -16, 0.3], [0, -20, -0.5], [-38, 14, 0.9], [-8, 10, 0.1], [18, 6, 0.6], [-14, 34, -0.3], [-20, -40, 0.2]]) sucre(g, U, q[0], q[1], 10, q[2], 0);
    g.strokeStyle = '#aab1bb'; g.lineWidth = 4; g.lineCap = 'round'; g.beginPath(); g.moveTo(-58, -30); g.lineTo(30, -6); g.quadraticCurveTo(46, 0, 30, 6); g.lineTo(-56, -18); g.stroke();   // pince à sucre
    ombre(g, 0, 0.5, () => g.arc(62, 62, 36, 0, TAU));
    g.fillStyle = bombe(g, 62, 62, 36, '#ffffff', '#cbd2dc'); g.beginPath(); g.arc(62, 62, 36, 0, TAU); g.fill(); cercle(g, 62, 62, 31, 2.5, '#3d6cc8');
    g.fillStyle = bombe(g, 62, 62, 10, '#ffffff', '#9fb0d6'); g.beginPath(); g.arc(62, 62, 10, 0, TAU); g.fill();
  },
  potlait(g, d, R, U) {                               // pot à lait en faïence (bec tourné vers la flaque), quelques gouttes renversées
    const a = -0.37; g.rotate(a);
    ombre(g, a, 1.1, () => { g.arc(0, 0, 44, 0, TAU); U.rr(g, 36, -14, 40, 28, 12); });
    g.strokeStyle = '#dfe5ee'; g.lineWidth = 9; g.beginPath(); U.rr(g, 38, -14, 34, 28, 12); g.stroke();
    g.fillStyle = '#eef2f7'; g.beginPath(); g.moveTo(-36, -16); g.lineTo(-60, 0); g.lineTo(-36, 16); g.closePath(); g.fill();
    g.fillStyle = bombe(g, 0, 0, 44, '#ffffff', '#c9d2df'); g.beginPath(); g.arc(0, 0, 44, 0, TAU); g.fill(); cercle(g, 0, 0, 41, 2, '#3d6cc8');
    disque(g, 0, 0, 35, '#fbfbf7'); reflet(g, U, -12, -14, 10, 5, 0.9);
    g.fillStyle = 'rgba(250,252,255,0.95)'; g.beginPath(); for (const q of [[-74, 6, 7], [-90, -4, 4.5], [-68, 24, 3.5]]) { g.moveTo(q[0] + q[2], q[1]); g.arc(q[0], q[1], q[2], 0, TAU); } g.fill();
  },
  jus(g, d, R, U) {                                   // verre de jus d'orange : paille rayée, rondelle sur le bord
    ombre(g, 0, 1.2, () => g.arc(0, 0, 40, 0, TAU));
    g.fillStyle = 'rgba(214,238,248,0.6)'; g.beginPath(); g.arc(0, 0, 40, 0, TAU); g.fill(); cercle(g, 0, 0, 39, 3, 'rgba(140,190,215,0.9)');
    g.fillStyle = bombe(g, 0, 0, 34, '#ffd25a', '#ef8a10'); g.beginPath(); g.arc(0, 0, 34, 0, TAU); g.fill();
    g.fillStyle = 'rgba(255,236,160,0.6)'; for (let k = 0; k < 14; k++) { const u = R() * TAU, dd = Math.sqrt(R()) * 30; g.fillRect(Math.cos(u) * dd, Math.sin(u) * dd, 3, 1.6); }
    rondelle(g, 30, -24, 17);
    g.lineCap = 'round'; g.strokeStyle = '#ffffff'; g.lineWidth = 8; g.beginPath(); g.moveTo(-6, 4); g.lineTo(-46, 42); g.stroke();
    g.strokeStyle = '#e8322a'; g.setLineDash([7, 7]); g.stroke(); g.setLineDash([]); disque(g, -6, 4, 4, '#a82a20');
    reflet(g, U, -14, -18, 10, 5, 0.6);
  },
  biscottes(g, d, R, U) {                             // paquet de biscottes ouvert (papier bleu), deux biscottes sorties dont une beurrée
    const a = 0.35; g.rotate(a);
    ombre(g, a, 0.6, () => U.rr(g, -110, -52, 150, 104, 8));
    g.fillStyle = lin(g, 0, -52, 0, 52, '#4f86d8', '#2a5aa8'); g.beginPath(); U.rr(g, -110, -52, 150, 104, 8); g.fill();
    g.fillStyle = '#ffffff'; g.font = 'bold 20px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('BISCOTTES', -40, -24);
    g.fillStyle = '#ffd23a'; g.beginPath(); U.rr(g, -96, 4, 112, 30, 6); g.fill(); g.fillStyle = '#2a5aa8'; g.font = 'bold 13px sans-serif'; g.fillText('PUR FROMENT', -40, 20);
    g.fillStyle = '#e9e1cf'; g.beginPath(); g.moveTo(40, -52); g.lineTo(60, -40); g.lineTo(60, 40); g.lineTo(40, 52); g.closePath(); g.fill();   // papier déchiré
    for (const b of [[96, -18, 0.2, 0], [84, 46, -0.3, 1]]) {
      g.save(); g.translate(b[0], b[1]); g.rotate(b[2]); ombre(g, a + b[2], 0.3, () => U.rr(g, -36, -28, 72, 56, 12));
      g.fillStyle = '#c98a3e'; g.beginPath(); U.rr(g, -36, -28, 72, 56, 12); g.fill(); g.fillStyle = '#e8b868'; g.beginPath(); U.rr(g, -31, -23, 62, 46, 9); g.fill();
      g.fillStyle = 'rgba(150,90,30,0.45)'; for (let k = 0; k < 14; k++) g.fillRect(-26 + ((k * 17) % 52), -18 + ((k * 11) % 36), 2.4, 2.4);
      if (b[3]) { g.fillStyle = 'rgba(250,232,150,0.9)'; g.beginPath(); U.rr(g, -22, -16, 44, 32, 9); g.fill(); }
      g.restore();
    }
  },
  kiwis(g, d, R, U) {                                 // deux moitiés de kiwi sur une soucoupe : chair verte, cœur blanc, couronne de pépins
    plat(g, U, 0, 0, 70, '#5a9e44', 0);
    for (const q of [[-18, -10], [24, 14]]) {
      const x = q[0], y = q[1];
      ombre(g, 0, 0.6, () => g.arc(x, y, 30, 0, TAU));
      disque(g, x, y, 30, '#7a5a2a'); g.fillStyle = bombe(g, x, y, 27, '#b6e06a', '#5f9e22'); g.beginPath(); g.arc(x, y, 27, 0, TAU); g.fill();
      g.fillStyle = 'rgba(240,250,220,0.5)'; g.beginPath(); for (let k = 0; k < 16; k++) { const u = k * TAU / 16; g.moveTo(x + Math.cos(u) * 9, y + Math.sin(u) * 9); g.lineTo(x + Math.cos(u + 0.1) * 23, y + Math.sin(u + 0.1) * 23); g.lineTo(x + Math.cos(u - 0.1) * 23, y + Math.sin(u - 0.1) * 23); g.closePath(); } g.fill();
      g.fillStyle = '#1e1e14'; g.beginPath(); for (let k = 0; k < 18; k++) { const u = k * TAU / 18, px = x + Math.cos(u) * 12, py = y + Math.sin(u) * 12; g.moveTo(px + 1.6, py); g.arc(px, py, 1.6, 0, TAU); } g.fill();
      g.fillStyle = '#f2f6dc'; g.beginPath(); U.oval(g, x, y, 7, 5); g.fill();
    }
    cuillerette(g, U, -30, 42, 2.6, 30, 0);
  },
  brioche(g, d, R, U) {                               // brioche à tête : huit côtes cannelées dorées, la tête au milieu, éclat de dorure
    ombre(g, 0, 1.2, () => g.arc(0, 0, 62, 0, TAU));
    g.fillStyle = '#9a5418'; g.beginPath(); for (let k = 0; k < 8; k++) { const u = k * TAU / 8, px = Math.cos(u) * 40, py = Math.sin(u) * 40; g.moveTo(px + 24, py); g.arc(px, py, 24, 0, TAU); } g.fill();
    g.fillStyle = bombe(g, 0, 0, 56, '#f6c56a', '#c0701e'); g.beginPath(); for (let k = 0; k < 8; k++) { const u = k * TAU / 8, px = Math.cos(u) * 38, py = Math.sin(u) * 38; g.moveTo(px + 21, py); g.arc(px, py, 21, 0, TAU); } g.fill();
    disque(g, 0, 0, 36, '#c97a26');
    ombre(g, 0, 0.6, () => g.arc(0, 0, 25, 0, TAU));
    g.fillStyle = bombe(g, 0, 0, 25, '#ffd98a', '#c06a1a'); g.beginPath(); g.arc(0, 0, 25, 0, TAU); g.fill();
    reflet(g, U, -9, -10, 8, 4, 0.6); reflet(g, U, -36, -24, 7, 3, 0.35);
  },
};

// ── obstacles fixes (coordonnées absolues ; r = [x, y, rayon, type]) ──
const OBJETS = {
  grandbol(g, r, R, U) {                              // bol géant : faïence à pois bleus, lait, anneaux multicolores, grande cuillère
    const x = r[0], y = r[1], s = r[2], m = s * 0.84, a = 1.75;   // a : manche de la cuillère, vers l'ouverture de l'épingle
    g.save();
    ombre(g, 0, 2.6, () => g.arc(x, y, s, 0, TAU));
    g.fillStyle = bombe(g, x, y, s, '#ffffff', '#c3cad8'); g.beginPath(); g.arc(x, y, s, 0, TAU); g.fill();
    g.fillStyle = '#2f62c8'; g.beginPath();
    for (let k = 0; k < 40; k++) { const u = k * TAU / 40, d = s * (k % 2 ? 0.955 : 0.915), px = x + Math.cos(u) * d, py = y + Math.sin(u) * d; g.moveTo(px + 5, py); g.arc(px, py, 5, 0, TAU); }
    g.fill(); cercle(g, x, y, s * 0.875, 3, '#2f62c8');
    g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 9; g.beginPath(); g.arc(x, y, s * 0.935, 3.4, 4.5); g.stroke();
    disque(g, x, y, m, '#e3e7ee');                                  // le creux : paroi, puis le lait
    g.fillStyle = bombe(g, x + s * 0.06, y + s * 0.07, m * 0.97, '#fffef8', '#efe7d2'); g.beginPath(); g.arc(x + 3, y + 4, m * 0.96, 0, TAU); g.fill();
    g.save(); g.beginPath(); g.arc(x, y, m, 0, TAU); g.clip();
    g.fillStyle = 'rgba(120,105,80,0.16)'; g.beginPath(); g.arc(x, y, m + 40, 0, TAU); g.arc(x + 16, y + 20, m, 0, TAU, true); g.fill();   // ombre du rebord
    g.save(); g.translate(x + Math.cos(a) * s * 0.14, y + Math.sin(a) * s * 0.14); g.rotate(a);   // cuilleron immergé, deviné sous le lait
    g.fillStyle = 'rgba(140,150,168,0.32)'; g.beginPath(); U.oval(g, 0, 0, 52, 36); g.fill(); g.restore();
    g.strokeStyle = 'rgba(190,175,150,0.35)'; g.lineWidth = 2; g.beginPath(); for (const q of [62, 84]) U.oval(g, x + Math.cos(a) * s * 0.14, y + Math.sin(a) * s * 0.14, q, q * 0.7); g.stroke();
    const P = []; for (let k = 0; k < 76; k++) { const u = R() * TAU, d = Math.sqrt(R()) * m * 0.88; P.push([x + Math.cos(u) * d, y + Math.sin(u) * d, ANNEAUX[(R() * ANNEAUX.length) | 0]]); }
    anneaux(g, P, 12);
    g.restore();
    g.translate(x, y); g.rotate(a);                                 // manche de la grande cuillère, posé sur le bord
    const manche = () => { g.moveTo(s * 0.3, -6); g.lineTo(s * 1.08, -11); g.quadraticCurveTo(s * 1.2, 0, s * 1.08, 11); g.lineTo(s * 0.3, 6); g.closePath(); };
    ombre(g, a, 0.8, manche);
    g.fillStyle = lin(g, 0, -11, 0, 11, '#eef1f5', '#8b929c'); g.beginPath(); manche(); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.7)'; g.fillRect(s * 0.34, -4.5, s * 0.72, 2.5);
    g.strokeStyle = 'rgba(80,86,96,0.5)'; g.lineWidth = 1.2; g.beginPath(); U.oval(g, s * 1.08, 0, 10, 5); g.stroke();
    g.restore();
  },
  cafetiere(g, r, R, U) {                             // cafetière à piston : cerclage chromé, café noir, couvercle et bouton, anse, bec qui goutte
    const x = r[0], y = r[1], s = r[2], ab = -1.97, ah = ab + Math.PI;   // bec tourné vers la flaque de café, anse à l'opposé
    g.save(); g.translate(x, y);
    g.save(); g.rotate(ah); ombre(g, ah, 1.8, () => U.rr(g, s * 0.7, -17, s * 0.72, 34, 15)); g.restore();
    ombre(g, 0, 1.8, () => g.arc(0, 0, s, 0, TAU));
    g.save(); g.rotate(ah); g.fillStyle = '#26282d'; g.beginPath(); U.rr(g, s * 0.7, -17, s * 0.72, 34, 15); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.16)'; g.fillRect(s * 0.8, -12, s * 0.55, 5); g.restore();
    g.save(); g.rotate(ab); g.fillStyle = '#c3c8cf'; g.beginPath(); g.moveTo(s * 0.86, -16); g.lineTo(s * 1.14, 0); g.lineTo(s * 0.86, 16); g.closePath(); g.fill();
    g.fillStyle = 'rgba(52,24,8,0.9)'; g.beginPath(); U.oval(g, s * 1.25, 2, 7, 5); U.oval(g, s * 1.36, -3, 4, 3); g.fill(); g.restore();
    g.fillStyle = lin(g, -s, -s, s, s, '#f4f6f9', '#6f757e'); g.beginPath(); g.arc(0, 0, s, 0, TAU); g.fill();
    g.fillStyle = bombe(g, 0, 0, s * 0.86, '#7a4422', '#24110a'); g.beginPath(); g.arc(0, 0, s * 0.86, 0, TAU); g.fill();
    g.fillStyle = '#41454c'; g.beginPath(); for (let k = 0; k < 4; k++) { const u = k * TAU / 4 + 0.4, px = Math.cos(u) * s * 0.93, py = Math.sin(u) * s * 0.93; g.moveTo(px + 6, py); g.arc(px, py, 6, 0, TAU); } g.fill();   // montants du cerclage
    g.fillStyle = lin(g, -s * 0.7, -s * 0.7, s * 0.7, s * 0.7, '#fafbfc', '#8a9099'); g.beginPath(); g.arc(0, 0, s * 0.68, 0, TAU); g.fill();
    cercle(g, 0, 0, s * 0.5, 2, 'rgba(60,64,72,0.35)'); cercle(g, 0, 0, s * 0.62, 1.5, 'rgba(255,255,255,0.7)');
    disque(g, 3, 4, s * 0.22, 'rgba(0,0,0,0.25)');
    g.fillStyle = bombe(g, 0, 0, s * 0.22, '#5a5e66', '#121316'); g.beginPath(); g.arc(0, 0, s * 0.22, 0, TAU); g.fill();
    reflet(g, U, -s * 0.07, -s * 0.08, s * 0.07, s * 0.045, 0.6);
    g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 5; g.beginPath(); g.arc(0, 0, s * 0.93, 3.5, 4.4); g.stroke();
    g.restore();
  },
  pichet(g, r, R, U) {                                // pichet de jus d'orange : verre épais, pulpe, glaçons, rondelle, bec et anse
    const x = r[0], y = r[1], s = r[2], ah = -0.6;
    g.save(); g.translate(x, y);
    g.save(); g.rotate(ah); ombre(g, ah, 1.4, () => U.rr(g, s * 0.8, -18, s * 0.6, 36, 16)); g.restore();
    ombre(g, 0, 1.4, () => g.arc(0, 0, s, 0, TAU));
    g.save(); g.rotate(ah); g.strokeStyle = 'rgba(200,232,245,0.9)'; g.lineWidth = 11; g.beginPath(); U.rr(g, s * 0.78, -18, s * 0.6, 36, 16); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 2.5; g.stroke(); g.restore();
    g.save(); g.rotate(ah + Math.PI); g.fillStyle = 'rgba(215,238,248,0.85)'; g.beginPath(); g.moveTo(s * 0.8, -24); g.quadraticCurveTo(s * 1.22, 0, s * 0.8, 24); g.closePath(); g.fill(); g.restore();
    g.fillStyle = 'rgba(214,238,248,0.6)'; g.beginPath(); g.arc(0, 0, s, 0, TAU); g.fill(); cercle(g, 0, 0, s - 1.5, 3, 'rgba(140,190,215,0.9)');
    g.fillStyle = bombe(g, 0, 0, s * 0.84, '#ffd25a', '#ef8a10'); g.beginPath(); g.arc(0, 0, s * 0.84, 0, TAU); g.fill();
    g.fillStyle = 'rgba(255,236,160,0.6)'; for (let k = 0; k < 40; k++) { const u = R() * TAU, d = Math.sqrt(R()) * s * 0.78; g.fillRect(Math.cos(u) * d, Math.sin(u) * d, 3, 1.6); }   // pulpe
    for (const q of [[-0.4, 0.2, 0.3], [0.06, 0.44, -0.4], [0.36, -0.28, 0.9]]) {   // glaçons
      g.save(); g.translate(q[0] * s, q[1] * s); g.rotate(q[2]); g.fillStyle = 'rgba(255,255,255,0.5)'; g.beginPath(); U.rr(g, -14, -14, 28, 28, 6); g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 2; g.stroke(); g.restore();
    }
    rondelle(g, -s * 0.12, -s * 0.3, 25);
    g.strokeStyle = 'rgba(255,255,255,0.75)'; g.lineWidth = 6; g.beginPath(); g.arc(0, 0, s * 0.92, 3.5, 4.5); g.stroke();
    g.restore();
  },
  morceau(g, r, R, U) {                               // morceau de sucre de la chicane, grains de sucre semés autour
    sucre(g, U, r[0], r[1], r[2] * 0.76, R() * 1.5, 0);
    g.fillStyle = 'rgba(255,255,255,0.9)'; for (let k = 0; k < 8; k++) { const u = R() * TAU, d = r[2] * (1.15 + R() * 0.7); g.fillRect(r[0] + Math.cos(u) * d, r[1] + Math.sin(u) * d, 2.5, 2.5); }
  },
  corbeille(g, r, R, U) {                             // corbeille à pain en osier tressé, serviette vichy, croissant, tranches et petit pain
    const x = r[0], y = r[1], s = r[2], q = s * 0.72;
    g.save();
    ombre(g, 0, 1.3, () => g.arc(x, y, s, 0, TAU));
    disque(g, x, y, s, '#9a6328');
    for (let k = 0; k < 32; k++) { const u = k * TAU / 32; g.save(); g.translate(x + Math.cos(u) * s * 0.9, y + Math.sin(u) * s * 0.9); g.rotate(u + (k % 2 ? 0.5 : -0.5)); g.fillStyle = k % 2 ? '#d29a52' : '#b57a36'; g.beginPath(); U.oval(g, 0, 0, 7, 13); g.fill(); g.restore(); }
    g.fillStyle = lin(g, x - s, y - s, x + s, y + s, '#6a3f1a', '#a8703a'); g.beginPath(); g.arc(x, y, s * 0.8, 0, TAU); g.fill();
    g.save(); g.translate(x, y); g.rotate(0.35);                    // serviette à carreaux posée en biais : les coins débordent
    ombre(g, 0.35, 0.3, () => g.rect(-q, -q, 2 * q, 2 * q));
    g.beginPath(); g.rect(-q, -q, 2 * q, 2 * q); g.fillStyle = '#fbf7f0'; g.fill(); g.clip();
    g.fillStyle = 'rgba(206,40,44,0.5)'; for (let k = -q; k < q; k += 22) { g.fillRect(k, -q, 11, 2 * q); g.fillRect(-q, k, 2 * q, 11); }
    g.restore();
    croissant(g, U, x - s * 0.22, y - s * 0.2, 0.95, -0.5, 0);
    tranche(g, U, x + s * 0.32, y + s * 0.02, 0.4); tranche(g, U, x + s * 0.14, y + s * 0.38, -0.2);
    petitpain(g, U, x - s * 0.2, y + s * 0.3, 26);
    g.restore();
  },
  coquetier(g, r, R, U) {                             // coquetier jaune et son œuf à la coque décalotté (jaune coulant), éclats de coquille
    const x = r[0], y = r[1], s = r[2];
    ombre(g, 0, 0.9, () => g.arc(x, y, s, 0, TAU));
    g.fillStyle = bombe(g, x, y, s, '#ffe27a', '#d9a514'); g.beginPath(); g.arc(x, y, s, 0, TAU); g.fill();
    cercle(g, x, y, s * 0.9, 2, 'rgba(160,110,10,0.5)');
    g.fillStyle = bombe(g, x, y, s * 0.78, '#fff6e6', '#e2c49a'); g.beginPath(); g.arc(x, y, s * 0.78, 0, TAU); g.fill();
    g.fillStyle = '#ffffff'; g.beginPath(); for (let k = 0; k <= 16; k++) { const u = k * TAU / 16, d = s * (k % 2 ? 0.54 : 0.64); if (k) g.lineTo(x + Math.cos(u) * d, y + Math.sin(u) * d); else g.moveTo(x + d, y); } g.closePath(); g.fill();
    g.fillStyle = bombe(g, x + 1, y + 1, s * 0.34, '#ffd84a', '#f08a0a'); g.beginPath(); g.arc(x + 1, y + 1, s * 0.34, 0, TAU); g.fill();
    reflet(g, U, x - s * 0.1, y - s * 0.12, s * 0.1, s * 0.06, 0.7);
    g.fillStyle = '#f3e6cf'; g.beginPath(); for (let k = 0; k < 3; k++) { const u = R() * TAU, px = x + Math.cos(u) * s * 1.5, py = y + Math.sin(u) * s * 1.5; g.moveTo(px, py); g.lineTo(px + 6, py + 2); g.lineTo(px + 2, py + 6); g.closePath(); } g.fill();
  },
  saliere(g, r, R, U) { moulin(g, U, r[0], r[1], r[2], '#ffffff', '#b8c3d6'); g.fillStyle = '#ffffff'; for (let k = 0; k < 10; k++) { const u = R() * TAU, d = r[2] * (1.2 + R()); g.fillRect(r[0] + Math.cos(u) * d, r[1] + Math.sin(u) * d, 2, 2); } },
  poivriere(g, r, R, U) { moulin(g, U, r[0], r[1], r[2], '#5a606a', '#1b1d22'); g.fillStyle = '#2a2420'; for (let k = 0; k < 10; k++) { const u = R() * TAU, d = r[2] * (1.2 + R()); g.fillRect(r[0] + Math.cos(u) * d, r[1] + Math.sin(u) * d, 2, 2); } },
};

// ── murs (capsules w = [x1, y1, x2, y2, rayon, type]) ──
const MURS = {
  couteau(g, w, R, U) {                               // couteau de table le long de la ligne droite du haut : manche de bois à rivets, lame, reste de beurre
    const x1 = w[0], y1 = w[1], L = Math.hypot(w[2] - x1, w[3] - y1), r = w[4], a = Math.atan2(w[3] - y1, w[2] - x1), m = L * 0.36;
    g.save(); g.translate(x1, y1); g.rotate(a);
    ombre(g, a, 0.5, () => U.rr(g, -r, -r, L + 2 * r, 2 * r, r));
    g.fillStyle = lin(g, 0, -r, 0, r, '#c4864a', '#6a3c18'); g.beginPath(); U.rr(g, -r, -r, m + r, 2 * r, r); g.fill();
    g.strokeStyle = 'rgba(60,30,10,0.35)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(0, -3); g.quadraticCurveTo(m * 0.5, -6, m - 4, -2); g.moveTo(4, 3); g.quadraticCurveTo(m * 0.5, 6, m - 6, 4); g.stroke();
    for (const t of [0.18, 0.5, 0.82]) { disque(g, m * t, 0, r * 0.32, '#e9ecf0'); disque(g, m * t + 0.6, 0.6, r * 0.14, '#9aa1ab'); }
    g.fillStyle = lin(g, 0, -r, 0, r, '#f2f4f7', '#8f959e'); g.fillRect(m, -r * 0.95, 12, r * 1.9);
    g.fillStyle = lin(g, 0, -r, 0, r, '#f6f8fb', '#9aa0a9'); g.beginPath(); g.moveTo(m + 12, -r * 0.7); g.lineTo(L - r, -r * 0.92); g.quadraticCurveTo(L + r * 1.1, -r * 0.8, L + r, 0);
    g.quadraticCurveTo(L + r * 0.6, r * 0.75, L - r * 2, r * 0.75); g.lineTo(m + 12, r * 0.6); g.closePath(); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.75)'; g.fillRect(m + 14, -r * 0.6, L - m - 2 * r - 14, 2);
    U.blob(g, L - r * 2.5, 0, 22, 6, 0.05, R, 'rgba(247,224,122,0.95)');
    g.restore();
  },
  cuillere(g, w, R, U) {                              // grande cuillère de service au bord de l'épingle du bol : cuilleron creux, manche ciselé
    const x1 = w[0], y1 = w[1], L = Math.hypot(w[2] - x1, w[3] - y1), r = w[4], a = Math.atan2(w[3] - y1, w[2] - x1), b = r * 2.4;
    g.save(); g.translate(x1, y1); g.rotate(a);
    const forme = () => { U.oval(g, b * 0.55, 0, b, r * 1.2); g.moveTo(b * 1.4, -r * 0.28); g.lineTo(L - r * 1.4, -r * 0.6); g.quadraticCurveTo(L + r * 0.4, -r * 0.75, L + r * 0.4, 0); g.quadraticCurveTo(L + r * 0.4, r * 0.75, L - r * 1.4, r * 0.6); g.lineTo(b * 1.4, r * 0.28); g.closePath(); };
    ombre(g, a, 0.6, forme);
    g.fillStyle = lin(g, 0, -r, 0, r, '#f1f3f6', '#878e98'); g.beginPath(); forme(); g.fill();
    g.fillStyle = lin(g, 0, -r, 0, r, '#8d949e', '#e8ebef'); g.beginPath(); U.oval(g, b * 0.55, 0, b * 0.82, r * 0.95); g.fill();   // creux du cuilleron (éclairage inversé)
    reflet(g, U, b * 0.35, -r * 0.35, b * 0.3, r * 0.2, 0.75);
    g.strokeStyle = 'rgba(80,86,96,0.45)'; g.lineWidth = 1.2; g.beginPath(); U.oval(g, L - r * 0.6, 0, r * 0.7, r * 0.38); g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.65)'; g.fillRect(b * 1.5, -r * 0.2, L - b * 1.5 - r * 2, 1.8);
    g.restore();
  },
};

// ── zones (z = [x, y, rx, ry, kind, angle]) ──
const ZONES = {
  lait(g, z, R, U) {                                  // lait renversé : flaque bleutée, ourlet, gouttes, trois anneaux qui flottent
    const x = z[0], y = z[1], rx = z[2], ry = z[3], a = z[5];
    U.blob(g, x, y, rx, ry, a, R, 'rgba(226,234,246,0.96)');
    U.blob(g, x - 3, y - 3, rx * 0.86, ry * 0.8, a, R, 'rgba(255,255,255,0.97)');
    g.save(); g.translate(x, y); g.rotate(a);
    g.fillStyle = 'rgba(170,195,225,0.3)'; g.beginPath(); U.oval(g, rx * 0.2, ry * 0.25, rx * 0.55, ry * 0.4); g.fill();
    anneaux(g, [[-rx * 0.38, ry * 0.12, '#f5a623'], [rx * 0.3, -ry * 0.25, '#e8452c'], [rx * 0.02, ry * 0.42, '#6cc04a']], 11);
    g.fillStyle = 'rgba(244,247,253,0.95)'; g.beginPath(); for (let k = 0; k < 8; k++) { const u = R() * TAU, d = 1.1 + R() * 0.35, px = Math.cos(u) * rx * d, py = Math.sin(u) * ry * d, rr = 2.5 + R() * 4; g.moveTo(px + rr, py); g.arc(px, py, rr, 0, TAU); } g.fill();
    g.restore();
  },
  cafe(g, z, R, U) {                                  // café renversé : flaque brun noir, cœur plus clair, reflets crème, éclaboussures
    const x = z[0], y = z[1], rx = z[2], ry = z[3], a = z[5];
    U.blob(g, x, y, rx, ry, a, R, 'rgba(46,22,8,0.9)');
    g.save(); g.translate(x, y); g.rotate(a);
    g.fillStyle = 'rgba(122,66,28,0.6)'; g.beginPath(); U.oval(g, -rx * 0.06, -ry * 0.08, rx * 0.72, ry * 0.62); g.fill();
    g.fillStyle = 'rgba(176,110,58,0.45)'; g.beginPath(); U.oval(g, -rx * 0.12, -ry * 0.14, rx * 0.42, ry * 0.34); g.fill();
    reflet(g, U, -rx * 0.32, -ry * 0.36, rx * 0.24, ry * 0.09, 0.5); reflet(g, U, rx * 0.25, ry * 0.18, rx * 0.08, ry * 0.05, 0.35);
    g.fillStyle = 'rgba(46,22,8,0.88)'; g.beginPath(); for (let k = 0; k < 9; k++) { const u = R() * TAU, d = 1.12 + R() * 0.4, rr = 2.5 + R() * 5, px = Math.cos(u) * rx * d, py = Math.sin(u) * ry * d; g.moveTo(px + rr, py); g.arc(px, py, rr, 0, TAU); } g.fill();
    g.restore();
  },
  miel(g, z, R, U) {                                  // miel coulé : nappe ambrée épaisse, cœur doré, reflets gras, bulles
    const x = z[0], y = z[1], rx = z[2], ry = z[3], a = z[5];
    g.save(); g.translate(x, y); g.rotate(a); g.fillStyle = 'rgba(150,80,6,0.45)'; g.beginPath(); U.oval(g, 2, 3, rx * 0.98, ry * 0.96); g.fill(); g.restore();
    U.blob(g, x, y, rx, ry, a, R, 'rgba(214,130,14,0.92)');
    g.save(); g.translate(x, y); g.rotate(a);
    const gr = g.createRadialGradient(-rx * 0.2, -ry * 0.2, 2, 0, 0, rx * 0.9); gr.addColorStop(0, 'rgba(255,226,110,0.95)'); gr.addColorStop(1, 'rgba(240,160,30,0)');
    g.fillStyle = gr; g.beginPath(); U.oval(g, 0, 0, rx * 0.86, ry * 0.8); g.fill();
    reflet(g, U, -rx * 0.34, -ry * 0.38, rx * 0.26, ry * 0.08, 0.75); reflet(g, U, rx * 0.2, ry * 0.3, rx * 0.1, ry * 0.05, 0.5);
    g.strokeStyle = 'rgba(255,240,190,0.75)'; g.lineWidth = 1.5; g.beginPath(); for (let k = 0; k < 6; k++) { const px = (R() - 0.5) * rx * 1.1, py = (R() - 0.5) * ry * 0.9, rr = 2 + R() * 3; g.moveTo(px + rr, py); g.arc(px, py, rr, 0, TAU); } g.stroke();
    g.restore();
  },
};

// ── obstacles mobiles (à chaque image : peu de chemins, pas de dégradé superflu) ──
const PORES = []; for (let k = 0; k < 22; k++) PORES.push([k * 2.4, Math.sin(k * 1.7) * 1.2]);   // peau de l'orange : [longitude, latitude]
const MOBILES = {
  orange(g, m, o, now, U, reduceFx) {                 // orange qui roule : la peau (et le pédoncule) tourne avec la distance parcourue
    const x = o.x, y = o.y, r = m.r, ph = o.x / r;
    g.fillStyle = 'rgba(52,26,8,0.14)'; g.beginPath(); g.arc(x + 9, y + 13, r * 1.04, 0, TAU); g.fill();
    g.fillStyle = 'rgba(52,26,8,0.24)'; g.beginPath(); g.arc(x + 4, y + 6, r, 0, TAU); g.fill();
    const gr = g.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r); gr.addColorStop(0, '#ffcf6a'); gr.addColorStop(0.45, '#f7941d'); gr.addColorStop(1, '#c4580a');
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    g.fillStyle = 'rgba(150,60,0,0.4)'; g.beginPath();
    for (const q of PORES) { const u = q[0] + ph, cz = Math.cos(u) * Math.cos(q[1]); if (cz < 0.15) continue; const px = x + Math.sin(u) * Math.cos(q[1]) * r * 0.92, py = y + Math.sin(q[1]) * r * 0.92, s = 1.8 * cz; g.moveTo(px + s, py); g.arc(px, py, s, 0, TAU); }
    g.fill();
    const cz = Math.cos(ph);
    if (cz > 0.1) { const px = x + Math.sin(ph) * r * 0.9; g.fillStyle = '#5d6b1e'; g.beginPath(); g.arc(px, y, 3.5 * cz + 1, 0, TAU); g.fill(); g.fillStyle = '#4f9a2e'; g.beginPath(); U.oval(g, px + 3, y - 7, 4 * cz + 1, 7); g.fill(); }
    g.fillStyle = 'rgba(255,255,255,0.42)'; g.beginPath(); U.oval(g, x - r * 0.36, y - r * 0.42, r * 0.26, r * 0.15); g.fill();
  },
  petitecuillere(g, m, o, now, U, reduceFx) {         // petite cuillère qui tourne : cuilleron en tête, le manche suit
    const r = m.r, c = Math.cos(o.a), s = Math.sin(o.a);
    g.save(); g.translate(o.x, o.y); g.rotate(o.a);
    g.save(); g.translate(5 * c + 8 * s, -5 * s + 8 * c); g.fillStyle = 'rgba(52,26,8,0.25)'; g.beginPath(); U.oval(g, 0, 0, r * 1.1, r * 0.78); U.rr(g, -r * 3.5, -3, r * 2.7, 6, 3); g.fill(); g.restore();
    g.fillStyle = '#9ea5b0'; g.beginPath(); g.moveTo(-r * 0.8, -3); g.lineTo(-r * 3.2, -5); g.quadraticCurveTo(-r * 3.7, 0, -r * 3.2, 5); g.lineTo(-r * 0.8, 3); g.closePath(); g.fill();
    g.fillStyle = '#c3c9d2'; g.beginPath(); U.oval(g, 0, 0, r * 1.1, r * 0.78); g.fill();
    g.fillStyle = '#eef1f5'; g.beginPath(); U.oval(g, -r * 0.08, -r * 0.06, r * 0.82, r * 0.54); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.9)'; g.beginPath(); U.oval(g, -r * 0.3, -r * 0.25, r * 0.3, r * 0.14); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.6)'; g.fillRect(-r * 3, -1.2, r * 2.1, 1.6);
    g.restore();
  },
};

export default {
  id: 'dejeuner', nom: 'Petit-déjeuner', emoji: '🥣', sous: 'Grande table familiale · bol géant, chicane de sucres, café renversé, souris mécanique', v: 2,
  w: 3900, h: 2440, surf: 'bois', edge: 'chute', table: { x0: 60, y0: 60, x1: 3840, y1: 2380, r: 150 }, W: 100,
  pts: tortue(1200, 2210, 0, [
    ['ligne', 1600, 'fermer'],                                  // grande ligne droite au bord de la table
    ['gauche', 450, 90], ['ligne', 250], ['droite', 400, 45], ['ligne', 400],
    ['gauche', 400, 225],                                       // épingle large autour du bol géant
    ['ligne', 450], ['droite', 300, 90],
    ['gauche', 280, 50], ['droite', 280, 65],                   // S entre la cafetière et le pichet de jus
    ['ligne', 700],                                             // chicane de sucres
    ['droite', 320, 75], ['ligne', 100], ['droite', 300, 90], ['ligne', 706],
    ['gauche', 240, 90], ['gauche', 240, 90],                   // épingle de la corbeille à pain
    ['ligne', 1200], ['gauche', 400, 90], ['ligne', 600, 'fermer'], ['droite', 500, 30], ['gauche', 500, 30], ['ligne', 100], ['gauche', 350, 90], ['ligne', 400],
  ]),
  mobs: [
    { type: 'souris', seg: [[2680, 900], [3080, 900]], r: 20, per: 5.5 },         // souris mécanique : sort de sous le bol et traverse
    { type: 'orange', seg: [[290, 1000], [790, 1000]], r: 28, per: 7 },           // orange qui roule d'un bout à l'autre et traverse la descente
    { type: 'petitecuillere', cer: [1700, 472, 180], r: 20, per: 6 },             // petite cuillère qui tourne entre les deux lignes droites du haut
  ],
  boxes: [0.18, 0.56, 0.705],
  zonesPhysiques: { cafe: 'glisse', miel: 'frein' },
  make(H) {
    H.boostAt(0.035); H.boostAt(0.085); H.boostAt(0.725); H.boostAt(0.76);
    H.rock(3293, 661, 235, 'grandbol');                 // bol géant de céréales au cœur de l'épingle
    H.rock(2593, 1691, 95, 'cafetiere'); H.rock(2164, 1332, 88, 'pichet');   // le S passe entre la cafetière et le pichet de jus
    H.rockAt(0.478, 0.25, 22, 'morceau'); H.rockAt(0.493, -0.25, 22, 'morceau'); H.rockAt(0.508, 0.25, 22, 'morceau');   // chicane de sucres : on louvoie
    H.rock(2184, 472, 104, 'corbeille');               // corbeille à pain dans l'épingle du haut
    H.rockAt(0.897, 0.62, 24, 'coquetier');
    H.rockAt(0.948, -0.62, 20, 'saliere'); H.rockAt(0.958, -0.62, 20, 'poivriere');
    H.wall(3150, 140, 3440, 140, 12, 'cuillere');
    H.rail(0.742, 0.768, 1, 'couteau');
    H.zoneAt(0.300, -0.5, 120, 52, 'lait');
    H.zoneAt(0.432, -0.5, 90, 55, 'cafe');
    H.zoneAt(0.672, -0.5, 80, 48, 'miel');
    // décor : le couvert de chacun autour de la table, posé dans les creux du tracé (jamais sur la piste)
    H.deco(1750, 1080, 'set'); H.deco(1750, 1080, 'assiette'); H.deco(2380, 1060, 'croissants');            // au milieu : œufs-bacon, viennoiseries
    H.deco(3560, 1560, 'dessous'); H.deco(3560, 1560, 'theiere'); H.deco(3650, 1890, 'tasse'); H.deco(3540, 2140, 'journal');   // bout droit : le thé de grand-père
    H.deco(270, 290, 'confitures'); H.deco(250, 680, 'fruits'); H.deco(240, 1330, 'chocolat'); H.deco(220, 1750, 'vase'); H.deco(262, 2232, 'serviette');   // bout gauche
    H.deco(980, 620, 'oeuf'); H.deco(880, 1280, 'yaourt'); H.deco(1250, 470, 'jus');
    H.deco(900, 1780, 'cereales'); H.deco(1220, 1985, 'pamplemousse'); H.deco(1480, 1800, 'baguette'); H.deco(1900, 1880, 'tartines'); H.deco(2300, 1930, 'tasse');   // le long du bas
    H.deco(2640, 300, 'potmiel'); H.deco(2640, 1000, 'beurrier'); H.deco(2850, 1600, 'sucrier'); H.deco(3730, 190, 'potlait');
    H.deco(3670, 1290, 'biscottes'); H.deco(1950, 1225, 'kiwis'); H.deco(980, 1480, 'brioche');
  },
  dessin: { objets: OBJETS, decor: DECOR, zones: ZONES, murs: MURS, mobiles: MOBILES },
};
