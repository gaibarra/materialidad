from __future__ import annotations

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .admin_views import DespachoViewSet
from .views import DespachoListView, TenantProvisionView

router = DefaultRouter()
router.register(r"admin/despachos", DespachoViewSet, basename="admin-despacho")

urlpatterns = [
    path("", include(router.urls)),
    path("provision/", TenantProvisionView.as_view(), name="tenant_provision"),
    path("despachos/", DespachoListView.as_view(), name="despacho_list"),
]
