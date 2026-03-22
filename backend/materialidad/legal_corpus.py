from __future__ import annotations

import hashlib
import math
import re
from pathlib import Path

from django.core.files.storage import default_storage
from django.db import transaction
from django.utils import timezone
from django.utils.text import slugify

from .models import LegalCorpusUpload, LegalReferenceSource

try:  # pragma: no cover - dependency validation
	from pypdf import PdfReader  # type: ignore
except ModuleNotFoundError:  # pragma: no cover
	PdfReader = None

try:  # pragma: no cover - dependency validation
	from docx import Document  # type: ignore
except ModuleNotFoundError:  # pragma: no cover
	Document = None


SUPPORTED_EXTENSIONS = (".pdf", ".txt", ".md", ".docx")
HASH_VECTOR_DIM = 64
HASH_VECTOR_MODEL = "hash64-v1"


def tokenize_legal_text(text: str) -> list[str]:
	return [token.lower() for token in re.findall(r"[\wÁ-ÿ]{3,}", text or "", flags=re.IGNORECASE)]


def build_hashed_embedding(text: str, *, dimensions: int = HASH_VECTOR_DIM) -> list[float]:
	if dimensions <= 0:
		return []
	vector = [0.0] * dimensions
	tokens = tokenize_legal_text(text)
	if not tokens:
		return vector
	for token in tokens:
		bucket = int(hashlib.sha256(token.encode("utf-8")).hexdigest(), 16) % dimensions
		vector[bucket] += 1.0
	norm = math.sqrt(sum(value * value for value in vector))
	if not norm:
		return vector
	return [round(value / norm, 6) for value in vector]


def cosine_similarity(left: list[float] | None, right: list[float] | None) -> float:
	if not left or not right or len(left) != len(right):
		return 0.0
	return float(sum(a * b for a, b in zip(left, right)))


def chunk_legal_text(text: str, *, chunk_size: int = 1200, overlap: int = 200) -> list[str]:
	cleaned = "\n".join(line.strip() for line in (text or "").splitlines())
	cleaned = "\n\n".join(filter(None, cleaned.split("\n\n")))
	if not cleaned:
		return []
	step = max(chunk_size - overlap, 200)
	chunks: list[str] = []
	start = 0
	length = len(cleaned)
	while start < length:
		end = min(start + chunk_size, length)
		chunk = cleaned[start:end].strip()
		if chunk:
			chunks.append(chunk)
		if end == length:
			break
		start += step
	return chunks


def is_generic_compendium_name(file_name: str) -> bool:
	lowered = (file_name or "").lower()
	return "contenido_notebook" in lowered or "notebook" in lowered or "compendio" in lowered


def extract_legal_text_from_storage(file_name: str) -> str:
	extension = Path(file_name).suffix.lower()
	if extension not in SUPPORTED_EXTENSIONS:
		raise ValueError(f"Formato no soportado: {extension}")
	if extension == ".pdf":
		if PdfReader is None:
			raise ValueError("El paquete 'pypdf' es requerido para leer PDFs")
		with default_storage.open(file_name, "rb") as fh:
			reader = PdfReader(fh)
			text = "\n".join((page.extract_text() or "") for page in reader.pages)
	elif extension == ".docx":
		if Document is None:
			raise ValueError("El paquete 'python-docx' es requerido para leer archivos DOCX")
		with default_storage.open(file_name, "rb") as fh:
			document = Document(fh)
			text = "\n\n".join(paragraph.text.strip() for paragraph in document.paragraphs if paragraph.text.strip())
	else:
		with default_storage.open(file_name, "rb") as fh:
			raw = fh.read()
		try:
			text = raw.decode("utf-8")
		except UnicodeDecodeError:
			text = raw.decode("latin-1", errors="ignore")
	if not text.strip():
		raise ValueError("El archivo no contiene texto útil")
	return text


def _clean_text(text: str) -> str:
	return re.sub(r"\s+", " ", (text or "").strip())


def _segment_from_matches(text: str, matches: list[re.Match[str]]) -> list[str]:
	segments: list[str] = []
	for index, match in enumerate(matches):
		start = match.start()
		end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
		segment = text[start:end].strip()
		if segment:
			segments.append(segment)
	return segments


def _build_segment_summary(text: str, *, max_len: int = 220) -> str:
	compact = _clean_text(text)
	if len(compact) <= max_len:
		return compact
	return f"{compact[:max_len].rstrip()}…"


def _split_large_segment(segment: dict[str, object], *, chunk_size: int, overlap: int) -> list[dict[str, object]]:
	content = str(segment.get("content") or "")
	chunks = chunk_legal_text(content, chunk_size=chunk_size, overlap=overlap)
	if len(chunks) <= 1:
		return [segment]
	result: list[dict[str, object]] = []
	for chunk_index, chunk in enumerate(chunks):
		metadata = dict(segment.get("metadata") or {})
		metadata["subchunk_index"] = chunk_index
		result.append(
			{
				**segment,
				"content": chunk,
				"summary": _build_segment_summary(chunk),
				"metadata": metadata,
			}
		)
	return result


def parse_dof_segments(text: str) -> list[dict[str, object]]:
	matches = list(re.finditer(r"(?im)^\s*art[ií]culo\s+([0-9a-zA-Z\-]+(?:\s+bis|\s+ter|\s+qu[aá]ter)?)", text))
	if not matches:
		return []
	segments: list[dict[str, object]] = []
	for segment_text in _segment_from_matches(text, matches):
		article_match = re.match(r"(?is)^\s*art[ií]culo\s+([0-9a-zA-Z\-]+(?:\s+bis|\s+ter|\s+qu[aá]ter)?)", segment_text)
		articulo = article_match.group(1).strip() if article_match else ""
		segments.append(
			{
				"content": segment_text,
				"articulo": articulo,
				"summary": _build_segment_summary(segment_text),
				"metadata": {"parser": "DOF", "section_type": "ARTICULO", "articulo": articulo},
			}
		)
	return segments


def parse_sat_segments(text: str) -> list[dict[str, object]]:
	pattern = re.compile(
		r"(?im)^\s*((?:regla\s+[0-9]+(?:\.[0-9A-Za-z]+)+)|(?:criterio\s+normativo.*)|(?:criterio\s+no\s+vinculativo.*)|(?:ficha\s+de\s+tr[aá]mite.*))"
	)
	matches = list(pattern.finditer(text))
	if not matches:
		return []
	segments: list[dict[str, object]] = []
	for segment_text in _segment_from_matches(text, matches):
		header = segment_text.splitlines()[0].strip()
		rule_match = re.match(r"(?i)^regla\s+([0-9]+(?:\.[0-9A-Za-z]+)+)", header)
		identifier = rule_match.group(1) if rule_match else header[:120]
		section_type = "REGLA" if rule_match else "CRITERIO"
		segments.append(
			{
				"content": segment_text,
				"summary": _build_segment_summary(segment_text),
				"metadata": {
					"parser": "SAT",
					"section_type": section_type,
					"identifier": identifier,
					"header": header,
				},
			}
		)
	return segments


def parse_scjn_segments(text: str) -> list[dict[str, object]]:
	pattern = re.compile(r"(?im)^\s*registro\s+digital\s*:\s*([0-9]+)")
	matches = list(pattern.finditer(text))
	if not matches:
		return []
	segments: list[dict[str, object]] = []
	for segment_text in _segment_from_matches(text, matches):
		registro_match = re.search(r"(?im)^\s*registro\s+digital\s*:\s*([0-9]+)", segment_text)
		rubro_match = re.search(r"(?im)^\s*rubro\s*:\s*(.+)$", segment_text)
		tesis_match = re.search(r"(?im)^\s*tesis\s*:\s*(.+)$", segment_text)
		registro = registro_match.group(1).strip() if registro_match else ""
		rubro = rubro_match.group(1).strip() if rubro_match else ""
		tesis = tesis_match.group(1).strip() if tesis_match else ""
		segments.append(
			{
				"content": segment_text,
				"summary": rubro or _build_segment_summary(segment_text),
				"metadata": {
					"parser": "SCJN",
					"section_type": "TESIS",
					"registro_digital": registro,
					"rubro": rubro,
					"tesis": tesis,
				},
			}
		)
	return segments


def parse_tfja_segments(text: str) -> list[dict[str, object]]:
	pattern = re.compile(
		r"(?im)^\s*((?:precedente\s+[ivxlcdm0-9\-\.]+)|(?:tesis\s+[ivxlcdm0-9\-\.]+)|(?:\d+-ta-sr-[0-9]+)|(?:[ivxlcdm0-9\-]+-tasr-[a-z0-9\-]+))"
	)
	matches = list(pattern.finditer(text))
	if not matches:
		return []
	segments: list[dict[str, object]] = []
	for segment_text in _segment_from_matches(text, matches):
		header = segment_text.splitlines()[0].strip()
		segments.append(
			{
				"content": segment_text,
				"summary": _build_segment_summary(segment_text),
				"metadata": {
					"parser": "TFJA",
					"section_type": "PRECEDENTE",
					"identifier": header[:180],
					"header": header,
				},
			}
		)
	return segments


def extract_structured_legal_segments(
	text: str,
	*,
	authority: str,
	chunk_size: int = 1200,
	overlap: int = 200,
) -> list[dict[str, object]]:
	authority = (authority or "").upper().strip()
	if authority == LegalCorpusUpload.Authority.DOF:
		segments = parse_dof_segments(text)
	elif authority == LegalCorpusUpload.Authority.SAT:
		segments = parse_sat_segments(text)
	elif authority == LegalCorpusUpload.Authority.SCJN:
		segments = parse_scjn_segments(text)
	elif authority == LegalCorpusUpload.Authority.TFJA:
		segments = parse_tfja_segments(text)
	else:
		segments = []

	if not segments:
		generic_chunks = chunk_legal_text(text, chunk_size=chunk_size, overlap=overlap)
		return [
			{
				"content": chunk,
				"summary": _build_segment_summary(chunk),
				"metadata": {"parser": "GENERIC", "section_type": "CHUNK", "chunk_index": index},
			}
			for index, chunk in enumerate(generic_chunks)
		]

	normalized_segments: list[dict[str, object]] = []
	for segment in segments:
		normalized_segments.extend(_split_large_segment(segment, chunk_size=chunk_size, overlap=overlap))
	for index, segment in enumerate(normalized_segments):
		metadata = dict(segment.get("metadata") or {})
		metadata.setdefault("chunk_index", index)
		segment["metadata"] = metadata
	return normalized_segments


def process_legal_corpus_upload(
	upload: LegalCorpusUpload,
	*,
	chunk_size: int = 1200,
	overlap: int = 200,
) -> dict[str, int]:
	upload.estatus = LegalCorpusUpload.ProcessingStatus.PROCESANDO
	upload.error_detalle = ""
	upload.save(update_fields=["estatus", "error_detalle", "updated_at"])

	try:
		text = extract_legal_text_from_storage(upload.archivo.name)
		segments = extract_structured_legal_segments(
			text,
			authority=upload.autoridad,
			chunk_size=chunk_size,
			overlap=overlap,
		)
		if not segments:
			raise ValueError("No fue posible generar fragmentos legales útiles")

		effective_status = upload.estatus_vigencia
		effective_is_current = upload.es_vigente
		if (
			effective_status == LegalReferenceSource.VigencyStatus.VIGENTE
			and is_generic_compendium_name(upload.archivo.name)
			and not upload.force_vigencia
		):
			effective_status = LegalReferenceSource.VigencyStatus.DESCONOCIDA
			effective_is_current = False

		created = 0
		updated = 0
		with transaction.atomic():
			for index, segment in enumerate(segments):
				chunk = str(segment.get("content") or "").strip()
				metadata = dict(segment.get("metadata") or {})
				hash_value = hashlib.sha256(
					f"{upload.ordenamiento}|{upload.autoridad}|{index}|{chunk}".encode("utf-8")
				).hexdigest()
				slug = slugify(f"{upload.slug}-{metadata.get('section_type', 'chunk')}-{index}")[:250] or hash_value[:32]
				vector = build_hashed_embedding(chunk)
				articulo = str(segment.get("articulo") or metadata.get("articulo") or "")[:64]
				fraccion = str(segment.get("fraccion") or metadata.get("fraccion") or "")[:64]
				parrafo = str(segment.get("parrafo") or metadata.get("parrafo") or "")[:64]
				defaults = {
					"slug": slug,
					"ley": upload.ordenamiento,
					"ordenamiento": upload.ordenamiento,
					"corpus_upload": upload,
					"tipo_fuente": upload.tipo_fuente,
					"estatus_vigencia": effective_status,
					"es_vigente": effective_is_current,
					"fecha_vigencia_desde": upload.fecha_vigencia_desde,
					"fecha_vigencia_hasta": upload.fecha_vigencia_hasta,
					"fecha_ultima_revision": upload.fecha_ultima_revision,
					"autoridad_emisora": upload.autoridad,
					"articulo": articulo,
					"fraccion": fraccion,
					"parrafo": parrafo,
					"contenido": chunk,
					"resumen": str(segment.get("summary") or _build_segment_summary(chunk)),
					"fuente_documento": upload.fuente_documento,
					"fuente_url": upload.fuente_url,
					"vigencia": upload.vigencia,
					"sat_categoria": upload.sat_categoria,
					"vectorizacion": vector,
					"vectorizacion_modelo": HASH_VECTOR_MODEL,
					"vectorizacion_dim": len(vector),
					"vectorizado_en": timezone.now(),
					"metadata": {
						"corpus_upload_id": upload.id,
						"chunk_index": index,
						"source_file": upload.archivo.name,
						"autoridad": upload.autoridad,
						**metadata,
					},
				}
				_, was_created = LegalReferenceSource.objects.update_or_create(
					hash_contenido=hash_value,
					defaults=defaults,
				)
				if was_created:
					created += 1
				else:
					updated += 1

			upload.total_fragmentos = len(segments)
			upload.fragmentos_procesados = len(segments)
			upload.estatus = LegalCorpusUpload.ProcessingStatus.COMPLETADO
			upload.error_detalle = ""
			upload.processed_at = timezone.now()
			upload.metadata = {
				**(upload.metadata or {}),
				"created": created,
				"updated": updated,
				"vector_model": HASH_VECTOR_MODEL,
				"vector_dim": HASH_VECTOR_DIM,
				"parser": upload.autoridad,
			}
			upload.save(
				update_fields=[
					"total_fragmentos",
					"fragmentos_procesados",
					"estatus",
					"error_detalle",
					"processed_at",
					"metadata",
					"updated_at",
				]
			)
		return {"created": created, "updated": updated, "chunks": len(segments)}
	except Exception as exc:
		upload.estatus = LegalCorpusUpload.ProcessingStatus.ERROR
		upload.error_detalle = str(exc)
		upload.processed_at = timezone.now()
		upload.save(update_fields=["estatus", "error_detalle", "processed_at", "updated_at"])
		raise
