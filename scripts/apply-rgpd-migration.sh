#!/bin/bash

set -e

# Couleurs pour les messages
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔧 Application de la migration RGPD...${NC}"

# Vérifier que nous sommes dans le bon répertoire
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Erreur : Ce script doit être exécuté depuis la racine du projet${NC}"
    exit 1
fi

# Vérifier que .env existe
if [ ! -f ".env" ]; then
    echo -e "${RED}❌ Erreur : Fichier .env introuvable${NC}"
    exit 1
fi

echo -e "${BLUE}📦 Application de la migration Prisma...${NC}"
npx prisma migrate dev

echo -e "${BLUE}🔨 Génération du client Prisma...${NC}"
npx prisma generate

echo -e "${GREEN}✅ Migration RGPD appliquée avec succès !${NC}"
echo -e "${YELLOW}⚠️  N'oubliez pas de redémarrer votre serveur de développement${NC}"
