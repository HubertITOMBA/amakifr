# Changelog — frais avancés

## 0.4.3-mixte — 2026-09-16

### Ajouté (lot 4.3 — local, flag off, **pas de migration dépôt**)
- `NoteFraisReglementOperation` (type MIXTE) + 2 règlements enfants COMPENSATION / REMBOURSEMENT.
- `NoteFraisReglement.operationId` nullable ; `idempotencyKey` nullable (null sur enfants MIXTE).
- `@@unique([operationId, type])` ; CHECK SQL futurs documentés.
- Service `executeNoteFraisReglementMixte` : TX unique, horloge injectable, même `executeAt`.
- Helpers TX partagés (`note-frais-reglement-apply`) ; contrats 4.1/4.2 conservés.
- Permission `executeNoteFraisReglementMixte` ; UI `ExecuteMixteDialog` + `ExecuteCompensationDialog`.
- Parent incomplet / corrompu → `NOTES_FRAIS_MIXTE_OPERATION_INCOMPLETE` (fail-closed, aucune réparation).
- Helper client `money-cents` (centimes entiers) pour plafonds / activation UI.
- Synthèse inchangée (agrège uniquement les enfants typés).
- **Aucune** notif/outbox.

### Non inclus
- Correction / restitution / annulation ; polish UI (4.4) ; notif règlement (4.5).
- Migration dépôt ; activation permanente.

## 0.4.2-remboursement — 2026-09-16

### Ajouté (lot 4.2 — local, flag off, **pas de migration dépôt**)
- Exécution remboursement : `TypeNoteFraisReglement.REMBOURSEMENT` + ligne dédiée.
- Traçabilité : `moyen` (VIREMENT|ESPECES), `reference` / `referenceNormalisee`, `executeAt` saisi.
- Modes choix `REMBOURSEMENT` et `MIXTE` (part remboursement seulement) ; partiels + complément.
- Permission `executeNoteFraisRemboursement` ; authz avant replay ; P2002 ciblé.
- Horloge injectable en options internes de service uniquement (jamais via l’action).
- Vue financière dédiée `readNoteFraisFinancialView` (ADMIN|TRESOR|COMCPT) : règlements + référence, sans justificatifs ni description ; `canUserReadSubmittedNotesFrais` **non** élargi à COMCPT.
- État financier calculé ; incohérence compteurs → `NOTES_FRAIS_FINANCIAL_STATE_INCONSISTENT` (pas de clamp).
- Montant transmis en chaîne décimale ; normalisation `Prisma.Decimal` serveur.
- Synthèse : `decaissementsNotesFrais` = Σ remboursements EXECUTE ; solde bancaire ↓ ; charge inchangée.
- UI admin minimale `ExecuteRemboursementDialog` (datetime-local → ISO UTC strict).
- CHECK SQL polymorphes **documentés** (futurs) : COMPENSATION cibles non null ; REMBOURSEMENT cibles null.
- **Aucune** notif/outbox ; **aucun** PaiementCotisation / Avoir / 2ᵉ Depense.

### Non inclus
- MIXTE une TX (4.3), correction, restitution, annulation, polish UI (4.4), notif règlement (4.5).
- Migration dépôt ; activation permanente.

## 0.4.1-compensation — 2026-09-16

### Ajouté (lot 4.1 — local, flag off, **pas de migration dépôt**)
- Exécution compensation : `NoteFraisReglement` + `NoteFraisReglementLigne`.
- `OrigineAvoir.COMPENSATION_NOTE_FRAIS` ; Avoir créé `statut=Utilise`, hors FIFO.
- FK uniquement `Avoir`/`UtilisationAvoir.noteFraisReglementLigneId` (pas de miroir sur la ligne).
- Modes choix `COMPENSATION` et `MIXTE` (part compensation seulement).
- Partiel + complément ; revalidation stricte `REFRESH_REQUIRED` ; OCC `expectedNoteVersion`.
- Permission `executeNoteFraisCompensation` (TRESOR|ADMIN, restrictive).
- Synthèse : `compensationsNotesFrais` = Σ règlements EXECUTE ; solde bancaire inchangé.
- **Aucune** notif/outbox ; **aucun** `PaiementCotisation` / 2ᵉ Depense / remboursement.

### Non inclus
- Remboursement (4.2), mixte exécution complète, restitution, correction, annulation.
- Migration dépôt ; activation permanente.

## 0.4.0-charge — 2026-09-16

### Ajouté (lot 4.0 — local, flag off, **pas de migration dépôt**)
- Enum `OrigineDepense` (`ORDINAIRE` | `FRAIS_AVANCE`) ; `Depense.origine` défaut `ORDINAIRE`.
- `TypeDepense.code` nullable unique ; résolution métier par `code=FRAIS_AVANCE` (aucune création runtime).
- `Depense.noteFraisId` unique → `NoteFrais` Restrict ; relation inverse `DepenseCharge` ; **aucun** `NoteFrais.depenseId`.
- Dans la TX `SOUMISE → VALIDEE` : création atomique d’**une** `Depense` :
  - `origine=FRAIS_AVANCE`, `montant=montantAccepte`, `dateDepense=NoteFrais.dateDepense`,
  - `statut=Valide`, `createdBy`/`validatedBy` = décideur ;
  - TypeDepense absent/inactif → erreur `TYPE_DEPENSE_FRAIS_AVANCE_ABSENT` + rollback complet.
- Rejet : zéro Depense ; replay / concurrence : unicité `noteFraisId` + OCC.
- Synthèse : `totalCharges` = toutes Valide ; `depensesOrdinairesDecaissees` = ORDINAIRE ;
  `soldeBancaireEstime` = recettes − ORDINAIRE (FRAIS_AVANCE n’abaisse pas encore la banque) ;
  indicateurs notes (`decaissements*`, `compensations*`, `restitutions*`, `restantDu*`) exposés à **0**.
- Fixture tests `ensureTypeDepenseFraisAvanceForTests` (idempotente).
- RGPD : Restrict conserve le blocage ; détachement archive (`noteFraisId→null`, `origine` inchangée) = **lot 4.9**.

### Non inclus
- Modèles / exécution remboursement, compensation, mixte, restitution, annulation (4.1–4.8).
- Détachement FK à l’archivage (4.9).
- Migration Prisma dépôt ; activation permanente ; commit / push / déploiement.

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
