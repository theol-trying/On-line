# On-line — plateforme multijeux

> Conventions communes aux deux sites de jeux (zéro dépendance, identité git, déploiement
> GitHub → Render, pièges Upstash) : **charger le skill `jeux-web`** avant de committer,
> pousser ou déployer. Ce fichier ne contient que ce qui est propre à ce repo.

État détaillé du projet, protocole réseau et fiche par jeu : **`PROJECT_STATE.md`** — le
tenir à jour quand l'architecture ou les règles d'un jeu changent.

## Spécifique à ce repo

- **Modules ES** (`"type": "module"`). Le client passe obligatoirement par le serveur
  (imports ESM → pas de `file://`). Après modification : Ctrl+F5.
- **Vieux iOS** — pièges vérifiés en vrai, tous rencontrés sur ce repo : pas de `clamp()`/`min()`
  ni de `gap` en flex ; `user-select` doit être écrit **aussi** en `-webkit-user-select` ;
  `-webkit-touch-callout:none` est **indispensable** sur tout ce qui se touche, sinon l'appui long
  ouvre la loupe, sélectionne le glyphe et **fige les commandes** ; Pointer Events n'existe que
  depuis iOS 13 (un shim tactile dans `app.js` prend le relais en dessous). Côté JS : pas
  d'optional chaining ni de `??`.
- Repo GitHub : `theol-trying/On-line` · prod : https://on-line.onrender.com
  (le `name: pong-line` du `render.yaml` est un reste, ce n'est pas le service live).
- `buildCommand: node --version` — no-op volontaire, **surtout pas** `npm install`.
- **Déploiement** (depuis le 28/10/2026, comme Soirée) : un push sur `main` lance `.github/workflows/deploy.yml`,
  qui fait `npm test` puis appelle le Deploy Hook de Render (secret GitHub `RENDER_DEPLOY_HOOK`). Un push dont les
  tests échouent n'est **pas** déployé. L'auto-déploiement natif de Render ne se déclenchait plus depuis la
  recréation du dépôt (26/10) : il doit rester coupé (sinon double déploiement, sans attendre les tests).
- Hub **autoritatif**, une seule salle et une seule partie active à la fois, état **en
  mémoire** → une seule instance Render.
- **Ajouter un jeu** = `games/<id>/server.js` + `public/games/<id>/{client.js,shared.js}`,
  puis l'enregistrer dans l'objet `GAMES` de `hub.js` — c'est le minimum pour qu'il tourne.
  Pour une identité complète comme les 9 jeux actuels (le Sumo sert de modèle ; le Foot, ajouté le 25/09, la Patate chaude, le 30/09, et Micro Machines, le 22/10, l'ont suivi) :
  racine `#<id>-root` dans `index.html` (canvas dans un `.stage`), `body.game-<id>` + onglet + fond
  plein écran dans `style.css`, `setGameSkin`/`GAME_SUB`/`GAME_TITLE`/`CELEB` dans `app.js`, `CARTES`
  dans `joystick.js`, un `jouer('<id>', …)` dans `test/smoke.mjs`, une fiche dans `PROJECT_STATE.md`.
- **Taille du plateau** : jamais de formule maison dans un jeu → `arenaSize()` de `public/layout.js`.
  En partie sur grand écran (`body.playing.dock`, posé par `layoutArena()` dans `app.js`) elle **mesure**
  la colonne centrale `.stage` ; sinon elle applique la formule en fractions de fenêtre. Un jeu avec des
  commandes **latérales** (les flèches ▲▼ de Pong) doit être déclaré dans `SIDE_JEU` d'`app.js`, sinon
  les colonnes lui volent cette largeur.
- **Manette tactile** : le joystick (`public/joystick.js`) actionne les boutons `.touch` des jeux par leur
  `id`. Un nouveau jeu doit garder ces boutons (même masqués) et s'inscrire dans `CARTES` — ou exposer
  `joy(dx, dy)` dans son module s'il lui faut une projection propre, comme Pong.
- **Ne pas supprimer `/manette.html`** : page d'essai permanente, demandée par l'utilisateur.
- **Pas d'avatar dessiné sur les pièces de jeu** (refusé par l'utilisateur le 23/09 : il gâche les visages
  travaillés, surtout à Bomberman). L'avatar reste sur les cartes joueurs (HUD) et les classements.
- **Briques graphiques partagées** (à réutiliser, pas à réinventer dans un jeu) : `lumiere.js` (lueurs additives sur le sol), `crepuscule.js`
  (étalonnage jour → crépuscule en mort subite), `finpartie.js` (journal de manche → courbe + meilleure
  action, textes échappés), `vitrine.js` (accueil en cartes animées), `echo-virage.js` (chevron immédiat du
  virage enregistré, jeux à pas discret), `exploits.js` (« DOUBLÉ ! », arrêt sur image, éclat, vignette de danger,
  pastille numérotée, `readable`/`hudK` pour des textes lisibles sur téléphone), `ralenti.js` (ralenti du moment décisif),
  `podium.js` (podium canvas de fin), `camera-duel.js` (zoom doux sur le duel final), `ecran-fin.js` (fin de manche en
  plein écran + boutons Relancer / Accueil : un jeu NE calcule PAS lui-même son `inGame`), `match.js` (UI du match en N
  manches). Côté serveur, le match passe par `creerMatch()` de `games/match.js`. Côté serveur, les places de fin de
  manche passent TOUJOURS par `classerManche()` de `games/fin-manche.js` (vérifié par `test/fins-de-manche.mjs`). Un nouveau jeu doit aussi avoir sa mini-scène dans `vitrine.js`.
- **Clés venant du réseau** (pseudo, id de jeu, direction…) : jamais `obj[cle]` nu sur un objet ordinaire —
  `Object.hasOwn` côté serveur (`Object.prototype.hasOwnProperty.call` côté client) ou `Object.create(null)`.
  Un simple `{t:'pick', id:'constructor'}` tuait le serveur (corrigé le 24/09). Tout appel au code d'un jeu hors
  tick/onMessage passe par `garde()` de `hub.js`.
- Le snapshot renvoyé par `tick()` **doit** contenir `gs` (utilisé par le throttle du hub). Il ne doit **jamais** avoir de clé
  `t`, `g`, `fx`, `shz` ou `pd` à lui : le hub les pose sur le message (un chrono nommé `t` écrasait `t: 'state'` — Micro Machines,
  22/10 ; seul le test de fumée le voit, `fins-de-manche.mjs` appelle `tick()` en direct).
- Un **fx poussé depuis `onMessage`** est perdu si le `tick()` du jeu repart d'un tableau neuf : passer par la file
  `pend` du jeu ou poser un drapeau consommé dans le tick (objet d'un humain à Micro Machines, corrigé le 23/10 : seuls
  les bots, qui agissent dans le tick, produisaient l'effet visuel).
- **Musique = fichiers** (`public/music/`, seule exception à « aucun binaire ») : un nouveau morceau passe TOUJOURS par
  `node outils/importer-musique.mjs <dossier>` (retire ID3/APE/C2PA, nomme par empreinte), puis nom + `debut`/`fin` dans
  `public/pistes.js` (`outils/points-de-boucle.js` dans la console). Jamais de mp3 déposé à la main : le cache est
  `immutable`, un contenu changé sous le même nom ne serait jamais re-téléchargé. Un jeu branche ses morceaux par
  `MUSIC_THEME.piste = '<id>'` et appelle `music.setIntensity(inten, m.gs)` (la phase menu/partie vient de `gs`).
  `stop()` / `dispose()` ne coupent pas le morceau : le jeu suivant enchaîne dessus (`public/piste.js`, contexte unique).
- **Joystick analogique** : un jeu qui veut le vecteur du stick (et non des boutons) exporte `joyAna(dx, dy, fin)` dans son
  module ; `app.js` le passe à `joystickPour(id, mod.joy, mod.joyAna)` (Micro Machines : cap absolu).

## Lancer et tester

```
npm test                      # smoke.mjs (9 jeux, vrais clients WebSocket) puis fins-de-manche.mjs — AVANT CHAQUE PUSH
node server.js                # :3000, ou preview_start via .claude/launch.json
HUB_TRACE=1 node server.js    # journalise chaque diffusion
```

`npm test` (`test/smoke.mjs`, zéro dépendance) démarre le serveur sur le port 3999, joue une
manche dans chaque jeu et vérifie : pas de plantage, l'état « play » atteint, la reconstitution
du protocole delta, les tailles d'arène, le ratio de raquette de Pong, l'arrivée d'un joueur
en cours de partie, les protections et un bloc « robustesse » (messages qui tuaient le serveur, reprise
de connexion, amplificateurs, « Rejouer = Prêt », file de virages). Son serveur écrit dans un dossier
temporaire et ne reçoit jamais `UPSTASH_*`. Sort en code 1 au moindre échec. Il affiche aussi la **cadence réelle** de
chaque jeu — un écart au `tickHz` signale une régression de la boucle serveur.

`node --check` ne détecte **pas** les `ReferenceError` à l'exécution : c'est exactement ce qui a
mis le site à terre le 21/09 (`CELL is not defined` dans Bomberman). D'où le test de fumée.

⚠️ **Piège de test récurrent** : un onglet navigateur laissé ouvert sur `localhost:3000` reste
connecté **et se reconnecte tout seul**. S'il s'est connecté en premier, c'est *lui* le game
master : un script de test se prend alors des `denied` sur `pick`/`bots` et des `notready` sur
`start`, et la partie ne démarre jamais. **Fermer l'onglet avant de lancer une sonde.**
Idem côté processus : sous Git Bash `pkill` ne tue pas node, utiliser
`Get-Process node | Stop-Process -Force` en PowerShell.
