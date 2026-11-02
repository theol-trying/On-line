// Circuit « plateau » de Micro Machines — définition PARTAGÉE serveur / client (géométrie, obstacles, zones, décor).
// Format : voir l'en-tête de ../shared.js ; dessins propres au circuit (propriété `dessin`) : voir ../rendu.js.
export default {
  id: 'plateau', nom: 'Jeu de société', emoji: '🎲', sous: 'Plateau de jeu · dés, pions qui renvoient, toupie folle',
  w: 2600, h: 1700, surf: 'plateau', edge: 'chute', table: { x0: 60, y0: 60, x1: 2540, y1: 1640, r: 60 }, W: 70,
  pts: [[600, 1380], [1400, 1390], [2100, 1360], [2380, 1120], [2200, 880], [1750, 860], [1500, 760], [1450, 560], [1250, 420], [800, 320], [400, 400], [250, 750], [300, 1100]],
  mobs: [{ type: 'toupie', cer: [1000, 1240, 150], r: 26, per: 6 }],   // toupie qui tourne en rond et mord sur la ligne droite
  boxes: [0.2, 0.56, 0.8],
  make(H) {
    H.rock(2050, 620, 46, 'de'); H.rock(1850, 1150, 40, 'de'); H.rock(700, 900, 44, 'de');
    H.rock(1100, 620, 34, 'sablier');
    H.rockAt(0.455, 0.6, 20, 'pion'); H.rockAt(0.485, -0.6, 20, 'pion');          // pions : bumpers dans le S du milieu (loin du bord)
    H.rockAt(0.66, 0.6, 20, 'pion'); H.rockAt(0.69, -0.6, 20, 'pion');
    H.zoneAt(0.86, 0.3, 80, 56, 'sucre');                 // miettes de biscuit
    H.deco(1400, 1050, 'cartes'); H.deco(2350, 200, 'billets'); H.deco(160, 1560, 'gobelet');
  },
};
