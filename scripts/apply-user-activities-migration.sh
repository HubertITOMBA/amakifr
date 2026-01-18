#!/bin/bash

# Script pour appliquer la migration user_activities manuellement

set -e

echo "🔧 Application de la migration user_activities..."

# Charger les variables d'environnement
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Vérifier que DATABASE_URL est défini
if [ -z "$DATABASE_URL" ]; then
    echo "❌ Erreur: DATABASE_URL n'est pas défini dans .env"
    exit 1
fi

# Résoudre l'état de la migration (si elle est en erreur)
echo "📋 Résolution de l'état de la migration..."
npx prisma migrate resolve --rolled-back 20260117183215_add_user_activities 2>/dev/null || echo "⚠️  Migration déjà résolue ou non trouvée"

# Appliquer la migration
echo "🚀 Application de la migration..."
npx prisma migrate deploy

# Régénérer le client Prisma
echo "🔄 Régénération du client Prisma..."
npx prisma generate

echo "✅ Migration appliquée avec succès!"
echo ""
echo "📝 Prochaines étapes:"
echo "   1. Redémarrez votre serveur de développement"
echo "   2. Le menu 'Activités utilisateurs' apparaîtra dans la sidebar admin"
echo "   3. Les activités seront enregistrées automatiquement"
