from __future__ import annotations

from django.test import SimpleTestCase

from materialidad.fdi_engine import (
    FDI_CONFIDENCE_WEIGHTS,
    FDI_DIMENSION_WEIGHTS,
    LEGACY_PUBLIC_FDI_WEIGHTS,
    build_internal_fdi_payload,
    commercial_fdi_level,
    compute_fdi_confidence,
    confidence_coverage_cap,
    confidence_integrity_cap,
    export_public_fdi_payload,
    legacy_fdi_level,
)


class FDIEngineTests(SimpleTestCase):
    def test_dimension_weights_sum_to_one(self):
        self.assertAlmostEqual(sum(FDI_DIMENSION_WEIGHTS.values()), 1.0)

    def test_confidence_weights_sum_to_one(self):
        self.assertAlmostEqual(sum(FDI_CONFIDENCE_WEIGHTS.values()), 1.0)

    def test_legacy_public_weights_sum_to_one(self):
        self.assertAlmostEqual(sum(LEGACY_PUBLIC_FDI_WEIGHTS.values()), 1.0)

    def test_legacy_level_preserves_existing_thresholds(self):
        self.assertEqual(legacy_fdi_level(81, has_universe=True), "ROBUSTO")
        self.assertEqual(legacy_fdi_level(61, has_universe=True), "CONTROLADO")
        self.assertEqual(legacy_fdi_level(45, has_universe=True), "DEBIL")
        self.assertEqual(legacy_fdi_level(10, has_universe=True), "CRITICO")
        self.assertEqual(legacy_fdi_level(90, has_universe=False), "NO_DATA")

    def test_commercial_level_uses_product_thresholds(self):
        self.assertEqual(commercial_fdi_level(90), "BLINDADO")
        self.assertEqual(commercial_fdi_level(70), "CONTROLADO")
        self.assertEqual(commercial_fdi_level(55), "EXPUESTO")
        self.assertEqual(commercial_fdi_level(54.9), "CRITICO")

    def test_confidence_caps_bound_final_score(self):
        result = compute_fdi_confidence(
            universe_coverage=35,
            completeness_quality=95,
            freshness_quality=95,
            input_integrity=95,
        )

        self.assertEqual(result["coverage_cap"], 55.0)
        self.assertEqual(result["integrity_cap"], 100.0)
        self.assertLessEqual(result["score"], 55.0)

    def test_confidence_integrity_cap_applies(self):
        result = compute_fdi_confidence(
            universe_coverage=90,
            completeness_quality=90,
            freshness_quality=90,
            input_integrity=45,
        )

        self.assertEqual(confidence_coverage_cap(90), 100.0)
        self.assertEqual(confidence_integrity_cap(45), 60.0)
        self.assertLessEqual(result["score"], 60.0)

    def test_public_export_strips_internal_meta(self):
        internal_payload = build_internal_fdi_payload(
            generated_at="2026-03-15T00:00:00+00:00",
            days=90,
            period_from="2025-12-16",
            period_to="2026-03-15",
            empresa_id=None,
            has_universe=True,
            breakdown={"DM": 80.0, "SE": 70.0, "SC": 90.0, "EC": 20.0, "DO": 85.0},
            inputs={"total_operaciones": 10},
            actions=[],
        )

        public_payload = export_public_fdi_payload(internal_payload)

        self.assertIn("score", public_payload)
        self.assertNotIn("meta", public_payload)