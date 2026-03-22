# QA Sprint 4 — Estabilidad Operativa (E4-QA-R1)

**Fecha:** `2026-03-04`  
**Proyecto:** `materialidad`  
**Rama:** `feat/materialidad-validacion-expediente`

## Objetivo
Validar la implementación técnica de Sprint 4 enfocada en:
- Hardening de validadores `DecimalField`.
- Smoke tests automáticos post-deploy.
- Observabilidad operativa base para endpoints de materialidad.
- Optimización segura de exportables PDF/ZIP sin regresión funcional.

## Cambios validados
- `backend/materialidad/models.py`
  - `MinValueValidator(0)` migrado a `MinValueValidator(Decimal("0"))`.
- `backend/materialidad/middleware.py`
  - Nuevo middleware `MaterialidadMetricsMiddleware` para latencia/estatus por request.
- `backend/materialidad_backend/settings.py`
  - Registro de middleware + logger `materialidad.observability` + umbral `MATERIALIDAD_OBSERVABILITY_SLOW_MS`.
- `backend/materialidad/exporters.py`
  - Reuso de colecciones prefetched y lectura robusta de archivos en ZIP.
- `scripts/smoke_materialidad_postdeploy_sprint4.sh`
  - Script smoke post-deploy ejecutable.
- `docs/planning/runbook_operacion_sprint4_2026-03-04.md`
  - Runbook operativo y contingencia.

## Ejecución de pruebas

### 1) Smoke Sprint 4 (post-deploy)
```bash
cd /home/gaibarra/materialidad
bash scripts/smoke_materialidad_postdeploy_sprint4.sh
```

**Resultado:** `6 tests OK` en `2.143s`.

### 2) Suite consolidada de regresión
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

**Resultado:** `36 tests OK` en `10.909s`.

## Hallazgos
- Se observa logging de observabilidad para `/api/materialidad/*` con latencia y estatus.
- Las respuestas `400` en pruebas negativas continúan siendo esperadas (reglas de negocio).
- Ya no se observó la advertencia recurrente: `min_value in DecimalField should be Decimal type`.

## Dictamen técnico Sprint 4
- **Estado:** `APROBADO`.
- **Recomendación:** continuar con UAT operativo y comité `GO/NO-GO` usando acta y plantilla generadas.
