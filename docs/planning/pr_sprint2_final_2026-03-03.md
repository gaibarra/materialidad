# PR Final — Sprint 2 Materialidad (Backend)

> Documento listo para copiar/pegar en GitHub PR y usar en handoff de release.

## Título sugerido de PR
`feat(materialidad): completar Sprint 2 (workflow + riesgo + alertas + bandeja + QA)`

## Branches
- **Base:** `main`
- **Compare:** `feat/materialidad-validacion-expediente`

## Descripción sugerida (copiar en PR)

### Resumen ejecutivo
Este PR completa el alcance de **Sprint 2** para el módulo de materialidad fiscal, fortaleciendo el flujo de validación de operaciones y agregando componentes de control operativo para revisión y seguimiento:

- Workflow de estatus endurecido con matriz de transiciones válidas.
- Validación bloqueante reusable por perfil documental.
- Semáforo de riesgo base por operación (`BAJO/MEDIO/ALTO`).
- Alertas deduplicadas por faltantes críticos de expediente.
- Bandeja de revisión por rol con filtros, orden y paginación.
- Suite QA consolidada de Sprint 2 en verde.

---

### Alcance funcional por historia

#### `E2-H1-R1` — Workflow de transiciones
- Se formaliza matriz de transiciones permitidas para `estatus_validacion` en `cambiar-estatus`.
- Transiciones inválidas responden `400` con detalle estándar (`estatus_actual`, `estatus_solicitado`, `transiciones_permitidas`).
- Transiciones válidas persisten cambio y generan auditoría.

#### `E2-H2-R1` — Validación reusable por perfil
- Se centraliza en servicios:
  - `get_operacion_perfil_validacion`
  - `get_operacion_faltantes_materialidad`
- El bloqueo de `VALIDADO` por expediente incompleto se mantiene, ahora desacoplado de la vista para reuso.

#### `E2-H4-R1` — Semáforo de riesgo base
- Se implementa scoring determinístico en `get_operacion_riesgo_materialidad`.
- Factores base: faltantes (con ponderación crítica), riesgo fiscal proveedor, estatus 69-B.
- Se persiste en `operacion.metadata.riesgo_materialidad`.
- Se expone en API de operación: `riesgo_nivel`, `riesgo_score`, `riesgo_motivos`.

#### `E2-H5-R1` — Alertas deduplicadas
- Nuevo modelo `AlertaOperacion` con deduplicación activa por `clave_dedupe`.
- Al bloquear intento de `VALIDADO` por faltantes críticos, se crea o recupera alerta activa (sin duplicar).
- Endpoint para consulta/gestión:
  - `GET /api/materialidad/alertas-operacion/` (+ filtros por empresa/proveedor/estatus/tipo)

#### `E2-H3-R1` — Bandeja por rol (API contract)
- Nuevo endpoint:
  - `GET /api/materialidad/operaciones/bandeja-revision/`
- Devuelve por item: operación + riesgo + faltantes + alertas activas.
- Filtros soportados: `rol`, `estatus`, `riesgo`, `rfc`.
- Orden soportado: `riesgo` (default) y `antiguedad`.
- Paginación estándar DRF.
- Contrato documentado en `docs/api.md`.

---

### Cambios técnicos relevantes

#### Backend
- `backend/materialidad/views.py`
  - Endurecimiento de workflow en `cambiar-estatus`.
  - Integración de riesgo y generación de alertas por bloqueo documental.
  - Action `bandeja-revision` con filtros/orden/paginación.
- `backend/materialidad/services.py`
  - Servicios reusables de perfil/faltantes/riesgo.
  - Función de creación deduplicada de alertas de operación.
- `backend/materialidad/serializers.py`
  - Campos de riesgo en `OperacionSerializer`.
  - `AlertaOperacionSerializer`.
  - `BandejaRevisionItemSerializer`.
- `backend/materialidad/models.py`
  - Nuevo modelo `AlertaOperacion` con índices y constraint de dedupe activa.
- `backend/materialidad/urls.py`
  - Registro de `alertas-operacion`.

#### Migraciones
- `backend/materialidad/migrations/0045_alertaoperacion.py`

#### Pruebas
- `backend/materialidad/tests/test_operacion_cambiar_estatus.py`
  - Transiciones válidas/inválidas.
  - Riesgo bajo/medio/alto.
  - Alertas deduplicadas por faltantes críticos.
- `backend/materialidad/tests/test_operacion_bandeja_revision.py`
  - Contrato de bandeja por rol, filtros, orden y paginación.

#### Documentación
- `docs/api.md`
  - Contrato de endpoint `operaciones/bandeja-revision`.
- `docs/planning/qa_sprint2_suite_2026-03-03.md`
  - Evidencia QA consolidada Sprint 2.

---

### Validación ejecutada

Suite ejecutada localmente:

```bash
cd /home/gaibarra/materialidad/backend
/home/gaibarra/materialidad/.venv/bin/python manage.py test \
  materialidad.tests.test_operacion_cambiar_estatus \
  materialidad.tests.test_operacion_bandeja_revision \
  -v 2
```

Resultado: **`27 tests OK`**.

---

### Riesgos / notas operativas
- Cambió el comportamiento de `cambiar-estatus` para retornar información enriquecida en bloqueos (`faltantes`, `perfil_validacion`, `alerta_operacion_id`).
- Se recomienda validar en UAT el consumo de estos campos en frontend.
- Se mantiene observación no bloqueante de validadores (`min_value in DecimalField should be Decimal type`) fuera del alcance de este PR.

---

### Checklist de merge
- [ ] Revisar migración `0045_alertaoperacion.py` en staging.
- [ ] Confirmar compatibilidad de frontend con payload de bloqueo/riesgo/bandeja.
- [ ] Verificar permisos de acceso para endpoints nuevos según rol del usuario.
- [ ] Ejecutar smoke test funcional post-deploy.

---

## Checklist de Release / UAT (operativo)

### Pre-deploy
- [ ] Base de datos de staging respaldada.
- [ ] Aplicar migraciones de rama.
- [ ] Confirmar variables de entorno y configuración de tenant.
- [ ] Confirmar rama/tag de despliegue.

### UAT funcional mínimo
- [ ] Caso inválido de transición devuelve `400` con detalle de transición.
- [ ] Caso `VALIDADO` bloqueado por faltantes devuelve perfil + faltantes + `alerta_operacion_id`.
- [ ] Caso expediente completo permite `VALIDADO` y registra auditoría.
- [ ] Riesgo en operación se visualiza (`riesgo_nivel/score/motivos`).
- [ ] Endpoint `alertas-operacion` lista alerta generada y evita duplicados en reintento.
- [ ] Endpoint `bandeja-revision` aplica filtros por `rol`, `estatus`, `riesgo`, `rfc`.
- [ ] Orden de bandeja por `riesgo` y `antiguedad` consistente.

### Post-deploy (24h)
- [ ] Monitorear `4xx/5xx` de `/api/materialidad/operaciones/*/cambiar-estatus/`.
- [ ] Monitorear `4xx/5xx` de `/api/materialidad/operaciones/bandeja-revision/`.
- [ ] Verificar creación de `AuditLog` en transiciones válidas.
- [ ] Verificar creación/consulta de `AlertaOperacion` sin duplicación activa.

### Criterio de salida
- [ ] UAT sin bloqueantes P1/P0.
- [ ] QA técnico validado por backend + funcional.
- [ ] Aprobación de release por responsables técnico/funcional/compliance.
