"""إعادة معالجة صور المكتبة التي لم تُعالَج (لا أبعاد أو لا نسخة WebP).

الإنتاج عمل مدة بلا عامل خلفي، فتراكمت صور خام. يُشغَّل مرة بعد النشر:

    python manage.py process_media            # الصور غير المعالجة فقط
    python manage.py process_media --all      # كل الصور
"""

from django.core.management.base import BaseCommand
from django.db.models import Q

from apps.media_library.models import MediaFile
from apps.media_library.tasks import process_media_image


class Command(BaseCommand):
    help = "يولّد الأبعاد والمصغّرة ونسخة WebP لصور المكتبة"

    def add_arguments(self, parser):
        parser.add_argument("--all", action="store_true", help="أعد معالجة كل الصور لا الناقصة فقط")

    def handle(self, *args, **options):
        queryset = MediaFile.objects.filter(file_type=MediaFile.FileType.IMAGE).exclude(
            file__iendswith=".svg"
        )
        if not options["all"]:
            queryset = queryset.filter(Q(webp_version="") | Q(webp_version__isnull=True) | Q(width__isnull=True))

        total = queryset.count()
        done = 0
        for media in queryset.iterator():
            before = media.size
            if process_media_image(media.pk):
                media.refresh_from_db()
                after = media.webp_version.size if media.webp_version else before
                done += 1
                self.stdout.write(
                    f"  ✓ {media.original_name or media.file.name}: "
                    f"{before // 1024}KB → {after // 1024}KB"
                )
            else:
                self.stdout.write(self.style.WARNING(f"  ✗ {media.original_name or media.file.name}"))

        self.stdout.write(self.style.SUCCESS(f"عولجت {done} من {total} صورة."))
