#!/bin/bash

# ================================================================
# Script d'application de l'insertion des nouveaux adhérents
# ================================================================

set -e  # Arrêter en cas d'erreur

# Couleurs pour l'affichage
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}================================================================${NC}"
echo -e "${BLUE}  Insertion de 5 nouveaux adhérents${NC}"
echo -e "${BLUE}================================================================${NC}"
echo ""

# Vérifier que le fichier .env existe
if [ ! -f .env ]; then
    echo -e "${RED}❌ Erreur: Fichier .env introuvable${NC}"
    exit 1
fi

# Charger les variables d'environnement
source .env

# Vérifier que DATABASE_URL est défini
if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}❌ Erreur: DATABASE_URL n'est pas défini dans .env${NC}"
    exit 1
fi

echo -e "${YELLOW}📋 Adhérents à insérer:${NC}"
echo "  1. Thérèse Mayakampongo (maya.thethe@gmail.com)"
echo "  2. Eugène Mbongo (eugenembongopasy@gmail.com)"
echo "  3. Marie Muilu (mariemuilu243@gmail.com)"
echo "  4. JC Mvuama (Jcmvuama@yahoo.fr)"
echo "  5. José Tshikuna (jostshik@yahoo.fr)"
echo ""

# Demander confirmation
read -p "Voulez-vous continuer ? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}⚠️  Opération annulée${NC}"
    exit 0
fi

echo ""
echo -e "${BLUE}🔄 Vérification des emails existants...${NC}"

# Vérifier si les emails existent déjà
EXISTING=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM users WHERE email IN ('maya.thethe@gmail.com', 'eugenembongopasy@gmail.com', 'mariemuilu243@gmail.com', 'Jcmvuama@yahoo.fr', 'jostshik@yahoo.fr');" 2>&1)

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Erreur lors de la connexion à la base de données${NC}"
    echo "$EXISTING"
    exit 1
fi

EXISTING=$(echo "$EXISTING" | tr -d ' ')

if [ "$EXISTING" != "0" ]; then
    echo -e "${YELLOW}⚠️  Attention: $EXISTING email(s) existe(nt) déjà dans la base${NC}"
    read -p "Voulez-vous continuer quand même ? (y/n) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}⚠️  Opération annulée${NC}"
        exit 0
    fi
fi

echo ""
echo -e "${BLUE}💾 Création d'une sauvegarde...${NC}"

# Créer un répertoire de sauvegarde si nécessaire
mkdir -p backups

# Créer une sauvegarde
BACKUP_FILE="backups/backup-before-insert-adherents-$(date +%Y%m%d-%H%M%S).sql"
pg_dump "$DATABASE_URL" > "$BACKUP_FILE" 2>&1

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Sauvegarde créée: $BACKUP_FILE${NC}"
else
    echo -e "${YELLOW}⚠️  La sauvegarde a échoué, mais nous continuons...${NC}"
fi

echo ""
echo -e "${BLUE}🚀 Exécution du script SQL...${NC}"
echo ""

# Exécuter le script SQL
psql "$DATABASE_URL" -f scripts/insert-nouveaux-adherents.sql

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}================================================================${NC}"
    echo -e "${GREEN}  ✓ Insertion réussie !${NC}"
    echo -e "${GREEN}================================================================${NC}"
    echo ""
    echo -e "${BLUE}📊 Résumé:${NC}"
    echo "  • 5 utilisateurs créés"
    echo "  • 5 adhérents créés"
    echo "  • 5 adresses créées"
    echo "  • 5 téléphones créés"
    echo ""
    echo -e "${YELLOW}⚠️  N'oubliez pas:${NC}"
    echo "  • Les adhérents doivent changer leur mot de passe"
    echo "  • Mot de passe initial: 'password'"
    echo ""
else
    echo ""
    echo -e "${RED}================================================================${NC}"
    echo -e "${RED}  ❌ Erreur lors de l'insertion${NC}"
    echo -e "${RED}================================================================${NC}"
    echo ""
    echo -e "${YELLOW}Pour restaurer la sauvegarde:${NC}"
    echo "  psql \$DATABASE_URL < $BACKUP_FILE"
    echo ""
    exit 1
fi
