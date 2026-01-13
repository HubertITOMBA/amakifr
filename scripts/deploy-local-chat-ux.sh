#!/bin/bash

# Script de déploiement LOCAL - Préparation avant push vers production
# Usage: bash scripts/deploy-local-chat-ux.sh

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo "🚀 Préparation du déploiement - Améliorations Chat & UX"
echo "========================================================="
echo ""

if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Erreur: package.json non trouvé${NC}"
    echo "Veuillez exécuter ce script depuis /soft/dev/nextjs/amakifr"
    exit 1
fi

echo -e "${BLUE}1️⃣  Vérification des modifications${NC}"
echo "-------------------------------------------"
git status --short
echo ""
read -p "Voulez-vous continuer ? (o/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Oo]$ ]]; then
    echo "❌ Déploiement annulé"
    exit 1
fi

echo -e "${BLUE}2️⃣  Test de compilation (build)${NC}"
echo "-------------------------------------------"
npm run build
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Build réussi${NC}"
else
    echo -e "${RED}❌ Erreur lors du build${NC}"
    exit 1
fi
echo ""

echo -e "${BLUE}3️⃣  Vérification des lints${NC}"
echo "-------------------------------------------"
npm run lint
if [ $? -ne 0 ]; then
    echo -e "${YELLOW}⚠️  Avertissement: Problèmes de lint détectés${NC}"
    read -p "Continuer malgré les warnings ? (o/n) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Oo]$ ]]; then
        echo "❌ Déploiement annulé"
        exit 1
    fi
fi
echo ""

echo -e "${BLUE}4️⃣  Ajout des nouveaux fichiers au git${NC}"
echo "-------------------------------------------"
# Ajouter les nouveaux fichiers
git add hooks/use-unread-messages.ts
git add prisma/migrations/20260113134904_add_chat_notification_type/
git add scripts/add-chat-menu-navbar.ts
git add scripts/fix-chat-menu-roles.ts
git add scripts/deploy-chat-notifications.sh
git add docs/DEPLOIEMENT_CHAT_UX_2025.md
git add CHANGELOG_CHAT_UX.md
git add scripts/deploy-local-chat-ux.sh
echo -e "${GREEN}✅ Nouveaux fichiers ajoutés${NC}"
echo ""

echo -e "${BLUE}5️⃣  Création du commit${NC}"
echo "-------------------------------------------"
git commit -m "$(cat <<'EOF'
feat: Améliorations chat et UX - Notifications et recherche participants

✨ Nouvelles fonctionnalités:
- Système de notifications automatiques pour les messages du chat
- Badge de messages non lus dans la navbar (icône Messages)
- Recherche et filtrage de participants dans dialog "Nouvelle conversation"
- Sélection multiple avec bouton "Tout sélectionner/désélectionner"
- Compteur de participants filtrés en temps réel
- Menu Messages visible uniquement pour utilisateurs connectés
- Interface chat embellie avec gradients et design moderne

🐛 Correctifs:
- Bouton Hero "Découvrir nos Événements" invisible en mode clair
- Import LucideIcons manquant dans page profil utilisateur
- Fermeture automatique recherche participants lors de fermeture dialog

🔧 Technique:
- Ajout type "Chat" dans enum TypeNotification (migration Prisma)
- Hook useUnreadMessages pour compteur temps réel (refresh 30s)
- Fonction markChatNotificationsAsRead() pour marquer notifications lues
- Filtrage conditionnel menus navbar selon état connexion
- Scripts de déploiement et configuration menus

📦 Fichiers modifiés: 14
- Backend: actions/chat, prisma schema, migration
- Frontend: app/chat, DynamicNavbar, Hero, hooks
- Scripts: seed-menus, deploy, attribution badges
- Docs: Guide déploiement complet, changelog

🚀 Déploiement production:
cd /sites/amakifr && sudo bash scripts/deploy-chat-notifications.sh

📚 Documentation:
- docs/DEPLOIEMENT_CHAT_UX_2025.md
- docs/CHAT_NOTIFICATIONS_GUIDE.md
- CHANGELOG_CHAT_UX.md
EOF
)"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Commit créé avec succès${NC}"
else
    echo -e "${RED}❌ Erreur lors du commit${NC}"
    exit 1
fi
echo ""

echo -e "${BLUE}6️⃣  Push vers le dépôt distant${NC}"
echo "-------------------------------------------"
echo -e "${YELLOW}⚠️  Cette action va pousser les modifications vers origin/main${NC}"
read -p "Confirmer le push ? (o/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Oo]$ ]]; then
    echo "❌ Push annulé"
    echo -e "${YELLOW}Le commit est créé localement mais pas poussé${NC}"
    echo "Pour pousser plus tard: git push origin main"
    exit 0
fi

git push origin main
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Push réussi${NC}"
else
    echo -e "${RED}❌ Erreur lors du push${NC}"
    exit 1
fi
echo ""

echo "========================================================="
echo -e "${GREEN}✨ PRÉPARATION TERMINÉE AVEC SUCCÈS !${NC}"
echo "========================================================="
echo ""
echo "📋 Prochaines étapes sur le SERVEUR DE PRODUCTION:"
echo ""
echo "   cd /sites/amakifr"
echo "   git pull origin main"
echo "   sudo bash scripts/deploy-chat-notifications.sh"
echo ""
echo "📊 Ce qui va être déployé en production:"
echo "   ✅ Notifications automatiques pour messages chat"
echo "   ✅ Badge de notification sur menu Messages"
echo "   ✅ Recherche et sélection multiple de participants"
echo "   ✅ Interface chat avec design moderne"
echo "   ✅ Menus conditionnels (utilisateurs connectés uniquement)"
echo "   ✅ Correctifs UX (bouton Hero, imports)"
echo ""
echo "📚 Documentation complète:"
echo "   - Guide: docs/DEPLOIEMENT_CHAT_UX_2025.md"
echo "   - Changelog: CHANGELOG_CHAT_UX.md"
echo ""
echo "⏱️  Durée estimée du déploiement production: ~5 minutes"
echo ""
