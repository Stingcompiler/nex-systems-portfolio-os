from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.blog import views

app_name = "blog"

router = DefaultRouter()
router.register("posts", views.PostViewSet, basename="post")
router.register("categories", views.CategoryViewSet, basename="category")
router.register("tags", views.TagViewSet, basename="tag")

urlpatterns = [
    path("posts/view/", views.PostViewBeaconView.as_view(), name="post-view-beacon"),
    path("", include(router.urls)),
]
