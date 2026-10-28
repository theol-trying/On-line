// BOÎTE À SONS PARTAGÉE — bruitages des 9 jeux, WebAudio, zéro fichier, zéro dépendance.
// Avant (≤ 27/10) : chaque client empilait des ondes carrées / dents de scie brutes branchées directement sur la sortie
// (sons durs, aucun espace, tous identiques d'un coup à l'autre, saturation quand ils s'additionnent).
// Maintenant : un BUS par AudioContext (volume 🔊 a11y.sfx → compresseur doux → passe-bas 14 kHz → sortie, plus un
// départ de RÉVERBÉRATION propre à chaque jeu) et des PRIMITIVES de synthèse réalistes ; les recettes de chaque jeu
// vivent dans public/games/<id>/sons.js (table SONS) et s'écoutent toutes sur /sons.html.
//
//   const S = creerSfx(() => actx, () => A, { salle: { duree: 0.9, mix: 0.18, clarte: 0.5 }, niveau: 1 });
//   S.avec(pan, att, () => SONS[k](S, arg));     // pan -1..1 (gauche/droite), att 0..1 (distance) pour les appels du bloc
//
// Toutes les primitives prennent UN objet d'options ; les durées sont en secondes, les fréquences en Hz, les gains
// sont des amplitudes de crête (0,05 ≈ un bip discret, 0,3 = un gros impact ; le compresseur protège au-delà).
// Options communes : retard (s), gain, reverb (0..1, part envoyée dans la salle), varie (0..1 : ± hauteur / niveau
// aléatoires pour qu'un même son ne soit jamais deux fois identique ; défaut 0,04).
//   S.ton({ f, f2?, glisse?, dur, onde?, gain, attaque?, filtre?: { type, f, f2?, q? }, vibrato?: { f, prof (demi-tons) }, det? (cents) })
//        f2 : hauteur d'arrivée (glissando exponentiel), atteinte à glisse × dur (défaut 1 : sur toute la durée)
//        onde : 'sine' | 'triangle' | 'square' | 'sawtooth' | 'doux' (triangle arrondi) | 'creux' (carré filtré) | 'orgue'
//   S.bruit({ dur, gain, couleur?: 'blanc'|'rose'|'brun', filtre?: { type, f, f2?, q? }, attaque? })
//   S.fm({ f, ratio?, indice?, dur, gain })              cloche, métal, verre (synthèse FM, l'indice décroît)
//   S.corde({ f, dur, gain, clarte? })                    corde pincée / bois (Karplus-Strong)
//   S.choc({ f?, f2?, dur?, gain, clic?, corps? })        impact : sous-grave qui plonge + claquement de bruit
//   S.membrane({ f, dur, gain, clic? })                   tambour (taiko, grosse caisse, peau tendue)
//   S.explosion({ taille 0..1.5, gain })                  détonation + grondement + débris + queue de salle
//   S.souffle({ dur, f1, f2, gain, q? })                  « whoosh » (bruit passe-bande qui balaie)
//   S.sifflet({ f?, dur, gain, roulette? })               sifflet d'arbitre (son + bille qui roule)
//   S.foule({ dur, gain, elan? })                         clameur (bruit rose modulé, monte puis retombe)
//   S.accord({ notes:[Hz], ecart?, ...options de S.ton })  arpège / accord (ecart = s entre notes)
//   S.limite(cle, ms) -> booléen    faux si le même son (cle) a déjà joué il y a moins de ms : anti-mitraillage
//   S.plus(facteur, fn)              multiplie le niveau de tout ce que fn joue (calage d'un son après mesure sur /sons.html)
//   S.moteur(preset) -> { regler({ regime, gaz, glisse?, roulement?, actif }), arreter() }   son CONTINU (voir plus bas)
//   S.pret() -> booléen   contexte présent, en marche, et volume des effets > 0
// iOS 15 : pas de ?. ni ??, StereoPanner seulement s'il existe, setValueCurveAtTime jamais superposé.

const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const fini = x => typeof x === 'number' && isFinite(x);

export function creerSfx(getCtx, getA11y, opts) {
  opts = opts || {};
  const salle = Object.assign({ duree: 0.8, mix: 0.15, clarte: 0.5 }, opts.salle || {});
  const niveau = fini(opts.niveau) ? opts.niveau : 1;
  const horsLigne = !!opts.horsLigne;                    // OfflineAudioContext (mesures de /sons.html) : pas d'état « running » à attendre
  const marche = c => horsLigne || c.state === 'running';
  let ctx = null, bus = null;
  let pan = 0, att = 1;
  const derniers = {};

  function volume() { const A = getA11y(); return A && typeof A.sfx === 'number' ? A.sfx : 1; }

  function brancher() {                                  // bus du contexte courant (un jeu recrée son contexte à chaque entrée)
    const c = getCtx();
    if (!c) return null;
    if (c === ctx && bus) return c;
    ctx = c; bus = null;
    try {
      const entree = c.createGain(), comp = c.createDynamicsCompressor(), doux = c.createBiquadFilter(), sortie = c.createGain();
      comp.threshold.value = -16; comp.knee.value = 10; comp.ratio.value = 5; comp.attack.value = 0.003; comp.release.value = 0.16;
      doux.type = 'lowpass'; doux.frequency.value = 14000; doux.Q.value = 0.5;
      sortie.gain.value = volume() * niveau;
      entree.connect(comp); comp.connect(doux); doux.connect(sortie); sortie.connect(c.destination);
      const envoi = c.createGain(), conv = c.createConvolver();
      envoi.gain.value = 1;
      conv.buffer = reponseSalle(c, salle.duree, salle.clarte);
      envoi.connect(conv); conv.connect(entree);
      bus = { entree: entree, envoi: envoi, sortie: sortie, bruits: {}, ondes: {}, vol: -1 };
    } catch (e) { bus = null; return null; }
    return c;
  }
  function majVolume(c) {
    const v = volume() * niveau;
    if (v !== bus.vol) { bus.vol = v; bus.sortie.gain.setTargetAtTime(v, c.currentTime, 0.03); }
  }

  // Réponse impulsionnelle générée : bruit stéréo qui décroît exponentiellement et s'assombrit (clarte 0 = feutré, 1 = brillant).
  function reponseSalle(c, duree, clarte) {
    const sr = c.sampleRate, n = Math.max(1, Math.floor(sr * clamp(duree, 0.05, 4))), b = c.createBuffer(2, n, sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch); let lp = 0;
      for (let i = 0; i < n; i++) {
        const x = i / n, k = 0.08 + 0.9 * clarte * (1 - x);   // filtre passe-bas qui se referme le long de la queue
        lp += k * ((Math.random() * 2 - 1) - lp);
        d[i] = lp * Math.pow(1 - x, 2.2) * (i < sr * 0.004 ? i / (sr * 0.004) : 1);
      }
    }
    return b;
  }

  // Bruits pré-calculés par contexte (1,5 s, joués en boucle avec un départ aléatoire).
  function tamponBruit(c, couleur) {
    const k = couleur || 'blanc';
    if (own(bus.bruits, k)) return bus.bruits[k];
    const sr = c.sampleRate, n = Math.floor(sr * 1.5), b = c.createBuffer(1, n, sr), d = b.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, br = 0, max = 0;
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1;
      let x = w;
      if (k === 'rose') { b0 = 0.99765 * b0 + w * 0.0990460; b1 = 0.96300 * b1 + w * 0.2965164; b2 = 0.57000 * b2 + w * 1.0526913; x = b0 + b1 + b2 + w * 0.1848; }
      else if (k === 'brun') { br = (br + 0.02 * w) / 1.02; x = br; }
      d[i] = x; if (Math.abs(x) > max) max = Math.abs(x);
    }
    for (let i = 0; i < n; i++) d[i] /= max || 1;
    bus.bruits[k] = b;
    return b;
  }

  function onde(c, nom) {                               // formes d'onde adoucies (moins d'harmoniques aigus que carré / dent de scie)
    if (nom === 'sine' || nom === 'triangle' || nom === 'square' || nom === 'sawtooth') return nom;
    if (own(bus.ondes, nom)) return bus.ondes[nom];      // une PeriodicWave appartient à SON contexte : cache par bus
    const N = 32, re = new Float32Array(N), im = new Float32Array(N);
    for (let h = 1; h < N; h++) {
      if (nom === 'doux') im[h] = (h % 2 ? (h % 4 === 1 ? 1 : -1) / (h * h) : 0) + (h === 2 ? 0.08 : 0);   // triangle + une pointe d'octave
      else if (nom === 'creux') im[h] = h % 2 ? 1 / h * Math.exp(-h / 9) : 0;                                // carré aux aigus coupés (clarinette)
      else if (nom === 'orgue') im[h] = (h === 1 ? 1 : h === 2 ? 0.5 : h === 3 ? 0.3 : h === 4 ? 0.18 : h === 6 ? 0.08 : 0);
      else im[h] = h % 2 ? (h % 4 === 1 ? 1 : -1) / (h * h) : 0;                                            // nom inconnu : triangle
    }
    let w = 'triangle';
    try { w = c.createPeriodicWave(re, im); } catch (e) {}
    bus.ondes[nom] = w;
    return w;
  }

  // Sortie d'une voix : panoramique + atténuation de distance + départ réverbération.
  function sortieVoix(c, g, rev) {
    let n = g;
    if (pan && c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = clamp(pan, -1, 1); g.connect(p); n = p; }
    n.connect(bus.entree);
    const r = (rev == null ? 0.35 : rev) * salle.mix * 2;
    if (r > 0) { const s = c.createGain(); s.gain.value = clamp(r, 0, 1); n.connect(s); s.connect(bus.envoi); }
  }
  function prep(o) {                                     // contexte + temps de départ + gain final (avec variation), ou null
    const c = brancher();
    if (!c || !bus || !marche(c)) return null;
    majVolume(c);
    if (volume() <= 0) return null;
    const va = o.varie == null ? 0.04 : o.varie;
    const g = (fini(o.gain) ? o.gain : 0.05) * att * (1 + (Math.random() * 2 - 1) * va * 0.6);
    if (!(g > 0)) return null;
    return { c: c, t: c.currentTime + 0.005 + (fini(o.retard) ? Math.max(0, o.retard) : 0), g: g, h: 1 + (Math.random() * 2 - 1) * va * 0.25 };
  }
  // Enveloppe : attaque linéaire courte puis chute exponentielle (jamais exponentialRamp vers 0 : -80 dB).
  function enveloppe(p, gainNode, dur, attaque) {
    const a = clamp(fini(attaque) ? attaque : 0.004, 0.001, dur * 0.6), gg = gainNode.gain;
    gg.setValueAtTime(0.0001, p.t); gg.linearRampToValueAtTime(p.g, p.t + a); gg.exponentialRampToValueAtTime(0.0001, p.t + dur);
  }
  function filtre(c, p, F, dur) {
    const f = c.createBiquadFilter();
    f.type = F.type || 'lowpass'; f.frequency.setValueAtTime(clamp(F.f || 1000, 20, 20000), p.t);
    if (fini(F.f2)) f.frequency.exponentialRampToValueAtTime(clamp(F.f2, 20, 20000), p.t + dur);
    if (fini(F.q)) f.Q.value = F.q;
    if (fini(F.gain)) f.gain.value = F.gain;
    return f;
  }

  const api = {
    pret() { const c = brancher(); return !!(c && bus && marche(c) && volume() > 0); },
    // pan / atténuation pour tous les appels faits dans fn (psound) ; sans effet sur les sons continus
    avec(p, a, fn) { const p0 = pan, a0 = att; pan = fini(p) ? p : 0; att = fini(a) ? clamp(a, 0, 1) : 1; try { fn(); } finally { pan = p0; att = a0; } },
    // multiplie le niveau de tous les appels faits dans fn (calage d'un son entier après mesure, cf. caler() des sons.js)
    plus(f, fn) { const a0 = att; att = att * (fini(f) && f > 0 ? f : 1); try { fn(); } finally { att = a0; } },
    limite(cle, ms) { const t = Date.now(); if (own(derniers, cle) && t - derniers[cle] < ms) return false; derniers[cle] = t; return true; },
    varier(x, pct) { return x * (1 + (Math.random() * 2 - 1) * (pct == null ? 0.05 : pct)); },

    ton(o) {
      const p = prep(o); if (!p) return;
      const c = p.c, dur = clamp(o.dur || 0.1, 0.01, 8), osc = c.createOscillator(), g = c.createGain();
      const w = onde(c, o.onde || 'triangle');
      if (typeof w === 'string') osc.type = w; else osc.setPeriodicWave(w);
      const f0 = clamp((o.f || 440) * p.h, 10, 18000);
      osc.frequency.setValueAtTime(f0, p.t);
      if (fini(o.f2)) osc.frequency.exponentialRampToValueAtTime(clamp(o.f2 * p.h, 10, 18000), p.t + dur * (o.glisse == null ? 1 : clamp(o.glisse, 0.05, 1)));
      if (fini(o.det)) osc.detune.value = o.det;
      let n = osc;
      if (o.vibrato) {
        const l = c.createOscillator(), lg = c.createGain();
        l.frequency.value = o.vibrato.f || 6; lg.gain.value = f0 * (Math.pow(2, (o.vibrato.prof || 0.3) / 12) - 1);
        l.connect(lg); lg.connect(osc.frequency); l.start(p.t); l.stop(p.t + dur + 0.05);
      }
      if (o.filtre) { const F = filtre(c, p, o.filtre, dur); n.connect(F); n = F; }
      n.connect(g); enveloppe(p, g, dur, o.attaque);
      sortieVoix(c, g, o.reverb);
      osc.start(p.t); osc.stop(p.t + dur + 0.05);
    },

    bruit(o) {
      const p = prep(o); if (!p) return;
      const c = p.c, dur = clamp(o.dur || 0.1, 0.01, 8), s = c.createBufferSource(), g = c.createGain();
      s.buffer = tamponBruit(c, o.couleur); s.loop = true;
      s.playbackRate.value = p.h;
      let n = s;
      if (o.filtre) { const F = filtre(c, p, o.filtre, dur); n.connect(F); n = F; }
      n.connect(g); enveloppe(p, g, dur, o.attaque);
      sortieVoix(c, g, o.reverb);
      s.start(p.t, Math.random() * 1.2); s.stop(p.t + dur + 0.05);
    },

    fm(o) {
      const p = prep(o); if (!p) return;
      const c = p.c, dur = clamp(o.dur || 0.5, 0.02, 8), f = clamp((o.f || 880) * p.h, 20, 12000);
      const car = c.createOscillator(), mod = c.createOscillator(), mg = c.createGain(), g = c.createGain();
      car.frequency.value = f; mod.frequency.value = f * (o.ratio || 1.4);
      const I = (o.indice == null ? 3 : o.indice) * f;
      mg.gain.setValueAtTime(I, p.t); mg.gain.exponentialRampToValueAtTime(Math.max(1, I * 0.05), p.t + dur);
      mod.connect(mg); mg.connect(car.frequency); car.connect(g);
      enveloppe(p, g, dur, o.attaque);
      sortieVoix(c, g, o.reverb);
      car.start(p.t); mod.start(p.t); car.stop(p.t + dur + 0.05); mod.stop(p.t + dur + 0.05);
    },

    corde(o) {                                           // Karplus-Strong calculé dans un tampon (pas de nœud de délai bouclé)
      const p = prep(o); if (!p) return;
      const c = p.c, sr = c.sampleRate, dur = clamp(o.dur || 0.6, 0.05, 3), f = clamp((o.f || 220) * p.h, 40, 4000);
      const n = Math.floor(sr * dur), b = c.createBuffer(1, n, sr), d = b.getChannelData(0);
      const L = Math.max(2, Math.round(sr / f)), ligne = new Float32Array(L), clarte = clamp(o.clarte == null ? 0.5 : o.clarte, 0, 1);
      for (let i = 0; i < L; i++) ligne[i] = Math.random() * 2 - 1;
      const amort = 0.996 - (1 - clarte) * 0.012;
      let j = 0, prec = 0;
      for (let i = 0; i < n; i++) {
        const x = ligne[j], y = amort * (0.5 * x + 0.5 * prec);
        prec = x; ligne[j] = y; d[i] = x; j = (j + 1) % L;
      }
      const s = c.createBufferSource(), g = c.createGain();
      s.buffer = b; s.connect(g);
      g.gain.setValueAtTime(p.g, p.t); g.gain.setValueAtTime(p.g, p.t + dur * 0.8); g.gain.linearRampToValueAtTime(0.0001, p.t + dur);
      sortieVoix(c, g, o.reverb);
      s.start(p.t); s.stop(p.t + dur + 0.02);
    },

    choc(o) {                                            // impact : corps (sinus qui plonge) + claquement (bruit court filtré)
      const dur = o.dur || 0.18, f = o.f || 120, gain = o.gain == null ? 0.2 : o.gain;
      api.ton({ f: f, f2: o.f2 || f * 0.45, dur: dur, onde: 'sine', gain: gain * (o.corps == null ? 1 : o.corps), attaque: 0.002, retard: o.retard, reverb: o.reverb, varie: o.varie });
      const clic = o.clic == null ? 0.6 : o.clic;
      if (clic > 0) api.bruit({ dur: Math.min(0.06, dur * 0.5), gain: gain * clic, couleur: 'blanc', filtre: { type: 'bandpass', f: o.fClic || 2200, q: 0.9 }, attaque: 0.001, retard: o.retard, reverb: o.reverb, varie: o.varie });
    },

    membrane(o) {                                        // tambour : hauteur qui chute vite, peau (sinus) + frappe (bruit grave)
      const f = o.f || 90, dur = o.dur || 0.5, gain = o.gain == null ? 0.25 : o.gain;
      api.ton({ f: f * 1.6, f2: f, glisse: 0.12, dur: dur, onde: 'sine', gain: gain, attaque: 0.002, retard: o.retard, reverb: o.reverb == null ? 0.6 : o.reverb, varie: o.varie });
      api.ton({ f: f * 2.4, f2: f * 1.5, glisse: 0.2, dur: dur * 0.5, onde: 'sine', gain: gain * 0.25, attaque: 0.002, retard: o.retard, reverb: o.reverb == null ? 0.6 : o.reverb, varie: o.varie });
      api.bruit({ dur: 0.05, gain: gain * (o.clic == null ? 0.5 : o.clic), couleur: 'rose', filtre: { type: 'lowpass', f: 1800 }, attaque: 0.001, retard: o.retard, reverb: 0.3, varie: o.varie });
    },

    explosion(o) {
      const T = clamp(o.taille == null ? 1 : o.taille, 0.2, 1.6), gain = o.gain == null ? 0.35 : o.gain, r = o.retard || 0;
      api.ton({ f: 95, f2: 32, dur: 0.5 + 0.5 * T, onde: 'sine', gain: gain * 0.9, attaque: 0.003, retard: r, reverb: 0.3, varie: 0.08 });   // poussée sous-grave
      api.bruit({ dur: 0.04, gain: gain * 0.8, couleur: 'blanc', filtre: { type: 'bandpass', f: 1800, q: 0.7 }, attaque: 0.001, retard: r, reverb: 0.5 });   // détonation
      api.bruit({ dur: 0.6 + 1.1 * T, gain: gain * 0.75, couleur: 'brun', filtre: { type: 'lowpass', f: 2600, f2: 180 }, attaque: 0.006, retard: r, reverb: 0.8, varie: 0.1 });   // grondement
      const n = Math.round(3 + 5 * T);
      for (let i = 0; i < n; i++) api.bruit({ dur: 0.02 + Math.random() * 0.04, gain: gain * (0.12 + Math.random() * 0.18), couleur: 'blanc', filtre: { type: 'bandpass', f: 1500 + Math.random() * 3500, q: 2 }, attaque: 0.001, retard: r + 0.08 + Math.random() * (0.25 + 0.5 * T), reverb: 0.6, varie: 0.2 });   // débris
    },

    souffle(o) {
      api.bruit({ dur: o.dur || 0.35, gain: o.gain == null ? 0.12 : o.gain, couleur: o.couleur || 'rose', filtre: { type: 'bandpass', f: o.f1 || 400, f2: o.f2 || 2400, q: o.q || 1.4 }, attaque: (o.dur || 0.35) * 0.4, retard: o.retard, reverb: o.reverb, varie: o.varie });
    },

    sifflet(o) {                                         // deux sons proches (la bille qui roule module la hauteur) + souffle
      const f = o.f || 2900, dur = o.dur || 0.45, gain = o.gain == null ? 0.07 : o.gain;
      const vib = { f: o.roulette || 38, prof: 0.6 };
      api.ton({ f: f, dur: dur, onde: 'sine', gain: gain, attaque: 0.015, vibrato: vib, retard: o.retard, reverb: o.reverb == null ? 0.5 : o.reverb, varie: 0.01 });
      api.ton({ f: f * 1.012, dur: dur, onde: 'sine', gain: gain * 0.5, attaque: 0.02, vibrato: vib, retard: o.retard, reverb: 0.5, varie: 0.01 });
      api.bruit({ dur: dur, gain: gain * 0.35, couleur: 'blanc', filtre: { type: 'bandpass', f: f, q: 3 }, attaque: 0.02, retard: o.retard, reverb: 0.4, varie: 0.01 });
    },

    foule(o) {                                           // clameur : bruit rose passe-bande, attaque lente, plusieurs couches décalées
      const dur = o.dur || 2.2, gain = o.gain == null ? 0.1 : o.gain, elan = o.elan == null ? 0.35 : o.elan;
      for (let i = 0; i < 3; i++) api.bruit({ dur: dur * (0.8 + 0.2 * i), gain: gain * (1 - i * 0.2), couleur: 'rose', filtre: { type: 'bandpass', f: 600 + i * 450, q: 0.8 }, attaque: dur * elan, retard: (o.retard || 0) + i * 0.05, reverb: 0.9, varie: 0.15 });
    },

    accord(o) {
      const notes = o.notes || [], ecart = o.ecart || 0;
      for (let i = 0; i < notes.length; i++) api.ton(Object.assign({}, o, { f: notes[i], retard: (o.retard || 0) + i * ecart }));
    },

    // ───── son continu : moteur (Micro Machines ; réutilisable) ─────
    // Modèle : train d'explosions (onde périodique riche aux harmoniques décroissants, phases dispersées) dont la
    // hauteur suit le régime, + modulation au demi-régime (irrégularité des cylindres : le « brrr »), + bruit de
    // combustion, à travers un passe-bas qui s'ouvre avec les gaz et des résonances d'échappement FIXES (formants :
    // c'est ce qui fait « moteur » et pas « synthé » quand la hauteur monte). Couches à part : roulement des roues
    // (bruit grave proportionnel à la vitesse) et crissement (bande étroite qui tremble) en glisse.
    // preset : { ralenti (Hz), max (Hz), gain, formants: [[Hz, Q, gain dB]…], grain 0..1, irregulier 0..1,
    //            roulement (gain), crissement (gain), fCrisse (Hz) }
    moteur(preset) {
      const P = Object.assign({ ralenti: 40, max: 200, gain: 0.035, formants: [[480, 1.3, 7], [1350, 2, 4]], grain: 0.35, irregulier: 0.22, roulement: 0.03, crissement: 0.025, fCrisse: 1250 }, preset || {});
      let m = null;
      function creer(c) {
        const N = 48, re = new Float32Array(N), im = new Float32Array(N);
        for (let h = 1; h < N; h++) { const a = Math.pow(h, -0.9) * (1 + 0.3 * Math.cos(h * 0.9)), ph = h * h * 0.37; re[h] = a * Math.cos(ph); im[h] = a * Math.sin(ph); }
        const osc = c.createOscillator(); osc.setPeriodicWave(c.createPeriodicWave(re, im));
        const sous = c.createOscillator(); sous.type = 'sine';            // demi-régime : irrégularité
        const am = c.createGain(), amProf = c.createGain();
        am.gain.value = 1 - P.irregulier; amProf.gain.value = P.irregulier;
        sous.connect(amProf); amProf.connect(am.gain);
        const j1 = c.createOscillator(), j2 = c.createOscillator(), jg = c.createGain();   // dérive lente et organique de la hauteur
        j1.frequency.value = 5.3; j2.frequency.value = 7.9; jg.gain.value = 9;               // ±9 cents
        j1.connect(jg); j2.connect(jg); jg.connect(osc.detune);
        const pb = c.createBiquadFilter(); pb.type = 'lowpass'; pb.Q.value = 0.7; pb.frequency.value = 700;
        osc.connect(am); am.connect(pb);
        const ns = c.createBufferSource(); ns.buffer = tamponBruit(c, 'rose'); ns.loop = true;   // grain de combustion
        const nf = c.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 900; nf.Q.value = 0.8;
        const ng = c.createGain(); ng.gain.value = P.grain * 0.5;
        ns.connect(nf); nf.connect(ng); ng.connect(am);
        let n = pb;
        P.formants.forEach(F => { const f = c.createBiquadFilter(); f.type = 'peaking'; f.frequency.value = F[0]; f.Q.value = F[1]; f.gain.value = F[2]; n.connect(f); n = f; });
        const g = c.createGain(); g.gain.value = 0; n.connect(g); g.connect(bus.entree);
        const rs = c.createBufferSource(); rs.buffer = tamponBruit(c, 'brun'); rs.loop = true;     // roulement
        const rf = c.createBiquadFilter(); rf.type = 'lowpass'; rf.frequency.value = 320;
        const rg = c.createGain(); rg.gain.value = 0; rs.connect(rf); rf.connect(rg); rg.connect(bus.entree);
        const cs = c.createBufferSource(); cs.buffer = tamponBruit(c, 'blanc'); cs.loop = true;    // crissement : bande étroite…
        const cf = c.createBiquadFilter(); cf.type = 'bandpass'; cf.frequency.value = P.fCrisse; cf.Q.value = 7;
        const cl = c.createOscillator(), clg = c.createGain(); cl.frequency.value = 13; clg.gain.value = P.fCrisse * 0.06;   // …dont la hauteur tremble
        cl.connect(clg); clg.connect(cf.frequency);
        const cg = c.createGain(); cg.gain.value = 0; cs.connect(cf); cf.connect(cg); cg.connect(bus.entree);
        const t = c.currentTime;
        [osc, sous, j1, j2, cl].forEach(o => o.start(t)); ns.start(t, Math.random()); rs.start(t, Math.random()); cs.start(t, Math.random());
        return { c: c, osc: osc, sous: sous, pb: pb, g: g, rg: rg, cg: cg, ng: ng, sources: [osc, sous, j1, j2, cl, ns, rs, cs], noeuds: [am, amProf, jg, pb, nf, ng, g, rf, rg, cf, clg, cg] };
      }
      function arreter() {
        if (!m) return;
        const M = m; m = null;
        try { const t = M.c.currentTime; [M.g, M.rg, M.cg].forEach(x => x.gain.setTargetAtTime(0, t, 0.03)); M.sources.forEach(s => s.stop(t + 0.15)); } catch (e) {}
        setTimeout(() => { M.sources.concat(M.noeuds).forEach(x => { try { x.disconnect(); } catch (e) {} }); }, 300);
      }
      return {
        // regime 0..1 (vitesse), gaz 0..1 (accélérateur), glisse 0..1 (dérapage), roulement 0..1 (vitesse au sol), actif
        regler(r) {
          const c = brancher();
          if (!r || !r.actif || !c || !bus || !marche(c) || volume() <= 0) { arreter(); return; }
          if (m && m.c !== c) arreter();
          if (!m) { try { m = creer(c); } catch (e) { m = null; return; } }
          majVolume(c);
          const t = c.currentTime, reg = clamp(r.regime || 0, 0, 1), gaz = clamp(r.gaz || 0, 0, 1);
          const f = P.ralenti + (P.max - P.ralenti) * Math.pow(reg, 0.85) + gaz * (P.max - P.ralenti) * 0.06;
          m.osc.frequency.setTargetAtTime(f, t, 0.07); m.sous.frequency.setTargetAtTime(f / 2, t, 0.07);
          m.pb.frequency.setTargetAtTime(500 + 900 * reg + 2200 * gaz, t, 0.09);
          m.ng.gain.setTargetAtTime(P.grain * (0.25 + 0.6 * gaz), t, 0.08);
          m.g.gain.setTargetAtTime(P.gain * (0.55 + 0.25 * reg + 0.3 * gaz), t, 0.08);
          m.rg.gain.setTargetAtTime(P.roulement * clamp(r.roulement == null ? reg : r.roulement, 0, 1), t, 0.1);
          const gl = clamp(r.glisse || 0, 0, 1);
          m.cg.gain.setTargetAtTime(P.crissement * gl * gl, t, gl > 0 ? 0.05 : 0.12);
        },
        arreter: arreter,
      };
    },
  };
  return api;
}
