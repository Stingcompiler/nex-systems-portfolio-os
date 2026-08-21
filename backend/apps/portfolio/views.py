from django.db.models import Prefetch
from django.utils import timezone
from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.core.audit import log_action
from apps.core.models.system import AuditLog
from apps.core.viewsets import PublicContentViewSet
from apps.portfolio.filters import (
    CaseStudyFilter,
    ProjectFilter,
    ServiceFilter,
    TechnologyFilter,
)
from apps.portfolio.models import (
    CaseStudy,
    Certification,
    Education,
    Experience,
    Project,
    Resource,
    Service,
    Technology,
    Testimonial,
)
from apps.portfolio.serializers import (
    CaseStudyAdminSerializer,
    CaseStudyDetailSerializer,
    CaseStudyListSerializer,
    CertificationSerializer,
    EducationSerializer,
    ExperienceSerializer,
    ProjectAdminSerializer,
    ProjectDetailSerializer,
    ProjectListSerializer,
    ResourceSerializer,
    ServiceAdminSerializer,
    ServiceDetailSerializer,
    ServiceListSerializer,
    TechnologyAdminSerializer,
    TechnologySerializer,
    TestimonialAdminSerializer,
    TestimonialSerializer,
)

_LANGUAGE_PARAM = OpenApiParameter(
    name="Accept-Language",
    location=OpenApiParameter.HEADER,
    description="لغة الحقول المترجمة: ar أو en",
    required=False,
    type=str,
)


@extend_schema_view(
    list=extend_schema(summary="قائمة التقنيات", parameters=[_LANGUAGE_PARAM]),
    retrieve=extend_schema(summary="تفاصيل تقنية"),
)
class TechnologyViewSet(PublicContentViewSet):
    queryset = Technology.objects.all()
    public_serializer_class = TechnologySerializer
    admin_serializer_class = TechnologyAdminSerializer
    filterset_class = TechnologyFilter
    lookup_field = "slug"
    publishable = False
    ordering_fields = ["display_order", "name", "proficiency"]

    def get_queryset(self):
        queryset = super().get_queryset()
        if self.action in ("list", "retrieve") and not self._wants_admin_view():
            queryset = queryset.filter(is_active=True)
        return queryset


class BaseServiceViewSet(PublicContentViewSet):
    queryset = Service.objects.select_related("cover_image", "og_image").prefetch_related(
        "technologies", "faqs"
    )
    public_serializer_class = ServiceListSerializer
    detail_serializer_class = ServiceDetailSerializer
    admin_serializer_class = ServiceAdminSerializer
    filterset_class = ServiceFilter
    lookup_field = "slug"
    ordering_fields = ["display_order", "created_at", "view_count"]

    #: تُحدَّد في الفئة الوارثة
    kind: str | None = None

    def get_queryset(self):
        queryset = super().get_queryset()
        if self.kind:
            queryset = queryset.filter(kind=self.kind)
        return queryset.distinct()

    def perform_create(self, serializer):
        if self.kind and "kind" not in serializer.validated_data:
            serializer.validated_data["kind"] = self.kind
        return super().perform_create(serializer)

    @extend_schema(
        summary="نشر الخدمة بعد التحقق من كفاية المحتوى",
        request=None,
        responses={200: ServiceAdminSerializer},
    )
    @action(detail=True, methods=["post"], url_path="publish")
    def publish(self, request, slug=None):
        # النشر اختياري بلا حد أدنى للمحتوى؛ تبقى `publication_blockers`
        # تلميحات إرشادية في اللوحة دون منع النشر.
        service = self.get_object()
        service.publish()
        log_action(AuditLog.Action.PUBLISH, instance=service, request=request)
        return Response(ServiceAdminSerializer(service, context={"request": request}).data)

    @extend_schema(summary="إلغاء نشر الخدمة", request=None)
    @action(detail=True, methods=["post"], url_path="unpublish")
    def unpublish(self, request, slug=None):
        service = self.get_object()
        service.unpublish()
        log_action(AuditLog.Action.UNPUBLISH, instance=service, request=request)
        return Response(ServiceAdminSerializer(service, context={"request": request}).data)


@extend_schema_view(
    list=extend_schema(summary="الخدمات التطويرية", parameters=[_LANGUAGE_PARAM]),
    retrieve=extend_schema(summary="تفاصيل خدمة"),
)
class ServiceViewSet(BaseServiceViewSet):
    kind = Service.Kind.SERVICE


@extend_schema_view(
    list=extend_schema(summary="الحلول القطاعية", parameters=[_LANGUAGE_PARAM]),
    retrieve=extend_schema(summary="تفاصيل حل قطاعي"),
)
class SolutionViewSet(BaseServiceViewSet):
    kind = Service.Kind.SOLUTION


@extend_schema_view(
    list=extend_schema(summary="المشاريع", parameters=[_LANGUAGE_PARAM]),
    retrieve=extend_schema(summary="تفاصيل مشروع"),
)
class ProjectViewSet(PublicContentViewSet):
    queryset = (
        Project.objects.select_related("cover_image", "og_image", "case_study")
        .prefetch_related("technologies", "images__image")
    )
    public_serializer_class = ProjectListSerializer
    detail_serializer_class = ProjectDetailSerializer
    admin_serializer_class = ProjectAdminSerializer
    filterset_class = ProjectFilter
    lookup_field = "slug"
    ordering_fields = ["display_order", "completed_at", "created_at", "view_count"]

    def get_queryset(self):
        return super().get_queryset().distinct()

    @extend_schema(summary="المشاريع المميزة فقط")
    @action(detail=False, methods=["get"], url_path="featured")
    def featured(self, request):
        queryset = self.filter_queryset(self.get_queryset()).filter(is_featured=True)[:6]
        serializer = ProjectListSerializer(queryset, many=True, context={"request": request})
        return Response(serializer.data)


@extend_schema_view(
    list=extend_schema(summary="دراسات الحالة", parameters=[_LANGUAGE_PARAM]),
    retrieve=extend_schema(summary="تفاصيل دراسة حالة"),
)
class CaseStudyViewSet(PublicContentViewSet):
    queryset = CaseStudy.objects.select_related(
        "project", "project__cover_image", "diagram_image", "testimonial"
    ).prefetch_related("related_services")
    public_serializer_class = CaseStudyListSerializer
    detail_serializer_class = CaseStudyDetailSerializer
    admin_serializer_class = CaseStudyAdminSerializer
    filterset_class = CaseStudyFilter
    lookup_field = "slug"


@extend_schema_view(list=extend_schema(summary="شهادات العملاء"))
class TestimonialViewSet(PublicContentViewSet):
    queryset = Testimonial.objects.select_related("avatar", "project").all()
    public_serializer_class = TestimonialSerializer
    admin_serializer_class = TestimonialAdminSerializer
    filterset_fields = ["is_featured", "project"]


@extend_schema_view(list=extend_schema(summary="الخبرات العملية"))
class ExperienceViewSet(PublicContentViewSet):
    queryset = Experience.objects.all()
    public_serializer_class = ExperienceSerializer
    admin_serializer_class = ExperienceSerializer
    publishable = False

    def get_queryset(self):
        queryset = super().get_queryset()
        if self.action in ("list", "retrieve") and not self._wants_admin_view():
            queryset = queryset.filter(is_active=True)
        return queryset


@extend_schema_view(list=extend_schema(summary="المؤهلات العلمية"))
class EducationViewSet(ExperienceViewSet):
    queryset = Education.objects.all()
    public_serializer_class = EducationSerializer
    admin_serializer_class = EducationSerializer


@extend_schema_view(list=extend_schema(summary="الشهادات"))
class CertificationViewSet(ExperienceViewSet):
    queryset = Certification.objects.select_related("image").all()
    public_serializer_class = CertificationSerializer
    admin_serializer_class = CertificationSerializer


@extend_schema_view(list=extend_schema(summary="الموارد القابلة للتحميل"))
class ResourceViewSet(PublicContentViewSet):
    queryset = Resource.objects.select_related("file", "cover_image").all()
    public_serializer_class = ResourceSerializer
    admin_serializer_class = ResourceSerializer
    filterset_fields = ["kind", "requires_membership"]
    lookup_field = "slug"
