-- Statut livré pour clôture des commandes
ALTER TYPE "MerchOrderStatus" ADD VALUE IF NOT EXISTS 'Livree';

-- Statut de paiement distinct du statut logistique
CREATE TYPE "MerchPaymentStatus" AS ENUM ('EnAttente', 'Recu', 'Rembourse');

ALTER TABLE "merch_orders" ADD COLUMN IF NOT EXISTS "statut_paiement" "MerchPaymentStatus" NOT NULL DEFAULT 'EnAttente';
ALTER TABLE "merch_orders" ADD COLUMN IF NOT EXISTS "notes_admin" TEXT;
ALTER TABLE "merch_orders" ADD COLUMN IF NOT EXISTS "reference_suivi" VARCHAR(100);
ALTER TABLE "merch_orders" ADD COLUMN IF NOT EXISTS "date_expedition" TIMESTAMP(3);
ALTER TABLE "merch_orders" ADD COLUMN IF NOT EXISTS "date_cloture" TIMESTAMP(3);
