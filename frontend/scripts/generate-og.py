"""
يولّد بطاقتي المشاركة الافتراضيتين (Open Graph / Twitter) بحجم 1200×630:
public/og/ar.png و public/og/en.png.

لماذا سكربت ثابت لا مولّد وقت التشغيل: محرّك Satori الذي يقف خلف
`next/og` لا يدعم اتجاه النص العربي ولا يقيس عرض كلماته بدقة، فتخرج
الجملة معكوسة أو متباعدة. Pillow مع arabic-reshaper وpython-bidi يشكّل
الحروف ويعكس الترتيب بصريًا بشكل صحيح.

التشغيل (من مجلد frontend، ببيئة الباكند التي تحوي Pillow):
    ../backend/.venv/bin/python scripts/generate-og.py

يُعاد التشغيل فقط عند تغيير الاسم أو الشعار النصي أو الخط.
"""

from __future__ import annotations

from pathlib import Path

import arabic_reshaper
from bidi.algorithm import get_display
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
FONT_DIR = ROOT / "scripts" / "fonts"
OUT_DIR = ROOT / "public" / "og"

WIDTH, HEIGHT = 1200, 630
PAD_X, PAD_Y = 80, 72

# لوحة «سَنط» من globals.css
BG_START, BG_END = (247, 248, 245), (230, 239, 232)
INK = (22, 33, 27)
MUTED = (95, 114, 103)
PRIMARY = (30, 106, 79)
PRIMARY_FG = (244, 251, 247)

CARDS = {
    "ar": {
        "rtl": True,
        "name": "ستينج سيستمز",
        "mark": "س",
        "tagline": "حلول برمجية متكاملة للويب والموبايل وسطح المكتب",
        "domain": "stingdev.pro",
    },
    "en": {
        "rtl": False,
        "name": "StingSystems",
        "mark": "S",
        "tagline": "Complete software solutions for web, mobile, and desktop",
        "domain": "stingdev.pro",
    },
}


def font(weight: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(FONT_DIR / f"IBMPlexSansArabic-{weight}.ttf"), size)


def shape(text: str, rtl: bool) -> str:
    """يشكّل الحروف ويرتّبها بصريًا — Pillow بلا raqm يرسم الحروف كما تُعطى."""
    return get_display(arabic_reshaper.reshape(text)) if rtl else text


def gradient() -> Image.Image:
    image = Image.new("RGB", (WIDTH, HEIGHT), BG_START)
    pixels = image.load()
    for y in range(HEIGHT):
        for x in range(WIDTH):
            t = (x / WIDTH + y / HEIGHT) / 2
            pixels[x, y] = tuple(round(a + (b - a) * t) for a, b in zip(BG_START, BG_END))
    return image


def wrap(words: list[str], fnt: ImageFont.FreeTypeFont, max_width: int, rtl: bool) -> list[str]:
    """التفاف بالكلمات على العرض المتاح؛ القياس على النص المشكّل."""
    lines: list[str] = []
    current: list[str] = []
    for word in words:
        candidate = " ".join(current + [word])
        if current and fnt.getlength(shape(candidate, rtl)) > max_width:
            lines.append(" ".join(current))
            current = [word]
        else:
            current.append(word)
    if current:
        lines.append(" ".join(current))
    return lines


def draw_card(locale: str, spec: dict) -> None:
    rtl = spec["rtl"]
    image = gradient()
    draw = ImageDraw.Draw(image)
    anchor_x = WIDTH - PAD_X if rtl else PAD_X
    align = "ra" if rtl else "la"

    # علامة الاسم: مربع أخضر بحرف أول، ثم الاسم
    mark_size = 72
    mark_x = WIDTH - PAD_X - mark_size if rtl else PAD_X
    draw.rounded_rectangle(
        (mark_x, PAD_Y, mark_x + mark_size, PAD_Y + mark_size), radius=18, fill=PRIMARY
    )
    mark_font = font("Bold", 36)
    draw.text(
        (mark_x + mark_size / 2, PAD_Y + mark_size / 2),
        shape(spec["mark"], rtl),
        font=mark_font,
        fill=PRIMARY_FG,
        anchor="mm",
    )
    name_font = font("Bold", 40)
    name_x = mark_x - 20 if rtl else mark_x + mark_size + 20
    draw.text(
        (name_x, PAD_Y + mark_size / 2),
        shape(spec["name"], rtl),
        font=name_font,
        fill=INK,
        anchor="rm" if rtl else "lm",
    )

    # الشعار النصي على سطرين كحد أقصى
    title_font = font("Bold", 60)
    lines = wrap(spec["tagline"].split(), title_font, WIDTH - 2 * PAD_X - 160, rtl)
    line_height = 60 * 1.3
    block_height = line_height * len(lines)
    y = (HEIGHT - block_height) / 2 + 10
    for line in lines:
        draw.text((anchor_x, y), shape(line, rtl), font=title_font, fill=INK, anchor=align)
        y += line_height

    # النطاق وخط أخضر قصير في الطرف المقابل
    footer_font = font("Regular", 26)
    footer_y = HEIGHT - PAD_Y
    draw.text((anchor_x, footer_y), spec["domain"], font=footer_font, fill=MUTED, anchor="rd" if rtl else "ld")
    bar_x = PAD_X if rtl else WIDTH - PAD_X - 120
    draw.rounded_rectangle((bar_x, footer_y - 14, bar_x + 120, footer_y - 8), radius=3, fill=PRIMARY)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out = OUT_DIR / f"{locale}.png"
    image.save(out, optimize=True)
    print(f"{out.relative_to(ROOT)}  {out.stat().st_size // 1024}KB")


if __name__ == "__main__":
    for locale, spec in CARDS.items():
        draw_card(locale, spec)
