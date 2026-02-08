# Despliegue en Ubuntu 24.04

> Dominio oficial del entorno productivo: **materialidad.online**. Todos los ejemplos de Nginx y certificados asumen ese FQDN.

## Despliegue rápido (script automatizado)

```bash
# Desde el VPS como root:
sudo REPO_URL="https://github.com/gaibarra/materialidad.git" ./scripts/deploy.sh

# Sin SSL (para pruebas):
sudo ./scripts/deploy.sh --skip-ssl
```

El script instala todo: paquetes del sistema, Node.js 20.x, Python 3.12, PostgreSQL, Nginx, Supervisor, Certbot, clona el repo, construye el frontend y backend, y levanta todos los servicios.

---

## Despliegue manual paso a paso

### Paquetes del sistema
```bash
sudo apt update
sudo apt install -y python3.12 python3.12-venv python3-pip \
    postgresql postgresql-contrib \
    nginx certbot python3-certbot-nginx \
    supervisor git curl build-essential libpq-dev

# Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

## Código y entorno virtual
```
sudo mkdir -p /srv/materialidad
sudo chown $USER:$USER /srv/materialidad
cd /srv/materialidad
# Asegura que la variable REPO_URL contenga la URL corporativa oficial del repositorio
git clone "$REPO_URL" .
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r backend/requirements.txt
```

## Variables de entorno
```bash
cp backend/.env.template backend/.env
```
Edita `backend/.env` y asigna valores reales. Variables **obligatorias**:
- `DJANGO_SECRET_KEY` — se genera automáticamente si usas `deploy.sh`
- `DJANGO_CONTROL_DB_URL` — DSN de PostgreSQL (ej: `postgres://materialidad:pass@localhost:5432/materialidad_control`)
- `DJANGO_ALLOWED_HOSTS` — `materialidad.online,www.materialidad.online`
- `DJANGO_CSRF_TRUSTED_ORIGINS` — `https://materialidad.online,https://www.materialidad.online`
- `CORS_ALLOWED_ORIGINS` — `https://materialidad.online,https://www.materialidad.online`
- `OPENAI_API_KEY` — clave de API para funciones de IA

## Migraciones de la base de control
```
cd /srv/materialidad
source .venv/bin/activate
python backend/manage.py migrate
python backend/manage.py createsuperuser
```

## Creación de tenants
1. Habilita acceso en PostgreSQL para crear bases independientes.
2. Desde `/srv/materialidad/backend` ejecuta `python3 manage.py create_tenant "Nombre Legal" slug nombre_base usuario "contraseña" host [puerto] --create-db`. El último parámetro es opcional y usa 5432 por defecto. Si necesitas automatizarlo desde la raíz del proyecto puedes usar `./scripts/create_tenant_database.sh` con los mismos argumentos.
3. Aplica migraciones al nuevo tenant ejecutando `./scripts/migrate_tenant.sh` con el slug correspondiente.
4. Crea al menos un usuario con correo corporativo y asígnalo al tenant. Ejemplo:

```
python3 manage.py createsuperuser --email admin@cliente.com --password "ContraseñaFuerte"
python3 manage.py shell -c "from accounts.models import User; from tenancy.models import Tenant; user = User.objects.get(email='admin@cliente.com'); user.tenant = Tenant.objects.get(slug='cliente'); user.save()"
```

También puedes hacer esta asignación desde el admin.
Repite para cada tenant. El comando sin argumentos migra todos los activos.

## Archivos estáticos
```
python backend/manage.py collectstatic --no-input
```

## Gunicorn vía systemd
1. Copia el servicio:
```bash
sudo cp deploy/systemd/materialidad-backend.service /etc/systemd/system/
```
2. Ajusta `WorkingDirectory`, `EnvironmentFile` y `ExecStart` al path real si difiere de `/srv/materialidad`.
3. El directorio del socket `/run/materialidad/` se crea automáticamente gracias a `RuntimeDirectory=materialidad` en el unit file. No requiere creación manual ni tmpfiles.d.
4. Habilita y arranca:
```bash
sudo systemctl daemon-reload
sudo systemctl enable materialidad-backend
sudo systemctl start materialidad-backend
```

## Nginx
1. Copia la configuración:
```bash
sudo cp deploy/nginx/materialidad.conf /etc/nginx/sites-available/
sudo ln -sf /etc/nginx/sites-available/materialidad.conf /etc/nginx/sites-enabled/materialidad.conf
sudo rm -f /etc/nginx/sites-enabled/default
```
   La configuración incluye:
   - `server_name materialidad.online www.materialidad.online`
   - Proxy `/api/` y `/admin/` → Gunicorn (unix socket)
   - Proxy `/` → Next.js (puerto 3000)
   - Cache de archivos estáticos y media
   - Headers de seguridad (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`)

2. Verifica y recarga:
```bash
sudo nginx -t
sudo systemctl reload nginx
```

## Certbot
```bash
sudo certbot --nginx -d materialidad.online -d www.materialidad.online
```
Certbot dejará programadas las renovaciones automáticas mediante systemd timers.

## Frontend (Next.js con Supervisor)

El frontend usa Next.js en modo `standalone` (configurado en `next.config.mjs`), que genera un servidor Node.js autocontenido en `.next/standalone/server.js`.

```bash
cd /srv/materialidad/frontend
npm ci --omit=dev
cp .env.local.template .env.local
# Editar .env.local → NEXT_PUBLIC_API_BASE_URL=https://materialidad.online
npm run build

# Copiar assets estáticos al directorio standalone
cp -r .next/static .next/standalone/.next/static
cp -r public .next/standalone/public
```

Instalar la configuración de Supervisor:
```bash
sudo mkdir -p /var/log/materialidad
sudo chown www-data:www-data /var/log/materialidad
sudo cp deploy/supervisor/materialidad-frontend.conf /etc/supervisor/conf.d/
sudo supervisorctl reread
sudo supervisorctl update
```

Verificar:
```bash
sudo supervisorctl status materialidad-frontend
```

## Estrategia de migraciones futuras
1. Ejecuta `python backend/manage.py migrate` en la base de control.
2. Lanza `./scripts/migrate_tenant.sh` para aplicar cambios en cada tenant.
3. Monitorea logs de Gunicorn y Nginx durante la operación.

## Comandos útiles

### Estado de servicios
```bash
sudo systemctl status materialidad-backend
sudo supervisorctl status materialidad-frontend
sudo systemctl status nginx
```

### Logs en tiempo real
```bash
journalctl -u materialidad-backend -f                   # Gunicorn
tail -f /var/log/materialidad/frontend.out.log           # Next.js
tail -f /var/log/nginx/access.log                        # Nginx
```

### Reiniciar servicios
```bash
sudo systemctl restart materialidad-backend              # Backend
sudo supervisorctl restart materialidad-frontend         # Frontend
sudo systemctl reload nginx                              # Nginx (sin downtime)
```

### Actualizar en producción
```bash
cd /srv/materialidad
sudo git pull origin main
sudo /srv/materialidad/.venv/bin/pip install -r backend/requirements.txt
cd backend && sudo /srv/materialidad/.venv/bin/python manage.py migrate --no-input
sudo /srv/materialidad/.venv/bin/python manage.py collectstatic --no-input
cd ../frontend && sudo npm ci --omit=dev && npm run build
cp -r .next/static .next/standalone/.next/static
cp -r public .next/standalone/public
sudo chown -R www-data:www-data /srv/materialidad
sudo systemctl restart materialidad-backend
sudo supervisorctl restart materialidad-frontend
```

## Arquitectura de producción

```
                    materialidad.online
                         │ :443 HTTPS
                  ┌──────▼──────┐
                  │    Nginx    │
                  └──┬───────┬──┘
           /api/     │       │  /*
           /admin/   │       │
           /static/  │       │
           /media/   │       │
      ┌──────────────▼┐   ┌──▼──────────────┐
      │   Gunicorn    │   │    Next.js       │
      │  (systemd)    │   │  (supervisor)    │
      │  unix socket  │   │  standalone      │
      │  Django 5.0   │   │  port 3000       │
      └───────┬───────┘   └─────────────────┘
              │
      ┌───────▼────────┐
      │   PostgreSQL   │
      │  control DB +  │
      │  tenant DBs    │
      └────────────────┘
```
