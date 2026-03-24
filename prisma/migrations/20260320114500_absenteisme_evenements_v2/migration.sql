-- V2 absentéisme: événements obligatoires + statut de participation événement

ALTER TABLE "evenements"
  ADD COLUMN IF NOT EXISTS "obligatoireParticipation" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "inscriptions_evenements"
  ADD COLUMN IF NOT EXISTS "participationStatut" TEXT NOT NULL DEFAULT 'NonRenseigne';

ALTER TABLE "inscriptions_evenements"
  ADD COLUMN IF NOT EXISTS "justificatifFournit" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "inscriptions_evenements"
  ADD COLUMN IF NOT EXISTS "justificatifNote" TEXT;
