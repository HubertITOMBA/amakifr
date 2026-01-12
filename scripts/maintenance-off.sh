#!/bin/bash

###############################################################################
# Script de désactivation du mode maintenance
# 
# Ce script désactive le mode maintenance en supprimant le fichier flag.
# Les utilisateurs pourront alors accéder normalement à l'application.
#
# Usage: ./scripts/maintenance-off.sh
# Ou depuis la racine: bash scripts/maintenance-off.sh
###############################################################################

set -e  # Arrêter le script en cas d'erreur

# Couleurs pour l'affichage
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
MAINTENANCE_FLAG="/sites/amakifr/maintenance.flag"

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}✅  DÉSACTIVATION DU MODE MAINTENANCE - AMAKI FRANCE${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Vérifier si le fichier flag existe
if [ ! -f "$MAINTENANCE_FLAG" ]; then
    echo -e "${YELLOW}⚠️  Le mode maintenance n'est pas activé.${NC}"
    echo -e "${BLUE}ℹ️  Fichier flag non trouvé: $MAINTENANCE_FLAG${NC}"
    echo ""
    exit 0
fi

# Afficher les informations du fichier flag
echo -e "${BLUE}📋 Informations du mode maintenance:${NC}"
if [ -r "$MAINTENANCE_FLAG" ]; then
    CONTENT=$(sudo cat "$MAINTENANCE_FLAG" 2>/dev/null || echo "Contenu non disponible")
    echo -e "${YELLOW}   $CONTENT${NC}"
else
    echo -e "${YELLOW}   Fichier détecté mais contenu non lisible${NC}"
fi

echo ""

# Demander confirmation
read -p "Voulez-vous désactiver le mode maintenance ? (o/n) : " -n 1 -r
echo ""
echo ""

if [[ ! $REPLY =~ ^[OoYy]$ ]]; then
    echo -e "${BLUE}ℹ️  Opération annulée.${NC}"
    exit 0
fi

echo -e "${GREEN}🗑️  Suppression du fichier flag...${NC}"

# Supprimer le fichier flag
if sudo rm -f "$MAINTENANCE_FLAG"; then
    echo -e "${GREEN}   ✅ Fichier flag supprimé: $MAINTENANCE_FLAG${NC}"
else
    echo -e "${RED}   ❌ Erreur lors de la suppression du fichier flag${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}🔄 Rechargement de la configuration nginx...${NC}"

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
fi

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅  MODE MAINTENANCE DÉSACTIVÉ !${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${GREEN}📌 Statut:${NC}"
echo -e "   • Mode maintenance: ${RED}Désactivé${NC}"
echo -e "   • Date de désactivation: ${BLUE}$(date '+%d/%m/%Y à %H:%M:%S')${NC}"
echo ""
echo -e "${GREEN}🎉 L'application est maintenant accessible par tous les utilisateurs !${NC}"
echo ""
echo -e "${BLUE}💡 Vérifications recommandées:${NC}"
echo -e "   1. Tester l'accès à l'application: ${GREEN}https://votre-domaine.fr${NC}"
echo -e "   2. Vérifier les logs nginx: ${GREEN}sudo tail -f /var/log/nginx/error.log${NC}"
echo -e "   3. Vérifier les logs de l'app: ${GREEN}pm2 logs amaki${NC}"
echo ""
