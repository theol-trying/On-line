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
      const r = el.getBoundingClientRect(), cs = window.getComputedStyle(el);
      // La colonne va du haut au bas de l'écran ; ses marges internes gardent le plateau décollé des bords.
      const h = r.height - (parseFloat(cs.paddingTop) || 0) - (parseFloat(cs.paddingBottom) || 0);
      // Garde-fou : si la colonne n'est pas encore posée (0×0), on retombe sur la formule fenêtre.
      if (r.width > 80 && h > 80)
        return Math.max(280, Math.min(r.width - side, h, o.maxDock || 1400));
    }
  }
  const h = playing ? (o.hPlay || 0.82) : (o.hLobby || 0.62);
  // Téléphone en partie : on déduit la hauteur RÉELLE des commandes (manette ou joystick, carte du
  // joueur, bandeau des boutons du haut). Une fraction fixe de l'écran ne suffisait plus : le joystick
  // (189 px) faisait déborder Pong sous l'écran d'un iPhone SE (relevé par la revue du 23/09).
  // Plancher abaissé à 200 px : un plateau un peu plus petit vaut mieux qu'une manette coupée.
  if (playing && window.innerWidth <= 600) {
    const racine = document.querySelector('.game-root:not(.hidden)');
    let hCmd = 0;
    if (racine) racine.querySelectorAll('.gpad, .stage > .joyzone, .stage > div:not(.canvas-wrap)').forEach(el => {
      if (el.offsetHeight > hCmd) hCmd = el.offsetHeight;
    });
    const hLibre = window.innerHeight - 54 - hCmd - 44 - 20;   // bandeau haut · commandes · sa carte · marges
    return Math.max(200, Math.min(window.innerWidth * 0.96, window.innerHeight * h, hLibre, max));
  }
  return Math.max(280, Math.min(window.innerWidth * 0.96 - side, window.innerHeight * h, max));
}
