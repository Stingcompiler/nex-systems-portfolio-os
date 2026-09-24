#!/bin/bash
set -e

# سر الإبطال يربط ثلاثة أطراف في هذه الحاوية: Django (يُبطل الصفحات عند
# الحفظ من اللوحة)، وNext (مسار /api/revalidate)، وإبطال الإقلاع أدناه.
# إن لم يُضبط في بيئة Render كان Django يستخدم "change-me" وNext بلا قيمة،
# فيُرفض كل إبطال بـ401: تبقى صفحات البناء الفارغة لأول زائر، ويتأخر ظهور
# تعديلات اللوحة حتى تنتهي مهلة التخزين. سرّ عشوائي لكل إقلاع يكفي لأن
# الأطراف الثلاثة تقرأ البيئة نفسها — ولا يمس قيمة مضبوطة مسبقًا.
if [ -z "${REVALIDATE_SECRET:-}" ]; then
  REVALIDATE_SECRET="$(python -c 'import secrets; print(secrets.token_urlsafe(32))')"
  export REVALIDATE_SECRET
  echo "REVALIDATE_SECRET was not set; generated one for this boot."
fi

cd /app/backend
python manage.py migrate --noinput
python manage.py seed_content --only-if-empty
# صور رُفعت بلا عامل خلفي تبقى بلا نسخة WebP فتُخدم خامًا (1MB للصورة).
# المعالجة هنا — قبل إقلاع Node — حيث الذاكرة كلها متاحة، ولا تمس إلا الناقص.
python manage.py process_media || true

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

# الصفحات مخزَّنة، وصورة Docker تحمل نسخًا وُلّدت وقت البناء بلا محتوى.
# إبطالها فور الإقلاع يمنع تقديم صفحة مخبوزة فارغة. `all` يُبطل شجرة
# الصفحات كلها لا الوسوم فقط، والفشل يُسجَّل برمزه لا بصمت — 401 يعني أن
# REVALIDATE_SECRET غير مطابق بين البيئة والخدمة.
(
  for i in $(seq 1 90); do
    result=$(python - "$PORT" <<'PY' 2>&1
import json, os, sys, urllib.error, urllib.request

port = sys.argv[1]
secret = os.environ.get("REVALIDATE_SECRET", "")
tags = ["settings", "sections", "services", "projects", "case-studies",
        "technologies", "testimonials", "resume", "posts"]
request = urllib.request.Request(
    f"http://127.0.0.1:{port}/api/revalidate",
    data=json.dumps({"tags": tags, "all": True}).encode(),
    headers={"Content-Type": "application/json", "X-Revalidate-Secret": secret},
    method="POST",
)
try:
    with urllib.request.urlopen(request, timeout=5) as response:
        print("ok" if 200 <= response.status < 300 else f"http {response.status}")
except urllib.error.HTTPError as error:
    print(f"http {error.code}")
except Exception as error:  # noqa: BLE001
    print(f"unreachable ({error.__class__.__name__})")
PY
    )
    if [ "$result" = "ok" ]; then
      echo "Build-time page cache purged."
      # الإبطال يعلّم الصفحات قديمة فقط: أول زائر لكل صفحة كان يتلقى النسخة
      # المخبوزة وقت البناء (بلا إعدادات: اسم احتياطي وبلا واتساب) بينما
      # تُعاد توليدها في الخلفية. زيارة صفحات خريطة الموقع هنا — واحدة
      # تلو الأخرى كي لا تُثقل العامل الوحيد — تجعل إعادة التوليد تسبق الزوار.
      python - "$PORT" <<'PY' || true
import re, sys, time, urllib.request

port = sys.argv[1]
base = f"http://127.0.0.1:{port}"
# خريطة الموقع نفسها قد تكون النسخة المخبوزة: الطلب الأول يُطلق توليدها
sitemap = ""
for _ in range(2):
    try:
        with urllib.request.urlopen(f"{base}/sitemap.xml", timeout=30) as response:
            sitemap = response.read().decode("utf-8", "replace")
    except Exception:  # noqa: BLE001
        pass
    time.sleep(2)

core = [f"/{locale}{page}" for locale in ("ar", "en") for page in (
    "", "/services", "/solutions", "/projects", "/process", "/about",
    "/blog", "/contact", "/request-quote", "/technologies", "/case-studies",
)]
paths = sorted(set(core) | {re.sub(r"^https?://[^/]+", "", url) or "/"
                            for url in re.findall(r"<loc>([^<]+)</loc>", sitemap)})
warmed = 0
for path in paths:
    # مرتان: الأولى تُطلق إعادة التوليد وتُعيد القديمة، والثانية تنتظر الجديدة
    for _ in range(2):
        try:
            urllib.request.urlopen(f"{base}{path}", timeout=60).read()
        except Exception:  # noqa: BLE001
            pass
        time.sleep(0.3)
    warmed += 1
print(f"Warmed {warmed} pages.")
PY
      break
    fi
    case "$result" in
      http\ 401) echo "Cache purge rejected (401): REVALIDATE_SECRET mismatch — pages stay stale until their window expires."; break ;;
    esac
    sleep 2
  done
  [ "$result" = "ok" ] || echo "Cache purge did not succeed (last: $result)."
) &

cd /app/frontend
# V8 يقدّر حجم الكومة من ذاكرة المضيف لا من حدّ الحاوية، فيؤجّل الكنس
# حتى يتجاوز الحدّ ويُقتل. السقف الصريح يجعله يكنس داخل ما هو متاح فعلًا،
# والباقي من الـ512MB لـ Django.
# قِيس محليًا: 128MB تكفي الموقع كله بلا أخطاء (185MB RSS بعد 45 صفحة)
# مقابل 250MB عند 224 — والفارق هو هامش الحاوية.
export NODE_OPTIONS="--max-old-space-size=${NODE_HEAP_MB:-128}"
# يُنفَّذ الخادم مباشرة لا عبر npx: الغلاف كان يضيف عمليتَي npm وsh بين
# النظام وNode، فلا تصل إشارة الإيقاف إلى Next نظيفة — تظهر في السجل
# كخطأ SIGTERM من npm ويتأخّر الإغلاق. Node هنا هو العملية الأولى فيتلقّى
# الإشارة بنفسه، مع توفير عمليتين من ذاكرة الحاوية.
exec node ./node_modules/next/dist/bin/next start -H 0.0.0.0 -p "$PORT"
