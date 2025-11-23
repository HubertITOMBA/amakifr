#!/bin/bash

# Script pour nettoyer le cache Next.js en production
# Ce script résout les problèmes de Server Actions non trouvées

set -e

# Couleurs pour les messages
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🧹 Nettoyage du cache Next.js...${NC}"

# Arrêter l'application PM2
echo -e "${BLUE}⏸️  Arrêt de l'application...${NC}"
pm2 stop amakifr || echo -e "${YELLOW}⚠️  Application non démarrée${NC}"

# Supprimer les dossiers de cache Next.js
echo -e "${BLUE}🗑️  Suppression des caches...${NC}"

# Cache Next.js
if [ -d ".next" ]; then
  echo -e "${BLUE}   Suppression de .next...${NC}"
  rm -rf .next
  echo -e "${GREEN}   ✅ .next supprimé${NC}"
fi

# Cache node_modules/.cache
if [ -d "node_modules/.cache" ]; then
  echo -e "${BLUE}   Suppression de node_modules/.cache...${NC}"
  rm -rf node_modules/.cache
  echo -e "${GREEN}   ✅ node_modules/.cache supprimé${NC}"
fi

# Cache PWA
if [ -f "public/sw.js" ]; then
  echo -e "${BLUE}   Suppression du service worker...${NC}"
  rm -f public/sw.js
  echo -e "${GREEN}   ✅ Service worker supprimé${NC}"
fi

if [ -f "public/workbox-*.js" ]; then
  echo -e "${BLUE}   Suppression des fichiers workbox...${NC}"
  rm -f public/workbox-*.js
  echo -e "${GREEN}   ✅ Fichiers workbox supprimés${NC}"
fi

# Nettoyer le cache npm
echo -e "${BLUE}📦 Nettoyage du cache npm...${NC}"
npm cache clean --force || echo -e "${YELLOW}⚠️  Erreur lors du nettoyage du cache npm${NC}"

# Rebuild complet
echo -e "${BLUE}🔨 Rebuild de l'application...${NC}"
npm run build

# Redémarrer l'application
echo -e "${BLUE}🔄 Redémarrage de l'application...${NC}"
pm2 restart amakifr || pm2 start ecosystem.config.js

echo -e "${GREEN}✅ Nettoyage terminé !${NC}"
echo -e "${YELLOW}⚠️  Note: Les utilisateurs devront peut-être vider le cache de leur navigateur${NC}"
echo -e "${YELLOW}   (Ctrl+Shift+R ou Cmd+Shift+R)${NC}"

