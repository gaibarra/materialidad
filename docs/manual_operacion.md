# Manual operativo de materialidad (paso a paso)

Guía práctica para capturar, evidenciar y defender cada operación frente al SAT.

## Flujo completo en 10 pasos
1) **Entrar y elegir empresa**: Inicie sesión y seleccione la empresa con la que trabajará (si hay varias).  
2) **Dar de alta proveedor** (si falta): Datos fiscales, contacto y capacidad (REPS/IMSS, activos, personal, fotos, web).  
3) **Crear contrato**: Defina vigencias, modalidad de firma y, si requiere, fecha cierta (fedatario/registro).  
4) **Registrar operación**: Empresa, proveedor, monto/moneda, fecha, concepto y contrato relacionado.  
5) **Cargar entregables**: Cree los entregables requeridos por tipo de gasto con fecha compromiso.  
6) **Subir evidencias “antes–durante–después”**: OC/guías, minutas/fotos, recepciones firmadas.  
7) **Validar CFDI/SPEI y conciliar**: Ingrese UUID y referencia; verifique montos/fechas; adjunte estado de cuenta si aplica.  
8) **Recepción y fecha cierta**: Capture acuse/testimonio, fedatario o folio de registro; marque fecha cierta obtenida.  
9) **Revisar alertas y bitácora**: Entregables vencidos, conceptos CFDI genéricos, capacidad económica, auditoría de acciones.  
10) **Exportar dossier**: Desde la operación, “Exportar dossier” → ZIP con índice por pilar SAT, listo para auditoría.

## Detalle por fase

### 1. Proveedores
- Dónde: **Dashboard → Proveedores**.  
- Capture: razón social, RFC, contacto, riesgo 69-B/REPS/IMSS.  
- Capacidad: personal clave, activos, fotos domicilio, web/capturas, capacidad económica mensual (para alertas).

### 2. Contratos
- Dónde: **Dashboard → Contratos**.  
- Campos: nombre, categoría/proceso, proveedor (opcional), vigencias.  
- Fecha cierta: fedatario/instrumento o folio de registro; adjunte acuse/testimonio cuando exista.  
- Generación: use plantillas para redactar; exporte a DOCX si lo necesita.

### 3. Operaciones
- Dónde: **Dashboard → Operaciones**.  
- Capture: empresa, proveedor, monto/moneda, fecha, concepto, contrato relacionado.  
- Valide que el concepto no sea genérico; si lo es, aplique la sugerencia que arma el sistema con entregables.

### 4. Entregables y checklist
- Dónde: en la operación, sección **Entregables**.  
- Cree entregables requeridos por tipo de gasto; estados: Pendiente → En proceso → Entregado → Recibido → Facturado.  
- Alertas: el sistema marca vencidos y días de atraso; exige evidencia y, para “Recibido”, nombre/correo de quien firma.

### 5. Evidencias (antes–durante–después)
- Dónde: en la operación, sección **Evidencias**.  
- Antes: órdenes de compra, guías, planeación.  
- Durante: minutas, fotos, bitácoras, avances.  
- Después: recepciones firmadas, actas, entregables finales.  
- Cada carga queda en bitácora (usuario, fecha, IP).

### 6. CFDI / SPEI / Conciliación
- Dónde: en la operación, sección **Validación CFDI/SPEI**.  
- Ingrese UUID y referencia SPEI; el sistema valida estatus, monto y fecha.  
- Conciliación: si hay estados de cuenta/movimientos, adjúntelos y revise alertas de circularidad e inconsistencia monto–capacidad.

### 7. Recepción y fecha cierta
- Dónde: **Firma y fecha cierta** (contrato).  
- Capture cita/fedatario/instrumento o folio de registro público.  
- Marque “Fecha cierta obtenida” solo si adjunta acuse/testimonio; requerido para guardar.

### 8. Auditoría
- Dónde: **Administración → Auditoría** (staff).  
- Filtre por acción, objeto, usuario, fechas o ID de objeto.  
- Acciones registradas: altas/ediciones de contratos, operaciones, entregables, evidencias, aprobaciones.

### 9. Dossier de defensa
- Dónde: **Operaciones → Exportar dossier**.  
- Obtiene un ZIP con `indice.json` y `README.txt` en orden cronológico por pilar SAT: contrato/fecha cierta, entregables, evidencias, CFDI/SPEI, recepciones.  
- Archivos faltantes se marcan en el índice; enlaces externos se listan pero no se embeben.

### 10. Cierre mensual (checklist)
- CFDI/SPEI validados y conciliados (monto/fecha/ref).  
- Contratos vigentes y, si aplica, con fecha cierta/acuse.  
- Entregables cerrados o con plan de acción; evidencias “antes–durante–después” completas.  
- Proveedores revisados (69-B/REPS/IMSS) y capacidad documentada.  
- Dossiers generados para operaciones críticas o en revisión.

## Roles y responsabilidades
- **Solicitante/Compras**: registra operación, OC y evidencias iniciales.  
- **Área usuaria/Operaciones**: evidencias de ejecución y recepción.  
- **Contabilidad/Fiscal**: valida CFDI/SPEI, conciliación y cierre; genera dossier.  
- **Legal/Compliance**: contratos, fecha cierta, aprobaciones y cláusulas.  
- **Staff/Administradores**: auditoría, políticas, plantillas y soporte.

## Mejores prácticas
- Captura contemporánea: suba evidencias en el momento, no al cierre.  
- Evite conceptos genéricos en CFDI; use la sugerencia si aplica.  
- Mantenga estados de entregable actualizados; “Recibido” exige firma (nombre/correo).  
- Revise alertas de vencimiento y capacidad económica del proveedor.

## Soporte rápido
- CFDI/SPEI con error: revise UUID, monto, fecha, referencia y revalide.  
- Dossier con faltantes: suba el archivo o verifique la URL externa.  
- Alertas de vencidos: cargue evidencia y actualice estado.  
- Para dudas: use el panel de ayuda o escale a soporte ProyectoG40.

---

**C.P. Gonzalo Arturo Ibarra Mendoza**  
ProyectoG40
