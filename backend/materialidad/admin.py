from __future__ import annotations

from django.contrib import admin

from .models import (
    ClauseTemplate,
    ComparativoPrecio,
    Contrato,
    ContratoTemplate,
    CotizacionConcepto,
    CotizacionPDF,
    Empresa,
    FDIJobRun,
    Fedatario,
    LegalCorpusUpload,
    LegalReferenceSource,
    Operacion,
    Proveedor,
    TransaccionIntercompania,
)


@admin.register(Empresa)
class EmpresaAdmin(admin.ModelAdmin):
    list_display = ("razon_social", "rfc", "regimen_fiscal", "pais", "estado", "activo")
    search_fields = ("razon_social", "rfc")
    list_filter = ("pais", "estado", "activo")
    readonly_fields = ("created_at", "updated_at")


@admin.register(Proveedor)
class ProveedorAdmin(admin.ModelAdmin):
    list_display = ("razon_social", "rfc", "pais", "estatus_sat", "estatus_69b", "riesgo_fiscal")
    search_fields = ("razon_social", "rfc")
    list_filter = ("pais", "estatus_sat", "estatus_69b", "riesgo_fiscal")
    readonly_fields = ("created_at", "updated_at")


@admin.register(Fedatario)
class FedatarioAdmin(admin.ModelAdmin):
    list_display = ("nombre", "tipo", "numero_notaria", "estado", "ciudad", "telefono", "email", "activo")
    search_fields = ("nombre", "numero_notaria", "estado", "ciudad", "email")
    list_filter = ("tipo", "estado", "activo")
    readonly_fields = ("created_at", "updated_at")


@admin.register(Operacion)
class OperacionAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "empresa",
        "proveedor",
        "contrato",
        "monto",
        "moneda",
        "fecha_operacion",
        "estatus_validacion",
        "cfdi_estatus",
        "spei_estatus",
    )
    search_fields = ("uuid_cfdi", "empresa__razon_social", "proveedor__razon_social")
    list_filter = ("estatus_validacion", "moneda", "cfdi_estatus", "spei_estatus")
    readonly_fields = ("created_at", "updated_at", "ultima_validacion", "ultima_validacion_cfdi", "ultima_validacion_spei")

@admin.register(Contrato)
class ContratoAdmin(admin.ModelAdmin):
    list_display = (
        "nombre",
        "empresa",
        "categoria",
        "proceso",
        "tipo_empresa",
        "vigencia_inicio",
        "vigencia_fin",
        "activo",
    )
    list_filter = ("categoria", "proceso", "tipo_empresa", "activo")
    search_fields = ("nombre", "codigo_interno", "empresa__razon_social", "razon_negocio")
    readonly_fields = ("created_at", "updated_at")


@admin.register(CotizacionPDF)
class CotizacionPDFAdmin(admin.ModelAdmin):
    list_display = ("id", "empresa", "proveedor_nombre", "archivo_nombre", "estatus", "created_at")
    search_fields = ("proveedor_nombre", "archivo_nombre")
    list_filter = ("estatus", "created_at")
    readonly_fields = ("created_at",)


@admin.register(CotizacionConcepto)
class CotizacionConceptoAdmin(admin.ModelAdmin):
    list_display = ("id", "cotizacion", "descripcion", "importe", "moneda", "orden")
    search_fields = ("descripcion",)
    list_filter = ("moneda",)


@admin.register(ComparativoPrecio)
class ComparativoPrecioAdmin(admin.ModelAdmin):
    list_display = ("id", "empresa", "nombre", "created_at", "updated_at")
    search_fields = ("nombre",)
    readonly_fields = ("created_at", "updated_at")


@admin.register(LegalReferenceSource)
class LegalReferenceSourceAdmin(admin.ModelAdmin):
    list_display = ("ley", "ordenamiento", "autoridad_emisora", "tipo_fuente", "articulo", "fraccion", "slug", "updated_at")
    search_fields = ("ley", "articulo", "fraccion", "contenido")
    list_filter = ("tipo_fuente", "sat_categoria", "estatus_vigencia", "autoridad_emisora")
    readonly_fields = ("created_at", "updated_at", "hash_contenido")


@admin.register(LegalCorpusUpload)
class LegalCorpusUploadAdmin(admin.ModelAdmin):
    list_display = ("titulo", "autoridad", "ordenamiento", "estatus", "fragmentos_procesados", "processed_at")
    search_fields = ("titulo", "ordenamiento", "fuente_documento")
    list_filter = ("autoridad", "tipo_fuente", "estatus", "estatus_vigencia", "es_vigente")
    readonly_fields = (
        "slug",
        "uploaded_by",
        "total_fragmentos",
        "fragmentos_procesados",
        "error_detalle",
        "processed_at",
        "created_at",
        "updated_at",
    )


@admin.register(TransaccionIntercompania)
class TransaccionIntercompaniaAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "empresa_origen",
        "empresa_destino",
        "tipo",
        "monto_principal",
        "moneda",
        "saldo_pendiente",
        "estado",
        "fecha_inicio",
        "fecha_vencimiento",
        "requiere_atencion",
    )
    list_filter = ("tipo", "estado", "moneda", "requiere_atencion", "estudio_precios_transferencia")
    search_fields = (
        "empresa_origen__razon_social",
        "empresa_destino__razon_social",
        "concepto",
        "num_operacion_interna",
    )
    readonly_fields = ("created_at", "updated_at")
    fieldsets = (
        (
            "Información General",
            {
                "fields": (
                    "empresa_origen",
                    "empresa_destino",
                    "tipo",
                    "concepto",
                    "descripcion",
                    "num_operacion_interna",
                )
            },
        ),
        (
            "Detalles Financieros",
            {
                "fields": (
                    "monto_principal",
                    "moneda",
                    "tasa_interes",
                    "saldo_pendiente",
                    "estado",
                )
            },
        ),
        (
            "Fechas",
            {
                "fields": (
                    "fecha_inicio",
                    "fecha_vencimiento",
                    "fecha_liquidacion",
                )
            },
        ),
        (
            "Documentación y Cumplimiento",
            {
                "fields": (
                    "contrato",
                    "razon_negocio",
                    "beneficio_grupo",
                )
            },
        ),
        (
            "Transfer Pricing",
            {
                "fields": (
                    "estudio_precios_transferencia",
                    "metodo_valuacion",
                    "archivo_estudio_url",
                )
            },
        ),
        (
            "Alertas",
            {
                "fields": (
                    "requiere_atencion",
                    "notas_alerta",
                )
            },
        ),
        (
            "Metadata",
            {
                "fields": ("metadata", "created_at", "updated_at"),
                "classes": ("collapse",),
            },
        ),
    )


@admin.register(FDIJobRun)
class FDIJobRunAdmin(admin.ModelAdmin):
    list_display = (
        "tenant_slug",
        "command",
        "status",
        "days",
        "refresh_projections",
        "projections_synced",
        "snapshots_created",
        "duration_ms",
        "started_at",
    )
    list_filter = ("command", "status", "refresh_projections")
    search_fields = ("tenant_slug", "error_message")
    readonly_fields = ("created_at",)


@admin.register(ContratoTemplate)
class ContratoTemplateAdmin(admin.ModelAdmin):
    list_display = ("nombre", "clave", "categoria", "proceso", "tipo_empresa", "activo", "orden")
    list_filter = ("categoria", "proceso", "tipo_empresa", "activo")
    search_fields = ("nombre", "clave", "descripcion")
    readonly_fields = ("created_at", "updated_at")
    fieldsets = (
        (
            "Información General",
            {"fields": ("clave", "nombre", "categoria", "proceso", "tipo_empresa", "descripcion", "orden", "activo")},
        ),
        (
            "Configuración",
            {"fields": ("es_marco", "requiere_proveedor", "campos_configurables")},
        ),
        (
            "Contrato Semilla (reutilización de contratos depurados)",
            {
                "fields": ("contrato_base", "documento_base", "markdown_base"),
                "classes": ("collapse",),
                "description": "Permite reutilizar un contrato ya depurado como base para futuras generaciones AI.",
            },
        ),
        (
            "Metadata",
            {"fields": ("metadata", "created_at", "updated_at"), "classes": ("collapse",)},
        ),
    )


@admin.register(ClauseTemplate)
class ClauseTemplateAdmin(admin.ModelAdmin):
    list_display = ("titulo", "slug", "nivel_riesgo", "prioridad", "version", "es_curada", "activo")
    list_filter = ("nivel_riesgo", "es_curada", "activo")
    search_fields = ("titulo", "slug", "texto", "resumen")
    readonly_fields = ("created_at", "updated_at")
    prepopulated_fields = {"slug": ("titulo",)}
    fieldsets = (
        (
            "Contenido",
            {"fields": ("slug", "titulo", "texto", "resumen")},
        ),
        (
            "Clasificación",
            {"fields": ("categorias", "procesos", "nivel_riesgo", "palabras_clave", "prioridad")},
        ),
        (
            "Gestión",
            {"fields": ("version", "es_curada", "contrato_origen", "creado_por", "activo")},
        ),
        (
            "Tips para Redline",
            {"fields": ("tips_redline",), "classes": ("collapse",)},
        ),
        (
            "Metadata",
            {"fields": ("metadata", "created_at", "updated_at"), "classes": ("collapse",)},
        ),
    )
