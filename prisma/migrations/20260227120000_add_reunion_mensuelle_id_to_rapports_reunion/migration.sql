-- AlterTable: ajouter la colonne reunionMensuelleId à rapports_reunion (lien optionnel vers la réunion mensuelle)
-- Production-safe : colonne nullable, les rapports existants conservent reunionMensuelleId = NULL (aucune donnée modifiée).
ALTER TABLE "rapports_reunion" ADD COLUMN IF NOT EXISTS "reunionMensuelleId" TEXT;

-- CreateIndex: contrainte unique (une réunion mensuelle ne peut avoir qu'un seul rapport)
CREATE UNIQUE INDEX IF NOT EXISTS "rapports_reunion_reunionMensuelleId_key" ON "rapports_reunion"("reunionMensuelleId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "rapports_reunion_reunionMensuelleId_idx" ON "rapports_reunion"("reunionMensuelleId");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'rapports_reunion_reunionMensuelleId_fkey'
  ) THEN
    ALTER TABLE "rapports_reunion" ADD CONSTRAINT "rapports_reunion_reunionMensuelleId_fkey"
      FOREIGN KEY ("reunionMensuelleId") REFERENCES "reunions_mensuelles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
