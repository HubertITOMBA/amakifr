-- CreateTable
CREATE TABLE "pass_assistance" (
    "id" TEXT NOT NULL,
    "description" VARCHAR(255) NOT NULL,
    "montant" DECIMAL(10,2) NOT NULL,
    "type" "TypeEvenementFamilial" NOT NULL,
    "typeCotisationMensuelleId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pass_assistance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pass_assistance_type_key" ON "pass_assistance"("type");

-- AddForeignKey
ALTER TABLE "pass_assistance" ADD CONSTRAINT "pass_assistance_typeCotisationMensuelleId_fkey" FOREIGN KEY ("typeCotisationMensuelleId") REFERENCES "types_cotisation_mensuelle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed montants fixes par type d'assistance (50 € par défaut)
INSERT INTO "pass_assistance" ("id", "description", "montant", "type", "createdAt", "updatedAt") VALUES
  ('pass_' || md5(random()::text || clock_timestamp()::text), 'Naissance', 50.00, 'Naissance', NOW(), NOW()),
  ('pass_' || md5(random()::text || clock_timestamp()::text), 'Mariage d''un enfant', 50.00, 'MariageEnfant', NOW(), NOW()),
  ('pass_' || md5(random()::text || clock_timestamp()::text), 'Décès dans la famille', 50.00, 'DecesFamille', NOW(), NOW()),
  ('pass_' || md5(random()::text || clock_timestamp()::text), 'Anniversaire en salle', 50.00, 'AnniversaireSalle', NOW(), NOW()),
  ('pass_' || md5(random()::text || clock_timestamp()::text), 'Autre', 50.00, 'Autre', NOW(), NOW());
