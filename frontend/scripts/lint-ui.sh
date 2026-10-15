#!/usr/bin/env bash
# فحص نصي للأنماط الممنوعة في بطاقات الواجهة (docs/ui-profile.md).
# ينتهي بالفشل ويعرض المواضع عند وجود مخالفة غير مستثناة، وبنجاح صامت عند الخلو.
# الاستثناء: تعليق في السطر نفسه  {/* ui-allow: السبب */}  أو  // ui-allow: السبب
# يكشف أنماطًا محددة فقط ولا يغني عن المراجعة البصرية (shots.mjs).
cd "$(dirname "$0")/.." || exit 1

# يحذف المواضع الموثقة في ui-allow.txt (مسار | جزء سطر | سبب)
filter_allowed() {
  awk -F' \\| ' 'NR==FNR { if ($0 !~ /^#/ && NF>=2) { p[++n]=$1; f[n]=$2 } next }
    { ok=0; for (i=1;i<=n;i++) if (index($0,p[i]) && index($0,f[i])) ok=1; if (!ok) print }' scripts/ui-allow.txt -
}

check() { # الاسم، النمط
  local hits
  hits=$(grep -rnE "$2" src -I | grep -E '\.tsx?:' | grep -v 'ui-allow:' | filter_allowed)
  if [ -n "$hits" ]; then echo "✗ $1"; echo "$hits" | sed 's/^/    /'; FAIL=1; fi
}

FAIL=0
check "شريط ملوّن على حافة بطاقة" 'border-(l|r|s|e|t|b)-(2|4|8)\b|border-\[(2|3|4|5|6)px\]|absolute inset-x-0 top-0 h-1|<span aria-hidden="true" className="h-1 '
check "أيقونة داخل مربع أو دائرة مصبوغة" 'size-(9|10|11|12) (shrink-0 )?place-items-center rounded[^"]* bg-[a-z-]*(soft|primary/10)|grid size-[0-9]+ place-items-center rounded[^"]* bg-primary-soft'
check "حركة مستمرة على عنصر ساكن" 'animate-(pulse|bounce|ping|float|float-reverse)\b'
exit $FAIL
