"""
seed_deliverable_requirements.py
---------------------------------
Puebla el catálogo de entregables (DeliverableRequirement) con plantillas
profesionales derivadas de cada categoría de contrato.

Criterios NIF aplicados:
  - NIF C-6  (Propiedades, planta y equipo) → activos fijos
  - NIF C-8  (Activos intangibles) → licencias, marcas, software
  - NIF C-9  (Provisiones, contingencias y compromisos) → contratos marco, créditos
  - NIF D-1  (Ingresos por contratos con clientes) → contratos de venta/suministro
  - NIF D-3  (Beneficios a los empleados) → nómina, capital humano
  - NIF D-4  (Impuestos a la utilidad) → precios de transferencia, partes relacionadas
  - Boletín D-7 (Contratos de construcción) → obra a precio alzado
  - Principio de sustancia económica → toda operación exige demostrar
    que el bien/servicio fue REAL y que generó beneficio económico futuro.

Uso:
    cd /home/gaibarra/materialidad
    source .venv/bin/activate
    python backend/seed_deliverable_requirements.py

El script es IDEMPOTENTE: usa update_or_create por (tenant_slug, tipo_gasto, codigo).
"""

import os
import sys
import django

# ── Bootstrap Django ─────────────────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE_DIR)
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "materialidad_backend.settings")
django.setup()

from materialidad.models import DeliverableRequirement  # noqa: E402

# ── Catálogo de entregables por tipo de contrato ─────────────────────────────
#
# Estructura de cada entrada:
#   tipo_gasto  → clave del contrato al que corresponde (usada como filtro en UI)
#   codigo      → identificador corto único dentro del tipo_gasto (ej. SC-01)
#   titulo      → nombre claro del entregable
#   descripcion → qué demuestra, fundamento NIF/CFF
#   pillar      → ENTREGABLES | RAZON_NEGOCIO | CAPACIDAD_PROVEEDOR | FECHA_CIERTA
#   requerido   → True = sin esto el SAT puede rechazar la deducción

CATALOG = [

    # ═══════════════════════════════════════════════════════════════════════
    # BASE CORPORATIVA
    # ═══════════════════════════════════════════════════════════════════════
    {
        "tipo_gasto": "BASE_CORPORATIVA",
        "codigo": "BC-01",
        "titulo": "Acta constitutiva con apostilla o certificación notarial",
        "descripcion": "Acredita existencia legal de la contraparte. Requerida por Art. 27 CFF para confirmar representación legal válida al momento de firmar el contrato.",
        "pillar": "CAPACIDAD_PROVEEDOR",
        "requerido": True,
    },
    {
        "tipo_gasto": "BASE_CORPORATIVA",
        "codigo": "BC-02",
        "titulo": "Poder notarial vigente del firmante",
        "descripcion": "Confirma que quien suscribe tiene facultades suficientes. Sin este documento el contrato puede ser impugnable y la deducción rechazada (Art. 29-A CFF).",
        "pillar": "CAPACIDAD_PROVEEDOR",
        "requerido": True,
    },
    {
        "tipo_gasto": "BASE_CORPORATIVA",
        "codigo": "BC-03",
        "titulo": "Constancia de situación fiscal actualizada (máx. 3 meses)",
        "descripcion": "Valida RFC, régimen fiscal y domicilio fiscal ante el SAT. Obligatoria para verificar que el proveedor/cliente no esté en lista negra 69-B.",
        "pillar": "CAPACIDAD_PROVEEDOR",
        "requerido": True,
    },
    {
        "tipo_gasto": "BASE_CORPORATIVA",
        "codigo": "BC-04",
        "titulo": "Comprobante de domicilio fiscal (máx. 3 meses)",
        "descripcion": "Confirma dirección operativa real. Elemento de sustancia económica: el SAT coteja domicilios en visitas domiciliarias (Art. 44 CFF).",
        "pillar": "CAPACIDAD_PROVEEDOR",
        "requerido": True,
    },
    {
        "tipo_gasto": "BASE_CORPORATIVA",
        "codigo": "BC-05",
        "titulo": "Alta en el RFC o cédula de identificación fiscal",
        "descripcion": "Comprueba inscripción activa ante el SAT desde antes de la primera operación. Clave para desestimar presunción de inexistencia (Art. 69-B CFF).",
        "pillar": "CAPACIDAD_PROVEEDOR",
        "requerido": True,
    },
    {
        "tipo_gasto": "BASE_CORPORATIVA",
        "codigo": "BC-06",
        "titulo": "Estados financieros o declaración anual del ejercicio anterior",
        "descripcion": "Evidencia capacidad financiera real para ejecutar el contrato. Aplica NIF B-3 (Estado de resultado integral) y NIF B-4 (Estado de cambios en el capital contable).",
        "pillar": "CAPACIDAD_PROVEEDOR",
        "requerido": False,
    },

    # ═══════════════════════════════════════════════════════════════════════
    # CLIENTES — SUMINISTRO / COMPRAVENTA
    # ═══════════════════════════════════════════════════════════════════════
    {
        "tipo_gasto": "SUMINISTRO_CLIENTES",
        "codigo": "SC-01",
        "titulo": "Orden de compra firmada por el cliente",
        "descripcion": "Documento que origina la obligación de entrega. Bajo NIF D-1 el ingreso se reconoce cuando los riesgos y beneficios se transfieren al cliente; la OC acredita la instrucción formal.",
        "pillar": "ENTREGABLES",
        "requerido": True,
    },
    {
        "tipo_gasto": "SUMINISTRO_CLIENTES",
        "codigo": "SC-02",
        "titulo": "Remisión o nota de entrega firmada de recibido",
        "descripcion": "Confirma la transferencia física del bien y el momento de reconocimiento del ingreso (NIF D-1, criterio de transferencia de control). Es el documento más sólido ante una revisión de ingresos.",
        "pillar": "ENTREGABLES",
        "requerido": True,
    },
    {
        "tipo_gasto": "SUMINISTRO_CLIENTES",
        "codigo": "SC-03",
        "titulo": "Factura CFDI 4.0 con complemento de pago",
        "descripcion": "Comprobante fiscal que vincula ingreso y cobro. El SAT cruza el CFDI de ingreso con el CFDI de pago para validar el flujo completo (Art. 29-A CFF, regla 2.7.1.30 RMF).",
        "pillar": "ENTREGABLES",
        "requerido": True,
    },
    {
        "tipo_gasto": "SUMINISTRO_CLIENTES",
        "codigo": "SC-04",
        "titulo": "Comprobante de transferencia SPEI o estado de cuenta",
        "descripcion": "Demuestra flujo real de efectivo. Sin comprobante bancario el SAT puede presumir que la operación es simulada incluso con CFDI timbrado (Art. 69-B CFF).",
        "pillar": "ENTREGABLES",
        "requerido": True,
    },
    {
        "tipo_gasto": "SUMINISTRO_CLIENTES",
        "codigo": "SC-05",
        "titulo": "Lista de precios o cotización formal aceptada",
        "descripcion": "Sustenta que el precio pactado corresponde a valor de mercado. Relevante para precios de transferencia entre partes relacionadas y para auditorías de ingresos acumulables.",
        "pillar": "RAZON_NEGOCIO",
        "requerido": False,
    },
    {
        "tipo_gasto": "SUMINISTRO_CLIENTES",
        "codigo": "SC-06",
        "titulo": "Póliza contable del ingreso con referencia al CFDI",
        "descripcion": "Vincula el registro contable NIF B-1 (Efectivo y equivalentes) y NIF D-1 con el CFDI. Obligatoria para auditorías de estados financieros dictaminados.",
        "pillar": "ENTREGABLES",
        "requerido": False,
    },

    # ═══════════════════════════════════════════════════════════════════════
    # CLIENTES — SERVICIOS PROFESIONALES
    # ═══════════════════════════════════════════════════════════════════════
    {
        "tipo_gasto": "SERVICIOS_CLIENTES",
        "codigo": "SVC-01",
        "titulo": "Propuesta técnica y económica aprobada",
        "descripcion": "Define alcance, entregables y honorarios. Es el antecedente que justifica la necesidad del servicio (razón de negocio) y sustenta el reconocimiento del ingreso bajo NIF D-1.",
        "pillar": "RAZON_NEGOCIO",
        "requerido": True,
    },
    {
        "tipo_gasto": "SERVICIOS_CLIENTES",
        "codigo": "SVC-02",
        "titulo": "Informe de avance o reporte mensual de actividades",
        "descripcion": "Evidencia la ejecución real del servicio período a período. Bajo la Reforma 2026, sin informe de actividades el SAT puede presumir que el CFDI carece de sustancia económica.",
        "pillar": "ENTREGABLES",
        "requerido": True,
    },
    {
        "tipo_gasto": "SERVICIOS_CLIENTES",
        "codigo": "SVC-03",
        "titulo": "Minuta de reunión o bitácora de sesiones firmada",
        "descripcion": "Documenta las interacciones presenciales o virtuales que soportan el servicio. Es evidencia admisible ante el SAT en visita domiciliaria (Art. 48 CFF reformado).",
        "pillar": "ENTREGABLES",
        "requerido": True,
    },
    {
        "tipo_gasto": "SERVICIOS_CLIENTES",
        "codigo": "SVC-04",
        "titulo": "Acta de entrega-recepción firmada por el cliente",
        "descripcion": "Cierra el ciclo del servicio. Bajo NIF D-1 es el momento en que el ingreso se reconoce definitivamente porque el cliente acepta que el desempeño se satisfizo.",
        "pillar": "ENTREGABLES",
        "requerido": True,
    },
    {
        "tipo_gasto": "SERVICIOS_CLIENTES",
        "codigo": "SVC-05",
        "titulo": "Evidencia fotográfica o videoconferencias documentadas",
        "descripcion": "El Art. 48 CFF reformado 2026 admite fotografías y videos como evidencia en revisiones. Guarda capturas de pantalla de llamadas Zoom/Teams con fecha visible.",
        "pillar": "ENTREGABLES",
        "requerido": False,
    },
    {
        "tipo_gasto": "SERVICIOS_CLIENTES",
        "codigo": "SVC-06",
        "titulo": "Correos corporativos con instrucciones y aprobaciones",
        "descripcion": "Cadena de correos que demuestra la dirección y supervisión del servicio. Los correos con headers completos son admisibles como evidencia documental ante el SAT.",
        "pillar": "ENTREGABLES",
        "requerido": False,
    },

    # ═══════════════════════════════════════════════════════════════════════
    # CLIENTES — OBRA A PRECIO ALZADO (NIF Boletin D-7)
    # ═══════════════════════════════════════════════════════════════════════
    {
        "tipo_gasto": "CONTRATO_OBRA",
        "codigo": "OB-01",
        "titulo": "Proyecto ejecutivo o memoria descriptiva firmada",
        "descripcion": "Define alcance técnico de la obra. Boletín D-7 requiere que los contratos de construcción identifiquen claramente las estimaciones y los avances para reconocer el ingreso por grado de avance.",
        "pillar": "RAZON_NEGOCIO",
        "requerido": True,
    },
    {
        "tipo_gasto": "CONTRATO_OBRA",
        "codigo": "OB-02",
        "titulo": "Estimación de avance de obra autorizada (por período)",
        "descripcion": "Soporte periódico del reconocimiento de ingresos bajo Boletín D-7 (método de porcentaje de terminación). Cada estimación debe ir firmada por el supervisor del cliente.",
        "pillar": "ENTREGABLES",
        "requerido": True,
    },
    {
        "tipo_gasto": "CONTRATO_OBRA",
        "codigo": "OB-03",
        "titulo": "Bitácora de obra con registro diario de actividades",
        "descripcion": "Registro oficial obligatorio en contratos de obra. Acredita días trabajados, personal en sitio y avances físicos. Es la evidencia más sólida contra presunción de simulación.",
        "pillar": "ENTREGABLES",
        "requerido": True,
    },
    {
        "tipo_gasto": "CONTRATO_OBRA",
        "codigo": "OB-04",
        "titulo": "Fotografías geolocalizadas de avance físico (por semana)",
        "descripcion": "Evidencia visual con timestamp y geolocalización. El Art. 48 CFF reformado 2026 reconoce fotografías como evidencia en visitas domiciliarias. Subir a Drive con carpeta por semana.",
        "pillar": "ENTREGABLES",
        "requerido": True,
    },
    {
        "tipo_gasto": "CONTRATO_OBRA",
        "codigo": "OB-05",
        "titulo": "Licencias de construcción y permisos municipales",
        "descripcion": "Documentos gubernamentales que acreditan la legalidad de la obra. Sin permisos el SAT puede considerar que la obra no existe o es parcialmente simulada.",
        "pillar": "CAPACIDAD_PROVEEDOR",
        "requerido": True,
    },
    {
        "tipo_gasto": "CONTRATO_OBRA",
        "codigo": "OB-06",
        "titulo": "Acta de entrega de obra y pruebas de funcionamiento",
        "descripcion": "Cierra el contrato. Bajo Boletín D-7 es el momento del reconocimiento final del ingreso. Debe incluir punch list cerrado y firma del cliente.",
        "pillar": "ENTREGABLES",
        "requerido": True,
    },

    # ═══════════════════════════════════════════════════════════════════════
    # PROVEEDORES — SUMINISTRO DE BIENES
    # ═══════════════════════════════════════════════════════════════════════
    {
        "tipo_gasto": "SUMINISTRO_PROVEEDORES",
        "codigo": "SP-01",
        "titulo": "Orden de compra interna autorizada",
        "descripcion": "Documento que origina el gasto internamente. Demuestra proceso de autorización previo a la erogación; clave para acreditar sustancia económica y beneficio económico futuro (NIF A-2).",
        "pillar": "RAZON_NEGOCIO",
        "requerido": True,
    },
    {
        "tipo_gasto": "SUMINISTRO_PROVEEDORES",
        "codigo": "SP-02",
        "titulo": "Remisión del proveedor con sello de recibido en almacén",
        "descripcion": "Acredita la recepción física del bien en el domicilio fiscal. Es la evidencia de transferencia de riesgos y beneficios requerida por NIF C-4 (Inventarios) o NIF C-6 (PPE).",
        "pillar": "ENTREGABLES",
        "requerido": True,
    },
    {
        "tipo_gasto": "SUMINISTRO_PROVEEDORES",
        "codigo": "SP-03",
        "titulo": "CFDI 4.0 del proveedor con descripción específica (no genérica)",
        "descripcion": "El concepto CFDI debe coincidir con lo pactado en contrato y remisión. Conceptos genéricos como 'servicios' o 'materiales' activan el algoritmo de conceptos genéricos del SAT (regla 2.7.1.9 RMF).",
        "pillar": "ENTREGABLES",
        "requerido": True,
    },
    {
        "tipo_gasto": "SUMINISTRO_PROVEEDORES",
        "codigo": "SP-04",
        "titulo": "Transferencia SPEI con referencia al CFDI",
        "descripcion": "El SPEI debe referenciar el folio fiscal del CFDI en el campo de concepto. Esto cierra el triángulo CFDI-SPEI-Contrato que el SAT valida con su sistema de análisis de riesgos.",
        "pillar": "ENTREGABLES",
        "requerido": True,
    },
    {
        "tipo_gasto": "SUMINISTRO_PROVEEDORES",
        "codigo": "SP-05",
        "titulo": "Tarjeta de entrada a almacén (kárdex) o movimiento en WMS",
        "descripcion": "Registro del bien en sistema de inventarios. NIF C-4 exige que los inventarios se reconozcan cuando los riesgos y beneficios se transfieren. El kárdex es la evidencia contable del ingreso al inventario.",
        "pillar": "ENTREGABLES",
        "requerido": False,
    },
    {
        "tipo_gasto": "SUMINISTRO_PROVEEDORES",
        "codigo": "SP-06",
        "titulo": "Póliza contable de compras con referencia CFDI",
        "descripcion": "Vincula el registro en NIF C-4 (Inventarios) o directamente a gasto con el CFDI. Obligatoria para dictamen fiscal y revisión de saldos de proveedores (NIF C-19).",
        "pillar": "ENTREGABLES",
        "requerido": False,
    },

    # ═══════════════════════════════════════════════════════════════════════
    # PROVEEDORES — SERVICIOS ESPECIALIZADOS
    # ═══════════════════════════════════════════════════════════════════════
    {
        "tipo_gasto": "SERVICIOS_PROVEEDORES",
        "codigo": "SV-01",
        "titulo": "Propuesta técnica y económica del proveedor aprobada internamente",
        "descripcion": "Demuestra que existió un proceso de selección y aprobación previo. Es la razón de negocio documentada que justifica el gasto bajo el principio de beneficio económico futuro (NIF A-2, Marco Conceptual).",
        "pillar": "RAZON_NEGOCIO",
        "requerido": True,
    },
    {
        "tipo_gasto": "SERVICIOS_PROVEEDORES",
        "codigo": "SV-02",
        "titulo": "Informe de resultados o reporte de actividades entregado",
        "descripcion": "Evidencia que el servicio se prestó efectivamente. Bajo la Reforma 2026 (Art. 69-B CFF), la ausencia de un informe concreto es señal de alerta de EFOS (emisión de facturas por operaciones simuladas).",
        "pillar": "ENTREGABLES",
        "requerido": True,
    },
    {
        "tipo_gasto": "SERVICIOS_PROVEEDORES",
        "codigo": "SV-03",
        "titulo": "Lista de asistencia o control de accesos del personal del proveedor",
        "descripcion": "Registros de entrada/salida del personal que ejecutó el servicio en tus instalaciones. Son evidencia física de presencia del proveedor; los guarda seguridad o control de accesos los pueden certificar.",
        "pillar": "ENTREGABLES",
        "requerido": False,
    },
    {
        "tipo_gasto": "SERVICIOS_PROVEEDORES",
        "codigo": "SV-04",
        "titulo": "Acta de entrega-recepción del servicio firmada",
        "descripcion": "Cierra el ciclo del gasto. Es el documento que acredita la satisfacción del desempeño contratado y habilita el registro del gasto como deducible bajo Art. 25 LISR.",
        "pillar": "ENTREGABLES",
        "requerido": True,
    },
    {
        "tipo_gasto": "SERVICIOS_PROVEEDORES",
        "codigo": "SV-05",
        "titulo": "Validación 69-B del RFC del proveedor (captura o reporte)",
        "descripcion": "Consulta al SAT (sat.gob.mx/69b) que confirma que el proveedor no está en lista negra de EFOS. Debe realizarse antes y después del pago. Guarda captura con fecha.",
        "pillar": "CAPACIDAD_PROVEEDOR",
        "requerido": True,
    },
    {
        "tipo_gasto": "SERVICIOS_PROVEEDORES",
        "codigo": "SV-06",
        "titulo": "Opinión de cumplimiento del IMSS e INFONAVIT (32-D CFF)",
        "descripcion": "Para contratos de servicios especializados y subcontratación REPSE. Art. 15-A LIMSS obliga a verificar que el prestador esté al corriente; de lo contrario el contratante es responsable solidario.",
        "pillar": "CAPACIDAD_PROVEEDOR",
        "requerido": False,
    },

    # ═══════════════════════════════════════════════════════════════════════
    # PROVEEDORES — ARRENDAMIENTO DE INMUEBLES
    # ═══════════════════════════════════════════════════════════════════════
    {
        "tipo_gasto": "ARRENDAMIENTO_INMUEBLES",
        "codigo": "AI-01",
        "titulo": "Escritura o título de propiedad del arrendador",
        "descripcion": "Acredita que el arrendador tiene titularidad para arrendar. Sin este documento el gasto puede no ser deducible por falta de sustancia en la contraparte (NIF C-6, NIF D-1).",
        "pillar": "CAPACIDAD_PROVEEDOR",
        "requerido": True,
    },
    {
        "tipo_gasto": "ARRENDAMIENTO_INMUEBLES",
        "codigo": "AI-02",
        "titulo": "CFDI 4.0 de arrendamiento con RFC del arrendatario y descripción del inmueble",
        "descripcion": "El CFDI debe incluir clave de producto 80141600 (Arrendamiento) y descripción exacta del inmueble (calle, número, municipio). Conceptos genéricos generan riesgo 69-B.",
        "pillar": "ENTREGABLES",
        "requerido": True,
    },
    {
        "tipo_gasto": "ARRENDAMIENTO_INMUEBLES",
        "codigo": "AI-03",
        "titulo": "Comprobante de uso efectivo del inmueble (foto con fecha, geolocalización)",
        "descripcion": "Demuestra que el inmueble se usó en la actividad empresarial. El SAT puede solicitar evidencia fotográfica de instalaciones en revisiones domiciliarias (Art. 48 CFF 2026).",
        "pillar": "ENTREGABLES",
        "requerido": True,
    },
    {
        "tipo_gasto": "ARRENDAMIENTO_INMUEBLES",
        "codigo": "AI-04",
        "titulo": "Recibos de servicios del inmueble a nombre del arrendatario (luz, agua, internet)",
        "descripcion": "Refuerza la evidencia de uso real. Aplica el principio de sustancia sobre forma: si los recibos están a nombre del arrendatario confirma ocupación real del domicilio fiscal.",
        "pillar": "ENTREGABLES",
        "requerido": False,
    },
    {
        "tipo_gasto": "ARRENDAMIENTO_INMUEBLES",
        "codigo": "AI-05",
        "titulo": "Inventario o lista de activos en el inmueble arrendado",
        "descripcion": "Documenta los activos físicos presentes en el domicilio arrendado. Complementa la evidencia de uso productivo requerida para deducibilidad bajo Art. 27 fracción IV LISR.",
        "pillar": "ENTREGABLES",
        "requerido": False,
    },

    # ═══════════════════════════════════════════════════════════════════════
    # PROVEEDORES — ARRENDAMIENTO DE MAQUINARIA / VEHÍCULOS / TI
    # ═══════════════════════════════════════════════════════════════════════
    {
        "tipo_gasto": "ARRENDAMIENTO_MAQUINARIA",
        "codigo": "AM-01",
        "titulo": "Acta de entrega del bien arrendado con número de serie / placa",
        "descripcion": "Documenta la recepción física del activo. Bajo NIF D-5 (Arrendamientos) el arrendatario reconoce el derecho de uso del activo en el momento de la entrega; este documento es el soporte de dicho reconocimiento.",
        "pillar": "ENTREGABLES",
        "requerido": True,
    },
    {
        "tipo_gasto": "ARRENDAMIENTO_MAQUINARIA",
        "codigo": "AM-02",
        "titulo": "Bitácora de uso o reporte de horas máquina (por período)",
        "descripcion": "Registra el uso efectivo del activo en producción u operaciones. Acredita beneficio económico futuro real (NIF C-6 y D-5). Sin este registro el SAT puede cuestionar si el activo fue efectivamente usado.",
        "pillar": "ENTREGABLES",
        "requerido": True,
    },
    {
        "tipo_gasto": "ARRENDAMIENTO_MAQUINARIA",
        "codigo": "AM-03",
        "titulo": "Póliza de seguro del bien arrendado",
        "descripcion": "El contrato de arrendamiento normalmente obliga al arrendatario a asegurar el bien. La existencia del seguro confirma que el activo existe físicamente y está en operación.",
        "pillar": "ENTREGABLES",
        "requerido": False,
    },
    {
        "tipo_gasto": "ARRENDAMIENTO_MAQUINARIA",
        "codigo": "AM-04",
        "titulo": "Registro del bien en el REPUVE o en plataforma de gestión de activos",
        "descripcion": "Para vehículos: consulta REPUVE confirma existencia física. Para TI: registro en inventario de activos tecnológicos con número de serie y asignación al usuario.",
        "pillar": "CAPACIDAD_PROVEEDOR",
        "requerido": False,
    },

    # ═══════════════════════════════════════════════════════════════════════
    # PROVEEDORES — SUBCONTRATACIÓN REPSE
    # ═══════════════════════════════════════════════════════════════════════
    {
        "tipo_gasto": "SUBCONTRATACION_REPSE",
        "codigo": "RE-01",
        "titulo": "Número de registro REPSE vigente del prestador (STPS)",
        "descripcion": "Obligatorio bajo reforma laboral 2021 (Art. 15-B LFT). Sin registro REPSE vigente la subcontratación es ilegal y el gasto no es deducible. Verificar en repse.stps.gob.mx.",
        "pillar": "CAPACIDAD_PROVEEDOR",
        "requerido": True,
    },
    {
        "tipo_gasto": "SUBCONTRATACION_REPSE",
        "codigo": "RE-02",
        "titulo": "Copia de nómina del personal subcontratado timbrada (CFDI nómina)",
        "descripcion": "Demuestra que el prestador paga efectivamente a sus trabajadores. Art. 15-A LIMSS: el contratante es responsable solidario si el subcontratista no cumple con obligaciones patronales.",
        "pillar": "ENTREGABLES",
        "requerido": True,
    },
    {
        "tipo_gasto": "SUBCONTRATACION_REPSE",
        "codigo": "RE-03",
        "titulo": "Opinión de cumplimiento IMSS (32-D CFF) del prestador REPSE",
        "descripcion": "Confirma que el prestador está al corriente en cuotas IMSS. Debe obtenerse mensualmente durante la vigencia del contrato. El contratante que omita verificar responde solidariamente.",
        "pillar": "CAPACIDAD_PROVEEDOR",
        "requerido": True,
    },
    {
        "tipo_gasto": "SUBCONTRATACION_REPSE",
        "codigo": "RE-04",
        "titulo": "Informe mensual de actividades del personal subcontratado",
        "descripcion": "Describe las tareas específicas ejecutadas por el personal. Acredita la especialidad real del servicio y distingue la subcontratación legítima de la simple intermediación laboral prohibida.",
        "pillar": "ENTREGABLES",
        "requerido": True,
    },
    {
        "tipo_gasto": "SUBCONTRATACION_REPSE",
        "codigo": "RE-05",
        "titulo": "Acta de entrega-recepción mensual del servicio REPSE",
        "descripcion": "Cierra el ciclo mensual de la subcontratación. Debe incluir descripción de actividades completadas, personal involucrado y conformidad del área solicitante.",
        "pillar": "ENTREGABLES",
        "requerido": True,
    },

    # ═══════════════════════════════════════════════════════════════════════
    # CAPITAL HUMANO — SERVICIOS INDEPENDIENTES / HONORARIOS
    # ═══════════════════════════════════════════════════════════════════════
    {
        "tipo_gasto": "SERVICIOS_INDEPENDIENTES",
        "codigo": "HN-01",
        "titulo": "Contrato de prestación de servicios independientes firmado",
        "descripcion": "Define alcance, honorarios y ausencia de subordinación. Bajo NIF D-3 los honorarios asimilados son beneficios a empleados; su deducción requiere demostrar que no existe relación laboral encubierta.",
        "pillar": "RAZON_NEGOCIO",
        "requerido": True,
    },
    {
        "tipo_gasto": "SERVICIOS_INDEPENDIENTES",
        "codigo": "HN-02",
        "titulo": "Entregable específico del servicio (informe, código, diseño, dictamen)",
        "descripcion": "El producto tangible del servicio prestado. Sin entregable específico el SAT puede reclasificar los honorarios como sueldos y salarios o rechazar la deducción por falta de materialidad.",
        "pillar": "ENTREGABLES",
        "requerido": True,
    },
    {
        "tipo_gasto": "SERVICIOS_INDEPENDIENTES",
        "codigo": "HN-03",
        "titulo": "CFDI de honorarios con retención de ISR e IVA",
        "descripcion": "El comprobante debe tener las retenciones correctas (10% ISR, 2/3 de IVA si aplica). Errores en retenciones generan omisiones que invalidan la deducción bajo Art. 27 fracción XVIII LISR.",
        "pillar": "ENTREGABLES",
        "requerido": True,
    },
    {
        "tipo_gasto": "SERVICIOS_INDEPENDIENTES",
        "codigo": "HN-04",
        "titulo": "Comprobante de entero de retenciones al SAT (declaración mensual)",
        "descripcion": "Demuestra cumplimiento de obligaciones de retención. El retenedor que omita enterar las retenciones es responsable solidario del impuesto omitido (Art. 26 CFF).",
        "pillar": "ENTREGABLES",
        "requerido": False,
    },

    # ═══════════════════════════════════════════════════════════════════════
    # ACTIVOS — COMPRA DE MAQUINARIA Y EQUIPO (NIF C-6)
    # ═══════════════════════════════════════════════════════════════════════
    {
        "tipo_gasto": "COMPRA_MAQUINARIA",
        "codigo": "CM-01",
        "titulo": "Factura CFDI 4.0 del activo con número de serie y descripción técnica",
        "descripcion": "El CFDI debe identificar inequívocamente el bien: modelo, marca, número de serie. NIF C-6 requiere que el costo del activo sea medible confiablemente; el CFDI es el soporte principal de la medición.",
        "pillar": "ENTREGABLES",
        "requerido": True,
    },
    {
        "tipo_gasto": "COMPRA_MAQUINARIA",
        "codigo": "CM-02",
        "titulo": "Acta de recepción del activo con inspección técnica",
        "descripcion": "Documenta que el bien fue recibido en condiciones operativas y cumple especificaciones. NIF C-6 reconoce el activo cuando los beneficios económicos fluirán hacia la empresa y el costo puede medirse confiablemente.",
        "pillar": "ENTREGABLES",
        "requerido": True,
    },
    {
        "tipo_gasto": "COMPRA_MAQUINARIA",
        "codigo": "CM-03",
        "titulo": "Alta del activo en el sistema de control de activos fijos (póliza contable)",
        "descripcion": "Registro en NIF C-6 con vida útil, valor de desecho y método de depreciación. La póliza de alta vincula el CFDI con el activo en libros y es revisada en auditorías de activos fijos.",
        "pillar": "ENTREGABLES",
        "requerido": True,
    },
    {
        "tipo_gasto": "COMPRA_MAQUINARIA",
        "codigo": "CM-04",
        "titulo": "Fotografía del activo instalado en las instalaciones con fecha",
        "descripcion": "Evidencia física de que el activo existe y está en uso productivo. Complementa NIF C-6: la evidencia de uso es parte de la demostración de beneficio económico futuro.",
        "pillar": "ENTREGABLES",
        "requerido": True,
    },
    {
        "tipo_gasto": "COMPRA_MAQUINARIA",
        "codigo": "CM-05",
        "titulo": "Estudio de vida útil o dictamen técnico del activo",
        "descripcion": "Sustenta la vida útil y el método de depreciación elegido. NIF C-6 requiere que la vida útil sea estimada de manera técnica; sin sustento el SAT puede objetar el ritmo de deducción (Art. 34 LISR).",
        "pillar": "RAZON_NEGOCIO",
        "requerido": False,
    },

    # ═══════════════════════════════════════════════════════════════════════
    # ACTIVOS — LICENCIAS DE PI / SOFTWARE / MARCAS (NIF C-8)
    # ═══════════════════════════════════════════════════════════════════════
    {
        "tipo_gasto": "LICENCIA_PI",
        "codigo": "LP-01",
        "titulo": "Registro ante IMPI o copyright con número de expediente",
        "descripcion": "Acredita la existencia legal del activo intangible. NIF C-8 reconoce activos intangibles solo cuando es probable que generen beneficios económicos y el costo puede medirse confiablemente.",
        "pillar": "CAPACIDAD_PROVEEDOR",
        "requerido": True,
    },
    {
        "tipo_gasto": "LICENCIA_PI",
        "codigo": "LP-02",
        "titulo": "Contrato de licencia o cesión registrado ante el IMPI",
        "descripcion": "El registro ante IMPI da certeza jurídica a la licencia y sustenta la deducibilidad de las regalías (Art. 27 frac. VII LISR). Sin registro la deducción puede ser cuestionada.",
        "pillar": "ENTREGABLES",
        "requerido": True,
    },
    {
        "tipo_gasto": "LICENCIA_PI",
        "codigo": "LP-03",
        "titulo": "Estudio de royalties o análisis de precios de mercado (benchmarking)",
        "descripcion": "Sustenta que las regalías son a valor de mercado. Fundamental para partes relacionadas bajo Art. 179 LISR (precios de transferencia) y para evitar recaracterización del gasto.",
        "pillar": "RAZON_NEGOCIO",
        "requerido": False,
    },
    {
        "tipo_gasto": "LICENCIA_PI",
        "codigo": "LP-04",
        "titulo": "Evidencia de uso efectivo del software o marca en operaciones",
        "descripcion": "Screenshots, reportes de acceso, facturas de ventas que usan la marca. NIF C-8 exige que los beneficios económicos fluyan hacia la entidad; esta evidencia demuestra que la licencia genera valor real.",
        "pillar": "ENTREGABLES",
        "requerido": True,
    },

    # ═══════════════════════════════════════════════════════════════════════
    # FINANCIERO — CRÉDITO SIMPLE / APERTURA DE CRÉDITO
    # ═══════════════════════════════════════════════════════════════════════
    {
        "tipo_gasto": "CREDITO_SIMPLE",
        "codigo": "CR-01",
        "titulo": "Resolución de crédito o carta de autorización del banco",
        "descripcion": "Documento que formaliza las condiciones del crédito. Bajo NIF C-19 (Instrumentos financieros por pagar) el pasivo se reconoce cuando la entidad se convierte en parte del contrato financiero.",
        "pillar": "ENTREGABLES",
        "requerido": True,
    },
    {
        "tipo_gasto": "CREDITO_SIMPLE",
        "codigo": "CR-02",
        "titulo": "Tabla de amortización firmada y sellada por la institución financiera",
        "descripcion": "Sustenta el cálculo del interés devengado bajo el método de interés efectivo (NIF C-19). Sin esta tabla el registro contable de intereses puede ser incorrecto y generar diferencias con el SAT.",
        "pillar": "ENTREGABLES",
        "requerido": True,
    },
    {
        "tipo_gasto": "CREDITO_SIMPLE",
        "codigo": "CR-03",
        "titulo": "Estado de cuenta del crédito (por período)",
        "descripcion": "Conciliación entre el saldo contable NIF C-19 y el saldo bancario. Obligatoria en auditorías de estados financieros dictaminados y en revisiones de ISR por deducciones de intereses (Art. 25 frac. VII LISR).",
        "pillar": "ENTREGABLES",
        "requerido": True,
    },

    # ═══════════════════════════════════════════════════════════════════════
    # PARTES RELACIONADAS — SERVICIOS INTRAGRUPO
    # ═══════════════════════════════════════════════════════════════════════
    {
        "tipo_gasto": "SERVICIOS_INTRAGRUPO",
        "codigo": "IG-01",
        "titulo": "Estudio de precios de transferencia (Art. 179 LISR) actualizado",
        "descripcion": "Obligatorio cuando el monto de operaciones con partes relacionadas supera los umbrales. Debe demostrar que el precio pactado es comparable al de mercado (arm's length). NIF D-4 requiere revelaciones sobre partes relacionadas.",
        "pillar": "RAZON_NEGOCIO",
        "requerido": True,
    },
    {
        "tipo_gasto": "SERVICIOS_INTRAGRUPO",
        "codigo": "IG-02",
        "titulo": "Informe de actividades ejecutadas por la empresa prestadora",
        "descripcion": "Describe los servicios efectivamente prestados (gestión de tesorería, servicios IT, dirección comercial). El SAT exige sustancia en ambas partes: quien presta debe tener capacidad real y quien paga debe haber recibido el servicio.",
        "pillar": "ENTREGABLES",
        "requerido": True,
    },
    {
        "tipo_gasto": "SERVICIOS_INTRAGRUPO",
        "codigo": "IG-03",
        "titulo": "Política de precios de transferencia del grupo empresarial",
        "descripcion": "Documento maestro que define metodología y comparables. Bajo las reglas BEPS y Art. 179 LISR, la política escrita es evidencia de que las condiciones se pactaron a valor de mercado.",
        "pillar": "RAZON_NEGOCIO",
        "requerido": False,
    },
    {
        "tipo_gasto": "SERVICIOS_INTRAGRUPO",
        "codigo": "IG-04",
        "titulo": "Declaración informativa de operaciones con partes relacionadas (DIOT/DISIF)",
        "descripcion": "La omisión en la DIOT de operaciones con partes relacionadas genera multas. La DISIF (antes Declaración Informativa Múltiple) también exige revelar estas operaciones.",
        "pillar": "ENTREGABLES",
        "requerido": True,
    },

    # ═══════════════════════════════════════════════════════════════════════
    # LOGÍSTICA Y TRANSPORTE
    # ═══════════════════════════════════════════════════════════════════════
    {
        "tipo_gasto": "LOGISTICA_TRANSPORTE",
        "codigo": "LT-01",
        "titulo": "Carta porte CFDI 4.0 con complemento de transporte (Carta Porte)",
        "descripcion": "Obligatorio desde 2023 para transporte terrestre de mercancías. Sin Carta Porte el SAT puede retener la mercancía y la deducción es rechazada automáticamente. Verificar que RFC del transportista esté activo.",
        "pillar": "ENTREGABLES",
        "requerido": True,
    },
    {
        "tipo_gasto": "LOGISTICA_TRANSPORTE",
        "codigo": "LT-02",
        "titulo": "Guía de embarque o conocimiento de embarque (BL / AWB)",
        "descripcion": "Para transporte marítimo o aéreo. Acredita que la mercancía fue efectivamente embarcada. Bajo NIF D-1 la transferencia de riesgos ocurre en el momento definido en los INCOTERMS del contrato.",
        "pillar": "ENTREGABLES",
        "requerido": False,
    },
    {
        "tipo_gasto": "LOGISTICA_TRANSPORTE",
        "codigo": "LT-03",
        "titulo": "Evidencia GPS de ruta recorrida (reporte del transportista)",
        "descripcion": "Registro de trayecto real del transporte. El Art. 48 CFF admite registros electrónicos como evidencia. El reporte GPS correlaciona con la Carta Porte y elimina toda duda de viaje ficticio.",
        "pillar": "ENTREGABLES",
        "requerido": False,
    },

    # ═══════════════════════════════════════════════════════════════════════
    # SERVICIOS TECNOLÓGICOS / SAAS / HOSTING
    # ═══════════════════════════════════════════════════════════════════════
    {
        "tipo_gasto": "SERVICIOS_TECNOLOGICOS",
        "codigo": "ST-01",
        "titulo": "Acuerdo de nivel de servicio (SLA) firmado",
        "descripcion": "Define métricas de disponibilidad, tiempo de respuesta y penalizaciones. Bajo NIF C-8 los costos de implementación de SaaS pueden capitalizarse si cumplen criterios de activo intangible; el SLA es el soporte contractual.",
        "pillar": "RAZON_NEGOCIO",
        "requerido": True,
    },
    {
        "tipo_gasto": "SERVICIOS_TECNOLOGICOS",
        "codigo": "ST-02",
        "titulo": "Reporte de uso mensual de la plataforma (métricas de consumo)",
        "descripcion": "Dashboard o reporte de uso: usuarios activos, transacciones procesadas, almacenamiento consumido. Acredita que el servicio fue usado y genera beneficio económico real (principio de sustancia NIF A-2).",
        "pillar": "ENTREGABLES",
        "requerido": True,
    },
    {
        "tipo_gasto": "SERVICIOS_TECNOLOGICOS",
        "codigo": "ST-03",
        "titulo": "Licencia o clave de acceso registrada a nombre de la empresa",
        "descripcion": "Confirma que la empresa es el titular del acceso. Para deducibilidad el Art. 27 LISR exige que los gastos correspondan al RFC del contribuyente; una licencia a nombre personal no es deducible.",
        "pillar": "ENTREGABLES",
        "requerido": True,
    },
]

# ── Ejecución del seed ────────────────────────────────────────────────────────

def run():
    created = 0
    updated = 0

    # Usamos tenant_slug vacío para plantillas globales (disponibles para todos los tenants)
    TENANT = ""

    for item in CATALOG:
        obj, was_created = DeliverableRequirement.objects.update_or_create(
            tenant_slug=TENANT,
            tipo_gasto=item["tipo_gasto"],
            codigo=item["codigo"],
            defaults={
                "titulo": item["titulo"],
                "descripcion": item["descripcion"],
                "pillar": item["pillar"],
                "requerido": item["requerido"],
            },
        )
        if was_created:
            created += 1
        else:
            updated += 1

    total = created + updated
    print(f"\n✅ DB control — {total} entregables: {created} nuevos, {updated} actualizados.")

    # ── Propagar plantillas globales a cada base de datos de tenant ──────────
    try:
        from tenancy.models import Tenant
        from tenancy.context import TenantContext
        from django.db import connections

        plantillas = list(DeliverableRequirement.objects.using("default").filter(tenant_slug="").values(
            "tipo_gasto", "codigo", "titulo", "descripcion", "pillar", "requerido"
        ))

        print(f"\n🔄 Propagando {len(plantillas)} plantillas a tenants activos...")
        for tenant in Tenant.objects.filter(is_active=True):
            if tenant.db_alias not in connections.databases:
                connections.databases[tenant.db_alias] = tenant.database_dict()
            alias = tenant.db_alias
            t_created = 0
            for p in plantillas:
                _, was_new = DeliverableRequirement.objects.using(alias).update_or_create(
                    tenant_slug="",
                    tipo_gasto=p["tipo_gasto"],
                    codigo=p["codigo"],
                    defaults={
                        "titulo": p["titulo"],
                        "descripcion": p["descripcion"],
                        "pillar": p["pillar"],
                        "requerido": p["requerido"],
                    },
                )
                if was_new:
                    t_created += 1
            total_now = DeliverableRequirement.objects.using(alias).filter(tenant_slug="").count()
            print(f"  ✅ {tenant.slug:<20} ({alias}): {t_created} nuevos, total={total_now}")
    except Exception as e:
        print(f"\n  ⚠️  No se pudo propagar a tenants: {e}")

    print(f"\nDistribución por tipo de contrato:")
    from collections import Counter
    counter = Counter(item["tipo_gasto"] for item in CATALOG)
    for tipo, count in sorted(counter.items()):
        print(f"  {tipo:<35} {count:>2} entregables")
    print(f"\n  {'TOTAL':<35} {total:>2} entregables")


if __name__ == "__main__":
    run()
