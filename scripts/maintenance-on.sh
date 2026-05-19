#!/bin/bash

###############################################################################
# Activation du mode maintenance — AMAKI France (amakifr)
#
# - Crée maintenance.flag (détecté par nginx)
# - Vérifie public/maintenance.html
# - Active MAINTENANCE_MODE dans .env.local (fallback Next.js sans nginx)
#
# Usage dev  : bash scripts/maintenance-on.sh
# Usage prod : AMAKI_SITE_ROOT=/sites/amakifr bash scripts/maintenance-on.sh
###############################################################################

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SITE_ROOT="${AMAKI_SITE_ROOT:-$PROJECT_ROOT}"

MAINTENANCE_FLAG="${SITE_ROOT}/maintenance.flag"
PUBLIC_HTML="${PROJECT_ROOT}/public/maintenance.html"
# En production PM2 lit surtout .env ; en dev .env.local
ENV_FILES=()
[ -f "${PROJECT_ROOT}/.env" ] && ENV_FILES+=("${PROJECT_ROOT}/.env")
[ -f "${PROJECT_ROOT}/.env.local" ] && ENV_FILES+=("${PROJECT_ROOT}/.env.local")
[ ${#ENV_FILES[@]} -eq 0 ] && ENV_FILES+=("${PROJECT_ROOT}/.env.local")
# Copie optionnelle pour nginx prod historique (.next/server/app)
NEXT_HTML_LEGACY="${SITE_ROOT}/.next/server/app/maintenance.html"

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🔧  ACTIVATION DU MODE MAINTENANCE — AMAKI FRANCE${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}   Projet : ${PROJECT_ROOT}${NC}"
echo -e "${CYAN}   Site   : ${SITE_ROOT}${NC}"
echo ""

if [ ! -f "${PROJECT_ROOT}/package.json" ]; then
  echo -e "${RED}❌ Exécutez ce script depuis la racine du projet.${NC}"
  exit 1
fi

if [ ! -f "$PUBLIC_HTML" ]; then
  echo -e "${RED}❌ Fichier introuvable : $PUBLIC_HTML${NC}"
  exit 1
fi

echo -e "${YELLOW}⚠️  Les visiteurs verront la page de maintenance.${NC}"
read -p "Continuer ? (o/n) : " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[OoYy]$ ]]; then
  echo -e "${BLUE}ℹ️  Annulé.${NC}"
  exit 0
fi

echo ""
echo -e "${GREEN}📝 Étape 1/4 : Fichier flag nginx...${NC}"
if [ "$SITE_ROOT" = "$PROJECT_ROOT" ]; then
  echo "Maintenance activée le $(date)" > "$MAINTENANCE_FLAG"
  chmod 644 "$MAINTENANCE_FLAG"
else
  echo "Maintenance activée le $(date)" | sudo tee "$MAINTENANCE_FLAG" > /dev/null
  sudo chmod 644 "$MAINTENANCE_FLAG"
fi
echo -e "${GREEN}   ✅ $MAINTENANCE_FLAG${NC}"

echo ""
echo -e "${GREEN}📄 Étape 2/4 : Page maintenance (public/maintenance.html)...${NC}"
echo -e "${GREEN}   ✅ $PUBLIC_HTML${NC}"

if [ -d "$(dirname "$NEXT_HTML_LEGACY")" ]; then
  if [ "$SITE_ROOT" = "$PROJECT_ROOT" ]; then
    cp "$PUBLIC_HTML" "$NEXT_HTML_LEGACY"
    chmod 644 "$NEXT_HTML_LEGACY"
  else
    sudo cp "$PUBLIC_HTML" "$NEXT_HTML_LEGACY"
    sudo chmod 644 "$NEXT_HTML_LEGACY"
  fi
  echo -e "${GREEN}   ✅ Copie legacy nginx : $NEXT_HTML_LEGACY${NC}"
fi

echo ""
echo -e "${GREEN}⚙️  Étape 3/4 : Variable MAINTENANCE_MODE (.env / .env.local)...${NC}"
for ENV_FILE in "${ENV_FILES[@]}"; do
  touch "$ENV_FILE"
  if grep -q '^MAINTENANCE_MODE=' "$ENV_FILE" 2>/dev/null; then
    sed -i 's/^MAINTENANCE_MODE=.*/MAINTENANCE_MODE=true/' "$ENV_FILE"
  else
    echo "MAINTENANCE_MODE=true" >> "$ENV_FILE"
  fi
  if grep -q '^MAINTENANCE_BYPASS_IPS=' "$ENV_FILE" 2>/dev/null; then
    sed -i 's/^MAINTENANCE_BYPASS_IPS=.*/MAINTENANCE_BYPASS_IPS=/' "$ENV_FILE"
  else
    echo "MAINTENANCE_BYPASS_IPS=" >> "$ENV_FILE"
  fi
  echo -e "${GREEN}   ✅ MAINTENANCE_MODE=true dans $(basename "$ENV_FILE")${NC}"
done

echo ""
echo -e "${GREEN}🔄 Étape 4/4 : Rechargement nginx (si disponible)...${NC}"
if command -v nginx >/dev/null 2>&1 && sudo nginx -t >/dev/null 2>&1; then
  if sudo systemctl reload nginx 2>/dev/null; then
    echo -e "${GREEN}   ✅ Nginx rechargé${NC}"
  else
    echo -e "${YELLOW}   ⚠️  Rechargez nginx : sudo systemctl reload nginx${NC}"
  fi
else
  echo -e "${YELLOW}   ℹ️  Nginx non configuré — test via Next.js uniquement (MAINTENANCE_MODE)${NC}"
fi

echo ""
echo -e "${GREEN}✅ MODE MAINTENANCE ACTIVÉ${NC}"
echo -e "${YELLOW}💡 Redémarrez Next.js / PM2 (obligatoire pour MAINTENANCE_MODE) :${NC}"
echo -e "   ${GREEN}pm2 restart amaki --update-env${NC}  (prod)  ou  ${GREEN}pm2 restart amakifr-dev --update-env${NC}  (dev)"
echo -e "${BLUE}ℹ️  Test direct : http://localhost:9052/maintenance${NC}"
echo -e "${BLUE}ℹ️  Désactivation : bash scripts/maintenance-off.sh${NC}"
echo ""
