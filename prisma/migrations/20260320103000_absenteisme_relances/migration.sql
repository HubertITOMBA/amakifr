-- Absenteisme: justificatifs sur participation réunion + historique des relances d'absentéisme

ALTER TABLE "participations_reunion"
  ADD COLUMN IF NOT EXISTS "justificatifFournit" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "participations_reunion"
  ADD COLUMN IF NOT EXISTS "justificatifNote" TEXT;

CREATE TABLE IF NOT EXISTS "relances_absenteisme" (
  "id" TEXT NOT NULL,
  "adherentId" TEXT NOT NULL,
  "motif" VARCHAR(255) NOT NULL,
  "totalAbsences" INTEGER NOT NULL DEFAULT 0,
  "absencesConsecutives" INTEGER NOT NULL DEFAULT 0,
  "contenu" TEXT,
  "dateEnvoi" TIMESTAMP(3),
  "statut" TEXT NOT NULL DEFAULT 'EnAttente',
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "relances_absenteisme_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "relances_absenteisme_adherentId_idx" ON "relances_absenteisme"("adherentId");
CREATE INDEX IF NOT EXISTS "relances_absenteisme_createdAt_idx" ON "relances_absenteisme"("createdAt");

ALTER TABLE "relances_absenteisme"
  ADD CONSTRAINT "relances_absenteisme_adherentId_fkey"
  FOREIGN KEY ("adherentId") REFERENCES "adherent"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "relances_absenteisme"
  ADD CONSTRAINT "relances_absenteisme_createdBy_fkey"
  FOREIGN KEY ("createdBy") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
