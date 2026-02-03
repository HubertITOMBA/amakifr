-- AlterTable: description VARCHAR(500)
ALTER TABLE "pass_assistance" ALTER COLUMN "description" TYPE VARCHAR(500);

-- Remplir les typeCotisationMensuelleId NULL : priorité catégorie Assistance, sinon n'importe quel type (shadow DB)
UPDATE "pass_assistance"
SET "typeCotisationMensuelleId" = COALESCE(
  (SELECT id FROM "types_cotisation_mensuelle" WHERE "categorie" = 'Assistance' AND "actif" = true ORDER BY "ordre", "nom" LIMIT 1),
  (SELECT id FROM "types_cotisation_mensuelle" ORDER BY "ordre", "nom" LIMIT 1)
)
WHERE "typeCotisationMensuelleId" IS NULL;

-- Supprimer les lignes qui n'ont toujours pas de type (shadow DB sans types_cotisation_mensuelle)
DELETE FROM "pass_assistance" WHERE "typeCotisationMensuelleId" IS NULL;

-- AlterTable: typeCotisationMensuelleId NOT NULL
ALTER TABLE "pass_assistance" ALTER COLUMN "typeCotisationMensuelleId" SET NOT NULL;

-- Changer la FK : ON DELETE RESTRICT (au lieu de SET NULL)
ALTER TABLE "pass_assistance" DROP CONSTRAINT IF EXISTS "pass_assistance_typeCotisationMensuelleId_fkey";
ALTER TABLE "pass_assistance" ADD CONSTRAINT "pass_assistance_typeCotisationMensuelleId_fkey" FOREIGN KEY ("typeCotisationMensuelleId") REFERENCES "types_cotisation_mensuelle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
