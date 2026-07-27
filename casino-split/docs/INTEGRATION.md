# Intégration de Split — documentation technique B2B

Ce document décrit comment un opérateur de casino intègre l'API du jeu
Split : authentification, endpoints, formats de réponse, gestion des
erreurs, et surtout **comment un joueur (ou l'opérateur) vérifie
l'équité d'une partie de façon indépendante** — l'argument de vente clé
du modèle provably fair.

## 1. Vue d'ensemble du flow

```
1. POST /api/split/start        -> débite la mise, ouvre une partie
2. POST /api/split/round  (xN)   -> un round = un choix gauche/droite
3. POST /api/split/cashout       -> OU la partie se termine sur un bust
4. POST /api/split/session/rotate -> révèle le seed entre deux parties
5. GET  /api/split/verify/:id    -> vérification indépendante (publique)
```

Une **session de seed** (serverSeed + clientSeed + nonce) peut couvrir
plusieurs parties successives ; le `nonce` s'incrémente à chaque round
joué, quel que soit le nombre de parties. Le `serverSeed` n'est jamais
exposé tant que la session est active — seul son hash SHA-256
(`serverSeedHash`) l'est, publié *avant* que la partie ne commence
(engagement cryptographique).

## 2. Authentification

Toutes les routes sous `/api/split/*` sauf `GET /api/split/verify/:sessionId`
exigent un header :

```
Authorization: Bearer <JWT>
```

Le JWT doit contenir `sub` = l'identifiant utilisateur (UUID) côté Split.
**Le `userId` transmis dans le corps ou l'URL de la requête doit
correspondre exactement au `sub` du token**, sinon l'API répond `403`.

En développement, `POST /api/dev/login` (désactivée si
`NODE_ENV=production`) émule cette émission de token. **En production,
cette route doit être retirée** et remplacée par le système d'auth réel
de l'opérateur : celui-ci n'a qu'à émettre un JWT signé avec le même
secret (`JWT_SECRET`) et contenant `sub: <userId Split>`, ou — pour un
couplage plus fort — le middleware `src/auth/authPlugin.ts` peut être
remplacé par une vérification déléguée à l'API de session de l'opérateur
(cookie de session, introspection OAuth, etc.). Le reste de l'API ne
dépend que de `request.userId` étant renseigné avant l'exécution des
handlers.

## 3. Endpoints

Toutes les réponses sont en JSON. Les erreurs suivent le format :

```json
{ "error": "Message lisible.", "details": [ /* facultatif, erreurs de validation zod */ ] }
```

Codes d'erreur : `400` (validation, solde insuffisant), `401` (auth
manquante/invalide), `403` (userId ≠ utilisateur authentifié), `404`
(ressource introuvable), `409` (état incompatible : partie déjà en
cours, déjà terminée, rotation bloquée).

### `POST /api/split/start`

Démarre une nouvelle partie. Débite la mise, crée une `game_history` en
statut `active`. Refuse si une partie est déjà active pour ce joueur
(`409`) ou si le solde est insuffisant (`400`).

**Requête**
```json
{ "userId": "uuid", "betAmount": 100, "clientSeed": "optionnel" }
```

**Réponse `201`**
```json
{
  "gameId": "uuid",
  "betAmount": 100,
  "balance": 900,
  "session": {
    "id": "uuid",
    "serverSeedHash": "sha256 hex",
    "clientSeed": "hex",
    "nonce": 0,
    "isActive": true
  }
}
```

### `POST /api/split/round`

Joue un round. Persiste le round en base et retourne le résultat.

**Requête**
```json
{ "userId": "uuid", "gameId": "uuid", "direction": "left" }
```

**Réponse `200`**
```json
{
  "round": 1,
  "chosenSide": "left",
  "survived": true,
  "safeSide": null,
  "cumulativeMultiplier": 1.94,
  "status": "active"
}
```

`safeSide` n'est révélé (`"left"` ou `"right"`) que lorsque `survived`
est `false` (bust) — sur un round gagné, il n'apporte aucune information
utile puisque le `serverSeed` reste secret, mais le cacher évite de
gâcher le suspense côté UI. Il reste de toute façon consultable via
`GET /api/split/verify/:sessionId` une fois la session révélée.

`status` vaut `"active"` (partie continue) ou `"busted"` (mise perdue,
partie terminée).

### `POST /api/split/cashout`

Cash-out volontaire. Nécessite qu'au moins un round ait été joué
(`400` sinon) et que la partie soit encore active (`409` sinon — protège
contre le double cash-out).

**Requête**
```json
{ "userId": "uuid", "gameId": "uuid" }
```

**Réponse `200`**
```json
{ "payout": 194, "balance": 1094, "multiplierFinal": 1.94 }
```

`payout = floor(betAmount * multiplierFinal)`.

### `GET /api/split/session/:userId`

Retourne les infos publiques de la session de seed active du joueur
(jamais le `serverSeed` en clair). `404` si aucune session active.

**Réponse `200`**
```json
{ "id": "uuid", "serverSeedHash": "sha256 hex", "clientSeed": "hex", "nonce": 3, "isActive": true }
```

### `POST /api/split/session/rotate`

Force la rotation de seed : révèle l'ancienne session (si elle existe)
et en crée une nouvelle. Utilisable uniquement **entre deux parties**
(`409` si une partie est active).

**Requête**
```json
{ "userId": "uuid", "clientSeed": "optionnel" }
```

**Réponse `200`**
```json
{
  "revealed": {
    "id": "uuid",
    "serverSeed": "hex en clair",
    "serverSeedHash": "sha256 hex",
    "clientSeed": "hex",
    "revealedAt": "2026-07-27T12:00:00.000Z"
  },
  "current": { "id": "uuid", "serverSeedHash": "...", "clientSeed": "...", "nonce": 0, "isActive": true }
}
```

### `GET /api/split/verify/:sessionId` — vérification indépendante (publique)

**Aucune authentification requise.** N'importe qui (joueur, régulateur,
auditeur) peut vérifier qu'une session de seed révélée n'a pas été
manipulée. `409` si la session est encore active (serverSeed pas encore
révélé), `404` si elle n'existe pas.

**Réponse `200`** (session révélée)
```json
{
  "status": "revealed",
  "serverSeed": "hex en clair",
  "serverSeedHash": "sha256 hex",
  "serverSeedHashValid": true,
  "clientSeed": "hex",
  "revealedAt": "2026-07-27T12:00:00.000Z",
  "allValid": true,
  "rounds": [
    {
      "roundNumber": 1,
      "nonce": 1,
      "chosenSide": "left",
      "safeSide": "left",
      "survived": true,
      "hmac": "hmac hex",
      "valid": true
    }
  ]
}
```

`serverSeedHashValid` confirme que le serverSeed révélé correspond bien
au hash publié *avant* que la partie ne commence (l'engagement
cryptographique n'a pas été changé après coup). `valid` par round
confirme que `HMAC-SHA256(serverSeed, clientSeed:nonce:round)` recalculé
correspond exactement au `hmac` enregistré au moment du jeu, et que le
`safeSide` qui en dérive correspond. `allValid` = tout est cohérent.

## 4. Comment un joueur vérifie l'équité (à documenter côté casino-client)

1. Le joueur note, avant de jouer, le `serverSeedHash` et le `clientSeed`
   affichés (via `GET /api/split/session/:userId` ou l'UI).
2. Il joue normalement.
3. Après rotation de session (ou fin de partie + rotation), le
   `serverSeed` en clair est révélé.
4. N'importe qui peut alors recalculer, pour un round donné :
   `HMAC-SHA256(serverSeed, "${clientSeed}:${nonce}:${round}")`, prendre
   le premier octet du résultat : pair → gauche sûr, impair → droite
   sûr. Cela doit correspondre exactement à `safeSide` et à l'issue du
   round tel qu'annoncé pendant la partie.
5. `SHA-256(serverSeed)` doit correspondre au `serverSeedHash` publié
   *avant* la partie — preuve que le casino n'a pas changé de seed après
   coup pour influencer le résultat.

`GET /api/split/verify/:sessionId` automatise entièrement ces calculs
et peut être branché directement sur une page "provably fair" côté
casino-client (voir `frontend/src/pages/VerifyPage.tsx` pour un exemple
d'implémentation).

## 5. Rate limiting

`POST /api/split/start` (10 req/min) et `POST /api/split/round`
(60 req/min) sont limitées par IP via `@fastify/rate-limit` (store
Redis partagé, donc valable même derrière plusieurs instances de
l'API). Ajustez ces seuils dans `src/routes/splitRoutes.ts` selon le
profil de trafic réel.

## 6. Garanties transactionnelles

Toute mutation de solde (débit à `/start`, crédit à `/cashout`) et toute
écriture d'état de partie (`game_history`, `game_rounds`) passe par une
transaction Prisma (`prisma.$transaction`). Le débit de mise utilise une
mise à jour conditionnelle atomique (`UPDATE ... WHERE balance >= mise`)
pour éliminer toute race condition de double débit ; le statut de partie
(`active` → `busted`/`cashed_out`) est vérifié dans la même transaction
que la mutation de solde pour empêcher un double cash-out.

## 7. Ce qui reste à la charge du casino-opérateur

- Émission des JWT (remplacer le stub de dev).
- Provisioning des comptes joueurs réels (`users.balance` reste un
  entier — l'opérateur gère la conversion vers/depuis son propre wallet
  ou système de crédits).
- Limites de mise, KYC/AML, conformité réglementaire locale — hors
  périmètre de ce moteur de jeu.
