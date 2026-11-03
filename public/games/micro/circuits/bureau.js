// Circuit « bureau » de Micro Machines — définition PARTAGÉE serveur / client (géométrie, obstacles, zones, décor).
// Format : voir l'en-tête de ../shared.js ; dessins propres au circuit (propriété `dessin`) : voir ../rendu.js.

// Tracé « à la tortue » : départ (x0, y0) au cap `cap` (degrés : 0 = vers la droite, 90 = vers le bas), puis
// ['L', long] tout droit | ['A', rayon, degrés] arc (> 0 : à droite) | ['M', nom] repère (position notée dans MARQUES).
// Les deux lignes marquées 'fermer' s'allongent (ou raccourcissent) pour refermer la boucle exactement sur le départ.
const MARQUES = {};
function tortue(x0, y0, cap, prog) {
  const marche = (pr, pts) => {
    let x = x0, y = y0, a = cap * Math.PI / 180;
    for (const s of pr) {
      if (s[0] === 'L') {
        const k = Math.max(1, Math.round(s[1] / 90));
        for (let i = 1; i <= k && pts; i++) pts.push([x + Math.cos(a) * s[1] * i / k, y + Math.sin(a) * s[1] * i / k]);
        x += Math.cos(a) * s[1]; y += Math.sin(a) * s[1];
      } else if (s[0] === 'M') { if (pts) MARQUES[s[1]] = [x, y];
      } else {
        const sg = s[2] > 0 ? 1 : -1, R = s[1], da = Math.abs(s[2]) * Math.PI / 180, cx = x - Math.sin(a) * R * sg, cy = y + Math.cos(a) * R * sg;
        const k = Math.max(2, Math.ceil(R * da / 70));
        for (let i = 1; i <= k; i++) { const b = a + sg * da * i / k; if (pts) pts.push([cx + Math.sin(b) * R * sg, cy - Math.cos(b) * R * sg]); }
        a += sg * da; x = cx + Math.sin(a) * R * sg; y = cy - Math.cos(a) * R * sg;
      }
    }
    return { x, y };
  };
  const libres = []; let a = cap * Math.PI / 180;                // cap de chaque ligne libre (il ne dépend pas des longueurs)
  for (const s of prog) { if (s[0] === 'L') { if (s[2] === 'fermer') libres.push(a); } else if (s[0] === 'A') a += s[2] * Math.PI / 180; }
  const e = marche(prog, null), rx = x0 - e.x, ry = y0 - e.y, u = [Math.cos(libres[0]), Math.sin(libres[0])], v = [Math.cos(libres[1]), Math.sin(libres[1])];
  const det = u[0] * v[1] - u[1] * v[0], d1 = (rx * v[1] - ry * v[0]) / det, d2 = (u[0] * ry - u[1] * rx) / det;
  let n = 0;
  const pr = prog.map(s => (s[2] === 'fermer' ? ['L', s[1] + (n++ ? d2 : d1)] : s));
  const pts = [[x0, y0]];
  marche(pr, pts);
  pts.pop();                                                    // le dernier point retombe sur le départ
  return pts.map(p => [Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10]);
}
// escargot : double spirale en demi-cercles, spires à 240 u l'une de l'autre — on s'enroule à droite (demi-tour de 400 u
// puis 140 u), « S » serré au cœur (140 u à gauche), on se déroule à gauche (400 u, puis un quart de tour de 640 u)
const ESCARGOT = [['A', 400, 180], ['A', 140, 180], ['A', 140, -180], ['A', 400, -180], ['A', 640, -90]];

const PTS = tortue(1980, 2250, -90, [].concat(
  [['L', 650, 'fermer'], ['A', 300, -90], ['L', 800]],                          // règle du départ (turbo), virage, règle du haut (turbo)
  [['M', 'escargot']], ESCARGOT,                                                // l'escargot, en haut à gauche du cahier
  [['L', 450], ['A', 250, -90]],                                                // on en sort par la marge, vers le bas
  [['A', 320, 35], ['A', 320, -70], ['A', 320, 35], ['L', 200]],                // le grand S : première traversée ondulée
  [['A', 200, 180], ['L', 150]],                                                // épingle de droite
  [['A', 250, -40], ['A', 250, 80], ['A', 250, -40]],                           // deuxième traversée : baïonnette
  [['A', 220, -180]],                                                           // épingle de gauche
  [['A', 450, 60], ['A', 450, -60], ['L', 250, 'fermer'], ['A', 300, -90], ['L', 360]]));   // longue descente, virage du départ

const TAU = Math.PI * 2;
const COULEURS = ['#e8322a', '#f39a1e', '#ffd23a', '#2bb45a', '#1f9fd8', '#2f5fd0', '#9a4fd0', '#e86aa8'];
// ombre portée douce en deux couches (lumière en haut à gauche) ; trace() construit le chemin, k = hauteur de l'objet
function ombre(g, trace, k) {
  k = k || 1;
  g.save(); g.translate(9 * k, 12 * k); g.fillStyle = 'rgba(40,24,10,0.14)'; g.beginPath(); trace(); g.fill();
  g.translate(-4 * k, -6 * k); g.fillStyle = 'rgba(40,24,10,0.22)'; g.beginPath(); trace(); g.fill(); g.restore();
}
// décalage d'ombre (dx, dy du monde) exprimé dans un repère tourné de a
const dec = (a, dx, dy) => [dx * Math.cos(a) + dy * Math.sin(a), -dx * Math.sin(a) + dy * Math.cos(a)];
// crayon de couleur couché de x à x + L (pointe vers +x), demi-épaisseur h : corps à pans, bois taillé, mine
function crayonCouleur(g, x, y, L, h, col) {
  const b = L - h * 3;
  g.fillStyle = col; g.fillRect(x, y - h, b, 2 * h);
  g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(x, y + h * 0.3, b, h * 0.7);
  g.fillStyle = 'rgba(255,255,255,0.32)'; g.fillRect(x, y - h * 0.72, b, h * 0.36);
  g.fillStyle = '#eed5a8'; g.beginPath(); g.moveTo(x + b, y - h); g.lineTo(x + L, y); g.lineTo(x + b, y + h); g.closePath(); g.fill();
  g.fillStyle = col; g.beginPath(); g.moveTo(x + L - h * 1.15, y - h * 0.38); g.lineTo(x + L, y); g.lineTo(x + L - h * 1.15, y + h * 0.38); g.closePath(); g.fill();
  g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x, y - h, 2, 2 * h);
}
function texte(g, s, x, y, font, col, align) { g.font = font; g.fillStyle = col; g.textAlign = align || 'center'; g.textBaseline = 'middle'; g.fillText(s, x, y); }

// ── le bureau : hêtre clair, copie double à grands carreaux (Seyès), marge rouge, devoirs et gribouillis au crayon ──
function bureauPeint(g, c, R, U) {
  const t = c.table, W = t.x1 - t.x0, H = t.y1 - t.y0;
  g.fillStyle = '#b77b45'; g.fillRect(t.x0, t.y0, W, H);
  for (let k = 0; k < 9; k++) {                                       // lames de hêtre et veinage
    const x = t.x0 + k * W / 9;
    g.fillStyle = k % 2 ? 'rgba(255,220,170,0.08)' : 'rgba(90,50,20,0.06)'; g.fillRect(x, t.y0, W / 9, H);
    g.strokeStyle = 'rgba(90,50,20,0.16)'; g.lineWidth = 2; g.beginPath();
    for (let v = 0; v < 4; v++) { const xx = x + 20 + v * 56 + R() * 20; g.moveTo(xx, t.y0); for (let y = t.y0; y <= t.y1; y += 120) g.lineTo(xx + Math.sin(y / 260 + v + k) * 7, y); }
    g.stroke(); g.fillStyle = 'rgba(60,30,10,0.35)'; g.fillRect(x - 1.5, t.y0, 3, H);
  }
  const x0 = t.x0 + 44, y0 = t.y0 + 40, pw = W - 88, ph = H - 80;
  g.save(); g.translate(x0 + pw / 2, y0 + ph / 2); g.rotate(-0.025);                  // feuille de brouillon glissée dessous
  g.fillStyle = 'rgba(40,24,10,0.2)'; g.fillRect(-pw / 2 + 20, -ph / 2 + 30, pw, ph);
  g.fillStyle = '#f1efe4'; g.fillRect(-pw / 2 + 12, -ph / 2 + 18, pw, ph); g.restore();
  g.fillStyle = 'rgba(40,24,10,0.25)'; g.fillRect(x0 + 8, y0 + 12, pw, ph);
  g.fillStyle = '#fdfcf6'; g.fillRect(x0, y0, pw, ph);
  g.lineWidth = 1; g.strokeStyle = 'rgba(120,160,215,0.2)'; g.beginPath();           // Seyès : lignes fines tous les 10 u
  for (let y = y0 + 90; y < y0 + ph; y += 10) { g.moveTo(x0, y); g.lineTo(x0 + pw, y); }
  g.stroke();
  g.lineWidth = 1.6; g.strokeStyle = 'rgba(110,96,200,0.4)'; g.beginPath();          // lignes fortes et verticales tous les 40 u
  for (let y = y0 + 90; y < y0 + ph; y += 40) { g.moveTo(x0, y); g.lineTo(x0 + pw, y); }
  for (let x = 240 + 40; x < x0 + pw; x += 40) { g.moveTo(x, y0 + 90); g.lineTo(x, y0 + ph); }
  g.stroke();
  g.strokeStyle = 'rgba(225,50,60,0.75)'; g.lineWidth = 3; g.beginPath(); g.moveTo(240, y0); g.lineTo(240, y0 + ph); g.stroke();   // la marge
  g.fillStyle = 'rgba(0,0,0,0.07)'; g.fillRect(x0 + pw / 2 - 5, y0, 10, ph);                                                       // pli de la copie double
  g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(x0 + pw / 2 + 5, y0, 3, ph);
  // en-tête et devoirs
  texte(g, 'Lundi 3 novembre', 1420, 132, 'italic 36px Georgia, serif', 'rgba(30,60,170,0.85)', 'left');
  texte(g, 'Géométrie — ex. 1 : trace l\'escargot au compas', 300, 140, 'italic 26px Georgia, serif', 'rgba(70,72,84,0.75)', 'left');
  g.strokeStyle = 'rgba(30,60,170,0.6)'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(1420, 158); g.lineTo(1720, 156); g.stroke();
  const ops = ['12 × 8 = 96', '144 ÷ 12 = 12', '7 + 5 + 8 = 20', '3,5 × 2 = 7'];
  for (let k = 0; k < ops.length; k++) texte(g, ops[k], 1290 + (k % 2) * 30, 2270 + k * 52 + R() * 6, 'italic 28px Georgia, serif', 'rgba(70,72,84,0.7)', 'left');
  g.strokeStyle = 'rgba(225,50,60,0.75)'; g.lineWidth = 3; g.beginPath(); g.moveTo(1560, 2300); g.lineTo(1574, 2318); g.lineTo(1600, 2280); g.stroke();   // ✓ de la maîtresse
  g.strokeStyle = 'rgba(70,72,84,0.55)'; g.lineWidth = 2.5; g.beginPath();            // spirale gribouillée
  for (let k = 0; k < 90; k++) { const u = k * 0.22, r = 3 + u * 6.5; const x = 1120 + Math.cos(u) * r, y = 2400 + Math.sin(u) * r; if (k) g.lineTo(x, y); else g.moveTo(x, y); }
  g.stroke();
  g.strokeStyle = 'rgba(245,190,30,0.85)'; g.lineWidth = 6; g.lineCap = 'round'; g.beginPath(); g.arc(250, 2660, 46, 0, TAU);   // soleil au crayon gras
  for (let k = 0; k < 12; k++) { const u = k * TAU / 12; g.moveTo(250 + Math.cos(u) * 62, 2660 + Math.sin(u) * 62); g.lineTo(250 + Math.cos(u) * 90, 2660 + Math.sin(u) * 90); }
  g.stroke();
  g.strokeStyle = 'rgba(225,60,90,0.8)'; g.lineWidth = 5; g.beginPath(); g.moveTo(880, 3215); g.bezierCurveTo(830, 3170, 850, 3125, 880, 3150); g.bezierCurveTo(910, 3125, 930, 3170, 880, 3215); g.stroke();   // cœur
  g.strokeStyle = 'rgba(70,72,84,0.6)'; g.lineWidth = 3; g.lineJoin = 'round'; g.beginPath();   // petite maison
  g.moveTo(560, 3230); g.lineTo(560, 3170); g.lineTo(600, 3135); g.lineTo(640, 3170); g.lineTo(640, 3230); g.closePath(); g.rect(588, 3195, 22, 35); g.stroke();
  // traces de la gomme qui va et vient (sous la piste)
  for (const m of c.mobs) if (m.type === 'gommeuse') {
    g.fillStyle = 'rgba(160,160,175,0.12)'; g.beginPath(); U.rr(g, m.seg[0][0] - 30, m.seg[1][1] - 20, 60, m.seg[0][1] - m.seg[1][1] + 50, 20); g.fill();
    for (let k = 0; k < 40; k++) { g.fillStyle = 'rgba(' + (R() < 0.5 ? '248,170,190' : '150,150,160') + ',0.7)'; g.fillRect(m.seg[0][0] - 50 + R() * 100, m.seg[1][1] - 20 + R() * (m.seg[0][1] - m.seg[1][1] + 60), 3 + R() * 3, 2 + R() * 2); }
  }
}

// piste tracée au crayon sur la copie : ruban gommé clair, vibreurs au crayon de couleur dans les virages serrés,
// bords à la mine de plomb doublés, axe en pointillé au stylo bleu, flèches de sens
function pisteCrayon(g, c, R, U) {
  const W = c.W, n = c.n;
  U.centerStroke(g, c, 2 * W + 6, 'rgba(110,112,130,0.12)');
  U.centerStroke(g, c, 2 * W, 'rgba(238,240,248,0.9)');
  g.lineCap = 'butt'; g.lineWidth = 10;
  for (let i = 0; i < n; i += 3) {
    if (Math.abs(c.k[i]) < 1 / 330) continue;
    const j = (i + 3) % n;
    for (const s of [-1, 1]) {
      g.strokeStyle = (i / 3) % 2 ? 'rgba(232,50,42,0.72)' : 'rgba(47,95,208,0.55)'; g.beginPath();
      g.moveTo(c.sx[i] + c.nx[i] * (W - 6) * s, c.sy[i] + c.ny[i] * (W - 6) * s); g.lineTo(c.sx[j] + c.nx[j] * (W - 6) * s, c.sy[j] + c.ny[j] * (W - 6) * s); g.stroke();
    }
  }
  g.lineJoin = 'round';
  for (const s of [-1, 1]) {
    g.strokeStyle = 'rgba(55,57,68,0.82)'; g.lineWidth = 3.2; g.beginPath();
    for (let i = 0; i <= n; i++) { const j = i % n, o = (W + Math.sin(j * 0.7) * 1.4) * s, x = c.sx[j] + c.nx[j] * o, y = c.sy[j] + c.ny[j] * o; if (i) g.lineTo(x, y); else g.moveTo(x, y); }
    g.stroke();
    g.strokeStyle = 'rgba(55,57,68,0.28)'; g.lineWidth = 1.5; U.trackPath(g, c, (W + 7) * s); g.stroke();
  }
  g.strokeStyle = 'rgba(40,90,200,0.42)'; g.lineWidth = 3; g.setLineDash([16, 26]); U.trackPath(g, c, 0); g.stroke(); g.setLineDash([]);
  g.strokeStyle = 'rgba(60,62,74,0.5)'; g.lineWidth = 3; g.lineCap = 'round';
  for (let i = Math.round(n / 24); i < n; i += Math.round(n / 12)) {
    g.save(); g.translate(c.sx[i], c.sy[i]); g.rotate(Math.atan2(c.ty[i], c.tx[i]));
    g.beginPath(); g.moveTo(-14, -14); g.lineTo(4, 0); g.lineTo(-14, 14); g.stroke(); g.restore();
  }
}

// ── décor posé sur le bureau (dessiné autour de l'origine) ──
const DECOR = {
  trousse(g, d, R, U) {                                // trousse en toile ouverte : doublure, crayons de couleur et feutres
    g.rotate(-0.12);
    ombre(g, () => U.rr(g, -232, -96, 464, 192, 74), 1.3);
    g.fillStyle = '#c8392f'; g.beginPath(); U.rr(g, -232, -96, 464, 192, 74); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.13)'; g.beginPath(); U.rr(g, -220, -88, 440, 66, 40); g.fill();
    g.strokeStyle = 'rgba(255,225,190,0.6)'; g.lineWidth = 3; g.setLineDash([10, 8]); g.beginPath(); U.rr(g, -218, -82, 436, 164, 62); g.stroke(); g.setLineDash([]);
    g.fillStyle = '#4a1612'; g.beginPath(); U.rr(g, -176, -44, 352, 88, 38); g.fill();
    for (let k = 0; k < 7; k++) crayonCouleur(g, -160 + (k % 3) * 16, -30 + k * 10, 250 + (k * 41) % 110, 6.5, COULEURS[k]);
    g.fillStyle = '#1a1a1e'; g.beginPath(); U.rr(g, -120, 24, 190, 14, 7); g.fill(); g.fillStyle = '#2bb45a'; g.beginPath(); U.rr(g, 60, 24, 60, 14, 6); g.fill();   // feutre
    g.strokeStyle = '#c9ccd2'; g.lineWidth = 7; g.setLineDash([3, 3]); g.beginPath(); U.rr(g, -182, -50, 364, 100, 44); g.stroke(); g.setLineDash([]);
    g.fillStyle = '#eef0f4'; g.beginPath(); U.rr(g, 168, -66, 28, 20, 5); g.fill(); g.fillStyle = '#9aa0a8'; g.beginPath(); U.rr(g, 176, -86, 12, 24, 5); g.fill();
    g.fillStyle = '#fbf3df'; g.beginPath(); U.rr(g, -200, 54, 112, 30, 6); g.fill();
    texte(g, 'LÉO', -144, 70, 'bold 19px sans-serif', '#a3191f');
  },
  emploi(g, d, R, U) {                                 // emploi du temps punaisé : jours, heures, matières en couleur
    g.rotate(0.05);
    ombre(g, () => g.rect(-190, -150, 380, 300), 0.6);
    g.fillStyle = '#fffdf4'; g.fillRect(-190, -150, 380, 300);
    g.fillStyle = '#2f5fd0'; g.fillRect(-190, -150, 380, 46);
    texte(g, 'EMPLOI DU TEMPS', 0, -126, 'bold 24px sans-serif', '#ffffff');
    const J = ['LUN', 'MAR', 'MER', 'JEU', 'VEN'], M = [['MATHS', '#7fb2f0'], ['FRANÇAIS', '#f39a8a'], ['SPORT', '#8fd88a'], ['DESSIN', '#ffd86a'], ['MUSIQUE', '#c9a0ec'], ['HISTOIRE', '#f6c08a']];
    for (let q = 0; q < 5; q++) texte(g, J[q], -122 + q * 68, -88, 'bold 15px sans-serif', '#2a2c38');
    for (let r = 0; r < 4; r++) {
      texte(g, (8 + r * 2) + 'h', -172, -50 + r * 52, 'bold 13px sans-serif', '#6a6c78');
      for (let q = 0; q < 5; q++) {
        const m = M[(q * 3 + r * 2 + (q === 2 && r > 1 ? 1 : 0)) % M.length];
        if (q === 2 && r > 1) continue;                                                     // mercredi après-midi : libre !
        g.fillStyle = m[1]; g.fillRect(-154 + q * 68, -72 + r * 52, 64, 46);
        texte(g, m[0], -122 + q * 68, -49 + r * 52, 'bold 10px sans-serif', 'rgba(30,30,40,0.8)');
      }
    }
    g.strokeStyle = 'rgba(40,40,60,0.35)'; g.lineWidth = 1.5; g.strokeRect(-190, -150, 380, 300);
    g.fillStyle = '#e8322a'; g.beginPath(); g.arc(-172, -136, 9, 0, TAU); g.fill(); g.fillStyle = 'rgba(255,255,255,0.6)'; g.beginPath(); g.arc(-175, -139, 3, 0, TAU); g.fill();
  },
  calculette(g, d, R, U) {                             // calculatrice solaire : écran, touches, panneau
    g.rotate(-0.15);
    ombre(g, () => U.rr(g, -96, -146, 192, 292, 18), 0.8);
    g.fillStyle = '#34373f'; g.beginPath(); U.rr(g, -96, -146, 192, 292, 18); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.08)'; g.beginPath(); U.rr(g, -88, -140, 176, 40, 12); g.fill();
    g.fillStyle = '#5a3a2a'; g.fillRect(-60, -132, 120, 18); g.strokeStyle = 'rgba(255,200,120,0.35)'; g.lineWidth = 1; g.beginPath(); for (let k = -45; k < 60; k += 15) { g.moveTo(k, -132); g.lineTo(k, -114); } g.stroke();
    g.fillStyle = '#b9c8a4'; g.beginPath(); U.rr(g, -78, -104, 156, 54, 6); g.fill();
    texte(g, '3.1415926', 70, -76, 'bold 30px monospace', '#2a3324', 'right');
    for (let r = 0; r < 5; r++) for (let q = 0; q < 4; q++) {
      const x = -72 + q * 38, y = -34 + r * 34, op = q === 3 || r === 0;
      g.fillStyle = r === 4 && q === 3 ? '#e8572a' : op ? '#8a8f9a' : '#e7e8ec'; g.beginPath(); U.rr(g, x, y, 30, 26, 6); g.fill();
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x + 2, y + 22, 26, 4);
    }
    const T = ['C', '√', '%', '÷', '7', '8', '9', '×', '4', '5', '6', '−', '1', '2', '3', '+', '0', '.', '±', '='];
    for (let k = 0; k < 20; k++) texte(g, T[k], -57 + (k % 4) * 38, -20 + Math.floor(k / 4) * 34, 'bold 15px sans-serif', k % 4 === 3 || k < 4 ? '#ffffff' : '#2a2c38');
  },
  compas(g, d, R, U) {                                 // compas ouvert et le cercle qu'il vient de tracer
    g.strokeStyle = 'rgba(60,62,74,0.55)'; g.lineWidth = 2.5; g.beginPath(); g.arc(-20, 20, 110, 0, TAU); g.stroke();
    g.fillStyle = 'rgba(60,62,74,0.7)'; g.beginPath(); g.arc(-20, 20, 4, 0, TAU); g.fill();
    g.save(); g.translate(-20, 20); g.rotate(-0.5);
    const tige = (x1, y1, x2, y2) => { g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); };
    g.lineCap = 'round';
    g.strokeStyle = 'rgba(40,24,10,0.22)'; g.lineWidth = 12; tige(8, 10, 64, -96); g.stroke(); tige(118, 10, 64, -96); g.stroke();
    g.strokeStyle = '#a7afba'; g.lineWidth = 10; tige(0, 0, 55, -105); g.stroke(); tige(110, 0, 55, -105); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 3; tige(-2, -4, 52, -106); g.stroke();
    g.fillStyle = '#555a64'; g.beginPath(); g.arc(0, 0, 4, 0, TAU); g.fill();                         // pointe sèche
    g.fillStyle = '#3a3d44'; g.beginPath(); U.rr(g, 100, -14, 18, 22, 4); g.fill();                     // porte-mine
    g.fillStyle = '#1f9fd8'; g.beginPath(); g.arc(55, -105, 17, 0, TAU); g.fill(); g.fillStyle = '#e8322a'; g.beginPath(); U.rr(g, 49, -142, 12, 32, 5); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.55)'; g.beginPath(); g.arc(50, -110, 5, 0, TAU); g.fill();
    g.restore();
  },
  postit(g, d, R, U) {                                 // bloc de notes repositionnables : un pense-bête sur le dessus
    const N = [['#ffe46a', 0.22, -26, -20], ['#ff9fc0', -0.15, 20, 18], ['#ffef8a', 0.06, 0, 0]];
    for (const n of N) {
      g.save(); g.translate(n[2], n[3]); g.rotate(n[1]);
      ombre(g, () => g.rect(-60, -60, 120, 120), 0.4);
      g.fillStyle = n[0]; g.fillRect(-60, -60, 120, 120);
      g.fillStyle = 'rgba(0,0,0,0.06)'; g.fillRect(-60, -60, 120, 22);
      g.restore();
    }
    g.rotate(0.06);
    texte(g, 'Piscine', 0, -14, 'italic 24px Georgia, serif', 'rgba(30,60,170,0.9)');
    texte(g, 'jeudi !', 4, 18, 'italic 24px Georgia, serif', 'rgba(30,60,170,0.9)');
    g.strokeStyle = 'rgba(225,50,60,0.8)'; g.lineWidth = 3; g.beginPath(); g.moveTo(-36, 40); g.quadraticCurveTo(0, 50, 40, 38); g.stroke();
  },
  trombones(g, d, R, U) {                              // trombones de couleur éparpillés
    const C = ['#e8322a', '#2f5fd0', '#2bb45a', '#c9ccd2', '#ffd23a', '#9a4fd0'];
    for (let k = 0; k < 7; k++) {
      g.save(); g.translate(-60 + (k * 37) % 120 + R() * 10, -50 + (k * 53) % 100); g.rotate(R() * TAU);
      g.strokeStyle = 'rgba(40,24,10,0.25)'; g.lineWidth = 5; g.lineJoin = 'round'; g.beginPath(); trombone(g, 3, 4); g.stroke();
      g.strokeStyle = C[k % C.length]; g.lineWidth = 4; g.beginPath(); trombone(g, 0, 0); g.stroke();
      g.restore();
    }
  },
  pomme(g, d, R, U) {                                  // pomme rouge du goûter, tige et feuille
    ombre(g, () => { g.arc(-24, 4, 50, 0, TAU); g.arc(24, 4, 50, 0, TAU); }, 1.2);
    const gr = g.createRadialGradient(-26, -22, 8, 0, 4, 76); gr.addColorStop(0, '#ff6a5a'); gr.addColorStop(0.6, '#d8261d'); gr.addColorStop(1, '#8a1410');
    g.fillStyle = gr; g.beginPath(); g.arc(-24, 4, 50, 0, TAU); g.arc(24, 4, 50, 0, TAU); g.fill();
    g.fillStyle = 'rgba(120,10,10,0.45)'; g.beginPath(); U.oval(g, 0, -4, 10, 7); g.fill();
    g.fillStyle = 'rgba(255,240,200,0.45)'; g.beginPath(); U.oval(g, -36, -18, 14, 8); g.fill();
    g.strokeStyle = '#6a3a1a'; g.lineWidth = 6; g.lineCap = 'round'; g.beginPath(); g.moveTo(0, -4); g.quadraticCurveTo(4, -24, 14, -34); g.stroke();
    g.fillStyle = '#3aa848'; g.beginPath(); g.moveTo(12, -30); g.quadraticCurveTo(34, -56, 60, -40); g.quadraticCurveTo(36, -20, 12, -30); g.fill();
    g.strokeStyle = 'rgba(20,80,30,0.6)'; g.lineWidth = 2; g.beginPath(); g.moveTo(14, -31); g.lineTo(54, -41); g.stroke();
  },
  copeaux(g, d, R, U) {                                // taille-crayon ouvert, copeaux en dentelle, bout de crayon
    for (let k = 0; k < 7; k++) {
      const x = -70 + R() * 140, y = -50 + R() * 100, r = 16 + R() * 12, a = R() * TAU, col = COULEURS[k % COULEURS.length];
      g.save(); g.translate(x, y); g.rotate(a);
      g.fillStyle = 'rgba(40,24,10,0.18)'; g.beginPath(); g.arc(3, 4, r, 0, Math.PI * 1.6); g.arc(3, 4, r * 0.4, Math.PI * 1.6, 0, true); g.fill();
      g.fillStyle = '#e8c99a'; g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 1.6); g.arc(0, 0, r * 0.4, Math.PI * 1.6, 0, true); g.fill();
      g.strokeStyle = col; g.lineWidth = 3.5; g.beginPath(); for (let q = 0; q <= 12; q++) { const u = q / 12 * Math.PI * 1.6, rr = r + (q % 2 ? 2 : -1); if (q) g.lineTo(Math.cos(u) * rr, Math.sin(u) * rr); else g.moveTo(Math.cos(u) * rr, Math.sin(u) * rr); } g.stroke();
      g.restore();
    }
    g.save(); g.translate(80, 60); g.rotate(-0.4);                    // le taille-crayon
    ombre(g, () => U.rr(g, -26, -20, 52, 40, 8), 0.5);
    g.fillStyle = '#2f5fd0'; g.beginPath(); U.rr(g, -26, -20, 52, 40, 8); g.fill();
    g.fillStyle = '#c9ccd2'; g.fillRect(-18, -16, 30, 10); g.fillStyle = '#1a1a1e'; g.beginPath(); g.arc(14, 6, 9, 0, TAU); g.fill();
    g.restore();
    g.save(); g.translate(-80, 80); g.rotate(0.3); ombre(g, () => g.rect(-40, -8, 80, 16), 0.3); crayonCouleur(g, -40, 0, 80, 8, '#ffd23a'); g.restore();
  },
  cahier(g, d, R, U) {                                 // cahier de maths ouvert : leçon recopiée, triangle ABC, marque-page
    g.rotate(0.08);
    ombre(g, () => g.rect(-214, -150, 428, 300), 0.8);
    g.fillStyle = '#2bb45a'; g.fillRect(-214, -150, 428, 300);                                 // couverture
    g.fillStyle = '#fdfcf4'; g.fillRect(-206, -144, 204, 288); g.fillStyle = '#f7f5ea'; g.fillRect(2, -144, 204, 288);
    g.strokeStyle = 'rgba(110,96,200,0.35)'; g.lineWidth = 1.2; g.beginPath(); for (let y = -120; y < 144; y += 16) { g.moveTo(-206, y); g.lineTo(206, y); } g.stroke();
    g.strokeStyle = 'rgba(225,50,60,0.6)'; g.lineWidth = 2; g.beginPath(); g.moveTo(-170, -144); g.lineTo(-170, 144); g.moveTo(38, -144); g.lineTo(38, 144); g.stroke();
    g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(-6, -144, 12, 288);
    texte(g, 'Le triangle', -90, -128, 'italic 20px Georgia, serif', 'rgba(225,50,60,0.9)');
    g.fillStyle = 'rgba(30,60,170,0.55)'; for (let k = 0; k < 12; k++) g.fillRect(-162, -104 + k * 16, 60 + R() * 90, 3);
    g.strokeStyle = 'rgba(60,62,74,0.85)'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(60, 90); g.lineTo(180, 90); g.lineTo(100, -70); g.closePath(); g.stroke();
    texte(g, 'A', 48, 102, 'bold 18px sans-serif', '#3a3c48'); texte(g, 'B', 192, 102, 'bold 18px sans-serif', '#3a3c48'); texte(g, 'C', 100, -86, 'bold 18px sans-serif', '#3a3c48');
    g.fillStyle = '#e8322a'; g.beginPath(); g.moveTo(-14, -150); g.lineTo(6, -150); g.lineTo(6, 168); g.lineTo(-4, 158); g.lineTo(-14, 168); g.closePath(); g.fill();
  },
  encrier(g, d, R, U) {                                // encrier renversé : l'encre file vers la piste
    U.blob(g, 60, -78, 64, 34, -0.9, R, 'rgba(24,34,110,0.85)');
    g.fillStyle = 'rgba(24,34,110,0.85)'; for (let k = 0; k < 6; k++) { g.beginPath(); g.arc(96 + k * 9 + R() * 8, -124 - k * 12 + R() * 8, 4 + R() * 4, 0, TAU); g.fill(); }
    g.rotate(-0.9);
    ombre(g, () => U.rr(g, -60, -44, 110, 88, 30), 0.9);
    const gr = g.createLinearGradient(0, -44, 0, 44); gr.addColorStop(0, 'rgba(225,240,250,0.95)'); gr.addColorStop(1, 'rgba(150,175,200,0.95)');
    g.fillStyle = gr; g.beginPath(); U.rr(g, -60, -44, 110, 88, 30); g.fill();
    g.fillStyle = 'rgba(24,34,110,0.9)'; g.beginPath(); U.rr(g, -52, 0, 96, 36, 16); g.fill();
    g.fillStyle = '#fbf3df'; g.fillRect(-36, -26, 52, 40); texte(g, 'ENCRE', -10, -12, 'bold 11px sans-serif', '#1a2a70'); texte(g, 'bleue', -10, 4, 'italic 11px Georgia, serif', '#1a2a70');
    g.fillStyle = 'rgba(255,255,255,0.7)'; g.beginPath(); U.oval(g, -30, -34, 18, 5); g.fill();
    g.fillStyle = '#c8ccd4'; g.fillRect(50, -22, 18, 44);                                                  // goulot
    g.save(); g.translate(40, 96); g.rotate(0.5); ombre(g, () => U.rr(g, -26, -24, 52, 48, 10), 0.4);      // bouchon roulé à côté
    g.fillStyle = '#1a1a1e'; g.beginPath(); U.rr(g, -26, -24, 52, 48, 10); g.fill(); g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(-22, -18, 44, 8); g.restore();
  },
  equerre(g, d, R, U) {                                // équerre graduée et rapporteur transparents
    g.rotate(-0.06);
    ombre(g, () => { g.moveTo(-180, 70); g.lineTo(60, 70); g.lineTo(-180, -90); g.closePath(); }, 0.5);
    g.fillStyle = 'rgba(255,170,60,0.42)'; g.beginPath(); g.moveTo(-180, 70); g.lineTo(60, 70); g.lineTo(-180, -90); g.closePath(); g.fill();
    g.fillStyle = 'rgba(253,252,246,0.9)'; g.beginPath(); g.moveTo(-150, 50); g.lineTo(-30, 50); g.lineTo(-150, -30); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(150,80,20,0.75)'; g.lineWidth = 2; g.beginPath(); g.moveTo(-180, 70); g.lineTo(60, 70); g.lineTo(-180, -90); g.closePath(); g.stroke();
    g.lineWidth = 1.2; g.beginPath(); for (let k = 0; k < 24; k++) { g.moveTo(-176 + k * 10, 70); g.lineTo(-176 + k * 10, k % 5 ? 64 : 58); } g.stroke();
    g.save(); g.translate(140, 60);
    ombre(g, () => { g.arc(0, 0, 90, Math.PI, TAU); g.closePath(); }, 0.4);
    g.fillStyle = 'rgba(170,215,240,0.55)'; g.beginPath(); g.arc(0, 0, 90, Math.PI, TAU); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(40,90,140,0.75)'; g.lineWidth = 1.5; g.stroke();
    g.beginPath(); for (let k = 0; k <= 18; k++) { const u = Math.PI + k * Math.PI / 18, l = k % 3 ? 8 : 16; g.moveTo(Math.cos(u) * 90, Math.sin(u) * 90); g.lineTo(Math.cos(u) * (90 - l), Math.sin(u) * (90 - l)); } g.stroke();
    g.fillStyle = 'rgba(253,252,246,0.85)'; g.beginPath(); g.arc(0, 0, 34, Math.PI, TAU); g.closePath(); g.fill();
    texte(g, '90', 0, -58, 'bold 11px sans-serif', 'rgba(20,50,90,0.8)');
    g.restore();
  },
  ciseaux(g, d, R, U) {                                // ciseaux à bouts ronds, poignées orange
    g.rotate(0.35);
    const lame = s => { g.beginPath(); g.moveTo(-62, -6 * s); g.quadraticCurveTo(80, -22 * s, 170, -6 * s); g.quadraticCurveTo(176, 0, 168, 3 * s); g.quadraticCurveTo(80, 6 * s, -62, 8 * s); g.closePath(); };
    g.save(); g.rotate(0.12); g.translate(6, 8); g.fillStyle = 'rgba(40,24,10,0.22)'; lame(1); g.fill(); g.restore();
    g.save(); g.rotate(-0.12); g.translate(6, 8); g.fillStyle = 'rgba(40,24,10,0.22)'; lame(-1); g.fill(); g.restore();
    for (const s of [1, -1]) { g.save(); g.rotate(0.12 * s); g.fillStyle = s > 0 ? '#c9ced6' : '#dfe3ea'; lame(s); g.fill(); g.strokeStyle = 'rgba(80,86,96,0.6)'; g.lineWidth = 1.5; g.stroke(); g.restore(); }
    for (const s of [1, -1]) {
      g.save(); g.rotate(0.3 * s); g.translate(-70, 0);
      ombre(g, () => { U.oval(g, -10, 0, 50, 26); }, 0.4);
      g.fillStyle = '#f07a1e'; g.beginPath(); U.oval(g, -10, 0, 50, 26); g.fill();
      g.fillStyle = '#fdfcf6'; g.beginPath(); U.oval(g, -14, 0, 32, 13); g.fill();
      g.restore();
    }
    g.fillStyle = '#8a9099'; g.beginPath(); g.arc(0, 0, 7, 0, TAU); g.fill(); g.fillStyle = '#ffffff'; g.beginPath(); g.arc(-2, -2, 2.5, 0, TAU); g.fill();
  },
};
function trombone(g, x, y) {                          // un trombone vu de dessus (boucles imbriquées)
  g.moveTo(x - 22, y + 6); g.lineTo(x + 18, y + 6); g.arc(x + 18, y, 6, Math.PI / 2, -Math.PI / 2, true); g.lineTo(x - 26, y - 6);
  g.arc(x - 26, y + 1, 7, -Math.PI / 2, Math.PI / 2, true); g.lineTo(x + 12, y + 8);
}

// ── murs : règles graduées, crayons ──
function regle(g, w, U, fond, bord, bois) {          // règle graduée (1 cm = 20 u), chiffres tous les centimètres
  const L = Math.hypot(w[2] - w[0], w[3] - w[1]), r = w[4], a = Math.atan2(w[3] - w[1], w[2] - w[0]), o = dec(a, 6, 9);
  g.save(); g.translate(w[0], w[1]); g.rotate(a);
  g.fillStyle = 'rgba(40,24,10,0.16)'; g.beginPath(); U.rr(g, -r * 0.4 + o[0] * 1.6, -r + o[1] * 1.6, L + r * 0.8, 2 * r, 4); g.fill();
  g.fillStyle = 'rgba(40,24,10,0.2)'; g.beginPath(); U.rr(g, -r * 0.4 + o[0], -r + o[1], L + r * 0.8, 2 * r, 4); g.fill();
  g.fillStyle = fond; g.beginPath(); U.rr(g, -r * 0.4, -r, L + r * 0.8, 2 * r, 4); g.fill(); g.strokeStyle = bord; g.lineWidth = 1.5; g.stroke();
  if (bois) { g.strokeStyle = 'rgba(120,70,30,0.25)'; g.lineWidth = 1.5; g.beginPath(); for (let k = 0; k < 3; k++) { g.moveTo(0, -r * 0.3 + k * r * 0.45); g.lineTo(L, -r * 0.2 + k * r * 0.4); } g.stroke(); g.fillStyle = '#9aa0a8'; g.fillRect(-r * 0.4, -r, L + r * 0.8, 3); }
  else { g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(0, r * 0.35, L, r * 0.25); }
  g.strokeStyle = 'rgba(20,30,50,0.8)'; g.lineWidth = 1.2; g.beginPath();
  for (let k = 0; k * 5 <= L; k++) { const h = k % 4 === 0 ? r * 0.75 : k % 2 === 0 ? r * 0.5 : r * 0.3; g.moveTo(k * 5, -r); g.lineTo(k * 5, -r + h); }
  g.stroke();
  g.font = 'bold 11px sans-serif'; g.fillStyle = 'rgba(20,30,50,0.85)'; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (let k = 0; k * 20 <= L; k++) g.fillText(String(k), k * 20, -r * 0.05 + 2);
  g.restore();
}
const MURS = {
  regle(g, w, R, U) { regle(g, w, U, 'rgba(178,218,246,0.72)', 'rgba(60,110,160,0.8)', false); },   // règle en plastique transparent
  reglebois(g, w, R, U) { regle(g, w, U, '#e2bf86', 'rgba(110,64,26,0.7)', true); },               // double décimètre en bois, liseré de métal
  crayonc(g, w, R, U) {                                // crayons de couleur couchés bout à bout (spirales de l'escargot)
    const L = Math.hypot(w[2] - w[0], w[3] - w[1]), r = w[4], a = Math.atan2(w[3] - w[1], w[2] - w[0]), o = dec(a, 5, 8);
    const col = COULEURS[Math.abs(Math.round(w[0] * 0.37 + w[1] * 0.71)) % COULEURS.length];
    g.save(); g.translate(w[0], w[1]); g.rotate(a);
    g.fillStyle = 'rgba(40,24,10,0.14)'; g.fillRect(2 + o[0] * 1.6, -r + o[1] * 1.6, L - 4, 2 * r);
    g.fillStyle = 'rgba(40,24,10,0.2)'; g.fillRect(2 + o[0], -r + o[1], L - 4, 2 * r);
    crayonCouleur(g, 2, 0, L - 4, r, col);
    g.restore();
  },
  crayon(g, w, R, U) {                                 // gros crayon à papier : virole, gomme rose, corps jaune à pans
    const L = Math.hypot(w[2] - w[0], w[3] - w[1]), r = w[4], a = Math.atan2(w[3] - w[1], w[2] - w[0]), o = dec(a, 6, 9);
    g.save(); g.translate(w[0], w[1]); g.rotate(a);
    g.fillStyle = 'rgba(40,24,10,0.14)'; g.beginPath(); U.rr(g, -r + o[0] * 1.6, -r + o[1] * 1.6, L + 2 * r, 2 * r, r); g.fill();
    g.fillStyle = 'rgba(40,24,10,0.2)'; g.beginPath(); U.rr(g, -r + o[0], -r + o[1], L + 2 * r, 2 * r, r); g.fill();
    g.fillStyle = '#f08aa0'; g.beginPath(); U.rr(g, -r, -r, r * 2.4, 2 * r, r * 0.6); g.fill();
    g.fillStyle = '#c3c7cc'; g.fillRect(r * 0.9, -r, r * 1.6, 2 * r); g.fillStyle = 'rgba(0,0,0,0.18)'; for (let k = 0; k < 3; k++) g.fillRect(r * 1.1 + k * r * 0.45, -r, 2, 2 * r);
    crayonCouleur(g, r * 2.5, 0, L - r * 1.5, r, '#f2c230');
    g.fillStyle = '#3a3a40'; g.beginPath(); g.moveTo(L + r - r * 1.15, -r * 0.38); g.lineTo(L + r, 0); g.lineTo(L + r - r * 1.15, r * 0.38); g.closePath(); g.fill();
    g.font = 'bold 13px sans-serif'; g.fillStyle = 'rgba(40,30,10,0.7)'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('HB  ·  ÉCOLIER', L * 0.5, 0);
    g.restore();
  },
};

// ── obstacles, zones, mobiles propres au bureau ──
const OBJETS = {
  capuchon(g, r, R, U) {                               // capuchon de feutre debout : bouchon, bague, agrafe
    const x = r[0], y = r[1], s = r[2];
    g.fillStyle = 'rgba(40,24,10,0.16)'; g.beginPath(); g.arc(x + 9, y + 12, s, 0, TAU); g.fill();
    g.fillStyle = 'rgba(40,24,10,0.22)'; g.beginPath(); g.arc(x + 5, y + 7, s, 0, TAU); g.fill();
    g.fillStyle = '#1d47b8'; g.beginPath(); g.arc(x, y, s, 0, TAU); g.fill();
    g.fillStyle = '#2f62d8'; g.beginPath(); g.arc(x - 1, y - 1, s * 0.74, 0, TAU); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.4)'; g.beginPath(); g.arc(x - s * 0.3, y - s * 0.32, s * 0.2, 0, TAU); g.fill();
    g.fillStyle = '#c9ccd2'; g.beginPath(); U.rr(g, x - 3, y - s * 1.25, 6, s * 1.1, 3); g.fill();
  },
};
const ZONES = {
  colle(g, z, R, U) {                                  // flaque de colle à paillettes : liseré bleuté, corps nacré, paillettes, reflet
    g.save(); g.translate(z[0], z[1]); g.rotate(z[5]);
    const a = z[2], b = z[3], lobes = [[0, 0, 1, 1], [-0.55, -0.35, 0.5, 0.55], [0.5, 0.4, 0.55, 0.5], [0.62, -0.3, 0.38, 0.42], [-0.6, 0.42, 0.35, 0.38]];
    const flaque = (e) => { g.beginPath(); for (const l of lobes) { g.moveTo(l[0] * a + l[2] * a * 0.8 + e, l[1] * b); U.oval(g, l[0] * a, l[1] * b, l[2] * a * 0.8 + e, l[3] * b * 0.8 + e); } };
    g.fillStyle = 'rgba(90,110,150,0.55)'; flaque(4); g.fill();
    g.fillStyle = 'rgba(236,240,250,0.97)'; flaque(0); g.fill();
    for (let k = 0; k < 34; k++) { g.fillStyle = COULEURS[k % COULEURS.length]; g.fillRect((R() - 0.5) * a * 1.5, (R() - 0.5) * b * 1.3, 3, 3); }
    g.fillStyle = 'rgba(255,255,255,0.95)'; g.beginPath(); U.oval(g, -a * 0.3, -b * 0.38, a * 0.3, b * 0.13); g.fill();
    g.restore();
  },
};
const MOBILES = {
  gommeuse(g, m, o, now, U, reduceFx) {                // gomme qui glisse d'avant en arrière (elle frotte le papier)
    const r = m.r, a = Math.atan2(m.seg[1][1] - m.seg[0][1], m.seg[1][0] - m.seg[0][0]) + (reduceFx ? 0 : Math.sin(now / 60) * 0.05);
    g.save(); g.translate(o.x, o.y); g.rotate(a);
    g.fillStyle = 'rgba(40,24,10,0.25)'; g.beginPath(); U.rr(g, -r * 1.15 + 5, -r * 0.72 + 7, r * 2.3, r * 1.44, 8); g.fill();
    g.fillStyle = '#f9f6ee'; g.beginPath(); U.rr(g, -r * 1.15, -r * 0.72, r * 2.3, r * 1.44, 8); g.fill();
    g.fillStyle = '#2f5fd0'; g.fillRect(-r * 0.5, -r * 0.74, r * 1.6, r * 1.48);
    g.fillStyle = '#ffd23a'; g.fillRect(-r * 0.5, -r * 0.14, r * 1.6, r * 0.28);
    g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(-r * 1.15, r * 0.4, r * 2.3, r * 0.32);
    g.restore();
  },
};

export default {
  id: 'bureau', nom: 'Bureau d\'écolier', emoji: '✏️', sous: 'Copie à grands carreaux · escargot de crayons, règles turbo, encre et colle', v: 2,
  w: 2280, h: 3340, surf: 'cahier', edge: 'chute', table: { x0: 40, y0: 40, x1: 2240, y1: 3300, r: 36 }, W: 92,
  pts: PTS,
  mobs: [
    { type: 'toupie', cer: [230, 2240, 130], r: 22, per: 6.5 },                   // toupie folle à l'extérieur de l'épingle de gauche
    { type: 'gommeuse', seg: [[1560, 3150], [1560, 2965]], r: 28, per: 5 },       // gomme qui frotte en travers de la dernière ligne droite
  ],
  boxes: [0.118, 0.47, 0.838],
  zonesPhysiques: { colle: 'frein' },
  make(H) {
    const E = MARQUES.escargot, ex = E[0], ey = E[1], P = Math.PI;
    H.boostAt(0.02); H.boostAt(0.982); H.boostAt(0.108);                         // turbos : règle du départ (les deux sens), règle du haut
    H.wall(1980 + 116, 2540, 1980 + 116, 1680, 18, 'regle');                     // règle transparente le long du départ
    H.wall(ex + 760, ey + 116, ex + 90, ey + 116, 18, 'reglebois');              // double décimètre le long de la règle du haut
    H.wall(ex - 748, ey + 30, ex - 748, ey - 360, 9, 'crayon');                  // gros crayon dans la marge, à la sortie de l'escargot
    // escargot : deux spirales de crayons de couleur couchés bout à bout, entre les spires (à 120 u de chacune)
    const arc = (cx, cy, r, a0, a1) => { const k = Math.max(1, Math.round(Math.abs(a1 - a0) * r / 105)); for (let q = 0; q < k; q++) { const u = a0 + (a1 - a0) * q / k, v = a0 + (a1 - a0) * (q + 1) / k; H.wall(cx + Math.cos(u) * r, cy + Math.sin(u) * r, cx + Math.cos(v) * r, cy + Math.sin(v) * r, 8, 'crayonc'); } };
    H.wall(ex - 520, ey - 190, ex - 520, ey - 400, 8, 'crayonc'); arc(ex, ey - 400, 520, P, 1.5 * P); arc(ex, ey - 650, 270, -0.5 * P, 0.5 * P);
    H.wall(ex + 210, ey - 120, ex, ey - 120, 8, 'crayonc'); arc(ex, ey - 390, 270, 0.5 * P, 1.5 * P);
    // obstacles : un choix de trajectoire à chaque fois, jamais un mur
    H.rockAt(0.522, 0.55, 24, 'taille');                                          // taille-crayon dans la sortie
    H.rockAt(0.598, -0.6, 22, 'trombones'); H.rockAt(0.626, 0.6, 24, 'gomme');    // slalom de la traversée ondulée
    H.rockAt(0.738, 0.55, 16, 'punaise'); H.rockAt(0.758, -0.55, 16, 'punaise'); // punaises de la baïonnette (elles renvoient)
    H.rockAt(0.405, 0.62, 16, 'punaise');                                         // punaise à l'extérieur du déroulé
    H.rockAt(0.876, -0.62, 20, 'capuchon');                                       // capuchon de feutre dans la longue descente
    // zones : encre (glisse), miettes de gomme et colle (freinent), toujours sur une moitié de piste
    H.zoneAt(0.212, -0.42, 70, 46, 'encre'); H.zoneAt(0.858, 0.42, 74, 48, 'encre');
    H.zoneAt(0.566, 0.45, 66, 44, 'gomme'); H.zoneAt(0.69, -0.45, 64, 44, 'gomme');
    H.zoneAt(0.362, 0.42, 68, 44, 'colle'); H.zoneAt(0.804, 0.42, 68, 44, 'colle');
    // décor
    H.deco(1820, 310, 'trousse'); H.deco(1640, 760, 'emploi'); H.deco(2060, 760, 'calculette'); H.deco(1900, 1080, 'compas');
    H.deco(1560, 1090, 'postit'); H.deco(1790, 2320, 'trombones'); H.deco(220, 1880, 'pomme'); H.deco(1420, 2440, 'copeaux');
    H.deco(440, 2980, 'cahier'); H.deco(740, 2740, 'encrier'); H.deco(1180, 3140, 'equerre'); H.deco(1900, 3150, 'ciseaux');
  },
  dessin: { plateau: bureauPeint, piste: pisteCrayon, decor: DECOR, murs: MURS, objets: OBJETS, zones: ZONES, mobiles: MOBILES },
};
