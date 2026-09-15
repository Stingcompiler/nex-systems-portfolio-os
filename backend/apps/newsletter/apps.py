from django.apps import AppConfig


class NewsletterConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.newsletter"
    label = "newsletter"
    verbose_name = "النشرة البريدية"

    def ready(self):
        from apps.newsletter import signals  # noqa: F401
