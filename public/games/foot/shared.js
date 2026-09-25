// Constantes géométriques FOOT — partagées par le serveur (games/foot/server.js) ET le client (client.js).
// AR0 = côté de l'arène carrée à 2 joueurs (+7 % par joueur au-delà : le terrain paraît GRAND à peu de joueurs) ·
// MARGE = bande hors terrain (filets, panneaux) : le polygone est AJUSTÉ au cadre, il n'y a plus de tribunes vides ·
// PR = rayon d'un joueur · BR = rayon du ballon · POST_R = rayon d'un poteau ·
// GOAL0 / GOAL_SD = largeur de cage en fraction du côté (normale / prolongations).
export const AR0 = 720, MARGE = 34, PR = 15, BR = 8, POST_R = 4, GOAL0 = 0.36, GOAL_SD = 0.58;
// Terrains et objets : l'ORDRE fait foi des deux côtés (le snapshot transmet des indices).
export const TERRAINS = ['stade', 'boue', 'glace', 'flipper', 'tempete'];
export const ITEMS = ['turbo', 'canon', 'mur', 'geante', 'glu', 'inverse'];   // 3 bonus (pour soi) puis 3 malus (pour les adversaires)
