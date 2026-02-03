-- DropIndex: ancienne contrainte unique (une ligne par periode + type + adherent)
DROP INDEX IF EXISTS "cotisations_mensuelles_periode_typeCotisationId_adherentId_key";

-- CreateIndex: nouvelle contrainte unique (une ligne par periode + adherent + cotisation_du_mois)
-- Permet plusieurs lignes par adherent par période : une pour le forfait, une par assistance à payer
CREATE UNIQUE INDEX "unique_periode_adherent_cotisation_du_mois" ON "cotisations_mensuelles"("periode", "adherentId", "cotisationDuMoisId");
