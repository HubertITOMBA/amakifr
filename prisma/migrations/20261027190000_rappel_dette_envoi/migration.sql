-- R1 Lot 3.1 (révisé revue) — table RappelDetteEnvoi (préparation locale).
-- NE PAS appliquer automatiquement : aucune connexion/migration deploy ici.
-- Couvre CM / dette initiale (et CM assistance tiers) via snapshot lignes retenues (JSON).
-- Gel métier : hors schéma (paramètres serveur uniquement).
--
-- Protocoles applicatifs (hors SQL — CHECKs = états, pas historique de transitions) :
--   Reserved → Calling : atomique sous verrou adhérent, après relecture + expiration.
--   Email Accepted → Completed durable même si notifStatus=NotStarted (cooldown + reprise notif).
--   Fingerprint : email effectif, cible, templateVersion, données métier ; exclure computedAt.
--   Reprise notification : jamais d’email ni push ; si Created (+ notificationCreatedAt) → 0 recréation.
--   Unknown : bloquant tant que reservationStatus=Unknown ; sortie uniquement vers
--     Completed/Accepted ou Failed/DefinitelyNotAccepted avec traçabilité ops.
--   Purges notifications existantes (deleteMyNotification, RGPD notes de frais, Cascade User) :
--     FK SetNull sur notificationId ; preuve = notificationCreatedAt + notifStatus=Created.

BEGIN;

-- ========== Enums ==========

CREATE TYPE "RappelDetteReservationStatus" AS ENUM (
  'Reserved',
  'Calling',
  'Completed',
  'Failed',
  'Abandoned',
  'Unknown'
);

CREATE TYPE "RappelDetteEmailStatus" AS ENUM (
  'NotStarted',
  'Calling',
  'Accepted',
  'DefinitelyNotAccepted',
  'Unknown'
);

CREATE TYPE "RappelDetteNotifStatus" AS ENUM (
  'NotStarted',
  'Created',
  'Failed'
);

-- ========== Table ==========

CREATE TABLE "rappel_dette_envoi" (
  "id" TEXT NOT NULL,
  "adherentId" TEXT NOT NULL,
  "createdByUserId" TEXT NOT NULL,
  "recipientUserId" TEXT NOT NULL,
  "recipientEmail" VARCHAR(255) NOT NULL,

  "clientConfirmationId" VARCHAR(64) NOT NULL,
  "payloadFingerprint" VARCHAR(128) NOT NULL,
  "templateVersion" VARCHAR(64) NOT NULL,
  -- templateDetailLinkContract : non colonné — dérivé serveur de templateVersion
  -- via RAPPEL_DETTE_TEMPLATE_REGISTRY (immuable). Voir r1-lot3-reservation-review-v2.

  "montantBrut" DECIMAL(12, 2) NOT NULL,
  "avoirDisponible" DECIMAL(12, 2) NOT NULL,
  "detteNette" DECIMAL(12, 2) NOT NULL,
  "retainedLinesJson" JSONB NOT NULL,

  "reservationStatus" "RappelDetteReservationStatus" NOT NULL DEFAULT 'Reserved',
  "emailStatus" "RappelDetteEmailStatus" NOT NULL DEFAULT 'NotStarted',
  "notifStatus" "RappelDetteNotifStatus" NOT NULL DEFAULT 'NotStarted',

  "reservedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lockExpiresAt" TIMESTAMP(3) NOT NULL,
  "callingAt" TIMESTAMP(3),
  "emailAcceptedAt" TIMESTAMP(3),
  "closedAt" TIMESTAMP(3),
  "unknownAt" TIMESTAMP(3),
  "reconciledAt" TIMESTAMP(3),
  "reconciledByUserId" TEXT,
  "reconciliationDecisionCode" VARCHAR(64),

  "technicalResultCode" VARCHAR(64),
  "notificationId" TEXT,
  "notificationCreatedAt" TIMESTAMP(3),

  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "rappel_dette_envoi_pkey" PRIMARY KEY ("id")
);

-- ========== Relations (historique préservé) ==========
-- Adherent / acteurs User : Restrict.
-- Notification : SetNull — purges UI/RGPD/Cascade User n’effacent pas l’envoi ni la preuve Created.

ALTER TABLE "rappel_dette_envoi"
  ADD CONSTRAINT "rappel_dette_envoi_adherentId_fkey"
  FOREIGN KEY ("adherentId") REFERENCES "adherent"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "rappel_dette_envoi"
  ADD CONSTRAINT "rappel_dette_envoi_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "rappel_dette_envoi"
  ADD CONSTRAINT "rappel_dette_envoi_recipientUserId_fkey"
  FOREIGN KEY ("recipientUserId") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "rappel_dette_envoi"
  ADD CONSTRAINT "rappel_dette_envoi_reconciledByUserId_fkey"
  FOREIGN KEY ("reconciledByUserId") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "rappel_dette_envoi"
  ADD CONSTRAINT "rappel_dette_envoi_notificationId_fkey"
  FOREIGN KEY ("notificationId") REFERENCES "notifications"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ========== Unicités ==========

CREATE UNIQUE INDEX "rappel_dette_envoi_clientConfirmationId_key"
  ON "rappel_dette_envoi"("clientConfirmationId");

-- Unicité du lien vivant (plusieurs NULL autorisés en PG).
CREATE UNIQUE INDEX "rappel_dette_envoi_notificationId_key"
  ON "rappel_dette_envoi"("notificationId");

-- Tentative bloquante / adhérent : Reserved | Calling | Unknown.
-- Unknown reste dans l’index tant que reservationStatus='Unknown'
-- (pas de libération par reconciledAt seul — la sortie change le statut).
CREATE UNIQUE INDEX "rappel_dette_envoi_adherent_blocking_uidx"
  ON "rappel_dette_envoi"("adherentId")
  WHERE "reservationStatus" IN ('Reserved', 'Calling', 'Unknown');

-- ========== Index lecture cooldown / ops ==========

CREATE INDEX "rappel_dette_envoi_adherent_accepted_idx"
  ON "rappel_dette_envoi"("adherentId", "emailAcceptedAt" DESC);

CREATE INDEX "rappel_dette_envoi_adherent_reservation_idx"
  ON "rappel_dette_envoi"("adherentId", "reservationStatus");

CREATE INDEX "rappel_dette_envoi_reserved_at_idx"
  ON "rappel_dette_envoi"("reservedAt");

-- ========== CHECK — montants ==========

ALTER TABLE "rappel_dette_envoi"
  ADD CONSTRAINT "rappel_dette_envoi_montants_non_negatifs_check"
  CHECK (
    "montantBrut" >= 0
    AND "avoirDisponible" >= 0
    AND "detteNette" >= 0
  );

-- ========== CHECK — emailAcceptedAt ↔ emailStatus ==========

ALTER TABLE "rappel_dette_envoi"
  ADD CONSTRAINT "rappel_dette_envoi_email_accepted_proof_check"
  CHECK (
    (
      "emailStatus" = 'Accepted'
      AND "emailAcceptedAt" IS NOT NULL
    )
    OR (
      "emailStatus" <> 'Accepted'
      AND "emailAcceptedAt" IS NULL
    )
  );

-- ========== CHECK — notification : lien vs preuve de création ==========
-- Created ⇒ notificationCreatedAt durable (même si notificationId SetNull après purge).
-- Failed / NotStarted ⇒ pas de preuve de création, pas de lien.
-- notificationId non null ⇒ Created + preuve.

ALTER TABLE "rappel_dette_envoi"
  ADD CONSTRAINT "rappel_dette_envoi_notif_proof_check"
  CHECK (
    (
      "notifStatus" = 'NotStarted'
      AND "notificationId" IS NULL
      AND "notificationCreatedAt" IS NULL
    )
    OR (
      "notifStatus" = 'Created'
      AND "notificationCreatedAt" IS NOT NULL
    )
    OR (
      "notifStatus" = 'Failed'
      AND "notificationId" IS NULL
      AND "notificationCreatedAt" IS NULL
    )
  );

ALTER TABLE "rappel_dette_envoi"
  ADD CONSTRAINT "rappel_dette_envoi_notif_link_implies_created_check"
  CHECK (
    "notificationId" IS NULL
    OR (
      "notifStatus" = 'Created'
      AND "notificationCreatedAt" IS NOT NULL
    )
  );

-- Notif ≠ NotStarted uniquement après email Accepted.

ALTER TABLE "rappel_dette_envoi"
  ADD CONSTRAINT "rappel_dette_envoi_notif_after_accepted_check"
  CHECK (
    "notifStatus" = 'NotStarted'
    OR "emailStatus" = 'Accepted'
  );

-- ========== CHECK — traçabilité réconciliation ops ==========
-- Triplet présent ensemble, et seulement si unknownAt a existé.
-- Ne permet PAS de « réconcilier » en restant email Unknown (voir state check).

ALTER TABLE "rappel_dette_envoi"
  ADD CONSTRAINT "rappel_dette_envoi_reconciliation_trace_check"
  CHECK (
    (
      "reconciledAt" IS NULL
      AND "reconciledByUserId" IS NULL
      AND "reconciliationDecisionCode" IS NULL
    )
    OR (
      "reconciledAt" IS NOT NULL
      AND "reconciledByUserId" IS NOT NULL
      AND "reconciliationDecisionCode" IS NOT NULL
      AND "unknownAt" IS NOT NULL
    )
  );

-- ========== CHECK — invariants temporels ==========

ALTER TABLE "rappel_dette_envoi"
  ADD CONSTRAINT "rappel_dette_envoi_temporal_order_check"
  CHECK (
    "lockExpiresAt" >= "reservedAt"
    AND (
      "callingAt" IS NULL
      OR "callingAt" >= "reservedAt"
    )
    AND (
      "emailAcceptedAt" IS NULL
      OR (
        "callingAt" IS NOT NULL
        AND "emailAcceptedAt" >= "callingAt"
      )
    )
    AND (
      "unknownAt" IS NULL
      OR (
        "callingAt" IS NOT NULL
        AND "unknownAt" >= "callingAt"
      )
    )
    AND (
      "closedAt" IS NULL
      OR "closedAt" >= "reservedAt"
    )
    AND (
      "reconciledAt" IS NULL
      OR (
        "unknownAt" IS NOT NULL
        AND "reconciledAt" >= "unknownAt"
      )
    )
    AND (
      "notificationCreatedAt" IS NULL
      OR (
        "emailAcceptedAt" IS NOT NULL
        AND "notificationCreatedAt" >= "emailAcceptedAt"
      )
    )
  );

-- ========== CHECK — machine d’états (états possibles) ==========

ALTER TABLE "rappel_dette_envoi"
  ADD CONSTRAINT "rappel_dette_envoi_reservation_state_check"
  CHECK (
    (
      -- Reserved : aucun appel provider ; canaux au repos
      "reservationStatus" = 'Reserved'
      AND "callingAt" IS NULL
      AND "closedAt" IS NULL
      AND "unknownAt" IS NULL
      AND "reconciledAt" IS NULL
      AND "reconciledByUserId" IS NULL
      AND "reconciliationDecisionCode" IS NULL
      AND "emailStatus" = 'NotStarted'
      AND "notifStatus" = 'NotStarted'
      AND "emailAcceptedAt" IS NULL
      AND "notificationId" IS NULL
      AND "notificationCreatedAt" IS NULL
      AND "technicalResultCode" IS NULL
    )
    OR (
      -- Calling : appel démarré / imminent ; pas encore clôturé
      "reservationStatus" = 'Calling'
      AND "callingAt" IS NOT NULL
      AND "closedAt" IS NULL
      AND "unknownAt" IS NULL
      AND "reconciledAt" IS NULL
      AND "reconciledByUserId" IS NULL
      AND "reconciliationDecisionCode" IS NULL
      AND "emailStatus" IN ('NotStarted', 'Calling')
      AND "notifStatus" = 'NotStarted'
      AND "emailAcceptedAt" IS NULL
      AND "notificationId" IS NULL
      AND "notificationCreatedAt" IS NULL
    )
    OR (
      -- Completed : email Accepted + preuve cooldown.
      -- notif NotStarted autorisé (crash avant notif / reprise) → closedAt NULL.
      -- notif Created|Failed → closedAt NOT NULL.
      -- unknownAt conservé si issu d’une réconciliation ops.
      "reservationStatus" = 'Completed'
      AND "callingAt" IS NOT NULL
      AND "emailStatus" = 'Accepted'
      AND "emailAcceptedAt" IS NOT NULL
      AND "notifStatus" IN ('NotStarted', 'Created', 'Failed')
      AND (
        ("notifStatus" = 'NotStarted' AND "closedAt" IS NULL)
        OR ("notifStatus" IN ('Created', 'Failed') AND "closedAt" IS NOT NULL)
      )
      AND (
        (
          "unknownAt" IS NULL
          AND "reconciledAt" IS NULL
          AND "reconciledByUserId" IS NULL
          AND "reconciliationDecisionCode" IS NULL
        )
        OR (
          "unknownAt" IS NOT NULL
          AND "reconciledAt" IS NOT NULL
          AND "reconciledByUserId" IS NOT NULL
          AND "reconciliationDecisionCode" IS NOT NULL
        )
      )
    )
    OR (
      -- Failed : rejet email typé ; pas de preuve cooldown ; pas de notif
      "reservationStatus" = 'Failed'
      AND "callingAt" IS NOT NULL
      AND "closedAt" IS NOT NULL
      AND "emailStatus" = 'DefinitelyNotAccepted'
      AND "emailAcceptedAt" IS NULL
      AND "notifStatus" = 'NotStarted'
      AND "notificationId" IS NULL
      AND "notificationCreatedAt" IS NULL
      AND (
        (
          "unknownAt" IS NULL
          AND "reconciledAt" IS NULL
          AND "reconciledByUserId" IS NULL
          AND "reconciliationDecisionCode" IS NULL
        )
        OR (
          "unknownAt" IS NOT NULL
          AND "reconciledAt" IS NOT NULL
          AND "reconciledByUserId" IS NOT NULL
          AND "reconciliationDecisionCode" IS NOT NULL
        )
      )
    )
    OR (
      -- Abandoned : uniquement avant Calling (TTL / abandon explicite)
      "reservationStatus" = 'Abandoned'
      AND "callingAt" IS NULL
      AND "closedAt" IS NOT NULL
      AND "unknownAt" IS NULL
      AND "reconciledAt" IS NULL
      AND "reconciledByUserId" IS NULL
      AND "reconciliationDecisionCode" IS NULL
      AND "emailStatus" = 'NotStarted'
      AND "notifStatus" = 'NotStarted'
      AND "emailAcceptedAt" IS NULL
      AND "notificationId" IS NULL
      AND "notificationCreatedAt" IS NULL
    )
    OR (
      -- Unknown : incertitude bloquante — AUCUNE réconciliation partielle.
      -- Sortie = changer reservationStatus vers Completed ou Failed (pas rester ici).
      "reservationStatus" = 'Unknown'
      AND "callingAt" IS NOT NULL
      AND "unknownAt" IS NOT NULL
      AND "closedAt" IS NULL
      AND "reconciledAt" IS NULL
      AND "reconciledByUserId" IS NULL
      AND "reconciliationDecisionCode" IS NULL
      AND "emailStatus" = 'Unknown'
      AND "emailAcceptedAt" IS NULL
      AND "notifStatus" = 'NotStarted'
      AND "notificationId" IS NULL
      AND "notificationCreatedAt" IS NULL
    )
  );

-- ========== Trigger — immutabilité preuve notif (DEF-NOTIF-CREATED-MUTABLE) ==========
-- Les CHECKs autorisent l’état Failed « vierge », mais une fois Created +
-- notificationCreatedAt posés, la preuve ne doit plus être effaçable ni
-- rétrogradée en Failed (purge lien = SetNull seulement).

CREATE OR REPLACE FUNCTION rappel_dette_envoi_notif_proof_immutable()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD."notificationCreatedAt" IS NOT NULL
     AND NEW."notificationCreatedAt"
         IS DISTINCT FROM OLD."notificationCreatedAt" THEN
    RAISE EXCEPTION
      'rappel_dette_envoi: notificationCreatedAt is immutable once set';
  END IF;

  IF OLD."notifStatus" = 'Created'
     AND NEW."notifStatus" IS DISTINCT FROM 'Created' THEN
    RAISE EXCEPTION
      'rappel_dette_envoi: notifStatus Created is terminal (no downgrade to Failed)';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS rappel_dette_envoi_notif_proof_immutable_trg
  ON "rappel_dette_envoi";

CREATE TRIGGER rappel_dette_envoi_notif_proof_immutable_trg
  BEFORE UPDATE ON "rappel_dette_envoi"
  FOR EACH ROW
  EXECUTE FUNCTION rappel_dette_envoi_notif_proof_immutable();

COMMIT;
