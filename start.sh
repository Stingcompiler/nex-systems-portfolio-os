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

cd /app/frontend
# V8 يقدّر حجم الكومة من ذاكرة المضيف لا من حدّ الحاوية، فيؤجّل الكنس
# حتى يتجاوز الحدّ ويُقتل. السقف الصريح يجعله يكنس داخل ما هو متاح فعلًا:
# ~256MB كومة + عبء Node غير المُكوَّم، والباقي لـ Django.
export NODE_OPTIONS="--max-old-space-size=256"
exec npx next start -H 0.0.0.0 -p ${PORT:-3000}
