#!/bin/bash

# Script pour appliquer la migration SQL en production
# Usage: ./scripts/apply-migration-production.sh

# --- Configuration ---
# Ajustez ces variables selon votre environnement de production
DB_NAME="${DB_NAME:-amakifr_db}"
DB_USER="${DB_USER:-amakifr_user}"
# DB_HOST="${DB_HOST:-localhost}" # Décommentez et ajustez si nécessaire
# DB_PORT="${DB_PORT:-5432}" # Décommentez et ajustez si nécessaire

# --- Couleurs pour la sortie console ---
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}===============================================${NC}"
echo -e "${BLUE} Application de la migration en production ${NC}"
echo -e "${BLUE}===============================================${NC}"
echo ""

# --- Vérification de l'environnement ---
echo -e "${YELLOW}Vérification de l'environnement...${NC}"

if ! command -v psql &> /dev/null; then
  echo -e "${RED}Erreur: psql (PostgreSQL client) n'est pas installé. Veuillez l'installer.${NC}"
  exit 1
fi

MIGRATION_FILE="prisma/migrations/add_date_naissance_to_adherent.sql"

if [ ! -f "$MIGRATION_FILE" ]; then
  echo -e "${RED}Erreur: Le fichier de migration '$MIGRATION_FILE' n'existe pas.${NC}"
  exit 1
fi

echo -e "${GREEN}Environnement vérifié avec succès.${NC}"
echo ""

# --- Application de la migration ---
echo -e "${YELLOW}Application de la migration SQL...${NC}"
echo -e "${BLUE}Fichier: $MIGRATION_FILE${NC}"
echo ""

# Utilisation de psql pour appliquer la migration
# Note: Vous devrez peut-être ajuster la commande selon votre configuration
# Si vous utilisez un mot de passe, utilisez PGPASSWORD ou .pgpass

if [ -n "$DB_HOST" ] && [ -n "$DB_PORT" ]; then
  # Connexion avec host et port spécifiés
  psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$MIGRATION_FILE"
else
  # Connexion locale (socket Unix)
  psql -U "$DB_USER" -d "$DB_NAME" -f "$MIGRATION_FILE"
fi

if [ $? -eq 0 ]; then
  echo ""
  echo -e "${GREEN}Migration appliquée avec succès !${NC}"
  echo ""
  echo -e "${YELLOW}Vérification des colonnes ajoutées...${NC}"
  
  # Vérification que les colonnes ont été ajoutées
  psql -U "$DB_USER" -d "$DB_NAME" -c "
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns 
    WHERE table_name = 'adherent' 
    AND column_name IN (
        'dateNaissance',
        'typeAdhesion',
        'profession',
        'centresInteret',
        'autorisationImage',
        'accepteCommunications',
        'nombreEnfants',
        'evenementsFamiliaux'
    )
    ORDER BY column_name;
  "
  
  echo ""
  echo -e "${GREEN}Migration terminée avec succès !${NC}"
else
  echo ""
  echo -e "${RED}Erreur lors de l'application de la migration.${NC}"
  echo -e "${YELLOW}Vérifiez les logs ci-dessus pour plus de détails.${NC}"
  exit 1
fi

echo ""
echo -e "${BLUE}===============================================${NC}"

