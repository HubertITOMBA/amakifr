-- Ajout du compteur de connexions sur les utilisateurs
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "loginCount" INTEGER NOT NULL DEFAULT 0;

-- Rétro-remplissage depuis les activités de type Connexion
UPDATE "users" u
SET "loginCount" = COALESCE(
  (
    SELECT COUNT(*)::int
    FROM "user_activities" ua
    WHERE ua."userId" = u.id
      AND ua.type = 'Connexion'
  ),
  0
)
WHERE "loginCount" = 0;
