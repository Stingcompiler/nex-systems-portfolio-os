#!/bin/bash
set -e

cd /app/backend
python manage.py migrate --noinput
python manage.py seed_content

gunicorn config.wsgi:application \
  --bind 127.0.0.1:8000 \
  --workers 2 \
  --timeout 120 \
  --access-logfile - \
  --error-logfile - &

cd /app/frontend
exec npx next start -H 0.0.0.0 -p ${PORT:-3000}
