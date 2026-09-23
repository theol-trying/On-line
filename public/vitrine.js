// VITRINE DU LOBBY — les 6 jeux présentés en cartes animées (remplace les onglets texte de #gamemenu).
//
// Chaque carte reste un <button class="gtab" data-id="…"> : le clic, l'état .on, le grisage non-game-master
// (body.not-gm #gamemenu .gtab:not(.on)) et les polices par jeu (#gamemenu .gtab[data-id=…]) continuent de
// s'appliquer tels quels. En plus : une mini-scène au canvas dans l'identité du jeu, une accroche et le
// nombre de joueurs.
//
// Coût : UNE seule boucle requestAnimationFrame pour les 6 canvas, bridée à ~30 i/s, ARRÊTÉE (pas de rAF
// en attente) quand body.playing, document.hidden, ou quand la vitrine n'a pas de carte. « Réduire les
// effets » (body.flat) ou prefers-reduced-motion → une image fixe, redessinée seulement si la taille change.
// Le décor statique de chaque scène (dégradés, damier, pelouse, dohyō…) est pré-rendu UNE fois par taille
// dans un canvas de fond : par image, on ne fait qu'un drawImage + quelques formes pleines, sans dégradé
// créé, sans shadowBlur, sans allocation.
//
// Compat Safari iOS 12-13 : ni ?. ni ??, ni roundRect / ctx.filter / letterSpacing / OffscreenCanvas.
//
// API :  const v = creerVitrine(conteneur, { choisir: id => …, sous: id => 'accroche' | undefined });
//        v.rendre(jeux, actifId)   // jeux = meta serveur [{ id, name, desc, min, max }] ; rappelable à volonté :
//                                  // les cartes ne sont reconstruites que si la liste des jeux change.

const TAU = Math.PI * 2;
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fr = x => x - Math.floor(x);
const tri = x => { const f = fr(x); return f < 0.5 ? f * 2 : 2 - f * 2; };      // 0 → 1 → 0, période 1
const clamp01 = x => x < 0 ? 0 : x > 1 ? 1 : x;
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
function rrect(c, x, y, w, h, r) {                                              // rectangle arrondi (pas de roundRect sur iOS 12)
  r = Math.min(r, w / 2, h / 2);
  c.beginPath(); c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}
function disque(c, x, y, r) { c.beginPath(); c.arc(x, y, r > 0 ? r : 0.01, 0, TAU); c.fill(); }
function ombre(c, x, y, rx, ry) { c.save(); c.translate(x, y); c.scale(1, ry / rx); c.beginPath(); c.arc(0, 0, rx, 0, TAU); c.restore(); c.fill(); }

/* ---------- chemins rectilignes (motos de Tron) ---------- */
function chemin(pts) {                                                         // pts en pixels, boucle fermée
  const cum = [0]; let L = 0;
  for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; L += Math.abs(b[0] - a[0]) + Math.abs(b[1] - a[1]); cum.push(L); }
  return { pts, cum, L };
}
const PT = { x: 0, y: 0, dx: 1, dy: 0 };                                        // réutilisé : aucune allocation par image
function pointA(ch, s) {
  s = ((s % ch.L) + ch.L) % ch.L;
  let i = 0; while (i < ch.pts.length - 1 && ch.cum[i + 1] <= s) i++;
  const a = ch.pts[i], b = ch.pts[(i + 1) % ch.pts.length], seg = ch.cum[i + 1] - ch.cum[i] || 1, k = (s - ch.cum[i]) / seg;
  PT.x = a[0] + (b[0] - a[0]) * k; PT.y = a[1] + (b[1] - a[1]) * k;
  PT.dx = Math.sign(b[0] - a[0]); PT.dy = Math.sign(b[1] - a[1]);
  return PT;
}
function traceChemin(c, ch, s0, s1) {                                          // polyligne du tronçon [s0, s1] (s0 < s1, sans modulo)
  let p = pointA(ch, s0); c.moveTo(p.x, p.y);
  const tour = Math.floor(s0 / ch.L);
  for (let n = tour; n <= tour + 1; n++) {
    for (let i = 1; i < ch.pts.length + 1; i++) {
      const d = n * ch.L + ch.cum[i];
      if (d <= s0) continue;
      if (d >= s1) { p = pointA(ch, s1); c.lineTo(p.x, p.y); return; }
      const v = ch.pts[i % ch.pts.length]; c.lineTo(v[0], v[1]);
    }
  }
  p = pointA(ch, s1); c.lineTo(p.x, p.y);
}

/* ============================================================================
   LES SCÈNES — fond(c, w, h, st) : décor pré-rendu une fois par taille ;
   image(c, w, h, t, st) : ce qui bouge. u = unité d'échelle (1 à 64 px de haut).
   fixe : l'instant montré quand les effets sont réduits.
   ============================================================================ */
const SCENES = {
  pong: {
    fixe: 0.55,
    fond(c, w, h) {
      const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#22083f'); g.addColorStop(1, '#07031a');
      c.fillStyle = g; c.fillRect(0, 0, w, h);
      const hy = h * 0.66, sr = h * 0.3;                                         // soleil synthwave rayé sur l'horizon
      c.save(); c.beginPath(); c.rect(0, 0, w, hy); c.clip();
      const gs = c.createLinearGradient(0, hy - sr, 0, hy); gs.addColorStop(0, '#ffd35c'); gs.addColorStop(1, '#ff4fa3');
      c.globalAlpha = 0.55; c.fillStyle = gs; disque(c, w / 2, hy, sr);
      c.globalAlpha = 1; c.fillStyle = '#12052a';
      for (let i = 1; i <= 3; i++) c.fillRect(w / 2 - sr, hy - sr * 0.14 * i * 1.4, sr * 2, Math.max(1, sr * 0.05 * i));
      c.restore();
      c.strokeStyle = 'rgba(255,93,180,.28)'; c.lineWidth = 1;                   // grille en perspective sous l'horizon
      c.beginPath(); c.moveTo(0, hy); c.lineTo(w, hy);
      for (let i = 1; i < 4; i++) { const y = hy + (h - hy) * (i * i) / 9; c.moveTo(0, y); c.lineTo(w, y); }
      for (let i = -6; i <= 6; i++) { c.moveTo(w / 2 + i * w * 0.03, hy); c.lineTo(w / 2 + i * w * 0.2, h); }
      c.stroke();
      c.strokeStyle = 'rgba(91,228,255,.22)'; c.setLineDash([3, 4]);              // filet central
      c.beginPath(); c.moveTo(w / 2, 4); c.lineTo(w / 2, h - 4); c.stroke(); c.setLineDash([]);
    },
    image(c, w, h, t) {
      const u = h / 64, pw = Math.max(3, 3.2 * u), ph = h * 0.34, xl = w * 0.07, xr = w * 0.93 - pw;
      const br = Math.max(2, 2.6 * u), top = 6 * u + br, bot = h - 6 * u - br;
      const bx = tp => xl + pw + br + (xr - xl - pw - 2 * br) * tri(tp / 3.0);
      const by = tp => top + (bot - top) * tri(tp / 1.9 + 0.2);
      const x = bx(t), y = by(t), mid = h / 2;
      const yl = mid + (y - mid) * 0.86, yr = mid + (by(t - 0.05) - mid) * 0.86;
      c.fillStyle = 'rgba(255,93,180,.25)'; c.fillRect(xl - 2 * u, yl - ph / 2 - 2 * u, pw + 4 * u, ph + 4 * u);   // halos (sans shadowBlur)
      c.fillStyle = 'rgba(91,228,255,.25)'; c.fillRect(xr - 2 * u, yr - ph / 2 - 2 * u, pw + 4 * u, ph + 4 * u);
      c.fillStyle = '#ff5db4'; c.fillRect(xl, yl - ph / 2, pw, ph);
      c.fillStyle = '#5be4ff'; c.fillRect(xr, yr - ph / 2, pw, ph);
      c.fillStyle = '#ff8ecb';
      for (let k = 5; k >= 1; k--) { c.globalAlpha = 0.09 * (6 - k); disque(c, bx(t - k * 0.035), by(t - k * 0.035), br * (1 - k * 0.1)); }
      const f = fr(t / 3.0), choc = Math.min(Math.abs(f - 0.5), f, 1 - f);       // anneau au rebond sur une raquette
      if (choc < 0.06) { c.globalAlpha = 1 - choc / 0.06; c.strokeStyle = f > 0.25 && f < 0.75 ? '#5be4ff' : '#ff5db4'; c.lineWidth = 1.5; c.beginPath(); c.arc(x, y, br + choc * 150 * u, 0, TAU); c.stroke(); }
      c.globalAlpha = 0.28; c.fillStyle = '#ffffff'; disque(c, x, y, br * 2.3);
      c.globalAlpha = 1; disque(c, x, y, br);
    },
  },

  tron: {
    fixe: 1.3,
    fond(c, w, h, st) {
      c.fillStyle = '#02070d'; c.fillRect(0, 0, w, h);
      const pas = Math.max(8, h / 6);
      c.strokeStyle = 'rgba(31,224,255,.13)'; c.lineWidth = 1; c.beginPath();
      for (let x = (w / 2) % pas; x < w; x += pas) { c.moveTo(Math.round(x) + 0.5, 0); c.lineTo(Math.round(x) + 0.5, h); }
      for (let y = (h / 2) % pas; y < h; y += pas) { c.moveTo(0, Math.round(y) + 0.5); c.lineTo(w, Math.round(y) + 0.5); }
      c.stroke();
      const v = c.createRadialGradient(w / 2, h / 2, h * 0.2, w / 2, h / 2, w * 0.62);
      v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.6)'); c.fillStyle = v; c.fillRect(0, 0, w, h);
      const P = (nx, ny) => [nx * w, ny * h];
      st.a = chemin([P(0.06, 0.3), P(0.46, 0.3), P(0.46, 0.72), P(0.22, 0.72), P(0.22, 0.52), P(0.06, 0.52)]);
      st.b = chemin([P(0.94, 0.7), P(0.54, 0.7), P(0.54, 0.28), P(0.78, 0.28), P(0.78, 0.48), P(0.94, 0.48)]);
    },
    image(c, w, h, t, st) {
      const u = h / 64, v = w * 0.42, L = w * 0.62;
      const moto = (ch, col, dec) => {
        const s1 = t * v + dec + ch.L * 4, s0 = s1 - Math.min(L, ch.L * 0.8);
        c.lineJoin = 'miter'; c.lineCap = 'butt';
        c.strokeStyle = col; c.globalAlpha = 0.22; c.lineWidth = 5 * u; c.beginPath(); traceChemin(c, ch, s0, s1); c.stroke();
        c.globalAlpha = 1; c.lineWidth = Math.max(1.5, 1.8 * u); c.beginPath(); traceChemin(c, ch, s0, s1); c.stroke();
        const p = pointA(ch, s1), lg = 4.5 * u, la = 2.4 * u;
        c.fillStyle = col; c.fillRect(p.x - (p.dx ? lg / 2 : la / 2), p.y - (p.dy ? lg / 2 : la / 2), p.dx ? lg : la, p.dy ? lg : la);
        c.fillStyle = '#eaffff'; disque(c, p.x + p.dx * lg / 2, p.y + p.dy * lg / 2, 1.2 * u);
      };
      moto(st.a, '#1fe0ff', 0);
      moto(st.b, '#ff9a2e', st.b.L * 0.35);
    },
  },

  tank: {
    fixe: 1.05,
    fond(c, w, h) {
      const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#e2c283'); g.addColorStop(1, '#c29a58');
      c.fillStyle = g; c.fillRect(0, 0, w, h);
      c.fillStyle = 'rgba(120,80,30,.12)';                                       // dunes
      for (let i = 0; i < 3; i++) { const y = h * (0.28 + i * 0.3); c.beginPath(); c.moveTo(0, y); c.quadraticCurveTo(w * 0.3, y - h * 0.14, w * 0.6, y); c.quadraticCurveTo(w * 0.8, y + h * 0.1, w, y - h * 0.04); c.lineTo(w, y + h * 0.06); c.lineTo(0, y + h * 0.08); c.fill(); }
      const r = rng(7); c.fillStyle = 'rgba(90,60,25,.28)';
      for (let i = 0; i < w * h / 90; i++) c.fillRect(r() * w, r() * h, 1, 1);
      c.strokeStyle = 'rgba(90,60,25,.2)'; c.lineWidth = 1;                      // traces de chenilles
      c.setLineDash([2, 3]); c.beginPath(); c.moveTo(0, h * 0.5); c.lineTo(w * 0.14, h * 0.5); c.moveTo(0, h * 0.74); c.lineTo(w * 0.14, h * 0.74); c.stroke(); c.setLineDash([]);
    },
    image(c, w, h, t) {
      const u = h / 64, C = 2.2, p = fr(t / C);
      const tx = w * 0.2, ty = h * 0.62, cx = w * 0.84, cs = 13 * u;
      const rec = Math.max(0, 1 - p / 0.12) * 2.5 * u, bob = Math.sin(t * 9) * 0.3 * u;
      const boom = p >= 0.42 && p < 0.8 ? (p - 0.42) / 0.38 : -1;
      const sec = boom >= 0 && boom < 0.4 ? Math.sin(boom * 60) * (0.4 - boom) * 3 * u : 0;
      c.fillStyle = 'rgba(60,35,10,.3)'; ombre(c, cx, ty + cs * 0.55, cs * 0.8, cs * 0.25); ombre(c, tx, ty + 9 * u, 15 * u, 3.5 * u);
      for (let k = 0; k < 2; k++) {                                              // deux caisses empilées
        const x = cx - cs / 2 + sec + (k ? 2 * u : 0), y = ty + cs * 0.5 - cs * (k + 1);
        c.fillStyle = k ? '#a8773a' : '#946430'; c.fillRect(x, y, cs, cs);
        c.strokeStyle = '#5e3c18'; c.lineWidth = Math.max(1, 1.2 * u); c.strokeRect(x + 0.5, y + 0.5, cs - 1, cs - 1);
        c.beginPath(); c.moveTo(x, y); c.lineTo(x + cs, y + cs); c.moveTo(x + cs, y); c.lineTo(x, y + cs); c.stroke();
      }
      c.save(); c.translate(tx - rec, ty + bob);                                  // le char (vu de profil-dessus)
      c.fillStyle = '#2f3320'; rrect(c, -15 * u, 3 * u, 30 * u, 7 * u, 3.5 * u); c.fill();
      c.fillStyle = '#50563a'; const dc = fr(t * 2) * 5 * u;
      for (let x = -13 * u + dc; x < 13 * u; x += 5 * u) disque(c, x, 6.5 * u, 1.6 * u);
      c.fillStyle = '#6d7a3a'; rrect(c, -13 * u, -4 * u, 26 * u, 8 * u, 2 * u); c.fill();
      c.fillStyle = '#8a9a4a'; c.fillRect(-11 * u, -4 * u, 22 * u, 2 * u);
      c.fillStyle = '#4c5628'; c.fillRect(3 * u, -3.4 * u, 16 * u + rec, 2.6 * u);   // canon
      c.fillStyle = '#5c6a30'; disque(c, 1 * u, -4 * u, 6 * u);
      c.fillStyle = '#7d8c44'; disque(c, 0, -5 * u, 3.2 * u);
      c.restore();
      const mx = tx + 19 * u, my = ty + bob - 2.1 * u;
      if (p < 0.07) { const k = 1 - p / 0.07; c.globalAlpha = k; c.fillStyle = '#ffd35c'; disque(c, mx + 2 * u, my, 5 * u * k + 2 * u); c.fillStyle = '#fff6d0'; disque(c, mx + 2 * u, my, 2.4 * u * k + 1); c.globalAlpha = 1; }
      if (p >= 0.04 && p < 0.42) {                                               // l'obus
        const k = (p - 0.04) / 0.38, sx = mx + (cx - cs / 2 - mx) * k;
        c.strokeStyle = 'rgba(245,235,210,.55)'; c.lineWidth = 1.5 * u; c.beginPath(); c.moveTo(Math.max(mx, sx - 16 * u), my); c.lineTo(sx, my); c.stroke();
        c.fillStyle = '#2a2414'; rrect(c, sx - 3 * u, my - 1.2 * u, 5 * u, 2.4 * u, 1.2 * u); c.fill();
        c.fillStyle = '#ffcf5a'; disque(c, sx + 2 * u, my, 1.1 * u);
      }
      if (boom >= 0) {                                                            // explosion : lueur, boule, éclats, fumée
        const ex = cx - cs / 2, ey = my, q = boom;
        c.globalAlpha = 0.28 * (1 - q); c.fillStyle = '#ffb347'; disque(c, ex, ey, 24 * u);
        c.globalAlpha = 1 - q; c.fillStyle = '#ff7a1a'; disque(c, ex, ey, (4 + 11 * Math.sqrt(q)) * u);
        c.fillStyle = '#ffd35c'; disque(c, ex, ey, (3 + 7 * Math.sqrt(q)) * u * (1 - q * 0.6));
        c.fillStyle = '#fff4d0'; disque(c, ex, ey, 3 * u * (1 - q));
        c.fillStyle = '#5e3c18';
        for (let i = 0; i < 7; i++) { const a = -2.4 + i * 0.8, d = q * 17 * u; c.fillRect(ex + Math.cos(a) * d - u, ey + Math.sin(a) * d + q * q * 8 * u - u, 2 * u, 2 * u); }
        c.globalAlpha = 0.45 * (1 - q); c.fillStyle = '#7a6a58'; disque(c, ex - 3 * u, ey - q * 14 * u, (3 + q * 6) * u); disque(c, ex + 4 * u, ey - q * 10 * u, (2 + q * 5) * u);
        c.globalAlpha = 1;
      }
    },
  },

  bomb: {
    fixe: 1.72,
    fond(c, w, h, st) {
      const n = 5, s = h / n, cols = Math.ceil(w / s) + 1, c0 = Math.floor(w / s / 2), ox = w / 2 - (c0 + 0.5) * s;
      st.s = s; st.ox = ox; st.c0 = c0;
      for (let j = 0; j < n; j++) for (let i = 0; i < cols; i++) { c.fillStyle = (i + j) & 1 ? '#f7c1e0' : '#ffd9ec'; c.fillRect(ox + i * s, j * s, s + 0.5, s + 0.5); }
      for (let j = 1; j < n; j += 2) for (let i = 0; i < cols; i++) {             // piliers bonbon (hors de la croix d'explosion)
        if (((i - c0) & 1) === 0) continue;
        const x = ox + i * s + s * 0.08, y = j * s + s * 0.08, e = s * 0.84;
        c.fillStyle = '#8e4fb5'; rrect(c, x, y + s * 0.06, e, e, s * 0.22); c.fill();
        c.fillStyle = '#b06ad0'; rrect(c, x, y, e, e * 0.9, s * 0.22); c.fill();
        c.fillStyle = 'rgba(255,255,255,.35)'; rrect(c, x + e * 0.18, y + e * 0.12, e * 0.4, e * 0.18, e * 0.09); c.fill();
      }
    },
    image(c, w, h, t, st) {
      const s = st.s, u = h / 64, C = 2.4, p = fr(t / C), bx = w / 2, by = h / 2;
      if (p < 0.62 || p >= 0.9) {                                                // la bombe, mèche qui crépite
        const pop = p >= 0.9 ? clamp01((p - 0.9) / 0.06) : 1;
        const pul = 1 + (p < 0.62 ? 0.05 + 0.07 * p : 0) * Math.sin(t * (14 + 30 * p));
        const r = s * 0.36 * pop * pul;
        c.fillStyle = 'rgba(80,20,60,.25)'; ombre(c, bx, by + s * 0.34, s * 0.34 * pop, s * 0.1 * pop);
        c.fillStyle = '#2a1840'; disque(c, bx, by, r);
        c.fillStyle = '#4a3368'; disque(c, bx - r * 0.3, by - r * 0.32, r * 0.32);
        c.fillStyle = '#ffffff'; disque(c, bx - r * 0.38, by - r * 0.4, r * 0.12);
        c.strokeStyle = '#a0784a'; c.lineWidth = Math.max(1, 1.4 * u); c.beginPath(); c.moveTo(bx + r * 0.5, by - r * 0.8); c.quadraticCurveTo(bx + r * 0.9, by - r * 1.5, bx + r * 1.2, by - r * 1.25); c.stroke();
        if (p < 0.62) { const fl = 0.6 + 0.4 * Math.sin(t * 47); c.fillStyle = '#ff9a2e'; disque(c, bx + r * 1.2, by - r * 1.25, 2.6 * u * fl); c.fillStyle = '#fff2a0'; disque(c, bx + r * 1.2, by - r * 1.25, 1.2 * u * fl); }
      } else {                                                                     // la croix de flammes
        const q = (p - 0.62) / 0.28, ext = Math.min(1, q * 4) * 2.4 * s, a = q > 0.65 ? 1 - (q - 0.65) / 0.35 : 1;
        c.globalAlpha = a;
        c.fillStyle = 'rgba(255,190,90,.35)'; disque(c, bx, by, s * 1.4);
        const bras = (e, col) => { c.fillStyle = col; rrect(c, bx - ext, by - e / 2, ext * 2, e, e / 2); c.fill(); rrect(c, bx - e / 2, by - ext, e, ext * 2, e / 2); c.fill(); };
        bras(s * 0.8, '#ff6a2a'); bras(s * 0.5, '#ffb13c'); bras(s * 0.22, '#fff2b0');
        c.globalAlpha = 1;
      }
    },
  },

  snake: {
    fixe: 1.45,
    fond(c, w, h) {
      const s = Math.max(10, h / 4);
      for (let i = 0; i * s < w; i++) { c.fillStyle = i & 1 ? '#4fa84e' : '#5cb85a'; c.fillRect(i * s, 0, s + 0.5, h); }
      const r = rng(3);
      c.strokeStyle = 'rgba(30,90,30,.45)'; c.lineWidth = 1; c.beginPath();         // touffes d'herbe
      for (let i = 0; i < w / 9; i++) { const x = r() * w, y = r() * h; c.moveTo(x, y); c.lineTo(x - 1.5, y - 3); c.moveTo(x, y); c.lineTo(x + 1.5, y - 3.5); }
      c.stroke();
      for (let i = 0; i < 5; i++) { const x = r() * w, y = r() * h; c.fillStyle = i & 1 ? '#fff6a8' : '#ffffff'; disque(c, x, y, 1.3); }
    },
    image(c, w, h, t) {
      const u = h / 64, C = 3.2, q = fr(t / C), ax = w * 0.74, amp = h * 0.2, mid = h / 2;
      const cy = x => mid + Math.sin(x / w * TAU * 1.1) * amp;
      const L0 = w * 0.42, hx = -0.08 * w + q * (1.12 * w + L0 * 1.3), mange = hx > ax;
      const L = L0 * (mange ? 1.3 : 1), N = 14, pas = L / N;
      const ay = cy(ax);
      if (!mange) {                                                               // la pomme (réapparaît en « pop »)
        const k = clamp01(q / 0.08), r = 4.2 * u * (k < 1 ? k * 1.15 : 1);
        c.fillStyle = 'rgba(20,60,20,.3)'; ombre(c, ax, ay + r * 0.9, r, r * 0.35);
        c.fillStyle = '#e8413a'; disque(c, ax, ay, r);
        c.fillStyle = 'rgba(255,255,255,.55)'; disque(c, ax - r * 0.35, ay - r * 0.35, r * 0.28);
        c.strokeStyle = '#6b3d1a'; c.lineWidth = Math.max(1, u); c.beginPath(); c.moveTo(ax, ay - r * 0.8); c.lineTo(ax + r * 0.2, ay - r * 1.35); c.stroke();
        c.fillStyle = '#6fd05a'; c.beginPath(); c.ellipse(ax + r * 0.55, ay - r * 1.2, r * 0.42, r * 0.2, -0.5, 0, TAU); c.fill();
      } else if (hx < ax + 14 * u) {                                              // « miam » : éclats autour du point mangé
        const k = (hx - ax) / (14 * u); c.globalAlpha = 1 - k; c.fillStyle = '#fff6a8';
        for (let i = 0; i < 6; i++) { const a = i * TAU / 6; disque(c, ax + Math.cos(a) * (4 + 8 * k) * u, ay + Math.sin(a) * (4 + 8 * k) * u, 1.2 * u); }
        c.globalAlpha = 1;
      }
      for (let i = N; i >= 0; i--) {                                              // du bout de la queue vers la tête
        const x = hx - i * pas; if (x < -8 * u || x > w + 8 * u) continue;
        const r = (4.4 - 2.4 * i / N) * u;
        c.fillStyle = i === 0 ? '#3da34d' : (i & 1 ? '#5fc36a' : '#3f9e4a'); disque(c, x, cy(x), r);
      }
      const hy = cy(hx), d = Math.atan2(cy(hx + 1) - hy, 1), ex = Math.cos(d), ey = Math.sin(d);
      if (fr(t * 1.7) < 0.35) { c.strokeStyle = '#e8413a'; c.lineWidth = Math.max(1, u); c.beginPath(); c.moveTo(hx + ex * 4 * u, hy + ey * 4 * u); c.lineTo(hx + ex * 8 * u, hy + ey * 8 * u); c.stroke(); }
      for (let k = -1; k <= 1; k += 2) {                                          // les yeux
        const px = hx + ex * 1.5 * u - ey * k * 2 * u, py = hy + ey * 1.5 * u + ex * k * 2 * u;
        c.fillStyle = '#ffffff'; disque(c, px, py, 1.5 * u); c.fillStyle = '#10200f'; disque(c, px + ex * 0.6 * u, py + ey * 0.6 * u, 0.8 * u);
      }
    },
  },

  sumo: {
    fixe: 0.8,
    fond(c, w, h, st) {
      c.fillStyle = '#1e140d'; c.fillRect(0, 0, w, h);
      c.fillStyle = 'rgba(0,0,0,.35)'; for (let x = 0; x < w; x += 24) c.fillRect(x, 0, 2, h);   // planches
      const cx = w / 2, cy = h / 2, R = Math.min(h * 0.46, w * 0.34);
      st.R = R;
      c.fillStyle = '#b98d5a'; rrect(c, cx - R * 1.35, cy - R * 1.12, R * 2.7, R * 2.24, R * 0.18); c.fill();   // tertre d'argile
      const g = c.createRadialGradient(cx, cy - R * 0.2, R * 0.1, cx, cy, R);
      g.addColorStop(0, '#e6c490'); g.addColorStop(1, '#cfa66e'); c.fillStyle = g; disque(c, cx, cy, R);
      c.strokeStyle = '#8a6a3a'; c.lineWidth = Math.max(2, R * 0.13); c.beginPath(); c.arc(cx, cy, R, 0, TAU); c.stroke();   // tawara (paille)
      c.strokeStyle = '#e6d49a'; c.lineWidth = Math.max(1, R * 0.07); c.beginPath(); c.arc(cx, cy, R, 0, TAU); c.stroke();
      c.fillStyle = '#fbf6ea'; c.fillRect(cx - R * 0.3, cy - R * 0.28, R * 0.08, R * 0.56); c.fillRect(cx + R * 0.22, cy - R * 0.28, R * 0.08, R * 0.56);   // shikiri-sen
      c.fillStyle = 'rgba(255,150,60,.16)'; disque(c, w * 0.08, h * 0.1, h * 0.4); disque(c, w * 0.92, h * 0.1, h * 0.4);   // lanternes
    },
    image(c, w, h, t, st) {
      const R = st.R, r = R * 0.3, cx = w / 2, cy = h / 2;
      const off = Math.sin(t * 1.5) * R * 0.3 + Math.sin(t * 7.3) * R * 0.025;
      const lutteur = (x, dir, obi) => {
        c.fillStyle = 'rgba(60,30,10,.28)'; ombre(c, x, cy + r * 0.25, r * 1.08, r * 0.9);
        c.fillStyle = '#f2c9a0'; disque(c, x + dir * r * 0.72, cy - r * 0.62, r * 0.33); disque(c, x + dir * r * 0.72, cy + r * 0.62, r * 0.33);   // mains en poussée
        c.fillStyle = '#eab98a'; disque(c, x, cy, r);
        c.strokeStyle = obi; c.lineWidth = r * 0.32; c.beginPath(); c.arc(x, cy, r * 0.8, 0, TAU); c.stroke();   // mawashi
        c.fillStyle = '#f2c9a0'; disque(c, x + dir * r * 0.18, cy, r * 0.5);
        c.fillStyle = '#1b1210'; disque(c, x + dir * r * 0.1, cy, r * 0.28);    // chignon (chonmage)
      };
      const dust = Math.abs(Math.cos(t * 1.5));
      c.fillStyle = '#e8d2a8';
      for (let i = 0; i < 3; i++) { c.globalAlpha = 0.35 * (1 - dust) * (1 - i * 0.25); disque(c, cx + off + (i - 1) * r * 0.6, cy + r * (1.1 + i * 0.12), r * (0.18 + i * 0.05)); }
      c.globalAlpha = 1;
      lutteur(cx + off - r * 0.98, 1, '#e0452f');
      lutteur(cx + off + r * 0.98, -1, '#3f7bd8');
    },
  },
};
const SCENE_VIDE = { fixe: 0, fond(c, w, h) { c.fillStyle = '#12142a'; c.fillRect(0, 0, w, h); }, image() {} };

/* ============================================================================
   LA VITRINE
   ============================================================================ */
export function creerVitrine(conteneur, opts) {
  opts = opts || {};
  const body = document.body;
  const rm = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  let cartes = [], cle = '', raf = 0, dernier = 0, fixeFait = false, relance = 0, essais = 0;

  conteneur.classList.add('vitrine');
  if (conteneur.parentNode && conteneur.parentNode.classList) conteneur.parentNode.classList.add('avitrine');

  const statique = () => body.classList.contains('flat') || !!(rm && rm.matches);
  const visible = () => cartes.length > 0 && !body.classList.contains('playing') && !document.hidden;

  function mesurer(k) {                                                          // canvas net : taille CSS × devicePixelRatio (plafonné à 2)
    const cw = k.cv.clientWidth, ch = k.cv.clientHeight;
    if (!cw || !ch) return false;                                                // masqué (en partie) : on réessaiera
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (cw === k.w && ch === k.h && dpr === k.dpr) return true;
    k.w = cw; k.h = ch; k.dpr = dpr;
    k.cv.width = Math.round(cw * dpr); k.cv.height = Math.round(ch * dpr);
    k.bg = document.createElement('canvas'); k.bg.width = k.cv.width; k.bg.height = k.cv.height;
    const b = k.bg.getContext('2d');
    k.st = {}; k.ok = !!b;
    if (b) { b.setTransform(dpr, 0, 0, dpr, 0, 0); k.sc.fond(b, cw, ch, k.st); }
    return true;
  }
  function dessiner(t) {
    for (let i = 0; i < cartes.length; i++) {
      const k = cartes[i];
      if (k.sale && mesurer(k)) k.sale = false;
      if (k.sale || !k.ctx || !k.ok) continue;
      const c = k.ctx;
      c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1;
      c.drawImage(k.bg, 0, 0);
      c.setTransform(k.dpr, 0, 0, k.dpr, 0, 0);
      c.save(); k.sc.image(c, k.w, k.h, t === null ? k.sc.fixe : t + i * 0.37, k.st); c.restore();
    }
  }
  function image(now) {
    raf = 0;
    if (!visible() || statique()) { etat(); return; }
    if (now - dernier >= 31) { dernier = now; dessiner(now / 1000); }            // ~30 i/s
    raf = requestAnimationFrame(image);
  }
  function etat() {                                                              // (re)démarre ou arrête la boucle selon le contexte
    if (!visible()) return;                                                      // aucune rAF en attente : coût nul en partie
    if (statique()) {
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
      if (!fixeFait) {
        dessiner(null); fixeFait = !cartes.some(k => k.sale);
        if (!fixeFait && !relance && essais < 10) { essais++; relance = setTimeout(() => { relance = 0; etat(); }, 300); }   // carte pas encore mise en page
      }
      return;
    }
    fixeFait = false;
    if (!raf) raf = requestAnimationFrame(image);
  }
  function salir() { for (let i = 0; i < cartes.length; i++) cartes[i].sale = true; fixeFait = false; essais = 0; etat(); }

  if (window.MutationObserver) new MutationObserver(etat).observe(body, { attributes: true, attributeFilter: ['class'] });   // playing / flat
  document.addEventListener('visibilitychange', etat);
  window.addEventListener('resize', salir);
  if (rm && rm.addListener) rm.addListener(() => { fixeFait = false; etat(); });

  function rendre(jeux, actifId) {
    jeux = jeux || [];
    const nouvelle = jeux.map(g => g.id).join(',');
    if (nouvelle !== cle) {                                                      // la liste a changé : on (re)construit les cartes
      cle = nouvelle;
      conteneur.innerHTML = jeux.map(g => {
        const sub = (opts.sous && opts.sous(g.id)) || g.desc || '';
        const nb = g.min && g.max ? (g.min === g.max ? String(g.min) : g.min + '–' + g.max) : '';
        const lab = g.name + (nb ? ', ' + nb + ' joueurs' : '') + (sub ? ' — ' + sub : '');
        return `<button class="gtab vcard" data-id="${esc(g.id)}" title="${esc(g.desc || sub)}" aria-label="${esc(lab)}" aria-pressed="false">` +
          `<canvas class="vscene" aria-hidden="true"></canvas>` +
          `<span class="vname">${esc(g.name)}</span>` +
          `<span class="vsub">${esc(sub)}</span>` +
          (nb ? `<span class="vnb" aria-hidden="true">👥 ${esc(nb)}</span>` : '') + `</button>`;
      }).join('');
      cartes = [];
      const bts = conteneur.querySelectorAll('.gtab');
      for (let i = 0; i < bts.length; i++) {
        const b = bts[i], cv = b.querySelector('canvas');
        b.onclick = () => { if (opts.choisir) opts.choisir(b.dataset.id); };
        cartes.push({ b, cv, ctx: cv && cv.getContext ? cv.getContext('2d') : null, sc: Object.prototype.hasOwnProperty.call(SCENES, b.dataset.id) ? SCENES[b.dataset.id] : SCENE_VIDE, sale: true, ok: false, w: 0, h: 0, dpr: 0, bg: null, st: {} });
      }
      fixeFait = false; essais = 0;
    }
    for (let i = 0; i < cartes.length; i++) {
      const on = cartes[i].b.dataset.id === actifId;
      cartes[i].b.classList.toggle('on', on);
      cartes[i].b.setAttribute('aria-pressed', on ? 'true' : 'false');
    }
    etat();
  }
  return { rendre };
}
