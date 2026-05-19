#!/bin/bash

###############################################################################
# Désactivation du mode maintenance — AMAKI France (amakifr)
#
# Usage : bash scripts/maintenance-off.sh
# Prod  : AMAKI_SITE_ROOT=/sites/amakifr bash scripts/maintenance-off.sh
###############################################################################

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SITE_ROOT="${AMAKI_SITE_ROOT:-$PROJECT_ROOT}"

MAINTENANCE_FLAG="${SITE_ROOT}/maintenance.flag"
ENV_FILES=()
[ -f "${PROJECT_ROOT}/.env" ] && ENV_FILES+=("${PROJECT_ROOT}/.env")
[ -f "${PROJECT_ROOT}/.env.local" ] && ENV_FILES+=("${PROJECT_ROOT}/.env.local")

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}✅  DÉSACTIVATION DU MODE MAINTENANCE — AMAKI FRANCE${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

MAINT_ACTIVE=false
[ -f "$MAINTENANCE_FLAG" ] && MAINT_ACTIVE=true
for _ef in "${ENV_FILES[@]}"; do
  grep -q '^MAINTENANCE_MODE=true' "$_ef" 2>/dev/null && MAINT_ACTIVE=true
done
if [ "$MAINT_ACTIVE" = false ]; then
  echo -e "${YELLOW}⚠️  Le mode maintenance ne semble pas actif.${NC}"
  exit 0
fi

read -p "Désactiver le mode maintenance ? (o/n) : " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[OoYy]$ ]]; then
  exit 0
fi

echo ""
if [ -f "$MAINTENANCE_FLAG" ]; then
  if [ "$SITE_ROOT" = "$PROJECT_ROOT" ]; then
    rm -f "$MAINTENANCE_FLAG"
  else
    sudo rm -f "$MAINTENANCE_FLAG"
  fi
  echo -e "${GREEN}   ✅ Flag supprimé${NC}"
fi

for ENV_FILE in "${ENV_FILES[@]}"; do
  if grep -q '^MAINTENANCE_MODE=' "$ENV_FILE" 2>/dev/null; then
    sed -i 's/^MAINTENANCE_MODE=.*/MAINTENANCE_MODE=false/' "$ENV_FILE"
  else
    echo "MAINTENANCE_MODE=false" >> "$ENV_FILE"
  fi
  echo -e "${GREEN}   ✅ MAINTENANCE_MODE=false dans $(basename "$ENV_FILE")${NC}"
done

if command -v nginx >/dev/null 2>&1 && sudo nginx -t >/dev/null 2>&1; then
  sudo systemctl reload nginx 2>/dev/null && echo -e "${GREEN}   ✅ Nginx rechargé${NC}" || true
fi

echo ""
echo -e "${GREEN}✅ MODE MAINTENANCE DÉSACTIVÉ${NC}"
echo -e "${YELLOW}💡 Redémarrez l'application : pm2 restart amaki --update-env${NC}"
echo ""
