"""متابعة الطلبات والرسائل: البحث بمفتاحين، صفحة المتابعة، ردود الفريق."""

import pytest
from django.core import mail
from django.core.management import call_command

from apps.crm.enums import ContactStatus
from apps.crm.models import ClientReply, ContactMessage, ProjectRequest
from apps.crm.tracking import classify

pytestmark = pytest.mark.django_db

SUBMIT_URL = "/api/v1/project-requests/submit/"
CONTACT_URL = "/api/v1/contact-messages/submit/"
TRACK_URL = "/api/v1/track/"

REQUEST = {
    "project_type": "system",
    "sector": "education",
    "description": "نظام إدارة مدرسة متكامل",
    "name": "مصعب أحمد",
    "email": "Client@Example.com",
    "phone": "+249 912 345 678",
    "preferred_language": "ar",
}


@pytest.fixture
def crm_manager(db, make_user):
    call_command("seed_groups", verbosity=0)
    return make_user(email="crm@example.com", role="crm_manager")


def _login(client, user):
    response = client.post(
        "/api/v1/auth/login/",
        {"email": user.email, "password": user.raw_password},
        format="json",
    )
    assert response.status_code == 200, response.data
    return client


def _submit(api_client, **overrides):
    response = api_client.post(SUBMIT_URL, {**REQUEST, **overrides}, format="json")
    assert response.status_code == 201, response.data
    return response.data


# --------------------------------------------------------------- المفاتيح


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("req-2026-0001", ("reference", "REQ-2026-0001")),
        (" MSG-2026-12 ", ("reference", "MSG-2026-12")),
        ("A@B.com", ("email", "a@b.com")),
        ("0912345678", ("phone", "912345678")),
        ("+249 91 234 5678", ("phone", "912345678")),
        ("٠٩١٢٣٤٥٦٧٨", ("phone", "912345678")),
        ("مرحبا", None),
        ("123", None),
    ],
)
def test_keys_are_classified(raw, expected):
    assert classify(raw) == expected


# --------------------------------------------------------------- الإرسال


def test_submissions_return_a_tracking_token(api_client):
    request = _submit(api_client)
    assert request["reference_code"].startswith("REQ-")
    assert len(request["tracking_token"]) >= 20

    message = api_client.post(
        CONTACT_URL, {"name": "زائر", "email": "v@example.com", "message": "استفسار عن الخدمات"},
        format="json",
    ).data
    assert message["reference_code"].startswith("MSG-")
    assert message["tracking_token"] != request["tracking_token"]


def test_confirmation_email_links_to_the_tracking_page(api_client):
    token = _submit(api_client)["tracking_token"]
    assert any(f"/track/{token}" in email.alternatives[0][0] for email in mail.outbox)


# --------------------------------------------------------------- البحث


@pytest.mark.parametrize(
    ("first", "second"),
    [
        ("{ref}", "client@example.com"),
        ("client@example.com", "{ref}"),
        ("{ref}", "0912345678"),
        ("CLIENT@example.com", "+249912345678"),
    ],
)
def test_two_matching_keys_find_the_request(api_client, first, second):
    created = _submit(api_client)
    ref = created["reference_code"]

    response = api_client.post(
        TRACK_URL, {"first": first.format(ref=ref), "second": second.format(ref=ref)},
        format="json",
    )

    assert response.status_code == 200, response.data
    assert [row["tracking_token"] for row in response.data] == [created["tracking_token"]]
    assert response.data[0]["kind"] == "request"


def test_contact_messages_are_found_too(api_client):
    created = api_client.post(
        CONTACT_URL,
        {"name": "زائر", "phone": "0911111111", "message": "هل تعملون في الخليج؟"},
        format="json",
    ).data

    response = api_client.post(
        TRACK_URL, {"first": created["reference_code"], "second": "+249911111111"}, format="json"
    )

    assert response.status_code == 200
    assert response.data[0]["kind"] == "message"


def test_email_and_phone_list_every_matching_item(api_client):
    _submit(api_client)
    _submit(api_client, description="موقع تعريفي لشركة توزيع")
    _submit(api_client, email="other@example.com", description="طلب لعميل آخر مختلف")

    response = api_client.post(
        TRACK_URL, {"first": "client@example.com", "second": "0912345678"}, format="json"
    )

    assert response.status_code == 200
    assert len(response.data) == 2


def test_a_wrong_second_key_reveals_nothing(api_client):
    ref = _submit(api_client)["reference_code"]

    response = api_client.post(
        TRACK_URL, {"first": ref, "second": "someone@else.com"}, format="json"
    )

    assert response.status_code == 404
    assert "tracking_token" not in str(response.data)


@pytest.mark.parametrize(
    ("first", "second", "code"),
    [
        ("client@example.com", "other@example.com", "same_kind"),
        ("كلام", "client@example.com", "unrecognized"),
    ],
)
def test_bad_key_pairs_are_rejected(api_client, first, second, code):
    response = api_client.post(TRACK_URL, {"first": first, "second": second}, format="json")
    assert response.status_code == 400
    assert response.data["code"] == code


def test_drafts_cannot_be_tracked(api_client):
    draft = ProjectRequest.objects.create(
        status="draft", email="client@example.com", phone="0912345678"
    )
    response = api_client.post(
        TRACK_URL, {"first": draft.reference_code, "second": "client@example.com"}, format="json"
    )
    assert response.status_code == 404
    assert api_client.get(f"{TRACK_URL}{draft.tracking_token}/").status_code == 404


def test_lookup_is_rate_limited(api_client):
    statuses = [
        api_client.post(
            TRACK_URL, {"first": f"REQ-2026-{i:04d}", "second": "x@example.com"}, format="json"
        ).status_code
        for i in range(12)
    ]
    assert 429 in statuses


# --------------------------------------------------------------- صفحة المتابعة


def test_tracking_page_shows_status_without_contact_details(api_client):
    token = _submit(api_client)["tracking_token"]

    response = api_client.get(f"{TRACK_URL}{token}/")

    assert response.status_code == 200
    assert response.data["status"] == "new"
    assert response.data["name"] == "مصعب"
    assert response.data["body"] == REQUEST["description"]
    assert "email" not in response.data and "phone" not in response.data
    assert "no-store" in response["Cache-Control"]


def test_unknown_token_is_404(api_client):
    assert api_client.get(f"{TRACK_URL}not-a-real-token/").status_code == 404


# --------------------------------------------------------------- ردود الفريق


def test_staff_reply_reaches_the_tracking_page_and_email(api_client, crm_manager):
    created = _submit(api_client)
    request = ProjectRequest.objects.get(tracking_token=created["tracking_token"])
    mail.outbox.clear()

    _login(api_client, crm_manager)
    response = api_client.post(
        f"/api/v1/project-requests/{request.pk}/replies/",
        {"body": "راجعنا طلبك، وسنرسل العرض خلال يومين."},
        format="json",
    )
    assert response.status_code == 201, response.data
    assert response.data["author_name"]

    api_client.logout()
    api_client.cookies.clear()
    page = api_client.get(f"{TRACK_URL}{created['tracking_token']}/").data
    assert [reply["body"] for reply in page["replies"]] == ["راجعنا طلبك، وسنرسل العرض خلال يومين."]
    assert "author_name" not in page["replies"][0]

    assert len(mail.outbox) == 1
    assert mail.outbox[0].to == ["client@example.com"]
    assert created["tracking_token"] in mail.outbox[0].alternatives[0][0]


def test_replying_to_a_message_marks_it_replied(api_client, crm_manager):
    message = ContactMessage.objects.create(name="زائر", email="v@example.com", message="سؤال")
    _login(api_client, crm_manager)

    response = api_client.post(
        f"/api/v1/contact-messages/{message.pk}/replies/", {"body": "أهلًا، نعم نعمل هناك."},
        format="json",
    )

    assert response.status_code == 201
    message.refresh_from_db()
    assert message.status == ContactStatus.REPLIED
    detail = api_client.get(f"/api/v1/contact-messages/{message.pk}/").data
    assert [reply["body"] for reply in detail["replies"]] == ["أهلًا، نعم نعمل هناك."]


def test_visitors_cannot_post_replies(api_client, member):
    message = ContactMessage.objects.create(name="زائر", email="v@example.com", message="سؤال")
    _login(api_client, member)

    response = api_client.post(
        f"/api/v1/contact-messages/{message.pk}/replies/", {"body": "رد مزيف"}, format="json"
    )

    assert response.status_code == 403
    assert not ClientReply.objects.exists()


def test_empty_reply_is_rejected(api_client, crm_manager):
    message = ContactMessage.objects.create(name="زائر", email="v@example.com", message="سؤال")
    _login(api_client, crm_manager)
    response = api_client.post(
        f"/api/v1/contact-messages/{message.pk}/replies/", {"body": "  "}, format="json"
    )
    assert response.status_code == 400


def test_messages_get_sequential_references():
    first = ContactMessage.objects.create(message="أ")
    second = ContactMessage.objects.create(message="ب")
    assert first.reference_code.startswith("MSG-")
    assert int(second.reference_code.rsplit("-", 1)[1]) == int(
        first.reference_code.rsplit("-", 1)[1]
    ) + 1


def test_staff_still_cannot_create_records_directly(api_client, crm_manager):
    _login(api_client, crm_manager)
    for url in ("/api/v1/project-requests/", "/api/v1/contact-messages/"):
        assert api_client.post(url, {"message": "x"}, format="json").status_code == 405
