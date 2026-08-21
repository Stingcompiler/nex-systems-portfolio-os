"""تسجيل الأحداث في سجل التدقيق."""

import logging

from apps.core.middleware import get_current_request
from apps.core.models.system import AuditLog

logger = logging.getLogger(__name__)


def get_client_ip(request) -> str | None:
    if request is None:
        return None
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")


def get_user_agent(request) -> str:
    if request is None:
        return ""
    return (request.META.get("HTTP_USER_AGENT") or "")[:255]


def log_action(
    action: str,
    *,
    user=None,
    instance=None,
    model_name: str = "",
    object_id: str = "",
    object_repr: str = "",
    changes: dict | None = None,
    request=None,
) -> AuditLog | None:
    """يسجّل حدثًا. لا يرفع استثناء أبدًا كي لا يُسقط العملية الأصلية."""
    request = request or get_current_request()

    if user is None and request is not None:
        candidate = getattr(request, "user", None)
        if candidate is not None and getattr(candidate, "is_authenticated", False):
            user = candidate

    if instance is not None:
        model_name = model_name or instance.__class__.__name__
        object_id = object_id or str(getattr(instance, "pk", "") or "")
        object_repr = object_repr or str(instance)[:255]

    try:
        return AuditLog.objects.create(
            user=user,
            action=action,
            model_name=model_name[:64],
            object_id=str(object_id)[:64],
            object_repr=object_repr[:255],
            changes=changes or {},
            ip_address=get_client_ip(request),
            user_agent=get_user_agent(request),
        )
    except Exception:  # noqa: BLE001
        logger.exception("تعذّر كتابة سجل التدقيق للإجراء %s", action)
        return None


def diff_instance(before: dict, after: dict, exclude: tuple[str, ...] = ()) -> dict:
    """يبني قاموس التغييرات بصيغة {الحقل: {"from": ..., "to": ...}}."""
    sensitive = ("password", "token", "secret", *exclude)
    changes: dict[str, dict] = {}
    for field, new_value in after.items():
        if any(word in field for word in sensitive):
            continue
        old_value = before.get(field)
        if old_value != new_value:
            changes[field] = {"from": _safe(old_value), "to": _safe(new_value)}
    return changes


def _safe(value):
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    return str(value)[:255]
