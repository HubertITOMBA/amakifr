-- Migration pour ajouter la table media_galerie
-- Cette migration est idempotente et peut être exécutée plusieurs fois sans erreur

-- Vérifier si la table existe déjà
DO $$
BEGIN
    -- Créer la table si elle n'existe pas
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'media_galerie') THEN
        CREATE TABLE "media_galerie" (
            "id" TEXT NOT NULL,
            "titre" VARCHAR(255) NOT NULL,
            "description" TEXT,
            "type" TEXT NOT NULL,
            "chemin" VARCHAR(500) NOT NULL,
            "nomFichier" VARCHAR(255) NOT NULL,
            "mimeType" VARCHAR(100) NOT NULL,
            "taille" INTEGER NOT NULL,
            "categorie" VARCHAR(100) NOT NULL,
            "couleur" VARCHAR(50) NOT NULL DEFAULT 'blue',
            "date" TIMESTAMP(3) NOT NULL,
            "lieu" VARCHAR(200),
            "ordre" INTEGER NOT NULL DEFAULT 0,
            "actif" BOOLEAN NOT NULL DEFAULT true,
            "createdBy" TEXT NOT NULL,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL,

            CONSTRAINT "media_galerie_pkey" PRIMARY KEY ("id")
        );

        -- Créer la contrainte de clé étrangère
        ALTER TABLE "media_galerie" ADD CONSTRAINT "media_galerie_createdBy_fkey" 
            FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

        -- Créer les index
        CREATE INDEX "media_galerie_categorie_idx" ON "media_galerie"("categorie");
        CREATE INDEX "media_galerie_type_idx" ON "media_galerie"("type");
        CREATE INDEX "media_galerie_actif_idx" ON "media_galerie"("actif");
        CREATE INDEX "media_galerie_ordre_idx" ON "media_galerie"("ordre");
        CREATE INDEX "media_galerie_date_idx" ON "media_galerie"("date");

        RAISE NOTICE 'Table media_galerie créée avec succès';
    ELSE
        RAISE NOTICE 'Table media_galerie existe déjà';
    END IF;
END $$;

