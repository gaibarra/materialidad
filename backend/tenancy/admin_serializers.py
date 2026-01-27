"""
Serializers para administración de Despachos y Transacciones Intercompañía.
"""
from __future__ import annotations

from rest_framework import serializers

from .models import Despacho


class DespachoSerializer(serializers.ModelSerializer):
    """Serializer completo para Despacho/Corporativo."""

    total_tenants = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Despacho
        fields = [
            "id",
            "nombre",
            "tipo",
            "contacto_email",
            "contacto_telefono",
            "notas",
            "is_active",
            "created_at",
            "updated_at",
            "total_tenants",
        ]
        read_only_fields = ["created_at", "updated_at", "total_tenants"]

    def validate_nombre(self, value: str) -> str:
        """Validar que el nombre no esté duplicado."""
        instance_id = self.instance.id if self.instance else None
        exists = Despacho.objects.filter(nombre=value).exclude(id=instance_id).exists()
        if exists:
            raise serializers.ValidationError("Ya existe un despacho/corporativo con este nombre")
        return value
