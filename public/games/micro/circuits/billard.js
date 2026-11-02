// Circuit « billard » de Micro Machines — définition PARTAGÉE serveur / client (géométrie, obstacles, zones, décor).
// Format : voir l'en-tête de ../shared.js ; dessins propres au circuit (propriété `dessin`) : voir ../rendu.js.
export default {
  id: 'billard', nom: 'Billard', emoji: '🎱', sous: 'Feutre vert · bandes, billes qui roulent, poches qui avalent',
  w: 2520, h: 1370, surf: 'feutre', edge: 'mur', table: { x0: 70, y0: 70, x1: 2450, y1: 1300, r: 10 }, W: 70,
  pts: [[700, 1110], [1260, 1100], [1800, 1110], [2170, 1000], [2240, 640], [1990, 330], [1560, 400], [1260, 640], [960, 400], [520, 330], [270, 620], [330, 1000]],
  mobs: [{ type: 'bille', seg: [[1260, 300], [1260, 790]], r: 26, per: 7 }],   // une bille roule d'une bande à l'autre à travers le S
  boxes: [0.26, 0.5, 0.8],
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
};
