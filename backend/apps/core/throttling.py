"""تحديد المعدل مع دعم فترات مرنة مثل «5 محاولات كل 15 دقيقة»."""

import re

from rest_framework.throttling import AnonRateThrottle, SimpleRateThrottle

_PERIOD_SECONDS = {
    "s": 1, "sec": 1, "second": 1, "seconds": 1,
    "m": 60, "min": 60, "minute": 60, "minutes": 60,
    "h": 3600, "hour": 3600, "hours": 3600,
    "d": 86400, "day": 86400, "days": 86400,
}

_RATE_PATTERN = re.compile(r"^(\d*)([a-z]+)$")


class FlexibleRateMixin:
    """يوسّع صياغة DRF لتقبل '5/15m' و'3/1h' إضافة إلى '5/min'."""

    def parse_rate(self, rate):
        if rate is None:
            return (None, None)
        count, _, period = rate.partition("/")
        num_requests = int(count)
        match = _RATE_PATTERN.match(period.strip().lower())
        if not match:
            raise ValueError(f"صيغة معدل غير مفهومة: {rate!r}")
        multiplier = int(match.group(1) or 1)
        unit = _PERIOD_SECONDS.get(match.group(2))
        if unit is None:
            raise ValueError(f"وحدة زمنية غير مدعومة في المعدل: {rate!r}")
        return (num_requests, multiplier * unit)


class ScopedThrottle(FlexibleRateMixin, SimpleRateThrottle):
    """أساس مشترك: يُحدَّد النطاق في الفئة الوارثة."""

    scope = ""

    def get_cache_key(self, request, view):
        ident = (
            request.user.pk
            if request.user and request.user.is_authenticated
            else self.get_ident(request)
        )
        return self.cache_format % {"scope": self.scope, "ident": ident}


class LoginThrottle(FlexibleRateMixin, SimpleRateThrottle):
    """يقيّد محاولات الدخول لكل تركيبة (بريد + عنوان IP).

    التقييد بالاثنين معًا يمنع تعطيل حساب مستخدم من عنوان مهاجم واحد،
    ويمنع في الوقت نفسه تجربة كلمات مرور كثيرة على البريد نفسه.
    """

    scope = "login"

    def get_cache_key(self, request, view):
        email = ""
        data = getattr(request, "data", None)
        if isinstance(data, dict):
            email = str(data.get("email") or "").strip().lower()
        return self.cache_format % {
            "scope": self.scope,
            "ident": f"{self.get_ident(request)}:{email}",
        }


class RegisterThrottle(ScopedThrottle):
    scope = "register"


class PasswordForgotThrottle(ScopedThrottle):
    scope = "password_forgot"


class ResendVerificationThrottle(ScopedThrottle):
    scope = "resend_verification"


class AnonWriteThrottle(FlexibleRateMixin, AnonRateThrottle):
    """للنماذج العامة: التواصل، التعليقات، الاشتراك في النشرة."""

    scope = "anon_write"
