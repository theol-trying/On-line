// PODIUM de fin de manche — brique visuelle PARTAGÉE, dessinée au canvas dans le style du jeu. La brique ne
// connaît que la mise en page (marches 2-1-3, noms, confettis, rangée des autres) ; la PIÈCE (raquette, moto,
// tank, bombeur, serpent, lutteur, footballeur) est dessinée par le jeu via `drawPiece`, SANS avatar.
// Canvas pur, zéro dépendance, compatible iOS 15 (pas de ?. ?? Object.hasOwn, pas de roundRect/ctx.filter/
// createConicGradient/letterSpacing/OffscreenCanvas). Aucune allocation lourde par image (pas de dégradé,
// pas de tableau de particules : les confettis se calculent à partir du temps seul).
//
// API
//   drawPodium(ctx, rect, now, opts)
//     rect = { x, y, w, h }   zone (repère monde du canvas) réservée au podium — à choisir pour ne pas être
//                             masquée par la carte DOM de fin.
//     now  = ms (performance.now()).
//     opts.entries   [{ seat, name, color, place, …}] : `place` = classement serveur (1 = vainqueur). Les ex æquo
//                    partagent la même marche (place 1 à plusieurs = équipe gagnante). Les joueurs de place > 3
//                    (ou sans place valide) vont dans la petite rangée grisée du bas. Les champs en plus
//                    (team, alive…) sont transmis tels quels à drawPiece.
//     opts.drawPiece(ctx, e, x, y, size, rank)   dessine la pièce du jeu centrée en (x,y), inscrite dans un
//                    carré de côté `size` (unités monde), `rank` = place. Le contexte est déjà save()é, alpha
//                    réglé (rangée grisée) : la pièce ne doit ni le laisser dans un autre état ni dessiner d'avatar.
//                    Absente → disque coloré + pastille de siège.
//     opts.nul       true = match nul (winner < 0) : pas de marche 1 isolée, une estrade plate commune aux
//                    ex æquo de tête, titre « Match nul », pas de confettis.
//     opts.A         accessibilité : A.reduceFx coupe confettis, lueur et montée des marches ; A.contrast
//                    épaissit les arêtes.
//     opts.theme     { step, edge, text, glow } couleurs du style du jeu (marche, arête, texte, lueur).
//     opts.W         largeur monde du canvas (pour la lisibilité des textes sur téléphone, exploits.readable).
//     opts.t0        ms de début de l'animation de montée (facultatif ; sans lui, podium déjà monté).
//     opts.title     titre facultatif au-dessus des marches (par défaut aucun, « Match nul » si opts.nul).
//   podiumEntries(players, colorOf)   entrées prêtes à l'emploi depuis la liste `players` du snapshot :
//                    participants (p.playing) classés (p.place > 0), triés par place puis siège.
//
// Intégration type (client de jeu, à la fin de manche, APRÈS le rejeu éventuel) :
//   const entries = podiumEntries(snap.players, colSeat);
//   drawPodium(ctx, { x: W * 0.05, y: H * 0.08, w: W * 0.9, h: H * 0.5 }, now, {
//     entries, A, W, t0: overT0, nul: snap.winner < 0,
//     theme: { step: '#5a3a22', edge: '#d9c27a', text: '#f1e6d0', glow: '#ffd84a' },
//     drawPiece(c, e, x, y, size, rank) { drawRikishi(e.seat, x, y, -Math.PI / 2, size * 0.42, { shadow: false }, now); },
//   });
import { readable, drawSeatChip } from './exploits.js';

const TAU = 6.2832;
const FRAC = [0, 0.3, 0.21, 0.14];       // hauteur des marches 1/2/3 en fraction de la zone (le vainqueur plus haut)
const MULT = [0, 2, 1.25, 1];            // taille de la pièce (× s) : le 1er ×2, le 2e et le 3e plus petits
const ORDER = [2, 1, 3];                 // de gauche à droite

// Entrées du podium à partir de snapshot.players (participants classés), triées par place puis siège.
export function podiumEntries(players, colorOf) {
  const out = [];
  const list = players || [];
  for (let i = 0; i < list.length; i++) {
    const p = list[i];
    if (!p || !p.playing || !(p.place > 0)) continue;
    const e = {};
    for (const k in p) e[k] = p[k];
    e.color = colorOf ? colorOf(p.seat) : (p.color || '#888');
    e.name = p.name || ('P' + (p.seat + 1));
    out.push(e);
  }
  out.sort((a, b) => a.place - b.place || a.seat - b.seat);
  return out;
}

// Nom tronqué à la largeur maxW (texte déjà réglé sur la bonne police) ; retire des caractères puis « … ».
function fit(ctx, txt, maxW) {
  let t = String(txt == null ? '' : txt);
  if (!ctx.measureText || maxW <= 0) return t;
  let w = ctx.measureText(t).width;
  if (w <= maxW) return t;
  let n = Math.max(1, Math.floor(t.length * maxW / w) - 1);
  t = t.slice(0, n) + '…';
  while (n > 1 && ctx.measureText(t).width > maxW) { n--; t = t.slice(0, n) + '…'; }
  return t;
}

// Pièce de secours (le jeu n'a pas fourni drawPiece) : disque de la couleur du joueur + pastille de siège.
function fallbackPiece(ctx, e, x, y, size) {
  ctx.beginPath(); ctx.arc(x, y, size * 0.4, 0, TAU);
  ctx.fillStyle = e.color || '#888'; ctx.fill();
  ctx.lineWidth = Math.max(1, size * 0.05); ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.stroke();
  drawSeatChip(ctx, x, y, e.seat | 0, e.color, size * 0.5);
}

function piece(ctx, opts, e, x, y, size, rank) {
  ctx.save();
  try {
    if (opts.drawPiece) opts.drawPiece(ctx, e, x, y, size, rank); else fallbackPiece(ctx, e, x, y, size);
  } catch (err) { /* une pièce défaillante ne doit pas faire tomber l'écran de fin */ }
  ctx.restore();
}

// Confettis déterministes (fonction du temps seul) : N rectangles qui tombent en oscillant, teintés vainqueur.
// Vitesse de chute proportionnelle à la hauteur de la zone : un cycle dure ~4 à 7 s.
const CONF = 34;
function confetti(ctx, rect, now, colors) {
  const nc = colors.length;
  for (let i = 0; i < CONF; i++) {
    const r1 = Math.sin(i * 12.9898 + 1.7) * 43758.5453, a = r1 - Math.floor(r1);       // hasard fixe par confetti
    const r2 = Math.sin(i * 78.233 + 9.1) * 24634.6345, b = r2 - Math.floor(r2);
    const speed = 0.045 + 0.05 * b;
    const cyc = rect.h + 40;
    const y = rect.y - 20 + (((now * speed * rect.h / 300) + b * cyc * 7) % cyc);
    const x = rect.x + a * rect.w + Math.sin(now / 520 + i) * rect.w * 0.018;
    const cw = Math.max(3, rect.h * 0.018) * (0.5 + 0.5 * Math.abs(Math.cos(now / 170 + i * 2.1)));   // le battement simule la rotation
    const chh = Math.max(4, rect.h * 0.03);
    ctx.fillStyle = colors[i % nc];
    ctx.fillRect(x - cw / 2, y, cw, chh);
  }
}

// Lueur pulsée derrière la pièce du vainqueur : trois disques translucides (pas de dégradé alloué par image).
function glow(ctx, x, y, size, color, now) {
  const pulse = 0.5 + 0.5 * Math.sin(now / 420);
  ctx.save();
  ctx.fillStyle = color; ctx.globalAlpha = 0.05 + 0.05 * pulse;
  for (let j = 3; j >= 1; j--) { ctx.beginPath(); ctx.arc(x, y, size * (0.5 + 0.16 * j), 0, TAU); ctx.fill(); }
  ctx.restore();
}

export function drawPodium(ctx, rect, now, opts) {
  const o = opts || {}, A = o.A || {}, th = o.theme || {};
  const list = o.entries || [];
  if (!list.length || !rect || !(rect.w > 0) || !(rect.h > 0)) return;
  const nul = !!o.nul, reduce = !!A.reduceFx;
  const cvs = ctx.canvas, WW = o.W || (cvs && cvs.width) || (rect.x * 2 + rect.w);
  const rd = (base, min) => Math.round(readable(base, cvs, WW, min));          // taille de texte lisible sur téléphone
  const cStep = th.step || '#4a4a58', cEdge = th.edge || '#d8d8e6', cText = th.text || '#ffffff';
  const cGlow = th.glow || '#ffd84a';

  // ── répartition : marches 1..3 (ex æquo sur la même marche), le reste dans la rangée grisée ──
  const tier = [null, [], [], []], others = [];
  for (let i = 0; i < list.length; i++) {
    const e = list[i], p = e.place | 0;
    if (nul) { if (p === 1) tier[1].push(e); else others.push(e); }               // nul : seuls les ex æquo de tête montent
    else if (p >= 1 && p <= 3) tier[p].push(e); else others.push(e);
  }
  const shown = [];                                                                // marches non vides, dans l'ordre 2-1-3
  for (let k = 0; k < 3; k++) if (tier[ORDER[k]].length) shown.push(ORDER[k]);
  if (!shown.length) return;
  const winner = (!nul && tier[1].length) ? tier[1][0] : null;

  // ── zones : titre, podium, rangée des autres ──
  const nameFs = rd(Math.max(11, rect.h * 0.05), 11);
  const title = o.title || (nul ? 'Match nul' : '');
  const titleFs = rd(Math.max(14, rect.h * 0.075), 14);
  const titleH = title ? titleFs * 1.7 : 0;
  const othFs = rd(Math.max(10, rect.h * 0.038), 10);
  const othSize = others.length ? Math.min(rect.h * 0.11, rect.w / (others.length * 1.25 + 0.4)) : 0;
  const othH = others.length ? othSize + othFs * 1.6 + rect.h * 0.02 : 0;
  const aTop = rect.y + titleH, aBot = rect.y + rect.h - othH;
  const aH = aBot - aTop;
  if (aH < nameFs * 6) return;                                                     // zone trop petite pour un podium lisible

  // ── hauteurs de marche (assez pour porter le nom) et taille de base s ──
  const sh = [0, 0, 0, 0], mult = [0, 2, 1.25, 1];
  const minFace = nameFs * 1.9;
  for (let p = 1; p <= 3; p++) sh[p] = Math.max(minFace * (nul || p > 1 ? 1 : 1.25), (nul ? 0.16 : FRAC[p]) * aH);
  if (nul) { mult[1] = 1.3; }
  else { mult[1] = MULT[1]; mult[2] = MULT[2]; mult[3] = MULT[3]; }
  let hTop = 0, mTop = 0;                                                          // marche la plus haute / plus grande pièce visibles
  for (let k = 0; k < shown.length; k++) { hTop = Math.max(hTop, sh[shown[k]]); mTop = Math.max(mTop, mult[shown[k]]); }
  let s = (aH - hTop - aH * 0.03) / (mTop * 1.15);                                 // hauteur : pièce + marche tiennent dans la zone
  s = Math.min(s, aH * 0.4);
  let need = 0;                                                                    // largeur nécessaire : pièce × 1,25 par joueur
  for (let k = 0; k < shown.length; k++) { const p = shown[k]; need += tier[p].length * Math.max(mult[p] * s * 1.25, nameFs * 3); }
  if (need > rect.w * 0.98) s *= rect.w * 0.98 / need;
  s = Math.max(s, 4);

  // ── montée des marches (3e, puis 2e, puis 1re) ──
  const rise = (p) => {
    if (reduce || o.t0 == null) return 1;
    const d = 380, delay = (3 - p) * 260;                                          // la marche 1 arrive en dernier
    const t = Math.max(0, Math.min(1, (now - o.t0 - delay) / d));
    return 1 - (1 - t) * (1 - t) * (1 - t);
  };

  // ── colonnes ──
  const widths = [];
  let total = 0;
  for (let k = 0; k < shown.length; k++) { const p = shown[k]; const w = tier[p].length * Math.max(mult[p] * s * 1.25, nameFs * 3); widths.push(w); total += w; }
  let x0 = rect.x + (rect.w - total) / 2;
  const line = A.contrast ? 3 : 2;

  // titre
  if (title) {
    ctx.save();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '800 ' + titleFs + 'px sans-serif';
    ctx.lineWidth = Math.max(2, titleFs * 0.12); ctx.strokeStyle = 'rgba(10,8,20,.85)'; ctx.fillStyle = cText;
    ctx.strokeText(title, rect.x + rect.w / 2, rect.y + titleH / 2); ctx.fillText(title, rect.x + rect.w / 2, rect.y + titleH / 2);
    ctx.restore();
  }

  // confettis derrière les pièces (vainqueur seulement, pas de match nul, coupés par reduceFx)
  if (!reduce && !nul && winner) {
    const c1 = winner.color || cGlow;
    confetti(ctx, { x: rect.x, y: rect.y, w: rect.w, h: aBot - rect.y }, now, [c1, '#ffffff', cGlow, c1]);
  }

  for (let k = 0; k < shown.length; k++) {
    const p = shown[k], list_p = tier[p], n = list_p.length, colW = widths[k];
    const r = rise(p), h = sh[p] * r, top = aBot - h, slotW = colW / n;
    // marche : face pleine + dessus plus clair + arête
    ctx.fillStyle = cStep; ctx.fillRect(x0, top, colW, h);
    ctx.fillStyle = 'rgba(255,255,255,.14)'; ctx.fillRect(x0, top, colW, Math.min(h, Math.max(3, sh[p] * 0.09)));
    ctx.lineWidth = line; ctx.strokeStyle = cEdge; ctx.strokeRect(x0, top, colW, h);
    // gros chiffre de place, discret, au bas de la face (n'écrase pas les noms placés en haut)
    if (!nul && r > 0.6) {
      const nf = Math.round(sh[p] * 0.6);
      ctx.save();
      ctx.globalAlpha = 0.28 * r; ctx.fillStyle = cText; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      ctx.font = '800 ' + nf + 'px sans-serif';
      ctx.fillText(String(p), x0 + colW / 2, aBot - sh[p] * 0.08);
      ctx.restore();
    }
    for (let i = 0; i < n; i++) {
      const e = list_p[i], cx = x0 + slotW * (i + 0.5);
      const size = Math.min(mult[p] * s, slotW * 0.92);
      const py = top - size * 0.5 - s * 0.04;                                     // la pièce pose sur la marche
      if (p === 1 && !nul && !reduce) glow(ctx, cx, py, size, cGlow, now);                // lueur pulsée derrière la pièce du vainqueur
      piece(ctx, o, e, cx, py, size, p);
      // nom sur la face de la marche (haut), pastille de siège au coin de la pièce
      if (r > 0.85) {
        ctx.save();
        ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        const fs = nameFs * (p === 1 && !nul ? 1.15 : 1);
        ctx.font = '700 ' + Math.round(fs) + 'px sans-serif';
        const label = fit(ctx, e.name || ('P' + ((e.seat | 0) + 1)), slotW * 0.94);
        ctx.lineWidth = Math.max(2, fs * 0.16); ctx.strokeStyle = 'rgba(10,8,20,.75)';
        ctx.strokeText(label, cx, top + fs * 0.35); ctx.fillStyle = cText; ctx.fillText(label, cx, top + fs * 0.35);
        ctx.restore();
        drawSeatChip(ctx, cx + size * 0.42, py - size * 0.42, e.seat | 0, e.color, Math.max(14, size * 0.3));
      }
    }
    x0 += colW;
  }

  // ── autres joueurs : petite rangée grisée en bas ──
  if (others.length) {
    const n = others.length, slotW = rect.w / n, y = aBot + rect.h * 0.01 + othSize / 2;
    ctx.save();
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.font = '600 ' + othFs + 'px sans-serif';
    for (let i = 0; i < n; i++) {
      const e = others[i], cx = rect.x + slotW * (i + 0.5);
      ctx.globalAlpha = 0.55;
      piece(ctx, o, e, cx, y, othSize, e.place | 0);
      ctx.globalAlpha = 0.85;
      const label = fit(ctx, e.name || ('P' + ((e.seat | 0) + 1)), slotW * 0.96);
      ctx.lineWidth = Math.max(2, othFs * 0.16); ctx.strokeStyle = 'rgba(10,8,20,.75)';
      ctx.strokeText(label, cx, y + othSize / 2 + othFs * 0.25); ctx.fillStyle = cText; ctx.fillText(label, cx, y + othSize / 2 + othFs * 0.25);
    }
    ctx.restore();
  }
}
