"""ينسخ الملفات المرفوعة من الموقع القائم إلى قرص الخادم الجديد.

على Render تُحفظ الصور على قرص الخدمة ولا وصول إليه إلا عبر الموقع نفسه،
لكن كل ملف مخزَّن يُخدم علنًا تحت /media/. بعد استعادة قاعدة البيانات هنا
يقرأ هذا السكربت مسار كل ملف من كل حقل FileField/ImageField وينزّله إن
لم يكن موجودًا — والنسخ المشتقة (WebP والمصغّرات) حقول ملفات أيضًا فتُنسخ معها.

التشغيل (من deploy/vps على الخادم):

    sudo docker compose exec app python /app/deploy/vps/pull_media.py https://stingdev.pro
"""

from __future__ import annotations

import os
import sys
import urllib.parse
import urllib.request
from pathlib import Path

sys.path.insert(0, "/app/backend")
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.prod")

import django  # noqa: E402

django.setup()

from django.apps import apps  # noqa: E402
from django.conf import settings  # noqa: E402
from django.db import models  # noqa: E402


def stored_paths() -> set[str]:
    paths: set[str] = set()
    for model in apps.get_models():
        fields = [f.name for f in model._meta.get_fields() if isinstance(f, models.FileField)]
        if not fields:
            continue
        for row in model._default_manager.values_list(*fields):
            paths.update(value for value in row if value)
    return paths


def main(origin: str) -> int:
    root = Path(settings.MEDIA_ROOT)
    paths = sorted(stored_paths())
    fetched = present = failed = 0
    for name in paths:
        target = root / name
        if target.exists() and target.stat().st_size > 0:
            present += 1
            continue
        url = f"{origin.rstrip('/')}/media/{urllib.parse.quote(name)}"
        try:
            with urllib.request.urlopen(url, timeout=60) as response:
                data = response.read()
        except Exception as error:  # noqa: BLE001
            failed += 1
            print(f"FAIL {name}: {error}")
            continue
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
        fetched += 1
    print(f"{len(paths)} files: {fetched} fetched, {present} already here, {failed} failed")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1] if len(sys.argv) > 1 else "https://stingdev.pro"))
