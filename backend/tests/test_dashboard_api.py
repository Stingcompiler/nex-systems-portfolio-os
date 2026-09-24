"""اختبارات واجهات لوحة التحكم: الملخص، الإشعارات، المستخدمون، العزل."""

import pytest
from django.core.management import call_command

from apps.notifications.models import Notification

pytestmark = pytest.mark.django_db

SUMMARY_URL = "/api/v1/dashboard/summary/"
USERS_URL = "/api/v1/users/"
ROLES_URL = "/api/v1/roles/"
NOTIFICATIONS_URL = "/api/v1/notifications/"
AUDIT_URL = "/api/v1/audit-logs/"


@pytest.fixture
def seeded(db):
    call_command("seed_groups", verbosity=0)


def _login(client, user):
    response = client.post(
        "/api/v1/auth/login/",
        {"email": user.email, "password": user.raw_password},
        format="json",
    )
    assert response.status_code == 200, response.data
    return client


# --------------------------------------------------------------- عزل لوحة التحكم


def test_dashboard_summary_rejects_anonymous(api_client):
    assert api_client.get(SUMMARY_URL).status_code == 401


def test_dashboard_summary_rejects_plain_member(api_client, seeded, make_user):
    """الحارس الحرج: عضو عادي يجب ألا يصل للملخص رغم غياب صلاحية محددة."""
    member = make_user(email="plain@example.com", role="member")
    _login(api_client, member)

    assert api_client.get(SUMMARY_URL).status_code == 403


def test_dashboard_summary_allows_staff(api_client, seeded, make_user):
    manager = make_user(email="content@example.com", role="content_manager")
    _login(api_client, manager)

    response = api_client.get(SUMMARY_URL)
    assert response.status_code == 200
    assert response.data["role"] == "content_manager"
    assert "checklist" in response.data["site"]
    assert "completion" in response.data["site"]


def _sections(api_client, make_user, role, **extra):
    user = make_user(email=f"{role}@example.com", role=role, **extra)
    _login(api_client, user)
    response = api_client.get(SUMMARY_URL)
    assert response.status_code == 200, response.data
    return response.data


@pytest.mark.parametrize(
    "role, expected",
    [
        # كل دور يرى عمله فقط — والقسم الغائب غائب من الاستجابة لا فارغ
        ("content_manager", {"my_posts", "community", "site"}),
        ("editor", {"my_posts"}),
        ("crm_manager", {"crm"}),
        ("marketing_manager", {"marketing", "analytics"}),
    ],
)
def test_summary_sections_follow_role(api_client, seeded, make_user, role, expected):
    data = _sections(api_client, make_user, role)
    assert set(data["sections"]) == expected
    for key in {"crm", "community", "my_posts", "marketing", "analytics", "site", "system"}:
        assert (key in data) == (key in expected), key


def test_super_admin_sees_every_section(api_client, seeded, make_user):
    data = _sections(api_client, make_user, "super_admin", is_superuser=True)
    assert set(data["sections"]) == {
        "crm", "my_posts", "community", "marketing", "analytics", "site", "system",
    }


def test_editor_no_longer_sees_client_data(api_client, seeded, make_user):
    """المحرر كان يرى الطلبات والعملاء والرسائل على الصفحة الأولى."""
    data = _sections(api_client, make_user, "editor")
    assert "crm" not in data and "system" not in data


def test_crm_block_shape(api_client, seeded, make_user):
    crm = _sections(api_client, make_user, "crm_manager")["crm"]
    for key in (
        "new_requests", "new_requests_delta_pct", "pending_requests", "active_clients",
        "new_clients_month", "unanswered_messages", "unanswered_oldest_days",
    ):
        assert key in crm and isinstance(crm[key], int)
    # سلسلة الطلبات الأسبوعية دائمًا سبعة أيام
    assert len(crm["weekly_requests"]) == 7
    assert all({"date", "value"} <= set(point) for point in crm["weekly_requests"])
    assert isinstance(crm["follow_ups_today"], list)


def test_my_posts_counts_only_own_posts(api_client, seeded, make_user):
    from apps.blog.models import Post

    editor = make_user(email="writer@example.com", role="editor")
    other = make_user(email="other-writer@example.com", role="editor")
    Post.objects.create(title_ar="مسودتي", author=editor, status=Post.Status.DRAFT)
    Post.objects.create(title_ar="بانتظار المراجعة", author=editor, status=Post.Status.IN_REVIEW)
    Post.objects.create(title_ar="مقال زميل", author=other, status=Post.Status.DRAFT)
    _login(api_client, editor)

    mine = api_client.get(SUMMARY_URL).data["my_posts"]
    assert mine["drafts"] == 1 and mine["in_review"] == 1
    assert {post["title"] for post in mine["recent"]} == {"مسودتي", "بانتظار المراجعة"}


def test_dashboard_summary_checklist_reflects_data(api_client, seeded, make_user):
    call_command("seed_content", verbosity=0)
    admin = make_user(email="a@example.com", role="super_admin", is_superuser=True)
    _login(api_client, admin)

    response = api_client.get(SUMMARY_URL)
    checklist = {item["key"]: item["done"] for item in response.data["site"]["checklist"]}

    # المسودات موجودة بعد التهيئة، فبند «استكمال المسودات» غير مكتمل
    assert checklist["drafts"] is False
    # لا شهادات مزروعة
    assert checklist["testimonials"] is False


# --------------------------------------------------------------- المستخدمون


def test_only_super_admin_manages_users(api_client, seeded, make_user):
    manager = make_user(email="cm@example.com", role="content_manager")
    _login(api_client, manager)
    assert api_client.get(USERS_URL).status_code == 403


def test_super_admin_lists_users(api_client, seeded, make_user):
    admin = make_user(email="root@example.com", role="super_admin", is_superuser=True)
    make_user(email="other@example.com", role="member")
    _login(api_client, admin)

    response = api_client.get(USERS_URL)
    assert response.status_code == 200
    assert response.data["count"] >= 2


def test_set_role_syncs_group(api_client, seeded, make_user):
    admin = make_user(email="root@example.com", role="super_admin", is_superuser=True)
    target = make_user(email="editor@example.com", role="member")
    _login(api_client, admin)

    response = api_client.post(
        f"{USERS_URL}{target.id}/set-role/", {"role": "content_manager"}, format="json"
    )

    assert response.status_code == 200
    target.refresh_from_db()
    assert target.role == "content_manager"
    assert target.groups.filter(name="Content Manager").exists()


def test_admin_cannot_change_own_role(api_client, seeded, make_user):
    admin = make_user(email="root@example.com", role="super_admin", is_superuser=True)
    _login(api_client, admin)

    response = api_client.post(
        f"{USERS_URL}{admin.id}/set-role/", {"role": "member"}, format="json"
    )
    assert response.status_code == 400


def test_cannot_delete_last_super_admin(api_client, seeded, make_user):
    admin = make_user(email="only@example.com", role="super_admin", is_superuser=True)
    _login(api_client, admin)

    # حذف حساب المستخدم نفسه ممنوع صراحةً
    response = api_client.delete(f"{USERS_URL}{admin.id}/")
    assert response.status_code == 400


def test_creating_user_via_admin_sets_password(api_client, seeded, make_user):
    from apps.accounts.models import User

    admin = make_user(email="root@example.com", role="super_admin", is_superuser=True)
    _login(api_client, admin)

    response = api_client.post(
        USERS_URL,
        {
            "full_name": "مستخدم جديد",
            "email": "created@example.com",
            "role": "editor",
            "password": "CreatedPass!2026",
        },
        format="json",
    )

    assert response.status_code == 201
    created = User.objects.get(email="created@example.com")
    assert created.check_password("CreatedPass!2026")
    assert created.groups.filter(name="Editor").exists()


def test_roles_endpoint_reports_permission_counts(api_client, seeded, make_user):
    admin = make_user(email="root@example.com", role="super_admin", is_superuser=True)
    _login(api_client, admin)

    response = api_client.get(ROLES_URL)
    assert response.status_code == 200
    roles = {entry["value"]: entry for entry in response.data}
    assert roles["super_admin"]["permission_count"] > 0
    assert roles["member"]["permission_count"] == 0


# --------------------------------------------------------------- الإشعارات


def test_notifications_are_scoped_to_the_user(api_client, seeded, make_user):
    admin = make_user(email="admin@example.com", role="super_admin", is_superuser=True)
    other = make_user(email="other@example.com", role="member")

    # إشعار موجّه لعضو آخر
    Notification.notify("system", "خاص بغيرك", recipient=other)
    # إشعار عام لفريق اللوحة
    Notification.notify("new_comment", "تعليق جديد")

    _login(api_client, admin)
    response = api_client.get(NOTIFICATIONS_URL)

    titles = {item["title"] for item in response.data["results"]}
    assert "تعليق جديد" in titles  # يرى العام لأنه من فريق اللوحة
    assert "خاص بغيرك" not in titles  # لا يرى الموجّه لغيره


def test_member_only_sees_own_notifications(api_client, seeded, make_user):
    member = make_user(email="m@example.com", role="member")
    Notification.notify("comment_reply", "رد عليك", recipient=member)
    Notification.notify("new_comment", "إشعار عام للفريق")

    _login(api_client, member)
    response = api_client.get(NOTIFICATIONS_URL)

    titles = {item["title"] for item in response.data["results"]}
    assert titles == {"رد عليك"}  # العضو ليس من فريق اللوحة، فلا يرى العام


def test_unread_count_and_mark_all(api_client, seeded, make_user):
    admin = make_user(email="admin@example.com", role="super_admin", is_superuser=True)
    Notification.notify("new_member", "عضو جديد ١")
    Notification.notify("new_subscriber", "مشترك جديد ٢")
    _login(api_client, admin)

    before = api_client.get(f"{NOTIFICATIONS_URL}unread-count/")
    assert before.data["unread"] == 2

    marked = api_client.post(f"{NOTIFICATIONS_URL}read-all/")
    assert marked.data["marked"] == 2

    after = api_client.get(f"{NOTIFICATIONS_URL}unread-count/")
    assert after.data["unread"] == 0


# --------------------------------------------------------------- سجل التدقيق


def test_audit_log_is_super_admin_only(api_client, seeded, make_user):
    manager = make_user(email="cm@example.com", role="content_manager")
    _login(api_client, manager)
    assert api_client.get(AUDIT_URL).status_code == 403


def test_audit_log_is_read_only(api_client, seeded, make_user):
    admin = make_user(email="root@example.com", role="super_admin", is_superuser=True)
    _login(api_client, admin)

    assert api_client.get(AUDIT_URL).status_code == 200
    # لا إنشاء ولا حذف على السجل
    assert api_client.post(AUDIT_URL, {}, format="json").status_code == 405
