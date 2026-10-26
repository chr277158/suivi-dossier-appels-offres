# Migration Suivi des dossiers

Monorepo de démonstration pour migrer un sous-ensemble de l’application Oracle APEX vers React/Vite, Express/TypeScript et PostgreSQL Neon. L’API est un point de départ testable, pas une parité intégrale avec les 55 pages métier APEX.

## Prérequis et lancement

- Node.js 22 ou supérieur, npm et PostgreSQL (Neon ou local).
- Copier `.env.example` vers `.env`, renseigner `DATABASE_URL`, un `JWT_SECRET` aléatoire d’au moins 32 caractères et `CLIENT_ORIGIN`. Pour les notifications Web Push, définir aussi les variables VAPID et `CRON_SECRET`.
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

Dans Vercel, ouvrir **Project Settings → Build and Deployment** et régler **Root Directory** sur `.` (racine du dépôt), pas `client/`. C’est nécessaire pour que Vercel découvre aussi la fonction `api/index.ts`. Laisser **Output Directory** géré par `vercel.json`. Définir les variables `DATABASE_URL`, `JWT_SECRET` et `CLIENT_ORIGIN` dans les environnements Vercel. Pour les notifications même quand l’application est fermée, ajouter aussi `CRON_SECRET`, `VAPID_SUBJECT`, `VAPID_PUBLIC_KEY` et `VAPID_PRIVATE_KEY`. Générer les clés avec `npx web-push generate-vapid-keys --json`; garder la clé privée et `CRON_SECRET` secrètes, jamais dans une variable `VITE_*`. La fréquence Cron d’une minute configurée dans `vercel.json` dépend des capacités incluses dans le forfait Vercel.

```sh
npx vercel
npx vercel --prod
```

Vérifier `/api/health`, le login, `/api/dashboard/stats` et l’export CSV. Utiliser une base Neon de staging pour Preview. Appliquer `db/schema.sql` via la console Neon/psql ou `npm run db:migrate` avec la bonne variable d’environnement. Ne jamais placer de secret dans une variable `VITE_*`.

## Comptes et rôles

Le seed local crée un admin démo. Les rôles supportés par l’API sont `admin`, `manager` et `reader`; seules les deux premières catégories peuvent modifier les dates de suivi contrat. Il n’y a pas d’interface d’administration de comptes dans cette version.

## API livrée

- `POST /api/auth/login`, `POST /api/auth/refresh`, `POST /api/auth/logout`, `GET /api/auth/me`
- `GET /api/dashboard/stats`, `GET /api/dashboard/deadlines` (admin/manager)
- `GET /api/dossiers`, `GET/PATCH /api/dossiers/:id`
- `GET/PUT /api/dossiers/:id/tracking`, `GET /api/dossiers/:id/contracts`
- `GET/POST /api/contracts`, `GET /api/contracts/:id`
- `PATCH /api/contracts/:id/tracking`
- `GET /api/calendar/events`, `GET/POST /api/reminders`, `POST /api/reminders/:id/read`, `POST /api/reminders/read-all`
- `POST /api/reminders/:id/sent`, `GET /api/reminders/assignees`
- `GET/POST/DELETE /api/notifications/push`, `GET /api/cron/reminders` (tâche planifiée protégée par `CRON_SECRET`)
- `GET /api/planning/annual`, `GET /api/planning/work-schedule`
- `GET /api/overtime`, `GET /api/leaves`, `GET /api/audit`, `GET /api/users` (admin)
- `GET/POST /api/clarifications`, `GET/POST /api/notes`
- `GET /api/dossiers/:id/compliance-recipients` (prévisualisation des destinataires autorisés)
- `GET /api/health`

Après mise à jour du code de la fiche dossier sur une base déjà existante, appliquer la migration ciblée avec `npm run db:migrate:dossier-detail` (après avoir configuré `DATABASE_URL`). Pour une nouvelle base, `npm run db:migrate` inclut déjà ces colonnes et la table de suivi.

Le contrôle « Dossiers avec anomalie » utilise les indicateurs `is_urgent` et `via_tuneps`. Sur une base existante, appliquer `npm run db:migrate:dossier-compliance`. La page contrôle les commissions, préfixes, numéros de dossier, mise en concurrence, ouverture hors TUNEPS et évaluation. Le délai d’avis de commission et la date de la première réunion de commission ne sont pas distinctement modélisés et restent hors contrôle. L’ignorance est conservée dans l’état de la session; la notification est une prévisualisation/simulation, pas un envoi réel. Aucun modèle contributeur n’existant, seuls le responsable et les administrateurs sont retournés comme destinataires.

Les listes supportent `page`, `pageSize`, `q`, `status`; `export=csv` télécharge un CSV. Les routes métier requièrent un access token Bearer. Le refresh token est un cookie HttpOnly.

### Durcissement des sessions

Pour une base déjà créée, exécuter `npm run db:migrate:auth-session-hardening` avant de déployer la nouvelle API. Les access tokens durent 10 minutes. Les refresh tokens sont à usage unique, renouvelés à chaque rafraîchissement et leur rejeu révoque la famille de session. Une session expire après 7 jours d’inactivité ou 30 jours au total. En production, le cookie de renouvellement utilise `__Host-`, `Secure`, `HttpOnly` et `SameSite=Strict`. Les nouveaux mots de passe définis par l’administration doivent comporter au moins 6 caractères.

Les administrateurs et gestionnaires peuvent transmettre un rappel à plusieurs comptes avec `assignToUserIds` et définir `visibleUntil`; le rappel reste visible jusqu’à la fin de cette date. `submission_deadline` et `bid_opening_date` sont saisis et stockés comme dates-heures locales.

Dans le formulaire dossier, un statut manuel qui contredit les dates affiche un avertissement et demande une confirmation. La dérogation confirmée expire après 24 heures; à la prochaine lecture ou actualisation des dossiers, le statut est recalculé selon les dates d’annonce et d’ouverture des plis.

`GET /api/reminders` combine les rappels manuels persistés et les alertes métier calculées à la volée depuis les dossiers et leur suivi. Les alertes métier ne sont ni stockées, ni envoyées en Push, ni marquées comme lues; elles sont visibles tant que leurs conditions sont réunies. Les échéances anticipées sont affichées deux jours ouvrables avant la publication ou l’ouverture des plis. Les alertes de retard commencent après plus de deux jours ouvrables pour l’évaluation et les cautions, et après plus de trois jours ouvrables pour la préparation du contrat. Les samedis et dimanches sont exclus; les jours fériés ne le sont pas.

Les rappels manuels peuvent être livrés par Web Push, même si la page est fermée. L’utilisateur active ou désactive l’abonnement dans la page Rappels et autorise son navigateur. Le Cron Vercel appelle le dispatcher chaque minute. Les rappels échus sont réclamés sans doublon par les instances concurrentes (`SKIP LOCKED`), leur statut et leurs tentatives sont persistés et les erreurs temporaires sont réessayées avec des délais progressifs, au maximum cinq tentatives. Les abonnements expirés sont supprimés. Sans abonnement Push valide, la notification navigateur existante sert de secours quand l’application est ouverte. `lead_minutes` est appliqué au calcul de l’heure d’envoi.

Sur une base existante, après sauvegarde, exécuter `npm run db:migrate:notifications` avec le `DATABASE_URL` ciblé avant de déployer le code : cette migration conserve les rappels manuels, les abonnements Push et les étapes de suivi, mais supprime les anciens workflows automatiques ainsi que les données du compagnon. Pour une nouvelle base, `db/schema.sql` reflète déjà le schéma cible. Tester les notifications sur un déploiement HTTPS de préproduction et vérifier les exécutions Cron dans les journaux Vercel.

## Documentation de migration

- [`docs/migration-technique.md`](docs/migration-technique.md): pages, modèle, API, hypothèses, déploiement et plan.
- [`docs/rapport-analyse.md`](docs/rapport-analyse.md): écarts, risques, estimations et checklist.
- [`docs/systeme-notifications-simplifie.md`](docs/systeme-notifications-simplifie.md): architecture, règles métier, API, migration, tests et risques du système de notifications simplifié.
- [`docs/crawl-log.json`](docs/crawl-log.json): pages réellement observées et limites d’accès.
- [`rapport_complet_page_par_page.md`](rapport_complet_page_par_page.md) et [`rapport_relationnel.md`](rapport_relationnel.md): rapports source fournis.

Une session APEX a permis de parcourir les principaux modules de navigation. Les XHR/fetch n’ont pas été capturés et le crawl n’est pas exhaustif; voir le journal avant de considérer une règle métier comme confirmée.

## CI et qualité

GitHub Actions exécute lint, tests et build à chaque push/PR. Husky lance le lint et les tests avant commit; commitlint impose Conventional Commits. La CI utilise une configuration de test sans Neon, avec base simulée.
# suivi-dossier-appels-offres
