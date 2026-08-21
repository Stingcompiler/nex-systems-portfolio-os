"""توليد رموز عشوائية آمنة للتحقق من البريد واستعادة كلمة المرور."""

import secrets


def generate_token(length: int = 48) -> str:
    """رمز عشوائي آمن مناسب للاستخدام داخل رابط."""
    return secrets.token_urlsafe(length)[:64]


def constant_time_equals(left: str | None, right: str | None) -> bool:
    """مقارنة محصّنة ضد هجمات التوقيت."""
    return secrets.compare_digest(str(left or ""), str(right or ""))
