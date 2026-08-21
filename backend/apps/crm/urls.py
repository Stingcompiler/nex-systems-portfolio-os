from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.crm import views

app_name = "crm"

router = DefaultRouter()
router.register("leads", views.LeadViewSet, basename="lead")
router.register("clients", views.ClientViewSet, basename="client")
router.register("project-requests", views.ProjectRequestViewSet, basename="project-request")
router.register("contact-messages", views.ContactMessageViewSet, basename="contact-message")
router.register("crm/notes", views.CrmNoteViewSet, basename="crm-note")
router.register("crm/interactions", views.InteractionViewSet, basename="crm-interaction")
router.register("crm/follow-ups", views.FollowUpViewSet, basename="crm-followup")
router.register("crm/attachments", views.CrmAttachmentViewSet, basename="crm-attachment")

# نقاط عامة للنماذج — مسارات فرعية حتى لا تحجب قائمة الـ ViewSet على المسار الجذر
public_patterns = [
    path("contact-messages/submit/", views.ContactMessageCreateView.as_view(), name="contact-create"),
    path("project-requests/draft/", views.ProjectRequestDraftView.as_view(), name="request-draft"),
    path("project-requests/submit/", views.ProjectRequestSubmitView.as_view(), name="request-submit"),
]

urlpatterns = public_patterns + [path("", include(router.urls))]
