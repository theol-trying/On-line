// Graine du jour — « Défi du jour ».
// Objectif : pendant 24 h, tout le monde affronte EXACTEMENT la même carte (mêmes murs,
// mêmes barils, mêmes téléporteurs), ce qui rend les scores de la journée comparables.
// La graine ne dépend que de la date (UTC) : aucun stockage, aucune synchronisation.
// Zéro dépendance : un FNV-1a pour hacher la date + un mulberry32 pour le générateur.

export function dayKey(d) { return (d || new Date()).toISOString().slice(0, 10); }   // 'AAAA-MM-JJ' (UTC)

export function seedFrom(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}

// Générateur pseudo-aléatoire déterministe, même interface que Math.random.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// rng du jour pour un contexte donné (jeu + style d'arène + nb de joueurs) :
// deux configurations différentes donnent deux cartes différentes, mais toujours
// les mêmes pour tout le monde ce jour-là.
export function dailyRng(tag) { return mulberry32(seedFrom(dayKey() + '|' + tag)); }
