from __future__ import annotations

from io import BytesIO
from types import SimpleNamespace
from unittest.mock import patch

from django.db import connections
from django.test import TestCase, override_settings
from pypdf import PdfReader
from rest_framework.test import APIClient

from accounts.models import User
from materialidad.models import LegalConsultation, LegalReferenceSource
from materialidad.services import (
    _build_structured_fallback_answer,
    _detect_legal_consultation_focus,
    _reference_payload,
    get_legal_consultation_type_label,
)
from tenancy.context import TenantContext
from tenancy.models import Tenant


class _StubAIClient:
    model_name = "stub-openai-model"

    def generate_text(self, messages, temperature=0.0, max_output_tokens=0):
        return "## 1. Análisis Normativo\nRespuesta de prueba con referencia vigente."


class _StubGeminiClient:
    model_name = "stub-gemini-model"

    def generate_text(self, messages, temperature=0.0, max_output_tokens=0):
        return "## 1. Análisis Normativo\nDictamen generado desde notebook."


@override_settings(TENANT_REQUIRED_PATH_PREFIXES=["/api/materialidad/"], OPENAI_API_KEY="test-key", AI_PROVIDER="openai")
class LegalConsultationApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self._base_connection_aliases = set(connections.databases.keys())
        self.user = User.objects.create_user(email="abogado@example.com", password="Password123!", is_staff=True)
        self.tenant = Tenant.objects.create(
            name="Demo API",
            slug="demo-api",
            db_name="tenant_demo_api",
            db_user="tenant_demo_api",
            db_password="secret",
        )
        self.other_tenant = Tenant.objects.create(
            name="Otro Tenant",
            slug="otro-api",
            db_name="tenant_otro_api",
            db_user="tenant_otro_api",
            db_password="secret",
        )
        self.client.force_authenticate(user=self.user)

    def tearDown(self):
        TenantContext.clear()
        for alias in list(connections.databases.keys()):
            if alias in self._base_connection_aliases:
                continue
            if alias in connections:
                connections[alias].close()
            connections.databases.pop(alias, None)
            if hasattr(connections, "_connections") and hasattr(connections._connections, alias):
                delattr(connections._connections, alias)

    @patch("materialidad.services.get_ai_client", return_value=_StubAIClient())
    def test_create_consultation_returns_structured_reference_payload(self, _mock_get_ai_client):
        LegalReferenceSource.objects.create(
            slug="cff-vigente-5-api",
            ley="Código Fiscal de la Federación",
            ordenamiento="Código Fiscal de la Federación",
            tipo_fuente=LegalReferenceSource.SourceType.LEY,
            estatus_vigencia=LegalReferenceSource.VigencyStatus.VIGENTE,
            es_vigente=True,
            autoridad_emisora="DOF",
            articulo="5",
            contenido="Artículo 5. Las disposiciones fiscales son de aplicación estricta.",
            resumen="Aplicación estricta de disposiciones fiscales.",
            fuente_documento="DOF texto vigente",
            fuente_url="https://www.dof.gob.mx/",
            vigencia="Texto vigente 2026",
            hash_contenido="api" * 21 + "x",
            metadata={
                "parser": "DOF",
                "section_type": "ARTICULO",
                "articulo": "5",
            },
        )

        response = self.client.post(
            "/api/materialidad/consultas-legales/",
            {
                "pregunta": "¿Qué implica la aplicación estricta del artículo 5 del CFF?",
                "ley": "Código Fiscal de la Federación",
                "tipo_fuente": LegalReferenceSource.SourceType.LEY,
                "max_referencias": 3,
            },
            format="json",
            HTTP_X_TENANT=self.tenant.slug,
        )

        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["pregunta"], "¿Qué implica la aplicación estricta del artículo 5 del CFF?")
        self.assertEqual(response.data["referencias"][0]["ley"], "Código Fiscal de la Federación")
        self.assertEqual(response.data["referencias"][0]["autoridad_emisora"], "DOF")
        self.assertEqual(response.data["referencias"][0]["section_type"], "ARTICULO")
        self.assertEqual(response.data["referencias"][0]["articulo"], "5")
        self.assertEqual(response.data["tipo_consulta"]["code"], "general")
        self.assertEqual(response.data["modelo"], "stub-openai-model")
        self.assertEqual(response.data["estado"], "ok")

        consultation = LegalConsultation.objects.get(pk=response.data["id"])
        self.assertEqual(consultation.tenant_slug, self.tenant.slug)

    def test_list_consultations_is_scoped_by_tenant_header(self):
        LegalConsultation.objects.create(
            tenant_slug=self.tenant.slug,
            user=self.user,
            question="Consulta tenant A",
            context="",
            answer="Respuesta A",
            references=[],
            ai_model="stub",
        )
        LegalConsultation.objects.create(
            tenant_slug=self.other_tenant.slug,
            user=self.user,
            question="Consulta tenant B",
            context="",
            answer="Respuesta B",
            references=[],
            ai_model="stub",
        )

        response = self.client.get("/api/materialidad/consultas-legales/", HTTP_X_TENANT=self.tenant.slug)

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["pregunta"], "Consulta tenant A")
        self.assertEqual(response.data["results"][0]["estado"], "ok")

    def test_list_consultations_marks_error_status_from_backend_prefix(self):
        LegalConsultation.objects.create(
            tenant_slug=self.tenant.slug,
            user=self.user,
            question="Consulta con incidente",
            context="",
            answer="ERROR: El servicio de inteligencia no pudo completarse.",
            references=[],
            ai_model="stub",
        )

        response = self.client.get("/api/materialidad/consultas-legales/", HTTP_X_TENANT=self.tenant.slug)

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["results"][0]["estado"], "error")

    def test_available_laws_endpoint_lists_shared_legal_sources(self):
        LegalReferenceSource.objects.create(
            slug="cff-api-leyes",
            ley="Código Fiscal de la Federación",
            ordenamiento="Código Fiscal de la Federación",
            tipo_fuente=LegalReferenceSource.SourceType.LEY,
            contenido="Artículo 5. Las disposiciones fiscales son de aplicación estricta.",
            resumen="Aplicación estricta.",
            hash_contenido="leyes" * 12 + "abcd",
        )

        response = self.client.get("/api/materialidad/fuentes-legales/leyes/", HTTP_X_TENANT=self.tenant.slug)

        self.assertEqual(response.status_code, 200, response.data)
        self.assertIn("Código Fiscal de la Federación", response.data["results"])

    @override_settings(OPENAI_API_KEY="", GEMINI_API_KEY="", AI_PROVIDER="openai")
    def test_create_consultation_falls_back_to_structured_rag_without_ai_provider(self):
        LegalReferenceSource.objects.create(
            slug="lisr-fallback-27",
            ley="Ley del ISR",
            ordenamiento="Ley del ISR",
            tipo_fuente=LegalReferenceSource.SourceType.LEY,
            estatus_vigencia=LegalReferenceSource.VigencyStatus.VIGENTE,
            es_vigente=True,
            autoridad_emisora="DOF",
            articulo="27",
            contenido="Artículo 27. Las deducciones autorizadas requieren documentación soporte y materialidad comprobable.",
            resumen="Deducciones con soporte suficiente.",
            fuente_documento="DOF texto vigente",
            hash_contenido="fallback" * 8,
        )

        response = self.client.post(
            "/api/materialidad/consultas-legales/",
            {
                "pregunta": "¿Qué documentación debo integrar para soportar una deducción?",
                "contexto": "Prestación de servicios de consultoría a empresa privada.",
                "ley": "Ley del ISR",
                "tipo_fuente": LegalReferenceSource.SourceType.LEY,
            },
            format="json",
            HTTP_X_TENANT=self.tenant.slug,
        )

        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["modelo"], "materialidad-rag-fallback")
        self.assertIn("## 0. Conclusión Ejecutiva", response.data["respuesta"])
        self.assertIn("## 1. Análisis Normativo", response.data["respuesta"])
        self.assertIn("## 4. Recomendaciones Prácticas", response.data["respuesta"])
        self.assertEqual(len(response.data["referencias"]), 1)
        self.assertEqual(response.data["estado"], "ok")

    @override_settings(OPENAI_API_KEY="", GEMINI_API_KEY="", AI_PROVIDER="openai")
    def test_create_consultation_uses_historical_support_when_current_sources_are_missing(self):
        LegalReferenceSource.objects.create(
            slug="cff-historica-5-api",
            ley="Código Fiscal de la Federación",
            ordenamiento="Código Fiscal de la Federación",
            tipo_fuente=LegalReferenceSource.SourceType.LEY,
            estatus_vigencia=LegalReferenceSource.VigencyStatus.HISTORICA,
            es_vigente=False,
            autoridad_emisora="DOF",
            articulo="5",
            contenido="Artículo 5. Redacción histórica para aplicación estricta de disposiciones fiscales.",
            resumen="Texto histórico del artículo 5.",
            fuente_documento="DOF histórico",
            hash_contenido="h" * 64,
        )

        response = self.client.post(
            "/api/materialidad/consultas-legales/",
            {
                "pregunta": "¿Cómo se ha interpretado históricamente la aplicación estricta del artículo 5 del CFF?",
                "ley": "Código Fiscal de la Federación",
                "tipo_fuente": LegalReferenceSource.SourceType.LEY,
            },
            format="json",
            HTTP_X_TENANT=self.tenant.slug,
        )

        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["modelo"], "materialidad-rag-fallback")
        self.assertEqual(len(response.data["referencias"]), 1)
        self.assertEqual(response.data["referencias"][0]["estatus_vigencia"], "HISTORICA")
        self.assertIn("soporte histórico", response.data["respuesta"].lower())
        self.assertIn("## 0. Conclusión Ejecutiva", response.data["respuesta"])

    def test_exportar_pdf_consulta_legal_descarga_documento_profesional(self):
        consultation = LegalConsultation.objects.create(
            tenant_slug=self.tenant.slug,
            user=self.user,
            question="¿Cómo acreditar materialidad en arrendamiento de maquinaria?",
            context="Se analiza el uso de retroexcavadora y acta de entrega en contrato operativo.",
            answer="## 0. Conclusión Ejecutiva\n- Postura preliminar.\n## 1. Análisis Normativo\nSe revisó arrendamiento con soporte operativo.",
            ai_model="stub-openai-model",
            references=[
                {
                    "ley": "Código Civil Federal",
                    "ordenamiento": "Código Civil Federal",
                    "articulo": "2398",
                    "estatus_vigencia": "VIGENTE",
                    "extracto": "El arrendamiento requiere entrega y uso del bien arrendado.",
                    "match_reason": "Se relaciona con arrendamiento porque describe entrega, uso o control del bien arrendado. Coincide con: acta de entrega.",
                }
            ],
        )

        response = self.client.get(
            f"/api/materialidad/consultas-legales/{consultation.id}/exportar-pdf/",
            HTTP_X_TENANT=self.tenant.slug,
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "application/pdf")
        self.assertTrue(response.content.startswith(b"%PDF"))

        reader = PdfReader(BytesIO(response.content))
        extracted_text = "\n".join((page.extract_text() or "") for page in reader.pages)
        self.assertIn("OPINION LEGAL PRELIMINAR", extracted_text)
        self.assertIn("ANEXO DE REFERENCIAS", extracted_text)
        self.assertIn("Firma institucional", extracted_text)
        self.assertIn("arrendamiento", extracted_text.lower())

    @override_settings(OPENAI_API_KEY="", GEMINI_API_KEY="gemini-test", AI_PROVIDER="gemini")
    @patch("materialidad.services.get_ai_client", return_value=_StubGeminiClient())
    def test_create_consultation_with_gemini_persists_structured_references(self, _mock_get_ai_client):
        LegalReferenceSource.objects.create(
            slug="cff-gemini-5",
            ley="Código Fiscal de la Federación",
            ordenamiento="Código Fiscal de la Federación",
            tipo_fuente=LegalReferenceSource.SourceType.LEY,
            estatus_vigencia=LegalReferenceSource.VigencyStatus.VIGENTE,
            es_vigente=True,
            autoridad_emisora="DOF",
            articulo="5",
            contenido="Artículo 5. Las disposiciones fiscales son de aplicación estricta.",
            resumen="Aplicación estricta de disposiciones fiscales.",
            fuente_documento="DOF texto vigente",
            hash_contenido="gemini" * 10 + "xyza",
        )

        response = self.client.post(
            "/api/materialidad/consultas-legales/",
            {
                "pregunta": "¿Qué implica la aplicación estricta del artículo 5 del CFF?",
                "ley": "Código Fiscal de la Federación",
                "tipo_fuente": LegalReferenceSource.SourceType.LEY,
            },
            format="json",
            HTTP_X_TENANT=self.tenant.slug,
        )

        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["modelo"], "stub-gemini-model (Notebook Context)")
        self.assertEqual(len(response.data["referencias"]), 1)
        self.assertEqual(response.data["referencias"][0]["articulo"], "5")


class LegalConsultationExecutiveConclusionTests(TestCase):
    def test_detect_focus_for_materialidad(self):
        focus = _detect_legal_consultation_focus(
            question="¿Cómo acreditar materialidad de una operación con sustancia económica?",
            context_block="Necesito probar razón de negocio, evidencia operativa y coherencia documental.",
            references=[],
        )

        self.assertEqual(focus, "materialidad")

    def test_detect_focus_for_materialidad_servicios(self):
        focus = _detect_legal_consultation_focus(
            question="¿Cómo acreditar materialidad en servicios de consultoría?",
            context_block="Necesito entregables, bitácora y evidencia de prestación del servicio.",
            references=[],
        )

        self.assertEqual(focus, "materialidad_servicios")

    def test_detect_focus_for_materialidad_arrendamiento(self):
        focus = _detect_legal_consultation_focus(
            question="¿Cómo acreditar materialidad en un arrendamiento de maquinaria?",
            context_block="Debo probar entrega de retroexcavadora, uso y acta de entrega.",
            references=[],
        )

        self.assertEqual(focus, "materialidad_arrendamiento")

    def test_detect_focus_for_materialidad_compras(self):
        focus = _detect_legal_consultation_focus(
            question="¿Cómo acreditar materialidad en compras de bienes?",
            context_block="Necesito probar adquisición, recepción material e inventario.",
            references=[],
        )

        self.assertEqual(focus, "materialidad_compras")

    def test_detect_focus_prefers_reference_signals_for_ambiguous_materialidad(self):
        focus = _detect_legal_consultation_focus(
            question="¿Cómo acreditar materialidad de esta operación?",
            context_block="Quiero validar la evidencia operativa y el soporte documental.",
            references=[
                SimpleNamespace(
                    ley="Código Civil Federal",
                    ordenamiento="Código Civil Federal",
                    resumen="Arrendamiento de maquinaria con acta de entrega y bitácora de uso.",
                    contenido="La materialidad del arrendamiento se soporta con evidencia de entrega de retroexcavadora, uso efectivo y control del equipo arrendado.",
                    sat_categoria="Arrendamiento",
                )
            ],
        )

        self.assertEqual(focus, "materialidad_arrendamiento")

    def test_detect_focus_for_deducibilidad(self):
        focus = _detect_legal_consultation_focus(
            question="¿El gasto es deducible conforme al artículo 27 de la LISR?",
            context_block="Quiero validar deducción y acreditamiento de IVA.",
            references=[],
        )

        self.assertEqual(focus, "deducibilidad")

    def test_detect_focus_for_69b(self):
        focus = _detect_legal_consultation_focus(
            question="¿Qué hago si el proveedor aparece como presunto en 69-B?",
            context_block="Hay riesgo por EFOS y operaciones inexistentes.",
            references=[],
        )

        self.assertEqual(focus, "69b_presunto")

    def test_detect_focus_for_69b_definitivo(self):
        focus = _detect_legal_consultation_focus(
            question="¿Qué hago si el proveedor está en 69-B definitivo?",
            context_block="Hay EDOS y contingencia crítica para el receptor.",
            references=[],
        )

        self.assertEqual(focus, "69b_definitivo")

    def test_detect_focus_for_intercompany(self):
        focus = _detect_legal_consultation_focus(
            question="¿Cómo sostener un convenio intercompany entre partes relacionadas?",
            context_block="Debe probarse arm's length y precios de transferencia.",
            references=[],
        )

        self.assertEqual(focus, "intercompany")

    def test_fallback_answer_uses_69b_specific_executive_conclusion(self):
        answer = _build_structured_fallback_answer(
            question="¿Qué riesgo existe si el proveedor cae en 69-B definitivo?",
            context_block="Se requiere revisar materialización de la operación y posible sustitución.",
            references=[],
        )

        self.assertIn("69-B", answer)
        self.assertIn("contingencia crítica", answer.lower())

    def test_fallback_answer_uses_69b_presunto_specific_executive_conclusion(self):
        answer = _build_structured_fallback_answer(
            question="¿Qué hago con un proveedor en 69-B presunto?",
            context_block="Hay riesgo inmediato y necesidad de desvirtuar la presunción.",
            references=[],
        )

        self.assertIn("69-B presunto", answer)
        self.assertIn("alta exposición", answer)

    def test_fallback_answer_uses_intercompany_specific_executive_conclusion(self):
        answer = _build_structured_fallback_answer(
            question="¿Cómo sostener una operación intercompany?",
            context_block="Hay partes relacionadas y necesidad de soporte arm's length.",
            references=[],
        )

        self.assertIn("intercompany", answer.lower())
        self.assertIn("precios de transferencia", answer.lower())

    def test_get_legal_consultation_type_label(self):
        self.assertEqual(get_legal_consultation_type_label("materialidad_arrendamiento"), "Materialidad · Arrendamiento")
        self.assertEqual(get_legal_consultation_type_label("69b_definitivo"), "69-B · Definitivo")

    def test_reference_payload_includes_matched_terms_for_focus(self):
        reference = LegalReferenceSource(
            ley="Código Civil Federal",
            ordenamiento="Código Civil Federal",
            tipo_fuente=LegalReferenceSource.SourceType.LEY,
            contenido="El arrendamiento de maquinaria exige acta de entrega, evidencia de retroexcavadora y bitácora de uso del equipo arrendado.",
            resumen="Arrendamiento con acta de entrega y equipo arrendado.",
            hash_contenido="m" * 64,
        )

        payload = _reference_payload(
            reference,
            focus="materialidad_arrendamiento",
            query_text="Necesito probar materialidad del arrendamiento de retroexcavadora",
        )

        self.assertIn("acta de entrega", payload["matched_phrases"])
        self.assertIn("arrendamiento", payload["matched_terms"])
        self.assertIn("retroexcavadora", payload["matched_terms"])
        self.assertIn("arrendamiento", payload["match_reason"].lower())
        self.assertIn("acta de entrega", payload["match_reason"].lower())
