-- Documents Phase 1.5 : validation administrative + demandes de suppression document
-- Backfill : documents existants → EnAttente (ne pas forcer Valide+Public)

CREATE TYPE "StatutValidationDocument" AS ENUM ('EnAttente', 'Valide', 'Rejete');
CREATE TYPE "StatutDemandeSuppressionDocument" AS ENUM ('EnAttente', 'Traitee', 'Annulee');

ALTER TABLE "documents"
  ADD COLUMN "statutValidation" "StatutValidationDocument" NOT NULL DEFAULT 'EnAttente',
  ADD COLUMN "validatedAt" TIMESTAMP(3),
  ADD COLUMN "validatedBy" TEXT,
  ADD COLUMN "rejectionReason" TEXT;

CREATE INDEX "documents_statutValidation_idx" ON "documents"("statutValidation");
CREATE INDEX "documents_estPublic_idx" ON "documents"("estPublic");

ALTER TABLE "documents"
  ADD CONSTRAINT "documents_validatedBy_fkey"
  FOREIGN KEY ("validatedBy") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "document_deletion_requests" (
  "id" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "requestedBy" TEXT NOT NULL,
  "motif" TEXT,
  "statut" "StatutDemandeSuppressionDocument" NOT NULL DEFAULT 'EnAttente',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "resolvedAt" TIMESTAMP(3),
  "resolvedBy" TEXT,

  CONSTRAINT "document_deletion_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "document_deletion_requests_documentId_idx" ON "document_deletion_requests"("documentId");
CREATE INDEX "document_deletion_requests_requestedBy_idx" ON "document_deletion_requests"("requestedBy");
CREATE INDEX "document_deletion_requests_statut_idx" ON "document_deletion_requests"("statut");
CREATE INDEX "document_deletion_requests_createdAt_idx" ON "document_deletion_requests"("createdAt");

ALTER TABLE "document_deletion_requests"
  ADD CONSTRAINT "document_deletion_requests_documentId_fkey"
  FOREIGN KEY ("documentId") REFERENCES "documents"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "document_deletion_requests"
  ADD CONSTRAINT "document_deletion_requests_resolvedBy_fkey"
  FOREIGN KEY ("resolvedBy") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
