// Constantes géométriques FOOT — partagées par le serveur (games/foot/server.js) ET le client (client.js).
// AR0 = côté de l'arène carrée à 2 joueurs (elle grandit de 10 % par joueur au-delà, comme le Sumo) ·
// PITCH = rayon du terrain polygonal en fraction de l'arène · PR = rayon d'un joueur · BR = rayon du ballon ·
// POST_R = rayon d'un poteau · GOAL0 / GOAL_SD = largeur de cage en fraction du côté (normale / mort subite).
export const AR0 = 600, PITCH = 0.44, PR = 15, BR = 8, POST_R = 4, GOAL0 = 0.42, GOAL_SD = 0.62;
