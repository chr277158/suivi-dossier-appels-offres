# Rapport d’analyse de migration

## Écart constaté

L’application cible « Suivi Des Dossiers v2.3 » est décrite dans les rapports comme une app Oracle APEX comportant 55 pages métier et des pages d’administration, avec des modules AO/dossiers, contrats, clarifications, remarques, rappels, congés et tableaux de bord. La demande de migration ne vise toutefois que le socle moderne: connexion, tableau de bord, listes AO/contrats et mise à jour du suivi contractuel.

La session APEX partagée a permis d’observer le tableau de bord (quatre donuts et Notes), l’accueil (état AO, recherche, calendrier, création et cartes), la grille d’état AO, le calendrier mois/semaine/jour, les rappels, plusieurs grilles de planning et contrats, les heures sup et les congés. Les noms de colonnes et régions sont consignés dans `docs/crawl-log.json`; aucune ligne métier nominative n’y figure. Les requêtes réseau XHR/fetch et captures images n’ont pas été exportées, et toutes les 55 pages n’ont pas été parcourues.

## Différences de l’implémentation minimale

- APEX fournit formulaires/grilles/reporting, calendriers, notes, rappels, clarification, congés et administration; React couvre désormais les principales rubriques du menu: dashboard, AO, contrats, calendrier, rappels, planning annuel/travaux, congés, heures sup, historique et annuaire expurgé.
- Les vues planning/RH/historique sont actuellement des grilles de consultation; validation/approbation RH, CRUD avancé, détails modaux et toutes les pages secondaires restent à implémenter.
- Les agrégats livrés sont inférés et leurs catégories doivent être comparées aux quatre séries réelles de la page 44. Le troisième graphique compte des dossiers par nature de dépense, il ne totalise pas les montants.
- Le bandeau définit les retards par date limite antérieure à aujourd’hui et statut actif; le vrai calcul APEX reste inconnu.
- Les statuts et la dérivation d’état contrat sont des hypothèses documentées. Une règle d’infructuosité n’a pas été codée faute de règle source vérifiée.
- Le schéma est une normalisation proposée; il ne copie pas les colonnes Oracle exactes.
- Le formulaire accepte arabe avec direction RTL générale; les libellés et traductions doivent être validés et complétés.

## Risques prioritaires

1. Mauvaise équivalence du modèle: la relation `CC`/`SP`/`FICHIER_LNCEMENT` n’est pas prouvée et peut provoquer pertes ou duplication de dossiers.
2. Perte de règles cachées: processus PL/SQL, Dynamic Actions, validations, calculs et sécurité APEX ne sont pas inclus dans les deux rapports.
3. Écart de chiffres: agrégats, fuseau/date, définition des retards, états archivés et monnaies non confirmés.
4. Compte de démonstration connu: ne jamais l’activer en production. Utiliser un hash de mot de passe et remplacer ce compte.
5. Secrets et sessions: définir des secrets forts obligatoires, limiter les tentatives, fixer CORS et gérer révocation/rotation avant production.
6. Vercel/Neon: valider connexions poolées, migrations répétées, durée d’exécution serverless et limites de connexions sur environnement réel.

## Recommandations

- Obtenir un compte de recette non privilégié, l’export APEX SQL, DDL Oracle, packages PL/SQL et jeux d’essai expurgés.
- Capturer les 4 agrégats et bandeau avec des cas connus; écrire des tests de parité Oracle/PostgreSQL avant import final.
- Compléter par itération les modules dans l’ordre des usages validés: gestion dossier, pièces jointes, demandes/avis, remarques/rappels, contrats avancés puis RH.
- Tester sauvegarde/restauration, contrôle de rôle, audit, accessibilité clavier/lecteur d’écran et FR/AR avant bascule.

## Plan et estimation indicative

Estimations en jours-homme pour un développeur fullstack, hors délais d’accès et validation métier.

| Phase | Tâches et livrables | Dépendances / risques | Estimation |
|---|---|---|---:|
| 1. Préparation | Accès recette, export APEX/Oracle, inventaire règles et parcours, mapping validé | Accès DBA/métier; règles cachées | 3–5 jh |
| 2. Backend & données | Schéma final, migration reproductible, auth/RBAC, API, agrégats et règles testées | DDL + données de référence; intégrité | 8–13 jh |
| 3. Frontend | Design system, navigation, FR/AR/RTL, dashboard, listes, fiches, formulaires | Captures et validations utilisateur | 8–12 jh |
| 4. Tests et parité | Tests API/UI, comparaison des agrégats, import répétable, sécurité/accessibilité | Oracle accessible; jeux connus | 5–8 jh |
| 5. Déploiement | Neon staging/prod, Vercel, CI, secrets, observabilité, sauvegardes | Comptes et DNS | 2–4 jh |
| 6. Stabilisation | UAT, corrections, répétition bascule/retour, surveillance | Disponibilité des référents | 3–5 jh |
| **Total socle** | Hors reprise exhaustive des 55 pages et modules RH |  | **29–47 jh** |

La reprise exhaustive des modules non couverts doit faire l’objet d’un chiffrage après accès aux pages et règles; elle n’est pas incluse dans le total.

## Checklist de conformité

- [ ] Login: utilisateurs actifs, erreur sur mot de passe invalide, rôle conforme APEX, expiration/révocation session.
- [ ] Page 44: volumes des quatre donuts identiques sur même date/jeu de référence.
- [ ] Bandeau: même liste d’AO en retard, même seuil, dates et statuts; comparer fuseau et jours ouvrés.
- [ ] AO: compteurs, filtres, tri, pagination, détails et CSV comparés aux rapports APEX.
- [ ] Contrats: nombre, filtre, CSV et rattachement dossier cohérents.
- [ ] Dates: mise à jour des neuf champs, transitions de statut et droits conformes.
- [ ] Clarifications, remarques, notifications et notes: vérifier périmètre avant marquer comme parité fonctionnelle.
- [ ] RTL: saisie, alignement, navigation clavier, tableaux, dates et textes arabes.
- [ ] Données: compteurs table à table, clés orphelines, doublons, sommes et échantillons vérifiés.
- [ ] Sécurité: aucun secret versionné, seed démo absent de prod, contrôle des rôles, limitation login, journal d’audit.
- [ ] Exploitation: CI verte, health check, restauration testée et retour arrière documenté.
