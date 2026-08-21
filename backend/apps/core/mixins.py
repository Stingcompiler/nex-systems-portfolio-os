"""Mixins مشتركة للمسلسلات والـ ViewSets."""

from django.forms.models import model_to_dict

from apps.core.audit import diff_instance, log_action
from apps.core.models.system import AuditLog
from apps.core.revalidate import queue_revalidate_for


class DualSerializerMixin:
    """مسلسلان لكل مورد: عام مختصر ومترجم، وإداري كامل بلغتيه.

    يُختار الإداري عند الكتابة، أو عند طلب `?full=true` من مستخدم لوحة تحكم.
    هكذا لا يتسرّب أي حقل داخلي إلى الاستجابات العامة بالخطأ.
    """

    public_serializer_class = None
    admin_serializer_class = None
    detail_serializer_class = None

    def get_serializer_class(self):
        if self.action not in ("list", "retrieve"):
            return self.admin_serializer_class or self.public_serializer_class

        if self._wants_admin_view():
            return self.admin_serializer_class or self.public_serializer_class

        if self.action == "retrieve" and self.detail_serializer_class:
            return self.detail_serializer_class

        return self.public_serializer_class

    def _wants_admin_view(self) -> bool:
        request = getattr(self, "request", None)
        if request is None or self.admin_serializer_class is None:
            return False
        if request.query_params.get("full") != "true":
            return False
        user = getattr(request, "user", None)
        return bool(
            user
            and user.is_authenticated
            and (user.is_superuser or getattr(user, "is_dashboard_user", False))
        )


class AuditLogMixin:
    """يسجّل كل عملية كتابة يقوم بها الـ ViewSet في سجل التدقيق."""

    audit_exclude_fields: tuple[str, ...] = ()

    def perform_create(self, serializer):
        instance = serializer.save(**self._authored_kwargs(serializer, creating=True))
        log_action(
            AuditLog.Action.CREATE,
            instance=instance,
            request=self.request,
            changes=self._snapshot(instance),
        )
        queue_revalidate_for(instance)
        return instance

    def perform_update(self, serializer):
        before = self._snapshot(serializer.instance)
        instance = serializer.save(**self._authored_kwargs(serializer, creating=False))
        after = self._snapshot(instance)
        log_action(
            AuditLog.Action.UPDATE,
            instance=instance,
            request=self.request,
            changes=diff_instance(before, after, exclude=self.audit_exclude_fields),
        )
        queue_revalidate_for(instance)
        return instance

    def perform_destroy(self, instance):
        snapshot = {
            "model": instance.__class__.__name__,
            "id": str(instance.pk),
            "repr": str(instance)[:255],
        }
        log_action(
            AuditLog.Action.DELETE,
            instance=instance,
            request=self.request,
            changes=snapshot,
        )
        queue_revalidate_for(instance)
        instance.delete()

    def _authored_kwargs(self, serializer, *, creating: bool) -> dict:
        model = serializer.Meta.model
        user = getattr(self.request, "user", None)
        if not (user and user.is_authenticated):
            return {}
        field_names = {field.name for field in model._meta.get_fields()}
        kwargs = {}
        if "updated_by" in field_names:
            kwargs["updated_by"] = user
        if creating and "created_by" in field_names:
            kwargs["created_by"] = user
        return kwargs

    def _snapshot(self, instance) -> dict:
        data = model_to_dict(instance)
        return {key: _plain(value) for key, value in data.items()}


def _plain(value):
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, (list, tuple)):
        return [_plain(item) for item in value]
    return str(value)[:255]
