# Guía rápida para Contador Público Autorizado 

## Propósito
Como CPA, necesitas evidenciar **razón de negocio**, **materialidad** y **fecha cierta** para proteger a tus clientes en auditorías SAT. "Materialidad Fiscal SaaS" te da plantillas, trazabilidad y un expediente probatorio por operación, aislado por usuario de la aplicación (tu despacho).

## Qué obtienes
- **Contratos blindados**: IA orientada a art. 5-A CFF, con campos de beneficio económico vs. fiscal y checklist de fecha cierta con fedatario.
- **Expediente de materialidad**: Operación + contrato + CFDI + evidencias (entregables, bitácoras, comunicaciones, fotos) con nivel (sin contrato, parcial, completa).
- **Validación de proveedores**: Flujos n8n para estatus SAT y alertas.
- **Dashboards ejecutivos**: Cobertura contractual, vencimientos, materialidad por operación y riesgos.
- **Congruencia contable (NIF)**: Registro de NIF aplicable (D-1 ingresos, C-6 propiedades, C-8 intangibles) y póliza contable que respalda la sustancia económica.

## Flujo típico para tu despacho
1) **Alta de usuario de la aplicación**: Se crea el entorno para tu despacho; cada cliente puede ser una empresa dentro de tu cuenta.
2) **Carga de catálogos**: Empresas (clientes), proveedores y plantillas relevantes (servicios, nómina, partes relacionadas).
3) **Genera contrato**: Selecciona plantilla, captura razón de negocio, beneficios económico/fiscal y marca si requiere fecha cierta. La IA devuelve borrador con controles de materialidad y pasos para notaría.
4) **Vincula operaciones**: Registra CFDI/operaciones y sube evidencias (entregables, bitácoras, fotos). El sistema asigna nivel de materialidad.
	Además captura NIF aplicable y póliza contable para alinear la forma jurídica con la sustancia económica.
5) **Monitorea**: Revisa dashboard; atiende brechas (operaciones sin contrato/evidencia, proveedores en riesgo, pólizas contables faltantes). Exporta expediente completo (contrato + referencias legales + evidencias + metadatos de fedatario + póliza contable).

## Qué cambia al ser usuario de la aplicación
- **Aislamiento**: Base de datos dedicada por usuario de la aplicación; tus clientes conviven dentro de tu entorno sin mezclar datos con otros despachos.
- **Control de acceso**: Usuarios de tu firma con permisos por empresa/proceso.
- **Personalización**: Plantillas y cláusulas curadas por industria; puedes versionar las tuyas.
- **Pilar financiero**: Campos NIF y póliza contable por operación para reforzar la defensa ante SAT.

## Checklist de adopción
- Crear tu usuario de la aplicación y a los usuarios del despacho.
- Cargar empresas y proveedores críticos.
- Definir plantillas base con campos obligatorios (razón de negocio, beneficio económico > fiscal, fecha cierta).
- Incluir NIF aplicable y ruta para póliza contable en operaciones críticas.
- Activar flujo de validación de proveedores (n8n).
- Configurar storage seguro para evidencias y contratos notariados.

## Beneficio para el CPA
- Respuesta ágil a invitaciones SAT con expediente completo en horas.
- Reducción de retrabajos: redlines y cláusulas sugeridas alineadas a fiscal.
- Narrativa consistente para dictámenes y papeles de trabajo: mismo set de contratos, evidencias y referencias legales en cada caso.
