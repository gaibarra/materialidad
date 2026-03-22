from __future__ import annotations

import hashlib
import re
from types import SimpleNamespace

from django.utils import timezone
from django.utils.text import slugify
from rest_framework import serializers

from .models import (
    AlertaOperacion,
    AuditMaterialityDossier,
    AuditMaterialityDossierVersion,
    AuditLog,
    AlertaCSD,
    Checklist,
    ChecklistItem,
    CompliancePillar,
    ClauseTemplate,
    ComparativoPrecio,
    ContractDocument,
    Contrato,
    ContratoTemplate,
    CotizacionConcepto,
    CotizacionPDF,
    CuentaBancaria,
    DashboardSnapshot,
    DeliverableRequirement,
    Empresa,
    EvidenciaMaterial,
    EstadoCuenta,
    Fedatario,
    LegalCorpusUpload,
    LegalConsultation,
    LegalReferenceSource,
    MovimientoBancario,
    Operacion,
    OperacionChecklist,
    OperacionChecklistItem,
    OperacionConciliacion,
    OperacionEntregable,
    Proveedor,
    RazonNegocioAprobacion,
)
from .checklist_templates import assign_default_checklists_to_operacion
from .services import (
    _detect_legal_consultation_focus,
    get_operacion_checklists_resumen,
    get_operacion_faltantes_expediente,
    get_operacion_faltantes_materialidad,
    get_legal_consultation_type_label,
    get_operacion_perfil_validacion,
    get_operacion_riesgo_materialidad,
    operacion_forma_pago_documentada,
    trigger_proveedor_validacion,
    trigger_validacion_proveedor,
)

GENERIC_CONCEPT_TERMS = {
    "servicios profesionales",
    "servicios prof.",
    "servicio profesional",
    "servicio",
    "servicios",
    "honorarios",
    "consultoría",
    "consultoria",
    "marketing",
    "asesoría",
    "asesoria",
    "mantenimiento",
    "soporte",
    "varios",
    "gastos",
    "servicios generales",
    "pago",
    "pago de servicios",
    "pago servicios",
    "concepto",
    "na",
    "n/a",
    "no aplica",
}
GENERIC_CONCEPT_MIN_LEN = 25
GENERIC_CONCEPT_BLACKLIST = {"servicio", "servicios", "honorarios", "gasto", "gastos"}
GENERIC_CONCEPT_WHITELIST = {
    "servicio de gestion de campañas segmentadas",
    "servicio de gestión de campañas segmentadas",
    "mantenimiento preventivo de equipo x",
    "consultoría fiscal para proyecto y",
    "consultoria fiscal para proyecto y",
}

RFC_PATTERN = re.compile(r"^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$")


def _is_valid_rfc(value: str) -> bool:
    text = (value or "").strip().upper()
    if len(text) not in (12, 13):
        return False
    return bool(RFC_PATTERN.match(text))


class EmpresaSerializer(serializers.ModelSerializer):
    display_name = serializers.SerializerMethodField()
    domicilio_fiscal = serializers.CharField(read_only=True)

    class Meta:
        model = Empresa
        fields = (
            "id",
            "tipo_persona",
            "razon_social",
            "rfc",
            "regimen_fiscal",
            "actividad_economica",
            "fecha_constitucion",
            # PF
            "nombre",
            "apellido_paterno",
            "apellido_materno",
            "curp",
            # Domicilio
            "calle",
            "no_exterior",
            "no_interior",
            "colonia",
            "codigo_postal",
            "municipio",
            "estado",
            "ciudad",
            "pais",
            # Contacto
            "contacto_nombre",
            "contacto_puesto",
            "contacto_email",
            "contacto_telefono",
            # Legacy
            "email_contacto",
            "telefono_contacto",
            # CSF
            "csf_archivo",
            "csf_datos_extraidos",
            "csf_fecha_emision",
            # Computed
            "display_name",
            "domicilio_fiscal",
            "activo",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "csf_datos_extraidos",
            "display_name",
            "domicilio_fiscal",
            "created_at",
            "updated_at",
        )

    def get_display_name(self, obj) -> str:
        return str(obj)

    def validate(self, attrs):
        data = attrs.copy()
        if self.instance is not None:
            for field in ("razon_social", "rfc", "regimen_fiscal"):
                if field not in data:
                    data[field] = getattr(self.instance, field, "")

        razon_social = (data.get("razon_social") or "").strip()
        rfc = (data.get("rfc") or "").strip().upper()
        regimen_fiscal = (data.get("regimen_fiscal") or "").strip()
        tipo_persona = data.get("tipo_persona") or getattr(self.instance, "tipo_persona", "MORAL")

        errors: dict[str, str] = {}
        if not razon_social:
            errors["razon_social"] = "La razón social es obligatoria."
        if not regimen_fiscal:
            errors["regimen_fiscal"] = "El régimen fiscal es obligatorio."
        if not rfc:
            errors["rfc"] = "El RFC es obligatorio."
        elif not _is_valid_rfc(rfc):
            errors["rfc"] = "El RFC no tiene formato válido."

        if tipo_persona == "FISICA":
            nombre = (data.get("nombre") or getattr(self.instance, "nombre", "") or "").strip()
            apellido_paterno = (
                (data.get("apellido_paterno") or getattr(self.instance, "apellido_paterno", "") or "").strip()
            )
            if not nombre:
                errors["nombre"] = "El nombre es obligatorio para persona física."
            if not apellido_paterno:
                errors["apellido_paterno"] = "El apellido paterno es obligatorio para persona física."

        if errors:
            raise serializers.ValidationError(errors)

        attrs["rfc"] = rfc
        return attrs


class FedatarioSerializer(serializers.ModelSerializer):
    display_label = serializers.SerializerMethodField()

    class Meta:
        model = Fedatario
        fields = (
            "id",
            "nombre",
            "tipo",
            "numero_notaria",
            "estado",
            "ciudad",
            "direccion",
            "telefono",
            "telefono_alterno",
            "email",
            "rfc",
            "cedula_profesional",
            "horario_atencion",
            "contacto_asistente",
            "contacto_asistente_tel",
            "contacto_asistente_email",
            "notas",
            "activo",
            "display_label",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("created_at", "updated_at", "display_label")

    def get_display_label(self, obj) -> str:
        return str(obj)


class ProveedorSerializer(serializers.ModelSerializer):
    display_name = serializers.SerializerMethodField()

    class Meta:
        model = Proveedor
        fields = (
            "id",
            "tipo_persona",
            "razon_social",
            "rfc",
            # PF
            "nombre",
            "apellido_paterno",
            "apellido_materno",
            "curp",
            # Domicilio
            "calle",
            "no_exterior",
            "no_interior",
            "colonia",
            "codigo_postal",
            "municipio",
            "pais",
            "estado",
            "ciudad",
            "actividad_principal",
            "regimen_fiscal",
            # Contacto
            "contacto_nombre",
            "contacto_puesto",
            "contacto_email",
            "contacto_telefono",
            # CSF
            "csf_archivo",
            "csf_datos_extraidos",
            "csf_fecha_emision",
            # Validación
            "estatus_sat",
            "estatus_69b",
            "riesgo_fiscal",
            "ultima_validacion_sat",
            "ultima_validacion_69b",
            "detalle_validacion",
            "riesgos_detectados",
            # Legacy contacto
            "correo_contacto",
            "telefono_contacto",
            # Capacidad
            "reps_registro",
            "imss_patronal",
            "activos_relevantes",
            "personal_clave",
            "fotos_domicilio",
            "capacidad_economica_mensual",
            "sitio_web",
            "sitio_web_capturas",
            "notas_capacidad",
            # Computed
            "display_name",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("csf_datos_extraidos", "display_name", "created_at", "updated_at")

    def get_display_name(self, obj) -> str:
        return str(obj)

    def validate(self, attrs):
        data = attrs.copy()
        if self.instance is not None:
            for field in ("razon_social", "rfc", "tipo_persona", "nombre", "apellido_paterno"):
                if field not in data:
                    data[field] = getattr(self.instance, field, "")

        tipo_persona = data.get("tipo_persona") or "MORAL"
        razon_social = (data.get("razon_social") or "").strip()
        nombre = (data.get("nombre") or "").strip()
        apellido_paterno = (data.get("apellido_paterno") or "").strip()
        rfc = (data.get("rfc") or "").strip().upper()
        contacto_email = (data.get("contacto_email") or "").strip()

        errors: dict[str, str] = {}
        if not rfc:
            errors["rfc"] = "El RFC es obligatorio."
        elif not _is_valid_rfc(rfc):
            errors["rfc"] = "El RFC no tiene formato válido."

        if tipo_persona == "FISICA":
            if not nombre:
                errors["nombre"] = "El nombre es obligatorio para persona física."
            if not apellido_paterno:
                errors["apellido_paterno"] = "El apellido paterno es obligatorio para persona física."
        elif not razon_social:
            errors["razon_social"] = "La razón social es obligatoria para persona moral."

        if contacto_email and not re.match(r"^[^\s@]+@[^\s@]+\.[^\s@]+$", contacto_email):
            errors["contacto_email"] = "El correo de contacto no tiene un formato válido."

        if errors:
            raise serializers.ValidationError(errors)

        attrs["rfc"] = rfc
        return attrs


class ContratoSerializer(serializers.ModelSerializer):
    empresa_nombre = serializers.CharField(source="empresa.razon_social", read_only=True)
    proveedor_nombre = serializers.SerializerMethodField()
    template = serializers.PrimaryKeyRelatedField(
        queryset=ContratoTemplate.objects.filter(activo=True), required=False, allow_null=True
    )
    template_clave = serializers.CharField(source="template.clave", read_only=True)
    template_nombre = serializers.CharField(source="template.nombre", read_only=True)
    campos_configurables = serializers.SerializerMethodField()
    requiere_proveedor = serializers.SerializerMethodField()
    campos_faltantes = serializers.SerializerMethodField()
    estado_configuracion = serializers.SerializerMethodField()

    class Meta:
        model = Contrato
        fields = (
            "id",
            "empresa",
            "empresa_nombre",
            "proveedor",
            "proveedor_nombre",
             "template",
             "template_clave",
             "template_nombre",
            "nombre",
            "codigo_interno",
            "categoria",
            "proceso",
            "tipo_empresa",
            "fecha_firma",
            "vigencia_inicio",
            "vigencia_fin",
            "descripcion",
            "es_marco",
            "soporte_documental",
            "expediente_externo",
            "razon_negocio",
            "beneficio_economico_esperado",
            "beneficio_fiscal_estimado",
            "fecha_cierta_requerida",
            "fecha_cierta_obtenida",
            "fecha_ratificacion",
            "fedatario",
            "fedatario_nombre",
            "numero_instrumento",
            "archivo_notariado",
            "archivo_notariado_url",
            "sello_tiempo_aplicado",
            "sello_tiempo_proveedor",
            "sello_tiempo_acuse_url",
            "registro_publico_folio",
            "registro_publico_url",
            "razon_negocio_estado",
            "razon_negocio_ultimo_rol",
            "razon_negocio_aprobado_en",
            "firma_modalidad",
            "logistica_estado",
            "fecha_cita_firma",
            "lugar_cita",
            "responsable_logistica",
            "contacto_responsable",
            "notas_logistica",
            "activo",
            "metadata",
            "campos_configurables",
            "requiere_proveedor",
            "campos_faltantes",
            "estado_configuracion",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("created_at", "updated_at")

    def get_proveedor_nombre(self, obj: Contrato) -> str | None:
        if obj.proveedor:
            return obj.proveedor.razon_social
        return None

    def get_campos_configurables(self, obj: Contrato) -> list[str]:
        if obj.template:
            return obj.template.campos_configurables or []
        return obj.metadata.get("campos_configurables", []) if obj.metadata else []

    def get_requiere_proveedor(self, obj: Contrato) -> bool:
        if obj.template:
            return obj.template.requiere_proveedor
        return bool(obj.metadata.get("requiere_proveedor")) if obj.metadata else False

    def get_campos_faltantes(self, obj: Contrato) -> list[str]:
        faltantes: list[str] = []
        for field in self.get_campos_configurables(obj):
            if field == "proveedor" and not obj.proveedor_id:
                faltantes.append(field)
                continue
            value = getattr(obj, field, None)
            if value in (None, ""):
                faltantes.append(field)
        return faltantes

    def get_estado_configuracion(self, obj: Contrato) -> str:
        return "COMPLETO" if not self.get_campos_faltantes(obj) else "PENDIENTE"

    def _apply_template_defaults(self, template: ContratoTemplate, validated_data: dict) -> dict:
        validated_data.setdefault("nombre", template.nombre)
        validated_data.setdefault("categoria", template.categoria)
        validated_data.setdefault("proceso", template.proceso)
        validated_data.setdefault("tipo_empresa", template.tipo_empresa)
        validated_data.setdefault("descripcion", template.descripcion)
        validated_data.setdefault("es_marco", template.es_marco)
        metadata = dict(validated_data.get("metadata") or {})
        metadata.setdefault("campos_configurables", template.campos_configurables)
        metadata.setdefault("requiere_proveedor", template.requiere_proveedor)
        validated_data["metadata"] = metadata
        return validated_data

    def create(self, validated_data):
        template = validated_data.get("template")
        if template:
            validated_data = self._apply_template_defaults(template, validated_data)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        template = validated_data.get("template")
        if template:
            validated_data = self._apply_template_defaults(template, validated_data)
        return super().update(instance, validated_data)


class ContratoFirmaLogisticaSerializer(serializers.Serializer):
    firma_modalidad = serializers.ChoiceField(choices=Contrato.ModalidadFirma.choices, required=False)
    logistica_estado = serializers.ChoiceField(choices=Contrato.EstadoLogistica.choices, required=False)
    fecha_cita_firma = serializers.DateTimeField(required=False, allow_null=True)
    lugar_cita = serializers.CharField(max_length=255, required=False, allow_blank=True)
    responsable_logistica = serializers.CharField(max_length=255, required=False, allow_blank=True)
    contacto_responsable = serializers.CharField(max_length=128, required=False, allow_blank=True)
    fecha_cierta_requerida = serializers.BooleanField(required=False)
    fecha_cierta_obtenida = serializers.BooleanField(required=False)
    fecha_ratificacion = serializers.DateField(required=False, allow_null=True)
    fedatario = serializers.PrimaryKeyRelatedField(
        queryset=Fedatario.objects.all(), required=False, allow_null=True
    )
    fedatario_nombre = serializers.CharField(max_length=255, required=False, allow_blank=True)
    numero_instrumento = serializers.CharField(max_length=50, required=False, allow_blank=True)
    archivo_notariado_url = serializers.URLField(required=False, allow_blank=True)
    sello_tiempo_aplicado = serializers.DateTimeField(required=False, allow_null=True)
    sello_tiempo_proveedor = serializers.CharField(max_length=128, required=False, allow_blank=True)
    sello_tiempo_acuse_url = serializers.URLField(required=False, allow_blank=True)
    registro_publico_folio = serializers.CharField(max_length=128, required=False, allow_blank=True)
    registro_publico_url = serializers.URLField(required=False, allow_blank=True)
    notas_logistica = serializers.CharField(required=False, allow_blank=True, max_length=2000)

    def validate(self, attrs):
        attrs = super().validate(attrs)
        if attrs.get("fecha_cierta_obtenida"):
            if not attrs.get("fedatario_nombre"):
                raise serializers.ValidationError({"fedatario_nombre": "Indica el fedatario que dio fecha cierta"})
            if not attrs.get("numero_instrumento"):
                raise serializers.ValidationError({"numero_instrumento": "Captura el número de instrumento"})
            if not (attrs.get("sello_tiempo_acuse_url") or attrs.get("archivo_notariado_url")):
                raise serializers.ValidationError({"sello_tiempo_acuse_url": "Agrega el acuse/URL de sello o testimonio notariado"})
        if attrs.get("sello_tiempo_acuse_url") and not attrs.get("sello_tiempo_aplicado"):
            attrs["sello_tiempo_aplicado"] = timezone.now()
        return attrs


class RazonNegocioAprobacionSerializer(serializers.ModelSerializer):
    ORDEN_ROLES = [
        RazonNegocioAprobacion.Rol.SOLICITANTE,
        RazonNegocioAprobacion.Rol.AREA,
        RazonNegocioAprobacion.Rol.COMPLIANCE,
        RazonNegocioAprobacion.Rol.FISCAL,
        RazonNegocioAprobacion.Rol.DIRECTOR,
    ]

    class Meta:
        model = RazonNegocioAprobacion
        fields = (
            "id",
            "contrato",
            "rol",
            "estado",
            "comentario",
            "evidencia_url",
            "firmado_por",
            "firmado_email",
            "decidido_en",
            "metadata",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("created_at", "updated_at")


class AuditLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = AuditLog
        fields = (
            "id",
            "actor_id",
            "actor_email",
            "actor_name",
            "action",
            "object_type",
            "object_id",
            "object_repr",
            "changes",
            "source_ip",
            "created_at",
        )
        read_only_fields = fields

    def validate(self, attrs):
        attrs = super().validate(attrs)
        estado = attrs.get("estado") or getattr(self.instance, "estado", RazonNegocioAprobacion.Estado.PENDIENTE)
        if estado != RazonNegocioAprobacion.Estado.PENDIENTE:
            if not attrs.get("firmado_por"):
                raise serializers.ValidationError({"firmado_por": "Indica quién aprueba/rechaza"})
            if not attrs.get("firmado_email"):
                raise serializers.ValidationError({"firmado_email": "Captura el correo del aprobador"})
            if not attrs.get("decidido_en"):
                attrs["decidido_en"] = timezone.now()

        contrato = attrs.get("contrato") or getattr(self.instance, "contrato", None)
        rol = attrs.get("rol") or getattr(self.instance, "rol", None)
        if contrato and rol:
            aprobaciones_qs = contrato.aprobaciones_razon.all()
            if self.instance:
                aprobaciones_qs = aprobaciones_qs.exclude(pk=self.instance.pk)
            aprobaciones = list(aprobaciones_qs.order_by("created_at"))

            if any(a.estado == RazonNegocioAprobacion.Estado.RECHAZADO for a in aprobaciones):
                raise serializers.ValidationError("El flujo ya fue rechazado; no se pueden registrar más aprobaciones")

            siguiente_rol = None
            for role in self.ORDEN_ROLES:
                existente = next((a for a in reversed(aprobaciones) if a.rol == role), None)
                if not existente or existente.estado != RazonNegocioAprobacion.Estado.APROBADO:
                    siguiente_rol = role
                    break

            if siguiente_rol is None:
                raise serializers.ValidationError("El flujo ya concluyó con todas las aprobaciones")

            if rol != siguiente_rol:
                raise serializers.ValidationError({"rol": f"Debe registrarse primero el rol {siguiente_rol}"})
        return attrs


class DashboardSnapshotSerializer(serializers.ModelSerializer):
    cobertura_contractual = serializers.SerializerMethodField()
    monto_validado_mxn = serializers.SerializerMethodField()
    insights = serializers.SerializerMethodField()

    class Meta:
        model = DashboardSnapshot
        fields = (
            "captured_at",
            "cobertura_contractual",
            "contratos_por_vencer_30",
            "operaciones_pendientes",
            "proveedores_sin_validacion_sat",
            "monto_validado_mxn",
            "insights",
        )

    def get_cobertura_contractual(self, obj: DashboardSnapshot) -> float:
        return float(obj.cobertura_contractual)

    def get_monto_validado_mxn(self, obj: DashboardSnapshot) -> float:
        return float(obj.monto_validado_mxn)

    def get_insights(self, obj: DashboardSnapshot) -> list[dict[str, str]]:
        payload = obj.payload or {}
        insights = payload.get("insights")
        if isinstance(insights, list):
            return insights
        return []


class AuditMaterialityDossierSerializer(serializers.ModelSerializer):
    empresa_nombre = serializers.CharField(source="empresa.razon_social", read_only=True)

    class Meta:
        model = AuditMaterialityDossier
        fields = (
            "id",
            "empresa",
            "empresa_nombre",
            "ejercicio",
            "payload",
            "last_edited_by_email",
            "last_edited_by_name",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "created_at",
            "updated_at",
            "empresa_nombre",
            "last_edited_by_email",
            "last_edited_by_name",
        )

    def validate_ejercicio(self, value: int) -> int:
        if value < 2000 or value > 9999:
            raise serializers.ValidationError("Captura un ejercicio válido de cuatro dígitos.")
        return value

    def validate_payload(self, value):
        if value is None:
            return {}
        if not isinstance(value, dict):
            raise serializers.ValidationError("El payload del expediente debe ser un objeto JSON.")
        return value


class AuditMaterialityDossierVersionSerializer(serializers.ModelSerializer):
    class Meta:
        model = AuditMaterialityDossierVersion
        fields = (
            "id",
            "dossier",
            "version_number",
            "payload",
            "source",
            "edited_by_email",
            "edited_by_name",
            "created_at",
        )
        read_only_fields = fields


class OperacionSerializer(serializers.ModelSerializer):
    empresa_nombre = serializers.CharField(source="empresa.razon_social", read_only=True)
    proveedor_nombre = serializers.CharField(source="proveedor.razon_social", read_only=True)
    contrato_nombre = serializers.SerializerMethodField()
    contrato_categoria = serializers.SerializerMethodField()
    concepto_generico = serializers.SerializerMethodField()
    concepto_sugerido = serializers.SerializerMethodField()
    riesgo_nivel = serializers.SerializerMethodField()
    riesgo_score = serializers.SerializerMethodField()
    riesgo_motivos = serializers.SerializerMethodField()
    checklists_resumen = serializers.SerializerMethodField()

    class Meta:
        model = Operacion
        fields = (
            "id",
            "empresa",
            "empresa_nombre",
            "proveedor",
            "proveedor_nombre",
            "contrato",
            "contrato_nombre",
            "contrato_categoria",
            "uuid_cfdi",
            "referencia_spei",
            "monto",
            "moneda",
            "fecha_operacion",
            "tipo_operacion",
            "concepto",
            "concepto_generico",
            "concepto_sugerido",
            "riesgo_nivel",
            "riesgo_score",
            "riesgo_motivos",
            "checklists_resumen",
            "estatus_validacion",
            "cfdi_estatus",
            "spei_estatus",
            "detalles_validacion",
            "metadata",
            "n8n_workflow_id",
            "n8n_execution_id",
            "ultima_validacion",
            "ultima_validacion_cfdi",
            "ultima_validacion_spei",
            "creado_por_usuario_id",
            "creado_por_email",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "estatus_validacion",
            "detalles_validacion",
            "metadata",
            "n8n_workflow_id",
            "n8n_execution_id",
            "ultima_validacion",
            "ultima_validacion_cfdi",
            "ultima_validacion_spei",
            "creado_por_usuario_id",
            "creado_por_email",
            "created_at",
            "updated_at",
            "contrato_nombre",
            "contrato_categoria",
            "cfdi_estatus",
            "spei_estatus",
            "concepto_generico",
            "concepto_sugerido",
        )

    def create(self, validated_data):
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            validated_data["creado_por_usuario_id"] = request.user.id
            validated_data["creado_por_email"] = request.user.email
        operacion = super().create(validated_data)
        tenant = getattr(request, "tenant", None) if request else None
        assign_default_checklists_to_operacion(
            operacion=operacion,
            tenant_slug=tenant.slug if tenant else "",
        )
        trigger_proveedor_validacion(operacion)
        return operacion

    def update(self, instance, validated_data):
        operacion = super().update(instance, validated_data)
        return operacion

    def validate(self, attrs):
        attrs = super().validate(attrs)
        contrato = attrs.get("contrato") or getattr(self.instance, "contrato", None)
        empresa = attrs.get("empresa") or getattr(self.instance, "empresa", None)
        if contrato and empresa and contrato.empresa_id != empresa.id:
            raise serializers.ValidationError(
                {"contrato": "El contrato seleccionado pertenece a otra empresa"}
            )
        return attrs

    def get_contrato_nombre(self, obj: Operacion) -> str | None:
        if obj.contrato:
            return obj.contrato.nombre
        return None

    def get_contrato_categoria(self, obj: Operacion) -> str | None:
        if obj.contrato:
            return obj.contrato.categoria
        return None

    @staticmethod
    def _is_concepto_generico(concepto: str) -> bool:
        if not concepto:
            return True
        normalized = concepto.strip().lower()
        if normalized in GENERIC_CONCEPT_WHITELIST:
            return False
        if len(normalized) < GENERIC_CONCEPT_MIN_LEN:
            return True
        tokens = {t.strip(".,;") for t in normalized.split()}
        if GENERIC_CONCEPT_BLACKLIST & tokens:
            return True
        for term in GENERIC_CONCEPT_TERMS:
            if term in normalized:
                return True
        return False

    def get_concepto_generico(self, obj: Operacion) -> bool:
        return self._is_concepto_generico(obj.concepto)

    def get_concepto_sugerido(self, obj: Operacion) -> str | None:
        if not self._is_concepto_generico(obj.concepto):
            return None

        detalles = obj.detalles_validacion or {}
        cfdi_desc = None
        try:
            cfdi_desc = detalles.get("cfdi", {}).get("descripcion_especifica")
        except Exception:
            cfdi_desc = None
        if cfdi_desc:
            return str(cfdi_desc)

        entregables = getattr(obj, "entregables_prefetched", None)
        if entregables is None:
            entregables = list(obj.entregables.all()[:3])
        if not entregables:
            return None

        partes: list[str] = []
        for ent in entregables:
            titulo = getattr(ent, "titulo", "") or ""
            codigo = getattr(ent, "codigo", "") or ""
            tipo_gasto = getattr(ent, "tipo_gasto", "") or ""
            pieza = titulo
            if codigo:
                pieza = f"[{codigo}] {pieza}"
            if tipo_gasto:
                pieza = f"{pieza} · {tipo_gasto}"
            pieza = pieza.strip(" ·")
            if pieza:
                partes.append(pieza)
        return "; ".join(partes) if partes else None

    def get_riesgo_nivel(self, obj: Operacion) -> str:
        metadata = obj.metadata or {}
        riesgo = metadata.get("riesgo_materialidad") or {}
        return str(riesgo.get("nivel", "BAJO"))

    def get_riesgo_score(self, obj: Operacion) -> int:
        metadata = obj.metadata or {}
        riesgo = metadata.get("riesgo_materialidad") or {}
        return int(riesgo.get("score", 0) or 0)

    def get_riesgo_motivos(self, obj: Operacion) -> list[str]:
        metadata = obj.metadata or {}
        riesgo = metadata.get("riesgo_materialidad") or {}
        motivos = riesgo.get("motivos")
        if isinstance(motivos, list):
            return [str(motivo) for motivo in motivos]
        return []

    def get_checklists_resumen(self, obj: Operacion) -> list[dict]:
        return get_operacion_checklists_resumen(obj)


class OperacionCambioEstatusSerializer(serializers.Serializer):
    estatus_validacion = serializers.ChoiceField(choices=Operacion.EstatusValidacion.choices)
    comentario = serializers.CharField(required=False, allow_blank=True, max_length=2000)


class EvidenciaMaterialSerializer(serializers.ModelSerializer):
    empresa = serializers.PrimaryKeyRelatedField(source="operacion.empresa", read_only=True)
    proveedor = serializers.PrimaryKeyRelatedField(source="operacion.proveedor", read_only=True)
    empresa_rfc = serializers.CharField(source="operacion.empresa.rfc", read_only=True)
    proveedor_rfc = serializers.CharField(source="operacion.proveedor.rfc", read_only=True)

    class Meta:
        model = EvidenciaMaterial
        fields = (
            "id",
            "operacion",
            "empresa",
            "proveedor",
            "empresa_rfc",
            "proveedor_rfc",
            "tipo",
            "archivo",
            "descripcion",
            "estatus_revision",
            "validado_en",
            "validado_por_email",
            "metadata",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("created_at", "updated_at")

    def validate(self, attrs):
        attrs = super().validate(attrs)
        estatus = attrs.get("estatus_revision") or getattr(self.instance, "estatus_revision", None)
        validado_por = attrs.get("validado_por_email") or getattr(self.instance, "validado_por_email", "")

        if estatus == EvidenciaMaterial.EstatusRevision.VALIDADA and not validado_por:
            request = self.context.get("request")
            user_email = getattr(getattr(request, "user", None), "email", "") if request else ""
            attrs["validado_por_email"] = user_email or validado_por

        if estatus in (
            EvidenciaMaterial.EstatusRevision.VALIDADA,
            EvidenciaMaterial.EstatusRevision.OBSERVADA,
        ) and not attrs.get("validado_en"):
            attrs["validado_en"] = timezone.now()

        return attrs


class ProveedorValidacionSerializer(serializers.Serializer):
    empresa = serializers.PrimaryKeyRelatedField(queryset=Empresa.objects.all())
    operacion = serializers.PrimaryKeyRelatedField(
        queryset=Operacion.objects.all(), required=False, allow_null=True
    )
    contexto_adicional = serializers.JSONField(required=False)

    def validate(self, attrs):
        operacion = attrs.get("operacion")
        empresa = attrs["empresa"]
        if operacion and operacion.empresa_id != empresa.id:
            raise serializers.ValidationError(
                {"operacion": "La operación pertenece a otra empresa"}
            )
        return attrs

    def trigger_workflow(self, proveedor: Proveedor):
        empresa = self.validated_data["empresa"]
        operacion = self.validated_data.get("operacion")
        contexto = self.validated_data.get("contexto_adicional", {})
        if operacion:
            contexto.update(
                {
                    "operacion_id": operacion.id,
                    "uuid_cfdi": operacion.uuid_cfdi,
                    "monto": str(operacion.monto),
                    "moneda": operacion.moneda,
                    "fecha_operacion": operacion.fecha_operacion.isoformat(),
                }
            )
        trigger_validacion_proveedor(
            proveedor=proveedor,
            empresa=empresa,
            contexto_extra=contexto or None,
        )


class CFDISPEIValidationSerializer(serializers.Serializer):
    operacion = serializers.PrimaryKeyRelatedField(queryset=Operacion.objects.all(), required=False, allow_null=True)
    uuid_cfdi = serializers.CharField(max_length=64, required=False, allow_blank=True)
    referencia_spei = serializers.CharField(max_length=64, required=False, allow_blank=True)
    monto = serializers.DecimalField(max_digits=19, decimal_places=4, required=False)

    def validate(self, attrs):
        operacion = attrs.get("operacion")
        uuid_cfdi = (attrs.get("uuid_cfdi") or "").strip()
        referencia_spei = (attrs.get("referencia_spei") or "").strip()
        if operacion:
            attrs["uuid_cfdi"] = uuid_cfdi or operacion.uuid_cfdi
            attrs["referencia_spei"] = referencia_spei or operacion.referencia_spei
            attrs["monto"] = attrs.get("monto") or operacion.monto
        if not attrs.get("uuid_cfdi") and not attrs.get("referencia_spei"):
            raise serializers.ValidationError("Proporciona al menos uuid_cfdi o referencia_spei")
        return attrs


class PriceComparisonItemSerializer(serializers.Serializer):
    descripcion = serializers.CharField(max_length=255)
    proveedor = serializers.CharField(max_length=255)
    precio = serializers.DecimalField(max_digits=19, decimal_places=4)
    moneda = serializers.ChoiceField(choices=("MXN", "USD", "EUR"), default="MXN")


class PriceComparisonSerializer(serializers.Serializer):
    concepto = serializers.CharField(max_length=255)
    items = PriceComparisonItemSerializer(many=True, allow_empty=False)

    def validate_items(self, value):
        if len(value) < 2:
            raise serializers.ValidationError("Incluye al menos 2 cotizaciones")
        return value


# ═══════════════════════════════════════════════════════════════════════
# Cotizaciones PDF — Comparador de Precios avanzado
# ═══════════════════════════════════════════════════════════════════════

class CotizacionConceptoSerializer(serializers.ModelSerializer):
    class Meta:
        model = CotizacionConcepto
        fields = [
            "id", "descripcion", "cantidad", "precio_unitario",
            "importe", "moneda", "unidad", "orden",
        ]
        read_only_fields = ["id"]


class CotizacionPDFSerializer(serializers.ModelSerializer):
    conceptos = CotizacionConceptoSerializer(many=True, read_only=True)
    conceptos_count = serializers.IntegerField(source="conceptos.count", read_only=True)

    class Meta:
        model = CotizacionPDF
        fields = [
            "id", "empresa", "proveedor_nombre", "archivo", "archivo_nombre",
            "estatus", "error_detalle", "metadata", "created_at",
            "conceptos", "conceptos_count",
        ]
        read_only_fields = [
            "id", "estatus", "error_detalle", "texto_extraido",
            "metadata", "created_at", "conceptos", "conceptos_count",
        ]


class CotizacionPDFUploadSerializer(serializers.Serializer):
    archivo = serializers.FileField()
    proveedor_nombre = serializers.CharField(max_length=255, required=False, default="")


class ComparativoPrecioSerializer(serializers.ModelSerializer):
    cotizaciones_detalle = CotizacionPDFSerializer(source="cotizaciones", many=True, read_only=True)

    class Meta:
        model = ComparativoPrecio
        fields = [
            "id", "empresa", "nombre", "notas", "cotizaciones",
            "cotizaciones_detalle", "resultado_json",
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "resultado_json", "created_at", "updated_at"]


class ProveedorValidacionResultadoSerializer(serializers.Serializer):
    estatus_sat = serializers.CharField(required=False, allow_blank=True)
    estatus_69b = serializers.ChoiceField(choices=Proveedor.Estatus69B.choices, required=False)
    riesgo_fiscal = serializers.ChoiceField(choices=Proveedor.Riesgo.choices, required=False)
    riesgos_detectados = serializers.ListField(
        child=serializers.CharField(max_length=256), required=False
    )
    detalle_validacion = serializers.JSONField(required=False)
    ultima_validacion_sat = serializers.DateTimeField(required=False)
    ultima_validacion_69b = serializers.DateTimeField(required=False)


class CuentaBancariaSerializer(serializers.ModelSerializer):
    class Meta:
        model = CuentaBancaria
        fields = (
            "id",
            "empresa",
            "alias",
            "banco",
            "numero_cuenta",
            "clabe",
            "moneda",
            "titular",
            "es_principal",
            "metadata",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("created_at", "updated_at")


class EstadoCuentaSerializer(serializers.ModelSerializer):
    class Meta:
        model = EstadoCuenta
        fields = (
            "id",
            "cuenta",
            "periodo_inicio",
            "periodo_fin",
            "archivo_url",
            "hash_archivo",
            "saldo_inicial",
            "saldo_final",
            "total_abonos",
            "total_cargos",
            "metadata",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("created_at", "updated_at")


class MovimientoBancarioSerializer(serializers.ModelSerializer):
    class Meta:
        model = MovimientoBancario
        fields = (
            "id",
            "estado_cuenta",
            "cuenta",
            "fecha",
            "monto",
            "tipo",
            "referencia",
            "descripcion",
            "cuenta_contraparte",
            "banco_contraparte",
            "nombre_contraparte",
            "spei_referencia",
            "categoria",
            "es_circular",
            "alerta_capacidad",
            "metadata",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("es_circular", "alerta_capacidad", "created_at", "updated_at")

    def validate(self, attrs):
        attrs = super().validate(attrs)
        cuenta = attrs.get("cuenta") or getattr(self.instance, "cuenta", None)
        estado_cuenta = attrs.get("estado_cuenta") or getattr(self.instance, "estado_cuenta", None)
        if cuenta and estado_cuenta and cuenta.id != estado_cuenta.cuenta_id:
            raise serializers.ValidationError({"cuenta": "La cuenta debe coincidir con el estado de cuenta"})
        return attrs


class OperacionConciliacionSerializer(serializers.ModelSerializer):
    operacion_monto = serializers.DecimalField(max_digits=19, decimal_places=4, source="operacion.monto", read_only=True)
    movimiento_monto = serializers.DecimalField(max_digits=19, decimal_places=4, source="movimiento.monto", read_only=True)

    class Meta:
        model = OperacionConciliacion
        fields = (
            "id",
            "operacion",
            "movimiento",
            "estado",
            "confianza",
            "comentario",
            "operacion_monto",
            "movimiento_monto",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("created_at", "updated_at")

    def validate(self, attrs):
        attrs = super().validate(attrs)
        operacion = attrs.get("operacion") or getattr(self.instance, "operacion", None)
        movimiento = attrs.get("movimiento") or getattr(self.instance, "movimiento", None)
        if not operacion or not movimiento:
            return attrs
        if operacion.empresa_id != movimiento.cuenta.empresa_id:
            raise serializers.ValidationError({"operacion": "La operación pertenece a otra empresa"})
        if operacion.moneda != movimiento.cuenta.moneda:
            raise serializers.ValidationError({"movimiento": "La moneda de la cuenta no coincide con la operación"})
        estado = attrs.get("estado") or getattr(self.instance, "estado", None)
        if estado in (OperacionConciliacion.Estado.MANUAL, OperacionConciliacion.Estado.RECHAZADA):
            if not attrs.get("comentario") and not getattr(self.instance, "comentario", ""):
                raise serializers.ValidationError({"comentario": "Agrega un comentario cuando defines la conciliación manual o la rechazas"})
        return attrs


class ContratoTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContratoTemplate
        fields = (
            "id",
            "clave",
            "nombre",
            "categoria",
            "proceso",
            "tipo_empresa",
            "descripcion",
            "es_marco",
            "requiere_proveedor",
            "campos_configurables",
            "orden",
            "activo",
            "metadata",
        )
        read_only_fields = fields


class ContratoGeneracionSerializer(serializers.Serializer):
    contrato = serializers.PrimaryKeyRelatedField(
        queryset=Contrato.objects.all(),
        required=False,
        allow_null=True,
    )
    empresa = serializers.PrimaryKeyRelatedField(queryset=Empresa.objects.all())
    proveedor = serializers.PrimaryKeyRelatedField(
        queryset=Proveedor.objects.all(),
        required=False,
        allow_null=True,
    )
    template = serializers.PrimaryKeyRelatedField(
        queryset=ContratoTemplate.objects.filter(activo=True),
        required=False,
        allow_null=True,
    )
    razon_negocio = serializers.CharField(
        max_length=2000,
        allow_blank=True,
        required=False,
        help_text="Describe el proposito economico real conforme al art. 5-A CFF",
    )
    beneficio_economico_esperado = serializers.DecimalField(
        max_digits=14, decimal_places=2, required=False, allow_null=True
    )
    beneficio_fiscal_estimado = serializers.DecimalField(
        max_digits=14, decimal_places=2, required=False, allow_null=True
    )
    fecha_cierta_requerida = serializers.BooleanField(required=False, default=False)
    resumen_necesidades = serializers.CharField(
        max_length=2000,
        allow_blank=True,
        default="",
    )
    clausulas_especiales = serializers.ListField(
        child=serializers.CharField(max_length=512),
        required=False,
        allow_empty=True,
    )
    idioma = serializers.ChoiceField(choices=("es", "en"), default="es")
    tono = serializers.ChoiceField(choices=("formal", "neutral"), default="formal")

    def validate_clausulas_especiales(self, value):
        return [item.strip() for item in value if item.strip()]


class ContratoDocxExportSerializer(serializers.Serializer):
    documento_markdown = serializers.CharField()
    nombre_archivo = serializers.CharField(max_length=128, required=False, allow_blank=True)
    idioma = serializers.ChoiceField(choices=("es", "en"), default="es")


class ContractDocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContractDocument
        fields = (
            "id",
            "contrato",
            "kind",
            "source",
            "idioma",
            "tono",
            "modelo",
            "archivo",
            "archivo_nombre",
            "markdown_text",
            "extracted_text",
            "metadata",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("created_at", "updated_at")


class ContractDocumentCreateSerializer(serializers.Serializer):
    kind = serializers.ChoiceField(choices=ContractDocument.Kind.choices, default=ContractDocument.Kind.SUBIDO)
    source = serializers.ChoiceField(choices=ContractDocument.Source.choices, default=ContractDocument.Source.UPLOAD)
    idioma = serializers.ChoiceField(choices=("es", "en"), default="es")
    tono = serializers.ChoiceField(choices=("formal", "neutral"), default="formal")
    modelo = serializers.CharField(max_length=128, required=False, allow_blank=True)
    archivo = serializers.FileField(required=False)
    markdown_text = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        attrs = super().validate(attrs)
        archivo = attrs.get("archivo")
        markdown_text = attrs.get("markdown_text", "")
        if not archivo and not markdown_text.strip():
            raise serializers.ValidationError("Debes enviar un archivo o un texto en Markdown")
        return attrs


class ImportarExternoSerializer(serializers.Serializer):
    """Importa un contrato externo: crea Contrato + sube archivo + corrige con IA."""
    empresa = serializers.PrimaryKeyRelatedField(queryset=Empresa.objects.all())
    template = serializers.PrimaryKeyRelatedField(
        queryset=ContratoTemplate.objects.filter(activo=True),
        required=False,
        allow_null=True,
    )
    proveedor = serializers.PrimaryKeyRelatedField(
        queryset=Proveedor.objects.all(),
        required=False,
        allow_null=True,
    )
    archivo = serializers.FileField()
    idioma = serializers.ChoiceField(choices=("es", "en"), default="es")
    tono = serializers.ChoiceField(choices=("formal", "neutral"), default="formal")


class ClauseSuggestionQuerySerializer(serializers.Serializer):
    categoria = serializers.ChoiceField(
        choices=Contrato.Categoria.choices,
        required=False,
        allow_blank=True,
    )
    proceso = serializers.ChoiceField(
        choices=Contrato.ProcesoNegocio.choices,
        required=False,
        allow_blank=True,
    )
    idioma = serializers.ChoiceField(choices=("es", "en"), required=False, allow_blank=True)
    query = serializers.CharField(required=False, allow_blank=True, max_length=200)
    resumen_necesidades = serializers.CharField(required=False, allow_blank=True, max_length=2000)
    template = serializers.IntegerField(required=False)
    limit = serializers.IntegerField(required=False, min_value=1, max_value=12, default=6)

    def validate_template(self, value):
        if value in (None, ""):
            return None
        try:
            return ContratoTemplate.objects.get(pk=value, activo=True)
        except ContratoTemplate.DoesNotExist as exc:
            raise serializers.ValidationError("La plantilla indicada no existe o esta inactiva") from exc


class ClauseSuggestionSerializer(serializers.Serializer):
    slug = serializers.CharField()
    titulo = serializers.CharField()
    categorias_contrato = serializers.ListField(child=serializers.CharField())
    procesos = serializers.ListField(child=serializers.CharField())
    nivel_riesgo = serializers.CharField()
    resumen = serializers.CharField()
    texto = serializers.CharField()
    tips_redline = serializers.ListField(child=serializers.CharField(), allow_empty=True)
    palabras_clave = serializers.ListField(child=serializers.CharField(), allow_empty=True)
    relevancia = serializers.FloatField()


class RedlineAnalysisSerializer(serializers.Serializer):
    texto_original = serializers.CharField()
    texto_revisado = serializers.CharField()
    idioma = serializers.ChoiceField(choices=("es", "en"), required=False, default="es")


class LegalReferenceSourceSerializer(serializers.ModelSerializer):
    class Meta:
        model = LegalReferenceSource
        fields = (
            "id",
            "slug",
            "ley",
            "ordenamiento",
            "corpus_upload",
            "tipo_fuente",
            "estatus_vigencia",
            "es_vigente",
            "fecha_vigencia_desde",
            "fecha_vigencia_hasta",
            "fecha_ultima_revision",
            "autoridad_emisora",
            "articulo",
            "fraccion",
            "parrafo",
            "contenido",
            "resumen",
            "fuente_documento",
            "fuente_url",
            "vigencia",
            "sat_categoria",
            "hash_contenido",
            "vectorizacion_modelo",
            "vectorizacion_dim",
            "vectorizado_en",
            "metadata",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "slug",
            "hash_contenido",
            "vectorizacion_modelo",
            "vectorizacion_dim",
            "vectorizado_en",
            "created_at",
            "updated_at",
        )

    def validate(self, attrs):
        attrs = super().validate(attrs)
        es_vigente = attrs.get("es_vigente")
        estatus_vigencia = attrs.get("estatus_vigencia")

        if es_vigente is None and estatus_vigencia:
            attrs["es_vigente"] = estatus_vigencia == LegalReferenceSource.VigencyStatus.VIGENTE
        elif es_vigente is not None and not estatus_vigencia:
            attrs["estatus_vigencia"] = (
                LegalReferenceSource.VigencyStatus.VIGENTE
                if es_vigente
                else LegalReferenceSource.VigencyStatus.DESCONOCIDA
            )

        fecha_desde = attrs.get("fecha_vigencia_desde")
        fecha_hasta = attrs.get("fecha_vigencia_hasta")
        if fecha_desde and fecha_hasta and fecha_desde > fecha_hasta:
            raise serializers.ValidationError(
                {"fecha_vigencia_hasta": "Debe ser igual o posterior a fecha_vigencia_desde"}
            )
        return attrs

    def _merge_payload(self, instance, validated_data):
        if not instance:
            return validated_data
        base = {
            "ley": instance.ley,
            "ordenamiento": instance.ordenamiento,
            "corpus_upload": instance.corpus_upload,
            "tipo_fuente": instance.tipo_fuente,
            "estatus_vigencia": instance.estatus_vigencia,
            "es_vigente": instance.es_vigente,
            "fecha_vigencia_desde": instance.fecha_vigencia_desde,
            "fecha_vigencia_hasta": instance.fecha_vigencia_hasta,
            "fecha_ultima_revision": instance.fecha_ultima_revision,
            "autoridad_emisora": instance.autoridad_emisora,
            "articulo": instance.articulo,
            "fraccion": instance.fraccion,
            "parrafo": instance.parrafo,
            "contenido": instance.contenido,
            "resumen": instance.resumen,
            "fuente_documento": instance.fuente_documento,
            "fuente_url": instance.fuente_url,
            "vigencia": instance.vigencia,
            "sat_categoria": instance.sat_categoria,
        }
        base.update(validated_data)
        return base

    def _generate_slug(self, payload, instance=None):
        requested = payload.get("slug") or (instance.slug if instance else "")
        base_parts = [payload.get("ley"), payload.get("articulo"), payload.get("fraccion"), payload.get("parrafo")]
        base = slugify(requested or "-".join(filter(None, base_parts)))
        if not base:
            base = slugify(payload.get("ley") or "fuente-legal")
        if not base:
            base = hashlib.sha256(str(timezone.now().timestamp()).encode("utf-8")).hexdigest()
        base = base[:240]
        slug = base
        suffix = 2
        queryset = LegalReferenceSource.objects.all()
        if instance:
            queryset = queryset.exclude(pk=instance.pk)
        while queryset.filter(slug=slug).exists():
            slug = f"{base}-{suffix}"[:250]
            suffix += 1
        return slug

    def _generate_hash(self, payload):
        join_parts = [
            payload.get("ley") or "",
            payload.get("tipo_fuente") or "",
            payload.get("articulo") or "",
            payload.get("fraccion") or "",
            payload.get("parrafo") or "",
            payload.get("contenido") or "",
        ]
        return hashlib.sha256("|".join(join_parts).encode("utf-8")).hexdigest()

    def create(self, validated_data):
        payload = self._merge_payload(None, validated_data)
        validated_data["slug"] = self._generate_slug(payload)
        validated_data["hash_contenido"] = self._generate_hash(payload)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        payload = self._merge_payload(instance, validated_data)
        # Slug permanece estable a menos que se proporcione manualmente
        validated_data.setdefault("slug", instance.slug)
        if any(
            field in validated_data
            for field in ("ley", "tipo_fuente", "articulo", "fraccion", "parrafo", "contenido")
        ):
            validated_data["hash_contenido"] = self._generate_hash(payload)
        return super().update(instance, validated_data)


class LegalCorpusUploadSerializer(serializers.ModelSerializer):
    procesar_ahora = serializers.BooleanField(write_only=True, required=False, default=True)
    uploaded_by_email = serializers.EmailField(source="uploaded_by.email", read_only=True)

    class Meta:
        model = LegalCorpusUpload
        fields = (
            "id",
            "titulo",
            "slug",
            "archivo",
            "autoridad",
            "ordenamiento",
            "tipo_fuente",
            "estatus",
            "estatus_vigencia",
            "es_vigente",
            "force_vigencia",
            "fecha_vigencia_desde",
            "fecha_vigencia_hasta",
            "fecha_ultima_revision",
            "vigencia",
            "fuente_documento",
            "fuente_url",
            "sat_categoria",
            "total_fragmentos",
            "fragmentos_procesados",
            "error_detalle",
            "uploaded_by",
            "uploaded_by_email",
            "metadata",
            "processed_at",
            "created_at",
            "updated_at",
            "procesar_ahora",
        )
        read_only_fields = (
            "slug",
            "estatus",
            "total_fragmentos",
            "fragmentos_procesados",
            "error_detalle",
            "uploaded_by",
            "uploaded_by_email",
            "metadata",
            "processed_at",
            "created_at",
            "updated_at",
        )

    def validate_archivo(self, value):
        filename = getattr(value, "name", "") or ""
        extension = filename.lower().rsplit(".", 1)[-1] if "." in filename else ""
        if extension not in {"pdf", "txt", "md", "docx"}:
            raise serializers.ValidationError("Solo se permiten archivos PDF, TXT, MD o DOCX")
        return value

    def validate(self, attrs):
        attrs = super().validate(attrs)
        es_vigente = attrs.get("es_vigente")
        estatus_vigencia = attrs.get("estatus_vigencia")
        if es_vigente is None and estatus_vigencia:
            attrs["es_vigente"] = estatus_vigencia == LegalReferenceSource.VigencyStatus.VIGENTE
        elif es_vigente is not None and not estatus_vigencia:
            attrs["estatus_vigencia"] = (
                LegalReferenceSource.VigencyStatus.VIGENTE
                if es_vigente
                else LegalReferenceSource.VigencyStatus.DESCONOCIDA
            )
        fecha_desde = attrs.get("fecha_vigencia_desde")
        fecha_hasta = attrs.get("fecha_vigencia_hasta")
        if fecha_desde and fecha_hasta and fecha_desde > fecha_hasta:
            raise serializers.ValidationError(
                {"fecha_vigencia_hasta": "Debe ser igual o posterior a fecha_vigencia_desde"}
            )
        return attrs

    def create(self, validated_data):
        validated_data.pop("procesar_ahora", None)
        titulo = validated_data.get("titulo") or validated_data.get("ordenamiento") or "corpus-legal"
        base_slug = slugify(titulo)[:240] or slugify(validated_data.get("ordenamiento") or "corpus-legal")
        if not base_slug:
            base_slug = hashlib.sha256(str(timezone.now().timestamp()).encode("utf-8")).hexdigest()[:32]
        slug = base_slug
        suffix = 2
        while LegalCorpusUpload.objects.filter(slug=slug).exists():
            slug = f"{base_slug}-{suffix}"[:255]
            suffix += 1
        validated_data["slug"] = slug
        return super().create(validated_data)


class LegalConsultationRequestSerializer(serializers.Serializer):
    pregunta = serializers.CharField(max_length=2000)
    contexto = serializers.CharField(max_length=2000, allow_blank=True, required=False)
    ley = serializers.CharField(max_length=255, allow_blank=True, required=False)
    tipo_fuente = serializers.ChoiceField(
        choices=LegalReferenceSource.SourceType.choices,
        required=False,
        allow_blank=True,
    )
    autoridad_emisora = serializers.ChoiceField(
        choices=LegalCorpusUpload.Authority.choices,
        required=False,
        allow_blank=True,
    )
    ordenamiento = serializers.CharField(max_length=255, allow_blank=True, required=False)
    solo_vigentes = serializers.BooleanField(required=False, default=True)
    max_referencias = serializers.IntegerField(min_value=1, max_value=6, required=False, default=3)

    def validate_ley(self, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None

    def validate_tipo_fuente(self, value: str | None) -> str | None:
        if not value:
            return None
        cleaned = value.strip()
        return cleaned or None

    def validate_autoridad_emisora(self, value: str | None) -> str | None:
        if not value:
            return None
        return value.strip() or None

    def validate_ordenamiento(self, value: str | None) -> str | None:
        if not value:
            return None
        cleaned = value.strip()
        return cleaned or None


class LegalConsultationSerializer(serializers.ModelSerializer):
    pregunta = serializers.CharField(source="question", read_only=True)
    contexto = serializers.CharField(source="context", read_only=True)
    respuesta = serializers.CharField(source="answer", read_only=True)
    modelo = serializers.CharField(source="ai_model", read_only=True)
    estado = serializers.SerializerMethodField()
    tipo_consulta = serializers.SerializerMethodField()
    referencias = serializers.SerializerMethodField()

    class Meta:
        model = LegalConsultation
        fields = (
            "id",
            "pregunta",
            "contexto",
            "respuesta",
            "modelo",
            "estado",
            "tipo_consulta",
            "referencias",
            "created_at",
        )
        read_only_fields = fields

    def get_estado(self, obj: LegalConsultation) -> str:
        answer = (obj.answer or "").lstrip()
        if answer.upper().startswith("ERROR:"):
            return "error"
        return "ok"

    def get_referencias(self, obj: LegalConsultation) -> list[dict[str, str]]:
        if isinstance(obj.references, list):
            return obj.references
        return []

    def get_tipo_consulta(self, obj: LegalConsultation) -> dict[str, str]:
        references_payload = obj.references if isinstance(obj.references, list) else []
        references = [
            SimpleNamespace(
                ley=ref.get("ley", ""),
                ordenamiento=ref.get("ordenamiento", ""),
                resumen=ref.get("resumen", ""),
                contenido=ref.get("extracto", ""),
                sat_categoria=ref.get("sat_categoria", ""),
            )
            for ref in references_payload
            if isinstance(ref, dict)
        ]
        focus = _detect_legal_consultation_focus(
            question=obj.question,
            context_block=obj.context or "",
            references=references,
        )
        return {"code": focus, "label": get_legal_consultation_type_label(focus)}


class ChecklistItemSerializer(serializers.ModelSerializer):
    def validate(self, attrs):
        attrs = super().validate(attrs)
        # Only validate titulo when present (allows PATCH with only estado)
        if "titulo" in attrs:
            titulo = (attrs["titulo"] or "").strip()
            if not titulo:
                raise serializers.ValidationError({"titulo": "El título es obligatorio"})
            attrs["titulo"] = titulo
        if "descripcion" in attrs:
            attrs["descripcion"] = (attrs["descripcion"] or "").strip()
        if "responsable" in attrs:
            attrs["responsable"] = (attrs["responsable"] or "").strip()
        return attrs

    class Meta:
        model = ChecklistItem
        fields = (
            "id",
            "checklist",
            "pillar",
            "titulo",
            "descripcion",
            "requerido",
            "estado",
            "vence_el",
            "responsable",
            "created_at",
        )
        read_only_fields = ("id", "created_at", "checklist")


class ChecklistSerializer(serializers.ModelSerializer):
    items = ChecklistItemSerializer(many=True, required=False)

    class Meta:
        model = Checklist
        fields = (
            "id",
            "tenant_slug",
            "nombre",
            "tipo_gasto",
            "vigente",
            "created_at",
            "items",
        )
        read_only_fields = ("id", "tenant_slug", "created_at")

    def create(self, validated_data):
        items = validated_data.pop("items", [])
        checklist = Checklist.objects.create(**validated_data)
        for item in items:
            ChecklistItem.objects.create(checklist=checklist, **item)
        return checklist

    def update(self, instance, validated_data):
        items = validated_data.pop("items", None)
        instance = super().update(instance, validated_data)
        if items is not None:
            instance.items.all().delete()
            for item in items:
                ChecklistItem.objects.create(checklist=instance, **item)
        return instance


class ChecklistDraftRequestSerializer(serializers.Serializer):
    naturaleza_operacion = serializers.CharField(max_length=3000)
    tipo_operacion = serializers.ChoiceField(
        choices=Operacion.TipoOperacion.choices,
        required=False,
        allow_blank=False,
    )
    tipo_gasto = serializers.CharField(max_length=128, required=False, allow_blank=True)
    monto = serializers.DecimalField(max_digits=19, decimal_places=4, required=False)
    moneda = serializers.ChoiceField(
        choices=Operacion.Moneda.choices,
        required=False,
        allow_blank=False,
    )
    empresa = serializers.PrimaryKeyRelatedField(queryset=Empresa.objects.all(), required=False)
    proveedor = serializers.PrimaryKeyRelatedField(queryset=Proveedor.objects.all(), required=False)
    contrato = serializers.PrimaryKeyRelatedField(queryset=Contrato.objects.all(), required=False)
    operacion = serializers.PrimaryKeyRelatedField(queryset=Operacion.objects.all(), required=False)

    def validate(self, attrs):
        attrs = super().validate(attrs)
        naturaleza_operacion = (attrs.get("naturaleza_operacion") or "").strip()
        if not naturaleza_operacion:
            raise serializers.ValidationError(
                {"naturaleza_operacion": "La naturaleza de la operación es obligatoria"}
            )
        attrs["naturaleza_operacion"] = naturaleza_operacion

        operacion = attrs.get("operacion")
        contrato = attrs.get("contrato")
        empresa = attrs.get("empresa")
        proveedor = attrs.get("proveedor")

        if operacion is not None:
            attrs.setdefault("contrato", operacion.contrato)
            attrs.setdefault("empresa", operacion.empresa)
            attrs.setdefault("proveedor", operacion.proveedor)
            attrs.setdefault("tipo_operacion", operacion.tipo_operacion)
            attrs.setdefault("monto", operacion.monto)
            attrs.setdefault("moneda", operacion.moneda)
        elif contrato is not None:
            attrs.setdefault("empresa", contrato.empresa)
            if contrato.proveedor_id and proveedor is None:
                attrs["proveedor"] = contrato.proveedor

        contrato = attrs.get("contrato")
        empresa = attrs.get("empresa")
        proveedor = attrs.get("proveedor")
        if contrato is not None and empresa is not None and contrato.empresa_id != empresa.id:
            raise serializers.ValidationError(
                {"contrato": "El contrato seleccionado pertenece a otra empresa"}
            )
        if contrato is not None and proveedor is not None and contrato.proveedor_id and contrato.proveedor_id != proveedor.id:
            raise serializers.ValidationError(
                {"contrato": "El contrato seleccionado pertenece a otro proveedor"}
            )
        return attrs


class ChecklistDraftItemSerializer(serializers.Serializer):
    pillar = serializers.ChoiceField(choices=CompliancePillar.choices)
    titulo = serializers.CharField(max_length=255)
    descripcion = serializers.CharField(allow_blank=True)
    requerido = serializers.BooleanField()
    responsable = serializers.CharField(max_length=255, allow_blank=True)


class ChecklistDraftPayloadSerializer(serializers.Serializer):
    nombre = serializers.CharField(max_length=255)
    tipo_gasto = serializers.CharField(max_length=128, allow_blank=True)
    items = ChecklistDraftItemSerializer(many=True)


class ChecklistDraftResponseSerializer(serializers.Serializer):
    draft = ChecklistDraftPayloadSerializer()
    source = serializers.ChoiceField(choices=(("ai", "ai"), ("fallback", "fallback")))
    model = serializers.CharField(allow_blank=True)
    warnings = serializers.ListField(child=serializers.CharField(), allow_empty=True)
    context = serializers.JSONField(required=False)


class OperacionChecklistItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = OperacionChecklistItem
        fields = (
            "id",
            "operacion_checklist",
            "checklist_item",
            "pillar",
            "titulo",
            "descripcion",
            "requerido",
            "responsable",
            "estado",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "operacion_checklist",
            "checklist_item",
            "pillar",
            "titulo",
            "descripcion",
            "requerido",
            "responsable",
            "created_at",
            "updated_at",
        )


class OperacionChecklistSerializer(serializers.ModelSerializer):
    items = OperacionChecklistItemSerializer(many=True, read_only=True)
    total_items = serializers.SerializerMethodField()
    completos = serializers.SerializerMethodField()
    pendientes = serializers.SerializerMethodField()

    class Meta:
        model = OperacionChecklist
        fields = (
            "id",
            "operacion",
            "checklist",
            "nombre",
            "tipo_gasto",
            "origen",
            "estado_general",
            "progreso_porcentaje",
            "total_items",
            "completos",
            "pendientes",
            "created_at",
            "updated_at",
            "items",
        )
        read_only_fields = fields

    def get_total_items(self, obj: OperacionChecklist) -> int:
        items = getattr(obj, "items", None)
        if items is not None and not hasattr(items, "all"):
            return len(items)
        return obj.items.count()

    def get_completos(self, obj: OperacionChecklist) -> int:
        items = getattr(obj, "items", None)
        if items is not None and not hasattr(items, "all"):
            return sum(1 for item in items if item.estado == ChecklistItem.Estado.COMPLETO)
        return obj.items.filter(estado=ChecklistItem.Estado.COMPLETO).count()

    def get_pendientes(self, obj: OperacionChecklist) -> int:
        items = getattr(obj, "items", None)
        if items is not None and not hasattr(items, "all"):
            return sum(1 for item in items if item.estado != ChecklistItem.Estado.COMPLETO)
        return obj.items.exclude(estado=ChecklistItem.Estado.COMPLETO).count()


class DeliverableRequirementSerializer(serializers.ModelSerializer):
    class Meta:
        model = DeliverableRequirement
        fields = (
            "id",
            "tenant_slug",
            "tipo_gasto",
            "codigo",
            "titulo",
            "descripcion",
            "pillar",
            "requerido",
            "created_at",
        )
        read_only_fields = ("id", "tenant_slug", "created_at")


class OperacionEntregableSerializer(serializers.ModelSerializer):
    operacion_info = serializers.SerializerMethodField()
    vencido = serializers.SerializerMethodField()
    dias_atraso = serializers.SerializerMethodField()

    class Meta:
        model = OperacionEntregable
        fields = (
            "id",
            "operacion",
            "operacion_info",
            "requirement",
            "titulo",
            "descripcion",
            "tipo_gasto",
            "codigo",
            "pillar",
            "requerido",
            "estado",
            "fecha_compromiso",
            "fecha_entregado",
            "fecha_recepcion",
            "fecha_factura",
            "oc_numero",
            "oc_fecha",
            "oc_archivo_url",
            "evidencia_cargada_en",
            "recepcion_firmada_en",
            "recepcion_firmado_por",
            "recepcion_firmado_email",
            "comentarios",
            "metadata",
            "vencido",
            "dias_atraso",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "created_at",
            "updated_at",
            "operacion_info",
            "evidencia_cargada_en",
            "recepcion_firmada_en",
        )

    def get_operacion_info(self, obj: OperacionEntregable):
        return {
            "id": obj.operacion_id,
            "contrato": obj.operacion.contrato_id,
            "proveedor": obj.operacion.proveedor_id,
            "empresa": obj.operacion.empresa_id,
            "monto": obj.operacion.monto,
            "moneda": obj.operacion.moneda,
            "fecha_operacion": obj.operacion.fecha_operacion,
        }

    def get_vencido(self, obj: OperacionEntregable) -> bool:
        if not obj.fecha_compromiso:
            return False
        if obj.estado in (
            OperacionEntregable.Estado.ENTREGADO,
            OperacionEntregable.Estado.RECIBIDO,
            OperacionEntregable.Estado.FACTURADO,
        ):
            return False
        today = timezone.localdate()
        return obj.fecha_compromiso < today

    def get_dias_atraso(self, obj: OperacionEntregable) -> int:
        if not obj.fecha_compromiso:
            return 0
        if obj.estado in (
            OperacionEntregable.Estado.ENTREGADO,
            OperacionEntregable.Estado.RECIBIDO,
            OperacionEntregable.Estado.FACTURADO,
        ):
            return 0
        today = timezone.localdate()
        if obj.fecha_compromiso >= today:
            return 0
        return (today - obj.fecha_compromiso).days

    def _apply_realtime_rules(self, instance: OperacionEntregable | None, validated_data: dict) -> dict:
        """Enforce evidence + timestamps on state transitions."""
        estado_nuevo = validated_data.get("estado", instance.estado if instance else OperacionEntregable.Estado.PENDIENTE)
        evidencia = validated_data.get("oc_archivo_url")
        now = timezone.now()

        if instance:
            evidencia_actual = instance.oc_archivo_url
            if evidencia is not None and evidencia != evidencia_actual and evidencia:
                validated_data["evidencia_cargada_en"] = now
        else:
            if evidencia:
                validated_data["evidencia_cargada_en"] = now

        if estado_nuevo in (OperacionEntregable.Estado.ENTREGADO, OperacionEntregable.Estado.RECIBIDO):
            evidencia_final = evidencia if evidencia is not None else (instance.oc_archivo_url if instance else "")
            if not evidencia_final:
                raise serializers.ValidationError("Se requiere evidencia para marcar como Entregado o Recibido.")
            validated_data.setdefault("fecha_entregado", timezone.localdate())

        if estado_nuevo == OperacionEntregable.Estado.RECIBIDO:
            firmado_por = validated_data.get("recepcion_firmado_por") or (instance.recepcion_firmado_por if instance else "")
            firmado_email = validated_data.get("recepcion_firmado_email") or (instance.recepcion_firmado_email if instance else "")
            if not firmado_por or not firmado_email:
                raise serializers.ValidationError("Captura nombre y correo de quien recibe para firmar la recepción.")
            validated_data.setdefault("fecha_recepcion", timezone.localdate())
            if not instance or instance.estado != OperacionEntregable.Estado.RECIBIDO or not instance.recepcion_firmada_en:
                validated_data["recepcion_firmada_en"] = now
            if not validated_data.get("fecha_entregado") and instance and instance.fecha_entregado:
                validated_data["fecha_entregado"] = instance.fecha_entregado
        return validated_data

    def create(self, validated_data):
        validated_data = self._apply_realtime_rules(None, validated_data)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        validated_data = self._apply_realtime_rules(instance, validated_data)
        return super().update(instance, validated_data)


# ── Clause optimization ──

class ClauseOptimizeSerializer(serializers.Serializer):
    texto_clausula = serializers.CharField(
        max_length=4000,
        help_text="Texto de la cláusula a optimizar",
    )
    contexto_contrato = serializers.CharField(
        max_length=32000,
        required=False,
        allow_blank=True,
        default="",
        help_text="Resumen o markdown del contrato completo para contexto",
    )
    objetivo = serializers.ChoiceField(
        choices=(
            ("mejorar_fiscal", "Mejorar blindaje fiscal"),
            ("simplificar", "Simplificar redacción"),
            ("reforzar_materialidad", "Reforzar materialidad"),
            ("compliance_integral", "Compliance integral"),
        ),
        default="mejorar_fiscal",
    )
    idioma = serializers.ChoiceField(choices=("es", "en"), default="es")


class PromoverPlantillaSerializer(serializers.Serializer):
    clave = serializers.SlugField(
        max_length=64,
        required=False,
        allow_blank=True,
        help_text="Clave única para la plantilla (se autogenera si no se proporciona)",
    )
    nombre = serializers.CharField(
        max_length=255,
        required=False,
        allow_blank=True,
        help_text="Nombre descriptivo de la plantilla",
    )
    descripcion = serializers.CharField(
        max_length=2000,
        required=False,
        allow_blank=True,
        default="",
    )
    documento_id = serializers.IntegerField(
        required=False,
        allow_null=True,
        help_text="ID del ContractDocument a usar como base",
    )
    markdown_base = serializers.CharField(
        required=False,
        allow_blank=True,
        default="",
        help_text="Markdown depurado; si no se envía, se toma del documento",
    )


class ClauseTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ClauseTemplate
        fields = (
            "id",
            "slug",
            "titulo",
            "texto",
            "resumen",
            "categorias",
            "procesos",
            "nivel_riesgo",
            "tips_redline",
            "palabras_clave",
            "prioridad",
            "version",
            "es_curada",
            "contrato_origen",
            "creado_por",
            "activo",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("created_at", "updated_at")


class AlertaCSDSerializer(serializers.ModelSerializer):
    empresa_nombre = serializers.CharField(source="empresa.razon_social", read_only=True)
    proveedor_nombre = serializers.CharField(source="proveedor.razon_social", read_only=True)

    class Meta:
        model = AlertaCSD
        fields = [
            "id",
            "empresa",
            "empresa_nombre",
            "proveedor",
            "proveedor_nombre",
            "tipo_alerta",
            "estatus",
            "fecha_deteccion",
            "fecha_resolucion",
            "oficio_sat",
            "motivo_presuncion",
            "acciones_tomadas",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]


class AlertaOperacionSerializer(serializers.ModelSerializer):
    empresa_nombre = serializers.CharField(source="empresa.razon_social", read_only=True)
    proveedor_nombre = serializers.CharField(source="proveedor.razon_social", read_only=True)

    class Meta:
        model = AlertaOperacion
        fields = (
            "id",
            "operacion",
            "empresa",
            "empresa_nombre",
            "proveedor",
            "proveedor_nombre",
            "tipo_alerta",
            "estatus",
            "clave_dedupe",
            "owner_email",
            "motivo",
            "detalle",
            "fecha_alerta",
            "fecha_cierre",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "clave_dedupe",
            "created_at",
            "updated_at",
        )


class BandejaRevisionItemSerializer(serializers.ModelSerializer):
    empresa_rfc = serializers.CharField(source="empresa.rfc", read_only=True)
    empresa_nombre = serializers.CharField(source="empresa.razon_social", read_only=True)
    proveedor_rfc = serializers.CharField(source="proveedor.rfc", read_only=True)
    proveedor_nombre = serializers.CharField(source="proveedor.razon_social", read_only=True)
    contrato_nombre = serializers.SerializerMethodField()
    contrato_categoria = serializers.SerializerMethodField()
    perfil_validacion = serializers.SerializerMethodField()
    riesgo_nivel = serializers.SerializerMethodField()
    riesgo_score = serializers.SerializerMethodField()
    riesgo_motivos = serializers.SerializerMethodField()
    faltantes = serializers.SerializerMethodField()
    alertas_activas = serializers.SerializerMethodField()
    checklists_resumen = serializers.SerializerMethodField()

    class Meta:
        model = Operacion
        fields = (
            "id",
            "fecha_operacion",
            "estatus_validacion",
            "tipo_operacion",
            "monto",
            "moneda",
            "concepto",
            "empresa",
            "empresa_rfc",
            "empresa_nombre",
            "proveedor",
            "proveedor_rfc",
            "proveedor_nombre",
            "contrato",
            "contrato_nombre",
            "contrato_categoria",
            "perfil_validacion",
            "riesgo_nivel",
            "riesgo_score",
            "riesgo_motivos",
            "faltantes",
            "alertas_activas",
            "checklists_resumen",
        )

    def _riesgo_payload(self, obj: Operacion) -> dict:
        return get_operacion_riesgo_materialidad(obj)

    def get_contrato_nombre(self, obj: Operacion) -> str | None:
        return obj.contrato.nombre if obj.contrato else None

    def get_contrato_categoria(self, obj: Operacion) -> str | None:
        return obj.contrato.categoria if obj.contrato else None

    def get_perfil_validacion(self, obj: Operacion) -> str:
        return get_operacion_perfil_validacion(obj)

    def get_riesgo_nivel(self, obj: Operacion) -> str:
        return str(self._riesgo_payload(obj).get("nivel", "BAJO"))

    def get_riesgo_score(self, obj: Operacion) -> int:
        return int(self._riesgo_payload(obj).get("score", 0) or 0)

    def get_riesgo_motivos(self, obj: Operacion) -> list[str]:
        motivos = self._riesgo_payload(obj).get("motivos")
        if isinstance(motivos, list):
            return [str(motivo) for motivo in motivos]
        return []

    def get_faltantes(self, obj: Operacion) -> list[str]:
        _, faltantes = get_operacion_faltantes_expediente(obj)
        return faltantes

    def get_checklists_resumen(self, obj: Operacion) -> list[dict]:
        return get_operacion_checklists_resumen(obj)

    def get_alertas_activas(self, obj: Operacion) -> list[dict]:
        alertas = getattr(obj, "alertas_activas_prefetched", None)
        if alertas is None:
            alertas = obj.alertas.filter(estatus="ACTIVA").order_by("-fecha_alerta")
        return [
            {
                "id": alerta.id,
                "tipo_alerta": alerta.tipo_alerta,
                "estatus": alerta.estatus,
                "fecha_alerta": alerta.fecha_alerta.isoformat() if alerta.fecha_alerta else None,
                "motivo": alerta.motivo,
                "owner_email": alerta.owner_email,
            }
            for alerta in alertas
        ]


class MatrizMaterialidadItemSerializer(serializers.ModelSerializer):
    empresa_rfc = serializers.CharField(source="empresa.rfc", read_only=True)
    empresa_nombre = serializers.CharField(source="empresa.razon_social", read_only=True)
    proveedor_rfc = serializers.CharField(source="proveedor.rfc", read_only=True)
    proveedor_nombre = serializers.CharField(source="proveedor.razon_social", read_only=True)
    riesgo_nivel = serializers.SerializerMethodField()
    riesgo_score = serializers.SerializerMethodField()
    faltantes = serializers.SerializerMethodField()
    estado_completitud = serializers.SerializerMethodField()
    perfil_validacion = serializers.SerializerMethodField()
    cadena_documental = serializers.SerializerMethodField()
    alertas_activas = serializers.SerializerMethodField()
    checklists_resumen = serializers.SerializerMethodField()

    class Meta:
        model = Operacion
        fields = (
            "id",
            "fecha_operacion",
            "estatus_validacion",
            "tipo_operacion",
            "monto",
            "moneda",
            "empresa",
            "empresa_rfc",
            "empresa_nombre",
            "proveedor",
            "proveedor_rfc",
            "proveedor_nombre",
            "contrato",
            "uuid_cfdi",
            "referencia_spei",
            "perfil_validacion",
            "riesgo_nivel",
            "riesgo_score",
            "estado_completitud",
            "faltantes",
            "cadena_documental",
            "alertas_activas",
            "checklists_resumen",
        )

    def _riesgo_payload(self, obj: Operacion) -> dict:
        return get_operacion_riesgo_materialidad(obj)

    def get_riesgo_nivel(self, obj: Operacion) -> str:
        return str(self._riesgo_payload(obj).get("nivel", "BAJO"))

    def get_riesgo_score(self, obj: Operacion) -> int:
        return int(self._riesgo_payload(obj).get("score", 0) or 0)

    def get_faltantes(self, obj: Operacion) -> list[str]:
        _, faltantes = get_operacion_faltantes_expediente(obj)
        return faltantes

    def get_estado_completitud(self, obj: Operacion) -> str:
        return "COMPLETO" if not self.get_faltantes(obj) else "INCOMPLETO"

    def get_perfil_validacion(self, obj: Operacion) -> str:
        return get_operacion_perfil_validacion(obj)

    def get_cadena_documental(self, obj: Operacion) -> dict:
        evidencias = list(obj.evidencias.all())
        evidencia_tipos = sorted({e.tipo for e in evidencias})

        metadata = obj.metadata or {}
        pago_presente = operacion_forma_pago_documentada(obj)
        pago_tipo = "SPEI" if obj.referencia_spei else ("METADATA" if pago_presente else "NO_DOCUMENTADO")

        return {
            "cfdi": {
                "presente": bool(obj.uuid_cfdi),
                "uuid": obj.uuid_cfdi or "",
                "estatus": obj.cfdi_estatus,
            },
            "contrato": {
                "presente": bool(obj.contrato_id),
                "id": obj.contrato_id,
                "nombre": obj.contrato.nombre if obj.contrato else "",
            },
            "pago": {
                "presente": pago_presente,
                "tipo": pago_tipo,
                "referencia_spei": obj.referencia_spei or "",
                "soporte_metadata": bool(metadata.get("forma_pago") or metadata.get("soporte_pago")),
            },
            "evidencia": {
                "presente": len(evidencias) > 0,
                "total": len(evidencias),
                "tipos": evidencia_tipos,
            },
        }

    def get_alertas_activas(self, obj: Operacion) -> list[dict]:
        alertas = getattr(obj, "alertas_activas_prefetched", None)
        if alertas is None:
            alertas = obj.alertas.filter(estatus="ACTIVA").order_by("-fecha_alerta")
        return [
            {
                "id": alerta.id,
                "tipo_alerta": alerta.tipo_alerta,
                "estatus": alerta.estatus,
                "fecha_alerta": alerta.fecha_alerta.isoformat() if alerta.fecha_alerta else None,
                "motivo": alerta.motivo,
            }
            for alerta in alertas
        ]

    def get_checklists_resumen(self, obj: Operacion) -> list[dict]:
        return get_operacion_checklists_resumen(obj)
