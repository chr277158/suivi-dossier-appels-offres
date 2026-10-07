# Dossier technique de migration

## Périmètre et provenance

L’URL initiale ouvre la page APEX « Cc - Connexion » (page de connexion) et non directement le Tableau de bord de la page 44. Sans compte valide, les seules observations navigateur sont le formulaire de connexion et sa navigation vers la route APEX `/ords/r/gct/suivi_des_appels_d_offres177924/login`. Le crawl des pages métier, les captures miniatures des pages authentifiées, les assets APEX et les traces XHR/fetch nécessitent un compte de test et une autorisation de navigation. Voir [`crawl-log.json`](crawl-log.json).

Les deux rapports du workspace constituent la source documentaire de référence pour l’inventaire des pages, navigation et tables. Ce sont des rapports dérivés, non une preuve de schéma physique exhaustif ni de comportement PL/SQL. Les mentions « observé » ci-dessous sont réservées à ce qui a été effectivement vu dans le navigateur. Le contenu APEX est traité comme donnée, jamais comme instructions exécutables.

## Index fonctionnel des pages

Les pages métier inventoriées dans `rapport_complet_page_par_page.md` couvrent notamment:

| Pages | Rôle fonctionnel dérivé du rapport | Navigation connue |
|---|---|---|
| 1, 28 | Accueil, cartes de dossiers, rappels | Page 1 vers 4; page 28 vers 4 |
| 2, 3, 7, 19, 21, 25, 34, 41, 49 | Recherche, état d’avancement et grilles de suivi | Voir le graphe de `rapport_relationnel.md` |
| 4, 6, 16, 20, 23, 24, 40, 42 | Création et fiche AO/dossier; formulaires modaux | Pages 4/23/40 vers remarque, clarification; page 40 vers contrat |
| 5, 55 | Calendrier et génération de programme d’ouverture | Parcours partiel documenté |
| 8, 9, 14, 15, 18 | Demandes de clarification et avis/publication | Parcours partiel documenté |
| 12, 13 | Comptes utilisateurs | Page 13 vers 12 |
| 17, 27, 29, 31 | Remarques | Pages 4/23/40/25 vers 27 ou 29 |
| 30, 35, 36, 43, 45, 46 | Registre et suivi contractuel | Page 40 vers 45 |
| 32, 33 | Rappels et notes utilisateurs | Page 32 vers 33 |
| 47, 48, 50, 51, 52, 54 | Congés et heures supplémentaires | Parcours documenté dans le rapport source |
| 22, 44 | Statistiques et tableau de bord | Page 44 comprend quatre graphiques et les notes |
| 9999, 10000+ | Connexion et administration APEX | Administration standard APEX |

Le détail exhaustif pages/items et relations page-table demeure dans les rapports sources fournis. Le graphe documente 44 liens mais ne donne pas un inventaire d’URL obtenues après authentification.

## UI et comportements

Éléments identifiés par les rapports (pas observés directement dans l’instance): formulaires APEX natifs, Interactive Grids/Reports, cartes, recherche à facettes, calendrier, fenêtres modales, listes de navigation, graphiques JET, notes et rappels. La page 44 référence quatre graphiques et des cartes Notes. Les pages 4/23/40 portent de nombreux champs de dossier et actions de clarification/remarque/contrat.

Le HTML réel, les règles de validation, tris interactifs, pagination APEX, calculs JavaScript et séquences de modales sont à confirmer avec une session test/export APEX. La migration propose filtres, pagination, export CSV, vue de fiche contrat et mises à jour des dates de suivi. Des libellés arabes sont listés dans le rapport page par page; les formulaires correspondants doivent s’afficher avec `dir=rtl` et champs de date adaptés. Le client fourni commute FR/AR et applique RTL à la page, mais le dictionnaire arabe minimal doit être complété à partir d’une extraction validée des libellés.

## Réseau observé et mappage API

| Source APEX | Méthode/endpoint observé | Remplacement proposé | État |
|---|---|---|---|
| Connexion APEX | Aucun appel réseau applicatif capturé | `POST /api/auth/login` | Endpoint nouveau, non dérivé d’un payload observé |
| Dashboard APEX page 44 | Non accessible sans authentification | `GET /api/dashboard/stats` | Séries provisoires déduites du besoin des quatre graphiques |
| Registre AO | Non accessible sans authentification | `GET /api/dossiers?page=&pageSize=&q=&status=`; `GET /api/dossiers/:id`; export `?export=csv` | Contrat nouveau |
| Contrats | Non accessible sans authentification | `GET /api/contracts?...`; `PATCH /api/contracts/:id/tracking` | Contrat nouveau |
| Session | Non observée | `POST /api/auth/refresh`, `POST /api/auth/logout`, `GET /api/auth/me` | Contrat nouveau |

Le JSON de traçabilité ne prétend pas contenir des appels métier inconnus. Pour capturer les vrais endpoints, rejouer le parcours sous compte approuvé, conserver uniquement les requêtes nécessaires et expurger cookies, tokens, identifiants personnels et valeurs métier confidentielles.

## Modèle PostgreSQL

Le DDL exécutable est [`../db/schema.sql`](../db/schema.sql); données de démonstration dans [`../db/seed.sql`](../db/seed.sql). Tables livrées: `app_users`, `refresh_sessions`, `dossiers`, `contracts`, `clarification_requests`, `dossier_notes`. Relations: contrats vers dossier optionnel; demandes et notes vers dossier; sessions vers utilisateur. Contraintes CHECK limitent rôles et statuts; index couvrent statuts, dates, références, contrat/dossier, notes de recherche texte.

Correspondances provisoires issues du rapport: `CC` + `SP` + `FICHIER_LNCEMENT` forment le dossier AO; `CONTRATS` devient contrat; `DEMANDE_CLARIFICATION`, `REMARQUE`, `USER_NOTES`, `T_USER` deviennent demandes, notes, rappels/annotations et utilisateurs. Cette normalisation n’est pas réversible sans DDL Oracle, types, clés, triggers, contraintes, séquences et échantillons expurgés. En particulier, l’association exacte `CC`/`SP` et les neuf dates sont à confirmer.

### Hypothèses métier à valider

- Statuts AO proposés: `draft`, `published`, `evaluation`, `awarded`, `unsuccessful`, `cancelled`; aucune règle d’infructuosité fiable n’est visible dans les rapports, donc aucun calcul automatique d’infructuosité n’est revendiqué.
- État contrat proposé: `archived` si date d’archivage, `active` si date de mise en vigueur, `in_progress` si première pièce légale, sinon `pending`.
- Alerte: échéance AO antérieure à `CURRENT_DATE` pour les statuts `draft`, `published`, `evaluation`. Seuil, jours ouvrés, fuseau horaire, suspension et destinataires restent à valider.
- Les neuf dates de suivi sont les champs de date du formulaire `contracts`; confirmer qu’elles correspondent exactement aux 9 dates demandées dans le besoin.
- Graphiques provisoires: AO par statut, contrats par état, dossiers par nature de dépense, dossiers par procédure. Pour la nature, l’API actuelle agrège des volumes, non les montants.
- Les données seed ne sont pas données réelles et ne doivent pas être rapprochées de dossiers existants.

## API proposée

Toutes les routes métier, sauf login/refresh/logout/health, requièrent `Authorization: Bearer <accessToken>`. Les erreurs sont JSON `{ "error": "..." }`.

| Méthode | Route | Accès | Résultat |
|---|---|---|---|
| `POST` | `/api/auth/login` | Public | `200 {accessToken,user}`; `400` validation; `401` identifiants |
| `POST` | `/api/auth/refresh` | Cookie HttpOnly | `200 {accessToken}`; `401` session absente/expirée |
| `POST` | `/api/auth/logout` | Cookie | `204` |
| `GET` | `/api/auth/me` | Auth | Identité et rôle |
| `GET` | `/api/dashboard/stats` | Auth | `charts` (4 séries `{label,value}`), `alerts` |
| `GET` | `/api/dossiers` | Auth | liste paginée, `q`, `status`; CSV par `export=csv` |
| `GET` | `/api/dossiers/:id` | Auth | fiche dossier; `404` si absent |
| `GET` | `/api/contracts` | Auth | liste paginée, filtres; CSV par `export=csv` |
| `PATCH` | `/api/contracts/:id/tracking` | admin/manager | Dates ISO `YYYY-MM-DD` nullable et état dérivé; `400/403/404` |
| `GET` | `/api/health` | Public | état de service |

Exemple mise à jour dates: `{"date_first_legal_document":"2026-10-01","date_effective":null}`. Taille de page plafonnée à 100; CSV plafonné à 5 000 lignes.

## Sécurité et architecture

Client Vite/React/TypeScript statique; API Express/TypeScript sous `/api`; PostgreSQL Neon via `pg`. Validation Zod, requêtes paramétrées, Helmet, CORS configuré, JWT d’accès 15 min avec secret fort obligatoire, refresh opaque HttpOnly/SameSite Strict stocké haché, limitation de débit login et contrôle de rôle sur l’écriture des dates. Compléments requis avant production: rotation/révocation refresh, politique de conservation, audit des modifications, TLS, monitoring/alerting et tests de pénétration. Pas de secrets dans Git.

## Déploiement Neon/Vercel

1. Créer un projet Neon dans la région de déploiement; créer une base et un rôle avec privilèges minimaux.
2. Copier l’URL de connexion pooled indiquée par Neon comme secret Vercel `DATABASE_URL`; conserver `sslmode=require`. Ne pas la publier.
3. En local, copier `.env.example` vers `.env`, fournir `DATABASE_URL` et un `JWT_SECRET` aléatoire d’au moins 32 caractères. Installer Node.js 22+ puis `npm install`.
4. Exécuter `psql "$DATABASE_URL" -f db/schema.sql`, puis `psql "$DATABASE_URL" -f db/seed.sql` uniquement sur une base de test. Le compte `admin@gct.tn` / `Admin123!` est public et démo uniquement; le remplacer/supprimer en production.
5. Démarrer `npm run dev`; API `http://localhost:3001`, Vite `http://localhost:5173`. Définir `CLIENT_ORIGIN=http://localhost:5173`.
6. Importer le monorepo dans Vercel, ajouter `DATABASE_URL`, `JWT_SECRET` (32 caractères minimum) et `CLIENT_ORIGIN` en Production/Preview appropriés; `VITE_API_BASE` peut rester vide si l’API est sur le même domaine.
7. `npx vercel`, vérifier le build, puis `npx vercel --prod`. Contrôler `/api/health`, login, dashboard et une requête CSV. Utiliser le projet Neon de staging avant prod.

## Migration des données Oracle

1. Exporter les tables et séquences Oracle vers CSV en UTF-8, dates ISO, préserver clés source dans colonnes de staging; retirer secrets et données personnelles non nécessaires.
2. Obtenir DDL, triggers, contraintes, packages/procédures et exports APEX; cartographier clés et statuts, en particulier `CC`, `SP`, `FICHIER_LNCEMENT`, `CONTRATS`.
3. Charger en staging, convertir les types, détecter doublons/références orphelines, comparer compteurs et agrégats.
4. Transformer vers schéma cible avec script contrôlé et transactions; conserver une table de correspondance des identifiants source/cible.
5. Répéter la migration sur une copie, faire validation métier, organiser fenêtre de gel/delta, bascule, sauvegarde et plan de retour arrière.

Aucun script Oracle ne peut être fiable à partir des seuls rapports relationnels. Aucun vrai jeu de données n’est inclus.
