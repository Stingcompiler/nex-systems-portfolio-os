"""اختبارات التعليقات: المراجعة، السبام الستة، الردود، سرّية البريد، البلاغات."""

import time

import pytest
from django.core.cache import cache
from django.core.management import call_command

from apps.blog.models import Post
from apps.comments.models import BlockedEmail, Comment, CommentReport
from apps.notifications.models import Notification

pytestmark = pytest.mark.django_db

URL = "/api/v1/comments/"
REPORT_URL = "/api/v1/comments/report/"
MINE_URL = "/api/v1/comments/mine/"
MOD_URL = "/api/v1/comments/moderation/"


@pytest.fixture
def post(db):
    call_command("seed_groups", verbosity=0)
    return Post.objects.create(
        title_ar="مقال للتعليق",
        excerpt_ar="ملخص",
        content_ar=" ".join(["كلمة"] * 120),
        status=Post.Status.PUBLISHED,
    )


@pytest.fixture
def content_manager(post, make_user):
    return make_user(email="cm@example.com", role="content_manager")


def _login(client, user):
    r = client.post(
        "/api/v1/auth/login/",
        {"email": user.email, "password": user.raw_password},
        format="json",
    )
    assert r.status_code == 200
    return client


GUEST = {"guest_name": "زائر", "guest_email": "guest@example.com", "elapsed_seconds": 10}


def _comment(post_id, content="تعليق جيد ومفيد", **extra):
    return {"post": post_id, "content": content, **GUEST, **extra}


# --------------------------------------------------------------- المراجعة


def test_guest_comment_starts_pending_and_hidden(api_client, post):
    response = api_client.post(URL, _comment(post.id), format="json")
    assert response.status_code == 201

    comment = Comment.objects.get()
    assert comment.status == Comment.Status.PENDING

    # لا يظهر قبل الاعتماد
    listing = api_client.get(URL, {"post": post.slug})
    assert listing.status_code == 200
    assert len(listing.data) == 0


def test_approved_comment_appears_publicly(api_client, post):
    api_client.post(URL, _comment(post.id), format="json")
    comment = Comment.objects.get()
    comment.approve()

    listing = api_client.get(URL, {"post": post.slug})
    assert len(listing.data) == 1
    assert listing.data[0]["author_name"] == "زائر"


def test_guest_email_never_appears_publicly(api_client, post):
    api_client.post(URL, _comment(post.id), format="json")
    Comment.objects.get().approve()

    listing = api_client.get(URL, {"post": post.slug})
    body = str(listing.data)
    assert "guest@example.com" not in body
    assert "email" not in listing.data[0]


def test_new_comment_notifies_managers(api_client, post):
    api_client.post(URL, _comment(post.id), format="json")
    assert Notification.objects.filter(type="new_comment").count() == 1


# --------------------------------------------------------------- مرشحات السبام


def test_honeypot_rejects_silently(api_client, post):
    """الطبقة 1: الحقل الخادع — رفض صامت (يبدو نجاحًا للبوت)."""
    response = api_client.post(
        URL, _comment(post.id, website="http://spam.example"), format="json"
    )
    assert response.status_code == 201  # صامت
    assert Comment.objects.count() == 0


def test_too_fast_submission_rejected(api_client, post):
    """الطبقة 2: إرسال أسرع من بشر."""
    data = _comment(post.id)
    data["elapsed_seconds"] = 1
    response = api_client.post(URL, data, format="json")
    assert response.status_code == 201  # صامت
    assert Comment.objects.count() == 0


def test_rate_limit_blocks_burst(api_client, post):
    """الطبقة 3: تحديد المعدل لكل IP."""
    statuses = []
    for i in range(5):
        r = api_client.post(
            URL, _comment(post.id, guest_email=f"g{i}@example.com"), format="json"
        )
        statuses.append(r.status_code)
    # بعد 3 لكل IP يُرفض
    assert 429 in statuses


def test_blocked_email_rejected(api_client, post):
    """الطبقة 4: البريد المحظور."""
    BlockedEmail.objects.create(value="guest@example.com")
    response = api_client.post(URL, _comment(post.id), format="json")
    assert response.status_code == 201  # صامت
    assert Comment.objects.count() == 0


def test_blocked_domain_rejected(api_client, post):
    BlockedEmail.objects.create(value="@spam.com")
    response = api_client.post(
        URL, _comment(post.id, guest_email="anyone@spam.com"), format="json"
    )
    assert Comment.objects.count() == 0


def test_excess_links_marked_spam(api_client, post):
    """الطبقة 5: أكثر من رابطين = سبام."""
    content = "زوروا http://a.com و http://b.com و http://c.com"
    api_client.post(URL, _comment(post.id, content=content), format="json")

    comment = Comment.objects.get()
    assert comment.status == Comment.Status.SPAM
    # السبام لا يُشعر المديرين
    assert Notification.objects.filter(type="new_comment").count() == 0


def test_clean_comment_needs_manual_approval(api_client, post):
    """الطبقة 6: حتى النظيف يبقى pending حتى الاعتماد اليدوي."""
    api_client.post(URL, _comment(post.id), format="json")
    assert Comment.objects.get().status == Comment.Status.PENDING


# --------------------------------------------------------------- الأعضاء


def test_member_comment_uses_account_identity(api_client, post, make_user):
    member = make_user(email="member@example.com", role="member")
    _login(api_client, member)

    response = api_client.post(
        URL, {"post": post.id, "content": "تعليق عضو مفيد", "elapsed_seconds": 10},
        format="json",
    )
    assert response.status_code == 201

    comment = Comment.objects.get()
    assert comment.user_id == member.id
    assert comment.guest_email == ""  # لا يُخزَّن بريد ضيف للعضو


def test_member_sees_own_comments_all_statuses(api_client, post, make_user):
    member = make_user(email="member@example.com", role="member")
    Comment.objects.create(post=post, user=member, content="مسودة", status="pending")
    Comment.objects.create(post=post, user=member, content="مرفوض", status="rejected")
    _login(api_client, member)

    response = api_client.get(MINE_URL)
    assert response.status_code == 200
    assert len(response.data) == 2


def test_comments_closed_when_post_disallows(api_client, post):
    post.allow_comments = False
    post.save()
    response = api_client.post(URL, _comment(post.id), format="json")
    assert response.status_code == 400


# --------------------------------------------------------------- الردود


def test_reply_nests_under_parent(api_client, post):
    api_client.post(URL, _comment(post.id, content="تعليق أصلي"), format="json")
    parent = Comment.objects.get()
    parent.approve()

    cache.clear()  # تفادي حد المعدل
    api_client.post(
        URL,
        _comment(post.id, content="رد مفيد", parent=parent.id,
                 guest_email="other@example.com"),
        format="json",
    )
    reply = Comment.objects.get(parent=parent)
    reply.approve()

    listing = api_client.get(URL, {"post": post.slug})
    assert len(listing.data) == 1  # تعليق جذر واحد
    assert len(listing.data[0]["replies"]) == 1


def test_reply_to_reply_is_rejected(api_client, post):
    parent = Comment.objects.create(post=post, guest_name="أ", content="أصل", status="approved")
    reply = Comment.objects.create(
        post=post, parent=parent, guest_name="ب", content="رد", status="approved"
    )

    response = api_client.post(
        URL, _comment(post.id, content="رد على رد", parent=reply.id), format="json"
    )
    assert response.status_code == 400


def test_reply_approval_notifies_original_member(api_client, post, make_user):
    author = make_user(email="author@example.com", role="member")
    parent = Comment.objects.create(
        post=post, user=author, content="تعليق العضو", status="approved",
        notify_on_reply=True,
    )
    reply = Comment.objects.create(
        post=post, parent=parent, guest_name="زائر", content="رد", status="pending"
    )

    reply.approve()  # يُطلق إشعار الرد

    assert Notification.objects.filter(type="comment_reply", recipient=author).count() == 1


# --------------------------------------------------------------- المراجعة الإدارية


def test_moderation_requires_permission(api_client, post, make_user):
    member = make_user(email="member@example.com", role="member")
    _login(api_client, member)
    assert api_client.get(MOD_URL).status_code == 403


def test_manager_approves_comment(api_client, post, content_manager):
    Comment.objects.create(post=post, guest_name="ز", content="تعليق", status="pending")
    comment = Comment.objects.get()
    _login(api_client, content_manager)

    response = api_client.post(f"{MOD_URL}{comment.id}/approve/")
    assert response.status_code == 200
    comment.refresh_from_db()
    assert comment.status == Comment.Status.APPROVED
    assert comment.approved_by == content_manager


def test_manager_sees_email_in_moderation(api_client, post, content_manager):
    Comment.objects.create(
        post=post, guest_name="ز", guest_email="g@example.com",
        content="تعليق", status="pending",
    )
    _login(api_client, content_manager)

    response = api_client.get(MOD_URL)
    assert response.data["results"][0]["author_email"] == "g@example.com"


def test_spam_action_can_block_email(api_client, post, content_manager):
    comment = Comment.objects.create(
        post=post, guest_name="ز", guest_email="spammer@example.com",
        content="سبام", status="pending",
    )
    _login(api_client, content_manager)

    response = api_client.post(
        f"{MOD_URL}{comment.id}/spam/", {"block_email": True}, format="json"
    )
    assert response.status_code == 200
    assert BlockedEmail.is_blocked("spammer@example.com")


# --------------------------------------------------------------- البلاغات


def test_anyone_can_report_a_comment(api_client, post):
    comment = Comment.objects.create(
        post=post, guest_name="ز", content="تعليق", status="approved"
    )
    response = api_client.post(
        REPORT_URL, {"comment": comment.id, "reason": "offensive"}, format="json"
    )
    assert response.status_code == 201
    assert CommentReport.objects.count() == 1
    assert Notification.objects.filter(type="comment_report").count() == 1


def test_reports_visible_to_managers(api_client, post, content_manager):
    comment = Comment.objects.create(post=post, guest_name="ز", content="ت", status="approved")
    CommentReport.objects.create(comment=comment, reason="spam")
    _login(api_client, content_manager)

    response = api_client.get("/api/v1/comment-reports/")
    assert response.status_code == 200
    assert response.data["count"] == 1
