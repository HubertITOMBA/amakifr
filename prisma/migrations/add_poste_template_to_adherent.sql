-- Migration pour ajouter le champ posteTemplateId à la table adherent
-- Cette migration doit être appliquée en production
-- Elle vérifie l'existence de la colonne avant de l'ajouter pour éviter les erreurs

DO $$
BEGIN
    -- Ajouter posteTemplateId si elle n'existe pas
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'adherent' 
        AND column_name = 'posteTemplateId'
    ) THEN
        ALTER TABLE "adherent" ADD COLUMN "posteTemplateId" VARCHAR(255);
    END IF;
END $$;

-- Ajouter la contrainte de clé étrangère si elle n'existe pas
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_schema = 'public' 
        AND table_name = 'adherent' 
        AND constraint_name = 'adherent_posteTemplateId_fkey'
    ) THEN
        ALTER TABLE "adherent"
        ADD CONSTRAINT "adherent_posteTemplateId_fkey" 
        FOREIGN KEY ("posteTemplateId") 
        REFERENCES "postes_templates"("id") 
        ON DELETE SET NULL 
        ON UPDATE CASCADE;
    END IF;
END $$;

-- Créer un index pour améliorer les performances des requêtes
CREATE INDEX IF NOT EXISTS "adherent_posteTemplateId_idx" 
ON "adherent"("posteTemplateId");

-- Optionnel: Assigner le poste par défaut "Membre de l'association" aux adhérents existants
-- Cette requête nécessite que le poste avec le code "MEMBRE" existe déjà
-- Elle peut être exécutée séparément après avoir créé les postes
DO $$
DECLARE
    membre_id VARCHAR(255);
BEGIN
    -- Récupérer l'ID du poste "MEMBRE"
    SELECT "id" INTO membre_id
    FROM "postes_templates" 
    WHERE "code" = 'MEMBRE' 
    LIMIT 1;
    
    -- Si le poste existe, assigner aux adhérents sans poste
    IF membre_id IS NOT NULL THEN
        UPDATE "adherent" 
        SET "posteTemplateId" = membre_id
        WHERE "posteTemplateId" IS NULL;
        
        RAISE NOTICE 'Poste par défaut assigné aux adhérents existants';
    ELSE
        RAISE NOTICE 'Le poste MEMBRE n''existe pas encore. Veuillez l''exécuter après avoir créé les postes.';
    END IF;
END $$;

