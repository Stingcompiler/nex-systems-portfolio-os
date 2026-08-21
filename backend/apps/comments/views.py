from django.db.models import Prefetch
from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.comments.antispam import SpamRejection, run_all_filters
from apps.comments.models import BlockedEmail, Comment, CommentReport
from apps.comments.serializers import (
    BlockedEmailSerializer,
    CommentAdminSerializer,
    CommentCreateSerializer,
    CommentReportAdminSerializer,
    CommentReportSerializer,
    CommentSerializer,
    MyCommentSerializer,
)
from apps.core.audit import get_client_ip, get_user_agent
from apps.core.mixins import AuditLogMixin
from apps.core.pagination import LargePagination, StandardPagination
from apps.core.permissions import HasDashboardPermission


class PublicCommentView(APIView):
    """قائمة التعليقات المعتمدة على مقال، وإنشاء تعليق جديد."""

    permission_classes = [AllowAny]
    serializer_class = CommentCreateSerializer

    @extend_schema(
        summary="تعليقات مقال (المعتمدة فقط)",
        parameters=[OpenApiParameter("post", str, description="slug المقال")],
        responses={200: CommentSerializer(many=True)},
    )
    def get(self, request):
        slug = request.query_params.get("post")
        if not slug:
            return Response({"detail": "معامل post مطلوب", "code": "missing_param",
                             "errors": {}}, status=status.HTTP_400_BAD_REQUEST)

        approved_replies = Prefetch(
            "replies",
            queryset=Comment.objects.filter(status=Comment.Status.APPROVED)
            .select_related("user"),
        )
        comments = (
            Comment.objects.filter(
                post__slug=slug, status=Comment.Status.APPROVED, parent__isnull=True
            )
            .select_related("user")
            .prefetch_related(approved_replies)
        )
        return Response(
            CommentSerializer(comments, many=True, context={"request": request}).data
        )

    @extend_schema(summary="إضافة تعليق", request=CommentCreateSerializer)
    def post(self, request):
        serializer = CommentCreateSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        is_member = request.user and request.user.is_authenticated
        email = (
            request.user.email if is_member else data.get("guest_email", "")
        )
        ip = get_client_ip(request)

        try:
            initial_status = run_all_filters(
                honeypot=data.pop("website", ""),
                elapsed_seconds=data.pop("elapsed_seconds", None),
                ip=ip,
                email=email,
                content=data["content"],
            )
        except SpamRejection as rejection:
            if rejection.silent:
                # رفض صامت — البوت يظنّ النجاح
                return Response(
                    {"detail": "تعليقك قيد المراجعة"}, status=status.HTTP_201_CREATED
                )
            return Response(
                {"detail": rejection.message, "code": "rate_limited", "errors": {}},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        comment = Comment.objects.create(
            post=data["post"],
            parent=data.get("parent"),
            user=request.user if is_member else None,
            guest_name="" if is_member else data.get("guest_name", ""),
            guest_email="" if is_member else data.get("guest_email", ""),
            content=data["content"],
            notify_on_reply=data.get("notify_on_reply", True),
            status=initial_status,
            ip_address=ip,
            user_agent=get_user_agent(request),
        )
        # الإشعار يُطلق عبر الإشارة عند الإنشاء

        return Response(
            {
                "detail": "تعليقك قيد المراجعة وسيظهر بعد الاعتماد",
                "id": comment.id,
            },
            status=status.HTTP_201_CREATED,
        )


class CommentReportView(APIView):
    permission_classes = [AllowAny]
    serializer_class = CommentReportSerializer

    @extend_schema(summary="الإبلاغ عن تعليق", request=CommentReportSerializer)
    def post(self, request):
        serializer = CommentReportSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        reporter = request.user if request.user.is_authenticated else None
        CommentReport.objects.create(
            **serializer.validated_data,
            reporter=reporter,
            ip_address=get_client_ip(request),
        )
        return Response(
            {"detail": "شكرًا لبلاغك، سنراجعه"}, status=status.HTTP_201_CREATED
        )


class MyCommentsView(APIView):
    """تعليقات العضو بكل حالاتها."""

    permission_classes = [IsAuthenticated]
    serializer_class = MyCommentSerializer

    @extend_schema(summary="تعليقاتي", responses={200: MyCommentSerializer(many=True)})
    def get(self, request):
        comments = Comment.objects.filter(user=request.user).select_related("post")
        return Response(
            MyCommentSerializer(comments, many=True, context={"request": request}).data
        )


# --------------------------------------------------------------- إداري


class CommentModerationViewSet(
    AuditLogMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    queryset = Comment.objects.select_related("post", "user").prefetch_related("reports")
    serializer_class = CommentAdminSerializer
    permission_classes = [HasDashboardPermission]
    required_permissions = ["comments.approve_comment"]
    pagination_class = StandardPagination
    filterset_fields = ["status", "post"]
    search_fields = ["content", "guest_name", "guest_email"]
    ordering_fields = ["created_at"]

    @extend_schema(summary="اعتماد تعليق", request=None)
    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        comment = self.get_object()
        comment.approve(by=request.user)
        return Response(CommentAdminSerializer(comment).data)

    @extend_schema(summary="رفض تعليق", request=None)
    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        comment = self.get_object()
        comment.status = Comment.Status.REJECTED
        comment.save(update_fields=["status", "updated_at"])
        return Response(CommentAdminSerializer(comment).data)

    @extend_schema(summary="تعليم كسبام وحظر البريد اختياريًا", request=None)
    @action(detail=True, methods=["post"])
    def spam(self, request, pk=None):
        comment = self.get_object()
        comment.status = Comment.Status.SPAM
        comment.save(update_fields=["status", "updated_at"])

        if request.data.get("block_email") and comment.author_email:
            BlockedEmail.objects.get_or_create(
                value=comment.author_email.lower().strip(),
                defaults={"reason": "تعليق سبام", "blocked_by": request.user},
            )
        return Response(CommentAdminSerializer(comment).data)


@extend_schema_view(
    list=extend_schema(summary="بلاغات التعليقات"),
    partial_update=extend_schema(summary="معالجة بلاغ"),
)
class CommentReportModerationViewSet(
    AuditLogMixin,
    mixins.ListModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    queryset = CommentReport.objects.select_related("comment").all()
    serializer_class = CommentReportAdminSerializer
    permission_classes = [HasDashboardPermission]
    required_permissions = ["comments.change_commentreport"]
    pagination_class = LargePagination
    filterset_fields = ["status", "reason"]
    http_method_names = ["get", "patch", "head", "options"]


@extend_schema_view(
    list=extend_schema(summary="البريد المحظور"),
    create=extend_schema(summary="حظر بريد"),
    destroy=extend_schema(summary="رفع الحظر"),
)
class BlockedEmailViewSet(
    AuditLogMixin,
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    queryset = BlockedEmail.objects.all()
    serializer_class = BlockedEmailSerializer
    permission_classes = [HasDashboardPermission]
    required_permissions = ["comments.change_comment"]
    pagination_class = LargePagination
    search_fields = ["value"]

    def perform_create(self, serializer):
        serializer.save(blocked_by=self.request.user)
