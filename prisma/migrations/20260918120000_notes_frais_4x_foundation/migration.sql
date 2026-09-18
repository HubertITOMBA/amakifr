-- Migration A: notes_frais_4x_foundation
-- Lots frais-avances 4.0–4.9 — enums, tables, colonnes additives, FK SetNull/Restrict,
-- index/uniques Prisma. Ne recrée PAS dettes_initiales.montantRestant (GENERATED déjà présent).
-- Origine Depense/Avoir : colonnes nullable + DEFAULT ici ; NOT NULL après backfill (migration B).
-- Index partiels / CHECK XOR : migration C.
-- DROP CONSTRAINT ci-dessous : uniquement pour recreer les FK Cascade → SetNull (RGPD 4.9).

-- CreateEnum
CREATE TYPE "OrigineDepense" AS ENUM ('ORDINAIRE', 'FRAIS_AVANCE');

-- CreateEnum
CREATE TYPE "OrigineAvoir" AS ENUM ('EXCEDENT_PAIEMENT', 'COMPENSATION_NOTE_FRAIS');

-- CreateEnum
CREATE TYPE "StatutNoteFrais" AS ENUM ('BROUILLON', 'SOUMISE', 'VALIDEE', 'REJETEE');

-- CreateEnum
CREATE TYPE "StatutJustificatifNoteFrais" AS ENUM ('PENDING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "StatutNoteFraisOutbox" AS ENUM ('PENDING', 'PROCESSING', 'DONE', 'FAILED');

-- CreateEnum
CREATE TYPE "StatutNoteFraisFileJob" AS ENUM ('PENDING', 'PROCESSING', 'DONE', 'FAILED');

-- CreateEnum
CREATE TYPE "NoteFraisFileJobOperation" AS ENUM ('MOVE', 'UNLINK');

-- CreateEnum
CREATE TYPE "ModeReglementNoteFrais" AS ENUM ('REMBOURSEMENT', 'COMPENSATION', 'MIXTE');

-- CreateEnum
CREATE TYPE "StatutChoixReglementNoteFrais" AS ENUM ('ACTIF', 'REMPLACE');

-- CreateEnum
CREATE TYPE "TypeCibleCompensationNoteFrais" AS ENUM ('COTISATION_MENSUELLE', 'DETTE_INITIALE');

-- CreateEnum
CREATE TYPE "TypeNoteFraisReglement" AS ENUM ('COMPENSATION', 'REMBOURSEMENT');

-- CreateEnum
CREATE TYPE "StatutNoteFraisReglement" AS ENUM ('EXECUTE', 'ANNULE');

-- CreateEnum
CREATE TYPE "TypeLigneNoteFraisReglement" AS ENUM ('COMPENSATION', 'REMBOURSEMENT');

-- CreateEnum
CREATE TYPE "MoyenReglementNoteFrais" AS ENUM ('VIREMENT', 'ESPECES');

-- CreateEnum
CREATE TYPE "TypeNoteFraisReglementOperation" AS ENUM ('MIXTE');

-- CreateEnum
CREATE TYPE "StatutNoteFraisReglementOperation" AS ENUM ('EXECUTE', 'ANNULEE');

-- CreateEnum
CREATE TYPE "TypeNoteFraisReglementCorrection" AS ENUM ('REFERENCE', 'MONTANT_NEGATIF');

-- CreateEnum
CREATE TYPE "PreuveCorrectionNoteFrais" AS ENUM ('PV_TRESORERIE', 'JUSTIFICATIF_INTERNE', 'EMAIL_TRACE', 'AUTRE_TRACE');

-- CreateEnum
CREATE TYPE "StatutDemandeAnnulationReglement" AS ENUM ('DEMANDEE', 'CONFIRMEE', 'REFUSEE', 'EXPIREE');

-- CreateEnum
CREATE TYPE "PreuveAnnulationReglement" AS ENUM ('REJET_BANQUE', 'ANNULATION_VIREMENT', 'RECU_CAISSE_ANNULE', 'TRACE_ETABLISSEMENT', 'PV_TRESORERIE', 'JUSTIFICATIF_INTERNE', 'AUTRE_TRACE');

-- CreateEnum
CREATE TYPE "KindNoteFraisJournalFinancier" AS ENUM ('REMBOURSEMENT_EXECUTE', 'COMPENSATION_EXECUTEE', 'CORRECTION_REMBOURSEMENT', 'CORRECTION_COMPENSATION', 'RESTITUTION');

-- DropForeignKey (recreate ON DELETE SET NULL — RGPD 4.9)
ALTER TABLE "types_depense" DROP CONSTRAINT "types_depense_createdBy_fkey";

-- DropForeignKey (recreate ON DELETE SET NULL — RGPD 4.9)
ALTER TABLE "depenses" DROP CONSTRAINT "depenses_createdBy_fkey";

-- DropForeignKey (recreate ON DELETE SET NULL — RGPD 4.9)
ALTER TABLE "justificatifs_depense" DROP CONSTRAINT "justificatifs_depense_uploadedBy_fkey";

-- DropForeignKey (recreate ON DELETE SET NULL — RGPD 4.9)
ALTER TABLE "avoirs" DROP CONSTRAINT "avoirs_adherentId_fkey";

-- AlterTable
ALTER TABLE "types_depense" ADD COLUMN     "code" VARCHAR(32),
ALTER COLUMN "createdBy" DROP NOT NULL;

-- AlterTable
ALTER TABLE "depenses" ADD COLUMN     "noteFraisId" TEXT,
ADD COLUMN     "origine" "OrigineDepense" DEFAULT 'ORDINAIRE',
ALTER COLUMN "createdBy" DROP NOT NULL;

-- AlterTable
ALTER TABLE "justificatifs_depense" ALTER COLUMN "uploadedBy" DROP NOT NULL;

-- AlterTable
ALTER TABLE "avoirs" ADD COLUMN     "noteFraisReglementLigneId" TEXT,
ADD COLUMN     "origine" "OrigineAvoir" DEFAULT 'EXCEDENT_PAIEMENT',
ALTER COLUMN "adherentId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "utilisations_avoir" ADD COLUMN     "noteFraisReglementLigneId" TEXT;

-- CreateTable
CREATE TABLE "notes_frais" (
    "id" TEXT NOT NULL,
    "adherentId" TEXT NOT NULL,
    "demandeurUserId" TEXT NOT NULL,
    "libelle" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "dateDepense" TIMESTAMP(3) NOT NULL,
    "montantDemande" DECIMAL(10,2) NOT NULL,
    "statut" "StatutNoteFrais" NOT NULL DEFAULT 'BROUILLON',
    "soumiseAt" TIMESTAMP(3),
    "submitIdempotencyKey" VARCHAR(64),
    "version" INTEGER NOT NULL DEFAULT 1,
    "alerteSansDestinataire" BOOLEAN NOT NULL DEFAULT false,
    "alerteSansDestinataireAt" TIMESTAMP(3),
    "montantAccepte" DECIMAL(10,2),
    "motifDecision" TEXT,
    "decideeAt" TIMESTAMP(3),
    "decideurUserId" TEXT,
    "decisionIdempotencyKey" VARCHAR(64),
    "corrigeNoteFraisId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notes_frais_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notes_frais_decisions" (
    "id" TEXT NOT NULL,
    "noteFraisId" TEXT NOT NULL,
    "decisionIdempotencyKey" VARCHAR(64) NOT NULL,
    "statutFinal" "StatutNoteFrais" NOT NULL,
    "montantDemande" DECIMAL(10,2) NOT NULL,
    "montantAccepte" DECIMAL(10,2),
    "motif" TEXT,
    "decideurUserId" TEXT,
    "decideeAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notes_frais_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notes_frais_choix_reglement" (
    "id" TEXT NOT NULL,
    "noteFraisId" TEXT NOT NULL,
    "mode" "ModeReglementNoteFrais" NOT NULL,
    "statut" "StatutChoixReglementNoteFrais" NOT NULL DEFAULT 'ACTIF',
    "montantReference" DECIMAL(10,2) NOT NULL,
    "montantRemboursement" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "montantCompensation" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "montantRembourseUtilise" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "montantCompensationUtilise" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "remplaceChoixId" TEXT,
    "idempotencyKey" VARCHAR(64) NOT NULL,
    "choisiAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notes_frais_choix_reglement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notes_frais_choix_reglement_cibles" (
    "id" TEXT NOT NULL,
    "choixId" TEXT NOT NULL,
    "typeCible" "TypeCibleCompensationNoteFrais" NOT NULL,
    "cibleId" TEXT NOT NULL,
    "montantAutorise" DECIMAL(10,2) NOT NULL,
    "montantUtilise" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "montantRestantSnapshot" DECIMAL(10,2) NOT NULL,
    "libelleSnapshot" VARCHAR(120),
    "rang" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notes_frais_choix_reglement_cibles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notes_frais_reglement_operations" (
    "id" TEXT NOT NULL,
    "noteFraisId" TEXT NOT NULL,
    "choixId" TEXT NOT NULL,
    "type" "TypeNoteFraisReglementOperation" NOT NULL DEFAULT 'MIXTE',
    "statut" "StatutNoteFraisReglementOperation" NOT NULL DEFAULT 'EXECUTE',
    "idempotencyKey" VARCHAR(64) NOT NULL,
    "executeurUserId" TEXT,
    "executeAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notes_frais_reglement_operations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notes_frais_reglements" (
    "id" TEXT NOT NULL,
    "noteFraisId" TEXT NOT NULL,
    "choixId" TEXT NOT NULL,
    "type" "TypeNoteFraisReglement" NOT NULL,
    "statut" "StatutNoteFraisReglement" NOT NULL DEFAULT 'EXECUTE',
    "montantTotal" DECIMAL(10,2) NOT NULL,
    "moyen" "MoyenReglementNoteFrais",
    "reference" VARCHAR(64),
    "referenceNormalisee" VARCHAR(64),
    "idempotencyKey" VARCHAR(64),
    "executeurUserId" TEXT,
    "executeAt" TIMESTAMP(3) NOT NULL,
    "operationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notes_frais_reglements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notes_frais_reglement_lignes" (
    "id" TEXT NOT NULL,
    "reglementId" TEXT NOT NULL,
    "typeLigne" "TypeLigneNoteFraisReglement" NOT NULL,
    "typeCible" "TypeCibleCompensationNoteFrais",
    "cibleId" TEXT,
    "rang" INTEGER NOT NULL,
    "montant" DECIMAL(10,2) NOT NULL,
    "montantRestantCibleAvant" DECIMAL(10,2),
    "montantRestantCibleApres" DECIMAL(10,2),
    "montantAutoriseRestantAvant" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notes_frais_reglement_lignes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notes_frais_reglement_corrections" (
    "id" TEXT NOT NULL,
    "reglementId" TEXT NOT NULL,
    "type" "TypeNoteFraisReglementCorrection" NOT NULL,
    "montant" DECIMAL(10,2),
    "referenceAvant" VARCHAR(64),
    "referenceAvantNorm" VARCHAR(64),
    "referenceApres" VARCHAR(64),
    "referenceApresNorm" VARCHAR(64),
    "motif" TEXT NOT NULL,
    "preuveKind" "PreuveCorrectionNoteFrais",
    "preuveRef" VARCHAR(64),
    "idempotencyKey" VARCHAR(64) NOT NULL,
    "actorUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notes_frais_reglement_corrections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notes_frais_restitutions" (
    "id" TEXT NOT NULL,
    "reglementId" TEXT NOT NULL,
    "montant" DECIMAL(10,2) NOT NULL,
    "moyen" "MoyenReglementNoteFrais" NOT NULL,
    "reference" VARCHAR(64) NOT NULL,
    "referenceNormalisee" VARCHAR(64) NOT NULL,
    "dateRestitution" TIMESTAMP(3) NOT NULL,
    "motif" TEXT NOT NULL,
    "idempotencyKey" VARCHAR(64) NOT NULL,
    "actorUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notes_frais_restitutions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notes_frais_reglement_annulation_demandes" (
    "id" TEXT NOT NULL,
    "reglementId" TEXT,
    "operationId" TEXT,
    "statut" "StatutDemandeAnnulationReglement" NOT NULL DEFAULT 'DEMANDEE',
    "motif" TEXT NOT NULL,
    "preuveKind" "PreuveAnnulationReglement" NOT NULL,
    "preuveRef" VARCHAR(64) NOT NULL,
    "demandeurUserId" TEXT,
    "confirmateurUserId" TEXT,
    "idempotencyKey" VARCHAR(64) NOT NULL,
    "decisionIdempotencyKey" VARCHAR(64),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "decideeAt" TIMESTAMP(3),
    "decisionMotif" TEXT,

    CONSTRAINT "notes_frais_reglement_annulation_demandes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notes_frais_annulation_inverses_cible" (
    "id" TEXT NOT NULL,
    "demandeId" TEXT NOT NULL,
    "reglementLigneId" TEXT NOT NULL,
    "typeCible" "TypeCibleCompensationNoteFrais" NOT NULL,
    "cibleId" TEXT NOT NULL,
    "montantRestaure" DECIMAL(10,2) NOT NULL,
    "restantAvant" DECIMAL(10,2) NOT NULL,
    "restantApres" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notes_frais_annulation_inverses_cible_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notes_frais_correction_inverses_cible" (
    "id" TEXT NOT NULL,
    "correctionId" TEXT NOT NULL,
    "reglementLigneId" TEXT NOT NULL,
    "typeCible" "TypeCibleCompensationNoteFrais" NOT NULL,
    "cibleId" TEXT NOT NULL,
    "montantRestaure" DECIMAL(10,2) NOT NULL,
    "restantAvant" DECIMAL(10,2) NOT NULL,
    "restantApres" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notes_frais_correction_inverses_cible_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "justificatifs_note_frais" (
    "id" TEXT NOT NULL,
    "noteFraisId" TEXT NOT NULL,
    "nomFichierOrig" VARCHAR(255) NOT NULL,
    "cheminRelatif" VARCHAR(500) NOT NULL,
    "typeMime" VARCHAR(100) NOT NULL,
    "taille" INTEGER NOT NULL,
    "statut" "StatutJustificatifNoteFrais" NOT NULL DEFAULT 'PENDING',
    "uploadedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "justificatifs_note_frais_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notes_frais_outbox_events" (
    "id" TEXT NOT NULL,
    "noteFraisId" TEXT,
    "eventKey" VARCHAR(120) NOT NULL,
    "kind" VARCHAR(40) NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "StatutNoteFraisOutbox" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 8,
    "lockedAt" TIMESTAMP(3),
    "lockedBy" VARCHAR(64),
    "lastError" VARCHAR(500),
    "nextAttemptAt" TIMESTAMP(3),
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notes_frais_outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notes_frais_file_jobs" (
    "id" TEXT NOT NULL,
    "noteFraisId" VARCHAR(64),
    "archiveJustificatifId" VARCHAR(64),
    "operation" "NoteFraisFileJobOperation" NOT NULL,
    "sourcePath" VARCHAR(500),
    "targetPath" VARCHAR(500),
    "status" "StatutNoteFraisFileJob" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 8,
    "lockedAt" TIMESTAMP(3),
    "lockedBy" VARCHAR(64),
    "lastError" VARCHAR(500),
    "nextAttemptAt" TIMESTAMP(3),
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notes_frais_file_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notes_frais_archives" (
    "id" TEXT NOT NULL,
    "dateDepense" TIMESTAMP(3) NOT NULL,
    "montantDemande" DECIMAL(10,2) NOT NULL,
    "soumiseAt" TIMESTAMP(3) NOT NULL,
    "statutFinal" VARCHAR(20) NOT NULL,
    "montantAccepte" DECIMAL(10,2),
    "decideeAt" TIMESTAMP(3),
    "modeReglement" VARCHAR(20),
    "montantRemboursementChoix" DECIMAL(10,2),
    "montantCompensationChoix" DECIMAL(10,2),
    "archivedAt" TIMESTAMP(3) NOT NULL,
    "retentionEndsAt" TIMESTAMP(3) NOT NULL,
    "reidentifiabilityNotice" VARCHAR(80) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notes_frais_archives_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "justificatifs_note_frais_archives" (
    "id" TEXT NOT NULL,
    "archiveId" TEXT NOT NULL,
    "rang" INTEGER NOT NULL DEFAULT 1,
    "nomFichierOrig" VARCHAR(255),
    "cheminRelatif" VARCHAR(500) NOT NULL,
    "typeMime" VARCHAR(100) NOT NULL,
    "taille" INTEGER NOT NULL,
    "statut" "StatutJustificatifNoteFrais" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "justificatifs_note_frais_archives_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notes_frais_archive_access_logs" (
    "id" TEXT NOT NULL,
    "archiveId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "action" VARCHAR(40) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notes_frais_archive_access_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notes_frais_journal_financier_evenements" (
    "id" TEXT NOT NULL,
    "kind" "KindNoteFraisJournalFinancier" NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "periodeCle" VARCHAR(16) NOT NULL,
    "montant" DECIMAL(10,2) NOT NULL,
    "retentionEndsAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notes_frais_journal_financier_evenements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notes_frais_reports_financier_periode" (
    "id" TEXT NOT NULL,
    "periodeCle" VARCHAR(16) NOT NULL,
    "totalDecaissementsRemboursement" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalRestitutions" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalCompensationsNettes" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "consolidatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notes_frais_reports_financier_periode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "notes_frais_submitIdempotencyKey_key" ON "notes_frais"("submitIdempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "notes_frais_decisionIdempotencyKey_key" ON "notes_frais"("decisionIdempotencyKey");

-- CreateIndex
CREATE INDEX "notes_frais_adherentId_statut_idx" ON "notes_frais"("adherentId", "statut");

-- CreateIndex
CREATE INDEX "notes_frais_demandeurUserId_idx" ON "notes_frais"("demandeurUserId");

-- CreateIndex
CREATE INDEX "notes_frais_statut_soumiseAt_idx" ON "notes_frais"("statut", "soumiseAt");

-- CreateIndex
CREATE INDEX "notes_frais_statut_decideeAt_idx" ON "notes_frais"("statut", "decideeAt");

-- CreateIndex
CREATE INDEX "notes_frais_decideurUserId_idx" ON "notes_frais"("decideurUserId");

-- CreateIndex
CREATE INDEX "notes_frais_corrigeNoteFraisId_idx" ON "notes_frais"("corrigeNoteFraisId");

-- CreateIndex
CREATE INDEX "notes_frais_alerteSansDestinataire_idx" ON "notes_frais"("alerteSansDestinataire");

-- CreateIndex
CREATE UNIQUE INDEX "notes_frais_decisions_noteFraisId_key" ON "notes_frais_decisions"("noteFraisId");

-- CreateIndex
CREATE UNIQUE INDEX "notes_frais_decisions_decisionIdempotencyKey_key" ON "notes_frais_decisions"("decisionIdempotencyKey");

-- CreateIndex
CREATE INDEX "notes_frais_decisions_decideurUserId_idx" ON "notes_frais_decisions"("decideurUserId");

-- CreateIndex
CREATE INDEX "notes_frais_decisions_decideeAt_idx" ON "notes_frais_decisions"("decideeAt");

-- CreateIndex
CREATE UNIQUE INDEX "notes_frais_choix_reglement_idempotencyKey_key" ON "notes_frais_choix_reglement"("idempotencyKey");

-- CreateIndex
CREATE INDEX "notes_frais_choix_reglement_noteFraisId_statut_idx" ON "notes_frais_choix_reglement"("noteFraisId", "statut");

-- CreateIndex
CREATE INDEX "notes_frais_choix_reglement_noteFraisId_idx" ON "notes_frais_choix_reglement"("noteFraisId");

-- CreateIndex
CREATE INDEX "notes_frais_choix_reglement_remplaceChoixId_idx" ON "notes_frais_choix_reglement"("remplaceChoixId");

-- CreateIndex
CREATE INDEX "notes_frais_choix_reglement_cibles_cibleId_typeCible_idx" ON "notes_frais_choix_reglement_cibles"("cibleId", "typeCible");

-- CreateIndex
CREATE UNIQUE INDEX "notes_frais_choix_reglement_cibles_choixId_typeCible_cibleI_key" ON "notes_frais_choix_reglement_cibles"("choixId", "typeCible", "cibleId");

-- CreateIndex
CREATE UNIQUE INDEX "notes_frais_reglement_operations_idempotencyKey_key" ON "notes_frais_reglement_operations"("idempotencyKey");

-- CreateIndex
CREATE INDEX "notes_frais_reglement_operations_noteFraisId_executeAt_idx" ON "notes_frais_reglement_operations"("noteFraisId", "executeAt");

-- CreateIndex
CREATE INDEX "notes_frais_reglement_operations_choixId_idx" ON "notes_frais_reglement_operations"("choixId");

-- CreateIndex
CREATE INDEX "notes_frais_reglement_operations_statut_idx" ON "notes_frais_reglement_operations"("statut");

-- CreateIndex
CREATE UNIQUE INDEX "notes_frais_reglements_idempotencyKey_key" ON "notes_frais_reglements"("idempotencyKey");

-- CreateIndex
CREATE INDEX "notes_frais_reglements_noteFraisId_executeAt_idx" ON "notes_frais_reglements"("noteFraisId", "executeAt");

-- CreateIndex
CREATE INDEX "notes_frais_reglements_choixId_idx" ON "notes_frais_reglements"("choixId");

-- CreateIndex
CREATE INDEX "notes_frais_reglements_type_statut_idx" ON "notes_frais_reglements"("type", "statut");

-- CreateIndex
CREATE INDEX "notes_frais_reglements_operationId_idx" ON "notes_frais_reglements"("operationId");

-- CreateIndex
CREATE UNIQUE INDEX "notes_frais_reglements_operationId_type_key" ON "notes_frais_reglements"("operationId", "type");

-- CreateIndex
CREATE INDEX "notes_frais_reglement_lignes_cibleId_typeCible_idx" ON "notes_frais_reglement_lignes"("cibleId", "typeCible");

-- CreateIndex
CREATE UNIQUE INDEX "notes_frais_reglement_lignes_reglementId_rang_key" ON "notes_frais_reglement_lignes"("reglementId", "rang");

-- CreateIndex
CREATE UNIQUE INDEX "notes_frais_reglement_corrections_idempotencyKey_key" ON "notes_frais_reglement_corrections"("idempotencyKey");

-- CreateIndex
CREATE INDEX "notes_frais_reglement_corrections_reglementId_createdAt_idx" ON "notes_frais_reglement_corrections"("reglementId", "createdAt");

-- CreateIndex
CREATE INDEX "notes_frais_reglement_corrections_type_createdAt_idx" ON "notes_frais_reglement_corrections"("type", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "notes_frais_restitutions_idempotencyKey_key" ON "notes_frais_restitutions"("idempotencyKey");

-- CreateIndex
CREATE INDEX "notes_frais_restitutions_reglementId_dateRestitution_idx" ON "notes_frais_restitutions"("reglementId", "dateRestitution");

-- CreateIndex
CREATE UNIQUE INDEX "notes_frais_reglement_annulation_demandes_idempotencyKey_key" ON "notes_frais_reglement_annulation_demandes"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "notes_frais_reglement_annulation_demandes_decisionIdempoten_key" ON "notes_frais_reglement_annulation_demandes"("decisionIdempotencyKey");

-- CreateIndex
CREATE INDEX "notes_frais_reglement_annulation_demandes_reglementId_statu_idx" ON "notes_frais_reglement_annulation_demandes"("reglementId", "statut");

-- CreateIndex
CREATE INDEX "notes_frais_reglement_annulation_demandes_operationId_statu_idx" ON "notes_frais_reglement_annulation_demandes"("operationId", "statut");

-- CreateIndex
CREATE INDEX "notes_frais_reglement_annulation_demandes_statut_expiresAt_idx" ON "notes_frais_reglement_annulation_demandes"("statut", "expiresAt");

-- CreateIndex
CREATE INDEX "notes_frais_annulation_inverses_cible_reglementLigneId_idx" ON "notes_frais_annulation_inverses_cible"("reglementLigneId");

-- CreateIndex
CREATE INDEX "notes_frais_annulation_inverses_cible_cibleId_typeCible_idx" ON "notes_frais_annulation_inverses_cible"("cibleId", "typeCible");

-- CreateIndex
CREATE UNIQUE INDEX "notes_frais_annulation_inverses_cible_demandeId_reglementLi_key" ON "notes_frais_annulation_inverses_cible"("demandeId", "reglementLigneId");

-- CreateIndex
CREATE INDEX "notes_frais_correction_inverses_cible_reglementLigneId_idx" ON "notes_frais_correction_inverses_cible"("reglementLigneId");

-- CreateIndex
CREATE INDEX "notes_frais_correction_inverses_cible_cibleId_typeCible_idx" ON "notes_frais_correction_inverses_cible"("cibleId", "typeCible");

-- CreateIndex
CREATE UNIQUE INDEX "notes_frais_correction_inverses_cible_correctionId_reglemen_key" ON "notes_frais_correction_inverses_cible"("correctionId", "reglementLigneId");

-- CreateIndex
CREATE INDEX "justificatifs_note_frais_noteFraisId_statut_idx" ON "justificatifs_note_frais"("noteFraisId", "statut");

-- CreateIndex
CREATE UNIQUE INDEX "notes_frais_outbox_events_eventKey_key" ON "notes_frais_outbox_events"("eventKey");

-- CreateIndex
CREATE INDEX "notes_frais_outbox_events_status_nextAttemptAt_idx" ON "notes_frais_outbox_events"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "notes_frais_outbox_events_lockedAt_idx" ON "notes_frais_outbox_events"("lockedAt");

-- CreateIndex
CREATE INDEX "notes_frais_file_jobs_status_nextAttemptAt_idx" ON "notes_frais_file_jobs"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "notes_frais_file_jobs_lockedAt_idx" ON "notes_frais_file_jobs"("lockedAt");

-- CreateIndex
CREATE INDEX "notes_frais_file_jobs_archiveJustificatifId_idx" ON "notes_frais_file_jobs"("archiveJustificatifId");

-- CreateIndex
CREATE INDEX "notes_frais_archives_retentionEndsAt_idx" ON "notes_frais_archives"("retentionEndsAt");

-- CreateIndex
CREATE INDEX "notes_frais_archives_archivedAt_idx" ON "notes_frais_archives"("archivedAt");

-- CreateIndex
CREATE INDEX "notes_frais_archives_statutFinal_idx" ON "notes_frais_archives"("statutFinal");

-- CreateIndex
CREATE INDEX "justificatifs_note_frais_archives_archiveId_statut_idx" ON "justificatifs_note_frais_archives"("archiveId", "statut");

-- CreateIndex
CREATE UNIQUE INDEX "justificatifs_note_frais_archives_archiveId_rang_key" ON "justificatifs_note_frais_archives"("archiveId", "rang");

-- CreateIndex
CREATE INDEX "notes_frais_archive_access_logs_archiveId_createdAt_idx" ON "notes_frais_archive_access_logs"("archiveId", "createdAt");

-- CreateIndex
CREATE INDEX "notes_frais_archive_access_logs_actorUserId_idx" ON "notes_frais_archive_access_logs"("actorUserId");

-- CreateIndex
CREATE INDEX "notes_frais_journal_financier_evenements_retentionEndsAt_idx" ON "notes_frais_journal_financier_evenements"("retentionEndsAt");

-- CreateIndex
CREATE INDEX "notes_frais_journal_financier_evenements_periodeCle_kind_idx" ON "notes_frais_journal_financier_evenements"("periodeCle", "kind");

-- CreateIndex
CREATE INDEX "notes_frais_journal_financier_evenements_occurredAt_idx" ON "notes_frais_journal_financier_evenements"("occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "notes_frais_reports_financier_periode_periodeCle_key" ON "notes_frais_reports_financier_periode"("periodeCle");

-- CreateIndex
CREATE INDEX "notes_frais_reports_financier_periode_consolidatedAt_idx" ON "notes_frais_reports_financier_periode"("consolidatedAt");


-- Preflight: collisions code TypeDepense (hors NULL) avant unique
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "types_depense"
    WHERE code IS NOT NULL
    GROUP BY code
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'PREFLIGHT FAIL notes_frais_4x_foundation: doublons types_depense.code — corriger manuellement avant migration';
  END IF;
END $$;

-- CreateIndex
CREATE UNIQUE INDEX "types_depense_code_key" ON "types_depense"("code");


-- Preflight: collisions Depense.noteFraisId avant unique
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "depenses"
    WHERE "noteFraisId" IS NOT NULL
    GROUP BY "noteFraisId"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'PREFLIGHT FAIL notes_frais_4x_foundation: doublons depenses.noteFraisId — corriger manuellement avant migration';
  END IF;
END $$;

-- CreateIndex
CREATE UNIQUE INDEX "depenses_noteFraisId_key" ON "depenses"("noteFraisId");

-- CreateIndex
CREATE INDEX "depenses_origine_statut_idx" ON "depenses"("origine", "statut");

-- CreateIndex
CREATE UNIQUE INDEX "avoirs_noteFraisReglementLigneId_key" ON "avoirs"("noteFraisReglementLigneId");

-- CreateIndex
CREATE INDEX "avoirs_origine_statut_idx" ON "avoirs"("origine", "statut");

-- CreateIndex
CREATE UNIQUE INDEX "utilisations_avoir_noteFraisReglementLigneId_key" ON "utilisations_avoir"("noteFraisReglementLigneId");

-- AddForeignKey
ALTER TABLE "types_depense" ADD CONSTRAINT "types_depense_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "depenses" ADD CONSTRAINT "depenses_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "depenses" ADD CONSTRAINT "depenses_noteFraisId_fkey" FOREIGN KEY ("noteFraisId") REFERENCES "notes_frais"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "justificatifs_depense" ADD CONSTRAINT "justificatifs_depense_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avoirs" ADD CONSTRAINT "avoirs_adherentId_fkey" FOREIGN KEY ("adherentId") REFERENCES "adherent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avoirs" ADD CONSTRAINT "avoirs_noteFraisReglementLigneId_fkey" FOREIGN KEY ("noteFraisReglementLigneId") REFERENCES "notes_frais_reglement_lignes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "utilisations_avoir" ADD CONSTRAINT "utilisations_avoir_noteFraisReglementLigneId_fkey" FOREIGN KEY ("noteFraisReglementLigneId") REFERENCES "notes_frais_reglement_lignes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes_frais" ADD CONSTRAINT "notes_frais_adherentId_fkey" FOREIGN KEY ("adherentId") REFERENCES "adherent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes_frais" ADD CONSTRAINT "notes_frais_demandeurUserId_fkey" FOREIGN KEY ("demandeurUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes_frais" ADD CONSTRAINT "notes_frais_decideurUserId_fkey" FOREIGN KEY ("decideurUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes_frais" ADD CONSTRAINT "notes_frais_corrigeNoteFraisId_fkey" FOREIGN KEY ("corrigeNoteFraisId") REFERENCES "notes_frais"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes_frais_decisions" ADD CONSTRAINT "notes_frais_decisions_noteFraisId_fkey" FOREIGN KEY ("noteFraisId") REFERENCES "notes_frais"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes_frais_decisions" ADD CONSTRAINT "notes_frais_decisions_decideurUserId_fkey" FOREIGN KEY ("decideurUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes_frais_choix_reglement" ADD CONSTRAINT "notes_frais_choix_reglement_noteFraisId_fkey" FOREIGN KEY ("noteFraisId") REFERENCES "notes_frais"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes_frais_choix_reglement" ADD CONSTRAINT "notes_frais_choix_reglement_remplaceChoixId_fkey" FOREIGN KEY ("remplaceChoixId") REFERENCES "notes_frais_choix_reglement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes_frais_choix_reglement_cibles" ADD CONSTRAINT "notes_frais_choix_reglement_cibles_choixId_fkey" FOREIGN KEY ("choixId") REFERENCES "notes_frais_choix_reglement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes_frais_reglement_operations" ADD CONSTRAINT "notes_frais_reglement_operations_noteFraisId_fkey" FOREIGN KEY ("noteFraisId") REFERENCES "notes_frais"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes_frais_reglement_operations" ADD CONSTRAINT "notes_frais_reglement_operations_choixId_fkey" FOREIGN KEY ("choixId") REFERENCES "notes_frais_choix_reglement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes_frais_reglement_operations" ADD CONSTRAINT "notes_frais_reglement_operations_executeurUserId_fkey" FOREIGN KEY ("executeurUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes_frais_reglements" ADD CONSTRAINT "notes_frais_reglements_noteFraisId_fkey" FOREIGN KEY ("noteFraisId") REFERENCES "notes_frais"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes_frais_reglements" ADD CONSTRAINT "notes_frais_reglements_choixId_fkey" FOREIGN KEY ("choixId") REFERENCES "notes_frais_choix_reglement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes_frais_reglements" ADD CONSTRAINT "notes_frais_reglements_executeurUserId_fkey" FOREIGN KEY ("executeurUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes_frais_reglements" ADD CONSTRAINT "notes_frais_reglements_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "notes_frais_reglement_operations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes_frais_reglement_lignes" ADD CONSTRAINT "notes_frais_reglement_lignes_reglementId_fkey" FOREIGN KEY ("reglementId") REFERENCES "notes_frais_reglements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes_frais_reglement_corrections" ADD CONSTRAINT "notes_frais_reglement_corrections_reglementId_fkey" FOREIGN KEY ("reglementId") REFERENCES "notes_frais_reglements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes_frais_reglement_corrections" ADD CONSTRAINT "notes_frais_reglement_corrections_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes_frais_restitutions" ADD CONSTRAINT "notes_frais_restitutions_reglementId_fkey" FOREIGN KEY ("reglementId") REFERENCES "notes_frais_reglements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes_frais_restitutions" ADD CONSTRAINT "notes_frais_restitutions_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes_frais_reglement_annulation_demandes" ADD CONSTRAINT "notes_frais_reglement_annulation_demandes_reglementId_fkey" FOREIGN KEY ("reglementId") REFERENCES "notes_frais_reglements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes_frais_reglement_annulation_demandes" ADD CONSTRAINT "notes_frais_reglement_annulation_demandes_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "notes_frais_reglement_operations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes_frais_reglement_annulation_demandes" ADD CONSTRAINT "notes_frais_reglement_annulation_demandes_demandeurUserId_fkey" FOREIGN KEY ("demandeurUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes_frais_reglement_annulation_demandes" ADD CONSTRAINT "notes_frais_reglement_annulation_demandes_confirmateurUser_fkey" FOREIGN KEY ("confirmateurUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes_frais_annulation_inverses_cible" ADD CONSTRAINT "notes_frais_annulation_inverses_cible_demandeId_fkey" FOREIGN KEY ("demandeId") REFERENCES "notes_frais_reglement_annulation_demandes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes_frais_annulation_inverses_cible" ADD CONSTRAINT "notes_frais_annulation_inverses_cible_reglementLigneId_fkey" FOREIGN KEY ("reglementLigneId") REFERENCES "notes_frais_reglement_lignes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes_frais_correction_inverses_cible" ADD CONSTRAINT "notes_frais_correction_inverses_cible_correctionId_fkey" FOREIGN KEY ("correctionId") REFERENCES "notes_frais_reglement_corrections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes_frais_correction_inverses_cible" ADD CONSTRAINT "notes_frais_correction_inverses_cible_reglementLigneId_fkey" FOREIGN KEY ("reglementLigneId") REFERENCES "notes_frais_reglement_lignes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "justificatifs_note_frais" ADD CONSTRAINT "justificatifs_note_frais_noteFraisId_fkey" FOREIGN KEY ("noteFraisId") REFERENCES "notes_frais"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "justificatifs_note_frais" ADD CONSTRAINT "justificatifs_note_frais_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes_frais_outbox_events" ADD CONSTRAINT "notes_frais_outbox_events_noteFraisId_fkey" FOREIGN KEY ("noteFraisId") REFERENCES "notes_frais"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "justificatifs_note_frais_archives" ADD CONSTRAINT "justificatifs_note_frais_archives_archiveId_fkey" FOREIGN KEY ("archiveId") REFERENCES "notes_frais_archives"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes_frais_archive_access_logs" ADD CONSTRAINT "notes_frais_archive_access_logs_archiveId_fkey" FOREIGN KEY ("archiveId") REFERENCES "notes_frais_archives"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes_frais_archive_access_logs" ADD CONSTRAINT "notes_frais_archive_access_logs_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
