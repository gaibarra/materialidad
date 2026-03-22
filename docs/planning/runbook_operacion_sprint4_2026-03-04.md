# Runbook Operación Sprint 4 — Materialidad

**Fecha:** `2026-03-04`  
**Objetivo:** operación estable post-release para endpoints críticos de materialidad con respuesta rápida ante incidentes.

## 1) Salud operativa mínima
- Métricas obligatorias:
  - `4xx_rate` por endpoint crítico
  - `5xx_rate` por endpoint crítico
  - `latency_p95_ms`
  - `error_rate`
- Endpoints críticos:
  - `GET /api/materialidad/operaciones/{id}/exportar-pdf-defensa/`
  - `GET /api/materialidad/operaciones/{id}/exportar-dossier/`
  - `GET /api/materialidad/operaciones/matriz-materialidad/`
  - `GET /api/materialidad/dashboard/metricas/cobertura-p0/`
  - `POST /api/materialidad/operaciones/{id}/cambiar-estatus/`
  - `GET /api/materialidad/operaciones/bandeja-revision/`

## 2) Niveles de severidad
- `P0`: caída general o corrupción de evidencia fiscal.
- `P1`: falla funcional crítica en flujo de validación/exportación.
- `P2`: degradación relevante de rendimiento o errores intermitentes.
- `P3`: issue menor sin impacto inmediato de operación.

## 3) Tiempos objetivo
- `P0`: contención inicial <= 15 min
- `P1`: contención inicial <= 30 min
- `P2`: análisis <= 4 h
- `P3`: resolución programada en siguiente ventana

## 4) Procedimiento de respuesta
1. Identificar endpoint/flujo afectado y severidad.
2. Revisar logs `materialidad.observability`.
3. Ejecutar smoke:

```bash
cd /home/gaibarra/materialidad
bash scripts/smoke_materialidad_postdeploy_sprint4.sh
```

4. Si smoke falla en `P0/P1`, activar rollback.
5. Registrar incidente y comunicar estatus cada 30 min.

## 5) Criterios de rollback
- `5xx` sostenido > 5% por 10 min en endpoints críticos.
- Fallo en exportables PDF/ZIP que impida evidencia fiscal.
- Regresión de bloqueo documental en `cambiar-estatus`.

## 6) Verificación post-deploy (24h)
- Ejecutar smoke 3 veces (inicio, +8h, +24h).
- Verificar latencia p95 de exportables.
- Confirmar ausencia de incidentes `P0/P1`.
- Consolidar reporte final de estabilidad.

## 7) Referencias
- `docs/planning/qa_sprint3_suite_2026-03-04.md`
- `docs/planning/pendientes_release_sprint3_2026-03-04.md`
- `docs/planning/acta_aprobacion_salida_sprint3_2026-03-04.md`
