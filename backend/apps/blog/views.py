from django.db.models import Count, Q
from django.utils import timezone
from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from rest_framework import serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.blog.filters import PostFilter
from apps.blog.models import Category, Post, SavedPost, Tag
from apps.blog.serializers import (
    CategoryAdminSerializer,
    CategorySerializer,
    PostAdminSerializer,
    PostDetailSerializer,
    PostListSerializer,
    SavedPostSerializer,
    TagAdminSerializer,
    TagSerializer,
)
from apps.core.audit import log_action
from apps.core.models.system import AuditLog
from apps.core.throttling import AnonWriteThrottle
from apps.core.viewsets import PublicContentViewSet

_LANG_PARAM = OpenApiParameter(
    name="Accept-Language", location=OpenApiParameter.HEADER,
    description="لغة الحقول المترجمة: ar أو en", required=False, type=str,
)


class PostViewSet(PublicContentViewSet):
    """المقالات.

    لا يرث فلترة المنشور القياسية لأن المقال يستخدم `status` لا `is_published`،
    فالفلترة معرّفة هنا صراحة.
    """

    queryset = Post.objects.select_related(
        "category", "author", "cover_image", "og_image"
    ).prefetch_related("tags")
    public_serializer_class = PostListSerializer
    detail_serializer_class = PostDetailSerializer
    admin_serializer_class = PostAdminSerializer
    filterset_class = PostFilter
    lookup_field = "slug"
    ordering_fields = ["published_at", "view_count", "created_at"]
    publishable = False  # نتولّى الفلترة يدويًا

    def get_queryset(self):
        queryset = super().get_queryset()
        if self.action in ("list", "retrieve") and not self._sees_unpublished():
            queryset = queryset.filter(
                status=Post.Status.PUBLISHED, published_at__lte=timezone.now()
            )
        return queryset.distinct()

    def _sees_unpublished(self) -> bool:
        user = getattr(self.request, "user", None)
        if not (user and user.is_authenticated):
            return False
        return user.is_superuser or user.has_perm("blog.change_post")

    @extend_schema(summary="قائمة المقالات", parameters=[_LANG_PARAM])
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)

    @extend_schema(summary="أحدث المقالات")
    @action(detail=False, methods=["get"], url_path="latest")
    def latest(self, request):
        posts = self.get_queryset().order_by("-published_at")[:6]
        return Response(
            PostListSerializer(posts, many=True, context={"request": request}).data
        )

    @extend_schema(summary="الأكثر قراءة")
    @action(detail=False, methods=["get"], url_path="popular")
    def popular(self, request):
        posts = self.get_queryset().order_by("-view_count", "-published_at")[:6]
        return Response(
            PostListSerializer(posts, many=True, context={"request": request}).data
        )

    @extend_schema(summary="نشر المقال بعد التحقق من كفاية المحتوى", request=None)
    @action(detail=True, methods=["post"], url_path="publish")
    def publish(self, request, slug=None):
        # المحرر يكتب لكنه لا ينشر — النشر يتطلب صلاحية مستقلة
        if not (request.user.is_superuser or request.user.has_perm("blog.publish_post")):
            return Response(
                {"detail": "لا تملك صلاحية نشر المقالات", "code": "permission_denied",
                 "errors": {}},
                status=status.HTTP_403_FORBIDDEN,
            )
        # النشر اختياري بلا حد أدنى للمحتوى؛ تبقى صلاحية النشر أعلاه فقط.
        post = self.get_object()
        post.status = Post.Status.PUBLISHED
        if post.published_at is None:
            post.published_at = timezone.now()
        post.save()
        log_action(AuditLog.Action.PUBLISH, instance=post, request=request)
        return Response(PostAdminSerializer(post, context={"request": request}).data)

    @extend_schema(summary="حفظ المقال أو إلغاء حفظه", request=None)
    @action(detail=True, methods=["post"], url_path="save",
            permission_classes=[IsAuthenticated])
    def toggle_save(self, request, slug=None):
        post = self.get_object()
        existing = SavedPost.objects.filter(user=request.user, post=post).first()
        if existing:
            existing.delete()
            return Response({"saved": False})
        SavedPost.objects.create(user=request.user, post=post)
        return Response({"saved": True})

    @extend_schema(summary="المقالات المحفوظة للعضو")
    @action(detail=False, methods=["get"], url_path="saved",
            permission_classes=[IsAuthenticated])
    def saved(self, request):
        saved = SavedPost.objects.filter(user=request.user).select_related(
            "post", "post__category", "post__cover_image"
        ).prefetch_related("post__tags")
        page = self.paginate_queryset(saved)
        serializer = SavedPostSerializer(
            page if page is not None else saved, many=True, context={"request": request}
        )
        if page is not None:
            return self.get_paginated_response(serializer.data)
        return Response(serializer.data)


@extend_schema_view(list=extend_schema(summary="التصنيفات"))
class CategoryViewSet(PublicContentViewSet):
    queryset = Category.objects.all()
    public_serializer_class = CategorySerializer
    admin_serializer_class = CategoryAdminSerializer
    lookup_field = "slug"
    publishable = False
    pagination_class = None  # قائمة قصيرة تُعاد كاملة

    def get_queryset(self):
        queryset = super().get_queryset()
        if self.action in ("list", "retrieve") and not self._wants_admin_view():
            queryset = (
                queryset.filter(is_active=True)
                .annotate(
                    live_post_count=Count("posts", filter=Q(posts__status="published"))
                )
                # التجميع يُسقط الترتيب الافتراضي — نعيده صراحة
                .order_by("display_order", "name_ar")
            )
        return queryset


@extend_schema_view(list=extend_schema(summary="الوسوم"))
class TagViewSet(PublicContentViewSet):
    queryset = Tag.objects.all()
    public_serializer_class = TagSerializer
    admin_serializer_class = TagAdminSerializer
    lookup_field = "slug"
    publishable = False
    pagination_class = None
    ordering_fields = ["usage_count", "name_ar"]


class ViewBeaconSerializer(serializers.Serializer):
    slug = serializers.CharField(max_length=220)


class PostViewBeaconView(APIView):
    """يستقبل إشارة مشاهدة من العميل بعد تحميل المقال.

    العدّ من الخادم مستحيل مع الصفحات المولّدة ثابتًا. الزيادة مباشرة هنا
    بسيطة وكافية لحجم مدونة شخصية؛ التجميع الدفعي متاح في `flush_view_counts`
    إن تطلّب الحجم ذلك لاحقًا.
    """

    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [AnonWriteThrottle]
    serializer_class = ViewBeaconSerializer

    @extend_schema(summary="تسجيل مشاهدة مقال", request=ViewBeaconSerializer,
                   responses={202: None})
    def post(self, request):
        from django.db.models import F

        serializer = ViewBeaconSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        Post.objects.filter(
            slug=serializer.validated_data["slug"], status=Post.Status.PUBLISHED
        ).update(view_count=F("view_count") + 1)
        return Response(status=status.HTTP_202_ACCEPTED)
