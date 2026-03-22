from __future__ import annotations

from io import StringIO
from unittest.mock import patch

from django.core.management import call_command
from django.test import TestCase
from django.utils import timezone

from materialidad.models import Empresa, FDIJobRun, FiscalDefenseIndexSnapshot
from tenancy.models import Tenant


class BackfillFDIFormulaVersionCommandTests(TestCase):
    def setUp(self):
        self.tenant = Tenant.objects.create(
            name="Tenant Backfill",
            slug="tenant-backfill",
            db_name="tenant_backfill",
            db_user="tenant_user",
            db_password="tenant_password",
        )
        self.empresa = Empresa.objects.create(
            razon_social="Empresa Backfill SA de CV",
            rfc="EBS010101AAA",
            regimen_fiscal="601",
            estado="CDMX",
            activo=True,
        )

    @patch("materialidad.management.commands.backfill_fdi_formula_version.TenantContext.clear")
    @patch("materialidad.management.commands.backfill_fdi_formula_version.TenantContext.activate")
    @patch("materialidad.management.commands.backfill_fdi_formula_version.persist_fdi_snapshot")
    def test_backfill_creates_company_and_tenant_snapshots(self, mock_persist_snapshot, mock_activate, mock_clear):
        mock_persist_snapshot.side_effect = [
            FiscalDefenseIndexSnapshot.objects.create(
                tenant_slug=self.tenant.slug,
                empresa_id=None,
                period_start=timezone.localdate(),
                period_end=timezone.localdate(),
                score="70.0",
                level="CONTROLADO",
                dm="70.0",
                se="70.0",
                sc="70.0",
                ec="20.0",
                do="80.0",
                confidence_score="80.0",
                formula_version="fdi-v1",
                pipeline_version="pipeline-v1",
                inputs_json={},
                actions_json=[],
                source="test",
            ),
            FiscalDefenseIndexSnapshot.objects.create(
                tenant_slug=self.tenant.slug,
                empresa_id=self.empresa.id,
                period_start=timezone.localdate(),
                period_end=timezone.localdate(),
                score="74.0",
                level="CONTROLADO",
                dm="72.0",
                se="71.0",
                sc="74.0",
                ec="18.0",
                do="81.0",
                confidence_score="82.0",
                formula_version="fdi-v1",
                pipeline_version="pipeline-v1",
                inputs_json={},
                actions_json=[],
                source="test",
            ),
        ]
        stdout = StringIO()

        call_command(
            "backfill_fdi_formula_version",
            "--tenant",
            self.tenant.slug,
            "--include-tenant-snapshot",
            stdout=stdout,
        )

        mock_activate.assert_called_once_with(self.tenant.slug)
        self.assertEqual(mock_persist_snapshot.call_count, 2)
        run = FDIJobRun.objects.get()
        self.assertEqual(run.command, FDIJobRun.Command.BACKFILL_FORMULA_VERSION)
        self.assertEqual(run.status, FDIJobRun.Status.SUCCESS)
        self.assertEqual(run.snapshots_created, 2)
        self.assertIn("2 snapshots creados", stdout.getvalue())
        mock_clear.assert_called_once()

    @patch("materialidad.management.commands.backfill_fdi_formula_version.TenantContext.clear")
    @patch("materialidad.management.commands.backfill_fdi_formula_version.TenantContext.activate")
    @patch("materialidad.management.commands.backfill_fdi_formula_version.persist_fdi_snapshot", side_effect=RuntimeError("boom"))
    def test_backfill_persists_failure_run(self, _mock_persist_snapshot, mock_activate, mock_clear):
        stdout = StringIO()

        call_command(
            "backfill_fdi_formula_version",
            "--tenant",
            self.tenant.slug,
            stdout=stdout,
        )

        run = FDIJobRun.objects.get()
        self.assertEqual(run.command, FDIJobRun.Command.BACKFILL_FORMULA_VERSION)
        self.assertEqual(run.status, FDIJobRun.Status.FAILURE)
        self.assertIn("boom", run.error_message)
        mock_activate.assert_called_once_with(self.tenant.slug)
        mock_clear.assert_called_once()

    @patch("materialidad.management.commands.backfill_fdi_formula_version.TenantContext.activate")
    @patch("materialidad.management.commands.backfill_fdi_formula_version.TenantContext.clear")
    @patch("materialidad.management.commands.backfill_fdi_formula_version.FDIJobRun.objects.create")
    @patch("materialidad.management.commands.backfill_fdi_formula_version.persist_fdi_snapshot")
    def test_backfill_persists_job_run_before_clearing_tenant_context(
        self,
        mock_persist_snapshot,
        mock_job_run_create,
        mock_clear,
        mock_activate,
    ):
        snapshot = FiscalDefenseIndexSnapshot.objects.create(
            tenant_slug=self.tenant.slug,
            empresa_id=self.empresa.id,
            period_start=timezone.localdate(),
            period_end=timezone.localdate(),
            score="74.0",
            level="CONTROLADO",
            dm="72.0",
            se="71.0",
            sc="74.0",
            ec="18.0",
            do="81.0",
            confidence_score="82.0",
            formula_version="fdi-v1",
            pipeline_version="pipeline-v1",
            inputs_json={},
            actions_json=[],
            source="test",
        )
        mock_persist_snapshot.return_value = snapshot
        call_order: list[str] = []

        def _record_job_run(*args, **kwargs):
            call_order.append("job_run")
            return None

        def _record_clear(*args, **kwargs):
            call_order.append("clear")
            return None

        mock_job_run_create.side_effect = _record_job_run
        mock_clear.side_effect = _record_clear

        call_command(
            "backfill_fdi_formula_version",
            "--tenant",
            self.tenant.slug,
            "--empresa",
            str(self.empresa.id),
        )

        self.assertEqual(call_order, ["job_run", "clear"])
        mock_activate.assert_called_once_with(self.tenant.slug)