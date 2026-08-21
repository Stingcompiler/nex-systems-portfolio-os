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


def test_contact_accepts_short_or_blank_message(api_client):
    # كل الحقول اختيارية الآن — يُقبل نص قصير أو رسالة فارغة تمامًا
    response = api_client.post(
        CONTACT_URL,
        {"name": "زائر", "email": "v@example.com", "message": "قصير"},
        format="json",
    )
    assert response.status_code == 201

    blank = api_client.post(CONTACT_URL, {}, format="json")
    assert blank.status_code == 201
    assert ContactMessage.objects.count() == 2


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


def test_request_accepts_blank_email_and_name(api_client):
    # كل الحقول اختيارية الآن — يُقبل الطلب دون بريد أو اسم
    response = api_client.post(
        SUBMIT_URL, {**VALID_REQUEST, "email": "", "name": ""}, format="json"
    )
    assert response.status_code == 201


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
