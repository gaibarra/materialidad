from __future__ import annotations

import logging

from django.conf import settings
from django.http import JsonResponse
from rest_framework_simplejwt.tokens import AccessToken

from .context import TenantContext, TenantNotActive, TenantNotFound

logger = logging.getLogger(__name__)


class TenantMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def _is_superuser_from_token(self, request) -> bool:
        """Best-effort check: decode JWT to see if user is superuser."""
        auth = request.META.get("HTTP_AUTHORIZATION", "")
        if not auth.startswith("Bearer "):
            return False
        try:
            from accounts.models import User
            token = AccessToken(auth[7:])
            user = User.objects.filter(pk=token["user_id"]).only("is_superuser").first()
            return user.is_superuser if user else False
        except Exception:
            return False

    def __call__(self, request):
        tenant_slug = request.META.get(settings.TENANT_HEADER)
        requires_tenant = any(
            request.path.startswith(prefix) for prefix in settings.TENANT_REQUIRED_PATH_PREFIXES
        )

        if tenant_slug:
            try:
                tenant = TenantContext.activate(tenant_slug)
                request.tenant = tenant
            except TenantNotFound:
                return JsonResponse({"detail": "Tenant no encontrado"}, status=404)
            except TenantNotActive:
                return JsonResponse({"detail": "Tenant inactivo"}, status=403)
        elif requires_tenant:
            # Allow superusers through without a tenant (control-plane access)
            if self._is_superuser_from_token(request):
                logger.info("Superuser accessing tenant-required path without tenant: %s", request.path)
                request.tenant = None
            else:
                return JsonResponse({"detail": "Debe especificar el tenant"}, status=400)
        else:
            request.tenant = None

        try:
            response = self.get_response(request)
        finally:
            TenantContext.clear()
        return response
