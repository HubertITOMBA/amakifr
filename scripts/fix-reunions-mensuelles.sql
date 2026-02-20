-- Script SQL pour créer les tables des réunions mensuelles
-- Exécuter avec: psql -d amakifr -f scripts/fix-reunions-mensuelles.sql

-- Créer les enums si ils n'existent pas
DO $$ BEGIN
    CREATE TYPE "StatutReunionMensuelle" AS ENUM ('EnAttente', 'MoisValide', 'DateConfirmee', 'Annulee');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "TypeLieuReunion" AS ENUM ('Domicile', 'Restaurant', 'Autre');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "StatutParticipationReunion" AS ENUM ('Present', 'Absent', 'Excuse', 'NonRepondu');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Créer la table reunions_mensuelles si elle n'existe pas
CREATE TABLE IF NOT EXISTS "reunions_mensuelles" (
    "id" TEXT NOT NULL,
    "annee" INTEGER NOT NULL,
    "mois" INTEGER NOT NULL,
    "statut" "StatutReunionMensuelle" NOT NULL DEFAULT 'EnAttente',
    "adherentHoteId" TEXT NOT NULL,
    "dateReunion" TIMESTAMP(3),
    "typeLieu" "TypeLieuReunion" NOT NULL DEFAULT 'Domicile',
    "adresse" TEXT,
    "nomRestaurant" VARCHAR(255),
    "commentaires" TEXT,
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "reunions_mensuelles_pkey" PRIMARY KEY ("id")
);

-- Créer la table participations_reunion si elle n'existe pas
CREATE TABLE IF NOT EXISTS "participations_reunion" (
    "id" TEXT NOT NULL,
    "reunionId" TEXT NOT NULL,
    "adherentId" TEXT NOT NULL,
    "statut" "StatutParticipationReunion" NOT NULL DEFAULT 'NonRepondu',
    "commentaire" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "participations_reunion_pkey" PRIMARY KEY ("id")
);

-- Créer les index uniques si ils n'existent pas
CREATE UNIQUE INDEX IF NOT EXISTS "reunions_mensuelles_annee_mois_key" ON "reunions_mensuelles"("annee", "mois");
CREATE UNIQUE INDEX IF NOT EXISTS "participations_reunion_reunionId_adherentId_key" ON "participations_reunion"("reunionId", "adherentId");

-- Créer les index si ils n'existent pas
CREATE INDEX IF NOT EXISTS "reunions_mensuelles_annee_mois_idx" ON "reunions_mensuelles"("annee", "mois");
CREATE INDEX IF NOT EXISTS "reunions_mensuelles_adherentHoteId_idx" ON "reunions_mensuelles"("adherentHoteId");
CREATE INDEX IF NOT EXISTS "reunions_mensuelles_statut_idx" ON "reunions_mensuelles"("statut");
CREATE INDEX IF NOT EXISTS "reunions_mensuelles_dateReunion_idx" ON "reunions_mensuelles"("dateReunion");
CREATE INDEX IF NOT EXISTS "participations_reunion_reunionId_idx" ON "participations_reunion"("reunionId");
CREATE INDEX IF NOT EXISTS "participations_reunion_adherentId_idx" ON "participations_reunion"("adherentId");
CREATE INDEX IF NOT EXISTS "participations_reunion_statut_idx" ON "participations_reunion"("statut");

-- Ajouter les contraintes de clés étrangères si elles n'existent pas
DO $$ BEGIN
    ALTER TABLE "reunions_mensuelles" ADD CONSTRAINT "reunions_mensuelles_adherentHoteId_fkey" FOREIGN KEY ("adherentHoteId") REFERENCES "adherents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "reunions_mensuelles" ADD CONSTRAINT "reunions_mensuelles_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "reunions_mensuelles" ADD CONSTRAINT "reunions_mensuelles_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "participations_reunion" ADD CONSTRAINT "participations_reunion_reunionId_fkey" FOREIGN KEY ("reunionId") REFERENCES "reunions_mensuelles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "participations_reunion" ADD CONSTRAINT "participations_reunion_adherentId_fkey" FOREIGN KEY ("adherentId") REFERENCES "adherents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Marquer la migration comme appliquée
INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
VALUES (
    gen_random_uuid()::text,
    '',
    NOW(),
    '20260219143659_add_reunions_mensuelles',
    NULL,
    NULL,
    NOW(),
    1
) ON CONFLICT DO NOTHING;
