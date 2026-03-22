from __future__ import annotations

import time

from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from materialidad.defense_projection import sync_operation_defense_projections_for_window
from materialidad.models import FDIJobRun
from tenancy.context import TenantContext
from tenancy.models import Tenant


class Command(BaseCommand):
    help = "Refresca las OperationDefenseProjection para uno o mas tenants."

    def add_arguments(self, parser):
        parser.add_argument(
            "--tenant",
            action="append",
            dest="tenants",
            help="Slug del tenant a procesar. Se puede repetir el argumento para varios.",
        )
        parser.add_argument(
            "--days",
            type=int,
            default=90,
            help="Ventana en dias para refrescar proyecciones (default: 90).",
        )
        parser.add_argument(
            "--empresa",
            type=int,
            default=None,
            help="ID de empresa opcional para refrescar solo una empresa.",
        )

    def handle(self, *args, **options):
        tenant_slugs: list[str] | None = options.get("tenants")
        days: int = options.get("days", 90)
        empresa_id: int | None = options.get("empresa")

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
            self.stdout.write(self.style.NOTICE(f"Refrescando proyecciones FDI para {tenant.slug}"))
            started_at = timezone.now()
            started_clock = time.perf_counter()
            refreshed_count = 0
            status_value = FDIJobRun.Status.SUCCESS
            error_message = ""
            try:
                TenantContext.activate(tenant.slug)
                refreshed = sync_operation_defense_projections_for_window(
                    days=days,
                    empresa_id=empresa_id,
                    tenant_slug=tenant.slug,
                )
                refreshed_count = len(refreshed)
                processed += 1
                self.stdout.write(
                    self.style.SUCCESS(
                        f"Proyecciones refrescadas para {tenant.slug}: {refreshed_count} operaciones sincronizadas"
                    )
                )
            except Exception as exc:  # pragma: no cover - errores operativos
                status_value = FDIJobRun.Status.FAILURE
                error_message = str(exc)
                errors += 1
                self.stderr.write(self.style.ERROR(f"Error en {tenant.slug}: {exc}"))
            finally:
                try:
                    FDIJobRun.objects.create(
                        tenant_slug=tenant.slug,
                        command=FDIJobRun.Command.REFRESH_PROJECTIONS,
                        status=status_value,
                        empresa_id=empresa_id,
                        days=days,
                        refresh_projections=True,
                        projections_synced=refreshed_count,
                        snapshots_created=0,
                        error_message=error_message[:4000],
                        metadata_json={"processed": status_value == FDIJobRun.Status.SUCCESS},
                        started_at=started_at,
                        finished_at=timezone.now(),
                        duration_ms=max(int((time.perf_counter() - started_clock) * 1000), 0),
                    )
                finally:
                    TenantContext.clear()

        summary = f"Refresh de proyecciones completado. Tenants: {processed}. Errores: {errors}."
        color = self.style.SUCCESS if errors == 0 else self.style.WARNING
        self.stdout.write(color(summary))