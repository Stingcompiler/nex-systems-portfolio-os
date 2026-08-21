"""يزرع المحتوى الأولي الحقيقي للمنصة.

قاعدة صارمة: لا بيانات ملفَّقة. كل ما يُزرع هنا إما وقائع مؤكدة (التقنيات
المستخدمة، المشروعان المنشوران)، أو وصف خدمات يقدّمها المطور فعلًا.
ما لا يمكن التحقق منه — الشهادات، الإحصائيات، الخبرات، بيانات التواصل —
لا يُزرع إطلاقًا، ويُطبع بدلًا منه في نهاية التنفيذ كقائمة مهام.
"""

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from apps.core.models.content import FAQ, PageSection, ProcessStep
from apps.core.models.settings import SEOSettings, SiteSettings
from apps.portfolio.enums import ProjectStatus, ProjectType, Sector, TechnologyCategory
from apps.portfolio.models import Project, ProjectTechnology, Service, Technology

# --------------------------------------------------------------- التقنيات

TECHNOLOGIES = [
    ("Python", "python", TechnologyCategory.LANGUAGE, 5, True),
    ("C#", "csharp", TechnologyCategory.LANGUAGE, 4, True),
    ("JavaScript", "javascript", TechnologyCategory.LANGUAGE, 5, True),
    ("SQL", "sql", TechnologyCategory.LANGUAGE, 5, False),
    ("Next.js", "nextjs", TechnologyCategory.FRONTEND, 5, True),
    ("React", "react", TechnologyCategory.FRONTEND, 5, True),
    ("Tailwind CSS", "tailwindcss", TechnologyCategory.FRONTEND, 5, True),
    ("Framer Motion", "framer-motion", TechnologyCategory.FRONTEND, 4, False),
    ("Django", "django", TechnologyCategory.BACKEND, 5, True),
    ("Django REST Framework", "django-rest-framework", TechnologyCategory.BACKEND, 5, True),
    ("JWT Authentication", "jwt", TechnologyCategory.BACKEND, 4, False),
    ("React Native", "react-native", TechnologyCategory.MOBILE, 4, True),
    ("Expo", "expo", TechnologyCategory.MOBILE, 4, False),
    ("Windows Desktop", "windows-desktop", TechnologyCategory.DESKTOP, 4, False),
    ("PostgreSQL", "postgresql", TechnologyCategory.DATABASE, 5, True),
    ("SQLite", "sqlite", TechnologyCategory.DATABASE, 4, False),
    ("Git", "git", TechnologyCategory.TOOL, 4, False),
    ("Linux", "linux", TechnologyCategory.TOOL, 4, False),
    ("UML", "uml", TechnologyCategory.TOOL, 4, False),
    ("ERD", "erd", TechnologyCategory.TOOL, 5, False),
]

# --------------------------------------------------------------- الخدمات المنشورة

PUBLISHED_SERVICES = [
    {
        "slug": "web-development",
        "kind": Service.Kind.SERVICE,
        "sector": Sector.GENERAL,
        "icon": "globe",
        "title_ar": "تطوير المواقع وتطبيقات الويب",
        "title_en": "Web & Web Application Development",
        "short_description_ar": (
            "مواقع وتطبيقات ويب سريعة وقابلة للتوسع، تدعم العربية والإنجليزية، "
            "وتُبنى من التحليل حتى النشر والدعم."
        ),
        "short_description_en": (
            "Fast, scalable web applications with full Arabic and English support, "
            "built from analysis through deployment and support."
        ),
        "description_ar": (
            "نبني تطبيقات ويب متكاملة تبدأ من فهم مشكلة العمل لا من الواجهة. "
            "الخطوة الأولى دائمًا جلسة تحليل نحدد فيها المستخدمين وأدوارهم، والعمليات "
            "التي يقوم بها كل دور، والبيانات التي يحتاجها النظام، ثم نُخرج مخطط قاعدة "
            "بيانات وخريطة شاشات قبل كتابة أي سطر برمجي.\n\n"
            "التنفيذ يعتمد على Next.js في الواجهة وDjango REST Framework في الخادم. "
            "هذا الفصل يعني أن الواجهة والخادم يتطوران باستقلال، وأن نفس الواجهة "
            "البرمجية تخدم لاحقًا تطبيق موبايل دون إعادة بناء. الصفحات العامة تُولَّد "
            "على الخادم لتظهر كاملة لمحركات البحث ولتفتح سريعًا على شبكات ضعيفة، "
            "والأجزاء التفاعلية وحدها تُحمَّل في المتصفح.\n\n"
            "كل مشروع يُسلَّم بدعم كامل للعربية من اليمين إلى اليسار وللإنجليزية من "
            "اليسار إلى اليمين، بوضع فاتح وداكن، ولوحة تحكم تتيح تعديل المحتوى دون "
            "الرجوع إلينا. نُسلّم كذلك توثيق الواجهة البرمجية، وإعدادات النشر، وشرحًا "
            "عمليًا لفريقك حتى يتمكن من تشغيل النظام باستقلال."
        ),
        "description_en": (
            "We build complete web applications that start from the business problem, "
            "not from the interface. Every project opens with an analysis session where "
            "we define users and roles, the operations each role performs, and the data "
            "the system needs — producing a database schema and screen map before any "
            "code is written.\n\n"
            "Implementation uses Next.js on the front end and Django REST Framework on "
            "the server. That separation means the same API can later serve a mobile app "
            "without a rewrite. Public pages are server-rendered so they load fast on weak "
            "connections and appear complete to search engines.\n\n"
            "Every project ships with full Arabic RTL and English LTR support, light and "
            "dark modes, and a dashboard that lets you edit content without coming back to "
            "us. API documentation, deployment configuration, and a practical handover "
            "session are included."
        ),
        "features": [
            {"title_ar": "تحليل قبل التنفيذ", "title_en": "Analysis before code",
             "description_ar": "مخطط قاعدة بيانات وخريطة شاشات معتمدة قبل البرمجة.",
             "description_en": "An approved schema and screen map before development starts.",
             "icon": "clipboard-list"},
            {"title_ar": "عربي وإنجليزي كاملان", "title_en": "Full Arabic and English",
             "description_ar": "دعم RTL أصيل لا ترجمة سطحية، مع محتوى قابل للتحرير بلغتيه.",
             "description_en": "Genuine RTL support with bilingual editable content.",
             "icon": "languages"},
            {"title_ar": "أداء و SEO", "title_en": "Performance and SEO",
             "description_ar": "توليد على الخادم، وصور محسّنة، وبيانات منظمة لمحركات البحث.",
             "description_en": "Server rendering, optimized images, and structured data.",
             "icon": "gauge"},
            {"title_ar": "لوحة تحكم", "title_en": "Admin dashboard",
             "description_ar": "تعديل كل المحتوى دون تعديل الكود.",
             "description_en": "Edit all content without touching code.",
             "icon": "layout-dashboard"},
        ],
        "deliverables": [
            {"ar": "كود المصدر كاملًا على مستودع Git", "en": "Full source code in a Git repository"},
            {"ar": "قاعدة بيانات موثّقة بمخطط ERD", "en": "Documented database with an ERD"},
            {"ar": "توثيق تفاعلي للواجهة البرمجية", "en": "Interactive API documentation"},
            {"ar": "نشر على الخادم مع شهادة SSL", "en": "Server deployment with an SSL certificate"},
            {"ar": "جلسة تسليم وتدريب", "en": "Handover and training session"},
        ],
        "technologies": ["nextjs", "react", "django", "django-rest-framework", "postgresql", "tailwindcss"],
    },
    {
        "slug": "mobile-app-development",
        "kind": Service.Kind.SERVICE,
        "sector": Sector.GENERAL,
        "icon": "smartphone",
        "title_ar": "تطوير تطبيقات الموبايل",
        "title_en": "Mobile Application Development",
        "short_description_ar": (
            "تطبيقات Android وiOS من قاعدة كود واحدة باستخدام React Native وExpo، "
            "مرتبطة بواجهة برمجية آمنة."
        ),
        "short_description_en": (
            "Android and iOS apps from a single codebase using React Native and Expo, "
            "backed by a secure API."
        ),
        "description_ar": (
            "نطوّر تطبيقات الموبايل بقاعدة كود واحدة تعمل على Android وiOS معًا "
            "باستخدام React Native وExpo. الفائدة العملية أن تكلفة التطوير والصيانة "
            "تقارب نصف ما يتطلبه بناء تطبيقين منفصلين، وأن أي تعديل يصل للمنصتين "
            "في وقت واحد.\n\n"
            "التطبيق لا يعمل بمعزل عن بقية أنظمتك. نبني له واجهة برمجية على Django "
            "REST Framework بمصادقة JWT، فيشترك مع موقعك ولوحة تحكمك في نفس قاعدة "
            "البيانات ونفس الصلاحيات. هذا يعني أن الطلب الذي يُنشأ من التطبيق يظهر "
            "فورًا في لوحة التحكم دون أي مزامنة يدوية.\n\n"
            "نراعي في التصميم واقع الشبكات في المنطقة: تخزين محلي للبيانات المتكررة، "
            "وسلوك واضح عند انقطاع الاتصال، وحجم تحميل منخفض. وعند الحاجة نضيف "
            "الإشعارات الفورية والعمل دون إنترنت. نتولى كذلك تجهيز التطبيق للنشر على "
            "المتجرين وتسليمك ملفات البناء وحسابات النشر باسمك."
        ),
        "description_en": (
            "We build mobile apps from a single codebase that runs on both Android and "
            "iOS using React Native and Expo. In practice this cuts development and "
            "maintenance cost close to half compared with two separate native apps, and "
            "every change reaches both platforms at once.\n\n"
            "The app does not live in isolation. We build it a Django REST Framework API "
            "with JWT authentication, so it shares one database and one permission model "
            "with your website and dashboard. An order created in the app appears in the "
            "dashboard immediately, with no manual syncing.\n\n"
            "The design accounts for regional network realities: local caching, clear "
            "offline behaviour, and a small download size. Push notifications and offline "
            "mode are added when needed. We also prepare store submission and hand over the "
            "build files and publishing accounts in your name."
        ),
        "features": [
            {"title_ar": "منصتان بقاعدة كود واحدة", "title_en": "Two platforms, one codebase",
             "description_ar": "Android وiOS من مصدر واحد، بتكلفة وصيانة أقل.",
             "description_en": "Android and iOS from one source, at lower cost.",
             "icon": "smartphone"},
            {"title_ar": "واجهة برمجية مشتركة", "title_en": "Shared API",
             "description_ar": "التطبيق والموقع ولوحة التحكم على نفس البيانات والصلاحيات.",
             "description_en": "App, site, and dashboard share data and permissions.",
             "icon": "share-2"},
            {"title_ar": "يراعي ضعف الشبكة", "title_en": "Built for weak networks",
             "description_ar": "تخزين محلي وسلوك واضح عند انقطاع الاتصال.",
             "description_en": "Local caching and clear offline behaviour.",
             "icon": "wifi-off"},
            {"title_ar": "جاهز للنشر", "title_en": "Store-ready",
             "description_ar": "تجهيز كامل للنشر على Google Play وApp Store.",
             "description_en": "Full preparation for Google Play and the App Store.",
             "icon": "upload"},
        ],
        "deliverables": [
            {"ar": "كود التطبيق كاملًا", "en": "Complete app source code"},
            {"ar": "ملفات البناء للمنصتين", "en": "Build artifacts for both platforms"},
            {"ar": "واجهة برمجية موثّقة", "en": "Documented API"},
            {"ar": "تجهيز حسابات النشر باسمك", "en": "Store accounts prepared in your name"},
        ],
        "technologies": ["react-native", "expo", "django-rest-framework", "jwt", "postgresql"],
    },
    {
        "slug": "systems-analysis-and-design",
        "kind": Service.Kind.SERVICE,
        "sector": Sector.GENERAL,
        "icon": "workflow",
        "title_ar": "تحليل وتصميم الأنظمة",
        "title_en": "Systems Analysis & Design",
        "short_description_ar": (
            "دراسة كاملة لمتطلبات نظامك قبل التنفيذ: مخططات UML وERD ووثيقة متطلبات "
            "تصلح للتنفيذ مع أي فريق."
        ),
        "short_description_en": (
            "A complete requirements study before development: UML and ERD diagrams and "
            "a specification any team can build from."
        ),
        "description_ar": (
            "أكثر ما يُفشل المشاريع البرمجية ليس ضعف البرمجة، بل البدء بالتنفيذ قبل "
            "فهم المشكلة. هذه الخدمة مخصصة لمن يريد دراسة نظامه دراسة صحيحة قبل أن "
            "ينفق على التطوير.\n\n"
            "نبدأ بجلسات مع أصحاب العمل والمستخدمين الفعليين لتوثيق العمليات الحالية "
            "كما تجري لا كما يُفترض أن تجري. ثم نحدد المستخدمين وأدوارهم، ونكتب حالات "
            "الاستخدام لكل دور، ونرسم مخططات UML للعمليات الأساسية، ومخطط ERD كامل "
            "لقاعدة البيانات بعلاقاتها وقيودها.\n\n"
            "المخرج النهائي وثيقة متطلبات مكتوبة بلغة واضحة، تتضمن نطاق العمل وما هو "
            "خارجه صراحة، وتقديرًا للمراحل والمدة. هذه الوثيقة ملكك، ويمكنك تنفيذها "
            "معنا أو مع أي فريق آخر — وهي أيضًا مرجعك عند الخلاف حول ما اتُّفق عليه. "
            "كثير من العملاء يبدأ بهذه الخدمة وحدها ليعرف حجم مشروعه الحقيقي قبل "
            "الالتزام بميزانية.\n\n"
            "نُسلّم كذلك تصورًا للمعمارية التقنية المناسبة لحجم مؤسستك: هل تحتاج نظامًا "
            "على الويب أم تطبيقًا محليًا، وهل يبرر حجم بياناتك قاعدة بيانات مركزية، "
            "وما التكلفة التشغيلية المتوقعة للاستضافة والصيانة سنويًا. هذه الأسئلة "
            "تُحسم قبل التنفيذ لا بعده، لأن تغييرها لاحقًا مكلف."
        ),
        "description_en": (
            "What sinks software projects is rarely weak coding — it is starting to build "
            "before understanding the problem. This service is for anyone who wants their "
            "system studied properly before spending on development.\n\n"
            "We start with sessions with owners and actual users to document current "
            "processes as they really run, not as they are assumed to run. Then we define "
            "users and roles, write use cases for each role, draw UML diagrams for the core "
            "processes, and produce a complete ERD with relationships and constraints.\n\n"
            "The deliverable is a requirements document in plain language, with an explicit "
            "scope and out-of-scope list and an estimate of phases and duration. The document "
            "is yours: build it with us or with any other team. Many clients start with this "
            "service alone, to learn the true size of their project before committing a budget."
        ),
        "features": [
            {"title_ar": "توثيق الواقع", "title_en": "Documenting reality",
             "description_ar": "جلسات مع المستخدمين الفعليين لا افتراضات مكتبية.",
             "description_en": "Sessions with real users, not desk assumptions.",
             "icon": "users"},
            {"title_ar": "مخططات UML وERD", "title_en": "UML and ERD diagrams",
             "description_ar": "مخططات قابلة للتنفيذ مباشرة من أي فريق تطوير.",
             "description_en": "Diagrams any development team can build from.",
             "icon": "network"},
            {"title_ar": "نطاق صريح", "title_en": "Explicit scope",
             "description_ar": "ما يشمله المشروع وما لا يشمله مكتوبان بوضوح.",
             "description_en": "What the project includes and excludes, in writing.",
             "icon": "list-checks"},
            {"title_ar": "الوثيقة ملكك", "title_en": "The document is yours",
             "description_ar": "تنفّذها معي أو مع أي فريق تختاره.",
             "description_en": "Build it with me or any team you choose.",
             "icon": "file-check"},
        ],
        "deliverables": [
            {"ar": "وثيقة متطلبات كاملة", "en": "Complete requirements document"},
            {"ar": "مخططات UML لحالات الاستخدام والعمليات", "en": "UML use case and process diagrams"},
            {"ar": "مخطط ERD لقاعدة البيانات", "en": "Database ERD"},
            {"ar": "تقدير المراحل والمدة", "en": "Phase and duration estimate"},
        ],
        "technologies": ["uml", "erd", "postgresql", "sql"],
    },
    {
        "slug": "rest-api-development",
        "kind": Service.Kind.SERVICE,
        "sector": Sector.GENERAL,
        "icon": "plug",
        "title_ar": "بناء واجهات برمجية REST",
        "title_en": "REST API Development",
        "short_description_ar": (
            "واجهات برمجية منظّمة وموثّقة بمصادقة آمنة وصلاحيات دقيقة، تخدم موقعك "
            "وتطبيقك وأنظمتك الأخرى."
        ),
        "short_description_en": (
            "Structured, documented APIs with secure authentication and fine-grained "
            "permissions, serving your site, app, and other systems."
        ),
        "description_ar": (
            "الواجهة البرمجية هي العمود الذي تقف عليه كل واجهاتك: الموقع، وتطبيق "
            "الموبايل، ولوحة التحكم، وأي نظام خارجي تحتاج الربط معه. بناؤها بشكل صحيح "
            "من البداية يوفر عليك إعادة كتابة كل شيء لاحقًا.\n\n"
            "نبني الواجهات على Django REST Framework بمسارات منظمة ومُصدَّرة بإصدار "
            "واضح، ومصادقة JWT برموز قصيرة الأجل وتدوير آمن لرمز التجديد، ونظام "
            "صلاحيات يحدد بدقة من يقرأ ومن يكتب ومن ينشر. كل نقطة كتابة عامة محمية "
            "بتحديد معدل يمنع إساءة الاستخدام.\n\n"
            "التوثيق ليس إضافة اختيارية: تحصل على توثيق OpenAPI تفاعلي يتيح لأي مطور "
            "تجربة كل نقطة نهاية من المتصفح مباشرة. ونُسلّم كذلك اختبارات آلية تغطي "
            "المصادقة والصلاحيات والتحقق من المدخلات، فتبقى الواجهة موثوقة مع كل تعديل "
            "لاحق. إن كان لديك نظام قائم بلا واجهة برمجية، يمكننا بناء طبقة API فوقه "
            "دون إعادة كتابته."
        ),
        "description_en": (
            "The API is the backbone every interface stands on: your website, mobile app, "
            "dashboard, and any external system you integrate with. Building it correctly "
            "from the start saves rewriting everything later.\n\n"
            "We build APIs on Django REST Framework with versioned, organised routes, JWT "
            "authentication using short-lived tokens and safe refresh rotation, and a "
            "permission system that defines precisely who reads, writes, and publishes. "
            "Every public write endpoint is rate limited against abuse.\n\n"
            "Documentation is not optional: you get interactive OpenAPI docs where any "
            "developer can try each endpoint from the browser. We also deliver automated "
            "tests covering authentication, permissions, and input validation, so the API "
            "stays reliable through later changes. If you have an existing system with no "
            "API, we can build an API layer over it without a rewrite."
        ),
        "features": [
            {"title_ar": "مصادقة آمنة", "title_en": "Secure authentication",
             "description_ar": "JWT برموز قصيرة وتدوير آمن وإبطال فوري عند الخروج.",
             "description_en": "JWT with short tokens, safe rotation, instant revocation.",
             "icon": "shield-check"},
            {"title_ar": "صلاحيات دقيقة", "title_en": "Fine-grained permissions",
             "description_ar": "تحديد من يقرأ ومن يكتب ومن ينشر لكل مورد.",
             "description_en": "Per-resource control of read, write, and publish.",
             "icon": "key-round"},
            {"title_ar": "توثيق تفاعلي", "title_en": "Interactive documentation",
             "description_ar": "OpenAPI يتيح تجربة كل نقطة نهاية من المتصفح.",
             "description_en": "OpenAPI docs you can try from the browser.",
             "icon": "book-open"},
            {"title_ar": "اختبارات آلية", "title_en": "Automated tests",
             "description_ar": "تغطية للمصادقة والصلاحيات والتحقق من المدخلات.",
             "description_en": "Coverage for auth, permissions, and validation.",
             "icon": "test-tube"},
        ],
        "deliverables": [
            {"ar": "واجهة برمجية منظمة بإصدار واضح", "en": "Organised, versioned API"},
            {"ar": "توثيق OpenAPI تفاعلي", "en": "Interactive OpenAPI documentation"},
            {"ar": "اختبارات آلية للمصادقة والصلاحيات", "en": "Automated auth and permission tests"},
            {"ar": "دليل تكامل للمطورين", "en": "Developer integration guide"},
        ],
        "technologies": ["django-rest-framework", "django", "jwt", "python", "postgresql"],
    },
]

# --------------------------------------------------------------- الحلول القطاعية المنشورة

PUBLISHED_SOLUTIONS = [
    {
        "slug": "school-management-system",
        "kind": Service.Kind.SOLUTION,
        "sector": Sector.EDUCATION,
        "icon": "school",
        "title_ar": "أنظمة إدارة المدارس والمعاهد",
        "title_en": "School & Institute Management Systems",
        "short_description_ar": (
            "نظام متكامل لإدارة الطلاب والتسجيل والرسوم والدرجات والكادر، "
            "مع بوابة عامة للمدرسة."
        ),
        "short_description_en": (
            "A complete system for students, enrolment, fees, grades, and staff, "
            "with a public school portal."
        ),
        "description_ar": (
            "أنظمة إدارة المدارس التي نبنيها تنطلق من واقع المدرسة في السودان "
            "والمنطقة: تسجيل يبدأ ورقيًا، ورسوم تُدفع على دفعات، وكادر يحتاج واجهة "
            "بسيطة لا تدريبًا طويلًا.\n\n"
            "النظام يغطي دورة الطالب كاملة: التسجيل الإلكتروني للطلاب الجدد، وملف "
            "الطالب ببياناته ووثائقه، وتوزيع الفصول والشُّعب، ورصد الحضور والغياب، "
            "وإدخال الدرجات وإصدار كشوف النتائج، وإدارة الرسوم بالأقساط مع تتبع "
            "المتأخرات. وفي جانب الكادر: ملفات المعلمين والإداريين، وتوزيع الحصص، "
            "والصلاحيات حسب الدور.\n\n"
            "يرافق النظام موقع عام للمدرسة يعرض التعريف بها وكادرها وإعلاناتها، "
            "ويستقبل طلبات التسجيل مباشرة إلى النظام دون إدخال مزدوج. الواجهة عربية "
            "بالكامل ومصممة لتُستخدم من الهاتف، لأن كثيرًا من الإداريين لا يجلسون أمام "
            "حاسوب. النظام مبني ومُطبَّق فعليًا لدى جهة تعليمية عاملة.\n\n"
            "يُسلَّم النظام مع تدريب عملي للكادر الإداري على الاستخدام اليومي، وصلاحيات "
            "محددة لكل دور تمنع التعديل غير المصرّح به على الدرجات والرسوم، ونسخ "
            "احتياطي دوري لقاعدة البيانات. ويمكن توسيعه لاحقًا ليشمل عدة فروع تعمل "
            "ببيانات موحّدة وتقارير مقارنة بينها."
        ),
        "description_en": (
            "The school systems we build start from the reality of schools in Sudan and the "
            "region: enrolment that begins on paper, fees paid in instalments, and staff who "
            "need a simple interface rather than long training.\n\n"
            "The system covers the full student lifecycle: online enrolment for new students, "
            "a student file with data and documents, class and section allocation, attendance "
            "tracking, grade entry and result sheets, and instalment-based fee management with "
            "arrears tracking. On the staff side: teacher and administrator files, timetable "
            "allocation, and role-based permissions.\n\n"
            "A public school website accompanies the system, presenting the school, its staff, "
            "and its announcements, and feeding enrolment requests straight into the system with "
            "no double entry. The interface is fully Arabic and designed for phone use, because "
            "many administrators are not sitting at a desktop. The system is built and running "
            "at a working educational institution."
        ),
        "features": [
            {"title_ar": "دورة الطالب كاملة", "title_en": "Full student lifecycle",
             "description_ar": "من التسجيل إلى النتائج والوثائق في نظام واحد.",
             "description_en": "From enrolment to results and documents in one system.",
             "icon": "graduation-cap"},
            {"title_ar": "الرسوم بالأقساط", "title_en": "Instalment-based fees",
             "description_ar": "تتبع المدفوع والمتأخر لكل طالب وتقارير فورية.",
             "description_en": "Track paid and outstanding amounts per student.",
             "icon": "wallet"},
            {"title_ar": "موقع عام مرتبط", "title_en": "Connected public site",
             "description_ar": "طلبات التسجيل تصل النظام مباشرة بلا إدخال مزدوج.",
             "description_en": "Enrolment requests reach the system with no double entry.",
             "icon": "globe"},
            {"title_ar": "يعمل من الهاتف", "title_en": "Works from a phone",
             "description_ar": "واجهة عربية مصممة للاستخدام اليومي من الجوال.",
             "description_en": "Arabic interface designed for daily mobile use.",
             "icon": "smartphone"},
        ],
        "deliverables": [
            {"ar": "نظام إدارة مدرسي كامل", "en": "Complete school management system"},
            {"ar": "موقع عام للمدرسة", "en": "Public school website"},
            {"ar": "تدريب الكادر الإداري", "en": "Administrative staff training"},
            {"ar": "استضافة ونشر ودعم", "en": "Hosting, deployment, and support"},
        ],
        "technologies": ["django", "nextjs", "postgresql", "react"],
    },
    {
        "slug": "university-management-platform",
        "kind": Service.Kind.SOLUTION,
        "sector": Sector.EDUCATION,
        "icon": "library",
        "title_ar": "منصات إدارة الجامعات والكليات",
        "title_en": "University & College Platforms",
        "short_description_ar": (
            "منصة أكاديمية للكليات: القبول والتسجيل والمقررات والدرجات والرسوم، "
            "ببوابات منفصلة للطالب وعضو هيئة التدريس والإدارة."
        ),
        "short_description_en": (
            "An academic platform for colleges: admission, registration, courses, grades, "
            "and fees, with separate student, faculty, and administration portals."
        ),
        "description_ar": (
            "المؤسسات الجامعية تختلف عن المدارس في تعقيد أساسي: الطالب يسجل مقررات "
            "لا فصولًا، والدرجة تُحتسب بأوزان، والرسوم ترتبط بالساعات المعتمدة. "
            "بنيت منصة تراعي هذا الاختلاف وتعمل اليوم لدى مؤسسة جامعية.\n\n"
            "المنصة تقوم على ثلاث بوابات بصلاحيات منفصلة. بوابة الطالب: التسجيل في "
            "المقررات، الجدول الدراسي، الدرجات والمعدل التراكمي، الرسوم والمدفوعات، "
            "والإشعارات. بوابة عضو هيئة التدريس: المقررات المسندة، قوائم الطلاب، "
            "رصد الدرجات، والحضور. بوابة الإدارة: القبول، الخطط الدراسية، الشُّعب "
            "وأعدادها، الرسوم، والتقارير الأكاديمية والمالية.\n\n"
            "النظام يفصل بين البيانات الأكاديمية والمالية على مستوى الصلاحيات، فلا "
            "يرى المسجّل الأكاديمي بيانات مالية ولا العكس، ويسجل كل تعديل حساس في "
            "سجل تدقيق يمكن الرجوع إليه. الواجهة عربية بالكامل مع دعم الإنجليزية.\n\n"
            "بُنيت المنصة لتتحمل ضغط فترات التسجيل، وهي الفترة التي تنهار فيها معظم "
            "الأنظمة الأكاديمية: عشرات أو مئات الطلاب يسجلون في الوقت نفسه على شبكة "
            "متفاوتة الجودة. تعالج المنصة ذلك بتخزين مؤقت للبيانات الثابتة، وقيود على "
            "مستوى قاعدة البيانات تمنع تجاوز سعة الشُّعب حتى عند التسجيل المتزامن. "
            "والمنصة تعمل اليوم فعليًا لدى مؤسسة جامعية."
        ),
        "description_en": (
            "Universities differ from schools in one fundamental way: students register for "
            "courses rather than classes, grades are weighted, and fees are tied to credit "
            "hours. We built a platform that accounts for this and it runs today at a working "
            "university institution.\n\n"
            "The platform rests on three portals with separate permissions. The student portal: "
            "course registration, timetable, grades and GPA, fees and payments, notifications. "
            "The faculty portal: assigned courses, student lists, grade entry, attendance. The "
            "administration portal: admission, study plans, sections and capacities, fees, and "
            "academic and financial reporting.\n\n"
            "The system separates academic and financial data at the permission level — the "
            "academic registrar does not see financial records and vice versa — and records "
            "every sensitive change in an auditable log. The interface is fully Arabic with "
            "English support."
        ),
        "features": [
            {"title_ar": "ثلاث بوابات منفصلة", "title_en": "Three separate portals",
             "description_ar": "الطالب وعضو هيئة التدريس والإدارة بصلاحيات مستقلة.",
             "description_en": "Student, faculty, and administration with distinct permissions.",
             "icon": "users"},
            {"title_ar": "تسجيل بالمقررات", "title_en": "Course registration",
             "description_ar": "خطط دراسية وشُعب وساعات معتمدة ومعدل تراكمي.",
             "description_en": "Study plans, sections, credit hours, and GPA.",
             "icon": "book-open"},
            {"title_ar": "فصل مالي وأكاديمي", "title_en": "Financial and academic separation",
             "description_ar": "الصلاحيات تمنع اطلاع كل جهة على بيانات الأخرى.",
             "description_en": "Permissions keep each side out of the other's data.",
             "icon": "shield"},
            {"title_ar": "سجل تدقيق", "title_en": "Audit log",
             "description_ar": "كل تعديل على الدرجات أو الرسوم مسجَّل ومنسوب.",
             "description_en": "Every grade or fee change is logged and attributed.",
             "icon": "history"},
        ],
        "deliverables": [
            {"ar": "منصة أكاديمية بثلاث بوابات", "en": "Academic platform with three portals"},
            {"ar": "تقارير أكاديمية ومالية", "en": "Academic and financial reports"},
            {"ar": "تدريب الكادر", "en": "Staff training"},
            {"ar": "استضافة ونشر ودعم", "en": "Hosting, deployment, and support"},
        ],
        "technologies": ["django", "django-rest-framework", "postgresql", "nextjs"],
    },
]

# --------------------------------------------------------------- مسودات (تُستكمل لاحقًا)

DRAFT_SERVICES = [
    ("desktop-application-development", Service.Kind.SERVICE, Sector.GENERAL,
     "تطوير تطبيقات سطح المكتب", "Desktop Application Development",
     "تطبيقات Windows بلغة C# تعمل محليًا وتتصل بقاعدة بيانات مركزية عند الحاجة."),
    ("database-design", Service.Kind.SERVICE, Sector.GENERAL,
     "تصميم قواعد البيانات", "Database Design",
     "تصميم قواعد بيانات مُعيَّرة بمخطط ERD واضح وفهرسة وقيود سلامة."),
    ("legacy-system-modernization", Service.Kind.SERVICE, Sector.GENERAL,
     "تطوير الأنظمة القائمة", "Legacy System Modernization",
     "تحديث الأنظمة العاملة وإضافة واجهات برمجية وواجهات حديثة دون إعادة بنائها."),
    ("hosting-and-deployment", Service.Kind.SERVICE, Sector.GENERAL,
     "الاستضافة والنشر", "Hosting & Deployment",
     "إعداد الخوادم والنطاقات وشهادات SSL والنسخ الاحتياطي والمراقبة."),
    ("maintenance-and-support", Service.Kind.SERVICE, Sector.GENERAL,
     "الصيانة والدعم الفني", "Maintenance & Support",
     "عقود صيانة دورية وتحديثات أمنية ودعم فني للأنظمة القائمة."),
    ("elearning-platform", Service.Kind.SOLUTION, Sector.EDUCATION,
     "منصات التعليم الإلكتروني", "E-Learning Platforms",
     "منصات دورات ومحتوى تعليمي بمتابعة تقدم الطالب والاختبارات والشهادات."),
    ("pos-system", Service.Kind.SOLUTION, Sector.RETAIL,
     "أنظمة نقاط البيع", "Point of Sale Systems",
     "نقاط بيع للمتاجر والبقالات مع المخزون والباركود والتقارير اليومية."),
    ("restaurant-system", Service.Kind.SOLUTION, Sector.RESTAURANTS,
     "أنظمة المطاعم", "Restaurant Systems",
     "إدارة الطلبات والطاولات والمطبخ والتوصيل وقوائم الأصناف."),
    ("pharmacy-system", Service.Kind.SOLUTION, Sector.PHARMACY,
     "أنظمة إدارة الصيدليات", "Pharmacy Management Systems",
     "إدارة الأدوية والصلاحيات وتواريخ الانتهاء والمبيعات والمخزون."),
    ("accounting-system", Service.Kind.SOLUTION, Sector.ACCOUNTING,
     "الأنظمة المحاسبية", "Accounting Systems",
     "دليل حسابات وقيود ويومية وميزان مراجعة وقوائم مالية."),
    ("hr-system", Service.Kind.SOLUTION, Sector.HR,
     "أنظمة الموارد البشرية", "HR Systems",
     "ملفات الموظفين والحضور والإجازات والرواتب والتقييم."),
    ("real-estate-system", Service.Kind.SOLUTION, Sector.REAL_ESTATE,
     "أنظمة إدارة العقارات", "Real Estate Management Systems",
     "إدارة العقارات والوحدات والعقود والإيجارات والتحصيل."),
    ("inventory-system", Service.Kind.SOLUTION, Sector.LOGISTICS,
     "أنظمة المخزون", "Inventory Systems",
     "حركة الأصناف والمخازن والجرد وحدود إعادة الطلب."),
    ("multi-branch-system", Service.Kind.SOLUTION, Sector.GENERAL,
     "أنظمة إدارة الفروع", "Multi-Branch Systems",
     "إدارة عدة فروع ببيانات موحدة وصلاحيات وتقارير مقارنة."),
    ("ngo-management-system", Service.Kind.SOLUTION, Sector.NGO,
     "أنظمة إدارة المنظمات", "NGO Management Systems",
     "إدارة المشاريع والمستفيدين والمانحين والتقارير الدورية."),
    ("erp-system", Service.Kind.SOLUTION, Sector.GENERAL,
     "أنظمة ERP المتكاملة", "Integrated ERP Systems",
     "ربط المخزون والمبيعات والمحاسبة والموارد البشرية في نظام واحد."),
]

# --------------------------------------------------------------- المشاريع الحقيقية

PROJECTS = [
    {
        "slug": "eust-academic-platform",
        "title_ar": "منصة كلية الإمارات للعلوم والتكنولوجيا",
        "title_en": "Emirates College for Science and Technology Platform",
        "summary_ar": (
            "منصة أكاديمية لمؤسسة جامعية تخدم الطلاب وأعضاء هيئة التدريس والإدارة "
            "ببوابات وصلاحيات منفصلة."
        ),
        "summary_en": (
            "An academic platform for a university institution serving students, faculty, "
            "and administration through separate portals and permissions."
        ),
        "description_ar": (
            "منصة أكاديمية متكاملة تعمل حاليًا لدى الكلية الإماراتية للعلوم والتكنولوجيا. "
            "تخدم المنصة ثلاث فئات مستخدمين بصلاحيات منفصلة: الطلاب، وأعضاء هيئة التدريس، "
            "والإدارة الأكاديمية.\n\n"
            "تغطي المنصة التسجيل في المقررات، والجداول الدراسية، ورصد الدرجات، ومتابعة "
            "الرسوم، إضافة إلى تقارير أكاديمية ومالية للإدارة."
        ),
        "description_en": (
            "A complete academic platform currently running at the Emirates College for "
            "Science and Technology. It serves three user groups with separate permissions: "
            "students, faculty, and academic administration.\n\n"
            "The platform covers course registration, timetables, grade entry, fee tracking, "
            "and academic and financial reporting for administration."
        ),
        "sector": Sector.EDUCATION,
        "project_type": ProjectType.SYSTEM,
        "status": ProjectStatus.MAINTAINED,
        "client_name": "الكلية الإماراتية للعلوم والتكنولوجيا",
        "client_permission": True,
        "live_url": "https://platform.eust.edu.sd/",
        "is_featured": True,
        "technologies": ["django", "python", "postgresql", "javascript", "sql"],
        "services": ["university-management-platform", "systems-analysis-and-design"],
    },
    {
        "slug": "number-one-schools",
        "title_ar": "موقع ونظام مدارس ومعاهد نمبر ون",
        "title_en": "Number One Schools & Institutes",
        "summary_ar": (
            "موقع تعريفي لمجموعة مدارس ومعاهد مع بوابة تسجيل إلكتروني للطلاب الجدد "
            "ودليل للكادر التعليمي والإداري."
        ),
        "summary_en": (
            "A public site for a group of schools and institutes with an online enrolment "
            "portal for new students and a teaching and administrative staff directory."
        ),
        "description_ar": (
            "موقع ونظام يعملان حاليًا لمجموعة مدارس ومعاهد نمبر ون. يعرض الموقع التعريف "
            "بالمجموعة ودليل الكادر التعليمي والإداري والإعلانات الجارية.\n\n"
            "يرتبط بالموقع نظام تسجيل إلكتروني يستقبل طلبات الطلاب الجدد ويصلها مباشرة "
            "إلى الإدارة، مع لوحة تحكم لإدارة المحتوى والكادر والإعلانات دون تعديل الكود."
        ),
        "description_en": (
            "A website and system currently running for the Number One group of schools and "
            "institutes. The site presents the group, its teaching and administrative staff "
            "directory, and current announcements.\n\n"
            "An online enrolment system is connected to the site, receiving new student "
            "applications and routing them straight to administration, with a dashboard for "
            "managing content, staff, and announcements without code changes."
        ),
        "sector": Sector.EDUCATION,
        "project_type": ProjectType.WEB,
        "status": ProjectStatus.MAINTAINED,
        "client_name": "مدارس ومعاهد نمبر ون",
        "client_permission": True,
        "live_url": "https://numberoneschools.com/",
        "is_featured": True,
        "technologies": ["django", "python", "javascript", "sql"],
        "services": ["school-management-system", "web-development"],
    },
]

# --------------------------------------------------------------- أقسام الصفحة الرئيسية

HOME_SECTIONS = [
    ("hero", "حلول برمجية متكاملة للويب والموبايل وسطح المكتب",
     "Complete software solutions for web, mobile, and desktop",
     "نحلل ونصمم ونبني أنظمة وتطبيقات قابلة للتوسع، من الفكرة والمتطلبات إلى التطوير والنشر والدعم.",
     "We analyse, design, and build scalable systems and applications — from idea and requirements to development, deployment, and support.",
     {}),
    ("intro", "نبذة", "About", "", "", {}),
    ("stats", "بالأرقام", "By the numbers", "", "", {}),
    ("services", "الخدمات", "Services",
     "خدمات تطوير تغطي دورة المشروع كاملة.", "Development services covering the full project cycle.",
     {"limit": 6}),
    ("solutions", "حلول حسب القطاع", "Solutions by sector",
     "أنظمة جاهزة للتخصيص حسب مجال عملك.", "Systems ready to be tailored to your field.",
     {"limit": 6}),
    ("projects", "مشاريع مختارة", "Selected work", "", "", {"limit": 6}),
    ("case_studies", "دراسات حالة", "Case studies", "", "", {"limit": 3}),
    ("process", "طريقة العمل", "How we work", "", "", {}),
    ("technologies", "التقنيات", "Technologies", "", "", {}),
    ("testimonials", "آراء العملاء", "Client feedback", "", "", {"limit": 6}),
    ("posts", "أحدث المقالات", "Latest articles", "", "", {"limit": 3}),
    ("newsletter", "النشرة البريدية", "Newsletter",
     "مقالات ومشاريع جديدة، بلا إزعاج.", "New articles and projects, no noise.", {}),
    ("cta", "لديك مشروع؟", "Have a project?",
     "أرسل تفاصيل مشروعك وسنعود إليك بتصور مبدئي.",
     "Send your project details and we will come back with an initial outline.",
     {}),
]

# --------------------------------------------------------------- مراحل العمل

PROCESS_STEPS = [
    ("التحليل والمتطلبات", "Analysis & Requirements",
     "جلسات مع أصحاب العمل والمستخدمين لتوثيق العمليات الفعلية، وتحديد الأدوار وحالات الاستخدام، وكتابة نطاق العمل صراحة.",
     "Sessions with owners and users to document real processes, define roles and use cases, and write an explicit scope.",
     "clipboard-list"),
    ("التصميم والمعمارية", "Design & Architecture",
     "مخطط قاعدة البيانات ERD، ومخططات UML للعمليات، وخريطة الشاشات، واختيار التقنيات بمبررات مكتوبة.",
     "Database ERD, UML process diagrams, screen map, and technology choices with written rationale.",
     "network"),
    ("بناء الواجهة البرمجية", "API Development",
     "بناء الخادم وقاعدة البيانات والمصادقة والصلاحيات، مع توثيق تفاعلي واختبارات آلية.",
     "Server, database, authentication, and permissions, with interactive docs and automated tests.",
     "server"),
    ("بناء الواجهات", "Interface Development",
     "الواجهة العامة ولوحة التحكم بدعم كامل للعربية والإنجليزية، وحالات تحميل وخطأ وفراغ لكل شاشة.",
     "Public interface and dashboard with full Arabic and English support, and loading, error, and empty states everywhere.",
     "layout"),
    ("المراجعة والاختبار", "Review & Testing",
     "اختبار الوظائف والصلاحيات والأداء وإمكانية الوصول، ومراجعة معك على بيئة تجريبية قبل النشر.",
     "Functional, permission, performance, and accessibility testing, plus review with you on a staging environment.",
     "test-tube"),
    ("النشر والتسليم", "Deployment & Handover",
     "النشر على الخادم مع شهادة SSL ونسخ احتياطي، وتسليم الكود والتوثيق، وجلسة تدريب للفريق.",
     "Deployment with SSL and backups, code and documentation handover, and a team training session.",
     "rocket"),
]

# --------------------------------------------------------------- أسئلة شائعة (تحتاج مراجعتك)

DRAFT_FAQS = [
    ("كم يستغرق تنفيذ المشروع؟", "How long does a project take?",
     "المدة تعتمد على نطاق المشروع. نُعطي تقديرًا مكتوبًا للمراحل والمدة بعد جلسة التحليل الأولى، قبل أي التزام مالي.",
     "It depends on scope. We give a written estimate of phases and duration after the first analysis session, before any financial commitment.",
     FAQ.Scope.PROCESS),
    ("كيف تُحسب تكلفة المشروع؟", "How is project cost calculated?",
     "التكلفة تُحدد بعد تحليل المتطلبات، لأن التقدير قبل معرفة النطاق يضر الطرفين. نُقدّم عرضًا مفصلًا يوضح ما يشمله السعر وما لا يشمله.",
     "Cost is set after requirements analysis, since estimating before knowing scope harms both sides. We provide a detailed quote showing what the price includes and excludes.",
     FAQ.Scope.PRICING),
    ("هل أحصل على كود المصدر؟", "Do I get the source code?",
     "نعم. كود المصدر وقاعدة البيانات والتوثيق ملكك بالكامل بعد التسليم، على مستودع Git باسمك.",
     "Yes. Source code, database, and documentation are fully yours after handover, in a Git repository in your name.",
     FAQ.Scope.GLOBAL),
    ("هل تعمل مع عملاء خارج السودان؟", "Do you work with clients outside Sudan?",
     "نعم. العمل يتم عن بُعد بالكامل، والتواصل بالعربية أو الإنجليزية حسب تفضيلك.",
     "Yes. Work is fully remote, and communication is in Arabic or English as you prefer.",
     FAQ.Scope.GLOBAL),
    ("ماذا يحدث بعد التسليم؟", "What happens after handover?",
     "نُسلّم النظام مع توثيق وجلسة تدريب، ويمكن الاتفاق على عقد صيانة دورية للتحديثات الأمنية والدعم الفني.",
     "The system is handed over with documentation and a training session, and a periodic maintenance contract can be agreed for security updates and support.",
     FAQ.Scope.PROCESS),
]


class Command(BaseCommand):
    help = "زرع المحتوى الأولي الحقيقي"

    def add_arguments(self, parser):
        parser.add_argument(
            "--reset-sections",
            action="store_true",
            help="إعادة ضبط أقسام الصفحة الرئيسية إلى ترتيبها الافتراضي",
        )
        parser.add_argument(
            "--only-if-empty",
            action="store_true",
            help="لا يزرع إلا على قاعدة بيانات جديدة — يمنع طمس تعديلات اللوحة",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        # الزرع يستخدم update_or_create، فتكراره يعيد كتابة ما حرّره المستخدم.
        # في الإقلاع يُستدعى بهذا الخيار كي يعمل مرة واحدة على قاعدة فارغة.
        if options["only_if_empty"] and Service.objects.exists():
            self.stdout.write("المحتوى موجود — تخطّي الزرع")
            return

        technologies = self._seed_technologies()
        self._seed_settings()
        self._seed_sections(reset=options["reset_sections"])
        self._seed_process_steps()

        services = self._seed_services(technologies)
        services |= self._seed_drafts()
        self._seed_projects(technologies, services)
        self._seed_faqs()

        self._verify_published_services()
        self._print_manual_checklist()

    # ---------------------------------------------------------- التقنيات

    def _seed_technologies(self) -> dict[str, Technology]:
        result: dict[str, Technology] = {}
        for order, (name, slug, category, proficiency, featured) in enumerate(TECHNOLOGIES):
            technology, _ = Technology.objects.update_or_create(
                slug=slug,
                defaults={
                    "name": name,
                    "category": category,
                    "proficiency": proficiency,
                    "is_featured": featured,
                    "display_order": order,
                    "is_active": True,
                },
            )
            result[slug] = technology
        self.stdout.write(f"  التقنيات: {len(result)}")
        return result

    # ---------------------------------------------------------- الإعدادات

    def _seed_settings(self) -> None:
        site = SiteSettings.load()
        if not site.site_name_ar or site.site_name_ar in ("stingdev", "NEXA SYSTEMS"):
            site.site_name_ar = "نيكسا سيستمز"
            site.site_name_en = "NEXA SYSTEMS"
        if not site.tagline_ar:
            site.tagline_ar = "حلول برمجية متكاملة للويب والموبايل وسطح المكتب"
            site.tagline_en = "Complete software solutions for web, mobile, and desktop"
        if not site.whatsapp_default_message_ar:
            site.whatsapp_default_message_ar = "السلام عليكم، نرغب في مناقشة مشروع."
            site.whatsapp_default_message_en = "Hello, we would like to discuss a project."
        site.default_language = site.default_language or "ar"
        site.country = site.country or "SD"
        site.save()

        seo = SEOSettings.load()
        if not seo.default_seo_title_ar or "stingdev" in seo.default_seo_title_ar.lower():
            seo.default_seo_title_ar = "NEXA SYSTEMS — حلول برمجية للويب والموبايل وسطح المكتب"
            seo.default_seo_title_en = "NEXA SYSTEMS — Software solutions for web, mobile, and desktop"
            seo.default_seo_description_ar = (
                "نحلل ونصمم ونبني أنظمة وتطبيقات قابلة للتوسع: مواقع، تطبيقات موبايل، "
                "أنظمة إدارية، وواجهات برمجية."
            )
            seo.default_seo_description_en = (
                "We analyse, design, and develop scalable systems: websites, mobile apps, "
                "management systems, and APIs."
            )
            seo.save()

        self.stdout.write("  الإعدادات: مهيّأة")

    # ---------------------------------------------------------- الأقسام

    def _seed_sections(self, *, reset: bool) -> None:
        for order, (key, title_ar, title_en, sub_ar, sub_en, config) in enumerate(HOME_SECTIONS):
            defaults = {
                "title_ar": title_ar,
                "title_en": title_en,
                "subtitle_ar": sub_ar,
                "subtitle_en": sub_en,
                "display_order": order,
                "config": config,
                "is_visible": True,
                "auto_hide_when_empty": True,
            }
            if reset:
                PageSection.objects.update_or_create(
                    page=PageSection.Page.HOME, key=key, defaults=defaults
                )
            else:
                PageSection.objects.get_or_create(
                    page=PageSection.Page.HOME, key=key, defaults=defaults
                )
        self.stdout.write(f"  أقسام الرئيسية: {len(HOME_SECTIONS)}")

    def _seed_process_steps(self) -> None:
        for order, (title_ar, title_en, desc_ar, desc_en, icon) in enumerate(PROCESS_STEPS):
            ProcessStep.objects.update_or_create(
                title_ar=title_ar,
                defaults={
                    "title_en": title_en,
                    "description_ar": desc_ar,
                    "description_en": desc_en,
                    "icon": icon,
                    "display_order": order,
                    "is_active": True,
                },
            )
        self.stdout.write(f"  مراحل العمل: {len(PROCESS_STEPS)}")

    # ---------------------------------------------------------- الخدمات

    def _seed_services(self, technologies: dict[str, Technology]) -> dict[str, Service]:
        result: dict[str, Service] = {}
        entries = PUBLISHED_SERVICES + PUBLISHED_SOLUTIONS

        for order, entry in enumerate(entries):
            data = {key: value for key, value in entry.items() if key != "technologies"}
            slug = data.pop("slug")
            service, _ = Service.objects.update_or_create(
                slug=slug,
                defaults={
                    **data,
                    "display_order": order,
                    "is_featured": order < 4,
                    "is_published": True,
                    "published_at": timezone.now(),
                },
            )
            service.technologies.set(
                [technologies[key] for key in entry["technologies"] if key in technologies]
            )
            result[slug] = service

        self.stdout.write(f"  الخدمات والحلول المنشورة: {len(result)}")
        return result

    def _seed_drafts(self) -> dict[str, Service]:
        result: dict[str, Service] = {}
        for order, (slug, kind, sector, title_ar, title_en, short_ar) in enumerate(DRAFT_SERVICES):
            service, _ = Service.objects.update_or_create(
                slug=slug,
                defaults={
                    "kind": kind,
                    "sector": sector,
                    "title_ar": title_ar,
                    "title_en": title_en,
                    "short_description_ar": short_ar,
                    "display_order": 100 + order,
                    "is_published": False,
                },
            )
            result[slug] = service
        self.stdout.write(f"  مسودات بانتظار المحتوى: {len(result)}")
        return result

    # ---------------------------------------------------------- المشاريع

    def _seed_projects(
        self, technologies: dict[str, Technology], services: dict[str, Service]
    ) -> None:
        for order, entry in enumerate(PROJECTS):
            data = {
                key: value
                for key, value in entry.items()
                if key not in ("technologies", "services")
            }
            slug = data.pop("slug")
            project, _ = Project.objects.update_or_create(
                slug=slug,
                defaults={
                    **data,
                    "display_order": order,
                    "is_published": True,
                    "published_at": timezone.now(),
                },
            )

            ProjectTechnology.objects.filter(project=project).delete()
            for index, key in enumerate(entry["technologies"]):
                technology = technologies.get(key)
                if technology:
                    ProjectTechnology.objects.create(
                        project=project,
                        technology=technology,
                        role=(
                            ProjectTechnology.Role.PRIMARY
                            if index < 2
                            else ProjectTechnology.Role.SECONDARY
                        ),
                    )

            for service_slug in entry["services"]:
                service = services.get(service_slug)
                if service:
                    service.related_projects.add(project)

        self.stdout.write(f"  المشاريع: {len(PROJECTS)}")

    # ---------------------------------------------------------- الأسئلة الشائعة

    def _seed_faqs(self) -> None:
        for order, (q_ar, q_en, a_ar, a_en, scope) in enumerate(DRAFT_FAQS):
            FAQ.objects.get_or_create(
                question_ar=q_ar,
                defaults={
                    "question_en": q_en,
                    "answer_ar": a_ar,
                    "answer_en": a_en,
                    "scope": scope,
                    "display_order": order,
                    # غير مفعّلة: هذه إجابات تمثّل التزامات تجارية تحتاج مراجعتك
                    "is_active": False,
                },
            )
        self.stdout.write(f"  أسئلة شائعة (غير مفعّلة): {len(DRAFT_FAQS)}")

    # ---------------------------------------------------------- التحقق

    def _verify_published_services(self) -> None:
        failures = []
        for service in Service.objects.filter(is_published=True):
            problems = service.publication_blockers()
            if problems:
                failures.append((service.slug, problems))

        if failures:
            self.stdout.write(self.style.ERROR("\nخدمات منشورة لا تستوفي حد المحتوى:"))
            for slug, problems in failures:
                self.stdout.write(f"  - {slug}: {problems[0]}")
            raise SystemExit(1)

        count = Service.objects.filter(is_published=True).count()
        self.stdout.write(
            self.style.SUCCESS(f"\nتحقّق: {count} صفحة منشورة تستوفي الحد الأدنى للمحتوى.")
        )

    def _print_manual_checklist(self) -> None:
        self.stdout.write(
            self.style.WARNING(
                "\nلم يُزرع ما لا يمكن التحقق منه. أكمل هذه العناصر من لوحة التحكم:"
            )
        )
        for item in [
            "بيانات التواصل: البريد، الهاتف، رقم واتساب، المدينة.",
            "الصور: الشعار الفاتح والداكن، أيقونة الموقع، صورتك الشخصية.",
            "السيرة الذاتية بالعربية والإنجليزية (ملف PDF).",
            "النبذة الشخصية: owner_bio بالعربية والإنجليزية.",
            "الخبرات والمؤهل العلمي والشهادات.",
            "الإحصائيات: أرقام حقيقية فقط (سنوات الخبرة، عدد المشاريع، القطاعات).",
            "شهادات العملاء مع رابط يثبتها — لا تُضف شهادة غير حقيقية.",
            "مراجعة الأسئلة الشائعة الخمسة وتفعيلها بعد التأكد من مطابقتها لسياستك.",
            "صور غلاف للمشروعين، ولقطات داخلية ببيانات مموّهة.",
            "تواريخ إنجاز المشروعين، ودراسة حالة لكل منهما.",
            "استكمال محتوى المسودات الـ16 قبل نشرها (الحد 120 كلمة عربية).",
            "روابط التواصل الاجتماعي.",
        ]:
            self.stdout.write(f"  □ {item}")

        self.stdout.write(
            "\nالأقسام الفارغة تختفي تلقائيًا من الصفحة الرئيسية حتى تُملأ.\n"
        )
