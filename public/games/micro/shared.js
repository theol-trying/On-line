// MICRO MACHINES — géométrie PARTAGÉE serveur / client (module pur, zéro dépendance, iOS 15 sûr : ni ?. ni ??).
// Le serveur s'en sert pour la physique (surfaces, murs, chutes, portes de contrôle), le client pour dessiner exactement
// le même circuit : rien de la géométrie ne passe sur le réseau, seul l'identifiant du circuit (`circuit`).
//
// Un circuit = une table (ou une moquette) vue de dessus, une ligne médiane fermée (points de contrôle lissés en
// Catmull-Rom puis rééchantillonnés tous les STEP u) et une demi-largeur W. Autour : murs (capsules), obstacles ronds,
// trous (poches de billard), zones (lait / encre qui glissent, sucre / gomme qui freinent, flèches turbo) et décor.
//   • bord « chute » : sortir de la table = tomber (réapparition à la dernière porte) ; bord « mur » : on rebondit.
//   • portes de contrôle tous les ~GATE u : il faut les passer DANS L'ORDRE (pas de raccourci à travers la table).
//
// API : CIRCUITS (définitions), circuitParId(id) → circuit construit (mis en cache), puis sur un circuit c :
//   c.n, c.sx/sy (Float32Array), c.tx/ty (tangente), c.nx/ny (normale, à DROITE du sens de course), c.cs (abscisse), c.L,
//   c.k (courbure signée), c.gates [{ i, x, y, tx, ty, h }], c.walls [[x1,y1,x2,y2,r,type]], c.rocks [[x,y,r,type]],
//   c.holes [[x,y,r]], c.zones [[x,y,rx,ry,kind,ang]], c.deco [...], grille de collision (c.near(x, y) → indices),
//   proche(c, x, y, i0, fen) → indice d'échantillon le plus proche (recherche locale ; fen < 0 = globale),
//   surTable(c, x, y), zoneA(c, x, y) → zone ou null, grilleDepart(c, n) → [{ x, y, a }].

export const TICK_HZ = 30;
export const CAR_L = 34, CAR_W = 18, CAR_R = 12;        // voiture-jouet (u) ; collisions : un disque de rayon CAR_R
export const STEP = 10;                                 // pas d'échantillonnage de la ligne médiane (u)
export const GATE = 150;                                // espacement visé des portes de contrôle (u)
export const VIEW = 660;                                // côté de la vue d'un joueur (u) : identique pour tous les écrans (équité)
export const FALL_T = 30, GHOST_T = 36;                 // chute (ticks) puis fantôme (ticks) à la réapparition
export const LAPS = [1, 3, 5];
export const FORMULES = ['course', 'elim'];
export const ELIM_HW0 = 520, ELIM_HW1 = 340;            // Élimination : demi-côté de la fenêtre commune (début → fin)

const TAU = Math.PI * 2;
const wrapA = a => Math.atan2(Math.sin(a), Math.cos(a));

/* ---------- définitions des circuits ----------
   pts : ligne médiane (sens de course), le départ est entre le dernier et le premier point (ligne droite).
   make(H) : ajoute murs, obstacles, zones et décor à partir des échantillons (H.at(f) = point à la fraction f du tour). */
export const CIRCUITS = [
  {
    id: 'dejeuner', nom: 'Petit-déjeuner', emoji: '🥣', sous: 'Table de cuisine · bol, lait renversé, sucre',
    w: 2600, h: 1700, surf: 'bois', edge: 'chute', table: { x0: 60, y0: 60, x1: 2540, y1: 1640, r: 90 }, W: 72,
    pts: [[700, 1420], [1300, 1430], [1900, 1400], [2260, 1250], [2350, 900], [2200, 560], [1860, 420], [1520, 560], [1320, 860], [1020, 960], [770, 800], [730, 480], [520, 300], [270, 420], [220, 800], [300, 1210]],
    make(H) {
      H.rock(1720, 980, 150, 'bol');                       // bol de céréales au milieu de la boucle
      H.rock(1110, 1180, 62, 'tasse');                     // tasse de café
      H.rock(560, 1010, 46, 'confiture');
      H.rock(2140, 1520, 34, 'sucre'); H.rock(2230, 1490, 28, 'sucre');
      H.rock(1260, 230, 40, 'jus');
      H.wall(1900, 150, 2230, 250, 16, 'cuillere');
      H.zoneAt(0.215, 0, 95, 70, 'lait');                  // lait renversé dans la grande courbe de droite
      H.zoneAt(0.585, 0.55, 80, 60, 'sucre');              // sucre en poudre à la corde de l'épingle
      H.zoneAt(0.86, -0.3, 70, 52, 'lait');
      H.deco(2050, 900, 'tartine'); H.deco(380, 1480, 'croissant'); H.deco(1500, 1560, 'serviette'); H.deco(1000, 200, 'beurre');
    },
  },
  {
    id: 'bureau', nom: 'Bureau d\'écolier', emoji: '✏️', sous: 'Cahier quadrillé · crayons, règles, taches d\'encre',
    w: 2600, h: 1700, surf: 'cahier', edge: 'chute', table: { x0: 60, y0: 60, x1: 2540, y1: 1640, r: 30 }, W: 70,
    pts: [[600, 1440], [1000, 1445], [1400, 1450], [1750, 1340], [1860, 1100], [2060, 960], [2290, 1060], [2410, 830], [2240, 430], [1800, 320], [1500, 470], [1310, 760], [1050, 830], [850, 650], [930, 400], [700, 230], [340, 330], [230, 680], [300, 1080]],
    make(H) {
      H.rail(0.015, 0.095, -1, 'regle'); H.rail(0.015, 0.095, 1, 'crayon');      // ligne droite de départ entre règle et crayon
      H.wall(122, 700, 128, 1060, 9, 'crayon');            // crayon couché le long de la ligne droite de gauche
      H.rock(1400, 1100, 52, 'gomme'); H.rock(2080, 620, 44, 'taille');
      H.rock(560, 900, 60, 'trombones');
      H.wall(1500, 1060, 1600, 1260, 14, 'stylo');
      H.zoneAt(0.30, 0.2, 90, 64, 'encre');               // tache d'encre au pied de la chicane
      H.zoneAt(0.66, -0.4, 80, 56, 'gomme');               // miettes de gomme à la corde
      H.zoneAt(0.78, 0.35, 70, 50, 'encre');
      H.deco(2000, 1500, 'compas'); H.deco(1100, 140, 'equerre'); H.deco(200, 1540, 'trousse');
    },
  },
  {
    id: 'billard', nom: 'Billard', emoji: '🎱', sous: 'Feutre vert · bandes, billes, poches qui avalent',
    w: 2520, h: 1370, surf: 'feutre', edge: 'mur', table: { x0: 70, y0: 70, x1: 2450, y1: 1300, r: 10 }, W: 70,
    pts: [[700, 1110], [1260, 1100], [1800, 1110], [2170, 1000], [2240, 640], [1990, 330], [1560, 400], [1260, 640], [960, 400], [520, 330], [270, 620], [330, 1000]],
    make(H) {
      const t = H.c.table;                                   // bandes : murs le long du feutre (on rebondit)
      H.wall(t.x0, t.y0, t.x1, t.y0, 14, 'bande'); H.wall(t.x1, t.y0, t.x1, t.y1, 14, 'bande');
      H.wall(t.x1, t.y1, t.x0, t.y1, 14, 'bande'); H.wall(t.x0, t.y1, t.x0, t.y0, 14, 'bande');
      H.hole(t.x0 + 22, t.y0 + 22, 62); H.hole(t.x1 - 22, t.y0 + 22, 62); H.hole(t.x0 + 22, t.y1 - 22, 62); H.hole(t.x1 - 22, t.y1 - 22, 62);
      H.hole(1260, t.y0 + 6, 56); H.hole(1260, t.y1 - 6, 56);
      H.rockAt(0.07, 0.62, 27, 'bille1'); H.rockAt(0.13, -0.6, 27, 'bille2'); H.rockAt(0.19, 0.55, 27, 'bille3');   // chicane de billes
      H.rockAt(0.585, 0, 27, 'bille8');
      H.rockAt(0.42, -0.5, 27, 'bille5');
      H.rock(1260, 870, 27, 'blanche');
      for (let r = 0; r < 4; r++) for (let k = 0; k <= r; k++) H.rock(1700 + r * 46, 720 + (k - r / 2) * 54, 26, 'rack' + ((r + k) % 7));   // triangle de billes au centre
      H.wall(400, 1180, 1100, 1235, 13, 'queue');
      H.zoneAt(0.33, 0.3, 70, 52, 'craie');
      H.deco(2300, 1180, 'craie'); H.deco(160, 180, 'craie');
    },
  },
  {
    id: 'piste', nom: 'Circuit-jouet', emoji: '🏁', sous: 'Piste orange à rails · moquette du salon, flèches turbo',
    w: 2600, h: 1650, surf: 'moquette', edge: 'mur', table: { x0: 40, y0: 40, x1: 2560, y1: 1610, r: 40 }, W: 66,
    pts: [[650, 1300], [1450, 1310], [2050, 1230], [2280, 900], [2120, 560], [1660, 470], [1300, 600], [1360, 880], [1080, 1000], [780, 860], [700, 600], [760, 400], [660, 240], [440, 190], [260, 380], [220, 860], [330, 1170]],
    make(H) {
      const t = H.c.table;
      H.wall(t.x0, t.y0, t.x1, t.y0, 20, 'plinthe'); H.wall(t.x1, t.y0, t.x1, t.y1, 20, 'plinthe');
      H.wall(t.x1, t.y1, t.x0, t.y1, 20, 'plinthe'); H.wall(t.x0, t.y1, t.x0, t.y0, 20, 'plinthe');
      H.rails('rail');                                       // rails de plastique tout le long : pas de raccourci, pas de chute
      H.boostAt(0.045); H.boostAt(0.115); H.boostAt(0.47); H.boostAt(0.80);
      H.deco(1900, 950, 'cubes'); H.deco(1700, 1520, 'livre'); H.deco(500, 1480, 'peluche'); H.deco(1450, 180, 'chaussette');
    },
  },
];

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

function construire(def) {
  const c = Object.assign({}, def);
  const sm = resample(catmull(def.pts, 24), STEP), P = sm.pts, n = P.length;
  c.n = n; c.L = sm.L; c.step = sm.L / n;
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
      const a = (i + d - 1 + n) % n, b = (i + d + 1) % n;
      s += wrapA(Math.atan2(c.ty[b], c.tx[b]) - Math.atan2(c.ty[a], c.tx[a])) / (2 * c.step);
    }
    c.k[i] = s / 7;
  }
  c.walls = []; c.rocks = []; c.holes = []; c.zones = []; c.deco = [];
  const H = {
    c,
    at(f, lat) { const i = ((Math.round(f * n) % n) + n) % n, o = (lat || 0) * c.W; return { i, x: c.sx[i] + c.nx[i] * o, y: c.sy[i] + c.ny[i] * o }; },
    wall(x1, y1, x2, y2, r, type) { c.walls.push([x1, y1, x2, y2, r, type || 'mur']); },
    rock(x, y, r, type) { c.rocks.push([x, y, r, type || 'rocher']); },
    rockAt(f, lat, r, type) { const p = H.at(f, lat); c.rocks.push([p.x, p.y, r, type]); },
    hole(x, y, r) { c.holes.push([x, y, r]); },
    zoneAt(f, lat, rx, ry, kind) { const p = H.at(f, lat); c.zones.push([p.x, p.y, rx, ry, kind, Math.atan2(c.ty[p.i], c.tx[p.i])]); },
    boostAt(f) { const p = H.at(f, 0); c.zones.push([p.x, p.y, 44, 30, 'boost', Math.atan2(c.ty[p.i], c.tx[p.i])]); },
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
    rails(type) {                                                   // rails continus des deux côtés (circuit-jouet)
      const off = c.W + 10, k = 3;
      for (let i = 0; i < n; i += k) {
        const j = (i + k) % n;
        for (const side of [-1, 1]) c.walls.push([c.sx[i] + c.nx[i] * off * side, c.sy[i] + c.ny[i] * off * side, c.sx[j] + c.nx[j] * off * side, c.sy[j] + c.ny[j] * off * side, 7, type]);
      }
    },
  };
  if (def.make) def.make(H);
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
  const pad = CAR_R + 24;
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
export function circuitParId(id) {
  let d = null;
  for (let i = 0; i < CIRCUITS.length; i++) if (CIRCUITS[i].id === id) d = CIRCUITS[i];
  if (!d) d = CIRCUITS[0];
  return CACHE[d.id] || (CACHE[d.id] = construire(d));
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
