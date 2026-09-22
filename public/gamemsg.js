// Messages de bonus / malus — surcouche DOM partagée par les 5 jeux.
//
// Retour de test : « les icônes ne sont pas forcément claires ». Un ramassage doit donc se
// DIRE, pas seulement se dessiner. Deux placements volontairement distincts :
//
//   msgPerso()  — ce que TU viens de ramasser. Bandeau lisible placé en HAUT du cadre et
//                 non au centre : en Pong ou en Tanks, le centre est précisément là où se
//                 joue l'action.
//   msgGlobal() — un effet qui touche TOUT LE MONDE. Bande fine collée au bord supérieur,
//                 hors de la zone de jeu, pour ne gêner personne — et surtout pas la ou les
//                 personnes concernées, qui ont justement besoin de voir.
//
// DOM et non canvas : texte net à toutes les résolutions, zéro coût de rendu par frame, et
// le style suit automatiquement l'identité du jeu actif (variables CSS de `body.game-*`).
//
// Sécurité : le libellé est posé en textContent. Ces messages ne doivent JAMAIS contenir
// autre chose que des constantes du client — jamais un pseudo ou quoi que ce soit du réseau.

let wrapEl = null, persoEl = null, globalEl = null;
let tPerso = 0, tGlobal = 0;

function creer(cls) {
  const el = document.createElement('div');
  el.className = 'gmsg ' + cls;
  el.setAttribute('aria-live', 'polite');
  wrapEl.appendChild(el);
  return el;
}

/** À appeler dans init() du jeu, avec le conteneur du canvas (`.canvas-wrap`). */
export function initGameMsg(wrap) {
  wrapEl = wrap || null;
  persoEl = globalEl = null;
  clearTimeout(tPerso); clearTimeout(tGlobal);
  if (!wrapEl) return;
  wrapEl.querySelectorAll('.gmsg').forEach(e => e.remove());   // module rechargé : on repart propre
  persoEl = creer('gmsg-perso');
  globalEl = creer('gmsg-global');
}

function afficher(el, icone, texte, opts, duree, timerRef) {
  if (!el) return 0;
  const o = opts || {};
  el.textContent = '';
  const i = document.createElement('span');
  i.className = 'gmsg-i'; i.textContent = icone || '';
  const t = document.createElement('span');
  t.className = 'gmsg-t'; t.textContent = texte || '';
  el.appendChild(i); el.appendChild(t);
  el.classList.toggle('bad', !!o.bad);
  if (o.color) el.style.setProperty('--gmsg-col', o.color); else el.style.removeProperty('--gmsg-col');
  el.classList.remove('on');
  void el.offsetWidth;                       // redémarre l'animation même si le message s'enchaîne
  el.classList.add('on');
  clearTimeout(timerRef);
  return setTimeout(() => el.classList.remove('on'), duree);
}

/** Ce que le joueur local vient de ramasser. `opts.bad` = malus (teinte rouge). */
export function msgPerso(icone, texte, opts) {
  tPerso = afficher(persoEl, icone, texte, opts, 1700, tPerso);
}

/** Effet qui concerne tout le monde. Reste hors de la zone de jeu. */
export function msgGlobal(icone, texte, opts) {
  tGlobal = afficher(globalEl, icone, texte, opts, 2300, tGlobal);
}

export function clearGameMsg() {
  clearTimeout(tPerso); clearTimeout(tGlobal);
  if (persoEl) persoEl.classList.remove('on');
  if (globalEl) globalEl.classList.remove('on');
}
