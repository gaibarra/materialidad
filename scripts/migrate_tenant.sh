#!/usr/bin/env bash
set -euo pipefail

SLUG="${1:-}"

cd "$(dirname "$0")/.."

if [[ -n "$SLUG" ]]; then
  python backend/manage.py migrate_tenant --slug "$SLUG"
else
  python backend/manage.py migrate_tenant
fi
