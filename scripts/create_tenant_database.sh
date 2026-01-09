#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 6 ]]; then
  echo "Uso: $0 <name> <slug> <db_name> <db_user> <db_password> <db_host> [db_port]"
  exit 1
fi

NAME="$1"
SLUG="$2"
DB_NAME="$3"
DB_USER="$4"
DB_PASSWORD="$5"
DB_HOST="$6"
DB_PORT="${7:-5432}"

export DJANGO_SETTINGS_MODULE="materialidad_backend.settings"

cd "$(dirname "$0")/.."
python backend/manage.py create_tenant "$NAME" "$SLUG" "$DB_NAME" "$DB_USER" "$DB_PASSWORD" "$DB_HOST" "$DB_PORT" --create-db
