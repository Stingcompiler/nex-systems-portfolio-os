"""اختبارات الأدوار والمجموعات والصلاحيات."""

import pytest
from django.contrib.auth.models import Group
from django.core.management import call_command

from apps.accounts.roles import GROUP_NAMES, Role

pytestmark = pytest.mark.django_db


@pytest.fixture
def seeded_groups():
    call_command("seed_groups", verbosity=0)


def test_seed_groups_creates_every_role_group(seeded_groups):
    existing = set(Group.objects.values_list("name", flat=True))
    assert set(GROUP_NAMES.values()).issubset(existing)


def test_seed_groups_is_idempotent(seeded_groups):
    before = Group.objects.count()
    call_command("seed_groups", verbosity=0)
    assert Group.objects.count() == before


def test_super_admin_group_receives_all_permissions(seeded_groups):
    from django.contrib.auth.models import Permission

    group = Group.objects.get(name=GROUP_NAMES[Role.SUPER_ADMIN])
    assert group.permissions.count() == Permission.objects.count()


def test_member_group_has_no_permissions(seeded_groups):
    group = Group.objects.get(name=GROUP_NAMES[Role.MEMBER])
    assert group.permissions.count() == 0


def test_user_is_placed_in_the_group_matching_their_role(seeded_groups, make_user):
    user = make_user(email="editor@example.com", role=Role.EDITOR)

    names = set(user.groups.values_list("name", flat=True))
    assert names == {GROUP_NAMES[Role.EDITOR]}


def test_changing_role_moves_the_user_between_groups(seeded_groups, make_user):
    user = make_user(email="mover@example.com", role=Role.EDITOR)

    user.role = Role.CRM_MANAGER
    user.save()

    names = set(user.groups.values_list("name", flat=True))
    assert names == {GROUP_NAMES[Role.CRM_MANAGER]}


def test_custom_groups_survive_a_role_change(seeded_groups, make_user):
    custom = Group.objects.create(name="فريق خاص")
    user = make_user(email="custom@example.com", role=Role.EDITOR)
    user.groups.add(custom)

    user.role = Role.CONTENT_MANAGER
    user.save()

    names = set(user.groups.values_list("name", flat=True))
    assert names == {GROUP_NAMES[Role.CONTENT_MANAGER], "فريق خاص"}


def test_staff_roles_gain_dashboard_access(make_user):
    editor = make_user(email="staff@example.com", role=Role.EDITOR)
    member = make_user(email="plain@example.com", role=Role.MEMBER)

    assert editor.is_staff is True
    assert editor.is_dashboard_user is True
    assert member.is_staff is False
    assert member.is_dashboard_user is False


def test_crm_manager_cannot_touch_content(seeded_groups, make_user):
    user = make_user(email="crm@example.com", role=Role.CRM_MANAGER)
    user = type(user).objects.get(pk=user.pk)  # إعادة تحميل ذاكرة الصلاحيات

    assert user.has_perm("core.manage_settings") is False


def test_superuser_reports_wildcard_permissions(api_client, make_user):
    admin = make_user(
        email="admin@example.com", role=Role.SUPER_ADMIN, is_superuser=True, is_staff=True
    )
    api_client.post(
        "/api/v1/auth/login/",
        {"email": admin.email, "password": admin.raw_password},
        format="json",
    )

    response = api_client.get("/api/v1/auth/me/")
    assert response.data["permissions"] == ["*"]
    assert response.data["is_dashboard_user"] is True
