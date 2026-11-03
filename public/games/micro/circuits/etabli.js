// Circuit « etabli » de Micro Machines — définition PARTAGÉE serveur / client (géométrie, obstacles, zones, décor).
// Format : voir l'en-tête de ../shared.js ; dessins propres au circuit (propriété `dessin`) : voir ../rendu.js.

// tortue : départ (x, y) au cap h (rad, 0 = vers la droite, y vers le bas) ; ['X', x] / ['Y', y] tout droit jusqu'à cette
// abscisse / ordonnée, ['A', rayon, degrés] arc (> 0 : à droite) → un point tous les ~45 u (droites bien droites, coins ronds)
function tortue(x, y, h, cmds) {
  const P = [[x, y]];
  for (const c of cmds) {
    if (c[0] !== 'A') {
      const len = c[0] === 'Y' ? (c[1] - y) / Math.sin(h) : (c[1] - x) / Math.cos(h), k = Math.max(1, Math.round(len / 45));
      for (let i = 1; i <= k; i++) P.push([x + Math.cos(h) * len * i / k, y + Math.sin(h) * len * i / k]);
      x += Math.cos(h) * len; y += Math.sin(h) * len;
    } else {
      const r = c[1], a = c[2] * Math.PI / 180, s = a > 0 ? 1 : -1, cx = x - Math.sin(h) * r * s, cy = y + Math.cos(h) * r * s;
      const f0 = Math.atan2(y - cy, x - cx), k = Math.max(3, Math.round(r * Math.abs(a) / 40));
      for (let i = 1; i <= k; i++) { const f = f0 + a * i / k; P.push([cx + Math.cos(f) * r, cy + Math.sin(f) * r]); }
      x = cx + Math.cos(f0 + a) * r; y = cy + Math.sin(f0 + a) * r; h += a;
    }
  }
  P.pop();                                                     // le dernier point retombe sur le départ
  return P.map(p => [Math.round(p[0]), Math.round(p[1])]);
}
// pyramide renversée en escaliers : le grand mètre ruban en haut, l'escalier qui descend à droite, trois épingles carrées
// au fond (le « méandre »), l'escalier qui remonte à gauche
const PTS = tortue(1000, 330, 0, [
  ['X', 3460], ['A', 190, 90], ['Y', 695], ['A', 125, 90],                    // mètre ruban, grand virage, première marche
  ['X', 3255], ['A', 125, -90], ['Y', 1255], ['A', 125, 90],                  // escalier qui descend
  ['X', 2735], ['A', 125, -90], ['Y', 1835], ['A', 125, 90],
  ['X', 2285], ['A', 125, 90], ['Y', 1080], ['A', 130, -90],                  // méandre : épingle carrée du bas, remontée…
  ['X', 1970], ['A', 130, -90], ['Y', 1835], ['A', 125, 90],                  // …épingle du haut, redescente…
  ['X', 1515], ['A', 125, 90], ['Y', 1555], ['A', 125, -90],                  // …épingle du bas
  ['X', 995], ['A', 125, 90], ['Y', 995], ['A', 125, -90],                    // escalier qui remonte
  ['X', 605], ['A', 125, 90], ['Y', 490], ['A', 160, 90], ['X', 1000],
]);

// ── petits outils de dessin ──
const TAU = Math.PI * 2;
// ombre douce portée vers le bas-droite (lumière fixe en haut à gauche, quel que soit l'angle a du repère courant) : une passe
// large et pâle puis une serrée plus sombre ; f() trace le contour ; k = hauteur de l'objet ; eo : règle pair-impair (trous) ;
// m = -1 dans un repère retourné en miroir
function ombre(g, a, k, f, eo, m) {
  const c = Math.cos(a), s = Math.sin(a), mx = m || 1;
  for (let p = 0; p < 2; p++) {
    const ox = (p ? 4 : 8) * k, oy = (p ? 6 : 12) * k;
    g.save(); g.translate(mx * (ox * c + oy * s), -ox * s + oy * c); g.fillStyle = p ? 'rgba(40,22,6,0.2)' : 'rgba(40,22,6,0.1)';
    g.beginPath(); f(); g.fill(eo ? 'evenodd' : 'nonzero'); g.restore();
  }
}
function acier(g, x0, y0, x1, y1) {                    // dégradé d'acier poli (clair → sombre)
  const gr = g.createLinearGradient(x0, y0, x1, y1);
  gr.addColorStop(0, '#f0f3f7'); gr.addColorStop(0.42, '#b3b9c2'); gr.addColorStop(0.58, '#8e949d'); gr.addColorStop(1, '#5d636c'); return gr;
}
function degrade(g, x0, y0, x1, y1, c0, c1) { const gr = g.createLinearGradient(x0, y0, x1, y1); gr.addColorStop(0, c0); gr.addColorStop(1, c1); return gr; }
function hexa(g, x, y, r, a) { for (let k = 0; k < 6; k++) { const u = a + k * TAU / 6; if (k) g.lineTo(x + Math.cos(u) * r, y + Math.sin(u) * r); else g.moveTo(x + Math.cos(u) * r, y + Math.sin(u) * r); } g.closePath(); }
function visCouchee(g, l, col) {                       // vis de profil (couchée) autour de l'origine : tête fraisée, filetage, pointe
  g.fillStyle = 'rgba(40,22,6,0.25)'; g.fillRect(-l / 2 + 2, -1, l, 8);
  g.fillStyle = col; g.beginPath(); g.moveTo(-l / 2, -6); g.lineTo(-l / 2 + 6, -2.5); g.lineTo(l / 2 - 6, -2.5); g.lineTo(l / 2, 0);
  g.lineTo(l / 2 - 6, 2.5); g.lineTo(-l / 2 + 6, 2.5); g.lineTo(-l / 2, 6); g.closePath(); g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 1; g.beginPath(); for (let x = -l / 2 + 9; x < l / 2 - 6; x += 4) { g.moveTo(x, -2.5); g.lineTo(x + 2, 2.5); } g.stroke();
  g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(-l / 2 + 6, -2.5, l - 12, 1.2);
}
function piece(g, R, t) {                              // une pièce de visserie couchée autour de l'origine (t ∈ [0, 1[ choisit laquelle)
  if (t < 0.3) visCouchee(g, 26 + R() * 22, R() < 0.3 ? '#d6a843' : R() < 0.5 ? '#3a3c42' : '#c3c8d0');
  else if (t < 0.48) {                                 // clou : tige fine, tête plate
    g.fillStyle = 'rgba(40,22,6,0.25)'; g.fillRect(-18, 1, 40, 5);
    g.fillStyle = '#9aa0aa'; g.fillRect(-18, -1.5, 36, 3); g.beginPath(); g.moveTo(18, -1.5); g.lineTo(24, 0); g.lineTo(18, 1.5); g.fill();
    g.fillStyle = '#c3c8d0'; g.fillRect(-21, -5, 4, 10);
  } else if (t < 0.66) {                               // rondelle
    g.fillStyle = 'rgba(40,22,6,0.25)'; g.beginPath(); g.arc(3, 4, 10, 0, TAU); g.fill();
    g.fillStyle = acier(g, -10, -10, 10, 10); g.beginPath(); g.arc(0, 0, 10, 0, TAU); g.arc(0, 0, 4.5, 0, TAU, true); g.fill();
  } else if (t < 0.84) {                               // petit écrou
    g.fillStyle = 'rgba(40,22,6,0.25)'; g.beginPath(); hexa(g, 3, 4, 10, 0); g.fill();
    g.fillStyle = acier(g, -10, -10, 10, 10); g.beginPath(); hexa(g, 0, 0, 10, R()); g.fill();
    g.fillStyle = '#4a4036'; g.beginPath(); g.arc(0, 0, 4.2, 0, TAU); g.fill();
  } else {                                             // cheville en plastique (jaune ou rouge), striée
    g.fillStyle = 'rgba(40,22,6,0.25)'; g.fillRect(-12, -2, 28, 10);
    g.fillStyle = R() < 0.5 ? '#f2c230' : '#d8352a'; g.beginPath(); g.moveTo(-14, -5); g.lineTo(12, -3.5); g.lineTo(14, 0); g.lineTo(12, 3.5); g.lineTo(-14, 5); g.closePath(); g.fill();
    g.fillStyle = 'rgba(0,0,0,0.25)'; for (let x = -10; x < 10; x += 5) g.fillRect(x, -4.5, 1.5, 9);
  }
}

// mètre ruban déroulé SOUS le grand droit (on roule dessus) : graduations au cm, chiffres tous les 10 cm, mètres en rouge,
// crochet d'acier au bout ; le boîtier est le décor « boitier », à gauche
function ruban(g) {
  const y = 330, h = 50, x0 = 300, x1 = 3390;
  g.fillStyle = 'rgba(40,24,8,0.22)'; g.fillRect(x0 + 4, y - h + 6, x1 - x0, 2 * h);
  const gr = g.createLinearGradient(0, y - h, 0, y + h);                       // ruban légèrement bombé
  gr.addColorStop(0, '#c49c18'); gr.addColorStop(0.14, '#f2d03c'); gr.addColorStop(0.5, '#ffe572'); gr.addColorStop(0.86, '#efc934'); gr.addColorStop(1, '#bf9616');
  g.fillStyle = gr; g.fillRect(x0, y - h, x1 - x0, 2 * h);
  g.fillStyle = '#1d1d1f';
  for (let k = 0; x0 + k * 10 < x1 - 14; k++) { const x = x0 + k * 10, l = k % 10 === 0 ? 24 : k % 5 === 0 ? 16 : 9; g.fillRect(x, y - h, 2, l); g.fillRect(x, y + h - l, 2, l); }
  g.font = 'bold 22px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (let k = 1; x0 + k * 100 < x1 - 20; k++) {
    const x = x0 + k * 100;
    if (k % 10 === 0) { g.fillStyle = '#d8261d'; g.fillRect(x - 32, y - 16, 64, 32); g.fillStyle = '#ffffff'; g.fillText(k / 10 + ' m', x, y + 1); }
    else { g.fillStyle = k % 5 === 0 ? '#d8261d' : '#1d1d1f'; g.fillText(String(k * 10), x + 20, y + 1); }
  }
  g.fillStyle = acier(g, 0, y - 40, 0, y + 40); g.fillRect(x1 - 34, y - 38, 30, 76);                    // crochet en L, riveté
  g.fillStyle = acier(g, x1 - 4, 0, x1 + 14, 0); g.fillRect(x1 - 4, y - h - 9, 16, 2 * h + 18);
  g.fillStyle = '#6d737c'; g.beginPath(); g.arc(x1 - 19, y - 20, 4.5, 0, TAU); g.arc(x1 - 19, y + 20, 4.5, 0, TAU); g.fill();
}
// piste : celle de l'établi générique (ruban de masquage, flèches à la craie), avec le mètre ruban glissé dessous
function pisteEtabli(g, c, R, U) {
  const W = c.W;
  U.centerStroke(g, c, 2 * W, 'rgba(90,60,25,0.14)');
  ruban(g);
  for (const side of [-1, 1]) {
    g.lineJoin = 'round';
    g.strokeStyle = 'rgba(60,40,10,0.22)'; g.lineWidth = 15; U.trackPath(g, c, (W + 5) * side + 2); g.stroke();
    g.strokeStyle = '#eadcae'; g.lineWidth = 13; U.trackPath(g, c, (W + 5) * side); g.stroke();
    g.strokeStyle = 'rgba(150,130,80,0.35)'; g.lineWidth = 1.5; g.setLineDash([5, 9]); U.trackPath(g, c, (W + 5) * side); g.stroke(); g.setLineDash([]);
  }
  for (let i = 0; i < c.n; i += Math.round(c.n / 10)) {
    const x = c.sx[i], y = c.sy[i], a = Math.atan2(c.ty[i], c.tx[i]);
    g.save(); g.translate(x, y); g.rotate(a); g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 5; g.lineCap = 'round'; g.beginPath(); g.moveTo(-16, -16); g.lineTo(6, 0); g.lineTo(-16, 16); g.stroke(); g.restore();
  }
}

// ── décor posé sur l'établi (dessiné autour de l'origine) ──
const DECOR = {
  panneau(g, d, R, U) {                                // ombre du panneau perforé accroché au mur : trous de lumière, outils suspendus
    const gr = g.createLinearGradient(0, -90, 0, 96); gr.addColorStop(0, 'rgba(30,18,6,0.36)'); gr.addColorStop(0.65, 'rgba(30,18,6,0.13)'); gr.addColorStop(1, 'rgba(30,18,6,0)');
    g.fillStyle = gr; g.fillRect(-1970, -90, 3940, 186);
    for (let r = 0; r < 4; r++) {
      g.fillStyle = 'rgba(255,236,190,' + (0.2 - r * 0.045).toFixed(3) + ')'; g.beginPath();
      for (let x = -1950 + (r % 2) * 21; x < 1960; x += 42) { const y = -68 + r * 34; g.moveTo(x + 5.5, y); g.arc(x, y, 5.5, 0, TAU); }
      g.fill();
    }
    g.fillStyle = 'rgba(28,16,4,0.17)'; g.beginPath();
    U.rr(g, -1545, -88, 120, 32, 9); U.rr(g, -1494, -60, 20, 140, 9);                          // marteau pendu par la tête
    U.rr(g, -1090, -86, 20, 140, 10); g.moveTo(-1050, 64); g.arc(-1080, 64, 30, 0, TAU);       // clé plate
    U.rr(g, -260, -90, 84, 60, 22); g.moveTo(-250, -34); g.lineTo(-186, -34); g.lineTo(-150, 84); g.lineTo(-262, 84); g.closePath();   // égoïne
    g.moveTo(640, -86); g.lineTo(676, -86); g.lineTo(700, 60); g.lineTo(684, 62); g.closePath(); g.moveTo(690, -86); g.lineTo(712, -86); g.lineTo(740, 56); g.lineTo(724, 60); g.closePath();   // pince
    for (const x of [1180, 1230, 1280]) U.rr(g, x - 9, -86, 18, 70 + (x % 3) * 12, 8);        // tournevis rangés
    g.moveTo(1640, -10); g.arc(1600, -10, 40, 0, TAU); g.moveTo(1630, -10); g.arc(1600, -10, 30, 0, TAU, true);   // rouleau de rallonge
    g.fill();
  },
  boitier(g, d, R, U) {                                // boîtier du mètre ruban : coque jaune et caoutchouc noir, bouton de blocage, clip
    const f = () => U.rr(g, -96, -96, 192, 192, 44);
    ombre(g, 0, 1.5, f);
    g.fillStyle = '#26262a'; g.beginPath(); f(); g.fill();
    g.fillStyle = '#3a3a40'; for (let k = -60; k <= 60; k += 15) { g.fillRect(k - 3, 86, 6, 8); g.fillRect(-94, k - 3, 8, 6); }   // stries de caoutchouc
    g.fillStyle = degrade(g, -84, -84, 84, 84, '#ffe57e', '#d29e12'); g.beginPath(); U.rr(g, -82, -82, 164, 164, 34); g.fill();
    g.strokeStyle = 'rgba(120,80,0,0.5)'; g.lineWidth = 3; g.beginPath(); g.arc(-8, 0, 58, 0, TAU); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.45)'; g.lineWidth = 6; g.beginPath(); g.arc(-8, 0, 50, Math.PI * 1.05, Math.PI * 1.55); g.stroke();
    g.fillStyle = acier(g, -24, -16, 8, 16); g.beginPath(); g.arc(-8, 0, 16, 0, TAU); g.fill();
    g.fillStyle = '#5d636c'; g.fillRect(-18, -2, 20, 4);
    g.fillStyle = '#26262a'; g.font = 'bold 24px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('5 m', -8, 38);
    g.fillStyle = '#26262a'; g.beginPath(); U.rr(g, 8, -104, 54, 24, 9); g.fill();          // bouton de blocage
    g.fillStyle = '#d8352a'; g.beginPath(); U.rr(g, 16, -100, 24, 15, 6); g.fill();
    g.fillStyle = acier(g, -112, 0, -94, 0); g.beginPath(); U.rr(g, -112, -48, 18, 96, 6); g.fill();   // clip de ceinture
    g.fillStyle = '#1a1a1c'; g.beginPath(); U.rr(g, 82, -60, 24, 120, 8); g.fill();          // bouche d'où sort le ruban
    g.fillStyle = '#9aa0aa'; g.fillRect(100, -52, 6, 104);
  },
  niveau(g, d, R, U) {                                 // niveau à bulle en aluminium : embouts caoutchouc, fiole centrale et fioles d'aplomb
    g.rotate(0.02);
    const f = () => U.rr(g, -288, -31, 576, 62, 8);
    ombre(g, 0.02, 1, f);
    g.fillStyle = acier(g, 0, -29, 0, 29); g.beginPath(); U.rr(g, -270, -29, 540, 58, 6); g.fill();
    g.fillStyle = '#2f6fd0'; g.fillRect(-250, 14, 500, 9);
    g.fillStyle = 'rgba(20,22,26,0.7)'; for (let x = -240; x <= 240; x += 10) g.fillRect(x, -29, 1.5, x % 50 ? 6 : 12);
    for (const x of [-288, 254]) { g.fillStyle = '#26262a'; g.beginPath(); U.rr(g, x, -31, 34, 62, 8); g.fill(); }
    g.fillStyle = '#33363c'; g.beginPath(); U.rr(g, -62, -20, 124, 40, 9); g.fill();
    g.fillStyle = degrade(g, 0, -13, 0, 13, '#e6f27a', '#a9c43a'); g.beginPath(); U.rr(g, -55, -13, 110, 26, 11); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.85)'; g.beginPath(); U.oval(g, 5, -1, 14, 7); g.fill();
    g.fillStyle = '#1d1d1f'; g.fillRect(-21, -13, 2.5, 26); g.fillRect(19, -13, 2.5, 26);
    for (const x of [-180, 180]) {
      g.fillStyle = '#33363c'; g.beginPath(); g.arc(x, 0, 22, 0, TAU); g.fill();
      g.fillStyle = degrade(g, x, -16, x, 16, '#e6f27a', '#a9c43a'); g.beginPath(); g.arc(x, 0, 16, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.85)'; g.beginPath(); U.oval(g, x + 4, -4, 6, 4); g.fill();
    }
    g.fillStyle = '#9c7746'; g.beginPath(); U.rr(g, 92, -10, 52, 20, 10); g.fill();         // trou d'accroche
    g.fillStyle = 'rgba(30,30,36,0.55)'; g.font = 'bold 12px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('60 cm', -110, 2);
  },
  equerre(g, d, R, U) {                                // équerre de menuisier (talon en palissandre, lame graduée) et crayon plat
    g.rotate(-0.06);
    ombre(g, -0.06, 1, () => { g.rect(-182, -78, 48, 158); g.rect(-134, -72, 342, 38); });
    g.fillStyle = acier(g, 0, -72, 0, -34); g.fillRect(-150, -72, 358, 38);
    g.fillStyle = 'rgba(20,22,26,0.75)'; for (let x = -124; x < 204; x += 8) g.fillRect(x, -72, 1.4, (x + 124) % 40 ? 6 : 13);
    g.font = 'bold 10px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; for (let x = -84, n = 5; x < 204; x += 40, n += 5) g.fillText(String(n), x, -48);
    g.fillStyle = degrade(g, -182, 0, -134, 0, '#9a4524', '#5c2210'); g.beginPath(); U.rr(g, -182, -78, 48, 158, 6); g.fill();
    g.strokeStyle = 'rgba(255,200,150,0.2)'; g.lineWidth = 1.5; g.beginPath(); for (let k = 0; k < 4; k++) { g.moveTo(-176 + k * 11, -72); g.lineTo(-172 + k * 11, 74); } g.stroke();
    g.fillStyle = '#e8c050'; g.fillRect(-182, -78, 48, 7); for (const y of [-55, 0, 52]) { g.beginPath(); g.arc(-158, y, 5, 0, TAU); g.fill(); }
    g.save(); g.translate(50, 30); g.rotate(0.14);                                          // crayon de menuisier, plat
    ombre(g, 0.08, 0.8, () => g.rect(-125, -12, 260, 24));
    g.fillStyle = '#d8352a'; g.fillRect(-125, -12, 222, 24); g.fillStyle = '#b02820'; g.fillRect(-125, 4, 222, 8);
    g.fillStyle = '#e8c79a'; g.beginPath(); g.moveTo(97, -12); g.lineTo(128, -6); g.lineTo(128, 6); g.lineTo(97, 12); g.closePath(); g.fill();
    g.fillStyle = '#333'; g.fillRect(124, -5, 6, 10);
    g.fillStyle = 'rgba(255,255,255,0.8)'; g.font = 'bold 11px sans-serif'; g.fillText('MENUISIER', -10, -3);
    g.restore();
  },
  rouleau(g, d, R, U) {                                // rouleau du ruban de masquage qui a tracé la piste, bout décollé
    ombre(g, 0, 1, () => { g.moveTo(-10, 56); g.lineTo(150, 64); g.lineTo(150, 98); g.lineTo(-10, 90); g.closePath(); });
    g.fillStyle = '#e6d9a8'; g.beginPath(); g.moveTo(-10, 56); g.lineTo(142, 64);              // la languette déroulée, bout déchiré
    for (let k = 0; k <= 6; k++) g.lineTo(k % 2 ? 150 : 143, 64 + k * 5.5);
    g.lineTo(-10, 90); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(150,130,80,0.4)'; g.lineWidth = 1.5; g.setLineDash([5, 9]); g.beginPath(); g.moveTo(0, 74); g.lineTo(138, 80); g.stroke(); g.setLineDash([]);
    ombre(g, 0, 1.2, () => { g.arc(0, 0, 76, 0, TAU); g.moveTo(40, 0); g.arc(0, 0, 40, 0, TAU, true); });
    const gr = g.createRadialGradient(-20, -20, 30, 0, 0, 78); gr.addColorStop(0, '#f6ecc8'); gr.addColorStop(1, '#d4c08a');
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 76, 0, TAU); g.arc(0, 0, 46, 0, TAU, true); g.fill();
    g.strokeStyle = 'rgba(150,120,60,0.25)'; g.lineWidth = 1; g.beginPath(); for (let r = 50; r < 76; r += 4) { g.moveTo(r, 0); g.arc(0, 0, r, 0, TAU); } g.stroke();
    g.fillStyle = '#a8743e'; g.beginPath(); g.arc(0, 0, 46, 0, TAU); g.arc(0, 0, 39, 0, TAU, true); g.fill();
    g.strokeStyle = 'rgba(40,22,6,0.3)'; g.lineWidth = 4; g.beginPath(); g.arc(2, 3, 37, 0, TAU); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 5; g.beginPath(); g.arc(0, 0, 68, Math.PI * 1.05, Math.PI * 1.45); g.stroke();
  },
  visserie(g, d, R, U) {                               // visserie éparpillée : vis, clous, rondelles, écrous, chevilles
    for (let k = 0; k < 12; k++) {
      const u = R() * TAU, q = Math.sqrt(R()) * 66;
      g.save(); g.translate(Math.cos(u) * q, Math.sin(u) * q * 0.75); g.rotate(R() * TAU); piece(g, R, R()); g.restore();
    }
  },
  tournevis(g, d, R, U) {                              // deux tournevis côte à côte : plat (rouge et jaune) et cruciforme (bleu), manches striés
    for (let k = 0; k < 2; k++) {
      const a = Math.PI / 2 + (k ? -0.06 : 0.05), c0 = k ? '#2f6fd0' : '#d8352a', c1 = k ? '#1d1d1f' : '#ffd23a';
      g.save(); g.translate(k ? 34 : -34, k ? 16 : -12); g.rotate(a);
      ombre(g, a, 0.9, () => { U.rr(g, -112, -15, 104, 30, 13); g.rect(-10, -4, 118, 8); });
      g.fillStyle = acier(g, 0, -4, 0, 4); g.fillRect(-12, -4, 114, 8);
      if (k) { g.fillStyle = '#5d636c'; g.beginPath(); g.moveTo(102, -4); g.lineTo(114, -1.5); g.lineTo(114, 1.5); g.lineTo(102, 4); g.closePath(); g.fill(); g.fillStyle = '#2a2a2e'; g.fillRect(106, -0.6, 8, 1.2); }
      else { g.fillStyle = '#7d838c'; g.fillRect(102, -5, 12, 10); }
      g.fillStyle = degrade(g, 0, -15, 0, 15, c0, U.rgbStr(U.mix(U.hexRgb(c0), [0, 0, 0], 0.35))); g.beginPath(); U.rr(g, -112, -15, 104, 30, 13); g.fill();
      g.fillStyle = c1; for (let x = -96; x < -28; x += 13) g.fillRect(x, -15, 5, 30);
      g.fillStyle = '#9aa0aa'; g.fillRect(-12, -9, 6, 18);
      g.fillStyle = 'rgba(255,255,255,0.3)'; g.beginPath(); U.rr(g, -106, -11, 92, 6, 3); g.fill();
      g.restore();
    }
  },
  marteau(g, d, R, U) {                                // marteau de charpentier : tête d'acier à panne fendue, manche verni, poignée caoutchouc
    const a = Math.PI / 2 - 0.05; g.rotate(a);
    const tete = () => { g.moveTo(-172, -16); g.lineTo(-130, -16); g.lineTo(-130, 60); g.lineTo(-172, 60); g.closePath(); g.moveTo(-170, -14); g.quadraticCurveTo(-150, -58, -112, -74); g.lineTo(-124, -50); g.quadraticCurveTo(-140, -36, -132, -14); g.closePath(); };
    ombre(g, a, 1, () => { U.rr(g, -150, -13, 262, 26, 12); tete(); });
    g.fillStyle = degrade(g, 0, -13, 0, 13, '#e8b878', '#a06a32'); g.beginPath(); U.rr(g, -150, -12, 250, 24, 11); g.fill();
    g.strokeStyle = 'rgba(110,60,20,0.35)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(-120, -4); g.lineTo(60, -6); g.moveTo(-100, 5); g.lineTo(40, 4); g.stroke();
    g.fillStyle = '#26262a'; g.beginPath(); U.rr(g, 14, -15, 100, 30, 14); g.fill();
    g.fillStyle = '#3c3c42'; for (let x = 24; x < 104; x += 12) g.fillRect(x, -15, 5, 30);
    g.fillStyle = acier(g, -172, -70, -130, 60); g.beginPath(); tete(); g.fill();
    g.fillStyle = '#c3c8d0'; g.beginPath(); U.rr(g, -176, 36, 50, 26, 6); g.fill();       // la frappe
    g.strokeStyle = 'rgba(30,32,36,0.5)'; g.lineWidth = 1.5; g.beginPath(); g.rect(-172, -16, 42, 76); g.stroke();
    g.fillStyle = '#5d636c'; g.beginPath(); g.arc(-151, 10, 5, 0, TAU); g.fill();
  },
  caisse(g, d, R, U) {                                 // caisse à outils en tôle rouge : couvercle rabattu, plateau à casiers, outils en vrac
    const a = 0.05; g.rotate(a);
    ombre(g, a, 1.8, () => U.rr(g, -260, -205, 520, 345, 18));
    g.fillStyle = '#9e221c'; g.beginPath(); U.rr(g, -258, -205, 516, 100, 14); g.fill();          // couvercle ouvert, vu par l'intérieur
    g.fillStyle = '#7d1a15'; g.beginPath(); U.rr(g, -242, -192, 484, 72, 10); g.fill();
    g.strokeStyle = acier(g, 0, -180, 0, -140); g.lineWidth = 9; g.lineCap = 'round'; g.beginPath(); U.rr(g, -100, -178, 200, 44, 16); g.stroke();
    for (const x of [-200, 160]) { g.fillStyle = acier(g, x, -200, x + 40, -186); g.fillRect(x, -204, 40, 16); }
    g.fillStyle = degrade(g, 0, -112, 0, 140, '#e44c3c', '#b02a22'); g.beginPath(); U.rr(g, -260, -112, 520, 252, 16); g.fill();
    g.fillStyle = acier(g, 0, -118, 0, -108); g.fillRect(-244, -118, 488, 9);                   // charnière
    for (const x of [-180, 130]) { g.fillStyle = acier(g, x, 126, x + 50, 146); g.beginPath(); U.rr(g, x, 124, 50, 22, 5); g.fill(); }
    g.fillStyle = '#2a1412'; g.beginPath(); U.rr(g, -244, -96, 488, 214, 10); g.fill();
    g.fillStyle = '#cf3a2e'; g.beginPath(); U.rr(g, -236, -90, 472, 106, 8); g.fill();           // plateau à casiers
    const cas = [[-230, 112], [-110, 132], [30, 92], [130, 100]];
    for (const q of cas) { g.fillStyle = '#8e231c'; g.beginPath(); U.rr(g, q[0], -84, q[1], 94, 6); g.fill(); }
    for (let k = 0; k < 7; k++) { g.save(); g.translate(-200 + R() * 60, -66 + k * 11); g.rotate((R() - 0.5) * 0.6); visCouchee(g, 34, k % 3 ? '#c3c8d0' : '#d6a843'); g.restore(); }
    g.fillStyle = '#1d1d1f'; g.beginPath(); g.arc(-50, -38, 34, 0, TAU); g.arc(-50, -38, 15, 0, TAU, true); g.fill();     // chatterton
    g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = 3; g.beginPath(); g.arc(-50, -38, 28, 3.6, 5); g.stroke();
    for (let k = 0; k < 3; k++) { g.save(); g.translate(0 + k * 16, -10 - k * 22); piece(g, R, 0.6); g.restore(); }
    for (let k = 0; k < 6; k++) { g.fillStyle = acier(g, 0, 0, 0, 6); g.fillRect(40, -76 + k * 14, 40 + k * 7, 5); }                 // forets rangés par taille
    for (let k = 0; k < 8; k++) { g.save(); g.translate(150 + (k % 4) * 20, -60 + Math.floor(k / 4) * 34); g.rotate(1.5); piece(g, R, 0.9); g.restore(); }
    g.save(); g.translate(-60, 70); g.rotate(-0.04);                                          // marteau dans le fond de la caisse
    g.fillStyle = degrade(g, 0, -9, 0, 9, '#e8b878', '#a06a32'); g.beginPath(); U.rr(g, -160, -9, 230, 18, 8); g.fill();
    g.fillStyle = acier(g, 70, -32, 100, 32); g.fillRect(66, -32, 34, 64); g.restore();
    g.save(); g.translate(150, 66); g.rotate(0.2);                                            // clé à molette
    g.fillStyle = acier(g, 0, -10, 0, 10); g.beginPath(); U.rr(g, -70, -10, 120, 20, 9); g.fill();
    g.beginPath(); g.moveTo(50, -26); g.lineTo(84, -26); g.lineTo(84, -8); g.lineTo(66, -8); g.lineTo(66, 8); g.lineTo(84, 8); g.lineTo(84, 24); g.lineTo(50, 24); g.closePath(); g.fill();
    g.restore();
    g.save(); g.translate(-120, 104); g.rotate(0.03);                                         // tournevis
    g.fillStyle = acier(g, 0, -3, 0, 3); g.fillRect(-10, -3, 110, 6);
    g.fillStyle = '#2bb45a'; g.beginPath(); U.rr(g, -100, -10, 92, 20, 9); g.fill(); g.restore();
    g.strokeStyle = 'rgba(255,255,255,0.22)'; g.lineWidth = 4; g.beginPath(); U.rr(g, -256, -108, 512, 244, 14); g.stroke();
  },
  chutes(g, d, R, U) {                                 // chutes de bois : bout de chevron, triangle de contreplaqué, tourillon, sciure
    g.fillStyle = 'rgba(222,180,118,0.75)'; for (let k = 0; k < 90; k++) { const u = R() * TAU, q = Math.sqrt(R()) * 150; g.fillRect(Math.cos(u) * q + 20, Math.sin(u) * q * 0.6 + 30, 3 + R() * 3, 2 + R() * 2); }
    g.save(); g.translate(90, 50); g.rotate(0.5);                                             // triangle de contreplaqué
    const tri = () => { g.moveTo(-90, -60); g.lineTo(100, -50); g.lineTo(-70, 80); g.closePath(); };
    ombre(g, 0.55, 0.6, tri);
    g.fillStyle = '#e9d09a'; g.beginPath(); tri(); g.fill(); g.strokeStyle = '#b88d50'; g.lineWidth = 4; g.stroke();
    g.strokeStyle = 'rgba(160,110,50,0.3)'; g.lineWidth = 2; g.beginPath(); for (let k = -50; k < 70; k += 18) { g.moveTo(-80, k); g.quadraticCurveTo(-20, k + 8, 40, k - 4); } g.stroke();
    g.restore();
    g.save(); g.translate(-50, -50); g.rotate(-0.35);                                         // bout de chevron, trait de crayon
    ombre(g, -0.35, 1.4, () => g.rect(-120, -42, 240, 84));
    g.fillStyle = degrade(g, 0, -42, 0, 42, '#eac68a', '#c6914c'); g.fillRect(-120, -42, 240, 84);
    g.strokeStyle = 'rgba(140,86,36,0.4)'; g.lineWidth = 2; g.beginPath(); for (let k = -30; k <= 30; k += 12) { g.moveTo(-120, k); g.bezierCurveTo(-40, k + 9, 30, k - 9, 120, k + 3); } g.stroke();
    g.fillStyle = '#8a5a2a'; g.beginPath(); U.oval(g, 20, 6, 12, 7); g.fill(); g.strokeStyle = 'rgba(138,90,42,0.5)'; g.beginPath(); U.oval(g, 20, 6, 20, 12); g.stroke();
    g.fillStyle = 'rgba(120,70,30,0.3)'; g.fillRect(110, -42, 10, 84);
    g.strokeStyle = '#4a4a52'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(60, -42); g.lineTo(62, 42); g.stroke();
    g.restore();
    g.save(); g.translate(-30, 110); g.rotate(0.12);                                          // tourillon
    ombre(g, 0.12, 0.9, () => U.rr(g, -130, -12, 260, 24, 12));
    g.fillStyle = degrade(g, 0, -12, 0, 12, '#f4daa6', '#b8864a'); g.beginPath(); U.rr(g, -130, -12, 260, 24, 12); g.fill();
    g.fillStyle = '#d9b47a'; g.beginPath(); U.oval(g, 124, 0, 6, 12); g.fill();
    g.restore();
  },
  scie(g, d, R, U) {                                   // égoïne : lame d'acier, denture, poignée fermée en hêtre, vis de laiton
    const a = -0.04; g.rotate(a);
    const lame = () => { g.moveTo(-210, -58); g.lineTo(310, -22); g.lineTo(310, 40); g.lineTo(-210, 64); g.closePath(); };
    const manche = () => { U.rr(g, -338, -74, 150, 148, 40); U.rr(g, -306, -36, 82, 74, 24); };
    ombre(g, a, 1, lame); ombre(g, a, 1.3, manche, true);
    g.fillStyle = acier(g, 0, -58, 0, 64); g.beginPath(); lame(); g.fill();
    g.fillStyle = '#7d838c'; g.beginPath(); g.moveTo(-210, 60);                               // denture
    for (let k = 0; k <= 104; k++) { const t = k / 104, x = -210 + 520 * t, y = 64 - 24 * t; g.lineTo(x, y + (k % 2 ? 7 : 0)); }
    g.lineTo(310, 34); g.lineTo(-210, 56); g.closePath(); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.3)'; g.beginPath(); g.moveTo(-180, -40); g.lineTo(290, -12); g.lineTo(290, -2); g.lineTo(-180, -22); g.closePath(); g.fill();
    g.fillStyle = 'rgba(40,44,50,0.35)'; g.font = 'bold 14px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('ACIER TREMPÉ', 40, 14);
    g.fillStyle = degrade(g, -338, -74, -188, 74, '#e2aa68', '#9c6630'); g.beginPath(); manche(); g.fill('evenodd');
    g.strokeStyle = 'rgba(90,50,20,0.45)'; g.lineWidth = 2; g.beginPath(); U.rr(g, -306, -36, 82, 74, 24); g.stroke();
    g.fillStyle = '#e8c050'; for (const y of [-44, 0, 44]) { g.beginPath(); g.arc(-200, y, 6.5, 0, TAU); g.fill(); }
    g.fillStyle = '#9c7a28'; for (const y of [-44, 0, 44]) g.fillRect(-204, y - 1, 8, 2);
  },
  bidon(g, d, R, U) {                                  // bidon d'huile moteur (bouchon, étiquette), entonnoir couché, flaque
    U.blob(g, 70, 50, 90, 46, 0.25, R, 'rgba(28,22,14,0.6)');
    g.fillStyle = 'rgba(90,216,255,0.22)'; g.beginPath(); U.oval(g, 60, 40, 40, 16); g.fill();
    const corps = () => { U.rr(g, -150, -100, 220, 170, 28); U.rr(g, -128, -80, 60, 34, 14); };
    ombre(g, 0, 1.8, corps, true);
    g.fillStyle = degrade(g, -150, -100, 70, 70, '#3a8ee0', '#1c5aa8'); g.beginPath(); corps(); g.fill('evenodd');
    g.fillStyle = '#ffffff'; g.beginPath(); U.rr(g, -132, -26, 160, 76, 8); g.fill();
    g.fillStyle = '#d8352a'; g.fillRect(-132, -26, 160, 18);
    g.fillStyle = '#1d1d1f'; g.font = 'bold 22px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('HUILE', -52, 12); g.font = 'bold 15px sans-serif'; g.fillText('10W-40 · 5 L', -52, 36);
    g.fillStyle = '#f2c230'; g.beginPath(); g.arc(30, -62, 26, 0, TAU); g.fill();
    g.strokeStyle = '#c99a18'; g.lineWidth = 3; g.beginPath(); for (let k = 0; k < 12; k++) { const u = k * TAU / 12; g.moveTo(30 + Math.cos(u) * 18, -62 + Math.sin(u) * 18); g.lineTo(30 + Math.cos(u) * 25, -62 + Math.sin(u) * 25); } g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.3)'; g.lineWidth = 6; g.beginPath(); g.moveTo(-136, 60); g.lineTo(-136, -70); g.stroke();
    g.save(); g.translate(150, 60); g.rotate(-0.5);                                           // entonnoir couché
    const ent = () => { g.moveTo(-60, -40); g.lineTo(20, -10); g.lineTo(70, -6); g.lineTo(70, 6); g.lineTo(20, 10); g.lineTo(-60, 40); g.closePath(); };
    ombre(g, -0.5, 0.9, ent);
    g.fillStyle = degrade(g, 0, -40, 0, 40, '#ff9a3a', '#d4600f'); g.beginPath(); ent(); g.fill();
    g.fillStyle = '#b44e0c'; g.beginPath(); U.oval(g, -60, 0, 9, 40); g.fill();
    g.restore();
  },
  peinture(g, d, R, U) {                               // pots de peinture : un ouvert (bleu, bâton), un fermé, le couvercle retourné, coulures
    const pot = (x, y, r, col, ouvert) => {
      ombre(g, 0, 1.8, () => g.arc(x, y, r, 0, TAU));
      g.fillStyle = acier(g, x - r, y - r, x + r, y + r); g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(40,44,50,0.45)'; g.lineWidth = 2; g.beginPath(); g.arc(x, y, r * 0.9, 0, TAU); g.stroke();
      if (ouvert) {
        const gr = g.createRadialGradient(x - r * 0.3, y - r * 0.3, 4, x, y, r * 0.86); gr.addColorStop(0, U.rgbStr(U.mix(U.hexRgb(col), [255, 255, 255], 0.35))); gr.addColorStop(1, col);
        g.fillStyle = gr; g.beginPath(); g.arc(x, y, r * 0.84, 0, TAU); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.45)'; g.beginPath(); U.oval(g, x - r * 0.3, y - r * 0.35, r * 0.26, r * 0.12); g.fill();
      } else {
        g.fillStyle = acier(g, x - r, y - r, x + r, y + r); g.beginPath(); g.arc(x, y, r * 0.8, 0, TAU); g.fill();
        g.strokeStyle = 'rgba(40,44,50,0.35)'; g.lineWidth = 1.5; for (const q of [0.7, 0.55, 0.3]) { g.beginPath(); g.arc(x, y, r * q, 0, TAU); g.stroke(); }
        g.fillStyle = col; g.beginPath(); g.moveTo(x + r * 0.55, y - r * 0.85); g.quadraticCurveTo(x + r * 0.75, y - r * 0.45, x + r * 0.62, y - r * 0.2);
        g.quadraticCurveTo(x + r * 0.9, y - r * 0.5, x + r * 0.9, y - r * 0.44); g.arc(x, y, r, -0.45, -1.0, true); g.closePath(); g.fill();
        g.strokeStyle = col; g.lineWidth = r * 0.12; g.beginPath(); g.arc(x, y, r * 0.93, -1.3, 1.9); g.stroke();   // peinture séchée sur le bord
        g.fillStyle = col; g.beginPath(); g.arc(x + r * 0.2, y + r * 0.15, r * 0.16, 0, TAU); g.fill();               // pastille de couleur sur le couvercle
        g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 3; g.beginPath(); g.arc(x, y, r * 0.75, 3.5, 4.6); g.stroke();
      }
    };
    g.strokeStyle = 'rgba(47,111,208,0.55)'; g.lineWidth = 7; g.beginPath(); g.arc(-150, 170, 96, 0.4, 4.6); g.stroke();   // trace d'un pot déplacé
    g.fillStyle = 'rgba(47,111,208,0.8)'; g.beginPath(); for (let k = 0; k < 7; k++) { const x = 40 + k * 26 + R() * 10, y = 90 + k * 12 + R() * 10, r = 3 + R() * 6; g.moveTo(x + r, y); g.arc(x, y, r, 0, TAU); } g.fill();
    pot(200, -100, 84, '#3aa457', false);
    pot(-60, -10, 104, '#2f6fd0', true);
    g.save(); g.translate(-60, -10); g.rotate(-0.6);                                          // bâton à mélanger
    ombre(g, -0.6, 1.2, () => U.rr(g, -40, -12, 210, 24, 6));
    g.fillStyle = '#e8c48a'; g.beginPath(); U.rr(g, -40, -12, 210, 24, 6); g.fill();
    g.fillStyle = '#2f6fd0'; g.beginPath(); U.rr(g, -40, -12, 120, 24, 6); g.fill(); g.restore();
    g.save(); g.translate(-230, 160); g.rotate(0.3);                                          // couvercle retourné, l'intérieur peint
    ombre(g, 0, 0.6, () => g.arc(0, 0, 90, 0, TAU));
    g.fillStyle = acier(g, -90, -90, 90, 90); g.beginPath(); g.arc(0, 0, 90, 0, TAU); g.fill();
    g.fillStyle = 'rgba(47,111,208,0.9)'; g.beginPath(); g.arc(0, 0, 72, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 3; g.beginPath(); g.arc(0, 0, 80, 0, TAU); g.stroke(); g.restore();
    g.save(); g.translate(120, 150); g.rotate(-0.3);                                          // pinceau
    ombre(g, -0.3, 0.8, () => U.rr(g, -110, -9, 200, 18, 8));
    g.fillStyle = '#c98a4a'; g.beginPath(); U.rr(g, -110, -8, 120, 16, 8); g.fill();
    g.fillStyle = acier(g, 0, -12, 0, 12); g.fillRect(10, -12, 28, 24);
    g.fillStyle = '#3a2a1a'; g.beginPath(); g.moveTo(38, -12); g.lineTo(80, -10); g.lineTo(90, 0); g.lineTo(80, 10); g.lineTo(38, 12); g.closePath(); g.fill();
    g.fillStyle = '#3aa457'; g.beginPath(); g.moveTo(60, -11); g.lineTo(80, -10); g.lineTo(90, 0); g.lineTo(80, 10); g.lineTo(60, 11); g.closePath(); g.fill(); g.restore();
  },
  tasse(g, d, R, U) {                                  // grand mug de café : céramique bleue, café et mousse, anse, auréole
    g.strokeStyle = 'rgba(105,55,15,0.32)'; g.lineWidth = 4; g.beginPath(); g.arc(-70, 64, 56, 0.6, 5.4); g.stroke();
    g.fillStyle = 'rgba(105,55,15,0.5)'; g.beginPath(); g.arc(40, 74, 6, 0, TAU); g.arc(56, 82, 3.5, 0, TAU); g.fill();
    const anse = () => { U.rr(g, 44, -22, 52, 44, 20); U.rr(g, 56, -11, 28, 22, 10); };
    ombre(g, 0, 1.8, () => g.arc(0, 0, 62, 0, TAU)); ombre(g, 0, 1.4, anse, true);
    g.fillStyle = degrade(g, 44, -22, 96, 22, '#4a88e6', '#1f4fa8'); g.beginPath(); anse(); g.fill('evenodd');
    const gr = g.createRadialGradient(-20, -20, 10, 0, 0, 64); gr.addColorStop(0, '#5a96ee'); gr.addColorStop(1, '#1f4fa8');
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 62, 0, TAU); g.fill();
    g.fillStyle = '#f4f2ea'; g.beginPath(); g.arc(0, 0, 54, 0, TAU); g.fill();
    const gc = g.createRadialGradient(-8, -8, 4, 0, 0, 48); gc.addColorStop(0, '#7a4524'); gc.addColorStop(1, '#3a1d0a');
    g.fillStyle = gc; g.beginPath(); g.arc(0, 0, 47, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(214,170,120,0.55)'; g.lineWidth = 4; g.beginPath(); g.arc(0, 0, 44, 0, TAU); g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.3)'; g.beginPath(); U.oval(g, -14, -18, 16, 7); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.55)'; g.beginPath(); U.oval(g, -30, -40, 14, 5); g.fill();
  },
  aureoles(g, d, R, U) {                               // auréoles de café laissées par le mug (anneaux secs, plus foncés au bord)
    for (let k = 0; k < 3; k++) {
      const x = (R() - 0.5) * 80, y = (R() - 0.5) * 60, r = 42 + R() * 14, a0 = R() * TAU, l = TAU * (0.55 + R() * 0.45);
      g.fillStyle = 'rgba(120,66,20,0.06)'; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(105,55,15,0.36)'; g.lineWidth = 3 + R() * 2; g.beginPath(); g.arc(x, y, r, a0, a0 + l); g.stroke();
      g.strokeStyle = 'rgba(105,55,15,0.14)'; g.lineWidth = 8; g.beginPath(); g.arc(x, y, r - 4, a0 + 0.3, a0 + l * 0.7); g.stroke();
    }
  },
  cles(g, d, R, U) {                                   // trousse de clés mixtes en toile : sept clés rangées par taille, poches cousues, sangle
    const a = -0.1; g.rotate(a);
    ombre(g, a, 1, () => U.rr(g, -200, -120, 400, 240, 16));
    g.fillStyle = '#7a7444'; g.beginPath(); U.rr(g, -200, -120, 400, 240, 16); g.fill();
    g.strokeStyle = 'rgba(240,230,190,0.5)'; g.lineWidth = 2; g.setLineDash([7, 6]); g.beginPath(); U.rr(g, -190, -110, 380, 220, 12); g.stroke();
    const T = [8, 10, 12, 13, 15, 17, 19];
    for (let k = 0; k < 7; k++) {
      const x = -162 + k * 54, s = 13 + k * 2.2, y = -70 - k * 3;
      g.fillStyle = acier(g, x - s, 0, x + s, 0); g.fillRect(x - s * 0.36, y, s * 0.72, 150);
      g.fillStyle = acier(g, x - s, y - s, x + s, y + s); g.beginPath(); g.arc(x, y, s, 0, TAU); g.fill();
      g.fillStyle = '#4a4636'; g.beginPath(); hexa(g, x, y, s * 0.55, 0.3); g.fill();
    }
    g.setLineDash([]);
    g.fillStyle = '#5e5a32'; g.beginPath(); U.rr(g, -200, -6, 400, 126, 14); g.fill();      // rabat des poches
    g.strokeStyle = 'rgba(240,230,190,0.45)'; g.lineWidth = 2; g.setLineDash([6, 6]); g.beginPath(); g.moveTo(-190, 4); g.lineTo(190, 4);
    for (let k = 1; k < 7; k++) { g.moveTo(-189 + k * 54, 8); g.lineTo(-189 + k * 54, 110); } g.stroke(); g.setLineDash([]);
    g.fillStyle = 'rgba(250,245,220,0.85)'; g.font = 'bold 15px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let k = 0; k < 7; k++) g.fillText(String(T[k]), -162 + k * 54, 40);
    g.fillStyle = '#6a3d1e'; g.fillRect(186, -34, 42, 60); g.fillStyle = acier(g, 210, -26, 226, 18); g.fillRect(212, -24, 14, 40);   // sangle et boucle
  },
  perceuse(g, d, R, U) {                               // perceuse-visseuse couchée sur le flanc : carter, mandrin, foret, poignée, batterie
    const corps = () => { U.rr(g, -150, -110, 236, 78, 32); g.moveTo(-84, -40); g.lineTo(-18, -40); g.lineTo(4, 64); g.lineTo(-74, 64); g.closePath(); U.rr(g, -116, 56, 156, 66, 12); };
    ombre(g, 0, 1.4, corps);
    g.fillStyle = acier(g, 0, -90, 0, -50); g.fillRect(176, -77, 82, 10);                     // foret hélicoïdal
    g.strokeStyle = 'rgba(40,44,50,0.55)'; g.lineWidth = 1.5; g.beginPath(); for (let x = 180; x < 252; x += 7) { g.moveTo(x, -77); g.lineTo(x + 5, -67); } g.stroke();
    g.fillStyle = '#7d838c'; g.beginPath(); g.moveTo(258, -77); g.lineTo(270, -72); g.lineTo(258, -67); g.closePath(); g.fill();
    g.fillStyle = '#26262a'; g.beginPath(); U.rr(g, -116, 56, 156, 66, 12); g.fill();               // batterie
    g.fillStyle = '#1d8f8f'; g.fillRect(-116, 70, 156, 10);
    g.fillStyle = '#5ee87a'; for (let k = 0; k < 3; k++) { g.beginPath(); g.arc(-90 + k * 16, 100, 4, 0, TAU); g.fill(); }
    g.fillStyle = '#26262a'; g.beginPath(); g.moveTo(-84, -40); g.lineTo(-18, -40); g.lineTo(4, 64); g.lineTo(-74, 64); g.closePath(); g.fill();   // poignée
    g.fillStyle = '#1d8f8f'; g.beginPath(); g.moveTo(-60, -34); g.lineTo(-36, -34); g.lineTo(-20, 56); g.lineTo(-44, 56); g.closePath(); g.fill();
    g.fillStyle = '#d8352a'; g.beginPath(); U.rr(g, -16, -36, 20, 34, 8); g.fill();             // gâchette
    g.fillStyle = degrade(g, 0, -110, 0, -32, '#2bc0bc', '#137371'); g.beginPath(); U.rr(g, -150, -110, 236, 78, 32); g.fill();   // carter moteur
    g.fillStyle = '#16302f'; for (let k = 0; k < 4; k++) g.fillRect(-130 + k * 13, -96, 6, 50);
    g.fillStyle = 'rgba(255,255,255,0.28)'; g.beginPath(); U.rr(g, -110, -104, 170, 12, 6); g.fill();
    g.fillStyle = '#26262a'; g.beginPath(); U.rr(g, 80, -106, 44, 70, 10); g.fill();             // boîte de vitesses
    g.fillStyle = '#e8c050'; g.beginPath(); U.rr(g, 92, -116, 22, 12, 4); g.fill();
    g.fillStyle = acier(g, 0, -98, 0, -46); g.beginPath(); U.rr(g, 122, -98, 56, 52, 10); g.fill();   // mandrin
    g.fillStyle = 'rgba(40,44,50,0.4)'; for (let x = 128; x < 174; x += 7) g.fillRect(x, -96, 2, 48);
  },
  pince(g, d, R, U) {                                  // pince universelle : mors d'acier striés, axe riveté, manches gainés rouge et jaune
    const a = 0.25; g.rotate(a); g.scale(1.35, 1.35);
    const bras = s => { g.moveTo(0, -14 * s); g.lineTo(118, -3 * s); g.lineTo(118, 3 * s); g.lineTo(0, 8 * s); g.quadraticCurveTo(-60, 30 * s, -175, 30 * s); g.lineTo(-175, 12 * s); g.quadraticCurveTo(-60, 10 * s, 0, -14 * s); g.closePath(); };
    ombre(g, a, 0.9, () => { bras(1); bras(-1); });
    for (const s of [1, -1]) {
      g.fillStyle = acier(g, 0, -20, 0, 20); g.beginPath(); bras(s); g.fill();
      g.fillStyle = s > 0 ? '#d8352a' : '#f2c230'; g.beginPath(); g.moveTo(-50, 7 * s); g.quadraticCurveTo(-110, 26 * s, -178, 32 * s); g.lineTo(-178, 9 * s); g.quadraticCurveTo(-110, 6 * s, -50, -1 * s); g.closePath(); g.fill();
    }
    g.strokeStyle = 'rgba(30,32,36,0.5)'; g.lineWidth = 1.5; g.beginPath(); for (let x = 50; x < 112; x += 8) { g.moveTo(x, -6); g.lineTo(x + 4, 6); } g.stroke();
    g.fillStyle = acier(g, -14, -14, 14, 14); g.beginPath(); g.arc(0, 0, 15, 0, TAU); g.fill();
    g.fillStyle = '#5d636c'; g.beginPath(); g.arc(0, 0, 6, 0, TAU); g.fill();
  },
  boitevis(g, d, R, U) {                               // boîte de rangement à casiers (couvercle transparent) : vis, clous, chevilles, rondelles
    const a = 0.08; g.rotate(a);
    ombre(g, a, 1.4, () => U.rr(g, -180, -120, 360, 240, 16));
    g.fillStyle = '#34506e'; g.beginPath(); U.rr(g, -180, -120, 360, 240, 16); g.fill();
    for (let r = 0; r < 3; r++) for (let q = 0; q < 4; q++) {
      const x = -166 + q * 84, y = -106 + r * 72;
      g.fillStyle = '#1f3349'; g.beginPath(); U.rr(g, x, y, 78, 66, 8); g.fill();
      const t = ((r * 4 + q) * 0.37) % 1;
      for (let k = 0; k < 6; k++) { g.save(); g.translate(x + 16 + R() * 46, y + 14 + R() * 38); g.rotate(R() * TAU); g.scale(0.75, 0.75); piece(g, R, t); g.restore(); }
    }
    g.fillStyle = 'rgba(220,240,255,0.1)'; g.beginPath(); U.rr(g, -180, -120, 360, 240, 16); g.fill();     // couvercle transparent
    g.fillStyle = 'rgba(255,255,255,0.16)'; g.beginPath(); g.moveTo(-120, -120); g.lineTo(-60, -120); g.lineTo(-160, 120); g.lineTo(-180, 120); g.lineTo(-180, 30); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(40, -120); g.lineTo(70, -120); g.lineTo(-30, 120); g.lineTo(-60, 120); g.closePath(); g.fill();
    g.fillStyle = '#e8b030'; g.beginPath(); U.rr(g, -30, 112, 60, 14, 5); g.fill();
  },
  lime(g, d, R, U) {                                   // lime plate : manche en bois et virole de laiton, taille croisée
    const a = Math.PI / 2 + 0.05; g.rotate(a);
    const corps = () => { g.moveTo(-86, -14); g.lineTo(166, -6); g.lineTo(172, 0); g.lineTo(166, 6); g.lineTo(-86, 14); g.closePath(); };
    ombre(g, a, 0.8, () => { corps(); U.rr(g, -172, -15, 80, 30, 12); });
    g.fillStyle = '#6d737c'; g.beginPath(); corps(); g.fill();
    g.save(); g.beginPath(); corps(); g.clip();
    g.strokeStyle = 'rgba(20,22,26,0.4)'; g.lineWidth = 1; g.beginPath(); for (let x = -90; x < 180; x += 6) { g.moveTo(x, -15); g.lineTo(x + 10, 15); g.moveTo(x + 10, -15); g.lineTo(x, 15); } g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.22)'; g.fillRect(-90, -12, 260, 5); g.restore();
    g.fillStyle = degrade(g, 0, -15, 0, 15, '#dca468', '#a06a32'); g.beginPath(); U.rr(g, -172, -15, 80, 30, 12); g.fill();
    g.fillStyle = '#d6a843'; g.fillRect(-96, -13, 12, 26);
  },
  chargeur(g, d, R, U) {                               // chargeur de batterie : socle ventilé, batterie posée (voyant vert), câble et prise
    g.strokeStyle = '#1d1d1f'; g.lineWidth = 7; g.lineCap = 'round'; g.beginPath(); g.moveTo(-118, 20); g.bezierCurveTo(-200, 40, -150, 110, -230, 96); g.bezierCurveTo(-290, 86, -250, 30, -200, 30); g.stroke();
    g.fillStyle = '#2e3035'; g.beginPath(); U.rr(g, -226, 18, 40, 26, 6); g.fill(); g.fillStyle = acier(g, 0, 22, 0, 40); g.fillRect(-244, 22, 18, 5); g.fillRect(-244, 35, 18, 5);
    ombre(g, 0, 1.3, () => U.rr(g, -120, -70, 240, 140, 22));
    g.fillStyle = degrade(g, 0, -70, 0, 70, '#44474e', '#26282c'); g.beginPath(); U.rr(g, -120, -70, 240, 140, 22); g.fill();
    g.fillStyle = '#1a1b1e'; for (let k = 0; k < 6; k++) g.fillRect(-100 + k * 12, 40, 6, 20);
    ombre(g, 0, 0.8, () => U.rr(g, -70, -52, 150, 96, 14));
    g.fillStyle = '#26262a'; g.beginPath(); U.rr(g, -70, -52, 150, 96, 14); g.fill();
    g.fillStyle = '#1d8f8f'; g.fillRect(-70, -30, 150, 10);
    const gl = g.createRadialGradient(92, 30, 2, 92, 30, 22); gl.addColorStop(0, 'rgba(110,255,140,0.9)'); gl.addColorStop(1, 'rgba(110,255,140,0)');
    g.fillStyle = gl; g.beginPath(); g.arc(92, 30, 22, 0, TAU); g.fill();
    g.fillStyle = '#7dff9a'; g.beginPath(); g.arc(92, 30, 5, 0, TAU); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.6)'; g.font = 'bold 13px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('18 V', 5, 10);
  },
  serre(g, d, R, U) {                                  // presse en C (fonte bleue) : vis traversante, levier en T, patin
    const a = -0.35; g.rotate(a);
    const cadre = () => { U.rr(g, -96, -84, 170, 38, 16); U.rr(g, -96, -84, 42, 168, 16); U.rr(g, -96, 46, 170, 38, 16); };
    ombre(g, a, 1.2, () => { cadre(); g.rect(38, -112, 14, 150); g.rect(6, -118, 78, 14); });
    g.fillStyle = degrade(g, -96, -84, 74, 84, '#5a8ce0', '#24467e'); g.beginPath(); cadre(); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.2)'; g.fillRect(-88, -78, 150, 6); g.fillRect(-88, -70, 6, 140);
    g.fillStyle = acier(g, 38, 0, 52, 0); g.fillRect(38, -112, 14, 146);                      // vis filetée
    g.strokeStyle = 'rgba(40,44,50,0.5)'; g.lineWidth = 1.2; g.beginPath(); for (let y = -100; y < 30; y += 5) { g.moveTo(38, y); g.lineTo(52, y + 3); } g.stroke();
    g.fillStyle = '#26262a'; g.beginPath(); U.rr(g, 28, 30, 34, 12, 4); g.fill();            // patin
    g.fillStyle = acier(g, 0, -118, 0, -104); g.beginPath(); U.rr(g, 2, -118, 86, 14, 7); g.fill();   // levier en T
    g.fillStyle = '#d8352a'; for (const x of [2, 88]) { g.beginPath(); g.arc(x, -111, 9, 0, TAU); g.fill(); }
  },
  carton(g, d, R, U) {                                 // boîte de clous en carton, rabats ouverts, écrite au feutre
    const a = 0.12; g.rotate(a);
    const rabats = () => { g.moveTo(-110, -80); g.lineTo(110, -80); g.lineTo(96, -138); g.lineTo(-96, -138); g.closePath(); g.moveTo(-110, -80); g.lineTo(-150, -66); g.lineTo(-150, 66); g.lineTo(-110, 80); g.closePath(); g.moveTo(110, -80); g.lineTo(146, -62); g.lineTo(146, 62); g.lineTo(110, 80); g.closePath(); };
    ombre(g, a, 1.5, () => { g.rect(-110, -80, 220, 160); rabats(); });
    g.fillStyle = '#ddb072'; g.beginPath(); rabats(); g.fill(); g.strokeStyle = 'rgba(120,80,30,0.45)'; g.lineWidth = 2; g.stroke();
    g.fillStyle = '#c8955a'; g.fillRect(-110, -80, 220, 160);
    g.fillStyle = '#8a5e30'; g.fillRect(-100, -70, 200, 140);
    for (let k = 0; k < 46; k++) {                     // les clous, en vrac
      const x = -90 + R() * 180, y = -60 + R() * 120, u = R() * TAU, l = 26 + R() * 8;
      g.strokeStyle = '#3a2814'; g.lineWidth = 3; g.beginPath(); g.moveTo(x + 1, y + 2); g.lineTo(x + Math.cos(u) * l + 1, y + Math.sin(u) * l + 2); g.stroke();
      g.strokeStyle = '#b9bec7'; g.lineWidth = 2.2; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(u) * l, y + Math.sin(u) * l); g.stroke();
      g.fillStyle = '#d6dae0'; g.beginPath(); g.arc(x, y, 3.2, 0, TAU); g.fill();
    }
    g.fillStyle = '#26262a'; g.font = 'bold 24px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('CLOUS 40', 0, -110);
  },
};

// ── obstacles ronds : l'étau (le générique est trop sage) ──
const OBJETS = {
  etau(g, r, R, U) {                                   // étau d'établi : base pivotante boulonnée, fonte bleue, mors striés, planche serrée, vis et levier
    const s = r[2], a = 0.35;
    g.save(); g.translate(r[0], r[1]); g.rotate(a);
    ombre(g, a, 1.8, () => { U.rr(g, -0.88 * s, -0.46 * s, 1.2 * s, 0.92 * s, 14); g.rect(-0.36 * s, -0.86 * s, 0.17 * s, 1.72 * s); g.rect(0.3 * s, -0.08 * s, 0.52 * s, 0.16 * s); g.rect(0.79 * s, -0.52 * s, 0.08 * s, 1.04 * s); });
    g.fillStyle = '#22355a'; g.beginPath(); U.rr(g, -0.62 * s, -0.66 * s, 1.0 * s, 1.32 * s, 0.22 * s); g.fill();      // base pivotante
    for (const q of [[-0.5, -0.54], [-0.5, 0.54], [0.26, -0.54], [0.26, 0.54]]) { g.fillStyle = acier(g, q[0] * s - 8, q[1] * s - 8, q[0] * s + 8, q[1] * s + 8); g.beginPath(); hexa(g, q[0] * s, q[1] * s, 0.07 * s, 0.4); g.fill(); }
    g.fillStyle = degrade(g, 0, -0.46 * s, 0, 0.46 * s, '#5a8ce0', '#24467e'); g.beginPath(); U.rr(g, -0.88 * s, -0.46 * s, 0.5 * s, 0.92 * s, 14); g.fill();   // mors fixe
    g.fillStyle = acier(g, -0.86 * s, 0, -0.62 * s, 0); g.beginPath(); U.rr(g, -0.84 * s, -0.28 * s, 0.24 * s, 0.56 * s, 6); g.fill();             // enclume
    g.fillStyle = degrade(g, -0.36 * s, 0, -0.19 * s, 0, '#eac68a', '#c6914c'); g.fillRect(-0.36 * s, -0.86 * s, 0.17 * s, 1.72 * s);        // planche serrée
    g.strokeStyle = 'rgba(140,86,36,0.45)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(-0.32 * s, -0.86 * s); g.lineTo(-0.31 * s, 0.86 * s); g.moveTo(-0.24 * s, -0.86 * s); g.lineTo(-0.25 * s, 0.86 * s); g.stroke();
    g.fillStyle = degrade(g, 0, -0.46 * s, 0, 0.46 * s, '#5a8ce0', '#24467e'); g.beginPath(); U.rr(g, -0.19 * s, -0.46 * s, 0.5 * s, 0.92 * s, 12); g.fill();   // mors mobile
    g.fillStyle = acier(g, 0, -0.46 * s, 0, 0.46 * s); g.fillRect(-0.42 * s, -0.46 * s, 0.06 * s, 0.92 * s); g.fillRect(-0.19 * s, -0.46 * s, 0.06 * s, 0.92 * s);
    g.fillStyle = 'rgba(40,44,50,0.5)'; for (let y = -0.42; y < 0.44; y += 0.08) { g.fillRect(-0.4 * s, y * s, 0.04 * s, 2); g.fillRect(-0.17 * s, y * s, 0.04 * s, 2); }
    g.fillStyle = 'rgba(255,255,255,0.2)'; g.beginPath(); U.rr(g, -0.84 * s, -0.42 * s, 0.4 * s, 0.12 * s, 6); U.rr(g, -0.14 * s, -0.42 * s, 0.4 * s, 0.12 * s, 6); g.fill();
    g.fillStyle = acier(g, 0, -0.07 * s, 0, 0.07 * s); g.fillRect(0.3 * s, -0.07 * s, 0.52 * s, 0.14 * s);    // vis
    g.strokeStyle = 'rgba(40,44,50,0.45)'; g.lineWidth = 1.2; g.beginPath(); for (let x = 0.32; x < 0.8; x += 0.05) { g.moveTo(x * s, -0.07 * s); g.lineTo(x * s + 4, 0.07 * s); } g.stroke();
    g.fillStyle = acier(g, 0.8 * s, 0, 0.87 * s, 0); g.fillRect(0.8 * s, -0.5 * s, 0.07 * s, 1.0 * s);       // levier
    g.fillStyle = '#1d1d1f'; for (const y of [-0.5, 0.5]) { g.beginPath(); g.arc(0.835 * s, y * s, 0.075 * s, 0, TAU); g.fill(); }
    g.fillStyle = acier(g, 0.72 * s, -0.12 * s, 0.94 * s, 0.12 * s); g.beginPath(); g.arc(0.835 * s, 0, 0.11 * s, 0, TAU); g.fill();
    g.restore();
  },
};

// ── murs (capsules) : clé plate géante, serre-joints, réglet d'acier ──
const MURS = {
  cle(g, w, R, U) {                                    // clé plate géante (têtes ouvertes de 24 et 27) couchée dans le coin
    const x1 = w[0], y1 = w[1], L = Math.hypot(w[2] - x1, w[3] - y1), r = w[4], a = Math.atan2(w[3] - y1, w[2] - x1);
    g.save(); g.translate(x1, y1); g.rotate(a);
    const tete = (cx, s, sens) => {                     // tête ouverte de rayon s, mâchoire inclinée de 15° vers l'extérieur
      g.save(); g.translate(cx, 0); g.rotate(sens > 0 ? 0.26 : Math.PI + 0.26);
      const j = s * 0.4, b = Math.asin(0.4);
      g.moveTo(Math.cos(b) * s, j); g.arc(0, 0, s, b, TAU - b); g.lineTo(-s * 0.15, -j); g.lineTo(-s * 0.15, j); g.closePath();
      g.restore();
    };
    const f = () => { U.rr(g, 0, -r, L, 2 * r, r); tete(-r * 0.4, r * 2.1, -1); tete(L + r * 0.4, r * 2.3, 1); };
    ombre(g, a, 1, f);
    g.fillStyle = acier(g, 0, -r * 2.3, 0, r * 2.3); g.beginPath(); f(); g.fill();
    g.strokeStyle = 'rgba(40,44,50,0.45)'; g.lineWidth = 2; g.stroke();
    g.fillStyle = 'rgba(60,66,74,0.3)'; g.beginPath(); U.rr(g, r * 2.2, -r * 0.5, L - r * 4.4, r, r * 0.5); g.fill();
    g.fillStyle = 'rgba(40,44,50,0.7)'; g.font = 'bold 13px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('24', r * 3.2, 0); g.fillText('27', L - r * 3.2, 0); g.font = 'bold 9px sans-serif'; g.fillText('CHROME-VANADIUM', L / 2, 1);
    g.restore();
  },
  serrejoint(g, w, R, U) {                             // serre-joint couché au bord de l'établi : rail cranté, mors fixe, mors mobile, vis et poignée
    const x1 = w[0], y1 = w[1], L = Math.hypot(w[2] - x1, w[3] - y1), r = w[4], a = Math.atan2(w[3] - y1, w[2] - x1), m = x1 < 2000 ? -1 : 1;
    g.save(); g.translate(x1, y1); g.rotate(a);
    if (m < 0) { g.translate(L, 0); g.scale(-1, 1); }   // le second est monté à l'envers (mors fixe à droite)
    const xs = L * 0.62;
    const f = () => { g.rect(-r, -r, L + 2 * r, 2 * r); U.rr(g, -24, -r - 6, 54, 96, 10); U.rr(g, xs - 26, -r - 6, 54, 96, 10); g.rect(xs - 84, 54, 220, 20); };
    ombre(g, a, 1, f, false, m);
    g.fillStyle = degrade(g, 0, 50, 0, 80, '#eac68a', '#c6914c'); g.fillRect(40, 48, xs - 128, 34);          // tasseau serré entre les mors
    g.strokeStyle = 'rgba(140,86,36,0.4)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(40, 58); g.lineTo(xs - 88, 60); g.moveTo(40, 72); g.lineTo(xs - 88, 70); g.stroke();
    g.fillStyle = acier(g, 0, -r, 0, r); g.fillRect(-r, -r, L + 2 * r, 2 * r);                              // rail
    g.fillStyle = 'rgba(40,44,50,0.5)'; for (let x = 40; x < L; x += 14) g.fillRect(x, -r, 3, 5);
    for (const x of [-24, xs - 26]) {
      g.fillStyle = degrade(g, 0, -r - 6, 0, 90, '#e04a3a', '#8e1f1a'); g.beginPath(); U.rr(g, x, -r - 6, 54, 96, 10); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.2)'; g.fillRect(x + 6, -r - 2, 8, 84);
    }
    g.fillStyle = '#1d1d1f'; g.fillRect(30, 50, 10, 30);                                                   // patin du mors fixe
    g.fillStyle = acier(g, 0, 58, 0, 70); g.fillRect(xs - 84, 58, 170, 12);                                // vis
    g.strokeStyle = 'rgba(40,44,50,0.5)'; g.lineWidth = 1.5; g.beginPath(); for (let x = xs - 80; x < xs + 84; x += 5) { g.moveTo(x, 58); g.lineTo(x + 3, 70); } g.stroke();
    g.fillStyle = '#1d1d1f'; g.fillRect(xs - 92, 48, 10, 32);
    g.fillStyle = degrade(g, 0, 52, 0, 78, '#e2aa68', '#9c6630'); g.beginPath(); U.rr(g, xs + 36, 52, 104, 26, 12); g.fill();   // poignée en bois
    g.fillStyle = 'rgba(90,50,20,0.35)'; for (let x = xs + 52; x < xs + 130; x += 14) g.fillRect(x, 52, 4, 26);
    g.restore();
  },
  reglet(g, w, R, U) {                                 // réglet d'acier de 70 cm couché dans le méandre : gravures au mm, chiffres, trou d'accroche
    const x1 = w[0], y1 = w[1], L = Math.hypot(w[2] - x1, w[3] - y1), r = w[4], a = Math.atan2(w[3] - y1, w[2] - x1);
    g.save(); g.translate(x1, y1); g.rotate(a);
    const f = () => U.rr(g, -r - 8, -r, L + 2 * r + 16, 2 * r, 3);
    ombre(g, a, 0.6, f);
    g.fillStyle = acier(g, 0, -r, 0, r); g.beginPath(); f(); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.3)'; g.lineWidth = 1; g.beginPath(); g.moveTo(-r, 2); g.lineTo(L + r, 2); g.moveTo(-r, 5); g.lineTo(L + r, 5); g.stroke();
    g.fillStyle = 'rgba(20,22,26,0.8)'; for (let x = 0; x <= L; x += 5) g.fillRect(x, -r, 1, x % 50 === 0 ? r * 1.2 : x % 25 === 0 ? r * 0.8 : r * 0.45);
    g.font = 'bold 8px sans-serif'; g.textAlign = 'left'; g.textBaseline = 'middle'; for (let x = 50; x < L; x += 50) g.fillText(String(x / 10), x + 2, r * 0.45);
    g.fillStyle = '#5d636c'; g.beginPath(); g.arc(L + r + 1, 0, 4, 0, TAU); g.fill();
    g.restore();
  },
};

// ── obstacles mobiles (dessinés à chaque image : quelques tracés seulement) ──
const MOBILES = {
  ponceuse(g, m, o, now, U, reduceFx) {                // ponceuse orbitale : patin et abrasif, carter orange, pommeau noir, sac à poussière ; elle vibre
    const r = m.r, v = reduceFx ? 0 : 2.2, a = Math.atan2(m.seg[1][1] - m.seg[0][1], m.seg[1][0] - m.seg[0][0]);
    g.save(); g.translate(o.x + Math.sin(now / 19) * v, o.y + Math.cos(now / 23) * v); g.rotate(a);
    g.fillStyle = 'rgba(30,18,6,0.3)'; g.beginPath(); U.rr(g, -r + 6, -r + 8, 2 * r, 2 * r, 10); g.fill();
    g.fillStyle = '#6d737c'; g.beginPath(); U.rr(g, -r * 1.75, -r * 0.34, r * 0.95, r * 0.68, 9); g.fill();   // sac à poussière
    g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(-r * 1.65, 0); g.lineTo(-r * 0.9, 0); g.stroke();
    g.fillStyle = '#26262a'; g.beginPath(); U.rr(g, -r, -r, 2 * r, 2 * r, 9); g.fill();
    g.fillStyle = '#c99a5a'; g.beginPath(); U.rr(g, -r + 3, -r + 3, 2 * r - 6, 2 * r - 6, 7); g.fill();
    g.fillStyle = degrade(g, 0, -r, 0, r, '#ffa040', '#d45c0c'); g.beginPath(); U.rr(g, -r * 0.8, -r * 0.72, r * 1.6, r * 1.44, r * 0.36); g.fill();
    g.fillStyle = '#26262a'; g.beginPath(); U.oval(g, r * 0.05, 0, r * 0.5, r * 0.42); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.28)'; g.beginPath(); U.oval(g, -r * 0.1, -r * 0.14, r * 0.2, r * 0.11); g.fill();
    g.fillStyle = '#e8322a'; g.fillRect(r * 0.58, -5, 8, 10);
    g.restore();
    if (!reduceFx) {                                   // nuage de poussière de bois autour du patin
      g.fillStyle = 'rgba(236,206,150,0.6)'; g.beginPath();
      for (let k = 0; k < 7; k++) { const u = k * 0.9 + now / 240, q = r * (1.1 + 0.25 * Math.sin(now / 80 + k * 2)), x = o.x + Math.cos(u) * q, y = o.y + Math.sin(u) * q, s = 2 + (k % 3); g.moveTo(x + s, y); g.arc(x, y, s, 0, TAU); }
      g.fill();
    }
  },
  ecroufou(g, m, o, now, U, reduceFx) {                // gros écrou fou qui roule en tournant : six facettes éclairées d'en haut à gauche, taraudage
    const r = m.r, sp = reduceFx ? 0.3 : now / 230, C0 = [86, 92, 102], C1 = [236, 240, 246];
    g.fillStyle = 'rgba(30,18,6,0.3)'; g.beginPath(); hexa(g, o.x + 5, o.y + 7, r * 1.08, sp); g.fill();
    for (let k = 0; k < 6; k++) {
      const u0 = sp + k * TAU / 6, u1 = u0 + TAU / 6, t = 0.5 + 0.5 * Math.cos((u0 + u1) / 2 + 2.36);
      g.fillStyle = U.rgbStr(U.mix(C0, C1, t)); g.beginPath(); g.moveTo(o.x, o.y);
      g.lineTo(o.x + Math.cos(u0) * r * 1.08, o.y + Math.sin(u0) * r * 1.08); g.lineTo(o.x + Math.cos(u1) * r * 1.08, o.y + Math.sin(u1) * r * 1.08); g.closePath(); g.fill();
    }
    g.fillStyle = 'rgba(200,206,216,0.85)'; g.beginPath(); g.arc(o.x, o.y, r * 0.72, 0, TAU); g.fill();
    g.fillStyle = '#3a2e22'; g.beginPath(); g.arc(o.x, o.y, r * 0.46, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(220,226,236,0.6)'; g.lineWidth = 1.5; g.beginPath(); g.arc(o.x, o.y, r * 0.38, sp * 2, sp * 2 + 4); g.stroke();
    if (!reduceFx) { g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 2; for (let k = 0; k < 2; k++) { g.beginPath(); g.arc(o.x, o.y, r + 5, sp * 1.4 + k * Math.PI, sp * 1.4 + k * Math.PI + 0.9); g.stroke(); } }
  },
};

// ── zones : huile (gouttes autour de la flaque), sciure (copeaux bouclés par-dessus la poudre) ──
const ZONES = {
  huile(g, z, R, U) {
    U.zone(g, z, R);
    g.fillStyle = 'rgba(28,22,14,0.75)'; g.beginPath();
    for (let k = 0; k < 6; k++) { const u = R() * TAU, q = 1.12 + R() * 0.35, s = 3 + R() * 5, x = z[0] + Math.cos(u) * z[2] * q, y = z[1] + Math.sin(u) * z[3] * q; g.moveTo(x + s, y); g.arc(x, y, s, 0, TAU); }
    g.fill();
  },
  sciure(g, z, R, U) {
    U.zone(g, z, R);
    g.save(); g.translate(z[0], z[1]); g.rotate(z[5]); g.lineCap = 'round'; g.lineWidth = 3.5;
    for (let k = 0; k < 7; k++) {
      const x = (R() - 0.5) * z[2] * 1.3, y = (R() - 0.5) * z[3] * 1.3, s = 6 + R() * 6, a0 = R() * TAU;
      g.strokeStyle = k % 2 ? '#efcf96' : '#cf9f5c'; g.beginPath();
      for (let q = 0; q <= 12; q++) { const u = a0 + q * 0.75, rr = s * (1 - q / 18); g.lineTo(x + Math.cos(u) * rr + q * 1.2, y + Math.sin(u) * rr); }
      g.stroke();
    }
    g.restore();
  },
};

export default {
  id: 'etabli', nom: 'Établi du garage', emoji: '🔧', v: 2, sous: 'Établi du garage · mètre ruban turbo, étau, huile, ponceuse et écrou fou',
  w: 4000, h: 2250, surf: 'etabli', edge: 'chute', table: { x0: 30, y0: 30, x1: 3970, y1: 2220, r: 18 }, W: 90,
  pts: PTS,
  mobs: [
    { type: 'ponceuse', seg: [[1650, 1440], [2025, 1440]], r: 34, per: 6.5 },               // ponceuse orbitale qui balaie la redescente du méandre
    { type: 'ecroufou', chemin: [[1100, 960], [1330, 1180], [1120, 1400], [880, 1190]], r: 26, per: 8 },   // écrou fou qui roule à travers l'escalier de gauche
  ],
  boxes: [0.12, 0.44, 0.69, 0.81],
  make(H) {
    H.boostAt(0.045); H.boostAt(0.11); H.boostAt(0.175);                       // trois turbos sur le mètre ruban
    H.rock(3330, 590, 100, 'etau');                                             // l'étau, à la corde du grand virage
    H.rockAt(0.53, 0.6, 22, 'boulon'); H.rockAt(0.556, -0.6, 22, 'boulon');    // chicane de boulons dans la remontée
    H.rockAt(0.095, -0.8, 13, 'vis'); H.rockAt(0.205, 0.8, 13, 'vis');         // vis perdues au bord du mètre
    H.rockAt(0.355, 0.62, 20, 'ecrou'); H.rockAt(0.92, 0.62, 20, 'ecrou');
    H.zoneAt(0.39, 0.35, 85, 52, 'huile');                                      // huile de vidange en sortie de marche
    H.zoneAt(0.815, -0.35, 80, 50, 'huile');
    H.zoneAt(0.487, 0.45, 70, 48, 'sciure');                                    // sciure à la corde des épingles
    H.zoneAt(0.60, -0.5, 66, 46, 'sciure');
    H.wall(3573, 167, 3813, 407, 16, 'cle');                                    // clé plate géante : rattrape qui rate le grand virage
    H.wall(2120, 2120, 2700, 2120, 12, 'serrejoint'); H.wall(1300, 2120, 1880, 2120, 12, 'serrejoint');   // serre-joints au pied des épingles
    H.wall(2000, 1210, 2000, 1890, 9, 'reglet');                               // réglet d'acier entre les deux branches du méandre
    // décor : le mur du fond (panneau perforé) et sa marge, puis les poches libres de l'établi, de gauche à droite
    H.deco(2000, 120, 'panneau'); H.deco(200, 330, 'boitier'); H.deco(750, 125, 'visserie'); H.deco(1350, 128, 'niveau');
    H.deco(2360, 124, 'equerre'); H.deco(2900, 120, 'rouleau'); H.deco(230, 720, 'tournevis'); H.deco(3858, 690, 'marteau');
    H.deco(420, 1480, 'caisse'); H.deco(290, 1960, 'bidon'); H.deco(760, 1840, 'chutes'); H.deco(930, 2100, 'scie'); H.deco(1110, 1740, 'visserie');
    H.deco(850, 640, 'chiffon'); H.deco(1150, 575, 'visserie'); H.deco(1450, 750, 'cles'); H.deco(1600, 1160, 'aureoles'); H.deco(1615, 1700, 'aureoles');
    H.deco(1970, 640, 'perceuse'); H.deco(2700, 585, 'pince'); H.deco(2650, 960, 'boitevis'); H.deco(2385, 1600, 'lime');
    H.deco(3560, 1330, 'chargeur'); H.deco(3800, 1060, 'chiffon'); H.deco(2990, 1760, 'tasse'); H.deco(3460, 1790, 'peinture');
    H.deco(3840, 1500, 'serre'); H.deco(3800, 1990, 'carton'); H.deco(2900, 1560, 'visserie'); H.deco(2900, 2070, 'aureoles');
  },
  dessin: { piste: pisteEtabli, objets: OBJETS, decor: DECOR, murs: MURS, mobiles: MOBILES, zones: ZONES },
};
