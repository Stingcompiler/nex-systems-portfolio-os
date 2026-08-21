"""الإعدادات المشتركة بين جميع البيئات."""

from datetime import timedelta
from pathlib import Path

import environ

BASE_DIR = Path(__file__).resolve().parents[2]
#: جذر المستودع — الإعدادات موحّدة في ملف واحد للطرفين
ROOT_DIR = BASE_DIR.parent

env = environ.Env()
_env_file = ROOT_DIR / ".env"
if _env_file.exists():
    environ.Env.read_env(_env_file)

# ---------------------------------------------------------------- الأساسيات

SECRET_KEY = env("SECRET_KEY", default="insecure-dev-key-do-not-use-in-production")
DEBUG = env.bool("DEBUG", default=False)
ALLOWED_HOSTS = env.list("ALLOWED_HOSTS", default=["localhost", "127.0.0.1"])

FRONTEND_URL = env("FRONTEND_URL", default="http://localhost:3000")
REVALIDATE_SECRET = env("REVALIDATE_SECRET", default="change-me")

# ---------------------------------------------------------------- التطبيقات

DJANGO_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
]

THIRD_PARTY_APPS = [
    "rest_framework",
    "rest_framework_simplejwt.token_blacklist",
    "django_filters",
    "drf_spectacular",
    "django_q",
]

LOCAL_APPS = [
    "apps.core",
    "apps.accounts",
    "apps.media_library",
    "apps.portfolio",
    "apps.notifications",
    "apps.crm",
    "apps.blog",
    "apps.comments",
    "apps.analytics",
]

# apps.cli أولًا كي يتقدّم أمر runserver المخصّص على نسخة staticfiles
# (اكتشاف الأوامر يمنح الأولوية للتطبيق الأسبق في القائمة).
INSTALLED_APPS = ["apps.cli"] + DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS

# ---------------------------------------------------------------- الوسائط البرمجية

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    # CsrfViewMiddleware مطلوب لضبط كوكي csrftoken.
    # مسارات DRF معفاة تلقائيًا، والتحقق يتم داخل CookieJWTAuthentication.
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "apps.core.middleware.LanguageMiddleware",
    "apps.core.middleware.RequestContextMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

# ---------------------------------------------------------------- قاعدة البيانات

_db_engine = env("DB_ENGINE", default="sqlite").lower()

if _db_engine == "postgres":
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": env("DB_NAME", default="stingdev"),
            "USER": env("DB_USER", default="postgres"),
            "PASSWORD": env("DB_PASSWORD", default=""),
            "HOST": env("DB_HOST", default="127.0.0.1"),
            "PORT": env("DB_PORT", default="5432"),
            "CONN_MAX_AGE": 60,
        }
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / env("DB_NAME", default="db.sqlite3"),
            "OPTIONS": {
                # ضروري عند اعتماد SQLite في الإنتاج: قراءات متزامنة أثناء الكتابة.
                "init_command": (
                    "PRAGMA journal_mode=WAL;"
                    "PRAGMA synchronous=NORMAL;"
                    "PRAGMA foreign_keys=ON;"
                ),
                "timeout": 20,
            },
        }
    }

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# ---------------------------------------------------------------- المستخدمون

AUTH_USER_MODEL = "accounts.User"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
        "OPTIONS": {"min_length": 8},
    },
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# ---------------------------------------------------------------- اللغة والوقت

LANGUAGE_CODE = "ar"
LANGUAGES = [("ar", "العربية"), ("en", "English")]
SUPPORTED_LANGUAGES = ["ar", "en"]
TIME_ZONE = "Africa/Khartoum"
USE_I18N = True
USE_TZ = True
LOCALE_PATHS = [BASE_DIR / "locale"]

# ---------------------------------------------------------------- الملفات

STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STATICFILES_DIRS = [d for d in [BASE_DIR / "static"] if d.exists()]

MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

MAX_UPLOAD_SIZE_MB = env.int("MAX_UPLOAD_SIZE_MB", default=10)
DATA_UPLOAD_MAX_MEMORY_SIZE = MAX_UPLOAD_SIZE_MB * 1024 * 1024
FILE_UPLOAD_MAX_MEMORY_SIZE = 5 * 1024 * 1024

# ---------------------------------------------------------------- البريد

EMAIL_BACKEND = env(
    "EMAIL_BACKEND", default="django.core.mail.backends.console.EmailBackend"
)
EMAIL_HOST = env("EMAIL_HOST", default="")
EMAIL_PORT = env.int("EMAIL_PORT", default=587)
EMAIL_USE_TLS = env.bool("EMAIL_USE_TLS", default=True)
EMAIL_HOST_USER = env("EMAIL_HOST_USER", default="")
EMAIL_HOST_PASSWORD = env("EMAIL_HOST_PASSWORD", default="")
DEFAULT_FROM_EMAIL = env("DEFAULT_FROM_EMAIL", default="NEXA SYSTEMS <no-reply@localhost>")

EMAIL_VERIFICATION_HOURS = env.int("EMAIL_VERIFICATION_HOURS", default=24)
PASSWORD_RESET_HOURS = env.int("PASSWORD_RESET_HOURS", default=2)

# ---------------------------------------------------------------- REST Framework

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "apps.accounts.authentication.CookieJWTAuthentication",
    ],
    # الافتراضي مغلق عمدًا — كل نقطة نهاية عامة تعلن AllowAny صراحة.
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_PAGINATION_CLASS": "apps.core.pagination.StandardPagination",
    "PAGE_SIZE": 12,
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ],
    "EXCEPTION_HANDLER": "apps.core.exceptions.api_exception_handler",
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_THROTTLE_CLASSES": [],
    "DEFAULT_THROTTLE_RATES": {
        "login": "5/15m",
        "register": "3/1h",
        "password_forgot": "3/1h",
        "resend_verification": "1/10m",
        "anon_write": "20/1h",
    },
    "UNAUTHENTICATED_USER": "django.contrib.auth.models.AnonymousUser",
}

# ---------------------------------------------------------------- JWT

ACCESS_TOKEN_LIFETIME_MIN = env.int("ACCESS_TOKEN_LIFETIME_MIN", default=15)
REFRESH_TOKEN_LIFETIME_DAYS = env.int("REFRESH_TOKEN_LIFETIME_DAYS", default=7)

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=ACCESS_TOKEN_LIFETIME_MIN),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=REFRESH_TOKEN_LIFETIME_DAYS),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": True,
    "ALGORITHM": "HS256",
    "SIGNING_KEY": SECRET_KEY,
    "AUTH_HEADER_TYPES": ("Bearer",),
    "USER_ID_FIELD": "id",
    "USER_ID_CLAIM": "user_id",
    "TOKEN_TYPE_CLAIM": "token_type",
}

# أسماء وسمات كوكيز المصادقة
AUTH_COOKIE_ACCESS = "access_token"
AUTH_COOKIE_REFRESH = "refresh_token"
AUTH_COOKIE_REFRESH_PATH = "/api/v1/auth/"
AUTH_COOKIE_SECURE = env.bool("COOKIE_SECURE", default=False)
AUTH_COOKIE_SAMESITE = env("COOKIE_SAMESITE", default="Lax")
AUTH_COOKIE_DOMAIN = env("COOKIE_DOMAIN", default=None) or None

CSRF_COOKIE_NAME = "csrftoken"
CSRF_HEADER_NAME = "HTTP_X_CSRFTOKEN"
CSRF_COOKIE_HTTPONLY = False  # الواجهة تحتاج قراءتها لإرسالها في الترويسة
CSRF_TRUSTED_ORIGINS = env.list(
    "CSRF_TRUSTED_ORIGINS", default=["http://localhost:3000", "http://127.0.0.1:3000"]
)

# ---------------------------------------------------------------- التوثيق

SPECTACULAR_SETTINGS = {
    "TITLE": "NEXA SYSTEMS API",
    "DESCRIPTION": "واجهة برمجية لمنصة NEXA SYSTEMS — الخدمات والمشاريع والمدونة وإدارة العملاء.",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "COMPONENT_SPLIT_REQUEST": True,
    "SCHEMA_PATH_PREFIX": "/api/v1",
    # قوائم قيم متطابقة أو متشابهة الاسم تُسمّى صراحة لتفادي أسماء مولّدة عشوائية
    "ENUM_NAME_OVERRIDES": {
        "LanguageEnum": "apps.core.constants.LANGUAGE_CHOICES",
        "ThemeEnum": "apps.core.constants.THEME_CHOICES",
        "ServiceKindEnum": "apps.portfolio.models.service.SERVICE_KIND_CHOICES",
        "ResourceKindEnum": "apps.portfolio.models.resume.RESOURCE_KIND_CHOICES",
        # تعدادات CRM: عدة نماذج تحمل حقول status/project_type بقيم مختلفة
        "LeadStatusEnum": "apps.crm.enums.LeadStatus.choices",
        "RequestStatusEnum": "apps.crm.enums.RequestStatus.choices",
        "ContactStatusEnum": "apps.crm.enums.ContactStatus.choices",
        "FollowUpStatusEnum": "apps.crm.enums.FollowUpStatus.choices",
        "RequestProjectTypeEnum": "apps.crm.enums.RequestProjectType.choices",
        "ProjectTypeEnum": "apps.portfolio.enums.ProjectType.choices",
        "ProjectStatusEnum": "apps.portfolio.enums.ProjectStatus.choices",
        "PriorityEnum": "apps.crm.enums.Priority.choices",
        "LeadSourceEnum": "apps.crm.enums.LeadSource.choices",
        "CommentStatusEnum": "apps.comments.models.COMMENT_STATUS_CHOICES",
        "ReportReasonEnum": "apps.comments.models.REPORT_REASON_CHOICES",
        "ReportStatusEnum": "apps.comments.models.REPORT_STATUS_CHOICES",
    },
}

# ---------------------------------------------------------------- المهام الخلفية

Q_CLUSTER = {
    "name": "nexa",
    "workers": 2,
    "recycle": 500,
    "timeout": 300,
    "retry": 360,
    "queue_limit": 50,
    "bulk": 10,
    "orm": "default",  # وسيط قاعدة البيانات — لا Redis
    "save_limit": 250,
    "max_attempts": 3,
    "catch_up": False,
}

# ---------------------------------------------------------------- التخزين المؤقت

CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
        "LOCATION": "stingdev-default",
    }
}

# ---------------------------------------------------------------- الأمان

SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = "DENY"
SECURE_REFERRER_POLICY = "strict-origin-when-cross-origin"
SESSION_COOKIE_HTTPONLY = True

# ---------------------------------------------------------------- السجلات

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {
            "format": "{levelname} {asctime} {name} {message}",
            "style": "{",
        },
    },
    "handlers": {
        "console": {"class": "logging.StreamHandler", "formatter": "verbose"},
    },
    "root": {"handlers": ["console"], "level": "INFO"},
    "loggers": {
        "django.db.backends": {"level": "WARNING", "propagate": False,
                               "handlers": ["console"]},
        "apps": {"level": "INFO", "propagate": True},
    },
}
