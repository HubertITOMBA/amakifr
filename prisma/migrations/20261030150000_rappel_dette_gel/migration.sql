-- R1 Lot 3 — gel / contestation rappel dette (préparation locale).
-- NE PAS appliquer automatiquement : aucune connexion / migrate deploy / generate ici.
-- Migration dédiée — NE PAS modifier rétroactivement 20261027190000_rappel_dette_envoi.
--
-- Retenus :
--   motifTexte : trim non vide, 1–500 ; referenceDossier optionnelle ≤120 ;
--   pas d’expiration automatique (pas de colonne expiresAt) ;
--   gelsRevision nullable sur envois existants — AUCUN backfill ;
--   Accepted / Calling / Unknown inchangés (preuves Lot 3.1 intactes).
--
-- R3 — révision atomique :
--   Trigger AFTER INSERT (pose ACTIF) et AFTER UPDATE (ACTIF→LEVE) :
--     SELECT adherent FOR UPDATE puis incrément (ou insert 1) sur
--     rappel_dette_gel_revisions. L’applicatif NE DOIT PAS double-incrémenter.
--   DELETE historique, réactivation LEVE→ACTIF, changement de cible : refusés.
--   UPDATE d’une ligne déjà LEVE : refusé (donc pas de 2ᵉ bump).
--   Contournements privilégiés documentés en bas — non empêchés absolument.
--
-- R4 — appartenance / propriétaire :
--   FK composites (lineId, adherentId) ON UPDATE/DELETE RESTRICT, y compris LEVE.
--   Bloque le changement de propriétaire tant qu’un gel historique référence la paire.
--   « Lever le gel » n’est PAS une procédure de transfert.
--   Réaffectation = procédure séparée à concevoir (hors cette passe).

BEGIN;

-- ========== Enums ==========

CREATE TYPE "RappelDetteGelScope" AS ENUM ('ADHERENT', 'LIGNE');
CREATE TYPE "RappelDetteGelStatut" AS ENUM ('ACTIF', 'LEVE');
CREATE TYPE "RappelDetteGelMotifCode" AS ENUM (
  'CONTESTATION',
  'VERIFICATION_ADMINISTRATIVE',
  'AUTRE'
);
CREATE TYPE "RappelDetteGelLineSource" AS ENUM (
  'cotisation_mensuelle',
  'dette_initiale'
);

-- ========== Prérequis FK composite : UNIQUE (id, adherentId) ==========
-- Trivial avec PK id, requis comme cible de FK composite.

ALTER TABLE "cotisations_mensuelles"
  ADD CONSTRAINT "cotisations_mensuelles_id_adherent_key"
  UNIQUE ("id", "adherentId");

ALTER TABLE "dettes_initiales"
  ADD CONSTRAINT "dettes_initiales_id_adherent_key"
  UNIQUE ("id", "adherentId");

-- ========== Compteur révision gels (monotonique par adhérent) ==========

CREATE TABLE "rappel_dette_gel_revisions" (
  "adherentId" TEXT NOT NULL,
  "revision" BIGINT NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "rappel_dette_gel_revisions_pkey" PRIMARY KEY ("adherentId"),
  CONSTRAINT "rappel_dette_gel_revisions_revision_nonneg_check"
    CHECK ("revision" >= 0)
);

ALTER TABLE "rappel_dette_gel_revisions"
  ADD CONSTRAINT "rappel_dette_gel_revisions_adherentId_fkey"
  FOREIGN KEY ("adherentId") REFERENCES "adherent"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- ========== Table gels ==========

CREATE TABLE "rappel_dette_gels" (
  "id" TEXT NOT NULL,
  "scope" "RappelDetteGelScope" NOT NULL,
  "statut" "RappelDetteGelStatut" NOT NULL DEFAULT 'ACTIF',
  "adherentId" TEXT NOT NULL,

  "lineSource" "RappelDetteGelLineSource",
  "cotisationMensuelleId" TEXT,
  "detteInitialeId" TEXT,

  "motifCode" "RappelDetteGelMotifCode" NOT NULL,
  "motifTexte" VARCHAR(500) NOT NULL,
  "referenceDossier" VARCHAR(120),

  "poseParUserId" TEXT NOT NULL,
  "posedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "leveParUserId" TEXT,
  "leveAt" TIMESTAMP(3),

  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "rappel_dette_gels_pkey" PRIMARY KEY ("id"),

  -- Forme scope ADHERENT vs LIGNE (+ exclusivité CM/DI)
  CONSTRAINT "rappel_dette_gels_scope_shape_check" CHECK (
    (
      "scope" = 'ADHERENT'
      AND "lineSource" IS NULL
      AND "cotisationMensuelleId" IS NULL
      AND "detteInitialeId" IS NULL
    )
    OR (
      "scope" = 'LIGNE'
      AND "lineSource" IS NOT NULL
      AND (
        (
          "lineSource" = 'cotisation_mensuelle'
          AND "cotisationMensuelleId" IS NOT NULL
          AND "detteInitialeId" IS NULL
        )
        OR (
          "lineSource" = 'dette_initiale'
          AND "detteInitialeId" IS NOT NULL
          AND "cotisationMensuelleId" IS NULL
        )
      )
    )
  ),

  -- Cohérence champs de levée
  CONSTRAINT "rappel_dette_gels_leve_fields_check" CHECK (
    (
      "statut" = 'ACTIF'
      AND "leveAt" IS NULL
      AND "leveParUserId" IS NULL
    )
    OR (
      "statut" = 'LEVE'
      AND "leveAt" IS NOT NULL
      AND "leveParUserId" IS NOT NULL
    )
  ),

  -- motifTexte : trim non vide, 1–500 caractères (VARCHAR(500) borne haute brute)
  CONSTRAINT "rappel_dette_gels_motif_texte_check" CHECK (
    char_length(btrim("motifTexte")) BETWEEN 1 AND 500
  ),

  -- referenceDossier optionnelle : si présente, trim non vide et ≤120
  CONSTRAINT "rappel_dette_gels_reference_dossier_check" CHECK (
    "referenceDossier" IS NULL
    OR (
      char_length(btrim("referenceDossier")) BETWEEN 1 AND 120
    )
  )
);

-- ========== FK simples ==========

ALTER TABLE "rappel_dette_gels"
  ADD CONSTRAINT "rappel_dette_gels_adherentId_fkey"
  FOREIGN KEY ("adherentId") REFERENCES "adherent"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "rappel_dette_gels"
  ADD CONSTRAINT "rappel_dette_gels_poseParUserId_fkey"
  FOREIGN KEY ("poseParUserId") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "rappel_dette_gels"
  ADD CONSTRAINT "rappel_dette_gels_leveParUserId_fkey"
  FOREIGN KEY ("leveParUserId") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- ========== FK composites (appartenance ligne↔adhérent) — R4 ==========
-- ON UPDATE RESTRICT : bloque le changement de propriétaire CM/DI tant qu’un
-- gel (ACTIF ou LEVE) référence la paire. Pas de CASCADE. Pas de « lever pour
-- transférer » — réaffectation = procédure séparée hors bande.

ALTER TABLE "rappel_dette_gels"
  ADD CONSTRAINT "rappel_dette_gels_cm_owner_fkey"
  FOREIGN KEY ("cotisationMensuelleId", "adherentId")
  REFERENCES "cotisations_mensuelles" ("id", "adherentId")
  ON DELETE RESTRICT
  ON UPDATE RESTRICT;

ALTER TABLE "rappel_dette_gels"
  ADD CONSTRAINT "rappel_dette_gels_di_owner_fkey"
  FOREIGN KEY ("detteInitialeId", "adherentId")
  REFERENCES "dettes_initiales" ("id", "adherentId")
  ON DELETE RESTRICT
  ON UPDATE RESTRICT;

-- ========== Index ==========

CREATE INDEX "rappel_dette_gels_adherent_statut_idx"
  ON "rappel_dette_gels" ("adherentId", "statut");

CREATE INDEX "rappel_dette_gels_statut_scope_idx"
  ON "rappel_dette_gels" ("statut", "scope");

-- Un ACTIF par adhérent (scope ADHERENT)
CREATE UNIQUE INDEX "rappel_dette_gels_one_active_adherent"
  ON "rappel_dette_gels" ("adherentId")
  WHERE "statut" = 'ACTIF' AND "scope" = 'ADHERENT';

-- Un ACTIF par ligne CM
CREATE UNIQUE INDEX "rappel_dette_gels_one_active_cm"
  ON "rappel_dette_gels" ("cotisationMensuelleId")
  WHERE "statut" = 'ACTIF'
    AND "scope" = 'LIGNE'
    AND "cotisationMensuelleId" IS NOT NULL;

-- Un ACTIF par ligne DI
CREATE UNIQUE INDEX "rappel_dette_gels_one_active_di"
  ON "rappel_dette_gels" ("detteInitialeId")
  WHERE "statut" = 'ACTIF'
    AND "scope" = 'LIGNE'
    AND "detteInitialeId" IS NOT NULL;

-- ========== Colonne gelsRevision sur envois (nullable, sans backfill) ==========

ALTER TABLE "rappel_dette_envoi"
  ADD COLUMN "gelsRevision" BIGINT;

-- ========== Trigger — INSERT : pose ACTIF uniquement ==========

CREATE OR REPLACE FUNCTION rappel_dette_gel_insert_actif_only()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."statut" IS DISTINCT FROM 'ACTIF' THEN
    RAISE EXCEPTION
      'rappel_dette_gels: INSERT autorisé uniquement en statut ACTIF (levée = UPDATE)';
  END IF;
  IF NEW."leveParUserId" IS NOT NULL OR NEW."leveAt" IS NOT NULL THEN
    RAISE EXCEPTION
      'rappel_dette_gels: INSERT ACTIF — leveParUserId/leveAt doivent être NULL';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS rappel_dette_gel_insert_actif_only_trg
  ON "rappel_dette_gels";

CREATE TRIGGER rappel_dette_gel_insert_actif_only_trg
  BEFORE INSERT ON "rappel_dette_gels"
  FOR EACH ROW
  EXECUTE FUNCTION rappel_dette_gel_insert_actif_only();

-- ========== Trigger R3 — bump révision atomique (pose / levée) ==========
-- AFTER : ne bump que si la ligne gel a bien été écrite.
-- Verrou adhérent FOR UPDATE avant incrément (même famille que acquireAdherentRowLock).
-- Idempotence : déjà LEVE → UPDATE refusé par trigger immutabilité (pas de 2ᵉ bump).

CREATE OR REPLACE FUNCTION rappel_dette_gel_bump_revision()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_adherent_id TEXT;
  v_should_bump BOOLEAN := FALSE;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW."statut" = 'ACTIF' THEN
      v_should_bump := TRUE;
      v_adherent_id := NEW."adherentId";
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD."statut" = 'ACTIF' AND NEW."statut" = 'LEVE' THEN
      v_should_bump := TRUE;
      v_adherent_id := NEW."adherentId";
    END IF;
  END IF;

  IF v_should_bump THEN
    PERFORM 1 FROM "adherent" WHERE "id" = v_adherent_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION
        'rappel_dette_gels: adherent % introuvable pour bump révision',
        v_adherent_id;
    END IF;

    INSERT INTO "rappel_dette_gel_revisions" ("adherentId", "revision", "updatedAt")
    VALUES (v_adherent_id, 1, CURRENT_TIMESTAMP)
    ON CONFLICT ("adherentId") DO UPDATE
      SET "revision" = "rappel_dette_gel_revisions"."revision" + 1,
          "updatedAt" = CURRENT_TIMESTAMP;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS rappel_dette_gel_bump_revision_trg
  ON "rappel_dette_gels";

CREATE TRIGGER rappel_dette_gel_bump_revision_trg
  AFTER INSERT OR UPDATE OF "statut" ON "rappel_dette_gels"
  FOR EACH ROW
  EXECUTE FUNCTION rappel_dette_gel_bump_revision();

-- ========== Trigger — immutabilité / mutations interdites ==========
-- Refuse : réactivation, changement de cible/identité, mutation d’une ligne LEVE,
--         altération des champs de pose / motif après écriture initiale.
-- Autorise : ACTIF → LEVE (+ leveParUserId, leveAt, updatedAt).

CREATE OR REPLACE FUNCTION rappel_dette_gel_immutable_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Ligne déjà levée : aucun UPDATE métier
  IF OLD."statut" = 'LEVE' THEN
    RAISE EXCEPTION
      'rappel_dette_gels: ligne LEVE immuable (pas de réactivation ni mutation)';
  END IF;

  -- Réactivation interdite
  IF OLD."statut" = 'ACTIF' AND NEW."statut" = 'ACTIF' THEN
    -- Mise à jour « no-op statut » : refuser tout changement hors updatedAt
    IF NEW."id" IS DISTINCT FROM OLD."id"
       OR NEW."scope" IS DISTINCT FROM OLD."scope"
       OR NEW."adherentId" IS DISTINCT FROM OLD."adherentId"
       OR NEW."lineSource" IS DISTINCT FROM OLD."lineSource"
       OR NEW."cotisationMensuelleId" IS DISTINCT FROM OLD."cotisationMensuelleId"
       OR NEW."detteInitialeId" IS DISTINCT FROM OLD."detteInitialeId"
       OR NEW."motifCode" IS DISTINCT FROM OLD."motifCode"
       OR NEW."motifTexte" IS DISTINCT FROM OLD."motifTexte"
       OR NEW."referenceDossier" IS DISTINCT FROM OLD."referenceDossier"
       OR NEW."poseParUserId" IS DISTINCT FROM OLD."poseParUserId"
       OR NEW."posedAt" IS DISTINCT FROM OLD."posedAt"
       OR NEW."leveParUserId" IS DISTINCT FROM OLD."leveParUserId"
       OR NEW."leveAt" IS DISTINCT FROM OLD."leveAt"
       OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt"
    THEN
      RAISE EXCEPTION
        'rappel_dette_gels: gel ACTIF — seuls ACTIF→LEVE (levé) sont autorisés';
    END IF;
    RETURN NEW;
  END IF;

  -- Transition autorisée : ACTIF → LEVE
  IF OLD."statut" = 'ACTIF' AND NEW."statut" = 'LEVE' THEN
    IF NEW."id" IS DISTINCT FROM OLD."id"
       OR NEW."scope" IS DISTINCT FROM OLD."scope"
       OR NEW."adherentId" IS DISTINCT FROM OLD."adherentId"
       OR NEW."lineSource" IS DISTINCT FROM OLD."lineSource"
       OR NEW."cotisationMensuelleId" IS DISTINCT FROM OLD."cotisationMensuelleId"
       OR NEW."detteInitialeId" IS DISTINCT FROM OLD."detteInitialeId"
       OR NEW."motifCode" IS DISTINCT FROM OLD."motifCode"
       OR NEW."motifTexte" IS DISTINCT FROM OLD."motifTexte"
       OR NEW."referenceDossier" IS DISTINCT FROM OLD."referenceDossier"
       OR NEW."poseParUserId" IS DISTINCT FROM OLD."poseParUserId"
       OR NEW."posedAt" IS DISTINCT FROM OLD."posedAt"
       OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt"
    THEN
      RAISE EXCEPTION
        'rappel_dette_gels: levée — champs d’identité/cible/motif immuables';
    END IF;
    IF NEW."leveParUserId" IS NULL OR NEW."leveAt" IS NULL THEN
      RAISE EXCEPTION
        'rappel_dette_gels: levée exige leveParUserId et leveAt';
    END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION
    'rappel_dette_gels: transition de statut interdite (% → %)',
    OLD."statut", NEW."statut";
END;
$$;

DROP TRIGGER IF EXISTS rappel_dette_gel_immutable_guard_trg
  ON "rappel_dette_gels";

CREATE TRIGGER rappel_dette_gel_immutable_guard_trg
  BEFORE UPDATE ON "rappel_dette_gels"
  FOR EACH ROW
  EXECUTE FUNCTION rappel_dette_gel_immutable_guard();

-- ========== Trigger — refus DELETE historique ==========

CREATE OR REPLACE FUNCTION rappel_dette_gel_forbid_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION
    'rappel_dette_gels: suppression d’historique interdite (lever = ACTIF→LEVE)';
END;
$$;

DROP TRIGGER IF EXISTS rappel_dette_gel_forbid_delete_trg
  ON "rappel_dette_gels";

CREATE TRIGGER rappel_dette_gel_forbid_delete_trg
  BEFORE DELETE ON "rappel_dette_gels"
  FOR EACH ROW
  EXECUTE FUNCTION rappel_dette_gel_forbid_delete();

COMMIT;

-- =============================================================================
-- Contournements privilégiés (documentation — non bloqués absolument)
-- =============================================================================
-- Les garanties ci-dessus s’appliquent aux écritures SQL ordinaires (app, psql
-- utilisateur métier). Elles peuvent être contournées par un rôle privilégié :
--   • ALTER TABLE … DISABLE TRIGGER USER / ALL
--   • SET session_replication_role = replica  (bypass triggers user)
--   • DROP TRIGGER / DROP CONSTRAINT / DROP INDEX
--   • UPDATE direct de rappel_dette_gel_revisions hors trigger
--   • Restauration pg_dump / logical replication selon config
-- Ne pas prétendre les empêcher. Toute écriture ops hors bande doit être
-- documentée et revue ; l’applicatif ne doit jamais double-bump la révision.
--
-- Réaffectation propriétaire CM/DI (R4) : hors procédure « lever le gel ».
-- Conception séparée requise (ex. archivage historique + recréation contrôlée).
