"""منطق النشرة: الاشتراك المزدوج، الجمهور، وتجهيز الحملات.

يعيش هنا لا في الـ Views كي يُستدعى من الـ API والمهام الخلفية والاختبارات
على السواء.
"""

import logging
from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.db.models import QuerySet
from django.utils import timezone
from django_q.tasks import async_task

from apps.newsletter.models import Campaign, CampaignRecipient, Interest, Subscriber

logger = logging.getLogger(__name__)

#: أقل فاصل بين رسالتي تأكيد للبريد نفسه
RESEND_CONFIRMATION_MINUTES = 10
#: السجلات المعلّقة الأقدم من هذا تُحذف آليًا
STALE_PENDING_DAYS = 7
#: حملة «قيد الإرسال» بلا نشاط لهذه المدة تُعتبر منقطعة وتُستأنف
STUCK_SENDING_MINUTES = 10


class NewsletterError(Exception):
    def __init__(self, message: str, code: str = "newsletter_error"):
        super().__init__(message)
        self.message = message
        self.code = code


def _enqueue(task_path: str, *args) -> None:
    try:
        async_task(task_path, *args)
    except Exception:  # noqa: BLE001
        logger.exception("تعذّرت جدولة المهمة %s", task_path)


# --------------------------------------------------------------- الاشتراك


def subscribe(
    *,
    email: str,
    name: str = "",
    language: str = "ar",
    interests: list[str] | None = None,
    source: str = Subscriber.Source.HOME,
    ip: str | None = None,
    user=None,
) -> tuple[Subscriber, str]:
    """ينشئ اشتراكًا معلّقًا أو يعيد إرسال التأكيد.

    يعيد (المشترك، النتيجة) والنتيجة إحدى:
    `created` · `resent` · `throttled` · `already_active` · `reactivated`.
    الاستجابة العامة لا تفرّق بينها كي لا يُكشف وجود بريد لدينا.
    """
    email = email.strip().lower()
    language = language if language in ("ar", "en") else "ar"
    interest_keys = interests or []

    with transaction.atomic():
        subscriber = Subscriber.objects.select_for_update().filter(email=email).first()

        if subscriber is None:
            subscriber = Subscriber(
                email=email, name=name[:120], language=language, source=source, user=user
            )
            subscriber.issue_confirm_token()
            subscriber.save()
            _set_interests(subscriber, interest_keys)
            outcome = "created"

        elif subscriber.status == Subscriber.Status.ACTIVE:
            # موجود ونشط: لا رسالة ولا كشف. نحدّث الاهتمامات إن أرسلها صاحبها
            if interest_keys:
                _set_interests(subscriber, interest_keys)
            if user and not subscriber.user_id:
                subscriber.user = user
                subscriber.save(update_fields=["user", "updated_at"])
            return subscriber, "already_active"

        elif subscriber.status == Subscriber.Status.PENDING:
            recently = subscriber.confirm_sent_at and (
                timezone.now() - subscriber.confirm_sent_at
                < timedelta(minutes=RESEND_CONFIRMATION_MINUTES)
            )
            if recently:
                return subscriber, "throttled"
            subscriber.issue_confirm_token()
            if name:
                subscriber.name = name[:120]
            subscriber.language = language
            subscriber.save(update_fields=[
                "confirm_token", "confirm_sent_at", "name", "language", "updated_at",
            ])
            if interest_keys:
                _set_interests(subscriber, interest_keys)
            outcome = "resent"

        else:
            # ألغى الاشتراك أو ارتد أو اشتكى: إعادة تفعيل بتحقق جديد
            subscriber.status = Subscriber.Status.PENDING
            subscriber.issue_confirm_token()
            subscriber.language = language
            subscriber.source = source
            if name:
                subscriber.name = name[:120]
            if user and not subscriber.user_id:
                subscriber.user = user
            subscriber.save()
            if interest_keys:
                _set_interests(subscriber, interest_keys)
            outcome = "reactivated"

    _enqueue("apps.newsletter.tasks.send_confirmation_email", subscriber.pk)
    return subscriber, outcome


def _set_interests(subscriber: Subscriber, keys: list[str]) -> None:
    interests = Interest.objects.filter(key__in=keys) if keys else Interest.objects.none()
    subscriber.interests.set(interests)


def confirm_subscription(token: str, *, ip: str | None = None) -> Subscriber:
    token = (token or "").strip()
    if not token:
        raise NewsletterError("رمز التأكيد غير صالح", "invalid_token")

    subscriber = Subscriber.objects.filter(confirm_token=token).first()
    if subscriber is None:
        raise NewsletterError("رمز التأكيد غير صالح أو استُخدم من قبل", "invalid_token")
    if subscriber.confirm_token_expired:
        raise NewsletterError("انتهت صلاحية رابط التأكيد — اشترك مجددًا", "token_expired")

    subscriber.activate(ip=ip)
    return subscriber


def get_by_unsubscribe_token(token: str) -> Subscriber:
    token = (token or "").strip()
    subscriber = Subscriber.objects.filter(unsubscribe_token=token).first() if token else None
    if subscriber is None:
        raise NewsletterError("الرابط غير صالح", "invalid_token")
    return subscriber


def unsubscribe(token: str, *, recipient_token: str = "") -> Subscriber:
    """إلغاء بنقرة واحدة. لا يتطلب دخولًا: الرمز نفسه هو الإثبات."""
    subscriber = get_by_unsubscribe_token(token)
    if subscriber.status != Subscriber.Status.UNSUBSCRIBED:
        subscriber.unsubscribe()
        if recipient_token:
            _count_campaign_unsubscribe(recipient_token, subscriber)
    return subscriber


def _count_campaign_unsubscribe(recipient_token: str, subscriber: Subscriber) -> None:
    from django.db.models import F

    recipient = CampaignRecipient.objects.filter(
        token=recipient_token, subscriber=subscriber
    ).first()
    if recipient:
        Campaign.objects.filter(pk=recipient.campaign_id).update(
            unsubscribe_count=F("unsubscribe_count") + 1
        )


def update_preferences(
    subscriber: Subscriber, *, name=None, language=None, interests=None
) -> Subscriber:
    fields = []
    if name is not None:
        subscriber.name = name[:120]
        fields.append("name")
    if language in ("ar", "en"):
        subscriber.language = language
        fields.append("language")
    if fields:
        subscriber.save(update_fields=[*fields, "updated_at"])
    if interests is not None:
        _set_interests(subscriber, interests)
    return subscriber


def purge_stale_pending() -> int:
    cutoff = timezone.now() - timedelta(days=STALE_PENDING_DAYS)
    deleted, _ = Subscriber.objects.filter(
        status=Subscriber.Status.PENDING, created_at__lt=cutoff
    ).delete()
    return deleted


# --------------------------------------------------------------- الجمهور


def audience_queryset(campaign: Campaign) -> QuerySet[Subscriber]:
    """المشتركون النشطون الذين تطابقهم معايير الحملة."""
    queryset = Subscriber.objects.filter(status=Subscriber.Status.ACTIVE)
    if campaign.target_language != Campaign.TargetLanguage.ALL:
        queryset = queryset.filter(language=campaign.target_language)
    interest_ids = list(campaign.target_interests.values_list("id", flat=True))
    if interest_ids:
        queryset = queryset.filter(interests__in=interest_ids)
    return queryset.distinct()


def audience_breakdown(campaign: Campaign) -> dict:
    queryset = audience_queryset(campaign)
    return {
        "total": queryset.count(),
        "ar": queryset.filter(language="ar").count(),
        "en": queryset.filter(language="en").count(),
    }


# --------------------------------------------------------------- الإرسال


def _ensure_sendable(campaign: Campaign) -> None:
    if not campaign.is_editable:
        raise NewsletterError(
            f"لا يمكن إرسال حملة بحالة «{campaign.get_status_display()}»", "invalid_state"
        )
    if not (campaign.subject_ar or campaign.subject_en):
        raise NewsletterError("الموضوع مطلوب قبل الإرسال", "validation_error")
    if not (campaign.content_ar or campaign.content_en):
        raise NewsletterError("المحتوى مطلوب قبل الإرسال", "validation_error")


def schedule_campaign(campaign: Campaign, when) -> Campaign:
    _ensure_sendable(campaign)
    if when <= timezone.now():
        raise NewsletterError("موعد الإرسال يجب أن يكون في المستقبل", "validation_error")
    campaign.status = Campaign.Status.SCHEDULED
    campaign.scheduled_at = when
    campaign.save(update_fields=["status", "scheduled_at", "updated_at"])
    return campaign


def cancel_campaign(campaign: Campaign) -> Campaign:
    if campaign.status not in (
        Campaign.Status.SCHEDULED, Campaign.Status.SENDING, Campaign.Status.DRAFT
    ):
        raise NewsletterError("لا يمكن إلغاء هذه الحملة", "invalid_state")
    campaign.status = Campaign.Status.CANCELLED
    campaign.save(update_fields=["status", "updated_at"])
    return campaign


def start_campaign(campaign: Campaign) -> Campaign:
    """ينشئ سجلات المستلمين ويبدأ الإرسال في الخلفية.

    إنشاء المستلمين متكرر التنفيذ بأمان (`ignore_conflicts`)، فإعادة
    الاستدعاء لا تضاعف أحدًا.
    """
    _ensure_sendable(campaign)
    audience = audience_queryset(campaign)

    with transaction.atomic():
        CampaignRecipient.objects.bulk_create(
            [CampaignRecipient(campaign=campaign, subscriber=s) for s in audience.only("id")],
            ignore_conflicts=True,
            batch_size=500,
        )
        campaign.total_recipients = campaign.recipients.count()
        campaign.status = Campaign.Status.SENDING
        campaign.started_at = campaign.started_at or timezone.now()
        campaign.last_activity_at = timezone.now()
        campaign.save(update_fields=[
            "total_recipients", "status", "started_at", "last_activity_at", "updated_at",
        ])

    _enqueue("apps.newsletter.tasks.send_campaign", campaign.pk)
    return campaign


def resume_campaign(campaign: Campaign) -> None:
    """يعيد جدولة الإرسال لحملة انقطعت — يُكمل من المستلمين المعلّقين فقط."""
    campaign.last_activity_at = timezone.now()
    campaign.save(update_fields=["last_activity_at", "updated_at"])
    _enqueue("apps.newsletter.tasks.send_campaign", campaign.pk)


def due_scheduled_campaigns() -> QuerySet[Campaign]:
    return Campaign.objects.filter(
        status=Campaign.Status.SCHEDULED, scheduled_at__lte=timezone.now()
    )


def stuck_campaigns() -> QuerySet[Campaign]:
    cutoff = timezone.now() - timedelta(minutes=STUCK_SENDING_MINUTES)
    return Campaign.objects.filter(
        status=Campaign.Status.SENDING, last_activity_at__lt=cutoff
    )


# --------------------------------------------------------------- من المحتوى


#: ربط نوع المحتوى بالاهتمام الافتراضي ومسار الصفحة
CONTENT_SOURCES = {
    "post": ("blog", "Post", "articles", "blog"),
    "project": ("portfolio", "Project", "new_projects", "projects"),
    "service": ("portfolio", "Service", "new_services", "services"),
}


def draft_from_content(kind: str, object_id: int, *, user=None) -> Campaign:
    """يبني مسودة حملة من مقال أو مشروع أو خدمة منشورة.

    الموضوع من العنوان، والمحتوى من الملخص، والزر يقود إلى الصفحة،
    والجمهور المستهدف هو الاهتمام المقابل للنوع.
    """
    from django.apps import apps as django_apps

    if kind not in CONTENT_SOURCES:
        raise NewsletterError("نوع المحتوى غير مدعوم", "validation_error")
    app_label, model_name, interest_key, path = CONTENT_SOURCES[kind]
    model = django_apps.get_model(app_label, model_name)
    item = model.objects.filter(pk=object_id).first()
    if item is None:
        raise NewsletterError("المحتوى غير موجود", "not_found")

    summary_ar = getattr(item, "excerpt_ar", "") or getattr(item, "summary_ar", "") or getattr(
        item, "short_description_ar", ""
    )
    summary_en = getattr(item, "excerpt_en", "") or getattr(item, "summary_en", "") or getattr(
        item, "short_description_en", ""
    )
    labels = {
        "post": ("مقال جديد: ", "New article: ", "اقرأ المقال", "Read the article"),
        "project": ("مشروع جديد: ", "New project: ", "شاهد المشروع", "View the project"),
        "service": ("خدمة جديدة: ", "New service: ", "تعرّف على الخدمة", "Explore the service"),
    }[kind]

    campaign = Campaign.objects.create(
        name=f"{model._meta.verbose_name}: {item}"[:160],
        subject_ar=(labels[0] + (item.title_ar or item.title_en))[:200],
        subject_en=(labels[1] + (item.title_en or item.title_ar))[:200],
        content_ar=summary_ar,
        content_en=summary_en,
        cta_label_ar=labels[2],
        cta_label_en=labels[3],
        cta_url=f"{settings.FRONTEND_URL}/ar/{path}/{item.slug}",
        source_model=model_name,
        source_id=item.pk,
        created_by=user,
        updated_by=user,
    )
    interest = Interest.objects.filter(key=interest_key).first()
    if interest:
        campaign.target_interests.add(interest)
    return campaign


# --------------------------------------------------------------- الأعضاء


def sync_member_subscription(user) -> Subscriber | None:
    """يوائم اشتراك العضو مع خيار `newsletter_opt_in` في ملفه.

    البريد المؤكَّد في الحساب يغني عن رسالة تأكيد ثانية: العضو أثبت
    ملكية العنوان بالفعل. غير المؤكَّد ينتظر حتى يؤكّد.
    """
    from apps.accounts.models import MemberProfile

    # استعلام صريح لا `user.member_profile`: الوصول عبر العلاقة يخزّن الملف على
    # كائن المستخدم داخل الطلب الجاري، فتُعاد نسخة قديمة في الاستجابة بعد تعديله
    profile = MemberProfile.objects.filter(user=user).first()
    if profile is None:
        return None

    subscriber = Subscriber.objects.filter(email__iexact=user.email).first()

    if not profile.newsletter_opt_in:
        if subscriber and subscriber.status == Subscriber.Status.ACTIVE and subscriber.user_id == user.id:
            subscriber.unsubscribe()
        return subscriber

    if not user.is_email_verified:
        return subscriber

    if subscriber is None:
        subscriber = Subscriber(
            email=user.email.lower(), name=user.full_name,
            language=user.preferred_language if user.preferred_language in ("ar", "en") else "ar",
            source=Subscriber.Source.MEMBER_SIGNUP, user=user,
        )
        subscriber.save()
        subscriber.interests.set(Interest.objects.all())
    elif not subscriber.user_id:
        subscriber.user = user
        subscriber.save(update_fields=["user", "updated_at"])

    if subscriber.status != Subscriber.Status.ACTIVE:
        subscriber.activate(ip=None)
    return subscriber
