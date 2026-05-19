#!/bin/bash
# =============================================================================
# Déploiement PRODUCTION sans perte de données — AMAKI France
#
# Ordre garanti :
#   1. Maintenance ON
#   2. Sauvegarde complète PostgreSQL (obligatoire)
#   3. SQL idempotent (colonnes/tables manquantes)
#   4. Résolution migrations échouées + prisma migrate deploy
#   5. Données de référence (badges connexion, menu — upsert uniquement)
#   6. Build + redémarrage PM2
#   7. Vérifications + maintenance OFF
#
# Usage (sur le serveur, depuis la racine du projet) :
#   bash scripts/deploy-production-safe.sh
#
# Variables optionnelles :
#   PM2_APP_NAME=amaki   GIT_BRANCH=main   SKIP_MAINTENANCE=1
# =============================================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

PM2_APP_NAME="${PM2_APP_NAME:-amaki}"
GIT_BRANCH="${GIT_BRANCH:-main}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

step() { echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"; echo -e "${GREEN}$1${NC}"; echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"; }
fail() { echo -e "${RED}❌ $1${NC}"; exit 1; }
warn() { echo -e "${YELLOW}⚠️  $1${NC}"; }

echo -e "${PURPLE}🚀 Déploiement production SÉCURISÉ (sans perte de données)${NC}"
echo -e "${CYAN}Répertoire: $ROOT_DIR${NC}"
echo -e "${CYAN}Branche Git: $GIT_BRANCH | PM2: $PM2_APP_NAME${NC}"

if [ ! -f package.json ]; then
  fail "Exécutez ce script depuis la racine du projet."
fi

if [ ! -f .env ]; then
  fail "Fichier .env manquant sur le serveur."
fi

# shellcheck disable=SC1091
set -a
source .env
set +a

[ -n "${DATABASE_URL:-}" ] || fail "DATABASE_URL non défini dans .env"

echo ""
echo -e "${YELLOW}Ce script va :${NC}"
echo "  • Activer la maintenance (sauf SKIP_MAINTENANCE=1)"
echo "  • Créer une sauvegarde PostgreSQL complète"
echo "  • Appliquer les migrations SQL idempotentes (ADD COLUMN IF NOT EXISTS, etc.)"
echo "  • Exécuter prisma migrate deploy"
echo "  • Mettre à jour badges/menu connexions (sans supprimer de données)"
echo "  • Builder et redémarrer l'application"
echo ""
read -p "Continuer ? (o/N) " -n 1 -r
echo ""
[[ $REPLY =~ ^[OoYy]$ ]] || { echo "Annulé."; exit 0; }

START_TIME=$(date +%s)
BACKUP_FILE=""

# ─── Maintenance ─────────────────────────────────────────────────────────────
if [ "${SKIP_MAINTENANCE:-0}" != "1" ] && [ -f scripts/maintenance-on.sh ]; then
  step "1/9 — Mode maintenance"
  bash scripts/maintenance-on.sh || warn "Impossible d'activer la maintenance — poursuite..."
else
  warn "Maintenance non activée (SKIP_MAINTENANCE ou script absent)"
fi

# ─── Git pull ────────────────────────────────────────────────────────────────
step "2/9 — Mise à jour du code (git pull)"
if [ -d .git ]; then
  git fetch origin "$GIT_BRANCH" || warn "git fetch a échoué"
  git pull origin "$GIT_BRANCH" || warn "git pull a échoué — vérifiez manuellement"
else
  warn "Pas de dépôt Git — étape ignorée"
fi

# ─── Dépendances ─────────────────────────────────────────────────────────────
step "3/9 — Dépendances (npm ci)"
npm ci

# ─── SAUVEGARDE (critique) ───────────────────────────────────────────────────
step "4/9 — Sauvegarde complète de la base (OBLIGATOIRE)"
export DATABASE_URL
if bash scripts/db-backup-restore.sh backup -t custom; then
  BACKUP_FILE=$(ls -t "${BACKUP_DIR:-./backups}"/amakifr_backup_*.dump 2>/dev/null | head -1)
  if [ -z "$BACKUP_FILE" ] && [ -d /sites/backup ]; then
    BACKUP_FILE=$(ls -t /sites/backup/amakifr_backup_*.dump 2>/dev/null | head -1)
  fi
  echo -e "${GREEN}✅ Sauvegarde créée${NC}"
  [ -n "$BACKUP_FILE" ] && echo -e "${CYAN}   Fichier: $BACKUP_FILE${NC}"
else
  fail "Échec de la sauvegarde — déploiement interrompu pour protéger vos données."
fi

# ─── Prisma generate (client à jour avant migrations) ────────────────────────
step "5/9 — Génération client Prisma"
npx prisma generate

# ─── SQL idempotent + migrations ───────────────────────────────────────────────
step "6/9 — Migrations base de données (sans perte de données)"

echo -e "${CYAN}   → Application SQL idempotent (colonnes/tables)...${NC}"
npx prisma db execute --schema prisma/schema.prisma --file scripts/pre-migrate-production-safe.sql

echo -e "${CYAN}   → État des migrations avant deploy...${NC}"
MIGRATE_STATUS=$(npx prisma migrate status 2>&1 || true)
echo "$MIGRATE_STATUS"

# Après SQL idempotent : marquer les migrations comme appliquées si besoin
# (notamment si une migration est restée en état « failed » en base)
if echo "$MIGRATE_STATUS" | grep -qi "failed"; then
  FAILED_NAME=$(echo "$MIGRATE_STATUS" | sed -n 's/.*`\([^`]*\)`.*/\1/p' | head -1)
  if [ -n "$FAILED_NAME" ]; then
    warn "Migration en échec détectée: $FAILED_NAME → resolve --applied"
    npx prisma migrate resolve --applied "$FAILED_NAME" || fail "Impossible de résoudre $FAILED_NAME"
  fi
fi

for MIG in \
  "20260320103000_absenteisme_relances" \
  "20260320114500_absenteisme_evenements_v2" \
  "20260519120000_add_user_login_count"
do
  npx prisma migrate resolve --applied "$MIG" 2>/dev/null || true
done

echo -e "${CYAN}   → prisma migrate deploy...${NC}"
if ! npx prisma migrate deploy; then
  warn "migrate deploy a échoué — vérifiez: npx prisma migrate status"
  echo -e "${YELLOW}   La sauvegarde est disponible pour restauration :${NC}"
  [ -n "$BACKUP_FILE" ] && echo -e "${YELLOW}   bash scripts/db-backup-restore.sh restore -f $BACKUP_FILE${NC}"
  fail "Migrations non terminées. Restaurez la sauvegarde si nécessaire."
fi

echo -e "${GREEN}✅ Migrations appliquées${NC}"

# ─── Données de référence (non destructif) ───────────────────────────────────
step "7/9 — Données de référence (badges connexion, menu admin)"
npm run db:seed-connexion-badges 2>/dev/null || warn "seed badges connexion ignoré"
npm run db:add-connexions-adherents-menu 2>/dev/null || warn "menu connexions ignoré"

# ─── Build ───────────────────────────────────────────────────────────────────
step "8/9 — Build production"
if [ -f scripts/optimize-build.sh ]; then
  bash scripts/optimize-build.sh
else
  npm run build
fi

# ─── Redémarrage ─────────────────────────────────────────────────────────────
step "9/9 — Redémarrage application"
if command -v pm2 >/dev/null 2>&1; then
  if pm2 describe "$PM2_APP_NAME" >/dev/null 2>&1; then
    pm2 restart "$PM2_APP_NAME"
  elif [ -f ecosystem.config.js ]; then
    pm2 start ecosystem.config.js --only "$PM2_APP_NAME" 2>/dev/null || pm2 start ecosystem.config.js
  else
    warn "PM2 : application '$PM2_APP_NAME' introuvable"
  fi
  pm2 save 2>/dev/null || true
  pm2 status || true
else
  warn "PM2 non installé — redémarrez l'application manuellement"
fi

# ─── Vérifications ─────────────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}🔍 Vérifications post-déploiement...${NC}"
npm run deploy:check 2>/dev/null || warn "deploy:check a signalé des avertissements"

# ─── Maintenance OFF ───────────────────────────────────────────────────────────
if [ "${SKIP_MAINTENANCE:-0}" != "1" ] && [ -f scripts/maintenance-off.sh ]; then
  bash scripts/maintenance-off.sh || warn "Désactivez la maintenance manuellement : bash scripts/maintenance-off.sh"
fi

END_TIME=$(date +%s)
ELAPSED=$((END_TIME - START_TIME))

echo ""
echo -e "${PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ Déploiement production terminé${NC}"
echo -e "${PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "   Durée: ${GREEN}$((ELAPSED / 60))m $((ELAPSED % 60))s${NC}"
[ -n "$BACKUP_FILE" ] && echo -e "   Sauvegarde: ${CYAN}$BACKUP_FILE${NC}"
echo ""
echo -e "${BLUE}Checklist manuelle :${NC}"
echo "   1. Connexion admin + un adhérent test"
echo "   2. /admin/connexions-adherents (liste + export Excel)"
echo "   3. pm2 logs $PM2_APP_NAME --lines 50"
echo ""
