from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.accounts.admin_api import RolesView, UserAdminViewSet

app_name = "accounts_admin"

router = DefaultRouter()
router.register("users", UserAdminViewSet, basename="user")

urlpatterns = [
    path("roles/", RolesView.as_view(), name="roles"),
    path("", include(router.urls)),
]
