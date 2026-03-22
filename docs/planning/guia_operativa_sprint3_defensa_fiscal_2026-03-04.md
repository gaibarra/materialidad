# Guía Operativa Sprint 3 — Defensa Fiscal

**Fecha:** `2026-03-04`  
**Alcance:** `E3-H1-R1` + `E3-H2-R1` + `E3-H3-R1` + `E3-H4-R1` + `E3-H5-R1`

## 1) Objetivo operativo
Estandarizar el uso diario de los módulos de materialidad para construir y defender expedientes ante revisiones fiscales, con trazabilidad de riesgo, alertas y exportables de soporte.

## 2) Roles y responsabilidades
- **Analista fiscal**
  - Revisa bandeja y matriz documental.
  - Gestiona faltantes y comentarios de estatus.
- **Compliance / Legal**
  - Valida evidencia sensible y control de alertas activas.
  - Revisa riesgos altos y define escalamiento.
- **Coordinación contable**
  - Da seguimiento a operaciones pendientes y cierre de ciclo.
  - Solicita exportables (PDF/ZIP) para auditoría o expediente externo.

## 3) Flujo operativo recomendado (diario)

### Paso A — Priorización inicial
1. Consultar `GET /api/materialidad/dashboard/metricas/cobertura-p0/`.
2. Revisar:
   - `coverage.cobertura_documental_pct`
   - `riesgo_distribution.ALTO.count`
   - `alertas.activas_total`
3. Definir foco del día por empresa/proveedor con mayor exposición.

### Paso B — Revisión por cola
1. Consultar `GET /api/materialidad/operaciones/bandeja-revision/?rol=...&orden=riesgo`.
2. Atender primero operaciones con:
   - `riesgo_nivel=ALTO`
   - `faltantes` críticos
   - `alertas_activas` presentes

### Paso C — Diagnóstico de cadena documental
1. Consultar `GET /api/materialidad/operaciones/matriz-materialidad/?empresa={id}&orden=riesgo`.
2. Revisar por operación:
   - `cadena_documental.cfdi.presente`
   - `cadena_documental.contrato.presente`
   - `cadena_documental.pago.presente`
   - `cadena_documental.evidencia.total`
3. Resolver `faltantes` y transitar estatus según avance.

### Paso D — Gestión de estatus
1. Usar `POST /api/materialidad/operaciones/{id}/cambiar-estatus/`.
2. Si responde `400` por expediente incompleto:
   - Registrar tarea de corrección.
   - Dar seguimiento por `alerta_operacion_id`.
3. Si responde `200`:
   - Confirmar actualización de riesgo y auditoría.

### Paso E — Cierre probatorio
1. Generar PDF ejecutivo por operación:
   - `GET /api/materialidad/operaciones/{id}/exportar-pdf-defensa/`
2. Generar ZIP probatorio verificable:
   - `GET /api/materialidad/operaciones/{id}/exportar-dossier/`
3. Validar `manifiesto_integridad.json` para integridad de archivos.

## 4) Checklist por operación (antes de VALIDADO)
- [ ] CFDI presente y estatus coherente.
- [ ] Contrato asociado correcto.
- [ ] Soporte de pago documentado (SPEI o metadata).
- [ ] Evidencias mínimas por perfil (`SERVICIOS`, `COMPRAS`, `PARTES_RELACIONADAS`).
- [ ] Sin alertas activas críticas sin plan de acción.
- [ ] Riesgo documentado y aceptado por responsable.

## 5) Protocolo de atención en caso de auditoría
1. Identificar operaciones requeridas por autoridad.
2. Exportar por cada operación:
   - PDF (`exportar-pdf-defensa`)
   - ZIP (`exportar-dossier`)
3. Anexar:
   - `indice.json`
   - `README.txt`
   - `manifiesto_integridad.json`
4. Verificar hash SHA-256 de archivos críticos antes de entrega.
5. Registrar bitácora de entrega (fecha, folio, responsable).

## 6) SLA interno sugerido
- **Riesgo ALTO**: atención en < 24h.
- **Riesgo MEDIO**: atención en < 72h.
- **Riesgo BAJO**: atención semanal en bloque.
- **Alertas activas por faltantes críticos**: primera acción correctiva en el mismo día hábil.

## 7) Indicadores de control operativo
- Cobertura documental (% completo).
- Operaciones en riesgo alto (# y monto).
- Alertas activas por tipo.
- Tiempo promedio de resolución por alerta.
- Tasa de operaciones bloqueadas al intentar `VALIDADO`.

## 8) Criterio de salida Sprint 3 (operación)
- [ ] Equipos fiscal/compliance usan el flujo completo con datos reales.
- [ ] Exportables PDF y ZIP se generan sin errores en casos representativos.
- [ ] Matriz y dashboard reflejan consistentemente la exposición actual.
- [ ] Evidencia de ejecución documentada en QA/UAT.
