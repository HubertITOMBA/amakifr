-- Script SQL pour exporter le schéma de la base de données
-- Usage: psql -U postgres -d amakifr -f scripts/export-schema.sql > schema-export.txt

-- Lister toutes les tables
SELECT 
    'TABLE' as type,
    table_name as name,
    NULL as detail
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- Lister toutes les colonnes avec leurs types
SELECT 
    'COLUMN' as type,
    table_name as name,
    column_name || ' (' || data_type || 
    CASE 
        WHEN is_nullable = 'NO' THEN ' NOT NULL'
        ELSE ''
    END || 
    CASE 
        WHEN column_default IS NOT NULL THEN ' DEFAULT ' || column_default
        ELSE ''
    END || ')' as detail
FROM information_schema.columns
WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;

-- Lister toutes les contraintes
SELECT 
    'CONSTRAINT' as type,
    table_name as name,
    constraint_name || ' (' || constraint_type || ')' as detail
FROM information_schema.table_constraints
WHERE table_schema = 'public'
ORDER BY table_name, constraint_name;

