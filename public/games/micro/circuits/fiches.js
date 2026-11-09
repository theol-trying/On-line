// FICHES des circuits de Micro Machines : le strict nécessaire pour les nommer (bouton Circuit, écran-titre, aide, écran de
// fin) et ranger leurs records (v), dans l'ordre du bouton « Circuit ». Le navigateur ne charge QUE ce fichier au départ, puis
// le circuit joué (./<id>.js) à la demande ; le serveur, la galerie et les outils chargent tout par ./index.js.
// Chaque fiche recopie id, nom, emoji, sous et v de ./<id>.js : outils/verifier-circuits.mjs (npm test) le contrôle.
export default [
  { id: 'dejeuner', nom: 'Petit-déjeuner', emoji: '🥣', sous: 'Grande table familiale · bol géant, chicane de sucres, café renversé, souris mécanique', v: 2 },
  { id: 'bureau', nom: 'Bureau d\'écolier', emoji: '✏️', sous: 'Copie à grands carreaux · escargot de crayons, règles turbo, encre et colle', v: 2 },
  { id: 'billard', nom: 'Billard', emoji: '🎱', sous: 'Feutre vert · grandes courbes, billes qui roulent, poches qui avalent', v: 2 },
  { id: 'piste', nom: 'Circuit-jouet', emoji: '🏁', sous: 'Moquette du salon · piste orange à rails, ligne des stands, tunnel', v: 2 },
  { id: 'etabli', nom: 'Établi du garage', emoji: '🔧', sous: 'Contreplaqué d\'atelier · mètre ruban turbo, étau, huile, ponceuse et écrou fou', v: 2 },
  { id: 'plateau', nom: 'Jeu de société', emoji: '🎲', sous: 'Jeu de l\'oie géant · serpentin de cases, dés, pions qui renvoient, toupie folle', v: 2 },
  { id: 'huit', nom: 'Circuit en 8', emoji: '♾️', sous: 'Tapis de jeu · croisement au milieu, rivière, ferme et tracteur', v: 2 },
  { id: 'jardin', nom: 'Jardin', emoji: '🌻', sous: 'Allées du potager · tuyau d\'arrosage, flaques, tondeuse robot' },
  { id: 'bain', nom: 'Salle de bain', emoji: '🛁', sous: 'Carrelage bleu · savon glissant, mousse, canard en plastique' },
  { id: 'chambre', nom: 'Chambre d\'enfant', emoji: '🧸', sous: 'Dalles en mousse · train électrique, briques, billes' },
  { id: 'chantier', nom: 'Bac à sable', emoji: '🚧', sous: 'Chantier miniature · épingles, cônes, pelleteuse et bétonnière' },
  { id: 'noel', nom: 'Table de Noël', emoji: '🎄', sous: 'Nappe du réveillon · couronne autour du sapin, boules qui renvoient, guirlande lumineuse' },
];
