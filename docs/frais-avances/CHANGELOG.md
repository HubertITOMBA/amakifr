# Changelog — frais avancés

## 0.3.0-choix-reglement — 2026-09-16

### Ajouté
- Choix de règlement adhérent après `VALIDEE` : `REMBOURSEMENT` | `COMPENSATION` | `MIXTE`.
- Affectation manuelle exacte des cibles (dette initiale + cotisations mensuelles ordinaires du même adhérent).
- Exclusion assistances et cotisations avec bénéficiaire ; refus si montant > restant live (pas de `min` silencieux).
- Un seul choix `ACTIF` (contrôle TX) ; historique `REMPLACE` ; remplacement si `utilise = 0`.
- Idempotence clé+contenu ; verrou demandeur → note ; ownership via `NoteFrais` (pas de duplication IDs).
- Archive : résumé `modeReglement` + montants (sans IDs cibles / libellés libres).
- UI membre choix/remplacement ; UI responsable lecture seule.
- **Aucune** notif/push ; **aucun** `Avoir` / `UtilisationAvoir` / `PaiementCotisation` / `Depense`.
- Tests unitaires + PG (IDOR, modes, sommes, cibles exclues, remplacement, concurrence, divergence restants).

### Non inclus
- Exécution du règlement, Avoir, remboursement effectif, lot 4, API v1, mobile, migration, activation.
- Index SQL partiel `UNIQUE(note_frais_id) WHERE statut = 'ACTIF'` (prévu, non créé).

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
