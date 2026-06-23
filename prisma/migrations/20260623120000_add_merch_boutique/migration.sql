-- CreateEnum
CREATE TYPE "MerchOrderStatus" AS ENUM ('EnAttente', 'Confirmee', 'Expediee', 'Annulee');

-- CreateTable
CREATE TABLE "merch_products" (
    "id" TEXT NOT NULL,
    "titre" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "imageCover" VARCHAR(500),
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "merch_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "merch_product_images" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "chemin" VARCHAR(500) NOT NULL,
    "nomFichier" VARCHAR(255),
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "estPrincipale" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "merch_product_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "merch_product_variants" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "taille" VARCHAR(50) NOT NULL,
    "couleur" VARCHAR(50) NOT NULL,
    "prix" DECIMAL(10,2) NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "merch_product_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "merch_orders" (
    "id" TEXT NOT NULL,
    "numeroCommande" VARCHAR(50) NOT NULL,
    "userId" TEXT,
    "email" VARCHAR(255) NOT NULL,
    "nom" VARCHAR(255) NOT NULL,
    "telephone" VARCHAR(30),
    "adresseLivraison" TEXT NOT NULL,
    "ville" VARCHAR(100),
    "codePostal" VARCHAR(20),
    "pays" VARCHAR(100),
    "statut" "MerchOrderStatus" NOT NULL DEFAULT 'EnAttente',
    "montantTotal" DECIMAL(10,2) NOT NULL,
    "notes" TEXT,
    "confirmationEmailSubject" VARCHAR(255),
    "confirmationEmailBody" TEXT,
    "confirmationEmailSentAt" TIMESTAMP(3),
    "confirmationEmailError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "merch_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "merch_order_items" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "productTitre" VARCHAR(255) NOT NULL,
    "taille" VARCHAR(50) NOT NULL,
    "couleur" VARCHAR(50) NOT NULL,
    "prixUnitaire" DECIMAL(10,2) NOT NULL,
    "quantite" INTEGER NOT NULL,
    "sousTotal" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "merch_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "merch_products_slug_key" ON "merch_products"("slug");
CREATE INDEX "merch_products_actif_idx" ON "merch_products"("actif");
CREATE INDEX "merch_products_ordre_idx" ON "merch_products"("ordre");
CREATE INDEX "merch_product_images_productId_idx" ON "merch_product_images"("productId");
CREATE UNIQUE INDEX "merch_product_variants_productId_taille_couleur_key" ON "merch_product_variants"("productId", "taille", "couleur");
CREATE INDEX "merch_product_variants_productId_idx" ON "merch_product_variants"("productId");
CREATE UNIQUE INDEX "merch_orders_numeroCommande_key" ON "merch_orders"("numeroCommande");
CREATE INDEX "merch_orders_userId_idx" ON "merch_orders"("userId");
CREATE INDEX "merch_orders_statut_idx" ON "merch_orders"("statut");
CREATE INDEX "merch_orders_createdAt_idx" ON "merch_orders"("createdAt");
CREATE INDEX "merch_order_items_orderId_idx" ON "merch_order_items"("orderId");

-- AddForeignKey
ALTER TABLE "merch_products" ADD CONSTRAINT "merch_products_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "merch_product_images" ADD CONSTRAINT "merch_product_images_productId_fkey" FOREIGN KEY ("productId") REFERENCES "merch_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "merch_product_variants" ADD CONSTRAINT "merch_product_variants_productId_fkey" FOREIGN KEY ("productId") REFERENCES "merch_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "merch_orders" ADD CONSTRAINT "merch_orders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "merch_order_items" ADD CONSTRAINT "merch_order_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "merch_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "merch_order_items" ADD CONSTRAINT "merch_order_items_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "merch_product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
