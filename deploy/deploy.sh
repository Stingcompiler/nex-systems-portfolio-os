#!/usr/bin/env bash
# ===============================================================
#  نشر stingdev — أمر واحد للمنصة كاملة
# ---------------------------------------------------------------
#  الاستخدام على الخادم:
#      cd /srv/stingdev && ./deploy/deploy.sh
# ===============================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PYTHON="$ROOT/backend/.venv/bin/python"

echo "▸ سحب آخر التغييرات"
git pull --ff-only

echo "▸ نسخة احتياطية قبل أي ترحيل"
./deploy/backup.sh

echo "▸ تحديث الاعتماديات"
"$PYTHON" -m pip install -r backend/requirements/prod.txt --quiet
(cd frontend && npm ci --omit=dev --no-audit --no-fund)

echo "▸ ترحيل قاعدة البيانات"
DJANGO_SETTINGS_MODULE=config.settings.prod "$PYTHON" backend/manage.py migrate --noinput

echo "▸ مزامنة مجموعات الصلاحيات"
DJANGO_SETTINGS_MODULE=config.settings.prod "$PYTHON" backend/manage.py seed_groups

echo "▸ تجميع الملفات الثابتة"
DJANGO_SETTINGS_MODULE=config.settings.prod "$PYTHON" backend/manage.py collectstatic --noinput

echo "▸ بناء الواجهة"
(cd frontend && npm run build)

echo "▸ إعادة تشغيل المنصة"
sudo systemctl restart stingdev.target

echo "▸ التحقق من الصحة"
sleep 4
for attempt in $(seq 1 10); do
  if curl -fsS http://127.0.0.1:3000/api/v1/health/ >/dev/null 2>&1; then
    echo "✔ اكتمل النشر والخدمة تستجيب"
    exit 0
  fi
  sleep 2
done

echo "✖ الخدمة لا تستجيب بعد النشر — راجع: journalctl -u 'stingdev-*' -n 100"
exit 1
