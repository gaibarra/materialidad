# PR Final — Sprint 3 Materialidad (Backend + Frontend + Docs)

> Documento listo para copiar/pegar en GitHub PR y usar en handoff de release.

## Título sugerido de PR
`feat(materialidad): completar Sprint 3 (pdf defensa + dossier v2 + matriz + dashboard + cierre QA)`

## Branches
- **Base:** `main`
- **Compare:** `feat/materialidad-validacion-expediente`

## Descripción sugerida (copiar en PR)

### Resumen ejecutivo
Este PR completa el alcance de **Sprint 3** del módulo de materialidad fiscal, consolidando entregables de defensa documental, trazabilidad de evidencia y visibilidad ejecutiva:

- Exporte de PDF de defensa fiscal por operación.
- ZIP probatorio v2 con manifiesto de integridad `SHA-256`.
- Matriz CFDI-Contrato-Pago-Evidencia con estatus de completitud.
- Métrica de cobertura P0 para dashboard ejecutivo.
- Cierre documental (contrato API + guía operativa) y QA Sprint 3 en verde.

---

### Alcance funcional por historia

#### `E3-H1-R1` — Exporte PDF de defensa fiscal
- Nuevo endpoint de exportación PDF por operación.
- El PDF integra secciones mínimas de defensa y evidencia base de soporte.
- Validado con pruebas de descarga y contenido mínimo esperado.

#### `E3-H2-R1` — ZIP probatorio v2 con manifiesto
- Evolución del dossier ZIP para incluir `manifiesto_integridad.json`.
- Generación de hashes `SHA-256` por archivo incluido en el paquete.
- Pruebas verifican consistencia entre manifiesto y contenido real del ZIP.

#### `E3-H3-R1` — Matriz CFDI-Contrato-Pago-Evidencia
- Nuevo endpoint de matriz documental para revisión de cadena probatoria.
- Expone completitud por operación y estado por eslabón documental.
- Incluye filtros por `riesgo`, `estatus`, `rfc` y orden por antigüedad.

#### `E3-H4-R1` — Dashboard cobertura P0
- Nuevo endpoint de métricas: cobertura documental de operaciones P0.
- Contrato backend estable para consumo frontend.
- Integración en componente ejecutivo de dashboard.

#### `E3-H5-R1` — Cierre documental
- Contrato API consolidado en `docs/api.md`.
- Guía operativa Sprint 3 para uso funcional/técnico.

---

### Cambios técnicos relevantes

#### Backend
- `backend/materialidad/views.py`
  - `exportar_pdf_defensa`
  - `matriz_materialidad`
  - `DashboardCoberturaP0View`
  - Endurecimientos e integración con flujo existente.
- `backend/materialidad/exporters.py`
  - `build_operacion_defensa_pdf`
  - `build_operacion_dossier_zip` v2 con manifiesto `SHA-256`.
- `backend/materialidad/services.py`
  - `get_dashboard_cobertura_p0`
  - Reutilización de reglas de materialidad/riesgo/faltantes.
- `backend/materialidad/serializers.py`
  - `MatrizMaterialidadItemSerializer` y ajustes para contratos nuevos.
- `backend/materialidad/urls.py`
  - Registro de endpoint `dashboard/metricas/cobertura-p0/`.

#### Frontend
- `frontend/src/app/dashboard/(components)/ExecutiveOverview.tsx`
  - Consumo de `dashboard/metricas/cobertura-p0` y rendering de cobertura P0.

#### Pruebas
- `backend/materialidad/tests/test_operacion_export_pdf.py`
- `backend/materialidad/tests/test_operacion_export_dossier.py`
- `backend/materialidad/tests/test_operacion_matriz_materialidad.py`
- `backend/materialidad/tests/test_dashboard_cobertura_p0.py`
- Regresión crítica incluida:
  - `backend/materialidad/tests/test_operacion_cambiar_estatus.py`
  - `backend/materialidad/tests/test_operacion_bandeja_revision.py`

#### Documentación
- `docs/api.md` (contrato actualizado Sprint 3)
- `docs/planning/guia_operativa_sprint3_defensa_fiscal_2026-03-04.md`
- `docs/planning/qa_sprint3_suite_2026-03-04.md`

---

### Validación ejecutada

Suite consolidada ejecutada localmente:

```bash
cd /home/gaibarra/materialidad/backend
/home/gaibarra/materialidad/.venv/bin/python manage.py test \
  materialidad.tests.test_operacion_export_pdf \
  materialidad.tests.test_operacion_export_dossier \
  materialidad.tests.test_operacion_matriz_materialidad \
  materialidad.tests.test_dashboard_cobertura_p0 \
  materialidad.tests.test_operacion_cambiar_estatus \
  materialidad.tests.test_operacion_bandeja_revision \
  -v 2
```

Resultado: **`36 tests OK`** en **`13.714s`**.

---

### Riesgos / notas operativas
- Se mantienen advertencias no bloqueantes de validadores (`min_value in DecimalField should be Decimal type`) fuera del alcance funcional de este PR.
- Pruebas negativas con respuestas `400` son esperadas por reglas de negocio.
- Recomendado smoke test de exportables en staging con datos representativos de operación real.

---

### Checklist de merge
- [ ] Verificar endpoints nuevos en staging (`export_pdf_defensa`, `matriz_materialidad`, `cobertura-p0`).
- [ ] Confirmar integración frontend de cobertura P0 con usuarios de dashboard.
- [ ] Ejecutar smoke test de descarga de PDF y ZIP v2.
- [ ] Revisar permisos de acceso por rol para nuevos endpoints.
- [ ] Aprobar evidencia `docs/planning/qa_sprint3_suite_2026-03-04.md`.

---

## Checklist de Release / UAT (operativo)

### Pre-deploy
- [ ] Backup de base de datos en staging.
- [ ] Migraciones aplicadas y validadas.
- [ ] Configuración de entorno/tenant confirmada.
- [ ] Rama/tag de despliegue congelada.

### UAT funcional mínimo
- [ ] Descargar PDF de defensa y validar contenido mínimo.
- [ ] Descargar ZIP v2 y validar manifiesto de integridad.
- [ ] Consultar matriz documental y validar filtros/orden.
- [ ] Verificar cobertura P0 en dashboard para empresa seleccionada.
- [ ] Confirmar que flujo `cambiar-estatus` y `bandeja-revision` no regresa.

### Post-deploy (24h)
- [ ] Monitorear `4xx/5xx` de endpoints nuevos de materialidad.
- [ ] Validar tiempos de respuesta de exportables.
- [ ] Revisar consistencia de datos de cobertura P0.
- [ ] Confirmar ausencia de incidencias P1/P0 en operación.

### Criterio de salida
- [ ] QA técnico aprobado (suite consolidada en verde).
- [ ] UAT funcional sin bloqueantes P1/P0.
- [ ] Aprobación de release por responsables técnico/funcional/compliance.
