# Migration Suivi des dossiers

Monorepo de démonstration pour migrer un sous-ensemble de l’application Oracle APEX vers React/Vite, Express/TypeScript et PostgreSQL Neon. L’API est un point de départ testable, pas une parité intégrale avec les 55 pages métier APEX.

## Prérequis et lancement

- Node.js 22 ou supérieur, npm et PostgreSQL (Neon ou local).
- Copier `.env.example` vers `.env`, renseigner `DATABASE_URL`, un `JWT_SECRET` aléatoire d’au moins 32 caractères et `CLIENT_ORIGIN`.
- Installer: `npm install`.
- Créer tables et compte de démo: `npm run db:migrate`, puis `npm run seed`.
- Lancer client + API: `npm run dev` (Vite `http://localhost:5173`, API `http://localhost:3001`).
- Construire: `npm run build`. Tests: `npm test`. Lint: `npm run lint`.

Le seed est réservé au développement. Il crée le compte de test public `admin@gct.tn` / `Admin123!`; ne jamais exécuter ce seed sur une base de production. Remplacer ou supprimer ce compte avant tout déploiement public. Les vrais mots de passe ne sont jamais fournis par le rapport APEX.

## Neon

1. Créer un projet Neon et une base dans la région proche du déploiement.
2. Copier la chaîne de connexion pooled avec `sslmode=require` dans `DATABASE_URL`; conserver cette valeur en secret.
3. En local, exécuter les deux scripts dans l’ordre ci-dessus. `npm run db:migrate` crée le schéma proposé; `npm run seed` ajoute des exemples synthétiques.
4. Pour toute donnée réelle, exporter Oracle vers un environnement de staging, faire le mapping et vérifier les agrégats avant transfert. Le schéma actuel n’est pas un mapping validé du DDL Oracle.

## Vercel

Importer le dépôt comme projet Vercel avec le root directory à la racine du monorepo. Définir les variables `DATABASE_URL`, `JWT_SECRET` et `CLIENT_ORIGIN` dans les environnements Vercel. Un `VITE_API_BASE` vide utilise le même domaine; le refresh token est aléatoire, opaque et stocké haché.

```sh
npx vercel
npx vercel --prod
```

Vérifier `/api/health`, le login, `/api/dashboard/stats` et l’export CSV. Utiliser une base Neon de staging pour Preview. Appliquer `db/schema.sql` via la console Neon/psql ou `npm run db:migrate` avec la bonne variable d’environnement. Ne jamais placer de secret dans une variable `VITE_*`.

## Comptes et rôles

Le seed local crée un admin démo. Les rôles supportés par l’API sont `admin`, `manager` et `reader`; seules les deux premières catégories peuvent modifier les dates de suivi contrat. Il n’y a pas d’interface d’administration de comptes dans cette version.

## API livrée

- `POST /api/auth/login`, `POST /api/auth/refresh`, `POST /api/auth/logout`, `GET /api/auth/me`
- `GET /api/dashboard/stats`
- `GET /api/dossiers`, `GET /api/dossiers/:id`, `GET /api/contracts`
- `PATCH /api/contracts/:id/tracking`
- `GET /api/health`

Les listes supportent `page`, `pageSize`, `q`, `status`; `export=csv` télécharge un CSV. Les routes métier requièrent un access token Bearer. Le refresh token est un cookie HttpOnly.

## Documentation de migration

- [`docs/migration-technique.md`](docs/migration-technique.md): pages, modèle, API, hypothèses, déploiement et plan.
- [`docs/rapport-analyse.md`](docs/rapport-analyse.md): écarts, risques, estimations et checklist.
- [`docs/crawl-log.json`](docs/crawl-log.json): pages réellement observées et limites d’accès.
- [`rapport_complet_page_par_page.md`](rapport_complet_page_par_page.md) et [`rapport_relationnel.md`](rapport_relationnel.md): rapports source fournis.

L’instance URL initiale redirige vers une connexion; aucun XHR métier ni page authentifiée n’a été observé. Voir le journal avant de considérer une règle métier comme confirmée.

## CI et qualité

GitHub Actions exécute lint, tests et build à chaque push/PR. Husky lance le lint et les tests avant commit; commitlint impose Conventional Commits. La CI utilise une configuration de test sans Neon, avec base simulée.
# suivi-dossier-appels-offres
