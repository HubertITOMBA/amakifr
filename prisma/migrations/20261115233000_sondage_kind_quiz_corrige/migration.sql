-- Quiz v1 : kind Sondage|Quiz, corrigé publié ADMIN, bonne réponse + explication.
-- Additive : défaut Sondage / false pour les lignes existantes.

CREATE TYPE "SondageKind" AS ENUM ('Sondage', 'Quiz');

ALTER TABLE "sondages"
  ADD COLUMN IF NOT EXISTS "kind" "SondageKind" NOT NULL DEFAULT 'Sondage';

ALTER TABLE "sondages"
  ADD COLUMN IF NOT EXISTS "corrigeVisiblesAdherents" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "sondages_kind_idx" ON "sondages"("kind");

ALTER TABLE "sondage_questions"
  ADD COLUMN IF NOT EXISTS "explication" TEXT;

ALTER TABLE "sondage_options"
  ADD COLUMN IF NOT EXISTS "estCorrecte" BOOLEAN NOT NULL DEFAULT false;
