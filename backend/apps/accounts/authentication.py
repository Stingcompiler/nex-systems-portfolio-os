"""مصادقة JWT تخدم الويب والموبايل بفئة واحدة.

- الموبايل يرسل الرمز في ترويسة `Authorization: Bearer ...`
- الويب يرسله في كوكي HttpOnly، ويخضع للتحقق من CSRF على الطرق غير الآمنة.
"""

from django.conf import settings
from rest_framework.authentication import CSRFCheck
from rest_framework.exceptions import PermissionDenied
from rest_framework_simplejwt.authentication import JWTAuthentication

SAFE_METHODS = frozenset({"GET", "HEAD", "OPTIONS", "TRACE"})


def enforce_csrf(request):
    """يتحقق من ترويسة X-CSRFToken مقابل كوكي csrftoken.

    يُستدعى في كل تدفق يعتمد على الكوكيز: المصادقة العادية، وتجديد الرمز،
    وتسجيل الخروج — لأن الكوكي يُرسل تلقائيًا من أي موقع.
    """
    if request.method in SAFE_METHODS:
        return

    check = CSRFCheck(lambda _request: None)
    check.process_request(request)
    reason = check.process_view(request, None, (), {})
    if reason:
        raise PermissionDenied(f"فشل التحقق من CSRF: {reason}")


class CookieJWTAuthentication(JWTAuthentication):
    """يقرأ رمز الوصول من الترويسة، وإلا من الكوكي."""

    def authenticate(self, request):
        header = self.get_header(request)

        if header is not None:
            raw_token = self.get_raw_token(header)
            from_cookie = False
        else:
            raw_token = request.COOKIES.get(settings.AUTH_COOKIE_ACCESS)
            from_cookie = True

        if not raw_token:
            return None

        validated_token = self.get_validated_token(raw_token)
        user = self.get_user(validated_token)

        # الكوكي يُرسل تلقائيًا مع كل طلب، فيلزم إثبات أن الطلب من موقعنا.
        if from_cookie:
            enforce_csrf(request)

        return (user, validated_token)
