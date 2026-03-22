# Contratos API Materialidad

## Autenticación
- `POST /api/accounts/token/`
  - Body: `email`, `password`, `tenant`.
  - Respuesta: `access`, `refresh`, `tenant`.
- `POST /api/accounts/token/refresh/` con `refresh`.
- `GET /api/accounts/me/`
  - Headers: `Authorization: Bearer` seguido del JWT emitido y `X-Tenant` con el slug real (opcional si el token ya lo incluye).

## Empresas
- `GET /api/materialidad/empresas/`
  - Parámetros: `search`, `ordering`, `regimen_fiscal`, `activo`, `pais`.
- `POST /api/materialidad/empresas/`
  - Campos obligatorios: `razon_social`, `rfc`, `regimen_fiscal`, `fecha_constitucion`, `pais`, `estado`, `ciudad`.
- `PATCH /api/materialidad/empresas/{id}/`
  - Actualiza cualquier campo editable.

## Proveedores
- `GET /api/materialidad/proveedores/`
  - Parámetros: `search`, `ordering`, `pais`, `estatus_sat`.
- `POST /api/materialidad/proveedores/`
  - Campos obligatorios: `razon_social`, `rfc`, `pais`.
- `POST /api/materialidad/proveedores/{id}/validaciones/`
  - Body:
    - `empresa`: ID de una empresa registrada en el tenant.
    - `operacion` opcional: ID de operación relacionada.
    - `contexto_adicional` opcional: objeto JSON con evidencias/documentos.
  - Efecto: dispara el workflow n8n configurado.

## Contratos
- `GET /api/materialidad/contratos/`
  - Parámetros: `search`, `ordering`, `categoria`, `proceso`, `tipo_empresa`, `empresa`, `activo`.
- `POST /api/materialidad/contratos/`
  - Campos mínimos: `empresa`, `nombre`, `categoria`, `proceso`.
  - Opcionales: `proveedor`, `codigo_interno`, fechas de vigencia, banderas (`es_marco`), vínculos documentales (`soporte_documental`, `expediente_externo`).
- `PATCH /api/materialidad/contratos/{id}/`
  - Mantiene histórico de vigencias y metadatos asociados a auditorías.
- Cada contrato puede asociarse a múltiples operaciones y actuar como soporte jurídico trazable por proceso y tipo de empresa.

## Operaciones
- `GET /api/materialidad/operaciones/`
  - Parámetros: `search`, `ordering`, `estatus_validacion`, `moneda`, `tipo_operacion`, `empresa`, `proveedor`, `contrato`.
- `GET /api/materialidad/operaciones/bandeja-revision/`
  - Objetivo: cola de revisión por rol con riesgo/faltantes/alertas activas por operación.
  - Parámetros:
    - `rol`: `SERVICIOS`, `COMPRAS`, `PARTES_RELACIONADAS`, `GENERAL`.
    - `estatus`: filtro por `estatus_validacion` (`PENDIENTE`, `EN_PROCESO`, `VALIDADO`, `RECHAZADO`).
    - `riesgo`: `BAJO`, `MEDIO`, `ALTO`.
    - `rfc`: filtra por RFC de empresa o proveedor.
    - `orden`: `riesgo` (default, riesgo desc + antigüedad asc) o `antiguedad` (antigüedad asc + riesgo desc).
  - Respuesta: lista paginada de operaciones con campos base + `perfil_validacion`, `riesgo_nivel`, `riesgo_score`, `riesgo_motivos`, `faltantes`, `alertas_activas`.
  - Ejemplo de item en `results`:
    - `id`, `fecha_operacion`, `estatus_validacion`, `tipo_operacion`, `monto`, `moneda`, `concepto`
    - `empresa`, `empresa_rfc`, `empresa_nombre`
    - `proveedor`, `proveedor_rfc`, `proveedor_nombre`
    - `contrato`, `contrato_nombre`, `contrato_categoria`
    - `perfil_validacion`, `riesgo_nivel`, `riesgo_score`, `riesgo_motivos`, `faltantes`, `alertas_activas`
- `GET /api/materialidad/operaciones/matriz-materialidad/`
  - Objetivo: consolidar cadena documental por operación (`CFDI -> contrato -> pago -> evidencia`) y brechas.
  - Parámetros:
    - `empresa`: ID de empresa.
    - `proveedor`: ID de proveedor.
    - `estatus`: filtro por `estatus_validacion`.
    - `riesgo`: `BAJO`, `MEDIO`, `ALTO`.
    - `rfc`: RFC de empresa o proveedor.
    - `orden`: `riesgo` (default) o `antiguedad`.
  - Respuesta por item:
    - Base de operación (`id`, fecha, estatus, monto, empresa/proveedor, `uuid_cfdi`, `referencia_spei`).
    - `perfil_validacion`, `riesgo_nivel`, `riesgo_score`.
    - `estado_completitud` (`COMPLETO`/`INCOMPLETO`) y `faltantes`.
    - `cadena_documental`: `cfdi`, `contrato`, `pago`, `evidencia` con presencia y detalle.
    - `alertas_activas` relacionadas.
- `POST /api/materialidad/operaciones/`
  - Campos obligatorios: `empresa`, `proveedor`, `monto`, `moneda`, `fecha_operacion`, `tipo_operacion`.
  - Se recomienda enviar `contrato` con el ID del contrato vigente que soporta la operación. El sistema valida que el contrato pertenezca a la misma empresa.
  - Al crear, el backend:
    - Guarda `creado_por_usuario_id` y `creado_por_email` desde el usuario autenticado.
    - Envía los datos a n8n para validación fiscal.
- `PATCH /api/materialidad/operaciones/{id}/`
  - Permite actualizar campos editables. El estatus se ajusta automáticamente cuando se recibe información desde n8n.
- `GET /api/materialidad/operaciones/{id}/exportar-dossier/`
  - Responde un `.zip` con índice cronológico y agrupado por pilar SAT (Entregables/Razón de negocio).
  - Incluye `indice.json`, `README.txt` y `manifiesto_integridad.json` (hash SHA-256 por archivo incluido).
  - Adjunta las evidencias locales (archivos de evidencias y contrato notariado). URLs externas se listan en el índice aunque no se empaqueten.
- `GET /api/materialidad/operaciones/{id}/exportar-pdf-defensa/`
  - Responde un `.pdf` con reporte de defensa fiscal por operación.
  - Incluye portada (empresa/proveedor/operación), hechos relevantes e índice de anexos.

## Dashboard
- `GET /api/materialidad/dashboard/metricas/cobertura-p0/`
  - Objetivo: métricas de cobertura documental P0 con distribución de riesgo, alertas activas y tendencia semanal.
  - Parámetros:
    - `days` (opcional): rango histórico en días (7-365, default `90`).
    - `empresa` (opcional): ID de empresa para filtrar el cálculo.
  - Respuesta:
    - `period`: rango aplicado (`days`, `from`, `to`, `empresa_id`).
    - `coverage`: `total_operaciones`, `completas`, `incompletas`, `cobertura_documental_pct`.
    - `riesgo_distribution`: conteo y monto por nivel `BAJO/MEDIO/ALTO`.
    - `alertas`: totales activas y desglose por tipo.
    - `trend_weekly`: series semanales (`total_operaciones`, `validadas`, `completas`, `incompletas`).

## Cierre Sprint 3 (contrato consolidado)

### Cambio de estatus con validación bloqueante
- `POST /api/materialidad/operaciones/{id}/cambiar-estatus/`
  - Body:
    - `estatus_validacion`: `PENDIENTE` | `EN_PROCESO` | `VALIDADO` | `RECHAZADO`
    - `comentario` (opcional)
  - Comportamiento clave:
    - Si la transición es inválida, responde `400` con detalle de transición no permitida.
    - Si se intenta `VALIDADO` con expediente incompleto, responde `400` con `faltantes`, `perfil_validacion` y `alerta_operacion_id`.
    - Si es válido, responde `200` con operación actualizada (incluye `riesgo_nivel`, `riesgo_score`, `riesgo_motivos`).

### Alertas de operación
- `GET /api/materialidad/alertas-operacion/`
  - Filtros: `empresa`, `proveedor`, `estatus`, `tipo_alerta`, `operacion`, `empresa_rfc`, `proveedor_rfc`.
  - Campos clave:
    - `tipo_alerta`: `FALTANTES_CRITICOS` | `VENCIMIENTO_EVIDENCIA`
    - `estatus`: `ACTIVA` | `EN_SEGUIMIENTO` | `CERRADA`
    - `clave_dedupe`, `owner_email`, `motivo`, `detalle`, `fecha_alerta`.

### Ejemplo de respuesta: matriz materialidad
```json
{
  "count": 1,
  "next": null,
  "previous": null,
  "results": [
    {
      "id": 101,
      "estatus_validacion": "EN_PROCESO",
      "perfil_validacion": "SERVICIOS",
      "riesgo_nivel": "MEDIO",
      "riesgo_score": 35,
      "estado_completitud": "INCOMPLETO",
      "faltantes": ["Bitácora o comunicación de seguimiento (tipo BITACORA/COMUNICACION)"],
      "cadena_documental": {
        "cfdi": {"presente": true, "uuid": "...", "estatus": "VALIDO"},
        "contrato": {"presente": true, "id": 56, "nombre": "Contrato Servicios"},
        "pago": {"presente": true, "tipo": "SPEI", "referencia_spei": "SPEI-001", "soporte_metadata": false},
        "evidencia": {"presente": true, "total": 1, "tipos": ["ENTREGABLE"]}
      },
      "alertas_activas": [
        {"id": 88, "tipo_alerta": "FALTANTES_CRITICOS", "estatus": "ACTIVA", "motivo": "Intento de VALIDADO bloqueado por faltantes críticos de expediente."}
      ]
    }
  ]
}
```

### Ejemplo de respuesta: cobertura P0
```json
{
  "generated_at": "2026-03-04T08:24:48.000000+00:00",
  "period": {"days": 90, "from": "2025-12-04", "to": "2026-03-04", "empresa_id": null},
  "coverage": {"total_operaciones": 120, "completas": 78, "incompletas": 42, "cobertura_documental_pct": 65.0},
  "riesgo_distribution": {
    "BAJO": {"count": 44, "monto": 2500000.0},
    "MEDIO": {"count": 51, "monto": 4100000.0},
    "ALTO": {"count": 25, "monto": 3600000.0}
  },
  "alertas": {
    "activas_total": 18,
    "por_tipo": {"FALTANTES_CRITICOS": 15, "VENCIMIENTO_EVIDENCIA": 3}
  },
  "trend_weekly": [
    {"week_start": "2026-02-24", "week_end": "2026-03-02", "total_operaciones": 12, "validadas": 7, "completas": 8, "incompletas": 4}
  ]
}
```

### Errores estándar recomendados para consumidores frontend
- `400`:
  - Parámetro inválido (ej. `riesgo`, `orden`, `empresa`).
  - Transición de estatus no permitida.
  - Bloqueo por expediente incompleto.
- `401`:
  - Token ausente/expirado.
- `403`:
  - Usuario autenticado sin permisos de recurso.
- `404`:
  - Operación o recurso no encontrado.

## Headers obligatorios
- `Authorization` debe incluir `Bearer` y el token JWT vigente.
- `X-Tenant` debe contener el slug real del tenant en todas las rutas de `/api/materialidad/`.

## Paginación
- Todas las listas usan paginación estándar DRF (`count`, `next`, `previous`, `results`).
- `PAGE_SIZE` global: 25.
