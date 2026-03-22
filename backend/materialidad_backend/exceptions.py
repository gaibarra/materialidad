from __future__ import annotations

from typing import Any

from rest_framework.views import exception_handler as drf_exception_handler


def _first_error_message(field_errors: dict[str, Any]) -> str | None:
    for field, value in field_errors.items():
        if isinstance(value, list) and value:
            return f"{field}: {value[0]}"
        if isinstance(value, str) and value:
            return f"{field}: {value}"
    return None


def custom_exception_handler(exc, context):
    response = drf_exception_handler(exc, context)
    if response is None:
        return response

    data: Any = response.data
    detail = "Ocurrió un error al procesar la solicitud."
    field_errors: dict[str, Any] = {}

    if isinstance(data, dict):
        if "detail" in data:
            detail = str(data.get("detail") or detail)
        if "non_field_errors" in data:
            non_field = data.get("non_field_errors")
            if isinstance(non_field, list) and non_field:
                detail = str(non_field[0])
            elif isinstance(non_field, str):
                detail = non_field
        for key, value in data.items():
            if key in {"detail", "non_field_errors"}:
                continue
            field_errors[key] = value
        if field_errors and (not detail or detail == "Ocurrió un error al procesar la solicitud."):
            first = _first_error_message(field_errors)
            detail = first or "Corrige los campos marcados e intenta nuevamente."
    elif isinstance(data, list):
        if data:
            detail = str(data[0])
    elif data:
        detail = str(data)

    code_map = {
        400: "validation_error",
        401: "authentication_error",
        403: "permission_denied",
        404: "not_found",
    }
    code = code_map.get(response.status_code, "api_error")

    response.data = {
        "detail": detail,
        "field_errors": field_errors,
        "code": code,
    }
    return response
