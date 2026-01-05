#!/bin/bash

# Script pour baseliner les migrations Prisma en production
# Usage: ./scripts/baseline-migrations-production.sh
#
# Ce script marque les migrations existantes comme déjà appliquées
# puis applique les nouvelles migrations

set -e

# Couleurs
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}===============================================${NC}"
echo -e "${BLUE} Baselining des migrations Prisma en production${NC}"
echo -e "${BLUE}===============================================${NC}"
echo ""

# Vérifier que Prisma est installé
if ! command -v npx &> /dev/null; then
    echo -e "${RED}❌ npx n'est pas installé${NC}"
    exit 1
fi

# Vérifier le statut actuel
echo -e "${YELLOW}📋 Vérification du statut des migrations...${NC}"
npx prisma migrate status || true
echo ""

# Liste des migrations à baseliner (migrations déjà appliquées manuellement)
MIGRATIONS_TO_BASELINE=(
    "20251204181751_add_unique_adherent_assistance_periode"
)

echo -e "${YELLOW}⚠️  ATTENTION : Ce script va marquer les migrations suivantes comme déjà appliquées :${NC}"
for migration in "${MIGRATIONS_TO_BASELINE[@]}"; do
    echo -e "   - ${BLUE}$migration${NC}"
done
echo ""
echo -e "${YELLOW}Assurez-vous que ces migrations ont bien été appliquées à la base de données.${NC}"
echo ""
read -p "Voulez-vous continuer ? (oui/non) " -r
echo

if [[ ! $REPLY =~ ^[Oo][Uu][Ii]$ ]]; then
    echo -e "${YELLOW}Opération annulée.${NC}"
    exit 0
fi

# Baseliner les migrations existantes
echo -e "${BLUE}🔧 Baselining des migrations existantes...${NC}"
for migration in "${MIGRATIONS_TO_BASELINE[@]}"; do
    echo -e "${YELLOW}   Marquant $migration comme appliquée...${NC}"
    npx prisma migrate resolve --applied "$migration" || {
        echo -e "${RED}❌ Erreur lors du baselining de $migration${NC}"
        echo -e "${YELLOW}   Cette migration est peut-être déjà baselinée ou n'existe pas.${NC}"
    }
done

echo ""
echo -e "${GREEN}✅ Baselining terminé${NC}"
echo ""

# Vérifier le statut après baselining
echo -e "${BLUE}📋 Vérification du statut après baselining...${NC}"
npx prisma migrate status
echo ""

# Appliquer les nouvelles migrations
echo -e "${BLUE}🚀 Application des nouvelles migrations...${NC}"
npx prisma migrate deploy

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ Toutes les migrations ont été appliquées avec succès !${NC}"
    echo ""
    echo -e "${BLUE}📋 Statut final :${NC}"
    npx prisma migrate status
else
    echo ""
    echo -e "${RED}❌ Erreur lors de l'application des migrations${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}===============================================${NC}"

