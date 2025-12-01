-- Migration pour ajouter la contrainte unique sur le champ name de la table users
-- Cette migration doit être appliquée manuellement

-- Vérifier si la contrainte unique existe déjà
DO $$
BEGIN
    -- Vérifier si l'index unique existe déjà
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_indexes 
        WHERE schemaname = 'public' 
        AND tablename = 'users' 
        AND indexname = 'users_name_key'
    ) THEN
        -- Supprimer les doublons de noms avant d'ajouter la contrainte unique
        -- Garder le premier utilisateur avec chaque nom et mettre à jour les autres avec un nom unique
        UPDATE users u1
        SET name = u1.name || '_' || SUBSTRING(u1.id, 1, 8)
        FROM (
            SELECT name, MIN(id) as first_id
            FROM users
            WHERE name IS NOT NULL
            GROUP BY name
            HAVING COUNT(*) > 1
        ) duplicates
        WHERE u1.name = duplicates.name
        AND u1.id != duplicates.first_id;
        
        -- Ajouter la contrainte unique
        ALTER TABLE "users" ADD CONSTRAINT "users_name_key" UNIQUE ("name");
        
        RAISE NOTICE 'Contrainte unique ajoutée sur users.name';
    ELSE
        RAISE NOTICE 'La contrainte unique sur users.name existe déjà';
    END IF;
END $$;

