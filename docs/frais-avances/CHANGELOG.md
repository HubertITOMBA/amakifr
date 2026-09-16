# Changelog — frais avancés

## 0.2.0-decision — 2026-09-15

### Ajouté
- Décision sur note `SOUMISE` → `VALIDEE` | `REJETEE` (montant accepté, motif, journal métier).
- Permission `decideNoteFrais` : comptes **Actif** `TRESOR` | `ADMIN` (principal ou additionnel) — filtre rôle non contournable par permission dynamique. Ensuite : config WRITE **absente** → rôle suffit ; **disabled** / rôle hors liste → refus explicite ; **ADMIN** principal bypass.
- PRESID/SECRET : lecture + notifs soumission uniquement ; COMCPT : archive uniquement.
- Auto-décision interdite (`decideurUserId !== demandeurUserId`).
- Note rejetée immuable ; brouillon de correction lié (`corrigeNoteFraisId`, SetNull à l’archivage).
- Notif interne + outbox `DECIDED` atomiques avec la décision ; push après commit.
- RGPD : `VALIDEE`/`REJETEE` protégées comme `SOUMISE` sans politique réelle.
- Tests unitaires + PG (concurrence, rollback, idempotence, rôles, auto-décision, RGPD).

### Non inclus
- `Depense`, remboursement, Avoir, synthèse, `dateReconnaissanceCharge`, API v1, mobile, migration, activation.

## 0.1.6-archive-privee — 2026-09-15

### Ajouté
- Archive privée locale : modèles, archivage TX avec delete compte, MOVE→READY, download READY, purge, audit SetNull.
- Droits ADMIN|TRESOR|COMCPT ; DTO sans chemins ; pas de qualification « anonyme ».
- Politique : aucune durée produit ; injection test uniquement ; refus SOUMISE inchangé sans politique.
- Tests PG archive (allowlist Docker) ; docs fonctionnement / limites / sauvegardes.

## 0.1.5-pg-submit-delete-races — 2026-09-15
Courses 6a/6b déterministes soumission/suppression.

## 0.1.4-pg-integration — 2026-09-15
Tests PG allowlistés + injection client.

## 0.1.3-rgpd-hardening — 2026-09-15
to_regclass hors TX ; Restrict schéma ; course MOVE/UNLINK.

## 0.1.2 / 0.1.1 / 0.1.0
Hook RGPD + socle étape 1.
