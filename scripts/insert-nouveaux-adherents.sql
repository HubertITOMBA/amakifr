-- ================================================================
-- Script d'insertion de 5 nouveaux adhérents
-- Date: 2026-01-08
-- ================================================================
-- Ce script insère :
-- 1. Thérèse Mayakampongo (maya.thethe@gmail.com)
-- 2. Eugène Mbongo (eugenembongopasy@gmail.com)
-- 3. Marie Muilu (mariemuilu243@gmail.com)
-- 4. JC Mvuama (Jcmvuama@yahoo.fr)
-- 5. José Tshikuna (jostshik@yahoo.fr)
-- ================================================================

BEGIN;

-- ================================================================
-- 1. THÉRÈSE MAYAKAMPONGO
-- ================================================================

-- Insérer l'utilisateur
INSERT INTO users (
    id,
    name,
    email,
    email_verified,
    password,
    role,
    status,
    "createdAt",
    "updatedAt"
) VALUES (
    gen_random_uuid()::text || replace(gen_random_uuid()::text, '-', ''),
    'Thethe',
    'maya.thethe@gmail.com',
    NOW(),
    '$2b$10$sGs5y7rCBkg./6f6E0sWYevDjiUM4SqS8tX2KjVSlZkraKqgaV13S', -- Hash bcrypt du mot de passe 'password'
    'Membre',
    'Actif',
    NOW(),
    NOW()
);

-- Insérer l'adhérent
INSERT INTO adherent (
    id,
    "userId",
    civility,
    firstname,
    lastname,
    "typeAdhesion",
    "datePremiereAdhesion",
    "nombreEnfants",
    "autorisationImage",
    "accepteCommunications",
    "fraisAdhesionPaye"
) VALUES (
    gen_random_uuid()::text || replace(gen_random_uuid()::text, '-', ''),
    (SELECT id FROM users WHERE email = 'maya.thethe@gmail.com'),
    'Madame',
    'Thérèse',
    'Mayakampongo',
    'AdhesionAnnuelle',
    NOW(),
    0,
    false,
    true,
    false
);

-- Insérer l'adresse
INSERT INTO adresses (
    id,
    "adherentId",
    streetnum,
    street1,
    street2,
    codepost,
    city,
    country
) VALUES (
    gen_random_uuid()::text || replace(gen_random_uuid()::text, '-', ''),
    (SELECT id FROM adherent WHERE "userId" = (SELECT id FROM users WHERE email = 'maya.thethe@gmail.com')),
    '',
    '',
    '',
    '92390',
    'Villeneuve La Garenne',
    'France'
);

-- Insérer le téléphone
INSERT INTO telephones (
    id,
    "adherentId",
    numero,
    type,
    "estPrincipal"
) VALUES (
    gen_random_uuid()::text || replace(gen_random_uuid()::text, '-', ''),
    (SELECT id FROM adherent WHERE "userId" = (SELECT id FROM users WHERE email = 'maya.thethe@gmail.com')),
    '+33680595471',
    'Mobile',
    true
);

-- ================================================================
-- 2. EUGÈNE MBONGO
-- ================================================================

-- Insérer l'utilisateur
INSERT INTO users (
    id,
    name,
    email,
    email_verified,
    password,
    role,
    status,
    "createdAt",
    "updatedAt"
) VALUES (
    gen_random_uuid()::text || replace(gen_random_uuid()::text, '-', ''),
    'Eugène',
    'eugenembongopasy@gmail.com',
    NOW(),
    '$2b$10$sGs5y7rCBkg./6f6E0sWYevDjiUM4SqS8tX2KjVSlZkraKqgaV13S', -- Hash bcrypt du mot de passe 'password'
    'Membre',
    'Actif',
    NOW(),
    NOW()
);

-- Insérer l'adhérent
INSERT INTO adherent (
    id,
    "userId",
    civility,
    firstname,
    lastname,
    "typeAdhesion",
    "datePremiereAdhesion",
    "nombreEnfants",
    "autorisationImage",
    "accepteCommunications",
    "fraisAdhesionPaye"
) VALUES (
    gen_random_uuid()::text || replace(gen_random_uuid()::text, '-', ''),
    (SELECT id FROM users WHERE email = 'eugenembongopasy@gmail.com'),
    'Monsieur',
    'Eugène',
    'Mbongo',
    'AdhesionAnnuelle',
    NOW(),
    0,
    false,
    true,
    false
);

-- Insérer l'adresse
INSERT INTO adresses (
    id,
    "adherentId",
    streetnum,
    street1,
    street2,
    codepost,
    city,
    country
) VALUES (
    gen_random_uuid()::text || replace(gen_random_uuid()::text, '-', ''),
    (SELECT id FROM adherent WHERE "userId" = (SELECT id FROM users WHERE email = 'eugenembongopasy@gmail.com')),
    '7',
    'Rue de la libération',
    '',
    '91070',
    'Bondoufle',
    'France'
);

-- Insérer le téléphone
INSERT INTO telephones (
    id,
    "adherentId",
    numero,
    type,
    "estPrincipal"
) VALUES (
    gen_random_uuid()::text || replace(gen_random_uuid()::text, '-', ''),
    (SELECT id FROM adherent WHERE "userId" = (SELECT id FROM users WHERE email = 'eugenembongopasy@gmail.com')),
    '+33625506069',
    'Mobile',
    true
);

-- ================================================================
-- 3. MARIE MUILU
-- ================================================================

-- Insérer l'utilisateur
INSERT INTO users (
    id,
    name,
    email,
    email_verified,
    password,
    role,
    status,
    "createdAt",
    "updatedAt"
) VALUES (
    gen_random_uuid()::text || replace(gen_random_uuid()::text, '-', ''),
    'Marie',
    'mariemuilu243@gmail.com',
    NOW(),
    '$2b$10$sGs5y7rCBkg./6f6E0sWYevDjiUM4SqS8tX2KjVSlZkraKqgaV13S', -- Hash bcrypt du mot de passe 'password'
    'Membre',
    'Actif',
    NOW(),
    NOW()
);

-- Insérer l'adhérent
INSERT INTO adherent (
    id,
    "userId",
    civility,
    firstname,
    lastname,
    "typeAdhesion",
    "datePremiereAdhesion",
    "nombreEnfants",
    "autorisationImage",
    "accepteCommunications",
    "fraisAdhesionPaye"
) VALUES (
    gen_random_uuid()::text || replace(gen_random_uuid()::text, '-', ''),
    (SELECT id FROM users WHERE email = 'mariemuilu243@gmail.com'),
    'Madame',
    'Marie',
    'Muilu',
    'AdhesionAnnuelle',
    NOW(),
    0,
    false,
    true,
    false
);

-- Insérer l'adresse
INSERT INTO adresses (
    id,
    "adherentId",
    streetnum,
    street1,
    street2,
    codepost,
    city,
    country
) VALUES (
    gen_random_uuid()::text || replace(gen_random_uuid()::text, '-', ''),
    (SELECT id FROM adherent WHERE "userId" = (SELECT id FROM users WHERE email = 'mariemuilu243@gmail.com')),
    '292',
    'rue des pièces de Lugny',
    '',
    '77550',
    'Moissy Cramayel',
    'France'
);

-- Insérer le téléphone
INSERT INTO telephones (
    id,
    "adherentId",
    numero,
    type,
    "estPrincipal"
) VALUES (
    gen_random_uuid()::text || replace(gen_random_uuid()::text, '-', ''),
    (SELECT id FROM adherent WHERE "userId" = (SELECT id FROM users WHERE email = 'mariemuilu243@gmail.com')),
    '+33634310747',
    'Mobile',
    true
);

-- ================================================================
-- 4. JC MVUAMA
-- ================================================================

-- Insérer l'utilisateur
INSERT INTO users (
    id,
    name,
    email,
    email_verified,
    password,
    role,
    status,
    "createdAt",
    "updatedAt"
) VALUES (
    gen_random_uuid()::text || replace(gen_random_uuid()::text, '-', ''),
    'Azalya',
    'Jcmvuama@yahoo.fr',
    NOW(),
    '$2b$10$sGs5y7rCBkg./6f6E0sWYevDjiUM4SqS8tX2KjVSlZkraKqgaV13S', -- Hash bcrypt du mot de passe 'password'
    'Membre',
    'Actif',
    NOW(),
    NOW()
);

-- Insérer l'adhérent
INSERT INTO adherent (
    id,
    "userId",
    civility,
    firstname,
    lastname,
    "typeAdhesion",
    "datePremiereAdhesion",
    "nombreEnfants",
    "autorisationImage",
    "accepteCommunications",
    "fraisAdhesionPaye"
) VALUES (
    gen_random_uuid()::text || replace(gen_random_uuid()::text, '-', ''),
    (SELECT id FROM users WHERE email = 'Jcmvuama@yahoo.fr'),
    'Monsieur',
    'JC',
    'Mvuama',
    'AdhesionAnnuelle',
    NOW(),
    0,
    false,
    true,
    false
);

-- Insérer l'adresse (vide car pas d'infos)
INSERT INTO adresses (
    id,
    "adherentId",
    streetnum,
    street1,
    street2,
    codepost,
    city,
    country
) VALUES (
    gen_random_uuid()::text || replace(gen_random_uuid()::text, '-', ''),
    (SELECT id FROM adherent WHERE "userId" = (SELECT id FROM users WHERE email = 'Jcmvuama@yahoo.fr')),
    '',
    '',
    '',
    '',
    '',
    'France'
);

-- Insérer le téléphone
INSERT INTO telephones (
    id,
    "adherentId",
    numero,
    type,
    "estPrincipal"
) VALUES (
    gen_random_uuid()::text || replace(gen_random_uuid()::text, '-', ''),
    (SELECT id FROM adherent WHERE "userId" = (SELECT id FROM users WHERE email = 'Jcmvuama@yahoo.fr')),
    '+33784846102',
    'Mobile',
    true
);

-- ================================================================
-- 5. JOSÉ TSHIKUNA
-- ================================================================

-- Insérer l'utilisateur
INSERT INTO users (
    id,
    name,
    email,
    email_verified,
    password,
    role,
    status,
    "createdAt",
    "updatedAt"
) VALUES (
    gen_random_uuid()::text || replace(gen_random_uuid()::text, '-', ''),
    'José',
    'jostshik@yahoo.fr',
    NOW(),
    '$2b$10$sGs5y7rCBkg./6f6E0sWYevDjiUM4SqS8tX2KjVSlZkraKqgaV13S', -- Hash bcrypt du mot de passe 'password'
    'Membre',
    'Actif',
    NOW(),
    NOW()
);

-- Insérer l'adhérent
INSERT INTO adherent (
    id,
    "userId",
    civility,
    firstname,
    lastname,
    "typeAdhesion",
    "datePremiereAdhesion",
    "nombreEnfants",
    "autorisationImage",
    "accepteCommunications",
    "fraisAdhesionPaye"
) VALUES (
    gen_random_uuid()::text || replace(gen_random_uuid()::text, '-', ''),
    (SELECT id FROM users WHERE email = 'jostshik@yahoo.fr'),
    'Monsieur',
    'José',
    'Tshikuna',
    'AdhesionAnnuelle',
    NOW(),
    0,
    false,
    true,
    false
);

-- Insérer l'adresse (partielle car seule la ville est connue)
INSERT INTO adresses (
    id,
    "adherentId",
    streetnum,
    street1,
    street2,
    codepost,
    city,
    country
) VALUES (
    gen_random_uuid()::text || replace(gen_random_uuid()::text, '-', ''),
    (SELECT id FROM adherent WHERE "userId" = (SELECT id FROM users WHERE email = 'jostshik@yahoo.fr')),
    '',
    '',
    '',
    '',
    'Courcouronnes',
    'France'
);

-- Insérer le téléphone
INSERT INTO telephones (
    id,
    "adherentId",
    numero,
    type,
    "estPrincipal"
) VALUES (
    gen_random_uuid()::text || replace(gen_random_uuid()::text, '-', ''),
    (SELECT id FROM adherent WHERE "userId" = (SELECT id FROM users WHERE email = 'jostshik@yahoo.fr')),
    '+33695365359',
    'Mobile',
    true
);

-- ================================================================
-- VÉRIFICATIONS
-- ================================================================

-- Vérifier les insertions
SELECT 
    u.name AS "Nom",
    u.email AS "Email",
    a.firstname AS "Prénom",
    a.lastname AS "Nom de famille",
    ad.city AS "Ville",
    t.numero AS "Téléphone"
FROM users u
INNER JOIN adherents a ON a."userId" = u.id
LEFT JOIN adresses ad ON ad."adherentId" = a.id
LEFT JOIN telephones t ON t."adherentId" = a.id AND t."estPrincipal" = true
WHERE u.email IN (
    'maya.thethe@gmail.com',
    'eugenembongopasy@gmail.com',
    'mariemuilu243@gmail.com',
    'Jcmvuama@yahoo.fr',
    'jostshik@yahoo.fr'
)
ORDER BY u.name;

COMMIT;

-- ================================================================
-- INSTRUCTIONS D'UTILISATION
-- ================================================================
-- 
-- 1. AVANT d'exécuter ce script, générer les hash des mots de passe:
--    Remplacer '$2a$10$YourHashedPasswordHere' par le vrai hash
--    
--    Vous pouvez utiliser bcrypt pour générer le hash:
--    - En ligne: https://bcrypt-generator.com/
--    - En Node.js: bcrypt.hashSync('password', 10)
--
-- 2. Exécuter le script en production:
--    psql -h <DB_HOST> -p <DB_PORT> -U <DB_USER> -d <DB_NAME> -f scripts/insert-nouveaux-adherents.sql
--
-- 3. En cas d'erreur, la transaction sera annulée automatiquement (ROLLBACK)
--
-- 4. Les 5 adhérents seront créés avec:
--    - Un compte utilisateur (role: Membre, status: Actif)
--    - Un profil adhérent complet
--    - Une adresse principale
--    - Un téléphone principal
--
-- ================================================================
