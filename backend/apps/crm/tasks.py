"""مهام خلفية لإدارة العملاء."""

import logging

from django.conf import settings
from django.utils import timezone

from apps.accounts.tasks import send_template_email

logger = logging.getLogger(__name__)


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
            "action_url": f"{settings.FRONTEND_URL}/{language}",
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
            "action_url": f"{settings.FRONTEND_URL}/{language}",
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
