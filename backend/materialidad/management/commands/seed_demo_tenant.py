from __future__ import annotations

import csv
import hashlib
import json
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from decimal import Decimal
from pathlib import Path

from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand, CommandError
from django.db.models import Sum
from django.utils import timezone
from django.utils.text import slugify

from materialidad.legal_corpus import HASH_VECTOR_MODEL, build_hashed_embedding
from materialidad.models import (
    AlertaCSD,
    AlertaOperacion,
    AuditLog,
    Checklist,
    ChecklistItem,
    CompliancePillar,
    ContractDocument,
    Contrato,
    ContratoCategoriaChoices,
    ContratoProcesoChoices,
    ContratoTemplate,
    ContratoTipoEmpresaChoices,
    CuentaBancaria,
    DashboardSnapshot,
    DeliverableRequirement,
    Empresa,
    EvidenciaMaterial,
    EstadoCuenta,
    Fedatario,
    FiscalDefenseIndexSnapshot,
    LegalConsultation,
    LegalCorpusUpload,
    LegalReferenceSource,
    MovimientoBancario,
    Operacion,
    OperacionConciliacion,
    OperacionEntregable,
    Proveedor,
    RazonNegocioAprobacion,
    TransaccionIntercompania,
)
from materialidad.services import calculate_fiscal_defense_index, get_dashboard_cobertura_p0
from tenancy.context import TenantContext
from tenancy.models import Tenant


@dataclass(frozen=True)
class SeedSummary:
    empresas: int = 0
    proveedores: int = 0
    contratos: int = 0
    operaciones: int = 0
    movimientos: int = 0
    entregables: int = 0
    evidencias: int = 0
    alertas: int = 0
    consultas: int = 0
    fuentes_legales: int = 0


class Command(BaseCommand):
    help = (
        "Puebla el tenant demo con datos mock útiles para evaluación comercial, "
        "incluyendo contratos, operaciones, alertas, expedientes y consulta legal."
    )

    REAL_69B_PREFERRED_RFCS = (
        "ADC0902069B2",
        "RFC150319SA3",
        "CARM6404269B4",
    )

    DEMO_REQUIREMENTS = [
        {
            "tipo_gasto": "Consultoría legal",
            "codigo": "DEMO-CONS-01",
            "titulo": "Contrato firmado con alcance y entregables",
            "descripcion": "Contrato marco con objeto, alcance, honorarios, entregables y evidencia de no subordinación.",
            "pillar": CompliancePillar.RAZON_NEGOCIO,
        },
        {
            "tipo_gasto": "Consultoría legal",
            "codigo": "DEMO-CONS-02",
            "titulo": "Bitácora de sesiones y minutas",
            "descripcion": "Registro de sesiones, acuerdos, participantes y decisiones derivadas del servicio.",
            "pillar": CompliancePillar.ENTREGABLES,
        },
        {
            "tipo_gasto": "Consultoría legal",
            "codigo": "DEMO-CONS-03",
            "titulo": "Entregable técnico con recomendaciones",
            "descripcion": "Opinión técnica, memo legal o presentación ejecutiva que evidencie el valor recibido.",
            "pillar": CompliancePillar.ENTREGABLES,
        },
        {
            "tipo_gasto": "Arrendamiento de maquinaria",
            "codigo": "DEMO-ARR-01",
            "titulo": "Orden de compra y evidencia de recepción",
            "descripcion": "OC, acta de entrega, geolocalización y evidencia fotográfica del equipo arrendado.",
            "pillar": CompliancePillar.CAPACIDAD_PROVEEDOR,
        },
        {
            "tipo_gasto": "Software / SaaS",
            "codigo": "DEMO-SAAS-01",
            "titulo": "Bitácora de usuarios activos y accesos",
            "descripcion": "Exportes de uso, licencias asignadas, bitácora de accesos y tickets resueltos.",
            "pillar": CompliancePillar.ENTREGABLES,
        },
        {
            "tipo_gasto": "Partes relacionadas",
            "codigo": "DEMO-PR-01",
            "titulo": "Razón de negocio y estudio de precios de transferencia",
            "descripcion": "Memorando ejecutivo que sustenta la conveniencia económica para el grupo y evidencia arm's length.",
            "pillar": CompliancePillar.RAZON_NEGOCIO,
        },
        {
            "tipo_gasto": "Proveedor con alerta 69-B",
            "codigo": "DEMO-RSK-01",
            "titulo": "Paquete de contención y comité de crisis fiscal",
            "descripcion": "Congelamiento de pagos, minuta de comité, evidencia de revisión reforzada y decisión de sustitución del proveedor.",
            "pillar": CompliancePillar.RAZON_NEGOCIO,
        },
    ]

    SHARED_LEGAL_SOURCES = [
        {
            "slug": "demo-legal-cff-5a",
            "ley": "Código Fiscal de la Federación",
            "ordenamiento": "Código Fiscal de la Federación",
            "tipo_fuente": LegalReferenceSource.SourceType.LEY,
            "autoridad_emisora": "DOF",
            "articulo": "5-A",
            "resumen": "Razón de negocio y recalificación de actos jurídicos.",
            "contenido": (
                "La autoridad fiscal podrá recalificar actos jurídicos cuando carezcan de una razón de negocio y generen un beneficio fiscal directo o indirecto. "
                "La defensa del contribuyente requiere demostrar beneficio económico razonablemente esperado, sustancia operativa y evidencia de ejecución."
            ),
            "fuente_documento": "DOF texto vigente 2026",
            "fuente_url": "https://www.dof.gob.mx/",
            "vigencia": "Vigente 2026",
        },
        {
            "slug": "demo-legal-cff-69b",
            "ley": "Código Fiscal de la Federación",
            "ordenamiento": "Código Fiscal de la Federación",
            "tipo_fuente": LegalReferenceSource.SourceType.LEY,
            "autoridad_emisora": "DOF",
            "articulo": "69-B",
            "resumen": "Presunción de inexistencia de operaciones y carga probatoria reforzada.",
            "contenido": (
                "Cuando la autoridad detecte que un contribuyente emite CFDI sin activos, personal o capacidad material suficiente, podrá presumir inexistencia de operaciones. "
                "La materialidad se desvirtúa con contratos, bitácoras, evidencia operativa, entregables y trazabilidad del pago."
            ),
            "fuente_documento": "DOF texto vigente 2026",
            "fuente_url": "https://www.dof.gob.mx/",
            "vigencia": "Vigente 2026",
        },
        {
            "slug": "demo-legal-lisr-27-i",
            "ley": "Ley del Impuesto sobre la Renta",
            "ordenamiento": "Ley del Impuesto sobre la Renta",
            "tipo_fuente": LegalReferenceSource.SourceType.LEY,
            "autoridad_emisora": "DOF",
            "articulo": "27",
            "fraccion": "I",
            "resumen": "La deducción exige estricta indispensabilidad y soporte material de la operación.",
            "contenido": (
                "Las deducciones autorizadas deben ser estrictamente indispensables para la actividad del contribuyente. "
                "La documentación del servicio y la relación con el beneficio económico esperado son indispensables para sostener la deducción."
            ),
            "fuente_documento": "DOF texto vigente 2026",
            "fuente_url": "https://www.dof.gob.mx/",
            "vigencia": "Vigente 2026",
        },
        {
            "slug": "demo-legal-liva-1a",
            "ley": "Ley del Impuesto al Valor Agregado",
            "ordenamiento": "Ley del Impuesto al Valor Agregado",
            "tipo_fuente": LegalReferenceSource.SourceType.LEY,
            "autoridad_emisora": "DOF",
            "articulo": "1-A",
            "resumen": "Supuestos de retención de IVA para ciertos servicios.",
            "contenido": (
                "Las personas morales que reciban servicios personales independientes de personas físicas están obligadas, en ciertos supuestos, a efectuar retención de IVA. "
                "La revisión documental debe validar la naturaleza del servicio y el régimen del proveedor."
            ),
            "fuente_documento": "DOF texto vigente 2026",
            "fuente_url": "https://www.dof.gob.mx/",
            "vigencia": "Vigente 2026",
        },
    ]

    def _repo_root(self) -> Path:
        return Path(__file__).resolve().parents[4]

    def _load_real_69b_supplier(self) -> dict[str, str]:
        csv_path = self._repo_root() / "sat_processed" / "sat_69b_combined.csv"
        if not csv_path.exists():
            raise CommandError(f"No se encontró el archivo SAT 69-B en '{csv_path}'")

        with csv_path.open("r", encoding="utf-8", newline="") as handle:
            reader = csv.DictReader(handle)
            rows = {row.get("rfc", "").strip().upper(): row for row in reader if row.get("rfc")}

        for preferred_rfc in self.REAL_69B_PREFERRED_RFCS:
            row = rows.get(preferred_rfc)
            if row:
                return {
                    "rfc": preferred_rfc,
                    "razon_social": (row.get("razon_social") or "").strip(),
                    "situacion": (row.get("situacion") or "").strip(),
                    "estatus": (row.get("estatus") or "").strip(),
                    "articulo": (row.get("articulo") or "").strip(),
                    "fecha_actualizacion": (row.get("fecha_actualizacion") or "").strip(),
                    "source_file": str(csv_path.relative_to(self._repo_root())),
                }

        raise CommandError(
            "No fue posible encontrar un RFC preferido del demo dentro de 'sat_processed/sat_69b_combined.csv'"
        )

    def _demo_actor_emails(self) -> list[str]:
        return [
            "monica.rivera@grupoestrategico.mx",
            "rafael.mejia@operadoralogistica.mx",
            "daniela.castaneda@regionalbajio.mx",
            "compliance@materialidad.online",
            "fiscal@materialidad.online",
            "direccion@materialidad.online",
            "tesoreria@grupoestrategico.mx",
        ]

    def add_arguments(self, parser):
        parser.add_argument(
            "--tenant",
            default="demo",
            help="Slug del tenant a poblar (por defecto: demo)",
        )
        parser.add_argument(
            "--reset",
            action="store_true",
            help="Elimina previamente los registros generados por este seed antes de recrearlos.",
        )
        parser.add_argument(
            "--skip-shared-legal",
            action="store_true",
            help="No altera el compendio legal compartido ni consultas demo en control DB.",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Muestra qué haría el comando sin escribir cambios.",
        )

    def handle(self, *args, **options):
        tenant_slug: str = options["tenant"].strip()
        dry_run: bool = options["dry_run"]
        reset: bool = options["reset"]
        skip_shared_legal: bool = options["skip_shared_legal"]

        if not tenant_slug:
            raise CommandError("Debes indicar un slug de tenant válido")

        try:
            tenant = Tenant.objects.using("default").get(slug=tenant_slug)
        except Tenant.DoesNotExist as exc:
            raise CommandError(f"No existe un tenant con slug '{tenant_slug}'") from exc

        if dry_run:
            self.stdout.write(self.style.WARNING(f"[dry-run] Preparando dataset demo para tenant '{tenant_slug}'"))
            self._print_plan(tenant_slug, skip_shared_legal=skip_shared_legal)
            return

        tenant = TenantContext.activate(tenant_slug)
        alias = tenant.db_alias

        try:
            if reset:
                self._reset_seed_data(alias=alias, tenant_slug=tenant_slug, skip_shared_legal=skip_shared_legal)

            legal_sources = []
            if not skip_shared_legal:
                legal_sources = self._seed_shared_legal_assets(tenant_slug)

            summary = self._seed_tenant_data(alias=alias, tenant_slug=tenant_slug, legal_sources=legal_sources)
            self.stdout.write(self.style.SUCCESS(self._render_summary(tenant_slug, summary)))
        finally:
            TenantContext.clear()

    def _print_plan(self, tenant_slug: str, *, skip_shared_legal: bool) -> None:
        lines = [
            f"Tenant objetivo: {tenant_slug}",
            "- Empresas demo con domicilios, contactos y actividad económica",
            "- Proveedores con distintos perfiles de riesgo SAT / 69-B",
            "- Contratos, documentos, aprobaciones y razón de negocio",
            "- Operaciones, conciliaciones bancarias, entregables y evidencias",
            "- Checklists, alertas operativas y alertas CSD",
            "- Snapshots de dashboard y FDI",
        ]
        if not skip_shared_legal:
            lines.append("- Biblioteca legal compartida y consultas legales demo")
        self.stdout.write("\n".join(lines))

    def _reset_seed_data(self, *, alias: str, tenant_slug: str, skip_shared_legal: bool) -> None:
        self.stdout.write(self.style.WARNING(f"Limpiando dataset demo previo para tenant '{tenant_slug}'..."))

        empresas_qs = Empresa.objects.using(alias).filter(rfc__in=self._empresa_rfcs())
        proveedores_qs = Proveedor.objects.using(alias).filter(rfc__in=self._proveedor_rfcs())
        contratos_qs = Contrato.objects.using(alias).filter(codigo_interno__startswith="DEMO-CTR-")
        operaciones_qs = Operacion.objects.using(alias).filter(referencia_spei__in=["LGL-0304-001", "MAQ-0305-001", "SAAS-0308-001", "RSK-0309-001"])
        cuentas_qs = CuentaBancaria.objects.using(alias).filter(alias__in=["Cuenta operativa MXN", "Tesorería proyectos MXN"])
        estados_qs = EstadoCuenta.objects.using(alias).filter(cuenta__in=cuentas_qs)
        movimientos_qs = MovimientoBancario.objects.using(alias).filter(referencia__startswith="DEMO-SPEI-")

        AlertaOperacion.objects.using(alias).filter(clave_dedupe__startswith="demo-alerta-").delete()
        AlertaCSD.objects.using(alias).filter(empresa__in=empresas_qs, proveedor__in=proveedores_qs).delete()
        EvidenciaMaterial.objects.using(alias).filter(operacion__in=operaciones_qs).delete()
        OperacionEntregable.objects.using(alias).filter(operacion__in=operaciones_qs).delete()
        OperacionConciliacion.objects.using(alias).filter(operacion__in=operaciones_qs).delete()
        RazonNegocioAprobacion.objects.using(alias).filter(contrato__in=contratos_qs).delete()
        ContractDocument.objects.using(alias).filter(contrato__in=contratos_qs).delete()
        TransaccionIntercompania.objects.using(alias).filter(num_operacion_interna__startswith="DEMO-IC-").delete()
        operaciones_qs.delete()
        movimientos_qs.delete()
        estados_qs.delete()
        cuentas_qs.delete()
        contratos_qs.delete()
        proveedores_qs.delete()
        Fedatario.objects.using(alias).filter(numero_notaria__in=["214", "17"], estado__in=["Ciudad de México", "Nuevo León"]).delete()
        empresas_qs.delete()
        Checklist.objects.using(alias).filter(tenant_slug=tenant_slug, nombre__startswith="[DEMO]").delete()
        DeliverableRequirement.objects.using(alias).filter(tenant_slug=tenant_slug, codigo__startswith="DEMO-").delete()
        DashboardSnapshot.objects.using(alias).filter(tenant_slug=tenant_slug).delete()
        FiscalDefenseIndexSnapshot.objects.using(alias).filter(tenant_slug=tenant_slug, source="demo_seed").delete()
        AuditLog.objects.using(alias).filter(actor_email__in=self._demo_actor_emails()).delete()

        if not skip_shared_legal:
            LegalConsultation.objects.using("default").filter(tenant_slug=tenant_slug, ai_model="demo-seed").delete()
            LegalReferenceSource.objects.using("default").filter(slug__startswith="demo-legal-").delete()
            LegalCorpusUpload.objects.using("default").filter(slug__startswith="demo-corpus-").delete()

    def _seed_shared_legal_assets(self, tenant_slug: str) -> list[LegalReferenceSource]:
        upload = LegalCorpusUpload.objects.using("default").filter(slug="demo-corpus-biblioteca-base").first()
        if not upload:
            upload = LegalCorpusUpload.objects.using("default").create(
                titulo="Biblioteca legal demo base",
                slug="demo-corpus-biblioteca-base",
                autoridad=LegalCorpusUpload.Authority.DOF,
                ordenamiento="Compendio demo fiscal vigente",
                tipo_fuente=LegalCorpusUpload.SourceType.LEY,
                estatus=LegalCorpusUpload.ProcessingStatus.COMPLETADO,
                estatus_vigencia=LegalCorpusUpload.VigencyStatus.VIGENTE,
                es_vigente=True,
                force_vigencia=True,
                fecha_ultima_revision=date(2026, 3, 10),
                vigencia="Vigente 2026",
                fuente_documento="Compendio demo Materialidad",
                fuente_url="https://materialidad.online/dashboard/fuentes",
                total_fragmentos=len(self.SHARED_LEGAL_SOURCES),
                fragmentos_procesados=len(self.SHARED_LEGAL_SOURCES),
                metadata={"demo_seed": True},
                processed_at=timezone.now(),
            )
            upload.archivo.save(
                "demo_compendio_base.txt",
                ContentFile("Compendio demo fiscal vigente para tenant demo.".encode("utf-8")),
                save=True,
            )
        else:
            upload.total_fragmentos = len(self.SHARED_LEGAL_SOURCES)
            upload.fragmentos_procesados = len(self.SHARED_LEGAL_SOURCES)
            upload.estatus = LegalCorpusUpload.ProcessingStatus.COMPLETADO
            upload.processed_at = timezone.now()
            upload.save(using="default", update_fields=["total_fragmentos", "fragmentos_procesados", "estatus", "processed_at", "updated_at"])
            if not upload.archivo:
                upload.archivo.save(
                    "demo_compendio_base.txt",
                    ContentFile("Compendio demo fiscal vigente para tenant demo.".encode("utf-8")),
                    save=True,
                )

        sources: list[LegalReferenceSource] = []
        for item in self.SHARED_LEGAL_SOURCES:
            content_hash = hashlib.sha256(item["contenido"].encode("utf-8")).hexdigest()
            vector = build_hashed_embedding(item["contenido"])
            source, _ = LegalReferenceSource.objects.using("default").update_or_create(
                slug=item["slug"],
                defaults={
                    "ley": item["ley"],
                    "ordenamiento": item["ordenamiento"],
                    "tipo_fuente": item["tipo_fuente"],
                    "corpus_upload": upload,
                    "estatus_vigencia": LegalReferenceSource.VigencyStatus.VIGENTE,
                    "es_vigente": True,
                    "fecha_ultima_revision": date(2026, 3, 10),
                    "autoridad_emisora": item["autoridad_emisora"],
                    "articulo": item.get("articulo", ""),
                    "fraccion": item.get("fraccion", ""),
                    "contenido": item["contenido"],
                    "resumen": item["resumen"],
                    "fuente_documento": item["fuente_documento"],
                    "fuente_url": item["fuente_url"],
                    "vigencia": item["vigencia"],
                    "hash_contenido": content_hash,
                    "vectorizacion": vector,
                    "vectorizacion_modelo": HASH_VECTOR_MODEL,
                    "vectorizacion_dim": len(vector),
                    "vectorizado_en": timezone.now(),
                    "metadata": {
                        "demo_seed": True,
                        "parser": "DEMO",
                        "section_type": "ARTICULO",
                    },
                },
            )
            sources.append(source)

        self._seed_demo_legal_consultations(tenant_slug=tenant_slug, sources=sources)
        return sources

    def _seed_demo_legal_consultations(self, *, tenant_slug: str, sources: list[LegalReferenceSource]) -> None:
        LegalConsultation.objects.using("default").filter(tenant_slug=tenant_slug, ai_model="demo-seed").delete()
        payload = [self._reference_payload(source) for source in sources[:3]]
        consultations = [
            {
                "question": "[DEMO] ¿Cómo acreditar materialidad en una consultoría legal estratégica?",
                "context": "Prospecto demo interesado en sustentar consultoría fiscal anual con entregables, minutas y CFDI.",
                "answer": (
                    "## 1. Análisis Normativo\n"
                    "La materialidad de una consultoría legal estratégica se sostiene con razón de negocio, entregables identificables y trazabilidad del pago.\n\n"
                    "## 2. Aplicación al Caso\n"
                    "Debes reunir contrato con alcance, minutas, memo técnico, CFDI, evidencia de reuniones y relación con decisiones del negocio.\n\n"
                    "## 3. Riesgos Identificados\n"
                    "El principal riesgo es que el SAT perciba un servicio genérico o sin capacidad material del proveedor.\n\n"
                    "## 4. Recomendaciones Prácticas\n"
                    "Integra expediente cronológico, valida perfil del proveedor y alinea entregables contra el objeto contractual."
                ),
            },
            {
                "question": "[DEMO] ¿Qué riesgos muestra el demo en operaciones con proveedor listado en 69-B definitivo?",
                "context": "Escenario demo de revisión de proveedor crítico confirmado en 69-B y con expediente insuficiente.",
                "answer": (
                    "## 1. Análisis Normativo\n"
                    "El artículo 69-B CFF desplaza la carga probatoria al contribuyente cuando el proveedor presenta señales de inexistencia de operaciones.\n\n"
                    "## 2. Aplicación al Caso\n"
                    "Una operación con proveedor en listado definitivo exige contención inmediata: suspensión de nuevas órdenes, expediente reforzado, trazabilidad del pago y evaluación de reversión o sustitución.\n\n"
                    "## 3. Riesgos Identificados\n"
                    "Existe riesgo de no deducibilidad, rechazo de acreditamiento de IVA y observaciones de compliance.\n\n"
                    "## 4. Recomendaciones Prácticas\n"
                    "Congelar nuevas operaciones, reforzar expediente y evaluar sustitución del proveedor."
                ),
            },
            {
                "question": "[DEMO] ¿Qué debe contener una acreditación robusta de fecha cierta en contratos críticos?",
                "context": "Caso demo de consultoría con notaría, sello de tiempo y registro público enlazados al expediente.",
                "answer": (
                    "## 1. Análisis Normativo\n"
                    "La fecha cierta fortalece la defendibilidad del contrato cuando existe riesgo de cuestionamiento temporal o de autenticidad documental.\n\n"
                    "## 2. Aplicación al Caso\n"
                    "El expediente debe mostrar fedatario, instrumento, fecha de ratificación, acuse de sello de tiempo y, cuando aplica, folio de registro público.\n\n"
                    "## 3. Riesgos Identificados\n"
                    "Si el contrato carece de esa secuencia, la autoridad puede cuestionar su existencia o su formalización oportuna.\n\n"
                    "## 4. Recomendaciones Prácticas\n"
                    "Mantén el testimonio, acuse/hash y referencias cruzadas dentro del dossier exportable para auditoría y defensa fiscal."
                ),
            },
            {
                "question": "[DEMO] ¿Cómo sostener un convenio intercompany frente a auditoría y fiscal?",
                "context": "Convenio intercompañía con fecha cierta, memo ejecutivo y pendiente de cierre de precios de transferencia.",
                "answer": (
                    "## 1. Análisis Normativo\n"
                    "Un intercompany defendible exige razón de negocio, evidencia de servicios recibidos, criterio arm's length y trazabilidad contractual.\n\n"
                    "## 2. Aplicación al Caso\n"
                    "El demo debe mostrar convenio firmado, fecha cierta, memo ejecutivo, evidencia trimestral y cierre fiscal pendiente claramente identificado.\n\n"
                    "## 3. Riesgos Identificados\n"
                    "El mayor riesgo es cobrar o deducir sin demostrar beneficio económico real y prestación efectiva entre partes relacionadas.\n\n"
                    "## 4. Recomendaciones Prácticas\n"
                    "Acompaña el convenio con evidencia periódica, allocators, estudio PT y aprobaciones escalonadas por compliance y fiscal."
                ),
            },
        ]
        for item in consultations:
            LegalConsultation.objects.using("default").create(
                tenant_slug=tenant_slug,
                user=None,
                question=item["question"],
                context=item["context"],
                answer=item["answer"],
                references=payload,
                ai_model="demo-seed",
            )

    def _seed_tenant_data(self, *, alias: str, tenant_slug: str, legal_sources: list[LegalReferenceSource]) -> SeedSummary:
        today = date(2026, 3, 10)
        now = timezone.now()

        fedatarios = self._seed_fedatarios(alias)
        empresas = self._seed_empresas(alias)
        proveedores = self._seed_proveedores(alias, now=now)
        contratos = self._seed_contratos(alias, empresas=empresas, proveedores=proveedores, fedatarios=fedatarios, today=today)
        cuentas, estados_cuenta, movimientos = self._seed_banking(alias, empresas=empresas, proveedores=proveedores, contratos=contratos, today=today)
        operaciones = self._seed_operaciones(alias, empresas=empresas, proveedores=proveedores, contratos=contratos, today=today)
        self._seed_conciliaciones(alias, operaciones=operaciones, movimientos=movimientos)
        requirements = self._seed_requirements(alias, tenant_slug=tenant_slug)
        checklist = self._seed_checklist(alias, tenant_slug=tenant_slug, today=today)
        entregables = self._seed_entregables(alias, operaciones=operaciones, requirements=requirements, today=today)
        evidencias = self._seed_evidencias(alias, operaciones=operaciones, entregables=entregables, now=now)
        self._seed_aprobaciones(alias, contratos=contratos, now=now)
        self._seed_intercompany(alias, empresas=empresas, contratos=contratos, today=today)
        alert_count = self._seed_alertas(alias, empresas=empresas, proveedores=proveedores, operaciones=operaciones, today=today)
        self._seed_audit_logs(alias, contratos=contratos, operaciones=operaciones, proveedores=proveedores, today=today)
        self._seed_snapshots(alias, tenant_slug=tenant_slug, empresas=empresas, today=today)

        return SeedSummary(
            empresas=len(empresas),
            proveedores=len(proveedores),
            contratos=len(contratos),
            operaciones=len(operaciones),
            movimientos=len(movimientos),
            entregables=len(entregables),
            evidencias=len(evidencias),
            alertas=alert_count,
            consultas=4 if legal_sources else 0,
            fuentes_legales=len(legal_sources),
        )

    def _seed_fedatarios(self, alias: str) -> dict[str, Fedatario]:
        records = {
            "notaria_mx": {
                "nombre": "Lic. Mariana Torres Varela",
                "tipo": Fedatario.TipoFedatario.NOTARIO,
                "numero_notaria": "214",
                "estado": "Ciudad de México",
                "ciudad": "Ciudad de México",
                "direccion": "Av. Paseo de la Reforma 480, Juárez, Cuauhtémoc, CDMX",
                "telefono": "5555001100",
                "telefono_alterno": "5555001199",
                "email": "agenda.notaria214@protocolo-legal.mx",
                "rfc": "TOVM800101AB1",
                "cedula_profesional": "5482110",
                "horario_atencion": "L-V 09:00-18:00",
                "contacto_asistente": "Patricia León",
                "contacto_asistente_tel": "5555001188",
                "contacto_asistente_email": "patricia.leon@protocolo-legal.mx",
                "notas": "Fedatario mock consistente para contratos con fecha cierta y protocolos mercantiles complejos.",
            },
            "corredor_nl": {
                "nombre": "Mtro. Eduardo Salinas Gómez",
                "tipo": Fedatario.TipoFedatario.CORREDOR,
                "numero_notaria": "17",
                "estado": "Nuevo León",
                "ciudad": "Monterrey",
                "direccion": "Av. Constitución 900, Centro, Monterrey, NL",
                "telefono": "8181002200",
                "telefono_alterno": "8181002299",
                "email": "agenda.correduria17@protocolo-legal.mx",
                "rfc": "SAGE790202CD2",
                "cedula_profesional": "6311448",
                "horario_atencion": "L-V 08:30-17:30",
                "contacto_asistente": "Lorena Villarreal",
                "contacto_asistente_tel": "8181002277",
                "contacto_asistente_email": "lorena.villarreal@protocolo-legal.mx",
                "notas": "Fedatario mock especializado en contratos mercantiles, intercompany y ratificación de convenios operativos.",
            },
        }
        result: dict[str, Fedatario] = {}
        for key, defaults in records.items():
            fedatario, _ = Fedatario.objects.using(alias).update_or_create(
                tipo=defaults["tipo"],
                numero_notaria=defaults["numero_notaria"],
                estado=defaults["estado"],
                defaults=defaults,
            )
            result[key] = fedatario
        return result

    def _seed_empresas(self, alias: str) -> dict[str, Empresa]:
        records = {
            "holding": {
                "tipo_persona": "MORAL",
                "razon_social": "Grupo de Estrategia Empresarial, S.A. de C.V.",
                "rfc": "GDE240101AAA",
                "regimen_fiscal": "601 General de Ley Personas Morales",
                "actividad_economica": "Servicios corporativos y administración estratégica",
                "fecha_constitucion": date(2018, 4, 12),
                "calle": "Paseo Empresarial",
                "no_exterior": "180",
                "colonia": "Santa Engracia",
                "codigo_postal": "66267",
                "municipio": "San Pedro Garza García",
                "estado": "Nuevo León",
                "ciudad": "San Pedro Garza García",
                "contacto_nombre": "Mónica Rivera",
                "contacto_puesto": "Directora Jurídica",
                "contacto_email": "monica.rivera@grupoestrategico.mx",
                "contacto_telefono": "8182003000",
                "email_contacto": "monica.rivera@grupoestrategico.mx",
                "telefono_contacto": "8182003000",
            },
            "operadora": {
                "tipo_persona": "MORAL",
                "razon_social": "Operadora Logística del Norte, S.A. de C.V.",
                "rfc": "ODL240101BBB",
                "regimen_fiscal": "601 General de Ley Personas Morales",
                "actividad_economica": "Operación logística y distribución nacional",
                "fecha_constitucion": date(2020, 2, 20),
                "calle": "Circuito Industrial",
                "no_exterior": "45",
                "colonia": "Parque Logístico Norte",
                "codigo_postal": "66600",
                "municipio": "Apodaca",
                "estado": "Nuevo León",
                "ciudad": "Apodaca",
                "contacto_nombre": "Rafael Mejía",
                "contacto_puesto": "Gerente de Operaciones",
                "contacto_email": "rafael.mejia@operadoralogistica.mx",
                "contacto_telefono": "8182003010",
                "email_contacto": "rafael.mejia@operadoralogistica.mx",
                "telefono_contacto": "8182003010",
            },
            "retail": {
                "tipo_persona": "MORAL",
                "razon_social": "Distribuidora Regional del Bajío, S.A. de C.V.",
                "rfc": "DRB240101CCC",
                "regimen_fiscal": "601 General de Ley Personas Morales",
                "actividad_economica": "Comercialización de refacciones y accesorios industriales",
                "fecha_constitucion": date(2021, 6, 15),
                "calle": "Blvd. Comercial",
                "no_exterior": "920",
                "colonia": "Parque Industrial León",
                "codigo_postal": "37299",
                "municipio": "León",
                "estado": "Guanajuato",
                "ciudad": "León",
                "contacto_nombre": "Daniela Castañeda",
                "contacto_puesto": "Directora de Finanzas",
                "contacto_email": "daniela.castaneda@regionalbajio.mx",
                "contacto_telefono": "4779001122",
                "email_contacto": "daniela.castaneda@regionalbajio.mx",
                "telefono_contacto": "4779001122",
            },
        }
        result: dict[str, Empresa] = {}
        for key, defaults in records.items():
            empresa, _ = Empresa.objects.using(alias).update_or_create(rfc=defaults["rfc"], defaults=defaults)
            result[key] = empresa
        return result

    def _seed_proveedores(self, alias: str, *, now) -> dict[str, Proveedor]:
        real_69b = self._load_real_69b_supplier()
        records = {
            "legal": {
                "tipo_persona": "MORAL",
                "razon_social": "Lex Integra Consultoría, S.C.",
                "rfc": "LCI240101AAA",
                "calle": "Río Lerma",
                "no_exterior": "112",
                "colonia": "Cuauhtémoc",
                "codigo_postal": "06500",
                "municipio": "Cuauhtémoc",
                "estado": "Ciudad de México",
                "ciudad": "Ciudad de México",
                "actividad_principal": "Consultoría legal y fiscal",
                "regimen_fiscal": "601 General de Ley Personas Morales",
                "contacto_nombre": "Sofía Marín",
                "contacto_puesto": "Socia directora",
                "contacto_email": "sofia.marin@lexintegra.mx",
                "contacto_telefono": "5557123400",
                "correo_contacto": "sofia.marin@lexintegra.mx",
                "telefono_contacto": "5557123400",
                "estatus_sat": "Activo",
                "estatus_69b": Proveedor.Estatus69B.SIN_COINCIDENCIA,
                "riesgo_fiscal": Proveedor.Riesgo.BAJO,
                "ultima_validacion_sat": now,
                "ultima_validacion_69b": now,
                "detalle_validacion": {"opinion_cumplimiento": "positiva", "source": "demo_seed", "demo_seed": True},
                "riesgos_detectados": [],
                "activos_relevantes": ["Oficina propia", "Biblioteca jurídica", "ERP documental"],
                "personal_clave": ["2 socios", "4 asociados", "1 paralegal"],
                "capacidad_economica_mensual": Decimal("850000.00"),
                "sitio_web": "https://lexintegra.mx",
                "sitio_web_capturas": [
                    "https://materialidad.online/demo/web/lex-integra-home.png",
                    "https://materialidad.online/demo/web/lex-integra-equipo.png",
                ],
                "fotos_domicilio": ["https://materialidad.online/demo/proveedores/lex-integra-oficina.jpg"],
                "notas_capacidad": "Proveedor sólido para mostrar expediente bien sustentado.",
            },
            "maquinaria": {
                "tipo_persona": "MORAL",
                "razon_social": "Maquinaria Productiva del Norte, S.A. de C.V.",
                "rfc": "MPN240101BBB",
                "calle": "Carretera Monterrey-Saltillo",
                "no_exterior": "1450",
                "colonia": "Parque Industrial Derramadero",
                "codigo_postal": "25300",
                "municipio": "Saltillo",
                "estado": "Coahuila",
                "ciudad": "Saltillo",
                "actividad_principal": "Arrendamiento de maquinaria pesada",
                "regimen_fiscal": "601 General de Ley Personas Morales",
                "contacto_nombre": "Jorge Tijerina",
                "contacto_puesto": "Director comercial",
                "contacto_email": "jorge@maquinariadelnorte.mx",
                "contacto_telefono": "8443002211",
                "correo_contacto": "jorge@maquinariadelnorte.mx",
                "telefono_contacto": "8443002211",
                "estatus_sat": "Activo",
                "estatus_69b": Proveedor.Estatus69B.SIN_COINCIDENCIA,
                "riesgo_fiscal": Proveedor.Riesgo.MEDIO,
                "ultima_validacion_sat": now,
                "ultima_validacion_69b": now,
                "detalle_validacion": {"opinion_cumplimiento": "positiva", "demo_seed": True},
                "riesgos_detectados": ["Capacidad ajustada al pico operativo"],
                "activos_relevantes": ["2 excavadoras", "4 retroexcavadoras", "Taller móvil"],
                "personal_clave": ["8 operadores certificados", "1 supervisor de campo"],
                "capacidad_economica_mensual": Decimal("450000.00"),
                "sitio_web": "https://mpn-renta.mx",
                "sitio_web_capturas": ["https://materialidad.online/demo/web/mpn-flota.png"],
                "fotos_domicilio": ["https://materialidad.online/demo/proveedores/mpn-patio.jpg"],
                "notas_capacidad": "Útil para demostrar evaluación de capacidad real vs monto operado.",
            },
            "saas": {
                "tipo_persona": "MORAL",
                "razon_social": "Analítica Digital Compliance, S.A.P.I. de C.V.",
                "rfc": "ADC240101CCC",
                "calle": "Av. Américas",
                "no_exterior": "1297",
                "colonia": "Providencia",
                "codigo_postal": "44630",
                "municipio": "Guadalajara",
                "estado": "Jalisco",
                "ciudad": "Guadalajara",
                "actividad_principal": "Software SaaS para compliance y expedientes",
                "regimen_fiscal": "601 General de Ley Personas Morales",
                "contacto_nombre": "Paula Córdova",
                "contacto_puesto": "Customer Success Lead",
                "contacto_email": "paula.cordova@analyticadigital.mx",
                "contacto_telefono": "3334001199",
                "correo_contacto": "paula.cordova@analyticadigital.mx",
                "telefono_contacto": "3334001199",
                "estatus_sat": "Activo",
                "estatus_69b": Proveedor.Estatus69B.SIN_COINCIDENCIA,
                "riesgo_fiscal": Proveedor.Riesgo.BAJO,
                "ultima_validacion_sat": now,
                "ultima_validacion_69b": now,
                "detalle_validacion": {"opinion_cumplimiento": "positiva", "demo_seed": True},
                "riesgos_detectados": [],
                "activos_relevantes": ["Infraestructura cloud", "SOC2", "Mesa de ayuda 24/7"],
                "personal_clave": ["Equipo DevSecOps", "Mesa de ayuda", "CSM"],
                "capacidad_economica_mensual": Decimal("1200000.00"),
                "sitio_web": "https://analyticadigital.mx",
                "sitio_web_capturas": [
                    "https://materialidad.online/demo/web/adc-dashboard.png",
                    "https://materialidad.online/demo/web/adc-security.png",
                ],
                "notas_capacidad": "Proveedor digital para mostrar evidencia intangible y métricas de uso.",
            },
            "69b_definitivo": {
                "tipo_persona": "MORAL",
                "razon_social": real_69b["razon_social"],
                "rfc": real_69b["rfc"],
                "estado": "",
                "ciudad": "",
                "actividad_principal": "Proveedor identificado en listado definitivo 69-B; sujeto a contención y sustitución.",
                "regimen_fiscal": "",
                "contacto_nombre": "Sin contacto validado",
                "contacto_puesto": "No verificable",
                "contacto_email": "",
                "contacto_telefono": "",
                "correo_contacto": "",
                "telefono_contacto": "",
                "estatus_sat": real_69b["situacion"] or "Listado 69-B",
                "estatus_69b": Proveedor.Estatus69B.DEFINITIVO,
                "riesgo_fiscal": Proveedor.Riesgo.ALTO,
                "ultima_validacion_sat": now,
                "ultima_validacion_69b": now,
                "detalle_validacion": {
                    "opinion_cumplimiento": "negativa",
                    "fuente_69b": real_69b["source_file"],
                    "fecha_actualizacion_fuente": real_69b["fecha_actualizacion"],
                    "articulo": real_69b["articulo"],
                    "demo_seed": True,
                },
                "riesgos_detectados": [
                    f"Proveedor presente en lista {real_69b['articulo']} con estatus {real_69b['estatus']}",
                    "Requiere congelamiento de nuevas operaciones y revisión reforzada del expediente",
                ],
                "activos_relevantes": [],
                "personal_clave": [],
                "capacidad_economica_mensual": Decimal("90000.00"),
                "sitio_web": "",
                "notas_capacidad": "Caso de riesgo anclado a un registro real de 69-B definitivo para demostrar bloqueo, comité y sustitución del proveedor.",
            },
        }
        result: dict[str, Proveedor] = {}
        for key, defaults in records.items():
            if key == "69b_definitivo":
                proveedor = Proveedor.objects.using(alias).filter(rfc__in=[defaults["rfc"], "CAC240101DDD"]).first()
                if proveedor:
                    for field, value in defaults.items():
                        setattr(proveedor, field, value)
                    proveedor.save(using=alias)
                    result[key] = proveedor
                    continue
            proveedor, _ = Proveedor.objects.using(alias).update_or_create(rfc=defaults["rfc"], defaults=defaults)
            result[key] = proveedor
        return result

    def _seed_contratos(self, alias: str, *, empresas: dict[str, Empresa], proveedores: dict[str, Proveedor], fedatarios: dict[str, Fedatario], today: date) -> dict[str, Contrato]:
        templates = {
            template.clave: template
            for template in ContratoTemplate.objects.using(alias).filter(activo=True)[:10]
        }
        records = {
            "consultoria_legal": {
                "empresa": empresas["holding"],
                "proveedor": proveedores["legal"],
                "template": next(iter(templates.values()), None),
                "nombre": "[DEMO] Contrato marco de consultoría legal y fiscal",
                "codigo_interno": "DEMO-CTR-LEGAL-001",
                "categoria": ContratoCategoriaChoices.PROVEEDORES,
                "proceso": ContratoProcesoChoices.GOBIERNO_CORPORATIVO,
                "tipo_empresa": ContratoTipoEmpresaChoices.SERVICIOS,
                "fecha_firma": today - timedelta(days=85),
                "vigencia_inicio": today - timedelta(days=80),
                "vigencia_fin": today + timedelta(days=280),
                "descripcion": "Contrato ejemplo para consultoría legal estratégica con entregables ejecutivos y razón de negocio robusta.",
                "es_marco": True,
                "soporte_documental": "Expediente físico y repositorio SharePoint demo",
                "expediente_externo": "https://materialidad.online/demo/expedientes/consultoria-legal",
                "razon_negocio": "Soportar reestructura contractual, blindaje probatorio y preparación de expediente de materialidad frente a revisiones SAT.",
                "beneficio_economico_esperado": Decimal("2400000.00"),
                "beneficio_fiscal_estimado": Decimal("380000.00"),
                "fecha_cierta_requerida": True,
                "fecha_cierta_obtenida": True,
                "fecha_ratificacion": today - timedelta(days=79),
                "fedatario": fedatarios["notaria_mx"],
                "fedatario_nombre": fedatarios["notaria_mx"].nombre,
                "numero_instrumento": "214/2026/118",
                "registro_publico_folio": "RPC-CDMX-2026-1182",
                "razon_negocio_estado": "APROBADO",
                "razon_negocio_ultimo_rol": RazonNegocioAprobacion.Rol.DIRECTOR,
                "razon_negocio_aprobado_en": timezone.now() - timedelta(days=75),
                "firma_modalidad": Contrato.ModalidadFirma.NOTARIAL,
                "logistica_estado": Contrato.EstadoLogistica.COMPLETADA,
                "fecha_cita_firma": timezone.make_aware(datetime.combine(today - timedelta(days=79), time(11, 0))),
                "lugar_cita": "Notaría 214, CDMX",
                "responsable_logistica": "Oficina Jurídica Corporativa",
                "contacto_responsable": "monica.rivera@grupoestrategico.mx",
                "notas_logistica": "Fecha cierta concluida, expediente digital completo y hash de sello integrado al dossier.",
                "archivo_notariado_url": "https://materialidad.online/demo/notariados/consultoria-legal-testimonio.pdf",
                "sello_tiempo_aplicado": timezone.make_aware(datetime.combine(today - timedelta(days=79), time(13, 42))),
                "sello_tiempo_proveedor": "PSC Materialidad Demo",
                "sello_tiempo_acuse_url": "https://materialidad.online/demo/notariados/consultoria-legal-acuse.txt",
                "registro_publico_url": "https://materialidad.online/demo/notariados/consultoria-legal-rpc.pdf",
                "metadata": {"demo_seed": True, "escenario": "consultoria_legal"},
            },
            "maquinaria": {
                "empresa": empresas["operadora"],
                "proveedor": proveedores["maquinaria"],
                "template": next(iter(templates.values()), None),
                "nombre": "[DEMO] Arrendamiento operativo de retroexcavadoras",
                "codigo_interno": "DEMO-CTR-MAQ-002",
                "categoria": ContratoCategoriaChoices.ACTIVOS,
                "proceso": ContratoProcesoChoices.OPERACIONES,
                "tipo_empresa": ContratoTipoEmpresaChoices.INDUSTRIAL,
                "fecha_firma": today - timedelta(days=45),
                "vigencia_inicio": today - timedelta(days=40),
                "vigencia_fin": today + timedelta(days=140),
                "descripcion": "Contrato de arrendamiento para temporada alta con control de capacidad del proveedor y evidencia de recepción.",
                "es_marco": False,
                "soporte_documental": "Repositorio operativo / evidencia GPS",
                "expediente_externo": "https://materialidad.online/demo/expedientes/maquinaria",
                "razon_negocio": "Aumentar capacidad de operación en proyectos simultáneos sin CAPEX permanente.",
                "beneficio_economico_esperado": Decimal("1650000.00"),
                "beneficio_fiscal_estimado": Decimal("190000.00"),
                "fecha_cierta_requerida": False,
                "fecha_cierta_obtenida": False,
                "firma_modalidad": Contrato.ModalidadFirma.ELECTRONICA,
                "logistica_estado": Contrato.EstadoLogistica.COMPLETADA,
                "responsable_logistica": "Compras Operativas",
                "contacto_responsable": "rafael.mejia@operadoralogistica.mx",
                "metadata": {"demo_seed": True, "escenario": "arrendamiento_maquinaria"},
            },
            "saas": {
                "empresa": empresas["retail"],
                "proveedor": proveedores["saas"],
                "template": next(iter(templates.values()), None),
                "nombre": "[DEMO] Suscripción SaaS de compliance documental",
                "codigo_interno": "DEMO-CTR-SAAS-003",
                "categoria": ContratoCategoriaChoices.PROVEEDORES,
                "proceso": ContratoProcesoChoices.OPERACIONES,
                "tipo_empresa": ContratoTipoEmpresaChoices.COMERCIAL,
                "fecha_firma": today - timedelta(days=20),
                "vigencia_inicio": today - timedelta(days=18),
                "vigencia_fin": today + timedelta(days=347),
                "descripcion": "Contrato de software con SLA, control de accesos y entregables intangibles medibles.",
                "es_marco": False,
                "soporte_documental": "Suite de evidencia digital y tickets",
                "expediente_externo": "https://materialidad.online/demo/expedientes/saas",
                "razon_negocio": "Centralizar expedientes probatorios y acelerar tiempos de revisión en compras y compliance.",
                "beneficio_economico_esperado": Decimal("980000.00"),
                "beneficio_fiscal_estimado": Decimal("110000.00"),
                "fecha_cierta_requerida": False,
                "fecha_cierta_obtenida": False,
                "razon_negocio_estado": "APROBADO",
                "razon_negocio_ultimo_rol": RazonNegocioAprobacion.Rol.DIRECTOR,
                "razon_negocio_aprobado_en": timezone.now() - timedelta(days=14),
                "firma_modalidad": Contrato.ModalidadFirma.ELECTRONICA,
                "logistica_estado": Contrato.EstadoLogistica.COMPLETADA,
                "responsable_logistica": "TI / Compliance",
                "contacto_responsable": "daniela.castaneda@regionalbajio.mx",
                "metadata": {"demo_seed": True, "escenario": "saas_compliance"},
            },
            "riesgo_69b": {
                "empresa": empresas["holding"],
                "proveedor": proveedores["69b_definitivo"],
                "template": next(iter(templates.values()), None),
                "nombre": "[DEMO] Contrato marco de abastecimiento administrativo en contención",
                "codigo_interno": "DEMO-CTR-RSK-005",
                "categoria": ContratoCategoriaChoices.PROVEEDORES,
                "proceso": ContratoProcesoChoices.OPERACIONES,
                "tipo_empresa": ContratoTipoEmpresaChoices.SERVICIOS,
                "fecha_firma": today - timedelta(days=32),
                "vigencia_inicio": today - timedelta(days=30),
                "vigencia_fin": today + timedelta(days=150),
                "descripcion": "Contrato sembrado para demostrar detección tardía de un proveedor listado en 69-B definitivo y la reacción institucional.",
                "es_marco": False,
                "soporte_documental": "Expediente en contención / comité fiscal",
                "expediente_externo": "https://materialidad.online/demo/expedientes/riesgo-69b-definitivo",
                "razon_negocio": "Atender una demanda extraordinaria de abastecimiento administrativo y soporte operativo para cierres de mes.",
                "beneficio_economico_esperado": Decimal("410000.00"),
                "beneficio_fiscal_estimado": Decimal("65000.00"),
                "fecha_cierta_requerida": False,
                "fecha_cierta_obtenida": False,
                "razon_negocio_estado": "RECHAZADO",
                "razon_negocio_ultimo_rol": RazonNegocioAprobacion.Rol.FISCAL,
                "firma_modalidad": Contrato.ModalidadFirma.ELECTRONICA,
                "logistica_estado": Contrato.EstadoLogistica.COMPLETADA,
                "responsable_logistica": "Tesorería Corporativa",
                "contacto_responsable": "tesoreria@grupoestrategico.mx",
                "notas_logistica": "Se mantiene únicamente para trazar la detección y el bloqueo del caso en 69-B.",
                "metadata": {"demo_seed": True, "escenario": "riesgo_69b"},
            },
            "intercompany": {
                "empresa": empresas["holding"],
                "proveedor": None,
                "template": next(iter(templates.values()), None),
                "nombre": "[DEMO] Convenio intercompañía de servicios corporativos",
                "codigo_interno": "DEMO-CTR-IC-004",
                "categoria": ContratoCategoriaChoices.PARTES_RELACIONADAS,
                "proceso": ContratoProcesoChoices.TESORERIA,
                "tipo_empresa": ContratoTipoEmpresaChoices.MIXTA,
                "fecha_firma": today - timedelta(days=60),
                "vigencia_inicio": today - timedelta(days=60),
                "vigencia_fin": today + timedelta(days=305),
                "descripcion": "Convenio modelo para cargos corporativos y administración compartida entre entidades del grupo.",
                "es_marco": True,
                "soporte_documental": "Estudio de precios de transferencia y board memo",
                "expediente_externo": "https://materialidad.online/demo/expedientes/intercompany",
                "razon_negocio": "Centralizar funciones administrativas en holding para reducir duplicidades y elevar control interno.",
                "beneficio_economico_esperado": Decimal("3100000.00"),
                "beneficio_fiscal_estimado": Decimal("250000.00"),
                "fecha_cierta_requerida": True,
                "fecha_cierta_obtenida": True,
                "fecha_ratificacion": today - timedelta(days=58),
                "fedatario": fedatarios["corredor_nl"],
                "fedatario_nombre": fedatarios["corredor_nl"].nombre,
                "numero_instrumento": "17/2026/44",
                "razon_negocio_estado": "EN_PROCESO",
                "razon_negocio_ultimo_rol": RazonNegocioAprobacion.Rol.COMPLIANCE,
                "firma_modalidad": Contrato.ModalidadFirma.NOTARIAL,
                "logistica_estado": Contrato.EstadoLogistica.COMPLETADA,
                "responsable_logistica": "Tesorería Corporativa",
                "contacto_responsable": "monica.rivera@grupoestrategico.mx",
                "archivo_notariado_url": "https://materialidad.online/demo/notariados/intercompany-testimonio.pdf",
                "sello_tiempo_aplicado": timezone.make_aware(datetime.combine(today - timedelta(days=58), time(10, 15))),
                "sello_tiempo_proveedor": "PSC Materialidad Demo",
                "sello_tiempo_acuse_url": "https://materialidad.online/demo/notariados/intercompany-acuse.txt",
                "registro_publico_url": "https://materialidad.online/demo/notariados/intercompany-rpc.pdf",
                "metadata": {"demo_seed": True, "escenario": "intercompany"},
            },
        }
        result: dict[str, Contrato] = {}
        for key, defaults in records.items():
            contrato, _ = Contrato.objects.using(alias).update_or_create(
                empresa=defaults["empresa"],
                codigo_interno=defaults["codigo_interno"],
                defaults=defaults,
            )
            self._ensure_contract_document(alias, contrato, key)
            result[key] = contrato
        return result

    def _ensure_contract_document(self, alias: str, contrato: Contrato, scenario: str) -> None:
        markdown = {
            "consultoria_legal": "# Contrato Marco de Consultoría Legal\n\n## Objeto\nPrestación de servicios de consultoría legal y fiscal con entregables ejecutivos.\n\n## Entregables\n- Memo técnico\n- Minutas\n- Matriz de riesgo\n",
            "maquinaria": "# Arrendamiento de Retroexcavadoras\n\n## Objeto\nArrendamiento temporal de maquinaria con operadores certificados.\n\n## Evidencia\n- GPS\n- Bitácoras\n- Actas de entrega\n",
            "saas": "# Suscripción SaaS de Compliance\n\n## Alcance\nPlataforma documental con SLA y soporte funcional.\n\n## KPI\n- Usuarios activos\n- Tickets resueltos\n- Disponibilidad\n",
            "riesgo_69b": "# Contrato en Contención por Riesgo 69-B\n\n## Objeto\nAbastecimiento administrativo y soporte operativo de corta duración.\n\n## Hallazgos\n- Proveedor identificado en 69-B definitivo\n- Entregables inconsistentes\n- Comité fiscal ordena sustitución y congelamiento\n",
            "intercompany": "# Convenio Intercompañía\n\n## Servicios corporativos\nCentralización de funciones administrativas, control interno y compliance.\n",
        }[scenario]
        document, _ = ContractDocument.objects.using(alias).update_or_create(
            contrato=contrato,
            kind=ContractDocument.Kind.DEFINITIVO_AI,
            defaults={
                "source": ContractDocument.Source.MANUAL,
                "idioma": "es",
                "tono": "formal",
                "modelo": "demo-seed",
                "archivo_nombre": f"{slugify(contrato.nombre)}.md",
                "markdown_text": markdown,
                "extracted_text": markdown,
                "metadata": {"demo_seed": True, "scenario": scenario},
            },
        )
        if not document.archivo:
            document.archivo.save(
                f"{slugify(contrato.nombre)}.md",
                ContentFile(markdown.encode("utf-8")),
                save=True,
            )

    def _seed_banking(self, alias: str, *, empresas: dict[str, Empresa], proveedores: dict[str, Proveedor], contratos: dict[str, Contrato], today: date):
        cuentas = {
            "holding_mxn": CuentaBancaria.objects.using(alias).update_or_create(
                empresa=empresas["holding"],
                alias="Cuenta operativa MXN",
                defaults={
                    "banco": "BBVA",
                    "numero_cuenta": "0011223344",
                    "clabe": "012180001122334455",
                    "moneda": Operacion.Moneda.MXN,
                    "titular": empresas["holding"].razon_social,
                    "es_principal": True,
                    "metadata": {"demo_seed": True},
                },
            )[0],
            "operadora_mxn": CuentaBancaria.objects.using(alias).update_or_create(
                empresa=empresas["operadora"],
                alias="Tesorería proyectos MXN",
                defaults={
                    "banco": "Banorte",
                    "numero_cuenta": "7788990011",
                    "clabe": "072580778899001122",
                    "moneda": Operacion.Moneda.MXN,
                    "titular": empresas["operadora"].razon_social,
                    "es_principal": True,
                    "metadata": {"demo_seed": True},
                },
            )[0],
        }

        estados = {
            "holding_marzo": EstadoCuenta.objects.using(alias).update_or_create(
                cuenta=cuentas["holding_mxn"],
                periodo_inicio=date(2026, 3, 1),
                periodo_fin=date(2026, 3, 31),
                defaults={
                    "archivo_url": "https://materialidad.online/demo/estados/holding-marzo-2026.pdf",
                    "hash_archivo": "demo-holding-marzo-2026",
                    "saldo_inicial": Decimal("2450000.00"),
                    "saldo_final": Decimal("1985000.00"),
                    "total_abonos": Decimal("780000.00"),
                    "total_cargos": Decimal("1245000.00"),
                    "metadata": {"demo_seed": True},
                },
            )[0],
            "operadora_marzo": EstadoCuenta.objects.using(alias).update_or_create(
                cuenta=cuentas["operadora_mxn"],
                periodo_inicio=date(2026, 3, 1),
                periodo_fin=date(2026, 3, 31),
                defaults={
                    "archivo_url": "https://materialidad.online/demo/estados/operadora-marzo-2026.pdf",
                    "hash_archivo": "demo-operadora-marzo-2026",
                    "saldo_inicial": Decimal("980000.00"),
                    "saldo_final": Decimal("635000.00"),
                    "total_abonos": Decimal("410000.00"),
                    "total_cargos": Decimal("755000.00"),
                    "metadata": {"demo_seed": True},
                },
            )[0],
        }

        movement_specs = [
            {
                "key": "honorarios_legal",
                "estado_cuenta": estados["holding_marzo"],
                "cuenta": cuentas["holding_mxn"],
                "fecha": today - timedelta(days=6),
                "monto": Decimal("185000.00"),
                "tipo": MovimientoBancario.Tipo.CARGO,
                "referencia": "DEMO-SPEI-LEGAL-001",
                "descripcion": "Pago honorarios consultoría legal marzo",
                "nombre_contraparte": proveedores["legal"].razon_social,
                "banco_contraparte": "BBVA",
                "spei_referencia": "LGL-0304-001",
                "categoria": "Honorarios",
            },
            {
                "key": "anticipo_maquinaria",
                "estado_cuenta": estados["operadora_marzo"],
                "cuenta": cuentas["operadora_mxn"],
                "fecha": today - timedelta(days=5),
                "monto": Decimal("260000.00"),
                "tipo": MovimientoBancario.Tipo.CARGO,
                "referencia": "DEMO-SPEI-MAQ-001",
                "descripcion": "Anticipo arrendamiento maquinaria",
                "nombre_contraparte": proveedores["maquinaria"].razon_social,
                "banco_contraparte": "Banorte",
                "spei_referencia": "MAQ-0305-001",
                "categoria": "Arrendamiento",
            },
            {
                "key": "suscripcion_saas",
                "estado_cuenta": estados["holding_marzo"],
                "cuenta": cuentas["holding_mxn"],
                "fecha": today - timedelta(days=2),
                "monto": Decimal("92000.00"),
                "tipo": MovimientoBancario.Tipo.CARGO,
                "referencia": "DEMO-SPEI-SAAS-001",
                "descripcion": "Licencias plataforma compliance documental",
                "nombre_contraparte": proveedores["saas"].razon_social,
                "banco_contraparte": "Santander",
                "spei_referencia": "SAAS-0308-001",
                "categoria": "Software",
            },
            {
                "key": "pago_riesgoso",
                "estado_cuenta": estados["holding_marzo"],
                "cuenta": cuentas["holding_mxn"],
                "fecha": today - timedelta(days=1),
                "monto": Decimal("145000.00"),
                "tipo": MovimientoBancario.Tipo.CARGO,
                "referencia": "DEMO-SPEI-RISK-001",
                "descripcion": "Pago a proveedor administrativo sin soporte suficiente",
                "nombre_contraparte": proveedores["69b_definitivo"].razon_social,
                "banco_contraparte": "Banco genérico",
                "spei_referencia": "RSK-0309-001",
                "categoria": "Servicios varios",
                "alerta_capacidad": True,
            },
        ]
        movimientos: dict[str, MovimientoBancario] = {}
        for item in movement_specs:
            movement, _ = MovimientoBancario.objects.using(alias).update_or_create(
                cuenta=item["cuenta"],
                referencia=item["referencia"],
                defaults={
                    "estado_cuenta": item["estado_cuenta"],
                    "fecha": item["fecha"],
                    "monto": item["monto"],
                    "tipo": item["tipo"],
                    "descripcion": item["descripcion"],
                    "nombre_contraparte": item["nombre_contraparte"],
                    "banco_contraparte": item["banco_contraparte"],
                    "spei_referencia": item["spei_referencia"],
                    "categoria": item["categoria"],
                    "alerta_capacidad": item.get("alerta_capacidad", False),
                    "metadata": {"demo_seed": True},
                },
            )
            movimientos[item["key"]] = movement
        return cuentas, estados, movimientos

    def _seed_operaciones(self, alias: str, *, empresas: dict[str, Empresa], proveedores: dict[str, Proveedor], contratos: dict[str, Contrato], today: date) -> dict[str, Operacion]:
        records = {
            "legal_ok": {
                "empresa": empresas["holding"],
                "proveedor": proveedores["legal"],
                "contrato": contratos["consultoria_legal"],
                "uuid_cfdi": "11111111-1111-4111-8111-111111111112",
                "monto": Decimal("185000.0000"),
                "moneda": Operacion.Moneda.MXN,
                "fecha_operacion": today - timedelta(days=6),
                "tipo_operacion": Operacion.TipoOperacion.SERVICIO,
                "concepto": "Consultoría legal estratégica trimestral y memo de materialidad",
                "estatus_validacion": Operacion.EstatusValidacion.VALIDADO,
                "detalles_validacion": {"score": 94, "demo_seed": True},
                "metadata": {"demo_seed": True, "tipo_gasto": "Consultoría legal"},
                "ultima_validacion": timezone.now() - timedelta(days=5),
                "ultima_validacion_cfdi": timezone.now() - timedelta(days=5),
                "ultima_validacion_spei": timezone.now() - timedelta(days=5),
                "referencia_spei": "LGL-0304-001",
                "nif_aplicable": "NIF D-5",
                "poliza_contable": "https://materialidad.online/demo/polizas/legal-ok.pdf",
                "observacion_contable": "Servicio cargado a centro de costo jurídico corporativo.",
                "cfdi_estatus": Operacion.EstatusCFDI.VALIDO,
                "spei_estatus": Operacion.EstatusSPEI.VALIDADO,
                "creado_por_email": "demo@materialidad.online",
            },
            "maquinaria_proceso": {
                "empresa": empresas["operadora"],
                "proveedor": proveedores["maquinaria"],
                "contrato": contratos["maquinaria"],
                "uuid_cfdi": "22222222-2222-4222-8222-222222222222",
                "monto": Decimal("260000.0000"),
                "moneda": Operacion.Moneda.MXN,
                "fecha_operacion": today - timedelta(days=5),
                "tipo_operacion": Operacion.TipoOperacion.ARRENDAMIENTO,
                "concepto": "Renta de retroexcavadoras para proyecto Monterrey Sur",
                "estatus_validacion": Operacion.EstatusValidacion.EN_PROCESO,
                "detalles_validacion": {"score": 68, "faltantes": ["acta_entrega", "fotos_georreferenciadas"], "demo_seed": True},
                "metadata": {"demo_seed": True, "tipo_gasto": "Arrendamiento de maquinaria"},
                "ultima_validacion": timezone.now() - timedelta(days=1),
                "ultima_validacion_cfdi": timezone.now() - timedelta(days=1),
                "ultima_validacion_spei": timezone.now() - timedelta(days=1),
                "referencia_spei": "MAQ-0305-001",
                "nif_aplicable": "NIF C-6",
                "poliza_contable": "https://materialidad.online/demo/polizas/maquinaria-proceso.pdf",
                "observacion_contable": "Pendiente validar evidencia de recepción física del activo arrendado.",
                "cfdi_estatus": Operacion.EstatusCFDI.VALIDO,
                "spei_estatus": Operacion.EstatusSPEI.VALIDADO,
                "creado_por_email": "demo@materialidad.online",
            },
            "saas_ok": {
                "empresa": empresas["retail"],
                "proveedor": proveedores["saas"],
                "contrato": contratos["saas"],
                "uuid_cfdi": "33333333-3333-4333-8333-333333333334",
                "monto": Decimal("92000.0000"),
                "moneda": Operacion.Moneda.MXN,
                "fecha_operacion": today - timedelta(days=2),
                "tipo_operacion": Operacion.TipoOperacion.SERVICIO,
                "concepto": "Licencias SaaS y onboarding de plataforma compliance documental",
                "estatus_validacion": Operacion.EstatusValidacion.VALIDADO,
                "detalles_validacion": {"score": 89, "demo_seed": True},
                "metadata": {"demo_seed": True, "tipo_gasto": "Software / SaaS"},
                "ultima_validacion": timezone.now() - timedelta(days=1),
                "ultima_validacion_cfdi": timezone.now() - timedelta(days=1),
                "ultima_validacion_spei": timezone.now() - timedelta(days=1),
                "referencia_spei": "SAAS-0308-001",
                "nif_aplicable": "NIF C-8",
                "poliza_contable": "https://materialidad.online/demo/polizas/saas-ok.pdf",
                "observacion_contable": "Activo intangible de bajo materiality, pago mensual recurrente.",
                "cfdi_estatus": Operacion.EstatusCFDI.VALIDO,
                "spei_estatus": Operacion.EstatusSPEI.VALIDADO,
                "creado_por_email": "demo@materialidad.online",
            },
            "riesgo_69b": {
                "empresa": empresas["holding"],
                "proveedor": proveedores["69b_definitivo"],
                "contrato": contratos["riesgo_69b"],
                "uuid_cfdi": "44444444-4444-4444-8444-444444444445",
                "monto": Decimal("145000.0000"),
                "moneda": Operacion.Moneda.MXN,
                "fecha_operacion": today - timedelta(days=1),
                "tipo_operacion": Operacion.TipoOperacion.SERVICIO,
                "concepto": "Servicios de abastecimiento administrativo con proveedor listado en 69-B definitivo",
                "estatus_validacion": Operacion.EstatusValidacion.RECHAZADO,
                "detalles_validacion": {"score": 18, "hallazgos": ["Proveedor definitivo 69-B", "Sin entregables concluyentes", "Razon de negocio rechazada"], "demo_seed": True},
                "metadata": {"demo_seed": True, "tipo_gasto": "Proveedor con alerta 69-B", "razon_negocio": "Solicitud extraordinaria hoy rechazada por comité fiscal"},
                "ultima_validacion": timezone.now(),
                "ultima_validacion_cfdi": timezone.now(),
                "ultima_validacion_spei": timezone.now(),
                "referencia_spei": "RSK-0309-001",
                "nif_aplicable": "NIF D-5",
                "poliza_contable": "https://materialidad.online/demo/polizas/riesgo-69b.pdf",
                "observacion_contable": "Operación bloqueada para efectos de deducción hasta sustituir proveedor y documentar reversión/contención.",
                "cfdi_estatus": Operacion.EstatusCFDI.INVALIDO,
                "spei_estatus": Operacion.EstatusSPEI.VALIDADO,
                "creado_por_email": "demo@materialidad.online",
            },
        }
        result: dict[str, Operacion] = {}
        for key, defaults in records.items():
            operacion, _ = Operacion.objects.using(alias).update_or_create(
                empresa=defaults["empresa"],
                referencia_spei=defaults["referencia_spei"],
                defaults=defaults,
            )
            result[key] = operacion
        return result

    def _seed_conciliaciones(self, alias: str, *, operaciones: dict[str, Operacion], movimientos: dict[str, MovimientoBancario]) -> None:
        mapping = {
            "legal_ok": ("honorarios_legal", OperacionConciliacion.Estado.AUTO, Decimal("97.50"), "Conciliación automática por SPEI y CFDI."),
            "maquinaria_proceso": ("anticipo_maquinaria", OperacionConciliacion.Estado.MANUAL, Decimal("82.00"), "Conciliación manual pendiente de evidencia de recepción."),
            "saas_ok": ("suscripcion_saas", OperacionConciliacion.Estado.AUTO, Decimal("95.00"), "Pago recurrente conciliado por referencia y contrato."),
            "riesgo_69b": ("pago_riesgoso", OperacionConciliacion.Estado.MANUAL, Decimal("54.00"), "Pago localizado pero operación rechazada por alto riesgo fiscal."),
        }
        for op_key, (mov_key, estado, confianza, comentario) in mapping.items():
            OperacionConciliacion.objects.using(alias).update_or_create(
                operacion=operaciones[op_key],
                defaults={
                    "movimiento": movimientos[mov_key],
                    "estado": estado,
                    "confianza": confianza,
                    "comentario": comentario,
                },
            )

    def _seed_requirements(self, alias: str, *, tenant_slug: str) -> dict[str, DeliverableRequirement]:
        result: dict[str, DeliverableRequirement] = {}
        for item in self.DEMO_REQUIREMENTS:
            requirement, _ = DeliverableRequirement.objects.using(alias).update_or_create(
                tenant_slug=tenant_slug,
                tipo_gasto=item["tipo_gasto"],
                codigo=item["codigo"],
                defaults={
                    "titulo": item["titulo"],
                    "descripcion": item["descripcion"],
                    "pillar": item["pillar"],
                    "requerido": True,
                },
            )
            result[item["codigo"]] = requirement
        return result

    def _seed_checklist(self, alias: str, *, tenant_slug: str, today: date) -> Checklist:
        checklist, _ = Checklist.objects.using(alias).update_or_create(
            tenant_slug=tenant_slug,
            nombre="[DEMO] Expediente de consultoría fiscal estratégica",
            defaults={
                "tipo_gasto": "Consultoría legal",
                "vigente": True,
            },
        )
        items = [
            (CompliancePillar.RAZON_NEGOCIO, "Narrativa de razón de negocio aprobada", "Explica el beneficio económico esperado y la conexión con la estrategia fiscal.", ChecklistItem.Estado.COMPLETO, today + timedelta(days=12), "Dirección jurídica"),
            (CompliancePillar.ENTREGABLES, "Memo técnico firmado por socio responsable", "Documento técnico que vincula entregables y decisiones adoptadas.", ChecklistItem.Estado.COMPLETO, today + timedelta(days=4), "Proveedor / Legal"),
            (CompliancePillar.CAPACIDAD_PROVEEDOR, "Validación de capacidad del proveedor", "Evidencia de equipo, personal, oficina y web del proveedor.", ChecklistItem.Estado.EN_PROCESO, today + timedelta(days=6), "Compliance"),
            (CompliancePillar.FECHA_CIERTA, "Ratificación con fedatario", "Fecha cierta para piezas contractuales críticas.", ChecklistItem.Estado.COMPLETO, today + timedelta(days=1), "Jurídico corporativo"),
        ]
        for pillar, titulo, descripcion, estado, vence_el, responsable in items:
            ChecklistItem.objects.using(alias).update_or_create(
                checklist=checklist,
                titulo=titulo,
                defaults={
                    "pillar": pillar,
                    "descripcion": descripcion,
                    "requerido": True,
                    "estado": estado,
                    "vence_el": vence_el,
                    "responsable": responsable,
                },
            )
        return checklist

    def _seed_entregables(self, alias: str, *, operaciones: dict[str, Operacion], requirements: dict[str, DeliverableRequirement], today: date) -> dict[str, OperacionEntregable]:
        specs = [
            ("legal_contract", operaciones["legal_ok"], requirements["DEMO-CONS-01"], OperacionEntregable.Estado.RECIBIDO, today - timedelta(days=10), today - timedelta(days=8), today - timedelta(days=7), None, "OC-LEGAL-2026-01", today - timedelta(days=12), "Expediente contractual completo"),
            ("legal_bitacora", operaciones["legal_ok"], requirements["DEMO-CONS-02"], OperacionEntregable.Estado.RECIBIDO, today - timedelta(days=6), today - timedelta(days=5), today - timedelta(days=5), None, "OC-LEGAL-2026-01", today - timedelta(days=12), "Minutas y acuerdos cargados"),
            ("legal_memo", operaciones["legal_ok"], requirements["DEMO-CONS-03"], OperacionEntregable.Estado.FACTURADO, today - timedelta(days=4), today - timedelta(days=3), today - timedelta(days=3), today - timedelta(days=2), "OC-LEGAL-2026-01", today - timedelta(days=12), "Memo técnico vinculado a la factura"),
            ("maq_recepcion", operaciones["maquinaria_proceso"], requirements["DEMO-ARR-01"], OperacionEntregable.Estado.EN_PROCESO, today - timedelta(days=4), None, None, None, "OC-MAQ-2026-18", today - timedelta(days=6), "Pendientes acta y fotos georreferenciadas"),
            ("saas_uso", operaciones["saas_ok"], requirements["DEMO-SAAS-01"], OperacionEntregable.Estado.RECIBIDO, today - timedelta(days=2), today - timedelta(days=1), today - timedelta(days=1), None, "OC-SAAS-2026-08", today - timedelta(days=3), "Exportes de usuarios y tickets entregados"),
            ("risk_committee", operaciones["riesgo_69b"], requirements["DEMO-RSK-01"], OperacionEntregable.Estado.EN_PROCESO, today + timedelta(days=1), None, None, None, "OC-RSK-2026-02", today - timedelta(days=1), "Existe comité de crisis, pero el expediente sigue incompleto y la sustitución del proveedor está en proceso"),
        ]
        result: dict[str, OperacionEntregable] = {}
        for key, operacion, requirement, estado, compromiso, entregado, recepcion, factura, oc_numero, oc_fecha, comentarios in specs:
            entregable, _ = OperacionEntregable.objects.using(alias).update_or_create(
                operacion=operacion,
                codigo=requirement.codigo,
                defaults={
                    "requirement": requirement,
                    "titulo": requirement.titulo,
                    "descripcion": requirement.descripcion,
                    "tipo_gasto": requirement.tipo_gasto,
                    "pillar": requirement.pillar,
                    "requerido": requirement.requerido,
                    "estado": estado,
                    "fecha_compromiso": compromiso,
                    "fecha_entregado": entregado,
                    "fecha_recepcion": recepcion,
                    "fecha_factura": factura,
                    "oc_numero": oc_numero,
                    "oc_fecha": oc_fecha,
                    "oc_archivo_url": f"https://materialidad.online/demo/oc/{slugify(oc_numero)}.pdf",
                    "recepcion_firmado_por": "Equipo demo",
                    "recepcion_firmado_email": "demo@materialidad.online",
                    "comentarios": comentarios,
                    "metadata": {"demo_seed": True},
                },
            )
            result[key] = entregable
        return result

    def _seed_evidencias(self, alias: str, *, operaciones: dict[str, Operacion], entregables: dict[str, OperacionEntregable], now) -> dict[str, EvidenciaMaterial]:
        specs = [
            ("memo_pdf", operaciones["legal_ok"], EvidenciaMaterial.Tipo.ENTREGABLE, "Memo legal estratégico marzo 2026", EvidenciaMaterial.EstatusRevision.VALIDADA, "Resumen ejecutivo con postura fiscal y mapa probatorio."),
            ("bitacora_legal", operaciones["legal_ok"], EvidenciaMaterial.Tipo.BITACORA, "Minuta de sesión con dirección jurídica", EvidenciaMaterial.EstatusRevision.VALIDADA, "Sesión del comité con acuerdos y responsables."),
            ("maq_foto", operaciones["maquinaria_proceso"], EvidenciaMaterial.Tipo.FOTOGRAFIA, "Fotografía de retroexcavadora en sitio", EvidenciaMaterial.EstatusRevision.OBSERVADA, "Imagen de recepción sin sello de ubicación."),
            ("saas_entregable", operaciones["saas_ok"], EvidenciaMaterial.Tipo.ENTREGABLE, "Reporte ejecutivo de adopción SaaS", EvidenciaMaterial.EstatusRevision.VALIDADA, "Entregable con usuarios activos, flujos completados y tickets resueltos por unidad de negocio."),
            ("saas_ticket", operaciones["saas_ok"], EvidenciaMaterial.Tipo.COMUNICACION, "Reporte de tickets y onboarding", EvidenciaMaterial.EstatusRevision.VALIDADA, "Exporte de tickets resueltos y usuarios capacitados."),
            ("risk_committee_mail", operaciones["riesgo_69b"], EvidenciaMaterial.Tipo.COMUNICACION, "Correo de congelamiento y comité fiscal", EvidenciaMaterial.EstatusRevision.OBSERVADA, "Se instruye congelar nuevas operaciones, revisar reversión del pago y presentar sustitución del proveedor al comité fiscal."),
        ]
        result: dict[str, EvidenciaMaterial] = {}
        for key, operacion, tipo, descripcion, estatus, text in specs:
            evidencia, _ = EvidenciaMaterial.objects.using(alias).update_or_create(
                operacion=operacion,
                tipo=tipo,
                descripcion=descripcion,
                defaults={
                    "estatus_revision": estatus,
                    "validado_en": now if estatus == EvidenciaMaterial.EstatusRevision.VALIDADA else None,
                    "validado_por_email": "compliance@materialidad.online" if estatus == EvidenciaMaterial.EstatusRevision.VALIDADA else "",
                    "metadata": {"demo_seed": True},
                },
            )
            if not evidencia.archivo:
                evidencia.archivo.save(
                    f"{slugify(descripcion)}.txt",
                    ContentFile(text.encode("utf-8")),
                    save=True,
                )
            result[key] = evidencia
        return result

    def _seed_aprobaciones(self, alias: str, *, contratos: dict[str, Contrato], now) -> None:
        matrix = {
            "consultoria_legal": [
                (RazonNegocioAprobacion.Rol.SOLICITANTE, RazonNegocioAprobacion.Estado.APROBADO, "Solicitud sustentada con plan de trabajo.", "monica.rivera@grupoestrategico.mx"),
                (RazonNegocioAprobacion.Rol.AREA, RazonNegocioAprobacion.Estado.APROBADO, "El servicio soporta decisiones de reorganización contractual.", "rafael.mejia@operadoralogistica.mx"),
                (RazonNegocioAprobacion.Rol.COMPLIANCE, RazonNegocioAprobacion.Estado.APROBADO, "Expediente suficiente para revisión inicial.", "compliance@materialidad.online"),
                (RazonNegocioAprobacion.Rol.FISCAL, RazonNegocioAprobacion.Estado.APROBADO, "Consistente con art. 5-A y 27 LISR.", "fiscal@materialidad.online"),
                (RazonNegocioAprobacion.Rol.DIRECTOR, RazonNegocioAprobacion.Estado.APROBADO, "Autorizado por comité demo.", "direccion@materialidad.online"),
            ],
            "saas": [
                (RazonNegocioAprobacion.Rol.SOLICITANTE, RazonNegocioAprobacion.Estado.APROBADO, "El SaaS centraliza expedientes y reduce tiempos de atención a revisiones.", "daniela.castaneda@regionalbajio.mx"),
                (RazonNegocioAprobacion.Rol.AREA, RazonNegocioAprobacion.Estado.APROBADO, "Operaciones confirma adopción y uso por equipos de compras y compliance.", "operaciones@regionalbajio.mx"),
                (RazonNegocioAprobacion.Rol.COMPLIANCE, RazonNegocioAprobacion.Estado.APROBADO, "La trazabilidad documental mejora tiempos de respuesta y control interno.", "compliance@materialidad.online"),
                (RazonNegocioAprobacion.Rol.FISCAL, RazonNegocioAprobacion.Estado.APROBADO, "El gasto está vinculado con soporte defendible de deducciones y expedientes.", "fiscal@materialidad.online"),
                (RazonNegocioAprobacion.Rol.DIRECTOR, RazonNegocioAprobacion.Estado.APROBADO, "Autorizado como iniciativa institucional de control y defensa fiscal.", "direccion@materialidad.online"),
            ],
            "riesgo_69b": [
                (RazonNegocioAprobacion.Rol.SOLICITANTE, RazonNegocioAprobacion.Estado.APROBADO, "Se solicitó proveedor alterno para cierre operativo extraordinario.", "monica.rivera@grupoestrategico.mx"),
                (RazonNegocioAprobacion.Rol.COMPLIANCE, RazonNegocioAprobacion.Estado.APROBADO, "Se detectó presión operativa, pero se escaló por señales documentales débiles.", "compliance@materialidad.online"),
                (RazonNegocioAprobacion.Rol.FISCAL, RazonNegocioAprobacion.Estado.RECHAZADO, "Proveedor confirmado en 69-B definitivo; se ordena sustitución y contención del caso.", "fiscal@materialidad.online"),
            ],
            "intercompany": [
                (RazonNegocioAprobacion.Rol.SOLICITANTE, RazonNegocioAprobacion.Estado.APROBADO, "Centralización de gastos corporativos.", "monica.rivera@grupoestrategico.mx"),
                (RazonNegocioAprobacion.Rol.COMPLIANCE, RazonNegocioAprobacion.Estado.APROBADO, "Pendiente cierre fiscal y PT.", "compliance@materialidad.online"),
                (RazonNegocioAprobacion.Rol.FISCAL, RazonNegocioAprobacion.Estado.PENDIENTE, "Falta memo final de precios de transferencia.", "fiscal@materialidad.online"),
            ],
        }
        for key, items in matrix.items():
            contrato = contratos[key]
            for rol, estado, comentario, email in items:
                decidido_en = now - timedelta(days=7) if estado == RazonNegocioAprobacion.Estado.APROBADO else None
                RazonNegocioAprobacion.objects.using(alias).update_or_create(
                    contrato=contrato,
                    rol=rol,
                    defaults={
                        "estado": estado,
                        "comentario": comentario,
                        "firmado_por": email.split("@")[0].replace(".", " ").title(),
                        "firmado_email": email,
                        "decidido_en": decidido_en,
                        "metadata": {"demo_seed": True},
                    },
                )

    def _seed_intercompany(self, alias: str, *, empresas: dict[str, Empresa], contratos: dict[str, Contrato], today: date) -> None:
        TransaccionIntercompania.objects.using(alias).update_or_create(
            num_operacion_interna="DEMO-IC-2026-001",
            defaults={
                "empresa_origen": empresas["holding"],
                "empresa_destino": empresas["operadora"],
                "tipo": TransaccionIntercompania.TipoTransaccion.SERVICIO,
                "concepto": "Servicios corporativos de compliance y tesorería",
                "descripcion": "Asignación mensual de funciones centrales del holding hacia la operadora logística.",
                "monto_principal": Decimal("350000.00"),
                "moneda": Operacion.Moneda.MXN,
                "tasa_interes": None,
                "fecha_inicio": today - timedelta(days=55),
                "fecha_vencimiento": today + timedelta(days=310),
                "saldo_pendiente": Decimal("350000.00"),
                "estado": TransaccionIntercompania.Estado.VIGENTE,
                "contrato": contratos["intercompany"],
                "razon_negocio": "Evitar duplicidad de estructuras administrativas y fortalecer control del grupo.",
                "beneficio_grupo": "Visibilidad centralizada de riesgos y gastos compartidos.",
                "estudio_precios_transferencia": True,
                "metodo_valuacion": "Costo adicionado",
                "archivo_estudio_url": "https://materialidad.online/demo/precios-transferencia/demo-ic-2026-001.pdf",
                "requiere_atencion": True,
                "notas_alerta": "Monitorear documentación soporte trimestral y evidencia de servicios recibidos.",
                "metadata": {"demo_seed": True},
            },
        )

    def _seed_alertas(self, alias: str, *, empresas: dict[str, Empresa], proveedores: dict[str, Proveedor], operaciones: dict[str, Operacion], today: date) -> int:
        AlertaOperacion.objects.using(alias).update_or_create(
            clave_dedupe="demo-alerta-maquinaria-faltantes",
            defaults={
                "operacion": operaciones["maquinaria_proceso"],
                "empresa": empresas["operadora"],
                "proveedor": proveedores["maquinaria"],
                "tipo_alerta": AlertaOperacion.TipoAlerta.FALTANTES_CRITICOS,
                "estatus": AlertaOperacion.Estatus.EN_SEGUIMIENTO,
                "owner_email": "compliance@materialidad.online",
                "motivo": "Faltan acta de entrega y fotografías georreferenciadas para operación de arrendamiento.",
                "detalle": {"faltantes": ["acta_entrega", "fotos_geo"], "demo_seed": True},
                "fecha_alerta": timezone.now() - timedelta(days=1),
            },
        )
        AlertaOperacion.objects.using(alias).update_or_create(
            clave_dedupe="demo-alerta-69b-riesgo",
            defaults={
                "operacion": operaciones["riesgo_69b"],
                "empresa": empresas["holding"],
                "proveedor": proveedores["69b_definitivo"],
                "tipo_alerta": AlertaOperacion.TipoAlerta.FALTANTES_CRITICOS,
                "estatus": AlertaOperacion.Estatus.ACTIVA,
                "owner_email": "fiscal@materialidad.online",
                "motivo": "Proveedor presente en 69-B definitivo con expediente insuficiente y razón de negocio rechazada.",
                "detalle": {"acciones": ["congelar nuevas órdenes", "activar comité fiscal", "sustituir proveedor", "evaluar reversión del pago"], "demo_seed": True},
                "fecha_alerta": timezone.now(),
            },
        )
        AlertaCSD.objects.using(alias).update_or_create(
            empresa=empresas["holding"],
            proveedor=proveedores["69b_definitivo"],
            tipo_alerta="PROVEEDOR",
            defaults={
                "estatus": "ACLARACION",
                "fecha_deteccion": today - timedelta(days=12),
                "oficio_sat": "SAT-CSD-2026-0091",
                "motivo_presuncion": "Proveedor crítico sometido a revisión reforzada por presión 69-B y trazabilidad documental insuficiente.",
                "acciones_tomadas": "Se suspendieron nuevas órdenes, se bloqueó onboarding adicional y se escaló a comité fiscal.",
            },
        )
        return 3

    def _seed_audit_logs(self, alias: str, *, contratos: dict[str, Contrato], operaciones: dict[str, Operacion], proveedores: dict[str, Proveedor], today: date) -> None:
        AuditLog.objects.using(alias).filter(actor_email__in=self._demo_actor_emails()).delete()

        events = [
            {
                "actor_email": "monica.rivera@grupoestrategico.mx",
                "actor_name": "Mónica Rivera",
                "action": "CONTRATO_CREADO",
                "object_type": "Contrato",
                "object_id": str(contratos["consultoria_legal"].id),
                "object_repr": contratos["consultoria_legal"].nombre,
                "changes": {"estado": "borrador", "codigo": contratos["consultoria_legal"].codigo_interno},
                "created_at": timezone.make_aware(datetime.combine(today - timedelta(days=85), time(10, 5))),
            },
            {
                "actor_email": "compliance@materialidad.online",
                "actor_name": "Equipo Compliance",
                "action": "FECHA_CIERTA_ACREDITADA",
                "object_type": "Contrato",
                "object_id": str(contratos["consultoria_legal"].id),
                "object_repr": contratos["consultoria_legal"].nombre,
                "changes": {"fedatario": contratos["consultoria_legal"].fedatario_nombre, "instrumento": contratos["consultoria_legal"].numero_instrumento},
                "created_at": timezone.make_aware(datetime.combine(today - timedelta(days=79), time(13, 45))),
            },
            {
                "actor_email": "fiscal@materialidad.online",
                "actor_name": "Mesa Fiscal",
                "action": "OPERACION_VALIDADA",
                "object_type": "Operacion",
                "object_id": str(operaciones["legal_ok"].id),
                "object_repr": operaciones["legal_ok"].concepto,
                "changes": {"score": 94, "resultado": "VALIDADO"},
                "created_at": timezone.make_aware(datetime.combine(today - timedelta(days=5), time(16, 10))),
            },
            {
                "actor_email": "compliance@materialidad.online",
                "actor_name": "Equipo Compliance",
                "action": "OPERACION_ESCALADA",
                "object_type": "Operacion",
                "object_id": str(operaciones["maquinaria_proceso"].id),
                "object_repr": operaciones["maquinaria_proceso"].concepto,
                "changes": {"faltantes": ["acta_entrega", "fotos_geo"], "owner": "compliance@materialidad.online"},
                "created_at": timezone.make_aware(datetime.combine(today - timedelta(days=1), time(9, 35))),
            },
            {
                "actor_email": "fiscal@materialidad.online",
                "actor_name": "Mesa Fiscal",
                "action": "PROVEEDOR_BLOQUEADO_69B",
                "object_type": "Proveedor",
                "object_id": str(proveedores["69b_definitivo"].id),
                "object_repr": proveedores["69b_definitivo"].razon_social,
                "changes": {"estatus_69b": proveedores["69b_definitivo"].estatus_69b, "riesgo": proveedores["69b_definitivo"].riesgo_fiscal},
                "created_at": timezone.make_aware(datetime.combine(today - timedelta(days=1), time(11, 5))),
            },
            {
                "actor_email": "direccion@materialidad.online",
                "actor_name": "Dirección General",
                "action": "CASO_ESCALADO_A_COMITE",
                "object_type": "Operacion",
                "object_id": str(operaciones["riesgo_69b"].id),
                "object_repr": operaciones["riesgo_69b"].concepto,
                "changes": {"decision": "contencion", "siguiente_paso": "sustitucion_proveedor"},
                "created_at": timezone.make_aware(datetime.combine(today - timedelta(days=1), time(12, 25))),
            },
            {
                "actor_email": "fiscal@materialidad.online",
                "actor_name": "Mesa Fiscal",
                "action": "OPERACION_RECHAZADA",
                "object_type": "Operacion",
                "object_id": str(operaciones["riesgo_69b"].id),
                "object_repr": operaciones["riesgo_69b"].concepto,
                "changes": {"score": 18, "motivo": "69-B definitivo", "resultado": "RECHAZADO"},
                "created_at": timezone.make_aware(datetime.combine(today - timedelta(days=1), time(13, 10))),
            },
        ]

        for item in events:
            created_at = item.pop("created_at")
            log = AuditLog.objects.using(alias).create(**item)
            AuditLog.objects.using(alias).filter(pk=log.pk).update(created_at=created_at)

    def _seed_snapshots(self, alias: str, *, tenant_slug: str, empresas: dict[str, Empresa], today: date) -> None:
        DashboardSnapshot.objects.using(alias).filter(tenant_slug=tenant_slug, payload__demo_seed=True).delete()
        FiscalDefenseIndexSnapshot.objects.using(alias).filter(tenant_slug=tenant_slug, source="demo_seed").delete()

        current_payload = calculate_fiscal_defense_index(days=90)
        coverage_payload = get_dashboard_cobertura_p0(days=90)
        current_inputs = current_payload.get("inputs", {}) if isinstance(current_payload.get("inputs"), dict) else {}

        monto_validado = (
            Operacion.objects.using(alias)
            .filter(estatus_validacion=Operacion.EstatusValidacion.VALIDADO)
            .aggregate(total=Sum("monto"))
            .get("total")
            or Decimal("0")
        )
        operaciones_pendientes = Operacion.objects.using(alias).exclude(
            estatus_validacion=Operacion.EstatusValidacion.VALIDADO
        ).count()
        contratos_por_vencer_30 = Contrato.objects.using(alias).filter(
            vigencia_fin__isnull=False,
            vigencia_fin__gte=today,
            vigencia_fin__lte=today + timedelta(days=30),
        ).count()
        proveedores_sin_validacion_sat = Proveedor.objects.using(alias).filter(ultima_validacion_sat__isnull=True).count()

        dashboard_snapshot = DashboardSnapshot.objects.using(alias).create(
            tenant_slug=tenant_slug,
            payload={
                "demo_seed": True,
                "resumen": "Snapshot demo alineado con el cálculo real del FDI y la cobertura vigente.",
                "fdi": current_payload,
                "coverage": coverage_payload.get("coverage", {}),
            },
            cobertura_contractual=Decimal(str(current_inputs.get("cobertura_contractual", 0.0) or 0.0)).quantize(Decimal("0.01")),
            contratos_por_vencer_30=contratos_por_vencer_30,
            operaciones_pendientes=operaciones_pendientes,
            proveedores_sin_validacion_sat=proveedores_sin_validacion_sat,
            monto_validado_mxn=monto_validado.quantize(Decimal("0.01")),
        )
        DashboardSnapshot.objects.using(alias).filter(pk=dashboard_snapshot.pk).update(
            captured_at=timezone.make_aware(datetime.combine(today, time(14, 50)))
        )

        previous_payload = self._build_prior_demo_fdi_payload(current_payload)
        previous_snapshot = self._create_fdi_snapshot(
            alias,
            tenant_slug=tenant_slug,
            payload=previous_payload,
            source="demo_seed",
        )
        FiscalDefenseIndexSnapshot.objects.using(alias).filter(pk=previous_snapshot.pk).update(
            captured_at=timezone.make_aware(datetime.combine(today - timedelta(days=21), time(13, 30)))
        )

        current_snapshot = self._create_fdi_snapshot(
            alias,
            tenant_slug=tenant_slug,
            payload=current_payload,
            source="demo_seed",
        )
        FiscalDefenseIndexSnapshot.objects.using(alias).filter(pk=current_snapshot.pk).update(
            captured_at=timezone.make_aware(datetime.combine(today, time(14, 50)))
        )

    def _build_prior_demo_fdi_payload(self, payload: dict[str, object]) -> dict[str, object]:
        cloned = json.loads(json.dumps(payload, default=str))
        breakdown = cloned.get("breakdown") if isinstance(cloned.get("breakdown"), dict) else {}
        adjustments = {
            "DM": -8.0,
            "SE": -10.0,
            "SC": -3.0,
            "EC": 5.0,
            "DO": -4.0,
        }
        for key, delta in adjustments.items():
            current_value = float(breakdown.get(key, 0.0) or 0.0)
            breakdown[key] = max(0.0, min(100.0, round(current_value + delta, 1)))

        dm = float(breakdown.get("DM", 0.0) or 0.0)
        se = float(breakdown.get("SE", 0.0) or 0.0)
        sc = float(breakdown.get("SC", 0.0) or 0.0)
        ec = float(breakdown.get("EC", 0.0) or 0.0)
        do = float(breakdown.get("DO", 0.0) or 0.0)
        score = round((0.28 * dm) + (0.22 * se) + (0.18 * sc) + (0.20 * (100 - ec)) + (0.12 * do), 1)

        cloned["score"] = score
        cloned["level"] = FiscalDefenseIndexSnapshot.Level.CONTROLADO if score >= 60 else FiscalDefenseIndexSnapshot.Level.DEBIL
        inputs = cloned.get("inputs") if isinstance(cloned.get("inputs"), dict) else {}
        if isinstance(inputs, dict):
            inputs["demo_seed_history"] = True
            inputs["narrativa"] = "Snapshot histórico demo para ilustrar mejora reciente del control documental."
        cloned["summary"] = f"FDI {score} ({cloned['level']}) en snapshot histórico demo"
        return cloned

    def _create_fdi_snapshot(self, alias: str, *, tenant_slug: str, payload: dict[str, object], source: str) -> FiscalDefenseIndexSnapshot:
        period = payload.get("period") if isinstance(payload.get("period"), dict) else {}
        breakdown = payload.get("breakdown") if isinstance(payload.get("breakdown"), dict) else {}
        inputs = payload.get("inputs") if isinstance(payload.get("inputs"), dict) else {}
        actions = payload.get("actions") if isinstance(payload.get("actions"), list) else []

        period_start = date.fromisoformat(str(period.get("from") or timezone.localdate().isoformat())[:10])
        period_end = date.fromisoformat(str(period.get("to") or timezone.localdate().isoformat())[:10])

        return FiscalDefenseIndexSnapshot.objects.using(alias).create(
            tenant_slug=tenant_slug,
            empresa_id=period.get("empresa_id"),
            period_start=period_start,
            period_end=period_end,
            score=Decimal(str(round(float(payload.get("score", 0.0) or 0.0), 1))).quantize(Decimal("0.1")),
            level=str(payload.get("level", FiscalDefenseIndexSnapshot.Level.NO_DATA)),
            dm=Decimal(str(round(float(breakdown.get("DM", 0.0) or 0.0), 1))).quantize(Decimal("0.1")),
            se=Decimal(str(round(float(breakdown.get("SE", 0.0) or 0.0), 1))).quantize(Decimal("0.1")),
            sc=Decimal(str(round(float(breakdown.get("SC", 0.0) or 0.0), 1))).quantize(Decimal("0.1")),
            ec=Decimal(str(round(float(breakdown.get("EC", 0.0) or 0.0), 1))).quantize(Decimal("0.1")),
            do=Decimal(str(round(float(breakdown.get("DO", 0.0) or 0.0), 1))).quantize(Decimal("0.1")),
            inputs_json={**inputs, "demo_seed": True},
            actions_json=actions,
            source=source,
        )

    def _reference_payload(self, source: LegalReferenceSource) -> dict[str, object]:
        return {
            "id": source.id,
            "ley": source.ley,
            "ordenamiento": source.ordenamiento,
            "tipo_fuente": source.tipo_fuente,
            "estatus_vigencia": source.estatus_vigencia,
            "es_vigente": source.es_vigente,
            "fecha_ultima_revision": source.fecha_ultima_revision.isoformat() if source.fecha_ultima_revision else None,
            "autoridad_emisora": source.autoridad_emisora,
            "articulo": source.articulo,
            "fraccion": source.fraccion,
            "parrafo": source.parrafo,
            "resumen": source.resumen,
            "extracto": source.contenido[:280],
            "fuente_documento": source.fuente_documento,
            "fuente_url": source.fuente_url,
            "vigencia": source.vigencia,
            "section_type": source.metadata.get("section_type") if isinstance(source.metadata, dict) else None,
        }

    def _empresa_rfcs(self) -> list[str]:
        return ["GDE240101AAA", "ODL240101BBB", "DRB240101CCC"]

    def _proveedor_rfcs(self) -> list[str]:
        return ["LCI240101AAA", "MPN240101BBB", "ADC240101CCC", "CAC240101DDD", *self.REAL_69B_PREFERRED_RFCS]

    def _render_summary(self, tenant_slug: str, summary: SeedSummary) -> str:
        return (
            f"Tenant '{tenant_slug}' poblado con éxito:\n"
            f"- Empresas: {summary.empresas}\n"
            f"- Proveedores: {summary.proveedores}\n"
            f"- Contratos: {summary.contratos}\n"
            f"- Operaciones: {summary.operaciones}\n"
            f"- Movimientos bancarios: {summary.movimientos}\n"
            f"- Entregables: {summary.entregables}\n"
            f"- Evidencias: {summary.evidencias}\n"
            f"- Alertas: {summary.alertas}\n"
            f"- Consultas legales demo: {summary.consultas}\n"
            f"- Fuentes legales demo: {summary.fuentes_legales}"
        )
