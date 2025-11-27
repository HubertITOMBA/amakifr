-- Migration pour créer la table des villes Geonames
CREATE TABLE IF NOT EXISTS "GeonamesCity" (
    "id" SERIAL PRIMARY KEY,
    "geonameId" INTEGER NOT NULL UNIQUE,
    "name" VARCHAR(200) NOT NULL,
    "asciiName" VARCHAR(200),
    "alternateNames" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "countryCode" VARCHAR(2) NOT NULL,
    "admin1Code" VARCHAR(20),
    "admin2Code" VARCHAR(80),
    "admin3Code" VARCHAR(20),
    "admin4Code" VARCHAR(20),
    "population" BIGINT,
    "elevation" INTEGER,
    "timezone" VARCHAR(40),
    "featureClass" VARCHAR(1),
    "featureCode" VARCHAR(10),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Index pour les recherches rapides
CREATE INDEX IF NOT EXISTS "GeonamesCity_countryCode_idx" ON "GeonamesCity"("countryCode");
CREATE INDEX IF NOT EXISTS "GeonamesCity_name_idx" ON "GeonamesCity"("name");
CREATE INDEX IF NOT EXISTS "GeonamesCity_asciiName_idx" ON "GeonamesCity"("asciiName");
CREATE INDEX IF NOT EXISTS "GeonamesCity_countryCode_name_idx" ON "GeonamesCity"("countryCode", "name");

-- Index pour la recherche textuelle (si PostgreSQL avec pg_trgm)
-- CREATE EXTENSION IF NOT EXISTS pg_trgm;
-- CREATE INDEX IF NOT EXISTS "GeonamesCity_name_trgm_idx" ON "GeonamesCity" USING gin("name" gin_trgm_ops);

