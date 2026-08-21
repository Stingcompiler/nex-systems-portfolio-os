"""ينشئ مجموعات الأدوار ويسند إليها صلاحياتها، ويجدول المهام الدورية.

أمر متكرر التنفيذ (idempotent): يُعاد تشغيله بعد كل مرحلة تضيف تطبيقات
جديدة، فيلتقط الصلاحيات التي لم تكن موجودة من قبل.
"""

from django.contrib.auth.models import Group, Permission
from django.core.management.base import BaseCommand
from django.db import transaction

#: المهام الدورية للمنصة — تُنشأ في جدول django-q عند التشغيل مع qcluster
#: (المسار، نوع الجدولة, الاسم, دقائق) — الدقائق تلزم نوع "I" فقط
SCHEDULED_TASKS = [
    ("apps.accounts.tasks.cleanup_expired_tokens", "D", "تنظيف الرموز المنتهية", None),
    ("apps.crm.tasks.remind_due_follow_ups", "H", "تذكير مواعيد المتابعة", None),
    ("apps.crm.tasks.mark_missed_follow_ups", "D", "تعليم المتابعات الفائتة", None),
    ("apps.blog.tasks.publish_scheduled_posts", "I", "نشر المقالات المجدولة", 5),
    ("apps.analytics.tasks.aggregate_daily_stats", "D", "تجميع إحصائيات الزيارات", None),
    ("apps.analytics.tasks.prune_old_page_views", "D", "تقليم مشاهدات قديمة", None),
]

from apps.accounts.roles import GROUP_NAMES, ROLE_PERMISSIONS


class Command(BaseCommand):
    help = "إنشاء مجموعات الأدوار وإسناد الصلاحيات إليها"

    def add_arguments(self, parser):
        parser.add_argument(
            "--prune",
            action="store_true",
            help="إزالة الصلاحيات غير المذكورة في التعريف بدل الاكتفاء بالإضافة",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        prune = options["prune"]
        all_permissions = list(Permission.objects.select_related("content_type"))
        by_label = {
            f"{perm.content_type.app_label}.{perm.codename}": perm
            for perm in all_permissions
        }

        missing_total: set[str] = set()

        for role, group_name in GROUP_NAMES.items():
            group, created = Group.objects.get_or_create(name=group_name)
            specs = ROLE_PERMISSIONS.get(role, [])
            resolved, missing = self._resolve(specs, all_permissions, by_label)
            missing_total |= missing

            if prune:
                group.permissions.set(resolved)
            elif resolved:
                group.permissions.add(*resolved)

            state = "أُنشئت" if created else "حُدّثت"
            self.stdout.write(
                f"  {state}: {group_name:<20} — {len(resolved)} صلاحية"
            )

        if missing_total:
            self.stdout.write(
                self.style.WARNING(
                    "\nصلاحيات غير موجودة بعد (تطبيقات لم تُبنَ في هذه المرحلة):"
                )
            )
            for label in sorted(missing_total):
                self.stdout.write(f"  - {label}")
            self.stdout.write(
                self.style.WARNING(
                    "أعد تشغيل `seed_groups` بعد إضافة تلك التطبيقات."
                )
            )

        self._schedule_tasks()
        self.stdout.write(self.style.SUCCESS("\nاكتمل ضبط المجموعات والصلاحيات."))

    def _schedule_tasks(self):
        """يسجّل المهام الدورية في جدول django-q (متكرر التنفيذ)."""
        try:
            from django_q.models import Schedule
        except Exception:  # noqa: BLE001
            return

        for func, schedule_type, name, minutes in SCHEDULED_TASKS:
            defaults = {"name": name, "schedule_type": schedule_type, "repeats": -1}
            if minutes is not None:
                defaults["minutes"] = minutes
            Schedule.objects.get_or_create(func=func, defaults=defaults)

    @staticmethod
    def _resolve(specs, all_permissions, by_label):
        """يحوّل قائمة المواصفات إلى كائنات Permission فعلية."""
        resolved: list[Permission] = []
        missing: set[str] = set()

        for spec in specs:
            if spec == "*":
                return list(all_permissions), missing

            if spec.endswith(".*"):
                app_label = spec[:-2]
                matches = [
                    perm
                    for perm in all_permissions
                    if perm.content_type.app_label == app_label
                ]
                if matches:
                    resolved.extend(matches)
                else:
                    missing.add(spec)
                continue

            permission = by_label.get(spec)
            if permission is not None:
                resolved.append(permission)
            else:
                missing.add(spec)

        # إزالة التكرار مع الحفاظ على الترتيب
        seen: set[int] = set()
        unique = []
        for perm in resolved:
            if perm.pk not in seen:
                seen.add(perm.pk)
                unique.append(perm)
        return unique, missing
