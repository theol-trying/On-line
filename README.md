# 🎮 Plateforme multijeux en ligne

**5 jeux multijoueur temps réel** dans un hub commun : 🏓 Pong · 🟦 Tron · 🟫 Tanks · 🎈 Bomberman · 🟩 Snake.
Serveur Node.js **autoritatif**, **zéro dépendance npm**, **aucun fichier binaire** (graphismes dessinés au canvas, musique générée en WebAudio).

Une seule partie active à la fois : les joueurs choisissent le jeu dans un lobby commun, un appareil = un joueur.

## Lancer en local

```bash
node server.js
```

Puis ouvrir l'URL affichée. Sur le même Wi-Fi, l'URL **LAN** (`http://<IP>:3000`) permet de jouer à plusieurs appareils.
Le client utilise les **modules ES** : il faut passer par le serveur (pas d'ouverture en `file://`). Après modification : **Ctrl+F5**.

## Architecture

```
server.js            HTTP statique (public/) + pages /stats et /leaderboard.json
ws.js                Mini-serveur WebSocket RFC 6455 écrit à la main (handshake SHA-1, frames, ping/pong)
hub.js               Registre des jeux, identité/pseudo/token, reconnexion (grâce 12 s), une salle active,
                     gate « Prêt », mode tournoi, game master, émotes, avatars, mini-chat, défi du jour, ping
leaderboard.js       Persistance : Upstash Redis (REST + fetch natif) en ligne, fichier JSON en local
                     (classements par jeu + classement du jour remis à zéro chaque jour)
dayseed.js           Graine dérivée de la date (UTC) : même carte pour tout le monde pendant 24 h (« défi du jour »)
public/patterns.js   Motifs par siège (rayures, pois, chevrons…) — accessibilité daltonien et lisibilité à 6 joueurs
games/<id>/server.js       Logique autoritative d'un jeu
public/games/<id>/client.js  Rendu canvas, HUD, sons, contrôles
public/games/<id>/shared.js  Constantes partagées serveur ↔ client
public/app.js        Shell client : réseau, lobby, réglages, avatars, tournoi, chargement du jeu actif
public/music.js      Moteur de musique générative partagé (WebAudio, zéro asset)
```

**Ajouter un jeu** : créer `games/<id>/server.js` + `public/games/<id>/{client.js,shared.js}`, puis l'importer dans l'objet `GAMES` de `hub.js`. Rien d'autre.

Le détail complet du projet (règles de chaque jeu, historique, décisions techniques) vit dans **`PROJECT_STATE.md`**.

## Déploiement

Hébergé sur **Render** (Node, `npm start`), classement et avatars persistés dans **Upstash Redis**.
Procédure complète : voir **`DEPLOY.md`**.

### Variables d'environnement

| Variable | Rôle |
|---|---|
| `PORT` | Fourni automatiquement par Render |
| `UPSTASH_REDIS_REST_URL` | Persistance du classement et des avatars (sinon : fichiers locaux) |
| `UPSTASH_REDIS_REST_TOKEN` | idem |
| `ADMIN_KEY` | Clé secrète du **game master** (réglages, forçage du départ, reset des classements). S'active côté client en ouvrant une fois `?admin=<clé>` |
| `LEADERBOARD_KEY` | *(optionnel)* nom de la clé Redis du classement |
| `AVATAR_KEY` | *(optionnel)* nom de la clé Redis des avatars |

> Sans variables Upstash, tout fonctionne quand même : le stockage retombe sur des fichiers locaux.

## Accessibilité

Réglages persistés : thèmes, **réduction des effets**, palette **daltonien**, contraste renforcé, volume des effets et de la musique, plein écran. Chaque jeu possède une identité visuelle propre et des contrôles tactiles adaptés au mobile.

En plus de la couleur, **chaque siège porte un motif** (rayures, pois, chevrons, quadrillage, losanges) repris dans la carte HUD : deux joueurs de teinte proche — ou d'une même équipe — restent distinguables au premier coup d'œil. « Réduire les effets » désactive les animations de fond, les halos et les célébrations.
