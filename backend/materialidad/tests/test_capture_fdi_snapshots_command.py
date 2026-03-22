from __future__ import annotations

from io import StringIO
from unittest.mock import patch

from django.core.management import call_command
from django.test import TestCase
from django.utils import timezone

from materialidad.models import FDIJobRun, FiscalDefenseIndexSnapshot
from tenancy.models import Tenant


class CaptureFDISnapshotsCommandTests(TestCase):
    def setUp(self):
        self.tenant = Tenant.objects.create(
            name="Tenant Snapshots",
            slug="tenant-snapshots",
            db_name="tenant_snapshots",
            db_user="tenant_user",
            db_password="tenant_password",
        )

    @patch("materialidad.management.commands.capture_fdi_snapshots.TenantContext.clear")
    @patch("materialidad.management.commands.capture_fdi_snapshots.TenantContext.activate")
    @patch("materialidad.management.commands.capture_fdi_snapshots.persist_fdi_snapshot")
    @patch("materialidad.management.commands.capture_fdi_snapshots.sync_operation_defense_projections_for_window")
    def test_command_can_refresh_projections_before_snapshot(
        self,
        mock_refresh,
        mock_snapshot,
        mock_activate,
        mock_clear,
    ):
        mock_refresh.return_value = [object()] * 5
        mock_snapshot.return_value = FiscalDefenseIndexSnapshot.objects.create(
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
        )
        stdout = StringIO()

        call_command(
            "capture_fdi_snapshots",
            "--tenant",
            self.tenant.slug,
            "--days",
            "30",
            "--refresh-projections",
            stdout=stdout,
        )

        mock_activate.assert_called_once_with(self.tenant.slug)
        mock_refresh.assert_called_once_with(days=30, empresa_id=None, tenant_slug=self.tenant.slug)
        mock_snapshot.assert_called_once_with(days=30, empresa_id=None, source="command")
        mock_clear.assert_called_once()
        self.assertIn("5 operaciones", stdout.getvalue())
        run = FDIJobRun.objects.get()
        self.assertEqual(run.command, FDIJobRun.Command.CAPTURE_SNAPSHOTS)
        self.assertEqual(run.status, FDIJobRun.Status.SUCCESS)
        self.assertEqual(run.projections_synced, 5)
        self.assertEqual(run.snapshots_created, 1)

    @patch("materialidad.management.commands.capture_fdi_snapshots.TenantContext.clear")
    @patch("materialidad.management.commands.capture_fdi_snapshots.TenantContext.activate")
    @patch("materialidad.management.commands.capture_fdi_snapshots.persist_fdi_snapshot", side_effect=RuntimeError("boom"))
    def test_command_persists_failure_run(self, mock_snapshot, mock_activate, mock_clear):
        stdout = StringIO()

        call_command(
            "capture_fdi_snapshots",
            "--tenant",
            self.tenant.slug,
            stdout=stdout,
        )

        run = FDIJobRun.objects.get()
        self.assertEqual(run.status, FDIJobRun.Status.FAILURE)
        self.assertIn("boom", run.error_message)
        self.assertEqual(run.snapshots_created, 0)