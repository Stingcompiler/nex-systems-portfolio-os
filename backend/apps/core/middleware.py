"""وسائط برمجية مشتركة."""

from contextvars import ContextVar

from django.utils import translation

from apps.core.i18n import normalize_language, parse_accept_language, set_current_language

_current_request: ContextVar = ContextVar("stingdev_current_request", default=None)


def get_current_request():
    """الطلب الحالي — يُستخدم في سجل التدقيق دون تمريره عبر كل الطبقات."""
    return _current_request.get()


class LanguageMiddleware:
    """يحدد لغة الطلب ويجعلها متاحة للنماذج والمسلسلات.

    الأولوية: معامل `?lang=` ← ترويسة `Accept-Language` ← الافتراضي (العربية).
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        explicit = request.GET.get("lang")
        if explicit:
            language = normalize_language(explicit)
        else:
            language = parse_accept_language(request.META.get("HTTP_ACCEPT_LANGUAGE"))

        set_current_language(language)
        translation.activate(language)
        request.language = language

        response = self.get_response(request)
        response.setdefault("Content-Language", language)
        response.setdefault("Vary", "Accept-Language")
        return response


class RequestContextMiddleware:
    """يحفظ الطلب الحالي في السياق ثم ينظّفه بعد الاستجابة."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        token = _current_request.set(request)
        try:
            return self.get_response(request)
        finally:
            _current_request.reset(token)
