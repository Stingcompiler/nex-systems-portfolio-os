"""معالج الأخطاء الموحّد لكل الـ API."""

import logging

from django.core.exceptions import PermissionDenied as DjangoPermissionDenied
from django.core.exceptions import ValidationError as DjangoValidationError
from django.http import Http404
from rest_framework import exceptions, status
from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_exception_handler

logger = logging.getLogger(__name__)

_DEFAULT_MESSAGES = {
    status.HTTP_400_BAD_REQUEST: "بيانات غير صالحة",
    status.HTTP_401_UNAUTHORIZED: "يلزم تسجيل الدخول",
    status.HTTP_403_FORBIDDEN: "لا تملك صلاحية تنفيذ هذا الإجراء",
    status.HTTP_404_NOT_FOUND: "العنصر المطلوب غير موجود",
    status.HTTP_405_METHOD_NOT_ALLOWED: "الطريقة غير مسموحة",
    status.HTTP_429_TOO_MANY_REQUESTS: "عدد المحاولات كبير — يرجى المحاولة لاحقًا",
    status.HTTP_500_INTERNAL_SERVER_ERROR: "حدث خطأ في الخادم",
}

_CODE_BY_STATUS = {
    status.HTTP_400_BAD_REQUEST: "validation_error",
    status.HTTP_401_UNAUTHORIZED: "not_authenticated",
    status.HTTP_403_FORBIDDEN: "permission_denied",
    status.HTTP_404_NOT_FOUND: "not_found",
    status.HTTP_405_METHOD_NOT_ALLOWED: "method_not_allowed",
    status.HTTP_429_TOO_MANY_REQUESTS: "throttled",
}


def api_exception_handler(exc, context):
    """يوحّد شكل كل خطأ: {detail, code, errors}."""
    if isinstance(exc, DjangoValidationError):
        exc = exceptions.ValidationError(detail=_django_validation_detail(exc))
    elif isinstance(exc, DjangoPermissionDenied):
        exc = exceptions.PermissionDenied()
    elif isinstance(exc, Http404):
        exc = exceptions.NotFound()

    response = drf_exception_handler(exc, context)

    if response is None:
        view = context.get("view")
        logger.exception("خطأ غير معالَج في %s", getattr(view, "__class__", view))
        return Response(
            {
                "detail": _DEFAULT_MESSAGES[status.HTTP_500_INTERNAL_SERVER_ERROR],
                "code": "server_error",
                "errors": {},
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    response.data = _build_payload(exc, response)

    if isinstance(exc, exceptions.Throttled) and exc.wait:
        response["Retry-After"] = str(int(exc.wait))

    return response


def _build_payload(exc, response) -> dict:
    # رمز ثابت لكل حالة معروفة كي يعتمد عليه الـ frontend،
    # ثم default_code للاستثناءات المخصصة، ثم رمز عام.
    code = (
        _CODE_BY_STATUS.get(response.status_code)
        or getattr(exc, "default_code", None)
        or "error"
    )
    data = response.data
    errors: dict = {}
    detail: str

    if isinstance(data, dict):
        if "detail" in data and len(data) == 1:
            detail = str(data["detail"])
        else:
            errors = {key: _as_list(value) for key, value in data.items()}
            non_field = errors.pop("non_field_errors", None)
            detail = (
                non_field[0]
                if non_field
                else _DEFAULT_MESSAGES.get(response.status_code, "حدث خطأ")
            )
            if non_field:
                errors["non_field_errors"] = non_field
    elif isinstance(data, list):
        errors = {"non_field_errors": _as_list(data)}
        detail = str(data[0]) if data else _DEFAULT_MESSAGES.get(
            response.status_code, "حدث خطأ"
        )
    else:
        detail = str(data)

    return {"detail": detail, "code": code, "errors": errors}


def _as_list(value) -> list[str]:
    if isinstance(value, (list, tuple)):
        return [str(item) for item in value]
    if isinstance(value, dict):
        return [f"{key}: {_as_list(item)}" for key, item in value.items()]
    return [str(value)]


def _django_validation_detail(exc: DjangoValidationError):
    if hasattr(exc, "message_dict"):
        return exc.message_dict
    return list(exc.messages)
