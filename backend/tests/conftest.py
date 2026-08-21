import pytest
from django.core.cache import cache
from rest_framework.test import APIClient

from apps.accounts.models import User


@pytest.fixture(autouse=True)
def clear_throttle_cache():
    """يمنع تسرّب عدادات تحديد المعدل بين الاختبارات."""
    cache.clear()
    yield
    cache.clear()


@pytest.fixture(autouse=True)
def isolated_media_root(settings, tmp_path):
    """يمنع الاختبارات من الكتابة في مجلد الوسائط الحقيقي."""
    settings.MEDIA_ROOT = str(tmp_path / "media")
    return settings.MEDIA_ROOT


@pytest.fixture
def api_client() -> APIClient:
    return APIClient()


@pytest.fixture
def csrf_client() -> APIClient:
    """عميل يطبّق فحص CSRF فعليًا كما يفعل المتصفح."""
    return APIClient(enforce_csrf_checks=True)


@pytest.fixture
def make_user(db):
    def _make(
        email: str = "member@example.com",
        password: str = "StrongPass!2026",
        *,
        full_name: str = "عضو تجريبي",
        role: str = "member",
        verified: bool = True,
        **extra,
    ) -> User:
        user = User.objects.create_user(
            email=email,
            password=password,
            full_name=full_name,
            role=role,
            **extra,
        )
        if verified:
            user.is_email_verified = True
            user.save(update_fields=["is_email_verified"])
        user.raw_password = password
        return user

    return _make


@pytest.fixture
def member(make_user) -> User:
    return make_user()


@pytest.fixture
def logged_in_client(api_client, member) -> APIClient:
    response = api_client.post(
        "/api/v1/auth/login/",
        {"email": member.email, "password": member.raw_password},
        format="json",
    )
    assert response.status_code == 200, response.data
    return api_client
