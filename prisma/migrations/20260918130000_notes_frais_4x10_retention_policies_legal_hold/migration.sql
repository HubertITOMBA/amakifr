-- Migration 4.10 : politiques de conservation versionnées + legal hold
-- Flags NOTES_FRAIS_* restent off. Aucune purge lancée. Seed ACTIVE uniquement.
-- Préflights : tables 4.9 présentes ; pas de backfill d'échéances inventées.

-- Préflight : archives / journal 4.9
DO $$
BEGIN
  IF to_regclass('public.notes_frais_archives') IS NULL THEN
    RAISE EXCEPTION 'PREFLIGHT 4.10: notes_frais_archives absente — appliquer d''abord les migrations 4.x';
  END IF;
  IF to_regclass('public.notes_frais_journal_financier_evenements') IS NULL THEN
    RAISE EXCEPTION 'PREFLIGHT 4.10: notes_frais_journal_financier_evenements absente';
  END IF;
END $$;

-- Enums
CREATE TYPE "NoteFraisRetentionPolicyStatut" AS ENUM ('BROUILLON', 'ACTIVE', 'REMPLACEE');
CREATE TYPE "NoteFraisLegalHoldStatut" AS ENUM ('ACTIF', 'LEVE');
CREATE TYPE "NoteFraisLegalHoldCibleType" AS ENUM ('ARCHIVE', 'JOURNAL_PERIODE');

-- Politiques versionnées
CREATE TABLE "notes_frais_retention_policy_versions" (
    "id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "statut" "NoteFraisRetentionPolicyStatut" NOT NULL DEFAULT 'BROUILLON',
    "p1Years" INTEGER NOT NULL,
    "p2Years" INTEGER NOT NULL,
    "p3Years" INTEGER NOT NULL,
    "exerciceClotureMois" INTEGER NOT NULL DEFAULT 12,
    "exerciceClotureJour" INTEGER NOT NULL DEFAULT 31,
    "reportsSansEcheance" BOOLEAN NOT NULL DEFAULT true,
    "motif" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "activatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activatedAt" TIMESTAMP(3),
    "effectiveAt" TIMESTAMP(3) NOT NULL,
    "activationIdempotencyKey" VARCHAR(64),
    "occVersion" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "notes_frais_retention_policy_versions_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "notes_frais_retention_policy_versions"
  ADD CONSTRAINT "notes_frais_retention_policy_versions_years_check"
  CHECK (
    "p1Years" >= 1 AND "p1Years" <= 50
    AND "p2Years" >= 1 AND "p2Years" <= 50
    AND "p3Years" >= 1 AND "p3Years" <= 50
  );

-- V1 : reports anonymes sans échéance obligatoire (pas de purge reports)
-- Nom court explicite (≤63) — éviter troncature PG NAMEDATALEN
ALTER TABLE "notes_frais_retention_policy_versions"
  ADD CONSTRAINT "nf_ret_pol_reports_sans_echeance_v1_chk"
  CHECK ("reportsSansEcheance" = true);

ALTER TABLE "notes_frais_retention_policy_versions"
  ADD CONSTRAINT "notes_frais_retention_policy_versions_cloture_mois_check"
  CHECK ("exerciceClotureMois" >= 1 AND "exerciceClotureMois" <= 12);

ALTER TABLE "notes_frais_retention_policy_versions"
  ADD CONSTRAINT "notes_frais_retention_policy_versions_cloture_jour_check"
  CHECK ("exerciceClotureJour" >= 1 AND "exerciceClotureJour" <= 31);

-- Clôture : jours valides par mois ; 29/02 explicitement autorisé (résolu en 28/02 hors bissextile)
ALTER TABLE "notes_frais_retention_policy_versions"
  ADD CONSTRAINT "notes_frais_retention_policy_versions_cloture_date_check"
  CHECK (
    CASE "exerciceClotureMois"
      WHEN 2 THEN "exerciceClotureJour" <= 29
      WHEN 4 THEN "exerciceClotureJour" <= 30
      WHEN 6 THEN "exerciceClotureJour" <= 30
      WHEN 9 THEN "exerciceClotureJour" <= 30
      WHEN 11 THEN "exerciceClotureJour" <= 30
      ELSE "exerciceClotureJour" <= 31
    END
  );

CREATE UNIQUE INDEX "notes_frais_retention_policy_versions_version_key"
  ON "notes_frais_retention_policy_versions"("version");

-- Nom court explicite (≤63) — aligné schema.prisma @unique(map: "nf_ret_pol_act_idem_uidx")
CREATE UNIQUE INDEX "nf_ret_pol_act_idem_uidx"
  ON "notes_frais_retention_policy_versions"("activationIdempotencyKey");

CREATE INDEX "notes_frais_retention_policy_versions_statut_idx"
  ON "notes_frais_retention_policy_versions"("statut");

CREATE INDEX "notes_frais_retention_policy_versions_effectiveAt_idx"
  ON "notes_frais_retention_policy_versions"("effectiveAt");

CREATE INDEX "notes_frais_retention_policy_versions_createdByUserId_idx"
  ON "notes_frais_retention_policy_versions"("createdByUserId");

CREATE INDEX "notes_frais_retention_policy_versions_activatedByUserId_idx"
  ON "notes_frais_retention_policy_versions"("activatedByUserId");

-- Une seule politique ACTIVE
CREATE UNIQUE INDEX "notes_frais_retention_policy_one_active"
  ON "notes_frais_retention_policy_versions"("statut")
  WHERE "statut" = 'ACTIVE';

ALTER TABLE "notes_frais_retention_policy_versions"
  ADD CONSTRAINT "notes_frais_retention_policy_versions_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "notes_frais_retention_policy_versions"
  ADD CONSTRAINT "notes_frais_retention_policy_versions_activatedByUserId_fkey"
  FOREIGN KEY ("activatedByUserId") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Snapshot colonnes archives (nullable — pas d'invention d'échéances historiques)
ALTER TABLE "notes_frais_archives"
  ADD COLUMN "policyVersionId" TEXT,
  ADD COLUMN "exerciceClotureAt" TIMESTAMP(3),
  ADD COLUMN "retentionEndsAtP1" TIMESTAMP(3);

CREATE INDEX "notes_frais_archives_retentionEndsAtP1_idx"
  ON "notes_frais_archives"("retentionEndsAtP1");

CREATE INDEX "notes_frais_archives_policyVersionId_idx"
  ON "notes_frais_archives"("policyVersionId");

ALTER TABLE "notes_frais_archives"
  ADD CONSTRAINT "notes_frais_archives_policyVersionId_fkey"
  FOREIGN KEY ("policyVersionId") REFERENCES "notes_frais_retention_policy_versions"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "justificatifs_note_frais_archives"
  ADD COLUMN "retentionEndsAtP1" TIMESTAMP(3);

CREATE INDEX "justificatifs_note_frais_archives_retentionEndsAtP1_idx"
  ON "justificatifs_note_frais_archives"("retentionEndsAtP1");

ALTER TABLE "notes_frais_journal_financier_evenements"
  ADD COLUMN "policyVersionId" TEXT,
  ADD COLUMN "exerciceClotureAt" TIMESTAMP(3);

CREATE INDEX "notes_frais_journal_financier_evenements_policyVersionId_idx"
  ON "notes_frais_journal_financier_evenements"("policyVersionId");

ALTER TABLE "notes_frais_journal_financier_evenements"
  ADD CONSTRAINT "notes_frais_journal_financier_evenements_policyVersionId_fkey"
  FOREIGN KEY ("policyVersionId") REFERENCES "notes_frais_retention_policy_versions"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Legal holds (append-only)
CREATE TABLE "notes_frais_legal_holds" (
    "id" TEXT NOT NULL,
    "cibleType" "NoteFraisLegalHoldCibleType" NOT NULL,
    "archiveId" TEXT,
    "periodeCle" VARCHAR(16),
    "statut" "NoteFraisLegalHoldStatut" NOT NULL DEFAULT 'ACTIF',
    "motif" TEXT NOT NULL,
    "referenceDossier" VARCHAR(120),
    "poseParUserId" TEXT,
    "leveParUserId" TEXT,
    "posedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leveAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notes_frais_legal_holds_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "notes_frais_legal_holds_cible_check" CHECK (
      (
        "cibleType" = 'ARCHIVE'
        AND "periodeCle" IS NULL
        AND (
          ("statut" = 'ACTIF' AND "archiveId" IS NOT NULL)
          OR ("statut" = 'LEVE')
        )
      )
      OR (
        "cibleType" = 'JOURNAL_PERIODE'
        AND "periodeCle" IS NOT NULL
        AND "archiveId" IS NULL
      )
    )
);

CREATE INDEX "notes_frais_legal_holds_statut_cibleType_idx"
  ON "notes_frais_legal_holds"("statut", "cibleType");

CREATE INDEX "notes_frais_legal_holds_archiveId_idx"
  ON "notes_frais_legal_holds"("archiveId");

CREATE INDEX "notes_frais_legal_holds_periodeCle_idx"
  ON "notes_frais_legal_holds"("periodeCle");

CREATE INDEX "notes_frais_legal_holds_expiresAt_idx"
  ON "notes_frais_legal_holds"("expiresAt");

CREATE INDEX "notes_frais_legal_holds_poseParUserId_idx"
  ON "notes_frais_legal_holds"("poseParUserId");

CREATE INDEX "notes_frais_legal_holds_leveParUserId_idx"
  ON "notes_frais_legal_holds"("leveParUserId");

-- Un hold ACTIF par archive
CREATE UNIQUE INDEX "notes_frais_legal_hold_one_active_archive"
  ON "notes_frais_legal_holds"("archiveId")
  WHERE "statut" = 'ACTIF' AND "cibleType" = 'ARCHIVE' AND "archiveId" IS NOT NULL;

-- Un hold ACTIF par période journal
CREATE UNIQUE INDEX "notes_frais_legal_hold_one_active_periode"
  ON "notes_frais_legal_holds"("periodeCle")
  WHERE "statut" = 'ACTIF' AND "cibleType" = 'JOURNAL_PERIODE' AND "periodeCle" IS NOT NULL;

ALTER TABLE "notes_frais_legal_holds"
  ADD CONSTRAINT "notes_frais_legal_holds_archiveId_fkey"
  FOREIGN KEY ("archiveId") REFERENCES "notes_frais_archives"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "notes_frais_legal_holds"
  ADD CONSTRAINT "notes_frais_legal_holds_poseParUserId_fkey"
  FOREIGN KEY ("poseParUserId") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "notes_frais_legal_holds"
  ADD CONSTRAINT "notes_frais_legal_holds_leveParUserId_fkey"
  FOREIGN KEY ("leveParUserId") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed politique initiale ACTIVE (P1=P2=P3=10 ans, clôture 31/12).
-- createdBy/activatedBy NULL — migration technique. N'active PAS le module.
INSERT INTO "notes_frais_retention_policy_versions" (
  "id",
  "version",
  "statut",
  "p1Years",
  "p2Years",
  "p3Years",
  "exerciceClotureMois",
  "exerciceClotureJour",
  "reportsSansEcheance",
  "motif",
  "createdByUserId",
  "activatedByUserId",
  "createdAt",
  "activatedAt",
  "effectiveAt",
  "activationIdempotencyKey",
  "occVersion"
) VALUES (
  'nf_ret_pol_v1_seed_4x10',
  1,
  'ACTIVE',
  10,
  10,
  10,
  12,
  31,
  true,
  'Migration 4.10 — politique initiale métier validée (P1/P2/P3 = 10 ans calendaires après clôture d''exercice ; clôture 31/12 ; reports anonymes sans échéance). Seed technique sans acteur. N''active pas le module notes-de-frais.',
  NULL,
  NULL,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  TIMESTAMP '2026-09-18 00:00:00',
  'seed-4x10-retention-v1',
  1
);
