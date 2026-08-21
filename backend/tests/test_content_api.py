"""اختبارات الـ API العام للمحتوى: الخدمات والمشاريع والإعدادات."""

import pytest
from django.core.management import call_command
from django.utils import timezone

from apps.core.models.content import PageSection
from apps.core.models.settings import SiteSettings
from apps.portfolio.models import Project, Service, Technology

pytestmark = pytest.mark.django_db

SERVICES_URL = "/api/v1/services/"
SOLUTIONS_URL = "/api/v1/solutions/"
PROJECTS_URL = "/api/v1/projects/"
SETTINGS_URL = "/api/v1/settings/"
SECTIONS_URL = "/api/v1/sections/"
TECHNOLOGIES_URL = "/api/v1/technologies/"

AR = {"HTTP_ACCEPT_LANGUAGE": "ar"}
EN = {"HTTP_ACCEPT_LANGUAGE": "en"}


@pytest.fixture
def content(db):
    call_command("seed_groups", verbosity=0)
    call_command("seed_content", verbosity=0)


@pytest.fixture
def content_manager(content, make_user):
    return make_user(email="content@example.com", role="content_manager")


def _login(client, user):
    response = client.post(
        "/api/v1/auth/login/",
        {"email": user.email, "password": user.raw_password},
        format="json",
    )
    assert response.status_code == 200, response.data
    return client


# --------------------------------------------------------------- القراءة العامة


def test_services_are_readable_without_authentication(api_client, content):
    response = api_client.get(SERVICES_URL, **AR)

    assert response.status_code == 200
    assert response.data["count"] >= 4
    assert all(item["kind"] == "service" for item in response.data["results"])


def test_solutions_endpoint_only_returns_solutions(api_client, content):
    response = api_client.get(SOLUTIONS_URL, **AR)

    assert response.status_code == 200
    assert response.data["count"] >= 2
    assert all(item["kind"] == "solution" for item in response.data["results"])


def test_drafts_never_appear_in_public_listings(api_client, content):
    draft_count = Service.objects.filter(is_published=False).count()
    assert draft_count > 0, "التهيئة يجب أن تُنشئ مسودات"

    slugs = set()
    for url in (SERVICES_URL, SOLUTIONS_URL):
        response = api_client.get(url, {"page_size": 100}, **AR)
        slugs |= {item["slug"] for item in response.data["results"]}

    draft_slugs = set(
        Service.objects.filter(is_published=False).values_list("slug", flat=True)
    )
    assert slugs & draft_slugs == set()


def test_draft_detail_returns_404_for_anonymous_visitors(api_client, content):
    draft = Service.objects.filter(is_published=False).first()

    assert api_client.get(f"{SERVICES_URL}{draft.slug}/").status_code == 404


def test_content_manager_can_see_drafts(api_client, content_manager):
    draft = Service.objects.filter(is_published=False, kind="service").first()
    _login(api_client, content_manager)

    response = api_client.get(f"{SERVICES_URL}{draft.slug}/")
    assert response.status_code == 200


def test_scheduled_content_stays_hidden_until_its_time(api_client, content):
    service = Service.objects.filter(is_published=True, kind="service").first()
    service.published_at = timezone.now() + timezone.timedelta(days=3)
    service.save(update_fields=["published_at"])

    assert api_client.get(f"{SERVICES_URL}{service.slug}/").status_code == 404


# --------------------------------------------------------------- الترجمة


def test_fields_follow_the_accept_language_header(api_client, content):
    arabic = api_client.get(f"{SERVICES_URL}web-development/", **AR)
    english = api_client.get(f"{SERVICES_URL}web-development/", **EN)

    assert arabic.data["title"] == "تطوير المواقع وتطبيقات الويب"
    assert english.data["title"] == "Web & Web Application Development"
    assert arabic.data["title"] != english.data["title"]


def test_missing_translation_falls_back_to_arabic(api_client, content):
    service = Service.objects.get(slug="web-development")
    service.title_en = ""
    service.save(update_fields=["title_en"])

    response = api_client.get(f"{SERVICES_URL}web-development/", **EN)
    assert response.data["title"] == "تطوير المواقع وتطبيقات الويب"


def test_json_lists_are_localized_too(api_client, content):
    arabic = api_client.get(f"{SERVICES_URL}web-development/", **AR)
    english = api_client.get(f"{SERVICES_URL}web-development/", **EN)

    ar_feature = arabic.data["features"][0]
    en_feature = english.data["features"][0]

    assert "title" in ar_feature and "title_ar" not in ar_feature
    assert ar_feature["title"] != en_feature["title"]
    # المخرجات مخزّنة بصيغة {"ar": ..., "en": ...} وتُختصر إلى نص
    assert isinstance(arabic.data["deliverables"][0], str)


def test_response_declares_its_content_language(api_client, content):
    response = api_client.get(SERVICES_URL, **EN)
    assert response["Content-Language"] == "en"


# --------------------------------------------------------------- البحث


def test_search_ignores_hamza_and_diacritics(api_client, content):
    """المطلب الأساسي: البحث بلا همزات يجد المحتوى المكتوب بها."""
    response = api_client.get(PROJECTS_URL, {"search": "الامارات"}, **AR)

    assert response.status_code == 200
    assert response.data["count"] == 1
    assert response.data["results"][0]["slug"] == "eust-academic-platform"


def test_search_matches_ta_marbuta_variants(api_client, content):
    with_ta = api_client.get(SOLUTIONS_URL, {"search": "مدرسة"}, **AR)
    with_ha = api_client.get(SOLUTIONS_URL, {"search": "مدرسه"}, **AR)

    assert with_ta.data["count"] == with_ha.data["count"] >= 1


def test_search_narrows_results_with_every_word(api_client, content):
    broad = api_client.get(SERVICES_URL, {"search": "تطوير"}, **AR)
    narrow = api_client.get(SERVICES_URL, {"search": "تطوير الموبايل"}, **AR)

    assert narrow.data["count"] <= broad.data["count"]


def test_empty_search_returns_everything(api_client, content):
    all_items = api_client.get(SERVICES_URL, **AR)
    empty_search = api_client.get(SERVICES_URL, {"search": "  "}, **AR)

    assert all_items.data["count"] == empty_search.data["count"]


# --------------------------------------------------------------- الفلترة


def test_projects_filter_by_sector_and_technology(api_client, content):
    by_sector = api_client.get(PROJECTS_URL, {"sector": "education"}, **AR)
    by_technology = api_client.get(PROJECTS_URL, {"technology": "django"}, **AR)

    assert by_sector.data["count"] == 2
    assert by_technology.data["count"] == 2


def test_featured_projects_endpoint(api_client, content):
    response = api_client.get(f"{PROJECTS_URL}featured/", **AR)

    assert response.status_code == 200
    assert len(response.data) == 2


def test_technologies_filter_by_category(api_client, content):
    response = api_client.get(TECHNOLOGIES_URL, {"category": "backend"}, **AR)

    assert response.status_code == 200
    assert response.data["count"] >= 3
    assert all(item["category"] == "backend" for item in response.data["results"])


# --------------------------------------------------------------- التفاصيل و SEO


def test_service_detail_includes_technologies_projects_and_seo(api_client, content):
    response = api_client.get(f"{SOLUTIONS_URL}school-management-system/", **AR)

    assert response.status_code == 200
    assert len(response.data["technologies"]) > 0
    assert len(response.data["related_projects"]) > 0
    assert response.data["seo"]["title"]
    assert response.data["seo"]["description"]


def test_project_detail_hides_client_name_without_permission(api_client, content):
    project = Project.objects.get(slug="number-one-schools")
    project.client_permission = False
    project.save()

    response = api_client.get(f"{PROJECTS_URL}number-one-schools/", **AR)

    assert response.status_code == 200
    assert response.data["client_name"] == ""


def test_project_detail_shows_client_name_with_permission(api_client, content):
    response = api_client.get(f"{PROJECTS_URL}number-one-schools/", **AR)
    assert response.data["client_name"] == "مدارس ومعاهد نمبر ون"


# --------------------------------------------------------------- الإعدادات


def test_public_settings_never_leak_internal_fields(api_client, content):
    response = api_client.get(SETTINGS_URL, **AR)

    assert response.status_code == 200
    assert response.data["site_name"] == "نيكسا سيستمز"
    for hidden in ("email_from_address", "email_from_name", "id"):
        assert hidden not in response.data


def test_settings_are_not_editable_by_anonymous_visitors(api_client, content):
    response = api_client.patch(SETTINGS_URL, {"site_name_ar": "مخترق"}, format="json")

    assert response.status_code in (401, 403)
    assert SiteSettings.load().site_name_ar == "نيكسا سيستمز"


def test_superuser_sees_the_full_settings_record(api_client, content, make_user):
    admin = make_user(email="root@example.com", role="super_admin", is_superuser=True)
    _login(api_client, admin)

    response = api_client.get(SETTINGS_URL)
    assert "email_from_address" in response.data


# --------------------------------------------------------------- الأقسام


def test_home_sections_are_ordered(api_client, content):
    """قوائم الإعدادات تُعاد بلا ترقيم صفحات — القائمة نفسها هي الاستجابة."""
    response = api_client.get(SECTIONS_URL, {"page": "home"}, **AR)

    assert response.status_code == 200
    assert isinstance(response.data, list)
    orders = [item["display_order"] for item in response.data]
    assert orders == sorted(orders)
    assert response.data[0]["key"] == "hero"


def test_sections_can_be_filtered_by_page_without_clashing_with_pagination(
    api_client, content
):
    """`page` هنا اسم حقل لا رقم صفحة — سبب إلغاء الترقيم على هذا المورد."""
    response = api_client.get(SECTIONS_URL, {"page": "home"}, **AR)

    assert response.status_code == 200
    assert {item["page"] for item in response.data} == {"home"}


def test_section_reorder_requires_permission(api_client, content):
    ids = list(PageSection.objects.values_list("id", flat=True))

    response = api_client.post(f"{SECTIONS_URL}reorder/", {"order": ids}, format="json")
    assert response.status_code in (401, 403)


def test_section_reorder_applies_the_new_order(api_client, content_manager):
    _login(api_client, content_manager)
    ids = list(
        PageSection.objects.filter(page="home").order_by("display_order").values_list("id", flat=True)
    )
    reversed_ids = list(reversed(ids))

    response = api_client.post(
        f"{SECTIONS_URL}reorder/", {"order": reversed_ids}, format="json"
    )

    assert response.status_code == 200
    stored = list(
        PageSection.objects.filter(page="home").order_by("display_order").values_list("id", flat=True)
    )
    assert stored == reversed_ids


def test_section_reorder_rejects_unknown_ids(api_client, content_manager):
    _login(api_client, content_manager)

    response = api_client.post(f"{SECTIONS_URL}reorder/", {"order": [999999]}, format="json")
    assert response.status_code == 400


# --------------------------------------------------------------- حماية النشر


def test_publishing_thin_content_is_now_allowed(api_client, content_manager):
    # النشر أصبح اختياريًا بلا حد أدنى للمحتوى — الصفحة الرقيقة تُنشر.
    draft = Service.objects.filter(is_published=False).first()
    _login(api_client, content_manager)

    response = api_client.post(f"{SERVICES_URL}{draft.slug}/publish/")

    assert response.status_code == 200
    draft.refresh_from_db()
    assert draft.is_published is True


def test_publishing_succeeds_once_content_is_sufficient(api_client, content_manager):
    draft = Service.objects.filter(is_published=False).first()
    draft.description_ar = " ".join(["كلمة"] * 150)
    draft.features = [{"title_ar": f"ميزة {i}"} for i in range(3)]
    draft.save()
    _login(api_client, content_manager)

    response = api_client.post(f"{SERVICES_URL}{draft.slug}/publish/")

    assert response.status_code == 200
    draft.refresh_from_db()
    assert draft.is_published is True
    assert draft.published_at is not None


def test_serializer_allows_publishing_thin_content_on_update(api_client, content_manager):
    # لم يعد المسلسل يمنع نشر محتوى رقيق عبر PATCH — النشر اختياري.
    draft = Service.objects.filter(is_published=False).first()
    _login(api_client, content_manager)

    response = api_client.patch(
        f"{SERVICES_URL}{draft.slug}/", {"is_published": True}, format="json"
    )

    assert response.status_code == 200
    draft.refresh_from_db()
    assert draft.is_published is True


def test_updating_service_with_technologies_succeeds(api_client, content, content_manager):
    # ربط تقنيات (حقل m2m) عبر PATCH كان يسبّب 500 في التحقق — يجب أن ينجح.
    from apps.portfolio.models import Technology

    service = Service.objects.first()
    tech_ids = list(Technology.objects.values_list("id", flat=True)[:2])
    _login(api_client, content_manager)

    response = api_client.patch(
        f"{SERVICES_URL}{service.slug}/",
        {"technologies": tech_ids, "related_projects": []},
        format="json",
    )

    assert response.status_code == 200, response.data
    service.refresh_from_db()
    assert set(service.technologies.values_list("id", flat=True)) == set(tech_ids)


# --------------------------------------------------------------- الصلاحيات


def test_anonymous_visitors_cannot_create_content(api_client, content):
    response = api_client.post(
        SERVICES_URL, {"title_ar": "خدمة", "short_description_ar": "وصف"}, format="json"
    )
    assert response.status_code in (401, 403)


def test_plain_members_cannot_create_content(api_client, content, make_user):
    member = make_user(email="plain-member@example.com", role="member")
    _login(api_client, member)

    response = api_client.post(
        SERVICES_URL, {"title_ar": "خدمة", "short_description_ar": "وصف"}, format="json"
    )
    assert response.status_code == 403


def test_content_manager_can_create_a_draft_service(api_client, content_manager):
    _login(api_client, content_manager)

    response = api_client.post(
        SERVICES_URL,
        {
            "title_ar": "خدمة جديدة",
            "title_en": "New Service",
            "short_description_ar": "وصف مختصر للخدمة الجديدة",
            "kind": "service",
        },
        format="json",
    )

    assert response.status_code == 201, response.data
    created = Service.objects.get(title_ar="خدمة جديدة")
    assert created.slug == "new-service"
    assert created.is_published is False
    assert created.created_by == content_manager


def test_slug_is_generated_from_arabic_when_english_is_missing(api_client, content_manager):
    _login(api_client, content_manager)

    response = api_client.post(
        SERVICES_URL,
        {"title_ar": "نظام إدارة المخازن", "short_description_ar": "وصف", "kind": "service"},
        format="json",
    )

    assert response.status_code == 201
    slug = Service.objects.get(title_ar="نظام إدارة المخازن").slug
    assert slug and all(character.isascii() for character in slug)


# --------------------------------------------------------------- الأداء


def test_service_listing_does_not_scale_queries_with_row_count(
    api_client, content, django_assert_max_num_queries
):
    """حارس ضد استعلامات N+1 عند إضافة خدمات جديدة."""
    with django_assert_max_num_queries(8):
        response = api_client.get(SERVICES_URL, {"page_size": 50}, **AR)
    assert response.status_code == 200


def test_project_listing_prefetches_technologies(
    api_client, content, django_assert_max_num_queries
):
    with django_assert_max_num_queries(8):
        response = api_client.get(PROJECTS_URL, {"page_size": 50}, **AR)
    assert response.status_code == 200


# --------------------------------------------------------------- التهيئة


def test_seeding_twice_does_not_duplicate_records(content):
    before = (Service.objects.count(), Project.objects.count(), Technology.objects.count())
    call_command("seed_content", verbosity=0)
    after = (Service.objects.count(), Project.objects.count(), Technology.objects.count())

    assert before == after


def test_every_seeded_published_service_meets_the_content_bar(content):
    for service in Service.objects.filter(is_published=True):
        assert service.publication_blockers() == [], service.slug
