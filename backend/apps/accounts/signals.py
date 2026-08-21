"""مزامنة الأدوار مع مجموعات Django وإنشاء ملف العضو تلقائيًا."""

from django.contrib.auth.models import Group
from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.accounts.models import MemberProfile, User
from apps.accounts.roles import GROUP_NAMES

_ROLE_GROUP_NAMES = set(GROUP_NAMES.values())


@receiver(post_save, sender=User)
def ensure_member_profile(sender, instance: User, created: bool, **kwargs):
    if created:
        MemberProfile.objects.get_or_create(user=instance)


@receiver(post_save, sender=User)
def sync_role_group(sender, instance: User, **kwargs):
    """يجعل مجموعة المستخدم مطابقة لدوره.

    تُزال مجموعات الأدوار الأخرى فقط — أي مجموعة مخصصة أضيفت يدويًا تبقى.
    """
    target_name = GROUP_NAMES.get(instance.role)
    if not target_name:
        return

    group, _ = Group.objects.get_or_create(name=target_name)
    current = set(instance.groups.values_list("name", flat=True))

    stale = (current & _ROLE_GROUP_NAMES) - {target_name}
    if stale:
        instance.groups.remove(*Group.objects.filter(name__in=stale))
    if target_name not in current:
        instance.groups.add(group)
