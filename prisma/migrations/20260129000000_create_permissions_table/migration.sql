-- Migration pour créer la table permissions et initialiser les permissions par défaut
-- Cette table permet de gérer les permissions dynamiquement sans rebuild de l'application

-- Créer l'enum PermissionType si elle n'existe pas déjà
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PermissionType') THEN
        CREATE TYPE "PermissionType" AS ENUM ('READ', 'WRITE', 'DELETE', 'MANAGE');
    END IF;
END $$;

-- Créer la table permissions si elle n'existe pas déjà
CREATE TABLE IF NOT EXISTS "permissions" (
    "id" TEXT NOT NULL,
    "action" VARCHAR(255) NOT NULL,
    "resource" VARCHAR(100) NOT NULL,
    "type" "PermissionType" NOT NULL,
    "roles" TEXT[] NOT NULL DEFAULT '{}',
    "description" VARCHAR(500),
    "route" VARCHAR(255),
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- Créer les index
CREATE INDEX IF NOT EXISTS "permissions_action_idx" ON "permissions"("action");
CREATE INDEX IF NOT EXISTS "permissions_resource_idx" ON "permissions"("resource");
CREATE INDEX IF NOT EXISTS "permissions_type_idx" ON "permissions"("type");
CREATE INDEX IF NOT EXISTS "permissions_enabled_idx" ON "permissions"("enabled");
CREATE INDEX IF NOT EXISTS "permissions_route_idx" ON "permissions"("route");

-- Créer la contrainte unique sur (action, type)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'permissions_action_type_key'
    ) THEN
        ALTER TABLE "permissions" ADD CONSTRAINT "permissions_action_type_key" UNIQUE ("action", "type");
    END IF;
END $$;

-- Ajouter la clé étrangère vers users si elle n'existe pas déjà
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'permissions_createdBy_fkey'
    ) THEN
        ALTER TABLE "permissions" 
        ADD CONSTRAINT "permissions_createdBy_fkey" 
        FOREIGN KEY ("createdBy") 
        REFERENCES "users"("id") 
        ON DELETE SET NULL 
        ON UPDATE CASCADE;
    END IF;
END $$;

-- Initialiser les permissions par défaut pour les actions financières
-- Permissions pour getAllDettesInitiales (READ)
INSERT INTO "permissions" ("id", "action", "resource", "type", "roles", "description", "route", "enabled", "createdAt", "updatedAt")
VALUES 
    ('perm_dettes_read', 'getAllDettesInitiales', 'finances', 'READ', ARRAY['ADMIN', 'PRESID', 'VICEPR', 'SECRET', 'VICESE', 'TRESOR', 'VTRESO', 'COMCPT'], 'Lecture des dettes initiales', '/admin/finances/dettes', true, NOW(), NOW())
ON CONFLICT ("action", "type") DO NOTHING;

-- Permissions pour createDetteInitiale (WRITE)
INSERT INTO "permissions" ("id", "action", "resource", "type", "roles", "description", "route", "enabled", "createdAt", "updatedAt")
VALUES 
    ('perm_dettes_create', 'createDetteInitiale', 'finances', 'WRITE', ARRAY['ADMIN', 'TRESOR', 'VTRESO', 'COMCPT'], 'Création de dettes initiales', '/admin/finances/dettes', true, NOW(), NOW())
ON CONFLICT ("action", "type") DO NOTHING;

-- Permissions pour updateDetteInitiale (WRITE)
INSERT INTO "permissions" ("id", "action", "resource", "type", "roles", "description", "route", "enabled", "createdAt", "updatedAt")
VALUES 
    ('perm_dettes_update', 'updateDetteInitiale', 'finances', 'WRITE', ARRAY['ADMIN', 'TRESOR', 'VTRESO', 'COMCPT'], 'Modification de dettes initiales', '/admin/finances/dettes', true, NOW(), NOW())
ON CONFLICT ("action", "type") DO NOTHING;

-- Permissions pour getDetteInitialeById (READ)
INSERT INTO "permissions" ("id", "action", "resource", "type", "roles", "description", "route", "enabled", "createdAt", "updatedAt")
VALUES 
    ('perm_dettes_read_one', 'getDetteInitialeById', 'finances', 'READ', ARRAY['ADMIN', 'PRESID', 'VICEPR', 'SECRET', 'VICESE', 'TRESOR', 'VTRESO', 'COMCPT'], 'Lecture d''une dette initiale', '/admin/finances/dettes', true, NOW(), NOW())
ON CONFLICT ("action", "type") DO NOTHING;

-- Permissions pour getAllPaiements (READ)
INSERT INTO "permissions" ("id", "action", "resource", "type", "roles", "description", "route", "enabled", "createdAt", "updatedAt")
VALUES 
    ('perm_paiements_read', 'getAllPaiements', 'finances', 'READ', ARRAY['ADMIN', 'PRESID', 'VICEPR', 'SECRET', 'VICESE', 'TRESOR', 'VTRESO', 'COMCPT'], 'Lecture des paiements', '/admin/finances/paiements', true, NOW(), NOW())
ON CONFLICT ("action", "type") DO NOTHING;

-- Permissions pour getAllAssistances (READ)
INSERT INTO "permissions" ("id", "action", "resource", "type", "roles", "description", "route", "enabled", "createdAt", "updatedAt")
VALUES 
    ('perm_assistances_read', 'getAllAssistances', 'finances', 'READ', ARRAY['ADMIN', 'PRESID', 'VICEPR', 'SECRET', 'VICESE', 'TRESOR', 'VTRESO', 'COMCPT'], 'Lecture des assistances', '/admin/finances/assistances', true, NOW(), NOW())
ON CONFLICT ("action", "type") DO NOTHING;

-- Permissions pour getFinancialStats (READ)
INSERT INTO "permissions" ("id", "action", "resource", "type", "roles", "description", "route", "enabled", "createdAt", "updatedAt")
VALUES 
    ('perm_finances_stats', 'getFinancialStats', 'finances', 'READ', ARRAY['ADMIN', 'PRESID', 'VICEPR', 'SECRET', 'VICESE', 'TRESOR', 'VTRESO', 'COMCPT'], 'Lecture des statistiques financières', '/admin/finances', true, NOW(), NOW())
ON CONFLICT ("action", "type") DO NOTHING;

-- Permissions pour createPaiementGeneral (WRITE)
INSERT INTO "permissions" ("id", "action", "resource", "type", "roles", "description", "route", "enabled", "createdAt", "updatedAt")
VALUES 
    ('perm_paiements_create', 'createPaiementGeneral', 'finances', 'WRITE', ARRAY['ADMIN', 'TRESOR', 'VTRESO', 'COMCPT'], 'Création de paiements généraux', '/admin/finances/paiements', true, NOW(), NOW())
ON CONFLICT ("action", "type") DO NOTHING;

-- Permissions pour updateAssistance (WRITE)
INSERT INTO "permissions" ("id", "action", "resource", "type", "roles", "description", "route", "enabled", "createdAt", "updatedAt")
VALUES 
    ('perm_assistances_update', 'updateAssistance', 'finances', 'WRITE', ARRAY['ADMIN', 'TRESOR', 'VTRESO', 'COMCPT'], 'Modification d''assistances', '/admin/finances/assistances', true, NOW(), NOW())
ON CONFLICT ("action", "type") DO NOTHING;

-- Permissions pour getAdherentFinancialItems (READ)
INSERT INTO "permissions" ("id", "action", "resource", "type", "roles", "description", "route", "enabled", "createdAt", "updatedAt")
VALUES 
    ('perm_finances_adherent', 'getAdherentFinancialItems', 'finances', 'READ', ARRAY['ADMIN', 'PRESID', 'VICEPR', 'SECRET', 'VICESE', 'TRESOR', 'VTRESO', 'COMCPT'], 'Lecture des éléments financiers d''un adhérent', '/admin/finances', true, NOW(), NOW())
ON CONFLICT ("action", "type") DO NOTHING;
