from __future__ import annotations

import hashlib
import json
from datetime import date
from io import BytesIO
from zipfile import ZipFile

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from accounts.models import User
from materialidad.models import Contrato, Empresa, EvidenciaMaterial, Operacion, Proveedor


@override_settings(TENANT_REQUIRED_PATH_PREFIXES=[])
class OperacionExportDossierTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            email="qa.zip@example.com",
            password="Password123!",
        )
        self.client.force_authenticate(user=self.user)

        self.empresa = Empresa.objects.create(
            razon_social="Empresa ZIP SA de CV",
            rfc="EZS010101AAA",
            regimen_fiscal="601",
            estado="CDMX",
        )
        self.proveedor = Proveedor.objects.create(
            razon_social="Proveedor ZIP SA de CV",
            rfc="PZS010101AAA",
        )
        self.contrato = Contrato.objects.create(
            empresa=self.empresa,
            proveedor=self.proveedor,
            nombre="Contrato ZIP",
            categoria=Contrato.Categoria.PROVEEDORES,
            proceso=Contrato.ProcesoNegocio.OPERACIONES,
            tipo_empresa=Contrato.TipoEmpresa.SERVICIOS,
        )

    def _crear_operacion(self) -> Operacion:
        operacion = Operacion.objects.create(
            empresa=self.empresa,
            proveedor=self.proveedor,
            contrato=self.contrato,
            uuid_cfdi="a12504e0-4f89-41d3-9a0c-0305e82c3322",
            monto="2450.00",
            moneda=Operacion.Moneda.MXN,
            fecha_operacion=date(2026, 2, 15),
            tipo_operacion=Operacion.TipoOperacion.SERVICIO,
            concepto="Servicio de documentación probatoria",
            estatus_validacion=Operacion.EstatusValidacion.EN_PROCESO,
        )

        EvidenciaMaterial.objects.create(
            operacion=operacion,
            tipo=EvidenciaMaterial.Tipo.ENTREGABLE,
            archivo=SimpleUploadedFile("evidencia-zip.txt", b"contenido evidencia zip"),
            descripcion="Evidencia ZIP",
        )
        return operacion

    def test_exportar_dossier_incluye_manifiesto_integridad(self):
        operacion = self._crear_operacion()

        response = self.client.get(f"/api/materialidad/operaciones/{operacion.id}/exportar-dossier/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "application/zip")
        self.assertTrue(response.content.startswith(b"PK"))

        zip_file = ZipFile(BytesIO(response.content))
        names = set(zip_file.namelist())

        self.assertIn("indice.json", names)
        self.assertIn("README.txt", names)
        self.assertIn("manifiesto_integridad.json", names)

        manifest = json.loads(zip_file.read("manifiesto_integridad.json").decode("utf-8"))
        self.assertEqual(manifest["operacion_id"], operacion.id)
        self.assertEqual(manifest["algorithm"], "sha256")
        self.assertGreaterEqual(len(manifest["files"]), 2)

    def test_manifiesto_sha256_coincide_con_archivos_en_zip(self):
        operacion = self._crear_operacion()

        response = self.client.get(f"/api/materialidad/operaciones/{operacion.id}/exportar-dossier/")
        self.assertEqual(response.status_code, 200)

        zip_file = ZipFile(BytesIO(response.content))
        manifest = json.loads(zip_file.read("manifiesto_integridad.json").decode("utf-8"))

        for item in manifest["files"]:
            file_path = item["path"]
            payload = zip_file.read(file_path)
            expected_hash = hashlib.sha256(payload).hexdigest()
            self.assertEqual(item["sha256"], expected_hash)
            self.assertEqual(item["size_bytes"], len(payload))
