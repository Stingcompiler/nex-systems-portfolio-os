from django_q.tasks import async_task
from rest_framework import serializers

from apps.core.fields import TranslatedField
from apps.media_library.models import MediaFile, MediaFolder
from apps.media_library.validators import UploadError, validate_upload


class MediaFolderSerializer(serializers.ModelSerializer):
    path = serializers.CharField(read_only=True)
    file_count = serializers.IntegerField(source="files.count", read_only=True)

    class Meta:
        model = MediaFolder
        fields = ["id", "name", "parent", "path", "file_count", "created_at"]
        read_only_fields = ["id", "path", "file_count", "created_at"]


class MediaFileRefSerializer(serializers.ModelSerializer):
    """التمثيل المختصر المستخدم داخل بقية المحتوى (صور الخدمات والمشاريع)."""

    url = serializers.SerializerMethodField()
    thumbnail_url = serializers.SerializerMethodField()
    alt = TranslatedField()

    class Meta:
        model = MediaFile
        fields = ["id", "url", "thumbnail_url", "alt", "width", "height"]

    def get_url(self, media: MediaFile) -> str:
        return self._absolute(media.display_url)

    def get_thumbnail_url(self, media: MediaFile) -> str:
        return self._absolute(media.thumbnail.url if media.thumbnail else media.display_url)

    def _absolute(self, url: str) -> str:
        request = self.context.get("request")
        return request.build_absolute_uri(url) if request and url else url


class MediaFileSerializer(MediaFileRefSerializer):
    """التمثيل الكامل داخل لوحة التحكم."""

    title = TranslatedField()
    folder_path = serializers.CharField(source="folder.path", read_only=True, default="")

    class Meta(MediaFileRefSerializer.Meta):
        fields = MediaFileRefSerializer.Meta.fields + [
            "title",
            "title_ar",
            "title_en",
            "alt_ar",
            "alt_en",
            "folder",
            "folder_path",
            "file_type",
            "original_name",
            "mime_type",
            "size",
            "usage_count",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "file_type",
            "original_name",
            "mime_type",
            "size",
            "width",
            "height",
            "usage_count",
            "created_at",
        ]


class MediaUploadSerializer(serializers.ModelSerializer):
    file = serializers.FileField(write_only=True)

    class Meta:
        model = MediaFile
        fields = ["file", "folder", "title_ar", "title_en", "alt_ar", "alt_en"]

    def validate_file(self, uploaded):
        try:
            file_type = validate_upload(uploaded)
        except UploadError as exc:
            raise serializers.ValidationError(exc.messages)
        self.context["detected_type"] = file_type
        return uploaded

    def create(self, validated_data):
        uploaded = validated_data["file"]
        request = self.context.get("request")

        media = MediaFile(
            file_type=self.context.get("detected_type", MediaFile.FileType.IMAGE),
            original_name=uploaded.name[:255],
            mime_type=(getattr(uploaded, "content_type", "") or "")[:120],
            size=uploaded.size,
            folder=validated_data.get("folder"),
            title_ar=validated_data.get("title_ar", ""),
            title_en=validated_data.get("title_en", ""),
            alt_ar=validated_data.get("alt_ar", ""),
            alt_en=validated_data.get("alt_en", ""),
            uploaded_by=request.user if request and request.user.is_authenticated else None,
        )
        # الحفظ أولًا كي يعتمد مسار الرفع على file_type المحدَّد
        media.file = uploaded
        media.save()

        if media.is_image:
            try:
                async_task("apps.media_library.tasks.process_media_image", media.pk)
            except Exception:  # noqa: BLE001
                pass  # فشل الجدولة لا يُبطل الرفع

        return media

    def to_representation(self, instance):
        return MediaFileSerializer(instance, context=self.context).data
