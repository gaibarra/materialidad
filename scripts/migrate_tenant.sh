#!/usr/bin/env bash
set -euo pipefail

# Migra uno o todos los tenants y corrige ownership/permisos automáticamente.

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

PYTHON_BIN="${PYTHON_BIN:-$ROOT_DIR/.venv/bin/python}"
if [[ ! -x "$PYTHON_BIN" ]]; then
  PYTHON_BIN="python3"
fi

usage() {
  cat <<'EOM'
Uso:
  scripts/migrate_tenant.sh [slug] [--dry-run] [--continue-on-error] [--log-file ruta]

Opciones:
  --dry-run   Muestra acciones sin ejecutar cambios en BD ni migraciones.
  --continue-on-error
              Continúa con otros tenants aunque uno falle.
  --log-file  Escribe salida completa en un archivo (además de stdout).
  -h, --help  Muestra esta ayuda.

Ejemplos:
  scripts/migrate_tenant.sh
  scripts/migrate_tenant.sh proyectog41
  scripts/migrate_tenant.sh --dry-run
  scripts/migrate_tenant.sh proyectog41 --dry-run
  scripts/migrate_tenant.sh --continue-on-error --log-file logs/migrate_tenants_20260308.log
EOM
}

SLUG=""
DRY_RUN=0
CONTINUE_ON_ERROR=0
LOG_FILE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    --continue-on-error)
      CONTINUE_ON_ERROR=1
      shift
      ;;
    --log-file)
      if [[ $# -lt 2 ]]; then
        echo "Falta valor para --log-file"
        usage
        exit 1
      fi
      LOG_FILE="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    -* )
      echo "Flag desconocida: $1"
      usage
      exit 1
      ;;
    * )
      if [[ -n "$SLUG" ]]; then
        echo "Solo se permite un slug posicional. Recibido adicional: $1"
        usage
        exit 1
      fi
      SLUG="$1"
      shift
      ;;
  esac
done

if [[ -n "$LOG_FILE" ]]; then
  mkdir -p "$(dirname "$LOG_FILE")"
  exec > >(tee -a "$LOG_FILE") 2>&1
  echo "Log de ejecucion: $LOG_FILE"
fi

# ── Utilidades de ownership/permisos ─────────────────────────────
# Las migraciones de tenant corren con t.db_user. Si las tablas no pertenecen a ese
# usuario, PostgreSQL falla con "must be owner of table".

ensure_ownership() {
  local db_name="$1"
  local db_user="$2"
  if [[ "$DRY_RUN" -eq 1 ]]; then
    echo "  [dry-run] Corrigiendo ownership en $db_name para $db_user"
    return 0
  fi
  echo "  → Corrigiendo ownership en $db_name para $db_user"
  sudo -u postgres psql -d "$db_name" -v ON_ERROR_STOP=1 >/dev/null <<SQL
ALTER SCHEMA public OWNER TO "$db_user";
DO \$do\$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I OWNER TO %I', r.tablename, '$db_user');
  END LOOP;

  FOR r IN SELECT sequencename FROM pg_sequences WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER SEQUENCE public.%I OWNER TO %I', r.sequencename, '$db_user');
  END LOOP;

  FOR r IN SELECT viewname FROM pg_views WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER VIEW public.%I OWNER TO %I', r.viewname, '$db_user');
  END LOOP;
END
\$do\$;
SQL
}

grant_permissions() {
  local db_name="$1"
  local db_user="$2"
  if [[ "$DRY_RUN" -eq 1 ]]; then
    echo "  [dry-run] Otorgando permisos en $db_name a $db_user"
    return 0
  fi
  echo "  → Otorgando permisos en $db_name a $db_user"
  sudo -u postgres psql -d "$db_name" -c "
    GRANT ALL PRIVILEGES ON ALL TABLES    IN SCHEMA public TO \"$db_user\";
    GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO \"$db_user\";
    GRANT USAGE ON SCHEMA public TO \"$db_user\";
    GRANT CREATE ON SCHEMA public TO \"$db_user\";
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES    TO \"$db_user\";
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO \"$db_user\";
  " 2>/dev/null || echo "  ⚠ No se pudieron ajustar permisos en $db_name (¿sudo disponible?)"
}

echo ""
echo "Preparando ownership y permisos de base de datos..."
if [[ "$DRY_RUN" -eq 1 ]]; then
  echo "Modo dry-run activo: no se aplicaran cambios."
fi

if [[ -n "$SLUG" ]]; then
  TENANT_ROWS="$(
    "$PYTHON_BIN" backend/manage.py shell -c "
from tenancy.models import Tenant
tenant = Tenant.objects.filter(slug='$SLUG', is_active=True).first()
if tenant:
    print(tenant.slug, tenant.db_name, tenant.db_user)
" 2>/dev/null
  )"
  if [[ -z "${TENANT_ROWS:-}" ]]; then
    echo "Error: tenant activo no encontrado para slug '$SLUG'."
    exit 1
  fi
else
  TENANT_ROWS="$(
    "$PYTHON_BIN" backend/manage.py shell -c "
from tenancy.models import Tenant
for t in Tenant.objects.filter(is_active=True):
    print(t.slug, t.db_name, t.db_user)
" 2>/dev/null
  )"
fi

if [[ -z "${TENANT_ROWS:-}" ]]; then
  echo "No hay tenants activos para procesar."
  exit 0
fi

TOTAL=0
OK=0
FAIL=0

while read -r TENANT_SLUG DB_NAME DB_USER; do
  if [[ -z "${TENANT_SLUG:-}" || -z "${DB_NAME:-}" || -z "${DB_USER:-}" ]]; then
    continue
  fi

  TOTAL=$((TOTAL + 1))
  echo ""
  echo "==> [$TOTAL] Tenant: $TENANT_SLUG | DB: $DB_NAME | User: $DB_USER"
  if ensure_ownership "$DB_NAME" "$DB_USER"; then
    :
  else
    echo "  ✗ Error corrigiendo ownership para $TENANT_SLUG"
    FAIL=$((FAIL + 1))
    if [[ "$CONTINUE_ON_ERROR" -eq 0 ]]; then
      echo "Ejecucion detenida por error (usa --continue-on-error para continuar)."
      break
    fi
    continue
  fi

  if [[ "$DRY_RUN" -eq 1 ]]; then
    echo "  [dry-run] Ejecutaria: backend/manage.py migrate_tenant --slug $TENANT_SLUG"
  else
    if "$PYTHON_BIN" backend/manage.py migrate_tenant --slug "$TENANT_SLUG"; then
      :
    else
      echo "  ✗ Fallo migrate_tenant en $TENANT_SLUG"
      FAIL=$((FAIL + 1))
      if [[ "$CONTINUE_ON_ERROR" -eq 0 ]]; then
        echo "Ejecucion detenida por error (usa --continue-on-error para continuar)."
        break
      fi
      continue
    fi
  fi

  if grant_permissions "$DB_NAME" "$DB_USER"; then
    echo "  ✓ Tenant $TENANT_SLUG procesado"
    OK=$((OK + 1))
  else
    echo "  ✗ Error otorgando permisos para $TENANT_SLUG"
    FAIL=$((FAIL + 1))
    if [[ "$CONTINUE_ON_ERROR" -eq 0 ]]; then
      echo "Ejecucion detenida por error (usa --continue-on-error para continuar)."
      break
    fi
  fi
done <<< "$TENANT_ROWS"

echo ""
echo "Resumen: total=$TOTAL ok=$OK fail=$FAIL dry_run=$DRY_RUN"
echo "continue_on_error=$CONTINUE_ON_ERROR"
if [[ "$FAIL" -gt 0 ]]; then
  exit 1
fi
