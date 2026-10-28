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
//                      chaque affichage). Renvoie { el, libelle(texte), actif(bool) }. « Relancer » est grisé pendant les 2 s qui
//                      suivent la fin (le hub y jette tout `start` : GARDE_FIN), et la carte est calée en haut si elle déborde.
//   EF.relancable(ok, raison)   à chaque état : faux quand la relance ne peut pas aboutir (ex. moins de 2 participants et le
//                      serveur refuse sans rien dire) → bouton grisé, libellé remplacé par `raison` (« Il faut 2 joueurs »).
//   EF.caler(carte)    à rappeler si le jeu retouche la mise en page de sa carte APRÈS boutons() (Pong : podLayout).
//   opts.aChange()     facultatif, appelé quand body.fin ou le choix « Accueil » change : le client refait son resizeCanvas() et
//                      rebascule body.playing (la manette tactile disparaît à la fin → le plateau peut grandir sur téléphone).
//   quitterFin()       (export du module, pour la coque app.js) : le « ✕ Quitter » pendant la fin plein écran vaut « ⌂ Accueil »
//                      pour CE joueur — y compris pendant le ralenti, avant que la carte existe. Renvoie false hors fin plein écran
//                      (le ✕ envoie alors son `abort` habituel). Avant (02/10) : le ✕ restait visible à la fin mais `abort` n'agit
//                      qu'en partie (backToLobby des 8 serveurs) → on ne pouvait plus quitter.
//   Si « Accueil » a été choisi AVANT que la carte soit construite (✕ pendant le ralenti), boutons() rappelle aussitôt
//   l'`accueil` du jeu : la carte reste masquée au lieu de surgir dans la mise en page d'accueil.
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

let courant = null;                              // instance du jeu affiché (la dernière à avoir reçu un état) : cible du ✕ de la coque
export function quitterFin() { return courant ? courant.quitter() : false; }
// Musique (music.js) : à 'over', le morceau de partie reste tant que le joueur n'a pas choisi « Accueil » (ou ✕) ;
// ensuite c'est le morceau de menu, même si le serveur reste en 'over' jusqu'à la manche suivante.
const abonnes = [];
export function accueilChoisi() { return !!(courant && courant.accueilChoisi()); }
export function quandFinChange(fn) { abonnes.push(fn); }

const GARDE_MS = 2100;                           // hub.js jette tout `start` moins de 2 s (GARDE_FIN) après la fin : Relancer grisé d'ici là

export function createEcranFin(opts) {
  const aChange = opts && typeof opts.aChange === 'function' ? opts.aChange : null;
  let choixAccueil = false, fin = false, crochet = null;   // crochet : l'`accueil` du jeu, mémorisé au dernier boutons()
  let tFin = 0, gsPrec = '', relOk = true, relRaison = '', majRel = null;   // garde des 2 s · « Il faut 2 joueurs » · bouton affiché

  const enJeu = gs => gs === 'play' || gs === 'countdown' || gs === 'paused' || (gs === 'over' && !choixAccueil);
  const classe = () => {
    const b = typeof document !== 'undefined' ? document.body : null;
    if (b && b.classList) b.classList.toggle('fin', fin);
  };
  const maj = (nvFin, nvChoix) => {
    const ch = nvFin !== fin || nvChoix !== choixAccueil;
    const vientDeChoisir = nvChoix && !choixAccueil;
    fin = nvFin; choixAccueil = nvChoix; classe();
    if (ch && aChange) aChange();
    // Seul le CHOIX « Accueil » est signalé : sa remise à zéro vient d'un nouvel état (le jeu repasse alors lui-même
    // sa phase) ou d'un teardown, où re-pousser la musique du jeu quitté ramènerait son morceau de partie.
    if (vientDeChoisir) abonnes.forEach(fn => { try { fn(); } catch (e) {} });
  };

  const api = {
    enJeu,
    accueilChoisi: () => choixAccueil,
    suivre(gs) {
      courant = api;
      if (gs === 'over' && gsPrec !== 'over') tFin = Date.now();
      gsPrec = gs;
      if (gs !== 'over') { if (choixAccueil || fin) maj(false, false); }
      else maj(!choixAccueil, choixAccueil);
      return enJeu(gs);
    },
    accueil() { maj(false, true); },
    quitter() {                                    // ✕ de la coque : « Accueil » si la fin est en plein écran, sinon rien (false)
      if (!fin) return false;
      maj(false, true);
      if (crochet) crochet();
      return true;
    },
    relancable(ok, raison) {                       // le jeu dit à chaque état si « Relancer » peut aboutir (sinon : grisé + raison)
      ok = !!ok; raison = raison || '';
      if (ok === relOk && raison === relRaison) return;
      relOk = ok; relRaison = raison;
      if (majRel) majRel();
    },
    caler(carte) {                                 // contenu plus haut que la carte : lu depuis le haut (un flex CENTRÉ rogne son haut,
      if (carte && carte.scrollHeight > carte.clientHeight + 1) carte.style.justifyContent = 'flex-start';   // hors d'atteinte du défilement)
    },
    boutons(carte, o) {
      o = o || {};
      crochet = typeof o.accueil === 'function' ? o.accueil : null;
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
      const rel = mk('efRelancer', '', () => { if (o.relancer) o.relancer(); });
      const acc = mk('efAccueil', '⌂ Accueil', () => { maj(false, true); if (o.accueil) o.accueil(); });
      let base = o.libelle || 'Relancer', ext = true, garde = false;
      const sync = () => {
        rel.disabled = !ext || garde || !relOk;
        const t = !relOk && relRaison ? relRaison : '↻ ' + base;
        if (rel.textContent !== t) rel.textContent = t;
      };
      majRel = sync;
      const reste = tFin + GARDE_MS - Date.now();   // pas de ralenti (passé, « réduire les effets ») : le tap serait jeté sans signe
      if (reste > 0) { garde = true; setTimeout(() => { garde = false; sync(); }, reste); }
      sync();
      el.appendChild(rel); el.appendChild(acc);
      carte.appendChild(el);
      api.caler(carte);
      if (choixAccueil && crochet) crochet();      // « Accueil » déjà choisi (✕ pendant le ralenti) : la carte ne s'affiche pas
      return {
        el,
        libelle(txt) { base = txt; sync(); },
        actif(v) { ext = !!v; sync(); },
      };
    },
  };
  return api;
}
