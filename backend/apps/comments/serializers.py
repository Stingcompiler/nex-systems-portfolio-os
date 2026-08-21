from rest_framework import serializers

from apps.comments.models import BlockedEmail, Comment, CommentReport


class ReplySerializer(serializers.ModelSerializer):
    """رد على تعليق — لا يحمل ردودًا فرعية (مستويان فقط)."""

    author_name = serializers.CharField(read_only=True)
    is_mine = serializers.SerializerMethodField()

    class Meta:
        model = Comment
        fields = ["id", "author_name", "content", "is_mine", "created_at"]

    def get_is_mine(self, comment) -> bool:
        user = getattr(self.context.get("request"), "user", None)
        return bool(user and user.is_authenticated and comment.user_id == user.id)


class CommentSerializer(serializers.ModelSerializer):
    """التمثيل العام — البريد لا يظهر إطلاقًا."""

    author_name = serializers.CharField(read_only=True)
    replies = serializers.SerializerMethodField()
    is_mine = serializers.SerializerMethodField()

    class Meta:
        model = Comment
        fields = ["id", "author_name", "content", "replies", "is_mine", "created_at"]

    def get_replies(self, comment) -> list:
        approved = [
            reply for reply in comment.replies.all()
            if reply.status == Comment.Status.APPROVED
        ]
        return ReplySerializer(approved, many=True, context=self.context).data

    def get_is_mine(self, comment) -> bool:
        user = getattr(self.context.get("request"), "user", None)
        return bool(user and user.is_authenticated and comment.user_id == user.id)


class CommentCreateSerializer(serializers.ModelSerializer):
    # حقول مكافحة السبام — لا تُخزَّن
    website = serializers.CharField(required=False, allow_blank=True, write_only=True)
    elapsed_seconds = serializers.FloatField(required=False, write_only=True)

    class Meta:
        model = Comment
        fields = [
            "post", "parent", "content", "guest_name", "guest_email",
            "notify_on_reply", "website", "elapsed_seconds",
        ]

    def validate_content(self, value):
        # الحقل اختياري — يُقبل فارغًا
        return value.strip()

    def validate_parent(self, value):
        if value is not None and value.parent_id is not None:
            # مستويان فقط — الرد على رد يُرفَع إلى التعليق الأصل
            raise serializers.ValidationError("لا يمكن الرد على رد")
        return value

    def validate(self, attrs):
        # اسم الزائر وبريده اختياريان الآن — تبقى فقط قيود السلامة البنيوية:
        # الرد في نفس المقال، والمقال يسمح بالتعليقات.
        parent = attrs.get("parent")
        if parent and parent.post_id != attrs["post"].id:
            raise serializers.ValidationError({"parent": ["الرد على تعليق من مقال آخر"]})

        # المقال يجب أن يسمح بالتعليقات
        if not attrs["post"].allow_comments:
            raise serializers.ValidationError("التعليقات مغلقة على هذا المقال")

        return attrs


# --------------------------------------------------------------- إداري


class CommentAdminSerializer(serializers.ModelSerializer):
    author_name = serializers.CharField(read_only=True)
    author_email = serializers.CharField(read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    post_title = serializers.CharField(source="post.title_ar", read_only=True)
    post_slug = serializers.CharField(source="post.slug", read_only=True)
    report_count = serializers.IntegerField(source="reports.count", read_only=True)

    class Meta:
        model = Comment
        fields = [
            "id", "post", "post_title", "post_slug", "parent",
            "author_name", "author_email", "content",
            "status", "status_display", "ip_address",
            "report_count", "created_at",
        ]
        read_only_fields = fields


class MyCommentSerializer(serializers.ModelSerializer):
    """تعليقات العضو في صفحته — بكل الحالات."""

    status_display = serializers.CharField(source="get_status_display", read_only=True)
    post_title = serializers.CharField(source="post.title_ar", read_only=True)
    post_slug = serializers.CharField(source="post.slug", read_only=True)

    class Meta:
        model = Comment
        fields = [
            "id", "content", "status", "status_display",
            "post_title", "post_slug", "created_at",
        ]
        read_only_fields = fields


class CommentReportSerializer(serializers.ModelSerializer):
    reporter_email = serializers.EmailField(required=False, allow_blank=True)

    class Meta:
        model = CommentReport
        fields = ["comment", "reason", "note", "reporter_email"]


class CommentReportAdminSerializer(serializers.ModelSerializer):
    reason_display = serializers.CharField(source="get_reason_display", read_only=True)
    comment_content = serializers.CharField(source="comment.content", read_only=True)

    class Meta:
        model = CommentReport
        fields = [
            "id", "comment", "comment_content", "reason", "reason_display",
            "note", "status", "reporter_email", "created_at",
        ]
        read_only_fields = ["id", "comment", "comment_content", "reason",
                            "reason_display", "note", "reporter_email", "created_at"]


class BlockedEmailSerializer(serializers.ModelSerializer):
    class Meta:
        model = BlockedEmail
        fields = ["id", "value", "reason", "created_at"]
        read_only_fields = ["id", "created_at"]

    def validate_value(self, value):
        return value.lower().strip()
