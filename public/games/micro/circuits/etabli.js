// Circuit « etabli » de Micro Machines — définition PARTAGÉE serveur / client (géométrie, obstacles, zones, décor).
// Format : voir l'en-tête de ../shared.js ; dessins propres au circuit (propriété `dessin`) : voir ../rendu.js.
export default {
  id: 'etabli', nom: 'Établi du garage', emoji: '🔧', sous: 'Contreplaqué taché d\'huile · étau, vis, tampons de caoutchouc',
  w: 2600, h: 1700, surf: 'etabli', edge: 'chute', table: { x0: 60, y0: 60, x1: 2540, y1: 1640, r: 16 }, W: 68,
  pts: [[600, 300], [1100, 290], [1700, 300], [2150, 380], [2380, 700], [2300, 1100], [2000, 1350], [1650, 1300], [1450, 1050], [1200, 1000], [1000, 1250], [800, 1450], [450, 1420], [280, 1150], [380, 850], [300, 550]],
  boxes: [0.2, 0.44, 0.74],
  make(H) {
    H.rock(1880, 820, 115, 'etau');                       // étau au creux de la grande courbe
    H.wall(780, 760, 1150, 680, 16, 'marteau');
    H.rock(1320, 1470, 26, 'ecrou'); H.rock(2440, 1470, 30, 'boulon'); H.rock(640, 1020, 24, 'ecrou'); H.rock(2440, 200, 22, 'vis');
    H.rockAt(0.105, 0.62, 19, 'tampon'); H.rockAt(0.135, -0.62, 19, 'tampon');   // tampons de caoutchouc sur la grande ligne droite : ça rebondit
    H.zoneAt(0.25, 0.2, 90, 62, 'huile');                // flaque d'huile en sortie de la grande courbe
    H.zoneAt(0.78, 0.55, 80, 56, 'sciure');              // sciure à la corde de l'épingle
    H.zoneAt(0.95, -0.2, 70, 50, 'huile');
    H.deco(1350, 120, 'metre'); H.deco(2250, 1560, 'chiffon'); H.deco(160, 1580, 'tournevis'); H.deco(1600, 820, 'pinceau');
  },
};
