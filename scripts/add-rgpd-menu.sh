#!/bin/bash

# Script pour ajouter le menu RGPD dans la sidebar admin
# Ce script peut être exécuté sans supprimer les menus existants

set -e

# Couleurs pour les messages
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔧 Ajout du menu RGPD dans la sidebar admin...${NC}"

# Vérifier que nous sommes dans le bon répertoire
if [ ! -f "package.json" ]; then
  echo -e "${RED}❌ Erreur: Ce script doit être exécuté depuis la racine du projet${NC}"
  exit 1
fi

# Vérifier que .env existe
if [ ! -f ".env" ]; then
  echo -e "${RED}❌ Erreur: Le fichier .env n'existe pas${NC}"
  exit 1
fi

# Générer le client Prisma
echo -e "${BLUE}🔧 Génération du client Prisma...${NC}"
npx prisma generate

# Exécuter le script TypeScript pour ajouter le menu
echo -e "${BLUE}📝 Ajout du menu RGPD...${NC}"
npx tsx scripts/add-rgpd-menu.ts

echo -e "${GREEN}✅ Menu RGPD ajouté avec succès !${NC}"
