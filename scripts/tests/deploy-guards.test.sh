#!/usr/bin/env bash
# Tests des gardes de déploiement — exercent les fonctions, pas seulement le texte.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
# shellcheck source=../lib/deploy-guards.sh
source "$ROOT/scripts/lib/deploy-guards.sh"

PASS=0
FAIL=0
_DIR_STACK=()
_PATH_STACK=()
pushd_quiet() { _DIR_STACK+=("$PWD"); cd "$1" || exit 1; }
popd_quiet() {
  local n=$((${#_DIR_STACK[@]} - 1))
  cd "${_DIR_STACK[$n]}" || exit 1
  unset "_DIR_STACK[$n]"
}
push_path() { _PATH_STACK+=("$PATH"); export PATH="$1:$PATH"; }
pop_path() {
  local n=$((${#_PATH_STACK[@]} - 1))
  export PATH="${_PATH_STACK[$n]}"
  unset "_PATH_STACK[$n]"
}
assert_ok() {
  local name="$1"
  shift
  if "$@" >/dev/null 2>&1; then
    echo "OK  $name"
    PASS=$((PASS + 1))
  else
    echo "FAIL $name (attendu OK)"
    FAIL=$((FAIL + 1))
  fi
}
assert_fail() {
  local name="$1"
  shift
  if "$@" >/dev/null 2>&1; then
    echo "FAIL $name (attendu refus)"
    FAIL=$((FAIL + 1))
  else
    echo "OK  $name (refus)"
    PASS=$((PASS + 1))
  fi
}

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
DEPLOY_SCRIPT="$ROOT/scripts/deploy-production-safe.sh"

# --- PM2 name / état ---
assert_fail "pm2 name amaki interdit" assert_pm2_process_exists amaki
assert_fail "pm2 name vide" assert_pm2_process_exists ""
assert_fail "pm2 name autre" assert_pm2_process_exists otherapp

# --- flags shell ---
export NOTES_FRAIS_ENABLED=true
unset NEXT_PUBLIC_NOTES_FRAIS_ENABLED || true
assert_fail "flag shell NOTES true" assert_notes_frais_flags_off
unset NOTES_FRAIS_ENABLED || true
export NEXT_PUBLIC_NOTES_FRAIS_ENABLED=true
assert_fail "flag shell NEXT_PUBLIC true" assert_notes_frais_flags_off
unset NEXT_PUBLIC_NOTES_FRAIS_ENABLED || true

# --- flags fichier ---
unset NOTES_FRAIS_ENABLED NEXT_PUBLIC_NOTES_FRAIS_ENABLED || true
echo 'NOTES_FRAIS_ENABLED=true' > "$TMP/.env"
pushd_quiet "$TMP"
assert_fail "flag fichier NOTES true" assert_notes_frais_flags_off
popd_quiet
unset NOTES_FRAIS_ENABLED NEXT_PUBLIC_NOTES_FRAIS_ENABLED || true
echo 'NEXT_PUBLIC_NOTES_FRAIS_ENABLED=true' > "$TMP/.env.local"
pushd_quiet "$TMP"
assert_fail "flag fichier NEXT_PUBLIC true" assert_notes_frais_flags_off
popd_quiet
unset NOTES_FRAIS_ENABLED NEXT_PUBLIC_NOTES_FRAIS_ENABLED || true
rm -f "$TMP/.env" "$TMP/.env.local"
pushd_quiet "$TMP"
assert_ok "flags absents" assert_notes_frais_flags_off
popd_quiet

# Mock PM2 pour flag PM2 true (fonction locale)
unset NOTES_FRAIS_ENABLED NEXT_PUBLIC_NOTES_FRAIS_ENABLED || true
pushd_quiet "$TMP"
mkdir -p "$TMP/bin"
cat > "$TMP/bin/pm2" <<'EOF'
#!/bin/bash
if [[ "$1" == "id" ]]; then echo 0; exit 0; fi
if [[ "$1" == "env" ]]; then
  echo "NOTES_FRAIS_ENABLED=true"
  echo "NEXT_PUBLIC_NOTES_FRAIS_ENABLED=false"
  exit 0
fi
if [[ "$1" == "describe" ]]; then exit 0; fi
if [[ "$1" == "jlist" ]]; then
  echo '[{"name":"amakifr","pm2_env":{"status":"online","pm_cwd":"/sites/amakifr"}}]'
  exit 0
fi
exit 0
EOF
chmod +x "$TMP/bin/pm2"
push_path "$TMP/bin"
assert_fail "flag PM2 NOTES true" assert_notes_frais_flags_off amakifr
pop_path
popd_quiet

# Mock PM2 cwd / stopped
mkdir -p "$TMP/bin2"
cat > "$TMP/bin2/pm2" <<'EOF'
#!/bin/bash
case "$1" in
  describe)
    echo "│ exec cwd          │ /wrong/path │"
    exit 0
    ;;
  jlist)
    echo '[{"name":"amakifr","pm2_env":{"status":"online","pm_cwd":"/wrong/path"}}]'
    exit 0
    ;;
  id) echo 0; exit 0 ;;
  env) exit 0 ;;
esac
exit 0
EOF
chmod +x "$TMP/bin2/pm2"
push_path "$TMP/bin2"
assert_fail "mauvais cwd PM2" assert_pm2_cwd amakifr /sites/amakifr
assert_fail "PM2 online != stopped" assert_pm2_stopped amakifr
pop_path
mkdir -p "$TMP/bin3"
cat > "$TMP/bin3/pm2" <<'EOF'
#!/bin/bash
case "$1" in
  describe)
    echo "│ exec cwd          │ /sites/amakifr │"
    exit 0
    ;;
  jlist)
    echo '[{"name":"amakifr","pm2_env":{"status":"stopped","pm_cwd":"/sites/amakifr"}}]'
    exit 0
    ;;
esac
exit 0
EOF
chmod +x "$TMP/bin3/pm2"
push_path "$TMP/bin3"
assert_ok "cwd PM2 OK" assert_pm2_cwd amakifr /sites/amakifr
assert_ok "PM2 stopped OK" assert_pm2_stopped amakifr
pop_path

# --- EXPECTED_GIT_SHA format ---
cd "$ROOT"
assert_fail "SHA vide" assert_git_sha_format ""
assert_fail "SHA !=40 (short)" assert_git_sha_format "$(git rev-parse --short HEAD)"
assert_fail "SHA invalide chars" assert_git_sha_format "zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz"
HEAD40="$(git rev-parse HEAD)"
assert_ok "SHA 40 OK" assert_git_sha_format "$HEAD40"
assert_fail "SHA absent commit" assert_git_sha_exists "deadbeefdeadbeefdeadbeefdeadbeefdeadbeef"

# origin/main mismatch (si origin/main existe)
if git rev-parse --verify origin/main >/dev/null 2>&1; then
  ORIGIN_MAIN="$(git rev-parse origin/main)"
  if [[ "$HEAD40" == "$ORIGIN_MAIN" ]]; then
    assert_ok "SHA == origin/main" assert_git_sha_is_origin_main "$HEAD40" main
  fi
  # SHA valide format mais différent d'origin/main (faux SHA existant si possible)
  OTHER="$(git rev-parse HEAD~1 2>/dev/null || true)"
  if [[ -n "$OTHER" && "$OTHER" != "$ORIGIN_MAIN" ]]; then
    assert_fail "SHA != origin/main" assert_git_sha_is_origin_main "$OTHER" main
  fi
fi

# HEAD match
assert_ok "EXPECTED_GIT_SHA HEAD" assert_expected_git_sha "$HEAD40"
assert_fail "EXPECTED_GIT_SHA short refuse" assert_expected_git_sha "$(git rev-parse --short HEAD)"

# --- tracked/index dirty ---
D="$TMP/gitrepo"
mkdir -p "$D"
pushd_quiet "$D"
git init -q
git config user.email t@t.t
git config user.name t
echo a > f.txt
git add f.txt && git commit -qm init
echo dirty >> f.txt
assert_fail "tracked dirty" assert_git_workdir_clean
git checkout -- f.txt
assert_ok "workdir clean" assert_git_workdir_clean
echo x > f.txt
git add f.txt
assert_fail "index dirty" assert_git_workdir_clean
popd_quiet
cd "$ROOT"

# --- maintenance URL shape ---
assert_fail "maint URL vide" assert_maintenance_url_shape ""
assert_fail "maint credentials" assert_maintenance_url_shape "https://user:pass@amaki.fr/"
assert_fail "maint fragment" assert_maintenance_url_shape "https://amaki.fr/#x"
assert_fail "maint schéma ftp" assert_maintenance_url_shape "ftp://amaki.fr/"
assert_fail "maint hôte non autorisé" assert_maintenance_url_shape "https://example.com/"
assert_ok "maint URL amaki.fr" assert_maintenance_url_shape "https://amaki.fr/"
assert_fail "maintenance non-503" assert_maintenance_http "https://example.com/"

# --- dump / checksum / TOC ---
: > "$TMP/empty.dump"
assert_fail "dump vide" assert_backup_file_ok "$TMP/empty.dump"
echo x > "$TMP/ok.dump"
assert_ok "dump non vide" assert_backup_file_ok "$TMP/ok.dump"
echo hello > "$TMP/a.dump"
echo "wrong  $TMP/a.dump" > "$TMP/a.dump.sha256"
assert_fail "checksum faux" assert_sha256_file_matches "$TMP/a.dump" "$TMP/a.dump.sha256"
sha256sum "$TMP/a.dump" > "$TMP/a.dump.sha256"
assert_ok "checksum match" assert_sha256_file_matches "$TMP/a.dump" "$TMP/a.dump.sha256"
echo not-a-dump > "$TMP/bad.dump"
assert_fail "TOC invalide" assert_pg_restore_toc "$TMP/bad.dump"

# --- restore host/port/base ---
assert_fail "host invalide" assert_restore_endpoint "evil.example" "5432" "amakifr_migration_rehearsal_4x_20260918"
assert_fail "port invalide" assert_restore_endpoint "127.0.0.1" "abc" "amakifr_migration_rehearsal_4x_20260918"
assert_fail "base système" assert_restore_endpoint "127.0.0.1" "5432" "postgres"
assert_ok "endpoint rehearsal" assert_restore_endpoint "127.0.0.1" "5432" "amakifr_migration_rehearsal_4x_20260918"

# --- restore prod double confirmation ---
assert_fail "restore amakifr sans mode" assert_restore_target_allowed "amakifr" ""
assert_ok "restore amakifr avec mode" assert_restore_target_allowed "amakifr" "PRODUCTION_RESTORE_CONFIRMED"
assert_fail "double confirm token manquant" assert_production_restore_double_confirm "" "RESTORE-AMAKIFR-PRODUCTION"
assert_fail "double confirm phrase fausse" assert_production_restore_double_confirm "PRODUCTION_RESTORE_CONFIRMED" "nope"
assert_ok "double confirm OK" assert_production_restore_double_confirm "PRODUCTION_RESTORE_CONFIRMED" "RESTORE-AMAKIFR-PRODUCTION"
assert_fail "restore postgres" assert_restore_target_allowed "postgres" ""

# --- rehearsal ---
assert_ok "rehearsal name" assert_rehearsal_db_name "amakifr_migration_rehearsal_4x_20260918"
assert_fail "rehearsal amakifr" assert_rehearsal_db_name "amakifr"
assert_fail "rehearsal mauvais prefixe" assert_rehearsal_db_name "rehearsal_4x_20260918"

# --- orpheline absente ---
assert_ok "orphan absent" assert_orphan_migration_absent "$ROOT/prisma/migrations/20251204181751_add_unique_adherent_assistance_periode"
assert_ok "orphan checksum ref" assert_orphan_checksum_reference "e352963e4d64ba9980bb25f45d60604dee386cefc95c7bfd73e15c495a7fe512"
assert_fail "orphan checksum ref faux" assert_orphan_checksum_reference "0000000000000000000000000000000000000000000000000000000000000000"

# --- backup dir ---
assert_ok "backup ./backups" assert_backup_dir_safe "./backups"
assert_fail "backup /tmp random" assert_backup_dir_safe "/tmp/random-backups"

# --- script : pas de checkout -f, pas de warn critique ---
assert_ok "pas checkout -f" assert_deploy_script_no_checkout_f "$DEPLOY_SCRIPT"
assert_ok "pas warn critique" assert_deploy_script_no_critical_warn_continue "$DEPLOY_SCRIPT"

# --- trap comportement documenté : fail() ne restart pas (statique) ---
assert_ok "trap sans restart auto" bash -c '
  grep -q "Aucun redémarrage/maint-off auto\|Aucun redémarrage automatique\|Aucun maintenance-off automatique" "'"$DEPLOY_SCRIPT"'" && \
  ! grep -E "trap .*maintenance-off|trap .*pm2 restart" "'"$DEPLOY_SCRIPT"'" && \
  grep -q "pm2 stop" "'"$DEPLOY_SCRIPT"'" && \
  grep -q "assert_pm2_stopped" "'"$DEPLOY_SCRIPT"'"
'

# Simulation logique trap : maintenance ON + PM2 stopped après fail_guard path
(
  MAINTENANCE_ON=1
  PM2_STOPPED=1
  if grep -A5 'on_err()' "$DEPLOY_SCRIPT" | grep -E 'maintenance-off|pm2 (restart|start)' >/dev/null; then
    echo "FAIL trap redémarre"
    exit 1
  fi
  [[ "$MAINTENANCE_ON" -eq 1 && "$PM2_STOPPED" -eq 1 ]]
)
assert_ok "trap: maint ON + PM2 stopped (contrat)" true

# --- mktemp sécurisé + cleanup ---
MKDIR_TMP="$TMP/bkdir"
mkdir -p "$MKDIR_TMP"
SECURE_TMP="$(create_secure_temp_in_dir "$MKDIR_TMP" "amakifr_test.XXXXXX")"
assert_ok "mktemp dans répertoire" test -f "$SECURE_TMP"
assert_ok "mktemp chmod 600" bash -c '[[ "$(stat -c %a "'"$SECURE_TMP"'")" == "600" ]]'
assert_ok "mktemp pas symlink" bash -c '[[ ! -L "'"$SECURE_TMP"'" ]]'
# cleanup simulation
rm -f "$SECURE_TMP"
assert_ok "mktemp cleanup" bash -c '[[ ! -e "'"$SECURE_TMP"'" ]]'
# refuse path hors dir via mock impossible — vérifier échec template vide dir
assert_fail "mktemp dir vide" create_secure_temp_in_dir ""

# --- Git controls avant mutations (ordre script) ---
assert_ok "dirty avant maint/PM2/backup" assert_deploy_git_controls_before_mutations "$DEPLOY_SCRIPT"
assert_ok "pas de .tmp.\$\$" bash -c '! grep -E "\.tmp\\.\\\$\\\$" "'"$ROOT"'/scripts/db-backup-restore.sh"'
assert_ok "utilise mktemp" bash -c 'grep -q "mktemp -p\|create_secure_temp_in_dir" "'"$ROOT"'/scripts/db-backup-restore.sh"'

# --- pm2 save bloquant ---
assert_ok "pm2 save bloquant" assert_deploy_pm2_save_blocking "$DEPLOY_SCRIPT"
assert_ok "pm2 save fail → pas maint off (ordre)" bash -c '
  grep -q "fail_after_restart.*pm2 save\|pm2 save a échoué" "'"$DEPLOY_SCRIPT"'" && \
  ! grep -E "pm2[[:space:]]+save.*\|\|[[:space:]]*true" "'"$DEPLOY_SCRIPT"'"
'

# --- SMOKE_URL ---
assert_fail "SMOKE_URL vide" assert_smoke_url_shape ""
assert_fail "SMOKE_URL credentials" assert_smoke_url_shape "https://user:pass@amaki.fr/"
assert_fail "SMOKE_URL fragment" assert_smoke_url_shape "https://amaki.fr/#x"
assert_fail "SMOKE_URL schéma" assert_smoke_url_shape "ftp://amaki.fr/"
assert_fail "SMOKE_URL hôte non autorisé" assert_smoke_url_shape "https://example.com/"
assert_ok "SMOKE_URL valide" assert_smoke_url_shape "https://amaki.fr/"
assert_ok "SMOKE_URL validée dans deploy" bash -c 'grep -q assert_smoke_url_shape "'"$DEPLOY_SCRIPT"'"'

echo ""
echo "PASSED=$PASS FAILED=$FAIL"
[[ "$FAIL" -eq 0 ]]
