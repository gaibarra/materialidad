from __future__ import annotations

import json
from difflib import SequenceMatcher
from json import JSONDecodeError
from textwrap import dedent
from typing import Any

from .client import ChatMessage, OpenAIClient
from .utils import public_model_label

REDLINE_SYSTEM_PROMPT = dedent(
    """
    Eres el abogado revisor del equipo de compliance. Comparas borradores de contrato para generar
    redlines inteligentes en lenguaje ejecutivo. Senala riesgos materiales, oportunidades de mejora y
    recomendaciones accionables.
    """
)


def _truncate(text: str, max_chars: int) -> str:
    trimmed = text.strip()
    if len(trimmed) <= max_chars:
        return trimmed
    head = trimmed[: max_chars // 2]
    tail = trimmed[-max_chars // 2 :]
    return f"{head}\n...\n{tail}"


def _build_prompt(original: str, revised: str, idioma: str) -> list[ChatMessage]:
    idioma_resumen = idioma or "es"
    user_content = dedent(
        f"""
        Idioma del resumen: {idioma_resumen}
        Entrega exclusivamente un objeto JSON con la siguiente estructura:
        {{
          "resumen": "parrafo conciso con el tono del idioma solicitado",
          "alerta_global": "ALTO|MEDIO|BAJO",
          "riesgos": [
            {{"titulo": str, "impacto": "ALTO|MEDIO|BAJO", "detalle": str, "accion": str}}
          ],
          "oportunidades": [
            {{"titulo": str, "descripcion": str}}
          ]
        }}

        Texto base:
        ```markdown
        {_truncate(original, 6000)}
        ```

        Version revisada / propuesta contra la cual generar los redlines:
        ```markdown
        {_truncate(revised, 6000)}
        ```
        """
    ).strip()

    return [
        ChatMessage(role="system", content=REDLINE_SYSTEM_PROMPT),
        ChatMessage(role="user", content=user_content),
    ]


def _safe_json(text: str) -> dict[str, Any]:
    if not text:
        return {}
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`").strip()
        if cleaned.lower().startswith("json"):
            cleaned = cleaned[4:].strip()
    try:
        return json.loads(cleaned)
    except JSONDecodeError:
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start != -1 and end != -1 and end > start:
            snippet = cleaned[start : end + 1]
            try:
                return json.loads(snippet)
            except JSONDecodeError:
                pass
    return {"resumen": cleaned}


def _summarize_changes(original: str, revised: str, idioma: str) -> dict[str, Any]:
    client = OpenAIClient()
    messages = _build_prompt(original, revised, idioma)
    raw = client.generate_text(messages, temperature=0.15, max_output_tokens=1100)
    parsed = _safe_json(raw)
    parsed["modelo"] = public_model_label(client.model_name)
    return parsed


def _summarize_lines(lines: list[str], *, max_lines: int) -> list[str]:
    if len(lines) <= max_lines:
        return lines
    head = lines[: max_lines // 2]
    tail = lines[-max_lines // 2 :]
    return head + ["..."] + tail


def _build_diff_segments(original: str, revised: str, *, max_segments: int = 120) -> list[dict[str, Any]]:
    orig_lines = original.splitlines()
    rev_lines = revised.splitlines()
    matcher = SequenceMatcher(None, orig_lines, rev_lines)
    segments: list[dict[str, Any]] = []

    for opcode, i1, i2, j1, j2 in matcher.get_opcodes():
        orig_chunk = orig_lines[i1:i2]
        rev_chunk = rev_lines[j1:j2]
        cap = 6 if opcode == "equal" else 10
        segment = {
            "type": opcode,
            "original": _summarize_lines(orig_chunk, max_lines=cap) if orig_chunk else [],
            "revisado": _summarize_lines(rev_chunk, max_lines=cap) if rev_chunk else [],
        }
        segments.append(segment)
        if len(segments) >= max_segments:
            break

    return segments


def analyze_redlines(*, original_text: str, revised_text: str, idioma: str = "es") -> dict[str, Any]:
    if not original_text.strip():
        raise ValueError("El texto original no puede estar vacio")
    if not revised_text.strip():
        raise ValueError("El texto revisado no puede estar vacio")

    diff_segments = _build_diff_segments(original_text, revised_text)
    matcher = SequenceMatcher(None, original_text.splitlines(), revised_text.splitlines())
    change_ratio = round(1 - matcher.ratio(), 4)
    summary = _summarize_changes(original_text, revised_text, idioma)

    riesgos = summary.get("riesgos") or []
    oportunidades = summary.get("oportunidades") or []
    alerta_global = summary.get("alerta_global") or "MEDIO"
    return {
        "diff": diff_segments,
        "change_ratio": change_ratio,
        "alerta_global": alerta_global,
        "resumen": summary.get("resumen", ""),
        "riesgos": riesgos,
        "oportunidades": oportunidades,
        "modelo": summary.get("modelo", "gpt-5-mini"),
    }
