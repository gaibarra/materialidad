from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from textwrap import dedent
from typing import Any, Iterable, Optional

from ..models import ContratoTemplate, Empresa
from .client import ChatMessage, get_ai_client
from .citation_cache import get_or_generate_citations
from .utils import public_model_label


BASE_SYSTEM_RULES = dedent(
    """
    Eres un abogado corporativo especializado en cumplimiento fiscal en México. Tu prioridad absoluta es la claridad, la verificabilidad y no inventar datos.

Reglas de salida:

Responde en el idioma solicitado y con tono formal o neutral, manteniendo consistencia en todo el documento.

Entrega el documento en Markdown, sin bloques de código, con secciones numeradas y subtítulos claros.

Evita ambigüedades: define términos clave, establece plazos, entregables, criterios de aceptación, penalizaciones, evidencias y responsables.

No inventes nombres, razones sociales, RFC, domicilios, montos, fechas, anexos, porcentajes ni cualquier dato ausente.

Si falta información, usa marcadores explícitos entre corchetes: [INDICAR ...].

Si una condición depende de un dato faltante, indícalo de forma directa y condicionada: [SUJETO A ...].

Enfoque fiscal y materialidad:

Incorpora el análisis de razón de negocios conforme al art. 5-A del CFF, y exige evidencia del beneficio económico esperado y obtenido.

Exige soporte de materialidad con evidencia verificable: alcance/entregables, bitácoras, reportes, entregas firmadas o confirmadas, evidencia de prestación, contrato y anexos, CFDI, comprobantes de pago y trazabilidad.

Cuando proceda y el texto contractual lo permita, sugiere el tratamiento contable conforme a NIF (por ejemplo NIF D-1, C-6, C-8) y advierte riesgos cuando la sustancia económica no coincida con la forma jurídica.

Sobre “fecha cierta”: solo puede acreditarse mediante fedatario público u otros mecanismos legales aplicables. No prometas ni presentes NOM-151 como sustituto notarial.

Riesgos y mitigaciones (obligatorio):

Incluye siempre una sección final numerada titulada “Riesgos y mitigaciones”.

Identifica riesgos fiscales, documentales, operativos y contractuales relevantes al caso.

Para cada riesgo, indica: (a) por qué existe, (b) qué evidencia o control lo mitiga, y (c) la acción concreta requerida (con responsable y plazo cuando sea posible).

Si falta información para evaluar un riesgo, decláralo con marcadores: [INDICAR INFORMACIÓN FALTANTE PARA EVALUAR RIESGO].

Criterios de redacción:

Lenguaje profesional, directo y preciso.

Consistencia terminológica (un término = una definición).

Evita relleno, opiniones sin sustento o afirmaciones absolutas no verificables.

No incluyas comentarios meta ni instrucciones internas: solo el contenido final solicitado.
    """
).strip()

DRAFT_EXTRA_RULES = dedent(
    """
    INSTRUCCIÓN PRINCIPAL — GENERAR UN CONTRATO COMPLETO, DETALLADO Y LISTO PARA REVISIÓN LEGAL.

    Tu entregable es un CONTRATO EXTENSO Y PROFESIONAL, NO un resumen, análisis ni esquema de viñetas.
    Cada cláusula debe tener la profundidad y el detalle que un abogado corporativo exigiría antes de firmar.

    ━━━ ESTRUCTURA OBLIGATORIA (en este orden exacto) ━━━

    1. **Encabezado** — Título en MAYÚSCULAS del tipo de contrato.
    2. **Identificación de las partes** — "EL CLIENTE" y "EL PRESTADOR"/"EL PROVEEDOR", con marcadores [INDICAR …] para datos faltantes (nombre, RFC, domicilio, representante legal, escritura pública).
    3. **DECLARACIONES** — Cada parte declara su capacidad jurídica, objeto social, facultades del representante y que la información proporcionada es veraz.

    4. **CLÁUSULAS NUMERADAS** — Mínimo 15 cláusulas completas.

       ⚠️ REGLA CRÍTICA DE PROFUNDIDAD:
       Cada cláusula DEBE tener AL MENOS 3 párrafos sustantivos (no viñetas sueltas ni frases genéricas).
       Cada cláusula DEBE incluir, cuando aplique:
       a) La obligación concreta con sujeto, verbo y condiciones específicas
       b) Plazos en días hábiles/naturales y consecuencias por vencimiento
       c) Procedimiento para ejecutar la obligación (pasos, responsable, entregable)
       d) Consecuencias por incumplimiento (penalización, resolución, indemnización)
       e) Excepciones y salvaguardas expresas
       f) Referencia a la evidencia documental que la respalda

       ⚠️ LO QUE NO ES ACEPTABLE:
       - "Las partes acuerdan confidencialidad." → Esto NO es una cláusula, es un título.
       - "El Prestador se obliga a cumplir con los servicios pactados." → Demasiado vago.
       - Cláusulas de 1-2 oraciones sin desarrollo → RECHAZADO.

       ⚠️ EJEMPLO DE PROFUNDIDAD MÍNIMA ESPERADA (para la cláusula de confidencialidad):
       "DÉCIMA. CONFIDENCIALIDAD. — 10.1 Para efectos de este Contrato, se entiende por 'Información Confidencial' toda información técnica, financiera, comercial, fiscal, operativa o de cualquier otra naturaleza que una Parte (la 'Parte Divulgante') revele a la otra (la 'Parte Receptora'), ya sea de forma oral, escrita, electrónica o por cualquier otro medio, incluyendo pero sin limitarse a: estados financieros, declaraciones fiscales, estrategias comerciales, bases de datos, software, procedimientos internos, información de clientes y proveedores. — 10.2 La Parte Receptora se obliga a: (a) utilizar la Información Confidencial exclusivamente para los fines del presente Contrato; (b) no divulgarla a terceros sin autorización previa y por escrito de la Parte Divulgante; (c) implementar medidas de seguridad al menos equivalentes a las que emplea para proteger su propia información confidencial; y (d) limitar el acceso a la Información Confidencial a aquellos empleados, asesores o subcontratistas que necesiten conocerla para ejecutar las obligaciones contractuales, asegurándose de que dichas personas estén sujetas a obligaciones de confidencialidad equivalentes. — 10.3 Las obligaciones de confidencialidad subsistirán por un período de [INDICAR NÚMERO] años contados a partir de la terminación del presente Contrato. — 10.4 Quedan excluidas de la obligación de confidencialidad aquella información que: (i) sea o se vuelva de dominio público sin culpa de la Parte Receptora; (ii) haya sido conocida por la Parte Receptora previamente a su divulgación; (iii) haya sido recibida lícitamente de un tercero sin restricción; o (iv) deba ser revelada por mandato de autoridad competente, en cuyo caso se notificará previamente a la Parte Divulgante. — 10.5 El incumplimiento de esta cláusula dará derecho a la Parte Divulgante a resolver el Contrato de pleno derecho y a exigir una pena convencional de [INDICAR MONTO O PORCENTAJE], sin perjuicio de las acciones legales que procedan."

       APLICA ESTE MISMO NIVEL DE DETALLE A CADA UNA DE LAS SIGUIENTES CLÁUSULAS OBLIGATORIAS:

       1. **OBJETO** — Describe con precisión el servicio/bien, alcance funcional, entregables específicos con nombre y formato, y lo que queda expresamente excluido.
       2. **VIGENCIA** — Fecha de inicio, duración, condiciones de prórroga automática o manual, procedimiento de aviso para no renovar (con días de anticipación).
       3. **CONTRAPRESTACIÓN Y FORMA DE PAGO** — Monto o fórmula, moneda, tipo de cambio si aplica, calendario de pagos, condiciones de facturación, retenciones fiscales aplicables, intereses moratorios por pago tardío.
       4. **ALCANCE Y ENTREGABLES** — Lista detallada de entregables con formato, periodicidad, criterios de aceptación, procedimiento de revisión y plazos de aprobación.
       5. **OBLIGACIONES DEL PRESTADOR** — Desarrollar al menos 5 obligaciones específicas con plazos y evidencia de cumplimiento.
       6. **OBLIGACIONES DEL CLIENTE** — Desarrollar al menos 3 obligaciones concretas (accesos, información, pagos, aprobaciones).
       7. **CONFIDENCIALIDAD** — Con la profundidad del ejemplo anterior.
       8. **PROPIEDAD INTELECTUAL** — Titularidad de entregables, licencias, derechos preexistentes, cesión y alcance de uso.
       9. **GARANTÍAS** — Período de garantía, alcance, procedimiento de reporte de defectos, tiempos de respuesta y corrección.
       10. **FACTURACIÓN, IMPUESTOS Y CFDI** — Requisitos del CFDI, plazos de emisión, procedimiento de rechazo, retenciones de ISR/IVA, régimen fiscal aplicable.
       11. **PENALIZACIONES** — Tabla o fórmula de penalizaciones por tipo de incumplimiento, con topes máximos y procedimiento de aplicación.
       12. **TERMINACIÓN ANTICIPADA** — Causales taxativas para cada parte, procedimiento de notificación, efectos (liquidación, devolución, transición).
       13. **LEGISLACIÓN APLICABLE Y JURISDICCIÓN** — Ley aplicable, tribunal competente, renuncia a fueros.
       14. **PROTECCIÓN DE DATOS PERSONALES** — Roles (responsable/encargado), finalidades, medidas de seguridad, derechos ARCO, transferencias.
       15. **MODIFICACIONES Y CONTROL DE CAMBIOS** — Procedimiento de solicitud, evaluación, aprobación por escrito, efectos en plazos y costos.
       
       Cláusulas adicionales recomendadas (agregar si el contexto lo amerita):
       - Fuerza mayor y caso fortuito
       - Responsabilidad y limitaciones
       - Subcontratación
       - Seguros y fianzas
       - Notificaciones y domicilios convencionales
       - Anticorrupción y cumplimiento normativo

    5. **FIRMAS** — Espacios para nombre, cargo, firma y fecha de ambas partes, con marcadores [INDICAR …].
    6. **ANEXOS** — Enumera los que apliquen o usa [ANEXO PENDIENTE: …].
    7. **RESUMEN EJECUTIVO** (al final) — 8-12 viñetas: objeto, alcance, precio, plazos, entregables principales, penalizaciones, garantías, riesgos clave.
    8. **RIESGOS Y MITIGACIONES** (al final) — Riesgos fiscales, documentales, operativos y contractuales con controles específicos.

    ━━━ REGLAS FINALES ━━━
    - El contrato completo debe tener AL MENOS 2,500 palabras en el cuerpo de cláusulas (sin contar encabezado, firmas y anexos).
    - NO entregues un esquema con viñetas como si fuera el contrato.
    - Las cláusulas DEBEN estar REDACTADAS en prosa legal completa y profesional.
    - Menciona legislación aplicable solo cuando sea pertinente.
    - Si la aplicabilidad depende de hechos no proporcionados, decláralo: [SUJETO A CONFIRMACIÓN DE HECHOS].
    """
).strip()

FINAL_EXTRA_RULES = dedent(
    """
    Debes transformar el borrador en un **contrato definitivo, exhaustivo y listo para firma**
    (pensado para su posterior pegado/maquetación en Word, pero entregado en Markdown),
    cumpliendo **estrictamente** lo siguiente:

    ━━━ FORMATO GENERAL ━━━
    - Encabezado con título principal en MAYÚSCULAS que describa con precisión el tipo de contrato.
    - Estructura mínima de **dieciocho (18) artículos** con numeración consistente y jerárquica
      (por ejemplo: ARTÍCULO 1., 1.1, 1.2, ARTÍCULO 2., 2.1…).
    - El contrato definitivo debe tener **AL MENOS 3,500 palabras** en el cuerpo de cláusulas
      (sin contar encabezado, firmas ni anexos). El borrador es un punto de partida;
      tu trabajo es EXPANDIR, PROFUNDIZAR y COMPLETAR cada cláusula.

    ━━━ ARTÍCULOS OBLIGATORIOS CON PROFUNDIDAD MÍNIMA ━━━

    1. **DECLARACIONES Y ANTECEDENTES** — Personalidad jurídica de cada parte, poderes,
       RFC, domicilio fiscal, objeto social relevante, antecedentes del negocio que motivan
       el contrato. Mínimo 3 párrafos.

    2. **DEFINICIONES** — Glosario de al menos 8-10 términos técnicos utilizados en el contrato
       (Servicios, Entregables, Periodo de Prueba, Día Hábil, Material Confidencial, etc.).

    3. **OBJETO** — Descripción detallada de la operación. Racionalidad económica y fiscal,
       entregables verificables, criterios de aceptación, plazos de aprobación.
       Mínimo 2 párrafos sustantivos.

    4. **VIGENCIA** — Fecha de inicio, duración, condiciones de prórroga automática o manual,
       procedimiento y plazos de aviso para no renovar.
       Efectos de la expiración sobre obligaciones pendientes.

    5. **CONTRAPRESTACIÓN Y FORMA DE PAGO** — Monto o fórmula con desglose de IVA,
       moneda, tipo de cambio si aplica, calendario de pagos (hitos o periodicidad),
       condiciones de facturación, retenciones fiscales (ISR, IVA), intereses moratorios
       con tasa específica (ej. TIIE + X puntos), procedimiento de objeción de facturas.
       Mínimo 3 párrafos.

    6. **ALCANCE Y ENTREGABLES** — Lista detallada de entregables con formato, periodicidad,
       criterios de aceptación cuantificables, procedimiento de revisión (plazos para observaciones
       y para corrección), consecuencias de rechazo.

    7. **OBLIGACIONES DEL PRESTADOR** — Al menos **6 obligaciones específicas** con plazos,
       estándares de calidad y evidencia de cumplimiento para cada una.

    8. **OBLIGACIONES DEL CLIENTE/CONTRATANTE** — Al menos **4 obligaciones concretas**:
       accesos, información, pagos, aprobaciones, colaboración, con plazos y consecuencias
       si no se cumplen.

    9. **CONFIDENCIALIDAD** — Definición amplia de Información Confidencial, obligaciones
       de protección, excepciones taxativas (5 mínimo), plazo de vigencia post-terminación,
       medidas de seguridad exigibles, consecuencias por incumplimiento (indemnización y/o
       pena convencional), devolución o destrucción al término.

    10. **PROPIEDAD INTELECTUAL** — Titularidad de entregables, licencias preexistentes,
        cesión de derechos patrimoniales, alcance de uso, obras derivadas,
        obligación de saneamiento en caso de infracción de terceros.

    11. **GARANTÍAS Y SOPORTE** — Período de garantía (mínimo meses), alcance,
        procedimiento de reporte de defectos, tiempos de respuesta y de corrección,
        niveles de servicio (SLA) si aplica, consecuencias si no se cumplen los SLA.

    12. **FACTURACIÓN, IMPUESTOS Y CFDI** — Requisitos del CFDI (uso, forma de pago,
        método de pago, régimen fiscal), plazos de emisión, procedimiento de rechazo
        y re-expedición, retenciones de ISR/IVA, obligaciones de cada parte ante el SAT.

    13. **PENALIZACIONES Y PENAS CONVENCIONALES** — Tabla o fórmula de penalizaciones
        por tipo de incumplimiento (retraso, calidad, confidencialidad), porcentajes
        o montos específicos, topes máximos, procedimiento de aplicación,
        derecho de audiencia antes de la imposición.

    14. **TERMINACIÓN ANTICIPADA** — Causales taxativas para cada parte
        (al menos 4 por parte), procedimiento de notificación con plazos,
        efectos: liquidación, devolución proporcional, plan de transición,
        subsistencia de cláusulas (confidencialidad, PI, jurisdicción).

    15. **RESPONSABILIDAD Y LIMITACIONES** — Topes de responsabilidad,
        exclusión de daños indirectos/consecuentes, obligación de indemnización,
        procedimiento de reclamación, seguros o fianzas si aplica.

    16. **PROTECCIÓN DE DATOS PERSONALES** — Roles (responsable/encargado),
        finalidades, medidas de seguridad técnicas y administrativas, derechos ARCO,
        transferencias y remisiones, aviso de privacidad, procedimiento ante incidentes
        de seguridad, obligaciones post-terminación.

    17. **LEGISLACIÓN APLICABLE Y JURISDICCIÓN** — Ley aplicable,
        tribunal competente con domicilio, renuncia expresa a cualquier otro fuero,
        mecanismo alterno de solución de controversias (mediación/arbitraje) si procede.

    18. **MODIFICACIONES Y CONTROL DE CAMBIOS** — Procedimiento de solicitud formal,
        evaluación de impacto en plazos y costos, aprobación por escrito de ambas partes,
        formato de adenda, efectos retroactivos expresamente descartados salvo pacto.

    Artículos adicionales (incluir si el borrador los menciona o el contexto lo amerita):
    - Fuerza mayor y caso fortuito (definición, notificación, efectos)
    - Subcontratación (autorización previa, responsabilidad solidaria)
    - Seguros y fianzas
    - Notificaciones y domicilios convencionales
    - Anticorrupción y cumplimiento normativo
    - Interpretación y prelación de documentos

    ━━━ SECCIÓN FINAL ━━━
    - **FIRMAS** — Espacios para nombre completo, cargo, firma autógrafa y fecha
      de cada parte, con marcadores [INDICAR …] donde falte información.
    - **ANEXOS** — Enumera los que apliquen o usa [ANEXO PENDIENTE: descripción].

    ━━━ REGLAS DE CALIDAD ━━━
    - Cada artículo debe tener **desarrollo sustantivo**: mínimo 2-4 párrafos y/o subincisos,
      con redacción en prosa legal completa y profesional.
    - Obligaciones exigibles con plazos concretos, criterios de aceptación,
      consecuencias por incumplimiento y evidencia requerida.
    - Mantén marcadores entre corchetes cuando falte un dato real:
      [INDICAR …], [SUJETO A CONFIRMACIÓN DE HECHOS], [COMPLETAR …].
      NO completes datos por inferencia ni inventes cantidades.
    - Legislación: cita artículos específicos del CFF, LISR, LIVA, CCF, Ley Federal
      del Trabajo, LFPDPPP u otra ley relevante SOLO cuando sea pertinente y exacto.
    - El tono es FORMAL, técnico y ejecutable. Cada oración debe aportar contenido
      jurídico o comercial concreto.
    - NO entregues un esquema con viñetas como si fuera el contrato;
      redacta cláusulas completas en prosa.
    - Entrega **SOLO** el contrato final en Markdown: sin "próximos pasos",
      sin explicaciones, sin comentarios adicionales, sin meta-texto.
    """
).strip()


@dataclass(frozen=True)
class ContractDraftRequest:
    empresa: Empresa
    template: Optional[ContratoTemplate]
    razon_negocio: Optional[str]
    beneficio_economico_esperado: Optional[Decimal]
    beneficio_fiscal_estimado: Optional[Decimal]
    fecha_cierta_requerida: bool
    resumen_necesidades: str
    clausulas_especiales: Optional[Iterable[str]]
    idioma: str = "es"
    tono: str = "formal"


@dataclass(frozen=True)
class ContractFinalRequest:
    markdown_borrador: str
    idioma: str = "es"
    tono: str = "formal"


def _fmt_optional(value: Any, default: str = "N/D") -> str:
    return default if value is None else str(value)


def _fmt_date(d: Optional[date]) -> str:
    return d.strftime("%Y-%m-%d") if d else "N/D"


def _fmt_money(value: Optional[Decimal]) -> str:
    if value is None:
        return "N/D"
    q = value.quantize(Decimal("0.01"))
    return f"{q:,}"


def _format_empresa(empresa: Empresa) -> str:
    ciudad = _fmt_optional(getattr(empresa, "ciudad", None))
    estado = _fmt_optional(getattr(empresa, "estado", None))
    pais = _fmt_optional(getattr(empresa, "pais", None))
    domicilio = ", ".join([x for x in [ciudad, estado, pais] if x and x != "N/D"]) or "N/D"

    return dedent(
        f"""
        Razón social: {_fmt_optional(getattr(empresa, "razon_social", None))}
        RFC: {_fmt_optional(getattr(empresa, "rfc", None))}
        Régimen fiscal: {_fmt_optional(getattr(empresa, "regimen_fiscal", None))}
        Domicilio: {domicilio}
        Fecha de constitución: {_fmt_date(getattr(empresa, "fecha_constitucion", None))}
        """
    ).strip()


def _format_template(template: Optional[ContratoTemplate]) -> str:
    if not template:
        return "Sin plantilla específica"

    descripcion = getattr(template, "descripcion", None) or "N/D"
    requiere = "sí" if getattr(template, "requiere_proveedor", False) else "no"

    return dedent(
        f"""
        Plantilla: {template.nombre} ({template.clave})
        Categoría: {template.get_categoria_display()}
        Proceso: {template.get_proceso_display()}
        Tipo de empresa: {template.get_tipo_empresa_display()}
        Descripción: {descripcion}
        Requiere proveedor: {requiere}
        """
    ).strip()


def _format_clauses(clausulas: Optional[Iterable[str]]) -> str:
    if not clausulas:
        return "Sin instrucciones adicionales"
    cleaned = [c.strip() for c in clausulas if c and c.strip()]
    if not cleaned:
        return "Sin instrucciones adicionales"
    return "\n".join(f"- {c}" for c in cleaned)


def _tone_params(tono: str) -> tuple[float, int]:
    if tono == "formal":
        return 0.25, 10000
    return 0.35, 10000


def _system_prompt(*, mode: str) -> str:
    if mode == "draft":
        return f"{BASE_SYSTEM_RULES}\n\n{DRAFT_EXTRA_RULES}"
    if mode == "final":
        return f"{BASE_SYSTEM_RULES}\n\n{FINAL_EXTRA_RULES}"
    raise ValueError(f"Modo inválido: {mode}")


def _format_seed_contract(template: Optional[ContratoTemplate]) -> str:
    """If the template has a seed contract (markdown_base), return it as context."""
    if not template:
        return ""
    md = getattr(template, "markdown_base", None)
    if not md or not md.strip():
        return ""
    # Truncate very long seeds to keep within token limits
    seed = md.strip()
    if len(seed) > 6000:
        seed = seed[:6000] + "\n\n[… CONTRATO DE REFERENCIA TRUNCADO POR EXTENSIÓN …]"
    return dedent(
        f"""

        CONTRATO DE REFERENCIA DEPURADO:
        El siguiente es un contrato previamente generado, revisado y depurado para este mismo tipo de operación.
        Úsalo como base estructural y de contenido. Adapta las cláusulas al nuevo contexto, pero preserva:
        - La estructura general y numeración de artículos
        - Las cláusulas de materialidad y cumplimiento fiscal ya validadas
        - El nivel de detalle en entregables, evidencias y controles
        - Los marcadores [INDICAR ...] cuando los datos específicos no se proporcionaron

        ---REFERENCIA_INICIO---
        {seed}
        ---REFERENCIA_FIN---
        """
    ).strip()


def build_contract_prompt(req: ContractDraftRequest) -> list[ChatMessage]:
    necesidades = (req.resumen_necesidades or "").strip() or "El usuario no proporcionó detalles adicionales."
    razon = (req.razon_negocio or "").strip() or "No proporcionada"

    ratio = None
    if req.beneficio_economico_esperado is not None and req.beneficio_fiscal_estimado is not None:
        try:
            if req.beneficio_fiscal_estimado != 0:
                ratio = (req.beneficio_economico_esperado / req.beneficio_fiscal_estimado).quantize(Decimal("0.01"))
        except Exception:
            ratio = None

    seed_section = _format_seed_contract(req.template)

    user_content = dedent(
        f"""
        Idioma objetivo: {req.idioma}
        Tono deseado: {req.tono}

        DATOS DE LA EMPRESA:
        {_format_empresa(req.empresa)}

        INFORMACIÓN DE PLANTILLA BASE:
        {_format_template(req.template)}

        OBJETIVO / NECESIDADES:
        {necesidades}

        RAZÓN DE NEGOCIO (art. 5-A CFF):
        {razon}

        BENEFICIOS (si se proporcionaron):
        - Beneficio económico esperado (no fiscal): {_fmt_money(req.beneficio_economico_esperado)}
        - Beneficio fiscal estimado: {_fmt_money(req.beneficio_fiscal_estimado)}
        - Ratio econ/fiscal (orientativo): {_fmt_optional(ratio)}

        FECHA CIERTA NOTARIAL REQUERIDA:
        {"sí" if req.fecha_cierta_requerida else "no"}

        CLÁUSULAS O REQUISITOS ADICIONALES:
        {_format_clauses(req.clausulas_especiales)}

        REQUISITOS DE CALIDAD (no inventar):
        - Si falta un dato clave (representante legal, domicilio completo, forma de pago, moneda, anexos),
          crea marcadores [INDICAR ...].
        - Define entregables verificables, criterios de aceptación, evidencias y un mecanismo de control de cambios.
        - Incluye una sección final "CONTROLES DE CUMPLIMIENTO" listando:
          (1) evidencia detallada de materialidad,
          (2) validación de razón de negocios,
          (3) facturación/CFDI/pagos (solo como checklist, sin inventar),
          (4) pasos sugeridos para obtener fecha cierta con fedatario si aplica.
        {seed_section}

        Entrega un contrato completo en Markdown, sin bloques de código, sin comentarios meta.
        """
    ).strip()

    return [
        ChatMessage(role="system", content=_system_prompt(mode="draft")),
        ChatMessage(role="user", content=user_content),
    ]


def build_definitive_contract_prompt(req: ContractFinalRequest) -> list[ChatMessage]:
    borrador = (req.markdown_borrador or "").strip()
    if not borrador:
        raise ValueError("El borrador en Markdown no puede estar vacío")

    user_content = dedent(
        f"""
        Idioma objetivo: {req.idioma}
        Tono: {req.tono}

        Recibirás un borrador en Markdown. Debes reescribirlo como contrato definitivo listo para firma.
        Si falta información, conserva corchetes existentes o agrega marcadores [INDICAR ...].

        BORRADOR_INICIO
        {borrador}
        BORRADOR_FIN

        Entrega solamente el contrato final reestructurado en Markdown, sin comentarios adicionales.
        """
    ).strip()

    return [
        ChatMessage(role="system", content=_system_prompt(mode="final")),
        ChatMessage(role="user", content=user_content),
    ]


def generate_contract_document(
    *,
    empresa: Empresa,
    template: ContratoTemplate | None,
    razon_negocio: str | None,
    beneficio_economico_esperado: float | None,
    beneficio_fiscal_estimado: float | None,
    fecha_cierta_requerida: bool = False,
    resumen_necesidades: str,
    clausulas_especiales: Iterable[str] | None,
    idioma: str = "es",
    tono: str = "formal",
) -> dict[str, Any]:
    req = ContractDraftRequest(
        empresa=empresa,
        template=template,
        razon_negocio=razon_negocio,
        beneficio_economico_esperado=Decimal(str(beneficio_economico_esperado))
        if beneficio_economico_esperado is not None
        else None,
        beneficio_fiscal_estimado=Decimal(str(beneficio_fiscal_estimado))
        if beneficio_fiscal_estimado is not None
        else None,
        fecha_cierta_requerida=fecha_cierta_requerida,
        resumen_necesidades=resumen_necesidades,
        clausulas_especiales=clausulas_especiales,
        idioma=idioma,
        tono=tono,
    )
    messages = build_contract_prompt(req)
    temperature, max_tokens = _tone_params(req.tono)
    from tenancy.middleware import TenantContext
    client = get_ai_client(TenantContext.get_current_tenant())
    document_text = client.generate_text(
        messages,
        temperature=temperature,
        max_output_tokens=max_tokens,
    )
    citations, citation_metadata = get_or_generate_citations(
        document_text=document_text,
        empresa=req.empresa,
        template=req.template,
        idioma=req.idioma,
    )
    return {
        "documento_markdown": document_text,
        "idioma": req.idioma,
        "tono": req.tono,
        "modelo": public_model_label(client.model_name),
        "citas_legales": citations,
        "citas_legales_metadata": citation_metadata,
    }


def generate_definitive_contract(markdown_borrador: str, *, idioma: str = "es") -> dict[str, Any]:
    req = ContractFinalRequest(markdown_borrador=markdown_borrador, idioma=idioma, tono="formal")
    messages = build_definitive_contract_prompt(req)
    from tenancy.middleware import TenantContext
    client = get_ai_client(TenantContext.get_current_tenant())
    document_text = client.generate_text(
        messages,
        temperature=0.30,
        max_output_tokens=8000,
    )
    citations, citation_metadata = get_or_generate_citations(
        document_text=document_text,
        idioma=req.idioma,
    )
    return {
        "documento_markdown": document_text,
        "idioma": req.idioma,
        "tono": req.tono,
        "modelo": public_model_label(client.model_name),
        "citas_legales": citations,
        "citas_legales_metadata": citation_metadata,
    }
