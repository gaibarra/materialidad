#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════
#  deploy.sh – Despliegue completo de materialidad.online
#  VPS Ubuntu 24.04 · Nginx + Gunicorn + systemd (+ fallback Supervisor) + Certbot
#
#  Uso:
#    chmod +x scripts/deploy.sh
#    sudo ./scripts/deploy.sh            # instalación completa
#    sudo ./scripts/deploy.sh --skip-ssl  # sin certbot (desarrollo)
# ═══════════════════════════════════════════════════════════════════════
set -euo pipefail

# ── Colores ───────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'

info()  { echo -e "${BLUE}[INFO]${NC}  $*"; }
ok()    { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
err()   { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

# ── Variables ─────────────────────────────────────────────────────────
DOMAIN="materialidad.online"
APP_DIR="/srv/materialidad"
BACKEND_DIR="${APP_DIR}/backend"
FRONTEND_DIR="${APP_DIR}/frontend"
VENV_DIR="${APP_DIR}/.venv"
LOG_DIR="/var/log/materialidad"
BACKEND_SOCKET="/run/materialidad/gunicorn.sock"
SKIP_SSL=false
NODE_MAJOR=20
LOCAL_DEPLOY=false

for arg in "$@"; do
    case $arg in
        --skip-ssl) SKIP_SSL=true ;;
        --local)    LOCAL_DEPLOY=true ;;
    esac
done

# ── Root check ────────────────────────────────────────────────────────
[[ $EUID -eq 0 ]] || err "Este script debe ejecutarse como root (sudo)"

# ── Sanitizar fuentes APT duplicadas (Ubuntu mirrors) ────────────────
UBUNTU_MIRRORS_LIST="/etc/apt/sources.list.d/ubuntu-mirrors.list"
if [[ -f "$UBUNTU_MIRRORS_LIST" ]]; then
    tmp_file="$(mktemp)"
    awk '!seen[$0]++' "$UBUNTU_MIRRORS_LIST" > "$tmp_file"
    if ! cmp -s "$UBUNTU_MIRRORS_LIST" "$tmp_file"; then
        cp "$tmp_file" "$UBUNTU_MIRRORS_LIST"
        ok "Fuentes APT deduplicadas en ${UBUNTU_MIRRORS_LIST}"
    fi
    rm -f "$tmp_file"
fi

# ══════════════════════════════════════════════════════════════════════
#  1. PAQUETES DEL SISTEMA
# ══════════════════════════════════════════════════════════════════════
info "Instalando paquetes del sistema..."
apt-get update -qq
apt-get install -y -qq \
    python3.12 python3.12-venv python3-pip \
    postgresql postgresql-contrib \
    nginx certbot python3-certbot-nginx \
    supervisor \
    curl rsync build-essential libpq-dev

# Node.js 20.x vía NodeSource
if ! command -v node &>/dev/null || [[ $(node -v | cut -d. -f1 | tr -d v) -lt $NODE_MAJOR ]]; then
    info "Instalando Node.js ${NODE_MAJOR}.x..."
    curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
    apt-get install -y -qq nodejs
fi
ok "Paquetes del sistema instalados (Node $(node -v), Python $(python3.12 --version))"

# ── 2. PREPARAR CÓDIGO DE APLICACIÓN ─────────────────────────────────
if [[ "$LOCAL_DEPLOY" == true ]]; then
    info "Despliegue local: Sincronizando desde $(pwd)..."
    mkdir -p "$APP_DIR"
    # Sincronizar evitando node_modules, .git, .venv y archivos .env (los de producción ya existen)
    rsync -av --exclude='.git' --exclude='node_modules' --exclude='.venv' --exclude='.next' \
              --exclude='.env' --exclude='.env.*' --exclude='.env.local' ./ "$APP_DIR/"
    ok "Código sincronizado localmente en ${APP_DIR}"
else
    info "Despliegue manual: usando código existente en ${APP_DIR}"
    [[ -d "$APP_DIR" ]] || err "No existe ${APP_DIR}. Sincroniza el código manualmente antes de ejecutar este script o usa --local desde la raíz del proyecto."
    ok "Código existente detectado en ${APP_DIR}"
fi

[[ -d "$BACKEND_DIR" ]] || err "No existe ${BACKEND_DIR}. Verifica que el código esté sincronizado correctamente en ${APP_DIR}."
[[ -d "$FRONTEND_DIR" ]] || err "No existe ${FRONTEND_DIR}. Verifica que el código esté sincronizado correctamente en ${APP_DIR}."

# Evitar que una configuracion ESLint legacy en la raiz de /srv/materialidad
# interfiera con el build de Next.js dentro de frontend/.
if [[ -f "${APP_DIR}/.eslintrc.json" ]]; then
    info "Removiendo ESLint root legacy en ${APP_DIR}/.eslintrc.json"
    rm -f "${APP_DIR}/.eslintrc.json"
fi

# ══════════════════════════════════════════════════════════════════════
#  3. ENTORNO VIRTUAL PYTHON + DEPENDENCIAS
# ══════════════════════════════════════════════════════════════════════
info "Configurando entorno virtual Python..."
python3.12 -m venv "$VENV_DIR"
"${VENV_DIR}/bin/pip" install --upgrade pip -q
"${VENV_DIR}/bin/pip" install -r "${BACKEND_DIR}/requirements.txt" -q
ok "Dependencias Python instaladas"

# ══════════════════════════════════════════════════════════════════════
#  4. VARIABLES DE ENTORNO DEL BACKEND
# ══════════════════════════════════════════════════════════════════════
if [[ ! -f "${BACKEND_DIR}/.env" ]]; then
    warn "No existe ${BACKEND_DIR}/.env — creando desde template..."
    cp "${BACKEND_DIR}/.env.template" "${BACKEND_DIR}/.env"

    # Generar SECRET_KEY automáticamente (Python para evitar problemas con caracteres especiales en sed)
    "${VENV_DIR}/bin/python" -c "
import secrets, string
charset = string.ascii_letters + string.digits + '!@#%^&*(-_=+)'
key = ''.join(secrets.choice(charset) for _ in range(50))
path = '${BACKEND_DIR}/.env'
with open(path) as f:
    content = f.read()
content = content.replace('DJANGO_SECRET_KEY=cambia-esto-por-una-clave-segura', f'DJANGO_SECRET_KEY={key}')
with open(path, 'w') as f:
    f.write(content)
print(f'SECRET_KEY generada correctamente')
"

    warn "EDITA ${BACKEND_DIR}/.env con valores reales de PostgreSQL, API keys, etc."
    warn "Luego vuelve a ejecutar este script."
    exit 0
else
    ok "Archivo .env existente encontrado"

    # Asegurar que ALLOWED_HOSTS incluye el dominio de producción
    if ! grep -q "${DOMAIN}" "${BACKEND_DIR}/.env"; then
        warn "DJANGO_ALLOWED_HOSTS no incluye ${DOMAIN}, corrigiendo..."
        sed -i "s|^DJANGO_ALLOWED_HOSTS=.*|DJANGO_ALLOWED_HOSTS=${DOMAIN},www.${DOMAIN},localhost,127.0.0.1|" "${BACKEND_DIR}/.env"
        ok "ALLOWED_HOSTS corregido con ${DOMAIN}"
    fi

    # Forzar DEBUG=False en producción
    sed -i "s|^DJANGO_DEBUG=True|DJANGO_DEBUG=False|" "${BACKEND_DIR}/.env"
fi

# ══════════════════════════════════════════════════════════════════════
#  5. BASE DE DATOS POSTGRESQL
# ══════════════════════════════════════════════════════════════════════
info "Verificando base de datos PostgreSQL..."
if ! sudo -u postgres psql -lqt | cut -d \| -f 1 | grep -qw materialidad_control; then
    info "Creando base de datos materialidad_control..."
    sudo -u postgres createuser --no-superuser --createdb --no-createrole materialidad 2>/dev/null || true
    sudo -u postgres createdb -O materialidad materialidad_control
    ok "Base de datos materialidad_control creada"
else
    ok "Base de datos materialidad_control ya existe"
fi

# ══════════════════════════════════════════════════════════════════════
#  6. MIGRACIONES + ARCHIVOS ESTÁTICOS
# ══════════════════════════════════════════════════════════════════════
info "Ejecutando migraciones..."
cd "$BACKEND_DIR"
"${VENV_DIR}/bin/python" manage.py migrate --no-input
ok "Migraciones aplicadas"

info "Recopilando archivos estáticos..."
"${VENV_DIR}/bin/python" manage.py collectstatic --no-input
ok "Archivos estáticos recopilados"

# ══════════════════════════════════════════════════════════════════════
#  7. FRONTEND – DEPENDENCIAS + BUILD
# ══════════════════════════════════════════════════════════════════════
info "Construyendo frontend Next.js..."
cd "$FRONTEND_DIR"

# Evitar EACCES en builds sucesivos cuando .next quedó con owner distinto
mkdir -p .next
chown -R root:root .next
chmod -R u+rwX .next

# Forzar siempre la URL de producción (el deploy puede sobrescribir con valores de desarrollo)
cat > .env.local <<ENVEOF
NEXT_PUBLIC_API_BASE_URL=https://${DOMAIN}
ENVEOF
ok ".env.local del frontend configurado con https://${DOMAIN}"

if [[ -f package-lock.json ]]; then
    npm ci --no-audit --no-fund
else
    npm install --no-audit --no-fund
fi
npm run build
ok "Frontend construido"

# Copiar static y public al standalone para Next.js standalone mode
if [[ -d ".next/standalone" ]]; then
    cp -r .next/static .next/standalone/.next/static 2>/dev/null || true
    cp -r public .next/standalone/public 2>/dev/null || true
    ok "Assets copiados a standalone"
fi

# ══════════════════════════════════════════════════════════════════════
#  8. PERMISOS
# ══════════════════════════════════════════════════════════════════════
info "Ajustando permisos..."
chown -R www-data:www-data "$APP_DIR"
chmod 600 "${BACKEND_DIR}/.env"
mkdir -p "$LOG_DIR"
chown www-data:www-data "$LOG_DIR"
ok "Permisos configurados"

# ══════════════════════════════════════════════════════════════════════
#  9. GUNICORN VÍA SYSTEMD
# ══════════════════════════════════════════════════════════════════════
info "Instalando servicio Gunicorn..."
cp "${APP_DIR}/deploy/systemd/materialidad-backend.service" /etc/systemd/system/
systemctl daemon-reload
systemctl enable materialidad-backend
systemctl restart materialidad-backend

info "Verificando socket de Gunicorn..."
for attempt in {1..20}; do
    if [[ -S "$BACKEND_SOCKET" ]]; then
        ok "Gunicorn activo y escuchando en ${BACKEND_SOCKET}"
        break
    fi

    if [[ "$attempt" -eq 20 ]]; then
        systemctl status materialidad-backend --no-pager || true
        journalctl -u materialidad-backend -n 80 --no-pager || true
        err "Gunicorn no expuso el socket ${BACKEND_SOCKET} tras el reinicio"
    fi

    sleep 1
done

# ══════════════════════════════════════════════════════════════════════
# 10. FRONTEND (PREFERIR SYSTEMD; FALLBACK SUPERVISOR)
# ══════════════════════════════════════════════════════════════════════
if [[ -f "${APP_DIR}/deploy/systemd/materialidad-frontend.service" ]]; then
    info "Instalando servicio frontend (systemd)..."

    cp "${APP_DIR}/deploy/systemd/materialidad-frontend.service" /etc/systemd/system/

    # Evitar conflicto: si existe en Supervisor, detenerlo y removerlo
    supervisorctl stop materialidad-frontend 2>/dev/null || true
    if [[ -f /etc/supervisor/conf.d/materialidad-frontend.conf ]]; then
        rm -f /etc/supervisor/conf.d/materialidad-frontend.conf
        supervisorctl reread || true
        supervisorctl update || true
    fi

    systemctl daemon-reload
    systemctl enable materialidad-frontend
    systemctl restart materialidad-frontend
    ok "Frontend activo bajo systemd"
else
    info "Instalando servicio frontend (Supervisor)..."
    cp "${APP_DIR}/deploy/supervisor/materialidad-frontend.conf" /etc/supervisor/conf.d/
    supervisorctl reread
    supervisorctl update

    # Asegurar que el puerto 3100 esté libre antes de reiniciar
    supervisorctl stop materialidad-frontend 2>/dev/null || true
    fuser -k 3100/tcp 2>/dev/null || true
    sleep 1
    supervisorctl start materialidad-frontend
    ok "Frontend activo bajo Supervisor"
fi

# ══════════════════════════════════════════════════════════════════════
# 11. TIMER SNAPSHOTS FDI
# ══════════════════════════════════════════════════════════════════════
if [[ -f "${APP_DIR}/deploy/systemd/materialidad-fdi-snapshots.service" && -f "${APP_DIR}/deploy/systemd/materialidad-fdi-snapshots.timer" ]]; then
    info "Instalando timer de snapshots FDI..."
    cp "${APP_DIR}/deploy/systemd/materialidad-fdi-snapshots.service" /etc/systemd/system/
    cp "${APP_DIR}/deploy/systemd/materialidad-fdi-snapshots.timer" /etc/systemd/system/
    systemctl daemon-reload
    systemctl enable materialidad-fdi-snapshots.timer
    systemctl restart materialidad-fdi-snapshots.timer
    ok "Timer de snapshots FDI activo"
fi

# ══════════════════════════════════════════════════════════════════════
# 12. NGINX
# ══════════════════════════════════════════════════════════════════════
NGINX_CONF="/etc/nginx/sites-available/materialidad.conf"
BOOTSTRAP_NGINX_CONF="/etc/nginx/sites-available/materialidad-bootstrap.conf"
CERT_DIR="/etc/letsencrypt/live/${DOMAIN}"
info "Configurando Nginx..."

if [[ -f "${CERT_DIR}/fullchain.pem" && -f "${CERT_DIR}/privkey.pem" ]]; then
    cp "${APP_DIR}/deploy/nginx/materialidad.conf" "$NGINX_CONF"
    ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/materialidad.conf
    rm -f /etc/nginx/sites-enabled/default
    ok "Config Nginx productiva instalada con SSL"
else
    cat > "$BOOTSTRAP_NGINX_CONF" <<NGINXEOF
server {
    listen 80;
    server_name ${DOMAIN} www.${DOMAIN};

    location ^~ /.well-known/acme-challenge/ {
        root /var/www/letsencrypt;
        default_type "text/plain";
    }

    location / {
        proxy_set_header Host              \$host;
        proxy_set_header X-Real-IP         \$remote_addr;
        proxy_set_header X-Forwarded-For   \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_http_version 1.1;
        proxy_set_header Upgrade           \$http_upgrade;
        proxy_set_header Connection        "upgrade";
        proxy_pass       http://127.0.0.1:3100;
        proxy_redirect   off;
    }
}
NGINXEOF
    mkdir -p /var/www/letsencrypt
    ln -sf "$BOOTSTRAP_NGINX_CONF" /etc/nginx/sites-enabled/materialidad.conf
    rm -f /etc/nginx/sites-enabled/default
    ok "Config Nginx bootstrap instalada sin SSL"
fi

nginx -t || err "Configuración de Nginx inválida"
systemctl reload nginx
ok "Nginx configurado y activo"

# ══════════════════════════════════════════════════════════════════════
# 13. CERTBOT (SSL)
# ══════════════════════════════════════════════════════════════════════
if [[ "$SKIP_SSL" == false ]]; then
    if [[ -f "${CERT_DIR}/fullchain.pem" && -f "${CERT_DIR}/privkey.pem" ]]; then
        info "Certificado SSL ya configurado — verificando renovación solo para ${DOMAIN}..."
        if certbot renew --dry-run --cert-name "$DOMAIN"; then
            ok "SSL de ${DOMAIN} verificado"
        else
            warn "La verificacion de renovacion para ${DOMAIN} reporto problemas"
        fi
    else
        info "Obteniendo certificado SSL con Certbot..."
        certbot --nginx \
            -d "$DOMAIN" \
            -d "www.${DOMAIN}" \
            --non-interactive \
            --agree-tos \
            --redirect \
            -m "admin@${DOMAIN}" || err "Certbot falló — verifica que el DNS apunte al VPS"
        cp "${APP_DIR}/deploy/nginx/materialidad.conf" "$NGINX_CONF"
        ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/materialidad.conf
        nginx -t || err "Configuración Nginx SSL inválida tras Certbot"
        systemctl reload nginx
        ok "Certificado SSL configurado"
    fi
else
    warn "SSL omitido (--skip-ssl)"
fi

# ══════════════════════════════════════════════════════════════════════
# 14. VERIFICACIÓN FINAL
# ══════════════════════════════════════════════════════════════════════
echo ""
echo -e "${GREEN}════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  Deploy completado exitosamente${NC}"
echo -e "${GREEN}════════════════════════════════════════════════════════════${NC}"
echo ""
echo "  Servicios:"
echo "    systemctl status materialidad-backend"
if [[ -f /etc/systemd/system/materialidad-frontend.service ]]; then
    echo "    systemctl status materialidad-frontend"
else
    echo "    supervisorctl status materialidad-frontend"
fi
echo "    systemctl status materialidad-fdi-snapshots.timer"
echo "    systemctl status nginx"
echo ""
echo "  Logs:"
echo "    journalctl -u materialidad-backend -f"
if [[ -f /etc/systemd/system/materialidad-frontend.service ]]; then
    echo "    journalctl -u materialidad-frontend -f"
else
    echo "    tail -f ${LOG_DIR}/frontend.out.log"
fi
echo "    journalctl -u materialidad-fdi-snapshots.service -f"
echo "    tail -f /var/log/nginx/access.log"
echo ""
echo "  URLs:"
if [[ "$SKIP_SSL" == false ]]; then
    echo "    Frontend:  https://${DOMAIN}"
    echo "    API:       https://${DOMAIN}/api/"
    echo "    Admin:     https://${DOMAIN}/admin/"
else
    echo "    Frontend:  http://${DOMAIN}"
    echo "    API:       http://${DOMAIN}/api/"
    echo "    Admin:     http://${DOMAIN}/admin/"
fi
echo ""
echo "  Próximos pasos:"
echo "    1. Editar ${BACKEND_DIR}/.env si aún no lo hiciste"
echo "    2. Crear superusuario: ${VENV_DIR}/bin/python ${BACKEND_DIR}/manage.py createsuperuser"
echo "    3. Crear primer tenant: ${APP_DIR}/scripts/provision_tenant.sh"
echo ""
