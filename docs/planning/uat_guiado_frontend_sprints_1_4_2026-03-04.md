# UAT Guiado Frontend — Sprints 1,2,3,4

**Fecha:** `2026-03-04`  
**Proyecto:** `materialidad`  
**Ambiente sugerido:** `staging`  
**Objetivo:** validar experiencia de usuario, alineación API y calidad profesional del expediente digital.

## Preparación previa
- Usuario con permisos de revisión y operación.
- Tenant correcto cargado en sesión.
- Al menos 3 operaciones de prueba: riesgo alto, medio y bajo.
- Disponibles proveedores y contratos asociados.

---

## Escenario 1 — Riesgo alto con expediente incompleto (bloqueo correcto)

### Flujo
1. Ir a `Dashboard -> Expedientes`.
2. Filtrar por `Riesgo = ALTO`.
3. Elegir una operación con `estado_completitud = INCOMPLETO`.
4. Intentar `Marcar VALIDADO`.

### Resultado esperado
- Se bloquea transición por faltantes críticos.
- Se muestra mensaje claro para completar expediente.
- Permanece trazabilidad del riesgo/faltantes en UI.

### Evidencia a capturar
- Captura del card con riesgo alto e incompleto.
- Captura del mensaje de bloqueo (error).
- Registro de faltantes listados.

---

## Escenario 2 — Expediente completo y cierre profesional

### Flujo
1. Ir a `Dashboard -> Operaciones`.
2. Completar entregables con evidencia URL y recepción (firma + correo).
3. Confirmar semáforo documental en verde.
4. Ir a `Dashboard -> Expedientes` y ejecutar `Marcar VALIDADO`.

### Resultado esperado
- Cambio de estatus exitoso a `VALIDADO`.
- Mensaje de confirmación oportuno.
- Operación visible como expediente completo.

### Evidencia a capturar
- Captura antes/después de estatus.
- Captura de entregables en estado `RECIBIDO`.
- Captura del éxito de validación.

---

## Escenario 3 — Exportables de defensa fiscal (PDF + ZIP)

### Flujo
1. En `Dashboard -> Expedientes`, seleccionar operación validada.
2. Ejecutar `PDF defensa`.
3. Ejecutar `ZIP dossier`.
4. Verificar descarga de ambos archivos.

### Resultado esperado
- Descarga correcta de PDF y ZIP.
- ZIP contiene `manifiesto_integridad.json`.
- Mensajería UI coherente para uso en requerimiento SAT.

### Evidencia a capturar
- Captura de botones y resultado de descarga.
- Evidencia de contenido del ZIP (manifiesto).
- Validación visual de nombre/formato de archivos.

---

## Criterios de aceptación UAT
- [ ] Los 3 escenarios concluyen sin bloqueantes P1/P0.
- [ ] Mensajes UI orientan a expediente profesional y acción concreta.
- [ ] Alineación frontend-backend verificada en estatus, matriz, bandeja y exportables.
- [ ] Evidencia de ejecución archivada para comité GO/NO-GO.

## Registro rápido de resultados
| Escenario | Resultado | Observaciones | Evidencia |
|---|---|---|---|
| 1 (riesgo alto incompleto) | `PASS/FAIL/BLOCKED` | `________________` | `________________` |
| 2 (expediente completo) | `PASS/FAIL/BLOCKED` | `________________` | `________________` |
| 3 (exportables defensa) | `PASS/FAIL/BLOCKED` | `________________` | `________________` |

## Dictamen UAT
- Resultado final: `GO / NO-GO`
- Responsable UAT: `________________`
- Fecha/hora: `________________`
