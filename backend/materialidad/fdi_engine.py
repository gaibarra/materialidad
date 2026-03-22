from __future__ import annotations

from typing import Any, Final, Mapping

FORMULA_VERSION: Final[str] = "fdi-v1"
PIPELINE_VERSION: Final[str] = "pipeline-v1"

LEGACY_PUBLIC_FDI_WEIGHTS: Final[dict[str, float]] = {
    "DM": 0.28,
    "SE": 0.22,
    "SC": 0.18,
    "EC": 0.20,
    "DO": 0.12,
}

FDI_DIMENSION_WEIGHTS: Final[dict[str, float]] = {
    "DM": 0.28,
    "SE": 0.24,
    "SC": 0.18,
    "EC": 0.18,
    "DO": 0.12,
}

FDI_CONFIDENCE_WEIGHTS: Final[dict[str, float]] = {
    "UC": 0.35,
    "CQ": 0.25,
    "FQ": 0.25,
    "IQ": 0.15,
}


def percent(part: int, total: int) -> float:
    if not total:
        return 0.0
    return round((part / total) * 100, 1)


def clamp_score(value: float, min_value: float = 0.0, max_value: float = 100.0) -> float:
    return max(min_value, min(max_value, round(value, 1)))


def legacy_fdi_level(score: float, *, has_universe: bool) -> str:
    if not has_universe:
        return "NO_DATA"
    if score >= 80:
        return "ROBUSTO"
    if score >= 60:
        return "CONTROLADO"
    if score >= 40:
        return "DEBIL"
    return "CRITICO"


def commercial_fdi_level(score: float) -> str:
    if score >= 85:
        return "BLINDADO"
    if score >= 70:
        return "CONTROLADO"
    if score >= 55:
        return "EXPUESTO"
    return "CRITICO"


def fdi_actions(
    *,
    score: float,
    dm: float,
    se: float,
    sc: float,
    ec: float,
    do: float,
    has_universe: bool,
) -> list[dict[str, str]]:
    if not has_universe:
        return [
            {
                "priority": "info",
                "title": "Sin universo suficiente",
                "description": "Registra operaciones y expedientes para activar un FDI defendible.",
            }
        ]

    actions: list[dict[str, str]] = []
    if score < 40:
        actions.append(
            {
                "priority": "critical",
                "title": "Comité fiscal inmediato",
                "description": "Escalar revisión de alertas críticas, 69-B y proveedores con presión CSD.",
            }
        )
    if dm < 70:
        actions.append(
            {
                "priority": "high",
                "title": "Cerrar faltantes documentales",
                "description": "Completar contrato, CFDI, soporte de pago y razón de negocio en operaciones críticas.",
            }
        )
    if se < 70:
        actions.append(
            {
                "priority": "high",
                "title": "Fortalecer sustancia económica",
                "description": "Concluir aprobaciones de razón de negocio y validación de evidencia sustantiva.",
            }
        )
    if sc < 75:
        actions.append(
            {
                "priority": "medium",
                "title": "Regularizar soporte contractual",
                "description": "Actualizar contratos vencidos o pendientes de fecha cierta.",
            }
        )
    if ec > 35:
        actions.append(
            {
                "priority": "critical",
                "title": "Reducir exposición crítica",
                "description": "Priorizar proveedores de riesgo alto y alertas activas para contener contingencia.",
            }
        )
    if do < 70:
        actions.append(
            {
                "priority": "medium",
                "title": "Recuperar disciplina operativa",
                "description": "Actualizar validación SAT y resolver expedientes pendientes antes de cierre.",
            }
        )

    if not actions:
        actions.append(
            {
                "priority": "info",
                "title": "Sostener disciplina",
                "description": "Mantener monitoreo preventivo y trazabilidad documental continua.",
            }
        )

    return actions[:5]


def compute_legacy_public_score(*, dm: float, se: float, sc: float, ec: float, do: float, has_universe: bool) -> float:
    if not has_universe:
        return 0.0

    weights = LEGACY_PUBLIC_FDI_WEIGHTS
    return clamp_score(
        (weights["DM"] * dm)
        + (weights["SE"] * se)
        + (weights["SC"] * sc)
        + (weights["EC"] * (100 - ec))
        + (weights["DO"] * do)
    )


def build_internal_fdi_payload(
    *,
    generated_at: str,
    days: int,
    period_from: str | None,
    period_to: str | None,
    empresa_id: int | None,
    has_universe: bool,
    breakdown: Mapping[str, float],
    inputs: Mapping[str, Any],
    actions: list[dict[str, str]],
    confidence_score: float | None = None,
    trace: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    score = compute_legacy_public_score(
        dm=float(breakdown.get("DM", 0.0) or 0.0),
        se=float(breakdown.get("SE", 0.0) or 0.0),
        sc=float(breakdown.get("SC", 0.0) or 0.0),
        ec=float(breakdown.get("EC", 0.0) or 0.0),
        do=float(breakdown.get("DO", 0.0) or 0.0),
        has_universe=has_universe,
    )
    level = legacy_fdi_level(score, has_universe=has_universe)

    payload = {
        "generated_at": generated_at,
        "period": {
            "days": days,
            "from": period_from,
            "to": period_to,
            "empresa_id": empresa_id,
        },
        "score": score,
        "level": level,
        "weights": dict(LEGACY_PUBLIC_FDI_WEIGHTS),
        "breakdown": {
            "DM": float(breakdown.get("DM", 0.0) or 0.0),
            "SE": float(breakdown.get("SE", 0.0) or 0.0),
            "SC": float(breakdown.get("SC", 0.0) or 0.0),
            "EC": float(breakdown.get("EC", 0.0) or 0.0),
            "DO": float(breakdown.get("DO", 0.0) or 0.0),
        },
        "inputs": dict(inputs),
        "actions": list(actions),
        "summary": "Sin datos suficientes para calcular FDI" if not has_universe else f"FDI {score} ({level}) en ventana de {days} dias",
        "meta": {
            "formula_version": FORMULA_VERSION,
            "pipeline_version": PIPELINE_VERSION,
            "score_mode": "legacy_public",
            "has_universe": has_universe,
        },
    }
    if confidence_score is not None:
        payload["confidence"] = {
            "score": clamp_score(confidence_score),
        }
    if trace:
        payload["trace"] = dict(trace)
    return payload


def export_public_fdi_payload(internal_payload: Mapping[str, Any]) -> dict[str, Any]:
    payload = {
        "generated_at": str(internal_payload.get("generated_at") or ""),
        "period": dict(internal_payload.get("period") or {}),
        "score": float(internal_payload.get("score", 0.0) or 0.0),
        "level": str(internal_payload.get("level") or "NO_DATA"),
        "weights": dict(internal_payload.get("weights") or LEGACY_PUBLIC_FDI_WEIGHTS),
        "breakdown": dict(internal_payload.get("breakdown") or {}),
        "inputs": dict(internal_payload.get("inputs") or {}),
        "actions": list(internal_payload.get("actions") or []),
        "summary": str(internal_payload.get("summary") or ""),
    }
    confidence = internal_payload.get("confidence")
    if isinstance(confidence, Mapping):
        payload["confidence"] = dict(confidence)
    trace = internal_payload.get("trace")
    if isinstance(trace, Mapping):
        payload["trace"] = dict(trace)
    return payload


def serialize_fdi_snapshot_payload(snapshot: Any, *, days: int) -> dict[str, Any]:
    return export_public_fdi_payload(
        {
            "generated_at": snapshot.captured_at.isoformat(),
            "period": {
                "days": days,
                "from": snapshot.period_start.isoformat(),
                "to": snapshot.period_end.isoformat(),
                "empresa_id": snapshot.empresa_id,
            },
            "score": float(snapshot.score),
            "level": str(snapshot.level),
            "weights": dict(LEGACY_PUBLIC_FDI_WEIGHTS),
            "breakdown": {
                "DM": float(snapshot.dm),
                "SE": float(snapshot.se),
                "SC": float(snapshot.sc),
                "EC": float(snapshot.ec),
                "DO": float(snapshot.do),
            },
            "inputs": snapshot.inputs_json or {},
            "actions": snapshot.actions_json or [],
            "summary": f"FDI {float(snapshot.score):.1f} ({snapshot.level}) desde snapshot reciente",
            "confidence": {
                "score": float(getattr(snapshot, "confidence_score", 0.0) or 0.0),
            },
            "trace": {
                "correlation_id": str(getattr(snapshot, "correlation_id", "") or "") or None,
                "formula_version": str(getattr(snapshot, "formula_version", "") or ""),
                "pipeline_version": str(getattr(snapshot, "pipeline_version", "") or ""),
            },
        }
    )


def confidence_base(
    *,
    universe_coverage: float,
    completeness_quality: float,
    freshness_quality: float,
    input_integrity: float,
) -> float:
    weights = FDI_CONFIDENCE_WEIGHTS
    return clamp_score(
        (weights["UC"] * universe_coverage)
        + (weights["CQ"] * completeness_quality)
        + (weights["FQ"] * freshness_quality)
        + (weights["IQ"] * input_integrity)
    )


def confidence_coverage_cap(universe_coverage: float) -> float:
    if universe_coverage < 40:
        return 55.0
    if universe_coverage < 60:
        return 70.0
    if universe_coverage < 80:
        return 85.0
    return 100.0


def confidence_integrity_cap(input_integrity: float) -> float:
    if input_integrity < 50:
        return 60.0
    if input_integrity < 70:
        return 80.0
    return 100.0


def compute_fdi_confidence(
    *,
    universe_coverage: float,
    completeness_quality: float,
    freshness_quality: float,
    input_integrity: float,
) -> dict[str, float]:
    base = confidence_base(
        universe_coverage=universe_coverage,
        completeness_quality=completeness_quality,
        freshness_quality=freshness_quality,
        input_integrity=input_integrity,
    )
    coverage_cap = confidence_coverage_cap(universe_coverage)
    integrity_cap = confidence_integrity_cap(input_integrity)
    return {
        "score": min(base, coverage_cap, integrity_cap),
        "base": base,
        "coverage_cap": coverage_cap,
        "integrity_cap": integrity_cap,
    }