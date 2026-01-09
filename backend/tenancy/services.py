from __future__ import annotations

import logging
from typing import Optional

from django.conf import settings
from django.core.management import call_command
from django.db import DEFAULT_DB_ALIAS, connections, transaction
from django.db.utils import ProgrammingError

from accounts.models import User

from .context import TenantContext
from .models import Despacho, Tenant, TenantProvisionLog

logger = logging.getLogger(__name__)


class TenantProvisionError(Exception):
    pass


def record_provision_log(
    *,
    slug: str,
    admin_email: str,
    status: str,
    message: str,
    initiated_by: Optional[User] = None,
    metadata: Optional[dict] = None,
):
    try:
        return TenantProvisionLog.objects.create(
            slug=slug,
            admin_email=admin_email,
            status=status,
            message=message[:500],
            initiated_by=initiated_by,
            metadata=metadata or {},
        )
    except Exception:  # pragma: no cover - no debe bloquear el flujo
        logger.exception("No se pudo registrar el log de aprovisionamiento")
        return None


def _ensure_db_role(username: str, password: str) -> None:
    conn = connections[DEFAULT_DB_ALIAS]
    quote = conn.ops.quote_name
    with conn.cursor() as cursor:
        cursor.execute("SELECT 1 FROM pg_roles WHERE rolname = %s", [username])
        exists = cursor.fetchone()
        if not exists:
            cursor.execute(f"CREATE ROLE {quote(username)} LOGIN PASSWORD %s", [password])
            logger.info("Rol %s creado", username)
        else:
            logger.info("Rol %s ya existe", username)


def _ensure_database(db_name: str, owner: str) -> None:
    conn = connections[DEFAULT_DB_ALIAS]
    quote = conn.ops.quote_name
    with conn.cursor() as cursor:
        cursor.execute("SELECT 1 FROM pg_database WHERE datname = %s", [db_name])
        exists = cursor.fetchone()
        if not exists:
            cursor.execute(f"CREATE DATABASE {quote(db_name)} OWNER {quote(owner)}")
            logger.info("Base %s creada y asignada a %s", db_name, owner)
        else:
            logger.info("Base %s ya existe", db_name)


def _migrate_control_db() -> None:
    call_command("migrate", database=DEFAULT_DB_ALIAS, interactive=False, run_syncdb=False)


def _migrate_tenant_db(tenant: Tenant) -> None:
    TenantContext.activate(tenant.slug)
    try:
        call_command(
            "migrate",
            database=tenant.db_alias,
            interactive=False,
            run_syncdb=False,
        )
    finally:
        TenantContext.clear()


def _upsert_admin_user(tenant: Tenant, email: str, password: str, full_name: str) -> User:
    manager = User.objects.db_manager(DEFAULT_DB_ALIAS)
    user, _ = manager.get_or_create(
        email=email,
        defaults={
            "full_name": full_name or email,
            "is_staff": True,
            "is_superuser": True,
        },
    )
    user.full_name = full_name or user.full_name
    user.is_staff = True
    user.is_superuser = True
    user.tenant = tenant
    user.set_password(password)
    user.save(using=DEFAULT_DB_ALIAS)
    return user


def provision_tenant(
    *,
    name: str,
    slug: str,
    despacho: Despacho | None,
    db_name: str,
    db_user: str,
    db_password: str,
    db_host: str,
    db_port: int,
    default_currency: str,
    admin_email: str,
    admin_password: str,
    admin_name: Optional[str] = "",
    create_database: bool = True,
    initiated_by: Optional[User] = None,
) -> Tenant:
    metadata = {
        "db_name": db_name,
        "db_user": db_user,
        "db_host": db_host,
        "db_port": db_port,
        "create_database": create_database,
    }

    try:
        _migrate_control_db()
        with transaction.atomic(using=DEFAULT_DB_ALIAS):
            tenant = Tenant.objects.create(
            despacho=despacho,
                name=name,
                slug=slug,
                db_name=db_name,
                db_user=db_user,
                db_password=db_password,
                db_host=db_host,
                db_port=db_port,
                default_currency=default_currency,
                is_active=True,
            )

        if create_database:
            _ensure_db_role(db_user, db_password)
            _ensure_database(db_name, db_user)

        _migrate_tenant_db(tenant)
        _upsert_admin_user(tenant, admin_email.strip(), admin_password, admin_name or "")
    except TenantProvisionError as exc:
        record_provision_log(
            slug=slug,
            admin_email=admin_email,
            status=TenantProvisionLog.Status.FAILURE,
            message=str(exc),
            initiated_by=initiated_by,
            metadata=metadata,
        )
        raise
    except ProgrammingError as exc:
        logger.exception("Error preparando base de datos del tenant")
        error = TenantProvisionError("Error creando base de datos del tenant")
        record_provision_log(
            slug=slug,
            admin_email=admin_email,
            status=TenantProvisionLog.Status.FAILURE,
            message=str(error),
            initiated_by=initiated_by,
            metadata=metadata,
        )
        raise error from exc
    except Exception as exc:  # pragma: no cover - defensive logging
        logger.exception("Error inesperado aprovisionando tenant")
        wrapped = TenantProvisionError("Error inesperado aprovisionando tenant")
        record_provision_log(
            slug=slug,
            admin_email=admin_email,
            status=TenantProvisionLog.Status.FAILURE,
            message=str(wrapped),
            initiated_by=initiated_by,
            metadata=metadata,
        )
        raise wrapped from exc

    record_provision_log(
        slug=slug,
        admin_email=admin_email,
        status=TenantProvisionLog.Status.SUCCESS,
        message="Tenant aprovisionado",
        initiated_by=initiated_by,
        metadata={**metadata, "tenant_id": tenant.id},
    )
    return tenant
