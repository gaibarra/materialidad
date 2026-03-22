from __future__ import annotations

from unittest.mock import patch

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from accounts.models import User
from materialidad.models import Empresa


@override_settings(TENANT_REQUIRED_PATH_PREFIXES=[])
class EmpresaUploadCSFSafeTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            email="qa.empresa.csf@example.com",
            password="Password123!",
        )
        self.client.force_authenticate(user=self.user)

        self.empresa_1 = Empresa.objects.create(
            razon_social="Empresa Uno SA de CV",
            rfc="EUO010101AAA",
            regimen_fiscal="601",
            estado="CDMX",
        )
        self.empresa_2 = Empresa.objects.create(
            razon_social="Empresa Dos SA de CV",
            rfc="EDO010101AAA",
            regimen_fiscal="601",
            estado="JALISCO",
        )

    @patch("materialidad.views.extract_csf_data")
    def test_upload_csf_no_sobrescribe_empresa_si_envian_id(self, mock_extract):
        mock_extract.return_value = {
            "tipo_persona": "MORAL",
            "rfc": "NUE010101AAA",
            "razon_social": "NUEVA RAZON",
            "regimen_fiscal": "601",
            "estado": "NUEVO LEON",
        }
        archivo = SimpleUploadedFile("csf.pdf", b"%PDF-1.4 fake", content_type="application/pdf")

        response = self.client.post(
            "/api/materialidad/empresas/upload-csf/",
            {"archivo": archivo, "id": self.empresa_1.id},
            format="multipart",
        )

        self.assertEqual(response.status_code, 200)
        self.assertIn("datos_extraidos", response.data)
        self.assertNotIn("registro", response.data)

        self.empresa_1.refresh_from_db()
        self.empresa_2.refresh_from_db()

        self.assertEqual(self.empresa_1.razon_social, "Empresa Uno SA de CV")
        self.assertEqual(self.empresa_1.rfc, "EUO010101AAA")
        self.assertEqual(self.empresa_2.razon_social, "Empresa Dos SA de CV")
        self.assertEqual(self.empresa_2.rfc, "EDO010101AAA")
