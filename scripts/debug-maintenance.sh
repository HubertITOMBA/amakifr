#!/bin/bash

###############################################################################
# Script de diagnostic du mode maintenance
# 
# Ce script vérifie tous les éléments nécessaires au bon fonctionnement
# du mode maintenance et affiche un diagnostic complet.
###############################################################################

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🔍  DIAGNOSTIC DU MODE MAINTENANCE - AMAKI${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Configuration
MAINTENANCE_FLAG="/sites/amakifr/maintenance.flag"
MAINTENANCE_HTML="/sites/amakifr/.next/server/app/maintenance.html"
PUBLIC_MAINTENANCE_HTML="/sites/amakifr/public/maintenance.html"

# Compteur de problèmes
PROBLEMS=0

# 1. Vérifier le fichier flag
echo -e "${YELLOW}📋 1. Vérification du fichier flag${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
if [ -f "$MAINTENANCE_FLAG" ]; then
    echo -e "${GREEN}   ✅ Fichier flag existe: $MAINTENANCE_FLAG${NC}"
    echo -e "${BLUE}   ℹ️  Contenu:${NC}"
    cat "$MAINTENANCE_FLAG" | sed 's/^/      /'
    echo ""
    echo -e "${BLUE}   ℹ️  Permissions:${NC}"
    ls -la "$MAINTENANCE_FLAG" | sed 's/^/      /'
else
    echo -e "${RED}   ❌ Fichier flag introuvable: $MAINTENANCE_FLAG${NC}"
    echo -e "${YELLOW}   ⚠️  Le mode maintenance n'est pas activé${NC}"
    PROBLEMS=$((PROBLEMS + 1))
fi

echo ""

# 2. Vérifier la page HTML de maintenance (source)
echo -e "${YELLOW}📄 2. Vérification de la page HTML source${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
if [ -f "$PUBLIC_MAINTENANCE_HTML" ]; then
    echo -e "${GREEN}   ✅ Fichier source existe: $PUBLIC_MAINTENANCE_HTML${NC}"
    SIZE=$(stat -f%z "$PUBLIC_MAINTENANCE_HTML" 2>/dev/null || stat -c%s "$PUBLIC_MAINTENANCE_HTML" 2>/dev/null)
    echo -e "${BLUE}   ℹ️  Taille: ${SIZE} octets${NC}"
else
    echo -e "${RED}   ❌ Fichier source introuvable: $PUBLIC_MAINTENANCE_HTML${NC}"
    PROBLEMS=$((PROBLEMS + 1))
fi

echo ""

# 3. Vérifier la page HTML de maintenance (destination)
echo -e "${YELLOW}📄 3. Vérification de la page HTML de destination${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
if [ -f "$MAINTENANCE_HTML" ]; then
    echo -e "${GREEN}   ✅ Fichier de maintenance existe: $MAINTENANCE_HTML${NC}"
    SIZE=$(stat -f%z "$MAINTENANCE_HTML" 2>/dev/null || stat -c%s "$MAINTENANCE_HTML" 2>/dev/null)
    echo -e "${BLUE}   ℹ️  Taille: ${SIZE} octets${NC}"
    echo -e "${BLUE}   ℹ️  Permissions:${NC}"
    ls -la "$MAINTENANCE_HTML" | sed 's/^/      /'
else
    echo -e "${RED}   ❌ Fichier de maintenance introuvable: $MAINTENANCE_HTML${NC}"
    echo -e "${YELLOW}   ⚠️  C'est probablement la cause du 502 Bad Gateway !${NC}"
    PROBLEMS=$((PROBLEMS + 1))
fi

echo ""

# 4. Vérifier le répertoire de destination
echo -e "${YELLOW}📁 4. Vérification du répertoire de destination${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
DEST_DIR=$(dirname "$MAINTENANCE_HTML")
if [ -d "$DEST_DIR" ]; then
    echo -e "${GREEN}   ✅ Répertoire existe: $DEST_DIR${NC}"
    echo -e "${BLUE}   ℹ️  Permissions:${NC}"
    ls -lad "$DEST_DIR" | sed 's/^/      /'
else
    echo -e "${RED}   ❌ Répertoire introuvable: $DEST_DIR${NC}"
    echo -e "${YELLOW}   ⚠️  Besoin de créer ce répertoire${NC}"
    PROBLEMS=$((PROBLEMS + 1))
fi

echo ""

# 5. Vérifier nginx
echo -e "${YELLOW}🔧 5. Vérification de nginx${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
if command -v nginx &> /dev/null; then
    echo -e "${GREEN}   ✅ Nginx installé${NC}"
    NGINX_VERSION=$(nginx -v 2>&1 | cut -d'/' -f2)
    echo -e "${BLUE}   ℹ️  Version: nginx/${NGINX_VERSION}${NC}"
    
    # Tester la configuration
    if sudo nginx -t &> /dev/null; then
        echo -e "${GREEN}   ✅ Configuration nginx valide${NC}"
    else
        echo -e "${RED}   ❌ Configuration nginx invalide${NC}"
        echo -e "${YELLOW}   ℹ️  Erreurs détectées:${NC}"
        sudo nginx -t 2>&1 | sed 's/^/      /'
        PROBLEMS=$((PROBLEMS + 1))
    fi
    
    # Statut nginx
    if systemctl is-active --quiet nginx; then
        echo -e "${GREEN}   ✅ Nginx actif${NC}"
    else
        echo -e "${RED}   ❌ Nginx inactif${NC}"
        PROBLEMS=$((PROBLEMS + 1))
    fi
else
    echo -e "${RED}   ❌ Nginx non installé ou non accessible${NC}"
    PROBLEMS=$((PROBLEMS + 1))
fi

echo ""

# 6. Vérifier la configuration nginx du mode maintenance
echo -e "${YELLOW}⚙️  6. Vérification de la configuration nginx du mode maintenance${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Chercher les fichiers de configuration nginx
NGINX_CONFIGS=$(find /etc/nginx -name "*.conf" 2>/dev/null | grep -E "(sites-available|conf.d)")

if [ -z "$NGINX_CONFIGS" ]; then
    echo -e "${RED}   ❌ Aucun fichier de configuration nginx trouvé${NC}"
    PROBLEMS=$((PROBLEMS + 1))
else
    FOUND_MAINTENANCE=false
    for CONFIG_FILE in $NGINX_CONFIGS; do
        if sudo grep -q "maintenance.flag" "$CONFIG_FILE" 2>/dev/null; then
            echo -e "${GREEN}   ✅ Configuration du mode maintenance trouvée dans:${NC}"
            echo -e "${BLUE}      $CONFIG_FILE${NC}"
            FOUND_MAINTENANCE=true
            
            # Vérifier le chemin du flag dans la config
            FLAG_PATH=$(sudo grep -o '/[^[:space:]]*maintenance\.flag' "$CONFIG_FILE" 2>/dev/null | head -1)
            if [ "$FLAG_PATH" = "$MAINTENANCE_FLAG" ]; then
                echo -e "${GREEN}   ✅ Chemin du flag correct: $FLAG_PATH${NC}"
            else
                echo -e "${RED}   ❌ Chemin du flag incorrect dans nginx: $FLAG_PATH${NC}"
                echo -e "${YELLOW}   ℹ️  Devrait être: $MAINTENANCE_FLAG${NC}"
                PROBLEMS=$((PROBLEMS + 1))
            fi
            
            # Vérifier le root path
            ROOT_PATH=$(sudo grep -A 10 "@maintenance" "$CONFIG_FILE" 2>/dev/null | grep "root" | grep -o '/[^;]*' | head -1)
            EXPECTED_ROOT=$(dirname "$MAINTENANCE_HTML")
            if [ "$ROOT_PATH" = "$EXPECTED_ROOT" ]; then
                echo -e "${GREEN}   ✅ Chemin root correct: $ROOT_PATH${NC}"
            else
                echo -e "${RED}   ❌ Chemin root incorrect dans nginx: $ROOT_PATH${NC}"
                echo -e "${YELLOW}   ℹ️  Devrait être: $EXPECTED_ROOT${NC}"
                PROBLEMS=$((PROBLEMS + 1))
            fi
        fi
    done
    
    if [ "$FOUND_MAINTENANCE" = false ]; then
        echo -e "${RED}   ❌ Configuration du mode maintenance NON trouvée dans nginx${NC}"
        echo -e "${YELLOW}   ℹ️  Vous devez ajouter la configuration du mode maintenance à nginx${NC}"
        PROBLEMS=$((PROBLEMS + 1))
    fi
fi

echo ""

# 7. Logs nginx récents
echo -e "${YELLOW}📋 7. Logs nginx récents (erreurs)${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
if [ -f "/var/log/nginx/error.log" ]; then
    RECENT_ERRORS=$(sudo tail -20 /var/log/nginx/error.log 2>/dev/null | grep -i "maintenance\|503\|502")
    if [ -z "$RECENT_ERRORS" ]; then
        echo -e "${BLUE}   ℹ️  Aucune erreur récente liée à la maintenance${NC}"
    else
        echo -e "${YELLOW}   ⚠️  Erreurs récentes détectées:${NC}"
        echo "$RECENT_ERRORS" | tail -10 | sed 's/^/      /'
    fi
else
    echo -e "${YELLOW}   ⚠️  Fichier de log nginx non accessible${NC}"
fi

echo ""

# Résumé
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
if [ $PROBLEMS -eq 0 ]; then
    echo -e "${GREEN}✅  DIAGNOSTIC COMPLET : Aucun problème détecté${NC}"
    echo ""
    echo -e "${BLUE}💡 Si vous voyez toujours 502 Bad Gateway:${NC}"
    echo -e "   1. Essayez de recharger nginx: ${GREEN}sudo systemctl reload nginx${NC}"
    echo -e "   2. Videz le cache de votre navigateur: ${GREEN}Ctrl+Shift+R${NC}"
    echo -e "   3. Consultez les logs: ${GREEN}sudo tail -f /var/log/nginx/error.log${NC}"
else
    echo -e "${RED}❌  DIAGNOSTIC COMPLET : $PROBLEMS problème(s) détecté(s)${NC}"
    echo ""
    echo -e "${YELLOW}🔧 SOLUTIONS RECOMMANDÉES:${NC}"
    echo ""
    
    if [ ! -f "$MAINTENANCE_HTML" ]; then
        echo -e "${YELLOW}1. Copier la page de maintenance:${NC}"
        echo -e "   ${GREEN}sudo mkdir -p $(dirname $MAINTENANCE_HTML)${NC}"
        echo -e "   ${GREEN}sudo cp $PUBLIC_MAINTENANCE_HTML $MAINTENANCE_HTML${NC}"
        echo -e "   ${GREEN}sudo chmod 644 $MAINTENANCE_HTML${NC}"
        echo ""
    fi
    
    if [ ! -f "$MAINTENANCE_FLAG" ]; then
        echo -e "${YELLOW}2. Le mode maintenance n'est pas activé. Pour l'activer:${NC}"
        echo -e "   ${GREEN}bash scripts/maintenance-on.sh${NC}"
        echo ""
    fi
    
    echo -e "${YELLOW}3. Recharger nginx:${NC}"
    echo -e "   ${GREEN}sudo systemctl reload nginx${NC}"
    echo ""
fi

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
