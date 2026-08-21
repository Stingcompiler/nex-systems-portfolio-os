"""مهام التحليلات الدورية."""

import logging

logger = logging.getLogger(__name__)


def aggregate_daily_stats() -> int:
    """يجمّع مشاهدات الأمس في DailyStat.

    مهمة يومية. الأرقام التاريخية تُقرأ من DailyStat لا من PageView الخام،
    فتبقى اللوحة سريعة، ويمكن تقليم أرشيف المشاهدات بأمان لاحقًا.
    """
    from datetime import timedelta

    from django.db.models import Count
    from django.utils import timezone

    from apps.analytics.models import DailyStat, PageView

    day = (timezone.now() - timedelta(days=1)).date()
    views = PageView.objects.filter(created_at__date=day)

    written = 0

    def upsert(metric: str, dimension: str, value: int) -> None:
        nonlocal written
        DailyStat.objects.update_or_create(
            date=day, metric=metric, dimension=dimension, defaults={"value": value}
        )
        written += 1

    upsert("page_views", "", views.count())
    upsert("unique_visitors", "", views.values("session_hash").distinct().count())

    for row in views.values("device_type").annotate(n=Count("id")):
        upsert("device", row["device_type"], row["n"])

    for row in (
        views.exclude(referrer_domain="")
        .values("referrer_domain")
        .annotate(n=Count("id"))[:20]
    ):
        upsert("source", row["referrer_domain"], row["n"])

    logger.info("جُمّعت إحصائيات %s: %s سجل", day, written)
    return written


def prune_old_page_views(keep_days: int = 90) -> int:
    """يحذف مشاهدات أقدم من المدة المحددة (بعد تجميعها)."""
    from datetime import timedelta

    from django.utils import timezone

    from apps.analytics.models import PageView

    cutoff = timezone.now() - timedelta(days=keep_days)
    deleted, _ = PageView.objects.filter(created_at__lt=cutoff).delete()
    return deleted
