"""اختبارات إدارة العملاء: الطلبات، إنشاء Lead، التحويل، العزل."""

import pytest
from django.core import mail
from django.core.management import call_command

from apps.crm.enums import LeadStatus, RequestStatus
from apps.crm.models import Client, ContactMessage, Lead, ProjectRequest
from apps.notifications.models import Notification

pytestmark = pytest.mark.django_db

CONTACT_URL = "/api/v1/contact-messages/submit/"
DRAFT_URL = "/api/v1/project-requests/draft/"
SUBMIT_URL = "/api/v1/project-requests/submit/"
LEADS_URL = "/api/v1/leads/"
CLIENTS_URL = "/api/v1/clients/"


@pytest.fixture
def seeded(db):
    call_command("seed_groups", verbosity=0)


@pytest.fixture
def make_service(db):
    from apps.portfolio.models import Service

    def factory(**fields):
        service = Service.objects.create(title_ar="نظام مدرسي", **fields)
        service.publish()
        return service

    return factory


@pytest.fixture
def crm_manager(seeded, make_user):
    return make_user(email="crm@example.com", role="crm_manager")


def _login(client, user):
    response = client.post(
        "/api/v1/auth/login/",
        {"email": user.email, "password": user.raw_password},
        format="json",
    )
    assert response.status_code == 200, response.data
    return client


VALID_REQUEST = {
    "project_type": "system",
    "sector": "education",
    "requirements": {"needs_android": True, "expected_users": 500},
    "description": "نظام إدارة مدرسة متكامل",
    "budget_range": "2000_5000",
    "timeline": "medium",
    "name": "مصعب أحمد",
    "email": "client@example.com",
    "phone": "+249900000000",
    "preferred_language": "ar",
}


# --------------------------------------------------------------- نموذج التواصل


def test_contact_message_creates_and_notifies(api_client):
    response = api_client.post(
        CONTACT_URL,
        {
            "name": "زائر",
            "email": "visitor@example.com",
            "message": "أرغب في الاستفسار عن خدماتكم",
        },
        format="json",
    )

    assert response.status_code == 201
    assert ContactMessage.objects.count() == 1
    # إشعار للمدير + رسالة تأكيد للزائر
    assert Notification.objects.filter(type="contact_message").count() == 1
    assert any("visitor@example.com" in message.to for message in mail.outbox)


def test_contact_honeypot_blocks_spam(api_client):
    response = api_client.post(
        CONTACT_URL,
        {
            "name": "بوت",
            "email": "bot@example.com",
            "message": "رسالة سبام طويلة بما يكفي",
            "website": "http://spam.example",
        },
        format="json",
    )

    assert response.status_code == 400
    assert ContactMessage.objects.count() == 0


def test_contact_accepts_short_message_with_one_channel(api_client):
    # نص قصير مقبول ما دام هناك ما يُقرأ ووسيلة للرد
    by_email = api_client.post(
        CONTACT_URL,
        {"name": "زائر", "email": "v@example.com", "message": "قصير"},
        format="json",
    )
    assert by_email.status_code == 201

    by_phone = api_client.post(
        CONTACT_URL, {"phone": "+249900000000", "message": "اتصلوا بي"}, format="json"
    )
    assert by_phone.status_code == 201
    assert ContactMessage.objects.count() == 2


def test_contact_rejects_unanswerable_message(api_client):
    blank = api_client.post(CONTACT_URL, {}, format="json")
    assert blank.status_code == 400
    assert "message" in blank.data["errors"]

    no_channel = api_client.post(CONTACT_URL, {"message": "مرحبًا"}, format="json")
    assert no_channel.status_code == 400
    assert "contact" in no_channel.data["errors"]
    assert ContactMessage.objects.count() == 0


# --------------------------------------------------------------- طلب المشروع


def test_project_request_submit_creates_lead_and_notifies(api_client):
    response = api_client.post(SUBMIT_URL, VALID_REQUEST, format="json")

    assert response.status_code == 201
    assert response.data["reference_code"].startswith("REQ-")

    request_obj = ProjectRequest.objects.get()
    assert request_obj.status == RequestStatus.NEW
    assert request_obj.lead is not None

    lead = Lead.objects.get()
    assert lead.email == "client@example.com"
    assert lead.source == "website_form"

    assert Notification.objects.filter(type="project_request").count() == 1
    assert any("client@example.com" in message.to for message in mail.outbox)


def test_reference_codes_are_sequential(api_client):
    first = api_client.post(SUBMIT_URL, VALID_REQUEST, format="json").data["reference_code"]
    second = api_client.post(
        SUBMIT_URL, {**VALID_REQUEST, "email": "other@example.com"}, format="json"
    ).data["reference_code"]

    assert first != second
    assert int(first.rsplit("-", 1)[1]) + 1 == int(second.rsplit("-", 1)[1])


def test_request_honeypot_blocks_spam(api_client):
    response = api_client.post(
        SUBMIT_URL, {**VALID_REQUEST, "website": "http://spam"}, format="json"
    )
    assert response.status_code == 400
    assert ProjectRequest.objects.count() == 0


def test_request_accepts_phone_only_without_name(api_client):
    # الاسم اختياري، والهاتف وحده وسيلة رد كافية
    response = api_client.post(
        SUBMIT_URL, {**VALID_REQUEST, "email": "", "name": ""}, format="json"
    )
    assert response.status_code == 201

    lead = Lead.objects.get()
    assert lead.phone == "+249900000000"
    # لا بريد = لا رسالة تأكيد، دون أن يفشل الإرسال
    assert not any(message.to == [""] for message in mail.outbox)


def test_request_requires_a_contact_channel(api_client):
    response = api_client.post(
        SUBMIT_URL, {**VALID_REQUEST, "email": "", "phone": ""}, format="json"
    )
    assert response.status_code == 400
    assert "contact" in response.data["errors"]
    assert ProjectRequest.objects.count() == 0


def test_request_requires_a_description(api_client):
    missing = {key: value for key, value in VALID_REQUEST.items() if key != "description"}
    for payload in (missing, {**VALID_REQUEST, "description": "   نظام  "}):
        response = api_client.post(SUBMIT_URL, payload, format="json")
        assert response.status_code == 400
        assert "description" in response.data["errors"]
    assert ProjectRequest.objects.count() == 0


def test_request_rejects_empty_submission(api_client):
    response = api_client.post(SUBMIT_URL, {}, format="json")
    assert response.status_code == 400
    assert ProjectRequest.objects.count() == 0


def test_request_retry_with_same_submission_id_is_not_duplicated(api_client):
    payload = {**VALID_REQUEST, "submission_id": "3f1c9a7e-retry"}
    first = api_client.post(SUBMIT_URL, payload, format="json")
    retry = api_client.post(SUBMIT_URL, payload, format="json")

    assert first.status_code == 201
    assert retry.status_code == 200
    assert retry.data["reference_code"] == first.data["reference_code"]
    assert ProjectRequest.objects.count() == 1
    assert Lead.objects.count() == 1
    assert Notification.objects.filter(type="project_request").count() == 1


def test_request_carries_service_context(api_client, make_service):
    service = make_service(slug="school-system")
    response = api_client.post(
        SUBMIT_URL, {**VALID_REQUEST, "service": "school-system"}, format="json"
    )
    assert response.status_code == 201
    assert ProjectRequest.objects.get().service == service


def test_request_rejects_unknown_service(api_client):
    response = api_client.post(
        SUBMIT_URL, {**VALID_REQUEST, "service": "does-not-exist"}, format="json"
    )
    assert response.status_code == 400
    assert "service" in response.data["errors"]


def test_draft_then_submit_completes_same_record(api_client):
    draft = api_client.post(
        DRAFT_URL, {"project_type": "system", "sector": "education"}, format="json"
    )
    assert draft.status_code == 201
    draft_id = draft.data["id"]

    # المسودة لا تُنشئ Lead ولا إشعارًا بعد
    assert Lead.objects.count() == 0
    assert ProjectRequest.objects.get().status == RequestStatus.DRAFT

    submit = api_client.post(SUBMIT_URL, {**VALID_REQUEST, "id": draft_id}, format="json")
    assert submit.status_code == 201

    # نفس السجل اكتمل، لا سجل جديد
    assert ProjectRequest.objects.count() == 1
    assert Lead.objects.count() == 1


def test_duplicate_email_links_to_existing_lead(api_client):
    r1 = api_client.post(SUBMIT_URL, VALID_REQUEST, format="json")
    r2 = api_client.post(
        SUBMIT_URL, {**VALID_REQUEST, "project_type": "website"}, format="json"
    )
    assert r1.status_code == 201, r1.data
    assert r2.status_code == 201, r2.data

    # طلبان لكن عميل محتمل واحد
    assert ProjectRequest.objects.count() == 2
    assert Lead.objects.count() == 1


# --------------------------------------------------------------- عزل CRM


def test_leads_require_crm_permission(api_client, seeded, make_user):
    member = make_user(email="member@example.com", role="member")
    _login(api_client, member)
    assert api_client.get(LEADS_URL).status_code == 403


def test_content_manager_cannot_access_leads(api_client, seeded, make_user):
    manager = make_user(email="cm@example.com", role="content_manager")
    _login(api_client, manager)
    assert api_client.get(LEADS_URL).status_code == 403


def test_crm_manager_lists_leads(api_client, crm_manager):
    Lead.objects.create(name="عميل تجريبي", email="l@example.com")
    _login(api_client, crm_manager)

    response = api_client.get(LEADS_URL)
    assert response.status_code == 200
    assert response.data["count"] == 1


# --------------------------------------------------------------- Kanban والتحويل


def test_kanban_groups_by_status_and_excludes_closed(api_client, crm_manager):
    Lead.objects.create(name="جديد", status=LeadStatus.NEW)
    Lead.objects.create(name="تفاوض", status=LeadStatus.NEGOTIATING)
    Lead.objects.create(name="مرفوض", status=LeadStatus.REJECTED)
    _login(api_client, crm_manager)

    response = api_client.get(f"{LEADS_URL}kanban/")
    assert response.status_code == 200

    columns = {column["status"]: column for column in response.data}
    assert columns["new"]["count"] == 1
    assert columns["negotiating"]["count"] == 1
    # الحالات المنتهية لا تظهر كأعمدة
    assert "rejected" not in columns


def test_convert_lead_to_client_preserves_history(api_client, crm_manager):
    lead = Lead.objects.create(name="عميل", email="c@example.com", notes="ملاحظة مهمة")
    lead.crm_notes.create(content="ملاحظة على العميل المحتمل")
    _login(api_client, crm_manager)

    response = api_client.post(f"{LEADS_URL}{lead.id}/convert/")
    assert response.status_code == 200

    client = Client.objects.get()
    assert client.lead_id == lead.id
    assert client.name == "عميل"
    # الملاحظة انتقلت إلى العميل
    assert client.crm_notes.count() == 1

    lead.refresh_from_db()
    assert lead.status == LeadStatus.ACCEPTED


def test_convert_is_idempotent(api_client, crm_manager):
    lead = Lead.objects.create(name="عميل", email="c@example.com")
    _login(api_client, crm_manager)

    first = api_client.post(f"{LEADS_URL}{lead.id}/convert/")
    second = api_client.post(f"{LEADS_URL}{lead.id}/convert/")

    assert first.data["id"] == second.data["id"]
    assert Client.objects.count() == 1


# --------------------------------------------------------------- التصدير


def test_export_requires_permission(api_client, seeded, make_user):
    """CRM Manager يملك export_leads، فالتصدير متاح له."""
    manager = make_user(email="crm@example.com", role="crm_manager")
    Lead.objects.create(name="عميل", email="l@example.com")
    _login(api_client, manager)

    response = api_client.get(f"{LEADS_URL}export/")
    assert response.status_code == 200
    assert response["Content-Type"].startswith("text/csv")
    assert "عميل" in response.content.decode("utf-8-sig")


# --------------------------------------------------------------- التفاعلات


def test_interaction_updates_lead_contact_dates(api_client, crm_manager):
    lead = Lead.objects.create(name="عميل", email="c@example.com")
    assert lead.first_contact_at is None
    _login(api_client, crm_manager)

    response = api_client.post(
        "/api/v1/crm/interactions/",
        {"lead": lead.id, "type": "call", "direction": "outbound", "summary": "مكالمة أولى"},
        format="json",
    )
    assert response.status_code == 201

    lead.refresh_from_db()
    assert lead.first_contact_at is not None
    assert lead.last_contact_at is not None


def test_note_requires_a_target(api_client, crm_manager):
    _login(api_client, crm_manager)
    response = api_client.post(
        "/api/v1/crm/notes/", {"content": "ملاحظة بلا هدف"}, format="json"
    )
    assert response.status_code == 400


def test_follow_up_records_and_filters_overdue(api_client, crm_manager):
    from datetime import timedelta

    from django.utils import timezone

    lead = Lead.objects.create(name="عميل", email="c@example.com")
    _login(api_client, crm_manager)

    api_client.post(
        "/api/v1/crm/follow-ups/",
        {
            "lead": lead.id,
            "title": "اتصال متابعة",
            "due_at": (timezone.now() - timedelta(days=1)).isoformat(),
        },
        format="json",
    )

    overdue = api_client.get("/api/v1/crm/follow-ups/?due=overdue")
    assert overdue.status_code == 200
    assert overdue.data["count"] == 1
    assert overdue.data["results"][0]["is_overdue"] is True


# --------------------------------------------------------------- بوابة العميل

MINE_URL = "/api/v1/project-requests/mine/"


def _submit(api_client, email, **extra):
    response = api_client.post(SUBMIT_URL, {**VALID_REQUEST, "email": email, **extra}, format="json")
    assert response.status_code == 201, response.data
    api_client.cookies.clear()
    return response.data["reference_code"]


def test_my_requests_requires_login(api_client):
    assert api_client.get(MINE_URL).status_code == 401


def test_client_sees_own_requests_by_verified_email(api_client, make_user):
    mine = _submit(api_client, "Client@Example.com")
    _submit(api_client, "someone-else@example.com")
    user = make_user(email="client@example.com", role="member")
    _login(api_client, user)

    data = api_client.get(MINE_URL).data
    assert [row["reference_code"] for row in data] == [mine]
    # بيانات العميل وحالته فقط — لا أدوات الفريق
    assert set(data[0]) == {
        "id", "reference_code", "status", "created_at", "updated_at",
        "project_type", "project_type_display", "service_title",
        "description", "budget_display", "timeline_display",
    }


def test_unverified_email_does_not_reveal_requests(api_client, make_user):
    """تسجيل حساب ببريد شخص آخر دون تأكيده لا يكشف طلباته."""
    _submit(api_client, "victim@example.com")
    impostor = make_user(email="victim@example.com", role="member", verified=False)
    _login(api_client, impostor)
    assert api_client.get(MINE_URL).data == []


def test_client_linked_by_crm_sees_requests_with_other_email(api_client, make_user):
    _submit(api_client, "office@company.example")
    request_obj = ProjectRequest.objects.get()
    user = make_user(email="owner@personal.example", role="client")
    Client.objects.create(lead=request_obj.lead, user=user, name="شركة")
    _login(api_client, user)

    data = api_client.get(MINE_URL).data
    assert [row["reference_code"] for row in data] == [request_obj.reference_code]
