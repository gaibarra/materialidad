from __future__ import annotations

import time

from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from materialidad.fdi_engine import FORMULA_VERSION, PIPELINE_VERSION, serialize_fdi_snapshot_payload
from materialidad.models import Empresa, FDIJobRun, FiscalDefenseIndexSnapshot
from materialidad.services import persist_fdi_narrative, persist_fdi_snapshot
from tenancy.context import TenantContext
from tenancy.models import Tenant


class Command(BaseCommand):
    help = "Backfill de snapshots FDI para la formula_version activa, por tenant y por empresa."

    def add_arguments(self, parser):
        parser.add_argument(
            "--tenant",
            action="append",
            dest="tenants",
            help="Slug del tenant a procesar. Se puede repetir.",
        )
        parser.add_argument(
            "--days",
            type=int,
            default=90,
            help="Ventana en dias para recalcular snapshots (default: 90).",
        )
        parser.add_argument(
            "--empresa",
            type=int,
            default=None,
            help="ID de empresa opcional para limitar el backfill a una sola empresa.",
        )
        parser.add_argument(
            "--skip-existing",
            action="store_true",
            dest="skip_existing",
            help="No recrea snapshots si ya existe uno con la formula_version y pipeline_version actuales.",
        )
        parser.add_argument(
            "--include-tenant-snapshot",
            action="store_true",
            dest="include_tenant_snapshot",
            help="Incluye tambien snapshot agregado a nivel tenant (empresa_id null).",
        )
        parser.add_argument(
            "--persist-narratives",
            action="store_true",
            dest="persist_narratives",
            help="Genera narrativa CFO persistida para cada snapshot creado en el backfill.",
        )

    def handle(self, *args, **options):
        tenant_slugs: list[str] | None = options.get("tenants")
        days: int = options.get("days", 90)
        empresa_id: int | None = options.get("empresa")
        skip_existing: bool = options.get("skip_existing", False)
        include_tenant_snapshot: bool = options.get("include_tenant_snapshot", False)
        persist_narratives: bool = options.get("persist_narratives", False)

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
            started_at = timezone.now()
            started_clock = time.perf_counter()
            status_value = FDIJobRun.Status.SUCCESS
            error_message = ""
            snapshots_created = 0
            skipped_existing_count = 0
            latest_snapshot = None
            try:
                TenantContext.activate(tenant.slug)
                empresa_ids = [empresa_id] if empresa_id is not None else list(
                    Empresa.objects.filter(activo=True).order_by("id").values_list("id", flat=True)
                )
                targets: list[int | None] = list(empresa_ids)
                if include_tenant_snapshot:
                    targets.insert(0, None)

                for current_empresa_id in targets:
                    existing_qs = FiscalDefenseIndexSnapshot.objects.filter(
                        tenant_slug=tenant.slug,
                        empresa_id=current_empresa_id,
                        formula_version=FORMULA_VERSION,
                        pipeline_version=PIPELINE_VERSION,
                    ).order_by("-captured_at")
                    if skip_existing and existing_qs.exists():
                        skipped_existing_count += 1
                        continue

                    snapshot = persist_fdi_snapshot(
                        days=days,
                        empresa_id=current_empresa_id,
                        source="backfill_formula_version",
                    )
                    latest_snapshot = snapshot
                    snapshots_created += 1

                    if persist_narratives:
                        payload = serialize_fdi_snapshot_payload(snapshot, days=days)
                        persist_fdi_narrative(audience="CFO", fdi_payload=payload)

                processed += 1
                self.stdout.write(
                    self.style.SUCCESS(
                        f"Backfill FDI completado para {tenant.slug}: {snapshots_created} snapshots creados, {skipped_existing_count} omitidos"
                    )
                )
            except Exception as exc:  # pragma: no cover - errores operativos
                status_value = FDIJobRun.Status.FAILURE
                error_message = str(exc)
                errors += 1
                self.stderr.write(self.style.ERROR(f"Error en backfill FDI para {tenant.slug}: {exc}"))
            finally:
                try:
                    FDIJobRun.objects.create(
                        tenant_slug=tenant.slug,
                        command=FDIJobRun.Command.BACKFILL_FORMULA_VERSION,
                        status=status_value,
                        empresa_id=empresa_id,
                        days=days,
                        refresh_projections=False,
                        projections_synced=0,
                        snapshots_created=snapshots_created,
                        snapshot=latest_snapshot,
                        error_message=error_message[:4000],
                        metadata_json={
                            "processed": status_value == FDIJobRun.Status.SUCCESS,
                            "formula_version": FORMULA_VERSION,
                            "pipeline_version": PIPELINE_VERSION,
                            "skip_existing": skip_existing,
                            "skipped_existing_count": skipped_existing_count,
                            "include_tenant_snapshot": include_tenant_snapshot,
                            "persist_narratives": persist_narratives,
                        },
                        started_at=started_at,
                        finished_at=timezone.now(),
                        duration_ms=max(int((time.perf_counter() - started_clock) * 1000), 0),
                    )
                finally:
                    TenantContext.clear()

        summary = (
            f"Backfill formula_version {FORMULA_VERSION}/{PIPELINE_VERSION} completado. "
            f"Tenants: {processed}. Errores: {errors}."
        )
        color = self.style.SUCCESS if errors == 0 else self.style.WARNING
        self.stdout.write(color(summary))
