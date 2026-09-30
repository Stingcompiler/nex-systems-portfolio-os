#!/usr/bin/env bash
# نسخة ليلية: قاعدة البيانات + الملفات المرفوعة إلى /srv/backups/stingdev،
# ويُحذف ما تجاوز KEEP_DAYS. يشغّله stingdev-backup.timer.
#
# النسخ على الخادم نفسه لا تنجو من فقدان الخادم: انسخ المجلد دوريًا إلى
# خارجه (OVH Object Storage أو Backblaze) — README، «النسخ خارج الخادم».
set -euo pipefail

APP_DIR="${APP_DIR:-/srv/apps/stingdev/deploy/vps}"
DEST="${DEST:-/srv/backups/stingdev}"
KEEP_DAYS="${KEEP_DAYS:-14}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"

mkdir -p "$DEST"
cd "$APP_DIR"

# -Fc: مضغوط ويُستعاد بـ pg_restore انتقائيًا
docker compose exec -T db pg_dump -U stingdev -d stingdev -Fc > "$DEST/db-$STAMP.dump.tmp"
mv "$DEST/db-$STAMP.dump.tmp" "$DEST/db-$STAMP.dump"

docker compose exec -T app tar -C /app/backend -czf - media > "$DEST/media-$STAMP.tar.gz.tmp"
mv "$DEST/media-$STAMP.tar.gz.tmp" "$DEST/media-$STAMP.tar.gz"

find "$DEST" -maxdepth 1 -type f \( -name 'db-*.dump' -o -name 'media-*.tar.gz' \) -mtime +"$KEEP_DAYS" -delete
find "$DEST" -maxdepth 1 -type f -name '*.tmp' -mmin +60 -delete

echo "backup ok: $STAMP ($(du -sh "$DEST" | cut -f1) total)"
