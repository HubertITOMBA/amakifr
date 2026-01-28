#!/bin/bash

# Script pour appliquer la migration de la table permissions
# Usage: ./scripts/apply-permissions-migration.sh

set -e

# Charger DATABASE_URL depuis .env
if [ -f .env ]; then
    # Utiliser une méthode plus sûre pour charger DATABASE_URL
    export DATABASE_URL=$(grep "^DATABASE_URL=" .env | cut -d '=' -f2- | tr -d '"' | tr -d "'")
fi

# Vérifier que DATABASE_URL est définie
if [ -z "$DATABASE_URL" ]; then
    echo "❌ Erreur: DATABASE_URL n'est pas définie dans .env"
    echo "💡 Vérifiez que le fichier .env contient DATABASE_URL=..."
    exit 1
fi

echo "🔧 Application de la migration pour la table permissions..."

# Utiliser DATABASE_URL directement
DB_URL="$DATABASE_URL"

# Appliquer la migration SQL
psql "$DB_URL" -f prisma/migrations/20260129000000_create_permissions_table/migration.sql

if [ $? -eq 0 ]; then
    echo "✅ Migration appliquée avec succès!"
    echo ""
    echo "📋 Vérification de la table permissions..."
    psql "$DB_URL" -c "\d permissions" || echo "⚠️  La table permissions existe mais la commande \d a échoué"
    echo ""
    echo "✅ La table permissions a été créée avec succès!"
    echo "🔄 N'oubliez pas de redémarrer le serveur Next.js pour que les changements prennent effet."
else
    echo "❌ Erreur lors de l'application de la migration"
    exit 1
fi
