"""إدارة كوكيز المصادقة.

الويب يستقبل الرموز في كوكيز HttpOnly، والموبايل يستقبلها في جسم الاستجابة.
التفريق بترويسة `X-Client`.
"""

from django.conf import settings

MOBILE_CLIENT = "mobile"


def is_mobile_client(request) -> bool:
    """هل الطلب صادر من عميل لا يدعم الكوكيز (تطبيق موبايل)؟"""
    header = (request.headers.get("X-Client") or "").strip().lower()
    return header == MOBILE_CLIENT


def wants_cookie_auth(request) -> bool:
    return not is_mobile_client(request)


def set_auth_cookies(response, access_token: str | None, refresh_token: str | None = None):
    """يضبط كوكيز الوصول والتجديد بسمات آمنة."""
    common = {
        "httponly": True,
        "secure": settings.AUTH_COOKIE_SECURE,
        "samesite": settings.AUTH_COOKIE_SAMESITE,
        "domain": settings.AUTH_COOKIE_DOMAIN,
    }

    if access_token:
        response.set_cookie(
            settings.AUTH_COOKIE_ACCESS,
            access_token,
            max_age=int(settings.SIMPLE_JWT["ACCESS_TOKEN_LIFETIME"].total_seconds()),
            path="/",
            **common,
        )

    if refresh_token:
        # المسار مقيَّد بنقاط المصادقة وحدها، فلا يُرسل رمز التجديد مع كل طلب.
        response.set_cookie(
            settings.AUTH_COOKIE_REFRESH,
            refresh_token,
            max_age=int(settings.SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"].total_seconds()),
            path=settings.AUTH_COOKIE_REFRESH_PATH,
            **common,
        )

    return response


def clear_auth_cookies(response):
    response.delete_cookie(
        settings.AUTH_COOKIE_ACCESS,
        path="/",
        domain=settings.AUTH_COOKIE_DOMAIN,
        samesite=settings.AUTH_COOKIE_SAMESITE,
    )
    response.delete_cookie(
        settings.AUTH_COOKIE_REFRESH,
        path=settings.AUTH_COOKIE_REFRESH_PATH,
        domain=settings.AUTH_COOKIE_DOMAIN,
        samesite=settings.AUTH_COOKIE_SAMESITE,
    )
    return response


def read_refresh_token(request) -> str | None:
    """رمز التجديد من الكوكي (ويب) أو من جسم الطلب (موبايل)."""
    from_body = None
    if isinstance(getattr(request, "data", None), dict):
        from_body = request.data.get("refresh")
    return from_body or request.COOKIES.get(settings.AUTH_COOKIE_REFRESH)
