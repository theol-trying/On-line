// ÉCRAN DE FIN PLEIN CADRE — brique CLIENT commune aux 8 jeux.
// Avant : chaque client faisait `inGame = gs === 'play' || 'countdown' || 'paused'` ; à 'over' la page repassait donc en
// mise en page d'accueil (menus, vitrine) et le ralenti / le podium s'affichaient en petit. Maintenant la fin RESTE en
// plein écran (body.playing) jusqu'à ce que le joueur choisisse « ⌂ Accueil », et la carte de fin propose deux grands
// boutons : « ↻ Relancer » (l'action Rejouer du jeu) et « ⌂ Accueil ». Le choix est PAR JOUEUR (côté client) :
// les autres restent à l'écran de fin ; une nouvelle manche (countdown/play) ramène tout le monde en plein écran.
//
//   const EF = createEcranFin({ aChange })        un seul exemplaire par client (singleton du module de jeu)
//   EF.enJeu(gs)       vrai en 'play' / 'countdown' / 'paused', ET en 'over' tant que le joueur n'a pas choisi « Accueil » (pur)
//   EF.suivre(gs)      à appeler à CHAQUE état reçu, avant d'utiliser enJeu : remet le choix à zéro dès que gs != 'over' (manche
//                      lancée, retour au lobby…), pose / retire body.fin (fin de manche en plein écran), renvoie enJeu(gs)
//   EF.accueil()       le joueur choisit l'accueil : body.fin retiré, enJeu('over') devient faux jusqu'à la manche suivante
//   EF.boutons(carteFin, { relancer, accueil, libelle })
//                      insère en bas de la carte de fin (élément .endscreen) un bloc `.efBtns` avec 2 grands boutons tactiles :
//                      « ↻ <libelle> » (défaut « Relancer » ; « Manche suivante » entre deux manches d'un match, « Nouveau match »
//                      après un match gagné) et « ⌂ Accueil ». `relancer()` = l'action Rejouer du jeu (typiquement
//                      send({ t: 'start' })) ; `accueil()` (facultatif) est appelé APRÈS EF.accueil(), pour que le client
//                      relance sa mise en page (cf. aChange). Remplace un bloc `.efBtns` déjà présent (la carte est réécrite à
//                      chaque affichage). Renvoie { el, libelle(texte), actif(bool) }.
//   opts.aChange()     facultatif, appelé quand body.fin ou le choix « Accueil » change : le client refait son resizeCanvas() et
//                      rebascule body.playing (la manette tactile disparaît à la fin → le plateau peut grandir sur téléphone).
//
// Les clics sur les boutons NE REMONTENT PAS à la carte (qui relance déjà la partie au clic n'importe où) ; leur appui souris ne
// prend pas le focus (sinon Espace / Entrée re-cliqueraient le bouton). Tout est en DOM + classes CSS (style.css : .efBtns /
// body.playing.fin) — iOS 15 sûr : pas de ?. ni ??, pas de gap flex, -webkit-touch-callout:none, user-select none.
//
// INTÉGRATION (public/games/<id>/client.js) :
//   import { createEcranFin } from '../../ecran-fin.js';
//   const EF = createEcranFin({ aChange: () => { applyPlaying(snap && snap.gs); resizeCanvas(); } });
//   function applyPlaying(gs) {                                  // remplace le `inGame = …` historique
//     const inGame = EF.enJeu(gs);
//     if (inGame !== inGamePrev) { inGamePrev = inGame; document.body.classList.toggle('playing', inGame); resizeCanvas(); }
//   }
//   // onState(m) :                const inGame = EF.suivre(m.gs);  (puis le toggle 'playing' ci-dessus, avec inGame)
//   // showEndscreen(m), après endEl.innerHTML = … :
//   EF.boutons(endEl, { relancer: () => { unlockAudio(); send({ t: 'start' }); },
//                       libelle: m.match && m.match.f ? 'Nouveau match' : (m.match ? 'Manche suivante' : 'Relancer'),
//                       accueil: () => { endEl.classList.add('hidden'); } });
//   // le ralenti et le podium restent au-dessus de la carte, inchangés ; un spectateur voit les mêmes boutons
//   // (Relancer n'a d'effet que pour qui peut lancer — le serveur filtre). teardown() : EF.accueil() inutile,
//   // le choix est remis à zéro au prochain état hors 'over'.

export function createEcranFin(opts) {
  const aChange = opts && typeof opts.aChange === 'function' ? opts.aChange : null;
  let choixAccueil = false, fin = false;

  const enJeu = gs => gs === 'play' || gs === 'countdown' || gs === 'paused' || (gs === 'over' && !choixAccueil);
  const classe = () => {
    const b = typeof document !== 'undefined' ? document.body : null;
    if (b && b.classList) b.classList.toggle('fin', fin);
  };
  const maj = (nvFin, nvChoix) => {
    const ch = nvFin !== fin || nvChoix !== choixAccueil;
    fin = nvFin; choixAccueil = nvChoix; classe();
    if (ch && aChange) aChange();
  };

  return {
    enJeu,
    suivre(gs) {
      if (gs !== 'over') { if (choixAccueil || fin) maj(false, false); }
      else maj(!choixAccueil, choixAccueil);
      return enJeu(gs);
    },
    accueil() { maj(false, true); },
    boutons(carte, o) {
      o = o || {};
      const vieux = carte.querySelectorAll ? carte.querySelectorAll('.efBtns') : [];
      for (let i = 0; i < vieux.length; i++) if (vieux[i].parentNode) vieux[i].parentNode.removeChild(vieux[i]);
      const el = document.createElement('div'); el.className = 'efBtns';
      const mk = (cls, txt, fn) => {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'efBtn ' + cls; b.textContent = txt;
        b.addEventListener('mousedown', e => { e.preventDefault(); });          // pas de focus : Espace / Entrée ne re-cliquent pas
        b.addEventListener('pointerdown', e => { e.stopPropagation(); });
        let t0 = 0;
        b.addEventListener('click', e => {
          e.stopPropagation(); e.preventDefault();
          const now = Date.now(); if (now - t0 < 400) return; t0 = now;        // double-tape : une seule action
          if (b.blur) b.blur();
          fn();
        });
        return b;
      };
      const rel = mk('efRelancer', '↻ ' + (o.libelle || 'Relancer'), () => { if (o.relancer) o.relancer(); });
      const acc = mk('efAccueil', '⌂ Accueil', () => { maj(false, true); if (o.accueil) o.accueil(); });
      el.appendChild(rel); el.appendChild(acc);
      carte.appendChild(el);
      return {
        el,
        libelle(txt) { rel.textContent = '↻ ' + txt; },
        actif(v) { rel.disabled = !v; },
      };
    },
  };
}
