# MINUTA FORMAL DE LIBERACIÓN CONTROLADA
## Dictamen de Cumplimiento y Aprobación Condicionada

**Empresa:** ________________________________  
**Proyecto:** `materialidad`  
**Folio:** `MIN-LIB-MAT-2026-03-03-01`  
**Fecha:** `03/03/2026`  
**Ambiente evaluado:** `Staging`  
**Rama evaluada:** `feat/materialidad-validacion-expediente`  
**PR:** `https://github.com/gaibarra/materialidad/compare/main...feat/materialidad-validacion-expediente?expand=1`

---

### 1. Objeto de la minuta
Documentar el resultado de la evaluación técnica, funcional y de cumplimiento para la liberación del cambio relativo a validación bloqueante por expediente, gestión de evidencias y trazabilidad de auditoría.

### 2. Alcance evaluado
- Bloqueo de transición a `VALIDADO` cuando el expediente se encuentre incompleto.
- Reglas de validación por perfil:
  - `SERVICIOS`
  - `COMPRAS`
  - `PARTES_RELACIONADAS`
- Gestión de evidencias de materialidad (`CRUD` y filtros).
- Registro de trazabilidad en `AuditLog`.
- Migración aplicada: `backend/materialidad/migrations/0044_evidenciamaterial_estatus_revision_and_more.py`.

### 3. Evidencia de validación
- Migración aplicada en staging: **[x] Sí / [ ] No**
- Suite focalizada ejecutada (`materialidad.tests.test_operacion_cambiar_estatus`): **[x] Sí / [ ] No**
- Resultado de pruebas: **`13 tests OK`**
- Evidencias adjuntas (logs/capturas/IDs):
  - `c57361e` — backend (validación + evidencias + tests)
  - `a67d166` — docs planning Jira
  - `8bcaefe` — fuente legal base
  - `6edc718` — backlog Sprint 2 importable

### 4. Resultado funcional
| Caso | Resultado |
|---|---|
| SERVICIOS incompleto bloquea `VALIDADO` (400) | [x] Conforme |
| SERVICIOS completo permite `VALIDADO` (200) | [x] Conforme |
| COMPRAS incompleto bloquea `VALIDADO` (400) | [x] Conforme |
| COMPRAS completo permite `VALIDADO` (200) | [x] Conforme |
| PARTES_RELACIONADAS sin razón de negocio bloquea (400) | [x] Conforme |
| PARTES_RELACIONADAS completo permite `VALIDADO` (200) | [x] Conforme |
| Auditoría de cambios en `AuditLog` | [x] Conforme |
| Frontend muestra `faltantes` y `perfil_validacion` | [ ] Pendiente de validación UAT |

### 5. Riesgo residual
**Clasificación:** [x] Bajo  [x] Medio  [ ] Alto  
**Descripción:** Riesgo operativo moderado por cambio de comportamiento (rechazo explícito al intentar `VALIDADO` con expediente incompleto).  
**Mitigación definida:** UAT funcional en staging, smoke test post-deploy y monitoreo 24h de errores 4xx/5xx y eventos de auditoría.

### 6. Condiciones obligatorias para producción
1. Confirmar en frontend render consistente de `faltantes` y `perfil_validacion` ante `HTTP 400`.
2. Ejecutar smoke test post-deploy (mínimo):
   - 1 caso bloqueado (`400`)
   - 1 caso completo (`200`)
3. Activar monitoreo de 24 horas:
   - errores 4xx/5xx de `cambiar-estatus`
   - consistencia de registros en `AuditLog`.
4. Registrar evidencia de ejecución (capturas/logs) en ticket de release.

### 7. Dictamen
**Decisión:** **GO CONDICIONADO ESTRICTO**  
La liberación a producción procede únicamente al cumplimiento verificable de las condiciones del punto 6 y a la obtención de aprobaciones del punto 8.

### 8. Aprobaciones
| Rol | Nombre | Firma | Fecha |
|---|---|---|---|
| Responsable Técnico (Backend) | __________________ | __________________ | ____/____/______ |
| Responsable Funcional (Operación/Contable) | __________________ | __________________ | ____/____/______ |
| Responsable de Cumplimiento (Fiscal/Compliance) | __________________ | __________________ | ____/____/______ |
| Responsable de Release/DevOps | __________________ | __________________ | ____/____/______ |

---

### 9. Observaciones finales
__________________________________________________________________  
__________________________________________________________________  
__________________________________________________________________
