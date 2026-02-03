-- Drop unique on type (index from initial migration)
DROP INDEX IF EXISTS "pass_assistance_type_key";
ALTER TABLE "pass_assistance" DROP CONSTRAINT IF EXISTS "pass_assistance_type_unique";

-- Rename column typeCotisationMensuelleId -> typeCotisationId (idempotent)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'pass_assistance' AND column_name = 'typeCotisationMensuelleId') THEN
    ALTER TABLE "pass_assistance" RENAME COLUMN "typeCotisationMensuelleId" TO "typeCotisationId";
  END IF;
END $$;

-- Drop column type (idempotent)
ALTER TABLE "pass_assistance" DROP COLUMN IF EXISTS "type";

-- Garder une seule ligne par typeCotisationId (après 20260202120000 toutes peuvent avoir le même type)
DELETE FROM "pass_assistance" a
USING "pass_assistance" b
WHERE a."typeCotisationId" = b."typeCotisationId" AND a.id > b.id;

-- Add unique on typeCotisationId (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pass_assistance_type_unique') THEN
    ALTER TABLE "pass_assistance" ADD CONSTRAINT "pass_assistance_type_unique" UNIQUE ("typeCotisationId");
  END IF;
END $$;

-- Update FK constraint name if needed (PostgreSQL keeps the same reference)
ALTER TABLE "pass_assistance" DROP CONSTRAINT IF EXISTS "pass_assistance_typeCotisationMensuelleId_fkey";
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pass_assistance_typeCotisationId_fkey') THEN
    ALTER TABLE "pass_assistance" ADD CONSTRAINT "pass_assistance_typeCotisationId_fkey" FOREIGN KEY ("typeCotisationId") REFERENCES "types_cotisation_mensuelle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- Assistances: add typeCotisationId (nullable) pour lien vers PassAssistance
ALTER TABLE "assistances" ADD COLUMN IF NOT EXISTS "typeCotisationId" TEXT;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'assistances_typeCotisationId_fkey') THEN
    ALTER TABLE "assistances" ADD CONSTRAINT "assistances_typeCotisationId_fkey" FOREIGN KEY ("typeCotisationId") REFERENCES "types_cotisation_mensuelle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
