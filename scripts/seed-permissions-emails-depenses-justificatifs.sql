-- Seed idempotent des permissions (Emails, validation dépenses, justificatifs)
-- À exécuter sur la base (prod) une seule fois si vous voulez des valeurs par défaut :
--   psql "$DATABASE_URL" -f scripts/seed-permissions-emails-depenses-justificatifs.sql
--
-- Note: ADMIN a toujours tous les droits côté code, même si non présent dans roles.

-- ========== EMAILS ==========
INSERT INTO "permissions" ("id", "action", "resource", "type", "roles", "description", "route", "enabled", "createdAt", "updatedAt")
VALUES
  ('perm_emails_send', 'sendEmails', 'emails', 'WRITE', ARRAY['ADMIN','PRESID','VICEPR','SECRET','VICESE'], 'Envoi de mails aux adhérents', '/admin/emails', true, NOW(), NOW())
ON CONFLICT ("action", "type") DO NOTHING;

-- ========== DÉPENSES (validation + justificatifs) ==========
INSERT INTO "permissions" ("id", "action", "resource", "type", "roles", "description", "route", "enabled", "createdAt", "updatedAt")
VALUES
  ('perm_depenses_validate',   'validateDepense',   'depenses', 'WRITE',  ARRAY['ADMIN','PRESID','VICEPR','SECRET','VICESE','TRESOR','VTRESO'], 'Valider une dépense',           '/admin/depenses', true, NOW(), NOW()),
  ('perm_justificatif_upload', 'uploadJustificatif', 'depenses', 'WRITE',  ARRAY['ADMIN','PRESID','VICEPR','SECRET','VICESE','TRESOR','VTRESO'], 'Ajouter un justificatif',       '/admin/depenses', true, NOW(), NOW()),
  ('perm_justificatif_delete', 'deleteJustificatif', 'depenses', 'DELETE', ARRAY['ADMIN','PRESID','VICEPR','SECRET','VICESE','TRESOR','VTRESO'], 'Supprimer un justificatif',     '/admin/depenses', true, NOW(), NOW()),
  ('perm_justificatif_update', 'updateJustificatif', 'depenses', 'WRITE',  ARRAY['ADMIN','PRESID','VICEPR','SECRET','VICESE','TRESOR','VTRESO'], 'Modifier un justificatif',     '/admin/depenses', true, NOW(), NOW())
ON CONFLICT ("action", "type") DO NOTHING;
