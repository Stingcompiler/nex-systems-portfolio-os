"""مرشحات مكافحة السبام المتتالية للتعليقات.

ست طبقات: الحقل الخادع، الحد الزمني، تحديد المعدل، البريد المحظور،
مرشّح الروابط والكلمات، والمراجعة اليدوية (لا يظهر تعليق قبل الاعتماد).
"""

import re

from django.core.cache import cache
from django.utils import timezone

from apps.comments.models import BlockedEmail, Comment

#: أقل زمن مقبول بين تحميل النموذج والإرسال — أقل منه سلوك آلي
MIN_FORM_SECONDS = 3
#: حدود المعدل
MAX_PER_IP_PER_HOUR = 3
MAX_PER_EMAIL_PER_HOUR = 5
#: أقصى عدد روابط قبل اعتبار التعليق سبام
MAX_LINKS = 2

_URL_PATTERN = re.compile(r"https?://|www\.", re.IGNORECASE)
_SPAM_WORDS = re.compile(
    r"\b(viagra|casino|porn|crypto\s*giveaway|forex|betting|loan\s*offer)\b",
    re.IGNORECASE,
)


class SpamRejection(Exception):
    """يُرفع عند رفض التعليق. `silent` يعني رفضًا صامتًا (بوت لا يُعلَم)."""

    def __init__(self, message: str, *, silent: bool = False, mark_spam: bool = False):
        super().__init__(message)
        self.message = message
        self.silent = silent
        self.mark_spam = mark_spam


def check_honeypot(honeypot_value: str) -> None:
    """الطبقة 1: حقل خادع مخفي — امتلاؤه يعني بوت."""
    if honeypot_value:
        raise SpamRejection("تعذّر إرسال التعليق", silent=True)


def check_form_timing(elapsed_seconds: float | None) -> None:
    """الطبقة 2: إرسال أسرع من بشر."""
    if elapsed_seconds is not None and elapsed_seconds < MIN_FORM_SECONDS:
        raise SpamRejection("تعذّر إرسال التعليق", silent=True)


def check_rate_limit(ip: str | None, email: str) -> None:
    """الطبقة 3: تحديد المعدل لكل IP وبريد عبر التخزين المؤقت."""
    now = timezone.now()

    if ip:
        ip_key = f"comment_rate:ip:{ip}"
        count = cache.get(ip_key, 0)
        if count >= MAX_PER_IP_PER_HOUR:
            raise SpamRejection("عدد التعليقات كبير — حاول لاحقًا")
        cache.set(ip_key, count + 1, 3600)

    if email:
        email_key = f"comment_rate:email:{email.lower()}"
        count = cache.get(email_key, 0)
        if count >= MAX_PER_EMAIL_PER_HOUR:
            raise SpamRejection("عدد التعليقات كبير — حاول لاحقًا")
        cache.set(email_key, count + 1, 3600)

    _ = now  # الاحتفاظ بالتوقيت للتوسعة المستقبلية


def check_blocked_email(email: str) -> None:
    """الطبقة 4: قائمة البريد المحظور."""
    if BlockedEmail.is_blocked(email):
        raise SpamRejection("تعذّر إرسال التعليق", silent=True)


def evaluate_content(content: str) -> str:
    """الطبقة 5: مرشّح الروابط والكلمات.

    يعيد الحالة المقترحة: SPAM إن تجاوز حد الروابط أو حوى كلمات محظورة،
    وإلا PENDING (للمراجعة اليدوية — الطبقة 6).
    """
    link_count = len(_URL_PATTERN.findall(content))
    if link_count > MAX_LINKS or _SPAM_WORDS.search(content):
        return Comment.Status.SPAM
    return Comment.Status.PENDING


def run_all_filters(
    *,
    honeypot: str,
    elapsed_seconds: float | None,
    ip: str | None,
    email: str,
    content: str,
) -> str:
    """يشغّل الطبقات الست ويعيد الحالة الابتدائية للتعليق.

    يرفع `SpamRejection` عند الرفض القاطع، أو يعيد الحالة (spam أو pending)
    عند القبول المشروط بالمراجعة.
    """
    check_honeypot(honeypot)
    check_form_timing(elapsed_seconds)
    check_blocked_email(email)
    check_rate_limit(ip, email)  # بعد الفحوص المجانية كي لا نستهلك العدّاد على بوت
    return evaluate_content(content)
