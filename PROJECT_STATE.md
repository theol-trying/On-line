# Plateforme multijeux en ligne — état du projet (point de reprise)

> Dossier : `C:\Users\theoi\Documents\PONG\pong-line\` (source unique de vérité).
> **Plateforme multijeux** : un hub Node.js **autoritatif** sert plusieurs jeux sélectionnables ;
> **une seule partie active à la fois** (jeu choisi dans un lobby commun).
> **Jeux : Pong · Tron · Tanks · Bomberman · Snake.** **Zéro dépendance** (WebSocket implémenté à la main). Un appareil par joueur.
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

---

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

**Pong reste confortable à 10** malgré des arêtes plus courtes : la longueur d'une arête vaut 2·R·sin(π/N)
alors que la raquette suit k, donc chacun couvre **~59 %** de son bord à 10 joueurs contre **~36 %** à 6.
Ce n'est pas la défense qui devient dure, c'est le trafic au centre.

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
- `fx` est **toujours** envoyé (`ALWAYS`) : c'est du ponctuel, le fusionner rejouerait les impacts en boucle.
- Instantané **complet** forcé toutes les 2 s, à chaque arrivée et à chaque changement de jeu → un client ne peut
  pas rester désynchronisé.
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

## Limites connues (assumées)
- **Reste à gagner sur le réseau, non fait** (par ordre de rendement) :
  1. **permessage-deflate** — mesuré à **−77 %** sur l'instantané Pong (2 957 → 666 o). Transparent pour le code de
     jeu. En négociant `server_no_context_takeover`, on compresse **une fois par tick** et on diffuse la même trame.
     Non fait : ça touche le WebSocket écrit à la main, une erreur d'un octet casse tout le site, et rien n'est
     testable en réel depuis ce poste. À livrer avec un coupe-circuit par variable d'environnement.
  2. **Alléger le tableau `players`** — il pèse **79 %** du paquet et réexpédie 60 fois par seconde des choses
     statiques (pseudo, siège, équipe, `bot`, `connected`). N'envoyer ces champs qu'au changement.
  3. **Prédiction locale** de sa propre raquette : le seul levier qui retire vraiment l'aller-retour réseau du
     ressenti de contrôle.
- Hébergement Render en **Europe (Frankfurt)** — confirmé par l'utilisateur, donc ~15-25 ms de ping : le ping
  résiduel vient du code et du réseau local, pas de la région.
- La boucle serveur utilise `setInterval(step, 1000/hz)` : à 60 Hz, 16,67 ms n'est pas entier → le jeu tourne en
  réalité à ~62 Hz avec une légère dérive. Cosmétique (les durées en ticks sont 4 % courtes), pas un problème de
  fluidité. Un pas fixe à accumulateur serait plus juste.
- Identité par **pseudo** sans comptes (mêmes pseudos = stats fusionnées). Reconnexion best-effort.
- Spectateurs restent spectateurs même si un siège se libère (bouton 🪑 « Prendre un siège » hors partie).
- Pas de TLS/auth/rate-limit (LAN de confiance).
- Les boutons de réglages restent **visibles** pour les non-game-masters (refus + toast au clic, pas de grisage visuel).
- ~~Optimisation différée~~ **FAIT — delta réseau** : `grid` (Tank/Bomb) et `geo` (Pong) ne sont émis **que s'ils changent** (+ refresh 2×/s : arrivants/auto-réparation ; toujours émis hors play). Champ `undefined` → omis du JSON → le client **réutilise le précédent** (fusion en tête de `onState` ; `geo:null` = vraiment vide). Gain ≈ 40 Ko/s/client (Pong) + 7 (Tank) + 5 (Bomb). Les chemins Tron/Snake changent chaque tick (pas de delta possible).
- `identities` (hub) non purgé → légère croissance mémoire sur très longue durée.
- Multi-onglets de test : localStorage partagé → même token/pseudo par défaut (mettre un pseudo distinct par onglet).
- **Rien exécuté par l'assistant** (consigne) : tests runtime à faire côté utilisateur (voir checklist fournie en conversation).

## Pistes non faites (idées futures)
Mobs IA solo Bomberman ; salles multiples (codes de room) ; replay de fin de manche ; avatars dessinés sur les pièces en jeu ;
arène évolutive (jour → crépuscule) ; éclairage dynamique ; envoi incrémental de la géométrie (optim réseau) ;
purge de `identities` dans le hub ; nouveaux jeux via le contrat (le plus simple à brancher).
