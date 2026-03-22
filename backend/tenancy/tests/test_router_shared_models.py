from django.test import SimpleTestCase

from materialidad.models import LegalConsultation, LegalCorpusUpload, LegalReferenceSource
from tenancy.routers import TenantDatabaseRouter


class TenantDatabaseRouterTests(SimpleTestCase):
    def test_legal_models_shared_with_control_db(self):
        router = TenantDatabaseRouter()

        self.assertEqual(router.db_for_read(LegalCorpusUpload), "default")
        self.assertEqual(router.db_for_write(LegalCorpusUpload), "default")
        self.assertEqual(router.db_for_read(LegalReferenceSource), "default")
        self.assertEqual(router.db_for_write(LegalReferenceSource), "default")
        self.assertEqual(router.db_for_read(LegalConsultation), "default")
        self.assertEqual(router.db_for_write(LegalConsultation), "default")

    def test_legal_corpus_upload_does_not_migrate_on_tenant_db(self):
        router = TenantDatabaseRouter()

        self.assertFalse(router.allow_migrate("tenant_demo", "materialidad", "legalcorpusupload"))
        self.assertTrue(router.allow_migrate("default", "materialidad", "legalcorpusupload"))