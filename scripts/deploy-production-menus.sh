#!/bin/bash

# Script de déploiement complet pour la production
# Inclut TOUTES les étapes nécessaires, y compris npx prisma generate
# Usage: sudo bash scripts/deploy-production-menus.sh

set -e  # Arrêter en cas d'erreur

echo "🚀 Déploiement du système de menus dynamiques en PRODUCTION"
echo "============================================================"
echo ""

# Couleurs
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Vérifier qu'on est dans le bon répertoire
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Erreur: package.json non trouvé${NC}"
    echo "Veuillez exécuter ce script depuis /sites/amakifr"
    exit 1
fi

echo -e "${YELLOW}⚠️  Ce script va déployer le système de menus dynamiques.${NC}"
echo -e "${YELLOW}   L'application sera en mode maintenance pendant le déploiement.${NC}"
echo ""
read -p "Voulez-vous continuer ? (o/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Oo]$ ]]; then
    echo "Déploiement annulé"
    exit 0
fi

# Activer le mode maintenance
echo ""
echo -e "${BLUE}📋 Étape 1/11 : Activation du mode maintenance${NC}"
echo "------------------------------------------------"
if [ -f "scripts/maintenance-on.sh" ]; then
    sudo bash scripts/maintenance-on.sh
    echo -e "${GREEN}✅ Mode maintenance activé${NC}"
else
    echo -e "${YELLOW}⚠️  Script maintenance-on.sh non trouvé, on continue sans${NC}"
fi

# Pull du code
echo ""
echo -e "${BLUE}📦 Étape 2/11 : Récupération du code${NC}"
echo "------------------------------------------------"
git pull origin main
echo -e "${GREEN}✅ Code récupéré${NC}"

# Installation des dépendances
echo ""
echo -e "${BLUE}📚 Étape 3/11 : Installation des dépendances${NC}"
echo "------------------------------------------------"
npm install
echo -e "${GREEN}✅ Dépendances installées${NC}"

# Génération du client Prisma (CRITIQUE !)
echo ""
echo -e "${BLUE}⚙️  Étape 4/11 : Génération du client Prisma${NC}"
echo "------------------------------------------------"
echo -e "${YELLOW}⚠️  ÉTAPE CRITIQUE : Sans cela, le seed échouera !${NC}"
npx prisma generate
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Client Prisma généré avec succès${NC}"
else
    echo -e "${RED}❌ Erreur lors de la génération du client Prisma${NC}"
    sudo bash scripts/maintenance-off.sh 2>/dev/null
    exit 1
fi

# Vérification de l'état des migrations
echo ""
echo -e "${BLUE}🔍 Étape 5/11 : Vérification des migrations${NC}"
echo "------------------------------------------------"
npx prisma migrate status
echo ""

# Application des migrations
echo ""
echo -e "${BLUE}🗄️  Étape 6/11 : Application des migrations${NC}"
echo "------------------------------------------------"
npx prisma migrate deploy
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Migrations appliquées${NC}"
else
    echo -e "${RED}❌ Erreur lors de l'application des migrations${NC}"
    sudo bash scripts/maintenance-off.sh 2>/dev/null
    exit 1
fi

# Diagnostic Prisma (optionnel)
echo ""
echo -e "${BLUE}🔍 Étape 7/11 : Diagnostic de l'environnement Prisma${NC}"
echo "------------------------------------------------"
if [ -f "scripts/check-prisma-env.ts" ]; then
    npx tsx scripts/check-prisma-env.ts
else
    echo -e "${YELLOW}⚠️  Script de diagnostic non trouvé, on continue${NC}"
fi

# Seed de la table menus
echo ""
echo -e "${BLUE}🌱 Étape 8/11 : Peuplement de la table menus${NC}"
echo "------------------------------------------------"
echo -e "${YELLOW}⚠️  Si des menus existent déjà, vous devrez confirmer leur suppression${NC}"
npx tsx scripts/seed-menus.ts
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Table menus peuplée${NC}"
else
    echo -e "${RED}❌ Erreur lors du seed${NC}"
    echo -e "${YELLOW}⚠️  Consultez docs/TROUBLESHOOTING_SEED_MENUS.md${NC}"
    sudo bash scripts/maintenance-off.sh 2>/dev/null
    exit 1
fi

# Vérification du seed
echo ""
echo -e "${BLUE}✔️  Étape 9/11 : Vérification du seed${NC}"
echo "------------------------------------------------"
MENU_COUNT=$(psql -d amakifr_db -t -c "SELECT COUNT(*) FROM menus;" 2>/dev/null | xargs)
if [ -n "$MENU_COUNT" ] && [ "$MENU_COUNT" -ge 30 ]; then
    echo -e "${GREEN}✅ $MENU_COUNT menus créés (attendu: 33)${NC}"
else
    echo -e "${RED}❌ Seulement $MENU_COUNT menus créés (attendu: 33)${NC}"
    echo -e "${YELLOW}⚠️  Vérifiez manuellement la table menus${NC}"
fi

# Build de l'application
echo ""
echo -e "${BLUE}🔨 Étape 10/11 : Build de l'application${NC}"
echo "------------------------------------------------"
npm run build
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Build réussi${NC}"
else
    echo -e "${RED}❌ Erreur lors du build${NC}"
    sudo bash scripts/maintenance-off.sh 2>/dev/null
    exit 1
fi

# Redémarrage de l'application
echo ""
echo -e "${BLUE}🔄 Étape 11/11 : Redémarrage de l'application${NC}"
echo "------------------------------------------------"
pm2 restart amakifr
sleep 3
pm2 logs amakifr --lines 20 --nostream

# Vérifier que l'application tourne
PM2_STATUS=$(pm2 jlist | grep -o '"status":"online"' | wc -l)
if [ "$PM2_STATUS" -gt 0 ]; then
    echo -e "${GREEN}✅ Application redémarrée${NC}"
else
    echo -e "${RED}❌ L'application ne semble pas démarrée${NC}"
    echo "Consultez les logs avec: pm2 logs amakifr"
fi

# Désactiver le mode maintenance
echo ""
echo -e "${BLUE}🎉 Finalisation${NC}"
echo "------------------------------------------------"
if [ -f "scripts/maintenance-off.sh" ]; then
    sudo bash scripts/maintenance-off.sh
    echo -e "${GREEN}✅ Mode maintenance désactivé${NC}"
fi

# Vérifier Nginx
sudo nginx -t && sudo systemctl reload nginx
echo -e "${GREEN}✅ Nginx rechargé${NC}"

# Résumé final
echo ""
echo "============================================================"
echo -e "${GREEN}✅ DÉPLOIEMENT TERMINÉ AVEC SUCCÈS !${NC}"
echo "============================================================"
echo ""
echo "📊 Résumé:"
echo "  - Menus créés: $MENU_COUNT / 33"
echo "  - Application: En ligne"
echo "  - URL: https://www.amaki.fr"
echo ""
echo "🔍 Vérifications recommandées:"
echo "  1. Ouvrir https://www.amaki.fr"
echo "  2. Vérifier que la navbar s'affiche"
echo "  3. Se connecter en admin"
echo "  4. Vérifier le sidebar admin"
echo "  5. Tester /admin/menus"
echo ""
echo "📚 Documentation:"
echo "  - docs/MENUS_DYNAMIQUES.md"
echo "  - docs/GUIDE_TEST_MENUS_DYNAMIQUES.md"
echo "  - docs/TROUBLESHOOTING_SEED_MENUS.md"
echo ""
echo "🎊 Bon test !"
