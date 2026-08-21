"""اختبارات دورة المصادقة الكاملة للويب والموبايل."""

import pytest
from django.conf import settings
from django.core import mail
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken

from apps.accounts.models import EmailVerificationToken, LoginAttempt, PasswordResetToken, User

pytestmark = pytest.mark.django_db

REGISTER_URL = "/api/v1/auth/register/"
LOGIN_URL = "/api/v1/auth/login/"
REFRESH_URL = "/api/v1/auth/refresh/"
LOGOUT_URL = "/api/v1/auth/logout/"
LOGOUT_ALL_URL = "/api/v1/auth/logout-all/"
ME_URL = "/api/v1/auth/me/"
VERIFY_URL = "/api/v1/auth/verify-email/"
FORGOT_URL = "/api/v1/auth/password/forgot/"
RESET_URL = "/api/v1/auth/password/reset/"
CHANGE_URL = "/api/v1/auth/password/change/"

MOBILE = {"HTTP_X_CLIENT": "mobile"}

VALID_REGISTRATION = {
    "full_name": "مصعب أحمد",
    "email": "new@example.com",
    "password": "StrongPass!2026",
    "password_confirm": "StrongPass!2026",
    "preferred_language": "ar",
}


# --------------------------------------------------------------- التسجيل


def test_register_creates_user_profile_and_verification_email(api_client):
    response = api_client.post(REGISTER_URL, VALID_REGISTRATION, format="json")

    assert response.status_code == 201, response.data
    user = User.objects.get(email="new@example.com")
    assert user.is_email_verified is False
    assert user.role == "member"
    assert hasattr(user, "member_profile")
    assert EmailVerificationToken.objects.filter(user=user).count() == 1
    assert len(mail.outbox) == 1
    assert "new@example.com" in mail.outbox[0].to


def test_register_normalizes_email_and_rejects_duplicates(api_client, make_user):
    make_user(email="taken@example.com")

    payload = {**VALID_REGISTRATION, "email": "TAKEN@Example.com"}
    response = api_client.post(REGISTER_URL, payload, format="json")

    assert response.status_code == 400
    assert response.data["code"] == "validation_error"
    assert "email" in response.data["errors"]


def test_register_rejects_mismatched_passwords(api_client):
    payload = {**VALID_REGISTRATION, "password_confirm": "Different!2026"}
    response = api_client.post(REGISTER_URL, payload, format="json")

    assert response.status_code == 400
    assert "password_confirm" in response.data["errors"]


def test_register_rejects_weak_password(api_client):
    payload = {**VALID_REGISTRATION, "password": "12345678", "password_confirm": "12345678"}
    response = api_client.post(REGISTER_URL, payload, format="json")

    assert response.status_code == 400
    assert "password" in response.data["errors"]


# --------------------------------------------------------------- تسجيل الدخول


def test_login_sets_httponly_cookies_and_hides_tokens(api_client, member):
    response = api_client.post(
        LOGIN_URL, {"email": member.email, "password": member.raw_password}, format="json"
    )

    assert response.status_code == 200
    assert "tokens" not in response.data, "الويب يجب ألا يستقبل الرموز في جسم الاستجابة"

    access = response.cookies[settings.AUTH_COOKIE_ACCESS]
    refresh = response.cookies[settings.AUTH_COOKIE_REFRESH]

    assert access["httponly"] is True
    assert refresh["httponly"] is True
    assert refresh["path"] == settings.AUTH_COOKIE_REFRESH_PATH
    assert access["samesite"] == settings.AUTH_COOKIE_SAMESITE
    assert "csrftoken" in response.cookies


def test_login_mobile_returns_tokens_in_body_without_cookies(api_client, member):
    response = api_client.post(
        LOGIN_URL,
        {"email": member.email, "password": member.raw_password},
        format="json",
        **MOBILE,
    )

    assert response.status_code == 200
    assert response.data["tokens"]["access"]
    assert response.data["tokens"]["refresh"]
    assert settings.AUTH_COOKIE_ACCESS not in response.cookies


def test_login_with_wrong_password_gives_generic_error(api_client, member):
    response = api_client.post(
        LOGIN_URL, {"email": member.email, "password": "WrongPass!2026"}, format="json"
    )

    assert response.status_code == 401
    assert response.data["detail"] == "البريد الإلكتروني أو كلمة المرور غير صحيحة"
    assert LoginAttempt.objects.filter(email=member.email, success=False).count() == 1


def test_login_unknown_email_gives_same_generic_error(api_client):
    response = api_client.post(
        LOGIN_URL, {"email": "ghost@example.com", "password": "WrongPass!2026"}, format="json"
    )

    assert response.status_code == 401
    assert response.data["detail"] == "البريد الإلكتروني أو كلمة المرور غير صحيحة"


def test_login_is_locked_after_repeated_failures(api_client, member):
    for _ in range(10):
        LoginAttempt.record(member.email, "127.0.0.1", success=False)

    response = api_client.post(
        LOGIN_URL, {"email": member.email, "password": member.raw_password}, format="json"
    )

    assert response.status_code == 429
    assert "قفل" in response.data["detail"]


def test_login_throttle_blocks_burst(api_client, member):
    payload = {"email": member.email, "password": "WrongPass!2026"}
    statuses = [
        api_client.post(LOGIN_URL, payload, format="json").status_code for _ in range(7)
    ]

    assert statuses[:5] == [401] * 5
    assert 429 in statuses[5:]


# --------------------------------------------------------------- الجلسة الحالية


def test_me_requires_authentication(api_client):
    assert api_client.get(ME_URL).status_code == 401


def test_me_returns_profile_and_permissions(logged_in_client, member):
    response = logged_in_client.get(ME_URL)

    assert response.status_code == 200
    assert response.data["email"] == member.email
    assert response.data["profile"] is not None
    assert response.data["permissions"] == []
    assert response.data["is_dashboard_user"] is False


def test_me_accepts_bearer_token_for_mobile(api_client, member):
    login = api_client.post(
        LOGIN_URL,
        {"email": member.email, "password": member.raw_password},
        format="json",
        **MOBILE,
    )
    access = login.data["tokens"]["access"]

    fresh = type(api_client)()
    response = fresh.get(ME_URL, HTTP_AUTHORIZATION=f"Bearer {access}")

    assert response.status_code == 200
    assert response.data["email"] == member.email


def test_me_patch_updates_user_and_profile(logged_in_client):
    response = logged_in_client.patch(
        ME_URL,
        {
            "full_name": "الاسم الجديد",
            "profile": {"city": "الخرطوم", "newsletter_opt_in": True},
        },
        format="json",
    )

    assert response.status_code == 200
    assert response.data["full_name"] == "الاسم الجديد"
    assert response.data["profile"]["city"] == "الخرطوم"
    assert response.data["profile"]["newsletter_opt_in"] is True


# --------------------------------------------------------------- التجديد والتدوير


def test_refresh_rotates_token_and_blacklists_the_old_one(api_client, member):
    login = api_client.post(
        LOGIN_URL,
        {"email": member.email, "password": member.raw_password},
        format="json",
        **MOBILE,
    )
    original_refresh = login.data["tokens"]["refresh"]

    first = api_client.post(REFRESH_URL, {"refresh": original_refresh}, format="json", **MOBILE)
    assert first.status_code == 200
    assert first.data["access"]
    assert first.data["refresh"] != original_refresh

    replay = api_client.post(REFRESH_URL, {"refresh": original_refresh}, format="json", **MOBILE)
    assert replay.status_code == 401, "إعادة استخدام رمز مُدوَّر يجب أن تُرفض"
    assert BlacklistedToken.objects.count() >= 1


def test_refresh_via_cookie_sets_new_cookies(logged_in_client):
    response = logged_in_client.post(REFRESH_URL, {}, format="json")

    assert response.status_code == 200
    assert settings.AUTH_COOKIE_ACCESS in response.cookies
    assert settings.AUTH_COOKIE_REFRESH in response.cookies


def test_refresh_without_token_returns_401(api_client):
    response = api_client.post(REFRESH_URL, {}, format="json")
    assert response.status_code == 401


# --------------------------------------------------------------- الخروج


def test_logout_clears_cookies_and_blacklists_refresh(logged_in_client):
    response = logged_in_client.post(LOGOUT_URL, {}, format="json")

    assert response.status_code == 200
    assert response.cookies[settings.AUTH_COOKIE_ACCESS].value == ""
    assert response.cookies[settings.AUTH_COOKIE_REFRESH].value == ""
    assert BlacklistedToken.objects.count() == 1


def test_logout_all_revokes_every_session(api_client, member):
    for _ in range(3):
        api_client.post(
            LOGIN_URL,
            {"email": member.email, "password": member.raw_password},
            format="json",
            **MOBILE,
        )

    api_client.post(
        LOGIN_URL, {"email": member.email, "password": member.raw_password}, format="json"
    )
    response = api_client.post(LOGOUT_ALL_URL, {}, format="json")

    assert response.status_code == 200
    assert response.data["revoked"] >= 4


# --------------------------------------------------------------- تأكيد البريد


def test_email_verification_marks_user_and_consumes_token(api_client):
    api_client.post(REGISTER_URL, VALID_REGISTRATION, format="json")
    token = EmailVerificationToken.objects.get()

    response = api_client.post(VERIFY_URL, {"token": token.token}, format="json")

    assert response.status_code == 200
    token.refresh_from_db()
    assert token.used_at is not None
    assert User.objects.get(email="new@example.com").is_email_verified is True


def test_email_verification_rejects_reused_token(api_client):
    api_client.post(REGISTER_URL, VALID_REGISTRATION, format="json")
    token = EmailVerificationToken.objects.get()

    api_client.post(VERIFY_URL, {"token": token.token}, format="json")
    replay = api_client.post(VERIFY_URL, {"token": token.token}, format="json")

    assert replay.status_code == 400
    assert replay.data["code"] == "invalid_token"


# --------------------------------------------------------------- كلمة المرور


def test_password_forgot_never_reveals_whether_email_exists(api_client, member):
    known = api_client.post(FORGOT_URL, {"email": member.email}, format="json")
    cache_reset = api_client
    unknown = cache_reset.post(FORGOT_URL, {"email": "ghost@example.com"}, format="json")

    assert known.status_code == 200
    assert unknown.status_code == 200
    assert known.data["detail"] == unknown.data["detail"]
    assert PasswordResetToken.objects.count() == 1


def test_password_reset_sets_new_password_and_revokes_sessions(api_client, member):
    api_client.post(
        LOGIN_URL,
        {"email": member.email, "password": member.raw_password},
        format="json",
        **MOBILE,
    )
    api_client.post(FORGOT_URL, {"email": member.email}, format="json")
    token = PasswordResetToken.objects.get()

    response = api_client.post(
        RESET_URL,
        {
            "token": token.token,
            "new_password": "BrandNew!2026",
            "new_password_confirm": "BrandNew!2026",
        },
        format="json",
    )

    assert response.status_code == 200
    assert BlacklistedToken.objects.count() >= 1

    member.refresh_from_db()
    assert member.check_password("BrandNew!2026")


def test_password_change_requires_correct_current_password(logged_in_client):
    response = logged_in_client.post(
        CHANGE_URL,
        {
            "current_password": "WrongPass!2026",
            "new_password": "BrandNew!2026",
            "new_password_confirm": "BrandNew!2026",
        },
        format="json",
    )

    assert response.status_code == 400
    assert "current_password" in response.data["errors"]


def test_password_change_issues_a_fresh_session(logged_in_client, member):
    response = logged_in_client.post(
        CHANGE_URL,
        {
            "current_password": member.raw_password,
            "new_password": "BrandNew!2026",
            "new_password_confirm": "BrandNew!2026",
        },
        format="json",
    )

    assert response.status_code == 200
    assert response.cookies[settings.AUTH_COOKIE_ACCESS].value != ""
    member.refresh_from_db()
    assert member.check_password("BrandNew!2026")


# --------------------------------------------------------------- حذف الحساب


def test_account_deletion_requires_password_confirmation(logged_in_client):
    response = logged_in_client.delete(
        ME_URL, {"password": "WrongPass!2026", "confirm": True}, format="json"
    )

    assert response.status_code == 400
    assert User.objects.count() == 1


def test_account_deletion_removes_user_and_clears_cookies(logged_in_client, member):
    response = logged_in_client.delete(
        ME_URL, {"password": member.raw_password, "confirm": True}, format="json"
    )

    assert response.status_code == 200
    assert User.objects.filter(pk=member.pk).exists() is False
    assert response.cookies[settings.AUTH_COOKIE_ACCESS].value == ""
