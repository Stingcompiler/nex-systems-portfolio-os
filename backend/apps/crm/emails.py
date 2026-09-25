"""رسائل تأكيد العميل — تُجدول في الخلفية."""

import logging

from django_q.tasks import async_task

logger = logging.getLogger(__name__)


def queue_request_confirmation(request) -> None:
    if not request.email:
        return
    try:
        async_task("apps.crm.tasks.send_request_confirmation", request.pk)
    except Exception:  # noqa: BLE001
        logger.exception("تعذّرت جدولة تأكيد الطلب %s", request.pk)


def queue_contact_confirmation(message) -> None:
    if not message.email:
        return
    try:
        async_task("apps.crm.tasks.send_contact_confirmation", message.pk)
    except Exception:  # noqa: BLE001
        logger.exception("تعذّرت جدولة تأكيد رسالة التواصل %s", message.pk)


def queue_reply_notification(reply) -> None:
    target = reply.target
    if not target or not target.email:
        return
    try:
        async_task("apps.crm.tasks.send_reply_notification", reply.pk)
    except Exception:  # noqa: BLE001
        logger.exception("تعذّرت جدولة إرسال الرد %s", reply.pk)
