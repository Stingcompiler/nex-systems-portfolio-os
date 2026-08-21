"""إعداد Gunicorn لخدمة Django في الإنتاج.

عدد العمّال محدود عمدًا عند اعتماد SQLite إنتاجيًا لتقليل تنازع الكتابة.
مع PostgreSQL يمكن رفعه إلى (2 × النوى) + 1.
"""

import multiprocessing
import os

bind = "127.0.0.1:8000"

# SQLite: 2–3 عمّال. PostgreSQL: ارفعه حسب النوى.
_db = os.environ.get("DB_ENGINE", "sqlite").lower()
if _db == "postgres":
    workers = multiprocessing.cpu_count() * 2 + 1
else:
    workers = 3

worker_class = "sync"
timeout = 60
graceful_timeout = 30
keepalive = 5
max_requests = 1000
max_requests_jitter = 100

accesslog = "/srv/stingdev/backend/logs/gunicorn-access.log"
errorlog = "/srv/stingdev/backend/logs/gunicorn-error.log"
loglevel = "info"

# الثقة بترويسة البروتوكول من Nginx (لعمل SECURE_PROXY_SSL_HEADER)
forwarded_allow_ips = "127.0.0.1"
