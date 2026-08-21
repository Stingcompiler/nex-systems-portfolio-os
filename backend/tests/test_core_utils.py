"""اختبارات أدوات النواة: تطبيع النص العربي، الترجمة، اللغة."""

import pytest

from apps.core.i18n import (
    get_current_language,
    normalize_language,
    parse_accept_language,
    set_current_language,
)
from apps.core.models.base import TranslatableMixin
from apps.core.utils.text import (
    build_search_text,
    normalize_arabic,
    reading_time_minutes,
    slugify_text,
    strip_markup,
    transliterate,
)


# --------------------------------------------------------------- التطبيع العربي


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("الإمارات", "الامارات"),
        ("الأمارات", "الامارات"),
        ("الآمارات", "الامارات"),
        ("مَدْرَسَة", "مدرسه"),
        ("مدرسة", "مدرسه"),
        ("مصطفى", "مصطفي"),
        ("مُـــشروع", "مشروع"),
        ("١٢٣٤", "1234"),
        ("  مسافات   كثيرة ", "مسافات كثيره"),
        ("", ""),
        (None, ""),
    ],
)
def test_normalize_arabic_unifies_spelling_variants(raw, expected):
    assert normalize_arabic(raw) == expected


def test_search_matches_across_hamza_variants():
    """المطلب الأساسي: البحث عن 'الامارات' يجب أن يجد 'الإمارات'."""
    stored = build_search_text("منصة كلية الإمارات للعلوم والتكنولوجيا")
    query = normalize_arabic("الامارات")

    assert query in stored


def test_search_text_merges_multiple_fields_and_strips_markup():
    result = build_search_text("<h1>العنوان</h1>", "**الوصف**", None)

    assert "العنوان" in result
    assert "الوصف" in result
    assert "<" not in result and "*" not in result


def test_strip_markup_removes_html_and_markdown():
    assert strip_markup("<p>نص</p> **مهم**") == "نص مهم"


# --------------------------------------------------------------- النقحرة والـ slug


def test_transliterate_converts_arabic_to_latin():
    # التاء المربوطة تُطبَّع إلى هاء أولًا، فتصبح النقحرة mdrsh
    assert transliterate("مدرسة").strip() == "mdrsh"


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("School Management System", "school-management-system"),
        ("  Multiple   Spaces  ", "multiple-spaces"),
        ("Café & Restaurant", "cafe-restaurant"),
    ],
)
def test_slugify_handles_latin_titles(raw, expected):
    assert slugify_text(raw) == expected


def test_slugify_produces_latin_slug_for_arabic_titles():
    slug = slugify_text("نظام إدارة المدارس")

    assert slug
    assert all(char.isascii() for char in slug)
    assert " " not in slug


def test_slugify_falls_back_when_nothing_usable():
    assert slugify_text("!!!", fallback="service") == "service"


# --------------------------------------------------------------- وقت القراءة


@pytest.mark.parametrize(
    ("words", "expected"),
    [(0, 0), (10, 1), (200, 1), (450, 2)],
)
def test_reading_time_rounds_sensibly(words, expected):
    assert reading_time_minutes(" ".join(["كلمة"] * words)) == expected


# --------------------------------------------------------------- اللغة


@pytest.mark.parametrize(
    ("header", "expected"),
    [
        ("ar", "ar"),
        ("en-US,en;q=0.9", "en"),
        ("fr-FR,fr;q=0.9,en;q=0.8", "en"),
        ("de", "ar"),
        ("", "ar"),
        (None, "ar"),
        ("en;q=0.4,ar;q=0.9", "ar"),
    ],
)
def test_accept_language_picks_the_best_supported_language(header, expected):
    assert parse_accept_language(header) == expected


@pytest.mark.parametrize(
    ("raw", "expected"),
    [("AR", "ar"), ("en_GB", "en"), ("ar-SD", "ar"), ("zz", "ar"), (None, "ar")],
)
def test_normalize_language(raw, expected):
    assert normalize_language(raw) == expected


def test_language_context_is_settable():
    set_current_language("en")
    assert get_current_language() == "en"
    set_current_language("ar")
    assert get_current_language() == "ar"


# --------------------------------------------------------------- الحقول المترجمة


class _Sample(TranslatableMixin):
    translatable_fields = ("title", "summary")

    def __init__(self, title_ar="", title_en="", summary_ar="", summary_en=""):
        self.title_ar = title_ar
        self.title_en = title_en
        self.summary_ar = summary_ar
        self.summary_en = summary_en


def test_translatable_resolves_by_current_language():
    obj = _Sample(title_ar="نظام المدارس", title_en="School System")

    set_current_language("ar")
    assert obj.title == "نظام المدارس"

    set_current_language("en")
    assert obj.title == "School System"

    set_current_language("ar")


def test_translatable_falls_back_to_arabic_when_translation_is_missing():
    obj = _Sample(title_ar="نظام المدارس", title_en="")

    set_current_language("en")
    assert obj.title == "نظام المدارس"
    set_current_language("ar")


def test_translatable_returns_empty_string_when_both_are_missing():
    assert _Sample().title == ""


def test_translatable_does_not_swallow_real_attribute_errors():
    with pytest.raises(AttributeError):
        _ = _Sample().does_not_exist
