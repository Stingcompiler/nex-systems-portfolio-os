"""إرسال إشعارات المتصفح (Web Push) لفريق اللوحة.

يُرسل عند إنشاء إشعار من الأنواع في ``PUSH_TYPES`` — طلب مشروع ورسالة
تواصل — إلى أجهزة من يحق له رؤيته. الإرسال في خيط خلفي بعد إتمام
المعاملة: لا يؤخر رد نموذج الطلب على الزائر، ولا ينتظر عامل المهام الذي
يعمل كل خمس دقائق.
"""

import json
import logging
import threading

from django.conf import settings
from django.db import transaction
from django.utils import timezone

logger = logging.getLogger(__name__)

PUSH_TYPES = {"project_request", "contact_message"}
TIMEOUT_SECONDS = 10


def recipients_for(notification):
    """مستخدمو الإشعار: المحدد، وإلا فريق إدارة العملاء كله."""
    from apps.accounts.models import User

    if notification.recipient_id:
        return User.objects.filter(pk=notification.recipient_id, is_active=True)
    team = [
        user
        for user in User.objects.filter(is_active=True, push_subscriptions__isnull=False).distinct()
        if user.is_superuser or (user.is_dashboard_user and user.has_perm("crm.view_lead"))
    ]
    return team


def payload_for(notification) -> dict:
    return {
        "title": notification.title_ar or notification.title_en,
        "body": notification.message_ar or notification.message_en,
        "url": notification.link or "/dashboard",
        "tag": f"{notification.type}-{notification.object_id or notification.pk}",
    }


def send_to_user(user, payload: dict) -> int:
    """يرسل إلى كل أجهزة المستخدم؛ يحذف الاشتراكات المنتهية. يعيد عدد المرسَل."""
    from py_vapid import Vapid
    from pywebpush import WebPushException, webpush

    from apps.notifications.models import PushKeys, PushSubscription

    keys = PushKeys.load()
    vapid = Vapid.from_pem(keys.private_pem.encode())
    subject = getattr(settings, "PUSH_CONTACT", "") or "mailto:admin@stingdev.pro"
    data = json.dumps(payload, ensure_ascii=False)

    sent = 0
    for subscription in PushSubscription.objects.filter(user=user):
        try:
            webpush(
                subscription_info={
                    "endpoint": subscription.endpoint,
                    "keys": {"p256dh": subscription.p256dh, "auth": subscription.auth},
                },
                data=data,
                vapid_private_key=vapid,
                vapid_claims={"sub": subject},
                timeout=TIMEOUT_SECONDS,
                ttl=24 * 3600,
            )
        except WebPushException as error:
            status = getattr(error.response, "status_code", None)
            if status in (404, 410):
                # ألغى المستخدم الإذن أو أزال التطبيق: الاشتراك لم يعد صالحًا
                subscription.delete()
            else:
                logger.warning("تعذّر إرسال إشعار المتصفح (%s): %s", status, error)
            continue
        except Exception:  # noqa: BLE001
            logger.exception("تعذّر إرسال إشعار المتصفح")
            continue
        PushSubscription.objects.filter(pk=subscription.pk).update(last_used_at=timezone.now())
        sent += 1
    return sent


def send_notification(notification_id: int) -> int:
    from apps.notifications.models import Notification

    notification = Notification.objects.filter(pk=notification_id).first()
    if notification is None:
        return 0
    payload = payload_for(notification)
    return sum(send_to_user(user, payload) for user in recipients_for(notification))


def queue_push(notification) -> None:
    """بعد إتمام المعاملة، في خيط خلفي (أو مباشرة في الاختبارات)."""
    if notification.type not in PUSH_TYPES:
        return

    def run():
        try:
            send_notification(notification.pk)
        except Exception:  # noqa: BLE001
            logger.exception("فشل إرسال إشعارات المتصفح للإشعار %s", notification.pk)

    def start():
        if getattr(settings, "PUSH_SYNC", False):
            run()
        else:
            threading.Thread(target=run, name="web-push", daemon=True).start()

    transaction.on_commit(start)
