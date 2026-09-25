from django.urls import path
from rest_framework.routers import DefaultRouter

from apps.notifications.views import (
    NotificationViewSet,
    PushKeyView,
    PushSubscribeView,
    PushTestView,
    PushUnsubscribeView,
)

app_name = "notifications"

router = DefaultRouter()
router.register("", NotificationViewSet, basename="notification")

# قبل مسارات الـ ViewSet: الجذر "" يلتقط «push» معرّفًا لإشعار
urlpatterns = [
    path("push/key/", PushKeyView.as_view(), name="push-key"),
    path("push/subscribe/", PushSubscribeView.as_view(), name="push-subscribe"),
    path("push/unsubscribe/", PushUnsubscribeView.as_view(), name="push-unsubscribe"),
    path("push/test/", PushTestView.as_view(), name="push-test"),
    *router.urls,
]
