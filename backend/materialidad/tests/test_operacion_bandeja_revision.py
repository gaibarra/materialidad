from __future__ import annotations

from datetime import date

from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from accounts.models import User
from materialidad.models import AlertaOperacion, Contrato, Empresa, Operacion, Proveedor


@override_settings(TENANT_REQUIRED_PATH_PREFIXES=[])
class OperacionBandejaRevisionTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            email="qa.bandeja@example.com",
            password="Password123!",
        )
        self.client.force_authenticate(user=self.user)

        self.empresa = Empresa.objects.create(
            razon_social="Empresa Bandeja SA de CV",
            rfc="EBS010101AAA",
            regimen_fiscal="601",
            estado="CDMX",
        )
        self.proveedor = Proveedor.objects.create(
            razon_social="Proveedor Bandeja SA de CV",
            rfc="PBS010101AAA",
        )

    def _crear_contrato(self, categoria: str = Contrato.Categoria.PROVEEDORES) -> Contrato:
        return Contrato.objects.create(
            empresa=self.empresa,
            proveedor=self.proveedor,
            nombre="Contrato Bandeja",
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
            "concepto": "Servicio soporte bandeja",
            "estatus_validacion": Operacion.EstatusValidacion.PENDIENTE,
        }
        defaults.update(kwargs)
        return Operacion.objects.create(**defaults)

    def _intentar_validar(self, operacion: Operacion):
        return self.client.post(
            f"/api/materialidad/operaciones/{operacion.id}/cambiar-estatus/",
            {
                "estatus_validacion": Operacion.EstatusValidacion.VALIDADO,
                "comentario": "Intento para generar alerta",
            },
            format="json",
        )

    def _get_results(self, response):
        payload = response.data
        return payload.get("results", payload)

    def test_bandeja_devuelve_operacion_riesgo_faltantes_y_alertas(self):
        operacion = self._crear_operacion()

        bloqueado = self._intentar_validar(operacion)
        self.assertEqual(bloqueado.status_code, 400)

        response = self.client.get(
            "/api/materialidad/operaciones/bandeja-revision/",
            {
                "rol": "SERVICIOS",
                "riesgo": "ALTO",
            },
        )

        self.assertEqual(response.status_code, 200)
        results = self._get_results(response)
        self.assertEqual(len(results), 1)

        row = results[0]
        self.assertEqual(row["id"], operacion.id)
        self.assertEqual(row["perfil_validacion"], "SERVICIOS")
        self.assertEqual(row["riesgo_nivel"], "ALTO")
        self.assertIn("faltantes", row)
        self.assertGreaterEqual(len(row["faltantes"]), 1)
        self.assertIn("alertas_activas", row)
        self.assertEqual(len(row["alertas_activas"]), 1)
        self.assertIn("checklists_resumen", row)

    def test_bandeja_filtra_por_estatus_y_rfc(self):
        operacion_match = self._crear_operacion(estatus_validacion=Operacion.EstatusValidacion.EN_PROCESO)
        self._crear_operacion(estatus_validacion=Operacion.EstatusValidacion.RECHAZADO)

        response = self.client.get(
            "/api/materialidad/operaciones/bandeja-revision/",
            {
                "estatus": Operacion.EstatusValidacion.EN_PROCESO,
                "rfc": self.empresa.rfc,
            },
        )

        self.assertEqual(response.status_code, 200)
        results = self._get_results(response)
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["id"], operacion_match.id)

    def test_bandeja_ordena_por_riesgo_y_antiguedad(self):
        op_alto = self._crear_operacion(fecha_operacion=date(2026, 1, 9), uuid_cfdi="", referencia_spei="")
        op_bajo = self._crear_operacion(
            fecha_operacion=date(2026, 1, 8),
            contrato=self._crear_contrato(),
            uuid_cfdi="d12504e0-4f89-41d3-9a0c-0305e82c3311",
            referencia_spei="SPEI-LOW-001",
        )

        response_riesgo = self.client.get(
            "/api/materialidad/operaciones/bandeja-revision/",
            {"orden": "riesgo"},
        )
        self.assertEqual(response_riesgo.status_code, 200)
        rows_riesgo = self._get_results(response_riesgo)
        self.assertEqual(rows_riesgo[0]["id"], op_alto.id)

        response_antiguedad = self.client.get(
            "/api/materialidad/operaciones/bandeja-revision/",
            {"orden": "antiguedad"},
        )
        self.assertEqual(response_antiguedad.status_code, 200)
        rows_antiguedad = self._get_results(response_antiguedad)
        self.assertEqual(rows_antiguedad[0]["id"], op_bajo.id)

    def test_bandeja_paginacion_y_rol_invalido(self):
        for index in range(3):
            self._crear_operacion(fecha_operacion=date(2026, 1, 10 + index))

        response = self.client.get("/api/materialidad/operaciones/bandeja-revision/")
        self.assertEqual(response.status_code, 200)
        self.assertIn("count", response.data)
        self.assertIn("results", response.data)

        invalid_role_response = self.client.get(
            "/api/materialidad/operaciones/bandeja-revision/",
            {"rol": "NO_EXISTE"},
        )
        self.assertEqual(invalid_role_response.status_code, 400)
        self.assertIn("roles_validos", invalid_role_response.data)

    def test_bandeja_incluye_alerta_activa_filtrable(self):
        operacion = self._crear_operacion()
        bloqueado = self._intentar_validar(operacion)
        self.assertEqual(bloqueado.status_code, 400)

        alerta = AlertaOperacion.objects.get(operacion=operacion)
        self.assertEqual(alerta.estatus, AlertaOperacion.Estatus.ACTIVA)

        response = self.client.get(
            "/api/materialidad/operaciones/bandeja-revision/",
            {"riesgo": "ALTO", "rol": "SERVICIOS"},
        )
        self.assertEqual(response.status_code, 200)
        rows = self._get_results(response)
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["alertas_activas"][0]["id"], alerta.id)
