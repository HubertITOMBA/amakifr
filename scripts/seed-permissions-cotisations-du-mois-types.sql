-- Permissions pour /admin/cotisations-du-mois (liste, détail, création, modification, suppression, affectation, génération, types)
-- Exécuter si besoin : psql "$DATABASE_URL" -f scripts/seed-permissions-cotisations-du-mois-types.sql

INSERT INTO "permissions" ("id", "action", "resource", "type", "roles", "description", "route", "enabled", "createdAt", "updatedAt")
VALUES
  ('perm_get_all_cotisations_du_mois', 'getAllCotisationsDuMois',             'cotisations', 'READ',   ARRAY['ADMIN','TRESOR','VTRESO','COMCPT'], 'Lister les cotisations du mois', '/admin/cotisations-du-mois', true, NOW(), NOW()),
  ('perm_get_cotisation_du_mois_by_id', 'getCotisationDuMoisById',             'cotisations', 'READ',   ARRAY['ADMIN','TRESOR','VTRESO','COMCPT'], 'Consulter une cotisation du mois', '/admin/cotisations-du-mois', true, NOW(), NOW()),
  ('perm_create_cotisation_du_mois',   'createCotisationDuMois',               'cotisations', 'WRITE',  ARRAY['ADMIN','TRESOR','VTRESO','COMCPT'], 'Créer une cotisation du mois', '/admin/cotisations-du-mois', true, NOW(), NOW()),
  ('perm_update_cotisation_du_mois',   'updateCotisationDuMois',                'cotisations', 'WRITE', ARRAY['ADMIN','TRESOR','VTRESO','COMCPT'], 'Modifier une cotisation du mois', '/admin/cotisations-du-mois', true, NOW(), NOW()),
  ('perm_delete_cotisation_du_mois',   'deleteCotisationDuMois',                'cotisations', 'DELETE', ARRAY['ADMIN','TRESOR','VTRESO','COMCPT'], 'Supprimer une cotisation du mois', '/admin/cotisations-du-mois', true, NOW(), NOW()),
  ('perm_affecter_assistance_cdm',      'affecterAssistanceToCotisationDuMois',  'cotisations', 'WRITE', ARRAY['ADMIN','TRESOR','VTRESO','COMCPT'], 'Affecter une assistance à la cotisation du mois', '/admin/cotisations-du-mois', true, NOW(), NOW()),
  ('perm_create_cotisations_mens',     'createCotisationsMensuelles',          'cotisations', 'WRITE', ARRAY['ADMIN','TRESOR','VTRESO','COMCPT'], 'Générer les cotisations mensuelles', '/admin/cotisations-du-mois', true, NOW(), NOW()),
  ('perm_get_types_cotisation',        'getAllTypesCotisationMensuelle',      'cotisations', 'READ',   ARRAY['ADMIN','TRESOR','VTRESO','COMCPT'], 'Lister les types de cotisation', '/admin/cotisations-du-mois', true, NOW(), NOW()),
  ('perm_create_type_cotisation',      'createTypeCotisationMensuelle',        'cotisations', 'WRITE', ARRAY['ADMIN','TRESOR','VTRESO','COMCPT'], 'Créer un type de cotisation', '/admin/cotisations-du-mois', true, NOW(), NOW()),
  ('perm_update_type_cotisation',      'updateTypeCotisationMensuelle',       'cotisations', 'WRITE', ARRAY['ADMIN','TRESOR','VTRESO','COMCPT'], 'Modifier un type de cotisation', '/admin/cotisations-du-mois', true, NOW(), NOW()),
  ('perm_delete_type_cotisation',     'deleteTypeCotisationMensuelle',       'cotisations', 'DELETE', ARRAY['ADMIN','TRESOR','VTRESO','COMCPT'], 'Supprimer un type de cotisation', '/admin/cotisations-du-mois', true, NOW(), NOW())
ON CONFLICT ("action", "type") DO UPDATE SET
  "roles" = EXCLUDED.roles,
  "description" = EXCLUDED.description,
  "route" = EXCLUDED.route,
  "enabled" = EXCLUDED.enabled,
  "updatedAt" = NOW();
