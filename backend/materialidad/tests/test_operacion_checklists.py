from __future__ import annotations

from datetime import date
from unittest.mock import patch

from django.core.exceptions import ImproperlyConfigured
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from accounts.models import User
from materialidad.ai.checklists import generate_checklist_draft
from materialidad.checklist_templates import assign_default_checklists_to_operacion
from materialidad.models import (
    AlertaOperacion,
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
class OperacionChecklistTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            email="qa.checklists@example.com",
            password="Password123!",
        )
        self.client.force_authenticate(user=self.user)

        self.empresa = Empresa.objects.create(
            razon_social="Empresa Checklist SA de CV",
            rfc="ECS010101AAA",
            regimen_fiscal="601",
            estado="CDMX",
        )
        self.proveedor = Proveedor.objects.create(
            razon_social="Proveedor Checklist SA de CV",
            rfc="PCS010101AAA",
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

    def test_crear_operacion_asigna_checklist_base_y_resume_en_respuesta(self):
        response = self.client.post(
            "/api/materialidad/operaciones/",
            {
                "empresa": self.empresa.id,
                "proveedor": self.proveedor.id,
                "monto": "2500.00",
                "moneda": Operacion.Moneda.MXN,
                "fecha_operacion": date(2026, 3, 1).isoformat(),
                "tipo_operacion": Operacion.TipoOperacion.SERVICIO,
                "concepto": "Servicio de consultoría operativa con soporte documental",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(len(response.data["checklists_resumen"]), 1)
        self.assertEqual(response.data["checklists_resumen"][0]["nombre"], "Base · Servicios profesionales")
        self.assertEqual(response.data["checklists_resumen"][0]["progreso_porcentaje"], 0)

        operacion_id = response.data["id"]
        detail = self.client.get(f"/api/materialidad/operaciones/{operacion_id}/checklists/")
        self.assertEqual(detail.status_code, 200)
        self.assertEqual(len(detail.data), 1)
        self.assertEqual(detail.data[0]["total_items"], 2)
        self.assertEqual(detail.data[0]["pendientes"], 2)

    @patch("materialidad.views.sync_operation_defense_projection")
    def test_crear_operacion_sincroniza_projection(self, mock_sync_projection):
        response = self.client.post(
            "/api/materialidad/operaciones/",
            {
                "empresa": self.empresa.id,
                "proveedor": self.proveedor.id,
                "monto": "2500.00",
                "moneda": Operacion.Moneda.MXN,
                "fecha_operacion": date(2026, 3, 1).isoformat(),
                "tipo_operacion": Operacion.TipoOperacion.SERVICIO,
                "concepto": "Servicio con sincronizacion de proyeccion",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        mock_sync_projection.assert_called_once()
        self.assertEqual(mock_sync_projection.call_args.kwargs["operacion"].id, response.data["id"])

    def test_crear_operacion_compra_siembra_y_asigna_checklist_base(self):
        response = self.client.post(
            "/api/materialidad/operaciones/",
            {
                "empresa": self.empresa.id,
                "proveedor": self.proveedor.id,
                "monto": "4100.00",
                "moneda": Operacion.Moneda.MXN,
                "fecha_operacion": date(2026, 3, 2).isoformat(),
                "tipo_operacion": Operacion.TipoOperacion.COMPRA,
                "concepto": "Compra de insumos y refacciones para operacion",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(len(response.data["checklists_resumen"]), 1)
        self.assertEqual(response.data["checklists_resumen"][0]["nombre"], "Base · Compras e inventario")

        checklist = Checklist.objects.get(nombre="Base · Compras e inventario", tenant_slug="")
        self.assertEqual(checklist.items.count(), 4)

    def test_actualizar_item_recalcula_progreso_del_checklist_operativo(self):
        create_response = self.client.post(
            "/api/materialidad/operaciones/",
            {
                "empresa": self.empresa.id,
                "proveedor": self.proveedor.id,
                "monto": "3200.00",
                "moneda": Operacion.Moneda.MXN,
                "fecha_operacion": date(2026, 3, 3).isoformat(),
                "tipo_operacion": Operacion.TipoOperacion.SERVICIO,
                "concepto": "Servicio para recalcular progreso",
            },
            format="json",
        )
        self.assertEqual(create_response.status_code, 201)

        detail = self.client.get(f"/api/materialidad/operaciones/{create_response.data['id']}/checklists/")
        item_id = detail.data[0]["items"][0]["id"]

        update_response = self.client.patch(
            f"/api/materialidad/operacion-checklist-items/{item_id}/",
            {"estado": "COMPLETO"},
            format="json",
        )
        self.assertEqual(update_response.status_code, 200)

        refreshed = self.client.get(f"/api/materialidad/operaciones/{create_response.data['id']}/checklists/")
        self.assertEqual(refreshed.status_code, 200)
        self.assertEqual(refreshed.data[0]["completos"], 1)
        self.assertEqual(refreshed.data[0]["pendientes"], 1)
        self.assertEqual(refreshed.data[0]["estado_general"], "EN_PROCESO")
        self.assertEqual(refreshed.data[0]["progreso_porcentaje"], 50)

    def test_actualizar_checklist_sincroniza_alerta_y_riesgo_materialidad(self):
        contrato = Contrato.objects.create(
            empresa=self.empresa,
            proveedor=self.proveedor,
            nombre="Contrato Checklist Sync",
            categoria=Contrato.Categoria.PROVEEDORES,
            proceso=Contrato.ProcesoNegocio.OPERACIONES,
            tipo_empresa=Contrato.TipoEmpresa.SERVICIOS,
        )
        operacion = Operacion.objects.create(
            empresa=self.empresa,
            proveedor=self.proveedor,
            contrato=contrato,
            monto="3200.00",
            moneda=Operacion.Moneda.MXN,
            fecha_operacion=date(2026, 3, 5),
            tipo_operacion=Operacion.TipoOperacion.SERVICIO,
            concepto="Servicio con expediente completo y checklist pendiente",
            uuid_cfdi="d12504e0-4f89-41d3-9a0c-0305e82c3311",
            referencia_spei="SPEI-CHECK-001",
        )
        EvidenciaMaterial.objects.create(
            operacion=operacion,
            tipo=EvidenciaMaterial.Tipo.ENTREGABLE,
            archivo=SimpleUploadedFile("entregable-checklist.txt", b"entregable"),
            descripcion="Entregable checklist",
        )
        EvidenciaMaterial.objects.create(
            operacion=operacion,
            tipo=EvidenciaMaterial.Tipo.BITACORA,
            archivo=SimpleUploadedFile("bitacora-checklist.txt", b"bitacora"),
            descripcion="Bitacora checklist",
        )
        assign_default_checklists_to_operacion(operacion=operacion, tenant_slug="")

        detail = self.client.get(f"/api/materialidad/operaciones/{operacion.id}/checklists/")
        self.assertEqual(detail.status_code, 200)
        items = detail.data[0]["items"]
        self.assertEqual(len(items), 2)
        self.assertEqual(AlertaOperacion.objects.filter(operacion=operacion).count(), 0)

        first_update = self.client.patch(
            f"/api/materialidad/operacion-checklist-items/{items[0]['id']}/",
            {"estado": "COMPLETO"},
            format="json",
        )
        self.assertEqual(first_update.status_code, 200)

        operacion.refresh_from_db()
        riesgo = (operacion.metadata or {}).get("riesgo_materialidad", {})
        self.assertEqual(riesgo.get("nivel"), "MEDIO")
        self.assertGreaterEqual(riesgo.get("score", 0), 20)

        alerta = AlertaOperacion.objects.get(operacion=operacion, estatus=AlertaOperacion.Estatus.ACTIVA)
        self.assertEqual(alerta.tipo_alerta, AlertaOperacion.TipoAlerta.FALTANTES_CRITICOS)
        self.assertTrue(any("Checklist operativo incompleto" in item for item in alerta.detalle.get("faltantes_criticos", [])))

        second_update = self.client.patch(
            f"/api/materialidad/operacion-checklist-items/{items[1]['id']}/",
            {"estado": "COMPLETO"},
            format="json",
        )
        self.assertEqual(second_update.status_code, 200)

        operacion.refresh_from_db()
        riesgo_final = (operacion.metadata or {}).get("riesgo_materialidad", {})
        self.assertEqual(riesgo_final.get("nivel"), "BAJO")
        self.assertEqual(riesgo_final.get("score"), 0)
        self.assertFalse(
            AlertaOperacion.objects.filter(
                operacion=operacion,
                estatus=AlertaOperacion.Estatus.ACTIVA,
            ).exists()
        )
        self.assertTrue(
            AlertaOperacion.objects.filter(
                operacion=operacion,
                estatus=AlertaOperacion.Estatus.CERRADA,
            ).exists()
        )

    @patch("materialidad.views.sync_operation_defense_projection")
    def test_actualizar_checklist_sincroniza_projection(self, mock_sync_projection):
        create_response = self.client.post(
            "/api/materialidad/operaciones/",
            {
                "empresa": self.empresa.id,
                "proveedor": self.proveedor.id,
                "monto": "3200.00",
                "moneda": Operacion.Moneda.MXN,
                "fecha_operacion": date(2026, 3, 3).isoformat(),
                "tipo_operacion": Operacion.TipoOperacion.SERVICIO,
                "concepto": "Servicio para sincronizar projection desde checklist",
            },
            format="json",
        )
        self.assertEqual(create_response.status_code, 201)
        mock_sync_projection.reset_mock()

        detail = self.client.get(f"/api/materialidad/operaciones/{create_response.data['id']}/checklists/")
        item_id = detail.data[0]["items"][0]["id"]

        update_response = self.client.patch(
            f"/api/materialidad/operacion-checklist-items/{item_id}/",
            {"estado": "COMPLETO"},
            format="json",
        )

        self.assertEqual(update_response.status_code, 200)
        mock_sync_projection.assert_called_once()
        self.assertEqual(mock_sync_projection.call_args.kwargs["operacion"].id, create_response.data["id"])

    def test_assign_default_checklists_siembra_plantillas_faltantes_por_tenant(self):
        operacion = Operacion.objects.create(
            empresa=self.empresa,
            proveedor=self.proveedor,
            monto="1800.00",
            moneda=Operacion.Moneda.MXN,
            fecha_operacion=date(2026, 3, 6),
            tipo_operacion=Operacion.TipoOperacion.COMPRA,
            concepto="Compra con tenant sin checklist sembrado",
        )

        assigned = assign_default_checklists_to_operacion(
            operacion=operacion,
            tenant_slug="tenant-demo",
        )

        self.assertEqual(len(assigned), 1)
        self.assertEqual(assigned[0].nombre, "Base · Compras e inventario")
        self.assertTrue(
            Checklist.objects.filter(
                tenant_slug="tenant-demo",
                nombre="Base · Compras e inventario",
                vigente=True,
            ).exists()
        )

    def test_generar_borrador_checklist_manual_devuelve_preview_sin_persistir(self):
        ai_payload = {
            "draft": {
                "nombre": "Sugerido · Servicio especializado de consultoría",
                "tipo_gasto": "Servicios profesionales",
                "items": [
                    {
                        "pillar": CompliancePillar.RAZON_NEGOCIO,
                        "titulo": "Narrativa ejecutiva de la necesidad",
                        "descripcion": "Documento que explique el beneficio económico esperado y la razón operativa.",
                        "requerido": True,
                        "responsable": "Fiscal",
                    },
                    {
                        "pillar": CompliancePillar.ENTREGABLES,
                        "titulo": "Entregables con evidencia de recepción",
                        "descripcion": "Reportes y minutas firmadas por el área solicitante.",
                        "requerido": True,
                        "responsable": "Operaciones",
                    },
                    {
                        "pillar": CompliancePillar.CAPACIDAD_PROVEEDOR,
                        "titulo": "Validación documental del proveedor",
                        "descripcion": "CV, equipo y estructura mínima del prestador.",
                        "requerido": True,
                        "responsable": "Compliance",
                    },
                    {
                        "pillar": CompliancePillar.FECHA_CIERTA,
                        "titulo": "Contrato con soporte temporal reforzado",
                        "descripcion": "Contrato y anexos bajo resguardo documental.",
                        "requerido": False,
                        "responsable": "Jurídico",
                    },
                ],
            },
            "source": "ai",
            "model": "gpt-test",
            "warnings": [],
            "context": {"operacion_id": None, "contrato_id": None, "tipo_operacion": Operacion.TipoOperacion.SERVICIO},
        }

        existing_checklists = Checklist.objects.count()
        with patch("materialidad.views.generate_checklist_draft", return_value=ai_payload) as mocked_generate:
            response = self.client.post(
                "/api/materialidad/checklists/generar-borrador/",
                {
                    "naturaleza_operacion": "Servicio de consultoría operativa para documentación fiscal y evidencia de entregables.",
                    "tipo_operacion": Operacion.TipoOperacion.SERVICIO,
                    "empresa": self.empresa.id,
                    "proveedor": self.proveedor.id,
                },
                format="json",
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["source"], "ai")
        self.assertEqual(response.data["draft"]["nombre"], ai_payload["draft"]["nombre"])
        self.assertEqual(len(response.data["draft"]["items"]), 4)
        self.assertEqual(Checklist.objects.count(), existing_checklists)
        mocked_generate.assert_called_once()

    def test_sugerir_checklist_por_operacion_reusa_contexto_de_operacion_y_contrato(self):
        contrato = Contrato.objects.create(
            empresa=self.empresa,
            proveedor=self.proveedor,
            nombre="Contrato de servicios operativos",
            categoria=Contrato.Categoria.PROVEEDORES,
            proceso=Contrato.ProcesoNegocio.OPERACIONES,
            tipo_empresa=Contrato.TipoEmpresa.SERVICIOS,
            razon_negocio="Asegurar soporte documental y materialidad de la prestación.",
        )
        operacion = Operacion.objects.create(
            empresa=self.empresa,
            proveedor=self.proveedor,
            contrato=contrato,
            monto="5800.00",
            moneda=Operacion.Moneda.MXN,
            fecha_operacion=date(2026, 3, 6),
            tipo_operacion=Operacion.TipoOperacion.SERVICIO,
            concepto="Servicio de implementación documental con soporte de compliance",
        )

        ai_payload = {
            "draft": {
                "nombre": "Sugerido · Servicio con soporte contractual",
                "tipo_gasto": "Servicios profesionales",
                "items": [
                    {
                        "pillar": CompliancePillar.RAZON_NEGOCIO,
                        "titulo": "Resumen ejecutivo del beneficio económico",
                        "descripcion": "Alineado al contrato y a la operación.",
                        "requerido": True,
                        "responsable": "Fiscal",
                    },
                    {
                        "pillar": CompliancePillar.ENTREGABLES,
                        "titulo": "Paquete de entregables firmados",
                        "descripcion": "Entregables y actas relacionados con el servicio.",
                        "requerido": True,
                        "responsable": "Operaciones",
                    },
                    {
                        "pillar": CompliancePillar.CAPACIDAD_PROVEEDOR,
                        "titulo": "Soporte de capacidad operativa",
                        "descripcion": "Estructura y experiencia del proveedor.",
                        "requerido": True,
                        "responsable": "Compliance",
                    },
                    {
                        "pillar": CompliancePillar.FECHA_CIERTA,
                        "titulo": "Contrato y anexos bajo resguardo",
                        "descripcion": "Control documental reforzado del contrato.",
                        "requerido": False,
                        "responsable": "Jurídico",
                    },
                ],
            },
            "source": "ai",
            "model": "gpt-test",
            "warnings": [],
            "context": {"operacion_id": operacion.id, "contrato_id": contrato.id, "tipo_operacion": Operacion.TipoOperacion.SERVICIO},
        }

        with patch("materialidad.views.generate_checklist_draft", return_value=ai_payload) as mocked_generate:
            response = self.client.post(
                f"/api/materialidad/operaciones/{operacion.id}/sugerir-checklist/",
                {},
                format="json",
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["context"]["operacion_id"], operacion.id)
        self.assertEqual(response.data["context"]["contrato_id"], contrato.id)
        mocked_generate.assert_called_once()
        self.assertEqual(mocked_generate.call_args.kwargs["operacion"], operacion)
        self.assertEqual(mocked_generate.call_args.kwargs["contrato"], contrato)
        self.assertEqual(
            mocked_generate.call_args.kwargs["naturaleza_operacion"],
            operacion.concepto,
        )

    def test_servicio_generacion_de_checklist_regresa_fallback_si_ia_no_esta_disponible(self):
        with patch(
            "materialidad.ai.checklists.get_ai_client",
            side_effect=ImproperlyConfigured("OPENAI_API_KEY debe estar configurada"),
        ):
            result = generate_checklist_draft(
                naturaleza_operacion="Servicio de soporte operativo y documental",
                tipo_operacion=Operacion.TipoOperacion.SERVICIO,
            )

        self.assertEqual(result["source"], "fallback")
        self.assertEqual(result["draft"]["tipo_gasto"], "Servicios profesionales")
        self.assertGreaterEqual(len(result["draft"]["items"]), 4)
        self.assertTrue(result["warnings"])