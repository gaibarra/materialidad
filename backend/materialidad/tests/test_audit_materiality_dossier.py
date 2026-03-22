from __future__ import annotations

from io import BytesIO

from django.test import TestCase, override_settings
from pypdf import PdfReader
from rest_framework.test import APIClient

from accounts.models import User
from materialidad.models import AuditMaterialityDossier, AuditMaterialityDossierVersion, Empresa


@override_settings(TENANT_REQUIRED_PATH_PREFIXES=[])
class AuditMaterialityDossierApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            email="audit.materialidad@example.com",
            password="Password123!",
            full_name="Audit Materialidad QA",
        )
        self.client.force_authenticate(user=self.user)
        self.empresa = Empresa.objects.create(
            razon_social="Empresa Auditoria SA de CV",
            rfc="EAS010101AAA",
            regimen_fiscal="601",
            estado="CDMX",
        )

    def _payload(self):
        return {
            "empresa": self.empresa.id,
            "ejercicio": 2025,
            "payload": {
                "version": 1,
                "selectedBenchmarkKey": "ingresos",
                "mg": 2500000,
                "met": 1875000,
                "clearlyTrivial": 125000,
                "benchmarkInput": {
                    "utilidadAntesImpuestos": 12500000,
                    "ingresos": 250000000,
                    "activos": 95000000,
                    "capital": 40000000,
                    "gastos": 240000000,
                },
                "findings": [
                    {
                        "id": "finding-1",
                        "titulo": "Ingreso reconocido al cierre",
                        "area": "Ingresos",
                        "impactoMonto": 420000,
                        "impactoTipo": "cuantificable",
                        "severidad": "alta",
                        "descripcion": "Se identifican pólizas con evidencia de entrega insuficiente.",
                        "recomendacion": "Extender pruebas de corte y confirmar soporte externo.",
                    }
                ],
            },
        }

    def test_upsert_guarda_sello_de_ultima_edicion(self):
        response = self.client.post("/api/materialidad/materialidad-auditoria/upsert/", self._payload(), format="json")

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["last_edited_by_email"], self.user.email)
        self.assertEqual(response.data["last_edited_by_name"], self.user.full_name)

        dossier = AuditMaterialityDossier.objects.get(empresa=self.empresa, ejercicio=2025)
        self.assertEqual(dossier.last_edited_by_email, self.user.email)
        self.assertEqual(dossier.last_edited_by_name, self.user.full_name)

    def test_exportar_pdf_y_docx_generan_archivos_validos(self):
        create_response = self.client.post("/api/materialidad/materialidad-auditoria/upsert/", self._payload(), format="json")
        dossier_id = create_response.data["id"]

        pdf_response = self.client.get(f"/api/materialidad/materialidad-auditoria/{dossier_id}/exportar-pdf/")
        self.assertEqual(pdf_response.status_code, 200)
        self.assertEqual(pdf_response["Content-Type"], "application/pdf")
        self.assertTrue(pdf_response.content.startswith(b"%PDF"))

        reader = PdfReader(BytesIO(pdf_response.content))
        pdf_text = "\n".join((page.extract_text() or "") for page in reader.pages)
        self.assertIn("EXPEDIENTE DE MATERIALIDAD DE", pdf_text)
        self.assertIn("AUDITORÍA", pdf_text)
        self.assertIn("Empresa Auditoria SA de CV", pdf_text)
        self.assertIn("Ingreso reconocido al cierre", pdf_text)

        docx_response = self.client.get(f"/api/materialidad/materialidad-auditoria/{dossier_id}/exportar-docx/")
        self.assertEqual(docx_response.status_code, 200)
        self.assertEqual(
            docx_response["Content-Type"],
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        )
        self.assertGreater(len(docx_response.content), 1000)
        self.assertTrue(docx_response.content.startswith(b"PK"))

    def test_upsert_crea_historial_y_permita_restaurar_version(self):
        payload = self._payload()
        create_response = self.client.post("/api/materialidad/materialidad-auditoria/upsert/", payload, format="json")

        self.assertEqual(create_response.status_code, 201)
        dossier_id = create_response.data["id"]

        payload["payload"]["findings"][0]["titulo"] = "Ingreso reconocido al cierre - ajustado"
        payload["payload"]["findings"].append(
            {
                "id": "finding-2",
                "titulo": "Provision no documentada",
                "area": "Pasivos",
                "impactoMonto": 180000,
                "impactoTipo": "cuantificable",
                "severidad": "media",
                "descripcion": "No existe soporte suficiente de una provisión registrada en diciembre.",
                "recomendacion": "Solicitar integración, soporte y recalcular el asiento si aplica.",
            }
        )

        update_response = self.client.post("/api/materialidad/materialidad-auditoria/upsert/", payload, format="json")
        self.assertEqual(update_response.status_code, 200)

        versions_response = self.client.get(f"/api/materialidad/materialidad-auditoria/{dossier_id}/versiones/")
        self.assertEqual(versions_response.status_code, 200)
        self.assertEqual(len(versions_response.data), 2)
        self.assertEqual(versions_response.data[0]["version_number"], 2)
        self.assertEqual(versions_response.data[0]["source"], "MANUAL")
        self.assertEqual(versions_response.data[1]["version_number"], 1)

        first_version_id = versions_response.data[1]["id"]
        restore_response = self.client.post(
            f"/api/materialidad/materialidad-auditoria/{dossier_id}/restaurar-version/",
            {"version_id": first_version_id},
            format="json",
        )
        self.assertEqual(restore_response.status_code, 200)
        self.assertEqual(
            restore_response.data["payload"]["findings"][0]["titulo"],
            "Ingreso reconocido al cierre",
        )

        dossier = AuditMaterialityDossier.objects.get(pk=dossier_id)
        self.assertEqual(dossier.payload["findings"][0]["titulo"], "Ingreso reconocido al cierre")

        versions = AuditMaterialityDossierVersion.objects.filter(dossier=dossier).order_by("version_number")
        self.assertEqual(versions.count(), 3)
        self.assertEqual(versions.last().source, AuditMaterialityDossierVersion.Source.RESTORE)
