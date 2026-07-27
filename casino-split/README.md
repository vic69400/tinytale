# Split — Casino provably fair (B2B)

Split est un jeu de casino "choix binaire en cascade" : à chaque round, le
joueur choisit GAUCHE ou DROITE. Un seul côté est "sûr" pour ce round,
déterminé par un HMAC-SHA256 déterministe impossible à prédire à l'avance
et vérifiable après coup (provably fair). Bon choix → le multiplicateur
cumulé augmente (x1.94 par défaut, house edge 3 %) et le joueur peut
continuer ou cash-out ; mauvais choix → perte de la mise.

> ⚠️ Tous les soldes joueurs sont **entièrement simulés en base de
> données**. Aucune transaction financière réelle, aucun wallet crypto,
> aucune donnée réelle de joueur dans ce dépôt.

## Structure du projet

```
casino-split/
├── docker-compose.yml     # Postgres + Redis pour le dev local
├── backend/                # API Fastify + moteur de jeu + Prisma
│   ├── src/
│   │   ├── provably-fair/  # Moteur provably-fair générique + session de seeds
│   │   ├── games/split/    # Moteur du jeu Split + démo CLI
│   │   ├── services/       # Logique métier + persistance transactionnelle
│   │   ├── routes/         # Endpoints REST
│   │   ├── auth/           # Stub d'authentification JWT
│   │   └── db/              # Clients Prisma & Redis
│   ├── prisma/schema.prisma
│   └── test/                # Tests Vitest (unitaires + intégration)
└── frontend/                # App React + Vite + Tailwind
```

## Prérequis

- Node.js ≥ 20
- Docker + Docker Compose

## Setup local complet

### 1. Démarrer Postgres + Redis

```bash
cd casino-split
docker-compose up -d
```

### 2. Backend

```bash
cd backend
cp .env.example .env
npm install
npm run prisma:migrate   # crée le schéma en base (nom de migration demandé : "init")
npm run seed              # utilisateurs fictifs (joueur_demo, alice_test, bob_test)
npm run dev                # démarre l'API sur http://localhost:3001
```

Vérifier que l'API répond : `curl http://localhost:3001/health` → `{"status":"ok"}`.

### 3. Frontend

Dans un second terminal :

```bash
cd frontend
cp .env.example .env
npm install
npm run dev   # http://localhost:5173
```

Ouvrez `http://localhost:5173`, entrez un pseudo (ex. `joueur_demo`) sur
l'écran de connexion — un compte est créé automatiquement s'il n'existe
pas encore (login de dev, voir plus bas) — puis jouez : misez, choisissez
GAUCHE/DROITE, cash-out.

### 4. Vérifier l'équité d'une partie

Sur la page "Vérifier l'équité" du frontend (`/verify`), collez l'ID
d'une session de seed révélée (visible dans l'app après rotation du seed,
ou via `POST /api/split/session/rotate`) pour recalculer indépendamment
tous les rounds joués.

## Authentification (stub de dev)

L'API attend un `Authorization: Bearer <JWT>` sur les routes protégées.
En local, deux options :

- Depuis le frontend : le formulaire de connexion appelle
  `POST /api/dev/login` (upsert d'un utilisateur par pseudo + émission
  d'un token).
- En ligne de commande : `npm run token -- <username>` (après `npm run seed`).

Cette route de login est **désactivée automatiquement** si
`NODE_ENV=production`. En production, elle doit être remplacée par le
système d'auth réel du casino-opérateur (voir `docs/INTEGRATION.md`) — le
reste de l'API n'a besoin que de `request.userId` être renseigné par le
middleware d'auth.

## Tests

```bash
cd backend
npm test                 # tests unitaires (provablyFair, splitGame) — aucune dépendance externe
```

Les tests d'intégration (`test/split.routes.integration.test.ts`) tapent
une vraie base Postgres/Redis : assurez-vous que `docker-compose up -d`
tourne et que les migrations sont appliquées avant de lancer `npm test`.

## Démo CLI du moteur de jeu

```bash
cd backend
npm run demo
```

Fait tourner le flow complet (mise, rounds, cash-out ou bust, révélation
du seed) directement dans le terminal, sans DB ni API — utile pour
comprendre/valider la logique du moteur.

## Règle du jeu en un coup d'œil

- Mise initiale, débitée à `POST /api/split/start`.
- Chaque round : `POST /api/split/round` avec `direction: "left" | "right"`.
  - Bon choix → `cumulativeMultiplier *= 1.94`, partie toujours active.
  - Mauvais choix → mise perdue, partie `busted`.
- `POST /api/split/cashout` à tout moment (après ≥ 1 round) → crédite
  `floor(betAmount * cumulativeMultiplier)`.
- Le `serverSeed` n'est jamais exposé tant que la session est active ;
  seul son hash SHA-256 l'est. Il est révélé lors de la rotation de
  session (`POST /api/split/session/rotate`) ou implicitement quand une
  nouvelle session est créée.

Voir `docs/INTEGRATION.md` pour la documentation complète de l'API
destinée à un casino-client.
