from django.urls import path

from apps.analytics import views

app_name = "analytics"

urlpatterns = [
    path("view/", views.PageViewBeaconView.as_view(), name="view-beacon"),
    path("overview/", views.OverviewView.as_view(), name="overview"),
    path("traffic/", views.TrafficView.as_view(), name="traffic"),
    path("top-content/", views.TopContentView.as_view(), name="top-content"),
    path("sources/", views.SourcesView.as_view(), name="sources"),
    path("devices/", views.DevicesView.as_view(), name="devices"),
    path("requests-by-status/", views.RequestsByStatusView.as_view(), name="requests-by-status"),
]
