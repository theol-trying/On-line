// Points de boucle des morceaux de public/pistes.js — à COLLER dans la console du navigateur, sur le site lancé
// en local (http://localhost:3000). Décode chaque morceau et affiche, prêts à recopier dans pistes.js :
//   debut = premier échantillon audible (silence de tête retiré) ;
//   fin   = dernier quart de seconde à moins de 12 dB sous le niveau moyen du morceau (la queue de fondu et
//           les ~2,5 s de silence final sont coupées ; piste.js fond la fin dans le début sur FONDU_BOUCLE).
(async () => {
  const { PISTES } = await import('/pistes.js');
  const rms = (d, a, b) => { a = Math.max(0, a | 0); b = Math.min(d.length, b | 0); let s = 0; for (let i = a; i < b; i++) s += d[i] * d[i]; return Math.sqrt(s / Math.max(1, b - a)); };
  const lignes = [];
  for (const id of Object.keys(PISTES)) for (const role of ['menu', 'jeu']) {
    const p = PISTES[id][role];
    const buf = await new OfflineAudioContext(2, 44100, 44100).decodeAudioData(await (await fetch('/music/' + p.f)).arrayBuffer());
    const sr = buf.sampleRate, n = buf.length, L = buf.getChannelData(0), R = buf.numberOfChannels > 1 ? buf.getChannelData(1) : L;
    const m = new Float32Array(n); for (let i = 0; i < n; i++) m[i] = (L[i] + R[i]) / 2;
    let s0 = 0; while (s0 < n && Math.abs(m[s0]) < 0.001) s0++;
    let s1 = n - 1; while (s1 > 0 && Math.abs(m[s1]) < 0.001) s1--;
    const seuil = rms(m, 0, n) * Math.pow(10, -12 / 20), W = Math.round(sr * 0.25);
    let e = s1; while (e - W > s0 && rms(m, e - W, e) < seuil) e -= W;
    lignes.push(`${id}.${role} : { f: '${p.f}', debut: ${+(s0 / sr).toFixed(3)}, fin: ${+(e / sr).toFixed(3)} }   (durée ${(n / sr).toFixed(2)} s)`);
  }
  console.log(lignes.join('\n'));
})();
