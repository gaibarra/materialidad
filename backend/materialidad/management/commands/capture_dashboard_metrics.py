from __future__ import annotations

from django.core.management.base import BaseCommand, CommandError

from materialidad.services import persist_dashboard_snapshot
from tenancy.context import TenantContext
from tenancy.models import Tenant


class Command(BaseCommand):
    help = "Captura y persiste una fotografía de los KPIs fiscales para uno o más tenants."

    def add_arguments(self, parser):
        parser.add_argument(
            "--tenant",
            action="append",
            dest="tenants",
            help="Slug del tenant a procesar. Se puede repetir el argumento para varios.",
        )

    def handle(self, *args, **options):
        tenant_slugs: list[str] | None = options.get("tenants")
        queryset = Tenant.objects.using("default").filter(is_active=True)
        if tenant_slugs:
            queryset = queryset.filter(slug__in=tenant_slugs)
            missing = set(tenant_slugs) - set(queryset.values_list("slug", flat=True))
            if missing:
                raise CommandError(f"Tenants no encontrados o inactivos: {', '.join(sorted(missing))}")

        if not queryset.exists():
            raise CommandError("No hay tenants activos para procesar")

        processed = 0
        errors = 0
        for tenant in queryset.order_by("slug"):
            self.stdout.write(self.style.NOTICE(f"Capturando KPIs para {tenant.slug}"))
            try:
                TenantContext.activate(tenant.slug)
                snapshot = persist_dashboard_snapshot(tenant.slug)
                processed += 1
                self.stdout.write(
                    self.style.SUCCESS(
                        f"Snapshot guardado para {tenant.slug} ({snapshot.captured_at:%Y-%m-%d %H:%M:%S})"
                    )
                )
            except Exception as exc:  # pragma: no cover - errores operativos
                errors += 1
                self.stderr.write(self.style.ERROR(f"Error en {tenant.slug}: {exc}"))
            finally:
                TenantContext.clear()

        summary = f"Snapshots creados: {processed}. Errores: {errors}."
        color = self.style.SUCCESS if errors == 0 else self.style.WARNING
        self.stdout.write(color(summary))
