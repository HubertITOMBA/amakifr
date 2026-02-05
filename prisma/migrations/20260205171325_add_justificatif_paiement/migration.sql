-- AlterTable
ALTER TABLE "paiements_cotisation" ADD COLUMN     "justificatifChemin" VARCHAR(500);

-- RenameIndex
ALTER INDEX "pass_assistance_type_unique" RENAME TO "pass_assistance_typeCotisationId_key";
