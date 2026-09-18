#!/usr/bin/env bash
# =============================================================================
# Déploiement PRODUCTION sécurisé — AMAKI France (frais-avances aware)
#
# Ordre garanti :
#   1. Contrôles Git (cwd, fetch, SHA==origin/main, dirty, inventaire) — AVANT mutation
#   2. Préflight PM2 / flags / disque / orpheline / URLs
#   3. Maintenance ON + HTTP 503
#   4. pm2 stop amakifr + vérification stopped
#   5. Backup custom atomique (mktemp) + SHA-256 + TOC
#   6. git switch --detach EXPECTED_GIT_SHA (sans -f)
#   7. npm ci
#   8. prisma generate
#   9. build (flags off)
#  10. prisma migrate deploy
#  11. contrôles SQL post-migration
#  12. seeds si ALLOW_SEEDS=1 (STOP si échec)
#  13. pm2 restart + pm2 save (bloquant)
#  14. smoke (SMOKE_URL validée) + deploy:check
#  15. maintenance OFF uniquement si tout vert
#
# Obligatoire :
#   EXPECTED_GIT_SHA=<40 hex>   # exactement origin/main après fetch
#   MAINTENANCE_CHECK_URL=https://amaki.fr/
#   SMOKE_URL=https://amaki.fr/   # même rigueur d’hôte/schéma
#
# En échec : maintenance reste ON ; PM2 n’est pas redémarré automatiquement
# (sauf si restart déjà réussi — alors maint ON si save/smoke échoue).
# =============================================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

PM2_APP_NAME="${PM2_APP_NAME:-amakifr}"
GIT_BRANCH="${GIT_BRANCH:-main}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

# shellcheck source=lib/deploy-guards.sh
source "$SCRIPT_DIR/lib/deploy-guards.sh"

step() {
  echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${GREEN}$1${NC}"
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}
fail() {
  echo -e "${RED}❌ $1${NC}" >&2
  echo -e "${YELLOW}Maintenance reste ON (si activée). Aucun maintenance-off automatique.${NC}" >&2
  echo -e "${YELLOW}  1) Inspecter logs / état migrate${NC}" >&2
  echo -e "${YELLOW}  2) Restaurer dump SI décision humaine : bash scripts/db-backup-restore.sh restore ...${NC}" >&2
  echo -e "${YELLOW}  3) Ne pas relancer un process contre un schéma incompatible sans décision${NC}" >&2
  echo -e "${YELLOW}  4) pm2 restart ${PM2_APP_NAME} seulement après plan validé${NC}" >&2
  echo -e "${YELLOW}  5) Ne jamais modifier _prisma_migrations sans procédure DBA${NC}" >&2
  exit 1
}

# Échec après restart réussi mais avant maintenance OFF (ex. pm2 save).
fail_after_restart() {
  echo -e "${RED}❌ $1${NC}" >&2
  echo -e "${YELLOW}Le processus PM2 a redémarré, mais la suite a échoué.${NC}" >&2
  echo -e "${YELLOW}Persistance PM2 non garantie si pm2 save a échoué. Maintenance reste ON.${NC}" >&2
  echo -e "${YELLOW}Ne pas faire maintenance-off sans décision humaine.${NC}" >&2
  exit 1
}

BACKUP_FILE=""
SHA_FILE=""
MAINTENANCE_ON=0
PM2_STOPPED=0
PM2_RESTARTED=0

on_err() {
  echo -e "${RED}ÉCHEC — maintenance reste ON (si activée). Aucun redémarrage/maint-off auto.${NC}" >&2
}
trap on_err ERR

echo -e "${PURPLE}🚀 Déploiement production SÉCURISÉ${NC}"
echo -e "${CYAN}Répertoire: $ROOT_DIR | PM2: $PM2_APP_NAME | branche: $GIT_BRANCH${NC}"

[[ -f package.json ]] || fail "Exécutez depuis la racine du projet."
[[ -f .env ]] || fail "Fichier .env manquant."

# shellcheck disable=SC1091
set -a
source .env
set +a
[[ -n "${DATABASE_URL:-}" ]] || fail "DATABASE_URL non défini (valeur non affichée)."

[[ -n "${EXPECTED_GIT_SHA:-}" ]] || fail "EXPECTED_GIT_SHA obligatoire (40 hex)."
[[ -n "${MAINTENANCE_CHECK_URL:-}" ]] || fail "MAINTENANCE_CHECK_URL obligatoire."
[[ -n "${SMOKE_URL:-}" ]] || fail "SMOKE_URL obligatoire."

if [[ "$PM2_APP_NAME" != "amakifr" ]]; then
  fail "PM2_APP_NAME doit être 'amakifr' (reçu: $PM2_APP_NAME)"
fi

BACKUP_DIR="${BACKUP_DIR:-./backups}"
assert_backup_dir_safe "$BACKUP_DIR" || fail "BACKUP_DIR invalide"
# umask restrictif (mkdir backup plus tard, après contrôles Git)
umask 077

echo ""
echo -e "${YELLOW}Ce script va exécuter un déploiement destructif potentiel (migrate).${NC}"
if [[ "${ASSUME_YES:-}" != "1" ]]; then
  read -r -p "Continuer ? (o/N) " -n 1 REPLY
  echo ""
  [[ "${REPLY:-}" =~ ^[OoYy]$ ]] || { echo "Annulé."; exit 0; }
fi

START_TIME=$(date +%s)

# ─── 1. Contrôles Git AVANT toute mutation (pas de maint / stop / dump) ───────
step "1/15 — Contrôles Git (avant maintenance / PM2 / backup)"
if [[ "${OVERRIDE_GIT_CWD_CHECK:-}" != "1" ]]; then
  assert_git_cwd "/sites/amakifr" || fail "cwd Git production"
fi
[[ -d .git ]] || fail "Pas de dépôt Git"
assert_git_workdir_clean || fail "Tracked/index dirty — abandon sans indisponibilité"
echo -e "${CYAN}Fichiers non suivis (inventaire, non supprimés) :${NC}"
inventory_git_untracked | sed 's/^/  ?? /' || true

assert_git_sha_format "$EXPECTED_GIT_SHA" || fail "Format EXPECTED_GIT_SHA"
git fetch origin "$GIT_BRANCH" || fail "git fetch a échoué"
assert_git_sha_exists "$EXPECTED_GIT_SHA" || fail "SHA inexistant"
assert_git_sha_is_origin_main "$EXPECTED_GIT_SHA" "$GIT_BRANCH" || fail "SHA != origin/${GIT_BRANCH}"
echo -e "${GREEN}✅ Contrôles Git OK (pas encore de checkout)${NC}"

# ─── 2. Préflight runtime ────────────────────────────────────────────────────
step "2/15 — Préflight (PM2 / flags / disque / orpheline / URLs)"
assert_orphan_migration_absent || fail "Dossier orphelin présent"
assert_maintenance_url_shape "$MAINTENANCE_CHECK_URL" || fail "URL maintenance invalide"
assert_smoke_url_shape "$SMOKE_URL" || fail "SMOKE_URL invalide"
assert_pm2_process_exists "$PM2_APP_NAME" || fail "Préflight PM2"
assert_pm2_cwd "$PM2_APP_NAME" "/sites/amakifr" || fail "Préflight cwd PM2"
assert_notes_frais_flags_off "$PM2_APP_NAME" || fail "Préflight flags"
AVAIL_KB="$(df -Pk . | awk 'NR==2{print $4}')"
[[ "${AVAIL_KB:-0}" -gt 1048576 ]] || fail "Espace disque insuffisant (<1 Go libre)"
mkdir -p "$BACKUP_DIR"
echo -e "${GREEN}✅ Préflight OK${NC}"

# ─── 3. Maintenance ON + 503 ─────────────────────────────────────────────────
step "3/15 — Maintenance ON + HTTP 503"
[[ -f scripts/maintenance-on.sh ]] || fail "scripts/maintenance-on.sh manquant"
if [[ "${ASSUME_YES:-}" == "1" ]]; then
  yes o | head -1 | bash scripts/maintenance-on.sh || fail "maintenance-on a échoué"
else
  bash scripts/maintenance-on.sh || fail "maintenance-on a échoué"
fi
MAINTENANCE_ON=1
[[ -f maintenance.flag ]] || fail "maintenance.flag absent après activation"
assert_maintenance_http "$MAINTENANCE_CHECK_URL" || fail "Maintenance non vérifiée (503 requis)"
echo -e "${GREEN}✅ Maintenance active et vérifiée (503)${NC}"

# ─── 4. Gel PM2 réel ─────────────────────────────────────────────────────────
step "4/15 — pm2 stop amakifr (gel réel des écritures)"
pm2 stop "$PM2_APP_NAME" || fail "pm2 stop a échoué"
PM2_STOPPED=1
sleep 1
assert_pm2_stopped "$PM2_APP_NAME" || fail "PM2 non stopped après stop"
echo -e "${GREEN}✅ PM2 amakifr stopped — mutations autorisées${NC}"

# ─── 5. Backup atomique ──────────────────────────────────────────────────────
step "5/15 — Sauvegarde custom atomique (mktemp) + SHA-256 + TOC"
export DATABASE_URL
export BACKUP_DIR
BACKUP_FILE="$(
  bash scripts/db-backup-restore.sh backup -t custom -b "$BACKUP_DIR" --print-path
)" || fail "Échec sauvegarde"
[[ -n "$BACKUP_FILE" ]] || fail "Chemin dump vide"
assert_backup_file_ok "$BACKUP_FILE" || fail "Dump invalide"
SHA_FILE="${BACKUP_FILE}.sha256"
assert_sha256_file_matches "$BACKUP_FILE" "$SHA_FILE" || fail "Checksum"
assert_pg_restore_toc "$BACKUP_FILE" || fail "TOC"
echo -e "${GREEN}✅ Dump OK: $(basename "$BACKUP_FILE") (+ .sha256)${NC}"

# ─── 6. Checkout (après dump) ────────────────────────────────────────────────
step "6/15 — git switch --detach EXPECTED_GIT_SHA (sans -f)"
assert_git_workdir_clean || fail "Tracked/index dirty avant checkout"
if ! git switch --detach "$EXPECTED_GIT_SHA"; then
  fail "git switch --detach a échoué (conflits locaux ?)"
fi
assert_expected_git_sha "$EXPECTED_GIT_SHA" || fail "SHA après checkout"
assert_orphan_migration_absent || fail "Orpheline réapparue après checkout"
echo -e "${GREEN}✅ Code à $EXPECTED_GIT_SHA (origin/${GIT_BRANCH})${NC}"

# ─── 7–9. deps / generate / build ────────────────────────────────────────────
step "7/15 — npm ci"
npm ci || fail "npm ci"

step "8/15 — prisma generate"
npx prisma generate || fail "prisma generate"

step "9/15 — build (flags off)"
assert_notes_frais_flags_off "$PM2_APP_NAME" || fail "flags avant build"
if [[ -f scripts/optimize-build.sh ]]; then
  bash scripts/optimize-build.sh || fail "build"
else
  npm run build || fail "build"
fi
echo -e "${GREEN}✅ Build OK — migrate autorisé${NC}"

# ─── 10. migrate deploy ──────────────────────────────────────────────────────
step "10/15 — prisma migrate deploy"
if [[ -f scripts/pre-migrate-production-safe.sql ]]; then
  npx prisma db execute --schema prisma/schema.prisma --file scripts/pre-migrate-production-safe.sql \
    || fail "pre-migrate SQL a échoué"
fi
if ! npx prisma migrate deploy; then
  echo -e "${YELLOW}Dump disponible: $BACKUP_FILE${NC}"
  fail "migrate deploy a échoué"
fi
echo -e "${GREEN}✅ Migrations appliquées${NC}"

# ─── 11. Contrôles SQL ───────────────────────────────────────────────────────
step "11/15 — Contrôles SQL post-migration"
URL_SAFE="${DATABASE_URL%%\?*}"
psql "$URL_SAFE" -v ON_ERROR_STOP=1 -Atc "
SELECT CASE WHEN to_regclass('public._prisma_migrations') IS NULL THEN 'FAIL' ELSE 'OK' END;
" | grep -q OK || fail "_prisma_migrations absente"
if [[ -d prisma/migrations/20260918130000_notes_frais_4x10_retention_policies_legal_hold ]]; then
  psql "$URL_SAFE" -v ON_ERROR_STOP=1 -Atc "
  SELECT CASE WHEN to_regclass('public.notes_frais_retention_policy_versions') IS NULL THEN 'MISS' ELSE 'OK' END;
  " | grep -q OK || fail "table retention 4.10 absente après migrate"
fi
echo -e "${GREEN}✅ Contrôles SQL OK${NC}"

# ─── 12. Seeds ───────────────────────────────────────────────────────────────
step "12/15 — Seeds (ALLOW_SEEDS=1 requis ; échec = STOP)"
if [[ "${ALLOW_SEEDS:-0}" == "1" ]]; then
  npm run db:seed-connexion-badges || fail "seed badges"
  npm run db:add-connexions-adherents-menu || fail "menu connexions"
  if [[ -f scripts/frais-avances-menus-upsert.ts ]]; then
    npx tsx scripts/frais-avances-menus-upsert.ts || fail "menus frais"
  fi
else
  echo "Seeds ignorés (ALLOW_SEEDS!=1) — OK"
fi

# ─── 13. Restart + pm2 save bloquant ─────────────────────────────────────────
step "13/15 — Restart PM2 + pm2 save (bloquant)"
assert_notes_frais_flags_off "$PM2_APP_NAME" || fail "flags avant restart"
pm2 restart "$PM2_APP_NAME" --update-env || fail "pm2 restart"
PM2_RESTARTED=1
PM2_STOPPED=0
if ! pm2 save; then
  fail_after_restart "pm2 save a échoué — process redémarré, persistance PM2 non garantie"
fi

# ─── 14. Smoke ───────────────────────────────────────────────────────────────
step "14/15 — Smoke (SMOKE_URL validée) — STOP si échec"
assert_smoke_url_shape "$SMOKE_URL" || fail_after_restart "SMOKE_URL invalide après restart"
assert_notes_frais_flags_off "$PM2_APP_NAME" || fail_after_restart "flags après restart"
sleep 2
if ! command -v curl >/dev/null 2>&1; then
  fail_after_restart "curl introuvable pour smoke"
fi
code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 20 "$SMOKE_URL" || echo 000)"
[[ "$code" =~ ^(200|301|302|303|307|308)$ ]] || fail_after_restart "SMOKE_URL HTTP=$code"
npm run deploy:check || fail_after_restart "deploy:check a échoué"
echo -e "${GREEN}✅ Smoke flags off OK${NC}"

# ─── 15. Maintenance OFF ─────────────────────────────────────────────────────
step "15/15 — Maintenance OFF"
if [[ -f scripts/maintenance-off.sh ]]; then
  if [[ "${ASSUME_YES:-}" == "1" ]]; then
    yes o | head -1 | bash scripts/maintenance-off.sh || fail_after_restart "maintenance-off"
  else
    bash scripts/maintenance-off.sh || fail_after_restart "maintenance-off"
  fi
else
  fail_after_restart "maintenance-off.sh manquant"
fi
MAINTENANCE_ON=0

END_TIME=$(date +%s)
ELAPSED=$((END_TIME - START_TIME))
echo ""
echo -e "${GREEN}✅ Déploiement terminé en $((ELAPSED / 60))m $((ELAPSED % 60))s${NC}"
echo -e "   Dump: ${CYAN}$BACKUP_FILE${NC}"
echo -e "   SHA : ${CYAN}${SHA_FILE}${NC}"
echo ""
