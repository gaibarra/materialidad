# Pendientes Operativos — Cierre Release Sprint 3

**Fecha de corte:** `2026-03-04`  
**Proyecto:** `materialidad`  
**Rama:** `feat/materialidad-validacion-expediente`

## Objetivo
Ejecutar y cerrar los pendientes de UAT/release/post-deploy para declarar Sprint 3 liberado en operación.

## Tablero de pendientes (accionable)

| ID | Prioridad | Pendiente | Responsable sugerido | Fecha objetivo | Estado | Criterio de aceptación |
|---|---|---|---|---|---|---|
| P1 | Alta | UAT funcional completo en staging | Funcional + QA | 2026-03-05 | Pendiente | 5/5 casos UAT en verde y evidencia capturada |
| P2 | Alta | Checklist pre-deploy (backup, migraciones, env, tenant) | DevOps + Backend | 2026-03-05 | Pendiente | Checklist firmado sin bloqueantes |
| P3 | Alta | Aprobaciones de salida (técnico/funcional/compliance) | PM + Líder técnico | 2026-03-05 | Pendiente | Aprobaciones registradas para merge/release |
| P4 | Media | Monitoreo post-deploy 24h (`4xx/5xx`, latencia exportables) | DevOps + Backend | 2026-03-06 | Pendiente | Incidencias P1/P0 = 0 y reporte de observación |
| P5 | Media | Validar consistencia de cobertura P0 por empresa | Backend + Producto | 2026-03-06 | Pendiente | Métrica consistente contra muestra manual |
| P6 | Baja | Hardening técnico de advertencias DecimalField | Backend | 2026-03-07 | Pendiente | Sin warnings relevantes en suite objetivo |

## Casos UAT mínimos (obligatorios)

1. **Operación completa permite `VALIDADO`**
   - Crear/usar operación con expediente completo.
   - Confirmar transición válida y auditoría registrada.

2. **Bloqueo por faltantes críticos + alerta**
   - Intentar `VALIDADO` con faltantes críticos.
   - Confirmar `400`, detalle de faltantes y alerta activa asociada.

3. **Exportable PDF de defensa**
   - Descargar PDF por operación.
   - Confirmar estructura mínima de secciones y legibilidad.

4. **Dossier ZIP v2 con integridad**
   - Descargar ZIP.
   - Confirmar presencia de `manifiesto_integridad.json`.

5. **Matriz + Cobertura P0**
   - Consultar matriz con filtros (riesgo/estatus/RFC) y orden.
   - Confirmar visualización de cobertura P0 en dashboard ejecutivo.

## Secuencia recomendada de ejecución (hoy)

1. Correr UAT funcional en staging con evidencia por caso.
2. Ejecutar checklist pre-deploy y resolver bloqueantes.
3. Solicitar y registrar aprobaciones de salida.
4. Programar ventana de deploy y activar monitoreo 24h.

## Comandos útiles (copy/paste)

### Validación técnica rápida backend (local)
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

### Verificación de cambios versionados
```bash
cd /home/gaibarra/materialidad
git status --short
git log --oneline -n 5
```

## Evidencia relacionada
- `docs/planning/qa_sprint3_suite_2026-03-04.md`
- `docs/planning/pr_sprint3_final_2026-03-04.md`

## Bloqueantes conocidos al corte
- No hay bloqueantes técnicos abiertos en suite de Sprint 3.
- Quedan pendientes actividades manuales de staging/operación y aprobaciones formales.
