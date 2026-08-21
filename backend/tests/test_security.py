"""اختبارات الحماية: CSRF، وسرّية الكوكيز، وسجل التدقيق."""

import pytest
from django.conf import settings

from apps.core.models.system import AuditLog

pytestmark = pytest.mark.django_db

LOGIN_URL = "/api/v1/auth/login/"
LOGOUT_ALL_URL = "/api/v1/auth/logout-all/"
ME_URL = "/api/v1/auth/me/"


def _login_with_cookies(client, member):
    response = client.post(
        LOGIN_URL, {"email": member.email, "password": member.raw_password}, format="json"
    )
    assert response.status_code == 200, response.data
    return response


def test_cookie_auth_rejects_unsafe_request_without_csrf_header(csrf_client, member):
    _login_with_cookies(csrf_client, member)

    response = csrf_client.post(LOGOUT_ALL_URL, {}, format="json")

    assert response.status_code == 403
    assert "CSRF" in response.data["detail"]


def test_cookie_auth_accepts_unsafe_request_with_csrf_header(csrf_client, member):
    _login_with_cookies(csrf_client, member)
    csrf_token = csrf_client.cookies["csrftoken"].value

    response = csrf_client.post(
        LOGOUT_ALL_URL, {}, format="json", HTTP_X_CSRFTOKEN=csrf_token
    )

    assert response.status_code == 200


def test_cookie_refresh_requires_csrf_header(csrf_client, member):
    """التجديد بالكوكي محمي أيضًا — الكوكي يُرسل تلقائيًا من أي موقع."""
    _login_with_cookies(csrf_client, member)

    without_header = csrf_client.post("/api/v1/auth/refresh/", {}, format="json")
    assert without_header.status_code == 403

    csrf_token = csrf_client.cookies["csrftoken"].value
    with_header = csrf_client.post(
        "/api/v1/auth/refresh/", {}, format="json", HTTP_X_CSRFTOKEN=csrf_token
    )
    assert with_header.status_code == 200


def test_mobile_refresh_does_not_require_csrf(api_client, member):
    login = api_client.post(
        LOGIN_URL,
        {"email": member.email, "password": member.raw_password},
        format="json",
        HTTP_X_CLIENT="mobile",
    )
    refresh = login.data["tokens"]["refresh"]

    response = api_client.post(
        "/api/v1/auth/refresh/", {"refresh": refresh}, format="json", HTTP_X_CLIENT="mobile"
    )
    assert response.status_code == 200


def test_safe_requests_do_not_require_csrf_header(csrf_client, member):
    _login_with_cookies(csrf_client, member)

    assert csrf_client.get(ME_URL).status_code == 200


def test_bearer_requests_are_exempt_from_csrf(csrf_client, api_client, member):
    login = api_client.post(
        LOGIN_URL,
        {"email": member.email, "password": member.raw_password},
        format="json",
        HTTP_X_CLIENT="mobile",
    )
    access = login.data["tokens"]["access"]

    response = csrf_client.post(
        LOGOUT_ALL_URL, {}, format="json", HTTP_AUTHORIZATION=f"Bearer {access}"
    )

    assert response.status_code == 200


def test_csrf_cookie_is_readable_by_the_frontend(api_client, member):
    response = _login_with_cookies(api_client, member)

    csrf_cookie = response.cookies["csrftoken"]
    assert csrf_cookie["httponly"] == "", "الواجهة تحتاج قراءة كوكي CSRF لإرساله في الترويسة"


def test_auth_cookies_are_never_readable_by_javascript(api_client, member):
    response = _login_with_cookies(api_client, member)

    assert response.cookies[settings.AUTH_COOKIE_ACCESS]["httponly"] is True
    assert response.cookies[settings.AUTH_COOKIE_REFRESH]["httponly"] is True


def test_successful_login_is_recorded_in_the_audit_log(api_client, member):
    _login_with_cookies(api_client, member)

    entry = AuditLog.objects.filter(action=AuditLog.Action.LOGIN).first()
    assert entry is not None
    assert entry.user == member
    assert entry.ip_address is not None


def test_failed_login_is_recorded_without_a_user(api_client, member):
    api_client.post(
        LOGIN_URL, {"email": member.email, "password": "WrongPass!2026"}, format="json"
    )

    entry = AuditLog.objects.filter(action=AuditLog.Action.LOGIN_FAILED).first()
    assert entry is not None
    assert entry.user is None
    assert entry.object_repr == member.email


def test_error_responses_share_one_shape(api_client):
    response = api_client.get(ME_URL)

    assert response.status_code == 401
    assert set(response.data.keys()) == {"detail", "code", "errors"}
