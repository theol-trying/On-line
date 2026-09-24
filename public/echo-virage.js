// Écho immédiat d'un virage — partagé par Tron et Snake (jeux à pas discret, 12-15 Hz).
//
// Dès l'appui, un chevron devant SA propre tête montre le virage enregistré, jusqu'à ce que l'instantané
// le confirme (~1 tick + l'interpolation, 150-250 ms). Aucune prédiction de position : on ne montre que
// l'intention prise en compte. Même règle que le serveur (file de 2 virages, cf. virage() dans
// games/tron|snake/server.js) : rien n'est dessiné pour un demi-tour sur soi-même, qui serait refusé.
//
//   const E = creerEcho();
//   E.appui(nomDir, dx, dy, inv)        à chaque envoi {t:'dir'} ; (dx,dy) = cap actuel À L'ÉCRAN, inv = ⇄ actif
//   E.dessiner(ctx, x, y, taille, dx, dy, col, now, reduit)   après avoir dessiné sa tête (cap à l'écran)
//   E.vider()                           mort, fin de manche, changement de siège

const VEC = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const DUREE = 450;                        // au-delà, l'écho s'efface même sans confirmation (virage perdu en route)

export function creerEcho() {
  let q = [], t0 = 0;                    // virages en attente, EN COORDONNÉES ÉCRAN (⇄ déjà appliqué)
  const meme = (a, b) => a[0] === b[0] && a[1] === b[1], opp = (a, b) => a[0] === -b[0] && a[1] === -b[1];
  return {
    appui(nom, dx, dy, inv) {
      const v = VEC[nom]; if (!v || (!dx && !dy)) return;
      const d = inv ? [-v[0], -v[1]] : v;                 // la touche « gauche » sous ⇄ fait aller à droite
      const L = q.length ? q[q.length - 1] : [dx, dy];
      if (meme(d, L)) return;
      if (opp(d, L)) { if (q.length) q.pop(); return; }   // correction : mieux vaut ne rien montrer qu'un virage peut-être refusé
      if (q.length < 2) q.push(d);
      t0 = performance.now();
    },
    dessiner(ctx, x, y, s, dx, dy, col, now, reduit) {
      if (!q.length) return;
      if (now - t0 > DUREE) { q = []; return; }
      while (q.length && meme(q[0], [dx, dy])) q.shift(); // confirmé par l'instantané : l'écho a fait son office
      if (!q.length) return;
      const a = 1 - Math.max(0, (now - t0) / DUREE - 0.5) * 2;   // plein pendant la moitié du délai, puis s'efface
      ctx.save();
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      for (let i = 0; i < q.length; i++) {
        const d = q[i], k = i ? 0.7 : 1, off = s * (0.95 + i * 0.55), w = s * 0.34 * k;
        const cx = x + d[0] * off, cy = y + d[1] * off, px = -d[1], py = d[0];   // (px,py) : perpendiculaire au virage
        const pulse = reduit ? 0 : Math.sin(now / 60) * s * 0.05;
        ctx.globalAlpha = a * (i ? 0.6 : 0.95);
        ctx.beginPath();
        ctx.moveTo(cx - d[0] * w + px * w, cy - d[1] * w + py * w);
        ctx.lineTo(cx + d[0] * (w * 0.4 + pulse), cy + d[1] * (w * 0.4 + pulse));
        ctx.lineTo(cx - d[0] * w - px * w, cy - d[1] * w - py * w);
        ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = Math.max(3, s * 0.26 * k); ctx.stroke();   // liseré : lisible sur tous les sols
        ctx.strokeStyle = col; ctx.lineWidth = Math.max(1.6, s * 0.14 * k); ctx.stroke();
      }
      ctx.restore();
    },
    vider() { q = []; },
  };
}
