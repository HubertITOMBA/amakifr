# Guide — Frais avancés

## Livré

### Socle étape 1
- Brouillon + `version` OCC ; PJ `PENDING|READY|FAILED` ; download READY authz ; DTO sans chemins.
- Soumission idempotente ; notifs + outbox ; workers singleton.
- Flag off par défaut ; `NEXT_PUBLIC_*` n’autorise pas le serveur.

### Décision (lot 2 — local, flag off)
- `SOUMISE` → `VALIDEE` ou `REJETEE` uniquement.
- Règles : `0 < montantAccepte ≤ montantDemande` ; motif obligatoire si acceptation partielle ou rejet.
- Permission **`decideNoteFrais`** : **TRESOR** et **ADMIN** actifs (rôle principal **ou** additionnel) **obligatoires**.
  - Une permission dynamique WRITE ne **contourne pas** ce filtre (MEMBRE + `decideNoteFrais` → refusé).
  - Après le filtre rôle : config dynamique `decideNoteFrais` WRITE —
    **absente** → rôle métier suffit ; **`enabled=false`** ou rôle hors `permission.roles` → **refus explicite** ;
    rôle principal **ADMIN** : bypass aligné sur `hasPermission`.
  - ≠ destinataires notif soumission (`ADMIN|PRESID|SECRET|TRESOR`).
  - PRESID/SECRET : lecture live + notifs, **pas** de décision.
  - COMCPT : droits **archive** uniquement.
- Auto-décision interdite si `actorUserId === demandeurUserId` (pas de rapprochement nom/email).
- **Limite inter-comptes** : deux comptes distincts pour une même personne physique ne sont pas corrélés techniquement.
- Journal métier `notes_frais_decisions` (1 / note) + champs décision sur `notes_frais`.
- Atomique dans la TX : note + journal + notification demandeur + outbox `DECIDED` (+ `Depense` si VALIDEE, lot 4.0).
- Verrouillage : **demandeur** puis **note** (même ordre que RGPD).
- Idempotence : même clé + même contenu → succès sans doublon ; même clé + contenu différent → conflit.
- Note `REJETEE` immuable ; `createCorrectedNoteFraisDraft` (même propriétaire, `corrigeNoteFraisId`).
- Lien de correction : `onDelete: SetNull` — compatible archivage RGPD de la note d’origine.
- **Charge (lot 4.0)** : `Depense` `origine=FRAIS_AVANCE` créée à la validation ; `dateDepense` = date économique de la note ; `decideeAt` = date de reconnaissance.
- **Charge ≠ décaissement** : solde bancaire estimé ne soustrait que les `ORDINAIRE` jusqu’aux lots 4.1+.

### Charge reconnue (lot 4.0 — local, flag off)
- Schéma : `OrigineDepense`, `TypeDepense.code`, `Depense.noteFraisId` → Note Restrict.
- Resolve-only `TypeDepense` `code=FRAIS_AVANCE` actif ; sinon rollback TX.
- Fixture tests : `ensureTypeDepenseFraisAvanceForTests` (jamais runtime métier).
- Synthèse par **origine** uniquement (jamais par `noteFraisId`) :
  - `totalCharges` = Σ Valide ;
  - `depensesOrdinairesDecaissees` = Σ Valide ORDINAIRE ;
  - indicateurs règlement notes exposés à 0 ;
  - `soldeBancaireEstime` = recettes − ORDINAIRE (− décaissements notes + restitutions, encore 0).
- RGPD : Restrict + refus sans politique restent sûrs ; détachement FK futur (4.9) conservera `origine=FRAIS_AVANCE`.

### Remboursement exécuté (lot 4.2 — local, flag off)
- Choix ACTIF `REMBOURSEMENT` ou `MIXTE` (part remboursement uniquement).
- Traçabilité : moyen `VIREMENT|ESPECES`, référence 1–64 (brute + normalisée), `executeAt` ISO **avec fuseau** (≥ decideeAt, ≤ now+5 min ; horloge injectable tests uniquement).
- Vue financière dédiée (ADMIN|TRESOR|COMCPT) : agrégats + référence ; **pas** d’élargissement du détail live à COMCPT.
- État financier calculé ; dépassement compteurs → erreur `NOTES_FRAIS_FINANCIAL_STATE_INCONSISTENT`.
- Montant en chaîne décimale côté action ; `Prisma.Decimal` serveur.
- Futurs CHECK SQL (non créés) : COMPENSATION ⇒ cibles/snapshots NOT NULL ; REMBOURSEMENT ⇒ tous NULL.
- TX : demandeur → note → choix ; OCC ; compteur `montantRembourseUtilise` ; une ligne sans cible/Avoir.
- Synthèse : `decaissementsNotesFrais` ↑ ; **solde bancaire ↓** ; `totalCharges` inchangé (pas de double soustraction FRAIS_AVANCE).
- État financier calculé (non stocké) : remboursé + compensé vs accepté.
- Notif + outbox `REGLEMENT_REMBOURSEMENT` atomiques sur exécution fresh (lot 4.5).

### Règlement mixte atomique (lot 4.3 — local, flag off)
- Parent `NoteFraisReglementOperation` + enfants COMPENSATION et REMBOURSEMENT (`operationId`, `idempotencyKey` null sur enfants).
- Choix ACTIF `MIXTE` uniquement ; les deux parts > 0 ; sinon services simples.
- Instant unique `executeAt` partagé ; TX unique (verrous comp ⊃ remb) ; OCC version une fois.
- Idempotence parent avant OCC ; parent incomplet → `NOTES_FRAIS_MIXTE_OPERATION_INCOMPLETE` (fail-closed).
- UI plafonds / activation : `lib/frais-avances/money-cents` (centimes entiers, pas de `Number()` flottant).
- Compléments partiels toujours possibles via services 4.1/4.2 sur le même choix MIXTE.
- Synthèse : agrège **uniquement** les règlements enfants (jamais la table parent).
- Notif + outbox `REGLEMENT_MIXTE` **uniques** sur l'opération parente (lot 4.5) — jamais par enfant.

### Corrections append-only (lot 4.6 — local, flag off)
- `REFERENCE` (remboursement) et `MONTANT_NEGATIF` (remboursement / compensation, y compris enfants MIXTE).
- Aucune mutation du règlement, ligne, Avoir ou UtilisationAvoir d'origine ; pas de restitution bancaire.
- Compensation multilignes via `NoteFraisCorrectionInverseCible` ; option A (pas d'Avoir/UA inverse).
- Synthèse nette : décaissements / compensations = brut + corrections négatives.
- Archivage RGPD : refus `NOTES_FRAIS_FINANCIAL_HISTORY_ARCHIVE_REQUIRED` tant que détachement 4.9 absent.
- Constraint triggers différés documentés (appartenance ligne, type règlement, Σ inverses) — invariants TX + tests PG.

### Restitutions réelles (lot 4.7 — local, flag off)

Argent réellement revenu à l'association après un remboursement :
- augmente `restitutionsNotesFrais` (solde bancaire) ;
- décrémente `montantRembourseUtilise` (réouvre le restant dû) ;
- jamais sur COMPENSATION ni opération MIXTE parente ;
- distincte d'une correction 4.6 (aucune création croisée) ;
- confidentialité : membre/COMCPT sans référence/motif/acteur ;
- `restantDuNotesFrais` activé (notes VALIDEE, choix ACTIF uniquement).

### Annulation double validation (lot 4.8 — local, flag off)

Annulation d'un règlement simple ou d'une opération MIXTE **parente** :
- demande XOR `reglementId` | `operationId` (enfant MIXTE interdit) ;
- `DEMANDEE` sans effet financier ; `CONFIRMEE` seule inverse les compteurs / cibles ;
- expiration 30 j (`EXPIREE`) ; confirmateur ≠ auteur de la demande ≠ demandeur note ;
- preuves `PreuveAnnulationReglement` selon remb / comp / MIXTE ;
- attestation confirmateur obligatoire (`attestation: true`) ;
- historique membre : CONFIRMEE (« règlement annulé ») uniquement — pas de DEMANDEE ;
- COMCPT : résultat financier sans audit ; ADMIN/TRESOR : audit si `readNoteFraisAnnulationAudit` ;
- UI : `RequestCancelDialog` / `ConfirmCancelDialog` / `RefuseCancelDialog` + countdown `expiresAt` ;
- notifs CONFIRMEE : lien `/user/...` pour le demandeur note, `/admin/...` pour l'auteur (eventKeys `…:confirmee:user|admin`) ;
- distincte corrections 4.6 et restitutions 4.7 (présence corr/restit bloque la demande) ;
- **garde TX** une seule `DEMANDEE` active par cible ; index partiels uniques livrés dans `20260918120200_notes_frais_4x_integrity` (prérequis activation — voir `docs/frais-avances/MIGRATIONS-4x.md`).

```sql
-- Noms exacts (migration integrity) :
-- notes_frais_choix_reglement_actif_uidx
-- notes_frais_annul_demande_reglement_demandee_uidx
-- notes_frais_annul_demande_operation_demandee_uidx
CREATE UNIQUE INDEX notes_frais_annul_demande_reglement_demandee_uidx
  ON notes_frais_reglement_annulation_demandes ("reglementId")
  WHERE statut = 'DEMANDEE' AND "reglementId" IS NOT NULL;

CREATE UNIQUE INDEX notes_frais_annul_demande_operation_demandee_uidx
  ON notes_frais_reglement_annulation_demandes ("operationId")
  WHERE statut = 'DEMANDEE' AND "operationId" IS NOT NULL;
```

### Notifications de règlement (lot 4.5 — local, flag off)
- Helper TX `note-frais-reglement-notify` : textes génériques (« Règlement enregistré ») + lien `/user/frais-avances/{noteId}`.
- Kinds : `REGLEMENT_COMPENSATION` | `REGLEMENT_REMBOURSEMENT` | `REGLEMENT_MIXTE`.
- EventKeys ancrés sur `reglementId` / `operationId` ; replay alreadyExecuted sans doublon.
- Kick outbox post-commit fresh (sauf client injecté) ; échec push/lease sans impact financier.
- Aucune donnée sensible dans titre/message/push/logs ; aucune écriture financière additionnelle.

### Permissions et UI opérationnelle (lot 4.4 — local, flag off)
- **Lecture live** (`canUserReadSubmittedNotesFrais`) : Actif + rôle dur ADMIN|PRESID|SECRET|TRESOR (principal/additionnel) ; permission `readNoteFrais` restrictive ; ADMIN principal bypass ; une permission dynamique ne peut pas autoriser MEMBRE/COMCPT seul ; propriétaire via chemin owner.
- **Vue financière** (`canUserReadNoteFraisFinancialView`) : Actif + ADMIN|TRESOR|COMCPT ; `readNoteFraisFinancialView` restrictive ; pas de détail live / PJ.
- **Capacités** calculées serveur (`getNoteFraisCapabilities`) : boutons Décider / Exécuter uniquement si capacité + statut/choix/plafonds ; contrôles serveur conservés.
- **Membre** : montants + badge état financier + historique groupé (MIXTE une fois) ; jamais de référence ; masquer « remplacer » si compteurs > 0.
- **Admin** : filtres statut / état financier serveur ; historique + référence si capacité financière ; CTA MIXTE prioritaire si deux reliquats > 0.
- **COMCPT** : `/admin/frais-avances/comptabilite` (liste financière dédiée, pas `listAdminNotesFrais`).
- **Navigation** : hint `NEXT_PUBLIC_NOTES_FRAIS_ENABLED` pour l’affichage uniquement ; menus sidebar **seed** (`scripts/seed-menus.ts`) — **aucune** écriture Menu runtime ; URL toujours protégée serveur ; flag off → indisponible sans requêtes tables.
- **Listes** : pagination serveur (défaut 20) ; filtre état financier SQL avant pagination ; admin sans lignes Justificatif (count).
- **Money UI** : chaînes + `money-cents` (centimes entiers) ; payloads décision / choix / brouillon en chaîne.
- Pas de nouvelle écriture financière ; pas de correction / restitution / annulation / RGPD.

### Compensation exécutée (lot 4.1 — local, flag off)
- Choix ACTIF `COMPENSATION` ou `MIXTE` (part compensation uniquement).
- TX : verrous demandeur → note → choix → cibles → dettes/CM ; OCC version note.
- Écritures : règlement + lignes + Avoir (`COMPENSATION_NOTE_FRAIS`, `Utilise`) + `UtilisationAvoir` XOR cible.
- Synthèse : `compensationsNotesFrais` ↑ ; créances ↓ ; **solde bancaire inchangé**.
- Notif + outbox `REGLEMENT_COMPENSATION` atomiques sur exécution fresh (lot 4.5) ; pas de remboursement.

### Choix de règlement (lot 3 — local, flag off)
- Après `VALIDEE` uniquement ; propriétaire seul (`demandeurUserId`).
- Modes : `REMBOURSEMENT` | `COMPENSATION` | `MIXTE`.
- `montantRemboursement + montantCompensation = montantAccepte` (égalité exacte).
- Compensation V1 : dette initiale + cotisations mensuelles **ordinaires** du même adhérent.
  - Exclut catégorie `Assistance` et lignes avec `adherentBeneficiaireId`.
  - Affectation manuelle : chaque cible + montant + rang ; Σ cibles = compensation.
  - Si montant demandé > restant live → refus `REFRESH_REQUIRED` (pas de `min` silencieux).
- Un seul choix `ACTIF` (contrôle TX) ; plusieurs `REMPLACE` possibles (historique).
  - Index partiel SQL futur `WHERE statut = 'ACTIF'` — **non créé** dans ce lot.
- Remplacement autorisé seulement si aucune utilisation (`utilise = 0`).
- Idempotence : même clé + contenu → succès ; clé + contenu différent → conflit.
- Verrouillage : **demandeur** puis **note**.
- **Aucune** notification / push après choix.
- **Aucun** effet sur soldes ; lot 4 revérifiera les restants sans réduction silencieuse.
- Archive : résumé `modeReglement` + montants (sans IDs cibles ni libellés libres).
- Choix sans effet financier : notes `VALIDEE` protégées comme avant sans politique RGPD réelle.

### Parcours RGPD compte (hook)
- Branché dans `adminDeleteAdherent` → `completeDataDeletionRequest`.
- **Probe schéma hors TX** : `to_regclass('public.notes_frais')`.
- Tables absentes → `user.delete` seul. Tables présentes → prepare + `user.delete` **même TX**.
- Indépendant de `NOTES_FRAIS_ENABLED`.
- **Brouillons** : purge sans archive ; cancel MOVE + UNLINK ; outbox → `FAILED`.
- **SOUMISE|VALIDEE|REJETEE sans politique validée** : **refus explicite** (`NotesFraisRgpdBlockError`).
- **Avec politique injectée (tests) / future politique validée** : archivage privé atomique (statutFinal, montantAccepte, decideeAt — sans décideur).
- Échec → rollback total ; pas de `Completee` RGPD.

### Archive privée vs journal financier (lot 4.9)
- **Archive privée** (`NoteFraisArchive` + PJ) : consultation ADMIN|TRESOR|COMCPT ; purgeable ; **jamais** lue par la synthèse.
- **Journal financier détaché** : événements minimaux (REMBOURSEMENT_EXECUTE, COMPENSATION_EXECUTEE, CORRECTION_*, RESTITUTION) ; aucune FK identité/note/archive ; politique P3.
- **Reports de période** : consolidation atomique des événements expirés ; synthèse = live + journal + reports.
- PJ archive : pas de nom original en DTO ; download `justificatif-{rang}.{ext}`.
- Trois politiques P1/P2/P3 (allowlists vides) ; fail-closed selon besoin (PJ → P1, archive → P2, historique → P3).
- Décisions trésorier (durées, startsAt, periodeCle) **bloquent** migration/activation.

### Archive privée (livrée localement, **politique réelle non activée**)
- Tables : `notes_frais_archives`, `justificatifs_note_frais_archives`, `notes_frais_archive_access_logs`.
- Contenu structuré minimal + `statutFinal` / `montantAccepte` / `decideeAt` si décision.
- Résumé choix éventuel : `modeReglement` / montants remboursement & compensation — **sans** IDs de cibles ni libellés libres.
- **Pas** de libelle / description / id source / rattachement User|Adherent / décideur.
- **Ne pas qualifier d’anonyme** : date + montant potentiellement réidentifiables.
- Accès : comptes **Actif** `ADMIN|TRESOR|COMCPT` (rôle principal **ou** additionnel).

### Politique de conservation (ouverte)
- **P1** fichiers/PJ, **P2** archive privée, **P3** journal financier — distinctes.
- Durée et point de départ **à valider par le trésorier**.
- **Aucune durée réelle par défaut** ; aucune conservation détaillée indéfinie.
- Allowlists **vides** en production.
- Tests uniquement : `injectedRetention` / `injectedPolicies`.

### FK dans `schema.prisma` (pas encore migrées en base prod)
- Live : Restrict User/Adherent → Note ; acteurs audit **SetNull** (Depense.createdBy, executeurs, uploaders…).
- Avoir.adherentId **SetNull** (survie après delete adhérent).
- Archive / journal / reports : **aucune FK** vers le compte supprimé.
- Access log : `onDelete: SetNull` sur actor.

### Workers / fichiers
- Jobs MOVE/UNLINK durables ; outbox `SUBMITTED` / `DECIDED`.
- `processNoteFraisFileJobsOnce` tourne même si le flag métier est off (durabilité).
- Consolidation journal (`consolidateNoteFraisJournalFinancierOnce`) — indépendante de la purge archive.

## Tests PostgreSQL

Allowlist exclusive : `127.0.0.1:55432` / `amaki_notes_frais_test` / `amaki_test`.
Aucun fallback `DATABASE_URL`. Client Prisma injecté.

```bash
export TEST_DATABASE_URL='postgresql://amaki_test:…@127.0.0.1:55432/amaki_notes_frais_test?schema=public'
DATABASE_URL="$TEST_DATABASE_URL" npx prisma db push --accept-data-loss --skip-generate
TEST_DATABASE_URL=… NOTES_FRAIS_STORAGE_ROOT=/tmp/amaki-notes-frais-pg-test-storage \
  npx vitest run --no-file-parallelism \
    lib/services/frais-avances/rgpd-account-deletion.pg.integration.test.ts \
    lib/services/frais-avances/note-frais-archive.pg.integration.test.ts \
    lib/services/frais-avances/note-frais-decision.pg.integration.test.ts \
    lib/services/frais-avances/note-frais-choix-reglement.pg.integration.test.ts \
    lib/services/frais-avances/note-frais-compensation.pg.integration.test.ts \
    lib/services/frais-avances/note-frais-remboursement.pg.integration.test.ts \
    lib/services/frais-avances/note-frais-mixte.pg.integration.test.ts \
    lib/services/frais-avances/note-frais-correction.pg.integration.test.ts \
    lib/services/frais-avances/note-frais-restitution.pg.integration.test.ts \
    lib/services/frais-avances/note-frais-annulation.pg.integration.test.ts \
    lib/frais-avances/pg-test-allowlist.test.ts
```


## Non livré / futur
- Lot **4.9** archivage financier RGPD (journal + reports) — local, flag off.
- Migration dépôt versionnée (voir `MIGRATIONS-4x.md`) / activation après politiques trésorier (P1/P2/P3) — index partiels 4.8 inclus dans `notes_frais_4x_integrity`, non encore déployés en prod.
- Index partiel unique choix ACTIF.
- CHECK SQL polymorphes sur `notes_frais_reglement_lignes` et opérations MIXTE.
- API v1, mobile notes de frais.
- Validation trésorier de la durée / point de départ + activation politique env.
- Migration Prisma dépôt ; activation prod permanente.

## Variables

| Variable | Rôle |
|----------|------|
| `NOTES_FRAIS_ENABLED` | Module métier (pas la protection delete) |
| `NEXT_PUBLIC_NOTES_FRAIS_ENABLED` | Indice UI |
| `NOTES_FRAIS_STORAGE_ROOT` | Racine fichiers privés (incl. `archive/`) |
| `NOTES_FRAIS_SUBMITTED_JUSTIFICATIF_RETENTION` | Réservé ; **aucune valeur validée** |
| `TEST_DATABASE_URL` | PG test allowlistée uniquement |
