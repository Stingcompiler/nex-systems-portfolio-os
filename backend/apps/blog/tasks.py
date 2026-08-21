"""مهام خلفية للمدونة."""

import logging

logger = logging.getLogger(__name__)


def publish_scheduled_posts() -> int:
    """ينشر المقالات المجدولة التي حان موعدها.

    مهمة دورية كل 5 دقائق. حالة `scheduled` مع `published_at` ماضٍ تنتقل
    إلى `published`. الإبطال الموجَّه يجعلها تظهر على الموقع فورًا.
    """
    from django.utils import timezone

    from apps.blog.models import Post
    from apps.core.revalidate import revalidate

    now = timezone.now()
    due = Post.objects.filter(status=Post.Status.SCHEDULED, published_at__lte=now)

    slugs = list(due.values_list("slug", flat=True))
    count = due.update(status=Post.Status.PUBLISHED)

    if count:
        revalidate(["posts", "sections"])
        logger.info("نُشر %s مقالًا مجدولًا: %s", count, ", ".join(slugs))
    return count


def flush_view_counts(counts: dict[str, int]) -> int:
    """يزيد عدّادات المشاهدة دفعة واحدة.

    عدّاد لكل زيارة يعني كتابة في كل طلب؛ التجميع يقلّل ذلك بشدة،
    ويعمل رغم أن الصفحات مولّدة ثابتًا (العدّ يأتي من إشارة العميل).
    """
    from django.db.models import F

    from apps.blog.models import Post

    updated = 0
    for slug, increment in counts.items():
        updated += Post.objects.filter(slug=slug).update(
            view_count=F("view_count") + increment
        )
    return updated
