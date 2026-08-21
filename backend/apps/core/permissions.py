"""فئات الصلاحيات المشتركة.

مصدر الحقيقة للصلاحيات هو مجموعات Django وصلاحياتها، لا حقل `role`.
الحقل موجود للعرض والتيسير فقط.
"""

from rest_framework import permissions

SAFE_METHODS = permissions.SAFE_METHODS


class IsSuperAdmin(permissions.BasePermission):
    message = "هذا الإجراء متاح للمدير العام فقط"

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and (user.is_superuser or user.role == "super_admin")
        )


class IsEmailVerified(permissions.BasePermission):
    message = "يلزم تأكيد بريدك الإلكتروني أولًا"

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.is_email_verified)


class HasDashboardPermission(permissions.BasePermission):
    """يشترط صلاحيات محددة يعلنها الـ ViewSet في `required_permissions`.

    يُستخدم للموارد التي لا يوجد لها نموذج مباشر أو التي تحتاج صلاحية
    مخصصة مثل `core.manage_settings`.
    """

    message = "لا تملك صلاحية الوصول إلى هذا القسم"

    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated):
            return False
        if user.is_superuser:
            return True

        # عضو لوحة التحكم شرط أساسي. بدون هذا الفحص كان أي مستخدم مصادَق
        # يمر عندما تكون `required_permissions` فارغة، لأن all([]) صحيح.
        if not getattr(user, "is_dashboard_user", False):
            return False

        required = getattr(view, "required_permissions", None) or []
        return all(user.has_perm(permission) for permission in required)


class ReadOnly(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.method in SAFE_METHODS


class PublicReadWriteProtected(permissions.BasePermission):
    """قراءة مفتوحة للجميع، وكتابة تتطلب صلاحية النموذج المناسبة.

    الـ ViewSet يحدد `required_permissions` أو يُشتق تلقائيًا من النموذج.
    """

    message = "لا تملك صلاحية تعديل هذا المحتوى"

    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True

        user = request.user
        if not (user and user.is_authenticated):
            return False
        if user.is_superuser:
            return True

        required = getattr(view, "required_permissions", None)
        if required is None:
            required = self._perms_from_model(view, request.method)
        return all(user.has_perm(perm) for perm in required)

    @staticmethod
    def _perms_from_model(view, method) -> list[str]:
        queryset = getattr(view, "queryset", None)
        model = getattr(queryset, "model", None)
        if model is None:
            return []
        meta = model._meta
        action = {
            "POST": "add",
            "PUT": "change",
            "PATCH": "change",
            "DELETE": "delete",
        }.get(method)
        if action is None:
            return []
        return [f"{meta.app_label}.{action}_{meta.model_name}"]


class IsOwnerOrHasPermission(permissions.BasePermission):
    """يسمح لصاحب السجل، أو لمن يملك صلاحية النموذج.

    الـ ViewSet يحدد `owner_field` (افتراضيًا `user`).
    """

    message = "لا تملك صلاحية الوصول إلى هذا السجل"

    def has_object_permission(self, request, view, obj):
        user = request.user
        if not (user and user.is_authenticated):
            return False
        if user.is_superuser:
            return True

        owner_field = getattr(view, "owner_field", "user")
        owner = getattr(obj, owner_field, None)
        if owner is not None and owner == user:
            return True

        meta = obj._meta
        action = "view" if request.method in SAFE_METHODS else "change"
        return user.has_perm(f"{meta.app_label}.{action}_{meta.model_name}")
