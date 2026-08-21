from rest_framework import serializers

from apps.core.fields import TranslatedField
from apps.core.models.content import FAQ, PageSection, ProcessStep, Stat
from apps.core.models.settings import SEOSettings, SiteSettings, SocialLink
from apps.media_library.serializers import MediaFileRefSerializer


class SocialLinkSerializer(serializers.ModelSerializer):
    platform_display = serializers.CharField(source="get_platform_display", read_only=True)

    class Meta:
        model = SocialLink
        fields = ["id", "platform", "platform_display", "label", "url", "display_order"]


class SiteSettingsPublicSerializer(serializers.ModelSerializer):
    """ما يراه الزائر — بلا أي إعداد داخلي أو بيانات إرسال بريد."""

    site_name = TranslatedField()
    tagline = TranslatedField()
    owner_name = TranslatedField()
    owner_title = TranslatedField()
    owner_bio = TranslatedField()
    address = TranslatedField()
    whatsapp_default_message = TranslatedField()
    maintenance_message = TranslatedField()

    logo_light = MediaFileRefSerializer(read_only=True)
    logo_dark = MediaFileRefSerializer(read_only=True)
    favicon = MediaFileRefSerializer(read_only=True)
    owner_photo = MediaFileRefSerializer(read_only=True)
    cv_ar = MediaFileRefSerializer(read_only=True)
    cv_en = MediaFileRefSerializer(read_only=True)
    social_links = serializers.SerializerMethodField()

    class Meta:
        model = SiteSettings
        fields = [
            "site_name", "tagline",
            "logo_light", "logo_dark", "favicon",
            "owner_name", "owner_title", "owner_bio", "owner_photo", "cv_ar", "cv_en",
            "email", "phone", "whatsapp", "whatsapp_default_message",
            "address", "country", "city",
            "default_language", "default_theme", "currency",
            "maintenance_mode", "maintenance_message",
            "analytics_provider", "analytics_site_id", "analytics_script_url",
            "social_links",
        ]

    def get_social_links(self, _settings) -> list:
        links = SocialLink.objects.filter(is_active=True)
        return SocialLinkSerializer(links, many=True, context=self.context).data


class SiteSettingsAdminSerializer(serializers.ModelSerializer):
    class Meta:
        model = SiteSettings
        exclude = ["id"]


class SEOSettingsPublicSerializer(serializers.ModelSerializer):
    default_seo_title = TranslatedField()
    default_seo_description = TranslatedField()
    default_og_image = MediaFileRefSerializer(read_only=True)

    class Meta:
        model = SEOSettings
        fields = [
            "default_seo_title",
            "default_seo_description",
            "default_og_image",
            "twitter_handle",
            "google_verification",
            "bing_verification",
        ]


class SEOSettingsAdminSerializer(serializers.ModelSerializer):
    class Meta:
        model = SEOSettings
        exclude = ["id"]


class StatSerializer(serializers.ModelSerializer):
    label = TranslatedField()
    suffix = TranslatedField()

    class Meta:
        model = Stat
        fields = ["id", "label", "value", "suffix", "icon", "display_order"]


class StatAdminSerializer(serializers.ModelSerializer):
    class Meta:
        model = Stat
        fields = "__all__"


class PageSectionSerializer(serializers.ModelSerializer):
    title = TranslatedField()
    subtitle = TranslatedField()
    cta_label = TranslatedField()
    image = MediaFileRefSerializer(read_only=True)

    class Meta:
        model = PageSection
        fields = [
            "id", "page", "key", "title", "subtitle",
            "cta_label", "cta_url", "image",
            "is_visible", "display_order", "config",
        ]


class PageSectionAdminSerializer(serializers.ModelSerializer):
    class Meta:
        model = PageSection
        fields = "__all__"


class SectionReorderSerializer(serializers.Serializer):
    """إعادة ترتيب دفعة واحدة بعد السحب والإفلات."""

    order = serializers.ListField(child=serializers.IntegerField(), allow_empty=False)

    def validate_order(self, value: list[int]) -> list[int]:
        if len(set(value)) != len(value):
            raise serializers.ValidationError("القائمة تحتوي معرّفات مكررة")
        existing = set(PageSection.objects.filter(id__in=value).values_list("id", flat=True))
        missing = set(value) - existing
        if missing:
            raise serializers.ValidationError(f"معرّفات غير موجودة: {sorted(missing)}")
        return value


class FAQSerializer(serializers.ModelSerializer):
    question = TranslatedField()
    answer = TranslatedField()

    class Meta:
        model = FAQ
        fields = ["id", "question", "answer", "scope", "service", "display_order"]


class FAQAdminSerializer(serializers.ModelSerializer):
    class Meta:
        model = FAQ
        fields = "__all__"


class ProcessStepSerializer(serializers.ModelSerializer):
    title = TranslatedField()
    description = TranslatedField()
    duration = TranslatedField()

    class Meta:
        model = ProcessStep
        fields = [
            "id", "title", "description", "duration",
            "icon", "deliverables", "display_order",
        ]


class ProcessStepAdminSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProcessStep
        fields = "__all__"
