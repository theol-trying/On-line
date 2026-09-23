// Taille du plateau — logique PARTAGÉE par les 5 jeux (chacun l'appelait avec sa propre formule,
// elles divergeaient pour rien). Deux régimes :
//
//  · mode « plateau plein écran » (body.playing.dock, piloté par app.js sur grand écran) : le shell
//    positionne la colonne centrale en `fixed`, on la MESURE. Le plateau occupe alors toute la
//    hauteur utile, chat et liste des joueurs occupant les colonnes latérales — qui, elles, ne sont
//    ouvertes que si l'écran est assez large pour ne rien coûter au plateau (cf. app.js).
//  · sinon (lobby, ou écran trop étroit) : formule historique en fractions de fenêtre.
//
// `side` = place à réserver DANS la colonne centrale pour des commandes latérales (les flèches ▲▼
// de Pong sur desktop). Zéro pour les jeux qui n'en ont pas.
export function arenaSize(o) {
  o = o || {};
  const max = o.max || 760;
  // Sous 600 px les flèches passent SOUS le plateau (cf. style.css) : plus rien à réserver sur les côtés.
  const side = window.innerWidth > 600 ? (o.side || 0) : 0;
  const playing = document.body.classList.contains('playing');
  if (playing && document.body.classList.contains('dock')) {
    const el = document.querySelector('.game-root:not(.hidden) .stage');
    if (el) {
      const r = el.getBoundingClientRect();
      // Garde-fou : si la colonne n'est pas encore posée (0×0), on retombe sur la formule fenêtre.
      if (r.width > 80 && r.height > 80)
        return Math.max(280, Math.min(r.width - side, r.height, o.maxDock || 1200));
    }
  }
  const h = playing ? (o.hPlay || 0.82) : (o.hLobby || 0.62);
  return Math.max(280, Math.min(window.innerWidth * 0.96 - side, window.innerHeight * h, max));
}
