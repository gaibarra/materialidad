from django.test import SimpleTestCase

from materialidad.legal_corpus import (
    extract_structured_legal_segments,
    parse_dof_segments,
    parse_sat_segments,
    parse_scjn_segments,
    parse_tfja_segments,
)
from materialidad.models import LegalCorpusUpload


class LegalCorpusParserTests(SimpleTestCase):
    def test_parse_dof_segments_splits_articles(self):
        text = """
        Artículo 5. Las disposiciones fiscales son de aplicación estricta.
        Para efectos administrativos se observará esta regla.

        Artículo 6. Las contribuciones se causan conforme se realizan las situaciones jurídicas.
        """

        segments = parse_dof_segments(text)

        self.assertEqual(len(segments), 2)
        self.assertEqual(segments[0]["articulo"], "5")
        self.assertEqual(segments[0]["metadata"]["section_type"], "ARTICULO")
        self.assertIn("Artículo 6", segments[1]["content"])

    def test_parse_sat_segments_detects_rules(self):
        text = """
        Regla 2.1.4. Para efectos del RFC, la autoridad podrá validar la información.
        Esta regla será aplicable a personas morales.

        Regla 3.2.1. Los contribuyentes acumularán sus ingresos conforme a la ley.
        """

        segments = parse_sat_segments(text)

        self.assertEqual(len(segments), 2)
        self.assertEqual(segments[0]["metadata"]["identifier"], "2.1.4")
        self.assertEqual(segments[0]["metadata"]["section_type"], "REGLA")

    def test_parse_scjn_segments_detects_tesis(self):
        text = """
        Registro digital: 2025010
        Instancia: Tribunales Colegiados de Circuito
        Rubro: VALOR AGREGADO. LA CARGA PROBATORIA CORRESPONDE AL CONTRIBUYENTE.
        Tesis: I.1o.A.10 A (11a.)

        Registro digital: 2025011
        Rubro: RENTA. LAS DEDUCCIONES DEBEN SER ESTRICTAMENTE INDISPENSABLES.
        Tesis: I.1o.A.11 A (11a.)
        """

        segments = parse_scjn_segments(text)

        self.assertEqual(len(segments), 2)
        self.assertEqual(segments[0]["metadata"]["registro_digital"], "2025010")
        self.assertIn("VALOR AGREGADO", segments[0]["summary"])

    def test_parse_tfja_segments_detects_precedents(self):
        text = """
        Precedente VIII-P-SS-123
        Rubro: DEVOLUCIÓN DE SALDOS A FAVOR. PROCEDE SU ANÁLISIS INTEGRAL.
        Texto del precedente aplicable.

        Tesis IX-TASR-2ME-15
        Rubro: FACULTADES DE COMPROBACIÓN. DEBEN FUNDARSE DE MANERA EXHAUSTIVA.
        Texto de la tesis.
        """

        segments = parse_tfja_segments(text)

        self.assertEqual(len(segments), 2)
        self.assertEqual(segments[0]["metadata"]["parser"], "TFJA")
        self.assertEqual(segments[0]["metadata"]["section_type"], "PRECEDENTE")
        self.assertIn("Precedente", segments[0]["metadata"]["identifier"])

    def test_extract_structured_segments_falls_back_to_generic_chunks(self):
        text = "Texto libre sin encabezados especiales. " * 120

        segments = extract_structured_legal_segments(
            text,
            authority=LegalCorpusUpload.Authority.OTRO,
            chunk_size=300,
            overlap=50,
        )

        self.assertGreater(len(segments), 1)
        self.assertEqual(segments[0]["metadata"]["parser"], "GENERIC")
        self.assertEqual(segments[0]["metadata"]["section_type"], "CHUNK")
