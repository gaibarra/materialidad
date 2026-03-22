from __future__ import annotations

from datetime import date
from io import BytesIO

from django.test import TestCase, override_settings
from pypdf import PdfReader
from rest_framework.test import APIClient

from accounts.models import User
from materialidad.models import Contrato, Empresa, Operacion, Proveedor


@override_settings(TENANT_REQUIRED_PATH_PREFIXES=[])
class OperacionExportPdfTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            email="qa.pdf@example.com",
            password="Password123!",
        )
        self.client.force_authenticate(user=self.user)

        self.empresa = Empresa.objects.create(
            razon_social="Empresa PDF SA de CV",
            rfc="EPD010101AAA",
            regimen_fiscal="601",
            estado="CDMX",
        )
        self.proveedor = Proveedor.objects.create(
            razon_social="Proveedor PDF SA de CV",
            rfc="PPD010101AAA",
        )
        self.contrato = Contrato.objects.create(
            empresa=self.empresa,
            proveedor=self.proveedor,
            nombre="Contrato PDF",
            categoria=Contrato.Categoria.PROVEEDORES,
            proceso=Contrato.ProcesoNegocio.OPERACIONES,
            tipo_empresa=Contrato.TipoEmpresa.SERVICIOS,
        )

    def _crear_operacion(self) -> Operacion:
        return Operacion.objects.create(
            empresa=self.empresa,
            proveedor=self.proveedor,
            contrato=self.contrato,
            uuid_cfdi="d12504e0-4f89-41d3-9a0c-0305e82c3311",
            monto="1450.00",
            moneda=Operacion.Moneda.MXN,
            fecha_operacion=date(2026, 2, 1),
            tipo_operacion=Operacion.TipoOperacion.SERVICIO,
            concepto="Servicio fiscal de prueba para exportar PDF",
            estatus_validacion=Operacion.EstatusValidacion.EN_PROCESO,
            metadata={
                "riesgo_materialidad": {
                    "nivel": "MEDIO",
                    "score": 35,
                    "motivos": ["Faltante documental de bitácora"],
                }
            },
        )

    def test_exportar_pdf_defensa_descarga_pdf_valido(self):
        operacion = self._crear_operacion()

        response = self.client.get(f"/api/materialidad/operaciones/{operacion.id}/exportar-pdf-defensa/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "application/pdf")
        self.assertIn("attachment; filename=", response["Content-Disposition"])
        self.assertTrue(response.content.startswith(b"%PDF"))
        self.assertGreater(len(response.content), 500)

    def test_exportar_pdf_defensa_contiene_secciones_minimas(self):
        operacion = self._crear_operacion()

        response = self.client.get(f"/api/materialidad/operaciones/{operacion.id}/exportar-pdf-defensa/")
        self.assertEqual(response.status_code, 200)

        reader = PdfReader(BytesIO(response.content))
        extracted_text = "\n".join((page.extract_text() or "") for page in reader.pages)

        self.assertIn("REPORTE DE DEFENSA FISCAL", extracted_text)
        self.assertIn("INDICE DE ANEXOS", extracted_text)
        self.assertIn(f"Operacion #{operacion.id}", extracted_text)
        self.assertIn("Sintesis ejecutiva de materialidad operativa", extracted_text)
        self.assertIn("Score: 35", extracted_text)
