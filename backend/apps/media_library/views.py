from django.db.models import ProtectedError
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response

from apps.core.mixins import AuditLogMixin
from apps.core.pagination import LargePagination
from apps.core.permissions import HasDashboardPermission
from apps.media_library.models import MediaFile, MediaFolder
from apps.media_library.serializers import (
    MediaFileSerializer,
    MediaFolderSerializer,
    MediaUploadSerializer,
)


@extend_schema_view(
    list=extend_schema(summary="قائمة مجلدات الوسائط"),
    create=extend_schema(summary="إنشاء مجلد"),
)
class MediaFolderViewSet(AuditLogMixin, viewsets.ModelViewSet):
    queryset = MediaFolder.objects.select_related("parent").all()
    serializer_class = MediaFolderSerializer
    permission_classes = [HasDashboardPermission]
    required_permissions = ["core.manage_media"]
    pagination_class = LargePagination

    def destroy(self, request, *args, **kwargs):
        folder = self.get_object()
        if folder.files.exists():
            return Response(
                {
                    "detail": "لا يمكن حذف مجلد يحتوي على ملفات",
                    "code": "folder_not_empty",
                    "errors": {},
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().destroy(request, *args, **kwargs)


@extend_schema_view(
    list=extend_schema(summary="قائمة ملفات الوسائط"),
    retrieve=extend_schema(summary="تفاصيل ملف"),
    partial_update=extend_schema(summary="تعديل العنوان والنص البديل والمجلد"),
    destroy=extend_schema(summary="حذف ملف"),
)
class MediaFileViewSet(AuditLogMixin, viewsets.ModelViewSet):
    queryset = MediaFile.objects.select_related("folder", "uploaded_by").all()
    serializer_class = MediaFileSerializer
    permission_classes = [HasDashboardPermission]
    required_permissions = ["core.manage_media"]
    pagination_class = LargePagination
    parser_classes = [MultiPartParser, FormParser]
    filterset_fields = ["file_type", "folder"]
    search_fields = ["original_name", "title_ar", "title_en", "alt_ar", "alt_en"]
    ordering_fields = ["created_at", "size", "original_name"]
    http_method_names = ["get", "patch", "delete", "post", "head", "options"]

    def get_serializer_class(self):
        if self.action == "upload":
            return MediaUploadSerializer
        return MediaFileSerializer

    @extend_schema(
        summary="رفع ملف جديد",
        request=MediaUploadSerializer,
        responses={201: MediaFileSerializer},
    )
    @action(detail=False, methods=["post"], url_path="upload")
    def upload(self, request):
        serializer = MediaUploadSerializer(
            data=request.data, context=self.get_serializer_context()
        )
        serializer.is_valid(raise_exception=True)
        media = serializer.save()
        return Response(
            MediaFileSerializer(media, context=self.get_serializer_context()).data,
            status=status.HTTP_201_CREATED,
        )

    def create(self, request, *args, **kwargs):
        return Response(
            {
                "detail": "استخدم /media/upload/ لرفع الملفات",
                "code": "method_not_allowed",
                "errors": {},
            },
            status=status.HTTP_405_METHOD_NOT_ALLOWED,
        )

    def destroy(self, request, *args, **kwargs):
        media = self.get_object()
        forced = request.query_params.get("force") == "true"

        if media.usage_count > 0 and not forced:
            return Response(
                {
                    "detail": (
                        f"هذا الملف مستخدم في {media.usage_count} عنصرًا. "
                        "أضف force=true للحذف رغم ذلك."
                    ),
                    "code": "media_in_use",
                    "errors": {},
                },
                status=status.HTTP_409_CONFLICT,
            )

        try:
            return super().destroy(request, *args, **kwargs)
        except ProtectedError:
            return Response(
                {
                    "detail": "الملف مرتبط بمحتوى منشور ولا يمكن حذفه",
                    "code": "media_protected",
                    "errors": {},
                },
                status=status.HTTP_409_CONFLICT,
            )
