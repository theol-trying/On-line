// Constantes PATATE CHAUDE — partagées par le serveur (games/patate/server.js) ET le client (client.js).
// AR0 = côté du cadre carré à 2 joueurs (l'arène RONDE y est inscrite, MARGE de nappe tout autour ; +7 % par joueur
// au-delà de 2 : plus grande impression d'espace à peu de joueurs) · PR = rayon d'un joueur · BR = rayon de la patate.
// FUSE_MIN / FUSE_MAX = bornes (secondes) de la mèche cachée · IMMUNE_S = durée pendant laquelle un donneur ne peut pas la
// recevoir en retour. ITEMS : l'ORDRE fait foi des deux côtés (le snapshot transmet l'indice `k`).
export const AR0 = 720, MARGE = 30, PR = 16, BR = 11, TICK_HZ = 30, FUSE_MIN = 12, FUSE_MAX = 25, IMMUNE_S = 1;
export const ITEMS = ['bouclier', 'turbo'];
export const scaleFor = n => 1 + 0.07 * (n - 2);
