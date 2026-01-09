from __future__ import annotations

from django.urls import path

from .views import DespachoListView, TenantProvisionView

urlpatterns = [
    path("provision/", TenantProvisionView.as_view(), name="tenant_provision"),
    path("despachos/", DespachoListView.as_view(), name="despacho_list"),
]
