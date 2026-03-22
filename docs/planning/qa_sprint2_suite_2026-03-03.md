# QA Sprint 2 — Suite Consolidada (E2-QA-R1)

**Fecha:** `2026-03-03`  
**Proyecto:** `materialidad`  
**Rama:** `feat/materialidad-validacion-expediente`

## Objetivo
Validar de forma automática y reproducible el alcance de Sprint 2:
- Workflow endurecido de transición de estatus (`H1`).
- Reglas de expediente reusable por perfil (`H2`).
- Semáforo de riesgo base (`H4`).
- Alertas deduplicadas por faltantes críticos (`H5`).
- Bandeja de revisión por rol con filtros/orden/paginación (`H3`).

## Suite ejecutada
- `materialidad.tests.test_operacion_cambiar_estatus`
- `materialidad.tests.test_operacion_bandeja_revision`

## Comando de ejecución
```bash
cd /home/gaibarra/materialidad/backend
/home/gaibarra/materialidad/.venv/bin/python manage.py test \
  materialidad.tests.test_operacion_cambiar_estatus \
  materialidad.tests.test_operacion_bandeja_revision \
  -v 2
```

## Resultado
- **Total:** `27 tests`
- **Estado:** `OK`
- **Tiempo:** ~`8s`

## Cobertura funcional verificada
1. **Transiciones válidas/inválidas de estatus**
   - Rechazo de transiciones no permitidas (`400`) con detalle.
   - Persistencia y auditoría en transiciones permitidas (`200`).

2. **Semáforo de riesgo de materialidad**
   - Cálculo determinístico de riesgo `BAJO/MEDIO/ALTO`.
   - Persistencia en `metadata.riesgo_materialidad`.
   - Exposición en serializers de operación y bandeja.

3. **Alertas por faltantes críticos**
   - Creación de alerta al bloquear intento de `VALIDADO`.
   - Dedupe por `clave_dedupe` activa (no duplicación en reintentos).
   - Consulta por endpoint de alertas con filtros.

4. **Bandeja de revisión por rol (API contract)**
   - Payload con operación + riesgo + faltantes + alertas activas.
   - Filtros por `rol`, `estatus`, `riesgo`, `rfc`.
   - Orden por `riesgo` y `antiguedad` con comportamiento consistente.
   - Respuesta paginada estándar DRF.

## Observaciones
- Durante la ejecución aparecen mensajes de advertencia de validadores (`min_value in DecimalField should be Decimal type`) que no afectan el resultado funcional de la suite ejecutada.
- No se detectaron errores de sintaxis/lint en archivos modificados para Sprint 2.
