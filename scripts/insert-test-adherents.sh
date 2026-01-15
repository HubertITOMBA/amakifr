#!/bin/bash

# Script pour insérer les adhérents de test dans la base de données
# Usage: bash scripts/insert-test-adherents.sh
#
# Ce script :
# - Peut être exécuté et réexécuté plusieurs fois (gère les doublons)
# - Ne doit pas envoyer d'emails
# - Initialise tous les champs selon les spécifications

set -e

# Couleurs pour les messages
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Insertion des Adhérents de Test${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Vérifier qu'on n'est pas en sudo
if [ "$EUID" -eq 0 ]; then 
  echo -e "${RED}❌ Erreur : Ce script ne doit PAS être exécuté avec sudo${NC}"
  echo -e "${YELLOW}→ Exécutez : bash scripts/insert-test-adherents.sh${NC}"
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

# Vérifier que le fichier .env existe
if [ ! -f ".env" ]; then
  echo -e "${YELLOW}⚠️  Le fichier .env n'existe pas${NC}"
  echo -e "${YELLOW}→ Assurez-vous que DATABASE_URL est configuré${NC}"
fi

echo -e "${YELLOW}⚠️  Ce script va insérer ${NC}${BLUE}${#testAdherents[@]}${NC}${YELLOW} adhérents de test dans la base de données${NC}"
echo -e "${YELLOW}   - Les utilisateurs existants seront mis à jour${NC}"
echo -e "${YELLOW}   - Les nouveaux utilisateurs seront créés${NC}"
echo -e "${YELLOW}   - Aucun email ne sera envoyé${NC}"
echo ""
read -p "Continuer ? (oui/non) " -n 3 -r
echo ""
if [[ ! $REPLY =~ ^[Oo][Uu][Ii]$ ]]; then
  echo -e "${YELLOW}❌ Insertion annulée${NC}"
  exit 0
fi

# Générer le client Prisma si nécessaire
echo -e "${BLUE}🔧 Génération du client Prisma...${NC}"
npx prisma generate
echo -e "${GREEN}✅ Client Prisma généré${NC}"
echo ""

# Exécuter le script TypeScript
echo -e "${BLUE}📝 Insertion des adhérents...${NC}"
npx tsx scripts/insert-test-adherents.ts

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  ✅ Insertion terminée !${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${BLUE}💡 Notes importantes :${NC}"
echo -e "   - Tous les comptes utilisent le mot de passe : ${YELLOW}password${NC}"
echo -e "   - Ce script peut être réexécuté sans problème"
echo -e "   - Aucun email n'a été envoyé (script de test uniquement)"
echo ""
