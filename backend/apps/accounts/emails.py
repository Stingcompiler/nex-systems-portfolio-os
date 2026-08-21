"""جدولة رسائل الحسابات في الخلفية.

كل إرسال يمر من هنا كي لا يُبطئ دورة الطلب. في بيئة التطوير يعمل
`django-q2` بوضع `sync`، فتُنفَّذ المهمة فورًا.
"""

import logging

from django_q.tasks import async_task

logger = logging.getLogger(__name__)


def _enqueue(task_path: str, *args) -> None:
    try:
        async_task(task_path, *args)
    except Exception:  # noqa: BLE001
        # فشل الجدولة يجب ألا يُسقط العملية الأصلية (تسجيل، استعادة، ...).
        logger.exception("تعذّرت جدولة المهمة %s", task_path)


def queue_verification_email(user, token: str) -> None:
    _enqueue("apps.accounts.tasks.send_verification_email", user.pk, token)


def queue_password_reset_email(user, token: str) -> None:
    _enqueue("apps.accounts.tasks.send_password_reset_email", user.pk, token)


def queue_password_changed_email(user) -> None:
    _enqueue("apps.accounts.tasks.send_password_changed_email", user.pk)
