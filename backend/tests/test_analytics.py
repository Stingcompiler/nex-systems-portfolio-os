"""اختبارات التحليلات: الخصوصية، البصمة المجهولة، البيكون، الصلاحيات."""

from datetime import date

import pytest
from django.core.management import call_command

from apps.analytics.models import PageView
from apps.analytics.utils import (
    anonymous_session_hash,
    classify_path,
    device_from_user_agent,
    referrer_domain,
)

pytestmark = pytest.mark.django_db

BEACON = "/api/v1/analytics/view/"
OVERVIEW = "/api/v1/analytics/overview/"


@pytest.fixture
def seeded(db):
    call_command("seed_groups", verbosity=0)


def _login(client, user):
    r = client.post(
        "/api/v1/auth/login/",
        {"email": user.email, "password": user.raw_password},
        format="json",
    )
    assert r.status_code == 200
    return client


# --------------------------------------------------------------- الأدوات


@pytest.mark.parametrize(
    ("ua", "expected"),
    [
        ("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)", "mobile"),
        ("Mozilla/5.0 (iPad; CPU OS 17_0)", "tablet"),
        ("Mozilla/5.0 (Windows NT 10.0; Win64; x64)", "desktop"),
        ("Googlebot/2.1 (+http://www.google.com/bot.html)", "bot"),
        ("facebookexternalhit/1.1", "bot"),
    ],
)
def test_device_detection(ua, expected):
    assert device_from_user_agent(ua) == expected


def test_referrer_keeps_domain_only():
    assert referrer_domain("https://twitter.com/user/status/123") == "twitter.com"
    assert referrer_domain("https://www.google.com/search?q=x") == "google.com"


def test_own_site_referrer_is_treated_as_direct(settings):
    settings.FRONTEND_URL = "http://localhost:3000"
    assert referrer_domain("http://localhost:3000/ar/blog") == ""


def test_session_hash_is_anonymous_and_rotates_daily():
    from datetime import timedelta

    today = anonymous_session_hash("1.2.3.4", "UA", date(2026, 1, 1))
    same = anonymous_session_hash("1.2.3.4", "UA", date(2026, 1, 1))
    tomorrow = anonymous_session_hash("1.2.3.4", "UA", date(2026, 1, 2))

    assert today == same  # نفس اليوم نفس البصمة
    assert today != tomorrow  # يوم مختلف بصمة مختلفة — لا تتبّع عبر الأيام
    assert "1.2.3.4" not in today  # لا يحتوي IP الأصلي


@pytest.mark.parametrize(
    ("path", "expected"),
    [
        ("/ar/blog/my-post", ("blog", "my-post")),
        ("/en/projects/eust", ("projects", "eust")),
        ("/ar/services/web-development", ("services", "web-development")),
        ("/ar/about", ("", "")),
        ("/ar", ("", "")),
    ],
)
def test_path_classification(path, expected):
    assert classify_path(path) == expected


# --------------------------------------------------------------- البيكون


def test_beacon_records_a_view(api_client):
    response = api_client.post(
        BEACON,
        {"path": "/ar/blog/my-post", "locale": "ar", "referrer": "https://twitter.com/x"},
        format="json",
        HTTP_USER_AGENT="Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)",
    )
    assert response.status_code == 202

    view = PageView.objects.get()
    assert view.content_type == "blog"
    assert view.object_slug == "my-post"
    assert view.device_type == "mobile"
    assert view.referrer_domain == "twitter.com"
    assert view.session_hash  # بصمة موجودة


def test_beacon_never_stores_raw_ip(api_client):
    api_client.post(
        BEACON, {"path": "/ar/blog/x"}, format="json", REMOTE_ADDR="203.0.113.45"
    )
    view = PageView.objects.get()
    assert "203.0.113.45" not in view.session_hash
    # لا حقل IP أصلًا في النموذج
    assert not hasattr(view, "ip_address")


def test_beacon_ignores_bots(api_client):
    response = api_client.post(
        BEACON,
        {"path": "/ar/blog/x"},
        format="json",
        HTTP_USER_AGENT="Googlebot/2.1",
    )
    assert response.status_code == 202
    assert PageView.objects.count() == 0


def test_beacon_requires_no_auth(api_client):
    """البيكون عام — يعمل للزائر غير المسجّل."""
    response = api_client.post(BEACON, {"path": "/ar"}, format="json")
    assert response.status_code == 202


# --------------------------------------------------------------- اللوحة


def test_analytics_requires_permission(api_client, seeded, make_user):
    member = make_user(email="m@example.com", role="member")
    _login(api_client, member)
    assert api_client.get(OVERVIEW).status_code == 403


def test_marketing_manager_can_view_analytics(api_client, seeded, make_user):
    manager = make_user(email="mk@example.com", role="marketing_manager")
    _login(api_client, manager)
    assert api_client.get(OVERVIEW).status_code == 200


def test_overview_counts_views_and_unique_visitors(api_client, seeded, make_user):
    # زيارتان بنفس الجلسة + واحدة مختلفة
    PageView.objects.create(path="/ar", session_hash="aaa", device_type="desktop")
    PageView.objects.create(path="/ar/blog", session_hash="aaa", device_type="desktop")
    PageView.objects.create(path="/ar", session_hash="bbb", device_type="mobile")

    admin = make_user(email="a@example.com", role="super_admin", is_superuser=True)
    _login(api_client, admin)

    response = api_client.get(OVERVIEW)
    assert response.data["page_views"] == 3
    assert response.data["unique_visitors"] == 2


def test_devices_breakdown(api_client, seeded, make_user):
    PageView.objects.create(path="/", session_hash="a", device_type="mobile")
    PageView.objects.create(path="/", session_hash="b", device_type="mobile")
    PageView.objects.create(path="/", session_hash="c", device_type="desktop")

    admin = make_user(email="a@example.com", role="super_admin", is_superuser=True)
    _login(api_client, admin)

    response = api_client.get("/api/v1/analytics/devices/")
    devices = {row["device_type"]: row["views"] for row in response.data}
    assert devices["mobile"] == 2
    assert devices["desktop"] == 1


def test_daily_aggregation_task(api_client, seeded):
    from datetime import timedelta

    from django.utils import timezone

    from apps.analytics.models import DailyStat
    from apps.analytics.tasks import aggregate_daily_stats

    yesterday = timezone.now() - timedelta(days=1)
    for i in range(3):
        pv = PageView.objects.create(path="/", session_hash=f"s{i}", device_type="mobile")
        PageView.objects.filter(pk=pv.pk).update(created_at=yesterday)

    written = aggregate_daily_stats()
    assert written > 0
    assert DailyStat.objects.filter(metric="page_views").first().value == 3
