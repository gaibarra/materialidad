#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"
PYTHON_BIN=""

log() {
  printf "\n[tests] %s\n" "$1"
}

resolve_python() {
  if [[ -n "$PYTHON_BIN" ]]; then
    return
  fi
  if [[ -x "$BACKEND_DIR/.venv/bin/python" ]]; then
    PYTHON_BIN="$BACKEND_DIR/.venv/bin/python"
  elif command -v python3 >/dev/null 2>&1; then
    PYTHON_BIN="$(command -v python3)"
  elif command -v python >/dev/null 2>&1; then
    PYTHON_BIN="$(command -v python)"
  else
    log "ERROR: no se encontró un intérprete de Python (python3 o python)."
    exit 1
  fi
}

run_backend_suite() {
  if [[ "${SKIP_BACKEND:-0}" == "1" ]]; then
    log "Backend omitido (SKIP_BACKEND=1)."
    return
  fi

  resolve_python
  log "Backend | checks y pruebas de Django"
  pushd "$BACKEND_DIR" >/dev/null
  "$PYTHON_BIN" manage.py check
  "$PYTHON_BIN" manage.py migrate --noinput
  "$PYTHON_BIN" manage.py test
  popd >/dev/null
}

install_node_deps() {
  if [[ ! -d "$FRONTEND_DIR/node_modules" ]]; then
    log "Frontend | instalando dependencias NPM"
    npm install --prefix "$FRONTEND_DIR"
  fi
}

run_frontend_suite() {
  if [[ "${SKIP_FRONTEND:-0}" == "1" ]]; then
    log "Frontend omitido (SKIP_FRONTEND=1)."
    return
  fi

  install_node_deps
  log "Frontend | lint + build de Next.js"
  pushd "$FRONTEND_DIR" >/dev/null
  npm run lint
  npm run build
  popd >/dev/null
}

run_backend_suite
run_frontend_suite

log "Todas las pruebas finalizaron correctamente."
