"""إشعارات النشرة وربط الأعضاء بالاشتراك."""

from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver

from apps.newsletter.models import Subscriber


@receiver(pre_save, sender=Subscriber)
def remember_previous_status(sender, instance: Subscriber, **kwargs):
    if instance.pk:
        previous = Subscriber.objects.filter(pk=instance.pk).values_list("status", flat=True).first()
        instance._previous_status = previous
    else:
        instance._previous_status = None


@receiver(post_save, sender=Subscriber)
def notify_new_active_subscriber(sender, instance: Subscriber, created: bool, **kwargs):
    """إشعار المدير عند تأكيد الاشتراك، لا عند مجرد الطلب (قد لا يُؤكَّد أبدًا)."""
    if instance.status != Subscriber.Status.ACTIVE:
        return
    if getattr(instance, "_previous_status", None) == Subscriber.Status.ACTIVE:
        return

    from apps.notifications.models import Notification

    Notification.notify(
        Notification.Type.NEW_SUBSCRIBER,
        title_ar="مشترك جديد في النشرة",
        title_en="New newsletter subscriber",
        message_ar=instance.email,
        link="/dashboard/marketing/subscribers",
        instance=instance,
    )


def _sync(user):
    from apps.newsletter.services import sync_member_subscription

    try:
        sync_member_subscription(user)
    except Exception:  # noqa: BLE001 — الاشتراك لا يُسقط حفظ الحساب
        import logging

        logging.getLogger(__name__).exception("تعذّرت موائمة اشتراك العضو %s", user.pk)


@receiver(post_save, sender="accounts.MemberProfile")
def sync_on_profile_change(sender, instance, **kwargs):
    if instance.pk is None or kwargs.get("raw"):
        return
    _sync(instance.user)


@receiver(post_save, sender="accounts.User")
def sync_on_email_verified(sender, instance, created: bool, update_fields=None, **kwargs):
    """تفعيل اشتراك العضو لحظة تأكيد بريده إن كان قد اختار النشرة عند التسجيل."""
    if created or kwargs.get("raw"):
        return
    if update_fields is not None and "is_email_verified" not in update_fields:
        return
    if instance.is_email_verified:
        _sync(instance)
