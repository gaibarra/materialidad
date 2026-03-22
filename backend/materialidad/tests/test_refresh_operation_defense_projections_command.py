from __future__ import annotations

from io import StringIO
from unittest.mock import patch

from django.core.management import call_command
from django.test import TestCase

from materialidad.models import FDIJobRun
from tenancy.models import Tenant


class RefreshOperationDefenseProjectionsCommandTests(TestCase):
    def setUp(self):
        self.tenant = Tenant.objects.create(
            name="Tenant Proyecciones",
            slug="tenant-proyecciones",
            db_name="tenant_proyecciones",
            db_user="tenant_user",
            db_password="tenant_password",
        )

    @patch("materialidad.management.commands.refresh_operation_defense_projections.TenantContext.clear")
    @patch("materialidad.management.commands.refresh_operation_defense_projections.TenantContext.activate")
    @patch("materialidad.management.commands.refresh_operation_defense_projections.sync_operation_defense_projections_for_window")
    def test_command_refreshes_requested_tenant(
        self,
        mock_sync,
        mock_activate,
        mock_clear,
    ):
        mock_sync.return_value = [object()] * 7
        stdout = StringIO()

        call_command(
            "refresh_operation_defense_projections",
            "--tenant",
            self.tenant.slug,
            "--days",
            "45",
            stdout=stdout,
        )

        mock_activate.assert_called_once_with(self.tenant.slug)
        mock_sync.assert_called_once_with(days=45, empresa_id=None, tenant_slug=self.tenant.slug)
        mock_clear.assert_called_once()
        self.assertIn("7 operaciones sincronizadas", stdout.getvalue())
        run = FDIJobRun.objects.get()
        self.assertEqual(run.command, FDIJobRun.Command.REFRESH_PROJECTIONS)
        self.assertEqual(run.status, FDIJobRun.Status.SUCCESS)
        self.assertEqual(run.projections_synced, 7)

    @patch("materialidad.management.commands.refresh_operation_defense_projections.TenantContext.clear")
    @patch("materialidad.management.commands.refresh_operation_defense_projections.TenantContext.activate")
    @patch("materialidad.management.commands.refresh_operation_defense_projections.sync_operation_defense_projections_for_window", side_effect=RuntimeError("sync failed"))
    def test_command_persists_failure_run(self, _mock_sync, mock_activate, mock_clear):
        stdout = StringIO()

        call_command(
            "refresh_operation_defense_projections",
            "--tenant",
            self.tenant.slug,
            stdout=stdout,
        )

        run = FDIJobRun.objects.get()
        self.assertEqual(run.status, FDIJobRun.Status.FAILURE)
        self.assertIn("sync failed", run.error_message)