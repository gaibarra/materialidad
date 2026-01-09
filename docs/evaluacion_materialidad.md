# Evaluación de materialidad y áreas de oportunidad

## Estado actual (cobertura)
- **Existencia y capacidad del proveedor**
  - Validaciones SAT/69-B con histórico y alertas.
  - Campos para riesgo fiscal, vigencias (32-D, constancia, REPSE) y acuses.
  - Comparador de precios para sustentar valor de mercado.
- **Ejecución y trazabilidad**
  - Generador de contratos con fecha cierta opcional y logística de firma (fedatario, cita, testimonio).
  - Checklist por pilar (Entregables, Razón de negocio, Capacidad, Fecha cierta) y control de entregables por tipo de gasto.
  - Carga de evidencias con metadatos por servicio (marketing, consultoría, mantenimiento, logística).
  - Ruta de logística (Carta Porte, guías, almacén con fotos/firmas).
- **Flujo financiero**
  - Validador CFDI/SPEI (UUID, referencia, monto) y conciliación básica factura–pago.
- **Razón de negocios**
  - Campos obligatorios “¿Para qué gasté esto?” y “Beneficio esperado” en contratos/operaciones.
  - Adjuntos de temario/listas de asistencia para cursos.

## Brechas y mejoras sugeridas
- **Capacidad operativa del proveedor (IMSS/activos/persona clave)**
  - Incorporar captura de REPS/IMSS, inventario de activos, CV del personal asignado.
  - Evidencia fotográfica del domicilio fiscal e instalaciones; URL y screenshots del sitio web.
- **Documentación “antes, durante, después”**
  - Plantillas específicas por giro con entregables mínimos (minutas, correos de coordinación, bitácoras).
  - Trazabilidad de órdenes de compra → contrato → entregables → recepción/almacén → facturación.
- **Fecha cierta reforzada**
  - Integrar sellado de tiempo externo y acuse automático; opción de inscripción en registro público y folio notarial adjunto.
- **Flujo financiero y bancarización**
  - Adjuntar estados de cuenta y conciliación bancaria automática (monto, fecha, cuenta origen/destino).
  - Detección de operaciones circulares y alertas por inconsistencias monto–capacidad económica.
- **Razón de negocios (art. 5-A CFF)**
  - Workflow de aprobación interna (quién autoriza, fecha, rol) y bitácora de decisiones.
  - Matriz de necesidad/beneficio con evidencia de métricas esperadas vs. reales.
- **Contemporaneidad**
  - Políticas de captura obligatoria en tiempo real y alertas por entregables vencidos.
  - Sellos de tiempo en cada evidencia y firma de recepción.
- **CFDI y descripciones**
  - Validación automática de conceptos genéricos y sugerencia de descripciones específicas según entregable.
- **Auditoría y bitácora**
  - Log detallado por operación (quién sube, modifica o aprueba evidencias/contratos).
- **Reportes de defensa**
  - Export a dossier estructurado (ZIP + índice) con orden cronológico y pilar SAT.

## Plan mínimo para cerrar brechas
1. **Capacidad operativa**: módulo de REPS/IMSS, activos y CV; fotos y web.
2. **Financiero**: conciliación bancaria con estados de cuenta adjuntos; alertas de circularidad.
3. **Fecha cierta**: sello de tiempo externo + campos de folio notarial/registro.
4. **Workflow 5-A**: aprobaciones con roles y matriz de necesidad/beneficio.
5. **Contemporaneidad**: políticas y alertas automáticas de captura; sellos de tiempo en evidencias.
6. **CFDI específicos**: regla de negocio para rechazar conceptos genéricos sin entregable asociado.
