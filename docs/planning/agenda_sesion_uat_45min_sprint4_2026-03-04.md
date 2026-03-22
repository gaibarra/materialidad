# Agenda de Sesión UAT (45 min) — Sprint 4

**Proyecto:** `materialidad`  
**Fecha:** `2026-03-04`  
**Duración total:** `45 minutos`  
**Objetivo:** validar frontend alineado a Sprints 1-4 con foco en expediente profesional y emitir decisión `GO/NO-GO`.

## Participantes sugeridos
- Facilitador UAT (QA funcional)
- Líder funcional/compliance
- Líder técnico (backend/frontend)
- Operación/usuario clave de revisión
- DevOps (opcional, para salida)

## Pre-lectura obligatoria (antes de sesión)
- `docs/planning/validacion_alineacion_frontend_sprints_1_4_2026-03-04.md`
- `docs/planning/uat_guiado_frontend_sprints_1_4_2026-03-04.md`
- `docs/planning/acta_aceptacion_frontend_sprints_1_4_2026-03-04.md`
- `docs/planning/checklist_go_nogo_sprint4_2026-03-04.md`

## Estructura de 45 minutos

### 0:00 – 0:05 | Apertura y objetivo
**Responsable:** Facilitador UAT  
**Meta:** alinear alcance, reglas y resultado esperado.

**Script breve:**
- Confirmar objetivo: “hoy decidimos si frontend está listo para operación profesional de expedientes”.
- Confirmar evidencia y participantes con derecho de aprobación.
- Establecer criterio de salida: sin bloqueantes `P1/P0`.

### 0:05 – 0:10 | Estado técnico express
**Responsable:** Líder técnico  
**Meta:** validar base técnica en verde.

**Script breve:**
- Reportar resultado de lint/tests relevantes.
- Confirmar endpoints críticos consumidos por frontend (`bandeja`, `matriz`, `alertas`, `cambiar-estatus`, exportables).
- Confirmar observabilidad y smoke post-deploy disponibles.

### 0:10 – 0:28 | Ejecución UAT guiado (3 escenarios)
**Responsable:** QA + Usuario clave  
**Meta:** ejecutar casos de negocio reales end-to-end.

1. **Escenario 1 (riesgo alto incompleto):** bloqueo correcto de `VALIDADO`.
2. **Escenario 2 (expediente completo):** transición y cierre profesional exitoso.
3. **Escenario 3 (defensa fiscal):** exportación PDF + ZIP con evidencia.

**Regla de evidencia por escenario:**
- Captura de pantalla.
- Resultado `PASS/FAIL/BLOCKED`.
- Observación y responsable (si aplica).

### 0:28 – 0:35 | UX profesional y mensajes oportunos
**Responsable:** Líder funcional/compliance  
**Meta:** validar claridad de mensajes y orientación al usuario.

**Preguntas guía:**
- ¿Los mensajes indican claramente qué falta para expediente defendible?
- ¿La priorización por riesgo/faltantes es accionable?
- ¿La interfaz guía al usuario a decisiones correctas sin ambigüedad?

### 0:35 – 0:41 | Hallazgos y decisión preliminar
**Responsable:** Facilitador + todos  
**Meta:** clasificar hallazgos y definir viabilidad de salida.

**Clasificación rápida:**
- `P0/P1` = bloquea salida
- `P2/P3` = se agenda con plan de corrección

### 0:41 – 0:45 | Cierre formal GO/NO-GO
**Responsable:** Comité (técnico/funcional/compliance)

**Salida esperada:**
- Dictamen: `GO` o `NO-GO`
- Condiciones (si existen)
- Responsable de seguimiento + fecha compromiso
- Firma/VoBo en acta

---

## Plantilla de minuto a minuto (llenable)
| Minuto | Bloque | Responsable | Resultado |
|---|---|---|---|
| 00-05 | Apertura | `________________` | `________________` |
| 05-10 | Estado técnico | `________________` | `________________` |
| 10-16 | Escenario 1 | `________________` | `PASS/FAIL/BLOCKED` |
| 16-22 | Escenario 2 | `________________` | `PASS/FAIL/BLOCKED` |
| 22-28 | Escenario 3 | `________________` | `PASS/FAIL/BLOCKED` |
| 28-35 | UX/mensajes | `________________` | `________________` |
| 35-41 | Hallazgos | `________________` | `________________` |
| 41-45 | GO/NO-GO | `________________` | `GO/NO-GO` |

## Registro de hallazgos rápidos
| ID | Escenario | Hallazgo | Severidad | Responsable | ETA |
|---|---|---|---|---|---|
| `UAT-01` | `1/2/3` | `________________` | `P0/P1/P2/P3` | `________________` | `________________` |
| `UAT-02` | `1/2/3` | `________________` | `P0/P1/P2/P3` | `________________` | `________________` |

## Criterio de decisión final
- **GO:** sin hallazgos `P1/P0`, evidencia completa y firmas confirmadas.
- **NO-GO:** existe al menos un `P1/P0` sin mitigación aceptada.

## Acciones post-sesión
- Actualizar `docs/planning/acta_aceptacion_frontend_sprints_1_4_2026-03-04.md`.
- Registrar resultados en `docs/planning/uat_guiado_frontend_sprints_1_4_2026-03-04.md`.
- Si aplica salida: ejecutar `checklist_go_nogo_sprint4_2026-03-04.md`.
