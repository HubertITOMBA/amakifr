-- Migration sécurisée pour la production
-- Ajoute la contrainte unique sur [periode, adherentBeneficiaireId]
-- et supprime l'ancienne contrainte unique sur [periode, typeCotisationId]
-- 
-- IMPORTANT: Cette migration préserve toutes les données existantes

BEGIN;

-- Étape 1: Vérifier s'il existe des doublons qui violeraient la nouvelle contrainte
-- (un adhérent avec plusieurs assistances dans la même période)
DO $$
DECLARE
    duplicate_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO duplicate_count
    FROM (
        SELECT periode, "adherentBeneficiaireId", COUNT(*) as cnt
        FROM cotisations_du_mois
        WHERE "adherentBeneficiaireId" IS NOT NULL
        GROUP BY periode, "adherentBeneficiaireId"
        HAVING COUNT(*) > 1
    ) duplicates;
    
    IF duplicate_count > 0 THEN
        RAISE EXCEPTION 'ERREUR: % doublon(s) détecté(s). Un adhérent ne peut avoir qu''une seule assistance par période. Veuillez corriger les données avant d''appliquer cette migration.', duplicate_count;
    END IF;
    
    RAISE NOTICE 'Vérification des doublons: OK (aucun doublon détecté)';
END $$;

-- Étape 2: Supprimer l'ancienne contrainte unique si elle existe
DO $$
BEGIN
    -- Vérifier si la contrainte existe avant de la supprimer
    IF EXISTS (
        SELECT 1 
        FROM pg_constraint 
        WHERE conname = 'cotisations_du_mois_periode_typeCotisationId_key'
        AND conrelid = 'cotisations_du_mois'::regclass
    ) THEN
        ALTER TABLE cotisations_du_mois 
        DROP CONSTRAINT cotisations_du_mois_periode_typeCotisationId_key;
        RAISE NOTICE 'Ancienne contrainte unique [periode, typeCotisationId] supprimée';
    ELSE
        RAISE NOTICE 'Ancienne contrainte unique [periode, typeCotisationId] n''existe pas (déjà supprimée ou jamais créée)';
    END IF;
END $$;

-- Étape 3: Créer un index non-unique sur [periode, typeCotisationId] pour les performances
-- (si l'index n'existe pas déjà)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_indexes 
        WHERE indexname = 'cotisations_du_mois_periode_typeCotisationId_idx'
        AND tablename = 'cotisations_du_mois'
    ) THEN
        CREATE INDEX cotisations_du_mois_periode_typeCotisationId_idx 
        ON cotisations_du_mois(periode, "typeCotisationId");
        RAISE NOTICE 'Index [periode, typeCotisationId] créé';
    ELSE
        RAISE NOTICE 'Index [periode, typeCotisationId] existe déjà';
    END IF;
END $$;

-- Étape 4: Ajouter la nouvelle contrainte unique sur [periode, adherentBeneficiaireId]
-- Cette contrainte permet plusieurs NULL (PostgreSQL autorise cela dans les contraintes uniques)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_constraint 
        WHERE conname = 'cotisations_du_mois_periode_adherentBeneficiaireId_key'
        AND conrelid = 'cotisations_du_mois'::regclass
    ) THEN
        CREATE UNIQUE INDEX cotisations_du_mois_periode_adherentBeneficiaireId_key 
        ON cotisations_du_mois(periode, "adherentBeneficiaireId");
        RAISE NOTICE 'Nouvelle contrainte unique [periode, adherentBeneficiaireId] créée';
    ELSE
        RAISE NOTICE 'Nouvelle contrainte unique [periode, adherentBeneficiaireId] existe déjà';
    END IF;
END $$;

-- Étape 5: Vérifier que les autres index nécessaires existent
DO $$
BEGIN
    -- Index sur annee
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'cotisations_du_mois_annee_idx' 
        AND tablename = 'cotisations_du_mois'
    ) THEN
        CREATE INDEX cotisations_du_mois_annee_idx ON cotisations_du_mois(annee);
        RAISE NOTICE 'Index [annee] créé';
    END IF;
    
    -- Index sur mois
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'cotisations_du_mois_mois_idx' 
        AND tablename = 'cotisations_du_mois'
    ) THEN
        CREATE INDEX cotisations_du_mois_mois_idx ON cotisations_du_mois(mois);
        RAISE NOTICE 'Index [mois] créé';
    END IF;
    
    -- Index sur statut
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'cotisations_du_mois_statut_idx' 
        AND tablename = 'cotisations_du_mois'
    ) THEN
        CREATE INDEX cotisations_du_mois_statut_idx ON cotisations_du_mois(statut);
        RAISE NOTICE 'Index [statut] créé';
    END IF;
    
    -- Index sur adherentBeneficiaireId
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'cotisations_du_mois_adherentBeneficiaireId_idx' 
        AND tablename = 'cotisations_du_mois'
    ) THEN
        CREATE INDEX cotisations_du_mois_adherentBeneficiaireId_idx 
        ON cotisations_du_mois("adherentBeneficiaireId");
        RAISE NOTICE 'Index [adherentBeneficiaireId] créé';
    END IF;
END $$;

COMMIT;

-- Message de confirmation
DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Migration appliquée avec succès !';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Contraintes mises à jour:';
    RAISE NOTICE '  - Ancienne contrainte [periode, typeCotisationId] supprimée';
    RAISE NOTICE '  - Nouvelle contrainte [periode, adherentBeneficiaireId] ajoutée';
    RAISE NOTICE '  - Index de performance créés/vérifiés';
    RAISE NOTICE '========================================';
END $$;

