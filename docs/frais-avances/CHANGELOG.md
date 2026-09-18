# Changelog — frais avancés

## 0.4.10-retention-legal-hold — 2026-09-18

### Ajouté (lot 4.10 — local, flag off ; migration versionnée, **non appliquée en prod**)
- Politiques versionnées `NoteFraisRetentionPolicyVersion` (BROUILLON|ACTIVE|REMPLACEE) ; une seule ACTIVE (index partiel).
- Fondement métier : P1/P2/P3 = **10 ans calendaires après clôture d'exercice** (défaut 31/12 configurable).
- V1 : `effectiveAt` ≤ now à l'activation (pas de planification) ; `reportsSansEcheance=true` obligatoire (CHECK SQL + fail-closed).
- Snapshot immuable ; P1 autonome ; legal hold + **UI opérationnelle** conservation (pose/levée ADMIN).
- Index idempotence court `nf_ret_pol_act_idem_uidx` ; CHECK reports `nf_ret_pol_reports_sans_echeance_v1_chk` (noms ≤63).
- Seed ACTIVE technique — **n'active pas** le module.
- Migration `20260918130000_notes_frais_4x10_retention_policies_legal_hold`.
- Preuve PG migrate historique 45→46 (fixtures) + courses P1∥P2.

### Non inclus
- Activation flags / workers prod ; `migrate deploy` prod ; réduction rétroactive des échéances historiques.

## 0.4.9-archivage-financier-rgpd — 2026-09-18

### Ajouté (migrations dépôt 4.0–4.9 — **non appliquées en prod**, flag off)

- Trois migrations versionnées : `notes_frais_4x_foundation`, `notes_frais_4x_backfill_seed`, `notes_frais_4x_integrity`.
- Seed idempotent `TypeDepense.code=FRAIS_AVANCE` (`createdBy=NULL`) ; index partiels ACTIF/DEMANDEE ; CHECK XOR documentés.
- Triggers différés MIXTE/corrections **reportés** (gardes TX + tests PG).
- Doc : `docs/frais-avances/MIGRATIONS-4x.md` (runbook + preuve drift). Script verify local hors staging.

### Ajouté (lot 4.9 — local, flag off ; migrations dépôt versionnées séparément, **non appliquées en prod**)
- **Archive privée purgeable** (`NoteFraisArchive` + PJ) : consultation ADMIN|TRESOR|COMCPT ; **jamais** source de synthèse.
- **Journal financier détaché** (`NoteFraisJournalFinancierEvenement`) : aucune FK identité/note/archive/live ; kinds minimaux (remb/comp/corr/restit) ; politique P3.
- **Reports de période** (`NoteFraisReportFinancierPeriode`) : consolidation atomique des événements expirés ; synthèse = live + journal + reports.
- Trois politiques distinctes P1/P2/P3 (allowlists **vides** — bloquent l’activation ; injections tests).
- Détachement : Depense (`noteFraisId` null, origine FRAIS_AVANCE, libellé technique) ; Avoir/UA (ligne null, textes techniques, Utilise, hors FIFO) ; `adherentId` Avoir SetNull.
- Acteurs audit → nullable SetNull (`createdBy` Depense, executeurs, uploaders, TypeDepense…).
- PJ archive : pas de `nomFichierOrig` exposé ; download `justificatif-{rang}.{ext}`.
- Synthèse stable : avant archive == après == après purge privée == après consolidation.
- TX RGPD : prepare + user.delete ; counts assertés ; fail-closed politiques.

### Non inclus (activation)
- Application prod (`migrate deploy`) ; activation des flags ; durées/startsAt/periodeCle réelles (trésorier) tant que P1/P2/P3 restent vides.
- Index partiels ACTIF/DEMANDEE et CHECK XOR : **inclus** dans `20260918120200_notes_frais_4x_integrity` (versionnés, non encore déployés en prod).

## 0.4.8-annulation-double-validation — 2026-09-17

### Ajouté (lot 4.8 — local, flag off, **pas de migration dépôt**)
- Annulation à double validation (`DEMANDEE` → `CONFIRMEE` | `REFUSEE` | `EXPIREE` 30 j).
- XOR `reglementId` | `operationId` (MIXTE parent uniquement — jamais enfant).
- Preuves `PreuveAnnulationReglement` ; permissions `requestCancel*` / `confirmCancel*` / `refuseCancel*` / `readNoteFraisAnnulationAudit`.
- Attestation confirmateur obligatoire ; liens CONFIRMEE user/admin séparés.
- Verrous confirm alignés 4.1–4.7 (choix → cibles → dettes/CM) ; garde une `DEMANDEE` active (TX).
- Historique : CONFIRMEE seule (« règlement annulé ») ; pas de DEMANDEE ; COMCPT sans audit ; ADMIN/TRESOR audit si capacité.
- Capacités UI + `listPendingAnnulationDemandesForNote` ; dialogs Request / Confirm / Refuse + countdown `expiresAt`.
- Distincte corrections 4.6 et restitutions 4.7 ; tick expiration instrumentation (flag on uniquement).
- Tests unitaires + PG (courses demandes, confirm↔refus, compteur, verrous).

### Non inclus
- Index partiels uniques `DEMANDEE` (prérequis **première migration avant activation**) ; détachement RGPD 4.9 ; migration dépôt ; activation.

## 0.4.7-restitutions-reelles — 2026-09-17

### Ajouté (lot 4.7 — local, flag off, **pas de migration dépôt**)
- Restitutions réelles append-only sur `NoteFraisReglement` type `REMBOURSEMENT` (simple ou enfant MIXTE).
- Schéma : `NoteFraisRestitution` (`reglementId` Restrict ; `actorUserId` SetNull ; pas de `noteFraisId` redondant).
- Sémantique : entrée bancaire → `restitutionsNotesFrais` ↑ ; `montantRembourseUtilise` ↓ (réouvre restant dû / plafonds) ; distinct des corrections 4.6.
- Plafonds croisés correction ↔ restitution ; décréments compteur via `updateMany` gardé (`count === 1`).
- Synthèse : décaissements et restitutions **séparés** ; `restantDuNotesFrais` activé (notes VALIDEE, choix ACTIF uniquement).
- Permission `recordNoteFraisRestitution` / `readNoteFraisRestitutionReference` ; COMCPT sans référence.
- Notif/outbox `RESTITUTION_ENREGISTREE` ; UI `RecordRestitutionDialog` ; historique kind `RESTITUTION`.
- RGPD : présence restitution = historique financier (refus explicite avant 4.9).

### Non inclus
- Détachement archive 4.9 ; migration dépôt ; activation.

## 0.4.6-corrections-append-only — 2026-09-17

### Ajouté (lot 4.6 — local, flag off, **pas de migration dépôt**)
- Corrections append-only `REFERENCE` | `MONTANT_NEGATIF` sur `NoteFraisReglement` (enfant MIXTE inclus).
- Schéma : `NoteFraisReglementCorrection` (liaison `reglementId` seule ; `actorUserId` SetNull) + `NoteFraisCorrectionInverseCible` multilignes.
- Entrées monétaires : chaînes positives → stockage `montant` strictement négatif ; aucun float/capping.
- REFERENCE en chaîne serveur (effective = dernière correction sinon originale) ; `CORRECTION_NO_CHANGE` si inchangé.
- Compensation : inverses explicites ; Avoir/UA d'origine immuables ; détection `CIBLE_MOUVEMENTS_POSTERIEURS`.
- Preuve V1 MONTANT_NEGATIF (`preuveKind` + `preuveRef`) ; REFERENCE sans preuve.
- Authz `correctNoteFraisReglement` (TRESOR|ADMIN) ; idempotence + OCC ; notif/outbox génériques.
- Synthèse : nets = bruts + corrections négatives ; `restitutionsNotesFrais` reste 0.
- RGPD : refus explicite `NOTES_FRAIS_FINANCIAL_HISTORY_ARCHIVE_REQUIRED` si règlement/correction (détachement 4.9).
- UI : dialogues référence / montant ; historique DTO filtré par rôle.

### Non inclus
- Correction moyen/`executeAt` ; restitution ; annulation ; migration dépôt ; activation ; archivage financier complet.

## 0.4.5-notifications-reglement — 2026-09-17

### Ajouté (lot 4.5 — local, flag off, **pas de migration dépôt**)
- Notification interne + outbox push au demandeur après exécution **fresh** compensation / remboursement / MIXTE.
- Helper TX partagé `note-frais-reglement-notify` (textes génériques, kinds `REGLEMENT_*`, eventKeys ancrés).
- Atomique dans la même TX que le règlement ; MIXTE = **un** événement sur l'opération parente.
- Replay / alreadyExecuted / P2002 idempotency : **zéro** notif/outbox supplémentaire ; P2002 eventKey non masqué.
- Kick best-effort `processNoteFraisOutboxOnce` après commit fresh (absent si client injecté).
- Hook test `afterNotifyOutbox` pour rollback intégral (finance + notif + outbox).
- Push minimal : pas de montant, moyen, référence, cible, motif ; lien `/user/frais-avances/{noteId}`.
- Archivage RGPD : purge payload outbox (`{ userIds: [] }`) pour PENDING|PROCESSING|DONE|FAILED ; worker finish/requeue no-op si claim perdu.

### Non inclus
- Correction / restitution / annulation ; évolution RGPD ; migration dépôt ; activation permanente.

## 0.4.4-permissions-ui — 2026-09-17

### Ajouté (lot 4.4 — local, flag off, **pas de migration dépôt**)
- Authz lecture live `readNoteFrais` **restrictive** (Actif + ADMIN|PRESID|SECRET|TRESOR ; ADMIN bypass ; MEMBRE/COMCPT seuls impossibles).
- Authz vue financière `readNoteFraisFinancialView` branchée (Actif + ADMIN|TRESOR|COMCPT ; PRESID/SECRET/MEMBRE refusés).
- DTO capacités serveur (`canReadLive`, `canReadFinancial`, `canDecide`, exécutions, `isOwner`) — boutons UI dérivés côté serveur uniquement.
- Historique règlements groupé (simples + MIXTE parent) ; référence absente du DTO membre (pas seulement `undefined`).
- Parcours membre post-règlement (montants, badge état financier, historique, masquage remplacement si compteurs > 0).
- Liste admin : filtres statut + état financier serveur ; détail boutons selon capacités.
- Route COMCPT `/admin/frais-avances/comptabilite` (liste financière minimale, sans PJ / sans exécution).
- Navigation : « Mes frais avancés » (hint `NEXT_PUBLIC`), « Frais avancés » (lecteurs live), « Comptabilité des frais » (capacité financière) ; provisionnement **seed uniquement** (pas d’ensure runtime).
- Listes admin / compta : pagination serveur (défaut 20) ; filtre état financier SQL avant slice ; liste admin sans lignes Justificatif (count seulement).
- UI money-cents (chaînes) : Choix, Décision, brouillon nouveau, conditions de boutons.
- Messages toast `REFRESH_REQUIRED` / `VERSION_CONFLICT` / `IDEMPOTENCY_CONFLICT` sans données sensibles.

### Non inclus
- Correction / restitution / annulation ; évolution RGPD.
- Migration dépôt ; activation permanente.

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
