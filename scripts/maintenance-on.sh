#!/bin/bash

###############################################################################
# Script d'activation du mode maintenance
# 
# Ce script active le mode maintenance en créant un fichier flag que nginx
# détecte pour rediriger tous les utilisateurs vers la page de maintenance.
#
# Usage: ./scripts/maintenance-on.sh
# Ou depuis la racine: bash scripts/maintenance-on.sh
###############################################################################

set -e  # Arrêter le script en cas d'erreur

# Couleurs pour l'affichage
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
MAINTENANCE_FLAG="/var/www/amaki/maintenance.flag"
MAINTENANCE_HTML="/var/www/amaki/.next/server/app/maintenance.html"
PUBLIC_MAINTENANCE_HTML="./public/maintenance.html"

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🔧  ACTIVATION DU MODE MAINTENANCE - AMAKI FRANCE${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Vérifier si on est dans le bon répertoire
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Erreur: Ce script doit être exécuté depuis la racine du projet.${NC}"
    exit 1
fi

# Vérifier si le fichier HTML de maintenance existe
if [ ! -f "$PUBLIC_MAINTENANCE_HTML" ]; then
    echo -e "${RED}❌ Erreur: Le fichier de maintenance n'existe pas: $PUBLIC_MAINTENANCE_HTML${NC}"
    exit 1
fi

# Demander confirmation
echo -e "${YELLOW}⚠️  Cette action va activer le mode maintenance.${NC}"
echo -e "${YELLOW}   Tous les utilisateurs verront la page de maintenance.${NC}"
echo ""
read -p "Voulez-vous continuer ? (o/n) : " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[OoYy]$ ]]; then
    echo -e "${BLUE}ℹ️  Opération annulée.${NC}"
    exit 0
fi

echo ""
echo -e "${GREEN}📝 Étape 1/3: Création du fichier flag...${NC}"

# Créer le fichier flag
if sudo touch "$MAINTENANCE_FLAG"; then
    echo -e "${GREEN}   ✅ Fichier flag créé: $MAINTENANCE_FLAG${NC}"
else
    echo -e "${RED}   ❌ Erreur lors de la création du fichier flag${NC}"
    exit 1
fi

# Ajouter la date et l'heure dans le fichier flag
if sudo bash -c "echo 'Maintenance activée le $(date)' > $MAINTENANCE_FLAG"; then
    echo -e "${GREEN}   ✅ Horodatage ajouté au fichier flag${NC}"
else
    echo -e "${YELLOW}   ⚠️  Impossible d'ajouter l'horodatage (non critique)${NC}"
fi

echo ""
echo -e "${GREEN}📄 Étape 2/3: Copie de la page de maintenance...${NC}"

# S'assurer que le répertoire de destination existe
DEST_DIR=$(dirname "$MAINTENANCE_HTML")
if [ ! -d "$DEST_DIR" ]; then
    echo -e "${YELLOW}   ℹ️  Création du répertoire: $DEST_DIR${NC}"
    sudo mkdir -p "$DEST_DIR"
fi

# Copier le fichier HTML de maintenance
if sudo cp "$PUBLIC_MAINTENANCE_HTML" "$MAINTENANCE_HTML"; then
    echo -e "${GREEN}   ✅ Page de maintenance copiée vers: $MAINTENANCE_HTML${NC}"
    sudo chmod 644 "$MAINTENANCE_HTML"
    echo -e "${GREEN}   ✅ Permissions définies (644)${NC}"
else
    echo -e "${RED}   ❌ Erreur lors de la copie de la page de maintenance${NC}"
    # Nettoyer le fichier flag en cas d'erreur
    sudo rm -f "$MAINTENANCE_FLAG"
    exit 1
fi

echo ""
echo -e "${GREEN}🔄 Étape 3/3: Rechargement de la configuration nginx...${NC}"

# Vérifier la configuration nginx avant de recharger
if sudo nginx -t > /dev/null 2>&1; then
    echo -e "${GREEN}   ✅ Configuration nginx valide${NC}"
    
    # Recharger nginx
    if sudo systemctl reload nginx; then
        echo -e "${GREEN}   ✅ Nginx rechargé avec succès${NC}"
    else
        echo -e "${RED}   ❌ Erreur lors du rechargement de nginx${NC}"
        echo -e "${YELLOW}   ℹ️  Essayez manuellement: sudo systemctl reload nginx${NC}"
    fi
else
    echo -e "${RED}   ❌ Configuration nginx invalide${NC}"
    echo -e "${YELLOW}   ℹ️  Vérifiez avec: sudo nginx -t${NC}"
    echo -e "${YELLOW}   ℹ️  Le mode maintenance est actif mais nginx n'a pas été rechargé${NC}"
fi

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅  MODE MAINTENANCE ACTIVÉ !${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${GREEN}📌 Statut:${NC}"
echo -e "   • Fichier flag: ${GREEN}$MAINTENANCE_FLAG${NC}"
echo -e "   • Page HTML: ${GREEN}$MAINTENANCE_HTML${NC}"
echo -e "   • Date d'activation: ${BLUE}$(date '+%d/%m/%Y à %H:%M:%S')${NC}"
echo ""
echo -e "${YELLOW}💡 Tous les utilisateurs voient maintenant la page de maintenance.${NC}"
echo -e "${YELLOW}   La page se rafraîchit automatiquement toutes les 30 secondes.${NC}"
echo ""
echo -e "${BLUE}ℹ️  Pour désactiver le mode maintenance:${NC}"
echo -e "   ${GREEN}bash scripts/maintenance-off.sh${NC}"
echo ""
