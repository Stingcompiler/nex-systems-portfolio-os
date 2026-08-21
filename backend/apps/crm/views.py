import csv

from django.db.models import Count
from django.http import HttpResponse
from django.utils import timezone
from drf_spectacular.utils import OpenApiResponse, extend_schema, extend_schema_view
from rest_framework import serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.audit import get_client_ip, log_action
from apps.core.mixins import AuditLogMixin
from apps.core.models.system import AuditLog
from apps.core.pagination import LargePagination, StandardPagination
from apps.core.throttling import AnonWriteThrottle
from apps.crm.enums import CLOSED_LEAD_STATUSES, LeadStatus, RequestStatus
from apps.crm.models import (
    Client,
    ContactMessage,
    CrmAttachment,
    CrmNote,
    FollowUp,
    Interaction,
    Lead,
    ProjectRequest,
)
from apps.crm.permissions import IsCrmStaff
from apps.crm.serializers import (
    ClientSerializer,
    ContactMessageAdminSerializer,
    ContactMessageCreateSerializer,
    CrmAttachmentSerializer,
    CrmNoteSerializer,
    FollowUpSerializer,
    InteractionSerializer,
    KanbanColumnSerializer,
    LeadDetailSerializer,
    LeadListSerializer,
    LeadWriteSerializer,
    ProjectRequestAdminSerializer,
    ProjectRequestDraftSerializer,
    ProjectRequestSubmitSerializer,
)
from apps.crm.services import convert_lead_to_client

# --------------------------------------------------------------- عام


class ContactMessageCreateView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [AnonWriteThrottle]
    serializer_class = ContactMessageCreateSerializer

    @extend_schema(
        summary="إرسال رسالة تواصل",
        request=ContactMessageCreateSerializer,
        responses={201: OpenApiResponse(description="أُرسلت الرسالة")},
    )
    def post(self, request):
        serializer = ContactMessageCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(ip_address=get_client_ip(request))
        return Response(
            {"detail": "وصلتنا رسالتك، وسنرد عليك قريبًا"},
            status=status.HTTP_201_CREATED,
        )


class ProjectRequestDraftView(APIView):
    """حفظ جزئي بعد الخطوة الأولى — يبقى draft حتى الإرسال النهائي."""

    permission_classes = [AllowAny]
    throttle_classes = [AnonWriteThrottle]
    serializer_class = ProjectRequestDraftSerializer

    @extend_schema(summary="حفظ مسودة طلب", request=ProjectRequestDraftSerializer)
    def post(self, request):
        serializer = ProjectRequestDraftSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        if not request.session.session_key:
            request.session.create()

        draft = serializer.save(
            status=RequestStatus.DRAFT,
            session_key=request.session.session_key,
            ip_address=get_client_ip(request),
        )
        return Response(
            ProjectRequestDraftSerializer(draft).data, status=status.HTTP_201_CREATED
        )


class ProjectRequestSubmitView(APIView):
    """الإرسال النهائي — يشغّل إنشاء Lead والإشعارات ورسالة التأكيد."""

    permission_classes = [AllowAny]
    throttle_classes = [AnonWriteThrottle]
    serializer_class = ProjectRequestSubmitSerializer

    @extend_schema(
        summary="إرسال طلب مشروع",
        request=ProjectRequestSubmitSerializer,
        responses={201: OpenApiResponse(description="أُرسل الطلب وأُنشئ Lead")},
    )
    def post(self, request):
        draft_id = request.data.get("id")
        instance = None
        if draft_id and request.session.session_key:
            # استكمال مسودة تخص هذه الجلسة فقط
            instance = ProjectRequest.objects.filter(
                id=draft_id,
                session_key=request.session.session_key,
                status=RequestStatus.DRAFT,
            ).first()

        serializer = ProjectRequestSubmitSerializer(instance, data=request.data)
        serializer.is_valid(raise_exception=True)

        project_request = serializer.save(
            status=RequestStatus.NEW,
            ip_address=get_client_ip(request),
        )
        # الإشارة تتولى إنشاء Lead والإشعار والتأكيد بعد الحفظ

        return Response(
            {
                "detail": "أُرسل طلبك بنجاح",
                "reference_code": project_request.reference_code,
            },
            status=status.HTTP_201_CREATED,
        )


# --------------------------------------------------------------- إداري


class CrmBaseViewSet(AuditLogMixin, viewsets.ModelViewSet):
    permission_classes = [IsCrmStaff]
    pagination_class = StandardPagination


@extend_schema_view(
    list=extend_schema(summary="طلبات المشاريع"),
    retrieve=extend_schema(summary="تفاصيل طلب"),
    partial_update=extend_schema(summary="تحديث حالة الطلب"),
)
class ProjectRequestViewSet(CrmBaseViewSet):
    queryset = ProjectRequest.objects.select_related("lead", "assigned_to").prefetch_related(
        "attachments"
    )
    serializer_class = ProjectRequestAdminSerializer
    filterset_fields = ["status", "project_type", "sector", "assigned_to"]
    search_fields = ["reference_code", "name", "email", "company"]
    ordering_fields = ["created_at", "status"]
    http_method_names = ["get", "patch", "delete", "head", "options"]

    def get_queryset(self):
        # المسودات المهجورة تظهر منفصلة عن الطلبات الحقيقية
        queryset = super().get_queryset()
        if self.request.query_params.get("include_drafts") != "true":
            queryset = queryset.exclude(status=RequestStatus.DRAFT)
        return queryset

    @extend_schema(summary="تحويل الطلب إلى عميل محتمل يدويًا", request=None)
    @action(detail=True, methods=["post"], url_path="convert-to-lead")
    def convert_to_lead(self, request, pk=None):
        from apps.crm.services import create_lead_from_request

        project_request = self.get_object()
        if project_request.lead_id:
            return Response(
                {"detail": "لهذا الطلب عميل محتمل بالفعل", "code": "already_linked",
                 "errors": {}},
                status=status.HTTP_400_BAD_REQUEST,
            )
        lead = create_lead_from_request(project_request)
        return Response(LeadListSerializer(lead, context={"request": request}).data)


@extend_schema_view(
    list=extend_schema(summary="رسائل التواصل"),
    partial_update=extend_schema(summary="تحديث حالة الرسالة"),
)
class ContactMessageViewSet(CrmBaseViewSet):
    queryset = ContactMessage.objects.select_related("lead").all()
    serializer_class = ContactMessageAdminSerializer
    filterset_fields = ["status"]
    search_fields = ["name", "email", "subject"]
    ordering_fields = ["created_at"]
    http_method_names = ["get", "patch", "delete", "head", "options"]


@extend_schema_view(
    list=extend_schema(summary="العملاء المحتملون"),
    create=extend_schema(summary="إضافة عميل محتمل"),
    retrieve=extend_schema(summary="تفاصيل عميل محتمل"),
    partial_update=extend_schema(summary="تعديل عميل محتمل"),
    destroy=extend_schema(summary="حذف عميل محتمل"),
)
class LeadViewSet(CrmBaseViewSet):
    queryset = Lead.objects.select_related("owner").prefetch_related("services")
    filterset_fields = ["status", "priority", "source", "owner", "country"]
    search_fields = ["name", "company", "email", "phone"]
    ordering_fields = ["created_at", "next_follow_up_at", "last_contact_at"]

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return LeadWriteSerializer
        if self.action == "retrieve":
            return LeadDetailSerializer
        return LeadListSerializer

    @extend_schema(
        summary="العملاء المحتملون مرتبين على شكل لوحة Kanban",
        responses={200: KanbanColumnSerializer(many=True)},
    )
    @action(detail=False, methods=["get"], url_path="kanban")
    def kanban(self, request):
        # الأعمدة المفتوحة فقط — المنتهية تُخفى من اللوحة النشطة
        active_statuses = [
            (value, label)
            for value, label in LeadStatus.choices
            if value not in CLOSED_LEAD_STATUSES
        ]
        leads = self.filter_queryset(
            self.get_queryset().exclude(status__in=CLOSED_LEAD_STATUSES)
        )

        grouped: dict[str, list] = {value: [] for value, _ in active_statuses}
        for lead in leads:
            grouped.setdefault(lead.status, []).append(lead)

        columns = [
            {
                "status": value,
                "status_display": label,
                "count": len(grouped.get(value, [])),
                "leads": LeadListSerializer(
                    grouped.get(value, []), many=True, context={"request": request}
                ).data,
            }
            for value, label in active_statuses
        ]
        return Response(columns)

    @extend_schema(summary="تحويل عميل محتمل إلى عميل", request=None,
                   responses={200: ClientSerializer})
    @action(detail=True, methods=["post"], url_path="convert")
    def convert(self, request, pk=None):
        lead = self.get_object()
        client = convert_lead_to_client(lead)
        log_action(
            AuditLog.Action.UPDATE, instance=lead, request=request,
            changes={"converted_to_client": client.id},
        )
        return Response(ClientSerializer(client, context={"request": request}).data)

    @extend_schema(summary="تصدير العملاء المحتملين CSV")
    @action(detail=False, methods=["get"], url_path="export")
    def export(self, request):
        if not (request.user.is_superuser or request.user.has_perm("crm.export_leads")):
            return Response(
                {"detail": "لا تملك صلاحية التصدير", "code": "permission_denied",
                 "errors": {}},
                status=status.HTTP_403_FORBIDDEN,
            )

        leads = self.filter_queryset(self.get_queryset())
        response = HttpResponse(content_type="text/csv; charset=utf-8-sig")
        response["Content-Disposition"] = (
            f'attachment; filename="leads-{timezone.localdate()}.csv"'
        )
        response.write("﻿")  # BOM كي يفتح Excel العربية سليمة

        writer = csv.writer(response)
        writer.writerow([
            "الاسم", "الشركة", "البريد", "الهاتف", "الدولة",
            "المصدر", "الحالة", "الأولوية", "الميزانية", "تاريخ الإنشاء",
        ])
        for lead in leads:
            writer.writerow([
                lead.name, lead.company, lead.email, lead.phone, lead.country,
                lead.get_source_display(), lead.get_status_display(),
                lead.get_priority_display(), lead.expected_budget,
                lead.created_at.strftime("%Y-%m-%d"),
            ])

        log_action(AuditLog.Action.EXPORT, request=request, model_name="Lead",
                   object_repr=f"{leads.count()} عميل محتمل")
        return response


@extend_schema_view(
    list=extend_schema(summary="العملاء"),
    create=extend_schema(summary="إضافة عميل"),
    retrieve=extend_schema(summary="تفاصيل عميل"),
    partial_update=extend_schema(summary="تعديل عميل"),
)
class ClientViewSet(CrmBaseViewSet):
    queryset = Client.objects.select_related("lead", "user").prefetch_related("projects")
    serializer_class = ClientSerializer
    filterset_fields = ["is_active", "country"]
    search_fields = ["name", "company", "email"]
    ordering_fields = ["created_at", "client_since"]


class CrmNoteViewSet(CrmBaseViewSet):
    queryset = CrmNote.objects.select_related("created_by").all()
    serializer_class = CrmNoteSerializer
    filterset_fields = ["lead", "client"]
    ordering_fields = ["created_at"]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class InteractionViewSet(CrmBaseViewSet):
    queryset = Interaction.objects.select_related("created_by").all()
    serializer_class = InteractionSerializer
    filterset_fields = ["lead", "client", "type"]
    ordering_fields = ["occurred_at", "created_at"]

    def perform_create(self, serializer):
        # تسجيل التواصل يحدّث تواريخ العميل المحتمل عبر الإشارة
        serializer.save(created_by=self.request.user)


class FollowUpViewSet(CrmBaseViewSet):
    queryset = FollowUp.objects.select_related("assigned_to", "lead", "client").all()
    serializer_class = FollowUpSerializer
    filterset_fields = ["lead", "client", "status", "assigned_to"]
    ordering_fields = ["due_at"]

    def get_queryset(self):
        queryset = super().get_queryset()
        due = self.request.query_params.get("due")
        now = timezone.now()
        if due == "today":
            queryset = queryset.filter(due_at__date=timezone.localdate())
        elif due == "overdue":
            queryset = queryset.filter(due_at__lt=now, status="pending")
        elif due == "week":
            from datetime import timedelta

            queryset = queryset.filter(due_at__range=(now, now + timedelta(days=7)))
        return queryset


class CrmAttachmentViewSet(CrmBaseViewSet):
    queryset = CrmAttachment.objects.all()
    serializer_class = CrmAttachmentSerializer
    filterset_fields = ["lead", "client"]

    def perform_create(self, serializer):
        uploaded = self.request.data.get("file")
        serializer.save(
            uploaded_by=self.request.user,
            name=getattr(uploaded, "name", "ملف")[:255],
        )
