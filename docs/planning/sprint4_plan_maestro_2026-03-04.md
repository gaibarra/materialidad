# Sprint 4 — Plan Maestro de Ejecución (P0-Sprint-4)

**Fecha base:** `2026-03-04`  
**Proyecto:** `materialidad`  
**Rama activa recomendada:** `feat/materialidad-validacion-expediente` (o rama hija por historia)

## Objetivo de Sprint 4
Consolidar la **estabilidad operativa post-release** de Sprint 3 mediante hardening técnico, observabilidad y automatización de validaciones para reducir riesgo en producción.

## Resultado esperado al cierre
1. Advertencias de validación numérica eliminadas o controladas (`DecimalField`).
2. Smoke tests automatizados para endpoints críticos de materialidad.
3. Monitoreo operativo con métricas base y alertas para errores/latencia.
4. Exportables (PDF/ZIP) con mejoras de desempeño y trazabilidad.
5. Runbook de operación/incidentes y cierre QA Sprint 4.

---

## Historias Sprint 4 (orden recomendado)

### 1) `E4-H1-R1` — Hardening de validadores numéricos
- **Tipo:** Backend hardening
- **Prioridad:** Alta
- **Dependencia:** `E3-QA-R1`
- **Salida:** eliminación de warnings recurrentes en validadores (`DecimalField`).

### 2) `E4-H2-R1` — Smoke tests automáticos post-deploy
- **Tipo:** QA/Automatización
- **Prioridad:** Alta
- **Dependencia:** `E4-H1-R1`
- **Salida:** suite corta reproducible para salud funcional de endpoints críticos.

### 3) `E4-H3-R1` — Observabilidad y alertas operativas
- **Tipo:** Operación/Backend
- **Prioridad:** Alta
- **Dependencia:** `E4-H2-R1`
- **Salida:** tablero mínimo de salud (`4xx/5xx`, latencia p95, fallos exportables).

### 4) `E4-H4-R1` — Optimización de exportables PDF/ZIP
- **Tipo:** Backend performance
- **Prioridad:** Media/Alta
- **Dependencia:** `E4-H3-R1`
- **Salida:** tiempos de respuesta estabilizados y manejo robusto de carga documental.

### 5) `E4-H5-R1` — Runbook de operación y contingencia
- **Tipo:** Documentación/Operación
- **Prioridad:** Media
- **Dependencia:** `E4-H3-R1`
- **Salida:** guía de incidentes, rollback, verificación post-deploy y escalamiento.

### 6) `E4-QA-R1` — QA Sprint 4 de estabilidad
- **Tipo:** QA
- **Prioridad:** Alta (cierre)
- **Dependencia:** `E4-H4-R1`
- **Salida:** evidencia de estabilidad en suite técnica y casos UAT operativos.

---

## Plan de ejecución (2 semanas)

## Semana 1
- **Día 1-2:** `E4-H1-R1` (hardening validadores + pruebas unitarias)
- **Día 3:** `E4-H2-R1` (smoke tests automáticos + script de ejecución)
- **Día 4-5:** `E4-H3-R1` (instrumentación básica + alertas operativas)

## Semana 2
- **Día 1-2:** `E4-H4-R1` (optimización PDF/ZIP + benchmarks básicos)
- **Día 3:** `E4-H5-R1` (runbook operativo + procedimiento rollback)
- **Día 4-5:** `E4-QA-R1` (suite consolidada + evidencia + aprobación de salida)

---

## Riesgos y mitigaciones
- **Riesgo:** regresión funcional al corregir validadores.
  - **Mitigación:** ejecutar suite consolidada Sprint 3 + pruebas focalizadas de validación.
- **Riesgo:** métricas insuficientes para detectar incidentes tempranos.
  - **Mitigación:** definir set mínimo obligatorio (`4xx`, `5xx`, `p95`, error_rate`).
- **Riesgo:** optimización de exportables afecta consistencia de evidencia.
  - **Mitigación:** validaciones de integridad (`SHA-256`) y comparación de salida previa/post.
- **Riesgo:** despliegue sin respuesta coordinada ante incidentes.
  - **Mitigación:** runbook con roles, SLAs de respuesta y checklist de contingencia.

---

## Definición de Terminado (DoD)
- [ ] Historias `E4-H1-R1` a `E4-H5-R1` implementadas y documentadas.
- [ ] `E4-QA-R1` con suite de estabilidad en verde y evidencia versionada.
- [ ] Checklist operativo post-deploy actualizado y ejecutable.
- [ ] Sin warnings críticos en rutas de validación materialidad.
- [ ] Commits atómicos por historia y push a remoto.

---

## Artefactos creados
- Backlog importable Jira: `docs/planning/jira_sprint4_backlog.csv`
- Plan operativo Sprint 4: `docs/planning/sprint4_plan_maestro_2026-03-04.md`
