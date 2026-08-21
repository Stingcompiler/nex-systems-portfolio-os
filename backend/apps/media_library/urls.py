from rest_framework.routers import DefaultRouter

from apps.media_library.views import MediaFileViewSet, MediaFolderViewSet

app_name = "media_library"

router = DefaultRouter()
router.register("folders", MediaFolderViewSet, basename="media-folder")
router.register("", MediaFileViewSet, basename="media-file")

urlpatterns = router.urls
