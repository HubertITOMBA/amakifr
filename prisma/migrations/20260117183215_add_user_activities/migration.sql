-- CreateEnum
CREATE TYPE "TypeActivite" AS ENUM ('Connexion', 'Deconnexion', 'Creation', 'Modification', 'Suppression', 'Consultation', 'Export', 'Import', 'Authentification', 'ChangementMotDePasse', 'Autre');

-- CreateTable
CREATE TABLE "user_activities" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userName" VARCHAR(255),
    "userEmail" VARCHAR(255),
    "type" "TypeActivite" NOT NULL,
    "action" VARCHAR(255) NOT NULL,
    "entityType" VARCHAR(100),
    "entityId" VARCHAR(255),
    "details" JSONB,
    "ipAddress" VARCHAR(45),
    "userAgent" VARCHAR(500),
    "url" VARCHAR(500),
    "success" BOOLEAN NOT NULL DEFAULT true,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_activities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_activities_userId_idx" ON "user_activities"("userId");

-- CreateIndex
CREATE INDEX "user_activities_type_idx" ON "user_activities"("type");

-- CreateIndex
CREATE INDEX "user_activities_entityType_idx" ON "user_activities"("entityType");

-- CreateIndex
CREATE INDEX "user_activities_entityId_idx" ON "user_activities"("entityId");

-- CreateIndex
CREATE INDEX "user_activities_createdAt_idx" ON "user_activities"("createdAt");

-- CreateIndex
CREATE INDEX "user_activities_success_idx" ON "user_activities"("success");

-- AddForeignKey
ALTER TABLE "user_activities" ADD CONSTRAINT "user_activities_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
