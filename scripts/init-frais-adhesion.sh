#!/bin/bash

# Script shell pour initialiser les frais d'adhésion
# 
# Ce script exécute le script TypeScript d'initialisation des frais d'adhésion
# 
# Usage:
#   bash scripts/init-frais-adhesion.sh
#   ou
#   chmod +x scripts/init-frais-adhesion.sh
#   ./scripts/init-frais-adhesion.sh

set -e

echo "🚀 Initialisation des frais d'adhésion..."
echo ""

# Vérifier si tsx est installé
if ! command -v npx &> /dev/null; then
    echo "❌ Erreur: npx n'est pas installé."
    echo "   Veuillez installer Node.js et npm."
    exit 1
fi

# Exécuter le script TypeScript
echo "📦 Exécution du script d'initialisation..."
echo ""

npx tsx scripts/init-frais-adhesion.ts

echo ""
echo "✅ Script terminé !"

