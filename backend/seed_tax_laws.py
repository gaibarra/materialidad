import hashlib
from materialidad.models import LegalReferenceSource
from django.utils.text import slugify

SOURCES = [
    {
        "ley": "Código Fiscal de la Federación",
        "articulo": "69-B",
        "tipo_fuente": "LEY",
        "resumen": "Presunción de inexistencia de operaciones (Materialidad).",
        "contenido": (
            "Cuando la autoridad fiscal detecte que un contribuyente ha estado emitiendo comprobantes sin contar con los activos, personal, "
            "infraestructura o capacidad material, directa o indirectamente, para prestar los servicios o producir, comercializar o entregar los "
            "bienes que amparan tales comprobantes, o bien, que dichos contribuyentes se encuentren no localizados, se presumirá la inexistencia "
            "de las operaciones amparadas en tales comprobantes.\n\n"
            "En este supuesto, se notificará a los contribuyentes que se encuentren en dicha situación a través de su buzón tributario..."
        )
    },
    {
        "ley": "Código Fiscal de la Federación",
        "articulo": "5-A",
        "tipo_fuente": "LEY",
        "resumen": "Razón de negocio y recalificación de actos jurídicos.",
        "contenido": (
            "Los actos jurídicos que carezcan de una razón de negocio y que generen un beneficio fiscal directo o indirecto, tendrán los efectos "
            "fiscales que correspondan a los que se habrían realizado para la obtención del beneficio económico razonablemente esperado por el "
            "contribuyente.\n\n"
            "La autoridad fiscal podrá presumir, salvo prueba en contrario, que no existe una razón de negocio cuando el beneficio económico "
            "cuantificable sea menor al beneficio fiscal."
        )
    },
    {
        "ley": "Ley del Impuesto sobre la Renta",
        "articulo": "27",
        "fraccion": "I",
        "tipo_fuente": "LEY",
        "resumen": "Requisitos de las deducciones (Estricta Indispensabilidad).",
        "contenido": (
            "Las deducciones autorizadas deberán reunir los siguientes requisitos: I. Ser estrictamente indispensables para los fines de la actividad "
            "del contribuyente, salvo que se trate de donativos no onerosos ni remunerativos...\n\n"
            "La falta de materialidad de la operación impide demostrar la estricta indispensabilidad, resultando en el rechazo de la deducción."
        )
    },
    {
        "ley": "Jurisprudencia (Criterio)",
        "articulo": "Tesis: PC.I.A. J/158 A",
        "tipo_fuente": "CRITERIO_SAT",
        "resumen": "Carga de la prueba en materia de materialidad.",
        "contenido": (
            "Para desvirtuar la presunción de inexistencia de operaciones, el contribuyente debe aportar pruebas documentales idóneas y suficientes "
            "que demuestren que los servicios efectivamente se prestaron. Entre estas pruebas se encuentran: bitácoras, contratos con fecha cierta, "
            "registros contables, fotografías, correos electrónicos y entregables físicos o digitales coincidentes con los periodos facturados."
        )
    },
    {
        "ley": "Ley del Impuesto sobre la Renta",
        "articulo": "32",
        "tipo_fuente": "LEY",
        "resumen": "Definición de inversiones y activos intangibles.",
        "contenido": (
            "Para los efectos de esta Ley, se consideran inversiones los activos fijos, los gastos y cargos diferidos y las erogaciones realizadas en periodos preoperativos...\n\n"
            "Gastos diferidos son los activos intangibles representados por bienes o derechos que permitan reducir costos de operación, mejorar la calidad o acceptance de un producto, "
            "usar, disfrutar o explotar bienes, por un periodo limitado, inferior a la duración de la actividad de la persona moral."
        )
    },
    {
        "ley": "Ley del Impuesto sobre la Renta",
        "articulo": "33",
        "tipo_fuente": "LEY",
        "resumen": "Porcentajes de amortización para activos intangibles.",
        "contenido": (
            "Los porcientos máximos autorizados para gastos y cargos diferidos, así como para las erogaciones realizadas en periodos preoperativos, son los siguientes:\n"
            "I. 5% para gastos diferidos.\n"
            "II. 10% para erogaciones realizadas en periodos preoperativos.\n"
            "III. 15% para regalías, para asistencia técnica, así como para otros gastos diferidos..."
        )
    },
    {
        "ley": "Ley del Impuesto sobre el Valor Agregado",
        "articulo": "1-A",
        "tipo_fuente": "LEY",
        "resumen": "Retenciones de IVA en servicios.",
        "contenido": (
            "Están obligados a efectuar la retención del impuesto que se les traslade, los contribuyentes que se ubiquen en alguno de los siguientes supuestos:\n"
            "II. Sean personas morales que: a) Reciban servicios personales independientes, o usen o gocen temporalmente bienes, prestados u otorgados por personas físicas, respectivamente."
        )
    },
    {
        "ley": "Ley del Impuesto sobre la Renta",
        "articulo": "28",
        "tipo_fuente": "LEY",
        "resumen": "Conceptos no deducibles para efectos de ISR.",
        "contenido": (
            "Para los efectos de este Título, no serán deducibles:\n"
            "I. Los pagos por impuesto sobre la renta a cargo del propio contribuyente o de terceros...\n"
            "V. Los viáticos o gastos de viaje, en el país o en el extranjero, cuando no se destinen al hospedaje, alimentación, transporte, uso o goce temporal de automóviles y pago de kilometraje..."
        )
    },
    {
        "ley": "Código Fiscal de la Federación",
        "articulo": "32-D",
        "tipo_fuente": "LEY",
        "resumen": "Opinión de cumplimiento de obligaciones fiscales.",
        "contenido": (
            "Las dependencias y entidades de la Administración Pública Federal, la Centralizada y la Paraestatal, no podrán contratar adquisiciones, arrendamientos, servicios u obra pública con los particulares que:\n"
            "I. Tengan a su cargo adeudos fiscales firmes.\n"
            "II. No se encuentren inscritos en el Registro Federal de Contribuyentes."
        )
    },
    {
        "ley": "Ley del Impuesto sobre el Valor Agregado",
        "articulo": "4",
        "tipo_fuente": "LEY",
        "resumen": "Acreditamiento del IVA y sus requisitos.",
        "contenido": (
            "El acreditamiento consiste en restar el impuesto acreditable, de la cantidad que resulte de aplicar a los valores señalados en esta Ley, la tasa que corresponda según sea el caso.\n"
            "Se entiende por impuesto acreditable el impuesto sobre el valor agregado que haya sido trasladado al contribuyente y el propio impuesto que él hubiese pagado con motivo de la importación de bienes o servicios."
        )
    }
]

def seed_legal_library():
    print(f"Seeding legal library with {len(SOURCES)} critical sources...")
    created_count = 0
    for s in SOURCES:
        slug = slugify(f"{s['ley']}-{s.get('articulo', '')}-{s.get('fraccion', '')}")
        content_hash = hashlib.sha256(s['contenido'].encode()).hexdigest()
        
        try:
            LegalReferenceSource.objects.update_or_create(
                slug=slug,
                defaults={
                    "ley": s['ley'],
                    "articulo": s.get('articulo', ''),
                    "fraccion": s.get('fraccion', ''),
                    "tipo_fuente": s['tipo_fuente'],
                    "contenido": s['contenido'],
                    "resumen": s['resumen'],
                    "hash_contenido": content_hash,
                    "vigencia": "2025",
                }
            )
            created_count += 1
        except Exception as e:
            print(f"Error seeding {slug}: {e}")
            
    print(f"Success: {created_count} sources available in the library.")

# Removed name check to ensure execution in django shell
seed_legal_library()
