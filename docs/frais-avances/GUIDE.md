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
- Atomique dans la TX : note + journal + notification demandeur + outbox `DECIDED`.
- Verrouillage : **demandeur** puis **note** (même ordre que RGPD).
- Idempotence : même clé + même contenu → succès sans doublon ; même clé + contenu différent → conflit.
- Note `REJETEE` immuable ; `createCorrectedNoteFraisDraft` (même propriétaire, `corrigeNoteFraisId`).
- Lien de correction : `onDelete: SetNull` — compatible archivage RGPD de la note d’origine.
- **Pas** de `dateReconnaissanceCharge` ; validation ≠ écriture comptable ≠ décaissement.
- **Pas** de `Depense` / Avoir / remboursement.

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

### Archive privée (livrée localement, **politique réelle non activée**)
- Tables : `notes_frais_archives`, `justificatifs_note_frais_archives`, `notes_frais_archive_access_logs`.
- Contenu structuré minimal + `statutFinal` / `montantAccepte` / `decideeAt` si décision.
- Résumé choix éventuel : `modeReglement` / montants remboursement & compensation — **sans** IDs de cibles ni libellés libres.
- **Pas** de libelle / description / id source / rattachement User|Adherent / décideur.
- **Ne pas qualifier d’anonyme** : date + montant potentiellement réidentifiables ; le **`nomFichierOrig`** des justificatifs archivés reste une donnée **potentiellement personnelle** (nom de fichier choisi par l’adhérent).
- Accès : comptes **Actif** `ADMIN|TRESOR|COMCPT` (rôle principal **ou** additionnel).
- Distinguer des futures pièces comptables validées (`Depense` / règlements) — **hors périmètre**.

### Politique de conservation (ouverte)
- Durée et point de départ (**proposition** : `archivedAt`) **à valider par le trésorier**.
- **Aucune durée réelle par défaut** ; aucune conservation indéfinie implicite.
- Liste `VALIDATED_POLICIES` **vide** en production.
- Tests uniquement : `injectedRetention: { durationMs, startsAt: "archivedAt" }`.

### FK dans `schema.prisma` (pas encore migrées en base prod)
- Live : Restrict User/Adherent → Note ; Restrict uploadedBy ; decideur **SetNull** ; correction **SetNull**.
- Archive : **aucune FK** vers le compte supprimé.
- Access log : `onDelete: SetNull` sur actor.

### Workers / fichiers
- Jobs MOVE/UNLINK durables ; outbox `SUBMITTED` / `DECIDED`.
- `processNoteFraisFileJobsOnce` tourne même si le flag métier est off (durabilité).

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
    lib/frais-avances/pg-test-allowlist.test.ts
```

## Non livré / futur
- Exécution du règlement (lot 4) : Avoir / UtilisationAvoir / remboursement effectif.
- `Depense`, synthèse financière, `dateReconnaissanceCharge`.
- Index partiel unique choix ACTIF.
- API v1, mobile.
- Validation trésorier de la durée / point de départ + activation politique env.
- Migration Prisma / activation prod.

## Variables

| Variable | Rôle |
|----------|------|
| `NOTES_FRAIS_ENABLED` | Module métier (pas la protection delete) |
| `NEXT_PUBLIC_NOTES_FRAIS_ENABLED` | Indice UI |
| `NOTES_FRAIS_STORAGE_ROOT` | Racine fichiers privés (incl. `archive/`) |
| `NOTES_FRAIS_SUBMITTED_JUSTIFICATIF_RETENTION` | Réservé ; **aucune valeur validée** |
| `TEST_DATABASE_URL` | PG test allowlistée uniquement |
