"""أدوات معالجة النصوص العربية والإنجليزية.

التطبيع هنا هو أساس البحث في المنصة كلها: يعمل بنفس النتيجة على SQLite
وPostgreSQL، فلا نعتمد على أي محلل لغوي خاص بمحرك واحد.
"""

import re
import unicodedata

# التشكيل: الفتحة والضمة والكسرة والتنوين والشدة والسكون
_DIACRITICS = re.compile(r"[ً-ْٰـ]")

_LETTER_MAP = {
    "أ": "ا", "إ": "ا", "آ": "ا", "ٱ": "ا", "ٲ": "ا", "ٳ": "ا",
    "ة": "ه",
    "ى": "ي", "ئ": "ي",
    "ؤ": "و",
    "ک": "ك", "ڪ": "ك",
    "ی": "ي",
    "ﻻ": "لا", "ﻷ": "لا", "ﻹ": "لا", "ﻵ": "لا",
}

# الأرقام الهندية والفارسية إلى اللاتينية
_DIGIT_MAP = {
    **{chr(0x0660 + i): str(i) for i in range(10)},
    **{chr(0x06F0 + i): str(i) for i in range(10)},
}

_TRANSLITERATION = {
    "ا": "a", "ب": "b", "ت": "t", "ث": "th", "ج": "j", "ح": "h", "خ": "kh",
    "د": "d", "ذ": "dh", "ر": "r", "ز": "z", "س": "s", "ش": "sh", "ص": "s",
    "ض": "d", "ط": "t", "ظ": "z", "ع": "a", "غ": "gh", "ف": "f", "ق": "q",
    "ك": "k", "ل": "l", "م": "m", "ن": "n", "ه": "h", "و": "w", "ي": "y",
    "ء": "", "لا": "la",
}

_WHITESPACE = re.compile(r"\s+")
_NON_SLUG = re.compile(r"[^a-z0-9]+")


def normalize_arabic(value: str | None) -> str:
    """يوحّد شكل النص العربي ليصبح قابلًا للمطابقة.

    'الإمارات' و'الامارات' و'الأمارات' تتحول جميعها إلى 'الامارات'.
    """
    if not value:
        return ""

    text = unicodedata.normalize("NFKC", str(value))
    text = _DIACRITICS.sub("", text)

    for source, target in _LETTER_MAP.items():
        text = text.replace(source, target)
    for source, target in _DIGIT_MAP.items():
        text = text.replace(source, target)

    text = text.lower()
    return _WHITESPACE.sub(" ", text).strip()


def build_search_text(*values: str | None) -> str:
    """يدمج عدة حقول في نص بحث واحد مطبَّع."""
    parts = [normalize_arabic(strip_markup(value)) for value in values if value]
    return _WHITESPACE.sub(" ", " ".join(parts)).strip()[:8000]


def strip_markup(value: str | None) -> str:
    """يزيل وسوم HTML وأبسط رموز Markdown لأغراض البحث وحساب الطول."""
    if not value:
        return ""
    text = re.sub(r"<[^>]+>", " ", str(value))
    text = re.sub(r"[#*_`>\[\]()!]+", " ", text)
    return _WHITESPACE.sub(" ", text).strip()


def transliterate(value: str | None) -> str:
    """نقحرة عربية إلى لاتينية — تُستخدم لتوليد slug من عنوان عربي."""
    if not value:
        return ""
    text = normalize_arabic(value)
    out: list[str] = []
    for char in text:
        if char in _TRANSLITERATION:
            out.append(_TRANSLITERATION[char])
        elif char.isascii():
            out.append(char)
        else:
            out.append(" ")
    return "".join(out)


def slugify_text(value: str | None, fallback: str = "item") -> str:
    """slug لاتيني يعمل مع العربية والإنجليزية معًا."""
    text = transliterate(value) if _has_arabic(value) else (value or "")
    text = unicodedata.normalize("NFKD", str(text))
    text = text.encode("ascii", "ignore").decode("ascii").lower()
    text = _NON_SLUG.sub("-", text).strip("-")
    return text or fallback


def unique_slug(instance, value: str, field_name: str = "slug") -> str:
    """يولّد slug فريدًا على مستوى النموذج بإضافة لاحقة رقمية عند التعارض."""
    model = instance.__class__
    base = slugify_text(value, fallback=model.__name__.lower())
    candidate = base
    counter = 2
    queryset = model._default_manager.all()
    if instance.pk:
        queryset = queryset.exclude(pk=instance.pk)
    while queryset.filter(**{field_name: candidate}).exists():
        candidate = f"{base}-{counter}"
        counter += 1
    return candidate


def _has_arabic(value: str | None) -> bool:
    if not value:
        return False
    return any("؀" <= char <= "ۿ" for char in str(value))


def count_words(value: str | None) -> int:
    text = strip_markup(value)
    return len([word for word in text.split(" ") if word])


def reading_time_minutes(value: str | None, words_per_minute: int = 200) -> int:
    """وقت القراءة بالدقائق — الحد الأدنى دقيقة واحدة."""
    words = count_words(value)
    if not words:
        return 0
    return max(1, round(words / words_per_minute))
