// CAMÉRA DE DUEL — brique visuelle PARTAGÉE (Sumo, Foot, Tanks). Quand il ne reste que 2 survivants / 2 camps au
// duel final, la vue se rapproche en douceur et se centre entre les deux ; elle revient au plan large ensuite.
// Canvas pur, zéro dépendance, compatible iOS 15 (pas de ?. ?? Object.hasOwn…). Aucune allocation par image.
//
// API
//   const CAM = createDuelCam({ maxZoom: 1.18, ease: 0.05, margin: 90 });
//   CAM.update(points, W, H, active, A[, now])
//        points = [{x,y},{x,y}] positions MONDE des 2 protagonistes (les autres entrées sont ignorées) ;
//        W,H    = taille du repère monde du canvas ; active = exactement 2 survivants / camps au duel final ;
//        A      = accessibilité : A.reduceFx force le plan large (zoom 1, sans transition) ;
//        now    = ms (facultatif, sinon performance.now) : le lissage est indépendant de la cadence d'images.
//        Le zoom cible est celui qui garde les deux points + `margin` (unités monde) dans le cadre, plafonné
//        à maxZoom. Zoom et centre sont lissés (entrée / sortie douces). Renvoie le zoom courant.
//   CAM.apply(ctx)   multiplie le repère courant par le transform de la caméra. Le centre est borné : la vue ne
//                    sort JAMAIS de [0,W]×[0,H]. No-op (aucun appel canvas) quand le zoom vaut 1.
//   CAM.zoom()       zoom courant (1 = plan large). CAM.reset() : retour immédiat au plan large.
//   CAM.toWorld(px, py) → { x, y } convertit un point du repère non zoomé (ex. pointeur) en repère monde zoomé.
//
// Intégration type (draw d'un client) — le HUD se dessine HORS caméra :
//   CAM.update(active2 ? [{x:a.x,y:a.y},{x:b.x,y:b.y}] : null, W, H, active2, A, now);
//   ctx.fillStyle = fond; ctx.fillRect(0, 0, W, H);            // fond plein cadre / marge, hors caméra
//   ctx.save(); CAM.apply(ctx);                                 // ← après le fond, avant le plateau et les pièces
//   drawArena(); drawPieces();                                 // (décor compris : sinon pièces et décor se décalent)
//   ctx.restore();
//   drawHUD();                                                 // hors caméra
export function createDuelCam(opts) {
  const o = opts || {};
  const maxZoom = o.maxZoom > 1 ? o.maxZoom : 1.18;
  const ease = o.ease > 0 && o.ease <= 1 ? o.ease : 0.05;      // part du chemin parcourue par image à 60 Hz
  const margin = o.margin >= 0 ? o.margin : 90;
  let z = 1, cx = 0, cy = 0, W = 0, H = 0, last = -1, init = false;

  function reset() { z = 1; init = false; last = -1; if (W > 0) { cx = W / 2; cy = H / 2; init = true; } }

  function update(points, Wd, Hd, active, A, now) {
    if (Wd > 0 && Hd > 0) {
      if (Wd !== W || Hd !== H) { W = Wd; H = Hd; if (!init) { cx = W / 2; cy = H / 2; init = true; } }
    }
    if (!init) return 1;
    const t = now != null ? now : (typeof performance !== 'undefined' ? performance.now() : Date.now());
    const dt = last < 0 ? 1 : Math.min(3, Math.max(0.1, (t - last) / 16.667));     // en « images à 60 Hz », borné (onglet en veille)
    last = t;
    if (A && A.reduceFx) { z = 1; cx = W / 2; cy = H / 2; return 1; }
    let tz = 1, tx = W / 2, ty = H / 2;
    if (active && points && points.length >= 2 && points[0] && points[1]) {
      const ax = points[0].x, ay = points[0].y, bx = points[1].x, by = points[1].y;
      if (isFinite(ax) && isFinite(ay) && isFinite(bx) && isFinite(by)) {
        const bw = Math.abs(ax - bx) + 2 * margin, bh = Math.abs(ay - by) + 2 * margin;
        tz = Math.max(1, Math.min(maxZoom, W / bw, H / bh));
        tx = (ax + bx) / 2; ty = (ay + by) / 2;
      }
    }
    const k = 1 - Math.pow(1 - ease, dt);                                          // lissage exponentiel indépendant de la cadence
    z += (tz - z) * k; cx += (tx - cx) * k; cy += (ty - cy) * k;
    if (Math.abs(z - 1) < 0.0005 && tz === 1) { z = 1; }                            // sortie terminée : plan large exact
    const hw = W / (2 * z), hh = H / (2 * z);                                       // demi-vue : le centre reste dans [hw, W-hw]
    cx = Math.max(hw, Math.min(W - hw, cx)); cy = Math.max(hh, Math.min(H - hh, cy));
    return z;
  }

  function apply(ctx) {
    if (z <= 1.0005 || !(W > 0)) return;
    // Le centre est reborné au zoom courant (au cas où le canvas aurait été redimensionné depuis update).
    const hw = W / (2 * z), hh = H / (2 * z);
    const x = Math.max(hw, Math.min(W - hw, cx)), y = Math.max(hh, Math.min(H - hh, cy));
    ctx.translate(W / 2, H / 2); ctx.scale(z, z); ctx.translate(-x, -y);
  }

  function toWorld(px, py) {
    if (z <= 1.0005 || !(W > 0)) return { x: px, y: py };
    const hw = W / (2 * z), hh = H / (2 * z);
    const x = Math.max(hw, Math.min(W - hw, cx)), y = Math.max(hh, Math.min(H - hh, cy));
    return { x: x + (px - W / 2) / z, y: y + (py - H / 2) / z };
  }

  return { update, apply, zoom() { return z; }, reset, toWorld };
}
