from __future__ import annotations

from django.conf import settings
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.authentication import JWTAuthentication as SimpleJWTAuthentication

from tenancy.context import TenantContext, TenantNotActive, TenantNotFound


class JWTAuthentication(SimpleJWTAuthentication):
    def authenticate(self, request):
        authentication = super().authenticate(request)
        if not authentication:
            return None

        user, token = authentication
        tenant_slug = token.payload.get("tenant")  # type: ignore[attr-defined]
        if not tenant_slug:
            tenant_slug = request.META.get(settings.TENANT_HEADER)

        if tenant_slug:
            try:
                TenantContext.activate(tenant_slug)
            except TenantNotFound as exc:
                raise AuthenticationFailed("El tenant indicado no existe") from exc
            except TenantNotActive as exc:
                raise AuthenticationFailed("El tenant indicado está inactivo") from exc
            request.tenant = TenantContext.get_current_tenant()
        else:
            request.tenant = None

        return user, token
