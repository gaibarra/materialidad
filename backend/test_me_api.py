import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from rest_framework.test import APIClient
from accounts.models import User
from tenancy.models import Tenant

client = APIClient()
u = User.objects.get(email="amadariaga@modelo.edu.mx")
client.force_authenticate(user=u)

# Test with casaclub explicitly
response = client.get('/api/accounts/me/', HTTP_X_TENANT='casaclub')
print("With X-Tenant='casaclub':", response.json().get('tenant_slug'))

# Test without explicit tenant
response = client.get('/api/accounts/me/')
print("Without X-Tenant:", response.json().get('tenant_slug'))
