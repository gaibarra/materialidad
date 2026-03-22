from __future__ import annotations

from datetime import date

from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from accounts.models import User
from materialidad.models import Contrato, Empresa, Operacion, Proveedor


@override_settings(TENANT_REQUIRED_PATH_PREFIXES=[])
class ProveedorDeleteTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            email="qa.proveedor.delete@example.com",
            password="Password123!",
        )
        self.client.force_authenticate(user=self.user)

        self.empresa = Empresa.objects.create(
            razon_social="Empresa QA SA de CV",
            rfc="EQA010101AAA",
            regimen_fiscal="601",
            estado="CDMX",
        )
        self.proveedor = Proveedor.objects.create(
            razon_social="Proveedor Delete SA de CV",
            rfc="PDE010101AAA",
        )

    def _crear_operacion(self, estatus_validacion: str) -> Operacion:
        contrato = Contrato.objects.create(
            empresa=self.empresa,
            proveedor=self.proveedor,
            nombre="Contrato proveedor delete test",
            categoria=Contrato.Categoria.PROVEEDORES,
            proceso=Contrato.ProcesoNegocio.OPERACIONES,
            tipo_empresa=Contrato.TipoEmpresa.SERVICIOS,
        )
        return Operacion.objects.create(
            empresa=self.empresa,
            proveedor=self.proveedor,
            contrato=contrato,
            uuid_cfdi="f8a428a8-9acf-4aeb-b49e-5cd1eaf3fb8a",
            monto="1000.00",
            moneda=Operacion.Moneda.MXN,
            fecha_operacion=date(2026, 2, 1),
            tipo_operacion=Operacion.TipoOperacion.SERVICIO,
            estatus_validacion=estatus_validacion,
        )

    def test_bloquea_eliminacion_si_hay_expediente_en_proceso(self):
        self._crear_operacion(Operacion.EstatusValidacion.EN_PROCESO)

        response = self.client.delete(f"/api/materialidad/proveedores/{self.proveedor.id}/")

        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.data.get("code"), "proveedor_delete_blocked_by_expedientes")
        self.assertTrue(Proveedor.objects.filter(id=self.proveedor.id).exists())

    def test_bloquea_eliminacion_si_hay_expediente_concluido(self):
        self._crear_operacion(Operacion.EstatusValidacion.VALIDADO)

        response = self.client.delete(f"/api/materialidad/proveedores/{self.proveedor.id}/")

        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.data.get("code"), "proveedor_delete_blocked_by_expedientes")
        self.assertTrue(Proveedor.objects.filter(id=self.proveedor.id).exists())

    def test_permite_eliminacion_si_no_hay_expedientes_abiertos_o_concluidos(self):
        self._crear_operacion(Operacion.EstatusValidacion.PENDIENTE)

        response = self.client.delete(f"/api/materialidad/proveedores/{self.proveedor.id}/")

        self.assertEqual(response.status_code, 204)
        self.assertFalse(Proveedor.objects.filter(id=self.proveedor.id).exists())
