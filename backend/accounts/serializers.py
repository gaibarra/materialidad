from __future__ import annotations

from django.utils.translation import gettext_lazy as _
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from tenancy.models import Tenant, TenantAIConfig

from .models import User


class UserSerializer(serializers.ModelSerializer):
    tenant_slug = serializers.SerializerMethodField()
    despacho_slug = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            "id",
            "email",
            "full_name",
            "tenant_slug",
            "despacho_slug",
            "is_active",
            "is_staff",
            "is_superuser",
        )

    def get_tenant_slug(self, obj: User) -> str | None:
        if obj.tenant:
            return obj.tenant.slug
        return None

    def get_despacho_slug(self, obj: User) -> str | None:
        if obj.despacho:
            return obj.despacho.nombre
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
    tenant = serializers.SlugField(write_only=True)

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        if user.tenant:
            token["tenant"] = user.tenant.slug
        return token

    def validate(self, attrs):
        tenant_slug = attrs.get("tenant")
        try:
            tenant = Tenant.objects.only("id", "slug", "is_active").get(slug=tenant_slug)
        except Tenant.DoesNotExist as exc:  # type: ignore[attr-defined]
            raise serializers.ValidationError({"tenant": _("Tenant inválido")}) from exc

        if not tenant.is_active:
            raise serializers.ValidationError({"tenant": _("Tenant inactivo")})

        data = super().validate(attrs)

        user = self.user
        if not user.is_active:
            raise serializers.ValidationError({"email": _("Usuario inactivo")})
        if user.tenant_id and user.tenant_id != tenant.id:
            raise serializers.ValidationError({"tenant": _("Usuario no pertenece al tenant indicado")})

        data["tenant"] = tenant.slug
        return data
