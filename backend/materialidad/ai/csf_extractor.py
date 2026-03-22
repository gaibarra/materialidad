"""Extracción de datos de Constancia de Situación Fiscal (CSF).

Estrategia de costo mínimo:
1) Para PDFs: intenta extraer texto nativo y parsearlo con IA de texto.
2) Si no hay texto utilizable: usa visión (Gemini/OpenAI) como fallback.
3) Para imágenes: usa visión directamente.
"""

from __future__ import annotations

import base64
import io
import json
import logging
import re
from typing import Any

from django.conf import settings

logger = logging.getLogger("materialidad.ai")


def _extract_pdf_text(pdf_bytes: bytes, *, max_pages: int = 3) -> str:
    """Extrae texto nativo de un PDF (sin OCR)."""
    try:
        from pypdf import PdfReader

        reader = PdfReader(io.BytesIO(pdf_bytes))
        text_parts: list[str] = []
        for page in reader.pages[:max_pages]:
            extracted = page.extract_text() or ""
            if extracted:
                text_parts.append(extracted)
        text = "\n".join(text_parts).strip()
        text = re.sub(r"\s+", " ", text)
        return text
    except Exception as exc:
        logger.warning("CSF: no se pudo extraer texto nativo del PDF: %s", exc)
        return ""


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


CSF_TEXT_EXTRACTION_PROMPT = """Analiza este TEXTO extraído de una Constancia de Situación Fiscal (CSF) del SAT de México.
Extrae TODOS los datos disponibles y devuélvelos en formato JSON con EXACTAMENTE estas claves:

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
"""


def _resolve_api_key(tenant, provider: str) -> str | None:
    """Resuelve la API key para el proveedor dado: tenant primero, luego .env."""
    # Primero intentar TenantAIConfig
    if tenant is not None:
        try:
            from tenancy.models import TenantAIConfig
            ai_cfg = getattr(tenant, "ai_config", None)
            if ai_cfg is None:
                try:
                    ai_cfg = TenantAIConfig.objects.get(tenant=tenant)
                except TenantAIConfig.DoesNotExist:
                    ai_cfg = None
            if ai_cfg and ai_cfg.api_key:
                return ai_cfg.api_key
        except Exception as exc:
            logger.warning("CSF: no se pudo leer TenantAIConfig: %s", exc)

    # Fallback a settings globales según proveedor
    if provider == "gemini":
        return getattr(settings, "GEMINI_API_KEY", None)
    return getattr(settings, "OPENAI_API_KEY", None)


def _extract_with_gemini(image_urls: list[str], api_key: str) -> dict[str, Any]:
    """Extrae datos de CSF usando Gemini Vision (inline bytes, sin PIL)."""
    import google.generativeai as genai

    genai.configure(api_key=api_key)
    model_name = getattr(settings, "GEMINI_DEFAULT_MODEL", "gemini-1.5-flash")
    model = genai.GenerativeModel(model_name)

    parts: list[Any] = [CSF_EXTRACTION_PROMPT]
    for url in image_urls:
        header, b64data = url.split(",", 1)
        mime = header.split(":")[1].split(";")[0]
        img_bytes = base64.b64decode(b64data)
        parts.append({"mime_type": mime, "data": img_bytes})

    response = model.generate_content(parts)
    raw = response.text.strip()
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[-1]
        raw = raw.rsplit("```", 1)[0].strip()
    return json.loads(raw)


def _extract_from_text_with_gemini(text: str, api_key: str) -> dict[str, Any]:
    """Parsea texto de CSF usando Gemini (sin visión)."""
    import google.generativeai as genai

    genai.configure(api_key=api_key)
    model_name = getattr(settings, "GEMINI_DEFAULT_MODEL", "gemini-1.5-flash")
    model = genai.GenerativeModel(model_name)

    response = model.generate_content([
        CSF_TEXT_EXTRACTION_PROMPT,
        "\n\nTEXTO CSF:\n",
        text,
    ])
    raw = response.text.strip()
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[-1]
        raw = raw.rsplit("```", 1)[0].strip()
    return json.loads(raw)


def _extract_with_openai(image_urls: list[str], api_key: str) -> dict[str, Any]:
    """Extrae datos de CSF usando OpenAI Vision."""
    from openai import OpenAI

    content: list[dict] = [{"type": "text", "text": CSF_EXTRACTION_PROMPT}]
    for url in image_urls:
        content.append({
            "type": "image_url",
            "image_url": {"url": url, "detail": "high"},
        })

    client = OpenAI(api_key=api_key, timeout=60)
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": content}],
        max_tokens=2000,
        temperature=0.1,
    )
    raw = (response.choices[0].message.content or "").strip()
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[-1]
        raw = raw.rsplit("```", 1)[0].strip()
    return json.loads(raw)


def _extract_from_text_with_openai(text: str, api_key: str) -> dict[str, Any]:
    """Parsea texto de CSF usando OpenAI (sin visión)."""
    from openai import OpenAI

    client = OpenAI(api_key=api_key, timeout=60)
    model_name = getattr(settings, "OPENAI_DEFAULT_MODEL", "gpt-4o-mini")
    response = client.chat.completions.create(
        model=model_name,
        messages=[
            {"role": "system", "content": "Devuelve solo JSON válido."},
            {
                "role": "user",
                "content": f"{CSF_TEXT_EXTRACTION_PROMPT}\n\nTEXTO CSF:\n{text}",
            },
        ],
        max_tokens=1400,
        temperature=0.0,
        response_format={"type": "json_object"},
    )
    raw = (response.choices[0].message.content or "").strip()
    return json.loads(raw)


def extract_csf_data(file_content: bytes, filename: str = "csf.pdf", *, tenant=None) -> dict[str, Any]:
    """Extrae datos de un PDF/imagen de CSF usando Vision AI.

    Usa Gemini Vision si AI_PROVIDER=gemini o hay GEMINI_API_KEY disponible.
    Cae a OpenAI Vision si solo hay OPENAI_API_KEY.
    """
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    is_pdf = ext == "pdf"

    image_urls: list[str] = []
    if not is_pdf:
        mime_map = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png", "webp": "image/webp"}
        mime = mime_map.get(ext, "image/jpeg")
        b64 = base64.b64encode(file_content).decode("utf-8")
        image_urls = [f"data:{mime};base64,{b64}"]

    # Determinar proveedor: preferir Gemini si está disponible
    ai_provider = getattr(settings, "AI_PROVIDER", "openai").lower()
    gemini_key = _resolve_api_key(tenant, "gemini")
    openai_key = _resolve_api_key(tenant, "openai")

    use_gemini = bool(gemini_key) and (ai_provider == "gemini" or not openai_key)

    try:
        if is_pdf:
            pdf_text = _extract_pdf_text(file_content, max_pages=3)
            if len(pdf_text) >= 150:
                logger.info("CSF: usando extracción por texto nativo de PDF")
                if use_gemini:
                    data = _extract_from_text_with_gemini(pdf_text, gemini_key)
                elif openai_key:
                    data = _extract_from_text_with_openai(pdf_text, openai_key)
                else:
                    raise RuntimeError("No hay API key de IA configurada (GEMINI_API_KEY ni OPENAI_API_KEY)")
            else:
                logger.info("CSF: PDF sin texto utilizable, usando Vision")
                image_urls = _pdf_to_images_b64(file_content)
                if use_gemini:
                    data = _extract_with_gemini(image_urls, gemini_key)
                elif openai_key:
                    data = _extract_with_openai(image_urls, openai_key)
                else:
                    raise RuntimeError("No hay API key de IA configurada (GEMINI_API_KEY ni OPENAI_API_KEY)")
        else:
            if use_gemini:
                logger.info("CSF: usando Gemini Vision")
                data = _extract_with_gemini(image_urls, gemini_key)
            elif openai_key:
                logger.info("CSF: usando OpenAI Vision")
                data = _extract_with_openai(image_urls, openai_key)
            else:
                raise RuntimeError("No hay API key de IA configurada (GEMINI_API_KEY ni OPENAI_API_KEY)")

        logger.info("CSF extraída exitosamente: RFC=%s", data.get("rfc", "?"))
        return data

    except json.JSONDecodeError as exc:
        logger.error("CSF: respuesta no es JSON válido")
        raise RuntimeError(f"No se pudo parsear la respuesta de AI: {exc}") from exc
    except RuntimeError:
        raise
    except Exception as exc:
        logger.error("CSF: error al invocar Vision AI: %s", exc)
        raise RuntimeError(f"Error al extraer datos de la CSF: {exc}") from exc
