from django.urls import path
from .views import (
    ExecutiveDashboardSummaryView,
    FiscalDefenseIndexView,
    FiscalDefenseNarrativeView,
    FiscalDefenseIndexHistoryView,
    FDIJobRunHistoryView,
)

urlpatterns = [
    path('executive-summary/', ExecutiveDashboardSummaryView.as_view(), name='dashboard-executive-summary'),
    path('fdi/', FiscalDefenseIndexView.as_view(), name='dashboard-fdi'),
    path('fdi/narrative/', FiscalDefenseNarrativeView.as_view(), name='dashboard-fdi-narrative'),
    path('fdi/history/', FiscalDefenseIndexHistoryView.as_view(), name='dashboard-fdi-history'),
    path('fdi/job-runs/', FDIJobRunHistoryView.as_view(), name='dashboard-fdi-job-runs'),
]
