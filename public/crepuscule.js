// Arène qui évolue — du jour vers le crépuscule pendant la mort subite. Partagé par les 6 jeux.
//
//   crepuscule(ctx, x, y, w, h, t, opts)     t ∈ [0, 1] : 0 = rien, 1 = nuit tombée
//
// Trois couches, dessinées PAR-DESSUS le sol et les pièces (c'est un étalonnage, pas un décor) :
//   1. teinte en « multiply » : or chaud → rose → violet profond ;
//   2. vignette qui se referme vers les bords ;
//   3. liseré de soleil couchant rasant sur un bord (opts.soleil : 'haut' | 'bas' | 'gauche' | 'droite', ou false).
// La lisibilité reste la règle : l'intensité plafonne bien avant le noir, joueurs et dangers restent nets.
// opts.force (0..1, défaut 1) module le tout — ex. 0.5 pour le thème Clair, 0 si « Réduire les effets »
// doit tout couper (à la charge de l'appelant ; l'étalonnage reste une INFORMATION de jeu : la manche s'achève).
// Un seul dégradé par image, mis en cache tant que la taille et le palier de t ne changent pas.

let cacheCle = '', cacheVig = null;

function mix(a, b, k) { return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]; }
function css(c, a) { return 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + a.toFixed(3) + ')'; }
// Or → ROUGE SANG → violet profond (retour utilisateur du 24/09 : « trop discret, pas assez dramatique »).
const OR = [255, 190, 110], SANG = [228, 64, 58], VIOLET = [104, 70, 190];

/* ── DUEL FINAL (commun aux 6 jeux) ────────────────────────────────────────────────────────────────
   Quand il ne reste plus que 2 joueurs — ou 2 équipes — en lice, sur une manche commencée à PLUS de 2, la
   nuit tombe en ~4 s. Détecté sur le snapshot (players[].playing / alive / team), sans rien demander au
   serveur. Une manche qui DÉMARRE à 2 garde la montée propre à chaque jeu (sinon il ferait nuit dès le départ).
   const D = creerDuel();   puis à chaque image :   t = Math.max(tJeu, D.t(snap, now, () => annonce()))
   `annonce` n'est appelée qu'une fois par manche (bandeau « Duel final »). */
export function creerDuel() {
  let debut = 0, maxCamps = 0, actif = false;
  return {
    t(snap, now, annonce) {
      const gs = snap && snap.gs;
      if (gs !== 'play' && gs !== 'paused' && gs !== 'over') { debut = 0; maxCamps = 0; actif = false; return 0; }
      const camps = {}; let n = 0;
      const ps = snap.players || [];
      for (let i = 0; i < ps.length; i++) {
        const p = ps[i];
        if (!p || !p.playing || !p.alive) continue;
        const k = p.team == null ? 's' + i : 't' + p.team;
        if (!camps[k]) { camps[k] = 1; n++; }
      }
      if (n > maxCamps) maxCamps = n;
      if (!actif && maxCamps > 2 && n === 2 && gs === 'play') { actif = true; debut = now; if (annonce) annonce(); }
      if (!actif) return 0;
      const k = Math.min(1, (now - debut) / 4000);
      return 0.92 * k * k * (3 - 2 * k);              // montée en S : la nuit « tombe », elle ne s'allume pas
    },
  };
}

export function crepuscule(ctx, x, y, w, h, t, opts) {
  opts = opts || {};
  const f = opts.force == null ? 1 : opts.force;
  t = (t > 1 ? 1 : t) * f;
  if (!(t > 0.01)) return;
  const teinte = t < 0.5 ? mix(OR, SANG, t * 2) : mix(SANG, VIOLET, (t - 0.5) * 2);
  const op = ctx.globalCompositeOperation, ga = ctx.globalAlpha;
  ctx.globalAlpha = 1;
  // 1. étalonnage
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = css(teinte, 0.18 + 0.44 * t);
  ctx.fillRect(x, y, w, h);
  // 2. vignette (dégradé mis en cache par taille et palier de 5 %)
  ctx.globalCompositeOperation = 'source-over';
  const palier = Math.round(t * 20);
  const cle = w + 'x' + h + '@' + x + ',' + y + '#' + palier;
  if (cle !== cacheCle) {
    const cx = x + w / 2, cy = y + h / 2, R = Math.sqrt(w * w + h * h) / 2;
    cacheVig = ctx.createRadialGradient(cx, cy, R * (0.62 - 0.22 * palier / 20), cx, cy, R);
    cacheVig.addColorStop(0, 'rgba(12,6,28,0)');
    cacheVig.addColorStop(1, 'rgba(12,6,28,' + (0.64 * palier / 20).toFixed(3) + ')');   // se referme franchement au duel
    cacheCle = cle;
  }
  ctx.fillStyle = cacheVig; ctx.fillRect(x, y, w, h);
  // 3. liseré de soleil couchant
  const s = opts.soleil === undefined ? 'haut' : opts.soleil;
  if (s) {
    const e = Math.min(w, h) * 0.26, a = 0.30 * Math.sin(Math.PI * Math.min(1, t * 1.25));   // culmine puis s'éteint : la nuit tombe
    if (a > 0.01) {
      let g;
      if (s === 'bas') g = ctx.createLinearGradient(0, y + h, 0, y + h - e);
      else if (s === 'gauche') g = ctx.createLinearGradient(x, 0, x + e, 0);
      else if (s === 'droite') g = ctx.createLinearGradient(x + w, 0, x + w - e, 0);
      else g = ctx.createLinearGradient(0, y, 0, y + e);
      g.addColorStop(0, css([255, 150, 80], a)); g.addColorStop(1, css([255, 150, 80], 0));
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
    }
  }
  ctx.globalCompositeOperation = op; ctx.globalAlpha = ga;
}
