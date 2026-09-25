"""إشعارات المتصفح (Web Push) لفريق اللوحة."""

import json

import pytest
import pywebpush
from django.core.management import call_command

from apps.notifications.models import PushKeys, PushSubscription

pytestmark = pytest.mark.django_db

KEY_URL = "/api/v1/notifications/push/key/"
SUBSCRIBE_URL = "/api/v1/notifications/push/subscribe/"
UNSUBSCRIBE_URL = "/api/v1/notifications/push/unsubscribe/"
TEST_URL = "/api/v1/notifications/push/test/"
SUBSCRIPTION = {
    "endpoint": "https://fcm.googleapis.com/fcm/send/abc123",
    "keys": {"p256dh": "BPk3", "auth": "auth-secret"},
}
REQUEST = {
    "project_type": "system",
    "description": "نظام إدارة صيدلية مع مخزون",
    "name": "أحمد",
    "email": "client@example.com",
    "preferred_language": "ar",
}


@pytest.fixture
def sent(monkeypatch):
    """يلتقط الإرسال بدل الاتصال بخدمة إشعارات حقيقية."""
    calls = []

    def fake_webpush(subscription_info, data, **kwargs):
        calls.append({"endpoint": subscription_info["endpoint"], **json.loads(data)})

    monkeypatch.setattr(pywebpush, "webpush", fake_webpush)
    return calls


@pytest.fixture
def team(db, make_user):
    call_command("seed_groups", verbosity=0)
    return {
        "crm": make_user(email="crm@example.com", role="crm_manager"),
        "content": make_user(email="content@example.com", role="content_manager"),
    }


def _login(client, user):
    response = client.post(
        "/api/v1/auth/login/",
        {"email": user.email, "password": user.raw_password},
        format="json",
    )
    assert response.status_code == 200, response.data
    return client


def test_public_key_is_generated_once(api_client, team):
    _login(api_client, team["crm"])
    first = api_client.get(KEY_URL).data["public_key"]
    second = api_client.get(KEY_URL).data["public_key"]

    assert first == second
    assert len(first) == 87  # نقطة P-256 غير مضغوطة (65 بايت) بترميز base64url
    assert PushKeys.objects.count() == 1


def test_members_and_visitors_cannot_subscribe(api_client, member):
    assert api_client.post(SUBSCRIBE_URL, SUBSCRIPTION, format="json").status_code == 401
    _login(api_client, member)
    assert api_client.post(SUBSCRIBE_URL, SUBSCRIPTION, format="json").status_code == 403


def test_subscribe_is_idempotent_and_unsubscribe_removes(api_client, team):
    _login(api_client, team["crm"])
    for _ in range(2):
        assert api_client.post(SUBSCRIBE_URL, SUBSCRIPTION, format="json").status_code == 201
    assert PushSubscription.objects.count() == 1

    api_client.post(UNSUBSCRIBE_URL, {"endpoint": SUBSCRIPTION["endpoint"]}, format="json")
    assert not PushSubscription.objects.exists()


def test_non_https_endpoint_is_rejected(api_client, team):
    _login(api_client, team["crm"])
    response = api_client.post(
        SUBSCRIBE_URL, {**SUBSCRIPTION, "endpoint": "http://evil.example/x"}, format="json"
    )
    assert response.status_code == 400


def test_new_request_is_pushed_to_the_crm_team_only(
    api_client, team, sent, django_capture_on_commit_callbacks
):
    PushSubscription.objects.create(user=team["crm"], endpoint="https://push.example/crm",
                                    p256dh="k", auth="a")
    PushSubscription.objects.create(user=team["content"], endpoint="https://push.example/content",
                                    p256dh="k", auth="a")

    with django_capture_on_commit_callbacks(execute=True):
        response = api_client.post("/api/v1/project-requests/submit/", REQUEST, format="json")
    assert response.status_code == 201

    assert [call["endpoint"] for call in sent] == ["https://push.example/crm"]
    assert response.data["reference_code"] in sent[0]["title"]
    assert sent[0]["url"].startswith("/dashboard/crm/requests/")


def test_contact_message_is_pushed_too(
    api_client, team, sent, django_capture_on_commit_callbacks
):
    PushSubscription.objects.create(user=team["crm"], endpoint="https://push.example/crm",
                                    p256dh="k", auth="a")
    with django_capture_on_commit_callbacks(execute=True):
        api_client.post(
            "/api/v1/contact-messages/submit/",
            {"name": "زائر", "email": "v@example.com", "message": "استفسار"},
            format="json",
        )
    assert sent and sent[0]["url"].startswith("/dashboard/crm/messages/")


def test_expired_subscription_is_removed(
    api_client, team, monkeypatch, django_capture_on_commit_callbacks
):
    PushSubscription.objects.create(user=team["crm"], endpoint="https://push.example/gone",
                                    p256dh="k", auth="a")

    class Gone:
        status_code = 410

    def fake_webpush(**kwargs):
        raise pywebpush.WebPushException("gone", response=Gone())

    monkeypatch.setattr(pywebpush, "webpush", fake_webpush)
    with django_capture_on_commit_callbacks(execute=True):
        api_client.post("/api/v1/project-requests/submit/", REQUEST, format="json")

    assert not PushSubscription.objects.exists()


def test_push_failure_never_breaks_the_request_form(
    api_client, team, monkeypatch, django_capture_on_commit_callbacks
):
    PushSubscription.objects.create(user=team["crm"], endpoint="https://push.example/x",
                                    p256dh="k", auth="a")

    def boom(**kwargs):
        raise RuntimeError("network down")

    monkeypatch.setattr(pywebpush, "webpush", boom)
    with django_capture_on_commit_callbacks(execute=True):
        response = api_client.post("/api/v1/project-requests/submit/", REQUEST, format="json")
    assert response.status_code == 201


def test_test_push_goes_to_my_devices(api_client, team, sent):
    PushSubscription.objects.create(user=team["crm"], endpoint="https://push.example/mine",
                                    p256dh="k", auth="a")
    _login(api_client, team["crm"])
    assert api_client.post(TEST_URL).data == {"sent": 1}
    assert sent[0]["tag"] == "push-test"


def test_site_admin_receives_new_request_push(
    api_client, make_user, sent, django_capture_on_commit_callbacks
):
    admin = make_user(email="owner@example.com", role="super_admin", is_superuser=True)
    PushSubscription.objects.create(user=admin, endpoint="https://push.example/owner-phone",
                                    p256dh="k", auth="a")
    PushSubscription.objects.create(user=admin, endpoint="https://push.example/owner-laptop",
                                    p256dh="k", auth="a")

    with django_capture_on_commit_callbacks(execute=True):
        api_client.post("/api/v1/project-requests/submit/", REQUEST, format="json")

    # كل أجهزة المدير — الهاتف والحاسوب
    assert sorted(call["endpoint"] for call in sent) == [
        "https://push.example/owner-laptop",
        "https://push.example/owner-phone",
    ]
