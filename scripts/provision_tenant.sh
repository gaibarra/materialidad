#!/usr/bin/env bash
set -euo pipefail

# Script de aprovisionamiento rápido de tenants.
# Uso recomendado (no interactivo):
#   scripts/provision_tenant.sh \
#     --slug proyectog41 \
#     --name "Proyecto G41, S.A. de C.V." \
#     --db-name tenant_proyectog41 \
#     --db-user tenant_usr \
#     --db-pass "SuperSecreto" \
#     --db-host localhost --db-port 5432 \
#     --admin-email admin@demo.com --admin-pass "Passw0rd!" [--admin-name "Nombre Apellido"] \
#     [--despacho-id 1] [--currency MXN]

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

PYTHON_BIN="${PYTHON_BIN:-$ROOT_DIR/.venv/bin/python}"
if [[ ! -x "$PYTHON_BIN" ]]; then
  PYTHON_BIN="python3"
fi

SLUG=""
NAME=""
DB_NAME=""
DB_USER=""
DB_PASS=""
DB_HOST="localhost"
DB_PORT="5432"
ADMIN_EMAIL=""
ADMIN_PASS=""
ADMIN_NAME=""
DESPACHO_ID=""
CURRENCY="MXN"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --slug) SLUG="$2"; shift 2;;
    --name) NAME="$2"; shift 2;;
    --db-name) DB_NAME="$2"; shift 2;;
    --db-user) DB_USER="$2"; shift 2;;
    --db-pass) DB_PASS="$2"; shift 2;;
    --db-host) DB_HOST="$2"; shift 2;;
    --db-port) DB_PORT="$2"; shift 2;;
    --admin-email) ADMIN_EMAIL="$2"; shift 2;;
    --admin-pass) ADMIN_PASS="$2"; shift 2;;
    --admin-name) ADMIN_NAME="$2"; shift 2;;
    --despacho-id) DESPACHO_ID="$2"; shift 2;;
    --currency) CURRENCY="$2"; shift 2;;
    *) echo "Flag desconocida: $1"; exit 1;;
  esac
done

# Prompts mínimos si falta info esencial
if [[ -z "$SLUG" ]]; then read -rp "Slug (código): " SLUG; fi
if [[ -z "$NAME" ]]; then read -rp "Nombre legal: " NAME; fi
if [[ -z "$DB_NAME" ]]; then read -rp "Nombre de la base: " DB_NAME; fi
if [[ -z "$DB_USER" ]]; then read -rp "Usuario de la base: " DB_USER; fi
if [[ -z "$DB_PASS" ]]; then read -rsp "Password de la base: " DB_PASS; printf '\n'; fi
if [[ -z "$ADMIN_EMAIL" ]]; then read -rp "Correo admin inicial: " ADMIN_EMAIL; fi
if [[ -z "$ADMIN_PASS" ]]; then read -rsp "Password admin inicial: " ADMIN_PASS; printf '\n'; fi
if [[ -z "$ADMIN_NAME" ]]; then read -rp "Nombre completo admin (opcional): " ADMIN_NAME; fi
if [[ -z "$CURRENCY" ]]; then read -rp "Moneda por defecto [MXN]: " CURRENCY; CURRENCY="${CURRENCY:-MXN}"; fi

cat <<EOM
Resumen:
  Tenant:   $NAME ($SLUG)
  DB:       $DB_NAME@$DB_HOST:$DB_PORT (user: $DB_USER)
  Admin:    $ADMIN_EMAIL
  Despacho: ${DESPACHO_ID:-ninguno}
  Moneda:   $CURRENCY
EOM
read -rp "¿Continuar? [s/N]: " CONFIRM
if [[ ! $CONFIRM =~ ^[sS]$ ]]; then
  echo "Abortado"
  exit 1
fi

echo "[1/4] Migrando base de control"
"$PYTHON_BIN" backend/manage.py migrate --noinput

set +e
PROVISION_TENANT_SLUG="$SLUG" "$PYTHON_BIN" backend/manage.py shell <<'PY'
from tenancy.models import Tenant
import os, sys
slug = os.environ.get("PROVISION_TENANT_SLUG")
sys.exit(0 if Tenant.objects.filter(slug=slug).exists() else 1)
PY
EXISTS=$?
set -e

echo "[2/4] Asegurando rol de base de datos $DB_USER"
DB_USER_ENV="$DB_USER" DB_PASS_ENV="$DB_PASS" "$PYTHON_BIN" backend/manage.py shell <<'PY'
import os
from django.db import connections

username = os.environ["DB_USER_ENV"]
password = os.environ["DB_PASS_ENV"]
conn = connections["default"]
quote = conn.ops.quote_name
with conn.cursor() as cursor:
    cursor.execute("SELECT 1 FROM pg_roles WHERE rolname = %s", [username])
    exists = cursor.fetchone()
    if not exists:
        cursor.execute(f"CREATE ROLE {quote(username)} LOGIN PASSWORD %s", [password])
        print(f"Rol {username} creado")
    else:
        print(f"Rol {username} ya existe")
PY

if [[ $EXISTS -eq 0 ]]; then
  echo "[3/4] Tenant $SLUG ya existe; validando base de datos"
  TENANT_SLUG_ENV="$SLUG" \
  DB_NAME_ENV="$DB_NAME" \
  DB_USER_ENV="$DB_USER" \
  "$PYTHON_BIN" backend/manage.py shell <<'PY'
import os
from django.db import connections
from tenancy.models import Tenant

slug = os.environ["TENANT_SLUG_ENV"]
db_name = os.environ["DB_NAME_ENV"]
db_user = os.environ["DB_USER_ENV"]

tenant = Tenant.objects.get(slug=slug)
conn = connections["default"]
quote = conn.ops.quote_name
with conn.cursor() as cursor:
    cursor.execute("SELECT 1 FROM pg_database WHERE datname = %s", [db_name])
    exists = cursor.fetchone()
    if not exists:
        cursor.execute(f"CREATE DATABASE {quote(db_name)} OWNER {quote(db_user)}")
        print(f"Base {db_name} creada y asignada a {db_user}")
    else:
        print(f"Base {db_name} ya existe")
PY
else
  echo "[3/4] Creando tenant $SLUG"
  "$PYTHON_BIN" backend/manage.py create_tenant \
    "$NAME" \
    "$SLUG" \
    "$DB_NAME" \
    "$DB_USER" \
    "$DB_PASS" \
    "$DB_HOST" \
    "$DB_PORT" \
    --create-db
fi

echo "[4/7] Migrando base del tenant"
"$PYTHON_BIN" backend/manage.py migrate_tenant --slug "$SLUG"

echo "[5/7] Ajustando permisos de BD para $DB_USER en $DB_NAME"
sudo -u postgres psql -d "$DB_NAME" -c "
  GRANT ALL PRIVILEGES ON ALL TABLES    IN SCHEMA public TO \"$DB_USER\";
  GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO \"$DB_USER\";
  GRANT USAGE ON SCHEMA public TO \"$DB_USER\";
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES    TO \"$DB_USER\";
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO \"$DB_USER\";
" 2>/dev/null || echo "⚠ No se pudieron ajustar permisos automáticamente"

echo "[6/7] Ajustando despacho y moneda"
TENANT_SLUG_ENV="$SLUG" \
TENANT_DESPACHO_ID_ENV="$DESPACHO_ID" \
TENANT_CURRENCY_ENV="$CURRENCY" \
"$PYTHON_BIN" backend/manage.py shell <<'PY'
import os
from tenancy.models import Tenant, Despacho

slug = os.environ["TENANT_SLUG_ENV"]
currency = os.environ.get("TENANT_CURRENCY_ENV", "MXN") or "MXN"
despacho_id = os.environ.get("TENANT_DESPACHO_ID_ENV")

tenant = Tenant.objects.get(slug=slug)
tenant.default_currency = currency
if despacho_id:
  try:
    tenant.despacho = Despacho.objects.get(id=despacho_id)
  except Despacho.DoesNotExist:
    print(f"Despacho id {despacho_id} no existe; se omite")
tenant.save(update_fields=["default_currency", "despacho", "updated_at"])
print(f"Tenant {tenant.slug} actualizado con moneda {tenant.default_currency} y despacho {tenant.despacho_id}")
PY

echo "[7/7] Creando/actualizando superusuario del tenant"
TENANT_SLUG_ENV="$SLUG" \
TENANT_ADMIN_EMAIL_ENV="$ADMIN_EMAIL" \
TENANT_ADMIN_PASSWORD_ENV="$ADMIN_PASS" \
TENANT_ADMIN_NAME_ENV="$ADMIN_NAME" \
"$PYTHON_BIN" backend/manage.py shell <<'PY'
import os
from accounts.models import User
from tenancy.models import Tenant

slug = os.environ["TENANT_SLUG_ENV"]
email = os.environ["TENANT_ADMIN_EMAIL_ENV"].strip()
password = os.environ["TENANT_ADMIN_PASSWORD_ENV"]
full_name = os.environ.get("TENANT_ADMIN_NAME_ENV", "")

tenant = Tenant.objects.get(slug=slug)
manager = User.objects.db_manager("default")
user, _ = manager.get_or_create(
    email=email,
    defaults={"full_name": full_name or email, "is_staff": True, "is_superuser": True},
)
user.full_name = full_name or user.full_name
user.is_staff = True
user.is_superuser = True
user.tenant = tenant
user.set_password(password)
user.save()
print(f"Usuario {user.email} asociado al tenant {tenant.slug}")
PY

echo "Listo: tenant $SLUG operativo. Admin: $ADMIN_EMAIL"
