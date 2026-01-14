#!/bin/bash

# Script de déploiement pour le menu "Gestion des Finances"
# Usage: bash scripts/deploy-menu-finances.sh

set -e  # Arrêter en cas d'erreur

# Couleurs pour les messages
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Déploiement - Menu Gestion des Finances${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Vérifier qu'on n'est pas en sudo
if [ "$EUID" -eq 0 ]; then 
  echo -e "${RED}❌ Erreur : Ce script ne doit PAS être exécuté avec sudo${NC}"
  echo -e "${YELLOW}→ Exécutez : bash scripts/deploy-menu-finances.sh${NC}"
  exit 1
fi

# Vérifier que npx est disponible
if ! command -v npx &> /dev/null; then
  echo -e "${RED}❌ Erreur : npx n'est pas trouvé dans le PATH${NC}"
  echo -e "${YELLOW}→ Assurez-vous que Node.js est installé et dans le PATH${NC}"
  exit 1
fi

# Vérifier qu'on est dans le bon répertoire
if [ ! -f "package.json" ]; then
  echo -e "${RED}❌ Erreur : package.json non trouvé${NC}"
  echo -e "${YELLOW}→ Exécutez ce script depuis la racine du projet${NC}"
  exit 1
fi

# Fonction pour afficher une étape
step() {
  echo ""
  echo -e "${GREEN}▶ $1${NC}"
  echo "-------------------------------------------"
}

# Fonction pour vérifier le succès
check_success() {
  if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ $1${NC}"
  else
    echo -e "${RED}❌ Échec : $1${NC}"
    exit 1
  fi
}

# Demander confirmation
echo -e "${YELLOW}⚠️  Ce script va :${NC}"
echo "  1. Récupérer les dernières modifications (git pull)"
echo "  2. Installer les dépendances"
echo "  3. Générer le client Prisma"
echo "  4. Re-seeder les menus (suppression + recréation)"
echo "  5. Builder l'application"
echo "  6. Redémarrer PM2"
echo ""
read -p "Continuer ? (oui/non) " -n 3 -r
echo ""
if [[ ! $REPLY =~ ^[Oo][Uu][Ii]$ ]]; then
  echo -e "${YELLOW}❌ Déploiement annulé${NC}"
  exit 0
fi

# Étape 1 : Récupération des modifications
step "1️⃣ Récupération des modifications (git pull)"
git pull origin main
check_success "Modifications récupérées"

# Étape 2 : Installation des dépendances
step "2️⃣ Installation des dépendances"
npm install
check_success "Dépendances installées"

# Étape 3 : Génération du client Prisma
step "3️⃣ Génération du client Prisma"
npx prisma generate
check_success "Client Prisma généré"

# Étape 4 : Re-seeder les menus
step "4️⃣ Re-seeding des menus"
bash scripts/seed-menus-auto.sh
check_success "Menus re-seedés"

# Étape 5 : Build de l'application
step "5️⃣ Build de l'application"
npm run build
check_success "Application buildée"

# Étape 6 : Redémarrage PM2
step "6️⃣ Redémarrage de l'application"
if command -v pm2 &> /dev/null; then
  pm2 restart amakifr --update-env
  check_success "Application redémarrée (PM2)"
  
  # Attendre quelques secondes
  echo "Attente du démarrage de l'application..."
  sleep 5
  
  # Vérifier le status
  pm2 status amakifr
else
  echo -e "${YELLOW}⚠️  PM2 non disponible, redémarrage manuel requis${NC}"
fi

# Résumé final
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  ✅ Déploiement terminé avec succès !${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${BLUE}🧪 Tests à effectuer :${NC}"
echo "  1. Ouvrir https://www.amaki.fr/admin"
echo "  2. Vérifier le menu 'Gestion des Finances' dans la sidebar (ordre 4)"
echo "  3. Cliquer sur le menu et vérifier qu'il pointe vers /admin/finances"
echo ""
echo -e "${GREEN}🎉 Menu 'Gestion des Finances' déployé !${NC}"
