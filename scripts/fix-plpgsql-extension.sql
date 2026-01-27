-- Script pour activer l'extension PL/pgSQL dans PostgreSQL
-- À exécuter en tant que superutilisateur ou avec les droits appropriés

-- Activer l'extension PL/pgSQL
CREATE EXTENSION IF NOT EXISTS plpgsql;

-- Vérifier que l'extension est activée
SELECT extname, extversion 
FROM pg_extension 
WHERE extname = 'plpgsql';

-- Si l'extension n'est pas activée, cela peut être dû à :
-- 1. PostgreSQL n'est pas installé correctement
-- 2. Les fichiers de l'extension sont manquants
-- 3. L'utilisateur n'a pas les droits nécessaires

-- Pour vérifier les extensions disponibles :
-- SELECT * FROM pg_available_extensions WHERE name LIKE '%plpgsql%';
