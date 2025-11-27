-- Migration: Ajouter le champ anneePromotion à la table adherent
-- Date: 2025-01-XX

-- Ajouter la colonne anneePromotion (optionnelle, VARCHAR(10))
ALTER TABLE "adherent" 
ADD COLUMN IF NOT EXISTS "anneePromotion" VARCHAR(10);

-- Commentaire sur la colonne
COMMENT ON COLUMN "adherent"."anneePromotion" IS 'Année de promotion à Kipaku (ex: "2010" ou "Non")';

