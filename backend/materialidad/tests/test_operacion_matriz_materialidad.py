from __future__ import annotations

from datetime import date

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from accounts.models import User
from materialidad.checklist_templates import assign_default_checklists_to_operacion
from materialidad.models import (
    Checklist,
    ChecklistItem,
    CompliancePillar,
    Contrato,
    Empresa,
    EvidenciaMaterial,
    Operacion,
    Proveedor,
)


@override_settings(TENANT_REQUIRED_PATH_PREFIXES=[])
class OperacionMatrizMaterialidadTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            email="qa.matriz@example.com",
            password="Password123!",
        )
        self.client.force_authenticate(user=self.user)

        self.empresa = Empresa.objects.create(
            razon_social="Empresa Matriz SA de CV",
            rfc="EMS010101AAA",
            regimen_fiscal="601",
            estado="CDMX",
        )
        self.proveedor = Proveedor.objects.create(
            razon_social="Proveedor Matriz SA de CV",
            rfc="PMS010101AAA",
        )

        self.contrato = Contrato.objects.create(
            empresa=self.empresa,
            proveedor=self.proveedor,
            nombre="Contrato Matriz",
            categoria=Contrato.Categoria.PROVEEDORES,
            proceso=Contrato.ProcesoNegocio.OPERACIONES,
            tipo_empresa=Contrato.TipoEmpresa.SERVICIOS,
        )
        checklist = Checklist.objects.create(
            tenant_slug="",
            nombre="Base · Servicios profesionales",
            tipo_gasto="Servicios profesionales",
            vigente=True,
        )
        ChecklistItem.objects.create(
            checklist=checklist,
            pillar=CompliancePillar.RAZON_NEGOCIO,
            titulo="Narrativa de razón de negocio",
            requerido=True,
            responsable="Fiscal",
        )
        ChecklistItem.objects.create(
            checklist=checklist,
            pillar=CompliancePillar.ENTREGABLES,
            titulo="Entregables fechados",
            requerido=True,
            responsable="Operaciones",
        )

    def _crear_operacion(self, **kwargs) -> Operacion:
        defaults = {
            "empresa": self.empresa,
            "proveedor": self.proveedor,
            "monto": "1800.00",
            "moneda": Operacion.Moneda.MXN,
            "fecha_operacion": date(2026, 2, 20),
            "tipo_operacion": Operacion.TipoOperacion.SERVICIO,
            "concepto": "Servicio de prueba matriz",
            "estatus_validacion": Operacion.EstatusValidacion.PENDIENTE,
        }
        defaults.update(kwargs)
        return Operacion.objects.create(**defaults)

    def _get_results(self, response):
        payload = response.data
        return payload.get("results", payload)

    def test_matriz_devuelve_cadena_documental_y_estado_completitud(self):
        completa = self._crear_operacion(
            contrato=self.contrato,
            uuid_cfdi="d12504e0-4f89-41d3-9a0c-0305e82c3311",
            referencia_spei="SPEI-MAT-001",
            metadata={"riesgo_materialidad": {"nivel": "BAJO", "score": 0, "motivos": []}},
        )
        EvidenciaMaterial.objects.create(
            operacion=completa,
            tipo=EvidenciaMaterial.Tipo.ENTREGABLE,
            archivo=SimpleUploadedFile("entregable-matriz.txt", b"entregable"),
            descripcion="Entregable",
        )
        EvidenciaMaterial.objects.create(
            operacion=completa,
            tipo=EvidenciaMaterial.Tipo.BITACORA,
            archivo=SimpleUploadedFile("bitacora-matriz.txt", b"bitacora"),
            descripcion="Bitacora",
        )

        incompleta = self._crear_operacion(uuid_cfdi="", referencia_spei="", contrato=None)
        self.client.post(
            f"/api/materialidad/operaciones/{incompleta.id}/cambiar-estatus/",
            {
                "estatus_validacion": Operacion.EstatusValidacion.VALIDADO,
                "comentario": "Generar alerta por faltantes",
            },
            format="json",
        )

        response = self.client.get("/api/materialidad/operaciones/matriz-materialidad/")
        self.assertEqual(response.status_code, 200)
        rows = self._get_results(response)

        row_completa = next(item for item in rows if item["id"] == completa.id)
        row_incompleta = next(item for item in rows if item["id"] == incompleta.id)

        self.assertEqual(row_completa["estado_completitud"], "COMPLETO")
        self.assertEqual(row_completa["cadena_documental"]["cfdi"]["presente"], True)
        self.assertEqual(row_completa["cadena_documental"]["contrato"]["presente"], True)
        self.assertEqual(row_completa["cadena_documental"]["pago"]["presente"], True)
        self.assertGreaterEqual(row_completa["cadena_documental"]["evidencia"]["total"], 2)

        self.assertEqual(row_incompleta["estado_completitud"], "INCOMPLETO")
        self.assertGreaterEqual(len(row_incompleta["faltantes"]), 1)
        self.assertGreaterEqual(len(row_incompleta["alertas_activas"]), 1)

    def test_matriz_filtra_por_riesgo_estatus_y_rfc(self):
        alta = self._crear_operacion(estatus_validacion=Operacion.EstatusValidacion.PENDIENTE)
        media = self._crear_operacion(
            estatus_validacion=Operacion.EstatusValidacion.EN_PROCESO,
            contrato=self.contrato,
            uuid_cfdi="x12504e0-4f89-41d3-9a0c-0305e82c3399",
            referencia_spei="SPEI-MAT-002",
            metadata={"riesgo_materialidad": {"nivel": "MEDIO", "score": 35, "motivos": ["x"]}},
            fecha_operacion=date(2026, 2, 21),
        )
        self.client.post(
            f"/api/materialidad/operaciones/{alta.id}/cambiar-estatus/",
            {
                "estatus_validacion": Operacion.EstatusValidacion.VALIDADO,
                "comentario": "forzar riesgo alto",
            },
            format="json",
        )

        response = self.client.get(
            "/api/materialidad/operaciones/matriz-materialidad/",
            {
                "riesgo": "ALTO",
                "estatus": Operacion.EstatusValidacion.PENDIENTE,
                "rfc": self.empresa.rfc,
            },
        )
        self.assertEqual(response.status_code, 200)
        rows = self._get_results(response)
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["id"], alta.id)
        self.assertNotEqual(rows[0]["id"], media.id)

    def test_matriz_orden_antiguedad_y_validacion_parametros(self):
        viejo = self._crear_operacion(fecha_operacion=date(2026, 2, 1), uuid_cfdi="", referencia_spei="")
        nuevo = self._crear_operacion(fecha_operacion=date(2026, 2, 28), uuid_cfdi="", referencia_spei="")
        self.assertNotEqual(viejo.id, nuevo.id)

        response_ok = self.client.get(
            "/api/materialidad/operaciones/matriz-materialidad/",
            {"orden": "antiguedad"},
        )
        self.assertEqual(response_ok.status_code, 200)
        rows = self._get_results(response_ok)
        self.assertEqual(rows[0]["id"], viejo.id)

        response_bad = self.client.get(
            "/api/materialidad/operaciones/matriz-materialidad/",
            {"orden": "otro"},
        )
        self.assertEqual(response_bad.status_code, 400)
        self.assertIn("ordenes_validos", response_bad.data)

    def test_matriz_refleja_checklist_operativo_en_completitud(self):
        operacion = self._crear_operacion(
            contrato=self.contrato,
            uuid_cfdi="d12504e0-4f89-41d3-9a0c-0305e82c3311",
            referencia_spei="SPEI-MAT-003",
        )
        EvidenciaMaterial.objects.create(
            operacion=operacion,
            tipo=EvidenciaMaterial.Tipo.ENTREGABLE,
            archivo=SimpleUploadedFile("entregable-matriz-checklist.txt", b"entregable"),
            descripcion="Entregable",
        )
        EvidenciaMaterial.objects.create(
            operacion=operacion,
            tipo=EvidenciaMaterial.Tipo.BITACORA,
            archivo=SimpleUploadedFile("bitacora-matriz-checklist.txt", b"bitacora"),
            descripcion="Bitacora",
        )
        assign_default_checklists_to_operacion(operacion=operacion, tenant_slug="")

        response = self.client.get("/api/materialidad/operaciones/matriz-materialidad/")
        self.assertEqual(response.status_code, 200)
        rows = self._get_results(response)
        row = next(item for item in rows if item["id"] == operacion.id)

        self.assertEqual(row["estado_completitud"], "INCOMPLETO")
        self.assertTrue(any("Checklist operativo incompleto" in item for item in row["faltantes"]))
        self.assertEqual(len(row["checklists_resumen"]), 1)
        self.assertEqual(row["checklists_resumen"][0]["requeridos_pendientes"], 2)
