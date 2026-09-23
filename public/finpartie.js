// Écran de fin enrichi — courbe de la partie + meilleure action. Partagé par les 6 jeux.
//
// Chaque client tient un JOURNAL pendant la manche (côté client, aucune donnée serveur en plus) :
//   const J = creerJournal();
//   J.debut(now)                                   au passage en 'play' (efface la manche précédente)
//   J.echantillon(now, { [seat]: valeur, … })       à chaque état reçu ; n'enregistre qu'une fois par `pas` ms
//   J.moment(now, seat, 'a sorti X en charge', 7)  un fait marquant, pondéré (le plus lourd = « meilleure action »)
// puis, dans l'écran de fin :
//   endEl.innerHTML = … + blocFin(J, { titre: 'Vies au fil de la manche', couleur: seat => '#…', nom: seat => '…' })
//
// Sécurité : noms ÉCHAPPÉS ici (ils viennent du réseau), couleurs filtrées (hex ou rgb[a] seulement) avant
// d'entrer dans un attribut. Le SVG ne contient que des nombres calculés ici.
// Un joueur arrivé en cours de manche n'a que la fin de la courbe : c'est attendu.

const esc = s => ('' + s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const couleurSure = c => (typeof c === 'string' && /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\))$/i.test(c)) ? c : '#cccccc';

export function creerJournal(opts) {
  const pas = (opts && opts.pas) || 1000, max = (opts && opts.max) || 900;
  let t0 = 0, dernier = -1e12, series = {}, moments = [], actif = false;
  return {
    debut(now) { t0 = now; dernier = -1e12; series = {}; moments = []; actif = true; },
    actif() { return actif; },
    echantillon(now, valeurs, force) {
      if (!actif || (!force && now - dernier < pas)) return;
      dernier = now;
      const t = (now - t0) / 1000;
      for (const k in valeurs) {
        const v = +valeurs[k];
        if (!isFinite(v)) continue;
        const s = series[k] || (series[k] = []);
        if (s.length >= max) s.splice(0, s.length - max + 1);
        s.push([t, v]);
      }
    },
    moment(now, seat, texte, poids) {
      if (!actif) return;
      moments.push({ t: (now - t0) / 1000, seat: seat, texte: '' + texte, poids: +poids || 1 });
      if (moments.length > 200) moments.shift();
    },
    fin() { actif = false; },
    donnees() { return { series: series, moments: moments }; },
  };
}

function meilleur(moments) {
  let m = null;
  for (const x of moments) if (!m || x.poids > m.poids || (x.poids === m.poids && x.t < m.t)) m = x;   // à poids égal, le premier
  return m;
}

/** Bloc HTML de l'écran de fin : courbe (une ligne par joueur) + meilleure action. '' s'il n'y a rien à montrer. */
export function blocFin(journal, o) {
  o = o || {};
  const d = journal.donnees(), seats = Object.keys(d.series).filter(k => d.series[k].length >= 2);
  const best = meilleur(d.moments);
  if (!seats.length && !best) return '';
  const W = 300, H = 92, PG = 4, PB = 14, PH = 6;
  let tMax = 1, vMax = o.max || 1, vMin = 0;
  for (const k of seats) for (const p of d.series[k]) { if (p[0] > tMax) tMax = p[0]; if (!o.max && p[1] > vMax) vMax = p[1]; if (p[1] < vMin) vMin = p[1]; }
  if (best && best.t > tMax) tMax = best.t;
  const X = t => PG + (t / tMax) * (W - PG * 2), Y = v => PH + (1 - (v - vMin) / ((vMax - vMin) || 1)) * (H - PH - PB);
  const col = s => couleurSure(o.couleur ? o.couleur(+s) : '#ccc');
  let traits = '';
  for (const k of seats) {
    const pts = d.series[k];
    let chemin = 'M' + X(pts[0][0]).toFixed(1) + ' ' + Y(pts[0][1]).toFixed(1);
    for (let i = 1; i < pts.length; i++) {                   // en escalier : une vie, un point, ça tombe d'un coup
      chemin += ' H' + X(pts[i][0]).toFixed(1) + ' V' + Y(pts[i][1]).toFixed(1);
    }
    traits += '<path d="' + chemin + '" fill="none" stroke="' + col(k) + '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" opacity=".92"/>';
  }
  let repere = '';
  if (best) {
    const bx = X(best.t).toFixed(1);
    repere = '<line x1="' + bx + '" y1="' + PH + '" x2="' + bx + '" y2="' + (H - PB) + '" stroke="#ffd76b" stroke-width="1.2" stroke-dasharray="3 3"/>' +
      '<circle cx="' + bx + '" cy="' + PH + '" r="3.2" fill="#ffd76b"/>';
  }
  const graduations = [0, 0.5, 1].map(k => '<text x="' + X(tMax * k).toFixed(1) + '" y="' + (H - 3) + '" font-size="9" fill="currentColor" opacity=".55" text-anchor="' +
    (k === 0 ? 'start' : k === 1 ? 'end' : 'middle') + '">' + Math.round(tMax * k) + ' s</text>').join('');
  const svg = seats.length ? '<svg class="ecourbe" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" role="img" aria-label="' + esc(o.titre || 'Courbe de la partie') + '">' +
    '<line x1="' + PG + '" y1="' + (H - PB) + '" x2="' + (W - PG) + '" y2="' + (H - PB) + '" stroke="currentColor" stroke-width="1" opacity=".25"/>' +
    traits + repere + graduations + '</svg>' : '';
  const titre = seats.length ? '<div class="efin-titre">' + esc(o.titre || 'Au fil de la manche') + '</div>' : '';
  const action = best ? '<div class="emoment">⭐ <span class="emoment-l">Meilleure action</span> · <b style="color:' + col(best.seat) + '">' +
    esc(o.nom ? o.nom(best.seat) : 'P' + (best.seat + 1)) + '</b> ' + esc(best.texte) + ' <small>(à ' + Math.round(best.t) + ' s)</small></div>' : '';
  return '<div class="efin">' + titre + svg + action + '</div>';
}
