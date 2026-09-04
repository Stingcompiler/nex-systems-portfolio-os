"""يعيد تسمية الموقع في قاعدة البيانات.

الاسم المعروض يأتي من `SiteSettings` لا من الشيفرة، فتغيير الثوابت في
المستودع لا يمسّ موقعًا يعمل بالفعل. هذا الأمر يطبّق التسمية على قاعدة
الإنتاج مرة واحدة بدل تحرير كل حقل يدويًا من اللوحة.

    python manage.py rename_site --from "NEXA SYSTEMS" --to "StingSystem" \
        --from-ar "نيكسا سيستمز" --to-ar "ستينج سيستم"
"""

from django.core.management.base import BaseCommand
from django.db import transaction

from apps.core.models.settings import SEOSettings, SiteSettings

#: الحقول النصية التي قد تحمل الاسم القديم
_SEO_FIELDS = (
    "default_seo_title_ar",
    "default_seo_title_en",
    "default_seo_description_ar",
    "default_seo_description_en",
)


class Command(BaseCommand):
    help = "يستبدل اسم الموقع في الإعدادات وإعدادات SEO"

    def add_arguments(self, parser):
        parser.add_argument("--from", dest="old_en", required=True)
        parser.add_argument("--to", dest="new_en", required=True)
        parser.add_argument("--from-ar", dest="old_ar", default="")
        parser.add_argument("--to-ar", dest="new_ar", default="")
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="يعرض ما سيتغيّر دون الحفظ",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        old_en, new_en = options["old_en"], options["new_en"]
        old_ar, new_ar = options["old_ar"], options["new_ar"]
        dry = options["dry_run"]

        def swap(value: str) -> str:
            if not value:
                return value
            value = value.replace(old_en, new_en)
            if old_ar:
                value = value.replace(old_ar, new_ar)
            return value

        changes: list[tuple[str, str, str]] = []

        site = SiteSettings.load()
        # الاسم يُضبط صراحةً لا بالاستبدال: قد يكون مختلفًا تمامًا عن القديم
        for field, new in (("site_name_en", new_en), ("site_name_ar", new_ar or new_en)):
            current = getattr(site, field)
            if current != new:
                changes.append((f"SiteSettings.{field}", current, new))
                setattr(site, field, new)

        for field in ("tagline_ar", "tagline_en", "whatsapp_default_message_ar",
                      "whatsapp_default_message_en"):
            current = getattr(site, field, "")
            updated = swap(current)
            if updated != current:
                changes.append((f"SiteSettings.{field}", current, updated))
                setattr(site, field, updated)

        seo = SEOSettings.load()
        for field in _SEO_FIELDS:
            current = getattr(seo, field, "")
            updated = swap(current)
            if updated != current:
                changes.append((f"SEOSettings.{field}", current, updated))
                setattr(seo, field, updated)

        if not changes:
            self.stdout.write("لا شيء ليتغيّر — الاسم مطبَّق بالفعل")
            return

        for name, before, after in changes:
            self.stdout.write(f"  {name}\n    - {before[:70]}\n    + {after[:70]}")

        if dry:
            self.stdout.write(self.style.WARNING("\nتجربة فقط — لم يُحفظ شيء"))
            transaction.set_rollback(True)
            return

        site.save()
        seo.save()
        self.stdout.write(self.style.SUCCESS(f"\nحُدّث {len(changes)} حقلًا"))
