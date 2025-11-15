#!/bin/bash

# Script de déploiement pour AMAKI France
# Usage: ./deploy.sh [--rebuild]

set -e

echo "🚀 Déploiement AMAKI France"
echo "============================"

# Couleurs pour les messages
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Vérifier si Docker est installé
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker n'est pas installé${NC}"
    exit 1
fi

# Vérifier si Docker Compose est installé
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}❌ Docker Compose n'est pas installé${NC}"
    exit 1
fi

# Vérifier si le fichier .env existe
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠️  Le fichier .env n'existe pas${NC}"
    if [ -f env.example ]; then
        echo "📝 Création du fichier .env à partir de env.example..."
        cp env.example .env
        echo -e "${YELLOW}⚠️  Veuillez éditer le fichier .env avec vos valeurs avant de continuer${NC}"
        exit 1
    else
        echo -e "${RED}❌ Le fichier env.example n'existe pas${NC}"
        exit 1
    fi
fi

# Fonction pour arrêter proprement
cleanup() {
    echo -e "\n${YELLOW}⚠️  Arrêt en cours...${NC}"
    docker-compose down
    exit 1
}

trap cleanup INT TERM

# Option rebuild
if [ "$1" == "--rebuild" ]; then
    echo -e "${YELLOW}🔨 Reconstruction des images...${NC}"
    docker-compose build --no-cache
fi

# Arrêter les conteneurs existants
echo -e "${YELLOW}🛑 Arrêt des conteneurs existants...${NC}"
docker-compose down

# Démarrer les services
echo -e "${GREEN}🚀 Démarrage des services...${NC}"
docker-compose up -d

# Attendre que PostgreSQL soit prêt
echo -e "${YELLOW}⏳ Attente de la base de données...${NC}"
sleep 10

# Vérifier la santé de PostgreSQL
MAX_RETRIES=30
RETRY=0
while [ $RETRY -lt $MAX_RETRIES ]; do
    if docker-compose exec -T postgres pg_isready -U ${POSTGRES_USER:-amakifr} > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Base de données prête${NC}"
        break
    fi
    RETRY=$((RETRY + 1))
    echo -e "${YELLOW}⏳ Tentative $RETRY/$MAX_RETRIES...${NC}"
    sleep 2
done

if [ $RETRY -eq $MAX_RETRIES ]; then
    echo -e "${RED}❌ La base de données n'est pas prête après $MAX_RETRIES tentatives${NC}"
    docker-compose logs postgres
    exit 1
fi

# Exécuter les migrations
echo -e "${GREEN}📦 Exécution des migrations...${NC}"
docker-compose exec -T app npx prisma migrate deploy || {
    echo -e "${YELLOW}⚠️  Les migrations ont peut-être déjà été appliquées${NC}"
}

# Vérifier le statut des conteneurs
echo -e "\n${GREEN}📊 Statut des conteneurs:${NC}"
docker-compose ps

# Afficher les logs
echo -e "\n${GREEN}📋 Logs de l'application (Ctrl+C pour quitter):${NC}"
echo -e "${YELLOW}💡 Pour voir les logs en continu: docker-compose logs -f app${NC}"
echo -e "${YELLOW}💡 Pour voir les logs de la base: docker-compose logs -f postgres${NC}\n"

# Afficher les logs récents
docker-compose logs --tail=50 app

echo -e "\n${GREEN}✅ Déploiement terminé!${NC}"
echo -e "${GREEN}🌐 L'application devrait être accessible sur le port configuré${NC}"

