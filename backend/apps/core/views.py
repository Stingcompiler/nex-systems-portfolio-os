from django.db import connection, transaction
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.generics import RetrieveUpdateAPIView
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.models.content import FAQ, PageSection, ProcessStep, Stat
from apps.core.models.settings import SEOSettings, SiteSettings, SocialLink
from apps.core.permissions import PublicReadWriteProtected
from apps.core.viewsets import PublicContentViewSet
from apps.core.serializers import (
    FAQAdminSerializer,
    FAQSerializer,
    PageSectionAdminSerializer,
    PageSectionSerializer,
    ProcessStepAdminSerializer,
    ProcessStepSerializer,
    SectionReorderSerializer,
    SEOSettingsAdminSerializer,
    SEOSettingsPublicSerializer,
    SiteSettingsAdminSerializer,
    SiteSettingsPublicSerializer,
    SocialLinkSerializer,
    StatAdminSerializer,
    StatSerializer,
)


class HealthSerializer(serializers.Serializer):
    status = serializers.CharField(read_only=True)
    database = serializers.CharField(read_only=True)
    language = serializers.CharField(read_only=True)


class HealthView(APIView):
    """فحص حالة الخدمة — يستخدمه النشر والمراقبة."""

    permission_classes = [AllowAny]
    authentication_classes = []

    @extend_schema(summary="فحص حالة الخدمة", responses={200: HealthSerializer})
    def get(self, request):
        database_ok = True
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
                cursor.fetchone()
        except Exception:  # noqa: BLE001
            database_ok = False

        payload = {
            "status": "ok" if database_ok else "degraded",
            "database": "ok" if database_ok else "error",
            "language": getattr(request, "language", "ar"),
        }
        return Response(
            payload,
            status=status.HTTP_200_OK if database_ok else status.HTTP_503_SERVICE_UNAVAILABLE,
        )


class SingletonSettingsView(RetrieveUpdateAPIView):
    """قراءة عامة، وتعديل يتطلب صلاحية محددة."""

    model = None
    public_serializer_class = None
    admin_serializer_class = None
    permission_classes = [PublicReadWriteProtected]
    http_method_names = ["get", "patch", "head", "options"]

    def get_object(self):
        return self.model.load()

    def get_serializer_class(self):
        if self.request.method == "GET" and not self._is_manager():
            return self.public_serializer_class
        return self.admin_serializer_class

    def _is_manager(self) -> bool:
        user = self.request.user
        if not (user and user.is_authenticated):
            return False
        return user.is_superuser or all(
            user.has_perm(permission) for permission in self.required_permissions
        )


@extend_schema_view(
    get=extend_schema(summary="إعدادات الموقع العامة"),
    patch=extend_schema(summary="تعديل إعدادات الموقع"),
)
class SiteSettingsView(SingletonSettingsView):
    model = SiteSettings
    public_serializer_class = SiteSettingsPublicSerializer
    admin_serializer_class = SiteSettingsAdminSerializer
    required_permissions = ["core.manage_settings"]


@extend_schema_view(
    get=extend_schema(summary="إعدادات SEO"),
    patch=extend_schema(summary="تعديل إعدادات SEO"),
)
class SEOSettingsView(SingletonSettingsView):
    model = SEOSettings
    public_serializer_class = SEOSettingsPublicSerializer
    admin_serializer_class = SEOSettingsAdminSerializer
    required_permissions = ["core.manage_seo"]


class SettingsContentViewSet(PublicContentViewSet):
    """محتوى إعدادات بعدد صفوف محدود.

    بلا ترقيم صفحات لسببين: القوائم قصيرة بطبيعتها (عشرات الصفوف على الأكثر)،
    ولأن معامل `page` في ترقيم DRF يتصادم مع حقل `page` في نموذج الأقسام.
    """

    publishable = False
    pagination_class = None


@extend_schema_view(
    list=extend_schema(summary="روابط التواصل الاجتماعي"),
)
class SocialLinkViewSet(SettingsContentViewSet):
    queryset = SocialLink.objects.all()
    public_serializer_class = SocialLinkSerializer
    admin_serializer_class = SocialLinkSerializer
    filterset_fields = ["platform", "is_active"]

    def get_queryset(self):
        queryset = super().get_queryset()
        if self.action in ("list", "retrieve") and not self._wants_admin_view():
            queryset = queryset.filter(is_active=True)
        return queryset


@extend_schema_view(
    list=extend_schema(summary="أقسام الصفحات مرتبة"),
)
class PageSectionViewSet(SettingsContentViewSet):
    queryset = PageSection.objects.select_related("image").all()
    public_serializer_class = PageSectionSerializer
    admin_serializer_class = PageSectionAdminSerializer
    filterset_fields = ["page", "key", "is_visible"]
    # الأقسام تُنشأ بالتهيئة لا من الواجهة، فكل كتابة عليها تعديل.
    required_permissions = ["core.change_pagesection"]

    def get_queryset(self):
        queryset = super().get_queryset()
        if self.action in ("list", "retrieve") and not self._wants_admin_view():
            queryset = queryset.filter(is_visible=True)
        return queryset

    @extend_schema(
        summary="إعادة ترتيب الأقسام دفعة واحدة",
        request=SectionReorderSerializer,
        responses={200: PageSectionSerializer(many=True)},
    )
    @action(detail=False, methods=["post"], url_path="reorder")
    def reorder(self, request):
        serializer = SectionReorderSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        order = serializer.validated_data["order"]
        sections = {section.pk: section for section in PageSection.objects.filter(id__in=order)}

        with transaction.atomic():
            for position, section_id in enumerate(order):
                section = sections[section_id]
                section.display_order = position
                section.save(update_fields=["display_order", "updated_at"])

        refreshed = PageSection.objects.filter(id__in=order).order_by("display_order")
        return Response(
            PageSectionAdminSerializer(refreshed, many=True, context={"request": request}).data
        )


@extend_schema_view(list=extend_schema(summary="إحصائيات الصفحة الرئيسية"))
class StatViewSet(SettingsContentViewSet):
    queryset = Stat.objects.all()
    public_serializer_class = StatSerializer
    admin_serializer_class = StatAdminSerializer
    filterset_fields = ["is_active"]

    def get_queryset(self):
        queryset = super().get_queryset()
        if self.action in ("list", "retrieve") and not self._wants_admin_view():
            queryset = queryset.filter(is_active=True)
        return queryset


@extend_schema_view(list=extend_schema(summary="الأسئلة الشائعة"))
class FAQViewSet(SettingsContentViewSet):
    queryset = FAQ.objects.select_related("service").all()
    public_serializer_class = FAQSerializer
    admin_serializer_class = FAQAdminSerializer
    filterset_fields = ["scope", "service", "is_active"]

    def get_queryset(self):
        queryset = super().get_queryset()
        if self.action in ("list", "retrieve") and not self._wants_admin_view():
            queryset = queryset.filter(is_active=True)
        return queryset


@extend_schema_view(list=extend_schema(summary="مراحل العمل"))
class ProcessStepViewSet(SettingsContentViewSet):
    queryset = ProcessStep.objects.all()
    public_serializer_class = ProcessStepSerializer
    admin_serializer_class = ProcessStepAdminSerializer
    filterset_fields = ["is_active"]

    def get_queryset(self):
        queryset = super().get_queryset()
        if self.action in ("list", "retrieve") and not self._wants_admin_view():
            queryset = queryset.filter(is_active=True)
        return queryset
