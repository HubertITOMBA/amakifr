-- CreateTable
CREATE TABLE "mobile_refresh_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "refreshTokenHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "rotatedFromId" TEXT,

    CONSTRAINT "mobile_refresh_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "mobile_refresh_sessions_refreshTokenHash_key" ON "mobile_refresh_sessions"("refreshTokenHash");

-- CreateIndex
CREATE INDEX "mobile_refresh_sessions_userId_idx" ON "mobile_refresh_sessions"("userId");

-- CreateIndex
CREATE INDEX "mobile_refresh_sessions_expiresAt_idx" ON "mobile_refresh_sessions"("expiresAt");

-- CreateIndex
CREATE INDEX "mobile_refresh_sessions_revokedAt_idx" ON "mobile_refresh_sessions"("revokedAt");

-- AddForeignKey
ALTER TABLE "mobile_refresh_sessions" ADD CONSTRAINT "mobile_refresh_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mobile_refresh_sessions" ADD CONSTRAINT "mobile_refresh_sessions_rotatedFromId_fkey" FOREIGN KEY ("rotatedFromId") REFERENCES "mobile_refresh_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
