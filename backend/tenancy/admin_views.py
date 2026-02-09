"""
ViewSets para administración de Despachos, Corporativos y Transacciones Intercompañía.
Solo accesibles para superusuarios.
"""
from __future__ import annotations

import secrets

from django.conf import settings
from django.db.models import Count, Q
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework_simplejwt.authentication import JWTAuthentication

from .admin_serializers import DespachoSerializer
from .models import Despacho, Tenant
from .services import TenantProvisionError, provision_tenant


class IsSuperUser(permissions.BasePermission):
    """Solo superusuarios pueden gestionar organizaciones."""

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_superuser)


class DespachoViewSet(viewsets.ModelViewSet):
    """
    ViewSet para gestión completa de Despachos y Corporativos.
    Usa autenticación JWT sin validación de tenant ya que estos endpoints
    son para administración a nivel de control plane.
    """

    queryset = Despacho.objects.all()
    serializer_class = DespachoSerializer
    authentication_classes = [JWTAuthentication]  # JWT simple sin tenant context
    permission_classes = [IsSuperUser]
    # permission_classes = [AllowAny]


    def get_queryset(self):
        queryset = super().get_queryset()
        # Anotar con contador de tenants
        queryset = queryset.annotate(
            total_tenants=Count("tenants", filter=Q(tenants__is_active=True)),
        )
        # Filtros opcionales
        tipo = self.request.query_params.get("tipo")
        if tipo:
            queryset = queryset.filter(tipo=tipo)

        search = self.request.query_params.get("search")
        if search:
            queryset = queryset.filter(
                Q(nombre__icontains=search)
                | Q(contacto_email__icontains=search)
                | Q(notas__icontains=search)
            )

        return queryset.order_by("-created_at")

    @action(detail=True, methods=["get"])
    def tenants(self, request, pk=None):
        """Lista los tenants de un despacho/corporativo."""
        despacho = self.get_object()
        tenants = Tenant.objects.filter(despacho=despacho, is_active=True).order_by("name")

        data = [
            {
                "id": t.id,
                "name": t.name,
                "slug": t.slug,
                "db_name": t.db_name,
                "is_active": t.is_active,
                "created_at": t.created_at,
            }
            for t in tenants
        ]

        return Response(data)

    @action(detail=True, methods=["get"])
    def stats(self, request, pk=None):
        """Estadísticas del despacho/corporativo."""
        despacho = self.get_object()

        total_tenants = Tenant.objects.filter(despacho=despacho, is_active=True).count()
        inactive_tenants = Tenant.objects.filter(despacho=despacho, is_active=False).count()

        return Response(
            {
                "total_tenants": total_tenants,
                "active_tenants": total_tenants,
                "inactive_tenants": inactive_tenants,
                "tipo": despacho.tipo,
                "created_at": despacho.created_at,
            }
        )

    @action(detail=True, methods=["post"])
    def create_tenant(self, request, pk=None):
        """Crea un nuevo tenant asociado a este despacho con aprovisionamiento completo."""
        despacho = self.get_object()
        data = request.data

        required_fields = ["name", "slug", "admin_email", "admin_password"]
        missing_fields = [f for f in required_fields if not data.get(f)]
        if missing_fields:
            return Response(
                {"detail": f"Faltan campos requeridos: {', '.join(missing_fields)}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        slug = data["slug"]
        db_name = data.get("db_name") or f"tenant_{slug}"
        db_user = db_name

        # Obtener defaults de conexión del control DB
        default_db = settings.DATABASES.get("default", {})

        try:
            tenant = provision_tenant(
                name=data["name"],
                slug=slug,
                despacho=despacho,
                db_name=db_name,
                db_user=db_user,
                db_password=secrets.token_urlsafe(24),
                db_host=default_db.get("HOST", "localhost"),
                db_port=int(default_db.get("PORT", 5432)),
                default_currency=data.get("default_currency", "MXN"),
                admin_email=data["admin_email"].strip(),
                admin_password=data["admin_password"],
                admin_name=data.get("admin_name", f"Admin {data['name']}"),
                create_database=True,
                initiated_by=request.user if request.user.is_authenticated else None,
            )
        except TenantProvisionError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response(
            {
                "detail": "Tenant creado y aprovisionado exitosamente",
                "id": tenant.id,
                "name": tenant.name,
                "slug": tenant.slug,
                "db_name": tenant.db_name,
            },
            status=status.HTTP_201_CREATED,
        )
