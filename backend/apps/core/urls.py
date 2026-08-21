from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.core import views
from apps.core.dashboard import AuditLogViewSet, DashboardSummaryView

app_name = "core"

router = DefaultRouter()
router.register("audit-logs", AuditLogViewSet, basename="audit-log")
router.register("social-links", views.SocialLinkViewSet, basename="social-link")
router.register("sections", views.PageSectionViewSet, basename="page-section")
router.register("stats", views.StatViewSet, basename="stat")
router.register("faqs", views.FAQViewSet, basename="faq")
router.register("process-steps", views.ProcessStepViewSet, basename="process-step")

urlpatterns = [
    path("settings/", views.SiteSettingsView.as_view(), name="site-settings"),
    path("settings/seo/", views.SEOSettingsView.as_view(), name="seo-settings"),
    path("dashboard/summary/", DashboardSummaryView.as_view(), name="dashboard-summary"),
    path("", include(router.urls)),
]
