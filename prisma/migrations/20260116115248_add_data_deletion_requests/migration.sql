-- CreateEnum
CREATE TYPE "StatutDemandeSuppression" AS ENUM ('EnAttente', 'EnVerification', 'Approuvee', 'Rejetee', 'Completee', 'Annulee');

-- CreateTable
CREATE TABLE "data_deletion_requests" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userEmail" VARCHAR(255) NOT NULL,
    "userName" VARCHAR(255),
    "message" TEXT,
    "statut" "StatutDemandeSuppression" NOT NULL DEFAULT 'EnAttente',
    "verifiedAt" TIMESTAMP(3),
    "verifiedBy" TEXT,
    "verifiedByName" VARCHAR(255),
    "approvedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "approvedByName" VARCHAR(255),
    "rejectedAt" TIMESTAMP(3),
    "rejectedBy" TEXT,
    "rejectedByName" VARCHAR(255),
    "rejectionReason" TEXT,
    "completedAt" TIMESTAMP(3),
    "completedBy" TEXT,
    "completedByName" VARCHAR(255),
    "dataExported" BOOLEAN NOT NULL DEFAULT false,
    "exportPath" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "data_deletion_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "data_deletion_requests_userId_idx" ON "data_deletion_requests"("userId");

-- CreateIndex
CREATE INDEX "data_deletion_requests_userEmail_idx" ON "data_deletion_requests"("userEmail");

-- CreateIndex
CREATE INDEX "data_deletion_requests_statut_idx" ON "data_deletion_requests"("statut");

-- CreateIndex
CREATE INDEX "data_deletion_requests_createdAt_idx" ON "data_deletion_requests"("createdAt");

-- CreateIndex
CREATE INDEX "data_deletion_requests_verifiedBy_idx" ON "data_deletion_requests"("verifiedBy");

-- CreateIndex
CREATE INDEX "data_deletion_requests_approvedBy_idx" ON "data_deletion_requests"("approvedBy");

-- AddForeignKey
ALTER TABLE "data_deletion_requests" ADD CONSTRAINT "data_deletion_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_deletion_requests" ADD CONSTRAINT "data_deletion_requests_verifiedBy_fkey" FOREIGN KEY ("verifiedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_deletion_requests" ADD CONSTRAINT "data_deletion_requests_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_deletion_requests" ADD CONSTRAINT "data_deletion_requests_rejectedBy_fkey" FOREIGN KEY ("rejectedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_deletion_requests" ADD CONSTRAINT "data_deletion_requests_completedBy_fkey" FOREIGN KEY ("completedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
