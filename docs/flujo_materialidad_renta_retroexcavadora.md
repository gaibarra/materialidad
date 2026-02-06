# Flujo completo de una operación para demostrar materialidad ante el SAT

**Caso de ejemplo:** renta de una retroexcavadora para limpieza de un terreno.

Este documento describe el **flujo completo** desde la idea de rentar hasta el cierre del expediente, incluyendo **evidencias mínimas**, **documentación fiscal** y **controles de razón de negocios**. Está pensado para que el expediente quede listo ante una revisión del SAT.

---

## 0) Datos base de la operación

Antes de iniciar, define y registra:

- **Empresa (cliente):** razón social, RFC, régimen fiscal, domicilio.
- **Proveedor (arrendador):** razón social, RFC, estatus SAT vigente.
- **Objeto de la operación:** limpieza de terreno con retroexcavadora.
- **Monto estimado:** renta, combustible, maniobras, operador.
- **Justificación operativa:** necesidad real del servicio (no fiscal).

**Evidencias mínimas:**
- Solicitud interna o requerimiento (correo o memo).
- Presupuesto inicial o cotizaciones.

**Sección en la aplicación:**
- `Empresas` (alta de la entidad fiscal).
- `Proveedores` (alta del arrendador).
- `Operaciones` (borrador o pre-registro de la operación).

**Guía de captura (breve):**
- En `Empresas`, registra razón social, RFC, régimen y domicilio.
- En `Proveedores`, registra RFC, razón social y estatus SAT.
- En `Operaciones`, crea una operación preliminar con objeto y monto estimado.

---

## 1) Idea y solicitud interna (inicio del expediente)

### 1.1 Solicitud del área usuaria

- Se documenta la necesidad: terreno con maleza/escombro, urgencia, impacto en operación.
- Se define el alcance: días de renta, horario, operador, maniobras.

**Evidencias:**
- Correo o memo firmado del área solicitante.
- Fotos del terreno “antes” (con fecha).
- Ubicación del predio (coordenadas o dirección).

**Sección en la aplicación:**
- `Operaciones` → `Evidencias`.

**Guía de captura (breve):**
- En la operación, adjunta evidencia tipo **Comunicación** (memo/correo) y **Fotografía**.
- Agrega ubicación y fechas en la descripción de la evidencia.

---

## 2) Análisis de razón de negocios (art. 5-A CFF)

Demostrar que el beneficio económico **supera** al beneficio fiscal.

- Impacto esperado (ej. habilitar uso del terreno, evitar sanciones, acelerar obra).
- Comparativo: costo de renta vs. costo de no hacerlo (paros, penalizaciones, oportunidad perdida).

**Evidencias:**
- Nota de razón de negocios firmada por responsable.
- Cálculo de costo/beneficio (tabla simple).

**Sección en la aplicación:**
- `Contratos` (campos de razón de negocios).
- `Operaciones` → `Notas` o `Evidencias`.

**Guía de captura (breve):**
- En el contrato, registra el **beneficio económico** y el **beneficio fiscal estimado**.
- Adjunta la nota y el cálculo como evidencia tipo **Documento**.

---

## 3) Validación del proveedor

- Verificar que el proveedor no esté en listas de EFOS.
- Validar situación fiscal (opinión de cumplimiento).

**Evidencias:**
- Constancia de situación fiscal.
- Opinión de cumplimiento SAT vigente.
- Captura de validación en sistema.

**Sección en la aplicación:**
- `Proveedores` → `Validación SAT`.

**Guía de captura (breve):**
- Sube constancia y opinión SAT al proveedor.
- Marca el estatus de validación y fecha de revisión.

---

## 4) Selección y contratación

### 4.1 Comparativo de proveedores

- Al menos 2–3 cotizaciones (si aplica).
- Criterios: precio, disponibilidad, ubicación, condiciones de pago.

**Evidencias:**
- Cotizaciones recibidas.
- Cuadro comparativo y decisión aprobada.

**Sección en la aplicación:**
- `Proveedores` → `Evidencias`.
- `Operaciones` → `Evidencias`.

**Guía de captura (breve):**
- Adjunta cotizaciones como evidencia **Documento**.
- Sube el cuadro comparativo y registra el proveedor elegido.

### 4.2 Contrato o orden de servicio

Se formaliza la relación con:

- Partes, objeto, vigencia, precio, penalidades, seguros.
- Especificación del equipo y operador.
- Lugar de prestación del servicio.

**Evidencias:**
- Contrato firmado o orden de servicio.
- Si aplica: **fecha cierta** (fedatario o firma electrónica válida).

**Sección en la aplicación:**
- `Contratos`.

**Guía de captura (breve):**
- Crea el contrato desde plantilla o carga el documento firmado.
- Captura vigencia, monto, proveedor y marca **fecha cierta** si aplica.

---

## 5) Programación y logística

- Cronograma de trabajo (días y horas).
- Registro de ingreso a predio (bitácora).

**Evidencias:**
- Calendario aprobado.
- Bitácora de acceso/servicio.

**Sección en la aplicación:**
- `Operaciones` → `Evidencias`.

**Guía de captura (breve):**
- Adjunta calendario como evidencia **Documento**.
- Registra bitácora como evidencia **Bitácora/Comunicación**.

---

## 6) Ejecución del servicio (materialidad en campo)

### 6.1 Durante la operación

- Registro de actividades diarias: horas de operación, tareas realizadas.
- Control del equipo: número de serie, placas o identificación.

**Evidencias:**
- Bitácora diaria firmada.
- Fotos y/o video con fecha y geolocalización.
- Evidencia del operador en sitio (lista de asistencia, credencial).

**Sección en la aplicación:**
- `Operaciones` → `Evidencias`.

**Guía de captura (breve):**
- Carga bitácora diaria y lista de asistencia.
- Adjunta fotos/videos como evidencia **Fotografía** o **Entregable**.

### 6.2 Entregables

- Resultado del servicio: terreno limpio, volumen retirado, etc.

**Evidencias:**
- Fotos “después”.
- Acta de entrega-recepción firmada.

**Sección en la aplicación:**
- `Operaciones` → `Evidencias`.

**Guía de captura (breve):**
- Sube el acta de entrega-recepción y fotos finales.
- Relaciona la evidencia con la operación específica.

---

## 7) Facturación y pagos

### 7.1 CFDI

- CFDI emitido por el proveedor con descripción correcta.
- Uso de CFDI y forma de pago consistentes con la operación.

**Evidencias:**
- XML y PDF del CFDI.
- Validación del CFDI en SAT.

**Sección en la aplicación:**
- `Operaciones` → `CFDI`.

**Guía de captura (breve):**
- Carga XML/PDF y registra UUID, uso y forma de pago.
- Guarda la validación SAT como evidencia.

### 7.2 Pago

- Transferencia bancaria o medio trazable.

**Evidencias:**
- Comprobante de pago (SPEI o estado de cuenta).
- Conciliación con factura.

**Sección en la aplicación:**
- `Operaciones` → `Pago/SPEI`.

**Guía de captura (breve):**
- Registra monto, fecha y referencia de pago.
- Adjunta SPEI/estado de cuenta y vincula al CFDI.

---

## 8) Registro contable y NIF

- Registro en póliza contable.
- Referencia a contrato, CFDI y evidencia.

**Evidencias:**
- Póliza contable.
- Relación de documentos anexos.

**Sección en la aplicación:**
- `Operaciones` → `NIF/Contabilidad`.

**Guía de captura (breve):**
- Captura la NIF aplicable y número de póliza.
- Adjunta la póliza y soportes como evidencia **Documento**.

---

## 9) Cierre del expediente de materialidad

Checklist final antes de operar con datos reales:

- [ ] Solicitud interna y justificación.
- [ ] Razón de negocios documentada.
- [ ] Proveedor validado.
- [ ] Contrato/orden firmada.
- [ ] Evidencias de ejecución (bitácora, fotos, acta).
- [ ] CFDI válido.
- [ ] Pago trazable.
- [ ] Póliza contable.

**Resultado:** expediente completo y defendible ante SAT.

**Sección en la aplicación:**
- `Operaciones` → `Estatus de validación`.
- `Dashboard` → `Métricas de materialidad`.

**Guía de captura (breve):**
- Marca la operación como **Validada** si cumple checklist.
- Verifica en dashboard que la materialidad sea **completa**.

---

## 10) Registro en la plataforma (Materialidad Fiscal SaaS)

En el sistema, el flujo se refleja en:

- **Empresas** → alta de la entidad fiscal.
- **Proveedores** → validación y estatus.
- **Contratos** → contrato/orden de servicio.
- **Operaciones** → registro de la renta con vínculo a contrato.
- **Evidencias** → fotos, bitácoras, actas, CFDI y pagos.

**Guía de captura (breve):**
- `Empresas`: alta y datos fiscales.
- `Proveedores`: RFC, validación y documentos SAT.
- `Contratos`: crear/cargar contrato y vigencia.
- `Operaciones`: vincular empresa + proveedor + contrato + monto.
- `Evidencias`: cargar archivos por tipo (Documento, Fotografía, Bitácora, Entregable).

**Dónde queda registrado:**
- Tablas principales: `materialidad_operacion`, `materialidad_contrato`, `materialidad_evidencia*`.
- Panel de métricas: cobertura contractual y nivel de materialidad.

---

## 11) Riesgos comunes y cómo mitigarlos

- **Factura sin contrato:** agregar orden de servicio y evidencia de ejecución.
- **Pago en efectivo:** sustituir por pago bancario trazable.
- **Proveedor irregular:** cambiar proveedor o regularizar antes de facturar.
- **Falta de evidencias:** levantar acta complementaria y recopilar fotos/bitácoras.

---

## 12) Resumen ejecutivo del caso

**Operación:** renta de retroexcavadora para limpieza de terreno.

**Materialidad demostrada si:**
- Hay necesidad real y justificada.
- Existe contrato u orden de servicio.
- Hay evidencia física de ejecución.
- CFDI válido y pago trazable.
- Registro contable correcto.

Con esto, la operación queda lista para trabajar con datos reales y resistir una revisión del SAT.
