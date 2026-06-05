# Pong — LAN (2 à 6 joueurs)

Pong multijoueur en réseau local, **terrain adaptatif** selon le nombre de joueurs. **Serveur Node.js autoritatif** (boucle de jeu + physique côté serveur), clients dans le navigateur. **Zéro dépendance** : WebSocket implémenté avec les modules natifs de Node.

## Forme du terrain

Décidée au lancement selon le nombre de participants (humains + bots) :

| Joueurs | Terrain | Joueurs | Terrain |
|---|---|---|---|
| 2 | Face à face (carré, 2 murs) | 5 | Pentagone |
| 3 | Triangle | 6 | Hexagone |
| 4 | Carré | | |

Chaque joueur occupe une arête ; les arêtes sans joueur sont des **murs** qui rebondissent. La physique tourne en repère local par arête (réflexion vectorielle + effet/spin).

## Modes d'équipe

Bouton **⚔ Mode** (lobby) — disponible selon le nombre de participants :

| Joueurs | Modes possibles |
|---|---|
| 4 | FFA (chacun pour soi), **2v2** |
| 6 | FFA, **2v2v2**, **3v3** |
| autres | FFA uniquement |

Les coéquipiers sont répartis en **alternance** autour du polygone (donc opposés/distribués), partagent une **couleur d'équipe** (A/B/C). Une équipe est éliminée quand **tous ses membres sont morts** ; la **dernière équipe debout** gagne et tous ses membres marquent le point.

## Presets de partie

Bouton **🎮** (lobby) — réglages appliqués par le serveur, visibles avant le match :

| Preset | Vies | Balle | Power-ups |
|---|---|---|---|
| **Classique** | 5 | posée, sans accélération | non |
| **Rapide** (défaut) | 3 | vive + accélération | oui |
| **Chaos** | 5 | accélération forte | fréquents |

### Options éditables (bouton ⚙ Options)

Avant le lancement, n'importe qui peut ajuster (autoritatif serveur, diffusé à tous, verrouillé pendant manche/décompte) :

**Réglages de balle** (passent le preset en « Personnalisé ») : **vies** (1–9), **vitesse** (lente/normale/rapide), **power-ups** on/off, **accélération** on/off.

**Règles de match** (indépendantes du preset) :
- **Victoire** : `Dernier survivant` · `Manches` (premier à N manches → écran *MATCH*) · `Éliminations` (premier à N éliminations cumulées).
- **Mort subite** (à 2 équipes/joueurs restants) : `Off` · `Terrain rétrécit` · `Balle accélère` — bandeau « MORT SUBITE ».
- **Service** : `Aléatoire` · `Vers le dernier perdant` (équilibrage).
- **Handicap (catch-up)** : le leader (plus de vies/kills) a une raquette plus courte, marqué 👑.

## Écran de fin (stats)

À la fin d'une manche : **classement** (médailles), **cause d'élimination** (« éliminé par Px à 12s » ou « le mur »), **durée**, **rebonds** totaux, et par joueur : **💀 éliminations infligées**, **⚔ vies retirées** (à des adversaires), ❤ vies restantes, 🏓 rebonds, ✦ power-ups collectés.

## Classement persistant (🏆)

Saisis un **pseudo** (mémorisé dans le navigateur, envoyé à la connexion) : le classement est agrégé **par pseudo** et **conservé sur le serveur** dans `leaderboard.json` (survit aux redémarrages). Mis à jour à la fin de chaque manche, diffusé à tous.

Superlatifs affichés (best **et** « pires ») :
- 🏆 plus de victoires · 💀 plus d'éliminations · ⚖ meilleur **ratio K/D** · ⏱ survie la plus longue · ⌀ **meilleure survie moyenne** · ✦ plus de power-ups
- 🐔 éliminé le plus vite · 😴 touche le moins la balle (sur une manche)

Plus un tableau cumulé par joueur (parties, victoires, éliminations, **K/D**, **survie moyenne**, meilleure survie) et un bouton **Réinitialiser**. Les **bots** ne sont pas comptés. (Note : sans comptes, deux personnes utilisant le même pseudo fusionnent.)

À la fin de chaque manche, un **podium animé** (top 3 cumulé par victoires) s'affiche sur l'écran de fin.

## Effets (juice)

- **Interpolation client** : rendu ~2 ticks derrière, lerp des positions entre snapshots → mouvement fluide même à 144 Hz / réseau qui jitte.
- **Trail de balle coloré** selon le dernier à avoir frappé (lisibilité « qui a touché »).
- **Kill feed** en direct (« P3 ⚡ P1 ») dans le coin.
- **Particules** d'élimination + **flash du bord** qui encaisse.
- **Bandeaux** : « MULTI-BALLE ! », « DERNIÈRE VIE — X ».
- **MVP + badge 🐔 boulet** sur l'écran de fin (noms affichés aussi sur les bords).
- **Shake léger** d'écran sur les éliminations (amorti).
- **Impact** : flash additif + léger *pop* de la balle au rebond/élimination.
- **Transition 3·2·1** : décompte serveur avant chaque manche (raquettes mobiles, balle figée), + fondu de l'écran de fin.

Tous ces effets visuels sont **désactivés** par l'option « Réduire les effets » (accessibilité) ; le kill feed reste affiché (info, pas un effet).

## Affichage & accessibilité

Bouton **⚙️** (réglages persistés en `localStorage`) :
- **Thèmes** : Néon (défaut) · Rétro CRT (scanlines) · Clair.
- **Musique d'ambiance** on/off — synthé WebAudio dont le tempo suit l'intensité du jeu.
- **Palette daltonien** (Okabe-Ito) · **Contraste renforcé** · **Réduction des effets** (glow, traînées, anneaux, fond animé, scanlines).

## Classement, historique & stats

- Bouton **🏆** : superlatifs + tableau cumulé + **historique des 20 dernières parties** avec **filtres** par preset et par mode.
- Page **`/stats`** (lecture seule, HTML) et **`/leaderboard.json`** (export brut) servies par le serveur.

## Reconnexion & spectateurs

- **Reprise de siège** : un token (localStorage) est renvoyé à la connexion ; après une coupure, le joueur récupère **son siège et son pseudo**.
- **Spectateurs actifs** (7ᵉ+ connectés) : ils voient la partie et peuvent **lâcher un power-up** (bouton 🎁, anti-spam 5 s).

## Attribution du joueur local

Pastille « Tu es Px », **halo lumineux sur ton bord**, label **VOUS** sur ta raquette, carte HUD surlignée.

## Lancer

```
node server.js
```

Le terminal affiche deux URL :
- `http://localhost:3000` (machine hôte)
- `http://<IP-LAN>:3000` (à ouvrir sur les autres PC du réseau)

Chaque joueur ouvre l'URL LAN dans son navigateur → il reçoit automatiquement un siège (P1→P4). Dès **2 joueurs** connectés, n'importe qui peut lancer la partie (bouton, clic ou Espace).

## Contrôles (chacun sur sa machine)

- **Déplacer la raquette le long de son bord** : `↑`/`↓` **ou** `←`/`→` (ou `W`/`S`, `A`/`D`) — toutes ces touches font « reculer / avancer » le long de l'arête, quel que soit l'orientation du bord.
- **Bots** : bouton 🤖 (cycle 0 → max) pour remplir les sièges vides.
- **Pause** : `P` ou `Échap` (ou le bouton).
- **Lancer / rejouer** : `Espace`, clic, ou bouton.

## Features

- **Pause** synchronisée (n'importe quel joueur peut mettre en pause).
- **Power-ups** qui apparaissent sur le terrain, collectés en touchant la balle :
  - `+1` **multi-balle** (jusqu'à 8 balles) · `XL` **raquette agrandie** · `⛉` **bouclier** (renvoie sans perdre de vie).
  - `◌` **balle fantôme** (traverse la prochaine raquette) · `⇄` **inversion** des contrôles d'un adversaire · `▭` **raquette réduite** ciblée · `≈` **ralenti** global (bullet-time).
  - **Power-ups négatifs** (option) : pièges rouges collés au ramasseur — `▽` ta raquette réduit, `✕` tes contrôles inversés, `»` balle accélérée.
- **Immunité après perte de vie** : 3 s d'invincibilité — le côté renvoie la balle, la raquette clignote.
- **Accélération globale** : la balle accélère avec le temps → tension croissante.
- **Bots IA** : bouton « Bots » remplit les sièges vides ; **difficulté réglable** (Facile / Normal / Difficile — le mode Difficile anticipe la trajectoire).
- **Score multi-manches** : les victoires sont cumulées par joueur, conservées entre les manches.
- **Sons** WebAudio (rebond, élimination, bouclier, power-up, victoire).

## Architecture (modules ES, zéro dépendance)

```
pong-lan/
  server.js          point d'entrée : HTTP statique + branche le WebSocket + boucle 60 Hz
  ws.js              mini-serveur WebSocket (RFC 6455), modules natifs
  game.js            état autoritatif : update, collisions, géométrie, règles, power-ups, bots
  leaderboard.js     persistance JSON + agrégats
  public/
    shared.js        constantes géométriques (importées par game.js ET app.js → zéro duplication)
    index.html       markup
    style.css        styles
    app.js           client : réseau, interpolation, rendu, UI, sons (module ES)
  package.json · README.md · leaderboard.json
```

- **Tout est autoritatif serveur** : les clients n'envoient que des intentions (`input` / `start` / `pause` / `opt`…) ; physique, RNG balle, power-ups et IA bots sont calculés côté serveur.
- `shared.js` est servi au navigateur **et** importé par le serveur : une seule source de vérité pour `W,H,BALL_R,…`.
- Le client utilise des **modules ES** (`<script type="module">`) → fonctionne via le serveur (`http://`), pas en double-clic `file://`.

## Bugs corrigés vs version locale d'origine

- **Double-collision raquette** dans la même frame (ajout d'un `break`).
- Touches via `e.code` → robuste **AZERTY/QWERTY** et insensible à la casse / CapsLock.
- **Touche « collée »** après Alt-Tab : reset des inputs sur l'événement `blur`.
