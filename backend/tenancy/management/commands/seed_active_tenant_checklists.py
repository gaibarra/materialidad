from __future__ import annotations

from django.core.management.base import BaseCommand, CommandError

from materialidad.checklist_templates import seed_default_checklists_for_tenant
from tenancy.models import Tenant


class Command(BaseCommand):
    help = "Siembra los checklists base en uno o todos los tenants activos"

    def add_arguments(self, parser):
        parser.add_argument(
            "--slug",
            help="Slug específico del tenant. Si se omite, se procesan todos los activos",
        )

    def handle(self, *args, **options):
        slug = options.get("slug")
        tenants = (
            Tenant.objects.filter(slug=slug, is_active=True)
            if slug
            else Tenant.objects.filter(is_active=True).order_by("slug")
        )

        if slug and not tenants.exists():
            raise CommandError("Tenant no encontrado o inactivo")

        total_tenants = 0
        total_checklists = 0

        for tenant in tenants:
            seeded = seed_default_checklists_for_tenant(tenant_slug=tenant.slug)
            total_tenants += 1
            total_checklists += seeded
            self.stdout.write(
                self.style.NOTICE(
                    f"Tenant {tenant.slug}: {seeded} checklists base sembrados o actualizados"
                )
            )

        self.stdout.write(
            self.style.SUCCESS(
                f"Proceso completado. Tenants atendidos: {total_tenants}. Checklists procesados: {total_checklists}."
            )
        )