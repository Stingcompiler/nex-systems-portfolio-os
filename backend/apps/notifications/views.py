from django.utils import timezone
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.core.pagination import LargePagination
from apps.notifications.models import Notification
from apps.notifications.serializers import (
    MarkedSerializer,
    NotificationSerializer,
    UnreadCountSerializer,
)


@extend_schema_view(
    list=extend_schema(summary="إشعارات المستخدم الحالي"),
    retrieve=extend_schema(summary="تفاصيل إشعار"),
    destroy=extend_schema(summary="حذف إشعار"),
)
class NotificationViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = LargePagination
    filterset_fields = ["is_read", "type"]
    ordering_fields = ["created_at"]

    def get_queryset(self):
        # الفلترة على مستوى الاستعلام — لا يمكن لأي مستخدم رؤية إشعارات غيره
        return Notification.visible_to(self.request.user)

    @extend_schema(summary="عدد الإشعارات غير المقروءة", responses={200: UnreadCountSerializer})
    @action(detail=False, methods=["get"], url_path="unread-count")
    def unread_count(self, request):
        count = self.get_queryset().filter(is_read=False).count()
        return Response({"unread": count})

    @extend_schema(summary="تعليم إشعار كمقروء", request=None, responses={200: NotificationSerializer})
    @action(detail=True, methods=["post"], url_path="read")
    def read(self, request, pk=None):
        notification = self.get_object()
        notification.mark_read()
        return Response(NotificationSerializer(notification, context={"request": request}).data)

    @extend_schema(summary="تعليم الكل كمقروء", request=None, responses={200: MarkedSerializer})
    @action(detail=False, methods=["post"], url_path="read-all")
    def read_all(self, request):
        marked = self.get_queryset().filter(is_read=False).update(
            is_read=True, read_at=timezone.now()
        )
        return Response({"detail": "تم تعليم الكل كمقروء", "marked": marked})
