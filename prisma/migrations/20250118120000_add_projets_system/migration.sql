-- CreateEnum
CREATE TYPE "StatutProjet" AS ENUM ('Planifie', 'EnCours', 'EnPause', 'Termine', 'Annule');

-- CreateEnum
CREATE TYPE "StatutSousProjet" AS ENUM ('APlanifier', 'EnAttente', 'EnCours', 'EnPause', 'Terminee', 'Annulee');

-- CreateTable
CREATE TABLE "projets" (
    "id" TEXT NOT NULL,
    "titre" VARCHAR(255) NOT NULL,
    "description" TEXT NOT NULL,
    "statut" "StatutProjet" NOT NULL DEFAULT 'Planifie',
    "dateDebut" TIMESTAMP(3),
    "dateFin" TIMESTAMP(3),
    "dateFinReelle" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sous_projets" (
    "id" TEXT NOT NULL,
    "projetId" TEXT NOT NULL,
    "titre" VARCHAR(255) NOT NULL,
    "description" TEXT NOT NULL,
    "statut" "StatutSousProjet" NOT NULL DEFAULT 'APlanifier',
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "dateDebut" TIMESTAMP(3),
    "dateFin" TIMESTAMP(3),
    "dateFinReelle" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sous_projets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affectations_sous_projets" (
    "id" TEXT NOT NULL,
    "sousProjetId" TEXT NOT NULL,
    "adherentId" TEXT NOT NULL,
    "dateAffectation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateFinAffectation" TIMESTAMP(3),
    "responsable" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "affectations_sous_projets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commentaires_taches" (
    "id" TEXT NOT NULL,
    "sousProjetId" TEXT NOT NULL,
    "adherentId" TEXT NOT NULL,
    "contenu" TEXT NOT NULL,
    "pourcentageAvancement" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "commentaires_taches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "projets_statut_idx" ON "projets"("statut");

-- CreateIndex
CREATE INDEX "projets_createdBy_idx" ON "projets"("createdBy");

-- CreateIndex
CREATE INDEX "projets_dateDebut_idx" ON "projets"("dateDebut");

-- CreateIndex
CREATE INDEX "projets_dateFin_idx" ON "projets"("dateFin");

-- CreateIndex
CREATE INDEX "sous_projets_projetId_idx" ON "sous_projets"("projetId");

-- CreateIndex
CREATE INDEX "sous_projets_statut_idx" ON "sous_projets"("statut");

-- CreateIndex
CREATE INDEX "sous_projets_ordre_idx" ON "sous_projets"("ordre");

-- CreateIndex
CREATE INDEX "affectations_sous_projets_sousProjetId_idx" ON "affectations_sous_projets"("sousProjetId");

-- CreateIndex
CREATE INDEX "affectations_sous_projets_adherentId_idx" ON "affectations_sous_projets"("adherentId");

-- CreateIndex
CREATE INDEX "affectations_sous_projets_dateAffectation_idx" ON "affectations_sous_projets"("dateAffectation");

-- CreateIndex
CREATE UNIQUE INDEX "affectations_sous_projets_sousProjetId_adherentId_key" ON "affectations_sous_projets"("sousProjetId", "adherentId");

-- CreateIndex
CREATE INDEX "commentaires_taches_sousProjetId_idx" ON "commentaires_taches"("sousProjetId");

-- CreateIndex
CREATE INDEX "commentaires_taches_adherentId_idx" ON "commentaires_taches"("adherentId");

-- CreateIndex
CREATE INDEX "commentaires_taches_createdAt_idx" ON "commentaires_taches"("createdAt");

-- AddForeignKey
ALTER TABLE "projets" ADD CONSTRAINT "projets_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sous_projets" ADD CONSTRAINT "sous_projets_projetId_fkey" FOREIGN KEY ("projetId") REFERENCES "projets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affectations_sous_projets" ADD CONSTRAINT "affectations_sous_projets_sousProjetId_fkey" FOREIGN KEY ("sousProjetId") REFERENCES "sous_projets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affectations_sous_projets" ADD CONSTRAINT "affectations_sous_projets_adherentId_fkey" FOREIGN KEY ("adherentId") REFERENCES "adherent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commentaires_taches" ADD CONSTRAINT "commentaires_taches_sousProjetId_fkey" FOREIGN KEY ("sousProjetId") REFERENCES "sous_projets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commentaires_taches" ADD CONSTRAINT "commentaires_taches_adherentId_fkey" FOREIGN KEY ("adherentId") REFERENCES "adherent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
