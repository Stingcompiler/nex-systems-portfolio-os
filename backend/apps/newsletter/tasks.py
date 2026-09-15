"""مهام النشرة الخلفية: التأكيد، الإرسال الدفعي القابل للاستئناف، الجدولة.

تُستدعى عبر `django_q.tasks.async_task` بمسارها النصي، لذا تبقى دوالًا
على مستوى الوحدة.
"""

import logging
import time

from django.conf import settings
from django.core.mail import EmailMultiAlternatives, get_connection
from django.db.models import F
from django.template import Context, Template
from django.template.loader import render_to_string
from django.utils import timezone
from django.utils.html import escape, strip_tags
from django.utils.safestring import mark_safe

from apps.newsletter.models import Campaign, CampaignRecipient, Subscriber

logger = logging.getLogger(__name__)

#: كل دفعة تُرسل عبر اتصال SMTP واحد ثم يُترك فاصل زمني كي لا يُصنَّف الإرسال كسبام
BATCH_SIZE = 50
BATCH_PAUSE_SECONDS = 2


def _site_name() -> str:
    try:
        from apps.core.models.settings import SiteSettings

        return SiteSettings.load().site_name_ar or "StingSystems"
    except Exception:  # noqa: BLE001
        return "StingSystems"


def _frontend(language: str, path: str) -> str:
    return f"{settings.FRONTEND_URL.rstrip('/')}/{language}/{path.lstrip('/')}"


def _api(path: str) -> str:
    # الـ API يُخدم عبر وسيط Next على النطاق نفسه، فالرابط يعمل من أي بريد
    return f"{settings.FRONTEND_URL.rstrip('/')}/api/v1/newsletter/{path.lstrip('/')}"


# --------------------------------------------------------------- التأكيد


def send_confirmation_email(subscriber_id: int) -> bool:
    subscriber = Subscriber.objects.filter(pk=subscriber_id).first()
    if not subscriber or not subscriber.confirm_token:
        return False

    language = subscriber.language if subscriber.language in ("ar", "en") else "ar"
    subject = {
        "ar": "أكّد اشتراكك في النشرة البريدية",
        "en": "Confirm your newsletter subscription",
    }[language]
    payload = {
        "language": language,
        "direction": "rtl" if language == "ar" else "ltr",
        "site_name": _site_name(),
        "frontend_url": settings.FRONTEND_URL,
        "user_name": subscriber.name,
        "action_url": _frontend(language, f"newsletter/confirm/{subscriber.confirm_token}"),
        "expires_hours": getattr(settings, "NEWSLETTER_CONFIRM_HOURS", 48),
    }
    html = render_to_string(f"emails/newsletter_confirm_{language}.html", payload)
    return _deliver(subject, html, subscriber.email)


def _deliver(subject: str, html: str, to_email: str, connection=None) -> bool:
    try:
        message = EmailMultiAlternatives(
            subject=subject,
            body=strip_tags(html),
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[to_email],
            connection=connection,
        )
        message.attach_alternative(html, "text/html")
        message.send(fail_silently=False)
        return True
    except Exception:  # noqa: BLE001
        logger.exception("فشل إرسال «%s» إلى %s", subject, to_email)
        return False


# --------------------------------------------------------------- التصيير


def content_to_html(text: str) -> str:
    """نص عادي → فقرات HTML مُهرَّبة. لا يُقبل HTML من المحرر، فلا سطح حقن."""
    paragraphs = [p.strip() for p in (text or "").replace("\r\n", "\n").split("\n\n")]
    html = "".join(
        f'<p style="margin:0 0 16px;">{escape(p).replace(chr(10), "<br />")}</p>'
        for p in paragraphs
        if p
    )
    return mark_safe(html)  # noqa: S308 — المحتوى مُهرَّب أعلاه


def render_campaign_email(
    campaign: Campaign,
    subscriber: Subscriber,
    recipient: CampaignRecipient | None = None,
    language: str | None = None,
) -> tuple[str, str]:
    """يعيد (الموضوع، HTML) لمستلم بعينه — بروابط إلغاء وتتبع خاصة به."""
    language = language or (subscriber.language if subscriber.language in ("ar", "en") else "ar")
    if campaign.target_language in ("ar", "en"):
        language = campaign.target_language

    subject = campaign.subject_for(language)
    unsubscribe_url = _frontend(language, f"newsletter/unsubscribe/{subscriber.unsubscribe_token}")
    preferences_url = _frontend(language, f"newsletter/preferences/{subscriber.unsubscribe_token}")
    cta_url = campaign.cta_url
    tracking_pixel = ""
    if recipient is not None:
        unsubscribe_url += f"?c={recipient.token}"
        tracking_pixel = _api(f"track/open/{recipient.token}.gif")
        if cta_url:
            cta_url = _api(f"track/click/{recipient.token}/")

    image_url = ""
    if campaign.image_id and campaign.image and campaign.image.file:
        image_url = campaign.image.file.url
        if image_url.startswith("/"):
            image_url = settings.FRONTEND_URL.rstrip("/") + image_url

    context = {
        "language": language,
        "direction": "rtl" if language == "ar" else "ltr",
        "site_name": _site_name(),
        "frontend_url": settings.FRONTEND_URL,
        "subject": subject,
        "subscriber_name": subscriber.name,
        "content": content_to_html(campaign.content_for(language)),
        "image_url": image_url,
        "cta_label": getattr(campaign, f"cta_label_{language}", "") or campaign.cta_label_ar
        or campaign.cta_label_en,
        "cta_url": cta_url,
        "unsubscribe_url": unsubscribe_url,
        "preferences_url": preferences_url,
        "tracking_pixel": tracking_pixel,
    }

    template = campaign.template
    custom_html = getattr(template, f"html_{language}", "") if template and template.is_active else ""
    if custom_html:
        html = Template(custom_html).render(Context(context))
    else:
        html = render_to_string(f"emails/campaign_{language}.html", context)
    return subject, html


# --------------------------------------------------------------- الإرسال


def send_campaign_test(campaign_id: int, to_email: str, language: str = "ar") -> bool:
    campaign = Campaign.objects.filter(pk=campaign_id).first()
    if campaign is None:
        return False
    # مشترك وهمي غير محفوظ — الروابط تحمل رمزًا لا يطابق أحدًا
    probe = Subscriber(email=to_email, name="", language=language, unsubscribe_token="test")
    subject, html = render_campaign_email(campaign, probe, None, language)
    return _deliver(f"[اختبار] {subject}", html, to_email)


def send_campaign(campaign_id: int) -> int:
    """يرسل على دفعات، ويُستأنف من آخر مستلم معلّق بعد أي انقطاع.

    كل مستلم يُعلَّم `sent` أو `failed` فور محاولته، فتشغيل المهمة مرتين
    (أو بعد سقوط العامل) لا يكرر رسالة لأحد.
    """
    campaign = Campaign.objects.select_related("template", "image").filter(pk=campaign_id).first()
    if campaign is None or campaign.status != Campaign.Status.SENDING:
        return 0

    processed = 0
    while True:
        # يُعاد فحص الحالة كل دفعة كي يُحترم الإلغاء أثناء الإرسال
        campaign.refresh_from_db(fields=["status"])
        if campaign.status != Campaign.Status.SENDING:
            return processed

        batch = list(
            CampaignRecipient.objects.filter(
                campaign=campaign, status=CampaignRecipient.Status.PENDING
            )
            .select_related("subscriber")
            .order_by("id")[:BATCH_SIZE]
        )
        if not batch:
            break

        sent = failed = 0
        with get_connection() as connection:
            for recipient in batch:
                subscriber = recipient.subscriber
                if subscriber.status != Subscriber.Status.ACTIVE:
                    # ألغى اشتراكه بعد إنشاء السجل — نتخطاه دون عدّه فشلًا
                    recipient.status = CampaignRecipient.Status.FAILED
                    recipient.error_message = "المشترك لم يعد نشطًا"
                    recipient.save(update_fields=["status", "error_message"])
                    failed += 1
                    continue

                subject, html = render_campaign_email(campaign, subscriber, recipient)
                ok = _deliver(subject, html, subscriber.email, connection=connection)
                recipient.status = (
                    CampaignRecipient.Status.SENT if ok else CampaignRecipient.Status.FAILED
                )
                recipient.sent_at = timezone.now() if ok else None
                recipient.error_message = "" if ok else "تعذّر الإرسال"
                recipient.save(update_fields=["status", "sent_at", "error_message"])
                sent += ok
                failed += not ok

        Campaign.objects.filter(pk=campaign.pk).update(
            sent_count=F("sent_count") + sent,
            failed_count=F("failed_count") + failed,
            last_activity_at=timezone.now(),
        )
        processed += len(batch)
        if len(batch) == BATCH_SIZE and BATCH_PAUSE_SECONDS and not _sync_mode():
            time.sleep(BATCH_PAUSE_SECONDS)

    campaign.refresh_from_db()
    campaign.status = (
        Campaign.Status.FAILED
        if campaign.total_recipients and campaign.sent_count == 0
        else Campaign.Status.SENT
    )
    campaign.sent_at = timezone.now()
    campaign.save(update_fields=["status", "sent_at", "updated_at"])
    logger.info(
        "اكتملت الحملة %s: %s أُرسل، %s فشل", campaign.pk, campaign.sent_count, campaign.failed_count
    )

    if campaign.failed_count:
        from apps.notifications.models import Notification

        Notification.notify(
            Notification.Type.EMAIL_FAILED,
            title_ar=f"فشل إرسال {campaign.failed_count} رسالة في حملة «{campaign.name}»",
            title_en=f"{campaign.failed_count} emails failed in campaign “{campaign.name}”",
            link=f"/dashboard/marketing/campaigns/{campaign.pk}",
            instance=campaign,
        )
    return processed


def _sync_mode() -> bool:
    return bool(getattr(settings, "Q_CLUSTER", {}).get("sync"))


# --------------------------------------------------------------- الدورية


def process_scheduled_campaigns() -> int:
    """مهمة كل 5 دقائق: تبدأ المجدولة التي حان موعدها وتستأنف المنقطعة."""
    from apps.newsletter.services import (
        due_scheduled_campaigns,
        resume_campaign,
        start_campaign,
        stuck_campaigns,
    )

    count = 0
    for campaign in due_scheduled_campaigns():
        try:
            start_campaign(campaign)
            count += 1
        except Exception:  # noqa: BLE001
            logger.exception("تعذّر بدء الحملة المجدولة %s", campaign.pk)

    for campaign in stuck_campaigns():
        logger.warning("استئناف حملة منقطعة %s", campaign.pk)
        resume_campaign(campaign)
        count += 1
    return count


def purge_stale_pending_subscribers() -> int:
    """مهمة يومية: حذف الاشتراكات التي لم تُؤكَّد خلال 7 أيام."""
    from apps.newsletter.services import purge_stale_pending

    removed = purge_stale_pending()
    if removed:
        logger.info("حُذف %s اشتراكًا معلّقًا", removed)
    return removed
