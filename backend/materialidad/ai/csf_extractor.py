"""Extracción de datos de Constancia de Situación Fiscal (CSF) mediante OpenAI Vision."""

from __future__ import annotations

import base64
import json
import logging
from typing import Any

from django.conf import settings
from openai import OpenAI

logger = logging.getLogger("materialidad.ai")

CSF_EXTRACTION_PROMPT = """Analiza esta imagen de una Constancia de Situación Fiscal (CSF) del SAT de México.
Extrae TODOS los datos visibles y devuélvelos en formato JSON con EXACTAMENTE estas claves:

{
  "tipo_persona": "MORAL" o "FISICA",
  "rfc": "RFC completo",
  "curp": "CURP si es persona física, vacío si moral",
  "razon_social": "Razón social o denominación (PM) o nombre completo (PF)",
  "nombre": "Nombre(s) solo si es PF",
  "apellido_paterno": "Solo si es PF",
  "apellido_materno": "Solo si es PF",
  "regimen_fiscal": "Régimen fiscal principal",
  "actividad_economica": "Actividad económica principal",
  "fecha_constitucion": "Fecha de constitución o inicio de actividades en formato YYYY-MM-DD",
  "calle": "Nombre de la calle",
  "no_exterior": "Número exterior",
  "no_interior": "Número interior si existe",
  "colonia": "Colonia",
  "codigo_postal": "Código postal",
  "municipio": "Municipio o alcaldía",
  "estado": "Entidad federativa",
  "ciudad": "Localidad o ciudad si aparece",
  "csf_fecha_emision": "Fecha de emisión de la constancia en YYYY-MM-DD"
}

REGLAS:
- Devuelve SOLO el JSON, sin texto adicional ni markdown.
- Si un campo no es visible o no aplica, usa cadena vacía "".
- Para tipo_persona: si el RFC tiene 13 caracteres es PF, 12 caracteres es PM.
- El campo razon_social siempre debe tener valor (nombre completo para PF).
- Sé preciso con los acentos y mayúsculas tal como aparecen en el documento.
"""


def extract_csf_data(file_content: bytes, filename: str = "csf.pdf") -> dict[str, Any]:
    """Extrae datos de un PDF/imagen de CSF usando OpenAI Vision.

    Args:
        file_content: bytes del archivo (PDF o imagen).
        filename: nombre original del archivo.

    Returns:
        Diccionario con los datos extraídos.
    """
    api_key = getattr(settings, "OPENAI_API_KEY", None)
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY no está configurada")

    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

    # Determinar MIME type
    if ext in ("jpg", "jpeg"):
        mime = "image/jpeg"
    elif ext == "png":
        mime = "image/png"
    elif ext == "pdf":
        mime = "application/pdf"
    elif ext == "webp":
        mime = "image/webp"
    else:
        mime = "application/octet-stream"

    b64 = base64.b64encode(file_content).decode("utf-8")
    data_url = f"data:{mime};base64,{b64}"

    client = OpenAI(api_key=api_key, timeout=60)

    try:
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": CSF_EXTRACTION_PROMPT},
                        {
                            "type": "image_url",
                            "image_url": {"url": data_url, "detail": "high"},
                        },
                    ],
                }
            ],
            max_tokens=2000,
            temperature=0.1,
        )

        raw = response.choices[0].message.content or ""
        # Limpiar posible markdown wrapping
        raw = raw.strip()
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[-1]  # quitar ```json
            raw = raw.rsplit("```", 1)[0]  # quitar ``` final
            raw = raw.strip()

        data = json.loads(raw)
        logger.info("CSF extraída exitosamente: RFC=%s", data.get("rfc", "?"))
        return data

    except json.JSONDecodeError as exc:
        logger.error("CSF: respuesta no es JSON válido: %s", raw[:200])
        raise RuntimeError(f"No se pudo parsear la respuesta de AI: {exc}") from exc
    except Exception as exc:
        logger.error("CSF: error al invocar OpenAI Vision: %s", exc)
        raise RuntimeError(f"Error al extraer datos de la CSF: {exc}") from exc
