#!/bin/bash

###############################################################################
# Script de correction rapide du problème 502 Bad Gateway
# 
# Ce script corrige les problèmes courants qui causent l'erreur 502
# lors de l'activation du mode maintenance.
###############################################################################

set -e

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🔧  CORRECTION DU PROBLÈME 502 BAD GATEWAY${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Configuration
MAINTENANCE_FLAG="/sites/amakifr/maintenance.flag"
MAINTENANCE_HTML="/sites/amakifr/.next/server/app/maintenance.html"
PUBLIC_MAINTENANCE_HTML="./public/maintenance.html"

# Vérifier qu'on est dans le bon répertoire
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Erreur: Ce script doit être exécuté depuis la racine du projet (/sites/amakifr).${NC}"
    exit 1
fi

# Vérifier que le fichier source existe
if [ ! -f "$PUBLIC_MAINTENANCE_HTML" ]; then
    echo -e "${RED}❌ Erreur: Le fichier source n'existe pas: $PUBLIC_MAINTENANCE_HTML${NC}"
    exit 1
fi

echo -e "${GREEN}📋 Étape 1/5: Création du répertoire de destination${NC}"
DEST_DIR=$(dirname "$MAINTENANCE_HTML")
if [ ! -d "$DEST_DIR" ]; then
    echo -e "${YELLOW}   ℹ️  Création du répertoire: $DEST_DIR${NC}"
    sudo mkdir -p "$DEST_DIR"
    echo -e "${GREEN}   ✅ Répertoire créé${NC}"
else
    echo -e "${GREEN}   ✅ Répertoire existe déjà${NC}"
fi

echo ""
echo -e "${GREEN}📄 Étape 2/5: Copie de la page de maintenance${NC}"
if sudo cp "$PUBLIC_MAINTENANCE_HTML" "$MAINTENANCE_HTML"; then
    echo -e "${GREEN}   ✅ Page copiée vers: $MAINTENANCE_HTML${NC}"
else
    echo -e "${RED}   ❌ Erreur lors de la copie${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}🔒 Étape 3/5: Configuration des permissions${NC}"
if sudo chmod 644 "$MAINTENANCE_HTML"; then
    echo -e "${GREEN}   ✅ Permissions définies (644)${NC}"
else
    echo -e "${YELLOW}   ⚠️  Impossible de définir les permissions${NC}"
fi

echo ""
echo -e "${GREEN}🏷️  Étape 4/5: Vérification/Création du fichier flag${NC}"
if [ ! -f "$MAINTENANCE_FLAG" ]; then
    echo -e "${YELLOW}   ℹ️  Création du fichier flag${NC}"
    if sudo touch "$MAINTENANCE_FLAG"; then
        sudo bash -c "echo 'Maintenance activée le $(date)' > $MAINTENANCE_FLAG"
        echo -e "${GREEN}   ✅ Fichier flag créé${NC}"
    else
        echo -e "${RED}   ❌ Erreur lors de la création du fichier flag${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}   ✅ Fichier flag existe déjà${NC}"
fi

echo ""
echo -e "${GREEN}🔄 Étape 5/5: Rechargement de nginx${NC}"
if sudo nginx -t > /dev/null 2>&1; then
    echo -e "${GREEN}   ✅ Configuration nginx valide${NC}"
    if sudo systemctl reload nginx; then
        echo -e "${GREEN}   ✅ Nginx rechargé${NC}"
    else
        echo -e "${RED}   ❌ Erreur lors du rechargement de nginx${NC}"
        exit 1
    fi
else
    echo -e "${RED}   ❌ Configuration nginx invalide${NC}"
    echo -e "${YELLOW}   ℹ️  Détails:${NC}"
    sudo nginx -t 2>&1 | sed 's/^/      /'
    exit 1
fi

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅  CORRECTION TERMINÉE !${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${GREEN}📌 Fichiers créés/vérifiés:${NC}"
echo -e "   • Flag: ${GREEN}$MAINTENANCE_FLAG${NC}"
echo -e "   • HTML: ${GREEN}$MAINTENANCE_HTML${NC}"
echo ""
echo -e "${BLUE}💡 Test:${NC}"
echo -e "   1. Actualisez votre navigateur (${GREEN}Ctrl+Shift+R${NC})"
echo -e "   2. Vous devriez voir la page de maintenance"
echo -e "   3. Si le problème persiste, consultez les logs:"
echo -e "      ${GREEN}sudo tail -f /var/log/nginx/error.log${NC}"
echo ""
