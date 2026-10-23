#!/usr/bin/env python3
"""فحص التباين لرموز الألوان في globals.css بالثيمين — Design Reference v2.2 §14.

النص والشارات ≥ 4.5:1، والحدود والأيقونات والرسوم ≥ 3:1.
الاستخدام (من frontend): python3 scripts/check_contrast.py — ينتهي بالفشل عند أي مخالفة.
"""
import pathlib
import re
import sys

CSS = pathlib.Path(__file__).resolve().parent.parent / "src/app/globals.css"

# (الأمامي، الخلفية، الحد الأدنى، الوصف)
PAIRS = [
    ("foreground", "background", 4.5, "النص على الصفحة"),
    ("foreground", "surface", 4.5, "النص على السطح"),
    ("foreground-muted", "surface", 4.5, "النص الخافت على السطح"),
    ("foreground-muted", "background", 4.5, "النص الخافت على الصفحة"),
    ("text-secondary", "surface", 4.5, "التسميات"),
    ("primary", "surface", 4.5, "الروابط ولون العلامة"),
    ("primary-foreground", "primary", 4.5, "نص الزر الرئيسي"),
    ("primary", "primary-soft", 4.5, "العنصر النشط"),
    ("success", "success-soft", 4.5, "شارة النجاح"),
    ("warning", "warning-soft", 4.5, "شارة التحذير"),
    ("danger", "danger-soft", 4.5, "شارة الخطر"),
    ("info", "info-soft", 4.5, "شارة المعلومة"),
    ("pending", "pending-soft", 4.5, "شارة الانتظار"),
    ("border-strong", "surface", 3.0, "حدود الحقول"),
    ("focus", "background", 3.0, "حلقة التركيز"),
    *[(f"chart-{i}", "surface", 3.0, f"سلسلة الرسم {i}") for i in range(1, 6)],
]


def block(css: str, selector: str) -> dict[str, tuple[int, int, int]]:
    start = css.index(selector + " {")
    body = css[start : css.index("\n  }", start)]
    return {
        name: tuple(int(x) for x in rgb.split())
        for name, rgb in re.findall(r"--([\w-]+):\s*(\d+ \d+ \d+)\s*;", body)
    }


def luminance(rgb):
    def channel(c):
        c /= 255
        return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    r, g, b = (channel(c) for c in rgb)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def ratio(a, b):
    la, lb = sorted((luminance(a), luminance(b)), reverse=True)
    return (la + 0.05) / (lb + 0.05)


css = CSS.read_text()
light = block(css, ":root")
themes = {"فاتح": light, "داكن": {**light, **block(css, ".dark")}}
failed = 0
for theme, colors in themes.items():
    for fg, bg, minimum, label in PAIRS:
        value = ratio(colors[fg], colors[bg])
        ok = value >= minimum
        failed += not ok
        print(f"{'✓' if ok else '✗'} {theme:5} {value:5.2f} ≥ {minimum}  {label} ({fg} / {bg})")
sys.exit(1 if failed else 0)
