from __future__ import annotations

from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    ordering = ("email",)
    list_display = ("email", "tenant", "is_staff", "is_active", "created_at")
    list_filter = ("is_staff", "is_active", "tenant")
    fieldsets = (
        (None, {"fields": ("email", "password", "tenant")}),
        ("Información personal", {"fields": ("full_name",)}),
        ("Permisos", {"fields": ("is_active", "is_staff", "is_superuser", "groups", "user_permissions")}),
        ("Fechas", {"fields": ("last_login", "created_at", "updated_at")}),
    )
    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": ("email", "password1", "password2", "tenant", "is_staff", "is_superuser"),
            },
        ),
    )
    search_fields = ("email", "full_name")
    readonly_fields = ("created_at", "updated_at")
