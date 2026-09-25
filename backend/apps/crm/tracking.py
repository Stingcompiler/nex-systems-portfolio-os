"""متابعة الطلبات والرسائل من الموقع العام.

صفحة المتابعة تُفتح برمز عشوائي (``tracking_token``) يصل صاحب الطلب في
شاشة النجاح وفي بريده. من فقد الرابط يبحث بمفتاحين من ثلاثة: الرقم
المرجعي، البريد، الهاتف. مفتاح واحد لا يكفي: الرقم المرجعي تسلسلي يُخمَّن،
والبريد أو الهاتف قد يعرفه غير صاحبه — والصفحة تعرض وصف المشروع وردود الفريق.
"""

import re

from apps.crm.enums import RequestStatus
from apps.crm.models import ContactMessage, ProjectRequest

REFERENCE = "reference"
EMAIL = "email"
PHONE = "phone"

_REFERENCE_PATTERN = re.compile(r"^(REQ|MSG)-\d{4}-\d{1,6}$", re.IGNORECASE)
#: أرقام الهاتف تُقارَن بآخر تسعة أرقام: تتجاهل مفتاح الدولة والصفر البادئ
#  (+249912345678 و0912345678 الرقم نفسه).
_PHONE_TAIL = 9
_ARABIC_DIGITS = str.maketrans("٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹", "01234567890123456789")


def classify(raw: str) -> tuple[str, str] | None:
    """يحدد نوع المفتاح ويعيده بصيغة موحّدة، أو None إن لم يُفهم."""
    value = (raw or "").strip().translate(_ARABIC_DIGITS)
    if not value:
        return None
    if _REFERENCE_PATTERN.match(value):
        return REFERENCE, value.upper()
    if "@" in value:
        return EMAIL, value.lower()
    digits = re.sub(r"\D", "", value)
    if len(digits) >= 7 and re.fullmatch(r"[\d\s+()\-.]+", value):
        return PHONE, digits[-_PHONE_TAIL:]
    return None


def _phone_matches(stored: str, tail: str) -> bool:
    digits = re.sub(r"\D", "", (stored or "").translate(_ARABIC_DIGITS))
    return bool(digits) and digits[-_PHONE_TAIL:] == tail


def _matches(record, kind: str, value: str) -> bool:
    if kind == REFERENCE:
        return (record.reference_code or "").upper() == value
    if kind == EMAIL:
        return (record.email or "").lower() == value
    phones = [record.phone, getattr(record, "whatsapp", "")]
    return any(_phone_matches(phone, value) for phone in phones)


def _candidates(kind: str, value: str):
    """سجلات المفتاح الأول. الهاتف يُطابق في بايثون (صيغ التخزين متباينة)."""
    requests = ProjectRequest.objects.exclude(status=RequestStatus.DRAFT)
    messages = ContactMessage.objects.all()
    if kind == REFERENCE:
        model_qs = requests if value.startswith("REQ") else messages
        return list(model_qs.filter(reference_code__iexact=value))
    if kind == EMAIL:
        return [*requests.filter(email__iexact=value), *messages.filter(email__iexact=value)]
    # هاتف: تضييق أولي بآخر أربعة أرقام ثم مطابقة دقيقة
    tail = value[-4:]
    return [
        record
        for record in [
            *requests.filter(phone__contains=tail),
            *requests.filter(whatsapp__contains=tail),
            *messages.filter(phone__contains=tail),
        ]
        if _matches(record, PHONE, value)
    ]


def lookup(first: str, second: str) -> list:
    """السجلات التي يطابقها المفتاحان معًا (نوعان مختلفان).

    يرفع ValueError برسالة للعرض إن كان أحد المفتاحين غير مفهوم أو من
    النوع نفسه.
    """
    a, b = classify(first), classify(second)
    if a is None or b is None:
        raise ValueError("unrecognized")
    if a[0] == b[0]:
        raise ValueError("same_kind")
    # البدء بالرقم المرجعي إن وُجد: سجل واحد على الأكثر
    if b[0] == REFERENCE:
        a, b = b, a
    seen, results = set(), []
    for record in _candidates(*a):
        key = (type(record).__name__, record.pk)
        if key in seen or not _matches(record, *b):
            continue
        seen.add(key)
        results.append(record)
    results.sort(key=lambda record: record.created_at, reverse=True)
    return results


def find_by_token(token: str):
    token = (token or "").strip()
    if not token or len(token) > 32:
        return None
    return (
        ProjectRequest.objects.exclude(status=RequestStatus.DRAFT)
        .select_related("service")
        .filter(tracking_token=token)
        .first()
        or ContactMessage.objects.filter(tracking_token=token).first()
    )


def kind_of(record) -> str:
    return "request" if isinstance(record, ProjectRequest) else "message"
