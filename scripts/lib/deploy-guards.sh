#!/usr/bin/env bash
# Gardes de déploiement production (sourçables par deploy-production-safe et tests).
# Aucun secret affiché. Aucune mutation DB ici.

# shellcheck disable=SC2034

DEPLOY_GUARDS_VERSION=2

# Checksum historique de la ligne orpheline (référence documentaire uniquement).
# Le dossier migration.sql correspondant NE DOIT PAS être présent dans le dépôt.
ORPHAN_MIGRATION_NAME="20251204181751_add_unique_adherent_assistance_periode"
ORPHAN_MIGRATION_CHECKSUM="e352963e4d64ba9980bb25f45d60604dee386cefc95c7bfd73e15c495a7fe512"
EXPECTED_PROD_GIT_CWD="/sites/amakifr"
EXPECTED_PM2_APP_NAME="amakifr"

fail_guard() {
  echo "FATAL_GUARD: $*" >&2
  return 1
}

# ---------------------------------------------------------------------------
# PM2
# ---------------------------------------------------------------------------

# Usage: assert_pm2_process_exists amakifr
assert_pm2_process_exists() {
  local name="${1:-}"
  if [[ -z "$name" ]]; then
    fail_guard "nom PM2 vide"
    return 1
  fi
  if [[ "$name" != "$EXPECTED_PM2_APP_NAME" ]]; then
    fail_guard "PM2 name '$name' interdit — utiliser '$EXPECTED_PM2_APP_NAME'"
    return 1
  fi
  if ! command -v pm2 >/dev/null 2>&1; then
    fail_guard "pm2 introuvable"
    return 1
  fi
  if ! pm2 describe "$name" >/dev/null 2>&1; then
    fail_guard "processus PM2 '$name' introuvable"
    return 1
  fi
  return 0
}

# Vérifie que le cwd PM2 du process est exactement le chemin attendu.
# Usage: assert_pm2_cwd amakifr /sites/amakifr
assert_pm2_cwd() {
  local name="${1:-}"
  local expected_cwd="${2:-$EXPECTED_PROD_GIT_CWD}"
  if [[ -z "$name" || -z "$expected_cwd" ]]; then
    fail_guard "assert_pm2_cwd: arguments manquants"
    return 1
  fi
  if [[ "$name" != "$EXPECTED_PM2_APP_NAME" ]]; then
    fail_guard "PM2 name '$name' interdit"
    return 1
  fi
  if ! command -v pm2 >/dev/null 2>&1; then
    fail_guard "pm2 introuvable"
    return 1
  fi
  local desc cwd
  desc="$(pm2 describe "$name" 2>/dev/null || true)"
  if [[ -z "$desc" ]]; then
    fail_guard "processus PM2 '$name' introuvable"
    return 1
  fi
  # pm2 describe affiche une ligne « exec cwd » / « cwd »
  cwd="$(echo "$desc" | awk -F'│' '
    tolower($0) ~ /exec cwd/ || tolower($0) ~ /^[[:space:]]*cwd/ {
      v = $3
      gsub(/^[[:space:]]+|[[:space:]]+$/, "", v)
      print v
      exit
    }
  ')"
  if [[ -z "$cwd" ]]; then
    cwd="$(pm2 jlist 2>/dev/null | python3 -c '
import json,sys
name=sys.argv[1]
data=json.load(sys.stdin)
for p in data:
  if p.get("name")==name:
    print((p.get("pm2_env") or {}).get("pm_cwd") or "")
    break
' "$name" 2>/dev/null || true)"
  fi
  if [[ -z "$cwd" ]]; then
    fail_guard "cwd PM2 '$name' illisible"
    return 1
  fi
  if [[ "$cwd" != "$expected_cwd" ]]; then
    fail_guard "cwd PM2 '$name'='$cwd' != attendu '$expected_cwd'"
    return 1
  fi
  return 0
}

# Vérifie que le process est stopped (ou stopping → refus tant que non stopped).
assert_pm2_stopped() {
  local name="${1:-}"
  if [[ "$name" != "$EXPECTED_PM2_APP_NAME" ]]; then
    fail_guard "PM2 name '$name' interdit"
    return 1
  fi
  if ! command -v pm2 >/dev/null 2>&1; then
    fail_guard "pm2 introuvable"
    return 1
  fi
  local status
  status="$(pm2 jlist 2>/dev/null | python3 -c '
import json,sys
name=sys.argv[1]
data=json.load(sys.stdin)
for p in data:
  if p.get("name")==name:
    print((p.get("pm2_env") or {}).get("status") or "")
    break
' "$name" 2>/dev/null || true)"
  if [[ "$status" != "stopped" ]]; then
    fail_guard "PM2 '$name' status='$status' (attendu stopped)"
    return 1
  fi
  return 0
}

# ---------------------------------------------------------------------------
# Flags NOTES_FRAIS
# ---------------------------------------------------------------------------

# Lit une clé KEY=value dans un fichier env sans echo des autres clés.
# Affiche uniquement : ABSENT | EMPTY | true | false | OTHER_NON_TRUE
read_env_flag_status() {
  local file="$1" key="$2"
  if [[ ! -f "$file" ]]; then
    echo "ABSENT"
    return 0
  fi
  local line
  line="$(grep -E "^[[:space:]]*${key}=" "$file" 2>/dev/null | head -1 || true)"
  if [[ -z "$line" ]]; then
    echo "ABSENT"
    return 0
  fi
  local val="${line#*=}"
  val="${val%$'\r'}"
  val="${val#\"}"
  val="${val%\"}"
  val="${val#\'}"
  val="${val%\'}"
  val="$(echo "$val" | tr -d '[:space:]')"
  if [[ -z "$val" ]]; then
    echo "EMPTY"
  elif [[ "$val" == "true" ]]; then
    echo "true"
  elif [[ "$val" == "false" ]]; then
    echo "false"
  else
    echo "OTHER_NON_TRUE"
  fi
}

# STOP si NOTES_FRAIS_ENABLED ou NEXT_PUBLIC_NOTES_FRAIS_ENABLED == true
assert_notes_frais_flags_off() {
  local pm2_name="${1:-}"
  local f status key
  if [[ "${NOTES_FRAIS_ENABLED:-}" == "true" ]]; then
    fail_guard "shell NOTES_FRAIS_ENABLED=true"
    return 1
  fi
  if [[ "${NEXT_PUBLIC_NOTES_FRAIS_ENABLED:-}" == "true" ]]; then
    fail_guard "shell NEXT_PUBLIC_NOTES_FRAIS_ENABLED=true"
    return 1
  fi
  for f in .env .env.local .env.production; do
    for key in NOTES_FRAIS_ENABLED NEXT_PUBLIC_NOTES_FRAIS_ENABLED; do
      status="$(read_env_flag_status "$f" "$key")"
      if [[ "$status" == "true" ]]; then
        fail_guard "fichier $f : $key=true"
        return 1
      fi
    done
  done
  if [[ -n "$pm2_name" ]] && command -v pm2 >/dev/null 2>&1; then
    local dump
    dump="$(pm2 env "$(pm2 id "$pm2_name" 2>/dev/null | head -1)" 2>/dev/null || true)"
    for key in NOTES_FRAIS_ENABLED NEXT_PUBLIC_NOTES_FRAIS_ENABLED; do
      if echo "$dump" | grep -E "^${key}:[[:space:]]*true$" >/dev/null 2>&1 \
        || echo "$dump" | grep -E "^${key}=true$" >/dev/null 2>&1; then
        fail_guard "PM2 $pm2_name : $key=true"
        return 1
      fi
    done
  fi
  return 0
}

# ---------------------------------------------------------------------------
# Git / SHA
# ---------------------------------------------------------------------------

# EXPECTED_GIT_SHA exactement 40 hex.
assert_git_sha_format() {
  local expected="${1:-}"
  if [[ -z "$expected" ]]; then
    fail_guard "EXPECTED_GIT_SHA obligatoire"
    return 1
  fi
  if [[ ! "$expected" =~ ^[0-9a-fA-F]{40}$ ]]; then
    fail_guard "EXPECTED_GIT_SHA doit être exactement 40 caractères hexadécimaux"
    return 1
  fi
  return 0
}

# SHA existe comme commit dans le dépôt local.
assert_git_sha_exists() {
  local expected="${1:-}"
  assert_git_sha_format "$expected" || return 1
  if ! git rev-parse --verify "${expected}^{commit}" >/dev/null 2>&1; then
    fail_guard "EXPECTED_GIT_SHA introuvable comme commit: $expected"
    return 1
  fi
  return 0
}

# Politique restrictive : EXPECTED_GIT_SHA doit être exactement origin/main.
assert_git_sha_is_origin_main() {
  local expected="${1:-}"
  local branch="${2:-main}"
  assert_git_sha_format "$expected" || return 1
  local remote_sha
  remote_sha="$(git rev-parse --verify "origin/${branch}" 2>/dev/null || true)"
  if [[ -z "$remote_sha" ]]; then
    fail_guard "origin/${branch} introuvable (fetch requis)"
    return 1
  fi
  if [[ "$expected" != "$remote_sha" ]]; then
    fail_guard "EXPECTED_GIT_SHA ($expected) != origin/${branch} ($remote_sha)"
    return 1
  fi
  return 0
}

# HEAD == EXPECTED_GIT_SHA (après checkout).
assert_expected_git_sha() {
  local expected="${1:-}"
  assert_git_sha_format "$expected" || return 1
  local full_head
  full_head="$(git rev-parse HEAD 2>/dev/null || true)"
  if [[ -z "$full_head" ]]; then
    fail_guard "git HEAD introuvable"
    return 1
  fi
  if [[ "$full_head" != "$expected" ]]; then
    fail_guard "HEAD ($full_head) != EXPECTED_GIT_SHA ($expected)"
    return 1
  fi
  return 0
}

# Refus tracked dirty + index dirty (untracked ?? et ignored !! tolérés).
assert_git_workdir_clean() {
  local dirty
  dirty="$(git status --porcelain=v1 2>/dev/null | grep -vE '^\?\?|^!!' || true)"
  if [[ -n "$dirty" ]]; then
    fail_guard "arbre Git tracked/index dirty — déployer interdit"
    return 1
  fi
  return 0
}

# Inventorie les untracked sans les supprimer (stdout).
inventory_git_untracked() {
  git status --porcelain=v1 2>/dev/null | awk '/^\?\?/ {print substr($0,4)}' || true
}

# Cwd Git de production.
assert_git_cwd() {
  local expected="${1:-$EXPECTED_PROD_GIT_CWD}"
  local actual
  actual="$(pwd -P 2>/dev/null || pwd)"
  if [[ "$actual" != "$expected" ]]; then
    fail_guard "cwd Git '$actual' != attendu '$expected'"
    return 1
  fi
  return 0
}

# ---------------------------------------------------------------------------
# Backup / checksum / TOC
# ---------------------------------------------------------------------------

assert_backup_file_ok() {
  local file="${1:-}"
  if [[ -z "$file" || ! -f "$file" ]]; then
    fail_guard "dump introuvable"
    return 1
  fi
  if [[ ! -s "$file" ]]; then
    fail_guard "dump vide"
    return 1
  fi
  return 0
}

assert_sha256_file_matches() {
  local file="${1:-}" sha_file="${2:-}"
  if [[ ! -f "$file" || ! -f "$sha_file" ]]; then
    fail_guard "fichier ou .sha256 manquant"
    return 1
  fi
  local expected actual
  expected="$(awk '{print $1; exit}' "$sha_file")"
  actual="$(sha256sum "$file" | awk '{print $1}')"
  if [[ "$expected" != "$actual" ]]; then
    fail_guard "checksum SHA-256 mismatch"
    return 1
  fi
  return 0
}

assert_pg_restore_toc() {
  local file="${1:-}"
  if [[ ! -f "$file" ]]; then
    fail_guard "dump TOC : fichier manquant"
    return 1
  fi
  if ! pg_restore -l "$file" >/dev/null 2>&1; then
    fail_guard "pg_restore -l a échoué"
    return 1
  fi
  local lines
  lines="$(pg_restore -l "$file" 2>/dev/null | wc -l)"
  if [[ "${lines:-0}" -lt 1 ]]; then
    fail_guard "TOC vide"
    return 1
  fi
  return 0
}

assert_backup_dir_safe() {
  local dir="${1:-}"
  if [[ -z "$dir" ]]; then
    fail_guard "BACKUP_DIR vide"
    return 1
  fi
  case "$dir" in
    ./backups|backups|/*/backups|/sites/backup|/sites/amakifr/backups)
      ;;
    *)
      if [[ "${ALLOW_CUSTOM_BACKUP_DIR:-}" != "1" ]]; then
        fail_guard "BACKUP_DIR non allowlisté: $dir (définir ALLOW_CUSTOM_BACKUP_DIR=1 si volontaire)"
        return 1
      fi
      ;;
  esac
  return 0
}

# ---------------------------------------------------------------------------
# Restore / DB target
# ---------------------------------------------------------------------------

assert_rehearsal_db_name() {
  local name="${1:-}"
  case "$name" in
    amakifr|postgres|template0|template1|"")
      fail_guard "base interdite: ${name:-<vide>}"
      return 1
      ;;
  esac
  if [[ "$name" != amakifr_migration_rehearsal_4x_* ]]; then
    fail_guard "nom rehearsal invalide (doit commencer par amakifr_migration_rehearsal_4x_)"
    return 1
  fi
  # Refus glob / caractères dangereux
  if [[ "$name" == *"*"* || "$name" == *"?"* || "$name" == *";"* || "$name" == *" "* ]]; then
    fail_guard "nom de base contient des caractères interdits"
    return 1
  fi
  return 0
}

assert_restore_target_allowed() {
  local target_db="${1:-}"
  local production_mode="${2:-}"
  if [[ -z "$target_db" ]]; then
    fail_guard "nom de base cible vide"
    return 1
  fi
  if [[ "$target_db" == "amakifr" && "$production_mode" != "PRODUCTION_RESTORE_CONFIRMED" ]]; then
    fail_guard "restore vers amakifr refusé sans PRODUCTION_RESTORE_CONFIRMED"
    return 1
  fi
  for bad in postgres template0 template1; do
    if [[ "$target_db" == "$bad" ]]; then
      fail_guard "restore vers $bad interdit"
      return 1
    fi
  done
  return 0
}

# Valide host/port/base pour restore (littéraux, pas d'injection).
# Usage: assert_restore_endpoint host port dbname
assert_restore_endpoint() {
  local host="${1:-}" port="${2:-}" dbname="${3:-}"
  if [[ -z "$host" || -z "$port" || -z "$dbname" ]]; then
    fail_guard "host/port/base restore incomplets"
    return 1
  fi
  case "$host" in
    localhost|127.0.0.1)
      ;;
    *)
      if [[ "${ALLOW_REMOTE_RESTORE_HOST:-}" != "1" ]]; then
        fail_guard "host restore non autorisé: $host (localhost/127.0.0.1 uniquement)"
        return 1
      fi
      ;;
  esac
  if [[ ! "$port" =~ ^[0-9]+$ ]] || [[ "$port" -lt 1 || "$port" -gt 65535 ]]; then
    fail_guard "port restore invalide: $port"
    return 1
  fi
  case "$dbname" in
    postgres|template0|template1|"")
      fail_guard "base système / vide refusée: ${dbname:-<vide>}"
      return 1
      ;;
  esac
  if [[ "$dbname" == *"*"* || "$dbname" == *"?"* || "$dbname" == *";"* || "$dbname" == *" "* ]]; then
    fail_guard "nom de base contient caractères interdits"
    return 1
  fi
  return 0
}

# Double confirmation production : env + phrase exacte.
assert_production_restore_double_confirm() {
  local env_token="${1:-}"
  local typed_phrase="${2:-}"
  if [[ "$env_token" != "PRODUCTION_RESTORE_CONFIRMED" ]]; then
    fail_guard "restore prod : token env manquant"
    return 1
  fi
  if [[ "$typed_phrase" != "RESTORE-AMAKIFR-PRODUCTION" ]]; then
    fail_guard "restore prod : phrase de confirmation incorrecte"
    return 1
  fi
  return 0
}

# Compte les connexions actives hors self (psql). Refuse si > 0 sauf FORCE_DISCONNECT=1.
# Usage: assert_no_active_db_connections "$DATABASE_URL_SAFE"  (valeur non affichée)
assert_no_active_db_connections() {
  local url_safe="${1:-}"
  if [[ -z "$url_safe" ]]; then
    fail_guard "URL connexion absente pour contrôle sessions"
    return 1
  fi
  local count
  count="$(psql "$url_safe" -v ON_ERROR_STOP=1 -Atc "
SELECT count(*)::int
FROM pg_stat_activity
WHERE datname = current_database()
  AND pid <> pg_backend_pid()
  AND state IS NOT NULL;
" 2>/dev/null || echo ERR)"
  if [[ "$count" == "ERR" ]]; then
    fail_guard "impossible de lire pg_stat_activity"
    return 1
  fi
  if [[ "${count:-0}" -gt 0 ]]; then
    if [[ "${FORCE_DISCONNECT:-}" == "1" ]]; then
      psql "$url_safe" -v ON_ERROR_STOP=1 -c "
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = current_database()
  AND pid <> pg_backend_pid();
" >/dev/null || {
        fail_guard "échec terminate_backend"
        return 1
      }
      return 0
    fi
    fail_guard "connexions actives ($count) — restore refusé (FORCE_DISCONNECT=1 pour terminer)"
    return 1
  fi
  return 0
}

# ---------------------------------------------------------------------------
# URLs HTTP allowlistées (maintenance + smoke)
# ---------------------------------------------------------------------------

# Valide URL http(s) : non vide, pas de credentials/fragment, hôte allowlisté.
# Usage: assert_allowed_http_url URL [allowed_hosts] [label]
assert_allowed_http_url() {
  local url="${1:-}"
  local allowed_hosts="${2:-${MAINTENANCE_ALLOWED_HOST:-amaki.fr}}"
  local label="${3:-URL}"
  if [[ -z "$url" ]]; then
    fail_guard "$label vide"
    return 1
  fi
  if [[ "$url" == *"@"* ]]; then
    fail_guard "$label : credentials interdits"
    return 1
  fi
  if [[ "$url" == *"#"* ]]; then
    fail_guard "$label : fragment interdit"
    return 1
  fi
  case "$url" in
    http://*|https://*)
      ;;
    *)
      fail_guard "$label : schéma http/https requis"
      return 1
      ;;
  esac
  if [[ "$url" == *" "* || "$url" == *"\\"* ]]; then
    fail_guard "$label ambiguë"
    return 1
  fi
  local host
  host="$(python3 - "$url" <<'PY'
import sys
from urllib.parse import urlparse
u = urlparse(sys.argv[1])
print(u.hostname or "")
PY
)"
  if [[ -z "$host" ]]; then
    fail_guard "$label : hôte illisible"
    return 1
  fi
  local ok=0 h
  IFS=',' read -ra _hosts <<< "$allowed_hosts"
  for h in "${_hosts[@]}"; do
    h="$(echo "$h" | tr -d '[:space:]')"
    [[ -z "$h" ]] && continue
    if [[ "$host" == "$h" || "$host" == "www.$h" ]]; then
      ok=1
      break
    fi
  done
  if [[ "$ok" -ne 1 ]]; then
    fail_guard "$label hôte '$host' non autorisé (attendu: $allowed_hosts)"
    return 1
  fi
  return 0
}

assert_maintenance_url_shape() {
  assert_allowed_http_url "${1:-}" "${2:-${MAINTENANCE_ALLOWED_HOST:-amaki.fr}}" "MAINTENANCE_CHECK_URL"
}

assert_smoke_url_shape() {
  local hosts="${2:-${SMOKE_ALLOWED_HOST:-${MAINTENANCE_ALLOWED_HOST:-amaki.fr}}}"
  assert_allowed_http_url "${1:-}" "$hosts" "SMOKE_URL"
}

# Vérifie qu'une URL de maintenance répond exactement 503.
assert_maintenance_http() {
  local url="${1:-}"
  assert_maintenance_url_shape "$url" || return 1
  if ! command -v curl >/dev/null 2>&1; then
    fail_guard "curl introuvable pour vérifier la maintenance"
    return 1
  fi
  local code
  code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 15 "$url" || echo 000)"
  if [[ "$code" != "503" ]]; then
    fail_guard "maintenance HTTP attendu 503, reçu $code"
    return 1
  fi
  return 0
}

# ---------------------------------------------------------------------------
# Temp sécurisé (mktemp, même FS, anti-symlink)
# ---------------------------------------------------------------------------

# Crée un fichier temporaire via mktemp dans dir (même filesystem que la cible).
# Affiche le chemin sur stdout. chmod 600. Refuse symlink / hors-répertoire.
# Usage: create_secure_temp_in_dir /path/to/backups amakifr_dump.XXXXXX
create_secure_temp_in_dir() {
  local dir="${1:-}"
  local template="${2:-amakifr_dump.XXXXXX}"
  if [[ -z "$dir" ]]; then
    fail_guard "create_secure_temp_in_dir: répertoire vide"
    return 1
  fi
  mkdir -p "$dir" || {
    fail_guard "impossible de créer le répertoire temp"
    return 1
  }
  local tmp
  tmp="$(mktemp -p "$dir" "$template")" || {
    fail_guard "mktemp a échoué"
    return 1
  }
  if [[ -z "$tmp" || ! -e "$tmp" ]]; then
    fail_guard "mktemp chemin invalide"
    return 1
  fi
  if [[ -L "$tmp" ]]; then
    rm -f "$tmp"
    fail_guard "fichier temporaire est un symlink — refus"
    return 1
  fi
  if [[ ! -f "$tmp" ]]; then
    rm -f "$tmp"
    fail_guard "fichier temporaire n'est pas un fichier régulier"
    return 1
  fi
  local real_dir real_parent
  real_dir="$(cd "$dir" && pwd -P)"
  real_parent="$(cd "$(dirname "$tmp")" && pwd -P)"
  if [[ "$real_parent" != "$real_dir" ]]; then
    rm -f "$tmp"
    fail_guard "tmp hors du répertoire cible ($real_parent != $real_dir)"
    return 1
  fi
  chmod 600 "$tmp" || {
    rm -f "$tmp"
    fail_guard "chmod 600 tmp a échoué"
    return 1
  }
  printf '%s\n' "$tmp"
  return 0
}

# Vérifie l'ordre des contrôles Git avant maintenance/PM2/backup dans le script deploy.
assert_deploy_git_controls_before_mutations() {
  local script="${1:-}"
  if [[ ! -f "$script" ]]; then
    fail_guard "script introuvable: $script"
    return 1
  fi
  local line_git_dirty line_maint line_pm2_stop line_backup
  line_git_dirty="$(grep -n 'assert_git_workdir_clean' "$script" | head -1 | cut -d: -f1)"
  line_maint="$(grep -n 'maintenance-on\.sh' "$script" | head -1 | cut -d: -f1)"
  # Ignorer commentaires et messages step() contenant « pm2 stop »
  line_pm2_stop="$(grep -nE '^[[:space:]]*pm2 stop' "$script" | head -1 | cut -d: -f1)"
  line_backup="$(grep -n 'db-backup-restore\.sh backup' "$script" | head -1 | cut -d: -f1)"
  if [[ -z "$line_git_dirty" || -z "$line_maint" || -z "$line_pm2_stop" || -z "$line_backup" ]]; then
    fail_guard "marqueurs d'ordre introuvables dans $script"
    return 1
  fi
  if [[ "$line_git_dirty" -ge "$line_maint" ]]; then
    fail_guard "assert_git_workdir_clean doit précéder maintenance-on"
    return 1
  fi
  if [[ "$line_git_dirty" -ge "$line_pm2_stop" ]]; then
    fail_guard "assert_git_workdir_clean doit précéder pm2 stop"
    return 1
  fi
  if [[ "$line_git_dirty" -ge "$line_backup" ]]; then
    fail_guard "assert_git_workdir_clean doit précéder backup"
    return 1
  fi
  if ! grep -q 'assert_git_sha_is_origin_main' "$script"; then
    fail_guard "assert_git_sha_is_origin_main absent"
    return 1
  fi
  local line_sha
  line_sha="$(grep -n 'assert_git_sha_is_origin_main' "$script" | head -1 | cut -d: -f1)"
  if [[ "$line_sha" -ge "$line_maint" ]]; then
    fail_guard "SHA/origin/main doit précéder maintenance-on"
    return 1
  fi
  return 0
}

# pm2 save doit être bloquant (pas || true) et précéder maintenance-off.
assert_deploy_pm2_save_blocking() {
  local script="${1:-}"
  if [[ ! -f "$script" ]]; then
    fail_guard "script introuvable: $script"
    return 1
  fi
  if grep -nE 'pm2[[:space:]]+save.*( \|\|[[:space:]]*true|2>/dev/null[[:space:]]*\|\|[[:space:]]*true)' "$script" >/dev/null 2>&1; then
    fail_guard "pm2 save non bloquant détecté"
    return 1
  fi
  if ! grep -qE 'pm2[[:space:]]+save' "$script"; then
    fail_guard "pm2 save absent"
    return 1
  fi
  local line_save line_off
  line_save="$(grep -nE 'pm2[[:space:]]+save' "$script" | head -1 | cut -d: -f1)"
  line_off="$(grep -n 'maintenance-off\.sh' "$script" | head -1 | cut -d: -f1)"
  if [[ -z "$line_off" || "$line_save" -ge "$line_off" ]]; then
    fail_guard "pm2 save doit précéder maintenance-off"
    return 1
  fi
  return 0
}

# ---------------------------------------------------------------------------
# Orpheline : dossier doit être ABSENT
# ---------------------------------------------------------------------------

assert_orphan_migration_absent() {
  local dir="${1:-prisma/migrations/${ORPHAN_MIGRATION_NAME}}"
  if [[ -e "$dir" ]]; then
    fail_guard "dossier orphelin présent (interdit): $dir — duplique initial_schema"
    return 1
  fi
  return 0
}

# Référence documentaire du checksum historique (ne vérifie pas un fichier local).
assert_orphan_checksum_reference() {
  local got="${1:-}"
  if [[ "$got" != "$ORPHAN_MIGRATION_CHECKSUM" ]]; then
    fail_guard "checksum orpheline de référence incorrect"
    return 1
  fi
  return 0
}

# ---------------------------------------------------------------------------
# Contrôles statiques du script de déploiement (tests)
# ---------------------------------------------------------------------------

assert_deploy_script_no_checkout_f() {
  local script="${1:-}"
  if [[ ! -f "$script" ]]; then
    fail_guard "script introuvable: $script"
    return 1
  fi
  if grep -E 'checkout[[:space:]]+-f|checkout[[:space:]]+--force' "$script" >/dev/null 2>&1; then
    fail_guard "checkout -f détecté dans $script"
    return 1
  fi
  return 0
}

assert_deploy_script_no_critical_warn_continue() {
  local script="${1:-}"
  if [[ ! -f "$script" ]]; then
    fail_guard "script introuvable: $script"
    return 1
  fi
  # Patterns interdits : warn après étapes critiques
  if grep -nE 'warn.*(pre-migrate|seed|smoke|deploy:check|migrate)' "$script" >/dev/null 2>&1; then
    fail_guard "warn+continue critique détecté dans $script"
    return 1
  fi
  if grep -nE '\|\|[[:space:]]*warn' "$script" >/dev/null 2>&1; then
    fail_guard "|| warn détecté (étape non-STOP) dans $script"
    return 1
  fi
  return 0
}
