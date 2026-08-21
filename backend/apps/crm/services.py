"""منطق الأعمال لإدارة العملاء — يبقى خارج الـ Views ليعاد استخدامه واختباره."""

from django.db import transaction
from django.utils import timezone

from apps.crm.enums import LeadSource, LeadStatus
from apps.crm.models import Client, Lead, ProjectRequest
from apps.notifications.models import Notification


def _budget_label(request: ProjectRequest) -> str:
    return request.get_budget_range_display() if request.budget_range else ""


@transaction.atomic
def create_lead_from_request(request: ProjectRequest) -> Lead:
    """ينشئ عميلًا محتملًا من طلب مشروع، أو يربطه بعميل قائم بنفس البريد.

    يمنع التكرار: بريد مطابق لعميل محتمل نشط يُربط بدل إنشاء سجل جديد.
    """
    existing = None
    if request.email:
        existing = (
            Lead.objects.filter(email__iexact=request.email)
            .exclude(status__in=[LeadStatus.REJECTED, LeadStatus.ARCHIVED])
            .order_by("-created_at")
            .first()
        )

    if existing is not None:
        lead = existing
        # طلب جديد من عميل معروف يستحق ملاحظة على سجله
        lead.notes = (
            f"{lead.notes}\n\n[طلب جديد {request.reference_code}] "
            f"{request.get_project_type_display()}"
        ).strip()
        if not lead.expected_budget:
            lead.expected_budget = _budget_label(request)
        lead.save(update_fields=["notes", "expected_budget", "updated_at"])
    else:
        lead = Lead.objects.create(
            name=request.name or request.email or "عميل بلا اسم",
            company=request.company,
            email=request.email,
            phone=request.phone,
            whatsapp=request.whatsapp,
            country=request.country,
            city=request.city,
            source=LeadSource.WEBSITE_FORM,
            expected_budget=_budget_label(request),
            notes=request.description,
        )

    request.lead = lead
    request.save(update_fields=["lead", "updated_at"])
    return lead


@transaction.atomic
def convert_lead_to_client(lead: Lead) -> Client:
    """يحوّل عميلًا محتملًا إلى عميل، محتفظًا بالتاريخ كاملًا."""
    if hasattr(lead, "client") and lead.client is not None:
        return lead.client

    client = Client.objects.create(
        lead=lead,
        name=lead.name,
        company=lead.company,
        email=lead.email,
        phone=lead.phone,
        whatsapp=lead.whatsapp,
        country=lead.country,
        city=lead.city,
        notes=lead.notes,
        client_since=timezone.now().date(),
    )

    # نقل الملاحظات والتفاعلات والمتابعات المرتبطة إلى العميل
    lead.crm_notes.update(client=client)
    lead.interactions.update(client=client)
    lead.follow_ups.update(client=client)
    lead.attachments.update(client=client)

    lead.status = LeadStatus.ACCEPTED
    lead.save(update_fields=["status", "updated_at"])
    return client


def notify_new_request(request: ProjectRequest) -> None:
    """إشعار المديرين بوصول طلب مشروع جديد."""
    Notification.notify(
        Notification.Type.PROJECT_REQUEST,
        title_ar=f"طلب مشروع جديد {request.reference_code}",
        title_en=f"New project request {request.reference_code}",
        message_ar=(
            f"{request.get_project_type_display()} — "
            f"{request.name or request.email or 'بلا اسم'}"
        ),
        link=f"/dashboard/crm/requests/{request.id}",
        instance=request,
    )


def notify_new_contact(message) -> None:
    Notification.notify(
        Notification.Type.CONTACT_MESSAGE,
        title_ar=f"رسالة تواصل من {message.name}",
        title_en=f"Contact message from {message.name}",
        message_ar=message.subject or message.message[:80],
        link=f"/dashboard/crm/messages/{message.id}",
        instance=message,
    )
