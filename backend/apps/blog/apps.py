from django.apps import AppConfig


class BlogConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.blog"
    label = "blog"
    verbose_name = "المدونة"

    def ready(self):
        from apps.blog import signals  # noqa: F401
