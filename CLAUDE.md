# On-line — plateforme multijeux

> Conventions communes aux deux sites de jeux (zéro dépendance, identité git, déploiement
> GitHub → Render, pièges Upstash) : **charger le skill `jeux-web`** avant de committer,
> pousser ou déployer. Ce fichier ne contient que ce qui est propre à ce repo.

État détaillé du projet, protocole réseau et fiche par jeu : **`PROJECT_STATE.md`** — le
tenir à jour quand l'architecture ou les règles d'un jeu changent.

## Spécifique à ce repo

- **Modules ES** (`"type": "module"`). Le client passe obligatoirement par le serveur
  (imports ESM → pas de `file://`). Après modification : Ctrl+F5.
- Repo GitHub : `theol-trying/On-line` · prod : https://on-line.onrender.com
  (le `name: pong-line` du `render.yaml` est un reste, ce n'est pas le service live).
- `buildCommand: node --version` — no-op volontaire, **surtout pas** `npm install`.
- Hub **autoritatif**, une seule salle et une seule partie active à la fois, état **en
  mémoire** → une seule instance Render.
- **Ajouter un jeu** = `games/<id>/server.js` + `public/games/<id>/{client.js,shared.js}`,
  puis l'enregistrer dans l'objet `GAMES` de `hub.js`. Rien d'autre.
- Le snapshot renvoyé par `tick()` **doit** contenir `gs` (utilisé par le throttle du hub).

## Lancer et tester

```
node server.js                # :3000, ou preview_start via .claude/launch.json
HUB_TRACE=1 node server.js    # journalise chaque diffusion
```

`node --check` ne détecte pas les `ReferenceError` à l'exécution : pour tout changement de
gameplay, ouvrir de vrais clients WebSocket depuis un script `.mjs` (Node ≥ 22 fournit
`WebSocket` nativement) et jouer une manche.
