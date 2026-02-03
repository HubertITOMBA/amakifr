-- CreateEnum
CREATE TYPE "CategorieTypeCotisation" AS ENUM ('ForfaitMensuel', 'Assistance', 'Divers');

-- AlterTable
ALTER TABLE "types_cotisation_mensuelle" ADD COLUMN "categorie" "CategorieTypeCotisation" NOT NULL DEFAULT 'Divers';

-- Backfill: types dont le nom contient "forfait" -> ForfaitMensuel
UPDATE "types_cotisation_mensuelle"
SET "categorie" = 'ForfaitMensuel'
WHERE LOWER("nom") LIKE '%forfait%';

-- Backfill: types avec bénéficiaire (et pas déjà ForfaitMensuel) -> Assistance
UPDATE "types_cotisation_mensuelle"
SET "categorie" = 'Assistance'
WHERE "aBeneficiaire" = true AND "categorie" != 'ForfaitMensuel';
