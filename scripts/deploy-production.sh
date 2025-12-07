#!/bin/bash

# Script de déploiement en production pour AMAKI France
# Usage: ./scripts/deploy-production.sh

set -e

echo "🚀 Déploiement AMAKI France en Production"
echo "=========================================="

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Vérifications préalables
echo -e "${BLUE}📋 Vérifications préalables...${NC}"

# Vérifier Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js n'est pas installé${NC}"
    exit 1
fi
NODE_VERSION=$(node -v)
echo -e "${GREEN}✅ Node.js: $NODE_VERSION${NC}"

# Vérifier npm
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm n'est pas installé${NC}"
    exit 1
fi
echo -e "${GREEN}✅ npm installé${NC}"

# Vérifier PM2
if ! command -v pm2 &> /dev/null; then
    echo -e "${YELLOW}⚠️  PM2 n'est pas installé, installation...${NC}"
    npm install -g pm2
fi
echo -e "${GREEN}✅ PM2 installé${NC}"

# Vérifier le fichier .env
if [ ! -f .env ]; then
    echo -e "${RED}❌ Le fichier .env n'existe pas${NC}"
    if [ -f env.example ]; then
        echo -e "${YELLOW}📝 Création du fichier .env à partir de env.example...${NC}"
        cp env.example .env
        echo -e "${YELLOW}⚠️  Veuillez éditer le fichier .env avec vos valeurs de production${NC}"
        exit 1
    else
        echo -e "${RED}❌ Le fichier env.example n'existe pas${NC}"
        exit 1
    fi
fi
echo -e "${GREEN}✅ Fichier .env trouvé${NC}"

# Vérifier les variables d'environnement critiques
echo -e "${BLUE}🔍 Vérification des variables d'environnement...${NC}"
source .env

if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}❌ DATABASE_URL n'est pas défini${NC}"
    exit 1
fi
echo -e "${GREEN}✅ DATABASE_URL défini${NC}"

if [ -z "$AUTH_SECRET" ]; then
    echo -e "${RED}❌ AUTH_SECRET n'est pas défini${NC}"
    exit 1
fi
echo -e "${GREEN}✅ AUTH_SECRET défini${NC}"

if [ -z "$NEXT_PUBLIC_APP_URL" ]; then
    echo -e "${YELLOW}⚠️  NEXT_PUBLIC_APP_URL n'est pas défini${NC}"
fi

# Récupération des dernières modifications via Git
echo -e "${BLUE}📥 Récupération des dernières modifications via Git...${NC}"
if [ -d ".git" ]; then
    git pull origin main || {
        echo -e "${YELLOW}⚠️  Erreur lors du git pull, vérification du statut...${NC}"
        git status
        read -p "Continuer quand même? (o/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Oo]$ ]]; then
            exit 1
        fi
    }
    echo -e "${GREEN}✅ Dernière version récupérée${NC}"
else
    echo -e "${RED}❌ Ce n'est pas un dépôt Git${NC}"
    exit 1
fi

# Installation des dépendances
echo -e "${BLUE}📦 Installation des dépendances...${NC}"
npm ci

# Exécution des migrations
echo -e "${BLUE}🗄️  Exécution des migrations de base de données...${NC}"
npx prisma migrate deploy || {
    echo -e "${YELLOW}⚠️  Erreur lors des migrations, vérification du statut...${NC}"
    npx prisma migrate status
}

# Build optimisé (génère Prisma seulement si nécessaire)
echo -e "${BLUE}🔨 Build de production optimisé...${NC}"
./scripts/optimize-build.sh

# Vérification des fichiers PWA
echo -e "${BLUE}📱 Vérification des fichiers PWA...${NC}"
if [ ! -f "public/sw.js" ]; then
    echo -e "${YELLOW}⚠️  Le service worker n'a pas été généré${NC}"
else
    echo -e "${GREEN}✅ Service worker généré${NC}"
fi

if [ ! -f "app/web-app-manifest-192x192.png" ] && [ ! -f "public/web-app-manifest-192x192.png" ]; then
    echo -e "${YELLOW}⚠️  Les icônes PWA ne sont pas trouvées${NC}"
else
    echo -e "${GREEN}✅ Icônes PWA trouvées${NC}"
fi

# Création du répertoire de logs si nécessaire
if [ ! -d "logs" ]; then
    mkdir -p logs
    echo -e "${GREEN}✅ Répertoire logs créé${NC}"
fi

# Redémarrage avec PM2
echo -e "${BLUE}🔄 Redémarrage de l'application avec PM2...${NC}"

# Vérifier si l'application est déjà en cours d'exécution
if pm2 list | grep -q "amakifr"; then
    echo -e "${YELLOW}⚠️  L'application est déjà en cours d'exécution${NC}"
    pm2 restart amakifr
else
    echo -e "${BLUE}🚀 Démarrage de l'application...${NC}"
    pm2 start ecosystem.config.js --only amakifr
fi

# Sauvegarder la configuration PM2
pm2 save

# Afficher le statut
echo -e "\n${GREEN}📊 Statut de l'application:${NC}"
pm2 status

# Afficher les logs récents
echo -e "\n${BLUE}📋 Logs récents (Ctrl+C pour quitter):${NC}"
pm2 logs amakifr --lines 20

echo -e "\n${GREEN}✅ Déploiement terminé avec succès!${NC}"
echo -e "${GREEN}🌐 L'application devrait être accessible sur: ${NEXT_PUBLIC_APP_URL:-https://amaki.fr}${NC}"
echo -e "\n${BLUE}💡 Commandes utiles:${NC}"
echo -e "  - Voir les logs: ${YELLOW}pm2 logs amakifr${NC}"
echo -e "  - Voir le statut: ${YELLOW}pm2 status${NC}"
echo -e "  - Redémarrer: ${YELLOW}pm2 restart amakifr${NC}"
echo -e "  - Arrêter: ${YELLOW}pm2 stop amakifr${NC}"
