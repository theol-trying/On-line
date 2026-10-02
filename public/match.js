// MATCH EN N MANCHES — brique CLIENT commune aux 8 jeux (pendant de games/match.js côté serveur).
// Tout ce qui est partagé : le bouton du game master, le texte du HUD, l'annonce « balle de match », le titre de fin et
// les pastilles de manches gagnées. Aucune dépendance, ES module, iOS 15 sûr (pas de ?. ni ??, canvas : arc/fill seulement).
//
// L'instantané réseau est le champ `match` du snapshot de chaque jeu (cf. games/match.js) :
//   null                          manche simple (cible 1) — RIEN à afficher
//   { n, f, w, bm, r }            n = manches à gagner · f = 1 si le match est gagné · w = équipe gagnante du match (-1 sinon)
//                                 bm = équipes à n-1 manches (« balle de match ») · r = numéro de la manche dans le match
//
//   boutonMatch(bar, send)        crée (ou retrouve) le bouton `.gm` « 🏆 Manche simple » / « 🏆 Premier à 3 » dans la barre
//                                 `bar` (élément .bar du jeu) ; un clic envoie { t: 'match' } (le hub refuse les non-GM, et
//                                 `body.not-gm button.gm` le grise déjà). Renvoie { el, maj(snap, gs) } :
//                                 maj(m.match, m.gs) à CHAQUE état — texte du bouton, grisé hors lobby/over (gs omis = inchangé).
//                                 Appelable à chaque init() du jeu (module singleton) : le bouton existant est réutilisé et son
//                                 gestionnaire REMPLACÉ (onclick), jamais cumulé.
//   texteMatch(snap)              « Premier à 3 · manche 4 » ('' si pas de match ; « … · terminé » une fois gagné)
//   balleDeMatch(snap, nomEquipe) « BALLE DE MATCH pour Alice ! » ('' si pas de balle de match) ; nomEquipe = fonction
//                                 (équipe) → nom, ou tableau de noms indexé par équipe. À annoncer au décompte
//                                 (msgGlobal / callouts), UNE fois par manche.
//   titreFin(snap, nomVainqueur, scores)
//                                 → { titre, sous, qui } : titre « VICTOIRE DU MATCH » (match gagné) | « Manche gagnée »
//                                 | « Manche nulle » (pas de vainqueur) ; sous « 2 – 1 · premier à 3 » (scores = tableau
//                                 de nombres, le plus haut d'abord ou non : trié ici ; omis → seulement « premier à 3 ») ;
//                                 qui = nomVainqueur tel quel. Hors match (snap null) : titre '' — le jeu garde le sien.
//   pastilles(ctx, x, y, score, cible, couleur, k)
//                                 dessine `cible` petits ronds (pleins = manches gagnées) à partir de x (bord gauche), y =
//                                 centre vertical ; k = échelle (1 = rond de 4 px de rayon, 2 sur un HUD canvas lisible au
//                                 téléphone). Renvoie la largeur dessinée (0 si cible <= 1).
//   pastillesTexte(score, cible)  « ●●○ » pour une carte HUD en DOM (à colorer en CSS) ; '' si cible <= 1
//
// TOUS les textes renvoyés sont du TEXTE BRUT : les noms viennent du réseau, l'appelant les échappe (esc) s'il les
// injecte en innerHTML ; msgGlobal / textContent n'ont rien à faire.
//
// INTÉGRATION (public/games/<id>/client.js) :
//   import { boutonMatch, texteMatch, balleDeMatch, titreFin, pastilles } from '../../match.js';
//   // init() : après avoir retrouvé la barre
//   matchBtn = boutonMatch($('smBar'), send);                         // ou root.querySelector('.bar')
//   // onState(m) :
//   matchBtn.maj(m.match, m.gs);
//   const chip = texteMatch(m.match);                                  // chip du HUD ('' = masquée)
//   if (m.gs === 'countdown' && m.count === 3) { const b = balleDeMatch(m.match, t => nomEquipe(t)); if (b) msgGlobal(b); }
//   // carte de fin :
//   const T = titreFin(m.match, nomVainqueur, m.players.filter(p => p.playing).map(p => p.score));
//   const titre = T.titre || monTitreHabituel;                         // T.sous en sous-titre (.emeta)
//   // carte joueur (canvas) :  pastilles(ctx, x, y, p.score, m.match.n, couleurDuSiege, 1.5);

const num = v => (typeof v === 'number' && isFinite(v) ? v : 0);
const actif = snap => !!(snap && num(snap.n) > 1);

export function texteMatch(snap) {
  if (!actif(snap)) return '';
  let t = 'Premier à ' + snap.n;
  if (snap.f) return t + ' · terminé';
  if (num(snap.r) > 0) t += ' · manche ' + snap.r;
  return t;
}

export function balleDeMatch(snap, nomEquipe) {
  if (!actif(snap) || snap.f || !snap.bm || !snap.bm.length) return '';
  const nom = t => {
    let s = typeof nomEquipe === 'function' ? nomEquipe(t) : (nomEquipe ? nomEquipe[t] : '');
    if (s === undefined || s === null || s === '') s = 'Équipe ' + (t + 1);
    return '' + s;
  };
  const n = snap.bm.length;
  if (n === 1) return 'BALLE DE MATCH pour ' + nom(snap.bm[0]) + ' !';
  if (n === 2) return 'BALLE DE MATCH pour ' + nom(snap.bm[0]) + ' et ' + nom(snap.bm[1]) + ' !';
  return 'BALLE DE MATCH pour ' + n + ' équipes !';
}

export function titreFin(snap, nomVainqueur, scores) {
  const qui = nomVainqueur ? '' + nomVainqueur : '';
  if (!actif(snap)) return { titre: '', sous: '', qui };
  let sous = '';
  if (scores && scores.length) {
    const s = Array.prototype.slice.call(scores).map(num).sort((a, b) => b - a);
    sous = s.slice(0, 4).join(' – ') + ' · ';
  }
  sous += 'premier à ' + snap.n;
  return { titre: snap.f ? 'VICTOIRE DU MATCH' : (qui ? 'Manche gagnée' : 'Manche nulle'), sous, qui };
}

export function pastillesTexte(score, cible) {
  cible = Math.round(num(cible));
  if (cible <= 1) return '';
  const g = Math.max(0, Math.min(cible, Math.round(num(score))));
  let s = '';
  for (let i = 0; i < cible; i++) s += i < g ? '●' : '○';
  return s;
}

export function pastilles(ctx, x, y, score, cible, couleur, k) {
  cible = Math.round(num(cible));
  if (cible <= 1 || cible > 12) return 0;
  k = k > 0 ? k : 1;
  const r = 4 * k, pas = r * 2 + 3 * k, g = Math.max(0, Math.min(cible, Math.round(num(score))));
  ctx.save();
  ctx.lineWidth = Math.max(1, 1.4 * k);
  for (let i = 0; i < cible; i++) {
    const cx = x + r + i * pas;
    ctx.beginPath(); ctx.arc(cx, y, r, 0, Math.PI * 2);
    if (i < g) {
      ctx.fillStyle = couleur; ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.stroke();      // liseré clair : le rond plein se détache sur toute couleur de siège
    } else {
      ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.fill();
      ctx.strokeStyle = couleur; ctx.globalAlpha = .55; ctx.stroke(); ctx.globalAlpha = 1;
    }
  }
  ctx.restore();
  return cible * pas - 3 * k;
}

export function boutonMatch(bar, send) {
  let el = bar.querySelector('.gmMatch');
  if (!el) {
    el = document.createElement('button');
    el.className = 'gm gmMatch'; el.type = 'button';
    el.textContent = '🏆 Manche simple';
    // à la suite des autres réglages du game master (.gm) ; sinon en fin de barre
    const gms = bar.querySelectorAll('button.gm');
    const dernier = gms.length ? gms[gms.length - 1] : null;
    if (dernier && dernier.nextSibling) bar.insertBefore(el, dernier.nextSibling); else bar.appendChild(el);
  }
  el.onclick = () => { send({ t: 'match' }); };
  return {
    el,
    maj(snap, gs) {
      el.textContent = actif(snap) ? '🏆 Premier à ' + snap.n : '🏆 Manche simple';
      el.title = actif(snap) ? 'Match en ' + snap.n + ' manches gagnantes (clic : changer)' : 'Une seule manche (clic : jouer en plusieurs manches gagnantes)';
      if (gs !== undefined) el.disabled = !(gs === 'lobby' || gs === 'over');
      if (el.classList) el.classList.toggle('on', actif(snap));
    },
  };
}
