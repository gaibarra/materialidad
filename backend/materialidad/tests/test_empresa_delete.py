from __future__ import annotations

from datetime import date

from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from accounts.models import User
from materialidad.models import Contrato, Empresa, Operacion, Proveedor


@override_settings(TENANT_REQUIRED_PATH_PREFIXES=[])
class EmpresaDeleteTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            email="qa.empresa.delete@example.com",
            password="Password123!",
        )
        self.client.force_authenticate(user=self.user)

        self.empresa = Empresa.objects.create(
            razon_social="Empresa Delete SA de CV",
            rfc="EDL010101AAA",
            regimen_fiscal="601",
            estado="CDMX",
        )
        self.proveedor = Proveedor.objects.create(
            razon_social="Proveedor Delete SA de CV",
            rfc="PDL010101AAA",
        )

    def _crear_operacion(self, estatus_validacion: str) -> Operacion:
        contrato = Contrato.objects.create(
            empresa=self.empresa,
            proveedor=self.proveedor,
            nombre="Contrato delete test",
            categoria=Contrato.Categoria.PROVEEDORES,
            proceso=Contrato.ProcesoNegocio.OPERACIONES,
            tipo_empresa=Contrato.TipoEmpresa.SERVICIOS,
        )
        return Operacion.objects.create(
            empresa=self.empresa,
            proveedor=self.proveedor,
            contrato=contrato,
            uuid_cfdi="d12504e0-4f89-41d3-9a0c-0305e82c3311",
            monto="1000.00",
            moneda=Operacion.Moneda.MXN,
            fecha_operacion=date(2026, 2, 1),
            tipo_operacion=Operacion.TipoOperacion.SERVICIO,
            estatus_validacion=estatus_validacion,
        )

    def test_bloquea_eliminacion_si_hay_expediente_en_proceso(self):
        self._crear_operacion(Operacion.EstatusValidacion.EN_PROCESO)

        response = self.client.delete(f"/api/materialidad/empresas/{self.empresa.id}/")

        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.data.get("code"), "empresa_delete_blocked_by_expedientes")
        self.assertIn("en proceso o terminados", response.data.get("detail", ""))
        self.assertTrue(Empresa.objects.filter(id=self.empresa.id).exists())

    def test_bloquea_eliminacion_si_hay_expediente_terminado(self):
        self._crear_operacion(Operacion.EstatusValidacion.VALIDADO)

        response = self.client.delete(f"/api/materialidad/empresas/{self.empresa.id}/")

        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.data.get("code"), "empresa_delete_blocked_by_expedientes")
        self.assertTrue(Empresa.objects.filter(id=self.empresa.id).exists())

    def test_permite_eliminacion_con_expediente_pendiente(self):
        self._crear_operacion(Operacion.EstatusValidacion.PENDIENTE)

        response = self.client.delete(f"/api/materialidad/empresas/{self.empresa.id}/")

        self.assertEqual(response.status_code, 204)
        self.assertFalse(Empresa.objects.filter(id=self.empresa.id).exists())
