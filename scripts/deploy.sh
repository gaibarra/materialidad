#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════
#  deploy.sh – Despliegue completo de materialidad.online
#  VPS Ubuntu 24.04 · Nginx + Gunicorn + Supervisor + Certbot
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
REPO_URL="${REPO_URL:-https://github.com/gaibarra/materialidad.git}"
BRANCH="${BRANCH:-main}"
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
    git curl build-essential libpq-dev

# Node.js 20.x vía NodeSource
if ! command -v node &>/dev/null || [[ $(node -v | cut -d. -f1 | tr -d v) -lt $NODE_MAJOR ]]; then
    info "Instalando Node.js ${NODE_MAJOR}.x..."
    curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
    apt-get install -y -qq nodejs
fi
ok "Paquetes del sistema instalados (Node $(node -v), Python $(python3.12 --version))"

# ── 2. CLONAR / ACTUALIZAR REPOSITORIO ────────────────────────────────
if [[ "$LOCAL_DEPLOY" == true ]]; then
    info "Despliegue local: Sincronizando desde $(pwd)..."
    mkdir -p "$APP_DIR"
    # Sincronizar evitando node_modules, .git, .venv y archivos .env (los de producción ya existen)
    rsync -av --exclude='.git' --exclude='node_modules' --exclude='.venv' --exclude='.next' \
              --exclude='.env' --exclude='.env.*' --exclude='.env.local' ./ "$APP_DIR/"
    ok "Código sincronizado localmente en ${APP_DIR}"
else
    if [[ -d "${APP_DIR}/.git" ]]; then
        info "Repositorio existente, actualizando..."
        cd "$APP_DIR"
        git fetch origin
        git reset --hard "origin/${BRANCH}"
    else
        info "Clonando repositorio en ${APP_DIR}..."
        mkdir -p "$APP_DIR"
        git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
    fi
    ok "Código en ${APP_DIR}"
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

# Forzar siempre la URL de producción (el deploy puede sobrescribir con valores de desarrollo)
cat > .env.local <<ENVEOF
NEXT_PUBLIC_API_BASE_URL=https://${DOMAIN}
ENVEOF
ok ".env.local del frontend configurado con https://${DOMAIN}"

npm install -q
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
ok "Gunicorn activo"

# ══════════════════════════════════════════════════════════════════════
# 10. FRONTEND VÍA SUPERVISOR
# ══════════════════════════════════════════════════════════════════════
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

# ══════════════════════════════════════════════════════════════════════
# 11. NGINX
# ══════════════════════════════════════════════════════════════════════
NGINX_CONF="/etc/nginx/sites-available/materialidad.conf"
info "Configurando Nginx..."

if grep -q 'ssl_certificate' "$NGINX_CONF" 2>/dev/null; then
    # La config actual ya tiene bloques SSL de Certbot — NO sobrescribir
    info "Config Nginx existente tiene SSL — preservando certificados"
else
    # Primera instalación o config sin SSL — instalar template base
    cp "${APP_DIR}/deploy/nginx/materialidad.conf" "$NGINX_CONF"
    ok "Config Nginx base instalada"
fi

ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/materialidad.conf

# Desactivar default si existe
rm -f /etc/nginx/sites-enabled/default

nginx -t || err "Configuración de Nginx inválida"
systemctl reload nginx
ok "Nginx configurado y activo"

# ══════════════════════════════════════════════════════════════════════
# 12. CERTBOT (SSL)
# ══════════════════════════════════════════════════════════════════════
if [[ "$SKIP_SSL" == false ]]; then
    if grep -q 'ssl_certificate' "$NGINX_CONF" 2>/dev/null; then
        info "Certificado SSL ya configurado — verificando renovación..."
        certbot renew --dry-run || warn "La renovación automática puede tener problemas"
        ok "SSL existente verificado"
    else
        info "Obteniendo certificado SSL con Certbot..."
        certbot --nginx \
            -d "$DOMAIN" \
            -d "www.${DOMAIN}" \
            --non-interactive \
            --agree-tos \
            --redirect \
            -m "admin@${DOMAIN}" || err "Certbot falló — verifica que el DNS apunte al VPS"
        ok "Certificado SSL configurado"
    fi
else
    warn "SSL omitido (--skip-ssl)"
fi

# ══════════════════════════════════════════════════════════════════════
# 13. VERIFICACIÓN FINAL
# ══════════════════════════════════════════════════════════════════════
echo ""
echo -e "${GREEN}════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  Deploy completado exitosamente${NC}"
echo -e "${GREEN}════════════════════════════════════════════════════════════${NC}"
echo ""
echo "  Servicios:"
echo "    systemctl status materialidad-backend"
echo "    supervisorctl status materialidad-frontend"
echo "    systemctl status nginx"
echo ""
echo "  Logs:"
echo "    journalctl -u materialidad-backend -f"
echo "    tail -f ${LOG_DIR}/frontend.out.log"
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
