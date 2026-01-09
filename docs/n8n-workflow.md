# Workflow de validación fiscal en n8n

## Objetivo
Orquestar validaciones en tiempo real para proveedores y operaciones utilizando fuentes oficiales (69-B, opinión de cumplimiento, listas negras SAT) y devolver resultados al backend mediante el webhook configurado en `N8N_WEBHOOK_URL`.

## Estructura recomendada de nodos
1. **Webhook (Trigger)**
   - Método: `POST`
   - URL: debe coincidir con `N8N_WEBHOOK_URL`.
   - Campos esperados:
     - `empresa.id`, `empresa.rfc`, `empresa.razon_social`
     - `proveedor.id`, `proveedor.rfc`, `proveedor.razon_social`
     - `contexto` opcional con detalles de operación (monto, moneda, uuid_cfdi, fecha_operacion).
2. **Function (Normalización)**
   - Valida que se hayan recibido todos los campos obligatorios.
   - Construye objeto estándar para los conectores posteriores.
3. **HTTP Request – Opinión de cumplimiento**
   - Conecta contra el servicio usado por el área fiscal (puede ser SAT o API privada).
   - Maneja autenticación mediante credenciales almacenadas en `Credentials` de n8n.
   - Respuestas se agregan al objeto `validaciones.opinion_cumplimiento`.
4. **HTTP Request – Artículo 69-B**
   - Consulta lista oficial.
   - Devuelve estado (`sin_coincidencias`, `presunto`, `definitivo`).
5. **Funcion / Code Node (Consolidación)**
   - Combina resultados previos, genera `estatus_global` y `riesgos_detectados`.
   - Define recomendaciones (ej. `solicitar_complemento_documental`).
6. **HTTP Request – Callback al backend**
   - Endpoint: `POST /api/materialidad/proveedores/{proveedor_id}/validaciones/`
   - Headers:
   - `Authorization: Bearer` seguido del token de servicio emitido por el backend
   - `X-Tenant` con el slug real del tenant
   - Body:
     - `empresa`: ID real de la empresa
     - `contexto_adicional`: objeto con resultados de n8n
   - El backend actualizará los registros utilizando datos reales recibidos.
7. **Set + Respond to Webhook**
   - Estructura una respuesta JSON con los campos relevantes para monitoreo (`execution_id`, `estatus_global`, `riesgos`).

## Consideraciones
- Todas las credenciales deben residir en `n8n Credentials` cifradas.
- Implementa reintentos con backoff exponencial en cada `HTTP Request`.
- Loguea cada paso con `Workflow Settings > Execution data save` habilitado para auditoría.
- Evita escribir datos de prueba; cada ejecución debe trabajar únicamente con la información enviada desde el backend.
