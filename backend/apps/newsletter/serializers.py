from rest_framework import serializers

from apps.core.fields import TranslatedField
from apps.newsletter.models import Campaign, CampaignRecipient, EmailTemplate, Interest, Subscriber

# --------------------------------------------------------------- عام


class InterestSerializer(serializers.ModelSerializer):
    name = TranslatedField()
    description = TranslatedField()

    class Meta:
        model = Interest
        fields = ["id", "key", "name", "description"]


class SubscribeSerializer(serializers.Serializer):
    email = serializers.EmailField()
    name = serializers.CharField(max_length=120, required=False, allow_blank=True)
    language = serializers.ChoiceField(choices=["ar", "en"], required=False, default="ar")
    interests = serializers.ListField(
        child=serializers.SlugField(max_length=40), required=False, default=list
    )
    source = serializers.ChoiceField(
        choices=Subscriber.Source.choices, required=False, default=Subscriber.Source.HOME
    )
    # حقول مكافحة السبام — لا تُخزَّن
    website = serializers.CharField(required=False, allow_blank=True, write_only=True)
    elapsed_seconds = serializers.FloatField(required=False, write_only=True)


class TokenSerializer(serializers.Serializer):
    token = serializers.CharField(max_length=64)


class UnsubscribeSerializer(TokenSerializer):
    #: رمز مستلم الحملة إن جاء الإلغاء من رسالة — لعدّ الإلغاءات لكل حملة
    campaign_token = serializers.CharField(max_length=64, required=False, allow_blank=True)


class PreferencesSerializer(serializers.ModelSerializer):
    """تفضيلات المشترك عبر الرابط الموقّع — لا يكشف شيئًا سوى ما أدخله بنفسه."""

    interests = serializers.SlugRelatedField(
        slug_field="key", queryset=Interest.objects.all(), many=True, required=False
    )
    language = serializers.ChoiceField(choices=["ar", "en"], required=False)

    class Meta:
        model = Subscriber
        fields = ["email", "name", "language", "interests", "status"]
        read_only_fields = ["email", "status"]


# --------------------------------------------------------------- إداري


class InterestAdminSerializer(serializers.ModelSerializer):
    subscriber_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Interest
        fields = "__all__"


class SubscriberAdminSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    source_display = serializers.CharField(source="get_source_display", read_only=True)
    interests = serializers.SlugRelatedField(
        slug_field="key", queryset=Interest.objects.all(), many=True, required=False
    )
    interest_names = serializers.SerializerMethodField()

    class Meta:
        model = Subscriber
        fields = [
            "id", "email", "name", "language", "interests", "interest_names",
            "status", "status_display", "source", "source_display",
            "confirmed_at", "unsubscribed_at", "consent_at", "user", "created_at",
        ]
        read_only_fields = [
            "confirmed_at", "unsubscribed_at", "consent_at", "user", "created_at",
        ]

    def get_interest_names(self, subscriber) -> list[str]:
        return [interest.name_ar for interest in subscriber.interests.all()]

    def validate_status(self, value):
        # المدير يفعّل أو يوقف يدويًا؛ لا يُسمح له بتزييف «بانتظار التأكيد»
        allowed = {
            Subscriber.Status.ACTIVE, Subscriber.Status.UNSUBSCRIBED,
            Subscriber.Status.BOUNCED, Subscriber.Status.COMPLAINED,
        }
        if self.instance and value not in allowed:
            raise serializers.ValidationError("حالة غير مسموح بها يدويًا")
        return value


class EmailTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmailTemplate
        fields = "__all__"

    def validate(self, attrs):
        for lang in ("ar", "en"):
            html = attrs.get(f"html_{lang}", getattr(self.instance, f"html_{lang}", ""))
            if html and "{{ unsubscribe_url }}" not in html:
                raise serializers.ValidationError({
                    f"html_{lang}": ["القالب يجب أن يحوي {{ unsubscribe_url }} — رابط الإلغاء إلزامي"]
                })
            if html and "{{ content }}" not in html:
                raise serializers.ValidationError({
                    f"html_{lang}": ["القالب يجب أن يحوي {{ content }} ليُدرج محتوى الحملة"]
                })
        return attrs


class CampaignListSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = Campaign
        fields = [
            "id", "name", "subject_ar", "subject_en", "status", "status_display",
            "target_language", "scheduled_at", "sent_at",
            "total_recipients", "sent_count", "failed_count",
            "open_count", "click_count", "unsubscribe_count", "created_at",
        ]


class CampaignSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    target_interests = serializers.PrimaryKeyRelatedField(
        queryset=Interest.objects.all(), many=True, required=False
    )

    class Meta:
        model = Campaign
        fields = "__all__"
        read_only_fields = [
            "status", "started_at", "sent_at", "last_activity_at",
            "total_recipients", "sent_count", "failed_count",
            "open_count", "click_count", "unsubscribe_count",
            "source_model", "source_id", "created_by", "updated_by",
        ]

    def validate(self, attrs):
        if self.instance and not self.instance.is_editable:
            raise serializers.ValidationError(
                {"status": ["لا يمكن تعديل حملة بدأ إرسالها أو انتهت"]}
            )
        return attrs


class CampaignRecipientSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(source="subscriber.email", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = CampaignRecipient
        fields = [
            "id", "email", "status", "status_display", "sent_at",
            "error_message", "opened_at", "clicked_at",
        ]


class ScheduleSerializer(serializers.Serializer):
    scheduled_at = serializers.DateTimeField()


class TestSendSerializer(serializers.Serializer):
    email = serializers.EmailField(required=False)
    language = serializers.ChoiceField(choices=["ar", "en"], required=False, default="ar")


class DraftFromContentSerializer(serializers.Serializer):
    kind = serializers.ChoiceField(choices=["post", "project", "service"])
    id = serializers.IntegerField(min_value=1)
