#!/bin/bash
set -e

cd /app/backend

export SECRET_KEY=build-only-key
export DJANGO_SETTINGS_MODULE=config.settings.prod
export DB_ENGINE=sqlite
export ALLOWED_HOSTS=localhost,127.0.0.1
export SECURE_SSL_REDIRECT=False

# قاعدة فارغة عمدًا: البناء لا يخبز محتوى بعد الآن (الصفحات تُبنى عند
# الطلب)، وزرع بيانات تجريبية هنا كان يجعلها تظهر للزوار بعد كل نشر.
python manage.py migrate --noinput

python manage.py runserver 127.0.0.1:8000 &
DJANGO_PID=$!

for i in $(seq 1 30); do
  if python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/v1/health/')" 2>/dev/null; then
    break
  fi
  sleep 1
done

cd /app/frontend
npm run build

kill $DJANGO_PID 2>/dev/null || true
rm -f /app/backend/db.sqlite3
