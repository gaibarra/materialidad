# Plantilla de Evidencia UAT — Sprint 3

**Proyecto:** `materialidad`  
**Sprint:** `Sprint 3`  
**Fecha de ejecución UAT:** `________________`  
**Ambiente:** `staging / producción`  
**Responsable UAT:** `________________`

## Objetivo
Registrar de forma trazable la ejecución UAT de Sprint 3 para soporte de decisión `GO/NO-GO`.

## Instrucciones de llenado
- Marcar resultado por caso: `PASS / FAIL / BLOCKED`.
- Adjuntar evidencia (URL, captura, folio o ruta de archivo).
- En caso `FAIL/BLOCKED`, registrar incidencia con severidad (`P0/P1/P2/P3`) y responsable.

## Resumen ejecutivo UAT
- Casos ejecutados: `__/5`
- Casos `PASS`: `__`
- Casos `FAIL`: `__`
- Casos `BLOCKED`: `__`
- Incidencias críticas (`P0/P1`): `__`
- Recomendación final: `GO / NO-GO`

## Matriz de evidencia por caso

| Caso | Descripción | Precondición | Pasos ejecutados | Resultado (PASS/FAIL/BLOCKED) | Evidencia (URL/ruta/folio) | Incidencia (ID + severidad) | Responsable | Fecha/Hora |
|---|---|---|---|---|---|---|---|---|
| UAT-01 | Operación completa permite `VALIDADO` | Operación con expediente completo | 1) Abrir operación 2) Cambiar a `VALIDADO` 3) Verificar auditoría | `____` | `____` | `____` | `____` | `____` |
| UAT-02 | Bloqueo por faltantes críticos + alerta | Operación con faltantes críticos | 1) Intentar `VALIDADO` 2) Verificar `400` 3) Confirmar alerta activa | `____` | `____` | `____` | `____` | `____` |
| UAT-03 | Exporte PDF de defensa fiscal | Operación con evidencia base | 1) Solicitar exporte 2) Descargar PDF 3) Validar secciones mínimas | `____` | `____` | `____` | `____` | `____` |
| UAT-04 | Dossier ZIP v2 con manifiesto SHA-256 | Operación con documentos del expediente | 1) Exportar ZIP 2) Verificar `manifiesto_integridad.json` | `____` | `____` | `____` | `____` | `____` |
| UAT-05 | Matriz documental + cobertura P0 | Datos de operaciones en empresa de prueba | 1) Consultar matriz 2) Aplicar filtros/orden 3) Verificar dashboard P0 | `____` | `____` | `____` | `____` | `____` |

## Detalle de incidencias (si aplica)

| ID Incidencia | Caso UAT | Descripción | Severidad | Estado | Responsable | ETA resolución |
|---|---|---|---|---|---|---|
| `INC-____` | `UAT-__` | `________________` | `P0/P1/P2/P3` | `Abierta/En curso/Cerrada` | `________________` | `________________` |

## Evidencia técnica de soporte (referencias)
- QA técnico consolidado: `docs/planning/qa_sprint3_suite_2026-03-04.md`
- PR final Sprint 3: `docs/planning/pr_sprint3_final_2026-03-04.md`
- Acta de aprobación de salida: `docs/planning/acta_aprobacion_salida_sprint3_2026-03-04.md`
- Pendientes operativos release: `docs/planning/pendientes_release_sprint3_2026-03-04.md`

## Firma de conformidad UAT
- Responsable funcional: `________________`  
- Responsable QA: `________________`  
- Fecha/hora de cierre UAT: `________________`  
- Dictamen final: `GO / NO-GO`
