from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)


def _tokenize(text: str | None) -> set[str]:
    """Tokeniza texto en palabras de 3+ caracteres para matching."""
    if not text:
        return set()
    tokens: list[str] = []
    current: list[str] = []
    for char in text.lower():
        if char.isalpha() or char.isdigit():
            current.append(char)
            continue
        if current:
            tokens.append("".join(current))
            current = []
    if current:
        tokens.append("".join(current))
    return {token for token in tokens if len(token) >= 3}


def suggest_clauses(
    *,
    categoria: str | None,
    proceso: str | None,
    idioma: str | None,
    query: str | None,
    resumen_necesidades: str | None = None,
    limit: int = 6,
) -> list[dict[str, Any]]:
    """Sugiere cláusulas relevantes desde la base de datos.

    Consulta ClauseTemplate activas, aplica scoring por categoría, proceso
    y coincidencia de keywords, y devuelve las más relevantes.
    """
    from ..models import ClauseTemplate

    keywords = _tokenize(query) | _tokenize(resumen_necesidades)

    qs = ClauseTemplate.objects.filter(activo=True)
    clauses = list(qs.values(
        "slug", "titulo", "texto", "resumen", "categorias",
        "procesos", "nivel_riesgo", "tips_redline", "palabras_clave",
        "prioridad", "es_curada", "version",
    ))

    results: list[dict[str, Any]] = []

    for entry in clauses:
        score = float(entry.get("prioridad", 1))

        entry_categorias = entry.get("categorias") or []
        if categoria and categoria in entry_categorias:
            score += 3

        entry_procesos = entry.get("procesos") or []
        if proceso and proceso in entry_procesos:
            score += 2

        if idioma and idioma.lower().startswith("en"):
            score -= 0.5

        if keywords:
            entry_keywords = {kw.lower() for kw in (entry.get("palabras_clave") or [])}
            overlap = keywords & entry_keywords
            if overlap:
                score += 1.2 * len(overlap)

        # Map DB fields to API response format
        enriched: dict[str, Any] = {
            "slug": entry["slug"],
            "titulo": entry["titulo"],
            "texto": entry["texto"],
            "resumen": entry["resumen"],
            "categorias_contrato": entry_categorias,
            "procesos": entry_procesos,
            "nivel_riesgo": entry["nivel_riesgo"],
            "tips_redline": entry.get("tips_redline") or [],
            "palabras_clave": entry.get("palabras_clave") or [],
            "prioridad": entry.get("prioridad", 1),
        }
        relevancia = max(0.15, min(1.0, score / 10.0))
        enriched["relevancia"] = round(relevancia, 2)
        results.append(enriched)

    results.sort(
        key=lambda item: (item["relevancia"], item.get("prioridad", 0)),
        reverse=True,
    )
    return results[: limit or 6]
