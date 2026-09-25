"""مهام خلفية لإدارة العملاء."""

import logging

from django.conf import settings
from django.utils import timezone

from apps.accounts.tasks import send_template_email

logger = logging.getLogger(__name__)


def tracking_url(token: str | None, language: str) -> str:
    """رابط صفحة المتابعة، أو صفحة البحث إن غاب الرمز."""
    base = f"{settings.FRONTEND_URL}/{language}/track"
    return f"{base}/{token}" if token else base


def send_reply_notification(reply_id: int) -> bool:
    """يرسل رد الفريق إلى بريد صاحب الطلب أو الرسالة مع رابط المتابعة."""
    from apps.crm.models import ClientReply

    reply = (
        ClientReply.objects.select_related("request", "message").filter(pk=reply_id).first()
    )
    target = reply.target if reply else None
    if target is None or not target.email:
        return False

    is_request = reply.request_id is not None
    language = getattr(target, "preferred_language", None) or getattr(target, "language", "ar")
    language = language if language in ("ar", "en") else "ar"
    what = {
        ("ar", True): "طلبك", ("ar", False): "رسالتك",
        ("en", True): "your request", ("en", False): "your message",
    }[(language, is_request)]
    return send_template_email(
        "client_reply",
        target.email,
        language,
        {
            "user_name": target.name or "",
            "what": what,
            "reference_code": target.reference_code,
            "body": reply.body,
            "action_url": tracking_url(target.tracking_token, language),
        },
    )


def send_request_confirmation(request_id: int) -> bool:
    from apps.crm.models import ProjectRequest

    request = ProjectRequest.objects.filter(pk=request_id).first()
    if not request or not request.email:
        return False

    language = request.preferred_language if request.preferred_language in ("ar", "en") else "ar"
    return send_template_email(
        "request_confirmation",
        request.email,
        language,
        {
            "user_name": request.name or "",
            "reference_code": request.reference_code,
            "project_type": request.get_project_type_display(),
            "action_url": tracking_url(request.tracking_token, language),
        },
    )


def send_contact_confirmation(message_id: int) -> bool:
    from apps.crm.models import ContactMessage

    message = ContactMessage.objects.filter(pk=message_id).first()
    if not message or not message.email:
        return False

    language = message.language if message.language in ("ar", "en") else "ar"
    return send_template_email(
        "contact_confirmation",
        message.email,
        language,
        {
            "user_name": message.name,
            "reference_code": message.reference_code,
            "action_url": tracking_url(message.tracking_token, language),
        },
    )


def remind_due_follow_ups() -> int:
    """مهمة يومية: إشعار المسؤولين بمواعيد المتابعة خلال 24 ساعة."""
    from datetime import timedelta

    from apps.crm.enums import FollowUpStatus
    from apps.crm.models import FollowUp
    from apps.notifications.models import Notification

    window_end = timezone.now() + timedelta(hours=24)
    due = FollowUp.objects.filter(
        status=FollowUpStatus.PENDING,
        reminder_sent=False,
        due_at__lte=window_end,
    ).select_related("assigned_to", "lead", "client")

    count = 0
    for follow_up in due:
        target = follow_up.lead or follow_up.client
        Notification.notify(
            Notification.Type.FOLLOW_UP_DUE,
            title_ar=f"موعد متابعة: {follow_up.title}",
            title_en=f"Follow-up due: {follow_up.title}",
            message_ar=str(target) if target else "",
            link=(
                f"/dashboard/crm/leads/{follow_up.lead_id}"
                if follow_up.lead_id
                else f"/dashboard/crm/clients/{follow_up.client_id}"
            ),
            recipient=follow_up.assigned_to,
            instance=follow_up,
        )
        count += 1

    FollowUp.objects.filter(pk__in=[f.pk for f in due]).update(reminder_sent=True)
    if count:
        logger.info("أُرسل %s تذكير متابعة", count)
    return count


def mark_missed_follow_ups() -> int:
    """مهمة يومية: تعليم المتابعات الفائتة."""
    from apps.crm.enums import FollowUpStatus
    from apps.crm.models import FollowUp

    updated = FollowUp.objects.filter(
        status=FollowUpStatus.PENDING, due_at__lt=timezone.now()
    ).update(status=FollowUpStatus.MISSED)
    return updated
