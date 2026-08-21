#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# نسخ احتياطي يومي لـ stingdev: قاعدة البيانات + الوسائط.
# أضِفه إلى crontab:  0 3 * * *  /srv/stingdev/deploy/backup.sh
# ─────────────────────────────────────────────────────────────
set -euo pipefail

ROOT="/srv/stingdev"
DEST="/srv/backups/stingdev"
STAMP="$(date +%Y%m%d-%H%M%S)"
KEEP_DAYS=14

mkdir -p "$DEST"

# قاعدة البيانات — تُقرأ من .env
DB_ENGINE="$(grep -E '^DB_ENGINE=' "$ROOT/.env" | cut -d= -f2 || echo sqlite)"

if [ "$DB_ENGINE" = "postgres" ]; then
    DB_NAME="$(grep -E '^DB_NAME=' "$ROOT/.env" | cut -d= -f2)"
    pg_dump "$DB_NAME" | gzip > "$DEST/db-$STAMP.sql.gz"
else
    # SQLite: نسخة متسقة عبر .backup (لا نسخ الملف أثناء التشغيل)
    sqlite3 "$ROOT/backend/db.sqlite3" ".backup '$DEST/db-$STAMP.sqlite3'"
    gzip "$DEST/db-$STAMP.sqlite3"
fi

# الوسائط
tar -czf "$DEST/media-$STAMP.tar.gz" -C "$ROOT/backend" media

# حذف النسخ الأقدم من KEEP_DAYS
find "$DEST" -name 'db-*' -mtime +$KEEP_DAYS -delete
find "$DEST" -name 'media-*' -mtime +$KEEP_DAYS -delete

echo "اكتمل النسخ الاحتياطي: $STAMP"

# نسخة خارج الخادم (اختياري) — فعّلها بعد ضبط الوجهة:
# rsync -az "$DEST/" backup-host:/remote/stingdev/
