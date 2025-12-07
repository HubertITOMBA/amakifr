#!/bin/bash

# Script pour appliquer la migration SQL en production de manière sécurisée
# Usage: ./scripts/apply-migration-production-safe.sh

# --- Configuration ---
# Ajustez ces variables selon votre environnement de production
DB_NAME="${DB_NAME:-amakifr_db}"
DB_USER="${DB_USER:-amakifr_user}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"

# --- Couleurs pour la sortie console ---
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}===============================================${NC}"
echo -e "${BLUE} Application sécurisée de la migration en production ${NC}"
echo -e "${BLUE}===============================================${NC}"
echo ""

# --- Vérification de l'environnement ---
echo -e "${YELLOW}Vérification de l'environnement...${NC}"

if ! command -v psql &> /dev/null; then
  echo -e "${RED}Erreur: psql (PostgreSQL client) n'est pas installé. Veuillez l'installer.${NC}"
  exit 1
fi

MIGRATION_FILE="prisma/migrations/20251204181751_add_unique_adherent_assistance_periode/migration-production-safe.sql"
CHECK_FILE="scripts/check-migration-production.sql"

if [ ! -f "$MIGRATION_FILE" ]; then
  echo -e "${RED}Erreur: Le fichier de migration '$MIGRATION_FILE' n'existe pas.${NC}"
  exit 1
fi

if [ ! -f "$CHECK_FILE" ]; then
  echo -e "${RED}Erreur: Le fichier de vérification '$CHECK_FILE' n'existe pas.${NC}"
  exit 1
fi

echo -e "${GREEN}Environnement vérifié avec succès.${NC}"
echo ""

# --- Étape 1: Vérification pré-migration ---
echo -e "${YELLOW}Étape 1: Vérification de l'état de la base de données...${NC}"
echo -e "${BLUE}Fichier: $CHECK_FILE${NC}"
echo ""

psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$CHECK_FILE"

if [ $? -ne 0 ]; then
  echo ""
  echo -e "${RED}Erreur lors de la vérification. Veuillez corriger les problèmes avant de continuer.${NC}"
  exit 1
fi

echo ""
echo -e "${YELLOW}Vérifiez les résultats ci-dessus.${NC}"
echo -e "${YELLOW}Si des doublons sont détectés, corrigez-les avant de continuer.${NC}"
echo ""
read -p "Voulez-vous continuer avec l'application de la migration ? (oui/non) " -r
echo

if [[ ! $REPLY =~ ^[Oo][Uu][Ii]$ ]]; then
  echo -e "${YELLOW}Migration annulée par l'utilisateur.${NC}"
  exit 0
fi

# --- Étape 2: Sauvegarde (optionnelle mais recommandée) ---
echo ""
echo -e "${YELLOW}Étape 2: Sauvegarde recommandée${NC}"
echo -e "${YELLOW}Il est fortement recommandé de faire une sauvegarde avant d'appliquer la migration.${NC}"
read -p "Voulez-vous créer une sauvegarde maintenant ? (oui/non) " -r
echo

if [[ $REPLY =~ ^[Oo][Uu][Ii]$ ]]; then
  BACKUP_FILE="backup_cotisations_du_mois_$(date +%Y%m%d_%H%M%S).sql"
  echo -e "${BLUE}Création de la sauvegarde: $BACKUP_FILE${NC}"
  pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t cotisations_du_mois > "$BACKUP_FILE"
  
  if [ $? -eq 0 ]; then
    echo -e "${GREEN}Sauvegarde créée avec succès: $BACKUP_FILE${NC}"
  else
    echo -e "${RED}Erreur lors de la création de la sauvegarde.${NC}"
    read -p "Continuer quand même ? (oui/non) " -r
    echo
    if [[ ! $REPLY =~ ^[Oo][Uu][Ii]$ ]]; then
      exit 1
    fi
  fi
fi

# --- Étape 3: Application de la migration ---
echo ""
echo -e "${YELLOW}Étape 3: Application de la migration SQL...${NC}"
echo -e "${BLUE}Fichier: $MIGRATION_FILE${NC}"
echo ""

psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$MIGRATION_FILE"

if [ $? -eq 0 ]; then
  echo ""
  echo -e "${GREEN}Migration appliquée avec succès !${NC}"
  echo ""
  echo -e "${YELLOW}Vérification post-migration...${NC}"
  
  # Vérification que la nouvelle contrainte existe
  psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
    SELECT 
      CASE 
        WHEN EXISTS (
          SELECT 1 
          FROM pg_constraint 
          WHERE conname = 'cotisations_du_mois_periode_adherentBeneficiaireId_key'
          AND conrelid = 'cotisations_du_mois'::regclass
        ) THEN '✅ Nouvelle contrainte unique créée avec succès'
        ELSE '❌ Nouvelle contrainte unique non trouvée'
      END as verification;
  "
  
  echo ""
  echo -e "${GREEN}Migration terminée avec succès !${NC}"
  echo ""
  echo -e "${BLUE}Prochaines étapes:${NC}"
  echo -e "${BLUE}  1. Vérifiez que l'application fonctionne correctement${NC}"
  echo -e "${BLUE}  2. Testez la création de nouvelles cotisations du mois${NC}"
  echo -e "${BLUE}  3. Vérifiez que les contraintes sont respectées${NC}"
else
  echo ""
  echo -e "${RED}Erreur lors de l'application de la migration.${NC}"
  echo -e "${YELLOW}Vérifiez les logs ci-dessus pour plus de détails.${NC}"
  echo -e "${YELLOW}Si une sauvegarde a été créée, vous pouvez la restaurer.${NC}"
  exit 1
fi

echo ""
echo -e "${BLUE}===============================================${NC}"

