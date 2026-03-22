from __future__ import annotations

from unittest.mock import patch

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from accounts.models import User
from materialidad.models import Proveedor


@override_settings(TENANT_REQUIRED_PATH_PREFIXES=[])
class ProveedorUploadCSFSafeTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            email="qa.proveedor.csf@example.com",
            password="Password123!",
        )
        self.client.force_authenticate(user=self.user)

        self.proveedor_1 = Proveedor.objects.create(
            razon_social="Proveedor Uno SA de CV",
            rfc="PUO010101AAA",
        )
        self.proveedor_2 = Proveedor.objects.create(
            razon_social="Proveedor Dos SA de CV",
            rfc="PDO010101AAA",
        )

    @patch("materialidad.views.extract_csf_data")
    def test_upload_csf_no_sobrescribe_proveedor_si_envian_id(self, mock_extract):
        mock_extract.return_value = {
            "tipo_persona": "MORAL",
            "rfc": "NVP010101AAA",
            "razon_social": "NUEVO PROVEEDOR",
            "regimen_fiscal": "601",
            "estado": "SONORA",
        }
        archivo = SimpleUploadedFile("csf.pdf", b"%PDF-1.4 fake", content_type="application/pdf")

        response = self.client.post(
            "/api/materialidad/proveedores/upload-csf/",
            {"archivo": archivo, "id": self.proveedor_1.id},
            format="multipart",
        )

        self.assertEqual(response.status_code, 200)
        self.assertIn("datos_extraidos", response.data)
        self.assertNotIn("registro", response.data)

        self.proveedor_1.refresh_from_db()
        self.proveedor_2.refresh_from_db()

        self.assertEqual(self.proveedor_1.razon_social, "Proveedor Uno SA de CV")
        self.assertEqual(self.proveedor_1.rfc, "PUO010101AAA")
        self.assertEqual(self.proveedor_2.razon_social, "Proveedor Dos SA de CV")
        self.assertEqual(self.proveedor_2.rfc, "PDO010101AAA")
