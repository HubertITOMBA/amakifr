-- CreateEnum
CREATE TYPE "SondageStatus" AS ENUM ('Brouillon', 'Ouvert', 'Cloture');

-- CreateEnum
CREATE TYPE "SondageQuestionType" AS ENUM ('ChoixUnique', 'ChoixMultiple', 'TexteLibre', 'Matrice');

-- CreateTable
CREATE TABLE "sondages" (
    "id" TEXT NOT NULL,
    "sujet" VARCHAR(255) NOT NULL,
    "introduction" TEXT,
    "conclusion" TEXT,
    "dateDebut" TIMESTAMP(3) NOT NULL,
    "dateFin" TIMESTAMP(3) NOT NULL,
    "status" "SondageStatus" NOT NULL DEFAULT 'Brouillon',
    "sourceId" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sondages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sondage_questions" (
    "id" TEXT NOT NULL,
    "sondageId" TEXT NOT NULL,
    "ordre" INTEGER NOT NULL,
    "section" VARCHAR(255),
    "libelle" TEXT NOT NULL,
    "type" "SondageQuestionType" NOT NULL,
    "obligatoire" BOOLEAN NOT NULL DEFAULT true,
    "maxSelections" INTEGER,
    "minCaracteres" INTEGER,
    "maxCaracteres" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sondage_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sondage_options" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "ordre" INTEGER NOT NULL,
    "libelle" VARCHAR(500) NOT NULL,
    "permetTexteLibre" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sondage_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sondage_matrice_lignes" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "ordre" INTEGER NOT NULL,
    "libelle" VARCHAR(500) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sondage_matrice_lignes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sondage_reponses" (
    "id" TEXT NOT NULL,
    "sondageId" TEXT NOT NULL,
    "adherentId" TEXT NOT NULL,
    "soumiseLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifieLe" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sondage_reponses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sondage_reponse_items" (
    "id" TEXT NOT NULL,
    "reponseId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "optionId" TEXT,
    "ligneMatriceId" TEXT,
    "texteLibre" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sondage_reponse_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sondages_sujet_key" ON "sondages"("sujet");

-- CreateIndex
CREATE INDEX "sondages_createdBy_idx" ON "sondages"("createdBy");

-- CreateIndex
CREATE INDEX "sondages_status_idx" ON "sondages"("status");

-- CreateIndex
CREATE INDEX "sondages_dateDebut_idx" ON "sondages"("dateDebut");

-- CreateIndex
CREATE INDEX "sondages_dateFin_idx" ON "sondages"("dateFin");

-- CreateIndex
CREATE INDEX "sondages_sourceId_idx" ON "sondages"("sourceId");

-- CreateIndex
CREATE INDEX "sondage_questions_sondageId_idx" ON "sondage_questions"("sondageId");

-- CreateIndex
CREATE INDEX "sondage_questions_ordre_idx" ON "sondage_questions"("ordre");

-- CreateIndex
CREATE INDEX "sondage_options_questionId_idx" ON "sondage_options"("questionId");

-- CreateIndex
CREATE INDEX "sondage_options_ordre_idx" ON "sondage_options"("ordre");

-- CreateIndex
CREATE INDEX "sondage_matrice_lignes_questionId_idx" ON "sondage_matrice_lignes"("questionId");

-- CreateIndex
CREATE INDEX "sondage_matrice_lignes_ordre_idx" ON "sondage_matrice_lignes"("ordre");

-- CreateIndex
CREATE INDEX "sondage_reponses_sondageId_idx" ON "sondage_reponses"("sondageId");

-- CreateIndex
CREATE INDEX "sondage_reponses_adherentId_idx" ON "sondage_reponses"("adherentId");

-- CreateIndex
CREATE INDEX "sondage_reponses_soumiseLe_idx" ON "sondage_reponses"("soumiseLe");

-- CreateIndex
CREATE UNIQUE INDEX "sondage_reponses_sondageId_adherentId_key" ON "sondage_reponses"("sondageId", "adherentId");

-- CreateIndex
CREATE INDEX "sondage_reponse_items_reponseId_idx" ON "sondage_reponse_items"("reponseId");

-- CreateIndex
CREATE INDEX "sondage_reponse_items_questionId_idx" ON "sondage_reponse_items"("questionId");

-- CreateIndex
CREATE INDEX "sondage_reponse_items_optionId_idx" ON "sondage_reponse_items"("optionId");

-- CreateIndex
CREATE INDEX "sondage_reponse_items_ligneMatriceId_idx" ON "sondage_reponse_items"("ligneMatriceId");

-- AddForeignKey
ALTER TABLE "sondages" ADD CONSTRAINT "sondages_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "sondages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sondages" ADD CONSTRAINT "sondages_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sondage_questions" ADD CONSTRAINT "sondage_questions_sondageId_fkey" FOREIGN KEY ("sondageId") REFERENCES "sondages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sondage_options" ADD CONSTRAINT "sondage_options_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "sondage_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sondage_matrice_lignes" ADD CONSTRAINT "sondage_matrice_lignes_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "sondage_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sondage_reponses" ADD CONSTRAINT "sondage_reponses_sondageId_fkey" FOREIGN KEY ("sondageId") REFERENCES "sondages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sondage_reponses" ADD CONSTRAINT "sondage_reponses_adherentId_fkey" FOREIGN KEY ("adherentId") REFERENCES "adherent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sondage_reponse_items" ADD CONSTRAINT "sondage_reponse_items_reponseId_fkey" FOREIGN KEY ("reponseId") REFERENCES "sondage_reponses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sondage_reponse_items" ADD CONSTRAINT "sondage_reponse_items_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "sondage_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sondage_reponse_items" ADD CONSTRAINT "sondage_reponse_items_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "sondage_options"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sondage_reponse_items" ADD CONSTRAINT "sondage_reponse_items_ligneMatriceId_fkey" FOREIGN KEY ("ligneMatriceId") REFERENCES "sondage_matrice_lignes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
