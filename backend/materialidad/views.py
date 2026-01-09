from __future__ import annotations

import json
from datetime import datetime, timedelta
from decimal import Decimal
from django.db.models import Prefetch

from django.core.exceptions import ImproperlyConfigured
from django.http import HttpResponse
from django.utils import timezone
from django.utils.text import slugify
from rest_framework import filters, status, viewsets, mixins
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from tenancy.context import TenantContext

from .ai.client import OpenAIClientError
from .ai.clause_library import suggest_clauses
from .ai.contracts import generate_contract_document, generate_definitive_contract
from .ai.citations import render_citations_markdown
from .ai.redlines import analyze_redlines
from .exporters import build_operacion_dossier_zip, markdown_to_docx_bytes
from .models import (
    Checklist,
    ChecklistItem,
    CuentaBancaria,
    Contrato,
    ContratoTemplate,
    DashboardSnapshot,
    DeliverableRequirement,
    EstadoCuenta,
    OperacionEntregable,
    Empresa,
    LegalConsultation,
    LegalReferenceSource,
    Operacion,
    OperacionConciliacion,
    RazonNegocioAprobacion,
    MovimientoBancario,
    Proveedor,
    AuditLog,
)
from .serializers import (
    ChecklistItemSerializer,
    ChecklistSerializer,
    ClauseSuggestionQuerySerializer,
    ClauseSuggestionSerializer,
    CuentaBancariaSerializer,
    ContratoGeneracionSerializer,
    ContratoDocxExportSerializer,
    ContratoSerializer,
    ContratoTemplateSerializer,
    DashboardSnapshotSerializer,
    DeliverableRequirementSerializer,
    OperacionEntregableSerializer,
    EstadoCuentaSerializer,
    ContratoFirmaLogisticaSerializer,
    LegalConsultationRequestSerializer,
    LegalConsultationSerializer,
    LegalReferenceSourceSerializer,
    RedlineAnalysisSerializer,
    OperacionConciliacionSerializer,
    EmpresaSerializer,
    OperacionSerializer,
    ProveedorSerializer,
    ProveedorValidacionSerializer,
    ProveedorValidacionResultadoSerializer,
    CFDISPEIValidationSerializer,
    PriceComparisonSerializer,
    RazonNegocioAprobacionSerializer,
    MovimientoBancarioSerializer,
    AuditLogSerializer,
)
from .services import (
    get_dashboard_metrics,
    perform_legal_consultation,
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


def _audit(request, action: str, obj, changes: dict | None = None):
    user = getattr(request, "user", None)
    AuditLog.objects.create(
        actor_id=getattr(user, "id", None),
        actor_email=getattr(user, "email", "") or "",
        actor_name=f"{getattr(user, 'first_name', '')} {getattr(user, 'last_name', '')}".strip(),
        action=action,
        object_type=obj._meta.label_lower,
        object_id=str(getattr(obj, "pk", "")),
        object_repr=str(obj)[:255],
        changes=changes or {},
        source_ip=_capture_ip(request),
    )


class EmpresaViewSet(viewsets.ModelViewSet):
    serializer_class = EmpresaSerializer
    queryset = Empresa.objects.all().order_by("razon_social")
    filter_backends = (filters.SearchFilter, filters.OrderingFilter)
    search_fields = ("razon_social", "rfc")
    ordering_fields = ("razon_social", "created_at")
    filterset_fields = ("regimen_fiscal", "activo", "pais")


class ProveedorViewSet(viewsets.ModelViewSet):
    serializer_class = ProveedorSerializer
    queryset = Proveedor.objects.all().order_by("razon_social")
    filter_backends = (filters.SearchFilter, filters.OrderingFilter)
    search_fields = ("razon_social", "rfc")
    ordering_fields = ("razon_social", "created_at")
    filterset_fields = ("pais", "estatus_sat")

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
        try:
            resultado = generate_contract_document(
                empresa=data["empresa"],
                template=data.get("template"),
                razon_negocio=data.get("razon_negocio"),
                beneficio_economico_esperado=data.get("beneficio_economico_esperado"),
                beneficio_fiscal_estimado=data.get("beneficio_fiscal_estimado"),
                fecha_cierta_requerida=data.get("fecha_cierta_requerida", False),
                resumen_necesidades=data.get("resumen_necesidades", ""),
                clausulas_especiales=data.get("clausulas_especiales"),
                idioma=data.get("idioma", "es"),
                tono=data.get("tono", "formal"),
            )
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
        response["X-Contrato-Citas"] = json.dumps(citas_legales, ensure_ascii=True)
        response["X-Contrato-Citas-Metadata"] = json.dumps(citas_metadata, ensure_ascii=True)
        return response

    @action(detail=True, methods=["post"], url_path="firma-logistica")
    def firma_logistica(self, request, *args, **kwargs):
        contrato = self.get_object()
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


class LegalReferenceSourceViewSet(viewsets.ModelViewSet):
    serializer_class = LegalReferenceSourceSerializer
    queryset = LegalReferenceSource.objects.all().order_by("ley", "articulo", "fraccion", "created_at")
    filter_backends = (filters.SearchFilter, filters.OrderingFilter)
    search_fields = ("ley", "articulo", "contenido", "resumen", "sat_categoria")
    ordering_fields = ("ley", "articulo", "created_at")
    filterset_fields = ("ley", "tipo_fuente")

    @action(detail=False, methods=["get"], url_path="leyes")
    def available_laws(self, request, *args, **kwargs):
        leyes = (
            self.filter_queryset(self.get_queryset())
            .order_by("ley")
            .values_list("ley", flat=True)
            .distinct()
        )
        return Response({"results": list(leyes)}, status=status.HTTP_200_OK)


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


class DeliverableRequirementViewSet(viewsets.ModelViewSet):
    serializer_class = DeliverableRequirementSerializer
    filter_backends = (filters.SearchFilter, filters.OrderingFilter)
    search_fields = ("tipo_gasto", "titulo", "codigo")
    ordering_fields = ("created_at", "tipo_gasto", "codigo")
    ordering = ("tipo_gasto", "codigo")

    def get_queryset(self):
        tenant = getattr(self.request, "tenant", None)
        qs = DeliverableRequirement.objects.all()
        if tenant:
            qs = qs.filter(tenant_slug=tenant.slug)
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
    viewsets.GenericViewSet,
):
    serializer_class = LegalConsultationSerializer
    filter_backends = (filters.SearchFilter, filters.OrderingFilter)
    search_fields = ("question", "context", "answer")
    ordering_fields = ("created_at",)
    ordering = ("-created_at",)
    filterset_fields = ("ai_model",)
    http_method_names = ["get", "post"]

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
                max_refs=payload.get("max_referencias", 3),
                user=request.user,
            )
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        serializer = self.get_serializer(consultation)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)


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
        )

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


class DashboardMetricsView(APIView):
    def get(self, request, *args, **kwargs):
        data = get_dashboard_metrics()
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
