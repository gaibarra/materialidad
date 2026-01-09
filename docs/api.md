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
  - Incluye `indice.json` y `README.txt`; adjunta las evidencias locales (archivos de evidencias y contrato notariado). URLs externas se listan en el índice aunque no se empaqueten.

## Headers obligatorios
- `Authorization` debe incluir `Bearer` y el token JWT vigente.
- `X-Tenant` debe contener el slug real del tenant en todas las rutas de `/api/materialidad/`.

## Paginación
- Todas las listas usan paginación estándar DRF (`count`, `next`, `previous`, `results`).
- `PAGE_SIZE` global: 25.
