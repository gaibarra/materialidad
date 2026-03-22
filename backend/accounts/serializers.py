from __future__ import annotations

from django.utils.translation import gettext_lazy as _
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from tenancy.models import Tenant, TenantAIConfig

from .models import User


class UserSerializer(serializers.ModelSerializer):
    tenant_slug = serializers.SerializerMethodField()
    despacho_slug = serializers.SerializerMethodField()
    despacho_tipo = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            "id",
            "email",
            "full_name",
            "tenant_slug",
            "despacho_slug",
            "despacho_tipo",
            "is_active",
            "is_staff",
            "is_superuser",
        )

    def get_tenant_slug(self, obj: User) -> str | None:
        request = self.context.get("request")
        if request and getattr(request, "tenant", None):
            return request.tenant.slug
        if obj.tenant:
            return obj.tenant.slug
        return None

    def get_despacho_slug(self, obj: User) -> str | None:
        if obj.despacho:
            return obj.despacho.nombre
        return None

    def get_despacho_tipo(self, obj: User) -> str | None:
        """Return the org type: 'despacho' or 'corporativo'."""
        # Direct despacho on user
        if obj.despacho:
            return obj.despacho.tipo
        # Or via tenant's parent despacho
        if obj.tenant and obj.tenant.despacho:
            return obj.tenant.despacho.tipo
        return None


class UserAdminSerializer(UserSerializer):
    password = serializers.CharField(write_only=True, required=False, min_length=8, allow_blank=True)

    class Meta(UserSerializer.Meta):
        fields = UserSerializer.Meta.fields + ("password",)

    def create(self, validated_data):
        password = validated_data.pop("password", None)
        return User.objects.create_user(password=password, **validated_data)

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)
        user = super().update(instance, validated_data)
        if password:
            user.set_password(password)
            user.save(update_fields=["password"])
        return user


class TenantAIConfigSerializer(serializers.ModelSerializer):
    api_key = serializers.CharField(write_only=True, required=False, allow_blank=True)
    api_key_set = serializers.SerializerMethodField()

    class Meta:
        model = TenantAIConfig
        fields = ("provider", "api_key", "api_key_set", "updated_at")
        read_only_fields = ("api_key_set", "updated_at")

    def get_api_key_set(self, obj: TenantAIConfig) -> bool:
        return bool(obj.api_key)


class TenantTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    Serializer de autenticación que automáticamente asigna el tenant
    del usuario autenticado al token (si el usuario tiene uno).
    Los superusuarios sin tenant pueden acceder a endpoints de control plane.
    Permite acceso multitenant explícito si el usuario tiene permiso (is_superuser o admin de despacho).
    """

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["tenant"] = serializers.CharField(required=False, allow_blank=True)

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        # We handle dynamic tenant injection inside validate() now
        # using the request data.
        return token

    def validate(self, attrs):
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"TENANT PAYLOAD RECEIVED: {attrs}")
        
        # Extract requested tenant before super().validate consumes the standard fields
        requested_tenant_slug = attrs.get("tenant", "").strip()
        logger.error(f"EXTRACTED requested_tenant_slug: '{requested_tenant_slug}'")
        
        # Standard authentication
        data = super().validate(attrs)

        user = self.user
        if not user.is_active:
            raise serializers.ValidationError({"email": _("Usuario inactivo")})

        resolved_tenant = None

        if requested_tenant_slug:
            try:
                # User explicitly requested a tenant
                target_tenant = Tenant.objects.get(slug=requested_tenant_slug)
                if not target_tenant.is_active:
                    raise serializers.ValidationError({"tenant": _("El tenant solicitado está inactivo")})

                # Permission Check
                if user.is_superuser:
                    resolved_tenant = target_tenant
                elif user.despacho_id and target_tenant.despacho_id == user.despacho_id:
                    resolved_tenant = target_tenant
                elif user.tenant_id == target_tenant.id:
                    resolved_tenant = target_tenant
                else:
                    raise serializers.ValidationError({"tenant": _("No tienes acceso a este tenant")})

            except Tenant.DoesNotExist:
                raise serializers.ValidationError({"tenant": _("Tenant no encontrado")})
        else:
            # Fallback to default user tenant
            if user.tenant:
                if not user.tenant.is_active:
                    raise serializers.ValidationError({"tenant": _("Tu tenant está inactivo")})
                resolved_tenant = user.tenant

        logger.error(f"RESOLVED TENANT: {resolved_tenant.slug if resolved_tenant else 'NONE'}")

        # Actualizar el token y la respuesta con el tenant resuelto
        if resolved_tenant:
            # We must regenerate the token payload specifically for this explicit tenant request
            refresh = self.get_token(user)
            refresh["tenant"] = resolved_tenant.slug
            
            data["refresh"] = str(refresh)
            data["access"] = str(refresh.access_token)
            data["tenant"] = resolved_tenant.slug
        else:
            data["tenant"] = None # Control plane access usually

        logger.error(f"FINAL TOKEN PAYLOAD TENANT: {data.get('tenant')}")

        return data
