"""مهام خلفية للحسابات.

تُستدعى عبر `django_q.tasks.async_task` بمسارها النصي، لذا يجب أن تبقى
دوالًا على مستوى الوحدة.
"""

import logging

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.utils.html import strip_tags

logger = logging.getLogger(__name__)

_SUBJECTS = {
    "verify_email": {
        "ar": "تأكيد بريدك الإلكتروني",
        "en": "Confirm your email address",
    },
    "password_reset": {
        "ar": "استعادة كلمة المرور",
        "en": "Reset your password",
    },
    "password_changed": {
        "ar": "تم تغيير كلمة المرور",
        "en": "Your password was changed",
    },
    "request_confirmation": {
        "ar": "تأكيد استلام طلبك",
        "en": "Your request was received",
    },
    "contact_confirmation": {
        "ar": "استلمنا رسالتك",
        "en": "We received your message",
    },
}


def send_template_email(template: str, to_email: str, language: str, context: dict) -> bool:
    """يرسل رسالة HTML مع نسخة نصية بديلة. لا يرفع استثناء."""
    language = language if language in ("ar", "en") else "ar"
    subject = _SUBJECTS.get(template, {}).get(language, "NEXA SYSTEMS")

    payload = {
        "language": language,
        "direction": "rtl" if language == "ar" else "ltr",
        "site_name": "NEXA SYSTEMS",
        "frontend_url": settings.FRONTEND_URL,
        **context,
    }

    try:
        html_body = render_to_string(f"emails/{template}_{language}.html", payload)
        message = EmailMultiAlternatives(
            subject=subject,
            body=strip_tags(html_body),
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[to_email],
        )
        message.attach_alternative(html_body, "text/html")
        message.send(fail_silently=False)
        return True
    except Exception:  # noqa: BLE001
        logger.exception("فشل إرسال رسالة %s إلى %s", template, to_email)
        return False


def send_verification_email(user_id: int, token: str) -> bool:
    from apps.accounts.models import User

    user = User.objects.filter(pk=user_id).first()
    if not user:
        return False

    language = user.preferred_language
    link = f"{settings.FRONTEND_URL}/{language}/verify-email/{token}"
    return send_template_email(
        "verify_email",
        user.email,
        language,
        {
            "user_name": user.get_short_name(),
            "action_url": link,
            "expires_hours": settings.EMAIL_VERIFICATION_HOURS,
        },
    )


def send_password_reset_email(user_id: int, token: str) -> bool:
    from apps.accounts.models import User

    user = User.objects.filter(pk=user_id).first()
    if not user:
        return False

    language = user.preferred_language
    link = f"{settings.FRONTEND_URL}/{language}/reset-password/{token}"
    return send_template_email(
        "password_reset",
        user.email,
        language,
        {
            "user_name": user.get_short_name(),
            "action_url": link,
            "expires_hours": settings.PASSWORD_RESET_HOURS,
        },
    )


def send_password_changed_email(user_id: int) -> bool:
    from apps.accounts.models import User

    user = User.objects.filter(pk=user_id).first()
    if not user:
        return False

    language = user.preferred_language
    return send_template_email(
        "password_changed",
        user.email,
        language,
        {
            "user_name": user.get_short_name(),
            "action_url": f"{settings.FRONTEND_URL}/{language}/login",
        },
    )


def cleanup_expired_tokens() -> int:
    """مهمة دورية يومية لتنظيف الرموز المنتهية."""
    from django.utils import timezone

    from apps.accounts.models import EmailVerificationToken, PasswordResetToken

    now = timezone.now()
    removed = 0
    for model in (EmailVerificationToken, PasswordResetToken):
        deleted, _ = model.objects.filter(expires_at__lt=now).delete()
        removed += deleted
    logger.info("حُذف %s رمزًا منتهيًا", removed)
    return removed
