#!/usr/bin/env bash
# Runs the SQL test suite against a freshly seeded local Supabase database.
#
# Usage: bun run test:db  (or: bash tests/db/run.sh)
#
# Connection: uses `psql "$SUPABASE_DB_URL"` when both psql is on PATH and
# SUPABASE_DB_URL is set; otherwise falls back to `docker exec` against the
# local Supabase Postgres container (name overridable via
# SUPABASE_DB_CONTAINER, default: supabase_db_renotrack).
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/../.."

SUPABASE_DB_CONTAINER="${SUPABASE_DB_CONTAINER:-supabase_db_renotrack}"

echo "==> supabase db reset"
supabase db reset

use_psql=false
if command -v psql >/dev/null 2>&1 && [ -n "${SUPABASE_DB_URL:-}" ]; then
  use_psql=true
fi

run_sql_file() {
  local file="$1"
  if [ "$use_psql" = true ]; then
    psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f "$file"
  else
    docker exec -i "$SUPABASE_DB_CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 < "$file"
  fi
}

failures=0
shopt -s nullglob
files=(tests/db/*.test.sql)
shopt -u nullglob

if [ "${#files[@]}" -eq 0 ]; then
  echo "No tests/db/*.test.sql files found."
  exit 0
fi

# Sorted order.
IFS=$'\n' sorted=($(sort <<<"${files[*]}")); unset IFS

for file in "${sorted[@]}"; do
  echo "==> ${file}"
  if run_sql_file "$file"; then
    echo "PASS: ${file}"
  else
    echo "FAIL: ${file}"
    failures=$((failures + 1))
  fi
done

if [ "$failures" -gt 0 ]; then
  echo "==> ${failures} SQL test file(s) failed"
  exit 1
fi

echo "==> All SQL test files passed"
