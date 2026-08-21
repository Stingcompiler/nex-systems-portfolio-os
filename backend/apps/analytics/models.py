from django.db import models


class PageView(models.Model):
    """مشاهدة صفحة — تحترم الخصوصية.

    لا يُخزَّن عنوان IP خام إطلاقًا. `session_hash` بصمة مجهولة تُشتق من
    مزيج (IP + المتصفح + ملح يومي)، فلا يمكن ردّها إلى زائر بعينه ولا
    تتبّعه عبر الأيام. تكفي لتقدير الزوار الفريدين يوميًا فقط.
    """

    class Device(models.TextChoices):
        MOBILE = "mobile", "هاتف"
        TABLET = "tablet", "لوحي"
        DESKTOP = "desktop", "سطح مكتب"
        BOT = "bot", "زاحف"

    path = models.CharField("المسار", max_length=300, db_index=True)
    locale = models.CharField("اللغة", max_length=5, blank=True)
    #: نوع المحتوى وslug إن كانت الصفحة عنصرًا (مقال، مشروع، خدمة)
    content_type = models.CharField("نوع المحتوى", max_length=32, blank=True, db_index=True)
    object_slug = models.CharField("معرّف العنصر", max_length=220, blank=True)

    referrer_domain = models.CharField("مصدر الزيارة", max_length=120, blank=True, db_index=True)
    country = models.CharField("الدولة", max_length=2, blank=True)
    device_type = models.CharField(
        "الجهاز", max_length=10, choices=Device.choices, default=Device.DESKTOP
    )
    session_hash = models.CharField("بصمة الجلسة", max_length=64, blank=True, db_index=True)

    created_at = models.DateTimeField("التاريخ", auto_now_add=True, db_index=True)

    class Meta:
        verbose_name = "مشاهدة صفحة"
        verbose_name_plural = "مشاهدات الصفحات"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["created_at", "content_type"]),
            models.Index(fields=["created_at", "referrer_domain"]),
        ]

    def __str__(self):
        return f"{self.path} @ {self.created_at:%Y-%m-%d}"


class DailyStat(models.Model):
    """تجميع يومي — مصدر لوحة الإحصائيات التاريخية.

    يُبنى بمهمة يومية من `PageView`، فلا تُستعلم صفوف المشاهدات الخام
    مباشرة عند عرض اللوحة (تبقى سريعة مهما كبر الأرشيف).
    """

    date = models.DateField("التاريخ", db_index=True)
    metric = models.CharField("المقياس", max_length=32)
    dimension = models.CharField("البُعد", max_length=120, blank=True)
    value = models.PositiveIntegerField("القيمة", default=0)

    class Meta:
        verbose_name = "إحصائية يومية"
        verbose_name_plural = "الإحصائيات اليومية"
        ordering = ["-date"]
        constraints = [
            models.UniqueConstraint(
                fields=["date", "metric", "dimension"], name="unique_daily_stat"
            )
        ]

    def __str__(self):
        return f"{self.date} {self.metric}={self.value}"
