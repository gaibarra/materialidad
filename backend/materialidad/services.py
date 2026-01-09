from __future__ import annotations

import logging
from datetime import timedelta
from decimal import Decimal, ROUND_HALF_UP
import re
from typing import Any

import requests
from django.conf import settings
from django.db.models import Q, Sum
from django.utils import timezone

from tenancy.context import TenantContext

from .ai.client import ChatMessage, OpenAIClient, OpenAIClientError
from .models import (
    Contrato,
    DashboardSnapshot,
    Empresa,
    LegalConsultation,
    LegalReferenceSource,
    Operacion,
    Proveedor,
)

TWO_DECIMAL = Decimal("0.01")

logger = logging.getLogger(__name__)


def validate_cfdi_spei(uuid_cfdi: str | None = None, referencia_spei: str | None = None, monto: Decimal | None = None) -> dict[str, Any]:
    """Valida CFDI/SPEI contra conectores externos.

    Implementación simulada: marca válido si el UUID termina en número par y la referencia SPEI existe; caso contrario marca inválido/no encontrado.
    """

    cfdi_estatus = "PENDIENTE"
    spei_estatus = "PENDIENTE"

    if uuid_cfdi:
        try:
            last_char = uuid_cfdi.strip().replace("-", "")[-1]
            cfdi_estatus = "VALIDO" if last_char.isdigit() and int(last_char) % 2 == 0 else "INVALIDO"
        except Exception:  # pragma: no cover - fallback defensivo
            cfdi_estatus = "INVALIDO"

    if referencia_spei:
        spei_estatus = "VALIDADO" if len(referencia_spei.strip()) >= 6 else "NO_ENCONTRADO"

    return {
        "uuid_cfdi": uuid_cfdi,
        "referencia_spei": referencia_spei,
        "monto": str(monto) if monto is not None else None,
        "cfdi_estatus": cfdi_estatus,
        "spei_estatus": spei_estatus,
    }


def trigger_proveedor_validacion(operacion: Operacion) -> None:
    trigger_validacion_proveedor(
        proveedor=operacion.proveedor,
        empresa=operacion.empresa,
        contexto_extra={
            "operacion_id": operacion.id,
            "uuid_cfdi": operacion.uuid_cfdi,
            "monto": str(operacion.monto),
            "moneda": operacion.moneda,
            "fecha_operacion": operacion.fecha_operacion.isoformat(),
        },
    )


def trigger_validacion_proveedor(
    *, proveedor: Proveedor, empresa: Empresa, contexto_extra: dict[str, Any] | None = None
) -> None:
    if not settings.N8N_WEBHOOK_URL:
        logger.info("N8N_WEBHOOK_URL no configurado; se omite validación de proveedor")
        return

    payload: dict[str, Any] = {
        "empresa": {
            "id": empresa.id,
            "rfc": empresa.rfc,
            "razon_social": empresa.razon_social,
        },
        "proveedor": {
            "id": proveedor.id,
            "rfc": proveedor.rfc,
            "razon_social": proveedor.razon_social,
        },
    }
    if contexto_extra:
        payload["contexto"] = contexto_extra

    headers = {"Content-Type": "application/json"}
    if settings.N8N_API_KEY:
        headers["X-N8N-API-Key"] = settings.N8N_API_KEY

    try:
        response = requests.post(
            settings.N8N_WEBHOOK_URL,
            json=payload,
            headers=headers,
            timeout=settings.N8N_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
    except requests.RequestException as exc:
        logger.error("Error al invocar workflow n8n", exc_info=exc)


def _percent(part: int, total: int) -> float:
    if not total:
        return 0.0
    return round((part / total) * 100, 1)


def get_dashboard_metrics() -> dict[str, Any]:
    today = timezone.now().date()
    horizon = today + timedelta(days=30)

    empresas_total = Empresa.objects.count()
    empresas_activas = Empresa.objects.filter(activo=True).count()
    empresas_con_contrato = (
        Empresa.objects.filter(activo=True, contratos__activo=True).distinct().count()
    )

    contratos_vigentes = (
        Contrato.objects.filter(activo=True)
        .filter(Q(vigencia_fin__isnull=True) | Q(vigencia_fin__gte=today))
        .count()
    )
    contratos_por_vencer = (
        Contrato.objects.filter(activo=True, vigencia_fin__gte=today, vigencia_fin__lte=horizon)
        .count()
    )
    contratos_vencidos = (
        Contrato.objects.filter(activo=True, vigencia_fin__lt=today).count()
    )

    pendientes_estatus = [
        Operacion.EstatusValidacion.PENDIENTE,
        Operacion.EstatusValidacion.EN_PROCESO,
    ]
    operaciones_pendientes = Operacion.objects.filter(
        estatus_validacion__in=pendientes_estatus
    ).count()
    operaciones_rechazadas = Operacion.objects.filter(
        estatus_validacion=Operacion.EstatusValidacion.RECHAZADO
    ).count()
    operaciones_validadas = Operacion.objects.filter(
        estatus_validacion=Operacion.EstatusValidacion.VALIDADO
    )
    operaciones_ultimos_30 = operaciones_validadas.filter(
        fecha_operacion__gte=today - timedelta(days=30)
    ).count()
    monto_validado = operaciones_validadas.filter(moneda="MXN").aggregate(total=Sum("monto"))[
        "total"
    ] or 0

    proveedores_total = Proveedor.objects.count()
    proveedores_sin_validar = Proveedor.objects.filter(
        Q(estatus_sat__isnull=True) | Q(estatus_sat="")
    ).count()
    proveedores_con_alerta = (
        Proveedor.objects.filter(
            operaciones__estatus_validacion=Operacion.EstatusValidacion.RECHAZADO
        )
        .distinct()
        .count()
    )

    insights: list[dict[str, Any]] = []
    if contratos_por_vencer:
        insights.append(
            {
                "id": "contratos_por_vencer",
                "title": "Contratos por vencer",
                "severity": "warning",
                "message": f"{contratos_por_vencer} contratos expiran en los próximos 30 días.",
            }
        )
    if operaciones_pendientes:
        insights.append(
            {
                "id": "operaciones_pendientes",
                "title": "Operaciones sin validar",
                "severity": "alert",
                "message": f"Hay {operaciones_pendientes} operaciones esperando validación fiscal.",
            }
        )
    cobertura_contractual = _percent(empresas_con_contrato, empresas_activas)
    if cobertura_contractual < 75 and empresas_activas:
        insights.append(
            {
                "id": "cobertura_contractual",
                "title": "Cobertura contractual baja",
                "severity": "alert",
                "message": "Menos del 75% de las empresas activas tienen contratos vigentes.",
            }
        )
    if proveedores_sin_validar:
        insights.append(
            {
                "id": "proveedores_sin_validar",
                "title": "Proveedores sin estatus SAT",
                "severity": "info",
                "message": f"{proveedores_sin_validar} proveedores no tienen validación SAT capturada.",
            }
        )

    return {
        "generated_at": timezone.now().isoformat(),
        "empresas": {
            "total": empresas_total,
            "activas": empresas_activas,
            "con_contrato": empresas_con_contrato,
            "cobertura_contractual": cobertura_contractual,
        },
        "contratos": {
            "vigentes": contratos_vigentes,
            "por_vencer_30": contratos_por_vencer,
            "vencidos": contratos_vencidos,
        },
        "operaciones": {
            "pendientes_validacion": operaciones_pendientes,
            "rechazadas": operaciones_rechazadas,
            "validadas_30d": operaciones_ultimos_30,
            "monto_validado_mxn": float(monto_validado),
        },
        "proveedores": {
            "total": proveedores_total,
            "observados": proveedores_con_alerta,
            "sin_validacion_sat": proveedores_sin_validar,
        },
        "insights": insights,
    }


def persist_dashboard_snapshot(tenant_slug: str | None = None) -> DashboardSnapshot:
    tenant = TenantContext.get_current_tenant()
    slug = tenant_slug or (tenant.slug if tenant else None)
    if not slug:
        raise ValueError("Se requiere un tenant activo para guardar el snapshot")

    metrics = get_dashboard_metrics()
    operaciones = metrics.get("operaciones", {})
    contratos = metrics.get("contratos", {})
    empresas = metrics.get("empresas", {})
    proveedores = metrics.get("proveedores", {})

    cobertura_value = Decimal(str(empresas.get("cobertura_contractual", 0) or 0)).quantize(
        TWO_DECIMAL, rounding=ROUND_HALF_UP
    )
    monto_validado_value = Decimal(str(operaciones.get("monto_validado_mxn", 0) or 0)).quantize(
        TWO_DECIMAL, rounding=ROUND_HALF_UP
    )

    snapshot = DashboardSnapshot.objects.create(
        tenant_slug=slug,
        payload=metrics,
        cobertura_contractual=cobertura_value,
        contratos_por_vencer_30=int(contratos.get("por_vencer_30", 0) or 0),
        operaciones_pendientes=int(operaciones.get("pendientes_validacion", 0) or 0),
        proveedores_sin_validacion_sat=int(proveedores.get("sin_validacion_sat", 0) or 0),
        monto_validado_mxn=monto_validado_value,
    )
    return snapshot


def _tokenize_query(text: str) -> list[str]:
    tokens = re.findall(r"[\wÁ-ÿ]{3,}", text or "", flags=re.IGNORECASE)
    return [token.strip() for token in tokens if token.strip()]


def _fetch_candidate_sources(
    *, query: str, ley: str | None, source_type: str | None, limit: int
) -> list[LegalReferenceSource]:
    limit = max(1, min(limit, 6))
    qs = LegalReferenceSource.objects.all()
    if ley:
        qs = qs.filter(ley__iexact=ley.strip())
    if source_type:
        qs = qs.filter(tipo_fuente=source_type)

    tokens = _tokenize_query(query)
    if tokens:
        text_filter = Q()
        for token in tokens:
            text_filter |= (
                Q(contenido__icontains=token)
                | Q(resumen__icontains=token)
                | Q(articulo__icontains=token)
                | Q(fraccion__icontains=token)
                | Q(parrafo__icontains=token)
            )
        qs = qs.filter(text_filter)
    elif query.strip():
        qs = qs.filter(contenido__icontains=query.strip())

    candidates = list(qs.order_by("ley", "articulo", "id")[:limit])
    if candidates:
        return candidates

    fallback_qs = LegalReferenceSource.objects.all()
    if ley:
        fallback_qs = fallback_qs.filter(ley__iexact=ley.strip())
    return list(fallback_qs.order_by("-created_at")[:limit])


def _reference_payload(source: LegalReferenceSource) -> dict[str, Any]:
    excerpt = re.sub(r"\s+", " ", source.contenido).strip()
    if len(excerpt) > 1000:
        excerpt = f"{excerpt[:1000].rstrip()}…"
    return {
        "id": source.id,
        "ley": source.ley,
        "tipo_fuente": source.tipo_fuente,
        "articulo": source.articulo,
        "fraccion": source.fraccion,
        "parrafo": source.parrafo,
        "resumen": source.resumen,
        "extracto": excerpt,
        "fuente_documento": source.fuente_documento,
        "fuente_url": source.fuente_url,
        "vigencia": source.vigencia,
        "sat_categoria": source.sat_categoria,
    }


def perform_legal_consultation(
    *,
    question: str,
    context: str | None,
    ley: str | None,
    source_type: str | None,
    max_refs: int,
    user,
) -> LegalConsultation:
    tenant = TenantContext.get_current_tenant()
    if not tenant:
        raise ValueError("Se requiere un tenant activo para consultar la biblioteca legal")

    references = _fetch_candidate_sources(
        query=question,
        ley=ley,
        source_type=source_type,
        limit=max_refs,
    )
    context_block = context.strip() if context else "Sin contexto operativo adicional"
    references_text: list[str] = []
    for idx, ref in enumerate(references, start=1):
        snippet = ref.contenido.strip()
        snippet = re.sub(r"\s+", " ", snippet)
        if len(snippet) > 900:
            snippet = f"{snippet[:900].rstrip()}…"
        label = ref.ley
        if ref.articulo:
            label += f" art. {ref.articulo}"
        if ref.fraccion:
            label += f" fr. {ref.fraccion}"
        if ref.parrafo:
            label += f" párr. {ref.parrafo}"
        references_text.append(f"[Ref {idx}] {label}\n{snippet}")

    if not references_text:
        references_text.append("No se encontraron referencias directas en la biblioteca.")

    system_prompt = (
        "Eres una asesora legal fiscal mexicana. Responde en español claro, sintetizando criterios "
        "aplicables y citando siempre las referencias disponibles como [Ref #]. Si la normativa "
        "no cubre la pregunta, indícalo y sugiere validar directamente la ley en cuestión."
    )
    user_prompt = (
        f"Pregunta: {question.strip()}\n"
        f"Contexto operativo: {context_block}\n\n"
        "Referencias disponibles:\n"
        + "\n\n".join(references_text)
    )

    answer_text = (
        "No fue posible generar un análisis automático. Revise manualmente las referencias compartidas."
    )
    model_name = ""

    try:
        client = OpenAIClient()
        answer_text = client.generate_text(
            [
                ChatMessage(role="system", content=system_prompt),
                ChatMessage(role="user", content=user_prompt),
            ],
            temperature=0.2,
            max_output_tokens=900,
        )
        model_name = client.model_name
    except (OpenAIClientError, Exception) as exc:  # pragma: no cover - fallback
        logger.warning("No se pudo invocar el asistente legal", exc_info=exc)

    payload = [_reference_payload(ref) for ref in references]
    consultation = LegalConsultation.objects.create(
        tenant_slug=tenant.slug,
        user=user if getattr(user, "is_authenticated", False) else None,
        question=question.strip(),
        context=context or "",
        answer=answer_text.strip(),
        references=payload,
        ai_model=model_name,
    )
    return consultation
