-- AlterTable: justificatif de virement sur les paiements
ALTER TABLE "paiements_cotisation" ADD COLUMN IF NOT EXISTS "justificatifChemin" VARCHAR(500);

-- Note: le renommage d'index pass_assistance était incorrect ici (l'index pass_assistance_type_unique
-- n'existe qu'après la migration 20260226120000). L'état final est géré par 20260226120000.
