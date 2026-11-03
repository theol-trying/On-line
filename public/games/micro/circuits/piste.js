// Circuit « piste » de Micro Machines — définition PARTAGÉE serveur / client (géométrie, obstacles, zones, décor).
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

// la moquette du salon : x 40..3860, y 230..2420 ; au-dessus (y 0..230) le parquet où est posé le canapé
const T = { x0: 40, y0: 230, x1: 3860, y1: 2420, r: 16 };
const TUNNEL = [[480, 1060], [480, 1690]];                  // tube de plastique fumé sur la courbe en S du côté gauche
const RC = [[2640, 1170], [2950, 1060], [3340, 1030], [3660, 1090], [3770, 1290], [3660, 1490], [3340, 1550], [2950, 1520], [2640, 1410]];
const FENETRE = [120, 1150];                                // coin des carreaux de soleil (fenêtre à gauche de la pièce)

// ── petits outils de dessin (décor fixe : peint une fois ; mobiles : à chaque image, donc sobres) ──
const TAU = Math.PI * 2;
// ombre douce portée vers le bas-droite (fenêtre et plafonnier), quel que soit l'angle a du repère courant : une passe
// large et pâle puis une serrée plus sombre ; f() trace le contour ; k = hauteur de l'objet
function ombre(g, a, k, f) {
  const c = Math.cos(a), s = Math.sin(a);
  for (let p = 0; p < 2; p++) {
    const ox = (p ? 4 : 9) * k, oy = (p ? 6 : 13) * k;
    g.save(); g.translate(ox * c + oy * s, -ox * s + oy * c); g.fillStyle = p ? 'rgba(0,18,24,0.28)' : 'rgba(0,18,24,0.13)';
    g.beginPath(); f(); g.fill(); g.restore();
  }
}
function lin(g, x0, y0, x1, y1, stops) { const gr = g.createLinearGradient(x0, y0, x1, y1); for (let i = 0; i < stops.length; i++) gr.addColorStop(i / (stops.length - 1), stops[i]); return gr; }
function rad(g, x, y, r0, r1, stops) { const gr = g.createRadialGradient(x, y, r0, x, y, r1); for (let i = 0; i < stops.length; i++) gr.addColorStop(i / (stops.length - 1), stops[i]); return gr; }
function disque(g, x, y, r, col) { g.fillStyle = col; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }
function cercle(g, x, y, r, lw, col) { g.strokeStyle = col; g.lineWidth = lw; g.beginPath(); g.arc(x, y, r, 0, TAU); g.stroke(); }
function texte(g, s, x, y, taille, col, style) { g.fillStyle = col; g.font = (style || 'bold') + ' ' + taille + 'px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(s, x, y); }
function idx(c, x, y) { let b = 0, bd = 1e18; for (let i = 0; i < c.n; i++) { const dx = c.sx[i] - x, dy = c.sy[i] - y, q = dx * dx + dy * dy; if (q < bd) { bd = q; b = i; } } return b; }
// indices [i0, i1] (i0 → i1 en avançant, par le plus court) entre deux points de la piste, quel que soit le sens de course
function plage(c, A, B) { const a = idx(c, A[0], A[1]), b = idx(c, B[0], B[1]), d = ((b - a) % c.n + c.n) % c.n; return d <= c.n / 2 ? [a, a + d] : [b, b + c.n - d]; }
function pt(c, s, off) { const i = s % c.n; return [c.sx[i] + c.nx[i] * off, c.sy[i] + c.ny[i] * off]; }
// un rail passe-t-il là (à moins de 40 u d'une extrémité de mur « rail ») ? (ouvertures : ni béquilles ni pinces)
function railIci(c, p) { for (const id of c.near(p[0], p[1])) { if (id >= 10000) continue; const w = c.walls[id]; if (w[5] === 'rail' && Math.hypot(w[0] - p[0], w[1] - p[1]) < 40) return true; } return false; }
// tronçon de piste orange posé à plat (pièces qui traînent) : le long de +x, de 0 à L, demi-largeur w
function troncon(g, L, w) {
  g.fillStyle = '#c4520f'; g.fillRect(0, -w - 8, L, 2 * w + 16);
  g.fillStyle = lin(g, 0, -w, 0, w, ['#f07018', '#ff8a2c', '#f07018']); g.fillRect(0, -w, L, 2 * w);
  g.fillStyle = '#ff9c45'; g.fillRect(0, -w - 6, L, 4); g.fillRect(0, w + 2, L, 4);
  for (const s of [-0.5, 0.5]) { g.fillStyle = 'rgba(255,205,150,0.4)'; g.fillRect(0, s * w - 4, L, 8); g.fillStyle = '#5a2206'; g.fillRect(0, s * w - 2, L, 4); }
  g.fillStyle = '#2f6fd6'; g.fillRect(L - 4, -w * 0.3, 16, w * 0.6);                    // languette de raccord bleue
}

// ── le parquet, la moquette, la bordure ──
function sol(g, c, R) {                               // parquet de chêne blond (lames en long) sous le canapé et le long des murs
  g.fillStyle = '#b07b42'; g.fillRect(0, 0, c.w, c.h);
  for (let y = 0, k = 0; y < c.h; y += 54, k++) {
    g.fillStyle = k % 2 ? 'rgba(255,230,180,0.06)' : 'rgba(60,30,0,0.08)'; g.fillRect(0, y, c.w, 54);
    g.fillStyle = 'rgba(60,30,8,0.4)'; g.fillRect(0, y, c.w, 2);
    for (let x = (k * 431) % 700; x < c.w; x += 700) g.fillRect(x, y, 2, 54);
  }
  g.strokeStyle = 'rgba(70,36,8,0.12)'; g.lineWidth = 1.2; g.beginPath();
  for (let k = 0; k < 60; k++) { const y = R() * 230, x = R() * c.w; g.moveTo(x, y); g.bezierCurveTo(x + 60, y + 3, x + 120, y - 3, x + 200, y + 1); }
  g.stroke();
}
function plateau(g, c, R, U) {                        // moquette bleu canard : passages d'aspirateur, poil moucheté, ombre du canapé
  const t = c.table, W = t.x1 - t.x0, H = t.y1 - t.y0;
  g.fillStyle = '#23606b'; g.fillRect(t.x0, t.y0, W, H);
  g.save(); g.translate(t.x0, t.y0); g.rotate(-0.1);
  for (let k = 0, x = -500; x < W + 500; x += 180, k++) { g.fillStyle = k % 2 ? 'rgba(255,255,255,0.03)' : 'rgba(0,24,34,0.045)'; g.fillRect(x, -400, 180, H + 900); }
  g.restore();
  for (let p = 0; p < 2; p++) {                       // poil : deux passes de mouchetis (un seul remplissage chacune)
    g.fillStyle = p ? 'rgba(160,230,225,0.07)' : 'rgba(0,26,36,0.13)'; g.beginPath();
    for (let k = 0; k < 1700; k++) g.rect(t.x0 + R() * W, t.y0 + R() * H, 3, 3);
    g.fill();
  }
  g.fillStyle = 'rgba(0,30,40,0.06)';                 // vieilles taches et creux laissés par les pieds d'un meuble
  for (const p of [[1300, 1500, 150, 90], [3000, 1300, 120, 80], [700, 2300, 90, 50]]) U.blob(g, p[0], p[1], p[2], p[3], R() * 3, R, 'rgba(0,30,40,0.07)');
  for (const p of [[2650, 900], [2950, 900], [2650, 1700], [2950, 1700]]) { disque(g, p[0], p[1], 22, 'rgba(0,26,36,0.12)'); cercle(g, p[0], p[1], 22, 2, 'rgba(160,230,225,0.06)'); }
  const sh = g.createLinearGradient(0, t.y0, 0, t.y0 + 90); sh.addColorStop(0, 'rgba(0,14,20,0.5)'); sh.addColorStop(1, 'rgba(0,14,20,0)');
  g.fillStyle = sh; g.fillRect(t.x0, t.y0, W, 90);   // pénombre sous le canapé
  const vg = g.createRadialGradient(1950, 1300, 900, 1950, 1300, 2500); vg.addColorStop(0, 'rgba(0,16,24,0)'); vg.addColorStop(1, 'rgba(0,16,24,0.35)');
  g.fillStyle = vg; g.fillRect(t.x0, t.y0, W, H);
  g.strokeStyle = 'rgba(200,200,210,0.22)'; g.lineWidth = 1; g.beginPath();   // poils de chat sur la moquette
  for (let k = 0; k < 70; k++) { const x = t.x0 + R() * W, y = t.y0 + R() * H, a = R() * TAU; g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a) * 8 + 4, y + Math.sin(a) * 8, x + Math.cos(a) * 16, y + Math.sin(a) * 16); }
  g.stroke();
}
function bord(g, c, R, U) {                           // plinthes peintes le long des murs, barre de seuil en laiton sous le canapé
  const t = c.table;
  g.fillStyle = 'rgba(0,14,20,0.35)'; g.fillRect(t.x0, t.y1 - 6, t.x1 - t.x0, 6); g.fillRect(t.x0, t.y0, 6, t.y1 - t.y0); g.fillRect(t.x1 - 6, t.y0, 6, t.y1 - t.y0);
  g.fillStyle = '#efeae0'; g.fillRect(0, t.y1 + 4, c.w, c.h - t.y1 - 4); g.fillRect(0, 0, t.x0 - 4, c.h); g.fillRect(t.x1 + 4, 0, c.w - t.x1 - 4, c.h);
  g.fillStyle = '#ffffff'; g.fillRect(0, t.y1 + 4, c.w, 5); g.fillRect(t.x0 - 9, 0, 5, c.h); g.fillRect(t.x1 + 4, 0, 5, c.h);
  g.fillStyle = 'rgba(120,110,90,0.35)'; g.fillRect(0, c.h - 6, c.w, 6); g.fillRect(0, 0, 6, c.h); g.fillRect(c.w - 6, 0, 6, c.h);
  g.fillStyle = lin(g, 0, t.y0 - 7, 0, t.y0 + 5, ['#8a6a20', '#f3d27a', '#8a6a20']); g.fillRect(t.x0 - 4, t.y0 - 7, t.x1 - t.x0 + 8, 12);
  g.fillStyle = 'rgba(60,40,0,0.5)'; for (let x = t.x0 + 60; x < t.x1; x += 240) disque(g, x, t.y0 - 1, 2.5, 'rgba(60,40,0,0.5)');
}

// ── la piste : plastique orange, deux fentes de guidage, raccords, virages relevés, rails ──
function piste(g, c, R, U) {
  const W = c.W, n = c.n;
  g.lineJoin = 'round'; g.lineCap = 'round';
  g.save(); g.translate(7, 11); U.centerStroke(g, c, 2 * W + 36, 'rgba(0,16,22,0.2)'); g.restore();
  g.save(); g.translate(3, 5); U.centerStroke(g, c, 2 * W + 26, 'rgba(0,16,22,0.32)'); g.restore();
  U.centerStroke(g, c, 2 * W + 16, '#b9480e');
  U.centerStroke(g, c, 2 * W, '#f2761c');
  U.centerStroke(g, c, W * 1.3, 'rgba(255,170,90,0.14)');
  U.centerStroke(g, c, W * 0.5, 'rgba(255,205,150,0.1)');
  // virages relevés : l'extérieur monte vers la lumière, l'intérieur plonge (bandes par paliers, sans couture)
  const run = (i0, i1, o1, o2, col) => {
    g.fillStyle = col; g.beginPath();
    for (let s = i0; s <= i1; s++) { const p = pt(c, s, o1); if (s === i0) g.moveTo(p[0], p[1]); else g.lineTo(p[0], p[1]); }
    for (let s = i1; s >= i0; s--) { const p = pt(c, s, o2); g.lineTo(p[0], p[1]); }
    g.closePath(); g.fill();
  };
  const niv = i => { const k = c.k[i % n]; return Math.max(0, Math.min(5, Math.round((Math.abs(k) - 0.0011) / 0.0006))) * (k > 0 ? -1 : 1); };
  for (let s = 0; s < n;) {
    const q = niv(s); let e = s; while (e + 1 < n && niv(e + 1) === q) e++;
    if (q) { const a = Math.abs(q) / 5, sd = q > 0 ? 1 : -1; run(s, e + 1, sd * W * 0.2, sd * W, 'rgba(255,214,160,' + (0.22 * a).toFixed(3) + ')'); run(s, e + 1, -sd * W, -sd * W * 0.3, 'rgba(110,34,0,' + (0.18 * a).toFixed(3) + ')'); }
    s = e + 1;
  }
  // fentes de guidage (une par voie) et leurs tresses de cuivre
  for (const sd of [-1, 1]) {
    g.strokeStyle = 'rgba(255,205,150,0.3)'; g.lineWidth = 10; U.trackPath(g, c, sd * W * 0.5); g.stroke();
    g.strokeStyle = 'rgba(90,34,6,0.85)'; g.lineWidth = 4; U.trackPath(g, c, sd * W * 0.5); g.stroke();
  }
  // raccords entre les pièces (toutes les ~300 u) : fente sombre, arête claire
  g.lineCap = 'butt';
  for (let p = 0; p < 2; p++) {
    g.beginPath();
    for (let i = 0; i < n; i += 30) { const d = p * 2.5, a = [c.sx[i] + c.tx[i] * d + c.nx[i] * (W + 6), c.sy[i] + c.ty[i] * d + c.ny[i] * (W + 6)], b = [c.sx[i] + c.tx[i] * d - c.nx[i] * (W + 6), c.sy[i] + c.ty[i] * d - c.ny[i] * (W + 6)]; g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); }
    g.strokeStyle = p ? 'rgba(255,200,140,0.35)' : 'rgba(100,30,0,0.5)'; g.lineWidth = p ? 1.5 : 2.5; g.stroke();
  }
  // béquilles grises sous le bord extérieur des virages serrés (la piste y est surélevée)
  g.beginPath();
  for (let i = 0; i < n; i += 6) { const k = c.k[i]; if (Math.abs(k) < 1 / 500) continue; const sd = k > 0 ? -1 : 1, a = pt(c, i, sd * (W + 19)), b = pt(c, i, sd * (W + 36)); if (!railIci(c, pt(c, i, sd * (W + 10)))) continue; g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); }
  g.lineCap = 'round'; g.strokeStyle = 'rgba(0,16,22,0.3)'; g.lineWidth = 9; g.save(); g.translate(3, 4); g.stroke(); g.restore();
  g.strokeStyle = '#8c95a0'; g.lineWidth = 7; g.stroke(); g.strokeStyle = '#c9d0d8'; g.lineWidth = 2.5; g.stroke();
  // rails (les murs « rail » eux-mêmes : on voit les ouvertures) : ombre, flanc, lèvre, reflet
  const passe = (lw, col, dx, dy) => { g.beginPath(); for (const w of c.walls) if (w[5] === 'rail') { g.moveTo(w[0] + dx, w[1] + dy); g.lineTo(w[2] + dx, w[3] + dy); } g.lineWidth = lw; g.strokeStyle = col; g.stroke(); };
  passe(17, 'rgba(0,16,22,0.16)', 6, 9); passe(13, 'rgba(0,16,22,0.3)', 3, 5);
  passe(13, '#b9480e', 0, 0); passe(8, '#ff8f2e', -1, -1); passe(2, 'rgba(255,238,205,0.75)', -2, -2);
  // pinces de raccord bleues sur les rails, au droit de chaque raccord
  g.fillStyle = '#2f6fd6';
  for (let i = 0; i < n; i += 30) for (const sd of [-1, 1]) {
    const p = pt(c, i, sd * (W + 10));
    if (!railIci(c, p)) continue;
    g.save(); g.translate(p[0], p[1]); g.rotate(Math.atan2(c.ty[i], c.tx[i])); g.fillRect(-7, -8, 14, 16); g.fillStyle = '#7fb0ff'; g.fillRect(-7, -8, 14, 3); g.fillStyle = '#2f6fd6'; g.restore();
  }
}

// ── décor (dessiné autour de l'origine) ──
const DECOR = {
  canape(g, d, R, U) {                                // canapé de velours moutarde, contre le mur : dossier, trois places, plaid écossais
    const L = 1380, y0 = -105, y1 = 140;
    ombre(g, 0, 1, () => U.rr(g, -L, y0, 2 * L, y1 - y0, 40));
    g.fillStyle = lin(g, 0, y0, 0, y1, ['#6e4a0c', '#9a6c18']); g.beginPath(); U.rr(g, -L, y0, 2 * L, y1 - y0, 40); g.fill();
    for (let k = 0; k < 3; k++) {
      const x = -L + 158 + k * 818;
      g.fillStyle = lin(g, 0, y0 + 6, 0, y0 + 90, ['#9e6c14', '#c48c2c']); g.beginPath(); U.rr(g, x, y0 + 6, 802, 84, 28); g.fill();   // coussin de dos
      for (let b = 0; b < 3; b++) { disque(g, x + 134 + b * 267, y0 + 48, 6, '#7a520e'); disque(g, x + 132 + b * 267, y0 + 46, 2.5, 'rgba(255,230,170,0.4)'); }
      g.fillStyle = lin(g, 0, y0 + 94, 0, y1 - 6, ['#c08628', '#e3b04e', '#d29a38']); g.beginPath(); U.rr(g, x, y0 + 94, 802, y1 - y0 - 100, 26); g.fill();   // assise
      g.fillStyle = 'rgba(110,70,0,0.18)'; g.beginPath(); U.oval(g, x + 401, y0 + 160, 300, 50); g.fill();                     // creux laissé par qui s'est assis
      g.strokeStyle = 'rgba(255,232,170,0.4)'; g.lineWidth = 3; g.beginPath(); U.rr(g, x + 6, y0 + 100, 790, y1 - y0 - 112, 22); g.stroke();   // passepoil
    }
    for (const sd of [-1, 1]) {                       // accoudoirs
      const x = sd < 0 ? -L : L - 156;
      g.fillStyle = lin(g, x, 0, x + 156, 0, sd < 0 ? ['#a8761c', '#d9a23a', '#b98420'] : ['#b98420', '#d9a23a', '#a8761c']); g.beginPath(); U.rr(g, x, y0, 156, y1 - y0, 46); g.fill();
      g.strokeStyle = 'rgba(255,236,190,0.35)'; g.lineWidth = 4; g.beginPath(); g.moveTo(x + 40, y0 + 30); g.lineTo(x + 116, y0 + 30); g.stroke();
    }
    g.save(); g.translate(-L + 230, 20); g.rotate(-0.1);   // plaid écossais jeté sur la place de gauche, franges
    ombre(g, -0.1, 0.3, () => { g.moveTo(-150, -110); g.lineTo(170, -100); g.lineTo(200, 120); g.lineTo(-170, 130); g.closePath(); });
    g.beginPath(); g.moveTo(-150, -110); g.lineTo(170, -100); g.lineTo(200, 120); g.lineTo(-170, 130); g.closePath(); g.save(); g.clip();
    g.fillStyle = '#28507e'; g.fillRect(-200, -130, 420, 280);
    g.fillStyle = 'rgba(200,40,40,0.55)'; for (let k = -200; k < 220; k += 70) { g.fillRect(k, -130, 22, 280); g.fillRect(-200, k * 0.7, 420, 22); }
    g.fillStyle = 'rgba(255,210,80,0.5)'; for (let k = -170; k < 220; k += 70) { g.fillRect(k, -130, 4, 280); g.fillRect(-200, k * 0.7 + 30, 420, 4); }
    g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(-200, -60, 420, 30);
    g.restore();
    g.strokeStyle = '#28507e'; g.lineWidth = 3; g.beginPath(); for (let k = 0; k <= 18; k++) { const x = -170 + k * 20.5, y = 130 - k * 0.5; g.moveTo(x, y); g.lineTo(x + 2, y + 14); } g.stroke();
    g.restore();
  },
  chat(g, d, R, U) {                                  // chat roux roulé en boule sur le canapé, la queue qui pend vers la piste
    ombre(g, 0, 0.5, () => U.oval(g, 0, 0, 100, 64));
    g.strokeStyle = '#c46f22'; g.lineWidth = 22; g.lineCap = 'round';                 // la queue, qui déborde du coussin
    g.beginPath(); g.moveTo(-70, 30); g.bezierCurveTo(-110, 80, -40, 110, -10, 122); g.stroke();
    g.strokeStyle = '#8a4a14'; g.lineWidth = 22; g.setLineDash([9, 14]); g.beginPath(); g.moveTo(-70, 30); g.bezierCurveTo(-110, 80, -40, 110, -10, 122); g.stroke(); g.setLineDash([]);
    disque(g, -6, 124, 11, '#f3e2c8');
    g.fillStyle = rad(g, -20, -20, 10, 110, ['#f0a24a', '#d9822b', '#a85a18']); g.beginPath(); U.oval(g, 0, 0, 100, 64); g.fill();
    g.strokeStyle = 'rgba(120,56,10,0.55)'; g.lineWidth = 9;                          // rayures du pelage
    for (const a of [-0.9, -0.3, 0.3, 0.9]) { g.beginPath(); g.arc(-20, 0, 60, a - 0.2, a + 0.2); g.stroke(); }
    disque(g, 74, -14, 40, '#e08c34');                                                  // tête, oreilles, yeux fermés, nez
    g.fillStyle = '#d07a28'; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(80 + s * 4, -14 + s * 30); g.lineTo(112, -14 + s * 44); g.lineTo(104, -14 + s * 12); g.closePath(); g.fill(); }
    g.fillStyle = '#f2a0a8'; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(88, -14 + s * 28); g.lineTo(106, -14 + s * 38); g.lineTo(100, -14 + s * 16); g.closePath(); g.fill(); }
    g.strokeStyle = '#4a2408'; g.lineWidth = 2.5; for (const s of [-1, 1]) { g.beginPath(); g.arc(90, -14 + s * 14, 7, 0.3, 2.6); g.stroke(); }
    disque(g, 108, -14, 4, '#e07080');
    g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 1.2; g.beginPath(); for (const s of [-1, 1]) for (const q of [-4, 4]) { g.moveTo(108, -14 + s * 6); g.lineTo(134, -14 + s * (14 + q)); } g.stroke();
    disque(g, 52, 40, 15, '#f3e2c8'); disque(g, 70, 30, 14, '#f3e2c8');                  // pattes blanches
  },
  lampe(g, d, R, U) {                                 // guéridon : lampe allumée, livres, tasse de café
    g.fillStyle = rad(g, 0, 0, 40, 430, ['rgba(255,226,150,0.3)', 'rgba(255,226,150,0.08)', 'rgba(255,226,150,0)']); g.fillRect(-430, -430, 860, 860);
    ombre(g, 0, 1.2, () => g.arc(0, 0, 126, 0, TAU));
    disque(g, 0, 0, 126, rad(g, -30, -30, 10, 130, ['#a86a38', '#7a4820', '#5a3216']));
    for (const r of [40, 70, 96, 116]) cercle(g, 4, 2, r, 1.2, 'rgba(40,16,0,0.18)');
    g.save(); g.translate(-48, 52); g.rotate(-0.3);                                       // deux livres empilés
    ombre(g, -0.3, 0.3, () => g.rect(-64, -44, 128, 88));
    g.fillStyle = '#2a6a4a'; g.fillRect(-64, -44, 128, 88); g.fillStyle = '#f2ead6'; g.fillRect(58, -40, 6, 80);
    g.rotate(0.25); g.fillStyle = '#9a2a3a'; g.fillRect(-56, -36, 112, 74); g.fillStyle = '#f2ead6'; g.fillRect(50, -32, 6, 66);
    texte(g, 'ROMAN', -2, 0, 14, '#f3d27a', 'bold'); g.restore();
    disque(g, 76, 58, 24, '#f6f2ea'); disque(g, 76, 58, 17, '#5a3418'); disque(g, 72, 54, 5, 'rgba(255,230,200,0.3)');   // tasse
    g.strokeStyle = '#f6f2ea'; g.lineWidth = 6; g.beginPath(); g.arc(104, 58, 9, -1.2, 1.2); g.stroke();
    ombre(g, 0, 1.6, () => g.arc(0, -16, 80, 0, TAU));                                    // abat-jour vu d'en haut, ampoule
    disque(g, 0, -16, 80, '#efe2c2'); disque(g, 0, -16, 62, rad(g, 0, -16, 4, 62, ['#fffef0', '#fff3c4', '#f3dc9a']));
    cercle(g, 0, -16, 80, 2, 'rgba(120,90,40,0.4)'); disque(g, 0, -16, 9, '#c9a24a');
  },
  plante(g, d, R, U) {                                // plante verte en pot de terre cuite
    ombre(g, 0, 1.2, () => g.arc(0, 0, 70, 0, TAU));
    disque(g, 0, 0, 70, rad(g, -20, -20, 8, 74, ['#e08a5a', '#b85a32', '#8a3a1c'])); disque(g, 0, 0, 56, '#4a2c18');
    for (let k = 0; k < 11; k++) {
      const a = k / 11 * TAU + R() * 0.3, l = 90 + R() * 60, w = 22 + R() * 10, ca = Math.cos(a), sa = Math.sin(a);
      g.fillStyle = k % 2 ? '#2f8a3e' : '#3fa24c'; g.beginPath(); g.moveTo(0, 0);
      g.quadraticCurveTo(ca * l * 0.5 - sa * w, sa * l * 0.5 + ca * w, ca * l, sa * l); g.quadraticCurveTo(ca * l * 0.5 + sa * w, sa * l * 0.5 - ca * w, 0, 0); g.fill();
      g.strokeStyle = 'rgba(200,255,190,0.35)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(ca * 10, sa * 10); g.lineTo(ca * l * 0.92, sa * l * 0.92); g.stroke();
    }
  },
  coffre(g, d, R, U) {                                // coffre à jouets ouvert : couvercle étoilé rabattu, jouets en vrac
    g.rotate(0.05);
    const w = 150, h = 108;
    ombre(g, 0.05, 0.9, () => { g.rect(-w, -h - 116, 2 * w, 116); g.rect(-w, -h, 2 * w, 2 * h); });
    g.fillStyle = lin(g, 0, -h - 116, 0, -h, ['#2c62a8', '#3d7fd0']); g.fillRect(-w + 6, -h - 112, 2 * w - 12, 108);
    g.fillStyle = '#ffd23a';
    for (const p of [[-80, -h - 60, 18], [10, -h - 40, 12], [90, -h - 72, 15]]) { g.beginPath(); for (let k = 0; k < 10; k++) { const a = k * Math.PI / 5 - Math.PI / 2, q = k % 2 ? p[2] * 0.45 : p[2]; g.lineTo(p[0] + Math.cos(a) * q, p[1] + Math.sin(a) * q); } g.closePath(); g.fill(); }
    g.fillStyle = '#9aa0a8'; g.fillRect(-w + 40, -h - 6, 30, 10); g.fillRect(w - 70, -h - 6, 30, 10);   // charnières
    g.fillStyle = '#e04a36'; g.fillRect(-w, -h, 2 * w, 2 * h);
    g.strokeStyle = 'rgba(110,20,10,0.35)'; g.lineWidth = 2; g.beginPath(); for (let y = -h + 36; y < h; y += 36) { g.moveTo(-w, y); g.lineTo(w, y); } g.stroke();
    g.fillStyle = '#3a1e14'; g.fillRect(-w + 18, -h + 18, 2 * w - 36, 2 * h - 36);
    g.save(); g.beginPath(); g.rect(-w + 18, -h + 18, 2 * w - 36, 2 * h - 36); g.clip();
    const cube = (x, y, a, col, l) => { g.save(); g.translate(x, y); g.rotate(a); g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(-20, -18, 46, 46); g.fillStyle = col; g.fillRect(-23, -23, 46, 46); g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(-23, -23, 46, 8); texte(g, l, 0, 2, 26, '#fff', 'bold'); g.restore(); };
    cube(-88, -40, 0.3, '#f2b705', 'A'); cube(-40, 26, -0.2, '#2f7ff0', 'B'); cube(70, -44, 0.6, '#2bb45a', 'C');
    disque(g, -100, 52, 34, '#b07a44'); disque(g, -126, 30, 12, '#8a5a2a'); disque(g, -74, 30, 12, '#8a5a2a'); disque(g, -100, 60, 12, '#d9b080'); disque(g, -100, 54, 4, '#222');   // nounours
    disque(g, 92, 42, 36, '#e8322a'); g.fillStyle = '#fff'; g.beginPath(); g.arc(92, 42, 36, -0.6, 0.6); g.lineTo(92, 42); g.fill(); disque(g, 80, 30, 9, 'rgba(255,255,255,0.5)');   // ballon
    g.save(); g.translate(16, -52); g.rotate(-0.4); g.fillStyle = '#7a3ab8'; g.fillRect(-26, -12, 52, 24); g.fillStyle = '#222'; for (const p of [[-17, -15], [10, -15], [-17, 11], [10, 11]]) g.fillRect(p[0], p[1], 9, 5); g.restore();   // petite voiture
    g.restore();
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(-w + 18, -h + 18, 2 * w - 36, 10);
    g.fillStyle = '#c9ccd4'; for (const p of [[-w, -h], [w - 22, -h], [-w, h - 22], [w - 22, h - 22]]) g.fillRect(p[0], p[1], 22, 22);
  },
  coussin(g, d, R, U) {                               // coussin tombé du canapé : capiton central, plis, pompons aux coins
    const P = d[3] ? ['#d8c9a0', '#fff4d6', '#a8966a'] : ['#c94a44', '#f08a7e', '#8a2a26'], a = d[4] || 0, s = 92;
    g.rotate(a);
    ombre(g, a, 0.7, () => U.rr(g, -s, -s, 2 * s, 2 * s, 34));
    g.fillStyle = rad(g, -s * 0.3, -s * 0.35, 10, s * 1.5, [P[1], P[0]]); g.beginPath(); U.rr(g, -s, -s, 2 * s, 2 * s, 34); g.fill();
    g.strokeStyle = P[2]; g.globalAlpha = 0.45; g.lineWidth = 3; g.beginPath();
    for (const q of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { g.moveTo(q[0] * s * 0.82, q[1] * s * 0.82); g.quadraticCurveTo(q[0] * s * 0.2, q[1] * s * 0.55, 0, 0); g.moveTo(q[0] * s * 0.82, q[1] * s * 0.82); g.quadraticCurveTo(q[0] * s * 0.55, q[1] * s * 0.2, 0, 0); }
    g.stroke(); g.globalAlpha = 1;
    g.strokeStyle = 'rgba(255,255,255,0.3)'; g.lineWidth = 3; g.beginPath(); U.rr(g, -s + 5, -s + 5, 2 * s - 10, 2 * s - 10, 30); g.stroke();
    disque(g, 0, 0, 10, P[2]); disque(g, -3, -3, 3.5, 'rgba(255,255,255,0.45)');
    for (const q of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) disque(g, q[0] * (s + 4), q[1] * (s + 4), 9, P[2]);
  },
  telecommande(g, d, R, U) {                          // télécommande de la télé, tombée de l'accoudoir
    g.rotate(1.35);
    ombre(g, 1.35, 0.4, () => U.rr(g, -95, -26, 190, 52, 20));
    g.fillStyle = lin(g, 0, -26, 0, 26, ['#3a3a42', '#1a1a1e', '#2a2a30']); g.beginPath(); U.rr(g, -95, -26, 190, 52, 20); g.fill();
    disque(g, -74, -10, 7, '#e8322a');
    cercle(g, -30, 0, 15, 5, '#55555e'); disque(g, -30, 0, 6, '#77777f');
    g.fillStyle = '#6a6a74'; for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) g.fillRect(4 + i * 18, -17 + j * 12, 12, 7);
    g.fillStyle = '#2f7ff0'; g.fillRect(4, 18, 12, 4); g.fillStyle = '#2bb45a'; g.fillRect(22, 18, 12, 4); g.fillStyle = '#f2b705'; g.fillRect(40, 18, 12, 4);
    g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(-85, -22, 170, 5);
  },
  chausson(g, d, R, U) {                              // chausson rose à pompon, semelle de feutre (d[3] : orientation)
    const a = d[3] || -0.5; g.rotate(a);
    ombre(g, a, 0.6, () => U.oval(g, 0, 0, 92, 42));
    g.fillStyle = '#b8a48c'; g.beginPath(); U.oval(g, 0, 0, 92, 42); g.fill();
    g.fillStyle = '#e6dccd'; g.beginPath(); U.oval(g, -24, 0, 56, 28); g.fill();
    g.fillStyle = rad(g, 40, -10, 6, 70, ['#ffb8cc', '#e8789a']); g.beginPath(); U.oval(g, 34, 0, 62, 40); g.fill();
    for (let k = 0; k < 14; k++) { const a = Math.PI * 0.55 + k / 13 * Math.PI * 0.9; disque(g, 34 + Math.cos(a) * 60, Math.sin(a) * 38, 7, '#f6a0ba'); }
    for (let k = 0; k < 9; k++) disque(g, 66 + (R() - 0.5) * 22, (R() - 0.5) * 22, 9, k % 2 ? '#ffffff' : '#f2eef0');   // pompon
  },
  radiocommande(g, d, R, U) {                         // émetteur de la voiture télécommandée : deux manches, antenne télescopique
    g.rotate(-0.25);
    g.strokeStyle = 'rgba(0,16,22,0.3)'; g.lineWidth = 6; g.beginPath(); g.moveTo(94, -46); g.lineTo(290, -96); g.stroke();
    ombre(g, -0.25, 0.7, () => U.rr(g, -100, -60, 200, 120, 26));
    g.fillStyle = lin(g, 0, -60, 0, 60, ['#4a4e58', '#2a2d34', '#1c1e24']); g.beginPath(); U.rr(g, -100, -60, 200, 120, 26); g.fill();
    for (const x of [-50, 50]) { disque(g, x, 4, 30, '#15171c'); cercle(g, x, 4, 30, 3, '#5a5e68'); disque(g, x + (x < 0 ? 8 : -6), 2 + (x < 0 ? -6 : 9), 11, '#c9ccd4'); disque(g, x + (x < 0 ? 6 : -8), (x < 0 ? -8 : 7), 4, '#fff'); }
    g.fillStyle = '#e8322a'; g.fillRect(-14, -48, 28, 12); disque(g, 0, 40, 5, '#2bff6a');
    texte(g, 'RC 27 MHz', 0, -30, 12, '#f3d27a', 'bold');
    g.strokeStyle = lin(g, 0, 0, 200, 0, ['#9aa0a8', '#f2f4f8', '#9aa0a8']); g.lineWidth = 5; g.beginPath(); g.moveTo(90, -50); g.lineTo(280, -100); g.stroke();
    g.lineWidth = 2; g.strokeStyle = '#6a6e78'; g.beginPath(); for (const u of [0.35, 0.65]) { g.moveTo(90 + 190 * u, -50 - 50 * u - 4); g.lineTo(90 + 190 * u, -50 - 50 * u + 4); } g.stroke();
    disque(g, 282, -101, 7, '#1a1a1e');
  },
  popcorn(g, d, R, U) {                               // bol de pop-corn (quelques grains tombés à côté)
    ombre(g, 0, 0.9, () => g.arc(0, 0, 96, 0, TAU));
    disque(g, 0, 0, 96, '#d83a32'); cercle(g, 0, 0, 92, 6, '#f6f2ea');
    for (let k = 0; k < 12; k++) { g.fillStyle = k % 2 ? '#d83a32' : '#f6f2ea'; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, 88, k * TAU / 12, (k + 1) * TAU / 12); g.closePath(); g.fill(); }
    disque(g, 0, 0, 76, '#e9d29a');
    for (let k = 0; k < 46; k++) { const a = R() * TAU, q = Math.sqrt(R()) * 66, x = Math.cos(a) * q, y = Math.sin(a) * q; disque(g, x + 2, y + 2, 11, 'rgba(120,80,20,0.25)'); disque(g, x, y, 10 + R() * 4, R() < 0.3 ? '#fff3c8' : '#fffaf0'); disque(g, x + 3, y + 2, 3, 'rgba(230,170,60,0.6)'); }
    for (const p of [[120, 30], [-110, 70], [60, 128], [-40, -130]]) { disque(g, p[0] + 2, p[1] + 3, 9, 'rgba(0,16,22,0.3)'); disque(g, p[0], p[1], 9, '#fffaf0'); disque(g, p[0] + 2, p[1] + 1, 3, 'rgba(230,170,60,0.6)'); }
  },
  boite(g, d, R, U) {                                 // couvercle de la boîte du circuit : illustration, titre, âge
    const w = 190, h = 125; g.rotate(-0.1);
    ombre(g, -0.1, 0.5, () => g.rect(-w, -h, 2 * w, 2 * h));
    g.fillStyle = lin(g, -w, -h, w, h, ['#ffd23a', '#ff9a1c', '#f0541c']); g.fillRect(-w, -h, 2 * w, 2 * h);
    g.save(); g.beginPath(); g.rect(-w, -h, 2 * w, 2 * h); g.clip();
    g.fillStyle = '#1a1a22'; g.beginPath(); g.moveTo(-w, 10); g.lineTo(w, -40); g.lineTo(w, 40); g.lineTo(-w, 90); g.closePath(); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.85)'; for (let k = 0; k < 8; k++) { const x = -w + 20 + k * 50; g.fillRect(x, 50 - (x + w) * 0.13, 26, 4); }
    g.save(); g.translate(30, 10); g.rotate(-0.13);                                         // la voiture de la boîte, plein phares
    g.fillStyle = '#e8322a'; g.beginPath(); U.rr(g, -70, -24, 140, 48, 16); g.fill(); g.fillStyle = '#8ad0ff'; g.beginPath(); U.rr(g, -16, -18, 44, 36, 8); g.fill();
    g.fillStyle = '#111'; for (const p of [[-52, -32], [30, -32], [-52, 24], [30, 24]]) g.fillRect(p[0], p[1], 26, 9);
    g.fillStyle = '#fff'; g.fillRect(-70, -4, 140, 8); g.fillStyle = '#ffe680'; g.fillRect(66, -20, 6, 10); g.fillRect(66, 10, 6, 10); g.restore();
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { g.fillStyle = (i + j) % 2 ? '#111' : '#fff'; g.fillRect(w - 64 + i * 16, -h + j * 16, 16, 16); }
    g.restore();
    texte(g, 'CIRCUIT TURBO', -40, -h + 30, 34, '#1a1a22', 'bold italic'); texte(g, 'CIRCUIT TURBO', -42, -h + 28, 34, '#ffffff', 'bold italic');
    disque(g, -w + 34, h - 32, 22, '#2f7ff0'); texte(g, '8+', -w + 34, h - 32, 18, '#fff', 'bold');
    texte(g, '12 m de piste · 2 manettes', 50, h - 22, 15, '#1a1a22', 'bold');
    g.strokeStyle = 'rgba(120,60,0,0.4)'; g.lineWidth = 2; g.strokeRect(-w + 1, -h + 1, 2 * w - 2, 2 * h - 2);
  },
  manettes(g, d, R, U) {                              // manettes à gâchette des deux voies, câbles torsadés, boîtier d'alimentation
    const fil = (x0, y0, x1, y1, col) => {
      g.lineCap = 'round'; g.strokeStyle = 'rgba(0,16,22,0.3)'; g.lineWidth = 7; g.beginPath(); g.moveTo(x0 + 4, y0 + 6); g.bezierCurveTo(x0 + 40, y0 + 150, x1 - 160, y1 + 90, x1 + 4, y1 + 6); g.stroke();
      g.strokeStyle = col; g.lineWidth = 5; g.beginPath(); g.moveTo(x0, y0); g.bezierCurveTo(x0 + 40, y0 + 144, x1 - 160, y1 + 84, x1, y1); g.stroke();
    };
    fil(-120, 50, 120, 70, '#2a2a30'); fil(-10, 40, 130, 100, '#2a2a30');
    ombre(g, 0, 0.5, () => g.rect(90, 50, 110, 76));                                      // boîtier : deux prises, voyant
    g.fillStyle = lin(g, 0, 50, 0, 126, ['#5a5e68', '#33363e']); g.fillRect(90, 50, 110, 76);
    disque(g, 120, 72, 9, '#111'); disque(g, 120, 104, 9, '#111'); disque(g, 176, 70, 6, '#ff3a2a'); texte(g, '12 V', 160, 104, 13, '#e8e8ee', 'bold');
    const manette = (x, y, a, col) => {
      g.save(); g.translate(x, y); g.rotate(a);
      ombre(g, a, 0.6, () => { U.rr(g, -26, -70, 52, 120, 22); });
      g.fillStyle = lin(g, -26, 0, 26, 0, [col[0], col[1], col[0]]); g.beginPath(); U.rr(g, -26, -70, 52, 120, 22); g.fill();
      g.fillStyle = '#1a1a1e'; g.beginPath(); U.rr(g, -12, -88, 24, 40, 8); g.fill();          // gâchette
      g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 2; g.beginPath(); for (let k = -20; k < 40; k += 10) { g.moveTo(-22, k); g.lineTo(22, k); } g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.3)'; g.fillRect(-18, -60, 8, 90);
      g.restore();
    };
    manette(-120, 0, -0.4, ['#b81e1e', '#ff5a4a']); manette(-10, -10, 0.25, ['#1a4aa8', '#4a8af0']);
  },
  pieces(g, d, R, U) {                                // pièces de piste qui traînent : une droite, une courbe, des pinces bleues
    const w = 62;
    g.save(); g.translate(-170, -60); g.rotate(0.35);
    ombre(g, 0.35, 0.5, () => g.rect(0, -w - 8, 300, 2 * w + 16));
    troncon(g, 300, w); g.restore();
    g.save(); g.translate(90, 130); g.rotate(-0.6);                                       // pièce courbe (secteur d'anneau)
    const r0 = 150, r1 = r0 + 2 * w + 16, a0 = -0.15, a1 = 0.85;
    ombre(g, -0.6, 0.5, () => { g.arc(0, 0, r1, a0, a1); g.arc(0, 0, r0, a1, a0, true); g.closePath(); });
    g.fillStyle = '#c4520f'; g.beginPath(); g.arc(0, 0, r1, a0, a1); g.arc(0, 0, r0, a1, a0, true); g.closePath(); g.fill();
    g.fillStyle = '#f2761c'; g.beginPath(); g.arc(0, 0, r1 - 8, a0, a1); g.arc(0, 0, r0 + 8, a1, a0, true); g.closePath(); g.fill();
    g.save(); g.beginPath(); g.arc(0, 0, r1, a0, a1); g.arc(0, 0, r0, a1, a0, true); g.closePath(); g.clip();
    for (const q of [r0 + 8 + w * 0.5, r0 + 8 + w * 1.5]) { cercle(g, 0, 0, q, 9, 'rgba(255,205,150,0.35)'); cercle(g, 0, 0, q, 4, '#5a2206'); }
    g.restore();
    g.restore();
    for (const p of [[150, -110, 0.4], [190, -60, 1.9], [-60, 150, 2.6], [-230, 110, 0.9]]) {
      g.save(); g.translate(p[0], p[1]); g.rotate(p[2]); g.fillStyle = 'rgba(0,16,22,0.3)'; g.fillRect(-9, -5, 22, 14); g.fillStyle = '#2f6fd6'; g.fillRect(-11, -8, 22, 14); g.fillStyle = '#7fb0ff'; g.fillRect(-11, -8, 22, 3); g.restore();
    }
  },
  tribune(g, d, R, U) {                               // tribune face à la ligne des stands : gradins, spectateurs-pions, auvent rayé, banderole
    const w = 260, y0 = -78, y1 = 70;
    ombre(g, 0, 1.4, () => g.rect(-w, y0, 2 * w, y1 - y0));
    for (let k = 0; k < 4; k++) {                     // quatre gradins (le plus haut au fond)
      const y = y0 + k * 34;
      g.fillStyle = k % 2 ? '#c9ccd4' : '#aeb3bd'; g.fillRect(-w, y, 2 * w, 34);
      g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(-w, y + 30, 2 * w, 4);
      for (let x = -w + 16; x < w - 10; x += 30) {    // spectateurs (pions de couleur)
        if (R() < 0.12) continue;
        const col = ['#e8322a', '#2f7ff0', '#ffd23a', '#2bb45a', '#ff7ac0', '#f2f2f2', '#7a3ab8'][Math.floor(R() * 7)];
        disque(g, x + 2, y + 19, 10, 'rgba(0,0,0,0.25)'); disque(g, x, y + 17, 10, col); disque(g, x, y + 12, 6, ['#f2c8a0', '#c8946a', '#8a5a3a'][Math.floor(R() * 3)]);
      }
    }
    g.save(); g.globalAlpha = 0.94;                    // auvent rayé sur les deux gradins du fond
    for (let k = 0; k < 13; k++) { g.fillStyle = k % 2 ? '#ffffff' : '#e8322a'; g.fillRect(-w - 6 + k * 41, y0 - 10, 41, 70); }
    g.restore();
    g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(-w - 6, y0 + 60, 2 * w + 12, 6);
    g.fillStyle = '#e8322a'; g.fillRect(-w, y1 - 2, 2 * w, 22); texte(g, 'GRAND PRIX DU SALON', 0, y1 + 9, 16, '#ffffff', 'bold');
    for (const sd of [-1, 1]) { disque(g, sd * (w + 14), y1 + 6, 6, '#9aa0a8'); g.fillStyle = sd < 0 ? '#2f7ff0' : '#ffd23a'; g.beginPath(); g.moveTo(sd * (w + 14), y1 + 6); g.lineTo(sd * (w + 14) + 36, y1 - 4); g.lineTo(sd * (w + 14), y1 - 18); g.closePath(); g.fill(); }
  },
  canette(g, d, R, U) {                              // canette de soda renversée : elle a coulé jusqu'à la piste
    g.rotate(0.12);
    U.blob(g, 70, 4, 60, 22, 0.1, R, 'rgba(70,30,10,0.5)');
    ombre(g, 0.12, 0.5, () => U.rr(g, -58, -30, 116, 60, 16));
    g.fillStyle = lin(g, 0, -30, 0, 30, ['#9a1010', '#e8322a', '#ff6a5a', '#b81e1e']); g.beginPath(); U.rr(g, -50, -30, 100, 60, 10); g.fill();
    g.strokeStyle = '#ffffff'; g.lineWidth = 6; g.beginPath(); g.moveTo(-40, 8); g.bezierCurveTo(-14, -16, 10, 22, 40, -4); g.stroke();
    g.fillStyle = lin(g, 0, -28, 0, 28, ['#8a9099', '#e6e9ee', '#9aa0a8']); g.beginPath(); U.rr(g, 44, -28, 16, 56, 6); g.fill(); g.beginPath(); U.rr(g, -60, -26, 12, 52, 5); g.fill();
    disque(g, 54, -8, 5, '#3a1a0a'); g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(-44, -22, 84, 5);
  },
  tremplin(g, d, R, U) {                             // tremplin de la voiture télécommandée : planche sur deux livres, cônes
    const w = 130, h = 56;
    ombre(g, 0, 1.4, () => g.rect(-w, -h, 2 * w, 2 * h));
    g.fillStyle = '#2a5a9a'; g.fillRect(w - 70, -h - 14, 80, 2 * h + 28); g.fillStyle = '#9a2a3a'; g.fillRect(w - 60, -h - 6, 66, 2 * h + 12); g.fillStyle = '#f2ead6'; g.fillRect(w + 4, -h - 6, 4, 2 * h + 12);   // livres empilés
    g.fillStyle = lin(g, -w, 0, w, 0, ['#8a5a2a', '#c99a5a', '#e8c890']); g.fillRect(-w, -h, 2 * w, 2 * h);
    g.strokeStyle = 'rgba(80,40,10,0.3)'; g.lineWidth = 1.5; g.beginPath(); for (let k = 0; k < 6; k++) { const y = -h + 10 + k * 18 + R() * 6; g.moveTo(-w, y); g.bezierCurveTo(-40, y + 4, 40, y - 4, w, y + 2); } g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.75)'; for (const y of [-26, 26]) { g.beginPath(); g.moveTo(-40, y - 12); g.lineTo(10, y); g.lineTo(-40, y + 12); g.closePath(); g.fill(); }
    for (const p of [[-w - 60, -h - 30], [-w - 60, h + 30], [w + 70, -h - 50]]) { disque(g, p[0] + 4, p[1] + 6, 16, 'rgba(0,16,22,0.3)'); disque(g, p[0], p[1], 16, '#ff7a1a'); cercle(g, p[0], p[1], 10, 4, '#ffffff'); disque(g, p[0], p[1], 4, '#c4520f'); }
  },
  lego(g, d, R, U) {                                  // briques de construction éparpillées
    const brique = (x, y, a, col, nx) => {
      g.save(); g.translate(x, y); g.rotate(a);
      const L = nx * 24, H = 48;
      ombre(g, a, 0.4, () => g.rect(-L / 2, -H / 2, L, H));
      g.fillStyle = col; g.fillRect(-L / 2, -H / 2, L, H); g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(-L / 2, H / 2 - 5, L, 5);
      for (let i = 0; i < nx; i++) for (let j = 0; j < 2; j++) { const px = -L / 2 + 12 + i * 24, py = -12 + j * 24; disque(g, px + 1.5, py + 2, 8, 'rgba(0,0,0,0.25)'); disque(g, px, py, 8, col); disque(g, px - 2.5, py - 2.5, 3, 'rgba(255,255,255,0.45)'); }
      g.restore();
    };
    brique(-60, -20, 0.4, '#e8322a', 4); brique(40, 30, -0.3, '#ffd23a', 2); brique(70, -50, 1.2, '#2f7ff0', 3); brique(-20, 60, 2.0, '#2bb45a', 2);
  },
  voiture(g, d, R, U) {                               // voiture de circuit de rechange : patin de guidage, tresses, numéro
    g.rotate(-0.7);
    ombre(g, -0.7, 0.4, () => U.rr(g, -64, -26, 128, 52, 14));
    g.fillStyle = '#18181c'; for (const p of [[-50, -30], [24, -30], [-50, 18], [24, 18]]) g.fillRect(p[0], p[1], 28, 12);
    g.fillStyle = lin(g, 0, -20, 0, 20, ['#1a7a3a', '#3fc46a', '#1a7a3a']); g.beginPath(); g.moveTo(-60, -18); g.lineTo(40, -14); g.lineTo(66, -5); g.lineTo(66, 5); g.lineTo(40, 14); g.lineTo(-60, 18); g.closePath(); g.fill();
    g.fillStyle = '#f2f2f2'; g.fillRect(-66, -24, 14, 48); g.fillRect(58, -20, 10, 40);
    disque(g, -6, 0, 13, '#ffffff'); texte(g, '7', -6, 1, 16, '#1a1a22', 'bold');
    g.fillStyle = '#111'; g.fillRect(66, -3, 16, 6); g.fillStyle = '#d8a060'; g.fillRect(68, -6, 10, 3); g.fillRect(68, 3, 10, 3);   // patin et tresses de cuivre
  },
  tour(g, d, R, U) {                                  // tour de contrôle et compte-tours : vitres, toit-terrasse, drapeau à damier
    const s = 72;
    ombre(g, 0, 2.4, () => g.rect(-s, -s, 2 * s, 2 * s));
    g.fillStyle = lin(g, -s, -s, s, s, ['#f2efe6', '#cfcabd']); g.fillRect(-s, -s, 2 * s, 2 * s);
    g.fillStyle = lin(g, 0, -s + 10, 0, s - 10, ['#5aa8e8', '#1c4a80']); g.fillRect(-s + 10, -s + 10, 2 * s - 20, 2 * s - 20);   // vitrage tout autour
    g.fillStyle = '#ece8de'; g.fillRect(-s + 22, -s + 22, 2 * s - 44, 2 * s - 44);                // toit-terrasse
    g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 2; g.strokeRect(-s + 22, -s + 22, 2 * s - 44, 2 * s - 44);
    g.fillStyle = '#1a1a22'; g.fillRect(-40, 8, 80, 34); texte(g, 'TOUR 3/5', 0, 26, 15, '#ff5a2a', 'bold');   // compte-tours sur le toit
    disque(g, -30, -28, 8, '#ffb02a'); disque(g, -32, -30, 3, '#fff6c0');                        // gyrophare
    g.strokeStyle = '#9aa0a8'; g.lineWidth = 3; g.beginPath(); g.moveTo(36, -36); g.lineTo(36, -90); g.stroke();
    for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) { g.fillStyle = (i + j) % 2 ? '#111' : '#fff'; g.fillRect(36 + i * 11, -90 + j * 11, 11, 11); }
  },
};
// ── obstacle : pile de pneus (renvoie comme un bumper) ──
const OBJETS = {
  pneus(g, r, R, U) {
    const x = r[0], y = r[1], q = r[2];
    disque(g, x + q * 0.4, y + q * 0.6, q * 1.08, 'rgba(0,16,22,0.15)'); disque(g, x + q * 0.2, y + q * 0.3, q, 'rgba(0,16,22,0.3)');
    disque(g, x, y, q, '#1e1e22'); cercle(g, x, y, q * 0.72, q * 0.24, '#34343a');
    for (let k = 0; k < 8; k++) { g.strokeStyle = k % 2 ? '#ffffff' : '#e8322a'; g.lineWidth = q * 0.2; g.beginPath(); g.arc(x, y, q * 0.86, k * TAU / 8, (k + 1) * TAU / 8); g.stroke(); }
    disque(g, x, y, q * 0.42, '#0c0c0e'); g.strokeStyle = 'rgba(255,255,255,0.3)'; g.lineWidth = 2; g.beginPath(); g.arc(x, y, q * 0.6, 3.6, 4.6); g.stroke();
  },
};
const ZONES = {
  soda(g, z, R, U) {                                  // soda renversé : flaque brune, bulles, reflet
    U.blob(g, z[0], z[1], z[2], z[3], z[5], R, 'rgba(70,30,10,0.72)');
    g.save(); g.translate(z[0], z[1]); g.rotate(z[5]);
    g.fillStyle = 'rgba(255,210,160,0.25)'; g.beginPath(); U.oval(g, -z[2] * 0.3, -z[3] * 0.3, z[2] * 0.35, z[3] * 0.18); g.fill();
    g.strokeStyle = 'rgba(255,230,200,0.5)'; g.lineWidth = 1.5; for (let k = 0; k < 12; k++) { g.beginPath(); g.arc((R() - 0.5) * z[2] * 1.3, (R() - 0.5) * z[3] * 1.2, 2 + R() * 4, 0, TAU); g.stroke(); }
    g.restore();
  },
  poils(g, z, R, U) {                                 // touffe de poils de chat : fibres grises et rousses emmêlées
    g.save(); g.translate(z[0], z[1]); g.rotate(z[5]);
    g.fillStyle = 'rgba(200,190,180,0.22)'; g.beginPath(); U.oval(g, 0, 0, z[2], z[3]); g.fill();
    g.lineWidth = 1.6; g.beginPath();
    for (let k = 0; k < 110; k++) { const a = R() * TAU, q = Math.sqrt(R()), x = Math.cos(a) * z[2] * q, y = Math.sin(a) * z[3] * q, b = R() * TAU; g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(b) * 10 + 5, y + Math.sin(b) * 10, x + Math.cos(b) * 20, y + Math.sin(b) * 20); }
    g.strokeStyle = 'rgba(235,228,220,0.75)'; g.stroke();
    g.beginPath(); for (let k = 0; k < 40; k++) { const a = R() * TAU, q = Math.sqrt(R()), x = Math.cos(a) * z[2] * q, y = Math.sin(a) * z[3] * q; g.moveTo(x, y); g.lineTo(x + 14, y + (R() - 0.5) * 10); }
    g.strokeStyle = 'rgba(220,130,50,0.7)'; g.stroke();
    g.restore();
  },
};
// ── obstacles mobiles (dessinés à chaque image : sobres) ──
const MOBILES = {
  rc(g, m, o, now, U, rf) {                           // buggy télécommandé : gros pneus, aileron, antenne souple qui fouette
    const r = m.r;
    g.save(); g.translate(o.x, o.y); g.rotate(o.a);
    g.fillStyle = 'rgba(0,16,22,0.3)'; g.beginPath(); U.rr(g, -r * 1.15 + 4, -r * 0.95 + 7, r * 2.3, r * 1.9, 10); g.fill();
    g.fillStyle = '#18181c'; for (const p of [-0.68, 0.7]) for (const q of [-1, 1]) g.fillRect(p * r - r * 0.34, q * r * 0.72 - r * 0.25, r * 0.68, r * 0.5);
    g.fillStyle = '#2b2b30'; g.fillRect(-r * 0.92, -r * 0.4, r * 1.84, r * 0.8);
    g.fillStyle = m.coul || '#1f9fe0'; g.beginPath(); U.rr(g, -r * 0.72, -r * 0.5, r * 1.6, r, r * 0.3); g.fill();
    g.fillStyle = '#ffd23a'; g.fillRect(r * 0.3, -r * 0.5, r * 0.16, r);
    g.fillStyle = '#152238'; g.beginPath(); U.rr(g, -r * 0.24, -r * 0.3, r * 0.52, r * 0.6, 4); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.4)'; g.fillRect(-r * 0.6, -r * 0.42, r * 1.2, r * 0.12);
    g.fillStyle = '#f2f2f2'; g.fillRect(-r * 1.08, -r * 0.66, r * 0.22, r * 1.32);
    const w = rf ? 0 : Math.sin(now / 70) * 0.4;
    g.strokeStyle = '#111'; g.lineWidth = 1.8; g.beginPath(); g.moveTo(-r * 0.55, r * 0.32); g.quadraticCurveTo(-r * 1.3, r * (0.32 + w), -r * 2, r * (0.4 + w * 2)); g.stroke();
    g.fillStyle = '#e8322a'; g.fillRect(-r * 2 - 2, r * (0.4 + w * 2) - 2, 4, 4);
    g.restore();
  },
  pelote(g, m, o, now, U, rf) {                       // pelote de laine que le chat a fait rouler : brins enroulés, fil qui traîne
    const r = m.r, ca = Math.cos(o.a), sa = Math.sin(o.a), p = rf ? 0 : (o.x * ca + o.y * sa) / r;
    g.strokeStyle = '#c8325a'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(o.x - ca * r * 0.8, o.y - sa * r * 0.8);
    g.quadraticCurveTo(o.x - ca * r * 2 + sa * r, o.y - sa * r * 2 - ca * r, o.x - ca * r * 3.4, o.y - sa * r * 3.4); g.stroke();
    g.fillStyle = 'rgba(0,16,22,0.3)'; g.beginPath(); g.arc(o.x + 4, o.y + 6, r, 0, TAU); g.fill();
    g.fillStyle = '#e0457a'; g.beginPath(); g.arc(o.x, o.y, r, 0, TAU); g.fill();
    g.save(); g.translate(o.x, o.y); g.rotate(p * 0.5); g.strokeStyle = 'rgba(255,190,215,0.7)'; g.lineWidth = 2;
    for (let k = 0; k < 3; k++) { g.rotate(1.05); g.beginPath(); U.oval(g, 0, 0, r * 0.88, r * 0.42); g.stroke(); }
    g.restore();
    g.fillStyle = 'rgba(255,255,255,0.3)'; g.beginPath(); g.arc(o.x - r * 0.35, o.y - r * 0.4, r * 0.3, 0, TAU); g.fill();
  },
};

// ── par-dessus le décor fixe : tube du tunnel, portique de départ, carreaux de soleil ──
function tunnel(g, c) {
  const W = c.W, sp = plage(c, TUNNEL[0], TUNNEL[1]), o = W + 30;
  const bande = (o1, o2) => {
    g.beginPath();
    for (let s = sp[0]; s <= sp[1]; s++) { const p = pt(c, s, o1); if (s === sp[0]) g.moveTo(p[0], p[1]); else g.lineTo(p[0], p[1]); }
    for (let s = sp[1]; s >= sp[0]; s--) { const p = pt(c, s, o2); g.lineTo(p[0], p[1]); }
    g.closePath();
  };
  const ligne = off => { g.beginPath(); for (let s = sp[0]; s <= sp[1]; s++) { const p = pt(c, s, off); if (s === sp[0]) g.moveTo(p[0], p[1]); else g.lineTo(p[0], p[1]); } };
  g.save(); g.translate(12, 18); g.fillStyle = 'rgba(0,16,22,0.22)'; bande(-o - 6, o + 6); g.fill(); g.restore();
  g.fillStyle = 'rgba(16,6,40,0.16)'; bande(-o, o); g.fill();                              // pénombre sous le toit
  g.fillStyle = 'rgba(175,140,255,0.16)'; bande(-o, o); g.fill();                          // toit de plastique fumé
  g.lineJoin = 'round'; g.lineCap = 'butt';
  g.strokeStyle = 'rgba(235,220,255,0.26)'; g.lineWidth = 7; g.beginPath();              // arceaux
  for (let s = sp[0] + 4; s < sp[1] - 3; s += 7) { const a = pt(c, s, -o + 8), b = pt(c, s, o - 8); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); }
  g.stroke();
  for (const sd of [-1, 1]) { g.strokeStyle = '#6a2fb0'; g.lineWidth = 16; ligne(sd * (o - 6)); g.stroke(); g.strokeStyle = 'rgba(220,190,255,0.55)'; g.lineWidth = 3; ligne(sd * (o - 10)); g.stroke(); }
  g.strokeStyle = 'rgba(255,255,255,0.16)'; g.lineWidth = 14; ligne(-W * 0.4); g.stroke();   // reflet en long sur le dôme
  for (const s of [sp[0], sp[1]]) {                   // portails : arche épaisse, chevrons jaunes et noirs
    const i = s % c.n; g.save(); g.translate(c.sx[i], c.sy[i]); g.rotate(Math.atan2(c.ty[i], c.tx[i]));
    g.fillStyle = 'rgba(0,16,22,0.3)'; g.fillRect(-12, -o - 10 + 8, 30, 2 * o + 20);
    g.fillStyle = lin(g, -15, 0, 15, 0, ['#4a1a88', '#8a4ad8', '#4a1a88']); g.fillRect(-15, -o - 12, 30, 2 * o + 24);
    g.save(); g.beginPath(); g.rect(-15, -o - 12, 30, 2 * o + 24); g.clip(); g.fillStyle = '#ffd23a';
    for (let y = -o - 12; y < o + 12; y += 28) { g.beginPath(); g.moveTo(-15, y); g.lineTo(15, y + 14); g.lineTo(15, y + 24); g.lineTo(-15, y + 10); g.closePath(); g.fill(); }
    g.restore(); g.restore();
  }
}
function portique(g, c) {                             // portique de départ accroché à la tour : feux, deux compte-tours (un par voie)
  const W = c.W, a = Math.atan2(c.ty[0], c.tx[0]) + (c.inverse ? Math.PI : 0), e = W + 44;
  g.save(); g.translate(c.sx[0], c.sy[0]); g.rotate(a); g.translate(46, 0);
  ombre(g, a, 2.2, () => g.rect(-12, -e, 24, 2 * e));
  for (const sd of [-1, 1]) { g.fillStyle = lin(g, -18, 0, 18, 0, ['#6a6e78', '#b8bec8', '#6a6e78']); g.fillRect(-18, sd * e - 18, 36, 36); }
  g.fillStyle = lin(g, -12, 0, 12, 0, ['#22252c', '#4a4e58', '#22252c']); g.fillRect(-12, -e, 24, 2 * e);
  for (const sd of [-1, 1]) {
    const y = sd * W * 0.62; g.fillStyle = '#0c0c10'; g.fillRect(-22, y - 26, 44, 52); g.strokeStyle = '#9aa0a8'; g.lineWidth = 2; g.strokeRect(-22, y - 26, 44, 52);
    texte(g, sd < 0 ? '03' : '02', 0, y + 1, 20, '#ff4a1a', 'bold');
  }
  for (let k = -2; k <= 2; k++) { disque(g, 0, k * 14, 6, '#5a0a0a'); disque(g, 0, k * 14, 4, '#ff3a2a'); }
  g.restore();
}
function final(g, c, R, U) {
  tunnel(g, c); portique(g, c);
  const P = FENETRE, Ux = [300, 36], Vy = [130, 250];   // soleil de la fenêtre de gauche : 2 × 2 carreaux, croisillons d'ombre
  g.fillStyle = 'rgba(255,238,190,0.1)';
  for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) {
    const u0 = a * 1.08, v0 = b * 1.08, q = (u, v) => [P[0] + Ux[0] * u + Vy[0] * v, P[1] + Ux[1] * u + Vy[1] * v];
    const p1 = q(u0, v0), p2 = q(u0 + 1, v0), p3 = q(u0 + 1, v0 + 1), p4 = q(u0, v0 + 1);
    g.beginPath(); g.moveTo(p1[0], p1[1]); g.lineTo(p2[0], p2[1]); g.lineTo(p3[0], p3[1]); g.lineTo(p4[0], p4[1]); g.closePath(); g.fill();
  }
}

export default {
  id: 'piste', nom: 'Circuit-jouet', emoji: '🏁', sous: 'Moquette du salon · piste orange à rails, ligne des stands, tunnel', v: 2,
  w: 3900, h: 2460, surf: 'moquette', edge: 'mur', table: T, W: 104,
  pts: trace(1500, 2200, 0, [
    ['X', 2900],                                            // ligne des stands (turbos, tribune, tour)
    ['A', 440, -90], ['Y', 820], ['A', 440, -90],         // grande courbe relevée à deux temps, la télécommandée traverse
    ['X', 2590],
    ['A', 230, -90], ['Y', 1740], ['A', 150, 180], ['Y', 610], ['A', 230, -90],   // boucle intérieure : épingle serrée
    ['X', 780],                                             // ligne du canapé (la pelote du chat traverse)
    ['A', 300, -90], ['Y', 1000], ['A', 600, 18], ['A', 600, -36], ['A', 600, 18], ['Y', 1900], ['A', 300, -90],   // S du tunnel
    ['X', 1500],
  ]),
  mobs: [
    { type: 'rc', chemin: RC, r: 24, per: 11, coul: '#1f9fe0' },                  // buggy télécommandé qui boucle et coupe la ligne opposée
    { type: 'pelote', seg: [[1100, 256], [1100, 640]], r: 20, per: 6.4 },          // la pelote du chat roule sous le canapé et revient
  ],
  boxes: [0.057, 0.227, 0.444, 0.602, 0.702],
  bumpers: ['pneus'],
  zonesPhysiques: { soda: 'glisse', poils: 'frein' },
  make(H) {
    const c = H.c, n = c.n;
    const fr = (x, y) => idx(c, x, y) / n;
    H.wall(T.x0, T.y0, T.x1, T.y0, 20, 'plinthe'); H.wall(T.x1, T.y0, T.x1, T.y1, 20, 'plinthe');   // bas du canapé, murs de la pièce
    H.wall(T.x1, T.y1, T.x0, T.y1, 20, 'plinthe'); H.wall(T.x0, T.y1, T.x0, T.y0, 20, 'plinthe');
    // rails de plastique presque partout ; quelques ouvertures (extérieur de la grande courbe, sortie des stands,
    // extérieur du virage du canapé) où l'on peut s'échapper sur la moquette sans rien couper
    const rails = (side, trous) => {
      trous = trous.map(t => [fr(t[0], t[1]), fr(t[2], t[3])]).sort((a, b) => a[0] - b[0]);
      for (let k = 0; k < trous.length; k++) H.railsDe(trous[k][1], trous[(k + 1) % trous.length][0], side, 'rail');
    };
    rails(1, [[3086, 2159, 3281, 1980], [677, 398, 520, 530]]);
    rails(-1, [[2350, 2200, 2650, 2200]]);
    // turbos : ligne des stands (3), sortie de l'épingle, ligne du canapé
    H.boostAt(fr(1180, 2200)); H.boostAt(fr(1850, 2200)); H.boostAt(fr(2450, 2200));
    H.boostAt(fr(2060, 1250)); H.boostAt(fr(1640, 380)); H.boostAt(fr(3340, 1660));
    // piles de pneus (bumpers) : extérieur du freinage de la grande courbe, de l'épingle, ligne du canapé côté canapé
    H.rockAt(fr(2760, 2200), 0.6, 20, 'pneus'); H.rockAt(fr(2360, 1560), -0.6, 20, 'pneus'); H.rockAt(fr(1420, 380), 0.55, 20, 'pneus');
    H.rockAt(fr(2360, 1150), 0.15, 20, 'pneus');                       // pile au milieu de la descente vers l'épingle : à gauche ou à droite ?
    H.zoneAt(fr(2060, 900), -0.45, 80, 40, 'soda'); H.zoneAt(fr(2760, 380), 0.45, 76, 36, 'poils');
    const deco = (x, y, t, a, b) => c.deco.push([x, y, t, a, b]);
    deco(1700, 105, 'canape'); deco(1050, 125, 'chat'); deco(3560, 130, 'lampe'); deco(170, 110, 'plante');
    deco(3680, 560, 'coffre'); deco(3660, 2050, 'coussin', 0, 0.35); deco(820, 1450, 'coussin', 1, -0.25);
    deco(180, 700, 'telecommande'); deco(190, 2150, 'chausson', -0.5); deco(225, 1930, 'chausson', -1.9);
    deco(2960, 1290, 'tremplin'); deco(1720, 1560, 'lego'); deco(1520, 690, 'voiture'); deco(1870, 880, 'canette');
    deco(1050, 830, 'boite'); deco(1650, 960, 'manettes'); deco(1300, 1330, 'pieces');
    deco(1130, 1975, 'tribune'); deco(1500, 1990, 'tour');
    deco(2800, 720, 'radiocommande'); deco(2800, 1850, 'popcorn');
  },
  dessin: { sol, plateau, piste, bord, final, decor: DECOR, objets: OBJETS, zones: ZONES, mobiles: MOBILES, rails: 'aucun', hors: '#7a522a', traces: 'rgba(70,20,0,0.3)', poussiere: '150,205,210' },
};
