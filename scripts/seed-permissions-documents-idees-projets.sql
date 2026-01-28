-- Seed idempotent des permissions (Documents / Boîte à idées / Projets)
-- À exécuter sur la base (prod) une seule fois si vous voulez des valeurs par défaut :
--   psql "$DATABASE_URL" -f scripts/seed-permissions-documents-idees-projets.sql
--
-- Note: ADMIN a toujours tous les droits côté code, même si non présent dans roles.

-- ========== DOCUMENTS (admin) ==========
INSERT INTO "permissions" ("id", "action", "resource", "type", "roles", "description", "route", "enabled", "createdAt", "updatedAt")
VALUES
  ('perm_documents_read_admin',  'getAllDocuments',       'documents', 'READ',   ARRAY['ADMIN','PRESID','VICEPR','SECRET','VICESE','TRESOR','VTRESO','COMCPT'], 'Lister les documents (admin)',  '/admin/documents', true, NOW(), NOW()),
  ('perm_documents_write_admin', 'adminUpdateDocument',   'documents', 'WRITE',  ARRAY['ADMIN','PRESID','VICEPR','SECRET','VICESE','TRESOR','VTRESO','COMCPT'], 'Modifier un document (admin)', '/admin/documents', true, NOW(), NOW()),
  ('perm_documents_delete_admin','adminDeleteDocument',   'documents', 'DELETE', ARRAY['ADMIN','PRESID','VICEPR','SECRET','VICESE','TRESOR','VTRESO','COMCPT'], 'Supprimer un document (admin)','/admin/documents', true, NOW(), NOW())
ON CONFLICT ("action", "type") DO NOTHING;

-- ========== BOÎTE À IDÉES (admin) ==========
INSERT INTO "permissions" ("id", "action", "resource", "type", "roles", "description", "route", "enabled", "createdAt", "updatedAt")
VALUES
  ('perm_idees_read_admin',      'getAllIdeesForAdmin',   'idees', 'READ',   ARRAY['ADMIN','PRESID','VICEPR','SECRET','VICESE'], 'Lister les idées (admin)', '/admin/idees', true, NOW(), NOW()),
  ('perm_idees_valider',         'validerIdee',           'idees', 'WRITE',  ARRAY['ADMIN','PRESID','VICEPR','SECRET','VICESE'], 'Valider une idée',         '/admin/idees', true, NOW(), NOW()),
  ('perm_idees_rejeter',         'rejeterIdee',           'idees', 'WRITE',  ARRAY['ADMIN','PRESID','VICEPR','SECRET','VICESE'], 'Rejeter une idée',         '/admin/idees', true, NOW(), NOW()),
  ('perm_idees_bloquer',         'bloquerIdee',           'idees', 'WRITE',  ARRAY['ADMIN','PRESID','VICEPR','SECRET','VICESE'], 'Bloquer une idée',         '/admin/idees', true, NOW(), NOW()),
  ('perm_idees_delete_comment',  'supprimerCommentaire',  'idees', 'DELETE', ARRAY['ADMIN','PRESID','VICEPR','SECRET','VICESE'], 'Supprimer un commentaire', '/admin/idees', true, NOW(), NOW())
ON CONFLICT ("action", "type") DO NOTHING;

-- ========== PROJETS (admin) ==========
INSERT INTO "permissions" ("id", "action", "resource", "type", "roles", "description", "route", "enabled", "createdAt", "updatedAt")
VALUES
  ('perm_projets_read',          'getAllProjets',         'projets', 'READ',   ARRAY['ADMIN','PRESID','VICEPR','SECRET','VICESE','TRESOR','VTRESO','COMCPT'], 'Lister les projets',         '/admin/projets', true, NOW(), NOW()),
  ('perm_projets_read_one',      'getProjetById',         'projets', 'READ',   ARRAY['ADMIN','PRESID','VICEPR','SECRET','VICESE','TRESOR','VTRESO','COMCPT'], 'Consulter un projet',        '/admin/projets', true, NOW(), NOW()),
  ('perm_projets_create',        'createProjet',          'projets', 'WRITE',  ARRAY['ADMIN','PRESID','VICEPR','SECRET','VICESE'],                               'Créer un projet',            '/admin/projets', true, NOW(), NOW()),
  ('perm_projets_update',        'updateProjet',          'projets', 'WRITE',  ARRAY['ADMIN','PRESID','VICEPR','SECRET','VICESE'],                               'Modifier un projet',         '/admin/projets', true, NOW(), NOW()),
  ('perm_projets_delete',        'deleteProjet',          'projets', 'DELETE', ARRAY['ADMIN','PRESID','VICEPR','SECRET','VICESE'],                               'Supprimer un projet',        '/admin/projets', true, NOW(), NOW()),
  ('perm_taches_create',         'createSousProjet',      'projets', 'WRITE',  ARRAY['ADMIN','PRESID','VICEPR','SECRET','VICESE'],                               'Créer une tâche',            '/admin/projets', true, NOW(), NOW()),
  ('perm_taches_update',         'updateSousProjet',      'projets', 'WRITE',  ARRAY['ADMIN','PRESID','VICEPR','SECRET','VICESE'],                               'Modifier une tâche',         '/admin/projets', true, NOW(), NOW()),
  ('perm_taches_delete',         'deleteSousProjet',      'projets', 'DELETE', ARRAY['ADMIN','PRESID','VICEPR','SECRET','VICESE'],                               'Supprimer une tâche',        '/admin/projets', true, NOW(), NOW()),
  ('perm_taches_manage_affect',  'affecterSousProjet',    'projets', 'MANAGE', ARRAY['ADMIN','PRESID','VICEPR','SECRET','VICESE'],                               'Affecter des adhérents',     '/admin/projets', true, NOW(), NOW()),
  ('perm_taches_manage_retirer', 'retirerAffectation',    'projets', 'MANAGE', ARRAY['ADMIN','PRESID','VICEPR','SECRET','VICESE'],                               'Retirer une affectation',    '/admin/projets', true, NOW(), NOW())
ON CONFLICT ("action", "type") DO NOTHING;

