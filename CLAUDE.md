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
- Hub **autoritatif**, une seule salle et une seule partie active à la fois, état **en
  mémoire** → une seule instance Render.
- **Ajouter un jeu** = `games/<id>/server.js` + `public/games/<id>/{client.js,shared.js}`,
  puis l'enregistrer dans l'objet `GAMES` de `hub.js` — c'est le minimum pour qu'il tourne.
  Pour une identité complète comme les 6 jeux actuels (le Sumo, ajouté le 23/09, sert de modèle) :
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
  virage enregistré, jeux à pas discret). Un nouveau jeu doit aussi avoir sa mini-scène dans `vitrine.js`.
- **Clés venant du réseau** (pseudo, id de jeu, direction…) : jamais `obj[cle]` nu sur un objet ordinaire —
  `Object.hasOwn` côté serveur (`Object.prototype.hasOwnProperty.call` côté client) ou `Object.create(null)`.
  Un simple `{t:'pick', id:'constructor'}` tuait le serveur (corrigé le 24/09). Tout appel au code d'un jeu hors
  tick/onMessage passe par `garde()` de `hub.js`.
- Le snapshot renvoyé par `tick()` **doit** contenir `gs` (utilisé par le throttle du hub).

## Lancer et tester

```
npm test                      # test de fumée : les 6 jeux, de vrais clients WebSocket — À LANCER AVANT CHAQUE PUSH
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
