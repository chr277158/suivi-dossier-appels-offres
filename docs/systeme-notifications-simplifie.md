# Refonte du système de notifications

## Décisions de conception

- Les rappels manuels restent persistés dans `user_reminders`.
- Les alertes métier sont des projections calculées à chaque appel de `GET /api/reminders`; aucune ligne de notification métier ni aucun état de lecture métier n'est écrit en base.
- Les alertes métier sont visibles par les administrateurs et gestionnaires, ainsi que par le responsable `owner_user_id` du dossier. Les autres lecteurs ne voient que leurs dossiers autorisés.
- Le Push existant demeure réservé aux rappels manuels. Le Push métier est désactivé pour éviter les renvois à chaque Cron sans registre de livraison.
- Une alerte d'anticipation apparaît du jour calculé jusqu'à la date de l'événement inclusivement. Une alerte de retard apparaît à partir du seuil et reste visible jusqu'à la réalisation de l'étape.
- Les jours ouvrables sont les jours du lundi au vendredi. Les jours fériés ne sont pas pris en compte.

## Architecture cible

```text
React
  ├─ Centre de notifications : rappels manuels + projection métier courante
  ├─ Rappels manuels : création, transmission, lecture et Push existants
  └─ Aucun compagnon, paramètre de compagnon ou dialogue de workflow

Express
  └─ GET /api/reminders
       ├─ lecture des rappels manuels appartenant à l'utilisateur
       ├─ lecture des dossiers visibles et de leurs étapes de suivi
       ├─ calcul des dates ouvrables dans business-notifications.ts
       └─ réponse combinée, sans persistance des alertes métier

PostgreSQL
  ├─ conserve user_reminders (manuel) et push_subscriptions
  ├─ conserve dossier_tracking_steps (états de réalisation)
  └─ n'a plus de tables ou préférences du compagnon
```

## Règles métier et étapes source

| Clé | Condition et échéance | Étape persistée utilisée |
|---|---|---|
| `publication` | À partir de 2 jours ouvrables avant `announcement_date`, jusqu'à la date de publication incluse | Aucune condition d'achèvement demandée |
| `bid_opening` | À partir de 2 jours ouvrables avant `bid_opening_date`, jusqu'à la date d'ouverture incluse | Aucune condition d'achèvement demandée |
| `offers_evaluation` | À partir du 3e jour ouvrable après `bid_opening_date`, si l'étape n'est pas réalisée | `offers_evaluated` |
| `provisional_bond_return` | À partir du 3e jour ouvrable après `committee_decision_date`, si l'étape n'est pas réalisée | `provisional_bond_returned` |
| `definitive_bond_request` | Même seuil de 3 jours ouvrables, si le dossier est attribué et l'étape non réalisée | `definitive_bond_requested` |
| `contract_preparation` | À partir du 4e jour ouvrable après `committee_decision_date`, si le dossier est attribué et l'étape non réalisée | `contract_prepared` |

« Plus de deux jours » signifie que deux jours ouvrables complets sont écoulés : l'alerte commence le troisième jour ouvrable. « Plus de trois jours » commence le quatrième. Une étape est considérée réalisée si `dossier_tracking_steps.completed_at` n'est pas `NULL`.

## Structures TypeScript

Implémentées dans `server/src/business-notifications.ts` :

```ts
type BusinessNotificationRule =
  | 'publication'
  | 'bid_opening'
  | 'offers_evaluation'
  | 'provisional_bond_return'
  | 'definitive_bond_request'
  | 'contract_preparation';

type BusinessNotification = {
  id: string;                 // Identifiant déterministe, jamais persisté
  type: 'business';
  rule_key: BusinessNotificationRule;
  title: string;
  details: string;
  reminder_at: string;        // Date calculée de déclenchement
  importance: 'high';
  is_sent: false;
  is_read: false;
  dossier_id: number;
  dossier_reference: string;
  dossier_subject: string;
};

type BusinessDossier = {
  id: number;
  reference: string;
  subject: string;
  status: string;
  owner_user_id: number | null;
  announcement_date: string | null;
  bid_opening_date: string | null;
  committee_decision_date: string | null;
  offers_evaluated: boolean;
  provisional_bond_returned: boolean;
  definitive_bond_requested: boolean;
  contract_prepared: boolean;
};
```

Les rappels manuels reçoivent `type: 'manual'` à la sortie de l'API. Le centre n'incrémente le compteur de non-lus et n'enregistre la lecture que pour ces rappels. Les alertes métier disparaissent automatiquement quand leur règle n'est plus vraie.

## Endpoints

### Conservés

- `GET /api/reminders` : liste combinée, calcul métier réexécuté à chaque appel.
- `POST /api/reminders` : crée un rappel manuel pour soi ou le transmet selon les permissions.
- `POST /api/reminders/:id/read` et `POST /api/reminders/read-all` : marquent les rappels manuels comme lus.
- `POST /api/reminders/:id/sent` : marque un rappel manuel envoyé par le client.
- `GET/POST/DELETE /api/notifications/push` : consultation de la clé publique et gestion de l'abonnement Push.
- `GET /api/cron/reminders` : livraison Push des seuls rappels manuels.
- `GET /api/reminders/assignees` : destinataires actifs pour le formulaire de transmission.

### Supprimés

- `GET/PUT /api/user/preferences`
- `GET/PUT/POST/DELETE /api/user/companion-dates` et `PUT /api/user/companion-date-fields`
- `GET /api/reminders/companion-check`
- `POST /api/reminders/:id/decision`
- `POST /api/reminders/:id/snooze`
- `POST /api/reminders/:id/follow-up`

## Service backend et pseudo-code

```text
GET /api/reminders (authentifié):
  lancer en parallèle:
    M = rappels manuels de l'utilisateur encore visibles
    D = dossiers visibles:
        tous si admin/gestionnaire, sinon owner_user_id = utilisateur
        joindre les dates utiles et les étapes de suivi
    aujourd'hui = CURRENT_DATE de PostgreSQL

  pour chaque dossier d:
    pour chaque règle:
      si la règle exige "attribué" et d.status n'est pas "awarded": continuer
      si l'étape source est achevée: continuer

      pour publication/ouverture:
        déclenchement = date de l'événement moins 2 jours ouvrables
        actif si déclenchement <= aujourd'hui <= date de l'événement

      pour évaluation/restauration/demande caution:
        déclenchement = date source plus 3 jours ouvrables
        actif si aujourd'hui >= déclenchement

      pour préparation contrat:
        déclenchement = date décision plus 4 jours ouvrables
        actif si aujourd'hui >= déclenchement

      si actif: créer un objet métier en mémoire, avec id déterministe

  retourner tri chronologique de M + les objets métiers
  ne faire aucun INSERT/UPDATE des objets métiers
```

## Migration SQL

Migration idempotente : `db/migrations/20261020_simplified_notifications.sql`.

- Supprime les lignes automatiques historiques identifiées par `workflow_type`, sans toucher aux rappels manuels.
- Retire de `user_reminders` les colonnes et contraintes `event_key`, `workflow_type`, `workflow_step` et `is_resolved`.
- Supprime `user_preferences`, `user_companion_date_fields` et `user_companion_dates`.
- Recrée l'index de livraison pour les seuls rappels non envoyés.
- Préserve `push_subscriptions`, les rappels manuels et `dossier_tracking_steps`.

Pour une base existante, après configuration de `DATABASE_URL`, lancer :

```sh
npm run db:migrate:notifications
```

La migration est transactionnelle. Prévoir néanmoins une sauvegarde de la base avant exécution : les anciens rappels automatiques et les dates personnalisées du compagnon seront supprimés conformément au périmètre demandé.

## Fichiers touchés

- `server/src/business-notifications.ts` : calcul pur des règles et jours ouvrables.
- `server/src/app.ts` : composition API, extraction des étapes et suppression des anciens endpoints/workflows.
- `server/test/business-notifications.test.ts` : tests unitaires calendaires.
- `server/test/api.test.ts` : contrat combiné, routes supprimées et conservation des rappels manuels.
- `client/src/App.tsx` et `client/src/i18n.ts` : centre combiné, filtrage des types et suppression des dialogues/compagnon.
- `client/src/BouncingYellowBall.tsx`, `client/src/CompanionSettingsPage.tsx`, `client/src/companion.css`, `client/src/decision-dialog.css` : retirés.
- `db/schema.sql` : schéma des nouvelles installations.
- `db/migrations/20261020_simplified_notifications.sql`, `server/scripts/sql.ts`, `package.json` : migration déployable.
- `README.md` : documentation opérationnelle.

## Plan de tests

1. Calcul unitaire : deux jours ouvrables avant un événement, en traversant un week-end.
2. Calcul unitaire : déclenchement le 3e jour ouvrable après ouverture/décision et le 4e pour le contrat.
3. Vérifier qu'une étape complétée supprime l'alerte et que les règles de caution/contrat requièrent le statut attribué.
4. API : union manuels + métier, rôle et filtre des dossiers, date courante issue de PostgreSQL, aucun INSERT métier.
5. API : routes du compagnon, de décision, de report et de suite à donner absentes.
6. Non-régression : création, transmission, lecture, expiration de visibilité, Push et Cron des rappels manuels.
7. Migration : exécution sur copie représentative, conservation des manuels et abonnements, suppression des lignes/tableaux ciblés, seconde exécution idempotente.
8. Build et lint ciblé client/serveur avant déploiement.

## Risques de régression et mesures

- **Indicateur d'achèvement absent** : une étape sans ligne ou avec `completed_at = NULL` est considérée non réalisée. La migration conserve la checklist existante.
- **Heure/fuseau** : les seuils métier sont des dates calendaires ; les champs horodatés sont ramenés à leur jour civil. `CURRENT_DATE` vient de PostgreSQL pour éviter une comparaison avec l'horloge du navigateur.
- **Jours fériés** : seuls samedi et dimanche sont exclus ; les jours fériés ne sont pas modélisés.
- **Alertes métier non acquittables** : aucun état de lecture métier n'est conservé, donc elles persistent tant que leur condition est vraie. Le bouton ouvrir le dossier demeure disponible.
- **Push métier désactivé** : choix explicite pour éviter les doublons sans persister d'état d'envoi. Les Push manuels restent livrés par le Cron.
- **Date d'ouverture absente ou date de décision absente** : les règles qui en dépendent ne produisent pas d'alerte.
- **Données historiques supprimées** : le script supprime les workflows automatiques et dates personnalisées du compagnon ; effectuer une sauvegarde avant migration.
- **Coût de calcul** : l'API lit les dossiers visibles et leurs étapes à chaque appel. L'index `dossier_tracking_steps(dossier_id)` et les index d'échéances existants limitent le coût ; surveiller la latence si les volumes augmentent.

## Ordre de déploiement

1. Sauvegarder la base et tester la migration sur une copie.
2. Exécuter `npm run db:migrate:notifications` sur la base cible.
3. Déployer le serveur et le client compatibles avec le schéma simplifié.
4. Vérifier le centre, les six règles, les droits de visibilité et les rappels manuels.
5. Vérifier le Push manuel sur HTTPS et une exécution Cron.
6. Contrôler les journaux et la latence de `GET /api/reminders`.
