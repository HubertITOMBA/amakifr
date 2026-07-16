-- CreateEnum
CREATE TYPE "MailingRecipientStatus" AS ENUM ('Envoye', 'Relance', 'Repondu');

-- CreateTable
CREATE TABLE "mailing_campaigns" (
    "id" TEXT NOT NULL,
    "objet" VARCHAR(500) NOT NULL,
    "corps" TEXT NOT NULL,
    "lieu" VARCHAR(100) NOT NULL DEFAULT 'Paris',
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mailing_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mailing_campaign_recipients" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "adherentId" TEXT NOT NULL,
    "civilite" VARCHAR(50) NOT NULL DEFAULT '',
    "prenom" VARCHAR(255) NOT NULL,
    "nom" VARCHAR(255) NOT NULL,
    "adresseLigne1" VARCHAR(500) NOT NULL,
    "adresseLigne2" VARCHAR(500),
    "codePostal" VARCHAR(20) NOT NULL,
    "ville" VARCHAR(255) NOT NULL,
    "format" VARCHAR(10) NOT NULL,
    "statut" "MailingRecipientStatus" NOT NULL DEFAULT 'Envoye',
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sendCount" INTEGER NOT NULL DEFAULT 1,
    "reponse" TEXT,
    "reponseAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mailing_campaign_recipients_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mailing_campaigns_createdBy_idx" ON "mailing_campaigns"("createdBy");

-- CreateIndex
CREATE INDEX "mailing_campaigns_createdAt_idx" ON "mailing_campaigns"("createdAt");

-- CreateIndex
CREATE INDEX "mailing_campaign_recipients_campaignId_idx" ON "mailing_campaign_recipients"("campaignId");

-- CreateIndex
CREATE INDEX "mailing_campaign_recipients_adherentId_idx" ON "mailing_campaign_recipients"("adherentId");

-- CreateIndex
CREATE INDEX "mailing_campaign_recipients_statut_idx" ON "mailing_campaign_recipients"("statut");

-- CreateIndex
CREATE INDEX "mailing_campaign_recipients_sentAt_idx" ON "mailing_campaign_recipients"("sentAt");

-- CreateIndex
CREATE UNIQUE INDEX "mailing_campaign_recipients_campaignId_adherentId_key" ON "mailing_campaign_recipients"("campaignId", "adherentId");

-- AddForeignKey
ALTER TABLE "mailing_campaigns" ADD CONSTRAINT "mailing_campaigns_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mailing_campaign_recipients" ADD CONSTRAINT "mailing_campaign_recipients_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "mailing_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mailing_campaign_recipients" ADD CONSTRAINT "mailing_campaign_recipients_adherentId_fkey" FOREIGN KEY ("adherentId") REFERENCES "adherent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
