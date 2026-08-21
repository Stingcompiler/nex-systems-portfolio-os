"""أصناف أساسية للـ ViewSets العامة."""

from django.db.models import Q
from django.utils import timezone
from rest_framework import viewsets

from apps.core.filters import NormalizedSearchFilter
from apps.core.mixins import AuditLogMixin, DualSerializerMixin
from apps.core.pagination import StandardPagination
from apps.core.permissions import PublicReadWriteProtected

#: مدة تخزين استجابات القراءة العامة (بالثواني) — يستفيد منها المتصفح
#  وأي وسيط تخزين (Nginx/CDN) في الإنتاج، فتُخدم الزيارات المتكررة بلا
#  لمس Django. المحتوى يتغيّر نادرًا ويُبطَّل عند التعديل من لوحة التحكم.
PUBLIC_CACHE_SECONDS = 300


class PublicContentViewSet(DualSerializerMixin, AuditLogMixin, viewsets.ModelViewSet):
    """قراءة مفتوحة للجميع، وكتابة تتطلب صلاحية النموذج.

    الفلترة على المنشور تتم في `get_queryset` لا في الواجهة — أي مسودة
    لا تغادر الخادم أصلًا.
    """

    permission_classes = [PublicReadWriteProtected]
    pagination_class = StandardPagination
    filter_backends = viewsets.ModelViewSet.filter_backends + [NormalizedSearchFilter]

    #: هل يملك النموذج حقول النشر؟
    publishable = True

    def finalize_response(self, request, response, *args, **kwargs):
        response = super().finalize_response(request, response, *args, **kwargs)
        # القراءة العامة للزائر غير المسجّل فقط — لا نخزّن استجابة تحمل
        # مسودات أو حقولًا إدارية لمستخدم مسجّل الدخول.
        is_public_read = (
            request.method in ("GET", "HEAD")
            and self.action in ("list", "retrieve")
            and not (request.user and request.user.is_authenticated)
        )
        if is_public_read and response.status_code == 200:
            response["Cache-Control"] = (
                f"public, max-age={PUBLIC_CACHE_SECONDS}, "
                f"stale-while-revalidate={PUBLIC_CACHE_SECONDS}"
            )
        return response

    def get_queryset(self):
        queryset = super().get_queryset()
        if self.publishable and not self._sees_unpublished():
            queryset = queryset.filter(
                Q(is_published=True)
                & (Q(published_at__isnull=True) | Q(published_at__lte=timezone.now()))
            )
        return queryset

    def _sees_unpublished(self) -> bool:
        """المسودات تظهر فقط لمن يملك صلاحية تعديل النموذج."""
        if self.action not in ("list", "retrieve"):
            return True

        user = getattr(self.request, "user", None)
        if not (user and user.is_authenticated):
            return False
        if user.is_superuser:
            return True

        model = getattr(getattr(self, "queryset", None), "model", None)
        if model is None:
            return False
        meta = model._meta
        return user.has_perm(f"{meta.app_label}.change_{meta.model_name}")
