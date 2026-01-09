from __future__ import annotations

from django.conf import settings
from rest_framework import permissions, status
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Despacho, Tenant
from .serializers import TenantSerializer
from .services import TenantProvisionError, provision_tenant, record_provision_log


class IsControlPlaneAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and (user.is_superuser or (user.is_staff and not user.tenant_id))
        )


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
