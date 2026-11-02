// RENDU DES CIRCUITS de Micro Machines (décor fixe pré-rendu + obstacles mobiles) — sorti de client.js le 02/11/2026
// pour que chaque circuit (./circuits/<id>.js) puisse apporter ses propres dessins, et pour la galerie /circuits.html.
// Module pur côté navigateur (canvas 2D) ; iOS 15 : ni ?. ni ??, ni roundRect / ctx.filter / ctx.ellipse / letterSpacing.
//
// Points d'accroche d'un circuit (propriété `dessin` de sa définition, tous facultatifs ; U = utilitaires en bas du fichier) :
//   sol(g, c, R, U)        le sol de la pièce, autour et sous la table (toute la surface c.w × c.h)
//   plateau(g, c, R, U)    le dessus de la table (dessiné dans un clip au rectangle arrondi de la table)
//   piste(g, c, R, U)      le ruban de piste (les flèches turbo sont ajoutées par-dessus automatiquement)
//   bord(g, c, R, U)       le bord de la table (par défaut : biseau de bois si `edge: 'chute'`)
//   zones[kind](g, z, R, U)        z = [x, y, rx, ry, kind, angle]
//   decor[type](g, d, R, U)        appelé APRÈS translate(d[0], d[1]) : dessiner autour de l'origine ; d = [x, y, type, …]
//   objets[type](g, r, R, U)       obstacle rond r = [x, y, rayon, type] (coordonnées absolues)
//   murs[type](g, w, R, U)         capsule w = [x1, y1, x2, y2, rayon, type] (coordonnées absolues)
//   mobiles[type](g, m, o, now, U, reduceFx)   obstacle mobile m ({ type, r, … }) à la position o { x, y, a, vx, vy }
//   final(g, c, R, U)      par-dessus tout le décor fixe (ponts, guirlandes, ombres portées…)
//   rails : 'moquette' (rails orange continus) | 'tapis' (dessine les murs « rail ») ; hors / traces : couleurs CSS
//     du sol au-delà du monde et des traces de pneus ; poussiere : 'r,g,b' de la poussière soulevée hors piste.
// R est un générateur pseudo-aléatoire à graine (le même dessin à chaque fois) : l'utiliser plutôt que Math.random.

const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const OPT = { contraste: false, reduceFx: false };
export function hexRgb(h) { const n = parseInt(String(h).slice(1, 7), 16) || 0; return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
export function rgbStr(c, a) { return a == null ? `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})` : `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`; }
export function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
export function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export function oval(g, x, y, rx, ry) { g.save(); g.translate(x, y); g.scale(rx, ry); g.moveTo(1, 0); g.arc(0, 0, 1, 0, Math.PI * 2); g.restore(); }
export function rr(g, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
// couleur du sol au-delà du monde, et des traces de pneus, pour un circuit
export function couleurHors(c) { const D = c.dessin || {}; return D.hors || HORS[c.surf] || '#0c0d16'; }
export function couleurTraces(c) { const D = c.dessin || {}; return D.traces || SKID_COL[c.surf] || 'rgba(0,0,0,0.25)'; }

export const HORS = { bois: '#4a2a1a', cahier: '#3c2618', feutre: '#3c2618', moquette: '#3c2618', etabli: '#2e2f32', plateau: '#3c2618', tapis: '#3c2618' };
export const SKID_COL = { bois: 'rgba(40,22,10,0.28)', cahier: 'rgba(70,70,84,0.26)', feutre: 'rgba(10,36,18,0.3)', moquette: 'rgba(60,24,8,0.32)', etabli: 'rgba(40,26,10,0.3)', plateau: 'rgba(40,30,20,0.26)', tapis: 'rgba(20,20,24,0.32)' };

export function trackPath(g, c, off) {                       // polyligne fermée décalée de `off` u (à droite du sens de course)
  g.beginPath();
  for (let i = 0; i <= c.n; i++) { const j = i % c.n, x = c.sx[j] + c.nx[j] * off, y = c.sy[j] + c.ny[j] * off; if (i) g.lineTo(x, y); else g.moveTo(x, y); }
}
export function centerStroke(g, c, w, col) { trackPath(g, c, 0); g.lineWidth = w; g.strokeStyle = col; g.lineJoin = 'round'; g.lineCap = 'round'; g.stroke(); }
export function peindreCircuit(g, c, opts) {
  OPT.contraste = !!(opts && opts.contraste); OPT.reduceFx = !!(opts && opts.reduceFx);
  const R = rng(0x51ca + c.L | 0), t = c.table, D = c.dessin || {};
  // 1) sol de la pièce, autour de la table
  if (D.sol) D.sol(g, c, R, U); else sol(g, c, R);
  // 2) table : ombre portée puis plateau
  g.save(); g.fillStyle = 'rgba(0,0,0,0.45)'; g.beginPath(); rr(g, t.x0 + 16, t.y0 + 22, t.x1 - t.x0, t.y1 - t.y0, t.r); g.fill(); g.restore();
  g.save(); g.beginPath(); rr(g, t.x0, t.y0, t.x1 - t.x0, t.y1 - t.y0, t.r); g.clip();
  if (D.plateau) D.plateau(g, c, R, U); else plateau(g, c, R);
  // 3) piste
  if (D.piste) { D.piste(g, c, R, U); flechesTurbo(g, c); } else piste(g, c, R);
  // 4) zones (lait, encre, sucre…)
  for (const z of c.zones) { if (D.zones && own(D.zones, z[4])) D.zones[z[4]](g, z, R, U); else zone(g, z, R); }
  // 5) ligne de départ (damier) + portes discrètes
  depart(g, c);
  g.restore();
  // bord de table : biseau clair + liseré sombre (là où l'on tombe)
  if (D.bord) D.bord(g, c, R, U);
  else if (c.edge === 'chute') {
    g.save(); g.lineWidth = 10; g.strokeStyle = c.surf === 'bois' ? '#7a4a22' : '#5b3a20'; g.beginPath(); rr(g, t.x0 + 4, t.y0 + 4, t.x1 - t.x0 - 8, t.y1 - t.y0 - 8, Math.max(4, t.r - 4)); g.stroke();
    g.lineWidth = 3; g.strokeStyle = 'rgba(255,230,190,0.45)'; g.beginPath(); rr(g, t.x0 + 9, t.y0 + 9, t.x1 - t.x0 - 18, t.y1 - t.y0 - 18, Math.max(4, t.r - 9)); g.stroke();
    if (OPT.contraste) { g.lineWidth = 4; g.strokeStyle = '#ffffff'; g.setLineDash([18, 12]); g.beginPath(); rr(g, t.x0 + 2, t.y0 + 2, t.x1 - t.x0 - 4, t.y1 - t.y0 - 4, t.r); g.stroke(); g.setLineDash([]); }
    g.restore();
  }
  // 6) trous, décor, obstacles, murs
  for (const h of c.holes) poche(g, h);
  for (const d of c.deco) { if (D.decor && own(D.decor, d[2])) { g.save(); g.translate(d[0], d[1]); D.decor[d[2]](g, d, R, U); g.restore(); } else decor(g, d, R); }
  for (const w of c.walls) { if (D.murs && own(D.murs, w[5])) D.murs[w[5]](g, w, R, U); else mur(g, w); }
  const rl = D.rails || c.surf;
  if (rl === 'moquette') rails(g, c); else if (rl === 'tapis') railsMurs(g, c);
  for (const r of c.rocks) { if (D.objets && own(D.objets, r[3])) D.objets[r[3]](g, r, R, U); else objet(g, r, R); }
  if (D.final) D.final(g, c, R, U);   // ponts, guirlandes… : au-dessus de tout le décor fixe (pas des voitures)
}
function sol(g, c, R) {
  const W = c.w, H = c.h;
  if (c.surf === 'bois') {                              // carrelage de cuisine crème et terre cuite
    const s = 150; for (let y = 0; y < H; y += s) for (let x = 0; x < W; x += s) { g.fillStyle = ((x + y) / s) % 2 ? '#d9c7a6' : '#b8643e'; g.fillRect(x, y, s, s); }
    g.strokeStyle = 'rgba(60,30,10,0.35)'; g.lineWidth = 3; for (let x = 0; x <= W; x += s) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); } for (let y = 0; y <= H; y += s) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
  } else if (c.surf === 'etabli') {                     // sol du garage : béton gris, joints de dalle, taches
    g.fillStyle = '#6d6f72'; g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(255,255,255,0.05)'; for (let k = 0; k < 2400; k++) g.fillRect(R() * W, R() * H, 3, 3);
    g.fillStyle = 'rgba(0,0,0,0.07)'; for (let k = 0; k < 2400; k++) g.fillRect(R() * W, R() * H, 3, 3);
    g.strokeStyle = 'rgba(30,30,32,0.45)'; g.lineWidth = 4;
    for (let x = 0; x <= W; x += 420) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
    for (let y = 0; y <= H; y += 420) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
    for (let k = 0; k < 6; k++) blob(g, R() * W, R() * H, 60 + R() * 80, 40 + R() * 50, R() * 3, R, 'rgba(20,18,14,0.35)');
  } else {                                              // parquet (bureau, billard, salon, jeu de société, tapis de jeu)
    const h = 64; for (let y = 0, row = 0; y < H; y += h, row++) {
      let x = -((row * 173) % 300);
      while (x < W) { const len = 260 + R() * 220, tn = 0.85 + R() * 0.3; g.fillStyle = rgbStr(mix([116, 74, 42], [158, 104, 62], R() * tn)); g.fillRect(x, y, len - 3, h - 3); x += len; }
    }
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, 0, W, H);
  }
  if (c.surf === 'feutre') {                           // billard : cadre en acajou verni et mouches de nacre (autour du feutre)
    const t = c.table, f = 62;
    g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(t.x0 - f + 14, t.y0 - f + 20, t.x1 - t.x0 + 2 * f, t.y1 - t.y0 + 2 * f);
    const gr = g.createLinearGradient(0, t.y0 - f, 0, t.y1 + f); gr.addColorStop(0, '#7a3418'); gr.addColorStop(0.5, '#5a2412'); gr.addColorStop(1, '#3e180a');
    g.fillStyle = gr; g.fillRect(t.x0 - f, t.y0 - f, t.x1 - t.x0 + 2 * f, t.y1 - t.y0 + 2 * f);
    g.strokeStyle = 'rgba(255,220,170,0.25)'; g.lineWidth = 3; g.strokeRect(t.x0 - f + 6, t.y0 - f + 6, t.x1 - t.x0 + 2 * f - 12, t.y1 - t.y0 + 2 * f - 12);
    g.fillStyle = '#f2ead8';
    for (let k = 1; k < 8; k++) { if (k === 4) continue; const x = t.x0 + (t.x1 - t.x0) * k / 8; g.beginPath(); g.arc(x, t.y0 - f / 2, 6, 0, Math.PI * 2); g.arc(x, t.y1 + f / 2, 6, 0, Math.PI * 2); g.fill(); }
    for (let k = 1; k < 4; k++) { const y = t.y0 + (t.y1 - t.y0) * k / 4; g.beginPath(); g.arc(t.x0 - f / 2, y, 6, 0, Math.PI * 2); g.arc(t.x1 + f / 2, y, 6, 0, Math.PI * 2); g.fill(); }
  }
}
function plateau(g, c, R) {
  const t = c.table, W = t.x1 - t.x0, H = t.y1 - t.y0;
  if (c.surf === 'bois') {                              // planches de bois clair, veinage, nœuds
    const ph = 140;
    for (let y = t.y0, k = 0; y < t.y1; y += ph, k++) {
      g.fillStyle = rgbStr(mix([214, 170, 112], [190, 140, 86], (k % 3) / 3 + R() * 0.2)); g.fillRect(t.x0, y, W, ph);
      g.strokeStyle = 'rgba(110,64,30,0.18)'; g.lineWidth = 1.6;
      for (let v = 0; v < 6; v++) { const yy = y + 12 + v * 21 + R() * 8; g.beginPath(); g.moveTo(t.x0, yy); for (let x = t.x0; x <= t.x1; x += 80) g.lineTo(x, yy + Math.sin(x / 190 + v + k) * 5); g.stroke(); }
      g.strokeStyle = 'rgba(70,40,18,0.45)'; g.lineWidth = 3; g.beginPath(); g.moveTo(t.x0, y); g.lineTo(t.x1, y); g.stroke();
      for (let n = 0; n < 2; n++) { const x = t.x0 + R() * W, yy = y + 30 + R() * (ph - 60); g.fillStyle = 'rgba(110,62,26,0.35)'; g.beginPath(); oval(g, x, yy, 16, 7); g.fill(); g.fillStyle = 'rgba(80,44,18,0.4)'; g.beginPath(); oval(g, x, yy, 7, 3); g.fill(); }
    }
    const sh = g.createRadialGradient(t.x0 + W * 0.4, t.y0 + H * 0.35, 80, t.x0 + W / 2, t.y0 + H / 2, W * 0.7);
    sh.addColorStop(0, 'rgba(255,240,200,0.14)'); sh.addColorStop(1, 'rgba(60,30,10,0.22)'); g.fillStyle = sh; g.fillRect(t.x0, t.y0, W, H);
  } else if (c.surf === 'cahier') {                     // bureau en bois sombre + grand cahier ouvert (quadrillage, marge rouge, spirale)
    g.fillStyle = '#6b3f22'; g.fillRect(t.x0, t.y0, W, H);
    g.strokeStyle = 'rgba(30,14,6,0.25)'; g.lineWidth = 2; for (let y = t.y0 + 20; y < t.y1; y += 34) { g.beginPath(); g.moveTo(t.x0, y); for (let x = t.x0; x <= t.x1; x += 100) g.lineTo(x, y + Math.sin(x / 230 + y) * 4); g.stroke(); }
    const px0 = t.x0 + 70, py0 = t.y0 + 60, pw = W - 140, ph = H - 120, mid = px0 + pw / 2;
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(px0 + 10, py0 + 14, pw, ph);
    g.fillStyle = '#fbfaf2'; g.fillRect(px0, py0, pw, ph);
    g.strokeStyle = 'rgba(90,150,220,0.32)'; g.lineWidth = 1.2; g.beginPath();
    for (let x = px0 + 25; x < px0 + pw; x += 25) { g.moveTo(x, py0); g.lineTo(x, py0 + ph); }
    for (let y = py0 + 25; y < py0 + ph; y += 25) { g.moveTo(px0, y); g.lineTo(px0 + pw, y); }
    g.stroke();
    g.strokeStyle = 'rgba(220,60,60,0.55)'; g.lineWidth = 2.5; for (const mx of [px0 + 110, mid + 110]) { g.beginPath(); g.moveTo(mx, py0); g.lineTo(mx, py0 + ph); g.stroke(); }
    const sg = g.createLinearGradient(mid - 40, 0, mid + 40, 0); sg.addColorStop(0, 'rgba(0,0,0,0)'); sg.addColorStop(0.5, 'rgba(0,0,0,0.16)'); sg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = sg; g.fillRect(mid - 40, py0, 80, ph);
    for (let y = py0 + 30; y < py0 + ph; y += 46) { g.strokeStyle = '#8f939a'; g.lineWidth = 5; g.beginPath(); oval(g, mid, y, 16, 9); g.stroke(); g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 1.5; g.beginPath(); g.arc(mid - 3, y - 3, 11, Math.PI * 1.1, Math.PI * 1.6); g.stroke(); }
  } else if (c.surf === 'feutre') {                     // billard : cadre en acajou, mouches de nacre, feutre vert éclairé par la lampe
    g.fillStyle = '#1f7a3e'; g.fillRect(t.x0, t.y0, W, H);
    g.fillStyle = 'rgba(255,255,255,0.03)'; for (let k = 0; k < 2500; k++) { g.fillRect(t.x0 + R() * W, t.y0 + R() * H, 2, 2); }
    const lg = g.createRadialGradient(t.x0 + W / 2, t.y0 + H / 2, 100, t.x0 + W / 2, t.y0 + H / 2, W * 0.62);
    lg.addColorStop(0, 'rgba(210,255,200,0.16)'); lg.addColorStop(1, 'rgba(0,20,5,0.4)'); g.fillStyle = lg; g.fillRect(t.x0, t.y0, W, H);
    g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = 2; g.beginPath(); g.moveTo(t.x0 + W * 0.22, t.y0 + 20); g.lineTo(t.x0 + W * 0.22, t.y1 - 20); g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.arc(t.x0 + W * 0.22, t.y0 + H / 2, 5, 0, Math.PI * 2); g.arc(t.x0 + W * 0.75, t.y0 + H / 2, 5, 0, Math.PI * 2); g.fill();
  } else if (c.surf === 'etabli') {                     // établi : contreplaqué clair, veinage, taches d'huile, rayures, trous de serrage
    g.fillStyle = '#c9a36c'; g.fillRect(t.x0, t.y0, W, H);
    for (let k = 0; k < 6; k++) { g.fillStyle = k % 2 ? 'rgba(120,80,30,0.08)' : 'rgba(255,240,200,0.08)'; g.fillRect(t.x0, t.y0 + k * H / 6, W, H / 6); }
    g.strokeStyle = 'rgba(120,76,32,0.2)'; g.lineWidth = 1.5;
    for (let v = 0; v < 60; v++) { const y = t.y0 + R() * H; g.beginPath(); g.moveTo(t.x0, y); for (let x = t.x0; x <= t.x1; x += 90) g.lineTo(x, y + Math.sin(x / 260 + v) * 7); g.stroke(); }
    for (let k = 0; k < 14; k++) { const x = t.x0 + R() * W, y = t.y0 + R() * H, r = 20 + R() * 70; g.fillStyle = 'rgba(60,40,15,' + (0.08 + R() * 0.14).toFixed(2) + ')'; g.beginPath(); oval(g, x, y, r, r * (0.6 + R() * 0.4)); g.fill(); }
    g.strokeStyle = 'rgba(70,45,20,0.22)'; g.lineWidth = 2;
    for (let k = 0; k < 40; k++) { const x = t.x0 + R() * W, y = t.y0 + R() * H, a = R() * Math.PI, l = 30 + R() * 90; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
    g.fillStyle = 'rgba(40,24,10,0.55)'; for (let x = t.x0 + 90; x < t.x1 - 60; x += 160) { g.beginPath(); g.arc(x, t.y0 + 30, 9, 0, Math.PI * 2); g.fill(); g.beginPath(); g.arc(x, t.y1 - 30, 9, 0, Math.PI * 2); g.fill(); }
    const sh = g.createRadialGradient(t.x0 + W * 0.45, t.y0 + H * 0.4, 80, t.x0 + W / 2, t.y0 + H / 2, W * 0.7);
    sh.addColorStop(0, 'rgba(255,250,220,0.12)'); sh.addColorStop(1, 'rgba(40,24,8,0.25)'); g.fillStyle = sh; g.fillRect(t.x0, t.y0, W, H);
  } else if (c.surf === 'plateau') {                    // plateau de jeu de société : carton crème, cadre bleu, soleil de couleurs, pli central
    g.fillStyle = '#1f3a7a'; g.fillRect(t.x0, t.y0, W, H);
    g.fillStyle = '#f1e4c2'; g.fillRect(t.x0 + 36, t.y0 + 36, W - 72, H - 72);
    const cx = t.x0 + W / 2, cy = t.y0 + H / 2, cols = ['rgba(232,50,42,0.10)', 'rgba(255,210,58,0.16)', 'rgba(43,180,90,0.10)', 'rgba(47,127,240,0.10)'];
    g.save(); g.beginPath(); g.rect(t.x0 + 36, t.y0 + 36, W - 72, H - 72); g.clip();
    for (let k = 0; k < 24; k++) { g.fillStyle = cols[k % 4]; g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, W, k * Math.PI / 12, (k + 1) * Math.PI / 12); g.closePath(); g.fill(); }
    g.restore();
    g.fillStyle = 'rgba(120,90,40,0.06)'; for (let k = 0; k < 2200; k++) g.fillRect(t.x0 + R() * W, t.y0 + R() * H, 2, 2);
    g.strokeStyle = '#c8a24a'; g.lineWidth = 5; g.strokeRect(t.x0 + 48, t.y0 + 48, W - 96, H - 96);
    g.strokeStyle = 'rgba(200,162,74,0.6)'; g.lineWidth = 2; g.strokeRect(t.x0 + 58, t.y0 + 58, W - 116, H - 116);
    g.fillStyle = 'rgba(0,0,0,0.13)'; g.fillRect(cx - 3, t.y0, 6, H);   // pli : le plateau se replie en deux
    g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(cx + 3, t.y0, 3, H);
  } else if (c.surf === 'tapis') {                      // tapis de jeu d'enfant : pelouse, rivière, champs, bordure jaune
    g.fillStyle = '#79bd58'; g.fillRect(t.x0, t.y0, W, H);
    for (let k = 0; k < 22; k++) blob(g, t.x0 + R() * W, t.y0 + R() * H, 70 + R() * 120, 50 + R() * 90, R() * 3, R, k % 3 ? 'rgba(160,215,110,0.35)' : 'rgba(50,130,60,0.28)');
    g.save(); g.lineCap = 'round'; g.lineJoin = 'round';
    g.beginPath(); g.moveTo(t.x0, t.y0 + H * 0.12); g.bezierCurveTo(t.x0 + W * 0.3, t.y0 + H * 0.02, t.x0 + W * 0.52, t.y0 + H * 0.98, t.x1, t.y0 + H * 0.86);
    g.strokeStyle = '#d9c48a'; g.lineWidth = 92; g.stroke();   // berges de sable
    g.strokeStyle = '#4aa3e0'; g.lineWidth = 74; g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.4)'; g.lineWidth = 4; g.setLineDash([30, 44]); g.stroke(); g.setLineDash([]);
    g.restore();
    for (const q of [[t.x0 + 120, t.y1 - 260], [t.x1 - 330, t.y0 + 90]]) {   // champs labourés dans deux coins
      g.fillStyle = '#c98a4a'; g.fillRect(q[0], q[1], 210, 150);
      g.strokeStyle = 'rgba(110,60,20,0.55)'; g.lineWidth = 4; g.beginPath(); for (let k = 12; k < 150; k += 18) { g.moveTo(q[0], q[1] + k); g.lineTo(q[0] + 210, q[1] + k); } g.stroke();
    }
    g.strokeStyle = '#f2c230'; g.lineWidth = 18; g.strokeRect(t.x0 + 9, t.y0 + 9, W - 18, H - 18);
    g.strokeStyle = '#e8322a'; g.lineWidth = 4; g.strokeRect(t.x0 + 22, t.y0 + 22, W - 44, H - 44);
  } else {                                              // moquette du salon : tapis à motifs et franges
    g.fillStyle = '#8c2731'; g.fillRect(t.x0, t.y0, W, H);
    g.fillStyle = '#2d3f8c'; g.fillRect(t.x0 + 60, t.y0 + 60, W - 120, H - 120);
    g.fillStyle = '#9b2e38'; g.fillRect(t.x0 + 110, t.y0 + 110, W - 220, H - 220);
    g.strokeStyle = 'rgba(255,210,120,0.5)'; g.lineWidth = 6; g.strokeRect(t.x0 + 84, t.y0 + 84, W - 168, H - 168);
    g.fillStyle = 'rgba(255,214,120,0.22)';
    for (let y = t.y0 + 170; y < t.y1 - 140; y += 120) for (let x = t.x0 + 170 + ((y / 120) % 2) * 60; x < t.x1 - 140; x += 120) { g.beginPath(); g.moveTo(x, y - 22); g.lineTo(x + 22, y); g.lineTo(x, y + 22); g.lineTo(x - 22, y); g.closePath(); g.fill(); }
    g.fillStyle = 'rgba(255,255,255,0.035)'; for (let k = 0; k < 3000; k++) g.fillRect(t.x0 + R() * W, t.y0 + R() * H, 2, 2);
  }
}
function piste(g, c, R) {
  const W = c.W;
  if (c.surf === 'bois') {
    centerStroke(g, c, 2 * W + 10, 'rgba(120,70,30,0.22)');
    centerStroke(g, c, 2 * W, 'rgba(255,236,200,0.2)');
    for (const side of [-1, 1]) {                       // bordure de céréales (anneaux dorés) et de morceaux de sucre
      for (let i = 0; i < c.n; i += 3) {
        if (R() < 0.12) continue;
        const o = (W + 8 + R() * 6) * side, x = c.sx[i] + c.nx[i] * o, y = c.sy[i] + c.ny[i] * o;
        if (R() < 0.08) { g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x - 6, y - 4, 13, 13); g.fillStyle = '#fbfbf6'; g.fillRect(x - 7, y - 7, 13, 13); g.lineWidth = 1; g.strokeStyle = 'rgba(0,0,0,0.15)'; g.strokeRect(x - 7, y - 7, 13, 13); continue; }   // lineWidth : sinon celui du ruban de piste (≈ 150 u)
        const r = 7 + R() * 2;
        g.fillStyle = 'rgba(80,40,10,0.25)'; g.beginPath(); g.arc(x + 1.5, y + 2, r, 0, Math.PI * 2); g.fill();
        g.fillStyle = R() < 0.5 ? '#e7a93a' : '#d98b26'; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.arc(x, y, r * 0.42, 0, Math.PI * 2, true); g.fill();
        g.fillStyle = 'rgba(255,240,180,0.5)'; g.beginPath(); g.arc(x - r * 0.35, y - r * 0.35, r * 0.25, 0, Math.PI * 2); g.fill();
      }
    }
  } else if (c.surf === 'cahier') {
    centerStroke(g, c, 2 * W, 'rgba(255,255,255,0.35)');
    for (const side of [-1, 1]) {                       // bords tracés au crayon à papier, un peu tremblés
      g.strokeStyle = 'rgba(60,62,74,0.75)'; g.lineWidth = 3; g.lineJoin = 'round'; g.beginPath();
      for (let i = 0; i <= c.n; i++) { const j = i % c.n, o = (W + Math.sin(j * 0.7) * 1.6) * side, x = c.sx[j] + c.nx[j] * o, y = c.sy[j] + c.ny[j] * o; if (i) g.lineTo(x, y); else g.moveTo(x, y); }
      g.stroke();
      g.strokeStyle = 'rgba(60,62,74,0.25)'; g.lineWidth = 1.5; trackPath(g, c, (W + 6) * side); g.stroke();
    }
    g.strokeStyle = 'rgba(40,90,200,0.35)'; g.lineWidth = 3; g.setLineDash([16, 26]); trackPath(g, c, 0); g.stroke(); g.setLineDash([]);   // pointillé au stylo bleu
    for (let i = 0; i < c.n; i += Math.round(c.n / 9)) {   // flèches de sens, au crayon
      const x = c.sx[i], y = c.sy[i], a = Math.atan2(c.ty[i], c.tx[i]);
      g.save(); g.translate(x, y); g.rotate(a); g.strokeStyle = 'rgba(60,62,74,0.55)'; g.lineWidth = 3; g.beginPath(); g.moveTo(-14, -14); g.lineTo(4, 0); g.lineTo(-14, 14); g.stroke(); g.restore();
    }
  } else if (c.surf === 'feutre') {
    centerStroke(g, c, 2 * W, 'rgba(255,255,255,0.06)');
    g.strokeStyle = 'rgba(255,255,255,0.42)'; g.lineWidth = 3; g.setLineDash([10, 14]);
    for (const side of [-1, 1]) { trackPath(g, c, W * side); g.stroke(); }
    g.setLineDash([]);
  } else if (c.surf === 'etabli') {                     // tracé au ruban de masquage, flèches à la craie
    centerStroke(g, c, 2 * W, 'rgba(90,60,25,0.14)');
    for (const side of [-1, 1]) {
      g.lineJoin = 'round';
      g.strokeStyle = 'rgba(60,40,10,0.22)'; g.lineWidth = 15; trackPath(g, c, (W + 5) * side + 2); g.stroke();
      g.strokeStyle = '#eadcae'; g.lineWidth = 13; trackPath(g, c, (W + 5) * side); g.stroke();
      g.strokeStyle = 'rgba(150,130,80,0.35)'; g.lineWidth = 1.5; g.setLineDash([5, 9]); trackPath(g, c, (W + 5) * side); g.stroke(); g.setLineDash([]);
    }
    for (let i = 0; i < c.n; i += Math.round(c.n / 10)) {
      const x = c.sx[i], y = c.sy[i], a = Math.atan2(c.ty[i], c.tx[i]);
      g.save(); g.translate(x, y); g.rotate(a); g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 5; g.lineCap = 'round'; g.beginPath(); g.moveTo(-16, -16); g.lineTo(6, 0); g.lineTo(-16, 16); g.stroke(); g.restore();
    }
  } else if (c.surf === 'plateau') {                    // chemin de cases numérotées, comme au jeu de l'oie (une case blanche ★ toutes les 9)
    centerStroke(g, c, 2 * W + 12, '#3b2a1a');
    const COLS = ['#ef6f5e', '#f7cf4a', '#6cc27a', '#5aa0e6', '#f3a6c0'], st = 7;
    for (let i = 0, m = 0; i < c.n; i += st, m++) {
      const e = Math.min(i + st, c.n), star = m % 9 === 8;
      g.beginPath();
      for (let q = i; q <= e; q++) { const j = q % c.n; g.lineTo(c.sx[j] + c.nx[j] * W, c.sy[j] + c.ny[j] * W); }
      for (let q = e; q >= i; q--) { const j = q % c.n; g.lineTo(c.sx[j] - c.nx[j] * W, c.sy[j] - c.ny[j] * W); }
      g.closePath(); g.fillStyle = star ? '#fbfbf6' : COLS[m % COLS.length]; g.fill();
      g.strokeStyle = '#3b2a1a'; g.lineWidth = 3; g.stroke();
      const k = (i + Math.floor((e - i) / 2)) % c.n;
      g.save(); g.translate(c.sx[k], c.sy[k]); g.rotate(Math.atan2(c.ty[k], c.tx[k]) + Math.PI / 2);
      g.textAlign = 'center'; g.textBaseline = 'middle';
      if (star) { g.fillStyle = '#e0a82a'; g.font = 'bold 40px sans-serif'; g.fillText('★', 0, 2); }
      else { g.fillStyle = 'rgba(40,28,16,0.3)'; g.font = 'bold 22px sans-serif'; g.fillText(String(m + 1), 0, 1); }
      g.restore();
    }
  } else if (c.surf === 'tapis') {                      // route du tapis de jeu : bas-côtés blancs, pointillés jaunes ; le croisement se fond
    centerStroke(g, c, 2 * W + 18, 'rgba(0,0,0,0.25)');
    centerStroke(g, c, 2 * W + 8, '#f2f2f4');
    centerStroke(g, c, 2 * W, '#5d626b');
    g.fillStyle = 'rgba(255,255,255,0.05)'; for (let k = 0; k < c.n * 3; k++) { const i = Math.floor(R() * c.n), o = (R() * 2 - 1) * W; g.fillRect(c.sx[i] + c.nx[i] * o, c.sy[i] + c.ny[i] * o, 3, 3); }
    g.strokeStyle = '#ffd23a'; g.lineWidth = 4; g.setLineDash([26, 22]); trackPath(g, c, 0); g.stroke(); g.setLineDash([]);
  } else {                                              // circuit-jouet : plastique orange, jointures, ligne centrale
    centerStroke(g, c, 2 * W + 26, 'rgba(0,0,0,0.35)');
    centerStroke(g, c, 2 * W + 18, '#c85a0c');
    centerStroke(g, c, 2 * W, '#ff8a1e');
    g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 3; g.setLineDash([24, 24]); trackPath(g, c, 0); g.stroke(); g.setLineDash([]);
    g.strokeStyle = 'rgba(120,50,0,0.45)'; g.lineWidth = 2;
    for (let i = 0; i < c.n; i += 7) { const x = c.sx[i], y = c.sy[i]; g.beginPath(); g.moveTo(x - c.nx[i] * W, y - c.ny[i] * W); g.lineTo(x + c.nx[i] * W, y + c.ny[i] * W); g.stroke(); }
  }
  flechesTurbo(g, c);
}
function flechesTurbo(g, c) {                          // flèches turbo jaunes (aussi par-dessus une piste dessinée par le circuit)
  for (const z of c.zones) if (z[4] === 'boost') {
    g.save(); g.translate(z[0], z[1]); g.rotate(z[5]);
    for (let k = -1; k <= 1; k++) { g.fillStyle = k ? '#ffd23a' : '#fff07a'; g.beginPath(); g.moveTo(k * 22 - 10, -24); g.lineTo(k * 22 + 10, 0); g.lineTo(k * 22 - 10, 24); g.lineTo(k * 22 - 2, 24); g.lineTo(k * 22 + 18, 0); g.lineTo(k * 22 - 2, -24); g.closePath(); g.fill(); }
    g.restore();
  }
}
function blob(g, x, y, rx, ry, a, R, col) {            // flaque irrégulière (lobes)
  g.save(); g.translate(x, y); g.rotate(a); g.fillStyle = col; g.beginPath(); oval(g, 0, 0, rx, ry);
  for (let k = 0; k < 7; k++) { const u = k / 7 * Math.PI * 2 + R() * 0.6, d = 0.75 + R() * 0.25, q = 0.22 + R() * 0.2; g.moveTo(Math.cos(u) * rx * d + rx * q, Math.sin(u) * ry * d); oval(g, Math.cos(u) * rx * d, Math.sin(u) * ry * d, rx * q, ry * q * 1.2); }
  g.fill(); g.restore();
}
function zone(g, z, R) {
  const k = z[4];
  if (k === 'boost') return;
  if (k === 'lait') { blob(g, z[0], z[1], z[2], z[3], z[5], R, 'rgba(250,252,255,0.95)'); g.fillStyle = 'rgba(255,255,255,0.8)'; g.beginPath(); oval(g, z[0] - z[2] * 0.3, z[1] - z[3] * 0.3, z[2] * 0.22, z[3] * 0.14); g.fill(); g.strokeStyle = 'rgba(160,190,220,0.5)'; g.lineWidth = 2; g.beginPath(); oval(g, z[0], z[1], z[2] * 0.95, z[3] * 0.95); g.stroke(); }
  else if (k === 'encre') { blob(g, z[0], z[1], z[2], z[3], z[5], R, 'rgba(24,34,110,0.88)'); for (let i = 0; i < 9; i++) { const u = R() * Math.PI * 2, d = 1.1 + R() * 0.5; g.fillStyle = 'rgba(24,34,110,0.85)'; g.beginPath(); g.arc(z[0] + Math.cos(u) * z[2] * d, z[1] + Math.sin(u) * z[3] * d, 3 + R() * 6, 0, Math.PI * 2); g.fill(); } g.fillStyle = 'rgba(140,160,255,0.35)'; g.beginPath(); oval(g, z[0] - z[2] * 0.25, z[1] - z[3] * 0.3, z[2] * 0.25, z[3] * 0.15); g.fill(); }
  else if (k === 'huile') {                             // huile de vidange : flaque sombre aux reflets irisés
    blob(g, z[0], z[1], z[2], z[3], z[5], R, 'rgba(28,22,14,0.82)');
    const gr = g.createLinearGradient(z[0] - z[2], z[1] - z[3], z[0] + z[2], z[1] + z[3]); gr.addColorStop(0, 'rgba(255,90,200,0.3)'); gr.addColorStop(0.5, 'rgba(90,216,255,0.3)'); gr.addColorStop(1, 'rgba(247,255,90,0.26)');
    g.fillStyle = gr; g.beginPath(); oval(g, z[0] - z[2] * 0.15, z[1] - z[3] * 0.2, z[2] * 0.45, z[3] * 0.28); g.fill();
  }
  else {                                                // sucre, gomme, craie, sciure : poudre / miettes / copeaux
    const col = k === 'sucre' ? '255,255,255' : k === 'gomme' ? '238,150,170' : k === 'sciure' ? '222,180,118' : '90,150,230';
    g.save(); g.translate(z[0], z[1]); g.rotate(z[5]);
    g.fillStyle = 'rgba(' + col + ',0.25)'; g.beginPath(); oval(g, 0, 0, z[2], z[3]); g.fill();
    for (let i = 0; i < 260; i++) { const u = R() * Math.PI * 2, d = Math.sqrt(R()); g.fillStyle = 'rgba(' + col + ',' + (0.5 + R() * 0.5).toFixed(2) + ')'; const s = k === 'gomme' || k === 'sciure' ? 3 + R() * 4 : 1.5 + R() * 2.5; g.fillRect(Math.cos(u) * z[2] * d, Math.sin(u) * z[3] * d, s, s * 0.8); }
    g.restore();
  }
}
function depart(g, c) {
  const i = 0, x = c.sx[i], y = c.sy[i], a = Math.atan2(c.ty[i], c.tx[i]), W = c.W, s = 12;
  g.save(); g.translate(x, y); g.rotate(a);
  for (let r = 0; r < 2; r++) for (let k = 0; k < Math.ceil(2 * W / s); k++) { g.fillStyle = (r + k) % 2 ? '#111' : '#f5f5f5'; g.fillRect(-s + r * s, -W + k * s, s, Math.min(s, W - (-W + k * s))); }
  g.restore();
  // cases de départ : petits traits blancs
  g.strokeStyle = c.surf === 'cahier' ? 'rgba(60,62,74,0.6)' : 'rgba(255,255,255,0.55)'; g.lineWidth = 2.5;
  for (let k = 0; k < 10; k++) {
    const row = Math.floor(k / 2), side = k % 2 ? -1 : 1, back = 46 + row * 52 + (k % 2) * 22, j = ((c.n - Math.round(back / c.step)) % c.n + c.n) % c.n, o = side * W * 0.42;
    const px = c.sx[j] + c.nx[j] * o, py = c.sy[j] + c.ny[j] * o, aa = Math.atan2(c.ty[j], c.tx[j]);
    g.save(); g.translate(px, py); g.rotate(aa); g.beginPath(); g.moveTo(18, -12); g.lineTo(22, -12); g.lineTo(22, 12); g.lineTo(18, 12); g.stroke(); g.restore();
  }
}
function poche(g, h) {
  g.fillStyle = '#3a1a0c'; g.beginPath(); g.arc(h[0], h[1], h[2] + 10, 0, Math.PI * 2); g.fill();
  const gr = g.createRadialGradient(h[0], h[1], h[2] * 0.2, h[0], h[1], h[2]); gr.addColorStop(0, '#000'); gr.addColorStop(1, '#1a1a1a');
  g.fillStyle = gr; g.beginPath(); g.arc(h[0], h[1], h[2], 0, Math.PI * 2); g.fill();
  if (OPT.contraste) { g.strokeStyle = '#fff'; g.lineWidth = 3; g.beginPath(); g.arc(h[0], h[1], h[2] + 2, 0, Math.PI * 2); g.stroke(); }
}
function shadow(g, x, y, r) { g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.arc(x + r * 0.15 + 4, y + r * 0.2 + 6, r, 0, Math.PI * 2); g.fill(); }
const BALL = { 1: '#f5c400', 2: '#1f4fcf', 3: '#d8261d', 4: '#5b2b9c', 5: '#ef7a10', 6: '#16884a', 7: '#7a1f1f', 8: '#111111' };
function bille(g, x, y, r, n) {
  shadow(g, x, y, r);
  const col = n === 0 ? '#f4f2e8' : BALL[n] || '#888', gr = g.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
  gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.25, col); gr.addColorStop(1, rgbStr(mix(hexRgb(col), [0, 0, 0], 0.45)));
  g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  if (n) { g.fillStyle = '#fff'; g.beginPath(); g.arc(x, y, r * 0.45, 0, Math.PI * 2); g.fill(); g.fillStyle = '#111'; g.font = 'bold ' + Math.round(r * 0.6) + 'px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(n), x, y + 1); }
}
function objet(g, r, R) {
  const x = r[0], y = r[1], s = r[2], t = r[3];
  if (/^bille(\d)$/.test(t)) { bille(g, x, y, s, +t.slice(5)); return; }
  if (t === 'blanche') { bille(g, x, y, s, 0); return; }
  if (/^rack/.test(t)) { bille(g, x, y, s, (+t.slice(4)) % 7 + 1); return; }
  if (t === 'bol') {                                    // bol de céréales vu de dessus
    shadow(g, x, y, s);
    const gr = g.createRadialGradient(x - s * 0.3, y - s * 0.35, s * 0.2, x, y, s); gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, '#c7ccd6');
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, s, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#2f7ff0'; g.lineWidth = 6; g.beginPath(); g.arc(x, y, s - 10, 0, Math.PI * 2); g.stroke();
    g.fillStyle = '#f4f6fb'; g.beginPath(); g.arc(x, y, s * 0.82, 0, Math.PI * 2); g.fill();
    for (let k = 0; k < 26; k++) { const u = R() * Math.PI * 2, d = Math.sqrt(R()) * s * 0.7, cx = x + Math.cos(u) * d, cy = y + Math.sin(u) * d; g.fillStyle = R() < 0.5 ? '#e7a93a' : '#cf7d22'; g.beginPath(); g.arc(cx, cy, 9, 0, Math.PI * 2); g.arc(cx, cy, 3.5, 0, Math.PI * 2, true); g.fill(); }
    g.fillStyle = '#b9bec7'; g.save(); g.translate(x + s * 0.2, y - s * 0.25); g.rotate(-0.6); g.beginPath(); rr(g, -8, -s * 0.9, 16, s * 0.9, 8); g.fill(); g.restore();   // manche de cuillère
    return;
  }
  if (t === 'tasse') {
    shadow(g, x, y, s * 1.25);
    g.fillStyle = '#e9e6df'; g.beginPath(); g.arc(x, y, s * 1.25, 0, Math.PI * 2); g.fill(); g.strokeStyle = 'rgba(0,0,0,0.12)'; g.lineWidth = 3; g.stroke();
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(x, y, s, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#ffffff'; g.beginPath(); rr(g, x + s * 0.85, y - 9, 30, 18, 9); g.fill(); g.strokeStyle = '#ddd'; g.stroke();
    const cg = g.createRadialGradient(x - 8, y - 8, 4, x, y, s * 0.8); cg.addColorStop(0, '#9b5a2c'); cg.addColorStop(1, '#4a2410');
    g.fillStyle = cg; g.beginPath(); g.arc(x, y, s * 0.8, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(255,230,190,0.45)'; g.beginPath(); oval(g, x - s * 0.25, y - s * 0.3, s * 0.25, s * 0.12); g.fill();
    return;
  }
  if (t === 'confiture') {
    shadow(g, x, y, s);
    g.fillStyle = '#c9a43a'; g.beginPath(); g.arc(x, y, s, 0, Math.PI * 2); g.fill();
    g.save(); g.beginPath(); g.arc(x, y, s * 0.88, 0, Math.PI * 2); g.clip(); g.fillStyle = '#fff'; g.fillRect(x - s, y - s, s * 2, s * 2);
    g.fillStyle = 'rgba(214,38,40,0.75)'; for (let k = -s; k < s; k += 14) { g.fillRect(x + k, y - s, 7, s * 2); g.fillRect(x - s, y + k, s * 2, 7); } g.restore();
    return;
  }
  if (t === 'sucre') { g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(x - s * 0.7 + 5, y - s * 0.7 + 6, s * 1.4, s * 1.4); g.fillStyle = '#fbfbf6'; g.fillRect(x - s * 0.7, y - s * 0.7, s * 1.4, s * 1.4); g.fillStyle = 'rgba(0,0,0,0.06)'; for (let k = 0; k < 30; k++) g.fillRect(x - s * 0.7 + R() * s * 1.4, y - s * 0.7 + R() * s * 1.4, 2, 2); return; }
  if (t === 'jus') { shadow(g, x, y, s); g.fillStyle = 'rgba(230,240,245,0.9)'; g.beginPath(); g.arc(x, y, s, 0, Math.PI * 2); g.fill(); g.fillStyle = '#f7a21a'; g.beginPath(); g.arc(x, y, s * 0.82, 0, Math.PI * 2); g.fill(); g.fillStyle = 'rgba(255,255,255,0.5)'; g.beginPath(); oval(g, x - s * 0.3, y - s * 0.35, s * 0.3, s * 0.15); g.fill(); g.strokeStyle = '#e8322a'; g.lineWidth = 6; g.beginPath(); g.moveTo(x + 6, y - 4); g.lineTo(x + s * 1.3, y - s * 1.1); g.stroke(); return; }
  if (t === 'gomme') { g.save(); g.translate(x, y); g.rotate(0.4); g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); rr(g, -s + 5, -s * 0.55 + 6, s * 2, s * 1.1, 8); g.fill(); g.fillStyle = '#f39ab0'; g.beginPath(); rr(g, -s, -s * 0.55, s * 2, s * 1.1, 8); g.fill(); g.fillStyle = '#3f6fd6'; g.beginPath(); rr(g, s * 0.15, -s * 0.55, s * 0.85, s * 1.1, 8); g.fill(); g.restore(); return; }
  if (t === 'taille') { shadow(g, x, y, s); g.fillStyle = '#9fb0c6'; g.beginPath(); rr(g, x - s, y - s * 0.7, s * 2, s * 1.4, 6); g.fill(); g.fillStyle = '#6c7a8e'; g.beginPath(); g.arc(x - s * 0.3, y, s * 0.35, 0, Math.PI * 2); g.fill(); g.fillStyle = '#d9dee6'; g.fillRect(x + s * 0.1, y - s * 0.5, s * 0.6, s * 0.12); return; }
  if (t === 'trombones') { for (let k = 0; k < 9; k++) { const u = R() * Math.PI * 2, d = R() * s * 0.7; g.save(); g.translate(x + Math.cos(u) * d, y + Math.sin(u) * d); g.rotate(R() * Math.PI); g.strokeStyle = k % 3 ? '#b9c0c8' : '#e8322a'; g.lineWidth = 3; g.beginPath(); rr(g, -18, -6, 36, 12, 6); g.stroke(); g.beginPath(); rr(g, -12, -3, 24, 6, 3); g.stroke(); g.restore(); } return; }
  if (t === 'bumper') {                                 // plot de flipper : couronne blanche, chapeau rouge, cœur jaune
    shadow(g, x, y, s);
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(x, y, s, 0, Math.PI * 2); g.fill();
    const gr = g.createRadialGradient(x - s * 0.3, y - s * 0.35, 1, x, y, s * 0.82); gr.addColorStop(0, '#ff8a7a'); gr.addColorStop(1, '#c81d14');
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, s * 0.82, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#ffd23a'; g.beginPath(); g.arc(x, y, s * 0.36, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 1.5; g.beginPath(); g.arc(x, y, s, 0, Math.PI * 2); g.stroke();
    return;
  }
  if (t === 'punaise' || t === 'pion') {                // punaise (tête de plastique) ou pion de jeu vu de dessus (socle, col, tête)
    shadow(g, x, y, s);
    const col = ['#e8322a', '#2f7ff0', '#2bb45a', '#ffd23a'][Math.floor(R() * 4)], dk = rgbStr(mix(hexRgb(col), [0, 0, 0], 0.38));
    if (t === 'pion') { g.fillStyle = dk; g.beginPath(); g.arc(x, y, s, 0, Math.PI * 2); g.fill(); g.fillStyle = col; g.beginPath(); g.arc(x, y, s * 0.78, 0, Math.PI * 2); g.fill(); }
    const rh = t === 'pion' ? s * 0.5 : s, gr = g.createRadialGradient(x - rh * 0.35, y - rh * 0.4, 1, x, y, rh);
    gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.35, col); gr.addColorStop(1, dk);
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, rh, 0, Math.PI * 2); g.fill();
    if (t === 'punaise') { g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 2; g.beginPath(); g.arc(x, y, s * 0.55, 0, Math.PI * 2); g.stroke(); }
    return;
  }
  if (t === 'tampon') {                                 // tampon de caoutchouc noir (pied de meuble), liseré jaune : il renvoie
    shadow(g, x, y, s);
    g.fillStyle = '#2a2224'; g.beginPath(); g.arc(x, y, s, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#4a3c40'; g.lineWidth = 3; g.beginPath(); g.arc(x, y, s * 0.72, 0, Math.PI * 2); g.stroke(); g.beginPath(); g.arc(x, y, s * 0.42, 0, Math.PI * 2); g.stroke();
    g.strokeStyle = '#ffd23a'; g.lineWidth = 2; g.setLineDash([5, 5]); g.beginPath(); g.arc(x, y, s - 2, 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
    g.fillStyle = 'rgba(255,255,255,0.18)'; g.beginPath(); oval(g, x - s * 0.3, y - s * 0.4, s * 0.35, s * 0.18); g.fill();
    return;
  }
  if (t === 'etau') {                                   // étau d'établi vu de dessus : corps en fonte bleue, mors d'acier, vis et poignée
    g.save(); g.translate(x, y); g.rotate(0.35);
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); rr(g, -s * 0.85 + 8, -s * 0.5 + 10, s * 1.7, s, 14); g.fill();
    const gr = g.createLinearGradient(0, -s * 0.5, 0, s * 0.5); gr.addColorStop(0, '#4c78c8'); gr.addColorStop(1, '#2a4a8a');
    g.fillStyle = gr; g.beginPath(); rr(g, -s * 0.85, -s * 0.5, s * 1.1, s, 14); g.fill();
    g.beginPath(); rr(g, s * 0.36, -s * 0.42, s * 0.46, s * 0.84, 12); g.fill();
    g.fillStyle = '#9aa0aa'; g.fillRect(s * 0.25, -s * 0.46, s * 0.06, s * 0.92); g.fillRect(s * 0.31, -s * 0.46, s * 0.05, s * 0.92);
    g.fillStyle = '#c9ced6'; g.fillRect(s * 0.82, -6, s * 0.12, 12);
    g.strokeStyle = '#c9ced6'; g.lineWidth = 7; g.lineCap = 'round'; g.beginPath(); g.moveTo(s * 0.93, -s * 0.38); g.lineTo(s * 0.93, s * 0.38); g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.18)'; g.beginPath(); rr(g, -s * 0.8, -s * 0.45, s * 1.0, s * 0.18, 8); g.fill();
    g.fillStyle = '#20345e'; for (const bx of [-0.7, -0.05]) for (const by of [-0.33, 0.33]) { g.beginPath(); g.arc(s * bx, s * by, 7, 0, Math.PI * 2); g.fill(); }
    g.restore(); return;
  }
  if (t === 'ecrou' || t === 'boulon') {                // écrou percé, ou tête de boulon sur sa rondelle : acier à six pans
    shadow(g, x, y, s);
    if (t === 'boulon') { g.fillStyle = '#a7adb6'; g.beginPath(); g.arc(x, y, s, 0, Math.PI * 2); g.fill(); g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 1.5; g.stroke(); }
    const h = t === 'boulon' ? s * 0.72 : s, a0 = R() * Math.PI, gr = g.createLinearGradient(x - h, y - h, x + h, y + h);
    gr.addColorStop(0, '#e3e7ee'); gr.addColorStop(0.5, '#9aa0aa'); gr.addColorStop(1, '#5d636c');
    g.fillStyle = gr; g.beginPath();
    for (let k = 0; k < 6; k++) { const a = a0 + k * Math.PI / 3; if (k) g.lineTo(x + Math.cos(a) * h, y + Math.sin(a) * h); else g.moveTo(x + Math.cos(a) * h, y + Math.sin(a) * h); }
    g.closePath(); g.fill(); g.strokeStyle = 'rgba(40,44,50,0.5)'; g.lineWidth = 1.5; g.stroke();
    if (t === 'ecrou') { g.fillStyle = '#3a3d42'; g.beginPath(); g.arc(x, y, s * 0.45, 0, Math.PI * 2); g.fill(); g.strokeStyle = 'rgba(255,255,255,0.25)'; g.beginPath(); g.arc(x, y, s * 0.38, 0, Math.PI * 2); g.stroke(); }
    else { g.strokeStyle = 'rgba(255,255,255,0.45)'; g.beginPath(); g.arc(x, y, h * 0.55, 0, Math.PI * 2); g.stroke(); }
    return;
  }
  if (t === 'vis') {                                    // tête de vis cruciforme
    shadow(g, x, y, s);
    const gr = g.createRadialGradient(x - s * 0.3, y - s * 0.35, 1, x, y, s); gr.addColorStop(0, '#f2f4f8'); gr.addColorStop(1, '#7d838c');
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, s, 0, Math.PI * 2); g.fill();
    g.save(); g.translate(x, y); g.rotate(R() * Math.PI); g.fillStyle = '#3a3d42'; g.fillRect(-s * 0.6, -s * 0.12, s * 1.2, s * 0.24); g.fillRect(-s * 0.12, -s * 0.6, s * 0.24, s * 1.2); g.restore();
    return;
  }
  if (t === 'de') {                                     // dé à jouer : cube blanc aux coins ronds, points noirs (le 1 en rouge)
    const v = 1 + Math.floor(R() * 6), h = s * 0.72;
    g.save(); g.translate(x, y); g.rotate(R() * Math.PI);
    g.fillStyle = 'rgba(0,0,0,0.32)'; g.beginPath(); rr(g, -h + 6, -h + 8, 2 * h, 2 * h, h * 0.3); g.fill();
    const gr = g.createLinearGradient(-h, -h, h, h); gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, '#d9d6cc');
    g.fillStyle = gr; g.beginPath(); rr(g, -h, -h, 2 * h, 2 * h, h * 0.3); g.fill(); g.strokeStyle = 'rgba(0,0,0,0.2)'; g.lineWidth = 1.5; g.stroke();
    const P = [null, [[0, 0]], [[-1, -1], [1, 1]], [[-1, -1], [0, 0], [1, 1]], [[-1, -1], [1, -1], [-1, 1], [1, 1]], [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]]];
    g.fillStyle = v === 1 ? '#d8261d' : '#1a1a1a'; g.beginPath();
    for (const q of P[v]) { g.moveTo(q[0] * h * 0.5 + h * 0.14, q[1] * h * 0.5); g.arc(q[0] * h * 0.5, q[1] * h * 0.5, h * 0.14, 0, Math.PI * 2); }
    g.fill(); g.restore(); return;
  }
  if (t === 'sablier') {                                // sablier vu de dessus : plateau de bois, trois colonnes, verre et sable
    shadow(g, x, y, s);
    g.fillStyle = '#9a5a2a'; g.beginPath(); g.arc(x, y, s, 0, Math.PI * 2); g.fill(); g.strokeStyle = '#6a3a1a'; g.lineWidth = 2; g.stroke();
    g.fillStyle = 'rgba(200,230,255,0.55)'; g.beginPath(); g.arc(x, y, s * 0.58, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#e8c27e'; g.beginPath(); g.arc(x, y, s * 0.38, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.7)'; g.beginPath(); oval(g, x - s * 0.2, y - s * 0.25, s * 0.16, s * 0.08); g.fill();
    g.fillStyle = '#6a3a1a'; for (let k = 0; k < 3; k++) { const a = k * Math.PI * 2 / 3 - Math.PI / 2; g.beginPath(); g.arc(x + Math.cos(a) * s * 0.8, y + Math.sin(a) * s * 0.8, s * 0.13, 0, Math.PI * 2); g.fill(); }
    return;
  }
  shadow(g, x, y, s); g.fillStyle = '#888'; g.beginPath(); g.arc(x, y, s, 0, Math.PI * 2); g.fill();
}
function mur(g, w) {
  const x1 = w[0], y1 = w[1], x2 = w[2], y2 = w[3], r = w[4], t = w[5], L = Math.hypot(x2 - x1, y2 - y1), a = Math.atan2(y2 - y1, x2 - x1);
  if (t === 'rail' || t === 'plinthe' || t === 'bande') { if (t === 'bande') { g.save(); g.lineCap = 'butt'; g.strokeStyle = '#155c2c'; g.lineWidth = r * 2; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); g.strokeStyle = 'rgba(255,255,255,0.12)'; g.lineWidth = 3; g.stroke(); g.restore(); } return; }
  g.save(); g.translate(x1, y1); g.rotate(a);
  g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); rr(g, 4, -r + 6, L, r * 2, r); g.fill();
  if (t === 'crayon') {                                 // crayon à papier : corps jaune à pans, bois taillé, mine, gomme rose
    g.fillStyle = '#f2c230'; g.fillRect(14, -r, L - 40, r * 2); g.fillStyle = '#d9a514'; g.fillRect(14, -r * 0.3, L - 40, r * 0.6);
    g.fillStyle = '#c3c7cc'; g.fillRect(L - 26, -r, 10, r * 2); g.fillStyle = '#f08aa0'; g.beginPath(); rr(g, L - 18, -r, 18, r * 2, 5); g.fill();
    g.fillStyle = '#e8c79a'; g.beginPath(); g.moveTo(14, -r); g.lineTo(0, 0); g.lineTo(14, r); g.closePath(); g.fill(); g.fillStyle = '#333'; g.beginPath(); g.moveTo(5, -r * 0.35); g.lineTo(0, 0); g.lineTo(5, r * 0.35); g.closePath(); g.fill();
  } else if (t === 'regle') {                           // règle transparente graduée
    g.fillStyle = 'rgba(170,215,240,0.55)'; g.beginPath(); rr(g, 0, -r, L, r * 2, 3); g.fill(); g.strokeStyle = 'rgba(60,110,150,0.7)'; g.lineWidth = 1.5; g.stroke();
    g.strokeStyle = 'rgba(20,40,70,0.8)'; g.lineWidth = 1.2; g.beginPath(); for (let k = 8; k < L - 4; k += 8) { const h = (k / 8) % 5 === 0 ? r * 0.9 : r * 0.45; g.moveTo(k, -r); g.lineTo(k, -r + h); } g.stroke();
  } else if (t === 'stylo') {
    g.fillStyle = '#2547a8'; g.beginPath(); rr(g, 10, -r, L - 10, r * 2, r); g.fill(); g.fillStyle = '#e9e9ee'; g.fillRect(L * 0.55, -r, 8, r * 2); g.fillStyle = '#1a1a1a'; g.beginPath(); g.moveTo(10, -r * 0.6); g.lineTo(0, 0); g.lineTo(10, r * 0.6); g.fill();
  } else if (t === 'cuillere') {
    g.fillStyle = '#c8ccd4'; g.beginPath(); rr(g, 40, -r * 0.45, L - 40, r * 0.9, r * 0.45); g.fill(); g.beginPath(); oval(g, 22, 0, 26, r * 1.25); g.fill(); g.fillStyle = 'rgba(255,255,255,0.6)'; g.beginPath(); oval(g, 18, -4, 12, 5); g.fill();
  } else if (t === 'queue') {
    const gr = g.createLinearGradient(0, 0, L, 0); gr.addColorStop(0, '#2f6fd6'); gr.addColorStop(0.02, '#f1e6cc'); gr.addColorStop(0.6, '#c99a5b'); gr.addColorStop(1, '#3a1d0c');
    g.fillStyle = gr; g.beginPath(); rr(g, 0, -r * 0.6, L, r * 1.2, r * 0.6); g.fill();
  } else if (t === 'marteau') {                         // marteau : manche en bois verni, poignée caoutchouc, tête d'acier au bout
    const gr = g.createLinearGradient(0, -r, 0, r); gr.addColorStop(0, '#e0b070'); gr.addColorStop(1, '#9a6a34');
    g.fillStyle = gr; g.beginPath(); rr(g, 0, -r * 0.72, L - 18, r * 1.44, r * 0.7); g.fill();
    g.fillStyle = '#2a2a30'; g.beginPath(); rr(g, 0, -r * 0.8, L * 0.3, r * 1.6, r * 0.8); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.12)'; g.lineWidth = 2; g.beginPath(); for (let k = 10; k < L * 0.3; k += 12) { g.moveTo(k, -r * 0.8); g.lineTo(k, r * 0.8); } g.stroke();
    const hg = g.createLinearGradient(0, -r * 1.7, 0, r * 1.7); hg.addColorStop(0, '#dfe3ea'); hg.addColorStop(0.5, '#8a9099'); hg.addColorStop(1, '#5d636c');
    g.fillStyle = hg; g.beginPath(); rr(g, L - 36, -r * 1.7, 36, r * 3.4, 5); g.fill();
    g.fillStyle = '#4a4f57'; g.fillRect(L - 36, -r * 1.7, 6, r * 3.4);
  } else { g.fillStyle = '#777'; g.beginPath(); rr(g, 0, -r, L, r * 2, r); g.fill(); }
  g.restore();
}
function rails(g, c) {                                  // rails du circuit-jouet : lèvre de plastique en relief, ombre au sol
  for (const side of [-1, 1]) {
    g.lineJoin = 'round'; g.strokeStyle = 'rgba(0,0,0,0.4)'; g.lineWidth = 12; trackPath(g, c, (c.W + 13) * side); g.stroke();
    g.strokeStyle = '#ffb04a'; g.lineWidth = 9; trackPath(g, c, (c.W + 10) * side); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.45)'; g.lineWidth = 2.5; trackPath(g, c, (c.W + 8) * side); g.stroke();
  }
}
function railsMurs(g, c) {                             // circuit en 8 : rails bleus, interrompus au croisement (ce sont les murs « rail »)
  const passe = (lw, col) => { g.beginPath(); for (const w of c.walls) if (w[5] === 'rail') { g.moveTo(w[0], w[1]); g.lineTo(w[2], w[3]); } g.lineWidth = lw; g.strokeStyle = col; g.stroke(); };
  g.save(); g.lineCap = 'round'; g.lineJoin = 'round';
  g.translate(2, 3); passe(12, 'rgba(0,0,0,0.35)'); g.translate(-2, -3);
  passe(9, '#2f7ff0'); passe(2.5, 'rgba(255,255,255,0.5)');
  g.restore();
}

export function mobileDessin(g, c, m, o, now, reduceFx) {   // obstacles mobiles : souris mécanique, bille, toupie (+ ceux du circuit)
  OPT.reduceFx = !!reduceFx;
  const D = c.dessin || {};
  if (D.mobiles && own(D.mobiles, m.type)) { D.mobiles[m.type](g, m, o, now, U, OPT.reduceFx); return; }
  const x = o.x, y = o.y, r = m.r;
  if (m.type === 'bille') { bille(g, x, y, r, 3); return; }
  if (m.type === 'souris') {                           // corps gris en goutte, oreilles roses, queue qui frétille, clé de remontage qui tourne
    g.save(); g.translate(x, y); g.rotate(o.a);
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); oval(g, 3, 5, r * 1.3, r * 0.85); g.fill();
    g.strokeStyle = '#d88a9a'; g.lineWidth = 2.5; g.lineCap = 'round'; g.beginPath(); g.moveTo(-r * 1.2, 0); g.quadraticCurveTo(-r * 1.9, r * 0.6 * (OPT.reduceFx ? 0.5 : Math.sin(now / 90)), -r * 2.4, 0); g.stroke();
    const gr = g.createRadialGradient(-r * 0.2, -r * 0.3, 2, 0, 0, r * 1.3); gr.addColorStop(0, '#c9ccd2'); gr.addColorStop(1, '#6f747c');
    g.fillStyle = gr; g.beginPath(); g.moveTo(r * 1.35, 0); g.quadraticCurveTo(r * 0.6, -r * 0.95, -r * 1.2, -r * 0.7); g.quadraticCurveTo(-r * 1.45, 0, -r * 1.2, r * 0.7); g.quadraticCurveTo(r * 0.6, r * 0.95, r * 1.35, 0); g.fill();
    g.fillStyle = '#f0a8b8'; g.beginPath(); g.arc(r * 0.35, -r * 0.62, r * 0.32, 0, Math.PI * 2); g.fill(); g.beginPath(); g.arc(r * 0.35, r * 0.62, r * 0.32, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(r * 1.35, 0, 2.6, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#111'; g.beginPath(); g.arc(r * 0.9, -r * 0.22, 2.2, 0, Math.PI * 2); g.fill(); g.beginPath(); g.arc(r * 0.9, r * 0.22, 2.2, 0, Math.PI * 2); g.fill();
    g.save(); g.translate(-r * 0.4, 0); g.rotate(OPT.reduceFx ? 0 : now / 120); g.fillStyle = '#d8b44a'; g.fillRect(-1.5, -r * 0.55, 3, r * 1.1); g.beginPath(); oval(g, 0, -r * 0.55, 5, 3.5); oval(g, 0, r * 0.55, 5, 3.5); g.fill(); g.restore();
    g.restore(); return;
  }
  const sp = OPT.reduceFx ? 0 : now / 90;                 // toupie : disque à quartiers qui tourne vite, pointe au centre, traînées
  g.save(); g.translate(x, y);
  g.fillStyle = 'rgba(0,0,0,0.28)'; g.beginPath(); g.arc(4, 6, r, 0, Math.PI * 2); g.fill();
  g.rotate(sp);
  const cols = ['#e8322a', '#ffd23a', '#2f7ff0', '#2bb45a'];
  for (let k = 0; k < 8; k++) { g.fillStyle = cols[k % 4]; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, r, k * Math.PI / 4, (k + 1) * Math.PI / 4); g.closePath(); g.fill(); }
  g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 2; g.beginPath(); g.arc(0, 0, r * 0.62, 0, Math.PI * 2); g.stroke();
  g.fillStyle = '#7a4a22'; g.beginPath(); g.arc(0, 0, r * 0.28, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.5)'; g.beginPath(); g.arc(-r * 0.08, -r * 0.08, r * 0.1, 0, Math.PI * 2); g.fill();
  g.restore();
  if (!OPT.reduceFx) { g.save(); g.globalAlpha = 0.35; g.strokeStyle = '#ffffff'; g.lineWidth = 2; for (let k = 0; k < 3; k++) { g.beginPath(); g.arc(x, y, r + 4, sp * 1.3 + k * 2.1, sp * 1.3 + k * 2.1 + 0.9); g.stroke(); } g.restore(); }
}

function decor(g, d, R) {
  const x = d[0], y = d[1], t = d[2];
  g.save(); g.translate(x, y);
  if (t === 'tartine') { g.rotate(0.3); g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); rr(g, -70, -62, 150, 140, 30); g.fill(); g.fillStyle = '#b87a35'; g.beginPath(); rr(g, -76, -70, 150, 140, 30); g.fill(); g.fillStyle = '#e8c27e'; g.beginPath(); rr(g, -64, -58, 126, 116, 22); g.fill(); blob(g, -6, 0, 46, 38, 0.2, R, 'rgba(190,20,40,0.85)'); }
  else if (t === 'croissant') { g.rotate(-0.5); g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); oval(g, 6, 10, 90, 44); g.fill(); for (let k = -3; k <= 3; k++) { g.fillStyle = k % 2 ? '#d08a2a' : '#e8a23e'; g.beginPath(); oval(g, k * 24, Math.abs(k) * 6, 30 - Math.abs(k) * 4, 34 - Math.abs(k) * 5); g.fill(); } }
  else if (t === 'serviette') { g.rotate(-0.15); g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(-96, -66, 200, 140); g.fillStyle = '#f2f6ff'; g.fillRect(-100, -70, 200, 140); g.fillStyle = 'rgba(47,127,240,0.35)'; for (let k = -100; k < 100; k += 20) { g.fillRect(k, -70, 10, 140); } for (let k = -70; k < 70; k += 20) g.fillRect(-100, k, 200, 10); }
  else if (t === 'beurre') { g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); rr(g, -76, -46, 160, 100, 16); g.fill(); g.fillStyle = '#e6e6ea'; g.beginPath(); rr(g, -80, -50, 160, 100, 16); g.fill(); g.fillStyle = '#f7e07a'; g.beginPath(); rr(g, -50, -28, 100, 56, 6); g.fill(); }
  else if (t === 'compas') { g.rotate(0.7); g.strokeStyle = '#9aa3ad'; g.lineWidth = 9; g.lineCap = 'round'; g.beginPath(); g.moveTo(0, -90); g.lineTo(-40, 70); g.moveTo(0, -90); g.lineTo(40, 70); g.stroke(); g.fillStyle = '#e8322a'; g.beginPath(); g.arc(0, -90, 14, 0, Math.PI * 2); g.fill(); }
  else if (t === 'equerre') { g.rotate(-0.25); g.fillStyle = 'rgba(255,170,60,0.45)'; g.beginPath(); g.moveTo(-110, 60); g.lineTo(110, 60); g.lineTo(-110, -90); g.closePath(); g.fill(); g.strokeStyle = 'rgba(150,80,20,0.7)'; g.lineWidth = 2; g.stroke(); }
  else if (t === 'trousse') { g.rotate(0.1); g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); rr(g, -116, -36, 240, 84, 34); g.fill(); g.fillStyle = '#5c2ea8'; g.beginPath(); rr(g, -120, -42, 240, 84, 34); g.fill(); g.strokeStyle = '#d8c25a'; g.lineWidth = 4; g.setLineDash([8, 6]); g.beginPath(); g.moveTo(-100, 0); g.lineTo(100, 0); g.stroke(); g.setLineDash([]); }
  else if (t === 'craie') { g.rotate(0.3); g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(-18, -14, 40, 36); g.fillStyle = '#3d7ee0'; g.fillRect(-22, -20, 40, 36); g.fillStyle = '#9cc2ff'; g.fillRect(-14, -12, 24, 20); }
  else if (t === 'cubes') { const cols = ['#e8322a', '#2f7ff0', '#ffd23a', '#2bb45a']; for (let k = 0; k < 4; k++) { const bx = (k % 2) * 92 - 46, by = Math.floor(k / 2) * 92 - 46; g.save(); g.translate(bx, by); g.rotate((k - 1.5) * 0.18); g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(-36, -30, 76, 76); g.fillStyle = cols[k]; g.fillRect(-40, -38, 76, 76); g.fillStyle = 'rgba(255,255,255,0.85)'; g.font = 'bold 44px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('MICR'[k], -2, 2); g.restore(); } }
  else if (t === 'livre') { g.rotate(-0.2); g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(-150, -96, 310, 210); g.fillStyle = '#c33a2a'; g.fillRect(-156, -104, 310, 210); g.fillStyle = '#f3ead6'; g.fillRect(-150, -98, 298, 198); g.fillStyle = '#2a2a2a'; g.font = 'bold 34px sans-serif'; g.textAlign = 'center'; g.fillText('CONTES', 0, 10); }
  else if (t === 'peluche') { g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.arc(8, 12, 92, 0, Math.PI * 2); g.fill(); g.fillStyle = '#b07a43'; g.beginPath(); g.arc(0, 0, 90, 0, Math.PI * 2); g.arc(-62, -62, 32, 0, Math.PI * 2); g.arc(62, -62, 32, 0, Math.PI * 2); g.fill(); g.fillStyle = '#e3c39a'; g.beginPath(); oval(g, 0, 22, 40, 30); g.fill(); g.fillStyle = '#2a1a10'; g.beginPath(); g.arc(-28, -16, 9, 0, Math.PI * 2); g.arc(28, -16, 9, 0, Math.PI * 2); g.arc(0, 14, 11, 0, Math.PI * 2); g.fill(); }
  else if (t === 'chaussette') { g.rotate(0.5); g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); rr(g, -76, -30, 160, 64, 30); g.fill(); g.fillStyle = '#2bb45a'; g.beginPath(); rr(g, -80, -36, 160, 64, 30); g.fill(); g.fillStyle = '#ffd23a'; for (let k = -60; k < 70; k += 34) g.fillRect(k, -36, 14, 64); }
  else if (t === 'metre') {                             // mètre ruban : boîtier jaune, ruban gradué déroulé
    g.rotate(-0.08);
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(-26, -6, 300, 26); g.beginPath(); rr(g, -116, -42, 100, 100, 24); g.fill();
    g.fillStyle = '#f7d84a'; g.fillRect(-30, -11, 300, 24);
    g.fillStyle = '#1a1a1a'; for (let k = 0; k <= 296; k += 10) g.fillRect(-30 + k, -11, 2, k % 50 ? 7 : 13);
    g.font = 'bold 11px sans-serif'; g.textAlign = 'left'; for (let k = 50; k < 300; k += 50) g.fillText(String(k / 10), -26 + k, 10);
    g.fillStyle = '#222'; g.beginPath(); rr(g, -122, -50, 100, 100, 24); g.fill();
    g.fillStyle = '#ffd23a'; g.beginPath(); rr(g, -116, -44, 88, 88, 20); g.fill();
    g.fillStyle = '#c9ced6'; g.beginPath(); g.arc(-72, 0, 20, 0, Math.PI * 2); g.fill(); g.fillStyle = '#8a9099'; g.beginPath(); g.arc(-72, 0, 8, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#9a9ea6'; g.fillRect(-34, -13, 8, 28);
  }
  else if (t === 'chiffon') {                           // chiffon d'atelier rouge, froissé et taché
    g.rotate(0.4); blob(g, 4, 6, 110, 62, 0, R, 'rgba(0,0,0,0.28)'); blob(g, 0, 0, 110, 62, 0, R, '#c8322c');
    g.strokeStyle = 'rgba(80,10,10,0.5)'; g.lineWidth = 3;
    for (let k = 0; k < 6; k++) { const a = R() * Math.PI, l = 40 + R() * 50, x0 = (R() - 0.5) * 120, y0 = (R() - 0.5) * 60; g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(x0 + Math.cos(a) * l * 0.5 + 10, y0 + Math.sin(a) * l * 0.5 - 8, x0 + Math.cos(a) * l, y0 + Math.sin(a) * l); g.stroke(); }
    g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 2; g.setLineDash([5, 7]); g.beginPath(); oval(g, 0, 0, 96, 50); g.stroke(); g.setLineDash([]);
    blob(g, 30, -10, 26, 18, 0.3, R, 'rgba(30,20,10,0.55)');
  }
  else if (t === 'tournevis') {                         // tournevis : manche bi-matière, tige d'acier
    g.rotate(0.15);
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); rr(g, -86, -8, 84, 26, 12); g.fill(); g.fillRect(0, 2, 90, 8);
    g.fillStyle = '#b9bec7'; g.fillRect(-6, -4, 92, 8); g.fillStyle = '#e5e8ee'; g.fillRect(-6, -4, 92, 2.5);
    g.fillStyle = '#8a9099'; g.beginPath(); g.moveTo(86, -4); g.lineTo(94, 0); g.lineTo(86, 4); g.closePath(); g.fill();
    g.fillStyle = '#e8322a'; g.beginPath(); rr(g, -90, -13, 86, 26, 12); g.fill();
    g.fillStyle = '#ffd23a'; for (let k = -78; k < -10; k += 16) g.fillRect(k, -13, 6, 26);
    g.fillStyle = 'rgba(255,255,255,0.3)'; g.beginPath(); rr(g, -84, -10, 74, 6, 3); g.fill();
  }
  else if (t === 'pinceau') {                           // pinceau : manche en bois, virole, poils trempés dans le bleu, coulure
    g.rotate(-0.5);
    blob(g, 70, 4, 46, 30, 0.2, R, 'rgba(47,127,240,0.75)');
    g.fillStyle = 'rgba(0,0,0,0.28)'; g.beginPath(); rr(g, -96, -4, 150, 18, 9); g.fill();
    g.fillStyle = '#c98a4a'; g.beginPath(); rr(g, -100, -8, 120, 16, 8); g.fill();
    g.fillStyle = '#c9ced6'; g.fillRect(16, -11, 26, 22); g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(16, -11, 26, 4);
    g.fillStyle = '#3a2a1a'; g.beginPath(); g.moveTo(42, -11); g.lineTo(74, -9); g.lineTo(80, 0); g.lineTo(74, 9); g.lineTo(42, 11); g.closePath(); g.fill();
    g.fillStyle = '#2f7ff0'; g.beginPath(); g.moveTo(62, -10); g.lineTo(74, -9); g.lineTo(80, 0); g.lineTo(74, 9); g.lineTo(62, 10); g.closePath(); g.fill();
  }
  else if (t === 'cartes') {                            // jeu de cartes étalé en éventail
    const S = ['♥', '♠', '♦', '♣'], V = ['A', 'R', 'D', 'V'];
    for (let k = 0; k < 4; k++) {
      g.save(); g.rotate(-0.45 + k * 0.3); g.translate(0, -40);
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); rr(g, -32, -44, 70, 100, 8); g.fill();
      g.fillStyle = '#fbfbf6'; g.beginPath(); rr(g, -36, -50, 70, 100, 8); g.fill(); g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 1.5; g.stroke();
      g.fillStyle = k % 2 ? '#1a1a1a' : '#d8261d'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = 'bold 34px serif'; g.fillText(S[k], -1, 2); g.font = 'bold 15px serif'; g.fillText(V[k], -24, -36);
      g.restore();
    }
  }
  else if (t === 'billets') {                           // billets du jeu, en liasse
    const cols = ['#f6b6c8', '#fff2a0', '#b8e6ff', '#c8f0b0'], val = ['10', '50', '100', '500'];
    for (let k = 0; k < 4; k++) {
      g.save(); g.rotate(-0.25 + k * 0.16); g.translate(k * 6 - 9, k * 4 - 6);
      g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(-72, -32, 150, 70); g.fillStyle = cols[k]; g.fillRect(-75, -35, 150, 70);
      g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 1.5; g.strokeRect(-68, -28, 136, 56);
      g.fillStyle = 'rgba(0,0,0,0.55)'; g.font = 'bold 26px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(val[k], 0, 1);
      g.restore();
    }
  }
  else if (t === 'gobelet') {                           // gobelet à dés en cuir, vu de dessus
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.arc(6, 8, 62, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#6a3a1c'; g.beginPath(); g.arc(0, 0, 62, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#c8a24a'; g.lineWidth = 5; g.beginPath(); g.arc(0, 0, 56, 0, Math.PI * 2); g.stroke();
    const gr = g.createRadialGradient(-8, -8, 4, 0, 0, 48); gr.addColorStop(0, '#2a140a'); gr.addColorStop(1, '#4a2410'); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 48, 0, Math.PI * 2); g.fill();
    g.setLineDash([4, 6]); g.strokeStyle = 'rgba(255,220,160,0.4)'; g.lineWidth = 2; g.beginPath(); g.arc(0, 0, 60, 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
  }
  else if (t === 'maison') {                            // maison du tapis de jeu : toit rouge à deux pans, cheminée
    g.rotate(x < 1300 ? 0.12 : -0.12);
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(-62, -46, 136, 104);
    g.fillStyle = '#d8261d'; g.fillRect(-68, -54, 136, 54); g.fillStyle = '#b31d16'; g.fillRect(-68, 0, 136, 54);
    g.strokeStyle = 'rgba(80,10,10,0.45)'; g.lineWidth = 2; g.beginPath(); for (let k = -54; k <= 54; k += 13) { g.moveTo(-68, k); g.lineTo(68, k); } g.stroke();
    g.strokeStyle = '#ffe7c2'; g.lineWidth = 5; g.beginPath(); g.moveTo(-68, 0); g.lineTo(68, 0); g.stroke();
    g.fillStyle = '#8a8f98'; g.fillRect(28, -40, 20, 22); g.fillStyle = '#3a3a40'; g.fillRect(31, -37, 14, 16);
  }
  else if (t === 'arbre') {                             // arbre en plastique : boules de feuillage
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.arc(10, 14, 62, 0, Math.PI * 2); g.fill();
    for (const q of [[0, 0, 50], [-34, -18, 34], [32, -22, 32], [26, 28, 34], [-30, 26, 30]]) {
      const gr = g.createRadialGradient(q[0] - q[2] * 0.35, q[1] - q[2] * 0.4, 3, q[0], q[1], q[2]); gr.addColorStop(0, '#8fe07a'); gr.addColorStop(1, '#2e8a3a');
      g.fillStyle = gr; g.beginPath(); g.arc(q[0], q[1], q[2], 0, Math.PI * 2); g.fill();
    }
  }
  g.restore();
}

// utilitaires passés aux dessins des circuits (les fonctions génériques permettent de réutiliser un type existant)
const U = { rr, oval, blob, rng, mix, rgbStr, hexRgb, shadow, bille, trackPath, centerStroke, objet, decor, mur, zone, own };
