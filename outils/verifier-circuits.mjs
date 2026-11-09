// Banc d'essai des circuits de Micro Machines — zéro dépendance, sans navigateur ni réseau.
//
//    node outils/verifier-circuits.mjs                 tous les circuits : géométrie + courses de bots (2 sens)
//    node outils/verifier-circuits.mjs jardin noel     seulement ces circuits
//    node outils/verifier-circuits.mjs --geo           géométrie seulement (rapide)
//
// GÉOMÉTRIE (chaque circuit) : longueur, demi-largeur, taille du monde, marge au bord de la table, tronçons trop proches
// (sauf croisement voulu d'un circuit `croix`), virages trop serrés, ligne droite de départ, lignes droites à turbos,
// passage libre à côté de chaque obstacle (fixe ET mobile, à chaque instant), obstacles mobiles qui restent sur la table,
// boîtes de bonus sur la piste, et chaque type (sol, objet, mur, décor, zone, mobile) dessinable par rendu.js.
// COURSE (chaque sens) : le vrai serveur (games/micro/server.js) dans une fausse salle, 5 bots « Normale » + une voiture
// pilotée par un script simple (elle vise un point 150 u devant sur la piste), 3 tours, bonus actifs, hasard à graine.
// On mesure : arrivées (un bot encore en course 12 s après le premier est classé, comme en jeu, s'il est dans le dernier tour), temps au tour, chutes, pénalités de raccourci (un bot ne doit jamais en prendre), blocages.
// Sort en code 1 au moindre défaut.
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
for (const k of ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'LEADERBOARD_KEY', 'AVATAR_KEY', 'ADMIN_KEY', 'LEADERBOARD_FILE']) delete process.env[k];
const S = await import(pathToFileURL(join(ROOT, 'public', 'games', 'micro', 'shared.js')).href);
const { circuitParId, mobile, TICK_HZ, CAR_W, proche } = S;
const CIRCUITS = (await import(pathToFileURL(join(ROOT, 'public', 'games', 'micro', 'circuits', 'index.js')).href)).default;   // définitions complètes (enregistrées)
// les FICHES (ce que le navigateur charge d'abord) doivent recopier les définitions, dans le même ordre
{ const F = S.CIRCUITS, err = [];
  if (F.length !== CIRCUITS.length) err.push(F.length + ' fiches pour ' + CIRCUITS.length + ' circuits');
  CIRCUITS.forEach((d, i) => { const f = F[i] || {}; for (const k of ['id', 'nom', 'emoji', 'sous']) if (f[k] !== d[k]) err.push('fiche n° ' + (i + 1) + ' (' + d.id + ') : « ' + k + ' » diffère'); if ((f.v || 1) !== (d.v || 1)) err.push('fiche ' + d.id + ' : version ' + (f.v || 1) + ' ≠ ' + (d.v || 1)); });
  if (err.length) { console.error('❌ circuits/fiches.js ne correspond pas aux circuits :\n   ' + err.join('\n   ')); process.exit(1); } }

const args = process.argv.slice(2), geoSeul = args.includes('--geo'), ids = args.filter(a => !a.startsWith('--'));
const liste = ids.length ? CIRCUITS.filter(d => ids.includes(d.id)) : CIRCUITS;
if (ids.length && liste.length !== ids.length) { console.error('circuit inconnu : ' + ids.filter(i => !CIRCUITS.some(d => d.id === i)).join(', ')); process.exit(2); }

// ── bornes (cf. demande du 02/11 : plus longs, plus larges, plus de courbes, lignes droites à turbos) ──
const B = { Lmin: 9000, Lmax: 14500, Wmin: 80, Wmax: 115, aire: 9.6e6, cote: 4200, rayon: 1.25, sep: 40, bordChute: 25, bordMur: 10,
  droites: 2, droiteMin: 600, boosts: 2, passage: 54, passageMob: 40, deco: 8, perso: 4, lapMin: 26, lapMax: 62, chutes: 0.6, coupes: 0.15 };
const OBJETS = ['blanche', 'bol', 'tasse', 'confiture', 'sucre', 'jus', 'gomme', 'taille', 'trombones', 'bumper', 'punaise', 'pion', 'tampon', 'etau', 'ecrou', 'boulon', 'vis', 'de', 'sablier'];
const MURS = ['rail', 'plinthe', 'bande', 'crayon', 'regle', 'stylo', 'cuillere', 'queue', 'marteau'];
const DECORS = ['tartine', 'croissant', 'serviette', 'beurre', 'compas', 'equerre', 'trousse', 'craie', 'cubes', 'livre', 'peluche', 'chaussette', 'metre', 'chiffon', 'tournevis', 'pinceau', 'cartes', 'billets', 'gobelet', 'maison', 'arbre'];
const ZONES = ['lait', 'encre', 'huile', 'sucre', 'gomme', 'craie', 'sciure', 'boost'];
const MOBILES = ['souris', 'bille', 'toupie'];
const SURFS = ['bois', 'cahier', 'feutre', 'etabli', 'plateau', 'tapis', 'moquette'];
const own = (o, k) => !!o && Object.prototype.hasOwnProperty.call(o, k);

function distSeg(px, py, w) { const ex = w[2] - w[0], ey = w[3] - w[1], l2 = ex * ex + ey * ey || 1, u = Math.max(0, Math.min(1, ((px - w[0]) * ex + (py - w[1]) * ey) / l2)); return Math.hypot(px - (w[0] + ex * u), py - (w[1] + ey * u)); }
// largeur libre la plus grande en travers de la piste à l'échantillon i (obstacles fixes + éventuels disques en plus)
function passageLibre(c, i, extra) {
  const W = c.W, marge = CAR_W / 2 + 1; let best = 0, run = 0;
  for (let o = -W; o <= W; o += 3) {
    const x = c.sx[i] + c.nx[i] * o, y = c.sy[i] + c.ny[i] * o; let bloque = false;
    for (const id of c.near(x, y)) {
      if (id >= 10000) { const r = c.rocks[id - 10000]; if (Math.hypot(x - r[0], y - r[1]) < r[2] + marge) { bloque = true; break; } }
      else { const w = c.walls[id]; if (distSeg(x, y, w) < w[4] + marge) { bloque = true; break; } }
    }
    if (!bloque) for (const h of c.holes) if (Math.hypot(x - h[0], y - h[1]) < h[2] + 4) { bloque = true; break; }
    if (!bloque && extra) for (const e of extra) if (Math.hypot(x - e[0], y - e[1]) < e[2] + marge) { bloque = true; break; }
    if (bloque) run = 0; else { run += 3; if (run > best) best = run; }
  }
  return best;
}

function geometrie(d) {
  const D = [], c = circuitParId(d.id, false), ci = circuitParId(d.id, true), t = d.table, W = d.W, n = c.n, dess = d.dessin || {};
  const ko = m => D.push(m), f = i => (i / n).toFixed(3);
  if (!(c.L >= B.Lmin && c.L <= B.Lmax)) ko(`longueur ${Math.round(c.L)} u hors ${B.Lmin}..${B.Lmax}`);
  if (!(W >= B.Wmin && W <= B.Wmax)) ko(`demi-largeur W = ${W} hors ${B.Wmin}..${B.Wmax}`);
  if (d.w * d.h > B.aire || d.w > B.cote || d.h > B.cote) ko(`monde ${d.w} × ${d.h} trop grand (aire ≤ ${B.aire / 1e6} M u², côté ≤ ${B.cote})`);
  if (!(t.x0 >= 0 && t.y0 >= 0 && t.x1 <= d.w && t.y1 <= d.h)) ko('table hors du monde');
  const bord = d.edge === 'chute' ? B.bordChute : B.bordMur;
  let pire = 1e9, ip = 0;
  for (let i = 0; i < n; i++) { const m = Math.min(c.sx[i] - t.x0, t.x1 - c.sx[i], c.sy[i] - t.y0, t.y1 - c.sy[i]) - W; if (m < pire) { pire = m; ip = i; } }
  if (pire < bord) ko(`piste à ${Math.round(pire)} u du bord de la table (min ${bord}) vers f=${f(ip)}`);
  // tronçons trop proches (hors croisement voulu)
  let viol = 0, croisements = 0, exemple = '';
  for (let i = 0; i < n; i += 3) for (let j = i + 3; j < n; j += 3) {
    let ds = j - i; ds = Math.min(ds, n - ds) * c.step; if (ds < W * 6) continue;
    const dd = Math.hypot(c.sx[i] - c.sx[j], c.sy[i] - c.sy[j]);
    if (dd < 2 * W + B.sep) { const dot = Math.abs(c.tx[i] * c.tx[j] + c.ty[i] * c.ty[j]); if (d.croix && dot < 0.8) croisements++; else { viol++; if (!exemple) exemple = `f=${f(i)} et f=${f(j)} à ${Math.round(dd)} u`; } }
  }
  if (viol) ko(`${viol} paires de tronçons à moins de 2W + ${B.sep} u (${exemple})`);
  if (d.croix && !croisements) ko('circuit « croix » sans croisement détecté');
  // virages
  let kmax = 0, ik = 0; for (let i = 0; i < n; i++) if (Math.abs(c.k[i]) > kmax) { kmax = Math.abs(c.k[i]); ik = i; }
  if (1 / kmax < Math.max(100, B.rayon * W)) ko(`virage trop serré : rayon ${Math.round(1 / kmax)} u (min ${Math.round(Math.max(100, B.rayon * W))}) vers f=${f(ik)}`);
  // ligne droite de départ (les deux sens partent du même point)
  for (let s = -Math.round(300 / c.step); s <= Math.round(300 / c.step); s++) { const i = (s % n + n) % n; if (Math.abs(c.k[i]) > 1 / 1200) { ko(`le départ n'est pas sur une ligne droite (courbure à ${s * c.step} u de la ligne)`); break; } }
  // lignes droites et turbos
  const droites = []; { let i0 = -1, deb = 0; for (let i = 0; i < n; i++) if (Math.abs(c.k[i]) >= 1 / 2500) { deb = i; break; }
    for (let s = 0; s <= n; s++) { const i = (deb + s) % n, ok = s < n && Math.abs(c.k[i]) < 1 / 2500; if (ok && i0 < 0) i0 = s; if (!ok && i0 >= 0) { if ((s - i0) * c.step >= B.droiteMin) droites.push([(deb + i0) % n, (deb + s - 1) % n]); i0 = -1; } } }
  if (droites.length < B.droites) ko(`${droites.length} ligne(s) droite(s) de ${B.droiteMin} u ou plus (min ${B.droites})`);
  const boosts = c.zones.filter(z => z[4] === 'boost');
  const surDroite = boosts.filter(z => { const i = proche(c, z[0], z[1], -1, -1); return Math.abs(c.k[i]) < 1 / 1500; }).length;
  if (surDroite < B.boosts) ko(`${surDroite} flèche(s) turbo sur une ligne droite (min ${B.boosts}) — ${boosts.length} au total`);
  // passage libre à côté des obstacles fixes
  let pmin = 1e9, ipm = 0; for (let i = 0; i < n; i += 2) { const p = passageLibre(c, i, null); if (p < pmin) { pmin = p; ipm = i; } }
  if (pmin < B.passage) ko(`passage libre de ${pmin} u seulement (min ${B.passage}) vers f=${f(ipm)}`);
  // obstacles mobiles : sur la table, et jamais un mur infranchissable avec les obstacles fixes
  const mobs = c.mobs, o = {};
  if (!mobs.length) ko('aucun obstacle mobile');
  for (const m of mobs) {
    let horsTable = false, pm = 1e9, fm = 0;
    for (let k = 0; k < 48; k++) {
      mobile(m, m.per * k / 48, o);
      if (o.x - m.r < t.x0 || o.x + m.r > t.x1 || o.y - m.r < t.y0 || o.y + m.r > t.y1) horsTable = true;
      for (let i = 0; i < n; i += 2) if (Math.hypot(c.sx[i] - o.x, c.sy[i] - o.y) < W + m.r) { const p = passageLibre(c, i, [[o.x, o.y, m.r]]); if (p < pm) { pm = p; fm = i; } }
    }
    if (horsTable) ko(`obstacle mobile « ${m.type} » qui sort de la table`);
    if (pm < B.passageMob) ko(`obstacle mobile « ${m.type} » : passage de ${pm} u seulement à un instant (min ${B.passageMob}) vers f=${f(fm)}`);
    if (!MOBILES.includes(m.type) && !own(dess.mobiles, m.type)) ko(`obstacle mobile « ${m.type} » sans dessin (dessin.mobiles)`);
  }
  // boîtes de bonus sur la piste
  for (const b of c.boxes) { const i = proche(c, b[0], b[1], -1, -1); if (Math.hypot(c.sx[i] - b[0], c.sy[i] - b[1]) > W) { ko('boîte de bonus hors piste'); break; } }
  if (!(c.boxes.length >= 6 && c.boxes.length <= 15)) ko(`${c.boxes.length / 3} rangées de boîtes (2 à 5 attendues)`);
  // dessin : chaque type doit avoir un dessin (générique ou propre au circuit)
  if (!SURFS.includes(d.surf) && !(dess.sol && dess.plateau && dess.piste)) ko(`surface « ${d.surf} » inconnue sans dessin.sol / plateau / piste`);
  const manque = [];
  for (const r of c.rocks) if (!OBJETS.includes(r[3]) && !/^(bille\d|rack\d)$/.test(r[3]) && !own(dess.objets, r[3])) manque.push('objet ' + r[3]);
  for (const w of c.walls) if (!MURS.includes(w[5]) && !own(dess.murs, w[5])) manque.push('mur ' + w[5]);
  for (const z of c.zones) if (!ZONES.includes(z[4]) && !own(dess.zones, z[4])) manque.push('zone ' + z[4]);
  for (const x of c.deco) if (!DECORS.includes(x[2]) && !own(dess.decor, x[2])) manque.push('décor ' + x[2]);
  if (manque.length) ko('sans dessin : ' + [...new Set(manque)].join(', '));
  for (const z of c.zones) if (z[4] !== 'boost' && !own(S.ZONE_GLISSE, z[4]) && !own(S.ZONE_FREIN, z[4])) { ko(`zone « ${z[4]} » sans effet déclaré (zonesPhysiques)`); break; }
  if (c.deco.length < B.deco) ko(`${c.deco.length} éléments de décor (min ${B.deco})`);
  for (const x of c.deco) { const i = proche(c, x[0], x[1], -1, -1), dd = Math.hypot(c.sx[i] - x[0], c.sy[i] - x[1]); if (dd < W + 60) { ko(`décor « ${x[2]} » posé sur la piste (${Math.round(dd)} u de la ligne médiane, min W + 60)`); break; } }
  const perso = ['decor', 'objets', 'murs', 'mobiles', 'zones'].reduce((s, k) => s + (dess[k] ? Object.keys(dess[k]).length : 0), 0);
  if (perso < B.perso) ko(`${perso} dessins propres au circuit (min ${B.perso} : décor, objets, murs, mobiles ou zones)`);
  void ci;
  return { D, info: `L ${Math.round(c.L)} u · W ${W} · ${d.w}×${d.h} · ${c.gates.length} portes · rayon min ${Math.round(1 / kmax)} · ${droites.length} droites · ${boosts.length} turbos · ${c.rocks.length} obstacles · ${c.walls.length} murs · ${mobs.length} mobiles · ${c.zones.length - boosts.length} zones · ${c.deco.length} décors · passage min ${pmin} u` };
}

// ── course dans le vrai serveur ──
function mulberry32(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const G = (await import(pathToFileURL(join(ROOT, 'games', 'micro', 'server.js')).href)).default;
async function course(d, inverse) {
  const rnd = Math.random; Math.random = mulberry32(20261102 + d.id.length * 7 + (inverse ? 1 : 0));
  try {
    const members = [], room = { get members() { return members; }, memberById: id => members.find(m => m.id === id), broadcast() {}, send() {} };
    const g = G.create(room), m = { id: 'v1', name: 'Script', role: null };
    members.push(m); g.onJoin(m);
    g.onMessage({}, { t: 'daily', on: false });
    g.onMessage(m, { t: 'circuit', id: d.id });
    for (let k = 0, veut = inverse ? 'inverse' : 'normal'; k < 3 && g.tick().sens !== veut; k++) g.onMessage(m, { t: 'sens' });   // sens imposé (le défaut est « hasard »)
    for (let k = 0; k < 5; k++) g.onMessage(m, { t: 'bots' });
    g.onMessage(m, { t: 'start' });
    const c = circuitParId(d.id, inverse), seats = {}, prog = {};
    let s = null, tk = 0, si = -1;
    const CAP = (30 + 75 * 3 + 20) * TICK_HZ;
    while (tk++ < CAP) {
      s = g.tick();
      if (!s) continue;
      for (const f of s.fx || []) {
        const st = seats[f.seat] || (seats[f.seat] = { laps: [], falls: 0, cuts: 0, stuck: 0 });
        if (f.type === 'lap') st.laps.push(f.sec); else if (f.type === 'finish') st.laps.push(f.lap); else if (f.type === 'fall') st.falls++; else if (f.type === 'coupe') st.cuts++;
      }
      const me = (s.players || []).find(p => p.connected && p.playing);
      if (me && (s.gs === 'play' || s.gs === 'countdown')) {           // pilote scripté : vise la piste 150 u devant
        si = proche(c, me.x, me.y, si, 12);
        const j = (si + Math.round(150 / c.step)) % c.n, ang = Math.atan2(c.sy[j] - me.y, c.sx[j] - me.x);
        const serre = c.rayon[(si + 6) % c.n] < 260;
        g.onMessage(m, { t: 'input', mx: Math.cos(ang) * (serre ? 0.75 : 1), my: Math.sin(ang) * (serre ? 0.75 : 1) });
      }
      if (s.gs === 'play' && tk % TICK_HZ === 0) for (const p of s.players) if (p.playing && p.bot && !p.fin) {
        const q = prog[p.seat] || (prog[p.seat] = { pg: -1, t: tk });
        if (p.pg !== q.pg || p.fa) { q.pg = p.pg; q.t = tk; } else if (tk - q.t >= 6 * TICK_HZ) { (seats[p.seat] || (seats[p.seat] = { laps: [], falls: 0, cuts: 0, stuck: 0 })).stuck++; q.t = tk; }
      }
      if (s.gs === 'over') break;
    }
    const bots = (s ? s.players : []).filter(p => p.playing && p.bot), moi = (s ? s.players : []).find(p => p.playing && !p.bot);
    const st = seat => seats[seat] || { laps: [], falls: 0, cuts: 0, stuck: 0 };
    const tours = bots.reduce((a, p) => a.concat(st(p.seat).laps), []).sort((a, b) => a - b);
    const nbTours = Math.max(1, tours.length);
    return {
      fini: s && s.gs === 'over', arrives: bots.filter(p => p.fin).length, nb: bots.length,
      // un bot pas encore arrivé quand la course s'arrête (12 s après le premier) est classé à sa progression, comme en jeu :
      // seul compte qu'il soit au moins dans le dernier tour (sinon il a calé quelque part), et que le plafond de temps n'ait pas sonné
      retard: bots.filter(p => !p.fin && p.lap < 3).length, plafond: tk >= (30 + 75 * 3) * TICK_HZ,
      med: tours.length ? tours[Math.floor(tours.length / 2)] : 0, meilleur: tours.length ? tours[0] : 0,
      chutes: bots.reduce((a, p) => a + st(p.seat).falls, 0) / nbTours, coupes: bots.reduce((a, p) => a + st(p.seat).cuts, 0) / nbTours,
      bloques: bots.reduce((a, p) => a + st(p.seat).stuck, 0), duree: Math.round(tk / TICK_HZ),
      script: moi ? { fin: moi.fin, tours: st(moi.seat).laps.length, chutes: st(moi.seat).falls } : null,
    };
  } finally { Math.random = rnd; }
}

let echecs = 0;
for (const d of liste) {
  const { D, info } = geometrie(d);
  if (!geoSeul) for (const inv of [false, true]) {
    const r = await course(d, inv), sens = inv ? 'sens inverse' : 'sens normal';
    const txt = `${sens} : ${r.arrives}/${r.nb} bots arrivés en ${r.duree} s, tour médian ${r.med.toFixed(1)} s (meilleur ${r.meilleur.toFixed(1)}), ${r.chutes.toFixed(2)} chute/tour, ${r.coupes.toFixed(2)} pénalité/tour, ${r.bloques} blocage(s)` + (r.script ? ` · voiture scriptée : ${r.script.tours} tour(s), ${r.script.chutes} chute(s)${r.script.fin ? ', arrivée' : ''}` : '');
    if (!r.fini || r.plafond) D.push(`${sens} : course non terminée (${r.arrives}/${r.nb} bots arrivés)`);
    if (r.retard) D.push(`${sens} : ${r.retard} bot(s) pas encore dans le dernier tour à la fin de la course`);
    if (r.med && (r.med < B.lapMin || r.med > B.lapMax)) D.push(`${sens} : tour médian ${r.med.toFixed(1)} s hors ${B.lapMin}..${B.lapMax} s`);
    if (r.chutes > B.chutes) D.push(`${sens} : ${r.chutes.toFixed(2)} chute par tour de bot (max ${B.chutes})`);
    if (r.coupes > B.coupes) D.push(`${sens} : ${r.coupes.toFixed(2)} pénalité de raccourci par tour de bot (max ${B.coupes}) — tracé ambigu ?`);
    if (r.bloques) D.push(`${sens} : ${r.bloques} bot(s) bloqué(s) 6 s sans progresser`);
    console.log(`  · ${d.id} ${txt}`);
  }
  console.log(`${D.length ? '✗' : '✓'} ${d.id} (${d.nom}) — ${info}`);
  for (const m of D) console.log('    ✗ ' + m);
  if (D.length) echecs++;
}
console.log(echecs ? `❌ ${echecs}/${liste.length} circuit(s) en défaut` : `✅ ${liste.length}/${liste.length} circuits conformes`);
process.exit(echecs ? 1 : 0);
