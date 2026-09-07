-- Paiement inscriptions événements (Prompt 43.6)
-- Ajoute suivi montant/statut sur InscriptionEvenement + FK sur PaiementCotisation.
-- Backfill : inscriptions payantes historiques → APayer (montantPaye=0) faute de preuve de règlement.

CREATE TYPE "StatutPaiementEvenement" AS ENUM (
  'NonApplicable',
  'APayer',
  'EnAttenteValidation',
  'PartiellementPaye',
  'Paye'
);

ALTER TABLE "inscriptions_evenements"
  ADD COLUMN IF NOT EXISTS "montantAttendu" DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "montantPaye" DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "statutPaiement" "StatutPaiementEvenement" NOT NULL DEFAULT 'NonApplicable';

ALTER TABLE "paiements_cotisation"
  ADD COLUMN IF NOT EXISTS "inscriptionEvenementId" TEXT;

CREATE INDEX IF NOT EXISTS "paiements_cotisation_inscriptionEvenementId_idx"
  ON "paiements_cotisation"("inscriptionEvenementId");

CREATE INDEX IF NOT EXISTS "inscriptions_evenements_statutPaiement_idx"
  ON "inscriptions_evenements"("statutPaiement");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'paiements_cotisation_inscriptionEvenementId_fkey'
  ) THEN
    ALTER TABLE "paiements_cotisation"
      ADD CONSTRAINT "paiements_cotisation_inscriptionEvenementId_fkey"
      FOREIGN KEY ("inscriptionEvenementId")
      REFERENCES "inscriptions_evenements"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Backfill : snapshot montantAttendu = prix × nombrePersonnes si payant
UPDATE "inscriptions_evenements" i
SET
  "montantAttendu" = ROUND((e."prix" * i."nombrePersonnes")::numeric, 2),
  "montantPaye" = 0,
  "statutPaiement" = 'APayer'
FROM "evenements" e
WHERE e."id" = i."evenementId"
  AND e."prix" IS NOT NULL
  AND e."prix" > 0;

UPDATE "inscriptions_evenements" i
SET
  "montantAttendu" = 0,
  "montantPaye" = 0,
  "statutPaiement" = 'NonApplicable'
FROM "evenements" e
WHERE e."id" = i."evenementId"
  AND (e."prix" IS NULL OR e."prix" <= 0);
