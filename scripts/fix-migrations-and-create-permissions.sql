-- Script SQL pour résoudre les migrations bloquées et créer la table permissions
-- À exécuter manuellement dans psql

-- 1. Vérifier l'état de la migration échouée
SELECT migration_name, started_at, finished_at, rolled_back_at 
FROM _prisma_migrations 
WHERE migration_name = '20260127130000_create_user_admin_roles_table';

-- 2. Si la table user_admin_roles existe, marquer la migration comme appliquée
-- Sinon, la marquer comme rolled-back
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'user_admin_roles'
    ) THEN
        -- La table existe, marquer la migration comme appliquée
        UPDATE _prisma_migrations 
        SET finished_at = NOW(), 
            rolled_back_at = NULL
        WHERE migration_name = '20260127130000_create_user_admin_roles_table'
        AND finished_at IS NULL;
        
        RAISE NOTICE 'Migration 20260127130000_create_user_admin_roles_table marquée comme appliquée';
    ELSE
        -- La table n'existe pas, marquer comme rolled-back
        UPDATE _prisma_migrations 
        SET rolled_back_at = NOW()
        WHERE migration_name = '20260127130000_create_user_admin_roles_table'
        AND rolled_back_at IS NULL;
        
        RAISE NOTICE 'Migration 20260127130000_create_user_admin_roles_table marquée comme rolled-back';
    END IF;
END $$;

-- 3. Vérifier si la table permissions existe déjà
SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'permissions'
) AS permissions_table_exists;

-- 4. Si la table permissions n'existe pas, créer l'enum et la table
-- (Le contenu complet de la migration est dans le fichier migration.sql)

-- Note: Pour appliquer la migration complète, exécutez:
-- \i prisma/migrations/20260129000000_create_permissions_table/migration.sql
-- Ou copiez-collez le contenu du fichier migration.sql
