-- CreateTable
CREATE TABLE "suppressions_adherent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userName" VARCHAR(255) NOT NULL,
    "userEmail" VARCHAR(255),
    "userRole" "UserRole" NOT NULL,
    "adherentFirstName" VARCHAR(100),
    "adherentLastName" VARCHAR(100),
    "reason" TEXT NOT NULL,
    "notifyUser" BOOLEAN NOT NULL DEFAULT false,
    "deletedBy" TEXT NOT NULL,
    "deletedByName" VARCHAR(255) NOT NULL,
    "deletedByEmail" VARCHAR(255),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "suppressions_adherent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "suppressions_adherent_userId_idx" ON "suppressions_adherent"("userId");

-- CreateIndex
CREATE INDEX "suppressions_adherent_deletedBy_idx" ON "suppressions_adherent"("deletedBy");

-- CreateIndex
CREATE INDEX "suppressions_adherent_createdAt_idx" ON "suppressions_adherent"("createdAt");

-- CreateIndex
CREATE INDEX "suppressions_adherent_userEmail_idx" ON "suppressions_adherent"("userEmail");

-- AddForeignKey
ALTER TABLE "suppressions_adherent" ADD CONSTRAINT "suppressions_adherent_deletedBy_fkey" FOREIGN KEY ("deletedBy") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
