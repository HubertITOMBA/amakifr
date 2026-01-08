-- ================================================================
-- Script de vérification de l'insertion des nouveaux adhérents
-- ================================================================

\echo '================================================================'
\echo 'Vérification des nouveaux adhérents'
\echo '================================================================'
\echo ''

-- 1. Vérifier les utilisateurs
\echo '1. UTILISATEURS CRÉÉS:'
\echo '------------------------------------------------------------'
SELECT 
    name AS "Nom",
    email AS "Email",
    role AS "Rôle",
    status AS "Statut",
    CASE WHEN "emailVerified" IS NOT NULL THEN 'Oui' ELSE 'Non' END AS "Email vérifié"
FROM users 
WHERE email IN (
    'maya.thethe@gmail.com',
    'eugenembongopasy@gmail.com',
    'mariemuilu243@gmail.com',
    'Jcmvuama@yahoo.fr',
    'jostshik@yahoo.fr'
)
ORDER BY name;

\echo ''
\echo '2. ADHÉRENTS CRÉÉS:'
\echo '------------------------------------------------------------'
SELECT 
    a.civility AS "Civilité",
    a.firstname AS "Prénom",
    a.lastname AS "Nom",
    CASE WHEN a."fraisAdhesionPaye" THEN 'Oui' ELSE 'Non' END AS "Frais payés",
    u.email AS "Email"
FROM adherent a
INNER JOIN users u ON a."userId" = u.id
WHERE u.email IN (
    'maya.thethe@gmail.com',
    'eugenembongopasy@gmail.com',
    'mariemuilu243@gmail.com',
    'Jcmvuama@yahoo.fr',
    'jostshik@yahoo.fr'
)
ORDER BY a.firstname;

\echo ''
\echo '3. ADRESSES CRÉÉES:'
\echo '------------------------------------------------------------'
SELECT 
    a.firstname || ' ' || a.lastname AS "Adhérent",
    COALESCE(ad.streetnum || ' ', '') || ad.street1 AS "Rue",
    ad.codepost AS "Code postal",
    ad.city AS "Ville",
    ad.country AS "Pays"
FROM adherent a
INNER JOIN users u ON a."userId" = u.id
INNER JOIN adresse ad ON ad."adherentId" = a.id 
WHERE u.email IN (
    'maya.thethe@gmail.com',
    'eugenembongopasy@gmail.com',
    'mariemuilu243@gmail.com',
    'Jcmvuama@yahoo.fr',
    'jostshik@yahoo.fr'
)
ORDER BY a.firstname;

\echo ''
\echo '4. TÉLÉPHONES CRÉÉS:'
\echo '------------------------------------------------------------'
SELECT 
    a.firstname || ' ' || a.lastname AS "Adhérent",
    t.numero AS "Téléphone",
    t.type AS "Type",
    CASE WHEN t."estPrincipal" THEN 'Oui' ELSE 'Non' END AS "Principal"
FROM adherent a
INNER JOIN users u ON a."userId" = u.id
INNER JOIN telephones t ON t."adherentId" = a.id
WHERE u.email IN (
    'maya.thethe@gmail.com',
    'eugenembongopasy@gmail.com',
    'mariemuilu243@gmail.com',
    'Jcmvuama@yahoo.fr',
    'jostshik@yahoo.fr'
)
ORDER BY a.firstname;

\echo ''
\echo '5. RÉSUMÉ GLOBAL:'
\echo '------------------------------------------------------------'
SELECT 
    u.name AS "Nom",
    u.email AS "Email",
    a.firstname || ' ' || a.lastname AS "Nom complet",
    ad.city AS "Ville",
    t.numero AS "Téléphone",
    u.status AS "Statut"
FROM users u
INNER JOIN adherent a ON a."userId" = u.id
LEFT JOIN adresse ad ON ad."adherentId" = a.id 
LEFT JOIN telephones t ON t."adherentId" = a.id AND t."estPrincipal" = true
WHERE u.email IN (
    'maya.thethe@gmail.com',
    'eugenembongopasy@gmail.com',
    'mariemuilu243@gmail.com',
    'Jcmvuama@yahoo.fr',
    'jostshik@yahoo.fr'
)
ORDER BY u.name;

\echo ''
\echo '================================================================'
\echo 'Vérification terminée'
\echo '================================================================'
