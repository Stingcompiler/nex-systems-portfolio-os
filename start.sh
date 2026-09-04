#!/bin/bash
set -e

cd /app/backend
python manage.py migrate --noinput
python manage.py seed_content --only-if-empty

# الحاوية بحدّ 512MB يتقاسمها Django وNode.
# --max-requests يعيد تدوير العامل دوريًا فلا يتراكم تسرّب بطيء.
gunicorn config.wsgi:application \
  --bind 127.0.0.1:8000 \
  --workers 1 \
  --threads 2 \
  --timeout 120 \
  --max-requests 300 \
  --max-requests-jitter 60 \
  --access-logfile - \
  --error-logfile - &

echo "Waiting for Django to be ready..."
for i in $(seq 1 30); do
  if python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/v1/health/')" 2>/dev/null; then
    echo "Django is ready."
    break
  fi
  sleep 1
done

PORT="${PORT:-3000}"

# الصفحات مخزَّنة، وصورة Docker تحمل نسخًا وُلّدت وقت البناء على قاعدة
# فارغة. إبطالها فور الإقلاع يمنع تقديم صفحة مخبوزة فارغة، ويغني عن
# البناء عند كل طلب الذي كان يستنزف ذاكرة الحاوية.
(
  for i in $(seq 1 60); do
    if python - "$PORT" <<'PY' 2>/dev/null
import json, os, sys, urllib.request

port = sys.argv[1]
secret = os.environ.get("REVALIDATE_SECRET", "")
tags = ["settings", "sections", "services", "projects", "case-studies",
        "technologies", "testimonials", "resume", "posts"]
request = urllib.request.Request(
    f"http://127.0.0.1:{port}/api/revalidate",
    data=json.dumps({"tags": tags}).encode(),
    headers={"Content-Type": "application/json", "X-Revalidate-Secret": secret},
    method="POST",
)
with urllib.request.urlopen(request, timeout=5) as response:
    sys.exit(0 if 200 <= response.status < 300 else 1)
PY
    then
      echo "Build-time page cache purged."
      break
    fi
    sleep 2
  done
) &

cd /app/frontend
# V8 يقدّر حجم الكومة من ذاكرة المضيف لا من حدّ الحاوية، فيؤجّل الكنس
# حتى يتجاوز الحدّ ويُقتل. السقف الصريح يجعله يكنس داخل ما هو متاح فعلًا،
# والباقي من الـ512MB لـ Django.
export NODE_OPTIONS="--max-old-space-size=224"
exec npx next start -H 0.0.0.0 -p "$PORT"
