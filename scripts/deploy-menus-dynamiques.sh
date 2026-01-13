#!/bin/bash

# Script de déploiement du système de menus dynamiques
# Usage: bash scripts/deploy-menus-dynamiques.sh

set -e  # Arrêter en cas d'erreur

echo "🚀 Déploiement du système de menus dynamiques"
echo "=============================================="
echo ""

# Couleurs pour les messages
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Vérifier qu'on est bien dans le bon répertoire
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Erreur: package.json non trouvé${NC}"
    echo "Veuillez exécuter ce script depuis la racine du projet"
    exit 1
fi

echo "📋 Étape 1/7 : Vérification de l'état Git"
echo "----------------------------------------"
git status --short
echo ""

echo -e "${YELLOW}⚠️  Voulez-vous continuer avec ces fichiers ? (o/n)${NC}"
read -r response
if [[ ! "$response" =~ ^[Oo]$ ]]; then
    echo "Déploiement annulé"
    exit 0
fi
echo ""

echo "📦 Étape 2/7 : Ajout des fichiers"
echo "----------------------------------------"
git add .
echo -e "${GREEN}✓ Fichiers ajoutés${NC}"
echo ""

echo "📝 Étape 3/7 : Création du commit"
echo "----------------------------------------"
git commit -m "feat: Implémentation du système de menus dynamiques

- Ajout de la table menus avec enums MenuRole et MenuNiveau
- Création des Server Actions CRUD pour gérer les menus
- Remplacement de Navbar par DynamicNavbar (navigation publique)
- Remplacement du sidebar admin par DynamicSidebar
- Page d'administration /admin/menus avec CRUD complet
- Page de création /admin/menus/create
- Page d'édition /admin/menus/[id]
- Script de seed pour peupler la table avec les menus existants
- Gestion des menus électoraux avec le paramètre electoral_menu_enabled
- Filtrage des menus par rôle utilisateur
- Support complet des icônes Lucide
- Amélioration des en-têtes de tableau (DataTable)
- Configuration responsive pour mobile (3 colonnes)
- Correction de l'erreur React Hooks dans /user/profile
- Documentation complète

BREAKING CHANGES:
- Les menus sont maintenant gérés depuis la base de données
- La table 'menus' doit être créée via migration Prisma
- Le script seed-menus.ts doit être exécuté en production

Fichiers créés:
- actions/menus/index.ts
- app/admin/menus/page.tsx
- app/admin/menus/create/page.tsx
- app/admin/menus/[id]/page.tsx
- components/home/DynamicNavbar.tsx
- components/admin/DynamicSidebar.tsx
- hooks/use-dynamic-menus.ts
- scripts/seed-menus.ts
- scripts/update-postes-roles.ts
- docs/MENUS_DYNAMIQUES.md
- docs/GUIDE_TEST_MENUS_DYNAMIQUES.md
- docs/MISE_EN_PRODUCTION_MENUS_DYNAMIQUES.md

Fichiers modifiés:
- prisma/schema.prisma (ajout table menus + enums)
- app/layout.tsx (import DynamicNavbar)
- app/admin/layout.tsx (intégration DynamicSidebar)
- app/user/profile/page.tsx (correction Hooks React)
- components/admin/DataTable.tsx (amélioration en-têtes)
- 21 pages publiques (Navbar → DynamicNavbar)"

echo -e "${GREEN}✓ Commit créé${NC}"
echo ""

echo "🔍 Étape 4/7 : Vérification du build local"
echo "----------------------------------------"
echo "Build en cours..."
if npm run build > /tmp/build.log 2>&1; then
    echo -e "${GREEN}✓ Build réussi${NC}"
else
    echo -e "${RED}❌ Erreur de build${NC}"
    echo "Consultez /tmp/build.log pour plus de détails"
    tail -30 /tmp/build.log
    exit 1
fi
echo ""

echo "📤 Étape 5/7 : Push vers le repository"
echo "----------------------------------------"
echo -e "${YELLOW}Voulez-vous pusher vers origin/main ? (o/n)${NC}"
read -r push_response
if [[ "$push_response" =~ ^[Oo]$ ]]; then
    git push origin main
    echo -e "${GREEN}✓ Push réussi${NC}"
else
    echo "Push annulé - vous devrez le faire manuellement"
fi
echo ""

echo "📋 Étape 6/7 : Résumé des changements"
echo "----------------------------------------"
echo "✅ Nouveau système de menus dynamiques déployé"
echo ""
echo "Statistiques:"
git diff HEAD~1 --stat | tail -1
echo ""

echo "🎯 Étape 7/7 : Prochaines étapes en PRODUCTION"
echo "----------------------------------------"
echo ""
echo "Sur le serveur de production, exécutez:"
echo ""
echo -e "${YELLOW}cd /sites/amakifr${NC}"
echo -e "${YELLOW}sudo bash scripts/deploy-with-maintenance.sh${NC}"
echo ""
echo "Puis MANUELLEMENT:"
echo -e "${YELLOW}npx tsx scripts/seed-menus.ts${NC}"
echo ""
echo "Ou utilisez le déploiement manuel complet:"
echo ""
echo "  git pull origin main"
echo "  npm install"
echo "  npx prisma generate"
echo "  npx prisma migrate deploy"
echo "  npx tsx scripts/seed-menus.ts  # ⚠️ IMPORTANT"
echo "  npm run build"
echo "  pm2 restart amakifr"
echo ""

echo -e "${GREEN}✅ Déploiement local terminé avec succès !${NC}"
echo ""
echo "📚 Documentation disponible:"
echo "  - docs/MENUS_DYNAMIQUES.md"
echo "  - docs/GUIDE_TEST_MENUS_DYNAMIQUES.md"
echo "  - docs/MISE_EN_PRODUCTION_MENUS_DYNAMIQUES.md"
echo ""
echo "🎉 Bon déploiement !"
