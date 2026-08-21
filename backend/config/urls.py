from django.conf import settings
from django.contrib import admin
from django.http import HttpResponse
from django.urls import include, path, re_path
from django.views.static import serve
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

from apps.core.views import HealthView

# عنوان لوحة الإدارة العربي
admin.site.site_header = "إدارة NEXA SYSTEMS"
admin.site.site_title = "NEXA SYSTEMS"
admin.site.index_title = "لوحة إدارة Django"

api_v1 = [
    path("auth/", include("apps.accounts.urls")),
    path("health/", HealthView.as_view(), name="health"),
    path("media/", include("apps.media_library.urls")),
    path("notifications/", include("apps.notifications.urls")),
    path("analytics/", include("apps.analytics.urls")),
    path("", include("apps.accounts.admin_urls")),
    path("", include("apps.crm.urls")),
    path("", include("apps.blog.urls")),
    path("", include("apps.comments.urls")),
    path("", include("apps.portfolio.urls")),
    path("", include("apps.core.urls")),
]


def api_root(_request):
    """صفحة تعريف بسيطة على جذر منفذ Django.

    Django لا يخدم صفحات الموقع — تلك على منفذ الواجهة. هذه الصفحة تمنع
    الالتباس: لا إعادة توجيه إلى منفذ آخر، بل روابط واضحة لما يقدّمه هذا
    المنفذ فعلًا (لوحة الإدارة، توثيق الـ API، فحص الحالة).
    """
    site_url = settings.FRONTEND_URL
    html = f"""<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>NEXA SYSTEMS — خادم الـ API</title>
<style>
 body{{font-family:system-ui,'Segoe UI',Tahoma,sans-serif;background:#f8fafc;color:#0f172a;
 margin:0;min-height:100vh;display:grid;place-items:center;padding:24px}}
 .card{{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:32px;max-width:520px;
 box-shadow:0 4px 16px rgba(15,23,42,.06)}}
 h1{{margin:0 0 8px;font-size:22px}} p{{color:#64748b;margin:0 0 20px;line-height:1.9}}
 a{{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 16px;
 border:1px solid #e2e8f0;border-radius:10px;text-decoration:none;color:#0f172a;margin-bottom:10px}}
 a:hover{{border-color:#2563eb;background:#f1f5f9}} .k{{color:#2563eb;font-weight:600}}
 code{{background:#f1f5f9;padding:2px 6px;border-radius:6px;font-size:13px}}
</style></head><body><div class="card">
<h1>خادم NEXA SYSTEMS API</h1>
<p>هذا منفذ الـ API (المنفذ <code>8000</code>). صفحات الموقع تُقدَّم من منفذ الواجهة.</p>
<a href="/admin/"><span class="k">لوحة إدارة Django</span><span>/admin/</span></a>
<a href="/api/schema/swagger-ui/"><span class="k">توثيق الـ API</span><span>/api/schema/swagger-ui/</span></a>
<a href="/api/v1/health/"><span class="k">فحص الحالة</span><span>/api/v1/health/</span></a>
<a href="{site_url}"><span class="k">الموقع العام</span><span>{site_url}</span></a>
</div></body></html>"""
    return HttpResponse(html)


urlpatterns = [
    path("api/v1/", include((api_v1, "v1"))),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path(
        "api/schema/swagger-ui/",
        SpectacularSwaggerView.as_view(url_name="schema"),
        name="swagger-ui",
    ),
    # لوحة Django الإدارية على المسار التقليدي المتوقع
    path("admin/", admin.site.urls),
    # جذر منفذ الـ API: صفحة تعريف لا إعادة توجيه — تمنع الالتباس بمنفذ الواجهة
    path("", api_root, name="api-root"),
]

# الحاوية واحدة بلا Nginx، فـ Django يقدّم الوسائط في الإنتاج أيضًا.
# `conf.urls.static.static` تعود فارغة عندما DEBUG=False، فالمسار صريح هنا.
urlpatterns += [
    re_path(
        r"^media/(?P<path>.*)$",
        serve,
        {"document_root": settings.MEDIA_ROOT},
    ),
]
