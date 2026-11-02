// MICRO MACHINES — géométrie PARTAGÉE serveur / client (module pur, zéro dépendance, iOS 15 sûr : ni ?. ni ??).
// Le serveur s'en sert pour la physique (surfaces, murs, chutes, portes de contrôle), le client pour dessiner exactement
// le même circuit : rien de la géométrie ne passe sur le réseau, seuls l'identifiant du circuit (`circuit`) et le sens.
//
// Un circuit = une table (ou une moquette) vue de dessus, une ligne médiane fermée (points de contrôle lissés en
// Catmull-Rom puis rééchantillonnés tous les STEP u) et une demi-largeur W. Autour : murs (capsules), obstacles ronds
// (dont des BUMPERS qui renvoient fort), trous (poches de billard), zones (lait / encre / huile qui glissent, sucre /
// gomme / craie / sciure qui freinent, flèches turbo), obstacles MOBILES (souris mécanique, bille, toupie) et décor.
//   • bord « chute » : sortir de la table = tomber (réapparition à la dernière porte) ; bord « mur » : on rebondit.
//   • portes de contrôle tous les ~GATE u : il faut les passer DANS L'ORDRE (pas de raccourci à travers la table).
//   • chaque circuit se court dans les deux sens (`inverse`) : le décor et les obstacles restent, la course s'inverse.
//
// API : CIRCUITS (définitions), circuitParId(id, inverse) → circuit construit (mis en cache), puis sur un circuit c :
//   c.n, c.sx/sy (Float32Array), c.tx/ty (tangente), c.nx/ny (normale, à DROITE du sens de course), c.cs (abscisse), c.L,
//   c.k (courbure signée), c.gates [{ i, x, y, tx, ty, h }], c.walls [[x1,y1,x2,y2,r,type]], c.rocks [[x,y,r,type]],
//   c.holes [[x,y,r]], c.zones [[x,y,rx,ry,kind,ang]], c.mobs [{ type, r, per, seg | cer | chemin }], c.deco [...],
//   grille de collision (c.near(x, y) → indices), c.boxes [[x,y]] (boîtes de bonus), c.croix (le tracé se croise : circuit en 8),
//   proche(c, x, y, i0, fen) → indice d'échantillon le plus proche (recherche locale ; fen < 0 = globale),
//   surTable(c, x, y), dansTrou(c, x, y), zoneA(c, x, y) → zone ou null, grilleDepart(c, n) → [{ x, y, a }],
//   mobile(m, t, out) → position / cap / vitesse (u par tick) d'un obstacle mobile au temps de course t (s), est BUMPERS[type].

import LISTE_CIRCUITS from './circuits/index.js';

export const TICK_HZ = 30;
export const CAR_L = 34, CAR_W = 18, CAR_R = 12;        // voiture-jouet (u) ; disque d'encombrement (murs : 2 disques côté serveur)
export const STEP = 10;                                 // pas d'échantillonnage de la ligne médiane (u)
export const GATE = 150;                                // espacement visé des portes de contrôle (u)
export const VIEW = 580;                                // côté de la vue d'un joueur (u) : identique pour tous les écrans (équité)
export const FALL_T = 30, GHOST_T = 36;                 // chute (ticks) puis fantôme (ticks) à la réapparition
export const LAPS = [1, 3, 5];
export const FORMULES = ['course', 'elim'];
export const ELIM_HW0 = 520, ELIM_HW1 = 340;            // Élimination : demi-côté de la fenêtre commune (début → fin)
export const BUMPERS = { bumper: 1, punaise: 1, pion: 1, tampon: 1 };   // obstacles qui RENVOIENT (flipper) au lieu d'arrêter
export const ZONE_GLISSE = { lait: 1, encre: 1, huile: 1 }, ZONE_FREIN = { sucre: 1, gomme: 1, craie: 1, sciure: 1 };

const TAU = Math.PI * 2;
const wrapA = a => Math.atan2(Math.sin(a), Math.cos(a));

/* ---------- définitions des circuits (un fichier par circuit : ./circuits/<id>.js, liste dans ./circuits/index.js) ----------
   id, nom, emoji, sous (sous-titre), v (version du tracé : les records de tour sont rangés par id@v), w, h (monde, u),
   surf (sol / nappe : choisit le dessin générique), edge ('chute' : on tombe de la table | 'mur' : bandes), table { x0, y0,
   x1, y1, r }, W (demi-largeur de piste, u), croix (le tracé se croise volontairement).
   pts : ligne médiane (sens de course), le départ est sur le premier point (ligne droite avant ET après : sens inverse).
   make(H) : ajoute murs, obstacles, zones et décor à partir des échantillons (H.at(f) = point à la fraction f du tour).
   mobs : obstacles mobiles — seg [[x1,y1],[x2,y2]] (aller-retour adouci), cer [cx, cy, R] (tour complet) ou chemin
          [[x,y]…] (boucle fermée lissée, vitesse constante) ; r = rayon de collision ; per = période (s) ;
          dec = décalage de phase en fraction de période (plusieurs mobiles sur le même trajet : wagons, file de billes).
   boxes : fractions du tour où poser une rangée de boîtes de bonus (3 en travers de la piste).
   bumpers : ['type'…] obstacles ronds de CE circuit qui renvoient (comme les plots de flipper).
   zonesPhysiques : { kind: 'glisse' | 'frein' } pour les zones propres au circuit (sinon : lait/encre/huile glissent,
          sucre/gomme/craie/sciure freinent, 'boost' accélère).
   dessin : dessins propres au circuit (sol, plateau, piste, décor, obstacles, mobiles…) — voir ../rendu.js. Ni le
          serveur ni la physique ne les lisent. */
export const CIRCUITS = LISTE_CIRCUITS;
for (const d of CIRCUITS) {                         // obstacles qui renvoient et zones déclarés par chaque circuit
  for (const t of d.bumpers || []) BUMPERS[t] = 1;
  const zp = d.zonesPhysiques || {};
  for (const k in zp) { if (zp[k] === 'glisse') ZONE_GLISSE[k] = 1; else if (zp[k] === 'frein') ZONE_FREIN[k] = 1; }
}
// clé des records de tour d'un circuit : le tracé change avec la version (un record de l'ancien tracé ne vaut plus)
export function cleRecord(id) {
  for (let i = 0; i < CIRCUITS.length; i++) if (CIRCUITS[i].id === id) return CIRCUITS[i].v > 1 ? id + '@' + CIRCUITS[i].v : id;
  return id;
}

/* ---------- construction ---------- */
function catmull(pts, perSeg) {
  const out = [], n = pts.length;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    for (let k = 0; k < perSeg; k++) {
      const t = k / perSeg, t2 = t * t, t3 = t2 * t;
      out.push([
        0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
      ]);
    }
  }
  return out;
}
function resample(poly, step) {                         // polyligne fermée → points équidistants (abscisse curviligne)
  const n = poly.length, cum = [0];
  for (let i = 0; i < n; i++) { const a = poly[i], b = poly[(i + 1) % n]; cum.push(cum[i] + Math.hypot(b[0] - a[0], b[1] - a[1])); }
  const L = cum[n], m = Math.max(16, Math.round(L / step)), out = [];
  let j = 0;
  for (let k = 0; k < m; k++) {
    const s = k * L / m;
    while (j < n - 1 && cum[j + 1] <= s) j++;
    const a = poly[j], b = poly[(j + 1) % n], seg = cum[j + 1] - cum[j] || 1, u = (s - cum[j]) / seg;
    out.push([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]);
  }
  return { pts: out, L };
}
function geometrie(c, P) {                              // tangentes, normales, abscisse, courbure d'une suite d'échantillons
  const n = P.length;
  c.sx = new Float32Array(n); c.sy = new Float32Array(n); c.tx = new Float32Array(n); c.ty = new Float32Array(n);
  c.nx = new Float32Array(n); c.ny = new Float32Array(n); c.cs = new Float32Array(n); c.k = new Float32Array(n);
  for (let i = 0; i < n; i++) { c.sx[i] = P[i][0]; c.sy[i] = P[i][1]; c.cs[i] = i * c.step; }
  for (let i = 0; i < n; i++) {
    const a = P[(i - 1 + n) % n], b = P[(i + 1) % n], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
    c.tx[i] = dx / l; c.ty[i] = dy / l; c.nx[i] = -c.ty[i]; c.ny[i] = c.tx[i];   // repère écran (y vers le bas) : (-ty, tx) = à DROITE du sens de course
  }
  for (let i = 0; i < n; i++) {                                     // courbure signée, lissée sur ±3 échantillons
    let s = 0;
    for (let d = -3; d <= 3; d++) {
      const a = (i + d - 1 + n) % n, b = (i + d + 1 + n) % n;
      s += wrapA(Math.atan2(c.ty[b], c.tx[b]) - Math.atan2(c.ty[a], c.tx[a])) / (2 * c.step);
    }
    c.k[i] = s / 7;
  }
}
// un autre tronçon de piste passe-t-il à moins de `d` u de l'échantillon i ? (tronçons à plus de 6 W d'abscisse)
function autreTroncon(c, i, d) {
  const n = c.n;
  for (let j = 0; j < n; j += 2) {
    let ds = Math.abs(j - i); ds = Math.min(ds, n - ds) * c.step;
    if (ds < c.W * 6) continue;
    if (Math.hypot(c.sx[j] - c.sx[i], c.sy[j] - c.sy[i]) < d) return true;
  }
  return false;
}

function construire(def, inverse) {
  const c = Object.assign({}, def);
  const sm = resample(catmull(def.pts, 24), STEP), n = sm.pts.length;
  c.n = n; c.L = sm.L; c.step = sm.L / n; c.inverse = !!inverse;
  geometrie(c, sm.pts);
  c.walls = []; c.rocks = []; c.holes = []; c.zones = []; c.deco = []; c.boxes = [];
  const H = {
    c,
    at(f, lat) { const i = ((Math.round(f * n) % n) + n) % n, o = (lat || 0) * c.W; return { i, x: c.sx[i] + c.nx[i] * o, y: c.sy[i] + c.ny[i] * o }; },
    wall(x1, y1, x2, y2, r, type) { c.walls.push([x1, y1, x2, y2, r, type || 'mur']); },
    rock(x, y, r, type) { c.rocks.push([x, y, r, type || 'rocher']); },
    rockAt(f, lat, r, type) { const p = H.at(f, lat); c.rocks.push([p.x, p.y, r, type]); },
    hole(x, y, r) { c.holes.push([x, y, r]); },
    zoneAt(f, lat, rx, ry, kind) { const p = H.at(f, lat); c.zones.push([p.x, p.y, rx, ry, kind, Math.atan2(c.ty[p.i], c.tx[p.i])]); },
    boostAt(f, lat) { const p = H.at(f, lat || 0); c.zones.push([p.x, p.y, 44, 30, 'boost', Math.atan2(c.ty[p.i], c.tx[p.i])]); },
    // lignes droites du tracé : [{ f0, f1, len }] (fractions du tour), courbure |k| < kmax sur au moins minLen u
    droites(minLen, kmax) {
      const km = kmax || 1 / 2500, out = []; let i0 = -1;
      const debut = (() => { for (let i = 0; i < n; i++) if (Math.abs(c.k[i]) >= km) return i; return 0; })();
      for (let s = 0; s <= n; s++) {
        const i = (debut + s) % n, droit = s < n && Math.abs(c.k[i]) < km;
        if (droit && i0 < 0) i0 = s;
        if (!droit && i0 >= 0) { const len = (s - i0) * c.step; if (len >= (minLen || 400)) out.push({ f0: ((debut + i0) % n) / n, f1: ((debut + s - 1) % n) / n, len }); i0 = -1; }
      }
      return out;
    },
    // rails (capsules continues) le long d'une PORTION de piste, courbes comprises : de f0 à f1 (sens de course), côté side
    // (+1 droite, -1 gauche), à off u de la ligne médiane (défaut W + 10), rayon r (défaut 7), interrompus aux croisements
    railsDe(f0, f1, side, type, off, r) {
      const o = off || c.W + 10, k = 3, a = Math.round(f0 * n), b = Math.round(f1 * n) + (f1 < f0 ? n : 0);
      for (let s = a; s < b; s += k) {
        const i = (s % n + n) % n, j = ((Math.min(s + k, b)) % n + n) % n;
        if (autreTroncon(c, i, c.W * 2 + 40) || autreTroncon(c, j, c.W * 2 + 40)) continue;
        c.walls.push([c.sx[i] + c.nx[i] * o * side, c.sy[i] + c.ny[i] * o * side, c.sx[j] + c.nx[j] * o * side, c.sy[j] + c.ny[j] * o * side, r || 7, type || 'rail']);
      }
    },
    deco(x, y, type) { c.deco.push([x, y, type]); },
    // un mur DROIT longeant la piste de la fraction f0 à f1, côté side (+1 droite, -1 gauche) ; type crayon / règle
    rail(f0, f1, side, type) {
      const off = c.W + (type === 'regle' ? 24 : 16), r = type === 'regle' ? 15 : 9, a = H.at(f0, 0), b = H.at(f1, 0);
      let x1 = a.x + c.nx[a.i] * off * side, y1 = a.y + c.ny[a.i] * off * side, x2 = b.x + c.nx[b.i] * off * side, y2 = b.y + c.ny[b.i] * off * side;
      let mn = Infinity;                                            // la piste n'est jamais parfaitement droite : on écarte l'objet si besoin
      for (let k = 0; k <= 24; k++) { const x = x1 + (x2 - x1) * k / 24, y = y1 + (y2 - y1) * k / 24; for (let i = a.i - 12; i <= b.i + 12; i++) { const j = (i % n + n) % n, d = Math.hypot(c.sx[j] - x, c.sy[j] - y); if (d < mn) mn = d; } }
      const manque = c.W + r + 8 - mn, mx = (c.nx[a.i] + c.nx[b.i]) / 2, my = (c.ny[a.i] + c.ny[b.i]) / 2;
      if (manque > 0) { x1 += mx * manque * side; y1 += my * manque * side; x2 += mx * manque * side; y2 += my * manque * side; }
      c.walls.push([x1, y1, x2, y2, r, type]);
    },
    rails(type) {                                                   // rails continus des deux côtés, interrompus aux croisements
      const off = c.W + 10, k = 3;
      for (let i = 0; i < n; i += k) {
        const j = (i + k) % n;
        if (autreTroncon(c, i, c.W * 2 + 40) || autreTroncon(c, j, c.W * 2 + 40)) continue;
        for (const side of [-1, 1]) c.walls.push([c.sx[i] + c.nx[i] * off * side, c.sy[i] + c.ny[i] * off * side, c.sx[j] + c.nx[j] * off * side, c.sy[j] + c.ny[j] * off * side, 7, type]);
      }
    },
  };
  if (def.make) def.make(H);
  for (const f of def.boxes || []) for (const lat of [-0.5, 0, 0.5]) { const p = H.at(f, lat); c.boxes.push([p.x, p.y]); }   // rangées de 3 boîtes
  c.mobs = (def.mobs || []).map(m => {
    const o = Object.assign({}, m, { dec: m.dec || 0, seg: m.seg || null, cer: m.cer || null, chemin: null });   // propriétés libres gardées (couleur, n° de wagon…) pour le dessin
    if (m.chemin && m.chemin.length >= 3) {             // boucle lissée, rééchantillonnée : vitesse constante sur tout le trajet
      const rs = resample(catmull(m.chemin, 12), 6), P = rs.pts, cum = [0];
      for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; cum.push(cum[i] + Math.hypot(b[0] - a[0], b[1] - a[1])); }
      o.chemin = { P: P, cum: cum, L: cum[P.length] };
    }
    return o;
  });
  // sens inverse : on parcourt les mêmes échantillons à rebours (le n° 0, la ligne, ne bouge pas) ; décor et obstacles restent
  if (inverse) {
    const P = [];
    for (let i = 0; i < n; i++) { const j = (n - i) % n; P.push([c.sx[j], c.sy[j]]); }
    geometrie(c, P);
    for (const z of c.zones) if (z[4] === 'boost') z[5] = wrapA(z[5] + Math.PI);   // les flèches turbo se retournent
  }
  // portes de contrôle : K portes équidistantes, la porte 0 = ligne de départ / d'arrivée (échantillon 0)
  const K = Math.max(8, Math.round(c.L / GATE));
  c.gates = [];
  for (let g = 0; g < K; g++) {
    const i = Math.round(g * n / K) % n;
    c.gates.push({ i, x: c.sx[i], y: c.sy[i], tx: c.tx[i], ty: c.ty[i], h: c.W * 2.4 });
  }
  // demi-longueur de chaque porte bornée par la distance à un AUTRE tronçon de piste (une porte ne doit pas en couper deux)
  for (const gt of c.gates) {
    let m = gt.h;
    for (let j = 0; j < n; j++) {
      let ds = Math.abs(j - gt.i); ds = Math.min(ds, n - ds) * c.step;
      if (ds < c.W * 4) continue;
      const d = Math.hypot(c.sx[j] - gt.x, c.sy[j] - gt.y) - c.W - 6;
      if (d < m) m = Math.max(c.W * 1.1, d);
    }
    gt.h = m;
  }
  // grille de collision (murs, obstacles, trous) : cellules de 120 u
  const CELL = 120, gw = Math.ceil(c.w / CELL) + 1, gh = Math.ceil(c.h / CELL) + 1, grid = new Array(gw * gh);
  const put = (x0, y0, x1, y1, id) => {
    const a = Math.max(0, Math.floor(x0 / CELL)), b = Math.min(gw - 1, Math.floor(x1 / CELL)), e = Math.max(0, Math.floor(y0 / CELL)), f = Math.min(gh - 1, Math.floor(y1 / CELL));
    for (let gy = e; gy <= f; gy++) for (let gx = a; gx <= b; gx++) { const k = gy * gw + gx; (grid[k] || (grid[k] = [])).push(id); }
  };
  const pad = CAR_L * 0.75 + 24;
  c.walls.forEach((w, i) => put(Math.min(w[0], w[2]) - w[4] - pad, Math.min(w[1], w[3]) - w[4] - pad, Math.max(w[0], w[2]) + w[4] + pad, Math.max(w[1], w[3]) + w[4] + pad, i));
  c.rocks.forEach((r, i) => put(r[0] - r[2] - pad, r[1] - r[2] - pad, r[0] + r[2] + pad, r[1] + r[2] + pad, 10000 + i));
  const EMPTY = [];
  c.near = (x, y) => { const gx = Math.floor(x / CELL), gy = Math.floor(y / CELL); if (gx < 0 || gy < 0 || gx >= gw || gy >= gh) return EMPTY; return grid[gy * gw + gx] || EMPTY; };
  // rayon de courbure le plus serré devant (bots : vitesse conseillée)
  c.rayon = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let km = 0; for (let d = -2; d <= 8; d++) { const v = Math.abs(c.k[(i + d + n) % n]); if (v > km) km = v; }
    c.rayon[i] = km > 1e-5 ? 1 / km : 1e5;                       // rayon (u) le plus serré juste devant ; le serveur en déduit la vitesse
  }
  // ligne idéale (bots) : décalage latéral vers la corde des virages à venir, lissé, borné à ±0,5 W
  c.ro = new Float32Array(n);
  const raw = new Float32Array(n);
  for (let i = 0; i < n; i++) { let s = 0; for (let d = 0; d < 14; d++) s += c.k[(i + d) % n]; raw[i] = Math.max(-1, Math.min(1, s * c.step * 1.2)); }   // > 0 : virage à droite à venir → corde à droite (+ normale)
  for (let i = 0; i < n; i++) { let s = 0; for (let d = -10; d <= 10; d++) s += raw[(i + d + n) % n]; c.ro[i] = Math.max(-0.5, Math.min(0.5, s / 21 * 0.55)) * c.W; }
  return c;
}

const CACHE = {};
export function circuitParId(id, inverse) {
  let d = null;
  for (let i = 0; i < CIRCUITS.length; i++) if (CIRCUITS[i].id === id) d = CIRCUITS[i];
  if (!d) d = CIRCUITS[0];
  const key = d.id + (inverse ? '|inv' : '');
  return CACHE[key] || (CACHE[key] = construire(d, !!inverse));
}

/* ---------- requêtes ---------- */
export function proche(c, x, y, i0, fen) {                        // échantillon de ligne médiane le plus proche
  let best = -1, bd = Infinity;
  if (fen > 0 && i0 >= 0) {
    for (let d = -fen; d <= fen; d++) { const i = ((i0 + d) % c.n + c.n) % c.n, dx = c.sx[i] - x, dy = c.sy[i] - y, q = dx * dx + dy * dy; if (q < bd) { bd = q; best = i; } }
    if (bd <= (c.W * 3) * (c.W * 3)) return best;
  }
  for (let i = 0; i < c.n; i += 2) { const dx = c.sx[i] - x, dy = c.sy[i] - y, q = dx * dx + dy * dy; if (q < bd) { bd = q; best = i; } }
  for (let d = -2; d <= 2; d++) { const i = ((best + d) % c.n + c.n) % c.n, dx = c.sx[i] - x, dy = c.sy[i] - y, q = dx * dx + dy * dy; if (q < bd) { bd = q; best = i; } }
  return best;
}
export function surTable(c, x, y) {                              // rectangle arrondi de la table
  const t = c.table, r = t.r;
  if (x < t.x0 || y < t.y0 || x > t.x1 || y > t.y1) return false;
  const cx = x < t.x0 + r ? t.x0 + r : x > t.x1 - r ? t.x1 - r : x, cy = y < t.y0 + r ? t.y0 + r : y > t.y1 - r ? t.y1 - r : y;
  return (x - cx) * (x - cx) + (y - cy) * (y - cy) <= r * r;
}
export function dansTrou(c, x, y) {
  for (let i = 0; i < c.holes.length; i++) { const h = c.holes[i]; if ((x - h[0]) * (x - h[0]) + (y - h[1]) * (y - h[1]) < (h[2] - 6) * (h[2] - 6)) return true; }
  return false;
}
export function zoneA(c, x, y) {                                  // zone (ellipse orientée) sous le point, ou null
  for (let i = 0; i < c.zones.length; i++) {
    const z = c.zones[i], dx = x - z[0], dy = y - z[1], ca = Math.cos(z[5]), sa = Math.sin(z[5]);
    const u = (dx * ca + dy * sa) / z[2], v = (-dx * sa + dy * ca) / z[3];
    if (u * u + v * v <= 1) return z;
  }
  return null;
}
// obstacle mobile au temps de course t (s) : aller-retour adouci le long d'un segment, ou tour complet d'un cercle
export function mobile(m, t, out) {
  t += (m.dec || 0) * m.per;                            // décalage de phase (fraction de période) : wagons d'un train, billes en file
  const w = TAU / m.per;
  if (m.chemin) {                                       // boucle fermée à vitesse constante (recherche dichotomique du tronçon)
    const ch = m.chemin, s = ((t / m.per) % 1 + 1) % 1 * ch.L, P = ch.P, n = P.length;
    let lo = 0, hi = n - 1;
    while (lo < hi) { const mi = (lo + hi + 1) >> 1; if (ch.cum[mi] <= s) lo = mi; else hi = mi - 1; }
    const a = P[lo], b = P[(lo + 1) % n], seg = ch.cum[lo + 1] - ch.cum[lo] || 1, u = (s - ch.cum[lo]) / seg, v = ch.L / m.per / TICK_HZ;
    const dx = (b[0] - a[0]) / seg, dy = (b[1] - a[1]) / seg;
    out.x = a[0] + (b[0] - a[0]) * u; out.y = a[1] + (b[1] - a[1]) * u;
    out.vx = dx * v; out.vy = dy * v; out.a = Math.atan2(dy, dx);
  } else if (m.seg) {
    const a = m.seg[0], b = m.seg[1], u = 0.5 - 0.5 * Math.cos(w * t), du = 0.5 * Math.sin(w * t) * w / TICK_HZ;
    out.x = a[0] + (b[0] - a[0]) * u; out.y = a[1] + (b[1] - a[1]) * u;
    out.vx = (b[0] - a[0]) * du; out.vy = (b[1] - a[1]) * du;
    out.a = Math.atan2(out.vy, out.vx) || Math.atan2(b[1] - a[1], b[0] - a[0]);
  } else {
    const c = m.cer, g = w * t;
    out.x = c[0] + Math.cos(g) * c[2]; out.y = c[1] + Math.sin(g) * c[2];
    out.vx = -Math.sin(g) * c[2] * w / TICK_HZ; out.vy = Math.cos(g) * c[2] * w / TICK_HZ; out.a = g + Math.PI / 2;
  }
  return out;
}
// grille de départ : deux files décalées DERRIÈRE la ligne (porte 0), voiture 1 en pole à droite
export function grilleDepart(c, nb) {
  const out = [];
  for (let k = 0; k < nb; k++) {
    const row = Math.floor(k / 2), side = k % 2 ? -1 : 1, back = 46 + row * 52 + (k % 2) * 22;
    const i = ((c.n - Math.round(back / c.step)) % c.n + c.n) % c.n, o = side * c.W * 0.42;
    out.push({ x: c.sx[i] + c.nx[i] * o, y: c.sy[i] + c.ny[i] * o, a: Math.atan2(c.ty[i], c.tx[i]), i });
  }
  return out;
}
