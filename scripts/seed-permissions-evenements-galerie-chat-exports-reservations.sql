-- Seed idempotent des permissions (Événements, Galerie, Chat, Rapports, Exports, Réservations)
-- À exécuter sur la base (prod) une seule fois si vous voulez des valeurs par défaut :
--   psql "$DATABASE_URL" -f scripts/seed-permissions-evenements-galerie-chat-exports-reservations.sql
--
-- Note: ADMIN a toujours tous les droits côté code, même si non présent dans roles.

-- ========== ÉVÉNEMENTS ==========
INSERT INTO "permissions" ("id", "action", "resource", "type", "roles", "description", "route", "enabled", "createdAt", "updatedAt")
VALUES
  ('perm_ev_getall',       'getAllEvenements',           'evenements', 'READ',   ARRAY['ADMIN','PRESID','VICEPR','SECRET','VICESE'], 'Lister les événements (admin)',     '/admin/evenements', true, NOW(), NOW()),
  ('perm_ev_getone',       'getEvenementById',           'evenements', 'READ',   ARRAY['ADMIN','PRESID','VICEPR','SECRET','VICESE'], 'Consulter un événement',           '/admin/evenements', true, NOW(), NOW()),
  ('perm_ev_stats',        'getEvenementsStats',         'evenements', 'READ',   ARRAY['ADMIN','PRESID','VICEPR','SECRET','VICESE'], 'Statistiques événements',          '/admin/evenements', true, NOW(), NOW()),
  ('perm_ev_create',       'createEvenement',            'evenements', 'WRITE',  ARRAY['ADMIN','PRESID','VICEPR','SECRET','VICESE'], 'Créer un événement',               '/admin/evenements', true, NOW(), NOW()),
  ('perm_ev_update',       'updateEvenement',            'evenements', 'WRITE',  ARRAY['ADMIN','PRESID','VICEPR','SECRET','VICESE'], 'Modifier un événement',            '/admin/evenements', true, NOW(), NOW()),
  ('perm_ev_delete',       'deleteEvenement',            'evenements', 'DELETE', ARRAY['ADMIN','PRESID','VICEPR','SECRET','VICESE'], 'Supprimer un événement',           '/admin/evenements', true, NOW(), NOW()),
  ('perm_ev_upload',       'uploadEvenementImage',      'evenements', 'WRITE',  ARRAY['ADMIN','PRESID','VICEPR','SECRET','VICESE'], 'Upload image événement',           '/admin/evenements', true, NOW(), NOW()),
  ('perm_ev_invitations',  'sendEventInvitations',      'evenements', 'WRITE',  ARRAY['ADMIN','PRESID','VICEPR','SECRET','VICESE'], 'Envoyer invitations événement',   '/admin/evenements', true, NOW(), NOW()),
  ('perm_ev_adherents',     'getAdherentsForEvent',      'evenements', 'READ',   ARRAY['ADMIN','PRESID','VICEPR','SECRET','VICESE'], 'Lister adhérents pour événement',  '/admin/evenements', true, NOW(), NOW()),
  ('perm_ev_addpart',      'addParticipantToEvent',      'evenements', 'WRITE',  ARRAY['ADMIN','PRESID','VICEPR','SECRET','VICESE'], 'Ajouter participant',              '/admin/evenements', true, NOW(), NOW()),
  ('perm_ev_removepart',   'removeParticipantFromEvent','evenements', 'WRITE',  ARRAY['ADMIN','PRESID','VICEPR','SECRET','VICESE'], 'Retirer participant',              '/admin/evenements', true, NOW(), NOW()),
  ('perm_ev_exportcal',    'exportAllEvenementsCalendar','evenements', 'READ',   ARRAY['ADMIN','PRESID','VICEPR','SECRET','VICESE'], 'Exporter calendrier événements',  '/admin/evenements', true, NOW(), NOW())
ON CONFLICT ("action", "type") DO NOTHING;

-- ========== GALERIE ==========
INSERT INTO "permissions" ("id", "action", "resource", "type", "roles", "description", "route", "enabled", "createdAt", "updatedAt")
VALUES
  ('perm_gal_getall',  'getAllMediaGalerie',  'galerie', 'READ',   ARRAY['ADMIN','PRESID','VICEPR','SECRET','VICESE'], 'Lister les médias galerie',   '/admin/galerie', true, NOW(), NOW()),
  ('perm_gal_getone',  'getMediaGalerieById', 'galerie', 'READ',   ARRAY['ADMIN','PRESID','VICEPR','SECRET','VICESE'], 'Consulter un média',          '/admin/galerie', true, NOW(), NOW()),
  ('perm_gal_upload',  'uploadMediaGalerie',  'galerie', 'WRITE',  ARRAY['ADMIN','PRESID','VICEPR','SECRET','VICESE'], 'Ajouter un média',            '/admin/galerie', true, NOW(), NOW()),
  ('perm_gal_update',  'updateMediaGalerie', 'galerie', 'WRITE',  ARRAY['ADMIN','PRESID','VICEPR','SECRET','VICESE'], 'Modifier un média',            '/admin/galerie', true, NOW(), NOW()),
  ('perm_gal_delete',  'deleteMediaGalerie', 'galerie', 'DELETE', ARRAY['ADMIN','PRESID','VICEPR','SECRET','VICESE'], 'Supprimer un média',          '/admin/galerie', true, NOW(), NOW())
ON CONFLICT ("action", "type") DO NOTHING;

-- ========== CHAT ==========
INSERT INTO "permissions" ("id", "action", "resource", "type", "roles", "description", "route", "enabled", "createdAt", "updatedAt")
VALUES
  ('perm_chat_users',   'getUsersForConversation',   'chat', 'READ', ARRAY['ADMIN','PRESID','VICEPR','SECRET','VICESE','TRESOR','VTRESO','COMCPT'], 'Lister utilisateurs pour conversation', '/chat', true, NOW(), NOW()),
  ('perm_chat_events',  'getEvenementsForConversation','chat', 'READ', ARRAY['ADMIN','PRESID','VICEPR','SECRET','VICESE','TRESOR','VTRESO','COMCPT'], 'Lister événements pour conversation',   '/chat', true, NOW(), NOW())
ON CONFLICT ("action", "type") DO NOTHING;

-- ========== RAPPORTS DE RÉUNION (réattribution des rôles si besoin) ==========
INSERT INTO "permissions" ("id", "action", "resource", "type", "roles", "description", "route", "enabled", "createdAt", "updatedAt")
VALUES
  ('perm_rapports_getall',  'getAllRapportsReunion',  'rapports', 'READ',   ARRAY['ADMIN','PRESID','VICEPR','SECRET','VICESE','COMCPT'], 'Lister les rapports de réunion', '/admin/rapports-reunion', true, NOW(), NOW()),
  ('perm_rapports_create',  'createRapportReunion',  'rapports', 'WRITE',  ARRAY['ADMIN','PRESID','VICEPR','SECRET','VICESE','COMCPT'], 'Créer un rapport de réunion',   '/admin/rapports-reunion', true, NOW(), NOW()),
  ('perm_rapports_update',  'updateRapportReunion',  'rapports', 'WRITE',  ARRAY['ADMIN','PRESID','VICEPR','SECRET','VICESE','COMCPT'], 'Modifier un rapport de réunion', '/admin/rapports-reunion', true, NOW(), NOW()),
  ('perm_rapports_delete',  'deleteRapportReunion',  'rapports', 'DELETE', ARRAY['ADMIN','PRESID','VICEPR','SECRET','VICESE','COMCPT'], 'Supprimer un rapport de réunion', '/admin/rapports-reunion', true, NOW(), NOW())
ON CONFLICT ("action", "type") DO NOTHING;

-- ========== EXPORTS ==========
INSERT INTO "permissions" ("id", "action", "resource", "type", "roles", "description", "route", "enabled", "createdAt", "updatedAt")
VALUES
  ('perm_exp_adherents',   'getAdherentsForExport',           'exports', 'READ', ARRAY['ADMIN','PRESID','VICEPR','SECRET','VICESE','TRESOR','VTRESO','COMCPT'], 'Export adhérents',                '/admin/exports', true, NOW(), NOW()),
  ('perm_exp_cotisations', 'getCotisationsForExport',         'exports', 'READ', ARRAY['ADMIN','PRESID','VICEPR','SECRET','VICESE','TRESOR','VTRESO','COMCPT'], 'Export cotisations',              '/admin/exports', true, NOW(), NOW()),
  ('perm_exp_paiements',   'getPaiementsForExport',           'exports', 'READ', ARRAY['ADMIN','PRESID','VICEPR','SECRET','VICESE','TRESOR','VTRESO','COMCPT'], 'Export paiements',                '/admin/exports', true, NOW(), NOW()),
  ('perm_exp_evenements',  'getEvenementsForExport',           'exports', 'READ', ARRAY['ADMIN','PRESID','VICEPR','SECRET','VICESE'], 'Export événements',                '/admin/exports', true, NOW(), NOW()),
  ('perm_exp_inscriptions','getInscriptionsEvenementsForExport','exports','READ', ARRAY['ADMIN','PRESID','VICEPR','SECRET','VICESE'], 'Export inscriptions événements',  '/admin/exports', true, NOW(), NOW()),
  ('perm_exp_elections',   'getElectionsResultsForExport',     'exports', 'READ', ARRAY['ADMIN','PRESID','VICEPR','SECRET','VICESE'], 'Export résultats élections',      '/admin/exports', true, NOW(), NOW()),
  ('perm_exp_documents',   'getDocumentsForExport',           'exports', 'READ', ARRAY['ADMIN','PRESID','VICEPR','SECRET','VICESE','TRESOR','VTRESO','COMCPT'], 'Export documents',                '/admin/exports', true, NOW(), NOW()),
  ('perm_exp_relances',    'getRelancesForExport',            'exports', 'READ', ARRAY['ADMIN','PRESID','VICEPR','SECRET','VICESE','TRESOR','VTRESO','COMCPT'], 'Export relances',                 '/admin/exports', true, NOW(), NOW())
ON CONFLICT ("action", "type") DO NOTHING;

-- ========== RÉSERVATIONS ==========
INSERT INTO "permissions" ("id", "action", "resource", "type", "roles", "description", "route", "enabled", "createdAt", "updatedAt")
VALUES
  ('perm_res_ressource_create', 'createRessource',       'reservations', 'WRITE',  ARRAY['ADMIN','PRESID','VICEPR','SECRET','VICESE'], 'Créer une ressource',       '/admin/reservations', true, NOW(), NOW()),
  ('perm_res_ressource_getall', 'getAllRessources',     'reservations', 'READ',   ARRAY['ADMIN','PRESID','VICEPR','SECRET','VICESE'], 'Lister les ressources',     '/admin/reservations', true, NOW(), NOW()),
  ('perm_res_create',          'createReservation',    'reservations', 'WRITE',  ARRAY['ADMIN','PRESID','VICEPR','SECRET','VICESE'], 'Créer une réservation',    '/admin/reservations', true, NOW(), NOW()),
  ('perm_res_getall',          'getAllReservations',  'reservations', 'READ',   ARRAY['ADMIN','PRESID','VICEPR','SECRET','VICESE'], 'Lister les réservations',   '/admin/reservations', true, NOW(), NOW()),
  ('perm_res_confirmer',       'confirmerReservation', 'reservations', 'WRITE',  ARRAY['ADMIN','PRESID','VICEPR','SECRET','VICESE'], 'Confirmer une réservation', '/admin/reservations', true, NOW(), NOW()),
  ('perm_res_annuler',         'annulerReservation',   'reservations', 'WRITE',  ARRAY['ADMIN','PRESID','VICEPR','SECRET','VICESE'], 'Annuler une réservation',  '/admin/reservations', true, NOW(), NOW()),
  ('perm_res_stats',           'getReservationsStats', 'reservations', 'READ',   ARRAY['ADMIN','PRESID','VICEPR','SECRET','VICESE'], 'Statistiques réservations', '/admin/reservations', true, NOW(), NOW())
ON CONFLICT ("action", "type") DO NOTHING;
