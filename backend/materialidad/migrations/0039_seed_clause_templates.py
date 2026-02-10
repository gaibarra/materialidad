"""Seed ClauseTemplate table with the 7 curated clauses previously hardcoded in clause_library.py."""

from django.db import migrations


_SEED_CLAUSES = [
    {
        "slug": "control-cambios-alcance",
        "titulo": "Control estricto de cambios y alcance",
        "categorias": ["BASE_CORPORATIVA", "PROVEEDORES", "OPERACIONES"],
        "procesos": ["COMPRAS", "OPERACIONES"],
        "nivel_riesgo": "MEDIO",
        "resumen": "Requiere autorizacion escrita y evaluacion de impacto para cualquier cambio al alcance o entregables.",
        "texto": (
            "Las Partes acuerdan que cualquier modificacion al alcance, entregables o calendario debera "
            "ser solicitada por escrito y aprobada por el Comite de Control Interno. El Prestador debera presentar "
            "una matriz de impacto que detalle incremento de costo, riesgos operativos y evidencia de capacidad antes "
            "de iniciar el nuevo trabajo, quedando suspendida la ejecucion hasta recibir autorizacion expresa."
        ),
        "tips_redline": [
            "Exigir que los cambios firmados incorporen nueva vigencia y referencia al expediente digital.",
            "Agregar linea base de SLA para evitar que el alcance flexible diluya entregables obligatorios.",
        ],
        "palabras_clave": ["alcance", "cambio", "control", "comite"],
        "prioridad": 3,
    },
    {
        "slug": "penalizaciones-sla-proveedores",
        "titulo": "Penalizaciones automaticas por SLA",
        "categorias": ["PROVEEDORES", "CLIENTES"],
        "procesos": ["COMPRAS", "OPERACIONES"],
        "nivel_riesgo": "ALTO",
        "resumen": "Calcula descuentos automaticos cuando el proveedor incumple indicadores criticos.",
        "texto": (
            "Cuando el Prestador no cumpla con los niveles de servicio acordados por dos mediciones consecutivas, "
            "la Empresa podra retener hasta el 20% de la factura correspondiente y aplicar un plan de correccion. "
            "Si el indicador permanece en rojo durante tres periodos, la Empresa podra terminar el contrato por causa "
            "imputable, sin penalidad y reclamando los costos de sustitucion debidamente soportados."
        ),
        "tips_redline": [
            "Mantener que las mediciones se basan en tableros auditables y no en reportes unilaterales del proveedor.",
            "Agregar ejemplo de KPI critico (tiempo de respuesta, disponibilidad plataforma, etc.).",
        ],
        "palabras_clave": ["sla", "indicador", "penalizacion", "kpi"],
        "prioridad": 4,
    },
    {
        "slug": "blindaje-confidencial",
        "titulo": "Blindaje reforzado de confidencialidad y datos",
        "categorias": ["BASE_CORPORATIVA", "CLIENTES", "PARTES_RELACIONADAS"],
        "procesos": ["VENTAS", "GOBIERNO_CORPORATIVO"],
        "nivel_riesgo": "ALTO",
        "resumen": "Incluye destruccion certificada, controles Zero Trust y responsabilidad solidaria ante filtraciones.",
        "texto": (
            "El Prestador implementara controles Zero Trust, registro de accesos y cifrado extremo a extremo respecto "
            "de la Informacion Confidencial. Al finalizar la relacion, debera certificar por escrito la destruccion "
            "segura de soportes y respaldos. Cualquier filtracion atribuible al Prestador generara la obligacion de "
            "cubrir multas regulatorias, costos de notificacion y plan de remediacion tecnologica."
        ),
        "tips_redline": [
            "Asegurar que la certificacion de destruccion incluya numero de ticket y evidencia documental.",
            "Solicitar que cualquier subencargado sea previamente autorizado por escrito.",
        ],
        "palabras_clave": ["confidencialidad", "datos", "zero trust"],
        "prioridad": 5,
    },
    {
        "slug": "terminacion-fiscal",
        "titulo": "Terminacion por incumplimiento fiscal",
        "categorias": ["FINANCIERO", "PROVEEDORES"],
        "procesos": ["TESORERIA", "COMPRAS"],
        "nivel_riesgo": "ALTO",
        "resumen": "Permite rescindir sin responsabilidad si el proveedor aparece en listas negras o pierde registro.",
        "texto": (
            "Si la autoridad fiscal publica al Prestador en las listas del articulo 69-B, suspende sus certificados "
            "digitales o inicia procesos que impidan expedir CFDI validos, la Empresa podra terminar el contrato de "
            "manera inmediata sin incurrir en penalizacion alguna. El Prestador reembolsara anticipos y colaborara en "
            "la transferencia ordenada de actividades en un plazo maximo de diez dias naturales."
        ),
        "tips_redline": [
            "Solicitar notificacion proactiva en menos de 24 horas cuando exista requerimiento fiscal relevante.",
            "Agregar obligacion de mantener vigente la opinion de cumplimiento positiva.",
        ],
        "palabras_clave": ["69-b", "fiscal", "tesoreria", "terminacion"],
        "prioridad": 4,
    },
    {
        "slug": "auditoria-trazabilidad",
        "titulo": "Auditoria y trazabilidad total",
        "categorias": ["BASE_CORPORATIVA", "CAPITAL_HUMANO", "CLIENTES"],
        "procesos": ["GOBIERNO_CORPORATIVO", "OPERACIONES"],
        "nivel_riesgo": "MEDIO",
        "resumen": "Garantiza acceso a expedientes, bitacoras y personal clave durante auditorias internas o SAT.",
        "texto": (
            "El Prestador mantendra expedientes digitales con bitacora de actividad, evidencia fotografica y registro "
            "de personal asignado por cada servicio. Ante requerimiento de auditoria interna o autoridad, debera "
            "habilitar acceso remoto seguro en un maximo de 48 horas y conservar los registros por al menos cinco anos."
        ),
        "tips_redline": [
            "Incluir referencia cruzada al numero de operacion y contrato maestro.",
            "Pedir que los logs se entreguen en formato interoperable (CSV o JSON firmado).",
        ],
        "palabras_clave": ["auditoria", "bitacora", "expediente"],
        "prioridad": 3,
    },
    {
        "slug": "indice-desempeno-variable",
        "titulo": "Indice de desempeno vinculado a pago variable",
        "categorias": ["CLIENTES", "PROVEEDORES"],
        "procesos": ["VENTAS", "COMPRAS"],
        "nivel_riesgo": "MEDIO",
        "resumen": "Amarra un porcentaje del pago a un indicador compuesto transparente.",
        "texto": (
            "Un veinte por ciento (20%) del pago mensual quedara condicionado al puntaje obtenido en el Indice de "
            "Desempeno Integral (IDI), calculado con base en calidad tecnica, cumplimiento documental y satisfaccion "
            "del area usuaria. Si el IDI es inferior a 80 puntos, el pago variable no sera exigible y se destinara a un "
            "fondo de mejora continua que la Empresa administrara."
        ),
        "tips_redline": [
            "Definir formula del IDI en anexo para evitar discusiones posteriores.",
            "Configurar tablero compartido para capturar calificaciones en tiempo real.",
        ],
        "palabras_clave": ["indicador", "pago variable", "idi"],
        "prioridad": 2,
    },
    {
        "slug": "clausula-etica-y-compliance",
        "titulo": "Clausula de etica y compliance integral",
        "categorias": ["BASE_CORPORATIVA", "PARTES_RELACIONADAS", "PROVEEDORES"],
        "procesos": ["GOBIERNO_CORPORATIVO", "COMPRAS"],
        "nivel_riesgo": "ALTO",
        "resumen": "Impone codigos eticos, canal de denuncia y monitoreo continuo de terceros.",
        "texto": (
            "El Prestador se obliga a cumplir con el Codigo de Etica de la Empresa y a implementar un canal de denuncia "
            "anonimo para su personal involucrado en la prestacion. Reportara en 24 horas cualquier indicio de soborno, "
            "conflicto de interes o practicas prohibidas, habilitando auditorias sorpresa sobre pagos a terceros."
        ),
        "tips_redline": [
            "Conectar la clausula con el programa de debida diligencia de terceras partes.",
            "Incluir facultad de suspender pagos mientras se investiga el hallazgo.",
        ],
        "palabras_clave": ["etica", "compliance", "soborno"],
        "prioridad": 4,
    },
]


def seed_clauses(apps, schema_editor):
    ClauseTemplate = apps.get_model("materialidad", "ClauseTemplate")
    for data in _SEED_CLAUSES:
        ClauseTemplate.objects.update_or_create(
            slug=data["slug"],
            defaults={
                "titulo": data["titulo"],
                "texto": data["texto"],
                "resumen": data["resumen"],
                "categorias": data["categorias"],
                "procesos": data["procesos"],
                "nivel_riesgo": data["nivel_riesgo"],
                "tips_redline": data["tips_redline"],
                "palabras_clave": data["palabras_clave"],
                "prioridad": data["prioridad"],
                "version": 1,
                "es_curada": True,
                "activo": True,
            },
        )


def unseed_clauses(apps, schema_editor):
    ClauseTemplate = apps.get_model("materialidad", "ClauseTemplate")
    slugs = [c["slug"] for c in _SEED_CLAUSES]
    ClauseTemplate.objects.filter(slug__in=slugs, es_curada=True).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("materialidad", "0038_clausetemplate_and_template_seed_fields"),
    ]

    operations = [
        migrations.RunPython(seed_clauses, unseed_clauses),
    ]
