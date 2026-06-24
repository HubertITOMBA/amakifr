-- Jeton de suivi public pour les commandes boutique (lien dans l'email de confirmation)
ALTER TABLE "merch_orders" ADD COLUMN IF NOT EXISTS "suivi_token" VARCHAR(64);

UPDATE "merch_orders"
SET "suivi_token" = md5(random()::text || id::text || clock_timestamp()::text)
WHERE "suivi_token" IS NULL;

ALTER TABLE "merch_orders" ALTER COLUMN "suivi_token" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "merch_orders_suivi_token_key" ON "merch_orders"("suivi_token");
