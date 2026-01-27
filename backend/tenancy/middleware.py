from __future__ import annotations

from django.conf import settings
from django.http import JsonResponse

from .context import TenantContext, TenantNotActive, TenantNotFound


class TenantMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

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
            return JsonResponse({"detail": "Debe especificar el tenant"}, status=400)
        else:
            request.tenant = None

        try:
            response = self.get_response(request)
        finally:
            TenantContext.clear()
        return response
