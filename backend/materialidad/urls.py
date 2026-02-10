from __future__ import annotations

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    ChecklistItemViewSet,
    ChecklistViewSet,
    ClauseTemplateViewSet,
    ContratoTemplateViewSet,
    ContratoViewSet,
    DashboardMetricsView,
    DashboardSnapshotHistoryView,
    CFDISPEIValidationView,
    EmpresaViewSet,
    DeliverableRequirementViewSet,
    OperacionEntregableViewSet,
    CuentaBancariaViewSet,
    EstadoCuentaViewSet,
    MovimientoBancarioViewSet,
    OperacionConciliacionViewSet,
    LegalConsultationViewSet,
    LegalReferenceSourceViewSet,
    OperacionViewSet,
    AuditLogViewSet,
    ProveedorViewSet,
    RazonNegocioAprobacionViewSet,
    PriceComparisonView,
)

router = DefaultRouter()
router.register("empresas", EmpresaViewSet, basename="empresa")
router.register("proveedores", ProveedorViewSet, basename="proveedor")
router.register("contrato-templates", ContratoTemplateViewSet, basename="contrato-template")
router.register("clause-templates", ClauseTemplateViewSet, basename="clause-template")
router.register("contratos", ContratoViewSet, basename="contrato")
router.register("operaciones", OperacionViewSet, basename="operacion")
router.register("audit-log", AuditLogViewSet, basename="audit-log")
router.register("cuentas-bancarias", CuentaBancariaViewSet, basename="cuenta-bancaria")
router.register("estados-cuenta", EstadoCuentaViewSet, basename="estado-cuenta")
router.register("movimientos-bancarios", MovimientoBancarioViewSet, basename="movimiento-bancario")
router.register("conciliaciones", OperacionConciliacionViewSet, basename="conciliacion")
router.register("fuentes-legales", LegalReferenceSourceViewSet, basename="legal-reference")
router.register("consultas-legales", LegalConsultationViewSet, basename="legal-consultation")
router.register("checklists", ChecklistViewSet, basename="checklist")
router.register("checklist-items", ChecklistItemViewSet, basename="checklist-item")
router.register("entregables", DeliverableRequirementViewSet, basename="entregable")
router.register("operacion-entregables", OperacionEntregableViewSet, basename="operacion-entregable")
router.register(
    "razon-negocio-aprobaciones",
    RazonNegocioAprobacionViewSet,
    basename="razon-negocio-aprobacion",
)

urlpatterns = [
    path("", include(router.urls)),
    path("dashboard/metricas/", DashboardMetricsView.as_view(), name="dashboard-metrics"),
    path(
        "dashboard/metricas/historico/",
        DashboardSnapshotHistoryView.as_view(),
        name="dashboard-metrics-history",
    ),
    path(
        "validar-cfdi-spei/",
        CFDISPEIValidationView.as_view(),
        name="validar-cfdi-spei",
    ),
    path(
        "comparar-precios/",
        PriceComparisonView.as_view(),
        name="comparar-precios",
    ),
]
