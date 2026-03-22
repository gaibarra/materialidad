import logging
import base64
import hashlib
import json
import time
from datetime import datetime, timedelta
from decimal import Decimal
from django.db.models import Sum, Q, F
from django.core.cache import cache
from django.utils import timezone
from rest_framework import views, permissions, status
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from tenancy.context import TenantContext
from materialidad.fdi_engine import build_internal_fdi_payload, export_public_fdi_payload, serialize_fdi_snapshot_payload
from materialidad.services import (
    build_pending_fdi_narrative,
    generate_fdi_narrative,
    get_persisted_fdi_narrative,
    persist_fdi_narrative,
    persist_fdi_snapshot,
    serialize_fdi_narrative,
)
from materialidad.models import (
    Empresa,
    Operacion,
    Contrato,
    Proveedor,
    AlertaCSD,
    DashboardSnapshot,
    FDIJobRun,
    FiscalDefenseIndexSnapshot,
    TipoAlertaCSD,
    EstatusAlertaCSD,
)

logger = logging.getLogger(__name__)

SUMMARY_CACHE_TTL_SECONDS = 60
FDI_CACHE_TTL_SECONDS = 60
FDI_HISTORY_CACHE_TTL_SECONDS = 300
FDI_NARRATIVE_CACHE_TTL_SECONDS = 120
FDI_JOB_RUN_HISTORY_CACHE_TTL_SECONDS = 120
RECENT_FDI_SNAPSHOT_MAX_AGE = timedelta(minutes=90)


def _cache_key(prefix: str, tenant_slug: str, payload: dict) -> str:
    raw = json.dumps(payload, sort_keys=True, default=str)
    digest = hashlib.sha1(raw.encode("utf-8")).hexdigest()
    return f"dashboard:{prefix}:{tenant_slug}:{digest}"


def _tenant_slug_for_cache() -> str:
    tenant = TenantContext.get_current_tenant()
    return tenant.slug if tenant else "global"


def _serialize_fdi_snapshot(snapshot: FiscalDefenseIndexSnapshot, *, days: int) -> dict:
    return serialize_fdi_snapshot_payload(snapshot, days=days)


def _snapshot_matches_request(snapshot: FiscalDefenseIndexSnapshot, *, days: int, empresa_id: int | None) -> bool:
    if snapshot.empresa_id != empresa_id:
        return False

    snapshot_days = (snapshot.period_end - snapshot.period_start).days + 1
    return abs(snapshot_days - days) <= 1


def _build_missing_snapshot_payload(*, days: int, empresa_id: int | None) -> dict:
    today = timezone.localdate()
    start_date = today - timedelta(days=max(days - 1, 0))
    return export_public_fdi_payload(
        build_internal_fdi_payload(
            generated_at=timezone.now().isoformat(),
            days=days,
            period_from=start_date.isoformat(),
            period_to=today.isoformat(),
            empresa_id=empresa_id,
            has_universe=False,
            breakdown={"DM": 0.0, "SE": 0.0, "SC": 0.0, "EC": 0.0, "DO": 0.0},
            inputs={"snapshot_available": False},
            actions=[
                {
                    "priority": "info",
                    "title": "Snapshot FDI no disponible",
                    "description": "Genera un snapshot persistido para consultar el FDI del periodo solicitado.",
                }
            ],
            confidence_score=0.0,
            trace={
                "correlation_id": None,
                "formula_version": "",
                "pipeline_version": "",
                "source": "snapshot_missing",
            },
        )
    )


def _can_recalculate_fdi(user) -> bool:
    return bool(getattr(user, "is_staff", False) or getattr(user, "is_superuser", False))


def _encode_job_run_cursor(*, started_at: datetime, run_id: int) -> str:
    raw = json.dumps({"started_at": started_at.isoformat(), "id": run_id}, sort_keys=True)
    return base64.urlsafe_b64encode(raw.encode("utf-8")).decode("ascii")


def _decode_job_run_cursor(cursor: str) -> tuple[datetime, int]:
    try:
        decoded = base64.urlsafe_b64decode(cursor.encode("ascii")).decode("utf-8")
        payload = json.loads(decoded)
        started_at = datetime.fromisoformat(str(payload["started_at"]))
        run_id = int(payload["id"])
    except (ValueError, TypeError, KeyError, json.JSONDecodeError):
        raise ValueError("Cursor inválido")
    return started_at, run_id


def _resolve_fdi_payload(*, days: int, empresa_id: int | None, recalculate: bool = False) -> tuple[dict, str]:
    tenant = TenantContext.get_current_tenant()
    if tenant is None:
        return _build_missing_snapshot_payload(days=days, empresa_id=empresa_id), "snapshot_missing"

    if recalculate:
        snapshot = persist_fdi_snapshot(days=days, empresa_id=empresa_id, source="api_recalculate")
        return _serialize_fdi_snapshot(snapshot, days=days), "snapshot_recalculated"

    snapshot_qs = FiscalDefenseIndexSnapshot.objects.filter(tenant_slug=tenant.slug)
    if empresa_id is not None:
        snapshot_qs = snapshot_qs.filter(empresa_id=empresa_id)
    for snapshot in snapshot_qs.order_by("-captured_at"):
        if _snapshot_matches_request(snapshot, days=days, empresa_id=empresa_id):
            return _serialize_fdi_snapshot(snapshot, days=days), "snapshot"

    return _build_missing_snapshot_payload(days=days, empresa_id=empresa_id), "snapshot_missing"

class ExecutiveDashboardSummaryView(views.APIView):
    """
    Unified endpoint for the Executive Dashboard phase 2.
    Returns:
    - active_alerts (Arts 69-B, CSD)
    - protected_value (Sum of CFDI shielded by the platform)
    - csd_risk_score (0-100 indicating risk exposure)
    - materiality_coverage (Percentage of operations with valid dossiers)
    - intangibles_valuation (Phase 1 placeholder/base calc)
    """
    
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, *args, **kwargs):
        started = time.perf_counter()
        tenant_slug = _tenant_slug_for_cache()
        cache_key = _cache_key(
            "executive_summary",
            tenant_slug,
            {
                "path": request.path,
                "query": sorted(request.query_params.items()),
            },
        )
        cached_payload = cache.get(cache_key)
        if cached_payload is not None:
            elapsed_ms = (time.perf_counter() - started) * 1000
            logger.info("dashboard.executive_summary tenant=%s cache=hit duration_ms=%.1f", tenant_slug, elapsed_ms)
            return Response(cached_payload, status=status.HTTP_200_OK)

        # En una arquitectura multi-tenant real de este SaaS asumo 
        # que el tenant viene en el request (ej. request.tenant o request.user.empresa_activa)
        # Para mantener el query acotado asumimos que leemos todas las empresas 
        # a las que tiene acceso el usuario, o la primera empresa activa.
        
        # Filtro base:
        user = request.user
        # Por ahora tomamos todas las empresas, ajusta a `request.tenant` si existe un middleware
        empresas = Empresa.objects.filter(activo=True)
        if not empresas.exists():
            # Return empty payload so dashboard doesn't break
            now = timezone.now()
            payload = {
                "active_alerts": [],
                "protected_value": 0.0,
                "csd_risk_score": 0.0,
                "materiality_coverage": 0.0,
                "total_ops_count": 0,
                "validated_ops_count": 0,
                "intangibles_valuation": 0.0,
                "portfolio": [],
                "contracts_expiring": 0,
                "pending_dossiers": 0,
                "unvalidated_providers": 0,
                "active_clients_count": 0,
                "timestamp": now.isoformat()
            }
            cache.set(cache_key, payload, SUMMARY_CACHE_TTL_SECONDS)
            elapsed_ms = (time.perf_counter() - started) * 1000
            logger.info("dashboard.executive_summary tenant=%s cache=miss duration_ms=%.1f", tenant_slug, elapsed_ms)
            return Response(payload, status=status.HTTP_200_OK)

        # 1. Alertas Críticas (CSD)
        alertas_base_q = AlertaCSD.objects.filter(
            empresa__in=empresas,
            estatus__in=[EstatusAlertaCSD.ACTIVA, EstatusAlertaCSD.ACLARACION]
        ).select_related('proveedor').order_by('-fecha_deteccion')
        
        alertas_q = alertas_base_q[:5]

        active_alerts = []
        for alerta in alertas_q:
            active_alerts.append({
                "id": alerta.id,
                "type": "CSD_RISK" if alerta.tipo_alerta == TipoAlertaCSD.PROPIETARIO else "69B_RISK",
                "severity": "alert",
                "title": f"Riesgo CSD: {alerta.get_tipo_alerta_display()}",
                "message": f"Proveedor {alerta.proveedor.razon_social}" if alerta.proveedor else "Riesgo en CSD propio",
                "date": alerta.fecha_deteccion.strftime('%Y-%m-%d')
            })

        # 2. Protected Value (Ahorro Protegido)
        # Sum of 'monto' strictly of operations that have been properly validated
        protected_ops = Operacion.objects.filter(
            empresa__in=empresas,
            estatus_validacion=Operacion.EstatusValidacion.VALIDADO,
            cfdi_estatus=Operacion.EstatusCFDI.VALIDO
        ).aggregate(total_protegido=Sum('monto'))
        
        protected_value = protected_ops['total_protegido'] or Decimal('0.00')

        # 3. CSD Risk Score (Exposición a EFOS/69-B)
        # Calculado base: (Monto operado riesgoso / Monto total) * 100
        total_ops_aggr = Operacion.objects.filter(empresa__in=empresas).aggregate(total=Sum('monto'))
        monto_total = total_ops_aggr['total'] or Decimal('0.00')
        
        riesgosos_aggr = Operacion.objects.filter(
            empresa__in=empresas,
            proveedor__estatus_69b__in=[
                'PRESUNTO', 'DEFINITIVO'
            ]
        ).aggregate(total=Sum('monto'))
        monto_riesgoso = riesgosos_aggr['total'] or Decimal('0.00')

        if monto_total > 0:
            csd_risk_score = round(float((monto_riesgoso / monto_total) * 100), 1)
        else:
            csd_risk_score = 0.0

        if alertas_base_q.filter(tipo_alerta=TipoAlertaCSD.PROPIETARIO).exists():
            csd_risk_score = min(csd_risk_score + 50.0, 100.0)

        # 4. Materiality Coverage
        # Porcentaje de operaciones que tienen entregables COMPLETADOS vs el total requerido
        total_ops_count = Operacion.objects.filter(empresa__in=empresas).count()
        validated_ops_count = Operacion.objects.filter(
            empresa__in=empresas, 
            estatus_validacion=Operacion.EstatusValidacion.VALIDADO
        ).count()
        
        if total_ops_count > 0:
            materiality_coverage = round((validated_ops_count / total_ops_count) * 100, 1)
        else:
            materiality_coverage = 0.0

        # 5. Intangibles Valuation (NIF C-8)
        # Sumamos contratos de tipo 'ACTIVOS' (Propiedad Intelectual / Regalías)
        intangibles_aggr = Contrato.objects.filter(
            empresa__in=empresas,
            categoria=Contrato.Categoria.ACTIVOS,
        ).aggregate(total=Sum('beneficio_economico_esperado'))
        
        intangibles_value = intangibles_aggr['total'] or Decimal('0.00')

        # 6. Portfolio Risks (Tenant Specific)
        portfolio = []
        for empresa in empresas:
            # Montos
            e_ops_aggr = Operacion.objects.filter(empresa=empresa).aggregate(total=Sum('monto'))
            e_monto_total = e_ops_aggr['total'] or Decimal('0.00')
            
            e_riesgos_aggr = Operacion.objects.filter(
                empresa=empresa,
                proveedor__estatus_69b__in=['PRESUNTO', 'DEFINITIVO']
            ).aggregate(total=Sum('monto'))
            e_monto_riesgoso = e_riesgos_aggr['total'] or Decimal('0.00')
            
            e_risk_score = round(float((e_monto_riesgoso / e_monto_total) * 100), 1) if e_monto_total > 0 else 0.0
            
            # Missing files (Operaciones - Operaciones Validadas)
            e_ops_count = Operacion.objects.filter(empresa=empresa).count()
            e_val_count = Operacion.objects.filter(
                empresa=empresa,
                estatus_validacion=Operacion.EstatusValidacion.VALIDADO
            ).count()
            missing_files = max(e_ops_count - e_val_count, 0)
            
            portfolio.append({
                "id": empresa.id,
                "name": empresa.razon_social,
                "riskScore": float(e_risk_score),
                "missingFiles": missing_files
            })
            
        # Ordenamos los más riesgosos primero (top 15)
        portfolio = sorted(portfolio, key=lambda x: x['riskScore'], reverse=True)[:15]

        # 7. Operative Workflows (Phase 4 KPIs)
        now = timezone.now()
        thirty_days_from_now = now + timezone.timedelta(days=30)
        thirty_days_ago = now - timezone.timedelta(days=30)
        
        contracts_expiring = Contrato.objects.filter(
            empresa__in=empresas,
            activo=True,
            vigencia_fin__isnull=False,
            vigencia_fin__lte=thirty_days_from_now.date(),
            vigencia_fin__gte=now.date() # Don't count already expired ones as 'expiring'
        ).count()
        
        pending_dossiers = Operacion.objects.filter(
            empresa__in=empresas,
            estatus_validacion__in=[
                Operacion.EstatusValidacion.PENDIENTE, 
                Operacion.EstatusValidacion.EN_PROCESO
            ]
        ).count()
        
        unvalidated_providers = Proveedor.objects.filter(
            operaciones__empresa__in=empresas # Solo proveedores que tengan operaciones con estas empresas
        ).filter(
            Q(ultima_validacion_sat__isnull=True) | 
            Q(ultima_validacion_sat__lt=thirty_days_ago)
        ).distinct().count()

        payload = {
            "active_alerts": active_alerts,
            "protected_value": float(protected_value),
            "csd_risk_score": float(csd_risk_score),
            "materiality_coverage": float(materiality_coverage),
            "total_ops_count": total_ops_count,
            "validated_ops_count": validated_ops_count,
            "intangibles_valuation": float(intangibles_value),
            "portfolio": portfolio,
            "contracts_expiring": contracts_expiring,
            "pending_dossiers": pending_dossiers,
            "unvalidated_providers": unvalidated_providers,
            "active_clients_count": empresas.count(),
            "timestamp": now.isoformat()
        }

        cache.set(cache_key, payload, SUMMARY_CACHE_TTL_SECONDS)
        elapsed_ms = (time.perf_counter() - started) * 1000
        logger.info("dashboard.executive_summary tenant=%s cache=miss duration_ms=%.1f", tenant_slug, elapsed_ms)
        return Response(payload, status=status.HTTP_200_OK)


class FiscalDefenseIndexView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, *args, **kwargs):
        started = time.perf_counter()
        tenant_slug = _tenant_slug_for_cache()
        recalculate = str(request.query_params.get("recalculate", "false")).lower() in {"1", "true", "si"}
        try:
            days = int(request.query_params.get("period_days", 90))
        except (TypeError, ValueError):
            return Response(
                {"detail": "El parámetro 'period_days' debe ser numérico"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        empresa_id = request.query_params.get("empresa")
        parsed_empresa_id = None
        if empresa_id not in (None, ""):
            try:
                parsed_empresa_id = int(empresa_id)
            except (TypeError, ValueError):
                return Response(
                    {"detail": "El parámetro 'empresa' debe ser un entero válido"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        cache_key = _cache_key(
            "fdi",
            tenant_slug,
            {
                "path": request.path,
                "days": days,
                "empresa": parsed_empresa_id,
                "recalculate": str(request.query_params.get("recalculate", "false")).lower(),
            },
        )
        cached_payload = cache.get(cache_key)
        if not recalculate and cached_payload is not None:
            elapsed_ms = (time.perf_counter() - started) * 1000
            logger.info("dashboard.fdi tenant=%s cache=hit duration_ms=%.1f", tenant_slug, elapsed_ms)
            return Response(cached_payload, status=status.HTTP_200_OK)

        if recalculate and not _can_recalculate_fdi(request.user):
            raise PermissionDenied("Solo usuarios administradores pueden forzar recálculo del FDI.")
        payload, source = _resolve_fdi_payload(days=days, empresa_id=parsed_empresa_id, recalculate=recalculate)
        cache.set(cache_key, payload, FDI_CACHE_TTL_SECONDS)
        elapsed_ms = (time.perf_counter() - started) * 1000
        logger.info("dashboard.fdi tenant=%s source=%s duration_ms=%.1f", tenant_slug, source, elapsed_ms)
        return Response(payload, status=status.HTTP_200_OK)


class FiscalDefenseNarrativeView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, *args, **kwargs):
        started = time.perf_counter()
        tenant_slug = _tenant_slug_for_cache()
        audience = str(request.data.get("audience", "CFO")).upper()
        try:
            days = int(request.data.get("period_days", 90))
        except (TypeError, ValueError):
            return Response(
                {"detail": "El parámetro 'period_days' debe ser numérico"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        empresa_id = request.data.get("empresa")
        parsed_empresa_id = None
        if empresa_id not in (None, ""):
            try:
                parsed_empresa_id = int(empresa_id)
            except (TypeError, ValueError):
                return Response(
                    {"detail": "El parámetro 'empresa' debe ser un entero válido"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        cache_key = _cache_key(
            "fdi_narrative",
            tenant_slug,
            {
                "path": request.path,
                "audience": audience,
                "days": days,
                "empresa": parsed_empresa_id,
                "recalculate": str(request.data.get("recalculate", "false")).lower(),
            },
        )
        recalculate = str(request.data.get("recalculate", "false")).lower() in {"1", "true", "si"}
        cached_payload = cache.get(cache_key)
        if not recalculate and cached_payload is not None:
            elapsed_ms = (time.perf_counter() - started) * 1000
            logger.info("dashboard.fdi_narrative tenant=%s cache=hit duration_ms=%.1f", tenant_slug, elapsed_ms)
            return Response(cached_payload, status=status.HTTP_200_OK)

        if recalculate and not _can_recalculate_fdi(request.user):
            raise PermissionDenied("Solo usuarios administradores pueden forzar recálculo del FDI.")
        fdi_payload, source = _resolve_fdi_payload(days=days, empresa_id=parsed_empresa_id, recalculate=recalculate)
        persisted_narrative = None if recalculate else get_persisted_fdi_narrative(audience=audience, fdi_payload=fdi_payload)
        if persisted_narrative is not None:
            narrative = serialize_fdi_narrative(persisted_narrative)
        elif _can_recalculate_fdi(request.user):
            narrative = generate_fdi_narrative(audience=audience, fdi_payload=fdi_payload)
            persist_fdi_narrative(audience=audience, fdi_payload=fdi_payload, narrative_payload=narrative)
        else:
            narrative = build_pending_fdi_narrative(audience=audience, fdi_payload=fdi_payload)
        payload = {
            "fdi": {
                "score": fdi_payload.get("score", 0.0),
                "level": fdi_payload.get("level", "NO_DATA"),
                "generated_at": fdi_payload.get("generated_at"),
                "confidence": fdi_payload.get("confidence", {}),
                "trace": fdi_payload.get("trace", {}),
            },
            "narrative": narrative,
        }
        cache.set(cache_key, payload, FDI_NARRATIVE_CACHE_TTL_SECONDS)
        elapsed_ms = (time.perf_counter() - started) * 1000
        logger.info("dashboard.fdi_narrative tenant=%s source=%s duration_ms=%.1f", tenant_slug, source, elapsed_ms)
        return Response(payload, status=status.HTTP_200_OK)


class FiscalDefenseIndexHistoryView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, *args, **kwargs):
        started = time.perf_counter()
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
        days = max(7, min(days, 365))

        try:
            limit = int(request.query_params.get("limit", 180))
        except (TypeError, ValueError):
            return Response({"detail": "El parámetro 'limit' debe ser numérico"}, status=status.HTTP_400_BAD_REQUEST)
        limit = max(1, min(limit, 720))

        empresa_id = request.query_params.get("empresa")
        parsed_empresa_id = None
        if empresa_id not in (None, ""):
            try:
                parsed_empresa_id = int(empresa_id)
            except (TypeError, ValueError):
                return Response(
                    {"detail": "El parámetro 'empresa' debe ser un entero válido"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        cache_key = _cache_key(
            "fdi_history",
            tenant.slug,
            {
                "path": request.path,
                "days": days,
                "limit": limit,
                "empresa": parsed_empresa_id,
            },
        )
        cached_payload = cache.get(cache_key)
        if cached_payload is not None:
            elapsed_ms = (time.perf_counter() - started) * 1000
            logger.info("dashboard.fdi_history tenant=%s cache=hit duration_ms=%.1f", tenant.slug, elapsed_ms)
            return Response(cached_payload, status=status.HTTP_200_OK)

        date_to = timezone.now()
        date_from = date_to - timedelta(days=days)

        fdi_snapshots_qs = FiscalDefenseIndexSnapshot.objects.filter(tenant_slug=tenant.slug).filter(
            captured_at__gte=date_from,
            captured_at__lte=date_to,
        )
        if parsed_empresa_id is not None:
            fdi_snapshots_qs = fdi_snapshots_qs.filter(empresa_id=parsed_empresa_id)
        fdi_snapshots = list(fdi_snapshots_qs.order_by("captured_at")[:limit])

        series = []
        if fdi_snapshots:
            for snapshot in fdi_snapshots:
                series.append(
                    {
                        "captured_at": snapshot.captured_at.isoformat(),
                        "score": float(snapshot.score),
                        "level": str(snapshot.level),
                        "confidence": float(snapshot.confidence_score),
                        "correlation_id": str(snapshot.correlation_id) if snapshot.correlation_id else None,
                        "breakdown": {
                            "DM": float(snapshot.dm),
                            "SE": float(snapshot.se),
                            "SC": float(snapshot.sc),
                            "EC": float(snapshot.ec),
                            "DO": float(snapshot.do),
                        },
                    }
                )
        else:
            # Fallback de compatibilidad con snapshots legacy
            snapshots = (
                DashboardSnapshot.objects.filter(tenant_slug=tenant.slug)
                .filter(captured_at__gte=date_from, captured_at__lte=date_to)
                .order_by("captured_at")[:limit]
            )
            for snapshot in snapshots:
                payload = snapshot.payload or {}
                fdi = payload.get("fdi") if isinstance(payload, dict) else None
                if not isinstance(fdi, dict):
                    continue
                if parsed_empresa_id is not None:
                    period = fdi.get("period") if isinstance(fdi, dict) else None
                    period_empresa_id = period.get("empresa_id") if isinstance(period, dict) else None
                    if period_empresa_id != parsed_empresa_id:
                        continue
                series.append(
                    {
                        "captured_at": snapshot.captured_at.isoformat(),
                        "score": float(fdi.get("score", 0.0) or 0.0),
                        "level": str(fdi.get("level", "NO_DATA")),
                        "breakdown": fdi.get("breakdown", {}),
                    }
                )

        trend_delta = 0.0
        if len(series) >= 2:
            trend_delta = round(series[-1]["score"] - series[0]["score"], 1)

        payload = {
            "range": {
                "from": date_from.isoformat(),
                "to": date_to.isoformat(),
                "days": days,
                "limit": limit,
            },
            "series": series,
            "summary": {
                "points": len(series),
                "current_score": series[-1]["score"] if series else 0.0,
                "trend_delta": trend_delta,
            },
        }
        cache.set(cache_key, payload, FDI_HISTORY_CACHE_TTL_SECONDS)
        elapsed_ms = (time.perf_counter() - started) * 1000
        logger.info("dashboard.fdi_history tenant=%s cache=miss duration_ms=%.1f", tenant.slug, elapsed_ms)
        return Response(payload, status=status.HTTP_200_OK)


class FDIJobRunHistoryView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, *args, **kwargs):
        started = time.perf_counter()
        tenant = TenantContext.get_current_tenant()
        if not tenant:
            return Response(
                {"detail": "No se pudo resolver el tenant activo para la sesión."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not _can_recalculate_fdi(request.user):
            raise PermissionDenied("Solo usuarios administradores pueden consultar runs operativos del FDI.")

        try:
            days = int(request.query_params.get("days", 7))
        except (TypeError, ValueError):
            return Response({"detail": "El parámetro 'days' debe ser numérico"}, status=status.HTTP_400_BAD_REQUEST)
        days = max(1, min(days, 90))

        try:
            limit = int(request.query_params.get("limit", 100))
        except (TypeError, ValueError):
            return Response({"detail": "El parámetro 'limit' debe ser numérico"}, status=status.HTTP_400_BAD_REQUEST)
        limit = max(1, min(limit, 500))

        empresa_id = request.query_params.get("empresa")
        parsed_empresa_id = None
        if empresa_id not in (None, ""):
            try:
                parsed_empresa_id = int(empresa_id)
            except (TypeError, ValueError):
                return Response(
                    {"detail": "El parámetro 'empresa' debe ser un entero válido"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        command = request.query_params.get("command")
        status_filter = request.query_params.get("status")
        cursor = request.query_params.get("cursor")

        cache_key = _cache_key(
            "fdi_job_runs",
            tenant.slug,
            {
                "path": request.path,
                "days": days,
                "limit": limit,
                "empresa": parsed_empresa_id,
                "command": command,
                "status": status_filter,
                "cursor": cursor,
            },
        )
        cached_payload = cache.get(cache_key)
        if cached_payload is not None:
            elapsed_ms = (time.perf_counter() - started) * 1000
            logger.info("dashboard.fdi_job_runs tenant=%s cache=hit duration_ms=%.1f", tenant.slug, elapsed_ms)
            return Response(cached_payload, status=status.HTTP_200_OK)

        date_to = timezone.now()
        date_from = date_to - timedelta(days=days)

        runs_qs = FDIJobRun.objects.filter(
            tenant_slug=tenant.slug,
            started_at__gte=date_from,
            started_at__lte=date_to,
        ).order_by("-started_at", "-id")
        if parsed_empresa_id is not None:
            runs_qs = runs_qs.filter(empresa_id=parsed_empresa_id)
        if command:
            runs_qs = runs_qs.filter(command=command)
        if status_filter:
            runs_qs = runs_qs.filter(status=status_filter)

        if cursor:
            try:
                cursor_started_at, cursor_run_id = _decode_job_run_cursor(cursor)
            except ValueError:
                return Response({"detail": "El parámetro 'cursor' es inválido"}, status=status.HTTP_400_BAD_REQUEST)
            runs_qs = runs_qs.filter(
                Q(started_at__lt=cursor_started_at)
                | (Q(started_at=cursor_started_at) & Q(id__lt=cursor_run_id))
            )

        runs = list(runs_qs[: limit + 1])
        page_runs = runs[:limit]
        next_cursor = None
        if len(runs) > limit and page_runs:
            last_run = page_runs[-1]
            next_cursor = _encode_job_run_cursor(started_at=last_run.started_at, run_id=last_run.id)
        items = [
            {
                "id": run.id,
                "command": run.command,
                "status": run.status,
                "empresa_id": run.empresa_id,
                "days": run.days,
                "refresh_projections": run.refresh_projections,
                "projections_synced": run.projections_synced,
                "snapshots_created": run.snapshots_created,
                "snapshot_id": run.snapshot_id,
                "duration_ms": run.duration_ms,
                "error_message": run.error_message,
                "started_at": run.started_at.isoformat(),
                "finished_at": run.finished_at.isoformat(),
            }
            for run in page_runs
        ]
        failures = sum(1 for run in page_runs if run.status == FDIJobRun.Status.FAILURE)
        payload = {
            "range": {
                "from": date_from.isoformat(),
                "to": date_to.isoformat(),
                "days": days,
                "limit": limit,
            },
            "items": items,
            "pagination": {
                "has_more": next_cursor is not None,
                "next_cursor": next_cursor,
            },
            "summary": {
                "total": len(items),
                "failures": failures,
                "failure_rate": round((failures / len(items)) * 100, 1) if items else 0.0,
                "latest_status": items[0]["status"] if items else None,
                "latest_command": items[0]["command"] if items else None,
            },
        }
        cache.set(cache_key, payload, FDI_JOB_RUN_HISTORY_CACHE_TTL_SECONDS)
        elapsed_ms = (time.perf_counter() - started) * 1000
        logger.info("dashboard.fdi_job_runs tenant=%s cache=miss duration_ms=%.1f", tenant.slug, elapsed_ms)
        return Response(payload, status=status.HTTP_200_OK)
