# Checklist Comité GO/NO-GO — Sprint 4

**Fecha:** `2026-03-04`  
**Proyecto:** `materialidad`  
**Sprint:** `Sprint 4`  
**Rama candidata:** `feat/materialidad-validacion-expediente`

## 1) Evidencia obligatoria
- [ ] `docs/planning/qa_sprint4_suite_2026-03-04.md`
- [ ] `docs/planning/runbook_operacion_sprint4_2026-03-04.md`
- [ ] `scripts/smoke_materialidad_postdeploy_sprint4.sh`
- [ ] `docs/planning/pr_sprint4_final_2026-03-04.md`

## 2) Criterios técnicos (GO)
- [ ] Smoke Sprint 4: `6 tests OK`.
- [ ] Regresión consolidada: `36 tests OK`.
- [ ] Sin warning crítico de `DecimalField` en ejecución objetivo.
- [ ] Observabilidad activa en `/api/materialidad/*`.

## 3) Criterios funcionales (GO)
- [ ] `exportar-pdf-defensa` descarga PDF válido.
- [ ] `exportar-dossier` genera ZIP con `manifiesto_integridad.json`.
- [ ] `matriz-materialidad` responde con filtros y orden correctos.
- [ ] `dashboard/metricas/cobertura-p0` responde contrato esperado.
- [ ] Flujos `cambiar-estatus` y `bandeja-revision` sin regresión.

## 4) Criterios operativos (GO)
- [ ] Variable `MATERIALIDAD_OBSERVABILITY_SLOW_MS` configurada por ambiente.
- [ ] Plan de rollback validado por equipo técnico.
- [ ] Monitoreo 24h asignado con responsables.
- [ ] Canal de incidentes y escalamiento definido.

## 5) Semáforo de salida
- **Técnico:** `🟢 / 🟡 / 🔴`
- **Funcional:** `🟢 / 🟡 / 🔴`
- **Operativo:** `🟢 / 🟡 / 🔴`
- **Decisión final:** `GO / NO-GO`

## 6) Acuerdos del comité
- Acuerdo 1: `__________________________________________`
- Acuerdo 2: `__________________________________________`
- Acuerdo 3: `__________________________________________`

## 7) Firmas
- Líder técnico: `________________`  
- QA/Funcional: `________________`  
- Operación/DevOps: `________________`  
- Compliance: `________________`  
- Fecha/hora: `________________`
