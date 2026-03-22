# PR Final — Sprint 4 Materialidad (Hardening + Operación)

> Documento listo para copiar/pegar en GitHub PR y usar en comité de salida.

## Título sugerido de PR
`feat(materialidad): completar Sprint 4 (hardening decimalfield + observabilidad + smoke post-deploy)`

## Branches
- **Base:** `main`
- **Compare:** `feat/materialidad-validacion-expediente`

## Descripción sugerida (copiar en PR)

### Resumen ejecutivo
Este PR completa el alcance de **Sprint 4** con foco en estabilidad operativa post-release de materialidad:

- Hardening de validadores numéricos para eliminar warnings en `DecimalField`.
- Observabilidad base en endpoints `/api/materialidad/*` (latencia + estatus HTTP).
- Smoke test post-deploy automatizado para endpoints críticos.
- Mejora técnica en exportables PDF/ZIP sin regresión funcional.
- Runbook operativo y evidencia QA Sprint 4 en verde.

---

### Alcance funcional por historia

#### `E4-H1-R1` — Hardening de validadores numéricos
- Ajuste de `MinValueValidator` para usar `Decimal("0")` en campos de monto críticos.
- Eliminación del warning recurrente: `min_value in DecimalField should be Decimal type`.

#### `E4-H2-R1` — Smoke tests automáticos post-deploy
- Script ejecutable de validación rápida:
  - `scripts/smoke_materialidad_postdeploy_sprint4.sh`
- Cubre PDF, ZIP, matriz, cobertura P0, cambio de estatus y bandeja.

#### `E4-H3-R1` — Observabilidad operativa base
- Nuevo middleware: `MaterialidadMetricsMiddleware`.
- Registra por request de materialidad: `path`, `method`, `status_code`, `duration_ms`, `tenant`.
- Umbral configurable para request lento: `MATERIALIDAD_OBSERVABILITY_SLOW_MS`.

#### `E4-H4-R1` — Optimización segura exportables
- Mejoras en `exporters` para reuso de colecciones prefetched.
- Lectura robusta de archivos para ZIP con control de faltantes sin romper flujo.

#### `E4-H5-R1` — Runbook operativo
- Documento de operación/incidentes/rollback y verificación 24h:
  - `docs/planning/runbook_operacion_sprint4_2026-03-04.md`

#### `E4-QA-R1` — Cierre QA Sprint 4
- Evidencia técnica centralizada:
  - `docs/planning/qa_sprint4_suite_2026-03-04.md`

---

### Cambios técnicos relevantes

#### Backend
- `backend/materialidad/models.py`
  - Hardening de validadores en campos decimales (`Decimal("0")`).
- `backend/materialidad/middleware.py`
  - Nuevo middleware de observabilidad para endpoints materialidad.
- `backend/materialidad_backend/settings.py`
  - Registro del middleware y logger `materialidad.observability`.
  - Nueva variable: `MATERIALIDAD_OBSERVABILITY_SLOW_MS`.
- `backend/materialidad/exporters.py`
  - Reuso de prefetched en evidencias.
  - Lectura de archivos ZIP más robusta.

#### Operación/Docs
- `scripts/smoke_materialidad_postdeploy_sprint4.sh`
- `docs/planning/runbook_operacion_sprint4_2026-03-04.md`
- `docs/planning/qa_sprint4_suite_2026-03-04.md`

---

### Validación ejecutada

#### Smoke post-deploy
```bash
cd /home/gaibarra/materialidad
bash scripts/smoke_materialidad_postdeploy_sprint4.sh
```
Resultado: **`6 tests OK`** en **`2.143s`**.

#### Regresión consolidada
```bash
cd /home/gaibarra/materialidad/backend
/home/gaibarra/materialidad/.venv/bin/python manage.py test \
  materialidad.tests.test_operacion_export_pdf \
  materialidad.tests.test_operacion_export_dossier \
  materialidad.tests.test_operacion_matriz_materialidad \
  materialidad.tests.test_dashboard_cobertura_p0 \
  materialidad.tests.test_operacion_cambiar_estatus \
  materialidad.tests.test_operacion_bandeja_revision \
  -v 2
```
Resultado: **`36 tests OK`** en **`10.909s`**.

---

### Riesgos / notas operativas
- Las respuestas `400` observadas en logs de pruebas negativas son esperadas por reglas de negocio.
- Se recomienda mantener ejecución de smoke en `T0`, `T+8h`, `T+24h` post-deploy.
- Sin bloqueantes técnicos abiertos al cierre de Sprint 4.

---

### Checklist de merge
- [ ] Revisar middleware de observabilidad en staging.
- [ ] Confirmar variable `MATERIALIDAD_OBSERVABILITY_SLOW_MS` por ambiente.
- [ ] Ejecutar smoke post-deploy en staging.
- [ ] Aprobar evidencia `qa_sprint4_suite_2026-03-04.md`.
- [ ] Validar runbook con equipo de operación.

---

## Checklist Release / UAT (operativo)

### Pre-deploy
- [ ] Backup de base de datos.
- [ ] Migraciones aplicadas (si corresponde).
- [ ] Variables de entorno verificadas.
- [ ] Ventana de despliegue aprobada.

### UAT/Smoke mínimo
- [ ] Smoke Sprint 4 en verde.
- [ ] Exportable PDF funcional.
- [ ] ZIP con manifiesto íntegro.
- [ ] Matriz documental con filtros.
- [ ] Cobertura P0 visible en dashboard.

### Post-deploy (24h)
- [ ] Monitoreo `4xx/5xx` sin desvíos críticos.
- [ ] Latencia p95 de endpoints críticos dentro de umbral.
- [ ] Incidencias P0/P1 = 0.

### Criterio de salida
- [ ] QA técnico en verde.
- [ ] UAT operativo completado.
- [ ] Comité GO/NO-GO con aprobación formal.
