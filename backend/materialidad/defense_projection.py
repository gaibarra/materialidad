from __future__ import annotations

from datetime import timedelta
from decimal import Decimal, ROUND_HALF_UP
from typing import Any
from uuid import UUID, uuid4

from django.utils import timezone

from tenancy.context import TenantContext

from .fdi_engine import (
    build_internal_fdi_payload,
    FORMULA_VERSION,
    PIPELINE_VERSION,
    clamp_score,
    compute_fdi_confidence,
    compute_legacy_public_score,
)
from .models import EvidenciaMaterial, Operacion, OperationDefenseProjection, Proveedor

ONE_DECIMAL = Decimal("0.1")


def _window_bounds(days: int) -> tuple[timezone.datetime.date, timezone.datetime.date]:
    today = timezone.localdate()
    start_date = today - timedelta(days=max(days - 1, 0))
    return start_date, today


def _projection_queryset_for_window(
    *,
    tenant_slug: str,
    days: int,
    empresa_id: int | None = None,
    correlation_id: UUID | str | None = None,
    captured_at=None,
):
    start_date, end_date = _window_bounds(days)
    queryset = OperationDefenseProjection.objects.filter(
        tenant_slug=tenant_slug,
        operacion__fecha_operacion__gte=start_date,
        operacion__fecha_operacion__lte=end_date,
    )
    if empresa_id is not None:
        queryset = queryset.filter(empresa_id=empresa_id)
    if correlation_id is not None:
        queryset = queryset.filter(correlation_id=correlation_id)
    if captured_at is not None:
        queryset = queryset.filter(captured_at=captured_at)
    return queryset


def _quantize_score(value: float) -> Decimal:
    return Decimal(str(clamp_score(value))).quantize(ONE_DECIMAL, rounding=ROUND_HALF_UP)


def _checklist_completion_score(checklists_resumen: list[dict[str, Any]]) -> float:
    if not checklists_resumen:
        return 60.0

    total = sum(float(item.get("progreso_porcentaje", 0.0) or 0.0) for item in checklists_resumen)
    return clamp_score(total / len(checklists_resumen))


def _freshness_quality(operacion: Operacion) -> float:
    timestamps = [
        operacion.updated_at,
        operacion.ultima_validacion,
        operacion.ultima_validacion_cfdi,
        operacion.ultima_validacion_spei,
        getattr(operacion.proveedor, "ultima_validacion_sat", None),
        getattr(operacion.contrato, "updated_at", None),
    ]
    latest = max((item for item in timestamps if item is not None), default=None)
    if latest is None:
        return 40.0

    age = timezone.now() - latest
    if age <= timedelta(days=30):
        return 100.0
    if age <= timedelta(days=90):
        return 85.0
    if age <= timedelta(days=180):
        return 70.0
    if age <= timedelta(days=365):
        return 55.0
    return 40.0


def _input_integrity(operacion: Operacion) -> float:
    score = 100.0
    monto = operacion.monto
    if monto is not None and not isinstance(monto, Decimal):
        monto = Decimal(str(monto))

    if not operacion.empresa_id:
        score -= 35.0
    if not operacion.proveedor_id:
        score -= 35.0
    if monto is None or monto <= 0:
        score -= 20.0
    if not operacion.fecha_operacion:
        score -= 15.0
    if not operacion.tipo_operacion:
        score -= 15.0
    if not isinstance(operacion.metadata, dict):
        score -= 10.0
    if operacion.contrato_id is None:
        score -= 5.0
    return clamp_score(score)


def _completeness_quality(faltantes: list[str]) -> float:
    critical_missing = sum(
        1
        for faltante in faltantes
        if "Checklist operativo" not in faltante
        and any(
            marker in faltante
            for marker in (
                "Contrato asociado",
                "UUID CFDI",
                "Soporte de forma de pago",
                "Razón de negocio",
            )
        )
    )
    non_critical_missing = max(len(faltantes) - critical_missing, 0)
    return clamp_score(100 - (critical_missing * 24) - (non_critical_missing * 12))


def _documentary_score(operacion: Operacion, faltantes: list[str]) -> float:
    critical_missing = sum(
        1
        for faltante in faltantes
        if any(
            marker in faltante
            for marker in (
                "Contrato asociado",
                "UUID CFDI",
                "Soporte de forma de pago",
                "Razón de negocio",
            )
        )
    )
    non_critical_missing = max(len(faltantes) - critical_missing, 0)
    score = 100 - (critical_missing * 26) - (non_critical_missing * 15)

    if operacion.cfdi_estatus == Operacion.EstatusCFDI.PENDIENTE:
        score -= 18
    elif operacion.cfdi_estatus == Operacion.EstatusCFDI.INVALIDO:
        score -= 32

    if operacion.spei_estatus == Operacion.EstatusSPEI.PENDIENTE:
        score -= 12
    elif operacion.spei_estatus == Operacion.EstatusSPEI.NO_ENCONTRADO:
        score -= 20

    if operacion.estatus_validacion == Operacion.EstatusValidacion.EN_PROCESO:
        score -= 16
    elif operacion.estatus_validacion == Operacion.EstatusValidacion.PENDIENTE:
        score -= 22
    elif operacion.estatus_validacion == Operacion.EstatusValidacion.RECHAZADO:
        score -= 35

    return clamp_score(score)


def _substance_score(*, operacion: Operacion, perfil: str, evidencia_tipos: set[str]) -> float:
    score = 100.0
    metadata = operacion.metadata if isinstance(operacion.metadata, dict) else {}

    if perfil == "PARTES_RELACIONADAS" and not metadata.get("razon_negocio"):
        score -= 35.0
    if perfil == "SERVICIOS":
        if EvidenciaMaterial.Tipo.ENTREGABLE not in evidencia_tipos:
            score -= 30.0
        if EvidenciaMaterial.Tipo.BITACORA not in evidencia_tipos and EvidenciaMaterial.Tipo.COMUNICACION not in evidencia_tipos:
            score -= 20.0
    elif perfil == "COMPRAS":
        if EvidenciaMaterial.Tipo.ENTREGABLE not in evidencia_tipos and EvidenciaMaterial.Tipo.FOTOGRAFIA not in evidencia_tipos:
            score -= 30.0

    contrato = operacion.contrato
    if contrato and contrato.razon_negocio_estado != "APROBADO":
        score -= 20.0

    if operacion.estatus_validacion == Operacion.EstatusValidacion.EN_PROCESO:
        score -= 30.0
    elif operacion.estatus_validacion == Operacion.EstatusValidacion.PENDIENTE:
        score -= 40.0
    elif operacion.estatus_validacion == Operacion.EstatusValidacion.RECHAZADO:
        score -= 50.0

    if operacion.cfdi_estatus != Operacion.EstatusCFDI.VALIDO:
        score -= 10.0
    if operacion.spei_estatus != Operacion.EstatusSPEI.VALIDADO:
        score -= 10.0

    return clamp_score(score)


def _contractual_score(operacion: Operacion) -> float:
    contrato = operacion.contrato
    if not contrato:
        return 15.0

    score = 40.0
    today = timezone.localdate()
    if contrato.vigencia_inicio and contrato.vigencia_fin and contrato.vigencia_inicio <= today <= contrato.vigencia_fin:
        score += 30.0
    if not contrato.fecha_cierta_requerida or contrato.fecha_cierta_obtenida:
        score += 15.0
    if contrato.razon_negocio_estado == "APROBADO":
        score += 15.0
    elif contrato.razon_negocio_estado == "PENDIENTE":
        score -= 5.0
    elif contrato.razon_negocio_estado == "RECHAZADO":
        score -= 15.0

    if operacion.estatus_validacion == Operacion.EstatusValidacion.RECHAZADO:
        score -= 10.0
    return clamp_score(score)


def _exposure_score(operacion: Operacion) -> tuple[float, list[str]]:
    proveedor = operacion.proveedor
    score = 0.0
    flags: list[str] = []

    if proveedor.riesgo_fiscal == Proveedor.Riesgo.MEDIO:
        score += 25.0
        flags.append("proveedor_riesgo_medio")
    elif proveedor.riesgo_fiscal == Proveedor.Riesgo.ALTO:
        score += 50.0
        flags.append("proveedor_riesgo_alto")

    if proveedor.estatus_69b == Proveedor.Estatus69B.PRESUNTO:
        score += 25.0
        flags.append("proveedor_69b_presunto")
    elif proveedor.estatus_69b == Proveedor.Estatus69B.DEFINITIVO:
        score += 45.0
        flags.append("proveedor_69b_definitivo")

    ultima_validacion_sat = proveedor.ultima_validacion_sat
    if ultima_validacion_sat is None:
        score += 15.0
        flags.append("sat_sin_validacion")
    elif timezone.now() - ultima_validacion_sat > timedelta(days=90):
        score += 10.0
        flags.append("sat_validacion_desactualizada")

    if operacion.estatus_validacion == Operacion.EstatusValidacion.RECHAZADO:
        score += 10.0
        flags.append("operacion_rechazada")

    return clamp_score(score), flags


def _operational_score(operacion: Operacion, checklists_resumen: list[dict[str, Any]]) -> float:
    status_score = {
        Operacion.EstatusValidacion.VALIDADO: 100.0,
        Operacion.EstatusValidacion.EN_PROCESO: 65.0,
        Operacion.EstatusValidacion.PENDIENTE: 40.0,
        Operacion.EstatusValidacion.RECHAZADO: 10.0,
    }.get(operacion.estatus_validacion, 40.0)

    provider_validation_score = 25.0
    ultima_validacion_sat = operacion.proveedor.ultima_validacion_sat
    if ultima_validacion_sat is not None:
        age = timezone.now() - ultima_validacion_sat
        if age <= timedelta(days=30):
            provider_validation_score = 100.0
        elif age <= timedelta(days=90):
            provider_validation_score = 80.0
        elif age <= timedelta(days=180):
            provider_validation_score = 60.0
        else:
            provider_validation_score = 40.0

    checklist_score = _checklist_completion_score(checklists_resumen)
    return clamp_score((0.40 * status_score) + (0.30 * provider_validation_score) + (0.30 * checklist_score))


def sync_operation_defense_projection(
    *,
    operacion: Operacion,
    correlation_id: UUID | str | None = None,
    tenant_slug: str | None = None,
    captured_at=None,
) -> OperationDefenseProjection:
    from .services import get_operacion_checklists_resumen, get_operacion_faltantes_expediente

    tenant = TenantContext.get_current_tenant()
    resolved_tenant_slug = tenant_slug or (tenant.slug if tenant else "global")
    resolved_captured_at = captured_at or timezone.now()
    resolved_correlation_id = correlation_id or uuid4()

    perfil, faltantes = get_operacion_faltantes_expediente(operacion)
    checklists_resumen = get_operacion_checklists_resumen(operacion)
    evidencia_tipos = set(operacion.evidencias.values_list("tipo", flat=True))

    dm = _documentary_score(operacion, faltantes)
    se = _substance_score(operacion=operacion, perfil=perfil, evidencia_tipos=evidencia_tipos)
    sc = _contractual_score(operacion)
    ec, risk_flags = _exposure_score(operacion)
    do = _operational_score(operacion, checklists_resumen)

    input_integrity = _input_integrity(operacion)
    completeness_quality = _completeness_quality(faltantes)
    freshness_quality = _freshness_quality(operacion)
    included_in_fdi = input_integrity >= 60.0 and completeness_quality >= 40.0

    confidence = compute_fdi_confidence(
        universe_coverage=100.0 if included_in_fdi else 35.0,
        completeness_quality=completeness_quality,
        freshness_quality=freshness_quality,
        input_integrity=input_integrity,
    )["score"]
    score_base = compute_legacy_public_score(dm=dm, se=se, sc=sc, ec=ec, do=do, has_universe=True)

    projection, _ = OperationDefenseProjection.objects.update_or_create(
        operacion=operacion,
        defaults={
            "tenant_slug": resolved_tenant_slug,
            "empresa": operacion.empresa,
            "proveedor": operacion.proveedor,
            "formula_version": FORMULA_VERSION,
            "pipeline_version": PIPELINE_VERSION,
            "correlation_id": resolved_correlation_id,
            "profile": perfil,
            "included_in_fdi": included_in_fdi,
            "score_base": _quantize_score(score_base),
            "confidence_score": _quantize_score(confidence),
            "dm": _quantize_score(dm),
            "se": _quantize_score(se),
            "sc": _quantize_score(sc),
            "ec": _quantize_score(ec),
            "do": _quantize_score(do),
            "input_integrity": _quantize_score(input_integrity),
            "completeness_quality": _quantize_score(completeness_quality),
            "freshness_quality": _quantize_score(freshness_quality),
            "risk_flags_json": risk_flags,
            "inputs_json": {
                "faltantes": faltantes,
                "checklists_resumen": checklists_resumen,
                "evidencia_tipos": sorted(evidencia_tipos),
                "cfdi_estatus": operacion.cfdi_estatus,
                "spei_estatus": operacion.spei_estatus,
                "contract_category": operacion.contrato.categoria if operacion.contrato_id else None,
                "contract_razon_estado": operacion.contrato.razon_negocio_estado if operacion.contrato_id else None,
                "provider_riesgo_fiscal": operacion.proveedor.riesgo_fiscal,
                "provider_estatus_69b": operacion.proveedor.estatus_69b,
            },
            "captured_at": resolved_captured_at,
        },
    )
    return projection


def sync_operation_defense_projections_for_window(
    *,
    days: int = 90,
    empresa_id: int | None = None,
    tenant_slug: str | None = None,
    correlation_id: UUID | str | None = None,
    captured_at=None,
) -> list[OperationDefenseProjection]:
    start_date, today = _window_bounds(days)
    queryset = Operacion.objects.select_related("empresa", "proveedor", "contrato").prefetch_related(
        "evidencias",
        "checklists_operativos__items",
    ).filter(
        fecha_operacion__gte=start_date,
        fecha_operacion__lte=today,
    )
    if empresa_id is not None:
        queryset = queryset.filter(empresa_id=empresa_id)

    resolved_correlation_id = correlation_id or uuid4()
    resolved_captured_at = captured_at or timezone.now()
    return [
        sync_operation_defense_projection(
            operacion=operacion,
            correlation_id=resolved_correlation_id,
            tenant_slug=tenant_slug,
            captured_at=resolved_captured_at,
        )
        for operacion in queryset.order_by("id")
    ]


def calculate_fiscal_defense_index_from_projections(
    *,
    days: int = 90,
    empresa_id: int | None = None,
    tenant_slug: str | None = None,
    refresh: bool = False,
) -> dict[str, Any]:
    tenant = TenantContext.get_current_tenant()
    resolved_tenant_slug = tenant_slug or (tenant.slug if tenant else "global")
    captured_at = timezone.now()
    correlation_id = uuid4()

    if refresh:
        sync_operation_defense_projections_for_window(
            days=days,
            empresa_id=empresa_id,
            tenant_slug=resolved_tenant_slug,
            correlation_id=correlation_id,
            captured_at=captured_at,
        )

    queryset = _projection_queryset_for_window(
        tenant_slug=resolved_tenant_slug,
        days=days,
        empresa_id=empresa_id,
        correlation_id=correlation_id if refresh else None,
        captured_at=captured_at if refresh else None,
    )

    projections = list(queryset.order_by("operacion_id"))
    included = [projection for projection in projections if projection.included_in_fdi]
    period_start, today = _window_bounds(days)
    has_universe = len(included) > 0

    def _avg(values: list[float]) -> float:
        if not values:
            return 0.0
        return clamp_score(sum(values) / len(values))

    target = included if included else projections
    correlation_ids = {str(projection.correlation_id) for projection in target if projection.correlation_id}
    trace_correlation_id = next(iter(correlation_ids)) if len(correlation_ids) == 1 else None
    breakdown = {
        "DM": _avg([float(projection.dm) for projection in target]),
        "SE": _avg([float(projection.se) for projection in target]),
        "SC": _avg([float(projection.sc) for projection in target]),
        "EC": _avg([float(projection.ec) for projection in target]),
        "DO": _avg([float(projection.do) for projection in target]),
    }
    inputs = {
        "total_operaciones": len(projections),
        "operaciones_en_universo": len(included),
        "operaciones_fuera_universo": max(len(projections) - len(included), 0),
        "avg_confidence_score": _avg([float(projection.confidence_score) for projection in target]),
        "avg_input_integrity": _avg([float(projection.input_integrity) for projection in target]),
        "avg_completeness_quality": _avg([float(projection.completeness_quality) for projection in target]),
        "avg_freshness_quality": _avg([float(projection.freshness_quality) for projection in target]),
        "high_risk_flags": sum(1 for projection in target if "proveedor_riesgo_alto" in (projection.risk_flags_json or [])),
        "high_69b_flags": sum(1 for projection in target if any(flag in (projection.risk_flags_json or []) for flag in ("proveedor_69b_presunto", "proveedor_69b_definitivo"))),
        "projection_groups": len(correlation_ids),
    }
    score = compute_legacy_public_score(
        dm=breakdown["DM"],
        se=breakdown["SE"],
        sc=breakdown["SC"],
        ec=breakdown["EC"],
        do=breakdown["DO"],
        has_universe=has_universe,
    )
    actions = [
        {
            "priority": "info" if has_universe else "warning",
            "title": "Universo técnico sincronizado",
            "description": f"{len(included)} operaciones incluidas de {len(projections)} proyectadas para el periodo.",
        }
    ]
    if has_universe and inputs["avg_confidence_score"] < 70:
        actions.append(
            {
                "priority": "high",
                "title": "Elevar confianza del universo",
                "description": "Completar faltantes estructurales y refrescar validaciones SAT para robustecer el snapshot oficial.",
            }
        )

    payload = build_internal_fdi_payload(
        generated_at=captured_at.isoformat(),
        days=days,
        period_from=period_start.isoformat(),
        period_to=today.isoformat(),
        empresa_id=empresa_id,
        has_universe=has_universe,
        breakdown=breakdown,
        inputs=inputs,
        actions=actions,
        confidence_score=inputs["avg_confidence_score"],
        trace={
            "correlation_id": trace_correlation_id,
            "formula_version": FORMULA_VERSION,
            "pipeline_version": PIPELINE_VERSION,
            "source": "operation_defense_projection",
        },
    )
    payload["meta"]["source"] = "operation_defense_projection"
    payload["meta"]["projection_correlation_id"] = trace_correlation_id
    return payload