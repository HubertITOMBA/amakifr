#!/bin/bash

# Script de déploiement complet pour le système de chat avec notifications
# Usage: bash scripts/deploy-chat-notifications.sh

set -e

echo "💬 Déploiement du système de chat avec notifications"
echo "===================================================="
echo ""

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Erreur: package.json non trouvé${NC}"
    echo "Veuillez exécuter ce script depuis /sites/amakifr"
    exit 1
fi

echo -e "${BLUE}1️⃣  Génération du client Prisma${NC}"
echo "-------------------------------------------"
npx prisma generate
echo -e "${GREEN}✅ Client Prisma généré${NC}"
echo ""

echo -e "${BLUE}2️⃣  Migration de la base de données${NC}"
echo "-------------------------------------------"
echo -e "${YELLOW}Note: Ajoute le type 'Chat' à TypeNotification${NC}"
npx prisma migrate deploy
echo -e "${GREEN}✅ Migration appliquée${NC}"
echo ""

echo -e "${BLUE}3️⃣  Ajout du menu Chat dans la NAVBAR${NC}"
echo "-------------------------------------------"
npx tsx scripts/add-chat-menu-navbar.ts
echo ""

echo -e "${BLUE}4️⃣  Correction du menu Chat SIDEBAR${NC}"
echo "-------------------------------------------"
npx tsx scripts/fix-chat-menu-roles.ts
echo ""

echo -e "${BLUE}5️⃣  Build de l'application${NC}"
echo "-------------------------------------------"
npm run build
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Build réussi${NC}"
else
    echo -e "${RED}❌ Erreur lors du build${NC}"
    exit 1
fi
echo ""

echo -e "${BLUE}6️⃣  Redémarrage de l'application${NC}"
echo "-------------------------------------------"
pm2 restart amakifr
sleep 3
pm2 logs amakifr --lines 20 --nostream
echo -e "${GREEN}✅ Application redémarrée${NC}"
echo ""

echo "===================================================="
echo -e "${GREEN}✨ DÉPLOIEMENT TERMINÉ AVEC SUCCÈS !${NC}"
echo "===================================================="
echo ""
echo "📊 Ce qui a été déployé :"
echo "   ✅ Nouveau type de notification 'Chat'"
echo "   ✅ Menu 'Messages' dans la NAVBAR"
echo "   ✅ Badge de notification sur le menu"
echo "   ✅ Notifications automatiques lors de nouveaux messages"
echo "   ✅ Mise à jour toutes les 30 secondes"
echo ""
echo "🔍 Vérifications à faire :"
echo "   1. Se connecter en tant qu'adhérent"
echo "   2. Vérifier que le menu 'Messages' apparaît dans la navbar"
echo "   3. Envoyer un message de test"
echo "   4. Vérifier que le badge de notification s'affiche"
echo ""
echo "📚 Documentation : docs/CHAT_NOTIFICATIONS_GUIDE.md"
echo ""
