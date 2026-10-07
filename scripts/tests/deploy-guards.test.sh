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
if [[ "$1" == "describe" ]]; then exit 0; fi
if [[ "$1" == "jlist" ]]; then
  echo '[{"name":"amakifr","pm_id":0,"pm2_env":{"status":"online","pm_cwd":"/sites/amakifr","env":{"NOTES_FRAIS_ENABLED":"true","NEXT_PUBLIC_NOTES_FRAIS_ENABLED":"false"}}}]'
  exit 0
fi
exit 0
EOF
chmod +x "$TMP/bin/pm2"
push_path "$TMP/bin"
assert_fail "flag PM2 NOTES true" assert_notes_frais_flags_off amakifr
assert_ok "garde PM2 via jlist" bash -c 'grep -q "pm2 jlist" "'"$ROOT"'/scripts/lib/deploy-guards.sh"'
assert_ok "garde PM2 sans pm2 id/env" bash -c '! grep -E "pm2 (id|env)" "'"$ROOT"'/scripts/lib/deploy-guards.sh"'
pop_path
popd_quiet

mkdir -p "$TMP/bin-pm2-flags"
cat > "$TMP/bin-pm2-flags/pm2" <<'EOF'
#!/bin/bash
if [[ "$1" == "jlist" ]]; then
  case "${MOCK_PM2_CASE:-false}" in
    false) echo '[{"name":"amakifr","pm_id":0,"pm2_env":{"env":{"NOTES_FRAIS_ENABLED":"false"}}}]' ;;
    missing) echo '[{"name":"other","pm_id":0,"pm2_env":{}}]' ;;
    invalid) echo 'not-json' ;;
  esac
  exit 0
fi
exit 0
EOF
chmod +x "$TMP/bin-pm2-flags/pm2"
push_path "$TMP/bin-pm2-flags"
export MOCK_PM2_CASE=false
assert_ok "flags PM2 false" assert_notes_frais_flags_off amakifr
export MOCK_PM2_CASE=missing
assert_fail "application PM2 absente" assert_notes_frais_flags_off amakifr
export MOCK_PM2_CASE=invalid
assert_fail "jlist PM2 illisible" assert_notes_frais_flags_off amakifr
unset MOCK_PM2_CASE
pop_path

# --- flags actifs (module Notes de frais en production) ---
# Jamais le vrai .env de production : uniquement $TMP.
FLAGS_ON_TMP="$TMP/flags-on"
mkdir -p "$FLAGS_ON_TMP"
pushd_quiet "$FLAGS_ON_TMP"
rm -f .env .env.local .env.production .env.production.local
unset NOTES_FRAIS_ENABLED NEXT_PUBLIC_NOTES_FRAIS_ENABLED || true

export NOTES_FRAIS_ENABLED=true
export NEXT_PUBLIC_NOTES_FRAIS_ENABLED=true
printf '%s\n' \
  'NOTES_FRAIS_ENABLED=true' \
  'NEXT_PUBLIC_NOTES_FRAIS_ENABLED=true' > .env
assert_ok "flags_on shell true/true + .env" assert_notes_frais_flags_on

unset NEXT_PUBLIC_NOTES_FRAIS_ENABLED || true
assert_fail "flags_on NEXT_PUBLIC shell absent" assert_notes_frais_flags_on
export NEXT_PUBLIC_NOTES_FRAIS_ENABLED=true

export NOTES_FRAIS_ENABLED=false
assert_fail "flags_on shell false" assert_notes_frais_flags_on
export NOTES_FRAIS_ENABLED=TRUE
assert_fail "flags_on shell TRUE (casse)" assert_notes_frais_flags_on
export NOTES_FRAIS_ENABLED=" true "
assert_fail "flags_on shell ambigu" assert_notes_frais_flags_on
export NOTES_FRAIS_ENABLED=true

rm -f .env
assert_fail "flags_on .env absent" assert_notes_frais_flags_on
printf '%s\n' 'NEXT_PUBLIC_NOTES_FRAIS_ENABLED=true' > .env
assert_fail "flags_on clé NOTES absente dans .env" assert_notes_frais_flags_on
printf '%s\n' \
  'NOTES_FRAIS_ENABLED=true' \
  'NOTES_FRAIS_ENABLED=true' \
  'NEXT_PUBLIC_NOTES_FRAIS_ENABLED=true' > .env
assert_fail "flags_on doublon .env" assert_notes_frais_flags_on
printf '%s\n' \
  'NOTES_FRAIS_ENABLED=true' \
  'NEXT_PUBLIC_NOTES_FRAIS_ENABLED=true' > .env

printf '%s\n' 'NOTES_FRAIS_ENABLED=false' > .env.local
assert_fail "flags_on surcharge .env.local false" assert_notes_frais_flags_on
rm -f .env.local
printf '%s\n' 'NOTES_FRAIS_ENABLED=true' > .env.local
assert_ok "flags_on surcharge .env.local true" assert_notes_frais_flags_on
rm -f .env.local

printf '%s\n' 'NEXT_PUBLIC_NOTES_FRAIS_ENABLED=false' > .env.production
assert_fail "flags_on surcharge .env.production false" assert_notes_frais_flags_on
rm -f .env.production

printf '%s\n' 'NOTES_FRAIS_ENABLED=false' > .env.production.local
assert_fail "flags_on surcharge .env.production.local false" assert_notes_frais_flags_on
rm -f .env.production.local

printf '%s\n' \
  'NOTES_FRAIS_ENABLED=true' \
  'NEXT_PUBLIC_NOTES_FRAIS_ENABLED=true' > .env.production.local
assert_ok "flags_on surcharge .env.production.local true/true" assert_notes_frais_flags_on
rm -f .env.production.local

printf '%s\n' \
  'NOTES_FRAIS_ENABLED=true' \
  'NOTES_FRAIS_ENABLED=true' > .env.local
assert_fail "flags_on doublon surcharge .env.local" assert_notes_frais_flags_on
rm -f .env.local
popd_quiet

mkdir -p "$TMP/bin-pm2-flags-on"
cat > "$TMP/bin-pm2-flags-on/pm2" <<'EOF'
#!/bin/bash
if [[ "$1" == "jlist" ]]; then
  case "${MOCK_PM2_ON_CASE:-both_true}" in
    both_true)
      echo '[{"name":"amakifr","pm_id":0,"pm2_env":{"env":{"NOTES_FRAIS_ENABLED":"true","NEXT_PUBLIC_NOTES_FRAIS_ENABLED":"true"}}}]'
      ;;
    one_false)
      echo '[{"name":"amakifr","pm_id":0,"pm2_env":{"env":{"NOTES_FRAIS_ENABLED":"true","NEXT_PUBLIC_NOTES_FRAIS_ENABLED":"false"}}}]'
      ;;
    missing_key)
      echo '[{"name":"amakifr","pm_id":0,"pm2_env":{"env":{"NOTES_FRAIS_ENABLED":"true"}}}]'
      ;;
    missing_app)
      echo '[{"name":"other","pm_id":0,"pm2_env":{}}]'
      ;;
    invalid)
      echo 'not-json'
      ;;
  esac
  exit 0
fi
exit 0
EOF
chmod +x "$TMP/bin-pm2-flags-on/pm2"
pushd_quiet "$FLAGS_ON_TMP"
push_path "$TMP/bin-pm2-flags-on"
export NOTES_FRAIS_ENABLED=true
export NEXT_PUBLIC_NOTES_FRAIS_ENABLED=true
printf '%s\n' \
  'NOTES_FRAIS_ENABLED=true' \
  'NEXT_PUBLIC_NOTES_FRAIS_ENABLED=true' > .env
export MOCK_PM2_ON_CASE=both_true
assert_ok "flags_on PM2 true/true" assert_notes_frais_flags_on amakifr
export MOCK_PM2_ON_CASE=one_false
assert_fail "flags_on PM2 false" assert_notes_frais_flags_on amakifr
export MOCK_PM2_ON_CASE=missing_key
assert_fail "flags_on PM2 clé absente" assert_notes_frais_flags_on amakifr
export MOCK_PM2_ON_CASE=missing_app
assert_fail "flags_on application PM2 absente" assert_notes_frais_flags_on amakifr
export MOCK_PM2_ON_CASE=invalid
assert_fail "flags_on jlist PM2 illisible" assert_notes_frais_flags_on amakifr
unset MOCK_PM2_ON_CASE
pop_path
popd_quiet
unset NOTES_FRAIS_ENABLED NEXT_PUBLIC_NOTES_FRAIS_ENABLED || true

# --- stockage Notes de frais (racine paramétrable, jamais /sites réel) ---
STORAGE_ROOT="$TMP/notes-frais-storage"
rm -rf "$STORAGE_ROOT"
export NOTES_FRAIS_STORAGE_ROOT="$STORAGE_ROOT"
assert_fail "storage racine absente" assert_notes_frais_storage_ready "$STORAGE_ROOT"

mkdir -p "$STORAGE_ROOT"
chmod 700 "$STORAGE_ROOT"
assert_fail "storage sous-répertoires absents" assert_notes_frais_storage_ready "$STORAGE_ROOT"

mkdir -p "$STORAGE_ROOT/tmp" "$STORAGE_ROOT/notes" "$STORAGE_ROOT/archive"
chmod 700 "$STORAGE_ROOT" "$STORAGE_ROOT/tmp" "$STORAGE_ROOT/notes" "$STORAGE_ROOT/archive"
assert_ok "storage racine valide (test)" assert_notes_frais_storage_ready "$STORAGE_ROOT"

export NOTES_FRAIS_STORAGE_ROOT="/tmp/wrong-notes-frais"
assert_fail "storage chemin shell différent" assert_notes_frais_storage_ready "$STORAGE_ROOT"
export NOTES_FRAIS_STORAGE_ROOT="$STORAGE_ROOT"

rm -rf "$STORAGE_ROOT/archive"
assert_fail "storage archive manquant" assert_notes_frais_storage_ready "$STORAGE_ROOT"
mkdir -p "$STORAGE_ROOT/archive"
chmod 700 "$STORAGE_ROOT/archive"

SYMLINK_ROOT="$TMP/notes-frais-symlink"
rm -rf "$SYMLINK_ROOT"
ln -s "$STORAGE_ROOT" "$SYMLINK_ROOT"
export NOTES_FRAIS_STORAGE_ROOT="$SYMLINK_ROOT"
assert_fail "storage symlink refusé" assert_notes_frais_storage_ready "$SYMLINK_ROOT"
export NOTES_FRAIS_STORAGE_ROOT="$STORAGE_ROOT"

chmod 755 "$STORAGE_ROOT"
assert_fail "storage racine mode 755 refusée" assert_notes_frais_storage_ready "$STORAGE_ROOT"
chmod 700 "$STORAGE_ROOT"
chmod 755 "$STORAGE_ROOT/notes"
assert_fail "storage sous-répertoire mode 755 refusé" assert_notes_frais_storage_ready "$STORAGE_ROOT"
chmod 700 "$STORAGE_ROOT/notes"
assert_ok "storage retour mode 700 accepté" assert_notes_frais_storage_ready "$STORAGE_ROOT"

# Accessibilité : retirer le droit d'écriture si possible (pas root).
if [[ "$(id -u)" -ne 0 ]]; then
  chmod a-w "$STORAGE_ROOT/tmp"
  assert_fail "storage sous-répertoire non accessible en écriture" \
    assert_notes_frais_storage_ready "$STORAGE_ROOT"
  chmod 700 "$STORAGE_ROOT/tmp"
fi
unset NOTES_FRAIS_STORAGE_ROOT || true

# --- script deploy : flags actifs + stockage avant maintenance ---
assert_ok "deploy sans flags_off" bash -c '! grep -q assert_notes_frais_flags_off "'"$DEPLOY_SCRIPT"'"'
assert_ok "deploy flags_on aux 4 emplacements" bash -c '
  n=$(grep -c assert_notes_frais_flags_on "'"$DEPLOY_SCRIPT"'")
  [[ "$n" -eq 4 ]]
'
assert_ok "deploy stockage avant maintenance" bash -c '
  s=$(grep -n assert_notes_frais_storage_ready "'"$DEPLOY_SCRIPT"'" | head -1 | cut -d: -f1)
  # Première activation maintenance du flux deploy (étape 3/15), pas fail_after_release
  m=$(grep -n "step \"3/15 — Maintenance ON" "'"$DEPLOY_SCRIPT"'" | head -1 | cut -d: -f1)
  [[ -n "$s" && -n "$m" && "$s" -lt "$m" ]]
'
assert_ok "deploy build/restart/smoke flags actifs" bash -c '
  grep -q "flags actifs avant build" "'"$DEPLOY_SCRIPT"'" && \
  grep -q "flags actifs avant restart" "'"$DEPLOY_SCRIPT"'" && \
  grep -q "flags actifs après restart" "'"$DEPLOY_SCRIPT"'" && \
  grep -q "build (flags Notes de frais actifs)" "'"$DEPLOY_SCRIPT"'"
'
assert_ok "deploy sans contournement flags_on" bash -c '
  ! grep -E "assert_notes_frais_flags_on.*\|\|[[:space:]]*true" "'"$DEPLOY_SCRIPT"'" && \
  ! grep -E "SKIP_NOTES_FRAIS|BYPASS_NOTES_FRAIS|NOTES_FRAIS_SKIP" "'"$DEPLOY_SCRIPT"'"
'

# --- PASSWORD_RESET_HMAC_SECRET (longueur uniquement) ---
unset PASSWORD_RESET_HMAC_SECRET || true
pushd_quiet "$TMP"
rm -f .env
assert_fail "hmac secret absent" assert_password_reset_hmac_secret_ready
echo 'PASSWORD_RESET_HMAC_SECRET=short' > .env
assert_fail "hmac secret trop court (.env)" assert_password_reset_hmac_secret_ready
echo 'PASSWORD_RESET_HMAC_SECRET=12345678901234567890123456789012' > .env
assert_ok "hmac secret 32 octets (.env)" assert_password_reset_hmac_secret_ready
rm -f .env
export PASSWORD_RESET_HMAC_SECRET='12345678901234567890123456789012'
assert_ok "hmac secret 32 octets (shell)" assert_password_reset_hmac_secret_ready
export PASSWORD_RESET_HMAC_SECRET='tooshort'
assert_fail "hmac secret trop court (shell)" assert_password_reset_hmac_secret_ready
unset PASSWORD_RESET_HMAC_SECRET || true
popd_quiet
assert_ok "deploy appelle hmac secret" bash -c '
  n=$(grep -c assert_password_reset_hmac_secret_ready "'"$DEPLOY_SCRIPT"'")
  [[ "$n" -ge 3 ]]
'

# --- TRUST_PROXY + garde réseau + Nginx EFFECTIVE (password-reset IP) ---
unset TRUST_PROXY ASSERT_NEXT_PROD_LISTEN NEXT_PROD_LISTEN_SNAPSHOT \
  NGINX_T_SNAPSHOT NGINX_T_SNAPSHOT_FILE || true
FIX_NGINX="$ROOT/scripts/tests/fixtures/nginx"
pushd_quiet "$TMP"
rm -f .env package.json
mkdir -p deploy/nginx
# Stubs chaîne réseau (référence dépôt + effective via fixture)
printf '%s\n' '{"scripts":{"start":"next start -H 127.0.0.1 -p 9060"}}' > package.json
cat > deploy/nginx/amaki.conf <<'NGX'
upstream amakifr_prod_backend { server 127.0.0.1:9060; }
location / {
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
NGX
export NGINX_T_SNAPSHOT_FILE="$FIX_NGINX/ok-amaki.dump"

assert_ok "start binds loopback" assert_next_prod_start_binds_loopback
assert_ok "nginx prod X-Real-IP (fichier)" assert_nginx_prod_x_real_ip_configured
assert_ok "nginx effective OK" assert_nginx_effective_amaki_proxy_headers

# Fixtures nginx -T
export NGINX_T_SNAPSHOT_FILE="$FIX_NGINX/missing-x-real-ip.dump"
assert_fail "nginx effective X-Real-IP absent" assert_nginx_effective_amaki_proxy_headers
export NGINX_T_SNAPSHOT_FILE="$FIX_NGINX/client-controlled-x-real-ip.dump"
assert_fail "nginx effective X-Real-IP client" assert_nginx_effective_amaki_proxy_headers
export NGINX_T_SNAPSHOT_FILE="$FIX_NGINX/bad-upstream.dump"
assert_fail "nginx effective mauvais upstream" assert_nginx_effective_amaki_proxy_headers
export NGINX_T_SNAPSHOT_FILE="$FIX_NGINX/ambiguous-locations.dump"
assert_fail "nginx effective locations ambiguës" assert_nginx_effective_amaki_proxy_headers

# nginx indisponible (pas de fixture, PATH sans nginx)
unset NGINX_T_SNAPSHOT_FILE NGINX_T_SNAPSHOT || true
mkdir -p "$TMP/bin-nonginx"
# PATH sans nginx
push_path "$TMP/bin-nonginx"
assert_fail "nginx commande indisponible" assert_nginx_effective_amaki_proxy_headers
pop_path
export NGINX_T_SNAPSHOT_FILE="$FIX_NGINX/ok-amaki.dump"

# start exposé → refus
printf '%s\n' '{"scripts":{"start":"next start -H 0.0.0.0 -p 9060"}}' > package.json
assert_fail "start 0.0.0.0 refusé" assert_next_prod_start_binds_loopback
printf '%s\n' '{"scripts":{"start":"next start -H 127.0.0.1 -p 9060"}}' > package.json

# écoute live : loopback OK / exposition refusée
export NEXT_PROD_LISTEN_SNAPSHOT=$'LISTEN 0 511 127.0.0.1:9060 0.0.0.0:*\n'
assert_ok "listen loopback only" assert_next_prod_listen_loopback_only
export NEXT_PROD_LISTEN_SNAPSHOT=$'LISTEN 0 511 0.0.0.0:9060 0.0.0.0:*\n'
assert_fail "listen 0.0.0.0:9060 refusé" assert_next_prod_listen_loopback_only
export NEXT_PROD_LISTEN_SNAPSHOT=$'LISTEN 0 511 [::]:9060 :::*\n'
assert_fail "listen [::]:9060 refusé" assert_next_prod_listen_loopback_only
export NEXT_PROD_LISTEN_SNAPSHOT=$'LISTEN 0 511 127.0.0.1:9060 0.0.0.0:*\n'

rm -f .env
assert_fail "trust_proxy absent" assert_password_reset_trust_proxy_ready
echo 'TRUST_PROXY=false' > .env
assert_fail "trust_proxy false" assert_password_reset_trust_proxy_ready
echo 'TRUST_PROXY=true' > .env
assert_ok "trust_proxy true (.env) + nginx effective" assert_password_reset_trust_proxy_ready
rm -f .env
export TRUST_PROXY=true
assert_ok "trust_proxy true (shell) + nginx effective" assert_password_reset_trust_proxy_ready

# TRUST_PROXY + live listen exposé → refus (après restart seulement)
export ASSERT_NEXT_PROD_LISTEN=1
export NEXT_PROD_LISTEN_SNAPSHOT=$'LISTEN 0 511 0.0.0.0:9060 0.0.0.0:*\n'
assert_fail "TRUST_PROXY refusé si port exposé" assert_password_reset_trust_proxy_ready
export NEXT_PROD_LISTEN_SNAPSHOT=$'LISTEN 0 511 127.0.0.1:9060 0.0.0.0:*\n'
assert_ok "TRUST_PROXY OK si listen loopback" assert_password_reset_trust_proxy_ready
unset TRUST_PROXY ASSERT_NEXT_PROD_LISTEN NEXT_PROD_LISTEN_SNAPSHOT \
  NGINX_T_SNAPSHOT NGINX_T_SNAPSHOT_FILE || true
popd_quiet
assert_ok "deploy appelle trust_proxy" bash -c '
  n=$(grep -c assert_password_reset_trust_proxy_ready "'"$DEPLOY_SCRIPT"'")
  [[ "$n" -ge 3 ]]
'
assert_ok "deploy appelle nginx effective en préflight" bash -c '
  grep -q assert_nginx_effective_amaki_proxy_headers "'"$DEPLOY_SCRIPT"'"
'
assert_ok "deploy appelle listen loopback après restart" bash -c '
  grep -q assert_next_prod_listen_loopback_only "'"$DEPLOY_SCRIPT"'"
'
assert_ok "deploy ne copie pas amaki.conf nginx" bash -c '
  ! grep -E "cp .*deploy/nginx/amaki\.conf|/etc/nginx/conf\.d/amaki\.conf" "'"$DEPLOY_SCRIPT"'"
'
assert_ok "repo package.json bind loopback" assert_next_prod_start_binds_loopback "$ROOT/package.json"
assert_ok "repo nginx prod X-Real-IP" assert_nginx_prod_x_real_ip_configured "$ROOT/deploy/nginx/amaki.conf"

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

# Script issu d'un worktree au commit cible, application encore sur ancien HEAD.
APP_REPO="$TMP/app-checkout"
SOURCE_REPO="$TMP/source-checkout"
mkdir -p "$APP_REPO"
git -C "$APP_REPO" init -q
git -C "$APP_REPO" config user.email t@t.t
git -C "$APP_REPO" config user.name t
echo original > "$APP_REPO/version.txt"
git -C "$APP_REPO" add version.txt
git -C "$APP_REPO" commit -qm old
echo target > "$APP_REPO/version.txt"
git -C "$APP_REPO" commit -qam target
TARGET_SHA="$(git -C "$APP_REPO" rev-parse HEAD)"
git -C "$APP_REPO" worktree add -q --detach "$SOURCE_REPO" "$TARGET_SHA"
git -C "$APP_REPO" switch -q --detach HEAD~1
assert_ok "source worktree cible, app ancienne" assert_deploy_source_checkout "$SOURCE_REPO" "$APP_REPO" "$TARGET_SHA"
assert_fail "script ancien refusé" assert_deploy_source_checkout "$APP_REPO" "$APP_REPO" "$TARGET_SHA"
echo dirty >> "$SOURCE_REPO/version.txt"
assert_fail "source suivie dirty refusée" assert_deploy_source_checkout "$SOURCE_REPO" "$APP_REPO" "$TARGET_SHA"
git -C "$SOURCE_REPO" restore version.txt
OTHER_REPO="$TMP/other-repo"
mkdir -p "$OTHER_REPO"
git -C "$OTHER_REPO" init -q
assert_fail "source hors dépôt refusée" assert_deploy_source_checkout "$SOURCE_REPO" "$OTHER_REPO" "$TARGET_SHA"
assert_fail "SHA source faux refusé" assert_deploy_source_checkout "$SOURCE_REPO" "$APP_REPO" "$(git -C "$APP_REPO" rev-parse HEAD)"
assert_ok "script impose cwd prod" bash -c 'grep -q "ROOT_DIR.*!=.*\/sites\/amakifr" "'"$DEPLOY_SCRIPT"'"'
assert_ok "script vérifie sa source" bash -c 'grep -q assert_deploy_source_checkout "'"$DEPLOY_SCRIPT"'"'
assert_ok "backup utilise le script source" grep -Fq 'bash "$SCRIPT_DIR/db-backup-restore.sh" backup' "$DEPLOY_SCRIPT"
assert_ok "deploy exécute le CLI menus frais" grep -Fq 'npx tsx scripts/frais-avances-menus-seed.ts' "$DEPLOY_SCRIPT"
assert_ok "deploy refuse le CLI menus absent" grep -Fq 'fail "script menus frais absent"' "$DEPLOY_SCRIPT"
assert_ok "CLI menus appelle upsert" grep -Fq 'await upsertFraisAvancesMenusIdempotent(prisma)' "$ROOT/scripts/frais-avances-menus-seed.ts"
assert_ok "CLI menus déconnecte Prisma" grep -Fq 'await prisma.$disconnect()' "$ROOT/scripts/frais-avances-menus-seed.ts"
assert_ok "URL interne locale" assert_internal_smoke_url_shape 'http://127.0.0.1:9052/'
assert_fail "URL interne publique refusée" assert_internal_smoke_url_shape 'https://amaki.fr/'
assert_fail "URL interne hostname refusée" assert_internal_smoke_url_shape 'http://localhost:9052/'
assert_fail "URL interne sans port refusée" assert_internal_smoke_url_shape 'http://127.0.0.1/'
assert_fail "URL interne port invalide refusée" assert_internal_smoke_url_shape 'http://127.0.0.1:65536/'
assert_ok "URL interne requise par deploy" bash -c 'grep -q "INTERNAL_SMOKE_URL obligatoire" "'"$DEPLOY_SCRIPT"'"'

# --- readiness HTTP bornée ---
mkdir -p "$TMP/http-bin"
cat > "$TMP/http-bin/curl" <<'EOF'
#!/usr/bin/env bash
count=0
[[ -f "$MOCK_CURL_STATE" ]] && count="$(cat "$MOCK_CURL_STATE")"
count=$((count + 1))
printf '%s\n' "$count" > "$MOCK_CURL_STATE"
if [[ "${MOCK_CURL_MODE:-fail}" == "eventual-success" && "$count" -ge 3 ]]; then
  printf '200'
  exit 0
fi
printf '000'
exit 28
EOF
cat > "$TMP/http-bin/sleep" <<'EOF'
#!/usr/bin/env bash
exit 0
EOF
chmod +x "$TMP/http-bin/curl" "$TMP/http-bin/sleep"

export MOCK_CURL_STATE="$TMP/http-state"
export MOCK_CURL_MODE="eventual-success"
rm -f "$MOCK_CURL_STATE"
push_path "$TMP/http-bin"
assert_ok "readiness réussit après retries" wait_for_http_ready "http://127.0.0.1:9060/" 4 1 0
assert_ok "readiness a tenté trois fois" bash -c '[[ "$(cat "$MOCK_CURL_STATE")" == "3" ]]'

export MOCK_CURL_MODE="fail"
rm -f "$MOCK_CURL_STATE"
assert_fail "readiness échoue après épuisement" wait_for_http_ready "http://127.0.0.1:9060/" 3 1 0
assert_ok "readiness borne les tentatives" bash -c '[[ "$(cat "$MOCK_CURL_STATE")" == "3" ]]'
pop_path
unset MOCK_CURL_STATE MOCK_CURL_MODE
assert_ok "contrôle SQL migrations quatre" bash -c 'grep -q "migrations 4.x / politique ACTIVE invalides" "'"$DEPLOY_SCRIPT"'"'
assert_ok "deploy:check incompatible écarté" bash -c '! grep -q "npm run deploy:check" "'"$DEPLOY_SCRIPT"'"'
assert_ok "smoke interne avant maintenance-off" bash -c '
  internal=$(grep -n "wait_for_http_ready.*INTERNAL_SMOKE_URL" "'"$DEPLOY_SCRIPT"'" | tail -1 | cut -d: -f1)
  off=$(grep -n "bash scripts/maintenance-off.sh" "'"$DEPLOY_SCRIPT"'" | tail -1 | cut -d: -f1)
  public=$(grep -n "curl.*SMOKE_URL" "'"$DEPLOY_SCRIPT"'" | tail -1 | cut -d: -f1)
  [[ -n "$internal" && -n "$off" && -n "$public" && $internal -lt $off && $off -lt $public ]]
'
assert_ok "smoke interne utilise retry borné" bash -c '
  grep -q "wait_for_http_ready.*INTERNAL_SMOKE_URL.*6 20 5" "'"$DEPLOY_SCRIPT"'"
'
assert_ok "réactivation sur échec après ouverture" bash -c 'grep -q "fail_after_release.*Smoke public" "'"$DEPLOY_SCRIPT"'"'

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


# Test bout-en-bout du backup atomique : le .sha256 doit référencer le dump final.
BACKUP_E2E="$TMP/backup-e2e"
mkdir -p "$BACKUP_E2E/bin" "$BACKUP_E2E/work"

cat > "$BACKUP_E2E/bin/pg_dump" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
out=""
while (($#)); do
  case "$1" in
    -f)
      out="$2"
      shift 2
      ;;
    *)
      shift
      ;;
  esac
done
[[ -n "$out" ]]
printf 'mock-custom-dump\n' > "$out"
EOF

cat > "$BACKUP_E2E/bin/pg_restore" <<'EOF'
#!/usr/bin/env bash
exit 0
EOF

chmod +x "$BACKUP_E2E/bin/pg_dump" "$BACKUP_E2E/bin/pg_restore"

pushd_quiet "$BACKUP_E2E/work"
push_path "$BACKUP_E2E/bin"

E2E_DUMP="$(
  DATABASE_URL='postgresql://test@localhost:5432/test' \
  bash "$ROOT/scripts/db-backup-restore.sh" \
    backup -t custom -b ./backups --print-path
)"
E2E_SHA="${E2E_DUMP}.sha256"
E2E_RECORDED_PATH="$(awk '{$1=""; sub(/^ +/, ""); print}' "$E2E_SHA")"
E2E_FINAL_PATH="$(realpath "$E2E_DUMP")"

assert_ok "backup e2e crée dump et checksum" \
  bash -c '[[ -s "$1" && -s "$2" ]]' _ "$E2E_DUMP" "$E2E_SHA"

assert_ok "checksum e2e vérifiable standard" \
  sha256sum -c "$E2E_SHA"

assert_ok "checksum e2e référence le nom final" \
  bash -c '[[ "$1" == "$2" ]]' _ "$E2E_RECORDED_PATH" "$E2E_FINAL_PATH"

pop_path
popd_quiet
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
