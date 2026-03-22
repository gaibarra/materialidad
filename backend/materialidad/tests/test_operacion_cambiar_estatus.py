from __future__ import annotations

from datetime import date
from unittest.mock import patch

from django.test import TestCase, override_settings
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient

from accounts.models import User
from materialidad.models import AlertaOperacion, AuditLog, Contrato, Empresa, EvidenciaMaterial, Operacion, Proveedor


@override_settings(TENANT_REQUIRED_PATH_PREFIXES=[])
class OperacionCambioEstatusTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            email="qa@example.com",
            password="Password123!",
        )
        self.client.force_authenticate(user=self.user)

        self.empresa = Empresa.objects.create(
            razon_social="Empresa Demo SA de CV",
            rfc="EMD010101AAA",
            regimen_fiscal="601",
            estado="CDMX",
        )
        self.proveedor = Proveedor.objects.create(
            razon_social="Proveedor Demo SA de CV",
            rfc="PRD010101AAA",
        )

    def _crear_contrato(self, categoria: str = Contrato.Categoria.PROVEEDORES) -> Contrato:
        return Contrato.objects.create(
            empresa=self.empresa,
            proveedor=self.proveedor,
            nombre="Contrato base",
            categoria=categoria,
            proceso=Contrato.ProcesoNegocio.OPERACIONES,
            tipo_empresa=Contrato.TipoEmpresa.SERVICIOS,
        )

    def _crear_operacion(self, **kwargs) -> Operacion:
        defaults = {
            "empresa": self.empresa,
            "proveedor": self.proveedor,
            "monto": "1000.00",
            "moneda": Operacion.Moneda.MXN,
            "fecha_operacion": date(2026, 1, 10),
            "tipo_operacion": Operacion.TipoOperacion.SERVICIO,
            "concepto": "Servicio técnico mensual",
            "estatus_validacion": Operacion.EstatusValidacion.PENDIENTE,
        }
        defaults.update(kwargs)
        return Operacion.objects.create(**defaults)

    def _url(self, operacion_id: int) -> str:
        return f"/api/materialidad/operaciones/{operacion_id}/cambiar-estatus/"

    def test_bloquea_validado_si_expediente_incompleto(self):
        operacion = self._crear_operacion()

        response = self.client.post(
            self._url(operacion.id),
            {
                "estatus_validacion": Operacion.EstatusValidacion.VALIDADO,
                "comentario": "Intento de validación",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["perfil_validacion"], "SERVICIOS")
        self.assertIn("faltantes", response.data)
        self.assertGreaterEqual(len(response.data["faltantes"]), 3)
        self.assertTrue(any("Contrato asociado" in item for item in response.data["faltantes"]))
        self.assertTrue(any("UUID CFDI" in item for item in response.data["faltantes"]))

        operacion.refresh_from_db()
        self.assertEqual(operacion.estatus_validacion, Operacion.EstatusValidacion.PENDIENTE)

    def test_permita_validado_con_expediente_completo_servicios(self):
        contrato = self._crear_contrato()
        operacion = self._crear_operacion(
            contrato=contrato,
            uuid_cfdi="3f2504e0-4f89-41d3-9a0c-0305e82c3301",
            referencia_spei="SPEI-123456",
            tipo_operacion=Operacion.TipoOperacion.SERVICIO,
        )

        EvidenciaMaterial.objects.create(
            operacion=operacion,
            tipo=EvidenciaMaterial.Tipo.ENTREGABLE,
            archivo=SimpleUploadedFile("entregable.txt", b"entregable"),
            descripcion="Entregable final",
        )
        EvidenciaMaterial.objects.create(
            operacion=operacion,
            tipo=EvidenciaMaterial.Tipo.BITACORA,
            archivo=SimpleUploadedFile("bitacora.txt", b"bitacora"),
            descripcion="Bitácora de seguimiento",
        )

        response = self.client.post(
            self._url(operacion.id),
            {
                "estatus_validacion": Operacion.EstatusValidacion.VALIDADO,
                "comentario": "Expediente completo y validado",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        operacion.refresh_from_db()
        self.assertEqual(operacion.estatus_validacion, Operacion.EstatusValidacion.VALIDADO)
        self.assertIsNotNone(operacion.ultima_validacion)
        self.assertIn("comentarios_estatus", operacion.detalles_validacion)
        self.assertEqual(operacion.detalles_validacion["comentarios_estatus"][-1]["comentario"], "Expediente completo y validado")

    @patch("materialidad.views.sync_operation_defense_projection")
    def test_validado_sincroniza_projection(self, mock_sync_projection):
        contrato = self._crear_contrato()
        operacion = self._crear_operacion(
            contrato=contrato,
            uuid_cfdi="3f2504e0-4f89-41d3-9a0c-0305e82c3301",
            referencia_spei="SPEI-123456",
            tipo_operacion=Operacion.TipoOperacion.SERVICIO,
        )

        EvidenciaMaterial.objects.create(
            operacion=operacion,
            tipo=EvidenciaMaterial.Tipo.ENTREGABLE,
            archivo=SimpleUploadedFile("entregable-sync.txt", b"entregable"),
            descripcion="Entregable final",
        )
        EvidenciaMaterial.objects.create(
            operacion=operacion,
            tipo=EvidenciaMaterial.Tipo.BITACORA,
            archivo=SimpleUploadedFile("bitacora-sync.txt", b"bitacora"),
            descripcion="Bitacora de seguimiento",
        )

        response = self.client.post(
            self._url(operacion.id),
            {
                "estatus_validacion": Operacion.EstatusValidacion.VALIDADO,
                "comentario": "Sincronizar proyeccion",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        mock_sync_projection.assert_called_once()
        self.assertEqual(mock_sync_projection.call_args.kwargs["operacion"].id, operacion.id)

        self.assertTrue(
            AuditLog.objects.filter(
                action="operacion_estatus_actualizado",
                object_type="materialidad.operacion",
                object_id=str(operacion.id),
            ).exists()
        )

    def test_bloquea_validado_compra_sin_evidencia_recepcion(self):
        contrato = self._crear_contrato()
        operacion = self._crear_operacion(
            contrato=contrato,
            uuid_cfdi="4f2504e0-4f89-41d3-9a0c-0305e82c3302",
            referencia_spei="SPEI-445566",
            tipo_operacion=Operacion.TipoOperacion.COMPRA,
            concepto="Compra de equipo de cómputo",
        )

        response = self.client.post(
            self._url(operacion.id),
            {
                "estatus_validacion": Operacion.EstatusValidacion.VALIDADO,
                "comentario": "Validación compra",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["perfil_validacion"], "COMPRAS")
        self.assertTrue(any("Recepción material del bien" in item for item in response.data["faltantes"]))

    def test_permita_validado_compra_con_fotografia(self):
        contrato = self._crear_contrato()
        operacion = self._crear_operacion(
            contrato=contrato,
            uuid_cfdi="5f2504e0-4f89-41d3-9a0c-0305e82c3303",
            referencia_spei="SPEI-778899",
            tipo_operacion=Operacion.TipoOperacion.COMPRA,
            concepto="Compra de mobiliario",
        )

        EvidenciaMaterial.objects.create(
            operacion=operacion,
            tipo=EvidenciaMaterial.Tipo.FOTOGRAFIA,
            archivo=SimpleUploadedFile("foto-recepcion.txt", b"foto"),
            descripcion="Evidencia de recepción del bien",
        )

        response = self.client.post(
            self._url(operacion.id),
            {
                "estatus_validacion": Operacion.EstatusValidacion.VALIDADO,
                "comentario": "Compra validada con evidencia",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        operacion.refresh_from_db()
        self.assertEqual(operacion.estatus_validacion, Operacion.EstatusValidacion.VALIDADO)

    def test_bloquea_partes_relacionadas_sin_razon_negocio(self):
        contrato = self._crear_contrato(categoria=Contrato.Categoria.PARTES_RELACIONADAS)
        operacion = self._crear_operacion(
            contrato=contrato,
            uuid_cfdi="6f2504e0-4f89-41d3-9a0c-0305e82c3304",
            referencia_spei="SPEI-112233",
            tipo_operacion=Operacion.TipoOperacion.SERVICIO,
            concepto="Servicio intragrupo",
            metadata={},
        )

        EvidenciaMaterial.objects.create(
            operacion=operacion,
            tipo=EvidenciaMaterial.Tipo.ENTREGABLE,
            archivo=SimpleUploadedFile("entregable-partes-relacionadas.txt", b"entregable"),
            descripcion="Entregable de soporte intragrupo",
        )

        response = self.client.post(
            self._url(operacion.id),
            {
                "estatus_validacion": Operacion.EstatusValidacion.VALIDADO,
                "comentario": "Validación partes relacionadas",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["perfil_validacion"], "PARTES_RELACIONADAS")
        self.assertTrue(any("Razón de negocio" in item for item in response.data["faltantes"]))

    def test_permita_validado_partes_relacionadas_con_razon_negocio(self):
        contrato = self._crear_contrato(categoria=Contrato.Categoria.PARTES_RELACIONADAS)
        operacion = self._crear_operacion(
            contrato=contrato,
            uuid_cfdi="7f2504e0-4f89-41d3-9a0c-0305e82c3305",
            referencia_spei="SPEI-334455",
            tipo_operacion=Operacion.TipoOperacion.SERVICIO,
            concepto="Asesoría intragrupo",
            metadata={"razon_negocio": "Centralización de servicios especializados"},
        )

        EvidenciaMaterial.objects.create(
            operacion=operacion,
            tipo=EvidenciaMaterial.Tipo.ENTREGABLE,
            archivo=SimpleUploadedFile("entregable-pr-ok.txt", b"entregable"),
            descripcion="Entregable técnico intragrupo",
        )

        response = self.client.post(
            self._url(operacion.id),
            {
                "estatus_validacion": Operacion.EstatusValidacion.VALIDADO,
                "comentario": "Partes relacionadas validada",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        operacion.refresh_from_db()
        self.assertEqual(operacion.estatus_validacion, Operacion.EstatusValidacion.VALIDADO)

    def test_permita_validado_con_forma_pago_en_metadata_sin_spei(self):
        contrato = self._crear_contrato()
        operacion = self._crear_operacion(
            contrato=contrato,
            uuid_cfdi="8f2504e0-4f89-41d3-9a0c-0305e82c3306",
            referencia_spei="",
            tipo_operacion=Operacion.TipoOperacion.SERVICIO,
            metadata={"forma_pago": "Transferencia electrónica"},
        )

        EvidenciaMaterial.objects.create(
            operacion=operacion,
            tipo=EvidenciaMaterial.Tipo.ENTREGABLE,
            archivo=SimpleUploadedFile("entregable-forma-pago.txt", b"entregable"),
            descripcion="Entregable final",
        )
        EvidenciaMaterial.objects.create(
            operacion=operacion,
            tipo=EvidenciaMaterial.Tipo.BITACORA,
            archivo=SimpleUploadedFile("bitacora-forma-pago.txt", b"bitacora"),
            descripcion="Bitácora de seguimiento",
        )

        response = self.client.post(
            self._url(operacion.id),
            {
                "estatus_validacion": Operacion.EstatusValidacion.VALIDADO,
                "comentario": "Validado por soporte de pago en metadata",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        operacion.refresh_from_db()
        self.assertEqual(operacion.estatus_validacion, Operacion.EstatusValidacion.VALIDADO)

    def test_permita_validado_con_soporte_pago_en_metadata_sin_spei(self):
        contrato = self._crear_contrato()
        operacion = self._crear_operacion(
            contrato=contrato,
            uuid_cfdi="9f2504e0-4f89-41d3-9a0c-0305e82c3307",
            referencia_spei="",
            tipo_operacion=Operacion.TipoOperacion.SERVICIO,
            metadata={"soporte_pago": "Estado de cuenta bancario folio EC-2026-03"},
        )

        EvidenciaMaterial.objects.create(
            operacion=operacion,
            tipo=EvidenciaMaterial.Tipo.ENTREGABLE,
            archivo=SimpleUploadedFile("entregable-soporte-pago.txt", b"entregable"),
            descripcion="Entregable final",
        )
        EvidenciaMaterial.objects.create(
            operacion=operacion,
            tipo=EvidenciaMaterial.Tipo.COMUNICACION,
            archivo=SimpleUploadedFile("comunicacion-soporte-pago.txt", b"correo"),
            descripcion="Correo de seguimiento del servicio",
        )

        response = self.client.post(
            self._url(operacion.id),
            {
                "estatus_validacion": Operacion.EstatusValidacion.VALIDADO,
                "comentario": "Validado por soporte de pago en metadata",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        operacion.refresh_from_db()
        self.assertEqual(operacion.estatus_validacion, Operacion.EstatusValidacion.VALIDADO)

    def test_regresion_servicios_falla_por_falta_bitacora_o_comunicacion(self):
        contrato = self._crear_contrato()
        operacion = self._crear_operacion(
            contrato=contrato,
            uuid_cfdi="af2504e0-4f89-41d3-9a0c-0305e82c3308",
            referencia_spei="SPEI-556677",
            tipo_operacion=Operacion.TipoOperacion.SERVICIO,
        )

        EvidenciaMaterial.objects.create(
            operacion=operacion,
            tipo=EvidenciaMaterial.Tipo.ENTREGABLE,
            archivo=SimpleUploadedFile("entregable-reg-servicios.txt", b"entregable"),
            descripcion="Entregable final",
        )

        response = self.client.post(
            self._url(operacion.id),
            {
                "estatus_validacion": Operacion.EstatusValidacion.VALIDADO,
                "comentario": "Debe fallar por faltante único",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["perfil_validacion"], "SERVICIOS")
        self.assertEqual(len(response.data["faltantes"]), 1)
        self.assertIn("Bitácora o comunicación de seguimiento", response.data["faltantes"][0])

    def test_regresion_compras_falla_por_falta_recepcion_material(self):
        contrato = self._crear_contrato()
        operacion = self._crear_operacion(
            contrato=contrato,
            uuid_cfdi="bf2504e0-4f89-41d3-9a0c-0305e82c3309",
            referencia_spei="SPEI-778800",
            tipo_operacion=Operacion.TipoOperacion.COMPRA,
        )

        response = self.client.post(
            self._url(operacion.id),
            {
                "estatus_validacion": Operacion.EstatusValidacion.VALIDADO,
                "comentario": "Debe fallar por faltante único",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["perfil_validacion"], "COMPRAS")
        self.assertEqual(len(response.data["faltantes"]), 1)
        self.assertIn("Recepción material del bien", response.data["faltantes"][0])

    def test_regresion_partes_relacionadas_falla_por_falta_entregable(self):
        contrato = self._crear_contrato(categoria=Contrato.Categoria.PARTES_RELACIONADAS)
        operacion = self._crear_operacion(
            contrato=contrato,
            uuid_cfdi="cf2504e0-4f89-41d3-9a0c-0305e82c3310",
            referencia_spei="SPEI-990011",
            tipo_operacion=Operacion.TipoOperacion.SERVICIO,
            metadata={"razon_negocio": "Sinergias operativas de grupo"},
        )

        response = self.client.post(
            self._url(operacion.id),
            {
                "estatus_validacion": Operacion.EstatusValidacion.VALIDADO,
                "comentario": "Debe fallar por faltante único",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["perfil_validacion"], "PARTES_RELACIONADAS")
        self.assertEqual(len(response.data["faltantes"]), 1)
        self.assertIn("Evidencia principal de operación entre partes relacionadas", response.data["faltantes"][0])

    def test_permita_cambio_a_en_proceso_con_expediente_incompleto(self):
        operacion = self._crear_operacion()

        response = self.client.post(
            self._url(operacion.id),
            {
                "estatus_validacion": Operacion.EstatusValidacion.EN_PROCESO,
                "comentario": "Se inicia revisión documental",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        operacion.refresh_from_db()
        self.assertEqual(operacion.estatus_validacion, Operacion.EstatusValidacion.EN_PROCESO)
        self.assertIn("comentarios_estatus", operacion.detalles_validacion)
        self.assertEqual(operacion.detalles_validacion["comentarios_estatus"][-1]["estatus"], Operacion.EstatusValidacion.EN_PROCESO)
        self.assertTrue(
            AuditLog.objects.filter(
                action="operacion_estatus_actualizado",
                object_type="materialidad.operacion",
                object_id=str(operacion.id),
                changes__estatus_validacion=Operacion.EstatusValidacion.EN_PROCESO,
            ).exists()
        )

    def test_permita_cambio_a_rechazado_con_expediente_incompleto(self):
        operacion = self._crear_operacion()

        response = self.client.post(
            self._url(operacion.id),
            {
                "estatus_validacion": Operacion.EstatusValidacion.RECHAZADO,
                "comentario": "Rechazado por inconsistencias de soporte",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        operacion.refresh_from_db()
        self.assertEqual(operacion.estatus_validacion, Operacion.EstatusValidacion.RECHAZADO)
        self.assertIn("comentarios_estatus", operacion.detalles_validacion)
        self.assertEqual(operacion.detalles_validacion["comentarios_estatus"][-1]["estatus"], Operacion.EstatusValidacion.RECHAZADO)
        self.assertTrue(
            AuditLog.objects.filter(
                action="operacion_estatus_actualizado",
                object_type="materialidad.operacion",
                object_id=str(operacion.id),
                changes__estatus_validacion=Operacion.EstatusValidacion.RECHAZADO,
            ).exists()
        )

    def test_bloquea_transicion_invalida_en_proceso_a_pendiente(self):
        operacion = self._crear_operacion(estatus_validacion=Operacion.EstatusValidacion.EN_PROCESO)

        response = self.client.post(
            self._url(operacion.id),
            {
                "estatus_validacion": Operacion.EstatusValidacion.PENDIENTE,
                "comentario": "Intento de reversa no permitida",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("Transición de estatus no permitida", response.data["detail"])
        self.assertEqual(response.data["estatus_actual"], Operacion.EstatusValidacion.EN_PROCESO)
        self.assertEqual(response.data["estatus_solicitado"], Operacion.EstatusValidacion.PENDIENTE)
        self.assertEqual(
            response.data["transiciones_permitidas"],
            [Operacion.EstatusValidacion.RECHAZADO, Operacion.EstatusValidacion.VALIDADO],
        )

        operacion.refresh_from_db()
        self.assertEqual(operacion.estatus_validacion, Operacion.EstatusValidacion.EN_PROCESO)

    def test_permite_reapertura_rechazado_a_en_proceso(self):
        operacion = self._crear_operacion(estatus_validacion=Operacion.EstatusValidacion.RECHAZADO)

        response = self.client.post(
            self._url(operacion.id),
            {
                "estatus_validacion": Operacion.EstatusValidacion.EN_PROCESO,
                "comentario": "Se reabre para subsanar expediente",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        operacion.refresh_from_db()
        self.assertEqual(operacion.estatus_validacion, Operacion.EstatusValidacion.EN_PROCESO)

    def test_bloquea_transicion_invalida_validado_a_pendiente(self):
        operacion = self._crear_operacion(estatus_validacion=Operacion.EstatusValidacion.VALIDADO)

        response = self.client.post(
            self._url(operacion.id),
            {
                "estatus_validacion": Operacion.EstatusValidacion.PENDIENTE,
                "comentario": "No debe volver a pendiente",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["estatus_actual"], Operacion.EstatusValidacion.VALIDADO)
        self.assertEqual(response.data["estatus_solicitado"], Operacion.EstatusValidacion.PENDIENTE)
        self.assertEqual(response.data["transiciones_permitidas"], [Operacion.EstatusValidacion.EN_PROCESO])

        operacion.refresh_from_db()
        self.assertEqual(operacion.estatus_validacion, Operacion.EstatusValidacion.VALIDADO)

    def test_riesgo_bajo_con_expediente_completo_y_proveedor_bajo(self):
        contrato = self._crear_contrato()
        operacion = self._crear_operacion(
            contrato=contrato,
            uuid_cfdi="d12504e0-4f89-41d3-9a0c-0305e82c3311",
            referencia_spei="SPEI-LOW-001",
            tipo_operacion=Operacion.TipoOperacion.SERVICIO,
        )

        EvidenciaMaterial.objects.create(
            operacion=operacion,
            tipo=EvidenciaMaterial.Tipo.ENTREGABLE,
            archivo=SimpleUploadedFile("entregable-low.txt", b"entregable"),
            descripcion="Entregable completo",
        )
        EvidenciaMaterial.objects.create(
            operacion=operacion,
            tipo=EvidenciaMaterial.Tipo.BITACORA,
            archivo=SimpleUploadedFile("bitacora-low.txt", b"bitacora"),
            descripcion="Bitácora completa",
        )

        response = self.client.post(
            self._url(operacion.id),
            {
                "estatus_validacion": Operacion.EstatusValidacion.EN_PROCESO,
                "comentario": "Calcular riesgo base",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["riesgo_nivel"], "BAJO")
        self.assertEqual(response.data["riesgo_score"], 0)

        operacion.refresh_from_db()
        riesgo = (operacion.metadata or {}).get("riesgo_materialidad", {})
        self.assertEqual(riesgo.get("nivel"), "BAJO")
        self.assertEqual(riesgo.get("score"), 0)

    def test_riesgo_medio_con_faltante_critico_y_proveedor_medio(self):
        self.proveedor.riesgo_fiscal = Proveedor.Riesgo.MEDIO
        self.proveedor.save(update_fields=["riesgo_fiscal", "updated_at"])

        contrato = self._crear_contrato()
        operacion = self._crear_operacion(
            contrato=contrato,
            uuid_cfdi="",
            referencia_spei="SPEI-MED-001",
            tipo_operacion=Operacion.TipoOperacion.COMPRA,
        )

        EvidenciaMaterial.objects.create(
            operacion=operacion,
            tipo=EvidenciaMaterial.Tipo.FOTOGRAFIA,
            archivo=SimpleUploadedFile("foto-med.txt", b"foto"),
            descripcion="Recepción material",
        )

        response = self.client.post(
            self._url(operacion.id),
            {
                "estatus_validacion": Operacion.EstatusValidacion.EN_PROCESO,
                "comentario": "Calcular riesgo medio",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["riesgo_nivel"], "MEDIO")
        self.assertGreaterEqual(response.data["riesgo_score"], 20)

        operacion.refresh_from_db()
        riesgo = (operacion.metadata or {}).get("riesgo_materialidad", {})
        self.assertEqual(riesgo.get("nivel"), "MEDIO")
        self.assertGreaterEqual(riesgo.get("score", 0), 20)

    def test_riesgo_alto_con_69b_presunto_y_proveedor_alto(self):
        self.proveedor.riesgo_fiscal = Proveedor.Riesgo.ALTO
        self.proveedor.estatus_69b = Proveedor.Estatus69B.PRESUNTO
        self.proveedor.save(update_fields=["riesgo_fiscal", "estatus_69b", "updated_at"])

        operacion = self._crear_operacion(
            contrato=None,
            uuid_cfdi="",
            referencia_spei="",
            tipo_operacion=Operacion.TipoOperacion.SERVICIO,
        )

        response = self.client.post(
            self._url(operacion.id),
            {
                "estatus_validacion": Operacion.EstatusValidacion.EN_PROCESO,
                "comentario": "Calcular riesgo alto",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["riesgo_nivel"], "ALTO")
        self.assertGreaterEqual(response.data["riesgo_score"], 70)

        operacion.refresh_from_db()
        riesgo = (operacion.metadata or {}).get("riesgo_materialidad", {})
        self.assertEqual(riesgo.get("nivel"), "ALTO")
        self.assertGreaterEqual(riesgo.get("score", 0), 70)

    def test_crea_alerta_activa_por_faltantes_criticos_en_validado(self):
        operacion = self._crear_operacion()

        response = self.client.post(
            self._url(operacion.id),
            {
                "estatus_validacion": Operacion.EstatusValidacion.VALIDADO,
                "comentario": "Intento que debe bloquearse",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("alerta_operacion_id", response.data)
        alerta_id = response.data["alerta_operacion_id"]
        self.assertIsNotNone(alerta_id)

        alerta = AlertaOperacion.objects.get(id=alerta_id)
        self.assertEqual(alerta.operacion_id, operacion.id)
        self.assertEqual(alerta.estatus, AlertaOperacion.Estatus.ACTIVA)
        self.assertEqual(alerta.tipo_alerta, AlertaOperacion.TipoAlerta.FALTANTES_CRITICOS)
        self.assertEqual(alerta.owner_email, self.user.email)
        self.assertIn("faltantes_criticos", alerta.detalle)
        self.assertGreaterEqual(len(alerta.detalle["faltantes_criticos"]), 2)

    def test_no_duplica_alerta_activa_misma_clave(self):
        operacion = self._crear_operacion()

        response_1 = self.client.post(
            self._url(operacion.id),
            {
                "estatus_validacion": Operacion.EstatusValidacion.VALIDADO,
                "comentario": "Primer intento bloqueado",
            },
            format="json",
        )
        self.assertEqual(response_1.status_code, 400)

        response_2 = self.client.post(
            self._url(operacion.id),
            {
                "estatus_validacion": Operacion.EstatusValidacion.VALIDADO,
                "comentario": "Segundo intento bloqueado",
            },
            format="json",
        )
        self.assertEqual(response_2.status_code, 400)

        self.assertEqual(response_1.data["alerta_operacion_id"], response_2.data["alerta_operacion_id"])
        self.assertEqual(AlertaOperacion.objects.count(), 1)

    def test_lista_alertas_filtrable_por_empresa_proveedor_estatus(self):
        operacion = self._crear_operacion()
        self.client.post(
            self._url(operacion.id),
            {
                "estatus_validacion": Operacion.EstatusValidacion.VALIDADO,
                "comentario": "Generar alerta",
            },
            format="json",
        )

        self.assertEqual(AlertaOperacion.objects.count(), 1)
        alerta = AlertaOperacion.objects.first()
        alerta.estatus = AlertaOperacion.Estatus.EN_SEGUIMIENTO
        alerta.save(update_fields=["estatus", "updated_at"])

        list_response = self.client.get(
            "/api/materialidad/alertas-operacion/",
            {
                "empresa_rfc": self.empresa.rfc,
                "proveedor_rfc": self.proveedor.rfc,
                "estatus": AlertaOperacion.Estatus.EN_SEGUIMIENTO,
            },
        )

        self.assertEqual(list_response.status_code, 200)
        results = list_response.data.get("results", list_response.data)
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["id"], alerta.id)
