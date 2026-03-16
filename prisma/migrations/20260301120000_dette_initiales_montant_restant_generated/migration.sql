-- Rendre montantRestant calculé (GENERATED) sur dettes_initiales
-- montantRestant = montant - montantPaye (plus de stockage redondant, cohérence garantie)
-- Production-safe : idempotent si la colonne est déjà générée (à exécuter une seule fois)

DO $$
BEGIN
  -- Vérifier que la table existe et que montantRestant existe encore en colonne stockée
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'dettes_initiales' AND column_name = 'montantRestant'
  ) THEN
    -- Supprimer l'ancienne colonne stockée
    ALTER TABLE "dettes_initiales" DROP COLUMN "montantRestant";
    -- Ajouter la colonne générée (calculée)
    ALTER TABLE "dettes_initiales" ADD COLUMN "montantRestant" DECIMAL(10,2) GENERATED ALWAYS AS ("montant" - "montantPaye") STORED;
  END IF;
END $$;
