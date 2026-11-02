// Circuit « piste » de Micro Machines — définition PARTAGÉE serveur / client (géométrie, obstacles, zones, décor).
// Format : voir l'en-tête de ../shared.js ; dessins propres au circuit (propriété `dessin`) : voir ../rendu.js.
export default {
  id: 'piste', nom: 'Circuit-jouet', emoji: '🏁', sous: 'Piste orange à rails · moquette du salon, turbos, bumpers',
  w: 2600, h: 1650, surf: 'moquette', edge: 'mur', table: { x0: 40, y0: 40, x1: 2560, y1: 1610, r: 40 }, W: 66,
  pts: [[650, 1300], [1450, 1310], [2050, 1230], [2280, 900], [2120, 560], [1660, 470], [1300, 600], [1360, 880], [1080, 1000], [780, 860], [700, 600], [760, 400], [660, 240], [440, 190], [260, 380], [220, 860], [330, 1170]],
  boxes: [0.08, 0.36, 0.7],
  make(H) {
    const t = H.c.table;
    H.wall(t.x0, t.y0, t.x1, t.y0, 20, 'plinthe'); H.wall(t.x1, t.y0, t.x1, t.y1, 20, 'plinthe');
    H.wall(t.x1, t.y1, t.x0, t.y1, 20, 'plinthe'); H.wall(t.x0, t.y1, t.x0, t.y0, 20, 'plinthe');
    H.rails('rail');                                       // rails de plastique tout le long : pas de raccourci, pas de chute
    H.boostAt(0.045); H.boostAt(0.115); H.boostAt(0.47); H.boostAt(0.80);
    H.rockAt(0.585, 0.6, 20, 'bumper'); H.rockAt(0.61, -0.6, 20, 'bumper'); H.rockAt(0.635, 0.6, 20, 'bumper');   // slalom de bumpers
    H.deco(1900, 950, 'cubes'); H.deco(1700, 1520, 'livre'); H.deco(500, 1480, 'peluche'); H.deco(1450, 180, 'chaussette');
  },
};
