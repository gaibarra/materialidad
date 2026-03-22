#!/usr/bin/env bash
set -Eeuo pipefail
IFS=$'\n\t'

readonly SCRIPT_NAME="${0##*/}"
readonly VERSION="1.0.0"
readonly DANGEROUS_PUBLIC_PORTS=(3000 3001 3002 3008 4000 5000 5432 5434 6379 8080 8081)
readonly LEGIT_PUBLIC_PORTS=(22 80 443)
readonly INTERNAL_SERVICE_PORTS=(3000 3001 3002 3008 4000 5000 5432 5434 6379 8080 8081 27017 9200 5601 9092 15672)
readonly RELEVANT_SERVICES_REGEX='nginx|node|next|gunicorn|uvicorn|celery|postgres|redis|docker'
readonly PATTERN_RUNTIME='listen\s*\(|0\.0\.0\.0|127\.0\.0\.1|process\.env\.HOST|process\.env\.PORT'
readonly PATTERN_SECRETS='change_me|change_me_too|JWT_SECRET|RESET_TOKEN_SECRET|AIza[0-9A-Za-z_-]{20,}|GEMINI(_|)API(_|)KEY|GOOGLE(_|)API(_|)KEY'

WARN_COUNT=0
CRIT_COUNT=0
OK_COUNT=0
INFO_COUNT=0

declare -a WARNINGS=()
declare -a CRITICALS=()
declare -a PROJECT_DIRS=()

if [[ -t 1 ]]; then
  C_RESET=$'\033[0m'
  C_BOLD=$'\033[1m'
  C_INFO=$'\033[36m'
  C_OK=$'\033[32m'
  C_WARN=$'\033[33m'
  C_CRIT=$'\033[31m'
  C_SECTION=$'\033[35m'
else
  C_RESET=''
  C_BOLD=''
  C_INFO=''
  C_OK=''
  C_WARN=''
  C_CRIT=''
  C_SECTION=''
fi

has_cmd() {
  command -v "$1" >/dev/null 2>&1
}

print_line() {
  printf '%s\n' "$*"
}

section() {
  printf '\n%s== %s ==%s\n' "$C_SECTION$C_BOLD" "$1" "$C_RESET"
}

info() {
  INFO_COUNT=$((INFO_COUNT + 1))
  printf '%s[INFO]%s %s\n' "$C_INFO" "$C_RESET" "$*"
}

ok() {
  OK_COUNT=$((OK_COUNT + 1))
  printf '%s[OK]%s   %s\n' "$C_OK" "$C_RESET" "$*"
}

warn() {
  WARN_COUNT=$((WARN_COUNT + 1))
  WARNINGS+=("$*")
  printf '%s[WARN]%s %s\n' "$C_WARN" "$C_RESET" "$*"
}

crit() {
  CRIT_COUNT=$((CRIT_COUNT + 1))
  CRITICALS+=("$*")
  printf '%s[CRIT]%s %s\n' "$C_CRIT" "$C_RESET" "$*"
}

print_kv() {
  printf '  - %s\n' "$*"
}

join_by() {
  local delimiter="$1"
  shift || true
  local first=1
  local item
  for item in "$@"; do
    if (( first )); then
      printf '%s' "$item"
      first=0
    else
      printf '%s%s' "$delimiter" "$item"
    fi
  done
}

array_contains() {
  local needle="$1"
  shift
  local item
  for item in "$@"; do
    [[ "$item" == "$needle" ]] && return 0
  done
  return 1
}

extract_host() {
  local endpoint="$1"
  local host="${endpoint%:*}"
  host="${host#[}"
  host="${host%]}"
  printf '%s' "$host"
}

extract_port() {
  local endpoint="$1"
  printf '%s' "${endpoint##*:}"
}

is_wildcard_host() {
  local host="$1"
  [[ "$host" == "0.0.0.0" || "$host" == "*" || "$host" == "::" || "$host" == "[::]" ]]
}

is_local_host() {
  local host="$1"
  [[ "$host" == "127.0.0.1" || "$host" == "::1" || "$host" == "[::1]" || "$host" == "localhost" ]]
}

render_command_output() {
  local title="$1"
  shift
  print_line "-- $title"
  if "$@"; then
    true
  else
    warn "No se pudo ejecutar: $title"
  fi
}

run_timeout() {
  local seconds="$1"
  shift
  if has_cmd timeout; then
    timeout "$seconds" "$@"
  else
    "$@"
  fi
}

discover_projects() {
  local input
  declare -A seen=()

  if (( $# > 0 )); then
    for input in "$@"; do
      if [[ -f "$input" && "${input##*/}" == "package.json" ]]; then
        input="$(dirname "$input")"
      fi
      if [[ -d "$input" && -f "$input/package.json" ]]; then
        if [[ -z "${seen[$input]:-}" ]]; then
          PROJECT_DIRS+=("$input")
          seen[$input]=1
        fi
      else
        warn "Ruta ignorada porque no contiene package.json: $input"
      fi
    done
    return
  fi

  if [[ -d /home ]]; then
    while IFS= read -r pkg_file; do
      [[ -z "$pkg_file" ]] && continue
      input="$(dirname "$pkg_file")"
      if [[ -z "${seen[$input]:-}" ]]; then
        PROJECT_DIRS+=("$input")
        seen[$input]=1
      fi
    done < <(find /home -maxdepth 5 -type f -name package.json \
      -not -path '*/node_modules/*' \
      -not -path '*/.next/*' \
      -not -path '*/.git/*' 2>/dev/null | sort)
  fi
}

audit_network() {
  section "A) RED Y PUERTOS"

  if ! has_cmd ss; then
    crit "El comando ss no está disponible; no se puede auditar la red."
    return
  fi

  print_line '-- Listeners (ss -tulpn)'
  ss -tulpn || warn "No se pudo listar listeners con ss -tulpn"

  local line proto endpoint host port process
  local public_listener_count=0
  local internal_public_count=0

  while IFS= read -r line; do
    [[ -z "$line" ]] && continue
    proto="$(awk '{print $1}' <<<"$line")"
    endpoint="$(awk '{print $5}' <<<"$line")"
    process="$(awk '{print $7}' <<<"$line")"
    [[ -z "$endpoint" || "$endpoint" == *:*:*:*:*:*:*:*:* ]] || true
    port="$(extract_port "$endpoint")"
    host="$(extract_host "$endpoint")"

    [[ "$port" =~ ^[0-9]+$ ]] || continue

    if is_wildcard_host "$host"; then
      public_listener_count=$((public_listener_count + 1))
      if array_contains "$port" "${DANGEROUS_PUBLIC_PORTS[@]}"; then
        internal_public_count=$((internal_public_count + 1))
        crit "Puerto interno sensible expuesto públicamente: $proto $host:$port ${process:-sin-proceso}"
      elif array_contains "$port" "${LEGIT_PUBLIC_PORTS[@]}"; then
        ok "Servicio público legítimo escuchando en $host:$port (${process:-sin-proceso})"
      else
        warn "Listener público no clasificado detectado: $proto $host:$port ${process:-sin-proceso}"
      fi
    elif is_local_host "$host"; then
      if array_contains "$port" "${INTERNAL_SERVICE_PORTS[@]}"; then
        ok "Servicio interno protegido en localhost: $proto $host:$port (${process:-sin-proceso})"
      fi
    fi
  done < <(ss -H -lntup 2>/dev/null || true)

  if (( public_listener_count == 0 )); then
    ok "No se detectaron listeners públicos."
  else
    info "Listeners públicos detectados: $public_listener_count"
  fi

  if (( internal_public_count == 0 )); then
    ok "No se detectaron puertos internos sensibles expuestos en wildcard."
  fi
}

audit_firewall() {
  section "B) FIREWALL"

  if ! has_cmd ufw; then
    warn "UFW no está instalado o no está en PATH."
    return
  fi

  local ufw_output
  ufw_output="$(ufw status numbered 2>&1 || true)"
  print_line '-- ufw status numbered'
  print_line "$ufw_output"

  if grep -qi 'Status: inactive' <<<"$ufw_output"; then
    warn "UFW está inactivo."
    return
  fi

  local allow_count=0
  allow_count="$(grep -Eci 'ALLOW IN|LIMIT IN' <<<"$ufw_output" || true)"
  info "Reglas de entrada detectadas: $allow_count"

  if (( allow_count > 8 )); then
    warn "Hay muchas reglas de entrada en UFW ($allow_count). Revisa exposición innecesaria."
  else
    ok "El número de reglas de entrada en UFW parece razonable."
  fi

  local risky_port
  for risky_port in "${DANGEROUS_PUBLIC_PORTS[@]}"; do
    if grep -Eq "(^|[^0-9])${risky_port}(/tcp|/udp)?[[:space:]].*(ALLOW IN|LIMIT IN).*(Anywhere|0\.0\.0\.0/0|::/0)" <<<"$ufw_output"; then
      crit "UFW permite públicamente un puerto interno sensible: $risky_port"
    fi
  done
}

audit_systemd() {
  section "C) SYSTEMD"

  if ! has_cmd systemctl; then
    warn "systemctl no está disponible."
    return
  fi

  print_line '-- systemctl --failed'
  systemctl --failed --no-pager --plain || warn "No se pudo consultar systemctl --failed"

  local failed_count=0
  failed_count="$(systemctl --failed --no-legend --plain 2>/dev/null | grep -c . || true)"
  if (( failed_count > 0 )); then
    warn "Hay $failed_count servicios fallidos en systemd."
  else
    ok "No hay servicios fallidos en systemd."
  fi

  print_line '-- Servicios relevantes activos'
  local active_services
  active_services="$(systemctl list-units --type=service --state=active --no-legend --plain 2>/dev/null | grep -Ei "$RELEVANT_SERVICES_REGEX" || true)"
  if [[ -n "$active_services" ]]; then
    print_line "$active_services"
    ok "Se listaron servicios relevantes activos."
  else
    warn "No se encontraron servicios relevantes activos o no se pudieron listar."
  fi
}

audit_resources() {
  section "D) RECURSOS"

  print_line '-- uptime'
  uptime || warn "No se pudo obtener uptime"

  print_line '-- free -h'
  free -h || warn "No se pudo obtener free -h"

  print_line '-- df -h /'
  df -h / || warn "No se pudo obtener uso de disco raíz"

  print_line '-- Top procesos por CPU'
  ps -eo pid,ppid,user,%cpu,%mem,comm,args --sort=-%cpu | head -n 10 || warn "No se pudo listar top CPU"

  print_line '-- Top procesos por RAM'
  ps -eo pid,ppid,user,%cpu,%mem,comm,args --sort=-%mem | head -n 10 || warn "No se pudo listar top RAM"

  local ram_pct=0
  local mem_total=0
  local mem_available=0
  if free -m >/dev/null 2>&1; then
    mem_total="$(free -m | awk '/^Mem:/ {print $2}')"
    mem_available="$(free -m | awk '/^Mem:/ {print $7}')"
    if [[ "$mem_total" =~ ^[0-9]+$ && "$mem_available" =~ ^[0-9]+$ && "$mem_total" -gt 0 ]]; then
      ram_pct=$(( ( (mem_total - mem_available) * 100 ) / mem_total ))
      info "Uso de RAM estimado: ${ram_pct}%"
      if (( ram_pct > 90 )); then
        crit "Uso de RAM por encima de 90% (${ram_pct}%)."
      elif (( ram_pct > 75 )); then
        warn "Uso de RAM por encima de 75% (${ram_pct}%)."
      else
        ok "Uso de RAM dentro de rango saludable (${ram_pct}%)."
      fi
    fi
  fi

  local disk_pct=0
  disk_pct="$(df -P / 2>/dev/null | awk 'NR==2 {gsub(/%/, "", $5); print $5}')"
  if [[ "$disk_pct" =~ ^[0-9]+$ ]]; then
    info "Uso del disco raíz: ${disk_pct}%"
    if (( disk_pct > 90 )); then
      crit "Uso del disco raíz por encima de 90% (${disk_pct}%)."
    elif (( disk_pct > 80 )); then
      warn "Uso del disco raíz por encima de 80% (${disk_pct}%)."
    else
      ok "Uso del disco raíz dentro de rango saludable (${disk_pct}%)."
    fi
  fi
}

audit_postgresql() {
  section "E) POSTGRESQL"

  local pg_listeners
  pg_listeners="$(ss -H -lntp 2>/dev/null | awk '$5 ~ /:5432$/ || $5 ~ /:5434$/ {print}' || true)"

  if [[ -n "$pg_listeners" ]]; then
    print_line '-- Listeners PostgreSQL detectados'
    print_line "$pg_listeners"
  else
    info "No se detectaron listeners PostgreSQL en 5432/5434."
  fi

  local line endpoint host port
  while IFS= read -r line; do
    [[ -z "$line" ]] && continue
    endpoint="$(awk '{print $5}' <<<"$line")"
    port="$(extract_port "$endpoint")"
    host="$(extract_host "$endpoint")"
    if [[ "$port" == "5432" ]]; then
      if is_local_host "$host"; then
        ok "PostgreSQL escucha en localhost para 5432 ($host)."
      elif is_wildcard_host "$host"; then
        crit "PostgreSQL escucha públicamente en 5432 ($host)."
      else
        warn "PostgreSQL escucha en una IP no-local en 5432 ($host)."
      fi
    fi
  done <<<"$pg_listeners"

  local conf_file
  conf_file="$(find /etc/postgresql -type f -name postgresql.conf 2>/dev/null | head -n 1 || true)"
  if [[ -n "$conf_file" ]]; then
    print_line "-- listen_addresses ($conf_file)"
    grep -En '^[[:space:]]*listen_addresses[[:space:]]*=' "$conf_file" || info "No se encontró listen_addresses explícito en $conf_file"
  else
    warn "No se encontró postgresql.conf bajo /etc/postgresql."
  fi
}

audit_docker() {
  section "F) DOCKER"

  if ! has_cmd docker; then
    info "Docker no está instalado; se omite esta sección."
    return
  fi

  if ! docker info >/dev/null 2>&1; then
    warn "Docker está instalado pero no responde (daemon detenido o permisos insuficientes)."
    return
  fi

  print_line '-- docker ps'
  docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Ports}}' || warn "No se pudo ejecutar docker ps"

  local container_lines
  container_lines="$(docker ps --format '{{.Names}}|{{.Image}}|{{.Ports}}' 2>/dev/null || true)"
  if [[ -z "$container_lines" ]]; then
    info "No hay contenedores Docker activos."
    return
  fi

  local name image ports port
  while IFS='|' read -r name image ports; do
    [[ -z "$name" ]] && continue
    if [[ "$ports" == *"0.0.0.0:"* || "$ports" == *":::"* ]]; then
      warn "Contenedor con puertos publicados en wildcard: $name ($image) -> $ports"
      for port in "${INTERNAL_SERVICE_PORTS[@]}"; do
        if grep -Eq "(^|[^0-9])${port}->|:${port}(,|$|/)" <<<"$ports"; then
          crit "Contenedor expone servicio interno sensible: $name ($image) puerto $port -> $ports"
        fi
      done
    else
      ok "Contenedor sin exposición pública directa: $name"
    fi
  done <<<"$container_lines"
}

audit_projects_runtime() {
  section "G) PROYECTOS NODE / NEXT"

  if ((${#PROJECT_DIRS[@]} == 0)); then
    info "No se detectaron proyectos con package.json en las rutas indicadas ni bajo /home."
    return
  fi

  if ! has_cmd npm; then
    warn "npm no está disponible; se omiten verificaciones de proyectos Node/Next."
    return
  fi

  local project
  for project in "${PROJECT_DIRS[@]}"; do
    print_line "-- Proyecto: $project"

    if [[ ! -f "$project/package.json" ]]; then
      warn "Se omitió $project porque no contiene package.json."
      continue
    fi

    print_line '  npm list next react react-dom --depth=0'
    (
      cd "$project"
      run_timeout 45s npm list next react react-dom --depth=0 2>&1 || true
    ) | sed 's/^/    /'

    if [[ -f "$project/package-lock.json" || -f "$project/npm-shrinkwrap.json" ]]; then
      local audit_log
      audit_log="$(mktemp)"
      if (
        cd "$project"
        run_timeout 90s npm audit --omit=dev --audit-level=high >"$audit_log" 2>&1
      ); then
        ok "npm audit --omit=dev sin vulnerabilidades high/critical en $project"
      else
        if grep -Eqi 'high|critical|vulnerab' "$audit_log"; then
          warn "npm audit detectó hallazgos relevantes en $project"
          tail -n 20 "$audit_log" | sed 's/^/    /'
        else
          info "npm audit no concluyó limpiamente en $project (sin lockfile válido, sin red o audit no disponible)."
          tail -n 10 "$audit_log" | sed 's/^/    /'
        fi
      fi
      rm -f "$audit_log"
    else
      info "Sin package-lock.json/npm-shrinkwrap.json en $project; se omite npm audit."
    fi

    local runtime_hits
    runtime_hits="$(grep -RInE --binary-files=without-match \
      --exclude-dir=node_modules \
      --exclude-dir=.next \
      --exclude-dir=.git \
      "$PATTERN_RUNTIME" "$project" 2>/dev/null | head -n 20 || true)"
    if [[ -n "$runtime_hits" ]]; then
      info "Patrones de runtime encontrados en $project"
      print_line "$runtime_hits" | sed 's/^/    /'
    else
      ok "No se encontraron patrones runtime relevantes en $project"
    fi
  done
}

audit_secrets() {
  section "H) SECRETOS INSEGUROS"

  if ((${#PROJECT_DIRS[@]} == 0)); then
    info "Sin proyectos detectados para buscar secretos inseguros."
    return
  fi

  local project secret_hits line_count trimmed
  for project in "${PROJECT_DIRS[@]}"; do
    secret_hits="$(grep -RInE --binary-files=without-match \
      --exclude-dir=node_modules \
      --exclude-dir=.next \
      --exclude-dir=.git \
      "$PATTERN_SECRETS" "$project" 2>/dev/null | head -n 20 || true)"

    if [[ -n "$secret_hits" ]]; then
      crit "Patrones sensibles/inseguros detectados en $project"
      while IFS= read -r trimmed; do
        [[ -z "$trimmed" ]] && continue
        print_line "    ${trimmed:0:220}"
      done <<<"$secret_hits"
    else
      ok "No se detectaron patrones obvios de secretos inseguros en $project"
    fi
  done
}

audit_logs() {
  section "I) LOGS"

  if ! has_cmd journalctl; then
    warn "journalctl no está disponible."
    return
  fi

  print_line '-- journalctl -p 3 -xb --no-pager | tail -80'
  if journalctl -p 3 -xb --no-pager 2>/dev/null | tail -80; then
    ok "Se listaron errores recientes del journal."
  else
    warn "No se pudieron leer logs de journalctl (permisos insuficientes o journal no disponible)."
  fi
}

print_summary_and_exit() {
  section "RESUMEN FINAL"

  info "Conteo total -> OK: $OK_COUNT | WARN: $WARN_COUNT | CRIT: $CRIT_COUNT | INFO: $INFO_COUNT"

  if (( CRIT_COUNT > 0 )); then
    print_line '-- Problemas críticos detectados'
    local item
    for item in "${CRITICALS[@]}"; do
      print_line "  - $item"
    done
  fi

  if (( WARN_COUNT > 0 )); then
    print_line '-- Advertencias detectadas'
    local item
    for item in "${WARNINGS[@]}"; do
      print_line "  - $item"
    done
  fi

  if (( CRIT_COUNT > 0 )); then
    crit "Estado final: CRÍTICO"
    exit 2
  elif (( WARN_COUNT > 0 )); then
    warn "Estado final: CON ADVERTENCIAS"
    exit 1
  else
    ok "Estado final: saludable"
    exit 0
  fi
}

main() {
  section "${SCRIPT_NAME} v${VERSION}"
  info "Inicio de auditoría preventiva para VPS Ubuntu"
  info "Fecha UTC: $(date -u '+%Y-%m-%d %H:%M:%S')"
  info "Host: $(hostname 2>/dev/null || echo 'desconocido')"

  if [[ ${EUID:-$(id -u)} -ne 0 ]]; then
    warn "Se recomienda ejecutar como root para obtener visibilidad completa de UFW, systemd, Docker y journalctl."
  else
    ok "Ejecutando con privilegios de root."
  fi

  discover_projects "$@"
  if ((${#PROJECT_DIRS[@]} > 0)); then
    info "Proyectos detectados: $(join_by ', ' "${PROJECT_DIRS[@]}")"
  else
    info "No se detectaron proyectos Node/Next automáticamente."
  fi

  audit_network
  audit_firewall
  audit_systemd
  audit_resources
  audit_postgresql
  audit_docker
  audit_projects_runtime
  audit_secrets
  audit_logs
  print_summary_and_exit
}

main "$@"
