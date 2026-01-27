from __future__ import annotations

from django.contrib import admin

from .models import Despacho, Tenant, TenantProvisionLog


@admin.register(Tenant)
class TenantAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "despacho", "db_name", "db_host", "is_active", "created_at")
    search_fields = ("name", "slug", "db_name", "despacho__nombre")
    readonly_fields = ("created_at", "updated_at")
    list_filter = ("is_active", "despacho")


@admin.register(Despacho)
class DespachoAdmin(admin.ModelAdmin):
    list_display = ("nombre", "tipo", "is_active", "contacto_email")
    search_fields = ("nombre", "contacto_email")
    list_filter = ("tipo", "is_active")


@admin.register(TenantProvisionLog)
class TenantProvisionLogAdmin(admin.ModelAdmin):
    list_display = ("slug", "status", "admin_email", "created_at", "initiated_by")
    list_filter = ("status", "created_at")
    search_fields = ("slug", "admin_email", "message")
    readonly_fields = ("created_at",)
