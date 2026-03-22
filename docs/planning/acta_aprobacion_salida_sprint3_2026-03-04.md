# Acta de Aprobación de Salida — Sprint 3

**Proyecto:** `materialidad`  
**Sprint:** `Sprint 3`  
**Fecha de emisión:** `2026-03-04`  
**Rama candidata:** `feat/materialidad-validacion-expediente`  
**Ambiente objetivo de salida:** `staging -> producción`

## 1) Objetivo del acta
Formalizar la aprobación de salida a producción de los entregables de Sprint 3, dejando constancia de cumplimiento técnico, funcional y de cumplimiento/compliance.

## 2) Alcance aprobado de Sprint 3
- `E3-H1-R1`: Exporte PDF de defensa fiscal.
- `E3-H2-R1`: ZIP probatorio v2 con `manifiesto_integridad.json` y huellas `SHA-256`.
- `E3-H3-R1`: Matriz documental CFDI-Contrato-Pago-Evidencia.
- `E3-H4-R1`: Dashboard de cobertura P0 (backend + integración frontend).
- `E3-H5-R1`: Cierre documental de contrato API y guía operativa.

## 3) Evidencia técnica y documental
- QA Sprint 3: `docs/planning/qa_sprint3_suite_2026-03-04.md`
- PR final Sprint 3: `docs/planning/pr_sprint3_final_2026-03-04.md`
- Relación de pendientes operativos: `docs/planning/pendientes_release_sprint3_2026-03-04.md`
- Contrato API actualizado: `docs/api.md`
- Guía operativa Sprint 3: `docs/planning/guia_operativa_sprint3_defensa_fiscal_2026-03-04.md`

## 4) Resultado QA consolidado
- Suite ejecutada: `36 tests`
- Resultado: `OK`
- Tiempo total: `13.714s`
- Cobertura validada: exportables, matriz, cobertura P0 y regresión de flujos críticos.

## 5) Criterios de salida (Go/No-Go)

### 5.1 Técnico
- [ ] Migraciones aplicadas sin error en staging.
- [ ] Endpoints Sprint 3 responden conforme a contrato.
- [ ] Smoke test de exportables (PDF/ZIP) exitoso.
- [ ] Monitoreo base de errores/latencia habilitado.

### 5.2 Funcional
- [ ] UAT mínimo (5 casos) ejecutado y documentado.
- [ ] Resultado UAT sin bloqueantes P1/P0.
- [ ] Validación de cobertura P0 consistente por empresa.

### 5.3 Compliance / Control
- [ ] Evidencia documental de defensa disponible y trazable.
- [ ] Integridad del dossier confirmada (manifiesto SHA-256).
- [ ] Observaciones legales/compliance registradas y cerradas.

## 6) Riesgos y mitigaciones al corte
- **Riesgo:** advertencias no bloqueantes de validadores (`DecimalField`).  
  **Mitigación:** hardening técnico programado en siguiente ventana de mejora.
- **Riesgo:** desviación de datos reales vs. muestra de UAT.  
  **Mitigación:** verificación post-deploy de cobertura P0 por muestra controlada.

## 7) Plan de despliegue y contingencia
- Ventana propuesta: `________________`.
- Responsable de despliegue: `________________`.
- Procedimiento de rollback documentado: `Sí / No`.
- Criterio de rollback: incremento de errores P1/P0 o fallo funcional crítico.

## 8) Aprobaciones formales

### 8.1 Aprobación técnica
- Nombre: `________________`
- Rol: `Líder Técnico / Backend`
- Decisión: `GO / NO-GO`
- Firma / VoBo: `________________`
- Fecha y hora: `________________`

### 8.2 Aprobación funcional
- Nombre: `________________`
- Rol: `Producto / QA Funcional`
- Decisión: `GO / NO-GO`
- Firma / VoBo: `________________`
- Fecha y hora: `________________`

### 8.3 Aprobación compliance
- Nombre: `________________`
- Rol: `Cumplimiento / Fiscal`
- Decisión: `GO / NO-GO`
- Firma / VoBo: `________________`
- Fecha y hora: `________________`

## 9) Decisión final de salida
- Resultado de comité: `GO / NO-GO`
- Condiciones de salida (si aplica):
  - `__________________________________________________`
  - `__________________________________________________`
- Responsable de seguimiento post-deploy 24h: `________________`

---

## Anexo A — Minuta rápida de aprobación
- Fecha de sesión: `________________`
- Participantes:
  - `________________`
  - `________________`
  - `________________`
- Acuerdos:
  - `__________________________________________________`
  - `__________________________________________________`
- Pendientes residuales aceptados (si aplica):
  - `__________________________________________________`
