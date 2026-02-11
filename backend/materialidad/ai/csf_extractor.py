"""Extracción de datos de Constancia de Situación Fiscal (CSF) mediante OpenAI Vision."""

from __future__ import annotations

import base64
import io
import json
import logging
from typing import Any

from django.conf import settings
from openai import OpenAI

logger = logging.getLogger("materialidad.ai")


def _pdf_to_images_b64(pdf_bytes: bytes) -> list[str]:
    """Convierte un PDF a una lista de imágenes base64 (JPEG).

    Intenta usar pdf2image (poppler) primero, luego pypdf como fallback.
    Retorna lista de data URLs listos para OpenAI Vision.
    """
    # Intento 1: pdf2image (mejor calidad)
    try:
        from pdf2image import convert_from_bytes  # type: ignore

        images = convert_from_bytes(pdf_bytes, dpi=200, first_page=1, last_page=3)
        result = []
        for img in images:
            buf = io.BytesIO()
            img.save(buf, format="JPEG", quality=90)
            b64 = base64.b64encode(buf.getvalue()).decode("utf-8")
            result.append(f"data:image/jpeg;base64,{b64}")
        return result
    except ImportError:
        logger.debug("pdf2image no disponible, usando pypdf")
    except Exception as exc:
        logger.warning("pdf2image falló: %s, intentando pypdf", exc)

    # Intento 2: pypdf — extraer imágenes embebidas
    try:
        from pypdf import PdfReader

        reader = PdfReader(io.BytesIO(pdf_bytes))
        result = []
        for page in reader.pages[:3]:  # máximo 3 páginas
            for image_obj in page.images:
                b64 = base64.b64encode(image_obj.data).decode("utf-8")
                # Detectar formato
                if image_obj.name.lower().endswith(".png"):
                    mime = "image/png"
                else:
                    mime = "image/jpeg"
                result.append(f"data:{mime};base64,{b64}")
        if result:
            return result
    except Exception as exc:
        logger.warning("pypdf extracción de imágenes falló: %s", exc)

    raise RuntimeError(
        "No se pudo convertir el PDF a imagen. "
        "Instale poppler-utils y pdf2image, o suba directamente una imagen (JPG/PNG)."
    )

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
    is_pdf = ext == "pdf"

    # Para PDFs, convertir a imágenes primero
    if is_pdf:
        image_urls = _pdf_to_images_b64(file_content)
    else:
        # Determinar MIME type para imágenes
        if ext in ("jpg", "jpeg"):
            mime = "image/jpeg"
        elif ext == "png":
            mime = "image/png"
        elif ext == "webp":
            mime = "image/webp"
        else:
            mime = "image/jpeg"  # fallback
        b64 = base64.b64encode(file_content).decode("utf-8")
        image_urls = [f"data:{mime};base64,{b64}"]

    # Construir contenido del mensaje con todas las imágenes
    content: list[dict] = [{"type": "text", "text": CSF_EXTRACTION_PROMPT}]
    for url in image_urls:
        content.append({
            "type": "image_url",
            "image_url": {"url": url, "detail": "high"},
        })

    client = OpenAI(api_key=api_key, timeout=60)

    try:
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {
                    "role": "user",
                    "content": content,
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
