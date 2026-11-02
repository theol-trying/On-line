// Circuit « bureau » de Micro Machines — définition PARTAGÉE serveur / client (géométrie, obstacles, zones, décor).
// Format : voir l'en-tête de ../shared.js ; dessins propres au circuit (propriété `dessin`) : voir ../rendu.js.
export default {
  id: 'bureau', nom: 'Bureau d\'écolier', emoji: '✏️', sous: 'Cahier quadrillé · crayons, punaises, taches d\'encre',
  w: 2600, h: 1700, surf: 'cahier', edge: 'chute', table: { x0: 60, y0: 60, x1: 2540, y1: 1640, r: 30 }, W: 70,
  pts: [[600, 1440], [1000, 1445], [1400, 1450], [1750, 1340], [1860, 1100], [2060, 960], [2290, 1060], [2410, 830], [2240, 430], [1800, 320], [1500, 470], [1310, 760], [1050, 830], [850, 650], [930, 400], [700, 230], [340, 330], [230, 680], [300, 1080]],
  boxes: [0.2, 0.52, 0.84],
  make(H) {
    H.rail(0.015, 0.095, -1, 'regle'); H.rail(0.015, 0.095, 1, 'crayon');      // ligne droite de départ entre règle et crayon
    H.wall(122, 700, 128, 1060, 9, 'crayon');            // crayon couché le long de la ligne droite de gauche
    H.rock(1400, 1100, 52, 'gomme'); H.rock(2080, 620, 44, 'taille');
    H.rock(560, 900, 60, 'trombones');
    H.wall(1500, 1060, 1600, 1260, 14, 'stylo');
    H.rockAt(0.39, 0.62, 18, 'punaise'); H.rockAt(0.42, -0.62, 18, 'punaise');   // punaises à tête ronde : elles renvoient
    H.rockAt(0.665, 0.6, 18, 'punaise');
    H.zoneAt(0.30, 0.2, 90, 64, 'encre');               // tache d'encre au pied de la chicane
    H.zoneAt(0.66, -0.4, 80, 56, 'gomme');               // miettes de gomme à la corde
    H.zoneAt(0.78, 0.35, 70, 50, 'encre');
    H.deco(2000, 1500, 'compas'); H.deco(1100, 140, 'equerre'); H.deco(200, 1540, 'trousse');
  },
};
