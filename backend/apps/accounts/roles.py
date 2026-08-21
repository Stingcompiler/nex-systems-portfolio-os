"""الأدوار وربطها بمجموعات Django وصلاحياتها.

`User.role` حقل عرض وتيسير. مصدر الحقيقة للصلاحيات هو المجموعات،
ودالة `seed_groups` هي التي تبني هذا الربط في كل بيئة.
"""

from django.db import models


class Role(models.TextChoices):
    SUPER_ADMIN = "super_admin", "مدير عام"
    CONTENT_MANAGER = "content_manager", "مدير محتوى"
    EDITOR = "editor", "محرر"
    CRM_MANAGER = "crm_manager", "مدير علاقات العملاء"
    MARKETING_MANAGER = "marketing_manager", "مدير تسويق"
    MEMBER = "member", "عضو"
    CLIENT = "client", "عميل"


#: الأدوار التي تملك حق الدخول إلى لوحة التحكم
STAFF_ROLES = frozenset(
    {
        Role.SUPER_ADMIN,
        Role.CONTENT_MANAGER,
        Role.EDITOR,
        Role.CRM_MANAGER,
        Role.MARKETING_MANAGER,
    }
)

#: اسم مجموعة Django المقابلة لكل دور
GROUP_NAMES: dict[str, str] = {
    Role.SUPER_ADMIN: "Super Admin",
    Role.CONTENT_MANAGER: "Content Manager",
    Role.EDITOR: "Editor",
    Role.CRM_MANAGER: "CRM Manager",
    Role.MARKETING_MANAGER: "Marketing Manager",
    Role.MEMBER: "Member",
    Role.CLIENT: "Client",
}

#: صلاحيات كل دور.
#  "*"              → كل الصلاحيات
#  "app.*"          → كل صلاحيات التطبيق
#  "app.codename"   → صلاحية محددة
#  الصلاحيات الخاصة بتطبيقات لم تُبنَ بعد تُتجاهَل بهدوء ويُعاد تشغيل الأمر لاحقًا.
ROLE_PERMISSIONS: dict[str, list[str]] = {
    Role.SUPER_ADMIN: ["*"],
    Role.CONTENT_MANAGER: [
        "portfolio.*",
        "blog.*",
        "media_library.*",
        "core.change_pagesection",
        "core.view_pagesection",
        "core.change_sitesettings",
        "core.view_sitesettings",
        "core.manage_seo",
        "core.manage_media",
        "core.add_faq",
        "core.change_faq",
        "core.delete_faq",
        "core.view_faq",
        "core.add_sociallink",
        "core.change_sociallink",
        "core.delete_sociallink",
        "core.view_sociallink",
        "core.add_stat",
        "core.change_stat",
        "core.delete_stat",
        "core.view_stat",
        "core.add_processstep",
        "core.change_processstep",
        "core.delete_processstep",
        "core.view_processstep",
        "core.add_redirect",
        "core.change_redirect",
        "core.view_redirect",
        "comments.view_comment",
        "comments.change_comment",
        "comments.delete_comment",
        "comments.approve_comment",
        "comments.view_commentreport",
        "comments.change_commentreport",
    ],
    Role.EDITOR: [
        "blog.add_post",
        "blog.change_post",
        "blog.view_post",
        "blog.view_category",
        "blog.view_tag",
        "blog.add_tag",
        "media_library.add_mediafile",
        "media_library.view_mediafile",
        "portfolio.view_project",
        "portfolio.view_service",
    ],
    Role.CRM_MANAGER: [
        "crm.*",
        "core.view_auditlog",
        "accounts.view_user",
        "notifications.view_notification",
    ],
    Role.MARKETING_MANAGER: [
        "newsletter.*",
        "core.view_analytics",
        "accounts.view_user",
    ],
    Role.MEMBER: [],
    Role.CLIENT: [],
}
