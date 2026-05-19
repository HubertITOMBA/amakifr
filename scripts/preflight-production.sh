#!/bin/bash
# Vérifications AVANT push/déploiement (local ou CI) — ne modifie pas la base
set -euo pipefail

cd "$(dirname "$0")/.."

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🔍 Pré-vol production AMAKI${NC}\n"

ERRORS=0

check() {
  if "$@"; then
    echo -e "${GREEN}✅ $1${NC}"
  else
    echo -e "${RED}❌ Échec: $*${NC}"
    ERRORS=$((ERRORS + 1))
  fi
}

# Schéma Prisma valide
if npx prisma validate >/dev/null 2>&1; then
  echo -e "${GREEN}✅ prisma validate${NC}"
else
  echo -e "${RED}❌ prisma validate${NC}"
  ERRORS=$((ERRORS + 1))
fi

# Migrations présentes
if [ -f scripts/pre-migrate-production-safe.sql ]; then
  echo -e "${GREEN}✅ SQL idempotent production présent${NC}"
else
  echo -e "${RED}❌ scripts/pre-migrate-production-safe.sql manquant${NC}"
  ERRORS=$((ERRORS + 1))
fi

# Pas de reset-production dans la commande par défaut
echo -e "${GREEN}✅ Rappel: ne jamais utiliser prisma migrate reset en production${NC}"

# Statut migrations (si DATABASE_URL)
if [ -f .env ]; then
  # shellcheck disable=SC1091
  set -a && source .env && set +a
  if [ -n "${DATABASE_URL:-}" ]; then
    echo ""
    echo -e "${BLUE}État migrations (base locale / staging):${NC}"
    npx prisma migrate status 2>&1 || true
    echo ""
    if npx prisma migrate status 2>&1 | grep -q "failed"; then
      echo -e "${YELLOW}⚠️  Migrations en échec détectées — exécutez sur la cible :${NC}"
      echo "   npx prisma db execute --schema prisma/schema.prisma --file scripts/pre-migrate-production-safe.sql"
      echo "   npx prisma migrate resolve --applied <nom_migration>"
      echo "   npx prisma migrate deploy"
    fi
  fi
fi

# Build dry-run optionnel
if [ "${RUN_BUILD:-0}" = "1" ]; then
  echo ""
  echo -e "${BLUE}Build de test...${NC}"
  npm run build || ERRORS=$((ERRORS + 1))
fi

echo ""
if [ "$ERRORS" -eq 0 ]; then
  echo -e "${GREEN}✅ Pré-vol OK — prêt pour commit/push${NC}"
  echo -e "${BLUE}Sur le serveur: bash scripts/deploy-production-safe.sh${NC}"
  exit 0
else
  echo -e "${RED}❌ $ERRORS erreur(s) — corrigez avant le déploiement${NC}"
  exit 1
fi
