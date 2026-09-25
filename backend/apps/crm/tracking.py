"""متابعة الطلبات والرسائل من الموقع العام.

صفحة المتابعة تُفتح برمز عشوائي (``tracking_token``) يصل صاحب الطلب في
شاشة النجاح وفي بريده. من فقد الرابط يبحث بمفتاحين مختلفين من أربعة: رقم
الطلب، الاسم، البريد، الهاتف. مفتاح واحد لا يكفي: الاسم يشترك فيه كثيرون،
والرقم من خمس خانات يُجرَّب، والبريد أو الهاتف قد يعرفه غير صاحبه — والصفحة
تعرض وصف المشروع وردود الفريق.
"""

import re

from django.db.models import Q

from apps.crm.enums import RequestStatus
from apps.crm.models import ContactMessage, ProjectRequest

REFERENCE = "reference"
EMAIL = "email"
PHONE = "phone"
NAME = "name"

#: الرقم الحالي خمس أو ست خانات (48213، ويقبل «#48213»)، والقديم REQ-2026-0001
_REFERENCE_PATTERN = re.compile(r"^#?\d{5,6}$")
_LEGACY_PATTERN = re.compile(r"^(REQ|MSG)-\d{4}-\d{1,6}$", re.IGNORECASE)
_DIACRITICS = re.compile(r"[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]")
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
        return REFERENCE, value.lstrip("#")
    if _LEGACY_PATTERN.match(value):
        return REFERENCE, value.upper()
    if "@" in value:
        return EMAIL, value.lower()
    digits = re.sub(r"\D", "", value)
    if len(digits) >= 7 and re.fullmatch(r"[\d\s+()\-.]+", value):
        return PHONE, digits[-_PHONE_TAIL:]
    name = normalize_name(value)
    if name and not any(char.isdigit() for char in value) and len(name.replace(" ", "")) >= 2:
        return NAME, name
    return None


def normalize_name(value: str) -> str:
    """اسم للمقارنة: بلا تشكيل ولا تطويل، بصيغة موحّدة للألف والياء والتاء المربوطة.

    «أحمد» و«احمد» و«أَحْمَد» الاسم نفسه كما يكتبه الناس في نموذج ثم في آخر.
    """
    value = _DIACRITICS.sub("", value or "").lower()
    value = re.sub("[أإآٱ]", "ا", value)
    value = value.replace("ى", "ي").replace("ة", "ه").replace("ؤ", "و").replace("ئ", "ي")
    return " ".join(re.findall(r"\w+", value))


def _name_matches(stored: str, entered: str) -> bool:
    """كل كلمات الاسم المدخل موجودة في الاسم المسجل — الاسم الأول وحده يكفي."""
    stored_words = set(normalize_name(stored).split())
    return bool(stored_words) and set(entered.split()) <= stored_words


def _phone_matches(stored: str, tail: str) -> bool:
    digits = re.sub(r"\D", "", (stored or "").translate(_ARABIC_DIGITS))
    return bool(digits) and digits[-_PHONE_TAIL:] == tail


def _matches(record, kind: str, value: str) -> bool:
    if kind == REFERENCE:
        return value in {
            (record.reference_code or "").upper(),
            (record.legacy_reference or "").upper(),
        }
    if kind == NAME:
        return _name_matches(record.name, value)
    if kind == EMAIL:
        return (record.email or "").lower() == value
    phones = [record.phone, getattr(record, "whatsapp", "")]
    return any(_phone_matches(phone, value) for phone in phones)


def _candidates(kind: str, value: str):
    """سجلات المفتاح الأول. الهاتف يُطابق في بايثون (صيغ التخزين متباينة)."""
    requests = ProjectRequest.objects.exclude(status=RequestStatus.DRAFT)
    messages = ContactMessage.objects.all()
    if kind == REFERENCE:
        match = Q(reference_code=value) | Q(legacy_reference__iexact=value)
        return [*requests.filter(match), *messages.filter(match)]
    if kind == EMAIL:
        return [*requests.filter(email__iexact=value), *messages.filter(email__iexact=value)]
    # هاتف: تضييق أولي بآخر أربعة أرقام ثم مطابقة دقيقة. الأرقام تُخزَّن كما
    # كُتبت (+249 912 345 678)، فالنمط يتجاوز الفواصل بين الأرقام
    tail = r"\D*".join(value[-4:]) + r"\D*$"
    return [
        record
        for record in [
            *requests.filter(Q(phone__regex=tail) | Q(whatsapp__regex=tail)),
            *messages.filter(phone__regex=tail),
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
    # المصدر أضيق المفتاحين: الرقم ثم البريد ثم الهاتف. الاسم لا يكون مصدرًا
    # أبدًا — يُستعمل مرشِّحًا فقط، فلا يُستعلَم بالاسم وحده
    order = [REFERENCE, EMAIL, PHONE, NAME]
    if order.index(b[0]) < order.index(a[0]):
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
