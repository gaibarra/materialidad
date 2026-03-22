from __future__ import annotations

import shutil
import tempfile

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from accounts.models import User
from materialidad.models import LegalCorpusUpload, LegalReferenceSource


@override_settings(TENANT_REQUIRED_PATH_PREFIXES=[])
class LegalCorpusUploadTests(TestCase):
    def setUp(self):
        self.media_dir = tempfile.mkdtemp(prefix="materialidad-legal-corpus-")
        self.override = override_settings(MEDIA_ROOT=self.media_dir)
        self.override.enable()
        self.client = APIClient()
        self.superuser = User.objects.create_superuser(email="root@example.com", password="Password123!")
        self.staff = User.objects.create_user(email="staff@example.com", password="Password123!", is_staff=True)

    def tearDown(self):
        self.override.disable()
        shutil.rmtree(self.media_dir, ignore_errors=True)

    def test_superuser_can_upload_and_process_legal_corpus(self):
        self.client.force_authenticate(user=self.superuser)
        file_obj = SimpleUploadedFile(
            "cff_articulo_5.txt",
            b"Articulo 5 del Codigo Fiscal de la Federacion. Las disposiciones fiscales son de aplicacion estricta.\n\nArticulo 6. Las contribuciones se causan conforme se realizan las situaciones juridicas o de hecho.",
            content_type="text/plain",
        )

        response = self.client.post(
            "/api/materialidad/corpus-legales/",
            {
                "titulo": "CFF vigente marzo 2026",
                "autoridad": "DOF",
                "ordenamiento": "Código Fiscal de la Federación",
                "tipo_fuente": LegalReferenceSource.SourceType.LEY,
                "archivo": file_obj,
                "estatus_vigencia": LegalReferenceSource.VigencyStatus.VIGENTE,
                "es_vigente": True,
                "fecha_ultima_revision": "2026-03-09",
                "fuente_documento": "DOF texto vigente",
                "fuente_url": "https://www.dof.gob.mx/",
                "procesar_ahora": "true",
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, 201, response.data)
        upload = LegalCorpusUpload.objects.get(pk=response.data["id"])
        self.assertEqual(upload.estatus, LegalCorpusUpload.ProcessingStatus.COMPLETADO)
        self.assertGreater(upload.fragmentos_procesados, 0)

        sources = LegalReferenceSource.objects.filter(corpus_upload=upload)
        self.assertTrue(sources.exists())
        source = sources.first()
        assert source is not None
        self.assertEqual(source.autoridad_emisora, "DOF")
        self.assertEqual(source.ordenamiento, "Código Fiscal de la Federación")
        self.assertEqual(source.vectorizacion_modelo, "hash64-v1")
        self.assertEqual(source.vectorizacion_dim, 64)
        self.assertTrue(bool(source.vectorizacion))

    def test_staff_cannot_upload_legal_corpus(self):
        self.client.force_authenticate(user=self.staff)
        file_obj = SimpleUploadedFile(
            "lisr.txt",
            b"Articulo 27. Las deducciones autorizadas deben ser estrictamente indispensables.",
            content_type="text/plain",
        )

        response = self.client.post(
            "/api/materialidad/corpus-legales/",
            {
                "titulo": "LISR vigente",
                "autoridad": "DOF",
                "ordenamiento": "Ley del Impuesto sobre la Renta",
                "tipo_fuente": LegalReferenceSource.SourceType.LEY,
                "archivo": file_obj,
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, 403)
        self.assertEqual(LegalCorpusUpload.objects.count(), 0)
