-- Rendre montantRestant calculé (GENERATED) sur dettes_initiales
-- montantRestant = montant - montantPaye (plus de stockage redondant, cohérence garantie)
--
-- Important (prod) : ne pas utiliser DO $$ (plpgsql) car certains serveurs n'ont pas plpgsql disponible.
-- Cette migration est volontairement simple et s'exécute une seule fois.

ALTER TABLE "dettes_initiales" DROP COLUMN IF EXISTS "montantRestant";
ALTER TABLE "dettes_initiales"
  ADD COLUMN "montantRestant" DECIMAL(10,2) GENERATED ALWAYS AS ("montant" - "montantPaye") STORED;
