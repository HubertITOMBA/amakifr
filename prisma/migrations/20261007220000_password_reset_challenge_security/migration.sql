-- Sécurisation PasswordResetToken : code HMAC, email unique, pending dédiés, cooldown.
-- Anciens UUID en clair : invalidés (expires forcé dans le passé) — pas de DELETE de masse.
-- Transaction atomique BEGIN/COMMIT. Garde explicite si doublons email.
--
-- Ordre : garde → enum → colonnes → backfill → NOT NULL → CHECK → drop token → indexes uniques.

BEGIN;

-- 1. Arrêt si plusieurs lignes partagent le même email
DO $$
DECLARE
  duplicate_email_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO duplicate_email_count
  FROM (
    SELECT email
    FROM "password_reset_tokens"
    GROUP BY email
    HAVING COUNT(*) > 1
  ) duplicates;

  IF duplicate_email_count > 0 THEN
    RAISE EXCEPTION
      'password_reset_challenge_security aborted: % email(s) have duplicate rows — resolve before migrate',
      duplicate_email_count;
  END IF;
END $$;

-- 2. Enum statut challenge
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'PasswordResetChallengeStatus'
  ) THEN
    CREATE TYPE "PasswordResetChallengeStatus" AS ENUM ('PENDING', 'ACTIVE');
  END IF;
END $$;

-- 3. Nouvelles colonnes (nullable le temps du backfill)
ALTER TABLE "password_reset_tokens" ADD COLUMN IF NOT EXISTS "codeHash" TEXT;
ALTER TABLE "password_reset_tokens" ADD COLUMN IF NOT EXISTS "pendingCodeHash" TEXT;
ALTER TABLE "password_reset_tokens" ADD COLUMN IF NOT EXISTS "pendingExpires" TIMESTAMP(3);
ALTER TABLE "password_reset_tokens" ADD COLUMN IF NOT EXISTS "status" "PasswordResetChallengeStatus";
ALTER TABLE "password_reset_tokens" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3);
ALTER TABLE "password_reset_tokens" ADD COLUMN IF NOT EXISTS "lastRequestAt" TIMESTAMP(3);
ALTER TABLE "password_reset_tokens" ADD COLUMN IF NOT EXISTS "failedAttempts" INTEGER;
ALTER TABLE "password_reset_tokens" ADD COLUMN IF NOT EXISTS "lockedAt" TIMESTAMP(3);

-- 4. Backfill legacy UUID → marqueur non utilisable + expiration passée
--    Aucune ligne n'est supprimée. Les UUID ne sont plus acceptés (redemander un code).
UPDATE "password_reset_tokens"
SET
  "codeHash" = 'LEGACY_UUID_INVALIDATED:' || md5("token"),
  "status" = 'ACTIVE',
  "createdAt" = COALESCE("createdAt", "expires" - INTERVAL '5 minutes'),
  "lastRequestAt" = COALESCE("lastRequestAt", "expires" - INTERVAL '5 minutes'),
  "failedAttempts" = COALESCE("failedAttempts", 0),
  "expires" = LEAST("expires", CURRENT_TIMESTAMP - INTERVAL '1 second'),
  "pendingCodeHash" = NULL,
  "pendingExpires" = NULL,
  "lockedAt" = NULL
WHERE "codeHash" IS NULL;

-- 5. Contraintes NOT NULL / DEFAULT (après backfill)
ALTER TABLE "password_reset_tokens" ALTER COLUMN "codeHash" SET NOT NULL;
ALTER TABLE "password_reset_tokens" ALTER COLUMN "status" SET NOT NULL;
ALTER TABLE "password_reset_tokens" ALTER COLUMN "status" SET DEFAULT 'PENDING'::"PasswordResetChallengeStatus";
ALTER TABLE "password_reset_tokens" ALTER COLUMN "createdAt" SET NOT NULL;
ALTER TABLE "password_reset_tokens" ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "password_reset_tokens" ALTER COLUMN "lastRequestAt" SET NOT NULL;
ALTER TABLE "password_reset_tokens" ALTER COLUMN "lastRequestAt" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "password_reset_tokens" ALTER COLUMN "failedAttempts" SET NOT NULL;
ALTER TABLE "password_reset_tokens" ALTER COLUMN "failedAttempts" SET DEFAULT 0;

-- 6. CHECK failedAttempts 0..5
ALTER TABLE "password_reset_tokens"
  DROP CONSTRAINT IF EXISTS "password_reset_tokens_failedAttempts_check";
ALTER TABLE "password_reset_tokens"
  ADD CONSTRAINT "password_reset_tokens_failedAttempts_check"
  CHECK ("failedAttempts" >= 0 AND "failedAttempts" <= 5);

-- 7. Retirer colonne token en clair + anciens indexes (après backfill qui lit "token")
DROP INDEX IF EXISTS "password_reset_tokens_email_token_key";
DROP INDEX IF EXISTS "password_reset_tokens_token_key";
ALTER TABLE "password_reset_tokens" DROP COLUMN IF EXISTS "token";

-- 8. Unicité email + codeHash (après NOT NULL)
CREATE UNIQUE INDEX IF NOT EXISTS "password_reset_tokens_email_key"
  ON "password_reset_tokens"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "password_reset_tokens_codeHash_key"
  ON "password_reset_tokens"("codeHash");

-- 9. Rate-limit PostgreSQL (pas Redis) — keyHash HMAC uniquement
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'PasswordResetRateLimitScope'
  ) THEN
    CREATE TYPE "PasswordResetRateLimitScope" AS ENUM ('IP', 'EMAIL', 'COMBINATION');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "password_reset_rate_limits" (
  "id" TEXT NOT NULL,
  "keyHash" TEXT NOT NULL,
  "scope" "PasswordResetRateLimitScope" NOT NULL,
  "windowStartedAt" TIMESTAMP(3) NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "password_reset_rate_limits_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "password_reset_rate_limits_keyHash_key"
  ON "password_reset_rate_limits"("keyHash");
CREATE INDEX IF NOT EXISTS "password_reset_rate_limits_expiresAt_idx"
  ON "password_reset_rate_limits"("expiresAt");

COMMIT;
