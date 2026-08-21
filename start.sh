#!/bin/bash
set -e

cd /app/backend
python manage.py migrate --noinput
python manage.py seed_content --only-if-empty

gunicorn config.wsgi:application \
  --bind 127.0.0.1:8000 \
  --workers 1 \
  --timeout 120 \
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
exec npx next start -H 0.0.0.0 -p ${PORT:-3000}
