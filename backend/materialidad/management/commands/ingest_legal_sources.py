from __future__ import annotations

import hashlib
from pathlib import Path
from typing import Iterable

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils.text import slugify

from materialidad.models import LegalReferenceSource

try:  # pragma: no cover - dependency validation
    from pypdf import PdfReader  # type: ignore
except ModuleNotFoundError:  # pragma: no cover
    PdfReader = None


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

        pdf_files = sorted(base_path.rglob("*.pdf"))
        if not pdf_files:
            self.stdout.write(self.style.WARNING("No se encontraron PDFs para procesar"))
            return

        dry_run: bool = options["dry_run"]
        chunk_size: int = options["chunk_size"]
        overlap: int = options["overlap"]
        max_chunks: int | None = options["max_chunks"]

        created, updated = 0, 0

        for pdf_path in pdf_files:
            law_name = options.get("ley") or self._guess_law_name(pdf_path)
            tipo_fuente = options["tipo_fuente"]
            base_metadata = {
                "source_file": str(pdf_path),
                "ley": law_name,
                "tipo_fuente": tipo_fuente,
                "vigencia": options.get("vigencia"),
                "fuente_documento": options.get("fuente_documento"),
                "fuente_url": options.get("fuente_url"),
                "sat_categoria": options.get("sat_categoria"),
            }

            try:
                raw_text = self._extract_text(pdf_path)
            except CommandError as exc:
                self.stderr.write(self.style.ERROR(str(exc)))
                continue

            chunks = list(self._chunk_text(raw_text, chunk_size, overlap))
            if max_chunks is not None:
                chunks = chunks[:max_chunks]

            for index, chunk in enumerate(chunks):
                slug = self._build_slug(law_name, pdf_path, index)
                resumen = self._summarize(chunk)
                hash_value = self._hash_chunk(law_name, pdf_path, index, chunk)
                defaults = {
                    "ley": law_name,
                    "tipo_fuente": tipo_fuente,
                    "contenido": chunk,
                    "resumen": resumen,
                    "vigencia": options.get("vigencia") or "",
                    "fuente_documento": options.get("fuente_documento") or "",
                    "fuente_url": options.get("fuente_url") or "",
                    "sat_categoria": options.get("sat_categoria") or "",
                    "hash_contenido": hash_value,
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

        summary = f"Procesados {len(pdf_files)} archivos | {created} nuevos | {updated} actualizados"
        colorizer = self.style.SUCCESS if not dry_run else self.style.WARNING
        self.stdout.write(colorizer(summary))

    def _guess_law_name(self, pdf_path: Path) -> str:
        stem = pdf_path.stem.replace("_", " ")
        return stem.title()

    def _extract_text(self, pdf_path: Path) -> str:
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
