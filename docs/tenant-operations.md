# Operaciones multitenant

## Creación de tenant
1. Desde `backend/` ejecuta `python3 manage.py create_tenant "Nombre Legal" slug nombre_base usuario "contraseña" host [puerto] --create-db`. El puerto es opcional (5432 por defecto). También puedes usar `./scripts/create_tenant_database.sh` con los mismos argumentos si deseas automatizarlo desde la raíz del repositorio.
2. Ingresa al admin de Django y relaciona usuarios con el tenant recién creado (o hazlo por consola). Ejemplo rápido por shell:

```
python3 manage.py createsuperuser --email admin@cliente.com --password "ContraseñaFuerte"
python3 manage.py shell -c "from accounts.models import User; from tenancy.models import Tenant; user = User.objects.get(email='admin@cliente.com'); user.tenant = Tenant.objects.get(slug='cliente'); user.save()"
```

Asegúrate de que cada usuario tenga un correo válido, ya que el formulario de login exige direcciones con `@`.
3. Si quieres automatizar todo en un solo paso, combina la creación con la asignación inicial del usuario administrador:

```
python3 manage.py create_tenant "Nombre Legal" slug nombre_base usuario "ContraseñaFuerte" host [puerto] --create-db && \
python3 manage.py shell -c "from accounts.models import User; from tenancy.models import Tenant; user = User.objects.get(email='usuario'); user.tenant = Tenant.objects.get(slug='slug'); user.save()"
```

Sustituye `usuario`, `slug` y los credenciales por los valores reales del cliente.

## Privilegios en la base de control
- El usuario de la base de control debe tener `CREATEROLE` y `CREATEDB` para que el aprovisionamiento web pueda crear el rol y la base dedicados.
- En proveedores gestionados (RDS, Cloud SQL, AlloyDB) donde no puedes otorgar `CREATEDB`, pre-crea la base y el rol y desactiva el flag `create_database` en el endpoint o UI.
- Revisa que el firewall permita conexiones desde el servidor donde corre Django antes de lanzar el aprovisionamiento.

## Migraciones
- Ejecuta `python backend/manage.py migrate` para la base de control.
- Aplica a cada tenant:
Ejecuta `./scripts/migrate_tenant.sh` indicando el slug objetivo para aplicar los cambios en la base correspondiente. Al ejecutarlo sin parámetros se procesan todos los tenants activos.

## Middleware y encabezados
- Todas las peticiones al módulo de materialidad deben incluir `X-Tenant`.
- El middleware valida que exista y esté activo antes de abrir la conexión dedicada.
- Registra cada rechazo en el middleware con los campos `tenant_slug`, `path`, `remote_addr` y el motivo; puedes usar `structlog` o `logging` estándar para detectar patrones anómalos.

## Estrategia de aislamiento
- Cada tenant vive en una base PostgreSQL independiente; el alias interno de conexión se construye concatenando `tenant_` con el slug.
- No existen llaves foráneas hacia tablas del control DB; cualquier referencia (por ejemplo usuarios que crean operaciones) se almacena como datos denormalizados (`creado_por_usuario_id`, `creado_por_email`).
- El router `TenantDatabaseRouter` fuerza que los modelos del app `materialidad` sólo lean y escriban en la base activa.
- Declara explícitamente en `settings.py` el router y middleware activos para evitar confusiones al agregar apps nuevas:

```
DATABASE_ROUTERS = ["tenancy.routers.TenantDatabaseRouter"]
TENANT_MIDDLEWARE = "tenancy.middleware.TenantMiddleware"
```

Revisa esta sección cada vez que se integre una app que deba aislarse por tenant.

## Catálogo jurídico por tenant
- El modelo `Contrato` almacena la matriz de contratos (categoría, proceso, tipo de empresa, vigencias) para cada empresa dentro del tenant.
- Cada operación puede ligar un contrato mediante el campo `contrato`, lo que permite rastrear la evidencia jurídica asociada a los CFDI de ingresos y egresos.
- Define políticas internas para mantener el catálogo actualizado antes de emitir o recibir CFDI; el sistema valida que el contrato seleccionado pertenezca a la misma empresa de la operación.

## Checklist posterior a la creación
1. Confirmar que la base del tenant se creó (`\l tenant_slug_*` en `psql`).
2. Ejecutar `./scripts/migrate_tenant.sh slug` y verificar que no existan errores.
3. Cargar catálogos mínimos (contratos, tipos de operación) mediante fixtures o comandos.
4. Crear usuarios del cliente, habilitar MFA y validar el acceso al dashboard.
5. Realizar una petición con `X-Tenant: slug` para comprobar el middleware y revisar los logs resultantes.
