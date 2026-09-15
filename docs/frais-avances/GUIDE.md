# Guide — Frais avancés

## Livré

### Socle étape 1
- Brouillon + `version` OCC ; PJ `PENDING|READY|FAILED` ; download READY authz ; DTO sans chemins.
- Soumission idempotente ; notifs + outbox ; workers singleton.
- Flag off par défaut ; `NEXT_PUBLIC_*` n’autorise pas le serveur.

### Parcours RGPD compte (hook)
- Branché dans `adminDeleteAdherent` → `completeDataDeletionRequest`.
- **Probe schéma hors TX** : `to_regclass('public.notes_frais')`.
- Tables absentes → `user.delete` seul. Tables présentes → prepare + `user.delete` **même TX**.
- Indépendant de `NOTES_FRAIS_ENABLED`.
- **Brouillons** : purge sans archive ; cancel MOVE + UNLINK ; outbox → `FAILED`.
- **SOUMISE sans politique validée** : **refus explicite** (`NotesFraisRgpdBlockError`) — aucun faux succès RGPD.
- **SOUMISE avec politique injectée (tests) / future politique validée** : archivage privé atomique dans la même TX.
- Échec → rollback total ; pas de `Completee` RGPD.

### Archive privée (livrée localement, **politique réelle non activée**)
- Tables : `notes_frais_archives`, `justificatifs_note_frais_archives`, `notes_frais_archive_access_logs`.
- Contenu structuré minimal : `dateDepense`, `montantDemande`, `soumiseAt`, `archivedAt`, `retentionEndsAt`, notice de réidentification.
- **Pas** de libelle / description / id source / rattachement User|Adherent.
- **Ne pas qualifier d’anonyme** : date + montant potentiellement réidentifiables.
- Justificatifs archive créés en **PENDING** ; passent **READY** après **MOVE** réel (job durable).
- Téléchargement **READY uniquement** ; DTO / API **sans chemins**.
- Accès : comptes **Actif** `ADMIN|TRESOR|COMCPT` (rôle principal **ou** additionnel). Aucun accès public.
- Journaux d’accès : `actorUserId` **SetNull** — ne bloque pas la suppression d’un administrateur.
- UI : `/admin/frais-avances/archives` (+ détail) ; lien depuis la liste des notes soumises.
- Distinguer des futures pièces comptables validées (`Depense` / règlements) — **hors périmètre**.

### Politique de conservation (ouverte)
- Durée et point de départ (**proposition** : `archivedAt`) **à valider par le trésorier**.
- **Aucune durée réelle par défaut** ; aucune conservation indéfinie implicite.
- Liste `VALIDATED_POLICIES` **vide** en production.
- Tests uniquement : `injectedRetention: { durationMs, startsAt: "archivedAt" }` passé au hook RGPD.

### FK dans `schema.prisma` (pas encore migrées en base prod)
- Live : Restrict User/Adherent → Note ; Restrict uploadedBy.
- Archive : **aucune FK** vers le compte supprimé ; jobs fichier sans FK User.
- Access log : `onDelete: SetNull` sur actor.

### Workers / fichiers
- Jobs MOVE/UNLINK durables (survivent au delete compte).
- Coordination MOVE vs UNLINK / purge (`move_aborted_unlink_pending`, cancel MOVE à la purge).
- `processNoteFraisFileJobsOnce` tourne même si le flag métier est off (durabilité).
- Purge : `processNoteFraisArchivePurgeOnce` (échéances `retentionEndsAt`).

### Sauvegardes
Les sauvegardes DB/FS qui incluent `notes_frais_archives` et le sous-arbre `archive/` contiennent des **données personnelles potentielles** — ne pas les traiter comme « anonymes ».

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
    lib/frais-avances/pg-test-allowlist.test.ts
```

(`--no-file-parallelism` évite la course avec le scénario DROP/restauration de schéma.)

Scénarios archive : refus sans politique ; archivage+MOVE→READY+download ; rollback ; droits COMCPT vs MEMBRE ; logs SetNull ; **purge pendant MOVE (source+cible absentes)** ; **ordres MOVE/UNLINK A (abort) et B (MOVE puis purge)** ; rôles additionnels ADMIN/TRESOR/COMCPT + refus inactif/SECRET/PRESID/MEMBRE ; download PENDING refusé.
Timeout 60 s **uniquement** pour les restaurations de schéma (`db push`) — pas de hausse globale Vitest.
Worker MOVE : re-vérifie lease PROCESSING + UNLINK avant/après FS — aucun fichier recréé après purge.

## Non livré / futur
- Décision financière, `Depense`, `Avoir`, API v1, mobile.
- Validation trésorier de la durée / point de départ + activation politique env.
- Migration Prisma / Restrict / activation prod.

## Variables

| Variable | Rôle |
|----------|------|
| `NOTES_FRAIS_ENABLED` | Module métier (pas la protection delete) |
| `NEXT_PUBLIC_NOTES_FRAIS_ENABLED` | Indice UI |
| `NOTES_FRAIS_STORAGE_ROOT` | Racine fichiers privés (incl. `archive/`) |
| `NOTES_FRAIS_SUBMITTED_JUSTIFICATIF_RETENTION` | Réservé ; **aucune valeur validée** |
| `TEST_DATABASE_URL` | PG test allowlistée uniquement |
