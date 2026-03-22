# QA Sprint 3 — Suite Consolidada (E3-QA-R1)

**Fecha:** `2026-03-04`  
**Proyecto:** `materialidad`  
**Rama:** `feat/materialidad-validacion-expediente`

## Objetivo
Validar de forma automática y reproducible el alcance funcional de Sprint 3:
- `E3-H1-R1`: Exporte PDF de defensa fiscal.
- `E3-H2-R1`: ZIP probatorio v2 con manifiesto SHA-256.
- `E3-H3-R1`: Matriz CFDI-Contrato-Pago-Evidencia.
- `E3-H4-R1`: Dashboard de cobertura P0.
- Regresión crítica de flujo en `cambiar-estatus` y `bandeja-revision`.

## Suite ejecutada
- `materialidad.tests.test_operacion_export_pdf`
- `materialidad.tests.test_operacion_export_dossier`
- `materialidad.tests.test_operacion_matriz_materialidad`
- `materialidad.tests.test_dashboard_cobertura_p0`
- `materialidad.tests.test_operacion_cambiar_estatus`
- `materialidad.tests.test_operacion_bandeja_revision`

## Comando de ejecución
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

## Resultado
- **Total:** `36 tests`
- **Estado:** `OK`
- **Tiempo:** `13.714s`

## Cobertura funcional verificada
1. **PDF de defensa fiscal (`E3-H1-R1`)**
   - Descarga de PDF válido con secciones mínimas requeridas.
   - Contenido base consistente para defensa documental.

2. **ZIP probatorio v2 (`E3-H2-R1`)**
   - Inclusión de `manifiesto_integridad.json` en el ZIP.
   - Verificación de huellas `SHA-256` consistentes con archivos incluidos.

3. **Matriz CFDI-Contrato-Pago-Evidencia (`E3-H3-R1`)**
   - Construcción de cadena documental por operación.
   - Cálculo de completitud y estado de cobertura por eslabón.
   - Filtros por riesgo/estatus/RFC y orden por antigüedad.

4. **Dashboard cobertura P0 (`E3-H4-R1`)**
   - Contrato de respuesta esperado para métricas de cobertura.
   - Filtro por empresa con comportamiento determinístico.

5. **Regresión de flujo operativo (Sprint 1-2-3)**
   - `cambiar-estatus`: bloqueo/permiso de transición según reglas y expediente.
   - `bandeja-revision`: payload, filtros, orden y paginación estables.

## UAT recomendado (3 casos)
1. **Control documental completo de operación**
   - Crear operación con expediente completo y evidencias válidas.
   - Validar transición a `VALIDADO` y visibilidad en matriz/dashboard.

2. **Bloqueo por faltantes críticos y alerta activa**
   - Intentar `VALIDADO` con faltantes críticos.
   - Confirmar error funcional, creación de alerta y presencia en bandeja.

3. **Trazabilidad de exportables para defensa**
   - Descargar PDF y ZIP v2 de la misma operación.
   - Confirmar consistencia de documentos y manifiesto de integridad.

## Observaciones
- Durante la ejecución aparecen advertencias de validadores (`min_value in DecimalField should be Decimal type`) y respuestas `400` esperadas en pruebas negativas; no afectan el resultado funcional.
- No se detectaron fallas en la suite consolidada; Sprint 3 queda técnicamente listo para cierre QA.
