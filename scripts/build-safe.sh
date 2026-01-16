#!/bin/bash

# Script de build sécurisé pour éviter les Bus errors
# Usage: ./scripts/build-safe.sh

set -e

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🔨 Build sécurisé de l'application${NC}"
echo -e "${BLUE}===================================${NC}"
echo ""

# Vérifier que nous sommes dans le bon répertoire
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Erreur: Ce script doit être exécuté depuis la racine du projet${NC}"
    exit 1
fi

# Arrêter l'application si elle tourne
if command -v pm2 &> /dev/null; then
    if pm2 list | grep -q "amakifr"; then
        echo -e "${BLUE}⏸️  Arrêt de l'application...${NC}"
        pm2 stop amakifr || true
    fi
fi

# Nettoyage
echo -e "${BLUE}🧹 Nettoyage des caches...${NC}"
rm -rf .next
rm -rf node_modules/.cache
rm -rf node_modules/.prisma
rm -rf node_modules/@prisma
echo -e "${GREEN}✅ Caches nettoyés${NC}"

# Régénération Prisma
echo -e "${BLUE}🔧 Régénération du client Prisma...${NC}"
npx prisma generate || {
    echo -e "${RED}❌ Erreur lors de la génération Prisma${NC}"
    exit 1
}
echo -e "${GREEN}✅ Client Prisma régénéré${NC}"

# Génération du Build ID
echo -e "${BLUE}📝 Génération du Build ID...${NC}"
node scripts/generate-build-id.js || {
    echo -e "${YELLOW}⚠️  Erreur lors de la génération du Build ID, continuation...${NC}"
}
echo -e "${GREEN}✅ Build ID généré${NC}"

# Build avec mémoire augmentée
echo -e "${BLUE}🔨 Build Next.js (avec mémoire augmentée)...${NC}"
NODE_OPTIONS="--max-old-space-size=4096" npx next build || {
    echo -e "${YELLOW}⚠️  Build échoué, réessai avec plus de mémoire (8GB)...${NC}"
    NODE_OPTIONS="--max-old-space-size=8192" npx next build || {
        echo -e "${RED}❌ Build échoué même avec 8GB de mémoire${NC}"
        echo -e "${YELLOW}💡 Vérifiez les logs ci-dessus${NC}"
        exit 1
    }
}
echo -e "${GREEN}✅ Build terminé avec succès${NC}"

# Redémarrer l'application
if command -v pm2 &> /dev/null; then
    echo -e "${BLUE}🔄 Redémarrage de l'application...${NC}"
    pm2 restart amakifr || pm2 start ecosystem.config.js --only amakifr
    echo -e "${GREEN}✅ Application redémarrée${NC}"
fi

echo ""
echo -e "${GREEN}===================================${NC}"
echo -e "${GREEN}✅ Build sécurisé terminé avec succès!${NC}"
echo -e "${GREEN}===================================${NC}"
