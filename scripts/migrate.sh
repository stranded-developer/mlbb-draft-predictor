#!/usr/bin/env bash
# Applies supabase/migrations/*.sql to the Supabase database in order, once each (tracked in applied_migrations).
# The connection string is read from .env.db (git-ignored) — never committed or printed.
# Usage: npm run db:migrate
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ ! -f .env.db ]]; then
  echo "Missing .env.db — create it with: SUPABASE_DB_URL=\"postgresql://...\" (Supabase → Connect → Session pooler)." >&2
  exit 1
fi
set -a; source .env.db; set +a
: "${SUPABASE_DB_URL:?SUPABASE_DB_URL is not set in .env.db}"

PSQL="$(command -v psql || echo /opt/homebrew/opt/libpq/bin/psql)"
run() { "$PSQL" "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -q "$@"; }

run -c "create table if not exists applied_migrations (id text primary key, applied_at timestamptz not null default now());" >/dev/null

for file in supabase/migrations/*.sql; do
  name="$(basename "$file")"
  done_already="$(run -tA -c "select 1 from applied_migrations where id = '$name'")"
  if [[ "$done_already" == "1" ]]; then
    echo "skip  $name"
    continue
  fi
  echo "apply $name"
  run --single-transaction -c "set client_min_messages to warning" -f "$file"
  run -c "insert into applied_migrations (id) values ('$name') on conflict do nothing;" >/dev/null
done
echo "Database is up to date."
