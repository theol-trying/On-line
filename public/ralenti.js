// RALENTI du moment décisif — brique visuelle PARTAGÉE (les 7 clients de jeu l'importent).
// Canvas pur, zéro dépendance, compatible iOS 15 : pas de ?. ?? Object.hasOwn, pas de roundRect/ctx.filter/
// createConicGradient/letterSpacing/OffscreenCanvas. Le client garde le tampon des derniers snapshots réseau ;
// à la fin de manche il rejoue les `windowMs` précédant la fin, à vitesse `slow`, avec des bandes « cinéma ».
//
// API
//   const RL = createRalenti({ keepMs: 3000, windowMs: 1400, slow: 0.4 });
//   RL.push(snap, now)     copie légère JSON du snapshot (sans `fx`), bornée à keepMs. Un changement de
//                          `snap.round` vide seul le tampon (nouvelle manche). Coût : un JSON.stringify.
//   RL.start(now)          lance le rejeu des windowMs précédant le dernier snapshot. Renvoie false (et ne
//                          fait rien) s'il y a moins de 0,5 s de tampon, si un rejeu est en cours ou déjà joué
//                          pour cette manche. Durée réelle ≈ windowMs / slow, plafonnée à 3,5 s.
//                          Le client NE l'appelle PAS sous A.reduceFx.
//   RL.active(now)         true tant que le rejeu tourne (faux après la fin ou après skip()).
//   RL.frame(now)          { a, b, u, ta, tb } : les deux snapshots qui encadrent l'instant rejoué + la fraction
//                          u ∈ [0,1] pour interpoler (ta/tb = leur horodatage d'arrivée).
//                          null hors rejeu. Les snapshots sont parsés à la demande puis gardés en cache :
//                          NE PAS les modifier.
//   RL.progress(now)       0..1 (avancement du rejeu), 1 hors rejeu.
//   RL.skip()              interrompt le rejeu (Espace / clic / tap).
//   RL.clear()             vide tout (à appeler au retour au lobby / nouvelle partie si pas de `round`).
//   RL.drawOverlay(ctx, W, H, now, A)   bandes cinéma haut/bas, « ⟲ RALENTI », barre de progression, aide
//                          « Espace / toucher : passer ». À dessiner EN DERNIER, dans le repère monde (W×H).
//   RL.slow                facteur de vitesse (ex. 0.4) : le client peut s'en servir pour ralentir ses
//                          particules pendant le rejeu.
//
// Intégration type (client de jeu) :
//   const RL = createRalenti();
//   onState(m) { RL.push(m, performance.now());               // à chaque snapshot, avant toute autre chose
//                if (m.gs === 'over' && prevGs !== 'over' && !A.reduceFx && RL.start(performance.now())) pendingEnd = m;
//                else if (m.gs === 'over') showEndscreen(m); ... }
//   draw() { const f = RL.frame(now);                          // rejeu : on dessine a/b interpolés, sans
//            if (f) { drawWorld(lerp(f.a, f.b, f.u)); RL.drawOverlay(ctx, W, H, now, A); return; }
//            if (pendingEnd && !RL.active(now)) { showEndscreen(pendingEnd); pendingEnd = null; } ... }
//   keydown Espace / pointerdown : if (RL.active(performance.now())) { RL.skip(); }
//   Pendant le rejeu : ne PAS rejouer m.fx (sons, particules) et différer la carte DOM de fin.
import { readable } from './exploits.js';

export function createRalenti(opts) {
  const o = opts || {};
  const keepMs = o.keepMs > 0 ? o.keepMs : 3000;
  const windowMs = o.windowMs > 0 ? o.windowMs : 1400;
  const slow = o.slow > 0 && o.slow <= 1 ? o.slow : 0.4;
  const MAX_DUR = 3500, MIN_SPAN = 500;          // plafond de durée réelle ; tampon minimal (ms) pour qu'un rejeu ait du sens
  let buf = [];                                  // { t, j (JSON), s (snapshot parsé, paresseux) }
  let lastRef = null, lastRound;                 // même objet poussé deux fois → ignoré ; changement de manche → purge
  let rep = null, t0 = 0, dur = 0, gStart = 0, j = 0, stopped = false, used = false;

  function parsed(e) { if (!e.s) e.s = JSON.parse(e.j); return e.s; }

  function push(snap, now) {
    if (!snap || snap === lastRef) return;
    lastRef = snap;
    if (typeof snap.round === 'number') {
      if (lastRound !== undefined && snap.round !== lastRound) clear();     // nouvelle manche : plus rien à rejouer
      lastRound = snap.round;
    }
    const c = {};
    for (const k in snap) if (k !== 'fx') c[k] = snap[k];                   // les événements (sons, fx) ne se rejouent pas
    let js;
    try { js = JSON.stringify(c); } catch (e) { return; }
    buf.push({ t: now, j: js, s: null });
    while (buf.length && now - buf[0].t > keepMs) buf.shift();
  }

  function clear() { buf = []; lastRef = null; rep = null; stopped = false; used = false; j = 0; }

  function start(now) {
    if (used || rep || buf.length < 2) return false;
    const tEnd = buf[buf.length - 1].t;
    const tFrom = Math.max(buf[0].t, tEnd - windowMs);
    const span = tEnd - tFrom;
    if (span < MIN_SPAN) return false;
    let i0 = 0;                                  // dernier snapshot à t <= tFrom : point de départ de l'interpolation
    for (let i = 0; i < buf.length; i++) { if (buf[i].t <= tFrom) i0 = i; else break; }
    rep = buf.slice(i0);                         // copie de références : les push suivants n'affectent plus le rejeu
    gStart = tFrom; j = 0; t0 = now; stopped = false; used = true;
    dur = Math.min(MAX_DUR, span / slow);
    return true;
  }

  function active(now) { return !!rep && !stopped && now - t0 < dur; }
  function progress(now) { return active(now) ? Math.max(0, Math.min(1, (now - t0) / dur)) : 1; }
  function skip() { if (rep) stopped = true; }

  function frame(now) {
    if (!active(now)) return null;
    const g = gStart + Math.max(0, now - t0) * slow;                        // instant de jeu rejoué
    const last = rep.length - 1;
    if (last < 1) { const s0 = parsed(rep[0]); return { a: s0, b: s0, u: 0, ta: rep[0].t, tb: rep[0].t }; }
    while (j < last - 1 && rep[j + 1].t <= g) j++;
    const A0 = rep[j], B0 = rep[j + 1];
    const span = B0.t - A0.t;
    const u = span > 0 ? Math.max(0, Math.min(1, (g - A0.t) / span)) : 1;
    return { a: parsed(A0), b: parsed(B0), u: u, ta: A0.t, tb: B0.t };
  }

  // Bandes cinéma + libellé + barre de progression. Textes agrandis par exploits.readable (lisible sur téléphone).
  function drawOverlay(ctx, W, H, now, A) {
    if (!active(now)) return;
    const reduce = A && A.reduceFx, strong = A && A.contrast;
    const p = (now - t0) / dur, ms = now - t0, left = dur - ms;
    const k = reduce ? 1 : Math.max(0, Math.min(1, Math.min(ms / 250, left / 250)));   // les bandes glissent à l'entrée / la sortie
    const cv = ctx.canvas;
    const fs = Math.round(readable(Math.max(14, H * 0.04), cv, W, 13));
    const bandH = Math.min(H * 0.17, Math.max(H * 0.085, fs * 2.4)) * k;
    ctx.save();
    ctx.fillStyle = strong ? '#000' : 'rgba(6,4,14,.9)';
    ctx.fillRect(0, 0, W, bandH);
    ctx.fillRect(0, H - bandH, W, bandH);
    if (k > 0.6) {
      ctx.globalAlpha = Math.min(1, (k - 0.6) / 0.4);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const pulse = reduce ? 1 : 0.8 + 0.2 * Math.sin(now / 260);
      ctx.font = '800 ' + fs + 'px sans-serif';
      ctx.lineWidth = Math.max(2, fs * 0.12); ctx.strokeStyle = 'rgba(0,0,0,.85)';
      ctx.fillStyle = 'rgba(255,255,255,' + pulse.toFixed(2) + ')';
      const ty = bandH / 2;
      ctx.strokeText('⟲ RALENTI', W / 2, ty); ctx.fillText('⟲ RALENTI', W / 2, ty);
      // barre de progression dans la bande du bas + aide pour passer
      const bw = W * 0.4, bh = Math.max(4, H * 0.009), by = H - bandH + bandH * 0.36;
      ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.fillRect((W - bw) / 2, by, bw, bh);
      ctx.fillStyle = strong ? '#fff' : '#ffd84a'; ctx.fillRect((W - bw) / 2, by, bw * Math.max(0, Math.min(1, p)), bh);
      const hs = Math.round(readable(Math.max(11, H * 0.026), cv, W, 11));
      ctx.font = '600 ' + hs + 'px sans-serif'; ctx.fillStyle = 'rgba(255,255,255,.8)';
      ctx.fillText('Espace / toucher : passer', W / 2, by + bh + Math.max(hs * 0.9, bandH * 0.3));
    }
    ctx.restore();
  }

  return { push, start, active, frame, progress, skip, clear, drawOverlay, slow };
}
