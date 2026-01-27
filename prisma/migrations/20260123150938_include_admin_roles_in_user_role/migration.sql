-- Inclure tous les AdminRole dans UserRole
-- Supprimer l'ancien enum et créer le nouveau
ALTER TYPE "UserRole" RENAME TO "UserRole_old";

CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'MEMBRE', 'INVITE', 'PRESID', 'VICEPR', 'SECRET', 'VICESE', 'COMCPT');

-- Supprimer temporairement la valeur par défaut
ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;

-- Mettre à jour les données existantes dans la table users
ALTER TABLE "users" ALTER COLUMN "role" TYPE "UserRole" USING (
  CASE "role"::text
    WHEN 'ADMIN' THEN 'ADMIN'::"UserRole"
    WHEN 'MEMBRE' THEN 'MEMBRE'::"UserRole"
    WHEN 'Invite' THEN 'INVITE'::"UserRole"
    ELSE 'MEMBRE'::"UserRole"
  END
);

-- Convertir les AdminRole en UserRole pour les utilisateurs qui ont des AdminRole
-- Mettre à jour les utilisateurs qui ont des AdminRole dans UserAdminRole
DO $$
DECLARE
  user_record RECORD;
  admin_role_text TEXT;
BEGIN
  -- Pour chaque utilisateur avec un AdminRole, mettre à jour son UserRole
  FOR user_record IN 
    SELECT DISTINCT u.id, u.role, u.email
    FROM "users" u
    INNER JOIN "user_admin_roles" uar ON u.id = uar."userId"
  LOOP
    -- Prendre le premier AdminRole trouvé (ou le plus important)
    SELECT uar.role::text INTO admin_role_text
    FROM "user_admin_roles" uar
    WHERE uar."userId" = user_record.id
    ORDER BY 
      CASE uar.role::text
        WHEN 'ADMIN' THEN 1
        WHEN 'PRESID' THEN 2
        WHEN 'VICEPR' THEN 3
        WHEN 'SECRET' THEN 4
        WHEN 'VICESE' THEN 5
        WHEN 'COMCPT' THEN 6
        ELSE 7
      END
    LIMIT 1;
    
    -- Mettre à jour le UserRole si l'utilisateur n'est pas déjà ADMIN
    IF user_record.role::text != 'ADMIN' AND admin_role_text IS NOT NULL THEN
      UPDATE "users"
      SET role = admin_role_text::"UserRole"
      WHERE id = user_record.id;
    END IF;
  END LOOP;
END $$;

-- Remettre la valeur par défaut
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'MEMBRE'::"UserRole";

-- Mettre à jour la colonne userRole dans suppressions_adherent si elle existe
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'suppressions_adherent' AND column_name = 'userRole'
  ) THEN
    ALTER TABLE "suppressions_adherent" ALTER COLUMN "userRole" TYPE "UserRole" USING (
      CASE "userRole"::text
        WHEN 'ADMIN' THEN 'ADMIN'::"UserRole"
        WHEN 'MEMBRE' THEN 'MEMBRE'::"UserRole"
        WHEN 'Invite' THEN 'INVITE'::"UserRole"
        ELSE 'MEMBRE'::"UserRole"
      END
    );
  END IF;
END $$;

-- Supprimer l'ancien enum
DROP TYPE "UserRole_old" CASCADE;
