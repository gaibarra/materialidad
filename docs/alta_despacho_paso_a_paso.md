# Alta de despacho contable (paso a paso, sin omitir nada)

Esta guía describe **todas** las acciones para incorporar un despacho con 1 administrador y varios usuarios, hasta dejarlo listo para operar con datos reales.

## 0) Prerrequisitos (verifica antes de iniciar)

1. **Backend y frontend disponibles**
   - Backend corriendo (ej. `http://localhost:8002`).
   - Frontend corriendo (ej. `http://localhost:3003`).
2. **PostgreSQL operativo**
   - Servicio activo y accesible (`psql` o conexión desde Django).
3. **Variables de entorno**
   - Archivo `backend/.env` con `DJANGO_CONTROL_DB_URL` apuntando a la **base de control** (multitenant).
   - Archivo `frontend/.env.local` con `NEXT_PUBLIC_API_BASE_URL` apuntando al backend.

**Dónde queda registrado:**
- Configuración de backend: `backend/.env`
- Configuración de frontend: `frontend/.env.local`

---

## 1) Crear el despacho (entidad operativa)

El despacho vive en la **base de control** y se guarda en la tabla `tenancy_despacho`.

### Opción A: desde Django shell (recomendado para onboarding técnico)

```bash
/home/gaibarra/materialidad/backend/.venv/bin/python \
  /home/gaibarra/materialidad/backend/manage.py shell -c \
  "from tenancy.models import Despacho; \
  Despacho.objects.get_or_create(
      nombre='Despacho X',
      defaults={'contacto_email':'admin@despachox.com','contacto_telefono':'5555555555','notas':'Alta inicial'}
  )"
```

**Dónde queda registrado:**
- Tabla: `tenancy_despacho` (base de control)
- Modelo: `backend/tenancy/models.py` → `class Despacho`

---

## 2) Crear el tenant del despacho (con su base dedicada)

Cada cliente/delivery del despacho opera en una **base aislada por tenant**. El registro principal queda en la base de control y la base del tenant se crea aparte.

### 2.1 Preparar el rol de base de datos del tenant

> Si ya existe un rol para el tenant, omite este paso.

```bash
PGPASSWORD=postgres psql -h localhost -U postgres -d postgres <<'SQL'
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tenant_user') THEN
    CREATE ROLE "tenant_user" LOGIN PASSWORD 'tenant_password';
  END IF;
END $$;
SQL
```

**Dónde queda registrado:**
- PostgreSQL roles (`pg_roles`)

### 2.2 Crear el tenant y su base dedicada

```bash
/home/gaibarra/materialidad/backend/.venv/bin/python \
  /home/gaibarra/materialidad/backend/manage.py create_tenant \
  "Despacho X" \
  despachox \
  materialidad_despachox \
  "tenant_user" \
  "tenant_password" \
  localhost \
  5432 \
  --create-db
```

**Dónde queda registrado:**
- Tabla: `tenancy_tenant` (base de control)
- Modelo: `backend/tenancy/models.py` → `class Tenant`
- Comando: `backend/tenancy/management/commands/create_tenant.py`
- Base creada en PostgreSQL: `materialidad_despachox`

### 2.3 Otorgar permisos al rol del tenant (si es necesario)

```bash
PGPASSWORD=postgres psql -h localhost -U postgres -d materialidad_despachox <<'SQL'
ALTER SCHEMA public OWNER TO "tenant_user";
GRANT ALL ON SCHEMA public TO "tenant_user";
GRANT ALL PRIVILEGES ON DATABASE materialidad_despachox TO "tenant_user";
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO "tenant_user";
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO "tenant_user";
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO "tenant_user";
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO "tenant_user";
SQL
```

**Dónde queda registrado:**
- Permisos de DB en PostgreSQL

---

## 3) Migrar la base del tenant

Esto crea todas las tablas operativas para el tenant.

```bash
/home/gaibarra/materialidad/backend/.venv/bin/python \
  /home/gaibarra/materialidad/backend/manage.py migrate_tenant --slug despachox
```

**Dónde queda registrado:**
- Tablas del tenant en `materialidad_despachox`
- Comando: `backend/tenancy/management/commands/migrate_tenant.py`

---

## 4) Crear el administrador del despacho

El administrador es un usuario de `accounts_user` en la base de control.

### 4.1 Crear superusuario (si aplica)

```bash
/home/gaibarra/materialidad/backend/.venv/bin/python \
  /home/gaibarra/materialidad/backend/manage.py shell -c \
  "from accounts.models import User; \
  User.objects.filter(email='admin@despachox.com').exists() or \
  User.objects.create_superuser(email='admin@despachox.com', password='PasswordSeguro!')"
```

**Dónde queda registrado:**
- Tabla: `accounts_user` (base de control)
- Modelo: `backend/accounts/models.py` → `class User`

### 4.2 Asignar el admin al tenant y al despacho

```bash
/home/gaibarra/materialidad/backend/.venv/bin/python \
  /home/gaibarra/materialidad/backend/manage.py shell -c \
  "from accounts.models import User; from tenancy.models import Tenant, Despacho; \
  u=User.objects.get(email='admin@despachox.com'); \
  u.tenant=Tenant.objects.get(slug='despachox'); \
  u.despacho=Despacho.objects.get(nombre='Despacho X'); \
  u.save()"
```

**Dónde queda registrado:**
- Tabla: `accounts_user` (campos `tenant_id`, `despacho_id`)

---

## 5) Crear usuarios adicionales

Cada usuario se crea en `accounts_user` y se enlaza al mismo `tenant` y `despacho`.

```bash
/home/gaibarra/materialidad/backend/.venv/bin/python \
  /home/gaibarra/materialidad/backend/manage.py shell -c \
  "from accounts.models import User; from tenancy.models import Tenant, Despacho; \
  t=Tenant.objects.get(slug='despachox'); d=Despacho.objects.get(nombre='Despacho X'); \
  u=User.objects.create_user(email='usuario1@despachox.com', password='PasswordSeguro1!'); \
  u.tenant=t; u.despacho=d; u.save()"
```

**Dónde queda registrado:**
- Tabla: `accounts_user`

---

## 6) Verificar acceso y operación básica

1. **Login** con el admin en el frontend.
2. **Dashboard** visible y sin errores.
3. **Catálogos y operaciones** accesibles (Empresas, Proveedores, Contratos, Operaciones).
4. **Evidencias**: carga y consulta de archivos, si aplica.

---

## 7) (Opcional) Configurar IA por tenant

Si se requiere LLM por tenant, usa `TenantAIConfig`.

```bash
/home/gaibarra/materialidad/backend/.venv/bin/python \
  /home/gaibarra/materialidad/backend/manage.py shell -c \
  "from tenancy.models import Tenant, TenantAIConfig; \
  t=Tenant.objects.get(slug='despachox'); \
  TenantAIConfig.objects.update_or_create(
      tenant=t,
      defaults={'provider':'openai','api_key':'TU_API_KEY'}
  )"
```

**Dónde queda registrado:**
- Tabla: `tenancy_tenant_ai_config`

---

## 8) Checklist final (listo para datos reales)

- [ ] `backend/.env` con DB de control correcta.
- [ ] Tenant creado (`tenancy_tenant`) y base dedicada creada.
- [ ] Migraciones del tenant aplicadas.
- [ ] Admin creado y asignado a tenant + despacho.
- [ ] Usuarios operativos creados y asignados.
- [ ] Login y dashboard funcionando.

---

## Referencias de archivos clave

- `backend/tenancy/management/commands/create_tenant.py`
- `backend/tenancy/management/commands/migrate_tenant.py`
- `backend/tenancy/models.py`
- `backend/accounts/models.py`
- `backend/.env`
- `frontend/.env.local`
