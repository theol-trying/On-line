// Moteur de musique générative PARTAGÉ — WebAudio uniquement, zéro dépendance, aucun fichier audio.
// Chaque jeu définit un THÈME data-driven (tempo + couches basse/mélodie/nappe/percussions) et pilote
// une INTENSITÉ : 0 = lobby/calme (couches min:0), 1 = en jeu, 2 = climax (mort subite, duel final…).
// Le moteur lit a11y.music en continu : le réglage 🎵 du shell (dé)coupe la musique de tous les jeux.
//
// API : const m = createMusic(() => actx, () => a11y, THEME); m.start(); m.setIntensity(0|1|2); m.stop();
// THÈME : { bpm, bpmBoost? (ajouté au bpm en climax), vol? (master 0..1), root (Hz), len? (pas, 16 = 1 mesure),
//   layers: [ { seq:[demi-tons | null | [accord]], wave?, oct?, gain?, dur? (en pas), min? (intensité mini) }
//             { drums:'K.H.S…' (K=grosse caisse, S=caisse claire, H=charley, .=silence), gain?, min? } ] }
export function createMusic(getCtx, getA11y, theme) {
  let timer = null, ctx = null, master = null, noiseBuf = null;
  let nextT = 0, step = 0, intensity = 0;
  const LEN = theme.len || 32;

  function ensure() {                                  // (re)branche le moteur sur l'AudioContext du jeu (créé au 1er geste utilisateur)
    const c = getCtx(); if (!c) return null;
    if (c !== ctx) {
      ctx = c;
      master = c.createGain(); master.gain.value = 0; master.connect(c.destination);
      const sr = c.sampleRate, b = c.createBuffer(1, Math.floor(sr * 0.4), sr), d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;   // bruit blanc partagé (percussions)
      noiseBuf = b; nextT = 0;
    }
    return c;
  }
  function osc(t, freq, dur, wave, gain) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = wave; o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
  }
  function drum(t, kind, vel) {
    if (kind === 'K') {                                // grosse caisse : sinus qui plonge
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(105, t); o.frequency.exponentialRampToValueAtTime(38, t + 0.11);
      g.gain.setValueAtTime(0.5 * vel, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
      o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.15);
      return;
    }
    const s = ctx.createBufferSource(), g = ctx.createGain(), f = ctx.createBiquadFilter();   // S/H : bruit filtré
    s.buffer = noiseBuf; f.type = 'highpass'; f.frequency.value = kind === 'H' ? 6500 : 1700;
    const d = kind === 'H' ? 0.04 : 0.12;
    g.gain.setValueAtTime((kind === 'H' ? 0.10 : 0.22) * vel, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + d + 0.02);
  }
  function playStep(t, st, spb) {
    for (const L of theme.layers) {
      if (intensity < (L.min || 0)) continue;
      if (L.drums) { const ch = L.drums[st % L.drums.length]; if (ch && ch !== '.') drum(t, ch, L.gain == null ? 1 : L.gain); continue; }
      const n = L.seq[st % L.seq.length];
      if (n == null) continue;
      const dur = (L.dur || 1.7) * spb, base = theme.root * Math.pow(2, L.oct || 0);
      const one = s => osc(t, base * Math.pow(2, s / 12), dur, L.wave || 'triangle', L.gain == null ? 0.04 : L.gain);
      Array.isArray(n) ? n.forEach(one) : one(n);
    }
  }
  function sched() {                                   // ordonnanceur à fenêtre d'avance (220 ms) sur l'horloge audio
    const c = ensure(), A = getA11y();
    const on = !!(c && c.state === 'running' && A && A.music);
    if (master && c) master.gain.setTargetAtTime(on ? (theme.vol == null ? 0.5 : theme.vol) : 0, c.currentTime, 0.12);
    if (!on) { nextT = 0; return; }
    const spb = 60 / (theme.bpm + (intensity >= 2 ? (theme.bpmBoost || 0) : 0)) / 4;   // durée d'une double-croche
    if (!nextT || nextT < c.currentTime) { nextT = c.currentTime + 0.08; step = 0; }
    while (nextT < c.currentTime + 0.22) { playStep(nextT, step, spb); step = (step + 1) % LEN; nextT += spb; }
  }
  function sting(kind) {                               // petite fanfare ponctuelle (kill, victoire…) par-dessus la musique
    const c = ensure(), A = getA11y();
    const st = theme.stingers && theme.stingers[kind];
    if (!st || !c || c.state !== 'running' || !A || !A.music) return;
    const t0 = c.currentTime + 0.02, rate = st.rate || 0.075, base = st.base || theme.root * Math.pow(2, st.oct == null ? 1 : st.oct);
    st.notes.forEach((n, i) => { (Array.isArray(n) ? n : [n]).forEach(s => osc(t0 + i * rate, base * Math.pow(2, s / 12), st.dur || 0.16, st.wave || 'triangle', st.gain || 0.05)); });
  }
  return {
    start() { if (!timer) timer = setInterval(sched, 90); },
    stop() { if (timer) { clearInterval(timer); timer = null; } if (master && ctx) master.gain.setTargetAtTime(0, ctx.currentTime, 0.06); nextT = 0; },
    setIntensity(v) { intensity = Math.max(0, Math.min(2, v | 0)); },
    sting,
  };
}
