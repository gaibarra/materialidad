#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="${ROOT_DIR}/backend"
PYTHON_BIN="${PYTHON_BIN:-${ROOT_DIR}/.venv/bin/python}"
MODE="full"
WITH_MIGRATE_TENANTS=0
DRY_RUN=0
LOG_FILE=""
VERBOSITY="2"

if [[ ! -x "${PYTHON_BIN}" ]]; then
  if command -v python3 >/dev/null 2>&1; then
    PYTHON_BIN="$(command -v python3)"
  elif command -v python >/dev/null 2>&1; then
    PYTHON_BIN="$(command -v python)"
  else
    echo "[ERROR] No se encontró intérprete Python utilizable" >&2
    exit 2
  fi
fi

usage() {
  cat <<'EOM'
Uso:
  scripts/smoke_materialidad_legal.sh [opciones]

Opciones:
  --quick                 Ejecuta sólo la suite crítica mínima.
  --full                  Ejecuta la suite legal completa (default).
  --with-migrate-tenants  Ejecuta también `scripts/migrate_tenant.sh` antes de las pruebas.
  --dry-run               Muestra qué se ejecutaría sin correr pruebas ni migraciones.
  --log-file RUTA         Guarda la salida completa en archivo además de stdout.
  --verbosity N           Verbosity para `manage.py test` (default: 2).
  -h, --help              Muestra esta ayuda.

Ejemplos:
  scripts/smoke_materialidad_legal.sh
  scripts/smoke_materialidad_legal.sh --quick
  scripts/smoke_materialidad_legal.sh --with-migrate-tenants
  scripts/smoke_materialidad_legal.sh --quick --log-file logs/smoke_legal.log
EOM
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --quick)
      MODE="quick"
      shift
      ;;
    --full)
      MODE="full"
      shift
      ;;
    --with-migrate-tenants)
      WITH_MIGRATE_TENANTS=1
      shift
      ;;
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    --log-file)
      if [[ $# -lt 2 ]]; then
        echo "[ERROR] Falta valor para --log-file" >&2
        usage
        exit 1
      fi
      LOG_FILE="$2"
      shift 2
      ;;
    --verbosity)
      if [[ $# -lt 2 ]]; then
        echo "[ERROR] Falta valor para --verbosity" >&2
        usage
        exit 1
      fi
      VERBOSITY="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "[ERROR] Opción desconocida: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if [[ -n "${LOG_FILE}" ]]; then
  mkdir -p "$(dirname "${LOG_FILE}")"
  exec > >(tee -a "${LOG_FILE}") 2>&1
  echo "[INFO] Log de ejecución: ${LOG_FILE}"
fi

log() {
  printf "\n[smoke-legal] %s\n" "$1"
}

run_cmd() {
  if [[ "${DRY_RUN}" == "1" ]]; then
    printf '[dry-run]'
    for arg in "$@"; do
      printf ' %q' "$arg"
    done
    printf '\n'
    return 0
  fi
  "$@"
}

QUICK_TESTS=(
  materialidad.tests.test_legal_corpus_parsers
  materialidad.tests.test_legal_corpus_uploads
  materialidad.tests.test_legal_sources_vigency
  tenancy.tests.test_router_shared_models
)

FULL_TESTS=(
  materialidad.tests.test_legal_corpus_parsers
  materialidad.tests.test_legal_corpus_uploads
  materialidad.tests.test_legal_consultations_api
  materialidad.tests.test_legal_sources_vigency
  tenancy.tests.test_router_shared_models
)

TEST_TARGETS=("${FULL_TESTS[@]}")
if [[ "${MODE}" == "quick" ]]; then
  TEST_TARGETS=("${QUICK_TESTS[@]}")
fi

log "Smoke legal | modo=${MODE} migrate_tenants=${WITH_MIGRATE_TENANTS} python=${PYTHON_BIN}"

if [[ "${WITH_MIGRATE_TENANTS}" == "1" ]]; then
  log "Migraciones tenant"
  run_cmd bash "${ROOT_DIR}/scripts/migrate_tenant.sh"
fi

log "Django check"
pushd "${BACKEND_DIR}" >/dev/null
run_cmd "${PYTHON_BIN}" manage.py check

log "Suite legal / multi-tenant"
run_cmd "${PYTHON_BIN}" manage.py test "${TEST_TARGETS[@]}" --verbosity "${VERBOSITY}"
popd >/dev/null

log "Smoke legal finalizado sin errores"
