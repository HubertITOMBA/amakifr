# Migrations Prisma notes de frais 4.0–4.9

**État** : migrations **versionnées en dépôt**, **non appliquées en production**.
**Flags** : `NOTES_FRAIS_ENABLED` / `NEXT_PUBLIC_NOTES_FRAIS_ENABLED` restent off.
**Politiques P1/P2/P3** : allowlists **vides** — bloquent l’activation RGPD réelle (injections tests uniquement).

## `db push` (tests) ≠ `migrate deploy` (déploiement)

| Outil | Usage autorisé |
|-------|----------------|
| `prisma db push` | Bases de **test PG locales allowlistées** uniquement (ex. suite `.pg.integration.test.ts`) — **jamais** une preuve de déploiement ni la prod |
| `prisma migrate deploy` | Appliquer les dossiers versionnés sous `prisma/migrations/` (staging/prod après sauvegarde) |

## Migrations

| Dossier | Rôle |
|---------|------|
| `20260918120000_notes_frais_4x_foundation` | Enums, tables 4.0–4.9, colonnes additives, FK SetNull/Restrict, index/uniques Prisma |
| `20260918120100_notes_frais_4x_backfill_seed` | Backfill `origine`, `NOT NULL`, seed idempotent `TypeDepense.code=FRAIS_AVANCE` (`createdBy=NULL`) |
| `20260918120200_notes_frais_4x_integrity` | Index partiels ACTIF/DEMANDEE + CHECK XOR documentés |

`DetteInitiale.montantRestant` GENERATED : **non touché** (migration `20260301120000` déjà présente).

## Objets SQL manuels (intégrité)

Hors modèle Prisma (non exprimables en `schema.prisma`) — **obligatoires avant activation** :

- `notes_frais_choix_reglement_actif_uidx`
- `notes_frais_annul_demande_reglement_demandee_uidx`
- `notes_frais_annul_demande_operation_demandee_uidx`
- `notes_frais_reglement_lignes_xor_cible_chk`
- `notes_frais_reglements_idempotency_xor_chk`
- `notes_frais_annul_demande_xor_cible_chk`

## Triggers différés reportés

Non créés dans cette livraison :

- cohérence enfants MIXTE (1 COMPENSATION + 1 REMBOURSEMENT)
- cohérence corrections / Σ inverses

Gardes : transactions applicatives + tests PG. Préflight MIXTE incomplet échoue si données invalides.

## Runbook de déploiement (ordre strict)

1. **Sauvegarde** base cible.
2. **Préflights** SELECT d’intégrité (doublons ACTIF/DEMANDEE, XOR, `FRAIS_AVANCE`, etc.).
3. **`prisma migrate deploy`** (jamais `db push` en prod).
4. **Contrôles SQL** post-migrate (seed `FRAIS_AVANCE`, index partiels, CHECK, FK SetNull/Restrict, GENERATED dettes).
5. **Déploiement code** (HEAD avec feature flags encore **off**).
6. **Seed menus** (`scripts/seed-menus.ts` / upsert menus frais-avances).
7. **Smoke test flag off** (routes indisponibles, pas d’écriture métier notes).
8. **Validation politiques P1/P2/P3** (allowlists encore vides → activation **refusée** tant qu’elles le restent).
9. **Activation progressive** des flags uniquement après décisions trésorier/juridique.

## Drift Prisma (preuve locale, 2026-09-18)

Identité contrôlée avant écriture shadow : `amaki_migrate_4x_empty` / `amaki_test` / `127.0.0.1:55432` (conteneur `inet_server_port=5432`).
Shadow jetable : `amaki_migrate_4x_shadow` (même hôte/port allowlistés).

### Commande reproductible (sans mot de passe en clair dans la doc)

```bash
export DATABASE_URL='postgresql://USER:PASS@127.0.0.1:55432/amaki_migrate_4x_empty'
export SHADOW_DATABASE_URL='postgresql://USER:PASS@127.0.0.1:55432/amaki_migrate_4x_shadow'

# Afficher l’identité DB avant toute écriture (psql)
# SELECT current_database(), current_user, inet_server_addr(), inet_server_port();

npx prisma migrate status

npx prisma migrate diff \
  --from-migrations prisma/migrations \
  --to-schema-datamodel prisma/schema.prisma \
  --shadow-database-url "$SHADOW_DATABASE_URL" \
  --script
```

### `migrate status` observé

```
Datasource "db": PostgreSQL database "amaki_migrate_4x_empty", schema "public" at "127.0.0.1:55432"
45 migrations found in prisma/migrations
Database schema is up to date!
```

### `migrate diff` observé (sortie exacte du script)

```sql
-- AlterTable
ALTER TABLE "dettes_initiales" ALTER COLUMN "montantRestant" SET NOT NULL;

-- RenameIndex
ALTER INDEX "pass_assistance_type_unique" RENAME TO "pass_assistance_typeCotisationId_key";
```

### Classification du diff

| Écart | Classification |
|-------|----------------|
| Les **six** index partiels / CHECK manuels 4.x | **Non proposés** par ce sens de diff (limitation Prisma : SQL manuel hors datamodel). Présence vérifiée séparément via `pg_indexes` / `pg_constraint` sur la base migrée — **intentionnels / hors schéma**. |
| `dettes_initiales.montantRestant SET NOT NULL` | **Drift réel préexistant** (hors lot 4.x). Colonne déjà `GENERATED ALWAYS … STORED` (donc NOT NULL en pratique). Ne pas recréer le GENERATED. Hors périmètre correction 4.x. |
| `pass_assistance_type_unique` → `pass_assistance_typeCotisationId_key` | **Drift réel préexistant** (hors lot 4.x) : nom d’unique historique vs convention Prisma. Hors périmètre correction 4.x. |

Aucun autre `CREATE`/`DROP`/`ALTER` lié aux tables notes-de-frais 4.x dans ce diff.

### Écarts intentionnels 4.x (vérifiés en SQL, pas via le diff vide)

Sur `amaki_migrate_4x_empty` après les 45 migrations, présents :

1. `notes_frais_choix_reglement_actif_uidx`
2. `notes_frais_annul_demande_reglement_demandee_uidx`
3. `notes_frais_annul_demande_operation_demandee_uidx`
4. `notes_frais_reglement_lignes_xor_cible_chk`
5. `notes_frais_reglements_idempotency_xor_chk`
6. `notes_frais_annul_demande_xor_cible_chk`

## Script de vérification locale

`scripts/frais-avances-migrate-4x-verify.sh` reste **hors staging / non versionné** tant que `host=127.0.0.1` et `port=55432` ne sont pas imposés **avant** tout `DROP DATABASE`.
