from __future__ import annotations

from django.contrib.auth import authenticate
from rest_framework import permissions, serializers as drf_serializers, status, viewsets
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from tenancy.models import Tenant, TenantAIConfig

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


class DiscoverOrganizationsView(APIView):
    """
    POST {email, password} → returns list of organizations the user can access.
    Does NOT issue a token. Used to power the org selector at login time.
    """
    permission_classes = [permissions.AllowAny]
    throttle_scope = "login"

    def post(self, request):
        email = (request.data.get("email") or "").strip()
        password = request.data.get("password") or ""

        if not email or not password:
            return Response(
                {"detail": "Correo y contraseña son obligatorios."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = authenticate(request, email=email, password=password)
        if user is None or not user.is_active:
            return Response(
                {"detail": "Credenciales inválidas."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        # Collect tenants the user has access to
        tenant_qs = Tenant.objects.filter(is_active=True)

        if user.is_superuser:
            # Superusers see all active tenants
            tenants = list(
                tenant_qs.select_related("despacho")
                .order_by("name")
                .values("slug", "name", "despacho__nombre")
            )
        elif user.despacho_id:
            # Users with a despacho see all tenants in their despacho
            tenants = list(
                tenant_qs.filter(despacho_id=user.despacho_id)
                .select_related("despacho")
                .order_by("name")
                .values("slug", "name", "despacho__nombre")
            )
        elif user.tenant_id:
            # Users with a single tenant
            tenants = list(
                tenant_qs.filter(id=user.tenant_id)
                .select_related("despacho")
                .values("slug", "name", "despacho__nombre")
            )
        else:
            tenants = []

        organizations = [
            {
                "slug": t["slug"],
                "name": t["name"],
                "despacho": t["despacho__nombre"] or "",
            }
            for t in tenants
        ]

        return Response({"organizations": organizations}, status=status.HTTP_200_OK)


class AccountMeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        serializer = UserSerializer(request.user, context={"request": request})
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
