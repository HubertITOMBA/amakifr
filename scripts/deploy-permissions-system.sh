#!/bin/bash

# Script de déploiement automatisé du système de permissions dynamiques
# Usage: ./scripts/deploy-permissions-system.sh [--skip-build] [--skip-restart]

set -e

SKIP_BUILD=false
SKIP_RESTART=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-build)
            SKIP_BUILD=true
            shift
            ;;
        --skip-restart)
            SKIP_RESTART=true
            shift
            ;;
        *)
            echo "Usage: $0 [--skip-build] [--skip-restart]"
            exit 1
            ;;
    esac
done

echo "🚀 Déploiement du système de permissions dynamiques"
echo "=================================================="
echo ""

# Charger DATABASE_URL depuis .env
if [ -f .env ]; then
    export DATABASE_URL=$(grep "^DATABASE_URL=" .env | cut -d '=' -f2- | tr -d '"' | tr -d "'")
fi

# Vérifier que DATABASE_URL est définie
if [ -z "$DATABASE_URL" ]; then
    echo "❌ Erreur: DATABASE_URL n'est pas définie dans .env"
    exit 1
fi

echo "📋 Étape 1/7 : Vérification de l'état des migrations..."
npx prisma migrate status || {
    echo "⚠️  Des migrations sont en échec. Résolution..."
    if [ -f "scripts/fix-and-apply-permissions-migration.sh" ]; then
        chmod +x scripts/fix-and-apply-permissions-migration.sh
        ./scripts/fix-and-apply-permissions-migration.sh
    else
        echo "❌ Script de résolution non trouvé. Veuillez résoudre manuellement."
        exit 1
    fi
}

echo ""
echo "📋 Étape 2/7 : Vérification de l'existence de la table permissions..."

PERMISSIONS_EXISTS=$(psql "$DATABASE_URL" -t -c "
SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'permissions'
);
" | tr -d ' ')

if [ "$PERMISSIONS_EXISTS" != "t" ]; then
    echo "📋 Application de la migration permissions..."
    
    if [ -f "prisma/migrations/20260129000000_create_permissions_table/migration.sql" ]; then
        psql "$DATABASE_URL" -f prisma/migrations/20260129000000_create_permissions_table/migration.sql
        
        if [ $? -eq 0 ]; then
            echo "✅ Migration appliquée avec succès!"
            PERM_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM permissions;" | tr -d ' ')
            echo "📊 Permissions créées: $PERM_COUNT"
        else
            echo "❌ Erreur lors de l'application de la migration"
            exit 1
        fi
    else
        echo "❌ Fichier de migration non trouvé"
        exit 1
    fi
else
    PERM_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM permissions;" | tr -d ' ')
    echo "✅ La table permissions existe déjà ($PERM_COUNT permissions)"
fi

echo ""
echo "📋 Étape 3/7 : Régénération du client Prisma..."
npx prisma generate

if [ $? -eq 0 ]; then
    echo "✅ Client Prisma régénéré"
else
    echo "❌ Erreur lors de la régénération du client Prisma"
    exit 1
fi

echo ""
echo "📋 Étape 4/7 : Vérification du modèle Permission..."
node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
if ('permission' in prisma) {
    console.log('✅ Modèle Permission disponible');
    process.exit(0);
} else {
    console.log('❌ Modèle Permission non disponible');
    process.exit(1);
}
" || {
    echo "⚠️  Le modèle Permission n'est pas disponible. Vérifiez schema.prisma et régénérez."
    exit 1
}

if [ "$SKIP_BUILD" = false ]; then
    echo ""
    echo "📋 Étape 5/7 : Installation des dépendances..."
    npm install
    
    echo ""
    echo "📋 Étape 6/7 : Build de l'application..."
    npm run build
    
    if [ $? -eq 0 ]; then
        echo "✅ Build réussi"
    else
        echo "❌ Erreur lors du build"
        exit 1
    fi
else
    echo ""
    echo "⏭️  Étape 5-6/7 : Build ignoré (--skip-build)"
fi

if [ "$SKIP_RESTART" = false ]; then
    echo ""
    echo "📋 Étape 7/7 : Redémarrage de l'application..."
    
    # Vérifier si PM2 est utilisé
    if command -v pm2 &> /dev/null; then
        pm2 restart amakifr --update-env
        echo "✅ Application redémarrée avec PM2"
    elif command -v systemctl &> /dev/null && systemctl is-active --quiet amakifr 2>/dev/null; then
        sudo systemctl restart amakifr
        echo "✅ Application redémarrée avec systemctl"
    elif command -v supervisorctl &> /dev/null; then
        supervisorctl restart amakifr
        echo "✅ Application redémarrée avec supervisor"
    else
        echo "⚠️  Aucun gestionnaire de processus détecté. Redémarrez manuellement."
    fi
else
    echo ""
    echo "⏭️  Étape 7/7 : Redémarrage ignoré (--skip-restart)"
fi

echo ""
echo "✅ Déploiement terminé!"
echo ""
echo "📋 Prochaines étapes:"
echo "1. Vérifier les logs: pm2 logs amakifr --lines 50"
echo "2. Tester l'interface: /admin/settings → onglet Permissions"
echo "3. Vérifier que toutes les catégories s'affichent"
echo "4. Tester la modification et sauvegarde de permissions"
echo ""
echo "📚 Documentation: Voir DEPLOY_PERMISSIONS_SYSTEM.md pour plus de détails"
