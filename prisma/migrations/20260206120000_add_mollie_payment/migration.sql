-- AlterEnum: add Mollie to MoyenPaiement
ALTER TYPE "MoyenPaiement" ADD VALUE 'Mollie';

-- AlterTable: add molliePaymentId to paiements_cotisation
ALTER TABLE "paiements_cotisation" ADD COLUMN IF NOT EXISTS "molliePaymentId" VARCHAR(255);

-- CreateIndex (unique)
CREATE UNIQUE INDEX IF NOT EXISTS "paiements_cotisation_molliePaymentId_key" ON "paiements_cotisation"("molliePaymentId");
