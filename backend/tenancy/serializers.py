from __future__ import annotations

from rest_framework import serializers

from .models import Despacho, Tenant


class TenantSerializer(serializers.ModelSerializer):
    despacho = serializers.PrimaryKeyRelatedField(
        queryset=Despacho.objects.none(), required=False, allow_null=True
    )
    create_database = serializers.BooleanField(write_only=True, default=True)
    admin_email = serializers.EmailField(write_only=True)
    admin_password = serializers.CharField(write_only=True, min_length=8)
    admin_name = serializers.CharField(write_only=True, allow_blank=True, required=False)

    class Meta:
        model = Tenant
        fields = [
            "name",
            "slug",
            "despacho",
            "db_name",
            "db_user",
            "db_password",
            "db_host",
            "db_port",
            "default_currency",
            "is_active",
            "create_database",
            "admin_email",
            "admin_password",
            "admin_name",
        ]
        extra_kwargs = {
            "is_active": {"default": True},
            "db_password": {"write_only": True},
            "default_currency": {"default": "MXN"},
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        from .models import Despacho

        self.fields["despacho"].queryset = Despacho.objects.filter(is_active=True)

    def validate_slug(self, value: str) -> str:
        if Tenant.objects.filter(slug=value).exists():
            raise serializers.ValidationError("Ya existe un tenant con ese slug")
        return value
