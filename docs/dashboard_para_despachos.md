# Diseño del Dashboard para Despachos Contables

## Objetivo
Dar a cada despacho una vista ejecutiva (filtrada por su organización) que sintetice materialidad, cumplimiento fiscal y riesgos ESG por cliente, con accesos rápidos a validadores, contratos y evidencias. Los superusuarios pueden alternar despacho para operar varios corporativos.

## Principios de diseño
- **Enfoque en materialidad**: todo atajo lleva a evidencias, contratos y validaciones.
- **Acción inmediata**: accesos directos a generar contrato, validar CFDI/SPEI, subir evidencias o comparar precios.
- **Contexto visible**: se muestra despacho, cliente activo y usuario para evitar confusiones.
- **Estado al día**: métricas servidas desde el backend sin cachés manuales.
- **Multi-despacho seguro**: cada usuario ve solo sus clientes; los superusuarios pueden elegir el despacho al provisionar.

## Estructura general
- **Header**: "Materialidad 360°" con etiqueta de rol "Despacho", despacho activo, cliente activo y usuario.
- **Selector de despacho (solo superusuarios)**: alterna el contexto para provisión y monitoreo.
- **Sidebar “Command Center”**: navegación persistente a las funciones clave.
- **Contenido**: tarjetas y secciones según la ruta seleccionada.

## Secciones del Sidebar y razón de ser
1) **Inteligencia fiscal (home)**
   - KPIs: cobertura contractual, operaciones pendientes, vencimientos próximos.
   - Motivo: detectar rápido brechas de deducibilidad y priorizar acciones.

2) **Generador de contratos**
   - IA para redactar contratos con razón de negocio, fecha cierta y referencias legales.
   - Motivo: crear soporte documental homogéneo y sólido por tipo de gasto.

3) **Validador CFDI/SPEI**
   - Verifica CFDI y SPEI (estatus, coincidencia de monto y pago).
   - Motivo: acreditar correlación forma–fondo en cada operación.

4) **Firma y fecha cierta**
   - Agenda logística de firma (fedatario, instrumento, cita) y marca fecha cierta.
   - Motivo: cerrar el ciclo probatorio exigido por CFF y notaría.

5) **Comparador de precios**
   - Carga varias cotizaciones y calcula mejor/peor opción, ahorro y diferencia %.
   - Motivo: evidenciar precio de mercado y decisión razonable.

6) **Proveedores**
   - Catálogo con estatus SAT/69-B, riesgo fiscal e histórico de validaciones.
   - Motivo: due diligence continua y trazabilidad de alertas.

7) **Biblioteca legal**
   - Fuentes legales (leyes, reglamentos, criterios) versionadas y compartidas.
   - Motivo: fundamentar contratos y respuestas a auditorías.

8) **Consulta legal**
   - Chat de consultas con contexto del cliente y citas legales recuperadas.
   - Motivo: resolver dudas rápidas y documentar respuestas.

9) **Checklist**
   - Ítems por pilar: Entregables, Razón de negocio, Capacidad del proveedor, Fecha cierta.
   - Motivo: guiar al equipo para completar el expediente de materialidad.

10) **Alertas ESG**
    - (Placeholder) mostrará riesgos ambientales, sociales y de gobernanza detectados.
    - Motivo: integrar métricas ESG alineadas a auditorías y reportes.

11) **Expedientes digitales**
    - (Placeholder) listará expedientes consolidados por operación/contrato.
    - Motivo: entregar en un clic el dossier probatorio ante SAT o auditor.

12) **Administración** (solo staff / superusuarios)
   - Provisión de nuevos clientes, asociando automáticamente el despacho del usuario; los superusuarios pueden elegir otro despacho.
   - Gestión de usuarios y parámetros del despacho.
   - Motivo: operar internamente sin exponer funciones sensibles a usuarios finales.

## Métricas clave mostradas en dashboard
- Cobertura contractual (% de operaciones con contrato).
- Operaciones pendientes de validación.
- Contratos próximos a vencer.
- Proveedores sin validación SAT / 69-B.
- Monto validado MXN.
- Provisiones recientes por despacho (éxito/error) para monitorear despliegues.
- Conteo de clientes y usuarios por despacho para capacidad operativa.

## Flujo recomendado para un despacho
0. (Solo superusuario) Crear el despacho y asignar staff.
1. Provisionar el cliente: para staff se asocia automáticamente su despacho; superusuarios pueden elegir otro despacho.
2. Crear usuarios internos del despacho que atenderán al cliente.
3. Cargar proveedores y validar SAT/69-B.
4. Generar contrato con IA (razón de negocio, fecha cierta).
5. Registrar la operación y validar CFDI/SPEI.
6. Subir evidencias y completar el checklist por pilar.
7. Comparar precios cuando aplique (prueba de mercado).
8. Consolidar el expediente digital y atender alertas ESG.

## Estado actual
- Backend y frontend operativos; sidebar responde 200.
- Provisión multi-despacho habilitada (asociación automática al despacho del usuario, selector para superusuarios).
- Alertas ESG y Expedientes siguen como placeholder visual (sin datos) para evolución futura.

## Beneficio para despachos contables
- Respuesta rápida ante invitaciones y auditorías SAT con expediente completo.
- Homologación del criterio de materialidad y fecha cierta en todos los clientes.
- Evidencia de mercado y razonabilidad de precios para soportar deducibilidad.
- Navegación clara por cliente y módulo, lista para uso diario.
