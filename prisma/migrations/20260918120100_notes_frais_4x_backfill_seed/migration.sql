-- Migration B: notes_frais_4x_backfill_seed
-- Backfill origines historiques, NOT NULL, seed idempotent TypeDepense FRAIS_AVANCE.
-- createdBy = NULL (colonne déjà nullable). Aucun utilisateur arbitraire.
-- Ne corrige/supprime aucune donnée métier automatiquement.

-- Preflight: colonne origine présente (migration A requise)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'depenses' AND column_name = 'origine'
  ) THEN
    RAISE EXCEPTION 'PREFLIGHT FAIL notes_frais_4x_backfill_seed: colonne depenses.origine absente — appliquer notes_frais_4x_foundation d''abord';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'avoirs' AND column_name = 'origine'
  ) THEN
    RAISE EXCEPTION 'PREFLIGHT FAIL notes_frais_4x_backfill_seed: colonne avoirs.origine absente — appliquer notes_frais_4x_foundation d''abord';
  END IF;
END $$;

-- Backfill explicite (idempotent)
UPDATE "depenses" SET "origine" = 'ORDINAIRE' WHERE "origine" IS NULL;
UPDATE "avoirs" SET "origine" = 'EXCEDENT_PAIEMENT' WHERE "origine" IS NULL;

-- Preflight: plus aucun NULL avant NOT NULL
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "depenses" WHERE "origine" IS NULL) THEN
    RAISE EXCEPTION 'PREFLIGHT FAIL notes_frais_4x_backfill_seed: depenses.origine encore NULL après backfill';
  END IF;
  IF EXISTS (SELECT 1 FROM "avoirs" WHERE "origine" IS NULL) THEN
    RAISE EXCEPTION 'PREFLIGHT FAIL notes_frais_4x_backfill_seed: avoirs.origine encore NULL après backfill';
  END IF;
END $$;

ALTER TABLE "depenses" ALTER COLUMN "origine" SET NOT NULL;
ALTER TABLE "depenses" ALTER COLUMN "origine" SET DEFAULT 'ORDINAIRE';
ALTER TABLE "avoirs" ALTER COLUMN "origine" SET NOT NULL;
ALTER TABLE "avoirs" ALTER COLUMN "origine" SET DEFAULT 'EXCEDENT_PAIEMENT';

-- Seed TypeDepense FRAIS_AVANCE (idempotent, sans utilisateur arbitraire)
DO $$
DECLARE
  n_code integer;
  n_actif integer;
  existing_titre text;
  existing_actif boolean;
BEGIN
  SELECT COUNT(*) INTO n_code FROM "types_depense" WHERE code = 'FRAIS_AVANCE';

  IF n_code > 1 THEN
    RAISE EXCEPTION 'PREFLIGHT FAIL notes_frais_4x_backfill_seed: plusieurs types_depense.code=FRAIS_AVANCE (%) — corriger manuellement', n_code;
  END IF;

  IF n_code = 1 THEN
    SELECT titre, actif INTO existing_titre, existing_actif
    FROM "types_depense" WHERE code = 'FRAIS_AVANCE';

    IF existing_actif IS NOT TRUE THEN
      RAISE EXCEPTION 'PREFLIGHT FAIL notes_frais_4x_backfill_seed: TypeDepense FRAIS_AVANCE existant mais inactif (titre=%) — réactivation manuelle requise, pas d''écrasement silencieux', existing_titre;
    END IF;
    -- Conforme : unique + actif — ne pas modifier
    RAISE NOTICE 'notes_frais_4x_backfill_seed: TypeDepense FRAIS_AVANCE déjà présent et actif (titre=%)', existing_titre;
  ELSE
    INSERT INTO "types_depense" (
      "id", "titre", "description", "code", "actif", "createdBy", "createdAt", "updatedAt"
    ) VALUES (
      'td_frais_avance_migration_seed',
      'Frais avancés',
      'Type technique notes de frais (seed migration 4.x)',
      'FRAIS_AVANCE',
      true,
      NULL,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    );
    RAISE NOTICE 'notes_frais_4x_backfill_seed: TypeDepense FRAIS_AVANCE créé (createdBy=NULL)';
  END IF;

  SELECT COUNT(*) FILTER (WHERE code = 'FRAIS_AVANCE' AND actif) INTO n_actif FROM "types_depense";
  IF n_actif <> 1 THEN
    RAISE EXCEPTION 'PREFLIGHT FAIL notes_frais_4x_backfill_seed: attendu exactement 1 FRAIS_AVANCE actif, trouvé %', n_actif;
  END IF;
END $$;
