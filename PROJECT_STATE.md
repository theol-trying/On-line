# Plateforme multijeux en ligne — état du projet (point de reprise)

> Dossier : `C:\Users\theoi\Documents\PONG\pong-line\` (source unique de vérité).
> **Plateforme multijeux** : un hub Node.js **autoritatif** sert plusieurs jeux sélectionnables ;
> **une seule partie active à la fois** (jeu choisi dans un lobby commun).
> **Jeux : Pong · Tron · Tanks · Bomberman · Snake · Sumo · Foot.** **Zéro dépendance** (WebSocket implémenté à la main). Un appareil par joueur.
> **En production** : GitHub `theol-trying/On-line` → **Render** (HTTPS/`wss://`) + **Upstash Redis** (classement + avatars).
> Consignes projet permanentes : **zéro dépendance npm, zéro build, aucun fichier binaire** ; secrets via `process.env` uniquement.
> L'assistant gère **git** (commit + push) depuis septembre 2026, et **Node est installé depuis le 21/09/2026** :
> il lance donc lui-même le serveur et les tests d'intégration (voir « Tester » ci-dessous). `npm install` reste proscrit.

## Lancer
```
cd C:\Users\theoi\Documents\PONG\pong-line
node server.js
```
Ouvre l'URL **LAN** affichée (`http://<IP>:3000`) sur chaque appareil (même Wi-Fi ; autoriser Node sur réseau privé au 1er lancement).
Client en **modules ES** → passe **obligatoirement** par le serveur (pas en `file://`). Après modif : **Ctrl+F5**.
Test solo (1 PC + 1 tél) : ouvrir **plusieurs onglets PC** = plusieurs joueurs (mettre un **pseudo différent** par onglet).
Pages annexes : `/stats?game=<id>` (HTML lecture seule), `/leaderboard.json?game=<id>` (`<id>` = pong|tron|tank|bomb).

## Tester (depuis l'installation de Node, 21/09/2026)
```
node --check <fichier>        # syntaxe (ne détecte PAS les identifiants manquants à l'exécution)
node server.js                # serveur local sur :3000 ; .claude/launch.json permet aussi preview_start
HUB_TRACE=1 node server.js    # journalise chaque diffusion : « f=<tick> stride=<n> full=<bool> membres=<n> »
```
**Sonde d'intégration** : Node ≥ 22 fournit un `WebSocket` natif, donc un simple script `.mjs` peut ouvrir 10 vrais
clients, lancer une manche et vérifier arènes, protocole et débit — sans aucune dépendance. C'est ainsi qu'ont été
attrapés le crash `CELL is not defined` et le delta envoyé aux arrivants (voir ci-dessous).
> **Leçon** : `node --check` ne suffit pas. Le crash de Bomberman était un `ReferenceError` à l'exécution,
> invisible pour un contrôle de syntaxe **et** pour un banc d'essai qui n'exécute pas le code.

## Architecture (modules ES)
```
server.js              HTTP statique (public/) + routes /stats /leaderboard.json (par ?game=) + attach(hub)
ws.js                  Mini-WebSocket RFC 6455 (handshake SHA-1, frames, ping/pong, close) + parse token ?t= ; attachWebSocket
hub.js                 Registre GAMES + identité/pseudo/token + UNE salle active + lobby + routage + boucle de tick.
                       Optim : diffusion ~4 Hz hors jeu, boucle suspendue si 0 membre. Exports attach(server), GAME_META.
leaderboard.js         Persistance générique { gameId:{board,history} } ; board, history, pushHistory, save, reset,
                       lbMsg, markDirty, dirtyGames, anyDirty, clearDirty, initLeaderboard
games/<id>/server.js          Logique autoritative du jeu <id> : create(room) -> instance ; default { meta, create }
public/games/<id>/shared.js   Constantes géométriques du jeu (servies au navigateur ET importées par Node côté serveur)
public/games/<id>/client.js   Module client du jeu : init/onState/onMessage/onLb/onA11y/teardown ; rendu, HUD, sons, inputs
public/music.js               Moteur de musique générative PARTAGÉ (WebAudio, zéro asset) ; thème + intensité par jeu
public/app.js          SHELL client : réseau (WS+token), pseudo, menu de jeux, accessibilité, panneaux modaux,
                       import dynamique du module actif + délégation (tampon des messages le temps du chargement)
public/index.html      Chrome shell + une racine .game-root par jeu (#pong-root #tron-root #tank-root #bomb-root)
public/style.css       Styles + thèmes (neon/crt/light) + panneaux modaux + dock barre + menu + dpad/tankpad + responsive
game.js                OBSOLÈTE (vidé) — ancienne logique Pong, déplacée dans games/pong/server.js
package.json           "type":"module" ; leaderboard.json = données runtime (format { gameId:{board,history} })
```
Pour **ajouter un jeu** : créer `games/<id>/server.js` + `public/games/<id>/{client.js,shared.js}`, puis l'importer dans `hub.js` (objet `GAMES`). Rien d'autre.

## Contrat « jeu »
- **Serveur** (`create(room)` → instance) : `onJoin(member)->{role,seat?,hello?}`, `onLeave(member)`, `onRename(member)`,
  `onMessage(member,msg)`, `tick()->snapshotObj`, `isIdle()`. `room` = { members, memberById, broadcast, send }.
  `default { meta:{id,name,min,max,tickHz,desc}, create }`. Le snapshot DOIT contenir `gs` (pour le throttle hub).
- **Client** (`default` objet) : `init(ctx)`, `onState(snap)`, `onMessage(m)`, `onLb({board,history})`, `onA11y()`, `teardown()`.
  `ctx` = { root, send (→ enveloppe `{t:'g',m}`), a11y (partagé), togglePanel, closePanels }.

## Protocole réseau
- **Lobby** : S→C `hello{you{id,name,token},games:[meta],active}`, `room{active,players:[{id,name,role}]}`.
  C→S `name{name}`, `pick{id}` (changer de jeu — seulement si salle idle).
- **En jeu** : C→S `g{m}` (routé vers `onMessage`) ; S→C `g{g,m}` (ex. `welcome{seat}`), `state{g,…snapshot}` (au tickHz du jeu), `lb{g,board,history}`.
- Token de reprise via URL WS `?t=<token>` (géré par le hub). Le shell **tamponne par jeu** les messages tant que le module n'est pas chargé.
- États communs : `lobby` / `countdown` (3·2·1) / `play` / `paused` / `over`. `isIdle()` = lobby|over → réglages éditables.

---

## Jeu : PONG  (`pong`, 2–6 joueurs, tickHz 60)
- Terrain **polygonal adaptatif** (2=carré face-à-face, 3=triangle, 4=carré, 5=penta, 6=hexa ; arêtes libres = murs).
- **Renvoi piloté par le point d'impact** : centre = tout droit, bord = fort angle. `PADDLE_MAX_ANGLE=1.05`, `HIT_SPEEDUP=1.05`.
- Presets 🎮 Classique/Rapide/Chaos + Options ⚙ (vies 1–9, vitesse, power-ups, accél → preset « Personnalisé »).
- Règles de match : victoire (survivant/manches N/éliminations N), mort subite (off/rétrécit/accélère), service, handicap 👑.
- Power-ups : multi, grow, shield, ghost, invert, shrinkT, slow, **🧱 blocker** (bumper temporaire), **🧲 magnet** (aimante les balles vers ta raquette, vitesse conservée) (+ négatifs mini/flip/speed, **∅ invis** = balle quasi invisible). Immunité 3 s.
- **Bumpers rotatifs** (option ⚙ `bumpers`) : 2 plots orbitent au centre et font rebondir les balles (collision cercle `ballBumpers`). Le blocker pose un plot statique temporaire (`BLOCKER_TICKS=8 s`, max `MAX_BUMPERS`).
- Bots (Facile/Normal/Difficile/**Insane**), spectateurs (7e+, lâchent un power-up 🎁), équipes FFA/2v2/2v2v2/3v3.
- Commandes : ↑↓ / ←→ / WASD, **Espace** lancer, **P/Échap** pause, boutons tactiles ▲▼.
- Messages C→S : input{up,dn}, start, pause, bots, mode, preset, opt{op,d}, vote, lbreset.
- Tuning : R=232, PAD_LEN=84, PAD_W=12, PAD_OFF=8, BALL_R=8, PAD_SPD=5.5, MIN_SPD=2.6. Vitesses init/max 3.6/10·4.6/14·6.2/20. Accél ×1.03/75 ticks.

## Jeu : TRON  (`tron`, 2–6, tickHz 15)
- Grille 50×50 (CELL 10, ARENA 500). Traînée = file de cellules `p.cells`, **compressée en coins** pour le réseau.
- **Bonus** : `»` vitesse (temp), `◌` fantôme (traverse les traînées), `✄` coupe sa propre traînée, **`➤` téléport court** (`BLINK_DIST=4`), **`⊘` casse-mur** (traverse/détruit 1 traînée, usage unique), **`⇄` inversion** (contrôles adverses inversés `INVERT_TICKS=4 s`).
- **Killcam** (client) : zoom bref sur ta propre collision ; alerte « ⇄ CONTRÔLES INVERSÉS » quand tu es affecté.
- **Boost à la jauge** : maintenir **Maj** (ou bouton ⚡) → 2 cases/tick, jauge `BOOST_MAX=100` (régen 0.7 / coût 2.6).
- **Rétrécissement** d'arène : `SHRINK_START=22 s`, un anneau toutes les `SHRINK_EVERY=2 s` (cellules = WALL -2).
- **Traînée ∞ / courte** (bouton `fade`) : en mode court, la queue s'efface au-delà de `TRAIL_LIFE=130` cases.
- Équipes FFA/2v2/2v2v2/3v3 (bouton ⚔). Dernière équipe/joueur debout gagne.
- **Collisions simultanées** : choc frontal (même case) ET croisement (échange de cases) → les deux meurent (pré-passe avant déplacement).
- Commandes : ↑↓←→ / WASD, **Maj** boost, **Espace** lancer, **P** pause ; tactile : dpad + ⚡.
- Messages C→S : dir{d}, boost{on}, start, pause, mode, fade, lbreset.

## Jeu : TANKS  (`tank`, 2–6, tickHz 30)
- Arène continue 600×600, **grille de blocs 15×15** (1=solide, 2=destructible). **Maps PROCÉDURALES**.
- **Génération** (bouton 🧱) : styles `Symétrique`(180°) / `Aléatoire` / `4 coins` ; densité 0.14 ; **connectivité garantie**
  (24 essais BFS : spawns reliés + ≥60 % libre ; repli piliers) ; spawns dégagés ; murs destructibles semés (0.42).
- **Power-ups** : `»` rapide, `⋔` triple, `⛉` bouclier(×2), `👟` vitesse, `➳` perçant (1 mur), `◈` mine, **🔧 réparation** (+1 vie, max 3), **⚡ EMP** (étourdit les ennemis proches `EMP_R`, `EMP_T=2 s` : ni mouvement ni tir), **🚀 missile guidé** (`HOMING_T=8 s`, les obus tirés braquent vers l'ennemi le plus proche, braquage `HOMING_TURN`, vitesse conservée), **👁 camouflage** (`CAMO_T=6 s`, quasi invisible pour les ennemis — alpha 0.1 côté client — sauf s'ils ont le radar ; soi-même et alliés vus estompés), **📡 radar** (`RADAR_T=10 s`, révèle les tanks camouflés et cercle les ennemis détectés).
- **Hasards d'arène** (semés par `buildArena` sur des cases libres hors spawns, traversables → n'affectent pas la connectivité) : **🛢 barils explosifs** (`BARREL_COUNT=4` ; un obus qui touche un baril déclenche `detonateBarrels` → `explode` : dégâts de zone `BARREL_DMG_R` à **tous** les tanks proches + casse les murs cassables autour ; **chaîne** les barils voisins `BARREL_CHAIN`) ; **zones de boue** (`MUD_COUNT=10` cases, `mudSet` ; un tank dont le centre est sur une case boueuse voit sa vitesse ×`MUD_MUL=0.5`).
- **Barre de vie** (client) dessinée au-dessus de chaque tank (3 segments = vies ; rouge à 1 vie ; masquée si le tank est camouflé/invisible pour toi). Snapshot : `barrels[{x,y}]`, `mud[idx…]`, obus `h` (guidé), joueur `homing/camo/radar` + `buffs` (timers dégressifs).
- **Bots IA** (bouton 🤖) : `botCount` 0..maxBots ; `botThink` (vise l'ennemi le plus proche, **avance en tournant**, tire aligné, pose des mines, **ne voit pas les camouflés** sans radar). **Évitement ENGAGÉ** (`botAvoidUntil/Dir/Back` : bloqué → choisit un côté ± recul et s'y tient 10-26 ticks — sinon le bot « tremble » sur place) + **errance** (`botWanderUntil/Turn`) sans cible ; états purgés au startGame (tick repart à 0). **Bots exclus du leaderboard** (`p.bot → continue` dans recordRound, comme Pong). Démarrage possible dès **1 humain + 2 participants** (humains+bots). Sièges de bots protégés contre la reprise par un humain.
- **Mines** : pose **E/Maj** (bouton ◈), s'arment (`MINE_ARM`), explosent au passage d'un ennemi (`MINE_R=30`). Couleur = poseur.
- Obus à **rebonds** (`MAX_BOUNCE=3`), `MAX_SHELLS=2` (triple = salve). 3 vies + respawn + invuln (`INVULN=45`).
- **Collision tank-tank** + légère poussée. Équipes (⚔) + **mode manches** 🏁 (`WIN_TARGETS=[1,3,5]`, « REMPORTE LE MATCH »).
- Commandes : ←→ / AD tourner, ↑↓ / WS avancer/reculer, **Espace** tirer, **E/Maj** mine, **P** pause ; tactile ↺▲▼↻🔥◈.
- Messages C→S : input{left,right,fwd,back,fire}, mine, start, pause, mode, bots, arena, wintarget, ff, lbreset.

## Jeu : BOMBERMAN  (`bomb`, 1–6, tickHz 30)
- Grille 13×13 (CELL 40), cadre solide. **Maps PROCÉDURALES** (bouton 🧱, mêmes styles/connectivité, densité 0.18, murs 0.72).
- **Bonus** : 💣 +bombe, 🔥 +portée, 👟 +vitesse, 🦵 poussée, 📡 détonateur, 👻 traverse-murs (**temporaire** `GHOST_DUR=10 s`, prolongé tant qu'on est DANS un mur — anti-coincé `inSoftWall`), 🧤 gant (lancer), 🛡 bouclier, **📏 bombe en ligne** (pose une rangée devant soi via `placeBombAt`). Les bombes de la **pose auto** (malus ⏱) sont **toujours minutées** même avec 📡 (`placeBomb(p, forceFuse)`) — sinon bombes télécommandées orphelines.
- **Malus** (icône rouge) : 🔀 inversion, 🐌 lenteur, ⏱ pose auto (durée `DUR=8 s`), **💀 skull** (affliction aléatoire `SKULL_KINDS`, **contagieuse au contact**).
- **🌀 Téléporteurs** (cellule `3`, 1 paire/map placée hors connectivité via `warpOf`) : entrée sur un portail → sortie au jumeau (anti ping-pong via `lastCell`, désactivé si la sortie est ensevelie par la mort subite).
- **Action** (X/Maj, bouton 🧤) : avec gant → lance la bombe sous soi ; avec détonateur → fait exploser ses bombes 📡.
- Bombes : `BOMB_FUSE=90`, **chaînage**, explosion en croix (casse 1 mur par branche). Portée + compte à rebours affichés (client).
- **Mort subite** : `SD_START=65 s`, blocs qui tombent en spirale (`SD_SPIRAL`). Équipes (⚔). **Solo** = bac à sable (hors classement).
- **Mode revanche** (bouton ☠, OFF par défaut, ≥2 joueurs) : à la mort, le joueur ne disparaît pas → devient **revenant** sur l'**anneau du bord** (`RING`, sens horaire) ; il se déplace le long du cadre (`revMove`, `REV_MOVE_EVERY=5`) et **pose des bombes vers la case intérieure adjacente** (`revBomb`/`innerCell`). S'il élimine un **vivant** depuis le bord, il **ressuscite** (`reviveRevenant` : spawn ou `freeInteriorCell`, invuln 2 s). Fin via `roundOver()` : plus aucun vivant **ou** un seul camp présent (vivant **ou** revenant) ; **terminaison garantie par la mort subite** (l'arène se remplit → plus de case de résurrection). `endRound` revanche : gagnant = seul camp présent, sinon meilleur total de kills ; places = vivants d'abord puis par `elimTick`. Snapshot : `revenge`, joueur `rvn`. Client : revenant translucide sur le bord + case visée (pour soi), badge HUD « ☠ revanche ».
- Commandes : ↑↓←→ / WASD, **Espace/B** bombe, **X/Maj** action, **P** pause ; tactile : dpad + 💣 + 🧤.
- Messages C→S : input{up,down,left,right}, bomb, action, start, pause, mode, gen, ff, lbreset.

## Jeu : SNAKE  (`snake`, 1–6, tickHz 12)
- Grille 30×30 (CELL 17, ARENA 510). Chaque joueur = un serpent (file de cellules). FFA ou équipes (⚔, dernier **camp** en vie).
- **Manger** : pastilles 🍎 (`FOOD_COUNT=4` en permanence) → +`GROW_PER_FOOD=2` segments + score. Longueur de départ `INIT_LEN=4`.
- **Types de nourriture** : 🍎 pomme (+1), 🟡 **dorée** (+3 pts), 🍄 **champignon** (raccourcit `SHRINK_AMT=4`), 👻 **fantôme** (`ghostUntil`, traverse les corps `GHOST_TICKS=5 s`, pas murs/rochers). *(baie de vitesse écartée : casserait le pas-de-temps simultané.)*
- **Serpent mort → nourriture** : son corps laisse des pastilles (1 cellule/2, plafond 15) que les autres ramassent (slither-like).
- **Variantes** (bouton 🐍) : `Classique` / `Murs traversants` (wrap des bords) / `Obstacles` (rochers `ROCK_COUNT=16` loin des têtes). En wrap, `corners()` **coupe le chemin à chaque saut** (segments séparés par `null` ; le client relève le crayon) — sinon la queue se dessinait d'un bord à l'autre.
- **Mode de partie** (bouton 🏁, orthogonal aux variantes, OFF par défaut) : `Survie` (classique, dernier en vie) **ou** `Food-rush` (`RUSH_FOOD=12` pastilles en permanence ; **premier à `RUSH_TARGET=20` points gagne immédiatement** via `endRound(team)` ; si fin par élimination, gagnant = meilleur score via `bestScoreTeam()`). Snapshot : `rush`, `rushTarget`. Client : bouton, indicateur `🏁 lead/20` en jeu, mention au lobby, classement final au score.
- **Mort** : tête qui sort de la grille **ou** entre dans un corps de serpent (le sien ou un autre) ; choc frontal (même case) = les deux meurent.
  Crédit kill au propriétaire de la cellule touchée. Un serpent mort **disparaît** (n'est plus un obstacle).
- Résolution **simultanée** (têtes calculées d'un coup) ; la **queue se libère** dans le tick (on peut suivre une queue) sauf si croissance.
- **Solo** (1 joueur) = entraînement/score (hors classement). Dernier en vie gagne en multi.
- Commandes : ↑↓←→ / WASD (pas de demi-tour), **Espace** lancer, **P/Échap** pause ; tactile : dpad. Pas de bonus/boost (pur classique).
- Snapshot : `food[{x,y,t}]`, `rocks[]`, `variant`, `players[{head,path(corners),len,score,ghost,…}]`. Messages C→S : dir{d}, start, pause, abort, mode, variant, lbreset.
- Leaderboard : games, wins, kills, K/D, **meilleur score** 🍎, meilleure survie.

## Jeu : SUMO  (`sumo`, 2–10, tickHz 30)
- **Dohyō vu de dessus**, 2 à 10 lutteurs (humains + bots), FFA ou équipes (⚔). On **pousse les autres hors du cercle** :
  un lutteur dont le **centre** sort du cercle (distance au centre > rayon ACTUEL) est éliminé. Dernier lutteur (ou dernière
  équipe) dans le cercle gagne la manche. Compte à rebours 3 s comme Tron. Modèle de code : Tron (structure) + Tanks (mouvement continu).
- **Arène à l'échelle** (`public/games/sumo/shared.js` : `AR0=600`, `RING0=240`, `PR=22`) : `k = 1 + 0.1 × (N − 2)` →
  côté `ar = round(AR0·k)`, rayon initial `ring0 = RING0·k`, centre `(ar/2, ar/2)`. Placement : répartis sur un cercle de
  `0.55 × rayon`, face au centre.
- **Mort subite** : le cercle rétrécit après **25 s**, plus vite après **90 s**, jusqu'à un plancher de **45 %** du rayon initial
  **calculé pour le nombre de lutteurs encore en lice** (`ringFloor`) : il s'abaisse à chaque sortie (108 u en duel) et le
  cordon repart (nouvel événement `shrink`). Avec un plancher fixe à 45 % du rayon de départ, un duel de bots issu d'une
  mêlée à 10 ne finissait jamais (mesuré). Filet de sécurité : égalité à **3 min** (`TIME_CAP`).
- **Physique** (serveur) : entrées tenues {up,down,left,right} → accélération `0.95` u/tick² (diagonales normalisées), vitesse max
  `6.5`, frottement `v *= 0.86`/tick. Masse 1, rayon `PR`. Collisions disque-disque : séparation au prorata des masses,
  impulsion élastique (restitution `0.9`) + **poussée minimale `2.2`** pour qu'un contact pousse toujours.
- **Charge** 💨 (`dash`, Espace) : impulsion `+11` u/tick dans la direction tenue (sinon l'orientation), état « dashing » 9 ticks,
  recharge 66 ticks (2,2 s) ; un choc reçu d'un lutteur en charge est **× 1.7**.
  **Ancrage** ⚓ (`brace`, Maj/E) : 30 ticks de masse × 3 et accélération × 0.3, recharge 90 ticks — le contre de la charge.
- **Crédit de sortie** : dernier toucheur (seat + tick) mémorisé ; s'il a touché l'éliminé dans les **90 derniers ticks**, il est
  crédité (`kills++`, `outBy`), sauf coéquipier.
- **Bonus au sol + malus aux adversaires** (« version A » validée le 24/09 avec les ajustements de l'utilisateur ; toutes les 5 s,
  2 au plus, dans `0.7 × rayon`, ramassés au contact). Chaque ramassage aide le ramasseur ET pénalise ses **adversaires vivants**
  (coéquipiers épargnés) — un fx `malus {t, seat, by}` par victime, message au seul visé :
  - 🍙 **onigiri** (tiré ≈ 40 % du temps, `ONIGIRI_P`) : **+1 palier, sans minuterie**, jusqu'à la fin de la manche (max 5,
    remis à 0 à chaque manche). Par palier : masse et poussée de charge **+25 %**, rayon +8 %, vitesse max et accélération −6 %,
    recharge de charge +15 % → plus fort mais moins vif et moins souvent. Pas de malus (le gain est déjà permanent).
  - ⚡ **élan** : charge prête tout de suite puis recharge **× 0,5** pendant 15 s ; adversaires **essoufflés** 💦 : recharge × 1,2, 8 s.
  - 💥 **onde de choc** (immédiate) : repousse les adversaires à < **180 u** (impulsion 13) ; ceux touchés sont **sonnés** 💫 1,2 s
    (ni déplacement, ni charge, ni ancrage — ils glissent sur leur élan).
  - 👣 **pieds collés** : frottement 0.78 et chocs subis × 0,4 pendant 12 s ; adversaires sur **sol glissant** ❄ 8 s :
    frottement `1 − 0.14 / 1.5` ≈ 0.907, soit une glisse 1,5× plus longue.
  - Recharge effective de la charge mémorisée par joueur (`dashCdLen`) pour que la jauge `dcd` reste juste.
  - Client : perles d'or (une par palier) + liseré qui s'épaissit, gouttes de sueur, étoiles qui tournent, flaque glacée ;
    carte HUD `🍙×N 💫 💦 ❄`, étiquettes « ONIGIRI ×N / SONNÉ / ESSOUFFLÉ / SOL GLISSANT » au-dessus des jauges.
- **Bots** (🤖, IA Facile/Normale/Difficile via 🎯) : visent l'adversaire vivant le plus proche (jamais un coéquipier), distance
  **diminuée de la moitié de son éloignement au centre** (sinon, en mêlée, tout le monde pousse vers l'intérieur et personne ne sort) ; reviennent vers
  le centre au-delà de `0.7 × rayon` ; chargent si la cible est à < 130 u, alignée (cos > 0.9) **et plus proche du bord qu'eux** ;
  s'ancrent si un adversaire charge vers eux près du bord (sauf Facile) ; Facile = accélération × 0.75 et hésitations.
- **Snapshot** : `gs, count, round, winner, fx[], connected, botCount, maxBots, botDiff, mode, nteams, ar, ring` (rayon actuel),
  `ring0, sd` (rétrécit), `pickups[{x,y,t}]`, `stats` (en `over`), `players` = **toujours les 10 sièges** `{seat,name,team,connected,
  playing,alive,bot,x,y,vx,vy,a,r,dcd,dashing,brace,bcd,heavy,lvl,grip,boost,tired,slip,stun,kills,place,elimTick,outBy}`.
  Événements `fx` : hit · dash · brace · out · pickup (`lvl`) · malus · shock · shrink · salt (jet de sel au compte à rebours).
- Commandes : ↑↓←→ / WASD (8 directions), **Espace** charge, **Maj/E** ancrage, **P/Échap** pause ; tactile : joystick en **mode 8**
  (`CARTES.sumo` de `joystick.js` → `smUp/smDown/smLeft/smRight`) + 💨 + ⚓.
- Messages C→S : input{up,down,left,right} (à chaque changement), dash, brace, start, pause, abort, mode, bots, botdiff, lbreset.
- **Identité « Dohyō »** (tournoi traditionnel japonais) : bois laqué `#1a120e`, vermillon `#e0452f`, argile `#c9a36b`, paille
  `#d9c27a`, washi `#f1e6d0`, encre `#1c1a17`, or `#e0b23c` ; police **Dela Gothic One** (graisse 400 seule → les titres du
  skin sont forcés en 400, sinon faux gras). Page (`body.game-sumo`) : planches laquées + lueurs de lanternes qui vacillent
  (opacité seule, coupée par « Réduire les effets »), coins à 6 px, bouton principal vermillon, cartes HUD à liseré vermillon
  supérieur, états ON en **or** (un ON rouge se lirait comme une erreur), fond plein écran `body.playing.dock.game-sumo .stage`.
  Canvas : plate-forme d'argile, cordon de paille segmenté au rayon actuel (pulse au rétrécissement), shikiri-sen, 4 pompons
  du tsuriyane, lutteurs à mawashi aux couleurs/motif du siège (`seatPattern`), chonmage orienté ; sortie = envol en tournoyant
  + « OUT ». Écran titre : « SUMO » devant un ensō. Musique in-sen (0,1,5,7,8), taiko, flûte. Victoire : **pétales de sakura** (`CELEB.sumo`).

---

## Jeu : FOOT  (`foot`, 2–10, tickHz 30) — ajouté le 25/09
Demande utilisateur : « sur le même principe que Pong pour le terrain. Chaque joueur a sa cage, 1 seul ballon au
milieu, il faut marquer dans les buts adverses pour les éliminer. Tirer avec Espace, tacler avec E. Le ballon reste
collé au personnage qui le prend en premier. Pas de bonus/malus pour le moment, de 2 à 10 joueurs. »
- **Terrain** (`public/games/foot/shared.js` : `AR0=600`, `PITCH=0.44`, `PR=15`, `BR=8`, `POST_R=4`, `GOAL0=0.42`,
  `GOAL_SD=0.62`) : polygone régulier à N côtés (un par joueur ; à 2, un carré dont seuls les côtés gauche et droit ont
  une cage, comme Pong), un côté plat en haut. Arène à l'échelle : `1 + 0.1 × (N − 2)` comme le Sumo (1080 à 10).
- **Cage** : bouche centrée de 42 % du côté, deux poteaux (disques qui renvoient le ballon). Un but = le CENTRE du ballon
  franchit la ligne dans la bouche d'une cage ouverte → le propriétaire perd une vie ; à zéro il est éliminé et sa cage
  se FERME (le côté devient un mur). Vies : 3 par défaut, réglage game master `lives` (3 → 5 → 1 → 2, dans GM_ONLY).
  Le dernier joueur (ou la dernière équipe) en lice gagne ; modes d'équipe comme le Sumo.
- **Crédit** : `ball.kick` = dernier joueur qui a VRAIMENT joué le ballon (tir, conduite, tacle) ; une déviation ne met
  à jour que `ball.last`. But crédité à `kick` s'il est adverse (5 s au plus) ; `kick` = victime → contre son camp.
- **Ballon** : collé au premier qui le touche (conduite devant les pieds, selon le regard qui tourne à 0,42 rad/tick) ;
  le porteur court à 88 %. Tir (Espace, `shoot`) : 17 u/tick dans la direction TENUE, sinon le regard ; le tireur ne le
  reprend pas avant 9 ticks. Un ballon à plus de 11 u/tick qui touche un joueur REBONDIT au lieu de se coller (sinon un
  défenseur planté devant sa cage arrêterait tout). Sous-pas contre l'effet tunnel, frottement 0,975, rebonds 0,72.
  On peut rentrer le ballon en le conduisant.
- **Tacle** (E ou Maj, `tackle`) : impulsion 8,5, 8 ticks, recharge 42. Sur le porteur : le ballon saute dans le sens
  du tacle, le porteur est sonné 16 ticks et ne peut pas le reprendre de suite ; sur un autre, simple bousculade.
- **Après un but** : ~1,3 s figées (célébration), puis engagement : ballon au centre, chacun devant sa cage.
- **Prolongations** : après 90 s, les cages s'élargissent de 42 à 62 % du côté en 60 s (`gw` dans le snapshot) ;
  filet absolu à 6 min (l'équipe qui a le plus de vies gagne, égalité sinon).
- **Bots** (Facile/Normale/Difficile) : porteur → cage adverse ouverte la plus proche, visée dispersée selon le niveau,
  tir anticipé sous pression ; porteur adverse → pressing et tacle, ou placement entre lui et sa cage s'il menace ;
  ballon libre qui file vers sa cage → réflexe de gardien (Normale/Difficile) ; sinon course au ballon anticipée.
  Simulation (`hors réseau`) : les manches finissent à toutes les tailles — ~15-25 s à 2, ~20-40 s à 3, ~1 min à 5,
  ~3,5 min à 10 (29 buts pour 3 vies).
- **Snapshot** : `gs, count, round, winner, fx, connected, botCount, maxBots, botDiff, mode, nteams, lives, ar, sd, gw, frz`,
  `geo{G, e:[[ax,ay,bx,by,owner,open]…]}` (statique hors éliminations : le hub ne le renvoie pas s'il est identique),
  `ball{x,y,o,l}`, `players` = 10 sièges `{seat,name,team,connected,playing,alive,bot,edge,x,y,a,lives,goals,kills,tk,tcd,st,
  place,elimTick,elimBy}`. Événements : shot · grab · slide · tackle (steal) · deflect · post · wall · goal (by, own,
  lives) · out · whistle (start/go/kick/end) · sd.
- **Client** (identité « Stade de nuit », police Russo One) : tribunes en pointillés de couleur, panneaux publicitaires,
  pelouse tondue en bandes découpée au polygone, craie (contour, rond central, arcs de surface, points de pénalty,
  quarts de cercle), cages avec filet qui ondule au but, bande à la couleur du propriétaire, ses vies en ballons derrière
  le filet ; cage fermée = planches à rayures rouges. Joueurs vus de dessus (maillot couleur + motif du siège, tête et
  cheveux, crampons qui alternent à la course, double ombre des projecteurs, glissade, étoiles quand sonné), ballon à
  pentagones qui roule, traînée au tir. « BUT ! » / « CONTRE SON CAMP » / « POTEAU ! », confettis, sifflet d'arbitre et
  clameur en WebAudio, tableau d'affichage ambre pour le décompte et le titre. Journal : vies au fil du match, coup du
  chapeau, but éliminatoire, tacle gagnant. Joystick en mode 8 (`CARTES.foot`) + boutons ⚽ tir et 👟 tacle.
  Vitrine d'accueil : 7 cartes (7 en ligne sur PC, 4 + 3 ailleurs).

### Rééquilibrage après le 1er test (25/09)
Retour utilisateur : « on ne fait que se tacler pour dégager la balle et elle rebondit souvent dans un but ». Changements
(les valeurs plus haut dans cette fiche sont remplacées par celles-ci) :
- **Tacle** : il **assomme 1 s** le PREMIER adversaire touché (ni course, ni ballon) et **ne touche plus au ballon** (il
  reste sur place, à qui le ramasse). Tacle raté (personne touché, ballon non pris) = **à terre 0,5 s** (fx `miss`,
  `dn` dans le snapshot). Recharge **2 s** (au lieu de 1,4). Mesuré sur bots à 10 : 110 tacles par manche au lieu de 830.
- **Tir chargé** : Espace (ou bouton ⚽) enfoncé = charge, relâché = tir (`{t:'charge', on}`, `cancel` si la fenêtre perd le
  focus). Puissance mesurée par le SERVEUR : de 7 u/tick (passe) à 21 (boulet) en 0,9 s ; dispersion ∝ puissance²
  (±7° à fond) ; porteur à 70 % pendant la charge ; on peut presser avant d'avoir le ballon (la charge part à la prise).
  `ch` (0..1) dans le snapshot → arc de charge autour du porteur et jauge. `{t:'shoot'}` reste un tir direct à 0,55.
- **Moins de flipper** : frottement du ballon 0,968 (au lieu de 0,975), rebonds des murs 0,5 (au lieu de 0,72), poteaux
  0,7 ; cages **36 %** du côté (au lieu de 42), 58 % au plus en prolongations ; un ballon ne rebondit sur un joueur
  qu'au-delà de 13,5 u/tick (un tir franchement chargé). Contre son camp : quasi disparus en simulation.
- **IA** : frappe dosée selon la distance (0,4 à 0,9, rarement à fond), réflexe à chaque tick quand un ballon libre
  file (arrêts, interceptions). Manches mesurées : ~20 s à 2, ~30 s à 3, ~70 s à 5, ~3 min à 10.

### Une cage par ÉQUIPE (25/09)
Retour utilisateur : « en mode équipe il faut qu'il y ait autant de buts que d'équipes et que le terrain s'adapte ».
- Tout le jeu raisonne par équipe ; en « chacun pour soi », chaque joueur est une équipe d'un (rien ne change).
- Le polygone a **K = nombre d'équipes** côtés-cages (2 : carré, cages gauche/droite et murs haut/bas ; 3 : triangle ;
  4 : carré ; 5 : pentagone). La **taille** de l'arène suit toujours le nombre de JOUEURS (`scaleFor(N)`).
- Chaque côté-cage porte `team` (côté serveur) et `owner` = siège représentant (1er de l'équipe) pour le client
  (couleur d'équipe, vies affichées, étiquette « Équipe X »). Cage active = `open && team >= 0`.
- **Vies d'équipe** (`teamLives`, recopiées dans `p.lives` de chaque membre). À 0 : toute l'équipe sort au même tick
  (même place), sa cage se ferme ; le buteur gagne une élimination par membre sorti.
- **Départ** en pleine manche : l'équipe continue s'il reste un membre (nouveau représentant) ; sinon elle est éliminée.
- Coéquipiers placés côte à côte devant leur cage (un sur deux avancé). Le lobby montre déjà le bon terrain pour le
  mode choisi (`apercu()` rappelé au changement de mode).
- Contre son camp : dernier « kick » de l'équipe qui encaisse (coéquipier compris). Crédit : dernier kick adverse.
- Simulation de tous les modes (2 à 10 joueurs) : cages = équipes, terrain du lobby identique, sorties groupées par
  équipe, manches finies (11 à 70 s entre bots).

### Plein cadre, sprint, orientation, 5 terrains, 3 bonus / 3 malus (25/09)
Retour utilisateur : zone de jeu trop réduite, terrain à agrandir à peu de joueurs, sprint sur Maj, orientation
peu lisible, bonus/malus et terrains à effets sélectionnables au menu.
- **Plein cadre** : `buildGeo` ajuste le rayon pour que la boîte englobante du polygone (+ `MARGE` = 34, filets et
  panneaux) remplisse l'arène, et recentre le polygone sur SA boîte (`geo.cx/cy/R`, `geo.c` dans le snapshot ; un
  triangle n'est plus centré sur le milieu du cadre). Le carré occupe ~90 % du cadre (62 % avant).
- **Terrain plus grand à peu de joueurs** : `AR0 = 720` (600 avant) et +7 % par joueur (10 % avant) → joueurs
  relativement plus petits à 2 ; à 10, l'arène reste proche d'avant (1123).
- **Sprint** (Maj, `{t:'sprint', on}`, bouton 🏃) : ×1,4 vitesse, ×1,2 accélération ; endurance vidée en 1,6 s,
  rechargée en 3 s après 0,4 s ; à vide « essoufflé » jusqu'à 30 %. Pas en chargeant un tir, sonné, à terre ou
  englué. Bots : sprint pour presser, courir au ballon, se replacer. Le **tacle n'est plus que sur E**.
- **Orientation** : chevron au sol devant chaque joueur (grand et ambre pour soi), nez sur la tête ; ballon au pied,
  **ligne de visée** pointillée (direction tenue, sinon le regard ; s'allonge avec la charge, respecte l'inversion).
- **5 terrains** (`{t:'terrain', v}` + « hasard », GM_ONLY ; `ter` = indice en vigueur dans le snapshot) :
  stade (classique) · boue (4-6 flaques ×0,55, ballon freiné, murs 0,35, pluie) · glace (adhérence ×0,5, frottement
  0,955, ballon 0,988, bandes 0,85) · flipper (un bumper face à chaque sommet, relance à 15 u/tick, repousse les
  joueurs, murs 0,92, décor néon) · tempête (vent qui tourne toutes les 8 s, annoncé 2 s avant, pousse le ballon
  0,14/tick² et les joueurs, bancs de sable ×0,72, girouette). Zones `zn`, bumpers `bmp`, vent `wind`/`wn`.
- **3 bonus / 3 malus** (`{t:'item', k, on}`, GM_ONLY, tous actifs par défaut ; un objet toutes les 6 s, 2 au plus,
  `pk`) : turbo (sprint illimité, +15 %, 8 s) · canon (2 tirs à pleine puissance, sans dispersion, ×1,2) · mur (sa
  cage ×0,5, 10 s) — malus pour tous les adversaires : cage géante (×1,6, 8 s) · glu (×0,6, sans sprint, 5 s) ·
  inversion (4 s, bots compris). Largeur de cage par équipe (`cageK`) en 7e valeur des arêtes de `geo`.
- Panneau « 🏟 Terrain & bonus » (`#ftOptPanel`, synchronisé sur `snap.opt`). `npm test` : 97 vérifications (bloc
  « Foot : les 5 terrains »). Simulation : tous les terrains finissent (15 s à 2, ~1 min à 4, ~2,5 min à 8).

## ZQSD / WASD dans tous les jeux (25/09)
Les 7 jeux lisent le clavier par `e.code` (position PHYSIQUE) : `KeyW`/`KeyA` sont les touches Z/Q d'un clavier
AZERTY, donc ZQSD marchait déjà en AZERTY. `KeyZ`/`KeyQ` ajoutés partout : Z Q S D marche aussi sur un clavier réglé
en QWERTY, et W A S D reste valable. Textes d'aide mis à jour (« Z Q S D (W A S D) »).

## Communs aux jeux
- **Équipes** FFA/2v2/2v2v2/3v3 (2v2 à 4 joueurs ; 2v2v2 & 3v3 à 6). Couleur d'équipe (palette Okabe-Ito en daltonien).
- **Tir allié** (Tank & Bomberman, bouton 🤝, actif seulement en équipes, **OFF par défaut**) : ON = les obus/mines/explosions
  touchent les coéquipiers. La **bombe/obus propre** blesse toujours son auteur ; en ON un kill d'allié est crédité.
- **Leaderboard par jeu** (`leaderboard.json` = `{gameId:{board,history}}`) : par pseudo ; victoires, kills, K/D, survie max, etc.
  Diffusé sur `dirty`. Pages `/stats?game=<id>` & `/leaderboard.json?game=<id>`.
- **Reset admin des classements** (réservé au détenteur d'une clé secrète) : env serveur **`ADMIN_KEY`** ; le hub n'honore `{t:'adminreset',key}` que si `key === process.env.ADMIN_KEY` → `reset()` sur **tous** les jeux (le `step()` rediffuse les classements vides à tous, le **global** se recalcule). Côté client : ouvrir une fois l'URL **`?admin=<clé>`** mémorise la clé en `localStorage` (`pong-lan-admin`) et révèle un bouton **🗑 Réinitialiser** dans ⚙️ Réglages → 🔑 Admin (invisible pour les autres). Si `ADMIN_KEY` n'est pas défini côté serveur, la commande est ignorée.
- **Reconnexion** par token : **période de grâce de 12 s** côté hub (le siège et l'état du jeu sont conservés à la coupure ;
  un F5 réutilise le même membre). Au-delà, élimination via `onLeave`. Chaque jeu garde aussi `seatByMid` (reprise après grâce).
- **Quitter en cours** : bouton flottant ✕ → `abort` → `backToLobby()` (retour lobby sans perdre les sièges).
- **Lot transverse (social/UX)** : **émotes** (bouton flottant 😀 → broadcast `{t:'emote',e}` via hub, anti-spam 700 ms, toasts chez tous) ; **classement global cross-jeux** (bouton 🏅 : le shell agrège les `lb` de tous les jeux par pseudo → wins/kills/parties cumulés) ; **ping** (client `{t:'png',ts}` toutes les 3 s, hub echo, RTT affiché). Différé restant : profils/avatars (intégration HUD par jeu).
- **Système « Prêt » (gate de démarrage, transverse aux 6 jeux — FAIT)** : entièrement dans **hub + shell**, **zéro modif des 6 clients de jeu**. Hub : `member.ready` ; `roomMsg` envoie `host` (= 1er joueur connecté) + `ready` par joueur ; `allReady()` = tous les **membres role=player** prêts (les **bots ne sont pas des membres** → exclus → jamais bloquants) ; le hub **gate** `{t:'g',m:{t:'start'}}` quand `game.isIdle() && !allReady()` (renvoie `{t:'notready'}`) ; `{t:'ready',v}` togglé ; `{t:'forcestart'}` réservé à l'hôte (bypass) ; **réarmement** auto des « Prêt » à chaque manche lancée (transition idle→actif détectée dans `step()` via `wasIdle`) ; **solo : pas de gate** (`ps.length <= 1` → allReady, barre masquée côté client) ; toast `notready` anti-spam 1,5 s. Shell (`app.js`) : barre `#readyBar` (lobby/over seulement) listant ✅/⚪ par joueur + 👑 hôte, bouton **« Prêt »** (joueurs), bouton **« ⏩ Forcer le départ »** (hôte), toast `notready`. Le bouton Démarrer de chaque jeu reste inchangé mais est gaté côté hub.
- **Modes alternatifs (ex-différés « condition de victoire », FAIT)** : **Snake food-rush** (bouton 🏁 — premier à 20 🍎) et **Bomberman revanche** (bouton ☠ — les morts bombardent depuis le bord et peuvent revenir). Tous deux **OFF par défaut**, sans impact sur le jeu de base. *(Différés Tron — mine + hasards d'arène — abandonnés à la demande.)*
- **Refonte du chrome par jeu (bespoke)** : `app.js setGameSkin(id)` pose `body.game-<id>` (+ sous-titre `#sub` thématique) à chaque chargement de jeu (`loadModule`). Tout le chrome (en-tête, boutons, barres, cartes HUD, panneaux, fond `::before`) est piloté par les **variables CSS** redéfinies par `body.game-<id>` (bloc en fin de `style.css`). **Tanks/Snake/Bomberman** = palette + fond + formes + police d'accent fixes (Désert ambre / Jardin vert / Cartoon candy). **Pong/Tron** = gardent le sélecteur Néon/CRT/Clair (palette via `body.theme-*`) ; on n'ajoute que police d'accent + accent coloré + motif `::after` (grille, gaté `:not(.theme-light):not(.flat)`) + coins tranchants (Tron). **Polices Google** (Orbitron / Black Ops One / Fredoka / Baloo 2) chargées en `<head>` avec `display=swap` + **repli système** (jeu LAN hors-ligne OK), appliquées via `--display-font` aux seuls éléments « display » (logo, onglets, titres, boutons primaires). Tout gaté par `.flat` (réduire les effets). Spécificité : blocs `game-*` placés après les `theme-*` → l'identité de jeu gagne. 100 % CSS + 1 classe JS, zéro impact gameplay/réseau/Upstash.
- **Identités renforcées (lot A→F)** : **onglets multi-identités** (`#gamemenu .gtab[data-id=…]` : chaque onglet porte police/couleur/forme de SON jeu, l'actif s'allume avec SON dégradé — indépendant du jeu sélectionné) ; **logo = titre du jeu** (`GAME_TITLE` dans `setGameSkin`) ; **états ON par jeu** (`--ok`/`--okTxt` dans `:root`, redéfinies par `body.game-*`, plus aucun vert codé en dur) ; **fonds signature** (soleil synthwave Pong, grille animée Tron `tronGrid`, rayures pochoir + dunes Tanks, feuillage + pois Snake, semis de confettis Bomb — gatés `.flat`/thème Clair) ; **cartes HUD thématiques** (plaque rivetée Tanks via `.pc::after`, étiquette dashed Snake, bulle BD Bomb, liseré cyan Tron) ; **finitions** (`::selection` et scrollbar teintées `--accent`, curseur crosshair Tanks, **flash du nom du jeu** dans `#xfade` pendant la transition).
- **Identité visuelle propre par jeu** (FIXE, constante `SKIN` dans chaque client, pas de sélecteur) :
  Tanks → **Désert** (sable, acier riveté, caisses bois) ; Snake → **Jardin** (herbe en damier, pommes) ; Bomberman → **Cartoon** (herbe pastel, murs arrondis) ; Pong & Tron → **Néon**.
  Le sélecteur de thème global (Néon/CRT/Clair) ne pilote plus que le **shell** + Pong/Tron. `reduceFx` (réduire les effets) et la palette daltonien restent appliqués dans tous les jeux.
- **Accessibilité** (⚙️ shell, persisté localStorage `pong-lan-a11y`) : thèmes Néon/CRT/Clair, musique (tous les jeux), palette daltonien,
  contraste, réduction des effets. Pseudo persistant `pong-lan-name`, token `pong-lan-token`.
- **Musique générative par jeu** (`public/music.js`, moteur PARTAGÉ zéro dépendance — aucun fichier audio) : séquenceur WebAudio
  à fenêtre d'avance (double-croches sur l'horloge audio), thèmes **data-driven** (`MUSIC_THEME` en tête de chaque client :
  bpm/bpmBoost/vol/root + couches `{seq|drums, wave, oct, gain, dur, min}` ; drums `K`=grosse caisse `S`=caisse `H`=charley).
  **Intensité 0/1/2** pilotée par `onState` : 0 = lobby/pause/fin (couches calmes), 1 = en jeu, 2 = **climax** (+tempo `bpmBoost`,
  couches min:2) — Pong : échanges rapides (`musicIntensity>0.55`) ; Tron/Snake : duel final (≥3 → ≤2 vivants) ; Snake rush : meneur ≥70 % de l'objectif ;
  Tanks : tank à 1 vie ou duel final ; Bomberman : **mort subite** (`sd`). Identités : Pong=arcade néon, Tron=synthwave sombre,
  Tanks=martial désert (tambours), Snake=pastoral pentatonique léger, Bomberman=cartoon enjoué (chromatique en SD).
  Branchée sur le réglage 🎵 existant (`a11y.music`, lu en continu → bascule en douceur), `music.start()` à l'init, `music.stop()` au teardown.
  L'AudioContext du jeu est réutilisé (créé au 1er geste — politique autoplay).
- **Plateau adaptatif** : taille calculée par écran ; s'agrandit en jeu (chrome masqué) ; ⏸ flottant en jeu, ⚙️ flottant en pause.
- **Juice** : interpolation client (lerp), particules, shake, décompte 3·2·1, écran de fin + classement.
- **Pack « quick-wins » (polish)** : 🎉 **confettis** de victoire (overlay global, déclenché par `state.gs==='over' && winner>=0`) · **fondu de transition** entre jeux (`#xfade`) · **volume SFX** (slider `a11y.sfx`, branché dans chaque `tone()`) + **plein écran** + **vibration tactile** mobile (réglages shell). Par jeu : Pong = flash d'impact ; Tron = bloom renforcé + cœur de traînée ; Tanks = jauge de munitions ; Bomberman = étincelle de mèche animée + cases « danger » clignotantes ; Snake = yeux + tête arrondie. Tout respecte `reduceFx`.
- **Pack « quick-wins » lot 2** : Pong → **lueur des bords** quand une balle frôle + **particules** au ramassage de power-up + **icônes d'effets actifs** (pulsantes) sur les cartes + **IA « insane »** ; Tron → **pulsation de grille** + **speed lines** (boost/vitesse, flag serveur `boosting`) + **traînée d'équipe traversable** (coéquipiers) ; Tanks → **flash de bouche** + **poussière** au déplacement + **fumée** (tank à 1 vie) ; Snake → **éclaboussure** de pomme à la bouffe ; shell → **nombre de spectateurs** dans le bandeau. 🟡 différés (besoin de données serveur) : barres dégressives d'effets (Pong), flèche de service (Pong), trail d'obus (Tanks), dégradé de queue (Snake), indicateur de ping.
- **Lot « finir le polish » (🟡 petits ajouts serveur — FAIT)** : Pong → **barres d'effets dégressives** sur les cartes (serveur envoie `players[].buffs=[[clé,fraction]]`) + **flèche de sens de service** (serveur envoie `balls[].vx/vy`, flèche dessinée au décompte) ; Tanks → **timers d'effets dégressifs** (mêmes `buffs`) + **traînée d'obus** (serveur envoie `shells[].vx/vy`). Pastille `.buff` = fond en dégradé qui se vide. Restent 🟡 : dégradé de queue Snake (traînées compressées en sommets), indicateur de ping (protocole).
- **Fonds animés par identité** (canvas, dessinés entre le sol et les éléments de jeu, ~5-40 particules dont la position est **dérivée du temps** (modulo sur `now`) — zéro état muté, robuste aux pauses ; tous coupés par `reduceFx`) : Pong → **starfield** scintillant (`AMB_STARS`) ; Tron → **pluie de néon** (`AMB_RAIN`) ; Tanks → **poussière au vent** (`AMB_DUST`) ; Snake → **lucioles + pétales** (`AMB_FLY`/`AMB_PETAL`) ; Bomberman → **nuages doux** (`AMB_CLOUDS`).
- **Lot « améliorations rapides » (🟢 tous jeux + transverse)** :
  · **Pong** : terrain qui **chauffe** avec la vitesse (gradient radial piloté par `musicIntensity`, clippé au polygone) ; **styles d'IA** (option ⚙ `botstyle` : Équilibré / Agressif — frappe du bord de la raquette, met la pression / Défensif — suit toujours la balle) ; **entraînement solo** (1 participant = carré 1 raquette + 3 murs ; `checkWin` n'arrête qu'à 0 vie ; `recordRound` skip `nParts<2` = hors classement ; titre « 🎯 Entraînement terminé »).
  · **Tron** : **moto orientée** (capsule + verrière, direction = 2 derniers sommets) à la place du carré de tête ; **jauge boost lisible** (170 px, graduations 25 %, couleur plein/ok/à-sec, % affiché, pulse pendant le boost).
  · **Tanks** : **cratères persistants** (fx `wall` → taches sombres pseudo-aléatoires déterministes par cellule, purgés au changement de `round`) + éclats de bois ; **traces de chenilles** (2 pointillés parallèles, fondu 5 s, cap 160).
  · **Bomberman** : **écrasement cartoon** des blocs détruits (`wallAnims`, squash & stretch 240 ms) ; **visages** (yeux + sourire) ; **ombres portées** sous joueurs et bombes.
  · **Snake** : **dégradé de queue** (chaque segment du chemin tracé avec opacité croissante vers la tête, compatible coupures de wrap) ; **pâquerettes** décoratives statiques (`AMB_FLOWERS`).
  · **Transverse** : **spectateur → siège** (bouton 🪑 dans la barre Prêt, message `{t:'reseat'}`, le hub re-exécute `joinGame` hors partie) ; **page `/stats` enrichie** (onglet `?game=global` : agrégat cross-jeux + champion par jeu ; colonne **% victoires** partout).
- **Lot bots + stingers + icônes** :
  · **Fix bots Bomberman** : bombes des bots **toujours minutées** même avec 📡 (ils n'utilisent jamais Action → bombes éternelles qui les emmuraient) ; **anti-gel** dans botThink (`botPX/botPY` : position inchangée = étape bloquée → re-décision, idem si l'étape n'est plus praticable).
  · **Bots Tron/Snake/Bomberman** (pattern Tanks : `botCount`, bouton 🤖, sièges protégés, **exclus du leaderboard**, démarrage dès 1 humain + 2 participants). IA Tron : `rayFree` 3 directions, tourne vers le côté le plus dégagé. IA Snake : `botSafe` + anticipation 2 cases + attraction nourriture. IA Bomberman : `dangerMap` (portées des bombes), `botBfs` (fuite/cible : bonus sain ou mur cassable), **pose seulement si une retraite existe**, compense le malus inversé ; en mode revanche les bots **meurent pour de bon** (pas revenants).
  · **Stingers musicaux** : `music.sting(kind)` dans music.js (`theme.stingers`, `base` Hz optionnel) ; **kill** (motif court propre à chaque jeu) + **win** (accords basés Do, harmonisés avec le jingle SFX) branchés dans les 5 clients (crash/boom/death + passage à `over`). Coupés avec la musique 🎵.
  · **Icônes vectorielles** (rendu identique sur tous les OS, fini les emoji qui varient) : Bomberman `drawPickIcon` (13 glyphes bonus/malus dessinés au canvas), Tanks `drawTankIcon` (👟🔧⚡🚀👁📡 → chevrons/clé/éclair/missile/œil/ondes, via `TANK_VECT`), Snake champignon + fantôme dessinés. Les caractères typographiques (» ⋔ ⛉ ➳ ◈…) restent en texte. HUD HTML (badges/boutons) conserve les emoji (purement décoratif).
- **Mode tournoi 🏆 (transverse, hub + shell — zéro modif des jeux)** : l'**hôte** lance via le bouton 🏆 (re-clic = annule, avec confirm). Hub : `tour = { order (6 jeux mélangés), idx, scores:{nom:pts}, wait }` ; à chaque transition manche→`over` (détectée dans `step()` via `wasIdle`), **points = max(1, n − place + 1)** pour les humains classés (`place>0 && !bot`), puis `wait ≈ 6 s` (écran de fin) et `pick(jeu suivant)` ; dernier jeu → broadcast `{t:'tour', done:true, scores}` et libération. Pendant un tournoi : `pick` manuel bloqué, `start` bloqué pendant la transition, gate « Prêt » conservé à chaque manche ; salle vide → tournoi annulé ; état resynchronisé à la (re)connexion. Shell : bandeau `#tourBar` (manche x/6 — jeu — top 4), **podium final** `#tourPanel` (👑 champion + scores) + confettis. Solo possible (ajouter des bots par jeu, notamment Tron qui exige 2 participants).
- **Lot difficulté des bots + pack son** :
  · **Difficulté 🎯** (Tron/Snake/Bomb/Tanks, bouton cyclique Facile/Normale/Difficile, état `botDiff` 0/1/2, message `botdiff`, snapshot) : Tanks `TKDIFF` (skip de réaction, fenêtre/probabilité de tir) ; Tron `TRDIFF` (profondeur `rayFree`, taux d'inattention) ; Snake `SNDIFF` (inattention, anticipation 2 cases coupée en Facile) ; Bomb `BMDIFF` (hésitation sauf en danger, cooldown de pose). Pong garde son option ⚙ existante (4 niveaux + styles).
  · **Volume musique séparé** : `a11y.mvol` (slider « Volume musique » dans ⚙️, défaut 0.7) multiplie le master du moteur (sched + stingers).
  · **Ducking** : intégré à `sting()` (master plongé à ×0.35, remonté par l'ordonnanceur en ~300 ms) ; `duck:false` sur les stingers `count`/`go`.
  · **Décompte musical** : stingers `count` (note par tick du 3·2·1, timbre du thème) + `go` (accord) déclenchés dans les 5 clients (changement de `m.count`, transition countdown→play).
  · **Riser de mort subite** : stinger `alert` (montée chromatique) sur `sd` false→true (Pong/Bomb) et `shrink` 0→1 (Tron).
  · **Pan stéréo** : `sndPan` module + routage `StereoPannerNode` dans `tone()` + helper `psound(kind, x)` — câblé sur shot/hit/boom/barrel (Tanks), crash (Tron), eat/crash (Snake), place/wall/boom (Bomb). Pong non panné (balle centrale).
- **Perf mobile — pré-rendu du décor** (Snake/Tanks/Bomberman) : `ensureTerrain()` dessine le décor statique sur un **canvas offscreen** (`terrainCv`), re-rendu **seulement si `terrainKey` change** (taille canvas + grille + boue) ; `draw()` fait un seul `drawImage(terrainCv, 0, 0, ARENA, ARENA)` **en coordonnées monde** (suit shake/zoom). Technique : swap temporaire du `ctx` module vers l'offscreen. Contenu : Snake = fond+damier(900 rects)+fleurs+grille+bordure (clé = taille seule) ; Tanks = sol+murs rivetés+caisses+bordure+**boue** ; Bomberman = sol+murs (les **portails 🌀 restent animés en live** via `warpCells` collecté au rendu). Tron/Pong non concernés (rendu déjà léger). Économie : ~300-950 tracés canvas par frame et par jeu.
- **Ergonomie mobile (retours de test)** : ① **musique coupée écran verrouillé/onglet masqué** — `music.js` écoute `visibilitychange` et `suspend()`/`resume()` l'AudioContext (1 point central, couvre musique + SFX des 5 jeux). ② **Manette 2 zones** (`.gpad` : `.dirs` croix clavier ▲ / ◀▼▶ à gauche, `.acts` à droite ; Snake `.solo` = croix centrée) — DOM des 4 pavés réorganisé (IDs préservés, JS lie par ID), boutons agrandis (`clamp(58-86px)`), actions principales (🔥/💣) en bas près du pouce. Affichée mobile seulement (`.gpad{display:none}` desktop). ③ **Pong** : les flèches ▲▼ passent **sous** le plateau, larges et côte à côte (`.stage` row+wrap, `flex:1 1 0`, height 64). ④ **Boutons flottants** (pause/quitter/réglages/émote) sur mobile : petits (42px), **translucides** (opacity .6, plein au toucher), `#quitFloat`→« ✕ » seul, et `body.playing{padding-top:54px}` crée une bande haute → ils ne couvrent plus le plateau. Les anciennes règles `.dpad`/`.tankpad` deviennent mortes (inoffensives).
- **Compat mobile ancien iOS (Safari pré-clamp)** : les contrôles utilisaient `clamp()`/`min()` (iOS 13.4+) → invalides sur vieux Safari → repli sur `width:min(82vw…)` → boutons géants empilés. Refait en **px fixes** (`.gpad .touch{66px}`, actions `74px`, palier `≤370px`→54/60px) + **espacement par marges** (pas de `flex gap`, non supporté) + `width:100%/max-width` (pas de `min()`). **Émote masquée en partie** sur mobile (`body.playing #emoteFloat/#emoteBar{display:none}`) : le bouton 😀 `position:fixed` bas-gauche recouvrait le pavé directionnel et volait les taps. *(Si un jour les contrôles ne répondent pas du tout sur iOS <13 : ce serait les Pointer Events — prévoir un repli `touchstart`.)*
- **Profils / avatars (FAIT)** : chaque joueur choisit un **emoji** (grille de 20) ou **importe une image**. L'image est réduite côté navigateur en **64×64 recadré au centre** (`avFromFile` : WebP q0.75, repli **JPEG** pour vieux Safari, re-compression si > 14 Ko, refus > 19 Ko) → data URL de ~2-4 Ko. **Identité = le pseudo** (comme le classement) : l'avatar suit le joueur d'un appareil à l'autre. Persistance **Upstash sous une clé DÉDIÉE** (`AVATAR_KEY`, défaut `pong-line:avatars`, repli fichier `avatars.json` en local) — séparée du classement pour ne pas ré-uploader les images à chaque fin de manche ; purge du plus ancien au-delà de `AV_MAX=60`. Hub : message `{t:'avatar',a}` **validé strictement** (`AV_OK` : emoji court sans caractère HTML, ou `data:image/(png|jpe?g|webp);base64,…` ≤ 20 Ko) — indispensable car les clients l'injectent en `innerHTML` ; rediffusion `{t:'av',name,a}` ; `sendAvatars()` à la (re)connexion ; l'avatar suit le renommage. Client : bouton rond `#avBtn` près du pseudo + panneau `#avPanel`, `window.__AV(name)` consommé par les **cartes HUD des 5 jeux**, la **barre Prêt** et le **classement global**. Stocké aussi en `localStorage` (`pong-lan-avatar`) pour réaffichage instantané.
- **Game master (FAIT)** : le rôle d'hôte n'est plus « le 1er connecté » mais **le détenteur de la clé `ADMIN_KEY`** s'il est présent, avec **repli sur le 1er joueur connecté** sinon. Client : `adminKey` (localStorage `pong-lan-admin`, posé une fois via `?admin=<clé>`) envoyé au hub à la connexion via `{t:'auth',key}` ; le hub vérifie contre `process.env.ADMIN_KEY` et marque `member.gm` (non usurpable — la clé n'est jamais dans le code). `hostId()` privilégie le membre `gm`. **Réservé au game master** : `forcestart`, `tour` (tournoi), `pick` (changer de jeu) et tous les **réglages de partie** via l'ensemble `GM_ONLY` gaté dans le routage `{t:'g',m}` (`mode, preset, opt, bots, botdiff, arena, wintarget, ff, gen, variant, rush, revenge, fade, lbreset`) — **zéro modification des 5 jeux**. Refus → `{t:'denied'}` → toast « 👑 Réservé au game master » (anti-spam 1,5 s). Restent ouverts à tous : déplacements, `start` (déjà gaté par « Prêt »), `pause`, `abort`, `ready`, émotes. Bonus sécurité : `lbreset` (effacement du classement d'un jeu) n'est plus accessible à n'importe qui.
- **Arènes à l'échelle du nombre de joueurs (FAIT — retours de test « trop petit / balle trop rapide »)**. Technique commune : les constantes de `shared.js` sont importées **sous alias** (`W as W0`, `GW as GW0`…) puis redéclarées en **`let` mutables** → tout le code existant (serveur ET rendu) continue de les lire sans être modifié ; seule une ligne les met à jour.
  · **Pong** — attention : agrandir seul serait un **simple zoom** (la raquette aurait proportionnellement plus de distance à couvrir → difficulté inchangée). `setArena(n)` agrandit donc **terrain + `PAD_LEN` + `PAD_SPD` dans la même proportion** (`k = 1 + 0.13·(n−2)`, 2 j ×1.00 → 6 j ×1.52) : la défense reste identique mais la balle, **à vitesse absolue inchangée**, met ×k plus de temps à traverser. Appelé dans `configure()` avant `buildGeometry`. Snapshot `aw/ah` → le client rescale (`sc = cv.width / W`). **Vitesses recalibrées** : `SPEED` lente 3.0/8 · normale 3.8/11 · rapide 4.6/14 (le preset par défaut utilisait 6.2/**20** = traversée en ~0,4 s) ; montée du plafond d'accélération adoucie (`tick/7200` au lieu de `/3600`).
  · **Tron** — `setGrid(n)` : côté `50 → 76` (`+14 %/joueur`, plafonné). L'**arène logique reste 500** et seule `CELL = ARENA/GW` change → aucun impact sur le dimensionnement canvas ni les fonds animés. Intervalle de rétrécissement resserré proportionnellement (`SHRINK_EVERY · GW0/GW`) pour que la manche dure autant. Snapshot `gw/gh`.
  · **Snake** — `setGrid(n)` : côté `30 → 46`. **Rochers** à densité constante (`ROCK_COUNT · aire/aire0`) et **pastilles** en plus par joueur (`+1`, `+2` en food-rush). Clé du pré-rendu du décor étendue à `cv.width + '|' + GW` (sinon le damier restait figé).
- **Optimisation hub** : diffusion plein régime en jeu, ~4 Hz en lobby/pause/fin, boucle suspendue si 0 membre.

## Bugs corrigés (historique)
Pong (anciens) : double-collision raquette ; touches via `e.code` ; reset inputs au blur ; `b.last` sur rebond ; start pendant pause ;
reprise de bot ; écran de fin filtré `place>0` ; **TDZ musique** ; anti path-traversal ; `configure()` neutralisé en `over` (préserve l'écran de fin).
Refactor plateforme : tampon de messages shell (welcome/1er state non perdus) ; `welcome` étiqueté `g`.
**Session récente** :
- **Tron** : collisions **simultanées** restaurées (choc frontal + croisement → les deux meurent) ; rétrécissement purge les bonus sous le mur.
- **Tank** : mines `o:m.owner` (bonne couleur) + mines respectent les **équipes**.
- **Bomberman** : bombes télécommandées du joueur **mort** repassent en minutées (plus d'orphelines) ; nettoyage no-op lane-slide.
- **Pong** : départ pendant le **décompte** à <2 joueurs → retour lobby.
- **Tank & Bomberman** : option **Tir allié** ; **maps procédurales** (3 styles, connectivité garantie).
**Session « retours de test »** :
- **Bomberman** : *blocage au dépôt d'une bombe* — le `pass` (droit de traverser sa bombe) se libérait dès que le **centre** quittait
  la case ; or la hitbox (rayon `PR-1`) chevauchait encore → joueur coincé à cheval. Corrigé : libération basée sur `overlapsCell` (hitbox).
- **Tank** : *invincibilité perpétuelle au rematch* — `placeAtSpawn` calculait `invulnUntil = tick + INVULN` avec le `tick` (élevé) de
  la manche précédente avant remise à 0. Corrigé : `tick = 0` **avant** le placement des tanks (invuln = ~1,5 s comme prévu).
- **Changement de jeu = écran noir** (sons ok) — modules clients singletons : `teardown()` mettait `destroyed=true` jamais réarmé.
  Corrigé : `destroyed = false` au début de chaque `init()` (les 4 jeux).
- **Reconnexion (F5 = éliminé)** — la déconnexion appelait `onLeave` immédiat (élimination + fin de manche). Ajout d'une **période de
  grâce** (12 s) au hub : le membre est conservé, un F5 rapide **réutilise le même membre** (siège + état du jeu intacts) ; `onJoin` rendu idempotent.
- **Quitter une partie en cours** — bouton flottant **✕ Quitter** (shell) → message `abort` → `backToLobby()` par jeu (même s'il ne reste que des bots).
- **Pong** : bots *facile* assouplis (`spd 0.52`, `dz 34`) ; **anti-blocage dans un coin** : le bot recentre quand la balle s'éloigne du bord.
- **Légendes d'icônes** : panneau **❔** dans chaque jeu (Pong, Tron, Tank, Bomberman) expliquant bonus/malus/glyphes. **Tank** : pavé tactile en **croix** (format flèches) au lieu d'une rangée.
- **« P1 » qui se multiplie** en alternant les jeux sans lancer — `init()` (module réutilisé) ré-`appendChild` les cartes de HUD
  sans vider l'existant. Corrigé : `hud.innerHTML = ''` au début de chaque `init()` (les 4 jeux).
- **Leaderboard vide au changement de jeu** (sans recharger) — le hub n'envoyait que `lbMsg(activeId)` à la connexion. Corrigé :
  envoi de **tous** les classements à la connexion ; bufferisés par jeu côté client (`pend[g].lb`) et affichés au switch (les MAJ `dirty` continuent de les rafraîchir).
**Session « retours de test 2 » (post-Prêt/modes alternatifs)** :
- **Rectangle noir en haut à gauche** — canvas `#confetti` sans dimensions (300×150 par défaut, non étiré car élément remplacé). Corrigé : `display:none` par défaut + `width/height:100%`, affiché seulement pendant l'animation.
- **« Prêt » demandé en solo** — gate désactivé à ≤1 joueur (hub) + barre masquée (client) ; toast `notready` anti-spam 1,5 s (Espace en auto-répétition l'affichait 3×).
- **Bots Tanks au leaderboard** — exclus (`p.bot → continue` dans recordRound ; Pong les excluait déjà).
- **Bots Tanks « idiots »/tremblements** — `botThink` réécrit : évitement engagé sur plusieurs ticks (fini l'alternance tourner/avancer à chaque tick), avance en tournant, seuil d'approche réduit, errance sans cible, états IA purgés au startGame.
- **Snake murs traversants : queue dessinée d'un bord à l'autre** — `corners()` coupe désormais le chemin à chaque wrap (`null` = lever de crayon côté client) ; yeux corrigés au passage du bord.
- **Bomberman 👻 permanent** — devient temporaire (10 s) avec prolongation tant qu'on est dans un mur (anti-coincé).
- **Bomberman bombe « sans timer » jamais explosée** — bombes à mèche 📡 posées par la **pose auto** (malus ⏱, souvent via 💀) restaient orphelines. Corrigé : la pose auto force des bombes **minutées** ; légende précise que les bombes 📡 se déclenchent avec Action.
- **Bomberman cassé à la pose de bombe (écran noir ensuite)** — le lot perf avait déplacé `const g = snap.grid` dans `ensureTerrain`, mais la **prévisualisation de portée** (`rangeCells(g, …)`) le référençait encore dans `draw()` → ReferenceError dès qu'une bombe existait, boucle rAF morte (bombe + joueur invisibles, puis écran noir). Corrigé : `rangeCells(snap.grid, …)`.
- **Filet de rendu (les 5 jeux)** — `drawLoop()` : `try { draw() } catch { console.error }` puis **replanifie toujours** la frame suivante ; `init()` lance `drawLoop` et `draw()` ne s'auto-replanifie plus. Une exception de rendu ne fige plus jamais un jeu (erreur visible en console, le jeu continue).
- **Pong : contrôles inversés entre joueurs d'arêtes opposées** — le client n'envoie qu'une intention binaire `up`/`dn` et le serveur faisait toujours `up → pos−` ; or `+pos` parcourt l'arête dans un sens qui dépend du winding (les 2 arêtes verticales d'un carré sont opposées → un joueur « monte », l'autre « descend »). Le bot visait la projection de la balle (non concerné). Corrigé dans `humanMove` : `sign = (|ty|≥|tx| ? ty>0 : tx>0) ? 1 : -1` → « haut » fait **toujours** monter la raquette à l'écran (et ←/→ pilotent les arêtes horizontales en 4-6 joueurs). Spécifique à Pong (les autres jeux ont une grille absolue → pas d'inversion).
**Revue de code complète (post-musique)** :
- **Injection HTML via pseudo** — les clients injectent les noms en innerHTML sans échappement ; pseudo désormais **assaini à la source** dans le hub (`replace(/[<>&"']/g,'')`), protège HUD/fin/classements des 6 jeux.
- **note() shell** — suppression du toast à 2,2 s avant la fin de l'animation de sortie (2,6 s) → durée alignée.
- **Snake food-rush + déconnexion** — `onLeave` terminait la manche avec la règle Survie ; aligne sur « meilleur score » (`bestScoreTeam`).

## Lot « améliorations vertes » (septembre 2026)
Sept chantiers à faible risque, livrés ensemble. **Aucun runtime JS sur le poste** (ni Node, ni Python, ni WSL) :
validation faite en **parsant les 15 fichiers modifiés dans le moteur JS du navigateur** (harnais jetable, imports/exports
neutralisés, code jamais exécuté) → 0 erreur ; les deux nouveaux panneaux ont en plus été rendus avec la vraie CSS.

**Features**
- 🎲 **Défi du jour** — `dayseed.js` (nouveau) : `dayKey()` (date UTC) → FNV-1a → **mulberry32**. Activé (bouton 🎲 du bandeau,
  **game master seulement**), Tanks et Bomberman génèrent leur carte avec ce générateur déterministe au lieu de `Math.random` :
  **même arène pour tout le monde pendant 24 h**. Le rng est passé en paramètre à `genSolidSet`/`genSolidSetB` (pas de variable
  globale mutable), et couvre aussi murs cassables, mélange des cases libres, barils, boue et téléporteurs.
  Réglage porté par le **hub** (pas par jeu) et re-poussé aux jeux via `game.onMessage(SYS, {t:'daily',on})` à chaque création
  d'instance → il survit aux changements de jeu. `SYS = {}` est un pseudo-membre : `seatOf(SYS)` renvoie −1, aucun siège touché.
- 🏅 **Classement du jour** — `leaderboard.js` : nœud réservé `store['#daily']`, remis à zéro au changement de date UTC,
  alimenté par `bumpDaily()` appelé depuis les 5 `recordRound()` (1 pt de participation + 3 pts de victoire ; bots exclus).
  Il vit **dans `store`** (donc sauvegardé par le `save()` existant, sans écriture Upstash supplémentaire) mais possède son
  **propre drapeau « sale »** : le faire passer par `dirty`/`lbMsg` polluerait `boards[g]` côté client (indexé par id de jeu).
- 💬 **Mini-chat de salon** — hub : `{t:'chat'}` assaini à la source, anti-spam 900 ms, historique des 20 derniers envoyé
  à la connexion (`{t:'chatlog'}`). Client : bouton flottant 💬 (à côté des émotes, **masqué en partie** comme elles),
  pastille de non-lu, journal + champ de saisie. Les messages s'affichent aussi en **bulle**, même pendant une manche.
  Le rendu est construit en `createElement`/`textContent` — **aucun innerHTML** sur du texte réseau.
- 🔒 **pick/start/pause réservés** — `PLAYER_ONLY = {start, pause, abort}` : un spectateur reçoit `{t:'denied', why:'spec'}`
  (`pick` et les réglages étaient déjà gatés par `GM_ONLY`). Toast dédié côté client.

**Graphismes**
- 🪧 **Écrans titre par jeu** — chaque client remplace son `fillText('NOM')` de lobby par un `drawTitle()` animé dans son identité :
  Pong néon avec balle qui rebondit entre deux raquettes · Tron tracé par une traînée de light-cycle sur grille en perspective ·
  Tanks plaque blindée rivetée + chenille et poussière · Bomberman lettres cartoon qui rebondissent avec mèche allumée ·
  Snake tige végétale qui ondule avec feuilles et tête de serpent. Tous : `measureText` → réduction si débordement (mobile),
  et **version statique sobre** si « réduire les effets ».
- 🔷 **Motifs par siège** — `public/patterns.js` (nouveau) : 6 motifs (uni/rayé/pointillé/chevrons/quadrillé/losanges) en
  `CanvasPattern` mis en cache (clé = contexte + motif + taille + encre ; siège 0 = `null`, zéro surcoût). Chaque client repasse
  le tracé de sa pièce avec le motif, et affiche `SEAT_GLYPH[i]` dans la carte HUD. **Gain réel en mode équipe**, où plusieurs
  joueurs partagent une couleur, et en palette daltonien.
- 🎆 **Célébrations par identité** — `fireConfetti(gameId)` : table `CELEB` (trajectoire chute/envol/gerbe × forme
  rect/point/traînée/étincelle/pétale × palette). Désert en gerbe pour Tanks, papillons qui montent pour Snake,
  pluie de pixels néon pour Tron, gros confettis cartoon pour Bomberman. Moitié moins de particules sous 520 px.
- 🎬 **Transition thématique** — `#xfade` devient un **balayage** aux couleurs du jeu (`::before` en dégradé sur `--accent`),
  déclenché au changement de jeu **et à chaque nouvelle manche** (`gs → countdown`, variante `.quick` qui laisse le plateau
  visible). L'animation est `animation-play-state:paused` hors transition (classe `.on`) — rien ne tourne en fond sur mobile.

**Corrigé au passage** : taper dans le champ pseudo ou le chat n'envoie plus Espace/flèches aux raccourcis du jeu
(`stopPropagation` ; les jeux écoutent en phase de bouillonnement). Le type `{t:'daily'}` est réservé au sens **serveur→client**
(le basculement client→serveur s'appelle `daytoggle`) pour ne jamais avoir le même nom de message dans les deux sens.

## Lot « jusqu'à 10 joueurs » (septembre 2026)
Plafonds **par jeu**, pas uniformes — chacun s'arrête là où il reste plaisant :

| Jeu | Avant | Après | Comment l'arène suit |
|---|---|---|---|
| Pong | 6 | **10** | `setArena` : k = 1 + 0,13·(n−2) → ×2,04 à 10 j. Terrain **et** raquette suivent k |
| Tron | 6 | **10** | `setGrid` : 50 → 76 à 6 j → **92** (plafond) à 8 j et + |
| Snake | 6 | **10** | `setGrid` : 30 → 46 à 6 j → **58** (plafond) à 10 j |
| Tanks | 6 | **8** | `setGridT` : grille **15 → 17 → 19**, bloc inchangé (BLK=40), ARENA = G×BLK |
| Bomberman | 6 | **8** | `setGridB` : grille **13 → 15 → 17** (toujours impaire), ARENA = GW×CELL |

**Effet de bord sur Pong, corrigé depuis** (voir « Raquettes proportionnelles » plus bas) : les arêtes du
polygone RACCOURCISSENT quand on ajoute des joueurs (2·R·sin(π/G)) alors que la raquette suivait k —
elle finissait par couvrir 59 % de son bord à 10 joueurs. J'avais présenté ça comme un confort ; c'était
un déséquilibre, signalé par l'utilisateur en test.

**Ce qui a dû suivre :**
- **Tanks / Bomberman** : leurs départs étaient un **tableau de 6 positions en dur** sur une grille **fixe**.
  Remplacés par `spawnsFor(n)` (4 coins → milieux haut/bas → milieux gauche/droite ; **l'ordre des 6 premiers
  reproduit l'ancien tableau**, donc rien ne change à ≤ 6 joueurs) et par une grille dynamique façon Tron/Snake
  (alias d'import mutable + champ de snapshot `ag` pour Tanks, `gw`/`gh` pour Bomberman).
- **Bomberman, piège évité** : `SD_SPIRAL` (spirale de mort subite) et `RING` (anneau du mode revanche) étaient
  des **tables précalculées au chargement** à partir de GW/GH. Devenues des fonctions, recalculées dans `setGridB`.
  Sans ça, la mort subite aurait fait tomber des blocs hors de l'arène et les revenants auraient tourné dans le vide.
- **Équipes jusqu'à 5** : nouveaux modes 4v4, 2v2v2v2 (8 j), 3v3v3 (9 j), 5v5, 2v2v2v2v2 (10 j).
  `'ABC'[winner]` devenait `undefined` pour les équipes D et E → passé à `'ABCDE'`.
- **Palette** : 6 → 10 teintes. Au-delà de 8 il n'existe plus de couleurs toutes distinguables
  (la palette daltonien sûre plafonne à 8) : c'est le **motif par siège** qui porte l'identification,
  d'où le passage de `patterns.js` de 6 à **10 motifs**.
- **HUD** : cartes créées depuis `MAX_SEATS` au lieu d'un `[0,1,2,3,4,5]` en dur, et colonnes plus étroites
  sous 600 px pour que 10 cartes ne repoussent pas le plateau hors de l'écran.

## Lot « réseau & fluidité » (septembre 2026)
Mesuré, pas estimé : instantané Pong réaliste à 10 joueurs reconstruit et pesé dans un navigateur.

| | Avant | Après |
|---|---|---|
| Instantané complet | 2 966 o | — |
| Message moyen après omission des clés inchangées | — | 2 460 o (**−17 %**) |
| Débit par client (10 joueurs) | **174 Ko/s** | **72 Ko/s** (**−59 %**) |

**Déjà en place avant ce lot** (donc pas à refaire) : `socket.setNoDelay(true)` dans `ws.js` (Nagle désactivé —
l'erreur classique qui ajoute 40 ms), interpolation par tampon d'instantanés dans les **5** clients, entrées
envoyées **au changement** seulement, delta sur `geo`/`grid`, diffusion à 4 Hz hors partie.

**1. Une seule trame pour tout le monde** — `conn.send()` appelait `encodeFrame()` **par client** : à 10 joueurs
× 60 Hz, 600 encodages de ~3 Ko par seconde. `wsFrame()` encode une fois, `conn.sendRaw()` écrit le même Buffer
sur toutes les sockets. Gain CPU serveur → moins de gigue de tick → plus fluide pour tout le monde.

**2. Omission des clés inchangées** — le hub compare chaque clé de premier niveau à la diffusion précédente et
n'envoie que ce qui a bougé ; le client fusionne sur l'état précédent du jeu (`stateCache` dans `app.js`, **un seul
point pour les 5 jeux**). Générique : aucun code de jeu modifié.
- `fx` n'est jamais comparé (`ALWAYS`) : c'est du ponctuel, le fusionner rejouerait les impacts en boucle. Depuis le
  24/09 il est **omis quand il est vide**, et le client remet `fx = []` quand il manque.
- Instantané **complet** forcé à chaque arrivée, à chaque changement de jeu et de `gs`, et toutes les **10 s** en jeu
  (2 s jusqu'au 24/09) → un client ne peut pas rester désynchronisé.
- La fusion crée un **nouvel objet** à chaque fois : les instantanés déjà empilés dans les tampons d'interpolation
  ne doivent jamais être modifiés après coup.

**3. Pong à 30 Hz seulement quand c'est utile** — la simulation reste à 60 Hz (précision physique intacte), seule
la diffusion tombe à 30 Hz **à partir de 7 participants**, là où le débit devient gênant. En dessous, rien ne change :
**aucune latence ajoutée pour une partie normale**. Le hub annonce la cadence dans `shz` et le client Pong aligne son
retard d'interpolation (33 ms à 60 Hz, 50 ms à 30 Hz) — sans ça le rendu saccaderait.
- **Piège évité** : les 5 jeux font `fx = []` en tête de `update()`, donc sauter une diffusion **perdait** impacts,
  explosions et morts. Le hub accumule désormais les `fx` des ticks non diffusés et les joint au message suivant.

**Validation** (aucun runtime JS sur le poste) : la logique diff + fusion a été **rejouée dans un navigateur sur
600 ticks** avec changement de jeu, arrivée d'un client en cours de partie, bascule 60→30 Hz, `geo` alternant
objet/inchangé/null et `stats` ponctuel → **0 écart de reconstitution**, **46 fx émis / 46 reçus**, et un client
démarrant en cours de flux se resynchronise à l'identique.

## Deux bugs de production trouvés en exécutant (21/09/2026)
Découverts dès la première sonde d'intégration, tous deux **déjà déployés** :
- **`CELL is not defined` — Bomberman faisait planter le serveur entier** dès qu'on sélectionnait le jeu.
  Cause : dans le lot « 10 joueurs », en retirant `ARENA` (inutilisé) de l'import de `games/bomb/server.js`,
  `CELL` avait été retiré avec — or il servait partout (positions, collisions, portées). `node --check` ne peut
  pas voir ça : c'est une erreur d'exécution, pas de syntaxe.
- **Les arrivants recevaient un delta au lieu d'un instantané complet.** Le chemin de connexion *normal* n'avait
  jamais reçu `conn.send(dailyMsg())`, l'historique du chat ni `fullNext = true` : un `replace_all` d'un lot
  précédent n'avait modifié que le chemin de *reconnexion*. Symptôme : un joueur qui rejoint voyait un HUD vide
  ou cassé jusqu'au rafraîchissement complet suivant (≤ 2 s), et n'avait ni classement du jour ni historique de chat.

## Mesures réelles (sonde 10 clients, serveur local)
| Jeu | Participants | Arène | Cadence | Débit/client |
|---|---|---|---|---|
| Pong | 10 | 1020×1020 | 30 Hz | **57,9 Ko/s** (contre 174 avant le lot réseau) |
| Pong | 4 | 630×630 | 60 Hz | **113,6 Ko/s** |
| Tron | 10 | grille 92 | 15 Hz | 5,5 Ko/s |
| Snake | 10 | grille 58 | 12 Hz | 5,4 Ko/s |
| Tanks | 8 | grille 19 | 30 Hz | 11,6 Ko/s |
| Bomberman | 8 | grille 17 | 30 Hz | 10,3 Ko/s |

> **Contre-intuitif et important** : une partie à **4** joueurs coûte **plus cher** qu'à 10 (113 contre 58 Ko/s).
> Deux raisons cumulées : elle reste à 60 Hz, et le tableau `players` sérialise **tous les `MAX_SEATS` sièges**
> même vides — passer de 6 à 10 sièges a donc renchéri le cas courant. C'est l'argument le plus fort pour
> l'optimisation « tronquer `players` au dernier siège occupé », qui profiterait surtout aux petites parties.

## Delta par joueur (septembre 2026) — le gros morceau réseau
`players` pesait **79 %** du paquet en réexpédiant 60 fois par seconde des champs statiques (pseudo, siège, équipe,
`bot`, `connected`). Le hub n'envoie plus que les joueurs — et les champs — **réellement modifiés**, sous forme
`pd: [[index, {champs}], …]` ; `app.js` reconstruit un tableau `players` **complet** avant de le passer au jeu.

**Fait entièrement dans `hub.js` + `app.js` : aucune ligne modifiée dans les 5 jeux.** (Mon estimation initiale
« ça touche les 5 jeux des deux côtés » était fausse — c'est ce qui a rendu l'option bien moins risquée.)
- Les instantanés **complets** (arrivée, changement de jeu, filet des 2 s) portent le tableau entier : le client a
  toujours une base saine, et toute dérive se corrige d'elle-même en moins de 2 s.
- Reconstruction **immuable** : nouveaux objets pour les joueurs modifiés, sinon les instantanés déjà empilés dans
  les tampons d'interpolation seraient réécrits après coup.
- Comparaison par champ : `===` pour les primitifs, `JSON.stringify` seulement pour les objets/tableaux (`buffs`).

**Validation** — échafaudage temporaire (`HUB_VERIFY=1` joignait une copie de vérité du tableau à chaque message),
sonde comparant champ par champ sa reconstitution : **0 écart** sur les 5 jeux, à 4, 8 et 10 participants.
Échafaudage retiré avant livraison. Vérifié ensuite dans un **vrai navigateur** : 6 cartes HUD correctes,
glyphes de motif par siège, hexagone de Pong, 0 erreur console.

### Débits mesurés (sonde 10 clients, serveur local)
| Jeu | Avant tout | Après lot réseau | **Après delta joueurs** |
|---|---|---|---|
| Pong 10 j | 174 Ko/s | 57,9 | **4,4** |
| Pong 4 j | ~174 | 113,6 | **4,4** |
| Tanks 8 j | — | 11,6 | **4,1** |
| Bomberman 8 j | — | 10,3 | **3,0** |
| Tron 10 j | — | 5,5 | **2,2** |
| Snake 10 j | — | 5,4 | **2,4** |

> Soit **−97 %** sur Pong à 10 joueurs. Ces chiffres sont des moyennes de session (lobby compris) ; en pleine action
> le régime permanent mesuré est de ~226 o/message, soit ≈ **6,6 Ko/s** à 30 Hz. Dans les deux cas, le problème de
> bande passante n'existe plus.

**permessage-deflate est donc abandonné.** Mesuré à −88 % séparément et complémentaire (−51 % de plus après le
delta), il ferait passer de 6,6 à 3,3 Ko/s : une économie sans conséquence pratique, qui ne justifie pas de toucher
au WebSocket écrit à la main (rayon de souffle total) ni de dépendre du comportement du proxy Render, non testable
depuis ce poste.

## Raquettes proportionnelles (Pong, septembre 2026)
La raquette occupait une **longueur absolue** qui suivait l'agrandissement du terrain, alors que les arêtes
du polygone **raccourcissent** avec le nombre de joueurs. Part du bord réellement couverte, mesurée dans les
instantanés du serveur (`players[].len` ÷ `geo.edges[].len`) :

| Joueurs | 2 | 3 | 4 | 5 | 6 | 8 | 10 |
|---|---|---|---|---|---|---|---|
| Avant | 26 % | 21 % | 26 % | 31 % | 36 % | 47 % | **59 %** |
| Après | 25 % | 25 % | 25 % | 25 % | 25 % | 25 % | **25 %** |

`PAD_RATIO = 0.25`, appliqué à la **longueur d'arête réelle** (`geo.edges[0].len`, polygone régulier) au lieu
d'une longueur absolue mise à l'échelle. Le choix de 1/4 n'est pas arbitraire : c'est **exactement la valeur
historique du duel et du carré** (26 %), les deux configurations les plus jouées — elles ne bougent donc pas,
et tout rentre dans l'ordre au-dessus. À 10 joueurs la raquette passe de 171 à **73 px**.

- `padLenOf()` dérive du bord **courant**, pas d'une valeur figée au départ : la raquette suit donc aussi le
  **rétrécissement de la mort subite**. Avant, l'arène se resserrait sans la raquette, donc la défense devenait
  *plus facile* à mesure que la mort subite avançait — l'inverse de l'effet recherché.
- Les modificateurs existants (👐 grow ×1,7, ▽ shrink ×0,6, malus de leader ×0,82) s'appliquent par-dessus,
  inchangés. Même cumulés, la raquette reste largement plus courte que son bord.
- `PAD_SPD` n'a pas bougé : il suit toujours k, si bien qu'à 10 joueurs on traverse son bord en ~26 ticks
  contre ~60 en duel — ce qui compense la raquette plus courte.

## Test de fumée et ménage (22 septembre 2026)

### `npm test` — `test/smoke.mjs`, zéro dépendance
Démarre le serveur sur le port 3999, ouvre de **vrais** clients WebSocket, joue une manche dans chacun des
5 jeux, puis sort en code 1 au moindre échec. **48 vérifications** : pas de plantage, état « play » atteint,
reconstitution du protocole delta, tailles d'arène, ratio de raquette de Pong, arrivée d'un joueur en cours
de partie, et journal serveur sans trace d'erreur.
> Il existe parce que les **deux pannes de production du 21/09** (`CELL is not defined` qui tuait le serveur
> entier, et le delta envoyé aux arrivants) étaient invisibles pour `node --check` — il fallait exécuter.
> Les deux auraient été attrapées ici en quelques secondes. **À lancer avant chaque push.**

### Pas de temps fixe — les jeux tournaient au ralenti
`setInterval(step, 1000/hz)` réarme le timer **après** le callback : la cadence réelle vaut
`1000 / (période + durée du tick)`, elle **chute donc quand la charge monte**. Mesuré par le test de fumée :

| | Pong | Tanks | Bomberman | Snake | Tron |
|---|---|---|---|---|---|
| Avant | 51/s | 27/s | 27/s | 11/s | 15/s |
| Après | **60/s** | **30/s** | **30/s** | **12/s** | **15/s** |

J'avais documenté ça comme « cosmétique, ~4 % de dérive » : c'était faux en amplitude **et en sens**.
Une balle 15 % trop lente, un décompte et des power-ups 15 % trop longs, et le jeu qui ralentissait à mesure
que des joueurs arrivaient. Corrigé par un accumulateur (timer 2× plus rapide que le pas, rattrapage plafonné
à 4 pas et 250 ms) : la cadence moyenne ne dépend plus de la charge.

### Purge des identités · grisage des réglages
Voir « Limites connues » ci-dessous, les deux lignes sont désormais barrées.

## Retours de test du 22/09 — murs-bumpers et messages de bonus

### Pong : les bords éliminés renvoient plus vite (6 participants et +)
Retour : *« à plus de 5 joueurs la partie s'éternise »*. Chaque élimination ajoutait un mur **passif**
alors qu'il restait de moins en moins de raquettes pour conclure. Désormais un bord dont le
propriétaire est éliminé relance la balle à **×1,035** (volontairement plus doux qu'un renvoi de
raquette, `HIT_SPEEDUP = 1,05`) : la pression monte toute seule à mesure que le terrain se vide.
Plafonné par `clampSpeed`, donc pas d'emballement. Actif seulement à partir de `nParts >= 6`.
- Le client dessine ces bords en **liseré ambré pulsant** (`snap.wallBoost` + état du propriétaire) :
  subir une accélération sans la voir venir aurait été pire que le problème d'origine.
- **Mesuré** par un compteur temporaire : à 10 participants, rebonds cumulés sur mur mort = 0 (10 et
  9 survivants), puis 3, 6, 9, 11, 14 à mesure des éliminations. À 4 participants : le compteur ne
  bouge pas. Échafaudage retiré.
- Au passage, la sonde a confirmé le diagnostic : **aucune élimination en 45 s à 10 joueurs** avec les
  vies par défaut.

### Messages de bonus / malus (les 5 jeux)
Retour : *« les icônes ne sont pas forcément claires »*. Nouveau module partagé **`public/gamemsg.js`** :
- `msgPerso()` — ce que TU viens de ramasser, bandeau lisible en haut du cadre.
- `msgGlobal()` — un effet qui touche tout le monde, bande fine **collée au bord supérieur, hors de la
  zone de jeu** : la contrainte était de prévenir tout le monde *sans gêner les personnes concernées*.
En DOM et non au canvas : texte net, zéro coût par frame, et le style suit l'identité du jeu actif via
les variables CSS. Les libellés disent l'**effet**, pas le nom (« Tir rapide : cadence doublée »).

## Retours de partie du 22/09 (soir)

### Chat inutilisable en jeu — deux causes cumulées
1. Les 5 jeux appellent `closePanels()` **à chaque instantané de partie**, soit 60 fois par seconde :
   le chat se refermait sous les doigts. Les modules reçoivent désormais `closeGamePanels`, qui
   épargne le chat — **un seul changement dans `app.js`, aucun jeu modifié**.
2. `.settings` est en `z-index:10`, donc **sous** les boutons flottants (11), les confettis (12) et les
   bulles (13) : le panneau passait derrière. `#chatPanel` monte à 14.
Le chat devient aussi la **seule fenêtre non modale** du site (pas de voile, pas de capture des clics) et
s'**ancre dans un coin** en partie au lieu de se centrer sur le plateau. Sur mobile il remonte dans la
bande du haut, loin du pavé directionnel — il y était purement masqué.

### Game master : l'échec était silencieux
Le mécanisme était correct — `hostId()` fait bien passer le porteur de `ADMIN_KEY` **devant** le titulaire
par défaut, donc il reprend la main en arrivant. Mais une clé absente ou refusée ne provoquait **aucune
réponse** : indiscernable d'un bug. Le hub répond maintenant `{t:'gm', ok, why}` et le client l'affiche
(`nokey` = `ADMIN_KEY` non configurée sur le serveur, `bad` = clé invalide). Le statut affiche `👑 game master`.
> **Manip** : ouvrir une fois `https://on-line.onrender.com/?admin=<clé>`, la clé est mémorisée et renvoyée
> à chaque connexion. Et `ADMIN_KEY` doit être défini dans les variables d'environnement Render.

### Pong : blocage sur parois parallèles
Constaté en partie : les deux joueurs face à face éliminés, il ne restait que deux murs parallèles et la
balle rebondissait indéfiniment sur le même axe — la manche ne pouvait plus se terminer.
`bounce()` impose désormais une composante **minimale le long de la paroi** (`WALL_MIN_TAN = 0.24`) plus un
léger aléa : la balle dérive donc toujours latéralement et finit par rencontrer une raquette. C'est une
garantie **géométrique**, pas statistique, et elle s'applique à tous les effectifs.

### Pong : murs-bumpers rendus perceptibles
« On ne remarque pas l'effet » : le ×1,035 discret devient un **pic à ×1,45** qui retombe en ~0,4 s
(`WALL_BURST_DECAY`), par-dessus un gain permanent ×1,05. Surtout, chaque bord éliminé **relève le plafond
de vitesse** (+7 %, plafonné à +50 %) — sans ça la relance était absorbée dès que la balle touchait le
plafond : très visible, mais sans effet sur la durée.
**Mesuré** (6 participants, 1 vie, bots) : manche terminée en **35 s contre 61 s** avant ce réglage, et
13 à 37 pics soudains par manche. À 8, les éliminations passent de `5s 23s 49s 76s 94s` à `5s 14s 23s 38s 65s 85s`.

### Tanks
- **👁 Camouflage** : le tank était affiché à 10 % d'opacité, donc toujours repérable. Il **disparaît**
  maintenant complètement de l'écran des adversaires (ni caisse, ni nom, ni barre de vie) ; seuls le porteur
  du **📡 radar**, ses coéquipiers et lui-même le voient. Mais **ses obus restent visibles** et il continue
  de soulever **poussière et boue** (émission sortie du filtre d'opacité, et plus dense sur une case de boue) :
  on peut le pister à la trace. La fumée de tank endommagé, elle, vient du tank et non du sol : elle est coupée.
  > Le camouflage est appliqué **côté client** : la position transite toujours sur le fil. C'est un jeu entre
  > amis, pas de l'anti-triche — masquer côté serveur imposerait un instantané par joueur et défferait
  > l'optimisation réseau (trame unique partagée).
- **➳ Obus perçant** : traverse et détruit **3 caisses de bois ou 1 bloc de métal** (avant : une seule caisse
  de bois, et le métal l'arrêtait net).
- **👟 Vitesse** : s'applique désormais **aussi à la rotation**. Elle en était exclue — un tank « rapide »
  tournait à vitesse normale, ce qui rendait le bonus peu lisible. L'avance et la marche arrière l'avaient déjà.

## iOS : l'appui long figeait les commandes (22/09)
Sur un ancien iPhone, maintenir une flèche ouvrait la **loupe** de Safari et **sélectionnait le glyphe** :
la sélection capturait le toucher, plus rien ne répondait et rien ne permettait de désélectionner.
Deux manques précis :
- **`-webkit-touch-callout` n'était déclaré nulle part** — c'est pourtant LA propriété qui désactive
  ce menu d'appui long sur iOS ;
- **`user-select` n'existait que sans préfixe**, or Safari < 12.1 ignore la version non préfixée.
Ajoutés sur tout ce qui se touche (commandes, boutons, onglets, canvas) et sur `body.playing`, avec
l'exception attendue : les champs de saisie restent sélectionnables, sinon le chat devient inutilisable.

**Deux garde-fous JS dans `app.js`, aucun jeu modifié :**
1. `preventDefault()` sur `touchstart`, **strictement limité aux `.touch`** : ces boutons répondent à
   `pointerdown`/`pointerup` et jamais à `click`, donc l'annuler ne supprime aucun clic utile.
   L'étendre aux autres boutons casserait leur `onclick` sur mobile.
2. **Shim Pointer Events** : Safari iOS ne les a que depuis la **version 13**. En dessous, les pavés
   tactiles étaient totalement muets. Les événements tactiles sont traduits en événements pointeur
   synthétiques. Le bloc entier est ignoré dès que `PointerEvent` existe — aucun risque de double appui
   sur un appareil récent.

> **Vérifiable seulement sur iOS** : Chrome n'implémente pas `-webkit-touch-callout` et le retire même du
> CSSOM. Ce qui a pu être confirmé ici : `user-select:none` appliqué aux commandes et au canvas,
> `user-select:text` conservé sur le champ de chat, `touchstart` bien annulé sur les `.touch`, appui et
> relâchement toujours transmis (pas de double envoi), shim inerte quand `PointerEvent` existe.

## Plateau plein écran (23/09) — `body.playing.dock`

Retour utilisateur, capture à l'appui : le plateau occupait à peine le tiers d'un écran 1600×900, la
liste des joueurs était **sous** le plateau et le chat flottait par-dessus. Deux causes cumulées, l'une
de mise en page, l'autre **propre à Pong**.

### 1. La largeur était perdue
Sur un 16:9, le plateau est limité par la **hauteur** ; toute la largeur en trop ne servait qu'à afficher
le fond animé. On la convertit donc en deux colonnes fixes — **chat à gauche, joueurs à droite** — et le
plateau prend enfin toute la hauteur utile.

- `app.js · layoutArena()` pose la classe `dock` et calcule `--sidew` = **ce qui resterait perdu**,
  divisé en deux, plafonné à 320 px. Pas de media query fixe : sur un 4:3 (1024×768) la largeur manque,
  `dock` reste absent et l'empilement vertical historique s'applique tel quel.
- La largeur des **commandes latérales du jeu actif** (`SIDE_JEU`, 200 px pour les flèches ▲▼ de Pong)
  est déduite **avant** le partage. Sans ça les colonnes les lui volaient : mesuré, le canvas de Pong
  tombait à 704 px contre 774 avant la refonte — une régression.
- `public/layout.js` (nouveau) porte `arenaSize()`, partagée par les 5 jeux : en mode `dock` elle
  **mesure la colonne centrale** (`.stage`, posée en `fixed`) ; sinon elle applique la formule
  historique en fractions de fenêtre. Les 4 jeux non-Pong ont reçu un `<div class="stage">` autour de
  leur `canvas-wrap` pour offrir la même prise au CSS.
- Le chat docké n'est plus une fenêtre modale mais une **colonne repliable** (`body.nochat`, mémorisée) :
  le bouton 💬 et sa croix la replient, le plateau récupère alors la place. Tant qu'elle est ouverte,
  les messages n'émettent **ni bulle ni pastille** — ils sont déjà sous les yeux. `Entrée` rend le focus
  au jeu (`chatInput.blur()`), sinon le champ avalait les flèches.

### 2. Pong dessinait son terrain dans 66 % du canvas
Le serveur bâtit un **polygone régulier inscrit dans un cercle**. Sur un carré (duel, ou 4 joueurs) le
côté vaut `R√2` : le terrain ne mesurait que **66 % du canvas**, le tiers restant n'étant que du fond
étoilé. C'est exactement l'« effet espace qui prend de la place pour rien » signalé.
`client.js · geoFit()` recadre donc le polygone sur le canvas (marge haute un peu plus large pour les
bandeaux de bonus), via deux repères explicites dans `draw()` : `base()` pour le canvas (fonds, voiles,
écrans de titre) et `world()` pour le terrain.

> ⚠ **Le recadrage est FIGÉ pendant la manche** (`gs` = play/paused/over). La mort subite rétrécit le
> terrain : un recadrage permanent aurait compensé pile ce rétrécissement et on ne l'aurait plus vu du
> tout. Il est recalculé au `countdown`, terrain à sa taille pleine.

### Mesuré (navigateur, 5 jeux, parties réelles)
| écran | avant | après | terrain Pong réellement visible |
|---|---|---|---|
| 1600×900 | 774 px | **822 px** | 514 → **~775 px** (+50 %) |
| 1920×1080 (10 joueurs) | 928 px | **1002 px** | décagone plein cadre |
| 1024×768 (4:3) | 660 px | 660 px (`dock` inactif, inchangé) | recadrage actif quand même |
| 375×812 (mobile) | inchangé | inchangé | le recadrage profite aussi au mobile |

`npm test` : 48/48, cadences nominales (pong 60/s · tron 15/s · snake 12/s · tank 30/s · bomb 30/s).

### 2e retour (capture annotée) : toute la hauteur, fond du jeu sur toute la colonne
Le plateau restait une « carte » posée sur la page, sous un bandeau de 64 px réservé aux boutons.
- La colonne centrale `.stage` va maintenant du **haut au bas** de l'écran (`top:0; bottom:0`, marge
  interne de 14 px) : le bandeau des boutons flottants ne concerne que les colonnes latérales, au-dessus
  desquelles ils sont posés. `layoutArena()` offre donc `H − 28` au plateau ; `arenaSize()` déduit la
  marge interne de la colonne.
- La colonne porte le **fond d'ambiance de chaque jeu** (`--amb` + motif CSS : étoiles de Pong en
  parallaxe lente, grille de Tron, sable rayé de Tanks, pelouse de Snake, confettis de Bomberman), avec
  les variantes CRT/clair de Pong et Tron. Motifs coupés par « Réduire les effets » et
  `prefers-reduced-motion`.
- **Pong** dessine alors un canvas **transparent** hors du terrain : ses coins laissent voir les étoiles
  de la colonne, sans couture. Marges de recadrage ramenées à 8/6 unités (les bandeaux de bonus passent
  brièvement sur le bord haut — accepté, la demande était « toute la hauteur »).
- Bandeau de tournoi déplacé au-dessus de la liste des joueurs (le haut du centre est le plateau).
- Mesuré en 1920×911 (la taille de la capture) : colonne 348→1572 × 0→911, plateau 519→1402 × 14→897,
  identique pour les 5 jeux. 1024×768 inchangé.

**Défaut ancien corrigé au passage** : `#confetti` héritait de la règle générale `canvas{}` et donc
d'un fond **opaque** — à chaque victoire, l'écran de fin disparaissait ~4,5 s sous un aplat bleu nuit.
Fond transparent explicite.

### Téléphone en partie : le plateau et la manette, rien d'autre
Demande utilisateur : sur téléphone, ni liste des joueurs ni chat pendant qu'on joue ; les deux
redeviennent accessibles **à l'élimination**, à la demande.
- Tant qu'on joue : seule **sa propre carte** reste, réduite (vies de Pong, bonus actifs, équipement de
  Bomberman — rien d'autre ne les affiche) ; bouton 💬 masqué ; **pas de bulle de chat** sur le plateau,
  la pastille « non lu » attend sur le bouton.
- `body.out` (posé par `app.js · majHorsJeu()` après chaque `onState`) = éliminé ou spectateur : 💬 et
  👥 apparaissent dans le bandeau haut, la liste s'ouvre en surimpression. Les deux s'excluent (même
  emplacement). De retour en jeu (nouvelle manche, résurrection), l'écran est libéré sur-le-champ.
- **Aucun jeu modifié** : l'élimination est lue sur les cartes que les 5 jeux tiennent déjà (`.pc.me`,
  `.pc.dead`). Bomberman en revanche n'est pas marqué éliminé tant qu'il joue depuis le bord — il garde
  donc sa manette, c'est voulu.
- ~~Limite : un arrivant en cours de manche n'avait le chat qu'à la fin~~ **CORRIGÉ (24/09)** : `app.js` retient
  son siège (message `welcome`) et lit `playing` dans l'état de la partie — un siège hors de la manche = « hors jeu ».
  Vérifié : arrivant en pleine manche de Tron → 💬 et 👥 ; joueur en jeu (compte à rebours compris) → ni l'un ni l'autre.
- Seuil : `innerWidth <= 600`, le même que le bloc mobile de `style.css`. PC et tablettes inchangés.

### Page d'essai `/manette.html` — PERMANENTE
Prototype des commandes tactiles (`noindex`), **lié depuis Réglages d'affichage** : 4 dispositions
(actuelle · pouces · joystick flottant · Pong au glisser), curseur de taille, compteur de ratés.
Événements tactiles bruts : fonctionne sous iOS 12. **À garder** (demande utilisateur) : chacun doit
pouvoir tester et faire des retours, notamment sur ancien iPhone. Ne pas proposer de la supprimer.

Constat fait en la construisant, qui pèse sur le choix : **en portrait, c'est la largeur qui plafonne la
taille des touches**, pas le réglage. Une croix de 3 touches + une colonne d'actions ne tiennent côte à
côte qu'à ~77 px sur 375 px de large (iPhone 8) et ~64 px sur 320 px (iPhone SE) — à 82 px elles se
chevauchaient. Le joystick flottant n'a pas cette contrainte (78 px sur SE).

## Joystick tactile (23/09) — `public/joystick.js`
Choix utilisateur après essai sur `/manette.html` : **joystick flottant à 82 px** (Pixel 7 Pro). Défaut
sur téléphone (≤ 600 px) pour les 5 jeux ; réglage « Manette tactile : Joystick / Croix »
(`a11y.pad`, `body.pad-croix`) pour revenir à la croix.
- Le stick naît sous le pouce, n'importe où dans sa zone (anneau 139 px, bouton 51 px, zone 189 px),
  zone morte 28 % du rayon. Actions à 92 / 82 px. En partie, la manette est collée en bas de l'écran.
- **Il ne réimplémente aucune commande** : il actionne les boutons tactiles existants de chaque jeu par
  des `pointerdown`/`pointerup` synthétiques (comme le relais vieil-iOS). Logique d'entrée des jeux intacte.
- Tables (`CARTES`) : Tron, Snake, Bomberman = 4 directions avec hystérésis (il faut dominer de 25 %
  pour changer d'axe — sinon un pouce à 45° ferait zigzaguer serpent et moto) ; Tanks = 8 directions
  (avancer ET tourner, comme au clavier).
- **Pong** fournit `mod.joy(dx, dy)` : la poussée est projetée sur la tangente du bord du joueur, avec la
  même règle de sens que `humanMove()` côté serveur. Dès 3 joueurs les bords sont inclinés : on pousse le
  stick là où l'on veut voir filer sa raquette. Vérifié : en duel ↑/↓ pilotent, ←/→ ne font rien ; à 5,
  ↑ et ← vont vers l'extrémité haut-gauche du bord.
- Relâche tout au changement de jeu, à la perte de focus et quand la page passe en arrière-plan.

### Revue contradictoire du lot (workflow, 3 relecteurs + 1 sceptique par défaut)
5 défauts signalés, 3 confirmés, 2 réfutés — les 4 corrigés ci-dessous ont été vérifiés en navigateur :
- **Accumulation d'écouteurs (défaut ANCIEN, le plus grave)** : les 5 jeux branchaient leurs boutons
  tactiles dans `init()`, rappelé à chaque retour sur le jeu (module singleton, DOM statique) sans les
  débrancher. Après k retours, un appui partait k fois : **k mines** (Tanks), **k bombes** (Bomberman),
  k virages. Avec la limite de débit, un joueur pouvait même être coupé en tournoi. Corrigé par un
  drapeau `cable` : branchement au premier `init()` seulement. Vérifié : 1 appui = 1 message après
  plusieurs allers-retours.
- **Hystérésis du joystick** (signalé puis réfuté de justesse, corrigé quand même) : un pouce posé pile
  sur un seuil basculait enfoncé/relâché à chaque `touchmove` ; la limite de débit risquait de jeter le
  relâchement final. Tous les seuils sortent désormais à 75 % du seuil d'entrée. Vérifié : 20
  frémissements autour du seuil = 0 message.
- **Pong sur iPhone SE** : le joystick (189 px) faisait déborder la page. `arenaSize()` déduit
  maintenant la hauteur réelle des commandes sur téléphone (plancher 200 px). Vérifié en 320×568 :
  Pong, Tanks, Snake tiennent sans défilement.
- **Recul d'horloge** : le seau à jetons pouvait plonger sous zéro → `Math.max(0, now - seauT)`.

## Prédiction locale (Pong, 23/09)
Sa propre raquette bougeait ~100 ms après l'appui : aller-retour réseau + tick serveur + tampon
d'interpolation. Elle est maintenant **prédite** (`client.js · predireMoi`), les autres restent interpolées.
- Réplique exacte de `humanMove()` : vitesse `pspd` (nouvelle clé du snapshot, dépend du nombre de
  joueurs), même règle de sens, malus d'inversion (`p.inv`), butées (`p.len`).
- **Aucune correction pendant le mouvement** : le serveur est en retard d'une latence par construction,
  s'y recaler ferait reculer la raquette. Il reçoit appui ET relâchement avec le même retard, donc il
  s'arrête au même endroit : au repos (après RTT + 120 ms, RTT mesuré par le ping d'`app.js`), on
  converge vers lui. Écart > 35 % du bord (nouvelle manche…) : recalage immédiat.
- **Compensation côté serveur** (`ballPaddles`) : une raquette humaine en mouvement a une avance de
  collision de `LEAD_TICKS` = 2 ticks dans son sens de marche (`p.mv`). Sans elle, la raquette vue en
  avance à l'écran rattrapait des balles que le serveur jugeait ratées.
- Mesuré avec 80 ms de latence simulée : la raquette réagit en **26 ms** (une image) au lieu de 135 ms ;
  déplacement identique au serveur (123 unités), **écart final 0** — aucun effet élastique.

## Refonte graphique des 5 jeux au niveau du Sumo (23/09)
Demande utilisateur : le Sumo étant jugé plus abouti, porter les 5 autres au même niveau (sprites, sols,
effets, écrans). Un agent par jeu, sur son seul `client.js`, le client du Sumo servant de barème : décor
pré-rendu texturé, sprites détaillés, un visuel par état et par bonus, un effet par événement, ambiance
animée discrète, écrans titre / compte à rebours / pause / fin thématisés, pictogrammes de bonus dessinés.
**Aucun changement de règle ni de protocole** (le serveur n'est pas touché).
- **Fonds de page** (fait ensuite à la main, `style.css` · section « D. Fonds de page ») : même recette que
  le dohyō — une matière, des sources de lumière, un bandeau identitaire, des animations d'opacité ou de
  transformation seulement. Pong : nuit synthwave, soleil rayé, sol quadrillé en vraie perspective qui
  défile (thème CRT en phosphore vert). Tron : cœur de données, colonnes de lumière, sol cyan en
  perspective. Tanks : désert en trois plans de dunes + bandeau d'acier riveté à rayures de danger.
  Snake : rais de soleil, pelouse, haies ; lumière qui respire. Bomberman : papier peint de confiserie +
  store festonné. Le sol en perspective est mis en pause pendant la partie (caché par le plateau).
  Effets réduits : retour à l'aplat `--bg1`. Au passage, **les 8 `inset` du fichier sont réécrits en
  top/right/bottom/left** : absents avant iOS 14.1, ils donnaient une taille NULLE à l'écran de fin, au
  voile des panneaux et au fondu entre jeux sur les anciens iPhone.
- ⚠ Les agents ont été coupés par la limite de dépense AVANT leur phase de revue adverse. Le travail a été récupéré et
  vérifié à la main : parties réelles contre bots dans les 5 jeux (compte à rebours, jeu, palette
  daltonienne, contraste, effets réduits, pause/reprise, changements de jeu répétés) → **0 erreur** ;
  écrans de fin atteints en vrai pour Pong, Tron, Snake, relus au code pour Tanks et Bomberman ; API
  canvas absentes des vieux Safari : aucune ; drapeau `premiere` intact partout ; pièces critiques de
  Pong (geoFit, predireMoi, canvas transparent, joy) et **camouflage réel de Tanks** intacts.
- Coût de rendu mesuré (JS par image, plateau 1090 px) : pong 0,45 ms · tron 0,40 · snake 0,41 ·
  tank 0,59 · bomb 0,63 — dans l'enveloppe du Sumo (0,63 ms).
- Non vérifiable d'ici : les sons, le ressenti sur vieux iPhone.

## Améliorations graphiques transverses (23/09)
Cinq chantiers, AJOUTÉS par-dessus la refonte (condition de l'utilisateur : ne rien rendre inutile) —
diff additif (+848 / −56). Briques partagées écrites d'abord (et testées, injection comprise), puis
intégrées par un agent par jeu + un pour la vitrine, chacun relu par un agent adverse (qui a trouvé et
corrigé un défaut réel dans chaque chantier : journal de manche conservé après un départ, bord non
teinté pendant les tremblements, etc.).
- **Vitrine** (`vitrine.js`) : les onglets deviennent 6 cartes à mini-scène animée (une seule boucle,
  ~30 i/s, en pause en partie et page cachée, image fixe en effets réduits) — toujours des
  `button.gtab[data-id]`, donc sélection, jeu actif et grisage non-game-master inchangés. PC : 6 en
  ligne ; téléphone : 3 × 2.
- ~~Avatars sur les pièces~~ **RETIRÉS le jour même à la demande de l'utilisateur** (ils gâchaient les
  visages travaillés, surtout à Bomberman) : `avatar-sprite.js` et `window.__AVSRC` supprimés. L'avatar reste
  sur les cartes joueurs et les classements. Ne pas reproposer. Pour mémoire, la version retirée :
  (`avatar-sprite.js`, source `window.__AVSRC` d'`app.js`, emoji ou image
  validée) : pastille à l'étiquette de la raquette (Pong — pas sur la raquette, pour garder le motif du
  siège), sur la moto, la tourelle, la tête du serpent, le bombeur, le lutteur. Char camouflé caché :
  pas d'avatar.
- **Éclairage dynamique** (`lumiere.js`) : balles, phares et traînées, tirs, traçantes, explosions,
  flammes, ondes de choc éclairent le sol. Un char caché n'émet aucune lueur (ses obus, si).
- **Crépuscule** (`crepuscule.js`) : Pong d'après `sd`, Tron d'après `shrink`, Sumo d'après ring/ring0,
  les autres d'après le temps de manche (côté client). Plafonné bien avant le noir.
  **24/09 — plus dramatique + duel final commun** (retour « trop discret ») : teinte or → **rouge sang** → violet, multiply
  `0.18 + 0.44 t`, vignette jusqu'à 0.64. `creerDuel()` : dès qu'il ne reste que **2 joueurs ou 2 équipes** en lice sur une
  manche commencée à plus de 2, la nuit tombe en ~4 s (courbe en S, plafond 0.92) et le bandeau « ⚔ Duel final ! » s'affiche
  une fois (Snake garde son propre message de duel). Chaque jeu prend `max(sa montée propre, duel)` ; une manche qui démarre
  à 2 garde la montée progressive du jeu. Détection purement client, sur `players[].playing/alive/team`.
- **Écran de fin enrichi** (`finpartie.js`) : courbe de la manche (vies, distance, longueur…) + meilleure
  action repérée sur la courbe. Journal tenu côté client : un arrivant en cours de manche n'a que la fin.
- Au passage : sur téléphone, ✕ / ⏸ / ⚙ s'affichaient AUSSI dans le lobby (défaut présent depuis juin,
  `display:flex` sans condition) → limités à la partie.
- Vérifié en navigateur : 0 erreur dans les 6 jeux, avatar sur la tourelle, lueurs des traçantes, écran
  de fin de Tron avec courbe et meilleure action, vitrine PC et téléphone. `npm test` 63/63.

## Retour du 23/09 (soir) : avatars retirés, fonds Tanks/Snake, menus alignés
- **Avatars sur les pièces retirés** (voir la section précédente) — refus définitif.
- **Fonds plus travaillés** pour les deux jugés fades. Tanks : mesas à l'horizon dans la brume de chaleur,
  **mur de sacs de sable** sur deux rangées surmonté de barbelés sur piquets. Snake : **fleurs semées**
  dans la pelouse, taches de soleil tamisé, **palissade** de bois blanchi avec traverses et fleurs au pied.
- **Menus aux mêmes coordonnées dans les 6 jeux.** Mesuré avant : Tanks et Bomberman décalés de 30 et
  34 px (marge sous leur bandeau), boutons et barre « Prêt » de 1 à 4 px (hauteur de ligne « normale »,
  qui dépend de la police du jeu), plateau de Pong 35 px plus haut, cartes joueurs de 1 à 3 px. Corrigé :
  bandeaux affinés (≤ 21 px, plus de marge spéciale), `button{line-height:1.25}` et `.readybar{line-height:1.3}`,
  taille de plateau COMMUNE au lobby (`arenaSize`, plafond 760, 0,62 × hauteur), hauteur minimale commune
  des cartes (66 px PC, 70 px téléphone), et sur téléphone plus de manette dans le lobby (elle revient au
  compte à rebours ; celle de Pong décalait tout le bas de page). Mesuré après : **identique au pixel** pour
  les 9 éléments du lobby, sur PC (1440×860) comme sur téléphone (375×812). Seule la hauteur de la barre de
  commandes varie, son haut étant commun : chaque jeu n'a pas le même nombre d'options.

## Quota de bande passante Render (23/09)
Plan Hobby (gratuit) : **5 Go/mois de bande passante sortante PAR ESPACE DE TRAVAIL** (les deux sites s'ils le
partagent), réponses WebSocket comprises ; au-delà et sans moyen de paiement, **Render éteint les services
jusqu'au mois suivant** (docs Render « Outbound Bandwidth »). Relevé utilisateur : 586 Mo au 23/09.
Mesuré par onglet (sonde `debit.mjs`, serveur local) :
| situation | avant | après |
|---|---|---|
| lobby, personne ne joue | 2,2 Ko/s · 4 msg/s · **7,8 Mo/h** | **~0** (rien quand rien ne change) |
| lobby Tanks, bots réglés | 1,7 Ko/s | 0,4 Ko/s (filet de 30 s) |
| en jeu Pong / Tanks / Sumo | 10,1 / 8,3 / 11,6 Ko/s | inchangé (~30-40 Mo/h par joueur) |
- **Lobby** (`hub.js`) : hors jeu, un message qui n'apporte rien n'est plus envoyé, et le filet d'instantané
  complet passe de 2 s à 30 s. Un changement (réglage, arrivée) part toujours tout de suite (42 ms mesurés),
  un arrivant reçoit toujours un instantané complet immédiat.
- **Onglet caché** (`app.js · armerVeille`) : hors partie, connexion coupée après 1 min cachée, rouverte au
  retour (statut « En veille »). Jamais en partie. Game master rendu à la reconnexion (clé admin).
- **Ordre de grandeur restant** : ~35 Mo par joueur et par heure de jeu → 5 Go ≈ 140 heures-joueur par mois
  (ex. 4 à 5 soirées de 3 h à 10). Leviers en réserve, non faits : diffusion de Pong à 30 Hz (−50 % sur Pong ;
  la prédiction locale couvre sa propre raquette), permessage-deflate via zlib natif (≈ −50 % partout, mais
  touche au WebSocket écrit à la main et dépend du proxy Render).

## Filet de sécurité du hub (23/09)
`game.tick()` et `game.onMessage()` n'étaient protégés nulle part : une exception dans n'importe lequel
des 6 jeux tuait le processus Node, donc le site pour tout le monde (c'est la panne du 21/09,
`CELL is not defined`). `hub.js · incident()` journalise l'erreur, **relance une partie neuve du même
jeu**, y fait rejoindre tout le monde et prévient les joueurs (note « Incident de jeu »). On perd la
manche en cours, plus le site. Journal et note limités à une fois par 5 s (un jeu qui planterait à
chaque tick se relancerait en boucle sans tomber). Création de partie comprise dans le filet.
Test permanent : `SMOKE_FAULT=1` (posé par `npm test` seulement) fait lever une erreur au message
`__panne` ; le test vérifie que le serveur survit, relance la partie et prévient.

## Protections du serveur (23/09) — le site est public, l'instance unique
- **Plafond de trame** (`ws.js · MAX_FRAME` = 64 Ko, le plus gros message légitime — l'avatar — fait
  ~19 Ko). Refus dès l'en-tête, avant de stocker la suite. Avant : une trame annonçant une taille énorme
  faisait accumuler au serveur tout ce qu'on lui envoyait, jusqu'à saturer la mémoire.
- **Débit par connexion** (`hub.js · wire()`, seau à jetons) : 40 messages/s en régime, rafales de 80 ;
  au-delà les messages sont ignorés, et 500 rejets en 5 s coupent la connexion.
- Tron et Snake ignorent désormais la répétition automatique du clavier (`!e.repeat`, comme les 3 autres) :
  ils renvoyaient la même direction ~30×/s pour rien.
- `npm test` couvre les deux (54 vérifications) : trame de 70 Ko coupée, message de 30 Ko accepté,
  rythme humain (30/s) jamais bridé, inondation coupée sans toucher les autres joueurs.

## Fiabilité, quota et « Rejouer » (24/09)
Lot issu de la revue « propositions » (8 agents), validé par l'utilisateur : tout le point 1 + deux points du 2.
- **Trois façons de tuer le serveur, fermées** (reproduites sur une copie, jamais sur la prod ; `npm test` échoue sur
  l'ancien code) : `{t:'pick', id:'constructor'}` (clé héritée d'Object → TypeError hors filet), une requête brute
  `GET http://[` (`new URL` dans un gestionnaire async non géré), et un pseudo `constructor`/`__proto__` (classements
  indexés par pseudo : pollution d'`Object.prototype`, puis mort 12 s après un départ en pleine manche). Correctifs :
  `own(GAMES, id)` ; pseudo qui serait une clé héritée → suffixé `_` à la source (`hub.js`, message `name`) ;
  `hasOwn` dans les 6 `lbEntry`, `bumpDaily`, `getAvatar`, `DIRS[m.d]` ; agrégats en `Object.create(null)` ;
  gestionnaire HTTP sous filet (400) ; `garde(ou, fn)` fait passer par `incident()` **tous** les appels au code des
  jeux hors tick/onMessage (arrivée, départ — y compris dans le minuteur de grâce —, renommage, départ forcé, défi du
  jour) ; `try/catch` autour de `conn._msg` (`ws.js`) et `unhandledRejection` journalisé (`server.js`).
- **Classement : plus jamais écrasé après un chargement raté** (`leaderboard.js` réécrit). Rien n'est écrit tant que
  la lecture n'a pas réussi (`charge`) ; relances 5 s / 30 s / 2 min ; à la réussite, les manches jouées entre-temps
  sont **fusionnées** (best*/most* → max, fastest*/fewest* → min, compteurs → somme ; historique concaténé) et tout est
  rediffusé. Écritures regroupées (1 s pour le classement, 10 s pour les avatars, une seule en vol) ; en local, `.tmp`
  + `rename` (atomique) et un fichier illisible est renommé `.corrompu`. `lbreset` : clé admin seulement (`ADMIN_ONLY`),
  plus l'hôte de repli. `LEADERBOARD_FILE` (env) : le test de fumée écrit dans un dossier temporaire, et son serveur
  ne reçoit **aucune** variable `UPSTASH_*` (des manches s'y terminent désormais pour de vrai).
- **Connexions fantômes** : `ws.js` envoie un ping (0x89) toutes les 15 s ; une connexion muette depuis 45 s, ou dont
  la file dépasse 512 Ko, est coupée. Ce n'est pas un réveil de Render (rien ne part vers un client non connecté).
  Un jeton porté par un membre **encore connecté** (même onglet revenu avant la chute de sa socket fantôme, onglet
  dupliqué) : la nouvelle connexion **reprend** le membre (même id, même siège) ; l'ancienne reçoit `{t:'remplace'}`,
  est fermée sans déclencher de départ, et le client affiche « Ouvert dans un autre onglet — touche ici pour
  reprendre » sans se reconnecter. Une grâce existante sur un jeton est soldée (`onLeave`) au lieu d'être écrasée.
  Hôte de repli = **plus ancien rang d'arrivée** (`ident.rang`), plus la position dans `members` : un F5 ne coûte plus
  le rôle. Jeton client en **sessionStorage** (propre à l'onglet, survit au F5) : deux onglets = deux joueurs.
  Salle plafonnée à 24 membres (`{t:'plein'}`, le client réessaie au bout de 30 s).
- **Amplificateurs de quota** (le seau borne le nombre de messages, pas ce qu'ils déclenchent — un avatar renvoyé en
  boucle coûtait 1,1 Mo/s par témoin) : `differer()` applique avatar (5 s), pseudo (1 s) et « Prêt » (250 ms) tout de
  suite si le précédent est ancien, sinon une fois à l'échéance avec la dernière valeur ; valeur identique = rien.
  Écho du ping : `ts` numérique seulement. `dayreq` 1/s. `daily` venant d'un client refusé (`SYS_ONLY`). Émotes en
  liste blanche. Jeton `crypto.randomBytes`. Origine de l'upgrade WebSocket : doit être le même hôte (`Host` ou
  `X-Forwarded-Host`) ; absente = acceptée (clients non navigateurs, test de fumée).
- **Débit en jeu** : complet toutes les **10 s** en jeu (au lieu de 2) et à chaque changement de `gs` ; `fx` omis quand
  il est vide (le client remet `s.fx = part.fx || []` — indispensable, sinon les effets se rejoueraient) ; `g` seulement
  dans les complets (le client prend `m.g || activeId`) ; booléens faux omis (Pong `gh`/`iv`, Tanks `p`/`h`,
  Bomberman `r` — lus par vérité). Mesuré : ~98 % des messages sans `g`, 79 à 96 % sans `fx`. Au passage : un
  instantané de l'ANCIEN jeu partait étiqueté du nouveau lors d'une transition de tournoi — il est jeté.
- **« Rejouer » vaut « Prêt »** (`hub.js`, aucun jeu modifié) : un `start` d'un joueur pas prêt le marque prêt ; celui
  qui complète la salle lance. Garde de 2 s après une fin de manche (`GARDE_FIN`) : un Espace encore tenu (tir, bombe)
  ne marque personne. Le dernier « Prêt » (bouton ou Rejouer) lance la manche tout seul (≥ 2 joueurs, jeu au repos,
  pas pendant une transition de tournoi). Le refus nomme les retardataires (« ⏳ On attend Léa, Max »). En fin de
  manche et après un changement de bots, les spectateurs prennent les sièges libres dans l'ordre d'arrivée.
- **Tron et Snake : file de 2 virages** (`virage()` dans les deux serveurs, `pendingDir` + `nextDir`) : « haut puis
  gauche » dans le même tick perdait les DEUX virages ; on compare maintenant au dernier virage prévu (même direction
  ignorée, direction opposée = correction du dernier virage, demi-tour sur soi-même ignoré), un virage consommé par
  tick. Sous ⇄ (Tron), la file est tenue dans le repère des touches et l'inversion appliquée à la consommation, comme
  avant. **Écho immédiat** côté client (`public/echo-virage.js`) : un chevron devant sa propre tête jusqu'à la
  confirmation par l'instantané (450 ms au plus), jamais pour un demi-tour refusé.
- `npm test` : **81 vérifications** (nouveau bloc « robustesse »).
- **Revue adversariale du lot** (5 relecteurs avec sondes réelles, 24 constats) : 20 corrigés le 24/09 — rafale de
  pings (un seul pong par salve, au plus 1/s ; file d'écriture contrôlée à chaque envoi), plafond de 24 remplaçable
  par UN script (→ 60), `coupure` client jamais remise à zéro, relance « plein » qui ignorait la veille, ordre
  d'assise par rang (l'hôte reconnecté finissait spectateur), « Prêt » conservés après un changement de jeu (le
  nouveau jeu partait non réglé), forcestart pendant une transition de tournoi, garde de 2 s étendue au joueur seul
  (vraie fin de manche seulement, pas un abandon), spectateurs assis juste AVANT le départ (en fin de manche ils
  héritaient de la ligne d'un partant), complet sur changement de `gs` borné à 1 / 2 s (pause en rafale ×5 le
  débit), types vérifiés (name/chat/png/dir/opt), ⇄ de Tron appliqué à la saisie, écho retiré sur une correction ;
  classement : effacements avant lecture conservés, écriture ratée retentée, `flush()` au SIGTERM, avatars.json à
  côté du fichier quel que soit son nom, fusion transactionnelle, BOM toléré.
- **Compléments (25/09)** : un siège de bot est pris par un humain hors partie (`!p.bot || editable()`, les 6 jeux —
  `startGame` redistribue les bots) ; plafond **par provenance** de 16 (`conn.adresse` : `CF-Connecting-IP`, sinon
  1re entrée de `X-Forwarded-For`, sinon l'adresse de la socket — une valeur falsifiée ne peut que contourner le
  plafond, jamais bloquer quelqu'un d'autre) ; Espace en répétition automatique ne relance plus la manche (5 clients,
  le Sumo le faisait déjà). `npm test` : **85 vérifications** (bloc « compléments » : rafale de pings, siège de bot
  libéré, `flush()`).
- **Contre-vérification (25/09, 1 agent sceptique avec sondes)** : 3 défauts corrigés — un arrivant prenait le siège
  d'un bot même avec un siège vide libre, et héritait de sa ligne d'écran de fin (vainqueur compris) et de ses points
  de match → siège vide d'abord, siège de bot remis à neuf (`repriseSiegeBot`) ; les en-têtes d'adresse n'étaient pas
  réservés au proxy (en LAN, on pouvait bloquer l'adresse d'un autre) → crus seulement si `RENDER` ; `flush()` ne
  retentait pas une écriture ratée au SIGTERM → 3 tentatives espacées d'1 s.

## Limites connues (assumées)
- ~~Prédiction locale de sa raquette~~ **FAIT (23/09)** — voir « Prédiction locale (Pong) ».
- Hébergement Render en **Europe (Frankfurt)** — confirmé par l'utilisateur, donc ~15-25 ms de ping : le ping
  résiduel vient du code et du réseau local, pas de la région.
- ~~Dérive de la boucle serveur~~ **FAIT — pas de temps fixe** (voir section dédiée) : ce n'était pas cosmétique,
  les jeux tournaient **10 à 15 % au ralenti**, et d'autant plus qu'il y avait de monde.
- Identité par **pseudo** sans comptes (mêmes pseudos = stats fusionnées). Reconnexion best-effort.
- ~~Spectateurs restent spectateurs même si un siège se libère~~ **FAIT (24/09)** : assis automatiquement en fin de
  manche (le bouton 🪑 reste).
- ~~Pas de TLS/auth/rate-limit (LAN de confiance)~~ : le site est **public** depuis Render (TLS fourni par
  Render). Taille et débit des messages sont désormais plafonnés (voir « Protections du serveur »).
  Toujours pas de comptes : identité par pseudo.
- Téléphone en **paysage** (> 600 px de large) : ni joystick ni croix, seul le clavier est prévu.
- ~~Pas de grisage des réglages game master~~ **FAIT** : `body.not-gm` (posé dans `app.js` à chaque message `room`)
  + classe `gm` sur les 26 boutons concernés d'`index.html`. Purement CSS, on ne touche pas à `disabled` que chaque
  jeu pilote lui-même. « Démarrer » reste actif : lancer est un droit de **joueur**, pas de game master.
- ~~Optimisation différée~~ **FAIT — delta réseau** : `grid` (Tank/Bomb) et `geo` (Pong) ne sont émis **que s'ils changent** (+ refresh 2×/s : arrivants/auto-réparation ; toujours émis hors play). Champ `undefined` → omis du JSON → le client **réutilise le précédent** (fusion en tête de `onState` ; `geo:null` = vraiment vide). Gain ≈ 40 Ko/s/client (Pong) + 7 (Tank) + 5 (Bomb). Les chemins Tron/Snake changent chaque tick (pas de delta possible).
- ~~`identities` non purgé~~ **FAIT** : plafonné à 400, les plus anciens sautent (Map = ordre d'insertion), en
  épargnant les jetons connectés ou en attente de reprise. Sans effet visible : le client renvoie son pseudo.
- Multi-onglets de test : le jeton est propre à l'onglet (sessionStorage, 24/09) ; le **pseudo** reste partagé
  (localStorage) — mettre un pseudo distinct par onglet.
- **Ce que `npm test` ne couvre pas** : le ressenti de jeu à plusieurs humains, le mobile (surtout le vieil iPhone),
  la lisibilité des motifs à 8-10, et les fins de manche longues (mort subite de Bomberman jusqu'au bout).
  Ces choses-là n'ont jamais été trouvées par l'automatisation — toujours par les testeurs.

## Pistes non faites (idées futures)
Mobs IA solo Bomberman ; salles multiples (codes de room) ; replay de fin de manche ; avatars dessinés sur les pièces en jeu ;
arène évolutive (jour → crépuscule) ; éclairage dynamique ; envoi incrémental de la géométrie (optim réseau) ;
purge de `identities` dans le hub ; nouveaux jeux via le contrat (le plus simple à brancher).
