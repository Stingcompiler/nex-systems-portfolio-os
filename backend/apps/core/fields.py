"""حقول مسلسلات مخصصة."""

from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.core.i18n import get_current_language


@extend_schema_field(OpenApiTypes.STR)
class TranslatedField(serializers.Field):
    """يعيد الحقل المترجم حسب لغة الطلب.

    الاستخدام داخل المسلسل::

        title = TranslatedField()          # يقرأ title_ar / title_en
        summary = TranslatedField("short_description")
    """

    def __init__(self, name: str | None = None, **kwargs):
        kwargs["read_only"] = True
        kwargs["source"] = "*"
        self.translated_name = name
        super().__init__(**kwargs)

    def bind(self, field_name, parent):
        super().bind(field_name, parent)
        if self.translated_name is None:
            self.translated_name = field_name

    def to_representation(self, instance):
        language = self._language()
        translator = getattr(instance, "tr", None)
        if callable(translator):
            return translator(self.translated_name, language)
        return getattr(instance, f"{self.translated_name}_{language}", "") or ""

    def _language(self) -> str:
        request = self.context.get("request")
        explicit = getattr(request, "language", None) if request else None
        return explicit or get_current_language()


def localize_structure(value, language: str):
    """يحوّل بنية JSON ثنائية اللغة إلى نسخة بلغة واحدة.

    يتعامل مع نمطين::

        {"title_ar": "...", "title_en": "..."}  →  {"title": "..."}
        {"ar": "...", "en": "..."}              →  "..."

    ويعمل بشكل متكرر على القوائم والقواميس المتداخلة.
    """
    other = "en" if language == "ar" else "ar"

    if isinstance(value, list):
        return [localize_structure(item, language) for item in value]

    if not isinstance(value, dict):
        return value

    keys = set(value.keys())
    if keys and keys <= {"ar", "en"}:
        return value.get(language) or value.get(other) or ""

    result: dict = {}
    for key, item in value.items():
        if key.endswith(f"_{language}"):
            result[key[: -(len(language) + 1)]] = item
        elif key.endswith(f"_{other}"):
            base = key[: -(len(other) + 1)]
            result.setdefault(base, item)  # ارتداد فقط إن غابت اللغة المطلوبة
        else:
            result[key] = localize_structure(item, language)

    # الحقل الفارغ في اللغة المطلوبة يرتد إلى اللغة الأخرى
    for key, item in value.items():
        if key.endswith(f"_{language}") and not item:
            base = key[: -(len(language) + 1)]
            fallback = value.get(f"{base}_{other}")
            if fallback:
                result[base] = fallback

    return result


@extend_schema_field(OpenApiTypes.ANY)
class TranslatedJSONField(serializers.Field):
    """يعرض حقل JSON ثنائي اللغة بلغة الطلب فقط."""

    def __init__(self, **kwargs):
        kwargs["read_only"] = True
        super().__init__(**kwargs)

    def to_representation(self, value):
        request = self.context.get("request")
        language = getattr(request, "language", None) or get_current_language()
        return localize_structure(value, language)


class BilingualCharField(serializers.Serializer):
    """يُستخدم في مسلسلات لوحة التحكم لعرض اللغتين معًا."""

    ar = serializers.CharField(allow_blank=True, required=False)
    en = serializers.CharField(allow_blank=True, required=False)
