from rest_framework import serializers

from apps.core.fields import TranslatedField, TranslatedJSONField
from apps.media_library.models import MediaFile
from apps.media_library.serializers import MediaFileRefSerializer
from apps.portfolio.models import (
    CaseStudy,
    Certification,
    Education,
    Experience,
    Project,
    ProjectImage,
    Resource,
    Service,
    Technology,
    Testimonial,
)


# --------------------------------------------------------------- التقنيات


class TechnologySerializer(serializers.ModelSerializer):
    description = TranslatedField()
    category_display = serializers.CharField(source="get_category_display", read_only=True)

    class Meta:
        model = Technology
        fields = [
            "id", "name", "slug", "category", "category_display",
            "description", "icon", "color", "proficiency", "is_featured",
        ]


class TechnologyAdminSerializer(serializers.ModelSerializer):
    class Meta:
        model = Technology
        fields = "__all__"


class TechnologyRefSerializer(serializers.ModelSerializer):
    """تمثيل مختصر داخل بطاقات الخدمات والمشاريع."""

    class Meta:
        model = Technology
        fields = ["id", "name", "slug", "category", "icon", "color"]


# --------------------------------------------------------------- الخدمات والحلول


class ServiceListSerializer(serializers.ModelSerializer):
    title = TranslatedField()
    short_description = TranslatedField()
    cover_image = MediaFileRefSerializer(read_only=True)
    sector_display = serializers.CharField(source="get_sector_display", read_only=True)

    class Meta:
        model = Service
        fields = [
            "id", "kind", "sector", "sector_display", "title", "slug",
            "short_description", "icon", "cover_image",
            "price_from", "price_currency", "is_featured", "display_order",
        ]


class ServiceDetailSerializer(ServiceListSerializer):
    description = TranslatedField()
    price_note = TranslatedField()
    duration_estimate = TranslatedField()
    features = TranslatedJSONField()
    deliverables = TranslatedJSONField()
    technologies = TechnologyRefSerializer(many=True, read_only=True)
    related_projects = serializers.SerializerMethodField()
    faqs = serializers.SerializerMethodField()
    seo = serializers.SerializerMethodField()

    class Meta(ServiceListSerializer.Meta):
        fields = ServiceListSerializer.Meta.fields + [
            "description", "price_note", "duration_estimate",
            "features", "deliverables", "technologies",
            "related_projects", "faqs", "view_count", "seo", "published_at",
        ]

    def get_related_projects(self, service: Service) -> list:
        projects = service.related_projects.filter(is_published=True)[:6]
        return ProjectListSerializer(projects, many=True, context=self.context).data

    def get_faqs(self, service: Service) -> list:
        from apps.core.serializers import FAQSerializer

        return FAQSerializer(
            service.faqs.filter(is_active=True), many=True, context=self.context
        ).data

    def get_seo(self, service: Service) -> dict:
        return build_seo_payload(service, self.context, fallback_description="short_description")


class ServiceAdminSerializer(serializers.ModelSerializer):
    publication_blockers = serializers.SerializerMethodField()

    class Meta:
        model = Service
        fields = "__all__"
        read_only_fields = ["view_count", "search_text", "created_by", "updated_by"]

    def get_publication_blockers(self, service: Service) -> list[str]:
        # تُعاد كتلميحات إرشادية فقط — النشر لم يعد مشروطًا بحد أدنى للمحتوى.
        return service.publication_blockers()


# --------------------------------------------------------------- المشاريع


class ProjectImageSerializer(serializers.ModelSerializer):
    caption = TranslatedField()
    image = MediaFileRefSerializer(read_only=True)

    class Meta:
        model = ProjectImage
        fields = ["id", "image", "caption", "display_order"]


class ProjectListSerializer(serializers.ModelSerializer):
    title = TranslatedField()
    summary = TranslatedField()
    cover_image = MediaFileRefSerializer(read_only=True)
    technologies = TechnologyRefSerializer(many=True, read_only=True)
    sector_display = serializers.CharField(source="get_sector_display", read_only=True)
    project_type_display = serializers.CharField(source="get_project_type_display", read_only=True)
    client_name = serializers.CharField(source="public_client_name", read_only=True)
    has_case_study = serializers.SerializerMethodField()

    class Meta:
        model = Project
        fields = [
            "id", "title", "slug", "summary", "cover_image",
            "sector", "sector_display", "project_type", "project_type_display",
            "status", "technologies", "client_name", "completed_at",
            "is_featured", "has_case_study", "live_url",
        ]

    def get_has_case_study(self, project: Project) -> bool:
        case_study = getattr(project, "case_study", None)
        return bool(case_study and case_study.is_published)


class ProjectDetailSerializer(ProjectListSerializer):
    description = TranslatedField()
    images = ProjectImageSerializer(many=True, read_only=True)
    case_study_slug = serializers.SerializerMethodField()
    seo = serializers.SerializerMethodField()

    class Meta(ProjectListSerializer.Meta):
        fields = ProjectListSerializer.Meta.fields + [
            "description", "images", "video_url",
            "github_url", "play_store_url", "app_store_url",
            "case_study_slug", "view_count", "seo", "published_at",
        ]

    def get_case_study_slug(self, project: Project) -> str | None:
        case_study = getattr(project, "case_study", None)
        return case_study.slug if case_study and case_study.is_published else None

    def get_seo(self, project: Project) -> dict:
        return build_seo_payload(project, self.context, fallback_description="summary")


class ProjectImageAdminSerializer(serializers.ModelSerializer):
    """صورة معرض واحدة كما تُكتب من اللوحة — الوسيط بمعرّفه لا ككائن."""

    image = serializers.PrimaryKeyRelatedField(queryset=MediaFile.objects.all())
    #: القراءة تحتاج الرابط لعرض مصغّرة في اللوحة، والكتابة تحتاج المعرّف وحده
    image_detail = MediaFileRefSerializer(source="image", read_only=True)

    class Meta:
        model = ProjectImage
        fields = ["id", "image", "image_detail", "caption_ar", "caption_en"]


class ProjectAdminSerializer(serializers.ModelSerializer):
    images = ProjectImageAdminSerializer(many=True, required=False)

    class Meta:
        model = Project
        fields = "__all__"
        read_only_fields = ["view_count", "search_text", "created_by", "updated_by"]

    def create(self, validated_data):
        images = validated_data.pop("images", None)
        project = super().create(validated_data)
        if images is not None:
            self._sync_images(project, images)
        return project

    def update(self, instance, validated_data):
        # الغياب يعني «لم يُرسل هذا الحقل» لا «احذف كل الصور»: اللوحة تحفظ
        # تبويبًا واحدًا أحيانًا، فالحذف الضمني يفقد المعرض بلا قصد.
        images = validated_data.pop("images", None)
        project = super().update(instance, validated_data)
        if images is not None:
            self._sync_images(project, images)
        return project

    @staticmethod
    def _sync_images(project: Project, images: list[dict]) -> None:
        """يجعل معرض المشروع مطابقًا للقائمة المرسلة، وترتيبها هو ترتيبها."""
        project.images.all().delete()
        ProjectImage.objects.bulk_create(
            [
                ProjectImage(
                    project=project,
                    image=item["image"],
                    caption_ar=item.get("caption_ar", ""),
                    caption_en=item.get("caption_en", ""),
                    display_order=order,
                )
                for order, item in enumerate(images)
            ]
        )


# --------------------------------------------------------------- دراسات الحالة


class CaseStudyListSerializer(serializers.ModelSerializer):
    title = TranslatedField()
    overview = TranslatedField()
    project = ProjectListSerializer(read_only=True)

    class Meta:
        model = CaseStudy
        fields = ["id", "title", "slug", "overview", "project", "published_at"]


class CaseStudyDetailSerializer(CaseStudyListSerializer):
    problem = TranslatedField()
    requirements = TranslatedField()
    challenges = TranslatedField()
    solution = TranslatedField()
    architecture = TranslatedField()
    results = TranslatedField()
    lessons = TranslatedField()
    development_phases = TranslatedJSONField()
    metrics = TranslatedJSONField()
    diagram_image = MediaFileRefSerializer(read_only=True)
    testimonial = serializers.SerializerMethodField()
    related_services = ServiceListSerializer(many=True, read_only=True)
    seo = serializers.SerializerMethodField()

    class Meta(CaseStudyListSerializer.Meta):
        fields = CaseStudyListSerializer.Meta.fields + [
            "problem", "requirements", "challenges", "solution", "architecture",
            "results", "lessons", "development_phases", "metrics",
            "diagram_image", "testimonial", "related_services", "view_count", "seo",
        ]

    def get_testimonial(self, case_study: CaseStudy) -> dict | None:
        if case_study.testimonial and case_study.testimonial.is_published:
            return TestimonialSerializer(case_study.testimonial, context=self.context).data
        return None

    def get_seo(self, case_study: CaseStudy) -> dict:
        return build_seo_payload(case_study, self.context, fallback_description="overview")


class CaseStudyAdminSerializer(serializers.ModelSerializer):
    class Meta:
        model = CaseStudy
        fields = "__all__"
        read_only_fields = ["view_count", "search_text", "created_by", "updated_by"]


# --------------------------------------------------------------- صفحة «نبذة»


class TestimonialSerializer(serializers.ModelSerializer):
    client_name = TranslatedField()
    client_title = TranslatedField()
    company = TranslatedField()
    content = TranslatedField()
    avatar = MediaFileRefSerializer(read_only=True)

    class Meta:
        model = Testimonial
        fields = [
            "id", "client_name", "client_title", "company", "content",
            "rating", "avatar", "project", "proof_url", "is_featured",
        ]


class TestimonialAdminSerializer(serializers.ModelSerializer):
    class Meta:
        model = Testimonial
        fields = "__all__"


class ExperienceSerializer(serializers.ModelSerializer):
    title = TranslatedField()
    organization = TranslatedField()
    location = TranslatedField()
    description = TranslatedField()

    class Meta:
        model = Experience
        fields = [
            "id", "title", "organization", "location",
            "start_date", "end_date", "is_current", "description",
        ]


class EducationSerializer(serializers.ModelSerializer):
    degree = TranslatedField()
    institution = TranslatedField()
    field = TranslatedField()
    description = TranslatedField()

    class Meta:
        model = Education
        fields = [
            "id", "degree", "institution", "field",
            "start_date", "end_date", "description",
        ]


class CertificationSerializer(serializers.ModelSerializer):
    name = TranslatedField()
    issuer = TranslatedField()
    image = MediaFileRefSerializer(read_only=True)

    class Meta:
        model = Certification
        fields = [
            "id", "name", "issuer", "issue_date", "expiry_date",
            "credential_id", "credential_url", "image",
        ]


class ResourceSerializer(serializers.ModelSerializer):
    title = TranslatedField()
    description = TranslatedField()
    cover_image = MediaFileRefSerializer(read_only=True)
    file = MediaFileRefSerializer(read_only=True)

    class Meta:
        model = Resource
        fields = [
            "id", "title", "slug", "description", "kind",
            "file", "url", "cover_image", "requires_membership", "download_count",
        ]


# --------------------------------------------------------------- أدوات مشتركة


def build_seo_payload(instance, context: dict, fallback_description: str) -> dict:
    """يبني بيانات SEO لكل عنصر مع ارتداد إلى محتواه ثم إلى الإعدادات العامة."""
    request = context.get("request")
    language = getattr(request, "language", "ar")

    title = getattr(instance, f"seo_title_{language}", "") or instance.tr("title")
    description = getattr(instance, f"seo_description_{language}", "") or instance.tr(
        fallback_description
    )

    image = None
    og_image = getattr(instance, "og_image", None) or getattr(instance, "cover_image", None)
    if og_image is not None:
        image = MediaFileRefSerializer(og_image, context=context).data

    return {
        "title": title,
        "description": (description or "")[:320],
        "image": image,
    }
