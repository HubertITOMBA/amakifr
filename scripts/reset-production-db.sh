#!/bin/bash

# Script shell pour exécuter le reset de la base de production
# Usage: ./scripts/reset-production-db.sh

# --- Couleurs pour la sortie console ---
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}===============================================${NC}"
echo -e "${BLUE} Réinitialisation de la base de production ${NC}"
echo -e "${BLUE}===============================================${NC}"
echo ""
echo -e "${RED}⚠️  ATTENTION : Ce script va supprimer TOUTES les données !${NC}"
echo ""
echo -e "${YELLOW}Voulez-vous vraiment continuer ? (yes/no)${NC}"
read -r confirmation

if [ "$confirmation" != "yes" ]; then
  echo -e "${YELLOW}Opération annulée.${NC}"
  exit 0
fi

echo ""
echo -e "${YELLOW}Exécution du script TypeScript...${NC}"
echo ""

# Exécuter le script TypeScript avec tsx ou ts-node
if command -v tsx &> /dev/null; then
  tsx scripts/reset-production-db.ts
elif command -v ts-node &> /dev/null; then
  ts-node scripts/reset-production-db.ts
elif command -v npx &> /dev/null; then
  npx tsx scripts/reset-production-db.ts
else
  echo -e "${RED}Erreur: tsx ou ts-node n'est pas installé.${NC}"
  echo -e "${YELLOW}Installez tsx avec: npm install -g tsx${NC}"
  exit 1
fi

EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
  echo ""
  echo -e "${GREEN}✅ Réinitialisation terminée avec succès !${NC}"
else
  echo ""
  echo -e "${RED}❌ Erreur lors de la réinitialisation.${NC}"
  exit $EXIT_CODE
fi

