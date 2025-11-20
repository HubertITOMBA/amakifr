-- Migration pour ajouter les colonnes manquantes à la table adherent
-- Cette migration doit être appliquée en production
-- Elle vérifie l'existence de chaque colonne avant de l'ajouter pour éviter les erreurs

DO $$
BEGIN
    -- Ajouter dateNaissance si elle n'existe pas
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'adherent' 
        AND column_name = 'dateNaissance'
    ) THEN
        ALTER TABLE "adherent" ADD COLUMN "dateNaissance" TIMESTAMP(3);
    END IF;

    -- Ajouter typeAdhesion si elle n'existe pas
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'adherent' 
        AND column_name = 'typeAdhesion'
    ) THEN
        ALTER TABLE "adherent" ADD COLUMN "typeAdhesion" "TypeAdhesion";
    END IF;

    -- Ajouter profession si elle n'existe pas
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'adherent' 
        AND column_name = 'profession'
    ) THEN
        ALTER TABLE "adherent" ADD COLUMN "profession" VARCHAR(255);
    END IF;

    -- Ajouter centresInteret si elle n'existe pas
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'adherent' 
        AND column_name = 'centresInteret'
    ) THEN
        ALTER TABLE "adherent" ADD COLUMN "centresInteret" TEXT;
    END IF;

    -- Ajouter autorisationImage si elle n'existe pas
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'adherent' 
        AND column_name = 'autorisationImage'
    ) THEN
        ALTER TABLE "adherent" ADD COLUMN "autorisationImage" BOOLEAN DEFAULT false;
    END IF;

    -- Ajouter accepteCommunications si elle n'existe pas
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'adherent' 
        AND column_name = 'accepteCommunications'
    ) THEN
        ALTER TABLE "adherent" ADD COLUMN "accepteCommunications" BOOLEAN DEFAULT true;
    END IF;

    -- Ajouter nombreEnfants si elle n'existe pas
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'adherent' 
        AND column_name = 'nombreEnfants'
    ) THEN
        ALTER TABLE "adherent" ADD COLUMN "nombreEnfants" INTEGER DEFAULT 0;
    END IF;

    -- Ajouter evenementsFamiliaux si elle n'existe pas
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'adherent' 
        AND column_name = 'evenementsFamiliaux'
    ) THEN
        ALTER TABLE "adherent" ADD COLUMN "evenementsFamiliaux" TEXT;
    END IF;
END $$;

