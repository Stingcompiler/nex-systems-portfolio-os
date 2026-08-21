from rest_framework import serializers

from apps.core.fields import TranslatedField
from apps.notifications.models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    title = TranslatedField()
    message = TranslatedField()
    type_display = serializers.CharField(source="get_type_display", read_only=True)

    class Meta:
        model = Notification
        fields = [
            "id",
            "type",
            "type_display",
            "title",
            "message",
            "link",
            "model_name",
            "object_id",
            "is_read",
            "read_at",
            "created_at",
        ]
        read_only_fields = fields


class UnreadCountSerializer(serializers.Serializer):
    unread = serializers.IntegerField(read_only=True)


class MarkedSerializer(serializers.Serializer):
    detail = serializers.CharField(read_only=True)
    marked = serializers.IntegerField(read_only=True)
