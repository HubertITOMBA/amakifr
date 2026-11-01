#!/usr/bin/env bash
# Tests sans DB — POST_MIGRATE_ASSERT_SQL (branchement + ordre safe)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd -P)"
# shellcheck source=../lib/deploy-guards.sh
source "$ROOT/scripts/lib/deploy-guards.sh"

DEPLOY_SCRIPT="$ROOT/scripts/deploy-production-safe.sh"
SQL_FILE="$ROOT/scripts/assert-rappel-dette-lot3-post-migrate.sql"

PASS=0
FAIL=0

ok() {
  echo "  OK  $1"
  PASS=$((PASS + 1))
}
ko() {
  echo "  FAIL $1" >&2
  FAIL=$((FAIL + 1))
}

assert_ok() {
  local label="$1"
  shift
  if "$@" >/dev/null 2>&1; then
    ok "$label"
  else
    ko "$label"
  fi
}

assert_fail() {
  local label="$1"
  shift
  if "$@" >/dev/null 2>&1; then
    ko "$label (aurait dû échouer)"
  else
    ok "$label"
  fi
}

TMP="$(mktemp -d "${TMPDIR:-/tmp}/amakifr-post-migrate-assert.XXXXXX")"
cleanup() { rm -rf "$TMP"; }
trap cleanup EXIT

FAKE_OK="$TMP/psql-ok"
FAKE_FAIL="$TMP/psql-fail"
cat >"$FAKE_OK" <<'EOF'
#!/usr/bin/env bash
# Ne pas echo les args contenant postgresql://
exit 0
EOF
cat >"$FAKE_FAIL" <<'EOF'
#!/usr/bin/env bash
exit 42
EOF
chmod 755 "$FAKE_OK" "$FAKE_FAIL"

# Fichier SQL valide sous ROOT (copie minimale non vide pour tests chemin)
VALID_SQL="$ROOT/scripts/assert-rappel-dette-lot3-post-migrate.sql"
OUTSIDE_SQL="$TMP/outside.sql"
echo "SELECT 1;" >"$OUTSIDE_SQL"
EMPTY_SQL="$TMP/empty-under-root.sql"
# empty under root via symlink? better: create empty in ROOT is invasive.
# Use TMP empty for empty-file test with SCRIPT_ROOT=TMP tree that contains it.
TREE="$TMP/checkout"
mkdir -p "$TREE/scripts"
echo "-- ok" >"$TREE/scripts/assert-ok.sql"
: >"$TREE/scripts/assert-empty.sql"

URL_FAKE='postgresql://invalid:invalid@127.0.0.1:1/invalid_assert_only'

echo "=== bash -n ==="
assert_ok "bash -n deploy-production-safe.sh" bash -n "$DEPLOY_SCRIPT"
assert_ok "bash -n deploy-guards.sh" bash -n "$ROOT/scripts/lib/deploy-guards.sh"
assert_ok "bash -n ce test" bash -n "$0"

echo "=== ordre dans le safe (statique) ==="
assert_ok "appel run_post_migrate_assert_sql présent" \
  grep -q 'run_post_migrate_assert_sql' "$DEPLOY_SCRIPT"

LINE_OK="$(grep -n 'Contrôles SQL OK' "$DEPLOY_SCRIPT" | head -1 | cut -d: -f1)"
LINE_HOOK="$(grep -n 'run_post_migrate_assert_sql' "$DEPLOY_SCRIPT" | head -1 | cut -d: -f1)"
LINE_SEEDS="$(grep -n '12/15 — Seeds' "$DEPLOY_SCRIPT" | head -1 | cut -d: -f1)"
LINE_RESTART="$(grep -n '13/15 — Restart PM2' "$DEPLOY_SCRIPT" | head -1 | cut -d: -f1)"
LINE_MOFF="$(grep -n '15/15 — Maintenance OFF' "$DEPLOY_SCRIPT" | head -1 | cut -d: -f1)"

if [[ -n "$LINE_OK" && -n "$LINE_HOOK" && "$LINE_HOOK" -gt "$LINE_OK" ]]; then
  ok "hook après Contrôles SQL OK ($LINE_OK < $LINE_HOOK)"
else
  ko "hook après Contrôles SQL OK"
fi
if [[ -n "$LINE_HOOK" && -n "$LINE_SEEDS" && "$LINE_HOOK" -lt "$LINE_SEEDS" ]]; then
  ok "hook avant Seeds ($LINE_HOOK < $LINE_SEEDS)"
else
  ko "hook avant Seeds"
fi
if [[ -n "$LINE_HOOK" && -n "$LINE_RESTART" && "$LINE_HOOK" -lt "$LINE_RESTART" ]]; then
  ok "hook avant Restart ($LINE_HOOK < $LINE_RESTART)"
else
  ko "hook avant Restart"
fi
if [[ -n "$LINE_HOOK" && -n "$LINE_MOFF" && "$LINE_HOOK" -lt "$LINE_MOFF" ]]; then
  ok "hook avant Maintenance OFF ($LINE_HOOK < $LINE_MOFF)"
else
  ko "hook avant Maintenance OFF"
fi

# fail() : message maint ON ; pas d'invocation réelle pm2/maintenance-off (hors texte d'aide)
assert_ok "fail() mentionne maint ON / pas restart auto" bash -c '
  body=$(sed -n "/^fail()/,/^}/p" "'"$DEPLOY_SCRIPT"'")
  echo "$body" | grep -q "Maintenance reste ON" &&
  ! echo "$body" | grep -E "pm2[[:space:]]+restart[[:space:]]+\"|bash[[:space:]]+scripts/maintenance-off"
'

echo "=== historique sans variable ==="
unset POST_MIGRATE_ASSERT_SQL || true
unset PSQL_CMD || true
assert_ok "unset → no-op exit 0" \
  run_post_migrate_assert_sql "$ROOT" "$URL_FAKE"

echo "=== validations fichier ==="
export POST_MIGRATE_ASSERT_SQL=""
assert_fail "définie vide → fail" \
  run_post_migrate_assert_sql "$ROOT" "$URL_FAKE"

export POST_MIGRATE_ASSERT_SQL="$TREE/scripts/assert-missing.sql"
assert_fail "fichier absent → fail" \
  run_post_migrate_assert_sql "$TREE" "$URL_FAKE"

export POST_MIGRATE_ASSERT_SQL="$TREE/scripts/assert-empty.sql"
assert_fail "fichier vide → fail" \
  run_post_migrate_assert_sql "$TREE" "$URL_FAKE"

export POST_MIGRATE_ASSERT_SQL="$OUTSIDE_SQL"
assert_fail "hors SCRIPT_ROOT → fail" \
  run_post_migrate_assert_sql "$TREE" "$URL_FAKE"

echo "=== psql simulé ==="
export POST_MIGRATE_ASSERT_SQL="$TREE/scripts/assert-ok.sql"
export PSQL_CMD="$FAKE_OK"
assert_ok "psql OK → succès" \
  run_post_migrate_assert_sql "$TREE" "$URL_FAKE"

export PSQL_CMD="$FAKE_FAIL"
assert_fail "psql échec → fail" \
  run_post_migrate_assert_sql "$TREE" "$URL_FAKE"

# Le SQL versionné Lot 3 doit être non vide et sous ROOT
assert_ok "SQL Lot 3 versionné présent non vide" test -s "$SQL_FILE"
assert_ok "SQL Lot 3 sous scripts/" bash -c '
  realpath "'"$SQL_FILE"'" | grep -q "/scripts/assert-rappel-dette-lot3-post-migrate.sql$"
'
assert_ok "SQL sans DML métier (mots-clés en tête d'instruction)" bash -c '
  ! grep -Ei "^[[:space:]]*(INSERT|UPDATE|DELETE|DROP|TRUNCATE)[[:space:]]" "'"$SQL_FILE"'"
'

echo "=== simulation flux : échec bloque seeds/restart/maint-off ==="
# Micro-harness reproduisant l'ordre du safe autour du hook
SIM="$TMP/sim-flow.sh"
cat >"$SIM" <<'SIMEOF'
#!/usr/bin/env bash
set -euo pipefail
# shellcheck disable=SC1090
source "$1"
SCRIPT_ROOT="$2"
URL_SAFE="$3"
REACHED_SEEDS=0
REACHED_RESTART=0
REACHED_MOFF=0
fail() { echo "FAIL: $*" >&2; exit 1; }
echo "CTRL_SQL_OK"
run_post_migrate_assert_sql "$SCRIPT_ROOT" "$URL_SAFE" \
  || fail "POST_MIGRATE_ASSERT_SQL a échoué — runtime non redémarré, maintenance conservée"
REACHED_SEEDS=1
echo "SEEDS"
REACHED_RESTART=1
echo "RESTART"
REACHED_MOFF=1
echo "MOFF"
echo "REACHED_SEEDS=$REACHED_SEEDS REACHED_RESTART=$REACHED_RESTART REACHED_MOFF=$REACHED_MOFF"
SIMEOF
chmod +x "$SIM"

export POST_MIGRATE_ASSERT_SQL="$TREE/scripts/assert-ok.sql"
export PSQL_CMD="$FAKE_OK"
OUT_OK="$("$SIM" "$ROOT/scripts/lib/deploy-guards.sh" "$TREE" "$URL_FAKE" || true)"
if echo "$OUT_OK" | grep -q 'REACHED_SEEDS=1' \
  && echo "$OUT_OK" | grep -q 'REACHED_RESTART=1' \
  && echo "$OUT_OK" | grep -q 'REACHED_MOFF=1'; then
  ok "succès → seeds/restart/maint-off atteints"
else
  ko "succès → seeds/restart/maint-off atteints"
fi

export PSQL_CMD="$FAKE_FAIL"
set +e
OUT_FAIL="$("$SIM" "$ROOT/scripts/lib/deploy-guards.sh" "$TREE" "$URL_FAKE" 2>&1)"
RC_FAIL=$?
set -e
if [[ "$RC_FAIL" -ne 0 ]] \
  && ! echo "$OUT_FAIL" | grep -q 'REACHED_SEEDS=1' \
  && ! echo "$OUT_FAIL" | grep -q '^SEEDS$' \
  && ! echo "$OUT_FAIL" | grep -q '^RESTART$' \
  && ! echo "$OUT_FAIL" | grep -q '^MOFF$'; then
  ok "échec psql → stop avant seeds/restart/maint-off (rc=$RC_FAIL)"
else
  ko "échec psql → stop avant seeds/restart/maint-off"
  echo "$OUT_FAIL" >&2
fi

unset POST_MIGRATE_ASSERT_SQL || true
export PSQL_CMD="$FAKE_FAIL"
OUT_HIST="$("$SIM" "$ROOT/scripts/lib/deploy-guards.sh" "$TREE" "$URL_FAKE")"
if echo "$OUT_HIST" | grep -q 'REACHED_MOFF=1'; then
  ok "sans variable → flux historique complet (même si PSQL_CMD fail)"
else
  ko "sans variable → flux historique complet"
fi

echo ""
echo "Résultat: $PASS OK, $FAIL FAIL"
[[ "$FAIL" -eq 0 ]]
