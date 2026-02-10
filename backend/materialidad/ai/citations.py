from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from textwrap import dedent
from typing import Any, Sequence

from ..models import ContratoTemplate, Empresa
from .client import ChatMessage, OpenAIClient, OpenAIClientError

logger = logging.getLogger(__name__)

__all__ = [
    "LegalCitation",
    "SatCriterion",
    "generate_legal_citations",
    "render_citations_markdown",
]


@dataclass
class SatCriterion:
    nombre: str
    referencia: str
    descripcion: str
    estatus: str
    riesgo: str
    fuente_url: str | None = None
    vigencia: str | None = None
    notas: str | None = None

    def to_payload(self) -> dict[str, Any]:
        return {
            "nombre": self.nombre,
            "referencia": self.referencia,
            "descripcion": self.descripcion,
            "estatus": self.estatus,
            "riesgo": self.riesgo,
            "fuente_url": self.fuente_url,
            "vigencia": self.vigencia,
            "notas": self.notas,
        }


@dataclass
class LegalCitation:
    referencia: str
    tipo_fuente: str
    ley: str
    articulo: str
    fraccion: str | None = None
    parrafo: str | None = None
    resumen: str | None = None
    extracto: str | None = None
    dimension_cumplimiento: str = "FISCAL"
    riesgo: str = "MEDIO"
    fuente_documento: str | None = None
    fuente_url: str | None = None
    vigencia: str | None = None
    ultima_actualizacion: str | None = None
    notas: str | None = None
    criterios_sat: list[SatCriterion] = field(default_factory=list)

    def to_payload(self) -> dict[str, Any]:
        return {
            "referencia": self.referencia,
            "tipo_fuente": self.tipo_fuente,
            "ley": self.ley,
            "articulo": self.articulo,
            "fraccion": self.fraccion,
            "parrafo": self.parrafo,
            "resumen": self.resumen,
            "extracto": self.extracto,
            "dimension_cumplimiento": self.dimension_cumplimiento,
            "riesgo": self.riesgo,
            "fuente_documento": self.fuente_documento,
            "fuente_url": self.fuente_url,
            "vigencia": self.vigencia,
            "ultima_actualizacion": self.ultima_actualizacion,
            "notas": self.notas,
            "criterios_sat": [criterion.to_payload() for criterion in self.criterios_sat],
        }


MAX_CITATIONS = 8

CITATION_SYSTEM_PROMPT = dedent(
    """
    Eres un abogado fiscal mexicano especializado en materialidad y cumplimiento del SAT.
    Tu objetivo es leer un borrador de contrato y entregar un resumen estructurado de las
    referencias legales y fiscales aplicables, incluyendo criterios normativos del SAT
    (aun cuando sean polémicos) para evaluar riesgos.

    Reglas estrictas:
    - Cita únicamente normas mexicanas vigentes (leyes, reglamentos, NOM, criterios normativos
      o no vinculativos del SAT, resoluciones misceláneas) y proporciona la referencia completa.
    - Cada cita debe incluir artículo, fracción y párrafo cuando aplique.
    - Siempre registra el nivel de riesgo (ALTO, MEDIO o BAJO) y la dimensión de cumplimiento
      (por ejemplo Fiscal, Legal Corporativo, PLD, Seguridad Social).
    - Cuando asocies un criterio del SAT, incluye su referencia oficial, estatus y notas que
      aclaren si es controvertido.
        - Prefiere enlaces oficiales (DOF, SAT, Suprema Corte, IMSS). Si no existe URL pública, menciona el
            documento fuente en texto.
        - No inventes fuentes: si no estás seguro, omite la cita.
        - Evita citas tangenciales: prioriza las que impactan obligaciones fiscales, validez y ejecución.
        - Procura que la mayoría de citas tengan fuente oficial verificable.
    - Devuelve únicamente JSON válido con la forma indicada. No añadas comentarios ni texto extra.
    """
)


def generate_legal_citations(
    *,
    contrato_markdown: str,
    empresa: Empresa | None = None,
    template: ContratoTemplate | None = None,
    idioma: str = "es",
) -> list[dict[str, Any]]:
    if not contrato_markdown or not contrato_markdown.strip():
        return []

    context_lines = []
    if empresa:
        context_lines.append(
            f"Empresa: {empresa.razon_social} · RFC {empresa.rfc} · Régimen {empresa.regimen_fiscal}"
        )
        context_lines.append(
            f"Ubicación: {empresa.ciudad}, {empresa.estado}, {empresa.pais}"
        )
    if template:
        context_lines.append(
            f"Plantilla base: {template.nombre} ({template.clave}) · Categoría {template.categoria}"
        )
    context_lines.append(f"Idioma del contrato: {idioma}")

    user_prompt = dedent(
        f"""
        Contexto del contrato:
        {' | '.join(context_lines)}

        Contrato en Markdown:
        ```markdown
        {contrato_markdown.strip()}
        ```

        Responde únicamente con JSON usando este esquema:
        {{
          "citations": [
            {{
              "referencia": "LISR-27-I",
              "tipo_fuente": "LEY|REGLAMENTO|CRITERIO_SAT|RESOLUCION",
              "ley": "Ley del Impuesto sobre la Renta",
              "articulo": "27",
              "fraccion": "I",
              "parrafo": "Párrafo segundo",
              "resumen": "Describe la obligación",
              "extracto": "Texto resumido que respalda la obligación",
              "dimension_cumplimiento": "Fiscal",
              "riesgo": "ALTO|MEDIO|BAJO",
              "fuente_documento": "DOF 12/07/2024",
              "fuente_url": "https://www.dof.gob.mx/...",
              "vigencia": "2024-07-12",
              "ultima_actualizacion": "2024-11-01",
              "notas": "Aclaraciones adicionales",
              "criterios_sat": [
                {{
                  "nombre": "Criterio normativo 46/ISR/N",
                  "referencia": "RMF 2024, Anexo 7",
                  "descripcion": "Resume el criterio y su postura",
                  "estatus": "VIGENTE|CONTROVERTIDO",
                  "riesgo": "ALTO|MEDIO|BAJO",
                  "fuente_url": "https://www.sat.gob.mx/...",
                  "vigencia": "2024-01-01",
                  "notas": "Notas relevantes"
                }}
              ]
            }}
          ]
        }}

        Máximo {MAX_CITATIONS} citas.
        """
    ).strip()

    messages = [
        ChatMessage(role="system", content=CITATION_SYSTEM_PROMPT),
        ChatMessage(role="user", content=user_prompt),
    ]

    client = OpenAIClient()
    try:
        raw_response = client.generate_text(
            messages,
            temperature=0.1,
            max_output_tokens=1800,
        )
    except OpenAIClientError as exc:
        logger.warning("No se pudieron generar citas legales: %s", exc)
        return []

    return _parse_citations_payload(raw_response)


def _parse_citations_payload(raw_text: str) -> list[dict[str, Any]]:
    if not raw_text:
        return []

    cleaned = raw_text.strip()
    if cleaned.startswith("```"):
        cleaned = _strip_code_fence(cleaned)

    try:
        parsed = json.loads(cleaned)
    except json.JSONDecodeError:
        logger.warning("La IA devolvió un JSON inválido para citas")
        return []

    raw_citations = parsed.get("citations") if isinstance(parsed, dict) else None
    if not isinstance(raw_citations, list):
        logger.warning("El JSON de citas no contiene la clave 'citations'")
        return []

    citations: list[LegalCitation] = []
    for entry in raw_citations:
        if not isinstance(entry, dict):
            continue
        citation = LegalCitation(
            referencia=str(entry.get("referencia") or ""),
            tipo_fuente=str(entry.get("tipo_fuente") or "LEY"),
            ley=str(entry.get("ley") or ""),
            articulo=str(entry.get("articulo") or ""),
            fraccion=_safe_optional(entry.get("fraccion")),
            parrafo=_safe_optional(entry.get("parrafo")),
            resumen=_safe_optional(entry.get("resumen")),
            extracto=_safe_optional(entry.get("extracto")),
            dimension_cumplimiento=str(entry.get("dimension_cumplimiento") or "FISCAL"),
            riesgo=str(entry.get("riesgo") or "MEDIO"),
            fuente_documento=_safe_optional(entry.get("fuente_documento")),
            fuente_url=_safe_optional(entry.get("fuente_url")),
            vigencia=_safe_optional(entry.get("vigencia")),
            ultima_actualizacion=_safe_optional(entry.get("ultima_actualizacion")),
            notas=_safe_optional(entry.get("notas")),
            criterios_sat=_parse_sat_criteria(entry.get("criterios_sat")),
        )
        if citation.referencia and citation.ley and citation.articulo:
            citations.append(citation)

    return [item.to_payload() for item in citations]


def _parse_sat_criteria(raw_value: Any) -> list[SatCriterion]:
    if not isinstance(raw_value, list):
        return []
    criterios: list[SatCriterion] = []
    for item in raw_value:
        if not isinstance(item, dict):
            continue
        criterios.append(
            SatCriterion(
                nombre=str(item.get("nombre") or ""),
                referencia=str(item.get("referencia") or ""),
                descripcion=_safe_optional(item.get("descripcion")) or "",
                estatus=str(item.get("estatus") or "VIGENTE"),
                riesgo=str(item.get("riesgo") or "MEDIO"),
                fuente_url=_safe_optional(item.get("fuente_url")),
                vigencia=_safe_optional(item.get("vigencia")),
                notas=_safe_optional(item.get("notas")),
            )
        )
    return [criterion for criterion in criterios if criterion.nombre or criterion.referencia]


def _strip_code_fence(text: str) -> str:
    stripped = text.strip()
    if stripped.startswith("```json"):
        stripped = stripped[len("```json") :]
    elif stripped.startswith("```"):
        stripped = stripped[len("```") :]
    if stripped.endswith("```"):
        stripped = stripped[: -len("```")]
    return stripped.strip()


def _safe_optional(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def render_citations_markdown(citations: Sequence[dict[str, Any]]) -> str:
    if not citations:
        return ""

    lines: list[str] = ["## Referencias legales y criterios SAT", ""]
    for idx, citation in enumerate(citations, start=1):
        title = citation.get("ley") or "Referencia legal"
        articulo = citation.get("articulo") or "N/A"
        fraccion = citation.get("fraccion")
        parrafo = citation.get("parrafo")
        ref_parts = [f"Art. {articulo}"]
        if fraccion:
            ref_parts.append(f"Fr. {fraccion}")
        if parrafo:
            ref_parts.append(parrafo)
        ref_text = " · ".join(ref_parts)
        lines.append(f"{idx}. **{title}** ({ref_text})")
        resumen = citation.get("resumen") or citation.get("extracto")
        if resumen:
            lines.append(f"   - {resumen}")
        fuente = citation.get("fuente_documento") or citation.get("fuente_url")
        if fuente:
            lines.append(f"   - Fuente: {fuente}")
        riesgo = citation.get("riesgo")
        dimension = citation.get("dimension_cumplimiento")
        details: list[str] = []
        if riesgo:
            details.append(f"Riesgo {riesgo}")
        if dimension:
            details.append(dimension)
        if details:
            lines.append(f"   - {' | '.join(details)}")
        criterios_sat = citation.get("criterios_sat") or []
        if isinstance(criterios_sat, list) and criterios_sat:
            lines.append("   - Criterios SAT:")
            for crit in criterios_sat:
                if not isinstance(crit, dict):
                    continue
                nombre = crit.get("nombre") or "Criterio"
                referencia = crit.get("referencia")
                nota = crit.get("notas")
                segmentos = [nombre]
                if referencia:
                    segmentos.append(referencia)
                if nota:
                    segmentos.append(nota)
                lines.append(f"     * {' · '.join(segmentos)}")
        lines.append("")

    return "\n".join(lines).strip()
