from django.utils import timezone
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import mixins, serializers, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

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


class IsDashboardUser(IsAuthenticated):
    """إشعارات المتصفح لفريق اللوحة فقط — لا للأعضاء والعملاء."""

    def has_permission(self, request, view):
        return super().has_permission(request, view) and bool(
            getattr(request.user, "is_dashboard_user", False)
        )


class PushSubscribeSerializer(serializers.Serializer):
    endpoint = serializers.URLField(max_length=600)
    keys = serializers.DictField(child=serializers.CharField(max_length=200))

    def validate_endpoint(self, value):
        # عناوين خدمات إشعارات المتصفحات عبر HTTPS فقط
        if not value.startswith("https://"):
            raise serializers.ValidationError("عنوان اشتراك غير صالح")
        return value

    def validate_keys(self, value):
        if not value.get("p256dh") or not value.get("auth"):
            raise serializers.ValidationError("مفاتيح الاشتراك ناقصة")
        return value


class PushKeyView(APIView):
    permission_classes = [IsDashboardUser]

    @extend_schema(summary="المفتاح العام لإشعارات المتصفح")
    def get(self, request):
        from apps.notifications.models import PushKeys, PushSubscription

        return Response({
            "public_key": PushKeys.load().public_key,
            "devices": PushSubscription.objects.filter(user=request.user).count(),
        })


class PushSubscribeView(APIView):
    permission_classes = [IsDashboardUser]

    @extend_schema(summary="تفعيل إشعارات المتصفح على هذا الجهاز", request=PushSubscribeSerializer)
    def post(self, request):
        from apps.notifications.models import PushSubscription

        serializer = PushSubscribeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        # الجهاز نفسه قد ينتقل بين حسابين: الاشتراك لآخر من سجّل منه
        PushSubscription.objects.update_or_create(
            endpoint=data["endpoint"],
            defaults={
                "user": request.user,
                "p256dh": data["keys"]["p256dh"],
                "auth": data["keys"]["auth"],
                "user_agent": request.headers.get("User-Agent", "")[:200],
            },
        )
        return Response({"detail": "فُعّلت الإشعارات على هذا الجهاز"}, status=201)


class PushUnsubscribeView(APIView):
    permission_classes = [IsDashboardUser]

    @extend_schema(summary="إيقاف إشعارات المتصفح على هذا الجهاز")
    def post(self, request):
        from apps.notifications.models import PushSubscription

        endpoint = str(request.data.get("endpoint") or "")
        PushSubscription.objects.filter(user=request.user, endpoint=endpoint).delete()
        return Response({"detail": "أُوقفت الإشعارات على هذا الجهاز"})


class PushTestView(APIView):
    permission_classes = [IsDashboardUser]

    @extend_schema(summary="إرسال إشعار تجريبي إلى أجهزتي")
    def post(self, request):
        from apps.notifications.push import send_to_user

        sent = send_to_user(
            request.user,
            {
                "title": "إشعار تجريبي من ستينج سيستم",
                "body": "الإشعارات تعمل على هذا الجهاز. ستصلك هنا الطلبات الجديدة.",
                "url": "/dashboard",
                "tag": "push-test",
            },
        )
        return Response({"sent": sent})
