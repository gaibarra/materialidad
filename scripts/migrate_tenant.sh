#!/usr/bin/env bash
set -euo pipefail

# Migra uno o todos los tenants y ajusta permisos de BD automáticamente.

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

PYTHON_BIN="${PYTHON_BIN:-$ROOT_DIR/.venv/bin/python}"
if [[ ! -x "$PYTHON_BIN" ]]; then
  PYTHON_BIN="python3"
fi

SLUG="${1:-}"

if [[ -n "$SLUG" ]]; then
  "$PYTHON_BIN" backend/manage.py migrate_tenant --slug "$SLUG"
else
  "$PYTHON_BIN" backend/manage.py migrate_tenant
fi

# ── Ajustar permisos post-migración ──────────────────────────────
# Las migraciones corren con el usuario de la BD de control (settings.DATABASES['default']).
# Ese usuario queda como owner de las tablas nuevas, pero cada tenant se conecta con
# su propio db_user. Aquí otorgamos permisos completos al db_user del tenant.

grant_permissions() {
  local db_name="$1"
  local db_user="$2"
  echo "  → Otorgando permisos en $db_name a $db_user"
  sudo -u postgres psql -d "$db_name" -c "
    GRANT ALL PRIVILEGES ON ALL TABLES    IN SCHEMA public TO \"$db_user\";
    GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO \"$db_user\";
    GRANT USAGE ON SCHEMA public TO \"$db_user\";
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES    TO \"$db_user\";
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO \"$db_user\";
  " 2>/dev/null || echo "  ⚠ No se pudieron ajustar permisos en $db_name (¿sudo disponible?)"
}

echo ""
echo "Ajustando permisos de base de datos..."

if [[ -n "$SLUG" ]]; then
  # Un solo tenant
  read -r DB_NAME DB_USER < <(
    "$PYTHON_BIN" backend/manage.py shell -c "
from tenancy.models import Tenant
t = Tenant.objects.get(slug='$SLUG')
print(t.db_name, t.db_user)
" 2>/dev/null
  )
  if [[ -n "$DB_NAME" && -n "$DB_USER" ]]; then
    grant_permissions "$DB_NAME" "$DB_USER"
  fi
else
  # Todos los tenants
  "$PYTHON_BIN" backend/manage.py shell -c "
from tenancy.models import Tenant
for t in Tenant.objects.filter(is_active=True):
    print(t.db_name, t.db_user)
" 2>/dev/null | while read -r DB_NAME DB_USER; do
    if [[ -n "$DB_NAME" && -n "$DB_USER" ]]; then
      grant_permissions "$DB_NAME" "$DB_USER"
    fi
  done
fi

echo "Migración y permisos completados."
