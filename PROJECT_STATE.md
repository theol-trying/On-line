# Plateforme de jeux LAN — état du projet (point de reprise)

> Dossier : `C:\Users\theoi\Documents\PONG\pong-lan\`. **Plateforme multijeux** : un hub Node.js **autoritatif**
> sert plusieurs jeux sélectionnables ; **une seule partie active à la fois** (jeu choisi dans un lobby commun).
> **Jeux : Pong · Tron · Tanks · Bomberman.** **Zéro dépendance** (WebSocket implémenté à la main). Un appareil par joueur.
> Consigne projet permanente : **l'assistant n'exécute rien** (pas de Node/npm/shell) → validation runtime côté utilisateur.

## Lancer
```
cd C:\Users\theoi\Documents\PONG\pong-lan
node server.js
```
Ouvre l'URL **LAN** affichée (`http://<IP>:3000`) sur chaque appareil (même Wi-Fi ; autoriser Node sur réseau privé au 1er lancement).
Client en **modules ES** → passe **obligatoirement** par le serveur (pas en `file://`). Après modif : **Ctrl+F5**.
Test solo (1 PC + 1 tél) : ouvrir **plusieurs onglets PC** = plusieurs joueurs (mettre un **pseudo différent** par onglet).
Pages annexes : `/stats?game=<id>` (HTML lecture seule), `/leaderboard.json?game=<id>` (`<id>` = pong|tron|tank|bomb).

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
- **Bots IA** (bouton 🤖) : `botCount` 0..maxBots ; `botThink` (vise l'ennemi le plus proche, avance, tire aligné, se dégage des murs, pose des mines). Démarrage possible dès **1 humain + 2 participants** (humains+bots). Sièges de bots protégés contre la reprise par un humain.
- **Mines** : pose **E/Maj** (bouton ◈), s'arment (`MINE_ARM`), explosent au passage d'un ennemi (`MINE_R=30`). Couleur = poseur.
- Obus à **rebonds** (`MAX_BOUNCE=3`), `MAX_SHELLS=2` (triple = salve). 3 vies + respawn + invuln (`INVULN=45`).
- **Collision tank-tank** + légère poussée. Équipes (⚔) + **mode manches** 🏁 (`WIN_TARGETS=[1,3,5]`, « REMPORTE LE MATCH »).
- Commandes : ←→ / AD tourner, ↑↓ / WS avancer/reculer, **Espace** tirer, **E/Maj** mine, **P** pause ; tactile ↺▲▼↻🔥◈.
- Messages C→S : input{left,right,fwd,back,fire}, mine, start, pause, mode, bots, arena, wintarget, ff, lbreset.

## Jeu : BOMBERMAN  (`bomb`, 1–6, tickHz 30)
- Grille 13×13 (CELL 40), cadre solide. **Maps PROCÉDURALES** (bouton 🧱, mêmes styles/connectivité, densité 0.18, murs 0.72).
- **Bonus** : 💣 +bombe, 🔥 +portée, 👟 +vitesse, 🦵 poussée, 📡 détonateur, 👻 traverse-murs, 🧤 gant (lancer), 🛡 bouclier, **📏 bombe en ligne** (pose une rangée devant soi via `placeBombAt`).
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
- **Variantes** (bouton 🐍) : `Classique` / `Murs traversants` (wrap des bords) / `Obstacles` (rochers `ROCK_COUNT=16` loin des têtes).
- **Mode de partie** (bouton 🏁, orthogonal aux variantes, OFF par défaut) : `Survie` (classique, dernier en vie) **ou** `Food-rush` (`RUSH_FOOD=12` pastilles en permanence ; **premier à `RUSH_TARGET=20` points gagne immédiatement** via `endRound(team)` ; si fin par élimination, gagnant = meilleur score via `bestScoreTeam()`). Snapshot : `rush`, `rushTarget`. Client : bouton, indicateur `🏁 lead/20` en jeu, mention au lobby, classement final au score.
- **Mort** : tête qui sort de la grille **ou** entre dans un corps de serpent (le sien ou un autre) ; choc frontal (même case) = les deux meurent.
  Crédit kill au propriétaire de la cellule touchée. Un serpent mort **disparaît** (n'est plus un obstacle).
- Résolution **simultanée** (têtes calculées d'un coup) ; la **queue se libère** dans le tick (on peut suivre une queue) sauf si croissance.
- **Solo** (1 joueur) = entraînement/score (hors classement). Dernier en vie gagne en multi.
- Commandes : ↑↓←→ / WASD (pas de demi-tour), **Espace** lancer, **P/Échap** pause ; tactile : dpad. Pas de bonus/boost (pur classique).
- Snapshot : `food[{x,y,t}]`, `rocks[]`, `variant`, `players[{head,path(corners),len,score,ghost,…}]`. Messages C→S : dir{d}, start, pause, abort, mode, variant, lbreset.
- Leaderboard : games, wins, kills, K/D, **meilleur score** 🍎, meilleure survie.

---

## Communs aux jeux
- **Équipes** FFA/2v2/2v2v2/3v3 (2v2 à 4 joueurs ; 2v2v2 & 3v3 à 6). Couleur d'équipe (palette Okabe-Ito en daltonien).
- **Tir allié** (Tank & Bomberman, bouton 🤝, actif seulement en équipes, **OFF par défaut**) : ON = les obus/mines/explosions
  touchent les coéquipiers. La **bombe/obus propre** blesse toujours son auteur ; en ON un kill d'allié est crédité.
- **Leaderboard par jeu** (`leaderboard.json` = `{gameId:{board,history}}`) : par pseudo ; victoires, kills, K/D, survie max, etc.
  Diffusé sur `dirty`. Pages `/stats?game=<id>` & `/leaderboard.json?game=<id>`.
- **Reconnexion** par token : **période de grâce de 12 s** côté hub (le siège et l'état du jeu sont conservés à la coupure ;
  un F5 réutilise le même membre). Au-delà, élimination via `onLeave`. Chaque jeu garde aussi `seatByMid` (reprise après grâce).
- **Quitter en cours** : bouton flottant ✕ → `abort` → `backToLobby()` (retour lobby sans perdre les sièges).
- **Lot transverse (social/UX)** : **émotes** (bouton flottant 😀 → broadcast `{t:'emote',e}` via hub, anti-spam 700 ms, toasts chez tous) ; **classement global cross-jeux** (bouton 🏅 : le shell agrège les `lb` de tous les jeux par pseudo → wins/kills/parties cumulés) ; **ping** (client `{t:'png',ts}` toutes les 3 s, hub echo, RTT affiché). Différé restant : profils/avatars (intégration HUD par jeu).
- **Système « Prêt » (gate de démarrage, transverse aux 6 jeux — FAIT)** : entièrement dans **hub + shell**, **zéro modif des 6 clients de jeu**. Hub : `member.ready` ; `roomMsg` envoie `host` (= 1er joueur connecté) + `ready` par joueur ; `allReady()` = tous les **membres role=player** prêts (les **bots ne sont pas des membres** → exclus → jamais bloquants) ; le hub **gate** `{t:'g',m:{t:'start'}}` quand `game.isIdle() && !allReady()` (renvoie `{t:'notready'}`) ; `{t:'ready',v}` togglé ; `{t:'forcestart'}` réservé à l'hôte (bypass) ; **réarmement** auto des « Prêt » à chaque manche lancée (transition idle→actif détectée dans `step()` via `wasIdle`). Shell (`app.js`) : barre `#readyBar` (lobby/over seulement) listant ✅/⚪ par joueur + 👑 hôte, bouton **« Prêt »** (joueurs), bouton **« ⏩ Forcer le départ »** (hôte), toast `notready`. Le bouton Démarrer de chaque jeu reste inchangé mais est gaté côté hub.
- **Modes alternatifs (ex-différés « condition de victoire », FAIT)** : **Snake food-rush** (bouton 🏁 — premier à 20 🍎) et **Bomberman revanche** (bouton ☠ — les morts bombardent depuis le bord et peuvent revenir). Tous deux **OFF par défaut**, sans impact sur le jeu de base. *(Différés Tron — mine + hasards d'arène — abandonnés à la demande.)*
- **Identité visuelle propre par jeu** (FIXE, constante `SKIN` dans chaque client, pas de sélecteur) :
  Tanks → **Désert** (sable, acier riveté, caisses bois) ; Snake → **Jardin** (herbe en damier, pommes) ; Bomberman → **Cartoon** (herbe pastel, murs arrondis) ; Pong & Tron → **Néon**.
  Le sélecteur de thème global (Néon/CRT/Clair) ne pilote plus que le **shell** + Pong/Tron. `reduceFx` (réduire les effets) et la palette daltonien restent appliqués dans tous les jeux.
- **Accessibilité** (⚙️ shell, persisté localStorage `pong-lan-a11y`) : thèmes Néon/CRT/Clair, musique (Pong), palette daltonien,
  contraste, réduction des effets. Pseudo persistant `pong-lan-name`, token `pong-lan-token`.
- **Plateau adaptatif** : taille calculée par écran ; s'agrandit en jeu (chrome masqué) ; ⏸ flottant en jeu, ⚙️ flottant en pause.
- **Juice** : interpolation client (lerp), particules, shake, décompte 3·2·1, écran de fin + classement.
- **Pack « quick-wins » (polish)** : 🎉 **confettis** de victoire (overlay global, déclenché par `state.gs==='over' && winner>=0`) · **fondu de transition** entre jeux (`#xfade`) · **volume SFX** (slider `a11y.sfx`, branché dans chaque `tone()`) + **plein écran** + **vibration tactile** mobile (réglages shell). Par jeu : Pong = flash d'impact ; Tron = bloom renforcé + cœur de traînée ; Tanks = jauge de munitions ; Bomberman = étincelle de mèche animée + cases « danger » clignotantes ; Snake = yeux + tête arrondie. Tout respecte `reduceFx`.
- **Pack « quick-wins » lot 2** : Pong → **lueur des bords** quand une balle frôle + **particules** au ramassage de power-up + **icônes d'effets actifs** (pulsantes) sur les cartes + **IA « insane »** ; Tron → **pulsation de grille** + **speed lines** (boost/vitesse, flag serveur `boosting`) + **traînée d'équipe traversable** (coéquipiers) ; Tanks → **flash de bouche** + **poussière** au déplacement + **fumée** (tank à 1 vie) ; Snake → **éclaboussure** de pomme à la bouffe ; shell → **nombre de spectateurs** dans le bandeau. 🟡 différés (besoin de données serveur) : barres dégressives d'effets (Pong), flèche de service (Pong), trail d'obus (Tanks), dégradé de queue (Snake), indicateur de ping.
- **Lot « finir le polish » (🟡 petits ajouts serveur — FAIT)** : Pong → **barres d'effets dégressives** sur les cartes (serveur envoie `players[].buffs=[[clé,fraction]]`) + **flèche de sens de service** (serveur envoie `balls[].vx/vy`, flèche dessinée au décompte) ; Tanks → **timers d'effets dégressifs** (mêmes `buffs`) + **traînée d'obus** (serveur envoie `shells[].vx/vy`). Pastille `.buff` = fond en dégradé qui se vide. Restent 🟡 : dégradé de queue Snake (traînées compressées en sommets), indicateur de ping (protocole).
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

## Limites connues (assumées)
- Identité par **pseudo** sans comptes (mêmes pseudos = stats fusionnées). Reconnexion best-effort.
- Spectateurs restent spectateurs même si un siège se libère (recharger pour jouer).
- Pas de TLS/auth/rate-limit (LAN de confiance). Un membre (même spectateur) peut `pick`/`start`/`pause`.
- Optimisation différée (volontaire) : la **géométrie statique** (geo Pong, grid Tank/Bomb, path Tron) est ré-émise chaque tick
  (cache+envoi-au-changement = risque de désync pour gain négligeable en LAN). À activer si réseau faible / beaucoup de clients.
- `identities` (hub) non purgé → légère croissance mémoire sur très longue durée.
- Multi-onglets de test : localStorage partagé → même token/pseudo par défaut (mettre un pseudo distinct par onglet).
- **Rien exécuté par l'assistant** (consigne) : tests runtime à faire côté utilisateur (voir checklist fournie en conversation).

## Pistes non faites (idées futures)
Mobs IA solo Bomberman ; salles multiples (codes de room) ; tournois/replays ; envoi incrémental de la géométrie (optim réseau) ;
restreindre pick/start/pause aux joueurs ; nouveaux jeux via le contrat (le plus simple à brancher).
