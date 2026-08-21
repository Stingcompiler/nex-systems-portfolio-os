"""إعدادات الاختبارات.

الفارق الجوهري عن `dev` هو تجزئة كلمات المرور: PBKDF2 في Django 5 يستخدم
مئات الآلاف من الدورات، وهو المطلوب في الإنتاج لكنه يجعل مجموعة اختبارات
فيها عشرات عمليات التسجيل والدخول تستغرق دقائق بدل ثوانٍ.
"""

from .dev import *  # noqa: F403
from .dev import Q_CLUSTER  # noqa: F401

DEBUG = False

PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]

EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"

# المهام تُنفَّذ فورًا كي تُختبر آثارها مباشرة
Q_CLUSTER = {**Q_CLUSTER, "sync": True}

# قاعدة بيانات الاختبار في الذاكرة — أسرع ولا تترك ملفات معلّقة
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": ":memory:",
        "TEST": {"NAME": ":memory:"},
    }
}
