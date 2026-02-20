-- Migration production-safe : rendre adherentHoteId nullable sur reunions_mensuelles
-- (nécessaire après désistement : l'hôte peut se retirer, le mois reste sans hôte)
-- Idempotent : ne fait rien si la table n'existe pas ou si la colonne est déjà nullable.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'reunions_mensuelles'
  ) THEN
    ALTER TABLE "reunions_mensuelles"
      ALTER COLUMN "adherentHoteId" DROP NOT NULL;
  END IF;
END $$;
