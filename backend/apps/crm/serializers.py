from rest_framework import serializers

from apps.crm.enums import RequestStatus
from apps.crm.models import (
    Client,
    ContactMessage,
    CrmAttachment,
    CrmNote,
    FollowUp,
    Interaction,
    Lead,
    ProjectRequest,
    RequestAttachment,
)

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

    def validate_message(self, value):
        # الحقل اختياري — يُقبل فارغًا
        return value

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
    website = serializers.CharField(required=False, allow_blank=True, write_only=True)

    class Meta:
        model = ProjectRequest
        fields = [
            "id", "reference_code",
            "project_type", "sector",
            "requirements", "description", "budget_range", "timeline",
            "name", "email", "phone", "whatsapp", "company",
            "country", "city", "preferred_language", "website",
        ]
        read_only_fields = ["id", "reference_code"]

    def validate_website(self, value):
        if value:
            raise serializers.ValidationError("تعذّر إرسال الطلب")
        return value

    def validate_email(self, value):
        return value.lower().strip()

    def validate(self, attrs):
        # كل الحقول اختيارية — يبقى الفخ المضاد للسبام (website) فقط
        attrs.pop("website", None)
        return attrs


# --------------------------------------------------------------- إداري


class RequestAttachmentSerializer(serializers.ModelSerializer):
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = RequestAttachment
        fields = ["id", "file_url", "original_name", "size", "mime_type", "created_at"]

    def get_file_url(self, obj) -> str:
        request = self.context.get("request")
        url = obj.file.url if obj.file else ""
        return request.build_absolute_uri(url) if request and url else url


class ProjectRequestAdminSerializer(serializers.ModelSerializer):
    project_type_display = serializers.CharField(
        source="get_project_type_display", read_only=True
    )
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    budget_display = serializers.CharField(source="get_budget_range_display", read_only=True)
    timeline_display = serializers.CharField(source="get_timeline_display", read_only=True)
    attachments = RequestAttachmentSerializer(many=True, read_only=True)
    lead_id = serializers.IntegerField(source="lead.id", read_only=True, default=None)

    class Meta:
        model = ProjectRequest
        fields = [
            "id", "reference_code", "project_type", "project_type_display",
            "sector", "requirements", "description",
            "budget_range", "budget_display", "timeline", "timeline_display",
            "name", "email", "phone", "whatsapp", "company", "country", "city",
            "preferred_language", "status", "status_display", "source",
            "assigned_to", "lead_id", "attachments", "created_at",
        ]
        read_only_fields = [
            "id", "reference_code", "source", "lead_id", "attachments", "created_at",
        ]


class ContactMessageAdminSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = ContactMessage
        fields = [
            "id", "name", "email", "phone", "subject", "message",
            "language", "status", "status_display", "created_at",
        ]
        read_only_fields = ["id", "name", "email", "phone", "subject", "message",
                            "language", "created_at"]


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
        request = self.context.get("request")
        url = obj.file.url if obj.file else ""
        return request.build_absolute_uri(url) if request and url else url


class KanbanColumnSerializer(serializers.Serializer):
    status = serializers.CharField()
    status_display = serializers.CharField()
    count = serializers.IntegerField()
    leads = LeadListSerializer(many=True)
