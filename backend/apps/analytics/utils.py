"""أدوات اشتقاق بيانات التحليلات دون المساس بالخصوصية."""

import hashlib
import re
from datetime import date
from urllib.parse import urlparse

from django.conf import settings

_BOT_PATTERN = re.compile(
    r"bot|crawl|spider|slurp|bingpreview|facebookexternalhit|whatsapp|telegram",
    re.IGNORECASE,
)
_MOBILE_PATTERN = re.compile(r"mobile|iphone|android(?!.*tablet)|ipod", re.IGNORECASE)
_TABLET_PATTERN = re.compile(r"ipad|tablet|kindle|playbook", re.IGNORECASE)


def device_from_user_agent(user_agent: str) -> str:
    ua = user_agent or ""
    if _BOT_PATTERN.search(ua):
        return "bot"
    if _TABLET_PATTERN.search(ua):
        return "tablet"
    if _MOBILE_PATTERN.search(ua):
        return "mobile"
    return "desktop"


def referrer_domain(referrer: str) -> str:
    """نطاق المصدر فقط — لا مسار كامل يكشف تصفّح الزائر."""
    if not referrer:
        return ""
    try:
        host = urlparse(referrer).hostname or ""
    except ValueError:
        return ""
    host = host.lower().removeprefix("www.")

    # الزيارات من داخل الموقع نفسه ليست مصدرًا خارجيًا
    own = urlparse(settings.FRONTEND_URL).hostname or ""
    if host in ("", own, own.removeprefix("www."), "localhost", "127.0.0.1"):
        return ""
    return host[:120]


def anonymous_session_hash(ip: str, user_agent: str, day: date | None = None) -> str:
    """بصمة مجهولة تدور يوميًا.

    الملح اليومي يمنع ربط جلسات الزائر عبر الأيام، فيبقى العدّ للزوار
    الفريدين يوميًا فقط دون تتبّع طويل الأمد. لا يُخزَّن IP الأصلي.
    """
    day = day or date.today()
    raw = f"{settings.SECRET_KEY}:{day.isoformat()}:{ip or ''}:{user_agent or ''}"
    return hashlib.sha256(raw.encode()).hexdigest()[:64]


def classify_path(path: str) -> tuple[str, str]:
    """يستخرج نوع المحتوى وslug من مسار الصفحة.

    مثال: `/ar/blog/my-post` → ('blog', 'my-post').
    """
    segments = [segment for segment in path.strip("/").split("/") if segment]
    # تجاوز بادئة اللغة
    if segments and segments[0] in ("ar", "en"):
        segments = segments[1:]
    if len(segments) >= 2 and segments[0] in (
        "blog", "projects", "services", "solutions", "case-studies",
    ):
        return segments[0], segments[1][:220]
    if len(segments) == 1 and segments[0] in ("blog", "projects", "services"):
        return segments[0], ""
    return "", ""
