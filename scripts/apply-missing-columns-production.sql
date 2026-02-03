-- =============================================================================
-- Script à exécuter sur la base PRODUCTION pour ajouter les colonnes manquantes
-- (après baseline des migrations sans exécution du SQL).
--
-- Colonnes ajoutées :
--   - cotisations_mensuelles.adherentBeneficiaireId
--   - assistances.typeCotisationId
--
-- Usage (depuis la machine qui a accès à la BDD production) :
--   psql "$DATABASE_URL" -f scripts/apply-missing-columns-production.sql
-- ou avec fichier .env :
--   source .env.production && psql "$DATABASE_URL" -f scripts/apply-missing-columns-production.sql
-- =============================================================================

-- 1) cotisations_mensuelles.adherentBeneficiaireId
ALTER TABLE "cotisations_mensuelles" ADD COLUMN IF NOT EXISTS "adherentBeneficiaireId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cotisations_mensuelles_adherentBeneficiaireId_fkey') THEN
    ALTER TABLE "cotisations_mensuelles"
    ADD CONSTRAINT "cotisations_mensuelles_adherentBeneficiaireId_fkey"
    FOREIGN KEY ("adherentBeneficiaireId") REFERENCES "adherent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- 2) assistances.typeCotisationId
ALTER TABLE "assistances" ADD COLUMN IF NOT EXISTS "typeCotisationId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'assistances_typeCotisationId_fkey') THEN
    ALTER TABLE "assistances"
    ADD CONSTRAINT "assistances_typeCotisationId_fkey"
    FOREIGN KEY ("typeCotisationId") REFERENCES "types_cotisation_mensuelle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
