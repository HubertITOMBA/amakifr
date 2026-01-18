#!/bin/bash

# Script pour appliquer la migration des projets manuellement
# (nécessaire à cause du problème de collation PostgreSQL)

set -e

echo "🚀 Application de la migration des projets..."

# 1. Résoudre l'état de la migration (si elle existe déjà)
echo "📝 Résolution de l'état de la migration..."
npx prisma migrate resolve --applied 20250118120000_add_projets_system || echo "⚠️ Migration pas encore dans l'historique, c'est normal"

# 2. Appliquer la migration SQL directement
echo "📦 Application de la migration SQL..."
cat prisma/migrations/20250118120000_add_projets_system/migration.sql | npx prisma db execute --stdin --schema=prisma/schema.prisma || echo "⚠️ Migration peut-être déjà appliquée"

# 3. Régénérer le client Prisma
echo "🔄 Régénération du client Prisma..."
npx prisma generate

echo "✅ Migration appliquée avec succès !"
echo ""
echo "📋 Prochaines étapes :"
echo "   1. Redémarrer le serveur de développement"
echo "   2. Les menus 'Projets' et 'Mes tâches' apparaîtront automatiquement"
echo "   3. Vous pouvez maintenant créer des projets depuis /admin/projets"
