# Sprint 3 — Plan Maestro de Ejecución (P0-Sprint-3)

**Fecha base:** `2026-03-04`  
**Proyecto:** `materialidad`  
**Rama activa recomendada:** `feat/materialidad-validacion-expediente` (o rama hija por historia)

## Objetivo de Sprint 3
Entregar un **paquete de defensa fiscal operativo** por operación, con salidas exportables robustas y trazabilidad documental consolidada para atención de facultades de comprobación.

## Resultado esperado al cierre
1. PDF de defensa fiscal por operación (formal, exportable).
2. ZIP probatorio v2 con manifiesto de integridad por hash.
3. Matriz documental CFDI-Contrato-Pago-Evidencia expuesta por API.
4. Dashboard de cobertura P0 con widgets de riesgo y alertas.
5. QA consolidado de Sprint 3 y documentación operativa.

---

## Historias Sprint 3 (orden recomendado)

### 1) `E3-H1-R1` — Reporte PDF de defensa fiscal (v1)
- **Tipo:** Backend export
- **Prioridad:** Alta
- **Dependencia:** `E2-H5-R1`
- **Salida:** endpoint descargable con PDF por operación.

### 2) `E3-H2-R1` — Paquete ZIP probatorio v2
- **Tipo:** Backend export
- **Prioridad:** Alta
- **Dependencia:** `E3-H1-R1`
- **Nota:** Existe `exportar-dossier` base; esta historia lo **evoluciona** con manifiesto hash y estandarización de trazabilidad.

### 3) `E3-H3-R1` — Matriz materialidad CFDI-Contrato-Pago-Evidencia
- **Tipo:** Backend API
- **Prioridad:** Alta
- **Dependencia:** `E2-H4-R1`
- **Salida:** endpoint paginado de consolidación documental y brechas.

### 4) `E3-H4-R1` — Dashboard cobertura P0
- **Tipo:** Backend + Frontend
- **Prioridad:** Media/Alta
- **Dependencia:** `E3-H3-R1`
- **Salida:** widgets de cobertura, riesgo y alertas con filtros.

### 5) `E3-H5-R1` — Contrato API y guía operativa
- **Tipo:** Documentación
- **Prioridad:** Media
- **Dependencia:** `E3-H2-R1`
- **Salida:** `docs/api.md` y guía operativa de uso fiscal/compliance.

### 6) `E3-QA-R1` — QA Sprint 3
- **Tipo:** QA
- **Prioridad:** Alta (cierre)
- **Dependencia:** `E3-H4-R1`
- **Salida:** suite focalizada en verde + evidencia documentada.

---

## Plan de ejecución (2 semanas)

## Semana 1
- **Día 1-2:** `E3-H1-R1` (PDF v1 + pruebas backend)
- **Día 3-4:** `E3-H2-R1` (ZIP v2 + manifiesto hash + pruebas)
- **Día 5:** hardening de exportables y revisión técnica cruzada

## Semana 2
- **Día 1-2:** `E3-H3-R1` (matriz API + filtros/paginación + pruebas)
- **Día 3-4:** `E3-H4-R1` (dashboard contract + wiring frontend)
- **Día 5:** `E3-H5-R1` + `E3-QA-R1` + paquete de cierre de sprint

---

## Riesgos y mitigaciones
- **Riesgo:** alto acoplamiento entre datos documentales y exportables.
  - **Mitigación:** usar servicios reutilizables para consolidación documental antes de render/export.
- **Riesgo:** inconsistencias de archivos faltantes en ZIP.
  - **Mitigación:** política explícita de `missing_file` en manifiesto + pruebas de regresión.
- **Riesgo:** latencia en endpoints de export.
  - **Mitigación:** optimizar consultas con `select_related/prefetch_related` y limitar payload.
- **Riesgo:** desalineación frontend/backend en dashboard.
  - **Mitigación:** congelar contrato API en `docs/api.md` antes del wiring UI final.

---

## Definición de Terminado (DoD)
- [ ] Historias `E3-H1-R1` a `E3-H5-R1` implementadas según criterios de aceptación.
- [ ] `E3-QA-R1` con suite focalizada en verde y documento de evidencia.
- [ ] Endpoints documentados en `docs/api.md` con ejemplos.
- [ ] Sin errores de lint/sintaxis en archivos modificados.
- [ ] Commits atómicos por historia y push a remoto.

---

## Artefactos creados
- Backlog importable Jira: `docs/planning/jira_sprint3_backlog.csv`
- Plan operativo Sprint 3: `docs/planning/sprint3_plan_maestro_2026-03-04.md`
