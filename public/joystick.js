// Joystick tactile flottant — partagé par les 6 jeux, sur téléphone (≤ 600 px).
//
// Choix utilisateur du 23/09, après essai au pouce sur /manette.html : joystick à 82 px (Pixel 7 Pro).
// Le stick naît SOUS LE POUCE, où qu'il se pose dans sa zone : plus rien à viser.
//
// Il ne réimplémente aucune commande : il ACTIONNE les boutons tactiles existants de chaque jeu
// (événements pointerdown/pointerup synthétiques, comme le relais vieil-iOS d'app.js). Les 6 jeux
// gardent donc leur logique d'entrée intacte, et la croix reste disponible en réglage.
//
// Compatibilité vieil iOS : événements tactiles bruts (Pointer Events n'existe qu'à partir d'iOS 13),
// ni `?.` ni `??`.

const TAILLE = 82;                                     // réglage choisi : anneau 1,7×, bouton 0,62×
const ZONE_MORTE = 0.28;                               // fraction du rayon sans effet (le pouce tremble)
const HYST = 1.25;                                     // 4 directions : il faut NETTEMENT dominer pour changer d'axe

// Boutons actionnés par jeu. `mode` 4 = une seule direction à la fois (grilles, virages) ;
// 8 = composantes indépendantes (Tanks : avancer ET tourner en même temps, comme au clavier).
const CARTES = {
  tron:  { mode: 4, haut: 'trUp', bas: 'trDown', gauche: 'trLeft', droite: 'trRight' },
  snake: { mode: 4, haut: 'snUp', bas: 'snDown', gauche: 'snLeft', droite: 'snRight' },
  bomb:  { mode: 4, haut: 'bmUp', bas: 'bmDown', gauche: 'bmLeft', droite: 'bmRight' },
  tank:  { mode: 8, haut: 'tkFwd', bas: 'tkBack', gauche: 'tkLeft', droite: 'tkRight' },
  // Sumo : mouvement continu en 8 directions (diagonales normalisées côté serveur) — un joystick 4 voies
  // interdirait de contourner un adversaire en biais, geste de base pour le déborder vers le bord.
  sumo:  { mode: 8, haut: 'smUp', bas: 'smDown', gauche: 'smLeft', droite: 'smRight' },
  // Foot : course continue en 8 directions, comme le Sumo (le tir part dans la direction tenue)
  foot:  { mode: 8, haut: 'ftUp', bas: 'ftDown', gauche: 'ftLeft', droite: 'ftRight' },
};

let jeu = null, projeteur = null;                      // projeteur(dx, dy) → id | null (Pong : dépend du bord)
let doigt = null, ox = 0, oy = 0, axe = '';            // doigt suivi, origine du stick, axe retenu (mode 4)
let appuyes = [];                                      // ids actuellement « enfoncés »
let zoneActive = null;

function evenement(type) {
  try { return new Event(type, { bubbles: true, cancelable: true }); }
  catch (e) { const ev = document.createEvent('Event'); ev.initEvent(type, true, true); return ev; }
}
function actionner(ids) {                              // relâche ce qui ne l'est plus, enfonce le nouveau
  for (const id of appuyes) if (ids.indexOf(id) < 0) { const el = document.getElementById(id); if (el) el.dispatchEvent(evenement('pointerup')); }
  for (const id of ids) if (appuyes.indexOf(id) < 0) { const el = document.getElementById(id); if (el) el.dispatchEvent(evenement('pointerdown')); }
  appuyes = ids;
}

// HYSTÉRÉSIS sur TOUS les seuils : on entre à 100 %, on ne ressort que sous SORTIE × le seuil.
// Sans elle, un pouce posé pile sur un seuil basculait « enfoncé / relâché » à chaque touchmove (jusqu'à
// 120/s) : autant de messages, et la limite de débit du hub risquait de jeter justement le DERNIER —
// le relâchement —, laissant la raquette ou le tank bloqué (relevé par la revue contradictoire du 23/09).
const SORTIE = 0.75;
const tient = (id, v, seuil) => v > (appuyes.indexOf(id) >= 0 ? seuil * SORTIE : seuil);

function cibles(dx, dy) {                              // dx, dy normalisés par le rayon (−1..1)
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d < (appuyes.length ? ZONE_MORTE * SORTIE : ZONE_MORTE)) { axe = ''; return []; }
  if (projeteur) { const id = projeteur(dx, dy, appuyes[0] || null); return id ? [id] : []; }
  const c = CARTES[jeu];
  if (!c) return [];
  if (c.mode === 8) {
    const out = [], s = 0.38;
    if (tient(c.haut, -dy, s)) out.push(c.haut); else if (tient(c.bas, dy, s)) out.push(c.bas);
    if (tient(c.gauche, -dx, s)) out.push(c.gauche); else if (tient(c.droite, dx, s)) out.push(c.droite);
    return out;
  }
  const ax = Math.abs(dx), ay = Math.abs(dy);
  if (axe === 'h' && ay > ax * HYST) axe = 'v';
  else if (axe === 'v' && ax > ay * HYST) axe = 'h';
  else if (!axe) axe = ax >= ay ? 'h' : 'v';
  return [axe === 'h' ? (dx < 0 ? c.gauche : c.droite) : (dy < 0 ? c.haut : c.bas)];
}

function dessiner(zone, x, y, visible) {
  const ring = zone.firstChild, knob = zone.lastChild;
  zone.className = 'joyzone' + (visible ? ' actif' : '');   // masque la consigne pendant l'appui
  ring.className = 'joyring' + (visible ? ' on' : '');
  knob.className = 'joyknob' + (visible ? ' on' : '');
  if (!visible) return;
  const R = TAILLE * 0.85, k = TAILLE * 0.31;
  ring.style.left = (ox - R) + 'px'; ring.style.top = (oy - R) + 'px';
  knob.style.left = (x - k) + 'px'; knob.style.top = (y - k) + 'px';
}

function suivre(zone, t, fin) {
  const r = zone.getBoundingClientRect();
  const x = t.clientX - r.left, y = t.clientY - r.top;
  if (fin) { doigt = null; axe = ''; actionner([]); dessiner(zone, 0, 0, false); return; }
  const R = TAILLE * 0.85 * 0.9;
  let dx = x - ox, dy = y - oy, d = Math.sqrt(dx * dx + dy * dy);
  if (d > R) { dx = dx / d * R; dy = dy / d * R; }
  dessiner(zone, ox + dx, oy + dy, true);
  actionner(cibles(dx / R, dy / R));
}

function brancher(zone) {
  zone.addEventListener('touchstart', e => {
    e.preventDefault();
    if (doigt !== null) return;                        // un seul pouce pilote le stick
    const t = e.changedTouches[0], r = zone.getBoundingClientRect();
    doigt = t.identifier; zoneActive = zone;
    ox = t.clientX - r.left; oy = t.clientY - r.top;
    suivre(zone, t, false);
  }, { passive: false });
  zone.addEventListener('touchmove', e => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === doigt) { e.preventDefault(); suivre(zone, t, false); }
    }
  }, { passive: false });
  const fin = e => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === doigt) { e.preventDefault(); suivre(zone, t, true); }
    }
  };
  zone.addEventListener('touchend', fin, { passive: false });
  zone.addEventListener('touchcancel', fin, { passive: false });
}

function creerZone() {
  const z = document.createElement('div');
  z.className = 'joyzone';
  z.setAttribute('aria-hidden', 'true');              // doublon tactile des boutons, qui restent dans le DOM
  z.innerHTML = '<div class="joyring"></div><div class="joyknob"></div>';
  brancher(z);
  return z;
}

/** À appeler une fois : pose une zone de joystick dans la manette de chaque jeu. */
export function initJoystick() {
  document.querySelectorAll('.gpad').forEach(g => g.insertBefore(creerZone(), g.firstChild));
  // Pong : ses flèches ▲▼ sont dans `.stage`, sous le plateau sur téléphone.
  const st = document.querySelector('#pong-root .stage');
  if (st) st.appendChild(creerZone());
  // Rien ne doit rester enfoncé si la page passe en arrière-plan en plein geste.
  document.addEventListener('visibilitychange', () => { if (document.hidden) relacherJoystick(); });
  window.addEventListener('blur', relacherJoystick);
}

/** Jeu affiché : choisit la table de boutons (ou le projeteur propre au jeu, cf. Pong). */
export function joystickPour(id, proj) {
  relacherJoystick();
  jeu = id; projeteur = typeof proj === 'function' ? proj : null;
}

export function relacherJoystick() {
  if (zoneActive) dessiner(zoneActive, 0, 0, false);
  doigt = null; axe = ''; actionner([]);
}
