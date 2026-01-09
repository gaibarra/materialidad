from __future__ import annotations

import io
import json
import os
import re
from typing import Any, Iterable
from zipfile import ZIP_DEFLATED, ZipFile

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from django.core.files.storage import default_storage
from django.utils import timezone
from django.utils.text import slugify

from .models import CompliancePillar, Operacion, OperacionEntregable

__all__ = ["markdown_to_docx_bytes", "build_operacion_dossier_zip"]

_HEADING_PATTERN = re.compile(r"^(#{1,6})\s+(.*)$")
_BULLET_PATTERN = re.compile(r"^\s*[-*+]\s+(.*)$")
_ORDERED_PATTERN = re.compile(r"^\s*(\d+)[\.)]\s+(.*)$")
_INLINE_TOKEN_PATTERN = re.compile(r"(\*\*.+?\*\*|__.+?__|\*.+?\*|_.+?_)")


def _append_formatted_runs(paragraph, text: str) -> None:
    """Convierte énfasis básico de Markdown en runs con estilo."""

    if not text:
        paragraph.add_run("")
        return

    for token in _INLINE_TOKEN_PATTERN.split(text):
        if not token:
            continue
        if token.startswith("**") and token.endswith("**"):
            run = paragraph.add_run(token[2:-2])
            run.bold = True
        elif token.startswith("__") and token.endswith("__"):
            run = paragraph.add_run(token[2:-2])
            run.bold = True
        elif token.startswith("*") and token.endswith("*"):
            run = paragraph.add_run(token[1:-1])
            run.italic = True
        elif token.startswith("_") and token.endswith("_"):
            run = paragraph.add_run(token[1:-1])
            run.italic = True
        else:
            paragraph.add_run(token)


def _add_paragraph(document: Document, text: str, *, style: str | None = None):
    paragraph = document.add_paragraph(style=style)
    paragraph.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    _append_formatted_runs(paragraph, text)
    return paragraph


def markdown_to_docx_bytes(markdown_text: str) -> bytes:
    """Convierte Markdown sencillo a un archivo DOCX en memoria."""

    if not markdown_text or not markdown_text.strip():
        raise ValueError("El contenido del contrato no puede estar vacío")

    document = Document()
    for raw_line in markdown_text.splitlines():
        line = raw_line.rstrip()
        stripped = line.strip()
        if not stripped:
            _add_paragraph(document, "")
            continue

        if stripped in {"---", "***", "___"}:
            _add_paragraph(document, "")
            continue

        heading_match = _HEADING_PATTERN.match(stripped)
        if heading_match:
            hashes, text = heading_match.groups()
            level = min(len(hashes), 4)
            heading = document.add_heading("", level=level)
            heading.alignment = WD_ALIGN_PARAGRAPH.LEFT
            _append_formatted_runs(heading, text.strip())
            continue

        bullet_match = _BULLET_PATTERN.match(stripped)
        if bullet_match:
            _add_paragraph(document, bullet_match.group(1).strip(), style="List Bullet")
            continue

        ordered_match = _ORDERED_PATTERN.match(stripped)
        if ordered_match:
            _add_paragraph(document, ordered_match.group(2).strip(), style="List Number")
            continue

        _add_paragraph(document, stripped)

    buffer = io.BytesIO()
    document.save(buffer)
    buffer.seek(0)
    return buffer.getvalue()


def _ts(dt) -> str:
    if not dt:
        return ""
    if hasattr(dt, "isoformat"):
        return dt.isoformat()
    return str(dt)


def _safe_path(prefix: str, label: str, extension: str | None = None) -> str:
    safe_label = slugify(label) or "item"
    ext = extension or ""
    if ext and not ext.startswith("."):
        ext = f".{ext}"
    return f"{prefix}/{safe_label}{ext}".strip("/")


def _add_readme(zf: ZipFile, index: dict[str, Any]) -> None:
    lines = [
        "Dossier de defensa de materialidad",
        f"Operacion ID: {index.get('operacion_id')}",
        f"Empresa: {index.get('empresa')}",
        f"Proveedor: {index.get('proveedor') or '-'}",
        f"Contrato: {index.get('contrato') or '-'}",
        f"Generado: {index.get('generated_at')}",
        "",
        "Entradas ordenadas cronologicamente por pilar SAT:",
    ]
    for entry in index.get("entries", []):
        ts = entry.get("timestamp") or ""
        pillar = entry.get("pillar") or ""
        title = entry.get("title") or entry.get("kind")
        ref = entry.get("file_path") or entry.get("external_url") or "(sin archivo)"
        lines.append(f"- [{ts}] ({pillar}) {title} -> {ref}")
    zf.writestr("README.txt", "\n".join(lines))


def _add_json_index(zf: ZipFile, index: dict[str, Any]) -> None:
    payload = json.dumps(index, ensure_ascii=False, indent=2)
    zf.writestr("indice.json", payload)


def _stream_file_to_zip(zf: ZipFile, storage_path: str, zip_path: str) -> bool:
    if not storage_path:
        return False
    if not default_storage.exists(storage_path):
        return False
    with default_storage.open(storage_path, "rb") as fh:
        zf.writestr(zip_path, fh.read())
    return True


def _collect_entregables(operacion: Operacion) -> Iterable[dict[str, Any]]:
    entregables = getattr(operacion, "entregables_prefetched", None)
    items = entregables if entregables is not None else operacion.entregables.all()
    for ent in items:
        yield {
            "kind": "entregable",
            "id": ent.id,
            "title": ent.titulo,
            "pillar": ent.pillar,
            "timestamp": _ts(ent.created_at),
            "metadata": {
                "estado": ent.estado,
                "tipo_gasto": ent.tipo_gasto,
                "codigo": ent.codigo,
                "fecha_compromiso": _ts(ent.fecha_compromiso),
                "fecha_entregado": _ts(ent.fecha_entregado),
                "fecha_recepcion": _ts(ent.fecha_recepcion),
                "fecha_factura": _ts(ent.fecha_factura),
            },
            "external_url": ent.oc_archivo_url or "",
        }


def _collect_evidencias(operacion: Operacion) -> Iterable[dict[str, Any]]:
    for ev in operacion.evidencias.all():
        extension = os.path.splitext(ev.archivo.name or "")[1]
        yield {
            "kind": "evidencia",
            "id": ev.id,
            "title": ev.descripcion,
            "pillar": CompliancePillar.ENTREGABLES,
            "timestamp": _ts(ev.created_at),
            "file_name": ev.archivo.name,
            "zip_path": _safe_path("evidencias", ev.descripcion or f"evidencia-{ev.id}", extension),
            "metadata": {"tipo": ev.tipo},
        }


def _collect_contrato_archivos(operacion: Operacion) -> Iterable[dict[str, Any]]:
    contrato = operacion.contrato
    if not contrato:
        return []
    entries: list[dict[str, Any]] = []
    if contrato.archivo_notariado:
        extension = os.path.splitext(contrato.archivo_notariado.name or "")[1]
        entries.append(
            {
                "kind": "contrato",
                "id": contrato.id,
                "title": "fedatario_testimonio",
                "pillar": CompliancePillar.RAZON_NEGOCIO,
                "timestamp": _ts(contrato.fecha_ratificacion or contrato.updated_at),
                "file_name": contrato.archivo_notariado.name,
                "zip_path": _safe_path("contrato", "testimonio", extension),
                "metadata": {
                    "modalidad": contrato.firma_modalidad,
                    "fedatario": contrato.fedatario_nombre,
                    "numero_instrumento": contrato.numero_instrumento,
                },
            }
        )
    return entries


def build_operacion_dossier_zip(operacion: Operacion) -> bytes:
    """Construye un ZIP con indice para defender materialidad por operacion."""

    buffer = io.BytesIO()
    now = timezone.now().isoformat()

    entries: list[dict[str, Any]] = []
    entries.extend(_collect_entregables(operacion))
    entries.extend(_collect_evidencias(operacion))
    entries.extend(_collect_contrato_archivos(operacion))

    entries_sorted = sorted(entries, key=lambda e: e.get("timestamp") or "")
    index = {
        "operacion_id": operacion.id,
        "empresa": getattr(operacion.empresa, "razon_social", ""),
        "proveedor": getattr(operacion.proveedor, "razon_social", ""),
        "contrato": operacion.contrato_id,
        "monto": str(operacion.monto),
        "moneda": operacion.moneda,
        "fecha_operacion": _ts(operacion.fecha_operacion),
        "generated_at": now,
        "entries": entries_sorted,
    }

    with ZipFile(buffer, "w", compression=ZIP_DEFLATED) as zf:
        for entry in entries_sorted:
            file_name = entry.get("file_name")
            zip_path = entry.get("zip_path")
            if file_name and zip_path:
                ok = _stream_file_to_zip(zf, file_name, zip_path)
                if ok:
                    entry["file_path"] = zip_path
                else:
                    entry["file_path"] = None
                    entry["missing_file"] = True

        index["entries"] = entries_sorted
        _add_json_index(zf, index)
        _add_readme(zf, index)

    buffer.seek(0)
    return buffer.getvalue()
