// MATCH EN N MANCHES — brique serveur COMMUNE aux 8 jeux (pur : aucun état global, aucune dépendance, aucun accès au hub).
// Une « manche » reste ce qu'elle est dans chaque jeu (un dernier debout, un but, une patate…) ; un « match » est une
// suite de manches gagnées dont la première équipe à `cible` manches gagnantes emporte le tout. Le score `p.score`
// de chaque joueur (déjà tenu par les jeux : +1 à tous les membres de l'équipe qui gagne la manche) est la seule donnée
// de match : ce module n'en crée pas d'autre, il décide quand le match est fini et fabrique l'instantané.
//
//   const match = creerMatch();                       // cible = 1 : pas de match, comportement historique
//   match.cible                                       // 1 | 2 | 3 | 5 (CIBLES) — 1 = manche simple
//   match.changer(players)                            // cycle 1 → 2 → 3 → 5 → 1 ; remet les scores à 0 (message `match`)
//   match.regler(n, players)                          // fixe la cible (entier 1..9) — pour Pong (roundsTarget) / alias `wintarget`
//   match.debutManche(players)                        // AU DÉMARRAGE d'une manche (startGame) ; true = nouveau match
//   match.apresManche(players, winner)                // EN FIN de manche, APRÈS le `p.score++` de l'équipe gagnante ; true = match gagné
//   match.etat(players)                               // champ `match` du snapshot : { n, f, w, bm, r } ou null (cible 1)
//   match.gagne / match.gagnant                       // match terminé ? / équipe qui l'a gagné (-1 sinon) — pour stats.match
//   match.reinit()                                    // retour à zéro (create() du jeu, comme `round = 0`)
//
// Instantané `etat()` (null — PAS undefined : un champ absent garde l'ancienne valeur côté client — quand cible = 1) :
//   n  = cible (manches à gagner)            f  = 1 si le match est gagné, sinon 0
//   w  = équipe gagnante du match, ou -1     bm = équipes à cible-1 manches (« balle de match »), [] une fois le match gagné
//   r  = numéro de la manche courante DANS le match (1, 2, 3…) — pour « Premier à 3 · manche 4 »
//
// Règles (vérifiées par test/fins-de-manche.mjs, bloc « match ») :
//   • participants = les joueurs pour lesquels `opts.participant(p)` est vrai (défaut `p.playing`) ; équipe = `opts.team(p)` (défaut `p.team`).
//   • apresManche : si cible > 1, winner >= 0 et un membre de l'équipe gagnante a `score >= cible` → match gagné (`gagnant = winner`).
//     Une manche nulle (winner < 0) ne fait jamais gagner le match.
//   • debutManche : si le match précédent est gagné (ou si la cible vient de changer), TOUS les `p.score` repassent à 0 et un
//     nouveau match commence (r = 1) ; sinon la manche suivante poursuit le match (r + 1).
//   • changer/regler ne touchent à rien en dehors du lobby/over : le contrôle `editable()` reste dans le jeu (comme `mode`, `bots`).
//
// INTÉGRATION (jeu <id>, games/<id>/server.js) :
//   import { creerMatch } from '../match.js';
//   const match = creerMatch();                                          // dans create(), à côté des autres réglages
//   // startGame() : AVANT de choisir les équipes/positions, juste après la validation du nombre de joueurs
//   match.debutManche(players);
//   // endRound() : après classerManche et le `p.score++` habituel de l'équipe gagnante
//   if (winner >= 0) { players.forEach(p => { if (p.playing && p.team === winner) p.score++; }); match.apresManche(players, winner); }
//   // snapshot() : champ `match` (null quand cible = 1) et, dans stats, `match: match.gagne`
//   match: match.etat(players), stats: gameState === 'over' ? { …, match: match.gagne } : null,
//   // onMessage : le hub a déjà refusé les non-game-masters (GM_ONLY contient 'match')
//   else if (m.t === 'match') { if (editable()) match.changer(players); }
//   // côté client : public/match.js (bouton, texte, balle de match, titre de fin) et public/ecran-fin.js (Relancer / Accueil)

export const CIBLES = [1, 2, 3, 5];
export const CIBLE_MAX = 9;

export function creerMatch() {
  let cible = 1, gagne = false, gagnant = -1, manche = 0, neuf = false;   // neuf : la cible a changé → les scores seront remis à 0 au prochain départ

  const zero = players => { if (players) for (const p of players) p.score = 0; };
  const nouveau = () => { gagne = false; gagnant = -1; manche = 0; };
  const equipe = (o, p) => (o && o.team ? o.team(p) : p.team);
  const joue = (o, p) => (o && o.participant ? o.participant(p) : p.playing);

  return {
    get cible() { return cible; },
    get gagne() { return gagne; },
    get gagnant() { return gagnant; },
    get manche() { return manche; },
    reinit() { cible = 1; neuf = false; nouveau(); },
    changer(players) {                       // 1 → 2 → 3 → 5 → 1 (une cible hors liste, ex. 4 posée par regler, passe à la suivante)
      const i = CIBLES.indexOf(cible);
      const sui = i >= 0 ? CIBLES[(i + 1) % CIBLES.length] : (CIBLES.find(c => c > cible) || CIBLES[0]);
      return this.regler(sui, players);
    },
    regler(n, players) {                     // fixe la cible (entier 1..CIBLE_MAX) ; tout changement repart d'un match neuf, scores à 0
      n = Math.round(+n);
      if (!(n >= 1)) n = 1;
      if (n > CIBLE_MAX) n = CIBLE_MAX;
      if (n !== cible) { cible = n; neuf = true; nouveau(); zero(players); }
      return cible;
    },
    debutManche(players) {                   // true = un nouveau match commence avec cette manche
      let debut = false;
      if (gagne || neuf || manche === 0) { if (gagne || neuf) zero(players); nouveau(); neuf = false; debut = true; }
      manche++;
      return debut;
    },
    apresManche(players, winner, opts) {     // à appeler APRÈS le p.score++ de l'équipe gagnante ; true = match gagné
      if (cible <= 1 || !(winner >= 0) || gagne) return false;
      for (const p of players) {
        if (joue(opts, p) && equipe(opts, p) === winner && (p.score | 0) >= cible) { gagne = true; gagnant = winner; return true; }
      }
      return false;
    },
    etat(players, opts) {                    // champ `match` du snapshot — null (jamais undefined) quand cible = 1
      if (cible <= 1) return null;
      const bm = [];
      if (!gagne && players) {
        for (const p of players) {
          if (!joue(opts, p) || (p.score | 0) !== cible - 1) continue;
          const t = equipe(opts, p);
          if (bm.indexOf(t) < 0) bm.push(t);
        }
        bm.sort((a, b) => a - b);
      }
      return { n: cible, f: gagne ? 1 : 0, w: gagne ? gagnant : -1, bm, r: Math.max(1, manche) };
    },
  };
}
