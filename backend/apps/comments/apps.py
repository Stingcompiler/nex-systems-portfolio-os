from django.apps import AppConfig


class CommentsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.comments"
    label = "comments"
    verbose_name = "التعليقات"

    def ready(self):
        from apps.comments import signals  # noqa: F401
