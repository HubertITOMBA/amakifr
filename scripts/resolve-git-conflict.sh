#!/bin/bash

# Script pour résoudre les conflits Git lors du déploiement
# Usage: ./scripts/resolve-git-conflict.sh

set -e

echo "🔧 Résolution des conflits Git"
echo "==============================="

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 1. Vérifier l'état actuel
echo -e "${BLUE}📋 Vérification de l'état Git...${NC}"
git status --short

# 2. Sauvegarder les modifications locales
echo -e "${BLUE}💾 Sauvegarde des modifications locales...${NC}"
if git stash; then
    echo -e "${GREEN}✅ Modifications sauvegardées dans le stash${NC}"
    echo -e "${YELLOW}💡 Pour voir les modifications sauvegardées: git stash show${NC}"
    echo -e "${YELLOW}💡 Pour les récupérer plus tard: git stash pop${NC}"
else
    echo -e "${YELLOW}⚠️  Aucune modification à sauvegarder${NC}"
fi

# 3. Supprimer les fichiers non trackés qui posent problème
echo -e "${BLUE}🗑️  Suppression des fichiers non trackés en conflit...${NC}"
FILES_TO_REMOVE=(
    "components/providers/react-toastify-provider.tsx"
    "prisma/migrations/add_date_naissance_to_adherent.sql"
    "scripts/apply-migration-production.sh"
    "scripts/reset-production-db.sh"
    "scripts/reset-production-db.ts"
)

for file in "${FILES_TO_REMOVE[@]}"; do
    if [ -f "$file" ]; then
        rm -f "$file"
        echo -e "${GREEN}✅ Supprimé: $file${NC}"
    fi
done

# 4. Récupérer les modifications distantes
echo -e "${BLUE}📥 Récupération des modifications distantes...${NC}"
if git pull origin main; then
    echo -e "${GREEN}✅ Modifications récupérées avec succès${NC}"
else
    echo -e "${RED}❌ Erreur lors du pull${NC}"
    echo -e "${YELLOW}💡 Essayez: git fetch origin && git reset --hard origin/main${NC}"
    exit 1
fi

# 5. Afficher le statut final
echo -e "\n${GREEN}✅ Conflits résolus!${NC}"
echo -e "${BLUE}📊 Statut final:${NC}"
git status

echo -e "\n${GREEN}🚀 Vous pouvez maintenant continuer le déploiement:${NC}"
echo -e "  npm ci"
echo -e "  npx prisma generate"
echo -e "  npx prisma migrate deploy"
echo -e "  npm run build"
echo -e "  pm2 restart amakifr"

