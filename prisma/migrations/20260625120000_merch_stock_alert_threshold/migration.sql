-- Seuil d'alerte stock par produit (défaut : 5 unités)
ALTER TABLE "merch_products" ADD COLUMN IF NOT EXISTS "seuil_alerte_stock" INTEGER NOT NULL DEFAULT 5;
