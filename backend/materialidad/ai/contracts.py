from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from textwrap import dedent
from typing import Any, Iterable, Optional

from ..models import ContratoTemplate, Empresa
from .client import ChatMessage, OpenAIClient
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
    Incluye una sección numerada titulada “Resumen ejecutivo” al inicio, con 5–10 viñetas que sinteticen: objeto, alcance, precio/forma de pago, plazos, entregables, aceptación, penalizaciones, garantías y riesgos principales.

Incluye una sección numerada titulada “Cláusulas clave”, en formato de lista, que destaque lo esencial del contrato (mínimo 8, máximo 15 puntos) con referencias a la sección/cláusula correspondiente.

Incluye secciones de firmas con campos completos y no inventados para ambas partes, con marcadores obligatorios cuando falten datos: [INDICAR NOMBRE/REPRESENTANTE/RFC/DOMICILIO/CARGO].

Incluye un apartado de anexos cuando existan o sean necesarios para verificabilidad (alcance, cronograma, entregables, evidencias, precios, SLA, etc.), enumerándolos y describiendo su función. Si faltan, agrega [ANEXO PENDIENTE: …].

Menciona legislación aplicable solo cuando sea pertinente para sustentar una obligación, riesgo o recomendación, en tono orientativo y sin citas excesivas; evita “name-dropping” legal. Si la aplicabilidad depende de hechos no proporcionados, decláralo: [SUJETO A CONFIRMACIÓN DE HECHOS].
    """
).strip()

FINAL_EXTRA_RULES = dedent(
    """
    Debes transformar el borrador en un contrato definitivo, exhaustivo y listo para firma (pensado para su posterior pegado/maquetación en Word, pero entregado en Markdown), cumpliendo estrictamente lo siguiente:

Encabezado con título principal en MAYÚSCULAS que describa con precisión el tipo de contrato.

Estructura mínima de doce (12) artículos con numeración consistente y jerárquica (por ejemplo: 1., 1.1, 1.2, 2., 2.1…).
Debe cubrir, como mínimo, los siguientes temas (pueden combinarse o subdividirse sin omitir contenido):

Partes

Objeto

Vigencia

Contraprestación

Alcance

Obligaciones del Prestador

Obligaciones del Cliente/Contratante

Confidencialidad

Propiedad Intelectual

Garantías y Soporte

Facturación e Impuestos

Legislación Aplicable y Jurisdicción

Modificaciones y Control de Cambios

Terminación

Responsabilidad y Limitaciones

Protección de Datos

Interpretación y Prelación

Firmas

Anexos

Cada artículo debe contener desarrollo sustantivo: varios párrafos y/o subincisos, con redacción clara, obligaciones exigibles, plazos, criterios de aceptación, consecuencias por incumplimiento y evidencia requerida cuando corresponda.

Mantén y utiliza marcadores entre corchetes cuando falte un dato real (por ejemplo: [INDICAR …], [SUJETO A …]). No completes datos por inferencia.

Entrega solo el contrato final en Markdown: sin “próximos pasos”, sin explicaciones, sin comentarios adicionales, sin meta-texto.
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
        return 0.25, 2600
    return 0.35, 2600


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
    client = OpenAIClient()
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
    client = OpenAIClient()
    document_text = client.generate_text(
        messages,
        temperature=0.30,
        max_output_tokens=3600,
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
