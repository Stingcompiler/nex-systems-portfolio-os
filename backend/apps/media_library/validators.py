"""التحقق من الملفات المرفوعة.

القاعدة: لا نثق بالامتداد ولا بترويسة `Content-Type` — كلاهما يتحكم فيه
المُرسِل. نتحقق من البايتات الأولى للملف نفسه.
"""

import re

from django.conf import settings
from django.core.exceptions import ValidationError

#: الامتدادات المسموحة مصنّفة حسب النوع
ALLOWED_EXTENSIONS: dict[str, set[str]] = {
    "image": {"jpg", "jpeg", "png", "webp", "avif", "gif", "svg"},
    "document": {"pdf", "doc", "docx", "xls", "xlsx", "csv", "txt"},
    "archive": {"zip"},
    "video": {"mp4", "webm"},
}

#: الحد الأقصى للحجم بالميغابايت لكل نوع
MAX_SIZE_MB: dict[str, int] = {
    "image": 5,
    "document": 10,
    "archive": 20,
    "video": 50,
}

#: توقيعات البايتات الأولى (magic bytes)
_SIGNATURES: list[tuple[bytes, set[str]]] = [
    (b"\xff\xd8\xff", {"jpg", "jpeg"}),
    (b"\x89PNG\r\n\x1a\n", {"png"}),
    (b"GIF87a", {"gif"}),
    (b"GIF89a", {"gif"}),
    (b"%PDF", {"pdf"}),
    (b"PK\x03\x04", {"zip", "docx", "xlsx"}),
    (b"\xd0\xcf\x11\xe0", {"doc", "xls"}),
]

_SVG_DANGEROUS = re.compile(
    rb"<\s*script|on[a-z]+\s*=|javascript:|<\s*foreignObject|<\s*iframe", re.IGNORECASE
)

#: امتدادات لا يمكن التحقق منها بتوقيع ثابت
_SIGNATURE_EXEMPT = {"svg", "csv", "txt", "webp", "avif", "webm", "mp4"}


class UploadError(ValidationError):
    pass


def get_extension(filename: str) -> str:
    return filename.rsplit(".", 1)[-1].lower() if "." in filename else ""


def get_file_type(extension: str) -> str | None:
    for file_type, extensions in ALLOWED_EXTENSIONS.items():
        if extension in extensions:
            return file_type
    return None


def validate_upload(uploaded_file) -> str:
    """يتحقق من الملف ويعيد نوعه (`image` / `document` / ...).

    يرفع `UploadError` عند أي مخالفة.
    """
    name = uploaded_file.name or ""
    extension = get_extension(name)

    if not extension:
        raise UploadError("الملف بلا امتداد معروف")

    file_type = get_file_type(extension)
    if file_type is None:
        allowed = ", ".join(sorted(e for group in ALLOWED_EXTENSIONS.values() for e in group))
        raise UploadError(f"نوع الملف «{extension}» غير مسموح. المسموح: {allowed}")

    _validate_size(uploaded_file, file_type)

    header = _read_header(uploaded_file)
    _validate_signature(extension, file_type, header)

    if extension == "svg":
        _validate_svg(uploaded_file)

    return file_type


def _validate_size(uploaded_file, file_type: str) -> None:
    limit_mb = min(
        MAX_SIZE_MB.get(file_type, 10),
        getattr(settings, "MAX_UPLOAD_SIZE_MB", 10) if file_type != "video" else MAX_SIZE_MB["video"],
    )
    limit_bytes = limit_mb * 1024 * 1024
    if uploaded_file.size > limit_bytes:
        actual = uploaded_file.size / (1024 * 1024)
        raise UploadError(
            f"حجم الملف {actual:.1f} ميغابايت يتجاوز الحد المسموح ({limit_mb} ميغابايت)"
        )


def _read_header(uploaded_file, length: int = 16) -> bytes:
    position = uploaded_file.tell()
    uploaded_file.seek(0)
    header = uploaded_file.read(length)
    uploaded_file.seek(position)
    return header or b""


def _validate_signature(extension: str, file_type: str, header: bytes) -> None:
    if extension in _SIGNATURE_EXEMPT:
        # هذه الصيغ تُتحقق بطرق أخرى (SVG بالمحتوى، الصور الحديثة بـ Pillow).
        if file_type == "image" and extension in {"webp", "avif"}:
            _validate_container(extension, header)
        return

    for signature, extensions in _SIGNATURES:
        if header.startswith(signature):
            if extension in extensions:
                return
            raise UploadError(
                f"محتوى الملف لا يطابق امتداده «{extension}» — رُفض لأسباب أمنية"
            )

    raise UploadError("تعذّر التعرّف على محتوى الملف — رُفض لأسباب أمنية")


def _validate_container(extension: str, header: bytes) -> None:
    if extension == "webp" and not (header.startswith(b"RIFF") and header[8:12] == b"WEBP"):
        raise UploadError("الملف ليس بصيغة WebP صالحة")
    if extension == "avif" and b"ftyp" not in header[:12]:
        raise UploadError("الملف ليس بصيغة AVIF صالحة")


def _validate_svg(uploaded_file) -> None:
    position = uploaded_file.tell()
    uploaded_file.seek(0)
    content = uploaded_file.read(512 * 1024)
    uploaded_file.seek(position)

    if b"<svg" not in content.lower():
        raise UploadError("الملف ليس SVG صالحًا")
    if _SVG_DANGEROUS.search(content):
        raise UploadError(
            "ملف SVG يحتوي على شيفرة قابلة للتنفيذ — رُفض لأسباب أمنية"
        )
