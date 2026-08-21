"""أتمتة إدارة العملاء: إنشاء Lead، الإشعارات، تحديث التواصل."""

from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.crm.enums import RequestStatus
from apps.crm.models import ContactMessage, Interaction, ProjectRequest


@receiver(post_save, sender=ProjectRequest)
def on_project_request(sender, instance: ProjectRequest, created: bool, **kwargs):
    """عند اكتمال طلب: إنشاء Lead + رسالة تأكيد + إشعار المدير.

    يُتجاهل المسودات (draft) والطلبات التي أُنشئ لها Lead مسبقًا، فلا
    يتكرر شيء عند التعديلات اللاحقة على الطلب.
    """
    # الاستيراد داخل الدالة يمنع دورات الاستيراد مع services/emails
    from apps.crm import emails, services

    if instance.status == RequestStatus.DRAFT:
        return
    if instance.lead_id is not None:
        return

    services.create_lead_from_request(instance)
    services.notify_new_request(instance)
    emails.queue_request_confirmation(instance)


@receiver(post_save, sender=ContactMessage)
def on_contact_message(sender, instance: ContactMessage, created: bool, **kwargs):
    if not created:
        return

    from apps.crm import emails, services

    services.notify_new_contact(instance)
    emails.queue_contact_confirmation(instance)


@receiver(post_save, sender=Interaction)
def on_interaction(sender, instance: Interaction, created: bool, **kwargs):
    """تسجيل تواصل يحدّث تواريخ آخر تواصل على العميل المحتمل."""
    if created and instance.lead_id:
        instance.lead.touch_contact()
