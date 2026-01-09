from __future__ import annotations

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    AccountMeView,
    TenantAIConfigView,
    TenantTokenObtainPairView,
    TenantTokenRefreshView,
    UserViewSet,
)

router = DefaultRouter()
router.register("users", UserViewSet, basename="user")

urlpatterns = [
    path("token/", TenantTokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("token/refresh/", TenantTokenRefreshView.as_view(), name="token_refresh"),
    path("me/", AccountMeView.as_view(), name="account_me"),
    path("ai-config/", TenantAIConfigView.as_view(), name="tenant_ai_config"),
    path("", include(router.urls)),
]
