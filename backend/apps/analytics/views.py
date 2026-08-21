from datetime import timedelta

from django.db.models import Count
from django.utils import timezone
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework import serializers, status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.analytics.models import PageView
from apps.analytics.utils import (
    anonymous_session_hash,
    classify_path,
    device_from_user_agent,
    referrer_domain,
)
from apps.core.audit import get_client_ip, get_user_agent
from apps.core.permissions import HasDashboardPermission
from apps.core.throttling import AnonWriteThrottle


class PageViewBeaconSerializer(serializers.Serializer):
    path = serializers.CharField(max_length=300)
    locale = serializers.CharField(max_length=5, required=False, allow_blank=True)
    referrer = serializers.CharField(required=False, allow_blank=True)


class PageViewBeaconView(APIView):
    """يستقبل إشارة مشاهدة صفحة من العميل.

    العدّ من الخادم مستحيل مع الصفحات المولّدة ثابتًا. كل الاشتقاقات
    (الجهاز، المصدر، البصمة) تتم هنا من ترويسات الطلب، فلا يرسل العميل
    أي بيانات حساسة، ولا يُخزَّن IP خام.
    """

    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [AnonWriteThrottle]
    serializer_class = PageViewBeaconSerializer

    @extend_schema(summary="تسجيل مشاهدة صفحة", request=PageViewBeaconSerializer,
                   responses={202: None})
    def post(self, request):
        serializer = PageViewBeaconSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        path = data["path"][:300]
        user_agent = get_user_agent(request)
        device = device_from_user_agent(user_agent)

        # لا نسجّل الزواحف — تشوّه الأرقام
        if device == "bot":
            return Response(status=status.HTTP_202_ACCEPTED)

        content_type, object_slug = classify_path(path)
        ip = get_client_ip(request)

        PageView.objects.create(
            path=path,
            locale=data.get("locale", "")[:5],
            content_type=content_type,
            object_slug=object_slug,
            referrer_domain=referrer_domain(data.get("referrer", "")),
            device_type=device,
            session_hash=anonymous_session_hash(ip, user_agent),
        )
        return Response(status=status.HTTP_202_ACCEPTED)


class AnalyticsView(APIView):
    """بيانات لوحة التحليلات — للمصرّح لهم فقط."""

    permission_classes = [HasDashboardPermission]
    required_permissions = ["core.view_analytics"]

    def _range_start(self, request):
        mapping = {"7d": 7, "30d": 30, "90d": 90}
        days = mapping.get(request.query_params.get("range", "30d"), 30)
        return timezone.now() - timedelta(days=days), days


class OverviewView(AnalyticsView):
    @extend_schema(summary="ملخص التحليلات", responses={200: OpenApiTypes.OBJECT})
    def get(self, request):
        from apps.accounts.models import User
        from apps.blog.models import Post
        from apps.crm.models import Lead, ProjectRequest

        start, days = self._range_start(request)
        views = PageView.objects.filter(created_at__gte=start)

        return Response({
            "range_days": days,
            "page_views": views.count(),
            "unique_visitors": views.values("session_hash").distinct().count(),
            "members": User.objects.filter(role="member").count(),
            "leads": Lead.objects.filter(created_at__gte=start).count(),
            "requests": ProjectRequest.objects.filter(
                created_at__gte=start
            ).exclude(status="draft").count(),
            "published_posts": Post.objects.filter(status="published").count(),
        })


class TrafficView(AnalyticsView):
    @extend_schema(summary="الزيارات عبر الزمن", responses={200: OpenApiTypes.OBJECT})
    def get(self, request):
        from django.db.models.functions import TruncDate

        start, _ = self._range_start(request)
        rows = (
            PageView.objects.filter(created_at__gte=start)
            .annotate(day=TruncDate("created_at"))
            .values("day")
            .annotate(
                views=Count("id"),
                visitors=Count("session_hash", distinct=True),
            )
            .order_by("day")
        )
        return Response([
            {"date": row["day"].isoformat(), "views": row["views"],
             "visitors": row["visitors"]}
            for row in rows
        ])


class TopContentView(AnalyticsView):
    @extend_schema(summary="المحتوى الأكثر مشاهدة", responses={200: OpenApiTypes.OBJECT})
    def get(self, request):
        start, _ = self._range_start(request)
        content_type = request.query_params.get("type")

        queryset = PageView.objects.filter(created_at__gte=start).exclude(object_slug="")
        if content_type:
            queryset = queryset.filter(content_type=content_type)

        rows = (
            queryset.values("content_type", "object_slug")
            .annotate(views=Count("id"))
            .order_by("-views")[:10]
        )
        return Response(list(rows))


class SourcesView(AnalyticsView):
    @extend_schema(summary="مصادر الزيارات", responses={200: OpenApiTypes.OBJECT})
    def get(self, request):
        start, _ = self._range_start(request)
        views = PageView.objects.filter(created_at__gte=start)

        direct = views.filter(referrer_domain="").count()
        rows = (
            views.exclude(referrer_domain="")
            .values("referrer_domain")
            .annotate(views=Count("id"))
            .order_by("-views")[:10]
        )
        result = [{"source": "مباشر", "views": direct}] if direct else []
        result += [{"source": row["referrer_domain"], "views": row["views"]} for row in rows]
        return Response(result)


class DevicesView(AnalyticsView):
    @extend_schema(summary="توزيع الأجهزة", responses={200: OpenApiTypes.OBJECT})
    def get(self, request):
        start, _ = self._range_start(request)
        rows = (
            PageView.objects.filter(created_at__gte=start)
            .values("device_type")
            .annotate(views=Count("id"))
            .order_by("-views")
        )
        return Response(list(rows))


class RequestsByStatusView(AnalyticsView):
    @extend_schema(summary="طلبات المشاريع حسب الحالة", responses={200: OpenApiTypes.OBJECT})
    def get(self, request):
        from apps.crm.models import ProjectRequest

        rows = (
            ProjectRequest.objects.exclude(status="draft")
            .values("status")
            .annotate(count=Count("id"))
            .order_by("-count")
        )
        return Response(list(rows))
