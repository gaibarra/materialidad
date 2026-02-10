#!/usr/bin/env python
import django, os, sys
os.chdir(os.path.join(os.path.dirname(__file__), '..', 'backend'))
sys.path.insert(0, os.getcwd())
os.environ['DJANGO_SETTINGS_MODULE'] = 'materialidad_backend.settings'
django.setup()

from tenancy.models import Tenant
from django.conf import settings

print("=== Active Tenants ===")
for t in Tenant.objects.filter(is_active=True):
    print(f"  {t.slug} -> db_alias={t.db_alias}, db_name={t.db_name}")

print("\n=== Database configs ===")
for alias in settings.DATABASES:
    db = settings.DATABASES[alias]
    print(f"  DB[{alias}]: name={db.get('NAME')}, user={db.get('USER')}")
