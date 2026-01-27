"""
ViewSets para administración de Despachos, Corporativos y Transacciones Intercompañía.
Solo accesibles para superusuarios.
"""
from __future__ import annotations

from django.db.models import Count, Q
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework_simplejwt.authentication import JWTAuthentication

from .admin_serializers import DespachoSerializer
from .models import Despacho, Tenant


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
        """Crea un nuevo tenant asociado a este despacho."""
        from django.contrib.auth import get_user_model
        
        despacho = self.get_object()
        data = request.data
        
        required_fields = ["name", "slug", "admin_email", "admin_password"]
        missing_fields = [f for f in required_fields if f not in data]
        if missing_fields:
            return Response(
                {"detail": f"Faltan campos requeridos: {', '.join(missing_fields)}"},
                status=status.HTTP_400_BAD_REQUEST
            )
            
        slug = data["slug"]
        db_name = data.get("db_name") or f"tenant_{slug}"
        
        # Validaciones de unicidad
        if Tenant.objects.filter(slug=slug).exists():
            return Response({"detail": "El slug ya está en uso"}, status=status.HTTP_400_BAD_REQUEST)
        
        if Tenant.objects.filter(db_name=db_name).exists():
            return Response({"detail": "El nombre de base de datos ya está en uso"}, status=status.HTTP_400_BAD_REQUEST)
            
        User = get_user_model()
        if User.objects.filter(email=data["admin_email"]).exists():
            return Response({"detail": "El email del administrador ya está registrado"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            # Crear registro Tenant
            tenant = Tenant.objects.create(
                despacho=despacho,
                name=data["name"],
                slug=slug,
                db_name=db_name,
                db_user=db_name, # Simplificación: usuario = dbname
                db_password=User.objects.make_random_password(length=16),
                is_active=True
            )
            
            # Crear Usuario Admin vinculado al Tenant y al Despacho
            User.objects.create_user(
                email=data["admin_email"],
                password=data["admin_password"],
                full_name=f"Admin {data['name']}",
                tenant=tenant,
                despacho=despacho,
                is_active=True
            )
            
            # TODO: Aquí se debería disparar una tarea asíncrona (Celery)
            # para aprovisionar la base de datos real (Create DB, Migrations, etc.)
            
            return Response({
                "detail": "Tenant creado exitosamente",
                "id": tenant.id,
                "name": tenant.name
            }, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            # Si falla, intentamos limpiar (rollback manual básico)
            if 'tenant' in locals() and tenant.id:
                tenant.delete()
            return Response({"detail": f"Error al crear tenant: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
