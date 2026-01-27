-- Script pour vérifier l'état de la migration 20260123150938
-- Vérifier si l'enum UserRole contient les nouvelles valeurs

-- 1. Vérifier les valeurs de l'enum UserRole
SELECT unnest(enum_range(NULL::"UserRole")) AS role_value
ORDER BY role_value;

-- 2. Vérifier si UserRole_old existe encore (ne devrait pas exister si la migration est complète)
SELECT EXISTS (
  SELECT 1 FROM pg_type WHERE typname = 'UserRole_old'
) AS user_role_old_exists;

-- 3. Vérifier les rôles actuels des utilisateurs
SELECT role, COUNT(*) as count
FROM users
GROUP BY role
ORDER BY count DESC;

-- 4. Vérifier si des utilisateurs ont des AdminRole qui devraient être dans UserRole
SELECT 
  u.id,
  u.email,
  u.role as current_user_role,
  array_agg(DISTINCT uar.role::text) as admin_roles
FROM users u
LEFT JOIN user_admin_roles uar ON u.id = uar."userId"
WHERE uar.role IS NOT NULL
GROUP BY u.id, u.email, u.role
LIMIT 10;
