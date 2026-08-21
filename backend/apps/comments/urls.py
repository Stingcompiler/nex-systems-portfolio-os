from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.comments import views

app_name = "comments"

router = DefaultRouter()
router.register("comments/moderation", views.CommentModerationViewSet, basename="comment-moderation")
router.register("comment-reports", views.CommentReportModerationViewSet, basename="comment-report")
router.register("blocked-emails", views.BlockedEmailViewSet, basename="blocked-email")

urlpatterns = [
    path("comments/", views.PublicCommentView.as_view(), name="comments"),
    path("comments/mine/", views.MyCommentsView.as_view(), name="my-comments"),
    path("comments/report/", views.CommentReportView.as_view(), name="comment-report"),
    path("", include(router.urls)),
]
