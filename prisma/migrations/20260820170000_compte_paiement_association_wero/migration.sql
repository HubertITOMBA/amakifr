-- Phase B cotisations : comptes de paiement association + moyen Wero
-- ALTER TYPE : valeur ajoutée en fin d'enum (compatible PostgreSQL)

ALTER TYPE "MoyenPaiement" ADD VALUE IF NOT EXISTS 'Wero';

CREATE TABLE IF NOT EXISTS "comptes_paiement_association" (
    "id" TEXT NOT NULL,
    "libelle" VARCHAR(120) NOT NULL,
    "titulaire" VARCHAR(200) NOT NULL,
    "iban" VARCHAR(34) NOT NULL,
    "bic" VARCHAR(11) NOT NULL,
    "codeBanque" VARCHAR(5),
    "codeGuichet" VARCHAR(5),
    "numeroCompte" VARCHAR(14),
    "cleRib" VARCHAR(2),
    "telephoneWero" VARCHAR(20),
    "weroActif" BOOLEAN NOT NULL DEFAULT false,
    "actifPourPaiement" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT NOT NULL,

    CONSTRAINT "comptes_paiement_association_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "comptes_paiement_association_actifPourPaiement_idx"
  ON "comptes_paiement_association"("actifPourPaiement");

-- Au plus un compte actif pour les adhérents
CREATE UNIQUE INDEX IF NOT EXISTS "comptes_paiement_association_one_actif"
  ON "comptes_paiement_association" ("actifPourPaiement")
  WHERE "actifPourPaiement" = true;

ALTER TABLE "comptes_paiement_association"
  ADD CONSTRAINT "comptes_paiement_association_createdBy_fkey"
  FOREIGN KEY ("createdBy") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
