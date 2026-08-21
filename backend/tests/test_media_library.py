"""اختبارات مكتبة الوسائط: التحقق من الملفات والمعالجة والصلاحيات."""

from io import BytesIO

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command

from apps.media_library.models import MediaFile

pytestmark = pytest.mark.django_db

UPLOAD_URL = "/api/v1/media/upload/"
MEDIA_URL = "/api/v1/media/"


def make_png(size: tuple[int, int] = (64, 48)) -> bytes:
    from PIL import Image

    buffer = BytesIO()
    Image.new("RGB", size, (37, 99, 235)).save(buffer, format="PNG")
    return buffer.getvalue()


@pytest.fixture
def manager(db, make_user):
    call_command("seed_groups", verbosity=0)
    return make_user(email="media@example.com", role="content_manager")


@pytest.fixture
def manager_client(api_client, manager):
    response = api_client.post(
        "/api/v1/auth/login/",
        {"email": manager.email, "password": manager.raw_password},
        format="json",
    )
    assert response.status_code == 200
    return api_client


# --------------------------------------------------------------- الرفع الصحيح


def test_uploading_a_valid_image_succeeds(manager_client):
    upload = SimpleUploadedFile("logo.png", make_png(), content_type="image/png")

    response = manager_client.post(
        UPLOAD_URL, {"file": upload, "alt_ar": "شعار", "alt_en": "Logo"}, format="multipart"
    )

    assert response.status_code == 201, response.data
    media = MediaFile.objects.get()
    assert media.file_type == "image"
    assert media.original_name == "logo.png"
    assert media.size > 0
    assert media.alt_ar == "شعار"


def test_stored_filename_is_generated_not_user_supplied(manager_client):
    upload = SimpleUploadedFile("../../evil name.png", make_png(), content_type="image/png")

    manager_client.post(UPLOAD_URL, {"file": upload}, format="multipart")

    media = MediaFile.objects.get()
    assert "evil" not in media.file.name
    assert ".." not in media.file.name
    assert media.file.name.endswith(".png")


def test_image_processing_fills_dimensions_and_derivatives(manager_client):
    upload = SimpleUploadedFile("photo.png", make_png((200, 120)), content_type="image/png")

    manager_client.post(UPLOAD_URL, {"file": upload}, format="multipart")

    media = MediaFile.objects.get()
    assert media.width == 200
    assert media.height == 120
    assert media.webp_version, "يجب توليد نسخة WebP"
    assert media.thumbnail, "يجب توليد مصغّرة"


def test_alt_text_follows_the_request_language(manager_client):
    upload = SimpleUploadedFile("x.png", make_png(), content_type="image/png")
    manager_client.post(
        UPLOAD_URL, {"file": upload, "alt_ar": "صورة", "alt_en": "Picture"}, format="multipart"
    )

    arabic = manager_client.get(MEDIA_URL, HTTP_ACCEPT_LANGUAGE="ar")
    english = manager_client.get(MEDIA_URL, HTTP_ACCEPT_LANGUAGE="en")

    assert arabic.data["results"][0]["alt"] == "صورة"
    assert english.data["results"][0]["alt"] == "Picture"


# --------------------------------------------------------------- الرفض الأمني


def test_extension_that_lies_about_content_is_rejected(manager_client):
    """ملف تنفيذي يتنكر بامتداد صورة."""
    upload = SimpleUploadedFile(
        "payload.png", b"MZ\x90\x00\x03\x00\x00\x00fake-exe", content_type="image/png"
    )

    response = manager_client.post(UPLOAD_URL, {"file": upload}, format="multipart")

    assert response.status_code == 400
    assert MediaFile.objects.count() == 0


def test_disallowed_extension_is_rejected(manager_client):
    upload = SimpleUploadedFile("script.php", b"<?php echo 1; ?>", content_type="text/plain")

    response = manager_client.post(UPLOAD_URL, {"file": upload}, format="multipart")

    assert response.status_code == 400
    assert "php" in str(response.data["errors"]) or "php" in response.data["detail"]


def test_svg_with_embedded_script_is_rejected(manager_client):
    malicious = b'<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'
    upload = SimpleUploadedFile("icon.svg", malicious, content_type="image/svg+xml")

    response = manager_client.post(UPLOAD_URL, {"file": upload}, format="multipart")

    assert response.status_code == 400
    assert MediaFile.objects.count() == 0


def test_svg_with_event_handler_is_rejected(manager_client):
    malicious = b'<svg xmlns="http://www.w3.org/2000/svg"><rect onload="alert(1)"/></svg>'
    upload = SimpleUploadedFile("icon.svg", malicious, content_type="image/svg+xml")

    assert manager_client.post(UPLOAD_URL, {"file": upload}, format="multipart").status_code == 400


def test_clean_svg_is_accepted(manager_client):
    clean = b'<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>'
    upload = SimpleUploadedFile("shape.svg", clean, content_type="image/svg+xml")

    response = manager_client.post(UPLOAD_URL, {"file": upload}, format="multipart")

    assert response.status_code == 201
    assert MediaFile.objects.get().file_type == "image"


def test_oversized_file_is_rejected(manager_client, settings):
    settings.MAX_UPLOAD_SIZE_MB = 1
    big = SimpleUploadedFile("big.pdf", b"%PDF" + b"0" * (2 * 1024 * 1024), "application/pdf")

    response = manager_client.post(UPLOAD_URL, {"file": big}, format="multipart")

    assert response.status_code == 400
    assert "ميغابايت" in str(response.data)


# --------------------------------------------------------------- الصلاحيات


def test_anonymous_visitors_cannot_upload(api_client):
    upload = SimpleUploadedFile("logo.png", make_png(), content_type="image/png")

    response = api_client.post(UPLOAD_URL, {"file": upload}, format="multipart")
    assert response.status_code in (401, 403)


def test_plain_members_cannot_browse_the_library(api_client, make_user):
    member = make_user(email="member2@example.com", role="member")
    api_client.post(
        "/api/v1/auth/login/",
        {"email": member.email, "password": member.raw_password},
        format="json",
    )

    assert api_client.get(MEDIA_URL).status_code == 403


# --------------------------------------------------------------- الحذف


def test_deleting_a_file_in_use_requires_confirmation(manager_client):
    upload = SimpleUploadedFile("used.png", make_png(), content_type="image/png")
    manager_client.post(UPLOAD_URL, {"file": upload}, format="multipart")

    media = MediaFile.objects.get()
    MediaFile.objects.filter(pk=media.pk).update(usage_count=3)

    blocked = manager_client.delete(f"{MEDIA_URL}{media.pk}/")
    assert blocked.status_code == 409
    assert MediaFile.objects.filter(pk=media.pk).exists()

    forced = manager_client.delete(f"{MEDIA_URL}{media.pk}/?force=true")
    assert forced.status_code == 204
    assert not MediaFile.objects.filter(pk=media.pk).exists()


def test_unused_file_deletes_directly(manager_client):
    upload = SimpleUploadedFile("unused.png", make_png(), content_type="image/png")
    manager_client.post(UPLOAD_URL, {"file": upload}, format="multipart")
    media = MediaFile.objects.get()

    assert manager_client.delete(f"{MEDIA_URL}{media.pk}/").status_code == 204


def test_plain_post_to_the_collection_is_not_allowed(manager_client):
    response = manager_client.post(MEDIA_URL, {}, format="multipart")
    assert response.status_code == 405
