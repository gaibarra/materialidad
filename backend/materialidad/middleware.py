from __future__ import annotations

import logging
import time

from django.conf import settings

logger = logging.getLogger("materialidad.observability")


class MaterialidadMetricsMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response
        self.path_prefix = "/api/materialidad/"
        self.slow_ms_threshold = int(getattr(settings, "MATERIALIDAD_OBSERVABILITY_SLOW_MS", 1200))

    def __call__(self, request):
        path = (request.path or "").lower()
        if not path.startswith(self.path_prefix):
            return self.get_response(request)

        start = time.perf_counter()
        response = self.get_response(request)
        duration_ms = round((time.perf_counter() - start) * 1000.0, 2)

        payload = {
            "path": request.path,
            "method": request.method,
            "status_code": response.status_code,
            "duration_ms": duration_ms,
            "tenant": request.headers.get("X-Tenant", ""),
        }

        if response.status_code >= 500:
            logger.error("materialidad_request", extra={"metric": payload})
        elif duration_ms >= self.slow_ms_threshold:
            logger.warning("materialidad_request_slow", extra={"metric": payload})
        else:
            logger.info("materialidad_request", extra={"metric": payload})

        return response
