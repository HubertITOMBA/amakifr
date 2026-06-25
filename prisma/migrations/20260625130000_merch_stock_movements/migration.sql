-- Historique des mouvements de stock boutique
CREATE TYPE "MerchStockMovementType" AS ENUM ('Commande', 'AjustementManuel', 'Reapprovisionnement');

CREATE TABLE "merch_stock_movements" (
    "id" TEXT NOT NULL,
    "variant_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "type" "MerchStockMovementType" NOT NULL,
    "quantite" INTEGER NOT NULL,
    "stock_avant" INTEGER NOT NULL,
    "stock_apres" INTEGER NOT NULL,
    "order_id" TEXT,
    "motif" VARCHAR(500),
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "merch_stock_movements_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "merch_stock_movements_variant_id_idx" ON "merch_stock_movements"("variant_id");
CREATE INDEX "merch_stock_movements_product_id_idx" ON "merch_stock_movements"("product_id");
CREATE INDEX "merch_stock_movements_order_id_idx" ON "merch_stock_movements"("order_id");
CREATE INDEX "merch_stock_movements_created_at_idx" ON "merch_stock_movements"("created_at");

ALTER TABLE "merch_stock_movements" ADD CONSTRAINT "merch_stock_movements_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "merch_product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "merch_stock_movements" ADD CONSTRAINT "merch_stock_movements_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "merch_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "merch_stock_movements" ADD CONSTRAINT "merch_stock_movements_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "merch_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "merch_stock_movements" ADD CONSTRAINT "merch_stock_movements_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
