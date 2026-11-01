-- AMAKI — Assertions post-migrate R1 Lot 3 (lecture catalogue uniquement)
-- Fichier versionné : scripts/assert-rappel-dette-lot3-post-migrate.sql
-- Usage (deploy) : POST_MIGRATE_ASSERT_SQL pointant vers CE fichier du checkout source
--   psql -X -v ON_ERROR_STOP=1 -f <ce-fichier> <url>
--
-- Couvre les migrations :
--   20261027190000_rappel_dette_envoi
--   20261030150000_rappel_dette_gel
--
-- INTERDIT : INSERT/UPDATE/DELETE métier, DDL, DROP, ALTER hors lecture.

DO $assert$
DECLARE
  n int;
  pred text;
  attnotnull boolean;
  typname text;
BEGIN
  ------------------------------------------------------------------
  -- 1) Ledger Prisma
  ------------------------------------------------------------------
  SELECT count(*) INTO n
  FROM public._prisma_migrations
  WHERE migration_name IN (
      '20261027190000_rappel_dette_envoi',
      '20261030150000_rappel_dette_gel'
    )
    AND finished_at IS NOT NULL
    AND rolled_back_at IS NULL;

  IF n <> 2 THEN
    RAISE EXCEPTION
      'E5 ledger: attendu 2 migrations Lot 3 finished sans rollback, obtenu %', n;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public._prisma_migrations
    WHERE finished_at IS NULL
      AND rolled_back_at IS NULL
  ) THEN
    RAISE EXCEPTION
      'E5 ledger: migration non terminée / non résolue présente';
  END IF;

  ------------------------------------------------------------------
  -- 2) Tables
  ------------------------------------------------------------------
  IF to_regclass('public.rappel_dette_envoi') IS NULL
     OR to_regclass('public.rappel_dette_gels') IS NULL
     OR to_regclass('public.rappel_dette_gel_revisions') IS NULL THEN
    RAISE EXCEPTION 'E5 tables Lot 3 manquantes';
  END IF;

  ------------------------------------------------------------------
  -- 3) gelsRevision : BIGINT nullable (ajout migration gel, sans backfill)
  ------------------------------------------------------------------
  SELECT a.attnotnull, t.typname
  INTO attnotnull, typname
  FROM pg_attribute a
  JOIN pg_type t ON t.oid = a.atttypid
  WHERE a.attrelid = 'public.rappel_dette_envoi'::regclass
    AND a.attname = 'gelsRevision'
    AND NOT a.attisdropped;

  IF typname IS NULL THEN
    RAISE EXCEPTION 'E5 gelsRevision: colonne absente';
  END IF;
  IF typname IS DISTINCT FROM 'int8' THEN
    RAISE EXCEPTION 'E5 gelsRevision: type attendu int8, obtenu %', typname;
  END IF;
  IF attnotnull IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'E5 gelsRevision: doit rester NULLABLE';
  END IF;

  ------------------------------------------------------------------
  -- 4) Huit CHECKs envoi (convalidated = true)
  ------------------------------------------------------------------
  SELECT count(*) INTO n
  FROM pg_constraint
  WHERE conrelid = 'public.rappel_dette_envoi'::regclass
    AND contype = 'c'
    AND convalidated
    AND conname IN (
      'rappel_dette_envoi_montants_non_negatifs_check',
      'rappel_dette_envoi_email_accepted_proof_check',
      'rappel_dette_envoi_notif_proof_check',
      'rappel_dette_envoi_notif_link_implies_created_check',
      'rappel_dette_envoi_notif_after_accepted_check',
      'rappel_dette_envoi_reconciliation_trace_check',
      'rappel_dette_envoi_temporal_order_check',
      'rappel_dette_envoi_reservation_state_check'
    );

  IF n <> 8 THEN
    RAISE EXCEPTION 'E5 CHECKs envoi validés: attendu 8, obtenu %', n;
  END IF;

  ------------------------------------------------------------------
  -- 5) Unicités envoi = CREATE UNIQUE INDEX (pg_index, pas seulement contype=u)
  ------------------------------------------------------------------
  IF NOT EXISTS (
    SELECT 1
    FROM pg_index i
    JOIN pg_class c ON c.oid = i.indexrelid
    WHERE c.relname = 'rappel_dette_envoi_clientConfirmationId_key'
      AND i.indisunique
      AND i.indisvalid
      AND i.indpred IS NULL
  ) THEN
    RAISE EXCEPTION
      'E5 index unique clientConfirmationId manquant/invalide';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_index i
    JOIN pg_class c ON c.oid = i.indexrelid
    WHERE c.relname = 'rappel_dette_envoi_notificationId_key'
      AND i.indisunique
      AND i.indisvalid
      AND i.indpred IS NULL
  ) THEN
    RAISE EXCEPTION
      'E5 index unique notificationId manquant/invalide';
  END IF;

  SELECT pg_get_expr(i.indpred, i.indrelid) INTO pred
  FROM pg_index i
  JOIN pg_class c ON c.oid = i.indexrelid
  WHERE c.relname = 'rappel_dette_envoi_adherent_blocking_uidx'
    AND i.indisunique
    AND i.indisvalid;

  IF pred IS NULL
     OR pred !~* 'Reserved'
     OR pred !~* 'Calling'
     OR pred !~* 'Unknown' THEN
    RAISE EXCEPTION
      'E5 blocking uidx: prédicat Reserved|Calling|Unknown attendu, obtenu %', pred;
  END IF;

  ------------------------------------------------------------------
  -- 6) UNIQUE CM / DI = ADD CONSTRAINT UNIQUE → pg_constraint contype=u
  ------------------------------------------------------------------
  SELECT count(*) INTO n
  FROM pg_constraint
  WHERE contype = 'u'
    AND convalidated
    AND conname IN (
      'cotisations_mensuelles_id_adherent_key',
      'dettes_initiales_id_adherent_key'
    );

  IF n <> 2 THEN
    RAISE EXCEPTION
      'E5 UNIQUE CM/DI (contraintes): attendu 2, obtenu %', n;
  END IF;

  ------------------------------------------------------------------
  -- 7) FK composites gels → CM/DI : ON DELETE RESTRICT + ON UPDATE RESTRICT
  --    confdeltype/confupdtype : 'r' = restrict
  ------------------------------------------------------------------
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'rappel_dette_gels_cm_owner_fkey'
      AND contype = 'f'
      AND convalidated
      AND confdeltype = 'r'
      AND confupdtype = 'r'
  ) THEN
    RAISE EXCEPTION
      'E5 FK cm_owner: RESTRICT/RESTRICT validé attendu';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'rappel_dette_gels_di_owner_fkey'
      AND contype = 'f'
      AND convalidated
      AND confdeltype = 'r'
      AND confupdtype = 'r'
  ) THEN
    RAISE EXCEPTION
      'E5 FK di_owner: RESTRICT/RESTRICT validé attendu';
  END IF;

  -- Notification : ON DELETE SET NULL ('n')
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'rappel_dette_envoi_notificationId_fkey'
      AND contype = 'f'
      AND convalidated
      AND confdeltype = 'n'
  ) THEN
    RAISE EXCEPTION
      'E5 FK notificationId: ON DELETE SET NULL attendu';
  END IF;

  -- Acteurs envoi : RESTRICT delete
  SELECT count(*) INTO n
  FROM pg_constraint
  WHERE contype = 'f'
    AND convalidated
    AND confdeltype = 'r'
    AND conname IN (
      'rappel_dette_envoi_adherentId_fkey',
      'rappel_dette_envoi_createdByUserId_fkey',
      'rappel_dette_envoi_recipientUserId_fkey',
      'rappel_dette_envoi_reconciledByUserId_fkey'
    );

  IF n <> 4 THEN
    RAISE EXCEPTION
      'E5 FK envoi Restrict: attendu 4, obtenu %', n;
  END IF;

  ------------------------------------------------------------------
  -- 8) Index uniques partiels gels (CREATE UNIQUE INDEX … WHERE …)
  ------------------------------------------------------------------
  IF NOT EXISTS (
    SELECT 1 FROM pg_index i
    JOIN pg_class c ON c.oid = i.indexrelid
    WHERE c.relname = 'rappel_dette_gels_one_active_adherent'
      AND i.indisunique AND i.indisvalid
  ) THEN
    RAISE EXCEPTION 'E5 index one_active_adherent manquant/invalide';
  END IF;

  SELECT pg_get_expr(i.indpred, i.indrelid) INTO pred
  FROM pg_index i
  JOIN pg_class c ON c.oid = i.indexrelid
  WHERE c.relname = 'rappel_dette_gels_one_active_adherent';

  IF pred IS NULL OR pred !~* 'ACTIF' OR pred !~* 'ADHERENT' THEN
    RAISE EXCEPTION
      'E5 one_active_adherent prédicat non conforme: %', pred;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_index i
    JOIN pg_class c ON c.oid = i.indexrelid
    WHERE c.relname = 'rappel_dette_gels_one_active_cm'
      AND i.indisunique AND i.indisvalid
  ) THEN
    RAISE EXCEPTION 'E5 index one_active_cm manquant/invalide';
  END IF;

  SELECT pg_get_expr(i.indpred, i.indrelid) INTO pred
  FROM pg_index i
  JOIN pg_class c ON c.oid = i.indexrelid
  WHERE c.relname = 'rappel_dette_gels_one_active_cm';

  IF pred IS NULL
     OR pred !~* 'ACTIF'
     OR pred !~* 'LIGNE'
     OR pred !~* 'cotisationMensuelleId' THEN
    RAISE EXCEPTION 'E5 one_active_cm prédicat non conforme: %', pred;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_index i
    JOIN pg_class c ON c.oid = i.indexrelid
    WHERE c.relname = 'rappel_dette_gels_one_active_di'
      AND i.indisunique AND i.indisvalid
  ) THEN
    RAISE EXCEPTION 'E5 index one_active_di manquant/invalide';
  END IF;

  SELECT pg_get_expr(i.indpred, i.indrelid) INTO pred
  FROM pg_index i
  JOIN pg_class c ON c.oid = i.indexrelid
  WHERE c.relname = 'rappel_dette_gels_one_active_di';

  IF pred IS NULL
     OR pred !~* 'ACTIF'
     OR pred !~* 'LIGNE'
     OR pred !~* 'detteInitialeId' THEN
    RAISE EXCEPTION 'E5 one_active_di prédicat non conforme: %', pred;
  END IF;

  ------------------------------------------------------------------
  -- 9) Triggers présents et activés (tgenabled <> 'D')
  ------------------------------------------------------------------
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgrelid = 'public.rappel_dette_envoi'::regclass
      AND tgname = 'rappel_dette_envoi_notif_proof_immutable_trg'
      AND NOT tgisinternal
      AND tgenabled <> 'D'
  ) THEN
    RAISE EXCEPTION
      'E5 trigger notif proof immutable absent ou désactivé';
  END IF;

  SELECT count(*) INTO n
  FROM pg_trigger
  WHERE tgrelid = 'public.rappel_dette_gels'::regclass
    AND NOT tgisinternal
    AND tgenabled <> 'D'
    AND tgname IN (
      'rappel_dette_gel_insert_actif_only_trg',
      'rappel_dette_gel_bump_revision_trg',
      'rappel_dette_gel_immutable_guard_trg',
      'rappel_dette_gel_forbid_delete_trg'
    );

  IF n <> 4 THEN
    RAISE EXCEPTION 'E5 triggers gels: attendu 4 actifs, obtenu %', n;
  END IF;
END
$assert$;
