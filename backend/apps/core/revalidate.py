"""إبطال التخزين المؤقت في Next.js من لوحة التحكم.

الصفحات العامة مولّدة ثابتًا بمهلة إعادة تحقق. بدون إشارة صريحة يبقى
التعديل غير ظاهر حتى تنتهي المهلة، وهو ما يبدو للمحرّر كأن الحفظ لم ينجح.
"""

import json
import logging
import urllib.error
import urllib.request

from django.conf import settings

logger = logging.getLogger(__name__)

REQUEST_TIMEOUT = 5


def revalidate(tags: list[str], paths: list[str] | None = None) -> bool:
    """يخبر Next.js بإبطال وسوم ومسارات محددة.

    لا يرفع استثناء أبدًا: فشل الإبطال يجب ألا يُفشل حفظ المحتوى — أسوأ
    نتيجة هي ظهور التعديل بعد انتهاء المهلة.
    """
    endpoint = f"{settings.FRONTEND_URL.rstrip('/')}/api/revalidate"
    payload = json.dumps({"tags": tags, "paths": paths or []}).encode("utf-8")

    request = urllib.request.Request(
        endpoint,
        data=payload,
        headers={
            "Content-Type": "application/json",
            "X-Revalidate-Secret": settings.REVALIDATE_SECRET,
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=REQUEST_TIMEOUT) as response:
            return 200 <= response.status < 300
    except (urllib.error.URLError, OSError, ValueError) as error:
        logger.warning("تعذّر إبطال التخزين المؤقت (%s): %s", tags, error)
        return False


#: ربط كل نموذج بالوسوم التي يجب إبطالها عند تعديله
MODEL_TAGS: dict[str, list[str]] = {
    "Service": ["services", "sections"],
    "Project": ["projects", "services", "sections"],
    "CaseStudy": ["case-studies", "sections"],
    "Technology": ["technologies", "sections"],
    "Testimonial": ["testimonials", "sections"],
    "SiteSettings": ["settings"],
    "SEOSettings": ["settings"],
    "SocialLink": ["settings"],
    "PageSection": ["sections"],
    "Stat": ["settings", "sections"],
    "FAQ": ["settings", "services"],
    "ProcessStep": ["settings", "sections"],
    "Experience": ["resume"],
    "Education": ["resume"],
    "Certification": ["resume"],
    "Resource": ["resume"],
}


def revalidate_for(instance) -> bool:
    """يبطل الوسوم المرتبطة بنموذج الكائن المعدَّل."""
    tags = MODEL_TAGS.get(instance.__class__.__name__)
    if not tags:
        return False
    return revalidate(tags)


def queue_revalidate_for(instance) -> None:
    """يجدول الإبطال في الخلفية كي لا ينتظره المحرّر في دورة الطلب."""
    model_name = instance.__class__.__name__
    if model_name not in MODEL_TAGS:
        return

    try:
        from django_q.tasks import async_task

        async_task("apps.core.tasks.revalidate_model", model_name)
    except Exception:  # noqa: BLE001
        logger.exception("تعذّرت جدولة إبطال التخزين المؤقت لـ %s", model_name)
