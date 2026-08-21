"""معالجة الصور في الخلفية: الأبعاد، المصغّرة، ونسخة WebP."""

import logging
from io import BytesIO
from pathlib import Path

from django.core.files.base import ContentFile

logger = logging.getLogger(__name__)

THUMBNAIL_MAX = (480, 480)
WEBP_MAX_WIDTH = 1920
WEBP_QUALITY = 82

#: الصيغ التي تستفيد من التحويل — SVG متجهية وGIF قد يكون متحركًا
_CONVERTIBLE = {".jpg", ".jpeg", ".png", ".webp", ".avif"}


def process_media_image(media_id: int) -> bool:
    """يملأ الأبعاد ويولّد المصغّرة ونسخة WebP. لا يرفع استثناء."""
    from apps.media_library.models import MediaFile

    media = MediaFile.objects.filter(pk=media_id).first()
    if media is None or not media.is_image or not media.file:
        return False

    extension = Path(media.file.name).suffix.lower()
    if extension == ".svg":
        return True  # المتجهات لا تحتاج معالجة

    try:
        from PIL import Image, ImageOps
    except ImportError:  # pragma: no cover
        logger.warning("Pillow غير مثبّت — تخطّي معالجة الصور")
        return False

    try:
        media.file.open("rb")
        with Image.open(media.file) as image:
            image = ImageOps.exif_transpose(image)
            media.width, media.height = image.size

            updates = ["width", "height", "updated_at"]

            if extension in _CONVERTIBLE:
                if _save_webp(media, image):
                    updates.append("webp_version")
                if _save_thumbnail(media, image):
                    updates.append("thumbnail")

            media.save(update_fields=updates)
        return True
    except Exception:  # noqa: BLE001
        logger.exception("فشلت معالجة الصورة %s", media_id)
        return False
    finally:
        media.file.close()


def _prepare(image):
    """يحوّل إلى RGB مع خلفية بيضاء عند وجود شفافية."""
    from PIL import Image

    if image.mode in ("RGBA", "LA", "P"):
        converted = image.convert("RGBA")
        background = Image.new("RGB", converted.size, (255, 255, 255))
        background.paste(converted, mask=converted.split()[-1])
        return background
    return image.convert("RGB")


def _save_webp(media, image) -> bool:
    prepared = _prepare(image.copy())
    if prepared.width > WEBP_MAX_WIDTH:
        ratio = WEBP_MAX_WIDTH / prepared.width
        prepared = prepared.resize(
            (WEBP_MAX_WIDTH, int(prepared.height * ratio)), _resample()
        )

    buffer = BytesIO()
    prepared.save(buffer, format="WEBP", quality=WEBP_QUALITY, method=4)
    stem = Path(media.file.name).stem
    media.webp_version.save(f"{stem}.webp", ContentFile(buffer.getvalue()), save=False)
    return True


def _save_thumbnail(media, image) -> bool:
    prepared = _prepare(image.copy())
    prepared.thumbnail(THUMBNAIL_MAX, _resample())

    buffer = BytesIO()
    prepared.save(buffer, format="WEBP", quality=75, method=4)
    stem = Path(media.file.name).stem
    media.thumbnail.save(f"{stem}-thumb.webp", ContentFile(buffer.getvalue()), save=False)
    return True


def _resample():
    from PIL import Image

    return getattr(Image, "Resampling", Image).LANCZOS
