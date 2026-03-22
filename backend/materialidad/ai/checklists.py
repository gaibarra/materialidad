from __future__ import annotations

import json
import logging
from decimal import Decimal
from textwrap import dedent
from typing import Any

from django.core.exceptions import ImproperlyConfigured

from ..checklist_templates import DEFAULT_CHECKLIST_NAME_BY_OPERATION_TYPE, DEFAULT_CHECKLIST_TEMPLATES
from ..models import ChecklistItem, CompliancePillar, Contrato, Empresa, Operacion, Proveedor
from .client import ChatMessage, OpenAIClientError, get_ai_client

logger = logging.getLogger(__name__)

_VALID_PILLARS = {value for value, _label in CompliancePillar.choices}
_PILLAR_ALIASES = {
    "ENTREGABLES": CompliancePillar.ENTREGABLES,
    "ENTREGABLE": CompliancePillar.ENTREGABLES,
    "RAZON_NEGOCIO": CompliancePillar.RAZON_NEGOCIO,
    "RAZÓN_NEGOCIO": CompliancePillar.RAZON_NEGOCIO,
    "RAZON DE NEGOCIO": CompliancePillar.RAZON_NEGOCIO,
    "RAZÓN DE NEGOCIO": CompliancePillar.RAZON_NEGOCIO,
    "CAPACIDAD_PROVEEDOR": CompliancePillar.CAPACIDAD_PROVEEDOR,
    "CAPACIDAD DEL PROVEEDOR": CompliancePillar.CAPACIDAD_PROVEEDOR,
    "FECHA_CIERTA": CompliancePillar.FECHA_CIERTA,
    "FECHA CIERTA": CompliancePillar.FECHA_CIERTA,
}
_DEFAULT_RESPONSABLE_BY_PILLAR = {
    CompliancePillar.RAZON_NEGOCIO: "Fiscal / Operaciones",
    CompliancePillar.ENTREGABLES: "Area solicitante",
    CompliancePillar.CAPACIDAD_PROVEEDOR: "Compliance",
    CompliancePillar.FECHA_CIERTA: "Juridico",
}
_GENERIC_FALLBACK_ITEMS = [
    {
        "pillar": CompliancePillar.RAZON_NEGOCIO,
        "titulo": "Narrativa ejecutiva de la operacion",
        "descripcion": "Describe el objetivo economico, el beneficio esperado y la necesidad operativa que justifica la operacion.",
        "requerido": True,
        "responsable": "Fiscal / Operaciones",
    },
    {
        "pillar": CompliancePillar.ENTREGABLES,
        "titulo": "Evidencia verificable de ejecucion",
        "descripcion": "Conserva entregables, reportes, evidencias de recepcion o cualquier prueba trazable de la prestacion o entrega real.",
        "requerido": True,
        "responsable": "Area solicitante",
    },
    {
        "pillar": CompliancePillar.CAPACIDAD_PROVEEDOR,
        "titulo": "Soporte de capacidad del proveedor",
        "descripcion": "Documenta personal, activos, experiencia o infraestructura suficiente para ejecutar la operacion.",
        "requerido": True,
        "responsable": "Compliance",
    },
    {
        "pillar": CompliancePillar.FECHA_CIERTA,
        "titulo": "Contrato o soporte con fecha cierta cuando aplique",
        "descripcion": "Resguarda contrato, anexos o soporte critico con evidencia temporal reforzada cuando el caso lo amerite.",
        "requerido": False,
        "responsable": "Juridico",
    },
]

_BASE_SYSTEM_PROMPT = dedent(
    """
    Eres un especialista en compliance fiscal y materialidad documental en Mexico.
    Tu trabajo es proponer un checklist operativo para una operacion concreta.

    Reglas obligatorias:
    1. Devuelve JSON estricto con las llaves: nombre, tipo_gasto, items.
    2. items debe ser una lista de 4 a 6 objetos con llaves exactas: pillar, titulo, descripcion, requerido, responsable.
    3. pillar solo puede ser uno de: RAZON_NEGOCIO, ENTREGABLES, CAPACIDAD_PROVEEDOR, FECHA_CIERTA.
    4. No inventes RFC, fechas, montos, nombres de personas ni anexos inexistentes.
    5. Alinea el checklist a la naturaleza economica de la operacion y, si existe, usa el contrato solo como contexto adicional.
    6. El checklist debe ser accionable, verificable y util para defensa documental.
    7. Evita duplicados, generalidades vacias y lenguaje promocional.
    8. Responde solo JSON, sin markdown ni texto adicional.
    """
).strip()


def _extract_json_payload(raw_text: str) -> dict[str, Any]:
    text = (raw_text or "").strip()
    if not text:
        raise ValueError("La respuesta de IA llego vacia")
    try:
        payload = json.loads(text)
        if isinstance(payload, dict):
            return payload
    except json.JSONDecodeError:
        pass

    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise json.JSONDecodeError("No se encontro un objeto JSON valido", text, 0)
    return json.loads(text[start:end + 1])


def _normalize_text(value: Any, *, max_length: int = 255) -> str:
    text = " ".join(str(value or "").strip().split())
    if len(text) > max_length:
        return text[: max_length - 3].rstrip() + "..."
    return text


def _normalize_bool(value: Any, *, default: bool = True) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        lowered = value.strip().lower()
        if lowered in {"true", "1", "si", "sí", "yes"}:
            return True
        if lowered in {"false", "0", "no"}:
            return False
    if value is None:
        return default
    return bool(value)


def _normalize_pillar(value: Any) -> str | None:
    text = _normalize_text(value, max_length=64).upper()
    if not text:
        return None
    if text in _VALID_PILLARS:
        return text
    return _PILLAR_ALIASES.get(text)


def _choice_label(instance: Any, field_name: str) -> str:
    if not instance:
        return ""
    getter = getattr(instance, f"get_{field_name}_display", None)
    if callable(getter):
        return getter() or ""
    return str(getattr(instance, field_name, "") or "")


def _build_context(
    *,
    naturaleza_operacion: str,
    tipo_operacion: str = "",
    tipo_gasto: str = "",
    monto: Decimal | None = None,
    moneda: str = "",
    empresa: Empresa | None = None,
    proveedor: Proveedor | None = None,
    contrato: Contrato | None = None,
    operacion: Operacion | None = None,
) -> dict[str, Any]:
    operacion_context = {}
    if operacion is not None:
        operacion_context = {
            "id": operacion.pk,
            "tipo_operacion": operacion.tipo_operacion,
            "tipo_operacion_label": _choice_label(operacion, "tipo_operacion"),
            "concepto": operacion.concepto,
            "monto": str(operacion.monto),
            "moneda": operacion.moneda,
            "fecha_operacion": operacion.fecha_operacion.isoformat(),
            "metadata": operacion.metadata or {},
        }

    contrato_context = {}
    if contrato is not None:
        contrato_context = {
            "id": contrato.pk,
            "nombre": contrato.nombre,
            "categoria": contrato.categoria,
            "categoria_label": _choice_label(contrato, "categoria"),
            "proceso": contrato.proceso,
            "proceso_label": _choice_label(contrato, "proceso"),
            "tipo_empresa": contrato.tipo_empresa,
            "tipo_empresa_label": _choice_label(contrato, "tipo_empresa"),
            "descripcion": contrato.descripcion,
            "razon_negocio": contrato.razon_negocio,
            "fecha_cierta_requerida": contrato.fecha_cierta_requerida,
            "soporte_documental": contrato.soporte_documental,
            "beneficio_economico_esperado": (
                str(contrato.beneficio_economico_esperado)
                if contrato.beneficio_economico_esperado is not None
                else ""
            ),
        }

    return {
        "naturaleza_operacion": _normalize_text(naturaleza_operacion, max_length=3000),
        "tipo_operacion": tipo_operacion or getattr(operacion, "tipo_operacion", "") or "",
        "tipo_operacion_label": _choice_label(operacion, "tipo_operacion") if operacion else "",
        "tipo_gasto": tipo_gasto or "",
        "monto": str(monto if monto is not None else getattr(operacion, "monto", "") or ""),
        "moneda": moneda or getattr(operacion, "moneda", "") or "",
        "empresa": {
            "id": getattr(empresa, "pk", None),
            "razon_social": getattr(empresa, "razon_social", ""),
            "rfc": getattr(empresa, "rfc", ""),
            "actividad_economica": getattr(empresa, "actividad_economica", ""),
            "regimen_fiscal": getattr(empresa, "regimen_fiscal", ""),
        }
        if empresa is not None
        else {},
        "proveedor": {
            "id": getattr(proveedor, "pk", None),
            "razon_social": getattr(proveedor, "razon_social", ""),
            "rfc": getattr(proveedor, "rfc", ""),
            "actividad_principal": getattr(proveedor, "actividad_principal", ""),
            "estatus_69b": getattr(proveedor, "estatus_69b", ""),
            "riesgo_fiscal": getattr(proveedor, "riesgo_fiscal", ""),
        }
        if proveedor is not None
        else {},
        "contrato": contrato_context,
        "operacion": operacion_context,
    }


def _template_by_name(name: str) -> dict[str, Any] | None:
    for template in DEFAULT_CHECKLIST_TEMPLATES:
        if template["nombre"] == name:
            return template
    return None


def _select_fallback_template(context: dict[str, Any]) -> dict[str, Any] | None:
    contrato = context.get("contrato") or {}
    proveedor = context.get("proveedor") or {}
    tipo_operacion = context.get("tipo_operacion") or ""

    if contrato.get("categoria") == Contrato.Categoria.PARTES_RELACIONADAS:
        return _template_by_name("Base · Intercompany")
    if proveedor.get("estatus_69b") in {Proveedor.Estatus69B.PRESUNTO, Proveedor.Estatus69B.DEFINITIVO}:
        return _template_by_name("Base · Contencion proveedor 69-B")

    checklist_name = DEFAULT_CHECKLIST_NAME_BY_OPERATION_TYPE.get(tipo_operacion)
    if checklist_name:
        return _template_by_name(checklist_name)
    return None


def _build_fallback_draft(context: dict[str, Any]) -> dict[str, Any]:
    template = _select_fallback_template(context)
    naturaleza = context.get("naturaleza_operacion") or "Operacion"
    tipo_gasto = context.get("tipo_gasto") or (template["tipo_gasto"] if template else "Operacion personalizada")
    if template:
        items = [
            {
                "pillar": item["pillar"],
                "titulo": item["titulo"],
                "descripcion": item.get("descripcion", ""),
                "requerido": item.get("requerido", True),
                "responsable": item.get("responsable", ""),
            }
            for item in template["items"]
        ]
        nombre = f"Sugerido · {template['nombre'].replace('Base · ', '')}"
    else:
        items = list(_GENERIC_FALLBACK_ITEMS)
        nombre = f"Sugerido · {naturaleza[:70].strip() or 'Checklist operativo'}"

    return {
        "nombre": _normalize_text(nombre),
        "tipo_gasto": _normalize_text(tipo_gasto, max_length=128),
        "items": items,
    }


def _normalize_items(raw_items: Any, *, fallback_items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    normalized: list[dict[str, Any]] = []
    seen: set[tuple[str, str]] = set()

    for raw_item in raw_items or []:
        if not isinstance(raw_item, dict):
            continue
        pillar = _normalize_pillar(raw_item.get("pillar"))
        titulo = _normalize_text(raw_item.get("titulo"))
        if not pillar or not titulo:
            continue
        key = (pillar, titulo.casefold())
        if key in seen:
            continue
        normalized.append(
            {
                "pillar": pillar,
                "titulo": titulo,
                "descripcion": _normalize_text(raw_item.get("descripcion"), max_length=2000),
                "requerido": _normalize_bool(raw_item.get("requerido"), default=True),
                "responsable": _normalize_text(
                    raw_item.get("responsable") or _DEFAULT_RESPONSABLE_BY_PILLAR.get(pillar, ""),
                ),
            }
        )
        seen.add(key)
        if len(normalized) >= 6:
            break

    for fallback_item in fallback_items:
        if len(normalized) >= 4:
            break
        key = (fallback_item["pillar"], fallback_item["titulo"].casefold())
        if key in seen:
            continue
        normalized.append(dict(fallback_item))
        seen.add(key)

    return normalized[:6]


def _normalize_draft_payload(payload: dict[str, Any], *, context: dict[str, Any]) -> dict[str, Any]:
    fallback_draft = _build_fallback_draft(context)
    nombre = _normalize_text(payload.get("nombre")) or fallback_draft["nombre"]
    tipo_gasto = _normalize_text(payload.get("tipo_gasto"), max_length=128) or fallback_draft["tipo_gasto"]
    items = _normalize_items(payload.get("items"), fallback_items=fallback_draft["items"])
    if not items:
        items = fallback_draft["items"]
    return {
        "nombre": nombre,
        "tipo_gasto": tipo_gasto,
        "items": items,
    }


def _build_user_prompt(context: dict[str, Any]) -> str:
    return dedent(
        f"""
        Genera un checklist operativo sugerido para esta operacion.
        Usa el contrato solo como contexto auxiliar; no lo copies ni supongas hechos no presentes.

        Contexto estructurado:
        {json.dumps(context, ensure_ascii=True)}

        Debes producir un checklist que ayude a documentar materialidad, razon de negocio, entregables, capacidad del proveedor y fecha cierta cuando corresponda.
        Si la operacion es de bajo contexto, devuelve un checklist base pero concreto.
        """
    ).strip()


def generate_checklist_draft(
    *,
    tenant=None,
    naturaleza_operacion: str,
    tipo_operacion: str = "",
    tipo_gasto: str = "",
    monto: Decimal | None = None,
    moneda: str = "",
    empresa: Empresa | None = None,
    proveedor: Proveedor | None = None,
    contrato: Contrato | None = None,
    operacion: Operacion | None = None,
) -> dict[str, Any]:
    context = _build_context(
        naturaleza_operacion=naturaleza_operacion,
        tipo_operacion=tipo_operacion,
        tipo_gasto=tipo_gasto,
        monto=monto,
        moneda=moneda,
        empresa=empresa,
        proveedor=proveedor,
        contrato=contrato,
        operacion=operacion,
    )

    try:
        ai_client = get_ai_client(tenant)
        raw_response = ai_client.generate_text(
            [
                ChatMessage(role="system", content=_BASE_SYSTEM_PROMPT),
                ChatMessage(role="user", content=_build_user_prompt(context)),
            ],
            temperature=0.2,
            max_output_tokens=1200,
        )
        parsed = _extract_json_payload(raw_response)
        draft = _normalize_draft_payload(parsed, context=context)
        return {
            "draft": draft,
            "source": "ai",
            "model": ai_client.model_name,
            "warnings": [],
            "context": {
                "operacion_id": getattr(operacion, "pk", None),
                "contrato_id": getattr(contrato, "pk", None),
                "tipo_operacion": context.get("tipo_operacion") or "",
            },
        }
    except (ImproperlyConfigured, OpenAIClientError, ValueError, json.JSONDecodeError, TypeError, KeyError) as exc:
        logger.warning("Checklist draft AI failed, using fallback: %s", exc)
        return {
            "draft": _build_fallback_draft(context),
            "source": "fallback",
            "model": "",
            "warnings": [
                "Se devolvio un borrador base porque la generacion asistida no estuvo disponible.",
            ],
            "context": {
                "operacion_id": getattr(operacion, "pk", None),
                "contrato_id": getattr(contrato, "pk", None),
                "tipo_operacion": context.get("tipo_operacion") or "",
            },
        }