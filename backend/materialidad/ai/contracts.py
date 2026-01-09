from __future__ import annotations

from textwrap import dedent
from typing import Any, Iterable

from ..models import ContratoTemplate, Empresa
from .client import ChatMessage, OpenAIClient
from .citation_cache import get_or_generate_citations
from .utils import public_model_label


SYSTEM_INSTRUCTIONS = dedent(
    """
    Eres un abogado corporativo enfocado en cumplimiento fiscal mexicano.
    Redacta contratos claros, sin lenguaje ambiguo, siguiendo estas pautas:
    - Usa el idioma solicitado y un tono coherente (formal o neutral).
    - Formatea el documento en Markdown con secciones numeradas.
    - Incluye un "Resumen ejecutivo", lista de "Cláusulas clave" y secciones de firma.
    - Menciona de forma orientativa la legislación aplicable cuando sea relevante.
    - Evalúa la razón de negocios (art. 5-A CFF): el beneficio económico debe superar al fiscal.
    - Señala controles de materialidad: entregables verificables, bitácoras, CFDI y contrato.
    - Sugiere el tratamiento contable NIF (ej. NIF D-1 ingresos, C-6 propiedades, C-8 intangibles) cuando el objeto lo permita.
    - Incluye recordatorio de "Fecha cierta" solo vía fedatario público (no confíes en NOM 151).
    - Evita inventar datos: utiliza únicamente la información proporcionada.
    """
)

FINAL_CONTRACT_SYSTEM_INSTRUCTIONS = dedent(
        """
        Actúas como abogado corporativo senior y debes transformar un borrador en un contrato
        definitivo, exhaustivo y listo para su firma en Word. Observa las siguientes reglas:
        - Título principal en mayúsculas describiendo el tipo de contrato.
        - Crea al menos doce artículos numerados consecutivamente (1., 1.1, 2., etc.),
            cubriendo como mínimo: Partes Contratantes, Objeto, Vigencia, Contraprestación,
            Alcance del Proyecto, Obligaciones del Prestador, Obligaciones del Cliente,
            Confidencialidad, Propiedad Intelectual, Garantías y Soporte, Legislación y Jurisdicción,
            Facturación e Impuestos, Modificaciones, Terminación, Responsabilidad y Limitaciones,
            Protección de Datos, Interpretación y Firmas, además de Anexos.
        - Explica cada artículo con varios párrafos o subincisos numerados, aportando "carnita"
            legal aunque la información original sea breve. Mantén marcadores entre corchetes
            cuando falte un dato real.
        - Lenguaje formal, consistente y libre de instrucciones al modelo.
        - No incluyas secciones de "Próximos pasos" ni comentarios meta; entrega solo el contrato
            final en Markdown, sin bloques de código.
        """
)


def _format_empresa(empresa: Empresa) -> str:
    return dedent(
        f"""
        Razón social: {empresa.razon_social}
        RFC: {empresa.rfc}
        Régimen fiscal: {empresa.regimen_fiscal}
        Domicilio: {empresa.ciudad}, {empresa.estado}, {empresa.pais}
        Fecha de constitución: {empresa.fecha_constitucion:%Y-%m-%d}
        """
    ).strip()


def _format_template(template: ContratoTemplate | None) -> str:
    if not template:
        return "Sin plantilla específica"
    return dedent(
        f"""
        Plantilla: {template.nombre} ({template.clave})
        Categoría: {template.get_categoria_display()}
        Proceso: {template.get_proceso_display()}
        Tipo de empresa: {template.get_tipo_empresa_display()}
        Descripción: {template.descripcion or 'N/D'}
        Requiere proveedor: {"sí" if template.requiere_proveedor else "no"}
        """
    ).strip()


def _format_clauses(clausulas: Iterable[str] | None) -> str:
    if not clausulas:
        return "Sin instrucciones adicionales"
    cleaned = [f"- {clause.strip()}" for clause in clausulas if clause.strip()]
    return "\n".join(cleaned) or "Sin instrucciones adicionales"


def build_contract_prompt(
    *,
    empresa: Empresa,
    template: ContratoTemplate | None,
    razon_negocio: str | None,
    beneficio_economico_esperado: float | None,
    beneficio_fiscal_estimado: float | None,
    fecha_cierta_requerida: bool,
    resumen_necesidades: str,
    clausulas_especiales: Iterable[str] | None,
    idioma: str,
    tono: str,
) -> list[ChatMessage]:
    necesidades = (
        resumen_necesidades.strip() or "El usuario no proporcionó detalles adicionales."
    )

    user_content = dedent(
        f"""
        Idioma objetivo: {idioma}
        Tono deseado: {tono}
        Datos de la empresa:
        {_format_empresa(empresa)}

        Información de la plantilla base:
        {_format_template(template)}

        Objetivo del contrato / necesidades:
        {necesidades}

        Razón de negocio declarada (art. 5-A CFF):
        {razon_negocio or 'No proporcionada'}

        Beneficio económico esperado (no fiscal): {beneficio_economico_esperado or 'N/D'}
        Beneficio fiscal estimado: {beneficio_fiscal_estimado or 'N/D'}
        Requiere fecha cierta notarial: {'sí' if fecha_cierta_requerida else 'no'}

        Si el objeto implica ingresos/gastos activos o intangibles, sugiere el tratamiento contable NIF (ej. NIF D-1 ingresos, C-6 propiedades, C-8 intangibles) y advierte si la sustancia económica difiere de la forma jurídica.

        Cláusulas o requisitos adicionales:
        {_format_clauses(clausulas_especiales)}

        Entrega un contrato completo en Markdown. Cierra con un bloque breve "Controles de cumplimiento"
        que liste: (1) evidencia mínima de materialidad, (2) validación de razón de negocios, (3)
        pasos sugeridos para obtener fecha cierta con fedatario. No agregues comentarios meta.
        """
    ).strip()

    return [
        ChatMessage(role="system", content=SYSTEM_INSTRUCTIONS),
        ChatMessage(role="user", content=user_content),
    ]


def generate_contract_document(
    *,
    empresa: Empresa,
    template: ContratoTemplate | None,
    razon_negocio: str | None,
    beneficio_economico_esperado: float | None,
    beneficio_fiscal_estimado: float | None,
    fecha_cierta_requerida: bool = False,
    resumen_necesidades: str,
    clausulas_especiales: Iterable[str] | None,
    idioma: str = "es",
    tono: str = "formal",
) -> dict[str, Any]:
    messages = build_contract_prompt(
        empresa=empresa,
        template=template,
        razon_negocio=razon_negocio,
        beneficio_economico_esperado=beneficio_economico_esperado,
        beneficio_fiscal_estimado=beneficio_fiscal_estimado,
        fecha_cierta_requerida=fecha_cierta_requerida,
        resumen_necesidades=resumen_necesidades,
        clausulas_especiales=clausulas_especiales,
        idioma=idioma,
        tono=tono,
    )
    temperature = 0.3 if tono == "formal" else 0.4
    client = OpenAIClient()
    document_text = client.generate_text(
        messages,
        temperature=temperature,
        max_output_tokens=2200,
    )
    citations, citation_metadata = get_or_generate_citations(
        document_text=document_text,
        empresa=empresa,
        template=template,
        idioma=idioma,
    )
    return {
        "documento_markdown": document_text,
        "idioma": idioma,
        "tono": tono,
        "modelo": public_model_label(client.model_name),
        "citas_legales": citations,
        "citas_legales_metadata": citation_metadata,
    }


def build_definitive_contract_prompt(*, markdown_borrador: str) -> list[ChatMessage]:
    if not markdown_borrador or not markdown_borrador.strip():
        raise ValueError("El borrador en Markdown no puede estar vacío")

    user_content = dedent(
        f"""
        Recibirás un borrador generado previamente en Markdown. Debes reescribirlo como
        contrato definitivo listo para firma, cumpliendo las reglas indicadas. Si el borrador
        omite información específica, conserva los corchetes existentes o agrega marcadores
        claros (por ejemplo [Indicar RFC]) para que el usuario los complete.

        Estructura esperada (puedes ampliar cuando sea pertinente):
        1. Partes contratantes
        2. Objeto del contrato
        3. Vigencia y plazo
        4. Contraprestación económica y formas de pago
        5. Alcance del proyecto y cambios
        6. Obligaciones del prestador
        7. Obligaciones del cliente
        8. Confidencialidad
        9. Propiedad intelectual
        10. Garantías y soporte
        11. Legislación aplicable y jurisdicción
        12. Facturación e impuestos
        13. Modificaciones
        14. Terminación
        15. Responsabilidad y limitaciones
        16. Protección de datos personales
        17. Interpretación y disposiciones varias
        18. Firmas y anexos

        Borrador previo:
        ```markdown
        {markdown_borrador.strip()}
        ```

        Entrega solamente el contrato final reestructurado en Markdown, sin comentarios
        adicionales.
        """
    ).strip()

    return [
        ChatMessage(role="system", content=FINAL_CONTRACT_SYSTEM_INSTRUCTIONS),
        ChatMessage(role="user", content=user_content),
    ]


def generate_definitive_contract(markdown_borrador: str, *, idioma: str = "es") -> dict[str, Any]:
    messages = build_definitive_contract_prompt(markdown_borrador=markdown_borrador)
    client = OpenAIClient()
    document_text = client.generate_text(
        messages,
        temperature=0.15,
        max_output_tokens=3200,
    )
    citations, citation_metadata = get_or_generate_citations(
        document_text=document_text,
        idioma=idioma,
    )
    return {
        "documento_markdown": document_text,
        "modelo": public_model_label(client.model_name),
        "citas_legales": citations,
        "citas_legales_metadata": citation_metadata,
    }
