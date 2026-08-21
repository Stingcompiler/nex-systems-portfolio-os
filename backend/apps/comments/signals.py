"""إشعارات التعليقات."""

from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.comments.models import Comment, CommentReport


@receiver(post_save, sender=Comment)
def notify_new_comment(sender, instance: Comment, created: bool, **kwargs):
    """إشعار المديرين بتعليق جديد قيد المراجعة."""
    if not created or instance.status == Comment.Status.SPAM:
        return

    from apps.notifications.models import Notification

    Notification.notify(
        Notification.Type.NEW_COMMENT,
        title_ar="تعليق جديد بانتظار المراجعة",
        title_en="New comment awaiting review",
        message_ar=f"{instance.author_name}: {instance.content[:60]}",
        link=f"/dashboard/community/comments?status=pending",
        instance=instance,
    )


@receiver(post_save, sender=Comment)
def notify_reply_author(sender, instance: Comment, created: bool, **kwargs):
    """إشعار صاحب التعليق الأصلي عند اعتماد رد عليه.

    يُطلق عند تحوّل الرد إلى معتمد، لا عند إنشائه (لأنه يبدأ pending).
    """
    if created or instance.status != Comment.Status.APPROVED:
        return
    if not instance.parent_id:
        return

    parent = instance.parent
    if not parent.notify_on_reply or not parent.user_id:
        return
    if parent.user_id == instance.user_id:
        return  # لا تُشعر المستخدم بردّه على نفسه

    from apps.notifications.models import Notification

    Notification.notify(
        Notification.Type.COMMENT_REPLY,
        title_ar="رد جديد على تعليقك",
        title_en="New reply to your comment",
        message_ar=f"{instance.author_name}: {instance.content[:60]}",
        link=f"/blog/{instance.post.slug}",
        recipient=parent.user,
        instance=instance,
    )


@receiver(post_save, sender=CommentReport)
def notify_new_report(sender, instance: CommentReport, created: bool, **kwargs):
    if not created:
        return

    from apps.notifications.models import Notification

    Notification.notify(
        Notification.Type.COMMENT_REPORT,
        title_ar="بلاغ جديد عن تعليق",
        title_en="New comment report",
        message_ar=instance.get_reason_display(),
        link="/dashboard/community/reports",
        instance=instance,
    )
