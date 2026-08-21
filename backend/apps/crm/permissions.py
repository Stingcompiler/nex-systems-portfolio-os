from rest_framework import permissions

CRM_PERMISSIONS = {
    "GET": "crm.view_lead",
    "POST": "crm.add_lead",
    "PUT": "crm.change_lead",
    "PATCH": "crm.change_lead",
    "DELETE": "crm.delete_lead",
}


class IsCrmStaff(permissions.BasePermission):
    """الوصول إلى CRM يتطلب صلاحيات إدارة العملاء."""

    message = "لا تملك صلاحية الوصول إلى إدارة العملاء"

    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated):
            return False
        if user.is_superuser:
            return True
        if not getattr(user, "is_dashboard_user", False):
            return False
        # صلاحية عرض العملاء المحتملين هي البوابة الأساسية للقسم كله
        return user.has_perm("crm.view_lead")
