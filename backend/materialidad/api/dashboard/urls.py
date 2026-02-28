from django.urls import path
from .views import ExecutiveDashboardSummaryView

urlpatterns = [
    path('executive-summary/', ExecutiveDashboardSummaryView.as_view(), name='dashboard-executive-summary'),
]
