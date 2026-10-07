#!/usr/bin/env bash
# =============================================================================
# Déploiement PRODUCTION sécurisé — AMAKI France (frais-avances aware)
#
# Ordre garanti :
#   1. Contrôles Git (cwd, fetch, SHA==origin/main, dirty, inventaire) — AVANT mutation
#   2. Préflight : HMAC, TRUST_PROXY, Nginx EFFECTIVE (nginx -T), PM2 / flags / URLs
#      (écoute live ss NON exigée ici — l'ancienne prod peut encore être sur 0.0.0.0)
#   3. Maintenance ON + HTTP 503
#   4. pm2 stop amakifr + vérification stopped
#   5. Backup custom atomique (mktemp) + SHA-256 + TOC
#   6. git switch --detach EXPECTED_GIT_SHA (sans -f)
#   7. npm ci
#   8. prisma generate
#   9. build (flags Notes de frais actifs)
#  10. prisma migrate deploy
#  11. contrôles SQL post-migration
#  12. seeds si ALLOW_SEEDS=1 (STOP si échec)
#  13. pm2 restart (écoute 127.0.0.1:9060) + pm2 save (bloquant)
#  14. garde live ss (loopback only) + smoke interne ; puis smoke public
#  15. maintenance OFF uniquement si tout vert
# Ne copie JAMAIS automatiquement deploy/nginx/amaki.conf vers /etc/nginx.
# Fermeture firewalld 9060/tcp : étape humaine séparée (non exécutée ici).
#
# Obligatoire :
#   EXPECTED_GIT_SHA=<40 hex>   # exactement origin/main après fetch
#   MAINTENANCE_CHECK_URL=https://amaki.fr/
#   SMOKE_URL=https://amaki.fr/   # même rigueur d’hôte/schéma
#   INTERNAL_SMOKE_URL=http://127.0.0.1:9060/  # port PM2 vérifié sur le VPS
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
SCRIPT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd -P)"
ROOT_DIR="$(cd "${DEPLOY_APP_ROOT:-$SCRIPT_ROOT}" && pwd -P)"
if [[ "$ROOT_DIR" != "/sites/amakifr" ]]; then
  echo "Refus: DEPLOY_APP_ROOT doit désigner /sites/amakifr (répertoire applicatif)." >&2
  exit 1
fi
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

fail_after_release() {
  local reason="$1"
  echo -e "${RED}$reason — remise en maintenance${NC}" >&2
  if ! printf 'o\n' | bash scripts/maintenance-on.sh; then
    fail_after_restart "CRITIQUE : impossible de réactiver la maintenance"
  fi
  assert_maintenance_http "$MAINTENANCE_CHECK_URL" || fail_after_restart "CRITIQUE : nginx ne renvoie pas 503"
  fail_after_restart "$reason ; nginx repassé en maintenance"
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
[[ -n "${INTERNAL_SMOKE_URL:-}" ]] || fail "INTERNAL_SMOKE_URL obligatoire."

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
assert_git_cwd "/sites/amakifr" || fail "cwd Git production"
[[ -d .git ]] || fail "Pas de dépôt Git"
assert_git_workdir_clean || fail "Tracked/index dirty — abandon sans indisponibilité"
echo -e "${CYAN}Fichiers non suivis (inventaire, non supprimés) :${NC}"
inventory_git_untracked | sed 's/^/  ?? /' || true

assert_git_sha_format "$EXPECTED_GIT_SHA" || fail "Format EXPECTED_GIT_SHA"
git fetch origin "$GIT_BRANCH" || fail "git fetch a échoué"
assert_git_sha_exists "$EXPECTED_GIT_SHA" || fail "SHA inexistant"
assert_git_sha_is_origin_main "$EXPECTED_GIT_SHA" "$GIT_BRANCH" || fail "SHA != origin/${GIT_BRANCH}"
assert_deploy_source_checkout "$SCRIPT_ROOT" "$ROOT_DIR" "$EXPECTED_GIT_SHA" || fail "Source du script != commit cible du dépôt applicatif"
echo -e "${GREEN}✅ Contrôles Git OK (pas encore de checkout)${NC}"

# ─── 2. Préflight runtime ────────────────────────────────────────────────────
step "2/15 — Préflight (PM2 / flags / disque / orpheline / URLs)"
assert_orphan_migration_absent || fail "Dossier orphelin présent"
assert_maintenance_url_shape "$MAINTENANCE_CHECK_URL" || fail "URL maintenance invalide"
assert_smoke_url_shape "$SMOKE_URL" || fail "SMOKE_URL invalide"
assert_internal_smoke_url_shape "$INTERNAL_SMOKE_URL" || fail "URL smoke interne invalide"
assert_pm2_process_exists "$PM2_APP_NAME" || fail "Préflight PM2"
assert_pm2_cwd "$PM2_APP_NAME" "/sites/amakifr" || fail "Préflight cwd PM2"
assert_notes_frais_flags_on "$PM2_APP_NAME" || fail "Préflight flags Notes de frais actifs"
assert_notes_frais_storage_ready || fail "Préflight stockage Notes de frais"
assert_password_reset_hmac_secret_ready || fail "Préflight PASSWORD_RESET_HMAC_SECRET"
assert_next_prod_start_binds_loopback || fail "Préflight bind Next 127.0.0.1:9060 (package.json)"
assert_nginx_prod_x_real_ip_configured || fail "Préflight référence dépôt deploy/nginx/amaki.conf"
assert_nginx_effective_amaki_proxy_headers || fail "Préflight Nginx EFFECTIVE (nginx -T) amaki.fr → 9060"
assert_password_reset_trust_proxy_ready || fail "Préflight TRUST_PROXY (nécessite Nginx effective)"
AVAIL_KB="$(df -Pk . | awk 'NR==2{print $4}')"
[[ "${AVAIL_KB:-0}" -gt 1048576 ]] || fail "Espace disque insuffisant (<1 Go libre)"
mkdir -p "$BACKUP_DIR"
echo -e "${GREEN}✅ Préflight OK${NC}"

# ─── 3. Maintenance ON + 503 ─────────────────────────────────────────────────
step "3/15 — Maintenance ON + HTTP 503"
[[ -f scripts/maintenance-on.sh ]] || fail "scripts/maintenance-on.sh manquant"
if [[ "${ASSUME_YES:-}" == "1" ]]; then
  printf 'o\n' | bash scripts/maintenance-on.sh || fail "maintenance-on a échoué"
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
  bash "$SCRIPT_DIR/db-backup-restore.sh" backup -t custom -b "$BACKUP_DIR" --print-path
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

step "9/15 — build (flags Notes de frais actifs)"
assert_notes_frais_flags_on "$PM2_APP_NAME" || fail "flags actifs avant build"
assert_password_reset_hmac_secret_ready || fail "PASSWORD_RESET_HMAC_SECRET avant build"
assert_password_reset_trust_proxy_ready || fail "TRUST_PROXY avant build"
# nginx maintient le 503 public ; le build et PM2 doivent servir normalement
# en interne pour pouvoir être vérifiés avant d'ouvrir nginx.
export MAINTENANCE_MODE=false
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
  psql "$URL_SAFE" -v ON_ERROR_STOP=1 -Atc "
  SELECT CASE WHEN
    (SELECT count(*) FROM public._prisma_migrations
     WHERE migration_name IN (
       '20260918120000_notes_frais_4x_foundation',
       '20260918120100_notes_frais_4x_backfill_seed',
       '20260918120200_notes_frais_4x_integrity',
       '20260918130000_notes_frais_4x10_retention_policies_legal_hold'
     ) AND finished_at IS NOT NULL AND rolled_back_at IS NULL) = 4
    AND NOT EXISTS (SELECT 1 FROM public._prisma_migrations
                    WHERE finished_at IS NULL AND rolled_back_at IS NULL)
    AND (SELECT count(*) FROM public.notes_frais_retention_policy_versions
         WHERE statut = 'ACTIVE') = 1
  THEN 'OK' ELSE 'FAIL' END;
  " | grep -qx OK || fail "migrations 4.x / politique ACTIVE invalides"
fi
echo -e "${GREEN}✅ Contrôles SQL OK${NC}"

# ─── 12. Seeds ───────────────────────────────────────────────────────────────
step "12/15 — Seeds (ALLOW_SEEDS=1 requis ; échec = STOP)"
if [[ "${ALLOW_SEEDS:-0}" == "1" ]]; then
  npm run db:seed-connexion-badges || fail "seed badges"
  npm run db:add-connexions-adherents-menu || fail "menu connexions"
  [[ -f scripts/frais-avances-menus-seed.ts ]] || fail "script menus frais absent"
  npx tsx scripts/frais-avances-menus-seed.ts || fail "menus frais"
else
  echo "Seeds ignorés (ALLOW_SEEDS!=1) — OK"
fi

# ─── 13. Restart + pm2 save bloquant ─────────────────────────────────────────
step "13/15 — Restart PM2 + pm2 save (bloquant)"
assert_notes_frais_flags_on "$PM2_APP_NAME" || fail "flags actifs avant restart"
assert_password_reset_hmac_secret_ready || fail "PASSWORD_RESET_HMAC_SECRET avant restart"
assert_next_prod_start_binds_loopback || fail "bind Next avant restart"
assert_nginx_effective_amaki_proxy_headers || fail "Nginx effective avant restart"
# Pas de garde ss ici : l'ancienne écoute 0.0.0.0 peut encore être active avant restart
assert_password_reset_trust_proxy_ready || fail "TRUST_PROXY avant restart"
MAINTENANCE_MODE=false pm2 restart "$PM2_APP_NAME" --update-env || fail "pm2 restart"
PM2_RESTARTED=1
PM2_STOPPED=0
if ! pm2 save; then
  fail_after_restart "pm2 save a échoué — process redémarré, persistance PM2 non garantie"
fi

# ─── 14. Garde live ss + smoke interne (sous nginx 503) ──────────────────────
step "14/15 — Écoute loopback + smoke interne — STOP si échec"
assert_smoke_url_shape "$SMOKE_URL" || fail_after_restart "SMOKE_URL invalide après restart"
assert_internal_smoke_url_shape "$INTERNAL_SMOKE_URL" || fail_after_restart "URL interne invalide après restart"
assert_notes_frais_flags_on "$PM2_APP_NAME" || fail_after_restart "flags actifs après restart (PM2)"
sleep 2
if ! command -v curl >/dev/null 2>&1; then
  fail_after_restart "curl introuvable pour smoke"
fi
assert_maintenance_http "$MAINTENANCE_CHECK_URL" || fail_after_restart "nginx n'est plus en maintenance"
# Obligatoire APRÈS restart et AVANT maintenance-off
assert_next_prod_listen_loopback_only || fail_after_restart "écoute Next non loopback (9060 exposé?)"
ASSERT_NEXT_PROD_LISTEN=1 assert_password_reset_trust_proxy_ready || fail_after_restart "TRUST_PROXY / chaîne proxy après restart"
if ! code="$(wait_for_http_ready "$INTERNAL_SMOKE_URL" 6 20 5)"; then
  fail_after_restart "smoke interne épuisé après 6 tentatives ; dernier HTTP=$code"
fi
echo -e "${GREEN}✅ Application vérifiée en interne (HTTP=$code) ; bind 127.0.0.1:9060 OK ; nginx toujours à 503${NC}"
# Firewalld 9060/tcp : NE PAS exécuter ici — étape humaine contrôlée (voir docs/auth/PASSWORD-RESET.txt)

# ─── 15. Maintenance OFF ─────────────────────────────────────────────────────
step "15/15 — Maintenance OFF"
if [[ -f scripts/maintenance-off.sh ]]; then
  if [[ "${ASSUME_YES:-}" == "1" ]]; then
    printf 'o\n' | bash scripts/maintenance-off.sh || fail_after_release "maintenance-off a échoué"
  else
    bash scripts/maintenance-off.sh || fail_after_release "maintenance-off a échoué"
  fi
else
  fail_after_release "maintenance-off.sh manquant"
fi
[[ ! -f maintenance.flag ]] || fail_after_release "maintenance.flag encore présent"

# Si le smoke public échoue après ouverture, nginx repasse immédiatement à 503.
code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 20 "$SMOKE_URL" || echo 000)"
if [[ ! "$code" =~ ^(200|301|302|303|307|308)$ ]]; then
  fail_after_release "Smoke public HTTP=$code en échec"
fi
MAINTENANCE_ON=0

END_TIME=$(date +%s)
ELAPSED=$((END_TIME - START_TIME))
echo ""
echo -e "${GREEN}✅ Déploiement terminé en $((ELAPSED / 60))m $((ELAPSED % 60))s${NC}"
echo -e "   Dump: ${CYAN}$BACKUP_FILE${NC}"
echo -e "   SHA : ${CYAN}${SHA_FILE}${NC}"
echo ""
