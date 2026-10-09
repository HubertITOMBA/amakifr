-- M2-C : statut de publication des rapports de réunion (DRAFT / PUBLISHED).
-- Backfill : toutes les lignes existantes → PUBLISHED (visibilité historique).
-- Nouvelles lignes : défaut DRAFT. Aucun DELETE, aucun contenu HTML modifié.
-- Transaction atomique BEGIN/COMMIT. Migration créée pour revue — ne pas appliquer dans le lot M2-C code.

BEGIN;

-- 1. Précondition : table attendue
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'rapports_reunion'
  ) THEN
    RAISE EXCEPTION
      'rapport_reunion_publication_status aborted: table rapports_reunion missing';
  END IF;
END $$;

-- 2. Enum SQL (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'RapportReunionStatut'
  ) THEN
    CREATE TYPE "RapportReunionStatut" AS ENUM ('DRAFT', 'PUBLISHED');
  END IF;
END $$;

-- 3. Colonnes nullable le temps du backfill
ALTER TABLE "rapports_reunion"
  ADD COLUMN IF NOT EXISTS "statut" "RapportReunionStatut",
  ADD COLUMN IF NOT EXISTS "publishedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "publishedBy" TEXT;

-- 4. Backfill historique AVANT contraintes finales :
--    existants → PUBLISHED ; publishedAt = updatedAt sinon createdAt
UPDATE "rapports_reunion"
SET
  "statut" = 'PUBLISHED'::"RapportReunionStatut",
  "publishedAt" = COALESCE("publishedAt", "updatedAt", "createdAt")
WHERE "statut" IS NULL;

-- 5. Contraintes / défaut DRAFT pour les nouvelles créations
ALTER TABLE "rapports_reunion" ALTER COLUMN "statut" SET NOT NULL;
ALTER TABLE "rapports_reunion"
  ALTER COLUMN "statut" SET DEFAULT 'DRAFT'::"RapportReunionStatut";

-- 6. FK publisher (optionnelle)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'rapports_reunion_publishedBy_fkey'
  ) THEN
    ALTER TABLE "rapports_reunion"
      ADD CONSTRAINT "rapports_reunion_publishedBy_fkey"
      FOREIGN KEY ("publishedBy") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- 7. Indexes utiles
CREATE INDEX IF NOT EXISTS "rapports_reunion_statut_idx"
  ON "rapports_reunion"("statut");
CREATE INDEX IF NOT EXISTS "rapports_reunion_publishedAt_idx"
  ON "rapports_reunion"("publishedAt");

-- 8. CHECK défensif après backfill :
--    PUBLISHED ⇒ publishedAt NOT NULL (publishedBy reste nullable pour l’historique)
--    DRAFT ⇒ publishedAt IS NULL AND publishedBy IS NULL
ALTER TABLE "rapports_reunion"
  DROP CONSTRAINT IF EXISTS "rapports_reunion_statut_published_consistency_check";
ALTER TABLE "rapports_reunion"
  ADD CONSTRAINT "rapports_reunion_statut_published_consistency_check"
  CHECK (
    (
      "statut" = 'PUBLISHED'::"RapportReunionStatut"
      AND "publishedAt" IS NOT NULL
    )
    OR (
      "statut" = 'DRAFT'::"RapportReunionStatut"
      AND "publishedAt" IS NULL
      AND "publishedBy" IS NULL
    )
  );

COMMIT;
