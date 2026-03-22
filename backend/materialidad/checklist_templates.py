from __future__ import annotations

from django.db import transaction

from .models import (
    Checklist,
    ChecklistItem,
    CompliancePillar,
    Operacion,
    OperacionChecklist,
    OperacionChecklistItem,
)


DEFAULT_CHECKLIST_TEMPLATES = [
    {
        "nombre": "Base · Servicios profesionales",
        "tipo_gasto": "Servicios profesionales",
        "items": [
            {
                "pillar": CompliancePillar.RAZON_NEGOCIO,
                "titulo": "Narrativa de razon de negocio aprobada",
                "descripcion": "Explica beneficio economico, objetivo operativo y relacion con la estrategia del contribuyente.",
                "requerido": True,
                "responsable": "Fiscal / Direccion",
            },
            {
                "pillar": CompliancePillar.ENTREGABLES,
                "titulo": "Entregables fechados y trazables",
                "descripcion": "Memo, reporte, minuta o entregable firmado que vincule la prestacion efectiva del servicio.",
                "requerido": True,
                "responsable": "Area solicitante",
            },
            {
                "pillar": CompliancePillar.CAPACIDAD_PROVEEDOR,
                "titulo": "Validacion de capacidad del proveedor",
                "descripcion": "Evidencia de personal, oficina, experiencia, web, curriculum o estructura operativa suficiente.",
                "requerido": True,
                "responsable": "Compliance",
            },
            {
                "pillar": CompliancePillar.FECHA_CIERTA,
                "titulo": "Contrato y anexos con fecha cierta cuando aplique",
                "descripcion": "Ratificacion, fedatario, sello de tiempo o evidencia documental equivalente para piezas criticas.",
                "requerido": False,
                "responsable": "Juridico",
            },
        ],
    },
    {
        "nombre": "Base · Arrendamiento de maquinaria o equipo",
        "tipo_gasto": "Arrendamiento",
        "items": [
            {
                "pillar": CompliancePillar.RAZON_NEGOCIO,
                "titulo": "Justificacion operativa del arrendamiento",
                "descripcion": "Debe explicar por que se arrenda el activo, periodo de uso y necesidad economica del proyecto.",
                "requerido": True,
                "responsable": "Operaciones",
            },
            {
                "pillar": CompliancePillar.ENTREGABLES,
                "titulo": "Acta de entrega y bitacora de uso",
                "descripcion": "Documenta entrega fisica, ubicacion, horas de uso, operador y devolucion del equipo arrendado.",
                "requerido": True,
                "responsable": "Operaciones / Almacen",
            },
            {
                "pillar": CompliancePillar.CAPACIDAD_PROVEEDOR,
                "titulo": "Evidencia de tenencia y capacidad del proveedor",
                "descripcion": "Fotos, inventario, placas, serie, patio, operadores o documentos que acrediten disponibilidad real del bien.",
                "requerido": True,
                "responsable": "Compras / Compliance",
            },
            {
                "pillar": CompliancePillar.FECHA_CIERTA,
                "titulo": "Contrato marco y anexo tecnico firmado",
                "descripcion": "Resguarda el contrato y sus anexos tecnicos para reforzar defendibilidad documental.",
                "requerido": False,
                "responsable": "Juridico",
            },
        ],
    },
    {
        "nombre": "Base · Compras e inventario",
        "tipo_gasto": "Compras",
        "items": [
            {
                "pillar": CompliancePillar.RAZON_NEGOCIO,
                "titulo": "Solicitud y autorizacion de compra",
                "descripcion": "Debe vincular la compra con consumo, proyecto, inventario o necesidad operativa real.",
                "requerido": True,
                "responsable": "Compras",
            },
            {
                "pillar": CompliancePillar.ENTREGABLES,
                "titulo": "Recepcion material y entrada a inventario",
                "descripcion": "Acta, orden de compra, evidencia fotografica, entrada a almacen o registro de inventario.",
                "requerido": True,
                "responsable": "Almacen",
            },
            {
                "pillar": CompliancePillar.CAPACIDAD_PROVEEDOR,
                "titulo": "Perfil comercial del proveedor validado",
                "descripcion": "Valida actividad, domicilio, capacidad de suministro, historial y consistencia de facturacion.",
                "requerido": True,
                "responsable": "Compliance",
            },
            {
                "pillar": CompliancePillar.FECHA_CIERTA,
                "titulo": "Pedido, contrato o confirmacion formal de compra",
                "descripcion": "Formaliza documentalmente la compra cuando el monto o criticidad del caso lo requiera.",
                "requerido": False,
                "responsable": "Juridico / Compras",
            },
        ],
    },
    {
        "nombre": "Base · Intercompany",
        "tipo_gasto": "Intercompany",
        "items": [
            {
                "pillar": CompliancePillar.RAZON_NEGOCIO,
                "titulo": "Memo ejecutivo de beneficio economico",
                "descripcion": "Describe el beneficio recibido, el racional de centralizacion y la logica intragrupo.",
                "requerido": True,
                "responsable": "Fiscal corporativo",
            },
            {
                "pillar": CompliancePillar.ENTREGABLES,
                "titulo": "Evidencia periodica de servicios recibidos",
                "descripcion": "Reportes, allocators, SLAs, evidencias de uso o soporte recurrente entre partes relacionadas.",
                "requerido": True,
                "responsable": "Area receptora",
            },
            {
                "pillar": CompliancePillar.CAPACIDAD_PROVEEDOR,
                "titulo": "Soporte de funciones y personal del prestador intragrupo",
                "descripcion": "Documenta quienes prestan el servicio, desde donde y con que estructura operan.",
                "requerido": True,
                "responsable": "Corporativo",
            },
            {
                "pillar": CompliancePillar.FECHA_CIERTA,
                "titulo": "Convenio intercompany y anexos formalizados",
                "descripcion": "Resguarda convenio firmado, anexos, vigencia y, cuando aplique, fecha cierta o ratificacion.",
                "requerido": True,
                "responsable": "Juridico corporativo",
            },
        ],
    },
    {
        "nombre": "Base · Contencion proveedor 69-B",
        "tipo_gasto": "Riesgo 69-B",
        "items": [
            {
                "pillar": CompliancePillar.RAZON_NEGOCIO,
                "titulo": "Evaluacion ejecutiva del riesgo y decision de comite",
                "descripcion": "Resume el riesgo identificado, impacto fiscal esperado y criterio de contencion o sustitucion.",
                "requerido": True,
                "responsable": "Fiscal / Direccion",
            },
            {
                "pillar": CompliancePillar.ENTREGABLES,
                "titulo": "Expediente de materializacion reforzada",
                "descripcion": "Reune prueba intensiva de prestacion o entrega real, pagos, correos, bitacoras y aceptaciones.",
                "requerido": True,
                "responsable": "Area solicitante",
            },
            {
                "pillar": CompliancePillar.CAPACIDAD_PROVEEDOR,
                "titulo": "Revision reforzada de proveedor y estatus SAT",
                "descripcion": "Valida opinion, listado, domicilio, activos, personal y hallazgos de due diligence reforzada.",
                "requerido": True,
                "responsable": "Compliance",
            },
            {
                "pillar": CompliancePillar.FECHA_CIERTA,
                "titulo": "Contrato y soporte critico bajo resguardo reforzado",
                "descripcion": "Concentra contrato, anexos, acuses y cualquier evidencia temporal critica para defensa o reversa.",
                "requerido": False,
                "responsable": "Juridico",
            },
        ],
    },
]


DEFAULT_CHECKLIST_NAME_BY_OPERATION_TYPE = {
    Operacion.TipoOperacion.SERVICIO: "Base · Servicios profesionales",
    Operacion.TipoOperacion.COMPRA: "Base · Compras e inventario",
    Operacion.TipoOperacion.ARRENDAMIENTO: "Base · Arrendamiento de maquinaria o equipo",
}


def _get_default_checklists_for_operation(*, checklist_name: str, tenant_slug: str) -> list[Checklist]:
    preferred_slug = tenant_slug or ""

    def fetch(slug: str) -> list[Checklist]:
        return list(
            Checklist.objects.filter(
                tenant_slug=slug,
                vigente=True,
                nombre=checklist_name,
            ).prefetch_related("items")
        )

    checklists = fetch(preferred_slug)
    if not checklists:
        seed_default_checklists_for_tenant(tenant_slug=preferred_slug)
        checklists = fetch(preferred_slug)

    if checklists:
        return checklists

    if tenant_slug:
        return fetch("")

    return []


@transaction.atomic
def seed_default_checklists_for_tenant(*, tenant_slug: str) -> int:
    created_or_updated = 0

    for template in DEFAULT_CHECKLIST_TEMPLATES:
        checklist, _ = Checklist.objects.update_or_create(
            tenant_slug=tenant_slug,
            nombre=template["nombre"],
            defaults={
                "tipo_gasto": template["tipo_gasto"],
                "vigente": True,
            },
        )
        checklist.items.all().delete()
        ChecklistItem.objects.bulk_create([
            ChecklistItem(
                checklist=checklist,
                pillar=item["pillar"],
                titulo=item["titulo"],
                descripcion=item.get("descripcion", ""),
                requerido=item.get("requerido", True),
                estado=ChecklistItem.Estado.PENDIENTE,
                responsable=item.get("responsable", ""),
            )
            for item in template["items"]
        ])
        created_or_updated += 1

    return created_or_updated


def refresh_operacion_checklist_progress(operacion_checklist: OperacionChecklist) -> OperacionChecklist:
    items = list(operacion_checklist.items.all())
    total = len(items)
    completos = sum(1 for item in items if item.estado == ChecklistItem.Estado.COMPLETO)
    en_proceso = sum(1 for item in items if item.estado == ChecklistItem.Estado.EN_PROCESO)

    progreso = int((completos / total) * 100) if total else 0
    if total and completos == total:
        estado_general = ChecklistItem.Estado.COMPLETO
    elif en_proceso or completos:
        estado_general = ChecklistItem.Estado.EN_PROCESO
    else:
        estado_general = ChecklistItem.Estado.PENDIENTE

    changed_fields: list[str] = []
    if operacion_checklist.progreso_porcentaje != progreso:
        operacion_checklist.progreso_porcentaje = progreso
        changed_fields.append("progreso_porcentaje")
    if operacion_checklist.estado_general != estado_general:
        operacion_checklist.estado_general = estado_general
        changed_fields.append("estado_general")
    if changed_fields:
        operacion_checklist.save(update_fields=[*changed_fields, "updated_at"])
    return operacion_checklist


@transaction.atomic
def assign_default_checklists_to_operacion(*, operacion: Operacion, tenant_slug: str = "") -> list[OperacionChecklist]:
    checklist_name = DEFAULT_CHECKLIST_NAME_BY_OPERATION_TYPE.get(operacion.tipo_operacion)
    if not checklist_name:
        return []

    checklists = _get_default_checklists_for_operation(
        checklist_name=checklist_name,
        tenant_slug=tenant_slug,
    )

    assigned: list[OperacionChecklist] = []
    for checklist in checklists:
        operacion_checklist, _ = OperacionChecklist.objects.update_or_create(
            operacion=operacion,
            checklist=checklist,
            defaults={
                "nombre": checklist.nombre,
                "tipo_gasto": checklist.tipo_gasto,
                "origen": OperacionChecklist.Origen.AUTO,
            },
        )
        if not operacion_checklist.items.exists():
            OperacionChecklistItem.objects.bulk_create([
                OperacionChecklistItem(
                    operacion_checklist=operacion_checklist,
                    checklist_item=item,
                    pillar=item.pillar,
                    titulo=item.titulo,
                    descripcion=item.descripcion,
                    requerido=item.requerido,
                    responsable=item.responsable,
                    estado=ChecklistItem.Estado.PENDIENTE,
                )
                for item in checklist.items.all()
            ])
        refresh_operacion_checklist_progress(operacion_checklist)
        assigned.append(operacion_checklist)

    return assigned