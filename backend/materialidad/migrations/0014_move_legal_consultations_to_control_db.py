from __future__ import annotations

from django.db import migrations


def move_consultations_to_control(apps, schema_editor):
    from tenancy.context import TenantContext, TenantNotActive, TenantNotFound

    Tenant = apps.get_model("tenancy", "Tenant")
    LegalConsultation = apps.get_model("materialidad", "LegalConsultation")
    default_alias = schema_editor.connection.alias

    # Evita cerrar la conexión del esquema de tenant durante migraciones por-tenant.
    # Solo ejecutamos el traslado cuando la migración corre en la base de control (alias "default").
    if default_alias != "default":
        return

    for tenant in Tenant.objects.using("default").all():
        try:
            TenantContext.activate(tenant.slug)
        except (TenantNotFound, TenantNotActive):
            continue

        active_tenant = TenantContext.get_current_tenant()
        if not active_tenant:
            TenantContext.clear()
            continue
        alias = active_tenant.db_alias
        try:
            queryset = LegalConsultation.objects.using(alias).all().iterator()
        except Exception:
            TenantContext.clear()
            continue

        try:
            for consultation in queryset:
                LegalConsultation.objects.using(default_alias).update_or_create(
                    tenant_slug=consultation.tenant_slug,
                    question=consultation.question,
                    created_at=consultation.created_at,
                    defaults={
                        "user_id": consultation.user_id,
                        "context": consultation.context,
                        "answer": consultation.answer,
                        "references": consultation.references,
                        "ai_model": consultation.ai_model,
                    },
                )
        finally:
            TenantContext.clear()


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("materialidad", "0013_drop_legalconsultation_fk"),
        ("tenancy", "0003_alter_tenant_options"),
    ]

    operations = [migrations.RunPython(move_consultations_to_control, noop)]
