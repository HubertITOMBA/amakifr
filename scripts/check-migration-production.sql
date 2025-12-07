-- Script de vérification avant d'appliquer la migration en production
-- Exécutez ce script AVANT d'appliquer la migration pour vérifier l'état de la base de données

-- 1. Vérifier l'existence de l'ancienne contrainte unique
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 
            FROM pg_constraint 
            WHERE conname = 'cotisations_du_mois_periode_typeCotisationId_key'
            AND conrelid = 'cotisations_du_mois'::regclass
        ) THEN 'EXISTE - sera supprimée'
        ELSE 'N''EXISTE PAS - déjà supprimée ou jamais créée'
    END as ancienne_contrainte;

-- 2. Vérifier l'existence de la nouvelle contrainte unique
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 
            FROM pg_constraint 
            WHERE conname = 'cotisations_du_mois_periode_adherentBeneficiaireId_key'
            AND conrelid = 'cotisations_du_mois'::regclass
        ) THEN 'EXISTE DÉJÀ - migration peut-être déjà appliquée'
        ELSE 'N''EXISTE PAS - sera créée'
    END as nouvelle_contrainte;

-- 3. Vérifier s'il y a des doublons qui violeraient la nouvelle contrainte
-- (un adhérent avec plusieurs assistances dans la même période)
SELECT 
    periode,
    "adherentBeneficiaireId",
    COUNT(*) as nombre_doublons,
    STRING_AGG(id::text, ', ') as ids_cotisations
FROM cotisations_du_mois
WHERE "adherentBeneficiaireId" IS NOT NULL
GROUP BY periode, "adherentBeneficiaireId"
HAVING COUNT(*) > 1;

-- Si cette requête retourne des lignes, il y a des doublons à corriger AVANT la migration

-- 4. Statistiques sur les cotisations du mois
SELECT 
    COUNT(*) as total_cotisations,
    COUNT(DISTINCT periode) as nombre_periodes,
    COUNT(DISTINCT "typeCotisationId") as nombre_types,
    COUNT(DISTINCT "adherentBeneficiaireId") FILTER (WHERE "adherentBeneficiaireId" IS NOT NULL) as nombre_adherents_beneficiaires,
    COUNT(*) FILTER (WHERE "adherentBeneficiaireId" IS NOT NULL) as nombre_assistances
FROM cotisations_du_mois;

-- 5. Liste des contraintes et index actuels sur la table
SELECT 
    conname as nom_contrainte,
    contype as type_contrainte,
    CASE contype
        WHEN 'u' THEN 'UNIQUE'
        WHEN 'p' THEN 'PRIMARY KEY'
        WHEN 'f' THEN 'FOREIGN KEY'
        WHEN 'c' THEN 'CHECK'
        ELSE 'AUTRE'
    END as type_description
FROM pg_constraint
WHERE conrelid = 'cotisations_du_mois'::regclass
ORDER BY conname;

-- 6. Liste des index sur la table
SELECT 
    indexname as nom_index,
    indexdef as definition
FROM pg_indexes
WHERE tablename = 'cotisations_du_mois'
ORDER BY indexname;

