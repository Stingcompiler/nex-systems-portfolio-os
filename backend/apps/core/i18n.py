"""تتبّع لغة الطلب الحالية عبر contextvars.

يُستخدم لحل الحقول المترجمة (`title_ar` / `title_en`) دون تمرير الطلب
إلى كل نموذج ومسلسل.
"""

from contextvars import ContextVar

from django.conf import settings

_current_language: ContextVar[str | None] = ContextVar(
    "stingdev_current_language", default=None
)

DEFAULT_LANGUAGE = "ar"


def get_supported_languages() -> list[str]:
    return list(getattr(settings, "SUPPORTED_LANGUAGES", ["ar", "en"]))


def normalize_language(value: str | None) -> str:
    """يحوّل أي قيمة لغة إلى رمز مدعوم ('ar' أو 'en')."""
    if not value:
        return DEFAULT_LANGUAGE
    code = str(value).strip().lower().replace("_", "-").split("-")[0]
    supported = get_supported_languages()
    return code if code in supported else DEFAULT_LANGUAGE


def set_current_language(value: str | None) -> str:
    language = normalize_language(value)
    _current_language.set(language)
    return language


def get_current_language() -> str:
    return _current_language.get() or normalize_language(
        getattr(settings, "LANGUAGE_CODE", DEFAULT_LANGUAGE)
    )


def parse_accept_language(header: str | None) -> str:
    """يختار أفضل لغة مدعومة من ترويسة Accept-Language."""
    if not header:
        return DEFAULT_LANGUAGE

    candidates: list[tuple[float, str]] = []
    for index, part in enumerate(header.split(",")):
        chunk = part.strip()
        if not chunk:
            continue
        pieces = chunk.split(";")
        tag = pieces[0].strip().lower()
        quality = 1.0
        for extra in pieces[1:]:
            extra = extra.strip()
            if extra.startswith("q="):
                try:
                    quality = float(extra[2:])
                except ValueError:
                    quality = 0.0
        # الترتيب الأصلي يكسر التعادل بين القيم المتساوية
        candidates.append((-quality, index, tag))  # type: ignore[arg-type]

    supported = get_supported_languages()
    for _, _, tag in sorted(candidates):  # type: ignore[misc]
        base = tag.split("-")[0]
        if base in supported:
            return base
    return DEFAULT_LANGUAGE
