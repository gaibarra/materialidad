from __future__ import annotations

from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models
from django.db.models import Q
from django.utils import timezone


class ContratoCategoriaChoices(models.TextChoices):
    BASE_CORPORATIVA = "BASE_CORPORATIVA", "Base corporativa"
    CLIENTES = "CLIENTES", "Clientes / ingresos"
    PROVEEDORES = "PROVEEDORES", "Proveedores / egresos"
    CAPITAL_HUMANO = "CAPITAL_HUMANO", "Capital humano"
    FINANCIERO = "FINANCIERO", "Financiero / crédito"
    ACTIVOS = "ACTIVOS", "Activos fijos e intangibles"
    PARTES_RELACIONADAS = "PARTES_RELACIONADAS", "Partes relacionadas"


class ContratoProcesoChoices(models.TextChoices):
    COMPRAS = "COMPRAS", "Compras"
    VENTAS = "VENTAS", "Ventas"
    NOMINA = "NOMINA", "Nómina"
    TESORERIA = "TESORERIA", "Tesorería"
    OPERACIONES = "OPERACIONES", "Operaciones"
    GOBIERNO_CORPORATIVO = "GOBIERNO_CORPORATIVO", "Gobierno corporativo"


class ContratoTipoEmpresaChoices(models.TextChoices):
    COMERCIAL = "COMERCIAL", "Comercial"
    INDUSTRIAL = "INDUSTRIAL", "Industrial"
    SERVICIOS = "SERVICIOS", "Servicios"
    MIXTA = "MIXTA", "Mixta"


class TipoPersonaChoices(models.TextChoices):
    MORAL = "MORAL", "Persona moral"
    FISICA = "FISICA", "Persona física"


class Empresa(models.Model):
    # ── Tipo de persona ──
    tipo_persona = models.CharField(
        max_length=8,
        choices=TipoPersonaChoices.choices,
        default=TipoPersonaChoices.MORAL,
        help_text="Persona moral o persona física",
    )

    # ── Datos generales (siempre presentes) ──
    razon_social = models.CharField(
        max_length=255,
        help_text="Razón social (PM) o nombre completo (PF)",
    )
    rfc = models.CharField(max_length=13, unique=True)
    regimen_fiscal = models.CharField(max_length=128)
    actividad_economica = models.CharField(max_length=255, blank=True, help_text="Actividad económica principal SAT")
    fecha_constitucion = models.DateField(null=True, blank=True, help_text="Fecha de constitución (PM) o inicio de actividades (PF)")

    # ── Campos exclusivos persona física ──
    nombre = models.CharField(max_length=128, blank=True, help_text="Nombre(s) — solo persona física")
    apellido_paterno = models.CharField(max_length=128, blank=True)
    apellido_materno = models.CharField(max_length=128, blank=True)
    curp = models.CharField(max_length=18, blank=True, help_text="CURP — solo persona física")

    # ── Domicilio fiscal (extraído de CSF) ──
    calle = models.CharField(max_length=255, blank=True)
    no_exterior = models.CharField(max_length=32, blank=True)
    no_interior = models.CharField(max_length=32, blank=True)
    colonia = models.CharField(max_length=128, blank=True)
    codigo_postal = models.CharField(max_length=10, blank=True)
    municipio = models.CharField(max_length=128, blank=True)
    estado = models.CharField(max_length=128)
    ciudad = models.CharField(max_length=128, blank=True)
    pais = models.CharField(max_length=128, default="México")

    # ── Contacto principal ──
    contacto_nombre = models.CharField(max_length=255, blank=True, help_text="Nombre del contacto principal")
    contacto_puesto = models.CharField(max_length=128, blank=True)
    contacto_email = models.EmailField(blank=True)
    contacto_telefono = models.CharField(max_length=32, blank=True)

    # ── Datos legacy (mantener compatibilidad) ──
    email_contacto = models.EmailField(blank=True)
    telefono_contacto = models.CharField(max_length=32, blank=True)

    # ── Constancia de Situación Fiscal ──
    csf_archivo = models.FileField(upload_to="empresas/csf/%Y/%m/", null=True, blank=True, help_text="PDF de Constancia de Situación Fiscal")
    csf_datos_extraidos = models.JSONField(default=dict, blank=True, help_text="Datos extraídos automáticamente del PDF")
    csf_fecha_emision = models.DateField(null=True, blank=True, help_text="Fecha de emisión de la CSF")

    activo = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "materialidad_empresa"
        ordering = ("razon_social",)
        verbose_name = "Empresa"
        verbose_name_plural = "Empresas"

    def __str__(self) -> str:
        if self.tipo_persona == TipoPersonaChoices.FISICA and self.nombre:
            parts = [self.nombre, self.apellido_paterno, self.apellido_materno]
            return " ".join(p for p in parts if p)
        return self.razon_social

    @property
    def es_persona_fisica(self) -> bool:
        return self.tipo_persona == TipoPersonaChoices.FISICA

    @property
    def nombre_completo_pf(self) -> str:
        """Nombre completo para persona física."""
        parts = [self.nombre, self.apellido_paterno, self.apellido_materno]
        return " ".join(p for p in parts if p)

    @property
    def domicilio_fiscal(self) -> str:
        """Domicilio fiscal formateado."""
        parts = []
        if self.calle:
            d = self.calle
            if self.no_exterior:
                d += f" #{self.no_exterior}"
            if self.no_interior:
                d += f" Int. {self.no_interior}"
            parts.append(d)
        if self.colonia:
            parts.append(f"Col. {self.colonia}")
        if self.codigo_postal:
            parts.append(f"C.P. {self.codigo_postal}")
        if self.municipio:
            parts.append(self.municipio)
        if self.estado:
            parts.append(self.estado)
        return ", ".join(parts)


class Proveedor(models.Model):
    class Estatus69B(models.TextChoices):
        SIN_COINCIDENCIA = "SIN_COINCIDENCIA", "Sin coincidencias"
        PRESUNTO = "PRESUNTO", "Presunto"
        DEFINITIVO = "DEFINITIVO", "Definitivo"

    class Riesgo(models.TextChoices):
        BAJO = "BAJO", "Bajo"
        MEDIO = "MEDIO", "Medio"
        ALTO = "ALTO", "Alto"

    # ── Tipo de persona ──
    tipo_persona = models.CharField(
        max_length=8,
        choices=TipoPersonaChoices.choices,
        default=TipoPersonaChoices.MORAL,
    )

    razon_social = models.CharField(
        max_length=255,
        help_text="Razón social (PM) o nombre completo (PF)",
    )
    rfc = models.CharField(max_length=13, unique=True)

    # ── Campos exclusivos persona física ──
    nombre = models.CharField(max_length=128, blank=True, help_text="Nombre(s) — solo persona física")
    apellido_paterno = models.CharField(max_length=128, blank=True)
    apellido_materno = models.CharField(max_length=128, blank=True)
    curp = models.CharField(max_length=18, blank=True)

    # ── Domicilio fiscal ──
    calle = models.CharField(max_length=255, blank=True)
    no_exterior = models.CharField(max_length=32, blank=True)
    no_interior = models.CharField(max_length=32, blank=True)
    colonia = models.CharField(max_length=128, blank=True)
    codigo_postal = models.CharField(max_length=10, blank=True)
    municipio = models.CharField(max_length=128, blank=True)
    pais = models.CharField(max_length=128, default="México")
    estado = models.CharField(max_length=128, blank=True)
    ciudad = models.CharField(max_length=128, blank=True)
    actividad_principal = models.CharField(max_length=255, blank=True)
    regimen_fiscal = models.CharField(max_length=128, blank=True)

    # ── Contacto principal ──
    contacto_nombre = models.CharField(max_length=255, blank=True, help_text="Nombre del contacto principal")
    contacto_puesto = models.CharField(max_length=128, blank=True)
    contacto_email = models.EmailField(blank=True)
    contacto_telefono = models.CharField(max_length=32, blank=True)

    # ── Constancia de Situación Fiscal ──
    csf_archivo = models.FileField(upload_to="proveedores/csf/%Y/%m/", null=True, blank=True)
    csf_datos_extraidos = models.JSONField(default=dict, blank=True)
    csf_fecha_emision = models.DateField(null=True, blank=True)
    estatus_sat = models.CharField(max_length=64, blank=True)
    estatus_69b = models.CharField(
        max_length=32,
        choices=Estatus69B.choices,
        default=Estatus69B.SIN_COINCIDENCIA,
    )
    riesgo_fiscal = models.CharField(
        max_length=16,
        choices=Riesgo.choices,
        default=Riesgo.BAJO,
    )
    ultima_validacion_sat = models.DateTimeField(null=True, blank=True)
    ultima_validacion_69b = models.DateTimeField(null=True, blank=True)
    detalle_validacion = models.JSONField(default=dict, blank=True)
    riesgos_detectados = models.JSONField(default=list, blank=True)
    correo_contacto = models.EmailField(blank=True)
    telefono_contacto = models.CharField(max_length=32, blank=True)
    reps_registro = models.CharField(max_length=64, blank=True, help_text="Registro REPS/IMSS si aplica")
    imss_patronal = models.CharField(max_length=64, blank=True, help_text="Registro patronal IMSS")
    activos_relevantes = models.JSONField(default=list, blank=True, help_text="Activos fijos o equipos clave")
    personal_clave = models.JSONField(default=list, blank=True, help_text="Personal asignado y CV")
    fotos_domicilio = models.JSONField(default=list, blank=True, help_text="URLs de fotos del domicilio fiscal")
    capacidad_economica_mensual = models.DecimalField(
        max_digits=19,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Capacidad económica mensual estimada (MXN)",
    )
    sitio_web = models.URLField(blank=True)
    sitio_web_capturas = models.JSONField(default=list, blank=True, help_text="Capturas o URLs de evidencia web")
    notas_capacidad = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "materialidad_proveedor"
        ordering = ("razon_social",)
        indexes = [models.Index(fields=["estatus_69b", "riesgo_fiscal"])]
        verbose_name = "Proveedor"
        verbose_name_plural = "Proveedores"

    def __str__(self) -> str:
        if self.tipo_persona == TipoPersonaChoices.FISICA and self.nombre:
            parts = [self.nombre, self.apellido_paterno, self.apellido_materno]
            return " ".join(p for p in parts if p)
        return self.razon_social

    @property
    def es_persona_fisica(self) -> bool:
        return self.tipo_persona == TipoPersonaChoices.FISICA


class Fedatario(models.Model):
    """Catálogo de fedatarios (notarios / corredores públicos)."""

    class TipoFedatario(models.TextChoices):
        NOTARIO = "NOTARIO", "Notario público"
        CORREDOR = "CORREDOR", "Corredor público"
        OTRO = "OTRO", "Otro fedatario"

    nombre = models.CharField(max_length=255, help_text="Nombre completo del fedatario")
    tipo = models.CharField(
        max_length=16,
        choices=TipoFedatario.choices,
        default=TipoFedatario.NOTARIO,
    )
    numero_notaria = models.CharField(max_length=32, blank=True, help_text="Número de notaría o correduría")
    estado = models.CharField(max_length=128, help_text="Entidad federativa")
    ciudad = models.CharField(max_length=128, blank=True)
    direccion = models.TextField(blank=True, help_text="Dirección completa de la notaría")
    telefono = models.CharField(max_length=64, blank=True)
    telefono_alterno = models.CharField(max_length=64, blank=True)
    email = models.EmailField(blank=True)
    rfc = models.CharField(max_length=13, blank=True)
    cedula_profesional = models.CharField(max_length=32, blank=True)
    horario_atencion = models.CharField(max_length=128, blank=True, help_text="Ej. L-V 9:00-18:00")
    contacto_asistente = models.CharField(max_length=255, blank=True, help_text="Nombre del asistente o contacto alterno")
    contacto_asistente_tel = models.CharField(max_length=64, blank=True)
    contacto_asistente_email = models.EmailField(blank=True)
    notas = models.TextField(blank=True, help_text="Observaciones, experiencia previa, recomendaciones")
    activo = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "materialidad_fedatario"
        ordering = ("nombre",)
        verbose_name = "Fedatario"
        verbose_name_plural = "Fedatarios"

    def __str__(self) -> str:
        label = self.nombre
        if self.numero_notaria:
            label += f" — Notaría {self.numero_notaria}"
        if self.estado:
            label += f", {self.estado}"
        return label


class ContratoTemplate(models.Model):
    clave = models.CharField(max_length=64, unique=True)
    nombre = models.CharField(max_length=255)
    categoria = models.CharField(max_length=32, choices=ContratoCategoriaChoices.choices)
    proceso = models.CharField(max_length=32, choices=ContratoProcesoChoices.choices)
    tipo_empresa = models.CharField(
        max_length=16, choices=ContratoTipoEmpresaChoices.choices, default=ContratoTipoEmpresaChoices.MIXTA
    )
    descripcion = models.TextField(blank=True)
    es_marco = models.BooleanField(default=False)
    requiere_proveedor = models.BooleanField(default=False)
    campos_configurables = models.JSONField(default=list, blank=True)
    orden = models.PositiveIntegerField(default=0)
    activo = models.BooleanField(default=True)
    metadata = models.JSONField(default=dict, blank=True)

    # ── Contrato semilla: reutilizar contratos depurados como base ──
    contrato_base = models.ForeignKey(
        "Contrato",
        on_delete=models.SET_NULL,
        related_name="templates_derivados",
        null=True,
        blank=True,
        help_text="Contrato depurado que sirve como base para futuras generaciones",
    )
    documento_base = models.ForeignKey(
        "ContractDocument",
        on_delete=models.SET_NULL,
        related_name="templates_derivados",
        null=True,
        blank=True,
        help_text="Versión específica del documento usada como referencia",
    )
    markdown_base = models.TextField(
        blank=True,
        default="",
        help_text="Texto markdown depurado (anonimizado) que se inyecta como contexto al prompt AI",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "materialidad_contrato_template"
        verbose_name = "Plantilla de contrato"
        verbose_name_plural = "Plantillas de contrato"
        ordering = ("orden", "nombre")

    def __str__(self) -> str:
        return f"{self.nombre} ({self.clave})"


class Contrato(models.Model):
    Categoria = ContratoCategoriaChoices
    ProcesoNegocio = ContratoProcesoChoices
    TipoEmpresa = ContratoTipoEmpresaChoices

    class ModalidadFirma(models.TextChoices):
        NOTARIAL = "NOTARIAL", "Notarial (fecha cierta)"
        ELECTRONICA = "ELECTRONICA", "Electrónica avanzada"
        MANUSCRITA = "MANUSCRITA", "Manuscrita / física"

    class EstadoLogistica(models.TextChoices):
        PENDIENTE = "PENDIENTE", "Pendiente"
        AGENDADA = "AGENDADA", "Agendada"
        EN_PROCESO = "EN_PROCESO", "En proceso"
        COMPLETADA = "COMPLETADA", "Completada"
        CANCELADA = "CANCELADA", "Cancelada"

    empresa = models.ForeignKey(Empresa, on_delete=models.CASCADE, related_name="contratos")
    proveedor = models.ForeignKey(
        Proveedor, on_delete=models.SET_NULL, related_name="contratos", null=True, blank=True
    )
    template = models.ForeignKey(
        ContratoTemplate,
        on_delete=models.SET_NULL,
        related_name="contratos",
        null=True,
        blank=True,
    )
    nombre = models.CharField(max_length=255)
    codigo_interno = models.CharField(max_length=64, blank=True)
    categoria = models.CharField(max_length=32, choices=ContratoCategoriaChoices.choices)
    proceso = models.CharField(max_length=32, choices=ContratoProcesoChoices.choices)
    tipo_empresa = models.CharField(
        max_length=16,
        choices=ContratoTipoEmpresaChoices.choices,
        default=ContratoTipoEmpresaChoices.MIXTA,
    )
    fecha_firma = models.DateField(null=True, blank=True)
    vigencia_inicio = models.DateField(null=True, blank=True)
    vigencia_fin = models.DateField(null=True, blank=True)
    descripcion = models.TextField(blank=True)
    es_marco = models.BooleanField(default=False)
    soporte_documental = models.CharField(max_length=255, blank=True)
    expediente_externo = models.URLField(blank=True)
    razon_negocio = models.TextField(blank=True, help_text="Describe el proposito economico real conforme al art. 5-A CFF")
    beneficio_economico_esperado = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Monto estimado del beneficio economico (no fiscal)",
    )
    beneficio_fiscal_estimado = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Beneficio fiscal estimado para validar la razon de negocios",
    )
    fecha_cierta_requerida = models.BooleanField(default=False)
    fecha_cierta_obtenida = models.BooleanField(default=False)
    fecha_ratificacion = models.DateField(null=True, blank=True)
    fedatario_nombre = models.CharField(max_length=255, blank=True)
    fedatario = models.ForeignKey(
        "Fedatario",
        on_delete=models.SET_NULL,
        related_name="contratos",
        null=True,
        blank=True,
        help_text="Fedatario seleccionado del catálogo",
    )
    numero_instrumento = models.CharField(max_length=50, blank=True)
    archivo_notariado = models.FileField(upload_to="contratos/notariados/", null=True, blank=True)
    archivo_notariado_url = models.URLField(blank=True)
    sello_tiempo_aplicado = models.DateTimeField(null=True, blank=True)
    sello_tiempo_proveedor = models.CharField(max_length=128, blank=True)
    sello_tiempo_acuse_url = models.URLField(blank=True)
    registro_publico_folio = models.CharField(max_length=128, blank=True)
    registro_publico_url = models.URLField(blank=True)
    razon_negocio_estado = models.CharField(
        max_length=16,
        choices=[
            ("PENDIENTE", "Pendiente"),
            ("EN_PROCESO", "En proceso"),
            ("APROBADO", "Aprobado"),
            ("RECHAZADO", "Rechazado"),
        ],
        default="PENDIENTE",
    )
    razon_negocio_ultimo_rol = models.CharField(max_length=32, blank=True, default="")
    razon_negocio_aprobado_en = models.DateTimeField(null=True, blank=True)
    firma_modalidad = models.CharField(
        max_length=16,
        choices=ModalidadFirma.choices,
        default=ModalidadFirma.NOTARIAL,
    )
    logistica_estado = models.CharField(
        max_length=16,
        choices=EstadoLogistica.choices,
        default=EstadoLogistica.PENDIENTE,
    )
    fecha_cita_firma = models.DateTimeField(null=True, blank=True)
    lugar_cita = models.CharField(max_length=255, blank=True)
    responsable_logistica = models.CharField(max_length=255, blank=True)
    contacto_responsable = models.CharField(max_length=128, blank=True)
    notas_logistica = models.TextField(blank=True)
    activo = models.BooleanField(default=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "materialidad_contrato"
        verbose_name = "Contrato"
        verbose_name_plural = "Contratos"
        ordering = ("-vigencia_inicio", "nombre")
        indexes = [models.Index(fields=["categoria", "proceso"])]
        constraints = [
            models.UniqueConstraint(
                fields=["empresa", "codigo_interno"],
                condition=~Q(codigo_interno=""),
                name="contrato_codigo_empresa_unico",
            )
        ]

    def __str__(self) -> str:
        return f"{self.nombre} ({self.categoria})"


class Operacion(models.Model):
    class Moneda(models.TextChoices):
        MXN = "MXN", "Peso mexicano"
        USD = "USD", "Dólar estadounidense"
        EUR = "EUR", "Euro"

    class TipoOperacion(models.TextChoices):
        COMPRA = "COMPRA", "Compra"
        SERVICIO = "SERVICIO", "Servicio"
        ARRENDAMIENTO = "ARRENDAMIENTO", "Arrendamiento"
        OTRO = "OTRO", "Otro"

    class EstatusValidacion(models.TextChoices):
        PENDIENTE = "PENDIENTE", "Pendiente"
        EN_PROCESO = "EN_PROCESO", "En proceso"
        VALIDADO = "VALIDADO", "Validado"
        RECHAZADO = "RECHAZADO", "Rechazado"

    class EstatusCFDI(models.TextChoices):
        PENDIENTE = "PENDIENTE", "Pendiente"
        VALIDO = "VALIDO", "Válido"
        INVALIDO = "INVALIDO", "Inválido"

    class EstatusSPEI(models.TextChoices):
        PENDIENTE = "PENDIENTE", "Pendiente"
        VALIDADO = "VALIDADO", "Validado"
        NO_ENCONTRADO = "NO_ENCONTRADO", "No encontrado"

    empresa = models.ForeignKey(Empresa, on_delete=models.CASCADE, related_name="operaciones")
    proveedor = models.ForeignKey(Proveedor, on_delete=models.PROTECT, related_name="operaciones")
    contrato = models.ForeignKey(
        Contrato, on_delete=models.PROTECT, related_name="operaciones", null=True, blank=True
    )
    uuid_cfdi = models.CharField(max_length=36, blank=True)
    monto = models.DecimalField(max_digits=19, decimal_places=4, validators=[MinValueValidator(0)])
    moneda = models.CharField(max_length=3, choices=Moneda.choices)
    fecha_operacion = models.DateField()
    tipo_operacion = models.CharField(max_length=16, choices=TipoOperacion.choices)
    concepto = models.TextField(blank=True)
    estatus_validacion = models.CharField(
        max_length=16, choices=EstatusValidacion.choices, default=EstatusValidacion.PENDIENTE
    )
    detalles_validacion = models.JSONField(default=dict, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    n8n_workflow_id = models.CharField(max_length=128, blank=True)
    n8n_execution_id = models.CharField(max_length=128, blank=True)
    ultima_validacion = models.DateTimeField(null=True, blank=True)
    ultima_validacion_cfdi = models.DateTimeField(null=True, blank=True)
    ultima_validacion_spei = models.DateTimeField(null=True, blank=True)
    referencia_spei = models.CharField(max_length=64, blank=True)
    nif_aplicable = models.CharField(max_length=32, blank=True, default="")
    poliza_contable = models.URLField(blank=True, default="")
    observacion_contable = models.TextField(blank=True, default="")
    cfdi_estatus = models.CharField(
        max_length=16,
        choices=EstatusCFDI.choices,
        default=EstatusCFDI.PENDIENTE,
    )
    spei_estatus = models.CharField(
        max_length=16,
        choices=EstatusSPEI.choices,
        default=EstatusSPEI.PENDIENTE,
    )
    creado_por_usuario_id = models.BigIntegerField(null=True, blank=True)
    creado_por_email = models.EmailField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "materialidad_operacion"
        verbose_name = "Operación"
        verbose_name_plural = "Operaciones"
        indexes = [
            models.Index(fields=["estatus_validacion"]),
            models.Index(fields=["fecha_operacion"]),
            models.Index(fields=["contrato"]),
            models.Index(fields=["cfdi_estatus", "spei_estatus"]),
        ]

    def __str__(self) -> str:
        return f"Operacion {self.pk}"


class CuentaBancaria(models.Model):
    empresa = models.ForeignKey(Empresa, on_delete=models.CASCADE, related_name="cuentas_bancarias")
    alias = models.CharField(max_length=128, blank=True, default="")
    banco = models.CharField(max_length=128, blank=True, default="")
    numero_cuenta = models.CharField(max_length=32, blank=True, default="")
    clabe = models.CharField(max_length=18, blank=True, default="")
    moneda = models.CharField(max_length=3, choices=Operacion.Moneda.choices, default=Operacion.Moneda.MXN)
    titular = models.CharField(max_length=255, blank=True, default="")
    es_principal = models.BooleanField(default=False)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "materialidad_cuenta_bancaria"
        verbose_name = "Cuenta bancaria"
        verbose_name_plural = "Cuentas bancarias"
        indexes = [models.Index(fields=["empresa", "moneda"])]

    def __str__(self) -> str:
        return self.alias or self.numero_cuenta or f"Cuenta {self.id}"


class EstadoCuenta(models.Model):
    cuenta = models.ForeignKey(CuentaBancaria, on_delete=models.CASCADE, related_name="estados_cuenta")
    periodo_inicio = models.DateField()
    periodo_fin = models.DateField()
    archivo_url = models.URLField(blank=True, default="")
    hash_archivo = models.CharField(max_length=128, blank=True, default="")
    saldo_inicial = models.DecimalField(max_digits=19, decimal_places=2, null=True, blank=True)
    saldo_final = models.DecimalField(max_digits=19, decimal_places=2, null=True, blank=True)
    total_abonos = models.DecimalField(max_digits=19, decimal_places=2, null=True, blank=True)
    total_cargos = models.DecimalField(max_digits=19, decimal_places=2, null=True, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "materialidad_estado_cuenta"
        verbose_name = "Estado de cuenta"
        verbose_name_plural = "Estados de cuenta"
        ordering = ("-periodo_fin",)
        indexes = [models.Index(fields=["cuenta", "periodo_fin"])]

    def __str__(self) -> str:
        return f"{self.cuenta} {self.periodo_inicio} - {self.periodo_fin}"


class MovimientoBancario(models.Model):
    class Tipo(models.TextChoices):
        ABONO = "ABONO", "Abono"
        CARGO = "CARGO", "Cargo"

    estado_cuenta = models.ForeignKey(EstadoCuenta, on_delete=models.CASCADE, related_name="movimientos")
    cuenta = models.ForeignKey(CuentaBancaria, on_delete=models.CASCADE, related_name="movimientos")
    fecha = models.DateField()
    monto = models.DecimalField(max_digits=19, decimal_places=4)
    tipo = models.CharField(max_length=8, choices=Tipo.choices)
    referencia = models.CharField(max_length=64, blank=True, default="")
    descripcion = models.CharField(max_length=255, blank=True, default="")
    cuenta_contraparte = models.CharField(max_length=32, blank=True, default="")
    banco_contraparte = models.CharField(max_length=128, blank=True, default="")
    nombre_contraparte = models.CharField(max_length=255, blank=True, default="")
    spei_referencia = models.CharField(max_length=64, blank=True, default="")
    categoria = models.CharField(max_length=64, blank=True, default="")
    es_circular = models.BooleanField(default=False)
    alerta_capacidad = models.BooleanField(default=False)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "materialidad_movimiento_bancario"
        verbose_name = "Movimiento bancario"
        verbose_name_plural = "Movimientos bancarios"
        ordering = ("-fecha", "-created_at")
        indexes = [
            models.Index(fields=["cuenta", "fecha"], name="mov_cuenta_fecha_idx"),
            models.Index(fields=["spei_referencia"], name="mov_spei_ref_idx"),
        ]

    def __str__(self) -> str:
        return f"{self.fecha} {self.tipo} {self.monto}"


class OperacionConciliacion(models.Model):
    class Estado(models.TextChoices):
        PENDIENTE = "PENDIENTE", "Pendiente"
        AUTO = "AUTO", "Auto"
        MANUAL = "MANUAL", "Manual"
        RECHAZADA = "RECHAZADA", "Rechazada"

    operacion = models.ForeignKey(Operacion, on_delete=models.CASCADE, related_name="conciliaciones")
    movimiento = models.OneToOneField(MovimientoBancario, on_delete=models.CASCADE, related_name="conciliacion")
    estado = models.CharField(max_length=16, choices=Estado.choices, default=Estado.PENDIENTE)
    confianza = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    comentario = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "materialidad_operacion_conciliacion"
        verbose_name = "Conciliación de operación"
        verbose_name_plural = "Conciliaciones de operación"
        ordering = ("-created_at",)
        indexes = [models.Index(fields=["operacion", "estado"], name="conc_op_estado_idx")]

    def __str__(self) -> str:
        return f"Conciliación {self.operacion_id} -> {self.movimiento_id}"


class LegalReferenceSource(models.Model):
    class SourceType(models.TextChoices):
        LEY = "LEY", "Ley"
        REGLAMENTO = "REGLAMENTO", "Reglamento"
        NOM = "NOM", "Norma Oficial"
        CRITERIO_SAT = "CRITERIO_SAT", "Criterio SAT"
        RESOLUCION = "RESOLUCION", "Resolución"

    slug = models.SlugField(max_length=255, unique=True)
    ley = models.CharField(max_length=255)
    tipo_fuente = models.CharField(max_length=32, choices=SourceType.choices, default=SourceType.LEY)
    articulo = models.CharField(max_length=64, blank=True)
    fraccion = models.CharField(max_length=64, blank=True)
    parrafo = models.CharField(max_length=64, blank=True)
    contenido = models.TextField()
    resumen = models.TextField(blank=True)
    fuente_documento = models.CharField(max_length=255, blank=True)
    fuente_url = models.URLField(blank=True)
    vigencia = models.CharField(max_length=64, blank=True)
    sat_categoria = models.CharField(max_length=64, blank=True)
    hash_contenido = models.CharField(max_length=64, unique=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "materialidad_legal_reference_source"
        verbose_name = "Fuente legal"
        verbose_name_plural = "Fuentes legales"
        indexes = [
            models.Index(fields=["ley", "articulo"]),
            models.Index(fields=["tipo_fuente"]),
        ]

    def __str__(self) -> str:
        base = f"{self.ley}"
        if self.articulo:
            base += f" art. {self.articulo}"
        if self.fraccion:
            base += f" fr. {self.fraccion}"
        return base


class ContractCitationCache(models.Model):
    documento_hash = models.CharField(max_length=64, unique=True)
    contrato = models.ForeignKey(
        "Contrato",
        on_delete=models.CASCADE,
        related_name="citas_cache",
        null=True,
        blank=True,
    )
    idioma = models.CharField(max_length=8, default="es")
    fuente = models.CharField(max_length=32, default="AI")
    payload = models.JSONField()
    modelo = models.CharField(max_length=128, blank=True)
    sources_version = models.CharField(max_length=32, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_stale = models.BooleanField(default=False)
    regenerations = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "materialidad_contract_citation_cache"
        verbose_name = "Caché de citas"
        verbose_name_plural = "Cachés de citas"
        indexes = [
            models.Index(fields=["contrato"]),
            models.Index(fields=["updated_at"]),
        ]

    def __str__(self) -> str:
        return f"Citas {self.documento_hash[:8]}"


class ContractDocument(models.Model):
    class Kind(models.TextChoices):
        BORRADOR_AI = "BORRADOR_AI", "Borrador AI"
        DEFINITIVO_AI = "DEFINITIVO_AI", "Definitivo AI"
        SUBIDO = "SUBIDO", "Subido"
        CORREGIDO = "CORREGIDO", "Corregido"

    class Source(models.TextChoices):
        AI = "AI", "Generado por IA"
        UPLOAD = "UPLOAD", "Cargado por usuario"
        MANUAL = "MANUAL", "Captura manual"

    contrato = models.ForeignKey(
        "Contrato",
        on_delete=models.CASCADE,
        related_name="documentos",
    )
    kind = models.CharField(max_length=32, choices=Kind.choices, default=Kind.BORRADOR_AI)
    source = models.CharField(max_length=16, choices=Source.choices, default=Source.AI)
    idioma = models.CharField(max_length=8, default="es")
    tono = models.CharField(max_length=16, default="formal")
    modelo = models.CharField(max_length=128, blank=True, default="")
    archivo = models.FileField(upload_to="contratos/documentos/%Y/%m/", null=True, blank=True)
    archivo_nombre = models.CharField(max_length=255, blank=True, default="")
    markdown_text = models.TextField(blank=True, default="")
    extracted_text = models.TextField(blank=True, default="")
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "materialidad_contract_document"
        verbose_name = "Documento de contrato"
        verbose_name_plural = "Documentos de contrato"
        ordering = ("-created_at",)
        indexes = [
            models.Index(fields=["contrato", "kind"]),
            models.Index(fields=["created_at"]),
        ]

    def __str__(self) -> str:
        return f"Documento {self.pk} {self.get_kind_display()}"


class DashboardSnapshot(models.Model):
    tenant_slug = models.SlugField(max_length=255, db_index=True)
    payload = models.JSONField(default=dict, blank=True)
    cobertura_contractual = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    contratos_por_vencer_30 = models.PositiveIntegerField(default=0)
    operaciones_pendientes = models.PositiveIntegerField(default=0)
    proveedores_sin_validacion_sat = models.PositiveIntegerField(default=0)
    monto_validado_mxn = models.DecimalField(max_digits=19, decimal_places=2, default=0)
    captured_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "materialidad_dashboard_snapshot"
        verbose_name = "Dashboard snapshot"
        verbose_name_plural = "Dashboard snapshots"
        ordering = ("-captured_at",)
        indexes = [
            models.Index(fields=("tenant_slug", "captured_at")),
        ]

    def __str__(self) -> str:
        return f"Snapshot {self.tenant_slug} @ {self.captured_at:%Y-%m-%d %H:%M}"


class LegalConsultation(models.Model):
    tenant_slug = models.SlugField(max_length=255, db_index=True)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="legal_consultations",
        null=True,
        blank=True,
    )
    question = models.TextField()
    context = models.TextField(blank=True)
    answer = models.TextField(blank=True)
    references = models.JSONField(default=list, blank=True)
    ai_model = models.CharField(max_length=128, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "materialidad_legal_consultation"
        verbose_name = "Consulta legal"
        verbose_name_plural = "Consultas legales"
        ordering = ("-created_at",)
        indexes = [
            models.Index(fields=("tenant_slug", "created_at"), name="materialida_tenant_chat_idx"),
        ]

    def __str__(self) -> str:  # pragma: no cover - representación
        return f"Consulta {self.tenant_slug} #{self.pk}"


class CompliancePillar(models.TextChoices):
    ENTREGABLES = "ENTREGABLES", "Entregables"
    RAZON_NEGOCIO = "RAZON_NEGOCIO", "Razón de negocio"


class AuditLog(models.Model):
    id = models.BigAutoField(primary_key=True)
    actor_id = models.BigIntegerField(null=True, blank=True)
    actor_email = models.EmailField(blank=True, default="")
    actor_name = models.CharField(max_length=255, blank=True, default="")
    action = models.CharField(max_length=64)
    object_type = models.CharField(max_length=128)
    object_id = models.CharField(max_length=64)
    object_repr = models.CharField(max_length=255, blank=True, default="")
    changes = models.JSONField(default=dict, blank=True)
    source_ip = models.GenericIPAddressField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "materialidad_audit_log"
        indexes = [
            models.Index(fields=["object_type", "object_id", "action"], name="audit_obj_action_idx"),
            models.Index(fields=["created_at"], name="audit_created_idx"),
        ]

    def __str__(self) -> str:  # pragma: no cover - presentación
        return f"{self.action} {self.object_type}:{self.object_id}"


class Checklist(models.Model):
    tenant_slug = models.SlugField(max_length=255, db_index=True)
    nombre = models.CharField(max_length=255)
    tipo_gasto = models.CharField(max_length=128, blank=True, default="")
    vigente = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "materialidad_checklist"
        ordering = ("-created_at",)
        indexes = [models.Index(fields=["tenant_slug", "tipo_gasto"])]

    def __str__(self) -> str:  # pragma: no cover - presentación
        return f"Checklist {self.nombre} ({self.tenant_slug})"


class ChecklistItem(models.Model):
    class Estado(models.TextChoices):
        PENDIENTE = "PENDIENTE", "Pendiente"
        EN_PROCESO = "EN_PROCESO", "En proceso"
        COMPLETO = "COMPLETO", "Completo"

    checklist = models.ForeignKey(Checklist, on_delete=models.CASCADE, related_name="items")
    pillar = models.CharField(max_length=32, choices=CompliancePillar.choices)
    titulo = models.CharField(max_length=255)
    descripcion = models.TextField(blank=True, default="")
    requerido = models.BooleanField(default=True)
    estado = models.CharField(max_length=16, choices=Estado.choices, default=Estado.PENDIENTE)
    vence_el = models.DateField(null=True, blank=True)
    responsable = models.CharField(max_length=255, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "materialidad_checklist_item"
        ordering = ("-created_at",)
        indexes = [models.Index(fields=["pillar", "estado"])]

    def __str__(self) -> str:  # pragma: no cover - presentación
        return f"{self.titulo} - {self.pillar}"


class DeliverableRequirement(models.Model):
    tenant_slug = models.SlugField(max_length=255, db_index=True)
    tipo_gasto = models.CharField(max_length=128)
    codigo = models.CharField(max_length=64)
    titulo = models.CharField(max_length=255)
    descripcion = models.TextField(blank=True, default="")
    pillar = models.CharField(max_length=32, choices=CompliancePillar.choices, default=CompliancePillar.ENTREGABLES)
    requerido = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "materialidad_entregable_requirement"
        unique_together = ("tenant_slug", "tipo_gasto", "codigo")
        ordering = ("tipo_gasto", "codigo")
        indexes = [models.Index(fields=["tenant_slug", "tipo_gasto"])]

    def __str__(self) -> str:  # pragma: no cover - presentación
        return f"{self.tipo_gasto} · {self.codigo}"


class OperacionEntregable(models.Model):
    class Estado(models.TextChoices):
        PENDIENTE = "PENDIENTE", "Pendiente"
        EN_PROCESO = "EN_PROCESO", "En proceso"
        ENTREGADO = "ENTREGADO", "Entregado"
        RECIBIDO = "RECIBIDO", "Recibido"
        FACTURADO = "FACTURADO", "Facturado"

    operacion = models.ForeignKey(Operacion, on_delete=models.CASCADE, related_name="entregables")
    requirement = models.ForeignKey(
        DeliverableRequirement,
        on_delete=models.SET_NULL,
        related_name="operacion_entregables",
        null=True,
        blank=True,
    )
    titulo = models.CharField(max_length=255)
    descripcion = models.TextField(blank=True, default="")
    tipo_gasto = models.CharField(max_length=128, blank=True, default="")
    codigo = models.CharField(max_length=64, blank=True, default="")
    pillar = models.CharField(
        max_length=32,
        choices=CompliancePillar.choices,
        default=CompliancePillar.ENTREGABLES,
    )
    requerido = models.BooleanField(default=True)
    estado = models.CharField(max_length=16, choices=Estado.choices, default=Estado.PENDIENTE)
    fecha_compromiso = models.DateField(null=True, blank=True)
    fecha_entregado = models.DateField(null=True, blank=True)
    fecha_recepcion = models.DateField(null=True, blank=True)
    fecha_factura = models.DateField(null=True, blank=True)
    oc_numero = models.CharField(max_length=128, blank=True, default="")
    oc_fecha = models.DateField(null=True, blank=True)
    oc_archivo_url = models.URLField(blank=True, default="")
    evidencia_cargada_en = models.DateTimeField(null=True, blank=True)
    recepcion_firmada_en = models.DateTimeField(null=True, blank=True)
    recepcion_firmado_por = models.CharField(max_length=255, blank=True, default="")
    recepcion_firmado_email = models.EmailField(blank=True, default="")
    comentarios = models.TextField(blank=True, default="")
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "materialidad_operacion_entregable"
        ordering = ("-created_at",)
        indexes = [
            models.Index(fields=["operacion", "estado"]),
            models.Index(fields=["codigo", "tipo_gasto"]),
        ]

    def __str__(self) -> str:  # pragma: no cover - presentación
        return f"Entregable {self.titulo} ({self.estado})"


class EvidenciaMaterial(models.Model):
    class Tipo(models.TextChoices):
        ENTREGABLE = "ENTREGABLE", "Entregable final"
        BITACORA = "BITACORA", "Bitacora / minuta"
        COMUNICACION = "COMUNICACION", "Comunicacion"
        FOTOGRAFIA = "FOTOGRAFIA", "Evidencia fotografica"

    operacion = models.ForeignKey(
        Operacion, on_delete=models.CASCADE, related_name="evidencias"
    )
    tipo = models.CharField(max_length=20, choices=Tipo.choices, default=Tipo.ENTREGABLE)
    archivo = models.FileField(upload_to="evidencias/%Y/%m/")
    descripcion = models.CharField(max_length=255)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "materialidad_evidencia_material"
        verbose_name = "Evidencia de materialidad"
        verbose_name_plural = "Evidencias de materialidad"
        ordering = ("-created_at",)
        indexes = [models.Index(fields=["tipo", "created_at"], name="materialid_tipo_cr_7bf7ab_idx")]

    def __str__(self) -> str:  # pragma: no cover - presentación
        return f"{self.tipo} - {self.descripcion}"


class RazonNegocioAprobacion(models.Model):
    class Rol(models.TextChoices):
        SOLICITANTE = "SOLICITANTE", "Solicitante"
        AREA = "RESPONSABLE_AREA", "Responsable del área"
        COMPLIANCE = "COMPLIANCE", "Compliance / Legal"
        FISCAL = "FISCAL", "Fiscal"
        DIRECTOR = "DIRECTOR", "Dirección"

    class Estado(models.TextChoices):
        PENDIENTE = "PENDIENTE", "Pendiente"
        APROBADO = "APROBADO", "Aprobado"
        RECHAZADO = "RECHAZADO", "Rechazado"

    contrato = models.ForeignKey(Contrato, on_delete=models.CASCADE, related_name="aprobaciones_razon")
    rol = models.CharField(max_length=32, choices=Rol.choices)
    estado = models.CharField(max_length=16, choices=Estado.choices, default=Estado.PENDIENTE)
    comentario = models.TextField(blank=True, default="")
    evidencia_url = models.URLField(blank=True, default="")
    firmado_por = models.CharField(max_length=255, blank=True, default="")
    firmado_email = models.EmailField(blank=True, default="")
    decidido_en = models.DateTimeField(null=True, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "materialidad_razon_negocio_aprobacion"
        ordering = ("-created_at",)
        indexes = [models.Index(fields=["contrato", "estado"])]

    def __str__(self) -> str:  # pragma: no cover - presentación
        return f"Aprobación {self.get_rol_display()} - {self.get_estado_display()}"


class TransaccionIntercompania(models.Model):
    """
    Modelo para transacciones entre empresas del mismo grupo corporativo.
    Crítico para documentar préstamos intercompañía y evitar problemas fiscales.
    """

    class TipoTransaccion(models.TextChoices):
        PRESTAMO = "PRESTAMO", "Préstamo"
        SERVICIO = "SERVICIO", "Prestación de servicio"
        VENTA = "VENTA", "Venta de bienes"
        REGALIAS = "REGALIAS", "Regalías"
        ARRENDAMIENTO = "ARRENDAMIENTO", "Arrendamiento"
        OTRO = "OTRO", "Otro"

    class Estado(models.TextChoices):
        VIGENTE = "VIGENTE", "Vigente"
        LIQUIDADO = "LIQUIDADO", "Liquidado"
        VENCIDO = "VENCIDO", "Vencido"
        CANCELADO = "CANCELADO", "Cancelado"

    # Empresas involucradas (ambas del mismo corporativo)
    empresa_origen = models.ForeignKey(
        Empresa,
        on_delete=models.PROTECT,
        related_name="transacciones_enviadas",
        help_text="Empresa que otorga el préstamo o presta el servicio",
    )
    empresa_destino = models.ForeignKey(
        Empresa,
        on_delete=models.PROTECT,
        related_name="transacciones_recibidas",
        help_text="Empresa que recibe el préstamo o servicio",
    )

    # Detalles de la transacción
    tipo = models.CharField(max_length=20, choices=TipoTransaccion.choices)
    concepto = models.CharField(max_length=255)
    descripcion = models.TextField(blank=True)

    # Montos y condiciones
    monto_principal = models.DecimalField(
        max_digits=19,
        decimal_places=2,
        validators=[MinValueValidator(0)],
        help_text="Monto principal de la transacción",
    )
    moneda = models.CharField(max_length=3, choices=Operacion.Moneda.choices, default=Operacion.Moneda.MXN)
    tasa_interes = models.DecimalField(
        max_digits=6,
        decimal_places=4,
        null=True,
        blank=True,
        help_text="Tasa de interés anual (si aplica)",
    )

    # Fechas
    fecha_inicio = models.DateField(help_text="Fecha de inicio de la transacción")
    fecha_vencimiento = models.DateField(null=True, blank=True, help_text="Fecha de vencimiento")
    fecha_liquidacion = models.DateField(null=True, blank=True, help_text="Fecha de liquidación efectiva")

    # Saldo y estado
    saldo_pendiente = models.DecimalField(
        max_digits=19,
        decimal_places=2,
        default=0,
        help_text="Saldo pendiente de pago",
    )
    estado = models.CharField(max_length=16, choices=Estado.choices, default=Estado.VIGENTE)

    # Documentación y cumplimiento
    contrato = models.ForeignKey(
        Contrato,
        on_delete=models.SET_NULL,
        related_name="transacciones_intercompania",
        null=True,
        blank=True,
        help_text="Contrato que documenta esta transacción",
    )
    num_operacion_interna = models.CharField(max_length=64, blank=True, help_text="Número de operación interna")

    # Razón de negocio específica (separada del contrato)
    razon_negocio = models.TextField(
        blank=True,
        help_text="Justificación económica de la transacción intercompañía",
    )
    beneficio_grupo = models.TextField(
        blank=True,
        help_text="Beneficio para el grupo corporativo",
    )

    # Cumplimiento transfer pricing
    estudio_precios_transferencia = models.BooleanField(
        default=False,
        help_text="¿Se cuenta con estudio de precios de transferencia?",
    )
    metodo_valuacion = models.CharField(
        max_length=128,
        blank=True,
        help_text="Método de valuación aplicado (CUP, RPM, CPM, etc.)",
    )
    archivo_estudio_url = models.URLField(blank=True, help_text="URL del estudio de precios de transferencia")

    # Alertas y riesgos
    requiere_atencion = models.BooleanField(default=False)
    notas_alerta = models.TextField(blank=True)

    # Metadata
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "materialidad_transaccion_intercompania"
        verbose_name = "Transacción intercompañía"
        verbose_name_plural = "Transacciones intercompañía"
        ordering = ("-fecha_inicio",)
        indexes = [
            models.Index(fields=["empresa_origen", "empresa_destino"]),
            models.Index(fields=["estado", "fecha_vencimiento"]),
            models.Index(fields=["tipo", "estado"]),
        ]

    def __str__(self) -> str:
        return f"{self.tipo}: {self.empresa_origen} → {self.empresa_destino} ({self.monto_principal} {self.moneda})"

    def save(self, *args, **kwargs):
        # Actualizar saldo pendiente si no está establecido
        if self.saldo_pendiente == 0 and not self.pk:
            self.saldo_pendiente = self.monto_principal
        super().save(*args, **kwargs)


class ClauseTemplate(models.Model):
    """Cláusula reutilizable para generación de contratos.

    Migrada desde la biblioteca hardcoded, ahora almacenada en BD para
    permitir CRUD por despachos y aprendizaje orgánico de cláusulas exitosas.
    """

    class NivelRiesgo(models.TextChoices):
        BAJO = "BAJO", "Bajo"
        MEDIO = "MEDIO", "Medio"
        ALTO = "ALTO", "Alto"

    slug = models.SlugField(max_length=128, unique=True)
    titulo = models.CharField(max_length=255)
    texto = models.TextField(help_text="Redacción de la cláusula lista para insertar en contratos")
    resumen = models.TextField(blank=True, help_text="Descripción breve de qué cubre esta cláusula")
    categorias = models.JSONField(
        default=list,
        blank=True,
        help_text="Lista de categorías de contrato donde aplica (BASE_CORPORATIVA, PROVEEDORES, etc.)",
    )
    procesos = models.JSONField(
        default=list,
        blank=True,
        help_text="Lista de procesos donde aplica (COMPRAS, OPERACIONES, etc.)",
    )
    nivel_riesgo = models.CharField(
        max_length=8,
        choices=NivelRiesgo.choices,
        default=NivelRiesgo.MEDIO,
    )
    tips_redline = models.JSONField(
        default=list,
        blank=True,
        help_text="Consejos para revisión de redlines",
    )
    palabras_clave = models.JSONField(
        default=list,
        blank=True,
        help_text="Palabras clave para búsqueda y matching",
    )
    prioridad = models.PositiveIntegerField(default=3, help_text="Mayor = más relevante (1-10)")
    version = models.PositiveIntegerField(default=1, help_text="Versión de la cláusula para trazabilidad")
    es_curada = models.BooleanField(
        default=False,
        help_text="Cláusula curada por el equipo legal (visible para todos los tenants)",
    )
    contrato_origen = models.ForeignKey(
        "Contrato",
        on_delete=models.SET_NULL,
        related_name="clausulas_derivadas",
        null=True,
        blank=True,
        help_text="Contrato del cual se extrajo esta cláusula (aprendizaje orgánico)",
    )
    creado_por = models.CharField(
        max_length=255,
        blank=True,
        default="",
        help_text="Email o identificador del usuario que creó la cláusula",
    )
    activo = models.BooleanField(default=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "materialidad_clause_template"
        verbose_name = "Plantilla de cláusula"
        verbose_name_plural = "Plantillas de cláusula"
        ordering = ("-prioridad", "titulo")
        indexes = [
            models.Index(fields=["nivel_riesgo", "activo"]),
            models.Index(fields=["es_curada", "activo"]),
        ]

    def __str__(self) -> str:
        return f"{self.titulo} (v{self.version})"


class TipoAlertaCSD(models.TextChoices):
    PROPIETARIO = "PROPIETARIO", "CSD de la propia Empresa"
    PROVEEDOR_CRITICO = "PROVEEDOR", "CSD de Proveedor Crítico"


class EstatusAlertaCSD(models.TextChoices):
    ACTIVA = "ACTIVA", "Activa (CSD Suspendido/En Riesgo)"
    ACLARACION = "ACLARACION", "Caso de Aclaración Ingresado"
    RESUELTA = "RESUELTA", "Resuelta (CSD Reactivado)"
    REVOCADO = "REVOCADO", "Cancelación Definitiva"


class AlertaCSD(models.Model):
    empresa = models.ForeignKey(Empresa, on_delete=models.CASCADE, related_name="alertas_csd")
    proveedor = models.ForeignKey(Proveedor, on_delete=models.SET_NULL, null=True, blank=True, related_name="alertas_csd")
    
    tipo_alerta = models.CharField(max_length=32, choices=TipoAlertaCSD.choices, default=TipoAlertaCSD.PROPIETARIO)
    estatus = models.CharField(max_length=32, choices=EstatusAlertaCSD.choices, default=EstatusAlertaCSD.ACTIVA)
    
    fecha_deteccion = models.DateField(default=timezone.now)
    fecha_resolucion = models.DateField(null=True, blank=True)
    
    oficio_sat = models.CharField(max_length=64, blank=True, help_text="Número de oficio notificado por el SAT")
    motivo_presuncion = models.TextField(blank=True, help_text="Fracción del 17-H Bis invocada y detalles")
    acciones_tomadas = models.TextField(blank=True, help_text="Bitácora de seguimiento")
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "materialidad_alerta_csd"
        ordering = ("-fecha_deteccion",)
        verbose_name = "Alerta CSD"
        verbose_name_plural = "Alertas CSD"

    def __str__(self) -> str:
        return f"Alerta CSD - {self.get_tipo_alerta_display()} ({self.estatus})"
