from __future__ import annotations

import hashlib
from datetime import date
from pathlib import Path
from typing import Iterable

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone
from django.utils.text import slugify

from materialidad.legal_corpus import HASH_VECTOR_MODEL, build_hashed_embedding
from materialidad.models import LegalReferenceSource

try:  # pragma: no cover - dependency validation
    from pypdf import PdfReader  # type: ignore
except ModuleNotFoundError:  # pragma: no cover
    PdfReader = None

try:  # pragma: no cover - dependency validation
    from docx import Document  # type: ignore
except ModuleNotFoundError:  # pragma: no cover
    Document = None


SUPPORTED_EXTENSIONS = (".pdf", ".txt", ".md", ".docx")


class Command(BaseCommand):
    help = "Ingesta un corpus PDF en fragmentos legales estructurados para citas automáticas."

    def add_arguments(self, parser):
        parser.add_argument(
            "--path",
            default="docs/fuentes",
            help="Ruta base donde se ubican los PDFs oficiales (por defecto docs/fuentes)",
        )
        parser.add_argument(
            "--ley",
            help="Nombre de la ley o fuente. Si se omite se usa el nombre del archivo",
        )
        parser.add_argument(
            "--tipo-fuente",
            default=LegalReferenceSource.SourceType.LEY,
            choices=[choice[0] for choice in LegalReferenceSource.SourceType.choices],
            help="Tipo de fuente (ley, reglamento, criterio SAT, etc.)",
        )
        parser.add_argument(
            "--estatus-vigencia",
            default=LegalReferenceSource.VigencyStatus.VIGENTE,
            choices=[choice[0] for choice in LegalReferenceSource.VigencyStatus.choices],
            help="Estatus estructurado de vigencia del documento",
        )
        parser.add_argument(
            "--fecha-vigencia-desde",
            help="Fecha inicial de vigencia en formato YYYY-MM-DD",
        )
        parser.add_argument(
            "--fecha-vigencia-hasta",
            help="Fecha final de vigencia en formato YYYY-MM-DD",
        )
        parser.add_argument(
            "--fecha-ultima-revision",
            help="Fecha de última validación del documento frente a la fuente oficial en formato YYYY-MM-DD",
        )
        parser.add_argument(
            "--autoridad-emisora",
            help="Autoridad o entidad emisora oficial (DOF, SAT, SCJN, TFJA, CINIF, etc.)",
        )
        parser.add_argument(
            "--forzar-vigencia",
            action="store_true",
            help="Permite conservar estatus VIGENTE incluso para archivos genéricos tipo notebook/compendio interno.",
        )
        parser.add_argument(
            "--vigencia",
            help="Texto de vigencia para anotar en cada fragmento",
        )
        parser.add_argument(
            "--fuente-documento",
            help="Leyenda para citar el DOF o documento oficial",
        )
        parser.add_argument(
            "--fuente-url",
            help="URL oficial del documento fuente",
        )
        parser.add_argument(
            "--sat-categoria",
            help="Etiqueta personalizada para criterios SAT u otras referencias",
        )
        parser.add_argument(
            "--chunk-size",
            type=int,
            default=1200,
            help="Número aproximado de caracteres por fragmento",
        )
        parser.add_argument(
            "--overlap",
            type=int,
            default=200,
            help="Cantidad de caracteres que se repite entre fragmentos contiguos",
        )
        parser.add_argument(
            "--max-chunks",
            type=int,
            help="Límite de fragmentos por archivo para pruebas",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Procesa y muestra estadísticas sin escribir en la base de datos",
        )

    def handle(self, *args, **options):
        base_path = Path(options["path"]).expanduser().resolve()
        if not base_path.exists():
            raise CommandError(f"La ruta {base_path} no existe")
        if PdfReader is None:
            raise CommandError(
                "El paquete 'pypdf' es requerido para la ingesta de PDFs. Añádelo a requirements.txt"
            )

        source_files = self._discover_source_files(base_path)
        if not source_files:
            supported = ", ".join(SUPPORTED_EXTENSIONS)
            self.stdout.write(
                self.style.WARNING(
                    f"No se encontraron documentos compatibles en {base_path} ({supported})"
                )
            )
            return

        dry_run: bool = options["dry_run"]
        chunk_size: int = options["chunk_size"]
        overlap: int = options["overlap"]
        max_chunks: int | None = options["max_chunks"]

        created, updated = 0, 0

        for source_path in source_files:
            law_name = options.get("ley") or self._guess_law_name(source_path)
            tipo_fuente = options["tipo_fuente"]
            structured_vigency = self._resolve_vigency_fields(options, source_path)
            base_metadata = {
                "source_file": str(source_path),
                "ley": law_name,
                "tipo_fuente": tipo_fuente,
                "source_extension": source_path.suffix.lower(),
                "vigencia": options.get("vigencia"),
                "estatus_vigencia": structured_vigency["estatus_vigencia"],
                "es_vigente": structured_vigency["es_vigente"],
                "fecha_vigencia_desde": self._date_to_string(structured_vigency["fecha_vigencia_desde"]),
                "fecha_vigencia_hasta": self._date_to_string(structured_vigency["fecha_vigencia_hasta"]),
                "fecha_ultima_revision": self._date_to_string(structured_vigency["fecha_ultima_revision"]),
                "autoridad_emisora": structured_vigency["autoridad_emisora"],
                "fuente_documento": options.get("fuente_documento"),
                "fuente_url": options.get("fuente_url"),
                "sat_categoria": options.get("sat_categoria"),
            }

            try:
                raw_text = self._extract_text(source_path)
            except CommandError as exc:
                self.stderr.write(self.style.ERROR(str(exc)))
                continue

            chunks = list(self._chunk_text(raw_text, chunk_size, overlap))
            if max_chunks is not None:
                chunks = chunks[:max_chunks]

            for index, chunk in enumerate(chunks):
                slug = self._build_slug(law_name, source_path, index)
                resumen = self._summarize(chunk)
                hash_value = self._hash_chunk(law_name, source_path, index, chunk)
                vector = build_hashed_embedding(chunk)
                defaults = {
                    "ley": law_name,
                    "ordenamiento": law_name,
                    "tipo_fuente": tipo_fuente,
                    "estatus_vigencia": structured_vigency["estatus_vigencia"],
                    "es_vigente": structured_vigency["es_vigente"],
                    "fecha_vigencia_desde": structured_vigency["fecha_vigencia_desde"],
                    "fecha_vigencia_hasta": structured_vigency["fecha_vigencia_hasta"],
                    "fecha_ultima_revision": structured_vigency["fecha_ultima_revision"],
                    "autoridad_emisora": structured_vigency["autoridad_emisora"],
                    "contenido": chunk,
                    "resumen": resumen,
                    "vigencia": options.get("vigencia") or "",
                    "fuente_documento": options.get("fuente_documento") or "",
                    "fuente_url": options.get("fuente_url") or "",
                    "sat_categoria": options.get("sat_categoria") or "",
                    "hash_contenido": hash_value,
                    "vectorizacion": vector,
                    "vectorizacion_modelo": HASH_VECTOR_MODEL,
                    "vectorizacion_dim": len(vector),
                    "vectorizado_en": timezone.now(),
                    "metadata": {**base_metadata, "chunk_index": index},
                }

                if dry_run:
                    created += 1
                    self.stdout.write(
                        f"[DRY-RUN] {slug} -> {len(chunk)} caracteres | hash {hash_value[:10]}"
                    )
                    continue

                with transaction.atomic():
                    obj, was_created = LegalReferenceSource.objects.update_or_create(
                        slug=slug,
                        defaults=defaults,
                    )
                if was_created:
                    created += 1
                else:
                    updated += 1

        summary = f"Procesados {len(source_files)} archivos | {created} nuevos | {updated} actualizados"
        colorizer = self.style.SUCCESS if not dry_run else self.style.WARNING
        self.stdout.write(colorizer(summary))

    def _guess_law_name(self, file_path: Path) -> str:
        raw_tokens = [file_path.stem, file_path.parent.name]
        normalized = " ".join(raw_tokens).replace("_", " ").replace("-", " ").lower()
        normalized = " ".join(normalized.split())

        if "reg" in normalized and "lisr" in normalized:
            return "Reglamento de la Ley del Impuesto sobre la Renta"
        if "lisr" in normalized:
            return "Ley del Impuesto sobre la Renta"
        if "liva" in normalized and "reg" in normalized:
            return "Reglamento de la Ley del Impuesto al Valor Agregado"
        if "liva" in normalized:
            return "Ley del Impuesto al Valor Agregado"
        if "cff" in normalized or "codigo fiscal" in normalized:
            return "Código Fiscal de la Federación"

        stem = file_path.stem.replace("_", " ")
        return stem.title()

    def _discover_source_files(self, base_path: Path) -> list[Path]:
        source_files: list[Path] = []
        for extension in SUPPORTED_EXTENSIONS:
            source_files.extend(base_path.rglob(f"*{extension}"))
        return sorted(set(source_files))

    def _extract_text(self, file_path: Path) -> str:
        extension = file_path.suffix.lower()
        if extension == ".pdf":
            return self._extract_pdf_text(file_path)
        if extension in {".txt", ".md"}:
            return self._extract_plain_text(file_path)
        if extension == ".docx":
            return self._extract_docx_text(file_path)
        raise CommandError(f"Formato no soportado para ingesta: {file_path.name}")

    def _extract_pdf_text(self, pdf_path: Path) -> str:
        try:
            reader = PdfReader(str(pdf_path))
        except Exception as exc:  # pragma: no cover - PDF parsing errors
            raise CommandError(f"No se pudo leer {pdf_path.name}: {exc}") from exc

        pages: list[str] = []
        for page in reader.pages:
            text = page.extract_text() or ""
            pages.append(text)
        full_text = "\n".join(pages)
        if not full_text.strip():
            raise CommandError(f"El PDF {pdf_path.name} no contiene texto extraíble")
        return full_text

    def _extract_plain_text(self, file_path: Path) -> str:
        try:
            text = file_path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            text = file_path.read_text(encoding="latin-1")
        except Exception as exc:
            raise CommandError(f"No se pudo leer {file_path.name}: {exc}") from exc
        if not text.strip():
            raise CommandError(f"El archivo {file_path.name} no contiene texto útil")
        return text

    def _extract_docx_text(self, file_path: Path) -> str:
        if Document is None:
            raise CommandError(
                "El paquete 'python-docx' es requerido para la ingesta de archivos DOCX"
            )
        try:
            document = Document(str(file_path))
        except Exception as exc:
            raise CommandError(f"No se pudo leer {file_path.name}: {exc}") from exc

        paragraphs = [paragraph.text.strip() for paragraph in document.paragraphs if paragraph.text.strip()]
        text = "\n\n".join(paragraphs)
        if not text.strip():
            raise CommandError(f"El archivo DOCX {file_path.name} no contiene texto útil")
        return text

    def _chunk_text(self, text: str, chunk_size: int, overlap: int) -> Iterable[str]:
        cleaned = "\n".join(line.strip() for line in text.splitlines())
        cleaned = "\n\n".join(filter(None, cleaned.split("\n\n")))
        if not cleaned:
            return
        step = max(chunk_size - overlap, 200)
        start = 0
        length = len(cleaned)
        while start < length:
            end = min(start + chunk_size, length)
            chunk = cleaned[start:end].strip()
            if chunk:
                yield chunk
            if end == length:
                break
            start += step

    def _build_slug(self, law_name: str, pdf_path: Path, index: int) -> str:
        base = slugify(f"{law_name}-{pdf_path.stem}-{index}")
        if not base:
            base = hashlib.sha1(f"{pdf_path}-{index}".encode(), usedforsecurity=False).hexdigest()
        return base[:250]

    def _summarize(self, chunk: str) -> str:
        max_len = 320
        if len(chunk) <= max_len:
            return chunk
        return f"{chunk[:max_len].rstrip()}…"

    def _hash_chunk(self, law_name: str, pdf_path: Path, index: int, chunk: str) -> str:
        payload = f"{law_name}|{pdf_path}|{index}|{chunk}".encode("utf-8")
        return hashlib.sha256(payload).hexdigest()

    def _parse_iso_date(self, raw_value: str | None, field_name: str) -> date | None:
        if not raw_value:
            return None
        try:
            return date.fromisoformat(str(raw_value).strip())
        except ValueError as exc:
            raise CommandError(f"{field_name} debe usar formato YYYY-MM-DD") from exc

    def _date_to_string(self, value: date | None) -> str | None:
        return value.isoformat() if value else None

    def _resolve_vigency_fields(self, options, source_path: Path) -> dict[str, object]:
        estatus_vigencia = options.get("estatus_vigencia") or LegalReferenceSource.VigencyStatus.VIGENTE
        fecha_vigencia_desde = self._parse_iso_date(options.get("fecha_vigencia_desde"), "--fecha-vigencia-desde")
        fecha_vigencia_hasta = self._parse_iso_date(options.get("fecha_vigencia_hasta"), "--fecha-vigencia-hasta")
        fecha_ultima_revision = self._parse_iso_date(options.get("fecha_ultima_revision"), "--fecha-ultima-revision")
        if fecha_vigencia_desde and fecha_vigencia_hasta and fecha_vigencia_desde > fecha_vigencia_hasta:
            raise CommandError("--fecha-vigencia-hasta debe ser igual o posterior a --fecha-vigencia-desde")
        if (
            estatus_vigencia == LegalReferenceSource.VigencyStatus.VIGENTE
            and self._is_generic_compendium_file(source_path)
            and not options.get("forzar_vigencia")
        ):
            self.stdout.write(
                self.style.WARNING(
                    f"{source_path.name}: corpus genérico detectado; se marcará como DESCONOCIDA para no contaminar la recuperación de normativa vigente. Usa --forzar-vigencia si realmente es una fuente oficial consolidada."
                )
            )
            estatus_vigencia = LegalReferenceSource.VigencyStatus.DESCONOCIDA
        es_vigente = estatus_vigencia == LegalReferenceSource.VigencyStatus.VIGENTE
        return {
            "estatus_vigencia": estatus_vigencia,
            "es_vigente": es_vigente,
            "fecha_vigencia_desde": fecha_vigencia_desde,
            "fecha_vigencia_hasta": fecha_vigencia_hasta,
            "fecha_ultima_revision": fecha_ultima_revision,
            "autoridad_emisora": (options.get("autoridad_emisora") or "").strip(),
        }

    def _is_generic_compendium_file(self, source_path: Path) -> bool:
        normalized_name = source_path.name.lower()
        return "contenido_notebook" in normalized_name or "notebook" in normalized_name
