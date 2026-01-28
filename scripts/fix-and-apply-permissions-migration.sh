#!/bin/bash

# Script pour résoudre les migrations bloquées et appliquer la migration permissions
# Usage: ./scripts/fix-and-apply-permissions-migration.sh

set -e

echo "🔧 Résolution des migrations bloquées et application de la migration permissions"
echo ""

# Charger DATABASE_URL depuis .env
if [ -f .env ]; then
    export DATABASE_URL=$(grep "^DATABASE_URL=" .env | cut -d '=' -f2- | tr -d '"' | tr -d "'")
fi

# Vérifier que DATABASE_URL est définie
if [ -z "$DATABASE_URL" ]; then
    echo "❌ Erreur: DATABASE_URL n'est pas définie dans .env"
    echo "💡 Vérifiez que le fichier .env contient DATABASE_URL=..."
    exit 1
fi

echo "📋 Étape 1: Vérification de l'état de la migration échouée..."
psql "$DATABASE_URL" -c "
SELECT migration_name, 
       CASE WHEN finished_at IS NOT NULL THEN 'Appliquée' 
            WHEN rolled_back_at IS NOT NULL THEN 'Rolled-back'
            ELSE 'En échec' END as status,
       started_at, finished_at, rolled_back_at 
FROM _prisma_migrations 
WHERE migration_name = '20260127130000_create_user_admin_roles_table';
" || {
    echo "⚠️  Impossible de vérifier l'état de la migration. Continuons..."
}

echo ""
echo "📋 Étape 2: Résolution de la migration échouée..."

# Vérifier si la table user_admin_roles existe
TABLE_EXISTS=$(psql "$DATABASE_URL" -t -c "
SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'user_admin_roles'
);
" | tr -d ' ')

if [ "$TABLE_EXISTS" = "t" ]; then
    echo "✅ La table user_admin_roles existe. Marquage de la migration comme appliquée..."
    psql "$DATABASE_URL" -c "
    UPDATE _prisma_migrations 
    SET finished_at = NOW(), 
        rolled_back_at = NULL
    WHERE migration_name = '20260127130000_create_user_admin_roles_table'
    AND finished_at IS NULL;
    " && echo "✅ Migration marquée comme appliquée"
else
    echo "⚠️  La table user_admin_roles n'existe pas. Marquage de la migration comme rolled-back..."
    psql "$DATABASE_URL" -c "
    UPDATE _prisma_migrations 
    SET rolled_back_at = NOW()
    WHERE migration_name = '20260127130000_create_user_admin_roles_table'
    AND rolled_back_at IS NULL;
    " && echo "✅ Migration marquée comme rolled-back"
fi

echo ""
echo "📋 Étape 3: Vérification de l'existence de la table permissions..."

PERMISSIONS_EXISTS=$(psql "$DATABASE_URL" -t -c "
SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'permissions'
);
" | tr -d ' ')

if [ "$PERMISSIONS_EXISTS" = "t" ]; then
    echo "✅ La table permissions existe déjà."
    echo "📊 Nombre de permissions existantes:"
    psql "$DATABASE_URL" -c "SELECT COUNT(*) as total FROM permissions;"
else
    echo "📋 Étape 4: Application de la migration pour créer la table permissions..."
    
    if [ -f "prisma/migrations/20260129000000_create_permissions_table/migration.sql" ]; then
        psql "$DATABASE_URL" -f prisma/migrations/20260129000000_create_permissions_table/migration.sql
        
        if [ $? -eq 0 ]; then
            echo "✅ Migration appliquée avec succès!"
            echo ""
            echo "📊 Permissions créées:"
            psql "$DATABASE_URL" -c "SELECT action, resource, type, array_length(roles, 1) as nb_roles FROM permissions ORDER BY resource, action;"
        else
            echo "❌ Erreur lors de l'application de la migration"
            exit 1
        fi
    else
        echo "❌ Fichier de migration non trouvé: prisma/migrations/20260129000000_create_permissions_table/migration.sql"
        exit 1
    fi
fi

echo ""
echo "✅ Toutes les étapes sont terminées!"
echo ""
echo "📋 Prochaines étapes:"
echo "1. Régénérer le client Prisma: npx prisma generate"
echo "2. Redémarrer le serveur Next.js"
echo "   - En développement: Arrêtez (Ctrl+C) et relancez npm run dev"
echo "   - En production: pm2 restart amakifr"
