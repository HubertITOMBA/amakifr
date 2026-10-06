-- Sécurisation VerificationToken : unique email, createdAt, failedAttempts, lockedAt.
-- Aucune suppression de ligne. Aucune donnée réelle.
-- Transaction atomique : tout ou rien.

BEGIN;

-- 1. Arrêt si plusieurs lignes partagent le même email (message agrégé uniquement)
DO $$
DECLARE
  duplicate_email_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO duplicate_email_count
  FROM (
    SELECT email
    FROM "verification_tokens"
    GROUP BY email
    HAVING COUNT(*) > 1
  ) duplicates;

  IF duplicate_email_count > 0 THEN
    RAISE EXCEPTION
      'verification_token_security aborted: % email(s) have duplicate rows',
      duplicate_email_count;
  END IF;
END $$;

-- 2. createdAt nullable sans valeur par défaut initiale
ALTER TABLE "verification_tokens" ADD COLUMN "createdAt" TIMESTAMP(3);

-- 3. Backfill exact : createdAt = expires - 5 minutes
UPDATE "verification_tokens"
SET "createdAt" = "expires" - INTERVAL '5 minutes'
WHERE "createdAt" IS NULL;

-- 4. NOT NULL puis DEFAULT CURRENT_TIMESTAMP
ALTER TABLE "verification_tokens" ALTER COLUMN "createdAt" SET NOT NULL;
ALTER TABLE "verification_tokens" ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP;

-- 5. Compteur d'échecs et verrouillage
ALTER TABLE "verification_tokens" ADD COLUMN "failedAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "verification_tokens" ADD COLUMN "lockedAt" TIMESTAMP(3);

-- 6. Contrainte CHECK (0..3)
ALTER TABLE "verification_tokens"
ADD CONSTRAINT "verification_tokens_failedAttempts_check"
CHECK ("failedAttempts" >= 0 AND "failedAttempts" <= 3);

-- 7. Supprimer l'index unique composite email+token
DROP INDEX IF EXISTS "verification_tokens_email_token_key";

-- 8. Index unique sur email (un seul token actif par email)
CREATE UNIQUE INDEX "verification_tokens_email_key" ON "verification_tokens"("email");

COMMIT;

-- 9. L'unique sur token (verification_tokens_token_key) est conservé tel quel.
