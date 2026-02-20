-- CreateEnum
CREATE TYPE "StatutReunionMensuelle" AS ENUM ('EnAttente', 'MoisValide', 'DateConfirmee', 'Annulee');

-- CreateEnum
CREATE TYPE "TypeLieuReunion" AS ENUM ('Domicile', 'Restaurant', 'Autre');

-- CreateEnum
CREATE TYPE "StatutParticipationReunion" AS ENUM ('Present', 'Absent', 'Excuse', 'NonRepondu');

-- CreateTable
CREATE TABLE "reunions_mensuelles" (
    "id" TEXT NOT NULL,
    "annee" INTEGER NOT NULL,
    "mois" INTEGER NOT NULL,
    "statut" "StatutReunionMensuelle" NOT NULL DEFAULT 'EnAttente',
    "adherentHoteId" TEXT,
    "dateReunion" TIMESTAMP(3),
    "typeLieu" "TypeLieuReunion" NOT NULL DEFAULT 'Domicile',
    "adresse" TEXT,
    "nomRestaurant" VARCHAR(255),
    "commentaires" TEXT,
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reunions_mensuelles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "participations_reunion" (
    "id" TEXT NOT NULL,
    "reunionId" TEXT NOT NULL,
    "adherentId" TEXT NOT NULL,
    "statut" "StatutParticipationReunion" NOT NULL DEFAULT 'NonRepondu',
    "commentaire" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "participations_reunion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "reunions_mensuelles_annee_mois_key" ON "reunions_mensuelles"("annee", "mois");

-- CreateIndex
CREATE INDEX "reunions_mensuelles_annee_mois_idx" ON "reunions_mensuelles"("annee", "mois");

-- CreateIndex
CREATE INDEX "reunions_mensuelles_adherentHoteId_idx" ON "reunions_mensuelles"("adherentHoteId");

-- CreateIndex
CREATE INDEX "reunions_mensuelles_statut_idx" ON "reunions_mensuelles"("statut");

-- CreateIndex
CREATE INDEX "reunions_mensuelles_dateReunion_idx" ON "reunions_mensuelles"("dateReunion");

-- CreateIndex
CREATE UNIQUE INDEX "participations_reunion_reunionId_adherentId_key" ON "participations_reunion"("reunionId", "adherentId");

-- CreateIndex
CREATE INDEX "participations_reunion_reunionId_idx" ON "participations_reunion"("reunionId");

-- CreateIndex
CREATE INDEX "participations_reunion_adherentId_idx" ON "participations_reunion"("adherentId");

-- CreateIndex
CREATE INDEX "participations_reunion_statut_idx" ON "participations_reunion"("statut");

-- AddForeignKey
ALTER TABLE "reunions_mensuelles" ADD CONSTRAINT "reunions_mensuelles_adherentHoteId_fkey" FOREIGN KEY ("adherentHoteId") REFERENCES "adherent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reunions_mensuelles" ADD CONSTRAINT "reunions_mensuelles_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reunions_mensuelles" ADD CONSTRAINT "reunions_mensuelles_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participations_reunion" ADD CONSTRAINT "participations_reunion_reunionId_fkey" FOREIGN KEY ("reunionId") REFERENCES "reunions_mensuelles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participations_reunion" ADD CONSTRAINT "participations_reunion_adherentId_fkey" FOREIGN KEY ("adherentId") REFERENCES "adherent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
