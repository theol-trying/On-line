// Fin de manche COMMUNE aux 7 jeux : une seule vérité pour les places (et donc pour le podium, le classement
// enregistré et les tests). Module pur : aucun état global, aucune dépendance, aucun accès au hub.
//
//   classerManche(players, winner, opts) — écrit `p.place` (1 = vainqueur) sur chaque participant et renvoie
//   { podium, nul, participants } (podium = participants triés par place puis par siège).
//
// Règles (toutes vérifiées par test/fins-de-manche.mjs) :
//   • participants = les joueurs pour lesquels `opts.participant(p)` est vrai (défaut : `p.playing`). Les autres
//     ne sont JAMAIS touchés (un partant de Pong garde sa place 0 / son ancienne valeur).
//   • winner >= 0 : TOUS les membres de l'équipe gagnante ont la place 1, PERSONNE d'autre. Les autres sont classés
//     à la suite (1 + nombre de vainqueurs), du dernier éliminé au premier ; morts au même tick = même place.
//   • winner < 0 (nul) : les survivants — ou, en cas d'hécatombe, les derniers morts du même tick — partagent la
//     meilleure place ; avec `opts.score`, ce sont TOUS ceux qui ont le meilleur score (ex æquo en tête). Jamais une
//     place 1 isolée : si le groupe de tête ne compte qu'une seule équipe alors que d'autres ont joué, il est
//     fusionné avec le groupe suivant (garde-fou : ne se produit pas quand l'appelant décide le nul selon les
//     règles du jeu).
//   • places « à la compétition » : ex æquo = même place, la suivante saute (1, 2, 2, 4).
//
// Ordre de classement (du meilleur au moins bon) : `opts.score` (décroissant, facultatif) → en vie → mort le plus
// tard (`opts.elim`, défaut `p.elimTick`). Deux joueurs à clés identiques sont ex æquo.
//
// opts : { participant(p), team(p), alive(p), elim(p), score(p) } — tous facultatifs.
//   score : ex. Snake « course » (score puis survie), Pong mort subite par le temps (vies restantes),
//           Foot filet de 6 min (vies de l'équipe, 0 pour un éliminé).

const num = v => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

export function classerManche(players, winner, opts) {
  const o = opts || {};
  const isPart = o.participant || (p => p.playing);
  const teamOf = o.team || (p => p.team);
  const isAlive = o.alive || (p => p.alive);
  const elimOf = o.elim || (p => p.elimTick);
  const parts = players.filter(isPart);
  if (!parts.length) return { podium: [], nul: true, participants: 0 };
  // clé de tri calculée UNE fois par joueur (pas d'allocation dans le comparateur)
  const key = new Map();
  for (const p of parts) {
    const al = isAlive(p) ? 1 : 0;
    key.set(p, { sc: o.score ? num(o.score(p)) : 0, al, el: al ? 0 : num(elimOf(p)) });
  }
  const cmp = (a, b) => { const x = key.get(a), y = key.get(b); return (y.sc - x.sc) || (y.al - x.al) || (y.el - x.el) || (a.seat - b.seat); };
  const same = (a, b) => { const x = key.get(a), y = key.get(b); return x.sc === y.sc && x.al === y.al && x.el === y.el; };

  const champs = typeof winner === 'number' && winner >= 0 ? parts.filter(p => teamOf(p) === winner) : [];
  const nul = !champs.length;                        // winner < 0, ou équipe gagnante sans participant (incohérence : traité en nul)
  const reste = parts.filter(p => !champs.includes(p)).sort(cmp);
  for (const p of champs) p.place = 1;
  let prochaine = champs.length + 1;

  // groupes d'ex æquo, du meilleur au moins bon
  const groupes = [];
  for (const p of reste) {
    const g = groupes[groupes.length - 1];
    if (g && same(g[0], p)) g.push(p); else groupes.push([p]);
  }
  let gi = 0;
  if (nul) {                                          // le groupe de tête partage la place 1, jamais une place 1 isolée
    const tete = groupes.length ? groupes[0].slice() : [];
    gi = 1;
    if (o.score) while (gi < groupes.length && key.get(groupes[gi][0]).sc === key.get(tete[0]).sc) { for (const p of groupes[gi]) tete.push(p); gi++; }   // score ex æquo en tête = même groupe
    const equipes = new Set(tete.map(teamOf));
    while (equipes.size < 2 && gi < groupes.length) { for (const p of groupes[gi]) { tete.push(p); equipes.add(teamOf(p)); } gi++; }
    for (const p of tete) p.place = 1;
    prochaine = tete.length + 1;
  }
  for (; gi < groupes.length; gi++) {
    for (const p of groupes[gi]) p.place = prochaine;
    prochaine += groupes[gi].length;
  }
  const podium = parts.slice().sort((a, b) => (a.place - b.place) || (a.seat - b.seat));
  return { podium, nul, participants: parts.length };
}
