from __future__ import annotations

import hashlib

from django.utils import timezone
from django.utils.text import slugify
from rest_framework import serializers

from .models import (
    AuditLog,
    AlertaCSD,
    Checklist,
    ChecklistItem,
    ClauseTemplate,
    ContractDocument,
    Contrato,
    ContratoTemplate,
    CuentaBancaria,
    DashboardSnapshot,
    DeliverableRequirement,
    Empresa,
    EstadoCuenta,
    Fedatario,
    LegalConsultation,
    LegalReferenceSource,
    MovimientoBancario,
    Operacion,
    OperacionConciliacion,
    OperacionEntregable,
    Proveedor,
    RazonNegocioAprobacion,
)
from .services import trigger_proveedor_validacion, trigger_validacion_proveedor

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


class OperacionSerializer(serializers.ModelSerializer):
    empresa_nombre = serializers.CharField(source="empresa.razon_social", read_only=True)
    proveedor_nombre = serializers.CharField(source="proveedor.razon_social", read_only=True)
    contrato_nombre = serializers.SerializerMethodField()
    contrato_categoria = serializers.SerializerMethodField()
    concepto_generico = serializers.SerializerMethodField()
    concepto_sugerido = serializers.SerializerMethodField()

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
            "tipo_fuente",
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
            "metadata",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("slug", "hash_contenido", "created_at", "updated_at")

    def _merge_payload(self, instance, validated_data):
        if not instance:
            return validated_data
        base = {
            "ley": instance.ley,
            "tipo_fuente": instance.tipo_fuente,
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


class LegalConsultationRequestSerializer(serializers.Serializer):
    pregunta = serializers.CharField(max_length=2000)
    contexto = serializers.CharField(max_length=2000, allow_blank=True, required=False)
    ley = serializers.CharField(max_length=255, allow_blank=True, required=False)
    tipo_fuente = serializers.ChoiceField(
        choices=LegalReferenceSource.SourceType.choices,
        required=False,
        allow_blank=True,
    )
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


class LegalConsultationSerializer(serializers.ModelSerializer):
    pregunta = serializers.CharField(source="question", read_only=True)
    contexto = serializers.CharField(source="context", read_only=True)
    respuesta = serializers.CharField(source="answer", read_only=True)
    modelo = serializers.CharField(source="ai_model", read_only=True)
    referencias = serializers.SerializerMethodField()

    class Meta:
        model = LegalConsultation
        fields = (
            "id",
            "pregunta",
            "contexto",
            "respuesta",
            "modelo",
            "referencias",
            "created_at",
        )
        read_only_fields = fields

    def get_referencias(self, obj: LegalConsultation) -> list[dict[str, str]]:
        if isinstance(obj.references, list):
            return obj.references
        return []


class ChecklistItemSerializer(serializers.ModelSerializer):
    def validate(self, attrs):
        attrs = super().validate(attrs)
        titulo = (attrs.get("titulo") or "").strip()
        if not titulo:
            raise serializers.ValidationError({"titulo": "El título es obligatorio"})
        attrs["titulo"] = titulo
        descripcion = attrs.get("descripcion") or ""
        attrs["descripcion"] = descripcion.strip()
        responsable = attrs.get("responsable") or ""
        attrs["responsable"] = responsable.strip()
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
