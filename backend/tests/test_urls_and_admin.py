"""يثبّت سلوك المسارات الجذرية ولوحة الإدارة.

يمنع تكرار الالتباس السابق: كان جذر منفذ Django يعيد التوجيه إلى منفذ
الواجهة، فبدا أن Django يعمل على 3000، ولم تكن لوحة الإدارة على المسار
المتوقع `/admin/`.
"""

import pytest
from django.urls import reverse

pytestmark = pytest.mark.django_db


def test_api_root_serves_info_page_not_a_redirect(client):
    """جذر منفذ الـ API يعرض صفحة تعريف — لا إعادة توجيه إلى منفذ آخر."""
    response = client.get("/")
    assert response.status_code == 200
    body = response.content.decode("utf-8")
    assert "/admin/" in body
    # لا يحوّل إلى منفذ الواجهة
    assert "Location" not in response.headers


def test_admin_is_at_the_conventional_path(client):
    """لوحة الإدارة على `/admin/` كما يتوقع المستخدم."""
    response = client.get("/admin/")
    # تحويل إلى صفحة الدخول — سلوك Django القياسي
    assert response.status_code == 302
    assert "/admin/login/" in response.headers["Location"]


def test_admin_login_page_loads(client):
    response = client.get("/admin/login/")
    assert response.status_code == 200


def test_health_endpoint_lives_under_api(client):
    response = client.get("/api/v1/health/")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_public_read_sends_cache_control(client):
    """استجابة القراءة العامة تحمل ترويسة تخزين للزائر غير المسجّل."""
    from django.core.management import call_command

    call_command("seed_groups", verbosity=0)
    call_command("seed_content", verbosity=0)

    response = client.get("/api/v1/services/", HTTP_ACCEPT_LANGUAGE="ar")
    assert response.status_code == 200
    assert "public" in response.headers.get("Cache-Control", "")


def test_authenticated_read_is_not_cached(api_client, make_user):
    """استجابة المستخدم المسجّل لا تُخزَّن — قد تحمل مسودات أو حقولًا إدارية.

    تُستخدم مصادقة JWT الفعلية (لا جلسة Django)، لأن DRF يقرأ الرمز من
    الكوكي لا من جلسة force_login.
    """
    from django.core.management import call_command

    call_command("seed_groups", verbosity=0)
    call_command("seed_content", verbosity=0)

    admin = make_user(
        email="admin@example.com", role="super_admin", is_superuser=True
    )
    login = api_client.post(
        "/api/v1/auth/login/",
        {"email": admin.email, "password": admin.raw_password},
        format="json",
    )
    assert login.status_code == 200

    response = api_client.get("/api/v1/services/?full=true", HTTP_ACCEPT_LANGUAGE="ar")
    assert response.status_code == 200
    assert "public" not in response.headers.get("Cache-Control", "")
