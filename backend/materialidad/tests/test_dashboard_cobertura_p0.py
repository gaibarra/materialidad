from __future__ import annotations

from datetime import date, timedelta
from unittest.mock import patch
from uuid import uuid4

from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import DatabaseError
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import User
from materialidad.models import AlertaOperacion, Contrato, Empresa, EvidenciaMaterial, FDIJobRun, FiscalDefenseIndexSnapshot, Operacion, Proveedor
from materialidad.defense_projection import sync_operation_defense_projection


@override_settings(TENANT_REQUIRED_PATH_PREFIXES=[])
class DashboardCoberturaP0Tests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(email="qa.dashboard@example.com", password="Password123!")
        self.client.force_authenticate(user=self.user)

        self.empresa = Empresa.objects.create(
            razon_social="Empresa Cobertura SA de CV",
            rfc="ECS010101AAA",
            regimen_fiscal="601",
            estado="CDMX",
        )
        self.proveedor = Proveedor.objects.create(
            razon_social="Proveedor Cobertura SA de CV",
            rfc="PCS010101AAA",
        )
        self.contrato = Contrato.objects.create(
            empresa=self.empresa,
            proveedor=self.proveedor,
            nombre="Contrato Cobertura",
            categoria=Contrato.Categoria.PROVEEDORES,
            proceso=Contrato.ProcesoNegocio.OPERACIONES,
            tipo_empresa=Contrato.TipoEmpresa.SERVICIOS,
        )

    def _crear_operacion(self, **kwargs) -> Operacion:
        defaults = {
            "empresa": self.empresa,
            "proveedor": self.proveedor,
            "monto": "1200.00",
            "moneda": Operacion.Moneda.MXN,
            "fecha_operacion": date(2026, 2, 10),
            "tipo_operacion": Operacion.TipoOperacion.SERVICIO,
            "concepto": "Servicio dashboard",
            "estatus_validacion": Operacion.EstatusValidacion.PENDIENTE,
        }
        defaults.update(kwargs)
        return Operacion.objects.create(**defaults)

    def test_dashboard_cobertura_p0_devuelve_contrato_esperado(self):
        completa = self._crear_operacion(
            contrato=self.contrato,
            uuid_cfdi="d12504e0-4f89-41d3-9a0c-0305e82c3311",
            referencia_spei="SPEI-COV-001",
            estatus_validacion=Operacion.EstatusValidacion.VALIDADO,
            metadata={"riesgo_materialidad": {"nivel": "BAJO", "score": 0, "motivos": []}},
        )
        EvidenciaMaterial.objects.create(
            operacion=completa,
            tipo=EvidenciaMaterial.Tipo.ENTREGABLE,
            archivo=SimpleUploadedFile("entregable-cov.txt", b"ok"),
            descripcion="Entregable",
        )
        EvidenciaMaterial.objects.create(
            operacion=completa,
            tipo=EvidenciaMaterial.Tipo.BITACORA,
            archivo=SimpleUploadedFile("bitacora-cov.txt", b"ok"),
            descripcion="Bitacora",
        )

        incompleta = self._crear_operacion(uuid_cfdi="", referencia_spei="", contrato=None)
        AlertaOperacion.objects.create(
            operacion=incompleta,
            empresa=self.empresa,
            proveedor=self.proveedor,
            tipo_alerta=AlertaOperacion.TipoAlerta.FALTANTES_CRITICOS,
            estatus=AlertaOperacion.Estatus.ACTIVA,
            clave_dedupe="demo-key",
            owner_email=self.user.email,
            motivo="Faltantes críticos",
            detalle={"faltantes": ["UUID CFDI"]},
        )

        response = self.client.get("/api/materialidad/dashboard/metricas/cobertura-p0/?days=90")
        self.assertEqual(response.status_code, 200)

        payload = response.data
        self.assertIn("coverage", payload)
        self.assertIn("riesgo_distribution", payload)
        self.assertIn("alertas", payload)
        self.assertIn("trend_weekly", payload)

        self.assertEqual(payload["coverage"]["total_operaciones"], 2)
        self.assertEqual(payload["coverage"]["completas"], 1)
        self.assertEqual(payload["coverage"]["incompletas"], 1)
        self.assertGreaterEqual(payload["alertas"]["activas_total"], 1)

    def test_dashboard_cobertura_p0_filtra_por_empresa(self):
        empresa_otra = Empresa.objects.create(
            razon_social="Empresa Otra SA de CV",
            rfc="EOS010101AAA",
            regimen_fiscal="601",
            estado="CDMX",
        )
        proveedor_otro = Proveedor.objects.create(
            razon_social="Proveedor Otro SA de CV",
            rfc="POS010101AAA",
        )

        self._crear_operacion(empresa=self.empresa, proveedor=self.proveedor)
        self._crear_operacion(empresa=empresa_otra, proveedor=proveedor_otro)

        response = self.client.get(f"/api/materialidad/dashboard/metricas/cobertura-p0/?empresa={self.empresa.id}")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["coverage"]["total_operaciones"], 1)

        bad_response = self.client.get("/api/materialidad/dashboard/metricas/cobertura-p0/?empresa=abc")
        self.assertEqual(bad_response.status_code, 400)
        self.assertIn("detail", bad_response.data)

    def test_dashboard_cobertura_p0_tolera_metadata_no_dict(self):
        self._crear_operacion(
            empresa=self.empresa,
            proveedor=self.proveedor,
            metadata=["valor-invalido"],
        )

        response = self.client.get("/api/materialidad/dashboard/metricas/cobertura-p0/?days=90")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["coverage"]["total_operaciones"], 1)

    @patch("materialidad.services.AlertaOperacion.objects.filter", side_effect=DatabaseError("table missing"))
    def test_dashboard_cobertura_p0_no_falla_si_alertas_no_disponibles(self, _mock_alertas_filter):
        self._crear_operacion(empresa=self.empresa, proveedor=self.proveedor)

        response = self.client.get("/api/materialidad/dashboard/metricas/cobertura-p0/?days=90")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["alertas"]["activas_total"], 0)
        self.assertEqual(
            response.data["alertas"]["por_tipo"][AlertaOperacion.TipoAlerta.FALTANTES_CRITICOS],
            0,
        )

    def test_dashboard_metricas_expone_observabilidad_fdi_pipeline(self):
        operacion = self._crear_operacion(
            contrato=self.contrato,
            uuid_cfdi="d12504e0-4f89-41d3-9a0c-0305e82c3399",
            referencia_spei="SPEI-METRICAS-001",
            estatus_validacion=Operacion.EstatusValidacion.VALIDADO,
        )
        EvidenciaMaterial.objects.create(
            operacion=operacion,
            tipo=EvidenciaMaterial.Tipo.ENTREGABLE,
            archivo=SimpleUploadedFile("entregable-metricas.txt", b"ok"),
            descripcion="Entregable",
        )
        EvidenciaMaterial.objects.create(
            operacion=operacion,
            tipo=EvidenciaMaterial.Tipo.BITACORA,
            archivo=SimpleUploadedFile("bitacora-metricas.txt", b"ok"),
            descripcion="Bitacora",
        )
        sync_operation_defense_projection(operacion=operacion, tenant_slug="global")
        FiscalDefenseIndexSnapshot.objects.create(
            tenant_slug="global",
            empresa_id=self.empresa.id,
            period_start=timezone.localdate() - timedelta(days=29),
            period_end=timezone.localdate(),
            score="72.0",
            level="CONTROLADO",
            dm="70.0",
            se="68.0",
            sc="80.0",
            ec="25.0",
            do="85.0",
            confidence_score="78.0",
            formula_version="fdi-v1",
            pipeline_version="pipeline-v1",
            correlation_id=uuid4(),
            inputs_json={},
            actions_json=[],
            source="test",
        )
        FDIJobRun.objects.create(
            tenant_slug="global",
            command=FDIJobRun.Command.CAPTURE_SNAPSHOTS,
            status=FDIJobRun.Status.FAILURE,
            empresa_id=self.empresa.id,
            days=90,
            refresh_projections=True,
            projections_synced=1,
            snapshots_created=0,
            error_message="snapshot failed",
            metadata_json={},
            started_at=timezone.now() - timedelta(minutes=15),
            finished_at=timezone.now() - timedelta(minutes=14),
            duration_ms=1200,
        )

        response = self.client.get("/api/materialidad/dashboard/metricas/")

        self.assertEqual(response.status_code, 200)
        self.assertIn("fdi_pipeline", response.data)
        self.assertIn("projection", response.data["fdi_pipeline"])
        self.assertIn("snapshot", response.data["fdi_pipeline"])
        self.assertIn("divergence", response.data["fdi_pipeline"])
        self.assertIn("job_runs", response.data["fdi_pipeline"])
        self.assertIn("readiness", response.data["fdi_pipeline"])
        self.assertIn("alerts", response.data["fdi_pipeline"])
        self.assertEqual(response.data["fdi_pipeline"]["job_runs"]["last_error"], "snapshot failed")
