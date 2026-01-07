-- CreateTable
CREATE TABLE "rapports_reunion" (
    "id" TEXT NOT NULL,
    "titre" VARCHAR(255) NOT NULL,
    "dateReunion" TIMESTAMP(3) NOT NULL,
    "contenu" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rapports_reunion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "rapports_reunion_dateReunion_idx" ON "rapports_reunion"("dateReunion");

-- CreateIndex
CREATE INDEX "rapports_reunion_createdAt_idx" ON "rapports_reunion"("createdAt");

-- CreateIndex
CREATE INDEX "rapports_reunion_createdBy_idx" ON "rapports_reunion"("createdBy");

-- AddForeignKey
ALTER TABLE "rapports_reunion" ADD CONSTRAINT "rapports_reunion_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rapports_reunion" ADD CONSTRAINT "rapports_reunion_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
