from __future__ import annotations

from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError

from tenancy.context import TenantContext
from tenancy.models import Tenant


class Command(BaseCommand):
    help = "Ejecuta migraciones en una o varias bases dedicadas de tenants"

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
            else Tenant.objects.filter(is_active=True)
        )

        if slug and not tenants.exists():
            raise CommandError("Tenant no encontrado o inactivo")

        for tenant in tenants:
            self.stdout.write(self.style.NOTICE(f"Aplicando migraciones para {tenant.slug}"))
            TenantContext.activate(tenant.slug)
            try:
                call_command(
                    "migrate",
                    database=tenant.db_alias,
                    interactive=False,
                    run_syncdb=False,
                )
            finally:
                TenantContext.clear()
        self.stdout.write(self.style.SUCCESS("Migraciones completadas"))
