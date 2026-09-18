#!/usr/bin/env bash
# Sauvegarde / restauration PostgreSQL amakifr — durci pour déploiement.
# - Dump custom atomique (temp → validate → mv)
# - Restore : host/port/base validés, prod refusée par défaut, double confirmation
# - Aucun secret affiché. Pas de CREATEDB. Pas de glob sur noms de base.
#
# Usage :
#   DATABASE_URL=... bash scripts/db-backup-restore.sh backup -t custom -b ./backups --print-path
#   RESTORE_TARGET_DB=amakifr_migration_rehearsal_4x_YYYYMMDD \
#     RESTORE_HOST=127.0.0.1 RESTORE_PORT=5432 \
#     bash scripts/db-backup-restore.sh restore -f backups/xxx.dump

set -euo pipefail

DB_USER="${DB_USER:-hubert}"
DB_NAME="${DB_NAME:-amakifr}"
if [[ -z "${BACKUP_DIR:-}" ]]; then
  if [[ -d /sites/backup ]] && [[ -w /sites/backup ]] 2>/dev/null; then
    BACKUP_DIR="/sites/backup"
  else
    BACKUP_DIR="./backups"
  fi
fi
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
PRINT_PATH=0
umask 077

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/deploy-guards.sh
source "$SCRIPT_DIR/lib/deploy-guards.sh"

sanitize_db_url() {
  echo "${DATABASE_URL%%\?*}"
}

psql_conn() {
  if [[ -n "${DATABASE_URL:-}" ]]; then
    psql "$(sanitize_db_url)" "$@"
  else
    psql -h "${RESTORE_HOST:-localhost}" -p "${RESTORE_PORT:-5432}" -U "$DB_USER" -d "$DB_NAME" "$@"
  fi
}

pg_dump_conn() {
  if [[ -n "${DATABASE_URL:-}" ]]; then
    pg_dump "$(sanitize_db_url)" "$@"
  else
    pg_dump -h "${RESTORE_HOST:-localhost}" -p "${RESTORE_PORT:-5432}" -U "$DB_USER" -d "$DB_NAME" "$@"
  fi
}

pg_restore_conn() {
  if [[ -n "${DATABASE_URL:-}" ]]; then
    pg_restore --dbname="$(sanitize_db_url)" "$@"
  else
    pg_restore -h "${RESTORE_HOST:-localhost}" -p "${RESTORE_PORT:-5432}" -U "$DB_USER" -d "$DB_NAME" "$@"
  fi
}

show_help() {
  cat << EOF
Usage: $0 [COMMAND] [OPTIONS]

Commandes:
  backup          Créer une sauvegarde
  restore         Restaurer (cible explicite RESTORE_TARGET_DB)
  list            Lister les sauvegardes
  list-tables     Tables d'un dump custom
  clean           Nettoyage rétention (INTERDIT pendant déploiement critique)

Options:
  -u, --user USER
  -d, --database DB
  -f, --file FILE
  -t, --type TYPE     complete|custom|data-only|non-empty|tables
  -T, --tables T1,T2
  -b, --backup-dir DIR
  --print-path        Affiche uniquement le chemin final du dump (stdout)
  -h, --help

Restore exige:
  RESTORE_TARGET_DB   nom littéral
  RESTORE_HOST        localhost|127.0.0.1 (défaut)
  RESTORE_PORT        port numérique
  PRODUCTION_RESTORE_CONFIRMED=PRODUCTION_RESTORE_CONFIRMED + phrase
    RESTORE-AMAKIFR-PRODUCTION pour amakifr uniquement.
EOF
}

# Finalise un dump : chmod, taille, TOC (si custom), SHA, rename atomique depuis tmp.
# Args: tmp_path final_path
# Après succès, efface BACKUP_TMP_ACTIVE pour que le trap ne supprime pas le final.
finalize_atomic_dump() {
  local tmp="$1"
  local final="$2"
  local tmp_sha="${tmp}.sha256"
  local final_sha="${final}.sha256"

  if [[ ! -f "$tmp" ]]; then
    echo -e "${RED}❌ Fichier temporaire absent${NC}" >&2
    return 1
  fi
  if [[ -L "$tmp" ]]; then
    echo -e "${RED}❌ Fichier temporaire symlink — refus${NC}" >&2
    rm -f "$tmp" "$tmp_sha"
    return 1
  fi
  if [[ ! -s "$tmp" ]]; then
    echo -e "${RED}❌ Dump vide — refus${NC}" >&2
    rm -f "$tmp" "$tmp_sha"
    return 1
  fi
  chmod 600 "$tmp"

  if [[ "$final" == *.dump ]] || [[ "$final" == *.custom ]]; then
    if ! pg_restore -l "$tmp" >/dev/null 2>&1; then
      echo -e "${RED}❌ pg_restore -l a échoué (TOC)${NC}" >&2
      rm -f "$tmp" "$tmp_sha"
      return 1
    fi
  fi

  sha256sum "$tmp" > "$tmp_sha"
  chmod 600 "$tmp_sha"

  # Renommage atomique (même FS) : dump puis checksum
  mv -f "$tmp" "$final"
  mv -f "$tmp_sha" "$final_sha"
  BACKUP_TMP_ACTIVE=""

  echo -e "${GREEN}✅ Dump finalisé : $final${NC}" >&2
  echo -e "${GREEN}🔐 SHA-256 adjacent : $final_sha${NC}" >&2
  if [[ "$PRINT_PATH" -eq 1 ]]; then
    printf '%s\n' "$final"
  fi
  return 0
}

# Nettoyage trap : uniquement le temp encore actif (pas le dump final).
BACKUP_TMP_ACTIVE=""
cleanup_backup_tmp() {
  if [[ -n "${BACKUP_TMP_ACTIVE:-}" ]]; then
    rm -f "$BACKUP_TMP_ACTIVE" "${BACKUP_TMP_ACTIVE}.sha256" 2>/dev/null || true
    BACKUP_TMP_ACTIVE=""
  fi
}

# Alloue un temp mktemp dans BACKUP_DIR, enregistre pour cleanup.
# Usage: allocate_backup_tmp → met TMP_FILE
allocate_backup_tmp() {
  local prefix="${1:-amakifr_dump}"
  TMP_FILE="$(create_secure_temp_in_dir "$BACKUP_DIR" "${prefix}.XXXXXX")" || return 1
  BACKUP_TMP_ACTIVE="$TMP_FILE"
  return 0
}

backup_database() {
  local dump_type="${1:-complete}"
  local tables_list="${2:-}"

  assert_backup_dir_safe "$BACKUP_DIR" || {
    echo -e "${RED}❌ BACKUP_DIR invalide${NC}" >&2
    exit 1
  }
  mkdir -p "$BACKUP_DIR"
  trap cleanup_backup_tmp EXIT

  local db_label="${DB_NAME:-base}"
  echo -e "${BLUE}🔄 Sauvegarde ${db_label} (type=$dump_type)...${NC}" >&2

  local BACKUP_FILE="" TMP_FILE=""

  case "$dump_type" in
    complete)
      BACKUP_FILE="$BACKUP_DIR/amakifr_complete_${TIMESTAMP}.sql"
      allocate_backup_tmp "amakifr_complete" || exit 1
      if ! pg_dump_conn -F p -f "$TMP_FILE"; then
        cleanup_backup_tmp
        echo -e "${RED}❌ Échec dump complete${NC}" >&2
        exit 1
      fi
      finalize_atomic_dump "$TMP_FILE" "$BACKUP_FILE" || exit 1
      ;;
    custom)
      BACKUP_FILE="$BACKUP_DIR/amakifr_custom_${TIMESTAMP}.dump"
      allocate_backup_tmp "amakifr_custom" || exit 1
      if ! pg_dump_conn -F c -f "$TMP_FILE"; then
        cleanup_backup_tmp
        echo -e "${RED}❌ Échec dump custom${NC}" >&2
        exit 1
      fi
      finalize_atomic_dump "$TMP_FILE" "$BACKUP_FILE" || exit 1
      ;;
    data-only)
      BACKUP_FILE="$BACKUP_DIR/amakifr_data_${TIMESTAMP}.sql"
      allocate_backup_tmp "amakifr_data" || exit 1
      if ! pg_dump_conn --data-only -f "$TMP_FILE"; then
        cleanup_backup_tmp
        echo -e "${RED}❌ Échec dump data-only${NC}" >&2
        exit 1
      fi
      finalize_atomic_dump "$TMP_FILE" "$BACKUP_FILE" || exit 1
      ;;
    non-empty)
      BACKUP_FILE="$BACKUP_DIR/amakifr_nonempty_${TIMESTAMP}.dump"
      allocate_backup_tmp "amakifr_nonempty" || exit 1
      local dump_tables=()
      local tab cnt
      while IFS= read -r tab; do
        [[ -z "$tab" ]] && continue
        if [[ ! "$tab" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]; then
          continue
        fi
        cnt="$(psql_conn -t -A -c "SELECT count(*) FROM public.\"${tab}\"" 2>/dev/null || echo 0)"
        if [[ -n "$cnt" && "${cnt:-0}" -gt 0 ]]; then
          dump_tables+=(-t "public.${tab}")
        fi
      done < <(psql_conn -t -A -c "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename")
      if [[ ${#dump_tables[@]} -eq 0 ]]; then
        cleanup_backup_tmp
        echo -e "${YELLOW}⚠️  Aucune table non vide${NC}" >&2
        exit 0
      fi
      if ! pg_dump_conn -F c "${dump_tables[@]}" -f "$TMP_FILE"; then
        cleanup_backup_tmp
        echo -e "${RED}❌ Échec dump non-empty${NC}" >&2
        exit 1
      fi
      finalize_atomic_dump "$TMP_FILE" "$BACKUP_FILE" || exit 1
      ;;
    tables)
      if [[ -z "$tables_list" ]]; then
        echo -e "${RED}❌ Type tables nécessite -T${NC}" >&2
        exit 1
      fi
      BACKUP_FILE="$BACKUP_DIR/amakifr_tables_${TIMESTAMP}.dump"
      allocate_backup_tmp "amakifr_tables" || exit 1
      local dump_tables=() t
      IFS=',' read -ra TABARR <<< "$tables_list"
      for t in "${TABARR[@]}"; do
        t="$(echo "$t" | xargs)"
        [[ -z "$t" ]] && continue
        if [[ ! "$t" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]; then
          cleanup_backup_tmp
          echo -e "${RED}❌ Nom de table invalide: $t${NC}" >&2
          exit 1
        fi
        dump_tables+=(-t "public.$t")
      done
      [[ ${#dump_tables[@]} -gt 0 ]] || { cleanup_backup_tmp; echo -e "${RED}❌ Aucune table${NC}" >&2; exit 1; }
      if ! pg_dump_conn -F c "${dump_tables[@]}" -f "$TMP_FILE"; then
        cleanup_backup_tmp
        echo -e "${RED}❌ Échec dump tables${NC}" >&2
        exit 1
      fi
      finalize_atomic_dump "$TMP_FILE" "$BACKUP_FILE" || exit 1
      ;;
    *)
      echo -e "${RED}❌ Type invalide: $dump_type${NC}" >&2
      exit 1
      ;;
  esac

  if [[ -f "${BACKUP_FILE:-}" ]]; then
    local FILE_SIZE
    FILE_SIZE="$(ls -lh "$BACKUP_FILE" | awk '{print $5}')"
    echo -e "${GREEN}📊 Taille : $FILE_SIZE${NC}" >&2
  fi
  echo -e "${GREEN}✅ Sauvegarde terminée${NC}" >&2
}

restore_database() {
  local backup_file="${1:-}"
  local tables_opt="${2:-}"

  if [[ -z "$backup_file" || ! -f "$backup_file" ]]; then
    echo -e "${RED}❌ Fichier de sauvegarde manquant${NC}" >&2
    exit 1
  fi
  if [[ ! -s "$backup_file" ]]; then
    echo -e "${RED}❌ Dump vide — refus${NC}" >&2
    exit 1
  fi

  # Checksum obligatoire si .sha256 adjacent ; sinon refus sauf ALLOW_RESTORE_WITHOUT_CHECKSUM=1
  if [[ -f "${backup_file}.sha256" ]]; then
    assert_sha256_file_matches "$backup_file" "${backup_file}.sha256" || exit 1
    echo -e "${GREEN}✅ Checksum SHA-256 vérifié${NC}" >&2
  else
    if [[ "${ALLOW_RESTORE_WITHOUT_CHECKSUM:-}" != "1" ]]; then
      echo -e "${RED}❌ .sha256 adjacent obligatoire${NC}" >&2
      exit 1
    fi
    echo -e "${YELLOW}⚠️  Restore sans checksum (ALLOW_RESTORE_WITHOUT_CHECKSUM=1)${NC}" >&2
  fi

  if [[ "$backup_file" == *.dump ]] || [[ "$backup_file" == *.custom ]]; then
    assert_pg_restore_toc "$backup_file" || exit 1
  fi

  local host="${RESTORE_HOST:-localhost}"
  local port="${RESTORE_PORT:-5432}"
  local target_db="${RESTORE_TARGET_DB:-}"

  if [[ -z "$target_db" ]]; then
    echo -e "${YELLOW}Nom LITÉRAL de la base cible :${NC}" >&2
    read -r target_db
  fi
  [[ -n "$target_db" ]] || { echo -e "${RED}❌ Base cible obligatoire${NC}" >&2; exit 1; }

  assert_restore_endpoint "$host" "$port" "$target_db" || exit 1

  case "$target_db" in
    amakifr)
      local typed=""
      if [[ "${PRODUCTION_RESTORE_CONFIRMED:-}" != "PRODUCTION_RESTORE_CONFIRMED" ]]; then
        echo -e "${RED}❌ Restore amakifr refusé sans PRODUCTION_RESTORE_CONFIRMED${NC}" >&2
        exit 1
      fi
      echo -e "${YELLOW}Confirmez en tapant exactement : RESTORE-AMAKIFR-PRODUCTION${NC}" >&2
      if [[ -n "${PRODUCTION_RESTORE_PHRASE:-}" ]]; then
        typed="$PRODUCTION_RESTORE_PHRASE"
      else
        read -r typed
      fi
      assert_production_restore_double_confirm "${PRODUCTION_RESTORE_CONFIRMED}" "$typed" || exit 1
      ;;
    amakifr_migration_rehearsal_4x_*)
      assert_rehearsal_db_name "$target_db" || exit 1
      echo -e "${GREEN}✅ Cible rehearsal : $target_db${NC}" >&2
      ;;
    *)
      assert_restore_target_allowed "$target_db" "" || exit 1
      echo -e "${YELLOW}Cible non standard — retapez le nom exact :${NC}" >&2
      local confirm_db
      read -r confirm_db
      if [[ "$confirm_db" != "$target_db" ]]; then
        echo "Annulé." >&2
        exit 0
      fi
      ;;
  esac

  echo -e "${YELLOW}⚠️  Cette opération va modifier la base cible (nom non secret). Continuer ? (oui/non)${NC}" >&2
  local REPLY
  read -r REPLY
  if [[ ! "$REPLY" =~ ^[Oo][Uu][Ii]$ ]]; then
    echo "Annulé." >&2
    exit 0
  fi

  # Brancher la connexion sur la cible sans afficher l'URL
  if [[ -n "${DATABASE_URL:-}" ]]; then
    local url_no_qs="${DATABASE_URL%%\?*}"
    DATABASE_URL="$(python3 - "$url_no_qs" "$target_db" <<'PY'
import os, sys, urllib.parse
u, db = sys.argv[1], sys.argv[2]
scheme = "postgresql://"
raw = u
if raw.startswith("postgres://"):
    scheme = "postgres://"
    raw = "http://" + raw[len("postgres://"):]
elif raw.startswith("postgresql://"):
    raw = "http://" + raw[len("postgresql://"):]
else:
    raw = "http://" + raw
p = urllib.parse.urlparse(raw)
host = os.environ.get("RESTORE_HOST") or p.hostname or "localhost"
port = os.environ.get("RESTORE_PORT") or (str(p.port) if p.port else "5432")
netloc = p.netloc
userinfo = ""
if "@" in netloc:
    userinfo = netloc.rsplit("@", 1)[0] + "@"
p = p._replace(netloc=f"{userinfo}{host}:{port}", path="/" + db)
print(urllib.parse.urlunparse(p).replace("http://", scheme, 1), end="")
PY
)"
    export DATABASE_URL
  else
    DB_NAME="$target_db"
    export DB_NAME
  fi

  # Connexions actives
  assert_no_active_db_connections "$(sanitize_db_url)" || exit 1

  if [[ "$backup_file" == *.dump ]] || [[ "$backup_file" == *.custom ]]; then
    local restore_opts=(--data-only --no-owner --no-privileges)
    if [[ -n "$tables_opt" ]]; then
      local t
      IFS=',' read -ra TABLIST <<< "$tables_opt"
      for t in "${TABLIST[@]}"; do
        t="$(echo "$t" | xargs)"
        [[ -z "$t" ]] && continue
        if [[ ! "$t" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]; then
          echo -e "${RED}❌ Table invalide: $t${NC}" >&2
          exit 1
        fi
        restore_opts+=(-t "$t")
      done
    fi
    restore_opts+=("$backup_file")
    echo -e "${BLUE}📥 Restauration dump custom...${NC}" >&2
    if pg_restore_conn "${restore_opts[@]}"; then
      echo -e "${GREEN}✅ Restauration OK${NC}" >&2
    else
      echo -e "${RED}❌ Échec restauration${NC}" >&2
      exit 1
    fi
  elif [[ "$backup_file" == *data*.sql ]]; then
    if psql_conn --set=session_replication_role=replica -f "$backup_file"; then
      echo -e "${GREEN}✅ Restauration OK${NC}" >&2
    else
      echo -e "${RED}❌ Échec restauration${NC}" >&2
      exit 1
    fi
  else
    if psql_conn -f "$backup_file"; then
      echo -e "${GREEN}✅ Restauration OK${NC}" >&2
    else
      echo -e "${RED}❌ Échec restauration${NC}" >&2
      exit 1
    fi
  fi
}

list_tables_backup() {
  local backup_file="${1:-}"
  [[ -n "$backup_file" && -f "$backup_file" ]] || { echo -e "${RED}❌ Fichier manquant${NC}" >&2; exit 1; }
  pg_restore -l "$backup_file" 2>/dev/null | grep "TABLE DATA" | sed 's/.*TABLE DATA public /  - /' | sed 's/ .*//' || true
}

list_backups() {
  echo -e "${BLUE}📋 Sauvegardes dans $BACKUP_DIR${NC}"
  ls -lh "$BACKUP_DIR"/amakifr_*.{dump,sql} 2>/dev/null || echo "Aucune"
}

clean_backups() {
  if [[ "${ALLOW_BACKUP_CLEAN:-}" != "1" ]]; then
    echo -e "${RED}❌ clean refusé — définir ALLOW_BACKUP_CLEAN=1 (jamais pendant déploiement critique)${NC}" >&2
    exit 1
  fi
  echo -e "${BLUE}🧹 Nettoyage (garde 10 + paires .sha256)...${NC}"
  local pattern file sha
  for pattern in complete_*.sql custom_*.dump data_*.sql nonempty_*.dump tables_*.dump; do
    local files=()
    # shellcheck disable=SC2207
    files=($(ls -1t "$BACKUP_DIR"/amakifr_${pattern} 2>/dev/null || true))
    local n=${#files[@]}
    if [[ "$n" -gt 10 ]]; then
      local i
      for ((i=10; i<n; i++)); do
        file="${files[$i]}"
        sha="${file}.sha256"
        rm -f "$file" "$sha"
        echo "  Supprimé paire: $(basename "$file")"
      done
    fi
  done
}

COMMAND=""
DUMP_TYPE="complete"
BACKUP_FILE=""
RESTORE_TABLES=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    backup|restore|list|clean|list-tables)
      COMMAND="$1"; shift ;;
    -u|--user) DB_USER="$2"; shift 2 ;;
    -d|--database) DB_NAME="$2"; shift 2 ;;
    -f|--file) BACKUP_FILE="$2"; shift 2 ;;
    -t|--type) DUMP_TYPE="$2"; shift 2 ;;
    -T|--tables) RESTORE_TABLES="$2"; shift 2 ;;
    -b|--backup-dir) BACKUP_DIR="$2"; shift 2 ;;
    --print-path) PRINT_PATH=1; shift ;;
    -h|--help) show_help; exit 0 ;;
    *)
      echo -e "${RED}❌ Option inconnue : $1${NC}" >&2
      show_help
      exit 1
      ;;
  esac
done

case "$COMMAND" in
  backup) backup_database "$DUMP_TYPE" "$RESTORE_TABLES" ;;
  restore) restore_database "$BACKUP_FILE" "$RESTORE_TABLES" ;;
  list) list_backups ;;
  list-tables) list_tables_backup "$BACKUP_FILE" ;;
  clean) clean_backups ;;
  "")
    echo -e "${RED}❌ Commande manquante${NC}" >&2
    show_help
    exit 1
    ;;
  *)
    echo -e "${RED}❌ Commande inconnue${NC}" >&2
    exit 1
    ;;
esac
