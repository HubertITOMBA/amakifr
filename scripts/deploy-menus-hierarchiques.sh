#!/bin/bash

# Script de déploiement automatisé pour les menus hiérarchiques
# Usage: bash scripts/deploy-menus-hierarchiques.sh

set -e  # Arrêter en cas d'erreur

# Couleurs pour les messages
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Déploiement - Menus Hiérarchiques${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Vérifier qu'on n'est pas en sudo
if [ "$EUID" -eq 0 ]; then 
  echo -e "${RED}❌ Erreur : Ce script ne doit PAS être exécuté avec sudo${NC}"
  echo -e "${YELLOW}→ Exécutez : bash scripts/deploy-menus-hierarchiques.sh${NC}"
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
echo "  1. Mettre à jour les dépendances"
echo "  2. Générer le client Prisma"
echo "  3. Re-seeder les menus (suppression + recréation)"
echo "  4. Builder l'application"
echo "  5. Redémarrer PM2"
echo ""
read -p "Continuer ? (oui/non) " -n 3 -r
echo ""
if [[ ! $REPLY =~ ^[Oo][Uu][Ii]$ ]]; then
  echo -e "${YELLOW}❌ Déploiement annulé${NC}"
  exit 0
fi

# Étape 1 : Installation des dépendances
step "1️⃣ Installation des dépendances"
npm install
check_success "Dépendances installées"

# Étape 2 : Génération du client Prisma
step "2️⃣ Génération du client Prisma"
npx prisma generate
check_success "Client Prisma généré"

# Étape 3 : Vérification de la connexion à la base
step "3️⃣ Vérification de la connexion à la base de données"
npx prisma db execute --stdin <<EOF
SELECT 1;
EOF
check_success "Connexion à la base de données OK"

# Étape 4 : Sauvegarde des menus actuels (optionnel)
step "4️⃣ Sauvegarde des menus actuels"
BACKUP_FILE="/tmp/menus_backup_$(date +%Y%m%d_%H%M%S).sql"
if command -v pg_dump &> /dev/null; then
  # Extraire les infos de connexion depuis DATABASE_URL
  if [ -f .env ]; then
    source .env
    if [ ! -z "$DATABASE_URL" ]; then
      echo "Sauvegarde des menus dans $BACKUP_FILE..."
      pg_dump "$DATABASE_URL" -t menus > "$BACKUP_FILE" 2>/dev/null || true
      if [ -f "$BACKUP_FILE" ]; then
        echo -e "${GREEN}✅ Sauvegarde créée : $BACKUP_FILE${NC}"
      else
        echo -e "${YELLOW}⚠️  Sauvegarde non créée (non critique)${NC}"
      fi
    fi
  fi
else
  echo -e "${YELLOW}⚠️  pg_dump non disponible, sauvegarde ignorée${NC}"
fi

# Étape 5 : Re-seeder les menus
step "5️⃣ Re-seeding des menus"
bash scripts/seed-menus-auto.sh
check_success "Menus re-seedés"

# Étape 6 : Vérification des menus créés
step "6️⃣ Vérification des menus créés"
MENU_COUNT=$(npx prisma db execute --stdin <<EOF | grep -oP '\d+' | head -1
SELECT COUNT(*) FROM menus;
EOF
)
echo "Nombre de menus en base : $MENU_COUNT"
if [ "$MENU_COUNT" -ge 30 ]; then
  echo -e "${GREEN}✅ Nombre de menus correct ($MENU_COUNT)${NC}"
else
  echo -e "${RED}❌ Nombre de menus insuffisant ($MENU_COUNT, attendu >= 30)${NC}"
  exit 1
fi

# Vérifier les sous-menus
SUBMENU_COUNT=$(npx prisma db execute --stdin <<EOF | grep -oP '\d+' | head -1
SELECT COUNT(*) FROM menus WHERE parent IS NOT NULL;
EOF
)
echo "Nombre de sous-menus : $SUBMENU_COUNT"
if [ "$SUBMENU_COUNT" -ge 2 ]; then
  echo -e "${GREEN}✅ Sous-menus créés ($SUBMENU_COUNT)${NC}"
else
  echo -e "${YELLOW}⚠️  Aucun sous-menu trouvé (attendu >= 2)${NC}"
fi

# Étape 7 : Build de l'application
step "7️⃣ Build de l'application"
npm run build
check_success "Application buildée"

# Étape 8 : Redémarrage PM2
step "8️⃣ Redémarrage de l'application"
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
echo -e "${BLUE}📊 Résumé :${NC}"
echo "  - Menus totaux : $MENU_COUNT"
echo "  - Sous-menus : $SUBMENU_COUNT"
if [ -f "$BACKUP_FILE" ]; then
  echo "  - Sauvegarde : $BACKUP_FILE"
fi
echo ""
echo -e "${BLUE}🧪 Tests à effectuer :${NC}"
echo "  1. Ouvrir https://www.amaki.fr/"
echo "  2. Vérifier le menu 'Scrutin' avec dropdown"
echo "  3. Tester la navigation vers Informations et Résultats"
echo "  4. Vérifier sur mobile (menu burger)"
echo "  5. Désactiver les menus électoraux dans /admin/settings"
echo ""
echo -e "${BLUE}📚 Documentation :${NC}"
echo "  - docs/MENUS_HIERARCHIQUES.md"
echo "  - docs/DEPLOIEMENT_MENUS_HIERARCHIQUES.md"
echo ""
echo -e "${GREEN}🎉 Menus hiérarchiques déployés !${NC}"
