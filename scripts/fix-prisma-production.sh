#!/bin/bash

###############################################################################
# Script de correction pour le problème Prisma en production
# 
# Ce script régénère le client Prisma et vérifie la configuration
###############################################################################

set -e

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🔧  CORRECTION PRISMA EN PRODUCTION${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Vérifier qu'on est dans le bon répertoire
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Erreur: Ce script doit être exécuté depuis la racine du projet.${NC}"
    exit 1
fi

echo -e "${GREEN}📋 Étape 1/5: Vérification de DATABASE_URL${NC}"
if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}   ❌ DATABASE_URL non définie${NC}"
    echo -e "${YELLOW}   ⚠️  Vérifiez votre fichier .env ou les variables d'environnement${NC}"
    exit 1
else
    # Masquer le mot de passe dans l'affichage
    MASKED_URL=$(echo "$DATABASE_URL" | sed 's/:\/\/[^:]*:[^@]*@/:\/\/***:***@/')
    echo -e "${GREEN}   ✅ DATABASE_URL définie: ${MASKED_URL}${NC}"
fi

echo ""
echo -e "${GREEN}📦 Étape 2/5: Nettoyage des anciens fichiers Prisma${NC}"
if rm -rf node_modules/.prisma 2>/dev/null; then
    echo -e "${GREEN}   ✅ Cache Prisma nettoyé${NC}"
else
    echo -e "${YELLOW}   ⚠️  Aucun cache à nettoyer${NC}"
fi

echo ""
echo -e "${GREEN}🔨 Étape 3/5: Génération du client Prisma${NC}"
if npx prisma generate; then
    echo -e "${GREEN}   ✅ Client Prisma généré${NC}"
else
    echo -e "${RED}   ❌ Erreur lors de la génération du client Prisma${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}🏗️  Étape 4/5: Rebuild de l'application Next.js${NC}"
if npm run build; then
    echo -e "${GREEN}   ✅ Application rebuilder${NC}"
else
    echo -e "${RED}   ❌ Erreur lors du build${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}🔄 Étape 5/5: Redémarrage de l'application${NC}"
if command -v pm2 &> /dev/null; then
    if pm2 restart amaki; then
        echo -e "${GREEN}   ✅ Application redémarrée avec PM2${NC}"
    else
        echo -e "${YELLOW}   ⚠️  Erreur lors du redémarrage avec PM2${NC}"
    fi
else
    echo -e "${YELLOW}   ⚠️  PM2 non installé, redémarrez manuellement l'application${NC}"
fi

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅  CORRECTION TERMINÉE !${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${GREEN}📌 Vérifications recommandées:${NC}"
echo -e "   1. Testez la création d'un rapport: ${GREEN}/admin/rapports-reunion${NC}"
echo -e "   2. Consultez les logs: ${GREEN}pm2 logs amaki${NC}"
echo -e "   3. Vérifiez la connexion DB: ${GREEN}pm2 logs amaki --lines 50 | grep Prisma${NC}"
echo ""
