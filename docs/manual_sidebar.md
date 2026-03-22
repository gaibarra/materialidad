# Manual del Sidebar — Materialidad 360°

Este documento describe cada seccion del Sidebar en el orden exacto en que aparece de arriba a abajo, incluyendo: **1) Utilidad en la practica** y **2) Manual de operacion** con detalles fieles a la interfaz.

> **Nota sobre permisos:** "Organizaciones" solo aparece para superusuarios. "Administracion" y "Auditoria" solo aparecen para usuarios con rol staff (despacho).

---

## INICIO

### Inteligencia fiscal

**Ruta:** `/dashboard`

**Utilidad en la practica:**
Es el tablero ejecutivo central de Materialidad 360°. Concentra la vision financiera, fiscal y ESG del tenant en una sola pantalla. Permite al usuario detectar riesgos, medir cobertura contractual, monitorear tendencias historicas y actuar de inmediato sobre las prioridades operativas.

**Contenido detallado de la pantalla:**

- **Encabezado "Panel ejecutivo — Materialidad 360°":** muestra nombre de usuario, tenant/despacho asignado, rol (Superusuario / Despacho / Cliente) y boton "Cerrar sesion".
- **Tarjeta "Herramientas con IA — Genera contratos con GPT-5 mini":** banner con boton "Abre generador" que lleva directo al Generador de contratos. Texto: "Captura los datos clave y obten un borrador editable con referencias fiscales sugeridas."
- **Bloque "Salud fiscal — KPIs para anticipar auditorias del SAT":**
  - Timestamp de ultima actualizacion.
  - Boton "Actualizar KPIs" para refrescar metricas bajo demanda.
  - Tarjetas de KPIs (cada una con valor numerico, etiqueta de tono y texto de ayuda):
    - **Cobertura contractual** — porcentaje de empresas con contratos vigentes. Tono: Riesgo / Vigilar / Saludable.
    - **Contratos por vencer (30d)** — numero de contratos proximos a vencer. Tono: Riesgo si > 0, Saludable si 0.
    - **Operaciones sin validar** — pendientes de validacion. Tono segun cantidad.
    - **Proveedores sin estatus SAT** — sin validacion del listado 69-B. Tono segun cantidad.
    - **CFDIs validados (MXN)** — monto acumulado de validaciones en 30 dias. Tono: Saludable si > 0, Seguimiento si 0.
- **Bloque "Tendencia historica — Preparacion ante fiscalizaciones":**
  - Rango de fechas y botones de ventana temporal: **30 dias**, **90 dias**, **180 dias**, **0 snapshots**.
  - Sparklines de cobertura contractual y operaciones pendientes.
  - Mensaje si no hay snapshots: "Aun no contamos con snapshots historicos. El cron programado los ira acumulando automaticamente."
- **Tabla "Empresas activas":**
  - Encabezado: "Empresas registradas en el tenant".
  - Boton "Actualizar" para refrescar el listado.
  - Columnas: Razon social, RFC, Regimen, Ubicacion, Estatus, Acciones.
  - Mensaje vacio: "No hay empresas registradas en este tenant."
- **Modulo "Registrar empresa — Agrega una razon social":**
  - Texto: "Despliega el formulario solo cuando necesites capturar o editar datos fiscales."
  - Boton "Registrar empresa" que expande el formulario.
  - Formulario con campos: Razon social, RFC (auto-mayusculas), Regimen fiscal (catalogo SAT completo), Fecha de constitucion, Pais, Estado, Ciudad, Email de contacto, Telefono de contacto.
  - Botones: Guardar y Cancelar.
- **Vista de "Administracion Global" (solo superusuarios sin tenant):**
  - Encabezado "Control Plane — Administracion Global".
  - Tarjetas rapidas con iconos: "Gestionar Organizaciones" (Building2) y "Gestionar Accesos" (Users) que enlazan a Organizaciones y Administracion respectivamente.

**Manual de operacion (paso a paso):**

1. Al ingresar, confirmar en el encabezado que el usuario, rol y tenant son correctos.
2. Revisar las tarjetas de KPIs. Priorizar las que muestren "Riesgo" (fondo rojo/naranja).
3. Si los KPIs no estan actualizados, pulsar "Actualizar KPIs".
4. En "Tendencia historica", seleccionar la ventana temporal deseada (30, 90 o 180 dias) y verificar si la preparacion mejora o empeora.
5. Revisar la tabla "Empresas activas": confirmar que todas las razones sociales del tenant estan registradas. Si falta alguna, usar "Registrar empresa".
6. Al registrar empresa, completar todos los campos fiscales y guardar. La empresa quedara disponible para contratos, validaciones y expedientes.
7. Si se necesita un contrato rapido, usar la tarjeta "Abre generador" para saltar directo al Generador de contratos.
8. Documentar decisiones y acciones tomadas ante riesgos detectados.

---

## BASE OPERATIVA

### Empresas

**Ruta:** `/dashboard/empresas`

**Utilidad en la practica:**
Listado dedicado de las empresas del tenant con acceso a detalle individual. Sirve para consultar, filtrar y navegar al perfil completo de cada razon social.

**Contenido detallado de la pantalla:**

- **Encabezado:** etiqueta "Base operativa", titulo "Empresas", subtitulo "Listado de empresas registradas en el tenant."
- **Tabla de empresas:** columnas: Razon social (enlace al detalle individual), RFC, Regimen, Estado, Ciudad, Estatus (badge "Activa" verde o "Inactiva" rojo).
- **Mensajes de estado:** "Cargando empresas..." o "No hay empresas registradas."
- **Enlace por razon social:** lleva a `/dashboard/empresas/[id]` con el perfil completo.

**Manual de operacion:**

1. Abrir "Empresas" desde el sidebar.
2. Revisar la tabla y verificar que los datos basicos sean correctos.
3. Hacer clic en la razon social para abrir el perfil individual.
4. Si una empresa aparece como "Inactiva", coordinar la actualizacion de estatus.
5. Para dar de alta nuevas empresas, regresar a "Inteligencia fiscal" y usar el formulario de registro.

---

### Proveedores

**Ruta:** `/dashboard/proveedores`

**Utilidad en la practica:**
Padron completo de proveedores con validacion de estatus SAT, alertas del articulo 69-B y capacidad operativa documentada. Es critico para due diligence y materialidad.

**Contenido detallado de la pantalla:**

- **Formulario "Capacidad del proveedor":**
  - Titulo: "Nuevo proveedor" (o "Editar [razon social]" en modo edicion).
  - Subtitulo: "Captura datos de capacidad operativa y presencia."
  - Boton "Cancelar edicion" visible al editar.
  - Seccion "Informacion general": Razon social, RFC (auto-mayusculas), Actividad principal, Pais, Estado, Ciudad, Correo de contacto, Telefono.
  - Seccion desplegable "Capacidad": Registro REPS/IMSS, Registro patronal IMSS, Activos relevantes (separados por coma), Personal clave (separados por coma).
  - Seccion desplegable "Presencia": Sitio web, Capturas web (URLs separadas por coma), Notas de capacidad (textarea).
  - Seccion desplegable "Evidencias": Fotos domicilio (URLs separadas por coma).
  - Botones: "Crear proveedor" / "Actualizar proveedor" y "Limpiar".
- **Encabezado "Due diligence — Proveedores y alertas 69-B":**
  - Subtitulo: "Consulta estatus SAT, alertas del articulo 69-B y envia validaciones al flujo n8n."
  - Tarjetas resumen: "Proveedores registrados" (total), "Alertas 69-B" (en riesgo).
  - Selector "Empresa para validar" (dropdown de empresas del tenant).
- **Tarjetas de proveedor:** una por proveedor, con:
  - Razon social, RFC.
  - Badges: estatus SAT, estatus 69-B (SIN_COINCIDENCIA verde / PRESUNTO ambar / DEFINITIVO rojo), riesgo fiscal.
  - Tarjetas internas: "Ultima validacion SAT" y "Ultima validacion 69-B" con fechas.
  - Bloque de "Riesgos detectados" si existen (lista con bullets).
  - Datos de capacidad: activos relevantes, personal clave, fotos domicilio, capturas web.
  - Boton "Editar" y boton "Validar 69-B" (envia solicitud al flujo n8n).

**Manual de operacion:**

1. Revisar el encabezado para ver totales y alertas.
2. Si hay alertas 69-B, abrir las tarjetas de proveedores marcados como PRESUNTO o DEFINITIVO.
3. Seleccionar la empresa con la que se opera y pulsar "Validar 69-B" para enviar al flujo n8n.
4. Para registrar un nuevo proveedor, completar el formulario superior con toda la informacion de capacidad, presencia y evidencia.
5. Revisar periodicamente que los proveedores tengan validaciones SAT recientes.
6. Editar proveedores existentes para actualizar activos, personal clave y evidencia fotografica.

---

## CONTRATACION

### Generador de contratos

**Ruta:** `/dashboard/contratos`

**Utilidad en la practica:**
Suite contractual completa con generacion de borradores por IA (GPT-5 mini), biblioteca de clausulas sugeridas, exportacion a Markdown y .docx, citas legales automaticas y analisis de redlines (comparacion de versiones).

**Contenido detallado de la pantalla:**

- **Banner hero "Suite contractual — Beta privada":**
  - Titulo: "Crea borradores blindados en minutos".
  - Subtitulo: "Indica los datos clave y deja que GPT-5 mini prepare un borrador personalizable con clausulas auditadas por el equipo fiscal."
  - Badges: "95% ajustes aprobados sin retrabajos" y "Biblioteca viva de clausulas SAT-ready".
  - Tarjetas laterales: "Tiempo estimado: 2 min para obtener un borrador usable" y "Cobertura: +200 plantillas curadas para operaciones MX".
- **Seccion "Configura el contexto — Datos para el borrador":**
  - Selector de Empresa (dropdown con razon social y RFC).
  - Selector de Plantilla base (opcional, con nombre y categoria).
  - Tarjeta de detalle de plantilla seleccionada: nombre, clave, proceso, descripcion.
  - Selectores de Idioma (Espanol / Ingles) y Tono (Formal / Neutral).
  - Textarea "Resumen de necesidades" con placeholder: "Describe objetivo, servicios, montos o condiciones relevantes".
  - Textarea "Clausulas o requisitos especiales" con placeholder: "Una clausula por linea (confidencialidad, penalizaciones, renovaciones, etc.)".
  - Botones: "Generar contrato" y "Limpiar formulario".
- **Bloque "Biblioteca viva — Clausulas sugeridas":**
  - Buscador por palabra clave y boton "Refrescar".
  - Tarjetas de clausulas sugeridas con: nivel de riesgo, titulo, relevancia (%), texto, tips de redline, palabras clave.
  - Botones por clausula: "Insertar en brief" y "Copiar texto".
- **Bloque "Panel de redlines — Compara versiones y resalta riesgos":**
  - Textarea "Texto original (base)" y textarea "Version con comentarios / contraparte".
  - Boton "Usar borrador actual" para cargar el borrador generado.
  - Botones: "Analizar redlines" y "Limpiar panel".
  - Resultado: alerta global, porcentaje de cambio, resumen, lista de riesgos clave, oportunidades y diff inteligente segmento por segmento (Sin cambios / Insertado / Eliminado / Modificado).
- **Panel lateral "Estado del generador":**
  - Estado: "Generando borrador" / "Borrador listo" / "Aun sin generacion".
  - Badge de idioma y tono activo.
  - Tips animados durante generacion (rotacion de mensajes de materialidad).
  - Botones: "Copiar borrador", "Descargar .md", "Exportar .docx".
  - Vista previa del borrador en texto plano.
- **Panel "Referencias legales — Citas generadas":**
  - Tarjetas de citas con: tipo_fuente, vigencia, ley, articulo, fraccion, referencia, resumen, criterios SAT.
  - Badge de metadata de cache: CACHE HIT / CACHE REFRESH, fecha de actualizacion, regeneraciones.

**Manual de operacion:**

1. Seleccionar la empresa para la que se genera el contrato.
2. Opcionalmente elegir una plantilla base que oriente la estructura.
3. Ajustar idioma y tono segun la necesidad.
4. Describir las necesidades en el textarea de resumen.
5. Agregar clausulas especiales (una por linea) o usar "Insertar en brief" desde la biblioteca de clausulas.
6. Pulsar "Generar contrato" y esperar el borrador (aprox. 2 min).
7. Revisar la vista previa y las citas legales generadas.
8. Exportar como .docx para revision formal o copiar el Markdown.
9. Si la contraparte envia cambios, usar el panel de redlines: pegar version original y version revisada, pulsar "Analizar redlines" y revisar riesgos y oportunidades.
10. Guardar evidencia del contrato en el expediente correspondiente.

---

### Firma y fecha cierta

**Ruta:** `/dashboard/firma-logistica`

**Utilidad en la practica:**
Formalizar contratos con registro de firma, modalidad (notarial, electronica, manuscrita), logistica de cita, acreditacion de fecha cierta con fedatario, instrumentacion, sellos de tiempo y registro publico.

**Contenido detallado de la pantalla:**

- **Encabezado "Fecha cierta — Firma y logistica":**
  - Subtitulo: "Programa la firma, registra fedatario e instrumentacion para acreditar fecha cierta."
- **Formulario principal (2/3 del ancho):**
  - ID de contrato (campo numerico).
  - Modalidad de firma: Notarial (fecha cierta) / Firma electronica avanzada / Manuscrita. Cada opcion con hint descriptivo.
  - Estado logistico: Pendiente / Agendada / En proceso / Completada / Cancelada.
  - Cita para firma (datetime-local).
  - Lugar de firma / notaria.
  - Responsable logistica (nombre y rol) + Contacto (telefono o email).
  - Seccion "Fecha cierta":
    - Checkbox "Requiere fecha cierta".
    - Checkbox "Fecha cierta obtenida".
    - Campos: Fedatario (nombre), No. de instrumento, Fecha de protocolizacion.
    - URL de testimonio / archivo notariado.
  - Seccion "Sello de tiempo":
    - Sello de tiempo (proveedor), datetime + boton "Marcar ahora".
    - Acuse / hash del sello.
    - Registro publico (folio de inscripcion + URL a constancia).
  - Textarea "Notas de logistica / instrucciones" con placeholder: "Mensajeria, entregables que deben acompanar la firma, SLA, etc."
  - Boton "Guardar logistica".
- **Panel lateral "Estatus" (1/3):**
  - Mensaje inicial: "Actualiza un contrato para ver el resumen de logistica."
  - Tras guardar: pills con contrato #, estado logistico, "Fecha cierta acreditada" si aplica.
  - Detalle: modalidad, cita, lugar, fedatario, instrumento, fecha, enlace "Ver testimonio", responsable, contacto, notas.
  - Timestamp de ultima actualizacion.

**Manual de operacion:**

1. Capturar el ID del contrato generado previamente.
2. Seleccionar la modalidad de firma (notarial para fecha cierta probatoria).
3. Definir estado logistico y fecha/lugar de cita.
4. Si se requiere fecha cierta: marcar el checkbox, capturar fedatario, numero de instrumento, fecha de protocolizacion y URL del testimonio.
5. Para sello de tiempo digital: capturar proveedor, usar "Marcar ahora" para timestamp y registrar acuse/hash.
6. Guardar y verificar el panel de estatus lateral.
7. Adjuntar referencia al expediente digital.

---

### Razon de negocio

**Ruta:** `/dashboard/razon-negocio`

**Utilidad en la practica:**
Documentar y registrar las aprobaciones Art. 5-A por cada contrato con flujo secuencial de roles: Solicitante -> Responsable del area -> Compliance/Legal -> Fiscal -> Direccion. Garantiza trazabilidad de quien aprueba o rechaza.

**Contenido detallado de la pantalla:**

- **Encabezado "Razon de negocio — Aprobaciones Art. 5-A":**
  - Subtitulo: "Define la necesidad, monto esperado y registra quien autoriza cada contrato antes de ejecutar."
- **Panel lateral "Contratos — Selecciona un contrato":**
  - Listado scrollable de contratos con: nombre, proveedor, beneficio economico esperado.
  - Badge con total de contratos.
  - Contrato activo resaltado en verde.
- **Formulario "Registro — Nueva aprobacion":**
  - Informacion del contrato seleccionado (nombre y proveedor).
  - Indicador de proximo rol esperado (calculado automaticamente).
  - Mensaje de "flujo cerrado" cuando se aprueba o rechaza completamente.
  - Campos: Rol (Solicitante / Responsable del area / Compliance / Fiscal / Direccion), Estado (Pendiente / Aprobado / Rechazado), Evidencia (URL), Nombre aprobador, Correo, Comentarios (textarea).
  - Boton "Guardar aprobacion".
- **Tabla "Historial — Aprobaciones registradas":**
  - Subtitulo: "Queda constancia con rol, nombre y evidencia."
  - Columnas: Rol, Estado (badge con color), Aprobador (nombre + correo), Evidencia (enlace), Comentario, Fecha.
  - Badge con total de aprobaciones.
  - Mensaje vacio: "No hay aprobaciones registradas."

**Manual de operacion:**

1. Seleccionar el contrato del panel lateral.
2. El sistema indica automaticamente el proximo rol esperado en la cadena de aprobacion.
3. Capturar nombre y correo de quien aprueba/rechaza.
4. Adjuntar URL de evidencia (carpeta, correo o acta).
5. Registrar comentario si aplica.
6. Guardar la aprobacion. El historial se actualiza inmediatamente.
7. Continuar con el siguiente rol hasta completar el flujo.
8. Si alguien rechaza, el flujo se cierra y no permite mas pasos.

---

## EJECUCION

### Operaciones

**Ruta:** `/dashboard/operaciones`

**Utilidad en la practica:**
Trazabilidad completa de entregables por operacion: programar, subir evidencia, firmar recepcion y avanzar estados (Pendiente -> En proceso -> Entregado -> Recibido -> Facturado). Detecta conceptos CFDI genericos y sugiere descripciones mejoradas.

**Contenido detallado de la pantalla:**

- **Encabezado "Operaciones — Trazabilidad de entregables":**
  - Subtitulo: "Lista operaciones, agrega entregables y liga evidencia para avanzar a Entregado / Recibido."
- **Panel lateral "Operaciones — Selecciona una operacion":**
  - Tarjetas por operacion: proveedor, fecha, contrato, monto (formato moneda), tipo de operacion.
  - Seccion "Concepto CFDI" con deteccion de concepto generico: badge "Concepto generico" (ambar) y boton "Aplicar sugerencia" para corregirlo.
- **Formulario "Nuevo entregable — Programar entregable":**
  - Subtitulo: "Usa un requisito sugerido o captura un entregable manual con fecha compromiso."
  - Info del proveedor y monto de la operacion seleccionada.
  - Selector "Requisito sugerido" (catalogo de entregables estandar).
  - Campos: Titulo, Descripcion (textarea), Fecha compromiso, Requerido (Si/Opcional), Codigo, Tipo de gasto (CapEx, OpEx, viaticos...), Orden de compra, Fecha OC, URL de evidencia, Comentarios.
  - Boton "Agregar entregable".
- **Tabla "Seguimiento — Entregables de la operacion":**
  - Subtitulo: "Sube la evidencia y marca el estado a Entregado / Recibido."
  - Columnas: Titulo (con codigo y descripcion), Compromiso (fecha + badge "Vencido" si aplica), Evidencia/firma (campos inline para URL y datos de recepcion), Estado (badge con color), Acciones (botones para avanzar estado).
  - Estados con flujo: PENDIENTE -> EN_PROCESO -> ENTREGADO -> RECIBIDO -> FACTURADO.
  - Validaciones: evidencia requerida para Entregado/Recibido, nombre+correo requeridos para Recibido.

**Manual de operacion:**

1. Seleccionar la operacion en el panel lateral.
2. Si el concepto CFDI es generico, aplicar la sugerencia con un clic.
3. Agregar entregables usando requisitos del catalogo o captura manual.
4. Para cada entregable: subir la URL de evidencia, capturar datos de orden de compra si aplica.
5. Avanzar estado: Pendiente -> En proceso -> Entregado (requiere evidencia) -> Recibido (requiere firma: nombre y correo) -> Facturado.
6. Monitorear fechas de compromiso y atender entregables vencidos.

---

## FISCAL Y FINANCIERO

### Validador CFDI/SPEI

**Ruta:** `/dashboard/validador`

**Utilidad en la practica:**
Verificar comprobantes fiscales (UUID CFDI) y pagos (referencia SPEI) en un solo paso para detectar inconsistencias antes de que se conviertan en contingencias fiscales.

**Contenido detallado de la pantalla:**

- **Encabezado "Validador — CFDI / SPEI":**
  - Subtitulo: "Verifica UUID de CFDI y referencia SPEI en un solo paso."
- **Formulario de validacion (ancho mayor):**
  - Campos: UUID CFDI, Referencia SPEI, Monto (opcional).
  - Boton "Validar".
- **Panel de resultado (ancho menor):**
  - Etiqueta "Resultado".
  - Badges de estatus: PENDIENTE (gris), VALIDO / VALIDADO (verde), INVALIDO (rojo), NO_ENCONTRADO (ambar).
  - Detalle: UUID, Referencia SPEI, Monto.
  - Si se vincula a operacion: "Guardado en operacion #[id]" (verde).
  - Mensaje inicial: "Ingresa datos y ejecuta la validacion."

**Manual de operacion:**

1. Capturar el UUID del CFDI y/o la referencia SPEI.
2. Opcionalmente indicar el monto para cruzar.
3. Pulsar "Validar".
4. Revisar los badges de estatus: si es INVALIDO o NO_ENCONTRADO, iniciar accion correctiva.
5. Si se vincula a una operacion, navegar a Operaciones para completar evidencia.

---

### Finanzas

**Ruta:** `/dashboard/finanzas`

**Utilidad en la practica:**
Bancarizacion completa: cuentas bancarias, estados de cuenta, movimientos con deteccion de operaciones circulares y alertas de capacidad, mas conciliacion automatica/manual con operaciones.

**Contenido detallado de la pantalla:**

- **Encabezado "Finanzas — Bancarizacion y conciliacion":**
  - Subtitulo: "Adjunta cuentas, estados, movimientos y monitorea conciliaciones con alertas."
  - Badge: "[N] conciliaciones registradas".
- **Panel "Cuentas — Bancarizacion" (columna 1):**
  - Listado de cuentas: alias, banco, moneda, CLABE.
  - Formulario "Nueva cuenta": alias, banco, numero de cuenta, CLABE, moneda (MXN/USD/EUR), titular. Boton "Crear cuenta".
- **Panel "Evidencia — Estados y movimientos" (columna 2):**
  - Formulario "Nuevo estado de cuenta": periodo inicio, periodo fin, URL del estado (PDF), saldo inicial, saldo final. Boton "Guardar estado".
  - Formulario "Nuevo movimiento": fecha, monto, tipo (Abono/Cargo), referencia, descripcion, referencia SPEI, cuenta contraparte, banco contraparte, nombre contraparte, categoria. Boton "Registrar movimiento".
  - Filtros: fecha desde/hasta, monto min/max, ref SPEI. Boton "Aplicar".
  - Tabla de movimientos: Fecha, Monto, Tipo, SPEI, Circular (badge ambar si es circular), Alerta cap. (badge rojo si hay alerta).
- **Panel "Conciliaciones — Auto / manual" (columna 3):**
  - Boton "Refrescar".
  - Tarjetas de conciliacion: operacion #, movimiento #, estado (AUTO verde / MANUAL azul / RECHAZADA rojo / PENDIENTE ambar), montos, confianza, comentario.
  - Formulario inline por conciliacion: selector de estado, campo de confianza (0-1), textarea de comentario. Boton "Guardar cambios".

**Manual de operacion:**

1. Crear la cuenta bancaria con alias, banco, CLABE y moneda.
2. Cargar estados de cuenta con periodos y saldos.
3. Registrar movimientos individuales (abonos y cargos).
4. El sistema detecta automaticamente operaciones circulares y alerta de capacidad.
5. Revisar conciliaciones: las AUTO son match automatico; las PENDIENTE requieren revision manual.
6. Ajustar estado, confianza y comentario en cada conciliacion.
7. Usar filtros para encontrar movimientos especificos por fecha, monto o referencia SPEI.

---

### Comparador de precios

**Ruta:** `/dashboard/comparador-precios`

**Utilidad en la practica:**
Evaluar precios de multiples proveedores contra un mismo concepto, identificar la mejor opcion y calcular ahorros vs. promedio para sustentar decisiones de compra.

**Contenido detallado de la pantalla:**

- **Encabezado "Compras — Comparador de precios":**
  - Subtitulo: "Carga cotizaciones de proveedores y obten la mejor opcion con ahorros calculados."
- **Formulario de comparacion:**
  - Campo "Concepto" (ej. "Servicio de auditoria, equipo de computo").
  - Filas de cotizacion (minimo 2): Proveedor, Descripcion, Precio, Moneda (MXN/USD/EUR).
  - Boton "+ Anadir cotizacion" para agregar filas.
  - Boton "Comparar".
- **Panel de resultado:**
  - Badges: "Mejor: [proveedor] ([precio] [moneda])" y "Peor: [proveedor]".
  - Valor destacado: "Ahorro vs. promedio: $[monto] [moneda]".
  - Diferencia porcentual entre mejor y peor.
  - Grid de items ordenados: proveedor, descripcion, precio, moneda.
  - Mensaje inicial: "Carga al menos dos cotizaciones y ejecuta la comparacion."

**Manual de operacion:**

1. Describir el concepto que se esta comparando.
2. Capturar al menos dos cotizaciones con proveedor, descripcion, precio y moneda.
3. Pulsar "Comparar".
4. Revisar la mejor opcion, el ahorro vs. promedio y la diferencia porcentual.
5. Guardar el resultado como evidencia para el expediente o contrato.

---

## EVIDENCIA Y CUMPLIMIENTO

### Expedientes digitales

**Ruta:** `/dashboard/expedientes`

**Utilidad en la practica:**
Centralizar la evidencia documental consolidada: contratos, CFDI y evidencias por operacion. Cada expediente cerrado genera un enlace de descarga.

**Contenido detallado de la pantalla:**

- **Encabezado "Materialidad — Expedientes digitales":**
  - Subtitulo: "Aqui veras los expedientes consolidados de contratos, CFDI y evidencias por operacion."
- **Listado de expedientes:**
  - Tarjetas con: titulo, estado y enlace "Ver expediente" (si disponible).
  - Mensaje vacio: "Aun no hay expedientes generados. Cuando cierres un expediente completo aparecera aqui con su enlace de descarga."

**Manual de operacion:**

1. Los expedientes se generan automaticamente al cerrar ciclos completos de contratacion + operacion + validacion.
2. Revisar periodicamente si hay expedientes nuevos disponibles.
3. Descargar el expediente usando el enlace proporcionado.
4. Verificar completitud del expediente antes de auditorias.

---

### Checklist

**Ruta:** `/dashboard/checklists`

**Utilidad en la practica:**
Controlar entregables por tipo de gasto y pilar de cumplimiento. Permite crear checklists con tareas, responsables, fechas de vencimiento y avance por estados. Incluye catalogo de entregables reutilizable.

**Contenido detallado de la pantalla:**

- **Encabezado "Checklist — Pilares de cumplimiento":**
  - Subtitulo: "Controla entregables por gasto y marca avance por pilar."
- **Formulario "Nuevo checklist" (columna principal):**
  - Campos: Nombre, Tipo de gasto (opcional).
  - Bloque "Catalogo de entregables":
    - Formulario para crear entregables en el catalogo: tipo de gasto, codigo, titulo, pilar (selector con pilares definidos), descripcion, checkbox "Requerido".
    - Boton "Guardar en catalogo".
    - Listado de entregables filtrados por tipo de gasto, con boton "Anadir al checklist" por cada uno.
  - Tareas del checklist (agregables):
    - Por tarea: Pilar (selector), Titulo, Descripcion (textarea), Responsable, Fecha de vencimiento.
    - Boton "+ Anadir tarea".
  - Boton "Crear checklist".
- **Panel lateral "Pilares":** lista de los pilares de cumplimiento disponibles (ENTREGABLES, etc.).
- **Listado de checklists existentes:**
  - Tarjetas con: nombre, tipo de gasto, badge de progreso "[completados]/[total] completado".
  - Tareas individuales con: titulo, pilar, responsable, fecha de vencimiento, selector de estado inline (PENDIENTE / EN_PROCESO / COMPLETO / NO_APLICA), descripcion.

**Manual de operacion:**

1. Crear un checklist nuevo con nombre y tipo de gasto.
2. Buscar entregables en el catalogo y anadirlos al checklist con un clic.
3. Agregar tareas manuales si se necesitan elementos fuera del catalogo.
4. Definir responsable y fecha de vencimiento para cada tarea.
5. Guardar el checklist.
6. Conforme se avanza, cambiar el estado de cada tarea (PENDIENTE -> EN_PROCESO -> COMPLETO).
7. Monitorear el badge de progreso para verificar completitud.
8. Para nuevos tipos de gasto, primero agregar entregables al catalogo para reutilizarlos.

---

### Alertas ESG

**Ruta:** `/dashboard/alertas`

**Utilidad en la practica:**
Monitorear riesgos e incidencias ambientales, sociales y de gobernanza detectados en el cliente.

**Contenido detallado de la pantalla:**

- **Encabezado "ESG — Alertas ESG":**
  - Subtitulo: "Riesgos e incidencias ambientales, sociales y de gobernanza detectadas en el cliente."
- **Listado de alertas:**
  - Tarjetas con: titulo, nivel (BAJO / MEDIO / ALTO con badge), detalle.
  - Mensaje vacio: "No hay alertas activas. Cuando se detecten riesgos ESG apareceran aqui."

**Manual de operacion:**

1. Revisar periodicamente si se han generado alertas.
2. Priorizar alertas de nivel ALTO.
3. Asignar responsable y documentar acciones correctivas.
4. Dar seguimiento hasta la resolucion.

---

## LEGAL E IA

### Consulta legal

**Ruta:** `/dashboard/consultas`

**Utilidad en la practica:**
Motor de consulta legal inteligente con IA. Permite formular hipotesis fiscales y legales, obtener diagnosticos sustentados en ley vigente con referencias exactas (ley, articulo, fraccion) y conservar historial completo de consultas.

**Contenido detallado de la pantalla:**

- **Encabezado "Despacho Conversacional — Consulta Legal Inteligente":**
  - Subtitulo: "Analisis legal y fiscal con inteligencia de precision basado en tu compendio normativo."
- **Panel lateral (columna izquierda, 4/12):**
  - Seccion "Nueva Consulta — Configurar Parametria":
    - Subtitulo: "Define tu hipotesis legal y contexto operativo."
    - Textarea "Planteamiento Tecnico" con placeholder: "Ej. Como acreditar materialidad en servicios de consultoria 2026?"
    - Campo "Contexto de la Operacion" con placeholder: "Giro, situacion o monto..."
    - Selector "Base de Datos": todas las leyes o ley especifica (catalogo dinamico de leyes disponibles).
    - Selector "Profundidad": 3 / 5 / 10 / 15 / 20 referencias.
    - Boton "ANALIZAR PROTOCOLO" (con icono Send). Atajo: Cmd+Enter.
  - Seccion "Consultas Recientes" (historial scrollable):
    - Tarjetas con fecha, pregunta (truncada), indicador de seleccion (punto verde).
    - Boton de eliminar (icono Trash2) por consulta con confirmacion.
- **Area principal (columna derecha, 8/12):**
  - Encabezado de respuesta "Diagnostico Autorizado":
    - Pregunta completa como titulo.
    - Badges: fecha/hora, ID, "Respuesta Verificada" (verde).
    - Boton "Imprimir" (genera version imprimible en CSS).
  - Cuerpo de la respuesta:
    - Contenido renderizado en Markdown con prose styling.
    - Si la respuesta contiene "error": panel de "Incidencia Tecnica Detectada" con mensaje del motor y guia para resolver (verificar API keys).
  - Footer informativo: algoritmo utilizado, badge "Sustentado en Ley Vigente".
  - Seccion "Fuentes de la Biblioteca":
    - Grid de tarjetas de referencia: badge "Referencia [N]", enlace externo (si hay URL), ley, articulo, fraccion (badges verdes), extracto o resumen en cuadro oscuro.
    - Mensaje vacio: "Sin referencias adicionales indexadas."
  - Estado vacio (sin consulta seleccionada): "Esperando parametros — Define tu planteamiento fiscal para desplegar el diagnostico legal estructurado."

**Manual de operacion:**

1. Redactar la pregunta o hipotesis legal/fiscal en el textarea "Planteamiento Tecnico".
2. Agregar contexto operativo (giro, monto, situacion) para mayor precision.
3. Opcionalmente filtrar por ley especifica y ajustar profundidad de referencias.
4. Pulsar "ANALIZAR PROTOCOLO" o usar Cmd+Enter.
5. Revisar el diagnostico renderizado en la columna principal.
6. Consultar las fuentes de la biblioteca para verificar sustento legal.
7. Usar "Imprimir" para generar version en papel si se requiere.
8. Las consultas quedan en el historial para referencia futura. Eliminar las que ya no apliquen.

---

## ADMINISTRACION

### Organizaciones

**Ruta:** `/dashboard/admin/organizaciones` — **Solo superusuarios**

**Utilidad en la practica:**
Administrar despachos contables y grupos corporativos con sus tenants asociados. Es la vista de gestion multi-organizacion del sistema.

**Contenido detallado de la pantalla:**

- **Encabezado "Administracion de Organizaciones":**
  - Subtitulo: "Gestiona despachos contables y grupos corporativos."
- **Mensaje de error de autenticacion:** si el token es obsoleto, panel con instrucciones paso a paso para cerrar sesion y volver a entrar con token actualizado. Boton "Cerrar Sesion y Volver a Entrar".
- **Tarjetas de estadisticas:** total despachos, total corporativos, total tenants.
- **Barra de busqueda y filtros:** buscar por nombre o correo, filtro por tipo (Todos / Despacho / Corporativo).
- **Listado de organizaciones:** tarjetas o tabla con nombre, tipo, contacto, total de tenants, estado.
- **Acciones:** crear nueva organizacion, editar, eliminar (con confirmacion), ver detalle.

**Manual de operacion:**

1. Revisar el listado de organizaciones y sus estadisticas.
2. Usar la busqueda para ubicar una organizacion especifica.
3. Filtrar por tipo (Despacho / Corporativo) segun necesidad.
4. Crear nueva organizacion si se incorpora un despacho o corporativo.
5. Dentro del detalle, gestionar tenants asociados.
6. Eliminar solo con confirmacion y despues de verificar que no haya datos activos.

---

### Administracion

**Ruta:** `/dashboard/administracion` — **Solo staff**

**Utilidad en la practica:**
Centro de control del cliente: gestion de usuarios (crear, editar, eliminar, permisos) y configuracion del proveedor de IA que impulsa las automatizaciones legales.

**Contenido detallado de la pantalla:**

- **Encabezado "Centro de control — Administracion del cliente":**
  - Subtitulo: "Gestiona accesos de usuarios y define que proveedor de IA impulsa las automatizaciones legales."
  - Tarjetas: "Usuarios activos", "Administradores", "Usuarios inactivos".
- **Tabs: "Usuarios" | "Configuracion del Proveedor IA".**
- **Tab "Usuarios":**
  - Panel "Cuentas activas — [N] usuarios en el cliente":
    - Boton "Refrescar".
    - Listado de usuarios: nombre, correo, badges (Activo verde / Inactivo gris / Admin ambar).
    - Botones por usuario: "Editar" y "Eliminar" (con confirmacion).
  - Panel "Nuevo acceso — Invitar usuario" (o "Editar usuario"):
    - Campos: Correo corporativo, Nombre completo, Contrasena temporal (min 8 chars para nuevo, opcional al editar).
    - Checkboxes: "Activo en el cliente", "Acceso de administracion".
    - Botones: "Crear usuario" / "Actualizar" y "Cancelar" (si edita).
- **Tab "Configuracion del Proveedor IA":**
  - Encabezado "Proveedor IA — Orquestacion de modelos".
  - Badge: "API Key almacenada" (verde) o "Falta API Key" (ambar).
  - Ultima actualizacion con timestamp.
  - Selector de proveedor con tarjetas descriptivas por cada opcion.
  - Campo "API Key" (password, opcional si ya hay una almacenada).
  - Boton "Guardar configuracion".

**Manual de operacion:**

1. En tab "Usuarios": revisar el directorio y verificar que los accesos son correctos.
2. Para invitar un usuario: completar correo, nombre, contrasena y definir si es admin.
3. Para editar: ajustar permisos o datos y guardar. Dejar contrasena en blanco para conservar la actual.
4. Para eliminar: confirmar la accion. El usuario perdera acceso inmediatamente.
5. En tab "IA": seleccionar el proveedor de IA deseado.
6. Pegar el API Key si es la primera vez o si se quiere rotar.
7. Guardar configuracion. El badge confirmara "API Key almacenada".

---

### Auditoria

**Ruta:** `/dashboard/administracion/auditoria` — **Solo staff**

**Utilidad en la practica:**
Bitacora completa de acciones: quien crea, modifica o firma evidencias y contratos. Permite filtrar por accion, objeto, actor, rango de fechas y busqueda libre. Esencial para control interno y auditorias.

**Contenido detallado de la pantalla:**

- **Encabezado "Auditoria — Bitacora de acciones":**
  - Subtitulo: "Quien crea, modifica o firma evidencias/contratos."
  - Badge: "[N] eventos".
- **Panel de filtros:**
  - Selector "Accion": contrato_creado, contrato_actualizado, entregable_creado, entregable_actualizado (o Todas).
  - Campo "Objeto" (ej. materialidad.contrato).
  - Campo "ID del objeto".
  - Campo "Actor email".
  - Rango de fechas: "Desde" y "Hasta" (date pickers).
  - Campo de busqueda libre: "Buscar actor, accion u objeto".
  - Boton "Aplicar".
- **Tabla de resultados con paginacion:**
  - Columnas: Fecha, Accion, Objeto (tipo + ID + repr), Actor (nombre o email), Cambios (JSON truncado), IP.
  - Paginacion: "Anterior", pagina actual / total, "Siguiente".
  - Mensaje vacio: "Sin eventos".

**Manual de operacion:**

1. Definir filtros segun la busqueda: accion, objeto, actor o rango de fechas.
2. Pulsar "Aplicar" para ejecutar la busqueda.
3. Revisar los eventos en la tabla. La columna "Cambios" muestra el JSON de diferencias.
4. Navegar entre paginas si hay muchos resultados.
5. Exportar o capturar pantalla cuando se requiera evidencia para auditorias externas.
