-- Permissions pour la page /admin/finances/paiements (paiement en espèce de cotisations)
-- Exécuter si besoin : psql "$DATABASE_URL" -f scripts/seed-permissions-paiements-cotisations.sql

INSERT INTO "permissions" ("id", "action", "resource", "type", "roles", "description", "route", "enabled", "createdAt", "updatedAt")
VALUES
  ('perm_create_paiement',              'createPaiement',                    'paiements', 'WRITE', ARRAY['ADMIN','TRESOR','VTRESO','COMCPT'], 'Enregistrer un paiement (cotisation)', '/admin/finances/paiements', true, NOW(), NOW()),
  ('perm_get_cotisations_by_periode',   'getCotisationsMensuellesByPeriode',  'paiements', 'READ',  ARRAY['ADMIN','TRESOR','VTRESO','COMCPT'], 'Voir les cotisations par période',     '/admin/finances/paiements', true, NOW(), NOW()),
  ('perm_update_paiement',              'updatePaiement',                    'paiements', 'WRITE', ARRAY['ADMIN','TRESOR','VTRESO','COMCPT'], 'Modifier un paiement (correction saisie)', '/admin/finances/paiements', true, NOW(), NOW())
ON CONFLICT ("action", "type") DO UPDATE SET
  "roles" = EXCLUDED.roles,
  "description" = EXCLUDED.description,
  "route" = EXCLUDED.route,
  "enabled" = EXCLUDED.enabled,
  "updatedAt" = NOW();
