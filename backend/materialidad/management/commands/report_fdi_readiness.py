from __future__ import annotations

import json

from django.core.management.base import BaseCommand, CommandError

from materialidad.services import get_fdi_operability_metrics
from tenancy.context import TenantContext
from tenancy.models import Tenant


class Command(BaseCommand):
    help = "Genera un reporte objetivo de readiness FDI para decidir apagado del camino legacy."

    def add_arguments(self, parser):
        parser.add_argument("--tenant", required=True, help="Slug del tenant a reportar.")
        parser.add_argument("--days", type=int, default=90, help="Ventana en dias (default: 90).")
        parser.add_argument("--empresa", type=int, default=None, help="ID de empresa opcional.")
        parser.add_argument("--format", choices=["json", "text"], default="text")

    def handle(self, *args, **options):
        tenant_slug: str = options["tenant"]
        days: int = options["days"]
        empresa_id: int | None = options.get("empresa")
        output_format: str = options["format"]

        if not Tenant.objects.using("default").filter(slug=tenant_slug, is_active=True).exists():
            raise CommandError(f"Tenant no encontrado o inactivo: {tenant_slug}")

        TenantContext.activate(tenant_slug)
        try:
            payload = get_fdi_operability_metrics(days=days, empresa_id=empresa_id)
        finally:
            TenantContext.clear()

        if output_format == "json":
            self.stdout.write(json.dumps(payload, indent=2, sort_keys=True, default=str))
            return

        readiness = payload.get("readiness", {}) or {}
        alerts = payload.get("alerts", []) or []
        self.stdout.write(f"Tenant: {tenant_slug}")
        self.stdout.write(f"Ventana: {days} dias")
        if empresa_id is not None:
            self.stdout.write(f"Empresa: {empresa_id}")
        self.stdout.write("")
        for gate_name, gate_payload in readiness.items():
            self.stdout.write(
                f"- {gate_name}: {'PASS' if gate_payload.get('passed') else 'FAIL'} :: {json.dumps(gate_payload, ensure_ascii=True, sort_keys=True)}"
            )
        self.stdout.write("")
        if alerts:
            self.stdout.write("Alertas:")
            for alert in alerts:
                self.stdout.write(f"- [{alert.get('severity', 'info')}] {alert.get('code')}: {alert.get('message')}")
        else:
            self.stdout.write("Alertas: ninguna")