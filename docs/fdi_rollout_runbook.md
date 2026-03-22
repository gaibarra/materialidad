# Runbook de rollout FDI

## Objetivo

Ejecutar la transición final del pipeline FDI desde modo compatible con legacy hacia modo estricto basado en projections y snapshots persistidos, con criterios explícitos de promoción y rollback.

## Supuestos

- El código ya contiene:
  - `backfill_fdi_formula_version`
  - `report_fdi_readiness`
  - `FDI_ALLOW_LEGACY_FALLBACK`
  - historial administrativo en `/dashboard/administracion/fdi-runs`
- El entorno productivo usa `/srv/materialidad` y systemd según [docs/deployment.md](docs/deployment.md).

## Fase 1. Preparación en staging

### 1. Actualizar código y dependencias

```bash
cd /srv/materialidad
git pull origin main
/srv/materialidad/.venv/bin/pip install -r backend/requirements.txt
cd /srv/materialidad/backend
/srv/materialidad/.venv/bin/python manage.py migrate --no-input
/srv/materialidad/.venv/bin/python manage.py collectstatic --no-input
cd /srv/materialidad/frontend
npm ci --omit=dev
npm run build
cp -r .next/static .next/standalone/.next/static
cp -r public .next/standalone/public
sudo systemctl restart materialidad-backend
sudo systemctl restart materialidad-frontend
```

### 2. Mantener fallback habilitado durante validación

En `backend/.env`:

```env
FDI_ALLOW_LEGACY_FALLBACK=True
```

Aplicar recarga:

```bash
sudo systemctl restart materialidad-backend
```

### 3. Confirmar scheduler FDI

```bash
sudo systemctl status materialidad-fdi-snapshots.timer
sudo systemctl status materialidad-fdi-snapshots.service
journalctl -u materialidad-fdi-snapshots.service -n 100 --no-pager
```

### 4. Ejecutar backfill inicial por tenant

Un tenant puntual:

```bash
cd /srv/materialidad/backend
/srv/materialidad/.venv/bin/python manage.py backfill_fdi_formula_version \
  --tenant <tenant_slug> \
  --days 90 \
  --skip-existing \
  --include-tenant-snapshot \
  --persist-narratives
```

Varios tenants repitiendo `--tenant`:

```bash
/srv/materialidad/.venv/bin/python manage.py backfill_fdi_formula_version \
  --tenant tenant-a \
  --tenant tenant-b \
  --days 90 \
  --skip-existing \
  --include-tenant-snapshot \
  --persist-narratives
```

### 5. Ejecutar reporte de readiness

```bash
cd /srv/materialidad/backend
/srv/materialidad/.venv/bin/python manage.py report_fdi_readiness --tenant <tenant_slug>
```

Salida JSON para guardar evidencia:

```bash
/srv/materialidad/.venv/bin/python manage.py report_fdi_readiness \
  --tenant <tenant_slug> \
  --format json > /tmp/<tenant_slug>-fdi-readiness.json
```

### 6. Validación funcional en UI

- Ingresar como usuario staff.
- Abrir `/dashboard/administracion/fdi-runs`.
- Validar filtros por empresa, comando y estado.
- Validar `Cargar más`.
- Revisar `/dashboard/fdi-history`.
- Confirmar que no haya errores visibles ni lecturas en cero inesperadas.

## Fase 2. Criterio de promoción

Promover solo si el tenant cumple durante la ventana de validación acordada:

```text
coverage_gate.passed = true
snapshot_freshness_gate.passed = true
divergence_gate.passed = true
reliability_gate.passed = true
explainability_gate.passed = true
alerts = [] o solo warnings aceptados explícitamente
```

Si cualquier gate está en `FAIL`, no apagar legacy.

## Fase 3. Corte controlado en staging

### 1. Desactivar fallback legacy

Editar `backend/.env`:

```env
FDI_ALLOW_LEGACY_FALLBACK=False
```

Reiniciar backend:

```bash
sudo systemctl restart materialidad-backend
```

### 2. Revalidar inmediatamente

```bash
cd /srv/materialidad/backend
/srv/materialidad/.venv/bin/python manage.py report_fdi_readiness --tenant <tenant_slug>
journalctl -u materialidad-backend -n 200 --no-pager
journalctl -u materialidad-fdi-snapshots.service -n 200 --no-pager
```

### 3. Smoke checks obligatorios

- `GET /api/materialidad/dashboard/fdi/` responde correctamente.
- `POST /api/materialidad/dashboard/fdi/narrative/` responde correctamente.
- El dashboard técnico no muestra fallas nuevas en `fdi_pipeline.alerts`.
- El siguiente `capture_fdi_snapshots` termina en `success`.

## Fase 4. Producción

### 1. Repetir despliegue base

```bash
cd /srv/materialidad
git pull origin main
/srv/materialidad/.venv/bin/pip install -r backend/requirements.txt
cd /srv/materialidad/backend
/srv/materialidad/.venv/bin/python manage.py migrate --no-input
/srv/materialidad/.venv/bin/python manage.py collectstatic --no-input
cd /srv/materialidad/frontend
npm ci --omit=dev
npm run build
cp -r .next/static .next/standalone/.next/static
cp -r public .next/standalone/public
sudo systemctl restart materialidad-backend
sudo systemctl restart materialidad-frontend
```

### 2. Mantener fallback habilitado al inicio

```env
FDI_ALLOW_LEGACY_FALLBACK=True
```

### 3. Ejecutar backfill y readiness por tenants prioritarios

```bash
cd /srv/materialidad/backend
/srv/materialidad/.venv/bin/python manage.py backfill_fdi_formula_version \
  --tenant <tenant_slug> \
  --days 90 \
  --skip-existing \
  --include-tenant-snapshot \
  --persist-narratives

/srv/materialidad/.venv/bin/python manage.py report_fdi_readiness --tenant <tenant_slug>
```

### 4. Desactivar fallback solo después de evidencia suficiente

Cuando los tenants objetivo pasen los gates:

```env
FDI_ALLOW_LEGACY_FALLBACK=False
```

```bash
sudo systemctl restart materialidad-backend
```

## Rollback

Rollback inmediato si ocurre cualquiera de estos eventos:

- fallan jobs FDI después del corte
- el dashboard FDI deja de responder o responde con errores
- aumenta divergencia o aparecen alerts críticas no aceptadas
- el refresh de projections o capture de snapshots deja de completar dentro de SLA

### Comando operativo de rollback

Editar `backend/.env`:

```env
FDI_ALLOW_LEGACY_FALLBACK=True
```

Aplicar:

```bash
sudo systemctl restart materialidad-backend
journalctl -u materialidad-backend -n 200 --no-pager
```

Si además hubo despliegue fallido más amplio, volver al commit anterior según tu práctica normal de release y repetir `migrate`, `build` y reinicio de servicios.

## Evidencia mínima a guardar por tenant

- salida de `report_fdi_readiness --format json`
- captura de la vista `/dashboard/administracion/fdi-runs`
- último `FDIJobRun` exitoso de snapshot
- confirmación del estado del timer y del service FDI

## Secuencia resumida

1. Desplegar con `FDI_ALLOW_LEGACY_FALLBACK=True`.
2. Ejecutar backfill versionado.
3. Revisar readiness y UI administrativa.
4. Esperar ventana de validación.
5. Cambiar a `FDI_ALLOW_LEGACY_FALLBACK=False`.
6. Monitorear jobs, logs y alerts.
7. Si algo falla, rollback inmediato reactivando fallback.