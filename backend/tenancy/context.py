from __future__ import annotations

import threading
from typing import Optional

from django.db import connections

from .models import Tenant


class TenantNotFound(Exception):
    """Raised when requested tenant does not exist"""


class TenantNotActive(Exception):
    """Raised when tenant is inactive"""


_thread_local = threading.local()


class TenantContext:
    @classmethod
    def activate(cls, slug: str) -> Tenant:
        try:
            tenant = Tenant.objects.using("default").get(slug=slug)
        except Tenant.DoesNotExist as exc:  # type: ignore[attr-defined]
            raise TenantNotFound from exc

        if not tenant.is_active:
            raise TenantNotActive

        if tenant.db_alias not in connections.databases:
            connections.databases[tenant.db_alias] = tenant.database_dict()

        setattr(_thread_local, "tenant", tenant)
        setattr(_thread_local, "alias", tenant.db_alias)
        return tenant

    @classmethod
    def get_current_tenant(cls) -> Optional[Tenant]:
        return getattr(_thread_local, "tenant", None)

    @classmethod
    def get_current_db_alias(cls) -> Optional[str]:
        return getattr(_thread_local, "alias", None)

    @classmethod
    def clear(cls) -> None:
        alias = cls.get_current_db_alias()
        if alias and alias in connections:
            connections[alias].close()
        for attr in ("tenant", "alias"):
            if hasattr(_thread_local, attr):
                delattr(_thread_local, attr)
