-- Quiz « En direct » : pilotage question par question (DEV).
-- Additive : défaut modeEnDirect=false / liveEtat=EnAttente (parcours classiques inchangés).

CREATE TYPE "SondageQuestionLiveEtat" AS ENUM (
  'EnAttente',
  'Ouverte',
  'Fermee',
  'CorrigeRevele'
);

ALTER TABLE "sondages"
  ADD COLUMN IF NOT EXISTS "modeEnDirect" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "sondages_modeEnDirect_idx" ON "sondages"("modeEnDirect");

ALTER TABLE "sondage_questions"
  ADD COLUMN IF NOT EXISTS "liveEtat" "SondageQuestionLiveEtat" NOT NULL DEFAULT 'EnAttente';

CREATE INDEX IF NOT EXISTS "sondage_questions_liveEtat_idx" ON "sondage_questions"("liveEtat");
