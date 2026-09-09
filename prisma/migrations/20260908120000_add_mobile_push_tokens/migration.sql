-- CreateTable
CREATE TABLE "mobile_push_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" VARCHAR(16) NOT NULL,
    "deviceName" VARCHAR(120),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "disabledAt" TIMESTAMP(3),

    CONSTRAINT "mobile_push_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "mobile_push_tokens_token_key" ON "mobile_push_tokens"("token");

-- CreateIndex
CREATE INDEX "mobile_push_tokens_userId_idx" ON "mobile_push_tokens"("userId");

-- CreateIndex
CREATE INDEX "mobile_push_tokens_disabledAt_idx" ON "mobile_push_tokens"("disabledAt");

-- AddForeignKey
ALTER TABLE "mobile_push_tokens" ADD CONSTRAINT "mobile_push_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
