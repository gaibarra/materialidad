from __future__ import annotations

import json
from datetime import date, datetime, time, timedelta
import logging
from decimal import Decimal
import re
from uuid import UUID
from django.db import DatabaseError, IntegrityError, transaction
from django.db.models import Prefetch, Q
from django.db.models import Model
from django.db.models.deletion import ProtectedError

from django.core.exceptions import ImproperlyConfigured
from django.http import HttpResponse
from django.utils import timezone
from django.utils.text import slugify
from rest_framework import filters, permissions, status, viewsets, mixins
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from tenancy.context import TenantContext
from materialidad.defense_projection import sync_operation_defense_projection

logger = logging.getLogger(__name__)


def _sync_operation_defense_projection_safe(*, operacion: Model, tenant_slug: str | None = None) -> None:
    try:
        sync_operation_defense_projection(operacion=operacion, tenant_slug=tenant_slug)
    except Exception as exc:  # pragma: no cover - sincronizacion complementaria
        logger.warning("No se pudo sincronizar OperationDefenseProjection para operacion %s: %s", getattr(operacion, "id", None), exc)


def _extract_document_text(uploaded_file) -> str:
    if not uploaded_file:
        return ""
    filename = (uploaded_file.name or "").lower()
    extension = filename.split(".")[-1] if "." in filename else ""
    try:
        if extension in {"md", "txt"}:
            content = uploaded_file.read()
            if isinstance(content, bytes):
                return content.decode("utf-8", errors="ignore")
            return str(content)
        if extension in {"docx"}:
            from docx import Document

            doc = Document(uploaded_file)
            parts: list[str] = []

            # --- Headers from first section ---
            try:
                for section in doc.sections:
                    header = section.header
                    if header and not header.is_linked_to_previous:
                        for p in header.paragraphs:
                            if p.text.strip():
                                parts.append(p.text.strip())
                    break  # solo primera sección
            except Exception:
                pass

            # --- Body: paragraphs + tables in document order ---
            from docx.oxml.ns import qn

            for element in doc.element.body:
                tag = element.tag.split("}")[-1] if "}" in element.tag else element.tag
                if tag == "p":
                    text = element.text or ""
                    # Reconstruir texto completo del párrafo (incluye runs)
                    full = "".join(
                        node.text or ""
                        for node in element.iter(qn("w:t"))
                    )
                    if full.strip():
                        parts.append(full.strip())
                elif tag == "tbl":
                    # Extraer tabla fila por fila
                    rows: list[str] = []
                    for tr in element.iter(qn("w:tr")):
                        cells: list[str] = []
                        for tc in tr.iter(qn("w:tc")):
                            cell_text = " ".join(
                                node.text or ""
                                for node in tc.iter(qn("w:t"))
                            ).strip()
                            cells.append(cell_text)
                        if any(cells):
                            rows.append(" | ".join(cells))
                    if rows:
                        parts.append("\n".join(rows))

            return "\n\n".join(parts)
        if extension in {"pdf"}:
            from pypdf import PdfReader

            reader = PdfReader(uploaded_file)
            chunks: list[str] = []
            for page in reader.pages:
                text = page.extract_text() or ""
                if text:
                    chunks.append(text)
            return "\n".join(chunks)
    except Exception as exc:
        logger.warning("No se pudo extraer texto del archivo %s: %s", filename, exc)
    finally:
        try:
            uploaded_file.seek(0)
        except Exception:
            pass
    return ""


def _parse_decimal(value: str | None) -> Decimal | None:
    if value is None:
        return None
    raw = str(value)
    cleaned = raw.replace("$", "").replace("€", "").replace("mxn", "").replace("usd", "").replace("eur", "")
    cleaned = cleaned.replace(",", "").replace(" ", "").strip()
    if not cleaned:
        return None
    cleaned = cleaned.replace("(", "-").replace(")", "")
    try:
        return Decimal(cleaned)
    except Exception:
        return None


def _detect_currency(text: str) -> str:
    lowered = text.lower()
    if "usd" in lowered or "$" in lowered:
        return "USD" if "usd" in lowered else "MXN"
    if "eur" in lowered or "€" in lowered:
        return "EUR"
    if "mxn" in lowered or "peso" in lowered:
        return "MXN"
    return "MXN"


def _normalize_concept(text: str) -> str:
    lowered = text.lower()
    lowered = re.sub(r"[^a-z0-9áéíóúüñ\s]", " ", lowered, flags=re.IGNORECASE)
    lowered = re.sub(r"\s+", " ", lowered).strip()
    return lowered


def _extract_pdf_concepts(file_obj, filename: str) -> tuple[list[dict], dict]:
    """Extrae conceptos de tablas PDF usando pdfplumber."""
    import pdfplumber

    concepts: list[dict] = []
    metadata: dict = {
        "filename": filename,
        "pages": 0,
        "tables": 0,
        "rows": 0,
    }

    with pdfplumber.open(file_obj) as pdf:
        metadata["pages"] = len(pdf.pages)
        for page in pdf.pages:
            tables = page.extract_tables() or []
            if not tables:
                continue
            metadata["tables"] += len(tables)
            for table in tables:
                header_map: dict[str, int] = {}
                for row in table:
                    if not row:
                        continue
                    cells = [str(c).strip() if c else "" for c in row]
                    if all(not c for c in cells):
                        continue
                    joined = " ".join(cells).lower()

                    if not header_map:
                        for idx, cell in enumerate(cells):
                            c = cell.lower()
                            if "descrip" in c or "concept" in c or "detalle" in c:
                                header_map["desc"] = idx
                            if "cant" in c or "qty" in c:
                                header_map["qty"] = idx
                            if "unit" in c or "p.u" in c or "precio" in c:
                                header_map["unit_price"] = idx
                            if "importe" in c or "total" in c or "monto" in c:
                                header_map["amount"] = idx
                            if "unidad" in c or "u.m" in c:
                                header_map["unit"] = idx
                        if "desc" in header_map and ("amount" in header_map or "unit_price" in header_map):
                            continue

                    desc_idx = header_map.get("desc")
                    desc = cells[desc_idx] if desc_idx is not None else ""
                    if not desc:
                        desc = next((c for c in cells if not re.search(r"\d", c)), "").strip()
                    if not desc:
                        continue

                    qty_val = None
                    if "qty" in header_map:
                        qty_val = _parse_decimal(cells[header_map["qty"]])
                    unit_val = None
                    if "unit_price" in header_map:
                        unit_val = _parse_decimal(cells[header_map["unit_price"]])
                    amount_val = None
                    if "amount" in header_map:
                        amount_val = _parse_decimal(cells[header_map["amount"]])

                    if amount_val is None and unit_val is not None:
                        qty_for_calc = qty_val if qty_val is not None else Decimal(1)
                        amount_val = unit_val * qty_for_calc

                    if unit_val is None and amount_val is not None and qty_val:
                        try:
                            unit_val = amount_val / qty_val
                        except Exception:
                            unit_val = None

                    if amount_val is None and unit_val is None:
                        continue

                    currency = _detect_currency(joined)
                    unidad = cells[header_map.get("unit")] if "unit" in header_map else ""

                    concepts.append(
                        {
                            "descripcion": desc,
                            "cantidad": qty_val if qty_val is not None else Decimal(1),
                            "precio_unitario": unit_val if unit_val is not None else amount_val,
                            "importe": amount_val if amount_val is not None else unit_val,
                            "moneda": currency,
                            "unidad": unidad,
                        }
                    )
                    metadata["rows"] += 1

    return concepts, metadata

from .ai.client import OpenAIClientError
from .ai.checklists import generate_checklist_draft
from .ai.clause_library import suggest_clauses
from .ai.clause_optimizer import optimize_clause, ClauseOptimizationError
from .ai.contracts import generate_contract_document, generate_definitive_contract
from .ai.citations import render_citations_markdown
from .ai.redlines import analyze_redlines
from .exporters import (
    build_audit_materiality_docx,
    build_audit_materiality_pdf,
    build_legal_consultation_pdf,
    build_operacion_defensa_pdf,
    build_operacion_dossier_zip,
    markdown_to_docx_bytes,
)
from .legal_corpus import process_legal_corpus_upload
from .models import (
    AlertaOperacion,
    AuditMaterialityDossier,
    AuditMaterialityDossierVersion,
    AuditLog,
    AlertaCSD,
    Checklist,
    ChecklistItem,
    ClauseTemplate,
    ComparativoPrecio,
    ContractDocument,
    Contrato,
    ContratoTemplate,
    CotizacionConcepto,
    CotizacionPDF,
    CuentaBancaria,
    DashboardSnapshot,
    DeliverableRequirement,
    Empresa,
    EvidenciaMaterial,
    EstadoCuenta,
    Fedatario,
    LegalCorpusUpload,
    LegalConsultation,
    LegalReferenceSource,
    MovimientoBancario,
    Operacion,
    OperacionChecklist,
    OperacionChecklistItem,
    OperacionConciliacion,
    OperacionEntregable,
    Proveedor,
    RazonNegocioAprobacion,
)
from .checklist_templates import refresh_operacion_checklist_progress
from .serializers import (
    AlertaOperacionSerializer,
    AuditMaterialityDossierSerializer,
    AuditMaterialityDossierVersionSerializer,
    ChecklistItemSerializer,
    ChecklistDraftRequestSerializer,
    ChecklistDraftResponseSerializer,
    ChecklistSerializer,
    ClauseOptimizeSerializer,
    ClauseSuggestionQuerySerializer,
    ClauseSuggestionSerializer,
    ClauseTemplateSerializer,
    CuentaBancariaSerializer,
    ContractDocumentCreateSerializer,
    AlertaCSDSerializer,
    ContractDocumentSerializer,
    ContratoGeneracionSerializer,
    ContratoDocxExportSerializer,
    ContratoSerializer,
    ContratoTemplateSerializer,
    FedatarioSerializer,
    ImportarExternoSerializer,
    LegalCorpusUploadSerializer,
    PromoverPlantillaSerializer,
    DashboardSnapshotSerializer,
    DeliverableRequirementSerializer,
    EvidenciaMaterialSerializer,
    OperacionEntregableSerializer,
    EstadoCuentaSerializer,
    ContratoFirmaLogisticaSerializer,
    LegalConsultationRequestSerializer,
    LegalConsultationSerializer,
    LegalReferenceSourceSerializer,
    RedlineAnalysisSerializer,
    OperacionConciliacionSerializer,
    OperacionCambioEstatusSerializer,
    OperacionChecklistItemSerializer,
    OperacionChecklistSerializer,
    BandejaRevisionItemSerializer,
    MatrizMaterialidadItemSerializer,
    EmpresaSerializer,
    OperacionSerializer,
    ProveedorSerializer,
    ProveedorValidacionSerializer,
    ProveedorValidacionResultadoSerializer,
    CFDISPEIValidationSerializer,
    PriceComparisonSerializer,
    CotizacionPDFSerializer,
    CotizacionPDFUploadSerializer,
    CotizacionConceptoSerializer,
    ComparativoPrecioSerializer,
    RazonNegocioAprobacionSerializer,
    MovimientoBancarioSerializer,
    AuditLogSerializer,
)
from .services import (
    get_dashboard_cobertura_p0,
    create_or_get_alerta_operacion_faltantes,
    get_dashboard_metrics,
    get_operacion_faltantes_materialidad,
    get_operacion_riesgo_materialidad,
    perform_legal_consultation,
    sync_operacion_materialidad,
    trigger_proveedor_validacion,
    trigger_validacion_proveedor,
    validate_cfdi_spei,
)


def _capture_ip(request):
    meta = getattr(request, "META", {}) or {}
    forwarded = meta.get("HTTP_X_FORWARDED_FOR")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return meta.get("REMOTE_ADDR")


def _to_json_safe(value):
    if isinstance(value, dict):
        return {str(key): _to_json_safe(item) for key, item in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [_to_json_safe(item) for item in value]
    if isinstance(value, Model):
        return getattr(value, "pk", str(value))
    if isinstance(value, (datetime, date, time)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, UUID):
        return str(value)
    return value


def _audit(request, action: str, obj, changes: dict | None = None):
    user = getattr(request, "user", None)
    safe_changes = _to_json_safe(changes or {})
    AuditLog.objects.create(
        actor_id=getattr(user, "id", None),
        actor_email=getattr(user, "email", "") or "",
        actor_name=f"{getattr(user, 'first_name', '')} {getattr(user, 'last_name', '')}".strip(),
        action=action,
        object_type=obj._meta.label_lower,
        object_id=str(getattr(obj, "pk", "")),
        object_repr=str(obj)[:255],
        changes=safe_changes,
        source_ip=_capture_ip(request),
    )


def _resolve_actor_display_name(user) -> str:
    if not user:
        return ""
    full_name = getattr(user, "full_name", "") or ""
    if full_name.strip():
        return full_name.strip()
    fallback = f"{getattr(user, 'first_name', '')} {getattr(user, 'last_name', '')}".strip()
    if fallback:
        return fallback
    return getattr(user, "email", "") or ""


from .ai.csf_extractor import extract_csf_data


class _CSFUploadMixin:
    """Mixin que agrega acción upload_csf a un ViewSet de Empresa o Proveedor."""

    @action(detail=False, methods=["post"], url_path="upload-csf")
    def upload_csf(self, request, *args, **kwargs):
        """Sube un PDF/imagen de CSF y extrae datos con OpenAI Vision.

        Solo devuelve datos extraídos para pre-llenar el formulario.
        Por seguridad, este endpoint no persiste cambios ni acepta actualización por `id`.
        """
        archivo = request.FILES.get("archivo")
        if not archivo:
            return Response(
                {"detail": "Se requiere un archivo (PDF o imagen) en el campo 'archivo'."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Leer contenido
        content = archivo.read()
        tenant = getattr(request, "tenant", None)
        try:
            datos = extract_csf_data(content, archivo.name, tenant=tenant)
        except RuntimeError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_422_UNPROCESSABLE_ENTITY)

        return Response({"datos_extraidos": datos})


def _apply_csf_fields(instance, datos: dict) -> None:
    """Aplica los campos extraídos de la CSF al modelo."""
    field_map = {
        "tipo_persona": "tipo_persona",
        "rfc": "rfc",
        "razon_social": "razon_social",
        "nombre": "nombre",
        "apellido_paterno": "apellido_paterno",
        "apellido_materno": "apellido_materno",
        "curp": "curp",
        "regimen_fiscal": "regimen_fiscal",
        "calle": "calle",
        "no_exterior": "no_exterior",
        "no_interior": "no_interior",
        "colonia": "colonia",
        "codigo_postal": "codigo_postal",
        "municipio": "municipio",
        "estado": "estado",
        "ciudad": "ciudad",
    }
    # Campos que solo existen en ciertos modelos
    optional_fields = {
        "actividad_economica": "actividad_economica",
        "actividad_principal": "actividad_principal",  # Proveedor usa este nombre
    }

    for src_key, model_field in field_map.items():
        value = datos.get(src_key, "")
        if value and hasattr(instance, model_field):
            setattr(instance, model_field, value)

    for src_key, model_field in optional_fields.items():
        value = datos.get(src_key, "")
        if value and hasattr(instance, model_field):
            setattr(instance, model_field, value)

    # Fecha de emisión
    csf_fecha = datos.get("csf_fecha_emision", "")
    if csf_fecha:
        try:
            from datetime import date as date_type
            parts = csf_fecha.split("-")
            if len(parts) == 3:
                instance.csf_fecha_emision = date_type(int(parts[0]), int(parts[1]), int(parts[2]))
        except (ValueError, TypeError):
            pass

    # Fecha de constitución / inicio actividades
    fecha_const = datos.get("fecha_constitucion", "")
    if fecha_const and hasattr(instance, "fecha_constitucion"):
        try:
            from datetime import date as date_type
            parts = fecha_const.split("-")
            if len(parts) == 3:
                instance.fecha_constitucion = date_type(int(parts[0]), int(parts[1]), int(parts[2]))
        except (ValueError, TypeError):
            pass


class EmpresaViewSet(_CSFUploadMixin, viewsets.ModelViewSet):
    serializer_class = EmpresaSerializer
    queryset = Empresa.objects.all().order_by("razon_social")
    filter_backends = (filters.SearchFilter, filters.OrderingFilter)
    search_fields = ("razon_social", "rfc")
    ordering_fields = ("razon_social", "created_at")
    filterset_fields = ("regimen_fiscal", "activo", "pais")

    def destroy(self, request, *args, **kwargs):
        empresa = self.get_object()
        estatus_bloqueados = (
            Operacion.EstatusValidacion.EN_PROCESO,
            Operacion.EstatusValidacion.VALIDADO,
        )
        operaciones = empresa.operaciones.all()
        expedientes_bloqueados = operaciones.filter(estatus_validacion__in=estatus_bloqueados)

        if expedientes_bloqueados.exists():
            return Response(
                {
                    "detail": "No se puede eliminar la empresa porque tiene expedientes en proceso o terminados.",
                    "field_errors": {
                        "empresa": [
                            "Debes cerrar o depurar los expedientes en proceso/terminados antes de eliminar esta empresa."
                        ]
                    },
                    "code": "empresa_delete_blocked_by_expedientes",
                },
                status=status.HTTP_409_CONFLICT,
            )

        try:
            with transaction.atomic():
                operaciones.exclude(estatus_validacion__in=estatus_bloqueados).delete()
                self.perform_destroy(empresa)
        except ProtectedError:
            return Response(
                {
                    "detail": "No se puede eliminar la empresa porque tiene registros relacionados protegidos.",
                    "field_errors": {
                        "empresa": [
                            "Elimina o desvincula contratos, operaciones u otros registros relacionados e inténtalo de nuevo."
                        ]
                    },
                    "code": "empresa_delete_blocked_by_relations",
                },
                status=status.HTTP_409_CONFLICT,
            )
        except (IntegrityError, DatabaseError):
            logger.exception("Error de integridad al eliminar empresa %s", empresa.pk)
            return Response(
                {
                    "detail": "No se puede eliminar la empresa porque tiene información relacionada en uso.",
                    "field_errors": {
                        "empresa": [
                            "Existen registros vinculados que deben eliminarse o desvincularse antes de borrar esta empresa."
                        ]
                    },
                    "code": "empresa_delete_integrity_error",
                },
                status=status.HTTP_409_CONFLICT,
            )
        except Exception:
            logger.exception("Error no controlado al eliminar empresa %s", empresa.pk)
            return Response(
                {
                    "detail": "No se pudo eliminar la empresa en este momento por dependencias internas.",
                    "field_errors": {
                        "empresa": [
                            "Intenta nuevamente en unos segundos. Si persiste, revisa contratos, operaciones y cuentas asociadas."
                        ]
                    },
                    "code": "empresa_delete_unexpected_error",
                },
                status=status.HTTP_409_CONFLICT,
            )

        return Response(status=status.HTTP_204_NO_CONTENT)


class FedatarioViewSet(viewsets.ModelViewSet):
    serializer_class = FedatarioSerializer
    queryset = Fedatario.objects.all().order_by("nombre")
    pagination_class = None
    filter_backends = (filters.SearchFilter, filters.OrderingFilter)
    search_fields = ("nombre", "numero_notaria", "estado", "ciudad", "email")
    ordering_fields = ("nombre", "estado", "created_at")


class ProveedorViewSet(_CSFUploadMixin, viewsets.ModelViewSet):
    serializer_class = ProveedorSerializer
    queryset = Proveedor.objects.all().order_by("razon_social")
    filter_backends = (filters.SearchFilter, filters.OrderingFilter)
    search_fields = ("razon_social", "rfc")
    ordering_fields = ("razon_social", "created_at")
    filterset_fields = ("pais", "estatus_sat")

    def destroy(self, request, *args, **kwargs):
        proveedor = self.get_object()
        estatus_bloqueados = (
            Operacion.EstatusValidacion.EN_PROCESO,
            Operacion.EstatusValidacion.VALIDADO,
        )
        operaciones = proveedor.operaciones.all()
        expedientes_bloqueados = operaciones.filter(estatus_validacion__in=estatus_bloqueados)

        if expedientes_bloqueados.exists():
            return Response(
                {
                    "detail": "No se puede eliminar el proveedor porque tiene expedientes abiertos o concluidos.",
                    "field_errors": {
                        "proveedor": [
                            "Debes cerrar o depurar los expedientes en proceso/concluidos antes de eliminar este proveedor."
                        ]
                    },
                    "code": "proveedor_delete_blocked_by_expedientes",
                },
                status=status.HTTP_409_CONFLICT,
            )

        try:
            with transaction.atomic():
                operaciones.exclude(estatus_validacion__in=estatus_bloqueados).delete()
                self.perform_destroy(proveedor)
        except ProtectedError:
            return Response(
                {
                    "detail": "No se puede eliminar el proveedor porque tiene registros relacionados protegidos.",
                    "field_errors": {
                        "proveedor": [
                            "Elimina o desvincula operaciones y otros registros relacionados e inténtalo de nuevo."
                        ]
                    },
                    "code": "proveedor_delete_blocked_by_relations",
                },
                status=status.HTTP_409_CONFLICT,
            )
        except (IntegrityError, DatabaseError):
            logger.exception("Error de integridad al eliminar proveedor %s", proveedor.pk)
            return Response(
                {
                    "detail": "No se puede eliminar el proveedor porque tiene información relacionada en uso.",
                    "field_errors": {
                        "proveedor": [
                            "Existen registros vinculados que deben eliminarse o desvincularse antes de borrar este proveedor."
                        ]
                    },
                    "code": "proveedor_delete_integrity_error",
                },
                status=status.HTTP_409_CONFLICT,
            )
        except Exception:
            logger.exception("Error no controlado al eliminar proveedor %s", proveedor.pk)
            return Response(
                {
                    "detail": "No se pudo eliminar el proveedor en este momento por dependencias internas.",
                    "field_errors": {
                        "proveedor": [
                            "Intenta nuevamente en unos segundos. Si persiste, revisa operaciones y registros asociados."
                        ]
                    },
                    "code": "proveedor_delete_unexpected_error",
                },
                status=status.HTTP_409_CONFLICT,
            )

        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"], url_path="validaciones")
    def solicitar_validacion(self, request, *args, **kwargs):
        proveedor = self.get_object()
        serializer = ProveedorValidacionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.trigger_workflow(proveedor)
        return Response(status=status.HTTP_202_ACCEPTED)

    @action(detail=True, methods=["post"], url_path="validaciones/resultado")
    def registrar_validacion(self, request, *args, **kwargs):
        proveedor = self.get_object()
        serializer = ProveedorValidacionResultadoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        updated_fields: list[str] = []

        if "estatus_sat" in data:
            proveedor.estatus_sat = data["estatus_sat"]
            updated_fields.append("estatus_sat")
            proveedor.ultima_validacion_sat = data.get("ultima_validacion_sat") or timezone.now()
            updated_fields.append("ultima_validacion_sat")

        if "estatus_69b" in data:
            proveedor.estatus_69b = data["estatus_69b"]
            updated_fields.append("estatus_69b")
            proveedor.ultima_validacion_69b = data.get("ultima_validacion_69b") or timezone.now()
            updated_fields.append("ultima_validacion_69b")

        if "riesgo_fiscal" in data:
            proveedor.riesgo_fiscal = data["riesgo_fiscal"]
            updated_fields.append("riesgo_fiscal")

        if "riesgos_detectados" in data:
            proveedor.riesgos_detectados = data["riesgos_detectados"]
            updated_fields.append("riesgos_detectados")

        if "detalle_validacion" in data:
            proveedor.detalle_validacion = data["detalle_validacion"]
            updated_fields.append("detalle_validacion")

        if not updated_fields:
            return Response({"detail": "No se enviaron campos de validación"}, status=status.HTTP_400_BAD_REQUEST)

        proveedor.save(update_fields=updated_fields)
        return Response(self.get_serializer(proveedor).data, status=status.HTTP_200_OK)


class ContratoViewSet(viewsets.ModelViewSet):
    serializer_class = ContratoSerializer
    queryset = (
        Contrato.objects.select_related("empresa", "proveedor")
        .all()
        .order_by("-vigencia_inicio", "nombre")
    )
    filter_backends = (filters.SearchFilter, filters.OrderingFilter)
    search_fields = ("nombre", "codigo_interno", "categoria")
    ordering_fields = ("vigencia_inicio", "nombre", "created_at")
    filterset_fields = ("categoria", "proceso", "tipo_empresa", "empresa", "activo")

    def perform_create(self, serializer):
        contrato = serializer.save()
        _audit(self.request, "contrato_creado", contrato, changes=serializer.validated_data)

    def perform_update(self, serializer):
        changes = serializer.validated_data.copy()
        contrato = serializer.save()
        if changes:
            _audit(self.request, "contrato_actualizado", contrato, changes=changes)

    @action(detail=False, methods=["post"], url_path="generar")
    def generar_contrato(self, request, *args, **kwargs):
        serializer = ContratoGeneracionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        contrato = data.get("contrato")
        template = data.get("template")
        if contrato is None:
            categoria = template.categoria if template else Contrato.Categoria.BASE_CORPORATIVA
            proceso = template.proceso if template else Contrato.ProcesoNegocio.OPERACIONES
            tipo_empresa = template.tipo_empresa if template else Contrato.TipoEmpresa.MIXTA
            nombre_base = template.nombre if template else "Contrato generado"
            contrato = Contrato.objects.create(
                empresa=data["empresa"],
                proveedor=data.get("proveedor"),
                template=template,
                nombre=f"{nombre_base} - {data['empresa'].razon_social}",
                categoria=categoria,
                proceso=proceso,
                tipo_empresa=tipo_empresa,
                descripcion=(data.get("resumen_necesidades") or (template.descripcion if template else "")),
                razon_negocio=data.get("razon_negocio", ""),
                beneficio_economico_esperado=data.get("beneficio_economico_esperado"),
                beneficio_fiscal_estimado=data.get("beneficio_fiscal_estimado"),
                fecha_cierta_requerida=data.get("fecha_cierta_requerida", False),
                metadata={"generado_por": "ai"},
            )
        else:
            # Actualizar datos del contrato existente
            contrato.empresa = data["empresa"]
            if "proveedor" in data:
                contrato.proveedor = data.get("proveedor")
            if template:
                contrato.template = template
                contrato.categoria = template.categoria
                contrato.proceso = template.proceso
                contrato.tipo_empresa = template.tipo_empresa
            if "resumen_necesidades" in data:
                contrato.descripcion = data.get("resumen_necesidades")
            if "razon_negocio" in data:
                contrato.razon_negocio = data.get("razon_negocio")
            if "beneficio_economico_esperado" in data:
                contrato.beneficio_economico_esperado = data.get("beneficio_economico_esperado")
            if "beneficio_fiscal_estimado" in data:
                contrato.beneficio_fiscal_estimado = data.get("beneficio_fiscal_estimado")
            if "fecha_cierta_requerida" in data:
                contrato.fecha_cierta_requerida = data.get("fecha_cierta_requerida", False)
            contrato.save()

        try:
            resultado = generate_contract_document(
                empresa=data["empresa"],
                template=template,
                razon_negocio=data.get("razon_negocio"),
                beneficio_economico_esperado=data.get("beneficio_economico_esperado"),
                beneficio_fiscal_estimado=data.get("beneficio_fiscal_estimado"),
                fecha_cierta_requerida=data.get("fecha_cierta_requerida", False),
                resumen_necesidades=data.get("resumen_necesidades", ""),
                clausulas_especiales=data.get("clausulas_especiales"),
                idioma=data.get("idioma", "es"),
                tono=data.get("tono", "formal"),
            )
            documento = ContractDocument.objects.create(
                contrato=contrato,
                kind=ContractDocument.Kind.BORRADOR_AI,
                source=ContractDocument.Source.AI,
                idioma=resultado.get("idioma", "es"),
                tono=resultado.get("tono", "formal"),
                modelo=resultado.get("modelo", ""),
                markdown_text=resultado.get("documento_markdown", ""),
                metadata={
                    "citas_legales": resultado.get("citas_legales") or [],
                    "citas_legales_metadata": resultado.get("citas_legales_metadata") or {},
                },
            )
            resultado["contrato_id"] = contrato.id
            resultado["documento_id"] = documento.id
        except ImproperlyConfigured as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        except OpenAIClientError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_502_BAD_GATEWAY,
            )
        return Response(resultado, status=status.HTTP_200_OK)

    @action(detail=False, methods=["post"], url_path="exportar-docx")
    def exportar_docx(self, request, *args, **kwargs):
        serializer = ContratoDocxExportSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        markdown_text = serializer.validated_data["documento_markdown"]
        idioma = serializer.validated_data.get("idioma", "es")
        try:
            definitivo = generate_definitive_contract(markdown_text, idioma=idioma)
        except ImproperlyConfigured as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        except OpenAIClientError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_502_BAD_GATEWAY)

        documento_final = definitivo["documento_markdown"]
        citas_legales = definitivo.get("citas_legales") or []
        citas_metadata = definitivo.get("citas_legales_metadata") or {}
        citation_block = render_citations_markdown(citas_legales)
        markdown_con_referencias = documento_final
        if citation_block:
            markdown_con_referencias = f"{documento_final.rstrip()}\n\n{citation_block}\n"
        try:
            file_bytes = markdown_to_docx_bytes(markdown_con_referencias)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        requested_name = serializer.validated_data.get("nombre_archivo") or "contrato"
        safe_name = slugify(requested_name) or "contrato"
        timestamp = timezone.now().strftime("%Y%m%d-%H%M")
        filename = safe_name
        if not filename.endswith(".docx"):
            filename = f"{filename}-{timestamp}.docx"

        response = HttpResponse(
            file_bytes,
            content_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        )
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        response["Content-Length"] = str(len(file_bytes))
        response["X-Contrato-Modelo"] = definitivo["modelo"]
        return response

    @action(detail=True, methods=["get", "post"], url_path="documentos")
    def documentos(self, request, *args, **kwargs):
        contrato = self.get_object()

        # --- GET: listar documentos ---
        if request.method == "GET":
            docs = contrato.documentos.all().order_by("-created_at")
            data = ContractDocumentSerializer(docs, many=True).data
            return Response(data, status=status.HTTP_200_OK)

        # --- POST: crear documento ---
        serializer = ContractDocumentCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payload = serializer.validated_data
        archivo = payload.get("archivo")
        markdown_text = (payload.get("markdown_text") or "").strip()
        extracted_text = _extract_document_text(archivo) if archivo else ""
        archivo_nombre = archivo.name if archivo else ""

        documento = ContractDocument.objects.create(
            contrato=contrato,
            kind=payload["kind"],
            source=payload["source"],
            idioma=payload["idioma"],
            tono=payload["tono"],
            modelo=payload.get("modelo", ""),
            archivo=archivo,
            archivo_nombre=archivo_nombre,
            markdown_text=markdown_text,
            extracted_text=extracted_text.strip(),
        )
        data = ContractDocumentSerializer(documento).data
        return Response(data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path=r"documentos/(?P<documento_id>\d+)/corregir")
    def corregir_documento(self, request, *args, **kwargs):
        contrato = self.get_object()
        documento_id = kwargs.get("documento_id")
        try:
            documento = contrato.documentos.get(pk=documento_id)
        except ContractDocument.DoesNotExist:
            return Response({"detail": "Documento no encontrado"}, status=status.HTTP_404_NOT_FOUND)

        base_text = (documento.markdown_text or documento.extracted_text or "").strip()
        if not base_text:
            return Response({"detail": "El documento no contiene texto legible"}, status=status.HTTP_400_BAD_REQUEST)

        idioma = request.data.get("idioma", "es")
        try:
            definitivo = generate_definitive_contract(base_text, idioma=idioma)
        except ImproperlyConfigured as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        except OpenAIClientError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_502_BAD_GATEWAY)

        nuevo = ContractDocument.objects.create(
            contrato=contrato,
            kind=ContractDocument.Kind.CORREGIDO,
            source=ContractDocument.Source.AI,
            idioma=idioma,
            tono="formal",
            modelo=definitivo.get("modelo", ""),
            markdown_text=definitivo.get("documento_markdown", ""),
            metadata={
                "documento_origen_id": documento.id,
                "citas_legales": definitivo.get("citas_legales") or [],
                "citas_legales_metadata": definitivo.get("citas_legales_metadata") or {},
            },
        )

        definitivo["idioma"] = idioma
        definitivo["tono"] = "formal"
        definitivo["contrato_id"] = contrato.id
        definitivo["documento_id"] = nuevo.id
        return Response(definitivo, status=status.HTTP_200_OK)

    @action(detail=True, methods=["get", "post"], url_path="firma-logistica")
    def firma_logistica(self, request, *args, **kwargs):
        contrato = self.get_object()

        # GET → return current logistics state
        if request.method == "GET":
            data_out = ContratoSerializer(contrato, context=self.get_serializer_context()).data
            return Response(data_out, status=status.HTTP_200_OK)

        serializer = ContratoFirmaLogisticaSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        update_fields: list[str] = []
        simple_fields = (
            "firma_modalidad",
            "fecha_cita_firma",
            "lugar_cita",
            "responsable_logistica",
            "contacto_responsable",
            "fecha_cierta_requerida",
            "fecha_cierta_obtenida",
            "fecha_ratificacion",
            "fedatario",
            "fedatario_nombre",
            "numero_instrumento",
            "archivo_notariado_url",
            "sello_tiempo_aplicado",
            "sello_tiempo_proveedor",
            "sello_tiempo_acuse_url",
            "registro_publico_folio",
            "registro_publico_url",
            "notas_logistica",
        )
        for field in simple_fields:
            if field in data:
                setattr(contrato, field, data[field])
                update_fields.append(field)

        estado = data.get("logistica_estado")
        if data.get("fecha_cita_firma") and not estado:
            estado = Contrato.EstadoLogistica.AGENDADA
        if data.get("fecha_cierta_obtenida"):
            estado = Contrato.EstadoLogistica.COMPLETADA
            if "fecha_cierta_requerida" not in data:
                contrato.fecha_cierta_requerida = True
                update_fields.append("fecha_cierta_requerida")

        if estado:
            contrato.logistica_estado = estado
            update_fields.append("logistica_estado")

            if data.get("sello_tiempo_acuse_url") and not data.get("sello_tiempo_aplicado"):
                contrato.sello_tiempo_aplicado = timezone.now()
                update_fields.append("sello_tiempo_aplicado")

        if not update_fields:
            return Response({"detail": "No se enviaron campos para actualizar"}, status=status.HTTP_400_BAD_REQUEST)

        update_fields.append("updated_at")
        contrato.save(update_fields=update_fields)
        data_out = ContratoSerializer(contrato, context=self.get_serializer_context()).data
        return Response(data_out, status=status.HTTP_200_OK)

    @action(detail=False, methods=["get"], url_path="clausulas-sugeridas")
    def clausulas_sugeridas(self, request, *args, **kwargs):
        serializer = ClauseSuggestionQuerySerializer(data=request.query_params)
        serializer.is_valid(raise_exception=True)
        params = dict(serializer.validated_data)
        template = params.pop("template", None)
        categoria = params.get("categoria") or (template.categoria if template else None)
        proceso = params.get("proceso") or (template.proceso if template else None)
        idioma = params.get("idioma") or "es"
        suggestions = suggest_clauses(
            categoria=categoria,
            proceso=proceso,
            idioma=idioma,
            query=params.get("query"),
            resumen_necesidades=params.get("resumen_necesidades"),
            limit=params.get("limit", 6),
        )
        data = ClauseSuggestionSerializer(suggestions, many=True).data
        return Response(data, status=status.HTTP_200_OK)

    @action(detail=False, methods=["post"], url_path="redlines")
    def redlines(self, request, *args, **kwargs):
        serializer = RedlineAnalysisSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        try:
            analysis = analyze_redlines(
                original_text=data["texto_original"],
                revised_text=data["texto_revisado"],
                idioma=data.get("idioma", "es"),
            )
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except OpenAIClientError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_502_BAD_GATEWAY)
        return Response(analysis, status=status.HTTP_200_OK)

    @action(detail=False, methods=["post"], url_path="optimizar-clausula")
    def optimizar_clausula(self, request, *args, **kwargs):
        """Optimiza una cláusula individual usando IA."""
        serializer = ClauseOptimizeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        try:
            result = optimize_clause(
                texto_clausula=data["texto_clausula"],
                contexto_contrato=data.get("contexto_contrato", ""),
                objetivo=data.get("objetivo", "mejorar_fiscal"),
                idioma=data.get("idioma", "es"),
            )
        except ClauseOptimizationError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except OpenAIClientError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_502_BAD_GATEWAY)
        return Response(result, status=status.HTTP_200_OK)

    @action(detail=False, methods=["post"], url_path="importar-externo")
    def importar_externo(self, request, *args, **kwargs):
        """Importa un contrato externo: crea Contrato, sube archivo y corrige con IA."""
        serializer = ImportarExternoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        empresa = data["empresa"]
        template = data.get("template")
        idioma = data.get("idioma", "es")
        tono = data.get("tono", "formal")
        archivo = data["archivo"]

        # --- Auto-crear Contrato ---
        categoria = template.categoria if template else Contrato.Categoria.BASE_CORPORATIVA
        proceso = template.proceso if template else Contrato.ProcesoNegocio.OPERACIONES
        tipo_empresa = template.tipo_empresa if template else Contrato.TipoEmpresa.MIXTA
        contrato = Contrato.objects.create(
            empresa=empresa,
            proveedor=data.get("proveedor"),
            template=template,
            nombre=f"Contrato externo importado \u2014 {empresa.razon_social}",
            categoria=categoria,
            proceso=proceso,
            tipo_empresa=tipo_empresa,
            descripcion="Importado desde archivo externo para revisión AI",
            metadata={"generado_por": "importar_externo"},
        )

        # --- Subir documento ---
        extracted_text = _extract_document_text(archivo)
        if not extracted_text.strip():
            return Response(
                {"detail": "No pudimos extraer texto del archivo. Verifica que no esté vacío o sea imagen."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        doc_subido = ContractDocument.objects.create(
            contrato=contrato,
            kind=ContractDocument.Kind.SUBIDO,
            source=ContractDocument.Source.UPLOAD,
            idioma=idioma,
            tono=tono,
            archivo=archivo,
            archivo_nombre=archivo.name if archivo else "",
            extracted_text=extracted_text.strip(),
        )

        # --- Corregir con IA ---
        try:
            definitivo = generate_definitive_contract(extracted_text.strip(), idioma=idioma)
        except ImproperlyConfigured as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        except OpenAIClientError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_502_BAD_GATEWAY)

        doc_corregido = ContractDocument.objects.create(
            contrato=contrato,
            kind=ContractDocument.Kind.CORREGIDO,
            source=ContractDocument.Source.AI,
            idioma=idioma,
            tono=tono,
            modelo=definitivo.get("modelo", ""),
            markdown_text=definitivo.get("documento_markdown", ""),
            metadata={
                "documento_origen_id": doc_subido.id,
                "citas_legales": definitivo.get("citas_legales") or [],
                "citas_legales_metadata": definitivo.get("citas_legales_metadata") or {},
            },
        )

        resultado = {
            "documento_markdown": definitivo.get("documento_markdown", ""),
            "idioma": idioma,
            "tono": tono,
            "modelo": definitivo.get("modelo", ""),
            "citas_legales": definitivo.get("citas_legales") or [],
            "citas_legales_metadata": definitivo.get("citas_legales_metadata") or {},
            "contrato_id": contrato.id,
            "documento_id": doc_corregido.id,
        }
        _audit(request, "contrato_externo_importado", contrato, changes={
            "archivo": archivo.name,
            "doc_subido_id": doc_subido.id,
            "doc_corregido_id": doc_corregido.id,
        })
        return Response(resultado, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="promover-plantilla")
    def promover_plantilla(self, request, *args, **kwargs):
        """Promueve un contrato depurado a plantilla reutilizable."""
        contrato = self.get_object()
        serializer = PromoverPlantillaSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        # Obtener el markdown del documento o del request
        markdown_base = data.get("markdown_base", "").strip()
        documento_id = data.get("documento_id")
        documento = None
        if documento_id:
            try:
                documento = contrato.documentos.get(pk=documento_id)
                if not markdown_base:
                    markdown_base = documento.markdown_text or ""
            except ContractDocument.DoesNotExist:
                return Response(
                    {"detail": "Documento no encontrado en este contrato"},
                    status=status.HTTP_404_NOT_FOUND,
                )

        if not markdown_base:
            return Response(
                {"detail": "No hay contenido markdown para crear la plantilla"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        clave = data.get("clave") or slugify(f"seed-{contrato.categoria}-{contrato.pk}")
        nombre = data.get("nombre") or f"Plantilla desde: {contrato.nombre}"

        template, created = ContratoTemplate.objects.update_or_create(
            clave=clave,
            defaults={
                "nombre": nombre,
                "categoria": contrato.categoria,
                "proceso": contrato.proceso,
                "tipo_empresa": contrato.tipo_empresa,
                "descripcion": data.get("descripcion", contrato.descripcion or ""),
                "contrato_base": contrato,
                "documento_base": documento,
                "markdown_base": markdown_base,
                "activo": True,
            },
        )
        _audit(self.request, "plantilla_promovida", template, changes={
            "contrato_id": contrato.pk,
            "documento_id": documento_id,
            "created": created,
        })
        return Response(
            ContratoTemplateSerializer(template).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


class LegalReferenceSourceViewSet(viewsets.ModelViewSet):
    serializer_class = LegalReferenceSourceSerializer
    queryset = LegalReferenceSource.objects.all().order_by("ley", "articulo", "fraccion", "created_at")
    filter_backends = (filters.SearchFilter, filters.OrderingFilter)
    search_fields = ("ley", "articulo", "contenido", "resumen", "sat_categoria")
    ordering_fields = ("ley", "articulo", "created_at", "fecha_ultima_revision")
    filterset_fields = (
        "ley",
        "ordenamiento",
        "tipo_fuente",
        "estatus_vigencia",
        "es_vigente",
        "autoridad_emisora",
        "corpus_upload",
    )

    def get_queryset(self):
        queryset = super().get_queryset()
        solo_vigentes = self.request.query_params.get("solo_vigentes")
        if solo_vigentes is None:
            return queryset
        normalized = str(solo_vigentes).strip().lower()
        if normalized in {"1", "true", "yes", "si", "sí"}:
            return queryset.filter(es_vigente=True)
        if normalized in {"0", "false", "no"}:
            return queryset
        return queryset

    @action(detail=False, methods=["get"], url_path="leyes")
    def available_laws(self, request, *args, **kwargs):
        try:
            leyes = (
                self.filter_queryset(self.get_queryset())
                .using("default")
                .exclude(ley="")
                .values_list("ley", flat=True)
                .distinct()
                .order_by("ley")
            )
        except DatabaseError:
            logger.exception("Error loading legal laws catalog from legal reference sources")
            return Response(
                {"detail": "No se pudo cargar el catálogo de leyes"},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        return Response({"results": list(leyes)}, status=status.HTTP_200_OK)


class LegalCorpusUploadViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = LegalCorpusUploadSerializer
    queryset = LegalCorpusUpload.objects.select_related("uploaded_by").all().order_by("-created_at")
    parser_classes = (MultiPartParser, FormParser)
    permission_classes = (permissions.IsAuthenticated,)
    filter_backends = (filters.SearchFilter, filters.OrderingFilter)
    search_fields = ("titulo", "ordenamiento", "fuente_documento", "autoridad")
    ordering_fields = ("created_at", "processed_at", "ordenamiento", "autoridad")
    filterset_fields = ("autoridad", "tipo_fuente", "estatus", "estatus_vigencia", "es_vigente")

    def _require_superuser(self, request):
        if not getattr(request.user, "is_superuser", False):
            return Response(
                {"detail": "Solo superusuarios pueden administrar corpus legales oficiales"},
                status=status.HTTP_403_FORBIDDEN,
            )
        return None

    def list(self, request, *args, **kwargs):
        denied = self._require_superuser(request)
        if denied:
            return denied
        return super().list(request, *args, **kwargs)

    def retrieve(self, request, *args, **kwargs):
        denied = self._require_superuser(request)
        if denied:
            return denied
        return super().retrieve(request, *args, **kwargs)

    def create(self, request, *args, **kwargs):
        denied = self._require_superuser(request)
        if denied:
            return denied

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        procesar_ahora = serializer.validated_data.get("procesar_ahora", True)
        upload = serializer.save(uploaded_by=request.user)

        if procesar_ahora:
            try:
                process_legal_corpus_upload(upload)
            except Exception as exc:
                return Response(
                    {
                        "detail": str(exc),
                        "upload": self.get_serializer(upload).data,
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

        _audit(
            request,
            "legal_corpus_upload_creado",
            upload,
            changes={
                "autoridad": upload.autoridad,
                "ordenamiento": upload.ordenamiento,
                "tipo_fuente": upload.tipo_fuente,
                "estatus": upload.estatus,
            },
        )
        return Response(self.get_serializer(upload).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="reprocesar")
    def reprocesar(self, request, *args, **kwargs):
        denied = self._require_superuser(request)
        if denied:
            return denied
        upload = self.get_object()
        try:
            process_legal_corpus_upload(upload)
        except Exception as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        _audit(request, "legal_corpus_upload_reprocesado", upload, changes={"estatus": upload.estatus})
        return Response(self.get_serializer(upload).data, status=status.HTTP_200_OK)

class ChecklistViewSet(viewsets.ModelViewSet):
    serializer_class = ChecklistSerializer
    filter_backends = (filters.SearchFilter, filters.OrderingFilter)
    search_fields = ("nombre", "tipo_gasto")
    ordering_fields = ("created_at", "nombre")
    ordering = ("-created_at",)

    def get_queryset(self):
        tenant = getattr(self.request, "tenant", None)
        qs = Checklist.objects.prefetch_related("items").all()
        if tenant:
            qs = qs.filter(tenant_slug=tenant.slug)
        return qs

    def perform_create(self, serializer):
        tenant = getattr(self.request, "tenant", None)
        serializer.save(tenant_slug=tenant.slug if tenant else "")

    @action(detail=False, methods=["post"], url_path="generar-borrador")
    def generar_borrador(self, request, *args, **kwargs):
        serializer = ChecklistDraftRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payload = serializer.validated_data

        result = generate_checklist_draft(
            tenant=getattr(request, "tenant", None),
            naturaleza_operacion=payload["naturaleza_operacion"],
            tipo_operacion=payload.get("tipo_operacion", ""),
            tipo_gasto=payload.get("tipo_gasto", ""),
            monto=payload.get("monto"),
            moneda=payload.get("moneda", ""),
            empresa=payload.get("empresa"),
            proveedor=payload.get("proveedor"),
            contrato=payload.get("contrato"),
            operacion=payload.get("operacion"),
        )
        output = ChecklistDraftResponseSerializer(result)
        return Response(output.data, status=status.HTTP_200_OK)


class ChecklistItemViewSet(viewsets.ModelViewSet):
    serializer_class = ChecklistItemSerializer
    filter_backends = (filters.SearchFilter, filters.OrderingFilter)
    search_fields = ("titulo", "descripcion")
    ordering_fields = ("created_at", "vence_el")
    ordering = ("-created_at",)

    def get_queryset(self):
        tenant = getattr(self.request, "tenant", None)
        qs = ChecklistItem.objects.select_related("checklist")
        if tenant:
            qs = qs.filter(checklist__tenant_slug=tenant.slug)
        return qs

    def perform_create(self, serializer):
        checklist_id = self.request.data.get("checklist")
        checklist = Checklist.objects.get(pk=checklist_id)
        serializer.save(checklist=checklist)


class OperacionChecklistItemViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.UpdateModelMixin, viewsets.GenericViewSet):
    serializer_class = OperacionChecklistItemSerializer
    filter_backends = (filters.SearchFilter, filters.OrderingFilter)
    search_fields = ("titulo", "descripcion", "responsable")
    ordering_fields = ("created_at", "updated_at", "estado")
    ordering = ("created_at",)
    filterset_fields = ("operacion_checklist", "operacion_checklist__operacion", "estado", "pillar")

    def get_queryset(self):
        return OperacionChecklistItem.objects.select_related("operacion_checklist", "checklist_item")

    def perform_update(self, serializer):
        changes = serializer.validated_data.copy()
        item = serializer.save()
        refresh_operacion_checklist_progress(item.operacion_checklist)
        sync_operacion_materialidad(
            operacion=item.operacion_checklist.operacion,
            owner_email=getattr(self.request.user, "email", ""),
            sync_alertas=True,
        )
        _sync_operation_defense_projection_safe(operacion=item.operacion_checklist.operacion)
        if changes:
            _audit(self.request, "operacion_checklist_item_actualizado", item, changes=changes)


class DeliverableRequirementViewSet(viewsets.ModelViewSet):
    serializer_class = DeliverableRequirementSerializer
    pagination_class = None  # Siempre retornar todas las plantillas
    filter_backends = (filters.SearchFilter, filters.OrderingFilter)
    search_fields = ("tipo_gasto", "titulo", "codigo")
    ordering_fields = ("created_at", "tipo_gasto", "codigo")
    ordering = ("tipo_gasto", "codigo")

    def get_queryset(self):
        tenant = getattr(self.request, "tenant", None)
        qs = DeliverableRequirement.objects.all()
        if tenant:
            # Devuelve plantillas del tenant Y las plantillas globales (slug vacío)
            qs = qs.filter(
                Q(tenant_slug=tenant.slug) | Q(tenant_slug="")
            )
        return qs

    def perform_create(self, serializer):
        tenant = getattr(self.request, "tenant", None)
        serializer.save(tenant_slug=tenant.slug if tenant else "")


class OperacionEntregableViewSet(viewsets.ModelViewSet):
    serializer_class = OperacionEntregableSerializer
    filter_backends = (filters.SearchFilter, filters.OrderingFilter)
    search_fields = ("titulo", "codigo", "tipo_gasto")
    ordering_fields = ("created_at", "estado", "fecha_compromiso")
    ordering = ("-created_at",)
    filterset_fields = ("operacion", "estado", "requirement", "tipo_gasto", "codigo")

    def get_queryset(self):
        return OperacionEntregable.objects.select_related("operacion", "requirement").all()

    def perform_create(self, serializer):
        obj = serializer.save()
        _audit(self.request, "entregable_creado", obj, changes=serializer.validated_data)

    def perform_update(self, serializer):
        changes = serializer.validated_data.copy()
        obj = serializer.save()
        if changes:
            _audit(self.request, "entregable_actualizado", obj, changes=changes)


class EvidenciaMaterialViewSet(viewsets.ModelViewSet):
    serializer_class = EvidenciaMaterialSerializer
    filter_backends = (filters.SearchFilter, filters.OrderingFilter)
    search_fields = ("descripcion", "operacion__empresa__rfc", "operacion__proveedor__rfc")
    ordering_fields = ("created_at", "updated_at", "estatus_revision")
    ordering = ("-created_at",)
    filterset_fields = ("operacion", "tipo", "estatus_revision")

    def get_queryset(self):
        qs = EvidenciaMaterial.objects.select_related(
            "operacion",
            "operacion__empresa",
            "operacion__proveedor",
        )
        params = self.request.query_params if hasattr(self, "request") else {}
        empresa_rfc = params.get("empresa_rfc")
        proveedor_rfc = params.get("proveedor_rfc")
        if empresa_rfc:
            qs = qs.filter(operacion__empresa__rfc__iexact=empresa_rfc.strip())
        if proveedor_rfc:
            qs = qs.filter(operacion__proveedor__rfc__iexact=proveedor_rfc.strip())
        return qs

    def perform_create(self, serializer):
        evidencia = serializer.save()
        _sync_operation_defense_projection_safe(operacion=evidencia.operacion)
        _audit(self.request, "evidencia_creada", evidencia, changes=serializer.validated_data)

    def perform_update(self, serializer):
        changes = serializer.validated_data.copy()
        evidencia = serializer.save()
        _sync_operation_defense_projection_safe(operacion=evidencia.operacion)
        if changes:
            _audit(self.request, "evidencia_actualizada", evidencia, changes=changes)

    def perform_destroy(self, instance):
        operacion = instance.operacion
        _audit(self.request, "evidencia_eliminada", instance, changes={"id": instance.id})
        super().perform_destroy(instance)
        _sync_operation_defense_projection_safe(operacion=operacion)


class CuentaBancariaViewSet(viewsets.ModelViewSet):
    serializer_class = CuentaBancariaSerializer
    filter_backends = (filters.SearchFilter, filters.OrderingFilter)
    search_fields = ("alias", "banco", "clabe")
    ordering_fields = ("created_at", "alias")
    ordering = ("alias",)
    filterset_fields = ("empresa", "moneda", "es_principal")

    def get_queryset(self):
        return CuentaBancaria.objects.select_related("empresa").all()


class EstadoCuentaViewSet(viewsets.ModelViewSet):
    serializer_class = EstadoCuentaSerializer
    filter_backends = (filters.SearchFilter, filters.OrderingFilter)
    search_fields = ("archivo_url", "hash_archivo")
    ordering_fields = ("periodo_fin", "created_at")
    ordering = ("-periodo_fin",)
    filterset_fields = ("cuenta",)

    def get_queryset(self):
        return EstadoCuenta.objects.select_related("cuenta", "cuenta__empresa").all()


class MovimientoBancarioViewSet(viewsets.ModelViewSet):
    serializer_class = MovimientoBancarioSerializer
    filter_backends = (filters.SearchFilter, filters.OrderingFilter)
    search_fields = ("descripcion", "referencia", "spei_referencia", "nombre_contraparte")
    ordering_fields = ("fecha", "monto", "created_at")
    ordering = ("-fecha",)
    filterset_fields = ("cuenta", "estado_cuenta", "tipo", "es_circular", "alerta_capacidad")

    def get_queryset(self):
        qs = MovimientoBancario.objects.select_related("cuenta", "estado_cuenta", "cuenta__empresa")
        params = self.request.query_params if hasattr(self, "request") else {}
        min_fecha = params.get("min_fecha")
        max_fecha = params.get("max_fecha")
        min_monto = params.get("min_monto")
        max_monto = params.get("max_monto")
        spei = params.get("spei_referencia")
        if min_fecha:
            qs = qs.filter(fecha__gte=min_fecha)
        if max_fecha:
            qs = qs.filter(fecha__lte=max_fecha)
        if min_monto:
            try:
                qs = qs.filter(monto__gte=Decimal(min_monto))
            except Exception:
                pass
        if max_monto:
            try:
                qs = qs.filter(monto__lte=Decimal(max_monto))
            except Exception:
                pass
        if spei:
            qs = qs.filter(spei_referencia__iexact=spei)
        return qs

    def perform_create(self, serializer):
        movimiento = serializer.save()
        self._evaluar_alertas(movimiento)
        self._intentar_conciliar_auto(movimiento)

    def _evaluar_alertas(self, movimiento: MovimientoBancario) -> None:
        window_start = movimiento.fecha - timedelta(days=3)
        window_end = movimiento.fecha + timedelta(days=3)
        match = (
            MovimientoBancario.objects.filter(
                cuenta__empresa=movimiento.cuenta.empresa,
                monto=movimiento.monto,
                fecha__range=(window_start, window_end),
            )
            .exclude(pk=movimiento.pk)
            .first()
        )
        if match and (
            (movimiento.spei_referencia and movimiento.spei_referencia == match.spei_referencia)
            or (
                movimiento.cuenta_contraparte
                and movimiento.cuenta_contraparte == match.cuenta.numero_cuenta
                and match.cuenta_contraparte == movimiento.cuenta.numero_cuenta
            )
        ):
            MovimientoBancario.objects.filter(pk__in=[movimiento.pk, match.pk]).update(es_circular=True)

    def _intentar_conciliar_auto(self, movimiento: MovimientoBancario) -> None:
        if OperacionConciliacion.objects.filter(movimiento=movimiento).exists():
            return
        window = (movimiento.fecha - timedelta(days=3), movimiento.fecha + timedelta(days=3))
        candidatos = Operacion.objects.filter(
            empresa=movimiento.cuenta.empresa,
            moneda=movimiento.cuenta.moneda,
            fecha_operacion__range=window,
        )
        best = None
        best_confianza = Decimal("0")
        for op in candidatos:
            confianza = Decimal("0")
            if movimiento.spei_referencia and op.referencia_spei:
                if movimiento.spei_referencia.lower() == op.referencia_spei.lower():
                    confianza = Decimal("0.95")
            if confianza == 0:
                tol = max(Decimal("50"), op.monto * Decimal("0.01"))
                if (op.monto - tol) <= movimiento.monto <= (op.monto + tol):
                    confianza = Decimal("0.6")
            if confianza > best_confianza:
                best_confianza = confianza
                best = op

        if not best or best_confianza < Decimal("0.5"):
            return

        OperacionConciliacion.objects.create(
            operacion=best,
            movimiento=movimiento,
            estado=OperacionConciliacion.Estado.AUTO,
            confianza=best_confianza,
            comentario="Conciliación automática por SPEI/monto",
        )


class OperacionConciliacionViewSet(viewsets.ModelViewSet):
    serializer_class = OperacionConciliacionSerializer
    filter_backends = (filters.SearchFilter, filters.OrderingFilter)
    search_fields = ("comentario",)
    ordering_fields = ("created_at", "estado")
    ordering = ("-created_at",)
    filterset_fields = ("estado", "operacion")

    def get_queryset(self):
        return OperacionConciliacion.objects.select_related("operacion", "movimiento", "movimiento__cuenta")

    def perform_create(self, serializer):
        conciliacion = serializer.save()
        self._evaluar_capacidad(conciliacion)

    def perform_update(self, serializer):
        conciliacion = serializer.save()
        self._evaluar_capacidad(conciliacion)

    def _evaluar_capacidad(self, conciliacion: OperacionConciliacion) -> None:
        operacion = conciliacion.operacion
        proveedor = operacion.proveedor
        movimiento = conciliacion.movimiento
        if proveedor.capacidad_economica_mensual:
            limite = proveedor.capacidad_economica_mensual * Decimal("1.5")
            if operacion.monto > limite:
                movimiento.alerta_capacidad = True
                movimiento.save(update_fields=["alerta_capacidad", "updated_at"])


class RazonNegocioAprobacionViewSet(viewsets.ModelViewSet):
    serializer_class = RazonNegocioAprobacionSerializer
    filter_backends = (filters.SearchFilter, filters.OrderingFilter)
    search_fields = ("comentario", "firmado_por", "firmado_email")
    ordering_fields = ("created_at", "decidido_en", "estado")
    ordering = ("-created_at",)
    filterset_fields = ("contrato", "estado", "rol")

    def get_queryset(self):
        return RazonNegocioAprobacion.objects.select_related("contrato", "contrato__empresa", "contrato__proveedor")

    def perform_create(self, serializer):
        aprobacion = serializer.save()
        self._actualizar_estado_contrato(aprobacion)

    def perform_update(self, serializer):
        aprobacion = serializer.save()
        self._actualizar_estado_contrato(aprobacion)

    def _actualizar_estado_contrato(self, aprobacion: RazonNegocioAprobacion):
        contrato = aprobacion.contrato
        orden_roles = RazonNegocioAprobacionSerializer.ORDEN_ROLES
        aprobaciones = list(contrato.aprobaciones_razon.order_by("created_at"))
        estado_contrato = "PENDIENTE" if not aprobaciones else "EN_PROCESO"
        ultimo_rol = ""
        aprobado_en = None

        if any(a.estado == RazonNegocioAprobacion.Estado.RECHAZADO for a in aprobaciones):
            estado_contrato = "RECHAZADO"
        else:
            for rol in orden_roles:
                existente = next((a for a in reversed(aprobaciones) if a.rol == rol), None)
                if not existente:
                    estado_contrato = "EN_PROCESO"
                    break
                if existente.estado != RazonNegocioAprobacion.Estado.APROBADO:
                    estado_contrato = "EN_PROCESO"
                    break
                ultimo_rol = rol
                aprobado_en = existente.decidido_en or aprobado_en
            else:
                estado_contrato = "APROBADO"

        contrato.razon_negocio_estado = estado_contrato
        contrato.razon_negocio_ultimo_rol = ultimo_rol
        contrato.razon_negocio_aprobado_en = aprobado_en
        contrato.save(
            update_fields=[
                "razon_negocio_estado",
                "razon_negocio_ultimo_rol",
                "razon_negocio_aprobado_en",
                "updated_at",
            ]
        )


class LegalConsultationViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = LegalConsultationSerializer
    filter_backends = (filters.SearchFilter, filters.OrderingFilter)
    search_fields = ("question", "context", "answer")
    ordering_fields = ("created_at",)
    ordering = ("-created_at",)
    filterset_fields = ("ai_model",)
    http_method_names = ["get", "post", "delete"]

    def get_queryset(self):
        tenant = TenantContext.get_current_tenant()
        queryset = LegalConsultation.objects.select_related("user").order_by("-created_at")
        if tenant:
            return queryset.filter(tenant_slug=tenant.slug)
        return LegalConsultation.objects.none()

    def create(self, request, *args, **kwargs):
        request_serializer = LegalConsultationRequestSerializer(data=request.data)
        request_serializer.is_valid(raise_exception=True)
        payload = request_serializer.validated_data
        try:
            consultation = perform_legal_consultation(
                question=payload["pregunta"],
                context=payload.get("contexto"),
                ley=payload.get("ley"),
                source_type=payload.get("tipo_fuente"),
                authority=payload.get("autoridad_emisora"),
                ordenamiento=payload.get("ordenamiento"),
                only_current=payload.get("solo_vigentes", True),
                max_refs=payload.get("max_referencias", 3),
                user=request.user,
            )
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        serializer = self.get_serializer(consultation)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    @action(detail=True, methods=["get"], url_path="exportar-pdf")
    def exportar_pdf(self, request, *args, **kwargs):
        consultation = self.get_object()
        pdf_bytes = build_legal_consultation_pdf(consultation)
        response = HttpResponse(pdf_bytes, content_type="application/pdf")
        response["Content-Disposition"] = f'attachment; filename="consulta-legal-{consultation.id}.pdf"'
        return response


class ContratoTemplateViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = ContratoTemplateSerializer
    queryset = (
        ContratoTemplate.objects.filter(activo=True)
        .all()
        .order_by("orden", "nombre")
    )
    filter_backends = (filters.SearchFilter, filters.OrderingFilter)
    search_fields = ("nombre", "categoria", "proceso", "clave")
    ordering_fields = ("orden", "nombre")
    pagination_class = None


class OperacionViewSet(viewsets.ModelViewSet):
    serializer_class = OperacionSerializer
    filter_backends = (filters.SearchFilter, filters.OrderingFilter)
    search_fields = ("uuid_cfdi", "empresa__razon_social", "proveedor__razon_social")
    ordering_fields = ("fecha_operacion", "monto", "created_at")
    filterset_fields = (
        "estatus_validacion",
        "moneda",
        "tipo_operacion",
        "empresa",
        "proveedor",
        "contrato",
    )

    def get_queryset(self):
        base_qs = Operacion.objects.select_related("empresa", "proveedor", "contrato").order_by("-fecha_operacion")
        return base_qs.prefetch_related(
            Prefetch("entregables", to_attr="entregables_prefetched"),
            Prefetch("evidencias"),
            Prefetch(
                "checklists_operativos",
                queryset=OperacionChecklist.objects.prefetch_related("items"),
                to_attr="checklists_operativos_prefetched",
            ),
        )

    def perform_create(self, serializer):
        operacion = serializer.save()
        sync_operacion_materialidad(
            operacion=operacion,
            owner_email=getattr(self.request.user, "email", ""),
            sync_alertas=False,
        )
        _sync_operation_defense_projection_safe(operacion=operacion)

    def perform_update(self, serializer):
        operacion = serializer.save()
        sync_operacion_materialidad(
            operacion=operacion,
            owner_email=getattr(self.request.user, "email", ""),
            sync_alertas=False,
        )
        _sync_operation_defense_projection_safe(operacion=operacion)

    @action(detail=True, methods=["get"], url_path="checklists")
    def checklists(self, request, *args, **kwargs):
        operacion = self.get_object()
        serializer = OperacionChecklistSerializer(
            operacion.checklists_operativos.prefetch_related("items").all(),
            many=True,
        )
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="sugerir-checklist")
    def sugerir_checklist(self, request, *args, **kwargs):
        operacion = self.get_object()
        serializer = ChecklistDraftRequestSerializer(
            data={
                **request.data,
                "operacion": operacion.pk,
                "naturaleza_operacion": request.data.get("naturaleza_operacion") or operacion.concepto,
            }
        )
        serializer.is_valid(raise_exception=True)
        payload = serializer.validated_data

        result = generate_checklist_draft(
            tenant=getattr(request, "tenant", None),
            naturaleza_operacion=payload["naturaleza_operacion"],
            tipo_operacion=payload.get("tipo_operacion", operacion.tipo_operacion),
            tipo_gasto=payload.get("tipo_gasto", ""),
            monto=payload.get("monto", operacion.monto),
            moneda=payload.get("moneda", operacion.moneda),
            empresa=payload.get("empresa", operacion.empresa),
            proveedor=payload.get("proveedor", operacion.proveedor),
            contrato=payload.get("contrato", operacion.contrato),
            operacion=operacion,
        )
        output = ChecklistDraftResponseSerializer(result)
        return Response(output.data, status=status.HTTP_200_OK)

    @action(detail=False, methods=["get"], url_path="bandeja-revision")
    def bandeja_revision(self, request, *args, **kwargs):
        rol = (request.query_params.get("rol") or "").strip().upper()
        estatus = (request.query_params.get("estatus") or "").strip().upper()
        riesgo = (request.query_params.get("riesgo") or "").strip().upper()
        rfc = (request.query_params.get("rfc") or "").strip().upper()
        orden = (request.query_params.get("orden") or "riesgo").strip().lower()

        roles_validos = {"SERVICIOS", "COMPRAS", "PARTES_RELACIONADAS", "GENERAL"}
        if rol and rol not in roles_validos:
            return Response(
                {
                    "detail": "Parámetro 'rol' inválido.",
                    "roles_validos": sorted(roles_validos),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        riesgos_validos = {"BAJO", "MEDIO", "ALTO"}
        if riesgo and riesgo not in riesgos_validos:
            return Response(
                {
                    "detail": "Parámetro 'riesgo' inválido.",
                    "riesgos_validos": sorted(riesgos_validos),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        queryset = self.get_queryset().prefetch_related(
            Prefetch(
                "alertas",
                queryset=AlertaOperacion.objects.filter(estatus=AlertaOperacion.Estatus.ACTIVA).order_by("-fecha_alerta"),
                to_attr="alertas_activas_prefetched",
            )
        )

        if estatus:
            queryset = queryset.filter(estatus_validacion=estatus)

        if rfc:
            queryset = queryset.filter(Q(empresa__rfc__iexact=rfc) | Q(proveedor__rfc__iexact=rfc))

        operaciones = list(queryset)
        serializer = BandejaRevisionItemSerializer(operaciones, many=True)
        items = list(serializer.data)

        if rol:
            items = [item for item in items if item.get("perfil_validacion") == rol]

        if riesgo:
            items = [item for item in items if item.get("riesgo_nivel") == riesgo]

        if orden == "antiguedad":
            items.sort(
                key=lambda item: (
                    item.get("fecha_operacion") or "",
                    -int(item.get("riesgo_score") or 0),
                    int(item.get("id") or 0),
                )
            )
        else:
            items.sort(
                key=lambda item: (
                    -int(item.get("riesgo_score") or 0),
                    item.get("fecha_operacion") or "",
                    int(item.get("id") or 0),
                )
            )

        page = self.paginate_queryset(items)
        if page is not None:
            return self.get_paginated_response(page)
        return Response(items, status=status.HTTP_200_OK)

    @action(detail=False, methods=["get"], url_path="matriz-materialidad")
    def matriz_materialidad(self, request, *args, **kwargs):
        estatus = (request.query_params.get("estatus") or "").strip().upper()
        riesgo = (request.query_params.get("riesgo") or "").strip().upper()
        rfc = (request.query_params.get("rfc") or "").strip().upper()
        orden = (request.query_params.get("orden") or "riesgo").strip().lower()
        empresa_id = (request.query_params.get("empresa") or "").strip()
        proveedor_id = (request.query_params.get("proveedor") or "").strip()

        riesgos_validos = {"BAJO", "MEDIO", "ALTO"}
        if riesgo and riesgo not in riesgos_validos:
            return Response(
                {
                    "detail": "Parámetro 'riesgo' inválido.",
                    "riesgos_validos": sorted(riesgos_validos),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if orden not in {"riesgo", "antiguedad"}:
            return Response(
                {
                    "detail": "Parámetro 'orden' inválido.",
                    "ordenes_validos": ["riesgo", "antiguedad"],
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        queryset = self.get_queryset().prefetch_related(
            Prefetch(
                "alertas",
                queryset=AlertaOperacion.objects.filter(estatus=AlertaOperacion.Estatus.ACTIVA).order_by("-fecha_alerta"),
                to_attr="alertas_activas_prefetched",
            )
        )

        if estatus:
            queryset = queryset.filter(estatus_validacion=estatus)
        if empresa_id:
            queryset = queryset.filter(empresa_id=empresa_id)
        if proveedor_id:
            queryset = queryset.filter(proveedor_id=proveedor_id)
        if rfc:
            queryset = queryset.filter(Q(empresa__rfc__iexact=rfc) | Q(proveedor__rfc__iexact=rfc))

        operaciones = list(queryset)
        serializer = MatrizMaterialidadItemSerializer(operaciones, many=True)
        items = list(serializer.data)

        if riesgo:
            items = [item for item in items if item.get("riesgo_nivel") == riesgo]

        if orden == "antiguedad":
            items.sort(
                key=lambda item: (
                    item.get("fecha_operacion") or "",
                    -int(item.get("riesgo_score") or 0),
                    int(item.get("id") or 0),
                )
            )
        else:
            items.sort(
                key=lambda item: (
                    -int(item.get("riesgo_score") or 0),
                    item.get("fecha_operacion") or "",
                    int(item.get("id") or 0),
                )
            )

        page = self.paginate_queryset(items)
        if page is not None:
            return self.get_paginated_response(page)
        return Response(items, status=status.HTTP_200_OK)

    @staticmethod
    def _transiciones_permitidas() -> dict[str, set[str]]:
        return {
            Operacion.EstatusValidacion.PENDIENTE: {
                Operacion.EstatusValidacion.EN_PROCESO,
                Operacion.EstatusValidacion.VALIDADO,
                Operacion.EstatusValidacion.RECHAZADO,
            },
            Operacion.EstatusValidacion.EN_PROCESO: {
                Operacion.EstatusValidacion.VALIDADO,
                Operacion.EstatusValidacion.RECHAZADO,
            },
            Operacion.EstatusValidacion.RECHAZADO: {
                Operacion.EstatusValidacion.EN_PROCESO,
            },
            Operacion.EstatusValidacion.VALIDADO: {
                Operacion.EstatusValidacion.EN_PROCESO,
            },
        }

    @action(detail=True, methods=["post"], url_path="cambiar-estatus")
    def cambiar_estatus(self, request, *args, **kwargs):
        operacion = self.get_object()
        serializer = OperacionCambioEstatusSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        nuevo_estatus = data["estatus_validacion"]
        estatus_actual = operacion.estatus_validacion

        if nuevo_estatus != estatus_actual:
            transiciones = self._transiciones_permitidas()
            permitidas = transiciones.get(estatus_actual, set())
            if nuevo_estatus not in permitidas:
                return Response(
                    {
                        "detail": f"Transición de estatus no permitida: {estatus_actual} -> {nuevo_estatus}.",
                        "estatus_actual": estatus_actual,
                        "estatus_solicitado": nuevo_estatus,
                        "transiciones_permitidas": sorted(permitidas),
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

        perfil_validacion, faltantes_materialidad = get_operacion_faltantes_materialidad(operacion)

        if nuevo_estatus == Operacion.EstatusValidacion.VALIDADO:
            faltantes = faltantes_materialidad
            if faltantes:
                alerta = create_or_get_alerta_operacion_faltantes(
                    operacion=operacion,
                    perfil_validacion=perfil_validacion,
                    faltantes=faltantes,
                    owner_email=getattr(request.user, "email", ""),
                )
                return Response(
                    {
                        "detail": "No se puede marcar como VALIDADO: expediente incompleto.",
                        "faltantes": faltantes,
                        "perfil_validacion": perfil_validacion,
                        "alerta_operacion_id": alerta.id if alerta else None,
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

        detalle = operacion.detalles_validacion or {}
        metadata = dict(operacion.metadata or {})
        metadata["riesgo_materialidad"] = get_operacion_riesgo_materialidad(operacion)

        if data.get("comentario"):
            detalle.setdefault("comentarios_estatus", []).append(
                {
                    "estatus": nuevo_estatus,
                    "comentario": data["comentario"],
                    "fecha": timezone.now().isoformat(),
                    "usuario": getattr(request.user, "email", ""),
                }
            )

        operacion.estatus_validacion = nuevo_estatus
        operacion.detalles_validacion = detalle
        operacion.metadata = metadata
        operacion.ultima_validacion = timezone.now()
        operacion.save(
            update_fields=[
                "estatus_validacion",
                "detalles_validacion",
                "metadata",
                "ultima_validacion",
                "updated_at",
            ]
        )
        sync_operacion_materialidad(
            operacion=operacion,
            owner_email=getattr(request.user, "email", ""),
            sync_alertas=False,
        )
        _sync_operation_defense_projection_safe(operacion=operacion)

        _audit(
            request,
            "operacion_estatus_actualizado",
            operacion,
            changes={
                "estatus_anterior": estatus_actual,
                "estatus_validacion": nuevo_estatus,
                "comentario": data.get("comentario", ""),
            },
        )
        return Response(self.get_serializer(operacion).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["get"], url_path="exportar-dossier")
    def exportar_dossier(self, request, *args, **kwargs):
        operacion = self.get_object()
        dossier_bytes = build_operacion_dossier_zip(operacion)
        timestamp = timezone.now().strftime("%Y%m%d-%H%M")
        filename = f"dossier-operacion-{operacion.id}-{timestamp}.zip"
        response = HttpResponse(dossier_bytes, content_type="application/zip")
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        response["X-Dossier-Operacion"] = str(operacion.id)
        return response

    @action(detail=True, methods=["get"], url_path="exportar-pdf-defensa")
    def exportar_pdf_defensa(self, request, *args, **kwargs):
        operacion = self.get_object()
        pdf_bytes = build_operacion_defensa_pdf(operacion)
        timestamp = timezone.now().strftime("%Y%m%d-%H%M")
        filename = f"defensa-operacion-{operacion.id}-{timestamp}.pdf"
        response = HttpResponse(pdf_bytes, content_type="application/pdf")
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        response["Content-Length"] = str(len(pdf_bytes))
        response["X-Defensa-Operacion"] = str(operacion.id)
        return response


class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = AuditLogSerializer
    filter_backends = (filters.SearchFilter, filters.OrderingFilter)
    search_fields = ("actor_email", "actor_name", "action", "object_type", "object_id")
    ordering_fields = ("created_at",)
    ordering = ("-created_at",)
    filterset_fields = ("action", "object_type", "actor_email")

    def get_queryset(self):
        qs = AuditLog.objects.all()
        params = self.request.query_params if hasattr(self, "request") else {}
        since = params.get("created_after")
        until = params.get("created_before")
        if since:
            qs = qs.filter(created_at__gte=since)
        if until:
            qs = qs.filter(created_at__lte=until)
        return qs


class AuditMaterialityDossierViewSet(viewsets.ModelViewSet):
    serializer_class = AuditMaterialityDossierSerializer
    queryset = AuditMaterialityDossier.objects.select_related("empresa").all().order_by("-updated_at")
    filter_backends = (filters.SearchFilter, filters.OrderingFilter)
    search_fields = ("empresa__razon_social", "empresa__rfc")
    ordering_fields = ("updated_at", "created_at", "ejercicio")
    filterset_fields = ("empresa", "ejercicio")

    def get_queryset(self):
        queryset = super().get_queryset()
        params = self.request.query_params if hasattr(self, "request") else {}
        empresa = params.get("empresa")
        ejercicio = params.get("ejercicio")
        if empresa:
            queryset = queryset.filter(empresa_id=empresa)
        if ejercicio:
            queryset = queryset.filter(ejercicio=ejercicio)
        return queryset

    def _editor_defaults(self) -> dict[str, str]:
        user = getattr(self.request, "user", None)
        return {
            "last_edited_by_email": getattr(user, "email", "") or "",
            "last_edited_by_name": _resolve_actor_display_name(user),
        }

    def _create_version(self, dossier: AuditMaterialityDossier, source: str) -> None:
        latest = dossier.versions.order_by("-version_number").first()
        payload = dossier.payload or {}
        if latest and (latest.payload or {}) == payload:
            return
        next_version = (latest.version_number + 1) if latest else 1
        editor = self._editor_defaults()
        AuditMaterialityDossierVersion.objects.create(
            dossier=dossier,
            version_number=next_version,
            payload=payload,
            source=source,
            edited_by_email=editor["last_edited_by_email"],
            edited_by_name=editor["last_edited_by_name"],
        )

    def perform_create(self, serializer):
        dossier = serializer.save(**self._editor_defaults())
        self._create_version(dossier, AuditMaterialityDossierVersion.Source.MANUAL)
        _audit(
            self.request,
            "materialidad_auditoria_creada",
            dossier,
            changes={
                "empresa": dossier.empresa_id,
                "ejercicio": dossier.ejercicio,
                "hallazgos": len((dossier.payload or {}).get("findings") or []),
            },
        )

    def perform_update(self, serializer):
        dossier = serializer.save(**self._editor_defaults())
        self._create_version(dossier, AuditMaterialityDossierVersion.Source.MANUAL)
        _audit(
            self.request,
            "materialidad_auditoria_actualizada",
            dossier,
            changes={
                "empresa": dossier.empresa_id,
                "ejercicio": dossier.ejercicio,
                "hallazgos": len((dossier.payload or {}).get("findings") or []),
            },
        )

    @action(detail=False, methods=["post"], url_path="upsert")
    def upsert(self, request, *args, **kwargs):
        existing = None
        empresa_id = request.data.get("empresa")
        ejercicio = request.data.get("ejercicio")
        if empresa_id and ejercicio:
            existing = AuditMaterialityDossier.objects.filter(empresa_id=empresa_id, ejercicio=ejercicio).first()

        serializer = self.get_serializer(instance=existing, data=request.data)
        serializer.is_valid(raise_exception=True)
        validated = serializer.validated_data
        payload = validated.get("payload") or {}
        source = payload.get("saveMode") if isinstance(payload, dict) else None
        version_source = (
            AuditMaterialityDossierVersion.Source.AUTOSAVE
            if source == "autosave"
            else AuditMaterialityDossierVersion.Source.MANUAL
        )
        dossier, created = AuditMaterialityDossier.objects.update_or_create(
            empresa=validated["empresa"],
            ejercicio=validated["ejercicio"],
            defaults={
                "payload": payload,
                **self._editor_defaults(),
            },
        )
        self._create_version(dossier, version_source)
        _audit(
            request,
            "materialidad_auditoria_creada" if created else "materialidad_auditoria_actualizada",
            dossier,
            changes={
                "empresa": dossier.empresa_id,
                "ejercicio": dossier.ejercicio,
                "hallazgos": len((dossier.payload or {}).get("findings") or []),
                "upsert": True,
            },
        )
        output = self.get_serializer(dossier)
        return Response(output.data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)

    @action(detail=True, methods=["get"], url_path="versiones")
    def versiones(self, request, *args, **kwargs):
        dossier = self.get_object()
        versions = dossier.versions.all().order_by("-version_number")[:20]
        serializer = AuditMaterialityDossierVersionSerializer(versions, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="restaurar-version")
    def restaurar_version(self, request, *args, **kwargs):
        dossier = self.get_object()
        version_id = request.data.get("version_id")
        if not version_id:
            return Response({"detail": "Debes indicar version_id."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            version = dossier.versions.get(pk=version_id)
        except AuditMaterialityDossierVersion.DoesNotExist:
            return Response({"detail": "La versión solicitada no existe para este expediente."}, status=status.HTTP_404_NOT_FOUND)

        dossier.payload = version.payload or {}
        dossier.last_edited_by_email = self._editor_defaults()["last_edited_by_email"]
        dossier.last_edited_by_name = self._editor_defaults()["last_edited_by_name"]
        dossier.save(update_fields=["payload", "last_edited_by_email", "last_edited_by_name", "updated_at"])
        self._create_version(dossier, AuditMaterialityDossierVersion.Source.RESTORE)
        _audit(
            request,
            "materialidad_auditoria_restaurada",
            dossier,
            changes={"version_id": version.id, "version_number": version.version_number},
        )
        return Response(self.get_serializer(dossier).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["get"], url_path="exportar-pdf")
    def exportar_pdf(self, request, *args, **kwargs):
        dossier = self.get_object()
        pdf_bytes = build_audit_materiality_pdf(dossier)
        timestamp = timezone.now().strftime("%Y%m%d-%H%M")
        filename = f"materialidad-auditoria-{dossier.empresa_id}-{dossier.ejercicio}-{timestamp}.pdf"
        _audit(request, "materialidad_auditoria_exportada_pdf", dossier, changes={"filename": filename})
        response = HttpResponse(pdf_bytes, content_type="application/pdf")
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        response["Content-Length"] = str(len(pdf_bytes))
        return response

    @action(detail=True, methods=["get"], url_path="exportar-docx")
    def exportar_docx(self, request, *args, **kwargs):
        dossier = self.get_object()
        docx_bytes = build_audit_materiality_docx(dossier)
        timestamp = timezone.now().strftime("%Y%m%d-%H%M")
        filename = f"materialidad-auditoria-{dossier.empresa_id}-{dossier.ejercicio}-{timestamp}.docx"
        _audit(request, "materialidad_auditoria_exportada_docx", dossier, changes={"filename": filename})
        response = HttpResponse(
            docx_bytes,
            content_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        )
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        response["Content-Length"] = str(len(docx_bytes))
        return response


class CFDISPEIValidationView(APIView):
    """Valida CFDI y referencia SPEI; opcionalmente persiste en una operación."""

    def post(self, request, *args, **kwargs):
        serializer = CFDISPEIValidationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        operacion: Operacion | None = data.get("operacion")
        result = validate_cfdi_spei(
            uuid_cfdi=data.get("uuid_cfdi"),
            referencia_spei=data.get("referencia_spei"),
            monto=data.get("monto"),
        )

        if operacion:
            now = timezone.now()
            detalles = operacion.detalles_validacion or {}
            detalles["cfdi_spei"] = result
            operacion.detalles_validacion = detalles
            operacion.cfdi_estatus = result["cfdi_estatus"]
            operacion.spei_estatus = result["spei_estatus"]
            if result.get("cfdi_estatus") != Operacion.EstatusCFDI.PENDIENTE:
                operacion.ultima_validacion_cfdi = now
            if result.get("spei_estatus") != Operacion.EstatusSPEI.PENDIENTE:
                operacion.ultima_validacion_spei = now
            operacion.ultima_validacion = now
            operacion.save(
                update_fields=
                [
                    "detalles_validacion",
                    "cfdi_estatus",
                    "spei_estatus",
                    "ultima_validacion",
                    "ultima_validacion_cfdi",
                    "ultima_validacion_spei",
                    "updated_at",
                ]
            )
            result["operacion_id"] = operacion.id

        return Response(result, status=status.HTTP_200_OK)


class PriceComparisonView(APIView):
    """Comparativo simple de precios entre proveedores."""

    def post(self, request, *args, **kwargs):
        serializer = PriceComparisonSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        items = data["items"]

        sorted_items = sorted(items, key=lambda x: x["precio"])
        best = sorted_items[0]
        worst = sorted_items[-1]
        promedio = sum([i["precio"] for i in items]) / len(items)
        ahorro_vs_promedio = float(promedio - best["precio"])
        delta_porcentual = float(((worst["precio"] - best["precio"]) / best["precio"]) * 100)

        response = {
            "concepto": data["concepto"],
            "mejor_opcion": best,
            "peor_opcion": worst,
            "diferencia_porcentual": round(delta_porcentual, 2),
            "ahorro_vs_promedio": round(ahorro_vs_promedio, 4),
            "items_ordenados": sorted_items,
        }
        return Response(response, status=status.HTTP_200_OK)


class CotizacionPDFViewSet(viewsets.ModelViewSet):
    """Carga de cotizaciones PDF y extracción de conceptos."""

    serializer_class = CotizacionPDFSerializer
    parser_classes = [MultiPartParser, FormParser]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["proveedor_nombre", "archivo_nombre"]
    ordering_fields = ["created_at", "proveedor_nombre", "estatus"]
    ordering = ["-created_at"]

    def get_queryset(self):
        qs = CotizacionPDF.objects.all().prefetch_related("conceptos")
        empresa_id = self.request.query_params.get("empresa")
        if empresa_id:
            qs = qs.filter(empresa_id=empresa_id)
        return qs

    def create(self, request, *args, **kwargs):
        upload_serializer = CotizacionPDFUploadSerializer(data=request.data)
        upload_serializer.is_valid(raise_exception=True)

        empresa_id = request.data.get("empresa")
        if not empresa_id:
            return Response({"detail": "Debes especificar la empresa"}, status=status.HTTP_400_BAD_REQUEST)
        try:
            empresa = Empresa.objects.get(pk=empresa_id)
        except Empresa.DoesNotExist:
            return Response({"detail": "Empresa no encontrada"}, status=status.HTTP_404_NOT_FOUND)

        archivo = upload_serializer.validated_data["archivo"]
        proveedor_nombre = upload_serializer.validated_data.get("proveedor_nombre", "")

        cotizacion = CotizacionPDF.objects.create(
            empresa=empresa,
            proveedor_nombre=proveedor_nombre,
            archivo=archivo,
            archivo_nombre=archivo.name or "",
            estatus=CotizacionPDF.EstatusProcesamiento.PENDIENTE,
        )

        try:
            with cotizacion.archivo.open("rb") as fh:
                conceptos, meta = _extract_pdf_concepts(fh, cotizacion.archivo_nombre)

            cotizacion.metadata = meta
            cotizacion.texto_extraido = _extract_document_text(cotizacion.archivo)

            if conceptos:
                objs = []
                for idx, concepto in enumerate(conceptos):
                    objs.append(
                        CotizacionConcepto(
                            cotizacion=cotizacion,
                            descripcion=concepto["descripcion"],
                            cantidad=concepto["cantidad"],
                            precio_unitario=concepto["precio_unitario"],
                            importe=concepto["importe"],
                            moneda=concepto["moneda"],
                            unidad=concepto.get("unidad", ""),
                            orden=idx,
                        )
                    )
                CotizacionConcepto.objects.bulk_create(objs)
                cotizacion.estatus = CotizacionPDF.EstatusProcesamiento.PROCESADO
            else:
                cotizacion.estatus = CotizacionPDF.EstatusProcesamiento.ERROR
                cotizacion.error_detalle = "No se encontraron conceptos en el PDF"
        except Exception as exc:
            cotizacion.estatus = CotizacionPDF.EstatusProcesamiento.ERROR
            cotizacion.error_detalle = str(exc)
        cotizacion.save()

        serializer = self.get_serializer(cotizacion)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["post"], url_path="comparar")
    def comparar(self, request, *args, **kwargs):
        ids = request.data.get("cotizacion_ids") or []
        if not isinstance(ids, list) or len(ids) < 2:
            return Response(
                {"detail": "Incluye al menos 2 cotizaciones"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        qs = CotizacionPDF.objects.filter(id__in=ids).prefetch_related("conceptos")
        if qs.count() < 2:
            return Response(
                {"detail": "Cotizaciones insuficientes"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        proveedores = []
        totals: dict[int, Decimal] = {}
        concept_map: dict[str, dict] = {}
        monedas: set[str] = set()

        for cot in qs:
            proveedor = cot.proveedor_nombre or cot.archivo_nombre or f"Proveedor {cot.id}"
            proveedores.append({"id": cot.id, "nombre": proveedor})
            totals[cot.id] = Decimal(0)
            for c in cot.conceptos.all():
                key = _normalize_concept(c.descripcion)
                if not key:
                    continue
                if key not in concept_map:
                    concept_map[key] = {
                        "descripcion": c.descripcion,
                        "valores": {},
                    }
                concept_map[key]["valores"].setdefault(cot.id, Decimal(0))
                concept_map[key]["valores"][cot.id] += c.importe
                totals[cot.id] += c.importe
                monedas.add(c.moneda or "MXN")

        concepts = []
        for key, payload in concept_map.items():
            valores = payload["valores"]
            precios = [v for v in valores.values() if v is not None]
            if not precios:
                continue
            best = min(precios)
            worst = max(precios)
            avg = sum(precios) / len(precios)
            concepts.append(
                {
                    "descripcion": payload["descripcion"],
                    "valores": {str(k): float(v) for k, v in valores.items()},
                    "min": float(best),
                    "max": float(worst),
                    "avg": float(avg),
                }
            )

        concepts.sort(key=lambda x: x["descripcion"].lower())

        summary = {
            "proveedores": proveedores,
            "totales": {str(k): float(v) for k, v in totals.items()},
            "mejor_total": None,
            "monedas": sorted(list(monedas)),
            "conceptos": len(concepts),
        }
        if totals:
            best_id = min(totals, key=totals.get)
            summary["mejor_total"] = {
                "cotizacion_id": best_id,
                "proveedor": next((p["nombre"] for p in proveedores if p["id"] == best_id), ""),
                "total": float(totals[best_id]),
            }

        return Response({"summary": summary, "concepts": concepts}, status=status.HTTP_200_OK)


class DashboardMetricsView(APIView):
    def get(self, request, *args, **kwargs):
        data = get_dashboard_metrics(include_fdi_operability=True)
        return Response(data, status=status.HTTP_200_OK)


class DashboardCoberturaP0View(APIView):
    def get(self, request, *args, **kwargs):
        try:
            days = int(request.query_params.get("days", 90))
        except (TypeError, ValueError):
            return Response({"detail": "El parámetro 'days' debe ser numérico"}, status=status.HTTP_400_BAD_REQUEST)

        empresa_param = request.query_params.get("empresa")
        empresa_id: int | None = None
        if empresa_param not in (None, ""):
            try:
                empresa_id = int(empresa_param)
            except (TypeError, ValueError):
                return Response(
                    {"detail": "El parámetro 'empresa' debe ser un entero válido"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        data = get_dashboard_cobertura_p0(days=days, empresa_id=empresa_id)
        return Response(data, status=status.HTTP_200_OK)


class DashboardSnapshotHistoryView(APIView):
    max_days = 365
    max_points = 720

    def get(self, request, *args, **kwargs):
        tenant = TenantContext.get_current_tenant()
        if not tenant:
            return Response(
                {"detail": "No se pudo resolver el tenant activo para la sesión."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            days = int(request.query_params.get("days", 90))
        except (TypeError, ValueError):
            return Response({"detail": "El parámetro 'days' debe ser numérico"}, status=status.HTTP_400_BAD_REQUEST)
        days = max(1, min(days, self.max_days))

        try:
            date_from = self._parse_date(request.query_params.get("from"))
            date_to = self._parse_date(request.query_params.get("to"))
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        if date_from and date_to and date_from > date_to:
            return Response(
                {"detail": "El parámetro 'from' debe ser anterior o igual a 'to'."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not date_to:
            date_to = timezone.now()
        if not date_from:
            date_from = date_to - timedelta(days=days)

        try:
            limit = int(request.query_params.get("limit", 180))
        except (TypeError, ValueError):
            return Response({"detail": "El parámetro 'limit' debe ser numérico"}, status=status.HTTP_400_BAD_REQUEST)
        limit = max(1, min(limit, self.max_points))

        queryset = (
            DashboardSnapshot.objects.filter(tenant_slug=tenant.slug)
            .filter(captured_at__gte=date_from, captured_at__lte=date_to)
            .order_by("captured_at")[:limit]
        )

        serializer = DashboardSnapshotSerializer(queryset, many=True)
        return Response(
            {
                "range": {
                    "from": date_from.isoformat() if date_from else None,
                    "to": date_to.isoformat() if date_to else None,
                    "days": days,
                    "limit": limit,
                },
                "results": serializer.data,
            },
            status=status.HTTP_200_OK,
        )

    def _parse_date(self, value: str | None):
        if not value:
            return None
        try:
            parsed = datetime.fromisoformat(value)
        except ValueError as exc:  # pragma: no cover - formato invalido
            raise ValueError("Formato de fecha inválido. Usa ISO 8601, e.g. 2025-01-15 o 2025-01-15T08:00:00") from exc
        if parsed.tzinfo is None:
            parsed = timezone.make_aware(parsed, timezone.get_current_timezone())
        return parsed


# ---------------------------------------------------------------------------
# Clause Templates CRUD
# ---------------------------------------------------------------------------

class ClauseTemplateViewSet(viewsets.ModelViewSet):
    """CRUD for clause templates used by the contract generator."""

    serializer_class = ClauseTemplateSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["titulo", "slug", "resumen", "texto"]
    ordering_fields = ["prioridad", "nivel_riesgo", "created_at", "updated_at"]
    ordering = ["-prioridad", "-es_curada", "titulo"]

    def get_queryset(self):
        qs = ClauseTemplate.objects.filter(activo=True)
        nivel = self.request.query_params.get("nivel_riesgo")
        if nivel:
            qs = qs.filter(nivel_riesgo=nivel)
        curada = self.request.query_params.get("es_curada")
        if curada is not None:
            qs = qs.filter(es_curada=curada.lower() in ("true", "1", "si"))
        return qs


# ---------------------------------------------------------------------------
# Alertas CSD (Art. 17-H Bis)
# ---------------------------------------------------------------------------

class AlertaCSDViewSet(viewsets.ModelViewSet):
    """
    CRUD para gestionar contingencias y suspensiones de Sellos Digitales.
    Filtros: ?empresa_id=N  ?estatus=ACTIVA  ?tipo_alerta=PROPIETARIO
    """
    serializer_class = AlertaCSDSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["oficio_sat", "motivo_presuncion", "acciones_tomadas"]
    ordering_fields = ["fecha_deteccion", "fecha_resolucion", "created_at", "estatus"]
    ordering = ["-fecha_deteccion"]

    def get_queryset(self):
        qs = AlertaCSD.objects.select_related("empresa", "proveedor")
        empresa_id = self.request.query_params.get("empresa_id")
        estatus = self.request.query_params.get("estatus")
        tipo = self.request.query_params.get("tipo_alerta")
        if empresa_id:
            qs = qs.filter(empresa_id=empresa_id)
        if estatus:
            qs = qs.filter(estatus=estatus)
        if tipo:
            qs = qs.filter(tipo_alerta=tipo)
        return qs


class AlertaOperacionViewSet(viewsets.ModelViewSet):
    serializer_class = AlertaOperacionSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["motivo", "owner_email", "empresa__rfc", "proveedor__rfc"]
    ordering_fields = ["fecha_alerta", "created_at", "estatus", "tipo_alerta"]
    ordering = ["-fecha_alerta"]
    filterset_fields = ["empresa", "proveedor", "estatus", "tipo_alerta", "operacion"]

    def get_queryset(self):
        qs = AlertaOperacion.objects.select_related("empresa", "proveedor", "operacion")
        empresa_rfc = self.request.query_params.get("empresa_rfc")
        proveedor_rfc = self.request.query_params.get("proveedor_rfc")
        if empresa_rfc:
            qs = qs.filter(empresa__rfc__iexact=empresa_rfc.strip())
        if proveedor_rfc:
            qs = qs.filter(proveedor__rfc__iexact=proveedor_rfc.strip())
        return qs
