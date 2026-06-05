# Déployer Pong en ligne (Render — gratuit)

Ce dossier `pong-line` est une copie de `pong-lan` adaptée pour l'hébergement en ligne.

## Ce qui a été modifié par rapport à `pong-lan`

| Fichier | Changement | Pourquoi |
|---------|-----------|----------|
| `public/app.js` | `ws://` → `wss://` automatique selon le protocole | Render sert en HTTPS ; un client HTTPS ne peut pas ouvrir une socket `ws://` non sécurisée (bloqué par le navigateur) |
| `package.json` | ajout de `"engines": { "node": ">=18" }` | force une version récente de Node sur Render (`fetch` natif requis) |
| `leaderboard.js` | stockage Upstash Redis en option (sinon fichier local) | classement qui **survit** aux redémarrages sur Render gratuit |
| `render.yaml` | nouveau | déploiement automatique ("Blueprint") |

Le serveur (`server.js`) utilisait **déjà** `process.env.PORT` → aucun changement nécessaire. 👍

> 💡 **Repli automatique** : sans variables Upstash, `leaderboard.js` retombe sur le fichier local `leaderboard.json` exactement comme avant. Donc `pong-line` tourne toujours en LAN sans rien configurer.

## Méthode 1 — Render via GitHub (recommandée)

1. **Mets `pong-line` sur GitHub**
   ```bash
   cd C:\Users\theoi\Documents\PONG\pong-line
   git init
   git add .
   git commit -m "Pong en ligne — version Render"
   # crée un repo vide sur github.com puis :
   git remote add origin https://github.com/<ton-pseudo>/pong-line.git
   git push -u origin main
   ```

2. **Sur [render.com](https://render.com)** (compte gratuit) :
   - *New* → *Web Service* → connecte ton repo GitHub `pong-line`
   - Render lit `render.yaml` et remplit tout seul. Sinon, en manuel :
     - Runtime : **Node**
     - Build Command : `npm install`
     - Start Command : `npm start`
     - Plan : **Free**
   - *Create Web Service*

3. Au bout de ~1 min tu obtiens une URL publique :
   `https://pong-line-xxxx.onrender.com`
   → partage-la, tout le monde peut jouer depuis n'importe où. 🎮

## Méthode 2 — autres hébergeurs

Le code marche aussi tel quel sur **Railway**, **Fly.io**, **Glitch** : même principe (Node + `npm start` + WebSocket supporté).

## Classement persistant — Upstash Redis (gratuit)

Pour que le classement **survive** aux redémarrages de Render, on stocke les données chez Upstash (Redis hébergé, palier gratuit) au lieu du disque éphémère.

### A. Créer la base (5 min, gratuit)

1. Va sur [upstash.com](https://upstash.com) → crée un compte (connexion Google/GitHub possible).
2. *Create Database* → choisis une région **proche de celle de ton service Render** (ex. Europe) → plan **Free**.
3. Une fois créée, dans l'onglet **REST API**, copie ces deux valeurs :
   - `UPSTASH_REDIS_REST_URL`  (ex. `https://eu1-xxxx.upstash.io`)
   - `UPSTASH_REDIS_REST_TOKEN`  (une longue chaîne secrète)

### B. Donner ces valeurs à Render

Dans ton service Render → onglet **Environment** → *Add Environment Variable*, ajoute :

| Key | Value |
|-----|-------|
| `UPSTASH_REDIS_REST_URL` | (l'URL copiée) |
| `UPSTASH_REDIS_REST_TOKEN` | (le token copié) |

Render redéploie automatiquement. Au démarrage, les logs doivent afficher :
`[leaderboard] Stockage : Upstash Redis (en ligne).`

✅ C'est tout. Le classement est maintenant permanent. Les secrets restent dans Render (variables d'environnement), **jamais dans le code**.

> Sans ces variables, le serveur affiche `[leaderboard] Stockage : fichier local` et fonctionne comme avant — pratique pour tester en LAN.

## ⚠️ Autres limites du plan gratuit Render

1. **Mise en veille** : après ~15 min sans visiteur, le service s'endort. Le 1er joueur qui se reconnecte attend ~30 s le temps du réveil. (Normal en gratuit.)

2. **Local toujours possible** : ce dossier marche encore en LAN comme avant (`npm start` → `http://localhost:3000`). La détection `ws/wss` choisit le bon protocole automatiquement.
