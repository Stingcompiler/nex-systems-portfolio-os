from rest_framework import serializers

from apps.crm.enums import RequestStatus
from apps.crm.models import (
    Client,
    ClientReply,
    ContactMessage,
    CrmAttachment,
    CrmNote,
    FollowUp,
    Interaction,
    Lead,
    ProjectRequest,
    RequestAttachment,
)
from apps.portfolio.models import Service

#: أقصر وصف يكفي لفهم الحاجة والرد عليها — جملة واحدة لا كلمة.
MIN_REQUEST_DESCRIPTION = 10

# --------------------------------------------------------------- عام (نماذج الموقع)


class ContactMessageCreateSerializer(serializers.ModelSerializer):
    # حقل خادع لمكافحة السبام — يجب أن يبقى فارغًا
    website = serializers.CharField(required=False, allow_blank=True, write_only=True)

    class Meta:
        model = ContactMessage
        fields = ["name", "email", "phone", "subject", "message", "language", "website"]

    def validate_website(self, value):
        if value:
            raise serializers.ValidationError("تعذّر إرسال الرسالة")
        return value

    def validate_name(self, value):
        # الحقل اختياري؛ نطبّع الفراغات فقط دون فرض حد أدنى للطول
        return " ".join(value.split())

    def validate_email(self, value):
        return value.lower().strip()

    def validate(self, attrs):
        # رسالة يمكن الرد عليها: نصّ ووسيلة تواصل واحدة على الأقل
        if not (attrs.get("message") or "").strip():
            raise serializers.ValidationError({"message": "اكتب رسالتك"})
        if not attrs.get("email") and not (attrs.get("phone") or "").strip():
            raise serializers.ValidationError(
                {"contact": "أضف بريدًا إلكترونيًا أو رقم هاتف لنتمكن من الرد"}
            )
        return attrs

    def create(self, validated_data):
        validated_data.pop("website", None)
        return super().create(validated_data)


class ProjectRequestDraftSerializer(serializers.ModelSerializer):
    """الحفظ الجزئي بعد الخطوة الأولى."""

    class Meta:
        model = ProjectRequest
        fields = ["id", "reference_code", "project_type", "sector"]
        read_only_fields = ["id", "reference_code"]


class ProjectRequestSubmitSerializer(serializers.ModelSerializer):
    """الإرسال النهائي من الموقع.

    الطلب يجب أن يكون قابلًا للرد: وصف مختصر للحاجة، ووسيلة تواصل واحدة
    على الأقل (بريد أو هاتف). بقية الحقول اختيارية. الطلبات القديمة في
    CRM لا تتأثر — القاعدة على الإرسال الجديد فقط.
    """

    website = serializers.CharField(required=False, allow_blank=True, write_only=True)
    service = serializers.SlugRelatedField(
        slug_field="slug",
        queryset=Service.objects.filter(is_published=True),
        required=False,
        allow_null=True,
    )
    submission_id = serializers.CharField(
        required=False, allow_blank=True, max_length=64, write_only=True
    )

    class Meta:
        model = ProjectRequest
        fields = [
            "id", "reference_code",
            "project_type", "sector",
            "requirements", "description", "budget_range", "timeline",
            "name", "email", "phone", "whatsapp", "company",
            "country", "city", "preferred_language", "service",
            "submission_id", "website",
        ]
        read_only_fields = ["id", "reference_code"]

    def validate_website(self, value):
        if value:
            raise serializers.ValidationError("تعذّر إرسال الطلب")
        return value

    def validate_email(self, value):
        return value.lower().strip()

    def validate_phone(self, value):
        value = " ".join(value.split())
        if value and sum(char.isdigit() for char in value) < 7:
            raise serializers.ValidationError("رقم الهاتف غير مكتمل")
        return value

    def validate_description(self, value):
        value = value.strip()
        if len(value) < MIN_REQUEST_DESCRIPTION:
            raise serializers.ValidationError("اكتب وصفًا مختصرًا لما تحتاجه")
        return value

    def validate(self, attrs):
        attrs.pop("website", None)
        # الوصف مطلوب حتى لو لم يُرسل الحقل أصلًا (validate_description
        # لا تُستدعى لحقل غائب لأن النموذج يسمح بالفراغ)
        if "description" not in attrs:
            raise serializers.ValidationError(
                {"description": "اكتب وصفًا مختصرًا لما تحتاجه"}
            )
        if not attrs.get("email") and not attrs.get("phone"):
            raise serializers.ValidationError(
                {"contact": "أضف بريدًا إلكترونيًا أو رقم هاتف لنتمكن من الرد"}
            )
        return attrs


class MyProjectRequestSerializer(serializers.ModelSerializer):
    """طلبات العميل كما يراها هو: بياناته وحالة طلبه فقط.

    لا ملاحظات داخلية ولا مسؤول ولا عميل محتمل — هذه أدوات الفريق.
    الحالة تُرسل بمفتاحها، والواجهة تترجمها إلى مرحلة بلغة العميل. وكذلك
    النوع والميزانية والمدة: المفاتيح تُترجم في الواجهة (تسميات الخيارات
    عربية)، و``*_display`` احتياط لمفتاح لا ترجمة له.
    """

    project_type_display = serializers.CharField(
        source="get_project_type_display", read_only=True
    )
    budget_display = serializers.CharField(source="get_budget_range_display", read_only=True)
    timeline_display = serializers.CharField(source="get_timeline_display", read_only=True)
    service_title = serializers.SerializerMethodField()

    class Meta:
        model = ProjectRequest
        fields = [
            "id", "reference_code", "status", "created_at", "updated_at",
            "project_type", "project_type_display", "service_title",
            "description", "budget_range", "budget_display",
            "timeline", "timeline_display", "tracking_token",
        ]
        read_only_fields = fields

    def get_service_title(self, obj) -> str:
        return obj.service.title if obj.service_id else ""


# --------------------------------------------------------------- إداري


class RequestAttachmentSerializer(serializers.ModelSerializer):
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = RequestAttachment
        fields = ["id", "file_url", "original_name", "size", "mime_type", "created_at"]

    def get_file_url(self, obj) -> str:
        return obj.file.url if obj.file else ""


class ProjectRequestAdminSerializer(serializers.ModelSerializer):
    project_type_display = serializers.CharField(
        source="get_project_type_display", read_only=True
    )
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    budget_display = serializers.CharField(source="get_budget_range_display", read_only=True)
    timeline_display = serializers.CharField(source="get_timeline_display", read_only=True)
    attachments = RequestAttachmentSerializer(many=True, read_only=True)
    lead_id = serializers.IntegerField(source="lead.id", read_only=True, default=None)
    service_title = serializers.CharField(source="service.title_ar", read_only=True, default="")
    service_kind = serializers.CharField(source="service.kind", read_only=True, default="")
    replies = serializers.SerializerMethodField()

    class Meta:
        model = ProjectRequest
        fields = [
            "id", "reference_code", "project_type", "project_type_display",
            "sector", "requirements", "description",
            "budget_range", "budget_display", "timeline", "timeline_display",
            "name", "email", "phone", "whatsapp", "company", "country", "city",
            "preferred_language", "status", "status_display", "source",
            "service", "service_title", "service_kind",
            "assigned_to", "lead_id", "attachments", "created_at",
            "tracking_token", "replies",
        ]
        read_only_fields = [
            "id", "reference_code", "source", "service", "lead_id", "attachments",
            "created_at", "tracking_token", "replies",
        ]

    def get_replies(self, obj) -> list:
        return ClientReplySerializer(obj.replies.select_related("author"), many=True).data


class ContactMessageAdminSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    replies = serializers.SerializerMethodField()

    class Meta:
        model = ContactMessage
        fields = [
            "id", "reference_code", "name", "email", "phone", "subject", "message",
            "language", "status", "status_display", "created_at",
            "tracking_token", "replies",
        ]
        read_only_fields = ["id", "reference_code", "name", "email", "phone", "subject",
                            "message", "language", "created_at", "tracking_token", "replies"]

    def get_replies(self, obj) -> list:
        return ClientReplySerializer(obj.replies.select_related("author"), many=True).data


class ClientReplySerializer(serializers.ModelSerializer):
    """رد الفريق كما تراه اللوحة: مع كاتبه."""

    author_name = serializers.SerializerMethodField()

    class Meta:
        model = ClientReply
        fields = ["id", "body", "author_name", "created_at"]
        read_only_fields = ["id", "author_name", "created_at"]

    def get_author_name(self, obj) -> str:
        return (obj.author.full_name or obj.author.email) if obj.author else ""

    def validate_body(self, value):
        value = (value or "").strip()
        if len(value) < 2:
            raise serializers.ValidationError("اكتب نص الرد")
        return value


# --------------------------------------------------------------- المتابعة العامة


class TrackLookupSerializer(serializers.Serializer):
    first = serializers.CharField(max_length=200)
    second = serializers.CharField(max_length=200)


class TrackResultSerializer(serializers.Serializer):
    """سطر في نتائج البحث: ما يكفي لاختيار الطلب والانتقال إليه."""

    kind = serializers.SerializerMethodField()
    reference_code = serializers.CharField()
    tracking_token = serializers.CharField()
    created_at = serializers.DateTimeField()

    def get_kind(self, obj) -> str:
        from apps.crm.tracking import kind_of

        return kind_of(obj)


class PublicReplySerializer(serializers.ModelSerializer):
    """الرد كما يراه العميل: النص والتاريخ فقط — اسم الموظف شأن داخلي."""

    class Meta:
        model = ClientReply
        fields = ["id", "body", "created_at"]


class TrackDetailSerializer(serializers.Serializer):
    """صفحة المتابعة: حالة الطلب أو الرسالة وردود الفريق.

    لا بريد ولا هاتف ولا ملاحظات داخلية: الرابط قد يُعاد توجيهه. الحالة
    تُرسل بمفتاحها، والواجهة تترجمها إلى مرحلة بلغة الزائر.
    """

    kind = serializers.SerializerMethodField()
    reference_code = serializers.CharField()
    status = serializers.CharField()
    name = serializers.SerializerMethodField()
    created_at = serializers.DateTimeField()
    updated_at = serializers.DateTimeField()
    project_type = serializers.CharField(default="")
    project_type_display = serializers.SerializerMethodField()
    service_title = serializers.SerializerMethodField()
    subject = serializers.CharField(default="")
    body = serializers.SerializerMethodField()
    budget_range = serializers.CharField(default="")
    timeline = serializers.CharField(default="")
    replies = serializers.SerializerMethodField()

    def get_kind(self, obj) -> str:
        from apps.crm.tracking import kind_of

        return kind_of(obj)

    def get_name(self, obj) -> str:
        # الاسم الأول للتحية فقط
        return (obj.name or "").split(" ")[0]

    def get_project_type_display(self, obj) -> str:
        return obj.get_project_type_display() if isinstance(obj, ProjectRequest) else ""

    def get_service_title(self, obj) -> str:
        service = getattr(obj, "service", None)
        return service.title if service else ""

    def get_body(self, obj) -> str:
        return obj.description if isinstance(obj, ProjectRequest) else obj.message

    def get_replies(self, obj) -> list:
        return PublicReplySerializer(obj.replies.all(), many=True).data


class LeadListSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    priority_display = serializers.CharField(source="get_priority_display", read_only=True)
    source_display = serializers.CharField(source="get_source_display", read_only=True)
    owner_name = serializers.CharField(source="owner.full_name", read_only=True, default="")
    has_client = serializers.SerializerMethodField()

    class Meta:
        model = Lead
        fields = [
            "id", "name", "company", "email", "phone", "whatsapp",
            "country", "city", "source", "source_display",
            "status", "status_display", "priority", "priority_display",
            "expected_budget", "owner", "owner_name",
            "first_contact_at", "last_contact_at", "next_follow_up_at",
            "has_client", "created_at",
        ]

    def get_has_client(self, lead) -> bool:
        return hasattr(lead, "client") and lead.client is not None


class LeadDetailSerializer(LeadListSerializer):
    services = serializers.PrimaryKeyRelatedField(many=True, read_only=True)

    class Meta(LeadListSerializer.Meta):
        fields = LeadListSerializer.Meta.fields + ["notes", "services", "member"]


class LeadWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Lead
        fields = [
            "name", "company", "email", "phone", "whatsapp", "country", "city",
            "source", "status", "priority", "expected_budget", "notes",
            "next_follow_up_at", "owner", "services",
        ]


class ClientSerializer(serializers.ModelSerializer):
    lead_id = serializers.IntegerField(source="lead.id", read_only=True, default=None)
    projects = serializers.PrimaryKeyRelatedField(many=True, read_only=True)

    class Meta:
        model = Client
        fields = [
            "id", "lead_id", "name", "company", "email", "phone", "whatsapp",
            "country", "city", "notes", "projects", "client_since", "is_active",
            "created_at",
        ]
        read_only_fields = ["id", "lead_id", "created_at"]


class CrmNoteSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(
        source="created_by.full_name", read_only=True, default=""
    )

    class Meta:
        model = CrmNote
        fields = ["id", "lead", "client", "content", "created_by_name", "created_at"]
        read_only_fields = ["id", "created_by_name", "created_at"]

    def validate(self, attrs):
        if not attrs.get("lead") and not attrs.get("client"):
            raise serializers.ValidationError("يلزم ربط الملاحظة بعميل محتمل أو عميل")
        return attrs


class InteractionSerializer(serializers.ModelSerializer):
    type_display = serializers.CharField(source="get_type_display", read_only=True)
    created_by_name = serializers.CharField(
        source="created_by.full_name", read_only=True, default=""
    )

    class Meta:
        model = Interaction
        fields = [
            "id", "lead", "client", "type", "type_display", "direction",
            "summary", "occurred_at", "created_by_name", "created_at",
        ]
        read_only_fields = ["id", "type_display", "created_by_name", "created_at"]

    def validate(self, attrs):
        if not attrs.get("lead") and not attrs.get("client"):
            raise serializers.ValidationError("يلزم ربط التواصل بعميل محتمل أو عميل")
        return attrs


class FollowUpSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    is_overdue = serializers.BooleanField(read_only=True)
    target_name = serializers.SerializerMethodField()

    class Meta:
        model = FollowUp
        fields = [
            "id", "lead", "client", "title", "due_at", "notes",
            "status", "status_display", "is_overdue", "assigned_to",
            "target_name", "created_at",
        ]
        read_only_fields = ["id", "status_display", "is_overdue", "target_name", "created_at"]

    def get_target_name(self, follow_up) -> str:
        target = follow_up.lead or follow_up.client
        return str(target.name) if target else ""

    def validate(self, attrs):
        if not attrs.get("lead") and not attrs.get("client"):
            raise serializers.ValidationError("يلزم ربط المتابعة بعميل محتمل أو عميل")
        return attrs


class CrmAttachmentSerializer(serializers.ModelSerializer):
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = CrmAttachment
        fields = ["id", "lead", "client", "file", "file_url", "name", "created_at"]
        read_only_fields = ["id", "file_url", "created_at"]
        extra_kwargs = {"file": {"write_only": True}}

    def get_file_url(self, obj) -> str:
        return obj.file.url if obj.file else ""


class KanbanColumnSerializer(serializers.Serializer):
    status = serializers.CharField()
    status_display = serializers.CharField()
    count = serializers.IntegerField()
    leads = LeadListSerializer(many=True)
