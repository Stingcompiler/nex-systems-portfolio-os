#!/bin/bash
# إقلاع خدمة الـ API على Render: ترحيل → مجموعات ومهام دورية → عامل المهام
# في الخلفية → Gunicorn في المقدمة (هو العملية التي يراقبها Render).
set -e

python manage.py migrate --noinput
python manage.py seed_content --only-if-empty
# متكرر التنفيذ: يلتقط الصلاحيات الجديدة ويسجّل المهام الدورية في جدول django-q
python manage.py seed_groups

# عامل المهام (رسائل التحقق، الحملات، النشر المجدول). بدونه لا تُنفَّذ أي
# مهمة خلفية في الإنتاج. يعمل بعامل واحد (Q_WORKERS) ليبقى ضمن الذاكرة.
python manage.py qcluster &
QCLUSTER_PID=$!

# سقوط العامل يجب أن يُسقط الخدمة كلها كي يعيد Render تشغيلها بدل أن
# تعمل بلا مهام خلفية بصمت.
trap 'kill $QCLUSTER_PID 2>/dev/null' EXIT

# --max-requests يعيد تدوير العامل دوريًا فلا يتراكم تسرّب بطيء.
exec gunicorn config.wsgi:application \
  --bind "0.0.0.0:${PORT:-8000}" \
  --workers "${WEB_CONCURRENCY:-1}" \
  --threads 2 \
  --timeout 120 \
  --max-requests 300 \
  --max-requests-jitter 60 \
  --access-logfile - \
  --error-logfile -
