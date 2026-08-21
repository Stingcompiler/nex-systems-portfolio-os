from django.conf import settings
from django.contrib.auth import authenticate
from django.middleware.csrf import get_token as get_csrf_token
from django.utils import timezone
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import status
from rest_framework.exceptions import AuthenticationFailed, Throttled
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.token_blacklist.models import (
    BlacklistedToken,
    OutstandingToken,
)
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts import emails
from apps.accounts.authentication import enforce_csrf
from apps.accounts.cookies import (
    clear_auth_cookies,
    is_mobile_client,
    read_refresh_token,
    set_auth_cookies,
)
from apps.accounts.models import (
    EmailVerificationToken,
    LoginAttempt,
    PasswordResetToken,
    User,
)
from apps.accounts.serializers import (
    AccountDeleteSerializer,
    AuthResponseSerializer,
    DetailSerializer,
    EmailVerifySerializer,
    LoginSerializer,
    MeUpdateSerializer,
    PasswordChangeSerializer,
    PasswordForgotSerializer,
    PasswordResetSerializer,
    RefreshRequestSerializer,
    RegisterSerializer,
    RevokeResponseSerializer,
    TokenPairSerializer,
    UserSerializer,
)
from apps.core.audit import get_client_ip, get_user_agent, log_action
from apps.core.models.system import AuditLog
from apps.core.throttling import (
    LoginThrottle,
    PasswordForgotThrottle,
    RegisterThrottle,
    ResendVerificationThrottle,
)

#: رسالة موحّدة لا تكشف إن كان البريد مسجلًا أم لا
GENERIC_LOGIN_ERROR = "البريد الإلكتروني أو كلمة المرور غير صحيحة"


def blacklist_all_tokens(user) -> int:
    """يبطل كل رموز التجديد القائمة للمستخدم."""
    count = 0
    for token in OutstandingToken.objects.filter(user=user):
        _, created = BlacklistedToken.objects.get_or_create(token=token)
        count += int(created)
    return count


def build_auth_response(request, user, refresh: RefreshToken, http_status=status.HTTP_200_OK):
    """يبني استجابة المصادقة: كوكيز للويب، ورموز في الجسم للموبايل."""
    payload = {"user": UserSerializer(user).data}
    mobile = is_mobile_client(request)

    if mobile:
        payload["tokens"] = {"access": str(refresh.access_token), "refresh": str(refresh)}

    response = Response(payload, status=http_status)

    if not mobile:
        set_auth_cookies(response, str(refresh.access_token), str(refresh))
        # يضمن وجود كوكي csrftoken كي ترسله الواجهة في الترويسة لاحقًا
        get_csrf_token(request)

    return response


class RegisterView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [RegisterThrottle]
    serializer_class = RegisterSerializer

    @extend_schema(
        summary="تسجيل عضو جديد",
        description="ينشئ الحساب، ويرسل بريد التحقق، ويفتح جلسة فورًا.",
        request=RegisterSerializer,
        responses={
            201: AuthResponseSerializer,
            400: OpenApiResponse(description="بيانات غير صالحة"),
            429: OpenApiResponse(description="تجاوز حد التسجيل"),
        },
    )
    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        token = EmailVerificationToken.issue(
            user, settings.EMAIL_VERIFICATION_HOURS, get_client_ip(request)
        )
        emails.queue_verification_email(user, token.token)

        log_action(AuditLog.Action.CREATE, user=user, instance=user, request=request)

        refresh = RefreshToken.for_user(user)
        return build_auth_response(request, user, refresh, status.HTTP_201_CREATED)


class LoginView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [LoginThrottle]
    serializer_class = LoginSerializer

    @extend_schema(
        summary="تسجيل الدخول",
        description=(
            "الويب يستقبل الرموز في كوكيز HttpOnly. "
            "العميل الذي يرسل `X-Client: mobile` يستقبلها في جسم الاستجابة."
        ),
        request=LoginSerializer,
        responses={
            200: AuthResponseSerializer,
            401: OpenApiResponse(description="بيانات دخول غير صحيحة"),
            429: OpenApiResponse(description="قفل مؤقت أو تجاوز حد المحاولات"),
        },
    )
    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data["email"]
        password = serializer.validated_data["password"]
        ip = get_client_ip(request)
        user_agent = get_user_agent(request)

        if LoginAttempt.is_locked(email, ip):
            raise Throttled(
                detail="تم قفل الحساب مؤقتًا بسبب محاولات دخول فاشلة متكررة. حاول بعد 15 دقيقة."
            )

        user = authenticate(request, username=email, password=password)

        if user is None:
            LoginAttempt.record(email, ip, success=False, user_agent=user_agent)
            log_action(
                AuditLog.Action.LOGIN_FAILED,
                request=request,
                model_name="User",
                object_repr=email,
            )
            raise AuthenticationFailed(GENERIC_LOGIN_ERROR)

        LoginAttempt.record(email, ip, success=True, user_agent=user_agent)
        LoginAttempt.clear_failures(email, ip)

        user.last_login_ip = ip
        user.save(update_fields=["last_login_ip"])

        log_action(AuditLog.Action.LOGIN, user=user, instance=user, request=request)

        refresh = RefreshToken.for_user(user)
        return build_auth_response(request, user, refresh)


class RefreshView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    @extend_schema(
        summary="تجديد رمز الوصول مع تدوير رمز التجديد",
        request=RefreshRequestSerializer,
        responses={
            200: TokenPairSerializer,
            401: OpenApiResponse(description="رمز تجديد غير صالح أو مُبطل"),
        },
    )
    def post(self, request):
        raw_refresh = read_refresh_token(request)
        if not raw_refresh:
            return _unauthorized("لا يوجد رمز تجديد")

        # الكوكي يُرسل تلقائيًا، فيلزم إثبات مصدر الطلب.
        if not is_mobile_client(request) and settings.AUTH_COOKIE_REFRESH in request.COOKIES:
            enforce_csrf(request)

        serializer = TokenRefreshSerializer(data={"refresh": raw_refresh})
        try:
            serializer.is_valid(raise_exception=True)
        except TokenError:
            return _unauthorized("رمز التجديد غير صالح أو منتهٍ")
        except Exception:  # InvalidToken من DRF SimpleJWT
            return _unauthorized("رمز التجديد غير صالح أو منتهٍ")

        data = serializer.validated_data
        access = data.get("access")
        new_refresh = data.get("refresh")

        if is_mobile_client(request):
            return Response(
                {"access": access, "refresh": new_refresh or raw_refresh},
                status=status.HTTP_200_OK,
            )

        response = Response({"detail": "تم التجديد"}, status=status.HTTP_200_OK)
        set_auth_cookies(response, access, new_refresh)
        get_csrf_token(request)
        return response


class LogoutView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    @extend_schema(
        summary="تسجيل الخروج وإبطال رمز التجديد",
        request=RefreshRequestSerializer,
        responses={200: DetailSerializer},
    )
    def post(self, request):
        raw_refresh = read_refresh_token(request)

        if raw_refresh:
            try:
                RefreshToken(raw_refresh).blacklist()
            except TokenError:
                pass  # رمز منتهٍ أو مُبطل مسبقًا — الخروج ينجح بأي حال

        log_action(AuditLog.Action.LOGOUT, request=request)

        response = Response({"detail": "تم تسجيل الخروج"}, status=status.HTTP_200_OK)
        return clear_auth_cookies(response)


class LogoutAllView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="تسجيل الخروج من كل الأجهزة",
        request=None,
        responses={200: RevokeResponseSerializer},
    )
    def post(self, request):
        count = blacklist_all_tokens(request.user)
        log_action(
            AuditLog.Action.LOGOUT,
            user=request.user,
            request=request,
            changes={"blacklisted_tokens": count},
        )
        response = Response(
            {"detail": "تم تسجيل الخروج من كل الأجهزة", "revoked": count},
            status=status.HTTP_200_OK,
        )
        return clear_auth_cookies(response)


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(summary="بيانات المستخدم الحالي", responses={200: UserSerializer})
    def get(self, request):
        return Response(UserSerializer(request.user).data)

    @extend_schema(
        summary="تعديل الملف الشخصي",
        request=MeUpdateSerializer,
        responses={200: UserSerializer},
    )
    def patch(self, request):
        serializer = MeUpdateSerializer(
            request.user, data=request.data, partial=True, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        log_action(AuditLog.Action.UPDATE, user=user, instance=user, request=request)
        return Response(UserSerializer(user).data)

    @extend_schema(
        summary="حذف الحساب",
        request=AccountDeleteSerializer,
        responses={200: DetailSerializer, 400: OpenApiResponse(description="تأكيد ناقص")},
    )
    def delete(self, request):
        serializer = AccountDeleteSerializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)

        user = request.user
        blacklist_all_tokens(user)
        log_action(
            AuditLog.Action.ACCOUNT_DELETED,
            user=None,
            request=request,
            model_name="User",
            object_id=str(user.pk),
            object_repr=user.email,
        )
        user.delete()

        response = Response(
            {"detail": "تم حذف الحساب نهائيًا"}, status=status.HTTP_200_OK
        )
        return clear_auth_cookies(response)


class VerifyEmailView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(
        summary="تأكيد البريد الإلكتروني",
        request=EmailVerifySerializer,
        responses={
            200: DetailSerializer,
            400: OpenApiResponse(description="رمز غير صالح أو مستخدم مسبقًا"),
        },
    )
    def post(self, request):
        serializer = EmailVerifySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        record = EmailVerificationToken.objects.filter(
            token=serializer.validated_data["token"]
        ).select_related("user").first()

        if record is None or not record.is_valid:
            return Response(
                {
                    "detail": "رابط التحقق غير صالح أو منتهي الصلاحية",
                    "code": "invalid_token",
                    "errors": {},
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = record.user
        record.consume()

        if not user.is_email_verified:
            user.is_email_verified = True
            user.save(update_fields=["is_email_verified"])
            log_action(
                AuditLog.Action.EMAIL_VERIFIED, user=user, instance=user, request=request
            )

        return Response({"detail": "تم تأكيد البريد الإلكتروني بنجاح"})


class ResendVerificationView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [ResendVerificationThrottle]

    @extend_schema(
        summary="إعادة إرسال بريد التحقق",
        request=None,
        responses={200: DetailSerializer, 429: OpenApiResponse(description="طلب متكرر")},
    )
    def post(self, request):
        user = request.user
        if user.is_email_verified:
            return Response({"detail": "بريدك مؤكَّد بالفعل"})

        token = EmailVerificationToken.issue(
            user, settings.EMAIL_VERIFICATION_HOURS, get_client_ip(request)
        )
        emails.queue_verification_email(user, token.token)
        return Response({"detail": "تم إرسال رابط التحقق إلى بريدك"})


class PasswordForgotView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [PasswordForgotThrottle]

    @extend_schema(
        summary="طلب استعادة كلمة المرور",
        description="الاستجابة موحّدة سواء وُجد البريد أم لا، منعًا لتعداد الحسابات.",
        request=PasswordForgotSerializer,
        responses={200: DetailSerializer},
    )
    def post(self, request):
        serializer = PasswordForgotSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = User.objects.filter(
            email__iexact=serializer.validated_data["email"], is_active=True
        ).first()

        if user is not None:
            token = PasswordResetToken.issue(
                user, settings.PASSWORD_RESET_HOURS, get_client_ip(request)
            )
            emails.queue_password_reset_email(user, token.token)

        # استجابة موحّدة سواء وُجد البريد أم لا — منعًا لتعداد الحسابات.
        return Response(
            {"detail": "إن كان البريد مسجلًا لدينا فستصلك رسالة خلال دقائق"}
        )


class PasswordResetView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(
        summary="تعيين كلمة مرور جديدة",
        request=PasswordResetSerializer,
        responses={200: DetailSerializer, 400: OpenApiResponse(description="رمز غير صالح")},
    )
    def post(self, request):
        serializer = PasswordResetSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        record = PasswordResetToken.objects.filter(
            token=serializer.validated_data["token"]
        ).select_related("user").first()

        if record is None or not record.is_valid:
            return Response(
                {
                    "detail": "رابط الاستعادة غير صالح أو منتهي الصلاحية",
                    "code": "invalid_token",
                    "errors": {},
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = record.user
        user.set_password(serializer.validated_data["new_password"])
        user.save(update_fields=["password"])
        record.consume()

        # أي جلسة قائمة تصبح غير صالحة بعد تغيير كلمة المرور.
        blacklist_all_tokens(user)
        emails.queue_password_changed_email(user)
        log_action(
            AuditLog.Action.PASSWORD_RESET, user=user, instance=user, request=request
        )

        response = Response({"detail": "تم تعيين كلمة المرور الجديدة"})
        return clear_auth_cookies(response)


class PasswordChangeView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="تغيير كلمة المرور",
        description="يبطل كل الجلسات القائمة ثم يفتح جلسة جديدة للمستخدم الحالي.",
        request=PasswordChangeSerializer,
        responses={200: AuthResponseSerializer, 400: OpenApiResponse(description="بيانات غير صالحة")},
    )
    def post(self, request):
        serializer = PasswordChangeSerializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)

        user = request.user
        user.set_password(serializer.validated_data["new_password"])
        user.save(update_fields=["password"])

        blacklist_all_tokens(user)
        emails.queue_password_changed_email(user)
        log_action(
            AuditLog.Action.PASSWORD_CHANGE, user=user, instance=user, request=request
        )

        # جلسة جديدة فورًا كي لا يُطرد المستخدم من الواجهة بعد التغيير.
        refresh = RefreshToken.for_user(user)
        return build_auth_response(request, user, refresh)


def _unauthorized(message: str) -> Response:
    response = Response(
        {"detail": message, "code": "invalid_token", "errors": {}},
        status=status.HTTP_401_UNAUTHORIZED,
    )
    return clear_auth_cookies(response)
