# Descripción de la Aplicación: Materialidad Fiscal SaaS

## Visión General
"Materialidad Fiscal SaaS" es una plataforma integral diseñada para ayudar a empresas y despachos contables en México a gestionar y acreditar la **materialidad** de sus operaciones, un requisito crítico para la deducción de gastos y acreditamiento de impuestos ante el SAT. La aplicación centraliza la generación de contratos, la validación de proveedores y el resguardo de evidencia documental, utilizando Inteligencia Artificial para agilizar procesos legales y asegurar el cumplimiento normativo. Ahora incorpora controles explícitos de **razón de negocios** (art. 5-A CFF), gestión de **fecha cierta** con fedatario y un expediente de **evidencias** por operación.

## Arquitectura
La solución opera bajo un modelo **Multi-tenant** (múltiples inquilinos), donde cada cliente tiene su propio entorno aislado de datos.
- **Backend**: Desarrollado en Python con Django y Django REST Framework. Incluye router multitenant y nuevos endpoints para evidencias y contratos reforzados.
- **Frontend**: Construido con Next.js 14.
- **Base de Datos**: PostgreSQL (esquemas aislados por tenant).
- **IA**: Integración con LLMs (OpenAI) para generación y análisis legal.
- **Automatización**: Flujos de trabajo externos (n8n) para validaciones.
- **Finanzas/NIF**: Captura y trazabilidad del tratamiento contable sugerido (ej. NIF D-1, C-6, C-8) y póliza soporte por operación.

## Módulos Principales

### 1. Gestión de Empresas y Proveedores
- **Empresas**: Registro de la entidad fiscal (Tenant) con sus datos constitutivos.
- **Proveedores**: Catálogo de proveedores con validación de estatus ante el SAT.
- **Validación**: Flujos automatizados para verificar la situación fiscal de los proveedores.

### 2. Generación y Gestión de Contratos (Core)
El núcleo de la aplicación es la creación de soporte documental robusto.
- **Plantillas**: Catálogo de plantillas de contratos clasificadas por categoría (Compras, Ventas, Nómina, etc.) y tipo de empresa.
- **Generación con IA**: Asistente inteligente que redacta borradores de contratos basándose en plantillas y necesidades específicas descritas por el usuario, reforzando la **razón de negocios** (beneficio económico > beneficio fiscal) y recordando pasos para **fecha cierta**.
- **Herramientas de Revisión**:
    - **Redlines**: Análisis comparativo inteligente entre versiones de contratos para detectar cambios y riesgos.
    - **Sugerencia de Cláusulas**: Recomendaciones de cláusulas específicas basadas en el contexto del contrato.
- **Exportación**: Generación de documentos finales en formato Word (.docx) con citas legales y banderas para protocolización (fedatario, fecha cierta, número de instrumento, archivo notariado).

### 3. Operaciones y Materialidad
Vinculación de la realidad económica con el soporte legal.
- **Registro de Operaciones**: Captura de transacciones (compras, servicios) vinculadas a un proveedor y un contrato.
- **Evidencias de Materialidad**: Nuevo expediente por operación con tipos de evidencia (Entregable, Bitácora, Comunicación, Fotografía) y clasificación automática del nivel de materialidad (sin contrato, parcial, completa).
- **Validación**: Estado de validación de cada operación (Pendiente, Validado, Rechazado) para asegurar que cuenta con el soporte necesario (CFDI, Contrato, Entregables).
- **Tratamiento Contable (NIF)**: Registro de NIF aplicable, póliza contable y observaciones de sustancia económica vs forma jurídica.

### 4. Inteligencia Legal
- **Consultas Legales (Chat)**: Asistente tipo chat que permite a los usuarios realizar preguntas legales y recibir respuestas fundamentadas en el contexto de su empresa y la legislación vigente.
- **Fuentes Legales**: Base de datos de leyes, reglamentos y criterios del SAT para fundamentar los documentos.

### 5. Dashboard y Métricas
Tableros de control para visualizar el estado de cumplimiento:
- Cobertura contractual (porcentaje de operaciones con contrato).
- Contratos próximos a vencer.
- Proveedores pendientes de validación.
- Métricas de riesgo y nivel de materialidad por operación.
- Pilar financiero: seguimiento a NIF aplicable y pólizas cargadas por operación.

## Flujo de Operación Típico

1.  **Configuración Inicial**:
    - Se crea el Tenant para la empresa.
    - Se configuran los datos fiscales y legales de la empresa.

2.  **Registro de Proveedores**:
    - El usuario da de alta a sus proveedores.
    - El sistema (vía n8n) valida el estatus del proveedor ante el SAT.

3.  **Generación de Contrato**:
    - El usuario selecciona una plantilla (ej. "Prestación de Servicios").
    - Describe necesidades, **razón de negocio**, beneficios económico/fiscal y, si aplica, marca que requiere **fecha cierta**.
    - La IA genera un borrador reforzado con controles de materialidad y recordatorios de protocolización.
    - El usuario revisa, solicita cláusulas adicionales o ajustes mediante el asistente.
    - Se genera la versión definitiva y se exporta a Word con referencias legales y metadatos para fedatario.

4.  **Vinculación de Operaciones y Evidencias**:
    - Se registran operaciones relevantes (facturas/movimientos) y se vinculan al contrato.
    - Se cargan evidencias (entregables, bitácoras, comunicaciones, fotos) para acreditar materialidad.
    - El sistema muestra el nivel de materialidad (sin contrato, parcial, completa).

5.  **Monitoreo y Cumplimiento**:
    - El contador o auditor revisa el Dashboard para detectar brechas (operaciones sin contrato, proveedores de riesgo, materialidad incompleta).
    - Ante una auditoría, se descarga el expediente completo con narrativa legal, referencias, contrato notariado (si aplica) y evidencias.
