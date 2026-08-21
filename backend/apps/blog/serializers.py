from rest_framework import serializers

from apps.blog.models import Category, Post, SavedPost, Tag
from apps.core.fields import TranslatedField
from apps.core.utils.text import count_words
from apps.media_library.serializers import MediaFileRefSerializer

#: الحد الأدنى لكلمات المحتوى العربي قبل السماح بالنشر — يمنع المقالات الرقيقة
MIN_PUBLISH_WORDS = 100


class CategorySerializer(serializers.ModelSerializer):
    name = TranslatedField()
    description = TranslatedField()
    post_count = serializers.SerializerMethodField()

    class Meta:
        model = Category
        fields = ["id", "name", "slug", "description", "color", "post_count", "display_order"]

    def get_post_count(self, category) -> int:
        # يُحتسب من annotate عند توفره لتفادي N+1، وإلا يسقط إلى العدّ المباشر
        return getattr(category, "live_post_count", None) or category.posts.filter(
            status="published"
        ).count()


class CategoryAdminSerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = "__all__"


class TagSerializer(serializers.ModelSerializer):
    name = TranslatedField()

    class Meta:
        model = Tag
        fields = ["id", "name", "slug", "usage_count"]


class TagAdminSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tag
        fields = "__all__"


class PostListSerializer(serializers.ModelSerializer):
    title = TranslatedField()
    excerpt = TranslatedField()
    reading_time = serializers.SerializerMethodField()
    cover_image = MediaFileRefSerializer(read_only=True)
    category = CategorySerializer(read_only=True)
    tags = TagSerializer(many=True, read_only=True)
    author_name = serializers.CharField(source="author.full_name", read_only=True, default="")

    class Meta:
        model = Post
        fields = [
            "id", "title", "slug", "excerpt", "cover_image",
            "category", "tags", "author_name", "reading_time",
            "view_count", "is_featured", "published_at",
        ]

    def get_reading_time(self, post) -> int:
        language = getattr(self.context.get("request"), "language", "ar")
        return post.reading_time_en if language == "en" else post.reading_time_ar


class PostDetailSerializer(PostListSerializer):
    content = TranslatedField()
    related_posts = serializers.SerializerMethodField()
    is_saved = serializers.SerializerMethodField()
    seo = serializers.SerializerMethodField()

    class Meta(PostListSerializer.Meta):
        fields = PostListSerializer.Meta.fields + [
            "content", "allow_comments", "related_posts", "is_saved", "seo",
        ]

    def get_related_posts(self, post) -> list:
        # الصريحة أولًا، ثم اقتراح تلقائي بالتصنيف عند غيابها
        explicit = post.related_posts.filter(status="published")[:3]
        if explicit:
            return PostListSerializer(explicit, many=True, context=self.context).data

        suggested = (
            Post.objects.filter(status="published", category=post.category)
            .exclude(pk=post.pk)
            .order_by("-published_at")[:3]
        )
        return PostListSerializer(suggested, many=True, context=self.context).data

    def get_is_saved(self, post) -> bool:
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if not (user and user.is_authenticated):
            return False
        return SavedPost.objects.filter(user=user, post=post).exists()

    def get_seo(self, post) -> dict:
        request = self.context.get("request")
        language = getattr(request, "language", "ar")
        title = getattr(post, f"seo_title_{language}", "") or post.tr("title")
        description = getattr(post, f"seo_description_{language}", "") or post.tr("excerpt")
        image = None
        og = getattr(post, "og_image", None) or post.cover_image
        if og is not None:
            image = MediaFileRefSerializer(og, context=self.context).data
        return {"title": title, "description": (description or "")[:320], "image": image}


class PostAdminSerializer(serializers.ModelSerializer):
    publication_blockers = serializers.SerializerMethodField()
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = Post
        fields = "__all__"
        read_only_fields = [
            "view_count", "search_text", "reading_time_ar", "reading_time_en",
        ]

    def get_publication_blockers(self, post) -> list[str]:
        return _publication_blockers(post)

    def validate(self, attrs):
        status = attrs.get("status", getattr(self.instance, "status", None))
        # النشر لم يعد مشروطًا بحد أدنى للمحتوى (اختياري)، لكن تبقى صلاحية النشر:
        # المحرر لا يملك publish_post، فمحاولته النشر عبر النموذج تُرفض.
        if status == Post.Status.PUBLISHED:
            request = self.context.get("request")
            user = getattr(request, "user", None)
            if user and not (user.is_superuser or user.has_perm("blog.publish_post")):
                raise serializers.ValidationError({
                    "status": ["لا تملك صلاحية النشر — احفظ كمسودة أو أرسل للمراجعة."]
                })
        return attrs


def _publication_blockers(post) -> list[str]:
    problems = []
    words = count_words(post.content_ar)
    if words < MIN_PUBLISH_WORDS:
        problems.append(f"المحتوى العربي {words} كلمة (الحد {MIN_PUBLISH_WORDS}).")
    if not post.excerpt_ar.strip():
        problems.append("الملخص العربي مطلوب.")
    return problems


class SavedPostSerializer(serializers.ModelSerializer):
    post = PostListSerializer(read_only=True)

    class Meta:
        model = SavedPost
        fields = ["id", "post", "created_at"]
