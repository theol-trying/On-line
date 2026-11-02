// Circuit « plateau » de Micro Machines — définition PARTAGÉE serveur / client (géométrie, obstacles, zones, décor).
// Format : voir l'en-tête de ../shared.js ; dessins propres au circuit (propriété `dessin`) : voir ../rendu.js.

// tortue : départ (x, y) cap h (rad, 0 = vers la droite, y vers le bas) ; ['L', u] tout droit, ['X', x] / ['Y', y] tout droit
// jusqu'à cette abscisse / ordonnée, ['A', rayon, degrés] arc (> 0 : à droite) → points de contrôle tous les ~80 u
function trace(x, y, h, cmds) {
  const P = [[x, y]];
  for (const c of cmds) {
    if (c[0] !== 'A') {
      const len = c[0] === 'L' ? c[1] : c[0] === 'Y' ? (c[1] - y) / Math.sin(h) : (c[1] - x) / Math.cos(h), k = Math.max(1, Math.round(len / 80));
      for (let i = 1; i <= k; i++) P.push([x + Math.cos(h) * len * i / k, y + Math.sin(h) * len * i / k]);
      x += Math.cos(h) * len; y += Math.sin(h) * len;
    } else {
      const r = c[1], a = c[2] * Math.PI / 180, s = a > 0 ? 1 : -1, cx = x - Math.sin(h) * r * s, cy = y + Math.cos(h) * r * s;
      const f0 = Math.atan2(y - cy, x - cx), k = Math.max(2, Math.round(r * Math.abs(a) / 70));
      for (let i = 1; i <= k; i++) { const f = f0 + a * i / k; P.push([cx + Math.cos(f) * r, cy + Math.sin(f) * r]); }
      x = cx + Math.cos(f0 + a) * r; y = cy + Math.sin(f0 + a) * r; h += a;
    }
  }
  const z = P[P.length - 1];
  if (Math.hypot(z[0] - P[0][0], z[1] - P[0][1]) < 30) P.pop();       // boucle fermée : le dernier point rejoint le départ
  return P.map(p => [Math.round(p[0]), Math.round(p[1])]);
}
// ventre d'un serpent : quatre arcs de même rayon, décalage latéral puis retour (s = 1 : d'abord à droite, -1 : à gauche)
const ventre = (r, deg, s) => [['A', r, deg * s], ['A', r, -deg * s], ['A', r, -deg * s], ['A', r, deg * s]];
// serpentin du jeu de l'oie : grande ligne droite du bas (départ), montée à droite, cinq colonnes en lacets, descente à gauche
const PTS = trace(1450, 2700, 0, [].concat(
  [['X', 2300], ['A', 320, -90], ['Y', 760]],                                // ligne droite du départ, grand virage, montée (turbo)
  [['A', 230, -180], ['Y', 1000]], ventre(380, 24, -1), [['Y', 1980]],       // colonne A : le ventre vers la droite du plateau
  [['A', 150, 180], ['Y', 900]],                                             // épingle du bas, colonne B (slalom de pions)
  [['A', 260, -180], ['Y', 1050]], ventre(360, 24, 1), [['Y', 1850]],        // grand lacet du haut, colonne C
  [['A', 150, 180], ['Y', 1000]],                                            // épingle, colonne D (chicane de dés)
  [['A', 220, -180], ['Y', 1100]], ventre(420, 24, -1), [['Y', 2380]],       // lacet, colonne E : la longue descente
  [['A', 320, -90], ['X', 1450]]));

const TAU = Math.PI * 2;
const PIPS = [null, [[0, 0]], [[-1, -1], [1, 1]], [[-1, -1], [0, 0], [1, 1]], [[-1, -1], [1, -1], [-1, 1], [1, 1]], [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]]];
function points(g, v, h, col) {                       // points d'une face de dé (demi-côté h), centrés sur l'origine
  g.fillStyle = col || (v === 1 ? '#d8261d' : '#1a1a1a'); g.beginPath();
  for (const q of PIPS[v]) { g.moveTo(q[0] * h * 0.52 + h * 0.15, q[1] * h * 0.52); g.arc(q[0] * h * 0.52, q[1] * h * 0.52, h * 0.15, 0, TAU); }
  g.fill();
}
function de(g, U, x, y, h, a, v, col) {               // petit dé posé (décor) : ombre, face, points
  g.save(); g.translate(x, y); g.rotate(a);
  g.fillStyle = 'rgba(40,24,10,0.3)'; g.beginPath(); U.rr(g, -h + 5, -h + 7, 2 * h, 2 * h, h * 0.32); g.fill();
  g.fillStyle = col || '#fbfaf4'; g.beginPath(); U.rr(g, -h, -h, 2 * h, 2 * h, h * 0.32); g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.18)'; g.lineWidth = 1.5; g.stroke();
  g.fillStyle = 'rgba(255,255,255,0.5)'; g.beginPath(); U.rr(g, -h * 0.8, -h * 0.85, h * 1.6, h * 0.3, h * 0.15); g.fill();
  points(g, v, h, col ? '#ffffff' : null); g.restore();
}
function pion(g, U, x, y, s, col) {                   // pion debout vu de dessus : socle, col, tête brillante
  const dk = U.rgbStr(U.mix(U.hexRgb(col), [0, 0, 0], 0.4)), cl = U.rgbStr(U.mix(U.hexRgb(col), [255, 255, 255], 0.55));
  g.fillStyle = 'rgba(40,24,10,0.3)'; g.beginPath(); g.arc(x + s * 0.25, y + s * 0.35, s, 0, TAU); g.fill();
  g.fillStyle = dk; g.beginPath(); g.arc(x, y, s, 0, TAU); g.fill();
  g.fillStyle = col; g.beginPath(); g.arc(x, y, s * 0.8, 0, TAU); g.fill();
  g.fillStyle = dk; g.beginPath(); g.arc(x - s * 0.06, y - s * 0.06, s * 0.52, 0, TAU); g.fill();
  g.fillStyle = col; g.beginPath(); g.arc(x - s * 0.1, y - s * 0.1, s * 0.46, 0, TAU); g.fill();
  g.fillStyle = cl; g.beginPath(); g.arc(x - s * 0.24, y - s * 0.26, s * 0.16, 0, TAU); g.fill();
}
function carte(g, U, x, y, a, dos) {                  // carte à jouer 70 × 100 (dos orange « ? » ou face)
  g.save(); g.translate(x, y); g.rotate(a);
  g.fillStyle = 'rgba(40,24,10,0.25)'; g.beginPath(); U.rr(g, -31, -44, 70, 100, 8); g.fill();
  g.fillStyle = '#fbfbf6'; g.beginPath(); U.rr(g, -35, -50, 70, 100, 8); g.fill(); g.strokeStyle = 'rgba(0,0,0,0.22)'; g.lineWidth = 1.5; g.stroke();
  if (dos) {
    g.fillStyle = '#ef7a1a'; g.beginPath(); U.rr(g, -29, -44, 58, 88, 5); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 2; g.beginPath();
    for (let k = -80; k < 80; k += 12) { g.moveTo(k, -44); g.lineTo(k + 88, 44); } g.save(); g.beginPath(); U.rr(g, -29, -44, 58, 88, 5); g.clip();
    g.beginPath(); for (let k = -100; k < 60; k += 12) { g.moveTo(k, -44); g.lineTo(k + 88, 44); } g.stroke(); g.restore();
    g.fillStyle = '#fff6d8'; g.beginPath(); g.arc(0, 0, 19, 0, TAU); g.fill();
    g.fillStyle = '#c0420e'; g.font = 'bold 30px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('?', 0, 2);
  }
  g.restore();
}

// ── décor posé sur le plateau (dessiné autour de l'origine) ──
const DECOR = {
  couvercle(g, d, R, U) {                              // couvercle de la boîte du jeu, illustré
    g.rotate(-0.05);
    g.fillStyle = 'rgba(40,24,10,0.35)'; g.beginPath(); U.rr(g, -372, -138, 760, 300, 20); g.fill();
    g.fillStyle = '#a3191f'; g.beginPath(); U.rr(g, -384, -152, 760, 300, 20); g.fill();
    const gr = g.createLinearGradient(0, -136, 0, 130); gr.addColorStop(0, '#5ec8f2'); gr.addColorStop(0.62, '#bfe9f7'); gr.addColorStop(0.63, '#8fd06a'); gr.addColorStop(1, '#5aa848');
    g.fillStyle = gr; g.beginPath(); U.rr(g, -370, -138, 732, 272, 12); g.fill();
    g.fillStyle = '#ffe36a'; g.beginPath(); g.arc(280, -84, 34, 0, TAU); g.fill();              // soleil
    g.strokeStyle = '#ffe36a'; g.lineWidth = 5; g.beginPath(); for (let k = 0; k < 10; k++) { const a = k * TAU / 10; g.moveTo(280 + Math.cos(a) * 44, -84 + Math.sin(a) * 44); g.lineTo(280 + Math.cos(a) * 58, -84 + Math.sin(a) * 58); } g.stroke();
    const C = ['#ef6f5e', '#f7cf4a', '#6cc27a', '#5aa0e6', '#f3a6c0'];                       // chemin de cases qui serpente vers l'horizon
    for (let k = 0; k < 16; k++) { const u = k / 15, x = -330 + u * 560, y = 110 - u * 70 + Math.sin(u * 9) * 26, s = 26 - u * 12; g.fillStyle = C[k % 5]; g.beginPath(); U.rr(g, x - s, y - s * 0.6, s * 2, s * 1.2, 4); g.fill(); g.strokeStyle = 'rgba(60,40,20,0.45)'; g.lineWidth = 1.5; g.stroke(); }
    g.fillStyle = '#ffffff'; g.beginPath(); U.oval(g, 190, 60, 44, 28); g.fill();               // l'oie
    g.beginPath(); U.oval(g, 226, 22, 12, 30); g.fill(); g.beginPath(); g.arc(232, -6, 15, 0, TAU); g.fill();
    g.fillStyle = '#f39a1e'; g.beginPath(); g.moveTo(244, -10); g.lineTo(266, -4); g.lineTo(244, 2); g.closePath(); g.fill();
    g.fillStyle = '#1a1a1a'; g.beginPath(); g.arc(236, -10, 3, 0, TAU); g.fill();
    g.fillStyle = '#e8322a'; g.beginPath(); U.rr(g, -70, 60, 64, 30, 10); g.fill(); g.fillStyle = '#9fd3f5'; g.fillRect(-40, 64, 18, 22);   // petite voiture
    g.fillStyle = '#1a1a1a'; g.fillRect(-62, 56, 12, 6); g.fillRect(-24, 56, 12, 6); g.fillRect(-62, 88, 12, 6); g.fillRect(-24, 88, 12, 6);
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
    g.font = 'bold 64px sans-serif'; g.lineWidth = 12; g.strokeStyle = '#7a1414'; g.strokeText('LA COURSE', -110, -76); g.fillStyle = '#ffd23a'; g.fillText('LA COURSE', -110, -76);
    g.font = 'bold 46px sans-serif'; g.lineWidth = 10; g.strokeText("DE L'OIE", -110, -18); g.fillStyle = '#ffffff'; g.fillText("DE L'OIE", -110, -18);
    g.font = 'bold 18px sans-serif'; g.fillStyle = '#7a1414'; g.fillText('2 à 10 joueurs · dès 6 ans', 220, 112);
  },
  feuille(g, d, R, U) {                                // feuille de scores, crayon posé dessus
    g.rotate(0.07);
    g.fillStyle = 'rgba(40,24,10,0.3)'; g.fillRect(-142, -212, 300, 440);
    g.fillStyle = '#fdfcf4'; g.fillRect(-150, -220, 300, 440);
    g.fillStyle = '#ffe9a0'; g.fillRect(-150, -220, 300, 60);
    g.fillStyle = '#5a3a1a'; g.font = 'bold 30px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('SCORES', 0, -190);
    g.strokeStyle = 'rgba(70,120,200,0.45)'; g.lineWidth = 2; g.beginPath(); for (let y = -120; y < 220; y += 40) { g.moveTo(-150, y); g.lineTo(150, y); } g.stroke();
    g.strokeStyle = 'rgba(220,60,60,0.55)'; g.beginPath(); g.moveTo(-50, -160); g.lineTo(-50, 220); g.moveTo(50, -160); g.lineTo(50, 220); g.stroke();
    g.fillStyle = '#3a3c48'; g.font = 'bold 22px sans-serif'; g.fillText('LÉA', -100, -140); g.fillText('TOM', 0, -140); g.fillText('NINA', 100, -140);
    g.font = 'italic 24px serif'; g.fillStyle = 'rgba(60,62,74,0.85)';
    const V = [[12, 9, 15], [20, 17, 22], [31, 29, 30], [38, 41, 36], [47, 52, 49], [63, 58, 61]];
    for (let r = 0; r < V.length; r++) for (let q = 0; q < 3; q++) g.fillText(String(V[r][q]), -100 + q * 100 + (R() - 0.5) * 8, -100 + r * 40);
    g.strokeStyle = 'rgba(60,62,74,0.7)'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(-90, 160); g.lineTo(-30, 168); g.moveTo(10, 150); g.lineTo(80, 158); g.stroke();
    g.save(); g.translate(40, 120); g.rotate(-0.9);                                              // crayon à papier
    g.fillStyle = 'rgba(40,24,10,0.3)'; g.fillRect(-120, -4, 250, 18);
    g.fillStyle = '#f2c230'; g.fillRect(-100, -9, 200, 18); g.fillStyle = '#d9a514'; g.fillRect(-100, -2, 200, 5);
    g.fillStyle = '#c3c7cc'; g.fillRect(100, -9, 12, 18); g.fillStyle = '#f08aa0'; g.beginPath(); U.rr(g, 110, -9, 20, 18, 5); g.fill();
    g.fillStyle = '#e8c79a'; g.beginPath(); g.moveTo(-100, -9); g.lineTo(-126, 0); g.lineTo(-100, 9); g.closePath(); g.fill();
    g.fillStyle = '#333'; g.beginPath(); g.moveTo(-117, -3.5); g.lineTo(-126, 0); g.lineTo(-117, 3.5); g.closePath(); g.fill();
    g.restore();
  },
  jetons(g, d, R, U) {                                 // piles de jetons, quelques-uns éparpillés
    const C = ['#d8261d', '#1f4fcf', '#16884a', '#222226', '#f2f0e8'];
    const pile = (x, y, n, col) => {
      for (let k = 0; k < n; k++) {
        const yy = y - k * 7, dk = U.rgbStr(U.mix(U.hexRgb(col), [0, 0, 0], 0.35));
        if (!k) { g.fillStyle = 'rgba(40,24,10,0.3)'; g.beginPath(); g.arc(x + 8, yy + 10, 36, 0, TAU); g.fill(); }
        g.fillStyle = dk; g.beginPath(); g.arc(x, yy + 4, 34, 0, TAU); g.fill();
        g.fillStyle = col; g.beginPath(); g.arc(x, yy, 34, 0, TAU); g.fill();
      }
      const yt = y - (n - 1) * 7;
      g.strokeStyle = col === '#f2f0e8' ? '#c8261d' : '#ffffff'; g.lineWidth = 6; g.setLineDash([9, 9]); g.beginPath(); g.arc(x, yt, 28, 0, TAU); g.stroke(); g.setLineDash([]);
      g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 2; g.beginPath(); g.arc(x, yt, 18, 0, TAU); g.stroke();
    };
    pile(-60, 10, 6, C[0]); pile(20, -30, 4, C[1]); pile(50, 50, 8, C[3]); pile(-20, 80, 3, C[2]);
    pile(-110, -60, 1, C[4]); pile(110, -40, 1, C[0]);
  },
  roue(g, d, R, U) {                                   // roue de hasard (toupie à flèche) sur son carton
    g.rotate(0.12);
    g.fillStyle = 'rgba(40,24,10,0.3)'; g.beginPath(); U.rr(g, -106, -100, 220, 220, 26); g.fill();
    g.fillStyle = '#fbfaf2'; g.beginPath(); U.rr(g, -114, -110, 220, 220, 26); g.fill(); g.strokeStyle = '#2a4f9a'; g.lineWidth = 6; g.stroke();
    const C = ['#ef6f5e', '#f7cf4a', '#6cc27a', '#5aa0e6', '#b77ad8', '#f39a4a'];
    for (let k = 0; k < 6; k++) { g.fillStyle = C[k]; g.beginPath(); g.moveTo(-4, 0); g.arc(-4, 0, 88, k * TAU / 6, (k + 1) * TAU / 6); g.closePath(); g.fill(); }
    g.strokeStyle = '#ffffff'; g.lineWidth = 3; g.beginPath(); g.arc(-4, 0, 88, 0, TAU); g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.92)'; g.font = 'bold 30px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let k = 0; k < 6; k++) { const a = (k + 0.5) * TAU / 6; g.fillText(String(k + 1), -4 + Math.cos(a) * 60, Math.sin(a) * 60); }
    g.save(); g.translate(-4, 0); g.rotate(-0.8);                                              // flèche noire
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.moveTo(6, -6 + 4); g.lineTo(80, 4); g.lineTo(6, 10); g.closePath(); g.fill();
    g.fillStyle = '#1a1a1a'; g.beginPath(); g.moveTo(-26, -7); g.lineTo(76, 0); g.lineTo(-26, 7); g.closePath(); g.fill();
    g.restore();
    g.fillStyle = '#c9ced6'; g.beginPath(); g.arc(-4, 0, 11, 0, TAU); g.fill(); g.fillStyle = '#ffffff'; g.beginPath(); g.arc(-7, -3, 4, 0, TAU); g.fill();
  },
  pioche(g, d, R, U) {                                 // pioche de cartes « Chance » et une carte retournée
    for (let k = 0; k < 5; k++) carte(g, U, -60 + k * 1.5, -k * 3, -0.12, true);
    g.save(); g.translate(60, 20); g.rotate(0.22);
    g.fillStyle = 'rgba(40,24,10,0.28)'; g.beginPath(); U.rr(g, -66, -42, 140, 96, 8); g.fill();
    g.fillStyle = '#fff6d8'; g.beginPath(); U.rr(g, -70, -48, 140, 96, 8); g.fill(); g.strokeStyle = '#ef7a1a'; g.lineWidth = 4; g.stroke();
    g.fillStyle = '#c0420e'; g.font = 'bold 22px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('CHANCE', 0, -24);
    g.fillStyle = '#4a3a2a'; g.font = '15px sans-serif'; g.fillText('Avancez de', 0, 4); g.fillText('3 cases', 0, 24);
    g.restore();
  },
  oie(g, d, R, U) {                                    // figurine d'oie (pion du jeu de l'oie) sur son socle vert
    g.fillStyle = 'rgba(40,24,10,0.3)'; g.beginPath(); g.arc(10, 14, 62, 0, TAU); g.fill();
    g.fillStyle = '#2e8a3a'; g.beginPath(); g.arc(0, 0, 62, 0, TAU); g.fill(); g.fillStyle = '#4cb05a'; g.beginPath(); g.arc(-3, -4, 54, 0, TAU); g.fill();
    g.fillStyle = 'rgba(0,0,0,0.18)'; g.beginPath(); U.oval(g, 4, 8, 40, 30); g.fill();
    g.fillStyle = '#ffffff'; g.beginPath(); U.oval(g, -6, 4, 40, 28); g.fill();
    g.fillStyle = '#e6e8ee'; g.beginPath(); U.oval(g, -14, 8, 22, 14); g.fill();                 // aile
    g.fillStyle = '#ffffff'; g.beginPath(); U.oval(g, 22, -14, 10, 16); g.fill(); g.beginPath(); g.arc(28, -30, 14, 0, TAU); g.fill();
    g.fillStyle = '#f39a1e'; g.beginPath(); g.moveTo(38, -36); g.lineTo(58, -30); g.lineTo(38, -24); g.closePath(); g.fill();
    g.fillStyle = '#1a1a1a'; g.beginPath(); g.arc(32, -34, 3, 0, TAU); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.6)'; g.beginPath(); U.oval(g, -18, -10, 14, 6); g.fill();
  },
  regles(g, d, R, U) {                                 // règle du jeu : livret ouvert, texte et petits schémas
    g.rotate(0.14);
    g.fillStyle = 'rgba(40,24,10,0.3)'; g.fillRect(-142, -92, 292, 196);
    g.fillStyle = '#fdfbf2'; g.fillRect(-150, -100, 146, 196); g.fillStyle = '#f6f2e4'; g.fillRect(-4, -100, 146, 196);
    g.fillStyle = 'rgba(0,0,0,0.1)'; g.fillRect(-8, -100, 8, 196);
    g.fillStyle = '#a3191f'; g.font = 'bold 18px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('RÈGLE DU JEU', -76, -78);
    g.fillStyle = 'rgba(70,70,84,0.45)'; for (let k = 0; k < 9; k++) { g.fillRect(-136, -56 + k * 16, 70 + R() * 50, 5); if (k < 5) g.fillRect(10, -82 + k * 16, 60 + R() * 60, 5); }
    de(g, U, 40, 42, 16, 0.3, 4); g.strokeStyle = '#2f7ff0'; g.lineWidth = 4; g.beginPath(); g.moveTo(62, 42); g.quadraticCurveTo(96, 10, 116, 44); g.stroke();
    g.fillStyle = '#2f7ff0'; g.beginPath(); g.moveTo(108, 34); g.lineTo(120, 50); g.lineTo(122, 30); g.closePath(); g.fill();
  },
  maisons(g, d, R, U) {                                // maisons vertes et hôtels rouges, alignés au bord du plateau
    const piece = (x, y, w, col) => {
      g.fillStyle = 'rgba(40,24,10,0.3)'; g.fillRect(x - w / 2 + 4, y - 15, w, 34);
      g.fillStyle = col; g.fillRect(x - w / 2, y - 19, w, 34);
      g.fillStyle = 'rgba(255,255,255,0.3)'; g.fillRect(x - w / 2, y - 19, w, 15);
      g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 2; g.beginPath(); g.moveTo(x - w / 2, y - 3); g.lineTo(x + w / 2, y - 3); g.stroke();
    };
    for (let k = 0; k < 4; k++) piece(-22 + (k % 2) * 44, -110 + Math.floor(k / 2) * 52, 34, '#2bb45a');
    piece(0, 10, 72, '#d8261d'); piece(0, 62, 72, '#d8261d');
    piece(-22, 116, 34, '#2bb45a');
  },
  des(g, d, R, U) { de(g, U, -40, 0, 30, 0.4, 5); de(g, U, 34, 22, 30, -0.3, 2); de(g, U, 6, -52, 22, 0.9, 6, '#d8261d'); },
  pions(g, d, R, U) {                                  // pions de réserve, rangés au bord du plateau
    const C = ['#e8322a', '#2f7ff0', '#2bb45a', '#ffd23a', '#b062d8', '#f39a1e'];
    for (let k = 0; k < 6; k++) pion(g, U, (k % 2) * 56 - 28, Math.floor(k / 2) * 62 - 62, 24, C[k]);
  },
};

// plateau peint : 100 cases pastel numérotées en boustrophédon, échelles et serpents imprimés, cadre bleu doré, pli
function echellePeinte(g, x1, y1, x2, y2) {
  const L = Math.hypot(x2 - x1, y2 - y1);
  g.save(); g.translate(x1, y1); g.rotate(Math.atan2(y2 - y1, x2 - x1));
  g.fillStyle = 'rgba(168,104,40,0.42)'; g.fillRect(0, -40, L, 12); g.fillRect(0, 28, L, 12);
  for (let k = 26; k < L - 10; k += 46) g.fillRect(k, -30, 12, 60);
  g.restore();
}
function serpentPeint(g, P, col) {
  g.save(); g.lineCap = 'round'; g.lineJoin = 'round';
  const voie = () => { g.beginPath(); g.moveTo(P[0][0], P[0][1]); for (let k = 1; k + 1 < P.length; k += 2) g.quadraticCurveTo(P[k][0], P[k][1], P[k + 1][0], P[k + 1][1]); };
  voie(); g.strokeStyle = col; g.lineWidth = 46; g.stroke();
  voie(); g.strokeStyle = 'rgba(255,240,150,0.55)'; g.lineWidth = 14; g.setLineDash([22, 26]); g.stroke(); g.setLineDash([]);
  const h = P[P.length - 1], q = P[P.length - 2], a = Math.atan2(h[1] - q[1], h[0] - q[0]);
  g.translate(h[0], h[1]); g.rotate(a);
  g.fillStyle = col; g.beginPath(); g.moveTo(-10, -30); g.quadraticCurveTo(56, -36, 56, 0); g.quadraticCurveTo(56, 36, -10, 30); g.closePath(); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.8)'; g.beginPath(); g.arc(28, -15, 8, 0, TAU); g.arc(28, 15, 8, 0, TAU); g.fill();
  g.fillStyle = 'rgba(30,20,10,0.7)'; g.beginPath(); g.arc(31, -15, 4, 0, TAU); g.arc(31, 15, 4, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(210,40,40,0.6)'; g.lineWidth = 4; g.beginPath(); g.moveTo(56, 0); g.lineTo(78, 0); g.lineTo(88, -8); g.moveTo(78, 0); g.lineTo(88, 8); g.stroke();
  g.restore();
}
function plateauPeint(g, c, R, U) {
  const t = c.table, W = t.x1 - t.x0, H = t.y1 - t.y0, m = 46, ix = t.x0 + m, iy = t.y0 + m, iw = W - 2 * m, ih = H - 2 * m, s = iw / 10, sh = ih / 10;
  g.fillStyle = '#1b356f'; g.fillRect(t.x0, t.y0, W, H);
  const PAS = ['#f7d9cf', '#fbeeb0', '#d6ecc8', '#d4e2f4', '#f3d6e6'];
  g.textAlign = 'left'; g.textBaseline = 'top'; g.font = 'bold 64px sans-serif';
  for (let r = 0; r < 10; r++) for (let q = 0; q < 10; q++) {
    const x = ix + q * s, y = iy + (9 - r) * sh, num = r * 10 + (r % 2 ? 10 - q : q + 1);
    g.fillStyle = (q + r) % 2 ? '#f6ecd2' : PAS[(r * 3 + q) % 5]; g.fillRect(x, y, s, sh);
    g.fillStyle = 'rgba(110,76,36,0.16)'; g.fillText(String(num), x + 16, y + 14);
  }
  g.fillStyle = 'rgba(120,90,40,0.05)'; for (let k = 0; k < 2600; k++) g.fillRect(ix + R() * iw, iy + R() * ih, 3, 3);   // grain du carton
  g.strokeStyle = 'rgba(120,88,48,0.28)'; g.lineWidth = 3; g.beginPath();
  for (let k = 1; k < 10; k++) { g.moveTo(ix + k * s, iy); g.lineTo(ix + k * s, iy + ih); g.moveTo(ix, iy + k * sh); g.lineTo(ix + iw, iy + k * sh); }
  g.stroke();
  // échelles et serpents imprimés dans les creux du serpentin (la piste passe par-dessus)
  echellePeinte(g, 2010, 1880, 2010, 1060); echellePeinte(g, 860, 2080, 860, 1240); echellePeinte(g, 1500, 2560, 1900, 2260);
  serpentPeint(g, [[1590, 1880], [1460, 1720], [1590, 1560], [1720, 1400], [1600, 1180], [1480, 1000], [1600, 860]], 'rgba(58,150,70,0.5)');
  serpentPeint(g, [[2420, 820], [2520, 1000], [2420, 1180], [2320, 1360], [2420, 1540], [2520, 1720], [2420, 1900]], 'rgba(150,70,180,0.42)');
  serpentPeint(g, [[300, 2860], [500, 2860], [700, 2840], [1000, 2820], [1200, 2880]], 'rgba(220,90,40,0.4)');
  // cadre : filets dorés, coins ornés, pli du plateau
  g.strokeStyle = '#d7b04e'; g.lineWidth = 6; g.strokeRect(ix - 2, iy - 2, iw + 4, ih + 4);
  g.strokeStyle = 'rgba(215,176,78,0.6)'; g.lineWidth = 2; g.strokeRect(t.x0 + 14, t.y0 + 14, W - 28, H - 28);
  g.fillStyle = '#d7b04e'; for (const q of [[t.x0 + 23, t.y0 + 23], [t.x1 - 23, t.y0 + 23], [t.x0 + 23, t.y1 - 23], [t.x1 - 23, t.y1 - 23]]) { g.beginPath(); g.moveTo(q[0], q[1] - 12); g.lineTo(q[0] + 12, q[1]); g.lineTo(q[0], q[1] + 12); g.lineTo(q[0] - 12, q[1]); g.closePath(); g.fill(); }
  const cx = t.x0 + W / 2;
  g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(cx - 4, t.y0, 7, H); g.fillStyle = 'rgba(255,255,255,0.14)'; g.fillRect(cx + 3, t.y0, 3, H);
  const lum = g.createRadialGradient(t.x0 + W * 0.42, t.y0 + H * 0.4, 200, t.x0 + W / 2, t.y0 + H / 2, W * 0.75);
  lum.addColorStop(0, 'rgba(255,248,225,0.10)'); lum.addColorStop(1, 'rgba(60,36,12,0.2)'); g.fillStyle = lum; g.fillRect(t.x0, t.y0, W, H);
}
// chemin de cases numérotées (une case ★ toutes les 9), liseré clair au bord, cases turbo bleu nuit sous les flèches jaunes
function pistePlateau(g, c, R, U) {
  const W = c.W, n = c.n, st = 7, COLS = ['#ef6f5e', '#f7cf4a', '#6cc27a', '#5aa0e6', '#f3a6c0'];
  g.save(); g.translate(5, 8); U.centerStroke(g, c, 2 * W + 14, 'rgba(40,24,10,0.25)'); g.restore();   // ombre du ruban de carton
  U.centerStroke(g, c, 2 * W + 14, '#3b2a1a');
  g.lineJoin = 'round'; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (let i = 0, m = 0; i < n; i += st, m++) {
    const e = Math.min(i + st, n), star = m % 9 === 8;
    g.beginPath();
    for (let q = i; q <= e; q++) { const j = q % n; g.lineTo(c.sx[j] + c.nx[j] * W, c.sy[j] + c.ny[j] * W); }
    for (let q = e; q >= i; q--) { const j = q % n; g.lineTo(c.sx[j] - c.nx[j] * W, c.sy[j] - c.ny[j] * W); }
    g.closePath(); g.fillStyle = star ? '#fbfbf6' : COLS[m % COLS.length]; g.fill();
    g.strokeStyle = '#3b2a1a'; g.lineWidth = 3; g.stroke();
    const k = (i + Math.floor((e - i) / 2)) % n;
    g.save(); g.translate(c.sx[k], c.sy[k]); g.rotate(Math.atan2(c.ty[k], c.tx[k]) + Math.PI / 2);
    if (star) { g.fillStyle = '#e0a82a'; g.font = 'bold 44px sans-serif'; g.fillText('★', 0, 2); }
    else { g.fillStyle = 'rgba(40,28,16,0.3)'; g.font = 'bold 24px sans-serif'; g.fillText(String(m + 1), 0, 1); }
    g.restore();
  }
  for (const side of [-1, 1]) { g.strokeStyle = 'rgba(255,250,235,0.7)'; g.lineWidth = 3; U.trackPath(g, c, (W - 6) * side); g.stroke(); }
  for (const z of c.zones) if (z[4] === 'boost') {
    g.save(); g.translate(z[0], z[1]); g.rotate(z[5]);
    g.fillStyle = '#1b356f'; g.beginPath(); U.rr(g, -52, -W + 4, 104, 2 * W - 8, 10); g.fill();
    g.strokeStyle = '#d7b04e'; g.lineWidth = 4; g.stroke();
    g.fillStyle = 'rgba(255,210,58,0.35)'; for (const sy of [-1, 1]) { g.beginPath(); g.arc(0, sy * (W - 24), 7, 0, TAU); g.fill(); }
    g.restore();
  }
}
const OBJETS = {
  de(g, r, R, U) {                                     // gros dé : tranche visible dessous, face bombée, points (le 1 en rouge)
    const x = r[0], y = r[1], s = r[2], h = s * 0.78, v = 1 + Math.floor(R() * 6), a = R() * Math.PI;
    g.save(); g.translate(x + 9, y + 13); g.rotate(a); g.fillStyle = 'rgba(40,24,10,0.32)'; g.beginPath(); U.rr(g, -h, -h, 2 * h, 2 * h, h * 0.34); g.fill(); g.restore();
    g.save(); g.translate(x, y + 7); g.rotate(a); g.fillStyle = '#c9c1ac'; g.beginPath(); U.rr(g, -h, -h, 2 * h, 2 * h, h * 0.34); g.fill(); g.restore();
    g.save(); g.translate(x, y); g.rotate(a);
    const gr = g.createLinearGradient(-h, -h, h, h); gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, '#e6e0d0');
    g.fillStyle = gr; g.beginPath(); U.rr(g, -h, -h, 2 * h, 2 * h, h * 0.34); g.fill(); g.strokeStyle = 'rgba(60,40,20,0.25)'; g.lineWidth = 1.5; g.stroke();
    points(g, v, h); g.restore();
  },
  sablier(g, r, R, U) {                                // sablier couché : deux ampoules de verre, sable, montants et flasques de bois
    const x = r[0], y = r[1], s = r[2];
    g.save(); g.translate(x, y); g.rotate(-0.55);
    g.fillStyle = 'rgba(40,24,10,0.3)'; g.beginPath(); U.rr(g, -s * 1.12 + 7, -s * 0.66 + 10, s * 2.24, s * 1.32, 8); g.fill();
    g.fillStyle = 'rgba(205,236,255,0.85)'; g.beginPath(); U.oval(g, -s * 0.5, 0, s * 0.52, s * 0.5); g.fill(); g.beginPath(); U.oval(g, s * 0.5, 0, s * 0.52, s * 0.5); g.fill();
    g.fillRect(-s * 0.12, -s * 0.12, s * 0.24, s * 0.24);
    g.fillStyle = '#e8b45a'; g.beginPath(); U.oval(g, -s * 0.52, s * 0.08, s * 0.4, s * 0.36); g.fill();
    g.beginPath(); U.oval(g, s * 0.62, s * 0.22, s * 0.26, s * 0.16); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.75)'; g.beginPath(); U.oval(g, -s * 0.6, -s * 0.26, s * 0.18, s * 0.07); g.fill(); g.beginPath(); U.oval(g, s * 0.4, -s * 0.26, s * 0.18, s * 0.07); g.fill();
    g.fillStyle = '#6a3a1a'; g.fillRect(-s, -s * 0.62, s * 2, s * 0.12); g.fillRect(-s, s * 0.5, s * 2, s * 0.12);
    g.fillStyle = '#9a5a2a'; for (const sx of [-1, 1]) { g.beginPath(); U.rr(g, sx > 0 ? s * 0.9 : -s * 1.12, -s * 0.66, s * 0.22, s * 1.32, 5); g.fill(); }
    g.fillStyle = 'rgba(255,230,190,0.35)'; g.fillRect(-s * 1.1, -s * 0.62, s * 0.18, s * 0.12); g.fillRect(s * 0.92, -s * 0.62, s * 0.18, s * 0.12);
    g.restore();
  },
};

export default {
  id: 'plateau', nom: 'Jeu de société', emoji: '🎲', sous: 'Jeu de l\'oie géant · serpentin de cases, dés, pions qui renvoient, toupie folle', v: 2,
  w: 3000, h: 3000, surf: 'plateau', edge: 'chute', table: { x0: 40, y0: 40, x1: 2960, y1: 2960, r: 30 }, W: 90,
  pts: PTS,
  mobs: [
    { type: 'toupie', cer: [1600, 1250, 200], r: 26, per: 7 },                     // toupie folle entre deux colonnes : elle mord sur les deux
    { type: 'deroule', seg: [[2400, 1060], [2850, 1060]], r: 34, per: 6.5 },       // gros dé qui roule en travers de la montée
  ],
  boxes: [0.15, 0.5, 0.89],
  bumpers: ['pion'],
  zonesPhysiques: { piege: 'frein', glissante: 'glisse' },
  make(H) {
    H.boostAt(0.025); H.boostAt(0.975); H.boostAt(0.165);                          // turbos : ligne droite du départ (dans les deux sens) et montée
    H.rockAt(0.086, -0.92, 38, 'de');                                              // dé à la corde du grand virage
    H.rockAt(0.705, 0.82, 38, 'de'); H.rockAt(0.735, -0.82, 38, 'de');             // chicane de dés dans la colonne D
    H.rockAt(0.545, -0.6, 36, 'sablier');                                          // sablier au sommet du grand lacet
    H.rockAt(0.435, 0.5, 20, 'pion'); H.rockAt(0.452, -0.5, 20, 'pion'); H.rockAt(0.469, 0.5, 20, 'pion');   // slalom de pions (ils renvoient)
    H.rockAt(0.29, 0.62, 20, 'pion');
    H.wall(2740, 2250, 2740, 1640, 13, 'echelle');                                 // échelle couchée le long de la montée : garde-fou
    H.wall(1720, 2818, 2230, 2818, 13, 'echelle');
    H.zoneAt(0.335, -0.42, 64, 52, 'glissante'); H.zoneAt(0.83, 0.42, 64, 52, 'glissante');   // cases glissantes (une moitié de piste)
    H.zoneAt(0.615, 0.42, 64, 52, 'piege'); H.zoneAt(0.905, -0.42, 64, 52, 'piege');           // cases piège (on s'enlise)
    H.deco(540, 250, 'couvercle'); H.deco(1220, 300, 'cartes'); H.deco(1640, 270, 'gobelet'); H.deco(1800, 360, 'des');
    H.deco(2140, 260, 'roue'); H.deco(2700, 230, 'jetons'); H.deco(270, 1460, 'feuille'); H.deco(270, 2360, 'pioche');
    H.deco(1150, 2420, 'billets'); H.deco(1650, 2420, 'jetons'); H.deco(2150, 2420, 'oie'); H.deco(2860, 800, 'pions'); H.deco(300, 760, 'regles'); H.deco(2870, 1960, 'maisons'); H.deco(860, 2400, 'des');
  },
  dessin: {
    plateau: plateauPeint, piste: pistePlateau, objets: OBJETS,
    decor: DECOR,
    murs: {
      echelle(g, w, R, U) {                            // échelle en bois couchée sur le plateau (comme celles du jeu)
        const x1 = w[0], y1 = w[1], L = Math.hypot(w[2] - x1, w[3] - y1), r = w[4];
        g.save(); g.translate(x1, y1); g.rotate(Math.atan2(w[3] - y1, w[2] - x1));
        g.fillStyle = 'rgba(40,24,10,0.3)'; g.fillRect(-r + 5, -r * 1.5 + 7, L + 2 * r, r * 3);
        g.fillStyle = '#b8742e'; for (let k = 10; k < L; k += 40) g.fillRect(k, -r * 1.25, 10, r * 2.5);
        for (const y of [-r * 1.5, r * 0.8]) { g.fillStyle = '#d99a4e'; g.beginPath(); U.rr(g, -r, y, L + 2 * r, r * 0.7, r * 0.3); g.fill(); g.fillStyle = 'rgba(255,240,200,0.45)'; g.fillRect(-r + 4, y + 1.5, L + 2 * r - 8, 2.5); }
        g.restore();
      },
    },
    zones: {
      piege(g, z, R, U) {                              // case piège : le puits (on s'y enlise)
        g.save(); g.translate(z[0], z[1]); g.rotate(z[5]);
        const a = z[2] * 0.86, b = z[3] * 0.86;
        g.fillStyle = '#3b2a1a'; g.beginPath(); U.rr(g, -a - 5, -b - 5, 2 * a + 10, 2 * b + 10, 12); g.fill();
        g.fillStyle = '#c8302a'; g.beginPath(); U.rr(g, -a, -b, 2 * a, 2 * b, 9); g.fill();
        g.strokeStyle = '#ffd23a'; g.lineWidth = 5; g.setLineDash([12, 8]); g.beginPath(); U.rr(g, -a + 7, -b + 7, 2 * a - 14, 2 * b - 14, 6); g.stroke(); g.setLineDash([]);
        g.fillStyle = '#8a8f98'; g.beginPath(); g.arc(0, 0, b * 0.62, 0, TAU); g.fill();         // margelle du puits
        g.strokeStyle = '#5d636c'; g.lineWidth = 2; g.beginPath(); for (let k = 0; k < 8; k++) { const u = k * TAU / 8; g.moveTo(Math.cos(u) * b * 0.42, Math.sin(u) * b * 0.42); g.lineTo(Math.cos(u) * b * 0.62, Math.sin(u) * b * 0.62); } g.stroke();
        g.fillStyle = '#10141e'; g.beginPath(); g.arc(0, 0, b * 0.42, 0, TAU); g.fill();
        g.fillStyle = 'rgba(90,160,230,0.5)'; g.beginPath(); U.oval(g, -b * 0.1, -b * 0.1, b * 0.18, b * 0.08); g.fill();
        g.restore();
      },
      glissante(g, z, R, U) {                          // case glissante : glace bleue, reflets et peau de banane
        g.save(); g.translate(z[0], z[1]); g.rotate(z[5]);
        const a = z[2] * 0.86, b = z[3] * 0.86;
        g.fillStyle = '#3b2a1a'; g.beginPath(); U.rr(g, -a - 5, -b - 5, 2 * a + 10, 2 * b + 10, 12); g.fill();
        g.fillStyle = '#7fd0f4'; g.beginPath(); U.rr(g, -a, -b, 2 * a, 2 * b, 9); g.fill();
        g.strokeStyle = 'rgba(255,255,255,0.75)'; g.lineWidth = 6; g.lineCap = 'round'; g.beginPath();
        g.moveTo(-a * 0.7, b * 0.2); g.lineTo(-a * 0.2, -b * 0.6); g.moveTo(-a * 0.35, b * 0.6); g.lineTo(a * 0.1, -b * 0.1); g.moveTo(a * 0.3, b * 0.65); g.lineTo(a * 0.7, b * 0.05); g.stroke();
        g.save(); g.translate(a * 0.3, -b * 0.3); g.rotate(0.6);                                     // peau de banane
        g.fillStyle = '#f5d33a'; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(-14, -20, -6, -30); g.quadraticCurveTo(2, -16, 6, 0); g.closePath(); g.fill();
        g.beginPath(); g.moveTo(2, 0); g.quadraticCurveTo(22, -14, 26, -4); g.quadraticCurveTo(14, 0, 4, 6); g.closePath(); g.fill();
        g.beginPath(); g.moveTo(0, 2); g.quadraticCurveTo(-18, 10, -22, 20); g.quadraticCurveTo(-6, 16, 4, 6); g.closePath(); g.fill();
        g.fillStyle = '#6a4a1a'; g.beginPath(); g.arc(2, 2, 4, 0, TAU); g.fill();
        g.restore(); g.restore();
      },
    },
    mobiles: {
      deroule(g, m, o, now, U, reduceFx) {             // gros dé qui roule : la face du dessus bascule, la suivante se relève
        const s = m.r * 0.8, a0 = m.seg[0], dx = m.seg[1][0] - a0[0], dy = m.seg[1][1] - a0[1], l = Math.hypot(dx, dy) || 1;
        const dist = ((o.x - a0[0]) * dx + (o.y - a0[1]) * dy) / l, q = dist / (2 * s), k = Math.floor(q), th = (q - k) * Math.PI / 2;
        const F = [1, 3, 6, 4], v1 = F[((k % 4) + 4) % 4], v2 = F[((k + 1) % 4 + 4) % 4], w1 = 2 * s * Math.cos(th), w2 = 2 * s * Math.sin(th);
        g.save(); g.translate(o.x, o.y); g.rotate(Math.atan2(dy, dx));
        g.fillStyle = 'rgba(40,24,10,0.3)'; g.beginPath(); U.rr(g, -s + 6, -s + 8, w1 + w2, 2 * s, 8); g.fill();
        const x0 = -(w1 + w2) / 2;
        g.fillStyle = '#e2ddcf'; g.fillRect(x0, -s, w2, 2 * s);                                         // face qui se relève (derrière)
        g.fillStyle = '#fbfaf4'; g.beginPath(); U.rr(g, x0 + w2, -s, w1, 2 * s, Math.min(8, w1 / 2)); g.fill();   // face du dessus
        g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 1.5; g.strokeRect(x0, -s, w1 + w2, 2 * s);
        if (w1 > s * 0.5) { g.save(); g.translate(x0 + w2 + w1 / 2, 0); g.scale(w1 / (2 * s), 1); points(g, v1, s); g.restore(); }
        if (w2 > s * 0.5) { g.save(); g.translate(x0 + w2 / 2, 0); g.scale(w2 / (2 * s), 1); points(g, v2, s); g.restore(); }
        g.restore();
      },
    },
  },
};
