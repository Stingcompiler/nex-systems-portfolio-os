"""اختبارات المدونة: النشر المجدول، البحث العربي، المشاهدات، الصلاحيات، الحفظ."""

import pytest
from django.core.management import call_command
from django.utils import timezone

from apps.blog.models import Category, Post, SavedPost, Tag

pytestmark = pytest.mark.django_db

POSTS_URL = "/api/v1/posts/"
BEACON_URL = "/api/v1/posts/view/"
CATEGORIES_URL = "/api/v1/categories/"
TAGS_URL = "/api/v1/tags/"

AR = {"HTTP_ACCEPT_LANGUAGE": "ar"}
EN = {"HTTP_ACCEPT_LANGUAGE": "en"}


@pytest.fixture
def blog(db):
    call_command("seed_groups", verbosity=0)
    call_command("seed_blog", verbosity=0)


@pytest.fixture
def content_manager(blog, make_user):
    return make_user(email="cm@example.com", role="content_manager")


@pytest.fixture
def editor(blog, make_user):
    return make_user(email="editor@example.com", role="editor")


def _login(client, user):
    response = client.post(
        "/api/v1/auth/login/",
        {"email": user.email, "password": user.raw_password},
        format="json",
    )
    assert response.status_code == 200, response.data
    return client


# --------------------------------------------------------------- القراءة العامة


def test_published_posts_are_public(api_client, blog):
    response = api_client.get(POSTS_URL, **AR)
    assert response.status_code == 200
    assert response.data["count"] == 2


def test_post_detail_includes_content_and_related(api_client, blog):
    response = api_client.get(f"{POSTS_URL}why-analysis-before-code/", **AR)
    assert response.status_code == 200
    assert response.data["content"]
    assert response.data["seo"]["title"]
    assert "related_posts" in response.data


def test_fields_follow_language_header(api_client, blog):
    ar = api_client.get(f"{POSTS_URL}why-analysis-before-code/", **AR)
    en = api_client.get(f"{POSTS_URL}why-analysis-before-code/", **EN)
    assert ar.data["title"] != en.data["title"]
    assert "التحليل" in ar.data["title"]


def test_reading_time_is_computed(api_client, blog):
    response = api_client.get(f"{POSTS_URL}why-analysis-before-code/", **AR)
    assert response.data["reading_time"] >= 1


# --------------------------------------------------------------- الحالات المخفية


def test_draft_hidden_from_public(api_client, blog, content_manager):
    post = Post.objects.first()
    post.status = Post.Status.DRAFT
    post.save()

    assert api_client.get(POSTS_URL, **AR).data["count"] == 1
    assert api_client.get(f"{POSTS_URL}{post.slug}/", **AR).status_code == 404


def test_content_manager_sees_drafts(api_client, content_manager):
    post = Post.objects.first()
    post.status = Post.Status.DRAFT
    post.save()
    _login(api_client, content_manager)

    assert api_client.get(f"{POSTS_URL}{post.slug}/").status_code == 200


def test_scheduled_post_hidden_until_due(api_client, blog):
    post = Post.objects.first()
    post.status = Post.Status.SCHEDULED
    post.published_at = timezone.now() + timezone.timedelta(days=2)
    post.save()

    assert api_client.get(f"{POSTS_URL}{post.slug}/", **AR).status_code == 404


def test_scheduled_task_publishes_due_posts(blog):
    from apps.blog.tasks import publish_scheduled_posts

    post = Post.objects.first()
    post.status = Post.Status.SCHEDULED
    post.published_at = timezone.now() - timezone.timedelta(minutes=1)
    post.save()

    count = publish_scheduled_posts()
    assert count == 1
    post.refresh_from_db()
    assert post.status == Post.Status.PUBLISHED


# --------------------------------------------------------------- البحث العربي


def test_search_ignores_hamza(api_client, blog):
    """المطلب الأساسي: البحث بلا همزة يجد المحتوى المكتوب بها."""
    # المقال يذكر «الإمارات» بهمزة قطع
    with_hamza = api_client.get(POSTS_URL, {"search": "الإمارات"}, **AR)
    without_hamza = api_client.get(POSTS_URL, {"search": "الامارات"}, **AR)
    assert with_hamza.data["count"] == without_hamza.data["count"] >= 1


def test_search_matches_content(api_client, blog):
    response = api_client.get(POSTS_URL, {"search": "التطبيع"}, **AR)
    assert response.data["count"] == 1
    assert response.data["results"][0]["slug"] == "arabic-search-that-actually-works"


# --------------------------------------------------------------- المشاهدات


def test_view_beacon_increments_count(api_client, blog):
    post = Post.objects.get(slug="why-analysis-before-code")
    before = post.view_count

    response = api_client.post(BEACON_URL, {"slug": post.slug}, format="json")
    assert response.status_code == 202

    post.refresh_from_db()
    assert post.view_count == before + 1


def test_view_beacon_ignores_unpublished(api_client, blog):
    post = Post.objects.first()
    post.status = Post.Status.DRAFT
    post.save()
    before = post.view_count

    api_client.post(BEACON_URL, {"slug": post.slug}, format="json")
    post.refresh_from_db()
    assert post.view_count == before


def test_popular_orders_by_views(api_client, blog):
    a, b = Post.objects.all()[:2]
    Post.objects.filter(pk=a.pk).update(view_count=100)
    Post.objects.filter(pk=b.pk).update(view_count=5)

    response = api_client.get(f"{POSTS_URL}popular/", **AR)
    assert response.data[0]["view_count"] >= response.data[1]["view_count"]


# --------------------------------------------------------------- الفلترة


def test_filter_by_category(api_client, blog):
    response = api_client.get(POSTS_URL, {"category": "web-development"}, **AR)
    assert response.status_code == 200
    assert response.data["count"] == 1


def test_filter_by_tag(api_client, blog):
    response = api_client.get(POSTS_URL, {"tag": "database"}, **AR)
    assert response.data["count"] == 2  # كلا المقالين موسوم بـ database


def test_categories_expose_live_post_count(api_client, blog):
    response = api_client.get(CATEGORIES_URL, **AR)
    web = next(c for c in _rows(response) if c["slug"] == "web-development")
    assert web["post_count"] == 1


def test_tags_track_usage_count(api_client, blog):
    response = api_client.get(TAGS_URL, **AR)
    database_tag = next(t for t in _rows(response) if t["slug"] == "database")
    assert database_tag["usage_count"] == 2


# --------------------------------------------------------------- النشر والصلاحيات


def test_publishing_thin_content_is_now_allowed(api_client, content_manager):
    # النشر أصبح اختياريًا بلا حد أدنى للمحتوى — المقال الرقيق يُنشر لمن يملك الصلاحية.
    draft = Post.objects.create(
        title_ar="مقال قصير", content_ar="كلمتان فقط", status=Post.Status.DRAFT
    )
    _login(api_client, content_manager)

    response = api_client.post(f"{POSTS_URL}{draft.slug}/publish/")
    assert response.status_code == 200
    draft.refresh_from_db()
    assert draft.status == Post.Status.PUBLISHED


def test_editor_can_create_but_not_publish(api_client, editor):
    _login(api_client, editor)

    created = api_client.post(
        POSTS_URL,
        {
            "title_ar": "مسودة المحرر",
            "excerpt_ar": "ملخص",
            "content_ar": " ".join(["كلمة"] * 150),
            "status": "draft",
        },
        format="json",
    )
    assert created.status_code == 201, created.data

    slug = Post.objects.get(title_ar="مسودة المحرر").slug
    published = api_client.post(f"{POSTS_URL}{slug}/publish/")
    assert published.status_code == 403


def test_editor_cannot_publish_via_serializer(api_client, editor):
    _login(api_client, editor)

    response = api_client.post(
        POSTS_URL,
        {
            "title_ar": "محاولة نشر",
            "excerpt_ar": "ملخص",
            "content_ar": " ".join(["كلمة"] * 150),
            "status": "published",
        },
        format="json",
    )
    assert response.status_code == 400
    assert "status" in response.data["errors"]


def test_content_manager_can_publish(api_client, content_manager):
    draft = Post.objects.create(
        title_ar="جاهز للنشر",
        excerpt_ar="ملخص",
        content_ar=" ".join(["كلمة"] * 150),
        status=Post.Status.DRAFT,
    )
    _login(api_client, content_manager)

    response = api_client.post(f"{POSTS_URL}{draft.slug}/publish/")
    assert response.status_code == 200
    draft.refresh_from_db()
    assert draft.status == Post.Status.PUBLISHED
    assert draft.published_at is not None


def test_anonymous_cannot_create(api_client, blog):
    response = api_client.post(POSTS_URL, {"title_ar": "س"}, format="json")
    assert response.status_code in (401, 403)


# --------------------------------------------------------------- حفظ المقالات


def test_member_saves_and_unsaves_post(api_client, blog, make_user):
    member = make_user(email="m@example.com", role="member")
    post = Post.objects.first()
    _login(api_client, member)

    first = api_client.post(f"{POSTS_URL}{post.slug}/save/")
    assert first.status_code == 200
    assert first.data["saved"] is True
    assert SavedPost.objects.filter(user=member, post=post).exists()

    second = api_client.post(f"{POSTS_URL}{post.slug}/save/")
    assert second.data["saved"] is False
    assert not SavedPost.objects.filter(user=member, post=post).exists()


def test_saved_list_returns_member_posts(api_client, blog, make_user):
    member = make_user(email="m@example.com", role="member")
    post = Post.objects.first()
    SavedPost.objects.create(user=member, post=post)
    _login(api_client, member)

    response = api_client.get(f"{POSTS_URL}saved/")
    assert response.status_code == 200
    results = _rows(response)
    assert len(results) == 1
    assert results[0]["post"]["slug"] == post.slug


def test_anonymous_cannot_save(api_client, blog):
    post = Post.objects.first()
    assert api_client.post(f"{POSTS_URL}{post.slug}/save/").status_code in (401, 403)


def test_is_saved_flag_reflects_member_state(api_client, blog, make_user):
    member = make_user(email="m@example.com", role="member")
    post = Post.objects.first()
    _login(api_client, member)

    before = api_client.get(f"{POSTS_URL}{post.slug}/")
    assert before.data["is_saved"] is False

    api_client.post(f"{POSTS_URL}{post.slug}/save/")
    after = api_client.get(f"{POSTS_URL}{post.slug}/")
    assert after.data["is_saved"] is True


# --------------------------------------------------------------- التهيئة


def test_seeding_twice_does_not_duplicate(blog):
    before = (Post.objects.count(), Category.objects.count(), Tag.objects.count())
    call_command("seed_blog", verbosity=0)
    after = (Post.objects.count(), Category.objects.count(), Tag.objects.count())
    assert before == after


def _rows(response):
    """يتعامل مع القوائم المرقّمة والقوائم المباشرة معًا."""
    data = response.data
    return data["results"] if isinstance(data, dict) and "results" in data else data
