from __future__ import annotations

from rest_framework import permissions, status, viewsets
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from tenancy.models import TenantAIConfig

from .models import User
from .serializers import (
    TenantAIConfigSerializer,
    TenantTokenObtainPairSerializer,
    UserAdminSerializer,
    UserSerializer,
)


class TenantTokenObtainPairView(TokenObtainPairView):
    serializer_class = TenantTokenObtainPairSerializer


class TenantTokenRefreshView(TokenRefreshView):
    pass


class AccountMeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data, status=status.HTTP_200_OK)


class IsTenantStaff(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_staff)


class UserViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated, IsTenantStaff]
    serializer_class = UserAdminSerializer
    queryset = User.objects.select_related("tenant").all()
    http_method_names = ["get", "post", "patch", "put", "delete"]

    def _get_tenant(self):
        tenant = getattr(self.request, "tenant", None)
        if tenant is None:
            raise ValidationError({"tenant": "Debes enviar el encabezado X-Tenant"})
        if self.request.user.tenant_id and self.request.user.tenant_id != tenant.id:
            raise PermissionDenied("No puedes administrar usuarios de otro tenant")
        return tenant

    def get_queryset(self):
        tenant = getattr(self.request, "tenant", None)
        if not tenant:
            return User.objects.none()
        return (
            User.objects.filter(tenant=tenant)
            .order_by("full_name", "email")
            .select_related("tenant")
        )

    def perform_create(self, serializer):
        tenant = self._get_tenant()
        serializer.save(tenant=tenant)

    def perform_update(self, serializer):
        tenant = self._get_tenant()
        serializer.save(tenant=tenant)


class TenantAIConfigView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsTenantStaff]

    def get_object(self, tenant):
        config, _ = TenantAIConfig.objects.get_or_create(tenant=tenant)
        return config

    def get(self, request):
        tenant = getattr(request, "tenant", None)
        if not tenant:
            raise ValidationError({"tenant": "Debes enviar el encabezado X-Tenant"})
        serializer = TenantAIConfigSerializer(self.get_object(tenant))
        return Response(serializer.data, status=status.HTTP_200_OK)

    def put(self, request):
        tenant = getattr(request, "tenant", None)
        if not tenant:
            raise ValidationError({"tenant": "Debes enviar el encabezado X-Tenant"})
        config = self.get_object(tenant)
        serializer = TenantAIConfigSerializer(config, data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_200_OK)
