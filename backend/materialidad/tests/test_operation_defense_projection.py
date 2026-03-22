from __future__ import annotations

from datetime import date, timedelta
from types import SimpleNamespace
from unittest.mock import patch
from uuid import uuid4

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.utils import timezone

from materialidad.defense_projection import calculate_fiscal_defense_index_from_projections, sync_operation_defense_projection
from materialidad.fdi_engine import FORMULA_VERSION, PIPELINE_VERSION
from materialidad.services import calculate_fiscal_defense_index_internal, persist_fdi_snapshot
from materialidad.models import Contrato, Empresa, EvidenciaMaterial, Operacion, OperationDefenseProjection, Proveedor


class OperationDefenseProjectionTests(TestCase):
    def setUp(self):
        self.empresa = Empresa.objects.create(
            razon_social="Empresa Proyeccion SA de CV",
            rfc="EPR010101AAA",
            regimen_fiscal="601",
            estado="CDMX",
        )
        self.proveedor = Proveedor.objects.create(
            razon_social="Proveedor Proyeccion SA de CV",
            rfc="PPR010101AAA",
            riesgo_fiscal=Proveedor.Riesgo.BAJO,
            ultima_validacion_sat=timezone.now() - timedelta(days=10),
        )
        self.contrato = Contrato.objects.create(
            empresa=self.empresa,
            proveedor=self.proveedor,
            nombre="Contrato proyeccion",
            categoria=Contrato.Categoria.PROVEEDORES,
            proceso=Contrato.ProcesoNegocio.OPERACIONES,
            tipo_empresa=Contrato.TipoEmpresa.SERVICIOS,
            vigencia_inicio=date(2026, 1, 1),
            vigencia_fin=date(2026, 12, 31),
            razon_negocio_estado="APROBADO",
            fecha_cierta_requerida=False,
        )
        self.operacion = Operacion.objects.create(
            empresa=self.empresa,
            proveedor=self.proveedor,
            contrato=self.contrato,
            uuid_cfdi="3f2504e0-4f89-41d3-9a0c-0305e82c3301",
            referencia_spei="SPEI-654321",
            monto="15000.00",
            moneda=Operacion.Moneda.MXN,
            fecha_operacion=date(2026, 2, 10),
            tipo_operacion=Operacion.TipoOperacion.SERVICIO,
            estatus_validacion=Operacion.EstatusValidacion.VALIDADO,
            cfdi_estatus=Operacion.EstatusCFDI.VALIDO,
            spei_estatus=Operacion.EstatusSPEI.VALIDADO,
        )
        EvidenciaMaterial.objects.create(
            operacion=self.operacion,
            tipo=EvidenciaMaterial.Tipo.ENTREGABLE,
            archivo=SimpleUploadedFile("entregable.txt", b"entregable"),
            descripcion="Entregable final",
        )
        EvidenciaMaterial.objects.create(
            operacion=self.operacion,
            tipo=EvidenciaMaterial.Tipo.BITACORA,
            archivo=SimpleUploadedFile("bitacora.txt", b"bitacora"),
            descripcion="Bitacora de seguimiento",
        )

    def _create_operacion_with_evidence(self, *, fecha_operacion: date, uuid_cfdi: str, referencia_spei: str) -> Operacion:
        operacion = Operacion.objects.create(
            empresa=self.empresa,
            proveedor=self.proveedor,
            contrato=self.contrato,
            uuid_cfdi=uuid_cfdi,
            referencia_spei=referencia_spei,
            monto="5000.00",
            moneda=Operacion.Moneda.MXN,
            fecha_operacion=fecha_operacion,
            tipo_operacion=Operacion.TipoOperacion.SERVICIO,
            estatus_validacion=Operacion.EstatusValidacion.VALIDADO,
            cfdi_estatus=Operacion.EstatusCFDI.VALIDO,
            spei_estatus=Operacion.EstatusSPEI.VALIDADO,
        )
        EvidenciaMaterial.objects.create(
            operacion=operacion,
            tipo=EvidenciaMaterial.Tipo.ENTREGABLE,
            archivo=SimpleUploadedFile(f"entregable-{operacion.id}.txt", b"entregable"),
            descripcion="Entregable",
        )
        EvidenciaMaterial.objects.create(
            operacion=operacion,
            tipo=EvidenciaMaterial.Tipo.BITACORA,
            archivo=SimpleUploadedFile(f"bitacora-{operacion.id}.txt", b"bitacora"),
            descripcion="Bitacora",
        )
        return operacion

    def test_sync_creates_projection_with_versions_and_scores(self):
        projection = sync_operation_defense_projection(
            operacion=self.operacion,
            tenant_slug="tenant-test",
        )

        self.assertEqual(projection.tenant_slug, "tenant-test")
        self.assertEqual(projection.formula_version, FORMULA_VERSION)
        self.assertEqual(projection.pipeline_version, PIPELINE_VERSION)
        self.assertTrue(projection.included_in_fdi)
        self.assertGreater(float(projection.score_base), 0.0)
        self.assertGreater(float(projection.confidence_score), 0.0)
        self.assertEqual(projection.profile, "SERVICIOS")
        self.assertEqual(projection.inputs_json["provider_riesgo_fiscal"], Proveedor.Riesgo.BAJO)

    def test_sync_updates_existing_projection_idempotently(self):
        first = sync_operation_defense_projection(
            operacion=self.operacion,
            tenant_slug="tenant-test",
            correlation_id=uuid4(),
        )
        self.proveedor.riesgo_fiscal = Proveedor.Riesgo.ALTO
        self.proveedor.save(update_fields=["riesgo_fiscal", "updated_at"])

        second_correlation = uuid4()
        second = sync_operation_defense_projection(
            operacion=self.operacion,
            tenant_slug="tenant-test",
            correlation_id=second_correlation,
        )

        self.assertEqual(first.pk, second.pk)
        self.assertEqual(OperationDefenseProjection.objects.count(), 1)
        self.assertEqual(second.correlation_id, second_correlation)
        self.assertIn("proveedor_riesgo_alto", second.risk_flags_json)

    def test_sync_excludes_pending_operation_with_critical_missing_documents(self):
        operacion = Operacion.objects.create(
            empresa=self.empresa,
            proveedor=self.proveedor,
            monto="5000.00",
            moneda=Operacion.Moneda.MXN,
            fecha_operacion=date(2026, 2, 12),
            tipo_operacion=Operacion.TipoOperacion.COMPRA,
            estatus_validacion=Operacion.EstatusValidacion.PENDIENTE,
            cfdi_estatus=Operacion.EstatusCFDI.PENDIENTE,
            spei_estatus=Operacion.EstatusSPEI.PENDIENTE,
        )

        projection = sync_operation_defense_projection(
            operacion=operacion,
            tenant_slug="tenant-test",
        )

        self.assertFalse(projection.included_in_fdi)
        self.assertLess(float(projection.dm), 30.0)
        self.assertLess(float(projection.se), 40.0)
        self.assertLess(float(projection.completeness_quality), 60.0)

    def test_aggregate_fdi_uses_operation_projections(self):
        sync_operation_defense_projection(
            operacion=self.operacion,
            tenant_slug="tenant-test",
        )

        payload = calculate_fiscal_defense_index_from_projections(
            days=90,
            tenant_slug="tenant-test",
            refresh=False,
        )

        self.assertEqual(payload["meta"]["source"], "operation_defense_projection")
        self.assertEqual(payload["inputs"]["total_operaciones"], 1)
        self.assertEqual(payload["inputs"]["operaciones_en_universo"], 1)
        self.assertGreater(payload["score"], 0.0)

    def test_aggregate_filters_projection_window_and_aligns_trace_to_window_universe(self):
        today = timezone.localdate()
        recent_operacion = self._create_operacion_with_evidence(
            fecha_operacion=today - timedelta(days=3),
            uuid_cfdi="3f2504e0-4f89-41d3-9a0c-0305e82c3302",
            referencia_spei="SPEI-RECENT",
        )
        old_operacion = self._create_operacion_with_evidence(
            fecha_operacion=today - timedelta(days=40),
            uuid_cfdi="3f2504e0-4f89-41d3-9a0c-0305e82c3303",
            referencia_spei="SPEI-OLD",
        )
        recent_correlation = uuid4()
        old_correlation = uuid4()

        sync_operation_defense_projection(
            operacion=recent_operacion,
            tenant_slug="tenant-test",
            correlation_id=recent_correlation,
        )
        sync_operation_defense_projection(
            operacion=old_operacion,
            tenant_slug="tenant-test",
            correlation_id=old_correlation,
        )

        payload = calculate_fiscal_defense_index_from_projections(
            days=14,
            tenant_slug="tenant-test",
            refresh=False,
        )

        self.assertEqual(payload["inputs"]["total_operaciones"], 1)
        self.assertEqual(payload["inputs"]["projection_groups"], 1)
        self.assertEqual(payload["trace"]["correlation_id"], str(recent_correlation))

    @patch("materialidad.defense_projection.TenantContext.get_current_tenant")
    @patch("materialidad.services._calculate_legacy_fdi_internal")
    def test_internal_calculation_adds_legacy_comparison(self, mock_legacy, mock_current_tenant):
        mock_current_tenant.return_value = SimpleNamespace(slug="tenant-test")
        mock_legacy.return_value = {"score": 65.0, "level": "CONTROLADO"}
        sync_operation_defense_projection(
            operacion=self.operacion,
            tenant_slug="tenant-test",
        )

        payload = calculate_fiscal_defense_index_internal(days=90, empresa_id=self.empresa.id)

        self.assertIn("legacy_comparison", payload["meta"])
        self.assertEqual(payload["meta"]["legacy_comparison"]["legacy_score"], 65.0)
        self.assertIn("score_delta", payload["meta"]["legacy_comparison"])

    @patch("materialidad.services.TenantContext.get_current_tenant")
    def test_persist_snapshot_stores_confidence_and_trace(self, mock_current_tenant):
        mock_current_tenant.return_value = SimpleNamespace(slug="tenant-test")
        sync_operation_defense_projection(
            operacion=self.operacion,
            tenant_slug="tenant-test",
        )

        snapshot = persist_fdi_snapshot(days=90, source="test")

        self.assertGreater(float(snapshot.confidence_score), 0.0)
        self.assertEqual(snapshot.formula_version, FORMULA_VERSION)
        self.assertEqual(snapshot.pipeline_version, PIPELINE_VERSION)
        self.assertIsNotNone(snapshot.correlation_id)

    @override_settings(FDI_ALLOW_LEGACY_FALLBACK=True)
    @patch("materialidad.services._calculate_legacy_fdi_internal")
    @patch("materialidad.defense_projection.calculate_fiscal_defense_index_from_projections", side_effect=RuntimeError("projection failed"))
    def test_internal_calculation_can_fallback_to_legacy_when_enabled(self, _mock_projection, mock_legacy):
        mock_legacy.return_value = {"score": 50.0, "level": "DEBIL"}

        payload = calculate_fiscal_defense_index_internal(days=90, empresa_id=self.empresa.id)

        self.assertEqual(payload["score"], 50.0)
        self.assertEqual(payload["level"], "DEBIL")

    @override_settings(FDI_ALLOW_LEGACY_FALLBACK=False)
    @patch("materialidad.defense_projection.calculate_fiscal_defense_index_from_projections", side_effect=RuntimeError("projection failed"))
    def test_internal_calculation_raises_when_legacy_fallback_disabled(self, _mock_projection):
        with self.assertRaises(RuntimeError):
            calculate_fiscal_defense_index_internal(days=90, empresa_id=self.empresa.id)