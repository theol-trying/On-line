# Déployer la plateforme en ligne (Render — gratuit)

> ⚠️ **Dossier unique** : ce dépôt est désormais la **seule source de vérité** (fusion des anciens `pong-lan` + `pong-line`).
> Il contient tous les jeux (Pong, Tron, Tanks, Bomberman, **Snake**), les skins, et l'adaptation en ligne (Upstash + `wss://`).
> Ne garde qu'**un seul dossier** pour éviter les divergences.

## Adaptation « en ligne » déjà intégrée
| Fichier | Changement | Pourquoi |
|---------|-----------|----------|
| `public/app.js` | `ws://` → `wss://` automatique selon le protocole | Render sert en HTTPS ; un client HTTPS ne peut pas ouvrir une socket `ws://` (bloqué par le navigateur) |
| `package.json` | `"engines": { "node": ">=18" }` | force Node récent sur Render (`fetch` natif requis) |
| `leaderboard.js` | stockage Upstash Redis en option (sinon fichier local) | classement qui **survit** aux redémarrages sur Render gratuit |
| `render.yaml` | présent | déploiement automatique ("Blueprint") |

Le serveur (`server.js`) utilise **déjà** `process.env.PORT` → aucun changement nécessaire. 👍

> 💡 **Repli automatique** : sans variables Upstash, `leaderboard.js` retombe sur le fichier local `leaderboard.json` exactement comme avant. Donc le projet tourne toujours en LAN sans rien configurer.

## Méthode 1 — Render via GitHub (recommandée)

1. **Mets le dossier sur GitHub**
   ```bash
   git init
   git add .
   git commit -m "Plateforme multijeux en ligne"
   # crée un repo vide sur github.com puis :
   git remote add origin https://github.com/<ton-pseudo>/pong-line.git
   git push -u origin main
   ```

2. **Sur [render.com](https://render.com)** (compte gratuit) :
   - *New* → *Web Service* → connecte ton repo GitHub
   - Render lit `render.yaml` et remplit tout seul. Sinon, en manuel :
     - Runtime : **Node**
     - Build Command : `npm install`
     - Start Command : `npm start`
     - Plan : **Free**
   - *Create Web Service*

3. Au bout de ~1 min tu obtiens une URL publique :
   `https://pong-line-xxxx.onrender.com` → partage-la, tout le monde peut jouer. 🎮

## Méthode 2 — autres hébergeurs
Le code marche aussi sur **Railway**, **Fly.io**, **Glitch** : même principe (Node + `npm start` + WebSocket supporté).

## Classement persistant — Upstash Redis (gratuit)

### A. Créer la base (5 min, gratuit)
1. [upstash.com](https://upstash.com) → crée un compte.
2. *Create Database* → région **proche de ton service Render** → plan **Free**.
3. Onglet **REST API**, copie :
   - `UPSTASH_REDIS_REST_URL`  (ex. `https://eu1-xxxx.upstash.io`)
   - `UPSTASH_REDIS_REST_TOKEN`  (longue chaîne secrète)

### B. Donner ces valeurs à Render
Service Render → onglet **Environment** → *Add Environment Variable* :

| Key | Value |
|-----|-------|
| `UPSTASH_REDIS_REST_URL` | (l'URL copiée) |
| `UPSTASH_REDIS_REST_TOKEN` | (le token copié) |

Au démarrage, les logs doivent afficher : `[leaderboard] Stockage : Upstash Redis (en ligne).`
✅ Le classement est permanent. Les secrets restent dans Render, **jamais dans le code**.

## ⚠️ Limites du plan gratuit Render
1. **Mise en veille** après ~15 min sans visiteur : le 1ᵉʳ joueur attend ~30 s le réveil. (Normal en gratuit.)
2. **État en mémoire** (partie en cours, jetons de reconnexion, sièges) : réinitialisé à chaque redéploiement/réveil. Seul le **classement** (Upstash) est persistant.
3. **Une seule instance** recommandée (état mono-process).
4. **Local toujours possible** : `npm start` → `http://localhost:3000` (détection `ws`/`wss` automatique).
