from __future__ import annotations

from io import StringIO
from unittest.mock import patch

from django.core.management import call_command
from django.test import TestCase

from tenancy.models import Tenant


class ReportFDIReadinessCommandTests(TestCase):
    def setUp(self):
        self.tenant = Tenant.objects.create(
            name="Tenant Readiness",
            slug="tenant-readiness",
            db_name="tenant_readiness",
            db_user="tenant_user",
            db_password="tenant_password",
        )

    @patch("materialidad.management.commands.report_fdi_readiness.TenantContext.clear")
    @patch("materialidad.management.commands.report_fdi_readiness.TenantContext.activate")
    @patch("materialidad.management.commands.report_fdi_readiness.get_fdi_operability_metrics")
    def test_report_outputs_text_gates(self, mock_metrics, mock_activate, mock_clear):
        mock_metrics.return_value = {
            "readiness": {
                "coverage_gate": {"passed": True, "amount_coverage_pct": 96.0, "count_coverage_pct": 91.0},
                "snapshot_freshness_gate": {"passed": False, "fresh_empresas_pct": 50.0},
            },
            "alerts": [{"severity": "critical", "code": "snapshot_freshness_below_sla", "message": "lag alto"}],
        }
        stdout = StringIO()

        call_command("report_fdi_readiness", "--tenant", self.tenant.slug, stdout=stdout)

        output = stdout.getvalue()
        self.assertIn("coverage_gate: PASS", output)
        self.assertIn("snapshot_freshness_gate: FAIL", output)
        self.assertIn("snapshot_freshness_below_sla", output)
        mock_activate.assert_called_once_with(self.tenant.slug)
        mock_clear.assert_called_once()