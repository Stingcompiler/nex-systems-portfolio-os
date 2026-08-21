"""إعدادات التطوير المحلي."""

from .base import *  # noqa: F403
from .base import Q_CLUSTER, env  # noqa: F401

DEBUG = True
ALLOWED_HOSTS = ["localhost", "127.0.0.1", "0.0.0.0", "testserver"]

# البريد يُطبع في الطرفية بدل الإرسال الفعلي
EMAIL_BACKEND = env(
    "EMAIL_BACKEND", default="django.core.mail.backends.console.EmailBackend"
)

# تنفيذ المهام فورًا دون الحاجة لتشغيل qcluster أثناء التطوير.
# شغّل `python manage.py qcluster` واضبط Q_SYNC=False لاختبار السلوك الحقيقي.
Q_CLUSTER = {**Q_CLUSTER, "sync": env.bool("Q_SYNC", default=True)}

AUTH_COOKIE_SECURE = False
