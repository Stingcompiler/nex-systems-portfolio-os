"""اختبارات النشرة: الاشتراك المزدوج، الروابط الموقّعة، الجمهور، الإرسال القابل للاستئناف."""

from datetime import timedelta
from unittest.mock import patch

import pytest
from django.core import mail
from django.core.management import call_command
from django.utils import timezone

from apps.newsletter import services
from apps.newsletter.models import Campaign, CampaignRecipient, Interest, Subscriber
from apps.newsletter.tasks import send_campaign
from apps.notifications.models import Notification

pytestmark = pytest.mark.django_db

SUBSCRIBE = "/api/v1/subscribers/subscribe/"
CONFIRM = "/api/v1/subscribers/confirm/"
UNSUBSCRIBE = "/api/v1/subscribers/unsubscribe/"
PREFS = "/api/v1/subscribers/preferences/{}/"
CAMPAIGNS = "/api/v1/campaigns/"

HUMAN = {"elapsed_seconds": 8}


@pytest.fixture(autouse=True)
def groups(db):
    call_command("seed_groups", verbosity=0)


@pytest.fixture
def marketing(make_user):
    return make_user(email="mk@example.com", role="marketing_manager")


@pytest.fixture
def marketing_client(api_client, marketing):
    r = api_client.post(
        "/api/v1/auth/login/",
        {"email": marketing.email, "password": marketing.raw_password},
        format="json",
    )
    assert r.status_code == 200
    return api_client


def _active(email, language="ar", interests=()):
    s = Subscriber.objects.create(
        email=email, language=language, status=Subscriber.Status.ACTIVE,
        confirmed_at=timezone.now(),
    )
    if interests:
        s.interests.set(Interest.objects.filter(key__in=interests))
    return s


# --------------------------------------------------------------- الاشتراك


def test_default_interests_seeded():
    assert set(Interest.objects.values_list("key", flat=True)) >= {
        "new_projects", "new_services", "articles", "offers", "product_updates",
    }


def test_subscribe_creates_pending_and_sends_confirmation(api_client):
    r = api_client.post(
        SUBSCRIBE,
        {"email": "New@Example.com", "interests": ["articles"], "source": "footer", **HUMAN},
        format="json",
    )
    assert r.status_code == 202

    s = Subscriber.objects.get()
    assert s.email == "new@example.com"
    assert s.status == Subscriber.Status.PENDING
    assert s.confirm_token
    assert [i.key for i in s.interests.all()] == ["articles"]
    assert s.source == "footer"

    assert len(mail.outbox) == 1
    assert s.confirm_token in mail.outbox[0].alternatives[0][0]
    assert "/ar/newsletter/confirm/" in mail.outbox[0].alternatives[0][0]
    # لا إشعار للمدير قبل التأكيد
    assert not Notification.objects.filter(type="new_subscriber").exists()


def test_confirm_activates_and_records_consent(api_client):
    api_client.post(SUBSCRIBE, {"email": "a@example.com", **HUMAN}, format="json")
    token = Subscriber.objects.get().confirm_token

    r = api_client.post(CONFIRM, {"token": token}, format="json", REMOTE_ADDR="10.0.0.9")
    assert r.status_code == 200
    s = Subscriber.objects.get()
    assert s.status == Subscriber.Status.ACTIVE
    assert s.consent_ip == "10.0.0.9"
    assert s.consent_at and s.confirmed_at
    assert s.confirm_token == ""  # يُستهلك مرة واحدة
    assert r.data["preferences_token"] == s.unsubscribe_token

    assert Notification.objects.filter(type="new_subscriber").count() == 1

    # الرمز لا يُعاد استخدامه
    again = api_client.post(CONFIRM, {"token": token}, format="json")
    assert again.status_code == 400
    assert again.data["code"] == "invalid_token"


def test_expired_confirm_token_rejected(api_client):
    api_client.post(SUBSCRIBE, {"email": "old@example.com", **HUMAN}, format="json")
    s = Subscriber.objects.get()
    Subscriber.objects.filter(pk=s.pk).update(
        confirm_sent_at=timezone.now() - timedelta(hours=49)
    )
    r = api_client.post(CONFIRM, {"token": s.confirm_token}, format="json")
    assert r.status_code == 400
    assert r.data["code"] == "token_expired"


def test_subscribe_response_is_neutral_for_existing_active(api_client):
    _active("exists@example.com")
    r = api_client.post(SUBSCRIBE, {"email": "exists@example.com", **HUMAN}, format="json")
    fresh = api_client.post(SUBSCRIBE, {"email": "fresh@example.com", **HUMAN}, format="json")

    assert r.status_code == fresh.status_code == 202
    assert r.data == fresh.data  # لا فرق يكشف وجود البريد
    assert len(mail.outbox) == 1  # رسالة واحدة للجديد فقط


def test_pending_resend_is_throttled_to_once_per_ten_minutes(api_client):
    api_client.post(SUBSCRIBE, {"email": "p@example.com", **HUMAN}, format="json")
    api_client.post(SUBSCRIBE, {"email": "p@example.com", **HUMAN}, format="json")
    assert len(mail.outbox) == 1

    Subscriber.objects.update(confirm_sent_at=timezone.now() - timedelta(minutes=11))
    api_client.post(SUBSCRIBE, {"email": "p@example.com", **HUMAN}, format="json")
    assert len(mail.outbox) == 2


def test_unsubscribed_email_is_reactivated_with_new_confirmation(api_client):
    s = _active("back@example.com")
    s.unsubscribe()

    api_client.post(SUBSCRIBE, {"email": "back@example.com", **HUMAN}, format="json")
    s.refresh_from_db()
    assert s.status == Subscriber.Status.PENDING
    assert len(mail.outbox) == 1


def test_honeypot_and_fast_submit_are_silently_dropped(api_client):
    r = api_client.post(SUBSCRIBE, {"email": "bot@example.com", "website": "x", **HUMAN},
                        format="json")
    assert r.status_code == 202
    r2 = api_client.post(SUBSCRIBE, {"email": "fast@example.com", "elapsed_seconds": 0.5},
                         format="json")
    assert r2.status_code == 202
    assert Subscriber.objects.count() == 0
    assert mail.outbox == []


def test_stale_pending_are_purged():
    api_stale = Subscriber.objects.create(email="stale@example.com")
    Subscriber.objects.filter(pk=api_stale.pk).update(
        created_at=timezone.now() - timedelta(days=8)
    )
    Subscriber.objects.create(email="recent@example.com")
    assert services.purge_stale_pending() == 1
    assert Subscriber.objects.filter(email="recent@example.com").exists()


# --------------------------------------------------------------- الإلغاء والتفضيلات


def test_one_click_unsubscribe_without_login(api_client):
    s = _active("u@example.com")
    r = api_client.post(UNSUBSCRIBE, {"token": s.unsubscribe_token}, format="json")
    assert r.status_code == 200
    s.refresh_from_db()
    assert s.status == Subscriber.Status.UNSUBSCRIBED
    assert s.unsubscribed_at

    bad = api_client.post(UNSUBSCRIBE, {"token": "nope"}, format="json")
    assert bad.status_code == 404


def test_preferences_via_signed_link(api_client):
    s = _active("pref@example.com", interests=("articles",))
    url = PREFS.format(s.unsubscribe_token)

    r = api_client.get(url)
    assert r.status_code == 200
    assert r.data["interests"] == ["articles"]

    r = api_client.patch(url, {"interests": ["offers", "new_projects"], "language": "en",
                               "name": "سارة"}, format="json")
    assert r.status_code == 200
    s.refresh_from_db()
    assert s.language == "en"
    assert s.name == "سارة"
    assert sorted(i.key for i in s.interests.all()) == ["new_projects", "offers"]

    assert api_client.get(PREFS.format("wrong")).status_code == 404


def test_member_subscription_endpoint(logged_in_client, member):
    url = "/api/v1/subscribers/me/"
    r = logged_in_client.get(url)
    assert r.status_code == 200
    assert r.data["status"] == "none"

    r = logged_in_client.post(url, {"interests": ["articles"]}, format="json")
    assert r.status_code == 200
    s = Subscriber.objects.get(email=member.email)
    assert s.user_id == member.id
    assert s.status == Subscriber.Status.PENDING  # يؤكّد من بريده
    assert len(mail.outbox) == 1

    r = logged_in_client.delete(url)
    assert r.status_code == 204


def test_verified_member_opt_in_activates_without_second_confirmation(make_user):
    user = make_user(email="opt@example.com", verified=True)
    profile = user.member_profile
    profile.newsletter_opt_in = True
    profile.save()

    s = Subscriber.objects.get(email="opt@example.com")
    assert s.status == Subscriber.Status.ACTIVE
    assert s.source == Subscriber.Source.MEMBER_SIGNUP
    assert s.user_id == user.id

    profile.newsletter_opt_in = False
    profile.save()
    s.refresh_from_db()
    assert s.status == Subscriber.Status.UNSUBSCRIBED


def test_unverified_member_opt_in_waits_for_email_verification(make_user):
    user = make_user(email="wait@example.com", verified=False)
    profile = user.member_profile
    profile.newsletter_opt_in = True
    profile.save()
    assert not Subscriber.objects.filter(email="wait@example.com").exists()

    user.is_email_verified = True
    user.save(update_fields=["is_email_verified"])
    assert Subscriber.objects.get(email="wait@example.com").status == Subscriber.Status.ACTIVE


# --------------------------------------------------------------- الإدارة


def test_admin_list_hides_from_non_marketing_roles(api_client, make_user):
    cm = make_user(email="cm@example.com", role="content_manager")
    api_client.post("/api/v1/auth/login/", {"email": cm.email, "password": cm.raw_password},
                    format="json")
    assert api_client.get("/api/v1/subscribers/").status_code == 403
    assert api_client.get(CAMPAIGNS).status_code == 403


def test_admin_list_filters_and_export(marketing_client):
    _active("ar@example.com", "ar", ("articles",))
    _active("en@example.com", "en", ("offers",))
    Subscriber.objects.create(email="pending@example.com")

    r = marketing_client.get("/api/v1/subscribers/", {"status": "active"})
    assert r.data["count"] == 2
    r = marketing_client.get("/api/v1/subscribers/", {"interest": "offers"})
    assert r.data["count"] == 1
    assert r.data["results"][0]["email"] == "en@example.com"

    stats = marketing_client.get("/api/v1/subscribers/stats/")
    assert stats.data["active"] == 2 and stats.data["pending"] == 1

    export = marketing_client.get("/api/v1/subscribers/export/", {"status": "active"})
    assert export.status_code == 200
    body = export.content.decode("utf-8-sig")
    assert "ar@example.com" in body and "pending@example.com" not in body


def test_manual_subscriber_is_active_immediately(marketing_client):
    r = marketing_client.post("/api/v1/subscribers/",
                              {"email": "manual@example.com", "interests": ["offers"]},
                              format="json")
    assert r.status_code == 201, r.data
    s = Subscriber.objects.get(email="manual@example.com")
    assert s.status == Subscriber.Status.ACTIVE
    assert s.source == Subscriber.Source.MANUAL
    assert mail.outbox == []


# --------------------------------------------------------------- الحملات


@pytest.fixture
def audience():
    return [
        _active("a1@example.com", "ar", ("articles",)),
        _active("a2@example.com", "ar", ("offers",)),
        _active("e1@example.com", "en", ("articles",)),
    ]


def _campaign(**extra):
    defaults = {
        "name": "حملة", "subject_ar": "موضوع", "subject_en": "Subject",
        "content_ar": "فقرة أولى\n\nفقرة <b>ثانية</b>", "content_en": "Para one",
        "cta_label_ar": "اقرأ", "cta_url": "https://example.com/post",
    }
    return Campaign.objects.create(**{**defaults, **extra})


def test_audience_preview_respects_language_and_interests(marketing_client, audience):
    c = _campaign(target_language="ar")
    r = marketing_client.post(f"{CAMPAIGNS}{c.id}/preview-audience/")
    assert r.data == {"total": 2, "ar": 2, "en": 0}

    c.target_interests.add(Interest.objects.get(key="articles"))
    c.target_language = "all"
    c.save()
    r = marketing_client.post(f"{CAMPAIGNS}{c.id}/preview-audience/")
    assert r.data["total"] == 2  # a1 + e1

    Subscriber.objects.filter(email="a1@example.com").update(status="unsubscribed")
    r = marketing_client.post(f"{CAMPAIGNS}{c.id}/preview-audience/")
    assert r.data["total"] == 1


def test_send_requires_send_campaign_permission(api_client, make_user, audience):
    # مستخدم لوحة لديه view_campaign فقط
    viewer = make_user(email="viewer@example.com", role="crm_manager", is_superuser=False)
    from django.contrib.auth.models import Permission

    viewer.user_permissions.add(
        Permission.objects.get(codename="view_campaign"),
    )
    api_client.post("/api/v1/auth/login/",
                    {"email": viewer.email, "password": viewer.raw_password}, format="json")
    c = _campaign()
    assert api_client.get(f"{CAMPAIGNS}{c.id}/").status_code == 200
    assert api_client.post(f"{CAMPAIGNS}{c.id}/send/").status_code == 403


def test_send_creates_recipients_and_delivers_with_unique_unsubscribe_links(
    marketing_client, audience
):
    c = _campaign()
    r = marketing_client.post(f"{CAMPAIGNS}{c.id}/send/")
    assert r.status_code == 200, r.data

    c.refresh_from_db()
    assert c.status == Campaign.Status.SENT  # المهام متزامنة في الاختبار
    assert c.total_recipients == 3
    assert c.sent_count == 3 and c.failed_count == 0
    assert CampaignRecipient.objects.filter(campaign=c, status="sent").count() == 3
    assert len(mail.outbox) == 3

    bodies = [m.alternatives[0][0] for m in mail.outbox]
    tokens = {s.unsubscribe_token for s in audience}
    assert all(any(t in body for t in tokens) for body in bodies)
    # كل رسالة تحمل رابط الإلغاء الخاص بصاحبها لا رابطًا مشتركًا
    assert len({b.split("newsletter/unsubscribe/")[1].split("?")[0] for b in bodies}) == 3

    en = next(m for m in mail.outbox if m.to == ["e1@example.com"])
    assert en.subject == "Subject"
    assert "/en/newsletter/unsubscribe/" in en.alternatives[0][0]

    ar = next(m for m in mail.outbox if m.to == ["a1@example.com"])
    html = ar.alternatives[0][0]
    assert "&lt;b&gt;ثانية&lt;/b&gt;" in html  # المحتوى نص عادي مُهرَّب
    assert "track/open/" in html and "track/click/" in html

    # لا يمكن تعديل حملة أُرسلت
    r = marketing_client.patch(f"{CAMPAIGNS}{c.id}/", {"name": "x"}, format="json")
    assert r.status_code == 400


def test_send_is_resumable_without_duplicates(audience):
    c = _campaign()
    services.start_campaign(c)  # يُنشئ المستلمين ويرسل (متزامن) …
    c.refresh_from_db()
    assert c.sent_count == 3

    # نحاكي انقطاعًا: واحد بقي معلّقًا والحالة عادت «قيد الإرسال»
    pending = CampaignRecipient.objects.filter(campaign=c).first()
    CampaignRecipient.objects.filter(pk=pending.pk).update(status="pending", sent_at=None)
    Campaign.objects.filter(pk=c.pk).update(status="sending", sent_count=2)
    mail.outbox.clear()

    assert send_campaign(c.pk) == 1
    assert len(mail.outbox) == 1
    assert mail.outbox[0].to == [pending.subscriber.email]
    c.refresh_from_db()
    assert c.status == Campaign.Status.SENT and c.sent_count == 3

    # إعادة بدء الحملة لا تضاعف المستلمين
    assert CampaignRecipient.objects.filter(campaign=c).count() == 3


def test_failed_delivery_is_recorded_and_notified(audience):
    c = _campaign()
    with patch("apps.newsletter.tasks._deliver", return_value=False):
        services.start_campaign(c)
    c.refresh_from_db()
    assert c.status == Campaign.Status.FAILED
    assert c.failed_count == 3
    assert Notification.objects.filter(type="email_failed").exists()


def test_schedule_then_periodic_task_sends(marketing_client, audience):
    c = _campaign()
    past = (timezone.now() - timedelta(minutes=1)).isoformat()
    r = marketing_client.post(f"{CAMPAIGNS}{c.id}/schedule/", {"scheduled_at": past},
                              format="json")
    assert r.status_code == 400

    future = (timezone.now() + timedelta(hours=1)).isoformat()
    r = marketing_client.post(f"{CAMPAIGNS}{c.id}/schedule/", {"scheduled_at": future},
                              format="json")
    assert r.status_code == 200 and r.data["status"] == "scheduled"

    from apps.newsletter.tasks import process_scheduled_campaigns

    assert process_scheduled_campaigns() == 0  # لم يحن الموعد
    Campaign.objects.filter(pk=c.pk).update(scheduled_at=timezone.now() - timedelta(minutes=1))
    assert process_scheduled_campaigns() == 1
    c.refresh_from_db()
    assert c.status == Campaign.Status.SENT
    assert len(mail.outbox) == 3


def test_cancel_scheduled_campaign(marketing_client, audience):
    c = _campaign(status="scheduled", scheduled_at=timezone.now() + timedelta(days=1))
    r = marketing_client.post(f"{CAMPAIGNS}{c.id}/cancel/")
    assert r.status_code == 200 and r.data["status"] == "cancelled"
    sent = _campaign(status="sent")
    assert marketing_client.post(f"{CAMPAIGNS}{sent.id}/cancel/").status_code == 400


def test_test_send_goes_to_requester_and_is_not_counted(marketing_client, marketing, audience):
    c = _campaign()
    r = marketing_client.post(f"{CAMPAIGNS}{c.id}/test-send/", {"language": "en"}, format="json")
    assert r.status_code == 200
    assert mail.outbox[0].to == [marketing.email]
    assert mail.outbox[0].subject.startswith("[اختبار]")
    c.refresh_from_db()
    assert c.status == Campaign.Status.DRAFT and c.sent_count == 0
    assert CampaignRecipient.objects.count() == 0


def test_open_and_click_tracking_and_stats(api_client, marketing_client, audience):
    c = _campaign()
    services.start_campaign(c)
    recipient = CampaignRecipient.objects.filter(campaign=c).first()

    pixel = api_client.get(f"/api/v1/newsletter/track/open/{recipient.token}/")
    assert pixel.status_code == 200 and pixel["Content-Type"] == "image/gif"
    api_client.get(f"/api/v1/newsletter/track/open/{recipient.token}/")  # مرة ثانية لا تُعدّ

    click = api_client.get(f"/api/v1/newsletter/track/click/{recipient.token}/")
    assert click.status_code == 302 and click["Location"] == "https://example.com/post"
    # رمز مجهول لا يحوّل إلى أي وجهة خارجية
    unknown = api_client.get("/api/v1/newsletter/track/click/none/")
    assert unknown["Location"] == "/"

    api_client.post(UNSUBSCRIBE, {"token": recipient.subscriber.unsubscribe_token,
                                  "campaign_token": recipient.token}, format="json")

    stats = marketing_client.get(f"{CAMPAIGNS}{c.id}/stats/")
    assert stats.data["opened"] == 1 and stats.data["clicked"] == 1
    assert stats.data["unsubscribed"] == 1
    assert stats.data["sent"] == 3

    recipients = marketing_client.get(f"{CAMPAIGNS}{c.id}/recipients/", {"status": "sent"})
    assert recipients.data["count"] == 3


def test_draft_from_published_post(marketing_client):
    from apps.blog.models import Post

    post = Post.objects.create(
        title_ar="مقال عن التحليل", excerpt_ar="ملخص المقال",
        content_ar=" ".join(["كلمة"] * 120), status=Post.Status.PUBLISHED,
    )
    r = marketing_client.post(f"{CAMPAIGNS}from-content/", {"kind": "post", "id": post.id},
                              format="json")
    assert r.status_code == 201, r.data
    c = Campaign.objects.get(pk=r.data["id"])
    assert c.subject_ar == "مقال جديد: مقال عن التحليل"
    assert c.content_ar == "ملخص المقال"
    assert c.cta_url.endswith(f"/blog/{post.slug}")
    assert [i.key for i in c.target_interests.all()] == ["articles"]
    assert c.status == Campaign.Status.DRAFT

    missing = marketing_client.post(f"{CAMPAIGNS}from-content/", {"kind": "post", "id": 999},
                                    format="json")
    assert missing.status_code == 404


def test_custom_template_must_keep_unsubscribe_link(marketing_client):
    r = marketing_client.post("/api/v1/email-templates/",
                              {"name": "بسيط", "key": "simple", "html_ar": "<p>{{ content }}</p>"},
                              format="json")
    assert r.status_code == 400
    assert "html_ar" in r.data["errors"]

    r = marketing_client.post(
        "/api/v1/email-templates/",
        {"name": "بسيط", "key": "simple",
         "html_ar": "<div>{{ content }}<a href='{{ unsubscribe_url }}'>إلغاء</a></div>"},
        format="json",
    )
    assert r.status_code == 201


def test_sending_skips_subscriber_who_unsubscribed_after_queueing(audience):
    c = _campaign()
    with patch("apps.newsletter.services._enqueue"):
        services.start_campaign(c)  # يُنشئ المستلمين دون إرسال
    audience[0].unsubscribe()
    send_campaign(c.pk)
    assert len(mail.outbox) == 2
    assert not any(m.to == [audience[0].email] for m in mail.outbox)
