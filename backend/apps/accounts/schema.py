"""تعريف مخططات المصادقة لتوثيق OpenAPI."""

from django.conf import settings
from drf_spectacular.extensions import OpenApiAuthenticationExtension


class CookieJWTScheme(OpenApiAuthenticationExtension):
    """يوثّق مساري المصادقة: كوكي للويب وBearer للموبايل."""

    target_class = "apps.accounts.authentication.CookieJWTAuthentication"
    name = ["jwtCookieAuth", "jwtBearerAuth"]

    def get_security_definition(self, auto_schema):
        return [
            {
                "type": "apiKey",
                "in": "cookie",
                "name": settings.AUTH_COOKIE_ACCESS,
                "description": (
                    "رمز وصول JWT داخل كوكي HttpOnly. يُستخدم من متصفح الويب، "
                    "ويتطلب ترويسة X-CSRFToken في الطرق غير الآمنة."
                ),
            },
            {
                "type": "http",
                "scheme": "bearer",
                "bearerFormat": "JWT",
                "description": "رمز وصول JWT في الترويسة. يُستخدم من تطبيقات الموبايل.",
            },
        ]
