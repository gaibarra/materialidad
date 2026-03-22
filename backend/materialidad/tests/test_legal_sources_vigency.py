from __future__ import annotations

from datetime import date

from django.test import TestCase

from materialidad.models import LegalReferenceSource
from materialidad.services import _fetch_candidate_sources, _reference_payload


class LegalSourcesVigencyTests(TestCase):
    def test_fetch_candidate_sources_prioritizes_current_sources(self):
        LegalReferenceSource.objects.create(
            slug="lisr-vigente-27",
            ley="Ley del ISR",
            tipo_fuente=LegalReferenceSource.SourceType.LEY,
            estatus_vigencia=LegalReferenceSource.VigencyStatus.VIGENTE,
            es_vigente=True,
            fecha_ultima_revision=date(2026, 3, 1),
            autoridad_emisora="DOF",
            articulo="27",
            contenido="Artículo 27. Las deducciones autorizadas deberán estar amparadas con CFDI y materialidad comprobable.",
            resumen="Deducciones autorizadas con CFDI.",
            fuente_documento="DOF texto vigente",
            fuente_url="https://www.dof.gob.mx/",
            vigencia="Texto vigente 2026",
            hash_contenido="a" * 64,
        )
        LegalReferenceSource.objects.create(
            slug="lisr-historica-27",
            ley="Ley del ISR",
            tipo_fuente=LegalReferenceSource.SourceType.LEY,
            estatus_vigencia=LegalReferenceSource.VigencyStatus.HISTORICA,
            es_vigente=False,
            fecha_ultima_revision=date(2024, 1, 1),
            autoridad_emisora="DOF",
            articulo="27",
            contenido="Artículo 27 vigente hasta 2013 con redacción previa sobre deducciones autorizadas.",
            resumen="Texto histórico del artículo 27.",
            fuente_documento="DOF histórico",
            fuente_url="https://www.dof.gob.mx/",
            vigencia="Vigente hasta 2013",
            hash_contenido="b" * 64,
        )

        results = _fetch_candidate_sources(
            query="deducciones autorizadas artículo 27",
            ley="Ley del ISR",
            source_type=LegalReferenceSource.SourceType.LEY,
            limit=5,
            only_current=True,
        )

        self.assertEqual(len(results), 1)
        self.assertEqual(results[0].slug, "lisr-vigente-27")

    def test_fetch_candidate_sources_can_include_historical_when_requested(self):
        vigente = LegalReferenceSource.objects.create(
            slug="cff-vigente-5",
            ley="Código Fiscal de la Federación",
            tipo_fuente=LegalReferenceSource.SourceType.LEY,
            estatus_vigencia=LegalReferenceSource.VigencyStatus.VIGENTE,
            es_vigente=True,
            fecha_ultima_revision=date(2026, 3, 1),
            articulo="5",
            contenido="Aplicación estricta de disposiciones fiscales.",
            resumen="Texto vigente.",
            hash_contenido="c" * 64,
        )
        historica = LegalReferenceSource.objects.create(
            slug="cff-historica-5",
            ley="Código Fiscal de la Federación",
            tipo_fuente=LegalReferenceSource.SourceType.LEY,
            estatus_vigencia=LegalReferenceSource.VigencyStatus.HISTORICA,
            es_vigente=False,
            fecha_ultima_revision=date(2020, 1, 1),
            articulo="5",
            contenido="Aplicación estricta en redacción histórica.",
            resumen="Texto histórico.",
            hash_contenido="d" * 64,
        )

        results = _fetch_candidate_sources(
            query="aplicación estricta disposiciones fiscales artículo 5",
            ley="Código Fiscal de la Federación",
            source_type=LegalReferenceSource.SourceType.LEY,
            limit=5,
            only_current=False,
        )

        self.assertEqual(results[0].pk, vigente.pk)
        self.assertIn(historica.pk, [result.pk for result in results])

    def test_reference_payload_exposes_structured_metadata(self):
        source = LegalReferenceSource.objects.create(
            slug="scjn-2025010",
            ley="Jurisprudencia fiscal",
            ordenamiento="Jurisprudencia fiscal",
            tipo_fuente=LegalReferenceSource.SourceType.RESOLUCION,
            estatus_vigencia=LegalReferenceSource.VigencyStatus.VIGENTE,
            es_vigente=True,
            autoridad_emisora="SCJN",
            contenido="Registro digital: 2025010. Rubro: VALOR AGREGADO. Tesis: I.1o.A.10 A (11a.)",
            resumen="VALOR AGREGADO. LA CARGA PROBATORIA CORRESPONDE AL CONTRIBUYENTE.",
            hash_contenido="e" * 64,
            metadata={
                "parser": "SCJN",
                "section_type": "TESIS",
                "registro_digital": "2025010",
                "rubro": "VALOR AGREGADO. LA CARGA PROBATORIA CORRESPONDE AL CONTRIBUYENTE.",
                "tesis": "I.1o.A.10 A (11a.)",
            },
        )

        payload = _reference_payload(source)

        self.assertEqual(payload["section_type"], "TESIS")
        self.assertEqual(payload["registro_digital"], "2025010")
        self.assertIn("VALOR AGREGADO", payload["rubro"])
        self.assertEqual(payload["tesis"], "I.1o.A.10 A (11a.)")
        self.assertEqual(payload["parser"], "SCJN")