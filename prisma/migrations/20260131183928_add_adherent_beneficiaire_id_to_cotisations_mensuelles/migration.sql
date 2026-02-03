-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "MenuRole" ADD VALUE 'TRESOR';
ALTER TYPE "MenuRole" ADD VALUE 'VTRESO';

-- DropIndex
DROP INDEX "depenses_validatedBy_idx";

-- AlterTable
ALTER TABLE "cotisations_mensuelles" ADD COLUMN     "adherentBeneficiaireId" TEXT;

-- AlterTable
ALTER TABLE "permissions" ALTER COLUMN "roles" DROP DEFAULT;

-- AddForeignKey
ALTER TABLE "cotisations_mensuelles" ADD CONSTRAINT "cotisations_mensuelles_adherentBeneficiaireId_fkey" FOREIGN KEY ("adherentBeneficiaireId") REFERENCES "adherent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "unique_periode_adherent_cotisation_du_mois" RENAME TO "cotisations_mensuelles_periode_adherentId_cotisationDuMoisI_key";
