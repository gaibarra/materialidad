from __future__ import annotations

from unittest import mock

from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from accounts.models import User
from tenancy.models import Despacho, Tenant, TenantProvisionLog
from tenancy.services import TenantProvisionError


@override_settings(TENANT_FREE_LIMIT=5)
class TenantProvisioningTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_superuser(
            email="admin@example.com",
            password="Password123",
        )
        self.despacho = Despacho.objects.create(nombre="Despacho Uno")
        self.client.force_authenticate(user=self.admin)

    def _payload(self) -> dict:
        return {
            "despacho": self.despacho.id,
            "name": "Cliente Demo",
            "slug": "cliente-demo",
            "db_name": "tenant_cliente_demo",
            "db_user": "tenant_user",
            "db_password": "supersecret",
            "db_host": "localhost",
            "db_port": 5432,
            "default_currency": "MXN",
            "create_database": True,
            "admin_email": "owner@example.com",
            "admin_password": "Password123!",
            "admin_name": "Owner",
        }

    @mock.patch("tenancy.services._upsert_admin_user")
    @mock.patch("tenancy.services._migrate_tenant_db")
    @mock.patch("tenancy.services._ensure_database")
    @mock.patch("tenancy.services._ensure_db_role")
    @mock.patch("tenancy.services._migrate_control_db")
    def test_provision_creates_success_log(
        self,
        mock_ctrl_migrate,
        mock_role,
        mock_db,
        mock_migrate,
        mock_user,
    ):
        response = self.client.post("/api/tenancy/provision/", self._payload(), format="json")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(Tenant.objects.count(), 1)

        log = TenantProvisionLog.objects.first()
        self.assertIsNotNone(log)
        assert log is not None
        self.assertEqual(log.status, TenantProvisionLog.Status.SUCCESS)
        self.assertEqual(log.slug, "cliente-demo")
        self.assertEqual(log.initiated_by, self.admin)
        self.assertIn("db_name", log.metadata)

    @mock.patch("tenancy.services._upsert_admin_user")
    @mock.patch("tenancy.services._migrate_tenant_db")
    @mock.patch("tenancy.services._ensure_database", side_effect=TenantProvisionError("sin permisos"))
    @mock.patch("tenancy.services._ensure_db_role")
    @mock.patch("tenancy.services._migrate_control_db")
    def test_provision_logs_failure(
        self,
        mock_ctrl_migrate,
        mock_role,
        mock_db,
        mock_migrate,
        mock_user,
    ):
        response = self.client.post("/api/tenancy/provision/", self._payload(), format="json")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(TenantProvisionLog.objects.count(), 1)
        log = TenantProvisionLog.objects.first()
        assert log is not None
        self.assertEqual(log.status, TenantProvisionLog.Status.FAILURE)
        self.assertIn("sin permisos", log.message)

    @override_settings(TENANT_FREE_LIMIT=1)
    def test_limit_is_logged_and_blocks(self):
        Tenant.objects.create(
            name="Existente",
            slug="existente",
            db_name="tenant_existente",
            db_user="usr",
            db_password="pwd",
            db_host="localhost",
            db_port=5432,
            default_currency="MXN",
        )

        response = self.client.post("/api/tenancy/provision/", self._payload(), format="json")
        self.assertEqual(response.status_code, 400)
        log = TenantProvisionLog.objects.first()
        self.assertIsNotNone(log)
        assert log is not None
        self.assertEqual(log.status, TenantProvisionLog.Status.FAILURE)
        self.assertIn("límite", log.message)
        self.assertEqual(Tenant.objects.count(), 1)
