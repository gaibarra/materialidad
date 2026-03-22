from __future__ import annotations

import time

from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from materialidad.defense_projection import sync_operation_defense_projections_for_window
from materialidad.models import FDIJobRun
from materialidad.services import persist_fdi_snapshot
from tenancy.context import TenantContext
from tenancy.models import Tenant


class Command(BaseCommand):
    help = "Captura y persiste snapshots del Fiscal Defense Index (FDI) para uno o mas tenants."

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
            help="Ventana en dias para calcular el FDI (default: 90).",
        )
        parser.add_argument(
            "--empresa",
            type=int,
            default=None,
            help="ID de empresa opcional para snapshot por empresa.",
        )
        parser.add_argument(
            "--refresh-projections",
            action="store_true",
            dest="refresh_projections",
            help="Sincroniza OperationDefenseProjection antes de capturar el snapshot FDI.",
        )

    def handle(self, *args, **options):
        tenant_slugs: list[str] | None = options.get("tenants")
        days: int = options.get("days", 90)
        empresa_id: int | None = options.get("empresa")
        refresh_projections: bool = options.get("refresh_projections", False)

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
            self.stdout.write(self.style.NOTICE(f"Capturando FDI para {tenant.slug}"))
            started_at = timezone.now()
            started_clock = time.perf_counter()
            projections_synced = 0
            snapshots_created = 0
            snapshot = None
            status_value = FDIJobRun.Status.SUCCESS
            error_message = ""
            try:
                TenantContext.activate(tenant.slug)
                if refresh_projections:
                    refreshed = sync_operation_defense_projections_for_window(
                        days=days,
                        empresa_id=empresa_id,
                        tenant_slug=tenant.slug,
                    )
                    refreshed_count = len(refreshed)
                    projections_synced = refreshed_count
                    self.stdout.write(
                        self.style.NOTICE(
                            f"Proyecciones FDI sincronizadas para {tenant.slug}: {refreshed_count} operaciones"
                        )
                    )
                snapshot = persist_fdi_snapshot(days=days, empresa_id=empresa_id, source="command")
                snapshots_created = 1
                processed += 1
                self.stdout.write(
                    self.style.SUCCESS(
                        f"FDI snapshot guardado para {tenant.slug} ({snapshot.captured_at:%Y-%m-%d %H:%M:%S})"
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
                        command=FDIJobRun.Command.CAPTURE_SNAPSHOTS,
                        status=status_value,
                        empresa_id=empresa_id,
                        days=days,
                        refresh_projections=refresh_projections,
                        projections_synced=projections_synced,
                        snapshots_created=snapshots_created,
                        snapshot=snapshot,
                        error_message=error_message[:4000],
                        metadata_json={"processed": status_value == FDIJobRun.Status.SUCCESS},
                        started_at=started_at,
                        finished_at=timezone.now(),
                        duration_ms=max(int((time.perf_counter() - started_clock) * 1000), 0),
                    )
                finally:
                    TenantContext.clear()

        summary = f"Snapshots FDI creados: {processed}. Errores: {errors}."
        color = self.style.SUCCESS if errors == 0 else self.style.WARNING
        self.stdout.write(color(summary))
