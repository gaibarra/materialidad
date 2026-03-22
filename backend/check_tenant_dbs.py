import os, django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "materialidad_backend.settings")
django.setup()

from tenancy.models import Tenant
from materialidad.models import Empresa
from tenancy.context import TenantContext

def check_tenant(slug):
    try:
        TenantContext.activate(slug)
        empresas = list(Empresa.objects.all().values_list('razon_social', flat=True))
        print(f"[{slug}] Empresas ({len(empresas)}): {empresas[:3]}")
    finally:
        TenantContext.clear()

check_tenant("casaclub")
check_tenant("escuelamodelo")
