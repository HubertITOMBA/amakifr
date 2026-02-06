-- Création de la table pass_assistance si elle n'existe pas (état actuel du schéma Prisma).
-- À utiliser en production si la table n'a jamais été créée et que vous ne pouvez pas exécuter
-- les migrations dans l'ordre (préférez sinon : npx prisma migrate deploy).
-- La table types_cotisation_mensuelle doit déjà exister.

CREATE TABLE IF NOT EXISTS "pass_assistance" (
  "id" TEXT NOT NULL,
  "description" VARCHAR(500) NOT NULL,
  "montant" DECIMAL(10,2) NOT NULL,
  "typeCotisationId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "pass_assistance_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "pass_assistance_typeCotisationId_fkey" FOREIGN KEY ("typeCotisationId")
    REFERENCES "types_cotisation_mensuelle"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "pass_assistance_type_unique" UNIQUE ("typeCotisationId")
);

-- Commentaire pour rappel
COMMENT ON TABLE "pass_assistance" IS 'Config montant fixe par type d''assistance (PassAssistance)';
