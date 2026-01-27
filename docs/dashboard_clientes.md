# Dashboard para Clientes del Despacho

## Objetivo
Dar a las empresas clientes un panel claro para colaborar con su despacho: ver estado de materialidad por operación, subir evidencias, validar CFDI/SPEI, consultar contratos y recibir alertas de cumplimiento.

## Principios
- **Simplicidad**: solo se muestran las acciones que el cliente debe ejecutar o revisar.
- **Transparencia**: visibilidad de contratos, validaciones y checklist de materialidad.
- **Trazabilidad**: cada carga o validación queda registrada con fecha y usuario.
- **Guía paso a paso**: el dashboard sugiere la siguiente acción pendiente.

## Estructura
- **Header**: etiqueta de rol "Cliente", nombre de la empresa, usuario y estado resumido (operaciones con pendientes).
- **Sidebar**: accesos a operaciones, contratos, validaciones, evidencias, checklist y ayuda.
- **Contenido**: tarjetas de KPIs y tablas filtrables por periodo/operación.

## Secciones clave
1) **Operaciones**
   - Lista de operaciones en curso y su estado (pendiente, en validación, completo).
   - Acciones rápidas: subir evidencia, validar CFDI/SPEI, ver contrato.

2) **Contratos**
   - Contratos emitidos por el despacho con fecha cierta y vigencia.
   - Descarga en PDF y visualización de cláusulas clave.

3) **Validador CFDI/SPEI**
   - Subir CFDI y/o comprobante SPEI para validar estatus y monto.
   - Resultado visible para el cliente y el despacho.

4) **Evidencias**
   - Carga de cotizaciones, órdenes de compra, entregables o soportes.
   - Historial de versiones y quién las subió.

5) **Checklist de materialidad**
   - Pasos por pilar: Entregables, Razón de negocio, Capacidad del proveedor, Fecha cierta.
   - Marca automática de avances cuando se completan validaciones o cargas.

6) **Alertas y vencimientos**
   - Contratos próximos a vencer y operaciones con pendientes críticos.
   - Notificaciones resumidas y enlaces directos a resolver.

7) **Ayuda y soporte**
   - Preguntas frecuentes y canal de contacto con el despacho.

## Métricas visibles para el cliente
- Operaciones con checklist completo vs pendientes.
- Contratos vigentes y próximos a vencer.
- CFDI/SPEI validados vs rechazados.
- Evidencias cargadas por operación.

## Flujo recomendado para el cliente
1. Revisar operaciones abiertas y atender las que tengan pendientes.
2. Subir CFDI/SPEI y evidencias requeridas.
3. Consultar y descargar el contrato asociado a la operación.
4. Completar los ítems del checklist guiado.
5. Monitorear alertas y vencer pendientes antes de la fecha límite.

## Estado actual
- Panel operativo con operaciones, contratos, validador CFDI/SPEI y evidencias.
- Checklist funcional; alertas de vencimiento básicas activas.
- Sin acceso a administración ni provisión (reservado a despacho/superusuarios).
