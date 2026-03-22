from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta

from django.conf import settings
from django.db.models import Count, Max
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import User
from materialidad.models import AuditLog, LegalConsultation

from .models import Despacho, Tenant
from .serializers import TenantSerializer
from .services import TenantProvisionError, provision_tenant, record_provision_log


class IsControlPlaneAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and (user.is_superuser or (user.is_staff and user.despacho_id)))


class IsSuperuserOnly(permissions.BasePermission):
    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.is_superuser)


class DespachoListView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsControlPlaneAdmin]

    def get(self, request):
        qs = Despacho.objects.filter(is_active=True)
        if request.user.despacho_id and not request.user.is_superuser:
            qs = qs.filter(id=request.user.despacho_id)
        data = [
            {
                "id": item.id,
                "nombre": item.nombre,
                "tipo": item.tipo,
            }
            for item in qs.order_by("nombre")
        ]
        return Response(data, status=status.HTTP_200_OK)


class TenantProvisionView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsControlPlaneAdmin]

    def get(self, request):
        limit = getattr(settings, "TENANT_FREE_LIMIT", 1)
        queryset = Tenant.objects.filter(is_active=True)
        if request.user.despacho_id:
            queryset = queryset.filter(despacho_id=request.user.despacho_id)
        active = queryset.count()
        return Response(
            {
                "active_tenants": active,
                "limit": limit,
                "has_capacity": active < limit if limit else True,
            },
            status=status.HTTP_200_OK,
        )

    def post(self, request):
        limit = getattr(settings, "TENANT_FREE_LIMIT", 1)
        queryset = Tenant.objects.filter(is_active=True)
        if request.user.despacho_id:
            queryset = queryset.filter(despacho_id=request.user.despacho_id)
        active = queryset.count()
        if limit and active >= limit:
            message = f"Has alcanzado el límite gratuito de {limit} tenants"
            record_provision_log(
                slug=request.data.get("slug", ""),
                admin_email=request.data.get("admin_email", ""),
                status="failure",
                message=message,
                initiated_by=request.user if request.user.is_authenticated else None,
                metadata={"active": active, "limit": limit},
            )
            raise ValidationError({"limit": message})

        serializer = TenantSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        payload = serializer.validated_data.copy()
        payload.pop("is_active", None)  # controlado internamente

        despacho = payload.get("despacho")
        if request.user.despacho_id and not request.user.is_superuser:
            payload["despacho"] = request.user.despacho
        elif request.user.is_superuser and not despacho:
            raise ValidationError({"despacho": "Debes indicar el despacho del cliente"})
        elif not payload.get("despacho"):
            raise ValidationError({"despacho": "No se pudo determinar el despacho"})

        try:
            tenant = provision_tenant(
                initiated_by=request.user if request.user.is_authenticated else None,
                **payload,
            )
        except TenantProvisionError as exc:
            raise ValidationError({"detail": str(exc)}) from exc

        response_data = TenantSerializer(tenant).data
        response_data.pop("db_password", None)
        response_data.pop("admin_password", None)
        return Response(response_data, status=status.HTTP_201_CREATED)


class TenantActivityMonitoringView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsSuperuserOnly]

    RANGE_MAP = {
        "24h": timedelta(hours=24),
        "7d": timedelta(days=7),
        "30d": timedelta(days=30),
    }
    LIVE_WINDOW = timedelta(minutes=5)
    RECENT_WINDOW = timedelta(hours=1)
    IDLE_WINDOW = timedelta(days=7)

    @classmethod
    def _activity_bucket(cls, last_activity, now):
        if last_activity is None:
            return "idle"
        if last_activity >= now - cls.LIVE_WINDOW:
            return "now"
        if last_activity >= now - cls.RECENT_WINDOW:
            return "recent"
        if last_activity >= now - timedelta(hours=24):
            return "today"
        if last_activity >= now - cls.IDLE_WINDOW:
            return "week"
        return "stale"

    @classmethod
    def _health_for_tenant(cls, *, tenant_active, error_rate, activity_bucket):
        if not tenant_active:
            return "critical", "Cuenta deshabilitada"
        if error_rate >= 10:
            return "critical", "Error rate elevado en la ventana seleccionada"
        if error_rate >= 3:
            return "warning", "Error rate por encima del umbral de atención"
        if activity_bucket in {"idle", "stale"}:
            return "warning", "Sin actividad reciente"
        if activity_bucket in {"now", "recent", "today", "week"}:
            return "ok", "Actividad registrada dentro de la ventana esperada"
        return "idle", "Sin actividad registrada"

    def get(self, request):
        range_key = (request.query_params.get("range") or "7d").lower()
        if range_key not in self.RANGE_MAP:
            raise ValidationError({"range": "Valor inválido. Usa: 24h, 7d o 30d"})

        now = timezone.now()
        window_start = now - self.RANGE_MAP[range_key]
        day_start = now - timedelta(hours=24)

        tenants = list(Tenant.objects.select_related("despacho").order_by("name"))
        if not tenants:
            return Response(
                {
                    "range": range_key,
                    "generated_at": now.isoformat(),
                    "summary": {
                        "tenants_total": 0,
                        "tenants_enabled": 0,
                        "tenants_disabled": 0,
                        "tenants_active_now": 0,
                        "tenants_active_1h": 0,
                        "tenants_active_24h": 0,
                        "tenants_active_window": 0,
                        "tenants_idle_7d": 0,
                        "tenants_warning": 0,
                        "tenants_critical": 0,
                        "users_total": 0,
                        "users_active_now": 0,
                        "users_active_24h": 0,
                        "events_24h": 0,
                        "events_window": 0,
                        "legal_consultations_24h": 0,
                        "legal_consultations_window": 0,
                        "error_events_window": 0,
                    },
                    "activity_windows": {
                        "live_minutes": int(self.LIVE_WINDOW.total_seconds() // 60),
                        "recent_minutes": int(self.RECENT_WINDOW.total_seconds() // 60),
                        "idle_days": int(self.IDLE_WINDOW.total_seconds() // 86400),
                    },
                    "tenants": [],
                },
                status=status.HTTP_200_OK,
            )

        tenant_ids = [tenant.id for tenant in tenants]
        tenant_slugs = [tenant.slug for tenant in tenants]

        users_qs = User.objects.filter(tenant_id__in=tenant_ids)
        users_total = {
            item["tenant_id"]: item["total"]
            for item in users_qs.values("tenant_id").annotate(total=Count("id"))
        }
        users_active_24h = {
            item["tenant_id"]: item["total"]
            for item in users_qs.filter(last_login__gte=day_start).values("tenant_id").annotate(total=Count("id"))
        }
        live_start = now - self.LIVE_WINDOW
        recent_start = now - self.RECENT_WINDOW
        users_active_now = {
            item["tenant_id"]: item["total"]
            for item in users_qs.filter(last_login__gte=live_start).values("tenant_id").annotate(total=Count("id"))
        }
        users_active_1h = {
            item["tenant_id"]: item["total"]
            for item in users_qs.filter(last_login__gte=recent_start).values("tenant_id").annotate(total=Count("id"))
        }

        last_login_by_tenant = {
            item["tenant_id"]: item["last_login"]
            for item in users_qs.values("tenant_id").annotate(last_login=Max("last_login"))
        }

        user_to_tenant = {
            item["id"]: item["tenant_id"]
            for item in users_qs.values("id", "tenant_id")
            if item["tenant_id"] is not None
        }

        legal_window = {
            item["tenant_slug"]: item["total"]
            for item in LegalConsultation.objects.filter(
                tenant_slug__in=tenant_slugs,
                created_at__gte=window_start,
            )
            .values("tenant_slug")
            .annotate(total=Count("id"))
        }
        legal_24h = {
            item["tenant_slug"]: item["total"]
            for item in LegalConsultation.objects.filter(
                tenant_slug__in=tenant_slugs,
                created_at__gte=day_start,
            )
            .values("tenant_slug")
            .annotate(total=Count("id"))
        }
        legal_last_by_tenant = {
            item["tenant_slug"]: item["last_created_at"]
            for item in LegalConsultation.objects.filter(tenant_slug__in=tenant_slugs)
            .values("tenant_slug")
            .annotate(last_created_at=Max("created_at"))
        }

        events_window_by_tenant: dict[int, int] = defaultdict(int)
        events_24h_by_tenant: dict[int, int] = defaultdict(int)
        error_window_by_tenant: dict[int, int] = defaultdict(int)
        audit_last_by_tenant: dict[int, datetime] = {}

        for row in AuditLog.objects.filter(created_at__gte=window_start).values("actor_id", "action", "created_at"):
            tenant_id = user_to_tenant.get(row["actor_id"])
            if not tenant_id:
                continue
            events_window_by_tenant[tenant_id] += 1
            if row["created_at"] >= day_start:
                events_24h_by_tenant[tenant_id] += 1
            action = (row.get("action") or "").lower()
            if "error" in action or "fail" in action:
                error_window_by_tenant[tenant_id] += 1
            current_last = audit_last_by_tenant.get(tenant_id)
            if current_last is None or row["created_at"] > current_last:
                audit_last_by_tenant[tenant_id] = row["created_at"]

        tenant_rows: list[dict] = []
        summary_events = 0
        summary_events_24h = 0
        summary_legal = 0
        summary_legal_24h = 0
        summary_errors = 0
        active_tenants = 0
        active_tenants_now = 0
        active_tenants_1h = 0
        active_tenants_24h = 0
        idle_tenants_7d = 0
        warning_tenants = 0
        critical_tenants = 0
        disabled_tenants = 0
        users_total_summary = 0
        users_active_now_summary = 0
        users_active_24h_summary = 0

        for tenant in tenants:
            tenant_id = tenant.id
            tenant_slug = tenant.slug

            tenant_events_window = events_window_by_tenant.get(tenant_id, 0)
            tenant_events_24h = events_24h_by_tenant.get(tenant_id, 0)
            tenant_legal_window = legal_window.get(tenant_slug, 0)
            tenant_legal_24h = legal_24h.get(tenant_slug, 0)
            tenant_errors_window = error_window_by_tenant.get(tenant_id, 0)
            tenant_users_total = users_total.get(tenant_id, 0)
            tenant_users_active_now = users_active_now.get(tenant_id, 0)
            tenant_users_active_1h = users_active_1h.get(tenant_id, 0)
            tenant_users_active_24h = users_active_24h.get(tenant_id, 0)

            event_base = max(tenant_events_window, 1)
            error_rate = round((tenant_errors_window / event_base) * 100, 2)

            last_activity = max(
                [
                    value
                    for value in (
                        last_login_by_tenant.get(tenant_id),
                        legal_last_by_tenant.get(tenant_slug),
                        audit_last_by_tenant.get(tenant_id),
                    )
                    if value is not None
                ],
                default=None,
            )

            activity_bucket = self._activity_bucket(last_activity, now)
            has_window_activity = last_activity is not None and last_activity >= window_start
            if has_window_activity:
                active_tenants += 1
            if activity_bucket == "now":
                active_tenants_now += 1
            if activity_bucket in {"now", "recent"}:
                active_tenants_1h += 1
            if activity_bucket in {"now", "recent", "today"}:
                active_tenants_24h += 1
            if activity_bucket in {"idle", "stale"}:
                idle_tenants_7d += 1
            if not tenant.is_active:
                disabled_tenants += 1

            health_status, health_reason = self._health_for_tenant(
                tenant_active=tenant.is_active,
                error_rate=error_rate,
                activity_bucket=activity_bucket,
            )
            if health_status == "critical":
                critical_tenants += 1
            elif health_status == "warning":
                warning_tenants += 1

            summary_events += tenant_events_window
            summary_events_24h += tenant_events_24h
            summary_legal += tenant_legal_window
            summary_legal_24h += tenant_legal_24h
            summary_errors += tenant_errors_window
            users_total_summary += tenant_users_total
            users_active_now_summary += tenant_users_active_now
            users_active_24h_summary += tenant_users_active_24h

            tenant_rows.append(
                {
                    "tenant_id": tenant_id,
                    "tenant_slug": tenant_slug,
                    "tenant_name": tenant.name,
                    "despacho": tenant.despacho.nombre if tenant.despacho_id else None,
                    "is_active": tenant.is_active,
                    "last_activity_at": last_activity.isoformat() if last_activity else None,
                    "last_login_at": last_login_by_tenant.get(tenant_id).isoformat() if last_login_by_tenant.get(tenant_id) else None,
                    "last_legal_consultation_at": legal_last_by_tenant.get(tenant_slug).isoformat() if legal_last_by_tenant.get(tenant_slug) else None,
                    "last_audit_event_at": audit_last_by_tenant.get(tenant_id).isoformat() if audit_last_by_tenant.get(tenant_id) else None,
                    "users_total": tenant_users_total,
                    "users_active_now": tenant_users_active_now,
                    "users_active_1h": tenant_users_active_1h,
                    "users_active_24h": tenant_users_active_24h,
                    "events_24h": tenant_events_24h,
                    "events_window": tenant_events_window,
                    "legal_consultations_24h": tenant_legal_24h,
                    "legal_consultations_window": tenant_legal_window,
                    "error_events_window": tenant_errors_window,
                    "error_rate": error_rate,
                    "activity_bucket": activity_bucket,
                    "health_status": health_status,
                    "health_reason": health_reason,
                }
            )

        tenant_rows.sort(
            key=lambda row: (
                row["health_status"] != "critical",
                row["health_status"] != "warning",
                row["activity_bucket"] not in {"idle", "stale"},
                -(row["events_window"] + row["legal_consultations_window"]),
            )
        )

        return Response(
            {
                "range": range_key,
                "generated_at": now.isoformat(),
                "summary": {
                    "tenants_total": len(tenants),
                    "tenants_enabled": len(tenants) - disabled_tenants,
                    "tenants_disabled": disabled_tenants,
                    "tenants_active_now": active_tenants_now,
                    "tenants_active_1h": active_tenants_1h,
                    "tenants_active_24h": active_tenants_24h,
                    "tenants_active_window": active_tenants,
                    "tenants_idle_7d": idle_tenants_7d,
                    "tenants_warning": warning_tenants,
                    "tenants_critical": critical_tenants,
                    "users_total": users_total_summary,
                    "users_active_now": users_active_now_summary,
                    "users_active_24h": users_active_24h_summary,
                    "events_24h": summary_events_24h,
                    "events_window": summary_events,
                    "legal_consultations_24h": summary_legal_24h,
                    "legal_consultations_window": summary_legal,
                    "error_events_window": summary_errors,
                },
                "activity_windows": {
                    "live_minutes": int(self.LIVE_WINDOW.total_seconds() // 60),
                    "recent_minutes": int(self.RECENT_WINDOW.total_seconds() // 60),
                    "idle_days": int(self.IDLE_WINDOW.total_seconds() // 86400),
                },
                "tenants": tenant_rows,
            },
            status=status.HTTP_200_OK,
        )
