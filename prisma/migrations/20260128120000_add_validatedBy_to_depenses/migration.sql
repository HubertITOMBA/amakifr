-- Migration pour ajouter la colonne validatedBy à la table depenses
-- Cette colonne permet de suivre quel admin a validé une dépense

-- Vérifier si la colonne existe déjà avant de l'ajouter
DO $$
BEGIN
    -- Ajouter la colonne validatedBy si elle n'existe pas
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'depenses' 
        AND column_name = 'validatedBy'
    ) THEN
        ALTER TABLE "depenses" ADD COLUMN "validatedBy" TEXT;
        
        -- Créer un index sur validatedBy pour améliorer les performances
        CREATE INDEX IF NOT EXISTS "depenses_validatedBy_idx" ON "depenses"("validatedBy");
        
        -- Ajouter la contrainte de clé étrangère vers users
        ALTER TABLE "depenses" 
        ADD CONSTRAINT "depenses_validatedBy_fkey" 
        FOREIGN KEY ("validatedBy") 
        REFERENCES "users"("id") 
        ON DELETE SET NULL 
        ON UPDATE CASCADE;
    END IF;
END $$;
