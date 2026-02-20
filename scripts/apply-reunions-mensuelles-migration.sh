#!/bin/bash

# Script pour appliquer la migration des réunions mensuelles manuellement

set -e

echo "🚀 Application de la migration des réunions mensuelles..."
echo ""

# Vérifier si les tables existent déjà
echo "🔍 Vérification de l'état actuel..."
TABLES_EXIST=$(psql $DATABASE_URL -tAc "SELECT COUNT(*) FROM pg_tables WHERE schemaname='public' AND tablename IN ('reunions_mensuelles', 'participations_reunion');" 2>/dev/null || echo "0")

if [ "$TABLES_EXIST" = "2" ]; then
  echo "✅ Les tables existent déjà dans la base de données"
  echo "📝 Marquage de la migration comme appliquée..."
  npx prisma migrate resolve --applied 20260219143659_add_reunions_mensuelles 2>/dev/null || echo "⚠️ Migration peut-être déjà marquée"
else
  echo "📦 Application de la migration SQL..."
  
  # Appliquer la migration SQL directement
  if cat prisma/migrations/20260219143659_add_reunions_mensuelles/migration.sql | npx prisma db execute --stdin --schema=prisma/schema.prisma 2>&1; then
    echo "✅ Migration SQL appliquée avec succès"
    
    # Marquer comme appliquée
    echo "📝 Marquage de la migration comme appliquée..."
    npx prisma migrate resolve --applied 20260219143659_add_reunions_mensuelles 2>/dev/null || echo "⚠️ Impossible de marquer la migration (peut être normal)"
  else
    echo "❌ Erreur lors de l'application de la migration"
    echo ""
    echo "💡 Solutions possibles :"
    echo "   1. Vérifiez votre connexion à la base de données"
    echo "   2. Vérifiez que les enums n'existent pas déjà :"
    echo "      psql \$DATABASE_URL -c \"SELECT typname FROM pg_type WHERE typtype='e' AND typname IN ('StatutReunionMensuelle', 'TypeLieuReunion', 'StatutParticipationReunion');\""
    echo "   3. Si les enums existent mais pas les tables, créez uniquement les tables"
    exit 1
  fi
fi

# Régénérer le client Prisma
echo ""
echo "🔄 Régénération du client Prisma..."
npx prisma generate

echo ""
echo "✅ Migration appliquée avec succès !"
echo ""
echo "📋 Prochaines étapes :"
echo "   1. Vérifier les menus : npm run db:seed-menus"
echo "   2. Redémarrer le serveur : npm run dev"
echo "   3. Tester : accéder à /reunions-mensuelles"
echo ""
echo "🔍 Pour diagnostiquer les problèmes :"
echo "   tsx scripts/check-reunions-mensuelles.ts"
