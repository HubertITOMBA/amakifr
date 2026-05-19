-- =============================================================================
-- SQL idempotent pour production — AUCUNE suppression de données
-- Applique manuellement les changements des migrations en attente si besoin,
-- puis marquer les migrations comme appliquées avec: prisma migrate resolve --applied
-- =============================================================================

-- ---------- 20260320103000_absenteisme_relances ----------
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

DO $$ BEGIN
  ALTER TABLE "relances_absenteisme"
    ADD CONSTRAINT "relances_absenteisme_adherentId_fkey"
    FOREIGN KEY ("adherentId") REFERENCES "adherent"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "relances_absenteisme"
    ADD CONSTRAINT "relances_absenteisme_createdBy_fkey"
    FOREIGN KEY ("createdBy") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------- 20260320114500_absenteisme_evenements_v2 ----------
ALTER TABLE "evenements"
  ADD COLUMN IF NOT EXISTS "obligatoireParticipation" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "inscriptions_evenements"
  ADD COLUMN IF NOT EXISTS "participationStatut" TEXT NOT NULL DEFAULT 'NonRenseigne';

ALTER TABLE "inscriptions_evenements"
  ADD COLUMN IF NOT EXISTS "justificatifFournit" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "inscriptions_evenements"
  ADD COLUMN IF NOT EXISTS "justificatifNote" TEXT;

-- ---------- 20260519120000_add_user_login_count ----------
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "loginCount" INTEGER NOT NULL DEFAULT 0;

UPDATE "users" u
SET "loginCount" = COALESCE(
  (
    SELECT COUNT(*)::int
    FROM "user_activities" ua
    WHERE ua."userId" = u.id
      AND ua.type = 'Connexion'
  ),
  0
)
WHERE "loginCount" = 0;
