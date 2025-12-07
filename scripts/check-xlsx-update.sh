#!/bin/bash

# Script de vérification des mises à jour pour xlsx
# Vérifie si une nouvelle version corrigeant les vulnérabilités est disponible

set -e

echo "🔍 Vérification des mises à jour pour xlsx..."
echo ""

# Couleurs pour l'affichage
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Version actuelle installée
CURRENT_VERSION=$(npm list xlsx --depth=0 2>/dev/null | grep xlsx@ | sed 's/.*xlsx@\([0-9.]*\).*/\1/' || echo "non trouvée")
echo "📦 Version actuelle installée : ${CURRENT_VERSION}"

# Dernière version disponible
LATEST_VERSION=$(npm view xlsx version 2>/dev/null || echo "erreur")
echo "📦 Dernière version disponible : ${LATEST_VERSION}"

echo ""
echo "🔒 Vérification des vulnérabilités..."

# Vérifier les vulnérabilités
AUDIT_OUTPUT=$(npm audit --json 2>/dev/null || echo '{}')
VULN_COUNT=$(echo "$AUDIT_OUTPUT" | grep -o '"high":' | wc -l || echo "0")

if [ "$VULN_COUNT" -gt 0 ]; then
    echo -e "${RED}⚠️  Vulnérabilités détectées :${NC}"
    npm audit | grep -A 5 "xlsx" || true
    echo ""
    echo "📋 Advisories GitHub :"
    echo "   - Prototype Pollution: https://github.com/advisories/GHSA-4r6h-8v6p-xvw6"
    echo "   - ReDoS: https://github.com/advisories/GHSA-5pgg-2g8v-p4x9"
else
    echo -e "${GREEN}✅ Aucune vulnérabilité détectée${NC}"
fi

echo ""
echo "📊 Comparaison des versions..."

if [ "$CURRENT_VERSION" != "$LATEST_VERSION" ] && [ "$LATEST_VERSION" != "erreur" ]; then
    echo -e "${YELLOW}🆕 Une nouvelle version est disponible !${NC}"
    echo "   Version actuelle : $CURRENT_VERSION"
    echo "   Nouvelle version : $LATEST_VERSION"
    echo ""
    echo "💡 Pour mettre à jour :"
    echo "   npm update xlsx"
    echo "   npm audit"
else
    echo -e "${GREEN}✅ Vous êtes à jour${NC}"
fi

echo ""
echo "📝 Date de vérification : $(date '+%Y-%m-%d %H:%M:%S')"

