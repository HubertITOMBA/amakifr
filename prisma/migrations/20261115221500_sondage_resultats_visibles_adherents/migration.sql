-- Publication explicite des résultats collectifs aux adhérents (indépendante de la clôture).
ALTER TABLE "sondages"
  ADD COLUMN IF NOT EXISTS "resultatsVisiblesAdherents" BOOLEAN NOT NULL DEFAULT false;
