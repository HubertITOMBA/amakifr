#!/bin/bash

# Script pour optimiser le build de production
# Ce script vérifie si Prisma doit être régénéré et optimise le processus de build

set -e

# Couleurs pour les messages
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Optimisation du build de production...${NC}"
echo ""

# Vérifier si le schéma Prisma a changé
SCHEMA_FILE="prisma/schema.prisma"
SCHEMA_HASH_FILE=".prisma-schema-hash"

# Détecter la commande de hash disponible (md5sum sur Linux, md5 sur macOS)
if command -v md5sum &> /dev/null; then
  CURRENT_HASH=$(md5sum "$SCHEMA_FILE" 2>/dev/null | cut -d' ' -f1 || echo "")
elif command -v md5 &> /dev/null; then
  CURRENT_HASH=$(md5 -q "$SCHEMA_FILE" 2>/dev/null || echo "")
else
  echo -e "${YELLOW}⚠️  Aucune commande de hash trouvée, génération Prisma forcée${NC}"
  CURRENT_HASH=""
fi

if [ -f "$SCHEMA_HASH_FILE" ]; then
  LAST_HASH=$(cat "$SCHEMA_HASH_FILE")
  if [ "$CURRENT_HASH" = "$LAST_HASH" ]; then
    echo -e "${GREEN}✅ Schéma Prisma inchangé, saut de la génération${NC}"
    SKIP_PRISMA_GENERATE=true
  else
    echo -e "${YELLOW}⚠️  Schéma Prisma modifié, régénération nécessaire${NC}"
    SKIP_PRISMA_GENERATE=false
  fi
else
  echo -e "${YELLOW}⚠️  Premier build, génération Prisma nécessaire${NC}"
  SKIP_PRISMA_GENERATE=false
fi

# Générer Prisma seulement si nécessaire
if [ "$SKIP_PRISMA_GENERATE" = "false" ]; then
  echo -e "${BLUE}🔧 Génération du client Prisma...${NC}"
  npx prisma generate
  echo "$CURRENT_HASH" > "$SCHEMA_HASH_FILE"
  echo -e "${GREEN}✅ Client Prisma généré${NC}"
else
  echo -e "${BLUE}⏭️  Saut de la génération Prisma (schéma inchangé)${NC}"
fi

# Nettoyer seulement les caches nécessaires (garder .next si possible pour les builds incrémentaux)
if [ -d ".next/cache" ]; then
  echo -e "${BLUE}🧹 Nettoyage du cache Next.js...${NC}"
  rm -rf .next/cache
  echo -e "${GREEN}✅ Cache nettoyé${NC}"
fi

# Build avec optimisations
echo -e "${BLUE}🔨 Build de production optimisé...${NC}"
NODE_OPTIONS="--max-old-space-size=4096" npm run build

echo ""
echo -e "${GREEN}✅ Build optimisé terminé !${NC}"

