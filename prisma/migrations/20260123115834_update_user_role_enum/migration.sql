-- Activer l'extension PL/pgSQL si elle n'est pas déjà activée
CREATE EXTENSION IF NOT EXISTS plpgsql;

-- Mettre à jour l'enum UserRole
-- Supprimer l'ancien enum et créer le nouveau
ALTER TYPE "UserRole" RENAME TO "UserRole_old";

CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'MEMBRE', 'INVITE');

-- Supprimer temporairement la valeur par défaut de la table users
ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;

-- Mettre à jour les données existantes dans la table users
ALTER TABLE "users" ALTER COLUMN "role" TYPE "UserRole" USING (
  CASE "role"::text
    WHEN 'Admin' THEN 'ADMIN'::"UserRole"
    WHEN 'Membre' THEN 'MEMBRE'::"UserRole"
    WHEN 'Invite' THEN 'INVITE'::"UserRole"
    ELSE 'MEMBRE'::"UserRole"
  END
);

-- Remettre la valeur par défaut avec la nouvelle valeur pour users
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
        WHEN 'Admin' THEN 'ADMIN'::"UserRole"
        WHEN 'Membre' THEN 'MEMBRE'::"UserRole"
        WHEN 'Invite' THEN 'INVITE'::"UserRole"
        ELSE 'MEMBRE'::"UserRole"
      END
    );
  END IF;
END $$;

-- Supprimer l'ancien enum (CASCADE pour supprimer toutes les dépendances)
DROP TYPE "UserRole_old" CASCADE;
