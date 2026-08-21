"""تحديث عدّاد استخدام الوسوم."""

from django.db.models import Count
from django.db.models.signals import m2m_changed
from django.dispatch import receiver

from apps.blog.models import Post


@receiver(m2m_changed, sender=Post.tags.through)
def sync_tag_usage(sender, instance, action, pk_set, **kwargs):
    """يعيد حساب عدد المقالات لكل وسم عند تغيّر وسوم مقال."""
    if action not in ("post_add", "post_remove", "post_clear"):
        return

    from apps.blog.models import Tag

    affected = pk_set or set(instance.tags.values_list("pk", flat=True))
    for tag in Tag.objects.filter(pk__in=affected).annotate(total=Count("posts")):
        if tag.usage_count != tag.total:
            Tag.objects.filter(pk=tag.pk).update(usage_count=tag.total)
