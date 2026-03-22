from __future__ import annotations

import hashlib
import json
import logging
from datetime import date, datetime, timedelta
from decimal import Decimal, ROUND_HALF_UP
import re
from typing import Any
from uuid import UUID

import requests
from django.conf import settings
from django.db import DatabaseError
from django.db.models import Q, Sum, Count
from django.utils import timezone

from tenancy.context import TenantContext

from .ai.client import ChatMessage, get_ai_client, OpenAIClientError
from .fdi_engine import (
    build_internal_fdi_payload,
    clamp_score,
    export_public_fdi_payload,
    fdi_actions,
    legacy_fdi_level,
    percent,
)
from .legal_corpus import build_hashed_embedding, cosine_similarity
from .models import (
    AlertaOperacion,
    ChecklistItem,
    Contrato,
    DashboardSnapshot,
    EvidenciaMaterial,
    Empresa,
    FDIJobRun,
    LegalConsultation,
    LegalReferenceSource,
    Operacion,
    OperationDefenseProjection,
    Proveedor,
    FiscalDefenseIndexSnapshot,
    FiscalDefenseIndexNarrative,
    RazonNegocioAprobacion,
)

TWO_DECIMAL = Decimal("0.01")
ONE_DECIMAL = Decimal("0.1")

logger = logging.getLogger(__name__)


CRITICAL_FALTANTE_MARKERS = (
    "Contrato asociado",
    "UUID CFDI",
    "Soporte de forma de pago",
    "Razón de negocio",
    "Checklist operativo",
)


def _get_operacion_checklists(operacion: Operacion) -> list:
    checklists = getattr(operacion, "checklists_operativos_prefetched", None)
    if checklists is None:
        checklists = operacion.checklists_operativos.prefetch_related("items").all()
    return list(checklists)


def get_operacion_checklists_resumen(operacion: Operacion) -> list[dict[str, Any]]:
    resumen: list[dict[str, Any]] = []

    for checklist in _get_operacion_checklists(operacion):
        items_attr = getattr(checklist, "items", None)
        items = list(items_attr.all()) if hasattr(items_attr, "all") else list(items_attr or [])
        total = len(items)
        completos = sum(1 for item in items if item.estado == ChecklistItem.Estado.COMPLETO)
        requeridos_pendientes = sum(
            1
            for item in items
            if item.requerido and item.estado != ChecklistItem.Estado.COMPLETO
        )
        resumen.append(
            {
                "id": checklist.id,
                "nombre": checklist.nombre,
                "tipo_gasto": checklist.tipo_gasto,
                "estado_general": checklist.estado_general,
                "progreso_porcentaje": checklist.progreso_porcentaje,
                "total_items": total,
                "completos": completos,
                "pendientes": max(total - completos, 0),
                "requeridos_pendientes": requeridos_pendientes,
            }
        )

    return resumen


def get_operacion_checklist_faltantes(operacion: Operacion) -> list[str]:
    faltantes: list[str] = []

    for checklist in _get_operacion_checklists(operacion):
        items_attr = getattr(checklist, "items", None)
        items = list(items_attr.all()) if hasattr(items_attr, "all") else list(items_attr or [])
        pendientes_requeridos = [
            item.titulo
            for item in items
            if item.requerido and item.estado != ChecklistItem.Estado.COMPLETO
        ]
        if not pendientes_requeridos:
            continue

        muestra = ", ".join(pendientes_requeridos[:2])
        if len(pendientes_requeridos) > 2:
            muestra = f"{muestra} y {len(pendientes_requeridos) - 2} más"

        detalle = f": {muestra}" if muestra else ""
        faltantes.append(
            f"Checklist operativo incompleto: {checklist.nombre} "
            f"({len(pendientes_requeridos)} requeridos pendientes{detalle})"
        )

    return faltantes


def get_operacion_faltantes_expediente(operacion: Operacion) -> tuple[str, list[str]]:
    perfil, faltantes = get_operacion_faltantes_materialidad(operacion)
    return perfil, [*faltantes, *get_operacion_checklist_faltantes(operacion)]


def get_operacion_perfil_validacion(operacion: Operacion) -> str:
    if operacion.contrato and operacion.contrato.categoria == Contrato.Categoria.PARTES_RELACIONADAS:
        return "PARTES_RELACIONADAS"
    if operacion.tipo_operacion == Operacion.TipoOperacion.SERVICIO:
        return "SERVICIOS"
    if operacion.tipo_operacion == Operacion.TipoOperacion.COMPRA:
        return "COMPRAS"
    return "GENERAL"


def operacion_forma_pago_documentada(operacion: Operacion) -> bool:
    if operacion.referencia_spei:
        return True
    metadata = operacion.metadata if isinstance(operacion.metadata, dict) else {}
    return bool(metadata.get("forma_pago") or metadata.get("soporte_pago"))


def get_operacion_faltantes_materialidad(operacion: Operacion) -> tuple[str, list[str]]:
    faltantes: list[str] = []
    perfil = get_operacion_perfil_validacion(operacion)
    evidencias = list(operacion.evidencias.all())
    evidencia_tipos = {e.tipo for e in evidencias}

    if not operacion.contrato_id:
        faltantes.append("Contrato asociado a la operación")

    if not operacion.uuid_cfdi:
        faltantes.append("UUID CFDI")

    if not operacion_forma_pago_documentada(operacion):
        faltantes.append("Soporte de forma de pago (SPEI o metadata.forma_pago/soporte_pago)")

    if perfil == "SERVICIOS":
        if EvidenciaMaterial.Tipo.ENTREGABLE not in evidencia_tipos:
            faltantes.append("Evidencia de prestación (tipo ENTREGABLE)")
        if (
            EvidenciaMaterial.Tipo.BITACORA not in evidencia_tipos
            and EvidenciaMaterial.Tipo.COMUNICACION not in evidencia_tipos
        ):
            faltantes.append("Bitácora o comunicación de seguimiento (tipo BITACORA/COMUNICACION)")

    elif perfil == "COMPRAS":
        if (
            EvidenciaMaterial.Tipo.ENTREGABLE not in evidencia_tipos
            and EvidenciaMaterial.Tipo.FOTOGRAFIA not in evidencia_tipos
        ):
            faltantes.append("Recepción material del bien (tipo ENTREGABLE/FOTOGRAFIA)")

    elif perfil == "PARTES_RELACIONADAS":
        metadata = operacion.metadata if isinstance(operacion.metadata, dict) else {}
        if not metadata.get("razon_negocio"):
            faltantes.append("Razón de negocio documentada en metadata.razon_negocio")
        if EvidenciaMaterial.Tipo.ENTREGABLE not in evidencia_tipos:
            faltantes.append("Evidencia principal de operación entre partes relacionadas (tipo ENTREGABLE)")

    return perfil, faltantes


def get_operacion_riesgo_materialidad(operacion: Operacion) -> dict[str, Any]:
    perfil, faltantes = get_operacion_faltantes_expediente(operacion)
    score = 0
    motivos: list[str] = []

    for faltante in faltantes:
        score += 10
        motivos.append(f"Faltante documental: {faltante}")
        if any(marker in faltante for marker in CRITICAL_FALTANTE_MARKERS):
            score += 15

    proveedor = operacion.proveedor
    if getattr(proveedor, "riesgo_fiscal", None) == Proveedor.Riesgo.MEDIO:
        score += 20
        motivos.append("Proveedor con riesgo fiscal medio")
    elif getattr(proveedor, "riesgo_fiscal", None) == Proveedor.Riesgo.ALTO:
        score += 35
        motivos.append("Proveedor con riesgo fiscal alto")

    estatus_69b = getattr(proveedor, "estatus_69b", Proveedor.Estatus69B.SIN_COINCIDENCIA)
    if estatus_69b == Proveedor.Estatus69B.PRESUNTO:
        score += 25
        motivos.append("Proveedor en estatus 69-B presunto")
    elif estatus_69b == Proveedor.Estatus69B.DEFINITIVO:
        score += 35
        motivos.append("Proveedor en estatus 69-B definitivo")

    score = min(score, 100)
    if score >= 70:
        nivel = "ALTO"
    elif score >= 20:
        nivel = "MEDIO"
    else:
        nivel = "BAJO"

    return {
        "nivel": nivel,
        "score": score,
        "motivos": motivos,
        "perfil_validacion": perfil,
        "faltantes_count": len(faltantes),
        "updated_at": timezone.now().isoformat(),
    }


def _get_faltantes_criticos(faltantes: list[str]) -> list[str]:
    return [
        faltante
        for faltante in faltantes
        if any(marker in faltante for marker in CRITICAL_FALTANTE_MARKERS)
    ]


def create_or_get_alerta_operacion_faltantes(
    *,
    operacion: Operacion,
    perfil_validacion: str,
    faltantes: list[str],
    owner_email: str,
) -> AlertaOperacion | None:
    faltantes_criticos = _get_faltantes_criticos(faltantes)
    if not faltantes_criticos:
        return None

    dedupe_seed = f"{operacion.id}|{perfil_validacion}|{'|'.join(sorted(faltantes_criticos))}"
    dedupe_key = hashlib.sha256(dedupe_seed.encode("utf-8")).hexdigest()

    alerta = AlertaOperacion.objects.filter(
        clave_dedupe=dedupe_key,
        estatus=AlertaOperacion.Estatus.ACTIVA,
    ).first()
    if alerta:
        detalle = {
            "perfil_validacion": perfil_validacion,
            "faltantes": faltantes,
            "faltantes_criticos": faltantes_criticos,
        }
        changes: list[str] = []
        if alerta.owner_email != (owner_email or ""):
            alerta.owner_email = owner_email or ""
            changes.append("owner_email")
        if alerta.detalle != detalle:
            alerta.detalle = detalle
            changes.append("detalle")
        if changes:
            alerta.save(update_fields=[*changes, "updated_at"])
        return alerta

    return AlertaOperacion.objects.create(
        operacion=operacion,
        empresa=operacion.empresa,
        proveedor=operacion.proveedor,
        tipo_alerta=AlertaOperacion.TipoAlerta.FALTANTES_CRITICOS,
        estatus=AlertaOperacion.Estatus.ACTIVA,
        clave_dedupe=dedupe_key,
        owner_email=owner_email or "",
        motivo="Intento de VALIDADO bloqueado por faltantes críticos de expediente.",
        detalle={
            "perfil_validacion": perfil_validacion,
            "faltantes": faltantes,
            "faltantes_criticos": faltantes_criticos,
        },
        fecha_alerta=timezone.now(),
    )


def sync_operacion_materialidad(
    *,
    operacion: Operacion,
    owner_email: str = "",
    sync_alertas: bool = False,
) -> dict[str, Any]:
    perfil_validacion, faltantes_expediente = get_operacion_faltantes_expediente(operacion)
    riesgo = get_operacion_riesgo_materialidad(operacion)

    metadata = dict(operacion.metadata or {})
    metadata["riesgo_materialidad"] = riesgo
    operacion.metadata = metadata
    operacion.save(update_fields=["metadata", "updated_at"])

    alerta = None
    alertas_qs = AlertaOperacion.objects.filter(
        operacion=operacion,
        tipo_alerta=AlertaOperacion.TipoAlerta.FALTANTES_CRITICOS,
        estatus=AlertaOperacion.Estatus.ACTIVA,
    )

    if sync_alertas:
        if _get_faltantes_criticos(faltantes_expediente):
            alerta = create_or_get_alerta_operacion_faltantes(
                operacion=operacion,
                perfil_validacion=perfil_validacion,
                faltantes=faltantes_expediente,
                owner_email=owner_email,
            )
            if alerta:
                alertas_qs.exclude(id=alerta.id).update(
                    estatus=AlertaOperacion.Estatus.CERRADA,
                    fecha_cierre=timezone.now(),
                )
        else:
            alertas_qs.update(
                estatus=AlertaOperacion.Estatus.CERRADA,
                fecha_cierre=timezone.now(),
            )

    return {
        "perfil_validacion": perfil_validacion,
        "faltantes": faltantes_expediente,
        "riesgo": riesgo,
        "alerta": alerta,
        "checklists_resumen": get_operacion_checklists_resumen(operacion),
    }


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
    return percent(part, total)


def _clamp(value: float, min_value: float = 0.0, max_value: float = 100.0) -> float:
    return clamp_score(value, min_value=min_value, max_value=max_value)


def _fdi_level(score: float, *, has_universe: bool) -> str:
    return legacy_fdi_level(score, has_universe=has_universe)


def _fdi_actions(*, score: float, dm: float, se: float, sc: float, ec: float, do: float, has_universe: bool) -> list[dict[str, str]]:
    return fdi_actions(score=score, dm=dm, se=se, sc=sc, ec=ec, do=do, has_universe=has_universe)


def _extract_json_payload(raw_text: str) -> dict[str, Any]:
    text = (raw_text or "").strip()
    if not text:
        raise ValueError("AI response is empty")

    if text.startswith("```"):
        text = re.sub(r"^```[a-zA-Z]*\n", "", text)
        text = re.sub(r"\n```$", "", text)

    return json.loads(text)


def _generate_fdi_narrative_fallback(*, audience: str, fdi_payload: dict[str, Any]) -> dict[str, Any]:
    score = float(fdi_payload.get("score", 0.0) or 0.0)
    level = str(fdi_payload.get("level", "NO_DATA"))
    breakdown = fdi_payload.get("breakdown", {})
    inputs = fdi_payload.get("inputs", {})
    actions = fdi_payload.get("actions", [])

    top_driver = max(("DM", "SE", "SC", "DO"), key=lambda key: float(breakdown.get(key, 0.0) or 0.0))
    pressure_driver = "EC"
    top_action = actions[0]["title"] if actions else "Monitoreo continuo"

    templates = {
        "RECTOR": {
            "headline": f"FDI {score}: postura {level} para decision institucional",
            "summary": (
                f"La lectura consolidada ubica el FDI en {score} ({level}). "
                f"La fortaleza principal proviene de {top_driver}, mientras {pressure_driver} concentra la presion que exige gobierno inmediato."
            ),
        },
        "CFO": {
            "headline": f"FDI {score}: defendibilidad fiscal y continuidad financiera",
            "summary": (
                f"El FDI actual ({score}, {level}) resume capacidad de defensa y exposicion operativa. "
                f"{top_driver} sostiene estabilidad; {pressure_driver} determina la prioridad de contencion de contingencia."
            ),
        },
        "DESPACHO": {
            "headline": f"FDI {score}: agenda de defensa para portafolio cliente",
            "summary": (
                f"El indice de defensa fiscal se ubica en {score} ({level}). "
                f"La palanca dominante es {top_driver}; la presion documental y de riesgo se concentra en {pressure_driver}."
            ),
        },
    }

    selected = templates[audience]
    evidence_points = [
        f"DM {breakdown.get('DM', 0)} | SE {breakdown.get('SE', 0)} | SC {breakdown.get('SC', 0)} | EC {breakdown.get('EC', 0)} | DO {breakdown.get('DO', 0)}",
        f"Operaciones {inputs.get('total_operaciones', 0)} | Validadas {inputs.get('operaciones_validadas', 0)} | Alertas criticas {inputs.get('alertas_criticas', 0)}",
        f"Cobertura documental {inputs.get('cobertura_documental_pct', 0)}% | CSD risk {inputs.get('csd_risk_score', 0)}%",
    ]

    priority_actions = [a.get("title", "") for a in actions if a.get("title")][:3]
    if not priority_actions:
        priority_actions = [top_action]

    return {
        "audience": audience,
        "headline": selected["headline"],
        "executive_summary": selected["summary"],
        "evidence_points": evidence_points,
        "priority_actions": priority_actions,
        "generated_at": timezone.now().isoformat(),
        "source": "fallback",
    }


def _build_fdi_legacy_comparison(*, current_payload: dict[str, Any], legacy_payload: dict[str, Any]) -> dict[str, Any]:
    current_score = float(current_payload.get("score", 0.0) or 0.0)
    legacy_score = float(legacy_payload.get("score", 0.0) or 0.0)
    return {
        "legacy_score": legacy_score,
        "legacy_level": str(legacy_payload.get("level", "NO_DATA") or "NO_DATA"),
        "score_delta": round(current_score - legacy_score, 1),
        "level_match": str(current_payload.get("level", "NO_DATA") or "NO_DATA")
        == str(legacy_payload.get("level", "NO_DATA") or "NO_DATA"),
    }


def _calculate_legacy_fdi_internal(*, days: int = 90, empresa_id: int | None = None) -> dict[str, Any]:
    days = max(7, min(days, 365))
    now = timezone.now()
    today = timezone.localdate()
    horizon = today + timedelta(days=30)

    cobertura = get_dashboard_cobertura_p0(days=days, empresa_id=empresa_id)
    total_ops = int(cobertura.get("coverage", {}).get("total_operaciones", 0) or 0)
    has_universe = total_ops > 0

    operaciones_qs = Operacion.objects.all()
    contratos_qs = Contrato.objects.filter(activo=True)
    if empresa_id:
        operaciones_qs = operaciones_qs.filter(empresa_id=empresa_id)
        contratos_qs = contratos_qs.filter(empresa_id=empresa_id)

    proveedores_qs = Proveedor.objects.filter(operaciones__in=operaciones_qs).distinct()

    validated_ops = operaciones_qs.filter(estatus_validacion=Operacion.EstatusValidacion.VALIDADO).count()
    validated_pct = _percent(validated_ops, total_ops)
    cobertura_documental_pct = float(cobertura.get("coverage", {}).get("cobertura_documental_pct", 0.0) or 0.0)
    alertas_criticas = int(cobertura.get("alertas", {}).get("por_tipo", {}).get(AlertaOperacion.TipoAlerta.FALTANTES_CRITICOS, 0) or 0)
    operaciones_sin_faltantes_criticos_pct = _percent(max(total_ops - alertas_criticas, 0), total_ops)

    total_contratos = contratos_qs.count()
    contratos_razon_aprobada = contratos_qs.filter(razon_negocio_estado="APROBADO").count()
    pct_contratos_razon_negocio_aprobada = _percent(contratos_razon_aprobada, total_contratos)

    operaciones_con_evidencia_validada = (
        operaciones_qs.filter(evidencias__estatus_revision=EvidenciaMaterial.EstatusRevision.VALIDADA)
        .distinct()
        .count()
    )
    pct_operaciones_con_evidencia_validada = _percent(operaciones_con_evidencia_validada, total_ops)

    contratos_workflow_completo = (
        RazonNegocioAprobacion.objects.filter(
            contrato__in=contratos_qs,
            estado=RazonNegocioAprobacion.Estado.APROBADO,
        )
        .values("contrato_id")
        .annotate(roles=Count("rol", distinct=True))
        .filter(roles=5)
        .count()
    )
    pct_aprobaciones_workflow_completas = _percent(contratos_workflow_completo, total_contratos)

    contratos_vigentes = contratos_qs.filter(
        vigencia_inicio__isnull=False,
        vigencia_fin__isnull=False,
        vigencia_inicio__lte=today,
        vigencia_fin__gte=today,
    ).count()
    pct_contratos_vigentes = _percent(contratos_vigentes, total_contratos)

    contratos_fecha_cierta = contratos_qs.filter(fecha_cierta_obtenida=True).count()
    pct_contratos_con_fecha_cierta = _percent(contratos_fecha_cierta, total_contratos)

    cobertura_contractual = _percent(contratos_vigentes, max(total_contratos, 1))

    proveedores_total = proveedores_qs.count()
    proveedores_riesgo_alto = proveedores_qs.filter(riesgo_fiscal=Proveedor.Riesgo.ALTO).count()
    pct_proveedores_riesgo_alto = _percent(proveedores_riesgo_alto, proveedores_total)

    proveedores_69b = proveedores_qs.filter(
        estatus_69b__in=[Proveedor.Estatus69B.PRESUNTO, Proveedor.Estatus69B.DEFINITIVO]
    ).count()
    pct_proveedores_69b = _percent(proveedores_69b, proveedores_total)

    total_monto = operaciones_qs.aggregate(total=Sum("monto")).get("total") or Decimal("0")
    monto_riesgoso = operaciones_qs.filter(
        proveedor__estatus_69b__in=[Proveedor.Estatus69B.PRESUNTO, Proveedor.Estatus69B.DEFINITIVO]
    ).aggregate(total=Sum("monto")).get("total") or Decimal("0")
    csd_risk_score = float(round((monto_riesgoso / total_monto) * 100, 1)) if total_monto > 0 else 0.0

    alertas_activas = int(cobertura.get("alertas", {}).get("activas_total", 0) or 0)
    pressure_alerts = _clamp((alertas_activas / max(total_ops, 1)) * 400)

    proveedores_validados_reciente = proveedores_qs.filter(
        ultima_validacion_sat__gte=now - timedelta(days=30)
    ).count()
    pct_proveedores_validados_reciente = _percent(proveedores_validados_reciente, proveedores_total)

    expedientes_resueltos = operaciones_qs.filter(estatus_validacion=Operacion.EstatusValidacion.VALIDADO).count()
    pct_expedientes_resueltos = _percent(expedientes_resueltos, total_ops)

    contratos_sin_vencimiento_30d = contratos_qs.filter(
        Q(vigencia_fin__isnull=True) | Q(vigencia_fin__gt=horizon)
    ).count()
    pct_contratos_sin_vencimiento_30d = _percent(contratos_sin_vencimiento_30d, total_contratos)

    dm = _clamp((0.55 * cobertura_documental_pct) + (0.25 * validated_pct) + (0.20 * operaciones_sin_faltantes_criticos_pct))
    se = _clamp((0.50 * pct_contratos_razon_negocio_aprobada) + (0.25 * pct_operaciones_con_evidencia_validada) + (0.25 * pct_aprobaciones_workflow_completas))
    sc = _clamp((0.45 * cobertura_contractual) + (0.30 * pct_contratos_vigentes) + (0.25 * pct_contratos_con_fecha_cierta))
    ec = _clamp((0.45 * csd_risk_score) + (0.30 * pct_proveedores_riesgo_alto) + (0.15 * pct_proveedores_69b) + (0.10 * pressure_alerts))
    do = _clamp((0.40 * pct_proveedores_validados_reciente) + (0.30 * pct_expedientes_resueltos) + (0.30 * pct_contratos_sin_vencimiento_30d))

    internal_payload = build_internal_fdi_payload(
        generated_at=now.isoformat(),
        days=days,
        period_from=cobertura.get("period", {}).get("from"),
        period_to=cobertura.get("period", {}).get("to"),
        empresa_id=empresa_id,
        has_universe=has_universe,
        breakdown={
            "DM": dm,
            "SE": se,
            "SC": sc,
            "EC": ec,
            "DO": do,
        },
        inputs={
            "total_operaciones": total_ops,
            "operaciones_validadas": validated_ops,
            "alertas_criticas": alertas_criticas,
            "proveedores_total": proveedores_total,
            "cobertura_documental_pct": cobertura_documental_pct,
            "pct_operaciones_validadas": validated_pct,
            "pct_operaciones_sin_faltantes_criticos": operaciones_sin_faltantes_criticos_pct,
            "pct_contratos_razon_negocio_aprobada": pct_contratos_razon_negocio_aprobada,
            "pct_operaciones_con_evidencia_validada": pct_operaciones_con_evidencia_validada,
            "pct_aprobaciones_workflow_completas": pct_aprobaciones_workflow_completas,
            "cobertura_contractual": cobertura_contractual,
            "pct_contratos_vigentes": pct_contratos_vigentes,
            "pct_contratos_con_fecha_cierta": pct_contratos_con_fecha_cierta,
            "csd_risk_score": csd_risk_score,
            "pct_proveedores_riesgo_alto": pct_proveedores_riesgo_alto,
            "pct_proveedores_69b": pct_proveedores_69b,
            "pressure_alerts": pressure_alerts,
            "pct_proveedores_validados_reciente": pct_proveedores_validados_reciente,
            "pct_expedientes_resueltos": pct_expedientes_resueltos,
            "pct_contratos_sin_vencimiento_30d": pct_contratos_sin_vencimiento_30d,
        },
        actions=[],
    )
    score = float(internal_payload.get("score", 0.0) or 0.0)
    internal_payload["actions"] = _fdi_actions(
        score=score,
        dm=dm,
        se=se,
        sc=sc,
        ec=ec,
        do=do,
        has_universe=has_universe,
    )
    return internal_payload


def calculate_fiscal_defense_index_internal(*, days: int = 90, empresa_id: int | None = None) -> dict[str, Any]:
    days = max(7, min(days, 365))
    try:
        from .defense_projection import calculate_fiscal_defense_index_from_projections

        payload = calculate_fiscal_defense_index_from_projections(days=days, empresa_id=empresa_id)
        try:
            legacy_payload = _calculate_legacy_fdi_internal(days=days, empresa_id=empresa_id)
            payload.setdefault("meta", {})["legacy_comparison"] = _build_fdi_legacy_comparison(
                current_payload=payload,
                legacy_payload=legacy_payload,
            )
        except Exception as compare_exc:  # pragma: no cover - diagnostico complementario
            logger.warning("FDI legacy comparator failed: %s", compare_exc)
        return payload
    except Exception as exc:  # pragma: no cover - fallback operativo
        if not getattr(settings, "FDI_ALLOW_LEGACY_FALLBACK", True):
            logger.error("FDI projection aggregate failed and legacy fallback is disabled: %s", exc)
            raise
        logger.warning("FDI projection aggregate failed, using legacy transactional path: %s", exc)

    return _calculate_legacy_fdi_internal(days=days, empresa_id=empresa_id)


def calculate_fiscal_defense_index(*, days: int = 90, empresa_id: int | None = None) -> dict[str, Any]:
    return export_public_fdi_payload(
        calculate_fiscal_defense_index_internal(days=days, empresa_id=empresa_id)
    )


def generate_fdi_narrative(*, audience: str, fdi_payload: dict[str, Any]) -> dict[str, Any]:
    audience = (audience or "CFO").upper()
    if audience not in {"RECTOR", "CFO", "DESPACHO"}:
        audience = "CFO"

    try:
        tenant = TenantContext.get_current_tenant()
        ai_client = get_ai_client(tenant)
        system_prompt = (
            "Eres un redactor fiscal ejecutivo para direccion y auditoria. "
            "Devuelve un JSON estricto con llaves: headline, executive_summary, evidence_points, priority_actions. "
            "No incluyas markdown ni texto fuera del JSON. "
            "Mantente en espanol profesional, concreto y accionable."
        )
        user_prompt = (
            f"Audiencia objetivo: {audience}.\n"
            "Genera narrativa ejecutiva basada en este payload FDI:\n"
            f"{json.dumps(fdi_payload, ensure_ascii=True)}\n"
            "Reglas:\n"
            "1) headline maximo 18 palabras.\n"
            "2) executive_summary maximo 90 palabras.\n"
            "3) evidence_points lista de 2 o 3 bullets textuales.\n"
            "4) priority_actions lista de 2 o 3 acciones concretas."
        )
        raw_response = ai_client.generate_text(
            [
                ChatMessage(role="system", content=system_prompt),
                ChatMessage(role="user", content=user_prompt),
            ],
            temperature=0.2,
            max_output_tokens=700,
        )
        parsed = _extract_json_payload(raw_response)
        return {
            "audience": audience,
            "headline": str(parsed.get("headline", "")).strip(),
            "executive_summary": str(parsed.get("executive_summary", "")).strip(),
            "evidence_points": [str(x).strip() for x in (parsed.get("evidence_points") or []) if str(x).strip()][:3],
            "priority_actions": [str(x).strip() for x in (parsed.get("priority_actions") or []) if str(x).strip()][:3],
            "generated_at": timezone.now().isoformat(),
            "source": "ai",
            "model": ai_client.model_name,
        }
    except (OpenAIClientError, ValueError, json.JSONDecodeError, KeyError, TypeError) as exc:
        logger.warning("FDI narrative AI failed, using fallback: %s", exc)
        return _generate_fdi_narrative_fallback(audience=audience, fdi_payload=fdi_payload)


def persist_fdi_narrative(
    *,
    audience: str,
    fdi_payload: dict[str, Any],
    narrative_payload: dict[str, Any] | None = None,
) -> FiscalDefenseIndexNarrative | None:
    tenant = TenantContext.get_current_tenant()
    if not tenant:
        return None

    trace = fdi_payload.get("trace") if isinstance(fdi_payload, dict) else None
    if not isinstance(trace, dict):
        return None

    correlation_id_raw = trace.get("correlation_id")
    if not correlation_id_raw:
        return None

    try:
        correlation_id = UUID(str(correlation_id_raw))
    except (TypeError, ValueError):
        return None

    audience = (audience or "CFO").upper()
    if audience not in {"RECTOR", "CFO", "DESPACHO"}:
        audience = "CFO"

    if narrative_payload is None:
        narrative_payload = generate_fdi_narrative(audience=audience, fdi_payload=fdi_payload)

    period = fdi_payload.get("period") if isinstance(fdi_payload, dict) else None
    empresa_id = period.get("empresa_id") if isinstance(period, dict) else None
    snapshot_qs = FiscalDefenseIndexSnapshot.objects.filter(
        tenant_slug=tenant.slug,
        correlation_id=correlation_id,
    )
    if empresa_id is not None:
        snapshot_qs = snapshot_qs.filter(empresa_id=empresa_id)
    snapshot = snapshot_qs.order_by("-captured_at").first()

    narrative, _ = FiscalDefenseIndexNarrative.objects.update_or_create(
        tenant_slug=tenant.slug,
        correlation_id=correlation_id,
        audience=audience,
        defaults={
            "snapshot": snapshot,
            "empresa_id": empresa_id,
            "formula_version": str(trace.get("formula_version", "") or ""),
            "pipeline_version": str(trace.get("pipeline_version", "") or ""),
            "headline": str(narrative_payload.get("headline", "") or ""),
            "executive_summary": str(narrative_payload.get("executive_summary", "") or ""),
            "evidence_points_json": list(narrative_payload.get("evidence_points") or []),
            "priority_actions_json": list(narrative_payload.get("priority_actions") or []),
            "payload_json": narrative_payload,
            "source": str(narrative_payload.get("source", "") or ""),
            "model_name": str(narrative_payload.get("model", "") or ""),
        },
    )
    return narrative


def get_persisted_fdi_narrative(*, audience: str, fdi_payload: dict[str, Any]) -> FiscalDefenseIndexNarrative | None:
    tenant = TenantContext.get_current_tenant()
    if not tenant:
        return None

    trace = fdi_payload.get("trace") if isinstance(fdi_payload, dict) else None
    if not isinstance(trace, dict) or not trace.get("correlation_id"):
        return None

    try:
        correlation_id = UUID(str(trace.get("correlation_id")))
    except (TypeError, ValueError):
        return None

    audience = (audience or "CFO").upper()
    period = fdi_payload.get("period") if isinstance(fdi_payload, dict) else None
    empresa_id = period.get("empresa_id") if isinstance(period, dict) else None
    queryset = FiscalDefenseIndexNarrative.objects.filter(
        tenant_slug=tenant.slug,
        correlation_id=correlation_id,
        audience=audience,
    )
    if empresa_id is not None:
        queryset = queryset.filter(empresa_id=empresa_id)
    return queryset.order_by("-updated_at").first()


def serialize_fdi_narrative(narrative: FiscalDefenseIndexNarrative) -> dict[str, Any]:
    return {
        "audience": narrative.audience,
        "headline": narrative.headline,
        "executive_summary": narrative.executive_summary,
        "evidence_points": list(narrative.evidence_points_json or []),
        "priority_actions": list(narrative.priority_actions_json or []),
        "generated_at": narrative.updated_at.isoformat(),
        "source": narrative.source or "persisted",
        "model": narrative.model_name,
    }


def build_pending_fdi_narrative(*, audience: str, fdi_payload: dict[str, Any]) -> dict[str, Any]:
    score = float(fdi_payload.get("score", 0.0) or 0.0)
    level = str(fdi_payload.get("level", "NO_DATA") or "NO_DATA")
    return {
        "audience": audience,
        "headline": "Narrativa ejecutiva pendiente",
        "executive_summary": (
            f"El snapshot FDI actual reporta score {score:.1f} en nivel {level}, "
            "pero la narrativa persistida aun no ha sido generada para esta version."
        ),
        "evidence_points": [
            "El dashboard opera en modo snapshot-only para FDI.",
            "La narrativa ejecutiva debe existir como artefacto persistido por correlation_id.",
        ],
        "priority_actions": [
            "Solicita a un administrador regenerar la narrativa persistida del snapshot actual.",
        ],
        "generated_at": timezone.now().isoformat(),
        "source": "pending_persisted",
        "model": "",
    }


def persist_fdi_snapshot(*, days: int = 90, empresa_id: int | None = None, source: str = "scheduled") -> FiscalDefenseIndexSnapshot:
    tenant = TenantContext.get_current_tenant()
    if not tenant:
        raise ValueError("Se requiere tenant activo para persistir snapshot FDI")

    internal_payload = calculate_fiscal_defense_index_internal(days=days, empresa_id=empresa_id)
    payload = export_public_fdi_payload(internal_payload)
    period = payload.get("period", {}) or {}
    confidence = payload.get("confidence", {}) or {}
    trace = payload.get("trace", {}) or {}

    period_start_raw = str(period.get("from") or timezone.localdate().isoformat())[:10]
    period_end_raw = str(period.get("to") or timezone.localdate().isoformat())[:10]
    try:
        period_start = date.fromisoformat(period_start_raw)
    except ValueError:
        period_start = timezone.localdate()
    try:
        period_end = date.fromisoformat(period_end_raw)
    except ValueError:
        period_end = timezone.localdate()

    breakdown = payload.get("breakdown", {}) or {}

    return FiscalDefenseIndexSnapshot.objects.create(
        tenant_slug=tenant.slug,
        empresa_id=empresa_id,
        period_start=period_start,
        period_end=period_end,
        score=Decimal(str(payload.get("score", 0) or 0)).quantize(ONE_DECIMAL, rounding=ROUND_HALF_UP),
        level=str(payload.get("level", "NO_DATA")),
        dm=Decimal(str(breakdown.get("DM", 0) or 0)).quantize(ONE_DECIMAL, rounding=ROUND_HALF_UP),
        se=Decimal(str(breakdown.get("SE", 0) or 0)).quantize(ONE_DECIMAL, rounding=ROUND_HALF_UP),
        sc=Decimal(str(breakdown.get("SC", 0) or 0)).quantize(ONE_DECIMAL, rounding=ROUND_HALF_UP),
        ec=Decimal(str(breakdown.get("EC", 0) or 0)).quantize(ONE_DECIMAL, rounding=ROUND_HALF_UP),
        do=Decimal(str(breakdown.get("DO", 0) or 0)).quantize(ONE_DECIMAL, rounding=ROUND_HALF_UP),
        confidence_score=Decimal(str(confidence.get("score", 0) or 0)).quantize(ONE_DECIMAL, rounding=ROUND_HALF_UP),
        formula_version=str(trace.get("formula_version", "") or ""),
        pipeline_version=str(trace.get("pipeline_version", "") or ""),
        correlation_id=trace.get("correlation_id") or None,
        inputs_json=payload.get("inputs", {}) or {},
        actions_json=payload.get("actions", []) or [],
        source=source,
    )


def get_fdi_operability_metrics(*, days: int = 90, empresa_id: int | None = None) -> dict[str, Any]:
    tenant = TenantContext.get_current_tenant()
    tenant_slug = tenant.slug if tenant else None
    now = timezone.now()
    today = timezone.localdate()
    start_date = today - timedelta(days=max(days - 1, 0))

    projections_qs = OperationDefenseProjection.objects.filter(
        operacion__fecha_operacion__gte=start_date,
        operacion__fecha_operacion__lte=today,
    )
    snapshots_qs = FiscalDefenseIndexSnapshot.objects.filter(
        period_start__gte=start_date,
        period_end__lte=today,
    )
    narratives_qs = FiscalDefenseIndexNarrative.objects.all()

    if tenant_slug:
        projections_qs = projections_qs.filter(tenant_slug=tenant_slug)
        snapshots_qs = snapshots_qs.filter(tenant_slug=tenant_slug)
        narratives_qs = narratives_qs.filter(tenant_slug=tenant_slug)
    if empresa_id is not None:
        projections_qs = projections_qs.filter(empresa_id=empresa_id)
        snapshots_qs = snapshots_qs.filter(empresa_id=empresa_id)
        narratives_qs = narratives_qs.filter(empresa_id=empresa_id)

    latest_projection = projections_qs.order_by("-captured_at").first()
    latest_snapshot = snapshots_qs.order_by("-captured_at").first()
    latest_narrative = narratives_qs.order_by("-updated_at").first()
    runs_qs = FDIJobRun.objects.all()
    included_count = projections_qs.filter(included_in_fdi=True).count()
    projection_count = projections_qs.count()
    active_empresas_qs = Empresa.objects.filter(activo=True)

    if tenant_slug:
        runs_qs = runs_qs.filter(tenant_slug=tenant_slug)
    if empresa_id is not None:
        runs_qs = runs_qs.filter(empresa_id=empresa_id)
        active_empresas_qs = active_empresas_qs.filter(id=empresa_id)

    recent_runs_qs = runs_qs.filter(started_at__gte=now - timedelta(hours=24))
    latest_run = runs_qs.order_by("-started_at").first()
    latest_failure = runs_qs.filter(status=FDIJobRun.Status.FAILURE).order_by("-started_at").first()
    recent_total = recent_runs_qs.count()
    recent_failures = recent_runs_qs.filter(status=FDIJobRun.Status.FAILURE).count()

    def _lag_minutes(timestamp) -> float | None:
        if not timestamp:
            return None
        return round((now - timestamp).total_seconds() / 60.0, 1)

    divergence: dict[str, Any] = {
        "available": False,
    }
    try:
        internal_payload = calculate_fiscal_defense_index_internal(days=days, empresa_id=empresa_id)
        legacy_comparison = (internal_payload.get("meta") or {}).get("legacy_comparison")
        if isinstance(legacy_comparison, dict):
            divergence = {
                "available": True,
                **legacy_comparison,
            }
    except Exception as exc:  # pragma: no cover - observabilidad no debe romper el dashboard
        logger.warning("No se pudo calcular divergencia FDI legacy-vs-nuevo: %s", exc)

    projection_lag = _lag_minutes(getattr(latest_projection, "captured_at", None))
    snapshot_lag = _lag_minutes(getattr(latest_snapshot, "captured_at", None))
    narrative_lag = _lag_minutes(getattr(latest_narrative, "updated_at", None))

    total_amount = Decimal(str(
        projections_qs.aggregate(total=Sum("operacion__monto")).get("total") or 0
    ))
    included_amount = Decimal(str(
        projections_qs.filter(included_in_fdi=True).aggregate(total=Sum("operacion__monto")).get("total") or 0
    ))
    amount_coverage = float(round((included_amount / total_amount) * 100, 1)) if total_amount > 0 else 0.0
    count_coverage = round((included_count / projection_count) * 100, 1) if projection_count else 0.0

    active_empresas_total = active_empresas_qs.count()
    snapshot_recent_qs = snapshots_qs.filter(captured_at__gte=now - timedelta(minutes=90))
    if empresa_id is None:
        fresh_empresa_ids = {
            item for item in snapshot_recent_qs.values_list("empresa_id", flat=True) if item is not None
        }
        freshness_ratio = round((len(fresh_empresa_ids) / active_empresas_total) * 100, 1) if active_empresas_total else 0.0
    else:
        freshness_ratio = 100.0 if snapshot_recent_qs.exists() else 0.0

    explainability_ok = bool(
        latest_snapshot
        and latest_snapshot.formula_version
        and latest_snapshot.pipeline_version
        and latest_snapshot.correlation_id
        and latest_snapshot.inputs_json is not None
        and latest_snapshot.actions_json is not None
    )
    divergence_within_threshold = bool(
        divergence.get("available") and abs(float(divergence.get("score_delta", 999.0) or 999.0)) <= 5.0
    )
    reliability_ok = recent_total > 0 and recent_failures == 0
    readiness = {
        "coverage_gate": {
            "passed": amount_coverage >= 95.0 and count_coverage >= 90.0,
            "amount_coverage_pct": amount_coverage,
            "count_coverage_pct": count_coverage,
        },
        "snapshot_freshness_gate": {
            "passed": freshness_ratio >= 95.0,
            "fresh_empresas_pct": freshness_ratio,
            "active_empresas_total": active_empresas_total,
        },
        "divergence_gate": {
            "passed": divergence_within_threshold,
            "score_delta": float(divergence.get("score_delta", 0.0) or 0.0) if divergence.get("available") else None,
        },
        "reliability_gate": {
            "passed": reliability_ok,
            "recent_total": recent_total,
            "recent_failures": recent_failures,
            "failure_rate_24h": round((recent_failures / recent_total) * 100, 1) if recent_total else 0.0,
        },
        "explainability_gate": {
            "passed": explainability_ok,
            "latest_snapshot_id": latest_snapshot.id if latest_snapshot else None,
        },
    }
    alerts: list[dict[str, Any]] = []
    if not readiness["coverage_gate"]["passed"]:
        alerts.append(
            {
                "severity": "warning",
                "code": "coverage_below_threshold",
                "message": "La cobertura del universo FDI aun no alcanza el umbral para retirar el camino legacy.",
            }
        )
    if not readiness["snapshot_freshness_gate"]["passed"]:
        alerts.append(
            {
                "severity": "critical",
                "code": "snapshot_freshness_below_sla",
                "message": "La frescura de snapshots por empresa esta por debajo del SLA definido.",
            }
        )
    if recent_failures > 0:
        alerts.append(
            {
                "severity": "critical",
                "code": "job_failures_detected",
                "message": "Se detectaron fallas recientes en los jobs FDI. Revisar el historial operativo.",
            }
        )
    if divergence.get("available") and not divergence_within_threshold:
        alerts.append(
            {
                "severity": "warning",
                "code": "legacy_divergence_high",
                "message": "La divergencia entre score legacy y nuevo supera el umbral operativo aceptado.",
            }
        )
    if not explainability_ok:
        alerts.append(
            {
                "severity": "warning",
                "code": "snapshot_trace_incomplete",
                "message": "El snapshot mas reciente no cumple con el contrato completo de trazabilidad y explicabilidad.",
            }
        )

    return {
        "window_days": days,
        "projection": {
            "count": projection_count,
            "included_count": included_count,
            "latest_captured_at": latest_projection.captured_at.isoformat() if latest_projection else None,
            "lag_minutes": projection_lag,
            "stale": projection_lag is None or projection_lag > (days * 24 * 60),
        },
        "snapshot": {
            "count": snapshots_qs.count(),
            "latest_captured_at": latest_snapshot.captured_at.isoformat() if latest_snapshot else None,
            "lag_minutes": snapshot_lag,
            "stale": snapshot_lag is None or snapshot_lag > 90.0,
        },
        "narrative": {
            "count": narratives_qs.count(),
            "latest_updated_at": latest_narrative.updated_at.isoformat() if latest_narrative else None,
            "lag_minutes": narrative_lag,
            "stale": narrative_lag is None or narrative_lag > 180.0,
        },
        "job_runs": {
            "latest_started_at": latest_run.started_at.isoformat() if latest_run else None,
            "latest_status": latest_run.status if latest_run else None,
            "latest_duration_ms": latest_run.duration_ms if latest_run else None,
            "last_error": latest_failure.error_message if latest_failure else "",
            "failure_rate_24h": round((recent_failures / recent_total) * 100, 1) if recent_total else 0.0,
            "recent_total": recent_total,
            "recent_failures": recent_failures,
        },
        "divergence": divergence,
        "readiness": readiness,
        "alerts": alerts,
    }


def get_dashboard_metrics(*, include_fdi_operability: bool = False) -> dict[str, Any]:
    today = timezone.now().date()
    horizon = today + timedelta(days=30)

    empresas_total = Empresa.objects.count()
    empresas_activas = Empresa.objects.filter(activo=True).count()
    contratos_sin_vigencia = (
        Contrato.objects.filter(activo=True)
        .filter(Q(vigencia_inicio__isnull=True) | Q(vigencia_fin__isnull=True))
        .count()
    )
    contratos_vigentes_qs = Contrato.objects.filter(
        activo=True,
        vigencia_inicio__isnull=False,
        vigencia_fin__isnull=False,
        vigencia_inicio__lte=today,
        vigencia_fin__gte=today,
    )
    empresas_con_contrato = (
        Empresa.objects.filter(activo=True, contratos__in=contratos_vigentes_qs)
        .distinct()
        .count()
    )

    contratos_vigentes = contratos_vigentes_qs.count()
    contratos_por_vencer = contratos_vigentes_qs.filter(
        vigencia_fin__gte=today, vigencia_fin__lte=horizon
    ).count()
    contratos_vencidos = (
        Contrato.objects.filter(
            activo=True,
            vigencia_inicio__isnull=False,
            vigencia_fin__isnull=False,
            vigencia_fin__lt=today,
        ).count()
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
    if contratos_sin_vigencia:
        insights.append(
            {
                "id": "contratos_sin_vigencia",
                "title": "Contratos sin vigencia",
                "severity": "info",
                "message": f"{contratos_sin_vigencia} contratos no cuentan por falta de vigencia (inicio/fin).",
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

    payload = {
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
            "sin_vigencia": contratos_sin_vigencia,
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
    if include_fdi_operability:
        payload["fdi_pipeline"] = get_fdi_operability_metrics(days=90)
    return payload


def persist_dashboard_snapshot(tenant_slug: str | None = None) -> DashboardSnapshot:
    tenant = TenantContext.get_current_tenant()
    slug = tenant_slug or (tenant.slug if tenant else None)
    if not slug:
        raise ValueError("Se requiere un tenant activo para guardar el snapshot")

    metrics = get_dashboard_metrics()
    fdi_payload = calculate_fiscal_defense_index(days=90)
    metrics_with_fdi = {
        **metrics,
        "fdi": {
            "score": fdi_payload.get("score", 0.0),
            "level": fdi_payload.get("level", "NO_DATA"),
            "breakdown": fdi_payload.get("breakdown", {}),
            "generated_at": fdi_payload.get("generated_at"),
            "period": fdi_payload.get("period", {}),
        },
    }
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
        payload=metrics_with_fdi,
        cobertura_contractual=cobertura_value,
        contratos_por_vencer_30=int(contratos.get("por_vencer_30", 0) or 0),
        operaciones_pendientes=int(operaciones.get("pendientes_validacion", 0) or 0),
        proveedores_sin_validacion_sat=int(proveedores.get("sin_validacion_sat", 0) or 0),
        monto_validado_mxn=monto_validado_value,
    )

    try:
        persist_fdi_snapshot(days=90, source="dashboard_snapshot")
    except Exception as exc:  # pragma: no cover - persistencia complementaria
        logger.warning("No se pudo persistir FiscalDefenseIndexSnapshot: %s", exc)

    return snapshot


def get_dashboard_cobertura_p0(*, days: int = 90, empresa_id: int | None = None) -> dict[str, Any]:
    days = max(7, min(days, 365))
    today = timezone.localdate()
    start_date = today - timedelta(days=days)

    operaciones_qs = (
        Operacion.objects.select_related("empresa", "proveedor", "contrato")
        .prefetch_related("evidencias")
        .filter(fecha_operacion__gte=start_date, fecha_operacion__lte=today)
    )
    if empresa_id:
        operaciones_qs = operaciones_qs.filter(empresa_id=empresa_id)

    operaciones = list(operaciones_qs)
    total_operaciones = len(operaciones)

    completas = 0
    incompletas = 0
    riesgo_dist = {
        "BAJO": {"count": 0, "monto": 0.0},
        "MEDIO": {"count": 0, "monto": 0.0},
        "ALTO": {"count": 0, "monto": 0.0},
    }

    for operacion in operaciones:
        _, faltantes = get_operacion_faltantes_materialidad(operacion)
        if faltantes:
            incompletas += 1
        else:
            completas += 1

        metadata = operacion.metadata or {}
        riesgo = metadata.get("riesgo_materialidad") if isinstance(metadata, dict) else None
        if not isinstance(riesgo, dict):
            riesgo = get_operacion_riesgo_materialidad(operacion)
        nivel = str(riesgo.get("nivel", "BAJO"))
        if nivel not in riesgo_dist:
            nivel = "BAJO"
        riesgo_dist[nivel]["count"] += 1
        riesgo_dist[nivel]["monto"] += float(operacion.monto)

    cobertura_documental = round((completas / total_operaciones) * 100, 1) if total_operaciones else 0.0

    try:
        alertas_qs = AlertaOperacion.objects.filter(estatus=AlertaOperacion.Estatus.ACTIVA)
        if empresa_id:
            alertas_qs = alertas_qs.filter(empresa_id=empresa_id)
        alertas_activas_total = alertas_qs.count()
        alertas_por_tipo = {
            AlertaOperacion.TipoAlerta.FALTANTES_CRITICOS: alertas_qs.filter(
                tipo_alerta=AlertaOperacion.TipoAlerta.FALTANTES_CRITICOS
            ).count(),
            AlertaOperacion.TipoAlerta.VENCIMIENTO_EVIDENCIA: alertas_qs.filter(
                tipo_alerta=AlertaOperacion.TipoAlerta.VENCIMIENTO_EVIDENCIA
            ).count(),
        }
    except DatabaseError:
        logger.exception("No se pudieron consultar alertas activas para cobertura P0")
        alertas_activas_total = 0
        alertas_por_tipo = {
            AlertaOperacion.TipoAlerta.FALTANTES_CRITICOS: 0,
            AlertaOperacion.TipoAlerta.VENCIMIENTO_EVIDENCIA: 0,
        }

    trend_weeks: list[dict[str, Any]] = []
    total_weeks = max(1, min((days + 6) // 7, 12))
    for week_index in range(total_weeks):
        week_end = today - timedelta(days=7 * (total_weeks - week_index - 1))
        week_start = week_end - timedelta(days=6)
        week_ops = [
            op
            for op in operaciones
            if week_start <= op.fecha_operacion <= week_end
        ]
        week_total = len(week_ops)
        week_validadas = sum(1 for op in week_ops if op.estatus_validacion == Operacion.EstatusValidacion.VALIDADO)
        week_completas = 0
        for op in week_ops:
            _, faltantes = get_operacion_faltantes_materialidad(op)
            if not faltantes:
                week_completas += 1
        week_incompletas = week_total - week_completas
        trend_weeks.append(
            {
                "week_start": week_start.isoformat(),
                "week_end": week_end.isoformat(),
                "total_operaciones": week_total,
                "validadas": week_validadas,
                "completas": week_completas,
                "incompletas": week_incompletas,
            }
        )

    return {
        "generated_at": timezone.now().isoformat(),
        "period": {
            "days": days,
            "from": start_date.isoformat(),
            "to": today.isoformat(),
            "empresa_id": empresa_id,
        },
        "coverage": {
            "total_operaciones": total_operaciones,
            "completas": completas,
            "incompletas": incompletas,
            "cobertura_documental_pct": cobertura_documental,
        },
        "riesgo_distribution": riesgo_dist,
        "alertas": {
            "activas_total": alertas_activas_total,
            "por_tipo": alertas_por_tipo,
        },
        "trend_weekly": trend_weeks,
    }


def _tokenize_query(text: str) -> list[str]:
    tokens = re.findall(r"[\wÁ-ÿ]{3,}", text or "", flags=re.IGNORECASE)
    return [token.strip() for token in tokens if token.strip()]


def _normalize_legal_text(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").strip().lower())


FOCUS_KEYWORD_GROUPS = (
    (
        "69b_definitivo",
        (
            "69-b definitivo",
            "69 b definitivo",
            "proveedor definitivo",
            "edos",
            "definitivo",
        ),
    ),
    (
        "69b_presunto",
        (
            "69-b presunto",
            "69 b presunto",
            "proveedor presunto",
            "efos",
            "presunto",
        ),
    ),
    (
        "69b",
        (
            "69-b",
            "69 b",
            "operaciones inexistentes",
            "articulo 69-b",
        ),
    ),
    (
        "intercompany",
        (
            "intercompany",
            "inter compan",
            "partes relacionadas",
            "relacionadas",
            "precios de transferencia",
            "arm s length",
            "intragrupo",
            "grupo empresarial",
        ),
    ),
    (
        "deducibilidad",
        (
            "deducibilidad",
            "deducible",
            "deduccion",
            "deducciones",
            "articulo 27",
            "lisr",
            "acreditamiento de iva",
            "requisito fiscal",
        ),
    ),
    (
        "materialidad_arrendamiento",
        (
            "arrendamiento",
            "renta",
            "retroexcavadora",
            "maquinaria",
            "acta de entrega",
            "equipo arrendado",
        ),
    ),
    (
        "materialidad_compras",
        (
            "compra",
            "compras",
            "adquisicion",
            "adquisición",
            "recepcion material",
            "recepción material",
            "inventario",
            "bien adquirido",
        ),
    ),
    (
        "materialidad_servicios",
        (
            "servicio",
            "servicios",
            "consultoria",
            "consultoría",
            "asesoria",
            "asesoría",
            "bitacora",
            "bitácora",
        ),
    ),
    (
        "materialidad",
        (
            "materialidad",
            "razon de negocio",
            "razon negocio",
            "sustancia economica",
            "entregables",
            "evidencia operativa",
            "5-a",
            "5a",
            "simulacion",
        ),
    ),
)

FOCUS_PRIORITY = {
    "69b_definitivo": 9,
    "69b_presunto": 8,
    "materialidad_arrendamiento": 7,
    "materialidad_compras": 7,
    "materialidad_servicios": 7,
    "intercompany": 6,
    "deducibilidad": 5,
    "69b": 4,
    "materialidad": 3,
    "general": 0,
}

REFERENCE_MATCH_STOPWORDS = {
    "como",
    "cómo",
    "debo",
    "debe",
    "puede",
    "puedo",
    "sobre",
    "necesito",
    "consulta",
    "operacion",
    "operación",
    "fiscal",
    "legal",
}

FOCUS_REASON_TEMPLATES = {
    "materialidad_arrendamiento": "Se relaciona con arrendamiento porque describe entrega, uso o control del bien arrendado.",
    "materialidad_compras": "Se relaciona con compras porque acredita recepción material, inventario o destino del bien adquirido.",
    "materialidad_servicios": "Se relaciona con servicios porque documenta ejecución, entregables o trazabilidad de la prestación.",
    "materialidad": "Se relaciona con materialidad porque aporta evidencia operativa, razón de negocio o sustancia económica.",
    "deducibilidad": "Se relaciona con deducibilidad porque conecta requisitos fiscales con soporte documental del gasto.",
    "69b_presunto": "Se relaciona con 69-B presunto porque alude a presunción, EFOS o desvirtuación inicial del proveedor.",
    "69b_definitivo": "Se relaciona con 69-B definitivo porque alude a EDOS, definitividad o contingencia reforzada del proveedor.",
    "69b": "Se relaciona con 69-B porque trata operaciones inexistentes o efectos del artículo 69-B.",
    "intercompany": "Se relaciona con intercompany porque vincula partes relacionadas, intragrupo o precios de transferencia.",
    "general": "Se relaciona con la consulta porque contiene texto normativo coincidente con el planteamiento analizado.",
}


def _reference_attribute(reference: Any, field: str) -> str:
    if isinstance(reference, dict):
        value = reference.get(field, "")
    else:
        value = getattr(reference, field, "")
    return value or ""


def _reference_focus_text(reference: Any) -> str:
    return _normalize_legal_text(
        " ".join(
            filter(
                None,
                (
                    _reference_attribute(reference, "ley"),
                    _reference_attribute(reference, "ordenamiento"),
                    _reference_attribute(reference, "resumen"),
                    _reference_attribute(reference, "contenido")[:1200],
                    _reference_attribute(reference, "extracto")[:1200],
                    _reference_attribute(reference, "sat_categoria"),
                    _reference_attribute(reference, "rubro"),
                    _reference_attribute(reference, "header"),
                ),
            )
        )
    )


def _focus_scores_from_text(text: str, *, weight: int, scores: dict[str, int]) -> None:
    if not text or weight <= 0:
        return

    for label, keywords in FOCUS_KEYWORD_GROUPS:
        for keyword in keywords:
            if keyword in text:
                scores[label] += weight


def _collect_legal_focus_scores(
    *,
    question: str,
    context_block: str,
    references: list[Any],
) -> dict[str, int]:
    scores: dict[str, int] = {label: 0 for label, _ in FOCUS_KEYWORD_GROUPS}

    _focus_scores_from_text(_normalize_legal_text(question), weight=2, scores=scores)
    _focus_scores_from_text(_normalize_legal_text(context_block), weight=2, scores=scores)

    for reference in references:
        _focus_scores_from_text(_reference_focus_text(reference), weight=5, scores=scores)

    return scores


def _extract_reference_match_terms(
    source: LegalReferenceSource,
    *,
    focus: str,
    query_text: str,
    limit: int = 5,
) -> list[str]:
    haystack = _reference_focus_text(source)
    if not haystack:
        return []

    focus_keywords = dict(FOCUS_KEYWORD_GROUPS).get(focus, ())
    terms: list[str] = []

    for keyword in focus_keywords:
        normalized_keyword = _normalize_legal_text(keyword)
        if normalized_keyword and normalized_keyword in haystack and keyword not in terms:
            terms.append(keyword)

    for token in _tokenize_query(query_text):
        normalized_token = _normalize_legal_text(token)
        if (
            len(normalized_token) < 4
            or normalized_token in REFERENCE_MATCH_STOPWORDS
            or normalized_token in terms
            or normalized_token not in haystack
        ):
            continue
        terms.append(normalized_token)

    return terms[:limit]


def _extract_reference_match_phrases(
    source: LegalReferenceSource,
    *,
    focus: str,
    query_text: str,
    limit: int = 4,
) -> list[str]:
    haystack = _reference_focus_text(source)
    if not haystack:
        return []

    focus_keywords = dict(FOCUS_KEYWORD_GROUPS).get(focus, ())
    phrases: list[str] = []

    for keyword in focus_keywords:
        normalized_keyword = _normalize_legal_text(keyword)
        if len(normalized_keyword.split()) < 2:
            continue
        if normalized_keyword in haystack and keyword not in phrases:
            phrases.append(keyword)

    query_phrases = re.findall(r"[\wÁ-ÿ0-9-]+(?:\s+[\wÁ-ÿ0-9-]+){1,4}", query_text or "", flags=re.IGNORECASE)
    for phrase in query_phrases:
        normalized_phrase = _normalize_legal_text(phrase)
        if (
            len(normalized_phrase.split()) < 2
            or normalized_phrase in phrases
            or normalized_phrase in REFERENCE_MATCH_STOPWORDS
            or normalized_phrase not in haystack
        ):
            continue
        phrases.append(phrase.strip())

    return phrases[:limit]


def _build_reference_match_reason(
    *,
    focus: str,
    matched_phrases: list[str],
    matched_terms: list[str],
) -> str:
    evidence = matched_phrases[:2] or matched_terms[:2]
    if evidence:
        evidence_label = ", ".join(evidence)
        return f"{FOCUS_REASON_TEMPLATES.get(focus, FOCUS_REASON_TEMPLATES['general'])} Coincide con: {evidence_label}."
    return FOCUS_REASON_TEMPLATES.get(focus, FOCUS_REASON_TEMPLATES["general"])


def _score_legal_source(
    source: LegalReferenceSource,
    *,
    query: str,
    tokens: list[str],
    ley: str | None,
    source_type: str | None,
    authority: str | None,
    ordenamiento: str | None,
    query_vector: list[float],
    today: date,
) -> int:
    searchable_parts = [
        source.ley,
        source.articulo,
        source.fraccion,
        source.parrafo,
        source.resumen,
        source.contenido[:4000],
        source.sat_categoria,
        source.autoridad_emisora,
    ]
    haystack = _normalize_legal_text(" ".join(filter(None, searchable_parts)))
    normalized_query = _normalize_legal_text(query)
    score = 0

    if normalized_query and normalized_query in haystack:
        score += 15

    for token in tokens:
        lowered = token.lower()
        if lowered in haystack:
            score += 4
        if lowered == (source.articulo or "").lower():
            score += 10
        if lowered == (source.fraccion or "").lower():
            score += 6

    if ley and source.ley.strip().lower() == ley.strip().lower():
        score += 30
    if ordenamiento and (source.ordenamiento or source.ley).strip().lower() == ordenamiento.strip().lower():
        score += 25
    if source_type and source.tipo_fuente == source_type:
        score += 12
    if authority and (source.autoridad_emisora or "").strip().lower() == authority.strip().lower():
        score += 24

    if source.es_vigente:
        score += 40
    elif source.estatus_vigencia == LegalReferenceSource.VigencyStatus.DESCONOCIDA:
        score += 5
    else:
        score -= 50

    if source.fecha_vigencia_hasta:
        if source.fecha_vigencia_hasta >= today:
            score += 8
        else:
            score -= 35

    if source.fecha_ultima_revision:
        age_days = max((today - source.fecha_ultima_revision).days, 0)
        if age_days <= 30:
            score += 12
        elif age_days <= 180:
            score += 7
        elif age_days <= 365:
            score += 3
        else:
            score -= 5

    if source.articulo:
        score += 3
    if source.fuente_url:
        score += 2
    if source.fuente_documento:
        score += 2
    if query_vector and source.vectorizacion:
        score += int(round(max(cosine_similarity(query_vector, source.vectorizacion), 0.0) * 35))

    return score


def _fetch_candidate_sources(
    *,
    query: str,
    ley: str | None,
    source_type: str | None,
    authority: str | None = None,
    ordenamiento: str | None = None,
    limit: int,
    only_current: bool = True,
) -> list[LegalReferenceSource]:
    limit = max(1, min(limit, 20))
    qs = LegalReferenceSource.objects.all()
    if ley:
        qs = qs.filter(ley__iexact=ley.strip())
    if ordenamiento:
        qs = qs.filter(ordenamiento__iexact=ordenamiento.strip())
    if source_type:
        qs = qs.filter(tipo_fuente=source_type)
    if authority:
        qs = qs.filter(autoridad_emisora__iexact=authority.strip())
    if only_current:
        qs = qs.filter(es_vigente=True)

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

    today = timezone.localdate()
    query_vector = build_hashed_embedding(query)
    candidates = list(qs[:200])
    candidates.sort(
        key=lambda source: (
            _score_legal_source(
                source,
                query=query,
                tokens=tokens,
                ley=ley,
                source_type=source_type,
                authority=authority,
                ordenamiento=ordenamiento,
                query_vector=query_vector,
                today=today,
            ),
            source.fecha_ultima_revision or date.min,
            source.updated_at,
            source.id,
        ),
        reverse=True,
    )
    candidates = candidates[:limit]
    if candidates:
        return candidates

    fallback_qs = LegalReferenceSource.objects.all()
    if ley:
        fallback_qs = fallback_qs.filter(ley__iexact=ley.strip())
    if ordenamiento:
        fallback_qs = fallback_qs.filter(ordenamiento__iexact=ordenamiento.strip())
    if authority:
        fallback_qs = fallback_qs.filter(autoridad_emisora__iexact=authority.strip())
    if only_current:
        fallback_qs = fallback_qs.filter(es_vigente=True)
    return list(fallback_qs.order_by("-fecha_ultima_revision", "-created_at")[:limit])


def _reference_payload(
    source: LegalReferenceSource,
    *,
    focus: str = "general",
    query_text: str = "",
) -> dict[str, Any]:
    excerpt = re.sub(r"\s+", " ", source.contenido).strip()
    if len(excerpt) > 1000:
        excerpt = f"{excerpt[:1000].rstrip()}…"
    metadata = source.metadata if isinstance(source.metadata, dict) else {}
    matched_phrases = _extract_reference_match_phrases(source, focus=focus, query_text=query_text)
    matched_terms = _extract_reference_match_terms(source, focus=focus, query_text=query_text)
    return {
        "id": source.id,
        "ley": source.ley,
        "ordenamiento": source.ordenamiento,
        "tipo_fuente": source.tipo_fuente,
        "estatus_vigencia": source.estatus_vigencia,
        "es_vigente": source.es_vigente,
        "fecha_vigencia_desde": source.fecha_vigencia_desde.isoformat() if source.fecha_vigencia_desde else "",
        "fecha_vigencia_hasta": source.fecha_vigencia_hasta.isoformat() if source.fecha_vigencia_hasta else "",
        "fecha_ultima_revision": source.fecha_ultima_revision.isoformat() if source.fecha_ultima_revision else "",
        "autoridad_emisora": source.autoridad_emisora,
        "articulo": source.articulo,
        "fraccion": source.fraccion,
        "parrafo": source.parrafo,
        "resumen": source.resumen,
        "extracto": excerpt,
        "fuente_documento": source.fuente_documento,
        "fuente_url": source.fuente_url,
        "vigencia": source.vigencia,
        "sat_categoria": source.sat_categoria,
        "section_type": metadata.get("section_type", ""),
        "identifier": metadata.get("identifier", ""),
        "registro_digital": metadata.get("registro_digital", ""),
        "rubro": metadata.get("rubro", ""),
        "tesis": metadata.get("tesis", ""),
        "parser": metadata.get("parser", ""),
        "header": metadata.get("header", ""),
        "matched_phrases": matched_phrases,
        "matched_terms": matched_terms,
        "match_reason": _build_reference_match_reason(
            focus=focus,
            matched_phrases=matched_phrases,
            matched_terms=matched_terms,
        ),
    }


def _build_reference_prompt_block(references: list[LegalReferenceSource]) -> str:
    if not references:
        return "No se encontraron referencias específicas en la biblioteca normativa."

    lines: list[str] = []
    for idx, ref in enumerate(references, start=1):
        snippet = re.sub(r"\s+", " ", ref.contenido).strip()[:900]
        label_parts = [ref.ordenamiento or ref.ley]
        if ref.articulo:
            label_parts.append(f"art. {ref.articulo}")
        if ref.fraccion:
            label_parts.append(f"frac. {ref.fraccion}")
        if ref.estatus_vigencia:
            label_parts.append(ref.estatus_vigencia)
        if ref.autoridad_emisora:
            label_parts.append(ref.autoridad_emisora)
        lines.append(f"[Ref {idx}] {' · '.join(label_parts)}\n{snippet}")
    return "\n\n".join(lines)


def _detect_legal_consultation_focus(
    *,
    question: str,
    context_block: str,
    references: list[Any],
) -> str:
    scores = _collect_legal_focus_scores(
        question=question,
        context_block=context_block,
        references=references,
    )
    if not any(scores.values()):
        return "general"

    best_label = max(scores, key=lambda label: (scores[label], FOCUS_PRIORITY.get(label, 0)))
    return best_label if scores[best_label] > 0 else "general"


def get_legal_consultation_type_label(focus: str) -> str:
    labels = {
        "materialidad_servicios": "Materialidad · Servicios",
        "materialidad_arrendamiento": "Materialidad · Arrendamiento",
        "materialidad_compras": "Materialidad · Compras",
        "materialidad": "Materialidad",
        "deducibilidad": "Deducibilidad",
        "69b_presunto": "69-B · Presunto",
        "69b_definitivo": "69-B · Definitivo",
        "69b": "69-B",
        "intercompany": "Intercompany",
        "general": "Consulta general",
    }
    return labels.get(focus, labels["general"])


def _build_executive_conclusion(
    *,
    focus: str,
    has_current_support: bool,
    has_historical_support: bool,
) -> list[str]:
    support_label = "vigente" if has_current_support else "histórico o por validar" if has_historical_support else "insuficiente"

    conclusion_map = {
        "materialidad_servicios": {
            "current": [
                "- **Postura preliminar:** la materialidad del servicio puede sostenerse si el expediente demuestra ejecución real, alcance verificable y entregables consistentes con la contraprestación.",
                f"- **Nivel de sustento:** {support_label}; el punto crítico será que correos, reportes, bitácoras y aceptación del servicio coincidan con contrato, CFDI y pago.",
                "- **Acción inmediata:** reforzar evidencia de prestación efectiva, trazabilidad de entregables y razón de negocio antes de cerrar criterio interno.",
            ],
            "historical": [
                "- **Postura preliminar:** hay orientación útil para revisar materialidad de servicios, pero aún no soporte suficiente para una conclusión cerrada.",
                f"- **Nivel de sustento:** {support_label}; la defensa sigue frágil si la evidencia de prestación no está documentada con fuentes vigentes.",
                "- **Acción inmediata:** validar la norma vigente y completar bitácoras, reportes, correos y entregables fechados para robustecer el expediente.",
            ],
            "none": [
                "- **Postura preliminar:** no existe base suficiente para defender la materialidad del servicio en condiciones seguras.",
                "- **Nivel de sustento:** insuficiente; falta evidencia objetiva de prestación y soporte normativo útil.",
                "- **Acción inmediata:** reconstruir expediente de ejecución del servicio y complementar la base legal antes de asumir efectos fiscales favorables.",
            ],
        },
        "materialidad_arrendamiento": {
            "current": [
                "- **Postura preliminar:** el arrendamiento puede sostener materialidad si hay prueba clara de disponibilidad, entrega, uso y retorno del bien arrendado.",
                f"- **Nivel de sustento:** {support_label}; la exposición principal está en demostrar que el equipo o activo realmente estuvo a disposición del contribuyente.",
                "- **Acción inmediata:** asegurar actas de entrega, bitácoras de uso, evidencia física y trazabilidad operativa del bien arrendado.",
            ],
            "historical": [
                "- **Postura preliminar:** el análisis orienta la revisión de materialidad del arrendamiento, pero no basta aún para una defensa definitiva.",
                f"- **Nivel de sustento:** {support_label}; sin confirmación vigente y evidencia de uso del activo, el caso sigue vulnerable.",
                "- **Acción inmediata:** confirmar regla vigente y fortalecer prueba de entrega, uso, ubicación y devolución del bien arrendado.",
            ],
            "none": [
                "- **Postura preliminar:** no hay base bastante para defender la materialidad del arrendamiento.",
                "- **Nivel de sustento:** insuficiente; faltan elementos para demostrar que el activo existió, se entregó y se utilizó conforme al contrato.",
                "- **Acción inmediata:** levantar evidencia física y documental del bien arrendado antes de consolidar cualquier postura favorable.",
            ],
        },
        "materialidad_compras": {
            "current": [
                "- **Postura preliminar:** la compra puede sostener materialidad si se acredita recepción real del bien, integración a la operación y congruencia documental completa.",
                f"- **Nivel de sustento:** {support_label}; el principal frente de revisión será la prueba de entrega, recepción y destino del bien adquirido.",
                "- **Acción inmediata:** amarrar órdenes, recepciones, fotografías, inventario y pagos con el CFDI y el contrato o pedido correspondiente.",
            ],
            "historical": [
                "- **Postura preliminar:** hay orientación para revisar materialidad de compras, pero todavía no soporte suficiente para cierre definitivo.",
                f"- **Nivel de sustento:** {support_label}; la defensa seguirá débil si no se acredita recepción material del bien con soporte vigente.",
                "- **Acción inmediata:** validar norma vigente y robustecer actas, inventario, evidencia fotográfica y trazabilidad de recepción del bien.",
            ],
            "none": [
                "- **Postura preliminar:** no existe base suficiente para sostener materialidad en la compra revisada.",
                "- **Nivel de sustento:** insuficiente; falta prueba objetiva de recepción e incorporación real del bien.",
                "- **Acción inmediata:** reconstruir la evidencia de adquisición, recepción y uso antes de defender efectos fiscales del gasto.",
            ],
        },
        "materialidad": {
            "current": [
                "- **Postura preliminar:** la operación puede defenderse en materialidad si el expediente conserva coherencia entre contrato, CFDI, pagos y evidencia de ejecución.",
                f"- **Nivel de sustento:** {support_label}; la posición mejora si la narrativa operativa coincide con los hechos y entregables efectivamente observables.",
                "- **Acción inmediata:** cerrar huecos de sustancia económica, razón de negocio y trazabilidad documental antes de formalizar la postura del despacho.",
            ],
            "historical": [
                "- **Postura preliminar:** hay indicios útiles para orientar la defensa de materialidad, pero todavía no conviene sostener una conclusión cerrada.",
                f"- **Nivel de sustento:** {support_label}; el caso sigue expuesto si la documentación actual no confirma vigencia ni suficiencia probatoria.",
                "- **Acción inmediata:** validar el texto vigente aplicable y robustecer expediente con entregables, comunicaciones, pagos y evidencia objetiva de ejecución.",
            ],
            "none": [
                "- **Postura preliminar:** no hay base suficiente para afirmar materialidad defendible en este momento.",
                "- **Nivel de sustento:** insuficiente; la consulta no permite cerrar una lectura sólida de sustancia económica o prueba documental.",
                "- **Acción inmediata:** reconstruir la cadena probatoria y complementar el compendio antes de usar este criterio en revisión, auditoría o controversia.",
            ],
        },
        "deducibilidad": {
            "current": [
                "- **Postura preliminar:** la deducibilidad es defendible en principio, siempre que se satisfagan simultáneamente requisitos formales y soporte material del gasto.",
                f"- **Nivel de sustento:** {support_label}; la contingencia principal está en que el expediente demuestre estricta indispensabilidad, CFDI correcto y pago trazable.",
                "- **Acción inmediata:** verificar requisitos del artículo aplicable, amarre CFDI-pago y evidencia que pruebe beneficio económico real para el contribuyente.",
            ],
            "historical": [
                "- **Postura preliminar:** el criterio orienta revisión de deducibilidad, pero aún no respalda una conclusión fiscal definitiva.",
                f"- **Nivel de sustento:** {support_label}; existe riesgo relevante de rechazo si el requisito vigente no coincide con la lectura histórica recuperada.",
                "- **Acción inmediata:** confirmar norma vigente, revisar cumplimiento formal y reforzar prueba de necesidad del gasto antes de tomar la deducción.",
            ],
            "none": [
                "- **Postura preliminar:** no hay soporte suficiente para concluir que el gasto sea deducible en condiciones defendibles.",
                "- **Nivel de sustento:** insuficiente; falta base normativa o documental para sostener la posición frente a revisión.",
                "- **Acción inmediata:** validar requisito legal aplicable y reunir contrato, CFDI, pago y evidencia funcional del gasto antes de reconocer la deducción.",
            ],
        },
        "69b_presunto": {
            "current": [
                "- **Postura preliminar:** un proveedor en 69-B presunto obliga a una defensa reforzada; todavía no equivale a inexistencia definitiva, pero sí a alta exposición inmediata.",
                f"- **Nivel de sustento:** {support_label}; la posición dependerá de demostrar materialización real y diligencia reforzada del receptor.",
                "- **Acción inmediata:** suspender confianza operativa normal, recabar prueba exhaustiva de materialización y preparar respuesta técnica para desvirtuar o contener el riesgo.",
            ],
            "historical": [
                "- **Postura preliminar:** el soporte recuperado ayuda a encuadrar un escenario 69-B presunto, pero no basta para una defensa actual cerrada.",
                f"- **Nivel de sustento:** {support_label}; el riesgo sigue alto mientras no se confirme el marco vigente y la evidencia de materialización.",
                "- **Acción inmediata:** confirmar estatus actual del proveedor, reforzar expediente y preparar medidas preventivas de comité y seguimiento documental.",
            ],
            "none": [
                "- **Postura preliminar:** no hay base suficiente para emitir una posición segura frente a un 69-B presunto.",
                "- **Nivel de sustento:** insuficiente; el caso debe tratarse como de alta exposición desde este momento.",
                "- **Acción inmediata:** escalar revisión, detener confianza automática en el proveedor y reconstruir evidencia integral de la operación.",
            ],
        },
        "69b_definitivo": {
            "current": [
                "- **Postura preliminar:** un proveedor en 69-B definitivo coloca la operación en un escenario crítico y no debe manejarse como expediente ordinario de deducibilidad.",
                f"- **Nivel de sustento:** {support_label}; aun con base normativa vigente, la exposición permanece crítica si no se acredita materialización real y estrategia de contención.",
                "- **Acción inmediata:** activar contención formal, evaluar sustitución o reversión y preparar defensa estricta solo si existe prueba robusta de materialización.",
            ],
            "historical": [
                "- **Postura preliminar:** el soporte recuperado solo contextualiza un 69-B definitivo y no autoriza una defensa actual favorable.",
                f"- **Nivel de sustento:** {support_label}; la exposición es crítica mientras no se confirme el régimen vigente y la prueba reforzada del receptor.",
                "- **Acción inmediata:** asumir contención inmediata, confirmar estatus definitivo y documentar comité, sustitución y evaluación de efectos fiscales adversos.",
            ],
            "none": [
                "- **Postura preliminar:** no hay soporte suficiente para emitir una posición segura frente a un 69-B definitivo.",
                "- **Nivel de sustento:** insuficiente; el caso debe manejarse como contingencia crítica hasta nuevo aviso.",
                "- **Acción inmediata:** detener cualquier conclusión favorable, escalar a comité y reconstruir estrategia probatoria y de contención de manera inmediata.",
            ],
        },
        "69b": {
            "current": [
                "- **Postura preliminar:** un caso vinculado con 69-B exige defensa reforzada y no debe tratarse como expediente ordinario de deducibilidad.",
                f"- **Nivel de sustento:** {support_label}; aun con base normativa vigente, la exposición permanece alta si no se acredita materialización real de la operación.",
                "- **Acción inmediata:** congelar criterio complaciente, revisar proveedor, demostrar materialización del servicio o bien y preparar estrategia de contención o sustitución.",
            ],
            "historical": [
                "- **Postura preliminar:** el soporte recuperado solo ayuda a entender el marco 69-B, pero no alcanza para cerrar una defensa actual.",
                f"- **Nivel de sustento:** {support_label}; el riesgo sigue siendo crítico mientras no se confirme la regla vigente y la prueba de materialización.",
                "- **Acción inmediata:** confirmar régimen vigente del 69-B, evaluar exposición del receptor y documentar de inmediato medidas de contención, comité y sustitución si procede.",
            ],
            "none": [
                "- **Postura preliminar:** no hay soporte bastante para emitir una posición segura sobre una contingencia 69-B.",
                "- **Nivel de sustento:** insuficiente; el caso debe asumirse como de alta exposición hasta no reconstruir base legal y expediente probatorio.",
                "- **Acción inmediata:** detener cualquier conclusión favorable, escalar revisión y levantar evidencia integral de proveedor, operación y pagos.",
            ],
        },
        "intercompany": {
            "current": [
                "- **Postura preliminar:** la operación intercompany puede sostenerse si se prueba beneficio económico real, servicios efectivamente recibidos y lógica arm's length.",
                f"- **Nivel de sustento:** {support_label}; el punto crítico será que convenio, evidencia periódica y soporte de precios de transferencia se refuercen entre sí.",
                "- **Acción inmediata:** alinear convenio, evidencia de prestación, allocators y memo de razón de negocio antes de consolidar la postura fiscal.",
            ],
            "historical": [
                "- **Postura preliminar:** el criterio orienta el análisis intercompany, pero todavía no autoriza una conclusión definitiva para partes relacionadas.",
                f"- **Nivel de sustento:** {support_label}; sin confirmación vigente y soporte de arm's length, la operación sigue frágil.",
                "- **Acción inmediata:** confirmar marco vigente, documentar beneficio recibido y amarrar expediente con soporte de PT, aprobaciones y trazabilidad contractual.",
            ],
            "none": [
                "- **Postura preliminar:** no existe base suficiente para defender todavía la operación intercompany.",
                "- **Nivel de sustento:** insuficiente; faltan elementos para demostrar razón de negocio, prestación efectiva y consistencia entre vinculadas.",
                "- **Acción inmediata:** reconstruir expediente con convenio, evidencia operativa y soporte de precios de transferencia antes de reconocer efectos fiscales.",
            ],
        },
        "general": {
            "current": [
                "- **Postura preliminar:** existe soporte normativo vigente suficiente para sostener una línea de análisis inicial.",
                f"- **Nivel de sustento:** {support_label}, sujeto a que el expediente operativo refleje fielmente el supuesto consultado.",
                "- **Acción inmediata:** alinear documentación y narrativa operativa con los artículos citados antes de formalizar criterio interno.",
            ],
            "historical": [
                "- **Postura preliminar:** solo existe soporte histórico o de vigencia no confirmada, por lo que no conviene cerrar una posición definitiva todavía.",
                f"- **Nivel de sustento:** {support_label}; la respuesta sirve como orientación inicial, no como criterio final.",
                "- **Acción inmediata:** confirmar texto vigente y reforma aplicable antes de usar la respuesta como criterio del despacho.",
            ],
            "none": [
                "- **Postura preliminar:** no hay soporte indexado suficiente para emitir una conclusión confiable.",
                "- **Nivel de sustento:** insuficiente.",
                "- **Acción inmediata:** depurar la consulta o ampliar el compendio normativo antes de adoptar una postura.",
            ],
        },
    }

    if has_current_support:
        key = "current"
    elif has_historical_support:
        key = "historical"
    else:
        key = "none"
    return conclusion_map.get(focus, conclusion_map["general"])[key]


def _build_structured_fallback_answer(
    *,
    question: str,
    context_block: str,
    references: list[LegalReferenceSource],
    provider_note: str | None = None,
    used_non_current_support: bool = False,
) -> str:
    current_refs = [ref for ref in references if ref.es_vigente]
    non_current_refs = [ref for ref in references if not ref.es_vigente]
    focus = _detect_legal_consultation_focus(
        question=question,
        context_block=context_block,
        references=references,
    )
    executive_conclusion = _build_executive_conclusion(
        focus=focus,
        has_current_support=bool(current_refs),
        has_historical_support=bool(non_current_refs),
    )

    if current_refs:
        normative_lines = [
            f"- [Ref {idx}] **{ref.ordenamiento or ref.ley}**"
            f"{f' art. {ref.articulo}' if ref.articulo else ''}"
            f"{f', frac. {ref.fraccion}' if ref.fraccion else ''}: {ref.resumen or re.sub(r'\s+', ' ', ref.contenido).strip()[:240]}"
            for idx, ref in enumerate(current_refs[:3], start=1)
        ]
        normative_intro = "Se identificaron referencias vigentes directamente relacionadas con la consulta."
    elif non_current_refs:
        normative_lines = [
            f"- [Ref {idx}] **{ref.ordenamiento or ref.ley}**"
            f"{f' art. {ref.articulo}' if ref.articulo else ''}: {ref.resumen or re.sub(r'\s+', ' ', ref.contenido).strip()[:240]}"
            for idx, ref in enumerate(non_current_refs[:3], start=1)
        ]
        normative_intro = (
            "No se localizaron referencias marcadas como vigentes; las referencias disponibles sirven solo como apoyo secundario "
            "y requieren validación normativa adicional."
        )
    else:
        normative_lines = [
            "- No hay fuentes indexadas suficientes para sostener una conclusión normativa cerrada.",
        ]
        normative_intro = (
            "La biblioteca legal no devolvió referencias útiles para contestar de forma concluyente con soporte normativo indexado."
        )

    recommendation_lines = [
        "- Validar contra el texto vigente del ordenamiento aplicable y su última reforma antes de adoptar una posición definitiva.",
        "- Documentar contrato, CFDI, trazabilidad operativa y evidencia de ejecución si la consulta impacta materialidad o deducibilidad.",
        "- Escalar a revisión jurídica puntual si la operación involucra excepción, criterio controvertido o soporte solo histórico.",
    ]
    if current_refs:
        recommendation_lines.insert(0, "- Alinear el expediente operativo con los artículos citados y conservar evidencia que pruebe sustancia económica.")
    if not references:
        recommendation_lines.insert(0, "- Alimentar o depurar el compendio legal para mejorar cobertura antes de reutilizar esta respuesta como criterio interno.")

    risk_lines = [
        "- Riesgo de sobreinterpretación si la operación real difiere del contexto resumido por el usuario.",
    ]
    if not current_refs:
        risk_lines.append("- Riesgo alto de soporte insuficiente porque no hay referencias vigentes indexadas para sustentar la conclusión.")
    if used_non_current_support:
        risk_lines.append("- Se usó soporte histórico o no vigente como referencia contextual; no debe tratarse como sustento definitivo.")

    sections = [
        "## 0. Conclusión Ejecutiva",
        *executive_conclusion,
        "",
        "## 1. Análisis Normativo",
        normative_intro,
        *normative_lines,
        "",
        "## 2. Aplicación al Caso",
        f"- **Pregunta evaluada:** {question.strip()}",
        f"- **Contexto operativo considerado:** {context_block}",
        "- La postura debe entenderse como criterio preliminar de trabajo y no como sustituto de validación documental o revisión de texto vigente completo.",
        "",
        "## 3. Riesgos Identificados",
        *risk_lines,
        "",
        "## 4. Recomendaciones Prácticas",
        *recommendation_lines,
    ]

    if provider_note:
        sections.extend([
            "",
            "## 5. Nota de proceso",
            f"- {provider_note}",
        ])

    return "\n".join(sections).strip()


def perform_legal_consultation(
    *,
    question: str,
    context: str | None,
    ley: str | None,
    source_type: str | None,
    authority: str | None,
    ordenamiento: str | None,
    only_current: bool,
    max_refs: int,
    user,
) -> LegalConsultation:
    tenant = TenantContext.get_current_tenant()
    if not tenant:
        raise ValueError("Se requiere un tenant activo para consultar la biblioteca legal")

    cleaned_question = question.strip()
    cleaned_context = (context or "").strip()

    references = _fetch_candidate_sources(
        query=cleaned_question,
        ley=ley,
        source_type=source_type,
        authority=authority,
        ordenamiento=ordenamiento,
        only_current=only_current,
        limit=max_refs,
    )
    used_non_current_support = False
    if not references and only_current:
        references = _fetch_candidate_sources(
            query=cleaned_question,
            ley=ley,
            source_type=source_type,
            authority=authority,
            ordenamiento=ordenamiento,
            only_current=False,
            limit=max_refs,
        )
        used_non_current_support = bool(references)

    context_block = cleaned_context or "Sin contexto operativo adicional"
    consultation_focus = _detect_legal_consultation_focus(
        question=cleaned_question,
        context_block=context_block,
        references=references,
    )
    references_block = _build_reference_prompt_block(references)
    payload = [
        _reference_payload(
            ref,
            focus=consultation_focus,
            query_text=f"{cleaned_question} {context_block}",
        )
        for ref in references
    ]

    system_prompt = (
        "Eres una asesora legal fiscal mexicana de alto nivel. Tu objetivo es proporcionar un análisis "
        "altamente específico y personalizado. DEBES considerar y mencionar los detalles del 'Contexto operativo' "
        "proporcionado por el usuario para que la respuesta no sea genérica. Cita siempre las referencias "
        "como [Ref #]. Si la normativa es ambigua, ofrece alternativas basadas en el contexto. "
        "Empieza siempre con una sección '## 0. Conclusión Ejecutiva' con tres viñetas: postura, nivel de sustento y acción inmediata."
    )
    user_prompt = (
        f"Pregunta: {cleaned_question}\n"
        f"Contexto operativo: {context_block}\n\n"
        f"Tipo de consulta detectado: {consultation_focus}\n\n"
        "Referencias disponibles:\n"
        + references_block
    )

    # Integración con NotebookLM MCP & Motor de Consulta
    answer_text = ""
    model_name = "materialidad-expert-engine"

    # Verificamos si tenemos llaves para IA Real
    gemini_key = getattr(settings, "GEMINI_API_KEY", None)
    openai_key = getattr(settings, "OPENAI_API_KEY", None)
    ai_provider = getattr(settings, "AI_PROVIDER", "openai").lower()

    try:
        if gemini_key and ai_provider == "gemini":
            # 1. MODO GEMINI (Notebook Context)
            client = get_ai_client(tenant)  # usa key del tenant si la tiene, sino settings
            
            # Cargamos el contenido del notebook como contexto masivo
            notebook_path = "/home/gaibarra/materialidad/docs/fuentes/contenido_notebook.txt"
            notebook_content = ""
            try:
                import os
                if os.path.exists(notebook_path):
                    with open(notebook_path, "r", encoding="utf-8") as f:
                        notebook_content = f.read(750000) # Límite de 750k caracteres para evitar exceder cuota de tokens
                else:
                    logger.warning(f"Archivo de notebook no encontrado en {notebook_path}")
            except Exception as e:
                logger.error(f"Error leyendo notebook: {e}")

            system_prompt = (
                "Eres un Socio Senior de una firma fiscal líder en México, experto en materialidad y cumplimiento.\n"
                "Tienes acceso a un COMPENDIO DE NORMATIVIDAD FISCAL detallado que se te proporciona a continuación.\n"
                "Tu objetivo es dar una respuesta técnica, precisa y accionable basada estrictamente en este conocimiento y en el contexto del cliente.\n\n"
                "INSTRUCCIONES DE FORMATO:\n"
                "1. Usa Markdown con títulos descriptivos.\n"
                "2. Abre siempre con '## 0. Conclusión Ejecutiva' e incluye tres bullets: postura, nivel de sustento y acción inmediata.\n"
                "3. Cita específicamente leyes y artículos mencionados en el compendio.\n"
                "4. Divide el resto de tu respuesta en: Análisis Normativo, Aplicación al Caso, Riesgos Identificados y Pasos a Seguir.\n"
                "5. Si el compendio no contiene la información, indícalo claramente.\n\n"
                f"--- COMPENDIO DE NORMATIVIDAD FISCAL ---\n{notebook_content}\n--- FIN DEL COMPENDIO ---"
            )

            answer_text = client.generate_text(
                [
                    ChatMessage(role="system", content=system_prompt),
                    ChatMessage(role="user", content=(
                        f"PREGUNTA DEL CLIENTE: {cleaned_question}\n\n"
                        f"CONTEXTO OPERATIVO: {cleaned_context or 'Sin contexto adicional proporcionado.'}\n\n"
                        f"TIPO DE CONSULTA DETECTADO: {consultation_focus}\n\n"
                        f"REFERENCIAS PRIORIZADAS:\n{references_block}"
                    )),
                ],
                temperature=0.1,
                max_output_tokens=3000,
            )
            model_name = f"{client.model_name} (Notebook Context)"

        elif openai_key:
            # 2. MODO OPENAI: consulta real con GPT
            client = get_ai_client(tenant)
            model_name = client.model_name

            system_prompt = (
                "Eres un Socio Senior de una firma fiscal mexicana especializada exclusivamente en empresas del SECTOR PRIVADO.\n\n"
                "CONTEXTO DE TU CLIENTE:\n"
                "- Siempre es una empresa privada: persona moral (SA de CV, SAPI, AC, SC) o persona física con actividad empresarial.\n"
                "- NUNCA es una entidad de gobierno, dependencia federal, estatal o paraestatal, ni APF.\n\n"
                "INSTRUCCIONES CRÍTICAS:\n"
                "1. Si una referencia legal aplica EXCLUSIVAMENTE a entidades de gobierno o APF (ej: Art. 32-D CFF), "
                "IGNÓRALA completamente — no la menciones ni la cites.\n"
                "2. Enfócate en obligaciones y derechos del CONTRIBUYENTE PRIVADO frente al SAT.\n"
                "3. Para acreditar materialidad, orienta hacia: contratos, CFDI, nómina, evidencia operativa, "
                "bitácoras, fotografías, correos, entregables físicos y digitales.\n"
                "4. Cita las referencias como [Ref #] solo si aplican al sector privado.\n"
                "4.1. Trata como preferentes y confiables únicamente referencias marcadas como VIGENTE.\n"
                "4.2. Si no hay referencia VIGENTE suficiente, dilo explícitamente y señala la limitación.\n"
                "4.3. Si solo recibes referencias históricas o de vigencia incierta, utilízalas únicamente como contexto y advierte que no constituyen sustento definitivo.\n"
                "5. Estructura tu respuesta en:\n"
                "   ## 0. Conclusión Ejecutiva\n"
                "   - postura\n"
                "   - nivel de sustento\n"
                "   - acción inmediata\n"
                "   ## 1. Análisis Normativo\n"
                "   ## 2. Aplicación al Caso\n"
                "   ## 3. Riesgos Identificados\n"
                "   ## 4. Recomendaciones Prácticas\n\n"
                "TONO: Técnico, directo y accionable. Debe leerse como dictamen preliminar de trabajo para CFO, abogado interno o socio del despacho; nunca como chat casual."
            )
            user_prompt = (
                f"Pregunta: {question.strip()}\n"
                f"Contexto operativo: {context_block}\n\n"
                f"Tipo de consulta detectado: {consultation_focus}\n\n"
                f"Referencias disponibles:\n{references_block}"
            )

            answer_text = client.generate_text(
                [
                    ChatMessage(role="system", content=system_prompt),
                    ChatMessage(role="user", content=user_prompt),
                ],
                temperature=0.15,
                max_output_tokens=2000,
            )
        else:
            model_name = "materialidad-rag-fallback"
            answer_text = _build_structured_fallback_answer(
                question=cleaned_question,
                context_block=context_block,
                references=references,
                provider_note=(
                    "No había un proveedor IA configurado para esta consulta; se generó una respuesta estructurada con el motor determinístico del compendio."
                ),
                used_non_current_support=used_non_current_support,
            )

    except Exception as exc:
        logger.error("Error crítico en servicio de consulta legal", exc_info=exc)
        model_name = f"{model_name} (fallback)"
        answer_text = _build_structured_fallback_answer(
            question=cleaned_question,
            context_block=context_block,
            references=references,
            provider_note=(
                "El proveedor IA no respondió correctamente; se entrega una versión estructurada con base en las referencias recuperadas."
            ),
            used_non_current_support=used_non_current_support,
        )

    if not answer_text.strip():
        model_name = f"{model_name} (fallback)"
        answer_text = _build_structured_fallback_answer(
            question=cleaned_question,
            context_block=context_block,
            references=references,
            provider_note=(
                "El proveedor IA devolvió una respuesta vacía; se sustituyó por un análisis estructurado a partir del compendio recuperado."
            ),
            used_non_current_support=used_non_current_support,
        )

    consultation = LegalConsultation.objects.create(
        tenant_slug=tenant.slug,
        user=user if getattr(user, "is_authenticated", False) else None,
        question=cleaned_question,
        context=cleaned_context,
        answer=answer_text.strip(),
        references=payload,
        ai_model=model_name,
    )
    return consultation
