from __future__ import annotations

import hashlib
import logging
from datetime import timedelta
from typing import Any

from django.conf import settings
from django.utils import timezone

from ..models import ContractCitationCache, ContratoTemplate, Empresa
from .citations import generate_legal_citations

logger = logging.getLogger(__name__)

_CACHE_TTL_MINUTES = getattr(settings, "CITATION_CACHE_TTL_MINUTES", 720)
_CACHE_TTL = timedelta(minutes=_CACHE_TTL_MINUTES)
_CITATION_CORPUS_VERSION = getattr(settings, "CITATION_CORPUS_VERSION", "v1")


def _hash_document(markdown_text: str) -> str:
    return hashlib.sha256(markdown_text.encode("utf-8")).hexdigest()


def _cache_entry_is_valid(entry: ContractCitationCache | None) -> bool:
    if not entry:
        return False
    if entry.is_stale:
        return False
    if entry.sources_version and entry.sources_version != _CITATION_CORPUS_VERSION:
        return False
    if timezone.now() - entry.updated_at > _CACHE_TTL:
        return False
    return True


def get_or_generate_citations(
    *,
    document_text: str,
    idioma: str = "es",
    empresa: Empresa | None = None,
    template: ContratoTemplate | None = None,
    contrato_id: int | None = None,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """Obtiene citas legales reutilizando caché cuando sea posible."""

    doc_hash = _hash_document(document_text)
    cache_entry = ContractCitationCache.objects.filter(documento_hash=doc_hash).first()

    metadata: dict[str, Any] = {
        "documento_hash": doc_hash,
        "cache_hit": False,
        "cache_updated_at": cache_entry.updated_at.isoformat() if cache_entry else None,
        "cache_sources_version": cache_entry.sources_version if cache_entry else _CITATION_CORPUS_VERSION,
        "cache_id": cache_entry.id if cache_entry else None,
        "cache_contrato_id": cache_entry.contrato_id if cache_entry else None,
    }

    if _cache_entry_is_valid(cache_entry):
        metadata.update(
            {
                "cache_hit": True,
                "cache_updated_at": cache_entry.updated_at.isoformat(),
                "cache_sources_version": cache_entry.sources_version,
                "regenerations": cache_entry.regenerations,
            }
        )
        return cache_entry.payload, metadata

    citations = generate_legal_citations(
        contrato_markdown=document_text,
        empresa=empresa,
        template=template,
        idioma=idioma,
    )

    defaults: dict[str, Any] = {
        "idioma": idioma,
        "fuente": "AI",
        "payload": citations,
        "modelo": "",
        "sources_version": _CITATION_CORPUS_VERSION,
        "is_stale": False,
        "regenerations": (cache_entry.regenerations + 1) if cache_entry else 0,
    }

    if contrato_id is not None:
        defaults["contrato_id"] = contrato_id

    ContractCitationCache.objects.update_or_create(
        documento_hash=doc_hash,
        defaults=defaults,
    )

    metadata.update(
        {
            "cache_hit": False,
            "cache_updated_at": timezone.now().isoformat(),
            "cache_sources_version": _CITATION_CORPUS_VERSION,
            "regenerations": defaults["regenerations"],
        }
    )
    if contrato_id is not None:
        metadata["cache_contrato_id"] = contrato_id
    return citations, metadata
