"""إعدادات الإنتاج."""

from pathlib import Path

from .base import *  # noqa: F403
from .base import BASE_DIR, LOGGING, MIDDLEWARE, env  # noqa: F401

DEBUG = False
ALLOWED_HOSTS = env.list("ALLOWED_HOSTS")

# النقل الآمن
SECURE_SSL_REDIRECT = env.bool("SECURE_SSL_REDIRECT", default=True)
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

# الكوكيز
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
AUTH_COOKIE_SECURE = True

# البريد عبر SMTP حقيقي
EMAIL_BACKEND = env(
    "EMAIL_BACKEND", default="django.core.mail.backends.smtp.EmailBackend"
)

# الملفات الثابتة
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"
    },
}
MIDDLEWARE.insert(1, "whitenoise.middleware.WhiteNoiseMiddleware")

# السجلات — ملف دوّار إن وُجد المجلد، وإلا وحدة التحكم فقط
_log_dir = Path(BASE_DIR / "logs")
if _log_dir.exists() or _log_dir.parent.exists():
    _log_dir.mkdir(exist_ok=True)
    LOGGING["handlers"]["file"] = {
        "class": "logging.handlers.RotatingFileHandler",
        "filename": str(_log_dir / "app.log"),
        "maxBytes": 10 * 1024 * 1024,
        "backupCount": 5,
        "formatter": "verbose",
    }
    LOGGING["root"]["handlers"] = ["console", "file"]
