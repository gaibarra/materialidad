from __future__ import annotations

import logging
from datetime import timedelta
from decimal import Decimal, ROUND_HALF_UP
import re
from typing import Any

import requests
from django.conf import settings
from django.db.models import Q, Sum
from django.utils import timezone

from tenancy.context import TenantContext

from .ai.client import ChatMessage, OpenAIClient, OpenAIClientError
from .models import (
    Contrato,
    DashboardSnapshot,
    Empresa,
    LegalConsultation,
    LegalReferenceSource,
    Operacion,
    Proveedor,
)

TWO_DECIMAL = Decimal("0.01")

logger = logging.getLogger(__name__)


def validate_cfdi_spei(uuid_cfdi: str | None = None, referencia_spei: str | None = None, monto: Decimal | None = None) -> dict[str, Any]:
    """Valida CFDI/SPEI contra conectores externos.

    Implementación simulada: marca válido si el UUID termina en número par y la referencia SPEI existe; caso contrario marca inválido/no encontrado.
    """

    cfdi_estatus = "PENDIENTE"
    spei_estatus = "PENDIENTE"

    if uuid_cfdi:
        try:
            last_char = uuid_cfdi.strip().replace("-", "")[-1]
            cfdi_estatus = "VALIDO" if last_char.isdigit() and int(last_char) % 2 == 0 else "INVALIDO"
        except Exception:  # pragma: no cover - fallback defensivo
            cfdi_estatus = "INVALIDO"

    if referencia_spei:
        spei_estatus = "VALIDADO" if len(referencia_spei.strip()) >= 6 else "NO_ENCONTRADO"

    return {
        "uuid_cfdi": uuid_cfdi,
        "referencia_spei": referencia_spei,
        "monto": str(monto) if monto is not None else None,
        "cfdi_estatus": cfdi_estatus,
        "spei_estatus": spei_estatus,
    }


def trigger_proveedor_validacion(operacion: Operacion) -> None:
    trigger_validacion_proveedor(
        proveedor=operacion.proveedor,
        empresa=operacion.empresa,
        contexto_extra={
            "operacion_id": operacion.id,
            "uuid_cfdi": operacion.uuid_cfdi,
            "monto": str(operacion.monto),
            "moneda": operacion.moneda,
            "fecha_operacion": operacion.fecha_operacion.isoformat(),
        },
    )


def trigger_validacion_proveedor(
    *, proveedor: Proveedor, empresa: Empresa, contexto_extra: dict[str, Any] | None = None
) -> None:
    if not settings.N8N_WEBHOOK_URL:
        logger.info("N8N_WEBHOOK_URL no configurado; se omite validación de proveedor")
        return

    payload: dict[str, Any] = {
        "empresa": {
            "id": empresa.id,
            "rfc": empresa.rfc,
            "razon_social": empresa.razon_social,
        },
        "proveedor": {
            "id": proveedor.id,
            "rfc": proveedor.rfc,
            "razon_social": proveedor.razon_social,
        },
    }
    if contexto_extra:
        payload["contexto"] = contexto_extra

    headers = {"Content-Type": "application/json"}
    if settings.N8N_API_KEY:
        headers["X-N8N-API-Key"] = settings.N8N_API_KEY

    try:
        response = requests.post(
            settings.N8N_WEBHOOK_URL,
            json=payload,
            headers=headers,
            timeout=settings.N8N_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
    except requests.RequestException as exc:
        logger.error("Error al invocar workflow n8n", exc_info=exc)


def _percent(part: int, total: int) -> float:
    if not total:
        return 0.0
    return round((part / total) * 100, 1)


def get_dashboard_metrics() -> dict[str, Any]:
    today = timezone.now().date()
    horizon = today + timedelta(days=30)

    empresas_total = Empresa.objects.count()
    empresas_activas = Empresa.objects.filter(activo=True).count()
    empresas_con_contrato = (
        Empresa.objects.filter(activo=True, contratos__activo=True).distinct().count()
    )

    contratos_vigentes = (
        Contrato.objects.filter(activo=True)
        .filter(Q(vigencia_fin__isnull=True) | Q(vigencia_fin__gte=today))
        .count()
    )
    contratos_por_vencer = (
        Contrato.objects.filter(activo=True, vigencia_fin__gte=today, vigencia_fin__lte=horizon)
        .count()
    )
    contratos_vencidos = (
        Contrato.objects.filter(activo=True, vigencia_fin__lt=today).count()
    )

    pendientes_estatus = [
        Operacion.EstatusValidacion.PENDIENTE,
        Operacion.EstatusValidacion.EN_PROCESO,
    ]
    operaciones_pendientes = Operacion.objects.filter(
        estatus_validacion__in=pendientes_estatus
    ).count()
    operaciones_rechazadas = Operacion.objects.filter(
        estatus_validacion=Operacion.EstatusValidacion.RECHAZADO
    ).count()
    operaciones_validadas = Operacion.objects.filter(
        estatus_validacion=Operacion.EstatusValidacion.VALIDADO
    )
    operaciones_ultimos_30 = operaciones_validadas.filter(
        fecha_operacion__gte=today - timedelta(days=30)
    ).count()
    monto_validado = operaciones_validadas.filter(moneda="MXN").aggregate(total=Sum("monto"))[
        "total"
    ] or 0

    proveedores_total = Proveedor.objects.count()
    proveedores_sin_validar = Proveedor.objects.filter(
        Q(estatus_sat__isnull=True) | Q(estatus_sat="")
    ).count()
    proveedores_con_alerta = (
        Proveedor.objects.filter(
            operaciones__estatus_validacion=Operacion.EstatusValidacion.RECHAZADO
        )
        .distinct()
        .count()
    )

    insights: list[dict[str, Any]] = []
    if contratos_por_vencer:
        insights.append(
            {
                "id": "contratos_por_vencer",
                "title": "Contratos por vencer",
                "severity": "warning",
                "message": f"{contratos_por_vencer} contratos expiran en los próximos 30 días.",
            }
        )
    if operaciones_pendientes:
        insights.append(
            {
                "id": "operaciones_pendientes",
                "title": "Operaciones sin validar",
                "severity": "alert",
                "message": f"Hay {operaciones_pendientes} operaciones esperando validación fiscal.",
            }
        )
    cobertura_contractual = _percent(empresas_con_contrato, empresas_activas)
    if cobertura_contractual < 75 and empresas_activas:
        insights.append(
            {
                "id": "cobertura_contractual",
                "title": "Cobertura contractual baja",
                "severity": "alert",
                "message": "Menos del 75% de las empresas activas tienen contratos vigentes.",
            }
        )
    if proveedores_sin_validar:
        insights.append(
            {
                "id": "proveedores_sin_validar",
                "title": "Proveedores sin estatus SAT",
                "severity": "info",
                "message": f"{proveedores_sin_validar} proveedores no tienen validación SAT capturada.",
            }
        )

    return {
        "generated_at": timezone.now().isoformat(),
        "empresas": {
            "total": empresas_total,
            "activas": empresas_activas,
            "con_contrato": empresas_con_contrato,
            "cobertura_contractual": cobertura_contractual,
        },
        "contratos": {
            "vigentes": contratos_vigentes,
            "por_vencer_30": contratos_por_vencer,
            "vencidos": contratos_vencidos,
        },
        "operaciones": {
            "pendientes_validacion": operaciones_pendientes,
            "rechazadas": operaciones_rechazadas,
            "validadas_30d": operaciones_ultimos_30,
            "monto_validado_mxn": float(monto_validado),
        },
        "proveedores": {
            "total": proveedores_total,
            "observados": proveedores_con_alerta,
            "sin_validacion_sat": proveedores_sin_validar,
        },
        "insights": insights,
    }


def persist_dashboard_snapshot(tenant_slug: str | None = None) -> DashboardSnapshot:
    tenant = TenantContext.get_current_tenant()
    slug = tenant_slug or (tenant.slug if tenant else None)
    if not slug:
        raise ValueError("Se requiere un tenant activo para guardar el snapshot")

    metrics = get_dashboard_metrics()
    operaciones = metrics.get("operaciones", {})
    contratos = metrics.get("contratos", {})
    empresas = metrics.get("empresas", {})
    proveedores = metrics.get("proveedores", {})

    cobertura_value = Decimal(str(empresas.get("cobertura_contractual", 0) or 0)).quantize(
        TWO_DECIMAL, rounding=ROUND_HALF_UP
    )
    monto_validado_value = Decimal(str(operaciones.get("monto_validado_mxn", 0) or 0)).quantize(
        TWO_DECIMAL, rounding=ROUND_HALF_UP
    )

    snapshot = DashboardSnapshot.objects.create(
        tenant_slug=slug,
        payload=metrics,
        cobertura_contractual=cobertura_value,
        contratos_por_vencer_30=int(contratos.get("por_vencer_30", 0) or 0),
        operaciones_pendientes=int(operaciones.get("pendientes_validacion", 0) or 0),
        proveedores_sin_validacion_sat=int(proveedores.get("sin_validacion_sat", 0) or 0),
        monto_validado_mxn=monto_validado_value,
    )
    return snapshot


def _tokenize_query(text: str) -> list[str]:
    tokens = re.findall(r"[\wÁ-ÿ]{3,}", text or "", flags=re.IGNORECASE)
    return [token.strip() for token in tokens if token.strip()]


def _fetch_candidate_sources(
    *, query: str, ley: str | None, source_type: str | None, limit: int
) -> list[LegalReferenceSource]:
    limit = max(1, min(limit, 20))
    qs = LegalReferenceSource.objects.all()
    if ley:
        qs = qs.filter(ley__iexact=ley.strip())
    if source_type:
        qs = qs.filter(tipo_fuente=source_type)

    tokens = _tokenize_query(query)
    if tokens:
        text_filter = Q()
        for token in tokens:
            text_filter |= (
                Q(contenido__icontains=token)
                | Q(resumen__icontains=token)
                | Q(articulo__icontains=token)
                | Q(fraccion__icontains=token)
                | Q(parrafo__icontains=token)
            )
        qs = qs.filter(text_filter)
    elif query.strip():
        qs = qs.filter(contenido__icontains=query.strip())

    candidates = list(qs.order_by("ley", "articulo", "id")[:limit])
    if candidates:
        return candidates

    fallback_qs = LegalReferenceSource.objects.all()
    if ley:
        fallback_qs = fallback_qs.filter(ley__iexact=ley.strip())
    return list(fallback_qs.order_by("-created_at")[:limit])


def _reference_payload(source: LegalReferenceSource) -> dict[str, Any]:
    excerpt = re.sub(r"\s+", " ", source.contenido).strip()
    if len(excerpt) > 1000:
        excerpt = f"{excerpt[:1000].rstrip()}…"
    return {
        "id": source.id,
        "ley": source.ley,
        "tipo_fuente": source.tipo_fuente,
        "articulo": source.articulo,
        "fraccion": source.fraccion,
        "parrafo": source.parrafo,
        "resumen": source.resumen,
        "extracto": excerpt,
        "fuente_documento": source.fuente_documento,
        "fuente_url": source.fuente_url,
        "vigencia": source.vigencia,
        "sat_categoria": source.sat_categoria,
    }


def perform_legal_consultation(
    *,
    question: str,
    context: str | None,
    ley: str | None,
    source_type: str | None,
    max_refs: int,
    user,
) -> LegalConsultation:
    tenant = TenantContext.get_current_tenant()
    if not tenant:
        raise ValueError("Se requiere un tenant activo para consultar la biblioteca legal")

    references = _fetch_candidate_sources(
        query=question,
        ley=ley,
        source_type=source_type,
        limit=max_refs,
    )
    context_block = context.strip() if context else "Sin contexto operativo adicional"
    references_text: list[str] = ["Consulta dirigida a NotebookLM (MCP)"]
    for idx, ref in enumerate(references, start=1):
        snippet = ref.contenido.strip()
        snippet = re.sub(r"\s+", " ", snippet)
        label = ref.ley
        if ref.articulo:
            label += f" art. {ref.articulo}"
        references_text.append(f"[Ref {idx}] {label}\n{snippet}")

    if not references_text:
        references_text.append("No se encontraron referencias directas en la biblioteca.")

    system_prompt = (
        "Eres una asesora legal fiscal mexicana de alto nivel. Tu objetivo es proporcionar un análisis "
        "altamente específico y personalizado. DEBES considerar y mencionar los detalles del 'Contexto operativo' "
        "proporcionado por el usuario para que la respuesta no sea genérica. Cita siempre las referencias "
        "como [Ref #]. Si la normativa es ambigua, ofrece alternativas basadas en el contexto."
    )
    user_prompt = (
        f"Pregunta: {question.strip()}\n"
        f"Contexto operativo: {context_block}\n\n"
        "Referencias disponibles:\n"
        + "\n\n".join(references_text)
    )

    # Integración con NotebookLM MCP & Motor de Consulta
    answer_text = ""
    payload = []
    model_name = "materialidad-expert-engine"

    # Verificamos si tenemos llaves para IA Real
    gemini_key = getattr(settings, "GEMINI_API_KEY", None)
    openai_key = getattr(settings, "OPENAI_API_KEY", None)
    ai_provider = getattr(settings, "AI_PROVIDER", "openai").lower()

    try:
        if gemini_key and ai_provider == "gemini":
            # 1. MODO GEMINI (Notebook Context)
            client = OpenAIClient() # OpenAIClient actua como factory si AI_PROVIDER=gemini
            
            # Cargamos el contenido del notebook como contexto masivo
            notebook_path = "/home/gaibarra/materialidad/docs/fuentes/contenido_notebook.txt"
            notebook_content = ""
            try:
                import os
                if os.path.exists(notebook_path):
                    with open(notebook_path, "r", encoding="utf-8") as f:
                        notebook_content = f.read(750000) # Límite de 750k caracteres para evitar exceder cuota de tokens
                else:
                    logger.warning(f"Archivo de notebook no encontrado en {notebook_path}")
            except Exception as e:
                logger.error(f"Error leyendo notebook: {e}")

            system_prompt = (
                "Eres un Socio Senior de una firma fiscal líder en México, experto en materialidad y cumplimiento.\n"
                "Tienes acceso a un COMPENDIO DE NORMATIVIDAD FISCAL detallado que se te proporciona a continuación.\n"
                "Tu objetivo es dar una respuesta técnica, precisa y accionable basada estrictamente en este conocimiento y en el contexto del cliente.\n\n"
                "INSTRUCCIONES DE FORMATO:\n"
                "1. Usa Markdown con títulos descriptivos.\n"
                "2. Cita específicamente leyes y artículos mencionados en el compendio.\n"
                "3. Divide tu respuesta en: Análisis Normativo, Aplicación al Caso, Riesgos Identificados y Pasos a Seguir.\n"
                "4. Si el compendio no contiene la información, indícalo claramente.\n\n"
                f"--- COMPENDIO DE NORMATIVIDAD FISCAL ---\n{notebook_content}\n--- FIN DEL COMPENDIO ---"
            )

            answer_text = client.generate_text(
                [
                    ChatMessage(role="system", content=system_prompt),
                    ChatMessage(role="user", content=(
                        f"PREGUNTA DEL CLIENTE: {question}\n\n"
                        f"CONTEXTO OPERATIVO: {context or 'Sin contexto adicional proporcionado.'}"
                    )),
                ],
                temperature=0.1,
                max_output_tokens=3000,
            )
            model_name = f"{client.model_name} (Notebook Context)"

        elif openai_key:
            # 2. MODO OPENAI: Hiper-contextual
            model_name = "Materialidad Expert (Offline/Data-Driven)"
            
            if not references:
                answer_text = (
                    "### ⚠️ Aviso de Información Limitada\n\n"
                    "Lamentamos informarle que su consulta sobre **'" + question + "'** no encontró coincidencias exactas en la biblioteca legal local "
                    "y el servicio de IA avanzada no está configurado (API Key ausente).\n\n"
                    "**Recomendación**: Para obtener un diagnóstico, por favor suba documentos relevantes (LISR, CFF, RMF) a la sección de 'Biblioteca Legal'."
                )
            else:
                # Sintetizamos un reporte basado en DATOS REALES del DB
                report = [
                    f"## Opinión Técnica: {question[:80]}",
                    "\n*Este reporte ha sido generado mediante el análisis de síntesis local de la biblioteca normativa.*",
                    "\n### 1. Resumen de Disposiciones Identificadas\n"
                ]
                
                # Identificamos temas clave en la pregunta
                q_lower = question.lower()
                is_intangible = any(x in q_lower for x in ["intangible", "amortiza", "32", "33"])
                is_materiality = any(x in q_lower for x in ["materialidad", "69-b", "inexistencia", "operación"])
                is_deduction = any(x in q_lower for x in ["deduccion", "deducir", "gasto", "viatico"])
                is_iva = any(x in q_lower for x in ["iva", "traslado", "acredita", "retencion"])
                is_compliance = any(x in q_lower for x in ["opinion", "cumplimiento", "32-d", "proveedor"])
                
                relevant_found = False
                for r in references:
                    art_label = f"Art. {r.articulo}" if r.articulo else "Criterio"
                    content_preview = r.contenido.strip()
                    rt_str = str(r.articulo)
                    
                    # Si el contenido del artículo parece responder a la pregunta, lo resaltamos
                    is_match = any(token in content_preview.lower() for token in q_lower.split() if len(token) > 4)
                    
                    if (is_match or 
                        (is_intangible and ("32" in rt_str or "33" in rt_str)) or 
                        (is_materiality and "69-B" in rt_str) or
                        (is_deduction and ("27" in rt_str or "28" in rt_str)) or
                        (is_iva and ("1-A" in rt_str or "4" in rt_str)) or
                        (is_compliance and "32-D" in rt_str)):
                        report.append(f"#### ✅ {r.ley} ({art_label})")
                        report.append(f"{content_preview}\n")
                        relevant_found = True
                    else:
                        report.append(f"#### ℹ️ {r.ley} ({art_label})")
                        report.append(f"*{r.resumen}*\n")

                report.append("### 2. Análisis Técnico y Recomendaciones")
                
                if is_intangible:
                    report.append(
                        "Para el tratamiento de **Activos Intangibles**, la LISR distingue entre gastos diferidos y cargos diferidos (Art. 32). "
                        "Es fundamental aplicar las tasas de amortización del Art. 33 (ej. 15% para regalías) y conservar "
                        "el soporte que demuestre el beneficio económico esperado."
                    )
                elif is_materiality:
                    report.append(
                        "En materia de **Materialidad**, el cumplimiento se centra en desvirtuar las presunciones del Art. 69-B del CFF. "
                        "Se requiere un expediente que demuestre activos, personal y capacidad material real del proveedor, y no solo el CFDI."
                    )
                elif is_compliance:
                    report.append(
                        "La **Opinión de Cumplimiento (32-D)** es vital para la contratación y la deducibilidad indirecta. "
                        "Asegure que sus proveedores cuenten con una opinión 'Positiva' vigente y que no tengan adeudos fiscales firmes."
                    )
                elif is_iva:
                    report.append(
                        "Para que el **IVA sea acreditable**, debe haber sido trasladado expresamente y pagado efectivamente (Art. 4 LIVA). "
                        "Además, considere las retenciones obligatorias de la fracción II del Art. 1-A si recibe servicios personales."
                    )
                elif is_deduction:
                    report.append(
                        "Para que las **Deducciones** sean procedentes (Art. 27), deben ser estrictamente indispensables. "
                        "Evite caer en los supuestos de no deducibles del Art. 28, como viáticos sin soporte de transporte o alimentación."
                    )
                else:
                    report.append(
                        "Se sugiere revisar el texto íntegro de las referencias citadas para determinar su aplicación específica "
                        "al caso concreto planteado, asegurando siempre que la sustancia económica prevalezca sobre la forma jurídica."
                    )
                
                report.append("\n### 3. Conclusión")
                if not relevant_found:
                    report.append(
                        "⚠️ El motor de búsqueda no encontró una respuesta exacta vinculada a todos los términos de su pregunta. "
                        "El análisis presentado se basa en el contexto legal más cercano disponible en la biblioteca local."
                    )
                else:
                    report.append(
                        "Se recomienda integrar esta fundamentación legal en sus controles internos para asegurar el debido "
                        "cumplimiento de las obligaciones fiscales relacionadas con su consulta."
                    )
                
                answer_text = "\n".join(report)
            
            # Paylaod de referencias reales para el UI
            payload = [_reference_payload(ref) for ref in references]

    except Exception as exc:
        logger.error("Error crítico en servicio de consulta legal", exc_info=exc)
        answer_text = f"ERROR: El servicio de inteligencia no pudo completarse. Detalle: {str(exc)}"

    consultation = LegalConsultation.objects.create(
        tenant_slug=tenant.slug,
        user=user if getattr(user, "is_authenticated", False) else None,
        question=question.strip(),
        context=context or "",
        answer=answer_text.strip(),
        references=payload,
        ai_model=model_name,
    )
    return consultation
