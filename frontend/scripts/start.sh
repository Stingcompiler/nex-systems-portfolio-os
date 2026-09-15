#!/bin/bash
# إقلاع خدمة الواجهة على Render.
set -e

PORT="${PORT:-3000}"

# الصفحات المخزَّنة وقت البناء وُلّدت بلا API (NEXT_BUILD_OFFLINE)، فتُبطل
# فور استماع Next كي لا تُقدَّم صفحة فارغة حتى انتهاء مهلتها.
(
  for i in $(seq 1 60); do
    if node -e '
      const secret = process.env.REVALIDATE_SECRET || "";
      const tags = ["settings","sections","services","projects","case-studies",
                    "technologies","testimonials","resume","posts"];
      fetch(`http://127.0.0.1:${process.argv[1]}/api/revalidate`, {
        method: "POST",
        headers: {"Content-Type": "application/json", "X-Revalidate-Secret": secret},
        body: JSON.stringify({tags}),
      }).then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1));
    ' "$PORT" 2>/dev/null; then
      echo "Build-time page cache purged."
      break
    fi
    sleep 2
  done
) &

# V8 يقدّر حجم الكومة من ذاكرة المضيف لا من حدّ الخدمة، فيؤجّل الكنس حتى
# يتجاوز الحدّ ويُقتل. السقف الصريح يجعله يكنس داخل ما هو متاح فعلًا.
export NODE_OPTIONS="--max-old-space-size=${NODE_HEAP_MB:-384}"
# Node هو العملية الأولى فيتلقّى إشارة الإيقاف بنفسه (لا عبر npm).
exec node ./node_modules/next/dist/bin/next start -H 0.0.0.0 -p "$PORT"
