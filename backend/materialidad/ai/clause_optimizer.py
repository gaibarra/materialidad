"""AI-powered clause optimization for contract generation.

Takes a single clause text + contract context and returns an improved version
with legal justification, references, and a summary of key changes.
"""

from __future__ import annotations

import json
import logging
from textwrap import dedent
from typing import Any

from .client import ChatMessage, OpenAIClient, OpenAIClientError
from .utils import public_model_label

logger = logging.getLogger(__name__)

__all__ = ["optimize_clause", "ClauseOptimizationError"]


class ClauseOptimizationError(RuntimeError):
    """Error al optimizar una cláusula."""


OPTIMIZER_SYSTEM_PROMPT = dedent(
    """
    Eres un abogado corporativo mexicano especializado en contratos y cumplimiento fiscal.
    Tu tarea es mejorar cláusulas contractuales individuales para que cumplan con los
    requisitos fiscales vigentes en México, sean ejecutables, y protejan los intereses
    del cliente sin ambigüedades.

    Reglas estrictas:
    - No inventes datos: si falta información, usa marcadores [INDICAR ...].
    - Mantén el espíritu original de la cláusula pero refuerza su solidez jurídica.
    - Incluye referencias legales concretas cuando aplique (CFF, LISR, LIVA, NIF, RMF).
    - Redacción profesional, directa y sin relleno.
    - Responde ÚNICAMENTE con JSON válido según el esquema indicado.
    - No añadas texto fuera del JSON.
    """
).strip()

OBJECTIVES = {
    "mejorar_fiscal": (
        "Refuerza el blindaje fiscal: asegura que la cláusula cumpla con art. 5-A CFF "
        "(razón de negocios), requisitos de deducibilidad (art. 27 LISR), soporte de "
        "materialidad (evidencia verificable), y tratamiento correcto de CFDI/IVA."
    ),
    "simplificar": (
        "Simplifica la redacción manteniendo la fuerza jurídica. Elimina redundancias, "
        "usa lenguaje directo y estructura clara. Conserva todas las obligaciones clave."
    ),
    "reforzar_materialidad": (
        "Refuerza la evidencia de materialidad: agrega requisitos de entregables verificables, "
        "bitácoras, confirmaciones de recepción, evidencia fotográfica o digital, y controles "
        "que demuestren la prestación real del servicio ante una auditoría del SAT."
    ),
    "compliance_integral": (
        "Fortalece la cláusula desde perspectiva de compliance integral: anticorrupción, "
        "PLD (prevención de lavado de dinero), debida diligencia de contrapartes, "
        "protección de datos personales (LFPDPPP), y gobierno corporativo."
    ),
}


def _build_optimize_prompt(
    texto_clausula: str,
    contexto_contrato: str,
    objetivo: str,
    idioma: str,
) -> list[ChatMessage]:
    """Construye el prompt para optimización de cláusula."""

    objetivo_desc = OBJECTIVES.get(objetivo, OBJECTIVES["mejorar_fiscal"])

    user_content = dedent(
        f"""
        Idioma: {idioma}

        OBJETIVO DE OPTIMIZACIÓN:
        {objetivo_desc}

        CONTEXTO DEL CONTRATO:
        {contexto_contrato[:2000] if contexto_contrato else "No proporcionado"}

        CLÁUSULA ORIGINAL:
        {texto_clausula.strip()}

        Responde ÚNICAMENTE con JSON usando este esquema exacto:
        {{
          "texto_mejorado": "La cláusula completa reescrita y mejorada",
          "justificacion": "Explicación breve de por qué se hicieron los cambios",
          "referencias_legales": [
            {{
              "ley": "Nombre de la ley",
              "articulo": "Número de artículo",
              "relevancia": "Por qué aplica a esta cláusula"
            }}
          ],
          "cambios_principales": [
            "Cambio 1: descripción breve",
            "Cambio 2: descripción breve"
          ],
          "nivel_riesgo_original": "ALTO|MEDIO|BAJO",
          "nivel_riesgo_mejorado": "ALTO|MEDIO|BAJO"
        }}
        """
    ).strip()

    return [
        ChatMessage(role="system", content=OPTIMIZER_SYSTEM_PROMPT),
        ChatMessage(role="user", content=user_content),
    ]


def _parse_optimization_response(raw_text: str) -> dict[str, Any]:
    """Parsea la respuesta JSON del modelo AI."""
    if not raw_text:
        return {}

    cleaned = raw_text.strip()
    if cleaned.startswith("```"):
        # Strip code fences
        if cleaned.startswith("```json"):
            cleaned = cleaned[len("```json"):]
        elif cleaned.startswith("```"):
            cleaned = cleaned[len("```"):]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-len("```")]
        cleaned = cleaned.strip()

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        # Try to find JSON object in the response
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start != -1 and end != -1 and end > start:
            try:
                return json.loads(cleaned[start:end + 1])
            except json.JSONDecodeError:
                pass

    logger.warning("AI returned invalid JSON for clause optimization")
    return {"texto_mejorado": raw_text, "justificacion": "Respuesta no estructurada del modelo"}


def optimize_clause(
    *,
    texto_clausula: str,
    contexto_contrato: str = "",
    objetivo: str = "mejorar_fiscal",
    idioma: str = "es",
) -> dict[str, Any]:
    """Optimiza una cláusula contractual usando IA.

    Args:
        texto_clausula: Texto de la cláusula a optimizar.
        contexto_contrato: Resumen o markdown del contrato completo para contexto.
        objetivo: Tipo de optimización (mejorar_fiscal, simplificar,
                  reforzar_materialidad, compliance_integral).
        idioma: Idioma del resultado (es/en).

    Returns:
        dict con texto_mejorado, justificacion, referencias_legales,
        cambios_principales, nivel_riesgo_original, nivel_riesgo_mejorado, modelo.

    Raises:
        ClauseOptimizationError: Si la cláusula está vacía o hay error del modelo.
    """
    if not texto_clausula or not texto_clausula.strip():
        raise ClauseOptimizationError("La cláusula no puede estar vacía")

    if objetivo not in OBJECTIVES:
        objetivo = "mejorar_fiscal"

    messages = _build_optimize_prompt(texto_clausula, contexto_contrato, objetivo, idioma)
    client = OpenAIClient()

    try:
        raw_response = client.generate_text(
            messages,
            temperature=0.20,
            max_output_tokens=1400,
        )
    except OpenAIClientError as exc:
        raise ClauseOptimizationError(f"Error al invocar el modelo AI: {exc}") from exc

    result = _parse_optimization_response(raw_response)
    result["modelo"] = public_model_label(client.model_name)
    result["objetivo"] = objetivo

    # Ensure required fields exist
    result.setdefault("texto_mejorado", texto_clausula)
    result.setdefault("justificacion", "")
    result.setdefault("referencias_legales", [])
    result.setdefault("cambios_principales", [])
    result.setdefault("nivel_riesgo_original", "MEDIO")
    result.setdefault("nivel_riesgo_mejorado", "MEDIO")

    return result
