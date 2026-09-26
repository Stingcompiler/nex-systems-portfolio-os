"""يولّد شعار «السين البيانية» بصيغتي SVG وPNG من تعريف هندسي واحد.

التشغيل (من مجلد frontend):

    ../backend/.venv/bin/python scripts/generate-icons.py

الشعار: أسنان حرف «س» ثلاثة أعمدة بيانية تصعد باتجاه القراءة، وذيل السين
يلتف تحتها — هوية عربية ونظام إدارة وأرقام في شكل واحد.

كل الإحداثيات على شبكة 64×64 هي نفسها في SVG والصور، فلا تختلف أيقونة
التطبيق عن الشعار في الصفحة. الرسم النقطي بدقة ×4 ثم تصغير لحواف ناعمة.
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
BRAND = ROOT / "public" / "brand"
ICONS = ROOT / "public" / "icons"

TEAL = "#0E7C86"
NAVY = "#12253B"
WHITE = "#FFFFFF"
ACCENT = "#8FE0E4"

#: الأعمدة (x, y, عرض, ارتفاع) — من اليمين: قصير ثم أطول، بقاعدة واحدة عند y=40
BARS = [(45, 31, 6, 9), (36, 25, 6, 15), (27, 18, 6, 22)]
BAR_RADIUS = 2
#: ذيل السين: خط القاعدة ثم منحنيان
TAIL_START = (51, 40)
TAIL_LINE_END = (25, 40)
TAIL_CURVES = [
    ((16, 40), (12, 47), (16, 52)),
    ((19, 56), (26, 56), (30, 53)),
]
TAIL_WIDTH = 6
#: المربع المضيء — يُحذف في المقاسات الصغيرة حيث يصير نقطة مشوّشة
SPARK = (47, 12, 6, 6)

TAIL_PATH = (
    f"M{TAIL_START[0]} {TAIL_START[1]}H{TAIL_LINE_END[0]}"
    + "".join(f"C{a[0]} {a[1]} {b[0]} {b[1]} {c[0]} {c[1]}" for a, b, c in TAIL_CURVES)
)


# ------------------------------------------------------------------ SVG

def mark_svg(*, spark: bool = True, rx: int = 15) -> str:
    bars = "".join(
        f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{BAR_RADIUS}" fill="{WHITE}"/>'
        for x, y, w, h in BARS
    )
    spark_el = (
        f'<rect x="{SPARK[0]}" y="{SPARK[1]}" width="{SPARK[2]}" height="{SPARK[3]}" '
        f'rx="1.5" fill="{ACCENT}"/>'
        if spark
        else ""
    )
    return (
        f'<rect width="64" height="64" rx="{rx}" fill="{TEAL}"/>{bars}'
        f'<path d="{TAIL_PATH}" fill="none" stroke="{WHITE}" stroke-width="{TAIL_WIDTH}" '
        f'stroke-linecap="round" stroke-linejoin="round"/>{spark_el}'
    )


def write_svgs() -> None:
    BRAND.mkdir(parents=True, exist_ok=True)
    (BRAND / "stingsystem-mark.svg").write_text(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" '
        f'aria-label="StingSystem">{mark_svg()}</svg>\n',
        encoding="utf-8",
    )
    # الشعار الكامل: العلامة + الاسم. الخط من النظام — للطباعة والعروض يُفضَّل
    # تحويل النص إلى مسارات في محرر رسوم
    (BRAND / "stingsystem-logo.svg").write_text(
        # direction ثابت: داخل صفحة عربية يرث النص الاتجاه فيمتد فوق العلامة
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 64" role="img" '
        f'aria-label="StingSystem" direction="ltr">{mark_svg()}'
        '<text x="80" y="42" font-family="Inter, \'Segoe UI\', Arial, sans-serif" '
        f'font-size="30" font-weight="700" letter-spacing="-0.6" fill="{NAVY}">'
        f'Sting<tspan fill="{TEAL}">System</tspan></text></svg>\n',
        encoding="utf-8",
    )
    (BRAND / "stingsystem-logo-ar.svg").write_text(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 64" role="img" '
        'aria-label="ستينج سيستم" direction="rtl">'
        f'<g transform="translate(236 0)">{mark_svg()}</g>'
        '<text x="222" y="43" text-anchor="start" '
        'font-family="Tajawal, \'IBM Plex Sans Arabic\', \'Segoe UI\', Tahoma, sans-serif" '
        f'font-size="32" font-weight="700" fill="{NAVY}">ستينج '
        f'<tspan fill="{TEAL}">سيستم</tspan></text></svg>\n',
        encoding="utf-8",
    )


# ------------------------------------------------------------------ PNG

SCALE = 4  # رسم بدقة ×4 ثم تصغير = حواف ناعمة


def _bezier(p0, p1, p2, p3, steps=48):
    for index in range(steps + 1):
        t = index / steps
        mt = 1 - t
        yield (
            mt**3 * p0[0] + 3 * mt**2 * t * p1[0] + 3 * mt * t**2 * p2[0] + t**3 * p3[0],
            mt**3 * p0[1] + 3 * mt**2 * t * p1[1] + 3 * mt * t**2 * p2[1] + t**3 * p3[1],
        )


def _tail_points():
    points = [TAIL_START, TAIL_LINE_END]
    current = TAIL_LINE_END
    for a, b, c in TAIL_CURVES:
        points.extend(list(_bezier(current, a, b, c))[1:])
        current = c
    return points


def draw_mark(size: int, *, spark: bool, rounded: bool, content_scale: float = 1.0) -> Image.Image:
    """العلامة بمقاس ``size``. ``content_scale`` يصغّر المحتوى حول المركز (للأيقونة القابلة للقص)."""
    big = size * SCALE
    unit = big / 64
    image = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)

    radius = 15 * unit if rounded else 0
    draw.rounded_rectangle((0, 0, big - 1, big - 1), radius=radius, fill=TEAL)

    offset = 32 * (1 - content_scale)

    def point(x, y):
        return ((offset + x * content_scale) * unit, (offset + y * content_scale) * unit)

    def rect(x, y, w, h, r, fill):
        x0, y0 = point(x, y)
        x1, y1 = point(x + w, y + h)
        draw.rounded_rectangle((x0, y0, x1, y1), radius=r * content_scale * unit, fill=fill)

    for x, y, w, h in BARS:
        rect(x, y, w, h, BAR_RADIUS, WHITE)

    # الخط السميك في Pillow يترك حوافًا مسننة عند المنحنيات: يُرسم الذيل
    # بطبع دوائر متقاربة على طول المسار — حافة ناعمة وأطراف دائرية كما في SVG
    r = TAIL_WIDTH * content_scale * unit / 2
    points = [point(*p) for p in _tail_points()]
    for (x0, y0), (x1, y1) in zip(points, points[1:]):
        steps = max(1, int(((x1 - x0) ** 2 + (y1 - y0) ** 2) ** 0.5 / (r / 4)))
        for index in range(steps + 1):
            t = index / steps
            cx, cy = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t
            draw.ellipse((cx - r, cy - r, cx + r, cy + r), fill=WHITE)

    if spark:
        rect(*SPARK, 1.5, ACCENT)

    return image.resize((size, size), Image.LANCZOS)


def write_pngs() -> None:
    ICONS.mkdir(parents=True, exist_ok=True)
    draw_mark(512, spark=True, rounded=True).save(ICONS / "icon-512.png")
    draw_mark(192, spark=True, rounded=True).save(ICONS / "icon-192.png")
    # iOS يقص الزوايا بنفسه: مربع كامل بلا حواف شفافة
    draw_mark(180, spark=True, rounded=False).save(ICONS / "apple-icon-180.png")
    # أندرويد يقص الأيقونة القابلة للقص بأشكال مختلفة: المحتوى داخل المنطقة الآمنة (80%)
    draw_mark(512, spark=True, rounded=False, content_scale=0.72).save(
        ICONS / "icon-maskable-512.png"
    )
    small = draw_mark(48, spark=False, rounded=True)
    small.save(ICONS / "favicon-48.png")
    small.save(ROOT / "public" / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])


if __name__ == "__main__":
    write_svgs()
    write_pngs()
    print("icons written to", BRAND, "and", ICONS)
