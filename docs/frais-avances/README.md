# Frais avancés — documentation versionnée

| Version | Date | Contenu |
|---------|------|---------|
| 0.4.10-retention-legal-hold | 2026-09-18 | Lot 4.10 : politiques dynamiques + legal hold (flag off) |
| 0.4.9-archivage-financier-rgpd | 2026-09-18 | Lot 4.9 : archive privée ≠ journal financier ≠ reports (flag off) |
| 0.4.8-annulation-double-validation | 2026-09-17 | Lot 4.8 : annulation double validation (flag off) |
| 0.4.7-restitutions-reelles | 2026-09-17 | Lot 4.7 : restitutions réelles (flag off) |
| 0.4.6-corrections-append-only | 2026-09-17 | Lot 4.6 : corrections append-only (flag off) |
| 0.4.5-notifications-reglement | 2026-09-17 | Lot 4.5 : notif + outbox règlement (flag off) |
| 0.4.4-permissions-ui | 2026-09-17 | Lot 4.4 : permissions + UI opérationnelle (flag off) |
| 0.4.3-mixte | 2026-09-16 | Lot 4.3 : exécution mixte atomique (flag off) |
| 0.4.2-remboursement | 2026-09-16 | Lot 4.2 : remboursement traçable (flag off) |
| 0.4.1-compensation | 2026-09-16 | Lot 4.1 : exécution compensation (flag off) |
| 0.4.0-charge | 2026-09-16 | Lot 4.0 : charge Depense FRAIS_AVANCE à la validation + synthèse par origine (flag off) |
| 0.3.0-choix-reglement | 2026-09-16 | Choix règlement adhérent (lot 3 local, flag off) |
| 0.2.0-decision | 2026-09-15 | Décision VALIDEE/REJETEE (lot 2 local, flag off) |
| 0.1.6-archive-privee | 2026-09-15 | Archive privée locale ; politique réelle non activée |
| 0.1.5-pg-submit-delete-races | 2026-09-15 | Courses 6a/6b déterministes soumission/suppression |
| 0.1.4-pg-integration | 2026-09-15 | Tests PG allowlistés + injection client + courses |
| 0.1.3-rgpd-hardening | 2026-09-15 | to_regclass hors TX ; Restrict schéma ; course MOVE/UNLINK |
| 0.1.2-rgpd-hook | 2026-09-15 | Hook suppression compte atomique |
| 0.1.1-étape1-socle | 2026-09-15 | Correctifs revue |
| 0.1.0-étape1-socle | 2026-09-15 | Socle local |

Voir [GUIDE.md](./GUIDE.md) et [CHANGELOG.md](./CHANGELOG.md).

**Migrations versionnées 4.0–4.10 en dépôt, non appliquées en production.** Flag off par défaut.
Voir [`MIGRATIONS-4x.md`](./MIGRATIONS-4x.md) (`prisma migrate deploy` ≠ `db push` de test PG).
**Lot 4.10** : politique ACTIVE seed (10 ans après clôture) + legal hold — **n'active pas** le module ; validation expert-comptable/DPO recommandée avant prod.

**Déploiement** : voir [`DEPLOY-PRODUCTION.md`](./DEPLOY-PRODUCTION.md) (gardes, répétition, migration orpheline réconciliée).
**Archive privée** ≠ journal financier détaché ≠ reports de période (synthèse).
**Décision VALIDEE** = reconnaissance de charge (`Depense` origine `FRAIS_AVANCE`) ≠ décaissement bancaire.
**Choix de règlement** ≠ exécution financière ≠ création d'`Avoir`.
**Suite** : appliquer `migrate deploy` puis activer seulement après validation métier.