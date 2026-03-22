from __future__ import annotations

from datetime import timedelta
from types import SimpleNamespace
from unittest.mock import patch
from uuid import uuid4

from django.core.cache import cache
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import User
from materialidad.models import FDIJobRun, FiscalDefenseIndexNarrative, FiscalDefenseIndexSnapshot
from tenancy.context import TenantContext


@override_settings(TENANT_REQUIRED_PATH_PREFIXES=[])
class DashboardFDIConsistencyTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        cache.clear()
        self.user = User.objects.create_user(email="qa.fdi@example.com", password="Password123!")
        self.tenant = SimpleNamespace(slug="tenant-fdi")
        self.client.force_authenticate(user=self.user)

    def tearDown(self):
        cache.clear()
        TenantContext.clear()

    def _create_recent_snapshot(self, *, days: int = 90, score: str = "73.4") -> FiscalDefenseIndexSnapshot:
        today = timezone.localdate()
        snapshot = FiscalDefenseIndexSnapshot.objects.create(
            tenant_slug=self.tenant.slug,
            empresa_id=None,
            period_start=today - timedelta(days=days - 1),
            period_end=today,
            score=score,
            level=FiscalDefenseIndexSnapshot.Level.CONTROLADO,
            dm="71.0",
            se="69.0",
            sc="84.0",
            ec="28.0",
            do="88.0",
            confidence_score="81.0",
            formula_version="fdi-v1",
            pipeline_version="pipeline-v1",
            correlation_id=uuid4(),
            inputs_json={"total_operaciones": 8, "operaciones_validadas": 6},
            actions_json=[{"title": "Acción demo", "priority": "high", "description": "Demo"}],
            source="test",
        )
        FiscalDefenseIndexSnapshot.objects.filter(pk=snapshot.pk).update(
            captured_at=timezone.now() - timedelta(minutes=5)
        )
        snapshot.refresh_from_db()
        return snapshot

    def _create_job_run(
        self,
        *,
        command: str = FDIJobRun.Command.CAPTURE_SNAPSHOTS,
        status_value: str = FDIJobRun.Status.SUCCESS,
        minutes_ago: int = 5,
        empresa_id: int | None = None,
    ) -> FDIJobRun:
        finished_at = timezone.now() - timedelta(minutes=minutes_ago)
        started_at = finished_at - timedelta(seconds=30)
        return FDIJobRun.objects.create(
            tenant_slug=self.tenant.slug,
            command=command,
            status=status_value,
            empresa_id=empresa_id,
            days=90,
            refresh_projections=(command == FDIJobRun.Command.CAPTURE_SNAPSHOTS),
            projections_synced=3,
            snapshots_created=1 if command == FDIJobRun.Command.CAPTURE_SNAPSHOTS else 0,
            error_message="fallo controlado" if status_value == FDIJobRun.Status.FAILURE else "",
            metadata_json={"source": "test"},
            started_at=started_at,
            finished_at=finished_at,
            duration_ms=30000,
        )

    @patch("materialidad.api.dashboard.views.TenantContext.get_current_tenant")
    @patch("materialidad.api.dashboard.views.persist_fdi_snapshot", side_effect=AssertionError("No debe recalcular"))
    def test_dashboard_and_narrative_share_recent_snapshot(self, _mock_persist, mock_current_tenant):
        mock_current_tenant.return_value = self.tenant
        snapshot = self._create_recent_snapshot(days=90, score="73.4")
        FiscalDefenseIndexNarrative.objects.create(
            tenant_slug=self.tenant.slug,
            snapshot=snapshot,
            empresa_id=None,
            correlation_id=snapshot.correlation_id,
            audience="CFO",
            formula_version="fdi-v1",
            pipeline_version="pipeline-v1",
            headline="Narrativa desde snapshot",
            executive_summary="Resumen desde snapshot",
            evidence_points_json=["Punto 1"],
            priority_actions_json=["Acción 1"],
            payload_json={"source": "persisted"},
            source="persisted",
            model_name="artifact-v1",
        )

        fdi_response = self.client.get(
            "/api/materialidad/dashboard/fdi/?period_days=90",
        )
        narrative_response = self.client.post(
            "/api/materialidad/dashboard/fdi/narrative/",
            {"audience": "CFO", "period_days": 90},
            format="json",
        )

        self.assertEqual(fdi_response.status_code, 200, fdi_response.data)
        self.assertEqual(narrative_response.status_code, 200, narrative_response.data)
        self.assertEqual(fdi_response.data["score"], 73.4)
        self.assertEqual(narrative_response.data["fdi"]["score"], 73.4)
        self.assertEqual(narrative_response.data["fdi"]["level"], fdi_response.data["level"])
        self.assertEqual(narrative_response.data["fdi"]["generated_at"], snapshot.captured_at.isoformat())
        self.assertEqual(fdi_response.data["confidence"]["score"], 81.0)
        self.assertEqual(fdi_response.data["trace"]["formula_version"], "fdi-v1")
        self.assertEqual(narrative_response.data["fdi"]["confidence"]["score"], 81.0)
        persisted = FiscalDefenseIndexNarrative.objects.get(
            tenant_slug=self.tenant.slug,
            correlation_id=snapshot.correlation_id,
            audience="CFO",
        )
        self.assertEqual(persisted.snapshot_id, snapshot.id)
        self.assertEqual(persisted.headline, "Narrativa desde snapshot")
        self.assertEqual(persisted.formula_version, "fdi-v1")
        self.assertEqual(persisted.pipeline_version, "pipeline-v1")

    @patch("materialidad.api.dashboard.views.TenantContext.get_current_tenant")
    @patch("materialidad.api.dashboard.views.generate_fdi_narrative", side_effect=AssertionError("No debe regenerar"))
    @patch("materialidad.api.dashboard.views.persist_fdi_snapshot", side_effect=AssertionError("No debe recalcular"))
    def test_narrative_endpoint_prefers_persisted_artifact(self, _mock_persist, _mock_generate, mock_current_tenant):
        mock_current_tenant.return_value = self.tenant
        snapshot = self._create_recent_snapshot(days=90, score="73.4")
        FiscalDefenseIndexNarrative.objects.create(
            tenant_slug=self.tenant.slug,
            snapshot=snapshot,
            empresa_id=None,
            correlation_id=snapshot.correlation_id,
            audience="CFO",
            formula_version="fdi-v1",
            pipeline_version="pipeline-v1",
            headline="Narrativa persistida",
            executive_summary="Resumen persistido",
            evidence_points_json=["Punto persistido"],
            priority_actions_json=["Acción persistida"],
            payload_json={"source": "persisted"},
            source="persisted",
            model_name="artifact-v1",
        )

        response = self.client.post(
            "/api/materialidad/dashboard/fdi/narrative/",
            {"audience": "CFO", "period_days": 90},
            format="json",
        )

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["narrative"]["headline"], "Narrativa persistida")
        self.assertEqual(response.data["narrative"]["source"], "persisted")

    @patch("materialidad.api.dashboard.views.TenantContext.get_current_tenant")
    @patch("materialidad.api.dashboard.views.generate_fdi_narrative")
    @patch("materialidad.api.dashboard.views.persist_fdi_snapshot")
    def test_repeated_narrative_request_updates_same_artifact_for_same_correlation(
        self,
        mock_persist_snapshot,
        mock_narrative,
        mock_current_tenant,
    ):
        mock_current_tenant.return_value = self.tenant
        self.user.is_staff = True
        self.user.save(update_fields=["is_staff"])
        snapshot = self._create_recent_snapshot(days=90, score="73.4")
        mock_persist_snapshot.return_value = snapshot
        mock_narrative.side_effect = [
            {
                "headline": "Versión 1",
                "executive_summary": "Resumen 1",
                "evidence_points": ["Punto 1"],
                "priority_actions": ["Acción 1"],
                "generated_at": timezone.now().isoformat(),
                "source": "test",
                "model": "stub",
                "audience": "CFO",
            },
            {
                "headline": "Versión 2",
                "executive_summary": "Resumen 2",
                "evidence_points": ["Punto 2"],
                "priority_actions": ["Acción 2"],
                "generated_at": timezone.now().isoformat(),
                "source": "test",
                "model": "stub-v2",
                "audience": "CFO",
            },
        ]

        first = self.client.post(
            "/api/materialidad/dashboard/fdi/narrative/",
            {"audience": "CFO", "period_days": 90},
            format="json",
        )
        cache.clear()
        second = self.client.post(
            "/api/materialidad/dashboard/fdi/narrative/",
            {"audience": "CFO", "period_days": 90, "recalculate": True},
            format="json",
        )

        self.assertEqual(first.status_code, 200, first.data)
        self.assertEqual(second.status_code, 200, second.data)

        artifact = FiscalDefenseIndexNarrative.objects.get(
            tenant_slug=self.tenant.slug,
            correlation_id=snapshot.correlation_id,
            audience="CFO",
        )
        self.assertEqual(FiscalDefenseIndexNarrative.objects.count(), 1)
        self.assertEqual(artifact.headline, "Versión 2")
        self.assertEqual(artifact.model_name, "stub-v2")

    @patch("materialidad.api.dashboard.views.TenantContext.get_current_tenant")
    @patch("materialidad.api.dashboard.views.generate_fdi_narrative", side_effect=AssertionError("No debe generar"))
    @patch("materialidad.api.dashboard.views.persist_fdi_snapshot", side_effect=AssertionError("No debe recalcular"))
    def test_non_admin_gets_pending_narrative_when_artifact_missing(self, _mock_persist, _mock_generate, mock_current_tenant):
        mock_current_tenant.return_value = self.tenant
        self._create_recent_snapshot(days=90, score="73.4")

        response = self.client.post(
            "/api/materialidad/dashboard/fdi/narrative/",
            {"audience": "CFO", "period_days": 90},
            format="json",
        )

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["narrative"]["source"], "pending_persisted")
        self.assertIn("narrativa persistida", response.data["narrative"]["executive_summary"].lower())

    @patch("materialidad.api.dashboard.views.TenantContext.get_current_tenant")
    @patch("materialidad.api.dashboard.views.generate_fdi_narrative")
    @patch("materialidad.api.dashboard.views.persist_fdi_snapshot", side_effect=AssertionError("No debe recalcular"))
    def test_snapshot_with_different_period_returns_no_data_without_live_fallback(self, _mock_persist, mock_narrative, mock_current_tenant):
        mock_current_tenant.return_value = self.tenant
        self._create_recent_snapshot(days=90, score="73.4")
        mock_narrative.return_value = {
            "headline": "Narrativa 30d",
            "executive_summary": "Resumen 30d",
            "evidence_points": [],
            "priority_actions": [],
            "generated_at": timezone.now().isoformat(),
            "source": "test",
            "model": "stub",
            "audience": "CFO",
        }

        fdi_response = self.client.get(
            "/api/materialidad/dashboard/fdi/?period_days=30",
        )
        narrative_response = self.client.post(
            "/api/materialidad/dashboard/fdi/narrative/",
            {"audience": "CFO", "period_days": 30},
            format="json",
        )

        self.assertEqual(fdi_response.status_code, 200, fdi_response.data)
        self.assertEqual(narrative_response.status_code, 200, narrative_response.data)
        self.assertEqual(fdi_response.data["score"], 0.0)
        self.assertEqual(narrative_response.data["fdi"]["score"], 0.0)
        self.assertEqual(fdi_response.data["period"]["days"], 30)
        self.assertEqual(narrative_response.data["fdi"]["level"], "NO_DATA")
        self.assertFalse(fdi_response.data["inputs"].get("snapshot_available", True))

    @patch("materialidad.api.dashboard.views.TenantContext.get_current_tenant")
    @patch("materialidad.api.dashboard.views.persist_fdi_snapshot")
    def test_admin_can_recalculate_and_serve_persisted_snapshot(self, mock_persist_snapshot, mock_current_tenant):
        mock_current_tenant.return_value = self.tenant
        self.user.is_staff = True
        self.user.save(update_fields=["is_staff"])
        snapshot = self._create_recent_snapshot(days=30, score="68.2")
        mock_persist_snapshot.return_value = snapshot

        response = self.client.get("/api/materialidad/dashboard/fdi/?period_days=30&recalculate=true")

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["score"], 68.2)
        mock_persist_snapshot.assert_called_once()

    @patch("materialidad.api.dashboard.views.TenantContext.get_current_tenant")
    def test_non_admin_cannot_recalculate(self, mock_current_tenant):
        mock_current_tenant.return_value = self.tenant

        response = self.client.get("/api/materialidad/dashboard/fdi/?period_days=30&recalculate=true")

        self.assertEqual(response.status_code, 403)

    @patch("materialidad.api.dashboard.views.TenantContext.get_current_tenant")
    def test_history_returns_enriched_snapshot_series(self, mock_current_tenant):
        mock_current_tenant.return_value = self.tenant
        first = self._create_recent_snapshot(days=30, score="68.2")
        second = self._create_recent_snapshot(days=30, score="74.1")
        FiscalDefenseIndexSnapshot.objects.filter(pk=first.pk).update(captured_at=timezone.now() - timedelta(days=2))
        FiscalDefenseIndexSnapshot.objects.filter(pk=second.pk).update(captured_at=timezone.now() - timedelta(days=1))

        response = self.client.get("/api/materialidad/dashboard/fdi/history/?days=30")

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(len(response.data["series"]), 2)
        self.assertIn("confidence", response.data["series"][0])
        self.assertIn("correlation_id", response.data["series"][0])

    @patch("materialidad.api.dashboard.views.TenantContext.get_current_tenant")
    def test_job_run_history_requires_admin(self, mock_current_tenant):
        mock_current_tenant.return_value = self.tenant
        self._create_job_run()

        response = self.client.get("/api/materialidad/dashboard/fdi/job-runs/")

        self.assertEqual(response.status_code, 403)

    @patch("materialidad.api.dashboard.views.TenantContext.get_current_tenant")
    def test_job_run_history_returns_filtered_summary(self, mock_current_tenant):
        mock_current_tenant.return_value = self.tenant
        self.user.is_staff = True
        self.user.save(update_fields=["is_staff"])
        self._create_job_run(
            command=FDIJobRun.Command.REFRESH_PROJECTIONS,
            status_value=FDIJobRun.Status.SUCCESS,
            minutes_ago=30,
        )
        self._create_job_run(
            command=FDIJobRun.Command.CAPTURE_SNAPSHOTS,
            status_value=FDIJobRun.Status.FAILURE,
            minutes_ago=5,
        )

        response = self.client.get(
            "/api/materialidad/dashboard/fdi/job-runs/?command=capture_fdi_snapshots&status=failure&days=7&limit=20"
        )

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["summary"]["total"], 1)
        self.assertEqual(response.data["summary"]["failures"], 1)
        self.assertEqual(response.data["summary"]["failure_rate"], 100.0)
        self.assertEqual(response.data["summary"]["latest_command"], FDIJobRun.Command.CAPTURE_SNAPSHOTS)
        self.assertEqual(len(response.data["items"]), 1)
        self.assertEqual(response.data["items"][0]["status"], FDIJobRun.Status.FAILURE)
        self.assertEqual(response.data["items"][0]["error_message"], "fallo controlado")
        self.assertFalse(response.data["pagination"]["has_more"])
        self.assertIsNone(response.data["pagination"]["next_cursor"])

    @patch("materialidad.api.dashboard.views.TenantContext.get_current_tenant")
    def test_job_run_history_supports_cursor_pagination(self, mock_current_tenant):
        mock_current_tenant.return_value = self.tenant
        self.user.is_staff = True
        self.user.save(update_fields=["is_staff"])
        recent = self._create_job_run(minutes_ago=5)
        middle = self._create_job_run(minutes_ago=15)
        oldest = self._create_job_run(minutes_ago=25)

        first_page = self.client.get("/api/materialidad/dashboard/fdi/job-runs/?days=7&limit=2")

        self.assertEqual(first_page.status_code, 200, first_page.data)
        self.assertEqual([item["id"] for item in first_page.data["items"]], [recent.id, middle.id])
        self.assertTrue(first_page.data["pagination"]["has_more"])
        self.assertTrue(first_page.data["pagination"]["next_cursor"])

        cursor = first_page.data["pagination"]["next_cursor"]
        second_page = self.client.get(f"/api/materialidad/dashboard/fdi/job-runs/?days=7&limit=2&cursor={cursor}")

        self.assertEqual(second_page.status_code, 200, second_page.data)
        self.assertEqual([item["id"] for item in second_page.data["items"]], [oldest.id])
        self.assertFalse(second_page.data["pagination"]["has_more"])
        self.assertIsNone(second_page.data["pagination"]["next_cursor"])

    @patch("materialidad.api.dashboard.views.TenantContext.get_current_tenant")
    def test_job_run_history_can_filter_by_empresa(self, mock_current_tenant):
        mock_current_tenant.return_value = self.tenant
        self.user.is_staff = True
        self.user.save(update_fields=["is_staff"])
        expected = self._create_job_run(minutes_ago=5, empresa_id=77)
        self._create_job_run(minutes_ago=10, empresa_id=88)

        response = self.client.get("/api/materialidad/dashboard/fdi/job-runs/?days=7&empresa=77")

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual([item["id"] for item in response.data["items"]], [expected.id])
        self.assertEqual(response.data["items"][0]["empresa_id"], 77)
