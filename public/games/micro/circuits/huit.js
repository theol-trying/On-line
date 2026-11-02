// Circuit « huit » de Micro Machines — définition PARTAGÉE serveur / client (géométrie, obstacles, zones, décor).
// Format : voir l'en-tête de ../shared.js ; dessins propres au circuit (propriété `dessin`) : voir ../rendu.js.
export default {
  id: 'huit', nom: 'Circuit en 8', emoji: '♾️', sous: 'Piste-jouet qui se croise · tapis de jeu, turbos, bumpers',
  w: 2600, h: 1650, surf: 'tapis', edge: 'mur', table: { x0: 40, y0: 40, x1: 2560, y1: 1610, r: 40 }, W: 64,
  pts: [[2000, 1300], [2280, 1295], [2410, 1060], [2400, 580], [2230, 370], [1900, 360], [1650, 500], [1300, 825], [950, 1150], [700, 1290], [370, 1290], [200, 1070], [200, 580], [370, 370], [700, 360], [950, 500], [1300, 825], [1650, 1150], [1850, 1300]],
  croix: true,
  boxes: [0.2, 0.62],
  make(H) {
    const t = H.c.table;
    H.wall(t.x0, t.y0, t.x1, t.y0, 20, 'plinthe'); H.wall(t.x1, t.y0, t.x1, t.y1, 20, 'plinthe');
    H.wall(t.x1, t.y1, t.x0, t.y1, 20, 'plinthe'); H.wall(t.x0, t.y1, t.x0, t.y0, 20, 'plinthe');
    H.rails('rail');                                       // rails partout SAUF au croisement (rails() le détecte)
    H.boostAt(0.32); H.boostAt(0.82);
    H.rockAt(0.535, 0.6, 20, 'bumper'); H.rockAt(0.565, -0.6, 20, 'bumper');
    H.deco(2250, 820, 'maison'); H.deco(350, 820, 'maison'); H.deco(1300, 180, 'arbre'); H.deco(1300, 1480, 'arbre');
  },
};
