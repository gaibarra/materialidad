# Materialidad Fiscal SaaS

Plataforma full stack para control de materialidad fiscal multitenant, construida con Django + DRF, PostgreSQL por tenant y frontend Next.js 14.

## Estructura
```
backend/   # Django + DRF + multitenancy
frontend/  # Next.js 14 App Router
scripts/   # utilidades para tenants
deploy/    # plantillas de systemd y nginx
docs/      # guías de despliegue, APIs y flujos n8n
```

## Requerimientos principales
- Python 3.12+
- PostgreSQL 14+
- Node.js 20+
- n8n accesible mediante webhook seguro

## Backend
```
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.template .env  # completa valores reales
python manage.py migrate
python manage.py createsuperuser
```

### Tenants
Crea un tenant desde `backend/` ejecutando el comando de Django y proporcionando, en ese orden, el nombre legal, el slug que usarán en el login, el nombre de la base dedicada, el usuario propietario, la contraseña, el host y, opcionalmente, el puerto (5432 por defecto):

```
python3 manage.py create_tenant "Mi Cliente" micliente materialidad_micliente tenant_user "contraseña" localhost 5432 --create-db
```

Si prefieres automatizarlo desde la raíz del repo usa `./scripts/create_tenant_database.sh` con los mismos parámetros (el puerto es opcional). Después aplica `./scripts/migrate_tenant.sh` indicando el slug correspondiente para inicializar el esquema del tenant.
> Importante: el login exige correos reales. Tras crear el tenant registra un usuario y asígnalo a ese slug. Ejemplo:

```
python3 manage.py createsuperuser --email admin@micliente.com --password "ContraseñaFuerte"
python3 manage.py shell -c "from accounts.models import User; from tenancy.models import Tenant; user = User.objects.get(email='admin@micliente.com'); user.tenant = Tenant.objects.get(slug='micliente'); user.save()"
```

También puedes hacerlo desde el panel de administración.

### Ejecutar
```
python manage.py runserver 0.0.0.0:8000
```

### Catálogo de contratos
Cada tenant administra su propio catálogo jurídico mediante `/api/materialidad/contratos/`. Asocia cada contrato a la empresa, proceso y tipo de actividad, y vincúlalo a las operaciones generadas en `/api/materialidad/operaciones/` para asegurar trazabilidad completa ante revisiones SAT.

## Frontend
```
cd frontend
npm install
cp .env.local.template .env.local  # define NEXT_PUBLIC_API_BASE_URL con el dominio real del backend
npm run dev
```

## Pruebas automáticas
Ejecuta la suite completa (checks Django + lint/build de Next.js) desde la raíz con:

```
./scripts/run_tests.sh
```

El script detecta automáticamente el `python` del entorno virtual en `backend/.venv` y solo instala dependencias de Node la primera vez. Puedes omitir alguno de los bloques exportando banderas antes de ejecutarlo:

```
SKIP_BACKEND=1 ./scripts/run_tests.sh   # solo frontend
SKIP_FRONTEND=1 ./scripts/run_tests.sh  # solo backend
```

Los comandos internos son:
- Backend: `manage.py check`, `manage.py migrate --noinput` y `manage.py test`.
- Frontend: `npm run lint` seguido de `npm run build` para asegurar que la App Router compile sin errores.

Si necesitas personalizar la suite (por ejemplo, usar otra base de datos de pruebas), modifica el script respetando la misma estructura.

## Despliegue
Consulta `docs/deployment.md` para instrucciones detalladas en Ubuntu 24.04 con Gunicorn, systemd, Nginx y Certbot.

## n8n
`docs/n8n-workflow.md` describe la topología sugerida para validar proveedores en tiempo real y sincronizar estatus con el backend sin utilizar datos ficticios.
# materialidad
# materialidad
# materialidad
# materialidad
# materialidad
