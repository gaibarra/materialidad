# Despliegue en Ubuntu 24.04

> Dominio oficial del entorno productivo: **materialidad.online**. Todos los ejemplos de Nginx y certificados asumen ese FQDN.

## Paquetes del sistema
```
sudo apt update
sudo apt install -y python3.12 python3.12-venv python3-pip postgresql postgresql-contrib nginx certbot python3-certbot-nginx
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
```
cp backend/.env.template backend/.env
```
Edita `backend/.env` y asigna valores reales a cada variable (cadena DSN de la base de control, secret key, hosts permitidos, URLs de n8n, TTL de los tokens, etc.).

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
```
sudo cp deploy/systemd/materialidad-backend.service /etc/systemd/system/
```
2. Ajusta `WorkingDirectory`, `EnvironmentFile` y `ExecStart` al path real.
3. Crea el directorio del socket:
```
sudo mkdir -p /run/materialidad
sudo chown www-data:www-data /run/materialidad
```
4. Habilita y arranca:
```
sudo systemctl daemon-reload
sudo systemctl enable materialidad-backend
sudo systemctl start materialidad-backend
```

## Nginx
1. Copia la configuración:
```
sudo cp deploy/nginx/materialidad.conf /etc/nginx/sites-available/
sudo ln -s /etc/nginx/sites-available/materialidad.conf /etc/nginx/sites-enabled/materialidad.conf
```
   Configuración de referencia:
```
upstream materialidad_backend {
	server unix:/run/materialidad/gunicorn.sock fail_timeout=0;
}

server {
	listen 80;
	server_name materialidad.online www.materialidad.online;

	client_max_body_size 50m;

	location /static/ {
		alias /srv/materialidad/backend/staticfiles/;
	}

	location /media/ {
		alias /srv/materialidad/backend/media/;
	}

	location /api/ {
		proxy_set_header Host $host;
		proxy_set_header X-Real-IP $remote_addr;
		proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
		proxy_set_header X-Forwarded-Proto $scheme;
		proxy_set_header X-Tenant $http_x_tenant;
		proxy_pass http://materialidad_backend$request_uri;
		proxy_redirect off;
	}

	location / {
		proxy_set_header Host $host;
		proxy_set_header X-Real-IP $remote_addr;
		proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
		proxy_set_header X-Forwarded-Proto $scheme;
		proxy_pass http://127.0.0.1:3000;
		proxy_redirect off;
	}
}
```
2. Ajusta `server_name`, rutas de static/media y proxy según tu infraestructura (por defecto usa `server_name materialidad.online www.materialidad.online;`).
3. Verifica y recarga:
```
sudo nginx -t
sudo systemctl reload nginx
```

## Certbot
Ejecuta `sudo certbot --nginx -d materialidad.online -d www.materialidad.online` para emitir los certificados. Certbot dejará programadas las renovaciones automáticas mediante systemd timers.
```
cd /srv/materialidad/frontend
npm install
cp .env.local.template .env.local
# Define NEXT_PUBLIC_API_BASE_URL apuntando al dominio público del backend
npm run build
sudo apt install -y supervisor
cat <<'EOF' | sudo tee /etc/supervisor/conf.d/materialidad-frontend.conf
[program:materialidad-frontend]
command=/usr/bin/npm run start -- -p 3000
directory=/srv/materialidad/frontend
autostart=true
autorestart=true
user=www-data
environment=NODE_ENV="production",NEXT_PUBLIC_API_BASE_URL="https://materialidad.online"
stdout_logfile=/var/log/materialidad/frontend.out.log
stderr_logfile=/var/log/materialidad/frontend.err.log
EOF
sudo supervisorctl reread
sudo supervisorctl update
```
El frontend queda bajo `supervisor`; no se requiere `pm2`.

## Estrategia de migraciones futuras
1. Ejecuta `python backend/manage.py migrate` en la base de control.
2. Lanza `./scripts/migrate_tenant.sh` para aplicar cambios en cada tenant.
3. Monitorea logs de Gunicorn y Nginx durante la operación.
