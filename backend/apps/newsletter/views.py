import csv
from datetime import timedelta

from django.db.models import Count, F, Q
from django.db.models.functions import TruncDate
from django.http import HttpResponse, HttpResponseRedirect
from django.utils import timezone
from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.audit import get_client_ip, log_action
from apps.core.mixins import AuditLogMixin
from apps.core.models.system import AuditLog
from apps.core.pagination import LargePagination, StandardPagination
from apps.core.permissions import HasDashboardPermission
from apps.core.throttling import AnonWriteThrottle
from apps.newsletter import services
from apps.newsletter.models import Campaign, CampaignRecipient, EmailTemplate, Interest, Subscriber
from apps.newsletter.serializers import (
    CampaignListSerializer,
    CampaignRecipientSerializer,
    CampaignSerializer,
    DraftFromContentSerializer,
    EmailTemplateSerializer,
    InterestAdminSerializer,
    InterestSerializer,
    PreferencesSerializer,
    ScheduleSerializer,
    SubscribeSerializer,
    SubscriberAdminSerializer,
    TestSendSerializer,
    TokenSerializer,
    UnsubscribeSerializer,
)
from apps.newsletter.tasks import send_campaign_test

#: رسالة واحدة محايدة لكل نتائج الاشتراك — لا تكشف وجود البريد لدينا
SUBSCRIBE_MESSAGE = {
    "ar": "إن كان بريدك جديدًا لدينا فستصلك رسالة تأكيد خلال دقائق.",
    "en": "If your email is new to us, a confirmation message will arrive within minutes.",
}

#: أقل زمن مقبول بين تحميل النموذج والإرسال — أقل منه سلوك آلي
MIN_FORM_SECONDS = 2

#: صورة GIF شفافة 1×1 لبيكسل الفتح
_PIXEL = (
    b"GIF89a\x01\x00\x01\x00\x80\x00\x00\x00\x00\x00\x00\x00\x00!\xf9\x04\x01\x00\x00\x00\x00,"
    b"\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02D\x01\x00;"
)


def _error(exc: services.NewsletterError, http_status=status.HTTP_400_BAD_REQUEST):
    return Response({"detail": exc.message, "code": exc.code, "errors": {}}, status=http_status)


# --------------------------------------------------------------- عام


class InterestListView(APIView):
    permission_classes = [AllowAny]
    serializer_class = InterestSerializer

    @extend_schema(summary="اهتمامات النشرة", responses={200: InterestSerializer(many=True)})
    def get(self, request):
        return Response(InterestSerializer(Interest.objects.all(), many=True).data)


class SubscribeView(APIView):
    """الاشتراك بتأكيد مزدوج. الاستجابة واحدة مهما كانت حالة البريد."""

    permission_classes = [AllowAny]
    throttle_classes = [AnonWriteThrottle]
    serializer_class = SubscribeSerializer

    @extend_schema(summary="الاشتراك في النشرة", request=SubscribeSerializer)
    def post(self, request):
        serializer = SubscribeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        language = data.get("language", "ar")
        message = {"detail": SUBSCRIBE_MESSAGE[language]}

        # حقل خادع أو إرسال أسرع من بشر: رفض صامت — البوت يظنّ النجاح
        elapsed = data.get("elapsed_seconds")
        if data.get("website") or (elapsed is not None and elapsed < MIN_FORM_SECONDS):
            return Response(message, status=status.HTTP_202_ACCEPTED)

        user = request.user if request.user.is_authenticated else None
        services.subscribe(
            email=data["email"],
            name=data.get("name", ""),
            language=language,
            interests=data.get("interests") or [],
            source=data.get("source", Subscriber.Source.HOME),
            ip=get_client_ip(request),
            user=user if user and user.email.lower() == data["email"].lower() else None,
        )
        return Response(message, status=status.HTTP_202_ACCEPTED)


class ConfirmView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [AnonWriteThrottle]
    serializer_class = TokenSerializer

    @extend_schema(summary="تأكيد الاشتراك بالرمز", request=TokenSerializer)
    def post(self, request):
        serializer = TokenSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            subscriber = services.confirm_subscription(
                serializer.validated_data["token"], ip=get_client_ip(request)
            )
        except services.NewsletterError as exc:
            return _error(exc)
        return Response({
            "detail": "تم تأكيد اشتراكك",
            "preferences_token": subscriber.unsubscribe_token,
        })


class UnsubscribeView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [AnonWriteThrottle]
    serializer_class = UnsubscribeSerializer

    @extend_schema(summary="إلغاء الاشتراك بالرمز الموقّع", request=UnsubscribeSerializer)
    def post(self, request):
        serializer = UnsubscribeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        try:
            services.unsubscribe(data["token"], recipient_token=data.get("campaign_token", ""))
        except services.NewsletterError as exc:
            return _error(exc, status.HTTP_404_NOT_FOUND)
        return Response({"detail": "تم إلغاء اشتراكك"})


class PreferencesView(APIView):
    """قراءة وتعديل التفضيلات عبر الرمز الدائم دون تسجيل دخول."""

    permission_classes = [AllowAny]
    throttle_classes = [AnonWriteThrottle]
    serializer_class = PreferencesSerializer

    def _get(self, token):
        return services.get_by_unsubscribe_token(token)

    @extend_schema(summary="تفضيلات المشترك", responses={200: PreferencesSerializer})
    def get(self, request, token):
        try:
            subscriber = self._get(token)
        except services.NewsletterError as exc:
            return _error(exc, status.HTTP_404_NOT_FOUND)
        return Response(PreferencesSerializer(subscriber).data)

    @extend_schema(summary="تعديل تفضيلات المشترك", request=PreferencesSerializer)
    def patch(self, request, token):
        try:
            subscriber = self._get(token)
        except services.NewsletterError as exc:
            return _error(exc, status.HTTP_404_NOT_FOUND)
        serializer = PreferencesSerializer(subscriber, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        interests = serializer.validated_data.get("interests")
        services.update_preferences(
            subscriber,
            name=serializer.validated_data.get("name"),
            language=serializer.validated_data.get("language"),
            interests=[i.key for i in interests] if interests is not None else None,
        )
        # إعادة تفعيل من صفحة التفضيلات إن كان قد ألغى
        if request.data.get("resubscribe") and subscriber.status == Subscriber.Status.UNSUBSCRIBED:
            services.subscribe(
                email=subscriber.email, language=subscriber.language,
                source=Subscriber.Source.MANUAL, ip=get_client_ip(request),
            )
            subscriber.refresh_from_db()
        return Response(PreferencesSerializer(subscriber).data)


class MySubscriptionView(APIView):
    """اشتراك العضو المسجّل ببريده — من صفحة العضو."""

    permission_classes = [IsAuthenticated]
    serializer_class = PreferencesSerializer

    def _subscriber(self, request):
        return Subscriber.objects.filter(email__iexact=request.user.email).first()

    @extend_schema(summary="اشتراكي في النشرة", responses={200: PreferencesSerializer})
    def get(self, request):
        subscriber = self._subscriber(request)
        if subscriber is None:
            return Response({"email": request.user.email, "name": "", "language": "ar",
                             "interests": [], "status": "none"})
        if subscriber.user_id != request.user.id:
            subscriber.user = request.user
            subscriber.save(update_fields=["user", "updated_at"])
        return Response(PreferencesSerializer(subscriber).data)

    @extend_schema(summary="الاشتراك أو تعديل الاهتمامات", request=PreferencesSerializer)
    def post(self, request):
        serializer = PreferencesSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        interests = serializer.validated_data.get("interests")
        keys = [i.key for i in interests] if interests is not None else None
        subscriber = self._subscriber(request)

        if subscriber is None or subscriber.status != Subscriber.Status.ACTIVE:
            subscriber, _ = services.subscribe(
                email=request.user.email,
                name=request.user.full_name,
                language=serializer.validated_data.get("language", request.user.preferred_language),
                interests=keys or [],
                source=Subscriber.Source.MEMBER_AREA,
                ip=get_client_ip(request),
                user=request.user,
            )
        else:
            services.update_preferences(
                subscriber,
                language=serializer.validated_data.get("language"),
                interests=keys,
            )
        subscriber.refresh_from_db()
        return Response(PreferencesSerializer(subscriber).data)

    @extend_schema(summary="إلغاء اشتراكي", request=None)
    def delete(self, request):
        subscriber = self._subscriber(request)
        if subscriber and subscriber.status != Subscriber.Status.UNSUBSCRIBED:
            subscriber.unsubscribe()
        return Response(status=status.HTTP_204_NO_CONTENT)


# --------------------------------------------------------------- التتبع


class TrackOpenView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(exclude=True)
    def get(self, request, token):
        now = timezone.now()
        updated = CampaignRecipient.objects.filter(token=token, opened_at__isnull=True).update(
            opened_at=now
        )
        if updated:
            recipient = CampaignRecipient.objects.filter(token=token).only("campaign_id").first()
            Campaign.objects.filter(pk=recipient.campaign_id).update(
                open_count=F("open_count") + 1
            )
        response = HttpResponse(_PIXEL, content_type="image/gif")
        response["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
        return response


class TrackClickView(APIView):
    """يعدّ النقرة ثم يحوّل إلى رابط الحملة نفسه — لا وجهة من المستخدم، فلا تحويل مفتوح."""

    permission_classes = [AllowAny]

    @extend_schema(exclude=True)
    def get(self, request, token):
        recipient = (
            CampaignRecipient.objects.select_related("campaign").filter(token=token).first()
        )
        if recipient is None or not recipient.campaign.cta_url:
            return HttpResponseRedirect("/")
        if recipient.clicked_at is None:
            CampaignRecipient.objects.filter(pk=recipient.pk).update(clicked_at=timezone.now())
            Campaign.objects.filter(pk=recipient.campaign_id).update(
                click_count=F("click_count") + 1
            )
        return HttpResponseRedirect(recipient.campaign.cta_url)


# --------------------------------------------------------------- إداري


@extend_schema_view(
    list=extend_schema(summary="المشتركون"),
    create=extend_schema(summary="إضافة مشترك يدويًا"),
    retrieve=extend_schema(summary="تفاصيل مشترك"),
    partial_update=extend_schema(summary="تعديل مشترك"),
    destroy=extend_schema(summary="حذف مشترك"),
)
class SubscriberViewSet(
    AuditLogMixin,
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    queryset = Subscriber.objects.prefetch_related("interests").all()
    serializer_class = SubscriberAdminSerializer
    permission_classes = [HasDashboardPermission]
    required_permissions = ["newsletter.view_subscriber"]
    pagination_class = StandardPagination
    filterset_fields = ["status", "language", "source"]
    search_fields = ["email", "name"]
    ordering_fields = ["created_at", "confirmed_at", "email"]
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_queryset(self):
        queryset = super().get_queryset()
        interest = self.request.query_params.get("interest")
        if interest:
            queryset = queryset.filter(interests__key=interest).distinct()
        return queryset

    def perform_create(self, serializer):
        # الإضافة اليدوية تُعتبر موافقة موثّقة من المدير — تنشط مباشرة
        instance = serializer.save(
            status=Subscriber.Status.ACTIVE,
            source=Subscriber.Source.MANUAL,
            confirmed_at=timezone.now(),
            consent_at=timezone.now(),
        )
        log_action(AuditLog.Action.CREATE, instance=instance, request=self.request,
                   changes={"email": instance.email, "manual": True})
        return instance

    @extend_schema(summary="إحصائيات المشتركين")
    @action(detail=False, methods=["get"])
    def stats(self, request):
        by_status = dict(
            Subscriber.objects.values_list("status").annotate(n=Count("id")).order_by()
        )
        since = timezone.now() - timedelta(days=30)
        growth = list(
            Subscriber.objects.filter(confirmed_at__gte=since)
            .annotate(day=TruncDate("confirmed_at"))
            .values("day")
            .annotate(n=Count("id"))
            .order_by("day")
        )
        by_interest = (
            Interest.objects.annotate(
                n=Count("subscribers", filter=Q(subscribers__status=Subscriber.Status.ACTIVE))
            ).values("key", "name_ar", "n").order_by("display_order")
        )
        return Response({
            "total": sum(by_status.values()),
            "active": by_status.get(Subscriber.Status.ACTIVE, 0),
            "pending": by_status.get(Subscriber.Status.PENDING, 0),
            "unsubscribed": by_status.get(Subscriber.Status.UNSUBSCRIBED, 0),
            "bounced": by_status.get(Subscriber.Status.BOUNCED, 0)
            + by_status.get(Subscriber.Status.COMPLAINED, 0),
            "confirmed_last_30_days": sum(row["n"] for row in growth),
            "growth": growth,
            "by_interest": list(by_interest),
        })

    @extend_schema(summary="تصدير المشتركين CSV")
    @action(detail=False, methods=["get"])
    def export(self, request):
        if not (request.user.is_superuser or request.user.has_perm("newsletter.export_subscribers")):
            return Response(
                {"detail": "لا تملك صلاحية التصدير", "code": "permission_denied", "errors": {}},
                status=status.HTTP_403_FORBIDDEN,
            )
        subscribers = self.filter_queryset(self.get_queryset())
        response = HttpResponse(content_type="text/csv; charset=utf-8-sig")
        response["Content-Disposition"] = (
            f'attachment; filename="subscribers-{timezone.localdate()}.csv"'
        )
        response.write("﻿")  # BOM كي يفتح Excel العربية سليمة
        writer = csv.writer(response)
        writer.writerow(["البريد", "الاسم", "اللغة", "الحالة", "المصدر", "الاهتمامات",
                         "تاريخ التأكيد", "تاريخ الاشتراك"])
        for s in subscribers:
            writer.writerow([
                s.email, s.name, s.language, s.get_status_display(), s.get_source_display(),
                " | ".join(i.name_ar for i in s.interests.all()),
                s.confirmed_at.strftime("%Y-%m-%d") if s.confirmed_at else "",
                s.created_at.strftime("%Y-%m-%d"),
            ])
        log_action(AuditLog.Action.EXPORT, request=request, model_name="Subscriber",
                   object_repr=f"{subscribers.count()} مشترك")
        return response


@extend_schema_view(
    list=extend_schema(summary="الاهتمامات (إداري)"),
    create=extend_schema(summary="إضافة اهتمام"),
    partial_update=extend_schema(summary="تعديل اهتمام"),
    destroy=extend_schema(summary="حذف اهتمام"),
)
class InterestAdminViewSet(AuditLogMixin, viewsets.ModelViewSet):
    queryset = Interest.objects.annotate(subscriber_count=Count("subscribers"))
    serializer_class = InterestAdminSerializer
    permission_classes = [HasDashboardPermission]
    required_permissions = ["newsletter.change_interest"]
    pagination_class = None
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]


@extend_schema_view(
    list=extend_schema(summary="قوالب البريد"),
    create=extend_schema(summary="إضافة قالب"),
    retrieve=extend_schema(summary="تفاصيل قالب"),
    partial_update=extend_schema(summary="تعديل قالب"),
    destroy=extend_schema(summary="حذف قالب"),
)
class EmailTemplateViewSet(AuditLogMixin, viewsets.ModelViewSet):
    queryset = EmailTemplate.objects.all()
    serializer_class = EmailTemplateSerializer
    permission_classes = [HasDashboardPermission]
    required_permissions = ["newsletter.view_emailtemplate"]
    pagination_class = LargePagination
    search_fields = ["name", "key"]
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]


@extend_schema_view(
    list=extend_schema(summary="الحملات"),
    create=extend_schema(summary="إنشاء حملة"),
    retrieve=extend_schema(summary="تفاصيل حملة"),
    partial_update=extend_schema(summary="تعديل حملة"),
    destroy=extend_schema(summary="حذف حملة"),
)
class CampaignViewSet(AuditLogMixin, viewsets.ModelViewSet):
    queryset = Campaign.objects.select_related("template", "image").prefetch_related(
        "target_interests"
    )
    serializer_class = CampaignSerializer
    permission_classes = [HasDashboardPermission]
    required_permissions = ["newsletter.view_campaign"]
    pagination_class = StandardPagination
    filterset_fields = ["status", "target_language"]
    search_fields = ["name", "subject_ar", "subject_en"]
    ordering_fields = ["created_at", "scheduled_at", "sent_at"]
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_serializer_class(self):
        if self.action == "list":
            return CampaignListSerializer
        return CampaignSerializer

    def destroy(self, request, *args, **kwargs):
        if self.get_object().status == Campaign.Status.SENDING:
            return _error(services.NewsletterError("لا يمكن حذف حملة قيد الإرسال", "invalid_state"))
        return super().destroy(request, *args, **kwargs)

    def _require_send_permission(self, request):
        user = request.user
        if not (user.is_superuser or user.has_perm("newsletter.send_campaign")):
            return Response(
                {"detail": "لا تملك صلاحية إرسال الحملات", "code": "permission_denied",
                 "errors": {}},
                status=status.HTTP_403_FORBIDDEN,
            )
        return None

    @extend_schema(summary="معاينة عدد المستلمين", request=None)
    @action(detail=True, methods=["post", "get"], url_path="preview-audience")
    def preview_audience(self, request, pk=None):
        return Response(services.audience_breakdown(self.get_object()))

    @extend_schema(summary="إرسال اختباري", request=TestSendSerializer)
    @action(detail=True, methods=["post"], url_path="test-send")
    def test_send(self, request, pk=None):
        campaign = self.get_object()
        serializer = TestSendSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data.get("email") or request.user.email
        ok = send_campaign_test(campaign.pk, email, serializer.validated_data["language"])
        if not ok:
            return Response(
                {"detail": "تعذّر إرسال الرسالة الاختبارية", "code": "email_failed", "errors": {}},
                status=status.HTTP_502_BAD_GATEWAY,
            )
        return Response({"detail": f"أُرسلت نسخة اختبارية إلى {email}"})

    @extend_schema(summary="إرسال الحملة الآن", request=None)
    @action(detail=True, methods=["post"])
    def send(self, request, pk=None):
        denied = self._require_send_permission(request)
        if denied:
            return denied
        campaign = self.get_object()
        try:
            services.start_campaign(campaign)
        except services.NewsletterError as exc:
            return _error(exc)
        log_action(AuditLog.Action.UPDATE, instance=campaign, request=request,
                   changes={"action": "send", "recipients": campaign.total_recipients})
        campaign.refresh_from_db()
        return Response(CampaignSerializer(campaign).data)

    @extend_schema(summary="جدولة الإرسال", request=ScheduleSerializer)
    @action(detail=True, methods=["post"])
    def schedule(self, request, pk=None):
        denied = self._require_send_permission(request)
        if denied:
            return denied
        campaign = self.get_object()
        serializer = ScheduleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            services.schedule_campaign(campaign, serializer.validated_data["scheduled_at"])
        except services.NewsletterError as exc:
            return _error(exc)
        log_action(AuditLog.Action.UPDATE, instance=campaign, request=request,
                   changes={"action": "schedule", "scheduled_at": str(campaign.scheduled_at)})
        return Response(CampaignSerializer(campaign).data)

    @extend_schema(summary="إلغاء الحملة", request=None)
    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        campaign = self.get_object()
        try:
            services.cancel_campaign(campaign)
        except services.NewsletterError as exc:
            return _error(exc)
        log_action(AuditLog.Action.UPDATE, instance=campaign, request=request,
                   changes={"action": "cancel"})
        return Response(CampaignSerializer(campaign).data)

    @extend_schema(summary="إحصائيات الحملة")
    @action(detail=True, methods=["get"])
    def stats(self, request, pk=None):
        campaign = self.get_object()
        by_status = dict(
            campaign.recipients.values_list("status").annotate(n=Count("id")).order_by()
        )
        sent = campaign.sent_count or 0
        return Response({
            "status": campaign.status,
            "total_recipients": campaign.total_recipients,
            "pending": by_status.get(CampaignRecipient.Status.PENDING, 0),
            "sent": sent,
            "failed": campaign.failed_count,
            "opened": campaign.open_count,
            "clicked": campaign.click_count,
            "unsubscribed": campaign.unsubscribe_count,
            "open_rate": round(campaign.open_count / sent * 100, 1) if sent else 0,
            "click_rate": round(campaign.click_count / sent * 100, 1) if sent else 0,
            "started_at": campaign.started_at,
            "sent_at": campaign.sent_at,
        })

    @extend_schema(
        summary="مستلمو الحملة",
        parameters=[OpenApiParameter("status", str)],
        responses={200: CampaignRecipientSerializer(many=True)},
    )
    @action(detail=True, methods=["get"])
    def recipients(self, request, pk=None):
        campaign = self.get_object()
        queryset = campaign.recipients.select_related("subscriber").order_by("id")
        recipient_status = request.query_params.get("status")
        if recipient_status:
            queryset = queryset.filter(status=recipient_status)
        page = self.paginate_queryset(queryset)
        return self.get_paginated_response(CampaignRecipientSerializer(page, many=True).data)

    @extend_schema(summary="نسخ الحملة كمسودة جديدة", request=None)
    @action(detail=True, methods=["post"])
    def duplicate(self, request, pk=None):
        source = self.get_object()
        interests = list(source.target_interests.all())
        copy = Campaign.objects.create(
            name=f"{source.name} (نسخة)"[:160],
            subject_ar=source.subject_ar, subject_en=source.subject_en,
            content_ar=source.content_ar, content_en=source.content_en,
            image=source.image, cta_label_ar=source.cta_label_ar,
            cta_label_en=source.cta_label_en, cta_url=source.cta_url,
            template=source.template, target_language=source.target_language,
            created_by=request.user, updated_by=request.user,
        )
        copy.target_interests.set(interests)
        log_action(AuditLog.Action.CREATE, instance=copy, request=request,
                   changes={"duplicated_from": source.pk})
        return Response(CampaignSerializer(copy).data, status=status.HTTP_201_CREATED)

    @extend_schema(summary="مسودة حملة من محتوى منشور", request=DraftFromContentSerializer)
    @action(detail=False, methods=["post"], url_path="from-content")
    def from_content(self, request):
        serializer = DraftFromContentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            campaign = services.draft_from_content(
                serializer.validated_data["kind"], serializer.validated_data["id"],
                user=request.user,
            )
        except services.NewsletterError as exc:
            return _error(exc, status.HTTP_404_NOT_FOUND if exc.code == "not_found"
                          else status.HTTP_400_BAD_REQUEST)
        log_action(AuditLog.Action.CREATE, instance=campaign, request=request,
                   changes={"from_content": f"{campaign.source_model}:{campaign.source_id}"})
        return Response(CampaignSerializer(campaign).data, status=status.HTTP_201_CREATED)
