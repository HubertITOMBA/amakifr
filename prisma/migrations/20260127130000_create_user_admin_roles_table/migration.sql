-- Créer l'enum AdminRole s'il n'existe pas déjà
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AdminRole') THEN
        CREATE TYPE "AdminRole" AS ENUM ('ADMIN', 'PRESID', 'VICEPR', 'SECRET', 'VICESE', 'TRESOR', 'VTRESO', 'COMCPT');
    END IF;
END $$;

-- Créer la table user_admin_roles si elle n'existe pas déjà
CREATE TABLE IF NOT EXISTS "user_admin_roles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "AdminRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_admin_roles_pkey" PRIMARY KEY ("id")
);

-- Créer les index si ils n'existent pas déjà
CREATE INDEX IF NOT EXISTS "user_admin_roles_userId_idx" ON "user_admin_roles"("userId");
CREATE INDEX IF NOT EXISTS "user_admin_roles_role_idx" ON "user_admin_roles"("role");
CREATE INDEX IF NOT EXISTS "user_admin_roles_createdBy_idx" ON "user_admin_roles"("createdBy");

-- Créer la contrainte unique si elle n'existe pas déjà
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'user_admin_roles_userId_role_key'
    ) THEN
        ALTER TABLE "user_admin_roles" ADD CONSTRAINT "user_admin_roles_userId_role_key" UNIQUE ("userId", "role");
    END IF;
END $$;

-- Créer les clés étrangères si elles n'existent pas déjà
DO $$
BEGIN
    -- Clé étrangère vers users (userId)
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'user_admin_roles_userId_fkey'
    ) THEN
        ALTER TABLE "user_admin_roles" 
        ADD CONSTRAINT "user_admin_roles_userId_fkey" 
        FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    
    -- Clé étrangère vers users (createdBy)
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'user_admin_roles_createdBy_fkey'
    ) THEN
        ALTER TABLE "user_admin_roles" 
        ADD CONSTRAINT "user_admin_roles_createdBy_fkey" 
        FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;
