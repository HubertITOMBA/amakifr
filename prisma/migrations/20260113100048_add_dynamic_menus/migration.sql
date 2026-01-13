-- CreateEnum
CREATE TYPE "MenuRole" AS ENUM ('ADMIN', 'PRESID', 'VICEPR', 'SECRET', 'VICESE', 'COMCPT', 'MEMBRE', 'INVITE', 'VISITEUR');

-- CreateEnum
CREATE TYPE "MenuNiveau" AS ENUM ('NAVBAR', 'SIDEBAR');

-- CreateTable
CREATE TABLE "menus" (
    "id" TEXT NOT NULL,
    "libelle" VARCHAR(100) NOT NULL,
    "description" VARCHAR(500),
    "lien" VARCHAR(255) NOT NULL,
    "niveau" "MenuNiveau" NOT NULL,
    "roles" TEXT[],
    "icone" VARCHAR(100),
    "statut" BOOLEAN NOT NULL DEFAULT true,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "parent" TEXT,
    "electoral" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "menus_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "menus_niveau_idx" ON "menus"("niveau");

-- CreateIndex
CREATE INDEX "menus_statut_idx" ON "menus"("statut");

-- CreateIndex
CREATE INDEX "menus_ordre_idx" ON "menus"("ordre");

-- CreateIndex
CREATE INDEX "menus_electoral_idx" ON "menus"("electoral");

-- AddForeignKey
ALTER TABLE "menus" ADD CONSTRAINT "menus_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
