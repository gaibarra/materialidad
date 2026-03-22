# Checklist de cierre FDI en staging

## Objetivo

Validar los pendientes operativos del plan FDI antes de retirar el camino legacy.

## 1. Scheduler y jobs

- Confirmar que `materialidad-fdi-snapshots.timer` esta activo.
- Confirmar que `materialidad-fdi-snapshots.service` no acumula fallas en `journalctl`.
- Ejecutar manualmente `python manage.py report_fdi_readiness --tenant <slug>` y guardar el resultado.
- Verificar que el ultimo `FDIJobRun` del tenant tenga `status=success` y `duration_ms` dentro del SLA.

## 2. Gates de apagado legacy

- Coverage gate: `amount_coverage_pct >= 95` y `count_coverage_pct >= 90`.
- Snapshot freshness gate: `fresh_empresas_pct >= 95`.
- Divergence gate: `abs(score_delta) <= 5`.
- Reliability gate: `recent_failures = 0` en 24h.
- Explainability gate: snapshot reciente con `formula_version`, `pipeline_version`, `correlation_id` y confidence persistidos.

## 3. Frontend administrativo

- Entrar como usuario staff a `/dashboard/administracion/fdi-runs`.
- Validar filtros por empresa, comando y estado.
- Validar que `Cargar mas` siga el cursor sin repetir runs.
- Confirmar que una falla reciente aparezca con su `error_message`.

## 4. Backfill versionado

- Ejecutar `python manage.py backfill_fdi_formula_version --tenant <slug> --skip-existing --include-tenant-snapshot`.
- Confirmar que el `FDIJobRun` asociado registre `command=backfill_fdi_formula_version`.
- Confirmar que los snapshots nuevos persisten `formula_version` y `pipeline_version` esperados.

## 5. Criterio de cierre

- No retirar el camino legacy si algun gate esta en FAIL.
- Si todos los gates estan en PASS durante la ventana de validacion acordada, cambiar `FDI_ALLOW_LEGACY_FALLBACK=False` y monitorear jobs y dashboard tecnico.