// Circuit « dejeuner » de Micro Machines — définition PARTAGÉE serveur / client (géométrie, obstacles, zones, décor).
// Format : voir l'en-tête de ../shared.js ; dessins propres au circuit (propriété `dessin`) : voir ../rendu.js.
export default {
  id: 'dejeuner', nom: 'Petit-déjeuner', emoji: '🥣', sous: 'Table de cuisine · bol, lait renversé, souris mécanique',
  w: 2600, h: 1700, surf: 'bois', edge: 'chute', table: { x0: 60, y0: 60, x1: 2540, y1: 1640, r: 90 }, W: 72,
  pts: [[700, 1420], [1300, 1430], [1900, 1400], [2260, 1250], [2350, 900], [2200, 560], [1860, 420], [1520, 560], [1320, 860], [1020, 960], [770, 800], [730, 480], [520, 300], [270, 420], [220, 800], [300, 1210]],
  mobs: [{ type: 'souris', seg: [[1180, 680], [1180, 1110]], r: 20, per: 5.5 }],   // souris mécanique qui traverse l'épingle
  boxes: [0.14, 0.47, 0.76],
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
};
