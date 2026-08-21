import uuid
from pathlib import Path

from django.conf import settings
from django.db import models
from django.utils import timezone

from apps.core.models.base import TimeStampedModel, TranslatableMixin


def media_upload_path(instance, filename: str) -> str:
    """اسم مُولَّد لا علاقة له بالاسم الأصلي.

    يمنع تخمين المسارات، والكتابة فوق ملف قائم، وتنفيذ ملف باسم مُلفَّق
    مثل `report.pdf.php`.
    """
    extension = Path(filename).suffix.lower()[:10]
    stamp = timezone.now().strftime("%Y/%m")
    kind = getattr(instance, "file_type", "other") or "other"
    return f"library/{kind}/{stamp}/{uuid.uuid4().hex}{extension}"


class MediaFolder(TimeStampedModel):
    name = models.CharField("الاسم", max_length=120, blank=True)
    parent = models.ForeignKey(
        "self",
        verbose_name="المجلد الأعلى",
        related_name="children",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="media_folders",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
    )

    class Meta:
        verbose_name = "مجلد وسائط"
        verbose_name_plural = "مجلدات الوسائط"
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(
                fields=["parent", "name"], name="unique_folder_name_per_parent"
            )
        ]

    def __str__(self):
        return self.path

    @property
    def path(self) -> str:
        parts = [self.name]
        node = self.parent
        depth = 0
        while node is not None and depth < 10:
            parts.append(node.name)
            node = node.parent
            depth += 1
        return "/".join(reversed(parts))


class MediaFile(TranslatableMixin, TimeStampedModel):
    class FileType(models.TextChoices):
        IMAGE = "image", "صورة"
        DOCUMENT = "document", "مستند"
        ARCHIVE = "archive", "أرشيف"
        VIDEO = "video", "فيديو"

    translatable_fields = ("title", "alt")

    folder = models.ForeignKey(
        MediaFolder,
        verbose_name="المجلد",
        related_name="files",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
    )
    file = models.FileField("الملف", upload_to=media_upload_path)
    file_type = models.CharField(
        "النوع", max_length=16, choices=FileType.choices, default=FileType.IMAGE, db_index=True
    )
    original_name = models.CharField("الاسم الأصلي", max_length=255, blank=True)
    mime_type = models.CharField("نوع المحتوى", max_length=120, blank=True)
    size = models.PositiveIntegerField("الحجم بالبايت", default=0)

    width = models.PositiveIntegerField("العرض", null=True, blank=True)
    height = models.PositiveIntegerField("الارتفاع", null=True, blank=True)
    thumbnail = models.ImageField(
        "المصغّرة", upload_to="library/thumbs/%Y/%m/", null=True, blank=True
    )
    webp_version = models.FileField(
        "نسخة WebP", upload_to="library/webp/%Y/%m/", null=True, blank=True
    )

    title_ar = models.CharField("العنوان (عربي)", max_length=200, blank=True)
    title_en = models.CharField("العنوان (إنجليزي)", max_length=200, blank=True)
    alt_ar = models.CharField("النص البديل (عربي)", max_length=255, blank=True)
    alt_en = models.CharField("النص البديل (إنجليزي)", max_length=255, blank=True)

    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name="رفعه",
        related_name="media_files",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
    )
    usage_count = models.PositiveIntegerField("مرات الاستخدام", default=0, editable=False)

    class Meta:
        verbose_name = "ملف وسائط"
        verbose_name_plural = "ملفات الوسائط"
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["file_type", "-created_at"])]

    def __str__(self):
        return self.tr("title") or self.original_name

    @property
    def is_image(self) -> bool:
        return self.file_type == self.FileType.IMAGE

    @property
    def display_url(self) -> str:
        """يفضّل نسخة WebP عند توفرها."""
        if self.webp_version:
            return self.webp_version.url
        return self.file.url if self.file else ""
